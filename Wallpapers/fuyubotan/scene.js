/*
 * 冬牡丹 Fuyubotan — winter peonies under little straw tents in a snowy garden.
 *
 * Wall, lantern, pine and the tents are baked once. Each bloom sits on its own small
 * layer that sways a hair in the wind; snow is a short reused pool and a mist strip
 * drifts across the wall.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;
  const TAU = Math.PI * 2;
  const FLAKES = 150;
  const SKY = ['#8a929a', '#a3a8aa', '#bcbcb4', '#cfcdc2'];
  const STRAW = ['#6f5a36', '#8f7644', '#b19458', '#cdb274'];
  const BLOOM = ['#9c2c1f', '#c13a26', '#d6452c', '#e8745a', '#f2b08a'];
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
    return { W, H, U, hy: Math.round(H * 0.5) };
  }

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.hy);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.hy + 2);
  }

  function hills(ctx, g, rand) {
    ctx.fillStyle = '#9ea4a4';
    ctx.beginPath();
    ctx.moveTo(0, g.hy);
    for (let x = 0; x <= g.W + 4; x += 4) {
      ctx.lineTo(x, g.H * 0.2 + K.fbm(x / (g.U * 40), 2.2, 3, 7) * g.H * 0.1 + Math.sin(x / g.W * 3) * g.U * 2);
    }
    ctx.lineTo(g.W, g.hy);
    ctx.fill();
    ctx.fillStyle = '#7f8b84';
    for (let x = 0; x < g.W; x += g.U * (2 + rand() * 3)) {
      const r = g.U * (2 + rand() * 2);
      blob(ctx, x, g.H * 0.3 + rand() * g.U * 3, r, r * 0.7);
    }
  }

  // Earthen wall with a tiled cap, snow lying along the top.
  function wall(ctx, g, rand) {
    const top = g.hy - g.U * 15;
    ctx.fillStyle = '#dcd5c0';
    ctx.fillRect(0, top, g.W, g.hy - top);
    ctx.fillStyle = '#c9c0a8';
    for (let x = 0; x < g.W; x += g.U * (6 + rand() * 6)) {
      ctx.fillRect(x, top + g.U * 5, g.U * (2 + rand() * 3), Math.max(1, g.U * 0.5));
    }
    ctx.fillStyle = '#6f6a5e';
    ctx.fillRect(0, g.hy - g.U * 2.2, g.W, g.U * 2.2);
    ctx.fillStyle = '#3c3a3a';
    ctx.fillRect(0, top - g.U * 2.4, g.W, g.U * 2.4);
    ctx.fillStyle = '#58544f';
    for (let x = 0; x < g.W; x += g.U * 2.4) ctx.fillRect(x, top - g.U * 2.4, Math.max(1, g.U * 0.35), g.U * 2.4);
    ctx.fillStyle = '#f4f2ec';
    for (let x = -g.U; x < g.W; x += g.U * 3) {
      blob(ctx, x + g.U * 1.5, top - g.U * 2.6, g.U * 2.1, g.U * 0.9 + rand() * g.U * 0.4);
    }
    ctx.fillRect(0, top - g.U * 2.8, g.W, g.U * 0.6);
  }

  function pine(ctx, g, x, y, h) {
    const U = g.U;
    ctx.strokeStyle = '#3b2f26';
    ctx.lineWidth = Math.max(1.5, h * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - h * 0.12, y - h * 0.5, x + h * 0.06, y - h);
    ctx.stroke();
    const pads = [[0.45, -1, 0.3], [0.62, 1, 0.28], [0.78, -1, 0.24], [0.93, 1, 0.2]];
    for (const p of pads) {
      const px = x + p[1] * h * 0.2 * (1.1 - p[0] * 0.5);
      const py = y - h * p[0];
      const w = h * p[2];
      ctx.fillStyle = '#2b4030';
      blob(ctx, px, py, w, w * 0.4);
      ctx.fillStyle = '#41593a';
      blob(ctx, px - w * 0.1, py - w * 0.12, w * 0.72, w * 0.26);
      ctx.fillStyle = '#f2f0ea';
      blob(ctx, px - w * 0.05, py - w * 0.34, w * 0.66, w * 0.14);
    }
    // rope props fan out from the top
    ctx.strokeStyle = '#a98f5a';
    ctx.lineWidth = Math.max(1, U * 0.3);
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) {
      ctx.moveTo(x + h * 0.06, y - h * 1.02);
      ctx.lineTo(x + h * 0.06 + i * h * 0.13, y - h * 0.5);
    }
    ctx.stroke();
  }

  function lantern(ctx, g, x, y, s) {
    ctx.fillStyle = '#8a877d';
    ctx.fillRect(x - s * 0.9, y - s * 1.2, s * 1.8, s * 1.2);
    ctx.fillStyle = '#767368';
    ctx.fillRect(x - s * 0.5, y - s * 3.4, s, s * 2.3);
    ctx.fillStyle = '#9b988c';
    ctx.fillRect(x - s * 1.3, y - s * 4, s * 2.6, s * 0.6);
    ctx.fillStyle = '#2d2a26';
    ctx.fillRect(x - s * 0.7, y - s * 5.2, s * 1.4, s * 1.2);
    ctx.fillStyle = '#e8b45a';
    ctx.fillRect(x - s * 0.4, y - s * 4.9, s * 0.8, s * 0.6);
    ctx.fillStyle = '#85827a';
    ctx.beginPath();
    ctx.moveTo(x - s * 2, y - s * 5.2);
    ctx.lineTo(x, y - s * 6.6);
    ctx.lineTo(x + s * 2, y - s * 5.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f2ec';
    ctx.beginPath();
    ctx.moveTo(x - s * 1.6, y - s * 5.5);
    ctx.quadraticCurveTo(x, y - s * 7.6, x + s * 1.6, y - s * 5.5);
    ctx.quadraticCurveTo(x, y - s * 6.3, x - s * 1.6, y - s * 5.5);
    ctx.fill();
    ctx.fillRect(x - s * 1.3, y - s * 4.2, s * 2.6, s * 0.3);
  }

  function ground(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.hy, 0, g.H);
    grad.addColorStop(0, '#d6d9d9');
    grad.addColorStop(0.5, '#e9eaea');
    grad.addColorStop(1, '#f6f6f3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.hy, g.W, g.H - g.hy);
    ctx.fillStyle = '#c3c8cc';
    for (let i = 0; i < 40; i++) {
      blob(ctx, rand() * g.W, g.hy + g.U * 2 + rand() * (g.H - g.hy), g.U * (3 + rand() * 6), g.U * (0.3 + rand() * 0.4));
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    hills(ctx, g, rand);
    wall(ctx, g, rand);
    pine(ctx, g, g.W * 0.14, g.hy + g.U * 3, g.U * 44);
    ground(ctx, g, rand);
    lantern(ctx, g, g.W * 0.8, g.hy + g.U * 8, g.U * 2.6);
    return c;
  }

  // One peony: layered petals in warm reds with a gold heart.
  function peony(ctx, x, y, r, rand) {
    for (let ring = 0; ring < 4; ring++) {
      const n = 7 - ring;
      const rr = r * (1 - ring * 0.2);
      ctx.fillStyle = BLOOM[ring];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring * 0.5 + rand() * 0.2;
        blob(ctx, x + Math.cos(a) * rr * 0.5, y + Math.sin(a) * rr * 0.42, rr * 0.5, rr * 0.4);
      }
    }
    ctx.fillStyle = BLOOM[4];
    blob(ctx, x, y - r * 0.05, r * 0.28, r * 0.22);
    ctx.fillStyle = '#d9a640';
    blob(ctx, x, y - r * 0.05, r * 0.12, r * 0.1);
  }

  // Bloom layer for a tent: dark leaves and the flowers seen through the open front.
  function paintBlooms(g, s, rand) {
    const w = Math.ceil(s * 2.4);
    const h = Math.ceil(s * 1.4);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2f4430';
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i / 7) * Math.PI;
      blob(ctx, w / 2 + Math.cos(a) * s * 0.7, h * 0.8 + Math.sin(a) * s * 0.5, s * 0.34, s * 0.14);
    }
    ctx.fillStyle = '#486040';
    blob(ctx, w / 2, h * 0.85, s * 0.6, s * 0.14);
    peony(ctx, w / 2 - s * 0.38, h * 0.62, s * 0.5, rand);
    peony(ctx, w / 2 + s * 0.4, h * 0.66, s * 0.44, rand);
    peony(ctx, w / 2, h * 0.38, s * 0.54, rand);
    return { canvas: c, ox: w / 2, oy: h };
  }

  // The straw hood: a domed shell with a dark opening at the front.
  function paintTent(ctx, x, y, s, rand) {
    ctx.beginPath();
    ctx.moveTo(x - s * 1.05, y);
    ctx.quadraticCurveTo(x - s * 1.1, y - s * 1.6, x, y - s * 1.85);
    ctx.quadraticCurveTo(x + s * 1.1, y - s * 1.6, x + s * 1.05, y);
    ctx.closePath();
    ctx.fillStyle = STRAW[1];
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = -9; i <= 9; i++) {
      ctx.strokeStyle = STRAW[rand() < 0.5 ? 0 : 3];
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + i * s * 0.03, y - s * 1.85);
      ctx.lineTo(x + i * s * 0.14, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#2a211a';
    blob(ctx, x, y - s * 0.62, s * 0.72, s * 0.58);
    ctx.fillStyle = '#e4e6e4';
    blob(ctx, x, y + s * 0.03, s * 1.25, s * 0.2);
  }

  function paintCover(g, s, x, y, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#4b3a28';
    ctx.lineWidth = Math.max(1.2, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(x - s * 1.03, y - s * 1.2);
    ctx.quadraticCurveTo(x, y - s * 1.0, x + s * 1.03, y - s * 1.2);
    ctx.stroke();
    ctx.fillStyle = '#f6f5f0';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.95, y - s * 1.3);
    ctx.quadraticCurveTo(x - s * 0.6, y - s * 1.85, x, y - s * 2.02);
    ctx.quadraticCurveTo(x + s * 0.6, y - s * 1.85, x + s * 0.95, y - s * 1.3);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 1.55, x, y - s * 1.45);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 1.55, x - s * 0.95, y - s * 1.3);
    ctx.fill();
    ctx.fillStyle = '#f2f3f1';
    blob(ctx, x - s * 0.6, y + s * 0.03, s * 0.8, s * 0.13);
    blob(ctx, x + s * 0.7, y + s * 0.03, s * 0.7, s * 0.13);
    return c;
  }

  function buildTents(g, rand) {
    const spec = [[0.28, 0.9, 13], [0.55, 0.74, 10], [0.78, 0.96, 15], [0.93, 0.7, 8.5]];
    spec.sort((a, b) => a[1] - b[1]);
    const dark = layer(g.W, g.H);
    const dctx = dark.getContext('2d');
    const tents = spec.map((sp) => {
      const s = g.U * sp[2];
      const x = g.W * sp[0];
      const y = g.H * sp[1] * 0.98;
      paintTent(dctx, x, y, s, rand);
      return { x, y, s, blooms: paintBlooms(g, s, rand), cover: paintCover(g, s, x, y, rand), ph: rand() * TAU };
    });
    return { dark, tents };
  }

  function makeFlakes(g, rand) {
    const f = { x: new Float32Array(FLAKES), y: new Float32Array(FLAKES), v: new Float32Array(FLAKES),
      s: new Float32Array(FLAKES), p: new Float32Array(FLAKES) };
    for (let i = 0; i < FLAKES; i++) {
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.H;
      f.v[i] = 0.5 + rand();
      f.s[i] = rand();
      f.p[i] = rand() * TAU;
    }
    return f;
  }

  function drawSnow(ctx, g, t, dt, count, wind) {
    const f = state.flakes;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      f.y[i] += g.U * 6 * f.v[i] * step;
      f.x[i] += (Math.sin(t * 0.6 + f.p[i]) * 1.2 + wind * 1.4) * g.U * 0.9 * step;
      if (f.y[i] > g.H + 2) { f.y[i] = -2; f.x[i] = (f.x[i] * 7.31 + 13) % g.W; }
      if (f.x[i] > g.W + 2) f.x[i] = -2;
      const sz = Math.max(1, g.U * (0.5 + f.s[i] * 0.8));
      ctx.globalAlpha = 0.6 + 0.35 * f.s[i];
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(f.x[i], f.y[i], sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t) {
    const m = state.mist;
    const a = (t * g.U * 0.8) % g.W;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(m, -a, g.hy - g.U * 9);
    ctx.drawImage(m, g.W - a, g.hy - g.U * 9);
    ctx.globalAlpha = 1;
  }

  function paintMist(g, rand) {
    const c = layer(g.W, g.U * 10);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e6e6e0';
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * g.W + rand() * g.U * 6;
      for (const dx of [-g.W, 0, g.W]) blob(ctx, x + dx, g.U * (3 + rand() * 4), g.U * (10 + rand() * 8), g.U * (1.2 + rand()));
    }
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.set = buildTents(g, rand);
    state.mist = paintMist(g, rand);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, wind } = api.props;
    const count = Math.min(FLAKES, Math.round(100 * snow));
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t);
    ctx.drawImage(state.set.dark, 0, 0);
    for (const tent of state.set.tents) {
      const b = tent.blooms;
      const sway = Math.sin(t * 0.7 + tent.ph) * 0.03 * (0.4 + wind);
      const bx = tent.x;
      const by = tent.y - tent.s * 0.05;
      ctx.setTransform(Math.cos(sway), Math.sin(sway), -Math.sin(sway), Math.cos(sway), bx, by);
      ctx.drawImage(b.canvas, -b.ox, -b.oy);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(tent.cover, 0, 0);
    }
    drawSnow(ctx, g, t, dt, count, wind);
  }

  Kasuri.run({
    defaults: { snow: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
