# Kế hoạch: khu "Dự án" nhiều dự án (Viện Hòa Lạc + Nghiên cứu thị trường Ipsos)

PM duyệt kế hoạch ngày 12/11/2026. Bản gốc chép nguyên văn ở cuối tệp.

## Sửa đổi khi thực thi (12/11/2026, ghi theo CLAUDE.md mục 1)

**Đổi cách tách dữ liệu ở Bước 2.** Mỗi dự án là một tổ chức (`to_chuc`) có `pham_vi_truy_cap='hoalac'`, thay cho việc thêm `du_an_id` vào khoảng 20 bảng `qlda_*`.

Lý do:

- Mọi truy vấn `qlda_*` đã lọc theo `to_chuc_id`, nên dữ liệu hai dự án tự tách nhau mà không phải sửa khoảng 80 câu truy vấn.
- Đổi CSDL thật chỉ là thêm cột, không chép lại bảng.
- `x-to-chuc` chỉ được so với các tổ chức mà người dùng là thành viên (`src/phien.js`), nên không chọn được dự án mình không thuộc.

Hai điểm yếu từng nêu với PM ở cách này đã được bù:

- *Không có trang tổng hợp:* thêm `GET /api/hoalac/danh-muc`, máy chủ tự dựng danh sách từ các dự án người dùng là thành viên, áp vai trò theo từng dự án.
- *Phải tạo tay từng dự án:* thêm `POST /api/hoalac/danh-muc` cho người có vai trò `chu`, tạo dự án mới kèm loại và phần được bật.

Đánh đổi: cấp tổ chức nay kiêm cấp dự án; sau này muốn gộp nhiều dự án vào một tổ chức sẽ khó hơn.

Hệ quả khác:

- Đường dẫn giữ dưới `/hoalac*` và `/api/hoalac/*`, vì `/du-an` và `/api/du-an` đã thuộc phần việc của Sonicplan chính. Tiêu chí 1 đọc là "trang danh mục `/hoalac` có ít nhất 2 dự án".
- Danh sách email ở Bước 4 thêm vào Access app riêng của `/hoalac*`, không thêm vào Access app chính.
- Migration 0050 chỉ thêm cột `loai_du_an`, `phan_bat` vào `to_chuc` và bảng `qlda_san_pham_ban_giao` theo `to_chuc_id`.
- Vai trò `xem`: các chặn ghi trong `src/hoalac/api.js` đang chỉ cấm `doi_tac`. Đổi sang chỉ cho `chu` và `thanh_vien` ghi; test `xem` nhận 403 ở mọi POST, PUT, DELETE.
- Bước 1 chạy bằng 3 trợ lý tra cứu song song, không dùng workflow.

## Tiến độ

- [x] Bước 0. Chuẩn bị (nhánh `claude/du-an-nhieu-du-an`, hợp đồng `.claude/hop-dong/du-an-nhieu-du-an.json`)
- [x] Bước 1. Kiểm bảng chấm điểm: `docs/261112_SonicPlan_SoSanhPhanMemQLDA.md`
- [x] Bước 2. Nhiều dự án (PR 177, migration 0050)
- [x] Bước 3. Trang danh mục (gộp vào PR 177); tab Báo cáo BGH và ô cập nhật tuần (nhánh claude/trang-bgh, 12/11/2026)
- [x] Bước 4. Vai trò `xem` có trong mã; PM chọn tạm chỉ mình PM đăng nhập, chưa sửa Cloudflare Access
- [x] Bước 5. Nhập dữ liệu thật (Hòa Lạc 53 hạng mục, Ipsos 9 mốc sau khi bỏ mốc trùng M1)
- [x] Bước 6. Nhắc việc 8h qua Telegram (PR 178); cập nhật bằng lời chưa làm
- [x] Bước 7. Triển khai, kiểm trang thật khổ 2560 và 768 trên Chrome của PM, báo cáo; khổ 390 UNVERIFIED (cửa sổ không thu nhỏ dưới 768)

---

## Kế hoạch gốc đã duyệt

# Kế hoạch: Khu "Dự án" nhiều dự án trong Sonicplan (Viện Hòa Lạc + Nghiên cứu thị trường)

## Bối cảnh

