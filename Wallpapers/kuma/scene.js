/*
 * 熊 Kuma — a big brown bear belly-deep in a fast northern river in autumn.
 *
 * Forest, bear and head parts are baked once. Each frame slides two water
 * textures in bands, moves a few hundred foam marks, and places the head parts
 * by a turn angle, so the bear can look round at the salmon going past it.
 */
(function () {
  'use strict';

  const { lerp, fbm, smoothstep, rng } = KasuriCore;

  const RIVER_TOP = 47;
  const WATERLINE = 73;
  const SINK = 6;
  const WATER = ['#4d7270', '#5d8a8a', '#6a9a9a', '#78a8a9', '#75a6a9', '#6ea0a7', '#669aa4', '#60929e', '#5a8a98', '#527f90'];
  const BANDS = [0.1, 0.22, 0.38, 0.58, 0.8, 1];
  const FUR = ['#4a3324', '#61432d', '#7d5636', '#99703f', '#b98c50', '#d9b576'];
  const BODY = [
    [-39, -34, -30, -50, -13, -52], [-3, -53, 4, -44, 13, -40], [22, -37, 33, -40, 40, -31],
    [46, -24, 47, -12, 44, -2], [42, 6, 43, 16, 45, 27], [40, 27.4, 35, 27.6, 30, 28],
    [29, 18, 26, 12, 22, 8], [10, 13, -4, 13, -14, 8], [-16, 16, -17, 22, -16, 28],
    [-21, 28, -27, 28, -32, 28], [-32, 20, -36, 8, -40, -2], [-48, -10, -51, -20, -45, -27],
  ];
  // every: seconds from one leap to the next. clear: stays right of the rump.
  // Only x 0.5 crosses in front of the bear, and only with the salmon slider well up.
  const LANES = [
    { x: 0.2, base: 62, dist: 26, high: 22, size: 0.95, front: false, delay: 0.5, every: 7.9 },
    { x: 1.0, base: 63, dist: 24, high: 18, size: 0.85, front: false, delay: 3.1, every: 9.4 },
    { x: 0.29, base: 88, dist: 30, high: 17, size: 1.2, front: true, delay: 5.6, every: 8.4 },
    { x: 1.05, base: 92, dist: 26, high: 20, size: 1.25, front: true, delay: 7.4, every: 9.9, clear: true },
    { x: 0.15, base: 74, dist: 20, high: 26, size: 1.05, front: false, delay: 2.2, every: 8.9 },
    { x: 0.13, base: 58, dist: 16, high: 15, size: 0.7, front: false, delay: 9.2, every: 12.4 },
    { x: 1.04, base: 84, dist: 20, high: 24, size: 1.1, front: true, delay: 1.2, every: 11.9, clear: true },
    { x: 0.5, base: 95, dist: 30, high: 20, size: 1.3, front: true, delay: 11, every: 13.4 },
    { x: 0.27, base: 56, dist: 16, high: 12, size: 0.65, front: false, delay: 4.2, every: 10.4 },
    { x: 0.96, base: 57, dist: 16, high: 13, size: 0.65, front: false, delay: 6.6, every: 11.4 },
  ];
  // Seconds for p to go from 0 to 1, the arc from water line to water line.
  const AIR_TIME = 1.8;
  const SPLASH_TIME = 1.7;
  const DROPS = 14;
  const FISH_LEN = 20;
  // The sprite about its pivot, in fish lengths: nose, back fin, swinging tail.
  const OUTLINE = [[-0.38, 0.03], [0.18, 0.24], [0.62, 0.21]];
  const EARS = [-1.05, 1.05];
  const TURN_RATE = 2.5;
  const GAZE_HOLD = 1.2;
  const SLICES = 7;
  const LEAVES = 14;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, colour, points) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.fill();
  }

  function spruce(ctx, x, base, h, dark, light, rand) {
    const tiers = Math.max(4, Math.round(h / (state.g.U * 2.6)));
    const wide = h * 0.21;
    const tall = h / tiers;
    for (let i = 0; i < tiers; i++) {
      const f = (i + 1) / tiers;
      const y = base - h + (i / tiers) * h * 0.96;
      const half = wide * (0.08 + f * 0.92) * (0.85 + rand() * 0.3);
      const drop = tall * (1.05 + rand() * 0.4);
      const low = y + drop * 0.72;
      poly(ctx, dark, [x, y - tall * 0.5, x + half, y + drop, x + half * 0.4, low, x - half * 0.4, low, x - half, y + drop]);
      poly(ctx, light, [x - half * 0.08, y - tall * 0.2, x - half * 0.92, y + drop * 0.92, x - half * 0.36, y + drop * 0.6]);
    }
  }

  function ridge(ctx, g, y0, depth, scale, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.U * (y0 - fbm(x * scale / g.U, 3, 4, seed) * depth));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintSky(ctx, g, rand) {
    const steps = ['#c3cdc4', '#d0d3c3', '#dcd9c2', '#e6dfc2', '#efe4c0'];
    const each = (g.U * 34) / steps.length;
    for (let i = 0; i < steps.length; i++) {
      ctx.fillStyle = steps[i];
      ctx.fillRect(0, i * each, g.W, each + 1);
    }
    ctx.fillStyle = '#f5eccf';
    for (let i = 0; i < g.W * 0.16; i++) {
      const y = rand() * g.U * 24;
      ctx.globalAlpha = 0.25 + rand() * 0.35;
      ctx.fillRect(rand() * g.W, y, g.U * (5 + rand() * 18), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
    ridge(ctx, g, 34, 26, 0.016, 7, '#a7b6ba');
  }

  // Gold larch along the bank, out at the sides so the bear stays against dark spruce.
  function paintGroves(ctx, g, rand) {
    const u = g.U;
    for (let x = -u; x < g.W; x += u * (1.8 + rand() * 2.2)) {
      const f = x / g.W;
      if (f > 0.16 && f < 0.89) continue;
      if (fbm(x * 0.05 / u, 2, 2, 83) < 0.24) continue;
      paintLarch(ctx, x, u * 47.5, u * (8 + rand() * 9), rand);
    }
  }

  function paintForest(ctx, g, rand) {
    const u = g.U;
    ridge(ctx, g, 41, 18, 0.024, 3, '#86a096');
    for (let x = 0; x < g.W; x += u * (1.4 + rand() * 1.2)) {
      spruce(ctx, x, u * 47, u * (13 + rand() * 15), '#6a8a7b', '#86a390', rand);
    }
    for (let x = 0; x < g.W; x += u * (3 + rand() * 2.6)) {
      spruce(ctx, x, u * 47.5, u * (18 + rand() * 20), '#557568', '#769583', rand);
    }
    paintGroves(ctx, g, rand);
    paintFlank(ctx, g, rand, 0, g.W * 0.15);
    paintFlank(ctx, g, rand, g.W * 0.9, g.W * 1.02);
  }

  function paintFlank(ctx, g, rand, from, to) {
    const u = g.U;
    for (let x = from; x < to; x += u * (4 + rand() * 4)) {
      const edge = Math.min(x - from, to - x) / (to - from);
      const h = u * (30 + edge * 34 + rand() * 8);
      spruce(ctx, x, u * 49, h, '#3b5a50', '#5b7c68', rand);
    }
  }

  function paintLarch(ctx, x, base, h, rand) {
    const u = state.g.U;
    const tones = ['#d0a447', '#bb8533', '#e2bf63'];
    const n = Math.ceil((h / u) * 12);
    for (let i = 0; i < n; i++) {
      const f = rand();
      const half = h * 0.26 * Math.sin(Math.pow(1 - f, 0.8) * 2.2 + 0.1);
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(x + (rand() * 2 - 1) * half, base - h * (0.12 + f * 0.88), Math.max(1, u * 1.2), Math.max(1, u * 0.9));
    }
  }

  function paintBank(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#7f7d68';
    ctx.beginPath();
    ctx.moveTo(0, u * (RIVER_TOP + 2));
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, u * (RIVER_TOP - 1.4 - fbm(x * 0.06 / u, 2, 3, 13) * 1.6));
    ctx.lineTo(g.W, u * (RIVER_TOP + 2));
    ctx.fill();
    const stones = ['#b3ad93', '#9a9580', '#c7c1a6', '#6b6a58'];
    for (let i = 0; i < g.W * 0.7; i++) {
      ctx.fillStyle = stones[Math.floor(rand() * stones.length)];
      ctx.fillRect(rand() * g.W, u * (RIVER_TOP - 1.6 + rand() * 2), Math.max(1, u * (0.5 + rand())), Math.max(1, u * 0.5));
    }
    const brush = ['#a5532f', '#bf7a35', '#8d4a2c', '#6d7a45'];
    for (let i = 0; i < g.W * 1.6; i++) {
      const x = rand() * g.W;
      const clump = fbm(x * 0.05 / u, 4, 3, 31);
      if (clump < 0.4) continue;
      ctx.fillStyle = brush[Math.floor(rand() * brush.length)];
      ctx.fillRect(x, u * (RIVER_TOP - 6 + rand() * 4.4), Math.max(1, u * 1.1), Math.max(1, u * 0.9));
    }
  }

  function paintRiver(ctx, g, rand) {
    const u = g.U;
    const top = u * RIVER_TOP;
    const h = g.H - top;
    for (let y = Math.floor(top); y < g.H; y++) {
      ctx.fillStyle = WATER[Math.round(((y - top) / h) * 9)];
      ctx.fillRect(0, y, g.W, 1);
    }
    // The forest lies broken on the far water.
    const shades = ['#2f4a48', '#3a5854', '#c29a48', '#486a64'];
    for (let i = 0; i < g.W * 1.5; i++) {
      const shade = rand() < 0.08 ? 2 : Math.floor(rand() * 2) * 3;
      const f = rand();
      ctx.fillStyle = shades[shade];
      ctx.globalAlpha = 0.6 * (1 - f);
      ctx.fillRect(rand() * g.W, top + f * f * u * 11, u * (2 + rand() * 5), Math.max(1, u * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  // A broken white line of rapids upstream.
  function paintRapids(ctx, g, rand) {
    const u = g.U;
    const whites = ['#f1eee0', '#d9e4da', '#bcd2cc'];
    for (let i = 0; i < g.W * 2.2; i++) {
      const x = rand() * g.W;
      const line = 54 + fbm(x * 0.03 / u, 8, 3, 51) * 7;
      if (fbm(x * 0.09 / u, 2, 2, 57) < 0.36) continue;
      ctx.fillStyle = whites[Math.floor(rand() * whites.length)];
      ctx.globalAlpha = 0.45 + rand() * 0.55;
      ctx.fillRect(x, u * (line + (rand() - 0.5) * 3.4), u * (1 + rand() * 4), Math.max(1, u * 0.6));
    }
    ctx.globalAlpha = 1;
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintForest(ctx, g, rand);
    paintBank(ctx, g, rand);
    paintRiver(ctx, g, rand);
    paintRapids(ctx, g, rand);
    return c;
  }

  // One seamless sheet of dashes. They grow toward the viewer; a mark near the
  // edge is drawn twice so the sheet tiles without a seam.
  function paintFlow(g, rand, tones, count, seed) {
    const w = Math.ceil(Math.max(g.W, g.U * 150) * 1.2);
    const h = Math.ceil(g.H - g.U * RIVER_TOP);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const f = Math.pow(rand(), 0.8);
      const y = f * h;
      const braid = lerp(fbm(x * 0.02, y * 0.2, 2, seed), fbm((x - w) * 0.02, y * 0.2, 2, seed), x / w);
      if (braid < 0.42 + rand() * 0.12) continue;
      const len = g.U * (2.5 + f * f * 20) * (0.6 + rand());
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.globalAlpha = 0.28 + rand() * 0.4;
      const thick = Math.max(1, g.U * (0.25 + f * 0.75));
      ctx.fillRect(x, y, len, thick);
      if (x + len > w) ctx.fillRect(x - w, y, len, thick);
    }
    return c;
  }

  function drawFlow(ctx, g, sheet, t, rate) {
    const w = sheet.width;
    const h = sheet.height;
    const top = g.U * RIVER_TOP;
    let from = 0;
    for (let i = 0; i < BANDS.length; i++) {
      const to = Math.ceil(BANDS[i] * h);
      const f = (i + 1) / BANDS.length;
      const shift = (t * g.U * rate * lerp(3, 26, f * f)) % w;
      const sh = to - from;
      ctx.drawImage(sheet, 0, from, w, sh, shift, top + from, w, sh);
      ctx.drawImage(sheet, 0, from, w, sh, shift - w, top + from, w, sh);
      from = to;
    }
  }

  function traceBody(ctx, b) {
    ctx.beginPath();
    ctx.moveTo(-45 * b, -27 * b);
    for (const c of BODY) ctx.bezierCurveTo(c[0] * b, c[1] * b, c[2] * b, c[3] * b, c[4] * b, c[5] * b);
    ctx.closePath();
  }

  // How lit the coat is at a point: top of the back bright, belly and creases dark.
  function coatLight(x, y) {
    const top = 1 - smoothstep(-52, 6, y);
    const shoulder = Math.exp(-(((x + 20) / 13) ** 2 + ((y + 24) / 20) ** 2)) * 0.3;
    const hip = Math.exp(-(((x - 28) / 11) ** 2 + ((y + 20) / 14) ** 2)) * 0.3;
    const behind = Math.exp(-(((x - 3) / 5) ** 2 + ((y + 10) / 26) ** 2)) * 0.34;
    const flank = Math.exp(-(((x - 14) / 5) ** 2 + ((y + 8) / 20) ** 2)) * 0.2;
    const neck = Math.exp(-(((x + 37) / 5) ** 2 + ((y + 14) / 16) ** 2)) * 0.3;
    return 0.15 + top * 0.66 + shoulder + hip - behind - flank - neck;
  }

  function coatTone(x, y, jitter) {
    const shag = (fbm(x * 0.16, y * 0.34, 2, 71) - 0.5) * 0.5;
    const v = coatLight(x, y) + shag + jitter;
    return FUR[Math.max(0, Math.min(FUR.length - 1, Math.floor(v * FUR.length)))];
  }

  function paintCoat(ctx, b, rand) {
    const step = 2;
    for (let y = -56; y < 12; y += step) {
      for (let x = -54; x < 52; x += step) {
        ctx.fillStyle = coatTone(x, y, 0);
        ctx.fillRect(x * b, y * b, step * b + 1, step * b + 1);
      }
    }
    const count = Math.ceil(106 * 66 * b * b * 0.28);
    ctx.lineWidth = Math.max(1, b * 0.7);
    for (let i = 0; i < count; i++) {
      const x = -54 + rand() * 106;
      const y = -56 + rand() * 66;
      const a = 0.9 + (y + 50) * 0.012 + (rand() - 0.5) * 0.5 - (x < -18 ? 0.6 : 0);
      const len = b * (2.5 + rand() * 4);
      const tone = coatTone(x, y, (rand() - 0.5) * (rand() < 0.22 ? 0.8 : 0.2));
      bar(ctx, tone, ctx.lineWidth, x * b, y * b, x * b + Math.cos(a) * len, y * b + Math.sin(a) * len);
    }
  }

  // Shaggy tufts over the outline so the back is never one clean curve.
  function paintTufts(ctx, b, rand) {
    const line = [[-44, -29], [-38, -37], [-31, -45], [-22, -50], [-13, -53], [-3, -51], [4, -46], [13, -41],
      [22, -38], [31, -38], [38, -33], [43, -26], [46, -16], [46, -6]];
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, b * 1.1);
    for (let i = 0; i < 90; i++) {
      const f = rand() * (line.length - 1);
      const n = Math.floor(f);
      const x = lerp(line[n][0], line[n + 1][0], f - n);
      const y = lerp(line[n][1], line[n + 1][1], f - n);
      const a = 0.5 + rand() * 0.6 + (x > 38 ? 0.5 : 0);
      const tone = FUR[3 + Math.floor(rand() * 3)];
      bar(ctx, tone, ctx.lineWidth, (x - 1.5) * b, (y + 1) * b, (x - 1.5 + Math.cos(a) * 4) * b, (y + Math.sin(a) * 4 - 0.2) * b);
    }
  }

  function paintBody(b, rand) {
    const size = 120 * b;
    const c = layer(size, 90 * b);
    const ctx = c.getContext('2d');
    ctx.translate(size * 0.47, 56 * b);
    ctx.save();
    traceBody(ctx, b);
    ctx.fillStyle = FUR[1];
    ctx.fill();
    ctx.clip();
    paintCoat(ctx, b, rand);
    ctx.fillStyle = '#54392a';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-60 * b, -9 * b, 120 * b, 40 * b);
    ctx.strokeStyle = '#ddb672';
    ctx.lineWidth = Math.max(1, b * 1.8);
    ctx.globalAlpha = 0.75;
    traceBody(ctx, b);
    ctx.stroke();
    ctx.restore();
    paintTufts(ctx, b, rand);
    return c;
  }

  // The same shape seen through water: one flat cold shadow.
  function paintUnder(b) {
    const c = layer(120 * b, 90 * b);
    const ctx = c.getContext('2d');
    ctx.translate(120 * b * 0.47, 56 * b);
    traceBody(ctx, b);
    ctx.fillStyle = '#3d3a36';
    ctx.fill();
    return c;
  }

  function paintSkull(R, rand) {
    const size = R * 3;
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.beginPath();
    ctx.moveTo(-R * 0.72, -R * 0.74);
    ctx.quadraticCurveTo(0, -R * 1.12, R * 0.72, -R * 0.74);
    ctx.quadraticCurveTo(R * 1.24, -R * 0.2, R * 1.08, R * 0.34);
    ctx.quadraticCurveTo(R * 0.72, R * 1.02, 0, R * 1);
    ctx.quadraticCurveTo(-R * 0.72, R * 1.02, -R * 1.08, R * 0.34);
    ctx.quadraticCurveTo(-R * 1.24, -R * 0.2, -R * 0.72, -R * 0.74);
    ctx.closePath();
    ctx.fillStyle = FUR[2];
    ctx.fill();
    ctx.clip();
    for (let i = 0; i < 700; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand()) * R * 1.2;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      const v = 0.72 - (y / R) * 0.34 + (rand() - 0.5) * 0.28 - (x / R) * 0.08;
      const tone = FUR[Math.max(0, Math.min(FUR.length - 1, Math.floor(v * FUR.length)))];
      bar(ctx, tone, Math.max(1, R * 0.07), x, y, x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2);
    }
    return c;
  }

  function paintEar(r) {
    const c = layer(r * 2.4, r * 2.4);
    const ctx = c.getContext('2d');
    const m = r * 1.2;
    ctx.fillStyle = FUR[3];
    ctx.beginPath();
    ctx.arc(m, m, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = FUR[0];
    ctx.beginPath();
    ctx.arc(m, m + r * 0.18, r * 0.58, 0, 6.3);
    ctx.fill();
    return c;
  }

  function drawEye(ctx, x, y, r) {
    ctx.fillStyle = '#1e1613';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.15, r, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#efe6cf';
    ctx.fillRect(x - r * 0.5, y - r * 0.6, Math.max(1, r * 0.5), Math.max(1, r * 0.5));
  }

  function bar(ctx, colour, width, x0, y0, x1, y1) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function drawMuzzle(ctx, R, turn, pitch) {
    const side = Math.sin(turn);
    const baseX = side * R * 0.35;
    const baseY = R * 0.24 + pitch * R * 0.1;
    const tipX = side * R * 1.5;
    const tipY = R * 0.36 + pitch * R * 0.34 + (1 - Math.abs(side)) * R * 0.04;
    ctx.lineCap = 'round';
    bar(ctx, '#6d4a2e', R * 0.84, baseX, baseY + R * 0.1, tipX, tipY + R * 0.1);
    bar(ctx, '#b48d5e', R * 0.68, baseX, baseY, tipX, tipY);
    ctx.fillStyle = '#211714';
    ctx.beginPath();
    ctx.ellipse(tipX + side * R * 0.3, tipY - R * 0.12, R * (0.25 + Math.abs(side) * 0.03), R * 0.19, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = Math.max(1, R * 0.07);
    ctx.beginPath();
    ctx.moveTo(tipX + side * R * 0.28, tipY + R * 0.14);
    ctx.quadraticCurveTo(lerp(baseX, tipX, 0.5), tipY + R * 0.36, baseX - side * R * 0.2, tipY + R * 0.18);
    ctx.stroke();
  }

  function drawHead(ctx, hx, hy, R, turn, pitch) {
    const ear = state.ear;
    const em = ear.width / 2;
    for (let i = 0; i < 2; i++) {
      const a = turn + EARS[i];
      ctx.drawImage(ear, hx + Math.sin(a) * R * 0.92 - em, hy - R * 0.86 + pitch * R * 0.12 - em);
    }
    ctx.drawImage(state.skull, hx - R * 1.5, hy - R * 1.5);
    const eyeY = hy - R * 0.2 + pitch * R * 0.2;
    for (let i = -1; i <= 1; i += 2) {
      const a = turn + i * 0.5;
      if (Math.cos(a) > 0.2) drawEye(ctx, hx + Math.sin(a) * R * 0.86, eyeY, R * 0.1);
    }
    ctx.save();
    ctx.translate(hx, hy);
    drawMuzzle(ctx, R, turn, pitch);
    ctx.restore();
  }

  function paintSalmon(L) {
    const c = layer(L * 1.2, L * 0.5);
    const ctx = c.getContext('2d');
    const my = c.height / 2;
    const px = (f) => L * (0.1 + f);
    ctx.fillStyle = '#b8442d';
    ctx.beginPath();
    ctx.moveTo(px(0), my + L * 0.02);
    ctx.bezierCurveTo(px(0.16), my - L * 0.2, px(0.55), my - L * 0.17, px(0.86), my - L * 0.03);
    ctx.lineTo(px(1), my - L * 0.13);
    ctx.lineTo(px(0.97), my);
    ctx.lineTo(px(1), my + L * 0.13);
    ctx.lineTo(px(0.86), my + L * 0.03);
    ctx.bezierCurveTo(px(0.55), my + L * 0.17, px(0.16), my + L * 0.17, px(0), my + L * 0.02);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (const [colour, y, h, w] of [
      ['#d8664a', my - L * 0.05, L * 0.09, c.width], ['#ecdcc2', my + L * 0.08, L * 0.12, c.width],
      ['#7d2f24', my - L * 0.22, L * 0.12, c.width], ['#62713f', 0, c.height, px(0.24)],
      ['#c6c9a4', my + L * 0.05, L * 0.15, px(0.24)],
    ]) {
      ctx.fillStyle = colour;
      ctx.fillRect(0, y, w, h);
    }
    ctx.restore();
    ctx.fillStyle = '#efe6cf';
    ctx.fillRect(px(0.09), my - L * 0.07, Math.max(1, L * 0.05), Math.max(1, L * 0.05));
    poly(ctx, '#7d2f24', [px(0.42), my - L * 0.14, px(0.56), my - L * 0.23, px(0.62), my - L * 0.12]);
    return c;
  }

  // Seconds since this lane's fish broke the surface; fish, splash and gaze share it.
  const laneClock = (lane, t) => (t + lane.delay) % lane.every;
  // p runs past 0..1 at both ends: below 0 or above 1 the fish is partly under water.
  const lanePhase = (lane, clock) => lane.p0 + clock / AIR_TIME;
  const fishX = (g, lane, p) => lane.px - lane.dist * g.U * p;
  const fishY = (g, lane, p) => lane.base * g.U - lane.high * g.U * 4 * p * (1 - p);
  const fishAngle = (lane, p) => Math.atan2(lane.high * 4 * (1 - 2 * p), lane.dist) * 0.72;

  // The highest (dir -1) or lowest (dir 1) point of the fish at phase p.
  function fishEdge(g, lane, p, dir) {
    const a = fishAngle(lane, p);
    let reach = -1e9;
    for (const [along, half] of OUTLINE) reach = Math.max(reach, dir * along * Math.sin(a) + half * Math.cos(a));
    return fishY(g, lane, p) + dir * reach * g.U * FISH_LEN * lane.size;
  }

  // Runs the flight on until the whole sprite is under the clip line at each end,
  // and notes how far in the nose first touches, which is when the entry splash goes up.
  function solveFlight(g, lane) {
    const base = lane.base * g.U;
    let p0 = 0;
    let p1 = 1;
    let touch = 0.5;
    while (fishEdge(g, lane, p0, -1) < base) p0 -= 0.01;
    while (fishEdge(g, lane, p1, -1) < base) p1 += 0.01;
    while (fishEdge(g, lane, touch, 1) < base) touch += 0.01;
    return { ...lane, p0, p1, touch: (touch - p0) * AIR_TIME };
  }

  function drawFish(ctx, g, lane, p, t) {
    const sprite = state.salmon;
    const w = sprite.width;
    const h = sprite.height;
    const each = w / SLICES;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, g.W, lane.base * g.U);
    ctx.clip();
    ctx.translate(fishX(g, lane, p), fishY(g, lane, p));
    ctx.rotate(fishAngle(lane, p));
    ctx.scale(lane.size, lane.size);
    for (let i = 0; i < SLICES; i++) {
      const f = i / SLICES;
      const bend = Math.sin(t * 7 - f * 4) * f * f * g.U * 1.5;
      ctx.drawImage(sprite, i * each, 0, each + 0.5, h, i * each - w * 0.4, bend - h / 2, each + 0.5, h);
    }
    ctx.restore();
  }

  // A heap of foam hides the cut where the body meets the surface, then thins to a ring.
  function drawSplash(ctx, g, x, y, age, size, seed) {
    const f = age / SPLASH_TIME;
    if (f < 0 || f >= 1) return;
    const u = g.U * size;
    const fade = 1 - f;
    const rise = Math.sqrt(f);
    ctx.fillStyle = '#f0ede0';
    ctx.globalAlpha = fade * fade;
    ctx.beginPath();
    ctx.ellipse(x, y, u * (4 + f * 5), u * (1.2 + f), 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = fade * 0.9;
    for (let i = 0; i < DROPS; i++) {
      const a = state.dropA[(i + seed) % state.dropA.length];
      const v = state.dropV[(i + seed) % state.dropV.length];
      const px = x + Math.cos(a) * v * u * rise * 8;
      const py = y - Math.sin(a) * v * u * rise * 9 + f * f * u * 11;
      ctx.fillRect(px, Math.min(py, y), Math.max(1, u * 0.8), Math.max(1, u * 0.7));
    }
    ctx.strokeStyle = '#e6eadf';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.ellipse(x, y, u * (4 + f * 7), u * (1.2 + f * 1.6), 0, 0, 6.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawLanes(ctx, g, t, front, active) {
    for (let i = 0; i < active; i++) {
      const lane = state.lanes[i];
      if (lane.front !== front) continue;
      const clock = laneClock(lane, t);
      const p = lanePhase(lane, clock);
      if (p < lane.p1) drawFish(ctx, g, lane, p, t);
      const y = lane.base * g.U;
      drawSplash(ctx, g, fishX(g, lane, 0), y, clock, lane.size, i * 3);
      drawSplash(ctx, g, fishX(g, lane, 1), y, clock - lane.touch, lane.size, i * 3 + 4);
    }
  }

  // The airborne fish nearest the bear's nose, or null.
  function nearestFish(g, t, hx, active) {
    let best = null;
    let bestDist = 1e9;
    for (let i = 0; i < active; i++) {
      const lane = state.lanes[i];
      const p = lanePhase(lane, laneClock(lane, t));
      if (p < 0 || p > 1) continue;
      const d = Math.abs(fishX(g, lane, p) - hx);
      if (d < bestDist) {
        bestDist = d;
        best = lane;
      }
    }
    return best;
  }

  // The bear follows that fish down and holds the look a moment before gazing upstream.
  function watchFish(g, t, dt, hx, hy, active) {
    const lane = nearestFish(g, t, hx, active);
    if (lane) {
      const p = lanePhase(lane, laneClock(lane, t));
      state.wantTurn = Math.max(-1.3, Math.min(0.6, (fishX(g, lane, p) - hx) / (g.U * 40)));
      state.wantPitch = Math.max(-0.7, Math.min(0.9, (fishY(g, lane, p) - hy) / (g.U * 26)));
      state.hold = GAZE_HOLD;
    } else if (state.hold > 0) {
      state.hold -= dt;
    } else {
      state.wantTurn = -0.8 + Math.sin(t * 0.17) * 0.4;
      state.wantPitch = 0.25 + Math.sin(t * 0.23) * 0.2;
    }
    const k = Math.min(1, dt * TURN_RATE);
    state.turn += (state.wantTurn - state.turn) * k;
    state.pitch += (state.wantPitch - state.pitch) * k;
  }

  function makeFoam(rand, count) {
    return Float32Array.from({ length: count * 5 }, (_, i) => rand() + (i % 5 === 2 ? 0.5 : 0));
  }

  // Waterline: white marks hugging the flank, running downstream.
  function drawLineFoam(ctx, g, f, from, to, x0, x1, y, t, rate) {
    const u = g.U;
    for (let i = from; i < to; i++) {
      const j = i * 5;
      const p = (t * rate * 0.16 * f[j + 2] + f[j]) % 1;
      const x = lerp(x0, x1, p);
      const heap = 1 + Math.sin(p * 9 + f[j + 3] * 2 + t * 0.7) * 0.5 + (1 - p) * (1 - p) * 1.6;
      const py = y - f[j + 1] * f[j + 1] * u * 2.6 * heap + f[j + 4] * u * 2.6 + Math.sin(t * 2.2 + f[j + 3] * 6.28) * u * 0.5;
      ctx.globalAlpha = 0.55 + f[j + 3] * 0.45;
      ctx.fillRect(x, py, u * (0.8 + f[j + 3] * 3.2), Math.max(1, u * (0.35 + f[j + 4] * 0.6)));
    }
  }

  // Wake: from behind the rump the marks fan out and thin.
  function drawWake(ctx, g, f, from, to, x0, y, t, rate) {
    const u = g.U;
    const reach = u * 62;
    for (let i = from; i < to; i++) {
      const j = i * 5;
      const p = (t * rate * 0.22 * f[j + 2] + f[j]) % 1;
      const spread = (f[j + 1] - 0.42) * (u * 4 + p * u * 16);
      ctx.globalAlpha = (1 - p) * (0.5 + f[j + 3] * 0.5);
      ctx.fillRect(x0 + p * reach, y + spread, u * (1.6 + p * 6) * (0.5 + f[j + 3]), Math.max(1, u * (0.55 + f[j + 4] * 0.6)));
    }
  }

  // Bow: water heaping on the chest and curling away.
  function drawBow(ctx, g, f, from, to, x, y, t, rate) {
    const u = g.U;
    for (let i = from; i < to; i++) {
      const j = i * 5;
      const p = (t * rate * 0.5 * f[j + 2] + f[j]) % 1;
      const a = lerp(3.5, 1.2, f[j + 1]);
      const r = u * (3 + f[j + 3] * 8 + p * 9);
      const px = x + Math.cos(a) * r * 1.2 + p * u * 5;
      const py = y + Math.sin(a) * r * 0.5 - Math.sin(p * Math.PI) * u * 8 * f[j + 4];
      ctx.globalAlpha = 1 - p * 0.7;
      ctx.fillRect(px, py, u * (1 + f[j + 3] * 2.4), Math.max(1, u * 0.9));
    }
  }

  function paintRock(ctx, g, rand, x, y, w, h) {
    ctx.fillStyle = '#88948c';
    ctx.beginPath();
    ctx.moveTo(x - w, y + h);
    ctx.bezierCurveTo(x - w, y - h * 0.3, x - w * 0.5, y - h, x, y - h);
    ctx.bezierCurveTo(x + w * 0.6, y - h, x + w, y - h * 0.2, x + w, y + h);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const tones = ['#a4ad9e', '#76838a', '#c3c8ae', '#a6b565', '#8ca058'];
    for (let i = 0; i < w * h * 0.5; i++) {
      const py = y - h + rand() * h * 2;
      const lit = 1 - (py - (y - h)) / (h * 2);
      const moss = rand() < lit * 0.6;
      ctx.fillStyle = moss ? tones[3 + Math.floor(rand() * 2)] : tones[Math.floor(rand() * 3)];
      ctx.fillRect(x - w + rand() * w * 2, py, Math.max(1, g.U * 1.4), Math.max(1, g.U * 0.6));
    }
    ctx.restore();
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintRock(ctx, g, rand, g.W * 0.05, u * 95, u * 15, u * 10);
    paintRock(ctx, g, rand, g.W * 0.16, u * 99, u * 10, u * 6);
    paintRock(ctx, g, rand, g.W * 0.96, u * 96, u * 14, u * 9);
    return c;
  }

  function drawLeaves(ctx, g, t) {
    const list = state.leaves;
    const size = Math.max(1, g.U * 0.8);
    ctx.fillStyle = '#dcae52';
    for (let i = 0; i < LEAVES; i++) {
      const j = i * 5;
      const p = (t * (0.03 + list[j + 2] * 0.02) + list[j + 1]) % 1;
      const spin = list[j + 3] * 6.28;
      const x = ((list[j] + p * 0.3) % 1) * g.W + Math.sin(t * 0.7 + spin) * g.U * 3;
      ctx.fillRect(x, p * g.U * 72, size * (1 + Math.abs(Math.sin(t + spin))), size);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = rng(api.seed);
    state.g = g;
    const b = g.U * 0.86 * Math.min(1, g.W / (g.U * 150));
    state.b = b;
    state.bx = g.W * 0.6;
    state.wy = g.U * WATERLINE;
    state.R = b * 13;
    state.world = paintWorld(g, rand);
    state.flowA = paintFlow(g, rand, ['#9cc1bf', '#84adb0', '#b8d2cc'], Math.ceil(g.W * g.H * 0.3), 5);
    state.flowB = paintFlow(g, rand, ['#3f6672', '#d8e4da', '#4e7b85', '#a9c8c4'], Math.ceil(g.W * g.H * 0.22), 23);
    state.body = paintBody(b, rand);
    state.under = paintUnder(b);
    state.skull = paintSkull(state.R, rand);
    state.ear = paintEar(state.R * 0.31);
    state.salmon = paintSalmon(g.U * FISH_LEN);
    state.front = paintFront(g, rand);
    state.foam = makeFoam(rand, 430);
    state.leaves = makeFoam(rand, LEAVES);
    state.dropA = Float32Array.from({ length: 31 }, () => 0.3 + rand() * 2.5);
    state.dropV = Float32Array.from({ length: 29 }, () => 0.4 + rand() * 0.8);
    const rump = state.bx + 47 * b + g.U * 2.2;
    state.lanes = LANES.map((l) => solveFlight(g, { ...l, px: l.clear ? Math.max(l.x * g.W, rump + l.dist * g.U) : l.x * g.W }));
    state.turn = state.wantTurn = -0.8;
    state.pitch = state.wantPitch = 0.2;
    state.hold = 0;
  }

  // Only the part below the waterline, wavering a little more with depth.
  function drawUnder(ctx, g, t, x) {
    const b = state.b;
    const c = state.under;
    const top = (56 - SINK) * b;
    const rows = 8;
    const sh = (28 * b) / rows;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < rows; i++) {
      const wob = Math.sin(t * 1.9 + i * 1.3) * g.U * (0.4 + i * 0.16);
      ctx.drawImage(c, 0, top + i * sh, c.width, sh + 0.5, x - c.width * 0.47 + wob, state.wy + i * sh, c.width, sh + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  function drawBody(ctx, g, x, y, rock) {
    const b = state.b;
    const c = state.body;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, g.W, state.wy + g.U * 0.3);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(rock);
    ctx.drawImage(c, -c.width * 0.47, -56 * b);
    ctx.restore();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const flow = api.props.flow;
    const active = Math.round(api.props.salmon * 5);
    const lean = Math.sin(t * 0.24);
    const x = state.bx + lean * g.U * 2.2;
    const y = state.wy + SINK * state.b + Math.sin(t * 0.48 + 1) * g.U * 0.5;
    const rock = lean * 0.018;
    const b = state.b;
    const hx = x - 53 * b + state.turn * g.U * 2.5;
    const hy = y - 29 * b + state.pitch * g.U * 2.5 + lean * g.U * 0.7;

    watchFish(g, t, dt, hx, hy, active);
    ctx.drawImage(state.world, 0, 0);
    drawUnder(ctx, g, t, x);
    drawFlow(ctx, g, state.flowA, t, flow * 0.75);
    drawFlow(ctx, g, state.flowB, t, flow);
    drawLanes(ctx, g, t, false, active);
    drawBody(ctx, g, x, y, rock);
    ctx.fillStyle = '#f2efe2';
    drawLineFoam(ctx, g, state.foam, 0, 170, x - 45 * b, x + 45 * b, state.wy, t, flow);
    drawWake(ctx, g, state.foam, 170, 320, x + 40 * b, state.wy + g.U * 0.6, t, flow);
    drawBow(ctx, g, state.foam, 320, 430, x - 42 * b, state.wy, t, flow);
    ctx.globalAlpha = 1;
    drawHead(ctx, hx, hy, state.R, state.turn, state.pitch);
    drawLanes(ctx, g, t, true, active);
    ctx.drawImage(state.front, 0, 0);
    drawLeaves(ctx, g, t);
  }

  Kasuri.run({
    defaults: { flow: 1, salmon: 1, ramp: 'lines', cell: 7, boost: 0.08, gain: 1, dither: 0.25 },
    maxFps: 24,
    setup,
    draw,
  });
})();
