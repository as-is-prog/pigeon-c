'use strict';
// 本体: ループ、入力、湧き、イベント、音、図鑑。

// ---- 音（WebAudioで合成。最初はオフ） ----------------------------------
const SFX = {
  ctx: null, on: false, master: null, noiseBuf: null, lastFlap: 0, lastCoo: 0,
  enable() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    this.ctx.resume();
    this.on = true;
    return true;
  },
  disable() { this.on = false; },
  noise(dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.loopStart = Math.random() * 0.5;
    return s;
  },
  // バタバタ
  flap(n = 1, vol = 1) {
    if (!this.on) return;
    const c = this.ctx, now = c.currentTime;
    if (now - this.lastFlap < 0.09) return;
    this.lastFlap = now;
    const src = this.noise();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 500; bp.Q.value = 0.8;
    const gn = c.createGain();
    gn.gain.value = 0;
    const k = 4 + Math.min(6, n);
    const amp = Math.min(0.9, 0.22 + n * 0.09) * vol;
    for (let i = 0; i < k; i++) {
      const t = now + i * (0.062 + Math.random() * 0.02);
      const a = amp * (1 - i / (k + 1));
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(a, t + 0.012);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    }
    src.connect(bp); bp.connect(gn); gn.connect(this.master);
    src.start(now); src.stop(now + k * 0.085 + 0.1);
  },
  coo(kiji) {
    if (!this.on) return;
    const c = this.ctx, now = c.currentTime;
    if (now - this.lastCoo < 0.9) return;
    this.lastCoo = now;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = kiji ? 1100 : 800;
    lp.connect(this.master);
    const tone = (t0, dur, f0, f1, amp, trill) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.linearRampToValueAtTime(f1, t0 + dur);
      const o2 = c.createOscillator();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(f0 * 2, t0);
      o2.frequency.linearRampToValueAtTime(f1 * 2, t0 + dur);
      const g2 = c.createGain(); g2.gain.value = 0.18;
      const gn = c.createGain();
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.linearRampToValueAtTime(amp, t0 + 0.05);
      gn.gain.setValueAtTime(amp, t0 + dur - 0.08);
      gn.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      let out = gn;
      if (trill) {
        // 喉を鳴らす「るるる」
        const lfo = c.createOscillator(); lfo.frequency.value = 26;
        const lg = c.createGain(); lg.gain.value = amp * 0.8;
        const am = c.createGain(); am.gain.value = 0.2;
        lfo.connect(lg); lg.connect(am.gain);
        gn.connect(am); out = am;
        lfo.start(t0); lfo.stop(t0 + dur);
      }
      o.connect(gn); o2.connect(g2); g2.connect(gn);
      out.connect(lp);
      o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.02); o2.stop(t0 + dur + 0.02);
    };
    if (kiji) {
      // でーでー ぽっぽー
      tone(now, 0.32, 420, 400, 0.13);
      tone(now + 0.4, 0.32, 420, 400, 0.13);
      tone(now + 0.92, 0.16, 360, 350, 0.12);
      tone(now + 1.12, 0.42, 350, 320, 0.13);
    } else {
      // ぐるるっ ぽー
      tone(now, 0.34, 290, 310, 0.14, true);
      tone(now + 0.4, 0.55, 330, 255, 0.15);
    }
  },
  clap() {
    if (!this.on) return;
    const c = this.ctx, now = c.currentTime;
    const src = this.noise();
    const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1600; hp.Q.value = 0.6;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.9, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(hp); hp.connect(gn); gn.connect(this.master);
    src.start(now); src.stop(now + 0.15);
  },
  splash() {
    if (!this.on) return;
    const c = this.ctx, now = c.currentTime;
    const src = this.noise();
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.05, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(now); src.stop(now + 0.1);
  },
};

// ---- 図鑑の保存 ----
const STORE = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
};

// −／＋ で動く段階。大きいほど刻みが粗い。直接入力なら 1〜1000 の任意の数
const CAP_MIN = 1, CAP_MAX = 1000;
const CAP_STEPS = [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500, 700, 1000];

const GRAIN = ['#e3c35a', '#d8b46a', '#c99a4a', '#efe2b0', '#b5643a', '#e8d48a', '#9a7a4a'].map(U.hex);

