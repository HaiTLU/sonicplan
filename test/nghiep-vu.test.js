// Kiểm thử phần thuần của hộp tin, việc, lịch, Telegram. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docKetQuaViec, loiNhacTachViec } from '../src/ai.js';
import { kiemViec } from '../src/api.js';
import { taoIcs } from '../src/lich-ics.js';
import { chuTuHtml, maNhanTuDiaChi } from '../src/nhan-thu.js';
import { chuyenTinZalo } from '../src/nhan-zalo.js';
import { phanTichLenh, soPhutTomTat } from '../src/telegram.js';
import { chuanHoa, congNgay, doGiong, gioVN, ngayVN, sangUTC } from '../src/tien-ich.js';
import { timTrung } from '../src/viec.js';

test('giờ Việt Nam: qua nửa đêm UTC+7 là sang ngày mới', () => {
  assert.equal(ngayVN('2026-10-11T16:59:00Z'), '2026-10-11');
  assert.equal(ngayVN('2026-10-11T17:00:00Z'), '2026-10-12');
  assert.equal(gioVN('2026-10-11T16:00:00Z'), 23);
  assert.equal(congNgay('2026-12-31', 1), '2027-01-01');
  assert.equal(sangUTC('2026-10-12', '09:30').toISOString(), '2026-10-12T02:30:00.000Z');
});

test('chống trùng việc: bỏ dấu, giống từ 80% là trùng', () => {
  assert.equal(chuanHoa('Gửi Báo cáo, tuần 42!'), 'gui bao cao tuan 42');
  assert.equal(doGiong('Gửi báo cáo tuần', 'gửi bao cao tuần'), 1);
  const ds = [{ id: 1, tieu_de: 'Gửi báo cáo tài chính quý 3 cho phòng kế toán' }];
  assert.equal(timTrung('Gửi báo cáo tài chính quý 3 cho phòng kế toán.', ds)?.id, 1);
  assert.equal(timTrung('Họp với đối tác về hợp đồng', ds), null);
});

const KHONG_KE_HOACH = { du_an: null, uu_tien: null, nhom: null, ly_do: '', cac_buoc: [], ban_nhap: '', chua_chac: null };

test('đọc kết quả AI: chịu được chữ thừa quanh JSON và bỏ giá trị sai dạng', () => {
  const ra = docKetQuaViec({ response: 'Đây là kết quả: {"viec":[{"tieu_de":" Nộp hồ sơ ","han_ngay":"2026-10-15","gio_hen":"14:00","tin_so":2},{"tieu_de":"Gọi lại","han_ngay":"thứ 6","gio_hen":"25:00"},{"tieu_de":""}]} xong' });
  assert.deepEqual(ra, [
    { tieu_de: 'Nộp hồ sơ', han_ngay: '2026-10-15', gio_hen: '14:00', ghi_chu: null, tin_so: 2, ...KHONG_KE_HOACH },
    { tieu_de: 'Gọi lại', han_ngay: null, gio_hen: null, ghi_chu: null, tin_so: null, ...KHONG_KE_HOACH },
  ]);
  assert.deepEqual(docKetQuaViec({ response: { viec: [] } }), []);
  assert.deepEqual(docKetQuaViec({ response: 'không có JSON' }), []);
  const nhac = loiNhacTachViec([{ so: 1, nguon: 'zalo', nguoi_gui: 'Lan', nhom: 'Phòng A', noi_dung: 'Mai nộp nhé', thoi_diem: 'x' }], '2026-10-11', 'Hải');
  assert.match(nhac[0].content, /2026-10-11/);
  assert.match(nhac[1].content, /\[1\] Zalo .*nhóm "Phòng A" từ Lan\nMai nộp nhé/);
});

