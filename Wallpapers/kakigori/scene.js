/*
 * かき氷 Kakigori — a glass of shaved ice on a veranda table in late summer light.
 *
 * Garden, veranda, table and glass are baked once. Moving parts are a few small
 * things: the maple layer ripples sideways, a glass wind chime swings from the eave,
 * syrup drops run down the glass, and bands of warm light slide across the boards.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const DROPS = 3;
  const MOTES = 14;
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
    const S = Math.min(H / 100, W / 150);
    return {
      W, H, S,
      cx: W * 0.5,
      eave: H * 0.15,
      edge: H * 0.5,
      tableY: H * 0.7,
      glassX: W * 0.5,
    };
  }

  // ---- garden ---------------------------------------------------------------

  function paintGarden(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.edge);
    sky.addColorStop(0, '#d9c58f');
    sky.addColorStop(0.55, '#ecd9a8');
    sky.addColorStop(1, '#e6c88e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.edge);
    // distant hills
    ctx.fillStyle = '#7d8aa0';
    ctx.beginPath();
    ctx.moveTo(0, g.edge);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * 0.34 + fbm(x / (g.S * 30), 2.2, 3, 5) * g.H * 0.1);
    ctx.lineTo(g.W, g.edge);
    ctx.fill();
    ctx.fillStyle = '#5f7062';
    ctx.beginPath();
    ctx.moveTo(0, g.edge);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * 0.4 + fbm(x / (g.S * 22), 7.1, 3, 9) * g.H * 0.07);
    ctx.lineTo(g.W, g.edge);
    ctx.fill();
    // moss ground
    ctx.fillStyle = '#4f6540';
    ctx.fillRect(0, g.H * 0.45, g.W, g.edge - g.H * 0.45);
    ctx.fillStyle = '#6b7f4a';
    for (let i = 0; i < 70; i++) blob(ctx, rand() * g.W, g.H * (0.45 + rand() * 0.05), g.S * (1 + rand() * 3), g.S * 0.5);
    paintLantern(ctx, g, g.W * 0.8, g.H * 0.46);
    return c;
  }

  function paintLantern(ctx, g, x, base) {
    const s = g.S;
    ctx.fillStyle = '#8a8a82';
    ctx.fillRect(x - s * 1.2, base - s * 9, s * 2.4, s * 9);
    ctx.fillStyle = '#9b9a90';
    ctx.fillRect(x - s * 3, base - s * 13, s * 6, s * 4);
    ctx.fillStyle = '#d9b560';
    ctx.fillRect(x - s * 1.2, base - s * 12, s * 2.4, s * 2);
    ctx.fillStyle = '#6f6f68';
    poly(ctx, [x - s * 5, base - s * 13, x + s * 5, base - s * 13, x + s * 2, base - s * 16, x - s * 2, base - s * 16]);
    ctx.fillStyle = '#8a8a82';
    blob(ctx, x, base - s * 16.5, s * 1.2, s * 1.2);
    ctx.fillStyle = '#7a7a72';
    ctx.fillRect(x - s * 3.5, base - s * 1.2, s * 7, s * 1.2);
  }

  // maple canopy that hangs from the top, painted separately so it can ripple
  function paintMaples(g, rand) {
    const pad = Math.ceil(g.S * 3);
    const c = layer(g.W + pad * 2, g.edge);
    const ctx = c.getContext('2d');
    const tones = [['#2f4a2c', '#3f6034', '#5a7a40'], ['#385a30', '#4c7236', '#6e8c48']];
    const place = (x0, x1, y0, y1, n) => {
      for (let i = 0; i < n; i++) {
        const x = pad + x0 + rand() * (x1 - x0);
        const y = y0 + rand() * (y1 - y0);
        const r = g.S * (3 + rand() * 4);
        const t = tones[rand() < 0.5 ? 0 : 1];
        ctx.fillStyle = t[0];
        blob(ctx, x, y, r, r * 0.7);
        ctx.fillStyle = t[1];
        blob(ctx, x - r * 0.2, y - r * 0.15, r * 0.7, r * 0.5);
        ctx.fillStyle = t[2];
        blob(ctx, x - r * 0.35, y - r * 0.3, r * 0.35, r * 0.25);
      }
    };
    place(-g.S * 4, g.W * 0.16, g.eave, g.H * 0.38, 26);
    place(g.W * 0.84, g.W + g.S * 4, g.eave, g.H * 0.42, 26);
    place(g.W * 0.3, g.W * 0.7, g.eave, g.eave + g.S * 8, 14);
    // sparse warm leaves in the green
    ctx.fillStyle = '#c4572f';
    for (let i = 0; i < 10; i++) blob(ctx, pad + rand() * g.W, g.eave + rand() * g.H * 0.2, g.S * 0.7, g.S * 0.5);
    return { c, pad };
  }

  // ---- veranda and table ----------------------------------------------------

  function paintVeranda(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = g.S;
    // floor boards
    const floor = ctx.createLinearGradient(0, g.edge, 0, g.H);
    floor.addColorStop(0, '#c99a5a');
    floor.addColorStop(1, '#a87d48');
    ctx.fillStyle = floor;
    ctx.fillRect(0, g.edge, g.W, g.H - g.edge);
    ctx.fillStyle = 'rgba(60,36,18,0.45)';
    for (let y = g.edge + s * 5; y < g.H; y += s * (5 + (y - g.edge) / g.H * 8)) ctx.fillRect(0, Math.round(y), g.W, Math.max(1, s * 0.35));
    ctx.fillStyle = 'rgba(255,225,160,0.12)';
    for (let i = 0; i < 40; i++) ctx.fillRect(rand() * g.W, g.edge + rand() * (g.H - g.edge), s * (4 + rand() * 12), Math.max(1, s * 0.3));
    // veranda edge beam
    ctx.fillStyle = '#5a3f26';
    ctx.fillRect(0, g.edge - s * 1.2, g.W, s * 2.4);
    ctx.fillStyle = '#7a5834';
    ctx.fillRect(0, g.edge - s * 1.2, g.W, s * 0.6);
    // eave beam and roof fascia
    ctx.fillStyle = '#2d2019';
    ctx.fillRect(0, 0, g.W, g.eave);
    ctx.fillStyle = '#463226';
    ctx.fillRect(0, g.eave - s * 2.2, g.W, s * 2.2);
    ctx.fillStyle = '#6a4b32';
    ctx.fillRect(0, g.eave, g.W, s * 0.5);
    ctx.fillStyle = '#4a4038';
    for (let x = 0; x < g.W; x += s * 4) ctx.fillRect(x, g.eave * 0.25, s * 0.35, g.eave * 0.45);
    // posts
    ctx.fillStyle = '#3a2819';
    ctx.fillRect(0, 0, s * 7, g.edge);
    ctx.fillRect(g.W - s * 7, 0, s * 7, g.edge);
    ctx.fillStyle = '#58402a';
    ctx.fillRect(s * 6, 0, s * 0.8, g.edge);
    ctx.fillRect(g.W - s * 7, 0, s * 0.8, g.edge);
    return c;
  }

  function paintTable(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = g.S;
    const x0 = g.cx - s * 34;
    const x1 = g.cx + s * 34;
    const top = g.tableY;
    ctx.fillStyle = 'rgba(30,18,10,0.35)';
    blob(ctx, g.cx, top + s * 15, s * 38, s * 3.5);
    ctx.fillStyle = '#4a321d';
    ctx.fillRect(x0 + s * 4, top + s * 4, s * 3.5, s * 11);
    ctx.fillRect(x1 - s * 7.5, top + s * 4, s * 3.5, s * 11);
    ctx.fillStyle = '#8a5f35';
    poly(c.getContext('2d'), [x0 + s * 3, top - s * 3, x1 - s * 3, top - s * 3, x1, top + s * 1.5, x0, top + s * 1.5]);
    ctx.fillStyle = '#6b4626';
    ctx.fillRect(x0, top + s * 1.5, x1 - x0, s * 3);
    ctx.fillStyle = '#a97a47';
    ctx.fillRect(x0 + s * 3, top - s * 3, x1 - x0 - s * 6, s * 0.6);
    ctx.fillStyle = 'rgba(70,40,18,0.4)';
    for (let i = 1; i < 6; i++) ctx.fillRect(x0 + s * 3 + i * s * 5, top - s * 2.2, s * 0.3, s * 3.5);
    // folded fan, left of the glass
    ctx.fillStyle = '#ebe3cc';
    const fx = g.cx - s * 22;
    ctx.save();
    ctx.translate(fx, top - s * 0.8);
    ctx.scale(1, 0.32);
    blob(ctx, 0, 0, s * 8, s * 8);
    ctx.fillStyle = '#35466f';
    ctx.beginPath();
    ctx.arc(0, 0, s * 8, 0, TAU);
    ctx.lineWidth = s * 0.9;
    ctx.strokeStyle = '#35466f';
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#b89a62';
    ctx.fillRect(fx + s * 7, top - s * 1.2, s * 7, s * 0.8);
    // small saucer with spoon
    ctx.fillStyle = '#e6dcc2';
    blob(ctx, g.cx + s * 22, top - s * 0.6, s * 8, s * 2.2);
    ctx.fillStyle = '#c9bea2';
    blob(ctx, g.cx + s * 22, top - s * 0.9, s * 5.5, s * 1.4);
    ctx.fillStyle = '#8f9aa6';
    ctx.fillRect(g.cx + s * 19, top - s * 1.4, s * 8, s * 0.6);
    return c;
  }

  // ---- glass of shaved ice --------------------------------------------------

  function paintGlass(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = g.S * 1.3;
    const x = g.glassX;
    const base = g.tableY - s * 1.2;
    const rimY = base - s * 20;
    const rimW = s * 12;
    // puddle on the table
    ctx.fillStyle = '#c8432a';
    blob(ctx, x + s * 3, base + s * 0.3, s * 9, s * 1.3);
    ctx.fillStyle = 'rgba(230,238,240,0.6)';
    blob(ctx, x, base + s * 0.4, s * 7, s * 1.1);
    // foot and stem
    ctx.fillStyle = 'rgba(214,226,228,0.85)';
    blob(ctx, x, base, s * 7, s * 1.4);
    ctx.fillStyle = 'rgba(196,212,216,0.9)';
    ctx.fillRect(x - s * 1.2, base - s * 5, s * 2.4, s * 5);
    // bowl
    ctx.fillStyle = 'rgba(206,222,226,0.85)';
    poly(ctx, [x - rimW, rimY, x + rimW, rimY, x + s * 3, base - s * 5, x - s * 3, base - s * 5]);
    ctx.fillStyle = 'rgba(244,250,250,0.55)';
    poly(ctx, [x - rimW + s * 1.5, rimY, x - rimW + s * 4, rimY, x - s * 1.5, base - s * 6, x - s * 3, base - s * 6]);
    // ice mound
    ctx.fillStyle = '#f2f4f2';
    ctx.beginPath();
    ctx.moveTo(x - rimW - s * 1.5, rimY + s * 0.5);
    ctx.bezierCurveTo(x - rimW - s * 2, rimY - s * 10, x - s * 7, rimY - s * 17, x, rimY - s * 17.5);
    ctx.bezierCurveTo(x + s * 7, rimY - s * 17, x + rimW + s * 2, rimY - s * 10, x + rimW + s * 1.5, rimY + s * 0.5);
    ctx.closePath();
    ctx.fill();
    // ice shading
    ctx.fillStyle = '#cdd9de';
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI;
      const r = rand();
      blob(ctx, x + Math.cos(a) * rimW * 1.1 * r * (rand() < 0.5 ? 1 : -1), rimY - s * 2 - Math.sin(a) * s * 12 * r, s * 0.8, s * 0.5);
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) blob(ctx, x - s * 10 + rand() * s * 12, rimY - s * 5 - rand() * s * 11, s * 0.9, s * 0.5);
    // syrup poured on top
    ctx.fillStyle = '#d94a2a';
    ctx.beginPath();
    ctx.moveTo(x - s * 8, rimY - s * 12.5);
    ctx.bezierCurveTo(x - s * 6, rimY - s * 17.5, x + s * 6, rimY - s * 17.5, x + s * 8, rimY - s * 12);
    ctx.bezierCurveTo(x + s * 9, rimY - s * 8, x + s * 6, rimY - s * 9, x + s * 5, rimY - s * 5);
    ctx.bezierCurveTo(x + s * 4, rimY - s * 8, x + s * 2, rimY - s * 8, x + s * 1, rimY - s * 4);
    ctx.bezierCurveTo(x - s * 1, rimY - s * 9, x - s * 4, rimY - s * 8, x - s * 5, rimY - s * 6);
    ctx.bezierCurveTo(x - s * 6.5, rimY - s * 9, x - s * 8, rimY - s * 9, x - s * 8, rimY - s * 12.5);
    ctx.fill();
    ctx.fillStyle = '#f07a52';
    blob(ctx, x - s * 3, rimY - s * 14.5, s * 3, s * 1.1);
    // streaks of syrup down the mound
    ctx.fillStyle = '#e0522f';
    ctx.fillRect(x - s * 9, rimY - s * 7, s * 1.2, s * 6);
    ctx.fillRect(x + s * 8, rimY - s * 6, s * 1.2, s * 5);
    // spoon straw
    ctx.fillStyle = '#4e6a8f';
    ctx.save();
    ctx.translate(x + s * 5, rimY - s * 12);
    ctx.rotate(0.45);
    ctx.fillRect(0, -s * 12, s * 1.2, s * 14);
    ctx.fillRect(-s * 1.4, -s * 14, s * 4, s * 3);
    ctx.restore();
    ctx.fillStyle = 'rgba(232,242,244,0.5)';
    ctx.fillRect(x - rimW, rimY - s * 0.5, rimW * 2, s * 1);
    state.rimY = rimY;
    state.base = base;
    state.rimW = rimW;
    return c;
  }

  // ---- light ----------------------------------------------------------------

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const r = ctx.createRadialGradient(g.W * 0.82, g.H * 0.2, 0, g.W * 0.82, g.H * 0.2, g.W * 0.7);
    r.addColorStop(0, 'rgba(255,222,140,0.42)');
    r.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintBeams(g) {
    const w = Math.ceil(g.W * 1.6);
    const c = layer(w, g.H - g.edge);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,224,150,0.22)';
    const hh = g.H - g.edge;
    for (let i = 0; i < 4; i++) {
      const x = w * (0.1 + i * 0.25);
      const bw = g.S * (7 + i * 2);
      poly(ctx, [x, 0, x + bw, 0, x + bw - hh * 0.5, hh, x - hh * 0.5, hh]);
    }
    return c;
  }

  // ---- motion ---------------------------------------------------------------

  function drawChime(ctx, g, t, amount) {
    const s = g.S * 1.5;
    const hx = g.W * 0.27;
    const hy = g.eave;
    const sway = amount * (0.1 * Math.sin(t * 1.3) + 0.05 * Math.sin(t * 2.9 + 1)) + 0.02;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(sway);
    ctx.strokeStyle = '#d9d0b4';
    ctx.lineWidth = Math.max(1, s * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 7);
    ctx.stroke();
    // glass bell
    ctx.fillStyle = '#a9c7cf';
    ctx.beginPath();
    ctx.arc(0, s * 12, s * 5, Math.PI, 0);
    ctx.lineTo(s * 5.6, s * 12.8);
    ctx.lineTo(-s * 5.6, s * 12.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d5e7ea';
    blob(ctx, -s * 2, s * 9.8, s * 1.4, s * 2);
    ctx.fillStyle = '#5a7f8a';
    ctx.fillRect(-s * 5.6, s * 12.2, s * 11.2, s * 0.8);
    // clapper and strip
    ctx.fillStyle = '#6a5a48';
    ctx.fillRect(-s * 0.3, s * 12.8, s * 0.6, s * 3);
    ctx.fillStyle = '#e8ddc2';
    ctx.rotate(-sway * 0.8 + 0.07 * amount * Math.sin(t * 1.7 + 0.8));
    ctx.fillRect(-s * 1.8, s * 15, s * 3.6, s * 8);
    ctx.fillStyle = '#3e5280';
    ctx.fillRect(-s * 1.8, s * 15, s * 3.6, s * 0.9);
    ctx.fillRect(-s * 1.8, s * 22.1, s * 3.6, s * 0.9);
    ctx.restore();
  }

  function drawDrops(ctx, g, t, amount) {
    const s = g.S * 1.3;
    const x = g.glassX;
    const count = Math.min(DROPS, Math.round(DROPS * amount));
    const top = state.rimY - s * 4;
    const span = state.base - top - s * 2;
    for (let i = 0; i < count; i++) {
      const p = ((t / (7 + i * 2.3) + i * 0.37) % 1);
      const side = i % 2 ? 1 : -1;
      const ease = p * p;
      const wall = state.rimW * (1 - ease * 0.8) * 0.82;
      const dx = x + side * (wall + s * (0.8 + i * 0.4));
      const dy = top + span * (i === 0 ? ease : p) * 0.95;
      ctx.fillStyle = '#d94a2a';
      ctx.fillRect(dx - s * 0.3, top + span * 0.0 + (dy - top) * 0.3, s * 0.6, (dy - top) * 0.7);
      blob(ctx, dx, dy, s * 0.9, s * 1.2);
    }
  }

  function drawMotes(ctx, g, t, amount) {
    ctx.fillStyle = 'rgba(255,236,170,0.8)';
    const n = Math.round(MOTES * Math.min(1, amount));
    for (let i = 0; i < n; i++) {
      const m = state.motes[i];
      const x = (m.x * g.W + t * m.v * g.S) % g.W;
      const y = g.H * (0.2 + m.y * 0.5) + Math.sin(t * 0.6 + m.p) * g.S * 2;
      ctx.fillRect(x, y, g.S * 0.7, g.S * 0.7);
    }
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.garden = paintGarden(g, rand);
    state.maples = paintMaples(g, rand);
    state.veranda = paintVeranda(g, rand);
    state.table = paintTable(g);
    state.glass = paintGlass(g, rand);
    state.glow = paintGlow(g);
    state.beams = paintBeams(g);
    state.motes = [];
    for (let i = 0; i < MOTES; i++) state.motes.push({ x: rand(), y: rand(), v: 0.6 + rand() * 1.2, p: rand() * TAU });
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { chime, drips, glow } = api.props;
    ctx.drawImage(state.garden, 0, 0);
    const ripple = Math.sin(t * 0.7) * g.S * 0.5 * (0.5 + glow * 0.5) + Math.sin(t * 1.9) * g.S * 0.15;
    ctx.drawImage(state.maples.c, -state.maples.pad + ripple, 0);
    ctx.drawImage(state.veranda, 0, 0);
    ctx.globalAlpha = Math.min(1, 0.55 * glow + 0.15 * Math.sin(t * 0.4) * glow);
    const slide = (t * g.S * 0.8) % (g.W * 0.6);
    ctx.drawImage(state.beams, -slide, g.edge);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.table, 0, 0);
    ctx.drawImage(state.glass, 0, 0);
    drawDrops(ctx, g, t, drips);
    drawChime(ctx, g, t, chime);
    ctx.globalAlpha = Math.min(1, 0.7 * glow);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    drawMotes(ctx, g, t, glow);
  }

  Kasuri.run({
    defaults: { chime: 1, drips: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.3, gain: 1.25, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
