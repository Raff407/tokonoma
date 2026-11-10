/*
 * 織部 Oribe — green-glazed Oribe ware on a dark table.
 *
 * A tea bowl and a square dish are baked once: deep copper green glaze, a cream clay
 * window painted with iron-brown checks, wave lines on the green. Each frame lays the
 * still scene down, then slides a soft band of light across the glaze, clipped to the
 * pottery, and drifts a pale window glow over the wall.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const GREEN = ['#1f3a2a', '#2c4d33', '#3d6340', '#5a8050'];
  const IRON = '#5e3f27';
  const CLAY = '#d9ccaa';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const r = Math.min(W * 0.23, U * 38);
    return { W, H, U, r, cx: W * 0.6, top: H * 0.3, table: H * 0.72 };
  }

  function bowlPath(g) {
    const p = new Path2D();
    const { cx, r, top } = g;
    const foot = r * 0.46;
    const bot = g.table - g.U * 2;
    p.moveTo(cx - r, top);
    p.bezierCurveTo(cx - r * 1.02, top + (bot - top) * 0.7, cx - foot * 1.4, bot - g.U * 1.5, cx - foot, bot);
    p.lineTo(cx + foot, bot);
    p.bezierCurveTo(cx + foot * 1.4, bot - g.U * 1.5, cx + r * 1.02, top + (bot - top) * 0.7, cx + r, top);
    p.ellipse(cx, top, r, r * 0.2, 0, 0, Math.PI, true);
    p.closePath();
    return p;
  }

  function paintWall(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const w = ctx.createLinearGradient(0, 0, 0, g.table);
    w.addColorStop(0, '#2a2e3a');
    w.addColorStop(1, '#5a5446');
    ctx.fillStyle = w;
    ctx.fillRect(0, 0, g.W, g.H);
    const t = ctx.createLinearGradient(0, g.table, 0, g.H);
    t.addColorStop(0, '#6a5038');
    t.addColorStop(1, '#33261b');
    ctx.fillStyle = t;
    ctx.fillRect(0, g.table, g.W, g.H - g.table);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = g.table + g.U * 3; y < g.H; y += g.U * 3) ctx.fillRect(0, y, g.W, Math.max(1, g.U * 0.25));
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(0, g.table - 1, g.W, Math.max(1, g.U * 0.5));
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W * 0.6, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, c.width, 0);
    gr.addColorStop(0, 'rgba(210,200,170,0)');
    gr.addColorStop(0.5, 'rgba(210,200,170,0.3)');
    gr.addColorStop(1, 'rgba(210,200,170,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, c.width, g.table);
    ctx.fillStyle = 'rgba(15,15,20,0.5)';
    const bar = Math.max(1, g.U * 0.8);
    for (let x = c.width * 0.2; x < c.width; x += c.width * 0.2) ctx.fillRect(x, 0, bar, g.table);
    return c;
  }

  function wave(ctx, x, y, w, amp, n) {
    ctx.beginPath();
    for (let i = 0; i <= n * 8; i++) {
      const f = i / (n * 8);
      const px = x + f * w;
      const py = y + Math.sin(f * n * TAU) * amp;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function checker(ctx, x, y, w, h, s) {
    ctx.fillStyle = IRON;
    for (let j = 0; j * s < h; j++) {
      for (let i = 0; i * s < w; i++) {
        if ((i + j) % 2 === 0) ctx.fillRect(x + i * s, y + j * s, Math.min(s, w - i * s), Math.min(s, h - j * s));
      }
    }
  }

  function paintBowl(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { cx, r, top, U } = g;
    const body = bowlPath(g);
    const bot = g.table - U * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.1, g.table + U * 0.5, r * 1.05, U * 2.2, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.clip(body);
    const sh = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    sh.addColorStop(0, GREEN[0]);
    sh.addColorStop(0.35, GREEN[2]);
    sh.addColorStop(0.7, GREEN[1]);
    sh.addColorStop(1, GREEN[0]);
    ctx.fillStyle = sh;
    ctx.fillRect(cx - r * 1.1, top - r * 0.3, r * 2.2, bot - top + r * 0.4);
    ctx.fillStyle = 'rgba(94,128,80,0.35)';
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(cx - r + rand() * r * 2, top + rand() * (bot - top), U * (0.4 + rand()), U * 0.3);
    }
    ctx.strokeStyle = IRON;
    ctx.lineWidth = Math.max(1, U * 0.45);
    for (let k = 0; k < 3; k++) wave(ctx, cx - r, top + r * (0.32 + k * 0.1), r * 0.9, U * 0.9, 4);
    ctx.fillStyle = CLAY;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.06, top + r * 0.3);
    ctx.lineTo(cx + r * 0.98, top + r * 0.25);
    ctx.lineTo(cx + r * 0.8, bot - U * 3);
    ctx.lineTo(cx + r * 0.12, bot - U * 6);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.06, top + r * 0.3);
    ctx.lineTo(cx + r * 0.98, top + r * 0.25);
    ctx.lineTo(cx + r * 0.8, bot - U * 3);
    ctx.lineTo(cx + r * 0.12, bot - U * 6);
    ctx.closePath();
    ctx.clip();
    checker(ctx, cx + r * 0.1, top + r * 0.34, r * 0.9, r * 0.8, Math.max(2, U * 2.4));
    ctx.strokeStyle = IRON;
    ctx.lineWidth = Math.max(1, U * 0.5);
    for (let k = 0; k < 3; k++) wave(ctx, cx + r * 0.1, top + r * (1.25 + k * 0.12), r * 0.85, U * 1, 3);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - r * 0.5, bot - U * 2, r, U * 2.4);
    ctx.restore();
    const rim = r * 0.2;
    ctx.fillStyle = GREEN[1];
    ctx.beginPath();
    ctx.ellipse(cx, top, r, rim, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = GREEN[0];
    ctx.beginPath();
    ctx.ellipse(cx, top + U * 0.3, r * 0.92, rim * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4b6a45';
    ctx.beginPath();
    ctx.ellipse(cx, top + rim * 0.5, r * 0.6, rim * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = IRON;
    ctx.lineWidth = Math.max(1, U * 0.5);
    ctx.beginPath();
    ctx.ellipse(cx, top, r, rim, 0, 0, TAU);
    ctx.stroke();
    return { canvas: c, path: body };
  }

  function dishPath(g) {
    const s = g.r * 1.05;
    const x = g.W * 0.12;
    const y = g.table + g.U * 9;
    const p = new Path2D();
    p.moveTo(x, y - g.U * 6);
    p.lineTo(x + s, y - g.U * 3);
    p.lineTo(x + s * 0.92, y + g.U * 7);
    p.lineTo(x - s * 0.1, y + g.U * 4);
    p.closePath();
    return { p, x, y, s };
  }

  function paintDish(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const d = dishPath(g);
    const U = g.U;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.save();
    ctx.translate(U * 0.8, U * 1.6);
    ctx.fill(d.p);
    ctx.restore();
    ctx.fillStyle = GREEN[0];
    ctx.fill(d.p);
    ctx.save();
    ctx.clip(d.p);
    const gr = ctx.createLinearGradient(d.x, 0, d.x + d.s, 0);
    gr.addColorStop(0, GREEN[1]);
    gr.addColorStop(0.5, GREEN[2]);
    gr.addColorStop(1, GREEN[1]);
    ctx.fillStyle = gr;
    ctx.fill(d.p);
    ctx.fillStyle = CLAY;
    ctx.beginPath();
    ctx.moveTo(d.x + d.s * 0.12, d.y - U * 3.6);
    ctx.lineTo(d.x + d.s * 0.62, d.y - U * 2);
    ctx.lineTo(d.x + d.s * 0.56, d.y + U * 3.4);
    ctx.lineTo(d.x + d.s * 0.08, d.y + U * 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = IRON;
    ctx.lineWidth = Math.max(1, U * 0.4);
    for (let k = 0; k < 3; k++) wave(ctx, d.x + d.s * 0.12, d.y - U * 2 + k * U * 1.6, d.s * 0.46, U * 0.5, 3);
    wave(ctx, d.x + d.s * 0.68, d.y - U * 1.5, d.s * 0.22, U * 0.7, 2);
    ctx.restore();
    ctx.strokeStyle = GREEN[3];
    ctx.lineWidth = Math.max(1, U * 0.3);
    ctx.stroke(d.p);
    return { canvas: c, path: d.p };
  }

  function paintBand(g) {
    const c = layer(g.W * 0.5, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, c.width, 0);
    gr.addColorStop(0, 'rgba(240,235,200,0)');
    gr.addColorStop(0.45, 'rgba(240,235,200,0.5)');
    gr.addColorStop(0.55, 'rgba(255,250,220,0.7)');
    gr.addColorStop(1, 'rgba(240,235,200,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, c.width, g.H);
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.wall = paintWall(g);
    state.glow = paintGlow(g);
    state.bowl = paintBowl(g, rand);
    state.dish = paintDish(g);
    state.band = paintBand(g);
  }

  function sweep(ctx, g, item, t, rate, phase, alpha) {
    const bw = state.band.width;
    const span = g.W + bw;
    const x = ((t * rate + phase * span) % span) - bw;
    ctx.save();
    ctx.clip(item.path);
    ctx.globalAlpha = alpha;
    ctx.drawImage(state.band, x, 0);
    ctx.restore();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sheen, light } = api.props;
    ctx.drawImage(state.wall, 0, 0);
    const gw = state.glow.width;
    const span = g.W + gw;
    const gx = ((t * g.W * 0.015) % span) - gw;
    ctx.globalAlpha = Math.min(1, light);
    ctx.drawImage(state.glow, gx, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.dish.canvas, 0, 0);
    ctx.drawImage(state.bowl.canvas, 0, 0);
    const a = Math.min(1, 0.8 * sheen);
    sweep(ctx, g, state.bowl, t, g.W * 0.05, 0.1, a);
    sweep(ctx, g, state.dish, t, g.W * 0.05, 0.1, a);
    sweep(ctx, g, state.bowl, t, g.W * 0.03, 0.6, a * 0.4);
  }

  Kasuri.run({
    defaults: { sheen: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
