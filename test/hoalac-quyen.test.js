// Nền phân hệ Viện Hòa Lạc: đa AUD khi đăng nhập, và cách ly đường dẫn /hoalac theo phạm vi
// truy cập của tổ chức (to_chuc.pham_vi_truy_cap). Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiemDangNhap } from '../src/xac-thuc.js';
import sonicplan from '../src/index.js';
import { d1, dungCsdl } from './csdl-thu.js';

const MIEN = 'nhom-thu.cloudflareaccess.com';
const AUD_CHINH = 'aud-chung';
const AUD_HOALAC = 'aud-hoalac';
const capKhoa = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
);
const jwkCong = { ...(await crypto.subtle.exportKey('jwk', capKhoa.publicKey)), kid: 'k1' };
const b64u = (b) => Buffer.from(b).toString('base64url');
async function taoVe(than) {
  const dau = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
  const tb = b64u(JSON.stringify(than));
  const ky = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', capKhoa.privateKey, new TextEncoder().encode(`${dau}.${tb}`));
  return `${dau}.${tb}.${b64u(new Uint8Array(ky))}`;
}
const bayGio = Date.parse('2026-10-26T03:00:00Z');
const layKhoa = async () => [jwkCong];

test('vé Access từ ứng dụng phụ (ACCESS_UNG_DUNG) cũng được nhận', async () => {
  const env = { ACCESS_TEAM_DOMAIN: MIEN, ACCESS_AUD: AUD_CHINH, ACCESS_UNG_DUNG: JSON.stringify([AUD_HOALAC]) };
  const than = { aud: [AUD_HOALAC], iss: `https://${MIEN}`, exp: bayGio / 1000 + 600, email: 'doi-tac@vi-du.vn' };
  const ve = await taoVe(than);
  const kq = await kiemDangNhap(new Request('https://x', { headers: { 'cf-access-jwt-assertion': ve } }), env, { layKhoa, bayGio });
  assert.deepEqual(kq, { duoc: true, email: 'doi-tac@vi-du.vn' });
});

test('AUD lạ, không có trong ACCESS_AUD hay ACCESS_UNG_DUNG, bị từ chối', async () => {
  const env = { ACCESS_TEAM_DOMAIN: MIEN, ACCESS_AUD: AUD_CHINH, ACCESS_UNG_DUNG: JSON.stringify([AUD_HOALAC]) };
  const than = { aud: ['aud-khac'], iss: `https://${MIEN}`, exp: bayGio / 1000 + 600, email: 'ai-do@vi-du.vn' };
  const kq = await kiemDangNhap(new Request('https://x', { headers: { 'cf-access-jwt-assertion': await taoVe(than) } }), env, { layKhoa, bayGio });
  assert.equal(kq.duoc, false);
});

test('ACCESS_UNG_DUNG sai dạng JSON không làm hỏng luôn cả Access chung', async () => {
  const env = { ACCESS_TEAM_DOMAIN: MIEN, ACCESS_AUD: AUD_CHINH, ACCESS_UNG_DUNG: '{sai' };
  const than = { aud: [AUD_CHINH], iss: `https://${MIEN}`, exp: bayGio / 1000 + 600, email: 'tv@vi-du.vn' };
  const kq = await kiemDangNhap(new Request('https://x', { headers: { 'cf-access-jwt-assertion': await taoVe(than) } }), env, { layKhoa, bayGio });
  assert.equal(kq.duoc, true);
});

function moiEnv() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-chung', 'Chung', 'chung', '2026-01-01')");
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-hoalac', 'Vien Hoa Lac', 'hoalac', '2026-01-01')");
  db.exec("INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-chung', 'thanhvien@vi-du.vn', '2026-01-01')");
  db.exec("INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-hoalac', 'doi-tac@vi-du.vn', '2026-01-01')");
  db.exec("INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-chung', 'nd-chung', 'thanh_vien', '2026-01-01')");
  db.exec("INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-hoalac', 'nd-hoalac', 'doi_tac', '2026-01-01')");
  const ASSETS = { fetch: async () => new Response('trang chinh', { status: 200, headers: { 'content-type': 'text/html' } }) };
  return { CSDL: d1(db), ASSETS, QUAN_TRI: 'quan-tri@vi-du.vn' };
}

test('thành viên tổ chức phạm vi chung không vào được /hoalac', async () => {
  const env = { ...moiEnv(), EMAIL_THU: 'thanhvien@vi-du.vn' };
  const ra = await sonicplan.fetch(new Request('https://localhost/hoalac'), env, { waitUntil: () => {} });
  assert.equal(ra.status, 403);
});

test('thành viên tổ chức phạm vi chung không gọi được /api/hoalac/*', async () => {
  const env = { ...moiEnv(), EMAIL_THU: 'thanhvien@vi-du.vn' };
  const ra = await sonicplan.fetch(new Request('https://localhost/api/hoalac/hang-muc'), env, { waitUntil: () => {} });
  assert.equal(ra.status, 403);
});

test('đối tác tổ chức phạm vi hoalac không gọi được API khác của Sonicplan', async () => {
  const env = { ...moiEnv(), EMAIL_THU: 'doi-tac@vi-du.vn' };
  const ra = await sonicplan.fetch(new Request('https://localhost/api/viec'), env, { waitUntil: () => {} });
  assert.equal(ra.status, 403);
});

test('đối tác tổ chức phạm vi hoalac gọi /api/toi và /api/thong-bao vẫn được (dùng chung)', async () => {
  const env = { ...moiEnv(), EMAIL_THU: 'doi-tac@vi-du.vn' };
  const toi = await sonicplan.fetch(new Request('https://localhost/api/toi'), env, { waitUntil: () => {} });
  assert.notEqual(toi.status, 403);
  const thongBao = await sonicplan.fetch(new Request('https://localhost/api/thong-bao'), env, { waitUntil: () => {} });
  assert.notEqual(thongBao.status, 403);
});

test('đối tác tổ chức phạm vi hoalac mở được trang /hoalac (chưa có API riêng vẫn không bị 403)', async () => {
  const env = { ...moiEnv(), EMAIL_THU: 'doi-tac@vi-du.vn' };
  const ra = await sonicplan.fetch(new Request('https://localhost/hoalac'), env, { waitUntil: () => {} });
  assert.notEqual(ra.status, 403);
});
