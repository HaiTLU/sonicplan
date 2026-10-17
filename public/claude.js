// Khối "Claude Code" trong ngăn sửa việc: giao việc, xem tiến độ, đọc kết quả, trả lời câu Claude hỏi, duyệt Đạt hoặc Làm lại.
// Khung "Giao Claude": giao một việc hoặc cả dự án; Claude hỏi trước vài câu nếu việc chưa rõ.
// Hàm dựng phần tử và gọi API do app.js truyền vào để không phải nhập vòng.

export const CHU_TRANG_THAI = { cho: 'Đã giao, chờ chạy', dang_lam: 'Claude đang làm', xong: 'Claude đã xong', loi: 'Claude gặp lỗi', hoi: 'Claude hỏi lại' };

let henGio = null;

export function dungKhoiClaude() {
  clearTimeout(henGio);
  henGio = null;
}

// Một câu hỏi: gợi ý bấm chọn và ô tự ghi. Trả { node, lay() }.
function oCauHoi(h, c, i, ma) {
  const id = `${ma}-${i}`;
  const o = h('input', { id, type: 'text', maxlength: '600', placeholder: c.goi_y?.length ? 'Bấm gợi ý hoặc tự ghi' : 'Ghi câu trả lời', autocomplete: 'off' });
  const goiY = (c.goi_y || []).map((g) => {
    const b = h('button', { class: 'chip goi-y', type: 'button', 'aria-pressed': 'false', text: g });
    b.addEventListener('click', () => {
      const bat = b.getAttribute('aria-pressed') !== 'true';
      for (const x of goiY) x.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', String(bat));
      o.value = bat ? g : '';
    });
    return b;
  });
  o.addEventListener('input', () => { for (const x of goiY) x.setAttribute('aria-pressed', String(x.textContent === o.value)); });
  return {
    node: h('div', { class: 'cau-hoi-claude' },
      h('label', { for: id, class: 'hoi', text: `${i + 1}. ${c.hoi}` }),
      goiY.length ? h('div', { class: 'hang-goi-y', role: 'group', 'aria-label': `Gợi ý cho câu ${i + 1}` }, ...goiY) : null,
      o),
    lay: () => ({ hoi: c.hoi, tra_loi: o.value.trim() }),
  };
}

// Chỗ để tệp của một lượt: thư mục trong ThangLong_KB, đã về Drive chưa (chỉ khi PR đã gộp vào main), và nút mở thư mục Drive của dự án.
function duongTepLuot(h, l) {
  if (!l.thu_muc_lam && !l.drive_duong_dan) return null;
  const drive = l.drive_duong_dan;
  const duong = drive && drive.startsWith('Sonicplan Claude') ? drive : `Thư mục AI/ThangLong_KB/${l.thu_muc_lam}`;
  const doan = [h('strong', { text: drive ? 'Tệp đã về Drive: ' : 'Tệp ở ThangLong_KB: ' }), h('code', { text: drive ? duong : l.thu_muc_lam })];
  if (!drive && l.trang_thai === 'xong') doan.push(h('span', { class: 'phu', text: l.pr ? ' (PR chưa gộp vào main nên chưa về Drive)' : ' (chưa đẩy lên GitHub)' }));
  if (l.drive_link) doan.push(' ', h('a', { href: l.drive_link, target: '_blank', rel: 'noopener', text: 'Mở thư mục Drive của dự án' }));
  return h('p', { class: 'duong-tep' }, ...doan);
}

