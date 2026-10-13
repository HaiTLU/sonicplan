// Hẹn giờ kiểu cron (giờ UTC, 5 trường) cho máy chủ Node: gọi worker.scheduled đúng như Cloudflare.
import { cacLich } from '../src/lich-chay.js';

function khopTruong(truong, giaTri) {
  return truong.split(',').some((p) => {
    if (p === '*') return true;
    const buoc = p.match(/^\*\/(\d+)$/);
    if (buoc) return giaTri % Number(buoc[1]) === 0;
    return /^\d+$/.test(p) && Number(p) === giaTri;
  });
}

export function khopCron(cron, luc = new Date()) {
  const t = cron.trim().split(/\s+/);
  if (t.length !== 5) return false;
  const [phut, gio, ngay, thang, thu] = t;
  return (
    khopTruong(phut, luc.getUTCMinutes()) &&
    khopTruong(gio, luc.getUTCHours()) &&
    khopTruong(ngay, luc.getUTCDate()) &&
    khopTruong(thang, luc.getUTCMonth() + 1) &&
    khopTruong(thu, luc.getUTCDay())
  );
}

export function batHenGio(worker, env, ctx, { lich = cacLich(), nho = console } = {}) {
  const dangChay = new Set();
  let hen;
  const canh = () => {
    const bayGio = new Date();
    for (const cron of lich) {
      if (!khopCron(cron, bayGio) || dangChay.has(cron)) continue;
      dangChay.add(cron);
      Promise.resolve(worker.scheduled({ cron, scheduledTime: bayGio.getTime() }, env, ctx))
        .catch((e) => nho.error('Hẹn giờ lỗi', cron, e))
        .finally(() => dangChay.delete(cron));
    }
    hen = setTimeout(canh, 60000 - (Date.now() % 60000) + 50);
  };
  hen = setTimeout(canh, 60000 - (Date.now() % 60000) + 50);
  return () => clearTimeout(hen);
}
