// Bộ nhớ hai tầng bước 2: độ tin cậy, lịch sử phiên bản, xóa thật, nhật ký ngày từ bộ não, lọc và phân trang.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { ghiNhoChoAi, luuGhiNho, nguCanhNgay, xoaThatGhiNho } from '../src/ghi-nho.js';
import { xuLyGhiNho } from '../src/api/ghi-nho.js';

function moi() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('A', 'A', '2026-01-01'), ('B', 'B', '2026-01-01')`);
  return { db, env: { CSDL: d1(db) } };
}
const dem = (db, bang, tc = 'A') => db.prepare(`SELECT COUNT(*) n FROM ${bang} WHERE to_chuc_id = ?`).get(tc).n;

test('chỉ nạp vào lời nhắc mục đủ tin; mục AI dự phòng chờ lặp lại', async () => {
  const { env } = moi();
  await luuGhiNho(env, 'A', [{ loai: 'nguoi', tieu_de: 'Chị Lan', noi_dung: 'Trưởng phòng' }]);
  await luuGhiNho(env, 'A', [{ loai: 'su_that', tieu_de: 'Giờ họp', noi_dung: 'Họp sáng thứ Năm' }], { doTinCay: 'thap' });
  const ra = await ghiNhoChoAi(env, 'A', 'họp');
  assert.equal(ra.length, 1);
  assert.match(ra[0], /Chị Lan/);
});

test('mục AI thấp tin lên cao sau khi gặp lại cùng nội dung ba lần', async () => {
  const { db, env } = moi();
  const m = [{ loai: 'su_that', tieu_de: 'Giờ họp', noi_dung: 'Họp sáng thứ Năm' }];
  await luuGhiNho(env, 'A', m, { doTinCay: 'thap' });
  assert.equal((await ghiNhoChoAi(env, 'A', '')).length, 0);
  await luuGhiNho(env, 'A', m, { doTinCay: 'thap' });
  await luuGhiNho(env, 'A', m, { doTinCay: 'thap' });
  const r = db.prepare('SELECT do_tin_cay, do_tin_cay_so, so_lan_thay FROM ghi_nho').get();
  assert.equal(r.do_tin_cay, 'cao');
  assert.ok(r.do_tin_cay_so >= 0.6);
  assert.equal((await ghiNhoChoAi(env, 'A', '')).length, 1);
});

test('mục hết hiệu lực hoặc hết hạn không vào lời nhắc', async () => {
  const { db, env } = moi();
  await luuGhiNho(env, 'A', [{ loai: 'su_that', tieu_de: 'Cũ', noi_dung: 'a' }, { loai: 'su_that', tieu_de: 'Hết hạn', noi_dung: 'b' }, { loai: 'su_that', tieu_de: 'Còn', noi_dung: 'c' }]);
  db.exec(`UPDATE ghi_nho SET het_hieu_luc_luc = '2026-01-01' WHERE tieu_de = 'Cũ'; UPDATE ghi_nho SET han_dung = '2020-01-01' WHERE tieu_de = 'Hết hạn'`);
  const ra = await ghiNhoChoAi(env, 'A', '');
  assert.equal(ra.length, 1);
  assert.match(ra[0], /Còn/);
});

test('AI đổi nội dung thì bản cũ vào lịch sử; xóa thật xóa cả lịch sử và chỉ mục, không đụng tổ chức khác', async () => {
  const { db, env } = moi();
  await luuGhiNho(env, 'A', [{ loai: 'nguoi', tieu_de: 'Chị Lan', noi_dung: 'Trưởng phòng' }]);
  await luuGhiNho(env, 'B', [{ loai: 'nguoi', tieu_de: 'Chị Lan', noi_dung: 'Kế toán' }]);
  await luuGhiNho(env, 'A', [{ loai: 'nguoi', tieu_de: 'Chị Lan', noi_dung: 'Phó hiệu trưởng' }]);
  assert.equal(dem(db, 'bo_nho_lich_su'), 1);
  const id = db.prepare("SELECT id FROM ghi_nho WHERE to_chuc_id = 'A'").get().id;
  assert.equal(await xoaThatGhiNho(env, 'B', id), 0, 'tổ chức khác không xóa được');
  assert.equal(await xoaThatGhiNho(env, 'A', id), 1);
  assert.equal(dem(db, 'ghi_nho'), 0);
  assert.equal(dem(db, 'bo_nho_lich_su'), 0);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM ghi_nho_fts WHERE ghi_nho_fts MATCH '"truong" OR "pho"'`).get().n, 0);
  assert.equal(dem(db, 'ghi_nho', 'B'), 1);
});

