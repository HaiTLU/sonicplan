// Rà soát an toàn: chặn địa chỉ nội bộ (SSRF), vai trò chủ tổ chức, giới hạn tần suất, làm mới khóa Access,
// lỗi một tổ chức không làm hỏng cả lượt sao lưu và tách việc. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { kiemDiaChiTruocGoi, laIpRieng, laTenMayNoiBo } from '../src/dia-chi-an-toan.js';
import { guiDiaChiNhan, kiemDiaChiNhan, chuanHoaCauHinhAi } from '../src/tich-hop.js';
import { gioiHanTanSuat, hanMucDuongDan } from '../src/gioi-han.js';
import { kiemDangNhap } from '../src/xac-thuc.js';
import { xuLyApi } from '../src/api.js';
import { CAC_TAC_VU } from '../src/tac-vu.js';

test('nhận ra địa chỉ IP và tên máy nội bộ', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.3.4', '172.31.255.1', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1']) {
    assert.equal(laIpRieng(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(laIpRieng(ip), false, ip);
  for (const ten of ['localhost', 'may.local', 'db.internal', 'LOCALHOST.', '127.0.0.1', '[::1]', '2130706433', '0x7f.0.0.1']) assert.equal(laTenMayNoiBo(ten), true, ten);
  for (const ten of ['example.com', 'api.openai.com', 'hooks.slack.com']) assert.equal(laTenMayNoiBo(ten), false, ten);
});

test('địa chỉ nhận việc mới: từ chối địa chỉ nội bộ, thông tin đăng nhập kèm theo và http', () => {
  for (const dc of ['https://localhost/hook', 'https://127.0.0.1/x', 'https://10.1.2.3/x', 'https://192.168.0.1/x', 'https://[::1]/x', 'https://2130706433/x', 'https://u:p@example.com/x', 'http://example.com/x']) {
    assert.throws(() => kiemDiaChiNhan(dc), undefined, dc);
  }
  assert.equal(kiemDiaChiNhan('https://hooks.example.com/abc'), 'https://hooks.example.com/abc');
});

test('địa chỉ dịch vụ AI kiểu OpenAI: từ chối địa chỉ nội bộ', () => {
  const k = 'k'.repeat(30);
  assert.throws(() => chuanHoaCauHinhAi({ loai: 'openai', khoa: k, dia_chi: 'https://192.168.1.5/v1' }), /nội bộ/);
  assert.equal(chuanHoaCauHinhAi({ loai: 'openai', khoa: k, dia_chi: 'https://api.example.com/v1' }).dia_chi, 'https://api.example.com/v1');
});

test('tên miền trỏ vào IP nội bộ thì bị chặn lúc gọi, IP công khai thì qua', async () => {
  await assert.rejects(kiemDiaChiTruocGoi('https://tro-ve-noi-bo.example.com/x', { phanGiai: async () => ['10.0.0.9'] }), /nội bộ/);
  await assert.rejects(kiemDiaChiTruocGoi('https://hai-dia-chi.example.com/x', { phanGiai: async () => ['8.8.8.8', '127.0.0.1'] }), /nội bộ/);
  await kiemDiaChiTruocGoi('https://tot.example.com/x', { phanGiai: async () => ['93.184.216.34'] });
  await kiemDiaChiTruocGoi('https://khong-phan-giai.example.com/x', { phanGiai: async () => { throw new Error('ENOTFOUND'); } });
});

test('gửi tới địa chỉ nhận: không theo chuyển hướng, lệnh 302 báo lỗi', async () => {
  const cu = globalThis.fetch;
  let tuyChon;
  globalThis.fetch = async (_dia, t) => { tuyChon = t; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }); };
  try {
    await assert.rejects(guiDiaChiNhan('https://8.8.8.8/hook', { a: 1 }), /302/);
    assert.equal(tuyChon.redirect, 'manual');
    await assert.rejects(guiDiaChiNhan('https://127.0.0.1/hook', { a: 1 }), /nội bộ/);
  } finally {
    globalThis.fetch = cu;
  }
});

