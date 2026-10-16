import test from 'node:test';
import assert from 'node:assert/strict';
import { chamViecToChuc, docKetQuaCham, heSoHoc, mucTai, phutThuc, tinhHieuSuat } from '../src/hieu-suat.js';
import { d1, dungCsdl } from './csdl-thu.js';

// Giờ UTC; 03:00Z = 10:00 giờ Việt Nam.
const v = (id, o) => ({ id, tieu_de: `Việc ${id}`, trang_thai: 'mo', tao_luc: '2026-10-10T01:00:00Z', ...o });

test('hiệu suất: đếm xong theo ngày, trung bình, đúng hạn theo hạn gốc', () => {
  const ds = [
    v(1, { trang_thai: 'xong', xong_luc: '2026-10-12T03:00:00Z', han_goc: '2026-10-12', han_ngay: '2026-10-12', do_nang: 'vua', phut_uoc: 40, nguon: 'zalo' }),
    v(2, { trang_thai: 'xong', xong_luc: '2026-10-12T04:00:00Z', han_goc: '2026-10-11', han_ngay: '2026-10-12', do_nang: 'nhe', phut_uoc: 10, nguon: 'gmail' }),
    v(3, { trang_thai: 'xong', xong_luc: '2026-10-11T03:30:00Z', du_an_id: 5 }),
    v(4, { han_ngay: '2026-10-12', han_goc: '2026-10-10', do_nang: 'rat_nang', phut_uoc: 400 }),
    v(5, { do_nang: 'nang', phut_uoc: 120, du_an_id: 5 }),
  ];
  const hs = tinhHieuSuat(ds, '2026-10-12', [{ id: 5, ten: 'AI Lab' }], '2026-10-12T05:00:00Z');
  assert.equal(hs.so_ngay_du_lieu, 3);
  assert.equal(hs.xong.hom_nay, 2);
  assert.equal(hs.xong.phut_hom_nay, 50);
  assert.equal(hs.xong.tb7.so, 1); // 3 việc / 3 ngày có dữ liệu
  assert.equal(hs.dung_han.co_han, 2);
  assert.equal(hs.dung_han.dung, 1);
  assert.equal(hs.dung_han.ty_le, 50);
  assert.equal(hs.dung_han.qua_han_mo, 1);
  assert.equal(hs.gio.gio_dinh, 10);
  assert.equal(hs.du_an.find((d) => d.khoa === 5).ten, 'AI Lab');
  assert.equal(hs.du_an.find((d) => d.khoa === 5).phut_mo, 120);
  // Ít hơn 5 việc xong: dùng sức làm mặc định 360 phút; việc hôm nay 400 phút là quá tải.
  assert.equal(hs.tai.suc_lam, 360);
  assert.equal(hs.tai.muc, 'qua_tai');
  assert.ok(hs.tai.canh_bao);
  assert.equal(hs.mo[0].id, 4);
});

test('mức tải và thời gian thực', () => {
  assert.equal(mucTai(0.5), 'on');
  assert.equal(mucTai(0.9), 'day');
  assert.equal(mucTai(1.3), 'qua_tai');
  assert.equal(mucTai(null), 'chua_ro');
  assert.equal(phutThuc({ bat_dau_luc: '2026-10-12T01:00:00Z', xong_luc: '2026-10-12T01:45:00Z' }), 45);
  assert.equal(phutThuc({ bat_dau_luc: '2026-10-10T01:00:00Z', xong_luc: '2026-10-12T01:45:00Z' }), null);
});

test('học từ thực tế: cần 3 việc đo được', () => {
  const lam = (thuc) => ({ do_nang: 'vua', phut_uoc: 40, bat_dau_luc: '2026-10-12T01:00:00Z', xong_luc: new Date(Date.parse('2026-10-12T01:00:00Z') + thuc * 60000).toISOString() });
  assert.deepEqual(heSoHoc([lam(60), lam(80)]), {});
  assert.equal(heSoHoc([lam(60), lam(80), lam(40)]).vua, 1.5);
  assert.equal(heSoHoc([lam(600), lam(600), lam(600)]).vua, 2);
});

test('đọc kết quả AI chấm: bỏ id lạ và độ nặng sai, giới hạn phút', () => {
  const kq = docKetQuaCham('{"viec":[{"id":1,"do_nang":"nang","phut":9999},{"id":2,"do_nang":"x","phut":5},{"id":9,"do_nang":"nhe","phut":5},{"id":3,"do_nang":"nhe","phut":1}]}', [1, 2, 3]);
  assert.deepEqual(kq, [{ id: 1, do_nang: 'nang', phut: 960, ly_do: null, chua_ro: false }, { id: 3, do_nang: 'nhe', phut: 5, ly_do: null, chua_ro: false }]);
});

test('chia nhỏ: đọc đề xuất AI và không đếm hai lần việc cha', async () => {
  const { docKetQuaChia } = await import('../src/hieu-suat.js');
  assert.deepEqual(docKetQuaChia('{"viec_con":[{"tieu_de":"  Soạn  dàn ý ","phut":1},{"tieu_de":"","phut":30},{"tieu_de":"Gửi","phut":9999}]}'), [{ tieu_de: 'Soạn dàn ý', phut: 5 }, { tieu_de: 'Gửi', phut: 480 }]);
  const ds = [
    v(1, { han_ngay: '2026-10-12', do_nang: 'rat_nang', phut_uoc: 300 }),
    v(2, { han_ngay: '2026-10-12', viec_cha_id: 1, phut_uoc: 60, do_nang: 'vua' }),
    v(3, { trang_thai: 'xong', xong_luc: '2026-10-12T03:00:00Z', viec_cha_id: 1, phut_uoc: 30, do_nang: 'vua' }),
  ];
  const hs = tinhHieuSuat(ds, '2026-10-12', [], '2026-10-12T05:00:00Z');
  assert.equal(hs.tai.phut_hom_nay, 60);
  assert.deepEqual(hs.mo.find((x) => x.id === 1).con, { tong: 2, xong: 1, phut_con_lai: 60 });
});

