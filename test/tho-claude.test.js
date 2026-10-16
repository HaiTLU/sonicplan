// Thợ Claude: ghép dự án với KB, hàng đợi và hạn mức, gói ngữ cảnh, lời nhắc, và chạy trọn một lượt
// với Claude giả và kho git cục bộ (không gọi mạng). Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { d1, dungCsdl } from './csdl-thu.js';
import { chuanTen, goiYThuMuc, kiemThuMucKb, tenThuMuc, thuMucGocDuAn, thuMucLamViec } from '../src/kb.js';
import { DAU_CAU_HOI as DAU_GOC } from '../src/claude-code.js';
import { chonViecTuDong, chuanCauHinhTho, dauNgayVN, DAU_CAU_HOI, demTuDongHomNay, docCauHinhTho, dungLichSuMd, dungNguCanhMd, layDinhKem, layTinNguCanh, loiNhacTho, luuCauHinhTho, taoLuotMay } from '../src/tho-claude.js';
import { giaoClaude } from '../src/claude-code.js';
import { moThoClaude } from '../may-chu/tho-claude.js';
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
  assert.equal(DAU_CAU_HOI, DAU_GOC);
});

test('cấu hình thợ Claude: mặc định theo PM, giới hạn giá trị', () => {
  assert.deepEqual(chuanCauHinhTho(undefined), { bat: true, song_song: 2, toi_da_ngay: 10, model: 'claude-sonnet-5-5', effort: 'medium' });
  assert.equal(chuanCauHinhTho({ song_song: 99, toi_da_ngay: -1, effort: 'x', model: 'a b' }).song_song, 2);
  assert.equal(chuanCauHinhTho({ song_song: 3, bat: false }).bat, false);
  assert.equal(dauNgayVN(new Date('2026-10-15T20:00:00Z')), '2026-10-15T17:00:00.000Z'); // 3h sáng 16/10 giờ VN: đầu ngày 16/10 VN = 17h UTC ngày 15
});

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc, kb_thu_muc) VALUES (1, 'tc1', 'Demo Dự Án', '2026-01-01', '01_Projects/DemoDuAn')");
  return { db, env: { CSDL: d1(db) } };
}
const viec = (db, id, tieuDe, nhom, han = null, tin = null) => db.prepare(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nhom, han_ngay, du_an_id, tin_nhan_id, tao_luc, cap_nhat_luc) VALUES (?1, 'tc1', ?2, 'mo', ?3, ?4, 1, ?5, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`).run(id, tieuDe, nhom, han, tin);

test('hàng đợi tự động: chỉ việc mở nhóm Claude chưa có lượt, hạn gần trước; hạn mức theo ngày', async () => {
  const { db, env } = moiTruong();
  viec(db, 1, 'Làm sau', 'claude_chuan_bi', '2026-11-01');
  viec(db, 2, 'Làm trước', 'claude_tu_lam', '2026-10-20');
  viec(db, 3, 'Anh tự làm', 'anh_tu_lam', '2026-10-16');
  viec(db, 4, 'Không hạn', 'claude_chuan_bi');
  viec(db, 5, 'Đã có lượt', 'claude_tu_lam', '2026-10-10');
  db.exec("INSERT INTO luot_claude (to_chuc_id, viec_id, ma_bam, tao_luc, cap_nhat_luc) VALUES ('tc1', 5, 'x', '2026-10-10', '2026-10-10')");
  const ds = await chonViecTuDong(env, 'tc1', 10);
  assert.deepEqual(ds.map((v) => v.id), [2, 1, 4]);
  const id = await taoLuotMay(env, 'tc1', ds[0], { tuDong: true, viecPhu: [ds[1]] });
  const dong = db.prepare('SELECT noi_chay, tu_dong, lo_id, trang_thai FROM luot_claude WHERE id = ?1 OR lo_id = ?1 ORDER BY id').all(id);
  assert.deepEqual(dong.map((x) => [x.noi_chay, x.tu_dong, x.lo_id]), [['may', 1, null], ['may', 0, id]]);
  assert.equal(await demTuDongHomNay(env, 'tc1', new Date()), 1);
  assert.equal((await chonViecTuDong(env, 'tc1', 10)).length, 1); // việc 2 và 1 đã có lượt, còn việc 4
  await luuCauHinhTho(env, 'tc1', { toi_da_ngay: 5, song_song: 1 });
  assert.deepEqual([(await docCauHinhTho(env, 'tc1')).toi_da_ngay, (await docCauHinhTho(env, 'tc1')).song_song], [5, 1]);
});

test('gói ngữ cảnh: tin gốc, tin cùng hội thoại trong 3 ngày, tệp đính kèm, lịch sử lượt trước', async () => {
  const { db, env } = moiTruong();
  const them = db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai) VALUES (?1, 'tc1', 'zalo', ?2, ?3, 'Nhóm A', ?4, ?5, ?5, ?6)`);
  them.run(1, 'a', 'An', 'Anh gửi giúp em bảng giá nhé', '2026-10-14T01:00:00Z', 'h1');
  them.run(2, 'b', 'Bình', 'Mình cần trước thứ Sáu', '2026-10-14T02:00:00Z', 'h1');
  them.run(3, 'c', 'Cường', 'Tin của nhóm khác', '2026-10-14T02:30:00Z', 'h2');
  them.run(4, 'd', 'An', 'Tin quá cũ cùng nhóm', '2026-09-01T02:30:00Z', 'h1');
  db.exec("INSERT INTO tep (to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, r2_khoa, tao_luc) VALUES ('tc1', 1, 'bang-gia.xlsx', 'xlsx', 8, 'k1', '2026-10-14'), ('tc1', 1, 'qua-lon.pdf', 'pdf', 99999999, 'k2', '2026-10-14')");
  env.TEP = { get: async (k) => (k === 'k1' ? { arrayBuffer: async () => new TextEncoder().encode('du lieu').buffer } : null) };
  viec(db, 10, 'Gửi bảng giá', 'claude_chuan_bi', '2026-10-16', 1);
  const v = db.prepare('SELECT * FROM viec WHERE id = 10').get();
  const tin = await layTinNguCanh(env, 'tc1', v);
  assert.equal(tin.goc.id, 1);
  assert.deepEqual(tin.quanh.map((t) => t.id), [1, 2]);
  const dk = await layDinhKem(env, 'tc1', tin.quanh.map((t) => t.id));
  assert.equal(new TextDecoder().decode(dk[0].byte), 'du lieu');
  assert.match(dk[1].bo_qua, /quá lớn/);
  db.exec("INSERT INTO luot_claude (id, to_chuc_id, viec_id, trang_thai, dan, ket_qua, danh_gia, ma_bam, tao_luc, cap_nhat_luc) VALUES (1, 'tc1', 10, 'xong', 'Lần trước chưa đạt vì thiếu cột VAT', 'Đã soạn bảng giá', 'lam_lai', 'x', '2026-10-14T05:00:00Z', '2026-10-14T05:00:00Z')");
  const md = dungNguCanhMd({ viecList: [v], duAn: { ten: 'Demo Dự Án' }, tin, ghiNho: [{ loai: 'nguoi', tieu_de: 'Bình', noi_dung: 'Trưởng phòng' }], dinhKem: dk });
  for (const can of ['Gửi bảng giá', 'Anh gửi giúp em bảng giá', 'Mình cần trước thứ Sáu', '(TIN GỐC)', 'bang-gia.xlsx', 'qua-lon.pdf: bỏ qua', 'Trưởng phòng', 'Claude chuẩn bị']) assert.ok(md.includes(can), can);
  assert.ok(!md.includes('Tin của nhóm khác') && !md.includes('Tin quá cũ'));
  const ls = dungLichSuMd(await (await import('../src/tho-claude.js')).layLichSuLuot(env, 'tc1', v));
  assert.match(ls, /CHƯA ĐẠT, làm lại/);
  assert.match(ls, /thiếu cột VAT/);
  const nhac = loiNhacTho({ viecList: [v], duAn: { ten: 'Demo Dự Án' }, thuMucLam: '01_Projects/DemoDuAn/Sonicplan/261015_Gui_Bang_Gia_v10', dan: 'Làm gọn', truoc: 'Bản cũ' });
  for (const can of ['01_Projects/DemoDuAn/Sonicplan/261015_Gui_Bang_Gia_v10/NGU-CANH.md', 'LICH-SU.md', 'nhap-email.json', 'TUYỆT ĐỐI không gửi email', 'kể cả khi tên việc là "Gửi thư"', 'Giả định đã chọn', DAU_CAU_HOI, 'Claude chuẩn bị', 'Làm gọn', 'Bản cũ', 'Không dùng git']) assert.ok(nhac.includes(can), can);
});

