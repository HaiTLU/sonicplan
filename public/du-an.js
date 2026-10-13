// Trang Dự án: danh sách dự án (thêm, sửa từ khóa, gỡ) và dòng thời gian lịch sử từng dự án.

const LOAI = {
  tao: { nhan: 'Thêm việc', icon: 'cong' },
  tien_do: { nhan: 'Tiến độ', icon: 'thu' },
  xong: { nhan: 'Xong việc', icon: 'viec' },
  mo_lai: { nhan: 'Mở lại việc', icon: 'viec' },
  huy: { nhan: 'Hủy việc', icon: 'dong' },
  doi_du_an: { nhan: 'Đổi dự án', icon: 'du-an' },
};

import { hexMau, oChonMau } from './mau.js';

export async function veDuAn(goc, thamSo, t) {
  const { h, icon, api, bao, thay, khungLoi, xuong } = t;
  const id = Number(thamSo) || 0;
  thay(goc, h('div', { class: 'bang' }, xuong(20, '30%'), h('div', { style: 'height:10px' }), xuong(60)));
  try {
    if (id) await veChiTiet(goc, id, t);
    else await veDanhSach(goc, t);
  } catch (e) {
    thay(goc, khungLoi(e, () => veDuAn(goc, thamSo, t)));
  }
}

