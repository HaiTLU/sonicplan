// Giao Claude nhiều việc (gộp một lượt hoặc từng việc), Claude hỏi lại, nhận kết quả về cả nhóm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { docCauHoiTruoc, giaoClaude, hoiTruoc, loiNhacClaude, nhanKetQuaClaude, tachCauHoi } from '../src/claude-code.js';
import { luuTichHop } from '../src/tich-hop.js';

const KHOA = Buffer.alloc(32, 7).toString('base64');

async function dung() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc', 'Thử', '2026-10-01T00:00:00Z')`);
  const them = db.prepare(`INSERT INTO viec (id, to_chuc_id, tieu_de, ghi_chu, trang_thai, tao_luc, cap_nhat_luc) VALUES (?, 'tc', ?, ?, ?, '2026-10-01', '2026-10-01')`);
  them.run(1, 'Liên hệ IPSOS xin báo giá', 'Gửi lại proposal', 'mo');
  them.run(2, 'Điền NDA', null, 'mo');
  them.run(3, 'Trả lời 8 câu hỏi', null, 'mo');
  them.run(4, 'Việc đã xong', null, 'xong');
  const env = { CSDL: d1(db), KHOA_MA_HOA: KHOA };
  await luuTichHop(env, 'tc', 'github', { token: 'x', repo: 'a/b' });
  return { db, env };
}

function giaGithub() {
  const goi = [];
  globalThis.fetch = async (url, tc) => {
    goi.push({ url, body: tc.body ? JSON.parse(tc.body) : null });
    if (url.endsWith('/repos/a/b')) return new Response(JSON.stringify({ default_branch: 'main' }), { status: 200 });
    return new Response(null, { status: 204 });
  };
  return goi;
}

test('gộp một lượt: một lần gọi GitHub, mỗi việc có dòng riêng, kết quả và câu hỏi về cả nhóm', async () => {
  const { db, env } = await dung();
  const goi = giaGithub();
  const kq = await giaoClaude(env, 'tc', [1, 2, 3], { cach: 'gop', traLoi: [{ hoi: 'Gửi cho ai?', tra_loi: 'Anh Tùng' }, { hoi: 'Bỏ trống', tra_loi: '' }] }, 'https://x');
  assert.equal(kq.so_viec, 3);
  const dispatch = goi.filter((g) => g.url.endsWith('/dispatches'));
  assert.equal(dispatch.length, 1);
  const p = dispatch[0].body.inputs.yeu_cau;
  assert.match(p, /Việc 1: Liên hệ IPSOS/);
  assert.match(p, /Việc 3: Trả lời 8 câu hỏi/);
  assert.match(p, /Gửi cho ai\?: Anh Tùng/);
  assert.doesNotMatch(p, /Bỏ trống/);
  const dong = db.prepare('SELECT viec_id, lo_id FROM luot_claude ORDER BY id').all();
  assert.deepEqual(dong.map((d) => [d.viec_id, d.lo_id]), [[1, null], [2, kq.luot], [3, kq.luot]]);

  // Đang chạy thì không giao trùng
  assert.equal((await giaoClaude(env, 'tc', [2], {}, 'https://x')).ma, 409);

  // Workflow báo xong kèm câu hỏi: cả 3 dòng cập nhật
  const ma = dispatch[0].body.inputs.ma_bao;
  const ph = await nhanKetQuaClaude(new Request('https://x/nhan/claude', { method: 'POST', headers: { authorization: `Bearer ${ma}` }, body: JSON.stringify({ luot: kq.luot, trang_thai: 'xong', ket_qua: 'Đã soạn nháp.\n\nCÂU HỎI CHO BẠN:\n- Mã số thuế của trường?\n- Ai ký NDA?' }) }), env);
  assert.equal(ph.status, 200);
  const sau = db.prepare('SELECT trang_thai, cau_hoi FROM luot_claude ORDER BY id').all();
  assert.ok(sau.every((d) => d.trang_thai === 'xong' && JSON.parse(d.cau_hoi).length === 2));
});

