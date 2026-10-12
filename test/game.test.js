import test from 'node:test';
import assert from 'node:assert/strict';
import { capTuXp, tinhGame, xpHaQuai } from '../src/game.js';

const v = (id, o) => ({ id, tieu_de: `Việc ${id}`, trang_thai: 'mo', tao_luc: '2026-10-10T01:00:00Z', ...o });

test('cấp theo điểm', () => {
  assert.deepEqual(capTuXp(0), { cap: 1, tu: 0, den: 100 });
  assert.deepEqual(capTuXp(100), { cap: 2, tu: 100, den: 300 });
  assert.equal(capTuXp(650).cap, 4);
});

test('điểm hạ quái theo hạn và đánh nhanh', () => {
  assert.equal(xpHaQuai({ do_nang: 'vua', han_goc: '2026-10-13', xong_luc: '2026-10-12T03:00:00Z' }).xp, 38);
  assert.equal(xpHaQuai({ do_nang: 'vua', han_goc: '2026-10-12', xong_luc: '2026-10-12T03:00:00Z' }).xp, 30);
  assert.equal(xpHaQuai({ do_nang: 'vua', han_goc: '2026-10-11', xong_luc: '2026-10-12T03:00:00Z' }).xp, 15);
  assert.equal(xpHaQuai({ do_nang: 'nhe', phut_uoc: 30, bat_dau_luc: '2026-10-12T02:50:00Z', xong_luc: '2026-10-12T03:00:00Z' }).xp, 12);
});

test('màn hôm nay, chuỗi, thành tích, việc con là đòn', () => {
  const ds = [
    v(1, { trang_thai: 'xong', xong_luc: '2026-10-11T03:00:00Z', do_nang: 'nhe', han_goc: '2026-10-11', han_ngay: '2026-10-11' }),
    v(2, { trang_thai: 'xong', xong_luc: '2026-10-12T03:00:00Z', do_nang: 'rat_nang' }),
    v(3, { han_ngay: '2026-10-12', han_goc: '2026-10-12', do_nang: 'nang', phut_uoc: 120 }),
    v(4, { han_ngay: '2026-10-12', viec_cha_id: 3, do_nang: 'vua', phut_uoc: 40 }),
    v(5, { trang_thai: 'xong', xong_luc: '2026-10-12T04:00:00Z', viec_cha_id: 3, do_nang: 'vua', phut_uoc: 60 }),
    v(6, { do_nang: 'vua' }),
  ];
  const g = tinhGame(ds, '2026-10-12', '2026-10-12T05:00:00Z');
  assert.equal(g.nhan_vat.chuoi, 2);
  assert.equal(g.nhan_vat.so_ha, 3);
  assert.equal(g.nhan_vat.so_man_qua, 1);
  assert.equal(g.man.quai.length, 1);
  assert.deepEqual([g.man.quai[0].mau, g.man.quai[0].mau_toi_da, g.man.quai[0].con.xong], [40, 100, 1]);
  assert.equal(g.man.quai[0].loai, 'golem');
  assert.equal(g.man.lang_thang.length, 1);
  assert.equal(g.man.qua_man, false);
  assert.ok(g.thanh_tich.find((t) => t.ma === 'diet-rong').dat);
  assert.ok(!g.thanh_tich.find((t) => t.ma === 'chuoi-3').dat);
});

test('dự án là Boss, việc trong dự án là boss nhỏ, hạ hết thì hạ Boss', () => {
  const da = [{ id: 1, ten: 'Đào tạo', mau: '#06c8be' }, { id: 2, ten: 'NCS', mau: null }];
  const ds = [
    v(1, { du_an_id: 1, trang_thai: 'xong', tao_luc: '2026-10-10T01:00:00Z', xong_luc: '2026-10-10T05:00:00Z', do_nang: 'vua' }),
    v(2, { du_an_id: 1, tao_luc: '2026-10-11T01:00:00Z', do_nang: 'nang', phut_uoc: 120, han_ngay: '2026-10-12' }),
    v(3, { du_an_id: 1, trang_thai: 'xong', tao_luc: '2026-10-11T01:00:00Z', xong_luc: '2026-10-12T02:00:00Z', do_nang: 'nhe', phut_uoc: 15 }),
    v(4, { du_an_id: 2, trang_thai: 'xong', tao_luc: '2026-10-11T01:00:00Z', xong_luc: '2026-10-11T03:00:00Z', do_nang: 'nhe' }),
    v(5, { du_an_id: 2, trang_thai: 'xong', tao_luc: '2026-10-11T02:00:00Z', xong_luc: '2026-10-12T03:00:00Z', do_nang: 'nhe' }),
    v(7, { du_an_id: 2, trang_thai: 'xong', tao_luc: '2026-10-11T02:00:00Z', xong_luc: '2026-10-12T01:00:00Z', do_nang: 'nhe' }),
    v(6, { do_nang: 'vua' }),
  ];
  const g = tinhGame(ds, '2026-10-12', '2026-10-12T05:00:00Z', da);
  // Dự án 1: hạ Boss lần 1 lúc việc 1 xong (chưa có việc khác), đợt mới còn việc 2 mở.
  assert.equal(g.boss.length, 1);
  const b = g.boss[0];
  // Đợt đầu chỉ 1 việc nên chưa tính hạ Boss, cộng dồn sang đợt hiện tại.
  assert.deepEqual([b.id, b.so_mo, b.so_xong, b.lan_ha, b.mau, b.toi_han], [1, 1, 2, 0, 120, 1]);
  assert.equal(b.boss_nho[0].id, 2);
  // Dự án 2: việc 4 xong lúc việc 5, 7 còn mở nên chưa hạ, việc 5 xong là việc cuối thì hạ (đợt 3 việc).
  assert.equal(g.nhan_vat.so_boss, 1);
  assert.equal(g.nhan_vat.so_ha, 5);
  assert.equal(g.nhat_ky[0].boss, true);
  assert.equal(g.nhat_ky[0].tieu_de, 'Boss NCS');
  assert.equal(g.nhat_ky[0].xp, 145);
  assert.deepEqual(g.quai_le.map((q) => q.id), [6]);
  assert.ok(g.thanh_tich.find((t) => t.ma === 'ha-boss').dat);
});
