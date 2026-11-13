# Kho hồ sơ của khu Dự án

Ngày 13/11/2026. Đợt 2 của kế hoạch khu Dự án: kho hồ sơ có phiên bản, nhãn duyệt, hạn hiệu lực (học Procore, Autodesk Build).

## Mục đích

Hồ sơ pháp lý, hợp đồng, biên bản của từng dự án nằm rải rác trong thư, Zalo, Drive nên hay thất lạc. Kho hồ sơ gom chúng vào đúng dự án, biết bản nào mới nhất, bản nào đã duyệt, giấy tờ nào sắp hết hạn.

## PM quyết (13/11/2026)

- Cách xếp: 6 thư mục chuẩn (Pháp lý, Hợp đồng, Văn bản, Biên bản họp, Bàn giao, Khác). Mỗi hồ sơ gắn được với một thủ tục, một hợp đồng hoặc một sản phẩm bàn giao.
- Duyệt: nhãn trạng thái trên từng phiên bản (Dự thảo, Chờ duyệt, Đã duyệt, Hết hiệu lực), ghi người đổi và lúc đổi. Không có luồng duyệt nhiều bước.
- Quyền: chủ và thành viên tải lên, sửa. Ban Giám hiệu (vai trò xem) chỉ xem và tải về. Đối tác không thấy kho.
- Mỗi tệp tối đa 50 MB.

## Các cách đã cân nhắc

| Cách | Được | Mất | Chọn |
|---|---|---|---|
| Thư mục chuẩn + gắn mục | Dễ tìm theo loại, vẫn nối được với thủ tục, hợp đồng | Mỗi hồ sơ chỉ gắn một mục | Có |
| Chỉ gắn vào mục, không thư mục | Gọn | Hồ sơ không thuộc mục nào (biên bản họp) không có chỗ | Không |
| Thư mục tự đặt nhiều tầng | Linh hoạt | Mỗi người xếp một kiểu, lại thất lạc | Không |

## Thiết kế

- Migration `0054_ho_so.sql`: bảng `qlda_ho_so` (thông tin hồ sơ, thư mục, mục được gắn, hạn hiệu lực) và `qlda_ho_so_phien_ban` (số phiên bản, tệp, nhãn, người đổi nhãn). Tệp nằm ở bảng `tep` như các tệp khác, khóa kho tệp `<dự án>/ho-so/<tháng>/<uuid>-<tên>` để việc xóa dự án dọn được.
- API `src/hoalac/ho-so.js`, mọi đường đều chặn đối tác; vai trò xem bị chặn ghi chung ở `api.js`.
  - `GET /api/hoalac/ho-so`: danh sách kèm phiên bản mới nhất và tình trạng hạn (`het_han`, `sap_het_han` trong 30 ngày). Phiên bản mới nhất mang nhãn Hết hiệu lực thì thôi báo.
  - `POST /api/hoalac/ho-so` (multipart): tạo hồ sơ v1. `POST /api/hoalac/ho-so/:id/phien-ban`: thêm bản mới, số phiên bản tính ngay trong câu INSERT.
  - `PUT /api/hoalac/ho-so/:id`: sửa thông tin. `PUT /api/hoalac/ho-so/phien-ban/:id`: đổi nhãn.
  - `GET /api/hoalac/ho-so/phien-ban/:id/tai`: tải về dạng attachment; `?xem=1` mở trong trang chỉ với ảnh và PDF.
  - Không có xóa. Hồ sơ bỏ đi thì đặt nhãn Hết hiệu lực.
- Ghi kho tệp trước, ghi CSDL bằng một batch; batch lỗi thì xóa tệp vừa ghi.
- Tin nhắc hằng ngày có thêm khối "Hồ sơ hết hạn hoặc sắp hết hạn".
- Máy chủ VPS nhận thân yêu cầu tới 55 MB (trước là 30 MB).
- Giao diện: tab "Hồ sơ" ở cả hai loại dự án. Biểu mẫu tải lên, lọc theo thư mục có số lượng, thẻ hồ sơ có nhãn phiên bản, nhãn hạn, nút Tải về, Xem, Lịch sử, Tải bản mới. Ở chế độ chỉ đọc chỉ còn Tải về, Xem, Lịch sử.
- Tải về đi qua `fetch` để gửi kèm mã dự án đang mở (thẻ liên kết thường không gửi được).

## Để người làm tự quyết

- Màu nhãn, chữ trên nút.
- Chưa làm: tìm theo nội dung tệp, xem trước docx trong kho hồ sơ, đổi nhãn phiên bản cũ trên giao diện (API đã cho).
