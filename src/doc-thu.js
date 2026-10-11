// Đọc thư MIME (RFC 5322, 2045-2047, 2231): tiêu đề, người gửi, thân chữ, thân HTML và tệp đính kèm.
// Viết riêng, không dùng gói ngoài, để triển khai được cả khi không tải được gói npm.
// Kết quả cùng dạng với postal-mime: { from, subject, messageId, date, text, html, attachments }.

const giaiMaLatin1 = new TextDecoder('latin1');

export async function docThu(nguon) {
  const byte = nguon instanceof Uint8Array ? nguon : new Uint8Array(await new Response(nguon).arrayBuffer());
  // Làm việc trên chuỗi latin1: mỗi ký tự đúng một byte nên cắt ghép không hỏng dữ liệu nhị phân.
  const tho = giaiMaLatin1.decode(byte);
  const kq = { text: '', html: '', attachments: [] };
  const goc = tachPhan(tho);
  duyet(goc, kq);
  const td = goc.tieuDe;
  kq.subject = giaiTu(td.get('subject') || '').trim();
  kq.from = docDiaChi(td.get('from') || '');
  kq.messageId = (td.get('message-id') || '').trim() || null;
  kq.date = (td.get('date') || '').trim();
  kq.text = kq.text.trim();
  return kq;
}

function tachPhan(tho) {
  const m = tho.match(/\r?\n\r?\n/);
  const dau = m ? tho.slice(0, m.index) : tho;
  const than = m ? tho.slice(m.index + m[0].length) : '';
  return { tieuDe: docTieuDe(dau), than };
}

function docTieuDe(dau) {
  const td = new Map();
  for (const dong of dau.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = dong.indexOf(':');
    if (i <= 0) continue;
    const ten = dong.slice(0, i).trim().toLowerCase();
    if (!td.has(ten)) td.set(ten, dong.slice(i + 1).trim());
  }
  return td;
}

