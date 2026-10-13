// Giao một việc cho Claude Code chạy trên GitHub Actions của khách, nhận kết quả về hiện ngay trên thẻ việc.
// Luồng: nút "Giao Claude" -> tạo lượt (luot_claude) -> gọi GitHub chạy workflow ĐƯỜNG_WORKFLOW
// -> workflow báo "đang làm" rồi "xong"/"lỗi" về /nhan/claude kèm mã dùng một lần của lượt.
// Khóa Claude (gói Max: CLAUDE_CODE_OAUTH_TOKEN) nằm trong Secrets của kho GitHub, Sonicplan không giữ.

import { goiGithub } from './github.js';
import { docTichHop } from './tich-hop.js';
import { baoToChuc } from './telegram.js';
import { bam, json, loi, maNgauNhien } from './tien-ich.js';

export const TEN_WORKFLOW = 'sonicplan-claude.yml';
export const DUONG_WORKFLOW = `.github/workflows/${TEN_WORKFLOW}`;
export const TRAN_MOI_NGAY = 20;
const QUA_HAN_PHUT = 50; // workflow tự dừng ở 30 phút; quá 50 phút chưa báo thì coi là lỗi
const TRANG_THAI = ['dang_lam', 'xong', 'loi'];

// Workflow cài vào kho của khách. Giá trị người dùng nhập chỉ đi qua biến môi trường, không chèn thẳng vào lệnh shell;
// mã báo đọc từ tệp sự kiện để không hiện trong nhật ký bước chạy.
export const MAU_WORKFLOW = `# Sonicplan cài tệp này để Claude Code làm việc được giao từ trang Sonicplan.
# Cần một secret của kho: CLAUDE_CODE_OAUTH_TOKEN (tạo bằng lệnh: claude setup-token).
name: Sonicplan - Claude lam viec
on:
  workflow_dispatch:
    inputs:
      luot: { description: 'So luot', required: true }
      yeu_cau: { description: 'Viec can lam', required: true }
      dia_chi_bao: { description: 'Dia chi bao ket qua', required: true }
      ma_bao: { description: 'Ma bao ket qua, dung mot lan', required: true }
permissions:
  contents: write
  pull-requests: write
  issues: write
concurrency:
  group: sonicplan-luot-\${{ inputs.luot }}
jobs:
  lam:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      LUOT: \${{ inputs.luot }}
    steps:
      - name: Che ma bao
        run: echo "::add-mask::$(jq -r .inputs.ma_bao "$GITHUB_EVENT_PATH")"
      - uses: actions/checkout@v4
      - name: Bao dang lam
        env: { DIA_CHI: '\${{ inputs.dia_chi_bao }}' }
        run: |
          MA=$(jq -r .inputs.ma_bao "$GITHUB_EVENT_PATH")
          URL="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
          jq -n --arg l "$LUOT" --arg u "$URL" '{luot:($l|tonumber),trang_thai:"dang_lam",nhat_ky:$u}' \\
            | curl -sS -X POST "$DIA_CHI" -H "authorization: Bearer $MA" -H 'content-type: application/json' --data-binary @- || true
      - name: Claude lam
        id: claude
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          github_token: \${{ github.token }}
          claude_args: >-
            --max-turns 40
            --allowedTools "Read,Write,Edit,MultiEdit,Glob,Grep,WebSearch,WebFetch,Bash(ls:*),Bash(cat:*),Bash(python3:*),Bash(node:*),Bash(npm test:*)"
          prompt: \${{ inputs.yeu_cau }}
      - name: Luu tep va mo PR
        id: luu
        if: always()
        env: { GH_TOKEN: '\${{ github.token }}' }
        run: |
          [ -z "$(git status --porcelain)" ] && exit 0
          NHANH="sonicplan/luot-$LUOT"
          git config user.name "Sonicplan"
          git config user.email "sonicplan@users.noreply.github.com"
          git checkout -b "$NHANH"
          git add -A
          SUA_MA=$(git diff --cached --name-only | grep -v '^ket-qua/' || true)
          git commit -qm "Sonicplan: ket qua luot $LUOT"
          git push -q -u origin "$NHANH"
          echo "nhanh=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/tree/$NHANH" >> "$GITHUB_OUTPUT"
          if [ -n "$SUA_MA" ]; then
            PR=$(gh pr create --draft --head "$NHANH" --title "Sonicplan luot $LUOT" --body "Claude lam theo viec giao tu Sonicplan.") && echo "pr=$PR" >> "$GITHUB_OUTPUT"
          fi
      - name: Bao ket qua
        if: always()
        env:
          DIA_CHI: '\${{ inputs.dia_chi_bao }}'
          TEP_CHAY: '\${{ steps.claude.outputs.execution_file }}'
          KET_THUC: '\${{ steps.claude.outcome }}'
          NHANH: '\${{ steps.luu.outputs.nhanh }}'
          PR: '\${{ steps.luu.outputs.pr }}'
        run: |
          MA=$(jq -r .inputs.ma_bao "$GITHUB_EVENT_PATH")
          KQ=""
          [ -f "$TEP_CHAY" ] && KQ=$(jq -r '[.[] | select(.type=="result")] | last | .result // empty' "$TEP_CHAY" 2>/dev/null || true)
          [ -z "$KQ" ] && [ -f "ket-qua/luot-$LUOT/KET-QUA.md" ] && KQ=$(cat "ket-qua/luot-$LUOT/KET-QUA.md")
          TT=xong; [ "$KET_THUC" != "success" ] && TT=loi
          URL="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
          jq -n --arg l "$LUOT" --arg t "$TT" --arg k "$KQ" --arg n "$NHANH" --arg p "$PR" --arg u "$URL" \\
            '{luot:($l|tonumber),trang_thai:$t,ket_qua:$k,nhanh:$n,pr:$p,nhat_ky:$u}' \\
            | curl -sS -X POST "$DIA_CHI" -H "authorization: Bearer $MA" -H 'content-type: application/json' --data-binary @-
`;