test('đọc kết quả chấm: chấp nhận khối ```json, id dạng chữ, độ nặng có dấu', () => {
  const tra = 'Đây là kết quả:\n```json\n{"viec":[{"id":"52","do_nang":"Rất nặng","phut":240},{"id":53,"do_nang":"vừa","phut_uoc":30}]}\n```';
  assert.deepEqual(docKetQuaCham(tra, [52, 53]), [{ id: 52, do_nang: 'rat_nang', phut: 240, ly_do: null, chua_ro: false }, { id: 53, do_nang: 'vua', phut: 30, ly_do: null, chua_ro: false }]);
  assert.deepEqual(docKetQuaCham({ response: { viec: [{ id: 1, do_nang: 'nhe', phut: 10, ly_do: null, chua_ro: false }] } }, [1]), [{ id: 1, do_nang: 'nhe', phut: 10, ly_do: null, chua_ro: false }]);
  assert.deepEqual(docKetQuaCham('[{"id":1,"do_nang":"nang","phut":90}]', [1]), [{ id: 1, do_nang: 'nang', phut: 90, ly_do: null, chua_ro: false }]);
  assert.deepEqual(docKetQuaCham('{"viec":[{"id":5,"do_nang":"nhe","phut":15,"ly_do":"Tiêu đề quá chung, chưa rõ cập nhật gì","chua_ro":true}]}', [5]), [{ id: 5, do_nang: 'nhe', phut: 15, ly_do: 'Tiêu đề quá chung, chưa rõ cập nhật gì', chua_ro: true }]);
});

// Câu trả lời 25 việc bị cắt giữa mục thứ 18 như khi hết max_tokens; lý do có cả ngoặc và dấu nháy.
const muc = (id) => ({ id, do_nang: 'vua', phut: 30, ly_do: `Soạn "tờ trình" {mục ${id}} rồi gửi [phòng] duyệt`, chua_ro: false });
const traBiCat = (khoa = 'ket_qua') => {
  const du = JSON.stringify({ [khoa]: Array.from({ length: 25 }, (_, i) => muc(i + 1)) });
  return du.slice(0, du.indexOf('{"id":18,') + 40);
};

test('đọc kết quả chấm: câu trả lời bị cắt giữa chừng vẫn giữ các mục đã đủ', () => {
  const ids = Array.from({ length: 25 }, (_, i) => i + 1);
  for (const tra of [traBiCat(), traBiCat('viec'), `\`\`\`json\n${traBiCat('kq')}`, { response: traBiCat() }, JSON.stringify(Array.from({ length: 25 }, (_, i) => muc(i + 1))).slice(0, -30)]) {
    const kq = docKetQuaCham(tra, ids);
    assert.ok(kq.length >= 17, String(tra?.response ?? tra).slice(0, 40));
    assert.deepEqual(kq[0], { ...muc(1), ly_do: 'Soạn "tờ trình" {mục 1} rồi gửi [phòng] duyệt' });
    assert.ok(kq.every((x, i) => x.id === i + 1 && x.do_nang === 'vua'));
  }
  assert.equal(docKetQuaCham(traBiCat(), ids).length, 17);
  // Cắt ngay trong mục đầu tiên: không có gì để giữ.
  assert.deepEqual(docKetQuaCham('{"ket_qua":[{"id":1,"do_nang":"vua","ly_do":"Soạn {', ids), []);
});

test('chấm việc: AI trả câu bị cắt thì vẫn lưu các việc đã chấm đủ, không báo lỗi cả lượt', async () => {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  const them = db.prepare("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, tao_luc, cap_nhat_luc) VALUES (?, 'tc1', ?, 'mo', '2026-10-15T01:00:00Z', '2026-10-15T01:00:00Z')");
  for (let id = 1; id <= 25; id++) them.run(id, `Việc ${id}`);
  let hoi = 0;
  const env = { CSDL: d1(db), AI: { run: async () => { hoi++; return { response: traBiCat() }; } } };
  assert.deepEqual(await chamViecToChuc(env, 'tc1'), { so: 17 });
  assert.equal(hoi, 1);
  const da = db.prepare("SELECT id, do_nang, phut_uoc, do_nang_nguon FROM viec WHERE do_nang IS NOT NULL ORDER BY id").all();
  assert.deepEqual(da.map((x) => x.id), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.ok(da.every((x) => x.do_nang === 'vua' && x.phut_uoc === 30 && x.do_nang_nguon === 'ai'));
  // Lượt sau chỉ còn 8 việc chưa chấm.
  let canCham = [];
  env.AI.run = async (_, { messages }) => { canCham = JSON.parse(messages.at(-1).content.split('Việc cần chấm:\n')[1]).map((x) => x.id); return { response: '{"viec":[]}' }; };
  await assert.rejects(chamViecToChuc(env, 'tc1'), /AI không trả kết quả chấm đọc được/);
  assert.deepEqual(canCham.sort((a, b) => a - b), [18, 19, 20, 21, 22, 23, 24, 25]);
});
