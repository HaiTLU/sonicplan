// Trang Claude: trò chuyện với Claude Code chạy trên máy riêng (trạm Claude trên Mac mini) ngay trong Sonicplan.
// Trình duyệt và trạm cùng nối WebSocket vào một "phòng" của tổ chức. Phòng giữ danh sách phiên chat,
// lịch sử từng phiên, mã trạm (đã băm), và chuyển lệnh, chữ Claude viết ra giữa hai bên ngay khi có.
// Trên Cloudflare phòng là một Durable Object (lớp TramClaude, ngủ đông khi không có tin nên không tốn tiền),
// trên máy chủ Node (may-chu/) phòng là một đối tượng trong tiến trình. Phòng không đọc ghi D1.

import { bam, json, loi, maNgauNhien } from './tien-ich.js';
import { TEP_TOI_DA } from './hop-tin.js';

export const MODEL_CLAUDE = ['opus', 'sonnet', 'haiku', 'fable'];
export const EFFORT_CLAUDE = ['low', 'medium', 'high', 'xhigh', 'max'];
export const CHE_DO_CLAUDE = ['acceptEdits', 'plan'];
const LUU_LAI = new Set(['nguoi', 'chu', 'cong_cu', 'ket_qua_cong_cu', 'tep', 'xong', 'he_thong', 'bo_nho']);
const TIN_BO_NHO = new Set(['bn_doc', 'bn_ghi', 'bn_gop']);
const TOI_DA_SU_KIEN = 3000;
const so6 = (n) => String(n).padStart(6, '0');

// Lõi phòng, không biết mình chạy ở đâu. moiTruong: { kho (get/put/delete/list như storage của Durable Object),
// cacKetNoi(vaiTro), docGan(ws), ganVao(ws, duLieu), bayGio() }.
export class PhongTram {
  constructor(moiTruong) {
    this.mt = moiTruong;
  }

  bayGio() {
    return this.mt.bayGio ? this.mt.bayGio() : new Date().toISOString();
  }

  // Lệnh từ Worker (HTTP nội bộ), không qua WebSocket.
  async xuLy(hanhDong, duLieu = {}) {
    const kho = this.mt.kho;
    if (hanhDong === 'tao-khoa') {
      const khoa = maNgauNhien(40);
      await kho.put('khoa', await bam(khoa));
      for (const ws of this.mt.cacKetNoi('tram')) {
        this.gui(ws, { loai: 'het_han', ly_do: 'Mã trạm vừa được thay. Cài lại trạm bằng lệnh mới.' });
        try { ws.close(4003, 'doi ma'); } catch {}
      }
      return { khoa };
    }
    if (hanhDong === 'kiem-khoa') {
      const luu = await kho.get('khoa');
      return { dung: Boolean(luu && duLieu.khoa && (await bam(String(duLieu.khoa))) === luu) };
    }
    if (hanhDong === 'trang-thai') return this.trangThai();
    return { loi: 'Không có lệnh này.' };
  }

  async trangThai() {
    const tram = this.cacTram();
    const gan = tram[0] ? this.mt.docGan(tram[0]) : null;
    return { co_khoa: Boolean(await this.mt.kho.get('khoa')), tram_mo: tram.length > 0, may: gan?.may || null, phien_ban: gan?.phien_ban || null, claude: gan?.claude || null };
  }

  gui(ws, tin) {
    try { ws.send(JSON.stringify(tin)); } catch {}
  }

  phat(tin) {
    for (const ws of this.mt.cacKetNoi('nguoi')) this.gui(ws, tin);
  }

  // Trạm đã kiểm mã và còn mở (trên Cloudflare, socket đang đóng có thể vẫn nằm trong danh sách lúc xử lý tin đóng).
  cacTram() {
    return this.mt.cacKetNoi('tram').filter((ws) => (ws.readyState === undefined || ws.readyState === 1) && this.mt.docGan(ws)?.xac_thuc);
  }

  tramDangMo() {
    return this.cacTram()[0] || null;
  }

  async docPhien(id) {
    return id ? (await this.mt.kho.get(`phien:${id}`)) || null : null;
  }

