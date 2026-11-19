'use strict';
// 鳩のドット絵を手続き的にラスタライズする。
// 1羽ごと・ポーズごとに小さなキャンバスを生成してキャッシュ。右向きで描き、左向きは描画時に反転。
const SPR = { W: 34, H: 32, AX: 15, AY: 25 }; // AX,AY = 足元(地面接地点)

// ---- ポーズ定義 ---------------------------------------------------------
// 返り値: 描画パラメータ。座標はスプライト内ピクセル。
function pigeonPose(key, kiji) {
  const p = {
    B: [14, 17.5], rx: 6.9, ry: 4.1, ang: -0.3, // 胴
    H: [20, 9.5], hr: 2.65, beakAng: 0.28, beakDir: 1, // 頭
    neckR0: 2.8, neckR1: 2.1, chestR: 3.6,
    tailLen: 7.2, tailDrop: 0.35, tailW: 2.0,
    wing: 'fold', legs: 0, legsVisible: true, puff: 0,
    fly: null,
  };
  if (kiji) {
    p.rx = 6.6; p.ry = 3.7; p.hr = 2.45; p.tailLen = 8.4; p.chestR = 3.3; p.neckR0 = 2.8;
  }
  const parts = key.split(':');
  const kind = parts[0];
  const a = parseFloat(parts[1] || '0');
  const b = parseFloat(parts[2] || '0');
  switch (kind) {
    case 'stand': // a: 頭の前後オフセット(-1..2), b: 脚フレーム(0,1,2)
      p.H = [19.5 + a, 9.5 - Math.max(0, a) * 0.25];
      p.legs = b;
      break;
    case 'peck': { // a: 0..1 頭を下ろす量
      const t = a;
      p.ang = U.lerp(-0.3, 0.32, t);
      p.B = [14 - t * 0.6, 17.5 + t * 0.6];
      p.H = [U.lerp(19.5, 23.2, t), U.lerp(9.5, 22.2, t)];
      p.beakAng = U.lerp(0.28, 1.25, t);
      p.tailDrop = U.lerp(0.35, -0.15, t);
      p.legs = b;
      break;
    }
    case 'look': // 首を伸ばして警戒
      p.ang = -0.5;
      p.B = [13.6, 17.2];
      p.H = [19.2, 6.6];
      p.neckR1 = 2.0;
      p.beakAng = 0.1;
      p.tailDrop = 0.55;
      break;
    case 'preen': // 羽づくろい: 頭を背中側へ
      p.ang = -0.2;
      p.H = [14.5 + a, 11.5];
      p.beakDir = -1;
      p.beakAng = 0.9;
      p.puff = 0.3;
      break;
    case 'coo': { // a: ふくらみ 0..1, b: お辞儀 0..1
      p.puff = a;
      p.chestR = (kiji ? 3.3 : 3.6) * (1 + a * 0.35);
      p.neckR0 *= 1 + a * 0.55;
      p.neckR1 *= 1 + a * 0.4;
      p.ang = U.lerp(-0.42, 0.05, b);
      p.H = [U.lerp(19.3, 20.6, b), U.lerp(8.6, 13.5, b)];
      p.beakAng = U.lerp(0.3, 0.9, b);
      p.tailDrop = U.lerp(0.55, 0.9, a); // しっぽを引きずる
      p.tailW = 2.0 + a * 1.2;
      break;
    }
    case 'sit': // 止まり木で丸くなる
      p.ang = -0.12;
      p.B = [14, 19];
      p.ry = 4.6;
      p.rx = 6.7;
      p.H = [19.4, 12.0];
      p.neckR0 = 3.4;
      p.legsVisible = false;
      p.puff = 0.6 * a;
      p.tailDrop = 0.25;
      break;
    case 'fly': // a: 羽ばたきフレーム 0..3, 4=滑空, 5=着地姿勢
      p.legsVisible = a === 5;
      p.fly = a;
      if (a === 5) {
        p.ang = -0.75;
        p.B = [14, 15];
        p.H = [18.6, 6.4];
        p.tailDrop = 0.9;
        p.tailW = 3.2;
        p.legs = 3;
      } else {
        p.ang = 0.04;
        p.B = [15, 15];
        p.rx = 7.2;
        p.ry = 3.3;
        p.H = [22.6, 12.3];
        p.hr = 2.4;
        p.neckR0 = 2.6;
        p.beakAng = 0.15;
        p.tailDrop = 0.05;
        p.tailW = 1.6;
      }
      break;
  }
  return p;
}

