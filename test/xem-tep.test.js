// Kiểm thử xem trước tệp: nhận loại theo phần mở rộng và đọc chữ từ Word. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { chuTuDocx, chuTuXmlWord, loaiXem } from '../src/xem-tep.js';

// Dựng một tệp zip tối thiểu có một mục, đủ để thử trình đọc (nén deflate hoặc không nén).
function zipMotMuc(ten, noiDung, nen) {
  const du = Buffer.from(noiDung);
  const ndNen = nen ? deflateRawSync(du) : du;
  const tenB = Buffer.from(ten);
  const cucBo = Buffer.alloc(30);
  cucBo.writeUInt32LE(0x04034b50, 0);
  cucBo.writeUInt16LE(nen ? 8 : 0, 8);
  cucBo.writeUInt32LE(ndNen.length, 18);
  cucBo.writeUInt32LE(du.length, 22);
  cucBo.writeUInt16LE(tenB.length, 26);
  const phanCucBo = Buffer.concat([cucBo, tenB, ndNen]);
  const dm = Buffer.alloc(46);
  dm.writeUInt32LE(0x02014b50, 0);
  dm.writeUInt16LE(nen ? 8 : 0, 10);
  dm.writeUInt32LE(ndNen.length, 20);
  dm.writeUInt32LE(du.length, 24);
  dm.writeUInt16LE(tenB.length, 28);
  dm.writeUInt32LE(0, 42);
  const phanDm = Buffer.concat([dm, tenB]);
  const cuoi = Buffer.alloc(22);
  cuoi.writeUInt32LE(0x06054b50, 0);
  cuoi.writeUInt16LE(1, 8);
  cuoi.writeUInt16LE(1, 10);
  cuoi.writeUInt32LE(phanDm.length, 12);
  cuoi.writeUInt32LE(phanCucBo.length, 16);
  return new Uint8Array(Buffer.concat([phanCucBo, phanDm, cuoi]));
}

const XML = '<w:document><w:body><w:p><w:r><w:t>Xin chào &amp; Thăng Long</w:t></w:r></w:p><w:p><w:r><w:t>Dòng 2</w:t></w:r><w:r><w:tab/><w:t>sau tab</w:t></w:r></w:p></w:body></w:document>';

test('loại xem trước theo phần mở rộng, không nhận HTML hay SVG', () => {
  assert.equal(loaiXem('a.JPG').kieu, 'anh');
  assert.equal(loaiXem('a.pdf').mime, 'application/pdf');
  assert.equal(loaiXem('Bài luận.docx').kieu, 'docx');
  assert.equal(loaiXem('a.svg'), null);
  assert.equal(loaiXem('a.html'), null);
  assert.equal(loaiXem('khongduoi'), null);
});

test('chữ từ XML Word: đoạn thành dòng, tab giữ, ký tự đặc biệt giải mã', () => {
  assert.equal(chuTuXmlWord(XML), 'Xin chào & Thăng Long\nDòng 2\tsau tab');
});

test('đọc chữ từ docx nén và không nén; thiếu mục thì trả null', async () => {
  assert.equal(await chuTuDocx(zipMotMuc('word/document.xml', XML, true)), 'Xin chào & Thăng Long\nDòng 2\tsau tab');
  assert.equal(await chuTuDocx(zipMotMuc('word/document.xml', XML, false)), 'Xin chào & Thăng Long\nDòng 2\tsau tab');
  assert.equal(await chuTuDocx(zipMotMuc('khac.xml', XML, true)), null);
  assert.equal(await chuTuDocx(new Uint8Array([1, 2, 3])), null);
});
