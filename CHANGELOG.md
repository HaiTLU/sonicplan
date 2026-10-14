# Nhật ký thay đổi

Ghi theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [SemVer](https://semver.org/lang/vi/): số giữa tăng khi thêm tính năng, số cuối tăng khi sửa lỗi.

## [1.9.0] - 2026-10-14

### Thêm
- Khối "Đề xuất giao Claude" ở Tổng quan: việc AI xếp nhóm Claude tự làm được, chưa giao lượt nào. Mỗi việc có nút "Giao Claude" (mở khung giao như trên thẻ việc) và "Để tôi làm" (bỏ khỏi đề xuất, hoàn tác được). Claude chỉ làm khi bạn bấm, thay cho khâu tự đẩy việc sang GitHub đã tắt ở bản 1.8.1.

## [1.8.4] - 2026-10-14

### Đổi
- AI tách việc đọc từng cuộc trò chuyện riêng (mỗi lượt tối đa 6 cuộc, mỗi cuộc 20 tin), không trộn 20 tin của nhiều người vào một lượt nữa, nên không còn lẫn "anh" của người này với người kia. Phần "tin trước đó" lấy đúng cuộc trò chuyện đó, gồm cả tin anh gửi.

## [1.8.3] - 2026-10-14

### Đổi
- Dọn cuối ngày đếm số lần tự dời của mỗi việc. Thẻ việc hiện "Dời N lần" (rê chuột thấy hạn gốc), từ 3 lần thì chữ đỏ. Bản tin 8h có mục "Đã tự dời từ 3 lần, nên xem lại". Anh tự đặt hạn mới thì số đếm về 0.

## [1.8.2] - 2026-10-14

### Đổi
- Ưu tiên tự cập nhật theo hạn: lúc 23h, việc có hạn đến hết ngày mai được nâng lên "cao". Chỉ nâng, không hạ.
- Chống trùng rộng hơn: so với việc đang mở trong 60 ngày (trước là 14) và việc vừa xong 3 ngày, nên tin nhắc lại việc vừa làm không tạo việc mới. Hai việc cùng một cuộc trò chuyện dùng ngưỡng giống 65% thay vì 80%.

## [1.8.1] - 2026-10-14

### Sửa
- Dời hạn (dọn cuối ngày lúc 23h, nút "Dời mai", "Dời tuần sau" trên Telegram) nay dời luôn ngày bên Google Tasks và Lịch; trước đây hai bên lệch ngày.
- Việc bị dọn cuối ngày dời sang mai được nhắc lại đúng giờ hẹn; trước đây việc đã nhắc một lần thì không bao giờ nhắc nữa.
- Tin sau đổi hạn hoặc giờ của một việc đã có ("dời sang thứ 6", "chuyển 15h") thì việc cũ nhận hạn mới, có dòng "Đổi hạn" trong lịch sử; trước đây hạn mới bị bỏ.
- Mỗi việc mới chỉ còn một tin Telegram (tin "Báo việc mới" mang luôn nhóm và bước tiếp); trước đây tác vụ gợi ý nhắn thêm tin "Việc mới" thứ hai.
- Khâu "Giao việc cho Claude qua GitHub" tắt sẵn: khâu này tự tạo issue cho mọi việc AI xếp nhóm "AI tự làm" mà chưa ai duyệt. Giao Claude dùng nút "Giao Claude" trên thẻ việc; ai muốn bật lại thì bật ở trang Luồng.
- Chưa nối AI thì báo rõ "Chưa nối AI" thay vì lỗi khó hiểu.

## [1.8.0] - 2026-10-14

### Thêm
- Trang Claude: khi Claude cần hỏi lại, câu hỏi hiện thành thẻ có nút lựa chọn để bấm (một câu một lựa chọn thì bấm là gửi ngay), có ô gõ câu trả lời khác và nút "Bỏ qua, để Claude tự quyết". Phiên đang chờ có nhãn "chờ bạn" ở cột trái.
- Lệnh máy (Bash) và công cụ ngoài danh sách tự cho phép: trang hiện thẻ "Claude xin phép" kèm nguyên lệnh, bấm "Cho phép" hoặc "Không". Chế độ lập kế hoạch: kế hoạch hiện nguyên văn với nút "Duyệt, làm theo" hoặc "Chưa, sửa lại". Lệnh chỉ đọc (như `ls`, `date`) Claude Code tự chạy, không hỏi.
- Không ai trả lời sau 30 phút thì trạm báo Claude "không được phép" để lượt không treo; bấm Dừng cũng hủy mọi câu đang chờ. Câu hỏi và câu trả lời lưu trong lịch sử phiên.
- Trạm lên bản 1.2.0 (tự cập nhật khi khởi động lại).

## [1.7.0] - 2026-10-14

### Thêm
- Bộ nhớ dự án cho trang Claude: chọn dự án thì trạm đọc `memory.md` trong thư mục dự án (`~/Sonicplan Claude/<dự án>/memory.md`) và đưa vào lời dặn của Claude; khung chat hiện dòng "Đã nạp bộ nhớ dự án ...".
- Chu kỳ ghi nhớ: sau mỗi lượt thành công, một lượt Sonnet riêng ghi tối đa 3 ý vào hàng chờ (`_bo-nho/hang-cho.md`); mỗi đêm sau 23 giờ (giờ Việt Nam), hoặc khi hàng chờ đủ 30 ý, hoặc khi ý chờ quá 30 giờ, một lượt Sonnet gộp hàng chờ vào `memory.md` theo 5 mục cố định, tối đa 12.000 ký tự. Bản gộp phải qua kiểm khung; không đạt thì giữ bản cũ. Bản cũ chép vào `_bo-nho/lich-su/` trước mỗi lần sửa.
- Nút "Bộ nhớ" cạnh ô Dự án: xem, sửa tay, lưu `memory.md`, bấm "Nhớ lại ngay" để gộp tức thì.
- Trạm tự cập nhật khi khởi động: tải bản mới từ Sonicplan, kiểm cú pháp, thay tệp rồi để launchd chạy lại; bản mới khởi động lỗi 3 lần thì tự quay về bản cũ và không tải lại bản hỏng. Trạm lên bản 1.1.0.

### Ghi chú nâng cấp
- Trạm đang chạy bản 1.0.0 chưa biết tự cập nhật: thay `~/.sonicplan-tram/tram-claude.mjs` bằng bản 1.1.0 một lần (hoặc cài lại bằng lệnh ở trang Claude), từ đó các bản sau tự cập nhật.

## [1.6.0] - 2026-10-13

### Thêm
- Trang Claude (mục Dự án): chat với Claude Code như trên máy. Chữ trả lời hiện dần, mỗi việc Claude làm hiện thành một dòng mở ra xem được, tệp Claude tạo hiện thành thẻ để xem hoặc tải, nút Dừng (hoặc Esc) để ngắt giữa chừng. Chọn dự án, model (Opus, Sonnet, Haiku, Fable), effort (thấp tới tối đa), chế độ tự sửa tệp hoặc chỉ lập kế hoạch. Đính kèm bằng nút kẹp giấy, kéo thả hoặc dán ảnh chụp màn hình. Danh sách phiên cũ ở cột trái, lượt sau Claude nhớ hội thoại trước.
- Trạm Claude trên máy Mac: chương trình chạy nền (launchd) gọi Claude Code bằng tài khoản đang đăng nhập trên máy, chỉ nối ra ngoài tới Sonicplan. Cài bằng một lệnh lấy ở trang Claude. Tệp Claude tạo nằm ở `~/Sonicplan Claude/<dự án>/Claude/`.
- Phòng chat là Durable Object `TramClaude` (không đọc ghi D1); trên máy chủ Node (`may-chu/`) phòng chạy ngay trong tiến trình, có WebSocket riêng.

## [1.3.0] - 2026-10-13

### Thêm
- Thư mục Drive cho từng dự án: link để bấm mở và đường dẫn trong Drive để máy chạy Claude chép kết quả vào. Cần chạy migration 0020 và cập nhật luồng trong kho làm việc trước khi triển khai.
- Nút "Spam" ở Hộp tin (PR #61): chặn nhóm Zalo, người gửi hoặc địa chỉ thư; tin của họ không hiện, không tách thành việc; mục "Đã chặn" để bỏ chặn.
- Nhật ký ai xem, tải dữ liệu ở trang Dữ liệu của bạn.
- Chủ tổ chức tự xóa cả tổ chức: hỏi hai lần, sao lưu trước, giữ bản sao 30 ngày.
- Kiểm tra trợ năng tự động bằng axe-core trong CI.

## [1.2.0] - 2026-10-13

### Đổi
- Gom 11 mục thành 4 mục chính: Hôm nay, Hộp tin, Dự án, Cài đặt; mỗi mục có thanh mục con dưới tiêu đề. Điện thoại có 4 nút ở đáy. Đường dẫn cũ vẫn mở được.
- Màu chữ phụ ở giao diện sáng đậm hơn để đủ tương phản 4.5:1 (WCAG 2.2 AA).

### Thêm
- Trang "Dữ liệu của bạn": lưu gì, ai xem, giữ bao lâu; nút tải toàn bộ dữ liệu dạng JSON.
- Chặn lệnh ghi gửi từ trang khác (chống giả mạo yêu cầu).
- Sao lưu hằng đêm có thêm dự án, lịch sử dự án, kết quả Claude.
- Bảng kiểm chuẩn quốc tế: `docs/CHUAN-QUOC-TE.md`.

## [1.1.0] - 2026-10-13

### Thêm
- Giao việc cho Claude Code: nút "Giao Claude" trong ngăn sửa việc, Claude chạy trên GitHub Actions của kho đã nối, kết quả (lời trả lời, tệp, PR, nhật ký) hiện ngay trong việc; duyệt bằng nút Đạt hoặc Làm lại; Telegram báo khi xong.
- Nút "Cài luồng Claude" ở trang Kết nối tự cài workflow vào kho.
- Kiểm tra tự động trên GitHub cho mọi PR (kiểm thử và đóng gói thử), Dependabot cập nhật thư viện hằng tuần.
- Tiêu đề bảo mật cho trang (CSP, HSTS, nosniff, chặn nhúng trang).

## [1.0.0] - 2026-10-12

Bản dùng thật đầu tiên trên plan.sonicrec.app: hộp tin Zalo và Gmail, AI tách việc, việc, dự án, ghi nhớ, tệp, luồng, đồng bộ Google, Telegram, hiệu suất và chế độ game.
