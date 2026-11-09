/*
 * かずら橋 Kazurabashi — the vine bridge of Iya across a deep green gorge.
 *
 * Sky, ridges, cliffs, cedars and the river are baked once. Only the bridge is redrawn
 * each frame: a sagging deck of planks with two hand vines that swing a little.
 * Mist is a tiling strip that drifts; a few maple leaves fall from the left cliff.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const SKY = ['#a9b4b0', '#c2c7bb', '#dad5bd', '#e6dcc0'];
  const RIDGES = ['#8c9f9b', '#6f8884', '#53706a'];
  const CEDAR = ['#1f3a2b', '#2c4a35', '#3f6040'];
  const MOSS = ['#2d4a30', '#4a6a3a', '#6d8a48'];
  const ROCK = ['#2b3c30', '#4a5a48', '#7a7a68'];
  const LEAF_TONES = ['#b4432a', '#d96c3a', '#e2ad50', '#8a3022'];
  const VINE = '#4a3f2a';
  const PLANK = ['#7b6145', '#9a7b58', '#5a4636'];
  const SLATS = 34;
  const MAX_LEAVES = 16;
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
    const lx = W * 0.22;
    const rx = W * 0.78;
    return { W, H, U, lx, rx, ly: H * 0.47, ry: H * 0.45, river: H * 0.97 };
  }

  // cliff edges lean in as they go down, so the gorge narrows to the river
  function edgeL(g, y) {
    return g.lx + (y - g.ly) * 0.1 + (fbm(y / (g.U * 14), 2.2, 3, 5) - 0.5) * g.U * 7;
  }

  function edgeR(g, y) {
    return g.rx - (y - g.ry) * 0.1 - (fbm(y / (g.U * 14), 6.1, 3, 8) - 0.5) * g.U * 7;
  }

  function topL(g, x) {
    return g.ly - g.U * 1.5 + (fbm(x / (g.U * 9), 1.7, 3, 12) - 0.5) * g.U * 5 - Math.max(0, x - g.lx * 0.6) * 0.05;
  }

  function topR(g, x) {
    return g.ry - g.U * 1.5 + (fbm(x / (g.U * 9), 3.4, 3, 14) - 0.5) * g.U * 5 - Math.max(0, g.rx * 1.3 - x) * 0.05;
  }

  // ---- sky, ridges, gorge ----------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.55)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#c9553a';
    ctx.globalAlpha = 0.55;
    blob(ctx, g.W * 0.5, g.H * 0.2, g.U * 5, g.U * 5);
    ctx.globalAlpha = 1;
  }

  function ridge(ctx, g, rand, base, amp, ink, seed, cedars) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    const pts = [];
    for (let x = 0; x <= g.W + 3; x += 3) {
      const y = base + (fbm(x / (g.U * 28), seed, 4, seed) - 0.5) * amp;
      pts.push(x, y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    if (!cedars) return;
    ctx.fillStyle = ink;
    for (let x = 0; x < g.W; x += g.U * (1.2 + rand() * 1.6)) {
      const y = pts[Math.min(pts.length - 1, Math.floor(x / 3) * 2 + 1)];
      const h = g.U * (3 + rand() * 3);
      ctx.beginPath();
      ctx.moveTo(x - g.U * 0.7, y + 1);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + g.U * 0.7, y + 1);
      ctx.fill();
    }
  }

  function paintGorge(ctx, g, rand) {
    const y0 = g.ly;
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, '#5c7a6a');
    grad.addColorStop(0.5, '#33503f');
    grad.addColorStop(1, '#1c3128');
    ctx.fillStyle = grad;
    ctx.fillRect(g.lx, y0, g.rx - g.lx, g.H - y0);
    ridge(ctx, g, rand, g.H * 0.6, g.H * 0.12, '#496a5a', 31, false);
    ridge(ctx, g, rand, g.H * 0.72, g.H * 0.1, '#35523f', 37, false);
    // river far below, a pale thread between the foot of the cliffs
    ctx.fillStyle = '#7d9a98';
    const rw = edgeR(g, g.river) - edgeL(g, g.river);
    ctx.fillRect(edgeL(g, g.river), g.river, rw, g.H - g.river);
    ctx.fillStyle = '#dcd6c0';
    for (let i = 0; i < 22; i++) {
      ctx.fillRect(edgeL(g, g.river) + rand() * rw, g.river + rand() * (g.H - g.river), g.U * (1 + rand() * 2), Math.max(1, g.U * 0.35));
    }
  }

  // ---- cliffs and trees ---------------------------------------------------------

  function cedar(ctx, x, y, h, rand) {
    const w = h * 0.13;
    ctx.fillStyle = '#3b2e22';
    ctx.fillRect(x - w * 0.12, y - h * 0.2, w * 0.24, h * 0.2);
    for (let t = 0; t < 3; t++) {
      ctx.fillStyle = CEDAR[t];
      ctx.beginPath();
      const hw = w * (1 - t * 0.28);
      const yb = y - h * 0.08 - t * h * 0.02;
      ctx.moveTo(x - hw, yb);
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const yy = lerp(yb, y - h, f);
        const sx = hw * (1 - f) * (0.75 + 0.35 * ((i % 2) + rand() * 0.2));
        ctx.lineTo(x - sx - hw * 0.1 * (t === 0 ? 1 : 0), yy);
      }
      for (let i = steps; i >= 0; i--) {
        const f = i / steps;
        const yy = lerp(yb, y - h, f);
        const sx = hw * (1 - f) * (0.75 + 0.35 * (((i + 1) % 2) + rand() * 0.2));
        ctx.lineTo(x + sx - (t === 2 ? hw * 0.15 : 0), yy);
      }
      ctx.fill();
    }
  }

  function maple(ctx, g, rand, x, y, r) {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + rand() * Math.PI;
      const d = Math.sqrt(rand()) * r;
      ctx.fillStyle = LEAF_TONES[Math.floor(rand() * 3)];
      blob(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * (0.25 + rand() * 0.2), r * 0.2);
    }
    ctx.fillStyle = '#3b2e22';
    ctx.fillRect(x - g.U * 0.25, y, g.U * 0.5, g.U * 2);
  }

  function cliffBody(ctx, g, rand, side) {
    const edge = side < 0 ? edgeL : edgeR;
    const top = side < 0 ? topL : topR;
    const farX = side < 0 ? -2 : g.W + 2;
    const y0 = side < 0 ? g.ly : g.ry;
    ctx.fillStyle = ROCK[0];
    ctx.beginPath();
    ctx.moveTo(farX, top(g, farX));
    const edgeTop = edge(g, y0);
    for (let x = farX; side < 0 ? x < edgeTop : x > edgeTop; x -= side * 3) ctx.lineTo(x, top(g, x));
    for (let y = y0 - g.U * 1.5; y <= g.H + 3; y += 3) ctx.lineTo(edge(g, y), y);
    ctx.lineTo(farX, g.H);
    ctx.fill();
    // stone bands and moss
    for (let y = y0; y < g.H; y += g.U * 1.3) {
      const e = edge(g, y);
      const wd = g.U * (6 + rand() * 12);
      ctx.fillStyle = rand() < 0.5 ? ROCK[1] : ROCK[2];
      ctx.globalAlpha = 0.5;
      ctx.fillRect(side < 0 ? e - wd : e, y, wd, Math.max(1, g.U * 0.4));
      ctx.globalAlpha = 1;
      const m = g.U * (1 + rand() * 2.4);
      if (rand() < 0.45) cedar(ctx, e - side * g.U * (1 + rand() * 6), y + g.U * 2, g.U * (7 + rand() * 7), rand);
      ctx.fillStyle = MOSS[Math.floor(rand() * 3)];
      blob(ctx, e - side * g.U * rand() * 4, y + g.U * 0.5, m, m * 0.55);
    }
    // grass lip and hanging moss at the edge
    for (let y = y0 - g.U * 1.5; y < g.H; y += g.U * 0.8) {
      const e = edge(g, y);
      ctx.fillStyle = MOSS[1 + (rand() < 0.4 ? 1 : 0)];
      blob(ctx, e, y, g.U * (0.6 + rand() * 1), g.U * 0.6);
    }
  }

  function cliffTrees(ctx, g, rand, side) {
    const top = side < 0 ? topL : topR;
    const e0 = side < 0 ? edgeL(g, g.ly) : edgeR(g, g.ry);
    const span = side < 0 ? [0, e0 - g.U * 3] : [e0 + g.U * 3, g.W];
    const n = Math.round((span[1] - span[0]) / (g.U * 2.2));
    for (let i = 0; i < n; i++) {
      const x = lerp(span[0], span[1], rand());
      const y = top(g, x) + g.U * 1.6;
      const near = side < 0 ? x / e0 : (g.W - x) / (g.W - e0);
      const h = g.U * (14 + near * 22 + rand() * 8);
      cedar(ctx, x, y, h, rand);
    }
    const mx = side < 0 ? e0 - g.U * 9 : e0 + g.U * 10;
    maple(ctx, g, rand, mx, top(g, mx) - g.U * 4, g.U * 6);
    // bank shrubs on top of the cliff
    for (let x = span[0]; x < span[1]; x += g.U * (1 + rand() * 1.6)) {
      ctx.fillStyle = MOSS[Math.floor(rand() * 3)];
      blob(ctx, x, top(g, x) + g.U * 1.4, g.U * (1.2 + rand()), g.U * 0.8);
    }
  }

  function anchor(ctx, g, x, y) {
    ctx.fillStyle = '#2c231c';
    ctx.fillRect(x - g.U * 0.5, y - g.U * 6, g.U, g.U * 8);
    ctx.fillStyle = '#4a3f2a';
    ctx.fillRect(x - g.U * 0.5, y - g.U * 6, g.U * 0.35, g.U * 8);
  }

  function lantern(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#6c6a5a';
    ctx.fillRect(x - u * 0.4, y - u * 2.5, u * 0.8, u * 2.5);
    ctx.fillRect(x - u * 1.4, y - u * 3.6, u * 2.8, u * 1.1);
    ctx.fillStyle = '#e2ad50';
    ctx.fillRect(x - u * 0.5, y - u * 3.3, u, u * 0.6);
    ctx.fillStyle = '#58564a';
    ctx.beginPath();
    ctx.moveTo(x - u * 1.9, y - u * 3.6);
    ctx.lineTo(x, y - u * 5.2);
    ctx.lineTo(x + u * 1.9, y - u * 3.6);
    ctx.fill();
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ridge(ctx, g, rand, g.H * 0.2, g.H * 0.2, RIDGES[0], 3, true);
    ridge(ctx, g, rand, g.H * 0.3, g.H * 0.18, RIDGES[1], 5, true);
    ridge(ctx, g, rand, g.H * 0.4, g.H * 0.16, RIDGES[2], 7, true);
    paintGorge(ctx, g, rand);
    for (const side of [-1, 1]) {
      cliffBody(ctx, g, rand, side);
      cliffTrees(ctx, g, rand, side);
    }
    anchor(ctx, g, edgeL(g, g.ly) - g.U * 2, g.ly);
    anchor(ctx, g, edgeR(g, g.ry) + g.U * 2, g.ry);
    lantern(ctx, g, edgeL(g, g.ly) - g.U * 7, topL(g, edgeL(g, g.ly) - g.U * 7) + g.U * 1.6);
    return c;
  }

  // ---- mist --------------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 5), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.64, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 228;
        img.data[i + 2] = 214;
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
    const rows = [[0.5, 0.9, 1.2, 0], [0.64, 0.8, -0.8, 0.3], [0.78, 0.9, 1, 0.6]];
    for (const [yf, al, sp, ph] of rows) {
      const a = (((t * g.U * sp) % w) + w) % w;
      const rise = Math.sin(t * 0.18 + ph * TAU) * g.U * 2 - ((t * g.U * 0.6 + ph * g.H) % (g.H * 0.08));
      ctx.globalAlpha = Math.min(1, mist * al * 0.8);
      ctx.drawImage(m, -a, g.H * yf + rise);
      ctx.drawImage(m, w - a, g.H * yf + rise);
    }
    ctx.globalAlpha = 1;
  }

  // ---- the bridge ---------------------------------------------------------------

  function bridgeEnds(g) {
    const x0 = edgeL(g, g.ly) - g.U * 2;
    const x1 = edgeR(g, g.ry) + g.U * 2;
    return { x0, x1, y0: g.ly + g.U * 1.5, y1: g.ry + g.U * 1.5 };
  }

  // centre line of the deck at fraction s, with sway and a small swing sideways
  function deckAt(g, b, s, t, sway, out) {
    const sag = g.U * 11;
    const env = Math.sin(s * Math.PI);
    const bob = Math.sin(t * 0.9 + s * 2.1) * g.U * 0.5 * sway * env + Math.sin(t * 0.45) * g.U * 0.8 * sway * env;
    const swing = Math.sin(t * 0.45 + 0.6) * g.U * 1.2 * sway * env;
    out[0] = lerp(b.x0, b.x1, s) + swing;
    out[1] = lerp(b.y0, b.y1, s) + sag * 4 * s * (1 - s) + bob;
  }

  function drawBridge(ctx, g, t, sway) {
    const b = bridgeEnds(g);
    const p = state.pt;
    const U = g.U;
    const lift = U * 8;
    // hand vines: far one fainter, near one darker
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      const off = pass ? U * 1.6 : 0;
      ctx.strokeStyle = VINE;
      ctx.globalAlpha = pass ? 1 : 0.6;
      ctx.lineWidth = Math.max(1, U * (pass ? 0.55 : 0.4));
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        deckAt(g, b, i / 20, t, sway, p);
        const y = p[1] - lift + off * 0.4 + Math.sin(t * 0.7 + i * 0.5 + pass) * U * 0.25 * sway;
        if (i === 0) ctx.moveTo(p[0] + off, y);
        else ctx.lineTo(p[0] + off, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // uprights and deck planks
    const sd = ctx;
    for (let i = 0; i <= SLATS; i++) {
      const s = i / SLATS;
      deckAt(g, b, s, t, sway, p);
      const w = Math.max(2, (b.x1 - b.x0) / SLATS * 0.8);
      if (i % 4 === 0) {
        sd.fillStyle = VINE;
        sd.fillRect(p[0] + U * 0.6, p[1] - lift, Math.max(1, U * 0.3), lift);
        sd.fillRect(p[0] + U * 1.6, p[1] - lift * 0.93, Math.max(1, U * 0.25), lift * 0.93);
      }
      sd.fillStyle = PLANK[i % 3];
      sd.fillRect(p[0], p[1], w, Math.max(1, U * 1.8));
      sd.fillStyle = PLANK[2];
      sd.fillRect(p[0], p[1] + U * 1.6, w, Math.max(1, U * 0.4));
    }
    // two loose vine loops hanging under the deck
    ctx.strokeStyle = VINE;
    ctx.lineWidth = Math.max(1, U * 0.45);
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        deckAt(g, b, i / 20, t, sway, p);
        const y = p[1] + U * (3.5 + k * 1.8) + Math.sin(t * 0.8 + i * 0.4 + k) * U * 0.3 * sway;
        if (i === 0) ctx.moveTo(p[0], y);
        else ctx.lineTo(p[0], y);
      }
      ctx.stroke();
    }
  }

  // ---- leaves ------------------------------------------------------------------

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = g.lx * (0.3 + r() * 0.6);
    L.y[i] = g.H * (0.2 + r() * 0.15);
    L.vy[i] = g.U * (2.5 + r() * 2);
    L.vx[i] = g.U * (1.2 + r() * 1.6);
    L.size[i] = g.U * (0.9 + r() * 0.7);
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
    L.spin[i] = (r() - 0.5) * 3;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
    if (scatter) {
      L.x[i] = r() * g.W;
      L.y[i] = g.H * (0.2 + r() * 0.7);
    }
  }

  function stepLeaf(g, L, i, t, dt) {
    L.y[i] += L.vy[i] * dt;
    L.x[i] += (L.vx[i] + Math.sin(t * 1.1 + L.p[i]) * g.U * 2) * dt;
    L.a[i] += L.spin[i] * dt;
    if (L.y[i] > g.H * 0.95 || L.x[i] > g.W + g.U * 3) resetLeaf(g, L, i, false);
  }

  function drawLeaves(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + L.p[i]));
      const sz = L.size[i];
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const f = () => new Float32Array(MAX_LEAVES);
    state.g = g;
    state.rand = rand;
    state.pt = [0, 0];
    state.back = paintBack(g, rand);
    state.mist = paintMist(g);
    state.leaves = { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), tone: f() };
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, mist, leaves } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(8 * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    drawBridge(ctx, g, t, sway);
    drawLeaves(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { sway: 1, mist: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
