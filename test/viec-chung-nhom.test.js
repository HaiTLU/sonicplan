// Việc chung của nhóm và tài liệu chuyển tiếp xin ý kiến: lời dặn có quy tắc, bộ lọc code không chặn nhầm, nhận ra dự án theo tên riêng. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { laViecVanVat, tachViecChoToChuc } from '../src/viec.js';
import { loiNhacTachViec } from '../src/ai.js';
import { chonDuAn } from '../src/du-an.js';

test('lời dặn có quy tắc việc chung của nhóm và tài liệu xin ý kiến, không chặn mua đồ', () => {
  const [he] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'a' }], '2026-10-19', 'Hải');
  assert.match(he.content, /16\) Việc chung của nhóm/);
  assert.match(he.content, /17\) Chuyển tiếp tài liệu để xin ý kiến/);
  assert.match(he.content, /trừ việc chung theo nguyên tắc 16/);
});

test('bộ lọc vụn vặt giữ việc chung có sự kiện, kinh phí, đầu mối', () => {
  assert.equal(laViecVanVat({ tieu_de: 'Chuẩn bị trà sữa và hoa hưởng ứng sự kiện ngày mai' }), false);
  assert.equal(laViecVanVat({ tieu_de: 'Mua trà sữa và hoa cho chị em', ghi_chu: 'Dũng lên kinh phí, chưa có đầu mối đặt hoa' }), false);
  assert.equal(laViecVanVat({ tieu_de: 'Mua trà sữa cho cô giáo' }), true);
});

test('đoạn chat nhóm bàn trà sữa và hoa thành một việc của anh', async () => {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  let lời = '';
  const AI = { run: async (_m, { messages }) => { lời = messages[1].content; return { response: JSON.stringify({ viec: [{ tieu_de: 'Chuẩn bị trà sữa và hoa hưởng ứng sự kiện ngày mai', han_ngay: '2026-10-20', nhom: 3, tin_so: 2, ghi_chu: 'Dũng lên kinh phí và chọn hãng trà sữa; chưa có đầu mối đặt hoa' }] }) }; } };
  const env = { CSDL: d1(db), AI };
  const them = (nguoi, noi, gio) => db.prepare(
    `INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai, da_tach) VALUES ('tc1','zalo',?,?,'Anh em TTC',?,?,?,'nhom:ttc',0)`,
  ).run(`${Math.random()}`, nguoi, noi, `2026-10-19T0${gio}:00:00Z`, `2026-10-19T0${gio}:00:00Z`);
  them('Trần Tiến Dũng', 'em đề xuất nay mời chị em trà sữa', 2);
  them('Tôi', 'thêm bó hoa nhé', 3);
  them('Tôi', '@Trần Tiến Dũng lên kinh phí đi nhé', 4);
  const kq = await tachViecChoToChuc(env, 'tc1');
  assert.equal(kq.so_viec, 1);
  assert.match(lời, /thêm bó hoa nhé/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM viec').get().n, 1);
});

test('nhận ra dự án CPG - TLU theo từ riêng, bỏ từ TLU chung nhiều dự án', () => {
  const DA = [
    { id: 1, ten: 'CPG - TLU', tu_khoa: [] },
    { id: 2, ten: 'AI Lab - TLU', tu_khoa: [] },
    { id: 3, ten: 'NCS K5 TLU', tu_khoa: [] },
  ];
  assert.equal(chonDuAn(DA, null, 'Bác ơi, bên CPG gửi bản thiết kế ý tưởng của không gian chung'), 1);
  assert.equal(chonDuAn(DA, null, 'họp TLU chiều nay'), null);
  assert.equal(chonDuAn(DA, null, 'CPG và AI Lab'), null);
});
