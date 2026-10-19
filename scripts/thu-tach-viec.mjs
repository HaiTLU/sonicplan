// Chạy thử lời dặn tách việc trên bộ tin mẫu (test/tin-mau/tach-viec.json) bằng AI thật. Dùng sau khi sửa src/ai.js.
// Chạy trên Mac mini (cần lệnh claude đã đăng nhập): node scripts/thu-tach-viec.mjs
// Mỗi tin chạy riêng một lượt, so với đáp án co_viec và gio_hen. Có tin sai thì thoát mã 1.
import { readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { tachViec } from '../src/ai.js';
import { moAiClaudeCode } from '../may-chu/ai-claude-code.js';

const bo = JSON.parse(readFileSync(new URL('../test/tin-mau/tach-viec.json', import.meta.url), 'utf8'));
const claudeBin = process.env.CLAUDE_BIN || join(homedir(), '.local', 'bin', 'claude');
const env = { CLAUDE_CODE_AI: moAiClaudeCode({ claudeBin, thuMuc: join(tmpdir(), 'sonicplan-thu-tach-viec') }) };

let sai = 0;
for (const c of bo.cac_tin) {
  try {
    const kq = await tachViec(env, (c.lo || [c.tin]).map((t, i) => ({ ...t, so: i + 1 })), bo.hom_nay, 'Hải', {});
    const viec = kq.viec || [];
    const loi = [];
    if (Boolean(viec.length) !== c.co_viec) loi.push(`mong ${c.co_viec ? 'có' : 'không có'} việc, AI tạo ${viec.length}`);
    if (c.gio_hen && viec[0]?.gio_hen !== c.gio_hen) loi.push(`mong giờ ${c.gio_hen}, AI ghi ${viec[0]?.gio_hen || 'trống'}`);
    console.log(`${loi.length ? 'SAI' : 'ĐÚNG'}  ${c.ten}${loi.length ? `: ${loi.join('; ')}` : ''}`);
    if (loi.length) sai++;
  } catch (e) {
    sai++;
    console.log(`LỖI  ${c.ten}: ${String(e.message || e).slice(0, 150)}`);
  }
}
console.log(`\n${bo.cac_tin.length - sai}/${bo.cac_tin.length} đúng`);
process.exit(sai ? 1 : 0);
