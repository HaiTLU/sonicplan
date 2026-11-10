#!/usr/bin/env python3
"""Hook PreCompact: trước khi nén ngữ cảnh, ghi một dòng vào TIEN-DO.md để phiên sau biết đã nén."""
import datetime
import os


def main():
    try:
        goc = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
        with open(os.path.join(goc, "TIEN-DO.md"), "a", encoding="utf-8") as f:
            f.write(f"\n- {datetime.datetime.now().isoformat(timespec='minutes')}: ngữ cảnh vừa được nén; "
                    "đọc lại mục 'Bước tiếp' trước khi làm tiếp.\n")
    except Exception:
        pass


if __name__ == "__main__":
    main()
