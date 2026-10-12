// Chế độ game của Sonicplan: đảo voxel nhìn chéo (isometric), nhân vật hiệp sĩ của bạn, mỗi việc là một quái.
// Tự vẽ bằng canvas 2D, mọi mô hình dựng bằng mã (không dùng hình có bản quyền, không tải thư viện ngoài).

// ---------------- Mô hình voxel ----------------
function moHinh() {
  const m = new Map();
  const dat = (x, y, z, c) => m.set(`${x},${y},${z}`, [x, y, z, c]);
  const hop = (x0, x1, y0, y1, z0, z1, c) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) dat(x, y, z, c); };
  const xoa = (x, y, z) => m.delete(`${x},${y},${z}`);
  const truocY = (x, z, c) => { let best = null; for (const v of m.values()) if (v[0] === x && v[2] === z && (!best || v[1] > best[1])) best = v; if (best) best[3] = c; };
  const truocX = (y, z, c) => { let best = null; for (const v of m.values()) if (v[1] === y && v[2] === z && (!best || v[0] > best[0])) best = v; if (best) best[3] = c; };
  const cau = (cx, cy, cz, rx, ry, rz, c, zMin = -99) => {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.max(zMin, Math.floor(cz - rz)); z <= Math.ceil(cz + rz); z++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) dat(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
  };
  return { m, dat, hop, xoa, truocY, truocX, cau, ds: () => [...m.values()] };
}

// Hiệp sĩ quay mặt về +x (bên phải màn hình).
function hiepSi(cap = 1) {
  const g = moHinh();
  const giap = cap >= 10 ? '#f5c451' : cap >= 5 ? '#8fb8ff' : '#06c8be';
  const giapToi = cap >= 10 ? '#c9952b' : cap >= 5 ? '#5d86d6' : '#049c94';
  g.hop(1, 2, 1, 2, 0, 1, '#3d2b20'); g.hop(1, 2, 4, 5, 0, 1, '#3d2b20');
  g.hop(1, 2, 1, 2, 2, 4, '#34405e'); g.hop(1, 2, 4, 5, 2, 4, '#34405e');
  g.hop(1, 3, 1, 5, 5, 9, giap);
  g.hop(1, 3, 1, 5, 5, 5, '#7a5a2e'); g.dat(3, 3, 5, '#f5c451');
  g.hop(3, 3, 2, 4, 7, 8, '#bff7f2');
  g.hop(1, 2, 0, 0, 5, 9, giapToi); g.hop(1, 2, 6, 6, 5, 9, giapToi);
  g.dat(2, 0, 5, '#f2c9a0'); g.dat(2, 6, 5, '#f2c9a0');
  g.hop(0, 0, 1, 5, 4, 10, '#c0392b'); g.hop(-1, -1, 2, 4, 3, 7, '#a93226');
  g.hop(1, 3, 1, 5, 10, 13, '#f2c9a0');
  g.hop(0, 3, 1, 5, 14, 14, '#d5dde8'); g.hop(0, 0, 1, 5, 10, 13, '#d5dde8'); g.hop(1, 2, 1, 1, 11, 13, '#d5dde8'); g.hop(1, 2, 5, 5, 11, 13, '#d5dde8');
  g.dat(3, 2, 12, '#1b2233'); g.dat(3, 4, 12, '#1b2233'); g.dat(3, 3, 11, '#e0a882');
  g.hop(1, 2, 3, 3, 15, 16, '#ff5a5a'); g.dat(0, 3, 15, '#ff5a5a');
  g.hop(3, 3, 6, 6, 5, 7, '#f5c451');
  g.hop(4, 9, 6, 6, 6, 6, '#e8eef6'); g.dat(10, 6, 6, '#ffffff');
  g.hop(3, 3, 7, 7, 5, 7, '#f5c451');
  return g.ds();
}