// フライト時の翼ポリゴン（右向き、スプライト座標）
function flyWing(frame) {
  // [肩前, 手首, 先端, 後縁, 肩後]
  switch (frame) {
    case 0: return [[19, 13.5], [18.5, 6], [12.5, -0.5], [10.5, 6.5], [12.5, 13.5]];
    case 1: return [[19.5, 14], [19.5, 9], [10, 5], [10, 11], [12.5, 14]];
    case 2: return [[19.5, 15], [19, 18], [12, 22], [10, 18], [12.5, 15.5]];
    case 3: return [[19, 15], [18.5, 21], [14, 29], [11, 22], [12.5, 16]];
    case 4: return [[19.5, 13.5], [19, 9.5], [8.5, 8], [9.5, 12], [12.5, 14]];
    case 5: return [[17, 13], [21, 5], [22, 0], [15, 4], [13, 12]];
  }
  return null;
}

// ---- 個体ごとの模様パラメータ -----------------------------------------
function makeMarkings(variant, seed) {
  const r = U.rng(seed);
  const m = { seed, blobs: [], jitter: 0.94 + r() * 0.12, grizzle: variant.grizzle || 0 };
  if (variant.pied) {
    const n = 1 + Math.floor(r() * 4);
    const regions = ['body', 'body', 'wing', 'head', 'neck', 'prim', 'tail'];
    for (let i = 0; i < n; i++) {
      m.blobs.push({ region: regions[Math.floor(r() * regions.length)], u: (r() - 0.5) * 8, v: (r() - 0.5) * 5, rad: 1.2 + r() * 2.6 });
    }
    if (r() < 0.25) m.blobs.push({ region: 'head', u: 0, v: 0, rad: 4 });
    if (r() < 0.3) m.whitePrim = true;
  }
  // 黒っぽい個体でもたまに白い差し毛
  if (!variant.pied && r() < 0.08 && variant.id !== 'white') {
    m.blobs.push({ region: r() < 0.5 ? 'prim' : 'head', u: (r() - 0.5) * 3, v: (r() - 0.5) * 2, rad: 1.0 });
  }
  return m;
}

