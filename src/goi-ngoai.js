// Gọi dịch vụ ngoài, thử lại khi lỗi tạm thời (hết giờ, 429, 5xx): tối đa 3 lần,
// chờ 1, 2, 4 giây. Lỗi do dữ liệu sai (4xx khác) trả về ngay, không thử lại.

const CHO_MS = [1000, 2000, 4000];

export function loiTamThoi(trangThai) {
  return trangThai === 429 || trangThai >= 500;
}

export async function goiNgoai(url, tuyChon = {}, { fetchFn = fetch, ngu = nguMacDinh, hetGioMs = 10000 } = {}) {
  let loiCuoi;
  for (let lan = 0; lan <= CHO_MS.length; lan++) {
    try {
      const phanHoi = await fetchFn(url, { ...tuyChon, signal: AbortSignal.timeout(hetGioMs) });
      if (!loiTamThoi(phanHoi.status)) return phanHoi;
      loiCuoi = new Error(`Dịch vụ trả ${phanHoi.status}`);
    } catch (loi) {
      loiCuoi = loi;
    }
    if (lan < CHO_MS.length) await ngu(CHO_MS[lan]);
  }
  throw loiCuoi;
}

function nguMacDinh(ms) {
  return new Promise((xong) => setTimeout(xong, ms));
}
