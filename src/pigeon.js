'use strict';
// 鳩の行動。状態機械 + ちょっとした群れの伝染。

let BIRD_SEQ = 0;

const STATE_LABEL = {
  idle: 'ぼんやり', walk: 'うろうろ', forage: 'さがしもの', peck: 'つついている', leaf: '落ち葉をめくっている',
  preen: '羽づくろい', rest: 'ひなたぼっこ', coo: '求愛中（ぐるっぽー）', fly: '飛んでいる', perch: 'ひと休み',
  alert: '警戒', evade: 'よけている', food: '餌に突進', peckfood: '食べている', carry: 'パンを持ち逃げ', hop: 'ばたばた',
  look: 'きょろきょろ',
};

class Pigeon {
  constructor(game, variant, x, y, z = 0) {
    this.g = game;
    this.v = variant;
    this.kiji = variant.species === 'kiji';
    this.id = ++BIRD_SEQ;
    // 見た目は羽色ごとに12通りの個体差から選ぶ（何百羽いてもスプライトを共有できるように）
    const look = getLook(variant, U.randi(0, LOOKS_PER_VARIANT - 1));
    this.seed = look.seed;
    this.marks = look.marks;
    this.cache = look.cache;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0;
    this.dir = U.chance(0.5) ? 1 : -1;
    this.dirAt = 0;
    this.male = U.chance(0.5);
    this.bold = this.kiji ? U.rand(0.15, 0.45) : U.rand(0.45, 1);
    this.greed = this.kiji ? U.rand(0.25, 0.55) : U.rand(0.6, 1);
    this.walkSpeed = U.rand(10, 14) * (this.kiji ? 0.85 : 1);
    this.flySpeed = U.rand(70, 95);
    this.state = 'idle';
    this.st = 0;
    this.dur = U.rand(0.5, 2);
    this.pose = 'stand:0:0';
    this.stepPh = U.rand(0, 1);
    this.steps = 0;
    this.fly = null;
    this.perch = null;
    this.food = null;
    this.target = null;
    this.calm = 0; // 驚いた直後の無反応時間
    this.takeoffAt = -1;
    this.left = false;
    this.life = U.rand(70, 200); // そのうち飛び去る
    this.age = 0;
    this.sub = 0;
    this.n = 0;
  }

  get label() {
    return STATE_LABEL[this.state] || '';
  }

  set(state, dur) {
    this.state = state;
    this.st = 0;
    this.dur = dur === undefined ? 1 : dur;
    this.sub = 0;
    this.n = 0;
  }