// ---- ラスタライザ --------------------------------------------------------
function renderPigeon(variant, marks, key) {
  const kiji = variant.species === 'kiji';
  const P = pigeonPose(key, kiji);
  const W = SPR.W, H = SPR.H;
  const ca = Math.cos(P.ang), sa = Math.sin(P.ang);
  const toLocal = (x, y, cx, cy) => {
    const dx = x - cx, dy = y - cy;
    return [dx * ca + dy * sa, -dx * sa + dy * ca];
  };
  const toWorld = (u, v) => [P.B[0] + u * ca - v * sa, P.B[1] + u * sa + v * ca];
  const neck0 = toWorld(P.rx * 0.55, -P.ry * 0.55);
  const chestC = toWorld(P.rx * 0.55, 0.2);
  const tailBase = toWorld(-P.rx * 0.7, -0.3);
  const tdx = -Math.cos(P.tailDrop * 0.6 + 0) * P.tailLen;
  const tailDir = [Math.cos(Math.PI + P.ang + P.tailDrop), Math.sin(Math.PI + P.ang + P.tailDrop)];
  void tdx;
  const tailEnd = [tailBase[0] + tailDir[0] * P.tailLen, tailBase[1] + tailDir[1] * P.tailLen];
  const tailN = [-tailDir[1], tailDir[0]];
  const tw0 = 1.7, tw1 = P.tailW;
  const tailPoly = [
    [tailBase[0] + tailN[0] * tw0, tailBase[1] + tailN[1] * tw0],
    [tailEnd[0] + tailN[0] * tw1, tailEnd[1] + tailN[1] * tw1],
    [tailEnd[0] - tailN[0] * tw1 * 0.8, tailEnd[1] - tailN[1] * tw1 * 0.8],
    [tailBase[0] - tailN[0] * tw0, tailBase[1] - tailN[1] * tw0],
  ];
  // 折りたたんだ翼
  const wingC = toWorld(-0.9, -0.7);
  const wrx = P.rx * 0.86, wry = P.ry * 0.72;
  const primTip = toWorld(-P.rx - (kiji ? 4.6 : 4.0), 0.4 + (P.ang > 0.1 ? 0 : 0.4));
  const primA = toWorld(-P.rx * 0.35, -P.ry * 0.55);
  const primB = toWorld(-P.rx * 0.45, P.ry * 0.45);
  const primPoly = [primA, primTip, primB];

  const flyPoly = P.fly !== null ? flyWing(P.fly) : null;
  const farPoly = flyPoly && (P.fly <= 1 || P.fly === 4 || P.fly === 5) ? flyPoly.map(([x, y]) => [x + 2.2, y + 1.3]) : null;

  // 各ピクセルの領域判定
  const reg = new Array(W * H).fill(null);
  const loc = new Array(W * H);
  const beakLen = kiji ? 2.0 : 2.1;
  const bd = P.beakDir;
  const bx = Math.cos(P.beakAng) * bd, by = Math.sin(P.beakAng);
  const bA = [P.H[0] + bx * (P.hr - 0.2), P.H[1] + by * (P.hr - 0.2)];
  const bB = [bA[0] + bx * beakLen, bA[1] + by * beakLen];
  const eye = [P.H[0] + 0.55 * bd, P.H[1] - 0.45];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      const i = y * W + x;
      // 近い翼(飛行時)
      if (flyPoly && U.pointInPoly(px, py, flyPoly)) {
        const d0 = U.dist(px, py, (flyPoly[0][0] + flyPoly[4][0]) / 2, (flyPoly[0][1] + flyPoly[4][1]) / 2);
        const dT = U.dist(flyPoly[2][0], flyPoly[2][1], (flyPoly[0][0] + flyPoly[4][0]) / 2, (flyPoly[0][1] + flyPoly[4][1]) / 2);
        reg[i] = d0 / dT > 0.55 ? 'fprim' : 'fwing';
        loc[i] = [d0 / dT, 0];
        continue;
      }
      // くちばし
      const sb = U.segDist(px, py, bA[0], bA[1], bB[0], bB[1]);
      if (sb.d < 0.62) { reg[i] = sb.t < 0.35 ? 'cere' : 'beak'; continue; }
      // 頭
      const dh = U.dist(px, py, P.H[0], P.H[1]);
      if (dh < P.hr) {
        if (Math.abs(px - eye[0]) < 0.5 && Math.abs(py - eye[1]) < 0.5) reg[i] = 'eye';
        else reg[i] = 'head';
        loc[i] = [px - P.H[0], py - P.H[1]];
        continue;
      }
      // 首
      const sn = U.segDist(px, py, neck0[0], neck0[1], P.H[0], P.H[1]);
      if (sn.d < U.lerp(P.neckR0, P.neckR1, sn.t)) {
        reg[i] = 'neck';
        loc[i] = [sn.t, sn.d];
        continue;
      }
      // 折りたたんだ翼・風切
      if (!flyPoly || P.fly === 5) {
        const [wu, wv] = toLocal(px, py, wingC[0], wingC[1]);
        if ((wu * wu) / (wrx * wrx) + (wv * wv) / (wry * wry) < 1 && !flyPoly) {
          reg[i] = 'wing';
          loc[i] = [wu, wv];
          continue;
        }
        if (!flyPoly && U.pointInPoly(px, py, primPoly)) {
          const [pu, pv] = toLocal(px, py, P.B[0], P.B[1]);
          reg[i] = 'prim';
          loc[i] = [pu, pv];
          continue;
        }
      }
      // 胴・胸
      const [bu, bv] = toLocal(px, py, P.B[0], P.B[1]);
      const inBody = (bu * bu) / (P.rx * P.rx) + (bv * bv) / (P.ry * P.ry) < 1;
      const inChest = U.dist(px, py, chestC[0], chestC[1]) < P.chestR;
      if (inBody || inChest) {
        reg[i] = inChest && !inBody ? 'chest' : bu > P.rx * 0.2 && bv < 0 ? 'chest' : 'body';
        loc[i] = [bu, bv];
        continue;
      }
      // しっぽ
      if (U.pointInPoly(px, py, tailPoly)) {
        const t = ((px - tailBase[0]) * tailDir[0] + (py - tailBase[1]) * tailDir[1]) / P.tailLen;
        reg[i] = 'tail';
        loc[i] = [t, (px - tailBase[0]) * tailN[0] + (py - tailBase[1]) * tailN[1]];
        continue;
      }
      // 奥の翼
      if (farPoly && U.pointInPoly(px, py, farPoly)) {
        reg[i] = 'far';
        continue;
      }
    }
  }

  // 脚
  if (P.legsVisible) {
    const legBaseY = Math.round(P.B[1] + P.ry * 0.75);
    const lx = Math.round(P.B[0] + 0.5);
    const footY = P.fly === 5 ? legBaseY + 3 : SPR.AY - 1;
    const offs = P.legs === 1 ? [-1, 1] : P.legs === 2 ? [1, -1] : P.legs === 3 ? [1, 2] : [0, 1];
    offs.forEach((o, k) => {
      const x0 = lx + o;
      for (let y = legBaseY; y <= footY; y++) {
        if (y >= 0 && y < H && !reg[y * W + x0]) reg[y * W + x0] = k === 0 ? 'leg' : 'legb';
      }
      // つま先
      const tx = x0 + 1;
      if (footY < H && !reg[footY * W + tx]) reg[footY * W + tx] = k === 0 ? 'leg' : 'legb';
    });
  }

  // ---- 塗り ----
  const C = variant.c;
  const out = new Uint8ClampedArray(W * H * 4);
  const jit = marks.jitter;
  const isBlob = (region, u, v) => {
    for (const b of marks.blobs) {
      if (b.region !== region) continue;
      if ((u - b.u) * (u - b.u) + (v - b.v) * (v - b.v) < b.rad * b.rad) return true;
    }
    return false;
  };
  const grizz = (region, u, v) => marks.grizzle && U.hash(Math.round(u * 1.3), Math.round(v * 1.3), marks.seed + region.length * 31) < marks.grizzle;

  const colorAt = (i, x, y) => {
    const r = reg[i];
    const L = loc[i] || [0, 0];
    let c, f = 1;
    switch (r) {
      case 'beak': return C.beak;
      case 'cere': return C.cere;
      case 'eye': return C.eye;
      case 'leg': return C.leg;
      case 'legb': return U.shade(C.leg, 0.78);
      case 'head': {
        c = variant.whiteHead ? C.white : C.head;
        if (isBlob('head', L[0] * 1.5, L[1] * 1.5)) c = C.white;
        if (grizz('head', L[0], L[1]) || (marks.grizzle && U.hash(x, y, marks.seed) < 0.5)) c = U.mix(c, C.white, 0.6);
        f = 1.08 - (L[1] + P.hr) / (2 * P.hr) * 0.18;
        // キジバトの頭は青灰
        return U.shadeHue(c, f * jit);
      }
      case 'neck': {
        const t = L[0];
        if (kiji) {
          // キジバトの首: 側面に青黒と淡色のしましま
          c = U.mix(C.body, C.head, t);
          if (!variant.juvenile && t > 0.15 && t < 0.62 && L[1] < 1.9 && L[1] > 0.2) {
            c = (y % 2 === 0) ? C.neckG : C.neckP;
          }
        } else {
          // 虹色は首の側面だけ。根元は胸の色、上は頭の色に溶ける
          if (t < 0.22) c = U.mix(C.body, C.neckP, t / 0.22 * 0.45);
          else if (t < 0.5) c = U.mix(C.body, C.neckP, 0.7);
          else if (t < 0.8) c = U.mix(C.body, C.neckG, 0.78);
          else c = U.mix(C.neckG, C.head, Math.min(1, (t - 0.8) / 0.15));
          if (L[1] > U.lerp(P.neckR0, P.neckR1, t) - 0.9 && x > P.H[0] - 1) c = U.mix(c, C.body, 0.4);
          if (variant.whiteHead && t > 0.7) c = C.white;
        }
        if (isBlob('neck', (t - 0.5) * 6, L[1])) c = C.white;
        if (grizz('neck', t * 6, L[1])) c = U.mix(c, C.white, 0.5);
        f = 1.05 - L[1] * 0.04;
        return U.shadeHue(c, f * jit);
      }
      case 'chest':
      case 'body': {
        const u = L[0], v = L[1];
        c = r === 'chest' && !kiji ? U.mix(C.body, C.neckP, 0.12) : C.body;
        if (kiji && r === 'chest') c = U.mix(C.body, [205, 170, 158], 0.25);
        if (u < -P.rx * 0.55 && v < 0) c = C.rump;
        if (isBlob('body', u, v)) c = C.white;
        if (grizz('body', u, v)) c = U.mix(c, C.white, 0.65);
        f = 1.1 - ((v / P.ry + 1) / 2) * 0.32;
        if (u > P.rx * 0.5 && v < 0) f += 0.05;
        return U.shadeHue(c, f * jit);
      }
      case 'wing': {
        const u = L[0], v = L[1];
        c = C.wing;
        const pat = variant.pattern;
        const ui = Math.floor(u + 20), vi = Math.floor(v + 20);
        if (pat === 'bar') {
          // 翼の後ろ寄りに二本の帯
          const s = u + v * 0.45;
          if ((s > -3.6 && s < -2.4) || (s > -1.2 && s < 0.0)) if (v > -wry * 0.75) c = C.mark;
        } else if (pat === 'checker') {
          if ((ui + vi * 2) % 3 === 0 && u < wrx * 0.55) c = C.mark;
          const s = u + v * 0.35;
          if (s > -3.1 && s < -2.1 && v > -wry * 0.4) c = C.mark;
        } else if (pat === 'dark') {
          if ((ui * 3 + vi * 5) % 7 === 0 && u < wrx * 0.5) c = C.mark;
        } else if (pat === 'kiji') {
          // うろこ: 2x2 セルの中心が濃く、縁が赤茶
          const cu = Math.floor((u + 20) / 2), cv = Math.floor((v + 20 + (cu % 2)) / 2);
          const inU = (u + 20) - cu * 2, inV = (v + 20 + (cu % 2)) - cv * 2;
          const edge = inU > 1.2 || inV > 1.2;
          if (variant.juvenile) c = edge ? U.mix(C.wing, [196, 150, 112], 0.4) : U.mix(C.wing, C.mark, 0.35);
          else c = edge ? U.mix(C.wing, [210, 140, 86], 0.55) : C.mark;
          if (v < -wry * 0.6) c = U.mix(c, C.head, 0.5);
        }
        if (isBlob('wing', u, v)) c = C.white;
        if (grizz('wing', u, v)) c = U.mix(c, C.white, 0.6);
        f = 1.12 - ((v / wry + 1) / 2) * 0.22;
        return U.shadeHue(c, f * jit);
      }
      case 'prim': {
        c = variant.whitePrim || marks.whitePrim ? C.white : C.prim;
        if (isBlob('prim', L[0] + 8, L[1])) c = C.white;
        f = 1.0 - (L[1] / P.ry) * 0.08;
        return U.shadeHue(c, f * jit);
      }
      case 'tail': {
        const t = L[0];
        c = C.tail;
        if (kiji) {
          if (t > 0.86) c = C.band; // 尾の先が白い
          else if (t > 0.7) c = U.shade(C.tail, 0.7);
        } else if (t > 0.72 && t < 0.92) c = C.band;
        if (isBlob('tail', (t - 0.5) * 6, L[1])) c = C.white;
        if (grizz('tail', t * 7, L[1])) c = U.mix(c, C.white, 0.5);
        f = 0.95 - L[1] * 0.03;
        return U.shadeHue(c, f * jit);
      }
      case 'fwing': {
        const t = L[0];
        c = C.wing;
        if (variant.pattern === 'kiji') c = U.mix(C.wing, C.mark, 0.25);
        if (variant.pattern === 'dark') c = U.mix(C.wing, C.mark, 0.2);
        if ((variant.pattern === 'bar' || variant.pattern === 'checker') && t > 0.32 && t < 0.42) c = C.mark;
        if (marks.blobs.some((b) => b.region === 'wing')) if (t < 0.3) c = C.white;
        if (grizz('fwing', x, y)) c = U.mix(c, C.white, 0.6);
        return U.shadeHue(c, 1.1 * jit);
      }
      case 'fprim': {
        c = variant.whitePrim || marks.whitePrim ? C.white : C.prim;
        return U.shadeHue(c, 1.0 * jit);
      }
      case 'far': {
        c = variant.whitePrim || marks.whitePrim ? U.shade(C.white, 0.8) : U.shade(C.prim, 0.85);
        return c;
      }
    }
    return null;
  };

  const col = new Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (reg[i]) col[i] = colorAt(i, x, y);
    }

  // 領域境界の内側線（下側が別領域なら少し暗く）: 翼の縁など
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i + W;
      const r = reg[i], rb = reg[j];
      if (!r || !rb || r === rb) continue;
      if ((r === 'wing' && (rb === 'body' || rb === 'chest')) || (r === 'neck' && rb === 'chest') || (r === 'prim' && rb === 'tail'))
        col[i] = U.shade(col[i], 0.82);
    }

  // アウトライン
  const outline = (x, y) => {
    let best = null, bestL = 999;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of nb) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = col[ny * W + nx];
      if (!c) continue;
      const l = c[0] + c[1] + c[2];
      if (l < bestL) { bestL = l; best = c; }
    }
    return best;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let c = col[i];
      let a = 255;
      if (!c) {
        const n = outline(x, y);
        if (!n) continue;
        const r = reg[i];
        void r;
        c = U.mix(U.shade(n, 0.42), [30, 26, 40], 0.35);
        a = 235;
      }
      out[i * 4] = c[0];
      out[i * 4 + 1] = c[1];
      out[i * 4 + 2] = c[2];
      out[i * 4 + 3] = a;
    }
  const cv = U.canvas(W, H);
  const g = cv.getContext('2d');
  g.putImageData(new ImageData(out, W, H), 0, 0);
  return cv;
}

