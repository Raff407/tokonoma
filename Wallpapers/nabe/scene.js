/*
 * 鍋 Nabe — a clay hot-pot on a low table in a snowy farmhouse room at night.
 *
 * The room (earthen wall, beams, lattice window, alcove with a scroll, tatami, table,
 * pot, cushions) is baked once. Outside the window is its own baked layer with snow
 * falling in front of it. The lantern glow is one baked layer drawn with a faint sway.
 * Steam is a short reused pool of soft puffs.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const FLAKES = 90;
  const PUFFS = 16;
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
    const u = Math.min(U, W / 150);
    const cx = W * 0.5;
    const floor = H * 0.56;
    const tableY = H * 0.77;
    return {
      W, H, U, u, cx, floor, tableY,
      wx0: W * 0.09, wx1: W * 0.41, wy0: H * 0.15, wy1: H * 0.5,
      lampY: H * 0.3,
      potY: tableY - u * 2.5,
    };
  }

  // ---- outside the window ----------------------------------------------------

  function paintOutside(g, rand) {
    const w = Math.ceil(g.wx1 - g.wx0);
    const h = Math.ceil(g.wy1 - g.wy0);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1e2742');
    grad.addColorStop(0.6, '#2f3d63');
    grad.addColorStop(1, '#46557a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e0cf9a';
    for (let i = 0; i < 24; i++) ctx.fillRect(rand() * w, rand() * h * 0.5, 1, 1);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#e8d9a8';
    blob(ctx, w * 0.74, h * 0.24, g.u * 6, g.u * 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ede0b0';
    blob(ctx, w * 0.74, h * 0.24, g.u * 3, g.u * 3);
    ctx.fillStyle = '#5b6a8c';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.8);
    for (let x = 0; x <= w; x += 2) ctx.lineTo(x, h * (0.62 + 0.1 * Math.sin(x / (g.u * 7)) + 0.05 * K.fbm(x / (g.u * 9), 2, 2, 5)));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
    ctx.fillStyle = '#7b88a6';
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.72);
    ctx.lineTo(w * 0.34, h * 0.5);
    ctx.lineTo(w * 0.46, h * 0.72);
    ctx.fill();
    ctx.fillStyle = '#cbd2de';
    poly(ctx, [w * 0.34, h * 0.5, w * 0.37, h * 0.57, w * 0.31, h * 0.57]);
    // storehouse roof across the yard, heavy with snow
    ctx.fillStyle = '#272a3a';
    ctx.fillRect(w * 0.5, h * 0.66, w * 0.3, h * 0.2);
    ctx.fillStyle = '#d2d8e2';
    poly(ctx, [w * 0.46, h * 0.68, w * 0.84, h * 0.68, w * 0.78, h * 0.6, w * 0.52, h * 0.6]);
    ctx.fillStyle = '#9aa4b8';
    ctx.fillRect(w * 0.47, h * 0.67, w * 0.37, Math.max(1, g.u * 0.5));
    // snowy pines
    for (const [px, sc] of [[0.1, 1], [0.2, 0.7], [0.9, 0.9]]) {
      const x = w * px;
      const base = h * 0.9;
      ctx.fillStyle = '#1f2c34';
      ctx.fillRect(x - g.u * 0.3, base - g.u * 5, g.u * 0.6, g.u * 5);
      for (let t = 0; t < 4; t++) {
        const y = base - g.u * (5 + t * 4) * sc;
        const r = g.u * (7 - t * 1.4) * sc;
        ctx.fillStyle = '#233a3a';
        poly(ctx, [x, y - g.u * 5 * sc, x + r, y + g.u * sc, x - r, y + g.u * sc]);
        ctx.fillStyle = '#d6dce6';
        poly(ctx, [x, y - g.u * 5 * sc, x + r * 0.6, y - g.u * sc, x - r * 0.6, y - g.u * sc]);
      }
    }
    ctx.fillStyle = '#cdd3df';
    ctx.fillRect(0, h * 0.9, w, h * 0.1);
    return c;
  }

  // ---- the room --------------------------------------------------------------

  function paintWall(ctx, g, rand) {
    ctx.fillStyle = '#2f2a38';
    ctx.fillRect(0, 0, g.W, g.floor);
    for (let i = 0; i < g.W * g.floor * 0.03; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#3a3443' : '#27222f';
      ctx.fillRect(rand() * g.W, rand() * g.floor, 1 + rand() * g.u * 0.5, 1);
    }
    ctx.fillStyle = '#2b1f18';
    ctx.fillRect(0, 0, g.W, g.H * 0.07);
    ctx.fillStyle = '#44301f';
    ctx.fillRect(0, g.H * 0.07, g.W, g.u * 1.2);
    ctx.fillStyle = '#3e2c1f';
    ctx.fillRect(0, g.H * 0.1, g.W, g.u * 1.6);
    ctx.fillStyle = '#251a14';
    ctx.fillRect(0, g.H * 0.1 + g.u * 1.6, g.W, Math.max(1, g.u * 0.4));
    for (const px of [0.035, 0.515, 0.965]) {
      const x = g.W * px;
      ctx.fillStyle = '#3c2a1e';
      ctx.fillRect(x - g.u * 2, 0, g.u * 4, g.floor + g.u);
      ctx.fillStyle = '#51392a';
      ctx.fillRect(x - g.u * 2, 0, Math.max(1, g.u * 0.7), g.floor + g.u);
      ctx.fillStyle = '#251a14';
      ctx.fillRect(x + g.u * 1.4, 0, Math.max(1, g.u * 0.6), g.floor + g.u);
    }
    ctx.fillStyle = '#3c2a1e';
    ctx.fillRect(0, g.floor - g.u * 1.2, g.W, g.u * 1.2);
    ctx.fillStyle = '#51392a';
    ctx.fillRect(0, g.floor - g.u * 1.2, g.W, Math.max(1, g.u * 0.4));
  }

  function paintWindow(ctx, g) {
    const { wx0, wx1, wy0, wy1, u } = g;
    ctx.clearRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.fillStyle = '#3c2a1e';
    const t = Math.max(2, u * 1.4);
    ctx.fillRect(wx0 - t, wy0 - t, wx1 - wx0 + 2 * t, t);
    ctx.fillRect(wx0 - t, wy0, t, wy1 - wy0 + t);
    ctx.fillRect(wx1, wy0, t, wy1 - wy0 + t);
    ctx.fillStyle = '#51392a';
    ctx.fillRect(wx0 - t * 1.6, wy1, wx1 - wx0 + t * 3.2, t);
    const bar = Math.max(1, u * 0.8);
    ctx.fillStyle = '#34241a';
    for (let i = 1; i < 7; i++) ctx.fillRect(wx0 + (wx1 - wx0) * i / 7 - bar / 2, wy0, bar, wy1 - wy0);
    ctx.fillRect(wx0, wy0 + (wy1 - wy0) * 0.42, wx1 - wx0, bar);
    // snow resting on the sill
    ctx.fillStyle = '#d7dce6';
    ctx.beginPath();
    ctx.moveTo(wx0 - t * 1.2, wy1);
    ctx.quadraticCurveTo((wx0 + wx1) / 2, wy1 - u * 3, wx1 + t * 1.2, wy1);
    ctx.fill();
    ctx.fillStyle = '#a7b0c4';
    ctx.fillRect(wx0 - t * 1.2, wy1 - Math.max(1, u * 0.3), wx1 - wx0 + t * 2.4, Math.max(1, u * 0.3));
  }

  function paintAlcove(ctx, g) {
    const u = g.u;
    const x0 = g.W * 0.6;
    const x1 = g.W * 0.9;
    const y0 = g.H * 0.15;
    const y1 = g.floor - g.u * 1.2;
    ctx.fillStyle = '#463b34';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#5a4a3b';
    ctx.fillRect(x0, y1 - u * 2, x1 - x0, u * 2);
    ctx.fillStyle = '#34261c';
    ctx.fillRect(x0 - u, y0 - u, x1 - x0 + 2 * u, u);
    ctx.fillRect(x0 - u, y0, u, y1 - y0 + u * 2);
    // hanging scroll, ink mountain and a seal
    const sx = x0 + (x1 - x0) * 0.38;
    const sw = u * 12;
    const sy = y0 + u * 2;
    const sh = u * 24;
    ctx.fillStyle = '#2e3a5c';
    ctx.fillRect(sx - u, sy, sw + 2 * u, sh);
    ctx.fillStyle = '#dccfae';
    ctx.fillRect(sx, sy + u * 2, sw, sh - u * 4);
    ctx.fillStyle = '#8c7a5a';
    ctx.fillRect(sx - u * 0.6, sy + sh, sw + u * 1.2, Math.max(1, u * 0.8));
    ctx.fillStyle = '#3a3e4a';
    poly(ctx, [sx + sw * 0.1, sy + sh * 0.6, sx + sw * 0.4, sy + sh * 0.32, sx + sw * 0.62, sy + sh * 0.55, sx + sw * 0.78, sy + sh * 0.44, sx + sw * 0.92, sy + sh * 0.6]);
    ctx.fillStyle = '#6a6e7c';
    ctx.fillRect(sx + sw * 0.1, sy + sh * 0.6, sw * 0.82, u * 0.6);
    ctx.fillStyle = '#b4442b';
    ctx.fillRect(sx + sw * 0.72, sy + sh * 0.75, u * 1.5, u * 1.5);
    // vase with red nanten berries
    const vx = x0 + (x1 - x0) * 0.82;
    ctx.fillStyle = '#4f6347';
    blob(ctx, vx, y1 - u * 4.5, u * 2.6, u * 3.6);
    ctx.fillRect(vx - u * 1, y1 - u * 9, u * 2, u * 3);
    ctx.strokeStyle = '#2f4430';
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    ctx.moveTo(vx, y1 - u * 9);
    ctx.quadraticCurveTo(vx - u * 2, y1 - u * 14, vx - u * 5, y1 - u * 17);
    ctx.moveTo(vx, y1 - u * 9);
    ctx.quadraticCurveTo(vx + u * 2, y1 - u * 15, vx + u * 4, y1 - u * 19);
    ctx.stroke();
    ctx.fillStyle = '#b4442b';
    for (const [dx, dy] of [[-5, -17], [-4, -15.5], [-6, -15.8], [4, -19], [3, -17.4], [5, -17.6]]) blob(ctx, vx + u * dx, y1 + u * dy, u * 0.7, u * 0.7);
    ctx.fillStyle = '#4a6340';
    for (const [dx, dy] of [[-3, -13], [2, -14], [3, -16], [-4, -16.5]]) blob(ctx, vx + u * dx, y1 + u * dy, u * 1.1, u * 0.5);
  }

  function paintTatami(ctx, g) {
    const { W, H, floor, u } = g;
    ctx.fillStyle = '#4f5030';
    ctx.fillRect(0, floor, W, H - floor);
    const vx = W * 0.5;
    const vy = H * 0.2;
    ctx.fillStyle = '#40412a';
    for (let i = -4; i <= 4; i++) {
      const bx = vx + i * W * 0.32;
      const k = 1 / Math.max(0.01, H - vy);
      ctx.beginPath();
      ctx.moveTo(vx + (bx - vx) * ((floor - vy) * k), floor);
      ctx.lineTo(bx, H);
      ctx.lineTo(bx + u * 1.2, H);
      ctx.lineTo(vx + (bx - vx) * ((floor - vy) * k) + u * 0.4, floor);
      ctx.fill();
    }
    ctx.fillStyle = '#3a3a2c';
    ctx.fillRect(0, floor + (H - floor) * 0.34, W, Math.max(1, u * 0.7));
    ctx.fillRect(0, floor + (H - floor) * 0.75, W, Math.max(1, u * 1.1));
    ctx.fillStyle = '#5a5a38';
    for (let y = floor + u * 2; y < H; y += u * 2.2) ctx.fillRect(0, y, W, 1);
  }

  function paintTable(ctx, g) {
    const { cx, tableY, u } = g;
    ctx.fillStyle = '#2a1d15';
    ctx.fillRect(cx - u * 27, tableY, u * 3, u * 7);
    ctx.fillRect(cx + u * 24, tableY, u * 3, u * 7);
    ctx.fillStyle = '#4c3322';
    blob(ctx, cx, tableY + u * 1.6, u * 32, u * 8.4);
    ctx.fillStyle = '#8a6038';
    blob(ctx, cx, tableY, u * 32, u * 8);
    ctx.fillStyle = '#a07446';
    blob(ctx, cx - u * 3, tableY - u * 0.8, u * 27, u * 6);
    ctx.strokeStyle = '#6a4629';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + i * u * 1.5, tableY, u * (28 - Math.abs(i) * 2), u * 7, 0, 0, TAU);
      ctx.stroke();
    }
  }

  function paintCushions(ctx, g) {
    const { cx, tableY, u } = g;
    for (const s of [-1, 1]) {
      const x = cx + s * u * 43;
      const y = tableY + u * 7;
      ctx.fillStyle = '#1c2540';
      blob(ctx, x, y + u * 1.3, u * 13, u * 4.4);
      ctx.fillStyle = '#2f3d68';
      blob(ctx, x, y, u * 13, u * 4.2);
      ctx.fillStyle = '#3b4c7d';
      blob(ctx, x - u * 2, y - u * 0.6, u * 8, u * 2.4);
      ctx.fillStyle = '#c9b88a';
      ctx.fillRect(x - u * 0.4, y - u * 4, Math.max(1, u * 0.8), u * 1.4);
    }
  }

  function paintTableware(ctx, g) {
    const { cx, tableY, u } = g;
    // two small bowls with a vermilion rim
    for (const s of [-1, 1]) {
      const x = cx + s * u * 18;
      const y = tableY + u * 2.2;
      ctx.fillStyle = '#2a2420';
      blob(ctx, x, y + u * 0.6, u * 3.6, u * 1.1);
      ctx.fillStyle = '#e1d6bb';
      ctx.beginPath();
      ctx.ellipse(x, y, u * 3.6, u * 1.3, 0, 0, Math.PI);
      ctx.lineTo(x - u * 2.2, y + u * 2.2);
      ctx.lineTo(x + u * 2.2, y + u * 2.2);
      ctx.fill();
      ctx.fillStyle = '#b4442b';
      blob(ctx, x, y, u * 3.6, u * 1.1);
      ctx.fillStyle = '#4e3a2c';
      blob(ctx, x, y + u * 0.1, u * 3, u * 0.8);
      ctx.strokeStyle = '#2a2420';
      ctx.lineWidth = Math.max(1, u * 0.35);
      ctx.beginPath();
      ctx.moveTo(x + u * 2, y - u * 3);
      ctx.lineTo(x + s * u * 6, y + u * 1.4);
      ctx.stroke();
    }
    // sake flask
    const fx = cx + u * 11;
    const fy = tableY - u * 1.2;
    ctx.fillStyle = '#3d4d3a';
    blob(ctx, fx, fy, u * 2.4, u * 3);
    ctx.fillRect(fx - u * 0.7, fy - u * 5, u * 1.4, u * 3);
    ctx.fillStyle = '#546a4e';
    blob(ctx, fx - u * 0.8, fy - u * 0.4, u * 0.7, u * 1.6);
  }

  function paintPot(ctx, g) {
    const { cx, potY, u } = g;
    ctx.fillStyle = '#2a1d15';
    blob(ctx, cx, potY + u * 4.8, u * 9, u * 2);
    // body
    ctx.fillStyle = '#3d2c24';
    ctx.beginPath();
    ctx.ellipse(cx, potY, u * 10.5, u * 6.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6b4a36';
    ctx.beginPath();
    ctx.ellipse(cx - u * 0.6, potY - u * 0.6, u * 9.6, u * 5.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7f5b42';
    blob(ctx, cx - u * 4, potY - u * 2, u * 3.4, u * 2.2);
    // glaze drip band
    ctx.fillStyle = '#2f2420';
    ctx.beginPath();
    ctx.ellipse(cx, potY - u * 1.2, u * 9.8, u * 3.4, 0, 0.1, Math.PI - 0.1);
    ctx.lineTo(cx, potY - u * 1.2);
    ctx.fill();
    // rim, lid and knob
    ctx.fillStyle = '#26191a';
    blob(ctx, cx, potY - u * 5.4, u * 8, u * 1.8);
    ctx.fillStyle = '#4d3829';
    ctx.beginPath();
    ctx.ellipse(cx, potY - u * 5.4, u * 7.4, u * 4.6, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#6a4a37';
    ctx.beginPath();
    ctx.ellipse(cx - u * 0.8, potY - u * 5.6, u * 5.6, u * 3.4, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a1d15';
    ctx.fillRect(cx - u * 1.1, potY - u * 10.8, u * 2.2, u * 1.6);
    blob(ctx, cx, potY - u * 10.8, u * 1.6, u * 0.8);
    // ear handles
    ctx.fillStyle = '#2f2420';
    blob(ctx, cx - u * 10.8, potY - u * 2.2, u * 1.8, u * 1.1);
    blob(ctx, cx + u * 10.8, potY - u * 2.2, u * 1.8, u * 1.1);
    // a bright edge where the lamp catches the lid
    ctx.fillStyle = '#c28a52';
    ctx.fillRect(cx - u * 4.6, potY - u * 8.5, u * 2.4, Math.max(1, u * 0.45));
  }

  function paintLantern(ctx, g) {
    const { cx, lampY, u } = g;
    ctx.strokeStyle = '#1c1613';
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, lampY - u * 8);
    ctx.stroke();
    ctx.fillStyle = '#2a1d15';
    ctx.fillRect(cx - u * 2.5, lampY - u * 8.6, u * 5, u * 1.5);
    ctx.fillStyle = '#d99a4a';
    blob(ctx, cx, lampY, u * 8.4, u * 8.4);
    ctx.fillStyle = '#efd9a0';
    blob(ctx, cx, lampY, u * 7.2, u * 7.6);
    ctx.fillStyle = '#f8ecc4';
    blob(ctx, cx - u * 0.6, lampY - u * 0.5, u * 4.6, u * 5);
    ctx.strokeStyle = '#c48844';
    ctx.lineWidth = Math.max(1, u * 0.28);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, lampY, u * 7.4 * Math.abs(i) / 3.2 + 0.4, u * 7.6, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a1d15';
    ctx.fillRect(cx - u * 2.5, lampY + u * 7.4, u * 5, u * 1.3);
  }

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    paintWindow(ctx, g);
    paintAlcove(ctx, g);
    paintTatami(ctx, g);
    paintCushions(ctx, g);
    paintTable(ctx, g);
    paintTableware(ctx, g);
    ctx.save();
    ctx.translate(g.cx, g.potY + g.u * 5);
    ctx.scale(1.5, 1.5);
    ctx.translate(-g.cx, -(g.potY + g.u * 5));
    paintPot(ctx, g);
    ctx.restore();
    paintLantern(ctx, g);
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spots = [
      [g.cx, g.lampY, g.u * 55, 0.4],
      [g.cx, g.tableY - g.u * 2, g.u * 40, 0.3],
    ];
    for (const [x, y, r, a] of spots) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(236,184,96,' + a + ')');
      gr.addColorStop(0.5, 'rgba(214,150,70,' + a * 0.4 + ')');
      gr.addColorStop(1, 'rgba(200,130,60,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  }

  // ---- snow and steam ----------------------------------------------------------

  function makeFlakes(g, rand) {
    const w = g.wx1 - g.wx0;
    const h = g.wy1 - g.wy0;
    const f = { x: new Float32Array(FLAKES), y: new Float32Array(FLAKES), vy: new Float32Array(FLAKES), p: new Float32Array(FLAKES), s: new Float32Array(FLAKES) };
    for (let i = 0; i < FLAKES; i++) {
      f.x[i] = rand() * w;
      f.y[i] = rand() * h;
      f.vy[i] = g.u * (2.2 + rand() * 2.4);
      f.p[i] = rand() * TAU;
      f.s[i] = rand() < 0.25 ? 2 : 1;
    }
    return f;
  }

  function makePuffs(rand) {
    const p = { age: new Float32Array(PUFFS), life: new Float32Array(PUFFS), dx: new Float32Array(PUFFS), ph: new Float32Array(PUFFS) };
    for (let i = 0; i < PUFFS; i++) {
      p.life[i] = 4.5 + rand() * 2;
      p.age[i] = rand() * p.life[i];
      p.dx[i] = (rand() - 0.5) * 2;
      p.ph[i] = rand() * TAU;
    }
    return p;
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const f = state.flakes;
    const w = g.wx1 - g.wx0;
    const h = g.wy1 - g.wy0;
    const count = Math.min(FLAKES, Math.round(FLAKES * amount * 0.6));
    ctx.fillStyle = '#ece8da';
    for (let i = 0; i < count; i++) {
      f.y[i] += f.vy[i] * dt;
      if (f.y[i] > h) f.y[i] -= h;
      const x = f.x[i] + Math.sin(t * 0.9 + f.p[i]) * g.u * 1.4 - f.y[i] * 0.12;
      const xx = ((x % w) + w) % w;
      ctx.globalAlpha = f.s[i] > 1 ? 0.95 : 0.7;
      ctx.fillRect(g.wx0 + xx, g.wy0 + f.y[i], f.s[i], f.s[i]);
    }
    ctx.globalAlpha = 1;
  }

  function drawSteam(ctx, g, t, dt, amount) {
    const p = state.puffs;
    const count = Math.min(PUFFS, Math.round(PUFFS * Math.min(1, amount * 0.7 + 0.2)));
    const x0 = g.cx;
    const y0 = g.potY + g.u * 5 - g.u * 16.5 * 1.5;
    ctx.fillStyle = '#e6dcc4';
    for (let i = 0; i < count; i++) {
      p.age[i] += dt;
      if (p.age[i] > p.life[i]) p.age[i] -= p.life[i];
      const k = p.age[i] / p.life[i];
      const x = x0 + p.dx[i] * g.u * 3 * k + Math.sin(t * 0.8 + p.ph[i]) * g.u * 2.2 * k;
      const y = y0 - k * g.u * 36;
      const r = g.u * (1.3 + k * 4.5);
      ctx.globalAlpha = Math.min(0.42, amount * 0.3) * Math.sin(Math.PI * k) ** 0.8;
      blob(ctx, x, y, r, r * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.outside = paintOutside(g, rand);
    state.room = paintRoom(g, rand);
    state.glow = paintGlow(g);
    state.flakes = makeFlakes(g, rand);
    state.puffs = makePuffs(rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, steam } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.outside, g.wx0, g.wy0);
    drawSnow(ctx, g, t, step, snow);
    ctx.drawImage(state.room, 0, 0);
    ctx.globalAlpha = 0.9 + 0.06 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 3.1 + 1);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    drawSteam(ctx, g, t, step, steam);
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
