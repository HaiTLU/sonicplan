// Xóa toàn bộ tổ chức (quyền được xóa, Luật 91/2025/QH15; tham chiếu GDPR điều 17).
// Thứ tự an toàn: (1) sao lưu đủ dữ liệu vào kho R2 và đọc lại xác nhận có bản sao;
// (2) xóa mọi dòng của tổ chức trong D1; (3) tệp trong R2 và bản sao giữ thêm GIU_NGAY ngày
// để khôi phục khi bấm nhầm, sau đó lượt "sao-luu" hằng ngày tự xóa hẳn (donTepDaXoa).
import { xuatDuLieu } from './du-lieu.js';

export const GIU_NGAY = 30;

// Các bảng có cột to_chuc_id. Thêm bảng mới có cột này thì thêm vào đây (test/xoa-to-chuc.test.js kiểm đủ).
export const BANG_CUA_TO_CHUC = [
  'dashboard_de_xuat', 'viec_su_kien', 'luot_claude', 'prompt_claude', 'nguon_chan', 'nhat_ky_truy_cap', 'kho_da_luu', 'ghi_nho', 'cau_hoi_ai', 'tep', 'viec', 'du_an',
  'tin_nhan', 'cai_dat', 'lenh_cho', 'khoa_truy_cap', 'ket_noi', 'tin_hieu', 'nhat_ky_chay', 'thanh_vien', 'thong_bao', 'dang_ky_day', 'anh_dai_dien', 'zalo_gui',
];

// tenXacNhan: người dùng phải gõ đúng tên tổ chức (lần xác nhận thứ hai).
export async function xoaToChuc(env, toChuc, email, tenXacNhan, bayGio = new Date()) {
  if (toChuc.vai_tro !== 'chu') return { loi: 'Chỉ chủ tổ chức xóa được tổ chức.', ma: 403 };
  if (String(tenXacNhan || '').trim() !== String(toChuc.ten).trim()) return { loi: 'Tên gõ lại chưa khớp tên tổ chức, chưa xóa gì.', ma: 400 };
  const tc = toChuc.id;
  const luc = bayGio.toISOString();

  // (1) Sao lưu: dữ liệu xuất được, kèm danh sách tệp R2 để khôi phục.
  const banSao = await xuatDuLieu(env, tc, luc);
  banSao.to_chuc = { id: tc, ten: toChuc.ten };
  banSao.xoa_boi = email;
  const khoaSaoLuu = `sao-luu/${tc}/truoc-khi-xoa-${luc.replace(/[:.]/g, '-')}.json`;
  await env.TEP.put(khoaSaoLuu, JSON.stringify(banSao), { httpMetadata: { contentType: 'application/json' } });
  const coBan = await env.TEP.head(khoaSaoLuu);
  if (!coBan) return { loi: 'Không tạo được bản sao lưu nên chưa xóa gì. Thử lại sau.', ma: 500 };
  await env.TEP.put(`xoa-cho/${tc}.json`, JSON.stringify({ to_chuc_id: tc, ten: toChuc.ten, luc, ban_sao: khoaSaoLuu, email }), {
    httpMetadata: { contentType: 'application/json' },
  });

  // (2) Xóa trong D1 một lần (batch chạy như một giao dịch: lỗi giữa chừng thì không xóa gì).
  const lenh = [
    env.CSDL.prepare('DELETE FROM nhac_da_gui WHERE viec_id IN (SELECT id FROM viec WHERE to_chuc_id = ?1)').bind(tc),
    ...BANG_CUA_TO_CHUC.map((b) => env.CSDL.prepare(`DELETE FROM ${b} WHERE to_chuc_id = ?1`).bind(tc)),
    env.CSDL.prepare('DELETE FROM to_chuc WHERE id = ?1').bind(tc),
  ];
  await env.CSDL.batch(lenh);
  return { ok: true, ban_sao: khoaSaoLuu, giu_ngay: GIU_NGAY, so_viec: banSao.viec.length, so_tin: banSao.tin_nhan.length, so_tep: banSao.tep.length };
}

// Gọi trong lượt sao lưu hằng ngày: tổ chức đã xóa quá GIU_NGAY ngày thì xóa hẳn tệp và bản sao trong R2.
export async function donTepDaXoa(env, bayGio = new Date()) {
  let soToChuc = 0;
  const { objects } = await env.TEP.list({ prefix: 'xoa-cho/' });
  for (const o of objects) {
    const moc = await env.TEP.get(o.key);
    const tt = moc ? await moc.json().catch(() => null) : null;
    if (!tt?.to_chuc_id || Date.parse(tt.luc) > bayGio.getTime() - GIU_NGAY * 86400000) continue;
    // Tổ chức được khôi phục lại (có dòng to_chuc) thì bỏ mốc, không xóa tệp.
    const conLai = await env.CSDL.prepare('SELECT 1 AS x FROM to_chuc WHERE id = ?1').bind(tt.to_chuc_id).first();
    if (!conLai) {
      for (const tienTo of [`${tt.to_chuc_id}/`, `sao-luu/${tt.to_chuc_id}/`, `anh-dai-dien/${tt.to_chuc_id}/`]) {
        let con = true;
        let cursor;
        while (con) {
          const ds = await env.TEP.list({ prefix: tienTo, cursor, limit: 500 });
          if (ds.objects.length) await env.TEP.delete(ds.objects.map((x) => x.key));
          con = ds.truncated;
          cursor = ds.cursor;
        }
      }
      soToChuc++;
    }
    await env.TEP.delete(o.key);
  }
  return soToChuc;
}
