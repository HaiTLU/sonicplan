// Ghi âm và biên bản họp từ thư mục Drive: đọc liên kết, ghép tệp, đưa cuộc họp vào Hộp tin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl, r2 } from './csdl-thu.js';
import { ghepCuocHop, loaiTepHop, maThuMucTuLink, quetHop, tenGhep, tieuDeCuocHop, trichBienBan } from '../src/ghi-am-hop.js';
import { tuyChonChan } from '../src/chan-tin.js';
import { luuTichHop } from '../src/tich-hop.js';

const KHOA = Buffer.alloc(32, 9).toString('base64');
const GIO = 3600000;

test('đọc mã thư mục từ nhiều dạng liên kết Drive', () => {
  assert.equal(maThuMucTuLink('https://drive.google.com/drive/folders/1AbCdEfGhIjK_lm-no?usp=sharing'), '1AbCdEfGhIjK_lm-no');
  assert.equal(maThuMucTuLink('https://drive.google.com/drive/u/1/folders/1AbCdEfGhIjKlmno'), '1AbCdEfGhIjKlmno');
  assert.equal(maThuMucTuLink('https://drive.google.com/open?id=1AbCdEfGhIjKlmno'), '1AbCdEfGhIjKlmno');
  assert.equal(maThuMucTuLink(' 1AbCdEfGhIjKlmno '), '1AbCdEfGhIjKlmno');
  assert.throws(() => maThuMucTuLink('https://google.com'), /Không đọc được liên kết/);
});

test('nhận loại tệp: ghi âm, biên bản, bỏ tệp khác', () => {
  assert.equal(loaiTepHop({ name: 'Giao ban.m4a' }), 'ghi_am');
  assert.equal(loaiTepHop({ name: 'x', mimeType: 'audio/mpeg' }), 'ghi_am');
  assert.equal(loaiTepHop({ name: 'Biên bản.docx' }), 'bien_ban');
  assert.equal(loaiTepHop({ name: 'Biên bản', mimeType: 'application/vnd.google-apps.document' }), 'bien_ban');
  assert.equal(loaiTepHop({ name: 'anh.png' }), null);
  assert.equal(loaiTepHop({ name: 'ban-chep.json' }), null);
});

test('tên ghép bỏ chữ chỉ loại tệp', () => {
  assert.equal(tenGhep('260930 Giao ban - Biên bản.docx'), tenGhep('260930_Giao ban.m4a'));
  assert.equal(tenGhep('Ghi âm.m4a'), '');
});

const f = (id, name, gioTruoc, cha = '', them = {}) => ({ id, name, cha, createdTime: new Date(Date.parse('2026-10-13T08:00:00Z') - gioTruoc * GIO).toISOString(), ...them });

test('ghép theo tên, theo thư mục riêng, theo giờ; chọn biên bản Word trước', () => {
  const hop = ghepCuocHop([
    f('a1', '260930 Giao ban.m4a', 10),
    f('b1', '260930 Giao ban - Biên bản.md', 9),
    f('b1w', '260930 Giao ban - Biên bản.docx', 9),
    f('a2', 'rec.m4a', 5, 'SUB'),
    f('b2', 'Kết luận.docx', 4, 'SUB'),
    f('a3', 'Họp lẻ.m4a', 2),
    f('b3', 'Tổng hợp chiều.md', 1),
    f('a4', 'Sáng nay.m4a', 30),
  ]);
  const theo = Object.fromEntries(hop.map((x) => [(x.bien_ban || x.ghi_am).id, x]));
  assert.equal(theo.b1w.ghi_am.id, 'a1');
  assert.equal(theo.b1, undefined, 'bản md cùng tên bị bỏ vì đã có bản Word');
  assert.equal(theo.b2.ghi_am.id, 'a2');
  assert.equal(theo.b3.ghi_am.id, 'a3', 'cách nhau 1 giờ thì ghép');
  assert.equal(theo.a4.bien_ban, null, 'quá 3 giờ thì đứng riêng');
});

test('tên cuộc họp, trích phần kết luận', () => {
  assert.equal(tieuDeCuocHop({ bien_ban: { name: '260930_Giao ban - Biên bản.docx' } }), '260930 Giao ban');
  assert.equal(tieuDeCuocHop({ ghi_am: { name: 'Ghi âm.m4a' } }, 'Họp NIC 12-10'), 'Họp NIC 12-10');
  const dai = `${'Mở đầu. '.repeat(2000)}\nKết luận:\n- Anh Hải gửi báo giá`;
  const t = trichBienBan(dai, 1000);
  assert.ok(t.startsWith('Kết luận:'));
  assert.ok(t.length <= 1100);
});

test('cuộc họp không có nút Spam', () => {
  assert.deepEqual(tuyChonChan({ nguon: 'hop', nguoi_gui: null }), []);
});

