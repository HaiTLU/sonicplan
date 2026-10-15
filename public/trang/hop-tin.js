// Giao diện Sonicplan, Hộp tin và chặn nguồn tin.
import { trichTin } from '../zalo-tin.js';
import { api, bao, capNhatDem, fmt, h, icon, khungLoi, kichThuoc, lamMoiDem, luc, ngayHienThi, tenNhom, thay, trang, xuong } from './chung.js';
import { kieuMo, moXemTep } from './tep.js';
import { NGUON_TIN, dongPhuTin, iconNguon, tenGuiTin } from './tong-quan.js';
import { chanTuTin, chepChu, moNganViec } from './viec.js';

// =====================================================================
// Spam: chặn một nguồn tin
// =====================================================================
// Nút Spam mở khung xác nhận ngay tại chỗ. tuyChon: các cách chặn ({ loai, gia_tri, nhan }), gui(tuyChon) gọi API,
// sauKhi() chạy khi chặn xong. Tin cũ của nguồn bị ẩn, việc chưa xong sinh từ đó bị gỡ, AI không đọc nguồn này nữa.
function moTaChan(c, nguon) {
  if (c.loai === 'nhom') return tenNhom(c.nhan);
  if (c.loai === 'dia_chi') return `Mọi thư từ ${c.nhan}`;
  return nguon === 'zalo' ? `Tin riêng với "${c.nhan}"` : `Thư của "${c.nhan}"`;
}

export function nutSpam({ nguon, tuyChon, gui, sauKhi }) {
  const khung = h('div', { class: 'hop-spam', hidden: true });
  const nut = h('button', { class: 'nut nut-nguy nut-nho', type: 'button', 'aria-expanded': 'false', onclick: () => { khung.hidden = !khung.hidden; nut.setAttribute('aria-expanded', String(!khung.hidden)); } }, icon('chan'), 'Spam');
  let chon = tuyChon[0];
  const tenNhom = `chan-${Math.random().toString(36).slice(2, 8)}`;
  const dongY = h('button', { class: 'nut nut-nguy nut-nho', type: 'button', text: 'Chặn' });
  dongY.addEventListener('click', async () => {
    dongY.disabled = true;
    try {
      const kq = await gui(chon);
      bao(`Đã chặn ${kq.nhan}. Ẩn ${kq.an_tin} tin${kq.go_viec ? `, gỡ ${kq.go_viec} việc chưa xong` : ''}. Bỏ chặn ở mục Đã chặn.`);
      lamMoiDem();
      sauKhi();
    } catch (e) {
      bao(e.message, { loi: true });
      dongY.disabled = false;
    }
  });
  khung.append(
    h('p', { class: 'hop-spam-dau', text: 'Không hiện và không tính thành việc cần làm:' }),
    ...tuyChon.map((c, i) => h('label', { class: 'hop-spam-chon' }, h('input', { type: 'radio', name: tenNhom, ...(i === 0 ? { checked: '' } : {}), onchange: () => { chon = c; } }), h('span', { text: moTaChan(c, nguon) }))),
    h('p', { class: 'mo-ta', text: 'Tin cũ của nguồn này sẽ ẩn và việc chưa xong sinh ra từ đó sẽ gỡ. Việc đã xong được giữ lại.' }),
    h('div', { class: 'hang-nut' }, dongY, h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Hủy', onclick: () => { khung.hidden = true; nut.setAttribute('aria-expanded', 'false'); } })),
  );
  return { nut, khung };
}

export async function veDaChan(goc) {
  thay(goc, h('div', { class: 'bang' }, xuong(20, '40%'), h('div', { style: 'height:12px' }), xuong(60)));
  const ve = async () => {
    let ds;
    try { ds = (await api('/api/chan')).ds; } catch (e) { thay(goc, khungLoi(e, ve)); return; }
    const ten = { zalo: 'Zalo', gmail: 'Thư' };
    const LOAI_CHAN = { nhom: 'cả nhóm', nguoi: 'theo người gửi', dia_chi: 'cả địa chỉ' };
    thay(goc, h('div', { class: 'bang vao' },
      h('div', { class: 'bang-dau' }, h('h2', {}, icon('chan'), 'Nguồn đã chặn')),
      h('p', { class: 'mo-ta', text: 'Tin từ các nguồn này không hiện trong Hộp tin và không bao giờ được tính thành việc. Bỏ chặn thì tin cũ hiện lại, nhưng việc đã gỡ không tự trở lại.' }),
      ds.length
        ? h('ul', { class: 'ds-chan' }, ...ds.map((c) => h('li', {},
          h('span', { class: `huy-hieu ${c.nguon}` }, icon(c.nguon === 'zalo' ? 'zalo' : 'thu')),
          h('div', { style: 'min-width:0' }, h('strong', { text: c.nhan }), h('small', { text: `${ten[c.nguon]}, ${LOAI_CHAN[c.loai]}, chặn ${luc(c.tao_luc)}` })),
          h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Bỏ chặn', onclick: async (ev) => {
            ev.target.disabled = true;
            try { const kq = await api(`/api/chan/${c.id}`, { method: 'DELETE' }); bao(`Đã bỏ chặn ${c.nhan}${kq.hien_tin ? `, ${kq.hien_tin} tin hiện lại` : ''}.`); ve(); } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
          } }),
        )))
        : h('div', { class: 'trong-trai' }, icon('chan'), h('h3', { text: 'Chưa chặn nguồn nào' }), h('p', { text: 'Mở một tin hoặc hội thoại không cần xem, bấm Spam để ẩn và không tính thành việc.' })),
    ));
  };
  await ve();
}

