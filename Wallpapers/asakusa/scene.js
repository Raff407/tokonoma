/*
 * 浅草 Asakusa — a great red lantern in a temple gate, rain at dusk.
 *
 * Sky, pagoda, pines, gate and wet stone are baked once into one layer. The lantern
 * is its own sprite that sways a little. Rain is a short pool of streaks, ripples are
 * a small reused ring pool, and the lantern's light slides in thin rows on the stone.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;
  const TAU = Math.PI * 2;

  const HORIZON = 0.63;
  const PLINTH = 0.82;
  const MAX_RAIN = 170;
  const RINGS = 14;
  const SKY = ['#1f2748', '#3b3d68', '#7a5a78', '#c8836a', '#e0a672'];
  const VERMILION = '#b8412c';
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
    const u = U * Math.min(1, W / (U * 120));
    return { W, H, U, u, hy: H * HORIZON, pb: H * PLINTH, cx: W * 0.5 };
  }

  // ---- far world ------------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.hy);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.hy + 1);
    ctx.fillStyle = '#4a4a74';
    for (let i = 0; i < 5; i++) {
      const y = g.H * (0.1 + i * 0.07);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(g.W * ((i * 0.37) % 0.6), y, g.W * (0.3 + 0.05 * i), Math.max(1, g.U * 1.1));
    }
    ctx.globalAlpha = 1;
  }

  function paintHills(ctx, g) {
    ctx.fillStyle = '#4b4f78';
    ctx.beginPath();
    ctx.moveTo(0, g.hy);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, g.hy - g.U * (6 + fbm(x / (g.U * 30), 2.1, 3, 7) * 16));
    ctx.lineTo(g.W, g.hy);
    ctx.fill();
    ctx.fillStyle = '#383c62';
    ctx.beginPath();
    ctx.moveTo(0, g.hy);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, g.hy - g.U * (1 + fbm(x / (g.U * 18), 5.3, 3, 13) * 8));
    ctx.lineTo(g.W, g.hy);
    ctx.fill();
  }

  // Five tiers, each a body, an upturned eave and a ridge, with the spire on top.
  function paintPagoda(ctx, g, cx, base, s) {
    const ink = '#2c3052';
    const eave = '#23263f';
    ctx.fillStyle = ink;
    let y = base;
    const tiers = 5;
    const th = s * 0.17;
    for (let i = 0; i < tiers; i++) {
      const k = 1 - i * 0.14;
      const bw = s * 0.32 * k;
      const ew = s * 0.6 * k;
      ctx.fillStyle = ink;
      ctx.fillRect(cx - bw / 2, y - th * 0.62, bw, th * 0.62);
      ctx.fillStyle = eave;
      poly(ctx, [cx - ew / 2 - s * 0.03, y - th * 0.7, cx - bw / 2, y - th * 0.95, cx + bw / 2, y - th * 0.95, cx + ew / 2 + s * 0.03, y - th * 0.7, cx + ew / 2, y - th * 0.6, cx - ew / 2, y - th * 0.6]);
      ctx.fillStyle = '#d8a45a';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(cx - Math.max(0.6, s * 0.012), y - th * 0.45, Math.max(1, s * 0.024), Math.max(1, th * 0.2));
      ctx.globalAlpha = 1;
      y -= th * 0.85;
    }
    ctx.fillStyle = eave;
    ctx.fillRect(cx - Math.max(0.5, s * 0.008), y - s * 0.22, Math.max(1, s * 0.016), s * 0.23);
    for (let i = 0; i < 5; i++) ctx.fillRect(cx - s * 0.03 * (1 - i * 0.15), y - s * (0.07 + i * 0.03), s * 0.06 * (1 - i * 0.15), Math.max(1, s * 0.012));
  }

  function pine(ctx, x, base, h, ink) {
    ctx.fillStyle = ink;
    ctx.fillRect(x - h * 0.02, base - h * 0.5, h * 0.04, h * 0.5);
    for (let i = 0; i < 4; i++) {
      const y = base - h * (0.38 + i * 0.17);
      const w = h * (0.34 - i * 0.06);
      ctx.beginPath();
      ctx.ellipse(x + (i % 2 ? w * 0.2 : -w * 0.2), y, w, h * 0.065, 0, 0, TAU);
      ctx.fill();
    }
  }

  function paintTrees(ctx, g) {
    ctx.fillStyle = '#2f3a4e';
    ctx.fillRect(0, g.hy - g.U * 1.5, g.W, g.U * 2);
    pine(ctx, g.W * 0.27, g.hy + g.U, g.U * 30, '#2c3a4a');
    pine(ctx, g.W * 0.33, g.hy + g.U, g.U * 21, '#2a3648');
    pine(ctx, g.W * 0.8, g.hy + g.U, g.U * 24, '#2c3a4a');
    // Low temple roof line far left of the pagoda.
    ctx.fillStyle = '#262a44';
    const rx = g.W * 0.56;
    poly(ctx, [rx, g.hy, rx + g.U * 2, g.hy - g.U * 6, rx + g.U * 22, g.hy - g.U * 6, rx + g.U * 24, g.hy]);
    ctx.fillRect(rx + g.U * 3, g.hy - g.U * 3, g.U * 18, g.U * 3);
  }

  // ---- gate -----------------------------------------------------------------

  function pillar(ctx, g, x0, w) {
    const grad = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    grad.addColorStop(0, '#d0553a');
    grad.addColorStop(0.35, VERMILION);
    grad.addColorStop(1, '#7c2a22');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, g.H * 0.17, w, g.pb - g.H * 0.17);
    ctx.fillStyle = '#2a2824';
    ctx.fillRect(x0 - g.u * 1.2, g.pb - g.U * 1.5, w + g.u * 2.4, g.U * 2.6);
    ctx.fillStyle = '#4b5844';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x0 - g.u * 1.2, g.pb - g.U * 1.5, w + g.u * 2.4, g.U * 0.6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1e1c1c';
    ctx.fillRect(x0, g.pb - g.U * 8, w, g.U * 0.9);
  }

  function paintGate(ctx, g) {
    const pw = Math.max(g.u * 12, g.W * 0.07);
    pillar(ctx, g, g.W * 0.06, pw);
    pillar(ctx, g, g.W * 0.94 - pw, pw);
    // Roof: dark tile, wide eaves lifting at the ends, white ridge line below.
    ctx.fillStyle = '#1d2030';
    poly(ctx, [-2, 0, g.W + 2, 0, g.W + 2, g.H * 0.08, g.W * 0.985, g.H * 0.115, g.W * 0.9, g.H * 0.098, g.W * 0.5, g.H * 0.088, g.W * 0.1, g.H * 0.098, g.W * 0.015, g.H * 0.115, -2, g.H * 0.08]);
    ctx.fillStyle = '#3a3e56';
    for (let x = 0; x < g.W; x += g.u * 3) ctx.fillRect(x, g.H * 0.012, Math.max(1, g.u * 0.4), g.H * 0.08);
    ctx.fillStyle = '#e4dcc6';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(0, g.H * 0.088, g.W, Math.max(1, g.U * 0.6));
    ctx.globalAlpha = 1;
    // Bracket row and the red lintel.
    ctx.fillStyle = '#8a2e24';
    ctx.fillRect(0, g.H * 0.098, g.W, g.H * 0.04);
    ctx.fillStyle = '#1e1c1c';
    for (let x = g.W * 0.03; x < g.W; x += g.u * 5) ctx.fillRect(x, g.H * 0.104, g.u * 2.2, g.H * 0.028);
    ctx.fillStyle = VERMILION;
    ctx.fillRect(0, g.H * 0.14, g.W, g.H * 0.06);
    ctx.fillStyle = '#d4a24a';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, g.H * 0.14, g.W, Math.max(1, g.U * 0.5));
    ctx.fillRect(0, g.H * 0.195, g.W, Math.max(1, g.U * 0.5));
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d4a24a';
    for (const f of [0.06, 0.94]) ctx.fillRect(g.W * f - g.u * 1.4, g.H * 0.15, g.u * 2.8, g.H * 0.04);
    ctx.fillStyle = '#1e1c1c';
    ctx.fillRect(g.cx - g.u * 8, g.H * 0.2, g.u * 16, g.H * 0.012);
  }

  // ---- wet stone ------------------------------------------------------------

  function paintGround(ctx, g, scene, rand) {
    const top = g.hy;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#5a5878');
    grad.addColorStop(0.4, '#34364c');
    grad.addColorStop(1, '#1c1d2c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Mirror of the world above the plinth line.
    const refl = g.H - g.pb;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.rect(0, g.pb, g.W, refl);
    ctx.clip();
    ctx.translate(0, g.pb * 2);
    ctx.scale(1, -1);
    ctx.drawImage(scene, 0, 0);
    ctx.restore();
    // Slab joints, rows widening toward the viewer.
    ctx.strokeStyle = '#14151f';
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    let y = top;
    let step = g.U * 1.6;
    let row = 0;
    while (y < g.H) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(g.W, Math.round(y) + 0.5);
      ctx.stroke();
      const sw = g.u * 4 * (step / (g.U * 1.6)) * 1.4;
      ctx.beginPath();
      for (let x = (row % 2) * sw * 0.5 - sw; x < g.W; x += sw) {
        const vx = g.cx + (x - g.cx) * (1 + (y - top) / (g.H - top) * 0.6);
        ctx.moveTo(vx, y);
        ctx.lineTo(vx, y + step);
      }
      ctx.stroke();
      y += step;
      step *= 1.22;
      row++;
    }
    ctx.globalAlpha = 1;
    // Warm pool of light under the lantern.
    const pool = ctx.createRadialGradient(g.cx, g.H * 0.86, 0, g.cx, g.H * 0.86, g.W * 0.36);
    pool.addColorStop(0, 'rgba(232,160,84,0.5)');
    pool.addColorStop(1, 'rgba(232,160,84,0)');
    ctx.save();
    ctx.translate(0, g.H * 0.86);
    ctx.scale(1, 0.32);
    ctx.translate(0, -g.H * 0.86);
    ctx.fillStyle = pool;
    ctx.fillRect(0, g.H * 0.86 - g.W, g.W, g.W * 2);
    ctx.restore();
    // Moss in the joints near the pillars.
    ctx.fillStyle = '#5c6a44';
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < g.W * 0.4; i++) {
      const side = rand() < 0.5 ? 0.12 : 0.88;
      ctx.fillRect(g.W * side + (rand() - 0.5) * g.W * 0.2, g.pb + rand() * (g.H - g.pb), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintScene(g) {
    const rand = K.rng(17);
    const world = layer(g.W, g.H);
    const wc = world.getContext('2d');
    paintSky(wc, g);
    paintHills(wc, g);
    paintPagoda(wc, g, g.W * 0.7, g.hy + g.U * 0.5, g.U * 52);
    paintTrees(wc, g);
    paintGate(wc, g);
    const out = layer(g.W, g.H);
    const ctx = out.getContext('2d');
    ctx.drawImage(world, 0, 0);
    paintGround(ctx, g, world, rand);
    // Gate on top so pillars stand on the stone.
    const gate = layer(g.W, g.H);
    paintGate(gate.getContext('2d'), g);
    ctx.drawImage(gate, 0, 0);
    return out;
  }

  // ---- lantern --------------------------------------------------------------

  function paintLantern(g) {
    const w = Math.min(g.U * 24, g.W * 0.17);
    const h = w * 1.5;
    const pad = Math.ceil(w * 0.2);
    const c = layer(w + pad * 2, h + pad);
    const ctx = c.getContext('2d');
    const x0 = pad;
    ctx.fillStyle = '#201a18';
    ctx.fillRect(x0 + w * 0.2, 0, w * 0.6, h * 0.1);
    const grad = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    grad.addColorStop(0, '#a63a2a');
    grad.addColorStop(0.45, '#e8714a');
    grad.addColorStop(0.6, '#f0925a');
    grad.addColorStop(1, '#9a3426');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.2, h * 0.09);
    ctx.bezierCurveTo(x0 - w * 0.08, h * 0.25, x0 - w * 0.08, h * 0.78, x0 + w * 0.2, h * 0.92);
    ctx.lineTo(x0 + w * 0.8, h * 0.92);
    ctx.bezierCurveTo(x0 + w * 1.08, h * 0.78, x0 + w * 1.08, h * 0.25, x0 + w * 0.8, h * 0.09);
    ctx.closePath();
    ctx.fill();
    // Bamboo ribs.
    ctx.fillStyle = '#5a1e18';
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 14; i++) {
      const y = h * (0.12 + i * 0.058);
      const bulge = Math.sin(((y / h - 0.09) / 0.83) * Math.PI) * w * 0.08;
      ctx.fillRect(x0 + w * 0.2 - bulge, y, w * 0.6 + bulge * 2, Math.max(1, g.U * 0.25));
    }
    ctx.globalAlpha = 1;
    // Black bands top and bottom, gold ring, and the tassel.
    ctx.fillStyle = '#201a18';
    ctx.fillRect(x0 + w * 0.17, h * 0.07, w * 0.66, h * 0.045);
    ctx.fillRect(x0 + w * 0.17, h * 0.89, w * 0.66, h * 0.045);
    ctx.fillStyle = '#d4a24a';
    ctx.fillRect(x0 + w * 0.17, h * 0.115, w * 0.66, Math.max(1, g.U * 0.3));
    for (let i = 0; i < 9; i++) ctx.fillRect(x0 + w * (0.3 + i * 0.05), h * 0.935, Math.max(1, g.U * 0.3), pad * 0.9);
    // Warm band of light across the middle where the paper is thin.
    const lit = ctx.createRadialGradient(x0 + w / 2, h * 0.5, 0, x0 + w / 2, h * 0.5, w * 0.55);
    lit.addColorStop(0, 'rgba(255,214,140,0.65)');
    lit.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = lit;
    ctx.fillRect(x0, h * 0.1, w, h * 0.8);
    return { canvas: c, w, h, pad };
  }

  function paintHalo(g) {
    const r = Math.ceil(g.U * 34);
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(240,170,96,0.55)');
    grad.addColorStop(0.5, 'rgba(220,130,80,0.18)');
    grad.addColorStop(1, 'rgba(220,130,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  function paintStreak(g, lantern) {
    const w = Math.ceil(lantern.w * 0.9);
    const h = Math.ceil(g.H - g.pb);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(236,140,80,0.55)');
    grad.addColorStop(1, 'rgba(236,140,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(w * 0.1, 0, w * 0.8, h);
    ctx.fillStyle = 'rgba(255,214,140,0.5)';
    ctx.fillRect(w * 0.35, 0, w * 0.3, h * 0.6);
    return c;
  }

  // ---- motion ---------------------------------------------------------------

  function makeRain(g, rand) {
    const n = Math.min(MAX_RAIN, Math.max(30, Math.round((g.W * g.H) / 520)));
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = rand() * (g.W + g.H * 0.3);
      y[i] = rand() * g.H;
      v[i] = 0.8 + rand() * 0.5;
    }
    return { n, x, y, v };
  }

  function drawRain(ctx, g, dt, amount) {
    const r = state.rain;
    const count = Math.round(r.n * Math.min(1, amount));
    if (count <= 0) return;
    const len = g.U * 3.2;
    const slant = 0.18;
    const fall = g.H * 0.9;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(226,222,208,0.34)' : 'rgba(200,204,220,0.2)';
      ctx.beginPath();
      for (let i = pass; i < count; i += 2) {
        r.y[i] += fall * r.v[i] * dt;
        r.x[i] -= fall * r.v[i] * dt * slant;
        if (r.y[i] > g.H) {
          r.y[i] -= g.H + len;
          r.x[i] = ((r.x[i] * 7.31 + 13) % (g.W + g.H * 0.3));
        }
        if (r.x[i] < 0) r.x[i] += g.W + g.H * 0.3;
        const px = r.x[i];
        ctx.moveTo(px, r.y[i]);
        ctx.lineTo(px + len * slant, r.y[i] - len);
      }
      ctx.stroke();
    }
  }

  function drawRings(ctx, g, t, amount) {
    if (amount <= 0) return;
    const count = Math.round(RINGS * Math.min(1, amount));
    ctx.strokeStyle = '#d8d4c4';
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const life = t * 0.7 + i / RINGS;
      const cyc = Math.floor(life);
      const a = life - cyc;
      const hx = K.hash2(i, cyc, 3);
      const hy = K.hash2(i, cyc, 9);
      const x = g.W * 0.08 + hx * g.W * 0.84;
      const y = g.pb - g.U * 8 + hy * (g.H - g.pb + g.U * 8) * 0.95;
      const r = g.U * (0.5 + a * 3.2) * (0.6 + (y - g.hy) / g.H);
      ctx.globalAlpha = (1 - a) * 0.35;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawStreak(ctx, g, t, glow) {
    const s = state.streak;
    const rows = Math.floor(s.height / 2);
    ctx.globalAlpha = Math.min(1, 0.55 * glow);
    for (let r = 0; r < rows; r++) {
      const wob = Math.sin(t * 1.6 + r * 0.9) * g.U * (0.3 + r * 0.05);
      ctx.drawImage(s, 0, r * 2, s.width, 2, g.cx - s.width / 2 + wob, g.pb + r * 2, s.width * (1 + r * 0.05), 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawLantern(ctx, g, t, glow) {
    const l = state.lantern;
    const sway = Math.sin(t * 0.8) * 0.035 + Math.sin(t * 1.9 + 1) * 0.008;
    const flick = 0.9 + Math.sin(t * 3.1) * 0.05 + Math.sin(t * 7.3) * 0.03;
    const top = g.H * 0.212;
    const halo = state.halo;
    ctx.globalAlpha = Math.min(1, 0.85 * glow * flick);
    ctx.drawImage(halo, g.cx - halo.width / 2 + sway * g.H * 0.35, top + l.h * 0.5 - halo.height / 2);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(g.cx, top);
    ctx.rotate(sway);
    ctx.drawImage(l.canvas, -l.pad - l.w / 2, 0);
    ctx.restore();
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.scene = paintScene(g);
    state.lantern = paintLantern(g);
    state.halo = paintHalo(g);
    state.streak = paintStreak(g, state.lantern);
    state.rain = makeRain(g, K.rng(api.seed || 5));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, glow } = api.props;
    ctx.drawImage(state.scene, 0, 0);
    drawStreak(ctx, g, t, glow);
    drawRings(ctx, g, t, rain);
    drawLantern(ctx, g, t, glow);
    drawRain(ctx, g, Math.min(dt, 0.1), rain);
  }

  Kasuri.run({
    defaults: { rain: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
