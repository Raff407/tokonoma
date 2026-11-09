/*
 * 鶯 Uguisu — a bush warbler on a bamboo branch in early spring mist.
 *
 * Sky, far bamboo, the perch with its leaves and a plum branch in flower are baked once.
 * Each frame draws the bird (a few ellipses that sway, flick the tail and sing now and
 * then), one tiling mist strip and a short reused pool of falling petals.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#b4bdbe', '#c8cdc4', '#dcd9c6', '#ebe4cf'];
  const FAR = ['#a9b5a6', '#97a893'];
  const MID = ['#7d9380', '#6c8570'];
  const CULM = { dark: '#46583a', mid: '#5f7545', lit: '#8a9c62', node: '#3a4a30' };
  const LEAF = ['#3f5434', '#566c3e', '#748a4c'];
  const BARK = '#2e2622';
  const WHITE = { petal: '#f5eee0', shade: '#d9c4bc', heart: '#c4553f', gold: '#d6a844' };
  const BIRD = {
    back: '#6c6a38', head: '#7a7843', wing: '#55532d', tail: '#46441f',
    belly: '#d3ccaf', stripe: '#ebe3c6', eye: '#1f1a17', beak: '#3d322a', leg: '#a08c70',
  };
  const PETAL_TONES = ['#f5eee0', '#e5c9c0', '#c4553f'];
  const MAX_PETALS = 40;
  const PETALS = 18;
  const SING = 8;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    const p0 = [-U * 5, H * 0.8];
    const p1 = [W * 0.95, H * 0.62];
    const bx = W * 0.5;
    const slope = (p1[1] - p0[1]) / (p1[0] - p0[0]);
    const by = p0[1] + (bx - p0[0]) * slope;
    return { W, H, U, u, p0, p1, slope, bx, by, half: u * 1.5 };
  }

  // ---- sky and far bamboo ----------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.9)) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[Math.min(inks.length - 1, k + (rand() < f - k ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function stalk(ctx, g, x, w, ink, lean) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x, g.H + 2);
    ctx.lineTo(x + lean, -2);
    ctx.lineTo(x + lean + w, -2);
    ctx.lineTo(x + w, g.H + 2);
    ctx.fill();
  }

  function sprig(ctx, x, y, len, ink, flip) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 4; i++) {
      const a = (-0.35 + i * 0.5) * flip + (flip < 0 ? Math.PI : 0);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len * 0.7 + len * 0.25;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 - len * 0.18, ex, ey);
      ctx.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 + len * 0.12, x, y);
      ctx.fill();
    }
  }

  function paintGrove(ctx, g, rand) {
    const rows = [
      { n: 9, ink: FAR[0], w: 1.5, leaf: FAR[1], mist: 0.3 },
      { n: 6, ink: MID[0], w: 2.1, leaf: MID[1], mist: 0.12 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.n; i++) {
        const x = (g.W * (i + 0.2 + rand() * 0.6)) / row.n;
        const lean = (rand() - 0.5) * g.U * 4;
        const w = g.U * row.w;
        stalk(ctx, g, x, w, row.ink, lean);
        ctx.fillStyle = row.leaf;
        for (let y = g.H * (0.1 + rand() * 0.1); y < g.H; y += g.U * (13 + rand() * 6)) {
          const nx = x + lean * (1 - y / g.H);
          ctx.fillRect(nx - 0.4, y, w + 0.8, Math.max(1, g.U * 0.5));
        }
        for (let k = 0; k < 3; k++) {
          const y = g.H * (0.04 + rand() * 0.4);
          const nx = x + lean * (1 - y / g.H) + w / 2;
          sprig(ctx, nx, y, g.U * (6 + rand() * 4), row.leaf, rand() < 0.5 ? 1 : -1);
        }
      }
      ctx.fillStyle = SKY[2];
      ctx.globalAlpha = row.mist;
      ctx.fillRect(0, 0, g.W, g.H);
      ctx.globalAlpha = 1;
    }
  }

  // ---- perch bamboo -----------------------------------------------------------

  function culmAt(g, x) {
    return g.p0[1] + (x - g.p0[0]) * g.slope;
  }

  function paintCulm(ctx, g, rand) {
    const half = g.half;
    const len = g.p1[0] - g.p0[0];
    const ang = Math.atan(g.slope);
    ctx.save();
    ctx.translate(g.p0[0], g.p0[1]);
    ctx.rotate(ang);
    const L = len / Math.cos(ang);
    ctx.fillStyle = CULM.dark;
    ctx.fillRect(0, -half, L, half * 2);
    ctx.fillStyle = CULM.mid;
    ctx.fillRect(0, -half, L, half * 1.3);
    ctx.fillStyle = CULM.lit;
    ctx.fillRect(0, -half, L, half * 0.5);
    ctx.fillStyle = CULM.node;
    for (let x = g.u * 9; x < L; x += g.u * (22 + rand() * 6)) {
      ctx.fillRect(x, -half - g.u * 0.35, g.u * 1.1, half * 2 + g.u * 0.7);
    }
    ctx.restore();
  }

  function paintLeaves(ctx, g, rand) {
    const spots = [0.1, 0.24, 0.38, 0.68, 0.8, 0.92];
    for (const f of spots) {
      const x = lerp(g.p0[0], g.p1[0], f);
      const y = culmAt(g, x);
      const flip = f > 0.5 ? -1 : 1;
      const lift = g.u * (3 + rand() * 4);
      ctx.strokeStyle = CULM.dark;
      ctx.lineWidth = Math.max(1, g.u * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + flip * g.u * 4, y + lift);
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        sprig(ctx, x + flip * g.u * 4, y + lift, g.u * (8 + k * 2), LEAF[k], flip);
      }
    }
  }

  // ---- plum branch ------------------------------------------------------------

  function flower(ctx, x, y, r, rot) {
    ctx.fillStyle = WHITE.shade;
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * TAU) / 5;
      blob(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.55, r * 0.55);
    }
    ctx.fillStyle = WHITE.petal;
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * TAU) / 5;
      blob(ctx, x + Math.cos(a) * r * 0.58 - r * 0.06, y + Math.sin(a) * r * 0.58 - r * 0.06, r * 0.46, r * 0.46);
    }
    ctx.fillStyle = WHITE.heart;
    blob(ctx, x, y, r * 0.3, r * 0.3);
    ctx.fillStyle = WHITE.gold;
    blob(ctx, x - r * 0.08, y - r * 0.08, r * 0.14, r * 0.14);
  }

  function paintPlum(ctx, g, rand) {
    const U = g.U;
    const P = [g.W + U * 3, U * 6, g.W * 0.9, U * 2, g.W * 0.78, U * 20, g.W * 0.64, U * 26];
    ctx.strokeStyle = BARK;
    ctx.lineCap = 'round';
    const pts = [];
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = U * (2.1 - k * 0.6);
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const t = lerp(k * 0.25, 1, i / 16);
        const m = 1 - t;
        const x = m * m * m * P[0] + 3 * m * m * t * P[2] + 3 * m * t * t * P[4] + t * t * t * P[6];
        const y = m * m * m * P[1] + 3 * m * m * t * P[3] + 3 * m * t * t * P[5] + t * t * t * P[7];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        if (k === 0 && i % 3 === 1) pts.push(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, U * 0.6);
    const blooms = [];
    for (let i = 0; i < pts.length; i += 2) {
      const tx = pts[i] - U * (2 + rand() * 6);
      const ty = pts[i + 1] + U * (3 + rand() * 7);
      ctx.beginPath();
      ctx.moveTo(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(lerp(pts[i], tx, 0.4), ty - U, tx, ty);
      ctx.stroke();
      blooms.push(tx, ty);
    }
    for (let i = 0; i < blooms.length; i += 2) {
      for (let k = 0; k < 3; k++) {
        flower(ctx, blooms[i] + (rand() - 0.5) * U * 5, blooms[i + 1] + (rand() - 0.3) * U * 4, U * (1.7 + rand() * 0.8), rand() * TAU);
      }
    }
  }

  // ---- mist ------------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.22);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 5), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 232;
        img.data[i + 2] = 218;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 1.0) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.3);
    ctx.drawImage(m, w - a, g.H * 0.3);
    const b = (t * g.U * 0.55 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.55);
    ctx.drawImage(m, b - w, g.H * 0.68);
    ctx.drawImage(m, b, g.H * 0.68);
    ctx.globalAlpha = 1;
  }

  // ---- bird ------------------------------------------------------------------

  // Local frame: bird faces right, feet at the origin, y up is negative.
  function drawBird(ctx, g, t) {
    const s = g.U * 2.3;
    const cyc = t % SING;
    const song = cyc < 3 ? Math.sin((cyc / 3) * Math.PI) : 0;
    const trill = song > 0.2 ? Math.sin(t * 22) * 0.5 + 0.5 : 0;
    const sway = Math.sin(t * 1.3) * 0.02;
    const flick = Math.sin(t * 2.4) * 0.05 + (Math.sin(t * 0.7) > 0.93 ? 0.25 : 0);
    const tilt = Math.atan(g.slope) + sway - song * 0.12;
    ctx.save();
    ctx.translate(g.bx, g.by - g.half);
    ctx.rotate(tilt);
    ctx.fillStyle = BIRD.leg;
    ctx.fillRect(-0.9 * s, -0.9 * s, 0.3 * s, 0.9 * s);
    ctx.fillRect(0.5 * s, -0.9 * s, 0.3 * s, 0.9 * s);
    ctx.save();
    ctx.translate(-3.2 * s, -2.4 * s);
    ctx.rotate(0.35 + flick - song * 0.15);
    ctx.fillStyle = BIRD.tail;
    ctx.beginPath();
    ctx.moveTo(0, -0.7 * s);
    ctx.lineTo(-6.4 * s, -0.5 * s);
    ctx.lineTo(-6.4 * s, 0.6 * s);
    ctx.lineTo(0, 1 * s);
    ctx.fill();
    ctx.restore();
    ctx.rotate(-song * 0.1);
    ctx.fillStyle = BIRD.back;
    blob(ctx, 0, -3.1 * s, 4.1 * s, 2.7 * s, -0.12);
    ctx.fillStyle = BIRD.belly;
    blob(ctx, 0.6 * s, -2.4 * s, 3.2 * s, 1.7 * s, 0.1);
    ctx.fillStyle = BIRD.wing;
    blob(ctx, -1 * s, -3.5 * s, 3 * s, 1.5 * s, 0.2);
    const hx = 3.1 * s;
    const hy = (-5.2 - song * 0.9) * s;
    ctx.translate(hx, hy);
    ctx.rotate(-song * 0.4);
    ctx.fillStyle = BIRD.head;
    blob(ctx, 0, 0, 1.9 * s, 1.7 * s);
    ctx.fillStyle = BIRD.stripe;
    ctx.fillRect(-0.6 * s, -0.7 * s, 2.3 * s, 0.35 * s);
    ctx.fillStyle = BIRD.eye;
    blob(ctx, 0.6 * s, -0.3 * s, 0.32 * s, 0.32 * s);
    ctx.fillStyle = BIRD.beak;
    const gape = trill * 0.7 * s;
    ctx.beginPath();
    ctx.moveTo(1.6 * s, -0.5 * s);
    ctx.lineTo(3.2 * s, -0.2 * s - gape * 0.4);
    ctx.lineTo(1.7 * s, 0.1 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.6 * s, 0.1 * s);
    ctx.lineTo(3 * s, 0.35 * s + gape);
    ctx.lineTo(1.6 * s, 0.7 * s);
    ctx.fill();
    ctx.restore();
  }

  // ---- petals ----------------------------------------------------------------

  function makePetals() {
    const f = () => new Float32Array(MAX_PETALS);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), tone: f() };
  }

  function resetPetal(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = scatter ? r() * g.W : g.W * (0.55 + r() * 0.45);
    L.y[i] = scatter ? r() * g.H : g.H * 0.12 - g.U * 20 * r();
    L.vy[i] = g.U * (2.2 + r() * 2);
    L.vx[i] = -g.U * (0.6 + r() * 1.4);
    L.size[i] = g.U * (1.2 + r() * 0.8);
    L.tone[i] = r() < 0.75 ? (r() < 0.6 ? 0 : 1) : 2;
    L.spin[i] = (r() - 0.5) * 4;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
  }

  function drawPetals(ctx, g, t, dt, count) {
    const L = state.petals;
    for (let i = 0; i < count; i++) {
      L.y[i] += L.vy[i] * dt;
      L.x[i] += (L.vx[i] + Math.sin(t * 1.3 + L.p[i]) * g.U * 1.6) * dt;
      L.a[i] += L.spin[i] * dt;
      if (L.y[i] > g.H + g.U * 2 || L.x[i] < -g.U * 3) resetPetal(g, L, i, false);
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + L.p[i]));
      const sz = L.size[i];
      ctx.fillStyle = PETAL_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = layer(g.W, g.H);
    const bctx = state.back.getContext('2d');
    paintSky(bctx, g, rand);
    paintGrove(bctx, g, rand);
    paintCulm(bctx, g, rand);
    paintLeaves(bctx, g, rand);
    paintPlum(bctx, g, rand);
    state.mist = paintMist(g);
    state.petals = makePetals();
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, mist } = api.props;
    const pc = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    drawBird(ctx, g, t);
    drawPetals(ctx, g, t, step, pc);
  }

  Kasuri.run({
    defaults: { petals: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
