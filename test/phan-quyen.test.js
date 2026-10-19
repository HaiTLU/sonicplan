// Phân quyền: các địa chỉ chỉ chủ tổ chức dùng được phải từ chối thành viên thường (403).
// Danh sách này là hợp đồng: thêm địa chỉ quản trị mới thì thêm vào đây. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { xuLyApi } from '../src/api.js';

const CHI_CHU = [
  ['GET', '/api/du-lieu/xuat'], ['GET', '/api/du-lieu/truy-cap'],
  ['POST', '/api/claude/soan-prompt'],
  ['POST', '/api/du-an/1/drive-kho'], ['DELETE', '/api/du-an/1/drive-kho'], ['POST', '/api/du-an/1/drive-kho/dong-bo'],
  ['PATCH', '/api/luong'], ['PUT', '/api/ho-so'], ['POST', '/api/goi-y-loi-dan'], ['DELETE', '/api/ghi-nho'],
  ['POST', '/api/ket-noi/zalo'],
  ['POST', '/api/ket-noi/ai'], ['DELETE', '/api/ket-noi/ai'],
  ['POST', '/api/ket-noi/google'], ['DELETE', '/api/ket-noi/google'],
  ['GET', '/api/google/bat-dau'], ['GET', '/api/google/goi-lai'],
  ['GET', '/api/kho-drive/bat-dau'], ['POST', '/api/kho-drive/luu-ngay'], ['DELETE', '/api/ket-noi/kho-drive'],
  ['GET', '/api/hop/bat-dau'], ['POST', '/api/ket-noi/hop'], ['POST', '/api/hop/quet-ngay'], ['DELETE', '/api/ket-noi/hop'],
  ['POST', '/api/ket-noi/github'], ['DELETE', '/api/ket-noi/github'],
  ['POST', '/api/ket-noi/nhan-viec'], ['DELETE', '/api/ket-noi/nhan-viec'],
  ['POST', '/api/ket-noi/webhook'], ['DELETE', '/api/ket-noi/webhook'], ['POST', '/api/ket-noi/webhook/thu'],
  ['PUT', '/api/kb/du-an/1'], ['POST', '/api/tho-claude/dong-bo-ghi-nho'], ['POST', '/api/tho-claude/ra-soat-ngay'],
];

function moi(vaiTro) {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  const env = { CSDL: d1(db), QUAN_TRI: 'quan-tri@vi-du.vn' };
  const phien = { email: 'tv@vi-du.vn', nguoi_dung: { id: 'nd1' }, to_chuc: { id: 'tc1', vai_tro: vaiTro }, cac_to_chuc: [{ id: 'tc1' }] };
  return (pt, duong) => {
    const url = new URL(`https://plan.vi-du.vn${duong}`);
    return xuLyApi(new Request(url, { method: pt, headers: { origin: url.origin, 'content-type': 'application/json' }, body: pt === 'GET' ? undefined : '{}' }), env, phien, url);
  };
}

test('thành viên thường bị từ chối ở mọi địa chỉ chỉ dành cho chủ tổ chức', async () => {
  for (const [pt, duong] of CHI_CHU) {
    const kq = await moi('thanh_vien')(pt, duong);
    assert.equal(kq.status, 403, `${pt} ${duong} phải trả 403 cho thành viên`);
  }
});

test('chủ tổ chức không bị chặn bởi vai trò ở các địa chỉ đó', async () => {
  const globalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 500 });
  try {
    for (const [pt, duong] of CHI_CHU) {
      const kq = await moi('chu')(pt, duong);
      assert.notEqual(kq.status, 403, `${pt} ${duong} không được trả 403 cho chủ`);
    }
  } finally {
    globalThis.fetch = globalFetch;
  }
});

test('cài bot Telegram chỉ dành cho người quản trị hệ thống, kể cả chủ tổ chức', async () => {
  const kq = await moi('chu')('POST', '/api/ket-noi/telegram/bot');
  assert.equal(kq.status, 403);
});
