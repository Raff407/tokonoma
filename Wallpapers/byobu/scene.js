/*
 * 屏風 Byobu — a six-panel gold-leaf folding screen with old pines on a mossy bank.
 *
 * The leaf, the bank, the pines and the fold shading are baked once per grid. Each
 * frame lays down the leaf, slides a few baked cloud bands across it, then puts the
 * pines, the folds and the frame on top.
 */
(function () {
  'use strict';

  const K = KasuriCore;

  const TAU = Math.PI * 2;
  const PANELS = 6;
  const LEAF = ['#c59c47', '#c9a14b', '#c79f49', '#cca44e', '#c39a45'];
  const LEAF_SEAM = '#a8843a';
  const CLOUD = { fill: '#ecd492', lit: '#f4e2a8', edge: '#a9813a' };
  const PINE = { trunk: '#3b2c22', bark: '#5a4232', dark: '#24382a', mid: '#36502f', light: '#5b7644' };
  const BANK = { earth: '#6b5536', moss: '#4f6a3a', mossLit: '#6f8a4c', edge: '#3d4d2e' };
  const WATER = { deep: '#2e4566', mid: '#3f5a80', line: '#c9b98a' };
  const FRAME = { lacquer: '#1d1714', rim: '#3a2c22', inner: '#8e6e33' };
  const MAX_CLOUDS = 9;
  const CLOUDS = 7;
  const DRIFT = 0.9;
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

  function capsule(ctx, x, y, w, h) {
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const fr = Math.max(2, Math.round(U * 2.6));
    return { W, H, U, fr, pw: (W - fr * 2) / PANELS, bank: H * 0.8 };
  }

  // ---- gold leaf -----------------------------------------------------------

  function paintLeaf(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = Math.max(3, Math.round(g.U * 7));
    for (let y = 0; y < g.H; y += s) {
      const shift = (y / s) % 2 ? s * 0.5 : 0;
      for (let x = -s; x < g.W + s; x += s) {
        ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)];
        ctx.fillRect(Math.round(x + shift), y, s, s);
      }
    }
    ctx.strokeStyle = LEAF_SEAM;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < g.H; y += s) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(g.W, y + 0.5);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- clouds --------------------------------------------------------------

  function cloudSprite(g, rand) {
    const bars = 2 + Math.floor(rand() * 2);
    const bh = g.U * (3.6 + rand() * 1.6);
    const w = g.U * (60 + rand() * 50);
    const c = layer(w + bh * 4, bh * (bars + 1));
    const ctx = c.getContext('2d');
    let x = bh;
    const rows = [];
    for (let i = 0; i < bars; i++) {
      const bw = w * (0.55 + rand() * 0.45);
      rows.push([x, bh * 0.5 + i * bh * 0.85, bw]);
      x += (rand() - 0.4) * bh * 3;
      x = Math.max(bh * 0.5, Math.min(c.width - bw - bh * 0.5, x));
    }
    ctx.fillStyle = CLOUD.edge;
    for (const [rx, ry, rw] of rows) capsule(ctx, rx - 1, ry - 1, rw + 2, bh + 2);
    ctx.fillStyle = CLOUD.fill;
    for (const [rx, ry, rw] of rows) capsule(ctx, rx, ry, rw, bh);
    ctx.fillStyle = CLOUD.lit;
    for (const [rx, ry, rw] of rows) capsule(ctx, rx + bh * 0.4, ry + bh * 0.15, rw * 0.6, bh * 0.35);
    return c;
  }

  function makeClouds(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const sprite = cloudSprite(g, rand);
      const band = i % 3;
      const y = g.H * (band === 0 ? 0.06 + rand() * 0.12 : band === 1 ? 0.3 + rand() * 0.14 : 0.6 + rand() * 0.1);
      list.push({
        sprite,
        y: Math.round(y),
        x0: rand() * (g.W + sprite.width),
        v: g.U * (2 + rand() * 1.6) * (i % 2 ? 1 : 0.75),
        front: band === 2,
      });
    }
    return list;
  }

  function drawClouds(ctx, g, t, count, drift, front) {
    const L = state.clouds;
    for (let i = 0; i < count; i++) {
      const c = L[i];
      if (c.front !== front) continue;
      const span = g.W + c.sprite.width;
      const x = ((c.x0 + t * c.v * drift * DRIFT) % span + span) % span - c.sprite.width;
      ctx.drawImage(c.sprite, Math.round(x), c.y);
    }
  }

  // ---- bank and stream -----------------------------------------------------

  function bankTop(g, x) {
    return g.bank + K.fbm(x / (g.U * 30), 2.7, 3, 17) * g.H * 0.08 - g.H * 0.04
      - Math.exp(-(((x - g.W * 0.2) / (g.W * 0.16)) ** 2)) * g.H * 0.06;
  }

  function paintBank(ctx, g, rand) {
    ctx.fillStyle = BANK.edge;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, bankTop(g, x) - g.U * 0.8);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = BANK.moss;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, bankTop(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let i = 0; i < 60; i++) {
      const x = rand() * g.W;
      const y = bankTop(g, x) + g.U * (1 + rand() * 4);
      ctx.fillStyle = rand() < 0.5 ? BANK.mossLit : BANK.earth;
      blob(ctx, x, y, g.U * (1.5 + rand() * 3), g.U * (0.5 + rand() * 0.6));
    }
  }

  function paintStream(ctx, g) {
    const x0 = g.W * 0.52;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      pts.push([x0 + f * g.W * 0.5, g.H * (0.9 + 0.04 * Math.sin(f * 5)) - f * g.H * 0.05]);
    }
    ctx.fillStyle = WATER.deep;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], g.H);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.strokeStyle = WATER.line;
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i];
        const yy = y + k * g.U * 2.4 + Math.sin(i * 1.3 + k) * g.U * 0.6;
        if (i === 0) ctx.moveTo(x + k * g.U * 4, yy);
        else ctx.lineTo(x + k * g.U * 4, yy);
      }
      ctx.stroke();
    }
  }

  // ---- pines ---------------------------------------------------------------

  function pad(ctx, g, x, y, r) {
    ctx.fillStyle = PINE.dark;
    blob(ctx, x, y, r, r * 0.42);
    ctx.fillStyle = PINE.mid;
    blob(ctx, x - r * 0.1, y - r * 0.12, r * 0.8, r * 0.28);
    ctx.fillStyle = PINE.light;
    blob(ctx, x - r * 0.2, y - r * 0.22, r * 0.45, r * 0.14);
  }

  function limb(ctx, x0, y0, x1, y1, w) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - Math.abs(x1 - x0) * 0.12, x1, y1);
    ctx.stroke();
  }

  function pine(ctx, g, rand, bx, by, h, lean) {
    const U = g.U;
    const steps = 12;
    const trunk = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      trunk.push([bx + lean * h * (f * f * 0.9 + Math.sin(f * 4) * 0.06), by - f * h]);
    }
    ctx.strokeStyle = PINE.trunk;
    ctx.lineCap = 'round';
    for (let i = 0; i < steps; i++) {
      ctx.lineWidth = U * (4.2 - (i / steps) * 3.2) * (h / (g.H * 0.7));
      ctx.beginPath();
      ctx.moveTo(trunk[i][0], trunk[i][1]);
      ctx.lineTo(trunk[i + 1][0], trunk[i + 1][1]);
      ctx.stroke();
    }
    ctx.strokeStyle = PINE.bark;
    ctx.lineWidth = Math.max(1, U * 0.5);
    for (let i = 1; i < steps - 2; i++) {
      const [x, y] = trunk[i];
      ctx.beginPath();
      ctx.moveTo(x - U * 0.8, y);
      ctx.lineTo(x + U * 0.6, y - U * 0.8);
      ctx.stroke();
    }
    const pads = [];
    for (let i = 4; i <= steps; i += 1) {
      const [x, y] = trunk[i];
      const side = i % 2 ? 1 : -1;
      const reach = h * (0.18 + rand() * 0.22) * (1 - i / (steps * 1.6));
      const ex = x + side * reach * (side === Math.sign(lean) ? 1.4 : 0.8);
      const ey = y - U * (1 + rand() * 3);
      ctx.strokeStyle = PINE.trunk;
      limb(ctx, x, y, ex, ey, U * (1.4 - i / steps));
      pads.push([ex, ey, U * (7 + rand() * 5) * (h / (g.H * 0.7))]);
      pads.push([(x + ex) / 2, ey + U * 0.5, U * (4 + rand() * 3) * (h / (g.H * 0.7))]);
    }
    const [tx, ty] = trunk[steps];
    pads.push([tx, ty - U, U * 8 * (h / (g.H * 0.7))]);
    for (const [x, y, r] of pads) pad(ctx, g, x, y, r);
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBank(ctx, g, rand);
    paintStream(ctx, g);
    pine(ctx, g, rand, g.W * 0.15, bankTop(g, g.W * 0.15) + g.U * 2, g.H * 0.74, 0.32);
    pine(ctx, g, rand, g.W * 0.4, bankTop(g, g.W * 0.4) + g.U * 2, g.H * 0.42, -0.25);
    pine(ctx, g, rand, g.W * 0.84, bankTop(g, g.W * 0.84) + g.U * 2, g.H * 0.55, -0.3);
    return c;
  }

  // ---- folds and frame -----------------------------------------------------

  function paintFolds(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < PANELS; i++) {
      const x = g.fr + i * g.pw;
      ctx.fillStyle = i % 2 ? '#000000' : '#fff6dc';
      ctx.globalAlpha = i % 2 ? 0.16 : 0.06;
      ctx.fillRect(Math.round(x), 0, Math.ceil(g.pw), g.H);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = FRAME.rim;
    for (let i = 1; i < PANELS; i++) {
      const x = Math.round(g.fr + i * g.pw);
      ctx.fillRect(x - 1, 0, Math.max(1, Math.round(g.U * 0.6)), g.H);
    }
    ctx.fillStyle = FRAME.lacquer;
    ctx.fillRect(0, 0, g.W, g.fr);
    ctx.fillRect(0, g.H - g.fr, g.W, g.fr);
    ctx.fillRect(0, 0, g.fr, g.H);
    ctx.fillRect(g.W - g.fr, 0, g.fr, g.H);
    ctx.strokeStyle = FRAME.inner;
    ctx.lineWidth = 1;
    ctx.strokeRect(g.fr + 0.5, g.fr + 0.5, g.W - g.fr * 2 - 1, g.H - g.fr * 2 - 1);
    return c;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.leaf = paintLeaf(g, rand);
    state.clouds = makeClouds(g, rand);
    state.front = paintFront(g, rand);
    state.folds = paintFolds(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { clouds, drift } = api.props;
    const count = Math.min(MAX_CLOUDS, Math.round(CLOUDS * clouds));
    ctx.drawImage(state.leaf, 0, 0);
    drawClouds(ctx, g, t, count, drift, false);
    ctx.drawImage(state.front, 0, 0);
    drawClouds(ctx, g, t, count, drift, true);
    ctx.drawImage(state.folds, 0, 0);
  }

  Kasuri.run({
    defaults: { clouds: 1, drift: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