async function veDanhSach(goc, t) {
  const { h, icon, api, bao, thay } = t;
  const { du_an: ds } = await api('/api/du-an');
  const oTen = h('input', { name: 'ten', placeholder: 'Tên dự án mới…', maxlength: '60', 'aria-label': 'Tên dự án', autocomplete: 'off' });
  const oKhoa = h('input', { name: 'tu_khoa', placeholder: 'Từ khóa, cách nhau bằng dấu phẩy', 'aria-label': 'Từ khóa', autocomplete: 'off' });
  // "Lưu tệp ở": mặc định tự tạo thư mục trong Sonicplan kho; hoặc dán link thư mục Drive có sẵn (chỉ để mở).
  const oLuuO = h('select', { name: 'luu_o', 'aria-label': 'Lưu tệp ở' },
    h('option', { value: 'kho', text: 'Lưu tệp ở: tự tạo trong Sonicplan kho (khuyến nghị)' }),
    h('option', { value: 'link', text: 'Lưu tệp ở: thư mục Drive có sẵn (chỉ để mở)' }),
    h('option', { value: 'khong', text: 'Lưu tệp ở: chưa chọn' }));
  const oLink = h('input', { name: 'drive_link', placeholder: 'Dán link thư mục Drive', 'aria-label': 'Link thư mục Drive', autocomplete: 'off', hidden: true });
  const ghiLuuO = h('p', { class: 'ghi-chu-trang' });
  const veGhi = () => {
    oLink.hidden = oLuuO.value !== 'link';
    ghiLuuO.textContent = oLuuO.value === 'kho' ? `Sẽ tạo "Sonicplan kho/Dự án/${oTen.value.trim() || '<tên dự án>'}" gồm Thu, Zalo, Tep, Media, Claude, Chat, Lich, LichSu và tự lưu mọi thứ của dự án vào đó.`
      : oLuuO.value === 'link' ? 'Hệ thống chỉ mở được thư mục này, không tự ghi vào. Muốn tự lưu thì chọn tự tạo.' : 'Có thể bật sau bằng nút "Lưu dự án vào Drive".';
  };
  oLuuO.addEventListener('change', veGhi); oTen.addEventListener('input', veGhi); veGhi();
  const form = h('form', { class: 'bang them-nhanh' }, oTen, oKhoa, oLuuO, oLink, h('button', { class: 'nut nut-chinh', type: 'submit' }, icon('cong'), 'Thêm dự án'), ghiLuuO);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!oTen.value.trim()) { oTen.focus(); bao('Nhập tên dự án trước đã.', { loi: true }); return; }
    try {
      const r = await api('/api/du-an', { method: 'POST', body: JSON.stringify({ ten: oTen.value, tu_khoa: oKhoa.value, luu_o: oLuuO.value, ...(oLuuO.value === 'link' && oLink.value.trim() ? { drive_link: oLink.value.trim() } : {}) }) });
      if (r.drive_loi) bao(`Đã thêm dự án. ${r.drive_loi}`, { loi: true });
      else bao(r.drive_kho_id ? 'Đã thêm dự án và tạo thư mục Drive.' : 'Đã thêm dự án.');
      veDanhSach(goc, t);
    } catch (err) { bao(err.message, { loi: true }); }
  });
  // Danh sách thư mục con của dự án, nạp khi mở: tên, mô tả, đường dẫn và nút mở trên Drive.
  const noiLuuTep = (d) => {
    const khung = h('div', { class: 'noi-luu-tep' }, h('p', { class: 'ghi-chu-trang', text: 'Đang tải…' }));
    const chiTiet = h('details', { class: 'noi-luu' }, h('summary', { text: 'Nơi lưu tệp của dự án' }), khung);
    let daNap = false;
    chiTiet.addEventListener('toggle', async () => {
      if (!chiTiet.open || daNap) return;
      daNap = true;
      try {
        const r = await api(`/api/du-an/${d.id}/thu-muc`);
        thay(khung,
          r.goc ? h('p', { class: 'ghi-chu-trang' }, 'Thư mục gốc: ', h('code', { text: r.goc.duong_dan }), ' ', h('a', { href: r.goc.link, target: '_blank', rel: 'noopener noreferrer', text: 'Mở trên Drive' })) : null,
          h('ul', { class: 'ds-noi-luu' }, ...r.thu_muc.map((m) => h('li', {},
            icon('tep'),
            h('div', {}, h('b', { text: m.nhan }), h('small', { text: m.mo_ta }), h('code', { text: m.duong_dan })),
            m.link ? h('a', { class: 'nut nut-phu nut-nho', href: m.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Mở thư mục ${m.nhan} trên Drive` }, 'Mở') : h('span', { class: 'chip-gio', text: 'Tạo ở lần lưu kế' })))),
        );
      } catch (err) { daNap = false; thay(khung, h('p', { class: 'ghi-chu-trang', text: err.message })); }
    });
    return chiTiet;
  };
  const the = (d) => {
    const khoa = h('input', { value: d.tu_khoa.join(', '), 'aria-label': `Từ khóa của ${d.ten}`, placeholder: 'Từ khóa, cách nhau bằng dấu phẩy' });
    const ten = h('input', { value: d.ten, maxlength: '60', 'aria-label': 'Tên dự án' });
    const driveLink = h('input', { value: d.drive_link || '', maxlength: '300', 'aria-label': `Link thư mục Drive của ${d.ten}`, placeholder: 'Link thư mục Drive (để bấm mở)', autocomplete: 'off' });
    const driveDuong = h('input', { value: d.drive_duong_dan || '', maxlength: '200', 'aria-label': `Đường dẫn trong Drive của ${d.ten}`, placeholder: 'Đường dẫn trong Drive, ví dụ 01_Projects/IPSOS', autocomplete: 'off' });
    let mau = d.mau || null;
    const luu = h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => {
      try { await api(`/api/du-an/${d.id}`, { method: 'PATCH', body: JSON.stringify({ ten: ten.value, tu_khoa: khoa.value, mau, drive_link: driveLink.value, drive_duong_dan: driveDuong.value }) }); bao('Đã lưu.'); veDanhSach(goc, t); } catch (err) { bao(err.message, { loi: true }); }
    } }, 'Lưu');
    const go = h('button', { class: 'nut nut-nguy', type: 'button', onclick: async () => {
      if (!confirm(`Gỡ dự án "${d.ten}"? Các việc vẫn còn, chỉ mất nhãn dự án.`)) return;
      try { await api(`/api/du-an/${d.id}`, { method: 'DELETE' }); bao('Đã gỡ dự án.'); veDanhSach(goc, t); } catch (err) { bao(err.message, { loi: true }); }
    } }, 'Gỡ');
    const linkDrive = d.drive_link ? h('a', { class: 'nut nut-phu', href: d.drive_link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Mở thư mục Drive của ${d.ten}` }, icon('tep'), 'Thư mục Drive') : null;
    const hangDrive = h('div', { class: 'hang-nut hang-drive' },
      d.drive_kho_id
        ? [h('span', { class: 'chip-gio', title: 'Thư, tin Zalo, tệp, kết quả Claude, lịch và lịch sử của dự án tự lưu vào thư mục Drive này', text: 'Đang lưu vào Drive' }),
          h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => t.driveDuAn(d, 'dong-bo') }, 'Đồng bộ lại toàn bộ'),
          h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => t.driveDuAn(d, 'tat') }, 'Tắt')]
        : h('button', { class: 'nut nut-phu nut-nho', type: 'button', title: 'Tự tạo thư mục Drive cho dự án và lưu mọi thứ của dự án vào đó', onclick: () => t.driveDuAn(d, 'bat') }, icon('tep'), 'Lưu dự án vào Drive'),
    );
    const li = h('li', { class: 'the-du-an' },
      h('a', { class: 'ten-du-an', href: `#du-an/${d.id}`, ...(hexMau(d.mau) ? { style: `--mau:${hexMau(d.mau)}` } : {}) }, hexMau(d.mau) ? h('i', { class: 'cham-mau lon' }) : icon('du-an'), h('b', { text: d.ten }), h('span', { text: `${d.dang_mo} đang mở, ${d.da_xong} đã xong` })),
      linkDrive,
      hangDrive,
      d.drive_kho_id ? noiLuuTep(d) : null,
      h('details', {}, h('summary', { text: 'Sửa tên, màu, từ khóa và thư mục Drive' }), h('div', { class: 'sua-du-an' }, ten, khoa, driveLink, driveDuong, oChonMau(h, mau, (m) => { mau = m; }, { nhan: `Màu của ${d.ten}` }), luu, go)),
    );
    li._td = () => ({ nhan: `Thao tác với dự án ${d.ten}`, muc: t.mucDuAn(d) });
    return li;
  };
  thay(goc, form,
    ds.length ? h('ul', { class: 'ds-du-an' }, ...ds.map(the)) : h('p', { class: 'cot-trong', text: 'Chưa có dự án. Thêm dự án đầu tiên ở trên.' }),
    h('p', { class: 'ghi-chu-trang', text: 'AI xếp việc mới vào dự án theo tên nhóm, người gửi và nội dung. Từ khóa giúp xếp đúng hơn. Bạn đổi dự án của một việc ở ngăn sửa việc.' }));
}

function ngayNhom(iso) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}
function gio(iso) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

async function veChiTiet(goc, id, t) {
  const { h, icon, api, thay } = t;
  const r = await api(`/api/du-an/${id}/lich-su`);
  const theo = [];
  for (const e of r.su_kien) {
    const ngay = ngayNhom(e.luc);
    if (!theo.length || theo[theo.length - 1].ngay !== ngay) theo.push({ ngay, ds: [] });
    theo[theo.length - 1].ds.push(e);
  }
  const dong = (e) => {
    const l = LOAI[e.loai] || { nhan: e.loai, icon: 'viec' };
    return h('li', { class: `su-kien ${e.loai}` },
      h('span', { class: 'moc' }, icon(l.icon)),
      h('div', {},
        h('p', {}, h('b', { text: l.nhan }), ' ', h('span', { class: 'gio', text: gio(e.luc) })),
        h('p', { class: 'viec-sk', text: e.tieu_de }),
        e.noi_dung && e.noi_dung !== e.tieu_de ? h('p', { class: 'nd-sk', text: e.noi_dung }) : null,
      ));
  };
  thay(goc, h('div', { class: 'chi-tiet-du-an' },
    h('a', { class: 'nut nut-phu', href: '#du-an' }, 'Tất cả dự án'),
    h('section', { class: 'bang khoi-du-an' },
      h('div', { class: 'bang-dau' }, h('h2', { text: r.du_an.ten }), h('span', { class: 'chip-gio', text: `${r.dang_mo} đang mở, ${r.da_xong} đã xong` })),
      r.du_an.tu_khoa.length ? h('p', { class: 'ghi-chu-trang', text: `Từ khóa: ${r.du_an.tu_khoa.join(', ')}` }) : null,
    ),
    r.tep.length ? h('section', { class: 'bang khoi-du-an' }, h('h3', { text: `Tệp liên quan (${r.tep.length})` }),
      h('ul', { class: 'tep-du-an' }, ...r.tep.map((f) => h('li', {}, icon('tep'), h('span', { text: f.ten }))))) : null,
    h('section', { class: 'bang khoi-du-an' }, h('h3', { text: 'Lịch sử dự án' }),
      theo.length
        ? h('div', { class: 'dong-thoi-gian' }, ...theo.map((n) => h('div', { class: 'ngay-tg' }, h('h4', { text: n.ngay }), h('ul', {}, ...n.ds.map(dong)))))
        : h('p', { class: 'cot-trong', text: 'Chưa có việc nào trong dự án này. Gắn dự án cho việc ở ngăn sửa việc, hoặc để AI tự xếp.' })),
  ));
}
