/*
 * 尾道 Onomichi — a hillside of temple roofs and stone stairs above a strait.
 *
 * Sky, far shore, water, hillside and town are baked into layers and
 * repainted once a minute from the clock. Between repaints only clouds,
 * water ripples, a ferry, a small boat and the lamps move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const FAR = 0.5;
  const SHORE = 0.79;
  const RETINT_SECONDS = 60;
  const HILL = [[0, 0.1], [0.14, 0.13], [0.3, 0.22], [0.46, 0.36], [0.6, 0.52], [0.72, 0.64], [0.83, 0.74], [0.9, 0.79]];
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour pulled toward the sky light, then toward dark at night.
  function tone(sky, color, dark, k) {
    return hex(mixColor(mixColor(rgb(color), sky.amb, 0.22), rgb(dark || '#242c4a'), sky.night * (k === undefined ? 0.38 : k * 0.55)));
  }

  function hillTop(g, xf) {
    let y = HILL[HILL.length - 1][1];
    for (let i = 1; i < HILL.length; i++) {
      if (xf <= HILL[i][0]) {
        const a = HILL[i - 1];
        const b = HILL[i];
        y = lerp(a[1], b[1], smoothstep(a[0], b[0], xf) * 0.5 + (xf - a[0]) / (b[0] - a[0]) * 0.5);
        break;
      }
    }
    return g.H * y + (fbm(xf * 22, 3, 3, 7) - 0.5) * g.U * 2.2;
  }

  // ---- sky and water -----------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * FAR);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#5a6a96'), sky.night * 0.55)));
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
    if (sky.night > 0.3) paintMoon(ctx, g, sky);
    paintFarShore(ctx, g, sky);
    const water = ctx.createLinearGradient(0, g.H * FAR, 0, g.H);
    water.addColorStop(0, hex(mixColor(sky.low, rgb('#44587a'), 0.45)));
    water.addColorStop(1, hex(mixColor(mixColor(sky.top, rgb('#1f2e4e'), 0.6), rgb('#141a30'), sky.night * 0.5)));
    ctx.fillStyle = water;
    ctx.fillRect(0, g.H * FAR, g.W, g.H * (1 - FAR));
    return c;
  }

  function paintMoon(ctx, g, sky) {
    const x = g.W * 0.72;
    const y = g.H * 0.2;
    const r = g.U * 4.5;
    const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 5);
    halo.addColorStop(0, `rgba(226,222,200,${0.3 * sky.night})`);
    halo.addColorStop(1, 'rgba(226,222,200,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    ctx.globalAlpha = sky.night;
    ctx.fillStyle = '#e8e2c8';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintFarShore(ctx, g, sky) {
    const base = g.H * FAR;
    const far = mixColor(mixColor(rgb('#6f7f9c'), sky.haze, 0.5), rgb('#2a3458'), sky.night * 0.5);
    const near = mixColor(mixColor(rgb('#415a56'), sky.haze, 0.3), rgb('#1e2840'), sky.night * 0.6);
    ctx.fillStyle = hex(far);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.2, base);
    for (let x = g.W * 0.2; x <= g.W; x += 2) {
      const f = x / g.W;
      const bump = Math.pow(Math.max(0, Math.sin((f - 0.2) * 5.2)), 0.8) * 0.085;
      ctx.lineTo(x, base - g.H * bump - fbm(f * 9, 5, 3, 3) * g.U * 2.4);
    }
    ctx.lineTo(g.W, base);
    ctx.fill();
    ctx.fillStyle = hex(near);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.55, base);
    for (let x = g.W * 0.55; x <= g.W; x += 2) {
      const f = x / g.W;
      const bump = Math.pow(Math.max(0, Math.sin((f - 0.55) * 7)), 1.2) * 0.05;
      ctx.lineTo(x, base - g.H * bump - fbm(f * 14, 8, 3, 4) * g.U * 1.4);
    }
    ctx.lineTo(g.W, base);
    ctx.fill();
    // Dark warehouse roofs along the far waterline.
    ctx.fillStyle = hex(mixColor(near, rgb('#10131f'), 0.3));
    for (let k = 0; k < 7; k++) ctx.fillRect(g.W * (0.62 + k * 0.045), base - g.U * 1.3, g.U * (2 + (k % 3)), g.U * 1.3);
  }

  function paintRipples(g, sky, rand) {
    const c = layer(g.W, g.H * (1 - FAR));
    const ctx = c.getContext('2d');
    const light = mixColor(mixColor(sky.low, rgb('#f2ede0'), 0.5), rgb('#6f7fa6'), sky.night * 0.7);
    ctx.fillStyle = hex(light);
    for (let i = 0; i < 260; i++) {
      const row = Math.pow(rand(), 0.8);
      const y = row * c.height;
      const len = g.U * (1 + row * 5) * (0.5 + rand());
      ctx.globalAlpha = (0.1 + rand() * 0.2) * (0.5 + row * 0.5);
      ctx.fillRect(rand() * g.W, y, len, Math.max(1, g.U * 0.35));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 23);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(236,190,96,0.85)');
    grad.addColorStop(0.35, 'rgba(226,170,80,0.3)');
    grad.addColorStop(1, 'rgba(226,170,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- buildings ---------------------------------------------------------

  // Hip roof with upturned corners; base y is the eave line.
  function roof(ctx, cx, by, w, h, u, color, ridge) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, by - u * 0.7);
    ctx.lineTo(cx - w * 0.43, by);
    ctx.lineTo(cx + w * 0.43, by);
    ctx.lineTo(cx + w / 2, by - u * 0.7);
    ctx.lineTo(cx + w * 0.2, by - h);
    ctx.lineTo(cx - w * 0.2, by - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ridge;
    ctx.fillRect(cx - w * 0.2, by - h, w * 0.4, Math.max(1, u * 0.4));
    ctx.fillRect(cx - w * 0.43, by - Math.max(1, u * 0.35), w * 0.86, Math.max(1, u * 0.35));
  }

  function paintHall(ctx, g, sky, cx, by, w, lamps) {
    const u = g.U;
    const wallH = u * 4;
    ctx.fillStyle = tone(sky, '#8c8574', '#161824');
    ctx.fillRect(cx - w * 0.5, by - u * 1.2, w, u * 1.2 + 1);
    ctx.fillStyle = tone(sky, '#e8e2d0', '#1c2030');
    ctx.fillRect(cx - w * 0.36, by - u * 1.2 - wallH, w * 0.72, wallH);
    ctx.fillStyle = tone(sky, '#b8412c', '#201820');
    for (let k = 0; k <= 5; k++) ctx.fillRect(cx - w * 0.36 + (w * 0.72 * k) / 5 - 0.5, by - u * 1.2 - wallH, Math.max(1, u * 0.45), wallH);
    ctx.fillStyle = tone(sky, '#3a2e2a', '#0c0e16');
    ctx.fillRect(cx - w * 0.36, by - u * 1.2 - wallH * 0.62, w * 0.72, u * 0.5);
    roof(ctx, cx, by - u * 1.2 - wallH, w * 1.12, u * 5.2, u, tone(sky, '#2d3342', '#0d1018'), tone(sky, '#59607a', '#222638'));
    lamps.push({ x: cx - w * 0.6, y: by - u * 1.6, r: u * 2.6 });
    lamps.push({ x: cx + w * 0.6, y: by - u * 1.6, r: u * 2.6 });
  }

  function paintPagoda(ctx, g, sky, cx, by, w) {
    const u = g.U;
    ctx.fillStyle = tone(sky, '#8c8574', '#161824');
    ctx.fillRect(cx - w * 0.55, by - u * 1.1, w * 1.1, u * 1.1 + 1);
    let y = by - u * 1.1;
    for (let i = 0; i < 3; i++) {
      const tw = w * (1 - i * 0.2);
      const wallH = u * 3.4;
      ctx.fillStyle = tone(sky, '#c9503a', '#221820');
      ctx.fillRect(cx - tw * 0.36, y - wallH, tw * 0.72, wallH);
      ctx.fillStyle = tone(sky, '#efe9d8', '#1c2030');
      ctx.fillRect(cx - tw * 0.12, y - wallH * 0.85, tw * 0.24, wallH * 0.7);
      y -= wallH;
      roof(ctx, cx, y, tw * 1.35, u * 2.6, u, tone(sky, '#2d3342', '#0d1018'), tone(sky, '#59607a', '#222638'));
      y -= u * 0.4;
    }
    ctx.fillStyle = tone(sky, '#d4a64a', '#3a3020', 0.5);
    ctx.fillRect(cx - 0.5, y - u * 6, Math.max(1, u * 0.35), u * 6);
    for (let k = 0; k < 4; k++) ctx.fillRect(cx - u * 0.8, y - u * (1.5 + k * 1.1), u * 1.6, Math.max(1, u * 0.3));
    return y - u * 6;
  }

  function paintGate(ctx, g, sky, cx, by, w) {
    const u = g.U;
    ctx.fillStyle = tone(sky, '#b8412c', '#201820');
    ctx.fillRect(cx - w * 0.4, by - u * 5, Math.max(1, u * 0.8), u * 5);
    ctx.fillRect(cx + w * 0.4 - u * 0.8, by - u * 5, Math.max(1, u * 0.8), u * 5);
    ctx.fillRect(cx - w * 0.42, by - u * 4.2, w * 0.84, Math.max(1, u * 0.7));
    roof(ctx, cx, by - u * 5, w * 1.1, u * 2.8, u, tone(sky, '#2d3342', '#0d1018'), tone(sky, '#59607a', '#222638'));
  }

  function paintHouse(ctx, g, sky, cx, by, w, rand, lit, windows) {
    const u = g.U;
    const wallH = u * (1.8 + rand() * 1.2);
    const walls = ['#d8cfb8', '#b9ad92', '#8c8068', '#a79a80'];
    ctx.fillStyle = tone(sky, walls[Math.floor(rand() * walls.length)], '#14161f');
    ctx.fillRect(cx - w * 0.4, by - wallH, w * 0.8, wallH);
    roof(ctx, cx, by - wallH, w * 1.1, u * (1.6 + rand() * 0.8), u * 0.7, tone(sky, rand() < 0.3 ? '#4a5a74' : '#33384a', '#0d1018'), tone(sky, '#6a7088', '#222638'));
    if (lit && rand() < 0.7) windows.push({ x: cx - w * 0.1, y: by - wallH * 0.7, s: Math.max(1, u * 0.7) });
  }

  function paintTrees(ctx, g, sky, rand) {
    const dark = tone(sky, '#31503c', '#1a2c3c', 0.78);
    const mid = tone(sky, '#4c6a44', '#1e3040', 0.78);
    for (let i = 0; i < 150; i++) {
      const xf = rand() * 0.9;
      const top = hillTop(g, xf);
      const y = top + rand() * Math.min(g.H * 0.2, g.H * SHORE - top - g.U * 2);
      ctx.fillStyle = rand() < 0.4 ? mid : dark;
      ctx.beginPath();
      ctx.arc(g.W * xf, y, g.U * (1.2 + rand() * 1.6), 0, 6.3);
      ctx.fill();
    }
  }

  // Pines on the crest read as a ragged edge of the hill.
  function paintPines(ctx, g, sky, rand) {
    ctx.fillStyle = tone(sky, '#2a4234', '#142434', 0.8);
    for (let i = 0; i < 26; i++) {
      const xf = rand() * 0.62;
      const x = g.W * xf;
      const y = hillTop(g, xf) + g.U;
      const s = g.U * (2.2 + rand() * 1.6);
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(x - s * (1 - k * 0.22), y - k * s * 0.7);
        ctx.lineTo(x + s * (1 - k * 0.22), y - k * s * 0.7);
        ctx.lineTo(x, y - (k + 1.2) * s * 0.8);
        ctx.fill();
      }
      ctx.fillRect(x - 0.5, y, Math.max(1, g.U * 0.3), s * 0.6);
    }
  }

  // Zigzag of stone steps with a lamp every few turns.
  function paintStairs(ctx, g, sky, lamps) {
    const pts = [[0.3, 0.77], [0.38, 0.69], [0.31, 0.6], [0.4, 0.5], [0.33, 0.41], [0.38, 0.33], [0.3, 0.27]];
    const stone = tone(sky, '#bdb6a4', '#2a2e44', 0.68);
    const edge = tone(sky, '#7c7664', '#161a2a', 0.68);
    for (let i = 1; i < pts.length; i++) {
      const ax = g.W * pts[i - 1][0];
      const ay = g.H * pts[i - 1][1];
      const bx = g.W * pts[i][0];
      const by = g.H * pts[i][1];
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(3, Math.round(len / (g.U * 0.9)));
      const w = g.U * 2.4;
      for (let s = 0; s <= n; s++) {
        const f = s / n;
        const x = lerp(ax, bx, f);
        const y = lerp(ay, by, f);
        ctx.fillStyle = s % 2 ? stone : edge;
        ctx.fillRect(x - w / 2, y, w, Math.max(1, g.U * 0.55));
      }
      ctx.fillStyle = edge;
      ctx.fillRect(ax - w / 2 - 1, ay - 1, 1, Math.abs(by - ay) + 2);
      if (i % 2 === 1) lamps.push({ x: bx + w * 0.8, y: by - g.U * 1.2, r: g.U * 2.2 });
    }
  }

  function paintShoreRoad(ctx, g, sky, lamps) {
    const y0 = g.H * SHORE;
    ctx.fillStyle = tone(sky, '#5d5a58', '#12141e');
    ctx.fillRect(0, y0 - g.U * 0.5, g.W * 0.93, g.U * 2.4);
    ctx.fillStyle = tone(sky, '#8a8678', '#1a1e2c');
    ctx.fillRect(0, y0 - g.U * 0.5, g.W * 0.93, Math.max(1, g.U * 0.6));
    ctx.fillStyle = tone(sky, '#39384a', '#0c0e16');
    ctx.fillRect(0, y0 + g.U * 1.9, g.W * 0.93, Math.max(1, g.U * 1.2));
    for (let f = 0.04; f < 0.9; f += 0.09) lamps.push({ x: g.W * f, y: y0 - g.U * 2.2, r: g.U * 2 });
    // A few moored boats in the shallows.
    ctx.fillStyle = tone(sky, '#2d3342', '#0c0e16');
    for (let k = 0; k < 3; k++) {
      const bx = g.W * (0.18 + k * 0.23);
      ctx.fillRect(bx, y0 + g.U * 3.1, g.U * 4, g.U * 0.9);
      ctx.fillStyle = tone(sky, '#efe9d8', '#1c2030');
      ctx.fillRect(bx + g.U * 1.2, y0 + g.U * 2.4, g.U * 1.2, g.U * 0.7);
      ctx.fillStyle = tone(sky, '#2d3342', '#0c0e16');
    }
  }

  function paintFront(g, sky, rand, lamps, windows) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const lit = sky.night > 0.2;
    // Hillside body.
    const body = ctx.createLinearGradient(0, g.H * 0.1, 0, g.H * SHORE);
    body.addColorStop(0, tone(sky, '#4b6a4a', '#101c2c', 0.8));
    body.addColorStop(1, tone(sky, '#33503c', '#0e1824', 0.8));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, g.H * SHORE);
    for (let x = 0; x <= g.W * 0.92; x += 2) ctx.lineTo(x, hillTop(g, x / g.W));
    ctx.lineTo(g.W * 0.92, g.H * SHORE);
    ctx.closePath();
    ctx.fill();
    paintTrees(ctx, g, sky, rand);
    paintPines(ctx, g, sky, rand);
    paintStairs(ctx, g, sky, lamps);
    // Temples on terraces, small roofs behind, big ones in front.
    const t1 = g.H * 0.31;
    ctx.fillStyle = tone(sky, '#7b7564', '#161a2a');
    ctx.fillRect(g.W * 0.08, t1, g.W * 0.26, u * 1.2);
    paintPagoda(ctx, g, sky, g.W * 0.15, t1, u * 8);
    paintHall(ctx, g, sky, g.W * 0.27, t1, u * 14, lamps);
    const t2 = g.H * 0.5;
    ctx.fillStyle = tone(sky, '#7b7564', '#161a2a');
    ctx.fillRect(g.W * 0.16, t2, g.W * 0.2, u * 1.2);
    paintHall(ctx, g, sky, g.W * 0.24, t2, u * 12, lamps);
    paintGate(ctx, g, sky, g.W * 0.43, g.H * 0.58, u * 9);
    paintHall(ctx, g, sky, g.W * 0.54, g.H * 0.68, u * 10, lamps);
    // Rows of tiled houses stepping down the slope.
    for (let row = 0; row < 7; row++) {
      const by = g.H * (0.46 + row * 0.047);
      for (let xf = 0.01 + rand() * 0.03; xf < 0.9; xf += (0.035 + rand() * 0.02) * (1 + row * 0.05)) {
        if (by < hillTop(g, xf) + u * 4) continue;
        if (xf > 0.2 && xf < 0.45 && row < 3) continue;
        paintHouse(ctx, g, sky, g.W * xf, by + u * 2, u * (4 + rand() * 3), rand, lit, windows);
      }
    }
    paintShoreRoad(ctx, g, sky, lamps);
    return c;
  }

  // ---- ferry -------------------------------------------------------------

  function paintFerry(g, sky) {
    const u = g.U;
    const w = Math.round(u * 24);
    const h = Math.round(u * 9);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const white = tone(sky, '#efe9d8', '#1c2030', 0.6);
    ctx.fillStyle = tone(sky, '#1f2740', '#0a0c16', 0.5);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.lineTo(w, h * 0.62);
    ctx.lineTo(w * 0.94, h);
    ctx.lineTo(w * 0.05, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tone(sky, '#b8412c', '#201820', 0.5);
    ctx.fillRect(w * 0.03, h * 0.84, w * 0.92, Math.max(1, h * 0.08));
    ctx.fillStyle = white;
    ctx.fillRect(w * 0.12, h * 0.3, w * 0.72, h * 0.33);
    ctx.fillRect(w * 0.3, h * 0.04, w * 0.34, h * 0.26);
    ctx.fillStyle = tone(sky, '#33384a', '#0d1018', 0.5);
    ctx.fillRect(w * 0.7, 0, w * 0.07, h * 0.3);
    const glass = sky.night > 0.3 ? '#e2b25a' : tone(sky, '#566d8c', '#1c2438', 0.4);
    ctx.fillStyle = glass;
    for (let k = 0; k < 8; k++) ctx.fillRect(w * (0.15 + k * 0.085), h * 0.38, Math.max(1, w * 0.045), Math.max(1, h * 0.14));
    ctx.fillRect(w * 0.34, h * 0.1, w * 0.26, Math.max(1, h * 0.1));
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    const lamps = [];
    const windows = [];
    state.back = paintBack(g, sky, rand);
    state.ripples = paintRipples(g, sky, K.rng(5));
    state.front = paintFront(g, sky, rand, lamps, windows);
    state.ferrySprite = paintFerry(g, sky);
    state.lamps = lamps;
    state.windows = windows;
    state.night = sky.night;
    state.light = sky.night;
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.5) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t) {
    const c = state.ripples;
    const off = (t * g.U * 0.9) % c.width;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(c, off, g.H * FAR);
    ctx.drawImage(c, off - c.width, g.H * FAR);
    ctx.globalAlpha = 1;
  }

  function drawSmallBoat(ctx, g, t, night) {
    const u = g.U;
    const x = g.W * (0.88 + 0.06 * Math.sin(t * 0.03));
    const y = g.H * 0.585;
    ctx.fillStyle = hex(mixColor(rgb('#2d3342'), rgb('#0c0e16'), night * 0.7));
    ctx.fillRect(x, y, u * 4, u * 0.9);
    ctx.fillStyle = hex(mixColor(rgb('#efe9d8'), rgb('#1c2030'), night * 0.7));
    ctx.fillRect(x + u * 1.4, y - u * 0.9, u * 1.2, u * 0.9);
    if (night > 0.3) {
      ctx.globalAlpha = night * 0.8;
      ctx.drawImage(state.glow, x + u * 3.2 - u, y - u * 1.6, u * 2, u * 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawFerry(ctx, g, t) {
    const s = state.ferrySprite;
    const period = 140;
    const p = (t % period) / period;
    const x = lerp(g.W + s.width * 0.3, -s.width * 1.3, p);
    const y = g.H * 0.855 + Math.sin(t * 0.7) * g.U * 0.25;
    ctx.drawImage(s, x, y - s.height);
    // Wake: short pale dashes trailing behind the stern.
    ctx.fillStyle = 'rgba(240,236,222,0.35)';
    for (let k = 0; k < 6; k++) {
      const d = k * g.U * 2.4 + ((t * g.U * 3) % (g.U * 2.4));
      ctx.fillRect(x + s.width + d, y - g.U * (0.5 - k * 0.04), g.U * (2.4 - k * 0.25), Math.max(1, g.U * 0.35));
    }
    if (state.night > 0.3) {
      ctx.globalAlpha = state.night * 0.4;
      ctx.fillStyle = '#e2b25a';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + s.width * (0.2 + k * 0.17), y + g.U * (0.5 + k * 0.15), Math.max(1, g.U * 0.4), g.U * 2.2);
      ctx.globalAlpha = 1;
    }
  }

  function drawLamps(ctx, g, t) {
    const n = state.night;
    if (n < 0.08) return;
    const lamps = state.lamps;
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      const flick = 0.9 + 0.1 * Math.sin(t * 0.8 + i * 1.7);
      ctx.globalAlpha = Math.min(1, n * flick);
      ctx.drawImage(state.glow, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.globalAlpha = Math.min(1, n * 0.9);
    ctx.fillStyle = '#e8bf6a';
    const ws = state.windows;
    for (let i = 0; i < ws.length; i++) ctx.fillRect(ws[i].x, ws[i].y, ws[i].s, ws[i].s);
    ctx.globalAlpha = 1;
  }

  // Gold lamp light broken up on the water below the road.
  function drawReflections(ctx, g, t) {
    const n = state.night;
    if (n < 0.1) return;
    ctx.fillStyle = '#e2b25a';
    for (let i = 0; i < 10; i++) {
      const x = g.W * (0.04 + i * 0.09);
      for (let k = 0; k < 4; k++) {
        ctx.globalAlpha = n * (0.35 - k * 0.06);
        ctx.fillRect(x + Math.sin(t * 1.1 + i + k) * g.U * 0.7, g.H * (SHORE + 0.05) + k * g.U * 2.4, g.U * (1.6 - k * 0.25), Math.max(1, g.U * 0.5));
      }
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.glow = paintGlow();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    drawRipples(ctx, g, t);
    drawSmallBoat(ctx, g, t, state.night);
    ctx.drawImage(state.front, 0, 0);
    if (props.lamps) {
      drawLamps(ctx, g, t);
      drawReflections(ctx, g, t);
    }
    if (props.ferry) drawFerry(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, ferry: true, lamps: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
