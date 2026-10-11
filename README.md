# Sonicplan

Nền tảng tự động hóa công việc hằng ngày: gom tin Zalo và thư, AI tách việc, đặt lịch, nhắc, dọn cuối ngày, sao lưu, báo sự cố. Mô hình lấy từ 5 luồng tự động hóa anh Nam Hải đang dùng, mã viết mới hoàn toàn. Chạy toàn bộ trên Cloudflare, làm sẵn cho nhiều khách (mỗi khách là một tổ chức).

Tiến độ và quyết định: `LO_TRINH.md`. Kế hoạch đầy đủ nằm trong thư mục chung của dự án trên Claude (`_EXPORTS/2026-10-11_NenTangTuDong_KeHoachXayDung.md`).

## Cấu trúc

| Tệp | Làm gì |
|---|---|
| `wrangler.jsonc` | Cấu hình Worker: trang tĩnh, D1, hẹn giờ, biến Access |
| `src/index.js` | Nhận yêu cầu, API, chạy tác vụ hẹn giờ |
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
npm test                                         # 9 kiểm thử phải đạt
npx wrangler deploy --dry-run --outdir .dung-thu # đóng gói được
```

## Đưa lên Cloudflare (làm một lần, trong trang quản trị Cloudflare)

Cơ sở dữ liệu D1 `tro-ly-rieng` đã được tạo và dựng bảng ngày 11/10/2026 (tên đặt trước khi có tên công ty, giữ nguyên vì D1 không đổi tên được).

1. **Nối kho GitHub.** Workers & Pages, Create, Import a repository, chọn `HaiTLU/sonicplan`. Tên Worker `sonicplan`. Root directory: để trống. Build command: để trống. Deploy command: `npx wrangler deploy`. Tắt preview builds.
2. **Bật Access cho trang.** Zero Trust, Access, Applications, Add, Self-hosted. Tên miền: địa chỉ `sonicplan.<tài khoản>.workers.dev` (hoặc tên miền riêng sau này). Chính sách: dùng lại chính sách đang dùng cho admin SonicRec (chỉ email của anh). Thêm một ứng dụng thứ hai cùng tên miền với đường dẫn `api/suc-khoe`, chính sách Bypass, để kiểm sức khỏe không cần đăng nhập.
3. **Gửi Claude hai giá trị** để ghi vào `wrangler.jsonc` (không phải bí mật): Team domain (Zero Trust, Settings, Custom Pages, dạng `ten-nhom.cloudflareaccess.com`) và Application Audience (AUD) tag của ứng dụng ở bước 2. Khi chưa có hai giá trị này, Worker từ chối mọi yêu cầu (an toàn mặc định).
4. **Khóa mã hóa** (cần từ giai đoạn 1): `openssl rand -base64 32 | npx wrangler secret put KHOA_MA_HOA`. Không dán khóa vào chat.

Hẹn giờ chạy theo giờ UTC: `0 16 * * *` là 23:00 giờ Việt Nam.
