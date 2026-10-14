// Kiểm trang Claude: phòng chat (giao lượt, chữ tạm, dừng, trạm tắt rồi bật), mã trạm, lệnh cài, và WebSocket trên máy chủ Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PhongTram, kichBanCai, tenTepAnToan } from '../src/tram-claude.js';
import { taoMayChu } from '../may-chu/chay.js';
import { cauTraLoiQuyen, chiTietXin } from '../public/tram-claude.mjs';

function khoNho() {
  const du = new Map();
  return {
    async get(k) { return du.has(k) ? structuredClone(du.get(k)) : undefined; },
    async put(k, v) { du.set(k, structuredClone(v)); },
    async delete(k) { return du.delete(k); },
    async list({ prefix = '', reverse = false, limit } = {}) {
      let ds = [...du.keys()].filter((k) => k.startsWith(prefix)).sort();
      if (reverse) ds.reverse();
      if (limit) ds = ds.slice(0, limit);
      return new Map(ds.map((k) => [k, structuredClone(du.get(k))]));
    },
  };
}

function dungPhong() {
  const ketNoi = new Set();
  const phong = new PhongTram({
    kho: khoNho(),
    cacKetNoi: (vai) => [...ketNoi].filter((w) => w.gan.vai_tro === vai),
    docGan: (w) => w.gan,
    ganVao: (w, d) => { w.gan = d; },
  });
  const moi = (vai) => {
    const w = { gan: { vai_tro: vai, xac_thuc: false }, nhan: [], dong: null, send(t) { this.nhan.push(t === 'pong' ? t : JSON.parse(t)); }, close(ma) { this.dong = ma; ketNoi.delete(this); } };
    ketNoi.add(w);
    return w;
  };
  return { phong, moi, ketNoi };
}
const tin = (w, loai) => w.nhan.filter((t) => t.loai === loai);

test('Phòng: trạm sai mã bị đóng, đúng mã thì nhận lượt, chữ tạm không lưu, xong lượt thì lưu phiên Claude', async () => {
  const { phong, moi } = dungPhong();
  const { khoa } = await phong.xuLy('tao-khoa');
  assert.match(khoa, /^[a-z0-9]{40}$/);
  assert.deepEqual(await phong.xuLy('kiem-khoa', { khoa }), { dung: true });
  assert.deepEqual(await phong.xuLy('kiem-khoa', { khoa: 'sai' }), { dung: false });

  const sai = moi('tram');
  await phong.nhanTin(sai, JSON.stringify({ loai: 'chao', khoa: 'x'.repeat(40) }));
  assert.equal(sai.dong, 4001);

  const tram = moi('tram');
  await phong.nhanTin(tram, JSON.stringify({ loai: 'chao', khoa, may: 'mac-mini', phien_ban: '1.0.0', claude: '2.1' }));
  assert.equal(tin(tram, 'da_nhan').length, 1);
  assert.equal((await phong.xuLy('trang-thai')).tram_mo, true);

  const nguoi = moi('nguoi');
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'gui', noi_dung: 'Tóm tắt hợp đồng', model: 'haiku', effort: 'low', che_do: 'plan', du_an: { id: 3, ten: 'IPSOS' }, ma_tam: 'm1', dinh_kem: [{ ten: 'a.pdf', khoa: 'tram/tc/x/a.pdf', kich_thuoc: 10 }] }));
  const luot = tin(tram, 'luot')[0];
  assert.ok(luot, 'trạm phải nhận lượt');
  assert.equal(luot.model, 'haiku');
  assert.equal(luot.effort, 'low');
  assert.equal(luot.che_do, 'plan');
  assert.equal(luot.dinh_kem.length, 1);
  assert.deepEqual(luot.du_an, { id: 3, ten: 'IPSOS' });
  const phienMoi = tin(nguoi, 'phien').find((t) => t.moi_tu === 'm1');
  assert.equal(phienMoi.phien.id, luot.phien);

  // Đang chạy thì không nhận lượt thứ hai.
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'gui', phien: luot.phien, noi_dung: 'Thêm' }));
  assert.match(tin(nguoi, 'loi').at(-1).noi_dung, /đang làm lượt trước/);

  await phong.nhanTin(tram, JSON.stringify({ loai: 'su_kien', phien: luot.phien, luot: luot.luot, ds: [{ loai: 'chu_dang', them: 'Xin ' }, { loai: 'chu', noi_dung: 'Xin chào' }, { loai: 'cong_cu', id: 't1', ten: 'Read', mo_ta: 'Đọc a.pdf' }] }));
  const sk = tin(nguoi, 'su_kien').map((t) => t.su_kien);
  assert.ok(sk.find((s) => s.loai === 'chu_dang' && s.tam && !s.seq));
  assert.ok(sk.find((s) => s.loai === 'chu' && s.seq));
  await phong.nhanTin(tram, JSON.stringify({ loai: 'xong', phien: luot.phien, luot: luot.luot, claude_session: 'abc-123', thanh_cong: true, thoi_gian_ms: 4000, chi_phi: 0.02 }));

  const doc = moi('nguoi');
  await phong.nhanTin(doc, JSON.stringify({ loai: 'mo', phien: luot.phien }));
  const ls = tin(doc, 'lich_su')[0];
  assert.deepEqual(ls.su_kien.map((s) => s.loai), ['nguoi', 'chu', 'cong_cu', 'xong']);
  assert.equal(ls.phien.dang_chay, false);

  // Lượt sau gửi kèm phiên Claude cũ để Claude nhớ hội thoại.
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'gui', phien: luot.phien, noi_dung: 'Làm tiếp' }));
  assert.equal(tin(tram, 'luot').at(-1).claude_session, 'abc-123');
});

