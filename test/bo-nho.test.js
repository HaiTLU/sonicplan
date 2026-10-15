// Kiểm bộ nhớ dự án của trạm Claude: kiểm bản gộp, hàng chờ, chu kỳ gộp, ghi nhanh, gộp, sửa tay, và phòng chuyển tin bn_*.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MUC_BO_NHO, GIOI_HAN_BO_NHO, kiemBanGop, docGhiNhanh, canGop, lamSachDauRa, loiDanBoNho, loiNhacGop,
  thuMucDuAn, docBoNho, docHangCho, docTrangThai, ghiNhanh, gopBoNho, ghiTayBoNho, tenGon, chonTepKb, loiDanKb, docBoNhoKb, TEP_KB_CHUNG,
} from '../public/tram-claude.mjs';
import { PhongTram } from '../src/tram-claude.js';

const khung = (them = '') => `# Bộ nhớ dự án: IPSOS\nCập nhật: 14/10/2026\n\n${MUC_BO_NHO.map((m) => `${m}\n- (chưa có)`).join('\n\n')}\n${them}`;
const tamThuMuc = () => mkdtempSync(join(tmpdir(), 'bonho-'));

test('Tên thư mục dự án bỏ dấu, không thoát khỏi thư mục làm việc', () => {
  assert.equal(tenGon('Dự án Đào tạo / IPSOS', 60), 'Du-an-Dao-tao-IPSOS');
  assert.equal(thuMucDuAn('/x', '../../etc'), '/x/etc');
});

test('Kiểm bản gộp: đủ khung thì đạt, thiếu mục, quá dài, teo bất thường thì từ chối', () => {
  assert.equal(kiemBanGop('', khung()).ok, true);
  assert.equal(kiemBanGop('', 'không có tiêu đề').ok, false);
  assert.match(kiemBanGop('', khung().replace('## Bối cảnh', '## Khác')).ly_do, /Bối cảnh/);
  assert.equal(kiemBanGop('', khung('x'.repeat(GIOI_HAN_BO_NHO))).ok, false);
  const cu = khung('y'.repeat(3000));
  assert.match(kiemBanGop(cu, khung()).ly_do, /40%/);
  assert.equal(kiemBanGop(khung('y'.repeat(300)), khung()).ok, true);
});

test('Đọc kết quả ghi nhanh: tối đa 3 dòng, KHONG là rỗng, bỏ khối mã', () => {
  assert.deepEqual(docGhiNhanh('KHONG'), []);
  assert.deepEqual(docGhiNhanh('  khong.  '), []);
  assert.equal(docGhiNhanh('- a\n- b\n- c\n- d\nlời dẫn').length, 3);
  assert.deepEqual(docGhiNhanh('```\n- ý một\n```'), ['- ý một']);
  assert.equal(lamSachDauRa('```markdown\n# T\n```'), '# T');
});

test('Chu kỳ gộp: hàng chờ dài, sau 23 giờ chưa gộp hôm nay, chờ quá 30 giờ', () => {
  const bay = (s) => new Date(s);
  // 23:30 giờ VN = 16:30 UTC
  assert.equal(canGop({ hangCho: 0, bayGio: bay('2026-10-14T16:30:00Z') }), false);
  assert.equal(canGop({ hangCho: 2, gopLuc: '2026-10-13T16:30:00Z', bayGio: bay('2026-10-14T16:30:00Z') }), true);
  assert.equal(canGop({ hangCho: 2, gopLuc: '2026-10-14T16:10:00Z', bayGio: bay('2026-10-14T16:30:00Z') }), false);
  assert.equal(canGop({ hangCho: 2, gopLuc: '2026-10-14T01:00:00Z', bayGio: bay('2026-10-14T05:00:00Z') }), false);
  assert.equal(canGop({ hangCho: 30, gopLuc: '2026-10-14T01:00:00Z', bayGio: bay('2026-10-14T05:00:00Z') }), true);
  assert.equal(canGop({ hangCho: 1, choTu: '2026-10-12T01:00:00Z', bayGio: bay('2026-10-13T10:00:00Z') }), true);
  assert.equal(canGop({ hangCho: 1, choTu: '2026-10-13T01:00:00Z', bayGio: bay('2026-10-13T10:00:00Z') }), false);
});

