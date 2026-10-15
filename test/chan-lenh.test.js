// Hook chặn lệnh dừng tiến trình theo tên (lỗi đã lặp hai lần, 14/10 và 15/10/2026). Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const chay = (lenh) => spawnSync('python3', ['.claude/hooks/chan-dung-rong.py'], { input: JSON.stringify({ tool_input: { command: lenh } }), encoding: 'utf8' });

test('hook chặn pkill hoặc killall theo tên có thể giết máy chủ thật', () => {
  for (const lenh of ['pkill -f "may-chu/chay.js"', 'pkill -f may-chu/chay.js 2>/dev/null; sleep 1', 'killall node', 'pkill node', 'pkill -f node', 'cd x && pkill -f chay.js', 'pkill -f sonicplan', 'killall "Google Chrome"', 'pkill -f remote']) {
    const r = chay(lenh);
    assert.equal(r.status, 2, lenh);
    assert.match(r.stderr, /Cách đúng/);
  }
});

test('hook cho qua lệnh dừng bằng PID hoặc theo cờ riêng và mọi lệnh thường', () => {
  for (const lenh of ['kill $(cat /tmp/may-chu.pid)', 'kill 12345', 'pkill -f "remote-debugging-port=9333"', 'ls -la', 'git push origin HEAD:main', 'node may-chu/chay.js &', 'echo pkill']) assert.equal(chay(lenh).status, 0, lenh);
});
