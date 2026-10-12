// Xem trước tệp ngay trong trang Tệp: ảnh và PDF hiện thẳng, Word hiện phần chữ.
// Tệp lưu ở R2 thường có loại chung chung nên loại xem được suy từ phần mở rộng của tên.

const LOAI_ANH = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
export const TOI_DA_DOCX = 12 * 1024 * 1024;
const TOI_DA_CHU = 30000;

// Trả về { kieu: 'anh' | 'pdf' | 'docx', mime } hoặc null nếu không xem trước được.
export function loaiXem(ten) {
  const duoi = (String(ten).match(/\.([A-Za-z0-9]{1,5})$/) || [])[1]?.toLowerCase();
  if (LOAI_ANH[duoi]) return { kieu: 'anh', mime: LOAI_ANH[duoi] };
  if (duoi === 'pdf') return { kieu: 'pdf', mime: 'application/pdf' };
  if (duoi === 'docx') return { kieu: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  return null;
}

async function bungNen(du) {
  const dong = new Blob([du]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(dong).arrayBuffer());
}

// Đọc một mục trong tệp zip (docx là zip) qua danh mục ở cuối tệp.
export async function docMucZip(u8, tenMuc) {
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let cuoi = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { cuoi = i; break; }
  }
  if (cuoi < 0) return null;
  let p = v.getUint32(cuoi + 16, true);
  const so = v.getUint16(cuoi + 10, true);
  const giaiMa = new TextDecoder();
  for (let k = 0; k < so && v.getUint32(p, true) === 0x02014b50; k++) {
    const phuongPhap = v.getUint16(p + 10, true);
    const nen = v.getUint32(p + 20, true);
    const dai = v.getUint16(p + 28, true);
    const them = v.getUint16(p + 30, true);
    const ghiChu = v.getUint16(p + 32, true);
    const cucBo = v.getUint32(p + 42, true);
    const ten = giaiMa.decode(u8.subarray(p + 46, p + 46 + dai));
    if (ten === tenMuc) {
      if (v.getUint32(cucBo, true) !== 0x04034b50) return null;
      const dau = cucBo + 30 + v.getUint16(cucBo + 26, true) + v.getUint16(cucBo + 28, true);
      const du = u8.subarray(dau, dau + nen);
      return phuongPhap === 0 ? du : phuongPhap === 8 ? bungNen(du) : null;
    }
    p += 46 + dai + them + ghiChu;
  }
  return null;
}

const THAY_THE = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&' };

// Chữ thuần từ word/document.xml: mỗi đoạn một dòng, tab và xuống dòng giữ lại.
export function chuTuXmlWord(xml) {
  return String(xml)
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:(?:br|cr)\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:lt|gt|quot|apos|amp);/g, (m) => THAY_THE[m])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function chuTuDocx(u8) {
  const xml = await docMucZip(u8, 'word/document.xml');
  if (!xml) return null;
  const chu = chuTuXmlWord(new TextDecoder().decode(xml));
  return chu.length > TOI_DA_CHU ? `${chu.slice(0, TOI_DA_CHU)}\n\n… (còn nữa, tải tệp về để đọc đủ)` : chu;
}
