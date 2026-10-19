// Khối "Prompt cho Claude" trong ngăn sửa việc, và khung "Soạn prompt".
// Thợ Claude không làm việc trực tiếp trong Sonicplan (PM dặn 19/10/2026): chỉ soạn một prompt đầy đủ để bấm "Copy prompt" rồi dán sang Claude khác.
// Chỉ soạn khi bấm nút, mỗi lần bấm một lần gọi AI; prompt đã soạn lưu lại để copy lại, không gọi AI nữa.
// Hàm dựng phần tử và gọi API do app.js truyền vào để không phải nhập vòng.

// Sao chép vào bộ nhớ tạm; trình duyệt chặn clipboard thì chọn sẵn chữ để bấm Ctrl+C.
export async function saoChepPrompt(o) {
  try {
    await navigator.clipboard.writeText(o.value);
    return true;
  } catch {
    o.focus();
    o.select();
    try { return document.execCommand('copy'); } catch { return false; }
  }
}

// Ô hiện prompt và nút Copy prompt.
function oPrompt(h, bao, icon, noiDung, { cao = '16' } = {}) {
  const o = h('textarea', { class: 'prompt-claude', rows: cao, readonly: '', 'aria-label': 'Prompt cho Claude' });
  o.value = noiDung;
  const chu = h('span', { text: 'Copy prompt' });
  const nut = h('button', { class: 'nut nut-chinh', type: 'button' }, icon('sao-chep'), chu);
  nut.addEventListener('click', async () => {
    const ok = await saoChepPrompt(o);
    chu.textContent = ok ? 'Đã copy' : 'Chưa copy được, bấm Ctrl+C';
    if (ok) bao('Đã copy prompt. Dán sang Claude khác để xử lý.');
    setTimeout(() => { chu.textContent = 'Copy prompt'; }, 2500);
  });
  return { o, nut };
}

