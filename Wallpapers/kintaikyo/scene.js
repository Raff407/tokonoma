/*
 * 錦帯橋 Kintaikyo — the five-arched wooden bridge at Iwakuni, the castle on
 * its hill behind, a clear river below.
 *
 * Sky, hills, bridge and banks are baked into layers and repainted once a
 * minute from the clock. The water layer is drawn in thin shifting strips.
 * Between repaints only clouds, ripples, glints, petals and an egret move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const FAR_BANK = 0.6;
  const WATERLINE = 0.76;
  const DECK_BASE = 0.635;
  const SPAN_X = [0.1, 0.9];
  const SPAN_RISE = [0.05, 0.09, 0.11, 0.09, 0.05];
  const PEAK = { x: 0.68, y: 0.31 };
  const RETINT_SECONDS = 60;
  const PETALS = 14;
  const GLINTS = 18;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour of something lit by the sky: pulled toward the ambient tint, darkened at night.
  function tone(sky, h, night, amb) {
    const base = mixColor(rgb(h), sky.amb, amb === undefined ? 0.18 : amb);
    return hex(mixColor(base, rgb('#10142a'), sky.night * (night === undefined ? 0.62 : night)));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * FAR_BANK);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    return c;
  }

  function paintLuminary(ctx, g, sky) {
    const day = sky.night < 0.5;
    const t = day ? S.sunT(sky.hour) : S.moonT(sky.hour);
    const cx = g.W * lerp(0.12, 0.88, t);
    const cy = g.H * (0.5 - 0.36 * Math.sin(Math.PI * t));
    const r = g.U * (day ? 5 : 3.2);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 6);
    glow.addColorStop(0, day ? 'rgba(244,196,130,0.55)' : 'rgba(210,214,230,0.28)');
    glow.addColorStop(1, 'rgba(244,196,130,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 6, cy - r * 6, r * 12, r * 12);
    ctx.fillStyle = day ? '#f4d6a0' : '#e8e6da';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
  }

  function paintClouds(w, h, sky) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tint = mixColor(rgb('#f4efe4'), sky.amb, 0.55).map((v) => v * (1 - sky.night * 0.65));
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 21);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.52, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- hills and castle --------------------------------------------------

  function ridgeY(g, x) {
    const base = g.H * FAR_BANK;
    const main = g.H * (FAR_BANK - PEAK.y) * Math.exp(-Math.pow((x - g.W * PEAK.x) / (g.W * 0.2), 2));
    const left = g.H * 0.15 * Math.exp(-Math.pow((x - g.W * 0.22) / (g.W * 0.17), 2));
    const wave = (fbm(x * 0.05, 3, 3, 7) - 0.5) * g.U * 2.2;
    return base - Math.max(main, left) - g.H * 0.03 + wave;
  }

  function paintFarHills(ctx, g, sky) {
    ctx.fillStyle = tone(sky, '#5a6a8a', 0.5, 0.22);
    ctx.globalAlpha = 0.8;
    for (let x = 0; x < g.W; x++) {
      const y = g.H * 0.4 + Math.sin(x * 0.011 + 1) * g.U * 3 + Math.sin(x * 0.027) * g.U * 1.6 + (fbm(x * 0.04, 1, 3, 3) - 0.5) * g.U * 3;
      ctx.fillRect(x, y, 1, g.H * FAR_BANK - y);
    }
    ctx.globalAlpha = 1;
  }

  function paintHill(ctx, g, sky) {
    const bank = g.H * FAR_BANK;
    for (let x = 0; x < g.W; x++) {
      const top = ridgeY(g, x);
      const lit = 0.5 + 0.5 * smoothstep(-g.W * 0.3, g.W * 0.2, g.W * PEAK.x - x);
      for (let y = Math.floor(top); y < bank; y += 2) {
        const f = (y - top) / Math.max(1, bank - top);
        const speck = fbm(x * 0.35, y * 0.3, 2, 13);
        const h = speck > 0.62 ? '#2f4a2c' : speck < 0.36 ? '#4a6234' : '#3c5a38';
        const c = mixColor(mixColor(rgb(h), rgb('#2c3a52'), f * 0.35), rgb('#c9a35a'), (1 - f) * 0.1 * lit);
        ctx.fillStyle = hex(mixColor(mixColor(c, sky.amb, 0.16), rgb('#0e1226'), sky.night * 0.65));
        ctx.fillRect(x, y, 1, 2);
      }
    }
  }

  function roof(ctx, cx, yb, w, h, u, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 1.3 * u, yb - 0.3 * u);
    ctx.lineTo(cx - w * 0.28, yb - h);
    ctx.lineTo(cx + w * 0.28, yb - h);
    ctx.lineTo(cx + w / 2 + 1.3 * u, yb - 0.3 * u);
    ctx.lineTo(cx + w / 2, yb + 0.7 * u);
    ctx.lineTo(cx - w / 2, yb + 0.7 * u);
    ctx.closePath();
    ctx.fill();
  }

  function paintCastle(ctx, g, sky) {
    const u = g.U;
    const cx = g.W * PEAK.x;
    const ground = ridgeY(g, cx) + u * 0.6;
    const wall = tone(sky, '#e9e4d4', 0.55, 0.2);
    const tile = tone(sky, '#3a3f4c', 0.35, 0.1);
    const stone = tone(sky, '#7b7a72', 0.5, 0.15);
    ctx.fillStyle = stone;
    ctx.fillRect(cx - 10 * u, ground - 1.6 * u, 20 * u, 3 * u);
    // Low wing to the left and the stacked keep.
    ctx.fillStyle = wall;
    ctx.fillRect(cx - 9 * u, ground - 4 * u, 6 * u, 2.4 * u);
    roof(ctx, cx - 6 * u, ground - 4 * u, 6.6 * u, 1.7 * u, u, tile);
    let y = ground - 1.6 * u;
    const tiers = [[8, 4], [5.6, 3.2], [3.8, 2.8]];
    for (let i = 0; i < tiers.length; i++) {
      const w = tiers[i][0] * u;
      const h = tiers[i][1] * u;
      ctx.fillStyle = wall;
      ctx.fillRect(cx - w / 2, y - h, w, h);
      y -= h;
      roof(ctx, cx, y, w + 1.4 * u, 1.9 * u, u, tile);
      ctx.fillStyle = tile;
      ctx.fillRect(cx - w * 0.5, y + 0.4 * u, w, 0.35 * u);
      y -= 1.4 * u;
    }
    ctx.fillStyle = tone(sky, '#c9a35a', 0.2, 0.1);
    ctx.fillRect(cx - 3 * u, y + 0.3 * u, 0.6 * u, 1.1 * u);
    ctx.fillRect(cx + 2.4 * u, y + 0.3 * u, 0.6 * u, 1.1 * u);
    if (sky.night > 0.35) {
      ctx.fillStyle = '#e0b866';
      ctx.fillRect(cx - 0.4 * u, ground - 4.2 * u, 0.8 * u, 1.1 * u);
      ctx.fillRect(cx - 0.4 * u, ground - 7.6 * u, 0.8 * u, 0.9 * u);
    }
  }

  // ---- bridge ------------------------------------------------------------

  function spanOf(g, x) {
    const a = g.W * SPAN_X[0];
    const w = (g.W * (SPAN_X[1] - SPAN_X[0])) / 5;
    const k = Math.min(4, Math.max(0, Math.floor((x - a) / w)));
    return { k, u: Math.min(1, Math.max(0, (x - a - k * w) / w)) };
  }

  function deckY(g, x) {
    const s = spanOf(g, x);
    const c = 1 - Math.pow(Math.abs(2 * s.u - 1), 1.7);
    return g.H * (DECK_BASE - SPAN_RISE[s.k] * c);
  }

  function paintPiers(ctx, g, sky) {
    const u = g.U;
    const top = g.H * DECK_BASE;
    const bot = g.H * WATERLINE;
    const stone = tone(sky, '#8a877c', 0.55, 0.15);
    const dark = tone(sky, '#5c5b56', 0.55, 0.1);
    for (let k = 1; k <= 4; k++) {
      const px = g.W * (SPAN_X[0] + ((SPAN_X[1] - SPAN_X[0]) * k) / 5);
      const hw = g.W * 0.013;
      ctx.fillStyle = stone;
      ctx.beginPath();
      ctx.moveTo(px - hw, top);
      ctx.lineTo(px + hw, top);
      ctx.lineTo(px + hw * 1.15, bot);
      ctx.lineTo(px - hw * 1.15, bot);
      ctx.fill();
      ctx.fillStyle = dark;
      for (let y = top + 2.2 * u; y < bot; y += 2.2 * u) ctx.fillRect(px - hw, y, hw * 2.2, 1);
      ctx.fillRect(px + hw * 0.4, top, hw * 0.6, bot - top);
      ctx.fillStyle = tone(sky, '#3c5a38', 0.6, 0.1);
      ctx.fillRect(px - hw * 1.15, bot - 1.2 * u, hw * 2.3, 1.2 * u);
      ctx.fillStyle = 'rgba(240,238,228,0.6)';
      ctx.fillRect(px - hw * 1.6, bot, hw * 3.2, Math.max(1, u * 0.5));
    }
  }

  function paintDeck(ctx, g, sky) {
    const u = g.U;
    const pierTop = g.H * DECK_BASE;
    const x0 = Math.floor(g.W * SPAN_X[0]);
    const x1 = Math.ceil(g.W * SPAN_X[1]);
    const deck = tone(sky, '#b08a5c', 0.5, 0.2);
    const beam = tone(sky, '#5a3a26', 0.45, 0.12);
    const rail = tone(sky, '#7a2a1c', 0.4, 0.1);
    const post = Math.max(3, Math.round(u * 2.2));
    for (let x = x0; x < x1; x++) {
      const yt = deckY(g, x);
      const band = Math.min(yt + 3.6 * u, pierTop) - yt;
      ctx.fillStyle = deck;
      ctx.fillRect(x, yt, 1, Math.max(1, u * 0.9));
      ctx.fillStyle = beam;
      ctx.fillRect(x, yt + u * 0.9, 1, Math.max(0, band - u * 0.9));
      const rib = Math.min(yt + 7 * u, pierTop);
      ctx.fillRect(x, rib, 1, 1);
      ctx.fillRect(x, rib + 1.2 * u > pierTop ? rib : rib + 1.2 * u, 1, 1);
      ctx.fillStyle = rail;
      ctx.fillRect(x, yt - 2.4 * u, 1, 1);
      if (x % post === 0) ctx.fillRect(x, yt - 2.4 * u, 1, 2.4 * u);
      if (x % (post * 2) === 0) ctx.fillRect(x, yt + 3.6 * u > pierTop ? pierTop : yt + 3.6 * u, 1, Math.max(0, rib - yt - 3.6 * u));
    }
    if (sky.night > 0.3) {
      ctx.fillStyle = '#e0b866';
      for (let x = x0 + post * 4; x < x1; x += post * 8) ctx.fillRect(x, deckY(g, x) - 3.6 * u, Math.max(1, u * 0.7), Math.max(1, u * 0.9));
    }
  }

  // ---- banks and trees ---------------------------------------------------

  function paintBanks(ctx, g, sky) {
    const u = g.U;
    const top = g.H * DECK_BASE;
    const bot = g.H * WATERLINE;
    const ends = [[0, g.W * SPAN_X[0]], [g.W * SPAN_X[1], g.W]];
    for (const e of ends) {
      ctx.fillStyle = tone(sky, '#7c786a', 0.55, 0.15);
      ctx.fillRect(e[0], top, e[1] - e[0], bot - top);
      ctx.fillStyle = tone(sky, '#58564e', 0.55, 0.1);
      for (let y = top + 2.2 * u; y < bot; y += 2.2 * u) ctx.fillRect(e[0], y, e[1] - e[0], 1);
      ctx.fillStyle = tone(sky, '#4a6234', 0.62, 0.12);
      ctx.fillRect(e[0], top - 0.8 * u, e[1] - e[0], 1.6 * u);
      ctx.fillStyle = tone(sky, '#3c5a38', 0.6, 0.1);
      ctx.fillRect(e[0], bot - 1.2 * u, e[1] - e[0], 1.2 * u);
    }
  }

  function blossom(ctx, g, sky, rand, cx, cy, spread, count) {
    const u = g.U;
    ctx.fillStyle = tone(sky, '#4a3a30', 0.55, 0.1);
    ctx.fillRect(cx - u * 0.7, cy - spread * 0.9, u * 1.4, spread * 0.9 + u);
    ctx.fillRect(cx - spread * 0.6, cy - spread * 1.25, spread * 0.9, u * 0.6);
    for (let i = 0; i < count; i++) {
      const a = rand() * 6.3;
      const r = Math.sqrt(rand()) * spread;
      const pick = rand();
      ctx.fillStyle = tone(sky, pick > 0.7 ? '#efe0dc' : pick > 0.25 ? '#dfb6b8' : '#c98e98', 0.6, 0.14);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 1.3, cy - spread * 1.5 + Math.sin(a) * r * 0.8, u * (1.1 + rand() * 1.3), 0, 6.3);
      ctx.fill();
    }
  }

  function pine(ctx, g, sky, rand, cx, base, size) {
    const u = g.U;
    ctx.fillStyle = tone(sky, '#3a2c24', 0.55, 0.1);
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.9, base);
    ctx.lineTo(cx - u * 0.3, base - size * 1.4);
    ctx.lineTo(cx + u * 0.6, base - size * 1.4);
    ctx.lineTo(cx + u * 1.1, base);
    ctx.fill();
    const pads = [[-0.6, 1.5, 3.2], [0.5, 1.1, 2.7], [-0.1, 1.9, 2.3], [0.8, 0.7, 2]];
    for (const p of pads) {
      ctx.fillStyle = tone(sky, rand() > 0.5 ? '#2f4a2c' : '#3a5a34', 0.62, 0.12);
      const px = cx + p[0] * size;
      const py = base - p[1] * size;
      ctx.beginPath();
      ctx.ellipse(px, py, size * p[2] * 0.5, size * 0.38, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function maple(ctx, g, sky, rand, cx, base, size) {
    const u = g.U;
    ctx.fillStyle = tone(sky, '#4a3a30', 0.55, 0.1);
    ctx.fillRect(cx - u * 0.5, base - size * 1.1, u, size * 1.1);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = tone(sky, rand() > 0.35 ? '#b8442c' : '#c98a3a', 0.58, 0.14);
      ctx.beginPath();
      ctx.arc(cx + (rand() - 0.5) * size * 1.7, base - size * (1.1 + rand() * 0.9), u * (0.9 + rand() * 1.1), 0, 6.3);
      ctx.fill();
    }
  }

  function paintTrees(ctx, g, sky, rand) {
    const u = g.U;
    const top = g.H * DECK_BASE;
    blossom(ctx, g, sky, rand, g.W * 0.05, top, u * 6, 46);
    blossom(ctx, g, sky, rand, g.W * 0.022, top, u * 4.4, 24);
    pine(ctx, g, sky, rand, g.W * 0.945, top, u * 5.4);
    maple(ctx, g, sky, rand, g.W * 0.915, top, u * 3.8);
    pine(ctx, g, sky, rand, g.W * 0.985, top, u * 4);
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, hillLayer, bridgeLayer, rand) {
    const m = state.margin;
    const c = layer(g.W + m * 2, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * FAR_BANK;
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, hex(mixColor(mixColor(sky.low, rgb('#4a6a84'), 0.55), rgb('#141a30'), sky.night * 0.6)));
    grad.addColorStop(1, hex(mixColor(mixColor(sky.top, rgb('#24385a'), 0.7), rgb('#0c1020'), sky.night * 0.6)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, c.width, g.H - y0);
    // The hill and bridge upside down, softened.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, c.width, g.H - y0);
    ctx.clip();
    ctx.globalAlpha = 0.4;
    ctx.translate(m, y0);
    ctx.scale(1, -0.55);
    ctx.drawImage(hillLayer, 0, -y0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, c.width, g.H - y0);
    ctx.clip();
    ctx.globalAlpha = 0.55;
    ctx.translate(m, g.H * WATERLINE * 2);
    ctx.scale(1, -1);
    ctx.drawImage(bridgeLayer, 0, 0);
    ctx.restore();
    // Fine streaks of light on the surface.
    ctx.fillStyle = hex(mixColor(sky.low, rgb('#f0ece0'), 0.5));
    for (let i = 0; i < g.W * 1.2; i++) {
      const y = y0 + (g.H - y0) * rand();
      ctx.globalAlpha = 0.08 + rand() * 0.14;
      ctx.fillRect(rand() * c.width, y, g.U * (1 + rand() * 4), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    const hills = layer(g.W, g.H);
    const hctx = hills.getContext('2d');
    paintFarHills(hctx, g, sky);
    paintHill(hctx, g, sky);
    paintCastle(hctx, g, sky);
    const bridge = layer(g.W, g.H);
    const bctx = bridge.getContext('2d');
    paintBanks(bctx, g, sky);
    paintPiers(bctx, g, sky);
    paintDeck(bctx, g, sky);
    paintTrees(bctx, g, sky, rand);
    state.sky = paintSky(g, sky, rand);
    state.hills = hills;
    state.bridge = bridge;
    state.water = paintWater(g, sky, hills, bridge, rand);
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28), sky);
    state.cloudAlpha = 0.8 - sky.night * 0.4;
    state.dim = sky.night;
    state.glint = sky.night > 0.5 ? '#d8d8e4' : '#f6e6c0';
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  function drawWater(ctx, g, t, amount) {
    const y0 = Math.floor(g.H * FAR_BANK);
    const m = state.margin;
    const w = state.water;
    for (let y = y0; y < g.H; y += 2) {
      const depth = (y - y0) / (g.H - y0);
      const dx = Math.sin(t * 1.3 + y * 0.45) * g.U * (0.15 + depth * 0.7) * amount;
      ctx.drawImage(w, 0, y, w.width, 2, -m + dx, y, w.width, 2);
    }
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    const y0 = g.H * FAR_BANK;
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const phase = (t * 0.22 + state.glintSeed[i * 3]) % 1;
      const a = Math.sin(phase * Math.PI);
      ctx.globalAlpha = a * 0.5 * Math.min(1, amount);
      const y = y0 + (g.H - y0) * (0.1 + state.glintSeed[i * 3 + 1] * 0.88);
      ctx.fillRect(g.W * state.glintSeed[i * 3 + 2], y, g.U * (1.2 + a * 1.6), Math.max(1, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function drawPetals(ctx, g, t) {
    ctx.fillStyle = '#e6c6c6';
    for (let i = 0; i < PETALS; i++) {
      const seed = state.petalSeed[i];
      const p = (t * (0.012 + seed * 0.012) + seed * 7) % 1;
      const px = g.W * (0.04 + p * 0.5) + Math.sin(t * 0.8 + seed * 20) * g.U * 2;
      const py = g.H * (0.35 + p * 0.3) + Math.cos(t * 0.6 + seed * 11) * g.U;
      ctx.globalAlpha = Math.sin(p * Math.PI) * (1 - state.dim * 0.45);
      ctx.fillRect(px, py, Math.max(1, g.U * 0.7), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  // An egret crosses the sky now and then, wings slowly beating.
  function drawEgret(ctx, g, t) {
    const cycle = 80;
    const p = (t % cycle) / 52;
    if (p >= 1) return;
    const u = g.U;
    const x = lerp(-g.W * 0.04, g.W * 1.04, p);
    const y = g.H * 0.27 + Math.sin(p * 9) * u * 1.2 - p * u * 3;
    const flap = Math.sin(t * 3.4) * u * 1.6;
    ctx.fillStyle = state.dim > 0.5 ? '#c8c8d2' : '#f0ece0';
    ctx.fillRect(x - u * 1.4, y - u * 0.4, u * 2.8, u * 0.9);
    ctx.fillRect(x + u * 1.4, y - u * 1.0, u * 0.5, u * 0.8);
    ctx.fillRect(x + u * 1.8, y - u * 1.0, u * 0.9, u * 0.35);
    ctx.fillRect(x - u * 3.2, y, u * 1.8, u * 0.25);
    ctx.beginPath();
    ctx.moveTo(x - u * 0.6, y - u * 0.2);
    ctx.lineTo(x - u * 0.2, y - u * 2.4 - flap);
    ctx.lineTo(x + u * 0.8, y - u * 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - u * 0.6, y);
    ctx.lineTo(x - u * 0.9, y + u * 1.0 + flap * 0.4);
    ctx.lineTo(x + u * 0.7, y + u * 0.1);
    ctx.fill();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.margin = Math.ceil(g.U * 3);
    const rand = K.rng(api.seed || 5);
    state.glintSeed = new Float32Array(GLINTS * 3);
    for (let i = 0; i < state.glintSeed.length; i++) state.glintSeed[i] = rand();
    state.petalSeed = new Float32Array(PETALS);
    for (let i = 0; i < PETALS; i++) state.petalSeed[i] = rand();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    if (props.egret) drawEgret(ctx, g, t);
    ctx.drawImage(state.hills, 0, 0);
    drawWater(ctx, g, t, props.ripple);
    drawGlints(ctx, g, t, props.ripple);
    ctx.drawImage(state.bridge, 0, 0);
    drawPetals(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', ripple: 1, clouds: 1, egret: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
