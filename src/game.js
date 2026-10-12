// Chế độ game: mỗi việc là một quái vật, độ nặng quyết định loại quái và máu, việc con là đòn đánh.
// Xong trước hạn thì hạ quái sớm, thêm điểm kinh nghiệm. Mỗi ngày là một màn. Tính hoàn toàn từ bảng viec,
// không lưu điểm riêng, nên sửa hay mở lại việc thì điểm tự đúng lại.

import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { phutCua, phutThuc } from './hieu-suat.js';
import { baoToChuc } from './telegram.js';
import { congNgay, json, loi, ngayVN } from './tien-ich.js';

export const LOAI_QUAI = { nhe: 'slime', vua: 'goblin', nang: 'golem', rat_nang: 'rong' };
export const TEN_QUAI = { slime: 'Slime', goblin: 'Yêu tinh', golem: 'Người đá', rong: 'Rồng lửa' };
const XP_GOC = { nhe: 10, vua: 25, nang: 60, rat_nang: 150 };
const ngayCua = (iso) => (iso ? ngayVN(new Date(iso)) : null);

// Cấp n cần tổng 50 x n x (n + 1) điểm: cấp 2 ở 100, cấp 3 ở 300, cấp 4 ở 600...
export const xpChoCap = (n) => 50 * n * (n + 1);
export function capTuXp(xp) {
  let n = 0;
  while (xpChoCap(n + 1) <= xp) n++;
  return { cap: n + 1, tu: xpChoCap(n), den: xpChoCap(n + 1) };
}

// Điểm khi hạ một quái: theo độ nặng, nhân hệ số hạn (sớm x1,5, đúng ngày x1,2, trễ x0,6), đánh nhanh hơn ước thêm 20%.
export function xpHaQuai(v) {
  const goc = XP_GOC[v.do_nang] || 20;
  const han = v.han_goc || v.han_ngay;
  const ngay = ngayCua(v.xong_luc);
  let heSo = 1;
  let kieu = 'thuong';
  if (han && ngay) {
    if (ngay < han) { heSo = 1.5; kieu = 'som'; } else if (ngay === han) { heSo = 1.2; kieu = 'dung_han'; } else { heSo = 0.6; kieu = 'tre'; }
  }
  const thuc = phutThuc(v);
  const nhanh = thuc != null && v.phut_uoc && thuc < v.phut_uoc;
  return { xp: Math.round(goc * heSo * (nhanh ? 1.2 : 1)), kieu, nhanh };
}

const THANH_TICH = [
  ['ha-dau', 'Đòn đầu tiên', 'Hạ con quái đầu tiên', (d) => d.soHa >= 1],
  ['tho-san-10', 'Thợ săn', 'Hạ 10 quái', (d) => d.soHa >= 10],
  ['tho-san-50', 'Thợ săn lão luyện', 'Hạ 50 quái', (d) => d.soHa >= 50],
  ['tram-quai', 'Trăm trận trăm thắng', 'Hạ 100 quái', (d) => d.soHa >= 100],
  ['diet-rong', 'Diệt rồng', 'Hạ một con Rồng lửa (việc rất nặng)', (d) => d.soRong >= 1],
  ['than-toc', 'Thần tốc', 'Hạ sớm 5 quái trước hạn', (d) => d.soSom >= 5],
  ['mot-ngay-10', 'Càn quét', 'Hạ 10 quái trong một ngày', (d) => d.nhieuNhatNgay >= 10],
  ['chuoi-3', 'Bền bỉ', 'Chuỗi 3 ngày liên tiếp có hạ quái', (d) => d.chuoiDaiNhat >= 3],
  ['chuoi-7', 'Không nghỉ', 'Chuỗi 7 ngày liên tiếp', (d) => d.chuoiDaiNhat >= 7],
  ['qua-man-5', 'Phá đảo', 'Qua 5 màn (xong hết việc có hạn trong ngày)', (d) => d.soManQua >= 5],
  ['bam-gio', 'Đo từng đòn', 'Bấm Bắt đầu rồi hạ quái nhanh hơn ước tính 3 lần', (d) => d.soNhanh >= 3],
  ['cap-5', 'Hiệp sĩ', 'Lên cấp 5', (d) => d.cap >= 5],
  ['cap-10', 'Huyền thoại', 'Lên cấp 10', (d) => d.cap >= 10],
];