  async ghiSuKien(phien, sk) {
    phien.seq = (phien.seq || 0) + 1;
    const ban = { ...sk, seq: phien.seq, luc: sk.luc || this.bayGio() };
    await this.mt.kho.put(`ev:${phien.id}:${so6(phien.seq)}`, ban);
    return ban;
  }

  async luuPhien(phien) {
    phien.cap_nhat = this.bayGio();
    await this.mt.kho.put(`phien:${phien.id}`, phien);
  }

  metaPhien(p) {
    return { id: p.id, tieu_de: p.tieu_de, du_an: p.du_an || null, tao_luc: p.tao_luc, cap_nhat: p.cap_nhat, dang_chay: Boolean(p.dang_chay), cho_tram: Boolean(p.cho_tram), model: p.model || null, effort: p.effort || null };
  }

  async dsPhien() {
    const ds = await this.mt.kho.list({ prefix: 'phien:' });
    return [...ds.values()].sort((a, b) => String(b.cap_nhat).localeCompare(String(a.cap_nhat))).slice(0, 200).map((p) => this.metaPhien(p));
  }

  async lichSu(id) {
    const ds = await this.mt.kho.list({ prefix: `ev:${id}:`, reverse: true, limit: TOI_DA_SU_KIEN });
    return [...ds.values()].reverse();
  }

  // Tin WebSocket từ trình duyệt (vai 'nguoi') hoặc trạm (vai 'tram').
  async nhanTin(ws, thoTin) {
    if (thoTin === 'ping') return this.gui(ws, 'pong');
    let tin;
    try { tin = JSON.parse(typeof thoTin === 'string' ? thoTin : new TextDecoder().decode(thoTin)); } catch { return; }
    const gan = this.mt.docGan(ws) || {};
    if (gan.vai_tro === 'tram') return this.tuTram(ws, gan, tin);
    if (gan.vai_tro === 'nguoi') return this.tuNguoi(ws, tin);
  }

  async tuNguoi(ws, tin) {
    if (tin.loai === 'chao') return this.gui(ws, { loai: 'trang_thai', ...(await this.trangThai()) });
    if (tin.loai === 'ds') return this.gui(ws, { loai: 'ds', phien: await this.dsPhien() });
    if (tin.loai === 'mo') {
      const p = await this.docPhien(tin.phien);
      if (!p) return this.gui(ws, { loai: 'loi', noi_dung: 'Không thấy phiên chat này.' });
      return this.gui(ws, { loai: 'lich_su', phien: this.metaPhien(p), su_kien: await this.lichSu(p.id) });
    }
    if (TIN_BO_NHO.has(tin.loai)) return this.chuyenBoNho(ws, tin);
    if (tin.loai === 'gui') return this.guiLuot(ws, tin);
    if (tin.loai === 'dung') return this.dungLuot(tin.phien);
    if (tin.loai === 'doi_ten') {
      const p = await this.docPhien(tin.phien);
      if (!p) return;
      p.tieu_de = String(tin.tieu_de || '').trim().slice(0, 120) || p.tieu_de;
      await this.luuPhien(p);
      return this.phat({ loai: 'phien', phien: this.metaPhien(p) });
    }
  }

  // Bộ nhớ dự án nằm ở máy Mac: phòng chỉ chuyển yêu cầu sang trạm, không lưu nội dung.
  chuyenBoNho(ws, tin) {
    const ten = String(tin.du_an?.ten || '').trim().slice(0, 120);
    if (!ten) return this.gui(ws, { loai: 'loi', noi_dung: 'Chọn một dự án trước khi mở bộ nhớ.' });
    const tram = this.tramDangMo();
    if (!tram) return this.gui(ws, { loai: 'loi', noi_dung: 'Trạm Claude trên máy Mac đang tắt nên chưa đọc được bộ nhớ dự án.' });
    this.gui(tram, { loai: tin.loai, du_an: { id: tin.du_an.id ?? null, ten }, rid: String(tin.rid || '').slice(0, 40), noi_dung: tin.loai === 'bn_ghi' ? String(tin.noi_dung || '').slice(0, 60000) : undefined });
  }

