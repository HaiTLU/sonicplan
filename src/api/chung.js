// Phần dùng chung của các nhóm API: kiểm vai trò và hằng số.

// Chủ tổ chức: duy nhất một chỗ quyết định ai được làm việc quản trị của tổ chức.
export const laChu = (phien) => phien.to_chuc.vai_tro === 'chu';

// Người quản trị hệ thống (cài bot chung...): danh sách email trong biến QUAN_TRI, cách nhau dấu phẩy.
export function laQuanTri(env, phien) {
  return String(env.QUAN_TRI || '').toLowerCase().split(',').map((x) => x.trim()).includes(phien.email);
}

// Mã tệp trên Drive: ưu tiên bản đã xếp trong kho, không có thì bản ở thư mục Sonicplan.
export const COT_DRIVE = "COALESCE((SELECT NULLIF(k.drive_id, '') FROM kho_da_luu k WHERE k.to_chuc_id = tep.to_chuc_id AND k.loai = 'tep' AND k.ma = CAST(tep.id AS TEXT)), NULLIF(tep.drive_id, '')) AS drive_id";
