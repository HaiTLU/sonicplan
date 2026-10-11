// Đường dẫn lịch dạng .ics: Google Calendar, Apple Calendar, Outlook tự đọc lại định kỳ.
// Không cần xin quyền ghi lịch; việc xong hoặc dời ngày thì lịch tự cập nhật ở lần đọc sau.

import { congNgay, sangUTC } from './tien-ich.js';

const PHUT_SU_KIEN = 30;

function ngayIcs(ngay) {
  return ngay.replaceAll('-', '');
}

function thoiDiemIcs(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function thoat(chuoi) {
  return String(chuoi || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Dòng dài quá 75 byte phải gấp lại theo chuẩn RFC 5545.
function gap(dong) {
  const bytes = new TextEncoder().encode(dong);
  if (bytes.length <= 75) return dong;
  const ra = [];
  let hienTai = '';
  let dem = 0;
  for (const kyTu of dong) {
    const n = new TextEncoder().encode(kyTu).length;
    if (dem + n > (ra.length ? 74 : 75)) {
      ra.push(hienTai);
      hienTai = '';
      dem = 0;
    }
    hienTai += kyTu;
    dem += n;
  }
  ra.push(hienTai);
  return ra.join('\r\n ');
}

export function taoIcs(cacViec, { ten = 'Sonicplan', mien = 'sonicplan.app', bayGio = new Date() } = {}) {
  const dong = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sonicplan//Viec//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${thoat(ten)}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const v of cacViec) {
    if (!v.han_ngay) continue;
    dong.push('BEGIN:VEVENT', `UID:viec-${v.id}@${mien}`, `DTSTAMP:${thoiDiemIcs(bayGio)}`);
    if (v.gio_hen) {
      const batDau = sangUTC(v.han_ngay, v.gio_hen);
      dong.push(`DTSTART:${thoiDiemIcs(batDau)}`, `DTEND:${thoiDiemIcs(new Date(batDau.getTime() + PHUT_SU_KIEN * 60000))}`);
    } else {
      dong.push(`DTSTART;VALUE=DATE:${ngayIcs(v.han_ngay)}`, `DTEND;VALUE=DATE:${ngayIcs(congNgay(v.han_ngay, 1))}`);
    }
    dong.push(`SUMMARY:${thoat(v.tieu_de)}`);
    if (v.ghi_chu) dong.push(`DESCRIPTION:${thoat(v.ghi_chu)}`);
    dong.push('END:VEVENT');
  }
  dong.push('END:VCALENDAR');
  return `${dong.map(gap).join('\r\n')}\r\n`;
}
