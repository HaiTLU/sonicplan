// Kiểm thử phần thuần của giao việc cho Claude Code: lời dặn, kiểm tin báo kết quả, workflow mẫu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiemBaoKetQua, loiNhacClaude, MAU_WORKFLOW } from '../src/claude-code.js';

test('lời dặn có luật cố định, việc, hạn, ghi chú và lời dặn thêm', () => {
  const p = loiNhacClaude({ tieu_de: 'Soạn thư mời', ghi_chu: 'Gửi 20 khách', han_ngay: '2026-10-15', gio_hen: '09:00' }, 7, 'Giọng trang trọng');
  assert.match(p, /tiếng Việt/);
  assert.match(p, /ket-qua\/luot-7\//);
  assert.match(p, /Không gửi email/);
  assert.match(p, /Việc: Soạn thư mời/);
  assert.match(p, /Hạn: 2026-10-15 09:00/);
  assert.match(p, /Gửi 20 khách/);
  assert.match(p, /Giọng trang trọng/);
  assert.doesNotMatch(loiNhacClaude({ tieu_de: 'A' }, 1), /Người dùng dặn thêm|Hạn:/);
});

test('tin báo kết quả: kiểm số lượt, trạng thái, chỉ nhận liên kết github.com', () => {
  assert.ok(kiemBaoKetQua(null).loi);
  assert.ok(kiemBaoKetQua({ luot: 'x', trang_thai: 'xong' }).loi);
  assert.ok(kiemBaoKetQua({ luot: 3, trang_thai: 'cho' }).loi);
  const { du_lieu: d } = kiemBaoKetQua({ luot: 3, trang_thai: 'xong', ket_qua: 'a'.repeat(30000), pr: 'https://github.com/a/b/pull/1', nhanh: 'javascript:alert(1)', nhat_ky: 'https://evil.com/x' });
  assert.equal(d.luot, 3);
  assert.equal(d.ket_qua.length, 20000);
  assert.equal(d.pr, 'https://github.com/a/b/pull/1');
  assert.equal(d.nhanh, null);
  assert.equal(d.nhat_ky, null);
});

test('workflow mẫu: đúng action, khóa gói Max, không chèn đầu vào người dùng vào lệnh shell', () => {
  assert.match(MAU_WORKFLOW, /anthropics\/claude-code-action@v1/);
  assert.match(MAU_WORKFLOW, /secrets\.CLAUDE_CODE_OAUTH_TOKEN/);
  assert.match(MAU_WORKFLOW, /timeout-minutes: 30/);
  // Dòng run: không được dùng trực tiếp \${{ inputs.* }} (tránh chèn lệnh).
  for (const dong of MAU_WORKFLOW.split('\n').filter((d) => /^\s+(run:|\S.*\$\(|.*curl)/.test(d))) {
    assert.doesNotMatch(dong, /\$\{\{\s*inputs\./, dong);
  }
  assert.doesNotMatch(MAU_WORKFLOW, /\$\{\{\s*inputs\.ma_bao/);
  assert.doesNotMatch(MAU_WORKFLOW, /\t/);
});