test('Phòng: trạm tắt thì lượt chờ, trạm bật thì nhận; dừng khi chưa giao thì kết thúc ngay', async () => {
  const { phong, moi } = dungPhong();
  const { khoa } = await phong.xuLy('tao-khoa');
  const nguoi = moi('nguoi');
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'gui', noi_dung: 'Việc 1', ma_tam: 'a' }));
  const p1 = tin(nguoi, 'phien')[0].phien;
  assert.equal(p1.cho_tram, true);
  assert.ok(tin(nguoi, 'su_kien').some((t) => t.su_kien.loai === 'he_thong'));

  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'gui', noi_dung: 'Việc 2', ma_tam: 'b' }));
  const p2 = tin(nguoi, 'phien').find((t) => t.moi_tu === 'b').phien;
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'dung', phien: p2.id }));
  assert.ok(tin(nguoi, 'su_kien').some((t) => t.phien === p2.id && t.su_kien.loai === 'xong' && t.su_kien.da_dung));

  const tram = moi('tram');
  await phong.nhanTin(tram, JSON.stringify({ loai: 'chao', khoa }));
  assert.deepEqual(tin(tram, 'luot').map((t) => t.phien), [p1.id]);

  // Đổi mã: trạm cũ bị đóng.
  await phong.xuLy('tao-khoa');
  assert.equal(tram.dong, 4003);
  assert.equal((await phong.xuLy('trang-thai')).tram_mo, false);
});

test('Phòng: trạm khởi động lại giữa lượt thì lượt dở báo lỗi; trạm mới thay trạm cũ', async () => {
  const { phong, moi } = dungPhong();
  const { khoa } = await phong.xuLy('tao-khoa');
  const t1 = moi('tram');
  await phong.nhanTin(t1, JSON.stringify({ loai: 'chao', khoa }));
  const nguoi = moi('nguoi');
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'gui', noi_dung: 'Việc dài' }));
  const t2 = moi('tram');
  await phong.nhanTin(t2, JSON.stringify({ loai: 'chao', khoa, dang_lam: [] }));
  assert.equal(t1.dong, 4002);
  const xong = tin(nguoi, 'su_kien').find((t) => t.su_kien.loai === 'xong');
  assert.match(xong.su_kien.loi, /khởi động lại/);
});

test('Lệnh cài và tên tệp an toàn', () => {
  const kb = kichBanCai('https://plan.vi-du.vn', 'tc_1', 'k'.repeat(40));
  assert.match(kb, /launchctl bootstrap/);
  assert.match(kb, /https:\/\/plan\.vi-du\.vn\/nhan\/tram\/ma/);
  assert.match(kb, /chmod 600/);
  assert.doesNotMatch(tenTepAnToan('../../etc/passwd'), /[/\\]/);
  assert.equal(tenTepAnToan(''), 'tep');
});

