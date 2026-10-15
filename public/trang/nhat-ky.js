// Giao diện Sonicplan, Mục Nhật ký chạy.
import { KET_QUA, S, api, bao, fmt, h, icon, thay, xuong } from './chung.js';

// =====================================================================
// Nhật ký chạy
// =====================================================================
// Chạy tay một tác vụ hẹn giờ (nút Chạy ngay, Chạy lại). Trả kết quả để nơi gọi vẽ lại.
export async function chayNgay(ma) {
  try {
    const kq = await api('/api/chay-ngay', { method: 'POST', body: JSON.stringify({ tac_vu: ma }) });
    bao(kq.trang_thai === 'loi' ? `Lỗi: ${kq.ghi_chu}` : kq.ghi_chu || 'Đã chạy.', { loi: kq.trang_thai === 'loi' });
    return kq;
  } catch (e) {
    bao(e.message, { loi: true });
    return null;
  }
}
export async function veNhatKy(goc) {
  thay(goc, h('div', { class: 'bang', style: 'padding:20px' }, ...[1, 2, 3, 4, 5, 6].map(() => h('div', { style: 'margin-bottom:12px' }, xuong(18)))));
  const { dong } = await api('/api/nhat-ky?so_dong=300');
  const cacTacVu = [...new Set(dong.map((d) => d.tac_vu))];
  const loc = S.locNhatKy === 'tat-ca' ? dong : S.locNhatKy === 'loi' ? dong.filter((d) => d.trang_thai === 'loi') : dong.filter((d) => d.tac_vu === S.locNhatKy);
  const soLoi = dong.filter((d) => d.trang_thai === 'loi').length;
  const chip = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.locNhatKy === ma), onclick: () => { S.locNhatKy = ma; veNhatKy(goc); } }, nhan);
  thay(goc, 
    h('div', { class: 'thanh-loc' }, chip('tat-ca', 'Tất cả'), chip('loi', h('span', {}, 'Lỗi ', h('b', { text: String(soLoi) }))), ...cacTacVu.map((t) => chip(t, t))),
    h('div', { class: 'bang' }, h('div', { class: 'bang-cuon', tabindex: '0', role: 'region', 'aria-label': 'Bảng nhật ký' },
      loc.length
        ? h('table', {},
          h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Bắt đầu' }), h('th', { scope: 'col', text: 'Tác vụ' }), h('th', { scope: 'col', text: 'Kết quả' }), h('th', { scope: 'col', class: 'so', text: 'Số mục' }), h('th', { scope: 'col', text: 'Ghi chú' }), h('th', { scope: 'col' }, h('span', { class: 'chi-doc-man-hinh', text: 'Chạy lại' })))),
          h('tbody', {}, ...loc.map((d) => h('tr', {},
            h('td', { class: 'gio', text: fmt.ngayGio.format(new Date(d.bat_dau)) }),
            h('td', { translate: 'no', text: d.tac_vu }),
            h('td', {}, h('span', { class: `nhan-kq ${d.trang_thai}`, text: KET_QUA[d.trang_thai] || d.trang_thai })),
            h('td', { class: 'so', text: String(d.so_muc) }),
            h('td', { class: 'ghi-chu', text: d.ghi_chu || '' }),
            h('td', {}, d.trang_thai === 'loi' ? h('button', { class: 'nut nut-phu', type: 'button', onclick: async (ev) => { ev.target.disabled = true; await chayNgay(d.tac_vu); veNhatKy(goc); } }, 'Chạy lại') : null),
          ))))
        : h('div', { class: 'trong-trai', style: 'min-height:240px' }, icon('nhat-ky'), h('h3', { text: 'Chưa có lần chạy nào' }), h('p', { text: 'Hẹn giờ chạy lần đầu vào đầu giờ kế tiếp.' })),
    )),
  );
}
