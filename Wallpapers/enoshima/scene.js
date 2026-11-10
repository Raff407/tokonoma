/*
 * 江ノ島 Enoshima — a pine island tied to the shore by a long bridge, Fuji
 * dark across the bay at sunset.
 *
 * Sky, sea, mountain, island and shore are baked into layers and repainted
 * once a minute from the clock. Between repaints only clouds, wave strips,
 * three kites and a few gulls move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.56;
  const FUJI = { x: 0.3, y: 0.27 };
  const ISLE = { x: 0.74, half: 0.17, top: 0.4, foot: 0.63 };
  const RETINT_SECONDS = 60;
  const GULLS = 6;
  const KITES = [
    { x: 0.62, y: 0.17, ink: '#c8453a', phase: 0.3 },
    { x: 0.82, y: 0.26, ink: '#e8e2d0', phase: 2.1 },
    { x: 0.48, y: 0.09, ink: '#2f4c8a', phase: 4.0 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const dusk = (c, sky, k) => hex(mixColor(c, sky, k));

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintSun(ctx, g, sky);
    return c;
  }

  function paintSun(ctx, g, sky) {
    const h = sky.hour;
    const day = h >= 6 && h <= 19.5;
    const t = day ? S.sunT(h) : S.moonT(h);
    const sx = g.W * (0.18 + 0.7 * t);
    const low = Math.abs(t - 0.5) * 2;
    const sy = g.H * (HORIZON - 0.04 - (1 - low * low) * 0.3 * (day ? 1 : 0.8));
    const r = g.U * (day ? 4.2 : 3);
    state.sunX = sx;
    state.sunY = sy;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 6);
    halo.addColorStop(0, day ? 'rgba(255,214,150,0.55)' : 'rgba(220,226,240,0.25)');
    halo.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - r * 6, sy - r * 6, r * 12, r * 12);
    ctx.fillStyle = day ? '#f4d9a0' : '#e8eaee';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, 6.3);
    ctx.fill();
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.08, 4, 33), fbm((x - w) * 0.012, y * 0.08, 4, 33), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 250;
        img.data[i + 1] = 226;
        img.data[i + 2] = 210;
        img.data[i + 3] = smoothstep(0.52, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- sea and Fuji ------------------------------------------------------

  function paintSea(ctx, g, sky) {
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, rgb('#4f6286'), 0.35)));
    grad.addColorStop(0.35, hex(mixColor(rgb('#3a4f7a'), sky.top, 0.35)));
    grad.addColorStop(1, hex(mixColor(rgb('#1d2c52'), sky.top, 0.3)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Sun path on the water: short bright dashes, widening toward the viewer.
    const glow = 1 - state.sunLow * 0.0;
    ctx.fillStyle = state.day ? '#f6cf92' : '#d8deee';
    for (let y = Math.ceil(top) + 1; y < g.H * 0.9; y += 2) {
      const k = (y - top) / (g.H * 0.34);
      const n = fbm(y * 0.4, 3, 2, 17);
      const half = g.U * (1.5 + k * 9) * (0.4 + n);
      ctx.globalAlpha = Math.max(0, (0.55 - k * 0.5)) * glow * (state.day ? 1 : 0.5);
      ctx.fillRect(state.sunX - half, y, half * 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function fujiRidge(g, x) {
    const px = g.W * FUJI.x;
    const half = g.W * (x < px ? 0.34 : 0.4);
    const d = Math.max(0, Math.abs(x - px) - g.W * 0.015) / half;
    const base = g.H * HORIZON;
    const top = g.H * FUJI.y;
    return base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.9) + (fbm(x * 0.07, 2, 3, 5) - 0.5) * g.U * 0.7;
  }

  function paintFuji(ctx, g, sky) {
    const base = g.H * HORIZON;
    const snowLine = g.H * (FUJI.y + (HORIZON - FUJI.y) * 0.3);
    const body = mixColor(mixColor(rgb('#3f4b72'), sky.haze, 0.5), rgb('#1c2240'), sky.night * 0.6);
    const snow = mixColor(mixColor(rgb('#e8e2d8'), sky.amb, 0.45), sky.top, 0.1 + sky.night * 0.3);
    const x0 = Math.floor(g.W * 0.0);
    const x1 = Math.ceil(g.W * 0.75);
    for (let x = x0; x < x1; x++) {
      const top = fujiRidge(g, x);
      if (top >= base) continue;
      const jag = (fbm(x * 0.25, 7, 2, 9) - 0.5) * g.U * 4;
      const line = snowLine + jag;
      ctx.fillStyle = hex(body);
      ctx.fillRect(x, top, 1, base - top);
      if (top < line) {
        ctx.fillStyle = hex(snow);
        ctx.fillRect(x, top, 1, line - top);
      }
    }
    // Haze where the mountain meets the water.
    const fog = ctx.createLinearGradient(0, base - g.U * 7, 0, base);
    fog.addColorStop(0, hex(sky.low) + '00');
    fog.addColorStop(1, hex(sky.low) + 'cc');
    ctx.fillStyle = fog;
    ctx.fillRect(x0, base - g.U * 7, x1 - x0, g.U * 7);
  }

  // ---- island ------------------------------------------------------------

  function isleTop(g, x) {
    const px = g.W * ISLE.x;
    const half = g.W * ISLE.half;
    const d = Math.abs(x - px) / half;
    if (d >= 1) return g.H;
    const base = g.H * ISLE.foot;
    const top = g.H * ISLE.top;
    return base - (base - top) * Math.pow(1 - d * d, 0.8) + (fbm(x * 0.12, 5, 3, 4) - 0.5) * g.U * 1.6;
  }

  function pine(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x - s * 0.12, y - s * 1.6, s * 0.24, s * 1.6);
    ctx.beginPath();
    ctx.ellipse(x, y - s * 1.7, s * 1.1, s * 0.4, 0, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.2, y - s * 1.1, s * 0.8, s * 0.3, 0, 0, 6.3);
    ctx.fill();
  }

  function paintIsland(ctx, g, sky, rand) {
    const rock = mixColor(mixColor(rgb('#26304a'), sky.haze, 0.2), rgb('#10142a'), sky.night * 0.6);
    const moss = mixColor(mixColor(rgb('#2f4a36'), sky.haze, 0.25), rgb('#101a1e'), sky.night * 0.7);
    const px = g.W * ISLE.x;
    const half = g.W * ISLE.half;
    const foot = g.H * ISLE.foot;
    for (let x = Math.floor(px - half); x < Math.ceil(px + half); x++) {
      const top = isleTop(g, x);
      if (top >= foot) continue;
      ctx.fillStyle = hex(moss);
      ctx.fillRect(x, top, 1, Math.min(g.U * 5, foot - top));
      ctx.fillStyle = hex(rock);
      ctx.fillRect(x, top + g.U * 5, 1, Math.max(0, foot - top - g.U * 5));
    }
    // Pines along the crest and flanks, as flat tiered clouds.
    const tree = hex(mixColor(moss, rgb('#0c1218'), 0.45));
    for (let i = 0; i < 26; i++) {
      const x = px - half * 0.9 + rand() * half * 1.8;
      const y = isleTop(g, x) + g.U * 0.8;
      if (y >= foot - 1) continue;
      pine(ctx, x, y, g.U * (1.2 + rand() * 1.1), tree);
    }
    paintLighthouse(ctx, g, sky);
    paintShrine(ctx, g, sky);
    // Surf line at the foot.
    ctx.fillStyle = 'rgba(240,236,224,0.35)';
    ctx.fillRect(px - half * 0.95, foot - 1, half * 1.9, 1);
  }

  function paintLighthouse(ctx, g, sky) {
    const x = g.W * (ISLE.x + 0.025);
    const base = isleTop(g, x) + g.U;
    const h = g.U * 14;
    const w = g.U * 1.5;
    ctx.fillStyle = dusk(rgb('#ece8dc'), sky.haze, 0.2 + sky.night * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - w, base);
    ctx.lineTo(x - w * 0.6, base - h);
    ctx.lineTo(x + w * 0.6, base - h);
    ctx.lineTo(x + w, base);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#2a2e44'), sky.haze, 0.2));
    ctx.fillRect(x - w * 0.9, base - h - g.U * 1.6, w * 1.8, g.U * 1.6);
    ctx.fillStyle = state.day && sky.night < 0.4 ? '#d9a73a' : '#f4d98a';
    ctx.fillRect(x - w * 0.55, base - h - g.U * 1.3, w * 1.1, g.U);
  }

  // Small shrine: vermilion torii on the left slope, hip-roofed hall beside the tower.
  function paintShrine(ctx, g, sky) {
    const ink = hex(mixColor(rgb('#201a22'), sky.haze, 0.2));
    const vermilion = dusk(rgb('#c8452c'), sky.haze, 0.18 + sky.night * 0.4);
    const tx = g.W * (ISLE.x - 0.07);
    const ty = isleTop(g, tx) + g.U * 2.5;
    const s = g.U;
    ctx.fillStyle = vermilion;
    ctx.fillRect(tx - s * 2, ty - s * 6, s * 0.7, s * 6);
    ctx.fillRect(tx + s * 1.3, ty - s * 6, s * 0.7, s * 6);
    ctx.fillRect(tx - s * 2.8, ty - s * 6.6, s * 5.6, s * 0.8);
    ctx.fillRect(tx - s * 2.1, ty - s * 4.6, s * 4.2, s * 0.5);
    ctx.fillStyle = ink;
    ctx.fillRect(tx - s * 3, ty - s * 7.1, s * 6, s * 0.6);
    const hx = g.W * (ISLE.x - 0.02);
    const hy = isleTop(g, hx) + g.U * 1.5;
    ctx.fillStyle = vermilion;
    ctx.fillRect(hx - s * 2.6, hy - s * 3, s * 5.2, s * 3);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(hx - s * 4.2, hy - s * 2.9);
    ctx.lineTo(hx - s * 1.6, hy - s * 5.6);
    ctx.lineTo(hx + s * 1.6, hy - s * 5.6);
    ctx.lineTo(hx + s * 4.2, hy - s * 2.9);
    ctx.fill();
  }

  // ---- shore and bridge --------------------------------------------------

  function landEdge(g, x) {
    const f = x / g.W;
    if (f > 0.42) return g.H + 1;
    return g.H * (0.7 + 0.3 * Math.pow(f / 0.42, 1.4)) + (fbm(x * 0.05, 8, 3, 6) - 0.5) * g.U;
  }

  function paintShore(ctx, g, sky, rand) {
    const sand = mixColor(mixColor(rgb('#6b5e52'), sky.amb, 0.2), rgb('#171a26'), sky.night * 0.6);
    const turf = mixColor(mixColor(rgb('#3a4e38'), sky.haze, 0.2), rgb('#101a1a'), sky.night * 0.7);
    for (let x = 0; x < g.W * 0.43; x++) {
      const top = landEdge(g, x);
      if (top > g.H) continue;
      ctx.fillStyle = hex(turf);
      ctx.fillRect(x, top, 1, g.U * 3);
      ctx.fillStyle = hex(sand);
      ctx.fillRect(x, top + g.U * 3, 1, g.H - top);
    }
    ctx.fillStyle = 'rgba(240,236,224,0.4)';
    for (let x = g.W * 0.05; x < g.W * 0.43; x += 2) ctx.fillRect(x, landEdge(g, x) + g.U * 3, 1, 1);
    const tree = hex(mixColor(turf, rgb('#0c1212'), 0.5));
    pine(ctx, g.W * 0.07, landEdge(g, g.W * 0.07) + g.U, g.U * 4.2, tree);
    pine(ctx, g.W * 0.15, landEdge(g, g.W * 0.15) + g.U, g.U * 3, tree);
    pine(ctx, g.W * 0.025, landEdge(g, g.W * 0.025) + g.U, g.U * 3.4, tree);
    for (let i = 0; i < 5; i++) {
      const x = g.W * (0.2 + rand() * 0.2);
      pine(ctx, x, landEdge(g, x) + g.U, g.U * (1.4 + rand()), tree);
    }
    ctx.fillStyle = hex(mixColor(rgb('#9a9486'), sky.amb, 0.2));
    // A stone lantern at the bridge head.
    const lx = g.W * 0.2;
    const ly = landEdge(g, lx) + g.U * 2;
    ctx.fillStyle = hex(mixColor(rgb('#8a8a86'), sky.haze, 0.35));
    ctx.fillRect(lx - g.U * 0.3, ly - g.U * 4, g.U * 0.6, g.U * 4);
    ctx.fillRect(lx - g.U * 1.2, ly - g.U * 5.4, g.U * 2.4, g.U * 1.4);
    ctx.fillRect(lx - g.U * 1.6, ly - g.U * 6.2, g.U * 3.2, g.U * 0.8);
  }

  function paintBridge(ctx, g, sky) {
    const x0 = g.W * 0.19;
    const y0 = g.H * 0.735;
    const x1 = g.W * (ISLE.x - ISLE.half * 0.88);
    const y1 = g.H * 0.625;
    const deck = hex(mixColor(rgb('#2a2630'), sky.haze, 0.25));
    const rail = hex(mixColor(rgb('#c8452c'), sky.haze, 0.3 + sky.night * 0.4));
    const t = g.U * 0.8;
    const arc = (f) => -Math.sin(f * Math.PI) * g.U * 2.2;
    const n = Math.max(12, Math.floor((x1 - x0) / (g.U * 2.4)));
    ctx.fillStyle = 'rgba(8,12,28,0.35)';
    for (let i = 0; i < n; i++) {
      const f = i / n;
      ctx.fillRect(lerp(x0, x1, f), lerp(y0, y1, f) + t * 3.4, g.U * 2.2, 1);
    }
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const bx = lerp(x0, x1, f);
      const by = lerp(y0, y1, f) + arc(f);
      if (i % 3 === 0) {
        ctx.fillStyle = deck;
        ctx.fillRect(bx - g.U * 0.25, by, g.U * 0.5, t * 3.2 * (0.5 + f * 0.5));
      }
      ctx.fillStyle = deck;
      ctx.fillRect(bx, by, Math.ceil((x1 - x0) / n) + 1, t);
      ctx.fillStyle = rail;
      ctx.fillRect(bx, by - t * 1.6, Math.ceil((x1 - x0) / n) + 1, Math.max(1, t * 0.3));
      if (i % 2 === 0) ctx.fillRect(bx, by - t * 1.6, Math.max(1, t * 0.3), t * 1.6);
    }
    state.lampXY = [x0, y0];
  }

  // ---- bake --------------------------------------------------------------

  function paintMid(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSea(ctx, g, sky);
    paintFuji(ctx, g, sky);
    return c;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintIsland(ctx, g, sky, rand);
    paintShore(ctx, g, sky, rand);
    paintBridge(ctx, g, sky);
    return c;
  }

  // One strip of short pale dashes in rows that grow wider toward the viewer.
  function paintWaves(g, sky, seed) {
    const c = layer(g.W, g.H * (1 - HORIZON));
    const ctx = c.getContext('2d');
    const rand = K.rng(seed);
    const lit = state.day ? '#f2dcb4' : '#c8d0e6';
    for (let y = 2; y < c.height; y += 3) {
      const k = y / c.height;
      const len = g.U * (0.8 + k * 4);
      const count = Math.floor(g.W / (len * (3.2 - k)));
      ctx.fillStyle = k < 0.35 ? lit : '#d8dcec';
      for (let i = 0; i < count; i++) {
        ctx.globalAlpha = (0.12 + rand() * 0.22) * (1 - sky.night * 0.4);
        ctx.fillRect(rand() * c.width, y, len * (0.6 + rand() * 0.8), 1);
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintKite(g, ink) {
    const s = Math.max(5, Math.round(g.U * 5));
    const c = layer(s, s * 3);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0ece0';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, s, Math.max(1, s * 0.22));
    ctx.fillRect(s * 0.42, 0, Math.max(1, s * 0.16), s);
    ctx.fillStyle = '#2c3f8c';
    ctx.fillRect(0, s * 0.45, s, Math.max(1, s * 0.12));
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.day = sky.hour >= 6 && sky.hour <= 19.5;
    state.sunLow = 0;
    state.sky = paintSky(g, sky, rand);
    state.mid = paintMid(g, sky);
    state.front = paintFront(g, sky, rand);
    state.wavesA = paintWaves(g, sky, 3);
    state.wavesB = paintWaves(g, sky, 8);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.gull = hex(mixColor(rgb('#f0ece0'), sky.haze, 0.3 + sky.night * 0.5));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.04);
    ctx.drawImage(c, off + c.width, g.H * 0.04);
    ctx.globalAlpha = 1;
  }

  function drawWaves(ctx, g, t, amount) {
    if (amount <= 0) return;
    const y = g.H * HORIZON;
    ctx.globalAlpha = Math.min(1, amount);
    const a = (t * g.U * 1.2) % g.W;
    const b = (g.W - ((t * g.U * 2.1) % g.W)) % g.W;
    ctx.drawImage(state.wavesA, -a, y);
    ctx.drawImage(state.wavesA, g.W - a, y);
    ctx.drawImage(state.wavesB, -b, y + g.U * 1.5);
    ctx.drawImage(state.wavesB, g.W - b, y + g.U * 1.5);
    ctx.globalAlpha = 1;
  }

  function drawKites(ctx, g, t) {
    for (let i = 0; i < KITES.length; i++) {
      const k = KITES[i];
      const art = state.kiteArt[i];
      const kx = g.W * k.x + Math.sin(t * 0.35 + k.phase) * g.U * 5;
      const ky = g.H * k.y + Math.sin(t * 0.5 + k.phase * 2) * g.U * 2.5;
      const s = art.width;
      ctx.save();
      ctx.translate(kx, ky);
      ctx.rotate(Math.sin(t * 0.7 + k.phase) * 0.18);
      ctx.drawImage(art, -s / 2, -s / 2);
      ctx.fillStyle = '#e8e2d0';
      for (let j = 0; j < 7; j++) {
        const sway = Math.sin(t * 2 - j * 0.9 + k.phase) * s * 0.35;
        ctx.fillRect(sway, s / 2 + j * s * 0.34, Math.max(1, s * 0.12), Math.max(1, s * 0.2));
      }
      ctx.restore();
    }
  }

  function drawGull(ctx, x, y, s, flap) {
    ctx.beginPath();
    ctx.moveTo(x - s, y - flap * s * 0.5);
    ctx.lineTo(x, y);
    ctx.lineTo(x + s, y - flap * s * 0.5);
    ctx.stroke();
  }

  function drawGulls(ctx, g, t) {
    ctx.strokeStyle = state.gull;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < GULLS; i++) {
      const speed = 0.012 + (i % 3) * 0.004;
      const u = (t * speed + i * 0.17) % 1.2;
      const x = g.W * (-0.05 + u);
      const y = g.H * (0.34 + (i % 4) * 0.07) + Math.sin(t * 0.8 + i * 2) * g.U * 2.2;
      const flap = Math.sin(t * 5 + i * 1.7);
      drawGull(ctx, x, y, g.U * (1.3 + (i % 2) * 0.5), 0.5 + flap * 0.5);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.kiteArt = KITES.map((k) => paintKite(g, k.ink));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.mid, 0, 0);
    drawWaves(ctx, g, t, props.waves);
    ctx.drawImage(state.front, 0, 0);
    drawGulls(ctx, g, t);
    if (props.kites) drawKites(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dusk', kites: true, waves: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
