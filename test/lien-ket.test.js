import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { docKetQuaLo, loiNhacTachViec } from '../src/ai.js';
import { ghiLienKet } from '../src/viec.js';

function csdlGia() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE viec (id INTEGER PRIMARY KEY, to_chuc_id TEXT, tieu_de TEXT, ghi_chu TEXT, trang_thai TEXT, cap_nhat_luc TEXT);
    CREATE TABLE tep (id INTEGER PRIMARY KEY, to_chuc_id TEXT, tin_nhan_id INTEGER, ten TEXT);
    INSERT INTO viec VALUES (52, 't', 'Liên hệ IPSOS xin bản revised Proposal, báo giá', 'Zalo, Hong Nguyen', 'mo', NULL);
    INSERT INTO tep VALUES (1, 't', 900, '261013_Gmail_Proposal.pdf'), (2, 't', 900, '261013_Gmail_BaoGia.pdf');`);
  const chay = (sql, tham) => {
    const q = db.prepare(sql.replace(/\?(\d+)/g, '?'));
    const th = [...sql.matchAll(/\?(\d+)/g)].map((m) => tham[m[1] - 1]);
    return { q, th };
  };
  return {
    db,
    CSDL: { prepare: (sql) => ({ bind: (...tham) => {
      const { q, th } = chay(sql, tham);
      return { all: async () => ({ results: q.all(...th) }), first: async () => q.get(...th) ?? null, run: async () => { q.run(...th); return {}; } };
    } }) },
  };
}

test('thư IPSOS gửi tài liệu: gắn tiến độ và tên tệp vào việc đang chờ, không tạo việc mới', async () => {
  const kq = docKetQuaLo('{"viec":[],"lien_ket":[{"viec":"V52","tin_so":1,"tien_do":"IPSOS đã gửi Proposal và báo giá","xong":true},{"viec":"V999","tin_so":1,"tien_do":"không có việc này"},{"viec":"abc","tien_do":"x"}]}');
  assert.equal(kq.viec.length, 0);
  assert.equal(kq.lien_ket.length, 2);
  const env = csdlGia();
  const tin = [{ id: 900, nguon: 'gmail', nguoi_gui: 'IPSOS <a@ipsos.com>', tieu_de: 'Revised Proposal' }];
  assert.equal(await ghiLienKet(env, 't', kq.lien_ket, tin, new Set([52])), 1);
  const v = env.db.prepare('SELECT ghi_chu FROM viec WHERE id = 52').get();
  assert.match(v.ghi_chu, /IPSOS đã gửi Proposal và báo giá/);
  assert.match(v.ghi_chu, /261013_Gmail_Proposal\.pdf, 261013_Gmail_BaoGia\.pdf/);
  assert.match(v.ghi_chu, /anh xem rồi đóng việc/);
  assert.equal(await ghiLienKet(env, 't', kq.lien_ket, tin, new Set([52])), 0); // gọi lại không ghi trùng
});

test('lời nhắc có danh sách việc đang mở và nguyên tắc cho thư', () => {
  const nd = loiNhacTachViec([{ so: 1, nguon: 'gmail', noi_dung: 'x', thoi_diem: 't' }], '2026-10-13', 'Hải', [], [], [], [{ id: 52, tieu_de: 'Liên hệ IPSOS' }]);
  assert.match(nd[1].content, /\[V52\] Liên hệ IPSOS/);
  assert.match(nd[0].content, /Thư \(Gmail\) cũng theo đúng/);
});
