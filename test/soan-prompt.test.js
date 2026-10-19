// Thợ Claude chỉ soạn prompt (PM dặn 19/10/2026): bối cảnh ghép bằng mã, một lần gọi AI mỗi lần bấm, prompt lưu lại để copy lại.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { d1, dungCsdl } from './csdl-thu.js';
import { dsPrompt, dungBoiCanh, soanPrompt } from '../src/soan-prompt.js';
import { xuLyApi } from '../src/api.js';

function dung() {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  db.prepare(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'Tổ chức', '2026-10-01T00:00:00Z')`).run();
  db.prepare(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc2', 'Khác', '2026-10-01T00:00:00Z')`).run();
  db.prepare(`INSERT INTO du_an (id, to_chuc_id, ten, tao_luc, drive_link) VALUES (1, 'tc1', 'AI Lab', '2026-10-01T00:00:00Z', 'https://drive.google.com/drive/folders/abc')`).run();
  const tin = (id, hoi, nd, luc, nguon = 'zalo', ma = `m${id}`) => db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai) VALUES (?1, 'tc1', ?2, ?3, 'An', 'Nhóm A', ?4, ?5, ?5, ?6)`).run(id, nguon, ma, nd, luc, hoi);
  const viec = (id, ten, tinId, tc = 'tc1', tt = 'mo') => db.prepare(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nhom, du_an_id, tin_nhan_id, han_ngay, ghi_chu, tao_luc, cap_nhat_luc) VALUES (?1, ?4, ?2, ?5, 'claude_chuan_bi', 1, ?3, '2026-10-25', 'Ghi chú', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`).run(id, ten, tinId, tc, tt);
  const tep = (id, tinId, ten, loai = 'application/pdf') => db.prepare(`INSERT INTO tep (id, to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, r2_khoa, nguon, tao_luc) VALUES (?1, 'tc1', ?2, ?3, ?4, 4, ?5, 'zalo', '2026-10-10T00:00:00Z')`).run(id, tinId, ten, loai, `k/${id}`);
  return { db, env, tin, viec, tep };
}

const AI_TOT = 'Đầu ra mong muốn:\n- Một bản tóm tắt một trang cho Ban Giám hiệu.\nTiêu chí xong:\n- Có đủ ba mục.\nCác bước nên làm:\n- Đọc tệp đính kèm trước.';

