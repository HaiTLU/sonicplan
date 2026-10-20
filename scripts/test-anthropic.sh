#!/usr/bin/env bash
# Kiểm tra API Anthropic có hoạt động không
# Cách dùng: ANTHROPIC_API_KEY=sk-ant-... bash scripts/test-anthropic.sh

KEY="${ANTHROPIC_API_KEY:-}"

if [[ -z "$KEY" ]]; then
  echo "❌ Chưa có API key. Chạy lệnh:"
  echo "   ANTHROPIC_API_KEY=sk-ant-... bash scripts/test-anthropic.sh"
  exit 1
fi

echo "🔍 Đang kiểm tra API Anthropic..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  https://api.anthropic.com/v1/messages \
  -H "x-api-key: $KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-5-5",
    "max_tokens": 16,
    "messages": [{"role": "user", "content": "Trả lời đúng một chữ: ok"}]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📡 HTTP status: $HTTP_CODE"

if [[ "$HTTP_CODE" == "200" ]]; then
  REPLY=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('content',[])[0].get('text',''))" 2>/dev/null)
  echo "✅ API hoạt động! Phản hồi: '$REPLY'"
else
  echo "❌ API lỗi!"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
fi
