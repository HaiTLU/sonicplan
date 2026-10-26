// CPM (đường gang, Critical Path Method) cho phân hệ Viện Hòa Lạc: hàm thuần, không đọc/ghi CSDL,
// để kiểm bằng test không cần D1. Đơn vị: ngày dương lịch. Ngày dự án bắt đầu từ moc0 (số nguyên,
// 0 = ngày khởi công); gọi nơi khác đổi ngày thật <-> số thứ tự ngày (ngayVN/congNgay).
//
// Bốn kiểu phụ thuộc (PMBOK): FS trước xong rồi sau mới bắt đầu, SS cùng bắt đầu,
// FF cùng xong, SF trước xong thì sau mới được xong. doTreNgay có thể âm (được phép chồng lấn).

export class CpmLoi extends Error {}

// hangMuc: [{id, thoiGianNgay}], phuThuoc: [{truoc_id, sau_id, loai, do_tre_ngay}]
export function tinhCpm(hangMuc, phuThuoc) {
  const theo = new Map(hangMuc.map((h) => [h.id, { ...h }]));
  const ke = new Map([...theo.keys()].map((id) => [id, []])); // id -> [{sau, loai, treNgay}]
  const nguoc = new Map([...theo.keys()].map((id) => [id, []])); // id -> [{truoc, loai, treNgay}]
  for (const p of phuThuoc) {
    if (!theo.has(p.truoc_id) || !theo.has(p.sau_id)) continue;
    ke.get(p.truoc_id).push({ id: p.sau_id, loai: p.loai || 'FS', tre: p.do_tre_ngay || 0 });
    nguoc.get(p.sau_id).push({ id: p.truoc_id, loai: p.loai || 'FS', tre: p.do_tre_ngay || 0 });
  }

  const thuTu = thuTuTopo(theo, ke);
  if (!thuTu) throw new CpmLoi('Các hạng mục đang phụ thuộc vòng tròn nhau, không tính được đường gang.');

  // Forward pass: ngày sớm nhất bắt đầu/xong, theo đúng thứ tự topo.
  for (const id of thuTu) {
    const m = theo.get(id);
    let somBd = 0;
    for (const { id: tid, loai, tre } of nguoc.get(id)) {
      const t = theo.get(tid);
      if (loai === 'FS') somBd = Math.max(somBd, t.somKt + tre);
      else if (loai === 'SS') somBd = Math.max(somBd, t.somBd + tre);
      else if (loai === 'FF') somBd = Math.max(somBd, t.somKt + tre - m.thoiGianNgay);
      else if (loai === 'SF') somBd = Math.max(somBd, t.somBd + tre - m.thoiGianNgay);
    }
    m.somBd = somBd;
    m.somKt = somBd + m.thoiGianNgay;
  }

  const ketThucDuAn = Math.max(0, ...[...theo.values()].map((m) => m.somKt));

  // Backward pass: ngày muộn nhất được phép, ngược thứ tự topo.
  for (const id of [...thuTu].reverse()) {
    const m = theo.get(id);
    let muonKt = ketThucDuAn;
    const sauDs = ke.get(id);
    if (sauDs.length) {
      muonKt = Math.min(...sauDs.map(({ id: sid, loai, tre }) => {
        const s = theo.get(sid);
        if (loai === 'FS') return s.muonBd - tre;
        if (loai === 'SS') return s.muonBd - tre + m.thoiGianNgay;
        if (loai === 'FF') return s.muonKt - tre;
        return s.muonKt - tre + m.thoiGianNgay; // SF
      }));
    }
    m.muonKt = muonKt;
    m.muonBd = muonKt - m.thoiGianNgay;
  }

  const ra = [];
  for (const id of theo.keys()) {
    const m = theo.get(id);
    const duTruoc = m.muonBd - m.somBd;
    ra.push({
      id, som_bd: m.somBd, som_kt: m.somKt, muon_bd: m.muonBd, muon_kt: m.muonKt,
      du_truoc_ngay: duTruoc, tren_duong_gang: duTruoc === 0 ? 1 : 0,
    });
  }
  return { hang_muc: ra, ket_thuc_du_an: ketThucDuAn };
}

// Kahn: trả null nếu có vòng tròn (thay vì treo vòng lặp).
function thuTuTopo(theo, ke) {
  const bacVao = new Map([...theo.keys()].map((id) => [id, 0]));
  for (const ds of ke.values()) for (const { id } of ds) bacVao.set(id, bacVao.get(id) + 1);
  const hang = [...theo.keys()].filter((id) => bacVao.get(id) === 0);
  const ra = [];
  while (hang.length) {
    const id = hang.shift();
    ra.push(id);
    for (const { id: sid } of ke.get(id)) {
      bacVao.set(sid, bacVao.get(sid) - 1);
      if (bacVao.get(sid) === 0) hang.push(sid);
    }
  }
  return ra.length === theo.size ? ra : null;
}

// Tính lại CPM từ CSDL và ghi đè các cột đệm của to_chuc_id này (gọi sau mỗi lần sửa hạng mục/phụ thuộc).
export async function capNhatCpm(env, toChucId, bayGio = new Date().toISOString()) {
  const [dsHangMuc, dsPhuThuoc] = await env.CSDL.batch([
    env.CSDL.prepare('SELECT id, thoi_gian_ngay FROM qlda_hang_muc WHERE to_chuc_id = ?1').bind(toChucId),
    env.CSDL.prepare('SELECT truoc_id, sau_id, loai, do_tre_ngay FROM qlda_phu_thuoc WHERE to_chuc_id = ?1').bind(toChucId),
  ]);
  const hangMuc = dsHangMuc.results.map((r) => ({ id: r.id, thoiGianNgay: r.thoi_gian_ngay }));
  if (!hangMuc.length) return { ket_thuc_du_an: 0 };
  const { hang_muc: ketQua, ket_thuc_du_an } = tinhCpm(hangMuc, dsPhuThuoc.results);
  await env.CSDL.batch(ketQua.map((k) => env.CSDL.prepare(
    `UPDATE qlda_hang_muc SET som_bd=?1, som_kt=?2, muon_bd=?3, muon_kt=?4, du_truoc_ngay=?5, tren_duong_gang=?6, cap_nhat_luc=?7 WHERE id=?8 AND to_chuc_id=?9`,
  ).bind(k.som_bd, k.som_kt, k.muon_bd, k.muon_kt, k.du_truoc_ngay, k.tren_duong_gang, bayGio, k.id, toChucId)));
  return { ket_thuc_du_an };
}
