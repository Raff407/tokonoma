/*
 * 里山 Satoyama — terraced hills above a village.
 *
 * Sky, hills, flooded paddies, cedar, thatched farmhouse and drying rack are
 * baked into layers and repainted once a minute from the clock. Between
 * repaints only clouds, valley mist, hearth smoke, swaying bamboo and a few
 * far birds move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 12;
  const STALKS = 7;
  const BIRDS = 3;
  const HOUSE = { x: 0.43, base: 0.78 };
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A colour lit by the sky, then darkened toward night.
  function tint(sky, h, k) {
    const lit = mixColor(rgb(h), sky.amb, k === undefined ? 0.22 : k);
    return hex(mixColor(lit, rgb('#10162a'), sky.night * 0.68));
  }

  // ---- ridges ------------------------------------------------------------

  function farRidge(g, x) {
    return g.H * (0.4 - 0.05 * Math.sin(x / g.W * 5.2 + 1) - 0.03 * Math.sin(x / g.W * 11)) + (fbm(x * 0.04, 3, 3, 7) - 0.5) * g.U * 3;
  }

  function cedarHill(g, x) {
    const f = x / g.W;
    const peak = g.H * 0.27;
    const d = smoothstep(0, 0.62, f);
    return lerp(peak, g.H * 0.7, Math.pow(d, 0.8)) + (fbm(x * 0.05, 5, 3, 3) - 0.5) * g.U * 2;
  }

  function terraceHill(g, x) {
    const f = x / g.W;
    const left = smoothstep(0.2, 0.78, f);
    const right = smoothstep(1.02, 0.84, f);
    const top = g.H * 0.36;
    const low = g.H * 0.74;
    return lerp(low, top, Math.min(left, 1) * 0.85 + 0.15 * right) + (fbm(x * 0.05, 8, 3, 5) - 0.5) * g.U * 1.6;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.62);
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
    paintLuminary(ctx, g, sky);
    return c;
  }

  function paintLuminary(ctx, g, sky) {
    const day = sky.night < 0.6;
    const t = day ? S.sunT(sky.hour) : S.moonT(sky.hour);
    const cx = g.W * lerp(0.12, 0.88, t);
    const cy = g.H * (0.34 - Math.sin(t * Math.PI) * 0.22);
    const r = g.U * (day ? 4.5 : 3.2);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 5);
    glow.addColorStop(0, day ? 'rgba(244,222,170,0.4)' : 'rgba(220,226,240,0.22)');
    glow.addColorStop(1, 'rgba(244,222,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 5, cy - r * 5, r * 10, r * 10);
    ctx.fillStyle = day ? '#f4e6bc' : '#e8e8de';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 41);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.pow(Math.sin((y / c.height) * Math.PI), 1.4);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.01, y * 0.09, 3, 17), fbm((x - c.width) * 0.01, y * 0.09, 3, 17), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = smoothstep(0.38, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(226,224,216,0.55)');
    grad.addColorStop(1, 'rgba(226,224,216,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- hills -------------------------------------------------------------

  function fillBelow(ctx, g, ridgeFn, color, bottom) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridgeFn(g, x));
    ctx.lineTo(g.W, bottom);
    ctx.closePath();
    ctx.fill();
  }

  function paintFarHills(ctx, g, sky) {
    fillBelow(ctx, g, farRidge, tint(sky, '#7d8fa8', 0.35), g.H * 0.6);
    ctx.save();
    ctx.globalAlpha = 0.5;
    fillBelow(ctx, g, (gg, x) => farRidge(gg, x) + gg.U * 5, tint(sky, '#9aa8bc', 0.4), g.H * 0.6);
    ctx.restore();
  }

  function cedar(ctx, x, base, h, col, hi) {
    const tiers = 6;
    ctx.fillStyle = col;
    ctx.fillRect(x - Math.max(0.5, h * 0.02), base - h * 0.12, Math.max(1, h * 0.04), h * 0.12);
    for (let i = 0; i < tiers; i++) {
      const top = base - h + (i * h * 0.78) / tiers;
      const half = h * (0.05 + 0.032 * i);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x - half, top + (h * 0.3));
      ctx.lineTo(x + half, top + (h * 0.3));
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < tiers; i++) {
      const top = base - h + (i * h * 0.78) / tiers;
      const half = h * (0.05 + 0.032 * i);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x - half, top + (h * 0.3));
      ctx.lineTo(x - half * 0.1, top + (h * 0.3));
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintCedarHill(ctx, g, sky, rand) {
    fillBelow(ctx, g, cedarHill, tint(sky, '#3e5a46', 0.22), g.H * 0.8);
    const dark = tint(sky, '#26392e', 0.15);
    const lite = tint(sky, '#5c7a54', 0.3);
    for (let i = 0; i < 70; i++) {
      const x = rand() * g.W * 0.62;
      const ry = cedarHill(g, x);
      const base = ry + g.U * (2 + rand() * 9);
      cedar(ctx, x, base, g.U * (7 + rand() * 7), dark, lite);
    }
  }

  // ---- terraces ----------------------------------------------------------

  function levelY(g, x, k, n) {
    const r = terraceHill(g, x);
    const u = Math.pow(k / n, 1.35);
    return r + (g.H - r) * u + Math.sin(x * 0.045 + k * 1.7) * g.U * 0.7 * u;
  }

  function paintTerraces(ctx, g, sky, rand) {
    const n = 15;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, terraceHill(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = tint(sky, '#4f6638', 0.22);
    ctx.fillRect(0, 0, g.W, g.H);
    const water = mixColor(sky.low, rgb('#2f4468'), 0.4);
    const greens = ['#6a8240', '#8a9a48', '#58713a', '#a39a4c'];
    for (let k = 0; k < n; k++) {
      const flooded = rand() < 0.42;
      const col = flooded ? hex(mixColor(water, rgb('#10162a'), sky.night * 0.5)) : tint(sky, greens[Math.floor(rand() * greens.length)], 0.2);
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let x = 0; x <= g.W; x += 2) ctx[x ? 'lineTo' : 'moveTo'](x, levelY(g, x, k, n));
      for (let x = g.W; x >= 0; x -= 2) ctx.lineTo(x, levelY(g, x, k + 1, n) - g.U * 0.5);
      ctx.closePath();
      ctx.fill();
      if (!flooded) paintRows(ctx, g, sky, k, n);
      paintBank(ctx, g, sky, k, n);
    }
    ctx.restore();
  }

  // Planting rows run along the contour inside a green terrace.
  function paintRows(ctx, g, sky, k, n) {
    ctx.strokeStyle = tint(sky, '#3c5230', 0.2);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    const rows = 1 + Math.floor(k / 5);
    for (let r = 1; r <= rows; r++) {
      const m = r / (rows + 1);
      ctx.beginPath();
      for (let x = 0; x <= g.W; x += 3) {
        const y = lerp(levelY(g, x, k, n), levelY(g, x, k + 1, n) - g.U * 0.5, m);
        ctx[x ? 'lineTo' : 'moveTo'](x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintBank(ctx, g, sky, k, n) {
    ctx.strokeStyle = tint(sky, '#7a8a4a', 0.25);
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    ctx.beginPath();
    for (let x = 0; x <= g.W; x += 2) ctx[x ? 'lineTo' : 'moveTo'](x, levelY(g, x, k, n));
    ctx.stroke();
    ctx.strokeStyle = tint(sky, '#3a3a28', 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= g.W; x += 2) ctx[x ? 'lineTo' : 'moveTo'](x, levelY(g, x, k, n) + g.U * 0.5);
    ctx.stroke();
  }

  // ---- farmhouse ---------------------------------------------------------

  function paintHouse(ctx, g, sky) {
    const u = g.U;
    const cx = g.W * HOUSE.x;
    const base = g.H * HOUSE.base;
    const night = sky.night;
    // Level platform of packed earth.
    ctx.fillStyle = tint(sky, '#8a7a58', 0.2);
    ctx.fillRect(cx - u * 24, base - u * 0.5, u * 48, u * 2.2);
    // Walls: plaster between dark timber.
    const wallW = u * 30;
    const wallH = u * 9;
    ctx.fillStyle = tint(sky, '#d9d0b6', 0.3);
    ctx.fillRect(cx - wallW / 2, base - wallH, wallW, wallH);
    paintOpenings(ctx, g, sky, cx, base, wallW, wallH);
    ctx.fillStyle = tint(sky, '#2a2622', 0.1);
    for (let i = 0; i <= 6; i++) ctx.fillRect(cx - wallW / 2 + (i * wallW) / 6 - 0.5, base - wallH, Math.max(1, u * 0.5), wallH);
    ctx.fillRect(cx - wallW / 2, base - wallH, wallW, Math.max(1, u * 0.6));
    ctx.fillRect(cx - wallW / 2, base - u * 0.6, wallW, Math.max(1, u * 0.6));
    paintRoof(ctx, g, sky, cx, base - wallH, u);
    // Veranda and the stepping stone.
    ctx.fillStyle = tint(sky, '#6a5238', 0.2);
    ctx.fillRect(cx - wallW / 2 - u, base - u * 1.2, wallW + u * 2, u * 0.7);
    void night;
  }

  function paintOpenings(ctx, g, sky, cx, base, wallW, wallH) {
    const u = g.U;
    const glow = 0.25 + sky.night * 0.75;
    const paper = mixColor(rgb('#e8e0c8'), rgb('#f0c878'), glow);
    ctx.fillStyle = hex(mixColor(paper, sky.amb, (1 - sky.night) * 0.1));
    const panes = [1, 2, 4, 5];
    for (const p of panes) {
      const x0 = cx - wallW / 2 + (p * wallW) / 6 + u * 0.3;
      ctx.fillRect(x0, base - wallH * 0.82, wallW / 6 - u * 0.6, wallH * 0.7);
    }
    ctx.fillStyle = tint(sky, '#2a2622', 0.1);
    for (const p of panes) {
      const x0 = cx - wallW / 2 + (p * wallW) / 6 + u * 0.3;
      const w = wallW / 6 - u * 0.6;
      ctx.fillRect(x0 + w / 2, base - wallH * 0.82, 1, wallH * 0.7);
      ctx.fillRect(x0, base - wallH * 0.47, w, 1);
    }
  }

  function paintRoof(ctx, g, sky, cx, eave, u) {
    const thatch = tint(sky, '#a88a4c', 0.25);
    const shade = tint(sky, '#7a6234', 0.2);
    const rise = u * 14;
    const eaveHalf = u * 23;
    const ridgeHalf = u * 8;
    ctx.fillStyle = thatch;
    ctx.beginPath();
    ctx.moveTo(cx - eaveHalf, eave + u * 1.2);
    ctx.lineTo(cx - ridgeHalf, eave - rise);
    ctx.lineTo(cx + ridgeHalf, eave - rise);
    ctx.lineTo(cx + eaveHalf, eave + u * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let y = eave - rise + u * 1.5; y < eave + u; y += u * 1.5) {
      const f = (y - (eave - rise)) / rise;
      const half = lerp(ridgeHalf, eaveHalf, f);
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Deep shadow under the eaves, then the ridge cap with its small smoke gable.
    ctx.fillStyle = shade;
    ctx.fillRect(cx - eaveHalf, eave, eaveHalf * 2, u * 1.3);
    ctx.fillStyle = tint(sky, '#4a3c24', 0.15);
    ctx.fillRect(cx - ridgeHalf - u, eave - rise - u * 0.8, (ridgeHalf + u) * 2, u * 1.1);
    ctx.fillStyle = thatch;
    ctx.beginPath();
    ctx.moveTo(cx - u * 4, eave - rise - u * 0.6);
    ctx.lineTo(cx, eave - rise - u * 5);
    ctx.lineTo(cx + u * 4, eave - rise - u * 0.6);
    ctx.closePath();
    ctx.fill();
    state.vent = { x: cx, y: eave - rise - u * 4.6 };
  }

  // Persimmon tree with orange fruit left of the house.
  function paintKaki(ctx, g, sky, rand) {
    const u = g.U;
    const x = g.W * HOUSE.x - u * 31;
    const base = g.H * HOUSE.base;
    ctx.strokeStyle = tint(sky, '#3a2e24', 0.1);
    ctx.lineWidth = Math.max(1, u * 0.9);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + u * 0.5, base - u * 9);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(x + u * 0.4, base - u * (5 + i));
      ctx.lineTo(x + (i % 2 ? 1 : -1) * u * (3 + rand() * 3), base - u * (10 + rand() * 4));
      ctx.stroke();
    }
    ctx.fillStyle = tint(sky, '#5c7242', 0.25);
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      ctx.arc(x + (rand() - 0.5) * u * 10, base - u * (11 + rand() * 4), u * (1 + rand() * 0.9), 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = tint(sky, '#d8782c', 0.1);
    for (let i = 0; i < 12; i++) ctx.fillRect(x + (rand() - 0.5) * u * 10, base - u * (9.5 + rand() * 5), Math.max(1, u * 0.8), Math.max(1, u * 0.8));
  }

  // Hasaba: poles and bars with sheaves of rice drying in the sun.
  function paintRack(ctx, g, sky) {
    const u = g.U;
    const x0 = g.W * 0.12;
    const base = g.H * 0.92;
    const wide = u * 18;
    ctx.fillStyle = tint(sky, '#5a4630', 0.15);
    for (const dx of [0, wide / 2, wide]) ctx.fillRect(x0 + dx, base - u * 11, Math.max(1, u * 0.6), u * 11);
    for (let b = 0; b < 3; b++) ctx.fillRect(x0, base - u * (10 - b * 2.6), wide, Math.max(1, u * 0.5));
    for (let b = 0; b < 3; b++) {
      const y = base - u * (10 - b * 2.6);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = tint(sky, i % 3 ? '#c9a24a' : '#b8913e', 0.3);
        ctx.fillRect(x0 + u * (0.6 + i * 2), y, Math.max(1, u * 1.2), u * 2.1);
      }
    }
  }

  // ---- bamboo ------------------------------------------------------------

  function paintStalk(g, sky, rand, h) {
    const u = g.U;
    const w = Math.ceil(u * 12);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const x = w / 2;
    const stem = Math.max(2, u * 0.9);
    ctx.fillStyle = tint(sky, '#5f7d48', 0.25);
    ctx.fillRect(x - stem / 2, 0, stem, h);
    ctx.fillStyle = tint(sky, '#9ab478', 0.3);
    ctx.fillRect(x - stem / 2, 0, Math.max(1, stem * 0.3), h);
    ctx.fillStyle = tint(sky, '#2e4630', 0.15);
    for (let y = h - u * 7; y > u * 6; y -= u * (6 + rand() * 3)) ctx.fillRect(x - stem / 2 - 1, y, stem + 2, 1);
    ctx.strokeStyle = tint(sky, '#4f7a3c', 0.28);
    ctx.lineWidth = 1;
    for (let tuft = 0; tuft < 4; tuft++) {
      const ty = u * (1 + tuft * 3.4);
      for (let i = 0; i < 7; i++) {
        const dir = i % 2 ? 1 : -1;
        const len = u * (2.6 + rand() * 3);
        ctx.beginPath();
        ctx.moveTo(x, ty);
        ctx.quadraticCurveTo(x + dir * len * 0.6, ty - u * 0.6, x + dir * len, ty + len * 0.5);
        ctx.stroke();
      }
    }
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarHills(ctx, g, sky);
    paintCedarHill(ctx, g, sky, rand);
    paintTerraces(ctx, g, sky, rand);
    paintHouse(ctx, g, sky);
    paintKaki(ctx, g, sky, rand);
    paintRack(ctx, g, sky);
    paintForegroundCedar(ctx, g, sky, rand);
    return c;
  }

  function paintForegroundCedar(ctx, g, sky, rand) {
    const dark = tint(sky, '#22342a', 0.12);
    const lite = tint(sky, '#4c6a46', 0.28);
    const spots = [0.62, 0.66, 0.7, 0.745];
    for (const f of spots) {
      const base = terraceHill(g, g.W * f) + g.U * (10 + rand() * 4);
      cedar(ctx, g.W * f, base, g.U * (18 + rand() * 8), dark, lite);
    }
    const left = [0.04, 0.075];
    for (const f of left) cedar(ctx, g.W * f, g.H * 0.8, g.U * (22 + rand() * 6), dark, lite);
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(52);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.stalks = [];
    const r2 = K.rng(9);
    for (let i = 0; i < STALKS; i++) state.stalks.push(paintStalk(g, sky, r2, Math.ceil(g.H * (0.5 + 0.1 * r2()))));
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.mistTone = hex(mixColor(sky.haze, rgb('#f2efe6'), 0.5 * (1 - sky.night)));
    state.mistAlpha = 0.55 - sky.night * 0.25;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 2.4) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mist;
    const off = -((t * g.U * 1.8) % m.width);
    const y = g.H * 0.36;
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount);
    ctx.drawImage(m, off, y);
    ctx.drawImage(m, off + m.width, y);
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t) {
    const v = state.vent;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.05 + i / MAX_PUFFS) % 1;
      const size = g.U * (2 + a * 9);
      const dx = a * g.U * 12 + Math.sin(t * 0.5 + i * 2) * g.U * 0.8 * a;
      const dy = -a * g.U * 20;
      ctx.globalAlpha = (1 - a) * 0.75 * (1 - state.dim * 0.35);
      ctx.drawImage(state.puff, v.x + dx - size / 2, v.y + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawBamboo(ctx, g, t) {
    const baseY = g.H * 1.01;
    for (let i = 0; i < STALKS; i++) {
      const s = state.stalks[i];
      const x = g.W * (0.86 + i * 0.02) + (i % 2) * g.U;
      const sway = Math.sin(t * 0.9 + i * 1.3) * 0.04 + Math.sin(t * 0.31 + i) * 0.012;
      ctx.save();
      ctx.translate(x, baseY);
      ctx.rotate(sway - 0.02);
      ctx.drawImage(s, -s.width / 2, -s.height);
      ctx.restore();
    }
  }

  // A few far birds crossing the valley on slow wings.
  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = '#2a2c3a';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7 * (1 - state.dim);
    if (state.dim > 0.9) { ctx.globalAlpha = 1; return; }
    for (let i = 0; i < BIRDS; i++) {
      const p = (t * 0.012 + i * 0.13) % 1.2;
      const x = g.W * (p - 0.1);
      const y = g.H * (0.2 + i * 0.03) + Math.sin(t * 0.3 + i) * g.U;
      const flap = Math.sin(t * 3 + i * 2) * g.U * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.3, y + flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + g.U * 1.3, y + flap);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    state.puff = paintPuff();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawBirds(ctx, g, t);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawMist(ctx, g, t, props.mist);
    if (props.smoke) drawSmoke(ctx, g, t);
    drawBamboo(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, smoke: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
