// Kiểm thử phần thuần của nối Google: địa chỉ đăng nhập, đọc thư Gmail, dựng việc và sự kiện.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUYEN_DRIVE, thanTaiLen, diaChiGoiLai, emailTuIdToken, kiemClient, QUYEN, taoDiaChiDangNhap, thanSuKien, thanTask, tepTuThuGmail, tinTuThuGmail } from '../src/google.js';

const b64 = (s) => Buffer.from(s).toString('base64url');

test('kiểm Client ID và Secret trước khi lưu', () => {
  assert.throws(() => kiemClient({ client_id: 'abc', client_secret: 'x'.repeat(20) }), /Client ID/);
  assert.throws(() => kiemClient({ client_id: '123-abc.apps.googleusercontent.com', client_secret: 'ngan' }), /Secret/);
  assert.deepEqual(kiemClient({ client_id: ' 123-abc.apps.googleusercontent.com ', client_secret: 'GOCSPX-abcdef123456' }), { client_id: '123-abc.apps.googleusercontent.com', client_secret: 'GOCSPX-abcdef123456' });
});

test('địa chỉ đăng nhập xin đủ ba quyền và khóa làm mới', () => {
  const u = new URL(taoDiaChiDangNhap('id.apps.googleusercontent.com', diaChiGoiLai('https://plan.sonicrec.app'), 'abc'));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://plan.sonicrec.app/api/google/goi-lai');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.equal(u.searchParams.get('state'), 'abc');
  for (const q of QUYEN) assert.ok(u.searchParams.get('scope').includes(q));
});

test('lấy email từ id_token', () => {
  assert.equal(emailTuIdToken(`x.${b64(JSON.stringify({ email: 'a@b.vn' }))}.y`), 'a@b.vn');
  assert.equal(emailTuIdToken('hỏng'), null);
});

test('thư Gmail: ưu tiên chữ thường, bỏ tệp đính kèm, lấy mã thư làm mã gốc', () => {
  const tin = tinTuThuGmail({
    id: 'g1', internalDate: '1760000000000',
    payload: { headers: [{ name: 'From', value: 'Lan <lan@x.vn>' }, { name: 'Subject', value: 'Họp mai' }, { name: 'Message-ID', value: '<abc@mail>' }],
      parts: [{ mimeType: 'text/plain', body: { data: b64('Mai họp 9h') } }, { mimeType: 'text/html', body: { data: b64('<p>Mai họp 9h</p>') } }, { mimeType: 'text/plain', filename: 'a.txt', body: { data: b64('tệp') } }] },
  });
  assert.equal(tin.ma_goc, 'abc@mail');
  assert.equal(tin.noi_dung, 'Mai họp 9h');
  assert.equal(tin.nguoi_gui, 'Lan <lan@x.vn>');
  const chiHtml = tinTuThuGmail({ id: 'g2', payload: { headers: [], mimeType: 'text/html', body: { data: b64('<p>Chào</p>') } } });
  assert.equal(chiHtml.ma_goc, 'gmail:g2');
  assert.equal(chiHtml.noi_dung, 'Chào');
});

test('việc thành Task và sự kiện Lịch', () => {
  assert.deepEqual(thanTask({ tieu_de: 'Nộp', han_ngay: '2026-10-12', gio_hen: '14:00', ghi_chu: 'bản in' }), { title: 'Nộp', notes: 'bản in\nGiờ: 14:00', due: '2026-10-12T00:00:00.000Z' });
  assert.deepEqual(thanSuKien({ tieu_de: 'Họp', han_ngay: '2026-10-12', gio_hen: '23:45' }).end, { dateTime: '2026-10-13T00:15:00', timeZone: 'Asia/Ho_Chi_Minh' });
  assert.deepEqual(thanSuKien({ tieu_de: 'Nộp', han_ngay: '2026-10-12' }).end, { date: '2026-10-13' });
  // Chưa có giờ cụ thể: buổi sáng 8-12h, chiều 13-17h, "cả ngày" hoặc không buổi thì cả ngày; có giờ thì giờ thắng buổi.
  const sang = thanSuKien({ tieu_de: 'Soạn', han_ngay: '2026-11-03', buoi: 'sang' });
  assert.deepEqual([sang.start, sang.end], [{ dateTime: '2026-11-03T08:00:00', timeZone: 'Asia/Ho_Chi_Minh' }, { dateTime: '2026-11-03T12:00:00', timeZone: 'Asia/Ho_Chi_Minh' }]);
  const chieu = thanSuKien({ tieu_de: 'Soạn', han_ngay: '2026-11-03', buoi: 'chieu' });
  assert.deepEqual([chieu.start.dateTime, chieu.end.dateTime], ['2026-11-03T13:00:00', '2026-11-03T17:00:00']);
  assert.deepEqual(thanSuKien({ tieu_de: 'Soạn', han_ngay: '2026-11-03', buoi: 'ca_ngay' }).start, { date: '2026-11-03' });
  assert.deepEqual(thanSuKien({ tieu_de: 'Soạn', han_ngay: '2026-11-03', buoi: null }).start, { date: '2026-11-03' });
  assert.equal(thanSuKien({ tieu_de: 'Họp', han_ngay: '2026-11-03', gio_hen: '09:30', buoi: 'chieu' }).start.dateTime, '2026-11-03T09:30:00');
  assert.match(thanTask({ tieu_de: 'Soạn', han_ngay: '2026-11-03', buoi: 'chieu' }).notes, /Buổi: chiều/);
  assert.equal(thanSuKien({ tieu_de: 'Nộp', han_ngay: '2026-10-12', mau: '9' }).colorId, '9');
  assert.equal('colorId' in thanSuKien({ tieu_de: 'Nộp', han_ngay: '2026-10-12' }), false);
});

