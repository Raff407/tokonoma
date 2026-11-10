/*
 * 暖簾 Noren — plain indigo shop curtains with white hems, swaying at a wooden doorway.
 *
 * The lane beyond, the dark timber frame and one curtain panel are baked once.
 * Each frame the panels are redrawn as a few thin slabs shifted sideways and
 * lifted by a slow breeze, so the slit opens and the hems rise. A short pool
 * of petals drifts across the lane.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SLABS = 26;
  const PANELS = 4;
  const MAX_PETALS = 14;
  const PETALS = 7;
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
    const L = W * 0.11;
    const R = W * 0.89;
    const post = Math.max(3, U * 4.5);
    const top = H * 0.08;
    const rodY = H * 0.14;
    const hang = H * 0.56;
    const floor = H * 0.88;
    const gap = Math.max(1, U * 0.5);
    const inner = R - L - post * 2;
    const pw = (inner - gap * (PANELS - 1)) / PANELS;
    return { W, H, U, L, R, post, top, rodY, hang, floor, gap, pw: Math.floor(pw), inner };
  }

  // ---- the lane beyond -------------------------------------------------------

  function paintLane(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.55);
    sky.addColorStop(0, '#d8d2b8');
    sky.addColorStop(1, '#efe3c0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);

    // Merchant house across the lane: plaster wall, timber lattice, dark tiled eave.
    const wallTop = g.H * 0.36;
    const wallBot = g.H * 0.7;
    ctx.fillStyle = '#d9c9a2';
    ctx.fillRect(0, wallTop, g.W, wallBot - wallTop);
    ctx.fillStyle = '#4a3a2c';
    for (let x = 0; x < g.W; x += g.U * 1.3) ctx.fillRect(x, g.H * 0.5, Math.max(1, g.U * 0.45), g.H * 0.2);
    ctx.fillRect(0, g.H * 0.5, g.W, Math.max(1, g.U * 0.6));
    ctx.fillRect(0, g.H * 0.68, g.W, Math.max(1, g.U * 0.9));
    ctx.fillStyle = '#7a6850';
    for (let k = 0; k < 4; k++) ctx.fillRect(g.W * (0.28 + k * 0.17), wallTop, Math.max(1, g.U * 0.7), g.H * 0.14);
    ctx.fillStyle = '#3a342e';
    ctx.beginPath();
    ctx.moveTo(0, wallTop + g.U * 2);
    ctx.lineTo(g.W, wallTop + g.U * 2);
    ctx.lineTo(g.W, g.H * 0.28);
    ctx.lineTo(0, g.H * 0.28);
    ctx.fill();
    ctx.fillStyle = '#56504a';
    for (let x = 0; x < g.W; x += g.U * 1.6) ctx.fillRect(x, g.H * 0.28, Math.max(1, g.U * 0.4), g.U * 6);
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(0, wallTop, g.W, Math.max(1, g.U * 0.8));

    // A pine branch over the wall (moss green).
    ctx.fillStyle = '#51663f';
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.ellipse(g.W * (0.66 + rand() * 0.2), g.H * (0.2 + rand() * 0.09), g.U * (2 + rand() * 3), g.U * (1 + rand() * 1.2), 0, 0, TAU);
      ctx.fill();
    }

    // Stone paving, brighter near the door.
    const laneTop = wallBot;
    const lane = ctx.createLinearGradient(0, laneTop, 0, g.H);
    lane.addColorStop(0, '#cdbf9c');
    lane.addColorStop(1, '#efe4bf');
    ctx.fillStyle = lane;
    ctx.fillRect(0, laneTop, g.W, g.H - laneTop);
    ctx.fillStyle = '#a89878';
    for (let y = laneTop + g.U; y < g.H; y += g.U * 2.2) {
      const k = (y - laneTop) / (g.H - laneTop);
      ctx.fillRect(0, y, g.W, Math.max(1, g.U * 0.25));
      const step = g.U * (4 + k * 8);
      for (let x = rand() * step; x < g.W; x += step) ctx.fillRect(x, y, Math.max(1, g.U * 0.25), g.U * 2.2);
    }
    // Warm light pooled on the stones.
    const glow = ctx.createRadialGradient(g.W * 0.5, g.H * 0.8, 0, g.W * 0.5, g.H * 0.8, g.W * 0.4);
    glow.addColorStop(0, 'rgba(250,236,190,0.7)');
    glow.addColorStop(1, 'rgba(250,236,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, laneTop, g.W, g.H - laneTop);
    return c;
  }

  // ---- timber frame and room ---------------------------------------------------

  function wood(ctx, x, y, w, h, base, rand, vertical) {
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1a1511';
    ctx.globalAlpha = 0.35;
    const n = Math.round((vertical ? w : h) / 2.2);
    for (let i = 0; i < n; i++) {
      const o = rand() * (vertical ? w : h);
      if (vertical) ctx.fillRect(x + o, y, 1, h);
      else ctx.fillRect(x, y + o, w, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintFrame(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    // Plaster wall of the shop interior, dark and warm.
    ctx.fillStyle = '#2b2520';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#3a322a';
    for (let x = 0; x < g.W; x += g.U * 9) ctx.fillRect(x, 0, Math.max(1, g.U * 0.4), g.H);
    // Open the doorway.
    ctx.clearRect(g.L, g.top + g.U * 3.5, g.R - g.L, g.floor - g.top - g.U * 3.5);
    const p = g.post;
    wood(ctx, g.L - p, g.top, g.R - g.L + p * 2, g.U * 3.5, '#4a3626', rand, false);
    wood(ctx, g.L - p, g.top, p, g.floor - g.top + g.U * 4, '#4a3626', rand, true);
    wood(ctx, g.R, g.top, p, g.floor - g.top + g.U * 4, '#4a3626', rand, true);
    // Sill and threshold, a worn timber step.
    wood(ctx, g.L - p, g.floor, g.R - g.L + p * 2, g.U * 4, '#5a4330', rand, false);
    ctx.fillStyle = '#77593d';
    ctx.fillRect(g.L - p, g.floor, g.R - g.L + p * 2, Math.max(1, g.U * 0.6));
    // Room floor below the sill.
    ctx.fillStyle = '#1f1a16';
    ctx.fillRect(0, g.floor + g.U * 4, g.W, g.H - g.floor - g.U * 4);
    ctx.fillStyle = '#2e2620';
    for (let y = g.floor + g.U * 6; y < g.H; y += g.U * 3) ctx.fillRect(0, y, g.W, 1);
    // Curtain rod.
    ctx.fillStyle = '#6b5236';
    ctx.fillRect(g.L, g.rodY - g.U * 0.5, g.R - g.L, Math.max(2, g.U * 1.1));
    ctx.fillStyle = '#8a6c48';
    ctx.fillRect(g.L, g.rodY - g.U * 0.5, g.R - g.L, 1);
    return c;
  }

  // ---- one curtain panel -------------------------------------------------------

  function paintPanel(g, rand, white) {
    const w = g.pw;
    const h = Math.ceil(g.hang);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const base = white ? '#ddd7c6' : '#243a63';
    const hem = white ? '#243a63' : '#e4e0d2';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Dye is deeper at the top and fades toward the hem.
    ctx.fillStyle = white ? '#243a63' : '#6f86a8';
    for (let y = 0; y < h * 0.8; y++) {
      const f = y / (h * 0.8);
      ctx.globalAlpha = (white ? 0.1 : 0.4) * f * f;
      ctx.fillRect(0, y, w, 1);
    }
    // Woven cloth: faint warp threads.
    ctx.globalAlpha = 0.18;
    for (let x = 0; x < w; x += 2) {
      ctx.fillStyle = rand() < 0.5 ? '#0f1c38' : '#5c7396';
      ctx.fillRect(x, 0, 1, h);
    }
    ctx.globalAlpha = 1;
    // Sewn top loops where the rod passes.
    ctx.fillStyle = white ? '#c8c1ac' : '#16264a';
    ctx.fillRect(0, 0, w, Math.max(2, g.U * 1.6));
    // White hem band with its stitched line.
    const hemH = Math.max(3, g.U * 6);
    ctx.fillStyle = hem;
    ctx.fillRect(0, h - hemH, w, hemH);
    ctx.fillStyle = base;
    ctx.fillRect(0, h - hemH, w, Math.max(1, g.U * 0.35));
    ctx.fillStyle = white ? '#16264a' : '#b4b09f';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, h - 1, w, 1);
    ctx.globalAlpha = 1;
    // A thin hem line in the body of the cloth.
    ctx.fillStyle = white ? '#16264a' : '#d6d3c4';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, h - hemH - g.U * 2.6, w, Math.max(1, g.U * 0.3));
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- petals ------------------------------------------------------------------

  function makePetals(g, rand) {
    const P = { x: [], y: [], v: [], s: [], p: [], r: [] };
    for (let i = 0; i < MAX_PETALS; i++) {
      P.x.push(rand() * g.W);
      P.y.push(g.H * (0.38 + rand() * 0.4));
      P.v.push(0.6 + rand());
      P.s.push(Math.max(1, g.U * (0.5 + rand() * 0.5)));
      P.p.push(rand() * TAU);
      P.r.push(rand() * TAU);
    }
    return P;
  }

  function stepPetals(g, t, dt, count, breeze) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      P.x[i] -= dt * g.U * (2.5 + 5 * breeze) * P.v[i];
      P.y[i] += dt * g.U * (0.6 + Math.sin(t * 1.3 + P.p[i]) * 1.2);
      P.r[i] += dt * 1.5;
      if (P.x[i] < -g.U * 3) {
        P.x[i] = g.W + g.U * 3;
        P.y[i] = g.H * (0.36 + 0.4 * ((P.p[i] * 7.3) % 1));
      }
      if (P.y[i] > g.H * 0.85) P.y[i] = g.H * 0.36;
    }
  }

  function drawPetals(ctx, g, count) {
    const P = state.petals;
    ctx.fillStyle = '#e8c4c0';
    for (let i = 0; i < count; i++) {
      const x = P.x[i];
      // Petals pass only in the lit opening.
      if (x < g.L || x > g.R) continue;
      const sq = 0.5 + 0.5 * Math.abs(Math.sin(P.r[i]));
      ctx.fillRect(x, P.y[i], P.s[i] * 1.6, P.s[i] * sq + 1);
    }
  }

  // ---- panels in the wind ------------------------------------------------------

  function gust(t, k) {
    return 0.5 + 0.28 * Math.sin(t * 0.55 + k) + 0.15 * Math.sin(t * 1.35 + k * 2.1) + 0.07 * Math.sin(t * 2.9 + k * 0.7);
  }

  function drawPanels(ctx, g, t, breeze) {
    const slab = g.hang / SLABS;
    const sw = g.pw;
    const amp = g.U * 3 * breeze;
    const lift = g.U * 4 * breeze;
    const open = g.U * 1.6 * breeze;
    for (let i = 0; i < PANELS; i++) {
      const img = state.panels[i];
      const side = i % 2 === 0 ? -1 : 1;
      const x0 = g.L + g.post + i * (g.pw + g.gap);
      const k = i * 1.7 + 0.4;
      const gu = gust(t, k);
      const bill = gust(t * 0.8 + 3, k + 5);
      for (let s = 0; s < SLABS; s++) {
        const f = (s + 0.5) / SLABS;
        const f2 = f * f;
        const sway = Math.sin(t * 1.15 + k - f * 1.3) * 0.5 + gu - 0.5;
        const dx = sway * amp * f2 * 1.6 + side * open * bill * f2;
        const dy = -lift * bill * f2 * f;
        ctx.drawImage(img, 0, s * slab, sw, slab + 0.6, x0 + dx, g.rodY + s * slab + dy, sw, slab + 0.6);
      }
    }
  }

  function drawShade(ctx, g, t, breeze) {
    // Light through the cloth: the lit floor patch breathes with the breeze.
    const a = 0.22 + 0.1 * Math.sin(t * 0.55) * breeze;
    ctx.globalAlpha = a;
    ctx.drawImage(state.patch, g.L, g.floor - g.U * 6);
    ctx.globalAlpha = 1;
  }

  function paintPatch(g) {
    const w = Math.ceil(g.R - g.L);
    const h = Math.ceil(g.U * 10);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(250,236,190,0)');
    grad.addColorStop(1, 'rgba(250,236,190,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return c;
  }

  // ---- run -----------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.lane = paintLane(g, rand);
    state.frame = paintFrame(g, rand);
    state.panels = [];
    for (let i = 0; i < PANELS; i++) state.panels.push(paintPanel(g, rand, false));
    state.patch = paintPatch(g);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { breeze, petals } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    stepPetals(g, t, Math.min(dt, 0.1), count, breeze);
    ctx.drawImage(state.lane, 0, 0);
    drawPetals(ctx, g, count);
    drawPanels(ctx, g, t, breeze);
    ctx.drawImage(state.frame, 0, 0);
    drawShade(ctx, g, t, breeze);
  }

  Kasuri.run({
    defaults: { breeze: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
