// Bối cảnh của TỪNG việc: tin gốc không bị cắt khỏi cuộc trò chuyện dài, mỗi việc đúng dự án của nó, ghi nhớ của dự án không bị đẩy ra.
import test from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { dungBoiCanh, soanPrompt } from '../src/soan-prompt.js';
import { layGhiNhoSonicplan, layTinNguCanh, TOI_DA_TIN } from '../src/tho-claude.js';

function dung() {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  db.prepare(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'Tổ chức', '2026-10-01T00:00:00Z')`).run();
  db.prepare(`INSERT INTO du_an (id, to_chuc_id, ten, tao_luc, drive_link) VALUES (1, 'tc1', 'AI Lab', '2026-10-01T00:00:00Z', 'https://drive/ailab')`).run();
  db.prepare(`INSERT INTO du_an (id, to_chuc_id, ten, tao_luc, drive_link) VALUES (2, 'tc1', 'Khóa Marketing', '2026-10-01T00:00:00Z', NULL)`).run();
  return { db, env };
}

test('cuộc trò chuyện dài hơn giới hạn: vẫn có tin gốc và các tin gần nó, theo thứ tự thời gian', async () => {
  const { db, env } = dung();
  const dem = TOI_DA_TIN + 30;
  for (let i = 1; i <= dem; i++) {
    const luc = new Date(Date.parse('2026-10-10T00:00:00Z') + i * 60000).toISOString();
    db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai) VALUES (?1, 'tc1', 'zalo', ?2, 'An', 'Nhóm A', ?3, ?4, ?4, 'nhom:A')`).run(i, `m${i}`, `tin ${i}`, luc);
  }
  const gocId = dem - 5; // tin gốc nằm cuối cuộc trò chuyện
  const { goc, quanh } = await layTinNguCanh(env, 'tc1', { tin_nhan_id: gocId });
  assert.equal(goc.id, gocId);
  assert.equal(quanh.length, TOI_DA_TIN);
  assert.ok(quanh.some((t) => t.id === gocId), 'phải có tin gốc');
  assert.ok(quanh.some((t) => t.id === dem), 'phải có tin ngay sau tin gốc');
  assert.deepEqual(quanh.map((t) => t.id), [...quanh.map((t) => t.id)].sort((a, b) => a - b));
});

test('nhiều việc khác dự án: mỗi việc ghi đúng dự án của nó, việc không dự án không mượn dự án khác', () => {
  const nd = dungBoiCanh({
    viecList: [{ id: 1, tieu_de: 'A' }, { id: 2, tieu_de: 'B' }, { id: 3, tieu_de: 'C' }],
    duAnTheoViec: { 1: { ten: 'AI Lab', drive_link: 'https://drive/ailab' }, 2: { ten: 'Khóa Marketing' }, 3: null },
    tins: [{ goc: null, quanh: [] }, { goc: null, quanh: [] }, { goc: null, quanh: [] }],
    ghiNho: [], tep: [], goc: 'https://x',
  });
  assert.match(nd, /Việc 1: A[\s\S]*Dự án: AI Lab \(thư mục Drive: https:\/\/drive\/ailab\)/);
  assert.match(nd, /Việc 2: B[\s\S]*?Dự án: Khóa Marketing\n/);
  assert.match(nd, /Việc 3: C[\s\S]*Dự án: chưa xếp dự án/);
});

test('soạn prompt hai việc khác dự án và một việc không dự án', async () => {
  const { db, env } = dung();
  const v = (id, du) => db.prepare(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nhom, du_an_id, tao_luc, cap_nhat_luc) VALUES (?1, 'tc1', ?2, 'mo', 'anh_tu_lam', ?3, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`).run(id, `Việc ${id}`, du);
  v(10, 1); v(11, 2); v(12, null);
  const r = await soanPrompt(env, 'tc1', [10, 11, 12], {}, async () => 'Đầu ra mong muốn:\n- Bản tóm tắt ngắn gọn.\nTiêu chí xong:\n- Đủ ý.');
  assert.match(r.noi_dung, /Việc 1: Việc 10[\s\S]*?Dự án: AI Lab/);
  assert.match(r.noi_dung, /Việc 2: Việc 11[\s\S]*?Dự án: Khóa Marketing/);
  assert.match(r.noi_dung, /Việc 3: Việc 12[\s\S]*?Dự án: chưa xếp dự án/);
});

test('ghi nhớ: mục khớp tên dự án xếp trước, không bị mục ghim cũ hơn đẩy ra; nhận nhiều dự án', async () => {
  const { db, env } = dung();
  const g = (i, loai, td, ghim, luc) => db.prepare(`INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, ghim, tao_luc, cap_nhat_luc) VALUES ('tc1', ?1, ?2, 'nd', ?3, ?4, ?4)`).run(loai, td, ghim, luc);
  for (let i = 0; i < 20; i++) g(i, 'nguoi', `Người ${i}`, 1, `2026-10-20T00:00:${String(i).padStart(2, '0')}Z`);
  g(99, 'du_an', 'Khóa Marketing: lịch khai giảng', 0, '2026-10-01T00:00:00Z');
  g(98, 'du_an', 'AI Lab: tiến độ', 0, '2026-10-01T00:00:00Z');
  const ds = (await layGhiNhoSonicplan(env, 'tc1', ['Khóa Marketing', 'AI Lab'])).map((x) => x.tieu_de);
  assert.ok(ds.includes('Khóa Marketing: lịch khai giảng'));
  assert.ok(ds.includes('AI Lab: tiến độ'));
  assert.equal(ds.length, 15);
});