// 見た目（模様＋スプライトキャッシュ）の共有プール
const LOOKS_PER_VARIANT = 12;
const LOOKS = new Map();
function getLook(variant, idx) {
  const k = variant.id + ':' + idx;
  let l = LOOKS.get(k);
  if (!l) {
    const seed = 1 + VARIANTS.indexOf(variant) * 7919 + idx * 104729;
    l = { seed, marks: makeMarkings(variant, seed), cache: new Map() };
    LOOKS.set(k, l);
  }
  return l;
}

// スプライトキャッシュ（同じ見た目の個体で共有）
function getPigeonSprite(bird, key) {
  let s = bird.cache.get(key);
  if (!s) {
    s = renderPigeon(bird.v, bird.marks, key);
    bird.cache.set(key, s);
  }
  return s;
}

// ---- その他のスプライト -------------------------------------------------
const PROPS = {};

// 人（横向き歩行）。frame 0..3
function renderPerson(style, frame, run) {
  const W = 16, H = 46;
  const cv = U.canvas(W, H);
  const g = cv.getContext('2d');
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const sw = [0, 2, 0, -2][frame] * (run ? 1.6 : 1);
  const bob = frame % 2 === 1 ? -1 : 0;
  const O = '#2a2430';
  // 脚
  const legY = 28 + bob;
  const drawLeg = (dx, c) => {
    g.fillStyle = c;
    const x0 = 7 + dx * 0.5;
    g.fillRect(Math.round(x0), legY, 3, 13 - Math.abs(dx) * 0.3);
    g.fillRect(Math.round(x0 + dx * 0.6), legY + 8, 3, 6);
    // 靴
    g.fillStyle = style.shoe;
    g.fillRect(Math.round(x0 + dx * 0.6), legY + 14 - (Math.abs(dx) > 1 ? 1 : 0), 5, 2);
  };
  drawLeg(-sw, U.css(U.shade(U.hex(style.pants), 0.8)));
  drawLeg(sw, style.pants);
  // 胴
  px(5, 14 + bob, 7, 15, style.top);
  px(5, 14 + bob, 1, 15, U.css(U.shade(U.hex(style.top), 0.8)));
  px(11, 15 + bob, 1, 13, U.css(U.shade(U.hex(style.top), 1.12)));
  // 腕
  g.fillStyle = U.css(U.shade(U.hex(style.top), 0.86));
  g.fillRect(Math.round(8 + sw * 0.5), 16 + bob, 3, 10);
  px(Math.round(8 + sw * 0.7), 26 + bob, 3, 2, style.skin);
  if (style.bag) px(Math.round(9 + sw * 0.7), 27 + bob, 5, 5, style.bag);
  // 頭
  px(5, 4 + bob, 7, 9, style.skin);
  px(5, 3 + bob, 7, 4, style.hair);
  px(4, 4 + bob, 2, 6, style.hair);
  px(10, 8 + bob, 1, 1, O);
  px(12, 9 + bob, 1, 1, style.skin);
  if (style.hat) { px(4, 2 + bob, 9, 3, style.hat); px(10, 4 + bob, 4, 1, style.hat); }
  // 縁取り（簡易）
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3]) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && d[(ny * W + nx) * 4 + 3];
      });
      if (n) { out[i] = 42; out[i + 1] = 36; out[i + 2] = 48; out[i + 3] = 220; }
    }
  g.putImageData(new ImageData(out, W, H), 0, 0);
  return cv;
}

