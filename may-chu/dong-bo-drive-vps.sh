#!/bin/bash
# Chep ket qua Claude tu hop thu sang Google Drive bang rclone (thay cho dong-bo-drive.sh tren Mac).
set -u
export PATH=$HOME/.local/bin:/usr/bin:/bin
NHA="${THO_DIR:-$HOME/.sonicplan-tho}"; CHO="$NHA/drive-cho"; XONG="$NHA/drive-xong"; LOG="$NHA/dong-bo-drive.log"
ghi() { echo "$(TZ=Asia/Ho_Chi_Minh date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
mkdir -p "$XONG"
ls "$CHO" 2>/dev/null | grep -q '^luot-' || exit 0
for hop in "$CHO"/luot-*; do
  [ -f "$hop/dich.txt" ] || continue
  dich=$(cat "$hop/dich.txt")
  case "$dich" in ''|/*|*..*) ghi "BO $hop: duong dan dich khong hop le"; mv "$hop" "$XONG/loi-$(basename "$hop")"; continue ;; esac
  if rclone copy "$hop/noi-dung" "gdrive:$dich" --log-level ERROR 2>>"$LOG"; then
    mv "$hop" "$XONG/$(basename "$hop")" && ghi "OK $(basename "$hop") -> $dich"
  else ghi "LOI chep $(basename "$hop") -> $dich, thu lai lan sau"; fi
done
find "$XONG" -maxdepth 1 -name 'luot-*' -mtime +14 -exec rm -rf {} + 2>/dev/null
exit 0
