# Đặc tả: trang Việc - Theo trạng thái, tab xem đã lưu, nhãn ưu tiên

Ngày: 22/11/2026. Người duyệt: Nguyễn Nam Hải (PM, chủ sản phẩm). Nguồn ý tưởng: README của AppFlowy (bảng Project Tracker), PM chọn 3 ý ngày 22/11/2026. Chỉ học cách làm, không chép mã AppFlowy (giấy phép AGPL).

## Mốc

| Mốc | Ngày | Người |
|---|---|---|
| PM chọn 3 ý | 22/11/2026 | PM |
| Mã, test, ảnh chụp trên bản thử, PR nháp | 22/11/2026 | Claude |
| Sao lưu CSDL trên VPS, gộp PR (gộp là triển khai) | khi PM duyệt PR | PM hoặc Claude theo lệnh PM |

## Vai trò người dùng

- Chủ tổ chức (`thanh_vien.vai_tro = 'chu'`): dùng trang Việc, kéo thẻ, lưu tab.
- Thành viên (`thanh_vien`): như chủ trên trang Việc; tab lưu riêng theo từng người.
- Người duyệt thay đổi phần mềm: PM. Quản trị máy chủ: PM (VPS `tlu-prod-web-02`).

## Yêu cầu chức năng và tiêu chí nghiệm thu

### YC1. Kiểu xem "Theo trạng thái"

Nút "Theo trạng thái" cạnh "Theo hạn" và "Theo dự án". Bốn cột: Chưa làm, Đang làm, Chờ anh duyệt, Xong.

Cách suy cột (`public/trang/cot-trang-thai.js`, hàm `suyTrangThai`):

1. Việc đã xong: cột Xong nếu `xong_luc` trong 7 ngày gần nhất, quá 7 ngày thì không hiện. Việc hủy không hiện.
2. Việc mở có `tien_do` do người dùng kéo thẻ đặt: theo giá trị đó.
3. Chưa đặt `tien_do` mà việc có ô hỏi AI đang chờ trả lời (`cau_hoi_ai.trang_thai` là `moi` hoặc `cho`): Chờ anh duyệt.
4. Còn lại: Chưa làm.

Kéo thẻ: vào Xong thì đánh xong việc (như bấm ô tích, có ghi sự kiện); vào ba cột còn lại thì đặt `tien_do`; kéo việc đã xong ra cột khác thì mở lại việc. Có nút Hoàn tác.

Tiêu chí nghiệm thu:
- [x] Bốn cột hiện đúng số thẻ với dữ liệu mẫu (máy tính và điện thoại, sáng và tối).
- [x] Kéo chuột Chưa làm -> Đang làm -> Chờ anh duyệt -> Xong -> Chưa làm: mỗi bước cột `trang_thai`, `tien_do` trong CSDL đổi đúng.
- [x] Chạm giữ rồi kéo trên điện thoại đổi đúng `tien_do`.
- [x] Việc xong quá 7 ngày không hiện ở cột Xong (test `viec-trang-thai.test.js`).

### YC2. Tab xem đã lưu

Hàng tab phía trên trang Việc. Nút "Lưu tab" lưu tổ hợp hiện tại (kiểu xem, bộ lọc dự án, bộ lọc Nguồn, Hạn, Giờ, Claude, Độ nặng, Có sao, Sắp xếp) thành tab có tên. Bấm tab là áp. Nút ba chấm (hoặc chuột phải) trên tab: Cập nhật theo cách xem hiện tại, Đổi tên, Xóa tab. Tối đa 12 tab mỗi người. Lưu phía máy chủ ở bảng `cai_dat`, khóa `viec_tab:<mã người dùng>`, API `GET` và `PUT /api/viec/tab`, nên máy tính và điện thoại dùng chung.

