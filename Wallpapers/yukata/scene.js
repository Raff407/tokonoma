/*
 * 浴衣 Yukata — an indigo cotton robe printed with fireworks, hung on a bamboo pole at dusk.
 *
 * Sky, paddies, farmhouse, posts and pole are baked once, the robe on its own layer.
 * Each frame the robe is laid back in thin bands that slide sideways more toward the
 * hem, so the cloth sways in the breeze. Bamboo leaves tilt as a reused sprite and a
 * few fireflies drift on slow sines.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;

  const SKY = ['#3b4470', '#5b5b84', '#98788a', '#d49a7a', '#ecc08a'];
  const WASHI = '#ece3c8';
  const INDIGO = '#1f2e62';
  const INDIGO_LIT = '#2e4180';
  const INDIGO_DEEP = '#151f48';
  const GOLD = '#e6c46a';
  const VERMILION = '#c5503a';
  const MOSS = '#5a6e3e';
  const BAND = 2;
  const FLIES = 14;
  const LEAF_SPOTS = 3;
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
    const u = U * Math.min(1, W / (U * 135));
    return { W, H, U, u, cx: W * 0.5, y0: H * 0.17, hem: H * 0.82, ground: H * 0.9, field: H * 0.64 };
  }

  // ---- backdrop -------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.field);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.field; y++) {
      const f = Math.min(1, y / (g.field * 0.98)) * (inks.length - 1);
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
    ctx.fillStyle = '#b8726a';
    for (let i = 0; i < 5; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      const y = g.H * (0.3 + rand() * 0.2);
      ctx.fillRect(x, y, g.U * (10 + rand() * 18), Math.max(1, g.U * 0.5));
      ctx.fillRect(x + g.U * 5, y + g.U * 0.9, g.U * (5 + rand() * 8), Math.max(1, g.U * 0.4));
    }
  }

  function paintMoon(ctx, g) {
    const r = g.u * 3.2;
    const c = layer(r * 2.4, r * 2.4);
    const m = c.getContext('2d');
    m.fillStyle = WASHI;
    m.beginPath();
    m.arc(r * 1.2, r * 1.2, r, 0, TAU);
    m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath();
    m.arc(r * 1.2 + r * 0.55, r * 1.2 - r * 0.2, r * 0.88, 0, TAU);
    m.fill();
    ctx.drawImage(c, g.W * 0.17, g.H * 0.08);
  }

  function paintHills(ctx, g) {
    ctx.fillStyle = '#6a5c7c';
    ctx.beginPath();
    ctx.moveTo(0, g.field);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.H * 0.5 + fbm(x / (g.U * 36), 2.2, 4, 7) * g.H * 0.09);
    }
    ctx.lineTo(g.W, g.field);
    ctx.fill();
    ctx.fillStyle = '#44476a';
    ctx.beginPath();
    ctx.moveTo(0, g.field);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.H * 0.565 + fbm(x / (g.U * 24), 5.7, 4, 19) * g.H * 0.07);
    }
    ctx.lineTo(g.W, g.field);
    ctx.fill();
  }

  function paintFarmhouse(ctx, g) {
    const u = g.u;
    const x = g.W * 0.04;
    const base = g.field + u * 1.5;
    ctx.fillStyle = '#6e5e56';
    ctx.fillRect(x + u, base - u * 5, u * 20, u * 5);
    ctx.fillStyle = '#e0b668';
    ctx.fillRect(x + u * 4, base - u * 4, u * 6, u * 2.6);
    ctx.fillStyle = '#7a5f4a';
    ctx.fillRect(x + u * 6.9, base - u * 4, Math.max(1, u * 0.35), u * 2.6);
    ctx.fillRect(x + u * 4, base - u * 2.9, u * 6, Math.max(1, u * 0.35));
    ctx.fillStyle = '#2d2a3a';
    poly(ctx, [x - u * 2, base - u * 5, x + u * 4, base - u * 11, x + u * 18, base - u * 11, x + u * 24, base - u * 5,
      x + u * 21, base - u * 5.6, x + u * 1, base - u * 5.6]);
    ctx.fillStyle = '#3d3a4c';
    ctx.fillRect(x + u * 4, base - u * 11.4, u * 14, Math.max(1, u * 0.7));
    ctx.fillRect(x + u * 3.2, base - u * 11.9, u * 1.2, u * 1.2);
    ctx.fillRect(x + u * 17.6, base - u * 11.9, u * 1.2, u * 1.2);
  }

  function paintFields(ctx, g, rand) {
    const grd = ctx.createLinearGradient(0, g.field, 0, g.ground);
    grd.addColorStop(0, '#79855a');
    grd.addColorStop(0.55, '#5a6a42');
    grd.addColorStop(1, '#3c4a30');
    ctx.fillStyle = grd;
    ctx.fillRect(0, g.field, g.W, g.H - g.field);
    ctx.fillStyle = '#8a8f66';
    for (let i = 0; i < 6; i++) {
      const y = g.field + g.U * (2 + i * 3.8);
      ctx.fillRect(0, y, g.W, Math.max(1, g.U * 0.35));
    }
    ctx.fillStyle = '#2c3826';
    ctx.fillRect(0, g.ground, g.W, g.H - g.ground);
    ctx.strokeStyle = '#2c3826';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    for (let i = 0; i < g.W / (g.U * 1.4); i++) {
      const x = rand() * g.W;
      const h = g.U * (2 + rand() * 4);
      ctx.beginPath();
      ctx.moveTo(x, g.ground + g.U);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 2, g.ground - h);
      ctx.stroke();
    }
  }

  function paintBamboo(ctx, g, rand) {
    const u = g.u;
    const xs = [g.W - u * 14, g.W - u * 8, g.W - u * 2.5];
    for (let s = 0; s < xs.length; s++) {
      const w = u * (1.7 - s * 0.15);
      ctx.fillStyle = s === 1 ? '#6f8348' : '#587044';
      ctx.fillRect(xs[s] - w / 2, 0, w, g.ground + u);
      ctx.fillStyle = '#8fa464';
      ctx.fillRect(xs[s] - w / 2, 0, Math.max(1, w * 0.3), g.ground + u);
      ctx.fillStyle = '#34452c';
      for (let y = u * (4 + s * 3); y < g.ground; y += u * (8 + rand() * 3)) {
        ctx.fillRect(xs[s] - w / 2 - 0.5, y, w + 1, Math.max(1, u * 0.45));
      }
    }
    return xs;
  }

  function paintPosts(ctx, g) {
    const u = g.u;
    for (let s = -1; s <= 1; s += 2) {
      const x = g.cx + s * u * 46;
      ctx.fillStyle = '#4c3926';
      ctx.fillRect(x - u * 1.1, g.y0 + u * 1.2, u * 2.2, g.ground - g.y0);
      ctx.fillStyle = '#6a4f35';
      ctx.fillRect(x - u * 1.1, g.y0 + u * 1.2, Math.max(1, u * 0.6), g.ground - g.y0);
      poly(ctx, [x - u * 1.1, g.y0 + u * 1.2, x - u * 2.6, g.y0 - u * 1.2, x - u * 1.6, g.y0 - u * 1.2, x - u * 0.2, g.y0 + u * 0.6]);
      poly(ctx, [x + u * 1.1, g.y0 + u * 1.2, x + u * 2.6, g.y0 - u * 1.2, x + u * 1.6, g.y0 - u * 1.2, x + u * 0.2, g.y0 + u * 0.6]);
      ctx.fillStyle = '#7b6d5e';
      ctx.fillRect(x - u * 2.2, g.ground - u * 0.4, u * 4.4, u * 1.4);
    }
    const x0 = g.cx - u * 51;
    ctx.fillStyle = '#8c9a58';
    ctx.fillRect(x0, g.y0 - u * 1.1, u * 102, u * 2.2);
    ctx.fillStyle = '#b3b878';
    ctx.fillRect(x0, g.y0 - u * 1.1, u * 102, Math.max(1, u * 0.6));
    ctx.fillStyle = '#4e5e30';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x0 + u * (8 + i * 17), g.y0 - u * 1.2, Math.max(1, u * 0.5), u * 2.4);
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintMoon(ctx, g);
    paintHills(ctx, g);
    paintFarmhouse(ctx, g);
    paintFields(ctx, g, rand);
    state.stalks = paintBamboo(ctx, g, rand);
    paintPosts(ctx, g);
    return c;
  }

  // ---- the robe -------------------------------------------------------------

  function robePath(ctx, g) {
    const u = g.u;
    const cx = g.cx;
    const top = g.y0 - u * 1.4;
    const sleeveBot = g.y0 + u * 31;
    const r = u * 3;
    ctx.beginPath();
    ctx.moveTo(cx - u * 4, top);
    ctx.lineTo(cx - u * 12, top + u * 0.4);
    ctx.lineTo(cx - u * 36, top + u * 0.4);
    ctx.lineTo(cx - u * 36, sleeveBot - r);
    ctx.quadraticCurveTo(cx - u * 36, sleeveBot, cx - u * 36 + r, sleeveBot);
    ctx.lineTo(cx - u * 12.4, sleeveBot);
    ctx.lineTo(cx - u * 13.4, g.hem);
    ctx.lineTo(cx + u * 13.4, g.hem);
    ctx.lineTo(cx + u * 12.4, sleeveBot);
    ctx.lineTo(cx + u * 36 - r, sleeveBot);
    ctx.quadraticCurveTo(cx + u * 36, sleeveBot, cx + u * 36, sleeveBot - r);
    ctx.lineTo(cx + u * 36, top + u * 0.4);
    ctx.lineTo(cx + u * 12, top + u * 0.4);
    ctx.lineTo(cx + u * 4, top);
    ctx.closePath();
  }

  function burst(ctx, x, y, r, rays, ink, dotInk, u, twist) {
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(1, u * 0.42);
    ctx.lineCap = 'round';
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * TAU + twist;
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x + c * r * 0.34, y + s * r * 0.34);
      ctx.lineTo(x + c * r * 0.82, y + s * r * 0.82);
      ctx.stroke();
      ctx.fillRect(x + c * r - u * 0.35, y + s * r - u * 0.35, Math.max(1, u * 0.7), Math.max(1, u * 0.7));
    }
    ctx.fillStyle = dotInk;
    for (let i = 0; i < rays; i++) {
      const a = ((i + 0.5) / rays) * TAU + twist;
      ctx.fillRect(x + Math.cos(a) * r * 0.2 - u * 0.25, y + Math.sin(a) * r * 0.2 - u * 0.25, Math.max(1, u * 0.5), Math.max(1, u * 0.5));
    }
  }

  function paintPattern(ctx, g, rand) {
    const u = g.u;
    const cx = g.cx;
    const y0 = g.y0;
    const big = [
      [-24, 12, 8.5, 14, WASHI], [24, 17, 7.5, 12, WASHI], [-5, 15, 6.5, 12, WASHI],
      [6, 40, 8, 14, WASHI], [-6, 62, 7.5, 14, WASHI], [8, 80, 6, 12, WASHI],
    ];
    for (let i = 0; i < big.length; i++) {
      const b = big[i];
      burst(ctx, cx + b[0] * u, y0 + b[1] * u, b[2] * u, b[3], b[4], GOLD, u, rand() * 3);
    }
    const small = [[-30, 25, 3.4], [-17, 24, 3], [29, 5, 3], [-27, 3, 3], [18, 28, 3.2], [-9, 50, 3.4], [14, 56, 3.4], [-12, 77, 3.2], [12, 28, 2.8]];
    for (let i = 0; i < small.length; i++) {
      const b = small[i];
      burst(ctx, cx + b[0] * u, y0 + b[1] * u, b[2] * u, 8, i % 4 === 0 ? VERMILION : '#b9bfd8', GOLD, u, rand() * 3);
    }
    ctx.fillStyle = '#7f8db8';
    for (let i = 0; i < 70; i++) {
      const x = cx + (rand() - 0.5) * u * 72;
      const y = y0 + rand() * (g.hem - y0);
      ctx.fillRect(x, y, Math.max(1, u * 0.4), Math.max(1, u * 0.4));
    }
  }

  function paintRobe(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.u;
    const cx = g.cx;
    robePath(ctx, g);
    ctx.fillStyle = INDIGO;
    ctx.fill();
    ctx.save();
    robePath(ctx, g);
    ctx.clip();
    ctx.fillStyle = INDIGO_LIT;
    for (let i = -5; i <= 5; i++) {
      ctx.fillRect(cx + i * u * 7, g.y0, Math.max(1, u * 1.6), g.hem - g.y0 + u * 2);
    }
    paintPattern(ctx, g, rand);
    ctx.fillStyle = INDIGO_DEEP;
    ctx.fillRect(cx - u * 36, g.y0 + u * 27, u * 72, u * 5);
    ctx.fillRect(cx - u * 14, g.hem - u * 3, u * 28, u * 4);
    ctx.fillRect(cx - u * 12.6, g.y0, Math.max(1, u * 0.8), u * 31);
    ctx.fillRect(cx + u * 11.8, g.y0, Math.max(1, u * 0.8), u * 31);
    ctx.fillRect(cx + u * 3, g.y0 + u * 18, Math.max(1, u * 0.7), g.hem - g.y0 - u * 18);
    ctx.restore();
    ctx.fillStyle = WASHI;
    poly(ctx, [cx - u * 4.6, g.y0 - u * 1.4, cx - u * 2, g.y0 - u * 1.4, cx + u * 3, g.y0 + u * 18, cx + u * 0.8, g.y0 + u * 18]);
    poly(ctx, [cx + u * 4.6, g.y0 - u * 1.4, cx + u * 2, g.y0 - u * 1.4, cx - u * 0.4, g.y0 + u * 16, cx + u * 1.6, g.y0 + u * 18]);
    ctx.fillStyle = '#c9c0a4';
    poly(ctx, [cx - u * 2, g.y0 - u * 1.4, cx + u * 2, g.y0 - u * 1.4, cx + u * 0.2, g.y0 + u * 8]);
    ctx.fillStyle = '#8f2f25';
    ctx.fillRect(cx + u * 2.4, g.y0 - u * 0.5, u * 0.9, u * 2.5);
    return c;
  }

  // ---- leaves and fireflies -------------------------------------------------

  function paintLeaves(g, rand) {
    const u = g.u;
    const w = Math.ceil(u * 22);
    const h = Math.ceil(u * 16);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const tones = ['#33472b', '#4a6035', '#62793f'];
    for (let i = 0; i < 11; i++) {
      const a = -0.15 + (i / 10) * 1.5 + (rand() - 0.5) * 0.15;
      const len = u * (7 + rand() * 4.5);
      ctx.save();
      ctx.translate(u * 1.5, u * 2);
      ctx.rotate(a);
      ctx.fillStyle = tones[i % 3];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.5, -u * 1.5, len, 0);
      ctx.quadraticCurveTo(len * 0.5, u * 1.1, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    return c;
  }

  function makeFlies(g, rand) {
    const n = FLIES;
    const f = { x: new Float32Array(n), y: new Float32Array(n), ax: new Float32Array(n), ay: new Float32Array(n),
      sx: new Float32Array(n), sy: new Float32Array(n), p: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      f.x[i] = g.W * (0.05 + rand() * 0.9);
      f.y[i] = g.H * (0.62 + rand() * 0.28);
      f.ax[i] = g.U * (2 + rand() * 4);
      f.ay[i] = g.U * (1 + rand() * 2.5);
      f.sx[i] = 0.25 + rand() * 0.35;
      f.sy[i] = 0.3 + rand() * 0.4;
      f.p[i] = rand() * TAU;
    }
    return f;
  }

  // ---- frame ----------------------------------------------------------------

  function wind(t) {
    return 0.4 + Math.sin(t * 0.9) * 0.5 + Math.sin(t * 0.37 + 1.3) * 0.4;
  }

  function drawRobe(ctx, g, t, breeze) {
    const u = g.u;
    const bx = Math.max(0, Math.floor(g.cx - u * 40));
    const bw = Math.min(g.W - bx, Math.ceil(u * 80));
    const y0 = Math.floor(g.y0 - u * 1.4);
    const span = g.hem - y0;
    const w = wind(t) * breeze;
    for (let y = y0; y < g.hem; y += BAND) {
      const f = (y - y0) / span;
      const off = u * (w * 2.6 * f * f + Math.sin(t * 2.1 - f * 3.2) * 0.45 * f * breeze);
      const bh = Math.min(BAND, g.hem - y);
      ctx.drawImage(state.robe, bx, y, bw, bh, bx + off, y, bw, bh);
    }
  }

  function drawLeaves(ctx, g, t, breeze) {
    const xs = state.stalks;
    const w = wind(t) * breeze;
    for (let i = 0; i < LEAF_SPOTS; i++) {
      const x = xs[i % xs.length] - g.u * 0.6;
      const y = g.H * (0.08 + i * 0.16);
      const a = Math.sin(t * 1.3 + i * 1.7) * 0.05 * breeze + w * 0.03;
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.setTransform(-c, -s, -s, c, x, y);
      ctx.drawImage(state.leaves, -g.u * 1.5, -g.u * 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawFlies(ctx, g, t) {
    const f = state.flies;
    const sz = Math.max(1, g.U * 0.55);
    for (let i = 0; i < FLIES; i++) {
      const x = f.x[i] + Math.sin(t * f.sx[i] + f.p[i]) * f.ax[i];
      const y = f.y[i] + Math.sin(t * f.sy[i] + f.p[i] * 2) * f.ay[i];
      const a = 0.55 + 0.35 * Math.sin(t * 0.7 + f.p[i]);
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - sz, y - sz, sz * 3, sz * 3);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#f2dc8c';
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.robe = paintRobe(g, rand);
    state.leaves = paintLeaves(g, rand);
    state.flies = makeFlies(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { breeze, fireflies } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawLeaves(ctx, g, t, breeze);
    drawRobe(ctx, g, t, breeze);
    if (fireflies) drawFlies(ctx, g, t);
  }

  Kasuri.run({
    defaults: { breeze: 1, fireflies: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
