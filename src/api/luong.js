// API giao diện: Luồng: cài đặt từng khâu và số liệu hiện trên sơ đồ.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { NGUONG, docLuong, luuLuong } from '../luong.js';
import { docTichHop } from '../tich-hop.js';
import { json, loi, ngayVN } from '../tien-ich.js';
import { laChu } from './chung.js';

// ---- Luồng: cài đặt từng khâu và số liệu hiện trên sơ đồ ----

async function layLuong(env, tc) {
  const [lg, dem, ai, webhook] = await Promise.all([
    docLuong(env, tc),
    env.CSDL.batch([
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM ghi_nho WHERE to_chuc_id = ?1`).bind(tc),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo'`).bind(tc),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM tin_nhan WHERE to_chuc_id = ?1 AND da_tach = 0`).bind(tc),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND gio_hen IS NOT NULL AND han_ngay >= ?2`).bind(tc, ngayVN()),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND google_task_id IS NOT NULL`).bind(tc),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND lich_event_id IS NOT NULL`).bind(tc),
    ]),
    docTichHop(env, tc, 'ai'),
    docTichHop(env, tc, 'webhook'),
  ]);
  const [nho, viec, tinCho, nhac, tasksGoogle, lichGoogle] = dem.map((d) => d.results[0].n);
  return {
    ...lg,
    gioi_han: Object.fromEntries(Object.entries(NGUONG).map(([k, v]) => [k, { min: v.min, max: v.max, mac_dinh: v.mac_dinh }])),
    so_lieu: { ghi_nho: nho, viec_mo: viec, tin_cho: tinCho, nhac_sap_toi: nhac, tasks_google: tasksGoogle, lich_google: lichGoogle },
    ai: ai ? { loai: ai.loai, mo_hinh: ai.mo_hinh } : null,
    webhook: Boolean(webhook),
  };
}

export async function xuLyLuong(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;

  if (p === '/api/luong' && m === 'GET') return json(await layLuong(env, tc));
  if (p === '/api/luong' && m === 'PATCH') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức chỉnh được luồng.');
    const e = await luuLuong(env, tc, await yeuCau.json().catch(() => ({})));
    return e ? loi(400, e) : json(await layLuong(env, tc));
  }

  return null;
}