test('lịch .ics: việc có giờ thành sự kiện 30 phút, việc không giờ thành cả ngày', () => {
  const ics = taoIcs(
    [
      { id: 1, tieu_de: 'Họp, bàn kế hoạch; quý 4', han_ngay: '2026-10-12', gio_hen: '09:00', ghi_chu: 'dòng 1\ndòng 2' },
      { id: 2, tieu_de: 'Nộp báo cáo', han_ngay: '2026-10-13', gio_hen: null },
      { id: 3, tieu_de: 'Không hạn', han_ngay: null },
    ],
    { mien: 'vd.test', bayGio: new Date('2026-10-11T00:00:00Z') },
  );
  assert.match(ics, /DTSTART:20261012T020000Z\r\nDTEND:20261012T023000Z/);
  const moGap = ics.replace(/\r\n /g, '');
  assert.ok(moGap.includes('SUMMARY:Họp\\, bàn kế hoạch\\; quý 4'));
  assert.match(moGap, /DESCRIPTION:dòng 1\\ndòng 2/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261013\r\nDTEND;VALUE=DATE:20261014/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  for (const dong of ics.split('\r\n')) assert.ok(new TextEncoder().encode(dong).length <= 75, dong);
});

test('tin Zalo từ máy Mac: nhóm và tin riêng được tách đúng', () => {
  const nhom = chuyenTinZalo({ id: '9', thread: 'Phòng Đào tạo', type: 'nhom', sender: 'Lan', time: '2026-10-11T01:00:00Z', text: 'Họp 14h' });
  assert.equal(nhom.nhom, 'Phòng Đào tạo');
  assert.equal(nhom.tieu_de, null);
  assert.equal(nhom.ma_goc, '9');
  const rieng = chuyenTinZalo({ id: 10, thread: 'Minh', type: 'ca-nhan', sender: 'Minh', time: 'sai', text: 'Chào' });
  assert.equal(rieng.nhom, null);
  assert.equal(rieng.tieu_de, 'Minh');
  assert.ok(!Number.isNaN(Date.parse(rieng.thoi_diem)));
});

test('thư: lấy mã hộp thư từ địa chỉ nhận, đổi HTML sang chữ', () => {
  assert.equal(maNhanTuDiaChi('NamHai+gmail@sonicplan.vn', 'sonicplan.vn'), 'namhai');
  assert.equal(maNhanTuDiaChi('namhai@khac.vn', 'sonicplan.vn'), null);
  assert.equal(chuTuHtml('<style>x{}</style><p>Chào&nbsp;anh</p><p>Hạn &lt;15/10&gt;</p>'), 'Chào anh\nHạn <15/10>');
});

test('lệnh Telegram và số phút tóm tắt', () => {
  assert.deepEqual(phanTichLenh('/tomtat@SonicplanBot 3h'), { lenh: 'tomtat', doi_so: '3h' });
  assert.deepEqual(phanTichLenh('chào'), { lenh: null, doi_so: 'chào' });
  assert.equal(soPhutTomTat(''), 120);
  assert.equal(soPhutTomTat('3h'), 180);
  assert.equal(soPhutTomTat('30p'), 30);
  assert.equal(soPhutTomTat('999h'), 48 * 60);
});

test('kiểm dữ liệu việc trước khi lưu', () => {
  assert.equal(kiemViec({}, { batBuocTieuDe: true }).loi, 'Nhập tên việc.');
  assert.equal(kiemViec({ tieu_de: 'A', han_ngay: '15/10' }, { batBuocTieuDe: true }).loi, 'Ngày hạn sai dạng.');
  assert.deepEqual(kiemViec({ tieu_de: ' A ', gio_hen: '' }, { batBuocTieuDe: true }).viec, { tieu_de: 'A', gio_hen: null });
  assert.deepEqual(kiemViec({ trang_thai: 'xong' }, { batBuocTieuDe: false }).viec, { trang_thai: 'xong' });
  assert.ok(kiemViec({ trang_thai: 'xoa' }, { batBuocTieuDe: false }).loi);
});