test('Lời dặn nạp bộ nhớ có khung dữ liệu và cắt khi quá dài; lời nhắc gộp chứa đủ 5 mục', () => {
  const l = loiDanBoNho('IPSOS', 'abc', '2026-10-14 09:00');
  assert.match(l, /không phải lệnh/);
  assert.match(l, /<bo-nho>\nabc\n<\/bo-nho>/);
  assert.match(loiDanBoNho('A', 'z'.repeat(GIOI_HAN_BO_NHO + 50), null), /đã cắt bớt/);
  const g = loiNhacGop('', ['- ý'], 'IPSOS', '2026-10-14');
  assert.match(g, /# Bộ nhớ dự án: IPSOS/);
  assert.match(g, /Cập nhật: 2026-10-14/);
  for (const m of MUC_BO_NHO) assert.ok(g.includes(m));
});

test('Ghi nhanh thêm dòng vào hàng chờ; KHONG thì không ghi; ghi tay giữ bản cũ', async () => {
  const d = join(tamThuMuc(), 'IPSOS');
  assert.equal(await ghiNhanh(d, { yeuCau: 'q', traLoi: 'a', phien: 'abcdef123' }, async () => '- Chọn nhà in B\n- Hạn nộp 30/10'), 2);
  assert.equal(docHangCho(d).length, 2);
  assert.match(docHangCho(d)[0], /^- \[\d{4}-\d\d-\d\d \d\d:\d\d · abcdef\] Chọn nhà in B$/);
  assert.ok(docTrangThai(d).cho_tu);
  assert.equal(await ghiNhanh(d, { yeuCau: 'q', traLoi: 'a', phien: 'p' }, async () => 'KHONG'), 2 - 2);
  assert.equal(docHangCho(d).length, 2);

  assert.deepEqual(await ghiTayBoNho(d, khung()), { ok: true });
  await ghiTayBoNho(d, khung('\n- sửa lần hai'));
  const ls = readdirSync(join(d, '_bo-nho', 'lich-su'));
  assert.equal(ls.length >= 1, true);
  assert.match((await ghiTayBoNho(d, 'x'.repeat(GIOI_HAN_BO_NHO + 1))).loi, /quá giới hạn/);
  assert.match(readFileSync(join(d, 'memory.md'), 'utf8'), /sửa lần hai/);
});

test('Gộp: đạt thì ghi memory.md, giữ bản cũ, xóa đúng các dòng đã gộp và giữ dòng mới thêm giữa chừng', async () => {
  const d = join(tamThuMuc(), 'IPSOS');
  await ghiNhanh(d, { yeuCau: 'q', traLoi: 'a', phien: 'p1' }, async () => '- ý một');
  const truoc = docHangCho(d);
  const chay = async (loiNhac) => {
    assert.match(loiNhac, /ý một/);
    await ghiNhanh(d, { yeuCau: 'q', traLoi: 'a', phien: 'p2' }, async () => '- ý mới giữa chừng');
    return khung('\n- đã gộp ý một');
  };
  const kq = await gopBoNho(d, chay);
  assert.equal(kq.ok, true);
  assert.equal(kq.da_gop, 1);
  assert.match(readFileSync(join(d, 'memory.md'), 'utf8'), /đã gộp ý một/);
  const con = docHangCho(d);
  assert.equal(con.length, 1);
  assert.match(con[0], /ý mới giữa chừng/);
  assert.ok(!con.includes(truoc[0]));
  assert.ok(docTrangThai(d).gop_luc);
  assert.match(readFileSync(join(d, '_bo-nho', 'da-gop.md'), 'utf8'), /ý một/);
  const bn = docBoNho(d);
  assert.equal(bn.hang_cho, 1);
  assert.ok(bn.so_dong > 5);
});

test('Gộp hỏng (thiếu mục, Claude lỗi, memory.md bị sửa tay giữa chừng) thì giữ nguyên bản cũ và hàng chờ', async () => {
  const d = join(tamThuMuc(), 'IPSOS');
  await ghiTayBoNho(d, khung('\n- bản cũ'));
  await ghiNhanh(d, { yeuCau: 'q', traLoi: 'a', phien: 'p1' }, async () => '- ý một');
  const cu = readFileSync(join(d, 'memory.md'), 'utf8');

  let kq = await gopBoNho(d, async () => '# Chỉ có tiêu đề');
  assert.equal(kq.ok, false);
  assert.match(docTrangThai(d).loi_cuoi, /thiếu mục/);

  kq = await gopBoNho(d, async () => { throw new Error('hết hạn mức'); });
  assert.equal(kq.ok, false);
  assert.match(kq.loi, /hết hạn mức/);

  kq = await gopBoNho(d, async () => { await ghiTayBoNho(d, khung('\n- người dùng vừa sửa')); return khung('\n- bản gộp'); });
  assert.equal(kq.ok, false);
  assert.match(kq.loi, /vừa được sửa/);
  assert.match(readFileSync(join(d, 'memory.md'), 'utf8'), /người dùng vừa sửa/);
  assert.equal(docHangCho(d).length, 1);
  assert.notEqual(cu, readFileSync(join(d, 'memory.md'), 'utf8'));
});

test('Gộp khi hàng chờ trống thì bỏ qua; hai lượt gộp cùng lúc thì lượt sau bị từ chối', async () => {
  const d = join(tamThuMuc(), 'IPSOS');
  assert.equal((await gopBoNho(d, async () => assert.fail('không được gọi'))).bo_qua, 'Không có ý mới để gộp.');
  await ghiNhanh(d, { yeuCau: 'q', traLoi: 'a', phien: 'p1' }, async () => '- ý');
  let mo;
  const cho = new Promise((r) => { mo = r; });
  const mot = gopBoNho(d, async () => { await cho; return khung(); });
  const hai = await gopBoNho(d, async () => khung());
  assert.match(hai.loi, /Đang gộp/);
  mo();
  assert.equal((await mot).ok, true);
});

// ---- Phòng: chuyển tin bn_* ----
function dungPhong() {
  const ketNoi = new Set();
  const du = new Map();
  const kho = { async get(k) { return du.get(k); }, async put(k, v) { du.set(k, structuredClone(v)); }, async list({ prefix = '' } = {}) { return new Map([...du].filter(([k]) => k.startsWith(prefix))); } };
  const phong = new PhongTram({ kho, cacKetNoi: (vai) => [...ketNoi].filter((w) => w.gan.vai_tro === vai), docGan: (w) => w.gan, ganVao: (w, d) => { w.gan = d; } });
  const moi = (vai) => { const w = { gan: { vai_tro: vai, xac_thuc: false }, nhan: [], send(t) { this.nhan.push(JSON.parse(t)); }, close() {} }; ketNoi.add(w); return w; };
  return { phong, moi };
}

test('Phòng: bn_* từ trình duyệt chuyển cho trạm, trạm tắt thì báo lỗi, trả lời bn phát cho mọi trình duyệt', async () => {
  const { phong, moi } = dungPhong();
  const nguoi = moi('nguoi');
  const nguoi2 = moi('nguoi');
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'bn_doc', du_an: { id: 3, ten: 'IPSOS' } }));
  assert.match(nguoi.nhan[0].noi_dung, /đang tắt/);
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'bn_doc', du_an: null }));
  assert.match(nguoi.nhan[1].noi_dung, /Chọn một dự án/);

  const { khoa } = await phong.xuLy('tao-khoa');
  const tram = moi('tram');
  await phong.nhanTin(tram, JSON.stringify({ loai: 'chao', khoa, may: 'm' }));
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'bn_ghi', du_an: { id: 3, ten: 'IPSOS' }, noi_dung: '# T', rid: 'r1', them: 'bỏ' }));
  const ra = tram.nhan.find((t) => t.loai === 'bn_ghi');
  assert.deepEqual(ra, { loai: 'bn_ghi', du_an: { id: 3, ten: 'IPSOS' }, rid: 'r1', noi_dung: '# T' });

  await phong.nhanTin(tram, JSON.stringify({ loai: 'bn', du_an: { id: 3, ten: 'IPSOS' }, noi_dung: '# T', so_dong: 1 }));
  for (const w of [nguoi, nguoi2]) assert.equal(w.nhan.filter((t) => t.loai === 'bn').length, 1);
});