// Lời dặn gửi Claude: luật cố định trước, rồi việc và lời dặn thêm của người dùng.
export function loiNhacClaude(viec, luotId, dan) {
  return [
    'Bạn là trợ lý làm việc thay người dùng Sonicplan. Trả lời và viết mọi thứ bằng tiếng Việt dễ hiểu.',
    `Nếu tạo tệp kết quả (văn bản, bảng, bản nháp), lưu trong thư mục ket-qua/luot-${luotId}/.`,
    'Nếu việc là sửa mã của kho này thì sửa thẳng trong kho; hệ thống sẽ tự mở PR nháp để người dùng duyệt.',
    'Không gửi email, tin nhắn hay đăng bất cứ gì ra ngoài; chỉ soạn bản nháp.',
    'Cuối cùng trả lời ngắn: đã làm gì, kết quả chính, tệp nào, còn gì người dùng phải tự làm.',
    '',
    `Việc: ${viec.tieu_de}`,
    viec.han_ngay ? `Hạn: ${viec.han_ngay}${viec.gio_hen ? ` ${viec.gio_hen}` : ''}` : '',
    viec.ghi_chu ? `Ghi chú của việc:\n${viec.ghi_chu}` : '',
    dan ? `Người dùng dặn thêm:\n${dan}` : '',
  ].filter((d, i) => d || i === 5).join('\n').slice(0, 20000);
}

// Kiểm thân tin workflow gửi về. Trả { loi } hoặc { du_lieu }.
export function kiemBaoKetQua(than) {
  if (!than || typeof than !== 'object') return { loi: 'Gửi JSON.' };
  const luot = Number(than.luot);
  if (!Number.isInteger(luot) || luot < 1) return { loi: 'Thiếu số lượt.' };
  if (!TRANG_THAI.includes(than.trang_thai)) return { loi: 'Trạng thái không hợp lệ.' };
  const lienKet = (x) => (typeof x === 'string' && /^https:\/\/github\.com\/[^\s]{1,300}$/.test(x) ? x : null);
  return {
    du_lieu: {
      luot,
      trang_thai: than.trang_thai,
      ket_qua: typeof than.ket_qua === 'string' ? than.ket_qua.slice(0, 20000) : null,
      nhanh: lienKet(than.nhanh),
      pr: lienKet(than.pr),
      nhat_ky: lienKet(than.nhat_ky),
    },
  };
}

