'use strict';
// 公園・路上・川沿い。背景は起動時（とリサイズ時）に手続き生成する。

function paintPixels(cv, fn) {
  const g = cv.getContext('2d');
  const img = g.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  for (let y = 0; y < cv.height; y++)
    for (let x = 0; x < cv.width; x++) {
      const c = fn(x, y);
      if (!c) continue;
      const i = (y * cv.width + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
}

const PAL = {
  grass: ['#5c8a42', '#669748', '#6f9f4f', '#577f3d', '#79a957'].map(U.hex),
  dirt: ['#cbb189', '#c2a77d', '#d4bc96', '#bba077'].map(U.hex),
  leafColors: {
    ginkgo: ['#e8c23a', '#f0d04c', '#d9a92c'],
    maple: ['#c9542c', '#d8743a', '#b8402a', '#e0923c'],
    zelkova: ['#b9773a', '#a5642e', '#c88a45', '#8c5a2e'],
    sakura: ['#c84a32', '#d96b3a', '#b23c2c', '#e2a048'],
  },
};

// ---- 落ち葉スプライト ----
const LEAF_SPR = new Map();
function leafSprite(color, rot, kind) {
  const k = color + rot + kind;
  let s = LEAF_SPR.get(k);
  if (s) return s;
  s = U.canvas(5, 5);
  const g = s.getContext('2d');
  const c = U.hex(color);
  const shapes = kind === 'ginkgo'
    ? [[[1, 1, 3, 1], [1, 2, 3, 1], [2, 3, 1, 1]], [[1, 1, 1, 3], [2, 1, 1, 3], [3, 2, 1, 1]], [[2, 1, 1, 1], [1, 2, 3, 1], [1, 3, 3, 1]], [[2, 1, 1, 3], [3, 1, 1, 3], [1, 2, 1, 1]]]
    : [[[1, 2, 3, 1], [2, 1, 2, 1], [1, 3, 1, 1]], [[2, 1, 1, 3], [1, 2, 1, 2], [3, 3, 1, 1]], [[1, 1, 2, 1], [1, 2, 3, 1], [3, 3, 1, 1]], [[1, 1, 1, 1], [2, 1, 1, 3], [3, 2, 1, 1]]];
  g.fillStyle = U.css(c);
  for (const r of shapes[rot % 4]) g.fillRect(r[0], r[1], r[2], r[3]);
  g.fillStyle = U.css(U.shade(c, 0.72));
  const r0 = shapes[rot % 4][shapes[rot % 4].length - 1];
  g.fillRect(r0[0], r0[1], 1, 1);
  LEAF_SPR.set(k, s);
  return s;
}

function makeLeaf(x, y, palette, kind) {
  return { x, y, z: 0, vz: 0, vx: 0, vy: 0, color: U.pick(palette), rot: U.randi(0, 3), kind, age: 0 };
}

// ---- 共通の小物 ----
function drawTreeCanopy(g, cx, cy, r, colors, seed) {
  const cs = colors.map(U.hex);
  const rnd = U.rng(seed);
  const blobs = [];
  for (let i = 0; i < 9; i++) blobs.push([cx + (rnd() - 0.5) * r * 1.4, cy + (rnd() - 0.5) * r * 0.8, r * (0.45 + rnd() * 0.35)]);
  const x0 = Math.floor(cx - r * 1.6), x1 = Math.ceil(cx + r * 1.6);
  const y0 = Math.floor(cy - r * 1.2), y1 = Math.ceil(cy + r * 1.2);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      let inside = false, top = 1;
      for (const [bx, by, br] of blobs) {
        const d = Math.hypot(x - bx, (y - by) * 1.15);
        const jag = U.hash(x, y, seed) * 1.6;
        if (d < br + jag - 0.8) { inside = true; top = Math.min(top, (y - (by - br)) / (2 * br)); }
      }
      if (!inside) continue;
      const n = U.fbm(x / 4, y / 4, seed);
      let c = cs[Math.floor(n * cs.length) % cs.length];
      const f = top < 0.3 ? 1.15 : top > 0.75 ? 0.72 : 1;
      c = U.shadeHue(c, f * (0.92 + U.hash(x, y, seed + 3) * 0.16));
      g.fillStyle = U.css(c);
      g.fillRect(x, y, 1, 1);
    }
}

function makeBench(woodHex) {
  const cv = U.canvas(34, 20);
  const g = cv.getContext('2d');
  const wood = U.hex(woodHex);
  const px = (x, y, w, h, c) => { g.fillStyle = U.css(c); g.fillRect(x, y, w, h); };
  const iron = [52, 54, 60];
  // 脚
  px(3, 9, 2, 11, iron); px(29, 9, 2, 11, iron);
  px(5, 12, 1, 8, U.shade(iron, 0.8)); px(31, 12, 1, 8, U.shade(iron, 0.8));
  // 背もたれ
  px(1, 0, 32, 3, wood); px(1, 0, 32, 1, U.shade(wood, 1.18)); px(1, 2, 32, 1, U.shade(wood, 0.78));
  px(1, 4, 32, 3, wood); px(1, 4, 32, 1, U.shade(wood, 1.15)); px(1, 6, 32, 1, U.shade(wood, 0.78));
  // 座面
  px(0, 10, 34, 2, U.shade(wood, 1.12));
  px(0, 12, 34, 2, wood);
  px(0, 14, 34, 1, U.shade(wood, 0.7));
  // 木目
  for (let x = 2; x < 32; x += 5) { px(x, 1, 2, 1, U.shade(wood, 0.9)); px(x + 2, 12, 2, 1, U.shade(wood, 0.88)); }
  return cv;
}

function makeLamp() {
  const cv = U.canvas(10, 52);
  const g = cv.getContext('2d');
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  px(4, 6, 2, 44, '#3d4a44');
  px(4, 6, 1, 44, '#566a60');
  px(3, 48, 4, 4, '#2f3934');
  px(1, 1, 8, 5, '#2f3934');
  px(2, 2, 6, 3, '#f2e3a8');
  px(2, 0, 6, 1, '#3d4a44');
  return cv;
}

function makeVending() {
  const cv = U.canvas(18, 30);
  const g = cv.getContext('2d');
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  px(0, 0, 18, 30, '#eef0f0');
  px(0, 0, 18, 1, '#ffffff');
  px(17, 0, 1, 30, '#c4c8ca');
  px(2, 2, 14, 12, '#9cc6d8');
  const cans = ['#d23a32', '#2f6fb3', '#e6b32c', '#3a8a4a', '#8a3a8a', '#e2e2e2'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { px(3 + c * 3, 3 + r * 4, 2, 3, cans[(r * 5 + c) % cans.length]); px(3 + c * 3, 6 + r * 4, 2, 1, '#c84a2a'); }
  px(2, 16, 10, 3, '#2a2c30');
  px(13, 16, 3, 5, '#bfc4c7');
  px(3, 23, 12, 4, '#3a3d42');
  px(0, 28, 18, 2, '#9aa0a3');
  return cv;
}

function makeRecycleBox() {
  const cv = U.canvas(10, 12);
  const g = cv.getContext('2d');
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  px(0, 2, 10, 10, '#3a73b8');
  px(0, 2, 10, 1, '#5a90cf');
  px(2, 4, 6, 2, '#1d2a3a');
  px(0, 0, 10, 2, '#2e5c96');
  return cv;
}

function makeReeds(seed, h) {
  const cv = U.canvas(14, h);
  const g = cv.getContext('2d');
  const rnd = U.rng(seed);
  for (let i = 0; i < 7; i++) {
    const x = 1 + Math.floor(rnd() * 12);
    const len = h * (0.5 + rnd() * 0.5);
    const lean = (rnd() - 0.5) * 4;
    for (let y = 0; y < len; y++) {
      const xx = Math.round(x + (lean * y) / len);
      g.fillStyle = y < len * 0.25 ? '#d9cfae' : y < len * 0.5 ? '#b9b07a' : '#7d8a4a';
      g.fillRect(xx, h - 1 - y, 1, 1);
    }
    // ススキの穂
    const tx = Math.round(x + lean);
    g.fillStyle = '#ece4cc';
    g.fillRect(tx - 1, Math.round(h - len), 2, 3);
    g.fillStyle = '#c9bc98';
    g.fillRect(tx, Math.round(h - len) + 3, 1, 2);
  }
  return cv;
}

// ---- 公園 ----
function buildPark(W, H) {
  const seed = 11;
  const bg = U.canvas(W, H);
  const pathY = (x) => H * 0.6 + Math.sin((x / W) * Math.PI * 1.2 + 0.6) * H * 0.1;
  const pathHalf = Math.max(14, H * 0.11);
  const top = Math.round(H * 0.24);
  paintPixels(bg, (x, y) => {
    const py = pathY(x);
    const edgeJ = (U.hash(x, 3, seed) - 0.5) * 2.4;
    const dy = Math.abs(y - py);
    if (dy < pathHalf + edgeJ) {
      const n = U.hash(x, y, seed + 5);
      let c = PAL.dirt[Math.floor(U.fbm(x / 6, y / 6, seed) * 4) % 4];
      if (n < 0.04) c = [168, 146, 112];
      else if (n > 0.97) c = [232, 218, 190];
      if (dy > pathHalf + edgeJ - 1.2) c = U.shade(c, 0.86);
      return c;
    }
    // 芝生
    const n = U.fbm(x / 9, y / 7, seed);
    let c = PAL.grass[Math.floor(n * 5) % 5];
    const h = U.hash(x, y, seed + 1);
    if (h < 0.07) c = U.shade(c, 0.85);
    else if (h > 0.95) c = U.shade(c, 1.12);
    // 芝の草むら
    if (U.hash(Math.floor(x / 3), Math.floor(y / 2), seed + 9) > 0.93 && (x + y) % 2 === 0) c = U.shade(c, 1.18);
    // 木陰
    if (y < top + 10) c = U.shade(c, 0.78 + ((y - (top - 30)) / 40) * 0.2);
    return c;
  });
  const g = bg.getContext('2d');
  // 花・クローバー
  for (let i = 0; i < (W * H) / 900; i++) {
    const x = U.randi(0, W - 1), y = U.randi(top, H - 1);
    if (Math.abs(y - pathY(x)) < pathHalf + 3) continue;
    g.fillStyle = U.pick(['#f2f0e6', '#f0d84a', '#e9e4f2']);
    g.fillRect(x, y, 1, 1);
    if (U.chance(0.5)) { g.fillStyle = '#4c7a36'; g.fillRect(x, y + 1, 1, 1); }
  }
  // 木
  const trees = [];
  const nTree = Math.max(2, Math.round(W / 110));
  const kinds = ['ginkgo', 'zelkova', 'maple', 'green'];
  for (let i = 0; i < nTree; i++) {
    const x = Math.round(((i + 0.5) / nTree) * W + U.rand(-12, 12));
    trees.push({ x, kind: kinds[i % kinds.length] });
  }
  for (const t of trees) {
    // 幹
    const baseY = top + 2;
    g.fillStyle = '#5a4434'; g.fillRect(t.x - 3, top - 26, 6, 28);
    g.fillStyle = '#6e5442'; g.fillRect(t.x - 2, top - 26, 2, 28);
    g.fillStyle = '#4a382b'; g.fillRect(t.x + 2, top - 26, 1, 28);
    g.fillStyle = '#5a4434'; g.fillRect(t.x - 5, baseY - 2, 10, 2);
    g.fillStyle = 'rgba(30,50,20,0.25)';
    g.fillRect(t.x - 10, baseY, 20, 2);
  }
  for (const t of trees) {
    const cols = t.kind === 'green' ? ['#3f6b35', '#4a7a3c', '#567f40', '#35592d'] : PAL.leafColors[t.kind];
    drawTreeCanopy(g, t.x, top - 34, 26, cols, seed + t.x);
  }
  const props = [];
  const perches = [];
  // ベンチ
  const bench = makeBench('#9a6a42');
  const bx = Math.round(W * 0.62 - 17);
  const by = Math.round(pathY(bx + 17) - pathHalf - 1);
  props.push({ img: bench, x: bx, y: by, base: by + 19, foot: [bx, by + 12, 34, 8] });
  perches.push({ x1: bx + 3, x2: bx + 31, sy: by + 1, gy: by + 19.5 });
  // 街灯
  const lamp = makeLamp();
  const lx = Math.round(W * 0.2);
  const ly = Math.round(pathY(lx) + pathHalf + 3);
  props.push({ img: lamp, x: lx - 5, y: ly - 51, base: ly, foot: [lx - 2, ly - 3, 4, 4] });
  perches.push({ x1: lx - 2, x2: lx + 2, sy: ly - 51, gy: ly + 0.5 });

  // 落ち葉
  const leaves = [];
  for (const t of trees) {
    if (t.kind === 'green') continue;
    const n = Math.round(14 + W / 40);
    for (let i = 0; i < n; i++) {
      const x = t.x + U.rand(-40, 40) * (U.chance(0.3) ? 2 : 1);
      const y = top + Math.abs(U.rand(0, 1) * U.rand(0, 1)) * (H - top) * 0.9 + 2;
      if (x < 0 || x >= W) continue;
      leaves.push(makeLeaf(x, y, PAL.leafColors[t.kind], t.kind === 'ginkgo' ? 'ginkgo' : 'leaf'));
    }
  }
  return {
    id: 'park', name: '公園', W, H, bg, props, perches, leaves, trees,
    top,
    kijiMul: 2.2,
    fallingLeaves: trees.filter((t) => t.kind !== 'green').map((t) => ({ x: t.x, y: top - 34, kind: t.kind })),
    events: ['person', 'person', 'jogger', 'cat'],
    walkable(x, y) {
      if (x < 2 || x > W - 2 || y < top + 2 || y > H - 2) return false;
      for (const p of props) { const f = p.foot; if (x >= f[0] - 1 && x <= f[0] + f[2] + 1 && y >= f[1] && y <= f[1] + f[3] + 1) return false; }
      return true;
    },
    // 鳩が好きな場所（小道の上）
    preferred(x, y) { return Math.abs(y - pathY(x)) < pathHalf; },
    pathY, pathHalf,
  };
}

// ---- 路上 ----
function buildStreet(W, H) {
  const seed = 23;
  const bg = U.canvas(W, H);
  const wallH = Math.round(H * 0.26);
  const roadTop = Math.round(H * 0.66);
  const roadBot = Math.round(H * 0.95);
  const tactY = Math.round(wallH + (roadTop - wallH) * 0.42);
  paintPixels(bg, (x, y) => {
    if (y < wallH) {
      // 建物: シャッターと壁
      const seg = Math.floor(x / 64);
      const sx = x % 64;
      const shopTop = Math.round(wallH * 0.18);
      if (y < shopTop) return U.shade([186, 176, 160], 0.95 + U.hash(x, y, seed) * 0.08);
      if (y === shopTop) return [120, 112, 100];
      if (sx < 3 || sx > 61) return [150, 142, 130];
      if (seg % 3 === 1) {
        // ガラス窓（中は暗め）
        if (y < wallH - 6) {
          const c = (sx + y) % 13 < 2 ? [168, 196, 206] : [86, 108, 120];
          return U.shade(c, 0.95 + (y / wallH) * 0.1);
        }
        return [130, 124, 116];
      }
      // シャッター
      return y % 3 === 0 ? [140, 144, 148] : U.shade([176, 180, 184], 0.97 + U.hash(x, y, seed) * 0.05);
    }
    if (y < wallH + 2) return [110, 106, 98];
    if (y < roadTop) {
      // 点字ブロック
      if (y >= tactY && y < tactY + 6) {
        const tx = x % 6, ty = (y - tactY) % 6;
        if (tx === 0 || ty === 0) return [196, 160, 40];
        return (tx === 2 || tx === 4) && (ty === 2 || ty === 4) ? [240, 206, 72] : [226, 188, 50];
      }
      // インターロッキング
      const row = Math.floor((y - wallH) / 4);
      const off = row % 2 ? 4 : 0;
      const bx = Math.floor((x + off) / 8);
      if ((y - wallH) % 4 === 0 || (x + off) % 8 === 0) return [134, 128, 118];
      const tone = U.hash(bx, row, seed);
      let c = tone < 0.15 ? [176, 150, 130] : tone < 0.5 ? [186, 180, 168] : [172, 166, 154];
      if (U.hash(x, y, seed + 2) < 0.05) c = U.shade(c, 0.9);
      return c;
    }
    if (y < roadTop + 2) return y === roadTop ? [214, 212, 206] : [168, 166, 160];
    if (y === roadTop + 2) return [60, 60, 62];
    if (y < roadBot) {
      const mid = Math.round((roadTop + roadBot) / 2);
      if (y === mid && Math.floor(x / 12) % 2 === 0) return [228, 226, 216];
      if (y === roadTop + 5) return [206, 204, 196];
      const n = U.hash(x, y, seed + 4);
      const c = [78, 79, 84];
      return U.shade(c, 0.9 + n * 0.2);
    }
    if (y === roadBot) return [214, 212, 206];
    return U.shade([170, 166, 158], 0.95 + U.hash(x, y, seed) * 0.08);
  });
  const g = bg.getContext('2d');
  // マンホール
  const mx = Math.round(W * 0.7), my = Math.round(wallH + (roadTop - wallH) * 0.75);
  for (let y = -4; y <= 4; y++) for (let x = -7; x <= 7; x++) {
    const d = (x * x) / 49 + (y * y) / 16;
    if (d > 1) continue;
    g.fillStyle = d > 0.75 ? '#55544f' : (x + y) % 3 === 0 ? '#6c6a64' : '#7c7a73';
    g.fillRect(mx + x, my + y, 1, 1);
  }
  // 側溝のグレーチング
  for (let x = Math.round(W * 0.3); x < W * 0.3 + 24; x++) { g.fillStyle = x % 2 ? '#3a3a3c' : '#6a6a6c'; g.fillRect(x, roadTop - 3, 1, 3); }
  // 電柱
  const poleX = Math.round(W * 0.12);
  g.fillStyle = '#9d9a92'; g.fillRect(poleX - 3, 0, 6, wallH + 4);
  g.fillStyle = '#b8b5ad'; g.fillRect(poleX - 2, 0, 2, wallH + 4);
  g.fillStyle = '#7d7a72'; g.fillRect(poleX + 2, 0, 1, wallH + 4);
  g.fillStyle = '#5a5850'; g.fillRect(poleX - 8, 6, 16, 2);

  const overlay = U.canvas(W, H);
  const og = overlay.getContext('2d');
  // 電線（たるんだ線）
  const wires = [10, 14].map((y0, k) => ({ y0, sag: 5 + k * 2 }));
  const wireY = (w, x) => w.y0 + w.sag * (1 - Math.pow((x - (poleX + W) / 2) / ((W - poleX) / 2 + 30), 2)) * 1;
  for (const w of wires) {
    og.fillStyle = '#2a2a2e';
    for (let x = poleX; x < W; x++) og.fillRect(x, Math.round(wireY(w, x)), 1, 1);
  }
  const perches = [];
  for (const w of wires) perches.push({ x1: poleX + 14, x2: W - 6, syFn: (x) => Math.round(wireY(w, x)), gy: wallH + 4, wire: true });

  const props = [];
  const vend = makeVending();
  const vx = Math.round(W * 0.42);
  props.push({ img: vend, x: vx, y: wallH - 22, base: wallH + 7, foot: [vx, wallH, 18, 8] });
  perches.push({ x1: vx + 3, x2: vx + 15, sy: wallH - 22, gy: wallH + 7.5 });
  const rb = makeRecycleBox();
  props.push({ img: rb, x: vx + 20, y: wallH - 3, base: wallH + 9, foot: [vx + 20, wallH + 2, 10, 7] });

  const leaves = [];
  for (let i = 0; i < W / 9; i++) {
    const x = U.rand(0, W);
    const y = U.chance(0.5) ? U.rand(roadTop - 8, roadTop - 1) : U.rand(wallH + 3, roadTop - 2);
    leaves.push(makeLeaf(x, y, PAL.leafColors.ginkgo, 'ginkgo'));
  }
  return {
    id: 'street', name: '路上', W, H, bg, overlay, props, perches, leaves,
    top: wallH,
    kijiMul: 0.4,
    fallingLeaves: [{ x: -10, y: wallH, kind: 'ginkgo', wind: true }],
    events: ['person', 'person', 'person', 'bike', 'car', 'car'],
    road: { y0: roadTop + 3, y1: roadBot - 1 },
    walkable(x, y) {
      if (x < 2 || x > W - 2 || y < wallH + 3 || y > roadBot - 2) return false;
      if (x > poleX - 4 && x < poleX + 4 && y < wallH + 5) return false;
      for (const p of props) { const f = p.foot; if (x >= f[0] - 1 && x <= f[0] + f[2] + 1 && y >= f[1] && y <= f[1] + f[3] + 1) return false; }
      return true;
    },
    preferred(x, y) { return y < roadTop; },
  };
}

// ---- 川沿い ----
function buildRiver(W, H) {
  const seed = 37;
  const bg = U.canvas(W, H);
  const farBank = Math.round(H * 0.06);
  const waterBot = Math.round(H * 0.3);
  const wallBot = Math.round(H * 0.36);
  const pathTop = wallBot + 1;
  const pathBot = Math.round(H * 0.72);
  paintPixels(bg, (x, y) => {
    if (y < farBank) {
      const n = U.fbm(x / 5, y / 3, seed);
      return U.shade([74, 104, 70], 0.8 + n * 0.4 - (farBank - y) * 0.01);
    }
    if (y < waterBot) {
      const t = (y - farBank) / (waterBot - farBank);
      let c = U.mix([92, 140, 158], [58, 104, 124], t);
      const n = U.fbm(x / 14, y / 3, seed + 1);
      c = U.shade(c, 0.94 + n * 0.12);
      if (y === farBank) c = [62, 84, 72];
      return c;
    }
    if (y < wallBot) {
      // 護岸
      if (y === waterBot) return [180, 178, 168];
      if (y === waterBot + 1) return [202, 200, 190];
      const by = Math.floor((y - waterBot) / 3), bx = Math.floor((x + (by % 2) * 5) / 10);
      if ((y - waterBot) % 3 === 0 || (x + (by % 2) * 5) % 10 === 0) return [118, 118, 110];
      return U.shade([154, 152, 142], 0.92 + U.hash(bx, by, seed) * 0.14);
    }
    if (y < pathBot) {
      // 遊歩道（砂利と土）
      const n = U.hash(x, y, seed + 2);
      let c = U.mix([200, 186, 154], [186, 170, 138], U.fbm(x / 8, y / 8, seed));
      if (n < 0.06) c = [160, 146, 118];
      else if (n > 0.95) c = [226, 216, 194];
      if (y === pathBot - 1) c = [150, 140, 112];
      return c;
    }
    // 土手の草
    const n = U.fbm(x / 9, y / 6, seed + 3);
    let c = U.mix(PAL.grass[Math.floor(n * 5) % 5], [150, 140, 90], 0.25);
    if (U.hash(x, y, seed) < 0.08) c = U.shade(c, 0.85);
    return c;
  });
  const g = bg.getContext('2d');
  // 対岸の木
  for (let x = 0; x < W; x += 18) drawTreeCanopy(g, x + U.rand(0, 8), farBank - 2, 9, ['#4a6b3a', '#c84a32', '#d9963a', '#3e5a33'], seed + x);
  // 手すり（護岸の上）
  const railY = wallBot - 9;
  const overlay = U.canvas(W, H);
  const og = overlay.getContext('2d');
  og.fillStyle = '#4a5a62';
  for (let x = 2; x < W; x += 16) og.fillRect(x, railY, 2, 10);
  og.fillStyle = '#6f8590'; og.fillRect(0, railY, W, 2);
  og.fillStyle = '#3d4b52'; og.fillRect(0, railY + 2, W, 1);
  og.fillStyle = '#5b6d76'; og.fillRect(0, railY + 6, W, 1);
  const perches = [{ x1: 4, x2: W - 4, sy: railY, gy: wallBot + 0.5 }];

  const props = [];
  // ベンチ
  const bench = makeBench('#7a8a6a');
  const bx = Math.round(W * 0.7);
  const bY = pathBot - 4 - 19;
  props.push({ img: bench, x: bx, y: bY, base: pathBot - 4, foot: [bx, bY + 12, 34, 8] });
  perches.push({ x1: bx + 3, x2: bx + 31, sy: bY + 1, gy: pathBot - 3.5 });
  // ススキ
  for (let x = 0; x < W; x += U.randi(14, 30)) {
    const h = U.randi(16, 26);
    const by2 = U.randi(pathBot + 6, H + 4);
    props.push({ img: makeReeds(seed + x, h), x, y: by2 - h, base: by2 });
  }
  const leaves = [];
  for (let i = 0; i < W / 7; i++) leaves.push(makeLeaf(U.rand(0, W), U.rand(pathTop + 2, H - 2), PAL.leafColors.sakura, 'leaf'));

  // 水面のきらめき
  const glints = [];
  for (let i = 0; i < (W * (waterBot - farBank)) / 60; i++) glints.push({ x: U.rand(0, W), y: U.randi(farBank + 2, waterBot - 2), len: U.randi(2, 5), ph: U.rand(0, 6) });
  return {
    id: 'river', name: '川沿い', W, H, bg, overlay, props, perches, leaves,
    top: wallBot,
    kijiMul: 1.6,
    fallingLeaves: [{ x: -10, y: wallBot - 30, kind: 'sakura', wind: true }],
    events: ['person', 'jogger', 'jogger', 'bike', 'cat'],
    water: { y0: farBank + 2, y1: waterBot - 2 },
    walkable(x, y) {
      if (x < 2 || x > W - 2 || y < pathTop + 1 || y > H - 2) return false;
      for (const p of props) { const f = p.foot; if (f && x >= f[0] - 1 && x <= f[0] + f[2] + 1 && y >= f[1] && y <= f[1] + f[3] + 1) return false; }
      return true;
    },
    preferred(x, y) { return y < pathBot; },
    drawAnim(ctx, t) {
      for (const gl of glints) {
        const x = (gl.x + t * 6) % (W + 10) - 5;
        const a = Math.sin(t * 2.2 + gl.ph);
        if (a < 0.3) continue;
        ctx.fillStyle = a > 0.8 ? 'rgba(230,244,246,0.9)' : 'rgba(180,214,222,0.7)';
        ctx.fillRect(Math.round(x), gl.y, gl.len, 1);
      }
    },
  };
}

const SCENES = { park: buildPark, street: buildStreet, river: buildRiver };