function slime(mau) {
  const g = moHinh();
  const [than, sang] = mau;
  g.cau(3.5, 3.5, 0.5, 3.6, 3.6, 4.4, (x, y, z) => (z >= 3 && (x + y) % 3 === 0 ? sang : than), 0);
  g.truocY(2, 2, '#10202b'); g.truocY(5, 2, '#10202b'); g.truocY(2, 3, '#ffffff'); g.truocY(5, 3, '#ffffff');
  g.truocY(3, 1, '#ff8fa3'); g.truocY(4, 1, '#ff8fa3');
  return g.ds();
}

function yeuTinh() {
  const g = moHinh();
  const da = '#7cb342';
  g.hop(1, 2, 1, 1, 0, 2, '#4e342e'); g.hop(1, 2, 3, 3, 0, 2, '#4e342e');
  g.hop(0, 3, 0, 4, 3, 6, '#8d6e63'); g.hop(0, 3, 0, 4, 3, 3, '#5d4037');
  g.hop(-1, -1, 1, 3, 3, 5, da); g.hop(4, 4, 1, 3, 3, 5, da);
  g.hop(0, 3, 0, 4, 7, 10, da);
  g.hop(-2, -1, 2, 2, 9, 10, da); g.hop(4, 5, 2, 2, 9, 10, da); g.dat(-3, 2, 10, da); g.dat(6, 2, 10, da);
  g.truocY(1, 9, '#ffeb3b'); g.truocY(2, 9, '#ffeb3b'); g.truocY(1, 8, '#33691e'); g.truocY(2, 8, '#33691e');
  g.truocY(1, 7, '#ffffff'); g.truocY(2, 7, '#3e2723');
  g.hop(5, 5, 4, 7, 4, 4, '#cfd8dc'); g.dat(5, 3, 4, '#795548');
  return g.ds();
}

function nguoiDa() {
  const g = moHinh();
  const da = (x, y, z) => ((x * 7 + y * 3 + z * 5) % 11 === 0 ? '#6b8f4e' : (x + z) % 4 === 0 ? '#7a8394' : '#8d96a6');
  g.hop(1, 3, 1, 3, 0, 3, '#5d6675'); g.hop(1, 3, 6, 8, 0, 3, '#5d6675');
  for (let x = 0; x <= 5; x++) for (let y = 0; y <= 9; y++) for (let z = 4; z <= 10; z++) g.dat(x, y, z, da(x, y, z));
  g.xoa(0, 0, 10); g.xoa(5, 0, 10); g.xoa(0, 9, 10); g.xoa(5, 9, 10);
  for (let x = 0; x <= 4; x++) for (let y = -3; y <= -1; y++) for (let z = 2; z <= 8; z++) g.dat(x, y, z, da(x, y, z));
  for (let x = 0; x <= 4; x++) for (let y = 10; y <= 12; y++) for (let z = 2; z <= 8; z++) g.dat(x, y, z, da(x, y, z));
  for (let x = 1; x <= 4; x++) for (let y = 3; y <= 6; y++) for (let z = 11; z <= 13; z++) g.dat(x, y, z, da(x, y, z));
  g.truocY(2, 12, '#ffb347'); g.truocY(3, 12, '#ffb347');
  g.truocY(1, 7, '#ff8a3d'); g.truocY(4, 7, '#ff8a3d');
  return g.ds();
}

