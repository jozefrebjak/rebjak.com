#!/usr/bin/env bash
# Benchmark — concurrent requests to NIM endpoint
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/.env"

CONCURRENT=${1:-8}
PROMPT="Explain in 3 sentences what Docker is."

echo "Benchmark: $CONCURRENT concurrent requests"
echo "Endpoint:  $NIM_URL"
echo "Model:     $NIM_MODEL"
echo "---"

bench() {
  local start end duration
  start=$(date +%s%N)

  response=$(curl -s "$NIM_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"$NIM_MODEL\",
      \"messages\": [{\"role\": \"user\", \"content\": \"$PROMPT\"}],
      \"max_tokens\": 128
    }")

  end=$(date +%s%N)
  duration=$(echo "scale=2; ($end - $start) / 1000000000" | bc)

  tokens=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['usage']['completion_tokens'])" 2>/dev/null || echo "0")
  tps=$(echo "scale=1; $tokens / $duration" | bc 2>/dev/null || echo "0")

  printf "  Request %s: %.2fs | %s tokens | %s tok/s\n" "$1" "$duration" "$tokens" "$tps"
}

for i in $(seq 1 "$CONCURRENT"); do
  bench "$i" &
done
wait

echo "---"
echo "Done."
