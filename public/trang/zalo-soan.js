// Khung soạn tin Zalo: gõ chữ, chọn emoji, đính kèm ảnh và tệp (bấm kẹp giấy, kéo thả hoặc dán ảnh), Enter gửi.
// Chủ tổ chức bấm gửi thì tin đi thật bằng tài khoản Zalo trên máy Mac; người khác hoặc cuộc trò chuyện chưa có mã Zalo
// thì giữ cách cũ: chép tin và mở Zalo. Không có gì được gửi nếu không có thao tác bấm gửi của người dùng.
import { api, bao, h, icon, kichThuoc, trang } from './chung.js';

const TOI_DA_TEP = 5;
const TOI_DA_BYTE = 25 * 1024 * 1024;
const RE_GUI_DUOC = /^(nhom|ca-nhan):\d{1,30}$/;

const chia = (chuoi) => Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(chuoi), (x) => x.segment);
const NHOM_EMOJI = [
  ['Mặt cười', '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😋😛😜🤪😝🤗🤭🤫🤔😐😑😶😏😒🙄😬😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈💀💩🤡👻👽🤖'],
  ['Cử chỉ', '👍👎👌🤌🤏✌️🤞🤟🤘🤙👈👉👆👇☝️✋🤚🖐️🖖👋🤝🙏💪👏🙌👐🤲🫶🫡'],
  ['Tim, biểu tượng', '❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💯✅❌⭐🌟✨🔥💥🎉🎊🎈🎁🏆🥇'],
  ['Đồ vật, khác', '☕🍵🍺🍻🍷🍰🎂🍕🍔🍜🍚🍎🍉🌸🌹🌻🌞🌙⚡☔📌📎📅💼💻📱📞✉️📷🎵🚗✈️🏠⏰💡🔔'],
].map(([ten, chuoi]) => ({ ten, ds: chia(chuoi) }));

// Bảng emoji: bấm một emoji thì chèn vào chỗ con trỏ trong ô soạn.
function bangEmoji(chen, dong) {
  let dangMo = 0;
  const luoi = h('div', { class: 'luoi-emoji', role: 'listbox' });
  const ve = () => {
    luoi.replaceChildren(...NHOM_EMOJI[dangMo].ds.map((e) => h('button', { class: 'emoji', type: 'button', role: 'option', 'aria-label': e, text: e, onclick: () => chen(e) })));
  };
  const tab = h('div', { class: 'tab-emoji', role: 'tablist' }, ...NHOM_EMOJI.map((n, i) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0), text: n.ten, onclick: (ev) => {
    dangMo = i; ve();
    tab.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === ev.currentTarget)));
  } })));
  ve();
  const bang = h('div', { class: 'bang-emoji', hidden: true, role: 'dialog', 'aria-label': 'Chọn emoji' }, tab, luoi);
  bang.dong = dong;
  return bang;
}

