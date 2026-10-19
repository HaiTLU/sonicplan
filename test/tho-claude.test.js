// Phần Claude trên máy riêng: ghép dự án với KB, đồng bộ ghi nhớ, rà soát tách việc, model theo loại việc.
// Thợ không còn chạy lượt việc nào (chỉ soạn prompt, xem test/soan-prompt.test.js). Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { d1, dungCsdl } from './csdl-thu.js';
import { chuanTen, goiYThuMuc, kiemThuMucKb, tenThuMuc, thuMucGocDuAn, thuMucLamViec } from '../src/kb.js';
import { chonModelChoViec, chuanCauHinhTho, docCauHinhTho, layTinNguCanh } from '../src/tho-claude.js';
import { duongDanChoClaude, moThoClaude } from '../may-chu/tho-claude.js';
import { xuLyApi } from '../src/api.js';

test('ghép dự án với thư mục KB: chuẩn tên, gợi ý, kiểm đường dẫn', () => {
  assert.equal(chuanTen('Đào tạo Ngắn hạn'), 'daotaonganhan');
  assert.equal(goiYThuMuc('Đào tạo Ngắn hạn', ['AILab_HoaLac', 'DaoTao_NganHan', 'SonicRec']), 'DaoTao_NganHan');
  assert.equal(goiYThuMuc('Cá nhân', ['AILab_HoaLac', 'DaoTao_NganHan']), null);
  assert.equal(goiYThuMuc('IPSOS', ['SonicRec']), null);
  assert.equal(tenThuMuc('Hợp tác và Sự kiện'), 'Hop_Tac_Va_Su_Kien');
  assert.equal(kiemThuMucKb('01_Projects/DaoTao_NganHan'), '01_Projects/DaoTao_NganHan');
  assert.equal(kiemThuMucKb('01_Projects/Báo cáo 2026'), '01_Projects/Báo cáo 2026');
  assert.equal(kiemThuMucKb('_INBOX/Sonicplan/Khac'), '_INBOX/Sonicplan/Khac');
  for (const xau of ['../etc', '01_Projects/../..', '/01_Projects/a', '04_Archives/x', '01_Projects/.git', '01_Projects/a/../b', '', '01_Projects/a\\b', 'memory']) assert.equal(kiemThuMucKb(xau), null, xau);
  assert.equal(thuMucGocDuAn('01_Projects/SonicRec', 'X'), '01_Projects/SonicRec/Sonicplan');
  assert.equal(thuMucGocDuAn(null, 'Cá nhân'), '_INBOX/Sonicplan/Ca_Nhan');
  assert.equal(thuMucLamViec('01_Projects/SonicRec', 'X', { id: 7, tieu_de: 'Soạn báo cáo tuần' }, new Date('2026-10-15T12:00:00Z')), '01_Projects/SonicRec/Sonicplan/261015_Soan_Bao_Cao_Tuan_v7');
});

test('cấu hình thợ Claude: mặc định theo PM, giới hạn giá trị', () => {
  // PM dặn 19/10/2026: thợ không tự chạy và không có hạn mức lượt; chỉ còn model cho phần soạn prompt và rà soát.
  assert.deepEqual(chuanCauHinhTho(undefined), { model: 'claude-haiku-5-5', effort: 'medium', model_theo_loai: true });
  assert.deepEqual(chuanCauHinhTho({ tu_chay: true, song_song: 4, toi_da_ngay: 50 }), { model: 'claude-haiku-5-5', effort: 'medium', model_theo_loai: true });
  assert.equal(chuanCauHinhTho({ effort: 'x', model: 'a b' }).effort, 'medium');
});

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc, kb_thu_muc) VALUES (1, 'tc1', 'Demo Dự Án', '2026-01-01', '01_Projects/DemoDuAn')");
  return { db, env: { CSDL: d1(db) } };
}
const viec = (db, id, tieuDe, nhom, han = null, tin = null) => db.prepare(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nhom, han_ngay, du_an_id, tin_nhan_id, tao_luc, cap_nhat_luc) VALUES (?1, 'tc1', ?2, 'mo', ?3, ?4, 1, ?5, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`).run(id, tieuDe, nhom, han, tin);

const phien = (vt) => ({ email: 'a@b.c', nguoi_dung: { id: 'nd' }, to_chuc: { id: 'tc1', vai_tro: vt }, cac_to_chuc: [{ id: 'tc1' }] });
const goi = (env, vt, pt, duong, than) => {
  const url = new URL(`https://plan.vi-du.vn${duong}`);
  return xuLyApi(new Request(url, { method: pt, headers: { origin: url.origin, 'content-type': 'application/json' }, body: pt === 'GET' ? undefined : JSON.stringify(than ?? {}) }), env, phien(vt), url);
};