// =====================================================================
// Hộp tin
// =====================================================================
// Hai nút đầu tin cuộc họp: nghe ghi âm và mở biên bản bằng khung xem của Drive.
function nutCuocHop(tep) {
  const laGhiAm = (f) => /\.(m4a|mp3|wav|webm|ogg|oga|aac|opus|flac|amr|caf)$/i.test(f.ten) || /^audio\//.test(f.loai || '');
  const ghiAm = tep.find(laGhiAm);
  const bienBan = tep.find((f) => !laGhiAm(f));
  if (!ghiAm && !bienBan) return null;
  const mo = (f) => () => { const k = kieuMo(f); if (k) moXemTep(f, k); else location.href = `/api/tep/${f.id}/tai`; };
  return h('div', { class: 'hang-nut', style: 'margin:4px 0 18px' },
    ghiAm ? h('button', { class: 'nut nut-chinh', type: 'button', onclick: mo(ghiAm) }, icon('ghi-am'), 'Nghe ghi âm') : null,
    bienBan ? h('button', { class: 'nut nut-phu', type: 'button', onclick: mo(bienBan) }, icon('tep'), 'Mở biên bản') : null,
  );
}

export async function veHopTin(goc, thamSo) {
  const t = trang.tin;
  if (thamSo) t.chon = Number(thamSo);
  const khungDs = h('div', { class: 'bang ds-tin', 'aria-label': 'Danh sách tin' }, ...[1, 2, 3, 4, 5].map(() => h('div', { style: 'padding:12px 10px' }, xuong(14, '60%'), h('div', { style: 'height:8px' }), xuong(32))));
  const khungDoc = h('div', { class: 'bang doc-tin', 'aria-live': 'polite' });
  const hop = h('div', { class: `hop-tin${t.chon && thamSo ? ' dang-doc' : ''}` }, khungDs, khungDoc);

  const nutLoc = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(t.loc === ma), onclick: () => { t.loc = ma; t.gio = null; veHopTin(goc); } }, nhan);
  const nhanHomNay = t.loc === 'hom-nay' && t.gio != null ? `Hôm nay, ${t.gio}h - ${t.gio + 1}h` : 'Hôm nay';
  const oTim = h('input', { type: 'search', placeholder: 'Tìm người gửi, nhóm, nội dung…', value: t.q, 'aria-label': 'Tìm tin' });
  let hen;
  oTim.addEventListener('input', () => {
    clearTimeout(hen);
    hen = setTimeout(() => { t.q = oTim.value.trim(); napDs(); }, 300);
  });
  thay(goc, 
    h('div', { class: 'thanh-loc' },
      nutLoc('tat-ca', 'Tất cả'), nutLoc('hom-nay', nhanHomNay), nutLoc('chua-xem', 'Chưa xem'), ...Object.entries(NGUON_TIN).map(([ma, n]) => nutLoc(ma, n.ten)),
      h('button', { class: 'chip', type: 'button', onclick: async () => { await api('/api/tin/da-xem-het', { method: 'POST' }); bao('Đã đánh dấu xem hết.'); capNhatDem(0); veHopTin(goc); } }, 'Đánh dấu xem hết'),
      h('label', { class: 'o-tim' }, icon('tim'), oTim),
    ),
    hop,
  );

  async function napDs() {
    const q = new URLSearchParams();
    if (t.loc === 'chua-xem') q.set('chua_xem', '1');
    if (t.loc === 'hom-nay') q.set('hom_nay', '1');
    if (t.loc === 'hom-nay' && t.gio != null) q.set('gio', String(t.gio));
    if (NGUON_TIN[t.loc]) q.set('nguon', t.loc);
    if (t.q) q.set('q', t.q);
    try {
      const { tin } = await api(`/api/tin?${q}`);
      t.ds = tin;
      veDs();
      if (t.chon) docTin(t.chon);
      else if (window.matchMedia('(min-width: 861px)').matches && tin[0]) docTin(tin[0].id);
      else thay(khungDoc, trongDoc());
    } catch (e) {
      thay(khungDs, khungLoi(e, napDs));
    }
  }

  function veDs() {
    if (!t.ds.length) {
      thay(khungDs, h('div', { class: 'trong-trai' }, icon('hop-tin'), h('h3', { text: t.q ? 'Không tìm thấy tin nào' : 'Chưa có tin' }), h('p', { text: t.q ? 'Thử từ khóa khác.' : 'Tin Zalo, thư Gmail và biên bản họp sẽ về đây.' })));
      return;
    }
    thay(khungDs, h('ul', {}, ...t.ds.map((x) => {
      const li = h('li', { class: x.da_xem ? '' : 'chua-xem' },
        h('button', { type: 'button', 'aria-current': String(x.id === t.chon), dataset: { id: x.id }, onclick: () => { location.hash = `hop-tin/${x.id}`; } },
          h('span', { class: `huy-hieu ${x.nguon}` }, iconNguon(x.nguon)),
          h('div', { style: 'min-width:0' },
            h('div', { class: 'dong-1' }, h('strong', { text: tenGuiTin(x) }), h('time', { datetime: x.thoi_diem, text: luc(x.thoi_diem) })),
            dongPhuTin(x) ? h('div', { class: 'noi', text: dongPhuTin(x) }) : null,
            h('p', { text: trichTin(x.trich) }),
            (x.so_tep || x.so_viec) ? h('div', { class: 'the-nho' }, x.so_tep ? h('span', { text: `${x.so_tep} tệp` }) : null, x.so_viec ? h('span', { class: 'viec', text: `${x.so_viec} việc` }) : null) : null,
          ),
        ),
      );
      li._td = () => ({ nhan: `Thao tác với tin của ${x.nguoi_gui || 'người gửi'}`, muc: [
        { nhan: 'Mở tin', lam: () => { location.hash = `hop-tin/${x.id}`; } },
        { nhan: 'Tạo việc từ tin này', lam: () => moNganViec(null, { tieu_de: '', ghi_chu: `Từ ${x.nguoi_gui || ''}: ${trichTin(x.trich)}` }) },
        { nhan: 'Sao chép đoạn trích', lam: () => chepChu(trichTin(x.trich)) },
        { vach: true },
        { nhan: 'Spam nguồn này', nguy: true, lam: () => chanTuTin(x) },
      ] });
      return li;
    })));
  }

  function trongDoc() {
    return h('div', { class: 'trong-trai' }, icon('hop-tin'), h('h3', { text: 'Chọn một tin để đọc' }), h('p', { text: 'Việc AI tách ra từ tin sẽ hiện ngay dưới nội dung.' }));
  }

  async function docTin(id) {
    t.chon = id;
    khungDs.querySelectorAll('button[data-id]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    thay(khungDoc, xuong(14, '30%'), h('div', { style: 'height:16px' }), xuong(34, '70%'), h('div', { style: 'height:20px' }), xuong(160));
    try {
      const { tin, tep, viec, chan } = await api(`/api/tin/${id}`);
      const muc = t.ds.find((x) => x.id === id);
      if (muc && !muc.da_xem) {
        muc.da_xem = 1;
        khungDs.querySelector(`button[data-id="${id}"]`)?.parentElement.classList.remove('chua-xem');
      }
      const spam = nutSpam({
        nguon: tin.nguon,
        tuyChon: chan || [],
        gui: (c) => api('/api/chan', { method: 'POST', body: JSON.stringify({ tin_id: tin.id, loai: c.loai }) }),
        sauKhi: () => { t.chon = null; location.hash = 'hop-tin'; veHopTin(goc); },
      });
      if (!(chan || []).length) spam.nut.hidden = true;
      thay(khungDoc, 
        h('button', { class: 'nut nut-phu nut-nho nut-quay', type: 'button', text: 'Quay lại danh sách', onclick: () => { t.chon = null; location.hash = 'hop-tin'; } }),
        h('div', { class: 'nguon' }, h('span', { class: `huy-hieu ${tin.nguon}` }, iconNguon(tin.nguon)), tin.nguon === 'zalo' ? (tin.nhom ? `Zalo, ${tenNhom(tin.nhom)}` : 'Zalo, tin riêng') : tin.nguon === 'hop' ? 'Cuộc họp' : 'Thư Gmail'),
        h('h2', { text: tin.nguon === 'hop' ? tin.tieu_de || 'Cuộc họp' : tin.tieu_de && tin.nguon === 'gmail' ? tin.tieu_de : tin.nguoi_gui || 'Không rõ người gửi' }),
        h('p', { class: 'meta', text: `${tin.nguon === 'gmail' ? `Từ ${tin.nguoi_gui || 'không rõ'}, ` : ''}${fmt.ngayGio.format(new Date(tin.thoi_diem))}` }),
        tin.nguon === 'hop' ? nutCuocHop(tep) : null,
        h('div', { class: 'than', text: tin.noi_dung || '(Không có nội dung)' }),
        tep.length ? h('div', { class: 'khoi' }, h('h3', { text: tin.nguon === 'hop' ? 'Ghi âm và biên bản' : 'Tệp đính kèm' }), ...tep.map((f) => h('a', { class: 'tep-dinh', href: `/api/tep/${f.id}/tai`, onclick: (ev) => { const k = kieuMo(f); if (k && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); moXemTep(f, k); } } }, icon('tai'), f.ten, h('small', { text: kichThuoc(f.kich_thuoc) })))) : null,
        h('div', { class: 'khoi' },
          h('h3', { text: viec.length ? 'Việc tách từ tin này' : 'Chưa có việc nào từ tin này' }),
          ...viec.map((v) => h('div', { class: 'muc-viec' }, h('span', { class: `nhan-kq ${v.trang_thai === 'xong' ? 'xong' : 'dang_chay'}`, text: v.trang_thai === 'xong' ? 'Xong' : 'Mở' }), h('button', { class: 'ten-viec', type: 'button', text: v.tieu_de, onclick: () => moNganViec(v) }), v.han_ngay ? h('span', { class: 'chip-gio', text: `${ngayHienThi(v.han_ngay)}${v.gio_hen ? ` ${v.gio_hen}` : ''}` }) : h('span'))),
          h('div', { class: 'hang-nut' },
            h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => moNganViec(null, { tieu_de: '', ghi_chu: `Từ ${tin.nguoi_gui || ''}: ${(tin.noi_dung || '').slice(0, 300)}` }) }, icon('cong'), 'Tạo việc từ tin này'),
            spam.nut,
          ),
          spam.khung,
        ),
      );
      lamMoiDem();
    } catch (e) {
      thay(khungDoc, khungLoi(e, () => docTin(id)));
    }
  }

  napDs();
}