const phien = (vt) => ({ email: 'a@b.c', nguoi_dung: { id: 'nd' }, to_chuc: { id: 'tc1', vai_tro: vt }, cac_to_chuc: [{ id: 'tc1' }] });
const goi = (env, vt, pt, duong, than) => {
  const url = new URL(`https://plan.vi-du.vn${duong}`);
  return xuLyApi(new Request(url, { method: pt, headers: { origin: url.origin, 'content-type': 'application/json' }, body: pt === 'GET' ? undefined : JSON.stringify(than ?? {}) }), env, phien(vt), url);
};

test('API thợ Claude và ghép dự án: đọc, lưu, chặn thành viên và đường dẫn lạ', async () => {
  const { db, env } = moiTruong();
  db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc) VALUES (2, 'tc1', 'Đào tạo Ngắn hạn', '2026-01-01')");
  env.THO_CLAUDE = { lietKeThuMucKb: async () => ['DaoTao_NganHan', 'SonicRec'], thongTinKb: async () => ({ da_clone: true, ban_moi_nhat: 'abc' }), chayNgay: () => {} };
  const doc = await (await goi(env, 'thanh_vien', 'GET', '/api/tho-claude')).json();
  assert.equal(doc.co_may, true);
  assert.equal(doc.cau_hinh.song_song, 2);
  assert.equal((await goi(env, 'thanh_vien', 'PUT', '/api/tho-claude', { bat: false })).status, 403);
  assert.equal((await goi(env, 'thanh_vien', 'POST', '/api/tho-claude/chay-ngay')).status, 403);
  assert.equal((await goi(env, 'chu', 'PUT', '/api/tho-claude', { bat: false, song_song: 3 })).status, 200);
  assert.deepEqual([(await docCauHinhTho(env, 'tc1')).bat, (await docCauHinhTho(env, 'tc1')).song_song], [false, 3]);
  const kb = await (await goi(env, 'chu', 'GET', '/api/kb/du-an')).json();
  assert.equal(kb.du_an.find((d) => d.id === 2).goi_y, '01_Projects/DaoTao_NganHan');
  assert.deepEqual(kb.thu_muc_kb, ['01_Projects/DaoTao_NganHan', '01_Projects/SonicRec']);
  assert.equal((await goi(env, 'thanh_vien', 'PUT', '/api/kb/du-an/2', { kb_thu_muc: '01_Projects/SonicRec' })).status, 403);
  assert.equal((await goi(env, 'chu', 'PUT', '/api/kb/du-an/2', { kb_thu_muc: '../../etc' })).status, 400);
  assert.equal((await goi(env, 'chu', 'PUT', '/api/kb/du-an/2', { kb_thu_muc: '01_Projects/SonicRec' })).status, 200);
  assert.deepEqual({ ...db.prepare('SELECT kb_thu_muc, kb_duyet FROM du_an WHERE id = 2').get() }, { kb_thu_muc: '01_Projects/SonicRec', kb_duyet: 1 });
  const khong = moiTruong().env;
  assert.equal((await (await goi(khong, 'chu', 'GET', '/api/tho-claude')).json()).co_may, false);
  assert.equal((await goi(khong, 'chu', 'PUT', '/api/tho-claude', { bat: false })).status, 400);
});

