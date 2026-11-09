/*
 * 大仏 Daibutsu — a great bronze Buddha seated in the open air, among cherry trees and pines.
 *
 * Sky, hills, pagoda, trees, the Buddha and the raked gravel are baked once into layers.
 * Between repaints only mist strips, a pool of petals, one slow shaft of light and the
 * sway of a near blossom branch move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#a3b2b8', '#c3c8bf', '#e0d9bd', '#ecd9a6'];
  const BRONZE = ['#78907a', '#5b705f', '#3f5245', '#27352d'];
  const BARK = '#2b2420';
  const PINK = ['#c99b98', '#dbb8b0', '#ead2c6', '#f2e6d8'];
  const PETAL_TONES = ['#e8d0c6', '#dbb6b0', '#f0e2d4'];
  const NEEDLE = { dark: '#2a3d2d', mid: '#3d5638', light: '#62804a' };
  const MAX_PETALS = 70;
  const PETALS = 34;
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

  // Smooth closed or open curve through midpoints of the given points.
  function smooth(ctx, pts, closed) {
    const n = pts.length / 2;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 1; i < n - 1; i++) {
      const mx = (pts[i * 2] + pts[i * 2 + 2]) / 2;
      const my = (pts[i * 2 + 1] + pts[i * 2 + 3]) / 2;
      ctx.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx, my);
    }
    ctx.lineTo(pts[n * 2 - 2], pts[n * 2 - 1]);
    if (closed) ctx.closePath();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = Math.min(U, W / 112);
    return { W, H, U, u, cx: W * 0.5, gy: H * 0.87, y0: H * 0.87 - u * 7 };
  }

  // ---- sky, hills, pagoda ----------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = Math.ceil(g.H * 0.75);
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / (g.H * 0.58)) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[Math.min(inks.length - 1, k + (rand() < f - k ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const sx = g.W * 0.2;
    const sy = g.H * 0.2;
    const glow = ctx.createRadialGradient(sx, sy, g.U, sx, sy, g.U * 40);
    glow.addColorStop(0, 'rgba(244,228,172,0.7)');
    glow.addColorStop(1, 'rgba(244,228,172,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H * 0.75);
    ctx.fillStyle = '#f2e4b4';
    blob(ctx, sx, sy, g.U * 5, g.U * 5);
    ctx.fillStyle = '#d9d2b8';
    for (let i = 0; i < 6; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      const y = g.H * (0.05 + rand() * 0.2);
      blob(ctx, x, y, g.U * (8 + rand() * 12), g.U * (0.4 + rand() * 0.4));
    }
  }

  function ridge(g, x, base, amp, seed, scale) {
    return base + fbm(x / (g.U * scale), 2.2, 4, seed) * amp;
  }

  function hill(ctx, g, base, amp, seed, scale, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, base, amp, seed, scale));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function pagoda(ctx, g, x, yb, s) {
    const tiers = 5;
    const roof = '#6c7a86';
    const body = '#8c979d';
    let y = yb;
    ctx.fillStyle = body;
    ctx.fillRect(x - s * 4.2, y - s * 1.3, s * 8.4, s * 1.3);
    for (let i = 0; i < tiers; i++) {
      const w = s * (7.4 - i * 1.15);
      const bh = s * 2.1;
      ctx.fillStyle = body;
      ctx.fillRect(x - w * 0.55, y - s * 1.3 - bh, w * 1.1, bh);
      ctx.fillStyle = roof;
      const ry = y - s * 1.3 - bh;
      poly(ctx, [x - w * 1.05, ry + s * 0.2, x - w * 0.65, ry - s * 0.35, x + w * 0.65, ry - s * 0.35,
        x + w * 1.05, ry + s * 0.2, x + w * 0.7, ry + s * 0.75, x - w * 0.7, ry + s * 0.75]);
      y -= bh + s * 0.6;
    }
    ctx.fillStyle = roof;
    ctx.fillRect(x - s * 0.18, y - s * 4.6, s * 0.36, s * 4.6);
    for (let i = 0; i < 4; i++) ctx.fillRect(x - s * 0.7, y - s * (1.2 + i * 0.9), s * 1.4, s * 0.28);
  }

  function pineTree(ctx, x, y, h, ink, seed) {
    const r = K.rng(seed);
    const lean = h * (r() - 0.5) * 0.3;
    ctx.strokeStyle = '#3d3025';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - lean, y - h * 0.5, x + lean, y - h * 0.92);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const f = 0.42 + i * 0.17;
      const side = i % 2 ? 1 : -1;
      const px = x + lean * (2 * f - 1) * f + side * h * 0.14 * (1 - f * 0.6);
      const py = y - h * f;
      const w = h * (0.3 - f * 0.11);
      ctx.fillStyle = ink.dark;
      blob(ctx, px, py, w, w * 0.4);
      blob(ctx, px + side * w * 0.55, py + w * 0.06, w * 0.55, w * 0.32);
      ctx.fillStyle = ink.mid;
      blob(ctx, px - w * 0.1, py - w * 0.12, w * 0.75, w * 0.27);
      ctx.fillStyle = ink.light;
      blob(ctx, px - w * 0.3, py - w * 0.22, w * 0.4, w * 0.13);
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    hill(ctx, g, g.H * 0.42, g.H * 0.16, 31, 38, '#a7b5b3');
    pagoda(ctx, g, g.W * 0.27, g.H * 0.57, g.U * 0.95);
    hill(ctx, g, g.H * 0.55, g.H * 0.1, 53, 26, '#7f9689');
    const mid = (x) => ridge(g, x, g.H * 0.55, g.H * 0.1, 53, 26);
    for (let x = 0; x < g.W; x += g.U * (1.6 + rand() * 2.2)) {
      const y = mid(x);
      const pink = rand() < 0.4;
      ctx.fillStyle = pink ? PINK[1] : '#5d7766';
      blob(ctx, x, y + g.U * 0.6, g.U * (1.4 + rand() * 1.6), g.U * (1.0 + rand() * 0.8));
      if (pink) {
        ctx.fillStyle = PINK[2];
        blob(ctx, x - g.U * 0.4, y, g.U * 0.9, g.U * 0.6);
      }
    }
    hill(ctx, g, g.H * 0.68, g.H * 0.06, 71, 22, '#566f5b');
    const near = (x) => ridge(g, x, g.H * 0.68, g.H * 0.06, 71, 22);
    for (let x = 0; x < g.W; x += g.U * (2 + rand() * 3)) {
      ctx.fillStyle = rand() < 0.5 ? '#3f5a45' : '#4a6650';
      blob(ctx, x, near(x) + g.U * 0.8, g.U * (1.8 + rand() * 1.8), g.U * (1.1 + rand() * 0.8));
    }
    return c;
  }

  // ---- ground -----------------------------------------------------------------

  function paintGround(ctx, g, rand) {
    const top = g.H * 0.74;
    ctx.fillStyle = '#4b6040';
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#5c7249';
    for (let i = 0; i < g.W * 0.6; i++) ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), g.U * (1 + rand()), 1);
    // gravel court spreading from the pedestal toward the viewer
    const w0 = g.u * 40;
    const w1 = g.u * 78;
    ctx.fillStyle = '#c9bfa4';
    poly(ctx, [g.cx - w0, g.gy - g.u * 1.5, g.cx + w0, g.gy - g.u * 1.5, g.cx + w1, g.H, g.cx - w1, g.H]);
    ctx.strokeStyle = '#a79d86';
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    for (let i = 1; i < 9; i++) {
      const f = i / 9;
      const y = lerp(g.gy - g.u * 1.5, g.H, f * f);
      const hw = lerp(w0, w1, f * f);
      ctx.beginPath();
      ctx.moveTo(g.cx - hw, y);
      ctx.lineTo(g.cx + hw, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#e4dcc6';
    for (let i = 0; i < 40; i++) {
      const f = rand();
      const y = lerp(g.gy, g.H, f);
      const hw = lerp(w0, w1, f);
      ctx.fillRect(g.cx + (rand() * 2 - 1) * hw, y, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.2));
    }
  }

  // ---- the great Buddha --------------------------------------------------------

  // Left half of the outline in unit offsets: [dx, rise above the seat].
  const HALF = [-25, 0, -25.5, 4, -22.5, 9.5, -18, 12, -15, 17, -13.5, 23, -14, 29, -16, 34, -14, 37, -8, 38.6, -4.5, 39.6];

  function bodyPoints(g, grow) {
    const pts = [];
    for (let i = 0; i < HALF.length; i += 2) pts.push(g.cx + (HALF[i] - grow) * g.u, g.y0 - HALF[i + 1] * g.u);
    for (let i = HALF.length - 2; i >= 0; i -= 2) pts.push(g.cx - (HALF[i] - grow) * g.u, g.y0 - HALF[i + 1] * g.u);
    return pts;
  }

  function bronze(ctx, g, x0, x1) {
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, BRONZE[0]);
    grad.addColorStop(0.35, BRONZE[1]);
    grad.addColorStop(0.72, BRONZE[2]);
    grad.addColorStop(1, BRONZE[3]);
    return grad;
  }

  function pedestal(ctx, g) {
    const u = g.u;
    ctx.fillStyle = '#6f6c63';
    ctx.fillRect(g.cx - u * 34, g.y0 + u * 4.8, u * 68, u * 2.4);
    ctx.fillStyle = '#8d897c';
    ctx.fillRect(g.cx - u * 34, g.y0 + u * 4.8, u * 68, u * 0.5);
    ctx.fillStyle = '#7f7b6f';
    ctx.fillRect(g.cx - u * 30, g.y0 + u * 2.6, u * 60, u * 2.3);
    ctx.fillStyle = '#9a9689';
    ctx.fillRect(g.cx - u * 30, g.y0 + u * 2.6, u * 60, u * 0.45);
    // lotus petals around the seat
    for (let i = -7; i <= 7; i++) {
      const x = g.cx + i * u * 3.9;
      ctx.fillStyle = i < 0 ? BRONZE[1] : BRONZE[2];
      poly(ctx, [x - u * 2, g.y0 + u * 2.7, x, g.y0 - u * 0.6, x + u * 2, g.y0 + u * 2.7]);
      ctx.fillStyle = i < 0 ? BRONZE[0] : BRONZE[1];
      poly(ctx, [x - u * 0.9, g.y0 + u * 2.7, x - u * 0.1, g.y0 + u * 0.4, x + u * 0.6, g.y0 + u * 2.7]);
    }
  }

  function curls(ctx, g, cy, rx, ry) {
    const r = g.u * 0.55;
    ctx.fillStyle = '#1f2b24';
    for (let row = 0, y = cy - ry; y < cy + ry * 0.05; row++, y += r * 1.7) {
      for (let x = g.cx - rx - r; x < g.cx + rx + r; x += r * 2.1) {
        const px = x + (row % 2 ? r : 0);
        const dx = (px - g.cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy < 0.9) blob(ctx, px, y, r, r);
      }
    }
  }

  function face(ctx, g) {
    const u = g.u;
    const fy = g.y0 - u * 44.4;
    ctx.strokeStyle = '#1b2620';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, u * 0.38);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(g.cx + s * u * 2.1, fy - u * 0.6, u * 0.9, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g.cx + s * u * 0.8, fy - u * 2);
      ctx.quadraticCurveTo(g.cx + s * u * 2.2, fy - u * 2.8, g.cx + s * u * 3.6, fy - u * 1.9);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8fa48a';
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(g.cx - u * 0.3, fy - u * 1.2);
    ctx.lineTo(g.cx - u * 0.6, fy + u * 1.1);
    ctx.stroke();
    ctx.strokeStyle = '#1b2620';
    ctx.lineWidth = Math.max(1, u * 0.34);
    ctx.beginPath();
    ctx.moveTo(g.cx - u * 1.1, fy + u * 2.7);
    ctx.quadraticCurveTo(g.cx, fy + u * 3.1, g.cx + u * 1.1, fy + u * 2.7);
    ctx.stroke();
    ctx.fillStyle = '#d6b95e';
    blob(ctx, g.cx, fy - u * 2.8, u * 0.45, u * 0.45);
  }

  function robe(ctx, g) {
    const u = g.u;
    const X = (v) => g.cx + v * u;
    const Y = (v) => g.y0 - v * u;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1f2b24';
    ctx.lineWidth = Math.max(1, u * 0.5);
    const lines = [
      [-4.5, 38.6, -1.5, 33, 0, 29],
      [4.5, 38.6, 1.5, 33, 0, 29],
      [-15.5, 33, -8, 27, -11, 18],
      [-14.6, 28, -7, 22, -9.5, 13.5],
      [15.5, 33, 8, 27, 11, 18],
      [14.6, 28, 7, 22, 9.5, 13.5],
      [-17, 11.5, -8, 8.2, 0, 8.8],
      [17, 11.5, 8, 8.2, 0, 8.8],
      [-24, 4.5, -12, 2.4, 0, 3.2],
      [24, 4.5, 12, 2.4, 0, 3.2],
    ];
    for (const l of lines) {
      ctx.beginPath();
      ctx.moveTo(X(l[0]), Y(l[1]));
      ctx.quadraticCurveTo(X(l[2]), Y(l[3]), X(l[4]), Y(l[5]));
      ctx.stroke();
    }
    ctx.strokeStyle = BRONZE[0];
    ctx.lineWidth = Math.max(1, u * 0.28);
    for (const l of lines.slice(2, 6)) {
      ctx.beginPath();
      ctx.moveTo(X(l[0]) + u * 0.5, Y(l[1]) + u * 0.2);
      ctx.quadraticCurveTo(X(l[2]) + u * 0.5, Y(l[3]) + u * 0.2, X(l[4]) + u * 0.5, Y(l[5]) + u * 0.2);
      ctx.stroke();
    }
    // chest between the robe edges, a little lighter
    ctx.fillStyle = 'rgba(160,184,150,0.18)';
    poly(ctx, [X(-4.5), Y(38.6), X(4.5), Y(38.6), X(0), Y(29)]);
    // hands resting in the lap, thumbs touching
    ctx.fillStyle = BRONZE[1];
    blob(ctx, X(0), Y(11.6), u * 6.6, u * 2.5);
    ctx.fillStyle = BRONZE[0];
    blob(ctx, X(-1), Y(12.2), u * 5, u * 1.4);
    ctx.strokeStyle = '#1f2b24';
    ctx.lineWidth = Math.max(1, u * 0.34);
    ctx.beginPath();
    ctx.ellipse(X(0), Y(11.6), u * 6.6, u * 2.5, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(-2.5), Y(12.9));
    ctx.quadraticCurveTo(X(0), Y(14.4), X(2.5), Y(12.9));
    ctx.stroke();
  }

  function paintBuddha(ctx, g, rand) {
    const u = g.u;
    pedestal(ctx, g);
    const x0 = g.cx - u * 26;
    const x1 = g.cx + u * 26;
    // ears and neck sit behind the head
    ctx.fillStyle = bronze(ctx, g, x0, x1);
    for (const s of [-1, 1]) blob(ctx, g.cx + s * u * 6.5, g.y0 - u * 43.4, u * 1, u * 4);
    ctx.fillRect(g.cx - u * 4.2, g.y0 - u * 41, u * 8.4, u * 4);
    smooth(ctx, bodyPoints(g, 0), true);
    ctx.fill();
    // body shade on the far side, then a rim of morning light on the near side
    ctx.save();
    smooth(ctx, bodyPoints(g, 0), true);
    ctx.clip();
    ctx.fillStyle = 'rgba(20,32,26,0.28)';
    ctx.fillRect(g.cx + u * 9, g.y0 - u * 40, u * 20, u * 41);
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,214,170,0.55)';
    ctx.lineWidth = Math.max(1, u * 0.55);
    const rim = [];
    for (let i = 0; i < HALF.length; i += 2) rim.push(g.cx + (HALF[i] + 0.7) * u, g.y0 - HALF[i + 1] * u);
    smooth(ctx, rim, false);
    ctx.stroke();
    robe(ctx, g);
    // head with the topknot
    const hy = g.y0 - u * 46;
    ctx.fillStyle = bronze(ctx, g, g.cx - u * 7, g.cx + u * 7);
    blob(ctx, g.cx, hy, u * 6.2, u * 7);
    blob(ctx, g.cx, g.y0 - u * 52.6, u * 3.6, u * 2.5);
    curls(ctx, g, hy - u * 1.2, u * 6.2, u * 7.2);
    ctx.fillStyle = bronze(ctx, g, g.cx - u * 5, g.cx + u * 5);
    ctx.beginPath();
    ctx.ellipse(g.cx, g.y0 - u * 43.8, u * 4.9, u * 5.1, 0, 0, TAU);
    ctx.fill();
    face(ctx, g);
    ctx.strokeStyle = 'rgba(200,214,170,0.5)';
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    ctx.ellipse(g.cx, hy, u * 6.2, u * 7, 0, Math.PI * 0.95, Math.PI * 1.45);
    ctx.stroke();
  }

  // ---- lantern, trees, near branch ----------------------------------------------

  function lantern(ctx, g, x, y, s) {
    const stone = ['#9a968a', '#76736a', '#54524b'];
    ctx.fillStyle = stone[1];
    ctx.fillRect(x - s * 2.4, y - s * 1, s * 4.8, s * 1);
    ctx.fillStyle = stone[0];
    ctx.fillRect(x - s * 2.4, y - s * 1, s * 4.8, Math.max(1, s * 0.25));
    ctx.fillStyle = stone[1];
    ctx.fillRect(x - s * 0.8, y - s * 6, s * 1.6, s * 5);
    ctx.fillStyle = stone[2];
    ctx.fillRect(x + s * 0.1, y - s * 6, s * 0.7, s * 5);
    ctx.fillStyle = stone[1];
    ctx.fillRect(x - s * 2, y - s * 7, s * 4, s * 1);
    ctx.fillRect(x - s * 1.8, y - s * 9.8, s * 3.6, s * 2.8);
    ctx.fillStyle = '#2a2118';
    ctx.fillRect(x - s * 0.9, y - s * 9.2, s * 1.8, s * 1.7);
    ctx.fillStyle = '#d6b258';
    ctx.fillRect(x - s * 0.5, y - s * 8.9, s * 1, s * 1.1);
    ctx.fillStyle = stone[2];
    poly(ctx, [x - s * 3.8, y - s * 9.8, x - s * 1.4, y - s * 11.6, x + s * 1.4, y - s * 11.6, x + s * 3.8, y - s * 9.8, x + s * 2.2, y - s * 9.5, x - s * 2.2, y - s * 9.5]);
    ctx.fillStyle = stone[0];
    poly(ctx, [x - s * 3.8, y - s * 9.8, x - s * 1.4, y - s * 11.6, x, y - s * 11.6, x - s * 1.2, y - s * 9.8]);
    ctx.fillStyle = stone[1];
    blob(ctx, x, y - s * 12.1, s * 0.8, s * 0.7);
  }

  function blossomCloud(ctx, g, rand, x, y, r, n) {
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d * 0.7;
      const k = Math.min(3, Math.floor((1 - (py - (y - r)) / (r * 1.4) + rand() * 0.6) * 3));
      ctx.fillStyle = PINK[Math.max(0, k)];
      blob(ctx, px, py, g.u * (1.2 + rand() * 1.3), g.u * (0.9 + rand() * 0.9));
    }
  }

  // A cherry tree: dark leaning trunk, a few boughs, clouds of blossom at the tips.
  function sakura(ctx, g, rand, x, y, h, lean) {
    const tips = [];
    ctx.strokeStyle = BARK;
    ctx.lineCap = 'round';
    ctx.lineWidth = g.u * 3.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.4, x + lean, y - h * 0.62);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const bx = x + lean * (0.7 + 0.06 * i);
      const by = y - h * (0.5 + i * 0.06);
      const dir = i % 2 ? 1 : -1;
      const tx = bx + dir * g.u * (9 + rand() * 12);
      const ty = by - h * (0.12 + rand() * 0.2);
      ctx.lineWidth = g.u * (1.6 - i * 0.15);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + dir * g.u * 5, by - g.u * 3 - rand() * g.u * 4, tx, ty);
      ctx.stroke();
      tips.push(tx, ty);
    }
    tips.push(x + lean, y - h * 0.8);
    for (let i = 0; i < tips.length; i += 2) {
      blossomCloud(ctx, g, rand, tips[i], tips[i + 1], g.u * (8 + rand() * 5), 46);
    }
    ctx.fillStyle = PINK[3];
    for (let i = 0; i < 14; i++) {
      const k = Math.floor(rand() * (tips.length / 2)) * 2;
      blob(ctx, tips[k] + (rand() - 0.5) * g.u * 12, tips[k + 1] - rand() * g.u * 4, g.u * 0.7, g.u * 0.5);
    }
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGround(ctx, g, rand);
    pineTree(ctx, g.W * 0.73, g.H * 0.8, g.u * 40, NEEDLE, 7);
    pineTree(ctx, g.W * 0.33, g.H * 0.79, g.u * 30, NEEDLE, 3);
    sakura(ctx, g, rand, g.W * 0.12, g.H * 0.9, g.u * 62, g.u * 6);
    sakura(ctx, g, rand, g.W * 0.9, g.H * 0.86, g.u * 56, -g.u * 5);
    paintBuddha(ctx, g, rand);
    lantern(ctx, g, g.W * 0.25, g.H * 0.95, g.u * 1.7);
    // moss and stones at the foot of the court
    for (let x = 0; x < g.W; x += g.u * (2 + rand() * 3)) {
      if (x > g.cx - g.u * 36 && x < g.cx + g.u * 36) continue;
      ctx.fillStyle = '#35492f';
      blob(ctx, x, g.H * 0.995, g.u * (1.6 + rand() * 1.6), g.u * 0.8);
    }
    // fallen petals lying on the ground
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = PETAL_TONES[i % 3];
      const y = g.H * (0.8 + rand() * 0.2);
      ctx.fillRect(rand() * g.W, y, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.3));
    }
    return c;
  }

  function paintFront(g, rand) {
    const w = g.W * 0.5;
    const c = layer(g.W, g.H * 0.4);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = BARK;
    ctx.lineCap = 'round';
    ctx.lineWidth = g.U * 2;
    ctx.beginPath();
    ctx.moveTo(g.W + g.U * 3, g.H * 0.04);
    ctx.quadraticCurveTo(g.W - w * 0.45, g.H * 0.02, g.W - w * 0.85, g.H * 0.15);
    ctx.stroke();
    ctx.lineWidth = g.U * 0.9;
    for (let i = 0; i < 4; i++) {
      const f = 0.1 + i * 0.22;
      const x = g.W - w * 0.9 * f;
      const y = g.H * (0.03 + f * 0.1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - g.U * 4, y + g.U * 5, x - g.U * 8, y + g.U * (6 + i));
      ctx.stroke();
      blossomCloud(ctx, g, rand, x - g.U * 6, y + g.U * 5, g.U * 8, 60);
    }
    blossomCloud(ctx, g, rand, g.W - w * 0.85, g.H * 0.15, g.U * 9, 50);
    ctx.fillStyle = PINK[3];
    for (let i = 0; i < 18; i++) blob(ctx, g.W - rand() * w, g.H * (0.03 + rand() * 0.14), g.U * 0.8, g.U * 0.55);
    return c;
  }

  // ---- mist, light, petals -----------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.16);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 14), y / (g.U * 4), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.36, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 234;
        img.data[i + 1] = 228;
        img.data[i + 2] = 212;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 1.0) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.4);
    ctx.drawImage(m, w - a, g.H * 0.4);
    const b = (t * g.U * 0.6 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.55);
    ctx.drawImage(m, b - w, g.H * 0.66);
    ctx.drawImage(m, b, g.H * 0.66);
    ctx.globalAlpha = 1;
  }

  // Pale beams slanting down from the low sun.
  function paintShafts(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sx = g.W * 0.2;
    const sy = g.H * 0.2;
    const beams = [[0.1, 0.2], [0.32, 0.3], [0.55, 0.24], [0.78, 0.18]];
    for (const [a, wd] of beams) {
      const x1 = g.W * (a - 0.1);
      const x2 = x1 + g.W * wd * 0.5;
      const grad = ctx.createLinearGradient(sx, sy, g.W * a + g.W * 0.2, g.H);
      grad.addColorStop(0, 'rgba(246,232,176,0.5)');
      grad.addColorStop(1, 'rgba(246,232,176,0)');
      ctx.fillStyle = grad;
      poly(ctx, [sx - g.U, sy, sx + g.U, sy, x2 + g.W * 0.25, g.H, x1 + g.W * 0.25, g.H]);
    }
    return c;
  }

  function resetPetal(g, P, i, scatter) {
    const r = state.rand;
    P.x[i] = r() * g.W;
    P.y[i] = scatter ? r() * g.H : -g.U * (1 + r() * 8);
    P.vy[i] = g.U * (2.4 + r() * 2.2);
    P.vx[i] = g.U * (0.4 + r() * 1.2);
    P.size[i] = Math.max(1.4, g.U * (0.7 + r() * 0.7));
    P.a[i] = r() * TAU;
    P.spin[i] = (r() - 0.5) * 3;
    P.p[i] = r() * TAU;
    P.tone[i] = Math.floor(r() * PETAL_TONES.length);
  }

  function makePetals(g) {
    const f = () => new Float32Array(MAX_PETALS);
    const P = { x: f(), y: f(), vx: f(), vy: f(), size: f(), a: f(), spin: f(), p: f(), tone: f() };
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, P, i, true);
    return P;
  }

  function drawPetals(ctx, g, t, dt, count) {
    const P = state.petals;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      P.y[i] += P.vy[i] * step;
      P.x[i] += (P.vx[i] + Math.sin(t * 0.9 + P.p[i]) * g.U * 2) * step;
      P.a[i] += P.spin[i] * step;
      if (P.y[i] > g.H || P.x[i] > g.W + g.U * 3) resetPetal(g, P, i, false);
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + P.p[i]));
      const sz = P.size[i];
      ctx.fillStyle = PETAL_TONES[P.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, P.x[i], P.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.mid = paintMid(g, rand);
    state.front = paintFront(g, rand);
    state.mist = paintMist(g);
    state.shafts = paintShafts(g);
    state.petals = makePetals(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, mist, light } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist * 0.6);
    ctx.drawImage(state.mid, 0, 0);
    if (light > 0) {
      ctx.globalAlpha = Math.min(1, light * (0.55 + 0.45 * Math.sin(t * 0.25)));
      ctx.drawImage(state.shafts, Math.sin(t * 0.12) * g.U * 3, 0);
      ctx.globalAlpha = 1;
    }
    drawMist(ctx, g, t + 40, mist * 0.7);
    ctx.drawImage(state.front, Math.sin(t * 0.5) * g.U * 0.5, Math.sin(t * 0.7 + 1) * g.U * 0.3);
    drawPetals(ctx, g, t, dt, count);
  }

  Kasuri.run({
    defaults: { petals: 1, mist: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
