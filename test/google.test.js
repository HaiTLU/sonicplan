// Kiểm thử phần thuần của nối Google: địa chỉ đăng nhập, đọc thư Gmail, dựng việc và sự kiện.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaChiGoiLai, emailTuIdToken, kiemClient, QUYEN, taoDiaChiDangNhap, thanSuKien, thanTask, tinTuThuGmail } from '../src/google.js';

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
});
