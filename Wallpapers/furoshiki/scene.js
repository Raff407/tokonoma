/*
 * 風呂敷 Furoshiki — an indigo wrapping cloth knotted around a gift on a wooden floor.
 *
 * Floor, box top, folds and knot are baked once. The skirt of the cloth is a wavy
 * outline redrawn each frame over a baked hemp-leaf pattern, with soft fold lines that
 * sway in the breeze. A lattice of window light is baked and drifts slowly across.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SKIRT_POINTS = 72;
  const FOLDS = 14;
  const INDIGO = ['#1b2650', '#233260', '#2d3f72', '#37497e'];
  const FLOOR = ['#7a5a3c', '#6e5036', '#836242', '#755639'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const b = Math.min(H * 0.17, W * 0.15);
    return { W, H, U, b, cx: W * 0.5, cy: H * 0.5, D: b * 2.7 };
  }

  // ---- floor ---------------------------------------------------------------

  function paintFloor(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ph = g.U * 8;
    let row = 0;
    for (let y = 0; y < g.H + ph; y += ph, row++) {
      ctx.fillStyle = FLOOR[row % FLOOR.length];
      ctx.fillRect(0, y, g.W, ph);
      let x = -rand() * g.U * 30;
      while (x < g.W) {
        const len = g.U * (24 + rand() * 30);
        ctx.fillStyle = FLOOR[(row + Math.floor(rand() * 3)) % FLOOR.length];
        ctx.fillRect(x, y, len, ph);
        ctx.fillStyle = '#3f2c1c';
        ctx.fillRect(x + len - 1, y, 1, ph);
        x += len;
      }
      ctx.fillStyle = '#3f2c1c';
      ctx.fillRect(0, y, g.W, 1);
      ctx.fillStyle = 'rgba(40,26,14,0.35)';
      for (let i = 0; i < 5; i++) {
        const gy = y + g.U * (1 + rand() * 6);
        const gx = rand() * g.W;
        ctx.fillRect(gx, gy, g.U * (8 + rand() * 18), 1);
      }
      ctx.fillStyle = 'rgba(214,176,120,0.18)';
      ctx.fillRect(0, y + 1, g.W, 1);
    }
    return c;
  }

  // ---- hemp-leaf pattern ---------------------------------------------------

  // Triangular lattice with a three-spoke star in each triangle: asanoha.
  function paintPattern(g, size) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const s = g.U * 9;
    const hgt = s * 0.866;
    ctx.fillStyle = INDIGO[1];
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(226,219,196,0.85)';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.lineCap = 'butt';
    const rows = Math.ceil(size / hgt) + 1;
    const cols = Math.ceil(size / s) + 2;
    ctx.beginPath();
    for (let j = -1; j < rows; j++) {
      for (let i = -1; i < cols; i++) {
        const ox = i * s + (j & 1 ? s / 2 : 0);
        const oy = j * hgt;
        const up = [[ox, oy], [ox + s, oy], [ox + s / 2, oy + hgt]];
        const dn = [[ox + s / 2, oy + hgt], [ox + s * 1.5, oy + hgt], [ox + s, oy]];
        for (const t of [up, dn]) {
          const mx = (t[0][0] + t[1][0] + t[2][0]) / 3;
          const my = (t[0][1] + t[1][1] + t[2][1]) / 3;
          for (let k = 0; k < 3; k++) {
            ctx.moveTo(t[k][0], t[k][1]);
            ctx.lineTo(t[(k + 1) % 3][0], t[(k + 1) % 3][1]);
            ctx.moveTo(mx, my);
            ctx.lineTo(t[k][0], t[k][1]);
          }
        }
      }
    }
    ctx.stroke();
    return c;
  }

  // ---- baked box top, folds and knot --------------------------------------

  function flap(ctx, g, pattern, a, shade, off) {
    const { cx, cy, b } = g;
    const p = [[-b, -b], [b, -b], [b, b], [-b, b]];
    const p0 = p[a];
    const p1 = p[(a + 1) % 4];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + p0[0], cy + p0[1]);
    ctx.lineTo(cx + p1[0], cy + p1[1]);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(pattern, cx - b + off, cy - b + off * 0.6);
    ctx.fillStyle = shade;
    ctx.fillRect(cx - b, cy - b, b * 2, b * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(14,20,40,0.7)';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    ctx.moveTo(cx + p0[0], cy + p0[1]);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }

  function paintBox(g, pattern) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { cx, cy, b, U } = g;
    const shades = ['rgba(10,14,34,0.05)', 'rgba(10,14,34,0.26)', 'rgba(10,14,34,0.14)', 'rgba(230,220,190,0.08)'];
    for (let a = 0; a < 4; a++) flap(ctx, g, pattern, a, shades[a], a * g.U * 3.1);
    ctx.strokeStyle = '#141b36';
    ctx.lineWidth = Math.max(1, U * 0.6);
    ctx.strokeRect(cx - b, cy - b, b * 2, b * 2);
    ctx.strokeStyle = 'rgba(200,196,170,0.35)';
    ctx.lineWidth = Math.max(1, U * 0.3);
    ctx.strokeRect(cx - b + U * 0.6, cy - b + U * 0.6, b * 2 - U * 1.2, b * 2 - U * 1.2);
    knot(ctx, g);
    return c;
  }

  function knot(ctx, g) {
    const { cx, cy, b, U } = g;
    const r = b * 0.3;
    ctx.fillStyle = 'rgba(8,10,24,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx + U * 0.8, cy + U * 1.1, r * 1.1, r * 0.95, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INDIGO[0];
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.88, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INDIGO[2];
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.2, cy - r * 0.22, r * 0.62, r * 0.46, -0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#d9d2bc';
    ctx.lineWidth = Math.max(1, U * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.1);
    ctx.quadraticCurveTo(cx, cy - r * 0.6, cx + r * 0.7, cy + r * 0.1);
    ctx.moveTo(cx - r * 0.6, cy + r * 0.3);
    ctx.quadraticCurveTo(cx, cy, cx + r * 0.5, cy + r * 0.5);
    ctx.stroke();
    ctx.strokeStyle = '#b8432b';
    ctx.lineWidth = Math.max(1, U * 0.7);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.06, r * 0.94, -0.5, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.9, cy + r * 0.5);
    ctx.quadraticCurveTo(cx + r * 1.5, cy + r * 1.1, cx + r * 1.3, cy + r * 1.7);
    ctx.moveTo(cx + r * 0.7, cy + r * 0.8);
    ctx.quadraticCurveTo(cx + r * 0.9, cy + r * 1.5, cx + r * 0.4, cy + r * 1.9);
    ctx.stroke();
  }

  // ---- window light --------------------------------------------------------

  function paintLight(g) {
    const w = g.W * 0.55;
    const h = g.H * 1.1;
    const c = layer(w + h * 0.3, h);
    const ctx = c.getContext('2d');
    const skew = h * 0.3;
    ctx.fillStyle = '#ecd596';
    ctx.beginPath();
    ctx.moveTo(skew, 0);
    ctx.lineTo(skew + w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    const bar = Math.max(1, g.U * 0.9);
    const cols = 3;
    const rows = 4;
    for (let i = 0; i <= cols; i++) {
      const x = (w / cols) * i;
      ctx.beginPath();
      ctx.moveTo(skew + x - bar / 2, 0);
      ctx.lineTo(skew + x + bar / 2, 0);
      ctx.lineTo(x + bar / 2, h);
      ctx.lineTo(x - bar / 2, h);
      ctx.closePath();
      ctx.fill();
    }
    for (let j = 0; j <= rows; j++) {
      const y = (h / rows) * j;
      const sx = skew * (1 - j / rows);
      ctx.fillRect(sx, y - bar / 2, w, bar);
    }
    return c;
  }

  // ---- the cloth skirt -----------------------------------------------------

  function skirtRadius(g, th, t, breeze) {
    const D = g.D;
    const base = D / (Math.abs(Math.cos(th)) + Math.abs(Math.sin(th)));
    const pinch = Math.pow(0.5 + 0.5 * Math.cos(4 * th), 3);
    const wave =
      Math.sin(th * 6 + t * 1.3) * 0.035 +
      Math.sin(th * 11 - t * 1.9) * 0.02 +
      Math.sin(th * 3 + t * 0.7) * 0.03;
    const gust = 0.5 + 0.5 * Math.sin(th * 2 - t * 0.9);
    return base * (1 - 0.34 * pinch) * (1 + wave * breeze * (0.5 + gust));
  }

  function skirtPath(ctx, g, t, breeze, dx, dy) {
    ctx.beginPath();
    for (let i = 0; i < SKIRT_POINTS; i++) {
      const th = (i / SKIRT_POINTS) * TAU + Math.PI / 4;
      const r = skirtRadius(g, th, t, breeze);
      const x = g.cx + Math.cos(th) * r + dx;
      const y = g.cy + Math.sin(th) * r * 0.92 + dy;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function drawSkirt(ctx, g, t, breeze) {
    const { cx, cy, b, U } = g;
    ctx.fillStyle = 'rgba(22,14,8,0.4)';
    skirtPath(ctx, g, t, breeze, U * 1.6, U * 2.1);
    ctx.fill();
    ctx.save();
    skirtPath(ctx, g, t, breeze, 0, 0);
    ctx.clip();
    ctx.drawImage(state.skirt, cx - state.skirt.width / 2, cy - state.skirt.height / 2);
    ctx.fillStyle = 'rgba(12,16,40,0.2)';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.lineWidth = Math.max(1, U * 1.1);
    for (let i = 0; i < FOLDS; i++) {
      const th = (i / FOLDS) * TAU + Math.PI / 4 + Math.sin(t * 0.6 + i) * 0.03 * breeze;
      const r = skirtRadius(g, th, t, breeze);
      ctx.strokeStyle = i % 2 ? 'rgba(10,14,34,0.4)' : 'rgba(225,218,190,0.16)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th) * b * 1.3, cy + Math.sin(th) * b * 1.2);
      ctx.lineTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.92);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#141b36';
    ctx.lineWidth = Math.max(1, U * 0.5);
    skirtPath(ctx, g, t, breeze, 0, 0);
    ctx.stroke();
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.floor = paintFloor(g, rand);
    state.skirt = paintPattern(g, Math.ceil(g.D * 2.6));
    state.box = paintBox(g, paintPattern(g, Math.ceil(g.b * 2 + g.U * 12)));
    state.light = paintLight(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { breeze, sun } = api.props;
    ctx.drawImage(state.floor, 0, 0);
    drawSkirt(ctx, g, t, breeze);
    ctx.drawImage(state.box, 0, 0);
    if (sun > 0) {
      const lx = g.W * 0.12 + Math.sin(t * 0.1) * g.W * 0.22;
      const ly = -g.H * 0.05 + Math.sin(t * 0.07 + 1) * g.H * 0.04;
      ctx.globalAlpha = 0.26 * Math.min(1, sun);
      ctx.drawImage(state.light, lx, ly);
      ctx.globalAlpha = 1;
    }
  }

  Kasuri.run({
    defaults: { breeze: 1, sun: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
