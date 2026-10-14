import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { batDriveKho, datLaiDuAn, dongBoDuAn, gomTinTheoNgay, laMedia, tatDriveKho, thuMucDuAn, vanBanChatNgay, vanBanKetQuaClaude, vanBanLich, vanBanLichSuNgay, vanBanTongQuan } from '../src/kho-du-an.js';

const DA = { id: 1, ten: 'IPSOS', tu_khoa: '["ipsos"]' };

test('văn bản: tổng quan, lịch, lịch sử ngày, kết quả Claude', () => {
  const viec = [
    { tieu_de: 'Gửi báo giá', trang_thai: 'mo', han_ngay: '2026-10-15', gio_hen: '09:00', ghi_chu: 'cho anh Tùng' },
    { tieu_de: 'Ký NDA', trang_thai: 'xong', han_ngay: '2026-10-12' },
    { tieu_de: 'Chưa hạn', trang_thai: 'mo' },
  ];
  const tq = vanBanTongQuan(DA, viec);
  assert.match(tq, /# IPSOS/);
  assert.match(tq, /Từ khóa: ipsos/);
  assert.match(tq, /## Đang mở \(2\)/);
  const lich = vanBanLich(DA, viec).split('\n');
  assert.ok(lich.findIndex((l) => l.includes('Ký NDA')) < lich.findIndex((l) => l.includes('Gửi báo giá')), 'xếp theo ngày');
  assert.ok(!vanBanLich(DA, viec).includes('Chưa hạn'));
  const ls = vanBanLichSuNgay(DA, '2026-10-13', [{ loai: 'tao', tieu_de: 'Gửi báo giá', noi_dung: 'Gửi báo giá', luc: '2026-10-13T02:30:00Z' }]);
  assert.match(ls, /09:30 Thêm việc: Gửi báo giá/);
  const cl = vanBanKetQuaClaude({ id: 7, tieu_de: 'Soạn mail', dan: 'viết mail', ket_qua: 'Đã soạn xong', pr: 'https://x/pr/1', cap_nhat_luc: '2026-10-13T02:30:00Z' });
  assert.match(cl, /Đã soạn xong/);
  assert.match(cl, /PR: https:\/\/x\/pr\/1/);
});

test('gom tin theo nguồn và ngày giờ Việt Nam', () => {
  const m = gomTinTheoNgay([
    { nguon: 'zalo', thoi_diem: '2026-10-12T20:00:00Z' }, // 03:00 ngày 13 giờ VN
    { nguon: 'zalo', thoi_diem: '2026-10-13T01:00:00Z' },
    { nguon: 'gmail', thoi_diem: '2026-10-13T01:00:00Z' },
  ]);
  assert.deepEqual([...m.keys()], ['zalo|2026-10-13', 'gmail|2026-10-13']);
  assert.equal(m.get('zalo|2026-10-13').length, 2);
});

function csdlGia() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE du_an (id INTEGER PRIMARY KEY, to_chuc_id TEXT, ten TEXT, tu_khoa TEXT DEFAULT '[]', drive_link TEXT, drive_kho_id TEXT);
    CREATE TABLE viec (id INTEGER PRIMARY KEY, to_chuc_id TEXT, tieu_de TEXT, ghi_chu TEXT, han_ngay TEXT, gio_hen TEXT, trang_thai TEXT, du_an_id INTEGER, tin_nhan_id INTEGER, cap_nhat_luc TEXT);
    CREATE TABLE viec_su_kien (id INTEGER PRIMARY KEY, to_chuc_id TEXT, viec_id INTEGER, du_an_id INTEGER, loai TEXT, noi_dung TEXT, luc TEXT);
    CREATE TABLE tep (id INTEGER PRIMARY KEY, to_chuc_id TEXT, ten TEXT, loai TEXT, r2_khoa TEXT, du_an_id INTEGER, tin_nhan_id INTEGER);
    CREATE TABLE tin_nhan (id INTEGER PRIMARY KEY, to_chuc_id TEXT, nguon TEXT, nguoi_gui TEXT, nhom TEXT, tieu_de TEXT, noi_dung TEXT, thoi_diem TEXT, an INTEGER DEFAULT 0);
    CREATE TABLE luot_claude (id INTEGER PRIMARY KEY, to_chuc_id TEXT, viec_id INTEGER, trang_thai TEXT, dan TEXT, ket_qua TEXT, cau_hoi TEXT, pr TEXT, nhanh TEXT, tao_luc TEXT, cap_nhat_luc TEXT);
    CREATE TABLE kho_da_luu (to_chuc_id TEXT, loai TEXT, ma TEXT, drive_id TEXT, moc TEXT, luc TEXT, PRIMARY KEY (to_chuc_id, loai, ma));
    CREATE TABLE cai_dat (to_chuc_id TEXT, khoa TEXT, gia_tri TEXT, PRIMARY KEY (to_chuc_id, khoa));`);
  return { db, CSDL: { prepare: (sql) => ({ bind: (...tham) => {
    const th = [...sql.matchAll(/\?(\d+)/g)].map((m) => tham[m[1] - 1]);
    const q = db.prepare(sql.replace(/\?(\d+)/g, '?'));
    return { all: async () => ({ results: q.all(...th) }), first: async () => q.get(...th) ?? null, run: async () => ({ meta: { changes: Number(q.run(...th).changes) } }) };
  } }) }, TEP: { get: async () => ({ arrayBuffer: async () => new ArrayBuffer(4) }) } };
}

function congCu(env) {
  const ghi = [];
  let dem = 0;
  return {
    ghi,
    dc: {
      dauVan: async (s) => `h${s.length}:${s.slice(0, 30)}`,
      taoTepDrive: async (token, ten, thuMuc) => { ghi.push({ ten, thuMuc }); return `f${++dem}`; },
      ghiNhoDaLuu: async (e, tc, loai, ma, driveId, moc) => e.CSDL.prepare('INSERT INTO kho_da_luu (to_chuc_id, loai, ma, drive_id, moc, luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (to_chuc_id, loai, ma) DO UPDATE SET drive_id = excluded.drive_id, moc = excluded.moc').bind(tc, loai, ma, driveId, moc, 'x').run(),
      vanBanTinNgay: (nguon, ngay, ds) => `# ${nguon} ${ngay}\n${ds.map((t) => t.noi_dung).join('\n')}`,
      thuMucGocKho: async () => 'GOC',
    },
  };
}

