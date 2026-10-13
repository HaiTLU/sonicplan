# Sonicplan

Nền tảng tự động hóa công việc hằng ngày: gom tin Zalo và thư, AI tách việc, đặt lịch, nhắc, dọn cuối ngày, sao lưu, báo sự cố. Mô hình lấy từ 5 luồng tự động hóa anh Nam Hải đang dùng, mã viết mới hoàn toàn. Chạy toàn bộ trên Cloudflare, làm sẵn cho nhiều khách (mỗi khách là một tổ chức).

Tiến độ và quyết định: `LO_TRINH.md`. Kế hoạch đầy đủ nằm trong thư mục chung của dự án trên Claude (`_EXPORTS/2026-10-11_NenTangTuDong_KeHoachXayDung.md`).

## Cấu trúc

| Tệp | Làm gì |
|---|---|
| `wrangler.jsonc` | Cấu hình Worker: trang tĩnh, D1, R2, Workers AI, hẹn giờ, biến |
| `src/index.js` | Nhận yêu cầu, thư (Email Routing), chạy tác vụ hẹn giờ |
| `src/api.js` | API cho giao diện: tổng quan, hộp tin, việc, tệp, kết nối |
| `src/nhan-zalo.js`, `src/nhan-thu.js`, `src/doc-thu.js` | Nhận tin Zalo từ máy Mac, thư chuyển tiếp, bộ đọc thư MIME tự viết |
| `src/hop-tin.js` | Lưu tin, lưu tệp vào R2, cài đặt từng tổ chức |
| `src/ai.js`, `src/viec.js` | AI tách việc từ tin, chống trùng việc |
| `src/tac-vu.js` | Báo việc mới, canh Zalo, canh việc mất, dọn cuối ngày, sao lưu |
| `src/lich-ics.js` | Đường dẫn lịch .ics cho Google, Apple, Outlook |
| `src/telegram.js` | Bot Telegram: báo tin, lệnh /tomtat |
| `src/claude-code.js`, `public/claude.js` | Giao việc cho Claude Code chạy trên GitHub Actions, nhận kết quả về `/nhan/claude`, hiện trong ngăn sửa việc |
| `src/phien.js` | Xác định người dùng và tổ chức đang làm việc |
| `src/xac-thuc.js` | Kiểm vé đăng nhập Cloudflare Access |
| `src/ma-hoa.js` | Mã hóa khóa của khách trước khi lưu (dùng từ giai đoạn 1) |
| `src/goi-ngoai.js` | Gọi dịch vụ ngoài, thử lại 3 lần khi lỗi tạm thời |
| `src/lich-chay.js` | Danh sách tác vụ hẹn giờ |
| `src/tinh-trang.js` | Tính đèn xanh, vàng, đỏ, xám cho trang Tình trạng |
| `migrations/` | Bảng dữ liệu D1, chạy theo thứ tự số |
| `public/` | Giao diện |
| `test/` | Kiểm thử, chạy bằng `npm test` |

Nguyên tắc nhiều khách: mọi bảng dữ liệu có cột `to_chuc_id`, mọi câu truy vấn của người dùng phải lọc theo cột này. Dòng có `to_chuc_id` rỗng là của cả hệ thống (ví dụ hẹn giờ tự kiểm).

## Chạy thử trên máy

```bash
npm ci
echo 'EMAIL_THU=hainnam@gmail.com' > .dev.vars   # chỉ có tác dụng ở localhost
npx wrangler d1 migrations apply tro-ly-rieng --local
npx wrangler dev --test-scheduled
# mở http://localhost:8787 ; chạy thử hẹn giờ: curl "localhost:8787/__scheduled?cron=0+*+*+*+*"
```

## Kiểm trước khi gộp

```bash
npm test                                         # mọi kiểm thử phải đạt (GitHub Actions cũng chạy cho mỗi PR)
npx wrangler deploy --dry-run --outdir .dung-thu # đóng gói được
```

## Đưa lên Cloudflare (làm một lần, trong trang quản trị Cloudflare)

Cơ sở dữ liệu D1 `tro-ly-rieng` đã được tạo và dựng bảng ngày 11/10/2026 (tên đặt trước khi có tên công ty, giữ nguyên vì D1 không đổi tên được).

1. **Nối kho GitHub.** Workers & Pages, Create, Import a repository, chọn `HaiTLU/sonicplan`. Tên Worker `sonicplan`. Root directory: để trống. Build command: để trống. Deploy command: `npx wrangler deploy`. Tắt preview builds.
2. **Bật R2** (kho tệp và bản sao lưu): R2 Object Storage, bấm bật (gói miễn phí 10 GB). Sau đó Claude tạo thùng `sonicplan-tep`.
3. **Bật Access cho trang.** Zero Trust, Access, Applications, Add, Self-hosted. Tên miền: `plan.sonicrec.app` (Worker tự gắn tên miền này khi triển khai, xem `routes` trong `wrangler.jsonc`). Chính sách: chỉ email của anh. Thêm các ứng dụng cùng tên miền với chính sách **Bypass** cho các đường dẫn máy móc tự gọi (tự kiểm bằng mã riêng): `nhan/*`, `lich/*`, `api/suc-khoe`. Gửi Claude Team domain (dạng `ten-nhom.cloudflareaccess.com`) và Application Audience (AUD) tag để ghi vào `wrangler.jsonc`. Chưa có hai giá trị này thì Worker từ chối mọi yêu cầu.
4. **Nhận thư.** Cần một tên miền đặt ở Cloudflare. Email, Email Routing, bật cho tên miền, Routing rules, Catch-all: Send to a Worker, chọn `sonicplan`. Gửi Claude tên miền để ghi vào `EMAIL_DOMAIN`. Sau đó trong Gmail đặt chuyển tiếp tới địa chỉ hiện ở trang Kết nối.
5. **Khóa mã hóa:** `openssl rand -base64 32 | npx wrangler secret put KHOA_MA_HOA` (đã đặt ngày 11/10/2026). Không dán khóa vào chat.
6. **Bot Telegram.** Nhắn @BotFather, `/newbot`, đặt tên. Người quản trị (email trong `QUAN_TRI`) dán mã bot vào ô ở trang Kết nối, bấm Lưu bot; hệ thống tự đăng ký địa chỉ nhận tin. Sau đó mỗi người bấm Nối Telegram rồi Start.
7. **Máy Mac nghe Zalo.** Ở trang Kết nối bấm Tạo lệnh, dán lệnh vào Terminal trên máy Mac. Lệnh tự ghi địa chỉ và mã vào `~/.zalo-listener/.env` (giữ bản cũ) rồi khởi động lại chương trình.

Hẹn giờ chạy theo giờ UTC: `0 16 * * *` là 23:00 giờ Việt Nam.
