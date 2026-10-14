import test from 'node:test';
import assert from 'node:assert/strict';
import { chuanHoaCauHinhAi, chayAiNgoai, loiAi } from '../src/tich-hop.js';

const KHOA = 'sk-ant-' + 'x'.repeat(30);

test('Claude: Workspace ID là tùy chọn, chỉ nhận ký tự hợp lệ', () => {
  assert.equal(chuanHoaCauHinhAi({ loai: 'claude', khoa: KHOA }).workspace_id, undefined);
  assert.equal(chuanHoaCauHinhAi({ loai: 'claude', khoa: KHOA, workspace_id: ' wrkspc_01AbC ' }).workspace_id, 'wrkspc_01AbC');
  assert.throws(() => chuanHoaCauHinhAi({ loai: 'claude', khoa: KHOA, workspace_id: 'a b\r\nx' }), /Workspace ID/);
  assert.equal(chuanHoaCauHinhAi({ loai: 'claude', khoa: KHOA }).mo_hinh, 'claude-sonnet-5-5');
});

test('lỗi 400 thiếu workspace được giải thích bằng tiếng Việt', () => {
  const m = loiAi('Claude', 400, 'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header');
  assert.match(m, /console\.anthropic\.com/);
  assert.match(m, /Workspace ID/);
  assert.doesNotMatch(m, /anthropic-workspace-id header/);
  assert.match(loiAi('Claude', 401, ''), /Khóa sai/);
});

test('gửi header anthropic-workspace-id khi có', async () => {
  const goc = globalThis.fetch;
  const dau = [];
  globalThis.fetch = async (url, op) => { dau.push(op.headers); return new Response(JSON.stringify({ content: [{ text: 'ok' }] }), { status: 200 }); };
  try {
    await chayAiNgoai({ loai: 'claude', khoa: KHOA, mo_hinh: 'm', workspace_id: 'wrkspc_1' }, [{ role: 'user', content: 'a' }]);
    await chayAiNgoai({ loai: 'claude', khoa: KHOA, mo_hinh: 'm' }, [{ role: 'user', content: 'a' }]);
  } finally { globalThis.fetch = goc; }
  assert.equal(dau[0]['anthropic-workspace-id'], 'wrkspc_1');
  assert.equal(dau[1]['anthropic-workspace-id'], undefined);
});
