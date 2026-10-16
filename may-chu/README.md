# Chạy Sonicplan trên máy riêng (Mac mini) thay Cloudflare

Máy chủ Node chạy nguyên mã Worker trong `src/`, thay D1 bằng SQLite, R2 bằng thư mục, `env.ASSETS` bằng `public/`, hẹn giờ bằng bộ đếm trong tiến trình. Không sửa mã trong `src/`.

## Cần
- Node 22.5 trở lên (`node -v`). Máy có hai bản Node thì đặt bản mới lên đầu `PATH`.
- Dữ liệu D1: `npx wrangler d1 export tro-ly-rieng --remote --output du-lieu.sql`, rồi nạp vào SQLite: `sqlite3 du-lieu/sonicplan.sqlite < du-lieu.sql`. Không dùng biến `MIGRATIONS` trên cơ sở dữ liệu đã có (nó chạy lại mọi migration).
- Tệp R2: chép vào `du-lieu/tep/v/<khóa>`; kiểu nội dung ở `du-lieu/tep/m/<khóa>.json` dạng `{"contentType":"image/jpeg"}` (thiếu thì ảnh mở bằng kiểu mặc định).

## Chạy
`npm run may-chu` (cổng 8787, chỉ nghe `127.0.0.1`). Cấu hình qua biến môi trường hoặc `may-chu/.env` (không đưa lên GitHub):

| Biến | Ý nghĩa |
|---|---|
| `PORT`, `HOST` | Cổng (mặc định 8787) và địa chỉ nghe (mặc định `127.0.0.1`) |
| `PUBLIC_ORIGIN` | Địa chỉ công khai, ví dụ `https://plan.sonicrec.app`. Mã dùng nó dựng liên kết OAuth, lệnh cài Zalo, webhook Telegram |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | Lấy mặc định từ `wrangler.jsonc`; Cloudflare Access phải còn đứng trước tên miền |
| `KHOA_MA_HOA` | Khóa mã hóa token kết nối; không có thì Google, Zalo, Telegram không giải mã được |
| `CF_ACCOUNT_ID`, `CF_AI_TOKEN` | Muốn có AI: gọi Workers AI qua REST. Thiếu thì chạy không AI |
| `AI_CLAUDE_CODE=0` | Tắt AI qua Claude Code gói Max. Mặc định bật khi có lệnh `claude` (`CLAUDE_BIN`): mọi tác vụ AI gọi `claude -p` trước, lỗi thì quay về Workers AI. Tổ chức đã dán khóa AI riêng ở trang Kết nối thì khóa đó vẫn đứng trước. Đổi mô hình, mức suy nghĩ bằng `AI_CLAUDE_CODE_MODEL` (mặc định `claude-sonnet-5-5`), `AI_CLAUDE_CODE_EFFORT` (mặc định `low`). Dùng chung hạn mức gói Max với thợ Claude và các phiên Claude Code của PM |
| `DU_LIEU`, `DB_FILE`, `TEP_DIR` | Thư mục dữ liệu (mặc định `du-lieu/`) |
| `HEN_GIO=0` | Tắt hẹn giờ |
| `KHOA_MA_HOA_CU` | Chỉ khi đang xoay khóa: khóa cũ, để đọc được dữ liệu chưa mã hóa lại. Cách xoay: dừng máy chủ, sao lưu, chạy `KHOA_MA_HOA_CU=<cũ> KHOA_MA_HOA=<mới> DB_FILE=<đường dẫn> node may-chu/xoay-khoa.js`, đặt khóa mới vào `.env`, gỡ biến này |
| `EMAIL_THU` | Chỉ để thử trên máy: bỏ qua đăng nhập, chỉ nhận yêu cầu từ chính máy |

## Dịch vụ launchd (chạy nền lâu dài)
Tạo `~/Library/LaunchAgents/vn.sonicplan.may-chu.plist` (đổi đường dẫn `node` bằng kết quả `which node`, và thư mục cài cho đúng):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>vn.sonicplan.may-chu</string>
  <key>ProgramArguments</key><array><string>/usr/local/bin/node</string><string>may-chu/chay.js</string></array>
  <key>WorkingDirectory</key><string>/Users/TENBAN/sonicplan</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/TENBAN/sonicplan/du-lieu/may-chu.log</string>
  <key>StandardErrorPath</key><string>/Users/TENBAN/sonicplan/du-lieu/may-chu.log</string>
