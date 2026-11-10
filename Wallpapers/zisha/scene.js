/*
 * 紫砂 Zisha — a purple clay Yixing teapot on a wooden table.
 *
 * Wall, lattice window, table, tray, pot and cups are baked once. The window light
 * is one baked lattice patch that slides slowly across wall and table. Steam is a
 * short pool of soft puffs rising from the spout.
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    const ty = Math.round(H * 0.64);
    return { W, H, U, u, ty, cx: W * 0.5, base: H * 0.82 };
  }

  // ---- wall, window, table -------------------------------------------------

  function paintWall(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.ty);
    grad.addColorStop(0, '#1e2a3c');
    grad.addColorStop(1, '#2d3a4a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.ty);
    ctx.fillStyle = 'rgba(20,28,42,0.5)';
    for (let i = 0; i < 40; i++) ctx.fillRect(rand() * g.W, rand() * g.ty, g.U * (2 + rand() * 6), Math.max(1, g.U * 0.25));
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(0, g.ty - g.U * 2.2, g.W, g.U * 2.2);
    ctx.fillStyle = '#6a4a30';
    ctx.fillRect(0, g.ty - g.U * 2.2, g.W, Math.max(1, g.U * 0.5));
  }

  // The window frame sits on the left; its panes are the source of the light patch.
  function windowBox(g) {
    return { x: g.W * 0.06, y: g.H * 0.08, w: g.u * 38, h: g.H * 0.46 };
  }

  function latticePath(ctx, g, x, y, w, h) {
    const n = Math.max(3, Math.round(g.u * 1.1));
    const cw = w / 4;
    const ch = h / 5;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      ctx.moveTo(x + i * cw, y);
      ctx.lineTo(x + i * cw, y + h);
    }
    for (let j = 0; j <= 5; j++) {
      ctx.moveTo(x, y + j * ch);
      ctx.lineTo(x + w, y + j * ch);
    }
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) {
        if ((i + j) % 2) continue;
        ctx.moveTo(x + i * cw, y + j * ch);
        ctx.lineTo(x + (i + 1) * cw, y + (j + 1) * ch);
        ctx.moveTo(x + (i + 1) * cw, y + j * ch);
        ctx.lineTo(x + i * cw, y + (j + 1) * ch);
      }
    }
    return n;
  }

  function paintWindow(ctx, g) {
    const b = windowBox(g);
    ctx.fillStyle = '#e4dcc4';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const grad = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    grad.addColorStop(0, 'rgba(216,196,138,0.0)');
    grad.addColorStop(1, 'rgba(216,196,138,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#3a2a1e';
    ctx.lineWidth = Math.max(1, g.u * 0.55);
    latticePath(ctx, g, b.x, b.y, b.w, b.h);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, g.u * 1.6);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(b.x - g.u * 2, b.y + b.h, b.w + g.u * 4, g.u * 1.6);
  }

  function paintTable(ctx, g, rand) {
    const h = g.H - g.ty;
    const grad = ctx.createLinearGradient(0, g.ty, 0, g.H);
    grad.addColorStop(0, '#5a3d27');
    grad.addColorStop(1, '#7a5636');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.ty, g.W, h);
    ctx.fillStyle = '#3d2918';
    ctx.fillRect(0, g.ty, g.W, Math.max(1, g.U * 0.6));
    for (let i = 0; i < 70; i++) {
      const y = g.ty + g.U * 1 + rand() * (h - g.U);
      const x = rand() * g.W;
      ctx.fillStyle = rand() < 0.5 ? 'rgba(40,26,14,0.45)' : 'rgba(150,112,70,0.4)';
      ctx.fillRect(x, y, g.U * (8 + rand() * 30), Math.max(1, g.U * 0.25));
    }
    ctx.fillStyle = 'rgba(30,20,12,0.5)';
    for (let x = g.W * 0.19; x < g.W; x += g.W * 0.31) ctx.fillRect(x, g.ty, Math.max(1, g.U * 0.3), h);
  }

  // ---- tray, pot, cups -----------------------------------------------------

  function paintTray(ctx, g) {
    const u = g.u;
    const cx = g.cx;
    const y = g.base - u * 1;
    ctx.fillStyle = 'rgba(20,12,6,0.45)';
    blob(ctx, cx + u * 3, y + u * 2.4, u * 54, u * 4.4);
    ctx.fillStyle = '#6e5a2c';
    ctx.fillRect(cx - u * 50, y, u * 100, u * 3.6);
    ctx.fillStyle = '#a68a48';
    ctx.fillRect(cx - u * 50, y, u * 100, u * 1.3);
    ctx.fillStyle = '#4e3e1e';
    for (let i = 1; i < 10; i++) ctx.fillRect(cx - u * 50 + i * u * 10, y + u * 1.3, Math.max(1, u * 0.35), u * 2.3);
  }

  function paintPot(ctx, g) {
    const u = g.u;
    const cx = g.cx - u * 8;
    const by = g.base - u * 1;
    const r = u * 22;
    const cy = by - r * 0.82;
    // handle on the left
    ctx.strokeStyle = '#4d2f3c';
    ctx.lineWidth = u * 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.86, cy - r * 0.42);
    ctx.bezierCurveTo(cx - r * 1.75, cy - r * 0.9, cx - r * 1.85, cy + r * 0.55, cx - r * 0.9, cy + r * 0.45);
    ctx.stroke();
    ctx.strokeStyle = '#7a5266';
    ctx.lineWidth = u * 1;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.95, cy - r * 0.5);
    ctx.bezierCurveTo(cx - r * 1.66, cy - r * 0.92, cx - r * 1.72, cy + r * 0.45, cx - r * 0.95, cy + r * 0.38);
    ctx.stroke();
    // spout on the right, curving up
    const sx = cx + r * 0.8;
    const sy = cy + r * 0.3;
    ctx.strokeStyle = '#4d2f3c';
    ctx.lineWidth = u * 3.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy + u * 0.5);
    ctx.bezierCurveTo(cx + r * 1.4, cy + r * 0.2, cx + r * 1.5, cy - r * 0.3, cx + r * 1.78, cy - r * 0.78);
    ctx.stroke();
    ctx.strokeStyle = '#6a4458';
    ctx.lineWidth = u * 2.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(cx + r * 1.4, cy + r * 0.15, cx + r * 1.5, cy - r * 0.32, cx + r * 1.78, cy - r * 0.8);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // foot ring and body
    ctx.fillStyle = '#3c2430';
    blob(ctx, cx, by - u * 0.4, r * 0.55, u * 1.6);
    const body = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.1, cx, cy, r * 1.1);
    body.addColorStop(0, '#9a6b80');
    body.addColorStop(0.45, '#6e4558');
    body.addColorStop(1, '#3a2230');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, TAU);
    ctx.fill();
    // shoulder band and mouth
    ctx.strokeStyle = '#4a2c3a';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.46, r * 0.72, r * 0.16, 0, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.38, r * 0.7, r * 0.15, 0, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
    // lid
    ctx.fillStyle = '#5b3748';
    blob(ctx, cx, cy - r * 0.76, r * 0.56, r * 0.12);
    const lid = ctx.createRadialGradient(cx - r * 0.15, cy - r * 1.0, r * 0.05, cx, cy - r * 0.8, r * 0.6);
    lid.addColorStop(0, '#a47488');
    lid.addColorStop(1, '#5a3547');
    ctx.fillStyle = lid;
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.76, r * 0.5, r * 0.3, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#6a4458';
    blob(ctx, cx, cy - r * 1.07, r * 0.13, r * 0.1);
    ctx.fillStyle = '#b48a9a';
    blob(ctx, cx - r * 0.04, cy - r * 1.1, r * 0.05, r * 0.04);
    // soft shine
    ctx.fillStyle = 'rgba(214,170,186,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.45, cy - r * 0.2, r * 0.1, r * 0.34, 0.45, 0, TAU);
    ctx.fill();
    // gold inlay band, a plain line only
    ctx.strokeStyle = '#b89a52';
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.05, r * 0.98, r * 0.22, 0, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
    return { sx: cx + r * 1.78, sy: cy - r * 0.8 };
  }

  function cup(ctx, g, x, y, r) {
    ctx.fillStyle = 'rgba(20,12,6,0.5)';
    blob(ctx, x + r * 0.3, y + r * 0.1, r * 1.1, r * 0.25);
    ctx.fillStyle = '#3a2230';
    blob(ctx, x, y - r * 0.05, r * 0.45, r * 0.14);
    const body = ctx.createLinearGradient(x - r, 0, x + r, 0);
    body.addColorStop(0, '#9a6b80');
    body.addColorStop(0.5, '#6a4458');
    body.addColorStop(1, '#3a2230');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 1.1);
    ctx.quadraticCurveTo(x - r * 0.95, y - r * 0.1, x - r * 0.4, y - r * 0.05);
    ctx.lineTo(x + r * 0.4, y - r * 0.05);
    ctx.quadraticCurveTo(x + r * 0.95, y - r * 0.1, x + r, y - r * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8b894';
    blob(ctx, x, y - r * 1.1, r, r * 0.22);
    ctx.fillStyle = '#7c5a2a';
    blob(ctx, x, y - r * 1.06, r * 0.82, r * 0.16);
  }

  function paintCups(ctx, g) {
    const u = g.u;
    cup(ctx, g, g.cx + u * 40, g.base + u * 0.2, u * 6);
    cup(ctx, g, g.cx + u * 30, g.base + u * 4, u * 6);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    paintWindow(ctx, g);
    paintTable(ctx, g, rand);
    paintTray(ctx, g);
    const tip = paintPot(ctx, g);
    paintCups(ctx, g);
    state.tip = tip;
    return c;
  }

  // ---- window light --------------------------------------------------------

  // One lattice-shaped patch, slanted; drawn twice at different spots (wall and table).
  function paintLight(g) {
    const w = Math.ceil(g.W * 0.9);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const b = windowBox(g);
    const skew = g.H * 0.6;
    ctx.save();
    ctx.transform(1, 0, -0.55, 1, 0, 0);
    ctx.translate(skew * 0.55 + g.u * 6, 0);
    ctx.fillStyle = 'rgba(240,218,150,0.2)';
    const px = g.W * 0.32;
    const pw = b.w * 0.6;
    ctx.fillRect(px, g.H * 0.02, pw, g.H * 0.96);
    ctx.strokeStyle = 'rgba(40,26,14,0.3)';
    ctx.lineWidth = Math.max(1, g.u * 0.7);
    latticePath(ctx, g, px, g.H * 0.04, pw, g.H * 0.9);
    ctx.stroke();
    ctx.restore();
    return c;
  }

  // ---- steam ---------------------------------------------------------------

  function makePuffs(g, rand) {
    const f = () => new Float32Array(PUFFS);
    const P = { age: f(), life: f(), sway: f(), size: f(), drift: f() };
    for (let i = 0; i < PUFFS; i++) {
      P.life[i] = 5 + rand() * 3;
      P.age[i] = rand() * P.life[i];
      P.sway[i] = rand() * TAU;
      P.size[i] = 0.8 + rand() * 0.8;
      P.drift[i] = (rand() - 0.5) * 2;
    }
    return P;
  }

  function drawSteam(ctx, g, t, dt, amount) {
    if (amount <= 0) return;
    const P = state.puffs;
    const tip = state.tip;
    ctx.fillStyle = '#ece4d0';
    for (let i = 0; i < PUFFS; i++) {
      P.age[i] += dt;
      if (P.age[i] > P.life[i]) P.age[i] -= P.life[i];
      const k = P.age[i] / P.life[i];
      const rise = k * g.H * 0.42;
      const x = tip.sx + Math.sin(t * 0.9 + P.sway[i] + k * 5) * g.u * (1 + k * 4) * 1.2 + P.drift[i] * k * g.u * 5;
      const y = tip.sy - rise;
      const r = g.u * (1.6 + k * 5) * P.size[i];
      ctx.globalAlpha = Math.min(1, amount * 0.5) * Math.sin(Math.PI * k) * 0.6;
      blob(ctx, x, y, r, r * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.light = paintLight(g);
    state.puffs = makePuffs(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { steam, light } = api.props;
    ctx.drawImage(state.back, 0, 0);
    if (light > 0) {
      const sweep = Math.sin(t * 0.05) * g.W * 0.12;
      ctx.globalAlpha = Math.min(1, light * (0.8 + 0.2 * Math.sin(t * 0.13)));
      ctx.drawImage(state.light, sweep - g.W * 0.17, 0);
      ctx.globalAlpha = 1;
    }
    drawSteam(ctx, g, t, Math.min(dt, 0.1), steam);
  }

  Kasuri.run({
    defaults: { steam: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
