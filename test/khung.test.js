// Kiểm thử phần thuần của giai đoạn 0. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cacLich, tacVuTheoLich } from '../src/lich-chay.js';
import { goiNgoai, loiTamThoi } from '../src/goi-ngoai.js';
import { maHoa, giaiMa } from '../src/ma-hoa.js';
import { kiemDangNhap } from '../src/xac-thuc.js';
import { tinhTinhTrang } from '../src/tinh-trang.js';

test('lịch hẹn giờ trong wrangler.jsonc khớp danh sách tác vụ', () => {
  const cauHinh = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  const crons = JSON.parse(cauHinh.match(/"crons":\s*(\[[^\]]*\])/)[1]);
  assert.deepEqual([...crons].sort(), cacLich());
});

test('chỉ tác vụ đã bật mới chạy', () => {
  assert.deepEqual(tacVuTheoLich('0 * * * *').map((t) => t.ma), ['tu-kiem', 'giao-github', 'bao-viec-moi', 'canh-zalo', 'ban-tin', 'goi-y', 'cham-viec', 'bao-cao-tuan', 'canh-viec']);
  assert.deepEqual(tacVuTheoLich('*/5 * * * *').map((t) => t.ma), ['dong-bo-google', 'luu-kho', 'tach-viec', 'nhac-viec']);
  assert.deepEqual(tacVuTheoLich('0 16 * * *').map((t) => t.ma), ['don-cuoi-ngay', 'sao-luu']);
});

test('gọi ngoài: thử lại lỗi tạm thời 3 lần, chờ 1-2-4 giây', async () => {
  const cho = [];
  let lan = 0;
  const fetchFn = async () => new Response('', { status: ++lan < 4 ? 503 : 200 });
  const ph = await goiNgoai('https://x', {}, { fetchFn, ngu: async (ms) => cho.push(ms) });
  assert.equal(ph.status, 200);
  assert.deepEqual(cho, [1000, 2000, 4000]);
});

test('gọi ngoài: lỗi 4xx trả về ngay, không thử lại', async () => {
  let lan = 0;
  const ph = await goiNgoai('https://x', {}, { fetchFn: async () => (lan++, new Response('', { status: 400 })), ngu: async () => {} });
  assert.equal(ph.status, 400);
  assert.equal(lan, 1);
  assert.equal(loiTamThoi(429), true);
  assert.equal(loiTamThoi(404), false);
});

test('gọi ngoài: hết 3 lần vẫn lỗi thì báo lỗi', async () => {
  await assert.rejects(goiNgoai('https://x', {}, { fetchFn: async () => new Response('', { status: 500 }), ngu: async () => {} }));
});

test('mã hóa rồi giải mã ra đúng dữ liệu, sai khóa thì không giải được', async () => {
  const khoa = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  const khoaKhac = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  const banMa = await maHoa({ token: 'bí mật' }, khoa);
  assert.match(banMa, /^v1\./);
  assert.ok(!banMa.includes('bí mật'));
  assert.deepEqual(await giaiMa(banMa, khoa), { token: 'bí mật' });
  await assert.rejects(giaiMa(banMa, khoaKhac));
  await assert.rejects(maHoa({}, 'ngan'));
});

// Tạo vé Access giả bằng cặp khóa RSA sinh trong lúc kiểm thử.
const MIEN = 'nhom-thu.cloudflareaccess.com';
const AUD = 'aud-thu';
const capKhoa = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
);
const jwkCong = { ...(await crypto.subtle.exportKey('jwk', capKhoa.publicKey)), kid: 'k1' };
const b64u = (b) => Buffer.from(b).toString('base64url');
async function taoVe(than, kid = 'k1') {
  const dau = b64u(JSON.stringify({ alg: 'RS256', kid }));
  const tb = b64u(JSON.stringify(than));
  const ky = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', capKhoa.privateKey, new TextEncoder().encode(`${dau}.${tb}`));
  return `${dau}.${tb}.${b64u(new Uint8Array(ky))}`;
}
const env = { ACCESS_TEAM_DOMAIN: MIEN, ACCESS_AUD: AUD };
const bayGio = Date.parse('2026-10-11T03:00:00Z');
const thanDung = { aud: [AUD], iss: `https://${MIEN}`, exp: bayGio / 1000 + 600, email: 'Hainnam@gmail.com' };
const kiem = (ve) => kiemDangNhap(new Request('https://x', { headers: ve ? { 'cf-access-jwt-assertion': ve } : {} }), env, { layKhoa: async () => [jwkCong], bayGio });

test('vé Access đúng thì nhận, email viết thường', async () => {
  assert.deepEqual(await kiem(await taoVe(thanDung)), { duoc: true, email: 'hainnam@gmail.com' });
});

test('vé Access sai thì từ chối', async () => {
  assert.equal((await kiem(null)).duoc, false);
  assert.equal((await kiem(await taoVe({ ...thanDung, aud: ['khac'] }))).duoc, false);
  assert.equal((await kiem(await taoVe({ ...thanDung, iss: 'https://gia.cloudflareaccess.com' }))).duoc, false);
  assert.equal((await kiem(await taoVe({ ...thanDung, exp: bayGio / 1000 - 1 }))).duoc, false);
  assert.equal((await kiem(await taoVe(thanDung, 'k-la'))).duoc, false);
  const ve = await taoVe(thanDung);
  const [d, , k] = ve.split('.');
  const thanSua = b64u(JSON.stringify({ ...thanDung, email: 'ke-gian@x.com' }));
  assert.equal((await kiem(`${d}.${thanSua}.${k}`)).duoc, false);
});

test('đèn tình trạng: hẹn giờ trễ thì đỏ, kết nối chưa nối thì xám', () => {
  const kq = tinhTinhTrang({
    tinHieuHeThong: [{ nguon: 'hen-gio', lan_cuoi: '2026-10-11T01:00:00Z' }],
    ketNoi: [{ loai: 'thu', trang_thai: 'loi', cap_nhat_luc: '2026-10-11T02:00:00Z' }],
    lanChayCuoi: [],
    bayGio,
  });
  const den = Object.fromEntries(kq.thanh_phan.map((p) => [p.ma, p.den]));
  assert.equal(den['hen-gio'], 'do');
  assert.equal(den.thu, 'do');
  assert.equal(den.zalo, 'xam');
  const kq2 = tinhTinhTrang({ tinHieuHeThong: [{ nguon: 'hen-gio', lan_cuoi: '2026-10-11T02:30:00Z' }], ketNoi: [], lanChayCuoi: [], bayGio });
  assert.equal(kq2.thanh_phan.find((p) => p.ma === 'hen-gio').den, 'xanh');
});
