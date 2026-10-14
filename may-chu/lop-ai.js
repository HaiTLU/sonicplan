// Lớp thay env.AI: gọi Workers AI qua REST (cần CF_ACCOUNT_ID và CF_AI_TOKEN). Thiếu thì Sonicplan chạy không có AI.
export function moAi({ taiKhoan, token, fetchHam = fetch }) {
  if (!taiKhoan || !token) return undefined;
  return {
    run: async (moHinh, dauVao) => {
      const kq = await fetchHam(`https://api.cloudflare.com/client/v4/accounts/${taiKhoan}/ai/run/${moHinh}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(dauVao),
        signal: AbortSignal.timeout(120000),
      });
      const d = await kq.json().catch(() => ({}));
      if (!kq.ok || d.success === false) throw new Error(`Workers AI lỗi ${kq.status}: ${JSON.stringify(d.errors || d).slice(0, 200)}`);
      return d.result;
    },
  };
}
