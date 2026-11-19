'use strict';
// 小さな道具箱。乱数、色、ノイズ。
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  sign: (v) => (v < 0 ? -1 : 1),

  // 整数座標の決定的ハッシュ → [0,1)
  hash(x, y, s = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  // 滑らかな値ノイズ
  noise(x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = U.hash(xi, yi, s), b = U.hash(xi + 1, yi, s);
    const c = U.hash(xi, yi + 1, s), d = U.hash(xi + 1, yi + 1, s);
    return U.lerp(U.lerp(a, b, sx), U.lerp(c, d, sx), sy);
  },
  fbm(x, y, s = 0) {
    return U.noise(x, y, s) * 0.55 + U.noise(x * 2.1, y * 2.1, s + 7) * 0.3 + U.noise(x * 4.3, y * 4.3, s + 13) * 0.15;
  },

  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  css(c, a) {
    return a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  },
  shade(c, f) {
    return [U.clamp(Math.round(c[0] * f), 0, 255), U.clamp(Math.round(c[1] * f), 0, 255), U.clamp(Math.round(c[2] * f), 0, 255)];
  },
  mix(a, b, t) {
    return [Math.round(U.lerp(a[0], b[0], t)), Math.round(U.lerp(a[1], b[1], t)), Math.round(U.lerp(a[2], b[2], t))];
  },
  // 影色は単純に暗くせず、少し青紫に寄せるとドット絵っぽくなる
  shadeHue(c, f) {
    const d = U.shade(c, f);
    if (f < 1) return U.mix(d, [d[0] * 0.9, d[1] * 0.92, Math.min(255, d[2] * 1.08 + 4)], 0.5).map(Math.round);
    return U.mix(d, [Math.min(255, d[0] + 6), Math.min(255, d[1] + 4), d[2]], 0.4).map(Math.round);
  },

  canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },

  weighted(items, wfn) {
    let total = 0;
    for (const it of items) total += wfn(it);
    let r = Math.random() * total;
    for (const it of items) {
      r -= wfn(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  },

  pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  },

  // 線分への距離と射影パラメータ
  segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = U.clamp(t, 0, 1);
    return { d: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
  },
};
