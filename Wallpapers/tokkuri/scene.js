/*
 * 徳利 Tokkuri — a sake flask and cup on a wooden counter, a paper lantern beside them,
 * snow falling past a lattice window. Everything still is baked once; steam puffs and
 * snowflakes are two short reused pools.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const FLAKES = 70;
  const PUFFS = 12;
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
    const u = Math.min(H / 100, W / 150);
    return {
      W, H, u,
      counter: Math.round(H * 0.68),
      win: { x0: W * 0.36, x1: W * 0.95, y0: H * 0.07, y1: H * 0.62 },
      lantern: { x: W * 0.17, y: H * 0.33 },
      flask: { x: W * 0.6, y: H * 0.68 },
      cup: { x: W * 0.73, y: H * 0.68 },
    };
  }

  function glow(ctx, x, y, r, rgb, a) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---- baked room ----------------------------------------------------------

  function paintWindowView(ctx, g) {
    const w = g.win;
    const wid = w.x1 - w.x0;
    const hei = w.y1 - w.y0;
    const gr = ctx.createLinearGradient(0, w.y0, 0, w.y1);
    gr.addColorStop(0, '#1f2a45');
    gr.addColorStop(1, '#3c4a68');
    ctx.fillStyle = gr;
    ctx.fillRect(w.x0, w.y0, wid, hei);
    // far hills under snow
    ctx.fillStyle = '#56627e';
    ctx.beginPath();
    ctx.moveTo(w.x0, w.y1);
    for (let i = 0; i <= 24; i++) {
      const x = w.x0 + (wid * i) / 24;
      ctx.lineTo(x, w.y1 - hei * (0.2 + 0.1 * Math.sin(i * 0.5) + 0.05 * Math.sin(i * 1.7)));
    }
    ctx.lineTo(w.x1, w.y1);
    ctx.fill();
    // snowy roof ridge, tiled eave of a neighbour house
    ctx.fillStyle = '#2b2f3f';
    ctx.beginPath();
    ctx.moveTo(w.x0 + wid * 0.5, w.y1);
    ctx.lineTo(w.x0 + wid * 0.68, w.y1 - hei * 0.34);
    ctx.lineTo(w.x1, w.y1 - hei * 0.18);
    ctx.lineTo(w.x1, w.y1);
    ctx.fill();
    ctx.fillStyle = '#d6dbe2';
    ctx.beginPath();
    ctx.moveTo(w.x0 + wid * 0.5, w.y1);
    ctx.lineTo(w.x0 + wid * 0.68, w.y1 - hei * 0.34);
    ctx.lineTo(w.x1, w.y1 - hei * 0.18);
    ctx.lineTo(w.x1, w.y1 - hei * 0.1);
    ctx.lineTo(w.x0 + wid * 0.68, w.y1 - hei * 0.26);
    ctx.lineTo(w.x0 + wid * 0.55, w.y1);
    ctx.fill();
    // pine branch with snow pads
    ctx.strokeStyle = '#1b2430';
    ctx.lineWidth = Math.max(1, g.u * 0.9);
    ctx.beginPath();
    ctx.moveTo(w.x0, w.y0 + hei * 0.3);
    ctx.quadraticCurveTo(w.x0 + wid * 0.18, w.y0 + hei * 0.26, w.x0 + wid * 0.34, w.y0 + hei * 0.38);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const px = w.x0 + wid * (0.07 + i * 0.075);
      const py = w.y0 + hei * (0.3 - i * 0.012 + (i % 2) * 0.05);
      ctx.fillStyle = '#233a33';
      blob(ctx, px, py, g.u * 5, g.u * 1.6);
      ctx.fillStyle = '#cfd6de';
      blob(ctx, px, py - g.u * 1.1, g.u * 4.2, g.u * 0.9);
    }
  }

  function paintLattice(ctx, g) {
    const w = g.win;
    const bar = Math.max(1, g.u * 0.9);
    const frame = Math.max(2, g.u * 2);
    ctx.fillStyle = '#4a3425';
    ctx.fillRect(w.x0 - frame, w.y0 - frame, w.x1 - w.x0 + frame * 2, frame);
    ctx.fillRect(w.x0 - frame, w.y1, w.x1 - w.x0 + frame * 2, frame * 1.2);
    ctx.fillRect(w.x0 - frame, w.y0, frame, w.y1 - w.y0);
    ctx.fillRect(w.x1, w.y0, frame, w.y1 - w.y0);
    // translucent paper panel along the bottom third, like a low shoji
    ctx.fillStyle = 'rgba(222,212,185,0.55)';
    ctx.fillRect(w.x0, w.y0 + (w.y1 - w.y0) * 0.72, w.x1 - w.x0, (w.y1 - w.y0) * 0.28);
    ctx.fillStyle = '#4a3425';
    for (let i = 1; i < 5; i++) ctx.fillRect(w.x0 + ((w.x1 - w.x0) * i) / 5 - bar / 2, w.y0, bar, w.y1 - w.y0);
    for (let j = 1; j < 4; j++) ctx.fillRect(w.x0, w.y0 + ((w.y1 - w.y0) * j) / 4 - bar / 2, w.x1 - w.x0, bar);
    // snow on the sill
    ctx.fillStyle = '#d9dee5';
    ctx.fillRect(w.x0 - frame, w.y1 - g.u * 0.4, w.x1 - w.x0 + frame * 2, g.u * 0.9);
  }

  function paintWall(ctx, g) {
    ctx.fillStyle = '#24201d';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#2d2722';
    for (let x = 0; x < g.W; x += g.u * 14) ctx.fillRect(x, 0, Math.max(1, g.u * 0.5), g.counter);
  }

  function paintLantern(ctx, g) {
    const l = g.lantern;
    const u = g.u;
    const rx = u * 8.5;
    const ry = u * 11;
    ctx.strokeStyle = '#1a1512';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(l.x, 0);
    ctx.lineTo(l.x, l.y - ry - u * 2);
    ctx.stroke();
    ctx.fillStyle = '#1a1512';
    ctx.fillRect(l.x - rx * 0.55, l.y - ry - u * 2, rx * 1.1, u * 2);
    const gr = ctx.createRadialGradient(l.x, l.y, u, l.x, l.y, rx * 1.3);
    gr.addColorStop(0, '#f2b45a');
    gr.addColorStop(0.6, '#d6602c');
    gr.addColorStop(1, '#a8341e');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,16,10,0.75)';
    ctx.lineWidth = Math.max(1, u * 0.4);
    for (let i = -3; i <= 3; i++) {
      const y = l.y + (ry * i) / 3.6;
      const k = Math.sqrt(Math.max(0, 1 - ((y - l.y) / ry) ** 2));
      ctx.beginPath();
      ctx.moveTo(l.x - rx * k, y);
      ctx.quadraticCurveTo(l.x, y + u * 0.9, l.x + rx * k, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#1a1512';
    ctx.fillRect(l.x - rx * 0.5, l.y + ry - u * 0.4, rx, u * 1.8);
    ctx.strokeStyle = '#c9a255';
    ctx.beginPath();
    ctx.moveTo(l.x, l.y + ry + u * 1.4);
    ctx.lineTo(l.x, l.y + ry + u * 5);
    ctx.stroke();
    ctx.fillStyle = '#b4442b';
    blob(ctx, l.x, l.y + ry + u * 6.4, u * 1, u * 1.8);
  }

  function paintCounter(ctx, g) {
    const y = g.counter;
    const u = g.u;
    ctx.fillStyle = '#6d4a2e';
    ctx.fillRect(0, y, g.W, u * 3.2);
    ctx.fillStyle = '#8a6240';
    ctx.fillRect(0, y, g.W, u * 0.8);
    ctx.fillStyle = '#3f2b1d';
    ctx.fillRect(0, y + u * 3.2, g.W, g.H - y);
    ctx.fillStyle = '#4c3322';
    for (let x = 0; x < g.W; x += u * 18) ctx.fillRect(x, y + u * 3.2, Math.max(1, u * 0.4), g.H - y);
    // grain
    const rand = K.rng(7);
    ctx.fillStyle = 'rgba(40,24,14,0.4)';
    for (let i = 0; i < 18; i++) ctx.fillRect(rand() * g.W, y + u * (0.8 + rand() * 2), u * (8 + rand() * 14), Math.max(1, u * 0.25));
    // small tray under the set
    ctx.fillStyle = '#17120f';
    ctx.fillRect(g.flask.x - u * 12, y - u * 1, u * 38, u * 1.4);
  }

  function paintFlask(ctx, g) {
    const f = g.flask;
    const u = g.u;
    const top = f.y - u * 24;
    // body outline: flared lip, thin neck, round belly
    ctx.beginPath();
    ctx.moveTo(f.x - u * 3.2, top);
    ctx.lineTo(f.x + u * 3.2, top);
    ctx.lineTo(f.x + u * 1.9, top + u * 2);
    ctx.lineTo(f.x + u * 1.9, top + u * 8);
    ctx.bezierCurveTo(f.x + u * 3, top + u * 11, f.x + u * 8.2, top + u * 14, f.x + u * 8.2, top + u * 19);
    ctx.bezierCurveTo(f.x + u * 8.2, f.y - u * 1, f.x + u * 5, f.y - u * 1.6, f.x, f.y - u * 1.6);
    ctx.bezierCurveTo(f.x - u * 5, f.y - u * 1.6, f.x - u * 8.2, f.y - u * 1, f.x - u * 8.2, top + u * 19);
    ctx.bezierCurveTo(f.x - u * 8.2, top + u * 14, f.x - u * 3, top + u * 11, f.x - u * 1.9, top + u * 8);
    ctx.lineTo(f.x - u * 1.9, top + u * 2);
    ctx.closePath();
    const gr = ctx.createLinearGradient(f.x - u * 8, 0, f.x + u * 8, 0);
    gr.addColorStop(0, '#12182c');
    gr.addColorStop(0.35, '#34446d');
    gr.addColorStop(1, '#161c33');
    ctx.fillStyle = gr;
    ctx.fill();
    // warm lantern rim on the near side
    ctx.strokeStyle = 'rgba(240,160,80,0.75)';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.beginPath();
    ctx.moveTo(f.x - u * 8, top + u * 18);
    ctx.bezierCurveTo(f.x - u * 8, f.y - u * 1, f.x - u * 5, f.y - u * 1.6, f.x - u * 1, f.y - u * 1.6);
    ctx.stroke();
    // pale glaze band
    ctx.fillStyle = '#d6cdb4';
    ctx.fillRect(f.x - u * 7.6, top + u * 17.2, u * 15.2, u * 1.5);
    // gold stripe at neck
    ctx.fillStyle = '#c9a255';
    ctx.fillRect(f.x - u * 1.9, top + u * 5.2, u * 3.8, Math.max(1, u * 0.7));
  }

  function paintCup(ctx, g) {
    const c = g.cup;
    const u = g.u;
    ctx.beginPath();
    ctx.moveTo(c.x - u * 4.6, c.y - u * 7);
    ctx.lineTo(c.x + u * 4.6, c.y - u * 7);
    ctx.bezierCurveTo(c.x + u * 4.4, c.y - u * 2.5, c.x + u * 2.6, c.y - u * 1.2, c.x + u * 1.6, c.y - u * 1);
    ctx.lineTo(c.x - u * 1.6, c.y - u * 1);
    ctx.bezierCurveTo(c.x - u * 2.6, c.y - u * 1.2, c.x - u * 4.4, c.y - u * 2.5, c.x - u * 4.6, c.y - u * 7);
    ctx.closePath();
    ctx.fillStyle = '#e4dcc4';
    ctx.fill();
    ctx.fillStyle = '#b4442b';
    ctx.fillRect(c.x - u * 4.4, c.y - u * 5.2, u * 8.8, Math.max(1, u * 0.8));
    ctx.fillStyle = '#e9a85c';
    blob(ctx, c.x, c.y - u * 7, u * 4.4, u * 0.9);
    ctx.fillStyle = '#ffd78a';
    blob(ctx, c.x - u * 1, c.y - u * 7, u * 1.8, u * 0.4);
  }

  function bake(ctx, g) {
    const base = layer(g.W, g.H);
    const bc = base.getContext('2d');
    paintWall(bc, g);
    paintWindowView(bc, g);
    paintLattice(bc, g);
    paintLantern(bc, g);
    paintCounter(bc, g);
    glow(bc, g.lantern.x, g.lantern.y, g.u * 55, '240,150,70', 0.38);
    paintFlask(bc, g);
    paintCup(bc, g);
    return base;
  }

  function bakeGlow(g) {
    const c = layer(g.W, g.H);
    glow(c.getContext('2d'), g.lantern.x, g.lantern.y, g.u * 30, '255,170,80', 0.35);
    return c;
  }

  // ---- moving things -------------------------------------------------------

  function makePools(g, rand) {
    const f = new Float32Array(FLAKES * 4);
    for (let i = 0; i < FLAKES; i++) {
      f[i * 4] = g.win.x0 + rand() * (g.win.x1 - g.win.x0);
      f[i * 4 + 1] = g.win.y0 + rand() * (g.win.y1 - g.win.y0);
      f[i * 4 + 2] = 0.6 + rand();
      f[i * 4 + 3] = rand() * TAU;
    }
    const s = new Float32Array(PUFFS * 2);
    for (let i = 0; i < PUFFS; i++) {
      s[i * 2] = i / PUFFS;
      s[i * 2 + 1] = rand();
    }
    return { flakes: f, puffs: s };
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const f = state.pools.flakes;
    const w = g.win;
    const n = Math.min(FLAKES, Math.round(FLAKES * amount * 0.5));
    ctx.fillStyle = '#eef0f3';
    const sz = Math.max(1, g.u * 0.8);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      f[k + 1] += dt * g.u * 5 * f[k + 2];
      f[k] += Math.sin(t * 0.8 + f[k + 3]) * dt * g.u * 1.5 - dt * g.u * 0.8;
      if (f[k + 1] > w.y1) { f[k + 1] = w.y0; f[k] = w.x0 + (f[k + 3] / TAU) * (w.x1 - w.x0); }
      if (f[k] < w.x0) f[k] = w.x1;
      ctx.fillRect(f[k], f[k + 1], sz, sz);
    }
  }

  function steamAt(ctx, g, t, dt, sx, sy, height, phase, amount) {
    const s = state.pools.puffs;
    const n = Math.min(PUFFS, Math.round(PUFFS * Math.min(1, amount)));
    for (let i = 0; i < n; i++) {
      const life = (t * 0.12 + s[i * 2] + phase) % 1;
      const y = sy - life * height;
      const x = sx + Math.sin(life * 7 + s[i * 2 + 1] * TAU) * g.u * (1 + life * 2.5);
      const a = Math.sin(life * Math.PI) * 0.42 * Math.min(1, amount);
      ctx.fillStyle = 'rgba(236,232,222,' + a.toFixed(3) + ')';
      blob(ctx, x, y, g.u * (1.1 + life * 2.4), g.u * (1.4 + life * 2.8));
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.base = bake(ctx, g);
    state.glow = bakeGlow(g);
    state.pools = makePools(g, K.rng(api.seed));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, steam } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.base, 0, 0);
    // window snow sits behind the lattice: redraw lattice slice is skipped, flakes stay thin
    drawSnow(ctx, g, t, step, snow);
    const breath = 0.8 + 0.2 * Math.sin(t * 0.7);
    ctx.globalAlpha = breath;
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    steamAt(ctx, g, t, step, g.flask.x, g.flask.y - g.u * 24, g.u * 20, 0, steam);
    steamAt(ctx, g, t, step, g.cup.x, g.cup.y - g.u * 7.5, g.u * 13, 0.37, steam * 0.8);
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
