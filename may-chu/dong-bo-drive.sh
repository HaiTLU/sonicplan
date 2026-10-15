#!/bin/bash
# Chép kết quả Claude từ hộp thư (do thợ Claude xếp vào) sang Google Drive.
# Phải chạy bằng launchd với /bin/bash: bash có quyền vào thư mục Drive, tiến trình node thì treo khi đọc Drive.
# Mỗi hộp thư luot-N có dich.txt (đường dẫn trong "Drive của tôi") và noi-dung/ (tệp cần chép). Chép xong chuyển sang drive-xong/.
set -u
export PATH=/opt/homebrew/bin:/usr/bin:/bin
NHA="${THO_DIR:-$HOME/.sonicplan-tho}"
CHO="${DRIVE_CHO:-$NHA/drive-cho}"
XONG="$NHA/drive-xong"
DRIVE="${DRIVE_GOC:-$HOME/Library/CloudStorage/GoogleDrive-hai@thanglong.edu.vn/Drive của tôi}"
LOG="$NHA/dong-bo-drive.log"
ghi() { echo "$(TZ=Asia/Ho_Chi_Minh date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

[ -d "$CHO" ] || exit 0
ls "$CHO" 2>/dev/null | grep -q '^luot-' || exit 0
[ -d "$DRIVE" ] || { ghi "CANH BAO: khong thay thu muc Drive, de lai hop thu"; exit 0; }
mkdir -p "$XONG"

for hop in "$CHO"/luot-*; do
  [ -f "$hop/dich.txt" ] || continue
  dich=$(cat "$hop/dich.txt")
  case "$dich" in
    ''|/*|*..*) ghi "BO $hop: duong dan dich khong hop le"; mv "$hop" "$XONG/loi-$(basename "$hop")"; continue ;;
  esac
  if mkdir -p "$DRIVE/$dich" && cp -R "$hop/noi-dung/." "$DRIVE/$dich/"; then
    mv "$hop" "$XONG/$(basename "$hop")" && ghi "OK $(basename "$hop") -> $dich"
  else
    ghi "LOI chep $(basename "$hop") -> $dich, thu lai lan sau"
  fi
done
# Giữ hộp đã chép 14 ngày.
find "$XONG" -maxdepth 1 -name 'luot-*' -mtime +14 -exec rm -rf {} + 2>/dev/null
exit 0
