#!/usr/bin/env bash
# Single-user benchmark — sequential requests measuring tok/s without concurrency
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/.env"

RUNS=${1:-5}
PROMPT="Explain in 3 sentences what Docker is."
MAX_TOKENS=128

echo "Single-user benchmark: $RUNS sequential requests"
echo "Endpoint:  $NIM_URL"
echo "Model:     $NIM_MODEL"
echo "Max tokens: $MAX_TOKENS"
echo "---"

total_tokens=0
total_duration=0

for i in $(seq 1 "$RUNS"); do
  start=$(date +%s%N)

  response=$(curl -s "$NIM_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"$NIM_MODEL\",
      \"messages\": [{\"role\": \"user\", \"content\": \"$PROMPT\"}],
      \"max_tokens\": $MAX_TOKENS
    }")

  end=$(date +%s%N)
  duration=$(echo "scale=3; ($end - $start) / 1000000000" | bc)

  tokens=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['usage']['completion_tokens'])" 2>/dev/null || echo "0")
  tps=$(echo "scale=1; $tokens / $duration" | bc 2>/dev/null || echo "0")

  total_tokens=$(echo "$total_tokens + $tokens" | bc)
  total_duration=$(echo "$total_duration + $duration" | bc)

  printf "  Run %d/%d: %.2fs | %s tokens | %s tok/s\n" "$i" "$RUNS" "$duration" "$tokens" "$tps"
done

avg_tps=$(echo "scale=1; $total_tokens / $total_duration" | bc 2>/dev/null || echo "0")
avg_duration=$(echo "scale=2; $total_duration / $RUNS" | bc)

echo "---"
printf "Average: %s tok/s | %.2fs per request | %s total tokens\n" "$avg_tps" "$avg_duration" "$total_tokens"