function rong() {
  const g = moHinh();
  const do_ = '#d64541', doToi = '#9b2c2c', bung = '#f5b85c';
  g.hop(2, 9, 2, 6, 3, 7, do_); g.hop(3, 8, 6, 6, 3, 5, bung);
  g.hop(3, 4, 2, 3, 0, 2, doToi); g.hop(7, 8, 2, 3, 0, 2, doToi); g.hop(3, 4, 5, 6, 0, 2, doToi); g.hop(7, 8, 5, 6, 0, 2, doToi);
  g.hop(4, 7, 5, 8, 8, 10, do_);
  g.hop(4, 7, 9, 11, 7, 9, do_); g.hop(4, 7, 11, 11, 7, 7, bung);
  g.hop(4, 4, 6, 6, 11, 12, '#f5f0e1'); g.hop(7, 7, 6, 6, 11, 12, '#f5f0e1');
  g.truocY(4, 9, '#ffe14d'); g.truocY(7, 9, '#ffe14d');
  g.dat(5, 12, 7, '#2b0f0f'); g.dat(6, 12, 7, '#2b0f0f');
  for (let i = 0; i < 7; i++) g.hop(-i - 1, 1 - i, 3, 4, 6 + Math.min(i, 3), 7 + Math.min(i, 3), i % 2 ? doToi : '#7d2323');
  for (let i = 0; i < 7; i++) g.hop(10 + i, 11 + i, 3, 4, 6 + Math.min(i, 3), 7 + Math.min(i, 3), i % 2 ? doToi : '#7d2323');
  g.hop(5, 6, -1, 1, 4, 5, do_); g.hop(5, 6, -4, -2, 3, 4, doToi); g.dat(5, -5, 4, '#ff7b3d');
  for (let x = 3; x <= 8; x += 2) g.dat(x, 4, 8, '#ffb347');
  return g.ds();
}

const MAU_SLIME = [['#5fd37a', '#b9f5c8'], ['#5fb8f2', '#c4e8ff'], ['#e27ad6', '#f7c6f0'], ['#f2b84b', '#ffe6a8']];

// ---------------- Vẽ voxel ----------------
const sangToi = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

// Dựng ảnh nền sẵn cho một mô hình với cỡ voxel v (px). Trả { anh, ax, ay, rong, cao } với (ax, ay) là điểm chân giữa.
function dungAnh(voxel, v) {
  const co = new Set(voxel.map(([x, y, z]) => `${x},${y},${z}`));
  const p = (x, y, z) => [(x - y) * v, (x + y) * v / 2 - z * v];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y, z] of voxel) for (const [dx, dy, dz] of [[0, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 1], [1, 0, 0]]) {
    const [sx, sy] = p(x + dx, y + dy, z + dz);
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const pad = 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil(x1 - x0 + pad * 2); c.height = Math.ceil(y1 - y0 + pad * 2);
  const g = c.getContext('2d');
  const ox = -x0 + pad, oy = -y0 + pad;
  const mat = (diem, mau) => {
    g.beginPath();
    diem.forEach(([x, y, z], i) => { const [sx, sy] = p(x, y, z); g[i ? 'lineTo' : 'moveTo'](sx + ox, sy + oy); });
    g.closePath(); g.fillStyle = mau; g.strokeStyle = mau; g.lineWidth = 0.7; g.fill(); g.stroke();
  };
  const xep = [...voxel].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[2] - b[2]);
  for (const [x, y, z, mau] of xep) {
    if (!co.has(`${x},${y},${z + 1}`)) mat([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], sangToi(mau, 1.12));
    if (!co.has(`${x + 1},${y},${z}`)) mat([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]], sangToi(mau, 0.66));
    if (!co.has(`${x},${y + 1},${z}`)) mat([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], sangToi(mau, 0.86));
  }
  // Điểm chân: giữa đáy mô hình.
  const xs = voxel.map((q) => q[0]), ys = voxel.map((q) => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
  const [ax, ay] = p(cx, cy, 0);
  return { anh: c, ax: ax + ox, ay: ay + oy, rong: c.width, cao: c.height, mau: voxel.map((q) => q[3]) };
}

// ---------------- Cảnh ----------------
const O_DAO = { x: 12, y: 7 }; // số ô của đảo
const CO_O = 8; // voxel mỗi ô
const VI_TRI = [[7, 3.4], [9, 2.2], [9, 4.8], [11, 3.4], [7.2, 1], [7.2, 5.9], [11, 1], [11, 5.9], [9.2, 0.4], [9.2, 6.4], [5.6, 6.2], [5.6, 0.7]];
const NHA = [2.6, 3.2];