test('Máy chủ Node: trình duyệt và trạm nối WebSocket, lượt đi từ trang tới trạm, mã trạm sai bị từ chối', async () => {
  const duLieu = await mkdtemp(join(tmpdir(), 'tram-'));
  const m = taoMayChu({ DU_LIEU: duLieu, DB_FILE: ':memory:', MIGRATIONS: 'migrations', EMAIL_THU: 'ban@vi-du.vn', PUBLIC_ORIGIN: '', HEN_GIO: '0' });
  const db = m.env.CSDL.db;
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc_thu', 'Thử', '2026-10-01T00:00:00Z')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, ten, tao_luc) VALUES ('nd', 'ban@vi-du.vn', 'Bạn', '2026-10-01T00:00:00Z')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc_thu', 'nd', 'chu', '2026-10-01T00:00:00Z')`);
  await new Promise((ok) => m.maychu.listen(0, '127.0.0.1', ok));
  const goc = `127.0.0.1:${m.maychu.address().port}`;
  const cho = (ws, dk) => new Promise((ok, hong) => {
    const hen = setTimeout(() => hong(new Error('hết giờ chờ tin')), 5000);
    ws.addEventListener('message', function nghe(e) { const t = JSON.parse(e.data); if (dk(t)) { clearTimeout(hen); ws.removeEventListener('message', nghe); ok(t); } });
  });
  try {
    const { lenh } = await (await fetch(`http://${goc}/api/tram/lenh-cai`, { method: 'POST', headers: { origin: `http://${goc}`, 'content-type': 'application/json' }, body: '{}' })).json();
    const khoa = new URL(lenh.match(/'([^']+)'/)[1]).searchParams.get('k');
    const kb = await fetch(`http://${goc}/nhan/tram/cai?tc=tc_thu&k=${khoa}`);
    assert.equal(kb.status, 200);
    assert.equal((await fetch(`http://${goc}/nhan/tram/cai?tc=tc_thu&k=${'a'.repeat(40)}`)).status, 404);

    const sai = new WebSocket(`ws://${goc}/nhan/tram/ws?tc=tc_thu`);
    await new Promise((ok) => sai.addEventListener('open', ok));
    const dongSai = new Promise((ok) => sai.addEventListener('close', (e) => ok(e.code)));
    sai.send(JSON.stringify({ loai: 'chao', khoa: 'b'.repeat(40) }));
    assert.equal(await dongSai, 4001);

    const tram = new WebSocket(`ws://${goc}/nhan/tram/ws?tc=tc_thu`);
    await new Promise((ok) => tram.addEventListener('open', ok));
    const daNhan = cho(tram, (t) => t.loai === 'da_nhan');
    tram.send(JSON.stringify({ loai: 'chao', khoa, may: 'thu' }));
    await daNhan;

    const nguoi = new WebSocket(`ws://${goc}/api/tram/ws`);
    await new Promise((ok) => nguoi.addEventListener('open', ok));
    const trangThai = cho(nguoi, (t) => t.loai === 'trang_thai');
    nguoi.send(JSON.stringify({ loai: 'chao' }));
    assert.equal((await trangThai).tram_mo, true);
    const luot = cho(tram, (t) => t.loai === 'luot');
    nguoi.send(JSON.stringify({ loai: 'gui', noi_dung: 'Xin chào '.repeat(2000), model: 'sonnet' }));
    const l = await luot;
    assert.equal(l.model, 'sonnet');
    const chu = cho(nguoi, (t) => t.loai === 'su_kien' && t.su_kien.loai === 'chu');
    tram.send(JSON.stringify({ loai: 'su_kien', phien: l.phien, luot: l.luot, ds: [{ loai: 'chu', noi_dung: 'Chào bạn' }] }));
    assert.equal((await chu).su_kien.noi_dung, 'Chào bạn');
    tram.close();
    nguoi.close();
  } finally {
    await m.dong();
  }
});