// Máu quái: thời lượng ước tính (phút). Đã chia nhỏ thì máu là tổng việc con, mỗi việc con xong là một đòn.
// Đang đánh (đã bấm Bắt đầu) thì máu giảm theo thời gian đã làm, giữ lại ít nhất 10%.
export function quaiTuViec(v, conTheoCha, homNay, bayGio) {
  const loai = LOAI_QUAI[v.do_nang] || 'goblin';
  const con = conTheoCha.get(v.id);
  let mauToiDa = phutCua(v);
  let mau = mauToiDa;
  if (con) {
    mauToiDa = Math.max(1, con.phut_tong);
    mau = con.phut_con_lai;
  } else if (v.bat_dau_luc) {
    const daLam = (Date.parse(bayGio) - Date.parse(v.bat_dau_luc)) / 60000;
    mau = Math.max(Math.round(mauToiDa * 0.1), Math.round(mauToiDa - Math.max(0, daLam)));
  }
  const han = v.han_ngay;
  return {
    id: v.id, tieu_de: v.tieu_de, loai, ten_loai: TEN_QUAI[loai], do_nang: v.do_nang, han_ngay: han, gio_hen: v.gio_hen,
    mau, mau_toi_da: mauToiDa, dang_danh: Boolean(v.bat_dau_luc), gian: Boolean(v.han_goc && v.han_goc < homNay),
    con: con ? { tong: con.tong, xong: con.xong, don: con.don.sort((a, b) => a.id - b.id) } : null, xp_neu_ha: xpHaQuai({ ...v, xong_luc: bayGio }).xp,
  };
}

export function tinhGame(viec, homNay, bayGio = new Date().toISOString()) {
  const xong = viec.filter((v) => v.trang_thai === 'xong' && v.xong_luc).sort((a, b) => a.xong_luc.localeCompare(b.xong_luc));
  const mo = viec.filter((v) => v.trang_thai === 'mo');
  const conTheoCha = new Map();
  for (const v of viec) if (v.viec_cha_id && v.trang_thai !== 'huy') {
    const o = conTheoCha.get(v.viec_cha_id) || { tong: 0, xong: 0, phut_tong: 0, phut_con_lai: 0, don: [] };
    o.tong++;
    o.don.push({ id: v.id, tieu_de: v.tieu_de, phut: phutCua(v), xong: v.trang_thai === 'xong' });
    o.phut_tong += phutCua(v);
    if (v.trang_thai === 'xong') o.xong++; else o.phut_con_lai += phutCua(v);
    conTheoCha.set(v.viec_cha_id, o);
  }

  // Điểm, số quái theo ngày, nhật ký trận gần đây. Việc cha đã chia nhỏ: điểm nằm ở các việc con.
  let xp = 0;
  let soSom = 0;
  let soNhanh = 0;
  let soRong = 0;
  const theoNgay = new Map();
  const nhatKy = [];
  for (const v of xong) {
    if (conTheoCha.has(v.id)) continue;
    const kq = xpHaQuai(v);
    xp += kq.xp;
    if (kq.kieu === 'som') soSom++;
    if (kq.nhanh) soNhanh++;
    if (v.do_nang === 'rat_nang') soRong++;
    const n = ngayCua(v.xong_luc);
    theoNgay.set(n, (theoNgay.get(n) || 0) + 1);
    nhatKy.push({ id: v.id, tieu_de: v.tieu_de, loai: LOAI_QUAI[v.do_nang] || 'goblin', xp: kq.xp, kieu: kq.kieu, luc: v.xong_luc });
  }

  // Chuỗi ngày liên tiếp có hạ quái (hôm nay chưa hạ thì tính tới hôm qua).
  let chuoi = 0;
  for (let d = theoNgay.has(homNay) ? homNay : congNgay(homNay, -1); theoNgay.has(d); d = congNgay(d, -1)) chuoi++;
  let chuoiDaiNhat = 0;
  for (const n of theoNgay.keys()) {
    if (theoNgay.has(congNgay(n, -1))) continue;
    let dai = 0;
    for (let d = n; theoNgay.has(d); d = congNgay(d, 1)) dai++;
    chuoiDaiNhat = Math.max(chuoiDaiNhat, dai);
  }

  // Màn đã qua: ngày có ít nhất một việc hạn đầu tiên đúng ngày đó và mọi việc như vậy xong không trễ.
  const hanTheoNgay = new Map();
  for (const v of viec) if (v.han_goc && v.han_goc < homNay && v.trang_thai !== 'huy') {
    const ok = v.trang_thai === 'xong' && ngayCua(v.xong_luc) <= v.han_goc;
    hanTheoNgay.set(v.han_goc, (hanTheoNgay.get(v.han_goc) ?? true) && ok);
  }
  const soManQua = [...hanTheoNgay.values()].filter(Boolean).length;

  // Màn hôm nay: quái là việc mở có hạn đến hôm nay (kể cả quá hạn). Việc cha đã chia thì vẫn là một quái, việc con là đòn.
  const laCon = (v) => v.viec_cha_id && viec.some((c) => c.id === v.viec_cha_id && c.trang_thai === 'mo');
  const trongMan = mo.filter((v) => v.han_ngay && v.han_ngay <= homNay && !laCon(v));
  const langThang = mo.filter((v) => !(v.han_ngay && v.han_ngay <= homNay) && !laCon(v));
  const haHomNay = nhatKy.filter((k) => ngayCua(k.luc) === homNay);
  const muc = capTuXp(xp);
  const du = { soHa: nhatKy.length, soSom, soNhanh, soRong, nhieuNhatNgay: Math.max(0, ...theoNgay.values()), chuoiDaiNhat, soManQua, cap: muc.cap };
  return {
    hom_nay: homNay,
    nhan_vat: { cap: muc.cap, xp, xp_tu: muc.tu, xp_den: muc.den, chuoi, chuoi_dai_nhat: chuoiDaiNhat, so_ha: nhatKy.length, so_ha_som: soSom, so_man_qua: soManQua },
    man: {
      ngay: homNay,
      quai: trongMan.map((v) => quaiTuViec(v, conTheoCha, homNay, bayGio)).sort((a, b) => b.mau_toi_da - a.mau_toi_da),
      lang_thang: langThang.map((v) => quaiTuViec(v, conTheoCha, homNay, bayGio)).sort((a, b) => (a.han_ngay || '9').localeCompare(b.han_ngay || '9')).slice(0, 12),
      da_ha: haHomNay.length,
      qua_man: trongMan.length === 0 && haHomNay.length > 0,
    },
    thanh_tich: THANH_TICH.map(([ma, ten, moTa, dat]) => ({ ma, ten, mo_ta: moTa, dat: dat(du) })),
    nhat_ky: nhatKy.slice(-8).reverse(),
  };
}

