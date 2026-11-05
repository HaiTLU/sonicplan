import { chuanHoa } from './tien-ich.js';

// Không suy rộng bài học sang cuộc trò chuyện khác chỉ vì nội dung giống nhau.
function cungBoiCanh(a, b) {
  if (!a.nguon || a.nguon !== b.nguon) return false;
  if (a.ma_hoi_thoai && b.ma_hoi_thoai) return a.ma_hoi_thoai === b.ma_hoi_thoai;
  const nhomA = chuanHoa(a.nhom || ''), nhomB = chuanHoa(b.nhom || '');
  if (nhomA || nhomB) return Boolean(nhomA && nhomA === nhomB);
  const guiA = chuanHoa(a.nguoi_gui || ''), guiB = chuanHoa(b.nguoi_gui || '');
  return Boolean(guiA && guiA === guiB);
}

const tu = (s) => new Set(chuanHoa(s || '').split(/\s+/).filter((x) => x.length > 2));

// Đầu vào đã xếp mới nhất trước; điểm bằng nhau thì giữ thứ tự đó.
export function chonBaiHoc(ds, tin, toiDa = 10) {
  return ds.map((b, i) => {
    const lienQuan = tin.filter((t) => cungBoiCanh(b, t));
    if (!lienQuan.length) return { b, i, diem: -1 };
    const cu = tu(b.tin);
    const diem = Math.max(...lienQuan.map((t) => {
      const moi = tu(t.noi_dung);
      const chung = [...cu].filter((x) => moi.has(x)).length;
      return chung / Math.max(1, new Set([...cu, ...moi]).size);
    }));
    return { b, i, diem };
  }).filter((x) => x.diem >= 0)
    .sort((a, b) => b.diem - a.diem || a.i - b.i)
    .slice(0, toiDa).map((x) => x.b);
}