- PM cần một phần mềm quản lý dự án để giải bốn việc khó: không nắm được tiến độ, báo cáo BGH tốn công, hồ sơ pháp lý thất lạc, theo dõi hợp đồng và thanh toán.
- Phần mềm đã có sẵn: phân hệ `/hoalac` trong Sonicplan (kho `HaiTLU/sonicplan`, `/Users/hainguyen/Brain/Software/sonic/sonicplan`), xong 6 PR ngày 27/10/2026.
  - Bảng `qlda_*` (migration 0038-0042): WBS, Gantt, đường găng, baseline, RAID, pháp lý, hợp đồng, ngân sách, EVM.
  - Giao diện có 5 tab: Kanban, Gantt, RAID, Pháp lý, Ngân sách.
  - Đã nhập 23 thủ tục pháp lý thật.
- **Vấn đề:** PM gần như chưa dùng `/hoalac`, vì ba lý do:
  - Dữ liệu gần trống.
  - Chỉ một người vào được.
  - Các bảng `qlda_*` gắn theo tổ chức `tc_hoalac`, không có `du_an_id`, nên không chứa được dự án thứ hai.
- **Đích:** biến `/hoalac` thành khu "Dự án" chung chứa nhiều dự án. Khu này nhập sẵn dữ liệu thật, có trang tổng hợp cho BGH, có nhắc việc, để nhóm thật sự dùng hằng ngày.
- **PM quyết ngày 12/11/2026:**
  - Mở rộng Sonicplan, không xây phần mềm mới.
  - Người dùng là nhóm nội bộ TLU; BGH chỉ xem.
  - Đăng nhập bằng mã gửi qua email (Cloudflare Access).
  - Hồ sơ tải thẳng lên phần mềm (R2).
  - Ngân sách theo dõi ở mức hợp đồng và đợt thanh toán.
  - Có bản đầu trong 2-3 tuần.
  - Dùng trợ lý con ở mức mạnh (chạy workflow).

## Bảng chấm điểm sơ bộ

Đây là đánh giá của Claude, chưa tra cứu kiểm chứng. Bước 1 sẽ kiểm lại.

Mỗi tiêu chí chấm 1-5. Trọng số theo bốn việc khó của PM:

| Viết tắt | Tiêu chí | Trọng số |
|---|---|---|
| TĐ | Tiến độ, mốc, Gantt | 25% |
| BC | Báo cáo, bảng tổng hợp cho lãnh đạo | 20% |
| HS | Hồ sơ, phiên bản, phê duyệt | 20% |
| HĐ | Hợp đồng, thanh toán | 15% |
| DD | Dễ dùng với nhóm nhỏ | 10% |
| VN | Hợp Việt Nam (tiếng Việt, chuẩn ĐHTL) | 10% |

| Phần mềm | TĐ | BC | HS | HĐ | DD | VN | Tổng /5 | Lấy gì về |
|---|---|---|---|---|---|---|---|---|
| Procore | 4 | 4 | 5 | 5 | 3 | 1 | 3,9 | Kho hồ sơ có phiên bản và phê duyệt; hợp đồng gắn đợt thanh toán; nhật ký công trường |
| Autodesk Build | 4 | 4 | 5 | 4 | 3 | 1 | 3,8 | Danh mục hồ sơ theo thư mục chuẩn, đánh dấu bản mới nhất; luồng duyệt tài liệu |
| Monday | 3 | 5 | 2 | 2 | 5 | 3 | 3,3 | Bảng tổng hợp nhiều dự án bằng ô màu trạng thái; tự nhắc theo quy tắc |
| ClickUp | 4 | 4 | 3 | 2 | 3 | 3 | 3,3 | Trang danh mục nhiều dự án; nhiều kiểu xem trên cùng dữ liệu |
| MS Project | 5 | 3 | 1 | 2 | 2 | 3 | 2,9 | Gantt có phụ thuộc, đường găng, so với baseline (đã có trong `qlda_*`, cần giao diện tốt hơn) |
| Primavera P6 | 5 | 4 | 1 | 3 | 1 | 2 | 2,9 | Mốc theo cấp; báo cáo lệch so với baseline cho lãnh đạo |
| Asana | 3 | 4 | 2 | 1 | 5 | 3 | 2,9 | Cập nhật trạng thái tuần: xanh, vàng hoặc đỏ kèm một đoạn ghi chú |
| Sonicplan `/hoalac` hiện tại | 4 | 1 | 2 | 2 | 2 | 5 | 2,8 | Nền đã có: WBS, đường găng, RAID, pháp lý, tiếng Việt, AI tách việc, Telegram |
| Trello | 2 | 1 | 2 | 1 | 5 | 3 | 2,2 | Thẻ kéo thả đơn giản cho việc hằng ngày |

