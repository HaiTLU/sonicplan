import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { moAiClaudeCode } from '../may-chu/ai-claude-code.js';
import { chayAi } from '../src/ai.js';

// Tiến trình claude giả: ghi lại đối số, stdin; trả lời bằng tra(stdin) khi stdin đóng.
function spawnGia(tra, ds = []) {
  return (bin, doiSo, tuyChon) => {
    const con = new EventEmitter();
    con.stdout = new PassThrough();
    con.stderr = new PassThrough();
    con.stdin = new PassThrough();
    const ghi = { bin, doiSo, tuyChon, vao: '', bi_dung: null };
    ds.push(ghi);
    con.kill = (tin) => { ghi.bi_dung = ghi.bi_dung || tin; setImmediate(() => con.emit('close', null)); };
    con.stdin.on('data', (b) => { ghi.vao += b; });
    con.stdin.on('finish', () => {
      const r = tra(ghi);
      if (r === 'treo') return;
      setImmediate(() => { con.stdout.write(r.out ?? ''); con.stderr.write(r.err ?? ''); setImmediate(() => con.emit('close', r.ma ?? 0)); });
    });
    return con;
  };
}
const thuMuc = () => mkdtempSync(join(tmpdir(), 'sp-ai-cc-'));
const ketQua = (result, them = {}) => ({ out: `${JSON.stringify({ type: 'result', is_error: false, result, ...them })}\n` });

test('Claude Code: gọi claude -p không công cụ, không MCP, lời nhắc hệ thống qua cờ, tin qua stdin', async () => {
  const ds = [];
  const ai = moAiClaudeCode({ claudeBin: '/bin/claude', model: 'claude-sonnet-5-5', effort: 'low', thuMuc: thuMuc(), spawnHam: spawnGia(() => ketQua('{"viec":[]}'), ds) });
  const tra = await ai.chay([{ role: 'system', content: 'Bạn là trợ lý.' }, { role: 'user', content: 'Tin 1: chào' }]);
  assert.equal(tra, '{"viec":[]}');
  const { bin, doiSo, tuyChon, vao } = ds[0];
  assert.equal(bin, '/bin/claude');
  assert.equal(vao, 'Tin 1: chào');
  assert.equal(doiSo[0], '-p');
  for (const co of ['--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence']) assert.ok(doiSo.includes(co), co);
  assert.ok(!doiSo.includes('--bare'), 'không dùng --bare: mất đăng nhập Max');
  const sau = (co) => doiSo[doiSo.indexOf(co) + 1];
  assert.equal(sau('--tools'), '');
  assert.equal(sau('--setting-sources'), 'local');
  assert.equal(sau('--output-format'), 'json');
  assert.equal(sau('--model'), 'claude-sonnet-5-5');
  assert.equal(sau('--effort'), 'low');
  assert.equal(sau('--system-prompt'), 'Bạn là trợ lý.');
  assert.equal(tuyChon.env.CLAUDECODE, '');
  assert.match(ai.ten, /claude-sonnet-5-5/);
});

test('Claude Code: nhiều lượt hỏi đáp ghép thành một tin; không có lời nhắc hệ thống thì không truyền cờ', async () => {
  const ds = [];
  const ai = moAiClaudeCode({ claudeBin: 'c', thuMuc: thuMuc(), spawnHam: spawnGia(() => ketQua('ok'), ds) });
  await ai.chay([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }]);
  assert.equal(ds[0].vao, 'Người dùng: a\n\nTrợ lý: b\n\nNgười dùng: c');
  assert.ok(!ds[0].doiSo.includes('--system-prompt'));
});

