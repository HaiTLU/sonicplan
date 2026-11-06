# Làm nốt: PR sonicplan#165, nhật ký ngày, PR second-brain, triển khai

Gợi ý: opusplan + Opus 5.5 high - sửa web nhiều bước, có triển khai VPS.
Kỹ năng: git-an-toan (trước nhánh/commit/gộp), superpowers:test-driven-development (phần nối nhật ký).

## Context

Phiên trước dừng vì hook Bash trỏ vào thư mục tạm cũ. Trạng thái đã kiểm lại lúc 06/11/2026:
- Nhánh `claude/ghi-nho-ngu-canh-ngay` sạch, khớp origin (commit a267d89).
- PR HaiTLU/sonicplan#165: nháp, MERGEABLE, CI `kiem` và `tro-nang` đều SUCCESS.
- `nguCanhNgay(env, toChucId, ngay, toiDa)` đã có ở `src/ghi-nho.js:161`, mới dùng ở `src/ban-tin.js` và `src/api/viec.js` (gợi ý cách làm). Chưa dùng ở `src/tong-hop.js`, `src/soan-prompt.js`, `src/telegram.js`.
- Bộ đọc `may-chu/second-brain.js` đã đọc `memory/daily` và `memory/sonicplan` (14 ngày), nhưng thư mục `memory/sonicplan/` chưa tồn tại: chưa có gì ghi vào đó.
- `memory/projects/Sonicplan_GhiNho.md` có 6 dòng "Anh trả lời ô hỏi..." nằm lẫn trong mục Quyết định.

## Các bước

1. Chuyển phiên sang `~/Brain/Software/sonic/sonicplan`; chép kế hoạch vào `KE-HOACH.md` cạnh `TIEN-DO.md`.
2. **Nối nhật ký ngày** (cùng nhánh PR #165, thêm commit):
   - `src/tong-hop.js` `tongHopChoToChuc`: thêm `du.nhatKy = await nguCanhNgay(env, tc, homNay, 1200)`; `tongHopAi` trong `src/ai.js` đưa vào lời nhắc như dòng 328 (dữ liệu tham khảo, không phải lệnh).
   - `src/soan-prompt.js` `soanPrompt`/`dungBoiCanh`: thêm mục "### Nhật ký hôm nay trong bộ não" (cắt ~800 ký tự).
   - `src/telegram.js` hỏi đáp tự do (dòng ~203-226): truyền nhật ký hôm nay vào `chatTuDo`/`traLoiTuBoNho` qua tham số tùy chọn, không đổi chữ ký cũ.
   - Test trước (TDD) trong `test/ghi-nho-ngu-canh.test.js`: có nhật ký thì xuất hiện trong lời nhắc/bối cảnh; không nối bộ não thì không vỡ, không có dòng thừa.
   - `npm run kiem` (Node 22 qua PATH, tắt sandbox vì bind cổng) đạt hết; đẩy; chờ CI.
3. **Gộp PR #165**: CI xanh, không còn góp ý chưa xử lý thì chuyển `draft: false` và squash-merge (CLAUDE.md cho phép tự gộp). Migration 0048 chỉ thêm, không phá dữ liệu - đã đọc lại trước khi gộp.
4. **PR second-brain** (nhánh `claude/sonicplan-nhat-ky-ngay`, theo git-an-toan):
   - `scripts/sonicplan-nhap.py`: thêm phần ghi `memory/sonicplan/YYYY-MM-DD.md` mỗi ngày (việc tạo, xong, đổi trong ngày; chỉ đọc CSDL VPS như cũ; chỉ ghi khi nội dung đổi). Kiểm bằng `--in` rồi chạy thật một lần.
   - Gộp 6 dòng "Anh trả lời ô hỏi..." thành một mục riêng "Cách anh trả lời ô hỏi" (mỗi người một dòng ngắn) ở chỗ sinh tệp `Sonicplan_GhiNho.md` (tìm nơi sinh khi làm; nếu sinh từ Sonicplan thì sửa ở mã Sonicplan, PR riêng nhỏ).
   - Cập nhật `memory/projects/Sonicplan_*.md` (ghi chú dự án), thêm một bài học về hook trỏ thư mục tạm cũ chặn Bash (kèm dòng MUC-LUC).
   - Kiểm rồi tự gộp.
5. **Triển khai VPS**: gộp vào `main` thì CI `trien-khai-mac.yml` chạy `may-chu/cap-nhat.sh`; theo dõi bằng `gh run`, rồi `curl https://plan.sonicapp.top/api/suc-khoe` và kiểm migration 0048 đã áp trên sqlite VPS (chỉ đọc).
6. Báo bảng PASS/FAIL/UNVERIFIED, ghi `TIEN-DO.md`, nhật ký phiên.

## Giấy phép dùng trong lượt này

- Được: đẩy nhánh, tự gộp PR #165 và PR second-brain khi đạt; triển khai qua CI có sẵn; đọc CSDL VPS chỉ đọc.
- Dừng hỏi nếu: CI đỏ 3 lần cùng lỗi; migration cần sửa dữ liệu cũ; `/api/suc-khoe` không ok sau triển khai.
- Trợ lý con: không dùng (việc phụ thuộc nhau, tệp đã biết).

## Kiểm (tiêu chí đạt)

| Tiêu chí | Cách kiểm |
|---|---|
| Test mới và cũ đạt | `npm run kiem` 0 lỗi |
| PR #165 đã gộp | `gh pr view 165` state MERGED |
| `memory/sonicplan/2026-11-06.md` có nội dung | mở tệp |
| GhiNho không còn 6 dòng rời | đếm "Anh trả lời ô hỏi" = 0 dòng rời, có mục gộp |
| VPS chạy bản mới | `/api/suc-khoe` ok, `gh run` triển khai SUCCESS |