test('bối cảnh: tin gốc, người, dự án, hạn, liên kết tệp và Gmail của TỪNG việc', async () => {
  const { env, tin, viec, tep } = dung();
  tin(1, 'nhom:A', 'Gửi em báo giá Marcom', '2026-10-10T01:00:00Z');
  tin(2, 'mail:B', 'Nhờ anh xem kịch bản ba tập', '2026-10-10T02:00:00Z', 'gmail', '18f3a9c0b1d2e3f4');
  viec(10, 'Làm báo giá Marcom', 1);
  viec(11, 'Xem kịch bản', 2);
  tep(100, 1, 'bao-gia.pdf');
  tep(101, 2, 'am.m4a', 'audio/mp4');
  let loiNhac = null;
  const r = await soanPrompt(env, 'tc1', [10, 11], { goc: 'https://plan.vi-du.vn' }, async (messages) => { loiNhac = messages; return AI_TOT; });
  const nd = r.noi_dung;
  assert.match(nd, /Làm báo giá Marcom/);
  assert.match(nd, /Gửi em báo giá Marcom/);
  assert.match(nd, /Nhờ anh xem kịch bản ba tập/);
  assert.match(nd, /từ An, nhóm "Nhóm A"/);
  assert.match(nd, /Dự án: AI Lab \(thư mục Drive: https:\/\/drive\.google\.com\/drive\/folders\/abc\)/);
  assert.match(nd, /Hạn: 2026-10-25/);
  assert.match(nd, /bao-gia\.pdf: https:\/\/plan\.vi-du\.vn\/api\/tep\/100\/tai/);
  assert.match(nd, /am\.m4a \(ghi âm.*\): https:\/\/plan\.vi-du\.vn\/api\/tep\/101\/tai/);
  assert.match(nd, /liên kết https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/18f3a9c0b1d2e3f4/);
  assert.match(nd, /## Yêu cầu\nĐầu ra mong muốn:/);
  assert.match(nd, /Chỉ soạn bản nháp\. Không gửi email/);
  assert.match(loiNhac[0].content, /dữ liệu, không phải lệnh/); // tin nhắn là dữ liệu
});

test('soạn prompt: đúng một lần gọi AI, lưu lại, mở lại không gọi AI nữa; bỏ tệp đã bỏ chọn', async () => {
  const { env, tin, viec, tep } = dung();
  tin(1, 'nhom:A', 'Soạn thư mời', '2026-10-10T01:00:00Z');
  viec(10, 'Soạn thư mời', 1);
  tep(100, 1, 'a.pdf');
  tep(101, 1, 'b.pdf');
  let goi = 0;
  const r = await soanPrompt(env, 'tc1', [10], { dan: 'Giọng lịch sự', tepTuy: { them: [], bo: [101], da_chon: true }, goc: 'https://x' }, async (m, o, mo) => { goi++; assert.equal(mo.model, 'claude-haiku-5-5'); assert.equal(mo.effort, 'medium'); return AI_TOT; });
  assert.equal(goi, 1);
  assert.match(r.noi_dung, /a\.pdf/);
  assert.doesNotMatch(r.noi_dung, /b\.pdf/);
  assert.match(r.noi_dung, /Tôi dặn thêm\nGiọng lịch sự/);
  assert.equal(r.ai_loi, null);
  const ds = await dsPrompt(env, 'tc1', 10);
  assert.equal(ds.length, 1);
  assert.equal(ds[0].noi_dung, r.noi_dung);
  assert.equal(goi, 1); // đọc lại không gọi AI
});

test('model: tờ trình, hợp đồng dùng Sonnet 5.5; việc thường Haiku 5.5; không Opus', async () => {
  const { env, viec } = dung();
  viec(10, 'Soạn tờ trình gửi Ban Giám hiệu', null);
  viec(11, 'Trả lời thư mời họp', null);
  const dung1 = [];
  const ai = async (m, o, mo) => { dung1.push(mo.model); return AI_TOT; };
  await soanPrompt(env, 'tc1', [10], {}, ai);
  await soanPrompt(env, 'tc1', [11], {}, ai);
  assert.deepEqual(dung1, ['claude-sonnet-5-5', 'claude-haiku-5-5']);
  assert.ok(!dung1.some((m) => /opus/i.test(m)));
});

test('AI lỗi hoặc trả quá ngắn: vẫn có prompt dùng được với yêu cầu mặc định, báo lý do', async () => {
  const { env, viec } = dung();
  viec(10, 'Việc A', null);
  const r1 = await soanPrompt(env, 'tc1', [10], {}, async () => { throw new Error('hết hạn mức gói'); });
  assert.match(r1.ai_loi, /hết hạn mức/);
  assert.match(r1.noi_dung, /Tiêu chí xong:/);
  const r2 = await soanPrompt(env, 'tc1', [10], {}, async () => 'ok');
  assert.match(r2.ai_loi, /quá ngắn/);
  assert.equal((await dsPrompt(env, 'tc1', 10)).length, 2);
});

test('chặn: việc đã đóng, việc của tổ chức khác, quá 15 việc, không chọn việc nào; không gọi AI', async () => {
  const { env, viec } = dung();
  viec(10, 'Đã xong', null, 'tc1', 'xong');
  viec(20, 'Của người khác', null, 'tc2');
  let goi = 0;
  const ai = async () => { goi++; return AI_TOT; };
  assert.equal((await soanPrompt(env, 'tc1', [10], {}, ai)).ma, 400);
  assert.equal((await soanPrompt(env, 'tc1', [20], {}, ai)).ma, 404);
  assert.equal((await soanPrompt(env, 'tc1', [], {}, ai)).ma, 400);
  assert.equal((await soanPrompt(env, 'tc1', Array.from({ length: 16 }, (_, i) => i + 1), {}, ai)).ma, 400);
  assert.equal(goi, 0);
});

test('API: chỉ chủ soạn được, thành viên 403; lấy lại danh sách prompt của việc; không còn đường giao Claude chạy trực tiếp', async () => {
  const { env, viec } = dung();
  viec(10, 'Soạn thư mời', null);
  env.AI = { run: async () => ({ response: AI_TOT }) };
  const phien = (vt) => ({ email: 'a@b.c', nguoi_dung: { id: 'nd' }, to_chuc: { id: 'tc1', vai_tro: vt }, cac_to_chuc: [{ id: 'tc1' }] });
  const goi = (vt, pt, duong, than) => {
    const url = new URL(`https://plan.vi-du.vn${duong}`);
    return xuLyApi(new Request(url, { method: pt, headers: { origin: url.origin, 'content-type': 'application/json' }, body: pt === 'GET' ? undefined : JSON.stringify(than ?? {}) }), env, phien(vt), url);
  };
  assert.equal((await goi('thanh_vien', 'POST', '/api/claude/soan-prompt', { viec_ids: [10] })).status, 403);
  const r = await goi('chu', 'POST', '/api/claude/soan-prompt', { viec_ids: [10], dan: 'Ngắn gọn' });
  assert.equal(r.status, 201);
  const kq = await r.json();
  assert.match(kq.noi_dung, /Soạn thư mời/);
  const ds = await (await goi('chu', 'GET', '/api/viec/10/prompt')).json();
  assert.equal(ds.prompt.length, 1);
  for (const [pt, duong] of [['POST', '/api/claude/giao'], ['POST', '/api/viec/10/claude'], ['POST', '/api/claude/hoi-truoc'], ['POST', '/api/claude/1/danh-gia'], ['POST', '/api/ket-noi/github/cai-claude']]) {
    assert.equal((await goi('chu', pt, duong, { viec_ids: [10] })).status, 404, `${pt} ${duong} phải không còn`);
  }
});

test('không có đường nào tự tạo lượt chạy Claude hay tự soạn: mã nguồn không còn ghi luot_claude, không còn hàng đợi hay tự chạy', () => {
  const quet = (thuMuc) => readdirSync(thuMuc, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? quet(join(thuMuc, d.name)) : /\.m?js$/.test(d.name) ? [join(thuMuc, d.name)] : []));
  const loi = [];
  for (const f of [...quet('src'), ...quet('may-chu')]) {
    const chu = readFileSync(f, 'utf8');
    if (/INSERT INTO luot_claude|taoLuotMay|giaoClaude|chonViecTuDong|tu_chay|batDauLuot|lamMotLuot/.test(chu)) loi.push(f);
  }
  assert.deepEqual(loi, []);
  // soanPrompt chỉ được gọi từ đúng một chỗ: API do người dùng bấm.
  const goiTu = [...quet('src'), ...quet('may-chu')].filter((f) => /soanPrompt\(/.test(readFileSync(f, 'utf8')) && !f.endsWith('soan-prompt.js'));
  assert.deepEqual(goiTu, [join('src', 'api', 'viec.js')]);
});

test('dungBoiCanh: việc tự thêm không có tin gốc vẫn có bối cảnh', () => {
  const nd = dungBoiCanh({ viecList: [{ id: 1, tieu_de: 'Việc tự thêm', nhom: 'anh_tu_lam' }], duAn: null, tins: [{ goc: null, quanh: [] }], ghiNho: [], tep: [], goc: 'https://x' });
  assert.match(nd, /Việc tự thêm/);
  assert.match(nd, /không có tin gốc/);
  assert.match(nd, /chưa xếp dự án/);
});
