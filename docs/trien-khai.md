# Triển khai, sao lưu và quay lại bản cũ

Cập nhật: 22/11/2026.

## Lên bản

Gộp PR vào `main` là triển khai: luồng `.github/workflows/trien-khai-mac.yml` chạy `may-chu/cap-nhat.sh` trên máy nhận việc (kéo `main`, `node may-chu/migrate.js`, khởi động lại dịch vụ, kiểm tra sống). Nếu luồng không có máy nhận việc, chạy tay trên VPS:

```bash
cd ~/apps/sonicplan && SONICPLAN_DIR=~/apps/sonicplan bash may-chu/cap-nhat.sh
```

## Sao lưu trước khi gộp (bắt buộc khi có migration)

```bash
cd ~/apps/sonicplan && sqlite3 du-lieu/sonicplan.sqlite "VACUUM INTO 'du-lieu/sonicplan.sqlite.truoc-<viec>-<YYMMDD>'"
```

Sau khi áp, kiểm cấu trúc bằng `pragma_table_info`, không chạy `wrangler d1 migrations apply` cả chuỗi:

```bash
sqlite3 du-lieu/sonicplan.sqlite "SELECT name, dflt_value FROM pragma_table_info('viec') WHERE name = 'tien_do'"
```

## Quay lại bản cũ (rollback)

1. Mã: `git revert` commit gộp trên `main` rồi để luồng triển khai chạy lại (hoặc chạy tay `cap-nhat.sh`).
2. Migration chỉ cộng cột (như 0056) không cần gỡ: mã cũ bỏ qua cột thừa.
3. Dữ liệu hỏng: dừng dịch vụ, chép bản sao lưu `sonicplan.sqlite.truoc-...` đè lên `sonicplan.sqlite`, khởi động lại.
