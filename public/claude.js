// Khối "Claude Code" trong ngăn sửa việc: giao việc, xem tiến độ, đọc kết quả, duyệt Đạt hoặc Làm lại.
// Hàm dựng phần tử và gọi API do app.js truyền vào để không phải nhập vòng.

export const CHU_TRANG_THAI = { cho: 'Đã giao, chờ chạy', dang_lam: 'Claude đang làm', xong: 'Claude đã xong', loi: 'Claude gặp lỗi' };

let henGio = null;

export function dungKhoiClaude() {
  clearTimeout(henGio);
  henGio = null;
}

export async function veKhoiClaude(goc, v, { h, api, bao, luc, sauKhiDat }) {
  dungKhoiClaude();
  goc.replaceChildren();
  goc.hidden = !v || v.trang_thai !== 'mo';
  if (goc.hidden) return;
  let du;
  try {
    du = await api(`/api/viec/${v.id}/claude`);
  } catch (e) {
    goc.append(h('p', { class: 'mo-ta', text: e.message }));
    return;
  }
  const ve = () => veKhoiClaude(goc, v, { h, api, bao, luc, sauKhiDat });
  const moi = du.luot[0];
  const dangChay = moi && (moi.trang_thai === 'cho' || moi.trang_thai === 'dang_lam');

  goc.append(h('h3', { text: 'Claude Code' }));
  if (!du.da_noi) {
    goc.append(h('p', { class: 'mo-ta' }, 'Nối GitHub ở ', h('a', { href: '#ket-noi', text: 'trang Kết nối' }), ' để giao việc này cho Claude làm.'));
    return;
  }

  if (moi) {
    const the = h('div', { class: `luot-claude ${moi.trang_thai}`, role: 'status', 'aria-live': 'polite' },
      h('p', { class: 'trang-thai-luot' }, h('strong', { text: CHU_TRANG_THAI[moi.trang_thai] }), h('span', { text: ` · cập nhật ${luc(moi.cap_nhat_luc)}` })),
      moi.dan ? h('p', { class: 'dan', text: `Bạn dặn: ${moi.dan}` }) : null,
      moi.ket_qua ? h('div', { class: 'ket-qua', tabindex: '0', 'aria-label': 'Kết quả Claude', text: moi.ket_qua }) : null,
      h('p', { class: 'lien-ket-luot' },
        moi.pr ? h('a', { href: moi.pr, target: '_blank', rel: 'noopener', text: 'Xem PR' }) : null,
        moi.nhanh ? h('a', { href: moi.nhanh, target: '_blank', rel: 'noopener', text: 'Xem tệp' }) : null,
        moi.nhat_ky ? h('a', { href: moi.nhat_ky, target: '_blank', rel: 'noopener', text: 'Xem nhật ký' }) : null,
      ),
    );
    if (moi.trang_thai === 'xong' && !moi.danh_gia) {
      the.append(h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
          ev.target.disabled = true;
          try {
            await api(`/api/claude/${moi.id}/danh-gia`, { method: 'POST', body: JSON.stringify({ danh_gia: 'dat' }) });
            await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'xong' }) });
            bao('Đã duyệt, việc chuyển sang xong.');
            sauKhiDat();
          } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
        } }, 'Đạt, đóng việc'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => {
          await api(`/api/claude/${moi.id}/danh-gia`, { method: 'POST', body: JSON.stringify({ danh_gia: 'lam_lai' }) }).catch(() => {});
          oDan.focus();
          bao('Ghi góp ý vào ô dặn Claude rồi bấm Giao lại.');
        } }, 'Làm lại'),
      ));
    }
    goc.append(the);
  }

  const oDan = h('textarea', { rows: '3', maxlength: '4000', placeholder: 'Dặn thêm Claude (không bắt buộc), ví dụ: soạn email trả lời, giọng lịch sự…', 'aria-label': 'Dặn thêm Claude' });
  if (!dangChay) {
    goc.append(
      h('label', { class: 'truong' }, h('span', { text: 'Dặn Claude' }), oDan),
      h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          await api(`/api/viec/${v.id}/claude`, { method: 'POST', body: JSON.stringify({ dan: oDan.value }) });
          bao('Đã giao cho Claude. Kết quả sẽ hiện ở đây.');
          ve();
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, moi ? 'Giao lại' : 'Giao Claude')),
    );
  } else {
    // Đang chạy: hỏi lại mỗi 8 giây cho tới khi xong hoặc ngăn đóng.
    henGio = setTimeout(() => { if (!goc.hidden && goc.isConnected && goc.closest('dialog')?.open) ve(); }, 8000);
  }
}
