# Sonicplan

Nền tảng tự động hóa công việc hằng ngày: gom tin Zalo và thư, AI tách việc, đặt lịch, nhắc, dọn cuối ngày, sao lưu, báo sự cố. Mô hình lấy từ 5 luồng tự động hóa anh Nam Hải đang dùng, mã viết mới hoàn toàn. Chạy toàn bộ trên Cloudflare, làm sẵn cho nhiều khách (mỗi khách là một tổ chức).

Tiến độ và quyết định: `LO_TRINH.md`. Kế hoạch đầy đủ nằm trong thư mục chung của dự án trên Claude (`_EXPORTS/2026-10-11_NenTangTuDong_KeHoachXayDung.md`).

## Học từ lựa chọn hằng ngày

- Khi tách tin, AI đọc tối đa 10 ví dụ phù hợp trong 30 ngày: sửa/hủy việc và câu trả lời đã xác nhận, kể cả chọn không thêm việc. Tìm trong tối đa 300 sự kiện sửa và 300 câu trả lời, ưu tiên nội dung giống trong cùng bối cảnh; không suy đoán đồng ý từ im lặng.
- Tác vụ `hoc-hang-ngay` chạy 23h giờ Việt Nam, bật/tắt tại trang Luồng. Không gọi AI nếu dữ liệu chưa thay đổi, chưa đủ 3 phản hồi hoặc còn đề xuất chờ duyệt. Có khóa chống chạy trùng và cho phép thử lại sau lỗi.
- Đề xuất tối đa 5 lời dặn, chỉ vào hồ sơ sau khi chủ tổ chức duyệt. Giữ 200 quyết định duyệt/bỏ gần nhất để lọc đề xuất trùng; AI được xem 50 quyết định gần nhất để tránh diễn đạt lại cùng ý. Có thể sửa hoặc xóa lời dặn đã duyệt trong hồ sơ.
- Mục Ghi nhớ hiển thị lần tổng hợp thành công và số việc bị sửa/hủy trong hai kỳ 7 ngày. Đây là chỉ số hành vi, không phải phép đo độ chính xác hay bằng chứng bài học giúp AI tiến bộ.
- Dữ liệu dùng các bảng hiện có; không cần migration mới. Câu hỏi/câu trả lời được đưa vào xuất dữ liệu và sao lưu. Cần triển khai mã và nạp lại máy chủ để lịch mới có hiệu lực.

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
| `src/telegram.js` | Bot Telegram: báo tin, lệnh /tomtat, nút trả lời nhanh |
| `src/hoi-y-kien.js` | Ô hỏi ý kiến khi AI chưa chắc hoặc phân vân có thêm việc không: tạo, áp câu trả lời, ghi nhớ |
| `src/soan-prompt.js`, `public/claude.js` | Soạn prompt cho Claude (bấm "Soạn prompt", một lần gọi AI), lưu ở bảng `prompt_claude`, nút "Copy prompt" trong ngăn sửa việc. Không chạy Claude trực tiếp |
| `src/tram-claude.js`, `public/tram.js`, `public/tram-claude.mjs` | Trang Claude: phòng chat (Durable Object) giữa trình duyệt và trạm Claude trên máy Mac; trạm gọi Claude Code, đưa chữ về từng đoạn |
| `public/tram-claude.mjs` (mục Bộ nhớ dự án) | Bộ nhớ `memory.md` của từng dự án: nạp vào lời dặn, ghi nhanh sau mỗi lượt, gộp hằng đêm, tự cập nhật trạm |
| `src/phien.js` | Xác định người dùng và tổ chức đang làm việc |
| `src/xac-thuc.js` | Kiểm vé đăng nhập Cloudflare Access |
| `src/ma-hoa.js` | Mã hóa khóa của khách trước khi lưu (dùng từ giai đoạn 1) |
| `src/goi-ngoai.js` | Gọi dịch vụ ngoài, thử lại 3 lần khi lỗi tạm thời |
| `src/lich-chay.js` | Danh sách tác vụ hẹn giờ |
| `src/tinh-trang.js` | Tính đèn xanh, vàng, đỏ, xám cho trang Tình trạng |
| `migrations/` | Bảng dữ liệu D1, chạy theo thứ tự số |
| `public/` | Giao diện |
| `test/` | Kiểm thử, chạy bằng `npm test` |
| `src/hoalac/` (`wbs.js`, `api-wbs.js`, `raid.js`, `api-raid.js`, `phap-ly.js`, `api-phap-ly.js`, `ngan-sach.js`, `api-ngan-sach.js`, `quyen.js`), `public/hoalac/` | Phân hệ quản lý dự án Viện Hòa Lạc (`/hoalac`): tiến độ WBS/Gantt/CPM/baseline/stage gate, RAID, pháp lý - hợp đồng - các bên, ngân sách & EVM. Tổ chức phạm vi `pham_vi_truy_cap = 'hoalac'`, đăng nhập bằng ứng dụng Cloudflare Access riêng (`ACCESS_UNG_DUNG`), cách ly hoàn toàn khỏi phần còn lại của Sonicplan; mốc dự án (`qlda_hang_muc` có `la_moc = 1`) được gộp vào cùng lịch `.ics` của tổ chức qua `src/lich-ics.js` |

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
