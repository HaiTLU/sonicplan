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
  for (const can of ['01_Projects/DemoDuAn/Sonicplan/261015_Gui_Bang_Gia_v10/NGU-CANH.md', 'LICH-SU.md', 'nhap-email.json', 'Giả định đã chọn', DAU_CAU_HOI, 'Claude chuẩn bị', 'Làm gọn', 'Bản cũ', 'Không dùng git']) assert.ok(nhac.includes(can), can);
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
THU=$(echo "$LN" | grep -m1 '^Dự án:' | sed 's/.*Thư mục làm việc: //; s#/$##')
mkdir -p "$THU/ket-qua"
${cheDo === 'loi' ? 'echo "{\\"type\\":\\"result\\",\\"is_error\\":true,\\"result\\":\\"hết hạn mức\\"}"; exit 1' : `echo "Báo cáo thử" > "$THU/ket-qua/bao-cao.md"
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
