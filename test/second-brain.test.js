import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { moSecondBrain } from '../may-chu/second-brain.js';

async function nguon(t) {
  const goc = await fs.mkdtemp(path.join(os.tmpdir(), 'sonicplan-brain-'));
  t.after(() => fs.rm(goc, { recursive: true, force: true }));
  await fs.mkdir(path.join(goc, 'memory/projects'), { recursive: true });
  await fs.mkdir(path.join(goc, 'memory/context/bai-hoc'), { recursive: true });
  await fs.writeFile(path.join(goc, 'memory/projects/a.md'), '# Dự án A\nNội dung thật.');
  return goc;
}

test('second-brain chỉ trả đúng nguồn cho tổ chức được cấu hình, có phiên bản và bản sao độc lập', async t => {
  const goc = await nguon(t);
  const reader = moSecondBrain({ thuMuc: goc, toChucId: 'org-a' });
  assert.deepEqual(await reader.doc('org-b'), { trang_thai: 'unconfigured', doc_luc: null, ds: [] });
  const first = await reader.doc('org-a');
  assert.equal(first.trang_thai, 'ok');
  assert.equal(first.ds[0].duong_dan, 'memory/projects/a.md');
  assert.equal(first.ds[0].tieu_de, 'Dự án A');
  assert.match(first.ds[0].phien_ban, /^[a-f0-9]{64}$/);
  assert.ok(first.doc_luc && first.ds[0].cap_nhat_luc);
  first.ds[0].noi_dung = 'bị sửa';
  assert.notEqual((await reader.doc('org-a')).ds[0].noi_dung, 'bị sửa');
  assert.equal((await reader.doc('org-b')).ds.length, 0);
});

test('second-brain không có cấu hình không đọc dữ liệu', async () => {
  assert.equal((await moSecondBrain().doc('org-a')).trang_thai, 'unconfigured');
});

test('second-brain bỏ symlink, tệp ngoài vùng, tệp quá lớn và giữ mục lục trong vùng', async t => {
  const goc = await nguon(t);
  await fs.writeFile(path.join(goc, 'secret.md'), '# Bí mật');
  await fs.symlink(path.join(goc, 'secret.md'), path.join(goc, 'memory/projects/link.md'));
  await fs.symlink(goc, path.join(goc, 'memory/projects/ngoai'));
  await fs.writeFile(path.join(goc, 'memory/context/bai-hoc/MUC-LUC.md'), '# Mục lục');
  await fs.writeFile(path.join(goc, 'memory/projects/large.md'), 'x'.repeat(129 * 1024));
  const data = await moSecondBrain({ thuMuc: goc, toChucId: 'a' }).doc('a');
  assert.equal(data.trang_thai, 'ok');
  assert.deepEqual(data.ds.map(d => d.duong_dan).sort(), ['memory/context/bai-hoc/MUC-LUC.md', 'memory/projects/a.md']);
});

test('second-brain nguồn bị mất giữ dữ liệu cùng thời điểm đọc thành công gần nhất', async t => {
  const goc = await nguon(t);
  const reader = moSecondBrain({ thuMuc: goc, toChucId: 'a', lamMoiMs: 0 });
  const first = await reader.doc('a');
  await fs.rename(path.join(goc, 'memory'), path.join(goc, 'memory-offline'));
  const stale = await reader.doc('a');
  assert.equal(stale.trang_thai, 'stale');
  assert.equal(stale.doc_luc, first.doc_luc);
  assert.deepEqual(stale.ds, first.ds);
  assert.ok(stale.loi);
});

test('second-brain không đi qua symlink của thư mục nguồn', async t => {
  const goc = await nguon(t);
  await fs.rename(path.join(goc, 'memory/projects'), path.join(goc, 'projects'));
  await fs.symlink(path.join(goc, 'projects'), path.join(goc, 'memory/projects'));
  const data = await moSecondBrain({ thuMuc: goc, toChucId: 'a' }).doc('a');
  assert.equal(data.trang_thai, 'stale');
  assert.deepEqual(data.ds, []);
});