</dict></plist>
```
Nạp một lần: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/vn.sonicplan.may-chu.plist`. Khởi động lại: `launchctl kickstart -k gui/$(id -u)/vn.sonicplan.may-chu`.

## Cập nhật bản mới trên máy
1. Một lần: trên cơ sở dữ liệu nạp từ D1, đánh dấu các migration đã có: `node may-chu/migrate.js --co-san`. Từ đó mỗi lần cập nhật chỉ áp migration mới.
2. Cập nhật tay bất kỳ lúc nào: `bash may-chu/cap-nhat.sh` (kéo main, áp migration, khởi động lại dịch vụ, kiểm tra `/api/suc-khoe`).
3. Tự động mỗi lần gộp vào main (anh đã chọn bật): đăng ký runner tự host cho kho `HaiTLU/sonicplan` với nhãn `sonicplan-may`: GitHub, kho sonicplan, Settings, Actions, Runners, New self-hosted runner, làm theo các lệnh, thêm `--labels sonicplan-may` ở bước `./config.sh`, rồi `./svc.sh install && ./svc.sh start`. Workflow `.github/workflows/trien-khai-mac.yml` chạy `cap-nhat.sh` trên runner đó. Thư mục cài khác `~/sonicplan` hay tên dịch vụ khác thì đặt biến kho `SONICPLAN_DIR`, `SONICPLAN_LAUNCHD`. Chưa có runner thì job chỉ chờ, không hỏng gì.
4. `scripts/trien-khai.py` (đưa lên Cloudflare) không còn dùng khi trang chạy trên Mac.

## Rào an toàn
- `EMAIL_THU` đặt cùng `PUBLIC_ORIGIN` thì máy chủ từ chối khởi động.
- Có `EMAIL_THU` thì chỉ nhận kết nối từ `127.0.0.1` hoặc `::1`.
- Máy chủ chỉ nghe `127.0.0.1`; đưa ra Internet bằng Cloudflare Tunnel, và để Access đứng trước.

## Chưa làm
- Nhận thư: `email()` của Worker cần Cloudflare Email Routing. Cần một Email Worker nhỏ đẩy thư thô về máy chủ này, chưa viết.
- Cloudflare Tunnel đưa máy chủ ra Internet: tự cài theo hướng dẫn của Cloudflare.
- Ollama thay Workers AI: chưa hỗ trợ.


## Thợ Claude (Claude Code tự làm việc ở máy)

Việc AI xếp nhóm "Claude làm được" (và lượt "Giao Claude" bấm tay khi thợ bật) chạy ngay trên máy này, trong bản sao ThangLong_KB, không qua GitHub Actions.

- **Bật tắt, hạn mức:** thẻ "Claude làm việc ở máy" ở trang Kết nối. Mặc định bật, 2 việc cùng lúc, 10 việc tự chạy mỗi ngày, Sonnet 5.5 mức medium. Hai lượt tự chạy lỗi trong 2 giờ thì ngừng tự xếp việc mới.
- **Mỗi lượt:** tạo git worktree riêng từ `origin/main` của ThangLong_KB, ghi `NGU-CANH.md`, `LICH-SU.md` và `dinh-kem/` vào thư mục làm việc của dự án, chạy `claude -p` trong worktree, commit chỉ thư mục làm việc và `memory/` lên nhánh `sonicplan/luot-N`, mở PR (tự gộp khi kiểm tra tự động xong không lỗi), rồi báo PM bằng thông báo đẩy và Telegram. Việc sang "chờ duyệt": bấm Đạt hoặc Làm lại ở thẻ việc.
- **Drive:** tiến trình node không với tới Google Drive (treo khi đọc thư mục Drive dưới launchd), nên thợ xếp kết quả vào `~/.sonicplan-tho/drive-cho/` và tác vụ bash `may-chu/dong-bo-drive.sh` chép sang Drive mỗi phút. Cài một lần: `bash may-chu/cai-dong-bo-drive.sh`.
- **Biến môi trường (tùy chọn):** `THO_CLAUDE=0` tắt hẳn; `THO_DIR` (mặc định `~/.sonicplan-tho`), `KB_DIR` (bản sao KB, mặc định `$THO_DIR/ThangLong_KB`), `KB_REPO` (mặc định `HaiTLU/ThangLong_KB`), `CLAUDE_BIN` (mặc định `~/.local/bin/claude`), `DRIVE_CHO`, `DRIVE_GOC` (script chép Drive).
- **Cần có sẵn:** Claude Code đã đăng nhập, `gh auth login` (quyền repo), git. Cả ba đã kiểm chạy được dưới launchd.