test('API thợ Claude và ghép dự án: đọc, lưu, chặn thành viên và đường dẫn lạ', async () => {
  const { db, env } = moiTruong();
  db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc) VALUES (2, 'tc1', 'Đào tạo Ngắn hạn', '2026-01-01')");
  env.THO_CLAUDE = { lietKeThuMucKb: async () => ['DaoTao_NganHan', 'SonicRec'], thongTinKb: async () => ({ da_clone: true, ban_moi_nhat: 'abc' }) };
  const doc = await (await goi(env, 'thanh_vien', 'GET', '/api/tho-claude')).json();
  assert.equal(doc.co_may, true);
  assert.equal(doc.kb.da_clone, true);
  // Không còn đường nào chạy lượt việc hay tự chạy: đổi cấu hình và chạy ngay đều không tồn tại.
  assert.equal((await goi(env, 'chu', 'PUT', '/api/tho-claude', { tu_chay: true })).status, 404);
  assert.equal((await goi(env, 'chu', 'POST', '/api/tho-claude/chay-ngay')).status, 404);
  const kb = await (await goi(env, 'chu', 'GET', '/api/kb/du-an')).json();
  assert.equal(kb.du_an.find((d) => d.id === 2).goi_y, '01_Projects/DaoTao_NganHan');
  assert.deepEqual(kb.thu_muc_kb, ['01_Projects/DaoTao_NganHan', '01_Projects/SonicRec']);
  assert.equal((await goi(env, 'thanh_vien', 'PUT', '/api/kb/du-an/2', { kb_thu_muc: '01_Projects/SonicRec' })).status, 403);
  assert.equal((await goi(env, 'chu', 'PUT', '/api/kb/du-an/2', { kb_thu_muc: '../../etc' })).status, 400);
  assert.equal((await goi(env, 'chu', 'PUT', '/api/kb/du-an/2', { kb_thu_muc: '01_Projects/SonicRec' })).status, 200);
  assert.deepEqual({ ...db.prepare('SELECT kb_thu_muc, kb_duyet FROM du_an WHERE id = 2').get() }, { kb_thu_muc: '01_Projects/SonicRec', kb_duyet: 1 });
  const khong = moiTruong().env;
  assert.equal((await (await goi(khong, 'chu', 'GET', '/api/tho-claude')).json()).co_may, false);
});

test('sửa việc ghi sự kiện: đổi nhóm, đổi tên, sửa hạn', async () => {
  const { db, env } = moiTruong();
  viec(db, 1, 'Tên cũ', 'claude_chuan_bi', '2026-10-20');
  assert.equal((await goi(env, 'chu', 'PATCH', '/api/viec/1', { nhom: 'anh_tu_lam', tieu_de: 'Tên mới', han_ngay: '2026-10-25' })).status, 200);
  const sk = db.prepare('SELECT loai, noi_dung FROM viec_su_kien WHERE viec_id = 1 ORDER BY id').all();
  assert.deepEqual(sk.map((x) => x.loai).sort(), ['doi_nhom', 'sua_han', 'sua_ten']);
  assert.equal(sk.find((x) => x.loai === 'doi_nhom').noi_dung, 'claude_chuan_bi -> anh_tu_lam');
  assert.equal(sk.find((x) => x.loai === 'sua_han').noi_dung, '2026-10-20 -> 2026-10-25');
});

// ---- Chạy trọn một lượt: Claude giả, kho KB git cục bộ, không mạng ----
function git(cwd, ...a) { return execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }); }

