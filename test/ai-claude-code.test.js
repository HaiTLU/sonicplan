import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moAiClaudeCode } from '../may-chu/ai-claude-code.js';
import { chayAi } from '../src/ai.js';

test('Không thể bật lại cầu nối Claude Code bằng cấu hình cũ', () => {
  assert.throws(() => moAiClaudeCode({ spawnHam: () => assert.fail('Không được chạy tiến trình') }), /ngừng sử dụng/);
});

test('AI bỏ qua Claude Code kể cả môi trường cũ vẫn gắn cầu nối', async () => {
  const env = {
    CLAUDE_CODE_AI: { chay: () => assert.fail('Không được dùng Max') },
    AI: { run: async () => ({ response: 'ok' }) },
  };
  assert.equal(await chayAi(env, {}, [{ role: 'user', content: 'ok' }], { maxTokens: 16 }), 'ok');
});

test('Không có Workers AI thì báo lỗi, không gọi Max', async () => {
  const env = { CLAUDE_CODE_AI: { chay: () => assert.fail('Không được dùng Max') } };
  await assert.rejects(chayAi(env, {}, [], { maxTokens: 16 }), /Chưa nối AI/);
});