test('từng việc: mỗi việc một lượt; việc đã đóng và vượt trần bị chặn', async () => {
  const { env } = await dung();
  const goi = giaGithub();
  const kq = await giaoClaude(env, 'tc', [1, 2], { cach: 'tung_viec' }, 'https://x');
  assert.equal(kq.cac_luot.length, 2);
  assert.equal(goi.filter((g) => g.url.endsWith('/dispatches')).length, 2);
  assert.equal((await giaoClaude(env, 'tc', [3, 4], {}, 'https://x')).ma, 400);
  assert.equal((await giaoClaude(env, 'tc', [], {}, 'https://x')).ma, 400);
});

test('lượt GitHub chưa chạy sau 20 phút thành lỗi, nhưng báo về muộn vẫn nhận', async () => {
  const { db, env } = await dung();
  const goi = giaGithub();
  const kq = await giaoClaude(env, 'tc', [1], {}, 'https://x');
  db.prepare("UPDATE luot_claude SET tao_luc = '2026-01-01T00:00:00Z'").run();
  await giaoClaude(env, 'tc', [2], {}, 'https://x'); // chạy đánh dấu quá hạn
  const l = db.prepare('SELECT trang_thai, ket_qua FROM luot_claude WHERE id = ?').get(kq.luot);
  assert.equal(l.trang_thai, 'loi');
  assert.match(l.ket_qua, /chưa chạy/);
  const ma = goi.filter((g) => g.url.endsWith('/dispatches'))[0].body.inputs.ma_bao;
  const ph = await nhanKetQuaClaude(new Request('https://x/nhan/claude', { method: 'POST', headers: { authorization: `Bearer ${ma}` }, body: JSON.stringify({ luot: kq.luot, trang_thai: 'xong', ket_qua: 'Xong' }) }), env);
  assert.equal(ph.status, 200);
  assert.equal(db.prepare('SELECT trang_thai FROM luot_claude WHERE id = ?').get(kq.luot).trang_thai, 'xong');
});

test('hỏi trước: AI lỗi thì không hỏi, không chặn giao việc; câu hỏi được làm sạch', async () => {
  const { env } = await dung();
  const loiAi = async () => { throw new Error('hỏng'); };
  assert.deepEqual(await hoiTruoc(env, 'tc', [1], loiAi, {}), { cau_hoi: [] });
  const ai = async (_e, _t, msgs) => { assert.match(msgs[1].content, /IPSOS/); return { cau_hoi: [{ hoi: '  Gửi   cho ai? ', goi_y: ['Anh Tùng', '', 'Chị Lan', 'A', 'B', 'C'] }, { hoi: '' }, { hoi: 'b', goi_y: [] }, { hoi: 'c' }, { hoi: 'd' }] }; };
  const r = await hoiTruoc(env, 'tc', [1], ai, {});
  assert.equal(r.cau_hoi.length, 3);
  assert.deepEqual(r.cau_hoi[0], { hoi: 'Gửi cho ai?', goi_y: ['Anh Tùng', 'Chị Lan', 'A', 'B'] });
  assert.deepEqual(docCauHoiTruoc('rác'), []);
});

test('tách câu hỏi cuối kết quả, lời dặn có luật hỏi lại', () => {
  assert.equal(tachCauHoi('Xong hết.'), null);
  assert.deepEqual(tachCauHoi('A\nCâu hỏi cho bạn:\n1. Một?\n- **Hai?**\n* Ba\n- Bốn'), ['Một?', 'Hai?', 'Ba']);
  assert.match(loiNhacClaude({ tieu_de: 'A' }, 1), /CÂU HỎI CHO BẠN:/);
  assert.match(loiNhacClaude({ tieu_de: 'A' }, 1, null, { truoc: 'Kết quả cũ' }), /Kết quả lần trước[\s\S]*Kết quả cũ/);
});
