// Một việc làm Lịch Google trả 400 không được chặn các việc sau, và lỗi phải nêu đúng việc nào.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungCsdl, d1 } from './csdl-thu.js';
import { dongBoViec } from '../src/google.js';

test('việc có ngày hỏng bị Lịch từ chối: bỏ qua, việc sau vẫn lên Lịch, lỗi nêu mã việc', async () => {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'Thử', '2026-11-01T00:00:00Z')`);
  const them = db.prepare(`INSERT INTO viec (id, to_chuc_id, tieu_de, han_ngay, gio_hen, trang_thai, tao_luc, cap_nhat_luc, google_task_id) VALUES (?, 'tc1', ?, ?, ?, 'mo', '2026-11-02T01:00:00Z', '2026-11-02T01:00:00Z', 'gt')`);
  them.run(1, 'Việc hỏng giờ', '2026-11-01', '17h');
  them.run(341, 'Gặp anh Nam', '2026-11-03', '10:00');
  const goi = [];
  const that = globalThis.fetch;
  globalThis.fetch = async (url, tc) => {
    const thanBody = tc?.body ? JSON.parse(tc.body) : {};
    if (String(url).includes('/calendar/v3/') && tc.method === 'POST') {
      goi.push(thanBody.summary);
      if (String(thanBody.start?.dateTime).includes('17h')) return Response.json({ error: { message: 'Invalid start time.' } }, { status: 400 });
      return Response.json({ id: `ev-${thanBody.summary.length}` });
    }
    return Response.json({ items: [] });
  };
  try {
    const env = { CSDL: d1(db) };
    await assert.rejects(() => dongBoViec(env, 'tc1', 'tok'), /1 việc lỗi: #1 \(2026-11-01 17h\).*400/);
    assert.deepEqual(goi, ['Việc hỏng giờ', 'Gặp anh Nam']);
    assert.ok(db.prepare('SELECT lich_event_id FROM viec WHERE id = 341').get().lich_event_id, 'việc 341 phải có sự kiện Lịch');
    assert.equal(db.prepare('SELECT lich_event_id FROM viec WHERE id = 1').get().lich_event_id, null);
  } finally {
    globalThis.fetch = that;
  }
});
