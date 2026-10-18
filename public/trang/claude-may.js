// Giao diện Sonicplan, thẻ "Claude làm việc ở máy": bật tắt thợ Claude, hạn mức, hàng đợi và ghép dự án với thư mục ThangLong_KB.
import { luc } from './chung.js';

export function trangThaiThoClaude(tho) {
  if (!tho) return { den: 'xam', chu: 'Không đọc được' };
  if (!tho.co_may) return { den: 'xam', chu: 'Chỉ có trên máy riêng' };
  if (!tho.cau_hinh.bat) return { den: 'vang', chu: 'Đang tắt' };
  if (tho.dang_lam.length) return { den: 'xanh', chu: `Đang làm ${tho.dang_lam.length} việc` };
  return { den: 'xanh', chu: `Sẵn sàng, hôm nay ${tho.hom_nay}/${tho.cau_hinh.toi_da_ngay}` };
}

export function noiDungThoClaude({ h, api, bao, tho, kb, laChu, ve }) {
  const goc = h('div', { class: 'khoi-tho-claude' });
  if (!tho?.co_may) {
    goc.append(h('p', { class: 'mo-ta', text: 'Thợ Claude chỉ chạy trên máy chủ riêng (Mac mini). Máy chủ này không bật tính năng đó.' }));
    return goc;
  }
  const c = tho.cau_hinh;
  const luu = async (d) => { try { await api('/api/tho-claude', { method: 'PUT', body: JSON.stringify(d) }); bao('Đã lưu.'); ve(); } catch (e) { bao(e.message, { loi: true }); ve(); } };
  const bat = h('input', { type: 'checkbox', checked: c.bat, disabled: !laChu });
  bat.addEventListener('change', () => luu({ bat: bat.checked }));
  const chon = (nhan, khoa, ds, gt) => {
    const o = h('select', { 'aria-label': nhan, disabled: !laChu }, ...ds.map((x) => h('option', { value: String(x), selected: x === gt, text: String(x) })));
    o.addEventListener('change', () => luu({ [khoa]: Number(o.value) }));
    return h('label', { class: 'chon-loc' }, h('span', { text: nhan }), o);
  };
  goc.append(
    h('p', { class: 'mo-ta', text: 'Việc AI xếp vào nhóm "Claude làm được" và đủ tệp hoặc nội dung thì tự chạy ngay trên máy này, trong bản sao ThangLong_KB; việc thiếu tệp chờ bạn thêm. Kết quả nằm trong thư mục dự án của KB và về Google Drive khi PR gộp vào main; model Opus cho tờ trình, hợp đồng, phân tích, còn lại Sonnet; việc sang "chờ duyệt" kèm thông báo đẩy.' }),
    h('label', { class: 'hang-cong-tac' }, bat, h('span', { text: 'Tự chạy việc nhóm Claude' })),
    h('div', { class: 'hang-nut' }, chon('Cùng lúc', 'song_song', [1, 2, 3, 4], c.song_song), chon('Tối đa mỗi ngày', 'toi_da_ngay', [0, 5, 10, 15, 20, 30, 50], c.toi_da_ngay)),
    h('p', { class: 'ghi-nho-kn', text: `Hôm nay đã tự chạy ${tho.hom_nay}/${c.toi_da_ngay} việc. ${tho.hang_cho ? `${tho.hang_cho} lượt đang chờ. ` : ''}${tho.dang_lam.length ? `Đang làm: ${tho.dang_lam.map((d) => `${d.tieu_de} (từ ${luc(d.bat_dau_luc)})`).join('; ')}.` : 'Chưa có việc nào đang làm.'}` }),
    h('div', { class: 'hang-nut' },
      h('button', { class: 'nut nut-phu', type: 'button', disabled: !laChu, onclick: async () => { try { await api('/api/tho-claude/chay-ngay', { method: 'POST' }); bao('Đã gọi thợ Claude kiểm hàng đợi.'); setTimeout(ve, 1500); } catch (e) { bao(e.message, { loi: true }); } } }, 'Kiểm hàng đợi ngay'),
      h('button', { class: 'nut nut-phu', type: 'button', disabled: !laChu, onclick: async () => { try { const r = await api('/api/tho-claude/ra-soat-ngay', { method: 'POST' }); bao(r.ghi_chu); } catch (e) { bao(e.message, { loi: true }); } } }, 'Rà soát tách việc ngay'),
      h('button', { class: 'nut nut-phu', type: 'button', disabled: !laChu, onclick: async (ev) => { ev.currentTarget.disabled = true; try { const r = await api('/api/tho-claude/dong-bo-ghi-nho', { method: 'POST' }); bao(r.doi ? `Đã đưa ${r.so_ghi_nho} ghi nhớ sang second-brain.` : 'Ghi nhớ trong second-brain đã khớp, không có gì mới.'); } catch (e) { bao(e.message, { loi: true }); } ve(); } }, 'Đồng bộ ghi nhớ sang second-brain')),
    h('p', { class: 'ghi-nho-kn', text: tho.nhap_gmail ? 'Nháp Gmail: đã cấp quyền. Claude chỉ tạo bản nháp trong mục Thư nháp, không bao giờ gửi; bạn tự xem và bấm gửi.' : 'Nháp Gmail: chưa cấp quyền. Muốn Claude soạn sẵn thư trả lời vào mục Thư nháp, đăng nhập lại Google ở thẻ Google và tick quyền soạn thư. Claude không bao giờ gửi thư.' }),
    h('p', { class: 'ghi-nho-kn', text: tho.ra_soat ? `Báo cáo rà soát tách việc gần nhất: ${luc(tho.ra_soat.luc)}, ${tho.ra_soat.so_mau} tin mẫu, trong ThangLong_KB: ${tho.ra_soat.tep}. Tự chạy sáng thứ Hai.` : 'Chưa có báo cáo rà soát tách việc nào; tự chạy sáng thứ Hai.' }),
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
