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
| `AI_CLAUDE_CODE=0` | Tắt AI qua Claude Code gói Max. Mặc định bật khi có lệnh `claude` (`CLAUDE_BIN`): mọi tác vụ AI gọi `claude -p` trước, lỗi thì quay về Workers AI. Tổ chức đã dán khóa AI riêng ở trang Kết nối thì khóa đó vẫn đứng trước. Đổi mô hình, mức suy nghĩ bằng `AI_CLAUDE_CODE_MODEL` (mặc định `claude-haiku-5-5`), `AI_CLAUDE_CODE_EFFORT` (mặc định `medium`). Dùng chung hạn mức gói Max với thợ Claude và các phiên Claude Code của PM |
| `FPT_AI_API_KEY` | Cách khác để đặt khóa (cách chính là nhập ở trang Kết nối > Nhà cung cấp AI, lưu mã hóa ở `du-lieu/khoa-fpt.enc` bằng `KHOA_MA_HOA`, đứng trước biến này). Khóa serverless inference của FPT AI Marketplace (tạo ở trang API keys trên neo.fpt.ai). Có khóa thì ô Nhà cung cấp AI ở trang Kết nối chọn được FPT AI; khóa chỉ đặt ở đây, không dán vào chat, mã, nhật ký hay GitHub. Thiếu khóa hoặc FPT lỗi thì tự dùng Claude và ghi rõ trong nhật ký máy chủ. Kèm `FPT_AI_BASE_URL` (mặc định `https://mkp-api.fptcloud.com/v1`; nếu trang API keys ghi địa chỉ gateway khác thì dùng địa chỉ đó, có `/v1`), `FPT_AI_MODEL` (việc thường, mặc định `gemma-3-27b-it`), `FPT_AI_MODEL_MANH` (việc khó, mặc định `gpt-oss-120b`; tên phải trùng danh mục model của tài khoản), `AI_NHA_CUNG_CAP=fpt` (mặc định ban đầu khi chưa chọn ở trang Kết nối; mặc định `claude`). Lựa chọn đặt ở trang Kết nối được lưu ở `du-lieu/nha-cung-cap-ai.json` |
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


## Thợ Claude (chỉ soạn prompt) và việc nền ở máy

Từ 19/10/2026 thợ Claude KHÔNG làm việc trực tiếp trong Sonicplan và không tự chạy lượt nào. Ở mỗi việc (hoặc cả cột dự án), bấm "Soạn prompt": Sonicplan gọi AI một lần để viết phần yêu cầu, ghép với bối cảnh có sẵn (tin gốc, người, dự án, hạn, liên kết tệp), lưu lại và hiện nút "Copy prompt" để dán sang Claude khác. Code ở `src/soan-prompt.js`, bảng `prompt_claude`. Phần dưới đây là các việc nền còn lại trên máy này.

- **Ghi nhớ:** mỗi đêm sau 23h (giờ Việt Nam) thợ xuất trang Ghi nhớ vào `memory/projects/Sonicplan_GhiNho.md` của kho second-brain (bản sao ở `$THO_DIR/second-brain`), commit chỉ thư mục `memory/` và đẩy thẳng `main`, không PR; cùng lúc nhận lại điều PM hoặc Claude sửa trong tệp đó. Máy cần quyền ghi vào `HaiTLU/second-brain` (cùng `gh auth` ở dưới).
- **Drive:** tiến trình node không với tới Google Drive (treo khi đọc thư mục Drive dưới launchd), nên thợ xếp kết quả vào `~/.sonicplan-tho/drive-cho/` và tác vụ bash `may-chu/dong-bo-drive.sh` chép sang Drive mỗi phút. Cài một lần: `bash may-chu/cai-dong-bo-drive.sh`.
- **Biến môi trường (tùy chọn):** `THO_CLAUDE=0` tắt hẳn; `THO_DIR` (mặc định `~/.sonicplan-tho`), `KB_DIR` (bản sao KB, mặc định `$THO_DIR/ThangLong_KB`), `KB_REPO` (mặc định `HaiTLU/ThangLong_KB`), `SB_DIR` (bản sao second-brain, mặc định `$THO_DIR/second-brain`), `SB_REPO` (mặc định `HaiTLU/second-brain`), `CLAUDE_BIN` (mặc định `~/.local/bin/claude`), `DRIVE_CHO`, `DRIVE_GOC` (script chép Drive).
- **Cần có sẵn:** Claude Code đã đăng nhập, `gh auth login` (quyền repo), git. Cả ba đã kiểm chạy được dưới launchd.
