#!/bin/bash
# Vá chương trình đọc Zalo trên Mac để tin trong một cuộc trò chuyện liền mạch, rồi khởi động lại nó.
set -e
CHA="$(cd "$(dirname "$0")" && pwd)"
THU_MUC="$HOME/.zalo-listener"
node "$CHA/va-hoi-thoai.mjs" "$THU_MUC"
for f in "$THU_MUC"/*.mjs; do node --check "$f" || { echo "Mã sau khi vá bị lỗi, khôi phục bản cũ."; cp "$f.truoc-hoi-thoai" "$f"; exit 1; }; done
NHAN=$(launchctl list | awk '/zalo/ {print $3; exit}')
if [ -n "$NHAN" ]; then
  launchctl kickstart -k "gui/$(id -u)/$NHAN"
  echo "Xong. Chương trình Zalo đã chạy lại. Tin mới từ giờ sẽ nằm chung một mục theo từng cuộc trò chuyện."
else
  echo "Đã vá nhưng không thấy chương trình đang chạy. Khởi động lại máy Mac để nó chạy lại."
fi