function randomPersonStyle() {
  return {
    top: U.pick(['#3f5a7a', '#7a3b3b', '#d8d2c4', '#4a6b4a', '#2e2e36', '#b98a3e', '#6b4f7a', '#c76b4a']),
    pants: U.pick(['#2c3446', '#3a3a40', '#5b4a3a', '#26303a', '#7d7466']),
    shoe: U.pick(['#f0eee8', '#2a2a2e', '#7a4e33']),
    skin: U.pick(['#f1c9a5', '#e2b08a', '#c98f68', '#f5d6bb']),
    hair: U.pick(['#2a2220', '#3d2c22', '#6b5040', '#1e1c1e', '#9a948c']),
    hat: U.chance(0.2) ? U.pick(['#2c3446', '#c9b46a', '#7a3b3b']) : null,
    bag: U.chance(0.35) ? U.pick(['#d9cdb0', '#4a3a30', '#e8e2d4']) : null,
  };
}

// 猫（横向き）frame 0..3, crouch
function renderCat(coat, frame, crouch) {
  const W = 24, H = 16;
  const cv = U.canvas(W, H);
  const g = cv.getContext('2d');
  const base = U.hex(coat.base);
  const c0 = U.css(base), c1 = U.css(U.shade(base, 0.78)), c2 = U.css(U.shade(base, 1.12));
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const lo = crouch ? 2 : 0;
  // しっぽ
  px(1, 4 + lo, 2, 6, c1);
  px(2, 9 + lo, 3, 2, c1);
  // 胴
  px(4, 6 + lo, 13, 5, c0);
  px(4, 6 + lo, 13, 1, c2);
  if (coat.stripe) for (let x = 6; x < 16; x += 3) px(x, 6 + lo, 1, 4, coat.stripe);
  if (coat.belly) px(8, 10 + lo, 7, 1, coat.belly);
  // 脚
  const ph = [0, 1, 0, -1][frame];
  px(5 + ph, 11 + lo, 2, 4 - lo, c1);
  px(8 - ph, 11 + lo, 2, 4 - lo, c0);
  px(13 + ph, 11 + lo, 2, 4 - lo, c1);
  px(15 - ph, 11 + lo, 2, 4 - lo, c0);
  // 頭
  const hy = crouch ? 5 : 3;
  px(16, hy, 6, 5, c0);
  px(16, hy - 2, 2, 2, c0);
  px(20, hy - 2, 2, 2, c0);
  px(17, hy - 1, 1, 1, '#d99a9a');
  px(19, hy + 2, 1, 1, '#c6d84a');
  px(21, hy + 2, 1, 1, '#c6d84a');
  if (coat.face) px(18, hy + 3, 4, 2, coat.face);
  return cv;
}

