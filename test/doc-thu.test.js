// Kiểm thử bộ đọc thư MIME và nhận diện thư xác nhận chuyển tiếp Gmail. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docThu, docThamSo, giaiTu } from '../src/doc-thu.js';
import { xacNhanGmail } from '../src/nhan-thu.js';

const byte = (s) => new TextEncoder().encode(s.replace(/\n/g, '\r\n'));

test('tiêu đề mã hóa B, Q và người gửi có dấu', async () => {
  assert.equal(giaiTu('=?UTF-8?B?SOG6oW4gbuG7mXAgYsOhbyBjw6Fv?='), 'Hạn nộp báo cáo');
  assert.equal(giaiTu('=?utf-8?Q?Ch=C3=A0o_anh?= =?utf-8?Q?_H=E1=BA=A3i?='), 'Chào anh Hải');
  const thu = await docThu(byte(`From: =?UTF-8?Q?Nguy=E1=BB=85n_V=C4=83n_A?= <A@Vi.Du>
Subject: =?UTF-8?B?SOG6oW4gbuG7mXAgYsOhbyBjw6Fv?=
Message-ID: <abc@vi.du>
Date: Sun, 11 Oct 2026 09:00:00 +0700
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable

G=E1=BB=ADi anh b=C3=A1o c=C3=A1o tr=C6=B0=E1=BB=9Bc 15/10.=
 Cảm ơn.
`));
  assert.deepEqual(thu.from, { name: 'Nguyễn Văn A', address: 'a@vi.du' });
  assert.equal(thu.subject, 'Hạn nộp báo cáo');
  assert.equal(thu.messageId, '<abc@vi.du>');
  assert.equal(thu.text, 'Gửi anh báo cáo trước 15/10. Cảm ơn.');
});

test('thư nhiều phần: chữ, HTML và tệp đính kèm tên tiếng Việt', async () => {
  const pdf = btoa('%PDF-1.4 noi dung');
  const thu = await docThu(byte(`From: b@vi.du
Subject: Tep
Content-Type: multipart/mixed; boundary="ngoai"

--ngoai
Content-Type: multipart/alternative; boundary=trong

--trong
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: base64

${btoa(String.fromCharCode(...new TextEncoder().encode('Thân thư chữ')))}
--trong
Content-Type: text/html; charset=utf-8

<p>Thân thư HTML</p>
--trong--

--ngoai
Content-Type: application/pdf; name="x.pdf"
Content-Disposition: attachment;
 filename*=UTF-8''K%E1%BA%BF%20ho%E1%BA%A1ch.pdf
Content-Transfer-Encoding: base64

${pdf}
--ngoai--
`));
  assert.equal(thu.text, 'Thân thư chữ');
  assert.equal(thu.html.trim(), '<p>Thân thư HTML</p>');
  assert.equal(thu.attachments.length, 1);
  assert.equal(thu.attachments[0].filename, 'Kế hoạch.pdf');
  assert.equal(thu.attachments[0].mimeType, 'application/pdf');
  assert.equal(new TextDecoder().decode(thu.attachments[0].content), '%PDF-1.4 noi dung');
});

test('tham số Content-Type', () => {
  assert.deepEqual(docThamSo('text/plain; charset="UTF-8"; format=flowed'), { gia_tri: 'text/plain', tham_so: { charset: 'UTF-8', format: 'flowed' } });
});

test('nhận ra thư xác nhận chuyển tiếp Gmail', async () => {
  const thu = await docThu(byte(`From: Gmail Team <forwarding-noreply@google.com>
Subject: (#123456789) Gmail Forwarding Confirmation - Receive Mail from hainnam@gmail.com
Content-Type: text/plain; charset=UTF-8

hainnam@gmail.com has requested to automatically forward mail to your email
address namhai@thu.vi.du.
Confirmation code: 123456789

To allow hainnam@gmail.com to automatically forward mail to your address,
please click the link below to confirm the request:

https://mail-settings.google.com/mail/vf-%5BANGjdJ_abc%5D-xyz

`));
  assert.deepEqual(xacNhanGmail(thu), {
    ma: '123456789',
    duong_dan: 'https://mail-settings.google.com/mail/vf-%5BANGjdJ_abc%5D-xyz',
    tu: 'hainnam@gmail.com',
  });
  assert.equal(xacNhanGmail({ from: { address: 'a@b.vn' }, text: 'Confirmation code: 123456789' }), null);
});