async function docCaiDatGame(env, tc) {
  return { bat: (await docCaiDat(env, tc, 'game_bat')) === '1', telegram: (await docCaiDat(env, tc, 'game_telegram')) === '1' };
}

async function layGame(env, tc) {
  const { results } = await env.CSDL.prepare(
    `SELECT id, tieu_de, trang_thai, tao_luc, xong_luc, han_ngay, han_goc, gio_hen, do_nang, phut_uoc, bat_dau_luc, viec_cha_id
     FROM viec WHERE to_chuc_id = ?1 AND trang_thai IN ('mo', 'xong')`,
  ).bind(tc).all();
  return { ...(await docCaiDatGame(env, tc)), ...tinhGame(results, ngayVN()) };
}

export async function xuLyGame(yeuCau, env, tc, p) {
  const m = yeuCau.method;
  if (p === '/api/game' && m === 'GET') return json(await layGame(env, tc));
  if (p === '/api/game/cai-dat' && m === 'PUT') {
    const than = await yeuCau.json().catch(() => ({}));
    if ('bat' in than) await ghiCaiDat(env, tc, 'game_bat', than.bat ? '1' : '0');
    if ('telegram' in than) await ghiCaiDat(env, tc, 'game_telegram', than.telegram ? '1' : '0');
    return json(await docCaiDatGame(env, tc));
  }
  // Sau khi hạ quái trên màn game: chỉ nhắn Telegram khi người dùng đã bật. Nội dung do máy chủ soạn.
  if (p === '/api/game/bao' && m === 'POST') {
    const cd = await docCaiDatGame(env, tc);
    if (!cd.bat || !cd.telegram) return json({ gui: false });
    const id = Number((await yeuCau.json().catch(() => ({}))).viec_id);
    const g = await layGame(env, tc);
    const tran = g.nhat_ky.find((k) => k.id === id);
    if (!tran) return json({ gui: false });
    const nd = `Hạ ${TEN_QUAI[tran.loai]}: ${tran.tieu_de}. +${tran.xp} điểm${tran.kieu === 'som' ? ' (hạ sớm)' : ''}. Cấp ${g.nhan_vat.cap}, chuỗi ${g.nhan_vat.chuoi} ngày.${g.man.qua_man ? ' Đã qua màn hôm nay.' : ''}`;
    return json({ gui: await baoToChuc(env, tc, nd).catch(() => false) });
  }
  return loi(404, 'Không có chức năng này.');
}