Hướng kết hợp:

- Lõi tiến độ của MS Project và P6: đã có sẵn.
- Trang tổng hợp nhiều dự án: học Monday và ClickUp.
- Mẫu cập nhật trạng thái tuần: học Asana.
- Kho hồ sơ và hợp đồng: học Procore và Autodesk Build.
- Giữ điểm mạnh riêng của Sonicplan: tiếng Việt, AI tách việc từ tin nhắn, Telegram, chuẩn ĐHTL.

## Các bước

### Bước 0. Chuẩn bị

- Chép kế hoạch vào `KE-HOACH-DU-AN.md` trong kho sonicplan. Ghi tiến độ vào `TIEN-DO.md`.
- Gọi `git-an-toan`, rồi tạo nhánh `claude/du-an-nhieu-du-an` từ `main` mới nhất.
- Chạy `tim-bai-hoc.py` với hai từ khóa `sonicplan` và `cloudflare`.
- Mở hợp đồng việc bằng `scripts/hop-dong.py`.

### Bước 1. Kiểm bảng chấm điểm

- Chạy workflow, tối đa 6 agent mỗi pha.
- Mỗi agent tra 1-2 phần mềm trên trang chính thức: tính năng, màn hình mẫu, giá, có tiếng Việt không.
- Kết quả ghi vào `YYMMDD_SonicPlan_SoSanhPhanMemQLDA.md`: bảng điểm đã kiểm, nguồn, danh sách thứ cần lấy về.
- Ý nào không kiểm được thì ghi UNVERIFIED.

### Bước 2. Đổi khóa dữ liệu sang nhiều dự án (PR 1)

- Migration 0050:
  - Thêm `du_an_id` vào mọi bảng `qlda_*`, dùng bảng `du_an` của migration 0007.
  - Gán dữ liệu cũ vào dự án "Viện Hòa Lạc".
  - Thêm `loai_du_an` (`xay_dung` hoặc `nghien_cuu`) và danh sách phần được bật cho từng dự án.
- Đổi đường dẫn API từ `/api/hoalac/*` sang `/api/du-an/:id/*`. Đường dẫn `/hoalac` cũ chuyển về dự án Hòa Lạc.
- Sửa lỗi PUT của `qlda_hop_dong` (COALESCE trên khóa ngoại có thể trống) theo mẫu `BO_QUA` của PR5.
- Thử mô hình với dự án Ipsos. Dự án này là chọn đơn vị và nhận sản phẩm bàn giao, nên cần:
  - Thêm bảng `qlda_san_pham_ban_giao` gồm hạng mục, hạn, trạng thái, tệp.
  - Dùng `qlda_ben_lien_quan` để lưu Ipsos và Cimigo.
- Tệp cần sửa:
  - `src/hoalac/api.js`, `quyen.js`, `wbs.js`
  - `src/index.js` (hàm `xacDinhPhien`)
  - `src/du-lieu.js` (`BANG_XUAT`)
  - `src/xoa-to-chuc.js`
- Kiểm thử:
  - Chạy lại `test/hoalac-*.test.js` với `du_an_id`.
  - Thêm ca thử hai dự án không thấy dữ liệu của nhau.

### Bước 3. Trang danh mục và trang BGH (PR 2)

- Trang `/du-an` hiện mỗi dự án thành một thẻ gồm:
  - trạng thái xanh, vàng hoặc đỏ;
  - % tiến độ;
  - 3 mốc sắp tới;
  - việc quá hạn;
  - rủi ro cao;
  - khoản sắp phải trả.
- Trang "Tổng hợp BGH" chỉ cho đọc. Có ô "cập nhật tuần": AI soạn nháp, PM sửa.
- Dùng Chart.js (đã có trong kho) và kỹ năng `thang-long-liquid-glass`.
- Chụp màn hình ba khổ trên Chrome của PM.

### Bước 4. Đăng nhập cho nhóm (PR 3 và cấu hình)

- Thêm vai trò `xem` cho BGH, bên cạnh các vai trò đã có: `chu`, `thanh_vien`, `doi_tac`.
- Sửa chính sách Cloudflare Access trên Chrome của PM, đăng nhập bằng mã gửi qua email.
- Danh sách email do PM duyệt trước.

### Bước 5. Nhập dữ liệu thật