export function taoCanh(khung, { khiChon, giam }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gm-canvas';
  canvas.setAttribute('role', 'img');
  const lop = document.createElement('div');
  lop.className = 'gm-lop';
  khung.append(canvas, lop);
  const g = canvas.getContext('2d');
  let dpr = 1, rongKhung = 0, caoKhung = 0, v = 4, goc = [0, 0];
  let dao = null;
  const anh = new Map();
  let quai = [];
  let capNv = 1;
  const hieuUng = [];
  const hat = [];
  const dom = new Map();
  const nv = { x: NHA[0], y: NHA[1], tu: null, den: null, bd: 0, tg: 0, chem: 0 };
  let chon = null;
  let chay = true, id = 0, t0 = performance.now();

  const chieu = (wx, wy, wz = 0) => [goc[0] + (wx - wy) * v, goc[1] + (wx + wy) * v / 2 - wz * v];
  const layAnh = (khoa, tao) => { if (!anh.has(khoa)) anh.set(khoa, dungAnh(tao(), v)); return anh.get(khoa); };
  const anhQuai = (q) => {
    if (q.loai === 'slime') { const i = q.id % MAU_SLIME.length; return layAnh(`slime${i}`, () => slime(MAU_SLIME[i])); }
    if (q.loai === 'golem') return layAnh('golem', nguoiDa);
    if (q.loai === 'rong') return layAnh('rong', rong);
    return layAnh('goblin', yeuTinh);
  };

  function dungDao() {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const d = c.getContext('2d');
    const W = O_DAO.x * CO_O, H = O_DAO.y * CO_O;
    const mat = (diem, mau) => { d.beginPath(); diem.forEach(([x, y, z], i) => { const [sx, sy] = chieu(x, y, z); d[i ? 'lineTo' : 'moveTo'](sx, sy); }); d.closePath(); d.fillStyle = mau; d.strokeStyle = mau; d.lineWidth = 0.8; d.fill(); d.stroke(); };
    // Thân đảo: các tầng đất và đá thu nhỏ dần xuống dưới.
    const tang = [[0, '#6b4a2f', '#523823'], [-3, '#5b4030', '#43302a'], [-6, '#47505e', '#363d49'], [-9, '#3a414d', '#2b313b']];
    tang.forEach(([z, mauX, mauY], i) => {
      const thu = i * 3;
      const x0 = thu, y0 = thu, x1 = W - thu, y1 = H - thu;
      mat([[x1, y0, z], [x1, y1, z], [x1, y1, z - 3], [x1, y0, z - 3]], mauX);
      mat([[x0, y1, z], [x1, y1, z], [x1, y1, z - 3], [x0, y1, z - 3]], mauY);
    });
    // Mặt cỏ ô bàn cờ.
    for (let i = 0; i < O_DAO.x; i++) for (let j = 0; j < O_DAO.y; j++) {
      const mau = (i + j) % 2 ? '#4f9a5b' : '#58a865';
      mat([[i * CO_O, j * CO_O, 0], [(i + 1) * CO_O, j * CO_O, 0], [(i + 1) * CO_O, (j + 1) * CO_O, 0], [i * CO_O, (j + 1) * CO_O, 0]], mau);
    }
    // Đường mòn tới bãi quái.
    for (let i = 3; i < 7; i++) mat([[i * CO_O + 1, 3 * CO_O + 2, 0.02], [(i + 1) * CO_O - 1, 3 * CO_O + 2, 0.02], [(i + 1) * CO_O - 1, 4 * CO_O - 2, 0.02], [i * CO_O + 1, 4 * CO_O - 2, 0.02]], '#c9b07a');
    // Viền cỏ trước mép đảo.
    mat([[W, 0, 0], [W, H, 0], [W, H, -1], [W, 0, -1]], '#3f7d49');
    mat([[0, H, 0], [W, H, 0], [W, H, -1], [0, H, -1]], '#468a51');
    return c;
  }

  // Trang trí cố định: cây, đá, cột đuốc ở rìa đảo (vẽ cùng lớp chiều sâu với nhân vật).
  const trangTri = [];
  function dungTrangTri() {
    trangTri.length = 0;
    const cay = () => { const g2 = moHinh(); g2.hop(2, 3, 2, 3, 0, 5, '#6d4c41'); g2.cau(2.5, 2.5, 9, 3.2, 3.2, 3.6, (x, y, z) => ((x + y + z) % 3 ? '#3e8e52' : '#2f7543')); return g2.ds(); };
    const da = () => { const g2 = moHinh(); g2.cau(2, 2, 0.5, 2.4, 1.8, 2, (x, y, z) => ((x + z) % 2 ? '#8792a3' : '#9aa5b5'), 0); return g2.ds(); };
    const duoc = () => { const g2 = moHinh(); g2.hop(0, 0, 0, 0, 0, 7, '#5d4037'); g2.hop(-1, 1, -1, 1, 8, 8, '#4e342e'); g2.dat(0, 0, 9, '#ffb347'); g2.dat(0, 0, 10, '#ffe14d'); return g2.ds(); };
    for (const [x, y, loai] of [[0.6, 0.7, 'cay'], [0.5, 5.8, 'cay'], [11.3, 0.6, 'cay'], [4.5, 0.6, 'da'], [11.4, 6.4, 'da'], [1.4, 6.5, 'da'], [5.2, 2.4, 'duoc'], [5.2, 4.6, 'duoc']]) {
      trangTri.push({ x, y, a: layAnh(loai, loai === 'cay' ? cay : loai === 'da' ? da : duoc), duoc: loai === 'duoc' });
    }
  }

  function doCo() {
    const r = khung.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    rongKhung = r.width; caoKhung = r.height;
    canvas.width = Math.round(rongKhung * dpr); canvas.height = Math.round(caoKhung * dpr);
    // Cỡ voxel để đảo vừa khung: chiều ngang đảo là (X + Y) ô x 8 voxel x v.
    const ngang = (O_DAO.x + O_DAO.y) * CO_O;
    v = Math.max(2, Math.min((canvas.width * (rongKhung < 640 ? 1.02 : 0.94)) / ngang, (canvas.height * 0.94) / (ngang / 2 + 16)));
    const doc = ((O_DAO.x + O_DAO.y) * CO_O * v) / 2;
    goc = [canvas.width / 2 - ((O_DAO.x - O_DAO.y) * CO_O * v) / 2, (canvas.height - doc) / 2 + 9 * v];
    anh.clear();
    dao = dungDao();
    dungTrangTri();
    if (quai.length) xepNhan();
  }

  const viTri = (i) => VI_TRI[i] || [10 + (i % 2), (i * 2) % 7];
  function datQuai(ds, cap) {
    capNv = cap;
    anh.delete('hiepsi');
    const cu = new Map(quai.map((q) => [q.id, q]));
    quai = ds.slice(0, VI_TRI.length).map((q, i) => ({ ...q, o: viTri(i), pha: (q.id * 1.7) % 6.28, nhay: cu.get(q.id)?.nhay || 0, mauHien: cu.get(q.id)?.mauHien ?? q.mau }));
    for (const [k, el] of dom) if (!quai.some((q) => q.id === k)) { el.remove(); dom.delete(k); }
    for (const q of quai) {
      let el = dom.get(q.id);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'gm-nhan';
        el.addEventListener('click', () => khiChon(q.id));
        lop.append(el);
        dom.set(q.id, el);
      }
      el.replaceChildren();
      const ten = document.createElement('span'); ten.className = 'ten'; ten.textContent = q.tieu_de;
      const mau = document.createElement('span'); mau.className = 'mau'; const i = document.createElement('i'); mau.append(i);
      el.append(ten, mau);
      el.dataset.loai = q.loai;
      el.classList.toggle('gian', q.gian);
      el.classList.toggle('danh', q.dang_danh);
      el.setAttribute('aria-label', `${q.ten_loai}: ${q.tieu_de}. Máu ${q.mau} trên ${q.mau_toi_da}`);
    }
    xepNhan();
    canvas.setAttribute('aria-label', `Đảo quái hôm nay: ${quai.length} quái. Nhân vật cấp ${cap}.`);
  }

  // Xếp nhãn tránh chồng nhau: quái ở trước đặt trước, nhãn nào đè thì đẩy lên. Màn hẹp thì chỉ hiện tên quái đang chọn.
  function xepNhan() {
    const hep = rongKhung < 640;
    const daDat = [];
    for (const q of [...quai].sort((a, b) => b.o[0] + b.o[1] - (a.o[0] + a.o[1]))) {
      const el = dom.get(q.id);
      if (!el) continue;
      el.classList.toggle('gon', hep && q.id !== chon);
      const a = anhQuai(q);
      const [sx, sy] = chieu(q.o[0] * CO_O, q.o[1] * CO_O, 0);
      const w = el.offsetWidth, hh = el.offsetHeight;
      const x = sx / dpr - w / 2;
      let y = (sy - a.ay) / dpr - 6 - hh;
      for (let lan = 0; lan < 8; lan++) {
        const de = daDat.find((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + hh + 2 > r.y);
        if (!de) break;
        y = de.y - hh - 3;
      }
      daDat.push({ x, y, w, h: hh });
      q.dyNhan = y + hh - ((sy - a.ay) / dpr - 6);
    }
  }

  function datChon(maQuai) {
    chon = maQuai;
    for (const [k, el] of dom) el.classList.toggle('chon', k === maQuai);
    xepNhan();
  }

  // Hạ quái: nhân vật lao tới, chém, quái nổ thành khối, hiện điểm. tron = true là đòn cuối.
  function danh(maQuai, { xp = 0, tron = true } = {}) {
    const q = quai.find((x) => x.id === maQuai);
    if (!q) return Promise.resolve();
    return new Promise((xong) => {
      const den = [q.o[0] - 0.9, q.o[1] + 0.25];
      nv.tu = [nv.x, nv.y]; nv.den = den; nv.bd = performance.now(); nv.tg = giam ? 1 : 260;
      setTimeout(() => {
        nv.chem = performance.now();
        q.nhay = performance.now();
        const a = anhQuai(q);
        const [sx, sy] = chieu(q.o[0] * CO_O, q.o[1] * CO_O, 0);
        if (tron) {
          for (let k = 0; k < (giam ? 0 : 46); k++) {
            hat.push({ x: sx + (Math.random() - 0.5) * a.rong * 0.6, y: sy - Math.random() * a.cao * 0.8, vx: (Math.random() - 0.5) * 9 * v, vy: -(Math.random() * 10 + 4) * v, c: a.mau[(Math.random() * a.mau.length) | 0], s: v * (0.8 + Math.random() * 1.2), song: 1 });
          }
          q.chet = performance.now();
          const el = dom.get(q.id);
          if (el) el.hidden = true;
        }
        if (xp) hieuUng.push({ chu: `+${xp}`, x: sx, y: sy - a.cao * 0.8, bd: performance.now() });
        setTimeout(() => { nv.tu = [nv.x, nv.y]; nv.den = [NHA[0], NHA[1]]; nv.bd = performance.now(); nv.tg = giam ? 1 : 380; xong(); }, giam ? 10 : 420);
      }, giam ? 10 : 260);
    });
  }

  function chuNoi(chu) { hieuUng.push({ chu, x: canvas.width / 2, y: canvas.height * 0.28, bd: performance.now(), lon: true }); }

  // Vòng vẽ.
  function ve(now) {
    if (!chay) return;
    id = requestAnimationFrame(ve);
    const t = (now - t0) / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    // Trôi nhẹ cả đảo.
    const troi = giam ? 0 : Math.sin(t * 0.8) * v * 0.8;
    g.save(); g.translate(0, troi);
    if (dao) g.drawImage(dao, 0, 0);
    // Nhân vật di chuyển.
    if (nv.den) {
      const k = Math.min(1, (now - nv.bd) / nv.tg);
      const e = 1 - (1 - k) ** 3;
      nv.x = nv.tu[0] + (nv.den[0] - nv.tu[0]) * e; nv.y = nv.tu[1] + (nv.den[1] - nv.tu[1]) * e;
      if (k >= 1) nv.den = null;
    }
    const ve1 = [];
    for (const d of trangTri) ve1.push({ sau: d.x + d.y, ve: () => {
      const [sx, sy] = chieu(d.x * CO_O, d.y * CO_O, 0);
      g.drawImage(d.a.anh, sx - d.a.ax, sy - d.a.ay);
      if (d.duoc && !giam) { g.fillStyle = `rgba(255,190,90,${0.18 + Math.sin(t * 9 + d.x) * 0.06})`; g.beginPath(); g.arc(sx, sy - 10 * v, 5 * v, 0, 6.29); g.fill(); }
    } });
    const aNv = layAnh('hiepsi', () => hiepSi(capNv));
    ve1.push({ sau: nv.x + nv.y, ve: () => {
      const [sx, sy] = chieu(nv.x * CO_O, nv.y * CO_O, 0);
      const nhun = giam ? 0 : Math.sin(t * 3) * v * 0.5;
      bong(sx, sy, aNv.rong * 0.32);
      g.drawImage(aNv.anh, sx - aNv.ax, sy - aNv.ay + nhun);
      const kc = (now - nv.chem) / 220;
      if (kc >= 0 && kc < 1) {
        g.strokeStyle = `rgba(255,255,255,${1 - kc})`; g.lineWidth = v * 1.4; g.lineCap = 'round';
        g.beginPath(); g.arc(sx + 8 * v, sy - 9 * v, 9 * v, -1.9 + kc * 1.2, -0.2 + kc * 1.2); g.stroke();
      }
    } });
    for (const q of quai) {
      if (q.chet && now - q.chet > 60) continue;
      ve1.push({ sau: q.o[0] + q.o[1], ve: () => {
        const a = anhQuai(q);
        const [sx, sy] = chieu(q.o[0] * CO_O, q.o[1] * CO_O, 0);
        const nhun = giam ? 0 : q.loai === 'slime' ? Math.abs(Math.sin(t * 2.4 + q.pha)) * v * 2 : Math.sin(t * 2 + q.pha) * v * 0.7;
        const rung = now - q.nhay < 300 ? Math.sin((now - q.nhay) / 18) * v * 1.2 : 0;
        bong(sx, sy, a.rong * 0.34);
        if (q.gian) { g.fillStyle = `rgba(242,90,80,${0.22 + Math.sin(t * 5) * 0.1})`; g.beginPath(); g.ellipse(sx, sy, a.rong * 0.42, a.rong * 0.2, 0, 0, 6.29); g.fill(); }
        if (q.id === chon) { g.strokeStyle = 'rgba(6,227,216,.9)'; g.lineWidth = v * 0.6; g.setLineDash([v * 2, v * 1.4]); g.lineDashOffset = -t * 20; g.beginPath(); g.ellipse(sx, sy, a.rong * 0.44, a.rong * 0.22, 0, 0, 6.29); g.stroke(); g.setLineDash([]); }
        if (q.loai === 'slime' && !giam) {
          const ep = 1 - Math.abs(Math.sin(t * 2.4 + q.pha)) * 0.08;
          g.drawImage(a.anh, sx - a.ax * (2 - ep), sy - a.ay * ep - nhun, a.rong * (2 - ep), a.cao * ep);
        } else g.drawImage(a.anh, sx - a.ax + rung, sy - a.ay - nhun);
        if (now - q.nhay < 160) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(a.anh, sx - a.ax + rung, sy - a.ay - nhun); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
        // Vị trí nhãn HTML trên đầu quái.
        const el = dom.get(q.id);
        if (el) el.style.transform = `translate(${(sx / dpr).toFixed(1)}px, ${((sy - a.ay - nhun + troi) / dpr - 6 + (q.dyNhan || 0)).toFixed(1)}px) translate(-50%, -100%)`;
        if (el) el.querySelector('i').style.width = `${Math.max(3, (q.mau / q.mau_toi_da) * 100)}%`;
      } });
    }
    ve1.sort((a, b) => a.sau - b.sau).forEach((x) => x.ve());
    g.restore();
    // Hạt nổ.
    for (let i = hat.length - 1; i >= 0; i--) {
      const p = hat[i];
      p.vy += 40 * v / 60; p.x += p.vx / 60; p.y += p.vy / 60; p.song -= 1 / 55;
      if (p.song <= 0) { hat.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, p.song * 2);
      g.fillStyle = sangToi(p.c, 1.1); g.fillRect(p.x, p.y, p.s, p.s * 0.6);
      g.fillStyle = sangToi(p.c, 0.7); g.fillRect(p.x, p.y + p.s * 0.6, p.s, p.s * 0.5);
    }
    g.globalAlpha = 1;
    // Chữ điểm bay lên.
    for (let i = hieuUng.length - 1; i >= 0; i--) {
      const h = hieuUng[i];
      const k = (now - h.bd) / (h.lon ? 1800 : 1100);
      if (k >= 1) { hieuUng.splice(i, 1); continue; }
      g.globalAlpha = 1 - k * k;
      g.font = `800 ${Math.round((h.lon ? 30 : 20) * dpr)}px "Be Vietnam Pro", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 4 * dpr; g.strokeStyle = 'rgba(2,10,20,.85)'; g.strokeText(h.chu, h.x, h.y - k * 50 * dpr);
      g.fillStyle = h.lon ? '#ffe14d' : '#06e3d8'; g.fillText(h.chu, h.x, h.y - k * 50 * dpr);
    }
    g.globalAlpha = 1;
  }
  function bong(x, y, r) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y, r, r * 0.45, 0, 0, 6.29); g.fill(); }

  const ro = new ResizeObserver(() => { doCo(); });
  ro.observe(khung);
  doCo();
  // Tạm dừng khi khuất màn hình hoặc tab ẩn để đỡ tốn pin.
  const io = new IntersectionObserver(([e]) => { const cu = chay; chay = e.isIntersecting && !document.hidden; if (chay && !cu) id = requestAnimationFrame(ve); });
  io.observe(khung);
  const anTab = () => { const cu = chay; chay = !document.hidden; if (chay && !cu) id = requestAnimationFrame(ve); };
  document.addEventListener('visibilitychange', anTab);
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr;
    let tot = null;
    for (const q of quai) {
      const a = anhQuai(q);
      const [sx, sy] = chieu(q.o[0] * CO_O, q.o[1] * CO_O, 0);
      if (mx > sx - a.ax && mx < sx - a.ax + a.rong && my > sy - a.ay && my < sy - a.ay + a.cao && (!tot || q.o[0] + q.o[1] > tot.o[0] + tot.o[1])) tot = q;
    }
    if (tot) khiChon(tot.id);
  });
  id = requestAnimationFrame(ve);
  return {
    datQuai, datChon, danh, chuNoi,
    huy() { chay = false; cancelAnimationFrame(id); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', anTab); },
    nhoAnhNhanVat(cap) { const a = dungAnh(hiepSi(cap), 5); return a.anh; },
  };
}

export const anhNhanVat = (cap, v = 5) => dungAnh(hiepSi(cap), v).anh;
export const anhQuaiNho = (loai, id = 0, v = 3) => dungAnh(loai === 'slime' ? slime(MAU_SLIME[id % MAU_SLIME.length]) : loai === 'golem' ? nguoiDa() : loai === 'rong' ? rong() : yeuTinh(), v).anh;
