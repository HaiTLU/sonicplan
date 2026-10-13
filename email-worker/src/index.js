// Đẩy thư thô tới /nhan/thu của máy chủ Sonicplan. Lỗi tạm thì từ chối để bên gửi thử lại.
const TOI_DA = 25 * 1024 * 1024;

export default {
  async email(thu, env) {
    if (thu.rawSize > TOI_DA) {
      thu.setReject('Thư quá lớn.');
      return;
    }
    const raw = await new Response(thu.raw).arrayBuffer();
    let tl;
    try {
      tl = await fetch(env.DICH, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.THU_MA}`,
          'x-thu-to': encodeURIComponent(thu.to),
          'x-thu-from': encodeURIComponent(thu.from),
          'content-type': 'message/rfc822',
        },
        body: raw,
      });
    } catch {
      thu.setReject('Hệ thống tạm lỗi, gửi lại sau.');
      return;
    }
    if (!tl.ok) {
      thu.setReject('Hệ thống tạm lỗi, gửi lại sau.');
      return;
    }
    const kq = await tl.json().catch(() => ({}));
    if (kq.tu_choi) thu.setReject(kq.tu_choi);
  },
};
