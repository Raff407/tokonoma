/*
 * Jiuzhaigou — terraced jade lakes among autumn forest under ink-wash peaks.
 *
 * Peaks, forest, lakes, falls and the pavilion are baked once per grid. Per frame:
 * the baked layers, a handful of expanding ripple rings, short fall streaks,
 * two tiling mist strips and a small reused pool of falling leaves.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  const SKY = ['#cfd3c8', '#dcdccd', '#e6e0cb'];
  const PEAK = ['#7a8a90', '#66777f', '#506069'];
  const SNOW = '#e8e4d4';
  const CROWNS = [
    ['#94503e', '#b4442b', '#cf6a3e'],
    ['#a5762f', '#c8993a', '#e0b858'],
    ['#4a5e3a', '#5d7444', '#778a52'],
    ['#2c4234', '#3b5742', '#506b4c'],
    ['#a55a28', '#cc8038', '#e0a04c'],
  ];
  const LAKE_EDGE = '#78ac9a';
  const LAKE_MID = '#4a8d86';
  const LAKE_DEEP = '#2f6b72';
  const RIM = '#cfc6a6';
  const FALL = '#e6e4d6';
  const LEAF_TONES = ['#c4422b', '#d6683c', '#c8993a', '#b4442b'];
  const LAKES = [
    [0.64, 0.50, 0.13, 0.032],
    [0.36, 0.60, 0.17, 0.042],
    [0.66, 0.72, 0.22, 0.06],
    [0.42, 0.90, 0.32, 0.085],
  ];
  const RINGS = 14;
  const GLINTS = 36;
  const MAX_LEAVES = 36;
  const LEAVES = 18;
  const STREAKS = 5;
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
    const lakes = LAKES.map((l, i) => ({
      x: l[0] * W, y: l[1] * H, rx: l[2] * Math.min(W, H * 1.9), ry: l[3] * H, i,
    }));
    return { W, H, U, lakes };
  }

  function inLake(g, x, y, pad) {
    for (const l of g.lakes) {
      const dx = (x - l.x) / (l.rx + pad);
      const dy = (y - l.y) / (l.ry + pad * 0.5);
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }

  // ---- sky and peaks ---------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.45);
    grad.addColorStop(0, SKY[0]);
    grad.addColorStop(0.6, SKY[1]);
    grad.addColorStop(1, SKY[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function ridge(g, x, k, base, amp, seed) {
    const n = fbm(x / g.W * k, seed, 4, seed);
    return g.H * (base - amp * n);
  }

  function paintPeaks(ctx, g) {
    const layers = [
      { k: 3.2, base: 0.36, amp: 0.30, seed: 3, col: PEAK[0], a: 0.55 },
      { k: 4.5, base: 0.42, amp: 0.26, seed: 11, col: PEAK[1], a: 0.75 },
      { k: 6.0, base: 0.47, amp: 0.18, seed: 23, col: PEAK[2], a: 0.9 },
    ];
    layers.forEach((L, li) => {
      ctx.globalAlpha = L.a;
      ctx.fillStyle = L.col;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridge(g, x, L.k, L.base, L.amp, L.seed));
      ctx.lineTo(g.W, g.H);
      ctx.fill();
      if (li < 2) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = SNOW;
        for (let x = 0; x <= g.W; x += 2) {
          const y = ridge(g, x, L.k, L.base, L.amp, L.seed);
          const top = g.H * (L.base - L.amp * 0.62);
          if (y < top) ctx.fillRect(x, y, 2, Math.min(g.U * 2.2, top - y + g.U * 0.5));
        }
      }
      // pale band of haze under each ridge
      const hz = ctx.createLinearGradient(0, g.H * (L.base - 0.05), 0, g.H * (L.base + 0.14));
      hz.addColorStop(0, 'rgba(226,224,208,0)');
      hz.addColorStop(1, 'rgba(226,224,208,0.55)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = hz;
      ctx.fillRect(0, g.H * (L.base - 0.05), g.W, g.H * 0.19);
    });
    ctx.globalAlpha = 1;
  }

  // ---- forest ----------------------------------------------------------------

  function slopeTop(g, x) {
    return g.H * (0.46 + 0.05 * fbm(x / g.W * 4, 7, 3, 5)) - g.H * 0.02;
  }

  function crown(ctx, x, y, r, tones, rand) {
    ctx.fillStyle = tones[0];
    blob(ctx, x, y + r * 0.2, r * 1.05, r * 0.8);
    ctx.fillStyle = tones[1];
    blob(ctx, x - r * 0.1, y - r * 0.1, r * 0.85, r * 0.65);
    ctx.fillStyle = tones[2];
    blob(ctx, x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.28);
    if (rand() < 0.3) {
      ctx.fillStyle = tones[1];
      blob(ctx, x + r * 0.7, y + r * 0.1, r * 0.5, r * 0.4);
    }
  }

  function conifer(ctx, x, y, h, rand) {
    const tones = CROWNS[3];
    ctx.fillStyle = '#2a2a24';
    ctx.fillRect(x - h * 0.03, y - h * 0.2, Math.max(1, h * 0.06), h * 0.2);
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const w = h * (0.3 - 0.2 * f);
      const yy = y - h * (0.18 + 0.7 * f);
      ctx.fillStyle = tones[i % 3 === 2 ? 2 : i % 2];
      ctx.beginPath();
      ctx.moveTo(x - w, yy + h * 0.12);
      ctx.lineTo(x, yy - h * 0.08);
      ctx.lineTo(x + w, yy + h * 0.12);
      ctx.fill();
    }
  }

  function paintForest(ctx, g, rand) {
    const pts = [];
    const count = Math.round(g.W * g.H / 14);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W * 1.1 - g.W * 0.05;
      const y = g.H * (0.42 + rand() * 0.6);
      pts.push([x, y]);
    }
    pts.sort((a, b) => a[1] - b[1]);
    // ground wash behind the crowns
    ctx.fillStyle = '#4a5a3c';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, slopeTop(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (const [x, y] of pts) {
      if (y < slopeTop(g, x) + g.U * 0.5) continue;
      if (inLake(g, x, y, g.U * 1.2)) continue;
      const depth = (y / g.H - 0.4) / 0.6;
      const r = g.U * (0.9 + 3.4 * depth) * (0.8 + rand() * 0.5);
      const n = fbm(x / g.W * 5, y / g.H * 5, 3, 9);
      let ci;
      if (n > 0.62) ci = 2;
      else if (n > 0.5) ci = 1;
      else if (n > 0.38) ci = 0;
      else ci = rand() < 0.5 ? 4 : 3;
      if (ci === 3 && rand() < 0.6) conifer(ctx, x, y + r * 0.5, r * 3.2, rand);
      else crown(ctx, x, y, r, CROWNS[ci], rand);
    }
  }

  // ---- lakes and falls -------------------------------------------------------

  function lakePath(ctx, l, grow, g) {
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const w = 1 + 0.08 * (fbm(Math.cos(a) * 2 + l.i * 5, Math.sin(a) * 2, 3, 13) - 0.5) * 4;
      const x = l.x + Math.cos(a) * (l.rx + grow) * w;
      const y = l.y + Math.sin(a) * (l.ry + grow * 0.5) * w;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function fallX(g, i) {
    const a = g.lakes[i];
    const b = g.lakes[i + 1];
    return lerp(a.x, b.x, 0.45);
  }

  function paintLakes(ctx, g, rand) {
    // falls first so lakes sit over their ends
    for (let i = 0; i < g.lakes.length - 1; i++) {
      const a = g.lakes[i];
      const b = g.lakes[i + 1];
      const x = fallX(g, i);
      const y0 = a.y + a.ry * 0.8;
      const y1 = b.y - b.ry * 0.8;
      const w = g.U * (3 + i * 0.9);
      ctx.fillStyle = '#34402f';
      ctx.fillRect(x - w * 1.5, y0, w * 3, y1 - y0);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = FALL;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.6, y0);
      ctx.lineTo(x + w * 0.6, y0);
      ctx.lineTo(x + w, y1);
      ctx.lineTo(x - w, y1);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const l of g.lakes) {
      // travertine rim
      ctx.fillStyle = RIM;
      lakePath(ctx, l, g.U * 0.9, g);
      ctx.fill();
      ctx.fillStyle = '#3a4a3a';
      lakePath(ctx, l, g.U * 0.4, g);
      ctx.fill();
      // jade water, light at the shallows and deeper in the middle
      ctx.save();
      lakePath(ctx, l, 0, g);
      ctx.clip();
      ctx.fillStyle = LAKE_EDGE;
      ctx.fillRect(l.x - l.rx * 1.3, l.y - l.ry * 1.3, l.rx * 2.6, l.ry * 2.6);
      ctx.fillStyle = LAKE_MID;
      blob(ctx, l.x, l.y + l.ry * 0.1, l.rx * 0.82, l.ry * 0.78);
      ctx.fillStyle = LAKE_DEEP;
      blob(ctx, l.x - l.rx * 0.1, l.y + l.ry * 0.2, l.rx * 0.5, l.ry * 0.45);
      // reflected autumn colour near the far bank
      for (let k = 0; k < 14; k++) {
        const t = CROWNS[k % 3 === 2 ? 1 : 0];
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = t[1];
        blob(ctx, l.x + (rand() - 0.5) * l.rx * 1.6, l.y - l.ry * (0.45 + rand() * 0.3), g.U * (0.8 + rand() * 1.6), g.U * 0.35);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // ---- pavilion --------------------------------------------------------------

  function paintPavilion(ctx, g) {
    const l = g.lakes[1];
    const u = g.U * 1.5;
    const x = l.x - l.rx * 0.55;
    const y = l.y - l.ry * 1.9;
    // rocky foot
    ctx.fillStyle = '#6a6a5e';
    ctx.beginPath();
    ctx.moveTo(x - u * 9, y + u * 3);
    ctx.lineTo(x - u * 6, y - u * 0.5);
    ctx.lineTo(x + u * 6, y - u * 0.5);
    ctx.lineTo(x + u * 9, y + u * 3);
    ctx.fill();
    ctx.fillStyle = '#b8b09a';
    ctx.fillRect(x - u * 6.5, y - u * 1.6, u * 13, u * 1.2);
    // columns
    ctx.fillStyle = '#b4442b';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - u * 5.2 + i * u * 3.5, y - u * 8, Math.max(1, u * 0.7), u * 6.4);
    // railing and lintel
    ctx.fillStyle = '#7a3224';
    ctx.fillRect(x - u * 5.6, y - u * 4, u * 11.2, Math.max(1, u * 0.5));
    ctx.fillRect(x - u * 5.6, y - u * 8.4, u * 11.2, u * 0.9);
    ctx.fillStyle = '#c8993a';
    ctx.fillRect(x - u * 5.6, y - u * 7.5, u * 11.2, Math.max(1, u * 0.35));
    // roof: curved slopes with upturned eaves
    ctx.fillStyle = '#34404a';
    ctx.beginPath();
    ctx.moveTo(x - u * 9.5, y - u * 10.6);
    ctx.quadraticCurveTo(x - u * 6.5, y - u * 8.2, x - u * 4.5, y - u * 8.8);
    ctx.lineTo(x + u * 4.5, y - u * 8.8);
    ctx.quadraticCurveTo(x + u * 6.5, y - u * 8.2, x + u * 9.5, y - u * 10.6);
    ctx.quadraticCurveTo(x + u * 6, y - u * 11.2, x + u * 3, y - u * 14.4);
    ctx.lineTo(x - u * 3, y - u * 14.4);
    ctx.quadraticCurveTo(x - u * 6, y - u * 11.2, x - u * 9.5, y - u * 10.6);
    ctx.fill();
    ctx.fillStyle = '#4a5864';
    ctx.fillRect(x - u * 3, y - u * 14.4, u * 6, Math.max(1, u * 0.6));
    ctx.fillStyle = '#c8993a';
    ctx.fillRect(x - u * 3.2, y - u * 15, u * 6.4, Math.max(1, u * 0.7));
    ctx.fillRect(x - u * 0.4, y - u * 16.3, Math.max(1, u * 0.8), u * 1.4);
  }

  // ---- big foreground pines --------------------------------------------------

  function bigPine(ctx, g, x, y, h, dir, rand) {
    ctx.strokeStyle = '#2e2a22';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, h * 0.045);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * h * 0.12, y - h * 0.5, x - dir * h * 0.05, y - h);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const f = 0.35 + i * 0.12;
      const bx = x + dir * h * 0.04 * Math.sin(f * 4);
      const by = y - h * f;
      const side = i % 2 ? 1 : -1;
      const len = h * (0.34 - i * 0.03);
      ctx.lineWidth = Math.max(1, h * 0.025);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + side * len * 0.5, by - h * 0.04, bx + side * len, by + h * 0.02);
      ctx.stroke();
      ctx.fillStyle = CROWNS[3][i % 3];
      blob(ctx, bx + side * len * 0.7, by - h * 0.02, len * 0.5, h * 0.075);
      ctx.fillStyle = CROWNS[3][2];
      blob(ctx, bx + side * len * 0.65, by - h * 0.06, len * 0.3, h * 0.035);
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    bigPine(ctx, g, g.W * 0.06, g.H * 1.02, g.H * 0.62, 1, rand);
    bigPine(ctx, g, g.W * 0.95, g.H * 1.02, g.H * 0.5, -1, rand);
    // maple branch top right
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = Math.max(1.5, g.U * 0.9);
    ctx.beginPath();
    ctx.moveTo(g.W * 1.02, g.H * 0.04);
    ctx.quadraticCurveTo(g.W * 0.88, g.H * 0.06, g.W * 0.8, g.H * 0.14);
    ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const t = rand();
      const x = lerp(g.W * 1.0, g.W * 0.78, t) + (rand() - 0.5) * g.U * 4;
      const y = lerp(g.H * 0.05, g.H * 0.16, t) + rand() * g.U * 4;
      ctx.fillStyle = CROWNS[i % 2 ? 0 : 4][Math.floor(rand() * 3)];
      blob(ctx, x, y, g.U * (1.2 + rand() * 1.2), g.U * (0.8 + rand() * 0.8));
    }
    return c;
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintPeaks(ctx, g);
    paintForest(ctx, g, rand);
    paintLakes(ctx, g, rand);
    paintPavilion(ctx, g);
    return c;
  }

  // ---- mist ------------------------------------------------------------------

  function paintMist(g) {
    const c = layer(g.W, g.H * 0.16);
    const ctx = c.getContext('2d');
    const h = c.height;
    for (let x = 0; x < c.width; x += 2) {
      const a = fbm(x / c.width * 6, 0.5, 3, 31);
      for (let y = 0; y < h; y += 2) {
        const v = Math.max(0, 1 - Math.abs(y - h * 0.5) / (h * 0.5)) * smoothstep(0.35, 0.7, a);
        if (v < 0.05) continue;
        ctx.fillStyle = 'rgba(230,228,214,' + (v * 0.5).toFixed(2) + ')';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    return c;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0.01) return;
    const m = state.mist;
    ctx.globalAlpha = Math.min(1, amount);
    const rows = [[0.42, 2.0], [0.62, -1.4]];
    for (const [fy, sp] of rows) {
      const off = ((t * g.U * sp) % g.W + g.W) % g.W;
      ctx.drawImage(m, off - g.W, g.H * fy);
      ctx.drawImage(m, off, g.H * fy);
    }
    ctx.globalAlpha = 1;
  }

  // ---- ripples, falls, leaves ------------------------------------------------

  function makeRipples(g, rand) {
    const f = () => new Float32Array(RINGS);
    const R = { lake: f(), ox: f(), oy: f(), phase: f(), period: f() };
    for (let i = 0; i < RINGS; i++) {
      R.lake[i] = i % g.lakes.length;
      R.ox[i] = (rand() - 0.5) * 1.1;
      R.oy[i] = (rand() - 0.5) * 1.0;
      R.phase[i] = rand();
      R.period[i] = 6 + rand() * 6;
    }
    return R;
  }

  function drawRipples(ctx, g, t, amount) {
    if (amount <= 0.01) return;
    const R = state.rings;
    const n = Math.min(RINGS, Math.round(RINGS * amount / 1.4));
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    for (let i = 0; i < n; i++) {
      const l = g.lakes[R.lake[i]];
      const p = ((t / R.period[i] + R.phase[i]) % 1 + 1) % 1;
      const r = p * g.U * 5;
      const x = l.x + R.ox[i] * l.rx * 0.8;
      const y = l.y + R.oy[i] * l.ry * 0.7;
      ctx.globalAlpha = (1 - p) * 0.55;
      ctx.strokeStyle = '#cfe4d6';
      ctx.beginPath();
      ctx.ellipse(x, y, r + 0.5, (r + 0.5) * 0.4, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function makeGlints(g, rand) {
    const f = () => new Float32Array(GLINTS);
    const G = { lake: f(), ox: f(), oy: f(), p: f() };
    for (let i = 0; i < GLINTS; i++) {
      G.lake[i] = i % g.lakes.length;
      G.ox[i] = rand() * 2 - 1;
      G.oy[i] = rand() * 2 - 1;
      G.p[i] = rand() * TAU;
    }
    return G;
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0.01) return;
    const G = state.glints;
    ctx.fillStyle = '#e4efe0';
    for (let i = 0; i < GLINTS; i++) {
      const s = Math.sin(t * 0.9 + G.p[i]);
      if (s < 0.45) continue;
      const l = g.lakes[G.lake[i]];
      const x = l.x + G.ox[i] * l.rx * 0.7 + Math.sin(t * 0.3 + G.p[i]) * g.U * 0.6;
      const y = l.y + G.oy[i] * l.ry * 0.6;
      ctx.globalAlpha = (s - 0.45) * 0.9 * Math.min(1, amount);
      ctx.fillRect(x, y, g.U * 1.1, Math.max(1, g.U * 0.22));
    }
    ctx.globalAlpha = 1;
  }

  function drawFalls(ctx, g, t) {
    ctx.fillStyle = '#f2f0e4';
    for (let i = 0; i < g.lakes.length - 1; i++) {
      const a = g.lakes[i];
      const b = g.lakes[i + 1];
      const x = fallX(g, i);
      const y0 = a.y + a.ry * 0.8;
      const y1 = b.y - b.ry * 0.8;
      const w = g.U * (3 + i * 0.9);
      for (let k = 0; k < STREAKS; k++) {
        const p = ((t * 0.7 + k / STREAKS + i * 0.17) % 1 + 1) % 1;
        const y = y0 + p * (y1 - y0);
        const off = (((k * 0.37 + i * 0.21) % 1) - 0.5) * w * 1.4 * lerp(0.6, 1, p);
        ctx.globalAlpha = 0.8 * Math.sin(p * Math.PI);
        ctx.fillRect(x + off, y, Math.max(1, g.U * 0.35), g.U * 2.4);
      }
    }
    ctx.globalAlpha = 1;
  }

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), tone: f() };
  }

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = g.W * (0.35 + r() * 0.75);
    L.y[i] = scatter ? r() * g.H : -g.U * 3;
    L.vy[i] = g.U * (2.2 + r() * 1.6);
    L.vx[i] = -g.U * (0.4 + r() * 0.9);
    L.size[i] = g.U * (1.4 + r() * 1);
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
    L.spin[i] = (r() - 0.5) * 3;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
  }

  function stepLeaf(g, L, i, t, dt) {
    L.y[i] += L.vy[i] * dt;
    L.x[i] += (L.vx[i] + Math.sin(t * 1.2 + L.p[i]) * g.U * 2) * dt;
    L.a[i] += L.spin[i] * dt;
    if (L.y[i] > g.H + g.U * 2 || L.x[i] < -g.U * 3) resetLeaf(g, L, i, false);
  }

  function drawLeaves(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + L.p[i]));
      const sz = L.size[i];
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.mist = paintMist(g);
    state.rings = makeRipples(g, rand);
    state.glints = makeGlints(g, rand);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { ripple, leaves, mist } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawFalls(ctx, g, t);
    drawRipples(ctx, g, t, ripple);
    drawGlints(ctx, g, t, ripple);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.front, 0, 0);
    drawLeaves(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { ripple: 1, leaves: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