  async guiLuot(ws, tin) {
    const noiDung = String(tin.noi_dung || '').trim().slice(0, 50000);
    const dinhKem = (Array.isArray(tin.dinh_kem) ? tin.dinh_kem : []).slice(0, 20)
      .filter((t) => t && typeof t.khoa === 'string' && typeof t.ten === 'string')
      .map((t) => ({ ten: t.ten.slice(0, 200), khoa: t.khoa, kich_thuoc: Number(t.kich_thuoc) || 0, loai: String(t.loai || '') }));
    if (!noiDung && !dinhKem.length) return this.gui(ws, { loai: 'loi', noi_dung: 'Gõ yêu cầu hoặc đính kèm tệp trước khi gửi.' });
    const cauHinh = {
      model: MODEL_CLAUDE.includes(tin.model) ? tin.model : null,
      effort: EFFORT_CLAUDE.includes(tin.effort) ? tin.effort : null,
      che_do: CHE_DO_CLAUDE.includes(tin.che_do) ? tin.che_do : 'acceptEdits',
    };
    let p = await this.docPhien(tin.phien);
    if (p?.dang_chay) return this.gui(ws, { loai: 'loi', phien: p.id, noi_dung: 'Claude đang làm lượt trước. Bấm Dừng hoặc chờ xong rồi gửi tiếp.' });
    if (!p) {
      const tieuDe = (noiDung || dinhKem[0]?.ten || 'Phiên mới').replace(/\s+/g, ' ').slice(0, 70);
      p = { id: maNgauNhien(12), tieu_de: tieuDe, tao_luc: this.bayGio(), seq: 0, du_an: null };
    }
    if (tin.du_an && typeof tin.du_an === 'object' && tin.du_an.id != null) p.du_an = { id: Number(tin.du_an.id) || null, ten: String(tin.du_an.ten || '').slice(0, 120) };
    else if (tin.du_an === null) p.du_an = null;
    Object.assign(p, { model: cauHinh.model, effort: cauHinh.effort });
    const luot = maNgauNhien(10);
    p.dang_chay = luot;
    const tram = this.tramDangMo();
    p.cho_tram = !tram;
    const sk = [await this.ghiSuKien(p, { loai: 'nguoi', luot, noi_dung: noiDung, dinh_kem: dinhKem, ...cauHinh })];
    if (!tram) sk.push(await this.ghiSuKien(p, { loai: 'he_thong', noi_dung: 'Trạm Claude trên máy Mac đang tắt. Yêu cầu sẽ tự chạy khi trạm bật lại.' }));
    p.cho = { luot, noi_dung: noiDung, dinh_kem: dinhKem, ...cauHinh };
    await this.luuPhien(p);
    this.phat({ loai: 'phien', phien: this.metaPhien(p), moi_tu: tin.ma_tam || null });
    for (const s of sk) this.phat({ loai: 'su_kien', phien: p.id, su_kien: s });
    if (tram) await this.giaoChoTram(tram, p);
  }

  async giaoChoTram(tram, p) {
    if (!p.cho) return;
    this.gui(tram, { loai: 'luot', phien: p.id, tieu_de: p.tieu_de, du_an: p.du_an, claude_session: p.claude_session || null, ...p.cho });
    p.cho_tram = false;
    await this.luuPhien(p);
    this.phat({ loai: 'phien', phien: this.metaPhien(p) });
  }

  async dungLuot(id) {
    const p = await this.docPhien(id);
    if (!p?.dang_chay) return;
    const tram = this.tramDangMo();
    if (tram && !p.cho_tram) return this.gui(tram, { loai: 'dung', phien: p.id, luot: p.dang_chay });
    // Lượt chưa tới trạm: hủy luôn tại phòng.
    const sk = await this.ghiSuKien(p, { loai: 'xong', luot: p.dang_chay, thanh_cong: false, da_dung: true, loi: 'Đã dừng trước khi trạm nhận việc.' });
    Object.assign(p, { dang_chay: null, cho: null, cho_tram: false });
    await this.luuPhien(p);
    this.phat({ loai: 'su_kien', phien: p.id, su_kien: sk });
    this.phat({ loai: 'phien', phien: this.metaPhien(p) });
  }

