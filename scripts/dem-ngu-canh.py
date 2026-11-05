#!/usr/bin/env python3
# Chỉ đọc. Chạy trên VPS: python3 dem-ngu-canh.py <đường dẫn sonicplan.sqlite>
# Đếm mức ảnh hưởng của hai lỗi bối cảnh khi soạn prompt. Chỉ in số đếm, không in nội dung.
import sqlite3, sys
c = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
q = lambda s: c.execute(s).fetchall()

# 1) Prompt soạn cho NHIỀU việc: dự án bị ghi sai nếu các việc không cùng một dự án.
nhieu = 0; lech = 0; lech_khong_du_an = 0
for (ids,) in q("SELECT viec_ids FROM prompt_claude"):
    ds = [int(x) for x in ids.strip(',').split(',') if x]
    if len(ds) < 2: continue
    nhieu += 1
    cac = {r[0] for r in q(f"SELECT du_an_id FROM viec WHERE id IN ({','.join(map(str, ds))})")}
    if len(cac) > 1:
        lech += 1
        if None in cac: lech_khong_du_an += 1
print("prompt_nhieu_viec, khac_du_an_hoac_lan_viec_khong_du_an, trong_do_co_viec_khong_du_an:", nhieu, lech, lech_khong_du_an)

# 2) Ghi nhớ nạp cho prompt: mục chung (ghim, người, quyết định) nhiều hơn giới hạn 15 thì mục theo dự án bị đẩy ra (cách cũ).
chung = q("SELECT to_chuc_id, COUNT(*) FROM ghi_nho WHERE ghim = 1 OR loai IN ('nguoi','quyet_dinh') GROUP BY to_chuc_id")
print("to_chuc_co_muc_chung_hon_15 / tong_to_chuc:", sum(1 for _, n in chung if n > 15), len(chung))
bi_day = 0; co_muc_du_an = 0
for (tc, ten) in q("SELECT DISTINCT to_chuc_id, ten FROM du_an"):
    khop = c.execute("SELECT COUNT(*) FROM ghi_nho WHERE to_chuc_id = ? AND ghim = 0 AND loai NOT IN ('nguoi','quyet_dinh') AND tieu_de LIKE '%' || ? || '%'", (tc, ten)).fetchone()
    if khop[0] == 0: continue
    co_muc_du_an += 1
    chung_n = c.execute("SELECT COUNT(*) FROM ghi_nho WHERE to_chuc_id = ? AND (ghim = 1 OR loai IN ('nguoi','quyet_dinh'))", (tc,)).fetchone()[0]
    if chung_n >= 15: bi_day += 1
print("du_an_co_ghi_nho_theo_ten, trong_do_bi_day_ra_boi_muc_chung_cu:", co_muc_du_an, bi_day)