// ten: tên cuộc trò chuyện; khoa: 'nhom:<mã>' hoặc 'ca-nhan:<mã>'; vungTha: phần tử nhận kéo thả tệp;
// themTam / daGui / lamMoi: móc để khung tin hiện tin đang gửi và tải tin mới về.
export function khungSoan({ ten, khoa, vungTha, themTam, daGui, lamMoi }) {
  const laChu = trang.toi?.to_chuc?.vai_tro === 'chu';
  const guiThat = laChu && RE_GUI_DUOC.test(khoa || '');
  const o = h('textarea', { class: 'o-soan', name: 'tin', autocomplete: 'off', rows: '1', maxlength: guiThat ? '2000' : '4000', placeholder: guiThat ? 'Nhập tin nhắn…' : 'Soạn tin…', 'aria-label': `Soạn tin cho ${ten}` });
  const nut = h('button', { class: 'nut-gui-zalo', type: 'submit', disabled: true, 'aria-label': guiThat ? 'Gửi tin' : 'Chép tin và mở Zalo' }, icon('gui'));
  const dinh = [];
  const hangDinh = h('div', { class: 'hang-dinh-zalo', hidden: true });
  const khop = () => { o.style.height = 'auto'; o.style.height = `${Math.min(o.scrollHeight, 160)}px`; nut.disabled = !o.value.trim() && !dinh.length; };

  const veDinh = () => {
    hangDinh.hidden = !dinh.length;
    hangDinh.replaceChildren(...dinh.map((f) => {
      const laAnh = /^image\/(jpeg|png|gif|webp)$/.test(f.type);
      const the = h('div', { class: 'the-dinh' },
        laAnh ? h('img', { src: URL.createObjectURL(f), alt: '' }) : h('span', { class: 'tep-dinh-zalo' }, icon('tep')),
        h('div', { class: 'ten-dinh' }, h('strong', { text: f.name }), h('small', { text: kichThuoc(f.size) })),
        h('button', { class: 'bo-dinh', type: 'button', 'aria-label': `Bỏ ${f.name}`, onclick: () => { dinh.splice(dinh.indexOf(f), 1); veDinh(); khop(); } }, icon('dong')));
      return the;
    }));
    khop();
  };
  const themTep = (ds) => {
    for (const f of ds) {
      if (!guiThat) { bao('Chỉ chủ tổ chức mới gửi được tệp, hoặc cuộc trò chuyện này chưa có mã Zalo.', { loi: true }); return; }
      if (dinh.length >= TOI_DA_TEP) { bao(`Mỗi lần gửi tối đa ${TOI_DA_TEP} tệp.`, { loi: true }); break; }
      if (f.size > TOI_DA_BYTE) { bao(`${f.name} lớn quá 25 MB.`, { loi: true }); continue; }
      dinh.push(f);
    }
    veDinh();
  };
  const oChonTep = h('input', { type: 'file', multiple: true, hidden: true, onchange: () => { themTep([...oChonTep.files]); oChonTep.value = ''; } });
  const nutKep = h('button', { class: 'nut-phu-zalo', type: 'button', 'aria-label': 'Đính kèm ảnh hoặc tệp', disabled: !guiThat, onclick: () => oChonTep.click() }, icon('kep'));

  const chenEmoji = (e) => {
    const a = o.selectionStart ?? o.value.length;
    const b = o.selectionEnd ?? a;
    o.value = o.value.slice(0, a) + e + o.value.slice(b);
    o.selectionStart = o.selectionEnd = a + e.length;
    o.focus();
    khop();
  };
  const bang = bangEmoji(chenEmoji);
  const nutEmoji = h('button', { class: 'nut-phu-zalo', type: 'button', 'aria-label': 'Chèn emoji', 'aria-expanded': 'false', onclick: () => {
    bang.hidden = !bang.hidden;
    nutEmoji.setAttribute('aria-expanded', String(!bang.hidden));
  } }, '😊');
  const dongBang = (ev) => { if (!bang.hidden && !bang.contains(ev.target) && !nutEmoji.contains(ev.target)) { bang.hidden = true; nutEmoji.setAttribute('aria-expanded', 'false'); } };
  document.addEventListener('pointerdown', dongBang);
  const form = h('form', { class: 'soan-zalo' }, hangDinh, h('div', { class: 'hang-soan-zalo' }, nutKep, nutEmoji, o, nut), bang, oChonTep);
  o.addEventListener('input', khop);

  // Kéo thả tệp vào khung chat và dán ảnh từ bộ nhớ tạm.
  if (vungTha && guiThat) {
    vungTha.addEventListener('dragover', (ev) => { if (ev.dataTransfer?.types?.includes('Files')) { ev.preventDefault(); vungTha.classList.add('dang-tha'); } });
    vungTha.addEventListener('dragleave', (ev) => { if (!vungTha.contains(ev.relatedTarget)) vungTha.classList.remove('dang-tha'); });
    vungTha.addEventListener('drop', (ev) => { ev.preventDefault(); vungTha.classList.remove('dang-tha'); themTep([...(ev.dataTransfer?.files || [])]); });
  }
  o.addEventListener('paste', (ev) => {
    const ds = [...(ev.clipboardData?.files || [])];
    if (ds.length && guiThat) { ev.preventDefault(); themTep(ds); }
  });

  async function guiTheo(chu, tep) {
    const fd = new FormData();
    fd.set('khoa', khoa);
    fd.set('noi_dung', chu);
    for (const f of tep) fd.append('tep', f, f.name);
    const { id } = await api('/api/zalo/gui', { method: 'POST', body: fd });
    const tam = themTam({ chu, soTep: tep.length });
    // Theo dõi trạng thái tới khi máy Mac báo xong hoặc lỗi (tối đa khoảng 3 phút, khớp hạn chờ của máy chủ).
    for (let i = 0; i < 120; i++) {
      await new Promise((x) => setTimeout(x, i < 10 ? 1000 : 2000));
      let tt;
      try { tt = (await api(`/api/zalo/gui?khoa=${encodeURIComponent(khoa)}`)).ds.find((x) => x.id === id); } catch { continue; }
      if (tt?.trang_thai === 'xong') { daGui(tam); bao('Đã gửi.'); lamMoi(); return; }
      if (tt?.trang_thai === 'loi') { daGui(tam, tt.loi || 'Gửi không được.'); throw new Error(tt.loi || 'Gửi không được.'); }
    }
    daGui(tam, 'Chưa có kết quả.');
    throw new Error('Chưa nhận được kết quả gửi. Mở Zalo xem tin đã gửi chưa trước khi gửi lại.');
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const van = o.value.trim();
    if (!van && !dinh.length) return;
    if (guiThat) {
      const tep = dinh.slice();
      o.value = ''; dinh.length = 0; veDinh(); khop();
      bang.hidden = true;
      guiTheo(van, tep).catch((e) => {
        bao(e.message, { loi: true });
        if (!o.value) { o.value = van; khop(); } // trả chữ vào ô để gửi lại, tệp thì chọn lại
      });
      return;
    }
    // Không gửi thật được: giữ cách cũ. Mở Zalo ngay trong lúc còn thao tác bấm (Safari chặn cửa sổ mở sau lệnh chờ), rồi mới đợi kết quả chép.
    const chep = navigator.clipboard.writeText(van);
    window.open('https://chat.zalo.me/', '_blank', 'noopener');
    try {
      await chep;
    } catch {
      bao('Trình duyệt chặn chép. Tin vẫn còn trong ô soạn: bôi đen và chép tay, hoặc cho phép trang này chép.', { loi: true });
      return;
    }
    bao(`Đã chép tin. Dán vào hội thoại "${ten}" trong Zalo rồi bấm gửi.`);
    o.value = '';
    khop();
  });
  // Enter gửi, Shift+Enter xuống dòng. Đang gõ dấu tiếng Việt (IME) thì Enter chỉ chốt chữ, không gửi. Esc đóng bảng emoji.
  o.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && ev.keyCode !== 229) { ev.preventDefault(); form.requestSubmit(); }
    if (ev.key === 'Escape' && !bang.hidden) { bang.hidden = true; nutEmoji.setAttribute('aria-expanded', 'false'); }
  });
  return h('div', { class: 'vung-soan' }, form, guiThat ? null : h('p', { class: 'goi-y-soan', text: laChu ? 'Cuộc trò chuyện này chưa có mã Zalo nên chưa gửi thẳng được: bấm gửi sẽ chép tin và mở Zalo.' : 'Chỉ chủ tổ chức gửi thẳng được. Bấm gửi sẽ chép tin và mở Zalo.' }));
}