async function dung() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc', 'Thử', '2026-10-01T00:00:00Z')`);
  const env = { CSDL: d1(db), KHOA_MA_HOA: KHOA, TEP: r2() };
  await luuTichHop(env, 'tc', 'google_client', { client_id: 'x.apps.googleusercontent.com', client_secret: 'yyyyyyyyyyyy' });
  await luuTichHop(env, 'tc', 'hop_drive', { refresh_token: 'r', email: 'a@b.c', truy_cap: 'tok', het_han: Date.now() + GIO });
  db.exec(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('tc', 'hop_thu_muc', '{"id":"ROOT0000000","ten":"Họp","tu":"2026-09-01T00:00:00Z"}')`);
  return { db, env };
}

// Drive giả: cây thư mục theo mã cha, nội dung tệp chữ theo mã tệp.
function giaDrive(cay, noiDung) {
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    const q = u.searchParams.get('q');
    if (q) {
      const cha = q.match(/'([^']+)' in parents/)[1];
      return new Response(JSON.stringify({ files: cay[cha] || [] }), { status: 200 });
    }
    const id = u.pathname.split('/').pop();
    return new Response(noiDung[id] ?? '', { status: 200 });
  };
}

test('quét thư mục: cuộc họp mới vào Hộp tin, ghi âm chờ biên bản, biên bản về sau thì bổ sung', async () => {
  const { db, env } = await dung();
  const bayGio = Date.parse('2026-10-13T08:00:00Z');
  const t = (gio) => new Date(bayGio - gio * GIO).toISOString();
  const cay = {
    ROOT0000000: [
      { id: 'SUB', name: 'Họp NIC', mimeType: 'application/vnd.google-apps.folder' },
      { id: 'a1', name: '260930 Giao ban.m4a', mimeType: 'audio/mp4', size: '9000000', createdTime: t(5), modifiedTime: t(5) },
      { id: 'b1', name: '260930 Giao ban - Biên bản.md', mimeType: 'text/markdown', size: '80', createdTime: t(4), modifiedTime: t(4) },
      { id: 'cu', name: 'Họp tháng 8.m4a', mimeType: 'audio/mp4', createdTime: '2026-08-01T00:00:00Z', modifiedTime: '2026-08-01T00:00:00Z' },
    ],
    SUB: [{ id: 'a2', name: 'Ghi âm.m4a', mimeType: 'audio/mp4', createdTime: t(1), modifiedTime: t(1) }],
  };
  const noiDung = { b1: 'Thành phần: Anh Hải, chị Lan\nKết luận:\n- Anh Hải gửi báo giá trước 15/10' };
  const truoc = globalThis.fetch;
  try {
    giaDrive(cay, noiDung);
    const kq1 = await quetHop(env, 'tc', bayGio);
    assert.deepEqual([kq1.moi, kq1.bo_sung, kq1.loi], [1, 0, []], 'ghi âm 1 giờ chưa có biên bản thì chờ; họp tháng 8 quá cũ thì bỏ');
    const tin = db.prepare(`SELECT * FROM tin_nhan WHERE nguon = 'hop'`).all();
    assert.equal(tin.length, 1);
    assert.equal(tin[0].tieu_de, '260930 Giao ban');
    assert.equal(tin[0].da_tach, 0, 'biên bản mới thì AI tách việc');
    assert.match(tin[0].noi_dung, /^Thành phần: Anh Hải, chị Lan/);
    const tep = db.prepare(`SELECT ten, drive_id, r2_khoa IS NOT NULL AS co_r2 FROM tep WHERE tin_nhan_id = ? ORDER BY id`).all(tin[0].id);
    assert.deepEqual(tep.map((x) => [x.drive_id, x.co_r2]), [['b1', 1], ['a1', 0]], 'biên bản chép vào kho, ghi âm chỉ giữ mã Drive');

    // Lần quét sau: không làm lại; ghi âm đã đủ 3 giờ thì vào riêng, không tách việc.
    const kq2 = await quetHop(env, 'tc', bayGio + 3 * GIO);
    assert.deepEqual([kq2.moi, kq2.bo_sung], [1, 0]);
    const rieng = db.prepare(`SELECT * FROM tin_nhan WHERE ma_goc = 'hop:a2'`).get();
    assert.equal(rieng.tieu_de, 'Họp NIC');
    assert.equal(rieng.da_tach, 1);

    // Biên bản về sau trong cùng thư mục: gắn vào tin cũ, mở lại cho AI đọc.
    cay.SUB.push({ id: 'b2', name: 'Biên bản.md', mimeType: 'text/markdown', size: '40', createdTime: t(-3), modifiedTime: t(-3) });
    noiDung.b2 = 'Kết luận: Anh Hải liên hệ NIC';
    const kq3 = await quetHop(env, 'tc', bayGio + 4 * GIO);
    assert.deepEqual([kq3.moi, kq3.bo_sung], [0, 1]);
    const sau = db.prepare(`SELECT * FROM tin_nhan WHERE ma_goc = 'hop:a2'`).get();
    assert.equal(sau.da_tach, 0);
    assert.match(sau.noi_dung, /liên hệ NIC/);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM tin_nhan WHERE nguon = 'hop'`).get().n, 2);

    const kq4 = await quetHop(env, 'tc', bayGio + 5 * GIO);
    assert.deepEqual([kq4.moi, kq4.bo_sung], [0, 0], 'không còn gì mới');
  } finally {
    globalThis.fetch = truoc;
  }
});
