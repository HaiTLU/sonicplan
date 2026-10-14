import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nhanThuQuaHttp } from '../src/nhan-thu-http.js';
import { d1, dungCsdl } from './csdl-thu.js';

const MA = 'm'.repeat(32);
const thuTho = 'From: A <a@x.vn>\r\nTo: hop@sonicrec.app\r\nSubject: Thu thu\r\nMessage-ID: <1@x>\r\nContent-Type: text/plain\r\n\r\nNoi dung thu\r\n';
const gui = (env, { ma = MA, den = 'khong-co@sonicrec.app', than = thuTho, method = 'POST' } = {}) =>
  nhanThuQuaHttp(
    new Request('https://plan.sonicrec.app/nhan/thu', {
      method,
      headers: { authorization: `Bearer ${ma}`, 'x-thu-to': encodeURIComponent(den), 'x-thu-from': 'a%40x.vn' },
      body: method === 'POST' ? than : undefined,
    }),
    env,
    { waitUntil() {} },
  );

test('sai mã hoặc chưa đặt THU_MA thì 401', async () => {
  const env = { CSDL: d1(dungCsdl()), EMAIL_DOMAIN: 'sonicrec.app' };
  assert.equal((await gui({ ...env, THU_MA: MA }, { ma: 'x'.repeat(32) })).status, 401);
  assert.equal((await gui(env)).status, 401);
  assert.equal((await gui({ ...env, THU_MA: MA }, { method: 'GET' })).status, 405);
});

test('hộp thư không tồn tại thì báo từ chối', async () => {
  const env = { CSDL: d1(dungCsdl()), EMAIL_DOMAIN: 'sonicrec.app', THU_MA: MA };
  const tl = await gui(env);
  assert.equal(tl.status, 200);
  assert.deepEqual(await tl.json(), { tu_choi: 'Không có hộp thư này.' });
});
