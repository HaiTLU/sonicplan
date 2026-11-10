#!/usr/bin/env python3
"""Hook PostToolUse: ghi nối mỗi lần gọi công cụ vào .claude/nhat-ky/cong-cu.jsonl.

Chỉ ghi tên công cụ, giờ, và phần đầu của lệnh hoặc đường dẫn tệp (không ghi nội dung tệp).
Chuỗi giống khóa bị che. Lỗi thì im lặng.
"""
import datetime
import json
import os
import re
import sys

KHOA = re.compile(r"(sk-[A-Za-z0-9_\-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,})")


def main():
    try:
        d = json.load(sys.stdin)
        ti = d.get("tool_input") or {}
        dau = str(ti.get("command") or ti.get("file_path") or ti.get("pattern") or "")[:200]
        goc = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
        thu_muc = os.path.join(goc, ".claude", "nhat-ky")
        os.makedirs(thu_muc, exist_ok=True)
        dong = {"gio": datetime.datetime.now().isoformat(timespec="seconds"),
                "cong_cu": d.get("tool_name"), "dau_vao": KHOA.sub("[che]", dau)}
        with open(os.path.join(thu_muc, "cong-cu.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(dong, ensure_ascii=False) + "\n")
    except Exception:
        pass


if __name__ == "__main__":
    main()
