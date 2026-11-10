/*
 * 云龙 Yunlong — a gold dragon winding through indigo clouds.
 *
 * Sky and cloud banks are baked once as tiling layers that drift sideways. The dragon is
 * a short chain of discs along a travelling wave, drawn each frame from reused arrays.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const N = 64;
  const SKY = ['#141a38', '#1d2650', '#2a3868'];
  const CLOUD = { deep: '#26335f', mid: '#36477c', light: '#4b5f95', rim: '#8d95b0' };
  const GOLD = { dark: '#6e5224', body: '#c49a3c', belly: '#e0c06a', shine: '#f0dc9c' };
  const RED = '#c0402a';
  const MOSS = '#5d7048';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 0.4), 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, u: U * Math.min(1, W / (U * 150)) };
  }

  // ---- sky and clouds ------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, SKY[0]);
    gr.addColorStop(0.55, SKY[1]);
    gr.addColorStop(1, SKY[2]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // One auspicious cloud: a row of rounded lobes with a curled tail on one side.
  function xiang(ctx, x, y, s, dir, tones) {
    const lobes = [[-2.2, 0.4, 1.6], [-0.9, -0.5, 2.1], [0.9, -0.7, 2.3], [2.4, -0.1, 1.8], [3.4, 0.6, 1.2]];
    for (let pass = 0; pass < 3; pass++) {
      ctx.fillStyle = tones[pass];
      for (let i = 0; i < lobes.length; i++) {
        const l = lobes[i];
        const lift = pass * s * 0.28;
        disc(ctx, x + dir * l[0] * s, y + l[1] * s - lift, (l[2] - pass * 0.3) * s);
      }
      ctx.fillRect(x - dir * 2.6 * s - (dir < 0 ? 6.2 * s : 0), y + s * 0.6 - pass * s * 0.25, 6.2 * s, s * (0.9 - pass * 0.2));
    }
    // curled tail
    ctx.strokeStyle = tones[2];
    ctx.lineWidth = Math.max(1, s * 0.55);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const tx = x - dir * 3 * s;
    ctx.moveTo(tx, y + s * 0.9);
    ctx.bezierCurveTo(tx - dir * 2.5 * s, y + s * 1.3, tx - dir * 3.8 * s, y - s * 0.2, tx - dir * 2.6 * s, y - s * 0.8);
    ctx.bezierCurveTo(tx - dir * 1.9 * s, y - s * 1.2, tx - dir * 1.4 * s, y - s * 0.5, tx - dir * 1.9 * s, y - s * 0.3);
    ctx.stroke();
    ctx.strokeStyle = CLOUD.rim;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(1, s * 0.22);
    ctx.beginPath();
    ctx.arc(x + dir * 0.9 * s, y - 0.7 * s, 2.3 * s, Math.PI * 1.05, Math.PI * 1.7);
    ctx.stroke();
    ctx.strokeStyle = tones[2];
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x - dir * 0.9 * s, y - 0.2 * s, 1.1 * s, Math.PI * 1.1, Math.PI * 2.1);
    ctx.arc(x + dir * 2.4 * s, y + 0.2 * s, 0.9 * s, Math.PI * 1.1, Math.PI * 2.1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // A tiling bank (width W): each cloud is drawn three times so the seam is invisible.
  function paintBank(g, rand, list, tones) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const x = it[0] * g.W;
      const y = it[1] * g.H;
      const dir = rand() < 0.5 ? 1 : -1;
      for (let k = -1; k <= 1; k++) xiang(ctx, x + k * g.W, y, it[2] * g.U, dir, tones);
    }
    return c;
  }

  function paintBanks(g, rand) {
    state.far = paintBank(g, rand, [[0.05, 0.2, 3.6], [0.4, 0.12, 3], [0.72, 0.26, 3.8], [0.9, 0.08, 2.6], [0.22, 0.7, 4], [0.58, 0.78, 3.4], [0.88, 0.64, 3.8]], [CLOUD.deep, CLOUD.mid, CLOUD.light]);
    state.near = paintBank(g, rand, [[0.1, 0.9, 6.2], [0.45, 0.96, 5.6], [0.8, 0.88, 6.6], [0.3, 0.4, 2.4], [0.68, 0.5, 2.2]], ['#2c3b6c', '#415385', '#5a6ca0']);
  }

  // ---- dragon --------------------------------------------------------------

  function spine(g, t, sway) {
    const { px, py, nx, ny, rad } = state;
    const A = g.H * (0.1 + 0.02 * sway);
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const amp = A * (0.8 + 1.1 * s);
      px[i] = g.W * (0.84 - 0.76 * s) + g.U * 2 * sway * Math.sin(s * 9 - t * 0.5);
      py[i] = g.H * 0.46 + amp * Math.sin(s * TAU * 1.4 + 0.5 - t * 0.42) + g.H * 0.04 * Math.sin(s * 5 + t * 0.3) * sway;
      rad[i] = g.U * (1.3 + 4.6 * Math.pow(1 - s, 0.8));
    }
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(N - 1, i + 1);
      let tx = px[b] - px[a];
      let ty = py[b] - py[a];
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      nx[i] = ty;
      ny[i] = -tx;
    }
  }

  function drawBody(ctx, g) {
    const { px, py, nx, ny, rad } = state;
    const e = Math.max(1, g.U * 0.5);
    ctx.fillStyle = GOLD.dark;
    for (let i = N - 1; i >= 0; i--) disc(ctx, px[i], py[i], rad[i] + e);
    ctx.fillStyle = GOLD.body;
    for (let i = N - 1; i >= 0; i--) disc(ctx, px[i], py[i], rad[i]);
    ctx.fillStyle = GOLD.belly;
    for (let i = N - 1; i >= 0; i--) disc(ctx, px[i] + nx[i] * rad[i] * 0.45, py[i] + ny[i] * rad[i] * 0.45, rad[i] * 0.5);
    ctx.fillStyle = GOLD.dark;
    for (let i = 2; i < N - 2; i += 2) {
      const r = rad[i];
      disc(ctx, px[i] - nx[i] * r * 0.25, py[i] - ny[i] * r * 0.25, Math.max(0.5, r * 0.16));
    }
    ctx.fillStyle = GOLD.shine;
    for (let i = 3; i < N - 2; i += 4) {
      const r = rad[i];
      disc(ctx, px[i] - nx[i] * r * 0.62, py[i] - ny[i] * r * 0.62, Math.max(0.5, r * 0.18));
    }
    // dorsal fins
    for (let i = 5; i < N - 3; i += 3) {
      const r = rad[i];
      const bx = px[i] - nx[i] * r;
      const by = py[i] - ny[i] * r;
      const h = g.U * 1.9 * (0.5 + 0.5 * (1 - i / N));
      ctx.fillStyle = i % 6 === 2 ? RED : MOSS;
      ctx.beginPath();
      ctx.moveTo(bx - 1, by);
      ctx.lineTo(bx - nx[i] * h - 1.5, by - ny[i] * h);
      ctx.lineTo(bx + 1.5, by + 1);
      ctx.fill();
    }
  }

  function leg(ctx, g, i, t, ph) {
    const { px, py, nx, ny, rad } = state;
    const u = g.U;
    const bx = px[i] + nx[i] * rad[i] * 0.8;
    const by = py[i] + ny[i] * rad[i] * 0.8;
    const sw = Math.sin(t * 0.9 + ph) * u * 0.8;
    const kx = bx + u * 2 + sw;
    const ky = by + u * 3.2;
    const fx = kx - u * 1.6 + sw * 0.6;
    const fy = ky + u * 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = GOLD.dark;
    ctx.lineWidth = u * 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.strokeStyle = GOLD.body;
    ctx.lineWidth = u * 1.1;
    ctx.stroke();
    ctx.strokeStyle = GOLD.shine;
    ctx.lineWidth = Math.max(1, u * 0.4);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx - u * 1.7, fy + u * (1.3 + k * 0.8));
      ctx.stroke();
    }
  }

  function drawHead(ctx, g, t, sway) {
    const { px, py } = state;
    const u = g.U;
    const dx = px[0] - px[3];
    const dy = py[0] - py[3];
    const a = Math.atan2(dy, dx) * 0.7;
    const bob = Math.sin(t * 0.8) * 0.08 * sway;
    ctx.save();
    ctx.translate(px[0], py[0]);
    ctx.rotate(a + bob);
    ctx.scale(1.5, 1.5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // mane flames behind the skull
    for (let k = 0; k < 6; k++) {
      const sw = Math.sin(t * 1.1 + k * 0.9) * u * 1.2;
      ctx.strokeStyle = k % 2 ? RED : MOSS;
      ctx.lineWidth = u * 1.5;
      ctx.beginPath();
      ctx.moveTo(-u * (1 + k * 0.3), -u * (3.4 + k * 0.2));
      ctx.quadraticCurveTo(-u * (4 + k * 1.4), -u * (6 + k * 0.9) + sw, -u * (8 + k * 2.2), -u * (3.2 + k * 0.4) + sw * 1.4);
      ctx.stroke();
    }
    // horns
    ctx.strokeStyle = GOLD.shine;
    ctx.lineWidth = u * 1;
    ctx.beginPath();
    ctx.moveTo(u * 0.5, -u * 4);
    ctx.quadraticCurveTo(-u * 1, -u * 8, -u * 5, -u * 9.5);
    ctx.moveTo(-u * 2.2, -u * 7.1);
    ctx.lineTo(-u * 3.2, -u * 5.4);
    ctx.moveTo(-u * 3.6, -u * 8.7);
    ctx.lineTo(-u * 5.5, -u * 7.6);
    ctx.stroke();
    // jaws and skull
    ctx.fillStyle = GOLD.dark;
    ctx.beginPath();
    ctx.moveTo(u * 3, u * 1.2);
    ctx.lineTo(u * 11, u * 2.6);
    ctx.lineTo(u * 8, u * 4.8);
    ctx.lineTo(-u * 1, u * 4);
    ctx.fill();
    ctx.fillStyle = GOLD.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 5.2, u * 4.2, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(u * 2, -u * 3);
    ctx.quadraticCurveTo(u * 8, -u * 3.6, u * 12, -u * 0.8);
    ctx.quadraticCurveTo(u * 13, u * 1.2, u * 10, u * 1.8);
    ctx.lineTo(u * 3, u * 2);
    ctx.fill();
    disc(ctx, u * 11.4, -u * 1.4, u * 1.5);
    ctx.fillStyle = GOLD.belly;
    ctx.beginPath();
    ctx.ellipse(u * 1, u * 1.8, u * 3.6, u * 1.6, 0.1, 0, TAU);
    ctx.fill();
    // eye, brow, nostril
    ctx.fillStyle = RED;
    disc(ctx, u * 3.4, -u * 1.4, u * 0.95);
    ctx.fillStyle = GOLD.dark;
    disc(ctx, u * 3.5, -u * 1.4, u * 0.45);
    disc(ctx, u * 11.6, -u * 1.9, u * 0.5);
    ctx.strokeStyle = GOLD.dark;
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    ctx.moveTo(u * 1.8, -u * 2.8);
    ctx.lineTo(u * 5, -u * 2.2);
    ctx.moveTo(u * 4, u * 1.4);
    ctx.lineTo(u * 10.5, u * 1.8);
    ctx.stroke();
    // whiskers and beard
    ctx.strokeStyle = CLOUD.rim;
    ctx.lineWidth = Math.max(1, u * 0.3);
    for (let k = 0; k < 2; k++) {
      const sw = Math.sin(t * 0.9 + k * 1.7) * u * 2;
      ctx.beginPath();
      ctx.moveTo(u * 11, u * (0.6 + k * 0.9));
      ctx.bezierCurveTo(u * 12, u * (6 + k * 3) + sw, u * 4, u * (11 + k * 3) - sw, -u * 3, u * (11 + k * 3) + sw);
      ctx.stroke();
    }
    ctx.strokeStyle = GOLD.shine;
    ctx.beginPath();
    ctx.moveTo(u * 5, u * 4.2);
    ctx.quadraticCurveTo(u * 3, u * 8 + Math.sin(t) * u, u * 0.5, u * 9.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawPearl(ctx, g, t) {
    const { px, py } = state;
    const u = g.U;
    const x = Math.min(g.W - u * 8, px[0] + u * 27);
    const y = py[0] - u * 6 + Math.sin(t * 0.7) * u * 1.4;
    ctx.fillStyle = '#7a3a34';
    disc(ctx, x, y, u * 4.1);
    ctx.fillStyle = RED;
    disc(ctx, x, y, u * 3.4);
    ctx.fillStyle = GOLD.belly;
    disc(ctx, x, y, u * 2.6);
    ctx.fillStyle = '#e6ddc4';
    disc(ctx, x - u * 0.5, y - u * 0.5, u * 1.6);
    ctx.strokeStyle = RED;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, u * 0.6);
    for (let k = 0; k < 3; k++) {
      const a = -2.2 + k * 0.7 + Math.sin(t * 0.8 + k) * 0.1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * u * 4, y + Math.sin(a) * u * 4);
      ctx.lineTo(x + Math.cos(a) * u * (5.6 + k * 0.4), y + Math.sin(a) * u * (5.6 + k * 0.4));
      ctx.stroke();
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g);
    paintBanks(g, rand);
    state.px = new Float32Array(N);
    state.py = new Float32Array(N);
    state.nx = new Float32Array(N);
    state.ny = new Float32Array(N);
    state.rad = new Float32Array(N);
  }

  function drawBank(ctx, g, img, off) {
    const x = -(((off % g.W) + g.W) % g.W);
    ctx.drawImage(img, x, 0);
    ctx.drawImage(img, x + g.W, 0);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, drift, pearl } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    drawBank(ctx, g, state.far, t * g.W * 0.006 * drift);
    spine(g, t, sway);
    leg(ctx, g, 16, t, 0);
    leg(ctx, g, 42, t, 2);
    drawBody(ctx, g);
    leg(ctx, g, 20, t, 1);
    leg(ctx, g, 46, t, 3);
    drawHead(ctx, g, t, sway);
    if (pearl) drawPearl(ctx, g, t);
    drawBank(ctx, g, state.near, t * g.W * 0.011 * drift);
  }

  Kasuri.run({
    defaults: { sway: 1, drift: 1, pearl: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