// "text/plain; charset=utf-8; name*=UTF-8''t%C3%AAn" -> { gia_tri, tham_so }
export function docThamSo(chuoi) {
  const phan = [];
  let hien = '', trongNhay = false;
  for (const c of String(chuoi || '')) {
    if (c === '"') trongNhay = !trongNhay;
    if (c === ';' && !trongNhay) { phan.push(hien); hien = ''; } else hien += c;
  }
  phan.push(hien);
  const thamSo = {};
  const noi = {};
  for (const p of phan.slice(1)) {
    const i = p.indexOf('=');
    if (i < 0) continue;
    let ten = p.slice(0, i).trim().toLowerCase();
    let gt = p.slice(i + 1).trim().replace(/^"(.*)"$/s, '$1').replace(/\\(.)/g, '$1');
    // RFC 2231: name*0*=..., name*1*=... và name*=charset''phan%20tram
    const m = ten.match(/^([^*]+)\*(\d+)?(\*)?$/);
    if (m) {
      (noi[m[1]] ||= []).push({ so: Number(m[2] || 0), gt, maHoa: Boolean(m[3]) || (!m[2] && ten.endsWith('*')) });
      continue;
    }
    thamSo[ten] = giaiTu(gt);
  }
  for (const [ten, ds] of Object.entries(noi)) {
    ds.sort((a, b) => a.so - b.so);
    let bangMa = 'utf-8';
    const byte = [];
    ds.forEach((d, i) => {
      let gt = d.gt;
      if (d.maHoa && i === 0) {
        const m = gt.match(/^([^']*)'[^']*'(.*)$/s);
        if (m) { bangMa = m[1] || 'utf-8'; gt = m[2]; }
      }
      if (d.maHoa) gt.replace(/%([0-9a-f]{2})|[\s\S]/gi, (t, hx) => { byte.push(hx ? parseInt(hx, 16) : t.charCodeAt(0)); return ''; });
      else for (const c of gt) byte.push(c.charCodeAt(0) & 255);
    });
    thamSo[ten] = giaiBangMa(Uint8Array.from(byte), bangMa);
  }
  return { gia_tri: phan[0].trim().toLowerCase(), tham_so: thamSo };
}

function duyet(phan, kq) {
  const loai = docThamSo(phan.tieuDe.get('content-type') || 'text/plain; charset=us-ascii');
  const viTri = docThamSo(phan.tieuDe.get('content-disposition') || '');
  const kieu = loai.gia_tri;

  if (kieu.startsWith('multipart/') && loai.tham_so.boundary) {
    for (const con of tachMultipart(phan.than, loai.tham_so.boundary)) duyet(tachPhan(con), kq);
    return;
  }
  if (kieu === 'message/rfc822' && viTri.gia_tri !== 'attachment') {
    duyet(tachPhan(phan.than), kq);
    return;
  }

  const byte = giaiMaTruyen(phan.than, phan.tieuDe.get('content-transfer-encoding'));
  const tenTep = viTri.tham_so.filename || loai.tham_so.name || '';
  const laChu = kieu === 'text/plain' || kieu === 'text/html';
  if (laChu && viTri.gia_tri !== 'attachment' && !tenTep) {
    const chu = giaiBangMa(byte, loai.tham_so.charset);
    if (kieu === 'text/plain') kq.text += (kq.text ? '\n\n' : '') + chu;
    else kq.html += chu;
    return;
  }
  kq.attachments.push({
    filename: tenTep || null,
    mimeType: kieu,
    disposition: viTri.gia_tri || (tenTep ? 'attachment' : 'inline'),
    contentId: (phan.tieuDe.get('content-id') || '').replace(/[<>]/g, '') || null,
    content: byte.buffer.slice(byte.byteOffset, byte.byteOffset + byte.byteLength),
  });
}

function tachMultipart(than, ranh) {
  const dau = `--${ranh}`;
  const ds = [];
  let i = than.indexOf(dau);
  while (i >= 0) {
    let batDau = i + dau.length;
    if (than.startsWith('--', batDau)) break; // ranh giới kết thúc
    batDau = than.indexOf('\n', batDau);
    if (batDau < 0) break;
    const tiep = than.indexOf(`\n${dau}`, batDau);
    const ket = tiep < 0 ? than.length : tiep;
    ds.push(than.slice(batDau + 1, ket).replace(/\r$/, ''));
    i = tiep < 0 ? -1 : tiep + 1;
  }
  return ds;
}

function giaiMaTruyen(than, cach) {
  const c = String(cach || '').trim().toLowerCase();
  if (c === 'base64') {
    const sach = than.replace(/[^A-Za-z0-9+/]/g, '');
    const du = sach.length % 4;
    try {
      return Uint8Array.from(atob(du === 1 ? sach.slice(0, -1) : sach + '='.repeat(du ? 4 - du : 0)), (x) => x.charCodeAt(0));
    } catch {
      return new Uint8Array();
    }
  }
  const chuoi = c === 'quoted-printable'
    ? than.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, hx) => String.fromCharCode(parseInt(hx, 16)))
    : than;
  return Uint8Array.from(chuoi, (x) => x.charCodeAt(0) & 255);
}

function giaiBangMa(byte, bangMa) {
  const ten = String(bangMa || 'utf-8').trim().toLowerCase().replace(/^"|"$/g, '');
  try {
    return new TextDecoder(ten === 'us-ascii' || ten === 'ascii' ? 'utf-8' : ten).decode(byte);
  } catch {
    return new TextDecoder('utf-8').decode(byte);
  }
}

// Giải các đoạn =?utf-8?B?...?= và =?utf-8?Q?...?= trong tiêu đề (RFC 2047).
// Đầu vào là chuỗi latin1 (từng byte); phần không mã hóa mà chứa byte UTF-8 thô cũng được đọc lại thành UTF-8.
export function giaiTu(chuoi) {
  const s = String(chuoi || '');
  const daGiai = s.replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)(\s+(?==\?))?/g, '$1').replace(/=\?([^?*]+)(?:\*[^?]*)?\?([bBqQ])\?([^?]*)\?=/g, (_, bangMa, cach, noiDung) => {
    let byte;
    if (cach.toUpperCase() === 'B') {
      try { byte = Uint8Array.from(atob(noiDung), (x) => x.charCodeAt(0)); } catch { return noiDung; }
    } else {
      const q = noiDung.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (__, hx) => String.fromCharCode(parseInt(hx, 16)));
      byte = Uint8Array.from(q, (x) => x.charCodeAt(0) & 255);
    }
    return '\u0000' + giaiBangMa(byte, bangMa) + '\u0001';
  });
  // Phần ngoài đoạn mã hóa: byte thô, thử đọc UTF-8.
  return daGiai.split(/(\u0000[^\u0001]*\u0001)/).map((doan) => {
    if (doan.startsWith('\u0000')) return doan.slice(1, -1);
    if (!/[\u0080-ÿ]/.test(doan)) return doan;
    const byte = Uint8Array.from(doan, (x) => x.charCodeAt(0) & 255);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(byte); } catch { return doan; }
  }).join('');
}

// "Nguyễn Văn A <a@b.vn>" -> { name, address }
export function docDiaChi(chuoi) {
  const s = giaiTu(chuoi).trim();
  const m = s.match(/^(.*?)<([^>]+)>/);
  if (m) return { name: m[1].trim().replace(/^"(.*)"$/, '$1').trim(), address: m[2].trim().toLowerCase() };
  return { name: '', address: s.replace(/\(.*\)/, '').trim().toLowerCase() };
}
