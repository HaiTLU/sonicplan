# Kế hoạch: Hệ thống rút kinh nghiệm cho Sonicplan

## Bối cảnh
Anh muốn Sonicplan học từ lựa chọn của anh (nút Telegram) và thao tác trên web. Khảo sát mã cho thấy **vòng học đã có một nửa** (PR #110, #157): `viec_su_kien` ghi sửa/hủy việc do AI tạo, `hoc-hang-ngay.js` chạy 23h, `loi-dan-tuan.js` đề xuất lời dặn, `rao-chan-hoc.js` chặn lời dặn nguy hiểm, `ghi_nho` có độ tin cậy. Ba chỗ hở:
1. Nút Telegram Xong / Dời mai / Dời tuần sau / Bỏ (`apDungNutViec`, `src/telegram.js:107`) sửa thẳng bảng `viec`, **không ghi sự kiện nào**, nên vòng học không thấy.
2. Kéo thẻ sắp xếp (`POST /api/viec/sap-xep`), "Giữ cả hai", duyệt/bỏ lời dặn, chặn nguồn: chưa có bản ghi chung.
3. Chưa có nhật ký cấp hệ thống, chưa tín hiệu "im lặng", chưa đo lời dặn đã duyệt có giảm lỗi hay không.

Lựa chọn của anh: mục đích **cả hai** (báo cáo thói quen và đề xuất lời dặn cho AI); mức tự động **chỉ đề xuất, anh duyệt**; tín hiệu gồm **nút Telegram, thao tác web, và việc bị bỏ mặc**.

## Thiết kế
**Tầng 1 - sự kiện (CSDL):** bảng mới `nhat_ky_hanh_dong` (migration 0049, chỉ cộng thêm): `to_chuc_id, nguon (telegram|web|he_thong), loai, viec_id, truoc, sau, boi_canh (JSON: nguồn việc, dự án, nhóm, giờ, thứ), ly_do, luc`. Không lưu nội dung tin gốc, cắt ngắn 200 ký tự. Hàm dùng chung `ghiHanhDong()` trong tệp mới `src/nhat-ky-hanh-dong.js`.

**Tầng 2 - hiểu biết (kho `ghi_nho`):** mẫu lặp được rút ra, đi qua `kiemUngVien` rồi vào `deXuatLoiDan` với độ tin 0.3, anh duyệt mới lên 0.8 (đúng cơ chế hiện có, không tạo đường mới cho AI tự ghi).

## Các bước
1. **Nhật ký hành động.** Migration `0049_nhat_ky_hanh_dong.sql` + `src/nhat-ky-hanh-dong.js` (hàm ghi, hàm đọc theo kỳ). Thêm vào `src/du-lieu.js` danh sách xuất/xóa dữ liệu tổ chức và `src/xoa-to-chuc.js`.
2. **Ghi nút Telegram.** Trong `apDungNutViec` và `luotBamNut` (`telegram.js:247`) ghi `nguon=telegram` kèm hạn trước/sau, thời gian từ lúc nhắc đến lúc bấm. Trả lời ô hỏi đã có `ghiSuKien` (`hoi-y-kien.js`), thêm một bản ghi chung.
3. **Ghi thao tác web.** `suaViec` (`src/api/viec.js:107`), `sap-xep`, `giu-ca-hai`, `/api/chan`, `quyetGoiYLoiDan` (`src/api/ghi-nho.js:115`) gọi `ghiHanhDong`. Không đổi `viec_su_kien` hiện có để chỉ số tự tắt của `hoc-hang-ngay.js` giữ nguyên.
4. **Tín hiệu im lặng.** Việc AI tạo mà sau 7 ngày không có hành động nào và vẫn mở thì ghi `loai=im_lang` (chạy trong tác vụ `hoc-hang-ngay`, không ghi lặp).
5. **Bộ rút kinh nghiệm** `src/rut-kinh-nghiem.js` (hàm thuần, có test): gom theo nguồn, dự án, nhóm, giờ nhắc; tìm mẫu khi đủ mẫu tối thiểu (>= 5 lần): hay dời từ 2 lần trở lên, hay bỏ, hay im lặng, xong ngay sau nhắc. Đầu ra gồm (a) thẻ "Thói quen" để báo cáo, (b) ứng viên lời dặn đưa vào `deXuatLoiDan`, tôn trọng hạn mức 5 mỗi ngày và danh sách chủ đề cho phép.
6. **Cho anh xem.** Mục "Rút kinh nghiệm" trên Dashboard (`src/api/dashboard.js:124` đã có `bai_hoc`) và dòng tóm tắt trong bản tin tuần. Telegram gửi đề xuất lời dặn kèm nút Duyệt / Bỏ (`l:<id>:ok|no`, gọi `quyetGoiYLoiDan`) để anh quyết ngay trên điện thoại.
7. **Đo hiệu quả.** Sau khi anh duyệt lời dặn, so tỷ lệ việc bị sửa/hủy 14 ngày trước và sau, lưu vào `cai_dat`, hiện cạnh lời dặn. Không giảm thì gợi ý gỡ lời dặn.
8. **Tài liệu.** Cập nhật `README.md` (mục "Học từ lựa chọn hằng ngày"), `CHANGELOG.md`, `TIEN-DO.md`; chép kế hoạch này vào `KE-HOACH.md` (thay nội dung cũ "Làm nốt PR #165" sau khi lưu bản cũ).

## Giả định đã chọn
- Telegram "Bỏ" và "Dời" chỉ ghi vào bảng mới, không tính vào chỉ số "AI bị sửa" hiện có, để không làm lệch cơ chế tự tắt.
- Mẫu tối thiểu 5 lần, kỳ xét 14 ngày; có thể chỉnh sau khi có số thật.
- Không thêm chủ đề lời dặn mới ngoài `CHU_DE_CHO_PHEP` ở đợt này.

## Rủi ro và rào
- Quyền riêng tư: nhật ký chỉ lưu mã việc, loại hành động, ngữ cảnh ngắn; không lưu nội dung thư hay tin Zalo.
- AI không tự áp lời dặn: mọi đề xuất qua `kiemUngVien` và chờ anh duyệt.
- Migration chỉ cộng thêm; không xóa cột hay dữ liệu.

## Cách làm và kiểm
- Nhánh `claude/rut-kinh-nghiem`, PR nháp, một PR chỉ trong Sonicplan; mở hợp đồng `scripts/hop-dong.py` trước, xong `bien-nhan-viec.py` và giao `phan-bien-ma`.
- Test thuần (`test/`): bộ rút mẫu với dữ liệu giả (đủ mẫu / thiếu mẫu / lời dặn bị rào chặn).
- Chạy `npm test`; áp migration lên D1 cục bộ; mô phỏng callback `v:<id>:mai` rồi kiểm có dòng trong `nhat_ky_hanh_dong`; chạy tác vụ `hoc-hang-ngay` với dữ liệu giả và xem đề xuất xuất hiện.
- Mở Dashboard cục bộ, chụp màn hình mục "Rút kinh nghiệm" trước khi báo xong. Báo cáo cuối có bảng PASS/FAIL/UNVERIFIED.
- Chưa thử được bằng bot thật và dữ liệu thật trên production; phần đó ghi UNVERIFIED cho tới khi anh dùng vài ngày.
