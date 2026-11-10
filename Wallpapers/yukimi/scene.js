/*
 * 雪見 Yukimi — snow viewing from a wooden veranda.
 *
 * Sky, hills, garden, pine and lantern are baked once into one layer; the veranda,
 * shoji, eave and tea set into another. Between them only a short pool of flakes
 * falls, and a few steam puffs rise from the cup.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;

  const TAU = Math.PI * 2;
  const FLOOR = 0.8;
  const FAR_FLAKES = 80;
  const NEAR_FLAKES = 30;
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
    return { W, H, U, floor: Math.round(H * FLOOR), horizon: H * 0.5 };
  }

  // ---- garden ----------------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.horizon);
    grad.addColorStop(0, '#8a96a2');
    grad.addColorStop(0.6, '#b9bfc0');
    grad.addColorStop(1, '#d4d4cb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.horizon + 1);
  }

  function paintHills(ctx, g, rand) {
    const ridge = (x, base, amp, seed) => base + (fbm(x / (g.U * 38), seed, 4, seed * 3) - 0.5) * amp;
    ctx.fillStyle = '#a9b3b7';
    ctx.beginPath();
    ctx.moveTo(0, g.horizon + g.U);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridge(x, g.H * 0.4, g.H * 0.2, 3));
    ctx.lineTo(g.W, g.horizon + g.U);
    ctx.fill();
    ctx.fillStyle = '#7d8b86';
    ctx.beginPath();
    ctx.moveTo(0, g.horizon + g.U);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridge(x, g.H * 0.47, g.H * 0.09, 7));
    ctx.lineTo(g.W, g.horizon + g.U);
    ctx.fill();
    // Cedars along the near ridge, each with a pale shoulder of snow.
    for (let x = 0; x < g.W; x += g.U * (1.2 + rand() * 1.6)) {
      const y = ridge(x, g.H * 0.47, g.H * 0.09, 7);
      const h = g.U * (3 + rand() * 4);
      ctx.fillStyle = '#4f6458';
      poly(ctx, [x - g.U * 0.9, y + g.U, x, y - h, x + g.U * 0.9, y + g.U]);
      ctx.fillStyle = '#d7dad6';
      poly(ctx, [x - g.U * 0.35, y - h * 0.55, x, y - h, x + g.U * 0.35, y - h * 0.55]);
    }
  }

  function paintGround(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.horizon, 0, g.floor);
    grad.addColorStop(0, '#dfe2e0');
    grad.addColorStop(1, '#f4f4f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.horizon, g.W, g.floor - g.horizon + 2);
    ctx.fillStyle = '#b3bfcb';
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.18 + rand() * 0.2;
      blob(ctx, rand() * g.W, g.horizon + (g.floor - g.horizon) * (0.1 + rand() * 0.9), g.U * (6 + rand() * 14), g.U * (0.5 + rand() * 1));
    }
    ctx.globalAlpha = 1;
  }

  function paintFence(ctx, g) {
    const x0 = g.W * 0.44;
    const y = g.horizon + g.U * 2.5;
    for (let x = x0; x < g.W; x += g.U * 1.5) {
      ctx.fillStyle = '#7a6a48';
      ctx.fillRect(x, y - g.U * 5.2, g.U * 0.9, g.U * 5.2);
      ctx.fillStyle = '#eceeea';
      ctx.fillRect(x - 0.3, y - g.U * 5.7, g.U * 1.5, g.U * 0.8);
    }
    ctx.fillStyle = '#4d3d2a';
    ctx.fillRect(x0, y - g.U * 3.6, g.W - x0, g.U * 0.5);
    ctx.fillRect(x0, y - g.U * 1.6, g.W - x0, g.U * 0.5);
    ctx.fillStyle = '#e8eae6';
    ctx.fillRect(x0, y - g.U * 3.9, g.W - x0, g.U * 0.35);
  }

  function paintStones(ctx, g) {
    const spots = [[0.5, 0.74, 5], [0.43, 0.7, 4.2], [0.56, 0.7, 4.6], [0.36, 0.76, 5.4]];
    for (const [fx, fy, r] of spots) {
      ctx.fillStyle = '#6d706e';
      blob(ctx, g.W * fx, g.H * fy, g.U * r, g.U * r * 0.32);
      ctx.fillStyle = '#f2f3ef';
      blob(ctx, g.W * fx, g.H * fy - g.U * 0.5, g.U * r * 0.82, g.U * r * 0.2);
    }
  }

  function paintLantern(ctx, g) {
    const s = g.U * 1.6;
    const x = g.W * 0.63;
    const y = g.H * 0.68;
    ctx.fillStyle = '#5a5d5c';
    blob(ctx, x, y, s * 4.2, s * 1.1);
    ctx.fillStyle = '#e9ebe7';
    blob(ctx, x, y - s * 0.4, s * 3.6, s * 0.7);
    // Three short legs and the wide base.
    ctx.fillStyle = '#6b6e6c';
    ctx.fillRect(x - s * 3, y - s * 2.2, s * 1.1, s * 1.6);
    ctx.fillRect(x + s * 1.9, y - s * 2.2, s * 1.1, s * 1.6);
    ctx.fillRect(x - s * 0.55, y - s * 2.2, s * 1.1, s * 1.6);
    ctx.fillStyle = '#7b7e7c';
    blob(ctx, x, y - s * 2.4, s * 3.8, s * 0.9);
    // Pole.
    ctx.fillStyle = '#6f7270';
    ctx.fillRect(x - s * 0.8, y - s * 6.4, s * 1.6, s * 4);
    ctx.fillStyle = '#4f5251';
    ctx.fillRect(x + s * 0.2, y - s * 6.4, s * 0.6, s * 4);
    // Chamber with its lit window.
    ctx.fillStyle = '#868987';
    blob(ctx, x, y - s * 6.5, s * 3.6, s * 0.8);
    ctx.fillStyle = '#767977';
    ctx.fillRect(x - s * 2.4, y - s * 10.2, s * 4.8, s * 3.7);
    ctx.fillStyle = '#3d3a33';
    ctx.fillRect(x - s * 1.1, y - s * 9.5, s * 2.2, s * 2.4);
    ctx.fillStyle = '#d6b45c';
    ctx.fillRect(x - s * 0.8, y - s * 9.2, s * 1.6, s * 1.8);
    // Wide cap, then the snow lying on it, and the jewel on top.
    ctx.fillStyle = '#585b5a';
    poly(ctx, [x - s * 7, y - s * 10, x + s * 7, y - s * 10, x + s * 3.2, y - s * 13.4, x - s * 3.2, y - s * 13.4]);
    ctx.fillStyle = '#4a4d4c';
    blob(ctx, x, y - s * 10, s * 7, s * 0.7);
    ctx.fillStyle = '#f4f5f1';
    blob(ctx, x, y - s * 13.1, s * 3.6, s * 1.2);
    blob(ctx, x - s * 3.2, y - s * 11.5, s * 3, s * 1.1);
    blob(ctx, x + s * 3.3, y - s * 11.4, s * 3, s * 1);
    ctx.fillStyle = '#6a6d6b';
    blob(ctx, x, y - s * 14.2, s * 0.9, s * 1.2);
    ctx.fillStyle = '#f4f5f1';
    blob(ctx, x, y - s * 14.8, s * 0.8, s * 0.5);
  }

  function paintPine(ctx, g) {
    const U = g.U;
    const bx = g.W * 0.3;
    const by = g.H * 0.78;
    const top = [bx + U * 5, g.H * 0.28];
    // Twisting trunk as short thick strokes that taper upward.
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b2e24';
    let px = bx;
    let py = by;
    for (let i = 1; i <= 16; i++) {
      const f = i / 16;
      const nx = bx + (top[0] - bx) * f + Math.sin(f * 5) * U * 2.4;
      const ny = by + (top[1] - by) * f;
      ctx.lineWidth = U * (3.6 - f * 2.2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      px = nx;
      py = ny;
    }
    ctx.fillStyle = '#e6e8e4';
    blob(ctx, bx, by + U * 0.3, U * 5, U * 1);
    // Cloud pads: dark needles, then a cap of snow.
    const pads = [
      [-9, 0.62, 10], [8, 0.54, 11], [-6, 0.45, 9], [5, 0.38, 9],
      [-2, 0.3, 8], [6, 0.24, 7],
    ];
    const mid = top[0] - bx;
    for (const [dx, hf, rx] of pads) {
      const cx = bx + mid * 0.5 + dx * U;
      const cy = g.H * hf;
      ctx.strokeStyle = '#3b2e24';
      ctx.lineWidth = U * 0.8;
      ctx.beginPath();
      ctx.moveTo(bx + mid * (1 - hf) * 0.9, cy + U * 3);
      ctx.lineTo(cx, cy + U);
      ctx.stroke();
      ctx.fillStyle = '#2f4a38';
      blob(ctx, cx, cy, U * rx, U * rx * 0.34);
      ctx.fillStyle = '#425e45';
      blob(ctx, cx - U * 1.5, cy + U * 0.2, U * rx * 0.6, U * rx * 0.2);
      ctx.fillStyle = '#f1f2ee';
      blob(ctx, cx, cy - U * rx * 0.2, U * rx * 0.92, U * rx * 0.2);
      ctx.fillStyle = '#c9d0d3';
      blob(ctx, cx, cy - U * rx * 0.02, U * rx * 0.8, U * rx * 0.07);
    }
    // Yukitsuri ropes from the pole to the pad tips.
    const px0 = top[0] - U * 1;
    const py0 = g.H * 0.1;
    ctx.strokeStyle = '#4a3b28';
    ctx.lineWidth = U * 0.55;
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px0 + U * 0.5, g.H * 0.46);
    ctx.stroke();
    ctx.strokeStyle = '#b9a67c';
    ctx.lineWidth = Math.max(1, U * 0.3);
    for (const [dx, hf, rx] of pads) {
      const cx = bx + mid * 0.5 + dx * U;
      const cy = g.H * hf;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(cx + side * U * rx * 0.85, cy);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#f1f2ee';
    blob(ctx, px0, py0, U * 0.8, U * 0.4);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d7d8d2';
    ctx.fillRect(0, 0, g.W, g.H);
    paintSky(ctx, g);
    paintHills(ctx, g, rand);
    paintGround(ctx, g, rand);
    paintFence(ctx, g);
    paintStones(ctx, g);
    paintLantern(ctx, g);
    paintPine(ctx, g);
    return c;
  }

  // ---- veranda -----------------------------------------------------------------

  function paintEave(ctx, g) {
    const h = g.H * 0.1;
    ctx.fillStyle = '#2b2119';
    ctx.fillRect(0, 0, g.W, h);
    ctx.fillStyle = '#1d1611';
    for (let y = g.U * 2; y < h; y += g.U * 2.4) ctx.fillRect(0, y, g.W, 1);
    ctx.fillStyle = '#3b2c20';
    ctx.fillRect(0, h, g.W, g.U * 1.4);
    ctx.fillStyle = '#6b5438';
    ctx.fillRect(0, h + g.U * 1.4, g.W, 1);
    ctx.fillStyle = '#e8eae6';
    for (let x = 0; x < g.W; x += g.U * 6) ctx.fillRect(x, h + g.U * 1.5, g.U * (1 + ((x * 7) % 3)), g.U * 0.7);
  }

  function paintShoji(ctx, g) {
    const w = g.W * 0.13;
    const y0 = g.H * 0.115;
    const y1 = g.floor;
    ctx.fillStyle = '#e6dcc0';
    ctx.fillRect(0, y0, w, y1 - y0);
    ctx.fillStyle = '#f1e8cf';
    ctx.fillRect(0, y0, w, (y1 - y0) * 0.5);
    ctx.fillStyle = '#34281d';
    const cols = 3;
    const rows = 7;
    for (let i = 0; i <= cols; i++) ctx.fillRect(Math.round((w * i) / cols) - (i === cols ? 1 : 0), y0, Math.max(1, g.U * 0.5), y1 - y0);
    for (let j = 0; j <= rows; j++) ctx.fillRect(0, y0 + ((y1 - y0) * 0.78 * j) / rows, w, Math.max(1, g.U * 0.5));
    ctx.fillStyle = '#3a2b1e';
    ctx.fillRect(0, y0 + (y1 - y0) * 0.78, w, (y1 - y0) * 0.22);
    ctx.fillStyle = '#4d3a28';
    ctx.fillRect(0, y0 + (y1 - y0) * 0.78, w, 1);
  }

  function paintPosts(ctx, g) {
    const y0 = g.H * 0.1;
    const posts = [[g.W * 0.13, g.U * 2.4], [g.W * 0.962, g.U * 3.2]];
    for (const [x, w] of posts) {
      ctx.fillStyle = '#35271b';
      ctx.fillRect(x, y0, w, g.floor - y0);
      ctx.fillStyle = '#54402c';
      ctx.fillRect(x, y0, Math.max(1, w * 0.22), g.floor - y0);
    }
  }

  function paintFloor(ctx, g, rand) {
    const y0 = g.floor;
    ctx.fillStyle = '#8a6a46';
    ctx.fillRect(0, y0, g.W, g.U * 1.6);
    ctx.fillStyle = '#c0a07a';
    ctx.fillRect(0, y0, g.W, 1);
    ctx.fillStyle = '#5a4128';
    ctx.fillRect(0, y0 + g.U * 1.6, g.W, g.H - y0);
    const rows = [0.1, 0.38, 0.7];
    let y = y0 + g.U * 1.6;
    for (let i = 0; y < g.H; i++) {
      const h = g.U * (3 + i * 1.2);
      ctx.fillStyle = i % 2 ? '#50392a' : '#654a2e';
      ctx.fillRect(0, y, g.W, h);
      ctx.fillStyle = '#2a1e14';
      ctx.fillRect(0, y + h - 1, g.W, 1);
      ctx.fillStyle = '#7d5f3c';
      for (let k = 0; k < 14; k++) ctx.fillRect(rand() * g.W, y + h * (rows[k % 3] + 0.1), g.U * (4 + rand() * 12), 1);
      y += h;
    }
    // Snow blown onto the edge of the boards.
    ctx.fillStyle = '#f1f2ee';
    for (let x = 0; x < g.W; x += g.U * (3 + rand() * 6)) blob(ctx, x, y0 + g.U * 0.3, g.U * (1 + rand() * 2.2), g.U * 0.5);
  }

  function paintTea(ctx, g) {
    const U = g.U * 1.5;
    const cx = g.W * 0.5;
    const fy = g.H * 0.9;
    // Lacquer tray with a vermilion rim.
    ctx.fillStyle = '#c2452e';
    blob(ctx, cx, fy + U * 0.6, U * 17, U * 2.6);
    ctx.fillStyle = '#1e1816';
    blob(ctx, cx, fy + U * 0.2, U * 16, U * 2.2);
    // Teapot.
    const px = cx - U * 6;
    ctx.fillStyle = '#7e3f2c';
    blob(ctx, px, fy - U * 2.4, U * 4.4, U * 3.2);
    ctx.fillStyle = '#9a5237';
    blob(ctx, px - U * 1, fy - U * 3.2, U * 2.2, U * 1.4);
    ctx.fillRect(px + U * 3.8, fy - U * 3.6, U * 2.6, U * 0.8);
    ctx.fillStyle = '#5c2e20';
    ctx.fillRect(px - U * 4.8, fy - U * 3.8, U * 1, U * 3.4);
    blob(ctx, px, fy - U * 5.7, U * 1.1, U * 0.7);
    ctx.fillStyle = '#7e3f2c';
    blob(ctx, px, fy - U * 5.2, U * 2.2, U * 0.9);
    // Yunomi cup: pale glaze with an indigo band.
    const cux = cx + U * 5;
    const cup = (w0, w1, h) => poly(ctx, [cux - w0, fy - h, cux + w0, fy - h, cux + w1, fy, cux - w1, fy]);
    ctx.fillStyle = '#ebe8dc';
    cup(U * 2.8, U * 2, U * 5);
    ctx.fillStyle = '#2d3f66';
    ctx.fillRect(cux - U * 2.6, fy - U * 3.4, U * 5.2, U * 1);
    ctx.fillStyle = '#c9c6b8';
    ctx.fillRect(cux + U * 1.6, fy - U * 5, U * 1.2, U * 5);
    ctx.fillStyle = '#d8d4c4';
    blob(ctx, cux, fy - U * 5, U * 2.8, U * 0.9);
    ctx.fillStyle = '#6b7c3e';
    blob(ctx, cux, fy - U * 4.9, U * 2.3, U * 0.6);
    state.cup = { x: cux, y: fy - U * 5.2 };
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintShoji(ctx, g);
    paintPosts(ctx, g);
    paintEave(ctx, g);
    paintFloor(ctx, g, rand);
    paintTea(ctx, g);
    return c;
  }

  // ---- snow and steam ------------------------------------------------------------

  function makeFlakes(g, rand, n, near) {
    const f = { x: new Float32Array(n), y: new Float32Array(n), vy: new Float32Array(n), r: new Float32Array(n), p: new Float32Array(n), near };
    for (let i = 0; i < n; i++) {
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.floor;
      f.vy[i] = g.U * (near ? 5 + rand() * 3 : 2.5 + rand() * 2);
      f.r[i] = g.U * (near ? 0.7 + rand() * 0.7 : 0.25 + rand() * 0.25);
      f.p[i] = rand() * TAU;
    }
    return f;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(250,250,246,1)');
    grad.addColorStop(1, 'rgba(250,250,246,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function stepFlakes(f, g, t, dt, count) {
    for (let i = 0; i < count; i++) {
      f.y[i] += f.vy[i] * dt;
      if (f.y[i] > g.floor) {
        f.y[i] = -f.r[i] * 2;
        f.x[i] = state.rand() * g.W;
      }
    }
  }

  function drawFlakes(ctx, f, g, t, count) {
    ctx.fillStyle = '#fbfbf8';
    for (let i = 0; i < count; i++) {
      const x = f.x[i] + Math.sin(t * 0.6 + f.p[i]) * g.U * (f.near ? 2.2 : 1.2) + t * g.U * 0.8 * (f.near ? 1 : 0.5);
      const wx = ((x % g.W) + g.W) % g.W;
      ctx.globalAlpha = f.near ? 0.95 : 0.7;
      blob(ctx, wx, f.y[i], f.r[i], f.r[i]);
    }
    ctx.globalAlpha = 1;
  }

  function drawSteam(ctx, g, t, amount) {
    if (amount <= 0) return;
    const s = state.cup;
    for (let i = 0; i < PUFFS; i++) {
      const u = (t * 0.14 + i / PUFFS) % 1;
      const size = g.U * (4 + u * 8);
      const x = s.x + Math.sin(u * 5 + i * 1.7) * g.U * 2.2 * u + u * g.U * 2;
      const y = s.y - u * g.U * 30;
      ctx.globalAlpha = Math.sin(u * Math.PI) * 0.95 * Math.min(1, amount);
      ctx.drawImage(state.puff, x - size, y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.puff = paintPuff();
    state.far = makeFlakes(g, rand, FAR_FLAKES * 2, false);
    state.near = makeFlakes(g, rand, NEAR_FLAKES * 2, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, steam } = api.props;
    const step = Math.min(dt, 0.1);
    const far = Math.round(FAR_FLAKES * snow);
    const near = Math.round(NEAR_FLAKES * snow);
    stepFlakes(state.far, g, t, step, far);
    stepFlakes(state.near, g, t, step, near);
    ctx.drawImage(state.back, 0, 0);
    drawFlakes(ctx, state.far, g, t, far);
    drawFlakes(ctx, state.near, g, t, near);
    ctx.drawImage(state.front, 0, 0);
    drawSteam(ctx, g, t, steam);
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
