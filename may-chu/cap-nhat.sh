#!/bin/bash
# Cập nhật Sonicplan đang chạy trên máy riêng: kéo main, áp migration mới, khởi động lại dịch vụ, kiểm tra sống.
# Chạy tay: bash may-chu/cap-nhat.sh   Hoặc tự chạy từ GitHub Actions (xem .github/workflows/trien-khai-mac.yml).
# Biến tùy chọn: SONICPLAN_DIR (thư mục cài, mặc định ~/sonicplan), SONICPLAN_LAUNCHD (tên dịch vụ, mặc định vn.sonicplan.may-chu), PORT.
set -euo pipefail
DIR="${SONICPLAN_DIR:-$HOME/sonicplan}"
NHAN="${SONICPLAN_LAUNCHD:-vn.sonicplan.may-chu}"
CONG="${PORT:-8787}"

cd "$DIR"
echo "Thư mục cài: $DIR"
git fetch --quiet origin main
if ! git merge --ff-only --quiet origin/main; then
  echo "Không kéo được main (thư mục cài có thay đổi riêng hoặc lệch nhánh). Xử lý tay rồi chạy lại." >&2
  exit 1
fi
echo "Đang ở bản: $(git log -1 --format='%h %s')"

# Máy chủ chỉ dùng thư viện có sẵn của Node, không cần npm install.
node may-chu/migrate.js
node scripts/cau-hinh-dashboard.mjs

if launchctl print "gui/$(id -u)/$NHAN" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$(id -u)/$NHAN"
  echo "Đã khởi động lại dịch vụ $NHAN"
else
  echo "Chưa có dịch vụ launchd tên $NHAN. Khởi động lại máy chủ bằng tay (npm run may-chu) rồi kiểm tra." >&2
  exit 2
fi

for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$CONG/api/suc-khoe" >/dev/null 2>&1; then
    echo "Máy chủ đã chạy lại, /api/suc-khoe trả lời."
    exit 0
  fi
  sleep 1
done
echo "Máy chủ không trả lời /api/suc-khoe sau 20 giây. Xem log của dịch vụ." >&2
exit 3
