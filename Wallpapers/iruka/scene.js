/*
 * 海豚 Iruka — a pod of dolphins arcing out of a calm evening sea, off a green headland.
 *
 * Sky, land and water are baked; the sea is one texture cut into rows that slide
 * at their own pace. Each dolphin is a short spine in reused typed arrays, on a
 * parabola worked out from the clock, so nothing is allocated while it flies.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const HORIZON = 0.55;
  const SUN_X = 0.62;
  const LAND_X = 0.35;
  const ROWS = 14;
  const SPINE = 24;
  const MID = 11;
  const BEND = 0.85;
  const S_FROM = -0.25;
  const S_TO = 1.25;
  const SPLASH_LIFE = 2.2;
  const DROPS = 24;
  const FOAM = 16;

  const SKY = [[0, '#5068a0'], [0.32, '#7078aa'], [0.6, '#b88c98'], [0.84, '#eeaa74'], [1, '#f8d492']];
  const SEA = [[0, '#d4ae94'], [0.12, '#a2929c'], [0.42, '#627a9e'], [1, '#3e5a84']];
  const WAVE_LIGHT = ['#a0acc2', '#bab0b4', '#8a9cb8', '#d0b49a'];
  const WAVE_DARK = ['#2d3f66', '#364b72', '#42577e'];
  const GOLD = ['#f7dc94', '#efb965', '#fff0c4', '#e29a55'];
  const GREENS = ['#3a5a44', '#4a6e46', '#5f8748', '#80a04e', '#aab456'];
  const ROCKS = ['#5e5662', '#7a6a5e', '#9a826a', '#bb9c76'];

  // Nose to tail, as a share of body length: back height and belly depth.
  const PROFILE = [
    [0, 0.002, 0.002], [0.03, 0.01, 0.012], [0.07, 0.015, 0.019], [0.085, 0.03, 0.024],
    [0.125, 0.064, 0.042], [0.2, 0.087, 0.072], [0.3, 0.1, 0.098], [0.4, 0.103, 0.104],
    [0.5, 0.094, 0.094], [0.6, 0.078, 0.072], [0.7, 0.058, 0.048], [0.8, 0.036, 0.03],
    [0.9, 0.02, 0.017], [1, 0.011, 0.01],
  ];

  // Far to near. x is a share of the width; the rest is in units of g.U, and seconds.
  const POD = [
    { rank: 5, x: 0.46, water: 60.5, len: 10, span: 24, rise: 10, leap: 3.6, rest: 2.3, at: 2.0 },
    { rank: 6, x: 0.91, water: 61.5, len: 11, span: 26, rise: 11, leap: 3.8, rest: 2.5, at: 5.2 },
    { rank: 4, x: 0.76, water: 64, len: 15, span: 35, rise: 15, leap: 4.2, rest: 2.3, at: 0.6 },
    { rank: 3, x: 0.46, water: 68, len: 19, span: 42, rise: 19, leap: 4.6, rest: 2.2, at: 6.3 },
    { rank: 2, x: 0.87, water: 73, len: 25, span: 54, rise: 25, leap: 5.0, rest: 2.4, at: 1.9 },
    { rank: 1, x: 0.34, water: 78, len: 29, span: 62, rise: 29, leap: 5.4, rest: 2.0, at: 3.7 },
    { rank: 0, x: SUN_X, water: 83, len: 41, span: 88, rise: 39, leap: 6.0, rest: 1.4, at: 6.5 },
  ];

  // Near rocks, from the corner, back to front: x, y, size in units of g.U.
  const BOULDERS = [[3, 89, 12], [22, 93, 9], [37, 97, 6], [10, 100, 12], [31, 103, 8], [47, 102, 4]];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function fillStops(ctx, y0, y1, w, stops) {
    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [at, colour] of stops) grad.addColorStop(at, colour);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, w, y1 - y0 + 1);
  }

  function paintWorld(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    fillStops(ctx, 0, g.hy, g.W, SKY);
    fillStops(ctx, g.hy, g.H, g.W, SEA);
    paintSunGlow(ctx, g);
    ctx.save();
    ctx.translate(g.sunX, g.hy);
    ctx.scale(1, (g.H - g.hy) / (g.U * 34));
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, g.U * 34);
    pool.addColorStop(0, 'rgba(240,180,110,0.42)');
    pool.addColorStop(1, 'rgba(240,180,110,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(-g.U * 34, 0, g.U * 68, g.U * 34);
    ctx.restore();
    return c;
  }

  function paintSunGlow(ctx, g) {
    const y = g.sunY;
    const glow = ctx.createRadialGradient(g.sunX, y, 0, g.sunX, y, g.U * 52);
    glow.addColorStop(0, 'rgba(255,226,160,0.8)');
    glow.addColorStop(0.3, 'rgba(250,190,120,0.34)');
    glow.addColorStop(1, 'rgba(250,180,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.hy);
    ctx.fillStyle = '#fdeec2';
    ctx.beginPath();
    ctx.arc(g.sunX, y, g.U * 7.5, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#d9a26c';
    ctx.fillRect(0, g.hy - 1, g.W, Math.max(1, g.U * 0.5));
  }

  // Long thin evening cloud, baked at half size and tiling sideways.
  function paintClouds(g) {
    const w = Math.ceil(g.W * 0.7);
    const h = Math.ceil(g.H * 0.22);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const scale = 2 / g.U;
    const density = (x, y) => fbm(x * scale * 0.028, y * scale * 0.15, 4, 31);
    const high = K.parseColor('#8e8cb8');
    const low = K.parseColor('#fbc69c');
    for (let y = 0; y < h; y++) {
      const f = y / h;
      const edge = Math.pow(Math.sin(f * Math.PI), 1.5);
      const tone = Math.round(f * 3) / 3;
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = lerp(high[0], low[0], tone);
        img.data[i + 1] = lerp(high[1], low[1], tone);
        img.data[i + 2] = lerp(high[2], low[2], tone);
        img.data[i + 3] = (Math.round(smoothstep(0.54, 0.7, v) * edge * 3) / 3) * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function ridgeTop(g, x) {
    const u = Math.min(1, x / g.landW);
    const fall = Math.pow(1 - u, 0.62);
    const crown = fbm((x / g.U) * 0.064, 3.1, 3, 8) - 0.45;
    const tufts = fbm((x / g.U) * 0.31, 7.7, 2, 9) - 0.5;
    return g.hy - g.U * fall * (35 + crown * 22 + tufts * 5);
  }

  function paintFarRidge(ctx, g) {
    ctx.fillStyle = '#a79aa2';
    ctx.beginPath();
    ctx.moveTo(0, g.hy);
    const end = g.W * 0.56;
    for (let x = 0; x <= end; x += 1) {
      const u = x / end;
      ctx.lineTo(x, g.hy - g.U * Math.pow(1 - u, 0.7) * (8 + fbm(x * 0.05 / g.U, 1.5, 4, 4) * 26));
    }
    ctx.lineTo(end, g.hy);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(g.W * 0.84, g.hy);
    for (let x = g.W * 0.84; x <= g.W; x += 1) {
      const u = (x - g.W * 0.84) / (g.W * 0.16);
      ctx.lineTo(x, g.hy - g.U * Math.pow(u, 0.7) * (2.5 + fbm(x * 0.06 / g.U, 5.5, 3, 6) * 7));
    }
    ctx.lineTo(g.W, g.hy);
    ctx.fill();
  }

  function paintSlope(ctx, g, rand) {
    ctx.fillStyle = GREENS[1];
    ctx.beginPath();
    ctx.moveTo(0, g.hy);
    for (let x = 0; x <= g.landW; x += 1) ctx.lineTo(x, ridgeTop(g, x));
    ctx.lineTo(g.landW, g.hy);
    ctx.fill();
    const blobs = Math.round((g.landW / g.U) * 13);
    for (let i = 0; i < blobs; i++) {
      const x = rand() * g.landW;
      const top = ridgeTop(g, x);
      const y = lerp(top + g.U, g.hy, Math.pow(rand(), 0.8));
      const light = fbm((x / g.U) * 0.07, (y / g.U) * 0.11, 3, 12) + (x / g.landW) * 0.32 - ((y - top) / (g.hy - top)) * 0.18;
      const tone = Math.max(0, Math.min(4, Math.floor(smoothstep(0.28, 0.8, light) * 5)));
      const rx = g.U * (0.5 + rand() * 1.9);
      ctx.fillStyle = GREENS[tone];
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.72, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintCliff(ctx, g, rand) {
    const count = Math.round((g.landW / g.U) * 1.8);
    for (let i = 0; i < count; i++) {
      const x = g.landW * (0.1 + 0.9 * Math.sqrt(rand()));
      const reach = g.U * (1.5 + (x / g.landW) * 5.5);
      const y = g.hy - rand() * reach;
      ctx.fillStyle = ROCKS[Math.floor(rand() * rand() * ROCKS.length + (x / g.landW) * 1.2) % ROCKS.length];
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.4, y + g.U * 0.8);
      ctx.lineTo(x - g.U * 0.2, y - g.U * (0.5 + rand() * 1.1));
      ctx.lineTo(x + g.U * (0.8 + rand()), y + g.U * 0.8);
      ctx.fill();
    }
  }

  function paintPine(ctx, g, rand, x, y, size) {
    const u = g.U * size;
    ctx.strokeStyle = '#2b2a2e';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y + u);
    ctx.quadraticCurveTo(x - u * 1.6, y - u * 3, x + u * 0.4, y - u * 6.5);
    ctx.stroke();
    const boughs = [[-2.6, -4], [1.8, -5], [-1.4, -6.6], [2, -7.4], [0.2, -8.6]];
    for (const [bx, by] of boughs) {
      const cx = x + bx * u;
      const cy = y + by * u;
      for (let i = 0; i < 16; i++) {
        const a = rand() * 6.28;
        const d = Math.sqrt(rand());
        const lit = Math.sin(a) < -0.2 && Math.cos(a) > -0.3;
        ctx.fillStyle = lit ? '#54703f' : rand() < 0.5 ? '#233a30' : '#2d4a36';
        ctx.fillRect(cx + Math.cos(a) * d * u * 2.1, cy + Math.sin(a) * d * u * 0.8, Math.max(1, u * (0.4 + rand() * 0.6)), Math.max(1, u * 0.4));
      }
    }
  }

  function paintLand(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarRidge(ctx, g);
    paintSlope(ctx, g, rand);
    paintCliff(ctx, g, rand);
    const pines = [[0.1, 1], [0.26, 0.85], [0.44, 1.15], [0.6, 0.8], [0.76, 0.95]];
    for (const [f, size] of pines) {
      const x = g.landW * f;
      paintPine(ctx, g, rand, x, ridgeTop(g, x) + g.U, size);
    }
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.rect(0, g.hy, g.W, g.H - g.hy);
    ctx.clip();
    ctx.translate(0, g.hy);
    ctx.scale(1, -0.62);
    ctx.translate(0, -g.hy);
    ctx.drawImage(c, 0, 0);
    ctx.restore();
    return c;
  }

  function polygon(ctx, points) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // A rock of flat planes: dark foot, shaded left face, sunlit right face, a bright edge.
  function paintBoulder(ctx, g, rand, b) {
    const x = b[0] * g.U;
    const y = b[1] * g.U;
    const r = b[2] * g.U;
    const j = () => (rand() - 0.5) * r * 0.3;
    const peak = [x + r * 0.22 + j(), y - r * 0.62 + j() * 0.5];
    const left = [x - r * 1.25, y + r * 0.5];
    const right = [x + r * 1.3, y + r * 0.5];
    const shoulderL = [x - r * 0.62 + j(), y - r * 0.44 + j() * 0.5];
    const shoulderR = [x + r * 0.92 + j(), y - r * 0.2 + j() * 0.5];
    const keel = [x + r * 0.28 + j(), y + r * 0.2 + j()];
    ctx.fillStyle = '#403f4c';
    polygon(ctx, [...left, ...shoulderL, ...peak, ...shoulderR, ...right, x, y + r * 0.9]);
    ctx.fillStyle = '#5f5760';
    polygon(ctx, [...left, ...shoulderL, ...peak, ...keel]);
    ctx.fillStyle = '#8c7668';
    polygon(ctx, [...peak, ...shoulderR, ...right, ...keel]);
    ctx.fillStyle = '#c3a078';
    polygon(ctx, [...peak, ...shoulderR, x + r * 0.42, y - r * 0.3]);
  }

  // The near rocks in the corner, drawn last, so the sea runs behind them.
  function paintNearRocks(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const b of BOULDERS) paintBoulder(ctx, g, rand, b);
    return c;
  }

  function rowY(g, b) {
    return g.hy + (g.H - g.hy) * Math.pow(b / ROWS, 1.7);
  }

  function waveMark(ctx, tw, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.fill();
    if (x + rx > tw) {
      ctx.beginPath();
      ctx.ellipse(x - tw, y, rx, ry, 0, 0, 6.3);
      ctx.fill();
    }
    if (x - rx < 0) {
      ctx.beginPath();
      ctx.ellipse(x + tw, y, rx, ry, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // Each mark stays inside its own row, so a row can slide without cutting one.
  function paintWaves(g, rand) {
    const tw = Math.ceil(g.W * 1.2);
    const c = layer(tw, g.H);
    const ctx = c.getContext('2d');
    for (let b = 0; b < ROWS; b++) {
      const y0 = rowY(g, b);
      const y1 = rowY(g, b + 1);
      const p = (b + 0.5) / ROWS;
      const len = g.U * (2.5 + 15 * p * p);
      const thick = Math.min((y1 - y0) * 0.42, Math.max(0.6, g.U * (0.22 + 1.1 * p)));
      const count = Math.round((tw / len) * (1.3 + (y1 - y0) / Math.max(1, thick) * 0.55));
      for (let i = 0; i < count; i++) {
        const light = rand() < 0.2 + p * 0.1;
        const list = light ? WAVE_LIGHT : WAVE_DARK;
        ctx.fillStyle = list[Math.floor(rand() * list.length)];
        ctx.globalAlpha = (0.34 + rand() * 0.34) * lerp(0.42, 1, p);
        const ry = thick * (0.5 + rand() * 0.5);
        const y = lerp(y0 + ry, y1 - ry, rand());
        waveMark(ctx, tw, rand() * tw, y, len * (0.4 + rand() * 0.8), ry);
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function drawSea(ctx, g, t) {
    const tex = state.waves;
    const tw = tex.width;
    for (let b = 0; b < ROWS; b++) {
      const y0 = state.rows[b];
      const h = state.rows[b + 1] - y0;
      const p = (b + 0.5) / ROWS;
      const off = (t * g.U * (0.5 + p * 7)) % tw;
      const bob = Math.sin(t * 0.55 + b * 1.7) * p * g.U * 0.5;
      ctx.drawImage(tex, 0, y0, tw, h, -off, y0 + bob, tw, h);
      ctx.drawImage(tex, 0, y0, tw, h, tw - off, y0 + bob, tw, h);
    }
  }

  function makeGoldPath(g, rand) {
    const rows = 34;
    const list = [];
    for (let r = 0; r < rows; r++) {
      const p = Math.pow((r + 0.5) / rows, 1.6);
      const count = 4 + Math.round(p * 8);
      for (let i = 0; i < count; i++) {
        const near = rand();
        list.push({
          y: lerp(g.hy + g.U * 0.5, g.H, p),
          across: (rand() + rand() - 1) * (g.U * (3 + 25 * p)),
          sway: g.U * (0.4 + 2.2 * p),
          long: g.U * (2.4 + 5 * p),
          thick: Math.max(1, g.U * (0.3 + 0.6 * p)),
          rate: 0.5 + rand() * 1.1,
          phase: rand() * 6.28,
          ink: GOLD[near < 0.5 ? 0 : near < 0.8 ? 1 : near < 0.92 ? 2 : 3],
        });
      }
    }
    return list;
  }

  function drawGold(ctx, g, t, amount) {
    if (amount <= 0) return;
    for (const f of state.gold) {
      const on = Math.sin(t * f.rate + f.phase);
      if (on < -0.25) continue;
      const w = f.long * (0.45 + on * 0.55 + 0.25);
      ctx.fillStyle = f.ink;
      ctx.globalAlpha = Math.min(1, (0.45 + on * 0.55) * amount + 0.1);
      ctx.fillRect(g.sunX + f.across + Math.sin(t * 0.4 + f.phase) * f.sway - w / 2, f.y, w, f.thick);
    }
    ctx.globalAlpha = 1;
  }

  function fillProfile() {
    const dorsal = new Float32Array(SPINE + 1);
    const ventral = new Float32Array(SPINE + 1);
    for (let i = 0; i <= SPINE; i++) {
      const f = i / SPINE;
      let k = 0;
      while (k < PROFILE.length - 2 && PROFILE[k + 1][0] < f) k++;
      const [f0, d0, v0] = PROFILE[k];
      const [f1, d1, v1] = PROFILE[k + 1];
      const a = (f - f0) / (f1 - f0);
      dorsal[i] = lerp(d0, d1, a);
      ventral[i] = lerp(v0, v1, a);
    }
    state.dorsal = dorsal;
    state.ventral = ventral;
    state.sx = new Float32Array(SPINE + 1);
    state.sy = new Float32Array(SPINE + 1);
    state.nx = new Float32Array(SPINE + 1);
    state.ny = new Float32Array(SPINE + 1);
  }

  // Lays the spine along the heading. Index 0 is the nose, the last is the tail.
  function shapeSpine(len, x, y, heading, flex) {
    const { sx, sy, nx, ny } = state;
    const step = len / SPINE;
    sx[MID] = x;
    sy[MID] = y;
    nx[MID] = Math.sin(heading);
    ny[MID] = -Math.cos(heading);
    for (let i = MID; i > 0; i--) {
      const a = heading + (BEND * (MID - i + 0.5)) / SPINE;
      sx[i - 1] = sx[i] + Math.cos(a) * step;
      sy[i - 1] = sy[i] + Math.sin(a) * step;
      nx[i - 1] = Math.sin(a);
      ny[i - 1] = -Math.cos(a);
    }
    for (let i = MID; i < SPINE; i++) {
      const f = (i - MID + 0.5) / (SPINE - MID);
      const a = heading - (BEND * (i - MID + 0.5)) / SPINE + flex * f * f;
      sx[i + 1] = sx[i] - Math.cos(a) * step;
      sy[i + 1] = sy[i] - Math.sin(a) * step;
      nx[i + 1] = Math.sin(a);
      ny[i + 1] = -Math.cos(a);
    }
  }

  function atX(f, off) {
    const at = Math.min(SPINE - 0.001, f * SPINE);
    const i = Math.floor(at);
    const a = at - i;
    return lerp(state.sx[i] + state.nx[i] * off, state.sx[i + 1] + state.nx[i + 1] * off, a);
  }

  function atY(f, off) {
    const at = Math.min(SPINE - 0.001, f * SPINE);
    const i = Math.floor(at);
    const a = at - i;
    return lerp(state.sy[i] + state.ny[i] * off, state.sy[i + 1] + state.ny[i + 1] * off, a);
  }

  function traceBody(ctx, len) {
    const { sx, sy, nx, ny, dorsal, ventral } = state;
    ctx.beginPath();
    ctx.moveTo(sx[0], sy[0]);
    for (let i = 1; i <= SPINE; i++) ctx.lineTo(sx[i] + nx[i] * dorsal[i] * len, sy[i] + ny[i] * dorsal[i] * len);
    for (let i = SPINE; i > 0; i--) ctx.lineTo(sx[i] - nx[i] * ventral[i] * len, sy[i] - ny[i] * ventral[i] * len);
    ctx.closePath();
  }

  function traceFin(ctx, len) {
    const d = 0.09 * len;
    ctx.moveTo(atX(0.37, d), atY(0.37, d));
    ctx.quadraticCurveTo(atX(0.47, d + 0.075 * len), atY(0.47, d + 0.075 * len), atX(0.615, d + 0.115 * len), atY(0.615, d + 0.115 * len));
    ctx.quadraticCurveTo(atX(0.54, d + 0.045 * len), atY(0.54, d + 0.045 * len), atX(0.59, 0.05 * len), atY(0.59, 0.05 * len));
    ctx.closePath();
  }

  function traceFlipper(ctx, len) {
    const b = -0.07 * len;
    ctx.moveTo(atX(0.22, b), atY(0.22, b));
    ctx.quadraticCurveTo(atX(0.26, b - 0.1 * len), atY(0.26, b - 0.1 * len), atX(0.41, b - 0.135 * len), atY(0.41, b - 0.135 * len));
    ctx.quadraticCurveTo(atX(0.34, b - 0.05 * len), atY(0.34, b - 0.05 * len), atX(0.33, -0.09 * len), atY(0.33, -0.09 * len));
    ctx.closePath();
  }

  // Flukes sit behind the tail: back runs along the body line, up across it.
  function flukeX(len, back, up) {
    return state.sx[SPINE] + (state.ny[SPINE] * back + state.nx[SPINE] * up) * len;
  }

  function flukeY(len, back, up) {
    return state.sy[SPINE] + (state.ny[SPINE] * up - state.nx[SPINE] * back) * len;
  }

  function flukeCurve(ctx, len, cb, cu, b, u) {
    ctx.quadraticCurveTo(flukeX(len, cb, cu), flukeY(len, cb, cu), flukeX(len, b, u), flukeY(len, b, u));
  }

  function traceFlukes(ctx, len) {
    ctx.moveTo(flukeX(len, -0.03, 0.012), flukeY(len, -0.03, 0.012));
    flukeCurve(ctx, len, 0.02, 0.075, 0.115, 0.115);
    flukeCurve(ctx, len, 0.075, 0.05, 0.07, 0);
    flukeCurve(ctx, len, 0.075, -0.04, 0.105, -0.085);
    flukeCurve(ctx, len, 0.02, -0.06, -0.03, -0.012);
    ctx.closePath();
  }

  function traceSilhouette(ctx, len) {
    traceBody(ctx, len);
    traceFin(ctx, len);
    traceFlukes(ctx, len);
    traceFlipper(ctx, len);
  }

  function paintMarkings(ctx, len) {
    const { sx, sy, nx, ny, dorsal, ventral } = state;
    ctx.fillStyle = '#7f92a8';
    ctx.beginPath();
    for (let i = 1; i <= SPINE - 2; i++) {
      const off = -0.15 * ventral[i] * len + 0.012 * len;
      if (i === 1) ctx.moveTo(sx[i] + nx[i] * off, sy[i] + ny[i] * off);
      else ctx.lineTo(sx[i] + nx[i] * off, sy[i] + ny[i] * off);
    }
    for (let i = SPINE - 2; i >= 1; i--) ctx.lineTo(sx[i] - nx[i] * ventral[i] * len, sy[i] - ny[i] * ventral[i] * len);
    ctx.fill();
    ctx.fillStyle = '#ecdcc0';
    ctx.beginPath();
    for (let i = 0; i <= 15; i++) {
      const off = -ventral[i] * len * (0.42 + 0.3 * smoothstep(8, 15, i));
      if (i === 0) ctx.moveTo(sx[i] + nx[i] * off, sy[i] + ny[i] * off);
      else ctx.lineTo(sx[i] + nx[i] * off, sy[i] + ny[i] * off);
    }
    for (let i = 15; i >= 0; i--) ctx.lineTo(sx[i] - nx[i] * ventral[i] * len, sy[i] - ny[i] * ventral[i] * len);
    ctx.fill();
    ctx.strokeStyle = '#ffd59a';
    ctx.lineWidth = Math.max(0.8, len * 0.018);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(sx[2] + nx[2] * dorsal[2] * len, sy[2] + ny[2] * dorsal[2] * len);
    for (let i = 3; i <= 20; i++) ctx.lineTo(sx[i] + nx[i] * dorsal[i] * len, sy[i] + ny[i] * dorsal[i] * len);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function paintFace(ctx, len) {
    if (len < 24) return;
    const size = Math.max(1, len * 0.014);
    ctx.fillStyle = '#151b2d';
    ctx.fillRect(atX(0.135, 0.004 * len) - size / 2, atY(0.135, 0.004 * len) - size / 2, size, size);
  }

  function paintDolphin(ctx, len) {
    ctx.fillStyle = '#3b4f6e';
    traceSilhouette(ctx, len);
    ctx.fill();
    paintMarkings(ctx, len);
    ctx.fillStyle = '#334563';
    ctx.beginPath();
    traceFlipper(ctx, len);
    ctx.fill();
    ctx.fillStyle = '#3b4f6e';
    ctx.beginPath();
    traceFin(ctx, len);
    ctx.fill();
    paintFace(ctx, len);
  }

  function paintUnderwater(ctx, g, d, wy, sink) {
    const len = d.px;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, wy, g.W, g.H - wy);
    ctx.clip();
    ctx.fillStyle = '#1d2a48';
    if (sink > 0) {
      ctx.globalAlpha = 0.32 * sink;
      traceSilhouette(ctx, len);
      ctx.fill();
    }
    ctx.globalAlpha = 0.3;
    ctx.translate(0, wy);
    ctx.scale(1, -0.55);
    ctx.translate(0, -wy);
    traceSilhouette(ctx, len);
    ctx.fill();
    ctx.restore();
  }

  function hash(a, b) {
    const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return v - Math.floor(v);
  }

  function fillSpray(rand) {
    state.dvx = new Float32Array(DROPS);
    state.dvy = new Float32Array(DROPS);
    state.dsz = new Float32Array(DROPS);
    state.fx = new Float32Array(FOAM);
    state.fy = new Float32Array(FOAM);
    state.fw = new Float32Array(FOAM);
    for (let i = 0; i < DROPS; i++) {
      state.dvx[i] = (rand() - 0.5) * 0.9;
      state.dvy[i] = 0.25 + rand() * 0.75;
      state.dsz[i] = 0.5 + rand() * rand() * 1.5;
    }
    for (let i = 0; i < FOAM; i++) {
      const a = rand() * 6.28;
      const r = Math.sqrt(rand());
      state.fx[i] = Math.cos(a) * r;
      state.fy[i] = Math.sin(a) * r;
      state.fw[i] = 0.3 + rand() * 0.9;
    }
  }

  function paintSpray(ctx, g, x, wy, len, age, lean) {
    if (age < 0 || age > SPLASH_LIFE) return;
    const count = Math.min(DROPS, Math.round(6 + len / g.U * 0.5));
    const lift = len * 1.15;
    const fall = len * 2.3;
    ctx.fillStyle = '#f7f1e0';
    for (let i = 0; i < count; i++) {
      const tt = age * (0.8 + state.dsz[i] * 0.2);
      const y = wy - (state.dvy[i] * lift * tt - fall * tt * tt * 0.5);
      if (y > wy) continue;
      const size = Math.max(1, g.U * 0.42 * state.dsz[i] * (0.55 + len / g.U / 40));
      ctx.globalAlpha = Math.min(1, 1.5 - tt);
      ctx.fillRect(x + (state.dvx[i] + lean) * lift * tt, y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function paintFoam(ctx, g, x, wy, len, age) {
    if (age < 0 || age > SPLASH_LIFE) return;
    const f = age / SPLASH_LIFE;
    const rx = len * (0.14 + 0.45 * Math.sqrt(f));
    const ry = rx * 0.17;
    const fade = (1 - f) * (1 - f);
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = Math.max(0.8, g.U * 0.5);
    ctx.globalAlpha = 0.75 * fade;
    ctx.beginPath();
    ctx.ellipse(x, wy, rx, ry, 0, 0, 6.3);
    ctx.stroke();
    ctx.fillStyle = '#fbf6e8';
    ctx.globalAlpha = Math.min(1, 1.25 * (1 - f));
    const inner = 1 - f * 0.45;
    for (let i = 0; i < FOAM; i++) {
      const w = state.fw[i] * len * 0.11 * inner;
      ctx.fillRect(x + state.fx[i] * rx * 0.72 - w / 2, wy + state.fy[i] * ry * 0.8, w, Math.max(1, g.U * 0.42));
    }
    ctx.globalAlpha = 1;
  }

  function paintLeap(ctx, g, d, i, t, rate) {
    const cycle = d.leap + d.rest / rate;
    const clock = t + d.at;
    const round = Math.floor(clock / cycle);
    const age = clock - round * cycle;
    const s = lerp(S_FROM, S_TO, age / d.leap);
    const x0 = d.x0 + (hash(round, i) - 0.5) * d.spanPx * 0.3;
    const exitAt = (d.leap * (0 - S_FROM)) / (S_TO - S_FROM);
    const entryAt = (d.leap * (1 - S_FROM)) / (S_TO - S_FROM);
    const xEntry = x0 + d.spanPx;
    paintFoam(ctx, g, x0 + d.px * 0.03, d.wy, d.px * 0.8, age - exitAt + 0.1);
    paintFoam(ctx, g, xEntry, d.wy, d.px, age - entryAt);
    if (age < d.leap) {
      const x = x0 + s * d.spanPx;
      const y = d.wy - d.risePx * 4 * s * (1 - s);
      const heading = Math.atan2(-4 * d.risePx * (1 - 2 * s), d.spanPx);
      shapeSpine(d.px, x, y, heading, Math.sin(t * 3.4 + i) * 0.14);
      const sink = smoothstep(S_FROM, S_FROM + 0.14, s) * (1 - smoothstep(S_TO - 0.14, S_TO, s));
      paintUnderwater(ctx, g, d, d.wy, sink);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, g.W, d.wy);
      ctx.clip();
      paintDolphin(ctx, d.px);
      ctx.restore();
    }
    paintSpray(ctx, g, x0 + d.px * 0.03, d.wy, d.px * 0.7, age - exitAt, 0.25);
    paintSpray(ctx, g, xEntry, d.wy, d.px, age - entryAt, 0.12);
  }

  function makeShoreFoam(g, rand) {
    const list = [];
    for (let i = 0; i < 26; i++) {
      const f = rand();
      list.push({ x: g.landW * f, y: g.hy + g.U * (0.2 + rand() * 1.2), w: g.U * (1 + rand() * 3), phase: rand() * 6.28, rate: 0.5 + rand() });
    }
    for (let i = 0; i < 30; i++) {
      const b = BOULDERS[Math.floor(rand() * BOULDERS.length)];
      const x = (b[0] + b[2] * (0.5 + rand() * 0.9)) * g.U;
      const y = (b[1] + b[2] * (0.25 + rand() * 0.5)) * g.U;
      list.push({ x, y, w: g.U * (1.5 + rand() * 4), phase: rand() * 6.28, rate: 0.5 + rand() });
    }
    return list;
  }

  function drawShoreFoam(ctx, g, t) {
    ctx.fillStyle = '#efe9da';
    for (const f of state.foam) {
      const on = Math.sin(t * f.rate + f.phase);
      if (on < -0.1) continue;
      ctx.globalAlpha = 0.25 + on * 0.5;
      ctx.fillRect(f.x - f.w / 2, f.y, f.w * (0.6 + on * 0.4), Math.max(1, g.U * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  function placePod(g) {
    return POD.map((d) => ({
      ...d,
      wy: d.water * g.U,
      px: d.len * g.U,
      spanPx: d.span * g.U,
      risePx: d.rise * g.U,
      x0: g.W * d.x - (d.span * g.U) / 2,
    }));
  }

  function setup(ctx, api) {
    const U = api.rows / 100;
    const g = { W: api.cols, H: api.rows, U, hy: api.rows * HORIZON, sunX: api.cols * SUN_X, sunY: api.rows * HORIZON - U * 5.5, landW: api.cols * LAND_X };
    const rand = K.rng(api.seed);
    state.g = g;
    state.world = paintWorld(g);
    state.clouds = paintClouds(g);
    state.land = paintLand(g, rand);
    state.near = paintNearRocks(g, rand);
    state.waves = paintWaves(g, rand);
    state.rows = new Float32Array(ROWS + 1);
    for (let b = 0; b <= ROWS; b++) state.rows[b] = rowY(g, b);
    state.gold = makeGoldPath(g, rand);
    state.foam = makeShoreFoam(g, rand);
    state.pod = placePod(g);
    fillProfile();
    fillSpray(rand);
  }

  function drawClouds(ctx, g, t) {
    const w = state.clouds.width * 2;
    const h = state.clouds.height * 2;
    const x = -((t * g.U * 0.45) % w);
    ctx.drawImage(state.clouds, x, g.H * 0.04, w, h);
    ctx.drawImage(state.clouds, x + w, g.H * 0.04, w, h);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { pod, shimmer, leaps } = api.props;
    ctx.drawImage(state.world, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.land, 0, 0);
    drawSea(ctx, g, t);
    drawGold(ctx, g, t, shimmer);
    for (let i = 0; i < state.pod.length; i++) {
      if (state.pod[i].rank < pod) paintLeap(ctx, g, state.pod[i], i, t, Math.max(0.2, leaps));
    }
    ctx.drawImage(state.near, 0, 0);
    drawShoreFoam(ctx, g, t);
  }

  Kasuri.run({
    defaults: { pod: 7, leaps: 1, shimmer: 1, ramp: 'lines', cell: 7, boost: 0.18, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