test('Giao Claude bấm tay: có thợ ở máy thì xếp hàng đợi, không cần GitHub; thợ tắt thì đòi GitHub', async () => {
  const { db, env } = moiTruong();
  viec(db, 1, 'Việc một', 'claude_tu_lam');
  viec(db, 2, 'Việc hai', 'claude_tu_lam');
  env.THO_CLAUDE = {};
  const kq = await giaoClaude(env, 'tc1', [1, 2], { dan: 'Làm gọn', cach: 'gop' }, 'https://plan.vi-du.vn');
  assert.ok(kq.luot, JSON.stringify(kq));
  const ds = db.prepare('SELECT viec_id, noi_chay, trang_thai, lo_id, dan, tu_dong FROM luot_claude ORDER BY id').all();
  assert.deepEqual(ds.map((x) => [x.viec_id, x.noi_chay, x.trang_thai, x.lo_id, x.tu_dong]), [[1, 'may', 'cho', null, 0], [2, 'may', 'cho', kq.luot, 0]]);
  assert.equal(ds[0].dan, 'Làm gọn');
  await luuCauHinhTho(env, 'tc1', { bat: false });
  const tat = await giaoClaude(env, 'tc1', [1], {}, 'https://plan.vi-du.vn');
  assert.match(tat.loi, /Chưa nối GitHub|đang làm/);
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
  const claude = join(goc, 'claude-gia.sh');
  writeFileSync(claude, `#!/bin/bash
LN=$(cat)
echo "$@" > "$(dirname "$0")/doi-so.txt"
THU=$(echo "$LN" | grep -m1 '^Dự án:' | sed 's/.*Thư mục làm việc: //; s#/$##')
mkdir -p "$THU/ket-qua"
${cheDo === 'email' ? `mkdir -p "$THU/ket-qua"\ncat > "$THU/ket-qua/nhap-email.json" <<'JSON'\n{"chu_de": "Trả lời Khoa Khoa học Sức khỏe về lịch họp", "noi_dung": "Kính gửi Khoa,\\nBên em xác nhận lịch họp thứ Sáu.\\nTrân trọng."}\nJSON\necho '{"type":"result","subtype":"success","is_error":false,"result":"Đã soạn thư.","total_cost_usd":0.01,"num_turns":2}'` : cheDo === 'bao-cao' ? `echo '{"type":"result","subtype":"success","is_error":false,"result":"## Tóm tắt\\nĐúng việc 5/6.\\n\\n## Đề xuất\\n1. Thêm quy tắc về hạn.","total_cost_usd":0.03,"num_turns":2}'` : cheDo === 'loi' ? 'echo "{\\"type\\":\\"result\\",\\"is_error\\":true,\\"result\\":\\"hết hạn mức\\"}"; exit 1' : `echo "Báo cáo thử" > "$THU/ket-qua/bao-cao.md"
echo "ghi chu ngoai pham vi" > ngoai-pham-vi.txt
echo '{"type":"result","subtype":"success","is_error":false,"result":"Đã soạn xong báo cáo.\\n\\nGiả định đã chọn:\\n- Dùng mẫu chuẩn.","total_cost_usd":0.02,"num_turns":4}'`}
`);
  chmodSync(claude, 0o755);
  return { goc, kbNguon, claude };
}

test('thợ chạy trọn một lượt: ngữ cảnh vào kho, kết quả lên nhánh, hộp thư Drive, báo PM; hạn mức ngày được tôn trọng', async () => {
  const { db, env } = moiTruong();
  db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai) VALUES (1, 'tc1', 'zalo', 'a', 'An', 'Nhóm A', 'Anh làm giúp em báo cáo tuần', '2026-10-14T01:00:00Z', '2026-10-14T01:00:00Z', 'h1')`).run();
  db.exec("INSERT INTO tep (to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, r2_khoa, tao_luc) VALUES ('tc1', 1, 'so-lieu.csv', 'csv', 5, 'k1', '2026-10-14')");
  env.TEP = { get: async () => ({ arrayBuffer: async () => new TextEncoder().encode('a,b\n1,2').buffer }) };
  viec(db, 1, 'Soạn báo cáo tuần', 'claude_chuan_bi', '2026-10-20', 1);
  const { goc, kbNguon, claude } = await dungChayThu();
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  await tho.vongMotLan();
  await tho.doiXong();
  const l = db.prepare('SELECT * FROM luot_claude WHERE viec_id = 1').get();
  assert.equal(l.trang_thai, 'xong', l.ket_qua);
  assert.equal(l.tu_dong, 1);
  assert.match(l.ket_qua, /Giả định đã chọn/);
  assert.match(l.thu_muc_lam, /^01_Projects\/DemoDuAn\/Sonicplan\/\d{6}_Soan_Bao_Cao_Tuan_v1$/);
  assert.match(l.drive_duong_dan, /^Sonicplan Claude\/Demo Dự Án\/\d{6}_Soan_Bao_Cao_Tuan_v1$/);
  assert.ok(l.bat_dau_luc && l.ket_thuc_luc);
  // Nhánh trên kho KB có ngữ cảnh, tệp đính kèm, kết quả; tệp ngoài phạm vi không lên.
  const nhanh = `sonicplan/luot-${l.id}`;
  const ds = git(kbNguon, 'ls-tree', '-r', '--name-only', nhanh).trim().split('\n');
  for (const can of ['NGU-CANH.md', 'LICH-SU.md', 'dinh-kem/so-lieu.csv', 'ket-qua/bao-cao.md', 'CAU-TRA-LOI.md']) assert.ok(ds.includes(`${l.thu_muc_lam}/${can}`), can);
  assert.ok(!ds.includes('ngoai-pham-vi.txt'));
  assert.match(git(kbNguon, 'show', `${nhanh}:${l.thu_muc_lam}/NGU-CANH.md`), /Anh làm giúp em báo cáo tuần/);
  // Hộp thư cho tác vụ chép Drive.
  const hop = join(goc, 'nha', 'drive-cho', `luot-${l.id}`);
  assert.equal(readFileSync(join(hop, 'dich.txt'), 'utf8'), l.drive_duong_dan);
  assert.ok(existsSync(join(hop, 'noi-dung', 'ket-qua', 'bao-cao.md')) && existsSync(join(hop, 'noi-dung', 'CAU-TRA-LOI.md')));
  // Claude chạy không có máy chủ MCP nào (không có công cụ gửi thư), lời nhắc cấm gửi.
  const doiSo = readFileSync(join(goc, 'doi-so.txt'), 'utf8');
  assert.match(doiSo, /--strict-mcp-config/);
  assert.ok(!/mcp__/.test(doiSo) && !/Gmail|gmail/.test(doiSo));
  // Thông báo đẩy cho PM, worktree đã dọn.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM thong_bao WHERE loai = 'claude'").get().n, 1);
  assert.ok(!existsSync(join(goc, 'nha', 'lam', `luot-${l.id}`)));
  // Việc đã có lượt thì vòng sau không chạy lại; hạn mức 0 thì không chạy việc mới.
  viec(db, 2, 'Việc hai', 'claude_tu_lam', '2026-10-21');
  await luuCauHinhTho(env, 'tc1', { toi_da_ngay: 1 });
  await tho.vongMotLan();
  await tho.doiXong();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM luot_claude WHERE viec_id = 2').get().n, 0);
  await luuCauHinhTho(env, 'tc1', { toi_da_ngay: 2 });
  await tho.vongMotLan();
  await tho.doiXong();
  assert.equal(db.prepare("SELECT trang_thai FROM luot_claude WHERE viec_id = 2").get().trang_thai, 'xong');
  await tho.dong();
});

test('thợ chạy lượt gộp nhiều việc: tin gốc và tệp của từng việc, tệp người dùng thêm, tệp bỏ chọn không lên kho', async () => {
  const { db, env } = moiTruong();
  const them = (id, hoi, nhom, nd) => db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai) VALUES (?1, 'tc1', 'zalo', ?2, 'An', ?3, ?4, '2026-10-14T01:00:00Z', '2026-10-14T01:00:00Z', ?5)`).run(id, `g${id}`, nhom, nd, hoi);
  them(1, 'nhom:A', 'Nhóm A', 'Làm giúp em báo cáo tuần');
  them(2, 'nhom:B', 'Nhóm B', 'Xem giúp em kịch bản Marcom');
  const tep = (id, tinId, ten, nguon, khoa) => db.prepare(`INSERT INTO tep (id, to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, r2_khoa, nguon, tao_luc) VALUES (?1, 'tc1', ?2, ?3, 'csv', 4, ?4, ?5, '2026-10-14')`).run(id, tinId, ten, khoa, nguon);
  tep(1, 1, 'so-lieu-a.csv', 'zalo', 'kA');
  tep(2, 2, 'kich-ban-b.csv', 'zalo', 'kB');
  tep(3, 2, 'bo-chon.csv', 'zalo', 'kX');
  tep(4, null, 'tu-them.csv', 'giao-claude', 'kT');
  env.TEP = { get: async (k) => ({ arrayBuffer: async () => new TextEncoder().encode(`noi-dung-${k}`).buffer }) };
  viec(db, 1, 'Soạn báo cáo tuần', 'claude_chuan_bi', '2026-10-20', 1);
  viec(db, 2, 'Xem kịch bản Marcom', 'claude_chuan_bi', '2026-10-21', 2);
  const id = await taoLuotMay(env, 'tc1', { id: 1 }, { viecPhu: [{ id: 2 }], tepTuy: { them: [4], bo: [3] } });
  const { goc, kbNguon, claude } = await dungChayThu();
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  await tho.vongMotLan();
  await tho.doiXong();
  const l = db.prepare('SELECT * FROM luot_claude WHERE id = ?').get(id);
  assert.equal(l.trang_thai, 'xong', l.ket_qua);
  const ds = git(kbNguon, 'ls-tree', '-r', '--name-only', `sonicplan/luot-${id}`).trim().split('\n');
  const dk = ds.filter((x) => x.includes('/dinh-kem/')).map((x) => x.split('/').pop()).sort();
  assert.deepEqual(dk, ['kich-ban-b.csv', 'so-lieu-a.csv', 'tu-them.csv']);
  const nguCanh = git(kbNguon, 'show', `sonicplan/luot-${id}:${l.thu_muc_lam}/NGU-CANH.md`);
  assert.match(nguCanh, /Làm giúp em báo cáo tuần/);
  assert.match(nguCanh, /Xem giúp em kịch bản Marcom/);
});