Dùng `scripts/nhap-hoalac.mjs` làm mẫu.

- Hòa Lạc: lấy WBS, mốc và hồ sơ còn thiếu từ các tệp trong `ThangLong_KB/01_Projects/VienNghienCuu`:
  - `BangTheoDoi_HopNgayMai`
  - `TheoDoi_HoSoBoSung_BQL`
  - `KeHoachHanhDong_v3`
  - `BangKiem_V8_TienDo2031_v2`
- Ipsos: lấy mốc, sản phẩm bàn giao và các bên tham gia từ `TIEN-DO.md`, `KE-HOACH.md` trong `Dự án Ipsos/Đề xuất IPSOS` và từ bảng so sánh.
  - Các mốc: 17/11, 25/11, 30/11/2026 và 06/02/2027.
- Số tiền để trống, ghi `trang_thai_so_lieu = chua_thong_nhat` cho tới khi PM xác nhận. Không tự chọn một trong các bản tổng mức đầu tư.
- Trước khi ghi vào CSDL thật:
  - Sao lưu sqlite trên VPS thành `sonicplan.sqlite.truoc-du-an-<ngày>`.
  - Thử nhập trên bản sao trước.

### Bước 6. Nhắc việc và cập nhật bằng lời (PR 4)

- Cron gửi tin Telegram hằng ngày về:
  - mốc trong 7 ngày tới;
  - việc quá hạn;
  - hồ sơ còn thiếu;
  - đợt thanh toán sắp tới.
- Cập nhật bằng lời:
  - PM gửi tin nhắn hoặc biên bản họp qua Telegram hay email.
  - AI tách thành đề xuất cập nhật: việc, mốc, rủi ro.
  - PM bấm duyệt thì mới ghi.
- Dùng lại `src/hoi-y-kien.js` và bộ tách việc đã có.

### Bước 7. Triển khai và kiểm

- Kiểm trước khi gộp:
  - `npm test` đạt hết.
  - Giao `phan-bien-ma` rà mã.
  - Chạy `bien-nhan-viec.py`.
- Tự gộp PR khi kiểm tra đạt.
- Triển khai lên plan.sonicapp.top (Worker và VPS). Chạy migration trên sqlite thật sau khi sao lưu.
- Kiểm trên Chrome ba vai trò (chủ, thành viên, xem), chụp màn hình.

### Đợt sau (lập kế hoạch riêng)

- **Đợt 2:**
  - Hợp đồng gắn đợt thanh toán, có cảnh báo.
  - Kho hồ sơ trên R2 có phiên bản, trạng thái duyệt, hạn hiệu lực (học Procore).
- **Đợt 3:**
  - Xuất báo cáo Word chuẩn ĐHTL và slide .pptx.
  - Soạn nháp tóm tắt tuần; PM duyệt rồi mới gửi.

## Giấy phép (PM duyệt 12/11/2026)

**Được phép tự làm:**

- Gộp PR khi kiểm tra đạt.
- Triển khai.
- Chạy migration trên CSDL thật, luôn sao lưu trước.
- Nhập dữ liệu thật của hai dự án.
- Sửa Cloudflare Access trên Chrome của PM.

**Dừng hỏi PM khi:**

- Cần danh sách email được đăng nhập.
- Có con số tiền.
- Gặp màn đăng nhập hoặc OTP.
- Phải xóa dữ liệu.
- Cùng một lỗi lặp lại 3 lần.

**Không bao giờ** gửi tin nhắn hay thư thay PM.

## Tiêu chí đạt

1. `/du-an` có ít nhất 2 dự án. Dữ liệu hai dự án tách nhau, có test chứng minh.
2. Hòa Lạc có ít nhất 20 hạng mục WBS kèm mốc. Ipsos có ít nhất 5 mốc và có danh sách sản phẩm bàn giao.
3. Đăng nhập vai trò `xem` mở trang BGH thấy đủ hai dự án, có ảnh chụp ba khổ.
4. Cron gửi được một tin Telegram thử tới PM.
5. `npm test` đạt; `phan-bien-ma` trả APPROVED; có dòng `BIEN-NHAN: trang-thai=dat`.
6. Mỗi lần ghi vào CSDL thật đều có bản sao lưu trước đó.

Báo cáo cuối gồm bảng PASS, FAIL hoặc UNVERIFIED, mục "Giả định đã chọn", và số trợ lý con đã dùng.
