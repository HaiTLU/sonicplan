#!/usr/bin/env python3
"""Hook PreToolUse (Write|Edit|MultiEdit): chặn khóa API, token, khóa riêng bị ghi vào tệp.

Không bao giờ in giá trị khóa, chỉ in loại. Dòng có chữ `bi-mat-ok` được cho qua có chủ đích.
Thử tay:
  echo '{"tool_input":{"file_path":"a.txt","content":"AKIAABCDEFGHIJKLMNOP"}}' | python3 chan-khoa-bi-mat.py
"""
import json
import re
import sys

MAU = [
    ("khóa Anthropic", re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    ("khóa OpenAI", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{32,}")),
    ("khóa Google API", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("token GitHub", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}")),
    ("khóa AWS", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("token Slack", re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}")),
    ("khóa riêng PEM", re.compile(r"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----")),
]


def tu_choi(loai):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": f"Nội dung có vẻ chứa {loai}. Đưa khóa vào biến môi trường, không ghi vào tệp.",
    }}, ensure_ascii=False))
    sys.exit(0)


def main():
    try:
        ti = json.load(sys.stdin).get("tool_input") or {}
    except Exception:
        return
    chu = [ti.get("content") or "", ti.get("new_string") or ""]
    chu += [(e or {}).get("new_string") or "" for e in ti.get("edits") or []]
    for dong in "\n".join(chu).splitlines():
        if "bi-mat-ok" in dong:
            continue
        for loai, mau in MAU:
            if mau.search(dong):
                tu_choi(loai)


if __name__ == "__main__":
    main()