test('nguCanhNgay: lấy đúng ngày, chỉ daily và sonicplan, bỏ mục chứa bí mật, cắt độ dài', async () => {
  const ds = [
    { duong_dan: 'memory/daily/2026-11-05.md', noi_dung: '# 5/11\nHọp với chị Lan về khóa AI' },
    { duong_dan: 'memory/sonicplan/2026-11-05.md', noi_dung: 'Việc xong: nộp tờ trình' },
    { duong_dan: 'memory/projects/2026-11-05-x.md', noi_dung: 'không phải nhật ký' },
    { duong_dan: 'memory/daily/2026-11-04.md', noi_dung: 'ngày khác' },
  ];
  const env = { SECOND_BRAIN: { doc: async () => ({ ds }) } };
  const ra = await nguCanhNgay(env, 'A', '2026-11-05');
  assert.equal(ra.length, 2);
  assert.ok(ra.every((x) => x.includes('2026-11-05')));
  assert.ok(!ra.join('').includes('ngày khác'));
  assert.deepEqual(await nguCanhNgay({}, 'A', '2026-11-05'), []);
  assert.deepEqual(await nguCanhNgay(env, 'A', 'x; DROP'), []);
  ds.push({ duong_dan: 'memory/daily/2026-11-06.md', noi_dung: 'mật khẩu là abc123' });
  assert.deepEqual(await nguCanhNgay(env, 'A', '2026-11-06'), []);
  assert.ok((await nguCanhNgay(env, 'A', '2026-11-05', 30)).join('').length < 120);
});

test('API: lọc nguồn, ghim và phân trang 60 mục', async () => {
  const { db, env } = moi();
  const them = db.prepare("INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, nguon, ghim, tao_luc, cap_nhat_luc) VALUES ('A','su_that',?,?,?,?,?,?)");
  for (let i = 0; i < 70; i++) them.run(`Mục ${i}`, 'nd', i % 2 ? 'ai' : 'tay', i === 3 ? 1 : 0, '2026-01-01', `2026-02-${String(1 + (i % 27)).padStart(2, '0')}`);
  const phien = { to_chuc: { id: 'A', vai_tro: 'chu' }, nguoi_dung: { id: 1 } };
  const goi = async (q) => (await xuLyGhiNho(new Request(`http://x/api/ghi-nho${q}`), env, phien, new URL(`http://x/api/ghi-nho${q}`))).json();
  const t1 = await goi('');
  assert.equal(t1.ghi_nho.length, 60);
  assert.equal(t1.con, true);
  const t2 = await goi('?lech=60');
  assert.equal(t2.ghi_nho.length, 10);
  assert.equal(t2.con, false);
  assert.equal((await goi('?ghim=1')).ghi_nho.length, 1);
  assert.ok((await goi('?nguon=ai')).ghi_nho.every((g) => g.nguon === 'ai'));
  assert.equal((await goi('?nguon=ai&lech=0')).tong, 70);
});

import { chatTuDo, traLoiTuBoNho, tongHopAi } from '../src/ai.js';
import { dungBoiCanh } from '../src/soan-prompt.js';

const NK = ['[nhật ký 2026-11-06] Họp với chị Lan về khóa AI'];
const envAi = (ghi) => ({ AI: { run: async (_m, tham) => { ghi.tham = tham; return { response: 'ok' }; } } });

test('nhật ký ngày: vào bối cảnh soạn prompt, tổng hợp, chat và hỏi; không có thì không thêm mục', async () => {
  const co = dungBoiCanh({ viecList: [{ id: 1, tieu_de: 'V', nhom: 'anh_tu_lam' }], duAn: null, tins: [{ goc: null, quanh: [] }], ghiNho: [], tep: [], goc: 'https://x', nhatKy: NK });
  assert.match(co, /Nhật ký hôm nay trong bộ não/);
  assert.ok(co.includes('chị Lan'));
  const khong = dungBoiCanh({ viecList: [{ id: 1, tieu_de: 'V', nhom: 'anh_tu_lam' }], duAn: null, tins: [{ goc: null, quanh: [] }], ghiNho: [], tep: [], goc: 'https://x' });
  assert.ok(!khong.includes('Nhật ký hôm nay'));

  let g = {};
  await tongHopAi(envAi(g), { homNay: '2026-11-06', viecMo: [], tin: [], nhatKy: NK });
  assert.ok(g.tham.messages[1].content.includes('chị Lan'));
  assert.match(g.tham.messages[0].content, /nhật ký/i);

  g = {};
  await chatTuDo(envAi(g), 'hôm nay sao?', [], [], [], { nhatKy: NK });
  assert.ok(g.tham.messages[0].content.includes('chị Lan'));
  g = {};
  await chatTuDo(envAi(g), 'hôm nay sao?', [], [], [], {});
  assert.ok(!g.tham.messages[0].content.includes('Nhật ký'));

  g = {};
  await traLoiTuBoNho(envAi(g), 'sao?', [], [], { nhatKy: NK });
  assert.ok(g.tham.messages[1].content.includes('chị Lan'));
});