Tiêu chí nghiệm thu:
- [x] Lưu tab qua giao diện thì có dòng trong `cai_dat` đủ các trường.
- [x] Đổi tên, xóa qua trình đơn ba chấm chạy đúng.
- [x] Bấm tab áp đúng kiểu xem, lọc dự án, sắp xếp.
- [x] Người khác cùng tổ chức không thấy tab của mình; dữ liệu sai trả 400; không có người dùng trả 403 (test).

### YC3. Nhãn ưu tiên cao

Thẻ việc mở có `uu_tien = 'cao'` hiện nhãn "Ưu tiên cao" nền đặc màu `--loi`, chữ màu `--nen`, đứng đầu hàng nhãn, kèm viền trái 4px cùng màu (khi thẻ chưa có màu riêng). Nhãn vẫn hiện khi bật "Ẩn nhãn".

Tiêu chí nghiệm thu:
- [x] Tương phản chữ trên nền từ 4,5:1 trở lên ở cả nền sáng và tối (đo trên trình duyệt: 6,85:1 sáng, 9,23:1 tối).
- [x] Chỉ dùng token màu có sẵn, không thêm mã màu mới.

## Yêu cầu phi chức năng

- Tốc độ: danh sách việc vẫn một lần gọi `/api/viec` (tối đa 300 dòng); kiểu xem Theo trạng thái gọi thêm đúng một lần `/api/viec?trang_thai=xong`. Ô hỏi AI tính bằng một `EXISTS` dùng chỉ mục `cau_hoi_ai_trang_thai`.
- Số người dùng: mỗi tổ chức vài người dùng (hiện 1 người dùng thật); tab tối đa 12 mỗi người, mỗi tên tối đa 40 ký tự.
- Bảo mật: mọi truy vấn lọc `to_chuc_id`; tab lưu theo mã người dùng của phiên; máy chủ chỉ giữ trường đã biết.
- Trợ năng: tương phản nhãn tối thiểu 4,5:1 (WCAG 2.2 AA); nút ba chấm có `aria-label`; tab có `aria-pressed`.
- Không thêm lần gọi AI, không đổi model AI.

## Ngoài phạm vi

- Không chạy lại Claude trực tiếp trong Sonicplan (đã gỡ từ migration 0036); cột "Chờ anh duyệt" không đọc trạng thái lượt Claude.
- Không sửa bộ lọc "Claude" sẵn có (xem mục Việc phát hiện).
- Không đồng bộ `tien_do` sang Google Tasks hay Lịch, không gửi Telegram khi đổi tiến độ.
- Không chép mã hay giao diện AppFlowy.

## Rủi ro

- Migration 0056 áp ngay khi gộp `main` (gộp là triển khai): sao lưu CSDL trên VPS trước khi gộp.
- `tien_do` người dùng tự đặt thắng ô hỏi AI: việc đã kéo về Chưa làm sẽ không tự sang Chờ anh duyệt khi AI hỏi lại sau đó (câu hỏi vẫn đến Telegram).

## Giới hạn đã biết (chấp nhận, từ lượt phản biện mã)

- Hoàn tác sau khi kéo việc đã xong ra cột khác: việc xong lại với giờ xong là lúc hoàn tác, không phải giờ cũ.
- Tab ghi theo kiểu bản lưu sau thắng: lưu tab từ hai thiết bị cùng lúc có thể mất một tab.
- Tab lọc theo dự án đã gỡ thì áp ra danh sách rỗng; bấm "Tất cả dự án" để thoát.
- Mở lại việc đã xong bằng ô tích, trình đơn hay Telegram thì về Chưa làm (máy chủ xóa `tien_do`); kéo thẻ từ Xong ra cột nào thì giữ đúng cột đó.

## Việc phát hiện, chưa sửa

- Bộ lọc "Claude" (chưa giao, đang chạy, hỏi lại, đã xong) trên trang Việc đọc `claude_trang_thai`, nhưng API không trả cột này (CSDL không có). Mọi việc đều rơi vào "Chưa giao"; chọn ba giá trị còn lại thì danh sách rỗng.