// 車（横向き）
function renderCar(color) {
  const W = 52, H = 22;
  const cv = U.canvas(W, H);
  const g = cv.getContext('2d');
  const b = U.hex(color);
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  px(2, 9, 48, 8, U.css(b));
  px(2, 9, 48, 1, U.css(U.shade(b, 1.2)));
  px(2, 15, 48, 2, U.css(U.shade(b, 0.7)));
  px(10, 3, 28, 7, U.css(b));
  px(10, 3, 28, 1, U.css(U.shade(b, 1.15)));
  px(12, 4, 11, 5, '#9fb8c8');
  px(25, 4, 11, 5, '#9fb8c8');
  px(12, 4, 3, 5, '#c8dbe6');
  px(48, 11, 2, 2, '#f3e3a0');
  px(2, 11, 2, 2, '#c04030');
  for (const wx of [8, 38]) {
    px(wx, 15, 8, 6, '#1f1f22');
    px(wx + 2, 16, 4, 4, '#77787d');
    px(wx + 3, 17, 2, 2, '#4a4b50');
  }
  return cv;
}

// カルガモ
function renderDuck(frame) {
  const cv = U.canvas(16, 10);
  const g = cv.getContext('2d');
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  px(2, 4, 10, 4, '#6b5640');
  px(3, 4, 8, 1, '#8a7258');
  px(4, 5, 5, 1, '#4c3d2e');
  px(1, 3, 3, 2, '#5a4836');
  px(10, 1, 4, 4, '#7d6a52');
  px(10, 2, 4, 1, '#d8ccb4');
  px(14, 3, 2, 1, '#2b2a26');
  px(14, 3, 1, 1, '#d9b53a');
  px(12, 2, 1, 1, '#1e1a16');
  px(6, 6, 2, 1, '#3b6aa0');
  const ripple = frame % 2 ? '#a9cfdc' : '#8fbccc';
  px(0, 8, 15, 1, ripple);
  return cv;
}

