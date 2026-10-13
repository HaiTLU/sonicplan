import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chayMigration } from '../may-chu/migrate.js';

function thuMuc(files) {
  const d = mkdtempSync(join(tmpdir(), 'mig-'));
  for (const [ten, sql] of Object.entries(files)) writeFileSync(join(d, ten), sql);
  return d;
}

test('migration: áp mỗi tệp một lần, tệp mới thì áp thêm', () => {
  const db = new DatabaseSync(':memory:');
  const d = thuMuc({ '0001_a.sql': 'CREATE TABLE to_chuc (id TEXT);', '0002_b.sql': 'ALTER TABLE to_chuc ADD COLUMN ten TEXT;' });
  assert.deepEqual(chayMigration(db, d).da_ap, ['0001_a.sql', '0002_b.sql']);
  assert.deepEqual(chayMigration(db, d).da_ap, [], 'chạy lại không áp nữa');
  const d2 = thuMuc({ '0001_a.sql': '', '0002_b.sql': '', '0003_c.sql': 'ALTER TABLE to_chuc ADD COLUMN mau TEXT;' });
  assert.deepEqual(chayMigration(db, d2).da_ap, ['0003_c.sql']);
});

test('migration: cơ sở dữ liệu có sẵn bảng mà chưa đánh dấu thì dừng, --co-san thì đánh dấu', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE to_chuc (id TEXT, ten TEXT)');
  const d = thuMuc({ '0001_a.sql': 'CREATE TABLE to_chuc (id TEXT);' });
  assert.throws(() => chayMigration(db, d), /--co-san/);
  assert.throws(() => chayMigration(db, d), /--co-san/, 'chạy lại vẫn dừng, không tự bỏ qua');
  assert.deepEqual(chayMigration(db, d, { coSan: true }).danh_dau, ['0001_a.sql']);
  assert.deepEqual(chayMigration(db, d).da_ap, []);
});

test('migration: tệp lỗi thì hoàn tác và báo tên tệp', () => {
  const db = new DatabaseSync(':memory:');
  const d = thuMuc({ '0001_a.sql': 'CREATE TABLE to_chuc (id TEXT);', '0002_x.sql': 'CREATE TABLE y (id TEXT); SELECT khong_co FROM z;' });
  assert.throws(() => chayMigration(db, d), /0002_x\.sql/);
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'y'").get(), undefined, 'bảng y đã hoàn tác');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM _migrations').get().n, 1, '0001 đã ghi, 0002 chưa');
});
