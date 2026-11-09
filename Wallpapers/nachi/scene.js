/*
 * 那智 Nachi — a tall waterfall beside a vermilion three-storey pagoda among cedars.
 *
 * Sky, ridges, cliff, cedars and pagoda are baked once. The fall is one tiling
 * strip of streaks that slides down; mist is a wide strip that drifts; spray
 * is a short reused pool of puffs at the foot; a few maple leaves float by.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;
  const TAU = Math.PI * 2;

  const FALL_X = 0.36;
  const RIM = 0.12;
  const POOL = 0.8;
  const PUFFS = 14;
  const MAX_LEAVES = 14;
  const LEAF_TONES = ['#b8472b', '#c9732f', '#a8402b', '#c89a45'];
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 120));
    const fw = Math.max(3, Math.min(W * 0.075, u * 9));
    return { W, H, U, u, fw, fx: W * FALL_X, rim: H * RIM, pool: H * POOL, px: W * 0.69 };
  }

  // ---- backdrop ------------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.7);
    grad.addColorStop(0, '#8e9aa4');
    grad.addColorStop(0.5, '#b7bcb6');
    grad.addColorStop(1, '#d9d4bf');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e9e1c6';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(g.W * 0.82, g.H * 0.14, g.u * 4.2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function ridge(ctx, g, base, amp, seed, color, alpha) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (let x = 0; x < g.W; x++) {
      const y = base + (fbm(x / (g.W * 0.35), seed, 4, seed) - 0.5) * amp;
      ctx.fillRect(x, y, 1, g.H - y);
    }
    ctx.globalAlpha = 1;
  }

  function rimY(g, x) {
    const n = fbm(x / (g.W * 0.12), 3.3, 3, 7);
    const slope = smoothstep(g.fx + g.fw * 4, g.W * 1.02, x);
    return g.rim + (n - 0.5) * g.u * 5 + slope * g.H * 0.3;
  }

  function paintCliff(ctx, g, rand) {
    const left = g.fx - g.fw / 2;
    const right = g.fx + g.fw / 2;
    for (let x = 0; x < g.W; x++) {
      if (x > left && x < right) continue;
      const top = rimY(g, x);
      const near = Math.min(Math.abs(x - left), Math.abs(x - right));
      const lit = x > right ? 0.25 : 0;
      const grad = ctx.createLinearGradient(0, top, 0, g.pool);
      grad.addColorStop(0, '#5c6a72');
      grad.addColorStop(1, '#38444d');
      ctx.fillStyle = grad;
      ctx.fillRect(x, top, 1, g.H - top);
      if (lit && near < g.u * 6) {
        ctx.fillStyle = '#7f8c92';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, top, 1, g.pool - top);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = '#12181e';
    for (let i = 0; i < g.W * 0.9; i++) {
      const x = rand() * g.W;
      if (x > left - 1 && x < right + 1) continue;
      const y = rimY(g, x) + rand() * (g.pool - g.rim);
      ctx.globalAlpha = 0.25 + rand() * 0.3;
      ctx.fillRect(x, y, 1, g.u * (1 + rand() * 4));
    }
    ctx.globalAlpha = 1;
  }

  function cedar(ctx, x, by, h, color, trunkColor) {
    const w = h * 0.2;
    ctx.fillStyle = trunkColor;
    ctx.fillRect(x - h * 0.012, by - h * 0.15, Math.max(1, h * 0.024), h * 0.15);
    ctx.fillStyle = color;
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const f0 = i / tiers;
      const f1 = (i + 1.35) / tiers;
      const y0 = by - h * (0.12 + 0.88 * f0);
      const y1 = by - h * (0.12 + 0.88 * Math.min(1, f1));
      const hw = w * (1 - f0 * 0.82);
      poly(ctx, [x - hw, y0, x - hw * 0.35, y1 + (y0 - y1) * 0.2, x, y1, x + hw * 0.35, y1 + (y0 - y1) * 0.2, x + hw, y0]);
    }
  }

  function paintCedars(ctx, g, rand, list, color, trunk) {
    for (const c of list) cedar(ctx, c[0] * g.W, c[1] * g.H, c[2] * g.H, color, trunk);
  }

  // ---- pagoda --------------------------------------------------------------

  function storey(ctx, cx, by, s, i) {
    const hw = s * (6.2 - i * 1.15);
    const e = hw + s * 3;
    const wh = s * 4.4;
    const wallTop = by - wh;
    ctx.fillStyle = '#a63f29';
    ctx.fillRect(cx - hw, wallTop, hw * 2, wh);
    ctx.fillStyle = '#7f2f20';
    const bays = 4;
    for (let b = 0; b <= bays; b++) ctx.fillRect(cx - hw + (b * (hw * 2 - s * 0.5)) / bays, wallTop, Math.max(1, s * 0.5), wh);
    ctx.fillStyle = '#4a2a22';
    ctx.fillRect(cx - hw, by - s * 0.5, hw * 2, s * 0.5);
    ctx.fillStyle = '#2f2420';
    ctx.fillRect(cx - hw * 0.5, wallTop + wh * 0.3, hw, wh * 0.45);
    ctx.fillStyle = '#c9a24c';
    ctx.fillRect(cx - hw, wallTop, hw * 2, Math.max(1, s * 0.35));
    const ye = wallTop;
    ctx.fillStyle = '#3c404c';
    poly(ctx, [
      cx - e, ye - s * 0.9, cx - e * 0.82, ye + s * 0.55, cx + e * 0.82, ye + s * 0.55, cx + e, ye - s * 0.9,
      cx + e * 0.52, ye - s * 1.5, cx + hw * 0.32, ye - s * 2.7, cx - hw * 0.32, ye - s * 2.7, cx - e * 0.52, ye - s * 1.5,
    ]);
    ctx.fillStyle = '#5e6370';
    poly(ctx, [cx - e, ye - s * 0.9, cx - e * 0.52, ye - s * 1.5, cx - hw * 0.32, ye - s * 2.7, cx - hw * 0.1, ye - s * 2.7, cx - e * 0.4, ye - s * 1.3]);
    return ye - s * 2.7;
  }

  function paintPagoda(ctx, g) {
    const s = Math.max(1.2, g.u * 1.8);
    const cx = g.px;
    const by = g.pool + g.u * 1.5;
    ctx.fillStyle = '#4d5551';
    ctx.fillRect(cx - s * 11, by - s * 0.6, s * 22, s * 4);
    ctx.fillStyle = '#6b726c';
    ctx.fillRect(cx - s * 11, by - s * 0.6, s * 22, Math.max(1, s * 0.5));
    let y = by - s * 0.6;
    for (let i = 0; i < 3; i++) y = storey(ctx, cx, y, s, i);
    ctx.fillStyle = '#b79a4a';
    ctx.fillRect(cx - Math.max(0.5, s * 0.22), y - s * 7, Math.max(1, s * 0.44), s * 7.2);
    for (let r = 0; r < 5; r++) {
      ctx.fillRect(cx - s * 0.9, y - s * (6.2 - r * 1.1), s * 1.8, Math.max(1, s * 0.3));
    }
  }

  // ---- cached strips ------------------------------------------------------

  function paintFall(g, rand) {
    const h = Math.ceil(g.pool - g.rim);
    const c = layer(g.fw, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cfd5d2';
    ctx.fillRect(0, 0, c.width, h);
    for (let i = 0; i < c.width * 6; i++) {
      const x = rand() * c.width;
      const len = h * (0.08 + rand() * 0.3);
      const y = rand() * h;
      ctx.fillStyle = rand() < 0.55 ? '#f1f1e8' : '#8d9ba2';
      ctx.globalAlpha = 0.35 + rand() * 0.5;
      const w = Math.max(1, c.width * (0.03 + rand() * 0.06));
      ctx.fillRect(x, y, w, len);
      if (y + len > h) ctx.fillRect(x, y - h, w, len);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintMist(g, rand) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e4e2d4';
    for (let i = 0; i < 22; i++) {
      const x = rand() * w;
      const y = h * (0.25 + rand() * 0.5);
      const rx = w * (0.07 + rand() * 0.1);
      const ry = h * (0.07 + rand() * 0.1);
      ctx.globalAlpha = 0.12 + rand() * 0.12;
      for (const ox of [-w, 0, w]) {
        ctx.beginPath();
        ctx.ellipse(x + ox, y, rx, ry, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    ridge(ctx, g, g.H * 0.3, g.H * 0.16, 1.7, '#7d8a94', 0.8);
    ridge(ctx, g, g.H * 0.4, g.H * 0.14, 5.2, '#56656e', 0.85);
    paintCedars(ctx, g, rand, [
      [0.58, 0.55, 0.3], [0.62, 0.57, 0.36], [0.66, 0.52, 0.26], [0.78, 0.57, 0.3], [0.83, 0.55, 0.38],
      [0.9, 0.58, 0.32], [0.95, 0.55, 0.4], [0.5, 0.52, 0.2], [0.72, 0.5, 0.24],
    ], '#4a5d5a', '#3a3a34');
    paintCliff(ctx, g, rand);
    ctx.fillStyle = '#2b3740';
    ctx.fillRect(0, g.pool, g.W, g.H - g.pool);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#33423f';
    ctx.fillRect(g.W * 0.45, g.pool + g.u * 1.2, g.W * 0.55, g.H);
    ctx.fillStyle = '#3d4a42';
    for (let i = 0; i < g.W * 0.2; i++) {
      ctx.globalAlpha = 0.3;
      ctx.fillRect(g.W * 0.45 + rand() * g.W * 0.55, g.pool + g.u * 1.5 + rand() * g.u * 3, 1, 1);
    }
    ctx.globalAlpha = 1;
    paintCedars(ctx, g, rand, [
      [0.5, 0.83, 0.5], [0.87, 0.84, 0.6], [0.47, 0.82, 0.3],
      [0.035, 1.02, 0.8], [0.105, 1.04, 0.66], [0.97, 1.03, 0.95], [0.9, 1.02, 0.68],
    ], '#141f1d', '#14120f');
    ctx.fillStyle = '#6a2f27';
    ctx.globalAlpha = 0.9;
    const mx = g.W * 0.27;
    const my = g.pool + g.u * 7;
    ctx.fillStyle = '#7e3a24';
    for (let i = 0; i < 14; i++) {
      ctx.fillRect(mx + rand() * g.u * 14 - g.u * 7, my + rand() * g.u * 4, Math.max(1, g.u * 0.5), Math.max(1, g.u * 0.4));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- movers --------------------------------------------------------------

  function makePuffs(g, rand) {
    const P = { x: new Float32Array(PUFFS), t: new Float32Array(PUFFS), s: new Float32Array(PUFFS), p: new Float32Array(PUFFS) };
    for (let i = 0; i < PUFFS; i++) {
      P.x[i] = (rand() - 0.5) * g.fw * 2.2;
      P.t[i] = rand();
      P.s[i] = 0.7 + rand() * 0.8;
      P.p[i] = rand() * TAU;
    }
    return P;
  }

  function makeLeaves(g, rand) {
    const L = { x: new Float32Array(MAX_LEAVES), y: new Float32Array(MAX_LEAVES), p: new Float32Array(MAX_LEAVES), tone: new Uint8Array(MAX_LEAVES), v: new Float32Array(MAX_LEAVES) };
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, L, i, rand, true);
    return L;
  }

  function resetLeaf(g, L, i, rand, first) {
    L.x[i] = g.W * (0.45 + rand() * 0.5);
    L.y[i] = first ? rand() * g.H : -g.u * 2;
    L.p[i] = rand() * TAU;
    L.tone[i] = Math.floor(rand() * LEAF_TONES.length);
    L.v[i] = 0.7 + rand() * 0.6;
  }

  function drawFall(ctx, g, t, water) {
    const h = state.fall.height;
    const off = (t * g.H * 0.45 * (0.5 + water * 0.5)) % h;
    const x = g.fx - g.fw / 2;
    ctx.globalAlpha = Math.min(1, 0.55 + water * 0.45);
    ctx.drawImage(state.fall, 0, 0, state.fall.width, h - off, x, g.rim, g.fw, h - off);
    ctx.drawImage(state.fall, 0, h - off, state.fall.width, off, x, g.rim + h - off, g.fw, off);
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    const m = state.mist;
    const w = m.width;
    ctx.globalAlpha = Math.min(1, amount * 0.9);
    const o1 = (t * 2.2) % w;
    ctx.drawImage(m, o1, 0);
    ctx.drawImage(m, o1 - w, 0);
    ctx.drawImage(m, 0, 0, w, m.height, -((t * 3.4) % w), g.H * 0.46, w, m.height);
    ctx.drawImage(m, 0, 0, w, m.height, w - ((t * 3.4) % w), g.H * 0.46, w, m.height);
    ctx.globalAlpha = 1;
  }

  function drawSpray(ctx, g, t, amount, water) {
    const P = state.puffs;
    ctx.fillStyle = '#e8e8de';
    for (let i = 0; i < PUFFS; i++) {
      const life = (t * 0.18 * P.s[i] + P.t[i]) % 1;
      const r = g.u * (1.2 + life * 3.2) * (0.6 + water * 0.4);
      const x = g.fx + P.x[i] + Math.sin(t * 0.5 + P.p[i]) * g.u * 0.8 + life * g.u * 3;
      const y = g.pool + g.u * 0.5 - life * g.u * 14;
      ctx.globalAlpha = Math.min(1, amount) * 0.34 * (1 - life) * Math.min(1, life * 5);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r * 0.8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t, dt, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      L.y[i] += dt * g.u * 3.2 * L.v[i];
      L.x[i] += dt * Math.sin(t * 0.6 + L.p[i]) * g.u * 1.6 - dt * g.u * 0.4;
      if (L.y[i] > g.H + g.u * 2) resetLeaf(g, L, i, state.rand, false);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + L.p[i]));
      const sz = Math.max(1.2, g.u * 0.8);
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.fillRect(L.x[i], L.y[i], sz, sz * sq);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.fall = paintFall(g, rand);
    state.mist = paintMist(g, rand);
    state.pagoda = layer(g.W, g.H);
    paintPagoda(state.pagoda.getContext('2d'), g);
    state.front = paintFront(g, rand);
    state.puffs = makePuffs(g, rand);
    state.leaves = makeLeaves(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { water, mist, leaves } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(7 * leaves));
    ctx.drawImage(state.back, 0, 0);
    drawFall(ctx, g, t, water);
    drawMist(ctx, g, t, mist * 0.8);
    ctx.drawImage(state.pagoda, 0, 0);
    drawSpray(ctx, g, t, mist, water);
    ctx.drawImage(state.front, 0, 0);
    drawLeaves(ctx, g, t, Math.min(dt, 0.1), count);
  }

  Kasuri.run({
    defaults: { water: 1, mist: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