async function dungChayThu(cheDo = 'xong') {
  const goc = mkdtempSync(join(tmpdir(), 'tho-'));
  const kbNguon = join(goc, 'kb.git');
  const lam = join(goc, 'gieo');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', kbNguon]);
  execFileSync('git', ['init', '-q', '-b', 'main', lam]);
  writeFileSync(join(lam, 'CLAUDE.md'), '# KB thử\n');
  execFileSync('mkdir', ['-p', join(lam, '01_Projects/DemoDuAn'), join(lam, 'memory')]);
  writeFileSync(join(lam, '01_Projects/DemoDuAn/.giu'), '');
  writeFileSync(join(lam, 'memory/MEMORY.md'), '# Mục lục\n');
  git(lam, 'add', '-A');
  git(lam, 'commit', '-q', '-m', 'khởi tạo');
  git(lam, 'remote', 'add', 'origin', kbNguon);
  git(lam, 'push', '-q', 'origin', 'main');
  // Kho second-brain thử: nơi ghi nhớ Sonicplan được đẩy thẳng lên main.
  const sbNguon = join(goc, 'sb.git');
  const sbLam = join(goc, 'gieo-sb');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', sbNguon]);
  execFileSync('git', ['init', '-q', '-b', 'main', sbLam]);
  execFileSync('mkdir', ['-p', join(sbLam, 'memory/projects')]);
  writeFileSync(join(sbLam, 'memory/MEMORY.md'), '# Mục lục\n');
  git(sbLam, 'add', '-A');
  git(sbLam, 'commit', '-q', '-m', 'khởi tạo');
  git(sbLam, 'remote', 'add', 'origin', sbNguon);
  git(sbLam, 'push', '-q', 'origin', 'main');
  const claude = join(goc, 'claude-gia.sh');
  writeFileSync(claude, `#!/bin/bash
LN=$(cat)
echo "$@" > "$(dirname "$0")/doi-so.txt"
echo "$PATH" > "$(dirname "$0")/duong-path.txt"
THU=$(echo "$LN" | grep -m1 '^Dự án:' | sed 's/.*Thư mục làm việc: //; s#/$##')
mkdir -p "$THU/ket-qua"
${cheDo === 'email' ? `mkdir -p "$THU/ket-qua"\ncat > "$THU/ket-qua/nhap-email.json" <<'JSON'\n{"chu_de": "Trả lời Khoa Khoa học Sức khỏe về lịch họp", "noi_dung": "Kính gửi Khoa,\\nBên em xác nhận lịch họp thứ Sáu.\\nTrân trọng."}\nJSON\necho '{"type":"result","subtype":"success","is_error":false,"result":"Đã soạn thư.","total_cost_usd":0.01,"num_turns":2}'` : cheDo === 'bao-cao' ? `echo '{"type":"result","subtype":"success","is_error":false,"result":"## Tóm tắt\\nĐúng việc 5/6.\\n\\n## Đề xuất\\n1. Thêm quy tắc về hạn.","total_cost_usd":0.03,"num_turns":2}'` : cheDo === 'loi' ? 'echo "{\\"type\\":\\"result\\",\\"is_error\\":true,\\"result\\":\\"hết hạn mức\\"}"; exit 1' : `echo "Báo cáo thử" > "$THU/ket-qua/bao-cao.md"
echo "ghi chu ngoai pham vi" > ngoai-pham-vi.txt
mkdir -p memory && echo "rac" > memory/Claude_tu_ghi.md
echo '{"type":"result","subtype":"success","is_error":false,"result":"Đã soạn xong báo cáo.\\n\\nGiả định đã chọn:\\n- Dùng mẫu chuẩn.","total_cost_usd":0.02,"num_turns":4}'`}
`);
  chmodSync(claude, 0o755);
  return { goc, kbNguon, sbNguon, claude };
}

test('không có đường nào trong mã để tự gửi thư: không gọi API gửi của Gmail, không SMTP', async () => {
  const { readdirSync } = await import('node:fs');
  const quet = (thuMuc) => readdirSync(thuMuc, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? quet(join(thuMuc, d.name)) : /\.m?js$/.test(d.name) ? [join(thuMuc, d.name)] : []));
  const cam = /messages\/send|drafts\/send|messages\.send|drafts\.send|users\.messages\.send|smtp|nodemailer|sendmail|\/gmail\/v1\/users\/me\/(messages|drafts)\/[^'"`]*send/i;
  const loi = [];
  for (const f of [...quet('src'), ...quet('may-chu')]) if (cam.test(readFileSync(f, 'utf8'))) loi.push(f);
  assert.deepEqual(loi, []);
});

test('đồng bộ ghi nhớ sang second-brain: đẩy thẳng main memory/projects/Sonicplan_GhiNho.md, không PR, không đụng ThangLong_KB, không đẩy khi nội dung không đổi', async () => {
  const { db, env } = moiTruong();
  const them = db.prepare(`INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, ghim, tao_luc, cap_nhat_luc) VALUES ('tc1', ?1, ?2, ?3, ?4, '2026-10-01', '2026-10-01')`);
  them.run('nguoi', 'Bình', 'Trưởng phòng Hợp tác', 1);
  them.run('du_an', 'SonicRec', 'Ghi âm họp ra biên bản\nvòng 2 mở 24/10', 0);
  them.run('quyet_dinh', 'Dùng Sonnet', 'Mức medium, 10 việc mỗi ngày', 0);
  const { goc, kbNguon, sbNguon, claude } = await dungChayThu();
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, SB_REMOTE: sbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  const kq = await tho.dongBoGhiNho();
  assert.deepEqual([kq.so_ghi_nho, kq.doi], [3, true]);
  const nd = git(sbNguon, 'show', 'main:memory/projects/Sonicplan_GhiNho.md');
  assert.equal(git(sbNguon, 'branch', '--list').trim().replace(/^\*\s*/, ''), 'main'); // không tạo nhánh phụ
  assert.equal(git(kbNguon, 'branch', '--list', 'sonicplan/*').trim(), ''); // ThangLong_KB không nhận gì
  assert.deepEqual(git(sbNguon, 'diff', '--name-only', 'HEAD~1', 'HEAD').trim().split('\n'), ['memory/projects/Sonicplan_GhiNho.md']); // chỉ thư mục memory/
  for (const can of ['# Ghi nhớ từ Sonicplan', '## Người', '- **Bình** (ghim): Trưởng phòng Hợp tác', '## Dự án', 'Ghi âm họp ra biên bản vòng 2 mở 24/10', '## Quyết định']) assert.ok(nd.includes(can), can);
  assert.ok(!nd.includes('Sự thật'));
  // Đã ở main: lần sau nội dung giống thì không có gì mới.
  const dauMain = git(sbNguon, 'rev-parse', 'main');
  const lai = await tho.dongBoGhiNho();
  assert.equal(git(sbNguon, 'rev-parse', 'main'), dauMain);
  assert.equal(lai.doi, false);
  them.run('su_that', 'Mới thêm', 'Một sự thật mới', 0);
  assert.equal((await tho.dongBoGhiNho()).doi, true);
  assert.ok(db.prepare(`SELECT gia_tri FROM cai_dat WHERE to_chuc_id = '' AND khoa = 'ghi_nho_kb_luc'`).get().gia_tri);
  await tho.dong();
});

