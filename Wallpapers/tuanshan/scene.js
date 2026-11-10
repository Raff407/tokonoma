/*
 * 团扇 Tuanshan — a round silk fan painted with a plum branch, leaning on a window sill.
 *
 * Beyond the round moon window lie misty hills, a far pagoda and a drifting plum
 * branch. Wall, view, sill and fan are baked once. Per frame: the branch sways as one
 * sprite, a short pool of petals drifts, a mist strip slides, the fan rocks a hair
 * and its tassel swings.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;
  const TAU = Math.PI * 2;

  const WIN = { x: 0.64, y: 0.43, r: 0.335 };
  const FAN = { x: 0.27, y: 0.575, r: 0.185 };
  const SILL = [0.835, 0.865, 0.94];
  const MAX_PETALS = 36;
  const PETAL_TONES = ['#efe6d0', '#e8d9c4', '#e9c9bd'];
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
    return {
      W, H, U,
      wx: W * WIN.x, wy: H * WIN.y, wr: H * WIN.r,
      fx: W * FAN.x, fy: H * FAN.y, fr: H * FAN.r,
      sill: H * SILL[0],
    };
  }

  // ---- blossoms and branches ---------------------------------------------

  function blossom(ctx, x, y, s, petal, heart) {
    ctx.fillStyle = petal;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * s * 0.62, y + Math.sin(a) * s * 0.62, s * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = heart;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.3, 0, TAU);
    ctx.fill();
  }

  // Tapered stroke through points, thick to thin.
  function stroke(ctx, pts, w0, w1, color) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const k = i / (pts.length - 1);
      ctx.lineWidth = Math.max(0.8, lerp(w0, w1, k));
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
  }

  // Sample a smooth line through control points.
  function curve(c, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n * (c.length - 1);
      const j = Math.min(c.length - 2, Math.floor(t));
      const f = t - j;
      const p0 = c[Math.max(0, j - 1)];
      const p1 = c[j];
      const p2 = c[j + 1];
      const p3 = c[Math.min(c.length - 1, j + 2)];
      const q = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f);
      out.push([q(p0[0], p1[0], p2[0], p3[0]), q(p0[1], p1[1], p2[1], p3[1])]);
    }
    return out;
  }

  // A plum branch as relative control points in unit space, drawn at origin (ox, oy) with scale s.
  const BRANCH = [
    { c: [[0, 0], [-0.22, 0.06], [-0.46, 0.02], [-0.7, 0.12], [-0.98, 0.1]], w: 1, bl: [0.35, 0.58, 0.8, 1] },
    { c: [[-0.22, 0.06], [-0.3, -0.12], [-0.4, -0.2], [-0.5, -0.34]], w: 0.55, bl: [0.5, 1] },
    { c: [[-0.46, 0.02], [-0.5, 0.14], [-0.6, 0.26], [-0.64, 0.4]], w: 0.5, bl: [0.6, 1] },
    { c: [[-0.7, 0.12], [-0.78, -0.02], [-0.9, -0.08]], w: 0.4, bl: [1] },
  ];

  function drawBranch(ctx, ox, oy, s, thick, ink, petal, heart, bud, rand) {
    for (const b of BRANCH) {
      const pts = curve(b.c.map((p) => [ox + p[0] * s, oy + p[1] * s]), 16);
      stroke(ctx, pts, thick * b.w, thick * b.w * 0.35, ink);
      for (const f of b.bl) {
        const i = Math.min(pts.length - 1, Math.round(f * (pts.length - 1)));
        const x = pts[i][0];
        const y = pts[i][1];
        blossom(ctx, x + (rand() - 0.5) * s * 0.03, y - s * 0.03, s * 0.042, petal, heart);
        if (rand() < 0.8) blossom(ctx, x - s * 0.05, y + s * 0.045, s * 0.03, petal, heart);
        ctx.fillStyle = bud;
        ctx.beginPath();
        ctx.arc(x + s * 0.04, y - s * 0.07, s * 0.022, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---- window view ---------------------------------------------------------

  function paintView(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.wy - g.wr;
    const grad = ctx.createLinearGradient(0, top, 0, g.wy + g.wr);
    grad.addColorStop(0, '#1f2a4a');
    grad.addColorStop(0.55, '#46587c');
    grad.addColorStop(1, '#a9a99a');
    ctx.fillStyle = grad;
    ctx.fillRect(g.wx - g.wr, top, g.wr * 2, g.wr * 2);
    // moon with a soft halo
    const mx = g.wx - g.wr * 0.38;
    const my = g.wy - g.wr * 0.38;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.wr * 0.55);
    halo.addColorStop(0, 'rgba(238,230,208,0.55)');
    halo.addColorStop(1, 'rgba(238,230,208,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.wr, my - g.wr, g.wr * 2, g.wr * 2);
    ctx.fillStyle = '#eee6d0';
    ctx.beginPath();
    ctx.arc(mx, my, g.wr * 0.115, 0, TAU);
    ctx.fill();
    // far and near ridges
    const x0 = Math.floor(g.wx - g.wr);
    const x1 = Math.ceil(g.wx + g.wr);
    const ridges = [
      { base: 0.18, amp: 0.2, tone: '#93a0b4', seed: 3, freq: 0.012 },
      { base: 0.38, amp: 0.16, tone: '#6f819c', seed: 7, freq: 0.016 },
      { base: 0.6, amp: 0.1, tone: '#34425f', seed: 11, freq: 0.02 },
    ];
    let pagoda = null;
    for (const r of ridges) {
      ctx.fillStyle = r.tone;
      for (let x = x0; x < x1; x++) {
        const y = g.wy + g.wr * (r.base + (fbm(x * r.freq, 1, 3, r.seed) - 0.5) * r.amp * 2);
        ctx.fillRect(x, y, 1, g.wy + g.wr - y);
        if (r.seed === 7 && Math.abs(x - (g.wx + g.wr * 0.28)) < 1) pagoda = [x, y];
      }
      if (r.seed === 3) pagoda = pagoda;
      ctx.fillStyle = 'rgba(214,214,204,0.18)';
      ctx.fillRect(x0, g.wy + g.wr * (r.base + 0.02), x1 - x0, g.wr * 0.05);
    }
    if (pagoda) paintPagoda(ctx, g, pagoda[0], pagoda[1]);
    // tiled roof ridge in the foreground
    const ry = g.wy + g.wr * 0.78;
    ctx.fillStyle = '#232a3e';
    ctx.beginPath();
    ctx.moveTo(g.wx - g.wr * 1.05, g.wy + g.wr * 1.05);
    ctx.lineTo(g.wx - g.wr * 1.05, ry + g.wr * 0.1);
    ctx.quadraticCurveTo(g.wx - g.wr * 0.6, ry + g.wr * 0.06, g.wx - g.wr * 0.25, ry - g.wr * 0.02);
    ctx.quadraticCurveTo(g.wx + g.wr * 0.05, ry - g.wr * 0.1, g.wx + g.wr * 0.45, ry - g.wr * 0.02);
    ctx.quadraticCurveTo(g.wx + g.wr * 0.8, ry - g.wr * 0.04, g.wx + g.wr * 1.05, ry - g.wr * 0.16);
    ctx.lineTo(g.wx + g.wr * 1.05, g.wy + g.wr * 1.05);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,130,150,0.35)';
    ctx.lineWidth = 1;
    for (let x = x0; x < x1; x += Math.max(2, g.U * 0.9)) {
      ctx.beginPath();
      ctx.moveTo(x, ry + g.wr * 0.12);
      ctx.lineTo(x, g.wy + g.wr);
      ctx.stroke();
    }
    return c;
  }

  // Five-tier pagoda in silhouette with upturned eaves.
  function paintPagoda(ctx, g, px, py) {
    const u = g.wr * 0.045;
    ctx.fillStyle = '#2c3753';
    let y = py + u * 0.5;
    let w = u * 3.6;
    for (let i = 0; i < 5; i++) {
      const h = u * 1.5;
      ctx.fillRect(px - w * 0.3, y - h, w * 0.6, h);
      ctx.beginPath();
      ctx.moveTo(px - w * 0.7, y - h + u * 0.1);
      ctx.quadraticCurveTo(px - w * 0.2, y - h + u * 0.55, px, y - h - u * 0.55);
      ctx.quadraticCurveTo(px + w * 0.2, y - h + u * 0.55, px + w * 0.7, y - h + u * 0.1);
      ctx.lineTo(px + w * 0.5, y - h + u * 0.55);
      ctx.lineTo(px - w * 0.5, y - h + u * 0.55);
      ctx.fill();
      y -= h + u * 0.55;
      w *= 0.84;
    }
    ctx.fillRect(px - 0.6, y - u * 1.2, 1.2, u * 1.4);
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.2);
    const h = Math.ceil(g.wr * 0.45);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(41);
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + rand() * 6;
      const y = h * (0.35 + rand() * 0.3);
      for (const dx of [0, -w]) {
        const grad = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, g.wr * 0.4);
        grad.addColorStop(0, 'rgba(226,224,210,0.34)');
        grad.addColorStop(1, 'rgba(226,224,210,0)');
        ctx.save();
        ctx.translate(x + dx, y);
        ctx.scale(1, 0.28);
        ctx.translate(-(x + dx), -y);
        ctx.fillStyle = grad;
        ctx.fillRect(x + dx - g.wr * 0.5, y - g.wr * 0.5, g.wr, g.wr);
        ctx.restore();
      }
    }
    return c;
  }

  function paintOuterBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ox = g.wx + g.wr * 0.98;
    const oy = g.wy - g.wr * 0.52;
    drawBranch(ctx, ox, oy, g.wr * 1.45, g.U * 2.6, '#1b1c24', '#efe6d0', '#c8452c', '#d98a74', rand);
    return c;
  }

  // ---- wall, window frame, sill ---------------------------------------------

  function paintWall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#22262f');
    grad.addColorStop(1, '#2d3036');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // plaster mottling
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(180,176,160,0.05)' : 'rgba(10,12,20,0.1)';
      ctx.fillRect(rand() * g.W, rand() * g.H, 2 + rand() * g.U * 2, 1);
    }
    // eave: grey tiles and round end tiles
    const eave = g.H * 0.085;
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(0, 0, g.W, eave);
    ctx.fillStyle = '#1b1e27';
    const step = Math.max(3, g.U * 1.9);
    for (let x = 0; x < g.W; x += step) ctx.fillRect(x, 0, Math.max(1, step * 0.3), eave);
    ctx.fillStyle = '#14161d';
    ctx.fillRect(0, eave, g.W, Math.max(1, g.U * 0.6));
    for (let x = step / 2; x < g.W; x += step) {
      ctx.fillStyle = '#6a6b66';
      ctx.beginPath();
      ctx.arc(x, eave - step * 0.1, step * 0.36, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#c0a050';
      ctx.beginPath();
      ctx.arc(x, eave - step * 0.1, step * 0.13, 0, TAU);
      ctx.fill();
    }
    // moon window ring in dark wood with a gold line
    const rings = [[1.075, '#14161d'], [1.05, '#4b3a2c'], [1.012, '#c0a050'], [1.0, '#2a2018']];
    for (const [k, col] of rings) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(g.wx, g.wy, g.wr * k, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(g.wx, g.wy, g.wr * 0.985, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintSill(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * SILL[0];
    const y1 = g.H * SILL[1];
    const y2 = g.H * SILL[2];
    ctx.fillStyle = '#8c6a46';
    ctx.fillRect(0, y0, g.W, y1 - y0);
    ctx.fillStyle = '#c0a050';
    ctx.fillRect(0, y0, g.W, Math.max(1, g.U * 0.35));
    ctx.fillStyle = '#4b3a2c';
    ctx.fillRect(0, y1, g.W, y2 - y1);
    ctx.fillStyle = '#251c15';
    ctx.fillRect(0, y2, g.W, g.H - y2);
    // grain
    for (let i = 0; i < g.W * 0.7; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(20,12,6,0.25)' : 'rgba(220,190,140,0.12)';
      const y = rand() < 0.5 ? y0 + rand() * (y1 - y0) : y1 + rand() * (y2 - y1);
      ctx.fillRect(rand() * g.W, y, 3 + rand() * g.U * 4, 1);
    }
    // pale moonlight laid across the top of the sill
    const grad = ctx.createLinearGradient(g.wx - g.wr * 0.8, 0, g.wx + g.wr * 0.4, 0);
    grad.addColorStop(0, 'rgba(238,230,208,0)');
    grad.addColorStop(0.5, 'rgba(238,230,208,0.25)');
    grad.addColorStop(1, 'rgba(238,230,208,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(g.wx - g.wr * 0.8, y0, g.wr * 1.2, y1 - y0);
    return c;
  }

  // ---- the fan -----------------------------------------------------------------

  // Local space: fan centre at (0, 0); handle runs straight down.
  function paintFan(g, rand) {
    const r = g.fr;
    const hl = g.sill - (g.fy + r);
    const pad = Math.ceil(g.U * 3);
    const w = Math.ceil(r * 2 + pad * 2);
    const h = Math.ceil(r * 2 + hl + pad * 2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.translate(w / 2, pad + r);
    // handle: lacquered wood with a gold bead
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(-g.U * 0.55, r - g.U, g.U * 1.1, hl + g.U);
    ctx.fillStyle = '#c0a050';
    ctx.fillRect(-g.U * 0.8, r + hl * 0.35, g.U * 1.6, Math.max(1, g.U * 0.5));
    ctx.fillRect(-g.U * 0.8, r + hl * 0.8, g.U * 1.6, Math.max(1, g.U * 0.5));
    // gold rim, then silk
    ctx.fillStyle = '#7a5a2a';
    ctx.beginPath();
    ctx.arc(0, 0, r + g.U * 0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c0a050';
    ctx.beginPath();
    ctx.arc(0, 0, r + g.U * 0.15, 0, TAU);
    ctx.fill();
    const silk = ctx.createRadialGradient(-r * 0.2, -r * 0.25, 0, 0, 0, r);
    silk.addColorStop(0, '#f1e8d0');
    silk.addColorStop(1, '#dccfae');
    ctx.fillStyle = silk;
    ctx.beginPath();
    ctx.arc(0, 0, r - g.U * 0.5, 0, TAU);
    ctx.fill();
    // vermilion inner line
    ctx.strokeStyle = '#c8452c';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, TAU);
    ctx.stroke();
    // plum branch painted from the lower left up to the right
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, TAU);
    ctx.clip();
    const mc = [[-r * 0.95, r * 0.55], [-r * 0.5, r * 0.4], [-r * 0.1, r * 0.1], [r * 0.2, -r * 0.1], [r * 0.45, -r * 0.5], [r * 0.7, -r * 0.62]];
    const main = curve(mc, 24);
    stroke(ctx, main, g.U * 1.9, g.U * 0.7, '#1b1c24');
    const twigs = [
      [[-r * 0.1, r * 0.1], [-r * 0.05, -r * 0.3], [-r * 0.2, -r * 0.55]],
      [[r * 0.2, -r * 0.1], [r * 0.45, -r * 0.1], [r * 0.7, 0.02]],
      [[-r * 0.5, r * 0.4], [-r * 0.45, r * 0.7], [-r * 0.3, r * 0.82]],
    ];
    const spots = [];
    for (const t of twigs) {
      const pts = curve(t, 12);
      stroke(ctx, pts, g.U * 1.0, g.U * 0.4, '#1b1c24');
      spots.push(pts[6], pts[12]);
    }
    for (const i of [4, 9, 14, 19, 24]) spots.push(main[i]);
    for (const p of spots) {
      blossom(ctx, p[0], p[1] - g.U * 0.9, g.U * 2.1, '#d9604a', '#7a2a1e');
      if (rand() < 0.7) blossom(ctx, p[0] + g.U * 1.9, p[1] + g.U * 1.2, g.U * 1.5, '#e8a490', '#c8452c');
    }
    ctx.restore();
    return { c, ox: w / 2, oy: pad + r, hl };
  }

  // ---- motion -----------------------------------------------------------------------

  function paintPetal() {
    const s = 12;
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#efe6d0';
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2, s * 0.42, s * 0.24, 0, 0, TAU);
    ctx.fill();
    return c;
  }

  function resetPetal(g, P, i, scatter) {
    const r = state.rand;
    P.x[i] = g.wx + g.wr * (0.1 + r() * 0.95);
    P.y[i] = scatter ? g.wy - g.wr * 0.8 + r() * g.wr * 1.5 : g.wy - g.wr * (0.45 + r() * 0.2);
    P.v[i] = 0.5 + r() * 0.8;
    P.a[i] = r() * TAU;
    P.p[i] = r() * TAU;
    P.s[i] = 0.55 + r() * 0.6;
  }

  function stepPetals(g, P, t, dt, count, breeze) {
    for (let i = 0; i < count; i++) {
      const gust = 0.6 + 0.4 * Math.sin(t * 0.37 + P.p[i] * 0.2);
      P.x[i] -= g.U * (1.5 + 3.2 * gust) * breeze * P.v[i] * dt;
      P.y[i] += g.U * (1.2 + 1.2 * P.v[i]) * dt + Math.sin(t * 1.3 + P.p[i]) * g.U * 0.35 * dt;
      P.a[i] += dt * (0.8 + P.v[i]);
      if (P.x[i] < g.wx - g.wr * 1.05 || P.y[i] > g.wy + g.wr * 0.95) resetPetal(g, P, i, false);
    }
  }

  function drawPetals(ctx, g, P, count) {
    const sz = g.U * 2.4;
    for (let i = 0; i < count; i++) {
      const sq = 0.45 + 0.55 * Math.abs(Math.sin(P.a[i]));
      const c = Math.cos(P.a[i] * 0.6);
      const s = Math.sin(P.a[i] * 0.6);
      const k = sz * P.s[i];
      ctx.setTransform(c * sq, s * sq, -s, c, P.x[i], P.y[i]);
      ctx.drawImage(state.petal, -k / 2, -k / 2, k, k);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawMist(ctx, g, t, breeze) {
    const m = state.mist;
    const off = (t * g.U * 0.9 * (0.8 + breeze * 1.2)) % m.width;
    const y = g.wy + g.wr * 0.35;
    ctx.drawImage(m, -off, y);
    ctx.drawImage(m, m.width - off, y);
  }

  function drawBranchSway(ctx, g, t, breeze) {
    const ox = g.wx + g.wr * 0.98;
    const oy = g.wy - g.wr * 0.52;
    const a = (Math.sin(t * 0.8) * 0.035 + Math.sin(t * 1.9 + 1) * 0.012) * breeze;
    ctx.translate(ox, oy);
    ctx.rotate(a);
    ctx.translate(-ox, -oy);
    ctx.drawImage(state.branch, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawFan(ctx, g, t, breeze) {
    const f = state.fan;
    const a = -0.07 + Math.sin(t * 0.7) * 0.014 * breeze;
    ctx.translate(g.fx, g.sill);
    ctx.rotate(a);
    ctx.drawImage(f.c, -f.ox, -(f.oy + g.fr + f.hl));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawTassel(ctx, g, t, breeze, a);
  }

  // A cord and vermilion tassel hanging from the bead near the foot of the handle.
  function drawTassel(ctx, g, t, breeze, tilt) {
    const x0 = g.fx + Math.sin(tilt) * -g.U * 1.5 + g.U * 1.3;
    const y0 = g.sill - g.U * 1.2;
    const sw = Math.sin(t * 1.2) * g.U * 1.4 * breeze;
    const len = g.U * 13;
    ctx.strokeStyle = '#c0a050';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + g.U * 2.2, y0 + g.U * 2, x0 + g.U * 2.6 + sw * 0.3, y0 + g.U * 4);
    ctx.stroke();
    const kx = x0 + g.U * 2.6 + sw * 0.3;
    const ky = y0 + g.U * 4;
    ctx.fillStyle = '#c0a050';
    ctx.beginPath();
    ctx.arc(kx, ky, g.U * 0.7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#c8452c';
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(kx + i * g.U * 0.25, ky);
      ctx.quadraticCurveTo(kx + i * g.U * 0.5 + sw * 0.5, ky + len * 0.5, kx + i * g.U * 0.7 + sw, ky + len * 0.9);
      ctx.stroke();
    }
    ctx.strokeStyle = '#7a2a1e';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    ctx.moveTo(kx - g.U * 0.9 + sw * 0.3, ky + len * 0.35);
    ctx.lineTo(kx + g.U * 0.9 + sw * 0.3, ky + len * 0.35);
    ctx.stroke();
  }

  // ---- run -------------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.view = paintView(g, rand);
    state.mist = paintMist(g);
    state.branch = paintOuterBranch(g, rand);
    state.wall = paintWall(g, rand);
    state.sill = paintSill(g, rand);
    state.fan = paintFan(g, rand);
    state.petal = paintPetal();
    state.petals = {
      x: new Float32Array(MAX_PETALS), y: new Float32Array(MAX_PETALS), v: new Float32Array(MAX_PETALS),
      a: new Float32Array(MAX_PETALS), p: new Float32Array(MAX_PETALS), s: new Float32Array(MAX_PETALS),
    };
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { breeze, blossom: bl } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(18 * bl));
    stepPetals(g, state.petals, t, Math.min(dt, 0.1), count, breeze);
    ctx.drawImage(state.view, 0, 0);
    drawMist(ctx, g, t, breeze);
    drawBranchSway(ctx, g, t, breeze);
    drawPetals(ctx, g, state.petals, count);
    ctx.drawImage(state.wall, 0, 0);
    ctx.drawImage(state.sill, 0, 0);
    drawFan(ctx, g, t, breeze);
  }

  Kasuri.run({
    defaults: { breeze: 1, blossom: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
