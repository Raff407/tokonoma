/*
 * 功夫茶 Gongfu tea — a dark wood tray under a paper lantern.
 *
 * Wall, lattice window, table, tray and every vessel are baked once. Per frame:
 * a pooled set of steam puffs, the thin stream from the pitcher with a ring in the
 * cup below, the charcoal glow and a slow lantern breath.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const PUFFS = 26;
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
    const s = Math.min(H / 82, W / 138);
    const cx = W * 0.5;
    const ty = H * 0.71;
    const tilt = 0.55;
    const px = cx - 40 * s;
    const py = ty - 2 * s;
    const tipX = px + s * (9.5 * Math.cos(tilt) + 4.5 * Math.sin(tilt));
    const tipY = py + s * (9.5 * Math.sin(tilt) - 4.5 * Math.cos(tilt));
    return {
      W, H, s, cx, ty, tilt, px, py, tipX, tipY,
      cupY: ty + 9 * s,
      cupX: [tipX, tipX + 12 * s, tipX + 24 * s],
      potX: cx + 14 * s, potY: ty - 3 * s,
      kx: cx + 44 * s, ky: ty - 4 * s,
      lx: W * 0.17, ly: H * 0.15,
    };
  }

  // ---- wall, window, lantern ----------------------------------------------

  function paintWall(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.55);
    grad.addColorStop(0, '#231a1b');
    grad.addColorStop(1, '#3a2a20');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < g.W; x += g.s * 14) ctx.fillRect(x, 0, Math.max(1, g.s * 0.35), g.H * 0.55);
  }

  function bamboo(ctx, g, x, y0, y1, w) {
    ctx.fillStyle = '#26382e';
    ctx.fillRect(x, y0, w, y1 - y0);
    ctx.fillStyle = '#3d5442';
    ctx.fillRect(x, y0, Math.max(1, w * 0.3), y1 - y0);
    ctx.fillStyle = '#18251d';
    for (let y = y0 + g.s * 5; y < y1; y += g.s * 9) ctx.fillRect(x - w * 0.15, y, w * 1.3, Math.max(1, g.s * 0.5));
  }

  function leaves(ctx, g, x, y, dir, n) {
    ctx.fillStyle = '#2f4636';
    for (let i = 0; i < n; i++) {
      const a = dir * (0.3 + i * 0.28);
      const len = g.s * (7 - i * 0.6);
      poly(ctx, [x, y + i * g.s, x + Math.cos(a) * len * dir, y + i * g.s + Math.sin(a) * len + g.s * 1.2,
        x + Math.cos(a) * len * dir * 0.5, y + i * g.s + Math.sin(a) * len * 0.5 - g.s * 0.7]);
    }
  }

  function paintWindow(ctx, g) {
    const s = g.s;
    const x0 = g.W * 0.64;
    const y0 = g.H * 0.07;
    const w = Math.min(g.W * 0.26, s * 46);
    const h = g.H * 0.4;
    ctx.fillStyle = '#1b2641';
    ctx.fillRect(x0, y0, w, h);
    const sky = ctx.createLinearGradient(0, y0, 0, y0 + h);
    sky.addColorStop(0, '#26335a');
    sky.addColorStop(1, '#3a4a68');
    ctx.fillStyle = sky;
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#d9d2b4';
    blob(ctx, x0 + w * 0.7, y0 + h * 0.25, s * 3.6, s * 3.6);
    ctx.fillStyle = 'rgba(217,210,180,0.18)';
    blob(ctx, x0 + w * 0.7, y0 + h * 0.25, s * 7, s * 7);
    bamboo(ctx, g, x0 + w * 0.2, y0, y0 + h, Math.max(1.5, s * 1.4));
    bamboo(ctx, g, x0 + w * 0.42, y0 + h * 0.2, y0 + h, Math.max(1.5, s * 1.1));
    leaves(ctx, g, x0 + w * 0.2, y0 + h * 0.3, 1, 5);
    leaves(ctx, g, x0 + w * 0.42, y0 + h * 0.5, -1, 4);
    leaves(ctx, g, x0 + w * 0.2, y0 + h * 0.62, -1, 4);
    // square lattice and frame
    ctx.fillStyle = '#2a1d15';
    const step = w / 6;
    const bar = Math.max(1, s * 0.9);
    for (let i = 1; i < 6; i++) ctx.fillRect(x0 + i * step - bar / 2, y0, bar, h);
    const rows = Math.round(h / step);
    for (let j = 1; j < rows; j++) ctx.fillRect(x0, y0 + j * (h / rows) - bar / 2, w, bar);
    const f = Math.max(2, s * 2);
    ctx.fillStyle = '#3d2a1c';
    ctx.fillRect(x0 - f, y0 - f, w + f * 2, f);
    ctx.fillRect(x0 - f, y0 + h, w + f * 2, f * 1.4);
    ctx.fillRect(x0 - f, y0, f, h);
    ctx.fillRect(x0 + w, y0, f, h);
    ctx.fillStyle = '#5a4128';
    ctx.fillRect(x0 - f, y0 - f, w + f * 2, Math.max(1, s * 0.4));
  }

  function paintLantern(ctx, g) {
    const s = g.s;
    const { lx, ly } = g;
    ctx.fillStyle = '#17110e';
    ctx.fillRect(lx - 0.5, 0, Math.max(1, s * 0.4), ly - s * 10);
    ctx.fillStyle = '#2c1e16';
    ctx.fillRect(lx - s * 3.5, ly - s * 11, s * 7, s * 2);
    ctx.fillStyle = '#9c3a26';
    blob(ctx, lx, ly, s * 8, s * 10);
    ctx.fillStyle = '#c4572f';
    blob(ctx, lx - s * 0.8, ly - s * 0.6, s * 6.4, s * 8.6);
    ctx.fillStyle = '#e8b45e';
    blob(ctx, lx - s * 0.5, ly, s * 4, s * 6);
    ctx.fillStyle = '#f2d890';
    blob(ctx, lx - s * 0.5, ly, s * 2, s * 3.4);
    ctx.strokeStyle = '#6e2616';
    ctx.lineWidth = Math.max(1, s * 0.35);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(lx, ly, Math.max(0.5, s * 8 * Math.abs(i) / 2.6), s * 10, 0, 0, TAU);
      if (i !== 0) ctx.stroke();
    }
    ctx.fillStyle = '#2c1e16';
    ctx.fillRect(lx - s * 4, ly + s * 9, s * 8, s * 1.8);
    ctx.fillRect(lx - s * 4, ly - s * 10, s * 8, s * 1.4);
    ctx.fillStyle = '#b8872f';
    for (let i = -2; i <= 2; i++) ctx.fillRect(lx + i * s * 1.3 - 0.5, ly + s * 11, Math.max(1, s * 0.4), s * (6 - Math.abs(i)));
    ctx.fillStyle = '#9c3a26';
    blob(ctx, lx, ly + s * 11, s * 1.2, s * 1.2);
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const r = g.s * 60;
    const a = ctx.createRadialGradient(g.lx, g.ly, g.s * 4, g.lx, g.ly, r);
    a.addColorStop(0, 'rgba(240,176,92,0.42)');
    a.addColorStop(1, 'rgba(240,176,92,0)');
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // ---- table and tray --------------------------------------------------------

  function paintTable(ctx, g) {
    const y = g.H * 0.5;
    const grad = ctx.createLinearGradient(0, y, 0, g.H);
    grad.addColorStop(0, '#5a3a24');
    grad.addColorStop(1, '#2b1a11');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, g.W, g.H - y);
    ctx.fillStyle = '#7a5434';
    ctx.fillRect(0, y, g.W, Math.max(1, g.s * 0.7));
    ctx.fillStyle = 'rgba(20,10,5,0.22)';
    for (let i = 1; i < 9; i++) ctx.fillRect(0, y + (g.H - y) * i / 9 * (0.5 + i / 18), g.W, Math.max(1, g.s * 0.25));
  }

  function paintTray(ctx, g) {
    const s = g.s;
    const w = 124 * s;
    const h = 34 * s;
    const x0 = g.cx - w / 2;
    const y0 = g.ty - h / 2 + 4 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x0 + s, y0 + h + s * 0.5, w, s * 3);
    ctx.fillStyle = '#1b110b';
    ctx.fillRect(x0, y0 + h - s * 1.2, w, s * 4.4);
    ctx.fillStyle = '#6a4a2c';
    ctx.fillRect(x0, y0 + h - s * 1.2, w, s * 0.7);
    ctx.fillStyle = '#4a321e';
    ctx.fillRect(x0 - s, y0 - s, w + s * 2, h + s * 1.6);
    ctx.fillStyle = '#6d4a2a';
    ctx.fillRect(x0 - s, y0 - s, w + s * 2, Math.max(1, s * 0.6));
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(x0, y0, w, h);
    // slats
    ctx.fillStyle = '#271910';
    for (let y = y0 + s * 2; y < y0 + h - s; y += s * 2.2) ctx.fillRect(x0 + s * 2, y, w - s * 4, Math.max(1, s * 0.7));
    ctx.fillStyle = 'rgba(214,150,80,0.12)';
    for (let y = y0 + s * 3; y < y0 + h - s; y += s * 2.2) ctx.fillRect(x0 + s * 2, y, w - s * 4, Math.max(1, s * 0.3));
    // warm light pool
    const pool = ctx.createRadialGradient(g.cx - 10 * s, g.ty, s * 6, g.cx - 10 * s, g.ty, s * 62);
    pool.addColorStop(0, 'rgba(236,170,90,0.3)');
    pool.addColorStop(1, 'rgba(236,170,90,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(x0, y0, w, h);
  }

  // ---- vessels ---------------------------------------------------------------

  function cup(ctx, g, x, y, r) {
    const s = g.s;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    blob(ctx, x + r * 0.2, y + r * 0.8, r * 1.15, r * 0.34);
    ctx.fillStyle = '#b9b9ae';
    poly(ctx, [x - r, y - r * 0.2, x + r, y - r * 0.2, x + r * 0.55, y + r * 0.8, x - r * 0.55, y + r * 0.8]);
    blob(ctx, x, y + r * 0.8, r * 0.55, r * 0.18);
    ctx.fillStyle = '#e9e4d2';
    poly(ctx, [x - r, y - r * 0.2, x - r * 0.2, y - r * 0.2, x - r * 0.1, y + r * 0.8, x - r * 0.55, y + r * 0.8]);
    ctx.strokeStyle = '#3c5a8c';
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.88, y + r * 0.12);
    ctx.quadraticCurveTo(x, y + r * 0.5, x + r * 0.88, y + r * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.5);
    ctx.quadraticCurveTo(x, y + r * 0.8, x + r * 0.7, y + r * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#efe9d6';
    blob(ctx, x, y - r * 0.2, r, r * 0.34);
    ctx.fillStyle = '#b9772f';
    blob(ctx, x, y - r * 0.16, r * 0.82, r * 0.26);
    ctx.fillStyle = '#d99a48';
    blob(ctx, x - r * 0.2, y - r * 0.2, r * 0.4, r * 0.1);
  }

  function pitcher(ctx, g) {
    const s = g.s;
    ctx.save();
    ctx.translate(g.px, g.py);
    ctx.rotate(g.tilt);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    blob(ctx, 0.5 * s, 6.5 * s, 6 * s, 1.4 * s);
    ctx.fillStyle = '#5f7a66';
    blob(ctx, 0, 0, 6.2 * s, 5.6 * s);
    poly(ctx, [4 * s, -2.5 * s, 10.2 * s, -5.4 * s, 10.4 * s, -3.8 * s, 5 * s, 1.2 * s]);
    ctx.fillStyle = '#7d9a80';
    blob(ctx, -1.6 * s, -1.4 * s, 4 * s, 3.4 * s);
    ctx.fillStyle = '#a5bea0';
    blob(ctx, -2.6 * s, -2.4 * s, 1.8 * s, 1.3 * s);
    ctx.fillStyle = '#c9d6bd';
    blob(ctx, 0, -5.2 * s, 4.4 * s, 1.1 * s);
    ctx.fillStyle = '#3f5546';
    blob(ctx, 0, -5.1 * s, 3.6 * s, 0.7 * s);
    ctx.strokeStyle = '#5f7a66';
    ctx.lineWidth = Math.max(1.2, s * 1.2);
    ctx.beginPath();
    ctx.moveTo(-5 * s, -3 * s);
    ctx.bezierCurveTo(-11 * s, -4 * s, -11 * s, 3.5 * s, -5.5 * s, 3 * s);
    ctx.stroke();
    ctx.restore();
  }

  function teapot(ctx, g) {
    const s = g.s;
    const x = g.potX;
    const y = g.potY;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    blob(ctx, x + s, y + 7.6 * s, 11 * s, 2.2 * s);
    ctx.strokeStyle = '#6a3524';
    ctx.lineWidth = Math.max(1.5, s * 1.7);
    ctx.beginPath();
    ctx.moveTo(x + 8 * s, y - 2.5 * s);
    ctx.bezierCurveTo(x + 17 * s, y - 5 * s, x + 17 * s, y + 5 * s, x + 8.5 * s, y + 4 * s);
    ctx.stroke();
    ctx.fillStyle = '#7a3a26';
    poly(ctx, [x - 8 * s, y - 1 * s, x - 17 * s, y - 7 * s, x - 18 * s, y - 5.4 * s, x - 9 * s, y + 3.5 * s]);
    ctx.fillStyle = '#8c4630';
    blob(ctx, x, y + s, 10.4 * s, 7.4 * s);
    ctx.fillStyle = '#a4573a';
    blob(ctx, x - 2.8 * s, y - 0.8 * s, 6.6 * s, 4.6 * s);
    ctx.fillStyle = '#c0764c';
    blob(ctx, x - 4.4 * s, y - 2 * s, 2.6 * s, 1.6 * s);
    ctx.fillStyle = '#6a3524';
    blob(ctx, x, y - 6.2 * s, 5.2 * s, 1.5 * s);
    ctx.fillStyle = '#8c4630';
    blob(ctx, x, y - 7.6 * s, 4.6 * s, 2.6 * s);
    ctx.fillStyle = '#a4573a';
    blob(ctx, x - 1 * s, y - 8.2 * s, 2.6 * s, 1.4 * s);
    ctx.fillStyle = '#6a3524';
    blob(ctx, x, y - 10.4 * s, 1.5 * s, 1.5 * s);
  }

  function stove(ctx, g) {
    const s = g.s;
    const x = g.kx;
    const y = g.ky + 6 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    blob(ctx, x + s, y + 9 * s, 10 * s, 2 * s);
    ctx.fillStyle = '#5c2a1c';
    poly(ctx, [x - 8 * s, y, x + 8 * s, y, x + 9 * s, y + 8.5 * s, x - 9 * s, y + 8.5 * s]);
    ctx.fillStyle = '#7a3a26';
    poly(ctx, [x - 8 * s, y, x - 2 * s, y, x - 3 * s, y + 8.5 * s, x - 9 * s, y + 8.5 * s]);
    ctx.fillStyle = '#4a2016';
    blob(ctx, x, y, 8 * s, 2 * s);
    ctx.fillStyle = '#17100b';
    poly(ctx, [x - 3.5 * s, y + 8.5 * s, x - 3.5 * s, y + 4.5 * s, x, y + 3 * s, x + 3.5 * s, y + 4.5 * s, x + 3.5 * s, y + 8.5 * s]);
    ctx.fillStyle = '#b8872f';
    ctx.fillRect(x - 9 * s, y + 1.8 * s, 18 * s, Math.max(1, s * 0.5));
  }

  function kettle(ctx, g) {
    const s = g.s;
    const x = g.kx;
    const y = g.ky - 4 * s;
    ctx.fillStyle = '#2c2723';
    poly(ctx, [x - 7 * s, y + 1 * s, x - 14.5 * s, y - 8 * s, x - 16 * s, y - 7 * s, x - 8 * s, y + 4 * s]);
    ctx.fillStyle = '#403932';
    blob(ctx, x, y + 1.5 * s, 9.6 * s, 7 * s);
    ctx.fillStyle = '#5a5046';
    blob(ctx, x - 3 * s, y - 0.5 * s, 5.4 * s, 4.2 * s);
    ctx.fillStyle = '#7a6c58';
    blob(ctx, x - 4.5 * s, y - 2 * s, 2.2 * s, 1.4 * s);
    ctx.fillStyle = '#2c2723';
    blob(ctx, x, y - 5.2 * s, 4.6 * s, 1.4 * s);
    blob(ctx, x, y - 6.6 * s, 1.3 * s, 1.3 * s);
    ctx.strokeStyle = '#b8872f';
    ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.beginPath();
    ctx.moveTo(x - 8.4 * s, y - 2 * s);
    ctx.bezierCurveTo(x - 7 * s, y - 15 * s, x + 7 * s, y - 15 * s, x + 8.4 * s, y - 2 * s);
    ctx.stroke();
  }

  function paintObjects(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    stove(ctx, g);
    kettle(ctx, g);
    teapot(ctx, g);
    pitcher(ctx, g);
    // back cup row slightly higher, then front cups
    for (let i = 0; i < 3; i++) cup(ctx, g, g.cupX[i], g.cupY, g.s * 4.2);
    return c;
  }

  // ---- motion ---------------------------------------------------------------

  function makePuffs(g, rand) {
    const n = PUFFS;
    const P = {
      src: new Uint8Array(n), age: new Float32Array(n), life: new Float32Array(n),
      p: new Float32Array(n), x: new Float32Array(n), y: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) resetPuff(P, i, rand, true);
    return P;
  }

  function resetPuff(P, i, rand, first) {
    P.src[i] = i % 4 === 3 ? 1 : i % 5 === 4 ? 2 : 0;
    P.life[i] = 4 + rand() * 3;
    P.age[i] = first ? rand() * P.life[i] : 0;
    P.p[i] = rand() * TAU;
  }

  function sourceXY(g, k, out) {
    if (k === 0) { out[0] = g.kx - 15.5 * g.s; out[1] = g.ky - 12 * g.s; out[2] = 7; }
    else if (k === 1) { out[0] = g.potX - 17.5 * g.s; out[1] = g.potY - 6.5 * g.s; out[2] = 5; }
    else { out[0] = g.cupX[1]; out[1] = g.cupY - 2 * g.s; out[2] = 4; }
  }

  const pos = [0, 0, 0];

  function drawSteam(ctx, g, dt, amount) {
    const P = state.puffs;
    const n = Math.min(PUFFS, Math.round(PUFFS * Math.min(1, amount)));
    ctx.fillStyle = '#e4dcc6';
    for (let i = 0; i < PUFFS; i++) {
      P.age[i] += dt;
      if (P.age[i] > P.life[i]) resetPuff(P, i, state.rand, false);
      if (i >= n) continue;
      const f = P.age[i] / P.life[i];
      sourceXY(g, P.src[i], pos);
      const k = P.src[i];
      const rise = g.s * pos[2] * 2.6 * P.age[i];
      const sway = Math.sin(P.age[i] * 0.9 + P.p[i]) * g.s * (1 + f * 4) * (k === 0 ? 1.2 : 0.8);
      const r = g.s * (0.9 + f * (k === 2 ? 2.2 : 4));
      ctx.globalAlpha = Math.sin(f * Math.PI) * (k === 2 ? 0.2 : 0.32) * Math.min(1, amount);
      blob(ctx, pos[0] + sway - f * g.s * 3, pos[1] - rise, r, r * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function drawPour(ctx, g, t, amount) {
    if (amount <= 0.02) return;
    const s = g.s;
    const x = g.tipX;
    const y = g.tipY;
    const ey = g.cupY - 1.2 * s;
    ctx.globalAlpha = Math.min(1, amount);
    ctx.strokeStyle = '#e2b868';
    ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.setLineDash([s * 2.4, s * 0.8]);
    ctx.lineDashOffset = -t * s * 14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 1.2, y + (ey - y) * 0.5, x + s * 0.2, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f4dc9c';
    ctx.lineWidth = Math.max(1, s * 0.3);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.2, y + s * 0.5);
    ctx.quadraticCurveTo(x + s * 0.9, y + (ey - y) * 0.5, x, ey);
    ctx.stroke();
    // rings in the cup
    ctx.lineWidth = Math.max(1, s * 0.3);
    for (let i = 0; i < 2; i++) {
      const f = (t * 0.9 + i * 0.5) % 1;
      ctx.globalAlpha = (1 - f) * 0.6 * Math.min(1, amount);
      ctx.beginPath();
      ctx.ellipse(g.cupX[0], g.cupY - 0.8 * s, s * (0.6 + f * 2.6), s * (0.2 + f * 0.9), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCoals(ctx, g, t) {
    const s = g.s;
    const x = g.kx;
    const y = g.ky + 6 * s;
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.3) * Math.sin(t * 0.37 + 1);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#c4572f';
    poly(ctx, [x - 3 * s, y + 8.2 * s, x - 3 * s, y + 5.2 * s, x, y + 4 * s, x + 3 * s, y + 5.2 * s, x + 3 * s, y + 8.2 * s]);
    ctx.fillStyle = '#e8a04a';
    blob(ctx, x, y + 7 * s, 2 * s, 1 * s);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.rand = K.rng(api.seed);
    const back = layer(g.W, g.H);
    const b = back.getContext('2d');
    paintWall(b, g);
    paintWindow(b, g);
    paintLantern(b, g);
    paintTable(b, g);
    paintTray(b, g);
    state.back = back;
    state.glow = paintGlow(g);
    state.objects = paintObjects(g);
    state.puffs = makePuffs(g, state.rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { steam, pour, lamp } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    ctx.globalAlpha = Math.min(1, (0.8 + 0.12 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 1.9)) * Math.min(1.4, lamp));
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.objects, 0, 0);
    drawCoals(ctx, g, t);
    drawPour(ctx, g, t, pour);
    drawSteam(ctx, g, step, steam);
  }

  Kasuri.run({
    defaults: { steam: 1, pour: 1, lamp: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
