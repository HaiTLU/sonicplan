import test from 'node:test';
import assert from 'node:assert/strict';
import { dungCsdl, d1 } from './csdl-thu.js';
import { xuLyApi } from '../src/api.js';

const phien = { email: 'a@vi-du.vn', nguoi_dung: { id: 'nd' }, to_chuc: { id: 'tc', vai_tro: 'chu' }, cac_to_chuc: [{ id: 'tc' }] };

async function goi(env, query) {
  const url = new URL(`http://x/api/tin?${query}`);
  const kq = await xuLyApi(new Request(url), env, phien, url);
  return (await kq.json()).tin.map((t) => t.id);
}

test('lọc tin hôm nay và theo giờ Việt Nam (dùng khi bấm số, cột giờ ở Tổng quan)', async () => {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  const ngay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const utc = (gioVN) => new Date(Date.parse(`${ngay}T00:00:00Z`) + (gioVN - 7) * 3600000 + 10 * 60000).toISOString();
  const them = db.prepare("INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, noi_dung, thoi_diem, tao_luc) VALUES (?1, ?2, 'zalo', 'm' || ?1, 'A', 'x', ?3, ?3)");
  them.run(1, 'tc', utc(9));
  them.run(2, 'tc', utc(10));
  them.run(3, 'tc', '2020-01-01T03:00:00Z');
  them.run(4, 'khac', utc(9));
  assert.deepEqual((await goi(env, 'hom_nay=1')).sort(), [1, 2]);
  assert.deepEqual(await goi(env, 'hom_nay=1&gio=9'), [1]);
  assert.deepEqual((await goi(env, 'hom_nay=1&gio=abc')).sort(), [1, 2]);
  assert.deepEqual((await goi(env, '')).sort(), [1, 2, 3]);
});
