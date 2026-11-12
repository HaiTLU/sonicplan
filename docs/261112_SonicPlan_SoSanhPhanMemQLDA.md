# So sánh phần mềm quản lý dự án cho khu "Dự án" của Sonicplan

Ngày tra: 12/11/2026. Ba trợ lý tra trang chính thức của hãng, mỗi trợ lý 2-3 phần mềm. Điểm 1-5 là nhận định dựa trên mô tả tính năng trong nguồn, không phải số đo chính thức. Mục nào không có nguồn ghi UNVERIFIED.

## Tiêu chí và trọng số

Trọng số theo bốn việc khó PM nêu ngày 12/11/2026.

| Viết tắt | Tiêu chí | Trọng số |
|---|---|---|
| TĐ | Tiến độ, mốc, Gantt | 25% |
| BC | Báo cáo, bảng tổng hợp cho lãnh đạo | 20% |
| HS | Hồ sơ, phiên bản, phê duyệt | 20% |
| HĐ | Hợp đồng, thanh toán | 15% |
| DD | Dễ dùng với nhóm nhỏ | 10% |
| VN | Hợp Việt Nam (tiếng Việt, chuẩn ĐHTL) | 10% |

## Bảng điểm đã kiểm

| Phần mềm | TĐ | BC | HS | HĐ | DD | VN | Tổng /5 | Bảng sơ bộ |
|---|---|---|---|---|---|---|---|---|
| Procore | 4 | 4 | 4 | 3 | 3 | 1 | 3,45 | 3,9 |
| Asana | 4 | 5 | 3 | 2 | 4 | 1 | 3,40 | 2,9 |
| Autodesk Build (Forma Build) | 4 | 3 | 4 | 4 | 3 | 1 | 3,40 | 3,8 |
| MS Project (nay là Planner) | 5 | 4 | 2 | 2 | 3 | 2 | 3,25 | 2,9 |
| Monday | 4 | 4 | 2 | 2 | 5 | 1 | 3,10 | 3,3 |
| ClickUp | 4 | 4 | 3 | 2 | 3 | 1 | 3,10 | 3,3 |
| Primavera P6 | 5 | 3 | 2 | 3 | 2 | 1 | 3,00 | 2,9 |
| Sonicplan `/hoalac` hiện tại | 4 | 1 | 2 | 2 | 2 | 5 | 2,60 | 2,8 (cộng sai) |
| Trello | 2 | 3 | 1 | 1 | 5 | 3 | 2,25 | 2,2 |

Phép tính: Tổng = 0,25 x TĐ + 0,2 x BC + 0,2 x HS + 0,15 x HĐ + 0,1 x DD + 0,1 x VN.

Thay đổi so với bảng sơ bộ:

- Không phần mềm nước ngoài nào có bằng chứng giao diện web tiếng Việt, nên VN của Monday, ClickUp, Asana hạ từ 3 xuống 1. Trello có tiếng Việt trên ứng dụng iOS.
- Procore và Autodesk hạ HS, HĐ vì chưa tìm được nguồn về phê duyệt nhiều bước và đợt thanh toán.
- Asana tăng mạnh nhờ cập nhật trạng thái portfolio có sẵn các mức đúng tiến độ, có rủi ro, chậm.
- Microsoft đã ngừng Project for the web từ 8/2025 và chuyển vào Planner; Project Online ngừng 30/9/2026.
- Bảng sơ bộ cộng sai điểm Sonicplan (2,8); đúng là 2,6.

## Lấy gì về Sonicplan

| Học từ | Thứ lấy về | Đưa vào đợt |
|---|---|---|
| Asana | Cập nhật trạng thái tuần: chọn mức xanh, vàng, đỏ, viết một đoạn tóm tắt, gắn vào trang tổng hợp | Đợt 1 |
| Monday, Asana | Trang danh mục: mỗi dự án một dòng hoặc thẻ, có trạng thái, % tiến độ, người phụ trách | Đợt 1 |
| Procore | Bảng sức khỏe nhiều dự án kèm số tài chính | Đợt 1 (phần tiến độ), Đợt 2 (phần tiền) |
| MS Project, P6 | Gantt có phụ thuộc, đường găng, so với baseline (đã có trong `qlda_*`) | Đã có |
| Procore | Báo cáo nhìn trước vài tuần (look-ahead) cho người làm hằng ngày | Đợt 1, tin nhắc Telegram |
| Autodesk Build | Ngân sách, dự báo, đợt thanh toán gắn hợp đồng | Đợt 2 |
| Procore, Autodesk | Kho hồ sơ có phiên bản | Đợt 2 |
| Trello | Thẻ kéo thả cho việc hằng ngày (đã có tab Kanban) | Đã có |

Giữ điểm riêng của Sonicplan: tiếng Việt, AI tách việc từ tin nhắn, Telegram, chuẩn ĐHTL.

## Giá tham khảo (năm 2026, mỗi người mỗi tháng, trả theo năm)

| Phần mềm | Giá | Nguồn |
|---|---|---|
| Monday | Basic 9 USD, Standard 12 USD, Pro 19 USD, tối thiểu 3 ghế | monday.com/pricing |
| ClickUp | Core 9 USD, Business 17 USD | clickup.com/pricing |
| Asana | Starter 10,99 USD, Advanced 24,99 USD | asana.com/pricing |
| Planner | Plan 1: 10 USD, Plan 3: 30 USD | microsoft.com, trang giá Planner |
| Trello | Standard 5 USD, Premium 10 USD | trello.com/pricing |
| Autodesk Forma Build | Khoảng 117 USD; Essentials khoảng 67 USD (hai nguồn của hãng lệch nhau, UNVERIFIED) | autodesk.com |
| Procore, Primavera P6 | Không công bố, phải hỏi hãng (UNVERIFIED) | procore.com, oracle.com |

## Nguồn chính

- https://www.procore.com/project-management
- https://support.procore.com/faq/what-languages-are-available-in-procore
- https://www.autodesk.com/blogs/construction/forma-build-essentials-or-forma-build-comparison/
- https://help.autodesk.com/cloudhelp/ENU/Docs-About-ACC/files/Supported_Languages.html
- https://www.oracle.com/construction-engineering/primavera-p6/
- https://support.monday.com/hc/en-us/articles/360003503760
- https://monday.com/pricing
- https://clickup.com/pricing
- https://asana.com/features/goals-reporting/portfolios
- https://developers.asana.com/reference/status-updates
- https://asana.com/pricing
- https://support.microsoft.com/en-us/planner/frequently-asked-questions-about-microsoft-planner
- https://techcommunity.microsoft.com/blog/plannerblog/transitioning-to-microsoft-planner-and-retiring-microsoft-project-for-the-web/4410149
- https://trello.com/pricing
- https://support.atlassian.com/trello/docs/timeline-view/

## Chưa kiểm được

- Giao diện thật của Autodesk Build và Primavera P6: trang hãng trả lỗi 403 hoặc chuyển hướng (UNVERIFIED).
- Phê duyệt tài liệu nhiều bước và đợt thanh toán ở Procore: chưa có nguồn (UNVERIFIED).
- Điểm DD (dễ dùng) của mọi phần mềm là nhận định, chưa có số đo.
