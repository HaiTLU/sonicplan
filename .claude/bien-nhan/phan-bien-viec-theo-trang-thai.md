# Phản biện mã: viec-theo-trang-thai (22/11/2026)

Trợ lý phản biện độc lập (sonnet, chỉ đọc hợp đồng, diff, CLAUDE.md). Kết luận: không có lỗi nặng; không rò dữ liệu giữa tổ chức, SQL đều lọc `to_chuc_id`, không XSS.

Lỗi vừa (đã sửa, có test):
- Mở lại việc đã xong giữ `tien_do` cũ: máy chủ đặt `tien_do = NULL` khi mở lại mà không nêu tiến độ; kéo từ Xong ra cột nào thì gửi kèm tiến độ cột đó.
- Lời gọi cột Xong lỗi làm hỏng cả trang: bắt lỗi riêng, báo một dòng, ba cột còn lại vẫn hiện.

Lỗi nhẹ: cột Xong áp đủ bộ lọc (đã sửa); mã tab trùng (đã sửa, có test); hoàn tác có try/catch (đã sửa); giờ xong khi hoàn tác, ghi tab sau thắng, tab trỏ dự án đã gỡ (ghi ở mục Giới hạn đã biết của đặc tả).

Test thêm theo góp ý: tổ chức khác (PATCH 404, tab rỗng), mở lại việc xong, hủy, mã tab trùng.

## Lượt phản biện lại sau khi sửa (trợ lý phản biện ghi)

APPROVED

Các lỗi mức vừa đã sửa đúng chỗ (đọc từ diff đã chuẩn bị). Còn lại, chấp nhận được: các đường mở lại khác (hủy rồi mở lại, Telegram) cũng về Chưa làm và mất `tien_do` cũ; giờ xong khi hoàn tác đổi thành giờ hiện tại (đã ghi ở giới hạn đã biết).
