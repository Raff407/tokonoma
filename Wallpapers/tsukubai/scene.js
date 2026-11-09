/*
 * 蹲踞 Tsukubai — a stone water basin in a moss garden at dusk.
 *
 * Garden, basin, bamboo pipe and ladle are baked once. Each frame lays them down,
 * then a bead swells at the pipe mouth, falls, and sends rings across the water.
 * Rings and drops come from small fixed pools; one maple leaf turns on the surface.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;

  const TAU = Math.PI * 2;
  const MOSS = ['#26382a', '#304630', '#3d5636', '#4d6a3e', '#62804a'];
  const STONE = { top: '#8e8c80', light: '#a8a596', side: '#66665c', dark: '#45463f', lip: '#3a3c38' };
  const WATER = { deep: '#22344a', mid: '#36495e', sky: '#6c7c88', glow: '#8a8f86' };
  const BAMBOO = { body: '#8c8a4e', light: '#b4ae6a', node: '#5e5e36', mouth: '#2a2a1e' };
  const RING_INK = '#d8d2bc';
  const RING_SHADE = '#14202e';
  const LEAF = '#b4472c';
  const MAX_RINGS = 12;
  const MAX_DROPS = 4;
  const RING_LIFE = 3.6;
  const BEAD_TIME = 0.7;
  const FIREFLIES = 7;
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
    const rx = Math.min(W * 0.22, U * 42);
    const ry = rx * 0.46;
    const bx = W * 0.44;
    const by = H * 0.6;
    const wrx = rx * 0.68;
    const wry = ry * 0.64;
    const wx = bx;
    const wy = by - ry * 0.05;
    const tx = wx + wrx * 0.42;
    const ty = H * 0.3;
    const ly = wy - wry * 0.2;
    return { W, H, U, rx, ry, bx, by, wrx, wry, wx, wy, tx, ty, ly, side: U * 15 };
  }

  // ---- garden --------------------------------------------------------------

  function paintMoss(ctx, g) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = MOSS.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const depth = y / g.H;
      for (let x = 0; x < g.W; x++) {
        let n = fbm(x / (g.U * 9), y / (g.U * 6), 4, 7) * 0.8 + depth * 0.45 - 0.15;
        n += (K.hash2(x, y, 3) - 0.5) * 0.18;
        const k = Math.max(0, Math.min(inks.length - 1, Math.floor(n * inks.length)));
        const ink = inks[k];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintShrubs(ctx, g, rand) {
    const tones = ['#22332a', '#2f452f', '#43603a'];
    for (let x = -g.U * 6; x < g.W + g.U * 6; x += g.U * (7 + rand() * 6)) {
      const y = g.H * (0.1 + rand() * 0.1);
      const r = g.U * (8 + rand() * 7);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = tones[k];
        blob(ctx, x - r * 0.15 * k, y - r * 0.15 * k, r * (1 - k * 0.25), r * 0.7 * (1 - k * 0.25));
      }
    }
    ctx.fillStyle = 'rgba(20, 28, 26, 0.4)';
    ctx.fillRect(0, 0, g.W, g.H * 0.03);
  }

  function paintStones(ctx, g, rand) {
    const steps = [[0.12, 0.92, 9], [0.22, 0.8, 7], [0.82, 0.86, 8], [0.08, 0.6, 5]];
    for (const [fx, fy, s] of steps) {
      const x = g.W * fx;
      const y = g.H * fy;
      ctx.fillStyle = 'rgba(16, 22, 18, 0.5)';
      blob(ctx, x + g.U, y + g.U * 1.2, g.U * s * 1.1, g.U * s * 0.45);
      ctx.fillStyle = STONE.side;
      blob(ctx, x, y, g.U * s * 1.1, g.U * s * 0.45);
      ctx.fillStyle = STONE.top;
      blob(ctx, x - g.U * 0.5, y - g.U * 0.6, g.U * s, g.U * s * 0.36);
      ctx.fillStyle = STONE.light;
      blob(ctx, x - g.U * s * 0.35, y - g.U * s * 0.18, g.U * s * 0.4, g.U * s * 0.12);
    }
    const ground = g.by + g.side;
    ctx.fillStyle = '#2c3434';
    blob(ctx, g.bx, ground - g.U * 2, g.rx * 1.45, g.ry * 0.75);
    const pebbles = ['#5a5e5a', '#6e706a', '#4a4e4c', '#7c7c72'];
    for (let i = 0; i < 260; i++) {
      const a = rand() * TAU;
      const r = Math.sqrt(rand());
      const x = g.bx + Math.cos(a) * r * g.rx * 1.4;
      const y = ground - g.U * 2 + Math.sin(a) * r * g.ry * 0.7;
      ctx.fillStyle = pebbles[(rand() * pebbles.length) | 0];
      blob(ctx, x, y, g.U * (0.5 + rand() * 0.6), g.U * (0.35 + rand() * 0.3));
    }
  }

  // ---- basin ---------------------------------------------------------------

  function paintBasin(ctx, g, rand) {
    const { bx, by, rx, ry, side } = g;
    ctx.fillStyle = 'rgba(12, 18, 16, 0.6)';
    blob(ctx, bx + g.U * 3, by + side + g.U, rx * 1.12, ry * 0.7);
    ctx.fillStyle = STONE.dark;
    ctx.beginPath();
    ctx.ellipse(bx, by + side, rx * 1.04, ry * 1.02, 0, 0, Math.PI);
    ctx.lineTo(bx - rx, by);
    ctx.ellipse(bx, by, rx, ry, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = STONE.side;
    ctx.beginPath();
    ctx.ellipse(bx - rx * 0.1, by + side * 0.55, rx * 0.86, ry * 1.0, 0, 0, Math.PI);
    ctx.ellipse(bx - rx * 0.1, by, rx * 0.86, ry * 0.6, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.fillStyle = STONE.top;
    blob(ctx, bx, by, rx, ry);
    ctx.fillStyle = STONE.light;
    blob(ctx, bx - rx * 0.12, by - ry * 0.12, rx * 0.86, ry * 0.8);
    for (let i = 0; i < 90; i++) {
      const a = rand() * TAU;
      const r = 0.75 + rand() * 0.25;
      ctx.fillStyle = rand() < 0.5 ? STONE.side : STONE.top;
      blob(ctx, bx + Math.cos(a) * rx * r, by + Math.sin(a) * ry * r, g.U * 0.7, g.U * 0.4);
    }
    const mossInk = ['#3d5636', '#4d6a3e', '#62804a'];
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.1 + rand() * 0.8);
      const x = bx + Math.cos(a) * rx * (0.9 + rand() * 0.14);
      const y = by + Math.sin(a) * ry + side * (0.4 + rand() * 0.6);
      ctx.fillStyle = mossInk[(rand() * 3) | 0];
      blob(ctx, x, y, g.U * (1 + rand() * 1.6), g.U * (0.6 + rand()));
    }
    ctx.fillStyle = STONE.lip;
    blob(ctx, g.wx, g.wy, g.wrx * 1.08, g.wry * 1.12);
    paintWater(ctx, g);
  }

  function paintWater(ctx, g) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(g.wx, g.wy, g.wrx, g.wry, 0, 0, TAU);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, g.wy - g.wry, 0, g.wy + g.wry);
    grad.addColorStop(0, WATER.sky);
    grad.addColorStop(0.35, WATER.mid);
    grad.addColorStop(1, WATER.deep);
    ctx.fillStyle = grad;
    ctx.fillRect(g.wx - g.wrx, g.wy - g.wry, g.wrx * 2, g.wry * 2);
    ctx.fillStyle = 'rgba(20, 30, 28, 0.55)';
    blob(ctx, g.wx, g.wy - g.wry * 0.95, g.wrx * 1.05, g.wry * 0.35);
    ctx.fillStyle = 'rgba(138, 143, 134, 0.35)';
    blob(ctx, g.wx - g.wrx * 0.3, g.wy - g.wry * 0.25, g.wrx * 0.35, g.wry * 0.12);
    ctx.restore();
  }

  // ---- bamboo pipe and ladle -----------------------------------------------

  function stick(ctx, x0, y0, x1, y1, w, ink, light) {
    ctx.lineCap = 'butt';
    ctx.strokeStyle = ink;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = Math.max(1, w * 0.3);
    ctx.beginPath();
    ctx.moveTo(x0, y0 - w * 0.25);
    ctx.lineTo(x1, y1 - w * 0.25);
    ctx.stroke();
  }

  function nodes(ctx, x0, y0, x1, y1, w, gap) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    ctx.strokeStyle = BAMBOO.node;
    ctx.lineWidth = Math.max(1, w * 0.22);
    for (let s = gap * 0.6; s < len - w; s += gap) {
      const x = x0 + ((x1 - x0) * s) / len;
      const y = y0 + ((y1 - y0) * s) / len;
      ctx.beginPath();
      ctx.moveTo(x - nx * w * 0.5, y - ny * w * 0.5);
      ctx.lineTo(x + nx * w * 0.5, y + ny * w * 0.5);
      ctx.stroke();
    }
  }

  function paintFront(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const w = g.U * 3.4;
    const px = g.bx + g.rx * 1.3;
    const ground = g.H * 0.74;
    const end = g.tx + w * 0.4;
    stick(ctx, px, g.ty + w * 0.2, px, ground, w * 1.1, BAMBOO.body, BAMBOO.light);
    nodes(ctx, px, ground, px, g.ty + w * 0.2, w * 1.1, g.U * 12);
    ctx.fillStyle = 'rgba(16, 22, 18, 0.5)';
    blob(ctx, px, ground, w * 1.2, w * 0.4);
    const sx = g.W + w;
    const sy = g.ty - g.U * 4;
    stick(ctx, sx, sy, end, g.ty - w * 0.5, w, BAMBOO.body, BAMBOO.light);
    nodes(ctx, sx, sy, end, g.ty - w * 0.5, w, g.U * 14);
    ctx.strokeStyle = '#3e3a2a';
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    ctx.beginPath();
    ctx.moveTo(px - w * 0.7, g.ty - w * 0.1);
    ctx.lineTo(px + w * 0.7, g.ty - w * 1.1);
    ctx.stroke();
    ctx.fillStyle = BAMBOO.mouth;
    blob(ctx, end, g.ty - w * 0.45, w * 0.28, w * 0.5);
    paintLadle(ctx, g);
    return c;
  }

  function paintLadle(ctx, g) {
    const x0 = g.bx - g.rx * 0.95;
    const y0 = g.by - g.ry * 0.2;
    const x1 = g.bx - g.rx * 0.05;
    const y1 = g.by - g.ry * 0.98;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#6e6440';
    ctx.lineWidth = Math.max(1, g.U * 1.2);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = '#a89c66';
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    ctx.beginPath();
    ctx.moveTo(x0, y0 - g.U * 0.4);
    ctx.lineTo(x1, y1 - g.U * 0.4);
    ctx.stroke();
    const cw = g.U * 4;
    const ch = g.U * 4.4;
    ctx.fillStyle = '#7a6e44';
    ctx.fillRect(x0 - cw * 0.5, y0 - ch * 0.3, cw, ch);
    ctx.fillStyle = '#a89c66';
    blob(ctx, x0, y0 - ch * 0.3, cw * 0.5, cw * 0.22);
    ctx.fillStyle = '#4a4430';
    blob(ctx, x0, y0 - ch * 0.3, cw * 0.38, cw * 0.14);
    ctx.fillStyle = '#5e5638';
    blob(ctx, x0, y0 + ch * 0.7, cw * 0.5, cw * 0.2);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintMoss(ctx, g);
    paintShrubs(ctx, g, rand);
    paintStones(ctx, g, rand);
    paintBasin(ctx, g, rand);
    return c;
  }

  // ---- motion --------------------------------------------------------------

  function makePools() {
    return {
      ring: { x: new Float32Array(MAX_RINGS), y: new Float32Array(MAX_RINGS), age: new Float32Array(MAX_RINGS).fill(RING_LIFE), size: new Float32Array(MAX_RINGS) },
      drop: { y: new Float32Array(MAX_DROPS), vy: new Float32Array(MAX_DROPS), on: new Uint8Array(MAX_DROPS) },
      next: 0,
      bead: 0,
    };
  }

  function addRing(x, y, size) {
    const R = state.pools.ring;
    let pick = 0;
    for (let i = 1; i < MAX_RINGS; i++) if (R.age[i] > R.age[pick]) pick = i;
    R.x[pick] = x;
    R.y[pick] = y;
    R.age[pick] = 0;
    R.size[pick] = size;
  }

  function stepDrops(g, dt, drip) {
    const P = state.pools;
    const D = P.drop;
    if (drip > 0) {
      P.bead += dt * drip / BEAD_TIME;
      if (P.bead >= 1) {
        P.bead = 0;
        for (let i = 0; i < MAX_DROPS; i++) {
          if (D.on[i]) continue;
          D.on[i] = 1;
          D.y[i] = g.ty;
          D.vy[i] = 0;
          break;
        }
      }
    }
    for (let i = 0; i < MAX_DROPS; i++) {
      if (!D.on[i]) continue;
      D.vy[i] += g.U * 70 * dt;
      D.y[i] += D.vy[i] * dt;
      if (D.y[i] >= g.ly) {
        D.on[i] = 0;
        addRing(g.tx, g.ly, 1);
        if (state.rand() < 0.35) P.next = 0.25;
      }
    }
    if (P.next > 0) {
      P.next -= dt;
      if (P.next <= 0) addRing(g.tx, g.ly, 0.55);
    }
    const R = P.ring;
    for (let i = 0; i < MAX_RINGS; i++) if (R.age[i] < RING_LIFE) R.age[i] += dt;
  }

  function drawRings(ctx, g, ripple) {
    if (ripple <= 0) return;
    const R = state.pools.ring;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(g.wx, g.wy, g.wrx, g.wry, 0, 0, TAU);
    ctx.clip();
    const flat = g.wry / g.wrx;
    for (let i = 0; i < MAX_RINGS; i++) {
      const a = R.age[i];
      if (a >= RING_LIFE) continue;
      const life = a / RING_LIFE;
      const r = g.U * (1 + a * 13 * Math.sqrt(R.size[i]));
      const fade = (1 - life) * (1 - life) * Math.min(1, a * 6) * Math.min(1, ripple);
      ctx.lineWidth = Math.max(1, g.U * 1.1 * (1 - life * 0.4));
      for (let k = 0; k < 2; k++) {
        const rr = r * (1 - k * 0.42);
        if (rr < g.U * 0.6) continue;
        ctx.globalAlpha = Math.min(1, fade * (k ? 0.6 : 0.95) * R.size[i]);
        ctx.strokeStyle = RING_SHADE;
        ctx.beginPath();
        ctx.ellipse(R.x[i], R.y[i] + g.U * 0.5, rr, rr * flat, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = RING_INK;
        ctx.beginPath();
        ctx.ellipse(R.x[i], R.y[i], rr, rr * flat, 0, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawLeaf(ctx, g, t) {
    const a = t * 0.05;
    const x = g.wx - g.wrx * 0.35 + Math.cos(a) * g.wrx * 0.12;
    const y = g.wy + g.wry * 0.3 + Math.sin(a) * g.wry * 0.15;
    const s = g.U * 3.6;
    const turn = t * 0.08;
    ctx.fillStyle = LEAF;
    for (let k = 0; k < 5; k++) {
      const ang = turn + (k - 2) * 0.6 - Math.PI / 2;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      ctx.setTransform(c, sn * 0.5, -sn, c * 0.5, x, y);
      blob(ctx, s * 0.55, 0, s * 0.55, s * 0.2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawShimmer(ctx, g, t) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(g.wx, g.wy, g.wrx, g.wry, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = WATER.glow;
    for (let k = 0; k < 3; k++) {
      const p = t * (0.35 + k * 0.13) + k * 2.1;
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(p * 1.3);
      blob(ctx, g.wx - g.wrx * (0.45 - k * 0.3) + Math.sin(p) * g.wrx * 0.08,
        g.wy - g.wry * (0.45 - k * 0.12), g.wrx * (0.22 - k * 0.04), g.wry * 0.06);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function makeFlies(rand) {
    const f = [];
    for (let i = 0; i < FIREFLIES; i++) {
      f.push({ x: rand(), y: 0.15 + rand() * 0.75, p: rand() * TAU, s: 0.6 + rand() * 0.6 });
    }
    return f;
  }

  function drawFlies(ctx, g, t) {
    ctx.fillStyle = '#d8c070';
    for (let i = 0; i < FIREFLIES; i++) {
      const f = state.flies[i];
      const ph = t * 0.25 * f.s + f.p;
      const x = ((f.x * g.W + Math.sin(ph) * g.U * 10 + t * g.U * 0.6 * f.s) % (g.W + g.U * 20)) - g.U * 10;
      const y = f.y * g.H + Math.sin(ph * 1.7) * g.U * 5;
      const glow = 0.5 + 0.5 * Math.sin(t * 0.7 * f.s + f.p * 3);
      ctx.globalAlpha = 0.25 * glow;
      blob(ctx, x, y, g.U * 1.8, g.U * 1.8);
      ctx.globalAlpha = 0.4 + 0.6 * glow;
      blob(ctx, x, y, g.U * 0.7, g.U * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  function drawDrops(ctx, g) {
    const P = state.pools;
    const D = P.drop;
    ctx.fillStyle = '#c9cdc2';
    const r = g.U * 0.7;
    blob(ctx, g.tx, g.ty + r * 0.6 * P.bead, r * (0.4 + P.bead * 0.5), r * (0.4 + P.bead * 0.8));
    for (let i = 0; i < MAX_DROPS; i++) {
      if (!D.on[i]) continue;
      blob(ctx, g.tx, D.y[i], r * 0.8, r * 1.3);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.front = paintFront(g);
    state.pools = makePools();
    state.flies = makeFlies(rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { drip, ripple } = api.props;
    stepDrops(g, Math.min(dt, 0.1), drip);
    ctx.drawImage(state.back, 0, 0);
    drawShimmer(ctx, g, t);
    drawRings(ctx, g, ripple);
    drawLeaf(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawDrops(ctx, g);
    drawFlies(ctx, g, t);
  }

  Kasuri.run({
    defaults: { drip: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