// Khung soạn prompt. viec: mảng việc đang mở; duAn: tên dự án khi soạn cho cả cột.
export function moKhungSoanPrompt(viec, { h, api, bao, icon, duAn = null, danSan = '', sauKhiSoan = () => {} }) {
  const nhieu = viec.length > 1;
  const chon = new Set(viec.map((v) => v.id));
  const hop = h('dialog', { class: 'khung-claude', 'aria-labelledby': 'kc-tieu-de' });
  const dong = () => hop.close();
  hop.addEventListener('close', () => hop.remove());
  hop.addEventListener('click', (e) => { if (e.target === hop) dong(); });

  const chuNut = h('span', { text: 'Soạn prompt' });
  const nutSoan = h('button', { class: 'nut nut-chinh', type: 'submit' }, icon('ai'), chuNut);
  const capNhatNut = () => {
    nutSoan.disabled = !chon.size;
    chuNut.textContent = nhieu ? `Soạn prompt cho ${chon.size} việc` : 'Soạn prompt';
  };

  const dsViec = nhieu
    ? h('fieldset', { class: 'kc-nhom' },
      h('legend', { text: `Việc đưa vào prompt (${viec.length})` }),
      h('ul', { class: 'kc-ds-viec' }, ...viec.map((v) => h('li', {}, h('label', {},
        h('input', { type: 'checkbox', checked: '', onchange: (e) => { if (e.target.checked) chon.add(v.id); else chon.delete(v.id); capNhatNut(); veTep(); } }),
        h('span', { text: v.tieu_de }))))))
    : h('p', { class: 'kc-viec', text: viec[0].tieu_de });

  // Tệp đi kèm: tệp tự tìm được quanh các việc (bỏ chọn được) và tệp tự thêm (gửi lên khi bấm Soạn prompt).
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

  const oDan = h('textarea', { id: 'kc-dan', rows: '3', maxlength: '2000', 'aria-label': 'Dặn thêm cho prompt', placeholder: 'Ví dụ: soạn email trả lời, giọng lịch sự, dưới 200 chữ' });
  oDan.value = danSan;
  const dan = h('details', { class: 'kc-dan', ...(danSan ? { open: '' } : {}) }, h('summary', { text: 'Dặn thêm (không bắt buộc)' }), oDan);

  const than = h('div', { class: 'kc-than' },
    dsViec, khungTep, dan,
    h('p', { class: 'kc-ghi', text: 'Bấm Soạn prompt mới gọi AI, một lần. Sonicplan không tự làm việc và không gửi gì ra ngoài; bạn dán prompt sang Claude khác để xử lý.' }));
  const chan = h('footer', { class: 'kc-chan' }, h('button', { class: 'nut nut-phu', type: 'button', onclick: dong }, 'Hủy'), nutSoan);
  const form = h('form', { method: 'dialog' },
    h('header', { class: 'kc-dau' },
      h('h2', { id: 'kc-tieu-de' }, icon('ai'), h('span', { text: duAn ? `Soạn prompt cho cả dự án ${duAn}` : 'Soạn prompt cho Claude' })),
      h('button', { class: 'nut-dong', type: 'button', 'aria-label': 'Đóng', onclick: dong }, '×')),
    than, chan);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    nutSoan.disabled = true;
    chuNut.textContent = 'Đang soạn…';
    try {
      let tepThemIds = [];
      if (tepThem.length) {
        const fd = new FormData();
        for (const f of tepThem) fd.append('tep', f, f.name);
        tepThemIds = (await api('/api/claude/dinh-kem', { method: 'POST', body: fd })).tep.map((t) => t.id);
      }
      const kq = await api('/api/claude/soan-prompt', { method: 'POST', body: JSON.stringify({ viec_ids: [...chon], dan: oDan.value, tep_them: tepThemIds, tep_bo: [...boChon], tep_da_chon: true }) });
      const { o, nut } = oPrompt(h, bao, icon, kq.noi_dung);
      than.replaceChildren(
        h('p', { class: 'kc-ghi', text: kq.ai_loi ? `AI chưa viết được phần yêu cầu (${kq.ai_loi}), prompt dùng yêu cầu mặc định. Bạn sửa tay trước khi dán nếu cần.` : 'Đã soạn xong. Bấm Copy prompt rồi dán sang Claude khác; có thể sửa chữ trước khi copy.' }),
        o);
      o.removeAttribute('readonly');
      chan.replaceChildren(h('button', { class: 'nut nut-phu', type: 'button', onclick: dong }, 'Đóng'), nut);
      sauKhiSoan();
      nut.focus();
    } catch (err) {
      bao(err.message, { loi: true });
      capNhatNut();
    }
  });
  hop.append(form);
  document.body.append(hop);
  capNhatNut();
  hop.showModal();
  nutSoan.focus();
  return hop;
}

// Khối trong ngăn sửa việc: các prompt đã soạn (copy lại không tốn thêm AI) và nút soạn mới.
export async function veKhoiClaude(goc, v, { h, api, bao, luc, icon }) {
  goc.replaceChildren();
  goc.hidden = !v || v.trang_thai !== 'mo';
  if (goc.hidden) return;
  let du;
  try {
    du = await api(`/api/viec/${v.id}/prompt`);
  } catch (e) {
    goc.append(h('p', { class: 'mo-ta', text: e.message }));
    return;
  }
  const ve = () => veKhoiClaude(goc, v, { h, api, bao, luc, icon });
  goc.append(h('h3', { text: 'Prompt cho Claude' }));
  const ds = du.prompt || [];
  if (!ds.length) goc.append(h('p', { class: 'mo-ta', text: 'Chưa soạn prompt nào cho việc này. Bấm Soạn prompt để Sonicplan viết sẵn bối cảnh, tệp và yêu cầu, rồi dán sang Claude khác.' }));
  ds.forEach((p, i) => {
    const { o, nut } = oPrompt(h, bao, icon, p.noi_dung, { cao: '12' });
    goc.append(h('details', { class: 'luot-claude xong', ...(i === 0 ? { open: '' } : {}) },
      h('summary', { text: `Soạn ${luc(p.tao_luc)}${p.dan ? ` · dặn: ${p.dan.slice(0, 60)}` : ''}` }),
      o, h('div', { class: 'hang-nut' }, nut)));
  });
  goc.append(h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-phu', type: 'button', onclick: () => moKhungSoanPrompt([v], { h, api, bao, icon, sauKhiSoan: ve }) }, icon('ai'), ds.length ? 'Soạn lại' : 'Soạn prompt')));
}
