// Quyền trong phân hệ Viện Hòa Lạc: chủ và thành viên thấy và sửa hết; đối tác (doi_tac) chỉ GET
// đúng hạng mục/thủ tục được gán ở qlda_giao_doi_tac, không thấy phần còn lại (404, không 403, để
// không lộ hạng mục có tồn tại hay không).

export const laDoiTac = (phien) => phien.to_chuc.vai_tro === 'doi_tac';

// Trả danh sách id hạng mục đối tác được xem (bao gồm hạng mục cha nếu con được gán, để còn hiển thị cây).
export async function idHangMucDuocXem(env, phien) {
  const { results } = await env.CSDL.prepare(
    `SELECT doi_tuong_id FROM qlda_giao_doi_tac WHERE to_chuc_id = ?1 AND nguoi_dung_id = ?2 AND loai = 'hang_muc'`,
  ).bind(phien.to_chuc.id, phien.nguoi_dung.id).all();
  return new Set(results.map((r) => r.doi_tuong_id));
}

// true nếu đối tác được xem hạng mục này; chủ/thành viên luôn true.
export async function duocXemHangMuc(env, phien, hangMucId) {
  if (!laDoiTac(phien)) return true;
  const ds = await idHangMucDuocXem(env, phien);
  return ds.has(hangMucId);
}

// Trả danh sách id thủ tục pháp lý đối tác được xem.
export async function idThuTucDuocXem(env, phien) {
  const { results } = await env.CSDL.prepare(
    `SELECT doi_tuong_id FROM qlda_giao_doi_tac WHERE to_chuc_id = ?1 AND nguoi_dung_id = ?2 AND loai = 'thu_tuc'`,
  ).bind(phien.to_chuc.id, phien.nguoi_dung.id).all();
  return new Set(results.map((r) => r.doi_tuong_id));
}

// true nếu đối tác được xem thủ tục này; chủ/thành viên luôn true.
export async function duocXemThuTuc(env, phien, thuTucId) {
  if (!laDoiTac(phien)) return true;
  const ds = await idThuTucDuocXem(env, phien);
  return ds.has(thuTucId);
}
