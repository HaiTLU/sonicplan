// Giao diện Sonicplan, Mục Ghi nhớ.
import { api, bao, capNhatDem, h, icon, khungLoi, thay, trang, xuong } from './chung.js';
import { chepChu } from './viec.js';

// =====================================================================
// Ghi nhớ: điều hệ thống nhớ về người, dự án, quyết định; người dùng duyệt, sửa, ghim, xóa
// =====================================================================
const LOAI_NHO = { nguoi: 'Người', du_an: 'Dự án', quyet_dinh: 'Quyết định', su_that: 'Thông tin' };

export async function veGhiNho(goc) {
  const n = trang.nho;
  const oTim = h('input', { type: 'search', placeholder: 'Tìm trong ghi nhớ…', value: n.q, 'aria-label': 'Tìm ghi nhớ' });
  const chip = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(n.loai === ma), onclick: () => { n.loai = ma; veGhiNho(goc); } }, nhan);
  const ds = h('div', { class: 'ds-nho' }, ...[1, 2, 3].map(() => h('div', { class: 'bang the-nho' }, xuong(16, '40%'), xuong(14, '90%'))));
  const dauMuc = h('div', { class: 'thanh-loc' }, chip('tat-ca', 'Tất cả'), chip('moi', 'Mới, chờ duyệt'), ...Object.entries(LOAI_NHO).map(([ma, nhan]) => chip(ma, nhan)), h('label', { class: 'o-tim' }, icon('tim'), oTim));
  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { n.q = oTim.value.trim(); nap(); }, 300); });

  const oLoai = h('select', { 'aria-label': 'Loại' }, ...Object.entries(LOAI_NHO).map(([ma, nhan]) => h('option', { value: ma, text: nhan })));
  const oTieu = h('input', { type: 'text', placeholder: 'Tiêu đề, ví dụ: Chị Lan', maxlength: '120', required: true, 'aria-label': 'Tiêu đề' });
  const oNoi = h('input', { type: 'text', placeholder: 'Điều cần nhớ, ví dụ: Trưởng phòng đào tạo', maxlength: '600', required: true, 'aria-label': 'Nội dung' });
  const form = h('form', { class: 'bang them-nho' }, oLoai, oTieu, oNoi, h('button', { class: 'nut nut-chinh', type: 'submit' }, icon('cong'), 'Thêm'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/ghi-nho', { method: 'POST', body: JSON.stringify({ loai: oLoai.value, tieu_de: oTieu.value, noi_dung: oNoi.value }) });
      oTieu.value = ''; oNoi.value = '';
      bao('Đã ghi nhớ.');
      nap();
    } catch (err) {
      bao(err.message, { loi: true });
    }
  });
  // Hồ sơ: vài dòng tự khai, đưa vào mọi lần AI chạy
  const oHoSo = h('textarea', { rows: '6', maxlength: '2000', placeholder: 'Ví dụ:\nTôi là quản lý dự án, phụ trách mảng đào tạo ngắn hạn.\nChị Lan là trưởng phòng, việc chị giao luôn ưu tiên cao.\nNhóm "Dự án A" trên Zalo là việc khách hàng.\nTôi hay làm việc buổi sáng, họp chiều. Xưng "em" với cấp trên.', 'aria-label': 'Hồ sơ của bạn' });
  const demHoSo = h('span', { class: 'mo-ta', text: '' });
  const capNhatDem = () => { demHoSo.textContent = `${oHoSo.value.length}/2000 ký tự`; };
  oHoSo.addEventListener('input', capNhatDem);
  const nutHoSo = h('button', { class: 'nut nut-chinh', type: 'button', onclick: async () => {
    nutHoSo.disabled = true;
    try { await api('/api/ho-so', { method: 'PUT', body: JSON.stringify({ noi_dung: oHoSo.value }) }); bao('Đã lưu hồ sơ. Lần sau AI đọc tin sẽ dùng nó.'); } catch (err) { bao(err.message, { loi: true }); }
    nutHoSo.disabled = false;
  } }, 'Lưu hồ sơ');
  api('/api/ho-so').then((r) => { oHoSo.value = r.noi_dung || ''; capNhatDem(); }).catch(() => {});
  // Khung mẫu: điền dần các mục để AI biết nhóm nào là việc, giờ nào hiểu sao, ai quan trọng.
  const KHUNG_HO_SO = 'Vai trò: \nXưng hô (với cấp trên, với đồng nghiệp): \nNhóm Zalo là công việc: \nNhóm Zalo là bạn bè, gia đình, không tạo việc: \nNgười ưu tiên cao (việc họ giao làm trước): \nGiờ "5h30", "6h" không ghi sáng chiều thì hiểu là: \nDự án đang gấp: \nQuy tắc khác: ';
  const nutKhung = h('button', { class: 'nut nut-phu', type: 'button', onclick: () => {
    if (oHoSo.value.trim() && !confirm('Hồ sơ đang có chữ. Thêm khung mẫu xuống cuối?')) return;
    oHoSo.value = `${oHoSo.value.trimEnd()}${oHoSo.value.trim() ? '\n\n' : ''}${KHUNG_HO_SO}`.slice(0, 2000);
    capNhatDem();
    oHoSo.focus();
  } }, 'Chèn khung mẫu');
  const hopHoc = h('section', { class: 'bang' }, h('h3', { text: 'Học từ lựa chọn của bạn' }));
  api('/api/hoc-hang-ngay').then((r) => {
    hopHoc.append(
      h('p', { text: `Những lần bạn sửa việc hoặc trả lời AI được dùng khi gặp tin cùng bối cảnh. ${r.bat ? 'Mỗi tối lúc 23h, hệ thống tổng hợp lời dặn để bạn duyệt.' : 'Tổng hợp hằng ngày đang tắt; bạn có thể bật trong trang Luồng.'}` }),
      h('p', { text: r.lan_cuoi ? `Lần tổng hợp gần nhất: ${new Date(r.lan_cuoi.luc).toLocaleString('vi-VN')}.` : 'Chưa có lượt tổng hợp hằng ngày thành công.' }),
      h('p', { text: `7 ngày gần đây: ${r.so_tra_loi} câu trả lời; ${r.gan.da_sua}/${r.gan.so_viec} việc AI tạo đã bị sửa hoặc hủy. Kỳ 7 ngày trước: ${r.truoc.da_sua}/${r.truoc.so_viec}.` }),
      h('p', { class: 'mo-ta', text: r.luu_y }),
    );
  }).catch(() => hopHoc.append(h('p', { text: 'Chưa tải được tình trạng học. Hãy tải lại trang.' })));
  // Gợi ý hằng ngày; giữ nguyên các đề xuất đang chờ.
  const hopGoiY = h('section', { class: 'bang goi-y-loi-dan', hidden: true });
  const napGoiY = () => api('/api/goi-y-loi-dan').then((r) => {
    hopGoiY.replaceChildren();
    hopGoiY.hidden = !r.ds.length;
    if (!r.ds.length) return;
    hopGoiY.append(h('h3', { text: 'AI gợi ý lời dặn mới' }), h('p', { class: 'mo-ta', text: 'AI học từ những lần bạn sửa việc và trả lời câu hỏi. Duyệt để thêm quy tắc vào hồ sơ; bỏ để ghi nhớ rằng bạn không muốn lời dặn này. Bạn có thể sửa hoặc xóa quy tắc đã duyệt trong hồ sơ.' }));
    r.ds.forEach((dong, i) => {
      const lam = async (quyet) => {
        try { await api('/api/goi-y-loi-dan', { method: 'POST', body: JSON.stringify({ chi_so: i, quyet, noi_dung: dong }) }); if (quyet === 'duyet') api('/api/ho-so').then((x) => { oHoSo.value = x.noi_dung || ''; capNhatDem(); }); napGoiY(); } catch (err) { bao(err.message, { loi: true }); }
      };
      hopGoiY.append(h('div', { class: 'hang-nut' }, h('span', { text: dong }), h('button', { class: 'nut nut-chinh nut-nho', type: 'button', onclick: () => lam('duyet') }, 'Duyệt'), h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => lam('bo') }, 'Bỏ')));
    });
  }).catch(() => {});
  napGoiY();
  const theHoSo = h('section', { class: 'bang ho-so' },
    h('h3', { text: 'Hồ sơ của bạn' }),
    h('p', { class: 'mo-ta', text: 'Vài dòng giúp AI hiểu bạn là ai và ai là ai trong công việc. AI đọc hồ sơ này mỗi lần tách việc, gợi ý, lập kế hoạch ngày và trả lời trên Telegram. Không ghi mật khẩu hay số thẻ.' }),
    oHoSo,
    h('div', { class: 'hang-nut' }, nutHoSo, nutKhung, demHoSo),
  );
  thay(goc, hopHoc, theHoSo, hopGoiY, h('p', { class: 'tom-tat-phu', style: 'margin-bottom:14px', text: 'Hệ thống tự nhớ người, dự án và quyết định từ tin đến, rồi dùng lại khi đọc tin sau. Mục mới do AI thêm có nhãn chờ duyệt: bấm dấu tích nếu đúng, sửa hoặc xóa nếu sai.' }), form, dauMuc, ds);

  async function hanhDong(id, thanDu, thongBao) {
    try {
      await api(`/api/ghi-nho/${id}`, { method: 'PATCH', body: JSON.stringify(thanDu) });
      if (thongBao) bao(thongBao);
      nap();
    } catch (err) {
      bao(err.message, { loi: true });
    }
  }
  function the(g) {
    const tren = h('div', { class: 'dau-nho' },
      h('span', { class: 'nhan-nho', text: LOAI_NHO[g.loai] }),
      g.nguon === 'ai' && !g.da_duyet ? h('span', { class: 'nhan-nho moi', text: 'Mới, chờ duyệt' }) : null,
      g.do_tin_cay === 'thap' && !g.da_duyet ? h('span', { class: 'nhan-nho thap', text: 'AI dự phòng, cần kiểm' }) : null,
    );
    const noi = h('p', { class: 'noi-nho', text: g.noi_dung });
    const nut = (nhan, ten, lam, loiNut = false) => h('button', { class: `nut-icon${loiNut ? ' nguy' : ''}`, type: 'button', title: nhan, 'aria-label': nhan, onclick: lam }, icon(ten));
    const hang = h('div', { class: 'tac-nho' },
      g.nguon === 'ai' && !g.da_duyet ? nut('Đúng, giữ lại', 'xong', () => hanhDong(g.id, { da_duyet: true })) : null,
      nut(g.ghim ? 'Bỏ ghim' : 'Ghim', 'ghim', () => hanhDong(g.id, { ghim: !g.ghim })),
      nut('Sửa', 'sua', () => sua()),
      nut('Xóa', 'xoa', async () => {
        try {
          await api(`/api/ghi-nho/${g.id}`, { method: 'DELETE' });
          bao('Đã xóa.');
          nap();
        } catch (err) {
          bao(err.message, { loi: true });
        }
      }, true),
    );
    const el = h('article', { class: `bang the-nho${g.ghim ? ' ghim' : ''}` }, h('div', { class: 'hang-nho' }, tren, hang), h('h3', { text: g.tieu_de }), noi);
    el._td = () => ({ nhan: `Thao tác với ghi nhớ ${g.tieu_de}`, muc: [
      g.nguon === 'ai' && !g.da_duyet ? { nhan: 'Đúng, giữ lại', lam: () => hanhDong(g.id, { da_duyet: true }) } : null,
      { nhan: g.ghim ? 'Bỏ ghim' : 'Ghim', lam: () => hanhDong(g.id, { ghim: !g.ghim }) },
      { nhan: 'Sửa nội dung', lam: () => sua() },
      { nhan: 'Sao chép nội dung', lam: () => chepChu(g.noi_dung) },
      { vach: true },
      { nhan: 'Xóa', nguy: true, lam: async () => {
        if (!confirm(`Xóa ghi nhớ "${g.tieu_de}"?`)) return;
        try { await api(`/api/ghi-nho/${g.id}`, { method: 'DELETE' }); bao('Đã xóa.'); nap(); } catch (err) { bao(err.message, { loi: true }); }
      } },
    ] });
    function sua() {
      const o = h('textarea', { rows: '3', maxlength: '600', 'aria-label': 'Sửa nội dung' });
      o.value = g.noi_dung;
      const luu = h('button', { class: 'nut nut-chinh nut-nho', type: 'button', text: 'Lưu', onclick: () => hanhDong(g.id, { noi_dung: o.value }, 'Đã lưu.') });
      const huy = h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Hủy', onclick: () => noi.replaceWith(noi) });
      huy.onclick = () => { khung.replaceWith(noi); };
      const khung = h('div', { class: 'sua-nho' }, o, h('div', { class: 'tac-nho' }, luu, huy));
      noi.replaceWith(khung);
      o.focus();
    }
    return el;
  }
  async function nap() {
    try {
      const tham = new URLSearchParams();
      if (n.loai === 'moi') tham.set('moi', '1');
      else if (n.loai !== 'tat-ca') tham.set('loai', n.loai);
      if (n.q) tham.set('q', n.q);
      const kq = await api(`/api/ghi-nho${tham.size ? `?${tham}` : ''}`);
      if (!kq.ghi_nho.length) {
        thay(ds, h('div', { class: 'bang trong-trai', style: 'min-height:260px' }, icon('ghi-nho'), h('h3', { text: kq.tong ? 'Không có mục nào khớp' : 'Chưa nhớ gì' }), h('p', { text: kq.tong ? 'Thử bỏ bộ lọc hoặc đổi từ khóa.' : 'Khi có tin mới, hệ thống tự ghi lại người, dự án và quyết định ở đây. Anh cũng thêm tay được ở ô phía trên.' })));
        return;
      }
      thay(ds, ...kq.ghi_nho.map(the));
    } catch (e) {
      thay(ds, khungLoi(e, nap));
    }
  }
  nap();
}
