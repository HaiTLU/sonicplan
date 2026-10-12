// Đọc nội dung một tin Zalo thành loại hiển thị: chữ, ảnh, tệp, thẻ liên kết, danh thiếp...
// Phần thuần, không đụng giao diện, để kiểm thử được.

const MAU_LIEN_KET = /(https?:\/\/[^\s<>"]+)/g;

// Tách chữ thành các đoạn { chu } và { url } để hiện liên kết bấm được.
export function tachLienKet(chu) {
  const ra = [];
  let cuoi = 0;
  for (const m of String(chu).matchAll(MAU_LIEN_KET)) {
    let url = m[1];
    const du = url.match(/[.,;:!?)\]]+$/);
    if (du) url = url.slice(0, -du[0].length);
    if (m.index > cuoi) ra.push({ chu: chu.slice(cuoi, m.index) });
    ra.push({ url });
    cuoi = m.index + url.length;
  }
  if (cuoi < chu.length) ra.push({ chu: chu.slice(cuoi) });
  return ra;
}

export function mienCuaUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function phanTichTin(noiDung) {
  const nd = String(noiDung || '').trim();
  let m = nd.match(/^\[chat\.photo\]\s+(https:\/\/\S+)/);
  if (m) return { kieu: 'anh', url: m[1] };
  m = nd.match(/^\[share\.file\]\s+([\s\S]+?)\s+-\s+(https:\/\/\S+)\s*$/);
  if (m) return { kieu: 'tep-ngoai', ten: m[1].trim(), url: m[2] };
  m = nd.match(/^\[chat\.video\.msg\]\s*(\S*)/);
  if (m) return { kieu: 'video', url: m[1] || '' };
  if (/^\[chat\.undo\]/.test(nd)) return { kieu: 'thu-hoi' };
  if (/^\[chat\.sticker\]/.test(nd)) return { kieu: 'nhan-dan' };
  if (/^\[group\.poll\]/.test(nd)) return { kieu: 'binh-chon' };
  if (/^\[chat\.ecard\]/.test(nd)) return { kieu: 'chu', chu: nd.replace(/^\[chat\.ecard\]\s*/, '') || 'Thiệp' };
  m = nd.match(/^\[chat\.recommended\]\s*([\s\S]*)$/);
  if (m) {
    const thanh = m[1].trim().replace(/^sendBubbleMessage\s*-?\s*/, '');
    const json = thanh.match(/\{[\s\S]*\}/);
    if (json) {
      try {
        const d = JSON.parse(json[0]);
        if (d.phone) return { kieu: 'danh-thiep', ten: thanh.slice(0, json.index).replace(/\s*-\s*$/, '').trim(), dien_thoai: String(d.phone) };
      } catch {
        /* không phải JSON, coi như chữ */
      }
    }
    const url = (thanh.match(/\s-\s(https?:\/\/\S+)\s*$/) || thanh.match(/(https?:\/\/\S+)/) || [])[1];
    if (url) {
      const khong = thanh.replace(/\s-\s(https?:\/\/\S+)\s*$/, '').trim();
      const phan = khong.split(/\s+-\s+/);
      const tieuDe = phan[0].startsWith('http') ? '' : phan[0];
      return { kieu: 'the-lien-ket', url, tieu_de: tieuDe || mienCuaUrl(url), mo_ta: phan.slice(1).join(' - ').replace(/https?:\/\/\S+/g, '').trim(), mien: mienCuaUrl(url) };
    }
    return { kieu: 'chu', chu: thanh.replace(/^sendBubbleMessage\s*-\s*/, '') };
  }
  if (/^Gửi tệp:/.test(nd)) return { kieu: 'tep-gui', chu: nd.replace(/^Gửi tệp:[^\n]*\n?/, '').trim() };
  return { kieu: 'chu', chu: nd };
}

// Nhãn loại tệp cho biểu tượng: PDF, DOC, XLS, PPT...
export function nhanTep(ten) {
  const duoi = (String(ten).match(/\.([A-Za-z0-9]{1,5})$/) || [])[1]?.toLowerCase() || '';
  const nhom = { pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', csv: 'xls', ppt: 'ppt', pptx: 'ppt', zip: 'zip', rar: 'zip', '7z': 'zip' }[duoi] || 'khac';
  return { nhan: (duoi || 'tệp').slice(0, 4).toUpperCase(), nhom };
}

// Dòng xem nhanh trong danh sách: tin dạng đặc biệt thành câu ngắn thay vì mã thô.
export function trichTin(noiDung) {
  const nd = String(noiDung || '').replace(/\s+/g, ' ').trim();
  const k = phanTichTin(nd);
  switch (k.kieu) {
    case 'anh': return 'Đã gửi một ảnh';
    case 'tep-ngoai': return `Tệp: ${k.ten}`;
    case 'video': return 'Đã gửi một video';
    case 'thu-hoi': return 'Tin nhắn đã thu hồi';
    case 'nhan-dan': return 'Đã gửi một nhãn dán';
    case 'binh-chon': return 'Bình chọn trong nhóm';
    case 'danh-thiep': return `Danh thiếp: ${k.ten || k.dien_thoai}`;
    case 'the-lien-ket': return `Liên kết: ${k.tieu_de}`;
    case 'tep-gui': return `Đã gửi tệp: ${(String(noiDung).match(/^\s*Gửi tệp:[ \t]*([^\n]*)/) || [])[1]?.trim() || ''}`.trim();
    default: return /^\[chat\.recommended\]/.test(nd) ? nd.replace(/^\[chat\.recommended\]\s*(sendBubbleMessage\s*-?\s*)?/, '') : k.chu;
  }
}
