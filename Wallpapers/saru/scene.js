/*
 * 猿 Saru — a mother snow monkey holding her little one in a steaming pool,
 * down at the bottom of a snowy valley at dusk.
 *
 * Valley, inn, pool and rocks are baked once. The monkeys are three small
 * sprites that breathe; steam is a short pool of soft puffs rising off the
 * water, and the snow is a fixed set of flakes reused as they fall.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp } = K;

  const TAU = Math.PI * 2;
  const POOL = 0.6;
  const FUR = { base: '#8f8070', dark: '#625649', light: '#bfb3a2', ruff: '#c9bfae' };
  const FACE = { skin: '#d4917c', dark: '#8a4a40', eye: '#2a2220', brow: '#a85a4c' };
  const SNOW = { lit: '#e6e3d8', shade: '#b9bfca', deep: '#8e98aa' };
  const ROCK = { dark: '#34343a', mid: '#55545a', light: '#77757a' };
  const CEDAR = { dark: '#25332e', mid: '#33463b' };
  const WATER = { top: '#768f98', low: '#2a4250', glint: '#a9bcc2' };
  const GLOW = '#d9a44a';
  const MAX_FLAKES = 360;
  const FLAKES = 150;
  const MAX_PUFFS = 34;
  const PUFFS = 18;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    return { W, H, U, u, pool: Math.round(H * POOL) };
  }

  // ---- valley -------------------------------------------------------------

  function slopeLeft(g, x) {
    return g.H * 0.1 + (x / g.W) * g.H * 0.62 + (fbm(x / (g.U * 18), 2.2, 3, 5) - 0.5) * g.H * 0.06;
  }

  function slopeRight(g, x) {
    return g.H * 0.06 + ((g.W - x) / g.W) * g.H * 0.66 + (fbm(x / (g.U * 18), 7.1, 3, 9) - 0.5) * g.H * 0.06;
  }

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.5);
    grad.addColorStop(0, '#2c3654');
    grad.addColorStop(0.6, '#56607c');
    grad.addColorStop(1, '#8a8a98');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function paintSlope(ctx, g, top, seed) {
    const img = ctx.getImageData(0, 0, g.W, g.pool);
    const d = img.data;
    const lit = K.parseColor(SNOW.lit);
    const shade = K.parseColor(SNOW.shade);
    const deep = K.parseColor(SNOW.deep);
    for (let x = 0; x < g.W; x++) {
      const y0 = Math.max(0, Math.floor(top(g, x)));
      for (let y = y0; y < g.pool; y++) {
        const n = fbm(x / (g.U * 9), y / (g.U * 5), 3, seed);
        const c = n > 0.56 ? lit : n > 0.42 ? shade : deep;
        const i = (y * g.W + x) * 4;
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function cedar(ctx, x, y, h, rand) {
    ctx.fillStyle = CEDAR.dark;
    ctx.fillRect(x - 0.5, y - h * 0.25, 1, h * 0.3);
    for (let k = 0; k < 4; k++) {
      const w = h * (0.3 - k * 0.06);
      const ty = y - h * (0.2 + k * 0.2);
      ctx.fillStyle = k % 2 ? CEDAR.mid : CEDAR.dark;
      ctx.beginPath();
      ctx.moveTo(x - w, ty);
      ctx.lineTo(x, ty - h * 0.32);
      ctx.lineTo(x + w, ty);
      ctx.fill();
      ctx.fillStyle = rand() < 0.5 ? SNOW.lit : SNOW.shade;
      blob(ctx, x - w * 0.3, ty - h * 0.06, w * 0.5, Math.max(0.5, h * 0.035));
    }
  }

  function paintForest(ctx, g, rand, top, side) {
    const count = Math.round(g.W * 0.22);
    for (let i = 0; i < count; i++) {
      const f = rand();
      const x = side < 0 ? f * g.W * 0.55 : g.W * (0.45 + f * 0.55);
      const y = top(g, x) + g.U * (1 + rand() * 30);
      if (y > g.pool - g.U * 3 || rand() < 0.35) continue;
      const near = (y - g.H * 0.1) / (g.H * 0.5);
      cedar(ctx, x, y, g.U * (4 + near * 6 + rand() * 3), rand);
    }
  }

  function paintInn(ctx, g) {
    const x = g.W * 0.16;
    const y = slopeLeft(g, x) + g.U * 8;
    const w = g.u * 22;
    const h = g.U * 6;
    ctx.fillStyle = '#3a2e26';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = GLOW;
    for (let i = 0; i < 4; i++) ctx.fillRect(x - w / 2 + w * (0.1 + i * 0.22), y - h * 0.7, w * 0.12, h * 0.4);
    ctx.fillStyle = '#2a221d';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6, y - h);
    ctx.lineTo(x - w * 0.42, y - h * 1.7);
    ctx.lineTo(x + w * 0.42, y - h * 1.7);
    ctx.lineTo(x + w * 0.6, y - h);
    ctx.fill();
    ctx.fillStyle = SNOW.lit;
    ctx.fillRect(x - w * 0.42, y - h * 1.8, w * 0.84, h * 0.3);
    ctx.fillStyle = SNOW.shade;
    ctx.fillRect(x - w * 0.6, y - h * 1.08, w * 1.2, Math.max(1, h * 0.12));
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintSlope(ctx, g, slopeRight, 31);
    paintForest(ctx, g, rand, slopeRight, 1);
    paintSlope(ctx, g, slopeLeft, 17);
    paintForest(ctx, g, rand, slopeLeft, -1);
    paintInn(ctx, g);
    return c;
  }

  // ---- pool and rocks ------------------------------------------------------

  function rock(ctx, x, y, r, rand) {
    ctx.fillStyle = ROCK.dark;
    blob(ctx, x, y, r, r * 0.62);
    ctx.fillStyle = ROCK.mid;
    blob(ctx, x - r * 0.18, y - r * 0.12, r * 0.6, r * 0.34);
    ctx.fillStyle = SNOW.shade;
    blob(ctx, x, y - r * 0.42, r * 0.82, r * 0.22);
    ctx.fillStyle = SNOW.lit;
    blob(ctx, x - r * 0.1, y - r * 0.5, r * (0.5 + rand() * 0.2), r * 0.14);
  }

  function paintPool(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.pool, 0, g.H);
    grad.addColorStop(0, WATER.top);
    grad.addColorStop(1, WATER.low);
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.pool - g.U, g.W, g.H - g.pool + g.U);
    for (let x = -g.U * 4; x < g.W + g.U * 4; ) {
      const r = g.U * (2.5 + rand() * 3);
      rock(ctx, x, g.pool - g.U * 0.2 + rand() * g.U, r, rand);
      x += r * (1.1 + rand() * 0.6);
    }
    return c;
  }

  function paintShimmer(g, rand) {
    const c = layer(g.W + g.U * 20, g.H - g.pool);
    const ctx = c.getContext('2d');
    ctx.fillStyle = WATER.glint;
    for (let i = 0; i < g.W * 0.25; i++) {
      const y = g.U * 3 + rand() * (c.height - g.U * 3);
      const len = g.U * (2 + rand() * 6) * (0.5 + y / c.height);
      ctx.globalAlpha = 0.25 + rand() * 0.35;
      ctx.fillRect(rand() * c.width, y, len, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let x = -g.U * 6; x < g.W * 0.42; ) {
      const r = g.U * (6 + rand() * 5);
      rock(ctx, x, g.H + r * 0.1 - rand() * g.U * 2, r, rand);
      x += r * (1.2 + rand() * 0.5);
    }
    rock(ctx, g.W * 0.96, g.H * 0.99, g.U * 10, rand);
    return c;
  }

  // ---- monkeys -------------------------------------------------------------

  function fur(ctx, rand, x, y, rx, ry, n) {
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand());
      ctx.fillStyle = rand() < 0.5 ? FUR.dark : FUR.light;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function face(ctx, x, y, s, closed) {
    ctx.fillStyle = FUR.ruff;
    blob(ctx, x, y + s * 0.02, s * 0.34, s * 0.36);
    ctx.fillStyle = FACE.skin;
    blob(ctx, x, y + s * 0.05, s * 0.2, s * 0.25);
    ctx.fillStyle = FUR.base;
    blob(ctx, x, y - s * 0.19, s * 0.3, s * 0.1);
    ctx.fillStyle = FACE.eye;
    const ew = closed ? s * 0.07 : s * 0.05;
    const eh = closed ? Math.max(0.6, s * 0.022) : s * 0.05;
    blob(ctx, x - s * 0.09, y - s * 0.05, ew, eh);
    blob(ctx, x + s * 0.09, y - s * 0.05, ew, eh);
    ctx.fillStyle = FACE.dark;
    ctx.globalAlpha = 0.6;
    blob(ctx, x, y + s * 0.21, s * 0.07, Math.max(0.5, s * 0.014));
    ctx.globalAlpha = 1;
  }

  function head(ctx, rand, x, y, s, closed) {
    ctx.fillStyle = FUR.base;
    blob(ctx, x - s * 0.4, y - s * 0.02, s * 0.1, s * 0.12);
    blob(ctx, x + s * 0.4, y - s * 0.02, s * 0.1, s * 0.12);
    blob(ctx, x, y, s * 0.46, s * 0.48);
    fur(ctx, rand, x, y, s * 0.46, s * 0.48, s * s * 0.3);
    face(ctx, x, y + s * 0.08, s, closed);
    ctx.fillStyle = SNOW.shade;
    blob(ctx, x - s * 0.04, y - s * 0.36, s * 0.24, s * 0.09);
    ctx.fillStyle = SNOW.lit;
    blob(ctx, x - s * 0.06, y - s * 0.41, s * 0.2, s * 0.07);
  }

  function sprite(s) {
    const c = layer(s * 3, s * 2.6);
    return { c, ctx: c.getContext('2d'), ox: s * 1.5, oy: s * 2.1 };
  }

  function clipWater(sp, s) {
    sp.ctx.clearRect(0, sp.oy, sp.c.width, sp.c.height);
    sp.ctx.fillStyle = WATER.top;
    sp.ctx.globalAlpha = 0.5;
    sp.ctx.fillRect(sp.ox - s * 0.95, sp.oy, s * 1.9, Math.max(1, s * 0.06));
    sp.ctx.globalAlpha = 1;
  }

  function paintMonkey(s, rand, closed) {
    const sp = sprite(s);
    const { ctx, ox, oy } = sp;
    ctx.fillStyle = FUR.base;
    blob(ctx, ox, oy - s * 0.3, s * 0.9, s * 0.6);
    fur(ctx, rand, ox, oy - s * 0.3, s * 0.9, s * 0.6, s * s * 0.5);
    ctx.fillStyle = SNOW.lit;
    blob(ctx, ox - s * 0.45, oy - s * 0.78, s * 0.28, s * 0.08);
    head(ctx, rand, ox, oy - s * 1.0, s, closed);
    clipWater(sp, s);
    return sp;
  }

  function paintArm(s, rand) {
    const sp = sprite(s);
    const { ctx, ox, oy } = sp;
    ctx.fillStyle = FUR.base;
    blob(ctx, ox - s * 0.2, oy - s * 0.12, s * 0.62, s * 0.16);
    fur(ctx, rand, ox - s * 0.2, oy - s * 0.12, s * 0.62, s * 0.16, s * s * 0.1);
    ctx.fillStyle = FUR.dark;
    blob(ctx, ox - s * 0.74, oy - s * 0.12, s * 0.12, s * 0.1);
    clipWater(sp, s);
    return sp;
  }

  function makeMonkeys(g, rand) {
    const big = g.U * 19;
    const list = [
      { x: g.W * 0.22, y: g.pool + g.U * 6, s: g.U * 5, closed: true, ph: 0.4 },
      { x: g.W * 0.4, y: g.pool + g.U * 9, s: g.U * 6.5, closed: false, ph: 2.1 },
      { x: g.W * 0.7, y: g.H * 1.0, s: big, closed: true, ph: 1.1 },
    ];
    for (const m of list) m.sp = paintMonkey(m.s, rand, m.closed);
    const mother = list[2];
    state.baby = { x: mother.x - big * 0.42, y: mother.y - big * 0.08, s: big * 0.5, sp: paintMonkey(big * 0.5, rand, false) };
    state.arm = paintArm(big, rand);
    return list;
  }

  function drawSprite(ctx, sp, x, y) {
    ctx.drawImage(sp.c, x - sp.ox, y - sp.oy);
  }

  function drawRing(ctx, m, t) {
    const p = ((t * 0.25 + m.ph) % 1 + 1) % 1;
    ctx.globalAlpha = (1 - p) * 0.45;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.s * (0.9 + p * 0.9), m.s * (0.12 + p * 0.14), 0, 0, TAU);
    ctx.stroke();
  }

  function drawMonkeys(ctx, g, t) {
    ctx.strokeStyle = WATER.glint;
    ctx.lineWidth = 1;
    for (const m of state.monkeys) drawRing(ctx, m, t);
    ctx.globalAlpha = 1;
    for (const m of state.monkeys) {
      const breathe = Math.sin(t * 0.9 + m.ph) * m.s * 0.04;
      drawSprite(ctx, m.sp, m.x, m.y + breathe);
    }
    const mother = state.monkeys[2];
    const b = state.baby;
    const sway = Math.sin(t * 0.5) * b.s * 0.12;
    drawSprite(ctx, b.sp, b.x + sway, b.y + Math.sin(t * 1.3) * b.s * 0.03);
    drawSprite(ctx, state.arm, mother.x, mother.y + Math.sin(t * 0.9 + mother.ph) * mother.s * 0.04);
  }

  // ---- steam and snow ------------------------------------------------------

  function paintPuff(r) {
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(222, 224, 222, 1)');
    grad.addColorStop(1, 'rgba(222, 224, 222, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  function makePool(n, keys) {
    const out = {};
    for (const k of keys) out[k] = new Float32Array(n);
    return out;
  }

  function resetPuff(g, P, i, scatter) {
    P.x[i] = g.W * (0.05 + state.rand() * 0.9);
    P.y[i] = g.pool + g.U * (2 + state.rand() * 30);
    P.life[i] = 6 + state.rand() * 6;
    P.age[i] = scatter ? state.rand() * P.life[i] : 0;
    P.r[i] = g.U * (6 + state.rand() * 8);
  }

  function drawSteam(ctx, g, dt, count, amount) {
    const P = state.puffs;
    for (let i = 0; i < count; i++) {
      P.age[i] += dt;
      if (P.age[i] > P.life[i]) resetPuff(g, P, i, false);
      const f = P.age[i] / P.life[i];
      const r = P.r[i] * (0.6 + f * 1.2);
      const y = P.y[i] - f * g.U * 22;
      const x = P.x[i] + f * g.U * 6;
      ctx.globalAlpha = Math.min(1, amount) * 0.45 * Math.sin(Math.PI * f);
      ctx.drawImage(state.puff, x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function resetFlake(g, F, i, anywhere) {
    F.x[i] = state.rand() * g.W;
    F.y[i] = anywhere ? state.rand() * g.H : -2;
    F.v[i] = g.U * (2.5 + state.rand() * 4);
    F.ph[i] = state.rand() * TAU;
    F.s[i] = state.rand() < 0.2 ? 2 : 1;
  }

  function drawSnow(ctx, g, t, dt, count) {
    const F = state.flakes;
    ctx.fillStyle = SNOW.lit;
    for (let i = 0; i < count; i++) {
      F.y[i] += F.v[i] * F.s[i] * dt;
      if (F.y[i] > g.H) resetFlake(g, F, i, false);
      const x = F.x[i] + Math.sin(t * 0.7 + F.ph[i]) * g.U * 1.5;
      ctx.globalAlpha = F.s[i] > 1 ? 0.9 : 0.6;
      ctx.fillRect(x, F.y[i], F.s[i], F.s[i]);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.pool = paintPool(g, rand);
    state.shimmer = paintShimmer(g, rand);
    state.front = paintFront(g, rand);
    state.monkeys = makeMonkeys(g, rand);
    state.puff = paintPuff(Math.max(4, Math.round(g.U * 6)));
    state.puffs = makePool(MAX_PUFFS, ['x', 'y', 'age', 'life', 'r']);
    for (let i = 0; i < MAX_PUFFS; i++) resetPuff(g, state.puffs, i, true);
    state.flakes = makePool(MAX_FLAKES, ['x', 'y', 'v', 'ph', 's']);
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, state.flakes, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, steam } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.pool, 0, 0);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(state.shimmer, -g.U * 10 + Math.sin(t * 0.35) * g.U * 4, g.pool);
    ctx.globalAlpha = 1;
    drawMonkeys(ctx, g, t);
    const puffs = Math.min(MAX_PUFFS, Math.round(PUFFS * steam));
    drawSteam(ctx, g, step, puffs, steam);
    ctx.drawImage(state.front, 0, 0);
    drawSnow(ctx, g, t, step, Math.min(MAX_FLAKES, Math.round(FLAKES * snow)));
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
