# Đợt thanh toán gắn hợp đồng, có cảnh báo

PM duyệt 13/11/2026 (chạy tự động theo giấy phép 12/11).

## Mục đích

PM khó theo dõi hợp đồng và thanh toán của các dự án (Viện Hòa Lạc, Ipsos). Hợp đồng đã có trong `qlda_hop_dong` nhưng chưa có đợt thanh toán, nên không biết đợt nào sắp đến hạn, đợt nào đủ điều kiện mà chưa ai làm hồ sơ.

## Mục tiêu

- Mỗi hợp đồng có danh sách đợt thanh toán: tên, thứ tự, số tiền (để trống được), hạn, điều kiện.
- Điều kiện gắn với một hạng mục WBS hoặc một sản phẩm bàn giao, kèm ô ghi chú. Phần mềm tự tính "đủ điều kiện".
- Bấm "Đã trả" thì tạo dòng giải ngân trong cùng lần ghi; bỏ đánh dấu thì gỡ dòng đó.
- Cảnh báo trên trang: sắp đến hạn trong 7 ngày, quá hạn chưa trả, đủ điều kiện chưa đề nghị, tổng các đợt lệch giá trị hợp đồng.
- Tin nhắc 8 giờ sáng thêm mục đợt thanh toán (ba loại đầu), không ghi số tiền.

## Không làm

- Nhập số tiền thật của các hợp đồng (PM tự nhập hoặc gửi sau).
- Kho hồ sơ R2, phiên bản tệp.
- Tỷ lệ phần trăm theo giá trị hợp đồng (chỉ số tiền).

## Cách đã cân nhắc

1. Bảng mới `qlda_dot_thanh_toan` gắn hợp đồng (PM chọn). Kế hoạch trả và tiền đã chi tách nhau, nối qua `giai_ngan_id`.
2. Thêm cột kế hoạch vào `qlda_giai_ngan`: trộn kế hoạch với thực chi, tổng giải ngân và EVM phải lọc lại khắp nơi.
3. Ô chữ JSON trong hợp đồng: không lọc được để nhắc.

## Thiết kế

- Migration 0053: bảng `qlda_dot_thanh_toan` (to_chuc_id, hop_dong_id, ten, thu_tu, so_tien, han, hang_muc_id, ban_giao_id, dieu_kien, trang_thai `cho|da_de_nghi|da_tra|huy`, ngay_tra, giai_ngan_id, ghi_chu, tao_boi, tao_luc, cap_nhat_luc). hang_muc_id và ban_giao_id `ON DELETE SET NULL`.
- Đủ điều kiện: đợt đang `cho` và hạng mục gắn đã `xong`, hoặc bàn giao gắn ở `da_giao`, `dang_xem`, `da_duyet`.
- Sắp đến hạn và quá hạn chỉ tính đợt `cho` hoặc `da_de_nghi` của hợp đồng chưa hủy.
- Lệch giá trị: hợp đồng có giá trị, và (mọi đợt chưa hủy đều có số mà tổng khác giá trị quá 1 đơn vị) hoặc (tổng các đợt có số đã vượt giá trị).
- API trong `src/hoalac/thanh-toan.js`: GET/POST `/api/hoalac/dot-thanh-toan`, PUT/DELETE `/dot-thanh-toan/:id`, POST `/dot-thanh-toan/:id/tra`, POST `/dot-thanh-toan/:id/bo-tra`. PUT không đặt được `da_tra`. Xóa hợp đồng còn đợt, xóa giải ngân đang gắn đợt thì 409.
- Quyền: chủ và thành viên ghi; vai trò xem chỉ đọc; đối tác bị chặn (403).
- Tin nhắc: tên đợt và tên hợp đồng đi qua `cheSoTien` trước khi gửi.
- Xóa tổ chức và xuất dữ liệu có bảng mới.
- Giao diện: tab Hợp đồng có ô cảnh báo ở đầu và danh sách đợt dưới mỗi hợp đồng.

## Kiểm

Test: đủ điều kiện, bốn loại cảnh báo, tạo và gỡ giải ngân, bấm trả hai lần, hai dự án tách nhau, đối tác 403, vai trò xem 403 khi ghi, tin nhắc không có số tiền. Sau đó `phan-bien-ma`, biên nhận, PR, sao lưu CSDL VPS, triển khai, chụp trang trên Chrome.