const G = {
  t: 0, W: 320, H: 200, scale: 3,
  birds: [], foods: [], leaves: [], falling: [], actors: [], fx: [], flocks: [], pending: [],
  tool: 'seed', hover: null, selected: null,
  seen: STORE.get('hatodamari.seen', {}),
  sfx: SFX,
  nextEvent: 8, nextPanic: 45, nextSpawn: 1, nextLeaf: 1, flapCount: 0,
  userCap: (() => { const v = Math.round(Number(STORE.get('hatodamari.cap', 0))); return v >= CAP_MIN && v <= CAP_MAX ? v : 0; })(),
  seenDirty: false,

  init() {
    this.cv = document.getElementById('game');
    this.ctx = this.cv.getContext('2d');
    this.sceneId = STORE.get('hatodamari.scene', 'park');
    if (!SCENES[this.sceneId]) this.sceneId = 'park';
    this.resize(true);
    window.addEventListener('resize', () => {
      clearTimeout(this._rt);
      this._rt = setTimeout(() => this.resize(false), 150);
    });
    this.bindUI();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  },

  resize(first) {
    const wrap = this.cv.parentElement;
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    const s = Math.max(2, Math.round(Math.min(cw / 380, ch / 230)));
    this.scale = s;
    const W = Math.ceil(cw / s), H = Math.ceil(ch / s);
    if (!first && W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.cv.width = W; this.cv.height = H;
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    this.ctx.imageSmoothingEnabled = false;
    this.loadScene(this.sceneId, !first);
  },

  loadScene(id, keepBirds) {
    this.sceneId = id;
    STORE.set('hatodamari.scene', id);
    this.scene = SCENES[id](this.W, this.H);
    this.leaves = this.scene.leaves;
    this.foods = [];
    this.falling = [];
    this.actors = [];
    this.fx = [];
    this.flocks = [];
    this.pending = [];
    this.selected = null;
    if (keepBirds) {
      for (const b of this.birds) {
        b.fly = null; b.perch = null; b.z = 0; b.food = null;
        if (!this.scene.walkable(b.x, b.y)) { const s = this.randomGround(true); b.x = s.x; b.y = s.y; }
        b.set('idle', 1);
      }
    } else {
      this.birds = [];
      this.populate();
    }
    this.nextEvent = this.t + U.rand(6, 14);
    this.nextPanic = this.t + U.rand(40, 80);
    this.duck = null;
    document.querySelectorAll('[data-scene]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scene === id)));
  },

  // 画面の広さから決めるおすすめ上限（利用者が変えていなければこれを使う）
  get autoCap() {
    const want = U.clamp(Math.round((this.W * this.H) / 3500), 10, 30);
    // おすすめ値は段階の中から選ぶ
    return CAP_STEPS.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
  },
  get cap() {
    return this.userCap || this.autoCap;
  },
  // ふだん居つく数。エサをまいたときだけ上限まで集まる
  get targetPop() {
    return this.cap <= 3 ? this.cap : Math.round(this.cap * 0.7);
  },
  // 少ないときは勝手に帰らない（1羽を愛でる用）
  get mayLeave() {
    return this.cap > 5;
  },
  // 飛び去り中を除いた数
  get resident() {
    let n = 0;
    for (const b of this.birds) if (!(b.fly && b.fly.out)) n++;
    return n;
  },
  // 段階を一つ上げ下げ
  stepCap(dir) {
    const cur = this.cap;
    const next = dir > 0 ? CAP_STEPS.find((v) => v > cur) : [...CAP_STEPS].reverse().find((v) => v < cur);
    if (next !== undefined) this.setCapValue(next);
  },
  setCapValue(n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) { UI.updateCap(); return; }
    n = U.clamp(n, CAP_MIN, CAP_MAX);
    const up = n > this.cap;
    this.userCap = n;
    STORE.set('hatodamari.cap', n);
    if (up) this.nextSpawn = this.t + 0.3;
    UI.updateCap();
  },

  pickVariant() {
    const km = this.scene.kijiMul;
    return U.weighted(VARIANTS, (v) => v.weight * (v.species === 'kiji' ? km : 1));
  },

  populate() {
    const perchN = this.targetPop >= 8 && this.scene.perches.length ? 2 : 0;
    const n = Math.max(1, Math.round(this.targetPop * 0.85)) - perchN;
    for (let i = 0; i < n; i++) {
      const s = this.randomGround(true);
      const b = this.addBird(this.pickVariant(), s.x, s.y, 0, true);
      b.age = U.rand(0, 40);
      const r = Math.random();
      if (r < 0.3) { b.target = b.wanderTarget(30); b.set('forage', U.rand(1, 5)); }
      else if (r < 0.45) b.set('rest', U.rand(3, 12));
      else if (r < 0.6) b.set('preen', U.rand(1, 4));
      else b.set('idle', U.rand(0.2, 3));
    }
    // 止まり木にも何羽か
    for (let i = 0; i < perchN; i++) {
      const p = U.pick(this.scene.perches);
      const px = U.rand(p.x1, p.x2);
      const sy = p.syFn ? p.syFn(px) : p.sy;
      const b = this.addBird(this.pickVariant(), px, p.gy, p.gy - sy, true);
      b.perch = p;
      b.set('perch', U.rand(10, 40));
    }
  },

  addBird(v, x, y, z, silent) {
    const b = new Pigeon(this, v, x, y, z);
    this.birds.push(b);
    this.markSeen(v, silent);
    return b;
  },

  markSeen(v, silent) {
    const first = !this.seen[v.id];
    this.seen[v.id] = (this.seen[v.id] || 0) + 1;
    this.seenDirty = true; // 保存はまとめて（何百羽も湧くときに毎回書かない）
    if (first && !silent) UI.toast(`図鑑に「${v.name}」を記録しました`);
    UI.dirtyZukan = true;
  },

  // 外からやってくる
  spawnArrival(spot, toPerch) {
    if (this.resident >= this.cap) return null; // 上限
    const v = this.pickVariant();
    const W = this.W;
    const side = U.randi(0, 2);
    let sx, sy, sz;
    const tgt = spot || this.randomGround(true);
    if (side === 0) { sx = -20; sy = tgt.y + U.rand(-30, 30); sz = U.rand(40, 70); }
    else if (side === 1) { sx = W + 20; sy = tgt.y + U.rand(-30, 30); sz = U.rand(40, 70); }
    else { sx = U.rand(0, W); sy = tgt.y + U.rand(10, 40); sz = sy + U.rand(20, 40); }
    const b = this.addBird(v, sx, sy, sz);
    b.age = 0;
    if (toPerch && this.scene.perches.length) b.takeoff('perch');
    else b.takeoff('land', { x: tgt.x, y: tgt.y, alt: Math.min(sz, U.rand(25, 45)) });
    b.fly.t = 1;
    b.vx = (tgt.x - sx) > 0 ? 40 : -40;
    return b;
  },

  randomGround(pref) {
    const s = this.scene;
    for (let i = 0; i < 60; i++) {
      const x = U.rand(4, this.W - 4), y = U.rand(s.top + 4, this.H - 4);
      if (!s.walkable(x, y)) continue;
      if (pref && s.preferred && !s.preferred(x, y) && i < 40 && U.chance(0.65)) continue;
      return { x, y };
    }
    return { x: this.W / 2, y: (s.top + this.H) / 2 };
  },

  groundNear(x, y, r) {
    for (let i = 0; i < 30; i++) {
      const a = U.rand(0, Math.PI * 2), d = U.rand(0, r);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.7;
      if (this.scene.walkable(px, py)) return { x: px, y: py };
    }
    return this.randomGround(true);
  },

  nearestLeaf(x, y, r) {
    let best = null, bd = r;
    for (const l of this.leaves) {
      if (l.z > 0) continue;
      const d = U.dist(l.x, l.y, x, y);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  },

  // ---- 群れ ----
  getFlock(b) {
    for (const f of this.flocks) {
      if (this.t - f.born < 1.4 && U.dist(f.ox, f.oy, b.x, b.y) < 90) return f;
    }
    const rx = Math.min(U.rand(50, 90), this.W * 0.42);
    const ry = Math.min(U.rand(22, 40), (this.H - this.scene.top) * 0.4);
    const cx = U.clamp(b.x + U.rand(-30, 30), rx * 0.6, this.W - rx * 0.6);
    const cy = U.clamp(b.y + U.rand(-20, 10), this.scene.top + ry * 0.5, this.H - ry * 0.6);
    const f = {
      cx, cy, rx, ry, ox: b.x, oy: b.y,
      w: (U.chance(0.5) ? 1 : -1) * U.rand(0.9, 1.4),
      phase: 0, alt: U.rand(38, 62), born: this.t, until: this.t + U.rand(4, 9),
      landNear: U.chance(0.55) ? { x: b.x, y: b.y } : null,
    };
    this.flocks.push(f);
    return f;
  },

  contagion(src) {
    for (const b of this.birds) {
      if (b === src || b.fly || b.takeoffAt > 0) continue;
      const d = U.dist(b.x, b.y, src.x, src.y);
      if (d > (b.perch ? 22 : 40)) continue;
      const p = (b.kiji ? 0.4 : 0.68) * (1 - d / 50) + 0.15;
      if (U.chance(p)) b.takeoffAt = this.t + U.rand(0.05, 0.35);
    }
  },

  onTakeoff(b) {
    if (b.x < 0 || b.x > this.W) return;
    this.flapCount++;
  },

  scare(x, y, r, k) {
    for (const b of this.birds) {
      if (b.fly) continue;
      const d = U.dist(b.x, b.y - (b.perch ? b.z * 0.5 : 0), x, y);
      if (d > r) continue;
      b.startle(x, y, k * (1 - d / r) * (b.perch ? 0.6 : 1));
    }
  },

  // ---- 餌 ----
  scatter(x, y, type) {
    const n = type === 'bread' ? U.randi(5, 8) : U.randi(26, 36);
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2);
      const sp = type === 'bread' ? U.rand(8, 34) : U.rand(5, 42);
      this.foods.push({
        type, x, y, z: U.rand(10, 16),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: U.rand(8, 28),
        hp: type === 'bread' ? U.randi(3, 5) : 1, claim: 0, carrier: null,
        c: type === 'bread' ? null : U.pick(GRAIN), born: this.t,
      });
    }
    // 気づいた鳩から順に突進
    for (const b of this.birds) {
      if (b.fly && !b.perch) continue;
      const d = U.dist(b.x, b.y, x, y);
      const p = b.greed * (d < 120 ? 0.95 : 0.55) * (b.perch ? 0.7 : 1);
      if (!U.chance(p)) continue;
      const delay = U.rand(0.1, 0.5) + d / 300 + (b.kiji ? 1.2 : 0);
      this.pending.push({
        t: this.t + delay,
        fn: () => {
          if (b.left || b.fly || ['peckfood', 'carry', 'food', 'hop'].includes(b.state)) return;
          const f = b.findFood(b.perch ? 500 : 260);
          if (!f) return;
          if (b.perch) { b.food = f; f.claim++; b.takeoff('land', { x: f.x + U.rand(-12, 12), y: f.y + U.rand(-6, 6), alt: b.z + 4 }); }
          else b.goFood(f);
        },
      });
    }
    // どこからともなく増える
    const arrivals = U.randi(2, 5) + Math.floor(this.foods.length / 25);
    const queued = this.pending.filter((p) => p.arrival).length;
    for (let i = 0; i < arrivals; i++) {
      if (this.resident + queued + i >= this.cap) break;
      this.pending.push({ arrival: true, t: this.t + U.rand(1.5, 9), fn: () => {
        if (!this.foods.length) return;
        const f = U.pick(this.foods);
        const b = this.spawnArrival(this.groundNear(f.x, f.y, 14));
        if (!b) return;
        b.food = f; f.claim++;
      } });
    }
  },

  eat(f, b) {
    f.hp--;
    if (f.type === 'bread' && f.hp > 0 && U.chance(0.4)) {
      // かけらが飛び散る
      const a = U.rand(0, Math.PI * 2);
      this.foods.push({ type: 'seed', x: f.x, y: f.y, z: 2, vx: Math.cos(a) * 14, vy: Math.sin(a) * 8, vz: 12, hp: 1, claim: 0, carrier: null, c: [226, 196, 140], born: this.t });
    }
    if (f.hp <= 0) {
      const i = this.foods.indexOf(f);
      if (i >= 0) this.foods.splice(i, 1);
      for (const o of this.birds) if (o.food === f) o.food = null;
    }
  },

  dust(x, y) {
    for (let i = 0; i < 3; i++) this.fx.push({ k: 'dust', x, y, z: 1, vx: U.rand(-12, 12), vy: U.rand(-5, 5), vz: U.rand(5, 15), life: 0.4 });
  },

  // ---- イベント（通行人など） ----
  spawnEvent() {
    const s = this.scene;
    const kind = U.pick(s.events);
    const fromLeft = U.chance(0.5);
    const W = this.W;
    if (kind === 'car') {
      const r = s.road;
      const lane = U.chance(0.5) ? r.y0 + (r.y1 - r.y0) * 0.35 : r.y0 + (r.y1 - r.y0) * 0.85;
      const dir = lane < (r.y0 + r.y1) / 2 ? -1 : 1;
      this.actors.push({ k: 'car', img: renderCar(U.pick(['#d9d9d6', '#2f3a4a', '#a83a32', '#e6e2d8', '#3b5a3f'])), x: dir > 0 ? -60 : W + 60, y: lane, dir, sp: U.rand(80, 120) });
      return;
    }
    let y = this.randomGround(true).y;
    const pathOff = U.rand(-0.6, 0.6);
    if (s.pathY && kind !== 'cat') y = s.pathY(fromLeft ? 0 : W) + pathOff * s.pathHalf;
    const style = randomPersonStyle();
    if (kind === 'cat') {
      const coat = U.pick([{ base: '#e8e2d6', face: null }, { base: '#2a2a2e' }, { base: '#c88a4a', stripe: '#a0642e', belly: '#f0e6d6' }, { base: '#8a8478', stripe: '#5a564e' }, { base: '#f2efe8', stripe: '#d08840' }]);
      this.actors.push({ k: 'cat', coat, frames: [0, 1, 2, 3].map((f) => renderCat(coat, f, false)), crouchImg: renderCat(coat, 0, true), x: fromLeft ? -20 : W + 20, y, dir: fromLeft ? 1 : -1, sp: 9, mode: 'stalk', t: 0 });
      return;
    }
    const sp = kind === 'bike' ? U.rand(55, 70) : kind === 'jogger' ? U.rand(30, 38) : U.rand(15, 21);
    const frames = [0, 1, 2, 3].map((f) => (kind === 'bike' ? renderBike(style, f) : renderPerson(style, f, kind === 'jogger')));
    this.actors.push({ k: kind, frames, x: fromLeft ? -20 : W + 20, y, dir: fromLeft ? 1 : -1, sp, dist: 0, pathOff: s.pathY ? pathOff : null });
  },

  updateActors(dt) {
    for (const a of this.actors) {
      if (a.k === 'cat') {
        a.t += dt;
        if (a.mode === 'stalk') {
          // いちばん近い鳩にじりじり寄る
          let near = null, nd = 1e9;
          for (const b of this.birds) {
            if (b.fly || b.perch) continue;
            const d = U.dist(b.x, b.y, a.x, a.y);
            if (d < nd) { nd = d; near = b; }
          }
          if (near && nd < 120) {
            const dx = near.x - a.x, dy = near.y - a.y;
            a.dir = dx > 0 ? 1 : -1;
            a.x += (dx / nd) * a.sp * dt; a.y += (dy / nd) * a.sp * dt * 0.6;
            if (nd < 50 && U.chance(dt * 0.8)) this.scare(a.x, a.y, 40, 0.5);
            if (nd < 26) { a.mode = 'crouch'; a.t = 0; }
          } else a.x += a.dir * a.sp * dt;
          if (a.t > 25) { a.mode = 'leave'; }
        } else if (a.mode === 'crouch') {
          if (a.t > 1.1) {
            a.mode = 'dash'; a.t = 0;
            this.scare(a.x, a.y, 90, 1.6);
          }
        } else if (a.mode === 'dash') {
          a.x += a.dir * 70 * dt;
          if (a.t > 0.6) { a.mode = 'leave'; a.sp = 14; }
        } else {
          a.x += a.dir * a.sp * dt;
        }
        a.dist = (a.dist || 0) + a.sp * dt;
        if (a.x < -40 || a.x > this.W + 40) a.dead = a.t > 2 || a.mode === 'leave';
        continue;
      }
      a.x += a.dir * a.sp * dt;
      a.dist = (a.dist || 0) + a.sp * dt;
      if (a.pathOff !== null && a.pathOff !== undefined) a.y = this.scene.pathY(a.x) + a.pathOff * this.scene.pathHalf;
      if (a.k === 'car') {
        // 道路にいる鳩は大慌て
        for (const b of this.birds) {
          if (b.fly || b.perch) continue;
          if (b.y < this.scene.road.y0 - 3) continue;
          const ahead = (b.x - a.x) * a.dir;
          if (ahead > -10 && ahead < 55 && Math.abs(b.y - a.y) < 16) {
            if (ahead < 30) {
              if (b.takeoffAt < 0) {
                b.dropFood();
                const s = this.groundNear(b.x + U.rand(-20, 20), this.scene.road.y0 - 14, 12);
                b.takeoff('land', { x: s.x, y: s.y, alt: U.rand(10, 18), quick: true });
              }
            } else b.startle(a.x, a.y, 0.6);
          }
        }
      } else {
        const r = a.k === 'bike' ? 30 : a.k === 'jogger' ? 24 : 16;
        const k = a.k === 'bike' ? 1.5 : a.k === 'jogger' ? 1.15 : 0.75;
        for (const b of this.birds) {
          if (b.fly) continue;
          const ahead = (b.x - a.x) * a.dir;
          if (ahead < -4 || ahead > r) continue;
          const dy = Math.abs(b.y - a.y);
          if (dy > r * 0.5) continue;
          if (b.calm > 0) continue;
          b.startle(a.x, a.y, k * (1 - dy / (r * 0.5)) * (1 - Math.max(0, ahead) / r * 0.5));
        }
      }
      if ((a.dir > 0 && a.x > this.W + 70) || (a.dir < 0 && a.x < -70)) a.dead = true;
    }
    this.actors = this.actors.filter((a) => !a.dead);
  },

  // ---- 1フレーム ----
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!document.hidden) {
      this.update(dt);
      this.draw();
    }
    requestAnimationFrame((t) => this.frame(t));
  },

  update(dt) {
    this.t += dt;
    const t = this.t;
    // 予約処理
    if (this.pending.length) {
      const due = this.pending.filter((p) => p.t <= t);
      this.pending = this.pending.filter((p) => p.t > t);
      for (const p of due) p.fn();
    }
    for (const b of this.birds) b.update(dt);
    // 地上の鳩どうしは重ならない
    const ground = this.birds.filter((b) => !b.fly && !b.perch && b.state !== 'hop');
    const CELL = 8, grid = new Map();
    for (const b of ground) {
      const k = Math.floor(b.x / CELL) * 4096 + Math.floor(b.y / CELL);
      let c = grid.get(k);
      if (!c) grid.set(k, (c = []));
      c.push(b);
    }
    const min = 6.5, k12 = Math.min(1, dt * 12);
    for (const a of ground) {
      const cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++)
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const c = grid.get(gx * 4096 + gy);
          if (!c) continue;
          for (const b of c) {
            if (b.id <= a.id) continue; // 各ペア1回
            const dx = b.x - a.x, dy = (b.y - a.y) * 1.6;
            const d = Math.hypot(dx, dy);
            if (d < min && d > 0.001) {
              const push = (min - d) * 0.5 * k12;
              const nx = (dx / d) * push, ny = (dy / d) * push / 1.6;
              if (this.scene.walkable(a.x - nx, a.y - ny)) { a.x -= nx; a.y -= ny; }
              if (this.scene.walkable(b.x + nx, b.y + ny)) { b.x += nx; b.y += ny; }
            }
          }
        }
    }
    // 飛び去った鳩
    const before = this.birds.length;
    this.birds = this.birds.filter((b) => !b.left);
    if (this.birds.length !== before) {
      if (this.selected && this.selected.left) this.selected = null;
    }
    this.flocks = this.flocks.filter((f) => t < f.until + 2);
    // 羽音
    if (this.flapCount) { this.sfx.flap(this.flapCount); this.flapCount = 0; }
    // 湧き
    const resident = this.resident;
    if (t > this.nextSpawn) {
      // 少ないときほど早く来る
      const lack = this.targetPop - resident;
      const short = resident < this.targetPop * 0.6;
      this.nextSpawn = t + (short ? U.rand(0.5, 1.4) : U.rand(2, 6));
      // 大幅に足りないときは何羽かまとめて来る
      const n = lack > 0 ? Math.max(1, Math.ceil(lack / 12)) : 0;
      for (let i = 0; i < n; i++) this.spawnArrival(null, U.chance(0.15));
    }
    // 上限を超えていたら、少しずつ飛び去る
    if (resident > this.cap && t > (this.nextLeave || 0)) {
      const excess = resident - this.cap;
      this.nextLeave = t + (excess > 8 ? 0.15 : 0.35);
      const cands = this.birds.filter((b) => !(b.fly && b.fly.out) && b.state !== 'carry');
      // 大勢を減らすときは、まとまって飛び去る
      const n = Math.min(cands.length, Math.max(1, Math.ceil(excess / 15)));
      for (let i = 0; i < n; i++) {
        const j = U.randi(i, cands.length - 1);
        [cands[i], cands[j]] = [cands[j], cands[i]];
        cands[i].takeoff('leave');
      }
    }
    // 理由なき一斉飛翔
    if (t > this.nextPanic) {
      this.nextPanic = t + U.rand(45, 100);
      const cands = this.birds.filter((b) => !b.fly && !b.perch && !b.kiji);
      if (cands.length > 4) {
        const b = U.pick(cands);
        b.startle(b.x, b.y, 5);
      }
    }
    // 通行人
    if (t > this.nextEvent) {
      this.nextEvent = t + U.rand(14, 32);
      this.spawnEvent();
    }
    this.updateActors(dt);
    // カルガモ
    if (this.scene.water) {
      if (!this.duck && U.chance(dt * 0.03)) {
        const dir = U.chance(0.5) ? 1 : -1;
        this.duck = { x: dir > 0 ? -16 : this.W + 16, y: U.rand(this.scene.water.y0 + 4, this.scene.water.y1), dir, f: [renderDuck(0), renderDuck(1)] };
      }
      if (this.duck) {
        this.duck.x += this.duck.dir * 5 * dt;
        if (this.duck.x < -30 || this.duck.x > this.W + 30) this.duck = null;
      }
    }
    // 餌の物理
    for (const f of this.foods) {
      if (f.carrier) continue;
      if (f.z > 0 || f.vz) {
        f.vz -= 150 * dt;
        f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        if (f.z <= 0) {
          f.z = 0;
          if (f.vz < -18) { f.vz = -f.vz * 0.28; f.vx *= 0.45; f.vy *= 0.45; }
          else { f.vz = 0; f.vx = f.vy = 0; this.settleFood(f); }
        }
      }
    }
    this.foods = this.foods.filter((f) => !f.gone);
    // 落ち葉
    for (const l of this.leaves) {
      if (l.z > 0 || l.vz) {
        l.vz -= 90 * dt;
        l.x += l.vx * dt; l.y += l.vy * dt * 0.6; l.z += l.vz * dt;
        if (l.z <= 0) { l.z = 0; l.vz = 0; l.vx = l.vy = 0; }
      }
    }
    if (t > this.nextLeaf && this.scene.fallingLeaves) {
      this.nextLeaf = t + U.rand(0.8, 3);
      const src = U.pick(this.scene.fallingLeaves);
      const gy = this.randomGround(false).y;
      const kind = src.kind === 'ginkgo' ? 'ginkgo' : 'leaf';
      const pal = PAL.leafColors[src.kind] || PAL.leafColors.zelkova;
      const x = src.wind ? -4 : src.x + U.rand(-26, 26);
      const sy = src.wind ? U.rand(0, gy) : src.y + U.rand(-10, 10);
      this.falling.push({ ...makeLeaf(x, gy, pal, kind), z: gy - sy, ph: U.rand(0, 6), wind: src.wind ? U.rand(10, 22) : U.rand(-3, 3) });
    }
    for (const l of this.falling) {
      l.z -= 11 * dt;
      l.x += (Math.sin(t * 2.4 + l.ph) * 9 + l.wind) * dt;
      if (Math.floor(t * 5 + l.ph) % 3 === 0) l.rot = Math.floor(t * 4 + l.ph) % 4;
      if (l.z <= 0) {
        l.z = 0; l.done = true;
        if (this.scene.walkable(l.x, l.y)) this.leaves.push(l);
      }
      if (l.x > this.W + 10) l.done = true;
    }
    this.falling = this.falling.filter((l) => !l.done);
    if (this.leaves.length > 170) this.leaves.splice(0, this.leaves.length - 170);
    // エフェクト
    for (const e of this.fx) {
      e.life -= dt;
      if (e.k === 'dust') { e.vz -= 60 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z = Math.max(0, e.z + e.vz * dt); }
    }
    this.fx = this.fx.filter((e) => e.life > 0);
    UI.tick(dt);
  },

  settleFood(f) {
    const s = this.scene;
    if (s.walkable(f.x, f.y)) return;
    if (s.water && f.y > s.water.y0 - 2 && f.y < s.water.y1 + 6) {
      f.gone = true;
      this.fx.push({ k: 'ripple', x: f.x, y: f.y, life: 0.8 });
      this.sfx.splash();
      return;
    }
    const g = this.groundNear(f.x, Math.max(f.y, s.top + 4), 10);
    f.x = g.x; f.y = g.y;
  },

  // ---- 描画 ----
  draw() {
    const c = this.ctx, s = this.scene, t = this.t;
    c.drawImage(s.bg, 0, 0);
    if (s.drawAnim) s.drawAnim(c, t);
    if (this.duck) {
      const d = this.duck;
      const img = d.f[Math.floor(t * 2) % 2];
      this.drawFlip(img, d.x, d.y, 8, 9, d.dir);
    }
    if (s.overlay) c.drawImage(s.overlay, 0, 0);
    // 地面のもの
    for (const l of this.leaves) c.drawImage(leafSprite(l.color, l.rot, l.kind), Math.round(l.x) - 2, Math.round(l.y - l.z) - 2);
    for (const e of this.fx) {
      if (e.k === 'ripple') {
        const r = Math.round((0.8 - e.life) * 8) + 1;
        c.fillStyle = 'rgba(220,240,244,' + (e.life / 0.8).toFixed(2) + ')';
        c.fillRect(Math.round(e.x - r), Math.round(e.y), r * 2, 1);
        c.fillRect(Math.round(e.x - r + 1), Math.round(e.y) - 1, 1, 1);
        c.fillRect(Math.round(e.x + r - 2), Math.round(e.y) - 1, 1, 1);
      }
    }
    for (const f of this.foods) {
      if (f.z > 0 || f.carrier) continue;
      this.drawFood(f, f.x, f.y);
    }
    // 影
    c.fillStyle = 'rgba(24,30,28,0.22)';
    for (const b of this.birds) {
      if (b.perch) continue;
      if (b.y - b.z > this.H + 20) continue;
      const k = Math.max(0, 1 - b.z / 70);
      if (k <= 0.05) continue;
      const w = Math.round(9 * (0.5 + 0.5 * k));
      c.globalAlpha = 0.4 + 0.6 * k;
      c.fillRect(Math.round(b.x - w / 2), Math.round(b.y), w, 2);
      c.fillRect(Math.round(b.x - w / 2 + 1), Math.round(b.y) - 1, w - 2, 1);
      c.fillRect(Math.round(b.x - w / 2 + 1), Math.round(b.y) + 2, w - 2, 1);
    }
    c.globalAlpha = 1;
    for (const a of this.actors) {
      if (a.k === 'car') continue;
      c.fillRect(Math.round(a.x - 6), Math.round(a.y), 12, 2);
    }
    // 奥から順に
    const list = [];
    for (const b of this.birds) list.push({ d: b.depth, b });
    for (const p of s.props) list.push({ d: p.base, p });
    for (const a of this.actors) list.push({ d: a.y, a });
    list.sort((p, q) => p.d - q.d);
    for (const it of list) {
      if (it.b) this.drawBird(it.b);
      else if (it.p) c.drawImage(it.p.img, it.p.x, it.p.y);
      else this.drawActor(it.a);
    }
    // 空中のもの
    for (const f of this.foods) if (f.z > 0 && !f.carrier) this.drawFood(f, f.x, f.y - f.z);
    for (const l of this.falling) c.drawImage(leafSprite(l.color, l.rot, l.kind), Math.round(l.x) - 2, Math.round(l.y - l.z) - 2);
    for (const e of this.fx) {
      if (e.k === 'dust') { c.fillStyle = 'rgba(150,130,100,0.8)'; c.fillRect(Math.round(e.x), Math.round(e.y - e.z), 1, 1); }
      if (e.k === 'clap') {
        const r = (0.6 - e.life) * 110;
        c.strokeStyle = 'rgba(255,250,235,' + (e.life / 0.6).toFixed(2) + ')';
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(Math.round(e.x) + 0.5, Math.round(e.y) + 0.5, r, r * 0.6, 0, 0, Math.PI * 2);
        c.stroke();
      }
      if (e.k === 'ping') {
        const r = (0.5 - e.life) * 30 + 2;
        c.strokeStyle = 'rgba(255,248,220,' + (e.life / 0.5).toFixed(2) + ')';
        c.beginPath();
        c.ellipse(Math.round(e.x) + 0.5, Math.round(e.y) + 0.5, r, r * 0.55, 0, 0, Math.PI * 2);
        c.stroke();
      }
    }
    // 選択中の鳩に印
    const sel = this.selected || this.hover;
    if (sel && !sel.left) {
      const sx = Math.round(sel.x), sy = Math.round(sel.y - sel.z) - 22 + (Math.floor(t * 3) % 2);
      c.fillStyle = '#fff6d8';
      c.fillRect(sx - 1, sy, 3, 1);
      c.fillRect(sx, sy + 1, 1, 1);
    }
    UI.placeLabel(sel);
  },

  drawFood(f, x, y) {
    const c = this.ctx;
    x = Math.round(x); y = Math.round(y);
    if (f.type === 'bread') {
      c.fillStyle = '#b8864a';
      c.fillRect(x - 1, y - 1, 3, 2);
      c.fillStyle = '#ecd6a4';
      c.fillRect(x - 1, y - 2, 2, 2);
      if (f.hp > 3) { c.fillStyle = '#e2c890'; c.fillRect(x + 1, y - 2, 1, 1); }
    } else {
      c.fillStyle = U.css(f.c);
      c.fillRect(x, y - 1, 1, 1);
    }
  },

  drawFlip(img, x, y, ax, ay, dir) {
    const c = this.ctx;
    const sx = Math.round(x), sy = Math.round(y);
    if (dir > 0) c.drawImage(img, sx - ax, sy - ay);
    else {
      c.save();
      c.translate(sx, 0);
      c.scale(-1, 1);
      c.drawImage(img, -ax - 1 + (img.width - 2 * ax - 1) * 0, sy - ay);
      c.restore();
    }
  },

  drawBird(b) {
    if (b.y - b.z > this.H + 30 || b.x < -40 || b.x > this.W + 40) return;
    const spr = getPigeonSprite(b, b.pose);
    this.drawFlip(spr, b.x, b.y - b.z, SPR.AX, SPR.AY, b.dir);
    if (b.state === 'carry' && b.food) {
      this.drawFood(b.food, b.x + b.dir * 8, b.y - b.z - 13);
    }
  },

  drawActor(a) {
    const t = this.t;
    if (a.k === 'car') {
      this.drawFlip(a.img, a.x, a.y, 26, 20, a.dir);
      return;
    }
    if (a.k === 'cat') {
      const img = a.mode === 'crouch' ? a.crouchImg : a.frames[Math.floor((a.dist || 0) / 3) % 4];
      this.drawFlip(img, a.x, a.y, 12, 15, a.dir);
      return;
    }
    const fr = a.frames[Math.floor(a.dist / (a.k === 'bike' ? 5 : 4)) % 4];
    if (a.k === 'bike') this.drawFlip(fr, a.x, a.y, 15, 38, a.dir);
    else this.drawFlip(fr, a.x, a.y, 8, 45, a.dir);
    void t;
  },

  // ---- 入力 ----
  toWorld(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.W, y: ((e.clientY - r.top) / r.height) * this.H };
  },

  birdAt(x, y) {
    let best = null, bd = 9;
    for (const b of this.birds) {
      const cx = b.x, cy = b.y - b.z - 8;
      const d = Math.hypot((x - cx) * 0.9, y - cy);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  },

  bindUI() {
    const cv = this.cv;
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const p = this.toWorld(e);
      this.hover = this.birdAt(p.x, p.y);
    });
    cv.addEventListener('pointerleave', () => { this.hover = null; });
    cv.addEventListener('pointerdown', (e) => {
      const p = this.toWorld(e);
      UI.hideHint();
      if (this.tool === 'look') {
        this.selected = this.birdAt(p.x, p.y);
        return;
      }
      if (this.tool === 'clap') {
        this.scare(p.x, p.y, 120, 1.7);
        this.fx.push({ k: 'clap', x: p.x, y: p.y, life: 0.6 });
        this.sfx.clap();
        return;
      }
      this.fx.push({ k: 'ping', x: p.x, y: p.y, life: 0.5 });
      this.scatter(p.x, p.y, this.tool === 'bread' ? 'bread' : 'seed');
    });
    UI.bind(this);
  },
};