  async tuTram(ws, gan, tin) {
    if (!gan.xac_thuc) {
      if (tin.loai !== 'chao') return;
      const { dung } = await this.xuLy('kiem-khoa', { khoa: tin.khoa });
      if (!dung) {
        this.gui(ws, { loai: 'het_han', ly_do: 'Mã trạm không đúng hoặc đã thay. Mở trang Claude trong Sonicplan để lấy lệnh cài mới.' });
        try { ws.close(4001, 'sai ma'); } catch {}
        return;
      }
      // Chỉ một trạm cho mỗi tổ chức: trạm mới thay trạm cũ.
      for (const cu of this.mt.cacKetNoi('tram')) if (cu !== ws && this.mt.docGan(cu)?.xac_thuc) { this.gui(cu, { loai: 'het_han', ly_do: 'Một trạm khác vừa nối vào thay máy này.' }); try { cu.close(4002, 'tram moi'); } catch {} }
      this.mt.ganVao(ws, { ...gan, xac_thuc: true, may: String(tin.may || '').slice(0, 80), phien_ban: String(tin.phien_ban || '').slice(0, 20), claude: String(tin.claude || '').slice(0, 40) });
      this.gui(ws, { loai: 'da_nhan' });
      this.phat({ loai: 'trang_thai', ...(await this.trangThai()) });
      // Trạm vừa bật: giao các lượt đang chờ; lượt đã giao mà trạm cũ mất giữa chừng thì báo lỗi để người dùng gửi lại.
      for (const p of (await this.mt.kho.list({ prefix: 'phien:' })).values()) {
        if (!p.dang_chay) continue;
        if (p.cho_tram) await this.giaoChoTram(ws, p);
        else if (!(tin.dang_lam || []).includes(p.dang_chay)) await this.ketThuc(p, { luot: p.dang_chay, thanh_cong: false, loi: 'Trạm khởi động lại giữa chừng nên lượt này dừng. Gửi lại yêu cầu để làm tiếp.' });
      }
      return;
    }
    if (tin.loai === 'su_kien') {
      const p = await this.docPhien(tin.phien);
      if (!p) return;
      let doi = false;
      for (const s of (Array.isArray(tin.ds) ? tin.ds : []).slice(0, 200)) {
        if (!s || typeof s.loai !== 'string') continue;
        const sk = { ...s, luot: tin.luot };
        if (LUU_LAI.has(s.loai)) {
          if (s.loai === 'xong') continue; // xong đi đường riêng
          this.phat({ loai: 'su_kien', phien: p.id, su_kien: await this.ghiSuKien(p, sk) });
          doi = true;
        } else {
          this.phat({ loai: 'su_kien', phien: p.id, su_kien: { ...sk, tam: true } });
        }
      }
      if (doi) await this.mt.kho.put(`phien:${p.id}`, p);
      return;
    }
    if (tin.loai === 'bn') return this.phat({ ...tin, noi_dung: String(tin.noi_dung || '').slice(0, 40000) });
    if (tin.loai === 'xong') {
      const p = await this.docPhien(tin.phien);
      if (!p) return;
      if (tin.claude_session) p.claude_session = String(tin.claude_session).slice(0, 80);
      return this.ketThuc(p, tin);
    }
  }

  async ketThuc(p, tin) {
    const sk = await this.ghiSuKien(p, {
      loai: 'xong',
      luot: tin.luot || p.dang_chay,
      thanh_cong: Boolean(tin.thanh_cong),
      da_dung: Boolean(tin.da_dung),
      loi: tin.loi ? String(tin.loi).slice(0, 2000) : null,
      thoi_gian_ms: Number(tin.thoi_gian_ms) || null,
      chi_phi: Number(tin.chi_phi) || null,
      thu_muc: tin.thu_muc ? String(tin.thu_muc).slice(0, 400) : null,
    });
    Object.assign(p, { dang_chay: null, cho: null, cho_tram: false });
    await this.luuPhien(p);
    this.phat({ loai: 'su_kien', phien: p.id, su_kien: sk });
    this.phat({ loai: 'phien', phien: this.metaPhien(p) });
  }

