/*
 * 畳 Tatami — a mat room with paper sliding doors and a patch of sun.
 *
 * Room, doors, mats, cushion and tea tray are baked and repainted once a
 * minute from the clock. The sun patch and its beam are one baked layer that
 * creeps sideways. Between repaints only the bamboo shadow on the paper,
 * the beam, a handful of dust motes and the tea steam move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const FLOOR = 0.6;
  const EYE = 0.3;
  const TOP = 0.08;
  const CAM = 1.4;
  const Z_BACK = 7;
  const MAT_D = 0.9;
  const MAT_W = 1.8;
  const PANELS = 5;
  const OPEN_PANEL = 2;
  const OPEN_SHARE = 0.72;
  const MAX_MOTES = 112;
  const PUFFS = 5;
  const RETINT_SECONDS = 60;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const fy = H * FLOOR;
    const vy = H * EYE;
    return { W, H, U: H / 100, fy, vy, top: H * TOP, f: ((fy - vy) * Z_BACK) / CAM, pw: W / PANELS };
  }

  function proj(g, X, Z) {
    return [g.W / 2 + (X * g.f) / Z, g.vy + (CAM * g.f) / Z];
  }

  function quad(ctx, p) {
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function line(ctx, a, b, w) {
    ctx.lineWidth = Math.max(1, w);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  // ---- light from the clock -----------------------------------------------

  // Where the sun (or moon) stands, how strong, and what colour it throws.
  function lightAt(h, sky) {
    const sunMode = h >= 6 && h < 19.4;
    const late = h < 6 ? h + 24 : h;
    let k;
    if (sunMode) {
      k = smoothstep(5.8, 7.2, h) * (1 - smoothstep(18.2, 19.3, h)) * (0.6 + 0.4 * Math.sin(Math.PI * S.sunT(h)));
    } else {
      k = 0.55 * smoothstep(19.4, 21, late) * (1 - smoothstep(4.6, 5.8, h < 6 ? h : 99));
    }
    const warm = Math.max(smoothstep(15.5, 18.2, h), 1 - smoothstep(6.4, 8.6, h));
    const col = sunMode ? mixColor(rgb('#fff0cc'), rgb('#f2a258'), Math.min(1, warm)) : rgb('#aebbe0');
    const t = sunMode ? S.sunT(h) : S.moonT(h);
    return { k, col, t, sunMode, low: 1 - Math.sin(Math.PI * K.clamp(t, 0, 1)) };
  }

  // ---- walls and doors ------------------------------------------------------

  function tone(c, sky, depth) {
    return mixColor(c, rgb('#151a2c'), sky.night * depth);
  }

  function paintPanel(ctx, g, sky, x0, paper, wood) {
    const w = g.pw;
    const top = g.top;
    const h = g.fy - top;
    const stile = Math.max(1, g.U * 1.1);
    ctx.fillStyle = hex(wood);
    ctx.fillRect(x0, top, w, h);
    ctx.fillStyle = hex(paper);
    ctx.fillRect(x0 + stile, top + stile, w - stile * 2, h * 0.8 - stile);
    // Kumiko: three uprights and seven rails across the paper.
    ctx.fillStyle = hex(mixColor(wood, paper, 0.15));
    const bar = Math.max(1, g.U * 0.45);
    for (let i = 1; i < 4; i++) ctx.fillRect(x0 + (w * i) / 4 - bar / 2, top, bar, h * 0.8);
    for (let j = 1; j < 8; j++) ctx.fillRect(x0, top + (h * 0.8 * j) / 8 - bar / 2, w, bar);
    // The kick board below the paper, with a plain inset panel.
    const board = mixColor(wood, rgb('#8a6a46'), 0.25);
    ctx.fillStyle = hex(board);
    ctx.fillRect(x0 + stile, top + h * 0.8, w - stile * 2, h * 0.2 - stile);
    ctx.fillStyle = hex(mixColor(board, wood, 0.5));
    ctx.fillRect(x0 + stile * 2, top + h * 0.84, w - stile * 4, h * 0.12 - stile);
  }

  function paintGarden(ctx, g, sky, x0, w, rand) {
    const top = g.top;
    const h = g.fy - top;
    const grad = ctx.createLinearGradient(0, top, 0, g.fy);
    grad.addColorStop(0, hex(mixColor(sky.top, sky.low, 0.25)));
    grad.addColorStop(0.6, hex(mixColor(sky.low, sky.haze, 0.3)));
    ctx.fillStyle = grad;
    ctx.fillRect(x0, top, w, h);
    const dim = (c) => mixColor(c, rgb('#10141e'), sky.night * 0.75);
    // A far hedge of pine, a mossy mound, raked gravel.
    ctx.fillStyle = hex(dim(rgb('#4c6a48')));
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(x0 + rand() * w, top + h * (0.52 + rand() * 0.06), g.U * (2.4 + rand() * 2), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = hex(dim(rgb('#5f7a4a')));
    ctx.beginPath();
    ctx.ellipse(x0 + w * 0.35, g.fy - h * 0.07, w * 0.55, h * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hex(dim(rgb('#c9c4b0')));
    ctx.fillRect(x0, g.fy - h * 0.06, w, h * 0.06);
    ctx.fillStyle = hex(dim(rgb('#a8a28c')));
    for (let k = 0; k < 3; k++) ctx.fillRect(x0, g.fy - h * (0.045 - k * 0.016), w, 1);
    // Bamboo stalks with joints.
    for (let i = 0; i < 3; i++) {
      const bx = x0 + w * (0.2 + i * 0.3);
      const bw = Math.max(1.4, g.U * 1.3);
      ctx.fillStyle = hex(dim(rgb('#6d8650')));
      ctx.fillRect(bx, top, bw, h * 0.95);
      ctx.fillStyle = hex(dim(rgb('#415a34')));
      for (let n = 1; n < 6; n++) ctx.fillRect(bx - 0.5, top + (h * n) / 6.5, bw + 1, 1);
    }
    // A stone lantern base, a plain stack.
    ctx.fillStyle = hex(dim(rgb('#8c8a82')));
    const lx = x0 + w * 0.62;
    ctx.fillRect(lx, g.fy - h * 0.2, g.U * 2.2, h * 0.14);
    ctx.fillRect(lx - g.U * 0.8, g.fy - h * 0.26, g.U * 3.8, g.U * 1.8);
    ctx.fillRect(lx + g.U * 0.5, g.fy - h * 0.31, g.U * 1.2, g.U * 1.5);
  }

  function paintWall(ctx, g, sky, rand) {
    const wood = tone(rgb('#4a3626'), sky, 0.5);
    const paper = mixColor(mixColor(rgb('#efe6d0'), sky.amb, 0.45), rgb('#2a3050'), sky.night * 0.62);
    const x0 = g.pw * OPEN_PANEL;
    const gap = g.pw * OPEN_SHARE;
    paintGarden(ctx, g, sky, x0, gap, rand);
    for (let i = 0; i < PANELS; i++) if (i !== OPEN_PANEL) paintPanel(ctx, g, sky, i * g.pw, paper, wood);
    // The open panel has slid across, over its neighbour.
    ctx.fillStyle = 'rgba(20,14,8,0.35)';
    ctx.fillRect(x0 + gap - g.U * 0.6, g.top, g.U * 0.6, g.fy - g.top);
    paintPanel(ctx, g, sky, x0 + gap, paper, wood);
    // Ceiling board, lintel, posts and sill.
    ctx.fillStyle = hex(tone(rgb('#5a4430'), sky, 0.6));
    ctx.fillRect(0, 0, g.W, g.top * 0.55);
    ctx.fillStyle = hex(tone(rgb('#34261a'), sky, 0.5));
    ctx.fillRect(0, g.top * 0.55, g.W, g.top * 0.45);
    ctx.fillStyle = hex(tone(rgb('#3a2b1d'), sky, 0.5));
    const post = Math.max(2, g.U * 2.4);
    ctx.fillRect(0, 0, post, g.fy);
    ctx.fillRect(g.W - post, 0, post, g.fy);
    ctx.fillStyle = hex(tone(rgb('#2c2018'), sky, 0.5));
    ctx.fillRect(0, g.fy - g.U * 1.3, g.W, g.U * 1.3);
  }

  // ---- mats and things on them ---------------------------------------------

  function paintMats(ctx, g, sky, rand) {
    const straw = [rgb('#948f60'), rgb('#8a8658'), rgb('#9d9868')];
    ctx.fillStyle = hex(tone(rgb('#8f8a5c'), sky, 0.6));
    ctx.fillRect(0, g.fy, g.W, g.H - g.fy);
    for (let k = 0; k < 7; k++) {
      const za = Z_BACK - k * MAT_D;
      const zb = za - MAT_D;
      if (za < 2.6) break;
      const off = (k % 2) * MAT_D;
      for (let x = -5.4 + off; x < 5.4; x += MAT_W) {
        ctx.fillStyle = hex(tone(straw[Math.floor(rand() * 3)], sky, 0.45));
        quad(ctx, [proj(g, x, za), proj(g, x + MAT_W, za), proj(g, x + MAT_W, zb), proj(g, x, zb)]);
        ctx.strokeStyle = hex(tone(rgb('#7c774c'), sky, 0.6));
        line(ctx, proj(g, x + MAT_W, za), proj(g, x + MAT_W, zb), 1);
      }
      // Rush weave runs along each mat.
      ctx.strokeStyle = 'rgba(96,92,52,0.16)';
      for (let j = 1; j < 5; j++) {
        const z = za - (MAT_D * j) / 5;
        line(ctx, proj(g, -5.4, z), proj(g, 5.4, z), 1);
      }
    }
    // Dark cloth borders along the long edges.
    ctx.strokeStyle = hex(tone(rgb('#232a44'), sky, 0.5));
    for (let k = 1; k < 7; k++) {
      const z = Z_BACK - k * MAT_D;
      if (z < 2.4) break;
      line(ctx, proj(g, -5.4, z), proj(g, 5.4, z), (0.07 * g.f) / z);
    }
  }

  function paintCushion(ctx, g, sky) {
    const cx = -1.45;
    const cz = 4.7;
    const s = 0.42;
    const lift = (0.07 * g.f) / cz;
    const base = [proj(g, cx - s, cz + s), proj(g, cx + s, cz + s), proj(g, cx + s, cz - s), proj(g, cx - s, cz - s)];
    ctx.fillStyle = 'rgba(20,18,12,0.28)';
    quad(ctx, base.map((p) => [p[0] + g.U * 0.5, p[1] + g.U * 0.3]));
    ctx.fillStyle = hex(tone(rgb('#1d2a4a'), sky, 0.5));
    quad(ctx, base);
    const top = base.map((p) => [p[0], p[1] - lift]);
    ctx.fillStyle = hex(tone(rgb('#2d4068'), sky, 0.5));
    quad(ctx, [base[0], base[1], top[1], top[0]]);
    ctx.fillStyle = hex(tone(rgb('#42578a'), sky, 0.5));
    quad(ctx, top);
    ctx.strokeStyle = hex(tone(rgb('#4d6598'), sky, 0.5));
    const inset = top.map((p, i) => {
      const c = [(top[0][0] + top[2][0]) / 2, (top[0][1] + top[2][1]) / 2];
      return [lerp(p[0], c[0], 0.16), lerp(p[1], c[1], 0.16)];
    });
    for (let i = 0; i < 4; i++) line(ctx, inset[i], inset[(i + 1) % 4], 1);
    ctx.fillStyle = hex(tone(rgb('#b8452c'), sky, 0.5));
    const mid = [(top[0][0] + top[2][0]) / 2, (top[0][1] + top[2][1]) / 2];
    ctx.fillRect(mid[0] - 0.5, mid[1] - 0.5, Math.max(1.5, g.U * 0.5), Math.max(1.5, g.U * 0.5));
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TAU);
    ctx.fill();
  }

  function paintTea(ctx, g, sky) {
    const cx = 1.5;
    const cz = 4.1;
    const p = proj(g, cx, cz);
    const m = g.f / cz;
    const flat = 0.3;
    ctx.fillStyle = 'rgba(20,18,12,0.3)';
    ellipse(ctx, p[0] + g.U * 0.4, p[1] + g.U * 0.35, 0.24 * m, 0.24 * m * flat);
    ctx.fillStyle = hex(tone(rgb('#b8452c'), sky, 0.5));
    ellipse(ctx, p[0], p[1], 0.23 * m, 0.23 * m * flat);
    ctx.fillStyle = hex(tone(rgb('#1e1d26'), sky, 0.4));
    ellipse(ctx, p[0], p[1], 0.2 * m, 0.2 * m * flat);
    // The bowl: a moss glazed cup with green tea in it.
    const bh = 0.1 * m;
    const bx = p[0];
    const by = p[1] - 0.02 * m;
    ctx.fillStyle = hex(tone(rgb('#5f7a4a'), sky, 0.5));
    ctx.fillRect(bx - 0.08 * m, by - bh, 0.16 * m, bh);
    ellipse(ctx, bx, by, 0.08 * m, 0.08 * m * flat);
    ctx.fillStyle = hex(tone(rgb('#7e9660'), sky, 0.5));
    ellipse(ctx, bx, by - bh, 0.08 * m, 0.08 * m * flat);
    ctx.fillStyle = hex(tone(rgb('#a4b27c'), sky, 0.5));
    ellipse(ctx, bx, by - bh, 0.062 * m, 0.062 * m * flat);
    state.steamX = bx;
    state.steamY = by - bh;
  }

  // Window glow bleeds across the floor; the near edge falls into shade.
  function paintAir(ctx, g, sky) {
    const glow = mixColor(mixColor(rgb('#f4e8c8'), sky.amb, 0.4), rgb('#3a4466'), sky.night * 0.7);
    const grad = ctx.createLinearGradient(0, g.fy, 0, g.H);
    grad.addColorStop(0, rgba(glow, 0.06));
    grad.addColorStop(0.45, rgba(glow, 0.04));
    grad.addColorStop(1, 'rgba(18,14,10,0.36)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.fy, g.W, g.H - g.fy);
  }

  // ---- sun patch and beam ----------------------------------------------------

  function paintLight(g, h, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const L = lightAt(h, sky);
    state.lightK = L.k;
    state.quad = null;
    if (L.k < 0.02) return c;
    const half = 1.8;
    const xc = lerp(-3, 3, K.clamp(L.t, 0, 1));
    const len = 3 + L.low * 1.2;
    const shear = (0.5 - L.t) * 3 * (L.sunMode ? 1 : 0.6);
    const zf = Z_BACK - len;
    const b1 = proj(g, xc - half, Z_BACK);
    const b2 = proj(g, xc + half, Z_BACK);
    const f1 = proj(g, xc - half + shear, zf);
    const f2 = proj(g, xc + half + shear, zf);
    const a1 = [b1[0], g.top + g.U];
    const a2 = [b2[0], g.top + g.U];
    state.quad = { a1, a2, f1, f2 };
    // Beam first, then the lit patch, then the lattice shadow cut from it.
    const beam = ctx.createLinearGradient(0, a1[1], 0, f1[1]);
    beam.addColorStop(0, rgba(L.col, 0.26 * L.k));
    beam.addColorStop(0.6, rgba(L.col, 0.15 * L.k));
    beam.addColorStop(1, rgba(L.col, 0.05 * L.k));
    ctx.fillStyle = beam;
    quad(ctx, [a1, a2, f2, f1]);
    const pg = ctx.createLinearGradient(0, b1[1], 0, f1[1]);
    pg.addColorStop(0, rgba(L.col, 0.85 * L.k));
    pg.addColorStop(1, rgba(L.col, 0.6 * L.k));
    ctx.fillStyle = pg;
    quad(ctx, [b1, b2, f2, f1]);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const wide = i % 3 === 0 ? 0.09 : 0.045;
      const pb = proj(g, xc - half + 2 * half * u, Z_BACK);
      const pf = proj(g, xc - half + 2 * half * u + shear, zf);
      line(ctx, pb, pf, (wide * g.f) / ((Z_BACK + zf) / 2));
    }
    for (let j = 1; j < 8; j++) {
      const z = Z_BACK - (len * j) / 8;
      const sh = (shear * (Z_BACK - z)) / len;
      line(ctx, proj(g, xc - half + sh, z), proj(g, xc + half + sh, z), (0.05 * g.f) / z);
    }
    ctx.globalCompositeOperation = 'source-over';
    state.moteColor = hex(mixColor(L.col, rgb('#ffffff'), 0.4));
    return c;
  }

  function paintShadow(g, rand) {
    const margin = Math.ceil(g.U * 4);
    const hs = Math.ceil(g.fy - g.top);
    const c = layer(g.W + margin * 2, hs);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2c2a24';
    ctx.strokeStyle = '#2c2a24';
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = margin + (c.width - margin * 2) * ((i + 0.5 + (rand() - 0.5) * 0.5) / 6);
      ctx.lineWidth = Math.max(1, g.U * (1 + rand()));
      ctx.beginPath();
      ctx.moveTo(x, hs);
      ctx.lineTo(x + g.U * (rand() - 0.5) * 3, 0);
      ctx.stroke();
      for (let n = 0; n < 11; n++) {
        const y = hs * (0.04 + rand() * 0.62);
        const dir = rand() < 0.5 ? -1 : 1;
        const len = g.U * (5 + rand() * 6);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + dir * len * 0.6, y + len * 0.1, x + dir * len, y + len * (0.35 + rand() * 0.3));
        ctx.quadraticCurveTo(x + dir * len * 0.5, y + len * 0.25, x, y);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.fillRect(margin + g.pw * OPEN_PANEL - g.U, 0, g.pw * OPEN_SHARE + g.U * 2, hs);
    return { canvas: c, margin, height: hs };
  }

  function paintPuff() {
    const c = layer(24, 24);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    grad.addColorStop(0, 'rgba(240,238,228,0.5)');
    grad.addColorStop(1, 'rgba(240,238,228,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 24);
    return c;
  }

  // ---- bake -------------------------------------------------------------------

  function repaint(g, choice) {
    const h = S.hour(choice);
    const sky = S.at(h);
    const rand = K.rng(47);
    const back = layer(g.W, g.H);
    const ctx = back.getContext('2d');
    paintWall(ctx, g, sky, rand);
    paintMats(ctx, g, sky, rand);
    paintAir(ctx, g, sky);
    paintCushion(ctx, g, sky);
    paintTea(ctx, g, sky);
    state.back = back;
    state.light = paintLight(g, h, sky);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function seedMotes() {
    const rand = K.rng(91);
    for (let i = 0; i < MAX_MOTES; i++) {
      state.mu[i] = rand();
      state.mv[i] = rand();
      state.mp[i] = rand() * TAU;
      state.ms[i] = 0.5 + rand();
    }
  }

  // ---- motion -----------------------------------------------------------------

  function drawShadow(ctx, g, t) {
    const sh = state.shadow;
    const sway = Math.sin(t * 0.7) * g.U * 2 + Math.sin(t * 1.1 + 1) * g.U * 0.8;
    ctx.globalAlpha = 0.12 + 0.2 * state.lightK;
    ctx.drawImage(sh.canvas, sh.margin + sway, 0, g.W, sh.height, 0, g.top, g.W, sh.height);
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t, count, dx) {
    const q = state.quad;
    if (!q || count < 1) return;
    const size = Math.max(1, g.U * 0.5);
    ctx.fillStyle = state.moteColor;
    for (let i = 0; i < count; i++) {
      const u = state.mu[i] + Math.sin(t * 0.21 * state.ms[i] + state.mp[i]) * 0.04;
      const v = (state.mv[i] + t * 0.006 * state.ms[i] + Math.sin(t * 0.17 + state.mp[i]) * 0.03) % 1;
      const ax = lerp(q.a1[0], q.a2[0], u);
      const fx = lerp(q.f1[0], q.f2[0], u);
      const x = lerp(ax, fx, v) + dx;
      const y = lerp(q.a1[1], q.f1[1], v);
      ctx.globalAlpha = Math.sin(Math.PI * v) * (0.35 + 0.35 * Math.sin(t * 0.6 * state.ms[i] + state.mp[i])) * Math.min(1, state.lightK * 2.2);
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawSteam(ctx, g, t) {
    for (let i = 0; i < PUFFS; i++) {
      const a = (t * 0.1 + i / PUFFS) % 1;
      const size = g.U * (1.6 + a * 3.4);
      const x = state.steamX + Math.sin(t * 0.7 + i * 2.1) * g.U * 0.9 * a;
      const y = state.steamY - a * g.U * 11;
      ctx.globalAlpha = Math.sin(Math.PI * a) * 0.7 * (1 - state.night * 0.4);
      ctx.drawImage(state.puff, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.mu = new Float32Array(MAX_MOTES);
    state.mv = new Float32Array(MAX_MOTES);
    state.mp = new Float32Array(MAX_MOTES);
    state.ms = new Float32Array(MAX_MOTES);
    seedMotes();
    state.shadow = paintShadow(g, K.rng(13));
    state.puff = paintPuff();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    if (props.shadows) drawShadow(ctx, g, t);
    const dx = Math.sin(t * 0.15) * g.W * 0.035;
    ctx.globalAlpha = 0.93 + 0.07 * Math.sin(t * 0.4);
    ctx.drawImage(state.light, dx, 0);
    ctx.globalAlpha = 1;
    drawMotes(ctx, g, t, Math.round(56 * props.dust), dx);
    drawSteam(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', dust: 1, shadows: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
