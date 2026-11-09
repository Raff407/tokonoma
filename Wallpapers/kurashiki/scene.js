/*
 * 倉敷 Kurashiki — the canal quarter: white plaster storehouses with black
 * lattice walls, weeping willows, still water and a flat boat.
 *
 * Sky, houses, trees and water are baked and repainted once a minute from the
 * clock. Between repaints only clouds, willow strands, water bands, a few
 * leaves and the boat move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const BANK = 0.62;
  const BASE = 0.60;
  const RETINT_SECONDS = 60;
  const BANDS = 14;
  const LEAVES = 7;
  const state = {};

  // Storehouses: x and width as screen fractions, wall and roof heights.
  const HOUSES = [
    { x: -0.02, w: 0.2, top: 0.40, roof: 0.075, gable: true },
    { x: 0.18, w: 0.17, top: 0.44, roof: 0.06, gable: false },
    { x: 0.35, w: 0.23, top: 0.37, roof: 0.085, gable: true },
    { x: 0.58, w: 0.16, top: 0.45, roof: 0.06, gable: false },
    { x: 0.74, w: 0.28, top: 0.39, roof: 0.08, gable: true },
  ];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function tone(base, sky, k) {
    const lit = mixColor(rgb(base), sky.amb, 0.22);
    return hex(mixColor(lit, rgb('#10131f'), sky.night * (k === undefined ? 0.62 : k)));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * BASE);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e9e4cf';
      ctx.globalAlpha = sky.night * 0.9;
      ctx.beginPath();
      ctx.arc(g.W * 0.68, g.H * 0.16, g.U * 3.2, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 21);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 246;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- houses ------------------------------------------------------------

  function paintWall(ctx, g, sky, h, x0, x1, y0, y1) {
    const plaster = tone('#ece8dc', sky, 0.7);
    const tile = tone('#23262e', sky, 0.5);
    const joint = tone('#e2dece', sky, 0.7);
    const split = y0 + (y1 - y0) * 0.5;
    ctx.fillStyle = plaster;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Lower half: black tiles with raised white joints in a diamond lattice.
    ctx.fillStyle = tile;
    ctx.fillRect(x0, split, x1 - x0, y1 - split);
    ctx.strokeStyle = joint;
    ctx.lineWidth = Math.max(1, g.U * 0.32);
    const step = g.U * 2.2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, split, x1 - x0, y1 - split);
    ctx.clip();
    ctx.beginPath();
    for (let k = x0 - (y1 - split); k < x1 + (y1 - split); k += step) {
      ctx.moveTo(k, split);
      ctx.lineTo(k + (y1 - split), y1);
      ctx.moveTo(k + (y1 - split), split);
      ctx.lineTo(k, y1);
    }
    ctx.stroke();
    ctx.restore();
    // Band of plaster where tile meets wall.
    ctx.fillStyle = plaster;
    ctx.fillRect(x0, split - g.U * 0.3, x1 - x0, g.U * 0.6);
  }

  function paintWindows(ctx, g, sky, x0, x1, y0, y1) {
    const dark = tone('#1a1c24', sky, 0.4);
    const glow = sky.night;
    const wy = y0 + (y1 - y0) * 0.14;
    const wh = (y1 - y0) * 0.24;
    const ww = g.U * 2.6;
    const n = Math.max(1, Math.floor((x1 - x0) / (g.U * 8)));
    for (let i = 0; i < n; i++) {
      const wx = x0 + ((i + 0.5) * (x1 - x0)) / n - ww / 2;
      ctx.fillStyle = tone('#23262e', sky, 0.5);
      ctx.fillRect(wx - g.U * 0.5, wy - g.U * 0.5, ww + g.U, wh + g.U);
      ctx.fillStyle = glow > 0.3 ? hex(mixColor(rgb('#d9a73a'), rgb('#f0d890'), 0.2)) : dark;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = tone('#23262e', sky, 0.5);
      for (let b = 1; b < 4; b++) ctx.fillRect(wx + (ww * b) / 4, wy, 1, wh);
    }
  }

  // Black tile roof with a white ridge line and eaves.
  function paintRoof(ctx, g, sky, x0, x1, ytop, h, gable) {
    const tile = tone('#2b2e38', sky, 0.5);
    const ridge = tone('#3a3e4a', sky, 0.5);
    ctx.fillStyle = tile;
    if (gable) {
      // Stepped gable wall (udatsu) above a tiled roof, seen end-on.
      const mid = (x0 + x1) / 2;
      ctx.beginPath();
      ctx.moveTo(x0 - g.U, ytop + h);
      ctx.lineTo(mid - g.U * 3, ytop + h * 0.2);
      ctx.lineTo(mid, ytop);
      ctx.lineTo(mid + g.U * 3, ytop + h * 0.2);
      ctx.lineTo(x1 + g.U, ytop + h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ridge;
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      ctx.beginPath();
      for (let r = 1; r < 4; r++) {
        const yy = ytop + (h * r) / 4;
        const inset = ((h - (yy - ytop)) / h) * 0;
        ctx.moveTo(x0 + inset, yy);
        ctx.lineTo(x1 - inset, yy);
      }
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x0 - g.U, ytop + h);
      ctx.lineTo(x0 + g.U * 2, ytop);
      ctx.lineTo(x1 - g.U * 2, ytop);
      ctx.lineTo(x1 + g.U, ytop + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ridge;
      for (let r = 1; r < 5; r++) ctx.fillRect(x0, ytop + (h * r) / 5, x1 - x0, 1);
    }
    ctx.fillStyle = tone('#d8d3c4', sky, 0.7);
    ctx.fillRect(x0 - g.U, ytop + h - g.U * 0.5, x1 - x0 + g.U * 2, g.U * 0.5);
  }

  function paintHouses(ctx, g, sky) {
    for (const h of HOUSES) {
      const x0 = g.W * h.x;
      const x1 = g.W * (h.x + h.w);
      const wallTop = g.H * h.top;
      const wallBot = g.H * BASE;
      paintWall(ctx, g, sky, h, x0, x1, wallTop, wallBot);
      paintWindows(ctx, g, sky, x0, x1, wallTop, wallBot);
      paintRoof(ctx, g, sky, x0, x1, wallTop - g.H * h.roof, g.H * h.roof, h.gable);
    }
  }

  // ---- bank, trees, lanterns --------------------------------------------

  function paintBank(ctx, g, sky) {
    const y0 = g.H * BASE;
    const y1 = g.H * BANK;
    const stone = tone('#8c8b82', sky, 0.6);
    ctx.fillStyle = stone;
    ctx.fillRect(0, y0, g.W, y1 - y0);
    ctx.fillStyle = tone('#6a6a64', sky, 0.6);
    const row = (y1 - y0) / 3;
    for (let r = 0; r < 3; r++) {
      ctx.fillRect(0, y0 + r * row, g.W, 1);
      const off = (r % 2) * g.U * 2.5;
      for (let x = off; x < g.W; x += g.U * 5) ctx.fillRect(x, y0 + r * row, 1, row);
    }
    ctx.fillStyle = tone('#a8a69a', sky, 0.6);
    ctx.fillRect(0, y0, g.W, Math.max(1, g.U * 0.5));
    // Lanterns on the path glow after dark.
    for (const f of [0.17, 0.57]) {
      ctx.fillStyle = tone('#3a3a40', sky, 0.5);
      ctx.fillRect(g.W * f, y0 - g.U * 2.6, g.U * 0.5, g.U * 2.6);
      ctx.fillStyle = sky.night > 0.3 ? '#e8c46a' : tone('#c8b890', sky, 0.5);
      ctx.fillRect(g.W * f - g.U * 0.6, y0 - g.U * 4.6, g.U * 1.7, g.U * 2);
    }
  }

  function paintWillow(ctx, g, sky, rand, x, lean, size) {
    const trunk = tone('#3c3128', sky, 0.55);
    const leaf = tone('#6a8a4a', sky, 0.6);
    const leaf2 = tone('#7e9a56', sky, 0.55);
    const by = g.H * BANK;
    ctx.strokeStyle = trunk;
    ctx.lineWidth = g.U * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.quadraticCurveTo(x + lean * 0.2, by - size * 0.5, x + lean, by - size * 0.9);
    ctx.stroke();
    const cx = x + lean;
    const cy = by - size * 0.95;
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 2 ? leaf : leaf2;
      const a = rand() * 6.3;
      const r = rand() * size * 0.38;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.55, g.U * (1.6 + rand() * 1.8), 0, 6.3);
      ctx.fill();
    }
    return { cx, cy, spread: size * 0.5, len: size * 0.8 };
  }

  function makeStrands(g, tree, rand, list) {
    const leaf = [rgb('#6a8a4a'), rgb('#7e9a56'), rgb('#5a7a42')];
    for (let i = 0; i < 18; i++) {
      list.push({
        x: tree.cx + (rand() - 0.5) * 2 * tree.spread,
        y: tree.cy + (rand() - 0.3) * g.U * 2,
        len: tree.len * (0.55 + rand() * 0.45),
        ph: rand() * 6.3,
        col: leaf[i % 3],
        w: Math.max(1, g.U * (0.5 + rand() * 0.4)),
      });
    }
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, comp) {
    const c = layer(g.W, g.H - g.H * BANK + 2);
    const ctx = c.getContext('2d');
    const top = hex(mixColor(mixColor(sky.low, rgb('#4a6a72'), 0.55), rgb('#141a2a'), sky.night * 0.55));
    const bot = hex(mixColor(mixColor(sky.top, rgb('#26424c'), 0.6), rgb('#0c1020'), sky.night * 0.6));
    const grad = ctx.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.translate(0, g.H * BANK);
    ctx.scale(1, -1);
    ctx.drawImage(comp, 0, 0, g.W, g.H);
    ctx.restore();
    return c;
  }

  function paintBoat(g) {
    const w = Math.round(g.U * 36);
    const h = Math.round(g.U * 12);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    // Hull: low flat boat with raised ends.
    ctx.fillStyle = '#3a2c22';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w * 0.06, h * 0.85);
    ctx.lineTo(w * 0.94, h * 0.85);
    ctx.lineTo(w, h * 0.5);
    ctx.lineTo(w * 0.94, h * 0.62);
    ctx.lineTo(w * 0.06, h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a4634';
    ctx.fillRect(w * 0.06, h * 0.62, w * 0.88, h * 0.06);
    // Reed-mat canopy.
    ctx.fillStyle = '#b79a62';
    ctx.beginPath();
    ctx.moveTo(w * 0.26, h * 0.62);
    ctx.quadraticCurveTo(w * 0.28, h * 0.08, w * 0.5, h * 0.08);
    ctx.quadraticCurveTo(w * 0.72, h * 0.08, w * 0.74, h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a7240';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 6; k++) {
      ctx.moveTo(w * (0.26 + k * 0.08), h * 0.1);
      ctx.lineTo(w * (0.26 + k * 0.08), h * 0.62);
    }
    ctx.stroke();
    // Long pole resting along the side and a vermilion cushion.
    ctx.strokeStyle = '#6a5a42';
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.4);
    ctx.lineTo(w * 0.9, h * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(w * 0.78, h * 0.5, w * 0.1, h * 0.12);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    state.sky = paintSky(g, sky, rand);
    const bank = layer(g.W, g.H);
    const bctx = bank.getContext('2d');
    paintHouses(bctx, g, sky);
    paintBank(bctx, g, sky);
    const trees = [
      paintWillow(bctx, g, sky, rand, g.W * 0.08, g.W * 0.05, g.H * 0.36),
      paintWillow(bctx, g, sky, rand, g.W * 0.9, -g.W * 0.06, g.H * 0.38),
      paintWillow(bctx, g, sky, rand, g.W * 0.5, g.W * 0.02, g.H * 0.26),
    ];
    state.bank = bank;
    state.strands = [];
    for (const tr of trees) makeStrands(g, tr, rand, state.strands);
    const comp = layer(g.W, g.H);
    const cctx = comp.getContext('2d');
    cctx.drawImage(state.sky, 0, 0);
    cctx.drawImage(bank, 0, 0);
    state.water = paintWater(g, sky, comp);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.04);
    ctx.drawImage(c, off + c.width, g.H * 0.04);
    ctx.globalAlpha = 1;
  }

  function drawStrands(ctx, g, t, amount) {
    ctx.lineCap = 'round';
    const list = state.strands;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const sw = Math.sin(t * 0.9 + s.ph) * g.U * 1.6 * amount;
      ctx.strokeStyle = toHex(mixColor(s.col, rgb('#10131f'), state.night * 0.55));
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + sw * 0.3, s.y + s.len * 0.5, s.x + sw, s.y + s.len);
      ctx.stroke();
    }
  }

  function drawWater(ctx, g, t, amount) {
    const w = state.water;
    const y0 = g.H * BANK;
    const bh = w.height / BANDS;
    for (let b = 0; b < BANDS; b++) {
      const k = b / BANDS;
      const dx = Math.sin(t * 0.8 + b * 1.7) * g.U * (0.15 + k * 0.7) * amount;
      ctx.drawImage(w, 0, b * bh, w.width, bh + 0.5, dx, y0 + b * bh, w.width, bh + 0.5);
    }
    // A few pale ripple lines across the surface.
    ctx.fillStyle = 'rgba(240,236,220,0.16)';
    for (let i = 0; i < 6; i++) {
      const ry = y0 + w.height * (0.1 + (i * 0.15 + 0.03 * Math.sin(t * 0.3 + i)));
      const rx = ((i * 0.37 + t * 0.004 * (1 + i * 0.2)) % 1) * g.W;
      ctx.fillRect(rx, ry, g.U * (4 + i), 1);
    }
  }

  function drawLeaves(ctx, g, t) {
    ctx.fillStyle = '#7e9a56';
    const y0 = g.H * BANK;
    for (let i = 0; i < LEAVES; i++) {
      const x = ((i * 0.171 + t * 0.006) % 1) * g.W;
      const y = y0 + g.H * (0.08 + i * 0.05) + Math.sin(t * 0.7 + i) * g.U * 0.4;
      ctx.fillRect(x, y, Math.max(2, g.U * 0.9), Math.max(1, g.U * 0.35));
    }
  }

  function drawBoat(ctx, g, t) {
    const boat = state.boat;
    const span = g.W + boat.width * 2;
    const x = ((t * g.U * 1.6) % span) - boat.width;
    const bob = Math.sin(t * 0.9) * g.U * 0.25;
    const y = g.H * 0.76 + bob;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate(0, y + boat.height * 1.5);
    ctx.scale(1, -0.8);
    ctx.drawImage(boat, x, 0);
    ctx.restore();
    ctx.drawImage(boat, x, y);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.25));
    state.boat = paintBoat(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.bank, 0, 0);
    drawStrands(ctx, g, t, props.willow);
    drawWater(ctx, g, t, props.ripple);
    drawLeaves(ctx, g, t);
    drawBoat(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', willow: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