  async dongKetNoi(ws) {
    const gan = this.mt.docGan(ws);
    if (gan?.vai_tro === 'tram' && gan.xac_thuc) this.phat({ loai: 'trang_thai', ...(await this.trangThai()) });
  }
}

// Durable Object của Cloudflare: một phòng cho mỗi tổ chức. Dùng API WebSocket ngủ đông:
// khi không có tin, phòng ngủ và không tính thời gian chạy.
export class TramClaude {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.phong = new PhongTram({
      kho: state.storage,
      cacKetNoi: (vaiTro) => state.getWebSockets(vaiTro),
      docGan: (ws) => { try { return ws.deserializeAttachment(); } catch { return null; } },
      ganVao: (ws, d) => ws.serializeAttachment(d),
    });
    // Trạm gửi "ping" mỗi 30 giây để giữ kết nối; trả "pong" mà không đánh thức phòng.
    try { state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch {}
  }

  async fetch(yeuCau) {
    const url = new URL(yeuCau.url);
    if (yeuCau.headers.get('upgrade') === 'websocket') {
      const vaiTro = url.searchParams.get('vai') === 'tram' ? 'tram' : 'nguoi';
      const cap = new WebSocketPair();
      this.state.acceptWebSocket(cap[1], [vaiTro]);
      cap[1].serializeAttachment({ vai_tro: vaiTro, xac_thuc: false, email: yeuCau.headers.get('x-email') || null });
      return new Response(null, { status: 101, webSocket: cap[0] });
    }
    const duLieu = yeuCau.method === 'POST' ? await yeuCau.json().catch(() => ({})) : {};
    return json(await this.phong.xuLy(url.pathname.slice(1), duLieu));
  }

  async webSocketMessage(ws, tin) {
    await this.phong.nhanTin(ws, tin);
  }

  async webSocketClose(ws, ma) {
    try { ws.close(ma, 'dong'); } catch {}
    await this.phong.dongKetNoi(ws);
  }

  async webSocketError(ws) {
    await this.phong.dongKetNoi(ws);
  }
}

// ---- Phía Worker: chuyển yêu cầu tới phòng của tổ chức ----

function phongCua(env, tc) {
  if (env.TRAM?.idFromName) return { loai: 'do', stub: env.TRAM.get(env.TRAM.idFromName(`tc:${tc}`)) };
  if (env.TRAM_NOI_BO) return { loai: 'noi-bo', phong: env.TRAM_NOI_BO.phong(tc) };
  return null;
}

async function goiPhong(env, tc, hanhDong, duLieu = {}) {
  const ph = phongCua(env, tc);
  if (!ph) return { loi: 'Máy chủ này chưa bật trang Claude.' };
  if (ph.loai === 'noi-bo') return ph.phong.xuLy(hanhDong, duLieu);
  const ra = await ph.stub.fetch(`https://tram/${hanhDong}`, { method: 'POST', body: JSON.stringify(duLieu) });
  return ra.json();
}

const khoaTep = (tc, phien, ten) => `tram/${tc}/${phien.replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'chung'}/${maNgauNhien(10)}-${tenTepAnToan(ten)}`;
export function tenTepAnToan(ten) {
  const t = String(ten || 'tep').normalize('NFC').replace(/[/\\\0\r\n]+/g, '_').replace(/^\.+/, '').trim().slice(-120);
  return t || 'tep';
}

async function luuTepTram(env, tc, phien, ten, yeuCau) {
  const do_dai = Number(yeuCau.headers.get('content-length') || 0);
  if (do_dai > TEP_TOI_DA) return loi(413, 'Tệp lớn quá 25 MB.');
  const duLieu = await yeuCau.arrayBuffer();
  if (duLieu.byteLength > TEP_TOI_DA) return loi(413, 'Tệp lớn quá 25 MB.');
  const khoa = khoaTep(tc, phien, ten);
  const loai = yeuCau.headers.get('content-type') || 'application/octet-stream';
  await env.TEP.put(khoa, duLieu, { httpMetadata: { contentType: loai } });
  return json({ khoa, ten: tenTepAnToan(ten), kich_thuoc: duLieu.byteLength, loai });
}

