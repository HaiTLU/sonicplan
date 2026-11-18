import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiemDangNhap, layKhoaAccess, xoaBoNho } from '../src/xac-thuc.js';

const MIEN = 'vi-du.cloudflareaccess.com';
const AUD = 'aud-1';

test('Nhiều yêu cầu cùng lúc chỉ tải khóa Access một lần', async () => {
  xoaBoNho();
  const goc = globalThis.fetch;
  let soLan = 0;
  globalThis.fetch = async () => {
    soLan++;
    await new Promise((x) => setTimeout(x, 20));
    return new Response(JSON.stringify({ keys: [{ kid: 'k1' }] }), { status: 200 });
  };
  try {
    const kq = await Promise.all([1, 2, 3, 4, 5].map(() => layKhoaAccess(MIEN, 1000)));
    assert.equal(soLan, 1);
    assert.ok(kq.every((k) => k === kq[0]));
    await layKhoaAccess(MIEN, 2000);
    assert.equal(soLan, 1, 'Còn trong bộ nhớ đệm thì không tải lại');
  } finally {
    globalThis.fetch = goc;
    xoaBoNho();
  }
});

test('Tải khóa lỗi thì lần sau thử lại, không kẹt', async () => {
  xoaBoNho();
  const goc = globalThis.fetch;
  let soLan = 0;
  globalThis.fetch = async () => {
    soLan++;
    return soLan === 1 ? new Response('{}', { status: 403 }) : new Response(JSON.stringify({ keys: [{ kid: 'k' }] }), { status: 200 });
  };
  try {
    await assert.rejects(layKhoaAccess(MIEN, 1000));
    assert.deepEqual(await layKhoaAccess(MIEN, 1001), [{ kid: 'k' }]);
  } finally {
    globalThis.fetch = goc;
    xoaBoNho();
  }
});

test('Khóa đã nạp được dùng lại cho các vé sau', async () => {
  const cap = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', cap.publicKey)), kid: 'a' };
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const bayGio = Date.parse('2026-10-11T03:00:00Z');
  const dau = b64u(JSON.stringify({ alg: 'RS256', kid: 'a' }));
  const than = b64u(JSON.stringify({ aud: [AUD], iss: `https://${MIEN}`, exp: bayGio / 1000 + 600, email: 'a@b.c' }));
  const ky = b64u(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cap.privateKey, new TextEncoder().encode(`${dau}.${than}`))));
  const yeuCau = () => new Request('https://x', { headers: { 'cf-access-jwt-assertion': `${dau}.${than}.${ky}` } });
  const env = { ACCESS_TEAM_DOMAIN: MIEN, ACCESS_AUD: AUD };
  const layKhoa = async () => [jwk];

  const goc = crypto.subtle.importKey.bind(crypto.subtle);
  let soLan = 0;
  crypto.subtle.importKey = (...a) => { soLan++; return goc(...a); };
  try {
    for (let i = 0; i < 3; i++) assert.deepEqual(await kiemDangNhap(yeuCau(), env, { layKhoa, bayGio }), { duoc: true, email: 'a@b.c' });
    assert.equal(soLan, 1);
  } finally {
    crypto.subtle.importKey = goc;
  }
});