test('giới hạn tần suất: quá hạn mức thì chặn, sang cửa sổ mới thì cho lại, IP khác không bị ảnh hưởng', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(gioiHanTanSuat('thu', '1.1.1.1', 3, t0 + i).duoc, true);
  const chan = gioiHanTanSuat('thu', '1.1.1.1', 3, t0 + 10);
  assert.equal(chan.duoc, false);
  assert.ok(chan.cho_giay >= 1 && chan.cho_giay <= 60);
  assert.equal(gioiHanTanSuat('thu', '2.2.2.2', 3, t0 + 10).duoc, true);
  assert.equal(gioiHanTanSuat('thu', '1.1.1.1', 3, t0 + 61_000).duoc, true);
  assert.deepEqual(hanMucDuongDan('/nhan/viec'), { nhom: 'nhan-viec', toiDa: 20 });
  assert.equal(hanMucDuongDan('/api/viec'), null);
});

test('khóa Access: gặp kid lạ thì lấy lại danh sách khóa rồi kiểm tiếp', async () => {
  const MIEN = 'x.cloudflareaccess.com';
  const AUD = 'aud1';
  const cap = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', cap.publicKey)), kid: 'moi' };
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const bayGio = Date.parse('2026-10-11T03:00:00Z');
  const dau = b64u(JSON.stringify({ alg: 'RS256', kid: 'moi' }));
  const than = b64u(JSON.stringify({ aud: [AUD], iss: `https://${MIEN}`, exp: bayGio / 1000 + 600, email: 'a@b.c' }));
  const ky = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cap.privateKey, new TextEncoder().encode(`${dau}.${than}`));
  const yeuCau = () => new Request('https://x', { headers: { 'cf-access-jwt-assertion': `${dau}.${than}.${b64u(new Uint8Array(ky))}` } });
  const env = { ACCESS_TEAM_DOMAIN: MIEN, ACCESS_AUD: AUD };

  const lan = [];
  const layKhoa = async (_m, _b, tuyChon = {}) => { lan.push(Boolean(tuyChon.lamMoi)); return tuyChon.lamMoi ? [jwk] : [{ kid: 'cu' }]; };
  assert.deepEqual(await kiemDangNhap(yeuCau(), env, { layKhoa, bayGio }), { duoc: true, email: 'a@b.c' });
  assert.deepEqual(lan, [false, true]);

  const hong = async () => { throw new Error('mạng đứt'); };
  const kq = await kiemDangNhap(yeuCau(), env, { layKhoa: hong, bayGio });
  assert.equal(kq.duoc, false);
});

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  return { db, env: { CSDL: d1(db) } };
}
const phienThanhVien = { email: 'tv@vi-du.vn', nguoi_dung: { id: 'nd' }, to_chuc: { id: 'tc1', vai_tro: 'thanh_vien' }, cac_to_chuc: [{ id: 'tc1' }] };
const goi = (env, phien, duong, phuongThuc = 'POST') => {
  const url = new URL(`https://plan.vi-du.vn${duong}`);
  return xuLyApi(new Request(url, { method: phuongThuc, headers: { origin: url.origin } }), env, phien, url);
};

test('thành viên thường không tạo được mã Zalo, không gửi thử webhook, không gọi lại Google', async () => {
  const { env } = moiTruong();
  assert.equal((await goi(env, phienThanhVien, '/api/ket-noi/zalo')).status, 403);
  assert.equal((await goi(env, phienThanhVien, '/api/ket-noi/webhook/thu')).status, 403);
  assert.equal((await goi(env, phienThanhVien, '/api/google/goi-lai', 'GET')).status, 403);
  // Mã lịch vẫn là của cả nhóm: thành viên tạo được như trước.
  assert.equal((await goi(env, phienThanhVien, '/api/ket-noi/lich')).status, 200);
  // Chủ thì tạo được mã Zalo.
  const chu = { ...phienThanhVien, to_chuc: { id: 'tc1', vai_tro: 'chu' } };
  assert.equal((await goi(env, chu, '/api/ket-noi/zalo')).status, 200);
});

test('sao lưu: một tổ chức lỗi không làm các tổ chức sau mất bản sao', async () => {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('a', 'A', '2026-01-01'), ('b', 'B', '2026-01-01')");
  const luu = [];
  const env = {
    CSDL: d1(db),
    TEP: {
      put: async (khoa) => { if (khoa.includes('sao-luu/a/')) throw new Error('đĩa đầy'); luu.push(khoa); },
      list: async () => ({ objects: [], truncated: false }),
      delete: async () => {},
    },
  };
  await assert.rejects(CAC_TAC_VU['sao-luu'](env, '2026-10-15T01:00:00.000Z'), /lỗi 1/);
  assert.ok(luu.some((k) => k.startsWith('sao-luu/b/')), 'tổ chức b vẫn được sao lưu');
  assert.ok(!luu.some((k) => k.startsWith('sao-luu/a/')));
});