test('Claude Code: báo lỗi khi Claude trả is_error, khi đầu ra không phải JSON, và khi quá giờ', async () => {
  const loiGoi = moAiClaudeCode({ claudeBin: 'c', thuMuc: thuMuc(), spawnHam: spawnGia(() => ({ out: JSON.stringify({ type: 'result', is_error: true, result: 'Claude AI usage limit reached' }), ma: 1 })) });
  await assert.rejects(loiGoi.chay([{ role: 'user', content: 'a' }]), /Claude Code báo lỗi: Claude AI usage limit reached/);
  const loiRa = moAiClaudeCode({ claudeBin: 'c', thuMuc: thuMuc(), spawnHam: spawnGia(() => ({ out: '', err: 'Not logged in', ma: 1 })) });
  await assert.rejects(loiRa.chay([{ role: 'user', content: 'a' }]), /Claude Code dừng với mã 1\. Not logged in/);
  const ds = [];
  const treo = moAiClaudeCode({ claudeBin: 'c', thuMuc: thuMuc(), hetGioMs: 30, spawnHam: spawnGia(() => 'treo', ds) });
  await assert.rejects(treo.chay([{ role: 'user', content: 'a' }]), /quá 0 giây, đã dừng/);
  assert.equal(ds[0].bi_dung, 'SIGTERM');
});

test('Claude Code: chạy tối đa toiDaCungLuc tiến trình, lượt sau đợi', async () => {
  let dang = 0;
  let caoNhat = 0;
  const ds = [];
  const ai = moAiClaudeCode({
    claudeBin: 'c', thuMuc: thuMuc(), toiDaCungLuc: 2,
    spawnHam: (...a) => {
      dang++; caoNhat = Math.max(caoNhat, dang);
      const con = spawnGia(() => 'treo', ds)(...a);
      setTimeout(() => { dang--; con.stdout.write(ketQua('x').out); con.emit('close', 0); }, 15);
      return con;
    },
  });
  const tra = await Promise.all([1, 2, 3, 4, 5].map((i) => ai.chay([{ role: 'user', content: String(i) }])));
  assert.deepEqual(tra, ['x', 'x', 'x', 'x', 'x']);
  assert.equal(ds.length, 5);
  assert.equal(caoNhat, 2);
});

test('chayAi: Claude Code đứng trước Workers AI; lỗi thì báo và quay về Workers AI', async () => {
  const goiWorkers = [];
  const AI = { run: async (mh, v) => { goiWorkers.push(v); return { response: 'từ workers' }; } };
  const tot = { CLAUDE_CODE_AI: { chay: async (m) => `cc:${m[0].content}` }, AI };
  const tuyChon = {};
  assert.equal(await chayAi(tot, tuyChon, [{ role: 'system', content: 'he' }, { role: 'user', content: 'u' }], { maxTokens: 10, nhietDo: 0 }), 'cc:he');
  assert.equal(goiWorkers.length, 0);
  assert.ok(!tuyChon.duPhong, 'trả lời từ Claude Code không phải dự phòng');

  const bao = [];
  const hong = { CLAUDE_CODE_AI: { chay: async () => { throw new Error('Claude Code báo lỗi: hết hạn mức gói'); } }, AI };
  const tc2 = { baoLoi: async (t) => bao.push(t) };
  assert.equal(await chayAi(hong, tc2, [{ role: 'user', content: 'u' }], { maxTokens: 10, nhietDo: 0 }), 'từ workers');
  assert.equal(goiWorkers.length, 1);
  assert.equal(tc2.duPhong, true);
  assert.match(bao[0], /hết hạn mức gói/);

  const chiCc = { CLAUDE_CODE_AI: hong.CLAUDE_CODE_AI };
  await assert.rejects(chayAi(chiCc, {}, [{ role: 'user', content: 'u' }], { maxTokens: 10, nhietDo: 0 }), /không có Workers AI dự phòng/);
});

test('chayAi: hồ sơ người dùng vẫn ghép vào lời nhắc hệ thống trước khi gửi Claude Code', async () => {
  let da;
  const env = { CLAUDE_CODE_AI: { chay: async (m) => { da = m; return 'ok'; } } };
  await chayAi(env, { hoSo: 'Tôi là PM.' }, [{ role: 'system', content: 'he' }, { role: 'user', content: 'u' }], { maxTokens: 10, nhietDo: 0 });
  assert.match(da[0].content, /^he\n\nHồ sơ người dùng[\s\S]*Tôi là PM\.$/);
});
