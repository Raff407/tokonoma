/*
 * 霜柱 Shimobashira — frost pillars on a cedar forest floor, low winter sun.
 *
 * Trees, lantern, ground and frost are baked once. Light shafts are one baked layer
 * whose strength breathes slowly. Mist is one tiling strip. Glints are a short fixed list.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const GLINTS = 36;
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
    return { W, H, U, gy: Math.round(H * 0.5), sx: W * 0.14, sy: H * 0.3 };
  }

  // ---- cedar wood ----------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.gy);
    grad.addColorStop(0, '#26344a');
    grad.addColorStop(0.55, '#5a6c78');
    grad.addColorStop(1, '#b4aa88');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.gy + 1);
    const glow = ctx.createRadialGradient(g.sx, g.sy, 0, g.sx, g.sy, g.W * 0.5);
    glow.addColorStop(0, 'rgba(232,206,142,0.95)');
    glow.addColorStop(0.25, 'rgba(222,192,128,0.5)');
    glow.addColorStop(1, 'rgba(222,192,128,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.gy + 1);
  }

  // One cedar trunk: a tapering post with a bright edge toward the sun and a few bark lines.
  function trunk(ctx, g, rand, x, w, ink, edge, fog) {
    const top = -g.U * 4;
    const bot = g.gy + g.U * 3;
    ctx.fillStyle = ink;
    poly(ctx, [x - w * 0.42, top, x + w * 0.42, top, x + w * 0.5, bot, x - w * 0.5, bot]);
    ctx.fillStyle = edge;
    poly(ctx, [x - w * 0.42, top, x - w * 0.2, top, x - w * 0.26, bot, x - w * 0.5, bot]);
    ctx.fillStyle = 'rgba(20,24,30,0.35)';
    for (let i = 0; i < 4; i++) {
      const bx = x + (rand() - 0.2) * w * 0.6;
      ctx.fillRect(bx, top, Math.max(0.6, w * 0.05), bot - top);
    }
    const haze = ctx.createLinearGradient(0, bot - g.U * 22, 0, bot);
    haze.addColorStop(0, 'rgba(170,176,170,0)');
    haze.addColorStop(1, 'rgba(170,176,170,' + fog + ')');
    ctx.fillStyle = haze;
    ctx.fillRect(x - w, bot - g.U * 22, w * 2, g.U * 22);
  }

  function paintWood(g, rand) {
    const c = layer(g.W, g.gy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    const rows = [
      { n: 9, w: 3.2, ink: '#4a5a56', edge: '#7e8670', fog: 0.45 },
      { n: 6, w: 5.5, ink: '#34453f', edge: '#7a7a5a', fog: 0.28 },
      { n: 4, w: 9, ink: '#243430', edge: '#8c7a4c', fog: 0.12 },
    ];
    for (const r of rows) {
      for (let i = 0; i < r.n; i++) {
        const x = ((i + 0.2 + rand() * 0.6) / r.n) * g.W;
        trunk(ctx, g, rand, x, g.U * r.w * (0.8 + rand() * 0.4), r.ink, r.edge, r.fog);
      }
    }
    return c;
  }

  // ---- stone lantern -------------------------------------------------------

  function lantern(ctx, g, x, y, s) {
    const stone = '#7c8078';
    const lit = '#a69f84';
    const dark = '#4c5450';
    ctx.fillStyle = dark;
    blob(ctx, x, y, s * 7, s * 1.6);
    ctx.fillStyle = stone;
    ctx.fillRect(x - s * 5, y - s * 3, s * 10, s * 2.6);
    ctx.fillRect(x - s * 1.6, y - s * 16, s * 3.2, s * 13);
    ctx.fillStyle = lit;
    ctx.fillRect(x - s * 1.6, y - s * 16, s * 1.1, s * 13);
    ctx.fillStyle = stone;
    ctx.fillRect(x - s * 5, y - s * 18.6, s * 10, s * 2.8);
    ctx.fillStyle = lit;
    ctx.fillRect(x - s * 5, y - s * 18.6, s * 3, s * 2.8);
    ctx.fillStyle = dark;
    ctx.fillRect(x - s * 3, y - s * 25, s * 6, s * 6.4);
    ctx.fillStyle = '#d2b86a';
    ctx.fillRect(x - s * 1.4, y - s * 23.6, s * 2.8, s * 3.6);
    ctx.fillStyle = stone;
    poly(ctx, [x - s * 9, y - s * 25, x + s * 9, y - s * 25, x + s * 4, y - s * 30, x - s * 4, y - s * 30]);
    ctx.fillStyle = lit;
    poly(ctx, [x - s * 9, y - s * 25, x - s * 3, y - s * 25, x - s * 2, y - s * 30, x - s * 4, y - s * 30]);
    blob(ctx, x, y - s * 31.4, s * 1.8, s * 2.2);
    ctx.fillStyle = '#e8ecee';
    blob(ctx, x - s * 0.5, y - s * 33, s * 2.6, s * 0.8);
    blob(ctx, x - s * 4, y - s * 30.4, s * 3.6, s * 0.7);
    ctx.fillStyle = '#5c7a48';
    blob(ctx, x + s * 3, y - s * 3.2, s * 2.2, s * 0.8);
    blob(ctx, x - s * 4, y - s * 0.6, s * 3, s * 1);
  }

  // ---- ground and frost ----------------------------------------------------

  function paintSoil(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.gy, 0, g.H);
    grad.addColorStop(0, '#6c7468');
    grad.addColorStop(0.2, '#4f4a3c');
    grad.addColorStop(1, '#2c2620');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.gy, g.W, g.H - g.gy);
    for (let i = 0; i < 260; i++) {
      const y = g.gy + Math.pow(rand(), 1.6) * (g.H - g.gy);
      const f = (y - g.gy) / (g.H - g.gy);
      const r = g.U * (0.4 + f * 1.8) * (0.5 + rand());
      ctx.fillStyle = rand() < 0.5 ? '#4e6a3c' : (rand() < 0.5 ? '#3c3228' : '#6a5a3c');
      ctx.globalAlpha = 0.5;
      blob(ctx, rand() * g.W, y, r * 1.6, r * 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // Frozen maple and ginkgo leaves lying flat on the soil.
  function paintLeaves(ctx, g, rand) {
    const tones = ['#a8432a', '#c0652e', '#8a3a28', '#d0a040'];
    for (let i = 0; i < 70; i++) {
      const y = g.gy + g.U * 2 + Math.pow(rand(), 1.3) * (g.H - g.gy - g.U * 2);
      const f = (y - g.gy) / (g.H - g.gy);
      const s = g.U * (0.9 + f * 2.6) * (0.7 + rand() * 0.6);
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.save();
      ctx.translate(rand() * g.W, y);
      ctx.rotate(rand() * TAU);
      ctx.scale(1, 0.4);
      for (let k = 0; k < 5; k++) {
        ctx.rotate(TAU / 5);
        poly(ctx, [0, 0, -s * 0.28, -s * 0.5, 0, -s, s * 0.28, -s * 0.5]);
      }
      ctx.restore();
    }
  }

  // A cluster of ice needles with a lifted cap of soil on top.
  function pillars(ctx, g, rand, x, y, s, hits) {
    const n = 9 + Math.floor(rand() * 6);
    const wid = s * 0.5;
    const hMax = s * 8.5;
    for (let i = 0; i < n; i++) {
      const px = x + (i - n / 2) * wid + (rand() - 0.5) * wid * 0.4;
      const ph = hMax * (0.55 + rand() * 0.45);
      const tilt = (rand() - 0.5) * s * 0.8;
      ctx.fillStyle = '#7f95a6';
      poly(ctx, [px, y, px + wid * 0.92, y, px + wid * 0.92 + tilt, y - ph, px + tilt, y - ph]);
      ctx.fillStyle = '#c4d4de';
      poly(ctx, [px + wid * 0.2, y, px + wid * 0.68, y, px + wid * 0.68 + tilt, y - ph, px + wid * 0.2 + tilt, y - ph]);
      ctx.fillStyle = '#eef2ee';
      poly(ctx, [px, y, px + wid * 0.24, y, px + wid * 0.24 + tilt, y - ph, px + tilt, y - ph]);
      ctx.fillStyle = 'rgba(230,200,130,0.7)';
      ctx.fillRect(px + tilt - wid * 0.05, y - ph, wid * 0.14, ph * 0.55);
      if (hits.length < GLINTS) hits.push(px + tilt + wid * 0.1, y - ph * (0.2 + rand() * 0.8));
    }
    const left = x - (n / 2) * wid - wid * 0.4;
    const right = x + (n / 2) * wid + wid * 0.6;
    const cy = y - hMax * 0.95;
    ctx.fillStyle = '#4a3c2c';
    poly(ctx, [left, cy + s * 1.6, left + s * 1.2, cy - s * 0.4, right - s, cy - s * 0.6, right, cy + s * 1.6]);
    ctx.fillStyle = '#6a5640';
    poly(ctx, [left, cy + s * 1.6, left + s * 1.2, cy - s * 0.4, left + (right - left) * 0.5, cy - s * 0.5, left + s * 2, cy + s * 1.6]);
    ctx.fillStyle = '#d6e0e4';
    blob(ctx, left + (right - left) * 0.4, cy - s * 0.5, (right - left) * 0.3, s * 0.35);
    ctx.fillStyle = '#2e3a24';
    blob(ctx, left + (right - left) * 0.7, cy - s * 0.5, s * 1.4, s * 0.5);
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(state.wood, 0, 0);
    paintSoil(ctx, g, rand);
    lantern(ctx, g, g.W * 0.7, g.gy + g.U * 6, g.U * 1.05);
    paintLeaves(ctx, g, rand);
    const hits = [];
    const spots = [[0.12, 0.74], [0.3, 0.6], [0.5, 0.86], [0.46, 0.58], [0.64, 0.74], [0.84, 0.64], [0.9, 0.94], [0.22, 0.95], [0.76, 0.56]];
    spots.sort((a, b) => a[1] - b[1]);
    for (const [fx, fy] of spots) {
      const y = g.gy + g.U * 3 + fy * (g.H - g.gy - g.U * 4);
      const s = g.U * (0.5 + fy * 1.5);
      pillars(ctx, g, rand, g.W * fx, y, s, hits);
    }
    state.hits = hits;
    return c;
  }

  // ---- moving light --------------------------------------------------------

  function paintShafts(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const x0 = g.W * (0.1 + i * 0.16);
      const w = g.W * (0.03 + (i % 3) * 0.015);
      const grad = ctx.createLinearGradient(x0, 0, x0 + g.W * 0.4, g.H);
      grad.addColorStop(0, 'rgba(240,214,150,0.30)');
      grad.addColorStop(1, 'rgba(240,214,150,0.05)');
      ctx.fillStyle = grad;
      poly(ctx, [x0, 0, x0 + w, 0, x0 + w + g.W * 0.45, g.H, x0 + g.W * 0.45 - w * 0.4, g.H]);
    }
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.2);
    const c = layer(w, g.H * 0.4);
    const ctx = c.getContext('2d');
    const rand = K.rng(77);
    ctx.fillStyle = 'rgba(214,222,222,0.12)';
    for (let i = 0; i < 26; i++) {
      const x = rand() * w;
      const y = c.height * (0.2 + rand() * 0.6);
      const rx = g.U * (6 + rand() * 12);
      const ry = g.U * (0.8 + rand() * 1.4);
      for (const o of [-w, 0, w]) blob(ctx, x + o, y, rx, ry);
    }
    return c;
  }

  function drawMist(ctx, g, t, amt) {
    if (amt <= 0) return;
    const m = state.mist;
    const w = m.width;
    ctx.globalAlpha = Math.min(1, amt);
    const a = (t * g.U * 0.9) % w;
    const b = (t * g.U * 0.5) % w;
    ctx.drawImage(m, -a, g.gy - g.U * 8);
    ctx.drawImage(m, w - a, g.gy - g.U * 8);
    ctx.drawImage(m, b - w, g.gy + g.U * 14);
    ctx.drawImage(m, b, g.gy + g.U * 14);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t, amt) {
    const h = state.hits;
    if (amt <= 0) return;
    const sz = Math.max(1, g.U * 0.5);
    ctx.fillStyle = '#f6f0d8';
    for (let i = 0; i < h.length; i += 2) {
      const ph = Math.sin(t * 0.7 + i * 1.7);
      if (ph < 0) continue;
      ctx.globalAlpha = Math.min(1, ph * 0.8 * amt);
      ctx.fillRect(h[i], h[i + 1], sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.wood = paintWood(g, rand);
    state.ground = paintGround(g, rand);
    state.shafts = paintShafts(g);
    state.mist = paintMist(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { glint, mist, sun } = api.props;
    ctx.drawImage(state.ground, 0, 0);
    drawMist(ctx, g, t, mist);
    ctx.globalAlpha = Math.min(1, sun * (0.65 + 0.3 * Math.sin(t * 0.35)));
    ctx.drawImage(state.shafts, Math.sin(t * 0.2) * g.U * 1.5, 0);
    ctx.globalAlpha = 1;
    drawGlints(ctx, g, t, glint);
  }

  Kasuri.run({
    defaults: { glint: 1, mist: 1, sun: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