test('đăng nhập xin thêm quyền Drive hẹp (drive.file)', () => {
  const u = new URL(taoDiaChiDangNhap('id.apps.googleusercontent.com', 'https://x/api/google/goi-lai', 's'));
  assert.equal(QUYEN_DRIVE, 'https://www.googleapis.com/auth/drive.file');
  assert.ok(u.searchParams.get('scope').split(' ').includes(QUYEN_DRIVE));
});

test('thân tải lên Drive: JSON mô tả rồi nội dung nhị phân nguyên vẹn', () => {
  const nd = new Uint8Array([0, 255, 10, 13, 65]);
  const { ranh, thanBody } = thanTaiLen({ name: 'bản vẽ.pdf', parents: ['abc'] }, nd.buffer, 'application/pdf');
  const chu = Buffer.from(thanBody).toString('latin1');
  assert.ok(chu.startsWith(`--${ranh}\r\n`));
  assert.ok(chu.endsWith(`\r\n--${ranh}--`));
  assert.ok(chu.includes('content-type: application/pdf\r\n\r\n'));
  const vt = Buffer.from(thanBody).indexOf(Buffer.from(nd));
  assert.ok(vt > 0);
  assert.equal(Buffer.from(thanBody).subarray(0, vt).toString().includes('"parents":["abc"]'), true);
});

test('tệp đính kèm Gmail: giữ tệp thật, bỏ ảnh nhúng nhỏ, lời mời lịch và video', () => {
  const ds = tepTuThuGmail({ payload: { parts: [
    { mimeType: 'text/plain', body: { data: 'eA' } },
    { mimeType: 'application/pdf', filename: 'hop-dong.pdf', body: { attachmentId: 'a1', size: 5000 } },
    { mimeType: 'image/png', filename: 'logo.png', headers: [{ name: 'Content-ID', value: '<x>' }], body: { attachmentId: 'a2', size: 3000 } },
    { mimeType: 'image/jpeg', filename: 'anh.jpg', body: { attachmentId: 'a3', size: 300000 } },
    { mimeType: 'text/calendar', filename: 'moi.ics', body: { attachmentId: 'a4', size: 800 } },
    { mimeType: 'video/mp4', filename: 'v.mp4', body: { attachmentId: 'a5', size: 9000 } },
    { mimeType: 'multipart/mixed', parts: [{ mimeType: 'application/zip', filename: 'x.zip', body: { attachmentId: 'a6', size: 99999999 } }] },
  ] } });
  assert.deepEqual(ds.map((t) => t.ma_tep), ['a1', 'a3']);
  assert.equal(ds[0].ten, 'hop-dong.pdf');
});

test('ngày hạn không có thật bị loại, không đẩy sang Lịch', async () => {
  const { ngayCoThat } = await import('../src/tien-ich.js');
  const { docKetQuaViec, docPhanVan } = await import('../src/ai.js');
  assert.equal(ngayCoThat('2026-11-02'), true);
  assert.equal(ngayCoThat('2028-02-29'), true);
  for (const x of ['2026-11-31', '2026-02-30', '2026-00-10', '2026-13-01', '2026-1-1', null, undefined, '']) assert.equal(ngayCoThat(x), false, String(x));
  const ra = docKetQuaViec({ response: { viec: [{ tieu_de: 'Nộp hồ sơ', han_ngay: '2026-11-31', gio_hen: '17:00' }] } });
  assert.equal(ra[0].han_ngay, null);
  assert.equal(docPhanVan([{ tieu_de: 'Gặp anh Hùng', han_ngay: '2026-02-30' }])[0].han_ngay, null);
});
