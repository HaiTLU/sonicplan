#!/bin/bash
# Cài tác vụ launchd chạy may-chu/dong-bo-drive.sh mỗi phút (chép kết quả Claude từ hộp thư sang Google Drive).
# Cách dùng: bash may-chu/cai-dong-bo-drive.sh   Gỡ: launchctl bootout gui/$(id -u)/app.sonicrec.sonicplan-drive
set -euo pipefail
GOC="$(cd "$(dirname "$0")/.." && pwd)"
NHAN=app.sonicrec.sonicplan-drive
PLIST="$HOME/Library/LaunchAgents/$NHAN.plist"
mkdir -p "$HOME/.sonicplan-tho"
cat > "$PLIST" <<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$NHAN</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$GOC/may-chu/dong-bo-drive.sh</string></array>
  <key>StartInterval</key><integer>60</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/.sonicplan-tho/dong-bo-drive.log</string>
  <key>StandardErrorPath</key><string>$HOME/.sonicplan-tho/dong-bo-drive.log</string>
</dict></plist>
XML
launchctl bootout "gui/$(id -u)/$NHAN" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Đã cài $NHAN, chạy mỗi phút từ $GOC/may-chu/dong-bo-drive.sh"
