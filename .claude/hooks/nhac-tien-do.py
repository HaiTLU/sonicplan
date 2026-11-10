#!/usr/bin/env python3
"""Hook Stop: nhắc cập nhật TIEN-DO.md nếu tệp quá cũ. Chỉ nhắc, không chặn (tránh vòng lặp dừng)."""
import json
import os
import sys
import time

NGUONG_PHUT = 30


def main():
    try:
        goc = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
        tep = os.path.join(goc, "TIEN-DO.md")
        if not os.path.exists(tep) or (time.time() - os.path.getmtime(tep)) / 60 > NGUONG_PHUT:
            print(json.dumps({"systemMessage": "TIEN-DO.md chưa cập nhật trong 30 phút: ghi bước đã xong và bước tiếp."},
                             ensure_ascii=False))
    except Exception:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
