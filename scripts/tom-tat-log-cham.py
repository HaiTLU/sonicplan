#!/usr/bin/env python3
"""Tóm tắt log "Yêu cầu chậm" của máy chủ Sonicplan: chỉ in số lần, trung vị, p95, lớn nhất theo từng đường dẫn.
Chỉ đọc log, không in nội dung nào khác ngoài các dòng khớp mẫu (đường dẫn đã rút gọn, không có mã bí mật).
Dùng: python3 scripts/tom-tat-log-cham.py [số giờ, mặc định 24]
Nguồn log thử lần lượt: journalctl --user (SONICPLAN_LAUNCHD hoặc vn.sonicplan.may-chu), journalctl hệ thống, tệp *.log trong thư mục cài."""
import glob, os, re, subprocess, sys
from collections import defaultdict

gio = int(sys.argv[1]) if len(sys.argv) > 1 else 24
don_vi = os.environ.get("SONICPLAN_LAUNCHD") or "vn.sonicplan.may-chu"
thu_muc = os.environ.get("SONICPLAN_DIR") or os.path.expanduser("~/apps/sonicplan")
MAU = re.compile(r"Yêu cầu chậm (\d+)ms (\w+) (\S+) -> (\d{3})")

def chay(lenh):
    try:
        r = subprocess.run(lenh, capture_output=True, text=True, timeout=60)
        return r.stdout if r.returncode == 0 else None
    except Exception:
        return None

nguon, van_ban = None, None
for ten, lenh in [
    ("journalctl --user", ["journalctl", "--user", "-u", f"{don_vi}.service", "--since", f"{gio} hours ago", "--no-pager", "-o", "cat"]),
    ("journalctl", ["journalctl", "-u", f"{don_vi}.service", "--since", f"{gio} hours ago", "--no-pager", "-o", "cat"]),
]:
    out = chay(lenh)
    if out and MAU.search(out):
        nguon, van_ban = ten, out
        break
if van_ban is None:
    tong = []
    for tep in glob.glob(os.path.join(thu_muc, "**", "*.log"), recursive=True) + glob.glob(os.path.expanduser("~/Library/Logs/*sonicplan*/*")):
        try:
            tong.append(open(tep, encoding="utf-8", errors="replace").read())
        except Exception:
            pass
    if tong and MAU.search("\n".join(tong)):
        nguon, van_ban = "tệp log (không lọc theo giờ)", "\n".join(tong)

if van_ban is None:
    print(f"Không thấy dòng 'Yêu cầu chậm' nào trong {gio} giờ qua (hoặc không đọc được log). Có thể app chưa có yêu cầu nào từ 300 ms, hoặc bản có đo thời gian chưa chạy, hoặc log nằm ở nơi khác.")
    sys.exit(0)

theo = defaultdict(list)
for ms, pt, dd, tt in MAU.findall(van_ban):
    theo[f"{pt} {dd}"].append(int(ms))

def phan_vi(ds, p):
    ds = sorted(ds)
    return ds[min(len(ds) - 1, int(round(p * (len(ds) - 1))))]

print(f"Nguồn log: {nguon}; cửa sổ: {gio} giờ; tổng {sum(len(v) for v in theo.values())} yêu cầu chậm (từ 300 ms).")
print(f"{'đường dẫn':40} {'số lần':>7} {'trung vị':>9} {'p95':>6} {'lớn nhất':>9}  (ms)")
for k, v in sorted(theo.items(), key=lambda kv: -sum(kv[1]))[:20]:
    print(f"{k[:40]:40} {len(v):>7} {phan_vi(v, .5):>9} {phan_vi(v, .95):>6} {max(v):>9}")