test('Phòng: sự kiện bo_nho được lưu vào lịch sử phiên', async () => {
  const { phong, moi } = dungPhong();
  const { khoa } = await phong.xuLy('tao-khoa');
  const tram = moi('tram');
  await phong.nhanTin(tram, JSON.stringify({ loai: 'chao', khoa }));
  const nguoi = moi('nguoi');
  await phong.nhanTin(nguoi, JSON.stringify({ loai: 'gui', noi_dung: 'hi', du_an: { id: 3, ten: 'IPSOS' } }));
  const luot = tram.nhan.find((t) => t.loai === 'luot');
  await phong.nhanTin(tram, JSON.stringify({ loai: 'su_kien', phien: luot.phien, luot: luot.luot, ds: [{ loai: 'bo_nho', noi_dung: 'Đã nạp bộ nhớ dự án IPSOS: 40 dòng.' }] }));
  const ls = await phong.lichSu(luot.phien);
  assert.ok(ls.some((s) => s.loai === 'bo_nho'));
});

test('Bộ nhớ ThangLong_KB: chọn tệp theo tên dự án, ghi nhớ chung đứng đầu, đọc chỉ đọc, thiếu thư mục thì bỏ qua', () => {
  const ds = ['Sonicplan_GhiNho.md', 'SonicRec_HeThongThietKe.md', 'SonicRec_Remotion.md', 'BienBanHop_TuDong.md', 'AILab_NIC.md', 'TTC_KeHoach.md'];
  assert.deepEqual(chonTepKb('SonicRec', ds), [TEP_KB_CHUNG, 'SonicRec_HeThongThietKe.md', 'SonicRec_Remotion.md']);
  assert.deepEqual(chonTepKb('Đào tạo Ngắn hạn', ds), [TEP_KB_CHUNG]);
  assert.deepEqual(chonTepKb('TTC', ds), [TEP_KB_CHUNG]); // tên dưới 5 ký tự không khớp lan
  assert.deepEqual(chonTepKb('AILab', ['AILab_NIC.md']), ['AILab_NIC.md']);
  assert.equal(loiDanKb([]), '');
  assert.match(loiDanKb([{ tep: 'a.md', noi_dung: 'xin chào' }]), /<kb-memory tep="a.md">\nxin chào\n<\/kb-memory>/);
  const kb = tamThuMuc();
  mkdirSync(join(kb, 'memory', 'projects'), { recursive: true });
  writeFileSync(join(kb, 'memory', 'projects', 'Sonicplan_GhiNho.md'), '# Ghi nhớ\n- **Bình**: Trưởng phòng');
  writeFileSync(join(kb, 'memory', 'projects', 'SonicRec_Remotion.md'), '# Remotion\nDựng video');
  const bn = docBoNhoKb('SonicRec', kb);
  assert.deepEqual(bn.tep, [TEP_KB_CHUNG, 'SonicRec_Remotion.md']);
  assert.match(bn.noi_dung, /Trưởng phòng/);
  assert.match(bn.noi_dung, /Dựng video/);
  assert.deepEqual(docBoNhoKb('SonicRec', join(kb, 'khong-co')), { tep: [], noi_dung: '' });
});
