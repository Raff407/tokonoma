/*
 * 東京 Tokyo — a red lattice tower and a far skyline over a river at dusk.
 *
 * Sky, skyline, tower, water, bridge and bank are baked into layers and redone
 * once a minute from the clock, so windows come on as the light goes. Between
 * repaints only clouds, the river rows, a few late windows, the beacon glow,
 * a train on the iron bridge and a lantern boat move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, fbm, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.6;
  const BANK = 0.925;
  const TOWER_X = 0.7;
  const HOURS = { dawn: 6.3, day: 12.5, dusk: 18.2, night: 22.5 };
  const RETINT_SECONDS = 60;
  const VERMILION = '#c4442c';
  const WASHI = '#e8dfc9';
  const GOLD = '#e6bf5a';
  const INDIGO = '#222845';
  const MOSS = '#4d5e3c';
  const LATE_WINDOWS = 26;
  const GLINTS = 14;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

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
    const U = H / 100;
    const wy = Math.round(H * WATER);
    const deck = Math.round(wy + H * 0.075);
    return { W, H, U, wy, deck, bank: Math.round(H * BANK), tx: W * TOWER_X, th: wy - H * 0.085 };
  }

  // Brightness of the scene: 1 in daylight, low at night.
  function lightOf(sky) {
    return clamp(1 - sky.dark * 0.62, 0.3, 1);
  }

  // A colour pulled toward the ambient tint and dimmed by the hour.
  function tone(sky, color, amount) {
    const mixed = mixColor(rgb(color), sky.amb, amount === undefined ? 0.28 : amount);
    const k = lightOf(sky);
    return hex([mixed[0] * k, mixed[1] * k, mixed[2] * k]);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.dark > 0.3) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.dark * (0.12 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.wy * 0.6, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (sky.dark > 0.7) {
      ctx.fillStyle = '#ece4c8';
      ctx.globalAlpha = 0.85;
      blob(ctx, g.W * 0.12, g.H * 0.2, g.U * 2.4, g.U * 2.4);
      ctx.fillStyle = hex(sky.top);
      blob(ctx, g.W * 0.12 + g.U * 1.1, g.H * 0.2 - g.U * 0.5, g.U * 2.1, g.U * 2.1);
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // Long thin cloud bars that tile sideways, tinted by the hour.
  function paintClouds(g, sky) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.H * 0.26);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tint = mixColor(sky.amb, [255, 255, 255], 0.2);
    const density = (x, y) => fbm(x * 0.012, y * 0.09, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(40, 40);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
    grad.addColorStop(0, 'rgba(240,190,110,0.7)');
    grad.addColorStop(1, 'rgba(240,190,110,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 40, 40);
    return c;
  }

  // ---- skyline -----------------------------------------------------------

  // The distant slender tower on the far left, only a pale hint.
  function paintFarSpire(ctx, g, sky) {
    const x = g.W * 0.09;
    const top = g.wy - g.H * 0.4;
    ctx.fillStyle = tone(sky, '#8a8fa8', 0.5);
    poly(ctx, [x - g.U * 1.3, g.wy, x - g.U * 0.35, top + g.H * 0.17, x + g.U * 0.35, top + g.H * 0.17, x + g.U * 1.3, g.wy]);
    ctx.fillRect(x - g.U * 0.2, top, Math.max(1, g.U * 0.4), g.H * 0.18);
    blob(ctx, x, top + g.H * 0.17, g.U * 1.2, g.U * 0.7);
    blob(ctx, x, top + g.H * 0.23, g.U * 0.9, g.U * 0.5);
  }

  function paintFarRow(ctx, g, sky, rand) {
    ctx.fillStyle = tone(sky, '#6c7396', 0.55);
    for (let x = -4; x < g.W; ) {
      const w = g.U * (3 + rand() * 6);
      const h = g.H * (0.05 + rand() * 0.12 + 0.07 * Math.exp(-(((x - g.W * 0.32) / (g.W * 0.18)) ** 2)));
      ctx.fillRect(x, g.wy - h, w, h + 1);
      x += w + g.U * rand() * 0.8;
    }
  }

  function paintWindows(ctx, g, sky, rand, x, top, w, bottom, late) {
    const ww = Math.max(1, Math.round(g.U * 0.7));
    const stepX = ww * 2;
    const stepY = Math.max(ww * 2, Math.round(g.U * 1.9));
    for (let wx = x + stepX * 0.5; wx + ww < x + w - 1; wx += stepX) {
      for (let wyy = top + stepY; wyy + ww < bottom - 1; wyy += stepY) {
        if (rand() > 0.5) continue;
        const threshold = 0.05 + rand() * 0.85;
        const warm = rand() < 0.3;
        if (rand() < 0.07 && late.length < LATE_WINDOWS) {
          late.push({ x: wx, y: wyy, w: ww, per: 18 + rand() * 40, ph: rand() * TAU });
        } else if (sky.dark > threshold) {
          ctx.fillStyle = warm ? '#f0dca0' : GOLD;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(wx, wyy, ww, ww);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function paintMidRow(ctx, g, sky, rand, late) {
    const inks = ['#2a2f4c', '#30344f', '#252a44', '#383b52'];
    for (let x = -4; x < g.W; ) {
      const w = g.U * (3.5 + rand() * 6.5);
      const cluster = Math.exp(-(((x - g.W * 0.28) / (g.W * 0.16)) ** 2));
      const dip = Math.exp(-(((x - g.W * TOWER_X) / (g.W * 0.07)) ** 2));
      const h = g.H * (0.035 + rand() * 0.08 + 0.12 * cluster * rand()) * (1 - 0.35 * dip);
      const top = g.wy - h;
      ctx.fillStyle = tone(sky, inks[Math.floor(rand() * inks.length)], 0.3);
      ctx.fillRect(x, top, w, h + 1);
      if (rand() < 0.35) ctx.fillRect(x + w * 0.2, top - g.U * 1.2, w * 0.5, g.U * 1.2 + 1);
      if (rand() < 0.2) ctx.fillRect(x + w * 0.5, top - g.U * 3, Math.max(1, g.U * 0.3), g.U * 3);
      paintWindows(ctx, g, sky, rand, x, top, w, g.wy, late);
      x += w + g.U * rand() * 0.5;
    }
  }

  // ---- the tower ---------------------------------------------------------

  function towerHalf(g, f) {
    const base = g.th * 0.15;
    const leg = Math.pow(Math.max(0, 1 - f / 0.78), 1.4);
    return Math.max(g.U * 0.5, base * leg + g.U * 0.6);
  }

  function towerY(g, f) {
    return g.wy - g.th * f;
  }

  function lamp(sky, color) {
    const m = mixColor(rgb(color), sky.amb, 0.1);
    const k = 0.7 + 0.3 * lightOf(sky);
    return hex([Math.min(255, m[0] * k), Math.min(255, m[1] * k), Math.min(255, m[2] * k)]);
  }

  function bandInk(sky, k) {
    const lit = mixColor(rgb(k % 2 === 0 ? VERMILION : WASHI), rgb(GOLD), sky.dark * 0.45);
    return hex(lit);
  }

  function paintPanel(ctx, g, sky, f0, f1, k) {
    const x = g.tx;
    const h0 = towerHalf(g, f0);
    const h1 = towerHalf(g, f1);
    const y0 = towerY(g, f0);
    const y1 = towerY(g, f1);
    ctx.fillStyle = tone(sky, VERMILION, 0.1);
    ctx.globalAlpha = 0.4;
    poly(ctx, [x - h0, y0, x - h1, y1, x + h1, y1, x + h0, y0]);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = lamp(sky, bandInk(sky, k));
    ctx.lineWidth = Math.max(1, g.U * 0.75);
    ctx.beginPath();
    ctx.moveTo(x - h0, y0);
    ctx.lineTo(x - h1, y1);
    ctx.moveTo(x + h0, y0);
    ctx.lineTo(x + h1, y1);
    ctx.moveTo(x - h1, y1);
    ctx.lineTo(x + h1, y1);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, g.U * 0.45);
    ctx.beginPath();
    ctx.moveTo(x - h0, y0);
    ctx.lineTo(x + h1, y1);
    ctx.moveTo(x + h0, y0);
    ctx.lineTo(x - h1, y1);
    ctx.stroke();
  }

  function paintDeck(ctx, g, sky, f, depth, widen) {
    const x = g.tx;
    const hw = towerHalf(g, f) * widen;
    const y = towerY(g, f);
    const hh = g.th * depth;
    ctx.fillStyle = lamp(sky, VERMILION);
    ctx.fillRect(x - hw, y - hh, hw * 2, hh);
    ctx.fillStyle = tone(sky, WASHI, 0.2);
    ctx.fillRect(x - hw, y - hh * 0.55, hw * 2, Math.max(1, hh * 0.18));
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.25 + sky.dark * 0.65;
    for (let wx = x - hw + 1; wx < x + hw - 1; wx += 2) ctx.fillRect(wx, y - hh * 0.4, 1, Math.max(1, hh * 0.22));
    ctx.globalAlpha = 1;
  }

  function paintTower(ctx, g, sky) {
    const marks = [0, 0.07, 0.15, 0.24, 0.33, 0.42, 0.52, 0.6, 0.67, 0.73];
    for (let i = 0; i < marks.length - 1; i++) paintPanel(ctx, g, sky, marks[i], marks[i + 1], i);
    paintDeck(ctx, g, sky, 0.455, 0.032, 1.9);
    paintDeck(ctx, g, sky, 0.765, 0.02, 2.4);
    const x = g.tx;
    const top = towerY(g, 1);
    const from = towerY(g, 0.765);
    const seg = (from - top) / 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = lamp(sky, bandInk(sky, i));
      ctx.fillRect(x - Math.max(0.5, g.U * 0.28), from - seg * (i + 1), Math.max(1, g.U * 0.56), seg + 0.5);
    }
    ctx.fillStyle = tone(sky, VERMILION, 0.1);
    ctx.fillRect(x - g.U * 1.2, towerY(g, 0.9), g.U * 2.4, Math.max(1, g.U * 0.35));
  }

  // ---- bank, bridge and foreground --------------------------------------

  function paintFarBank(ctx, g, sky, rand) {
    ctx.fillStyle = tone(sky, '#1f2540', 0.25);
    ctx.fillRect(0, g.wy - g.U * 0.2, g.W, g.U * 1.1);
    ctx.fillStyle = tone(sky, MOSS, 0.25);
    for (let x = 0; x < g.W; x += g.U * 1.5) blob(ctx, x, g.wy, g.U * (1 + rand()), g.U * 0.7);
  }

  function paintBack(g, sky, rand, late) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarSpire(ctx, g, sky);
    paintFarRow(ctx, g, sky, rand);
    paintMidRow(ctx, g, sky, rand, late);
    paintTower(ctx, g, sky);
    paintFarBank(ctx, g, sky, rand);
    return c;
  }

  function paintBridge(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ink = tone(sky, '#262b45', 0.2);
    const top = g.deck - g.U * 8.5;
    const bay = g.U * 7;
    const pier = g.U * 2.6;
    ctx.fillStyle = ink;
    for (let px = g.W * 0.12; px < g.W + pier; px += g.W * 0.26) {
      ctx.fillRect(px - pier / 2, g.deck, pier, g.U * 13);
      ctx.fillRect(px - pier * 0.75, g.deck + g.U * 9, pier * 1.5, g.U * 4);
    }
    ctx.fillRect(0, g.deck, g.W, Math.max(2, g.U * 1.5));
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.55));
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.7, g.U * 0.42);
    ctx.beginPath();
    for (let x = 0; x < g.W + bay; x += bay) {
      ctx.moveTo(x, g.deck);
      ctx.lineTo(x + bay / 2, top);
      ctx.lineTo(x + bay, g.deck);
      ctx.moveTo(x, top);
      ctx.lineTo(x, g.deck);
    }
    ctx.stroke();
    ctx.fillStyle = tone(sky, VERMILION, 0.2);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, g.deck + Math.max(2, g.U * 1.5), g.W, Math.max(1, g.U * 0.3));
    ctx.globalAlpha = 1;
    return c;
  }

  function paintTrainSprite(g, sky) {
    const car = Math.round(g.U * 11);
    const gap = Math.max(1, Math.round(g.U * 0.4));
    const h = Math.max(5, Math.round(g.U * 4.4));
    const cars = 4;
    const c = layer(cars * (car + gap), h + 2);
    const ctx = c.getContext('2d');
    const ww = Math.max(2, Math.round(g.U * 1.5));
    for (let i = 0; i < cars; i++) {
      const x = i * (car + gap);
      ctx.fillStyle = tone(sky, '#dcd6c2', 0.2);
      ctx.fillRect(x, 1, car, h);
      ctx.fillStyle = tone(sky, MOSS, 0.2);
      ctx.fillRect(x, 1 + h * 0.62, car, Math.max(1, h * 0.14));
      ctx.fillStyle = tone(sky, '#3a3d52', 0.2);
      ctx.fillRect(x + car * 0.3, 0, Math.max(1, car * 0.3), 1);
      for (let wx = x + 2; wx + ww < x + car - 1; wx += ww + 1) {
        const lit = sky.dark > 0.25;
        ctx.fillStyle = lit ? GOLD : tone(sky, '#3b4560', 0.2);
        ctx.fillRect(wx, 1 + h * 0.18, ww, Math.max(1, h * 0.3));
      }
    }
    return c;
  }

  function paintForeground(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBank(ctx, g, sky, rand);
    paintLantern(ctx, g, sky);
    paintPine(ctx, g, sky, rand);
    return c;
  }

  // Dry stone wall along the near bank with moss on top.
  function paintBank(ctx, g, sky, rand) {
    ctx.fillStyle = tone(sky, '#1a1e34', 0.2);
    ctx.fillRect(0, g.bank, g.W, g.H - g.bank);
    ctx.strokeStyle = tone(sky, '#343a58', 0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const rows = Math.max(2, Math.round((g.H - g.bank) / (g.U * 2.2)));
    for (let r = 1; r < rows; r++) {
      const y = g.bank + r * ((g.H - g.bank) / rows);
      ctx.moveTo(0, y);
      ctx.lineTo(g.W, y);
      for (let x = (r % 2) * g.U * 2; x < g.W; x += g.U * (3 + rand() * 3)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + (g.H - g.bank) / rows);
      }
    }
    ctx.stroke();
    ctx.fillStyle = tone(sky, MOSS, 0.2);
    for (let x = 0; x < g.W; x += g.U * 1.1) blob(ctx, x, g.bank, g.U * (0.8 + rand() * 0.9), g.U * (0.5 + rand() * 0.5));
  }

  // A stone garden lantern on the bank, its fire box lit at night.
  function paintLantern(ctx, g, sky) {
    const x = g.W * 0.9;
    const base = g.bank + g.U * 0.5;
    const u = g.U;
    const stone = tone(sky, '#4a4d62', 0.25);
    ctx.fillStyle = stone;
    ctx.fillRect(x - u * 1.8, base - u * 1.2, u * 3.6, u * 1.2);
    ctx.fillRect(x - u * 0.6, base - u * 4.8, u * 1.2, u * 3.7);
    ctx.fillRect(x - u * 1.6, base - u * 5.6, u * 3.2, u * 0.9);
    ctx.fillRect(x - u * 1.4, base - u * 8.2, u * 2.8, u * 2.6);
    poly(ctx, [x - u * 3.2, base - u * 8.2, x - u * 1.0, base - u * 10.4, x + u * 1.0, base - u * 10.4, x + u * 3.2, base - u * 8.2]);
    blob(ctx, x, base - u * 10.8, u * 0.6, u * 0.6);
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.25 + sky.dark * 0.7;
    ctx.fillRect(x - u * 0.7, base - u * 7.6, u * 1.4, u * 1.4);
    ctx.globalAlpha = 1;
  }

  // A pine branch hanging in from the top left corner.
  function paintPine(ctx, g, sky, rand) {
    const u = g.U;
    ctx.strokeStyle = tone(sky, '#3a2c24', 0.2);
    ctx.lineWidth = Math.max(1, u * 0.8);
    ctx.beginPath();
    ctx.moveTo(-u, g.H * 0.03);
    ctx.quadraticCurveTo(g.W * 0.08, g.H * 0.05, g.W * 0.2, g.H * 0.13);
    ctx.stroke();
    const tufts = [[0.04, 0.045], [0.095, 0.058], [0.15, 0.09], [0.2, 0.125]];
    const shades = ['#2b3d25', '#3f5c33', '#5a7845'];
    for (let i = 0; i < tufts.length; i++) {
      const x = g.W * tufts[i][0];
      const y = g.H * tufts[i][1];
      for (let tier = 0; tier < 3; tier++) {
        const r = u * (5.5 - tier * 1.3 + rand() * 1.2);
        ctx.fillStyle = tone(sky, shades[tier], 0.15);
        blob(ctx, x + tier * u * 0.4, y + u * (1.4 - tier * 1.1), r, r * 0.4);
      }
    }
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, srcSky, back, margin) {
    const rows = g.H - g.wy;
    const c = layer(g.W + margin * 2, rows);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, rows);
    grad.addColorStop(0, hex(mixColor(sky.low, rgb(INDIGO), 0.4)));
    grad.addColorStop(1, hex(mixColor(sky.top, rgb('#0d1122'), 0.6)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, rows);
    ctx.setTransform(1, 0, 0, -1, margin, g.wy);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(srcSky, 0, 0);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(back, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    const rand = K.rng(77);
    ctx.fillStyle = hex(mixColor(sky.amb, [255, 255, 255], 0.3));
    for (let i = 0; i < rows * 0.9; i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.07;
      ctx.fillRect(rand() * c.width, rand() * rows, g.U * (2 + rand() * 7), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function drawWater(ctx, g, t) {
    const water = state.water;
    const rows = water.height;
    const step = Math.max(1, Math.round(g.U * 0.9));
    const amp = g.U * 0.55;
    for (let r = 0; r < rows; r += step) {
      const depth = r / rows;
      const off = Math.sin(t * 0.9 + r * 0.45) * amp * (0.25 + depth) + Math.sin(t * 0.37 + r * 0.17) * amp * 0.5;
      ctx.drawImage(water, 0, r, water.width, step, -state.margin + off, g.wy + r, water.width, step);
    }
  }

  function drawGlints(ctx, g, t) {
    if (state.sky.dark < 0.25) return;
    ctx.fillStyle = '#f0d58a';
    for (let i = 0; i < GLINTS; i++) {
      const gl = state.glints[i];
      const a = Math.max(0, Math.sin(t * gl.sp + gl.ph));
      ctx.globalAlpha = a * 0.55 * state.sky.dark;
      ctx.fillRect(gl.x + Math.sin(t * 0.5 + i) * g.U * 0.5, g.wy + gl.y, gl.w, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.globalAlpha = 0.8 - state.sky.dark * 0.45;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawBeacon(ctx, g, t) {
    const gl = state.glow;
    const size = g.U * (7 + Math.sin(t * 0.7) * 0.8);
    const y = towerY(g, 1);
    ctx.globalAlpha = (0.3 + state.sky.dark * 0.5) * (0.8 + 0.2 * Math.sin(t * 0.7));
    ctx.drawImage(gl, g.tx - size / 2, y - size / 2, size, size);
    const deck = g.U * 15;
    ctx.globalAlpha = state.sky.dark * 0.35;
    ctx.drawImage(gl, g.tx - deck / 2, towerY(g, 0.455) - deck / 2, deck, deck);
    ctx.globalAlpha = 1;
    ctx.fillStyle = VERMILION;
    ctx.fillRect(g.tx - 0.5, y - 1, Math.max(1, g.U * 0.4), Math.max(1, g.U * 0.5));
  }

  // Windows that come on and go off slowly, never flashing.
  function drawLate(ctx, t) {
    const dark = state.sky.dark;
    if (dark < 0.15) return;
    ctx.fillStyle = '#f0d58a';
    for (let i = 0; i < state.late.length; i++) {
      const w = state.late[i];
      const s = 0.5 + 0.5 * Math.sin((t / w.per) * TAU + w.ph);
      ctx.globalAlpha = clamp((s - 0.35) * 2.2, 0, 1) * 0.85 * dark;
      ctx.fillRect(w.x, w.y, w.w, w.w);
    }
    ctx.globalAlpha = 1;
  }

  // Alternate trains cross from the left, then from the right.
  function drawTrain(ctx, g, t) {
    const cycle = 26;
    const run = 13;
    const p = (t % cycle) / run;
    if (p >= 1) return;
    const sprite = state.trainArt;
    const dir = Math.floor(t / cycle) % 2 === 0 ? 1 : -1;
    const span = g.W + sprite.width;
    const along = p * span - sprite.width;
    const y = g.deck - sprite.height + 1;
    if (dir === 1) {
      ctx.drawImage(sprite, along, y);
    } else {
      ctx.save();
      ctx.translate(g.W - along, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, y);
      ctx.restore();
    }
  }

  function paintBoat(g, sky) {
    const u = g.U;
    const w = Math.ceil(u * 16);
    const h = Math.ceil(u * 8);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone(sky, '#15151f', 0.15);
    poly(ctx, [0, h - u * 1.6, u * 1.5, h, w - u * 2.5, h, w, h - u * 2]);
    ctx.fillRect(u * 2.2, h - u * 5.4, u * 0.5, u * 3.8);
    ctx.fillRect(w - u * 4.2, h - u * 5.4, u * 0.5, u * 3.8);
    ctx.fillStyle = tone(sky, '#3b3140', 0.15);
    ctx.fillRect(u * 1.6, h - u * 6.2, w - u * 4.4, u * 1.1);
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.25 + sky.dark * 0.65;
    ctx.fillRect(u * 3, h - u * 4.8, w - u * 7, u * 2.4);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const lx = u * (1.5 + i * 6.5);
      ctx.fillStyle = tone(sky, VERMILION, 0.1);
      blob(ctx, lx, h - u * 3.2, u * 0.7, u * 0.9);
    }
    return c;
  }

  function drawBoat(ctx, g, t) {
    const boat = state.boatArt;
    const span = g.W + boat.width * 2;
    const x = ((t * g.U * 1.3) % span) - boat.width;
    const line = Math.round(g.H * 0.845) + Math.sin(t * 0.8) * 0.4;
    ctx.globalAlpha = 0.28;
    ctx.save();
    ctx.translate(x, line);
    ctx.scale(1, -1);
    ctx.drawImage(boat, 0, -boat.height);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.drawImage(boat, x, line - boat.height);
  }

  // ---- bake --------------------------------------------------------------

  function skyAt(choice) {
    const h = HOURS[choice] ?? S.hour('auto');
    const sky = S.at(h);
    sky.dark = 1 - smoothstep(0.06, 0.28, K.luminance(sky.top));
    return sky;
  }

  function repaint(g, choice) {
    const sky = skyAt(choice);
    const rand = K.rng(51);
    const late = [];
    state.sky = sky;
    state.skyArt = paintSky(g, sky, K.rng(9));
    state.back = paintBack(g, sky, rand, late);
    state.late = late;
    state.water = paintWater(g, sky, state.skyArt, state.back, state.margin);
    state.bridge = paintBridge(g, sky);
    state.fore = paintForeground(g, sky, rand);
    state.trainArt = paintTrainSprite(g, sky);
    state.boatArt = paintBoat(g, sky);
    state.clouds = paintClouds(g, sky);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function makeGlints(g) {
    const rand = K.rng(5);
    const rows = g.H - g.wy;
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      const near = i < 5;
      state.glints.push({
        x: near ? g.tx + (rand() - 0.5) * g.U * 10 : g.W * (0.05 + rand() * 0.7),
        y: rows * (0.05 + rand() * 0.45),
        w: g.U * (1 + rand() * 2.5),
        sp: 0.4 + rand() * 0.5,
        ph: rand() * TAU,
      });
    }
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.margin = Math.ceil(g.U * 2);
    state.glow = paintGlow();
    makeGlints(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.skyArt, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.back, 0, 0);
    drawLate(ctx, t);
    drawBeacon(ctx, g, t);
    drawWater(ctx, g, t);
    drawGlints(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    ctx.drawImage(state.bridge, 0, 0);
    if (props.train) drawTrain(ctx, g, t);
    ctx.drawImage(state.fore, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'dusk', train: true, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
