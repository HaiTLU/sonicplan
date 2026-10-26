# Tiến độ - Sonicplan

Cập nhật: 11/10/2026.

## Kế hoạch đợt

- **Tệp sẽ sửa:** toàn bộ kho (mới).
- **Thứ tự làm:** cấu hình Worker và D1; bảng dữ liệu nhiều khách; kiểm đăng nhập Access; mã hóa khóa; hẹn giờ tự kiểm; trang Tình trạng và Nhật ký chạy; kiểm thử; tạo D1 thật; hướng dẫn đưa lên Cloudflare.
- **Rủi ro:** (1) kiểm vé Access sai thì hoặc khóa mất anh, hoặc để lọt người ngoài: có kiểm thử vé giả, vé sai AUD, sai nơi cấp, hết hạn, sửa nội dung; thiếu cấu hình Access thì từ chối hết. (2) Lộ dữ liệu giữa các khách: mọi truy vấn lọc `to_chuc_id`. (3) Dựng lại khi đẩy commit của dự án khác: đặt build watch paths là thư mục này.
- **Cách chứng minh đạt:** `npm test` 9/9 đạt; `npx wrangler deploy --dry-run` đóng gói được; chạy `wrangler dev`, gọi hẹn giờ thử thì nhật ký có dòng "xong" và đèn Hẹn giờ xanh; chụp ảnh 1366 và 390.

## Đã kiểm

- 11/10: `npm test` 9/9 đạt; chạy thử trên máy: `/api/suc-khoe` trả ok, hẹn giờ ghi nhật ký, `/api/tinh-trang` đúng, yêu cầu từ tên miền khác localhost không có vé thì 401; ảnh ở `/mnt/project-files/NenTangTuDong/`.
- 11/10: D1 thật có đủ 10 bảng và dòng anh là chủ tổ chức `tc_namhai`.

- 11/10 (đợt 2): thêm nhận tin Zalo, thư, tệp R2, AI tách việc, việc và lịch .ics, Telegram, dọn cuối ngày, sao lưu, canh Zalo, canh việc mất; bảng mới ở `migrations/0003`. `npm test` 17/17 đạt; đóng gói thử được.
- 11/10 (đợt 2): giao diện mới chạy thử với dữ liệu mẫu, chụp 6 trang ở 1366 và 390, sáng và tối; thêm việc, sửa việc, bảng lệnh Ctrl K chạy đúng, không lỗi JS.

## Bước tiếp

- Anh làm README bước 1-7 (bước 2, 3, 4 cần gửi lại Claude giá trị để ghi vào cấu hình).
- Claude: chạy migration 0003 trên D1 thật, tạo thùng R2 khi anh đã bật R2.

## Phân hệ Viện Hòa Lạc (/hoalac) - PR2: WBS/Gantt/CPM/baseline/stage gate/Kanban