test('bật Drive kho: tạo cây thư mục, gắn link; tắt thì chỉ bỏ cờ', async () => {
  const env = csdlGia();
  env.db.exec("INSERT INTO du_an (id, to_chuc_id, ten) VALUES (1, 't', 'IPSOS')");
  let moi = 0;
  const truoc = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: `d${++moi}` }), { status: 200 });
  try {
    const { dc } = congCu(env);
    const r = await batDriveKho(env, 't', 'tok', dc, 1);
    assert.ok(r.drive_kho_id && r.link.startsWith('https://drive.google.com/drive/folders/'));
    assert.equal(moi, 10, 'Dự án + thư mục dự án + 8 thư mục con');
    const d = env.db.prepare('SELECT drive_kho_id, drive_link FROM du_an WHERE id = 1').get();
    assert.equal(d.drive_kho_id, r.drive_kho_id);
    assert.equal(d.drive_link, r.link);
    assert.deepEqual(await tatDriveKho(env, 't', 1), {});
    assert.equal(env.db.prepare('SELECT drive_kho_id FROM du_an WHERE id = 1').get().drive_kho_id, null);
    assert.ok((await tatDriveKho(env, 't', 99)).loi);
  } finally { globalThis.fetch = truoc; }
});

test('đồng bộ dự án: lưu thư, Zalo, tệp, Claude, lịch sử; lần hai không ghi lại; đặt lại thì ghi lại', async () => {
  const env = csdlGia();
  env.db.exec(`INSERT INTO du_an (id, to_chuc_id, ten, drive_kho_id) VALUES (1, 't', 'IPSOS', 'GOCDA'), (2, 't', 'Khac', NULL);
    INSERT INTO tin_nhan (id, to_chuc_id, nguon, nguoi_gui, noi_dung, thoi_diem) VALUES (10, 't', 'gmail', 'Tùng', 'Mẫu NDA', '2026-10-13T02:00:00Z'), (11, 't', 'zalo', 'Hồng', 'Xin báo giá', '2026-10-13T03:00:00Z'), (12, 't', 'zalo', 'Lạ', 'Không thuộc', '2026-10-13T03:00:00Z');
    INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, du_an_id, tin_nhan_id, han_ngay, cap_nhat_luc) VALUES (1, 't', 'Gửi báo giá', 'mo', 1, 11, '2026-10-15', '2026-10-13T03:00:00Z');
    INSERT INTO tep (id, to_chuc_id, ten, loai, r2_khoa, du_an_id, tin_nhan_id) VALUES (5, 't', 'NDA.docx', 'application/msword', 'k5', 1, 10), (6, 't', 'hinh.jpg', 'image/jpeg', 'k6', 1, 10);
    INSERT INTO luot_claude (id, to_chuc_id, viec_id, trang_thai, dan, ket_qua, cau_hoi, tao_luc, cap_nhat_luc) VALUES (3, 't', 1, 'xong', 'Soạn mail', 'Đã soạn', '["Gửi cho ai?"]', '2026-10-13T03:30:00Z', '2026-10-13T04:00:00Z');
    INSERT INTO viec_su_kien (id, to_chuc_id, viec_id, du_an_id, loai, noi_dung, luc) VALUES (1, 't', 1, 1, 'tao', 'Gửi báo giá', '2026-10-13T03:00:00Z');`);
  let moi = 0;
  const truoc = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: `d${++moi}` }), { status: 200 });
  try {
    const { dc, ghi } = congCu(env);
    const r1 = await dongBoDuAn(env, 't', 'tok', dc);
    assert.deepEqual(r1.loi, []);
    const ten = ghi.map((g) => g.ten).sort();
    assert.deepEqual(ten, ['2026-10-13.md', '2026-10-13_Chat.md', '2026-10-13_Claude_3.md', '2026-10-13_Thu.md', '2026-10-13_Zalo.md', 'Lich.md', 'NDA.docx', 'Tong-quan.md', 'hinh.jpg']);
    const thu = ghi.find((g) => g.ten.endsWith('_Thu.md'));
    const zalo = ghi.find((g) => g.ten.endsWith('_Zalo.md'));
    assert.notEqual(thu.thuMuc, zalo.thuMuc, 'thư và Zalo ở hai thư mục');
    assert.notEqual(ghi.find((g) => g.ten === 'hinh.jpg').thuMuc, ghi.find((g) => g.ten === 'NDA.docx').thuMuc, 'ảnh vào Media, tài liệu vào Tep');
    assert.equal(r1.so, 9);
    const dem = ghi.length;
    const r2 = await dongBoDuAn(env, 't', 'tok', dc);
    assert.equal(r2.so, 0);
    assert.equal(ghi.length, dem, 'không đổi gì thì không ghi lại');
    // tin của dự án khác không lọt vào
    assert.ok(!ghi.some((g) => g.ten.includes('Khac')));
    await datLaiDuAn(env, 't', 1);
    assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM kho_da_luu').get().n, 0);
  } finally { globalThis.fetch = truoc; }
});

