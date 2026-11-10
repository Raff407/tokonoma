/*
 * 皮影 Piying — a backlit shadow-puppet scene.
 *
 * The lit paper, the far hills and pagoda, the near silhouettes (bridge, pavilion,
 * pines) and the frame are each baked once. Per frame: a gently wandering lamp glow,
 * one tiling strip of carved waves sliding sideways, one tiling strip of scroll clouds,
 * and a few small lanterns swinging under the eaves.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const INK = '#1e2434';
  const INDIGO = '#2d3a5c';
  const HAZE = '#56627e';
  const VERMILION = '#b4452d';
  const ROOF = '#7b2f26';
  const MOSS = '#34402c';
  const MOSS_LIT = '#4d5b3a';
  const GOLD = '#d8b25a';
  const WASHI = '#f0dfae';
  const PAPER = ['#f2dc9e', '#e8c987', '#d3a65c', '#a87a3c', '#6a4a26'];
  const LAMP = '#f6e2a6';
  const LANTERNS = 4;
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
    const u = U * Math.min(1, W / (U * 135));
    return { W, H, U, u, wy: Math.round(H * 0.85), frame: Math.max(2, U * 2.6) };
  }

  // ---- lit paper, glow, frame ----------------------------------------------

  function paintPaper(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(g.W * 0.5, g.H * 0.45, g.H * 0.05, g.W * 0.5, g.H * 0.5, g.W * 0.62);
    grad.addColorStop(0, PAPER[0]);
    grad.addColorStop(0.35, PAPER[1]);
    grad.addColorStop(0.7, PAPER[2]);
    grad.addColorStop(0.9, PAPER[3]);
    grad.addColorStop(1, PAPER[4]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // the moon, a slightly brighter disc on the paper
    ctx.fillStyle = LAMP;
    blob(ctx, g.W * 0.2, g.H * 0.2, g.U * 7.5, g.U * 7.5);
    ctx.fillStyle = WASHI;
    blob(ctx, g.W * 0.2, g.H * 0.2, g.U * 6, g.U * 6);
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(g.W * 0.5, g.H * 0.5, 0, g.W * 0.5, g.H * 0.5, g.W * 0.4);
    grad.addColorStop(0, 'rgba(250,236,178,1)');
    grad.addColorStop(0.5, 'rgba(244,220,150,0.55)');
    grad.addColorStop(1, 'rgba(240,210,130,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintFrame(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const f = g.frame;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, g.W, f);
    ctx.fillRect(0, g.H - f, g.W, f);
    ctx.fillRect(0, 0, f, g.H);
    ctx.fillRect(g.W - f, 0, f, g.H);
    ctx.strokeStyle = VERMILION;
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.strokeRect(f, f, g.W - f * 2, g.H - f * 2);
    return c;
  }

  // ---- far layer: hills and pagoda -----------------------------------------

  function ridge(g, x) {
    const spire = Math.abs(Math.sin(x / (g.U * 13) + 0.6)) ** 0.6;
    return g.H * 0.6 + fbm(x / (g.U * 25), 2.1, 3, 5) * g.H * 0.1 - spire * g.H * 0.17;
  }

  function ridgeNear(g, x) {
    return g.H * 0.68 + fbm(x / (g.U * 30), 6.4, 3, 9) * g.H * 0.07;
  }

  function pagoda(ctx, x, base, h, u) {
    const tiers = 7;
    const th = h / tiers;
    for (let i = 0; i < tiers; i++) {
      const y = base - i * th;
      const hw = u * (4.6 - i * 0.5);
      ctx.beginPath();
      ctx.moveTo(x - hw, y - th * 0.45);
      ctx.quadraticCurveTo(x - hw * 0.7, y - th * 0.2, x - hw * 0.5, y - th * 0.3);
      ctx.lineTo(x + hw * 0.5, y - th * 0.3);
      ctx.quadraticCurveTo(x + hw * 0.7, y - th * 0.2, x + hw, y - th * 0.45);
      ctx.lineTo(x + hw * 0.5, y - th * 0.8);
      ctx.lineTo(x - hw * 0.5, y - th * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - hw * 0.36, y - th * 0.3, hw * 0.72, th * 0.3);
    }
    ctx.fillRect(x - u * 0.2, base - h - u * 3, u * 0.4, u * 3);
    blob(ctx, x, base - h - u * 1.4, u * 0.7, u * 0.7);
  }

  function paintFar(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = HAZE;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x));
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
    pagoda(ctx, g.W * 0.36, ridge(g, g.W * 0.36) + g.U * 3, g.u * 26, g.u * 1.2);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = INDIGO;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridgeNear(g, x));
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- near layer: pines, bridge, pavilion -----------------------------------

  function pad(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x - w, y + h * 0.4);
    ctx.bezierCurveTo(x - w * 1.05, y - h * 0.6, x - w * 0.4, y - h * 1.1, x, y - h * 0.8);
    ctx.bezierCurveTo(x + w * 0.4, y - h * 1.1, x + w * 1.05, y - h * 0.6, x + w, y + h * 0.4);
    ctx.bezierCurveTo(x + w * 0.5, y + h * 0.1, x - w * 0.5, y + h * 0.1, x - w, y + h * 0.4);
    ctx.fill();
  }

  // A pine as a leaning trunk with cloud-shaped pads of needles.
  function pine(ctx, x, y, h, lean, seed) {
    const r = K.rng(seed);
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, h * 0.07);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - lean * 0.6, y - h * 0.35, x + lean * 0.8, y - h * 0.55, x + lean, y - h * 0.92);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const f = 0.4 + i * 0.14;
      const side = i % 2 ? 1 : -1;
      const w = h * (0.3 - f * 0.12) * (0.9 + r() * 0.3);
      const px = x + lean * f * f + side * h * 0.17 * (1 - f * 0.5);
      ctx.fillStyle = MOSS;
      pad(ctx, px, y - h * f, w, w * 0.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, h * 0.03);
      ctx.beginPath();
      ctx.moveTo(x + lean * f * f, y - h * f + h * 0.04);
      ctx.lineTo(px, y - h * f + w * 0.1);
      ctx.stroke();
    }
    ctx.fillStyle = MOSS;
    pad(ctx, x + lean, y - h * 0.94, h * 0.2, h * 0.1);
  }

  function rocks(ctx, g, x0, x1, y, rand) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x0, g.H);
    for (let x = x0; x <= x1; x += g.U) {
      const f = (x - x0) / (x1 - x0);
      ctx.lineTo(x, y - Math.sin(f * Math.PI) * g.U * 3.5 - rand() * g.U * 1.2);
    }
    ctx.lineTo(x1, g.H);
    ctx.fill();
  }

  function eaves(ctx, cx, y, hw, h, u, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - hw, y - u * 2.4);
    ctx.quadraticCurveTo(cx - hw * 0.85, y + u * 0.9, cx - hw * 0.5, y + u * 0.4);
    ctx.lineTo(cx + hw * 0.5, y + u * 0.4);
    ctx.quadraticCurveTo(cx + hw * 0.85, y + u * 0.9, cx + hw, y - u * 2.4);
    ctx.quadraticCurveTo(cx + hw * 0.6, y - h * 0.3, cx + hw * 0.2, y - h);
    ctx.lineTo(cx - hw * 0.2, y - h);
    ctx.quadraticCurveTo(cx - hw * 0.6, y - h * 0.3, cx - hw, y - u * 2.4);
    ctx.fill();
    // ridge ends curling up
    ctx.fillStyle = INK;
    blob(ctx, cx - hw * 0.2, y - h - u * 0.5, u * 0.9, u * 1);
    blob(ctx, cx + hw * 0.2, y - h - u * 0.5, u * 0.9, u * 1);
    // carved tile lines
    ctx.strokeStyle = PAPER[1];
    ctx.lineWidth = Math.max(1, u * 0.28);
    const n = Math.max(4, Math.round(hw / (u * 1.5)));
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const x = cx + (f - 0.5) * hw * 1.7;
      ctx.moveTo(x, y - h * 0.15);
      ctx.lineTo(cx + (x - cx) * 0.32, y - h * 0.9);
    }
    ctx.stroke();
  }

  function pavilion(ctx, g, cx, by) {
    const u = g.u * 1.45;
    ctx.fillStyle = INK;
    ctx.fillRect(cx - u * 12, by - u * 1.4, u * 24, u * 1.4);
    ctx.fillRect(cx - u * 13.5, by, u * 27, u * 1.2);
    // lower hall: lit paper panels between posts
    const top = by - u * 1.4 - u * 8;
    ctx.fillStyle = INK;
    ctx.fillRect(cx - u * 9.5, top, u * 19, u * 8);
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - u * 8.4 + i * u * 5.8, top + u * 1.4, u * 4.6, u * 5.4);
    ctx.fillStyle = INK;
    for (let i = 0; i < 3; i++) {
      const x = cx - u * 8.4 + i * u * 5.8;
      ctx.fillRect(x + u * 2.2, top + u * 1.4, Math.max(1, u * 0.35), u * 5.4);
      ctx.fillRect(x, top + u * 3.9, u * 4.6, Math.max(1, u * 0.35));
    }
    eaves(ctx, cx, top, u * 15, u * 5, u, ROOF);
    // upper storey
    const top2 = top - u * 5 - u * 0.5;
    ctx.fillStyle = INK;
    ctx.fillRect(cx - u * 4.6, top2 - u * 4.2, u * 9.2, u * 4.2);
    ctx.fillStyle = GOLD;
    ctx.fillRect(cx - u * 3.4, top2 - u * 3.4, u * 2.8, u * 2.6);
    ctx.fillRect(cx + u * 0.6, top2 - u * 3.4, u * 2.8, u * 2.6);
    eaves(ctx, cx, top2 - u * 4.2, u * 10.5, u * 5.2, u, ROOF);
    const tip = top2 - u * 4.2 - u * 5.2;
    ctx.fillStyle = INK;
    ctx.fillRect(cx - u * 0.2, tip - u * 3, u * 0.4, u * 3);
    blob(ctx, cx, tip - u * 3.2, u * 0.7, u * 0.9);
    return { eaves: [[cx - u * 15, top - u * 2.4], [cx + u * 15, top - u * 2.4], [cx - u * 10.5, top2 - u * 4.2 - u * 2.4], [cx + u * 10.5, top2 - u * 4.2 - u * 2.4]] };
  }

  function bridge(ctx, g, xa, xb, wl) {
    const u = g.u;
    const xm = (xa + xb) / 2;
    const hw = (xb - xa) / 2;
    const rise = u * 11;
    const deck = (x) => wl - u * 6 - rise * (1 - ((x - xm) / hw) ** 2);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(xa, wl + u);
    for (let x = xa; x <= xb; x += 2) ctx.lineTo(x, deck(x));
    ctx.lineTo(xb, wl + u);
    ctx.lineTo(xa, wl + u);
    ctx.moveTo(xm + hw * 0.52, wl + u);
    ctx.ellipse(xm, wl + u, hw * 0.52, rise + u * 3.2, 0, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill('evenodd');
    // railing with posts and a top rail
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, u * 0.55);
    ctx.beginPath();
    for (let x = xa; x <= xb; x += 2) {
      const y = deck(x) - u * 2.4;
      if (x === xa) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = INK;
    for (let x = xa + u; x <= xb; x += u * 2.8) ctx.fillRect(x - u * 0.25, deck(x) - u * 2.4, u * 0.5, u * 2.4);
    for (const x of [xa + u * 0.6, xb - u * 0.6]) blob(ctx, x, deck(x) - u * 3, u * 0.9, u * 0.9);
  }

  function paintNear(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wl = g.wy;
    const u = g.u;
    rocks(ctx, g, g.W * 0.62, g.W * 0.92, wl + u * 2.5, rand);
    bridge(ctx, g, g.W * 0.12, g.W * 0.58, wl);
    const p = pavilion(ctx, g, g.W * 0.77, wl - u * 0.5);
    pine(ctx, g.W * 0.07, wl + u * 2, g.U * 44, g.U * 6, 3);
    pine(ctx, g.W * 0.94, wl + u * 2, g.U * 36, -g.U * 5, 8);
    pine(ctx, g.W * 0.61, wl, g.U * 20, g.U * 2, 12);
    state.eaves = p.eaves;
    return c;
  }

  // ---- carved waves --------------------------------------------------------

  function paintWaves(g) {
    const R = Math.max(3, g.U * 2.6);
    const P = R * 2;
    const h = g.H - g.wy;
    const c = layer(g.W + P * 2, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = INDIGO;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = Math.max(1, g.U * 0.34);
    const step = R * 0.5;
    for (let j = 0, y = -R * 0.3; y < h + R; j++, y += step) {
      const t = Math.min(1, Math.max(0, y / h));
      ctx.strokeStyle = t < 0.5 ? GOLD : '#b48d49';
      ctx.fillStyle = t < 0.5 ? INDIGO : INK;
      for (let x = (j % 2) * R; x < c.width + P; x += P) {
        ctx.beginPath();
        ctx.arc(x, y + R, R, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y + R, R, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
    }
    return { canvas: c, period: P };
  }

  // ---- clouds --------------------------------------------------------------

  function cloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s * 2, y);
    ctx.arc(x - s * 1.1, y - s * 0.35, s * 0.9, Math.PI, Math.PI * 1.75);
    ctx.arc(x + s * 0.1, y - s * 0.7, s * 1.25, Math.PI * 1.2, Math.PI * 1.9);
    ctx.arc(x + s * 1.3, y - s * 0.3, s * 0.85, Math.PI * 1.35, Math.PI * 0.1);
    ctx.lineTo(x + s * 1.6, y);
    ctx.closePath();
    ctx.fill();
    // curling tail
    ctx.beginPath();
    ctx.arc(x - s * 2.3, y - s * 0.05, s * 0.4, Math.PI * 0.2, Math.PI * 1.7);
    ctx.lineTo(x - s * 1.6, y);
    ctx.fill();
  }

  function paintClouds(g, rand) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.4);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3b4768';
    ctx.globalAlpha = 0.55;
    const n = 5;
    for (let i = 0; i < n; i++) cloud(ctx, ((i + 0.3 + rand() * 0.3) / n) * w, g.U * (8 + (i % 3) * 12), g.U * (2.6 + rand() * 1.6));
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.paper = paintPaper(g);
    state.glow = paintGlow(g);
    state.far = paintFar(g);
    state.waves = paintWaves(g);
    state.near = paintNear(g, rand);
    state.clouds = paintClouds(g, rand);
    state.frame = paintFrame(g);
  }

  function drawLanterns(ctx, g, t) {
    const u = g.u;
    for (let i = 0; i < LANTERNS; i++) {
      const e = state.eaves[i];
      const sway = Math.sin(t * 0.9 + i * 1.7) * u * 0.5;
      const len = u * 2.2;
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, u * 0.25);
      ctx.beginPath();
      ctx.moveTo(e[0], e[1]);
      ctx.lineTo(e[0] + sway, e[1] + len);
      ctx.stroke();
      ctx.fillStyle = VERMILION;
      blob(ctx, e[0] + sway, e[1] + len + u * 1.1, u * 0.95, u * 1.3);
      ctx.fillStyle = GOLD;
      ctx.fillRect(e[0] + sway - u * 0.3, e[1] + len + u * 2.2, u * 0.6, u * 0.9);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { flicker, clouds, lanterns } = api.props;
    ctx.drawImage(state.paper, 0, 0);
    const wob = Math.sin(t * 1.3) * 0.5 + Math.sin(t * 2.9 + 1) * 0.3 + Math.sin(t * 0.37) * 0.6;
    ctx.globalAlpha = Math.min(1, Math.max(0, 0.62 + wob * 0.18 * flicker));
    ctx.drawImage(state.glow, Math.sin(t * 0.5) * g.U * 1.2 * flicker, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.far, 0, 0);
    if (clouds > 0) {
      const m = state.clouds;
      const a = (t * g.U * 1.6 * clouds) % m.width;
      ctx.drawImage(m, -a, g.H * 0.08);
      ctx.drawImage(m, m.width - a, g.H * 0.08);
    }
    const wv = state.waves;
    ctx.drawImage(wv.canvas, -((t * g.U * 0.9) % wv.period), g.wy);
    ctx.drawImage(state.near, 0, 0);
    if (lanterns) drawLanterns(ctx, g, t);
    ctx.drawImage(state.frame, 0, 0);
  }

  Kasuri.run({
    defaults: { flicker: 1, clouds: 1, lanterns: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