// ---- Phía người dùng ----

export async function cauHinhClaude(env, tc) {
  return docTichHop(env, tc, 'github');
}

// Cài (hoặc cập nhật) workflow vào kho đã nối. Token cần quyền Contents và Workflows (ghi).
export async function caiWorkflow(cauHinh) {
  let sha;
  try {
    sha = (await goiGithub(cauHinh, `/repos/${cauHinh.repo}/contents/${DUONG_WORKFLOW}`)).sha;
  } catch (e) {
    if (!/\(404\)/.test(e.message)) throw e;
  }
  try {
    await goiGithub(cauHinh, `/repos/${cauHinh.repo}/contents/${DUONG_WORKFLOW}`, {
      method: 'PUT',
      body: { message: 'Sonicplan: cài luồng Claude làm việc', content: btoa(String.fromCharCode(...new TextEncoder().encode(MAU_WORKFLOW))), ...(sha ? { sha } : {}) },
    });
  } catch (e) {
    if (/\((403|404)\)/.test(e.message)) throw new Error('Token chưa có quyền ghi Contents và Workflows trên kho này. Tạo lại token có đủ hai quyền đó.');
    throw e;
  }
}

export async function giaoClaude(env, tc, viecId, dan, goc) {
  const cauHinh = await cauHinhClaude(env, tc);
  if (!cauHinh) return { ma: 400, loi: 'Chưa nối GitHub. Vào Kết nối, mục Claude Code.' };
  const viec = await env.CSDL.prepare('SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen, trang_thai FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(viecId, tc).first();
  if (!viec) return { ma: 404, loi: 'Không tìm thấy việc.' };
  if (viec.trang_thai !== 'mo') return { ma: 400, loi: 'Việc này đã đóng.' };
  await danhDauQuaHan(env, tc);
  const dangChay = await env.CSDL.prepare(`SELECT id FROM luot_claude WHERE to_chuc_id = ?1 AND viec_id = ?2 AND trang_thai IN ('cho', 'dang_lam')`).bind(tc, viecId).first();
  if (dangChay) return { ma: 409, loi: 'Claude đang làm việc này, chờ xong rồi giao lại.' };
  const homNay = new Date(Date.now() - 86400000).toISOString();
  const { so } = await env.CSDL.prepare('SELECT COUNT(*) AS so FROM luot_claude WHERE to_chuc_id = ?1 AND tao_luc > ?2').bind(tc, homNay).first();
  if (so >= TRAN_MOI_NGAY) return { ma: 429, loi: `Đã giao ${TRAN_MOI_NGAY} lượt trong 24 giờ qua, thử lại sau.` };

  const ma = maNgauNhien(40);
  const bayGio = new Date().toISOString();
  const danSach = String(dan || '').trim().slice(0, 4000) || null;
  const { meta } = await env.CSDL.prepare('INSERT INTO luot_claude (to_chuc_id, viec_id, dan, ma_bam, tao_luc, cap_nhat_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?5)')
    .bind(tc, viecId, danSach, await bam(ma), bayGio).run();
  const luotId = meta.last_row_id;
  try {
    const kho = await goiGithub(cauHinh, `/repos/${cauHinh.repo}`);
    await goiGithub(cauHinh, `/repos/${cauHinh.repo}/actions/workflows/${TEN_WORKFLOW}/dispatches`, {
      method: 'POST',
      body: { ref: kho.default_branch || 'main', inputs: { luot: String(luotId), yeu_cau: loiNhacClaude(viec, luotId, danSach), dia_chi_bao: `${goc}/nhan/claude`, ma_bao: ma } },
    });
  } catch (e) {
    const thongBao = /\(404\)/.test(e.message) ? 'Kho chưa có luồng Claude. Vào Kết nối, bấm "Cài luồng Claude".' : e.message;
    await capNhatLuot(env, luotId, { trang_thai: 'loi', ket_qua: thongBao });
    return { ma: 502, loi: thongBao };
  }
  return { luot: luotId };
}

function capNhatLuot(env, luotId, d) {
  return env.CSDL.prepare(
    `UPDATE luot_claude SET trang_thai = ?1, ket_qua = COALESCE(?2, ket_qua), nhanh = COALESCE(?3, nhanh), pr = COALESCE(?4, pr),
       nhat_ky = COALESCE(?5, nhat_ky), cap_nhat_luc = ?6 WHERE id = ?7`,
  ).bind(d.trang_thai, d.ket_qua ?? null, d.nhanh ?? null, d.pr ?? null, d.nhat_ky ?? null, new Date().toISOString(), luotId).run();
}

// Lượt quá lâu không báo về (workflow chưa cài, hết lượt chạy, GitHub lỗi) thì đổi sang lỗi để người dùng giao lại được.
function danhDauQuaHan(env, tc) {
  return env.CSDL.prepare(
    `UPDATE luot_claude SET trang_thai = 'loi', ket_qua = COALESCE(ket_qua, 'Không nhận được kết quả từ GitHub. Bấm "Xem nhật ký" để xem lý do, rồi giao lại.'), cap_nhat_luc = ?2
     WHERE to_chuc_id = ?1 AND trang_thai IN ('cho', 'dang_lam') AND tao_luc < ?3`,
  ).bind(tc, new Date().toISOString(), new Date(Date.now() - QUA_HAN_PHUT * 60000).toISOString()).run();
}

export async function dsLuot(env, tc, viecId) {
  await danhDauQuaHan(env, tc);
  const { results } = await env.CSDL.prepare(
    'SELECT id, trang_thai, dan, ket_qua, nhanh, pr, nhat_ky, danh_gia, tao_luc, cap_nhat_luc FROM luot_claude WHERE to_chuc_id = ?1 AND viec_id = ?2 ORDER BY id DESC LIMIT 5',
  ).bind(tc, viecId).all();
  return results;
}

export async function danhGiaLuot(env, tc, luotId, danhGia) {
  if (!['dat', 'lam_lai'].includes(danhGia)) return { ma: 400, loi: 'Chọn Đạt hoặc Làm lại.' };
  const r = await env.CSDL.prepare(`UPDATE luot_claude SET danh_gia = ?1, cap_nhat_luc = ?2 WHERE id = ?3 AND to_chuc_id = ?4 AND trang_thai = 'xong'`)
    .bind(danhGia, new Date().toISOString(), luotId, tc).run();
  return r.meta.changes ? { ok: true } : { ma: 404, loi: 'Không tìm thấy lượt đã xong.' };
}

// ---- Workflow gọi vào (không qua đăng nhập, tự kiểm mã dùng một lần của lượt) ----

export async function nhanKetQuaClaude(yeuCau, env) {
  if (yeuCau.method !== 'POST') return loi(405, 'Dùng POST.');
  const ma = (yeuCau.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (ma.length < 20) return loi(401, 'Thiếu mã.');
  const k = kiemBaoKetQua(await yeuCau.json().catch(() => null));
  if (k.loi) return loi(400, k.loi);
  const d = k.du_lieu;
  const luot = await env.CSDL.prepare('SELECT l.id, l.to_chuc_id, l.trang_thai, l.ma_bam, v.tieu_de FROM luot_claude l JOIN viec v ON v.id = l.viec_id WHERE l.id = ?1').bind(d.luot).first();
  if (!luot || luot.ma_bam !== (await bam(ma))) return loi(401, 'Mã không đúng.');
  if (luot.trang_thai === 'xong' || luot.trang_thai === 'loi') return loi(409, 'Lượt này đã kết thúc.');
  await capNhatLuot(env, luot.id, d);
  if (d.trang_thai !== 'dang_lam') {
    const cau = d.trang_thai === 'xong' ? `Claude đã làm xong: ${luot.tieu_de}. Mở Sonicplan để xem kết quả và duyệt.` : `Claude gặp lỗi khi làm: ${luot.tieu_de}. Mở Sonicplan để xem nhật ký.`;
    await baoToChuc(env, luot.to_chuc_id, cau).catch((e) => console.error('Không báo được Telegram', e));
  }
  return json({ ok: true });
}
