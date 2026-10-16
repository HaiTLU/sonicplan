# Nhật ký thay đổi

Ghi theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [SemVer](https://semver.org/lang/vi/): số giữa tăng khi thêm tính năng, số cuối tăng khi sửa lỗi.

## [1.13.0] - 2026-10-16

### Đổi
- Trang Việc nhớ cách hiển thị trên trình duyệt: kiểu xem (Theo hạn, Theo dự án), Ẩn cột trống, Có sao và các bộ lọc Nguồn, Hạn, Độ nặng. Tab Đang mở/Đã xong và dự án đang chọn vẫn về mặc định mỗi lần mở để không ẩn nhầm việc.
- Mở Sonicplan (và bấm Hôm nay, logo) vào thẳng trang Việc thay vì Tổng quan. Tổng quan vẫn là thẻ đầu tiên của Hôm nay.
- Hộp tin Zalo: tin tệp của chat riêng nhập chung với cuộc trò chuyện của người gửi, hết hiện hai mục.

### Thêm
- Soạn và gửi tin Zalo ngay trong Sonicplan (chỉ chủ tổ chức): gõ chữ, chọn emoji, đính kèm ảnh và tệp bằng kẹp giấy, kéo thả hoặc dán ảnh, Enter gửi. Lệnh vào hàng đợi, chương trình Zalo trên Mac (chạy lại `cai-va.sh` để vá) lấy lệnh và gửi thật; lệnh chờ quá 3 phút thì bỏ, không gửi muộn; tối đa 20 lần mỗi 10 phút, 5 tệp mỗi lần. Chỉ tạo khi người dùng bấm gửi, thợ Claude và tác vụ hẹn giờ không tạo được. Cuộc trò chuyện chưa có mã Zalo thì giữ cách cũ (chép tin, mở Zalo). Migration 0031.
- Hộp tin Zalo hiện ảnh đại diện thật như Zalo: ảnh cuộc trò chuyện ở danh sách và đầu khung chat, ảnh từng người gửi trong nhóm. Chương trình Zalo trên Mac gửi kèm địa chỉ ảnh (chạy lại `cai-va.sh` để vá), Sonicplan tải về lưu ở kho tệp, chỉ nhận ảnh từ máy chủ Zalo, đổi ảnh trên Zalo thì ảnh được tải lại. Chưa có ảnh hoặc ảnh lỗi thì vẫn hiện chữ cái đầu như trước. Migration 0030.

## [1.12.0] - 2026-10-16

### Thêm
- Thợ Claude chạy ở máy riêng: việc AI xếp nhóm "Claude làm được" tự vào hàng đợi (2 việc cùng lúc, 10 việc tự chạy mỗi ngày, Sonnet 5.5 mức medium), chạy trong bản sao ThangLong_KB, kết quả lên nhánh `sonicplan/luot-N`, PR tự gộp, tệp chép sang Google Drive, báo bằng thông báo đẩy. Cầu dao khi hai lượt lỗi liền; khởi động lại thì lượt đang làm tự xếp lại hàng đợi. Claude chạy không có máy chủ MCP nào và không gửi được thư.
- Ghép dự án với thư mục `01_Projects` của ThangLong_KB (thẻ "Claude làm việc ở máy" ở trang Kết nối).
- Ghi nhớ trong Sonicplan tự xuất sang `memory/projects/Sonicplan_GhiNho.md` của KB mỗi đêm (nút đồng bộ ngay); trạm Claude 1.3.0 nạp thêm bộ nhớ ThangLong_KB (chỉ đọc) vào lời dặn.
- Nút đổi sáng tối ở đầu trang, nhớ lựa chọn.
- Trang Hiệu suất: bảng "AI tách việc đúng đến đâu" tự đo từ việc bạn hủy, đổi nhóm, đổi dự án, sửa hạn và từ nút Đạt của Claude (5 chỉ số, có mục tiêu). Mỗi sáng thứ Hai Claude rà 30 tin mẫu (cả tin không sinh việc), báo cáo và 3 đề xuất sửa lời nhắc vào ThangLong_KB, báo bằng thông báo đẩy; nút "Rà soát tách việc ngay".
- Ghi nhớ hai chiều với ThangLong_KB: điều PM hay Claude thêm hoặc sửa trong `memory/projects/Sonicplan_GhiNho.md` được nhận về Sonicplan mỗi đêm (hợp nhất ba bên, Sonicplan thắng khi cùng sửa, không xóa vì file thiếu, mục nhạy cảm bị chặn).
- Dự án chưa khớp thư mục KB: khớp tên với thư mục có sẵn, dự án thật không khớp thì tạo `01_Projects/<Tên>`, nhóm chung (Khác, Cá nhân) vào `_INBOX/Sonicplan`.
- Nháp Gmail: Claude ghi `ket-qua/nhap-email.json`, hệ thống tạo bản nháp trong Thư nháp (đúng luồng thư gốc, gửi cho người viết thư). Cần đăng nhập lại Google và tick quyền soạn thư. Chỉ tạo nháp, không có mã gửi (có test quét mã).
- Ghi sự kiện khi người dùng đổi nhóm, đổi tên, sửa hạn việc (dữ liệu đo chất lượng tách việc).

### Thay đổi
- Lời nhắc AI tách việc thêm 3 quy tắc theo báo cáo rà soát đầu tiên (PM duyệt 16/10/2026): chỉ tách khi tin đặt việc lên người dùng, tên việc có động từ và đối tượng, có dấu, sửa lỗi gõ, bắt buộc tách khi tin gọi đích danh họ.
- `src/api.js` tách thành 10 nhóm trong `src/api/`, `public/app.js` tách thành 11 mô-đun trong `public/trang/`.
- Chữ nhỏ dưới 12px nâng lên; bố cục điện thoại gọn hơn (tab con, Kết nối, bộ lọc Việc, Tổng quan).

### Bảo mật
- Chặn SSRF cho webhook và địa chỉ AI, giới hạn tần suất `/nhan/*`, kiểm vai trò chủ, CSP cho bản Node, xoay khóa mã hóa (`may-chu/xoay-khoa.js`).

## [1.11.0] - 2026-10-15

### Thêm
- Thông báo trên web. Chuông ở thanh trên có số chưa đọc; bấm vào ra danh sách, bấm từng dòng mở thẳng việc đó (hoặc trang Claude), tự đánh dấu đã đọc. Trang đang mở thì chuông tự làm mới mỗi 30 giây và ngay khi có thông báo đẩy.
- Thông báo đẩy của trình duyệt (Web Push, mã hóa theo RFC 8291, khóa VAPID tạo và lưu mã hóa trên máy chủ): hiện cả khi đã đóng trang, trên máy tính và điện thoại (iPhone cần "Thêm vào màn hình chính"). Bật ở Cài đặt, thẻ "Thông báo trên trình duyệt", nút "Bật thông báo" và "Gửi thử".
- Báo bốn loại, mỗi loại một công tắc: việc mới AI tách từ Hộp tin (Zalo, Gmail, họp, dịch vụ ngoài), việc đổi hạn theo tin mới, việc tới giờ hẹn, Claude hỏi lại hoặc làm xong (cả lượt Giao Claude và trang Claude). Trong giờ yên lặng chỉ ghi vào chuông, không đẩy. Telegram giữ nguyên.
- Liên kết `#viec/<mã>` mở thẳng ngăn việc. API `GET /api/viec/<mã>`.

## [1.10.1] - 2026-10-15

### Sửa
- Bản tin sáng không còn cụt ở mục "Kế hoạch hôm nay". AI trả lời bị cắt vì hết token thì Sonicplan hỏi lại một lần với giới hạn gấp đôi, vẫn cắt thì báo lỗi thay vì gửi nửa câu. Dòng tiêu đề treo ở cuối (như "- Làm trước:") bị bỏ. Áp cho mọi lượt gọi AI, nên lỗi "AI không trả kết quả chấm đọc được" do JSON bị cắt cũng hết.
- Bản Worker cũ trên Cloudflare thôi chạy tác vụ hẹn giờ. Nó vẫn được tự triển khai từ main và chạy song song với Mac mini trên D1 cũ, nên gửi tin Telegram trùng: lỗi "D1_ERROR: no such column: so_lan_doi" lúc 8h ngày 15/10 và lỗi Google 401 mỗi 5 phút là của bản này. Muốn bật lại thì đặt biến CHAY_TREN_CF = "1".
- Máy chủ trên Mac tự áp migration còn thiếu mỗi lần khởi động, để mã mới không chạy trước cơ sở dữ liệu.
- Khối "việc dời nhiều lần" lỗi thì bỏ khối đó, bản tin vẫn gửi.
- "Lưu ý từ tin mới" chỉ nêu điều cần làm hoặc cần biết để hành động, không giải thích vì sao không tạo việc.

## [1.10.0] - 2026-10-14

### Thêm
- Khối "Đề xuất giao Claude" ở Tổng quan: việc AI xếp nhóm Claude tự làm được, chưa giao lượt nào. Mỗi việc có nút "Giao Claude" (mở khung giao như trên thẻ việc) và "Để tôi làm" (bỏ khỏi đề xuất, hoàn tác được). Claude chỉ làm khi bạn bấm, thay cho khâu tự đẩy việc sang GitHub đã tắt ở bản 1.8.1.

## [1.9.0] - 2026-10-14

### Thêm
- Chuyển tay tin Zalo anh gửi mà máy chủ không đoán được gửi cho ai (còn nằm ở mục "Nam Hai"): bấm giữ hoặc bấm chuột phải vào tin, chọn người nhận. Chuyển được cả cụm tin liền nhau hoặc một tin. Chỉ đụng tin anh gửi chưa có mã hội thoại, không đụng tin nhóm hay tin đã xếp.

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