// Khung giao Claude. viec: mảng việc đang mở; duAn: tên dự án khi giao cả cột.
export function moKhungGiaoClaude(viec, { h, api, bao, icon, duAn = null, danSan = '', tiepLuot = null, sauKhiGiao = () => {} }) {
  const nhieu = viec.length > 1;
  const chon = new Set(viec.map((v) => v.id));
  let cach = 'gop';
  let cauHoi = [];
  const hop = h('dialog', { class: 'khung-claude', 'aria-labelledby': 'kc-tieu-de' });
  const dong = () => hop.close();
  hop.addEventListener('close', () => hop.remove());
  hop.addEventListener('click', (e) => { if (e.target === hop) dong(); });

  const chuNut = h('span', { text: 'Giao Claude' });
  const nutGiao = h('button', { class: 'nut nut-chinh', type: 'submit' }, icon('ai'), chuNut);
  const capNhatNut = () => {
    const so = chon.size;
    nutGiao.disabled = !so;
    chuNut.textContent = !nhieu ? 'Giao Claude' : cach === 'gop' ? `Giao ${so} việc, một lượt` : `Giao ${so} việc, ${so} lượt`;
  };

  const dsViec = nhieu
    ? h('fieldset', { class: 'kc-nhom' },
      h('legend', { text: `Việc giao (${viec.length})` }),
      h('ul', { class: 'kc-ds-viec' }, ...viec.map((v) => h('li', {}, h('label', {},
        h('input', { type: 'checkbox', checked: '', onchange: (e) => { if (e.target.checked) chon.add(v.id); else chon.delete(v.id); capNhatNut(); veTep(); } }),
        h('span', { text: v.tieu_de }))))))
    : h('p', { class: 'kc-viec', text: viec[0].tieu_de });

  const cachLam = nhieu
    ? h('fieldset', { class: 'kc-nhom kc-cach' },
      h('legend', { text: 'Cách làm' }),
      ...[['gop', 'Gộp một lượt (nên dùng)', 'Claude đọc chung các việc nên hiểu bối cảnh cả dự án.'], ['tung_viec', 'Từng việc một', 'Mỗi việc một lượt riêng, tốn nhiều lượt hơn.']]
        .map(([ma, ten, mo]) => h('label', { class: 'kc-chon-cach' },
          h('input', { type: 'radio', name: 'kc-cach', value: ma, ...(ma === 'gop' ? { checked: '' } : {}), onchange: () => { cach = ma; capNhatNut(); } }),
          h('span', {}, h('strong', { text: ten }), h('small', { text: mo })))))
    : null;

  // Tệp đi kèm: tệp tự tìm được quanh các việc (bỏ chọn được) và tệp tự thêm (gửi lên khi bấm Giao).
  let tepTuDong = [];
  const boChon = new Set();
  const tepThem = [];
  const kb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((b || 0) / 1024))} KB`);
  const dsTep = h('ul', { class: 'kc-ds-tep' });
  const oChonTep = h('input', { type: 'file', multiple: true, hidden: '', onchange: () => {
    for (const f of oChonTep.files) {
      if (tepThem.length >= 10) { bao('Mỗi lần thêm tối đa 10 tệp.', { loi: true }); break; }
      if (f.size > 25 * 1024 * 1024) { bao(`${f.name} lớn quá 25 MB.`, { loi: true }); continue; }
      tepThem.push(f);
    }
    oChonTep.value = '';
    veTep();
  } });
  const veTep = () => {
    const hien = tepTuDong.filter((t) => chon.has(t.viec_id));
    const tenViec = new Map(viec.map((v) => [v.id, v.tieu_de]));
    const dong = [
      ...hien.map((t) => h('li', {}, h('label', {},
        h('input', { type: 'checkbox', ...(boChon.has(t.id) ? {} : { checked: '' }), onchange: (e) => { if (e.target.checked) boChon.delete(t.id); else boChon.add(t.id); } }),
        h('span', {}, h('strong', { text: t.ten }), h('small', { text: ` ${kb(t.kich_thuoc)}${nhieu ? ` · ${tenViec.get(t.viec_id) || ''}` : ''} · ${t.ghi_am ? 'ghi âm: mở bằng SonicRec, Claude không chuyển chữ được' : t.luong === 'doanh_nghiep' ? 'thư luồng Kết nối doanh nghiệp, bỏ sẵn' : t.luong === 'chung' ? 'thông tin chung của Trường' : t.luong === 'dao_tao' ? 'thư luồng Đào tạo ngắn hạn' : 'có sẵn trong tin'}` }))))),
      ...tepThem.map((f, i) => h('li', { class: 'kc-tep-them' },
        h('span', {}, h('strong', { text: f.name }), h('small', { text: ` ${kb(f.size)} · bạn thêm` })),
        h('button', { class: 'nut-icon', type: 'button', 'aria-label': `Bỏ ${f.name}`, onclick: () => { tepThem.splice(i, 1); veTep(); } }, '×'))),
    ];
    dsTep.replaceChildren(...(dong.length ? dong : [h('li', { class: 'kc-tep-trong', text: 'Chưa có tệp nào kèm theo. Thêm tệp nếu Claude cần xem.' })]));
  };
  const khungTep = h('fieldset', { class: 'kc-nhom kc-tep' },
    h('legend', { text: 'Tệp đi kèm' }),
    dsTep,
    h('div', { class: 'kc-tep-nut' }, h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => oChonTep.click() }, icon('cong'), 'Thêm tệp'), oChonTep));
  api(`/api/claude/dinh-kem?viec_ids=${viec.map((v) => v.id).join(',')}`).then((r) => { tepTuDong = r.tep || []; for (const t of tepTuDong) if (t.bo_san) boChon.add(t.id); veTep(); }).catch(() => {});
  veTep();

  const vungHoi = h('section', { class: 'kc-hoi', 'aria-live': 'polite', 'aria-busy': 'true' },
    h('p', { class: 'kc-dang-doc' }, h('span', { class: 'cham-quay', 'aria-hidden': 'true' }), 'Claude đang đọc việc xem có cần hỏi gì thêm…'));
  const oDan = h('textarea', { id: 'kc-dan', rows: '3', maxlength: '4000', 'aria-label': 'Dặn thêm Claude', placeholder: 'Ví dụ: soạn email trả lời, giọng lịch sự, dưới 200 chữ' });
  oDan.value = danSan;
  const dan = h('details', { class: 'kc-dan', ...(danSan ? { open: '' } : {}) }, h('summary', { text: 'Dặn thêm Claude (không bắt buộc)' }), oDan);

  const form = h('form', { method: 'dialog' },
    h('header', { class: 'kc-dau' },
      h('h2', { id: 'kc-tieu-de' }, icon('ai'), h('span', { text: duAn ? `Giao Claude cả dự án ${duAn}` : 'Giao Claude' })),
      h('button', { class: 'nut-dong', type: 'button', 'aria-label': 'Đóng', onclick: dong }, '×')),
    h('div', { class: 'kc-than' },
      dsViec, cachLam, khungTep, vungHoi, dan,
      h('p', { class: 'kc-ghi', text: 'Câu nào bỏ trống, Claude tự chọn cách hợp lý. Claude chỉ soạn nháp, không tự gửi gì ra ngoài.' })),
    h('footer', { class: 'kc-chan' }, h('button', { class: 'nut nut-phu', type: 'button', onclick: dong }, 'Hủy'), nutGiao),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    nutGiao.disabled = true;
    const so = chon.size;
    try {
      let tepThemIds = [];
      if (tepThem.length) {
        const fd = new FormData();
        for (const f of tepThem) fd.append('tep', f, f.name);
        tepThemIds = (await api('/api/claude/dinh-kem', { method: 'POST', body: fd })).tep.map((t) => t.id);
      }
      const kq = await api('/api/claude/giao', { method: 'POST', body: JSON.stringify({ viec_ids: [...chon], cach, dan: oDan.value, tra_loi: cauHoi.map((c) => c.lay()), tep_them: tepThemIds, tep_bo: [...boChon], tep_da_chon: true, ...(tiepLuot ? { tiep_luot: tiepLuot } : {}) }) });
      if (kq.loi_mot_phan) bao(`Giao được ${kq.cac_luot.length} lượt, lượt sau gặp lỗi: ${kq.loi_mot_phan}`, { loi: true });
      else bao(so > 1 ? `Đã giao ${so} việc cho Claude${cach === 'gop' ? ' trong một lượt' : ''}. Kết quả hiện ở từng việc.` : 'Đã giao cho Claude. Kết quả sẽ hiện trong việc.');
      dong();
      sauKhiGiao();
    } catch (err) {
      bao(err.message, { loi: true });
      capNhatNut();
    }
  });
  hop.append(form);
  document.body.append(hop);
  capNhatNut();
  hop.showModal();
  nutGiao.focus();

  api('/api/claude/hoi-truoc', { method: 'POST', body: JSON.stringify({ viec_ids: [...chon] }) })
    .then((r) => r.cau_hoi || [])
    .catch(() => [])
    .then((ds) => {
      if (!hop.isConnected) return;
      cauHoi = ds.map((c, i) => oCauHoi(h, c, i, 'kc'));
      vungHoi.setAttribute('aria-busy', 'false');
      vungHoi.replaceChildren(...(cauHoi.length
        ? [h('h3', { text: 'Claude muốn hỏi trước để làm đúng ý bạn' }), ...cauHoi.map((c) => c.node)]
        : [h('p', { class: 'kc-du-ro', text: 'Việc đã đủ rõ, Claude không cần hỏi thêm.' })]));
    });
  return hop;
}

export async function veKhoiClaude(goc, v, { h, api, bao, luc, icon, sauKhiDat }) {
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
  const ve = () => veKhoiClaude(goc, v, { h, api, bao, luc, icon, sauKhiDat });
  const moi = du.luot[0];
  const dangChay = moi && (moi.trang_thai === 'cho' || moi.trang_thai === 'dang_lam');

  goc.append(h('h3', { text: 'Claude Code' }));
  if (!du.da_noi) {
    goc.append(h('p', { class: 'mo-ta' }, 'Nối GitHub ở ', h('a', { href: '#ket-noi', text: 'trang Kết nối' }), ' để giao việc này cho Claude làm.'));
    return;
  }
  const moKhung = (danSan = '', tiepLuot = null) => moKhungGiaoClaude([v], { h, api, bao, icon, danSan, tiepLuot, sauKhiGiao: ve });
  const hoiLai = moi?.cau_hoi && moi.trang_thai === 'xong' && !moi.danh_gia;

  if (moi) {
    const the = h('div', { class: `luot-claude ${hoiLai ? 'hoi' : moi.trang_thai}`, role: 'status', 'aria-live': 'polite' },
      h('p', { class: 'trang-thai-luot' }, h('strong', { text: CHU_TRANG_THAI[hoiLai ? 'hoi' : moi.trang_thai] }), h('span', { text: ` · cập nhật ${luc(moi.cap_nhat_luc)}` })),
      moi.so_viec_gop > 1 ? h('p', { class: 'dan', text: `Làm chung một lượt với ${moi.so_viec_gop - 1} việc khác trong dự án.` }) : null,
      moi.dan ? h('p', { class: 'dan', text: `Bạn dặn: ${moi.dan}` }) : null,
      moi.ket_qua ? h('div', { class: 'ket-qua', tabindex: '0', 'aria-label': 'Kết quả Claude', text: moi.ket_qua }) : null,
      duongTepLuot(h, moi),
      h('p', { class: 'lien-ket-luot' },
        moi.pr ? h('a', { href: moi.pr, target: '_blank', rel: 'noopener', text: 'Xem PR' }) : null,
        moi.nhanh ? h('a', { href: moi.nhanh, target: '_blank', rel: 'noopener', text: 'Xem tệp' }) : null,
        moi.nhat_ky ? h('a', { href: moi.nhat_ky, target: '_blank', rel: 'noopener', text: 'Xem nhật ký' }) : null,
      ),
    );
    if (moi.trang_thai === 'xong' && !moi.danh_gia && !hoiLai) {
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
          moKhung('Lần trước chưa đạt vì: ', moi.id);
        } }, 'Làm lại'),
      ));
    }
    goc.append(the);
  }

  if (dangChay) {
    // Đang chạy: hỏi lại mỗi 8 giây cho tới khi xong hoặc ngăn đóng.
    henGio = setTimeout(() => { if (!goc.hidden && goc.isConnected && goc.closest('dialog')?.open) ve(); }, 8000);
    return;
  }
  if (hoiLai) {
    // Claude hỏi lại sau khi làm: trả lời ngay tại đây, Claude làm tiếp từ kết quả lần trước.
    const cauHoi = moi.cau_hoi.map((c, i) => oCauHoi(h, { hoi: c }, i, `kh-${moi.id}`));
    const nut = h('button', { class: 'nut nut-chinh', type: 'button' }, 'Trả lời, Claude làm tiếp');
    nut.addEventListener('click', async () => {
      const traLoi = cauHoi.map((c) => c.lay());
      if (!traLoi.some((x) => x.tra_loi)) { bao('Trả lời ít nhất một câu.', { loi: true }); cauHoi[0].node.querySelector('input').focus(); return; }
      nut.disabled = true;
      try {
        await api(`/api/viec/${v.id}/claude`, { method: 'POST', body: JSON.stringify({ tra_loi: traLoi, tiep_luot: moi.id }) });
        bao('Đã gửi câu trả lời, Claude làm tiếp.');
        ve();
      } catch (e) { bao(e.message, { loi: true }); nut.disabled = false; }
    });
    goc.append(h('div', { class: 'claude-hoi-lai' },
      h('h4', { text: 'Claude cần bạn trả lời' }),
      ...cauHoi.map((c) => c.node),
      h('div', { class: 'hang-nut' }, nut, h('button', { class: 'nut nut-phu', type: 'button', onclick: () => moKhung() }, 'Giao lại từ đầu'))));
    return;
  }
  goc.append(h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-chinh', type: 'button', onclick: () => moKhung() }, icon('ai'), moi ? 'Giao lại' : 'Giao Claude')));
}