  // ---- 歩行 ----
  stepToward(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.8) return true;
    const s = Math.min(d, speed * dt);
    const nx = this.x + (dx / d) * s, ny = this.y + (dy / d) * s;
    if (!this.g.scene.walkable(nx, ny)) return true; // 行き止まり: 到着扱い
    this.x = nx; this.y = ny;
    const nd = dx > 0 ? 1 : -1;
    if (nd !== this.dir && d > 8 && Math.abs(dx) > 1.5 && Math.abs(dx) > d * 0.25 && this.age - this.dirAt > 0.3) {
      this.dir = nd;
      this.dirAt = this.age;
    }
    // 数px の位置合わせは振り向かずに足踏み・後ずさりで済ませる（上の d > 8）
    // 首振り: 頭を空間に固定 → 一気に前へ
    const stride = this.kiji ? 2.6 : 2.3;
    this.stepPh += s / stride;
    if (this.stepPh >= 1) { this.stepPh -= 1; this.steps++; }
    const p = this.stepPh;
    const head = p < 0.62 ? Math.round(2 - (3 * p) / 0.62) : Math.round(U.lerp(-1, 2, (p - 0.62) / 0.38));
    const legs = p < 0.55 ? (this.steps % 2 ? 1 : 2) : 0;
    this.pose = `stand:${U.clamp(head, -1, 2)}:${legs}`;
    return false;
  }

  // ---- 行動の選択 ----
  think() {
    const g = this.g;
    if (this.age > this.life && g.mayLeave && U.chance(0.5)) return this.takeoff('leave');
    // 餌
    if (g.foods.length && U.chance(0.4 + this.greed * 0.6)) {
      const f = this.findFood(150 + this.greed * 80);
      if (f) return this.goFood(f);
    }
    const r = Math.random();
    const leaf = g.nearestLeaf(this.x, this.y, 40);
    if (leaf && r < 0.14) {
      this.target = leaf;
      this.leafSide = this.x < leaf.x ? -1 : 1; // 鳩がいる側から近づく（途中で変えない）
      return this.set('leaf', 6);
    }
    if (r < 0.48) {
      // 歩きながら探す
      const tgt = this.wanderTarget(this.kiji ? 30 : 40);
      this.target = tgt;
      return this.set('forage', U.rand(2, 6));
    }
    if (r < 0.6) {
      this.n = U.randi(1, 4);
      return this.set('peck', 0);
    }
    if (r < 0.7) return this.set('idle', U.rand(1, 3.5));
    if (r < 0.75) return this.set('look', U.rand(0.8, 2));
    if (r < 0.81) return this.set('preen', U.rand(2, 5));
    if (r < 0.85) return this.set('rest', U.rand(5, 14));
    if (r < 0.9 && this.male) {
      const mate = g.birds.find((b) => b !== this && b.kiji === this.kiji && !b.fly && !b.perch && U.dist(b.x, b.y, this.x, this.y) < 45);
      if (mate) {
        this.target = mate;
        return this.set('coo', U.rand(4, 8));
      }
    }
    if (r < 0.93 && g.scene.perches.length) return this.takeoff('perch');
    if (r < 0.95) return this.takeoff('hopto');
    return this.set('idle', U.rand(1, 3));
  }

  wanderTarget(rad) {
    const s = this.g.scene;
    for (let i = 0; i < 12; i++) {
      const a = U.rand(0, Math.PI * 2);
      const d = U.rand(rad * 0.3, rad);
      const x = this.x + Math.cos(a) * d, y = this.y + Math.sin(a) * d * 0.7;
      if (!s.walkable(x, y)) continue;
      if (s.preferred && !s.preferred(x, y) && U.chance(0.6)) continue;
      return { x, y };
    }
    return this.g.randomGround(true);
  }

  findFood(range) {
    let best = null, bs = 1e9;
    for (const f of this.g.foods) {
      if (f.z > 1) continue;
      const d = U.dist(f.x, f.y, this.x, this.y);
      if (d > range) continue;
      const crowd = f.carrier ? 0 : f.claim * 6;
      const sc = d + crowd + Math.random() * 14;
      if (sc < bs) { bs = sc; best = f; }
    }
    // 近くの仲間が食べていれば寄っていく（社会的促進）
    if (!best) {
      const eater = this.g.birds.find((b) => b !== this && (b.state === 'peckfood' || b.state === 'food') && U.dist(b.x, b.y, this.x, this.y) < 70);
      if (eater && eater.food && this.g.foods.includes(eater.food)) best = eater.food;
    }
    return best;
  }

  goFood(f) {
    this.food = f;
    f.claim++;
    const d = U.dist(f.x, f.y, this.x, this.y);
    if (d > 85 && !this.kiji) {
      const a = Math.atan2(this.y - f.y, this.x - f.x) + U.rand(-0.8, 0.8);
      const r = U.rand(5, 14);
      return this.takeoff('land', { x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * 0.6, alt: U.rand(12, 22), quick: true });
    }
    this.set('food', 0);
  }

  dropFood() {
    if (this.food) {
      this.food.claim = Math.max(0, this.food.claim - 1);
      if (this.food.carrier === this) this.food.carrier = null;
    }
    this.food = null;
  }

  // ---- 飛ぶ ----
  takeoff(mode, opt = {}) {
    const g = this.g;
    if (this.state === 'carry' && this.food) this.food.carrier = null;
    if (mode !== 'land') this.dropFood();
    this.perch = null;
    const f = { mode, t: 0, flap: U.rand(0, 1), speed: this.flySpeed * (opt.quick ? 0.75 : 1), tz: 0, alt: 40 };
    const W = g.W, H = g.H;
    if (mode === 'leave') {
      const side = U.randi(0, 2);
      f.tx = side === 0 ? -50 : side === 1 ? W + 50 : U.rand(0, W);
      f.ty = side === 2 ? this.y - 60 : this.y + U.rand(-30, 30);
      f.alt = U.rand(50, 90);
      f.out = true;
    } else if (mode === 'perch') {
      const p = U.pick(g.scene.perches);
      const px = U.rand(p.x1, p.x2);
      const sy = p.syFn ? p.syFn(px) : p.sy;
      // 止まり木に他の鳩がいれば少しずらす
      f.tx = px; f.ty = p.gy; f.tz = p.gy - sy; f.alt = f.tz + U.rand(8, 20); f.perch = p;
    } else if (mode === 'flock') {
      f.flock = opt.flock;
      const fl = opt.flock;
      f.off = [U.rand(-24, 24), U.rand(-14, 14), U.rand(-10, 10), 0];
      f.off[3] = Math.atan2((this.y - fl.cy) / fl.ry, (this.x - fl.cx) / fl.rx) - (fl.phase + g.t * fl.w) + U.rand(-0.35, 0.35);
      f.alt = opt.flock.alt;
    } else if (mode === 'hopto') {
      const tg = this.wanderTarget(90);
      f.tx = tg.x; f.ty = tg.y; f.alt = U.rand(10, 22); f.speed *= 0.7;
    } else {
      // land: 着地点が与えられる
      f.tx = opt.x; f.ty = opt.y; f.alt = opt.alt || U.rand(18, 40);
      f.tz = opt.tz || 0;
      f.perch = opt.perch || null;
    }
    this.fly = f;
    this.set('fly', 0);
    g.onTakeoff(this);
  }

  updateFly(dt) {
    const f = this.fly;
    const g = this.g;
    f.t += dt;
    let tx = f.tx, ty = f.ty;
    if (f.mode === 'flock') {
      const fl = f.flock;
      if (g.t > fl.until) {
        // 群れ解散 → めいめい着地、何羽かは止まり木や遠くへ
        const r = Math.random();
        if (r < 0.12 && g.mayLeave) return this.takeoff('leave');
        if (r < 0.3 && g.scene.perches.length) return this.takeoff('perch');
        const spot = fl.landNear ? g.groundNear(fl.landNear.x, fl.landNear.y, 45) : g.randomGround(true);
        this.fly.mode = 'land';
        this.fly.tx = spot.x; this.fly.ty = spot.y; this.fly.tz = 0; this.fly.alt = U.rand(15, 30);
        return;
      }
      const ph = fl.phase + g.t * fl.w + f.off[3];
      tx = fl.cx + Math.cos(ph) * fl.rx + f.off[0];
      ty = fl.cy + Math.sin(ph) * fl.ry + f.off[1];
    }
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const sp = f.speed * (f.mode === 'flock' ? 1.15 : 1) * Math.min(1, 0.35 + f.t * 1.5);
    // 慣性付きの操舵
    const k = Math.min(1, dt * (f.mode === 'flock' ? 2.2 : 3.5));
    const want = d > 0.01 ? Math.min(sp, d * 4) : 0;
    this.vx += ((d ? (dx / d) * want : 0) - this.vx) * k;
    this.vy += ((d ? (dy / d) * want : 0) - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(this.vx) > 10 && (this.vx > 0 ? 1 : -1) !== this.dir && this.age - this.dirAt > 0.3) {
      this.dir = this.vx > 0 ? 1 : -1;
      this.dirAt = this.age;
    }
    // 高度
    const landing = f.mode !== 'flock' && !f.out;
    let wantZ = f.alt;
    if (landing) {
      const approach = 26;
      if (d < approach) wantZ = U.lerp(f.tz, f.alt, Math.pow(d / approach, 1.3));
    }
    if (f.mode === 'flock') wantZ += (f.off[2] || 0) + Math.sin(g.t * 2 + this.id) * 3;
    const climb = f.t < 0.6 ? 70 : 45;
    const dz = U.clamp(wantZ - this.z, -climb * dt, climb * dt);
    this.z += dz;
    // 羽ばたき
    const vz = dz / dt;
    f.flap += dt * (f.t < 0.8 ? 15 : 10);
    const cyc = [0, 1, 2, 3, 2, 1];
    let frame = cyc[Math.floor(f.flap) % 6];
    if (vz < -8 && f.t > 1 && d > 22 && Math.sin(f.flap * 0.35 + this.id) > -0.2) frame = 4; // 滑空
    if (f.mode === 'flock' && Math.sin(g.t * 1.3 + this.id) > 0.55) frame = 4;
    if (landing && d < 9 && this.z - f.tz < 12) frame = Math.floor(f.flap * 1.2) % 2 ? 5 : 1;
    this.pose = `fly:${frame}`;
    if (f.out) {
      if (this.x < -40 || this.x > g.W + 40 || this.y - this.z < -40 || this.y > g.H + 60) this.left = true;
      if (f.t > 12) this.left = true;
      return;
    }
    if (landing && d < 1.5 && Math.abs(this.z - f.tz) < 1.5) {
      this.x = tx; this.y = ty; this.z = f.tz; this.vx = this.vy = 0;
      this.fly = null;
      if (f.perch) {
        this.perch = f.perch;
        this.set('perch', U.rand(8, 40));
        this.pose = 'stand:0:0';
      } else {
        this.pose = 'look';
        if (this.food && this.g.foods.includes(this.food)) this.set('food', 0);
        else { this.food = null; this.set('alert', U.rand(0.3, 0.9)); }
      }
    }
  }

  // ---- 毎フレーム ----
  update(dt) {
    this.st += dt;
    this.age += dt;
    if (this.calm > 0) this.calm -= dt;
    if (this.takeoffAt > 0 && this.g.t >= this.takeoffAt) {
      this.takeoffAt = -1;
      if (!this.fly) this.panicTakeoff();
    }
    if (this.fly) return this.updateFly(dt);
    const g = this.g;
    switch (this.state) {
      case 'idle': {
        // たまに首をかしげる
        const ph = Math.floor(this.st * 1.3 + this.id) % 5;
        this.pose = ph === 3 ? 'stand:1:0' : ph === 4 ? 'stand:-1:0' : 'stand:0:0';
        if (this.st > this.dur) this.think();
        break;
      }
      case 'look':
      case 'alert':
        this.pose = 'look';
        if (Math.floor(this.st * 2.5) % 3 === 2 && this.state === 'look') this.dir = (Math.floor(this.st * 2.5 + this.id) % 2) ? 1 : -1;
        if (this.st > this.dur) this.think();
        break;
      case 'rest':
        this.pose = this.st < 0.4 || this.st > this.dur - 0.3 ? 'sit:0' : 'sit:1';
        if (this.st > this.dur) this.set('idle', 0.6);
        break;
      case 'preen': {
        const k = Math.floor(this.st * 2.2 + this.id) % 4;
        this.pose = k === 0 ? 'stand:0:0' : k === 1 ? 'preen:0' : k === 2 ? 'preen:-1' : 'preen:0';
        if (this.st > this.dur) this.think();
        break;
      }
      case 'forage': {
        // 数歩歩いては地面をつつく
        if (this.sub > 0) {
          this.sub -= dt;
          const t = 1 - Math.abs((this.sub / 0.32) * 2 - 1);
          this.pose = `peck:${(Math.round(t * 3) / 3).toFixed(2)}:0`;
        } else if (this.stepToward(this.target.x, this.target.y, this.walkSpeed, dt)) {
          this.target = this.wanderTarget(35);
        } else if (U.chance(dt * 0.9)) this.sub = 0.32;
        if (this.st > this.dur) this.think();
        break;
      }
      case 'peck': {
        const per = 0.34;
        const k = this.st / per;
        const t = 1 - Math.abs((k % 1) * 2 - 1);
        this.pose = `peck:${(Math.round(t * 3) / 3).toFixed(2)}:0`;
        if (k >= this.n) this.set('idle', U.rand(0.3, 1.2));
        break;
      }
      case 'leaf': {
        const lf = this.target;
        if (!lf || !g.leaves.includes(lf)) { this.think(); break; }
        const ox = lf.x + (this.leafSide || -1) * 7, oy = lf.y;
        if (this.sub === 0) {
          if (this.stepToward(ox, oy, this.walkSpeed, dt) || U.dist(this.x, this.y, ox, oy) < 1.5) {
            this.sub = 1; this.st = 0; this.n = U.randi(2, 5);
            this.dir = -(this.leafSide || -1);
          }
          if (this.st > 6) this.think();
        } else {
          const per = 0.42;
          const k = this.st / per;
          const t = 1 - Math.abs((k % 1) * 2 - 1);
          this.pose = `peck:${(Math.round(t * 3) / 3).toFixed(2)}:0`;
          if (Math.floor(k) > this.sub - 1 && (k % 1) > 0.5) {
            this.sub++;
            // くちばしで払いのける
            lf.vx = this.dir * U.rand(6, 20) + U.rand(-8, 8);
            lf.vy = U.rand(-10, 10);
            lf.vz = U.rand(14, 30);
            lf.rot = (lf.rot + U.randi(1, 3)) % 4;
            g.dust(lf.x, lf.y);
          }
          if (k >= this.n) this.set(U.chance(0.5) ? 'peck' : 'idle', 0.8), (this.n = 1);
        }
        break;
      }
      case 'coo': {
        const tg = this.target;
        if (!tg || tg.left || tg.fly) { this.set('idle', 1); break; }
        // ふくらむ→お辞儀→くるっと回る→にじり寄る
        const cyc = this.st % 2.4;
        if (cyc < 0.5) this.pose = `coo:${(Math.min(1, cyc * 3)).toFixed(1)}:0`;
        else if (cyc < 1.1) {
          const b = Math.sin(((cyc - 0.5) / 0.6) * Math.PI);
          this.pose = `coo:1:${(Math.round(b * 4) / 4).toFixed(2)}`;
          if (this.sub !== Math.floor(this.st / 2.4) + 1) { this.sub = Math.floor(this.st / 2.4) + 1; g.sfx.coo(this.kiji); }
        } else if (cyc < 1.7) {
          this.pose = 'coo:1:0';
          this.dir = Math.floor((cyc - 1.1) * 5) % 2 ? 1 : -1;
        } else {
          this.pose = 'coo:1:0';
          const d = U.dist(tg.x, tg.y, this.x, this.y);
          if (d > 8) {
            const dx = tg.x - this.x, dy = tg.y - this.y;
            this.x += (dx / d) * 9 * dt; this.y += (dy / d) * 9 * dt;
            this.dir = dx > 0 ? 1 : -1;
          }
        }
        // 相手はたいてい逃げる
        if (this.st > 1 && U.chance(dt * 0.4) && tg.state !== 'walk' && tg.state !== 'coo') {
          const a = Math.atan2(tg.y - this.y, tg.x - this.x) + U.rand(-0.6, 0.6);
          tg.target = { x: tg.x + Math.cos(a) * 18, y: tg.y + Math.sin(a) * 12 };
          tg.set('walk', 3);
        }
        if (this.st > this.dur) this.set('idle', 1);
        break;
      }
      case 'walk':
      case 'evade': {
        const sp = this.state === 'evade' ? this.walkSpeed * 2.2 : this.walkSpeed * 1.2;
        if (!this.target || this.stepToward(this.target.x, this.target.y, sp, dt) || this.st > this.dur) {
          this.set('idle', U.rand(0.3, 1));
        }
        break;
      }
      case 'food': {
        const f = this.food;
        if (!f || !g.foods.includes(f)) {
          this.dropFood();
          const nf = this.findFood(140);
          if (nf) this.goFood(nf);
          else this.set('look', U.rand(0.5, 1.2));
          break;
        }
        const sp = this.walkSpeed * (1.9 + this.greed * 0.8);
        // どちら側から嘴を出すかは、餌が変わったときと遠いときだけ決め直す
        if (this.foodRef !== f || Math.abs(this.x - f.x) > 14) {
          this.foodRef = f;
          this.foodSide = this.x < f.x ? -1 : 1;
        }
        const tx = f.x + this.foodSide * 7;
        const d = U.dist(tx, f.y, this.x, this.y);
        if (f.carrier && f.carrier !== this && d < 4 && U.chance(dt * 1.5)) {
          // 横取り
          const victim = f.carrier;
          victim.food = null;
          victim.set('look', 0.6);
          f.carrier = this;
          this.set('carry', U.rand(0.8, 1.6));
          break;
        }
        if (d < 2.2 && !f.carrier) {
          this.dir = -this.foodSide;
          this.set('peckfood', 0);
          break;
        }
        if (this.stepToward(tx, f.y, sp, dt) && d >= 2.2) {
          // 着いたけど届かない: そのまま寄せる
          this.x += (tx - this.x) * 0.5;
          this.y += (f.y - this.y) * 0.5;
        }
        if (this.st > 12) { this.dropFood(); this.set('idle', 1); }
        break;
      }
      case 'peckfood': {
        const f = this.food;
        const per = 0.26 + (1 - this.greed) * 0.1;
        const k = this.st / per;
        const t = 1 - Math.abs((k % 1) * 2 - 1);
        this.pose = `peck:${(Math.round(t * 3) / 3).toFixed(2)}:0`;
        if (Math.floor(k) > this.n) {
          this.n = Math.floor(k);
          if (!f || !g.foods.includes(f) || f.carrier) { this.state = 'food'; this.st = 0; break; }
          const bx = this.x + this.dir * 7;
          if (U.dist(bx, this.y, f.x, f.y) > 3.5) { this.state = 'food'; this.st = 0; break; }
          if (U.chance(0.45)) {
            if (f.type === 'bread' && f.hp > 1 && U.chance(0.32)) {
              f.carrier = this;
              this.set('carry', U.rand(0.8, 1.8));
              break;
            }
            g.eat(f, this);
          }
          // まわりが混んでいたら押しのける
          if (U.chance(0.18)) {
            const rival = g.birds.find((b) => b !== this && !b.fly && b.state === 'peckfood' && U.dist(b.x, b.y, this.x, this.y) < 6);
            if (rival) rival.bump(this);
          }
        }
        break;
      }
      case 'carry': {
        const f = this.food;
        if (!f || !g.foods.includes(f)) { this.set('idle', 0.5); break; }
        if (!this.target || this.st < dt * 1.5) {
          // 仲間から離れる方向へ
          let ax = 0, ay = 0;
          for (const b of g.birds) {
            if (b === this || b.fly) continue;
            const d = U.dist(b.x, b.y, this.x, this.y);
            if (d < 40 && d > 0.1) { ax += (this.x - b.x) / d; ay += (this.y - b.y) / d; }
          }
          const a = Math.atan2(ay || U.rand(-1, 1), ax || U.rand(-1, 1));
          this.target = { x: this.x + Math.cos(a) * 26, y: this.y + Math.sin(a) * 16 };
        }
        const done = this.stepToward(this.target.x, this.target.y, this.walkSpeed * 2.6, dt);
        f.x = this.x + this.dir * 7.5; f.y = this.y; f.z = 0;
        if (done || this.st > this.dur) {
          f.carrier = null;
          this.set('peckfood', 0);
          this.pose = 'peck:1.00:0';
        }
        break;
      }
      case 'hop': {
        // 翼をばたつかせて小ジャンプ
        const T = 0.4;
        const t = this.st / T;
        this.z = Math.sin(Math.min(1, t) * Math.PI) * 5;
        this.pose = `fly:${[1, 0, 1, 2][Math.floor(t * 8) % 4]}`;
        if (this.target) { this.x += this.target.x * dt / T; this.y += this.target.y * dt / T; }
        if (!g.scene.walkable(this.x, this.y)) { const s = g.groundNear(this.x, this.y, 10); this.x = s.x; this.y = s.y; }
        if (t >= 1) {
          this.z = 0;
          if (this.food && g.foods.includes(this.food)) this.set('food', 0);
          else this.set('idle', 0.5);
        }
        break;
      }
      case 'perch': {
        // 止まり木: ひと休み
        const k = Math.floor(this.st * 0.6 + this.id) % 7;
        this.pose = k < 3 ? 'sit:1' : k === 3 ? 'preen:0' : k === 4 ? 'stand:0:0' : 'sit:0';
        if (k === 5 && Math.floor(this.st * 0.6) % 4 === 0) this.dir = (this.id + Math.floor(this.st)) % 2 ? 1 : -1;
        const hungry = g.foods.length > 3 && this.greed > 0.5;
        if (this.st > this.dur || (hungry && U.chance(dt * 0.6 * this.greed))) {
          const f = hungry ? this.findFood(400) : null;
          if (f) {
            this.food = f; f.claim++;
            this.takeoff('land', { x: f.x + U.rand(-12, 12), y: f.y + U.rand(-6, 6), alt: this.z + 4 });
          } else if (g.mayLeave && U.chance(0.25)) this.takeoff('leave');
          else {
            const s = g.randomGround(true);
            this.takeoff('land', { x: s.x, y: s.y, alt: this.z + 6 });
          }
        }
        break;
      }
      default:
        this.set('idle', 1);
    }
    // 地上にいて地面以外にいたら補正
    if (!this.perch && !this.fly && this.state !== 'hop') this.z = 0;
  }

  bump(from) {
    // 押しのけられて、ばたっと跳ぶ
    if (this.fly || this.state === 'hop') return;
    const dx = this.x - from.x || U.rand(-1, 1), dy = this.y - from.y || U.rand(-1, 1);
    const d = Math.hypot(dx, dy) || 1;
    this.target = { x: (dx / d) * U.rand(5, 9), y: (dy / d) * U.rand(3, 6) };
    this.set('hop', 0.4);
    this.g.sfx.flap(1, 0.15);
  }

  // 何かに驚いたとき
  startle(sx, sy, fear) {
    if (this.fly || this.calm > 0) return;
    const fx = fear * (this.kiji ? 1.5 : 1) / (0.4 + this.bold);
    if (fx > 0.9) {
      if (this.takeoffAt < 0) this.takeoffAt = this.g.t + U.rand(0.0, 0.18);
      this.fleeFrom = [sx, sy];
    } else if (fx > 0.35) {
      const a = Math.atan2(this.y - sy, this.x - sx) + U.rand(-0.5, 0.5);
      this.dropFood();
      this.target = { x: this.x + Math.cos(a) * U.rand(12, 22), y: this.y + Math.sin(a) * U.rand(8, 14) };
      this.set('evade', 1.4);
      this.calm = 0.6;
    } else if (this.state !== 'peckfood' && this.state !== 'food') {
      this.set('alert', U.rand(0.4, 1.0));
      this.calm = 0.5;
    }
  }

  panicTakeoff() {
    const g = this.g;
    this.calm = 2;
    const leaveP = !g.mayLeave ? 0 : this.kiji ? 0.6 : 0.22;
    if (U.chance(leaveP)) this.takeoff('leave');
    else if (U.chance(0.15) && g.scene.perches.length) this.takeoff('perch');
    else this.takeoff('flock', { flock: g.getFlock(this) });
    // 隣の鳩にも伝染する
    g.contagion(this);
  }

  // 描画用の深度
  get depth() {
    if (this.perch) return this.perch.gy;
    if (this.fly && this.z > 6) return 10000 + this.y;
    return this.y;
  }
}