// ---- UI（HTML側） ---------------------------------------------------------
const UI = {
  dirtyZukan: true,
  hud: 0,
  bind(g) {
    this.g = g;
    this.countEl = document.getElementById('count');
    this.zkEl = document.getElementById('zk-count');
    this.label = document.getElementById('label');
    this.toastEl = document.getElementById('toast');
    this.hint = document.getElementById('hint');
    this.capEl = document.getElementById('cap');
    this.decEl = document.getElementById('pop-dec');
    this.incEl = document.getElementById('pop-inc');
    // −／＋: 押しっぱなしで連続
    const hold = (el, dir) => {
      let timer = null, delay = 0;
      const stop = () => { clearTimeout(timer); timer = null; };
      const tick = () => { g.stepCap(dir); delay = Math.max(70, delay * 0.8); timer = setTimeout(tick, delay); };
      el.addEventListener('pointerdown', (e) => {
        if (el.disabled) return;
        e.preventDefault();
        g.stepCap(dir);
        delay = 260;
        timer = setTimeout(tick, 420);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, stop));
      // キーボード操作
      el.addEventListener('click', (e) => { if (e.detail === 0) g.stepCap(dir); });
    };
    hold(this.decEl, -1);
    hold(this.incEl, 1);
    // 数字は直接入力できる
    this.capEl.addEventListener('change', () => g.setCapValue(this.capEl.value));
    this.capEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.capEl.blur();
      if (e.key === 'Escape') { this.updateCap(true); this.capEl.blur(); }
    });
    this.capEl.addEventListener('focus', () => this.capEl.select());
    this.capEl.addEventListener('blur', () => this.updateCap(true));
    this.updateCap();
    document.querySelectorAll('[data-tool]').forEach((b) => {
      b.addEventListener('click', () => {
        g.tool = b.dataset.tool;
        g.selected = null;
        document.querySelectorAll('[data-tool]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.tool === g.tool)));
      });
    });
    document.querySelectorAll('[data-scene]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.scene === g.sceneId) return;
        const cv = g.cv;
        cv.classList.add('fade');
        setTimeout(() => { g.loadScene(b.dataset.scene, false); cv.classList.remove('fade'); }, 220);
      });
    });
    const snd = document.getElementById('sound');
    snd.addEventListener('click', () => {
      if (SFX.on) SFX.disable();
      else if (!SFX.enable()) { this.toast('このブラウザでは音が出せません'); return; }
      snd.setAttribute('aria-pressed', String(SFX.on));
      snd.querySelector('span').textContent = SFX.on ? '音あり' : '音なし';
    });
    const panel = document.getElementById('zukan');
    document.getElementById('zk-open').addEventListener('click', () => { this.renderZukan(); panel.hidden = false; });
    document.getElementById('zk-close').addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.hidden = true; });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.hidden = true; });
    this.bindUiOff();
  },
  // UIオフ: 札や道具箱を隠して箱庭だけにする。ブラウザで開いているときは全画面も頼む
  bindUiOff() {
    const offBtn = document.getElementById('ui-off');
    const onBtn = document.getElementById('ui-on');
    const mini = document.getElementById('mini'); // UIオフ中の小さな道具箱＋戻すボタン
    const de = document.documentElement;
    const standalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
    let wentFull = false, sleepT = null;
    const wake = () => {
      if (mini.hidden) return;
      mini.classList.remove('sleep');
      clearTimeout(sleepT);
      sleepT = setTimeout(() => mini.classList.add('sleep'), 3000);
    };
    const set = (off) => {
      document.body.classList.toggle('ui-off', off);
      mini.hidden = !off;
      this.label.hidden = true;
      if (off) {
        this.hideHint();
        wake();
        const req = de.requestFullscreen || de.webkitRequestFullscreen;
        if (req && !standalone() && !(document.fullscreenElement || document.webkitFullscreenElement)) {
          try {
            const r = req.call(de, { navigationUI: 'hide' });
            wentFull = true;
            if (r && r.catch) r.catch(() => { wentFull = false; });
          } catch (e) { wentFull = false; }
        }
      } else {
        clearTimeout(sleepT);
        mini.classList.remove('sleep');
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (wentFull && exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
          try { const r = exit.call(document); if (r && r.catch) r.catch(() => {}); } catch (e) { /* noop */ }
        }
        wentFull = false;
        offBtn.focus({ preventScroll: true });
      }
    };
    offBtn.addEventListener('click', () => set(true));
    onBtn.addEventListener('click', () => set(false));
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') wake(); }, true);
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'h' && e.key !== 'H') return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      set(!document.body.classList.contains('ui-off'));
    });
  },
  updateCap(force) {
    const g = this.g;
    const c = g.cap;
    // 入力中は書き換えない
    if (force || document.activeElement !== this.capEl) this.capEl.value = c;
    this.capEl.style.width = String(c).length + 1 + 'ch';
    this.decEl.disabled = c <= CAP_MIN;
    this.incEl.disabled = c >= CAP_MAX;
  },
  hideHint() {
    if (this.hint && !this.hint.hidden) this.hint.hidden = true;
  },
  tick(dt) {
    this.hud -= dt;
    if (this.hud > 0) return;
    this.hud = 0.4;
    const g = this.g;
    if (g.seenDirty) { g.seenDirty = false; STORE.set('hatodamari.seen', g.seen); }
    const n = g.birds.filter((b) => b.x > -5 && b.x < g.W + 5 && b.y - b.z > -5).length;
    this.countEl.textContent = n;
    const seen = VARIANTS.filter((v) => g.seen[v.id]).length;
    this.zkEl.textContent = `${seen}/${VARIANTS.length}`;
  },
  placeLabel(b) {
    if (!b || b.left) { this.label.hidden = true; return; }
    const g = this.g;
    const r = g.cv.getBoundingClientRect();
    const wr = g.cv.parentElement.getBoundingClientRect();
    const x = (b.x / g.W) * r.width + (r.left - wr.left);
    const y = ((b.y - b.z - 24) / g.H) * r.height + (r.top - wr.top);
    const text = `${b.v.name} ${b.male ? '♂' : '♀'}｜${b.label}`;
    if (this.label.textContent !== text) this.label.textContent = text;
    this.label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    this.label.hidden = false;
  },
  toast(msg) {
    const el = this.toastEl;
    el.textContent = msg;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => { el.hidden = true; }, 3200);
  },
  renderZukan() {
    const grid = document.getElementById('zk-grid');
    const g = this.g;
    grid.textContent = '';
    VARIANTS.forEach((v, i) => {
      const seen = g.seen[v.id] || 0;
      const card = document.createElement('div');
      card.className = 'card' + (seen ? '' : ' unseen');
      const cv = document.createElement('canvas');
      cv.width = SPR.W; cv.height = SPR.H;
      const cx = cv.getContext('2d');
      const spr = renderPigeon(v, makeMarkings(v, 777 + i * 13), 'stand:0:0');
      cx.drawImage(spr, 0, 0);
      if (!seen) {
        cx.globalCompositeOperation = 'source-in';
        cx.fillStyle = '#5a5162';
        cx.fillRect(0, 0, cv.width, cv.height);
      }
      const no = document.createElement('div');
      no.className = 'no';
      no.textContent = 'No.' + String(i + 1).padStart(2, '0');
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = seen ? v.name : '？？？';
      const ds = document.createElement('p');
      ds.className = 'ds';
      ds.textContent = seen ? v.desc : (v.species === 'kiji' ? 'まだ見ていない。群れから少し離れたところを探すといいかも。' : 'まだ見ていない。');
      const ct = document.createElement('div');
      ct.className = 'ct';
      ct.textContent = seen ? `観察 ${seen}羽` : '';
      card.append(no, cv, nm, ds, ct);
      grid.append(card);
    });
  },
};

window.addEventListener('DOMContentLoaded', () => G.init());
