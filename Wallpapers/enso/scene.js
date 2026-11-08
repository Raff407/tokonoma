/*
 * 円相 Enso — one large brush circle on pale washi, drawn again and again.
 *
 * The brush is eighteen bristle lines that follow one curve. Each frame paints
 * only the few new segments since the last frame onto a kept layer, so a stroke
 * costs a handful of short paths. Paper, seal, light and ink bleed are baked once.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep, noise2, fbm } = K;

  const PAPER = '#e8dfca';
  const INKS = ['#1e1b19', '#2a2623', '#3a352f', '#5a544b', '#7b7368'];
  const BLEED = '#3d3833';
  const BRISTLES = 18;
  const PERIOD = 16;
  const DRAW = 10;
  const FADE = 5;
  const OFFSET = 6;
  const CHUNK = 6;
  const MAX_STEPS = 900;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintPaper(g, rand, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const d = img.data;
    const base = K.parseColor(PAPER);
    const scale = g.U * 12;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const m = Math.round(fbm(x / scale, y / scale, 3, seed) * 5) / 5;
        const ex = (x / c.width - 0.5) * 2;
        const ey = (y / c.height - 0.5) * 2;
        const vig = Math.round(smoothstep(0.7, 1.5, Math.hypot(ex * 0.9, ey)) * 8) / 8;
        const v = 1 + (m - 0.5) * 0.045 - vig * 0.045;
        const i = (y * c.width + x) * 4;
        d[i] = base[0] * v;
        d[i + 1] = base[1] * v;
        d[i + 2] = base[2] * v;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    paintFibres(ctx, g, rand);
    return c;
  }

  function paintFibres(ctx, g, rand) {
    ctx.lineWidth = Math.max(0.5, g.U * 0.22);
    ctx.lineCap = 'round';
    const count = Math.round(g.W * 0.7);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      const a = rand() * Math.PI;
      const len = g.U * (1.5 + rand() * 5);
      ctx.strokeStyle = rand() < 0.6 ? '#f3ecdc' : '#d3c8ad';
      ctx.globalAlpha = 0.35 + rand() * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintSeal(g, seed) {
    const s = Math.max(8, Math.round(g.U * 9));
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(s, s);
    const red = K.parseColor('#a3361f');
    const light = K.parseColor('#b9472c');
    const paper = K.parseColor(PAPER);
    const inset = Math.max(1.5, s * 0.15);
    const line = 0.5;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const border = Math.min(x + 0.5, y + 0.5, s - x - 0.5, s - y - 0.5);
        const i = (y * s + x) * 4;
        if (border < noise2(x * 0.7, y * 0.7, seed) * 1.2) continue;
        const speck = noise2(x * 1.3, y * 1.3, seed + 5) > 0.8;
        const ring = Math.abs(border - inset) < line;
        const col = ring || speck ? paper : fbm(x * 0.4, y * 0.4, 2, seed + 9) > 0.56 ? light : red;
        d4(img.data, i, col);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function d4(d, i, col) {
    d[i] = col[0];
    d[i + 1] = col[1];
    d[i + 2] = col[2];
    d[i + 3] = 255;
  }

  function paintBleed(g, seed) {
    const s = Math.max(8, Math.ceil(g.U * 20));
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(s, s);
    const ink = K.parseColor(BLEED);
    const half = s / 2;
    const grain = g.U * 2.5;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const d = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
        const edge = 0.6 + (fbm(x / grain, y / grain, 3, seed) - 0.5) * 0.75;
        if (d > edge) continue;
        const i = (y * s + x) * 4;
        d4(img.data, i, ink);
        img.data[i + 3] = d < edge * 0.62 ? 170 : 90;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintLight(g) {
    const s = Math.max(8, Math.ceil(g.U * 60));
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    const glow = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    glow.addColorStop(0, 'rgba(250,246,234,0.55)');
    glow.addColorStop(0.6, 'rgba(250,246,234,0.2)');
    glow.addColorStop(1, 'rgba(250,246,234,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
    return c;
  }

  function makeEnso(g) {
    const canvas = layer(g.W, g.H);
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return {
      canvas,
      ctx,
      off: new Float32Array(BRISTLES),
      tone: new Uint8Array(BRISTLES),
      base: new Float32Array(BRISTLES),
      index: -999,
      s: 0,
    };
  }

  function resetEnso(e, g, index) {
    const rand = K.rng(state.seed + index * 7919);
    e.index = index;
    e.s = 0;
    e.seed = Math.floor(rand() * 100000);
    e.cx = state.cx + (rand() - 0.5) * g.U * 2;
    e.cy = state.cy + (rand() - 0.5) * g.U * 2;
    e.r = state.radius * (0.95 + rand() * 0.08);
    e.dir = rand() < 0.7 ? 1 : -1;
    e.a0 = (0.55 + rand() * 0.35) * Math.PI;
    e.sweep = Math.PI * 2 * (0.86 + rand() * 0.14);
    e.ecc = 0.02 + rand() * 0.04;
    e.tilt = rand() * Math.PI;
    e.wob = 0.01 + rand() * 0.015;
    e.phase = rand() * 6.283;
    e.spiral = (rand() - 0.5) * 0.12;
    e.width = g.U * (6.4 + rand() * 1.6);
    e.length = e.sweep * e.r;
    for (let i = 0; i < BRISTLES; i++) {
      const pick = rand();
      e.off[i] = (i + 0.5) / BRISTLES - 0.5 + (rand() - 0.5) * 0.03;
      e.tone[i] = pick < 0.3 ? 0 : pick < 0.58 ? 1 : pick < 0.78 ? 2 : pick < 0.92 ? 3 : 4;
      e.base[i] = rand() * 0.2;
    }
    e.ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
    pointAt(e, 0, state.pt);
    e.px = state.pt.x;
    e.py = state.pt.y;
  }

  function widthAt(e, s) {
    const press = 1 + 0.22 * (1 - smoothstep(0, 0.07, s));
    const lift = 1 - 0.68 * smoothstep(0.7, 1, s);
    const swell = 1 + 0.08 * Math.sin(s * 7.2 + e.phase);
    return e.width * press * lift * swell;
  }

  function pointAt(e, s, out) {
    const th = e.a0 + e.dir * e.sweep * s;
    const shape = 1 + e.ecc * Math.cos(2 * (th - e.tilt)) + e.wob * Math.sin(3 * th + e.phase) + e.spiral * (s - 0.5);
    const rr = e.r * shape;
    out.nx = Math.cos(th);
    out.ny = Math.sin(th);
    out.x = e.cx + out.nx * rr;
    out.y = e.cy + out.ny * rr;
    out.w = widthAt(e, s);
  }

  function bristleOn(e, i, s, dry) {
    const n = noise2((s * e.length) / state.streak, i * 5.3 + 0.37, e.seed);
    const late = smoothstep(0.3, 1, s);
    const edge = Math.abs(e.off[i]) * 2;
    return n > (0.05 + e.base[i] + late * 0.55 + edge * (0.08 + late * 0.3)) * dry;
  }

  function paintPool(e) {
    const p = state.pt;
    pointAt(e, 0, p);
    const ctx = e.ctx;
    const back = -e.dir * p.w * 0.18;
    ctx.fillStyle = INKS[0];
    ctx.beginPath();
    ctx.ellipse(p.x - p.ny * back, p.y + p.nx * back, p.w * 0.62, p.w * 0.55, Math.atan2(p.ny, p.nx), 0, 6.283);
    ctx.fill();
  }

  function paintChunk(e, s0, ds, n, dry) {
    const pts = state.pts;
    const p = state.pt;
    for (let k = 0; k <= n; k++) {
      pointAt(e, s0 + k * ds, p);
      pts[k * 5] = p.x;
      pts[k * 5 + 1] = p.y;
      pts[k * 5 + 2] = p.nx * p.w;
      pts[k * 5 + 3] = p.ny * p.w;
    }
    const ctx = e.ctx;
    ctx.lineWidth = Math.max(0.7, (p.w / BRISTLES) * 1.4);
    for (let t = 0; t < INKS.length; t++) {
      ctx.strokeStyle = INKS[t];
      ctx.beginPath();
      for (let i = 0; i < BRISTLES; i++) {
        if (e.tone[i] !== t) continue;
        const o = e.off[i];
        for (let k = 1; k <= n; k++) {
          if (!bristleOn(e, i, s0 + k * ds, dry)) continue;
          const a = (k - 1) * 5;
          const b = k * 5;
          ctx.moveTo(pts[a] + pts[a + 2] * o, pts[a + 1] + pts[a + 3] * o);
          ctx.lineTo(pts[b] + pts[b + 2] * o, pts[b + 1] + pts[b + 3] * o);
        }
      }
      ctx.stroke();
    }
  }

  function paintTo(e, target, dry) {
    if (target <= e.s) return;
    if (e.s === 0) paintPool(e);
    const steps = Math.max(1, Math.min(MAX_STEPS, Math.ceil(((target - e.s) * e.length) / state.stepLen)));
    const ds = (target - e.s) / steps;
    for (let k0 = 0; k0 < steps; k0 += CHUNK) {
      paintChunk(e, e.s + k0 * ds, ds, Math.min(CHUNK, steps - k0), dry);
    }
    e.s = target;
  }

  function advance(g, index, dry) {
    if (state.cur.index === index) return;
    if (state.cur.index === index - 1) {
      const spare = state.old;
      state.old = state.cur;
      state.cur = spare;
    } else {
      resetEnso(state.old, g, index - 1);
      paintTo(state.old, 1, dry);
    }
    resetEnso(state.cur, g, index);
  }

  function drawEnso(ctx, e, alpha, age, bleed) {
    if (e.s > 0 && bleed > 0) {
      const grow = lerp(0.45, 1, smoothstep(0, 12, age)) * (0.7 + 0.3 * bleed) * (e.width / (state.g.U * 7));
      const size = state.bleed.width * grow;
      ctx.globalAlpha = alpha * Math.min(1, bleed);
      ctx.drawImage(state.bleed, e.px - size / 2, e.py - size / 2, size, size);
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(e.canvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  function drawLight(ctx, g, t) {
    const w = g.W * 0.9;
    const h = g.H * 1.1;
    const x = g.W * (0.5 + 0.28 * Math.sin(t * 0.021)) - w / 2;
    const y = g.H * (0.45 + 0.1 * Math.sin(t * 0.017 + 1)) - h / 2;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(state.light, x, y, w, h);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.seed = Math.floor(rand() * 100000);
    state.cx = g.W * 0.46;
    state.cy = g.H * 0.49;
    state.radius = g.U * 34;
    state.stepLen = Math.max(0.4, g.U * 0.35);
    state.streak = g.U * 2.2;
    state.pt = { x: 0, y: 0, nx: 0, ny: 0, w: 0 };
    state.pts = new Float32Array((CHUNK + 1) * 5);
    state.paper = paintPaper(g, rand, state.seed);
    state.light = paintLight(g);
    state.bleed = paintBleed(g, state.seed + 11);
    state.seal = paintSeal(g, state.seed + 23);
    state.sealX = Math.min(g.W - state.seal.width - g.U * 4, state.cx + state.radius * 1.32);
    state.sealY = state.cy + state.radius * 0.5;
    state.cur = makeEnso(g);
    state.old = makeEnso(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const clock = t + OFFSET;
    const index = Math.floor(clock / PERIOD);
    const local = clock - index * PERIOD;
    advance(g, index, props.dry);
    const tau = Math.min(1, local / DRAW);
    paintTo(state.cur, lerp(tau, 0.5 - 0.5 * Math.cos(Math.PI * tau), 0.5), props.dry);
    ctx.drawImage(state.paper, 0, 0);
    drawLight(ctx, g, t);
    const fade = 1 - smoothstep(0, FADE, local);
    if (fade > 0.01) drawEnso(ctx, state.old, fade, local + PERIOD, props.bleed);
    drawEnso(ctx, state.cur, 1, local, props.bleed);
    ctx.drawImage(state.seal, state.sealX, state.sealY);
  }

  Kasuri.run({
    defaults: { dry: 1, bleed: 1, ramp: 'kana', cell: 7, invert: true, bg: PAPER, tint: 0.6, gain: 1.05, dither: 0.25, boost: 0.2 },
    maxFps: 24,
    setup,
    draw,
  });
})();
