// Kiểm thử phần thuần của giao việc sang GitHub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiemCauHinhGithub, thanIssue } from '../src/github.js';

test('kiểm token và tên kho, chấp nhận dán cả đường dẫn kho', () => {
  const token = `github_pat_${'a'.repeat(30)}`;
  assert.throws(() => kiemCauHinhGithub({ token: 'abc', repo: 'a/b' }), /Token/);
  assert.throws(() => kiemCauHinhGithub({ token, repo: 'khong-co-gach-cheo' }), /chủ-kho/);
  assert.deepEqual(kiemCauHinhGithub({ token, repo: 'https://github.com/HaiTLU/ThangLong_KB.git' }), { token, repo: 'HaiTLU/ThangLong_KB', nhan: 'viec-cho-claude' });
  assert.equal(kiemCauHinhGithub({ token, repo: 'a/b', nhan: 'cho-claude' }).nhan, 'cho-claude');
});

test('việc thành issue: tiêu đề, hạn, nguồn, nhãn', () => {
  const i = thanIssue({ id: 9, tieu_de: 'Soạn thư mời', ghi_chu: 'Gửi 20 khách', han_ngay: '2026-10-15', gio_hen: '09:00' }, 'viec-cho-claude');
  assert.equal(i.title, 'Soạn thư mời');
  assert.deepEqual(i.labels, ['viec-cho-claude']);
  assert.match(i.body, /Gửi 20 khách/);
  assert.match(i.body, /Hạn: 2026-10-15 09:00/);
  assert.match(i.body, /việc số 9/);
});