async function docTepTram(env, tc, khoa, taiVe) {
  if (!khoa || !khoa.startsWith(`tram/${tc}/`) || khoa.includes('..')) return loi(404, 'Không thấy tệp.');
  const vat = await env.TEP.get(khoa);
  if (!vat) return loi(404, 'Không thấy tệp.');
  const ten = khoa.split('/').pop().replace(/^[a-z0-9]{10}-/, '');
  const loai = vat.httpMetadata?.contentType || 'application/octet-stream';
  const xemDuoc = /^(image\/(png|jpe?g|gif|webp)|text\/plain|application\/pdf)/.test(loai) && !taiVe;
  return new Response(vat.body, {
    headers: {
      'content-type': loai,
      'content-disposition': `${xemDuoc ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(ten)}`,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

// /api/tram/* cho trình duyệt (đã qua Access và phiên đăng nhập).
export async function xuLyApiTram(yeuCau, env, phien, url) {
  const tc = phien.to_chuc.id;
  const p = url.pathname;
  const m = yeuCau.method;
  if (p === '/api/tram/ws') {
    if (yeuCau.headers.get('upgrade') !== 'websocket') return loi(426, 'Cần WebSocket.');
    const nguon = yeuCau.headers.get('origin');
    if (nguon && nguon !== url.origin) return loi(403, 'Kết nối không đến từ trang Sonicplan.');
    const ph = phongCua(env, tc);
    if (ph?.loai !== 'do') return loi(501, 'Máy chủ này chưa bật trang Claude.');
    const dau = new Headers(yeuCau.headers);
    dau.set('x-email', phien.email || '');
    return ph.stub.fetch(new Request('https://tram/ws?vai=nguoi', { headers: dau }));
  }
  if (p === '/api/tram/trang-thai' && m === 'GET') return json(await goiPhong(env, tc, 'trang-thai'));
  if (p === '/api/tram/lenh-cai' && m === 'POST') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức cài trạm Claude.');
    const kq = await goiPhong(env, tc, 'tao-khoa');
    if (!kq.khoa) return loi(501, kq.loi || 'Chưa tạo được mã trạm.');
    return json({ lenh: `curl -fsSL '${url.origin}/nhan/tram/cai?tc=${encodeURIComponent(tc)}&k=${kq.khoa}' | bash` });
  }
  if (p === '/api/tram/tep' && m === 'POST') {
    const ten = decodeURIComponent(yeuCau.headers.get('x-ten-tep') || 'tep');
    return luuTepTram(env, tc, String(url.searchParams.get('phien') || 'moi'), ten, yeuCau);
  }
  if (p === '/api/tram/tep' && m === 'GET') return docTepTram(env, tc, url.searchParams.get('k'), url.searchParams.get('tai') === '1');
  return loi(404, 'Không có địa chỉ này.');
}

async function kiemTram(yeuCau, env, url) {
  const tc = url.searchParams.get('tc') || '';
  const khoa = (yeuCau.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('k') || '';
  if (!/^[\w-]{1,64}$/.test(tc) || !/^[a-z0-9]{20,64}$/.test(khoa)) return null;
  const { dung } = await goiPhong(env, tc, 'kiem-khoa', { khoa });
  return dung ? tc : null;
}

// /nhan/tram/* cho trạm trên Mac (không qua Access, tự kiểm bằng mã trạm).
export async function nhanTram(yeuCau, env, url) {
  const p = url.pathname;
  if (p === '/nhan/tram/ws') {
    if (yeuCau.headers.get('upgrade') !== 'websocket') return loi(426, 'Cần WebSocket.');
    const tc = url.searchParams.get('tc') || '';
    const ph = tc && /^[\w-]{1,64}$/.test(tc) ? phongCua(env, tc) : null;
    if (ph?.loai !== 'do') return loi(501, 'Máy chủ này chưa bật trang Claude.');
    // Mã trạm kiểm trong tin "chao" đầu tiên, để mã không nằm trong đường dẫn ghi nhật ký.
    return ph.stub.fetch(new Request('https://tram/ws?vai=tram', { headers: yeuCau.headers }));
  }
  if (p === '/nhan/tram/cai' && yeuCau.method === 'GET') {
    const tc = await kiemTram(yeuCau, env, url);
    if (!tc) return new Response('echo "Mã không đúng hoặc đã thay. Mở trang Claude của Sonicplan và bấm Tạo lệnh cài mới."; exit 1\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return new Response(kichBanCai(url.origin, tc, url.searchParams.get('k')), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (p === '/nhan/tram/ma' && yeuCau.method === 'GET') {
    // Mã chương trình trạm (không chứa bí mật), lấy từ trang tĩnh.
    const ra = await env.ASSETS.fetch(new Request(new URL('/tram-claude.mjs', url.origin)));
    return new Response(ra.body, { status: ra.status, headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const tc = await kiemTram(yeuCau, env, url);
  if (!tc) return loi(401, 'Mã trạm không đúng.');
  if (p === '/nhan/tram/tep' && yeuCau.method === 'GET') return docTepTram(env, tc, url.searchParams.get('khoa'), true);
  if (p === '/nhan/tram/tep' && yeuCau.method === 'POST') {
    return luuTepTram(env, tc, String(url.searchParams.get('phien') || 'chung'), decodeURIComponent(url.searchParams.get('ten') || 'tep'), yeuCau);
  }
  return loi(404, 'Không có địa chỉ này.');
}

// Lệnh cài trạm trên máy Mac: kiểm Node 22 và Claude Code, tải chương trình trạm, ghi cấu hình, cài dịch vụ launchd.
export function kichBanCai(goc, tc, khoa) {
  return `#!/bin/bash
# Cài trạm Claude của Sonicplan trên máy Mac này.
set -e
NODE_BIN="$(command -v node || true)"
for d in /opt/homebrew/bin /usr/local/bin "$HOME/.volta/bin"; do [ -z "$NODE_BIN" ] && [ -x "$d/node" ] && NODE_BIN="$d/node"; done
CLAUDE_BIN="$(command -v claude || true)"
for d in "$HOME/.claude/local" "$HOME/.local/bin" /opt/homebrew/bin /usr/local/bin; do [ -z "$CLAUDE_BIN" ] && [ -x "$d/claude" ] && CLAUDE_BIN="$d/claude"; done
if [ -z "$NODE_BIN" ]; then echo "Máy này chưa có Node. Cài Node 22 (brew install node) rồi chạy lại lệnh."; exit 1; fi
BAN=$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')
if [ "$BAN" -lt 22 ]; then echo "Node trên máy là bản $BAN, cần bản 22 trở lên (brew upgrade node)."; exit 1; fi
if [ -z "$CLAUDE_BIN" ]; then echo "Máy này chưa có Claude Code. Cài Claude Code và đăng nhập (gõ claude) rồi chạy lại lệnh."; exit 1; fi
THU_MUC="$HOME/.sonicplan-tram"
mkdir -p "$THU_MUC"
curl -fsSL '${goc}/nhan/tram/ma' -o "$THU_MUC/tram-claude.mjs"
umask 077
cat > "$THU_MUC/cau-hinh.json" <<CAUHINH
{ "goc": "${goc}", "tc": "${tc}", "khoa": "${khoa}", "claude": "$CLAUDE_BIN", "thu_muc": "$HOME/Sonicplan Claude" }
CAUHINH
chmod 600 "$THU_MUC/cau-hinh.json"
PLIST="$HOME/Library/LaunchAgents/app.sonicplan.tram.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>app.sonicplan.tram</string>
  <key>ProgramArguments</key><array><string>$NODE_BIN</string><string>$THU_MUC/tram-claude.mjs</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$(dirname "$CLAUDE_BIN"):$(dirname "$NODE_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$THU_MUC/nhat-ky.log</string>
  <key>StandardErrorPath</key><string>$THU_MUC/nhat-ky.log</string>
</dict></plist>
PLISTEOF
launchctl bootout "gui/$(id -u)/app.sonicplan.tram" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Xong. Trạm Claude đã chạy trên máy này. Mở trang Claude trong Sonicplan, đèn trạm sẽ xanh sau vài giây."
echo "Tệp Claude tạo ra nằm ở: $HOME/Sonicplan Claude"
`;
}