test('đo chất lượng tách việc: tự tính 5 chỉ số từ thao tác của người dùng, bỏ qua việc tự thêm và hủy do chặn nguồn', async () => {
  const { tinhChatLuongTachViec, khoangNgay } = await import('../src/danh-gia-tach-viec.js');
  const { db, env } = moiTruong();
  const them = (id, nguon, duAn, han) => db.prepare(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nguon, du_an_id, han_ngay, tao_luc, cap_nhat_luc) VALUES (?1, 'tc1', 'v', 'mo', ?2, ?3, ?4, '2026-10-10T01:00:00Z', '2026-10-10T01:00:00Z')`).run(id, nguon, duAn, han);
  for (let i = 1; i <= 10; i++) them(i, 'zalo', i <= 8 ? 1 : null, i <= 8 ? '2026-10-20' : null); // 10 việc AI, 8 có dự án và hạn
  them(11, 'tay', 1, '2026-10-20'); // việc tự thêm: không tính
  const sk = (viecId, loai, noi, luc = '2026-10-10T05:00:00Z') => db.prepare(`INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', ?1, ?2, ?3, ?4)`).run(viecId, loai, noi, luc);
  sk(1, 'huy', 'Việc không đúng'); sk(2, 'huy', 'Gỡ vì đã chặn Zalo nhóm X'); // chỉ việc 1 tính
  sk(3, 'doi_nhom', 'claude_chuan_bi -> anh_tu_lam'); sk(4, 'doi_nhom', 'a -> b');
  sk(5, 'doi_du_an', 'Chuyển vào dự án X');
  sk(6, 'sua_han', 'a -> b', '2026-10-10T20:00:00Z'); // trong 24 giờ: tính
  sk(7, 'sua_han', 'a -> b', '2026-10-15T20:00:00Z'); // sau 5 ngày: không tính
  sk(11, 'huy', 'Việc tự thêm bị hủy'); // việc tay: không tính
  db.exec("INSERT INTO luot_claude (to_chuc_id, viec_id, trang_thai, danh_gia, ma_bam, tao_luc, cap_nhat_luc) VALUES ('tc1', 1, 'xong', 'dat', 'x', '2026-10-11T00:00:00Z', '2026-10-11'), ('tc1', 2, 'xong', 'dat', 'x', '2026-10-11T00:00:00Z', '2026-10-11'), ('tc1', 3, 'xong', 'lam_lai', 'x', '2026-10-11T00:00:00Z', '2026-10-11'), ('tc1', 4, 'xong', NULL, 'x', '2026-10-11T00:00:00Z', '2026-10-11')");
  const kq = await tinhChatLuongTachViec(env, 'tc1', { tu: '2026-10-01T00:00:00Z', den: '2026-10-31T00:00:00Z' });
  const c = Object.fromEntries(kq.chi_so.map((x) => [x.ma, x]));
  assert.equal(kq.so_viec_ai, 10);
  assert.deepEqual([c.dung_viec.tu_so, c.dung_viec.mau_so, c.dung_viec.ty_le, c.dung_viec.dat], [1, 10, 0.9, true]);
  assert.deepEqual([c.dung_nguoi.tu_so, c.dung_nguoi.ty_le, c.dung_nguoi.dat], [2, 0.8, false]);
  assert.deepEqual([c.dung_du_an.tu_so, c.dung_du_an.mau_so], [1, 8]); // mẫu số: việc có dự án (việc 9, 10 không có thì không tính)
  assert.deepEqual([c.dung_han.tu_so, c.dung_han.mau_so], [1, 8]); // chỉ việc 6 sửa hạn trong 24 giờ đầu; việc 7 sửa sau 5 ngày không tính
  assert.deepEqual([c.claude_dat.tu_so, c.claude_dat.mau_so, Math.round(c.claude_dat.ty_le * 100)], [2, 3, 67]);
  assert.deepEqual([c.claude_dat.du_lieu, c.claude_dat.dat], [false, null]); // mới 3 lượt có đánh giá, dưới 5 thì chưa kết luận
  const it = await tinhChatLuongTachViec(env, 'tc1', { tu: '2020-01-01T00:00:00Z', den: '2020-02-01T00:00:00Z' });
  assert.deepEqual([it.so_viec_ai, it.chi_so[0].ty_le, it.chi_so[0].dat, it.chi_so[0].du_lieu], [0, null, null, false]);
  const k = khoangNgay(7, new Date('2026-10-16T00:00:00Z'));
  assert.deepEqual([k.tu, k.den], ['2026-10-09T00:00:00.000Z', '2026-10-16T00:00:00.000Z']);
  const r = await goi(env, 'thanh_vien', 'GET', '/api/hieu-suat/tach-viec?ky=7');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ky, 7);
});

