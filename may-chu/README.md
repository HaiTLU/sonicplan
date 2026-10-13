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
| `DU_LIEU`, `DB_FILE`, `TEP_DIR` | Thư mục dữ liệu (mặc định `du-lieu/`) |
| `HEN_GIO=0` | Tắt hẹn giờ |
| `EMAIL_THU` | Chỉ để thử trên máy: bỏ qua đăng nhập, chỉ nhận yêu cầu từ chính máy |

## Rào an toàn
- `EMAIL_THU` đặt cùng `PUBLIC_ORIGIN` thì máy chủ từ chối khởi động.
- Có `EMAIL_THU` thì chỉ nhận kết nối từ `127.0.0.1` hoặc `::1`.
- Máy chủ chỉ nghe `127.0.0.1`; đưa ra Internet bằng Cloudflare Tunnel, và để Access đứng trước.

## Chưa làm
- Nhận thư: `email()` của Worker cần Cloudflare Email Routing. Cần một Email Worker nhỏ đẩy thư thô về máy chủ này, chưa viết.
- Chạy nền lâu dài: cần dịch vụ launchd và Cloudflare Tunnel, chưa cài.
- Ollama thay Workers AI: chưa hỗ trợ.
