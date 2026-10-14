// Cài đặt của từng khâu trong luồng làm việc: bật tắt và các ngưỡng chỉnh được ở trang Luồng.
// Lưu ở cai_dat theo tổ chức: luong_bat_<mã tác vụ> ('0' là tắt), luong_<tên ngưỡng> (số).

export const KHAU_BAT_TAT = ['tach-viec', 'goi-y', 'nhac-viec', 'bao-viec-moi', 'ban-tin', 'bao-cao-tuan', 'canh-zalo', 'canh-viec', 'don-cuoi-ngay', 'sao-luu', 'dong-bo-google', 'giao-github', 'luu-kho', 'quet-hop'];

export const NGUONG = {
  zalo_im_gio: { mac_dinh: 6, min: 1, max: 48 },
  mat_viec: { mac_dinh: 10, min: 2, max: 100 },
  mat_viec_mo: { mac_dinh: 5, min: 1, max: 100 },
  goi_y_toi_da: { mac_dinh: 5, min: 1, max: 20 },
  nhac_truoc_phut: { mac_dinh: 30, min: 5, max: 180 },
  yen_tu: { mac_dinh: 22, min: 18, max: 23 },
  yen_den: { mac_dinh: 8, min: 5, max: 11 },
  gio_ban_tin: { mac_dinh: 8, min: 5, max: 11 },
  gio_nhac_chieu: { mac_dinh: 17, min: 12, max: 21 },
};

export function macDinhLuong() {
  return {
    bat: Object.fromEntries(KHAU_BAT_TAT.map((ma) => [ma, true])),
    nguong: Object.fromEntries(Object.entries(NGUONG).map(([k, v]) => [k, v.mac_dinh])),
  };
}

export async function docLuong(env, toChucId) {
  const kq = { ...macDinhLuong(), bo_cuc: null };
  const { results } = await env.CSDL.prepare(`SELECT khoa, gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa LIKE 'luong\\_%' ESCAPE '\\'`).bind(toChucId).all();
  for (const { khoa, gia_tri: gt } of results) {
    const ten = khoa.slice('luong_'.length);
    if (ten === 'bo_cuc') {
      try { kq.bo_cuc = kiemBoCuc(JSON.parse(gt)) ? JSON.parse(gt) : null; } catch { /* bỏ bố cục hỏng */ }
    } else if (ten.startsWith('bat_')) {
      const ma = ten.slice(4);
      if (ma in kq.bat) kq.bat[ma] = gt !== '0';
    } else if (ten in NGUONG) {
      const so = Number(gt);
      if (Number.isFinite(so)) kq.nguong[ten] = Math.min(Math.max(Math.round(so), NGUONG[ten].min), NGUONG[ten].max);
    }
  }
  return kq;
}

// Giờ yên lặng: từ yen_tu (tối) đến yen_den (sáng hôm sau).
export function dangYenLang(gioVN, nguong) {
  return gioVN >= nguong.yen_tu || gioVN < nguong.yen_den;
}

// Kiểm tra rồi ghi. Trả về lỗi tiếng Việt hoặc null.
export async function luuLuong(env, toChucId, thanDu) {
  const ghi = [];
  for (const [ma, gt] of Object.entries(thanDu?.bat || {})) {
    if (!KHAU_BAT_TAT.includes(ma) || typeof gt !== 'boolean') return `Không có khâu "${ma}" hoặc giá trị không đúng.`;
    ghi.push([`luong_bat_${ma}`, gt ? '1' : '0']);
  }
  for (const [k, gt] of Object.entries(thanDu?.nguong || {})) {
    const d = NGUONG[k];
    const so = Number(gt);
    if (!d || !Number.isInteger(so) || so < d.min || so > d.max) return `Giá trị "${k}" phải là số nguyên từ ${d ? `${d.min} đến ${d.max}` : '...'}.`;
    ghi.push([`luong_${k}`, String(so)]);
  }
  if (thanDu && 'bo_cuc' in thanDu) {
    if (thanDu.bo_cuc !== null && !kiemBoCuc(thanDu.bo_cuc)) return 'Bố cục sơ đồ không hợp lệ.';
    ghi.push(['luong_bo_cuc', thanDu.bo_cuc === null ? 'null' : JSON.stringify(thanDu.bo_cuc)]);
  }
  if (!ghi.length) return 'Không có gì để lưu.';
  await env.CSDL.batch(ghi.map(([khoa, gt]) =>
    env.CSDL.prepare(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES (?1, ?2, ?3) ON CONFLICT (to_chuc_id, khoa) DO UPDATE SET gia_tri = excluded.gia_tri`).bind(toChucId, khoa, gt)));
  return null;
}

// Bố cục sơ đồ trang Luồng: vị trí nút anh kéo và các nhóm đang thu gọn, riêng cho màn rộng (ngang) và hẹp (doc).
// { ngang: { vi_tri: { id: [x, y] }, thu_gon: [nhom] }, doc: {...} }
const MA_HOP_LE = /^[a-z0-9-]{1,40}$/;
export function kiemBoCuc(bc) {
  if (!bc || typeof bc !== 'object' || Array.isArray(bc)) return false;
  for (const [huong, phan] of Object.entries(bc)) {
    if (huong !== 'ngang' && huong !== 'doc') return false;
    if (!phan || typeof phan !== 'object') return false;
    const vt = phan.vi_tri || {};
    if (typeof vt !== 'object' || Array.isArray(vt) || Object.keys(vt).length > 80) return false;
    for (const [id, xy] of Object.entries(vt)) {
      if (!MA_HOP_LE.test(id) || !Array.isArray(xy) || xy.length !== 2) return false;
      if (!xy.every((so) => Number.isFinite(so) && Math.abs(so) <= 20000)) return false;
    }
    const tg = phan.thu_gon || [];
    if (!Array.isArray(tg) || tg.length > 20 || !tg.every((m) => typeof m === 'string' && MA_HOP_LE.test(m))) return false;
  }
  return JSON.stringify(bc).length <= 8000;
}