test('rà soát lấy mẫu đúng nhưng không được gọi Claude Code để chấm', async () => {
  const { layMauRaSoat, dungMauRaSoatMd } = await import('../src/danh-gia-tach-viec.js');
  const { db, env } = moiTruong();
  const gan = (gio) => new Date(Date.now() - gio * 3600000).toISOString();
  const tin = db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, da_tach, an) VALUES (?1, 'tc1', 'zalo', ?2, 'An', 'Nhóm A', ?3, ?4, ?4, 1, ?5)`);
  for (let i = 1; i <= 6; i++) { tin.run(i, `g${i}`, `Anh gửi giúp em báo cáo số ${i} nhé`, gan(i), 0); viec(db, i, `Gửi báo cáo ${i}`, 'claude_chuan_bi', '2026-10-20', i); }
  for (let i = 7; i <= 11; i++) tin.run(i, `g${i}`, `Chào cả nhà, hôm nay trời đẹp quá ${i}`, gan(i), 0);
  tin.run(12, 'g12', 'Tin bị ẩn nên không lấy vào mẫu', gan(2), 1);
  tin.run(13, 'g13', 'Tin quá cũ', gan(24 * 20), 0);
  const khoang = { tu: gan(24 * 7), den: new Date().toISOString() };
  const mau = await layMauRaSoat(env, 'tc1', khoang);
  assert.deepEqual([mau.filter((t) => t.sinh_viec).length, mau.filter((t) => !t.sinh_viec).length], [6, 5]);
  assert.ok(!mau.some((t) => [12, 13].includes(t.id)));
  const md = dungMauRaSoatMd(mau, khoang);
  assert.match(md, /AI TÁCH: "Gửi báo cáo \d" \| nhóm Claude chuẩn bị \| hạn 2026-10-20 \| dự án Demo Dự Án/);
  assert.match(md, /AI TÁCH: không sinh việc nào\./);

  const { goc, kbNguon, claude } = await dungChayThu('bao-cao');
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  const [kq] = await tho.raSoatTachViec();
  assert.match(kq.loi, /không được sử dụng Claude Code hoặc gói Max/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM thong_bao WHERE loai = 'claude' AND tieu_de LIKE 'Báo cáo rà soát%'").get().n, 0);
  await tho.dong();
});

// ---- Nháp Gmail: chỉ tạo nháp, không bao giờ gửi ----
function gaGiaGoogle(env) {
  const goi = [];
  const cu = globalThis.fetch;
  globalThis.fetch = async (url, tuyChon = {}) => {
    const u = String(url);
    goi.push({ url: u, method: tuyChon.method || 'GET', body: tuyChon.body });
    if (u.includes('/messages?')) return new Response(JSON.stringify({ messages: [{ id: 'm1', threadId: 'thr1' }] }), { status: 200 });
    if (u.includes('/messages/m1')) return new Response(JSON.stringify({ threadId: 'thr1', payload: { headers: [{ name: 'Message-ID', value: '<goc@khoa.vn>' }, { name: 'From', value: 'Khoa KHSK <khsk@thanglong.edu.vn>' }, { name: 'References', value: '<cu@khoa.vn>' }] } }), { status: 200 });
    if (u.endsWith('/users/me/drafts')) return new Response(JSON.stringify({ id: 'nhap1' }), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  return { goi, tra: () => { globalThis.fetch = cu; } };
}

async function noiGoogle(env, coNhap) {
  const { luuTichHop } = await import('../src/tich-hop.js');
  env.KHOA_MA_HOA = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  await luuTichHop(env, 'tc1', 'google_client', { client_id: 'c', client_secret: 's' });
  await luuTichHop(env, 'tc1', 'google', { refresh_token: 'r', email: 'hai@x.vn', co_nhap: coNhap, truy_cap: 'tok', het_han: Date.now() + 3600000 });
}

test('nháp Gmail: kiểm đầu vào, mã hóa tiêu đề tiếng Việt, thư dạng RFC 822 đúng', async () => {
  const { chuanNhapEmail, maHoaTieuDe, dungThuNhap } = await import('../src/google.js');
  assert.match(chuanNhapEmail({ den: ['khong-hop-le'], chu_de: 'a', noi_dung: 'b' }).loi, /không hợp lệ/);
  assert.match(chuanNhapEmail({ den: ['a@b.vn'], chu_de: '', noi_dung: 'b' }).loi, /chủ đề/);
  assert.match(chuanNhapEmail({ den: ['a@b.vn'], chu_de: 'a', noi_dung: ' ' }).loi, /nội dung/);
  assert.match(chuanNhapEmail({ den: Array.from({ length: 21 }, (_, i) => `a${i}@b.vn`), chu_de: 'a', noi_dung: 'b' }).loi, /20/);
  const ok = chuanNhapEmail({ den: 'a@b.vn', cc: ['c@d.vn'], chu_de: 'Dòng 1\r\nBcc: ke-xau@x.vn', noi_dung: 'Nội dung' });
  assert.ok(ok.nhap);
  assert.ok(!ok.nhap.chu_de.includes('\n'), 'chủ đề không được xuống dòng (chèn tiêu đề thư)');
  assert.equal(maHoaTieuDe('Hello'), 'Hello');
  const mh = maHoaTieuDe('Trả lời Khoa Khoa học Sức khỏe về lịch họp ngày thứ Sáu tuần này');
  assert.match(mh, /^=\?UTF-8\?B\?/);
  assert.equal(mh.split(' ').length, 3); // 62 ký tự thành 3 nhóm 30 ký tự
  const thu = dungThuNhap({ den: ['a@b.vn'], cc: [], chu_de: 'Chào', noi_dung: 'Xin chào' }, { messageId: '<g@x>', references: '<c@x>' });
  assert.match(thu, /^To: a@b\.vn\r\nSubject: =\?UTF-8\?B\?/);
  assert.match(thu, /In-Reply-To: <g@x>\r\nReferences: <c@x> <g@x>/);
  assert.match(thu, /Content-Type: text\/plain; charset="UTF-8"/);
  assert.equal(Buffer.from(thu.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8'), 'Xin chào');
});

test('nháp Gmail: tạo đúng một nháp trong luồng thư gốc, gửi cho người viết thư, không gọi API gửi', async () => {
  const { taoNhapGmail } = await import('../src/google.js');
  const { db, env } = moiTruong();
  await noiGoogle(env, true);
  const ga = gaGiaGoogle(env);
  try {
    const r = await taoNhapGmail(env, 'tc1', { chu_de: 'Trả lời lịch họp', noi_dung: 'Xác nhận thứ Sáu.' }, { tinGoc: { nguon: 'gmail', ma_goc: 'goc@khoa.vn' } });
    assert.deepEqual([r.ok, r.id, r.trong_luong_thu], [true, 'nhap1', true]);
    const tao = ga.goi.find((g) => g.method === 'POST');
    assert.ok(tao.url.endsWith('/gmail/v1/users/me/drafts'));
    const body = JSON.parse(tao.body);
    assert.equal(body.message.threadId, 'thr1');
    const raw = Buffer.from(body.message.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    assert.match(raw, /To: khsk@thanglong\.edu\.vn/);
    assert.match(raw, /In-Reply-To: <goc@khoa\.vn>/);
    assert.match(raw, /References: <cu@khoa\.vn> <goc@khoa\.vn>/);
    assert.ok(!ga.goi.some((g) => /send/i.test(g.url)), 'không được gọi bất kỳ API gửi nào');
    assert.equal(ga.goi.filter((g) => g.method === 'POST').length, 1);
    // Không có tin gốc và không ghi người nhận: không tạo nháp.
    const khong = await taoNhapGmail(env, 'tc1', { chu_de: 'a', noi_dung: 'b' });
    assert.match(khong.ly_do, /người nhận/);
    // Chưa cấp quyền soạn nháp thì báo cách cấp, không gọi Gmail.
    await noiGoogle(env, false);
    const dem = ga.goi.length;
    const chua = await taoNhapGmail(env, 'tc1', { den: ['a@b.vn'], chu_de: 'a', noi_dung: 'b' });
    assert.match(chua.ly_do, /quyền soạn nháp/);
    assert.equal(ga.goi.length, dem);
  } finally { ga.tra(); }
});

test('ghi nhớ KB về Sonicplan: đọc lại file, hợp nhất ba bên, Sonicplan thắng khi cùng sửa, không xóa vì file thiếu', async () => {
  const { docGhiNhoMd, dungGhiNhoMd, hopNhatGhiNho } = await import('../src/tho-claude.js');
  const ds = [
    { loai: 'nguoi', tieu_de: 'Bình', noi_dung: 'Trưởng phòng Hợp tác', ghim: 1 },
    { loai: 'du_an', tieu_de: 'SonicRec', noi_dung: 'Ghi âm họp ra biên bản', ghim: 0 },
    { loai: 'quyet_dinh', tieu_de: 'Dùng Sonnet', noi_dung: 'Mức medium', ghim: 0 },
  ];
  assert.deepEqual(docGhiNhoMd(dungGhiNhoMd(ds)), ds); // xuất rồi đọc lại ra đúng danh sách
  assert.deepEqual(docGhiNhoMd('## Lạ\n- **x**: y\nrác\n## Người\n- **A**: b'), [{ loai: 'nguoi', tieu_de: 'A', noi_dung: 'b', ghim: 0 }]);
  const base = ds;
  const kb = (them) => ds.map((g) => ({ ...g, ...(them[g.tieu_de] || {}) }));
  // Mục mới trong KB: thêm. Mục KB sửa mà Sonicplan chưa đổi: nhận. Cả hai cùng sửa: Sonicplan thắng. File thiếu một mục: không xóa.
  const hn = hopNhatGhiNho({
    base,
    ours: ds.map((g) => (g.tieu_de === 'SonicRec' ? { ...g, noi_dung: 'Bản của Sonicplan' } : g)),
    theirs: [...kb({ Bình: { noi_dung: 'Giám đốc Hợp tác' }, SonicRec: { noi_dung: 'Bản của KB' } }).filter((g) => g.tieu_de !== 'Dùng Sonnet'), { loai: 'su_that', tieu_de: 'Mới từ KB', noi_dung: 'PM ghi trực tiếp', ghim: 0 }],
  });
  assert.deepEqual(hn.them.map((g) => g.tieu_de), ['Mới từ KB']);
  assert.deepEqual(hn.sua.map((g) => [g.tieu_de, g.noi_dung]), [['Bình', 'Giám đốc Hợp tác']]);
  assert.deepEqual(hn.xung_dot, ['du_an|sonicrec']);
  // Chưa có bản gốc: chỉ thêm mục mới, không ghi đè mục có sẵn. Sonicplan đã xóa mục có trong bản gốc thì KB không hồi sinh nó.
  assert.deepEqual(hopNhatGhiNho({ base: null, ours: ds, theirs: kb({ Bình: { noi_dung: 'Khác' } }) }), { them: [], sua: [], xung_dot: [] });
  assert.deepEqual(hopNhatGhiNho({ base, ours: ds.slice(1), theirs: ds }).them, []);
});

test('đồng bộ ghi nhớ hai chiều với second-brain thật (kho git cục bộ): xuất, khớp, nhận điều KB sửa, giữ bản Sonicplan khi xung đột', async () => {
  const { db, env } = moiTruong();
  const them = db.prepare(`INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, ghim, tao_luc, cap_nhat_luc) VALUES ('tc1', ?1, ?2, ?3, ?4, '2026-10-01', '2026-10-01')`);
  them.run('nguoi', 'Bình', 'Trưởng phòng Hợp tác', 1);
  them.run('du_an', 'SonicRec', 'Ghi âm họp ra biên bản', 0);
  them.run('quyet_dinh', 'Dùng Sonnet', 'Mức medium', 0);
  const { goc, kbNguon, sbNguon, claude } = await dungChayThu();
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, SB_REMOTE: sbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  assert.equal((await tho.dongBoGhiNho()).doi, true);
  assert.equal((await tho.dongBoGhiNho()).doi, false); // đã khớp: lưu bản gốc
  assert.ok(db.prepare("SELECT gia_tri FROM cai_dat WHERE to_chuc_id = 'tc1' AND khoa = 'ghi_nho_kb_goc'").get());

  // PM sửa trực tiếp trong file ở KB: sửa Bình, sửa SonicRec, thêm mục mới; cùng lúc Sonicplan đã sửa SonicRec.
  const lam = join(goc, 'sua-kb');
  git(goc, 'clone', '-q', sbNguon, lam);
  const tep = join(lam, 'memory/projects/Sonicplan_GhiNho.md');
  let nd = readFileSync(tep, 'utf8').replace('Trưởng phòng Hợp tác', 'Giám đốc Hợp tác').replace('Ghi âm họp ra biên bản', 'Bản của KB');
  nd = `${nd.trimEnd()}\n\n## Sự thật\n\n- **Mới từ KB**: PM ghi trực tiếp trong file\n- **Mật khẩu**: mật khẩu là 123456\n`;
  writeFileSync(tep, nd);
  git(lam, 'commit', '-qam', 'PM sửa ghi nhớ'); git(lam, 'push', '-q', 'origin', 'main');
  db.prepare("UPDATE ghi_nho SET noi_dung = 'Bản của Sonicplan' WHERE tieu_de = 'SonicRec'").run();

  const kq = await tho.dongBoGhiNho();
  assert.equal(kq.nhap_tu_kb, 2); // Bình sửa + mục mới; mục Mật khẩu bị bộ lọc nhạy cảm chặn
  const dong = (t) => ({ ...db.prepare('SELECT noi_dung, nguon, da_duyet, ghim FROM ghi_nho WHERE tieu_de = ?1').get(t) });
  assert.equal(dong('Bình').noi_dung, 'Giám đốc Hợp tác');
  assert.equal(dong('Bình').nguon, 'tay');
  assert.deepEqual(dong('Mới từ KB'), { noi_dung: 'PM ghi trực tiếp trong file', nguon: 'tay', da_duyet: 1, ghim: 0 });
  assert.equal(dong('SonicRec').noi_dung, 'Bản của Sonicplan'); // xung đột: Sonicplan thắng
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ghi_nho WHERE tieu_de = 'Mật khẩu'").get().n, 0);
  assert.equal(kq.doi, true); // bản của KB lệch Sonicplan (SonicRec, và mục chặn) nên đẩy lại main
  await tho.dong();
});

