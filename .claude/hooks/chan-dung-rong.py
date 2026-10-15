#!/usr/bin/env python3
"""Chặn lệnh dừng tiến trình theo tên (pkill, killall) có thể giết cả máy chủ Sonicplan đang chạy thật.

Đã lặp hai lần (14/10 và 15/10/2026): pkill -f "may-chu/chay.js" để dọn máy chủ thử cũng tắt luôn máy chủ thật,
launchd khởi động lại và làm các lượt Claude đang chạy bị bỏ dở. Máy chủ thử phải ghi PID khi bật và dừng bằng đúng PID đó.
Đọc JSON của hook từ stdin; thoát mã 2 kèm lời giải thích để Claude làm lại cách đúng.
"""
import json
import re
import sys

MAU = [
    (r"\bpkill\b[^|;&\n]*(may-chu|chay\.js|sonicplan|node\b)", "pkill theo tên có thể giết cả máy chủ Sonicplan đang chạy thật"),
    (r"\bkillall\b[^|;&\n]*\b(node|Google Chrome|claude)\b", "killall theo tên có thể giết cả dịch vụ thật hoặc phiên khác"),
    (r"\bpkill\s+-f\s+['\"]?\w+['\"]?\s*($|[;&|])", "pkill -f với một từ ngắn dễ khớp nhầm nhiều tiến trình"),
]

def main():
    try:
        du = json.load(sys.stdin)
    except Exception:
        return 0
    lenh = (du.get("tool_input") or {}).get("command", "") or ""
    for mau, ly_do in MAU:
        if re.search(mau, lenh):
            sys.stderr.write(
                f"Bị chặn: {ly_do}.\n"
                "Cách đúng: bật tiến trình thử và ghi PID (cmd & echo $! > tep.pid), rồi dừng bằng kill $(cat tep.pid). "
                "Cần dừng Chrome thử thì khớp theo cờ riêng như remote-debugging-port=9333, không theo tên chung. "
                "Máy chủ thật chạy dưới launchd (app.sonicrec.sonicplan): không dừng trừ khi PM bảo.\n"
            )
            return 2
    return 0

sys.exit(main())
