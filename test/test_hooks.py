"""Thử các hook: phải chặn việc xấu và cho qua việc lành. Chạy: python3 -m unittest test/test_hooks.py"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOOK = os.path.join(GOC, ".claude", "hooks")


def chay(ten, du_lieu, **env):
    e = dict(os.environ, **env)
    r = subprocess.run([sys.executable, os.path.join(HOOK, ten)], input=json.dumps(du_lieu),
                       capture_output=True, text=True, env=e, timeout=10)
    return r.stdout


def bi_chan(out):
    return '"permissionDecision": "deny"' in out


class TestHook(unittest.TestCase):
    def test_chan_rm_rf(self):
        self.assertTrue(bi_chan(chay("chan-lenh-nguy-hiem.py", {"tool_input": {"command": "rm -rf build"}})))

    def test_chan_push_force(self):
        self.assertTrue(bi_chan(chay("chan-lenh-nguy-hiem.py", {"tool_input": {"command": "git push --force origin main"}})))

    def test_chan_doc_env(self):
        self.assertTrue(bi_chan(chay("chan-lenh-nguy-hiem.py", {"tool_input": {"command": "cat .env"}})))

    def test_cho_qua_lenh_lanh(self):
        self.assertFalse(bi_chan(chay("chan-lenh-nguy-hiem.py", {"tool_input": {"command": "ls -la"}})))

    def test_chan_xoa_volume_docker(self):
        self.assertTrue(bi_chan(chay("chan-lenh-nguy-hiem.py", {"tool_input": {"command": "docker compose down -v"}})))

    def test_chan_drop_table(self):
        self.assertTrue(bi_chan(chay("chan-lenh-nguy-hiem.py", {"tool_input": {"command": "psql -c 'DROP TABLE van_ban'"}})))

    def test_cho_qua_docker_ps(self):
        self.assertFalse(bi_chan(chay("chan-lenh-nguy-hiem.py", {"tool_input": {"command": "docker compose ps"}})))

    def test_chan_khoa_aws(self):
        khoa = "AKIA" + "ABCDEFGHIJKLMNOP"
        self.assertTrue(bi_chan(chay("chan-khoa-bi-mat.py", {"tool_input": {"file_path": "a.txt", "content": "k=" + khoa}})))

    def test_cho_qua_van_ban_thuong(self):
        self.assertFalse(bi_chan(chay("chan-khoa-bi-mat.py", {"tool_input": {"file_path": "a.txt", "content": "xin chào"}})))

    def test_nhat_ky_ghi_va_che_khoa(self):
        with tempfile.TemporaryDirectory() as d:
            chay("ghi-nhat-ky-cong-cu.py", {"tool_name": "Bash", "tool_input": {"command": "echo AKIAABCDEFGHIJKLMNOP"}},
                 CLAUDE_PROJECT_DIR=d)
            tep = os.path.join(d, ".claude", "nhat-ky", "cong-cu.jsonl")
            noi_dung = open(tep, encoding="utf-8").read()
            self.assertIn("Bash", noi_dung)
            self.assertNotIn("AKIAABCDEFGHIJKLMNOP", noi_dung)

    def test_luu_truoc_khi_nen(self):
        with tempfile.TemporaryDirectory() as d:
            chay("luu-truoc-khi-nen.py", {}, CLAUDE_PROJECT_DIR=d)
            self.assertIn("nén", open(os.path.join(d, "TIEN-DO.md"), encoding="utf-8").read())


if __name__ == "__main__":
    unittest.main()
