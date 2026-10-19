// Giao diện Sonicplan, thẻ "Claude trên máy riêng": đồng bộ ghi nhớ, rà soát tách việc và ghép dự án với thư mục ThangLong_KB. Thợ Claude không làm việc trực tiếp nữa, chỉ soạn prompt.
import { luc } from './chung.js';

export function trangThaiThoClaude(tho) {
  if (!tho) return { den: 'xam', chu: 'Không đọc được' };
  if (!tho.co_may) return { den: 'xam', chu: 'Chỉ có trên máy riêng' };
  return { den: 'xanh', chu: 'Sẵn sàng' };
}

export function noiDungThoClaude({ h, api, bao, tho, kb, laChu, ve }) {
  const goc = h('div', { class: 'khoi-tho-claude' });
  goc.append(h('p', { class: 'mo-ta', text: 'Thợ Claude không tự làm việc trong Sonicplan. Ở mỗi việc, bấm "Soạn prompt" để Sonicplan viết sẵn một prompt (bối cảnh, tệp liên quan, yêu cầu, tiêu chí xong), rồi bấm "Copy prompt" và dán sang Claude khác. Chỉ soạn khi bạn bấm.' }));
  if (!tho?.co_may) {
    goc.append(h('p', { class: 'mo-ta', text: 'Phần đồng bộ ghi nhớ và rà soát tách việc chỉ chạy trên máy chủ riêng (Mac mini). Máy chủ này không bật tính năng đó.' }));
    return goc;
  }
  goc.append(
    h('div', { class: 'hang-nut' },
      h('button', { class: 'nut nut-phu', type: 'button', disabled: !laChu, onclick: async () => { try { const r = await api('/api/tho-claude/ra-soat-ngay', { method: 'POST' }); bao(r.ghi_chu); } catch (e) { bao(e.message, { loi: true }); } } }, 'Rà soát tách việc ngay'),
      h('button', { class: 'nut nut-phu', type: 'button', disabled: !laChu, onclick: async (ev) => { ev.currentTarget.disabled = true; try { const r = await api('/api/tho-claude/dong-bo-ghi-nho', { method: 'POST' }); bao(r.doi ? `Đã đưa ${r.so_ghi_nho} ghi nhớ sang second-brain.` : 'Ghi nhớ trong second-brain đã khớp, không có gì mới.'); } catch (e) { bao(e.message, { loi: true }); } ve(); } }, 'Đồng bộ ghi nhớ sang second-brain')),
    h('p', { class: 'ghi-nho-kn', text: tho.ra_soat ? `Báo cáo rà soát tách việc gần nhất: ${luc(tho.ra_soat.luc)}, ${tho.ra_soat.so_mau} tin mẫu, trong ThangLong_KB: ${tho.ra_soat.tep}. Bấm Rà soát tách việc ngay để chạy lại.` : 'Chưa có báo cáo rà soát tách việc nào; tự chạy sáng thứ Hai.' }),
    h('p', { class: 'ghi-nho-kn', text: tho.ghi_nho_kb_luc ? `Ghi nhớ sang KB lần cuối: ${luc(tho.ghi_nho_kb_luc)}. Tự chạy mỗi đêm sau 23h.` : 'Ghi nhớ chưa được đồng bộ sang KB lần nào; tự chạy mỗi đêm sau 23h.' }),
  );
  if (tho.kb) goc.append(h('p', { class: 'ghi-nho-kn', text: tho.kb.da_clone ? `ThangLong_KB trên máy: bản mới nhất ${tho.kb.ban_moi_nhat || 'chưa tải'}.` : 'ThangLong_KB chưa tải về máy, sẽ tự tải ở lượt chạy đầu tiên.' }));
  if (kb?.du_an?.length) {
    const hang = kb.du_an.map((d) => {
      const o = h('select', { 'aria-label': `Thư mục KB của dự án ${d.ten}`, disabled: !laChu },
        h('option', { value: '', text: d.goi_y ? `Theo gợi ý: ${d.goi_y}` : 'Chưa ghép (dùng _INBOX/Sonicplan)', selected: !d.kb_thu_muc }),
        ...kb.thu_muc_kb.map((t) => h('option', { value: t, text: t, selected: d.kb_thu_muc === t })));
      o.addEventListener('change', async () => {
        try { await api(`/api/kb/du-an/${d.id}`, { method: 'PUT', body: JSON.stringify({ kb_thu_muc: o.value || null }) }); bao(`Đã ghép dự án ${d.ten}.`); } catch (e) { bao(e.message, { loi: true }); }
      });
      return h('label', { class: 'chon-loc' }, h('span', { text: `${d.ten}${d.kb_thu_muc && !d.kb_duyet ? ' (tự khớp, chưa duyệt)' : ''}` }), o);
    });
    goc.append(h('h3', { class: 'tieu-nhom-kn', text: 'Ghép dự án với thư mục ThangLong_KB' }), h('div', { class: 'luoi-ghep-kb' }, ...hang));
  }
  return goc;
}
