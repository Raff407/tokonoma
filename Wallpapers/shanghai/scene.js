/*
 * 上海 Shanghai — the Huangpu at dusk.
 *
 * Old Jiangnan tile roofs and a pagoda on the left bank, the Pudong towers
 * rising on the right against a lighter dusk band, all doubled in the river.
 * Sky, skyline and water are baked from the clock and repainted once a
 * minute. Between repaints only clouds, the water shimmer and a lantern
 * sampan move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.6;
  const RETINT_SECONDS = 60;
  const GOLD = '#e8c66a';
  const PALE = '#f0e2b0';
  const VERMILION = '#b8442c';
  const INK = '#12162a';
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ---------------------------------------------------------------

  function skyColors(sky) {
    const day = 1 - sky.night;
    const top = sky.top;
    const mid = mixColor(sky.top, sky.low, 0.55);
    // A lighter band just above the skyline: warm at dusk, city-lit at night.
    const glow = mixColor(mixColor(sky.low, rgb('#e8b070'), 0.35 * day), rgb('#4a3a58'), sky.night * 0.45);
    return { top, mid, glow };
  }

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const col = skyColors(sky);
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(col.top));
    grad.addColorStop(0.55, hex(col.mid));
    grad.addColorStop(1, hex(col.glow));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.08, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 214;
        img.data[i + 2] = 200;
        img.data[i + 3] = smoothstep(0.5, 0.74, v) * band * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- city plan ---------------------------------------------------------

  // x is the centre as a fraction of width, w a fraction of width, h a fraction of height.
  const LANDMARKS = [
    { kind: 'pearl', x: 0.6, w: 0.05, h: 0.44 },
    { kind: 'jinmao', x: 0.72, w: 0.04, h: 0.4 },
    { kind: 'swfc', x: 0.79, w: 0.042, h: 0.45 },
    { kind: 'twist', x: 0.865, w: 0.046, h: 0.52 },
  ];

  function makeFar(rand) {
    const far = [];
    let x = 0.38;
    while (x < 1.02) {
      const w = 0.018 + rand() * 0.03;
      far.push({ x: x + w / 2, w, h: 0.08 + rand() * rand() * 0.24, spire: rand() < 0.25 });
      x += w + rand() * 0.012;
    }
    // A low hazy roofline behind the old town.
    for (let ox = -0.02; ox < 0.42; ox += 0.04 + rand() * 0.03) {
      far.push({ x: ox, w: 0.05, h: 0.04 + rand() * 0.04, spire: false });
    }
    return far;
  }

  function makeTowers(rand) {
    const towers = [];
    let x = 0.47;
    while (x < 1.02) {
      const w = 0.016 + rand() * 0.022;
      const near = Math.abs(x - 0.75) < 0.2;
      const h = (near ? 0.14 : 0.09) + Math.pow(rand(), 1.6) * 0.2;
      towers.push({ kind: rand() < 0.35 ? 'spire' : rand() < 0.5 ? 'step' : 'flat', x: x + w / 2, w, h, seed: Math.floor(rand() * 9999) });
      x += w + 0.004 + rand() * 0.02;
    }
    return towers;
  }

  // Old houses: a back row of taller halls and a front row of low shops, uneven.
  function makeOld(rand) {
    const rows = [];
    for (const [row, lo, span] of [[0, 0.07, 0.07], [1, 0.035, 0.04]]) {
      let x = row ? -0.01 : 0.01;
      while (x < (row ? 0.5 : 0.46)) {
        const w = (row ? 0.03 : 0.045) + rand() * 0.035;
        const tall = row === 0 && rand() < 0.3;
        rows.push({ row, x: x + w / 2, w, h: lo + rand() * span + (tall ? 0.05 : 0), tiers: tall ? 2 : 1, seed: Math.floor(rand() * 9999) });
        x += w + rand() * 0.02;
      }
    }
    return rows;
  }

  function makeCity(rand) {
    return { far: makeFar(rand), towers: makeTowers(rand), old: makeOld(rand), pagoda: { x: 0.31, w: 0.055, h: 0.3 } };
  }

  // ---- building colours -------------------------------------------------

  function shade(sky, depth) {
    const base = mixColor(rgb('#1d2440'), rgb('#2a3352'), 1 - sky.night);
    return mixColor(base, skyColors(sky).glow, depth);
  }

  function windows(ctx, bx, by, bw, bh, lit, rand, s, colStride) {
    for (let wy = by + s * 2; wy < by + bh - s; wy += s * 2) {
      for (let wx = bx + s; wx < bx + bw - s; wx += s * colStride) {
        if (rand() > lit) continue;
        ctx.fillStyle = rand() < 0.75 ? GOLD : PALE;
        ctx.globalAlpha = 0.6 + rand() * 0.4;
        ctx.fillRect(wx, wy, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- far haze ----------------------------------------------------------

  function paintFar(ctx, g, sky, city) {
    const base = g.H * HORIZON;
    ctx.fillStyle = hex(shade(sky, 0.55));
    for (const b of city.far) {
      const bw = b.w * g.W;
      const bh = b.h * g.H;
      const bx = b.x * g.W - bw / 2;
      ctx.fillRect(bx, base - bh, bw, bh);
      if (b.spire) ctx.fillRect(bx + bw / 2 - 0.5, base - bh - g.U * 4, Math.max(1, g.U * 0.3), g.U * 4);
    }
  }

  // ---- towers ------------------------------------------------------------

  function paintTowerBody(ctx, g, sky, b, base, lit, depth) {
    const rand = K.rng(b.seed);
    const bw = b.w * g.W;
    const bh = b.h * g.H;
    const bx = b.x * g.W - bw / 2;
    ctx.fillStyle = hex(shade(sky, depth));
    ctx.fillRect(bx, base - bh, bw, bh);
    if (b.kind === 'step') {
      ctx.fillRect(bx + bw * 0.18, base - bh - g.U * 2.5, bw * 0.64, g.U * 2.5);
      ctx.fillRect(bx + bw * 0.36, base - bh - g.U * 4.5, bw * 0.28, g.U * 2);
    } else if (b.kind === 'spire') {
      ctx.fillRect(bx + bw / 2 - Math.max(0.5, g.U * 0.15), base - bh - g.U * 6, Math.max(1, g.U * 0.3), g.U * 6);
    }
    windows(ctx, bx, base - bh, bw, bh, lit * 0.75, rand, Math.max(1, g.U * 0.7), 2);
    // A lit crown line.
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.35 + 0.5 * Math.min(1, lit);
    ctx.fillRect(bx, base - bh, bw, Math.max(1, g.U * 0.4));
    ctx.globalAlpha = 1;
  }

  // Oriental Pearl: three legs, a large and a small sphere on a stalk, a mast.
  function paintPearl(ctx, g, sky, b, base, lit) {
    const cx = b.x * g.W;
    const total = b.h * g.H;
    const body = hex(shade(sky, 0.05));
    const pearl = hex(mixColor(rgb(VERMILION), rgb('#d27a8a'), 0.35 - sky.night * 0.2));
    const r1 = b.w * g.W * 0.5;
    const r2 = r1 * 0.55;
    const y1 = base - total * 0.3;
    const y2 = base - total * 0.68;
    ctx.fillStyle = body;
    ctx.fillRect(cx - r1 * 0.9, y1, Math.max(1, g.U * 0.6), base - y1);
    ctx.fillRect(cx + r1 * 0.9 - g.U * 0.6, y1, Math.max(1, g.U * 0.6), base - y1);
    ctx.fillRect(cx - g.U * 0.6, y2, g.U * 1.2, base - y2);
    ctx.fillRect(cx - g.U * 0.25, base - total, Math.max(1, g.U * 0.5), total * 0.3);
    for (const [y, r] of [[y1, r1], [y2, r2], [base - total * 0.83, r2 * 0.35]]) {
      ctx.fillStyle = pearl;
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = 0.4 + 0.5 * Math.min(1, lit);
      ctx.fillRect(cx - r * 0.7, y - Math.max(0.5, g.U * 0.2), r * 1.4, Math.max(1, g.U * 0.4));
      ctx.globalAlpha = 1;
    }
  }

  // Jin Mao: a tapering stack of setbacks, like a pagoda in glass.
  function paintJinmao(ctx, g, sky, b, base, lit) {
    const cx = b.x * g.W;
    const total = b.h * g.H;
    const w = b.w * g.W;
    const tiers = 7;
    const shaft = total * 0.55;
    const rand = K.rng(41);
    ctx.fillStyle = hex(shade(sky, 0.08));
    ctx.fillRect(cx - w / 2, base - shaft, w, shaft);
    windows(ctx, cx - w / 2, base - shaft, w, shaft, lit * 0.9, rand, Math.max(1, g.U * 0.7), 2);
    let y = base - shaft;
    const th = (total * 0.4) / tiers;
    for (let k = 0; k < tiers; k++) {
      const tw = w * (0.92 - k * 0.11);
      ctx.fillStyle = hex(shade(sky, 0.08));
      ctx.fillRect(cx - tw / 2, y - th, tw, th);
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = 0.3 + 0.4 * Math.min(1, lit);
      ctx.fillRect(cx - tw / 2, y - th, tw, Math.max(1, g.U * 0.3));
      ctx.globalAlpha = 1;
      y -= th;
    }
    ctx.fillStyle = hex(shade(sky, 0.08));
    ctx.fillRect(cx - g.U * 0.2, base - total, Math.max(1, g.U * 0.4), total * 0.05 + th);
  }

  // World Financial Centre: a slab tapering to a top with a trapezoid opening.
  function paintSwfc(ctx, g, sky, b, base, lit) {
    const cx = b.x * g.W;
    const total = b.h * g.H;
    const w = b.w * g.W;
    const top = base - total;
    ctx.fillStyle = hex(shade(sky, 0.06));
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, base);
    ctx.lineTo(cx - w * 0.28, top);
    ctx.lineTo(cx + w * 0.28, top);
    ctx.lineTo(cx + w / 2, base);
    ctx.closePath();
    ctx.fill();
    windows(ctx, cx - w * 0.36, top + total * 0.12, w * 0.72, total * 0.86, lit * 0.8, K.rng(43), Math.max(1, g.U * 0.7), 2);
    // The opening shows the sky behind.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, top + total * 0.02);
    ctx.lineTo(cx + w * 0.2, top + total * 0.02);
    ctx.lineTo(cx + w * 0.12, top + total * 0.09);
    ctx.lineTo(cx - w * 0.12, top + total * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Shanghai Tower: a tall soft taper with a slanted crown and lit bands.
  function paintTwist(ctx, g, sky, b, base, lit) {
    const cx = b.x * g.W;
    const total = b.h * g.H;
    const w = b.w * g.W;
    const top = base - total;
    ctx.fillStyle = hex(shade(sky, 0.02));
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, base);
    ctx.quadraticCurveTo(cx - w * 0.5, top + total * 0.4, cx - w * 0.24, top + total * 0.04);
    ctx.lineTo(cx + w * 0.26, top);
    ctx.quadraticCurveTo(cx + w * 0.42, top + total * 0.45, cx + w / 2, base);
    ctx.closePath();
    ctx.fill();
    const rand = K.rng(47);
    for (let k = 1; k < 9; k++) {
      const y = top + total * (k / 9);
      const half = w * (0.26 + 0.24 * (k / 9));
      ctx.fillStyle = k % 2 ? PALE : GOLD;
      ctx.globalAlpha = (0.25 + 0.45 * Math.min(1, lit)) * (0.7 + rand() * 0.3);
      ctx.fillRect(cx - half * 0.85, y, half * 1.7, Math.max(1, g.U * 0.35));
    }
    ctx.globalAlpha = 1;
    windows(ctx, cx - w * 0.3, top + total * 0.1, w * 0.6, total * 0.88, lit * 0.6, rand, Math.max(1, g.U * 0.7), 2);
  }

  const LANDMARK_PAINT = { pearl: paintPearl, jinmao: paintJinmao, swfc: paintSwfc, twist: paintTwist };

  // ---- old town ----------------------------------------------------------

  // Eaves sweep up at the corners, as on a Jiangnan tile roof.
  function roof(ctx, cx, y, w, h, color) {
    const e = w * 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - e, y - h * 0.45);
    ctx.quadraticCurveTo(cx - w / 2 + e * 0.4, y + h * 0.1, cx - w * 0.3, y - h * 0.45);
    ctx.lineTo(cx - w * 0.2, y - h);
    ctx.lineTo(cx + w * 0.2, y - h);
    ctx.lineTo(cx + w * 0.3, y - h * 0.45);
    ctx.quadraticCurveTo(cx + w / 2 - e * 0.4, y + h * 0.1, cx + w / 2 + e, y - h * 0.45);
    ctx.lineTo(cx + w / 2, y + h * 0.1);
    ctx.lineTo(cx - w / 2, y + h * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  function paintHouse(ctx, g, sky, b, base, lit) {
    const rand = K.rng(b.seed);
    const bw = b.w * g.W;
    const bh = b.h * g.H;
    const bx = b.x * g.W - bw / 2;
    const day = 1 - sky.night;
    const wall = mixColor(shade(sky, b.row ? 0.05 : 0.2), rgb('#b9a98c'), (b.row ? 0.42 : 0.28) * day + 0.1);
    const tile = hex(mixColor(shade(sky, 0), rgb('#0a0c18'), 0.35));
    const storey = bh / b.tiers;
    for (let k = 0; k < b.tiers; k++) {
      const inset = bw * 0.1 * k;
      const y = base - storey * (k + 1);
      ctx.fillStyle = hex(wall);
      ctx.fillRect(bx + inset, y, bw - inset * 2, storey);
      windows(ctx, bx + inset, y, bw - inset * 2, storey, lit * 0.9, rand, Math.max(1, g.U * 0.8), 3);
      roof(ctx, bx + bw / 2, y, (bw - inset * 2) * 1.08, g.U * (3.5 + bw / g.W * 30), tile);
    }
    // A red lantern under some eaves.
    if (b.row === 1 && rand() < 0.45) {
      ctx.fillStyle = VERMILION;
      ctx.fillRect(bx + bw * 0.2, base - bh + g.U * 0.8, Math.max(1, g.U * 0.8), Math.max(1, g.U * 1.1));
    }
  }

  function paintPagoda(ctx, g, sky, b, base, lit) {
    const cx = b.x * g.W;
    const w = b.w * g.W;
    const total = b.h * g.H;
    const tiers = 7;
    const th = total / (tiers + 1.4);
    const wall = hex(mixColor(shade(sky, 0.1), rgb(VERMILION), 0.45 * (1 - sky.night * 0.4)));
    const tile = hex(mixColor(shade(sky, 0), rgb('#0a0c18'), 0.4));
    for (let k = 0; k < tiers; k++) {
      const tw = w * (1 - k * 0.09);
      const y = base - k * th;
      ctx.fillStyle = wall;
      ctx.fillRect(cx - tw * 0.34, y - th * 0.66, tw * 0.68, th * 0.66);
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = 0.45 + 0.5 * Math.min(1, lit);
      ctx.fillRect(cx - tw * 0.07, y - th * 0.52, Math.max(1, tw * 0.14), th * 0.32);
      ctx.globalAlpha = 1;
      roof(ctx, cx, y - th * 0.62, tw * 1.25, th * 0.62, tile);
    }
    const top = base - tiers * th;
    ctx.fillStyle = tile;
    ctx.fillRect(cx - Math.max(0.5, g.U * 0.2), top - g.U * 5, Math.max(1, g.U * 0.4), g.U * 5);
    ctx.fillStyle = '#d9a73a';
    ctx.beginPath();
    ctx.arc(cx, top - g.U * 5.2, g.U * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- skyline -----------------------------------------------------------

  function paintSkyline(g, sky, city, lit) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const base = g.H * HORIZON;
    paintFar(ctx, g, sky, city);
    for (const b of city.towers) paintTowerBody(ctx, g, sky, b, base, lit, 0.22);
    for (const b of LANDMARKS) LANDMARK_PAINT[b.kind](ctx, g, sky, b, base, lit);
    for (const b of city.old) if (b.row === 0) paintHouse(ctx, g, sky, b, base, lit);
    paintPagoda(ctx, g, sky, city.pagoda, base, lit);
    for (const b of city.old) if (b.row === 1) paintHouse(ctx, g, sky, b, base, lit);
    // The Bund embankment with its lamps.
    ctx.fillStyle = hex(mixColor(rgb('#4a4a50'), rgb(INK), 0.35 + sky.night * 0.4));
    ctx.fillRect(0, base - g.U * 0.8, g.W, g.U * 1.6);
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.4 + 0.5 * Math.min(1, lit);
    for (let f = 0.02; f < 1; f += 0.035) ctx.fillRect(f * g.W, base - g.U * 1.6, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.6));
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, skyline, lit) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = Math.floor(g.H * HORIZON);
    const h = g.H - top;
    const col = skyColors(sky);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(col.glow));
    grad.addColorStop(0.5, hex(mixColor(col.mid, col.glow, 0.3)));
    grad.addColorStop(1, hex(mixColor(col.top, rgb(INK), 0.3)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, g.W, h);
    ctx.clip();
    ctx.globalAlpha = 0.6;
    ctx.translate(0, top * 2);
    ctx.scale(1, -1);
    ctx.drawImage(skyline, 0, 0);
    ctx.restore();
    // Long streaks of light under the lit landmarks.
    const rand = K.rng(55);
    for (const b of LANDMARKS) {
      for (let y = top + g.U; y < top + h * 0.85; y += g.U * (0.8 + rand())) {
        ctx.fillStyle = rand() < 0.7 ? GOLD : PALE;
        ctx.globalAlpha = (0.15 + 0.3 * Math.min(1, lit)) * (1 - (y - top) / h);
        const w = b.w * g.W * (0.3 + rand() * 0.6);
        ctx.fillRect(b.x * g.W - w / 2 + (rand() - 0.5) * g.U * 2, y, w, 1);
      }
    }
    // Pale ripples catching the sky.
    ctx.fillStyle = hex(mixColor(col.glow, rgb('#f2ecd8'), 0.5));
    for (let i = 0; i < g.W * 0.4; i++) {
      ctx.globalAlpha = 0.1 + rand() * 0.18;
      ctx.fillRect(rand() * g.W, top + Math.pow(rand(), 1.4) * h, g.U * (1 + rand() * 5), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- foreground rail and lanterns ----------------------------------------

  function paintNearBank(g, sky, lit) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const dark = hex(mixColor(rgb('#1f2438'), rgb('#0a0c18'), sky.night * 0.7));
    ctx.fillStyle = dark;
    ctx.fillRect(0, g.H * 0.95, g.W, g.H * 0.05);
    ctx.fillStyle = hex(mixColor(rgb('#6a6a70'), rgb(INK), 0.35 + sky.night * 0.4));
    ctx.fillRect(0, g.H * 0.95, g.W, Math.max(1, g.U * 0.6));
    for (const fx of [0.88, 0.95]) {
      const lx = fx * g.W;
      const ly = g.H * 0.84;
      ctx.fillStyle = dark;
      ctx.fillRect(lx - g.U * 0.2, g.H * 0.78, Math.max(1, g.U * 0.4), g.H * 0.17);
      ctx.fillStyle = VERMILION;
      ctx.beginPath();
      ctx.ellipse(lx, ly, g.U * 1.7, g.U * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = 0.35 + 0.5 * Math.min(1, lit);
      ctx.fillRect(lx - g.U * 0.5, ly - g.U * 0.9, g.U, g.U * 1.8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#d9a73a';
      ctx.fillRect(lx - g.U * 0.9, ly - g.U * 2.4, g.U * 1.8, Math.max(1, g.U * 0.4));
      ctx.fillRect(lx - g.U * 0.9, ly + g.U * 2.0, g.U * 1.8, Math.max(1, g.U * 0.4));
    }
    return c;
  }

  // ---- sampan --------------------------------------------------------------

  function paintBoat(g, sky, lit) {
    const w = Math.round(g.U * 20);
    const h = Math.round(g.U * 8);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const day = 1 - sky.night;
    ctx.fillStyle = hex(mixColor(rgb('#3a2a20'), rgb('#0a0c18'), sky.night * 0.5));
    ctx.beginPath();
    ctx.moveTo(0, h * 0.58);
    ctx.lineTo(w, h * 0.5);
    ctx.lineTo(w * 0.88, h);
    ctx.lineTo(w * 0.1, h);
    ctx.closePath();
    ctx.fill();
    // A pale gunwale so the hull reads against the water.
    ctx.fillStyle = hex(mixColor(rgb('#b9a98c'), rgb(INK), 0.3 + sky.night * 0.3));
    ctx.fillRect(w * 0.02, h * 0.58, w * 0.96, Math.max(1, g.U * 0.4));
    // Woven awning, arched, washi-light.
    ctx.fillStyle = hex(mixColor(rgb('#c8b07a'), rgb(INK), 0.25 + sky.night * 0.35));
    ctx.beginPath();
    ctx.ellipse(w * 0.46, h * 0.58, w * 0.26, h * 0.46, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.3 + 0.5 * Math.min(1, lit) * (0.5 + 0.5 * sky.night) + 0.1 * day;
    ctx.fillRect(w * 0.3, h * 0.36, w * 0.32, h * 0.16);
    ctx.globalAlpha = 1;
    // Lantern on a pole at the bow.
    ctx.fillStyle = hex(rgb('#1f2438'));
    ctx.fillRect(w * 0.9, h * 0.08, Math.max(1, g.U * 0.3), h * 0.45);
    ctx.fillStyle = VERMILION;
    ctx.fillRect(w * 0.86, h * 0.1, Math.max(2, g.U * 1.4), Math.max(2, g.U * 1.8));
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.6 + 0.4 * Math.min(1, lit);
    ctx.fillRect(w * 0.86 + g.U * 0.35, h * 0.1 + g.U * 0.4, Math.max(1, g.U * 0.7), Math.max(1, g.U * 0.9));
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- bake ----------------------------------------------------------------

  function repaint(g, choice, glow) {
    const sky = S.at(S.hour(choice));
    const lit = Math.min(1.4, (0.35 + 0.65 * sky.night) * glow);
    state.sky = paintSky(g, sky, K.rng(31));
    state.skyline = paintSkyline(g, sky, state.city, lit);
    state.water = paintWater(g, sky, state.skyline, lit);
    state.near = paintNearBank(g, sky, lit);
    state.boat = paintBoat(g, sky, lit);
    state.cloudAlpha = 0.6 - sky.night * 0.4;
    state.choice = choice;
    state.glow = glow;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion --------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.04);
    ctx.drawImage(c, off + c.width, g.H * 0.04);
    ctx.globalAlpha = 1;
  }

  // Water drawn in thin strips that slide a little, so reflections shimmer.
  function drawWater(ctx, g, t) {
    const top = Math.floor(g.H * HORIZON);
    const step = 2;
    for (let yy = top; yy < g.H; yy += step) {
      const k = (yy - top) / (g.H - top);
      const dx = Math.sin(t * 1.3 + yy * 0.9) * g.U * (0.15 + k * 0.6);
      ctx.drawImage(state.water, 0, yy, g.W, step, dx, yy, g.W, step);
    }
  }

  function drawBoat(ctx, g, t) {
    const b = state.boat;
    const span = g.W + b.width * 2;
    const x = ((t * g.U * 1.1) % span) - b.width;
    const y = g.H * 0.76 + Math.sin(t * 1.1) * g.U * 0.3;
    ctx.drawImage(b, x, y);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = GOLD;
    ctx.fillRect(x + b.width * 0.87, y + b.height, Math.max(1, g.U * 0.8), g.U * 4);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.city = makeCity(K.rng(17));
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.26));
    repaint(g, api.props.time, api.props.glow);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.glow !== props.glow) repaint(g, props.time, props.glow);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.skyline, 0, 0);
    drawWater(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    ctx.drawImage(state.near, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'dusk', boat: true, glow: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