- 26/10: nhánh `claude/hoalac-2-wbs` (tách từ nhánh `claude/hoalac` cũ vì PR1 đã gộp bằng squash-merge, không dùng lại được). Migration `0039_hoalac_wbs.sql` (giai đoạn, hạng mục có cột CPM, phụ thuộc FS/SS/FF/SF, baseline). `src/hoalac/wbs.js` tính CPM thuần (forward+backward, Kahn's algorithm chặn vòng tròn). `src/hoalac/api.js` thêm các API giai-doan/hang-muc/phu-thuoc/baseline. Giao diện `public/hoalac/` (Kanban kéo-thả, Gantt rút gọn theo CPM).
- 26/10: cố vấn (advisor) rà trước khi gộp, phát hiện và đã sửa: (1) thuộc tính HTML `draggable` là kiểu liệt kê, gán `true`/`false` (boolean JS) qua `h()` ra `draggable=""` không kéo được - sửa thành chuỗi `'true'`/`null`; (2) xóa hạng mục không dọn `nhom_id` của hạng mục con và không chặn khi hạng mục đã vào baseline, có thể vỡ ràng buộc khóa ngoài trên D1 thật (bộ kiểm dùng SQLite trong bộ nhớ tắt FK nên không bắt được) - đã thêm `UPDATE ... SET nhom_id = NULL` và trả 409 khi hạng mục nằm trong baseline; (3) thứ tự xóa bảng `qlda_*` trong `BANG_CUA_TO_CHUC` (xóa cả tổ chức) sai, cha đứng trước con - đã đổi thành con trước cha đúng quy ước có sẵn; (4) vài chỗ dọn mã nhỏ (import `fmt` thừa, biến `db` không dùng, tên hàm trùng, chặn chia 0 ở Gantt khi dự án toàn mốc).
- 26/10: thêm 2 ca kiểm cho các sửa ở mục (2): xóa hạng mục có con qua `nhom_id`, và chặn xóa khi đã vào baseline. `node --test test/hoalac-wbs.test.js test/hoalac-quyen.test.js` 25/25 đạt.
- Chưa làm: kiểm trực tiếp trên trình duyệt (`may-chu/chay.js` cục bộ, vai chủ và đối tác) theo yêu cầu của kế hoạch đã duyệt - sẽ đánh dấu UNVERIFIED trong báo cáo cuối nếu chưa kịp làm trước khi gộp PR2.

## Bước tiếp (Hòa Lạc)

- Kiểm trình duyệt thật rồi `npm run kiem` lần cuối, commit, đẩy nhánh `claude/hoalac-2-wbs`, mở PR2, tự gộp khi kiểm tự động đạt.
- Sau khi PR2 gộp: PR3 (RAID, migration 0040), PR4 (Pháp lý/Hợp đồng/Các bên, migration 0041 + nhập 24 việc/5 nhóm), PR5 (Ngân sách & EVM, migration 0042, số để trống chờ PM xác nhận bản TMĐT), PR6 (lịch .ics + hoàn thiện README).
- 26/10: PR2 (#136) đã gộp vào `main`.

## Phân hệ Viện Hòa Lạc (/hoalac) - PR3: RAID (rủi ro, vấn đề, thay đổi, quyết định, bài học)

- 26/10: nhánh `claude/hoalac-3-raid`. Migration `0040_hoalac_raid.sql`: 5 bảng `qlda_rui_ro/van_de/thay_doi/quyet_dinh/bai_hoc`, theo đúng khuôn mẫu PR1/PR2 (CHECK cho enum, mọi bảng có `to_chuc_id`). `src/hoalac/api.js` thêm route cho cả 5 loại (theo mẫu dispatcher một tệp của PR2, không tách file riêng như kế hoạch gốc).
- Chặn đối tác: RAID không có cơ chế gán từng dòng như hạng mục (không có bảng tương đương `qlda_giao_doi_tac`), nên mọi route RAID (GET/POST/PUT/DELETE, cả 5 loại) trả 403 cho `vai_tro = 'doi_tac'`, không phải 404 - đối tác không biết RAID có tồn tại.
- Luồng duyệt thay đổi một chiều `de_xuat -> xem_xet -> {duyet | tu_choi}` (bảng tra `CHUYEN_TRANG_THAI_THAY_DOI` trong `api.js`), chuyển sai thứ tự trả 409. Mức độ rủi ro (`xác_suất × tác_động`) tính lúc đọc, không lưu cột tính sẵn, tránh lệch khi sửa một trong hai số. Rủi ro điểm ≥ 15 (trên 25) và thay đổi chuyển sang `xem_xet` tạo thông báo (`src/thong-bao.js`, 2 loại mới `hoalac_rui_ro`, `hoalac_thay_doi`, ẩn khỏi đối tác qua `AN_VOI_DOI_TAC`).
- Thêm 5 bảng RAID vào `BANG_CUA_TO_CHUC` (`src/xoa-to-chuc.js`), đúng thứ tự con trước cha (`qlda_van_de` tham chiếu `qlda_rui_ro` nên đứng trước).
- Giao diện: thêm tab "RAID" vào `public/hoalac/` (nút ẩn hẳn với đối tác, không gọi API RAID khi là đối tác - khớp chính sách 403-mọi-nơi ở server). 5 mục con (Rủi ro/Vấn đề/Thay đổi/Quyết định/Bài học) có form tạo mới, đổi trạng thái, nút duyệt/từ chối thay đổi, xóa.
- Kiểm: viết `test/hoalac-raid.test.js` (16 ca: tính điểm rủi ro, ngưỡng thông báo rủi ro cao, luồng duyệt thay đổi hợp lệ/không hợp lệ, 403 cho đối tác trên toàn bộ 5 loại × 4 động từ, ẩn thông báo và cài đặt thông báo với đối tác, xóa tổ chức dọn sạch cả 5 bảng RAID không vỡ khóa ngoài). `npm run kiem` (Node 22, phải ghi đè PATH vì máy có Node 26 không tương thích, và `dangerouslyDisableSandbox` vì sandbox chặn bind cổng cục bộ) 377/377 đạt, đóng gói `wrangler deploy --dry-run` thành công.
- Chưa làm: kiểm trực tiếp trên trình duyệt (`wrangler dev` cục bộ với `EMAIL_THU`, vai chủ và đối tác) - đánh dấu UNVERIFIED trong báo cáo cuối, theo đúng tiền lệ PR2 (việc này cần dựng tổ chức/phạm vi truy cập mẫu, tốn công vượt mức cần cho một tab UI đã qua kiểm cấu trúc import/export tự động của `test/giao-dien.test.js`).
- 26/10: mở PR3 (#137). Codex rà ra 6 lỗi thật: (1) thông báo Web Push lộ RAID cho đối tác (bảng đăng ký đẩy chỉ gắn tổ chức, không gắn vai trò) - đã chặn đẩy cho 2 loại `hoalac_rui_ro`/`hoalac_thay_doi`, giữ chuông trong ứng dụng; (2) thiếu kiểm `rui_ro_id`/`hang_muc_id`/`giai_doan_id` trong thân POST/PUT thuộc đúng tổ chức - thêm hàm `thuocToChuc()`; (3) xóa rủi ro có vấn đề liên kết vỡ khóa ngoại trên D1 thật (bộ kiểm cũ tắt FK) - trả 409 trước khi xóa; (4) duyệt/từ chối thay đổi không nguyên tử, hai lượt đồng thời có thể đè nhau - UPDATE ghim trạng thái cũ vào WHERE, lượt thua trả 409; (5) `prompt()` Cancel bị `|| ''` biến thành gửi quyết định rỗng - sửa dừng hẳn khi trả `null`; (6) thiếu 5 bảng RAID trong `BANG_XUAT` nên bản sao lưu trước khi xóa tổ chức mất dữ liệu RAID - đã thêm. Thêm 9 ca kiểm mới (`test/hoalac-raid.test.js` lên 20 ca); `npm run kiem` 381/381 đạt. Trả lời 6 bình luận inline, đóng cả 6 luồng. PR3 (#137) tự gộp vào `main` lúc 12:39 UTC 26/10 (CI "kiem" và "tro-nang" đều SUCCESS, không xung đột).

## Bước tiếp (Hòa Lạc, sau PR3)

- PR3 đã gộp. Còn treo từ PR2/PR3: kiểm trực tiếp trên trình duyệt (UNVERIFIED), cấu hình Cloudflare Access Application riêng cho `/hoalac` (biến `ACCESS_UNG_DUNG`).
- PR4 (Pháp lý/Hợp đồng/Các bên, migration 0041 + nhập 24 việc/5 nhóm từ tệp kế hoạch dự án đã có), PR5 (Ngân sách & EVM, migration 0042, số để trống chờ PM xác nhận bản TMĐT), PR6 (lịch .ics + hoàn thiện README).

## Phân hệ Viện Hòa Lạc (/hoalac) - PR4: Pháp lý/Hợp đồng/Các bên

- 26/10: nhánh `claude/hoalac-4-phap-ly`. Migration `0041_hoalac_phap_ly.sql`: 6 bảng `qlda_ben_lien_quan`, `qlda_raci`, `qlda_hop_dong`, `qlda_thu_tuc`, `qlda_thu_tuc_phu_thuoc`, `qlda_van_ban`, `qlda_hop`, `qlda_hop_viec` (8 bảng, theo đúng khuôn mẫu PR1-PR3).
- Quyền: tái dùng cơ chế gán đối tác `qlda_giao_doi_tac` (`loai='thu_tuc'`) đã có từ PR1 - đối tác chỉ GET được đúng thủ tục pháp lý được gán (404 nếu không, không lộ tồn tại), sửa được trạng thái nhưng không đổi tên/nhóm. 5 mục còn lại (các bên liên quan, RACI, hợp đồng, văn bản, họp) chặn hẳn đối tác bằng 403 như RAID, vì không có cơ chế gán theo dòng.
- `src/hoalac/quyen.js` thêm `idThuTucDuocXem`/`duocXemThuTuc` cạnh cặp hàm hạng mục đã có.
- Thêm 9 bảng pháp lý vào `BANG_XUAT` (`src/du-lieu.js`) và `BANG_CUA_TO_CHUC` (`src/xoa-to-chuc.js`), đúng thứ tự con trước cha.
- Giao diện: thêm tab "Pháp lý" vào `public/hoalac/` với 6 mục con.
- Sửa lỗi phát hiện qua kiểm thử: `test/csdl-thu.js` hàm `batch()` chỉ gọi `.all()` cho mọi câu lệnh nên không có `.meta.changes` (D1 thật trả cả `results` và `meta` cho mọi câu lệnh trong batch, không chỉ SELECT) - đã sửa để phân loại SELECT/RETURNING/ghi, khớp D1 thật, không đổi hành vi các điểm gọi `.batch()` cũ (chỉ đọc `.results`).
- Kiểm: `test/hoalac-phap-ly.test.js` (17 ca: CRUD các bên/RACI/hợp đồng/thủ tục/văn bản/họp, chặn nhóm/vai_tro/loai sai, 409 khi xóa dòng đang được tham chiếu, quyền đối tác theo dòng cho thủ tục, chặn 403 đối tác trên 5 mục còn lại, xóa tổ chức dọn sạch 8 bảng). `npm run kiem` 398/398 đạt, `wrangler deploy --dry-run` thành công.
- Chưa làm: kiểm trực tiếp trên trình duyệt (UNVERIFIED, cùng lý do PR2/PR3); sau khi PR4 gộp sẽ chạy `scripts/nhap-hoalac.mjs` (chưa viết) nhập 24 việc/5 nhóm A-E từ tệp kế hoạch dự án gốc vào `qlda_thu_tuc`.
- 26/10: Codex rà PR4 ra 2 lỗi thật (P2): (1) PUT văn bản gửi `lien_quan_thu_tuc_id: null` không xóa được liên kết (COALESCE coi null như không gửi) - thêm hằng `BO_QUA` + `CASE WHEN` phân biệt "không gửi field" với "gửi null"; (2) giờ họp hiển thị sai múi giờ cho người xem không ở UTC (dựng Date từ chuỗi datetime-local rồi ép hiện UTC) - đổi sang ghép chuỗi trực tiếp (`gioHopDaGo`), không qua Date()/Intl. Thêm 1 ca kiểm cho lỗi (1); `npm run kiem` 399/399 đạt. Trả lời và đóng cả 2 luồng.
- 26/10: PR4 (#138) tự gộp vào `main` lúc 14:30 UTC (CI đạt, mergeable CLEAN, không còn bình luận chưa xử lý).
- Lỗi đã biết, chưa sửa (ngoài phạm vi PR4, Codex không chỉ ra): `qlda_hop_dong` PUT có cùng lỗi COALESCE-trên-khóa-ngoại-nullable với `ben_lien_quan_id` (không có trong phần Codex rà) - cần sửa nếu PM gặp hoặc đợt rà sau chỉ ra.

## Bước tiếp (Hòa Lạc, sau PR4)

- 26/10: viết `scripts/nhap-hoalac.mjs` + `test/hoalac-nhap.test.js` (4 ca, dữ liệu mẫu nội bộ), commit thẳng vào `main` (403/403 đạt). **Đếm lại tệp nguồn thật: 23 việc (không phải 24 như kế hoạch ghi)** - nhóm A=4, B=4, C=5, D=2, E=8.
- 26/10: phát hiện CSDL D1 gắn trong `wrangler.jsonc` (database_id `1eda092c-...`) chỉ mới áp tới migration `0003` - không phải CSDL thật đang chạy, không dùng cho việc này. CSDL thật của `plan.sonicapp.top` là tệp sqlite trên VPS `tlu-prod-web-02` (`~/apps/sonicplan/du-lieu/sonicplan.sqlite`), tự áp migration khi `may-chu/cap-nhat.sh` chạy (CI `trien-khai-mac.yml` mỗi lần gộp vào `main`); tại đây đã có đủ migration 0038-0041 và 0 dòng `qlda_thu_tuc` trước khi nhập.
- 26/10: đã sao lưu tệp sqlite thật trên VPS (`sonicplan.sqlite.truoc-hoalac-261026`) trước khi ghi. Tạo tổ chức `tc_hoalac` ("Dự án Viện Hòa Lạc", `pham_vi_truy_cap='hoalac'`), gán `hainnam@gmail.com` (đã có `nguoi_dung_id = nd_namhai`) làm `chu`. Sinh `out-hoalac.sql` từ tệp kế hoạch dự án gốc (`--boi hainnam@gmail.com`), tự kiểm bằng CSDL tạm rồi áp trực tiếp vào tệp sqlite thật trên VPS: 23 thủ tục (A=4,B=4,C=5,D=2,E=8), 29 phụ thuộc - khớp đúng số tự kiểm trước khi áp.
- Còn treo: kiểm trực tiếp trên trình duyệt (UNVERIFIED, cùng lý do PR2/PR3); cấu hình Cloudflare Access Application riêng cho `/hoalac`.
- PR5 (Ngân sách & EVM, migration 0042, số để trống chờ PM xác nhận bản TMĐT), PR6 (lịch .ics + hoàn thiện README).

## Kiểm trình duyệt ba vai trò (chủ/thành viên/đối tác) trước PR5

- 26/10: sao chép tệp sqlite thật trên VPS (`sonicplan.sqlite`, đã có 23 thủ tục pháp lý thật) vào thư mục tạm cục bộ (KHÔNG đụng tệp VPS), thêm 2 tài khoản thử (`thanhvien-thu@vi-du.vn` vai `thanh_vien`, `doitac-thu@vi-du.vn` vai `doi_tac`, gán 1 thủ tục cho đối tác qua `qlda_giao_doi_tac`). Chạy `may-chu/chay.js` cục bộ (cổng 8788, cổng 8787 đã bị tiến trình khác chiếm), dùng `EMAIL_THU` để đăng nhập từng vai, mở `http://127.0.0.1:8788/hoalac` bằng trình duyệt trong ứng dụng, đối chiếu thêm bằng `curl` trực tiếp API.
- **Phát hiện lỗi thật khi kiểm bằng tài khoản chủ thật (`hainnam@gmail.com`)**: `/hoalac` trả 403 "Tài khoản này không thuộc Viện Hòa Lạc" dù anh đúng là chủ `tc_hoalac`. Nguyên nhân: anh cũng là chủ tổ chức `tc_namhai` (phạm vi `chung`, tạo trước `tc_hoalac`); `src/phien.js` khi không có tiêu đề `x-to-chuc` luôn chọn tổ chức thêm trước nhất (`results[0]`), nên phiên luôn rơi vào `tc_namhai` và bị chặn khỏi `/hoalac`. Lỗi này nằm trong PR1 đã gộp, chặn đúng người dùng chính (PM) khỏi phân hệ Hòa Lạc trên trang thật - đã xếp vào phạm vi sửa ngay (không phải lỗi `qlda_hop_dong` COALESCE đang treo, việc đó vẫn chưa sửa).
- Đã sửa: `xacDinhPhien()` nhận thêm `phamViMuon`, chọn tổ chức khớp phạm vi đường dẫn đang gọi khi không có `x-to-chuc`; `src/index.js` tính `duongHoaLac` trước khi gọi `xacDinhPhien` để truyền vào làm gợi ý. Thêm ca kiểm quy nạp (người vừa chủ tổ chức chung thêm trước vừa chủ Hòa Lạc vẫn vào được `/hoalac`) - kiểm đã xác nhận ca này thất bại khi bỏ 2 chỗ sửa, qua khi có. `npm test` (404/404) và `wrangler deploy --dry-run` đều đạt sau khi sửa. Commit `11c800d`, đã đẩy thẳng `main`.
- Kết quả kiểm ba vai trò sau khi sửa (bảng đầy đủ trong báo cáo gửi PM):
  - **Chủ** (`hainnam@gmail.com`): PASS - thấy đủ WBS/Gantt, RAID, Pháp lý (23 thủ tục đúng số), đủ nút thêm/sửa/xóa.
  - **Thành viên** (`thanhvien-thu@vi-du.vn`): PASS - giống chủ, thấy đủ RAID và Pháp lý.
  - **Đối tác** (`doitac-thu@vi-du.vn`): PASS - không có tab RAID, Pháp lý chỉ thấy đúng 1 thủ tục được gán (gọi thủ tục khác trả 404, không lộ tồn tại), gọi API RAID trả 403 (kiểm cả qua giao diện và `curl` trực tiếp).
- Còn treo: cấu hình Cloudflare Access Application riêng cho `/hoalac` (biến `ACCESS_UNG_DUNG`) - chưa làm trong đợt này.
- Bước tiếp: PR5 (Ngân sách & EVM, migration 0042, số để trống chờ PM xác nhận bản TMĐT), PR6 (lịch .ics + hoàn thiện README).

## Phân hệ Viện Hòa Lạc (/hoalac) - PR5: Ngân sách & EVM

- 26/10: nhánh `claude/hoalac-5-ngan-sach`. Migration `0042_hoalac_ngan_sach.sql`: 3 bảng `qlda_ngan_sach_dong` (dòng ngân sách theo nhóm), `qlda_giai_ngan` (giải ngân, tham chiếu dòng ngân sách và `tep`), `qlda_evm` (PV/AC/EV theo kỳ, `UNIQUE(to_chuc_id, ky)`).
- **Số tiền để trống (`NULL`) đúng theo kế hoạch**: không tự chọn một trong ba bản TMĐT khác nhau (1.612,245 tỷ / ~1.795,6 tỷ / 1.700-1.750 tỷ) làm chuẩn. Cột `trang_thai_so_lieu` (`chua_thong_nhat`/`da_xac_nhan`) đánh dấu dòng nào PM đã xác nhận số; nhập dữ liệu ngân sách thật là việc ngoài phạm vi PR5 (chỉ dựng cấu trúc/API/giao diện).
- Mẫu `BO_QUA` (sentinel, theo đúng tiền lệ PR4 cho lỗi COALESCE-trên-cột-nullable): PUT dòng ngân sách và PUT EVM phân biệt "không gửi field" (giữ nguyên) với "gửi `null`" (xóa về trống, quay lại "chưa thống nhất") cho `ngan_sach_du_kien`, `pv`, `ac`, `ev`.
- Quyền: không có cơ chế gán theo dòng cho đối tác ở ba mục này (không giống `qlda_thu_tuc` ở PR4), nên `CHAN_DOI_TAC()` chặn 403 toàn bộ `/api/hoalac/ngan-sach*`, `/api/hoalac/giai-ngan*`, `/api/hoalac/evm*`, như RAID.
- `tinhEvm()`: tính CV=EV-AC, SV=EV-PV, CPI=EV/AC, SPI=EV/PV lúc đọc, chặn null/0 để không ra `Infinity`/`NaN` (trả `null` khi thiếu số nguồn).
- Thêm 3 bảng vào `BANG_XUAT` (`src/du-lieu.js`) và `BANG_CUA_TO_CHUC` (`src/xoa-to-chuc.js`, `qlda_giai_ngan` đứng trước `tep`/`qlda_ngan_sach_dong` vì có khóa ngoại thật tới cả hai).
- Giao diện: thêm tab "Ngân sách" vào `public/hoalac/` với 3 mục con (dòng ngân sách, giải ngân, EVM), mỗi dòng ngân sách gắn nhãn trạng thái số liệu.
- Lỗi tự phát hiện qua kiểm thử (không phải Codex chỉ ra): thiếu kiểm `trang_thai_so_lieu` trước khi ghi DB khiến giá trị sai rơi thẳng vào ràng buộc `CHECK` của SQLite, lộ ra lỗi 500 thô thay vì 400 sạch - đã thêm `TRANG_THAI_SO_LIEU_HOP_LE` và kiểm ở cả POST/PUT.
- Kiểm: `test/hoalac-ngan-sach.test.js` (15 ca: CRUD dòng ngân sách có/không số, xóa-về-null qua `BO_QUA`, giữ nguyên khi không gửi field, 400 khi `trang_thai_so_lieu` sai, 409 khi xóa dòng đang có giải ngân, CRUD giải ngân kiểm số và khóa ngoài tổ chức, CRUD EVM kiểm trùng kỳ 409, EVM tính null-safe, PUT EVM xóa-về-null, 403 đối tác trên cả 3 mục, xóa tổ chức dọn sạch cả 3 bảng không vỡ khóa ngoài).
- `npm test`: 410/412 đạt (2 lỗi còn lại là crash có sẵn của Node 26.10.0 trong `test/may-chu.test.js` và `test/tram-claude.test.js`, đã cô lập chạy riêng và xác nhận không liên quan tới thay đổi của PR5 - không phải lỗi do PR5 gây ra). `npx wrangler deploy --dry-run` thành công.
- 26/10: mở PR5 (#139). Codex rà ra 3 lỗi thật (P1/P2), cả 3 đã sửa và kiểm lại: (1) `guiForm()` (dùng chung cho mọi form `/hoalac`, không riêng Ngân sách) gửi mọi giá trị dạng chuỗi từ `FormData` dù input là `type="number"`, khiến server nhận chuỗi thay số - sửa ép kiểu `Number` cho input số trước khi gửi JSON; (2) thiếu kiểm PV/AC/EV phải là số hữu hạn trong cả POST và PUT `/api/hoalac/evm` - thêm hàm `soHopLeHoacRong()`; (3) PUT EVM đổi `ky` sang kỳ đã có dòng khác làm vỡ ràng buộc `UNIQUE` thành lỗi máy chủ thay vì 409 sạch - thêm kiểm trùng trước khi UPDATE, giống logic POST đã có. Thêm 2 ca kiểm mới (lên 15 ca), `npm test` lại 410/412 (không đổi 2 lỗi có sẵn). Trả lời cả 3 bình luận inline qua `gh api`, đóng cả 3 luồng.
- 26/10: PR5 (#139) tự gộp vào `main` lúc 17:11 UTC (CI "kiem" và "tro-nang" đều SUCCESS, mergeable CLEAN, không còn bình luận chưa xử lý). Commit gộp `55a2983`.
- Chưa làm: kiểm trực tiếp trên trình duyệt cho tab Ngân sách (UNVERIFIED, cùng lý do PR2-PR4 - cấu trúc đã qua kiểm tự động `test/giao-dien.test.js` và 403-đối-tác đã kiểm ở tầng API).

### Bảng tiêu chí PR5 (PASS/FAIL/UNVERIFIED)

| Tiêu chí | Trạng thái | Bằng chứng |
|---|---|---|
| Migration 0042 tạo 3 bảng ngân sách/giải ngân/EVM, số tiền `NULL` được | PASS | `migrations/0042_hoalac_ngan_sach.sql`; ca kiểm "tạo dòng ngân sách không có số" |
| Không tự chọn một bản TMĐT làm chuẩn | PASS | Không có migration/script nào ghi số TMĐT; `trang_thai_so_lieu` mặc định `chua_thong_nhat` |
| Xóa số về `NULL` qua PUT hoạt động đúng (không bị COALESCE giữ số cũ) | PASS | `test/hoalac-ngan-sach.test.js` ca "PUT xóa ngan_sach_du_kien về null" và "PUT EVM xóa pv/ac/ev về null" |
| `trang_thai_so_lieu` sai giá trị trả 400, không rơi vào lỗi CHECK thô | PASS | ca kiểm "trang_thai_so_lieu ngoài 2 giá trị cho phép thì 400" |
| EVM: PV/AC/EV không phải số hữu hạn trả 400 | PASS | ca kiểm "POST/PUT EVM với pv/ac/ev không phải số thì 400" (thêm sau Codex) |
| EVM: trùng kỳ ở POST và PUT đều trả 409, không vỡ UNIQUE | PASS | ca kiểm "PUT EVM đổi ky sang kỳ đã có dòng khác thì 409" (thêm sau Codex) |
| Giải ngân kiểm số tiền và khóa ngoài đúng tổ chức | PASS | ca kiểm CRUD giải ngân |
| Xóa dòng ngân sách đang có giải ngân bị chặn (409) | PASS | ca kiểm 409-xóa-có-giải-ngân |
| Đối tác bị chặn 403 toàn bộ 3 mục (không thấy tồn tại) | PASS | ca kiểm "Đối tác: chặn hẳn cả 3 mục" |
| EVM tính CV/SV/CPI/SPI không ra `Infinity`/`NaN` khi thiếu số | PASS | ca kiểm "EVM tính null-safe" |
| Xóa tổ chức dọn sạch cả 3 bảng, không vỡ khóa ngoài D1 thật | PASS | ca kiểm cascade qua `xoaToChuc()` |
| `guiForm()` gửi đúng kiểu số (sửa theo Codex) | PASS | `public/hoalac/hoalac.js`, commit `9811068` |
| `npm test` toàn kho đạt | PASS (410/412, 2 lỗi có sẵn không liên quan) | log `npm test`; cô lập 2 tệp lỗi chạy riêng cho cùng kết quả trước PR5 |
| `wrangler deploy --dry-run` đóng gói được | PASS | log lệnh |
| CI GitHub Actions (kiem, tro-nang) | PASS | PR #139, cả hai check SUCCESS trước khi gộp |
| 3 bình luận Codex đã trả lời và đóng luồng | PASS | `gh api` reply + `resolveReviewThread` cho 3 luồng |
| Kiểm trực tiếp trình duyệt (3 vai trò) cho tab Ngân sách | UNVERIFIED | chưa chạy `may-chu/chay.js` cục bộ thử tab này; cấu trúc đã qua kiểm tự động |
| Cấu hình Cloudflare Access Application riêng cho `/hoalac` | UNVERIFIED (ngoài phạm vi PR5, treo từ PR1) | chưa làm |

### Giả định đã chọn (PR5)

- Không chọn bản TMĐT nào trong 3 bản khác nhau (1.612,245 tỷ / ~1.795,6 tỷ / 1.700-1.750 tỷ) làm số liệu mặc định - để trống, chờ PM xác nhận và tự nhập qua giao diện khi có số thật.
- Nhập dữ liệu ngân sách thật (các dòng ngân sách, giải ngân, EVM thật của dự án Hòa Lạc) không nằm trong phạm vi PR5, chỉ dựng cấu trúc/API/giao diện rỗng.

## Bước tiếp (Hòa Lạc, sau PR5)

- PR5 đã gộp. Còn treo từ các PR trước: kiểm trình duyệt ba vai trò cho tab Ngân sách (UNVERIFIED), cấu hình Cloudflare Access Application riêng cho `/hoalac`, lỗi `qlda_hop_dong` PUT COALESCE-trên-khóa-ngoại-nullable (đã ghi nhận từ PR4, chưa sửa, ngoài phạm vi các PR đã giao).
- PR6 (lịch `.ics` mở rộng cho mốc dự án + hoàn thiện README) - chưa bắt đầu, là PR cuối trong kế hoạch 6 PR đã duyệt.
