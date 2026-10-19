import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { moAiFpt, chonBac, boSuyNghi } from '../may-chu/ai-fpt.js';
import { moLuaChonAi } from '../may-chu/lua-chon-ai.js';
import { chayAi, chonNhaCungCap } from '../src/ai.js';

const tra = (chu, them = {}) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: chu }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 }, ...them }) });
const loi = (status, error) => ({ ok: false, status, json: async () => ({ error }) });

test('FPT: thiếu khóa thì không mở lớp AI', () => {
  assert.equal(moAiFpt({ khoa: '' }), undefined);
  assert.equal(moAiFpt({}), undefined);
});

test('FPT: gọi chat/completions với khóa Bearer, chọn bậc theo tên model Claude, bỏ phần suy nghĩ', async () => {
  const ds = [];
  const ai = moAiFpt({ khoa: 'khoa-thu-nghiem', diaChi: 'https://mkp-api.fptcloud.com/v1/', modelNhe: 'nhe', modelManh: 'manh', fetchHam: async (url, o) => { ds.push({ url, o, body: JSON.parse(o.body) }); return tra('<think>nghĩ {x}</think>{"viec":[]}'); } });
  assert.equal(await ai.chay([{ role: 'system', content: 'a' }, { role: 'user', content: 'b' }], { model: 'claude-haiku-5-5', maxTokens: 100, nhietDo: 0, khuon: {} }), '{"viec":[]}');
  assert.equal(ds[0].url, 'https://mkp-api.fptcloud.com/v1/chat/completions');
  assert.equal(ds[0].o.headers.authorization, 'Bearer khoa-thu-nghiem');
  assert.equal(ds[0].body.model, 'nhe');
  assert.deepEqual(ds[0].body.response_format, { type: 'json_object' });
  await ai.chay([{ role: 'user', content: 'b' }], { model: 'claude-sonnet-5-5' });
  assert.equal(ds[1].body.model, 'manh');
  assert.equal(ds[1].body.response_format, undefined);
  assert.equal(ds.length, 2); // mỗi lần chạy đúng một lần gọi
});

test('FPT: gateway từ chối response_format thì thử lại một lần không kèm và nhớ cho lần sau', async () => {
  const ds = [];
  const ai = moAiFpt({ khoa: 'k', fetchHam: async (u, o) => { const b = JSON.parse(o.body); ds.push(b); return b.response_format ? loi(400, { message: 'bad' }) : tra('{}'); } });
  assert.equal(await ai.chay([{ role: 'user', content: 'x' }], { khuon: {} }), '{}');
  await ai.chay([{ role: 'user', content: 'x' }], { khuon: {} });
  assert.equal(ds.length, 3);
});

test('FPT: trả lời cụt thì hỏi lại gấp đôi một lần; lỗi 401 ghi rõ và không in khóa', async () => {
  const mt = [];
  let n = 0;
  const ai = moAiFpt({ khoa: 'bi-mat-123', fetchHam: async (u, o) => { mt.push(JSON.parse(o.body).max_tokens); return n++ === 0 ? tra('cụt', { choices: [{ message: { content: 'cụt' }, finish_reason: 'length' }] }) : tra('đủ'); } });
  assert.equal(await ai.chay([{ role: 'user', content: 'x' }], { maxTokens: 50 }), 'đủ');
  assert.deepEqual(mt, [50, 100]);
  const hong = moAiFpt({ khoa: 'bi-mat-123', fetchHam: async () => loi(401, { message: 'invalid' }) });
  await assert.rejects(hong.chay([{ role: 'user', content: 'x' }]), (e) => /401/.test(e.message) && !/bi-mat-123/.test(e.message));
});

test('chonBac, boSuyNghi', () => {
  assert.equal(chonBac('claude-haiku-5-5'), 'nhe');
  assert.equal(chonBac(undefined), 'nhe');
  assert.equal(chonBac('claude-sonnet-5-5'), 'manh');
  assert.equal(boSuyNghi('suy nghĩ dở</think>đáp'), 'đáp');
});

test('lựa chọn nhà cung cấp: mặc định Claude, lưu tệp, riêng từng phần', () => {
  const tep = join(mkdtempSync(join(tmpdir(), 'sp-lc-')), 'ncc.json');
  const lc = moLuaChonAi(tep);
  assert.equal(chonNhaCungCap({ LUA_CHON_AI: lc }, 'tach_viec'), 'claude');
  assert.equal(chonNhaCungCap({}), 'claude');
  lc.ghi({ chung: 'fpt', soan_prompt: 'claude' });
  assert.equal(chonNhaCungCap({ LUA_CHON_AI: lc }, 'tach_viec'), 'fpt');
  assert.equal(chonNhaCungCap({ LUA_CHON_AI: lc }, 'soan_prompt'), 'claude');
  assert.deepEqual(JSON.parse(readFileSync(tep, 'utf8')), { chung: 'fpt', soan_prompt: 'claude' });
  assert.equal(chonNhaCungCap({ LUA_CHON_AI: moLuaChonAi(tep) }, 'khac'), 'fpt'); // khởi động lại vẫn nhớ
});

