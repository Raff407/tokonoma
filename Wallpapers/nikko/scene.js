/*
 * 日光 Nikko — an ornate shrine gate among tall cedars, in mist.
 *
 * Sky and far cedars, the near cedars with the gate, and the stone steps with lanterns
 * are baked once. Mist is one tiling strip, light rays are one baked layer that breathes
 * slowly, and cedar needles are a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const SKY = ['#a3b2aa', '#b7c1b3', '#cbcfba', '#dcd8bd'];
  const FAR = ['#8b9c92', '#9aa99c'];
  const CEDAR = ['#23372b', '#35503a', '#4f6f47'];
  const BARK = '#5a4333';
  const RED = { dark: '#8e3426', mid: '#b4402c', lit: '#c85a3c' };
  const GOLD = { mid: '#c8a24a', lit: '#e6c978', dark: '#8f7330' };
  const WHITE = '#e4dfcb';
  const WHITE_SHADE = '#b9b49f';
  const LACQUER = { body: '#2c2825', row: '#3e3934', edge: '#1c1917' };
  const STONE = { top: '#a9aea6', riser: '#6b7168', dark: '#4c5249' };
  const MOSS = ['#2f3f28', '#475f30', '#627b3c'];
  const NEEDLE_TONES = ['#d9cf9e', '#c3b57c', '#a49a62'];
  const MAX_NEEDLES = 40;
  const NEEDLES = 22;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const u = Math.min(H / 70, W / 118);
    return { W, H, u, cx: W * 0.5, by: Math.round(H * 0.83) };
  }

  // ---- sky and cedars ------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.8)) * (inks.length - 1);
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

  function cedar(ctx, x, yb, h, w, inks, trunk) {
    const top = yb - h;
    const fh = h * 0.86;
    const n = Math.max(5, Math.round(h / (w * 0.55)));
    ctx.fillStyle = trunk;
    ctx.fillRect(x - w * 0.1, top + fh * 0.5, Math.max(2, w * 0.2), yb - top - fh * 0.5);
    for (let t = 0; t < n; t++) {
      const f = t / (n - 1);
      const y0 = top + f * fh * 0.9;
      const hw = w * 0.5 * (0.22 + 0.78 * f);
      const th = (fh / n) * 2.1;
      ctx.fillStyle = inks[0];
      poly(ctx, [x, y0, x + hw, y0 + th, x - hw, y0 + th]);
      if (inks[1]) {
        ctx.fillStyle = inks[1];
        poly(ctx, [x, y0 + th * 0.12, x - hw * 0.92, y0 + th * 0.94, x - hw * 0.05, y0 + th * 0.94]);
      }
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    const rows = [
      { y: g.by - g.u * 14, h: g.H * 0.95, w: g.u * 6, inks: [FAR[0]], trunk: FAR[0], step: g.u * 9 },
      { y: g.by - g.u * 8, h: g.H * 0.98, w: g.u * 8, inks: [FAR[1], '#a6b3a4'], trunk: FAR[1], step: g.u * 12 },
    ];
    for (const r of rows) {
      for (let x = -r.w; x < g.W + r.w; x += r.step * (0.8 + rand() * 0.5)) {
        const s = 0.85 + rand() * 0.3;
        cedar(ctx, x, r.y, r.h * s, r.w * s, r.inks, r.trunk);
      }
    }
    ctx.fillStyle = '#6f8478';
    ctx.fillRect(0, g.by - g.u * 5, g.W, g.u * 6);
    return c;
  }

  // ---- the gate ------------------------------------------------------------

  function bracketRow(ctx, g, x0, x1, y, h) {
    const u = g.u;
    const tones = [RED.mid, WHITE, '#4a6b78', GOLD.mid, WHITE, RED.mid];
    let i = 0;
    for (let x = x0; x < x1; x += u * 1.8, i++) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.fillRect(x, y, u * 1.5, h);
    }
  }

  function carvedPanel(ctx, g, x0, x1, y0, y1, rand) {
    const u = g.u;
    ctx.fillStyle = WHITE;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = WHITE_SHADE;
    ctx.fillRect(x0, y1 - u * 0.5, x1 - x0, u * 0.5);
    const hues = ['#4a6b78', '#5f7f56', GOLD.mid, RED.mid, '#7a6b9a'];
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = hues[Math.floor(rand() * hues.length)];
      const w = u * (0.9 + rand() * 1.4);
      const h = u * (0.8 + rand() * 1.1);
      ctx.fillRect(lerp(x0 + u * 0.4, x1 - w - u * 0.4, rand()), lerp(y0 + u * 0.4, y1 - h - u * 0.8, rand()), w, h);
    }
    ctx.fillStyle = GOLD.lit;
    ctx.fillRect(x0, y0, x1 - x0, Math.max(1, u * 0.35));
  }

  function pillar(ctx, g, x, y0, y1) {
    const w = g.u * 1.9;
    ctx.fillStyle = RED.mid;
    ctx.fillRect(x - w / 2, y0, w, y1 - y0);
    ctx.fillStyle = RED.lit;
    ctx.fillRect(x - w / 2, y0, Math.max(1, w * 0.3), y1 - y0);
    ctx.fillStyle = RED.dark;
    ctx.fillRect(x + w * 0.25, y0, w * 0.25, y1 - y0);
    ctx.fillStyle = GOLD.mid;
    ctx.fillRect(x - w * 0.6, y0, w * 1.2, Math.max(1, g.u * 0.6));
    ctx.fillRect(x - w * 0.6, y1 - g.u * 1.1, w * 1.2, Math.max(1, g.u * 0.6));
  }

  function eaveEdge(hw, lift, x) {
    const d = Math.max(0, (Math.abs(x) - hw * 0.5) / (hw * 0.5));
    return -lift * d * d;
  }

  // A tiled roof seen from the front: lifted eave at both ends, tapering to the ridge.
  function roof(ctx, g, cx, ye, hw, rw, rise, lift, thick) {
    const u = g.u;
    const top = ye - rise;
    const pts = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const x = lerp(-hw, hw, i / n);
      pts.push(cx + x, ye + eaveEdge(hw, lift, x));
    }
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      pts.push(cx + hw - (hw - rw) * Math.pow(f, 0.6), ye - lift - (rise - lift) * f);
    }
    for (let i = 8; i >= 0; i--) {
      const f = i / 8;
      pts.push(cx - hw + (hw - rw) * Math.pow(f, 0.6), ye - lift - (rise - lift) * f);
    }
    ctx.fillStyle = LACQUER.body;
    poly(ctx, pts);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = LACQUER.row;
    for (let y = top + u * 0.6; y < ye + 2; y += u * 1.3) ctx.fillRect(cx - hw, y, hw * 2, Math.max(1, u * 0.3));
    ctx.fillStyle = LACQUER.edge;
    ctx.fillRect(cx - hw, top, hw * 2, Math.max(1, u * 0.6));
    ctx.restore();
    const edge = [];
    for (let i = 0; i <= n; i++) {
      const x = lerp(-hw, hw, i / n);
      edge.push(cx + x, ye + eaveEdge(hw, lift, x) - thick);
    }
    for (let i = n; i >= 0; i--) {
      const x = lerp(-hw, hw, i / n);
      edge.push(cx + x, ye + eaveEdge(hw, lift, x));
    }
    ctx.fillStyle = GOLD.dark;
    poly(ctx, edge);
    ctx.fillStyle = GOLD.lit;
    ctx.fillRect(cx - hw * 0.5, ye - thick, hw, Math.max(1, thick * 0.4));
  }

  function ridgeEnds(ctx, g, cx, y, rw) {
    const u = g.u;
    for (const s of [-1, 1]) {
      const x = cx + s * rw;
      ctx.fillStyle = GOLD.mid;
      poly(ctx, [x - u * 1.2, y + u * 0.8, x + u * 1.2, y + u * 0.8, x + s * u * 1.4, y - u * 2.6, x - s * u * 0.2, y - u * 1.4]);
      ctx.fillStyle = GOLD.lit;
      ctx.fillRect(x - u * 0.3, y - u * 1.2, Math.max(1, u * 0.6), u * 1.8);
    }
    ctx.fillStyle = GOLD.dark;
    ctx.fillRect(cx - rw, y + u * 0.5, rw * 2, Math.max(1, u * 0.6));
  }

  function gateGround(ctx, g, rand) {
    const u = g.u;
    ctx.fillStyle = MOSS[0];
    ctx.fillRect(0, g.by - u * 1.2, g.W, g.H - g.by + u * 1.2);
    for (let i = 0; i < g.W * 0.6; i++) {
      ctx.fillStyle = MOSS[1 + (rand() < 0.35 ? 1 : 0)];
      blob(ctx, rand() * g.W, g.by - u * 1.2 + rand() * (g.H - g.by + u), u * (0.5 + rand() * 1.6), u * (0.25 + rand() * 0.5));
    }
  }

  function paintGate(ctx, g, rand) {
    const u = g.u;
    const cx = g.cx;
    const by = g.by;
    const floorTop = by - u * 14;
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(cx - u * 24, by - u * 1.6, u * 48, u * 1.6);
    ctx.fillStyle = STONE.top;
    ctx.fillRect(cx - u * 24, by - u * 1.6, u * 48, Math.max(1, u * 0.5));
    // lower storey: white carved walls, dark doorway
    carvedPanel(ctx, g, cx - u * 20, cx - u * 8, floorTop, by - u * 1.6, rand);
    carvedPanel(ctx, g, cx + u * 8, cx + u * 20, floorTop, by - u * 1.6, rand);
    ctx.fillStyle = '#1d1815';
    ctx.fillRect(cx - u * 8, floorTop, u * 16, by - u * 1.6 - floorTop);
    ctx.fillStyle = '#2d2620';
    ctx.fillRect(cx - u * 8, by - u * 5, u * 16, u * 3.4);
    ctx.fillStyle = GOLD.dark;
    ctx.fillRect(cx - u * 8, floorTop, u * 16, Math.max(1, u * 0.8));
    for (const x of [-20, -8, 8, 20]) pillar(ctx, g, cx + u * x, floorTop, by - u * 1.6);
    // brackets and lower eave
    ctx.fillStyle = RED.dark;
    ctx.fillRect(cx - u * 22, floorTop - u * 1.4, u * 44, u * 1.4);
    bracketRow(ctx, g, cx - u * 22, cx + u * 22, floorTop - u * 3.2, u * 1.8);
    roof(ctx, g, cx, floorTop - u * 4, u * 27, u * 22, u * 5.5, u * 1.8, u * 1.1);
    // upper storey: white wall, red posts, gold rail
    const upBase = floorTop - u * 4 - u * 5.5 + u * 0.4;
    const upTop = upBase - u * 8;
    ctx.fillStyle = WHITE;
    ctx.fillRect(cx - u * 15, upTop, u * 30, upBase - upTop);
    ctx.fillStyle = WHITE_SHADE;
    ctx.fillRect(cx - u * 15, upBase - u * 0.8, u * 30, u * 0.8);
    ctx.fillStyle = '#4a6b78';
    ctx.fillRect(cx - u * 11, upTop + u * 1.6, u * 5, u * 3);
    ctx.fillRect(cx + u * 6, upTop + u * 1.6, u * 5, u * 3);
    ctx.fillStyle = GOLD.mid;
    ctx.beginPath();
    ctx.arc(cx, upTop + u * 3.4, u * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RED.mid;
    ctx.beginPath();
    ctx.arc(cx, upTop + u * 3.4, u * 1.2, 0, Math.PI * 2);
    ctx.fill();
    for (const x of [-15, -5, 5, 15]) pillar(ctx, g, cx + u * x, upTop, upBase);
    ctx.fillStyle = RED.mid;
    ctx.fillRect(cx - u * 16.5, upBase - u * 2, u * 33, u * 1);
    ctx.fillStyle = GOLD.mid;
    for (let x = -16; x <= 16; x += 4) ctx.fillRect(cx + u * x - u * 0.3, upBase - u * 2.6, Math.max(1, u * 0.7), u * 2.6);
    bracketRow(ctx, g, cx - u * 17, cx + u * 17, upTop - u * 2.2, u * 1.6);
    ctx.fillStyle = RED.dark;
    ctx.fillRect(cx - u * 17, upTop - u * 0.8, u * 34, u * 0.8);
    // main roof and gilded ridge
    const ye = upTop - u * 3.4;
    roof(ctx, g, cx, ye, u * 24, u * 14, u * 11, u * 2.2, u * 1.3);
    ridgeEnds(ctx, g, cx, ye - u * 11, u * 14);
  }

  // ---- mid cedars and ground ----------------------------------------------

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.u;
    const slots = [];
    for (let x = u * 2; x < g.W; x += u * 11 * (0.85 + rand() * 0.5)) {
      if (Math.abs(x - g.cx) > u * 33) slots.push(x);
    }
    for (const x of slots) {
      const s = 0.9 + rand() * 0.25;
      cedar(ctx, x, g.by - u * 2, g.H * 0.97 * s, u * 11 * s, CEDAR, BARK);
    }
    gateGround(ctx, g, rand);
    paintGate(ctx, g, rand);
    return c;
  }

  // ---- steps, lanterns, near trunks ---------------------------------------

  function lantern(ctx, g, x, y) {
    const u = g.u;
    ctx.fillStyle = STONE.riser;
    ctx.fillRect(x - u * 2.4, y - u * 1.2, u * 4.8, u * 1.2);
    ctx.fillStyle = STONE.top;
    ctx.fillRect(x - u * 0.9, y - u * 5, u * 1.8, u * 3.8);
    ctx.fillRect(x - u * 2, y - u * 6.2, u * 4, u * 1.2);
    ctx.fillStyle = STONE.riser;
    ctx.fillRect(x - u * 1.7, y - u * 9, u * 3.4, u * 2.8);
    ctx.fillStyle = GOLD.lit;
    ctx.fillRect(x - u * 0.9, y - u * 8.3, u * 1.8, u * 1.5);
    ctx.fillStyle = STONE.dark;
    poly(ctx, [x - u * 3.4, y - u * 9, x + u * 3.4, y - u * 9, x + u * 1.6, y - u * 11.2, x - u * 1.6, y - u * 11.2]);
    ctx.fillStyle = STONE.top;
    ctx.fillRect(x - u * 0.5, y - u * 12.2, u, u * 1.2);
  }

  function steps(ctx, g, rand) {
    const u = g.u;
    const n = 5;
    const sh = (g.H - g.by) / n;
    for (let i = 0; i < n; i++) {
      const y = g.by + i * sh;
      const hw = u * (13 + i * 2.2);
      ctx.fillStyle = STONE.top;
      ctx.fillRect(g.cx - hw, y, hw * 2, sh);
      ctx.fillStyle = STONE.riser;
      ctx.fillRect(g.cx - hw, y + sh * 0.62, hw * 2, sh * 0.38);
      ctx.fillStyle = STONE.dark;
      ctx.fillRect(g.cx - hw, y + sh - 1, hw * 2, 1);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = MOSS[1 + (rand() < 0.4 ? 1 : 0)];
        blob(ctx, g.cx + (rand() * 2 - 1) * hw, y + sh * (0.2 + rand() * 0.7), u * (0.6 + rand() * 1.2), u * 0.3);
      }
    }
  }

  function nearTrunk(ctx, g, x, w, rand) {
    ctx.fillStyle = BARK;
    ctx.fillRect(x - w / 2, 0, w, g.H);
    ctx.fillStyle = '#7a5a43';
    ctx.fillRect(x - w / 2, 0, Math.max(1, w * 0.25), g.H);
    ctx.fillStyle = '#3c2c22';
    for (let i = 0; i < 5; i++) ctx.fillRect(x - w / 2 + rand() * w, 0, Math.max(1, w * 0.08), g.H);
    ctx.fillStyle = CEDAR[0];
    for (let i = 0; i < 7; i++) {
      const y = g.H * 0.04 + i * g.H * 0.04;
      const hw = w * (2.6 - i * 0.2);
      poly(ctx, [x - hw, y + g.u * 3, x, y - g.u * 1, x + hw, y + g.u * 3]);
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.u;
    steps(ctx, g, rand);
    lantern(ctx, g, g.cx - u * 31, g.by + u * 0.2);
    lantern(ctx, g, g.cx + u * 31, g.by + u * 0.2);
    nearTrunk(ctx, g, g.W * 0.03, u * 5.5, rand);
    nearTrunk(ctx, g, g.W * 0.97, u * 5.5, rand);
    return c;
  }

  // ---- light and mist ------------------------------------------------------

  function paintRays(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const specs = [[0.18, 0.1, 0.05], [0.34, 0.07, 0.035], [0.62, 0.12, 0.05], [0.8, 0.06, 0.03]];
    for (const [x, w, a] of specs) {
      ctx.fillStyle = 'rgba(240,226,176,' + a + ')';
      const x0 = g.W * x;
      for (let k = 0; k < 3; k++) {
        const ww = g.W * w * (1 - k * 0.3);
        poly(ctx, [x0, 0, x0 + ww, 0, x0 + ww + g.W * 0.2, g.by, x0 + g.W * 0.2 + ww * 0.1, g.by]);
      }
    }
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.u * 14), y / (g.u * 4), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.6, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 228;
        img.data[i + 2] = 214;
        img.data[i + 3] = a * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function band(ctx, g, t, y, speed, offset, alpha) {
    const m = state.mist;
    const w = m.width;
    const a = (t * g.u * speed + offset * w) % w;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(m, -a, y);
    ctx.drawImage(m, w - a, y);
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    band(ctx, g, t, g.H * 0.22, 0.9, 0, mist * 0.55);
    band(ctx, g, t, g.H * 0.46, 0.5, 0.4, mist * 0.45);
    ctx.globalAlpha = 1;
  }

  function drawLowMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    band(ctx, g, t, g.by - g.H * 0.12, 0.7, 0.7, mist * 0.5);
    ctx.globalAlpha = 1;
  }

  // ---- needles -------------------------------------------------------------

  function makeNeedles(g, rand) {
    const f = () => new Float32Array(MAX_NEEDLES);
    const N = { x: f(), y: f(), vy: f(), sway: f(), ph: f(), tone: f() };
    for (let i = 0; i < MAX_NEEDLES; i++) {
      N.x[i] = rand() * g.W;
      N.y[i] = rand() * g.H;
      N.vy[i] = g.u * (1.2 + rand() * 1.6);
      N.sway[i] = g.u * (0.6 + rand() * 1.4);
      N.ph[i] = rand() * 6.28;
      N.tone[i] = Math.floor(rand() * NEEDLE_TONES.length);
    }
    return N;
  }

  function drawNeedles(ctx, g, t, dt, count) {
    const N = state.needles;
    for (let i = 0; i < count; i++) {
      N.y[i] += N.vy[i] * dt;
      if (N.y[i] > g.H) {
        N.y[i] = -2;
        N.x[i] = state.rand() * g.W;
      }
      const x = N.x[i] + Math.sin(t * 0.8 + N.ph[i]) * N.sway[i];
      ctx.fillStyle = NEEDLE_TONES[N.tone[i]];
      ctx.fillRect(x, N.y[i], 2, 1);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.world = paintWorld(g, rand);
    state.front = paintFront(g, rand);
    state.rays = paintRays(g);
    state.mist = paintMist(g);
    state.needles = makeNeedles(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, rays, needles } = api.props;
    const count = Math.min(MAX_NEEDLES, Math.round(NEEDLES * needles));
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.world, 0, 0);
    if (rays > 0) {
      ctx.globalAlpha = Math.min(1, rays * (0.75 + 0.25 * Math.sin(t * 0.35)));
      ctx.drawImage(state.rays, 0, 0);
      ctx.globalAlpha = 1;
    }
    drawLowMist(ctx, g, t, mist);
    ctx.drawImage(state.front, 0, 0);
    drawNeedles(ctx, g, t, Math.min(dt, 0.1), count);
  }

  Kasuri.run({
    defaults: { mist: 1, rays: 1, needles: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
