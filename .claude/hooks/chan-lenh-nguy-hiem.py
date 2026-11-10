#!/usr/bin/env python3
"""Hook PreToolUse (Bash): chặn lệnh nguy hiểm trước khi chạy.

Luật nằm trong luat.json cạnh tệp này (sinh từ harness.json). Lỗi đọc dữ liệu thì cho qua
(fail open) để hook hỏng không chặn cả phiên; hook cố ý chặn thì trả quyết định deny.
Thử tay:
  echo '{"tool_input":{"command":"rm -rf /tmp/x"}}' | python3 chan-lenh-nguy-hiem.py
"""
import json
import os
import re
import sys

LUAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "luat.json")

CHUNG = [
    (r"\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive)\b", "Xóa hàng loạt (rm -rf) không được phép."),
    (r"\bgit\s+push\b[^\n]*(--force\b|\s-f\b)", "Không dùng git push --force."),
    (r"\bgit\s+reset\s+--hard\b", "git reset --hard làm mất việc chưa lưu."),
    (r"\bgit\s+clean\s+-[a-zA-Z]*f", "git clean -f xóa tệp chưa theo dõi."),
    (r"\b(curl|wget)\b[^|;&\n]*\|\s*(sudo\s+)?(ba|z)?sh\b", "Không chạy mã tải về qua đường ống vào shell."),
    (r"\bchmod\s+(-R\s+)?777\b", "Không mở quyền 777."),
    (r"\bsudo\b", "Không dùng sudo."),
    (r"\b(cat|head|tail|less|grep|source)\b[^\n]*(\.env\b|\.pem\b|id_rsa|credentials\.json)", "Không đọc tệp bí mật."),
]


def tu_choi(ly_do):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": ly_do,
    }}, ensure_ascii=False))
    sys.exit(0)


def main():
    try:
        du_lieu = json.load(sys.stdin)
        lenh = (du_lieu.get("tool_input") or {}).get("command") or ""
    except Exception:
        return
    luat = list(CHUNG)
    try:
        with open(LUAT, encoding="utf-8") as f:
            for mau in json.load(f).get("lenh_cam", []):
                luat.append((mau["mau"], mau["ly_do"]))
    except Exception:
        pass
    for mau, ly_do in luat:
        if re.search(mau, lenh):
            tu_choi(ly_do + " Cần làm việc này thì dừng lại và hỏi người phụ trách.")


if __name__ == "__main__":
    main()
