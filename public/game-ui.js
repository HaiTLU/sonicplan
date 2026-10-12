// Khu chế độ game ở đầu trang Hiệu suất: công tắc, thẻ chọn Boss (mỗi dự án một Boss), đảo quái, thẻ nhân vật,
// bảng trận, thành tích.

import { anhBoss, anhNhanVat, anhQuaiNho, taoCanh } from './game.js';
import { gioPhut, moBangChia } from './hieu-suat.js';

const TEN_KIEU = { som: 'hạ sớm', dung_han: 'đúng hạn', tre: 'trễ hạn', thuong: '' };
let canhHienTai = null;
let theChon = null; // id dự án của Boss đang xem, hoặc 'le' cho quái lẻ

const veAnh = (c, a) => { c.width = a.width; c.height = a.height; c.getContext('2d').drawImage(a, 0, 0); return c; };

function congTac(h, nhan, bat, doi) {
  const o = h('input', { type: 'checkbox', role: 'switch', checked: bat });
  o.addEventListener('change', () => doi(o.checked, o));
  return h('label', { class: 'gm-cong-tac' }, o, h('span', { class: 'gm-nut-gat', 'aria-hidden': 'true' }), h('span', { text: nhan }));
}

export async function veKhuGame(goc, t, napTrang) {
  const { h, icon, api, bao, thay, xuong } = t;
  if (canhHienTai) { canhHienTai.huy(); canhHienTai = null; }
  let g;
  try { g = await api('/api/game'); } catch (e) { thay(goc, h('p', { class: 'mo-ta', text: e.message })); return; }
  const giam = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doiCaiDat = async (than, o) => {
    try { await api('/api/game/cai-dat', { method: 'PUT', body: JSON.stringify(than) }); veKhuGame(goc, t, napTrang); } catch (e) { bao(e.message, { loi: true }); if (o) o.checked = !o.checked; }
  };

  if (!g.bat) {
    thay(goc, h('section', { class: 'bang gm-tat' },
      h('div', {}, h('h2', {}, 'Chế độ game'), h('p', { class: 'mo-ta', text: 'Mỗi dự án là một Boss, mỗi việc trong dự án là một boss nhỏ: việc càng nặng quái càng to. Xong việc là hạ boss nhỏ, hạ hết thì hạ Boss. Xong trước hạn được thêm điểm. Mỗi ngày là một màn, nhân vật của bạn lên cấp và có thành tích.' })),
      congTac(h, 'Bật', false, (b, o) => doiCaiDat({ bat: b }, o)),
    ));
    return;
  }

  const nv = g.nhan_vat;
  const man = g.man;
  const tongMan = man.quai.length + man.da_ha;
  const tatCa = [...g.boss.flatMap((b) => b.boss_nho), ...g.quai_le];
  if (!g.boss.some((b) => b.id === theChon) && !(theChon === 'le' && g.quai_le.length)) theChon = g.boss[0]?.id ?? 'le';
  const bossChon = g.boss.find((b) => b.id === theChon) || null;
  const trongCanh = bossChon ? bossChon.boss_nho : g.quai_le;
  const bossCua = (q) => g.boss.find((b) => b.id === q.du_an_id) || null;

  // Thẻ chọn Boss: mỗi dự án còn việc mở là một thẻ, cuối cùng là quái lẻ.
  const the = (khoa, anh, ten, so, toiHan) => {
    const nut = h('button', { type: 'button', role: 'tab', class: 'gm-the', 'aria-selected': String(khoa === theChon), onclick: () => { theChon = khoa; veKhuGame(goc, t, napTrang); } },
      veAnh(h('canvas', { 'aria-hidden': 'true' }), anh), h('span', { text: ten }), h('small', { text: so }));
    if (toiHan) nut.append(h('i', { class: 'gm-cham', title: `${toiHan} việc tới hạn` }));
    return nut;
  };
  const dsThe = h('div', { class: 'gm-ds-the', role: 'tablist', 'aria-label': 'Chọn Boss' },
    ...g.boss.map((b) => the(b.id, anhBoss(b.loai, b.mau_du_an, 1), b.ten, b.so_mo, b.toi_han)),
    g.quai_le.length ? the('le', anhQuaiNho('goblin', 0, 1.4), 'Quái lẻ', g.quai_le.length, g.quai_le.filter((q) => q.han_ngay && q.han_ngay <= man.ngay).length) : null,
  );

  const khungCanh = h('div', { class: 'gm-khung' });
  const bangTran = h('div', { class: 'gm-tran', 'aria-live': 'polite' });
  const bangChu = h('div', { class: 'gm-bang-chu' },
    h('div', { class: 'gm-man' },
      h('b', { text: `Màn ${man.ngay.slice(8, 10)}/${man.ngay.slice(5, 7)}` }),
      h('span', { text: man.qua_man ? 'Đã qua màn' : man.quai.length ? `${man.da_ha}/${tongMan} quái đã hạ` : 'Không có quái hạn hôm nay' }),
      h('span', { class: 'gm-thanh' }, h('i', { style: `width:${tongMan ? (man.da_ha / tongMan) * 100 : man.qua_man ? 100 : 0}%` })),
    ),
    h('div', { class: 'gm-chuoi', title: `Chuỗi dài nhất ${nv.chuoi_dai_nhat} ngày` }, h('b', { text: nv.chuoi }), h('span', { text: 'ngày liên tiếp' })),
  );
  if (bossChon) bangChu.append(h('p', { class: 'gm-goi-y', text: `Boss ${bossChon.ten}: còn ${bossChon.so_mo} boss nhỏ${bossChon.boss_nho.length > 11 ? ', đảo hiện 11 con gấp nhất' : ''}.` }));
  else if (trongCanh.length) bangChu.append(h('p', { class: 'gm-goi-y', text: 'Quái lẻ là việc chưa xếp vào dự án nào.' }));
  khungCanh.append(bangChu);

  // Thẻ nhân vật.
  const chan = nv.xp_den - nv.xp_tu;
  const anhNv = anhNhanVat(nv.cap, 4);
  anhNv.className = 'gm-chan-dung';
  anhNv.setAttribute('aria-hidden', 'true');
  const theNv = h('section', { class: 'bang gm-nv' },
    anhNv,
    h('div', { class: 'gm-nv-chu' },
      h('p', { class: 'chao', text: nv.cap >= 10 ? 'Huyền thoại' : nv.cap >= 5 ? 'Hiệp sĩ bạc' : 'Hiệp sĩ tập sự' }),
      h('h2', { text: `Cấp ${nv.cap}` }),
      h('div', { class: 'gm-xp', role: 'img', 'aria-label': `${nv.xp - nv.xp_tu} trên ${chan} điểm để lên cấp ${nv.cap + 1}` }, h('i', { style: `width:${((nv.xp - nv.xp_tu) / chan) * 100}%` })),
      h('small', { text: `${nv.xp - nv.xp_tu}/${chan} điểm tới cấp ${nv.cap + 1}. Tổng ${nv.xp} điểm` }),
      h('dl', { class: 'gm-so' },
        h('div', {}, h('dt', { text: 'Đã hạ' }), h('dd', { text: nv.so_ha })),
        h('div', {}, h('dt', { text: 'Hạ sớm' }), h('dd', { text: nv.so_ha_som })),
        h('div', {}, h('dt', { text: 'Boss đã hạ' }), h('dd', { text: nv.so_boss })),
        h('div', {}, h('dt', { text: 'Màn đã qua' }), h('dd', { text: nv.so_man_qua })),
      ),
    ),
  );

  // Bảng trận của quái đang chọn.
  let dangChon = null;
  const chonBoss = (b) => {
    dangChon = `b${b.id}`;
    canh?.datChon(dangChon);
    thay(bangTran,
      h('div', { class: 'gm-tran-dau' },
        veAnh(h('canvas', { class: 'gm-anh-quai', 'aria-hidden': 'true' }), anhBoss(b.loai, b.mau_du_an, 3)),
        h('div', {},
          h('p', { class: 'chao', text: `Boss dự án, ${b.ten_loai}${b.lan_ha ? `, đã hạ ${b.lan_ha} lần` : ''}` }),
          h('h3', { text: b.ten }),
          h('p', { class: 'mo-ta', text: `Máu ${gioPhut(b.mau)} / ${gioPhut(b.mau_toi_da)}. Còn ${b.so_mo} boss nhỏ, đợt này đã hạ ${b.so_xong}. Hạ hết được thêm ${b.xp_neu_ha} điểm thưởng.` }),
        ),
      ),
      h('ul', { class: 'gm-don gm-ds-nho' }, ...b.boss_nho.map((q) => h('li', { class: q.gian ? 'gian' : '' },
        veAnh(h('canvas', { 'aria-hidden': 'true' }), anhQuaiNho(q.loai, q.id, 1, true)),
        h('span', { text: q.tieu_de }),
        h('small', { text: `${gioPhut(q.mau)}${q.han_ngay ? `, hạn ${q.han_ngay.slice(8, 10)}/${q.han_ngay.slice(5, 7)}` : ''}` }),
        h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => chonQuai(q.id) }, 'Đánh')))),
    );
  };
  const chonQuai = (id) => {
    if (typeof id === 'string' && id.startsWith('b')) { const b = g.boss.find((x) => `b${x.id}` === id); if (b) chonBoss(b); return; }
    const q = tatCa.find((x) => x.id === id);
    if (!q) return;
    dangChon = id;
    canh?.datChon(id);
    const dong = [];
    if (q.con) {
      dong.push(h('p', { class: 'mo-ta', text: `Đã chia thành ${q.con.tong} đòn. Xong một việc con là một đòn trúng.` }));
      dong.push(h('ul', { class: 'gm-don' }, ...q.con.don.map((d) => h('li', { class: d.xong ? 'xong' : '' },
        h('span', { text: d.tieu_de }), h('small', { text: gioPhut(d.phut) }),
        d.xong ? h('span', { class: 'gm-trung', text: 'Trúng' }) : h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: (e) => xongDon(q, d, e.currentTarget) }, 'Xong đòn')))));
    }
    const nutChia = ['nang', 'rat_nang'].includes(q.do_nang) && !q.con ? h('button', { class: 'nut nut-phu nut-nho', type: 'button' }, icon('ai'), 'AI chia thành đòn') : null;
    if (nutChia) nutChia.addEventListener('click', () => moBangChia({ id: q.id, tieu_de: q.tieu_de }, nutChia.parentElement, nutChia, t, () => veKhuGame(goc, t, napTrang)));
    thay(bangTran,
      h('div', { class: 'gm-tran-dau' },
        h('canvas', { class: 'gm-anh-quai', 'aria-hidden': 'true' }),
        h('div', {},
          h('p', { class: 'chao', text: `${bossCua(q) ? `Boss nhỏ của ${bossCua(q).ten}, ` : ''}${q.ten_loai}${q.gian ? ', đang nổi giận vì quá hạn' : ''}${q.dang_danh ? ', đang giao chiến' : ''}` }),
          h('h3', { text: q.tieu_de }),
          h('p', { class: 'mo-ta', text: `Máu ${gioPhut(q.mau)} / ${gioPhut(q.mau_toi_da)}. ${q.han_ngay ? `Hạn ${q.han_ngay.slice(8, 10)}/${q.han_ngay.slice(5, 7)}` : 'Không hạn'}. Hạ bây giờ được ${q.xp_neu_ha} điểm.` }),
        ),
      ),
      ...dong,
      h('div', { class: 'gm-nut' },
        nutChia,
        q.dang_danh
          ? h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => batDau(q, false) }, 'Tạm dừng')
          : h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => batDau(q, true) }, 'Bắt đầu đánh'),
        h('button', { class: 'nut nut-chinh nut-nho', type: 'button', onclick: (e) => haQuai(q, e.currentTarget) }, icon('xong'), 'Hạ quái (xong việc)'),
      ),
    );
    veAnh(bangTran.querySelector('.gm-anh-quai'), anhQuaiNho(q.loai, q.id, 3, Boolean(bossCua(q))));
  };

  const napLai = async (truoc) => {
    await veKhuGame(goc, t, napTrang);
    const sau = (await api('/api/game').catch(() => null));
    if (!sau || !canhHienTai) return;
    if (truoc.boss) canhHienTai.chuNoi(`Hạ Boss ${truoc.boss}!`);
    else if (sau.nhan_vat.cap > truoc.cap) canhHienTai.chuNoi(`Lên cấp ${sau.nhan_vat.cap}!`);
    else if (sau.man.qua_man && !truoc.qua_man) canhHienTai.chuNoi('Qua màn!');
  };
  const batDau = async (q, bat) => {
    try { await api(`/api/hieu-suat/viec/${q.id}`, { method: 'PATCH', body: JSON.stringify({ hanh_dong: bat ? 'bat_dau' : 'dung' }) }); bao(bat ? 'Bắt đầu đánh, đang tính giờ.' : 'Đã tạm dừng.'); veKhuGame(goc, t, napTrang); } catch (e) { bao(e.message, { loi: true }); }
  };
  const haQuai = async (q, nut) => {
    nut.disabled = true;
    try {
      await api(`/api/viec/${q.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'xong' }) });
      await canh?.danh(q.id, { xp: q.xp_neu_ha, tron: true });
      // Boss nhỏ cuối cùng của dự án: hạ luôn Boss.
      const b = bossCua(q);
      const haBoss = b && b.so_mo === 1;
      if (haBoss) await canh?.danh(`b${b.id}`, { xp: b.xp_neu_ha, tron: true });
      api('/api/game/bao', { method: 'POST', body: JSON.stringify({ viec_id: q.id }) }).catch(() => {});
      await napLai({ cap: nv.cap, qua_man: man.qua_man, boss: haBoss ? b.ten : null });
      napTrang?.();
    } catch (e) { bao(e.message, { loi: true }); nut.disabled = false; }
  };
  const xongDon = async (q, d, nut) => {
    nut.disabled = true;
    try {
      await api(`/api/viec/${d.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'xong' }) });
      const cuoi = q.con.don.filter((x) => !x.xong).length === 1;
      await canh?.danh(q.id, { xp: 0, tron: false });
      bao(cuoi ? 'Đòn cuối đã trúng. Bấm Hạ quái để kết thúc.' : `Trúng: ${d.tieu_de}`);
      await napLai({ cap: nv.cap, qua_man: man.qua_man });
    } catch (e) { bao(e.message, { loi: true }); nut.disabled = false; }
  };

  const thanhTich = h('section', { class: 'bang gm-tt' },
    h('div', { class: 'bang-dau' }, h('h2', {}, 'Thành tích'), h('span', { class: 'phu', text: `${g.thanh_tich.filter((x) => x.dat).length}/${g.thanh_tich.length}` })),
    h('ul', { class: 'gm-ds-tt' }, ...g.thanh_tich.map((x) => h('li', { class: x.dat ? 'dat' : '' }, h('span', { class: 'gm-huy-hieu', 'aria-hidden': 'true' }), h('div', {}, h('b', { text: x.ten }), h('small', { text: x.mo_ta })), h('span', { class: 'sr-only', text: x.dat ? 'Đã đạt' : 'Chưa đạt' })))),
  );
  const nhatKy = h('section', { class: 'bang gm-nk' },
    h('div', { class: 'bang-dau' }, h('h2', {}, 'Trận gần đây')),
    g.nhat_ky.length ? h('ul', { class: 'gm-ds-nk' }, ...g.nhat_ky.map((k) => h('li', { class: k.boss ? 'boss' : '' }, h('span', { text: k.tieu_de }), h('b', { text: `+${k.xp}` }), TEN_KIEU[k.kieu] ? h('small', { class: `kieu-${k.kieu}`, text: TEN_KIEU[k.kieu] }) : null))) : h('p', { class: 'mo-ta hs-than', text: 'Chưa hạ quái nào.' }),
  );
  const caiDat = h('div', { class: 'gm-cai-dat' },
    congTac(h, 'Chế độ game', true, (b, o) => doiCaiDat({ bat: b }, o)),
    congTac(h, 'Báo trận qua Telegram', g.telegram, (b, o) => doiCaiDat({ telegram: b }, o)),
  );

  thay(goc, h('div', { class: 'gm' },
    h('section', { class: 'bang gm-dau' }, dsThe, khungCanh, bangTran),
    theNv, nhatKy, thanhTich, caiDat,
  ));
  if (!trongCanh.length) thay(bangTran, h('p', { class: 'mo-ta', text: 'Đảo đã sạch quái. Thêm việc để có quái mới.' }));
  else thay(bangTran, h('p', { class: 'mo-ta', text: bossChon ? 'Bấm vào Boss để xem cả dự án, bấm vào một boss nhỏ để ra đòn.' : 'Bấm vào một con quái để xem việc và ra đòn.' }));
  const canh = taoCanh(khungCanh, { khiChon: chonQuai, giam });
  canhHienTai = canh;
  canh.datQuai(trongCanh, nv.cap, bossChon);
  if (bossChon) chonBoss(bossChon);
}