test('media nhận theo loại hoặc đuôi; chat theo ngày; liệt kê thư mục dự án', async () => {
  assert.ok(laMedia('a.bin', 'image/png') && laMedia('clip.MP4', '') && laMedia('ghi-am.m4a', null));
  assert.ok(!laMedia('NDA.docx', 'application/msword') && !laMedia('bang.xlsx', ''));
  const chat = vanBanChatNgay(DA, '2026-10-13', [{ id: 3, tieu_de: 'Soạn mail', dan: 'viết mail', ket_qua: 'Xong', cau_hoi: '["Gửi cho ai?"]', trang_thai: 'xong', tao_luc: '2026-10-13T03:30:00Z' }]);
  assert.match(chat, /10:30 - Soạn mail/);
  assert.match(chat, /Claude hỏi lại:[\s\S]*Gửi cho ai\?/);

  const env = csdlGia();
  env.db.exec("INSERT INTO du_an (id, to_chuc_id, ten) VALUES (1, 't', 'IPSOS')");
  assert.equal(await thuMucDuAn(env, 't', 99), null);
  assert.deepEqual((await thuMucDuAn(env, 't', 1)).thu_muc, []);
  let moi = 0;
  const truoc = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: `d${++moi}` }), { status: 200 });
  try {
    await batDriveKho(env, 't', 'tok', congCu(env).dc, 1);
    const r = await thuMucDuAn(env, 't', 1);
    assert.equal(r.bat, true);
    assert.equal(r.goc.duong_dan, 'Sonicplan kho/Dự án/IPSOS');
    assert.deepEqual(r.thu_muc.map((m) => m.ma), ['Thu', 'Zalo', 'Tep', 'Media', 'Claude', 'Chat', 'Lich', 'LichSu']);
    assert.ok(r.thu_muc.every((m) => m.link.startsWith('https://drive.google.com/drive/folders/') && m.duong_dan.startsWith('Sonicplan kho/Dự án/IPSOS/')));
  } finally { globalThis.fetch = truoc; }
});
