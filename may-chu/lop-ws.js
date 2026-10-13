// WebSocket tối giản cho máy chủ Node (RFC 6455): bắt tay, nhận khung chữ, gửi khung chữ, ping, đóng.
// Đủ cho trang Claude; không nén, không nhận khung lớn hơn 1 MB.
import { createHash } from 'node:crypto';

const MA_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const TOI_DA = 1024 * 1024;

export function batTay(req, socket) {
  const khoa = req.headers['sec-websocket-key'];
  if (!khoa || String(req.headers.upgrade).toLowerCase() !== 'websocket') return false;
  const chapNhan = createHash('sha1').update(khoa + MA_GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${chapNhan}\r\n\r\n`);
  return true;
}

function khung(maLenh, duLieu) {
  const n = duLieu.length;
  const dau = n < 126 ? Buffer.from([0x80 | maLenh, n]) : n < 65536 ? Buffer.from([0x80 | maLenh, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | maLenh, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([dau, duLieu]);
}

// Bọc socket thành đối tượng giống WebSocket phía máy chủ: send, close, và các hàm nghe khi có tin, khi đóng.
export function boc(socket, { khiTin, khiDong }) {
  let dem = Buffer.alloc(0);
  let manh = [];
  let daDong = false;
  const ws = {
    send(chu) {
      if (daDong) return;
      socket.write(khung(1, Buffer.from(String(chu))));
    },
    close(ma = 1000, lyDo = '') {
      if (daDong) return;
      const b = Buffer.alloc(2);
      b.writeUInt16BE(ma);
      try { socket.write(khung(8, Buffer.concat([b, Buffer.from(String(lyDo).slice(0, 100))]))); } catch {}
      ketThuc();
      socket.end();
    },
  };
  const ketThuc = () => {
    if (daDong) return;
    daDong = true;
    khiDong?.(ws);
  };
  socket.on('data', (phan) => {
    dem = Buffer.concat([dem, phan]);
    while (dem.length >= 2) {
      const fin = (dem[0] & 0x80) !== 0;
      const maLenh = dem[0] & 0x0f;
      const coMat = (dem[1] & 0x80) !== 0;
      let dai = dem[1] & 0x7f;
      let vt = 2;
      if (dai === 126) { if (dem.length < 4) return; dai = dem.readUInt16BE(2); vt = 4; }
      else if (dai === 127) { if (dem.length < 10) return; dai = Number(dem.readBigUInt64BE(2)); vt = 10; }
      if (dai > TOI_DA) { ws.close(1009, 'qua lon'); return; }
      const mat = coMat ? dem.subarray(vt, vt + 4) : null;
      if (coMat) vt += 4;
      if (dem.length < vt + dai) return;
      const duLieu = Buffer.from(dem.subarray(vt, vt + dai));
      dem = dem.subarray(vt + dai);
      if (mat) for (let i = 0; i < duLieu.length; i++) duLieu[i] ^= mat[i & 3];
      if (maLenh === 8) { ws.close(1000); return; }
      if (maLenh === 9) { socket.write(khung(10, duLieu)); continue; }
      if (maLenh === 10) continue;
      if (maLenh === 1 || maLenh === 2 || maLenh === 0) {
        manh.push(duLieu);
        if (fin) {
          const tron = Buffer.concat(manh);
          manh = [];
          khiTin?.(ws, tron.toString('utf8'));
        }
      }
    }
  });
  socket.on('close', ketThuc);
  socket.on('error', ketThuc);
  return ws;
}