test('Phòng: Claude hỏi thì phiên hiện "chờ bạn", trả lời đi tới trạm, câu đã trả lời không nhận lần hai', async () => {
  const { phong, moi } = dungPhong();
  const { khoa } = await phong.xuLy('tao-khoa');
  const tram = moi('tram');
  await phong.nhanTin(tram, JSON.stringify({ loai: 'chao', khoa }));
  const nguoi = moi('nguoi');
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'gui', noi_dung: 'Soạn kế hoạch' }));
  const luot = tin(tram, 'luot')[0];

  // Trả lời khi chưa có câu hỏi thì bị từ chối.
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'tra_loi', phien: luot.phien, id: 'q1', tra_loi: { 'Hạn?': 'Tuần sau' } }));
  assert.match(tin(nguoi, 'loi').at(-1).noi_dung, /hết hạn/);

  await phong.nhanTin(tram, JSON.stringify({ loai: 'su_kien', phien: luot.phien, luot: luot.luot, ds: [{ loai: 'hoi', id: 'q1', cau_hoi: [{ question: 'Hạn?', options: [{ label: 'Tuần sau' }] }] }] }));
  assert.equal(tin(nguoi, 'phien').at(-1).phien.cho_ban, true);

  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'tra_loi', phien: luot.phien, id: 'q1', tra_loi: { 'Hạn?': 'Tuần sau', a: 1, b: 2, c: 3, d: 4 } }));
  const di = tin(tram, 'tra_loi')[0];
  assert.equal(di.id, 'q1');
  assert.equal(di.luot, luot.luot);
  assert.equal(di.tra_loi['Hạn?'], 'Tuần sau');
  assert.ok(Object.keys(di.tra_loi).length <= 4);

  await phong.nhanTin(tram, JSON.stringify({ loai: 'su_kien', phien: luot.phien, luot: luot.luot, ds: [{ loai: 'da_tra_loi', id: 'q1', cho_phep: true }] }));
  assert.equal(tin(nguoi, 'phien').at(-1).phien.cho_ban, false);
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'tra_loi', phien: luot.phien, id: 'q1', cho_phep: true }));
  assert.equal(tin(tram, 'tra_loi').length, 1);

  // Câu hỏi và câu trả lời được lưu để mở lại phiên vẫn thấy.
  await phong.nhanTin(tram, JSON.stringify({ loai: 'xong', phien: luot.phien, luot: luot.luot, thanh_cong: true }));
  const doc = moi('nguoi');
  await phong.nhanTin(doc, JSON.stringify({ loai: 'mo', phien: luot.phien }));
  assert.deepEqual(tin(doc, 'lich_su')[0].su_kien.map((s) => s.loai), ['nguoi', 'hoi', 'da_tra_loi', 'xong']);
});

test('Trạm: câu trả lời gửi Claude Code đúng dạng cho câu hỏi và lần xin phép', () => {
  const hoi = { ten: 'AskUserQuestion', input: { questions: [{ question: 'Hạn?' }, { question: 'Người nhận?' }] } };
  assert.deepEqual(cauTraLoiQuyen(hoi, { tra_loi: { 'Hạn?': 'Tuần sau', 'Lạ?': 'x' } }), { behavior: 'allow', updatedInput: { ...hoi.input, answers: { 'Hạn?': 'Tuần sau' } } });
  assert.equal(cauTraLoiQuyen(hoi, { tra_loi: {} }).behavior, 'deny');
  assert.equal(cauTraLoiQuyen(hoi, { cho_phep: false, tra_loi: { 'Hạn?': 'a' } }).behavior, 'deny');

  const bash = { ten: 'Bash', input: { command: 'ls' } };
  assert.deepEqual(cauTraLoiQuyen(bash, { cho_phep: true }), { behavior: 'allow', updatedInput: { command: 'ls' } });
  assert.equal(cauTraLoiQuyen(bash, {}).behavior, 'deny');
  assert.equal(cauTraLoiQuyen(bash, { cho_phep: 'true' }).behavior, 'deny');

  assert.equal(chiTietXin('Bash', { command: 'npm test' }), 'npm test');
  assert.equal(chiTietXin('ExitPlanMode', { plan: '# Kế hoạch' }), '# Kế hoạch');
  assert.match(chiTietXin('mcp__x', { a: 1 }), /"a": 1/);
});
