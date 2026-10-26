// Giao diện Viện Hòa Lạc: bảng Kanban (kéo-thả đổi trạng thái) và lịch Gantt rút gọn (thanh theo CPM).
import { api, bao, h, khungLoi, thay } from './chung.js';

const CAC_TRANG_THAI = [
  { ma: 'chua_lam', ten: 'Chưa làm' },
  { ma: 'dang_lam', ten: 'Đang làm' },
  { ma: 'xong', ten: 'Xong' },
  { ma: 'tam_dung', ten: 'Tạm dừng' },
];

async function chinh() {
  const goc = document.getElementById('goc');
  let toi;
  try {
    toi = await api('/api/toi');
  } catch (e) {
    thay(goc, khungLoi(e));
    return;
  }
  document.getElementById('ten-to-chuc').textContent = toi.to_chuc.ten;
  const chiXem = toi.to_chuc.vai_tro === 'doi_tac';
  document.getElementById('tieu-de').textContent = `Quản lý dự án${chiXem ? ' (chỉ xem phần được giao)' : ''}`;

  const tabKanban = document.getElementById('tab-kanban');
  const tabGantt = document.getElementById('tab-gantt');
  const moKanban = () => taiVaVe(goc, chiXem, 'kanban');
  const moGantt = () => taiVaVe(goc, chiXem, 'gantt');
  tabKanban.onclick = () => { chonTab(tabKanban, tabGantt); moKanban(); };
  tabGantt.onclick = () => { chonTab(tabGantt, tabKanban); moGantt(); };
  await moKanban();
}

function chonTab(chon, bo) {
  chon.setAttribute('aria-current', 'true');
  bo.removeAttribute('aria-current');
}

async function taiVaVe(goc, chiXem, cheDo) {
  try {
    const { hang_muc } = await api('/api/hoalac/hang-muc');
    thay(goc, cheDo === 'kanban' ? veKanban(hang_muc, chiXem) : veGantt(hang_muc));
  } catch (e) {
    thay(goc, khungLoi(e));
  }
}

function veKanban(hangMuc, chiXem) {
  const cot = CAC_TRANG_THAI.map(({ ma, ten }) => {
    const ds = hangMuc.filter((x) => x.trang_thai === ma);
    const cotEl = h('div', { class: 'cot-kanban', dataset: { trangThai: ma } },
      h('h3', {}, `${ten} (${ds.length})`),
      ...ds.map((x) => theKanban(x, chiXem)),
    );
    if (!chiXem) {
      cotEl.addEventListener('dragover', (e) => e.preventDefault());
      cotEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        const id = Number(e.dataTransfer.getData('text/plain'));
        if (!id) return;
        try {
          await api(`/api/hoalac/hang-muc/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: ma }) });
          await taiVaVe(document.getElementById('goc'), chiXem, 'kanban');
        } catch (err) {
          bao(err.message, true);
        }
      });
    }
    return cotEl;
  });
  return h('div', { class: 'bang-kanban' }, ...cot);
}

function theKanban(x, chiXem) {
  const the = h('div', { class: `the-kanban${x.tren_duong_gang ? ' tren-gang' : ''}`, draggable: chiXem ? null : 'true' },
    h('strong', { text: x.ten }),
    x.phu_trach ? h('div', { class: 'phu-trach', text: x.phu_trach }) : null,
    h('div', { class: 'tien-do' }, h('div', { class: 'tien-do-trong', style: `width:${x.tien_do_pt || 0}%` })),
  );
  if (!chiXem) the.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(x.id)));
  return the;
}

function veGantt(hangMuc) {
  const coNgay = hangMuc.filter((x) => x.som_bd != null);
  if (!coNgay.length) return h('p', { class: 'trong' }, 'Chưa có hạng mục nào tính được ngày (cần đặt thời gian và phụ thuộc).');
  const toiDa = Math.max(1, ...coNgay.map((x) => x.som_kt));
  const hang = coNgay.map((x) => h('div', { class: 'hang-gantt' },
    h('div', { class: 'ten-gantt', text: x.ten }),
    h('div', { class: 'truc-gantt' },
      h('div', {
        class: `thanh-gantt${x.tren_duong_gang ? ' tren-gang' : ''}`,
        style: `left:${(x.som_bd / toiDa) * 100}%;width:${Math.max(((x.som_kt - x.som_bd) / toiDa) * 100, 1)}%`,
        title: `Sớm nhất ${x.som_bd}-${x.som_kt}, muộn nhất ${x.muon_bd}-${x.muon_kt}, dư trước ${x.du_truoc_ngay} ngày`,
      }),
    ),
  ));
  return h('div', { class: 'bang-gantt' }, h('p', { class: 'ghi-chu' }, 'Số ngày tính từ ngày khởi công dự án (ngày 0). Thanh đỏ: nằm trên đường gang (CPM), chậm là trễ cả dự án.'), ...hang);
}

chinh();
