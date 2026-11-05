#!/usr/bin/env python3
# Chỉ đọc. Chạy trên VPS: python3 dem-tin-goc.py ~/apps/sonicplan/du-lieu/sonicplan.sqlite
# Đếm số việc mà cách lấy bối cảnh CŨ (40 tin sớm nhất trong cửa sổ 6 ngày) làm mất tin gốc. Chỉ in số đếm, không in nội dung.
import sqlite3, sys
c = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
sql = """
WITH goc AS (
  SELECT v.id vid, g.* FROM viec v JOIN tin_nhan g ON g.id = v.tin_nhan_id AND g.to_chuc_id = v.to_chuc_id
),
cs AS (
  SELECT goc.vid, goc.id gid, goc.thoi_diem t0, t.id tid, t.thoi_diem tt
  FROM goc JOIN tin_nhan t ON t.to_chuc_id = goc.to_chuc_id AND t.nguon = goc.nguon
   AND t.thoi_diem BETWEEN datetime(goc.thoi_diem,'-3 days') AND datetime(goc.thoi_diem,'+3 days')
   AND ((goc.ma_hoi_thoai IS NOT NULL AND t.ma_hoi_thoai = goc.ma_hoi_thoai)
     OR (goc.ma_hoi_thoai IS NULL AND goc.nhom IS NOT NULL AND t.nhom = goc.nhom)
     OR (goc.ma_hoi_thoai IS NULL AND goc.nhom IS NULL AND goc.tieu_de IS NOT NULL AND t.tieu_de = goc.tieu_de)
     OR (goc.ma_hoi_thoai IS NULL AND goc.nhom IS NULL AND goc.tieu_de IS NULL AND t.nguoi_gui = goc.nguoi_gui))
),
xep AS (SELECT vid, gid, tid, ROW_NUMBER() OVER (PARTITION BY vid ORDER BY tt, tid) rn, COUNT(*) OVER (PARTITION BY vid) tong FROM cs)
SELECT COUNT(DISTINCT vid) viec_co_tin_goc,
       COUNT(DISTINCT CASE WHEN tong > 40 THEN vid END) viec_cua_so_dai_hon_40,
       COUNT(DISTINCT CASE WHEN tong > 40 AND tid = gid AND rn > 40 THEN vid END) viec_mat_tin_goc
FROM xep
"""
print(c.execute(sql).fetchone())