// 自転車（横向き）frame 0..3
function pxLine(g, x0, y0, x1, y1, c) {
  g.fillStyle = c;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function renderBike(style, frame) {
  const W = 30, H = 40;
  const cv = U.canvas(W, H);
  const g = cv.getContext('2d');
  const wheel = (cx, cy) => {
    for (let a = 0; a < 32; a++) {
      const t = (a / 32) * Math.PI * 2;
      g.fillStyle = '#232227';
      g.fillRect(Math.round(cx + Math.cos(t) * 5), Math.round(cy + Math.sin(t) * 5), 1, 1);
    }
    const t0 = (frame / 4) * Math.PI;
    pxLine(g, cx - Math.cos(t0) * 4, cy - Math.sin(t0) * 4, cx + Math.cos(t0) * 4, cy + Math.sin(t0) * 4, '#9a9aa2');
  };
  wheel(6, 33); wheel(24, 33);
  const fc = '#b83a3a';
  pxLine(g, 6, 33, 14, 33, fc); pxLine(g, 14, 33, 11, 25, fc); pxLine(g, 11, 25, 21, 25, fc);
  pxLine(g, 21, 25, 24, 33, fc); pxLine(g, 14, 33, 21, 25, fc); pxLine(g, 21, 25, 21, 22, '#333');
  g.fillStyle = '#2a2a2e'; g.fillRect(9, 23, 4, 1);
  // ペダルと脚
  const pa = (frame / 4) * Math.PI * 2;
  const p1 = [14 + Math.cos(pa) * 3, 33 + Math.sin(pa) * 3], p2 = [14 - Math.cos(pa) * 3, 33 - Math.sin(pa) * 3];
  const hip = [12, 21];
  const legC = U.css(U.shade(U.hex(style.pants), 0.8));
  for (const [p, c] of [[p2, legC], [p1, style.pants]]) {
    const knee = [(hip[0] + p[0]) / 2 + 3, (hip[1] + p[1]) / 2 - 2];
    pxLine(g, hip[0], hip[1], knee[0], knee[1], c); pxLine(g, hip[0] + 1, hip[1], knee[0] + 1, knee[1], c);
    pxLine(g, knee[0], knee[1], p[0], p[1], c);
    g.fillStyle = style.shoe; g.fillRect(Math.round(p[0]), Math.round(p[1]), 2, 1);
  }
  // 胴と頭
  for (let i = 0; i < 4; i++) pxLine(g, 11 + i, 21, 14 + i, 11, style.top);
  pxLine(g, 16, 13, 21, 22, U.css(U.shade(U.hex(style.top), 0.85)));
  g.fillStyle = style.skin; g.fillRect(14, 4, 6, 7);
  g.fillStyle = style.hair; g.fillRect(14, 3, 6, 3); g.fillRect(13, 4, 2, 4);
  g.fillStyle = '#2a2430'; g.fillRect(18, 6, 1, 1);
  return cv;
}