test('chayAi: chọn FPT thì gọi FPT, không gọi Claude; FPT lỗi hoặc thiếu khóa thì dùng Claude và báo', async () => {
  const goi = [];
  const lc = { doc: () => ({ chung: 'fpt' }) };
  const claude = { chay: async () => { goi.push('claude'); return 'tu-claude'; } };
  const fpt = { chay: async (m, o) => { goi.push(`fpt:${o.model}`); return 'tu-fpt'; } };
  assert.equal(await chayAi({ LUA_CHON_AI: lc, FPT_AI: fpt, CLAUDE_CODE_AI: claude }, { model: 'claude-haiku-5-5' }, [{ role: 'user', content: 'x' }], { phan: 'tach_viec' }), 'tu-fpt');
  assert.deepEqual(goi, ['fpt:claude-haiku-5-5']);
  const bao = [];
  const hong = { chay: async () => { throw new Error('FPT từ chối (429)'); } };
  assert.equal(await chayAi({ LUA_CHON_AI: lc, FPT_AI: hong, CLAUDE_CODE_AI: claude }, { baoLoi: async (t) => bao.push(t) }, [{ role: 'user', content: 'x' }], {}), 'tu-claude');
  assert.match(bao[0], /429/);
  assert.equal(await chayAi({ LUA_CHON_AI: lc, CLAUDE_CODE_AI: claude }, { baoLoi: async (t) => bao.push(t) }, [{ role: 'user', content: 'x' }], {}), 'tu-claude');
  assert.match(bao[1], /FPT_AI_API_KEY/);
  // chọn Claude thì không đụng tới FPT
  goi.length = 0;
  await chayAi({ LUA_CHON_AI: { doc: () => ({ chung: 'claude' }) }, FPT_AI: fpt, CLAUDE_CODE_AI: claude }, {}, [{ role: 'user', content: 'x' }], {});
  assert.deepEqual(goi, ['claude']);
});

test('khóa FPT nhập từ giao diện: kiểm trước khi lưu, mã hóa trên đĩa, nhớ sau khi khởi động lại, gỡ thì về biến môi trường', async () => {
  const { moKhoaFpt } = await import('../may-chu/khoa-fpt.js');
  const { readFileSync } = await import('node:fs');
  const env = { KHOA_MA_HOA: Buffer.alloc(32, 7).toString('base64') };
  const tep = join(mkdtempSync(join(tmpdir(), 'sp-kf-')), 'khoa-fpt.enc');
  const khoa = 'khoa-fpt-thu-nghiem-rat-bi-mat-123';
  const dung = (c) => moAiFpt({ ...c, fetchHam: async () => tra('ok') });
  const kf = moKhoaFpt({ tep, cfg: { FPT_AI_API_KEY: 'khoa-moi-truong-thu-nghiem-123' }, env, moAi: dung });
  await kf.khoiDong;
  assert.equal(kf.thongTin().nguon, 'bien_moi_truong');
  await assert.rejects(kf.ghi({ khoa: 'ngan' }), /không đúng/);
  await assert.rejects(kf.ghi({ khoa, dia_chi: 'http://localhost/v1' }), /https|nội bộ/);
  await kf.ghi({ khoa, model: 'm-nhe' });
  assert.equal(kf.thongTin().nguon, 'giao_dien');
  assert.equal(kf.thongTin().model, 'm-nhe');
  assert.ok(kf.lay());
  assert.ok(!readFileSync(tep, 'utf8').includes(khoa)); // không lưu chữ thường
  assert.ok(!JSON.stringify(kf.thongTin()).includes(khoa)); // không trả khóa ra ngoài
  const kf2 = moKhoaFpt({ tep, cfg: {}, env, moAi: dung });
  await kf2.khoiDong;
  assert.equal(kf2.thongTin().nguon, 'giao_dien');
  kf2.xoa();
  assert.equal(kf2.lay(), undefined);
  const kf3 = moKhoaFpt({ tep, cfg: {}, env, moAi: dung });
  await kf3.khoiDong;
  assert.equal(kf3.lay(), undefined); // tệp đã gỡ nên không còn khóa
  // khóa sai (401) thì không lưu
  const hong = moKhoaFpt({ tep: join(mkdtempSync(join(tmpdir(), 'sp-kf-')), 'k.enc'), cfg: {}, env, moAi: (c) => moAiFpt({ ...c, fetchHam: async () => loi(401, { message: 'x' }) }) });
  await assert.rejects(hong.ghi({ khoa }), /401/);
  assert.equal(hong.lay(), undefined);
});

test('tắt hẳn Claude: FPT lỗi thì không gọi Claude, báo lỗi rõ', async () => {
  const lc = { doc: () => ({ chung: 'fpt', tat_claude: true }) };
  let claudeGoi = 0;
  const claude = { chay: async () => { claudeGoi++; return 'x'; } };
  const hong = { chay: async () => { throw new Error('FPT hỏng'); } };
  await assert.rejects(chayAi({ LUA_CHON_AI: lc, FPT_AI: hong, CLAUDE_CODE_AI: claude }, {}, [{ role: 'user', content: 'x' }], {}), /Claude đang tắt/);
  assert.equal(claudeGoi, 0);
  const { chuanLuaChon } = await import('../may-chu/lua-chon-ai.js');
  assert.equal(chuanLuaChon({ chung: 'fpt', tat_claude: true }).tat_claude, true);
  assert.equal(chuanLuaChon({ chung: 'fpt', tat_claude: 'x' }).tat_claude, undefined);
});