test('lời nhắc tách việc có ba quy tắc rà soát đã duyệt 16/10/2026', async () => {
  const { loiNhacTachViec } = await import('../src/ai.js');
  const [he] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'x', thoi_diem: 't' }], '2026-10-16', 'Hải', [], [], [], [], []).map((m) => m.content ?? m);
  for (const can of ['13) CHỈ TÁCH VIỆC khi tin đặt việc lên người dùng', 'rủ ăn uống', 'chị mua nước cho cô giáo', '14) BẮT BUỘC có ít nhất một việc khi tin gọi đích danh', 'nom = 3'.replace('nom', 'nhom'), 'tối thiểu 4 từ', 'CÓ DẤU', 'KHÔNG sao chép nguyên lỗi', 'KHÔNG tạo việc đó']) assert.ok(he.includes(can), can);
});


// ---- Đợt 1 (17/10/2026): đầu vào, model theo loại việc, PATH python, tệp ghi âm ----

const tin = (db, id, nguoi, noiDung, ma = 'hoi-thoai-1', thoiDiem = '2026-10-14T01:00:00Z') => db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai) VALUES (?1, 'tc1', 'zalo', ?2, ?3, 'Nhóm A', ?4, ?5, ?5, ?6)`).run(id, `g${id}`, nguoi, noiDung, thoiDiem, ma);
const tep = (db, id, tinId, ten, loai) => db.prepare(`INSERT INTO tep (id, to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, r2_khoa, tao_luc) VALUES (?1, 'tc1', ?2, ?3, ?4, 100, ?5, '2026-10-14')`).run(id, tinId, ten, loai, `k${id}`);

test('model theo loại việc: tờ trình, hợp đồng, pháp lý, phân tích dùng Sonnet; còn lại model cấu hình; tắt được', () => {
  const ch = chuanCauHinhTho({});
  const chon = (tieuDe, cauHinh = ch) => chonModelChoViec([{ tieu_de: tieuDe, ghi_chu: '' }], cauHinh);
  assert.equal(chon('Xử lý tờ trình phê duyệt hợp tác').model, 'claude-sonnet-5-5');
  assert.equal(chon('Xem bản Thỏa thuận hợp tác MOU PVcomBank').model, 'claude-sonnet-5-5');
  assert.equal(chon('Xem lại bản NDA Ipsos đã chỉnh của Pháp chế').model, 'claude-sonnet-5-5');
  assert.equal(chon('Phân tích số liệu tuyển sinh').model, 'claude-sonnet-5-5');
  assert.equal(chon('Trả lời Hong Nguyen về việc chia sẻ thông tin').model, 'claude-haiku-5-5');
  assert.equal(chon('Điền tên CBCT vào link phân công coi thi').theo_loai, false);
  assert.equal(chon('Xử lý tờ trình', chuanCauHinhTho({ model_theo_loai: false })).model, 'claude-haiku-5-5');
  assert.equal(chon('Xử lý tờ trình', chuanCauHinhTho({ model: 'claude-sonnet-5-5' })).theo_loai, false); // đã là Sonnet
  assert.equal(chonModelChoViec([{ tieu_de: 'Việc nhẹ' }, { tieu_de: 'Soạn đề xuất gửi BGH' }], ch).model, 'claude-sonnet-5-5'); // lượt gộp: một việc khó là đủ
});

test('PATH cho Claude có python3 đủ thư viện: /usr/local/bin và bản python.org, không trùng, giữ PATH gốc', () => {
  const p = duongDanChoClaude({ PYTHON_BIN: '/opt/py/bin/python3' }, '/usr/bin:/bin:/usr/local/bin').split(':');
  assert.ok(p.includes('/usr/local/bin') && p.includes('/opt/homebrew/bin') && p.includes('/usr/bin'));
  assert.equal(p[p.length - 1] === '/bin' || p.includes('/bin'), true);
  assert.equal(new Set(p).size, p.length);
  assert.ok(p.indexOf('/opt/py/bin') < p.indexOf('/usr/bin')); // bản python chỉ định đứng trước hệ thống
});