test('thợ: hai lượt bắt đầu cùng lúc, lần đầu chưa có bản sao KB, đều xong (không tranh nhau clone)', async () => {
  const { db, env } = moiTruong();
  env.TEP = { get: async () => null };
  viec(db, 1, 'Việc một', 'claude_tu_lam', '2026-10-20');
  viec(db, 2, 'Việc hai', 'claude_tu_lam', '2026-10-21');
  const { goc, kbNguon, claude } = await dungChayThu();
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  await tho.vongMotLan();
  await tho.doiXong();
  assert.deepEqual(db.prepare('SELECT trang_thai FROM luot_claude ORDER BY id').all().map((x) => x.trang_thai), ['xong', 'xong']);
  const ds = git(kbNguon, 'branch', '--list', 'sonicplan/*').trim().split('\n').map((x) => x.trim()).sort();
  assert.equal(ds.length, 2);
  await tho.dong();
});

test('thợ: Claude lỗi thì lượt báo lỗi kèm lý do, không treo hàng đợi', async () => {
  const { db, env } = moiTruong();
  env.TEP = { get: async () => null };
  viec(db, 1, 'Việc sẽ lỗi', 'claude_tu_lam', '2026-10-20');
  const { goc, kbNguon, claude } = await dungChayThu('loi');
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  await tho.vongMotLan();
  await tho.doiXong();
  const l = db.prepare('SELECT trang_thai, ket_qua FROM luot_claude WHERE viec_id = 1').get();
  assert.equal(l.trang_thai, 'loi');
  assert.match(l.ket_qua, /hết hạn mức/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM thong_bao WHERE loai = 'claude' AND tieu_de LIKE '%lỗi%'").get().n, 1);
  // Cầu dao: sau 2 lượt tự chạy lỗi thì ngừng xếp việc mới, khỏi đốt hạn mức và dội thông báo.
  await luuCauHinhTho(env, 'tc1', { song_song: 1 });
  viec(db, 2, 'Việc lỗi hai', 'claude_tu_lam', '2026-10-21');
  viec(db, 3, 'Việc ba', 'claude_tu_lam', '2026-10-22');
  await tho.vongMotLan();
  await tho.doiXong();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM luot_claude WHERE trang_thai = 'loi'").get().n, 2);
  await tho.vongMotLan();
  await tho.doiXong();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM luot_claude WHERE viec_id = 3').get().n, 0);
  await tho.dong();
});

test('không có đường nào trong mã để tự gửi thư: không gọi API gửi của Gmail, không SMTP', async () => {
  const { readdirSync } = await import('node:fs');
  const quet = (thuMuc) => readdirSync(thuMuc, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? quet(join(thuMuc, d.name)) : /\.m?js$/.test(d.name) ? [join(thuMuc, d.name)] : []));
  const cam = /messages\/send|drafts\/send|messages\.send|drafts\.send|users\.messages\.send|smtp|nodemailer|sendmail|\/gmail\/v1\/users\/me\/(messages|drafts)\/[^'"`]*send/i;
  const loi = [];
  for (const f of [...quet('src'), ...quet('may-chu')]) if (cam.test(readFileSync(f, 'utf8'))) loi.push(f);
  assert.deepEqual(loi, []);
});

test('máy khởi động lại giữa chừng: lượt đang làm xếp lại hàng đợi tối đa 2 lần, quá thì báo lỗi, không mất việc', async () => {
  const { db, env } = moiTruong();
  viec(db, 1, 'Việc bị ngắt', 'claude_tu_lam', '2026-10-20');
  viec(db, 2, 'Việc gộp phụ', 'claude_tu_lam', '2026-10-21');
  db.exec("INSERT INTO luot_claude (id, to_chuc_id, viec_id, trang_thai, ma_bam, tao_luc, cap_nhat_luc, noi_chay, bo_do) VALUES (1, 'tc1', 1, 'dang_lam', 'x', '2026-10-16', '2026-10-16', 'may', 0)");
  db.exec("INSERT INTO luot_claude (id, to_chuc_id, viec_id, lo_id, trang_thai, ma_bam, tao_luc, cap_nhat_luc, noi_chay) VALUES (2, 'tc1', 2, 1, 'dang_lam', '', '2026-10-16', '2026-10-16', 'may')");
  const mo = () => moThoClaude(env, { THO_DIR: join(mkdtempSync(join(tmpdir(), 'tho-')), 'nha'), CLAUDE_BIN: '/khong/co' });
  for (const lan of [1, 2]) {
    const tho = mo();
    await tho.bat(3600000);
    await tho.dong();
    assert.deepEqual(db.prepare('SELECT trang_thai, bo_do FROM luot_claude WHERE id = 1').get() && { ...db.prepare('SELECT trang_thai, bo_do FROM luot_claude WHERE id = 1').get() }, { trang_thai: 'cho', bo_do: lan });
    assert.equal(db.prepare('SELECT trang_thai FROM luot_claude WHERE id = 2').get().trang_thai, 'cho');
    db.exec("UPDATE luot_claude SET trang_thai = 'dang_lam' WHERE noi_chay = 'may'"); // giả lập lại: lượt được nhận rồi máy lại khởi động
  }
  const tho = mo();
  await tho.bat(3600000);
  await tho.dong();
  assert.equal(db.prepare('SELECT trang_thai FROM luot_claude WHERE id = 1').get().trang_thai, 'loi');
});

test('đồng bộ ghi nhớ sang KB: tạo memory/projects/Sonicplan_GhiNho.md, không tạo nhánh khi nội dung không đổi', async () => {
  const { db, env } = moiTruong();
  const them = db.prepare(`INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, ghim, tao_luc, cap_nhat_luc) VALUES ('tc1', ?1, ?2, ?3, ?4, '2026-10-01', '2026-10-01')`);
  them.run('nguoi', 'Bình', 'Trưởng phòng Hợp tác', 1);
  them.run('du_an', 'SonicRec', 'Ghi âm họp ra biên bản\nvòng 2 mở 24/10', 0);
  them.run('quyet_dinh', 'Dùng Sonnet', 'Mức medium, 10 việc mỗi ngày', 0);
  const { goc, kbNguon, claude } = await dungChayThu();
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  const kq = await tho.dongBoGhiNho();
  assert.deepEqual([kq.so_ghi_nho, kq.doi], [3, true]);
  const nhanh = git(kbNguon, 'branch', '--list', 'sonicplan/ghi-nho-*').trim().replace(/^\*?\s*/, '');
  const nd = git(kbNguon, 'show', `${nhanh}:memory/projects/Sonicplan_GhiNho.md`);
  for (const can of ['# Ghi nhớ từ Sonicplan', '## Người', '- **Bình** (ghim): Trưởng phòng Hợp tác', '## Dự án', 'Ghi âm họp ra biên bản vòng 2 mở 24/10', '## Quyết định']) assert.ok(nd.includes(can), can);
  assert.ok(!nd.includes('Sự thật'));
  // PR được gộp (giả lập: đưa nhánh vào main): lần sau nội dung giống thì không có gì mới.
  git(kbNguon, 'update-ref', 'refs/heads/main', `refs/heads/${nhanh}`);
  const lai = await tho.dongBoGhiNho();
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

test('rà soát tách việc hằng tuần: lấy mẫu cả tin có và không sinh việc, Claude chấm, báo cáo vào KB, báo PM', async () => {
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
  assert.equal(kq.so_mau, 11, JSON.stringify(kq));
  const nhanh = git(kbNguon, 'branch', '--list', 'sonicplan/ra-soat-*').trim().replace(/^\*?\s*/, '');
  const ds = git(kbNguon, 'ls-tree', '-r', '--name-only', nhanh).trim().split('\n').filter((x) => x.includes('DanhGia_TachViec'));
  for (const t of ['mau-tin.md', 'chi-so.md', 'BAO-CAO.md']) assert.ok(ds.some((x) => x.endsWith(`_RaSoatTuan/${t}`)), t);
  const bc = git(kbNguon, 'show', `${nhanh}:${ds.find((x) => x.endsWith('BAO-CAO.md'))}`);
  assert.match(bc, /Đúng việc 5\/6/);
  assert.match(git(kbNguon, 'show', `${nhanh}:${ds.find((x) => x.endsWith('chi-so.md'))}`), /Đúng việc/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM thong_bao WHERE loai = 'claude' AND tieu_de LIKE 'Báo cáo rà soát%'").get().n, 1);
  assert.equal(JSON.parse(db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa = 'ra_soat_tach_viec'").get().gia_tri).so_mau, 11);
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

test('thợ Claude: Claude ghi nhap-email.json thì hệ thống tạo nháp Gmail, ghi vào câu trả lời, không gửi', async () => {
  const { db, env } = moiTruong();
  env.TEP = { get: async () => null };
  await noiGoogle(env, true);
  db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, tieu_de, noi_dung, thoi_diem, tao_luc) VALUES (1, 'tc1', 'gmail', 'goc@khoa.vn', 'Khoa KHSK', 'Lịch họp', 'Nhờ anh xác nhận lịch họp thứ Sáu', '2026-10-15T01:00:00Z', '2026-10-15T01:00:00Z')`).run();
  viec(db, 1, 'Gửi thư cho Khoa khoa học sức khỏe', 'claude_chuan_bi', '2026-10-20', 1);
  const { goc, kbNguon, claude } = await dungChayThu('email');
  const ga = gaGiaGoogle(env);
  try {
    const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
    await tho.vongMotLan();
    await tho.doiXong();
    const l = db.prepare('SELECT trang_thai, ket_qua FROM luot_claude WHERE viec_id = 1').get();
    assert.equal(l.trang_thai, 'xong', l.ket_qua);
    assert.match(l.ket_qua, /Nháp Gmail:\n- nhap-email\.json: đã tạo bản nháp trong Gmail.*đúng luồng thư gốc.*Chưa gửi/s);
    assert.equal(ga.goi.filter((g) => g.method === 'POST').length, 1);
    assert.ok(!ga.goi.some((g) => /send/i.test(g.url)));
    await tho.dong();
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

test('đồng bộ ghi nhớ hai chiều với KB thật (kho git cục bộ): xuất, khớp, nhận điều KB sửa, giữ bản Sonicplan khi xung đột', async () => {
  const { db, env } = moiTruong();
  const them = db.prepare(`INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, ghim, tao_luc, cap_nhat_luc) VALUES ('tc1', ?1, ?2, ?3, ?4, '2026-10-01', '2026-10-01')`);
  them.run('nguoi', 'Bình', 'Trưởng phòng Hợp tác', 1);
  them.run('du_an', 'SonicRec', 'Ghi âm họp ra biên bản', 0);
  them.run('quyet_dinh', 'Dùng Sonnet', 'Mức medium', 0);
  const { goc, kbNguon, claude } = await dungChayThu();
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  const nhanhMoi = () => git(kbNguon, 'branch', '--list', 'sonicplan/ghi-nho-*').trim().split('\n').map((x) => x.trim().replace(/^\*\s*/, '')).filter(Boolean).pop();
  const gopVaoMain = (nhanh) => git(kbNguon, 'update-ref', 'refs/heads/main', `refs/heads/${nhanh}`);
  assert.equal((await tho.dongBoGhiNho()).doi, true);
  gopVaoMain(nhanhMoi());
  assert.equal((await tho.dongBoGhiNho()).doi, false); // đã khớp: lưu bản gốc
  assert.ok(db.prepare("SELECT gia_tri FROM cai_dat WHERE to_chuc_id = 'tc1' AND khoa = 'ghi_nho_kb_goc'").get());

  // PM sửa trực tiếp trong file ở KB: sửa Bình, sửa SonicRec, thêm mục mới; cùng lúc Sonicplan đã sửa SonicRec.
  const lam = join(goc, 'sua-kb');
  git(goc, 'clone', '-q', kbNguon, lam);
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
  assert.equal(kq.doi, true); // bản của KB lệch Sonicplan (SonicRec, và mục chặn) nên đẩy PR chỉnh lại
  await tho.dong();
});

test('dự án chưa ghép: khớp tên thì dùng thư mục có sẵn, dự án thật không khớp tạo 01_Projects/<Tên>, nhóm chung vào _INBOX', async () => {
  const { laDuAnChung } = await import('../src/kb.js');
  assert.deepEqual(['Khác', 'Cá nhân', 'Chưa xếp dự án', 'IPSOS', 'Hợp tác và Sự kiện'].map(laDuAnChung), [true, true, true, false, false]);
  const { db, env } = moiTruong();
  env.TEP = { get: async () => null };
  db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc) VALUES (2, 'tc1', 'DemoDuAn', '2026-01-01'), (3, 'tc1', 'IPSOS', '2026-01-01'), (4, 'tc1', 'Khác', '2026-01-01')");
  db.prepare("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nhom, du_an_id, tao_luc, cap_nhat_luc) VALUES (?1, 'tc1', ?2, 'mo', 'claude_tu_lam', ?3, '2026-10-01', '2026-10-01')");
  for (const [id, du] of [[1, 2], [2, 3], [3, 4]]) db.prepare("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nhom, du_an_id, han_ngay, tao_luc, cap_nhat_luc) VALUES (?1, 'tc1', ?2, 'mo', 'claude_tu_lam', ?3, ?4, '2026-10-01', '2026-10-01')").run(id, `Việc ${id}`, du, `2026-10-2${id}`);
  const { goc, kbNguon, claude } = await dungChayThu();
  await luuCauHinhTho(env, 'tc1', { song_song: 3 });
  const tho = moThoClaude(env, { THO_DIR: join(goc, 'nha'), KB_REMOTE: kbNguon, CLAUDE_BIN: claude, THO_KHONG_PR: '1' });
  await tho.vongMotLan();
  await tho.doiXong();
  const duAn = Object.fromEntries(db.prepare('SELECT ten, kb_thu_muc, kb_duyet FROM du_an WHERE id > 1').all().map((d) => [d.ten, { ...d }]));
  assert.deepEqual([duAn.DemoDuAn.kb_thu_muc, duAn.DemoDuAn.kb_duyet], ['01_Projects/DemoDuAn', 0]); // khớp thư mục có sẵn
  assert.deepEqual([duAn.IPSOS.kb_thu_muc, duAn.IPSOS.kb_duyet], ['01_Projects/IPSOS', 0]); // dự án thật chưa có thư mục: tạo mới
  assert.equal(duAn['Khác'].kb_thu_muc, null); // nhóm chung: không tự ghép
  const thuMuc = Object.fromEntries(db.prepare('SELECT viec_id, thu_muc_lam FROM luot_claude').all().map((l) => [l.viec_id, l.thu_muc_lam]));
  assert.match(thuMuc[1], /^01_Projects\/DemoDuAn\/Sonicplan\//);
  assert.match(thuMuc[2], /^01_Projects\/IPSOS\/Sonicplan\//);
  assert.match(thuMuc[3], /^_INBOX\/Sonicplan\/Khac\//);
  await tho.dong();
});

test('lời nhắc tách việc có ba quy tắc rà soát đã duyệt 16/10/2026', async () => {
  const { loiNhacTachViec } = await import('../src/ai.js');
  const [he] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'x', thoi_diem: 't' }], '2026-10-16', 'Hải', [], [], [], [], []).map((m) => m.content ?? m);
  for (const can of ['13) CHỈ TÁCH VIỆC khi tin đặt việc lên người dùng', 'rủ ăn uống', 'chị mua nước cho cô giáo', '14) BẮT BUỘC có ít nhất một việc khi tin gọi đích danh', 'nom = 3'.replace('nom', 'nhom'), 'tối thiểu 4 từ', 'CÓ DẤU', 'KHÔNG sao chép nguyên lỗi', 'KHÔNG tạo việc đó']) assert.ok(he.includes(can), can);
});
