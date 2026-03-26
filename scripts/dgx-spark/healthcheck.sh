#!/usr/bin/env bash
# Healthcheck — verify NIM endpoint is running and responding
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/.env"

echo "Testing NIM at $NIM_URL (model: $NIM_MODEL)"
echo "---"

response=$(curl -s "$NIM_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$NIM_MODEL\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Hello, who are you?\"}],
    \"max_tokens\": 128
  }")

# Extract content and usage
content=$(echo "$response" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['choices'][0]['message']['content'])" 2>/dev/null)
tokens=$(echo "$response" | python3 -c "import sys,json; u=json.load(sys.stdin)['usage']; print(f\"prompt: {u['prompt_tokens']}, completion: {u['completion_tokens']}, total: {u['total_tokens']}\")" 2>/dev/null)

if [ -n "$content" ]; then
  echo "Response:"
  echo "$content"
  echo "---"
  echo "Tokens: $tokens"
else
  echo "Error: no response from NIM"
  echo "$response"
  exit 1
fi
