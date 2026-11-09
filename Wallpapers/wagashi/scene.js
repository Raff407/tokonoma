/*
 * 和菓子 Wagashi — autumn sweets on a lacquer tray beside a bowl of matcha.
 *
 * The table, shoji light, tray, sweets and bowl are baked once into two layers.
 * Per frame: a short pool of steam puffs and one maple leaf that drifts down,
 * rests on the table, fades, and falls again somewhere else.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const MAX_PUFFS = 18;
  const FALL = 15;
  const REST = 9;
  const FADE = 3;
  const LEAF_TONES = ['#c4472b', '#d4682f', '#b83a28'];
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
    const u = Math.min(H / 100, W / 150);
    return { W, H, u, cx: W / 2, cy: H / 2 };
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // A five-lobed maple outline, unit size, pointing up.
  function maplePath(ctx, x, y, r, rot) {
    const lobes = [[0, 1], [72, 0.85], [144, 0.62], [216, 0.62], [288, 0.85]];
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (lobes[i][0] - 90) * Math.PI / 180 + rot;
      const b = (lobes[(i + 1) % 5][0] - 90) * Math.PI / 180 + rot;
      const m = (a + (i === 4 ? b + TAU : b)) / 2;
      const px = x + Math.cos(a) * r * lobes[i][1];
      const py = y + Math.sin(a) * r * lobes[i][1];
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      ctx.lineTo(x + Math.cos(m) * r * 0.38, y + Math.sin(m) * r * 0.38);
    }
    ctx.closePath();
  }

  function dome(ctx, x, y, r, base, light, dark) {
    ctx.fillStyle = 'rgba(20,12,8,0.35)';
    blob(ctx, x + r * 0.2, y + r * 0.3, r * 1.05, r * 0.72);
    const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
    gr.addColorStop(0, light);
    gr.addColorStop(0.55, base);
    gr.addColorStop(1, dark);
    ctx.fillStyle = gr;
    blob(ctx, x, y, r, r * 0.85);
  }

  // ---- table and light ------------------------------------------------------

  function paintTable(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, '#4a3626');
    gr.addColorStop(1, '#2c2018');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const y = rand() * g.H;
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(20,12,6,0.28)' : 'rgba(150,110,70,0.14)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      let x = 0;
      while (x < g.W) {
        x += g.u * (6 + rand() * 10);
        ctx.lineTo(x, y + (rand() - 0.5) * g.u * 0.8);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(12,8,4,0.55)';
    ctx.lineWidth = Math.max(1, g.u * 0.35);
    for (const f of [0.34, 0.68]) {
      ctx.beginPath();
      ctx.moveTo(0, g.H * f);
      ctx.lineTo(g.W, g.H * f);
      ctx.stroke();
    }
    paintRunner(ctx, g);
    paintLight(ctx, g);
    return c;
  }

  function paintRunner(ctx, g) {
    const u = g.u;
    const y0 = g.cy - 24 * u;
    const y1 = g.cy + 26 * u;
    ctx.fillStyle = '#26304c';
    ctx.fillRect(0, y0, g.W, y1 - y0);
    ctx.fillStyle = '#e6dcc2';
    for (const y of [y0 + u * 1.6, y1 - u * 2.2]) ctx.fillRect(0, y, g.W, u * 0.7);
    ctx.fillStyle = 'rgba(230,220,194,0.16)';
    for (let x = -u; x < g.W + u; x += u * 5) {
      for (let row = 0; row < 8; row++) {
        const px = x + (row % 2) * u * 2.5;
        blob(ctx, px, y0 + u * 6 + row * u * 5, u * 0.7, u * 0.7);
      }
    }
  }

  // Window light: shoji panes thrown slanting across the table.
  function paintLight(ctx, g) {
    const u = g.u;
    ctx.save();
    ctx.fillStyle = 'rgba(244,226,176,0.17)';
    const skew = 0.55;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        const x = g.W * 0.02 + i * u * 25 + j * u * 4;
        const y = -u * 4 + j * u * 38;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + u * 22, y);
        ctx.lineTo(x + u * 22 + skew * u * 34, y + u * 34);
        ctx.lineTo(x + skew * u * 34, y + u * 34);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---- tray and sweets --------------------------------------------------------

  function paintTray(ctx, g) {
    const u = g.u;
    const x = g.cx - 58 * u;
    const y = g.cy - 20 * u;
    const w = 70 * u;
    const h = 40 * u;
    ctx.fillStyle = 'rgba(10,6,4,0.45)';
    roundRect(ctx, x + u * 1.5, y + u * 2.5, w, h, u * 3);
    ctx.fill();
    ctx.fillStyle = '#1e1614';
    roundRect(ctx, x, y, w, h, u * 3);
    ctx.fill();
    ctx.strokeStyle = '#c9a24e';
    ctx.lineWidth = Math.max(1, u * 0.5);
    roundRect(ctx, x + u * 1.2, y + u * 1.2, w - u * 2.4, h - u * 2.4, u * 2.4);
    ctx.stroke();
    const gr = ctx.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, '#b4412b');
    gr.addColorStop(1, '#7e2a1e');
    ctx.fillStyle = gr;
    roundRect(ctx, x + u * 2.4, y + u * 2.4, w - u * 4.8, h - u * 4.8, u * 1.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,200,0.12)';
    ctx.beginPath();
    ctx.moveTo(x + u * 6, y + h - u * 3);
    ctx.lineTo(x + u * 24, y + u * 3);
    ctx.lineTo(x + u * 32, y + u * 3);
    ctx.lineTo(x + u * 14, y + h - u * 3);
    ctx.fill();
    ctx.fillStyle = '#e8dfc6';
    roundRect(ctx, x + u * 6, y + u * 6, w - u * 12, h - u * 12, u * 0.8);
    ctx.fill();
    return { x, y, w, h };
  }

  function paintSakura(ctx, x, y, u) {
    dome(ctx, x, y, u * 7, '#d9a3a0', '#efcfc4', '#b87a7c');
    ctx.strokeStyle = 'rgba(150,80,90,0.55)';
    ctx.lineWidth = Math.max(1, u * 0.4);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * u * 5, y + Math.sin(a) * u * 4.2);
      ctx.stroke();
    }
    ctx.fillStyle = '#d8b25a';
    blob(ctx, x, y, u * 1.1, u * 1);
  }

  function paintMomiji(ctx, x, y, u) {
    ctx.fillStyle = 'rgba(20,12,8,0.35)';
    maplePath(ctx, x + u * 0.8, y + u * 1.2, u * 8, 0.2);
    ctx.fill();
    ctx.fillStyle = '#c0532e';
    maplePath(ctx, x, y, u * 8, 0.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,170,90,0.4)';
    maplePath(ctx, x - u * 0.8, y - u * 0.9, u * 5, 0.2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,40,24,0.7)';
    ctx.lineWidth = Math.max(1, u * 0.35);
    for (const a of [-90, -18, 54, 126, 198]) {
      const r = (a + 90) * Math.PI / 180 + 0.2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(r) * u * 5.5, y + Math.sin(r) * u * 5.5);
      ctx.stroke();
    }
  }

  function paintKusa(ctx, x, y, u) {
    dome(ctx, x, y, u * 6, '#71844f', '#98a672', '#4b5c37');
    ctx.fillStyle = 'rgba(236,230,210,0.5)';
    for (let i = 0; i < 6; i++) blob(ctx, x - u * 2 + i * u * 0.8, y - u * 1.8 + (i % 3) * u * 1.4, u * 0.55, u * 0.4);
    ctx.fillStyle = '#d8b25a';
    blob(ctx, x + u * 0.4, y + u * 0.4, u * 1.3, u * 1);
  }

  function paintYokan(ctx, x, y, u) {
    ctx.fillStyle = 'rgba(20,12,8,0.35)';
    roundRect(ctx, x + u * 0.8, y + u * 1.2, u * 15, u * 8, u * 0.8);
    ctx.fill();
    const gr = ctx.createLinearGradient(x, y, x, y + u * 8);
    gr.addColorStop(0, '#4a3a4a');
    gr.addColorStop(1, '#241a28');
    ctx.fillStyle = gr;
    roundRect(ctx, x, y, u * 15, u * 8, u * 0.8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x + u * 0.8, y + u * 0.6, u * 13.4, u * 0.8);
    ctx.fillStyle = '#c9a24e';
    blob(ctx, x + u * 7.5, y + u * 4, u * 1.6, u * 1.3);
    ctx.strokeStyle = '#a8845a';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + u * 3, y + u * 10);
    ctx.lineTo(x + u * 16, y + u * 11);
    ctx.stroke();
  }

  // ---- bowl -------------------------------------------------------------------

  function paintBowl(ctx, g) {
    const u = g.u;
    const x = g.cx + 36 * u;
    const y = g.cy - 2 * u;
    ctx.fillStyle = 'rgba(8,5,3,0.5)';
    blob(ctx, x + u * 2, y + u * 6, u * 19, u * 14);
    ctx.fillStyle = '#6b5236';
    roundRect(ctx, x - u * 16, y - u * 11, u * 32, u * 28, u * 1.5);
    ctx.fill();
    ctx.fillStyle = '#7d6244';
    roundRect(ctx, x - u * 14.5, y - u * 9.5, u * 29, u * 25, u * 1);
    ctx.fill();
    const body = ctx.createLinearGradient(x - u * 16, y, x + u * 16, y);
    body.addColorStop(0, '#2e3a5c');
    body.addColorStop(0.5, '#222b46');
    body.addColorStop(1, '#161c30');
    ctx.fillStyle = body;
    blob(ctx, x, y + u * 3, u * 15.5, u * 12.5);
    ctx.fillStyle = '#c0a874';
    ctx.beginPath();
    ctx.ellipse(x, y + u * 8, u * 13, u * 5.5, 0, 0.1, Math.PI - 0.1);
    ctx.fill();
    ctx.fillStyle = '#e4d8b8';
    blob(ctx, x, y, u * 16, u * 12.5);
    ctx.fillStyle = '#3d4a70';
    blob(ctx, x, y + u * 0.4, u * 14.6, u * 11.4);
    const tea = ctx.createRadialGradient(x - u * 3, y - u * 2, u, x, y, u * 13);
    tea.addColorStop(0, '#9aad6a');
    tea.addColorStop(1, '#6c8044');
    ctx.fillStyle = tea;
    blob(ctx, x, y + u * 1.2, u * 12.6, u * 9.6);
    ctx.fillStyle = 'rgba(214,224,168,0.55)';
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4;
      const r = (i % 7) / 7 * 0.85;
      blob(ctx, x + Math.cos(a) * u * 11 * r, y + u * 1.2 + Math.sin(a) * u * 8 * r, u * 0.7, u * 0.5);
    }
    return { x, y: y + u * 1 };
  }

  // ---- moving things ------------------------------------------------------------

  function makePuffs(g, rand) {
    const a = [];
    for (let i = 0; i < MAX_PUFFS; i++) {
      a.push({ p: rand(), dx: (rand() - 0.5) * g.u * 8, sw: rand() * TAU, r: g.u * (2.2 + rand() * 1.8) });
    }
    return a;
  }

  function drawSteam(ctx, g, t, amount) {
    const n = Math.min(MAX_PUFFS, Math.round(MAX_PUFFS * amount * 0.5));
    const b = state.bowl;
    ctx.fillStyle = '#efe6d0';
    for (let i = 0; i < n; i++) {
      const s = state.puffs[i];
      const f = (t * 0.07 + s.p) % 1;
      const x = b.x + s.dx * f + Math.sin(t * 0.6 + s.sw + f * 4) * g.u * (1 + f * 3);
      const y = b.y - f * g.u * 42;
      ctx.globalAlpha = Math.sin(f * Math.PI) * 0.2;
      blob(ctx, x, y, s.r * (0.7 + f * 1.6), s.r * (0.8 + f * 1.8));
    }
    ctx.globalAlpha = 1;
  }

  function startLeaf(g, L, rand) {
    const spots = [[g.cx + 8 * g.u, g.cy + 33 * g.u], [g.cx + 62 * g.u, g.cy + 28 * g.u], [g.cx - 4 * g.u, g.cy - 33 * g.u]];
    const s = spots[Math.floor(rand() * spots.length)];
    L.tx = s[0];
    L.ty = s[1];
    L.age = 0;
    L.rot = rand() * TAU;
    L.tone = Math.floor(rand() * LEAF_TONES.length);
    L.sx = L.tx - g.u * (10 + rand() * 12);
  }

  function drawLeaf(ctx, g, t, dt) {
    const L = state.leaf;
    L.age += Math.min(dt, 0.1);
    if (L.age > FALL + REST + FADE) startLeaf(g, L, state.rand);
    const f = Math.min(1, L.age / FALL);
    const e = f * f * (3 - 2 * f);
    const sway = Math.sin(f * 11 + L.rot) * g.u * 6 * (1 - f);
    const x = L.sx + (L.tx - L.sx) * e + sway;
    const y = -g.u * 8 + (L.ty + g.u * 8) * e;
    const tilt = f < 1 ? 0.35 + 0.65 * Math.abs(Math.sin(f * 9 + L.rot)) : 0.85;
    const out = Math.max(0, (L.age - FALL - REST) / FADE);
    ctx.globalAlpha = 1 - out;
    ctx.setTransform(1, 0, 0, tilt, x, y);
    ctx.fillStyle = 'rgba(10,6,4,0.35)';
    maplePath(ctx, g.u * 0.8, g.u * 1.1, g.u * 6, L.rot + f * 4);
    ctx.fill();
    ctx.fillStyle = LEAF_TONES[L.tone];
    maplePath(ctx, 0, 0, g.u * 6, L.rot + f * 4);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- run ----------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.table = paintTable(g, rand);
    const fore = layer(g.W, g.H);
    const fc = fore.getContext('2d');
    const tray = paintTray(fc, g);
    const u = g.u;
    paintSakura(fc, tray.x + u * 16, tray.y + u * 15, u);
    paintMomiji(fc, tray.x + u * 35, tray.y + u * 16, u);
    paintKusa(fc, tray.x + u * 20, tray.y + u * 28, u);
    paintYokan(fc, tray.x + u * 38, tray.y + u * 24, u);
    state.bowl = paintBowl(fc, g);
    state.fore = fore;
    state.puffs = makePuffs(g, rand);
    state.leaf = { age: 0 };
    startLeaf(g, state.leaf, rand);
    state.leaf.age = FALL * 0.35;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.table, 0, 0);
    ctx.drawImage(state.fore, 0, 0);
    drawSteam(ctx, g, t, api.props.steam);
    if (api.props.leaf) drawLeaf(ctx, g, t, dt);
  }

  Kasuri.run({
    defaults: { steam: 1, leaf: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
