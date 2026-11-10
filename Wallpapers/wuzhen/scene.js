/*
 * 乌镇 Wuzhen — a Jiangnan water town canal at the foot of a humpback stone bridge.
 *
 * Sky, houses, bridge, lanterns and the canal's reflection are baked into
 * layers and repainted once a minute from the clock, so windows glow at night.
 * Each frame only blits those layers, wobbles the reflection in a few dozen
 * bands, and moves a handful of small things: a wupeng boat sculled out from
 * under the arch, willow strands, glints, ripple rings, lantern flicker,
 * drifting cloud and mist.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.5;
  const WATER = 0.6;
  const HALF_AT_WATER = 0.16;
  const HALF_GROWTH = 0.24;
  const BANK = 0.018;
  const ARCH_R = 0.13;
  const REACH = 2.5;
  const RETINT_SECONDS = 60;
  const STRANDS = 22;
  const RIPPLES = 5;
  const GLINTS = 16;
  const FLICKERS = 6;
  const BOAT_PERIOD = 40;

  const INK = '#23252e';
  const WASHI = '#ece6d4';
  const INDIGO = '#3a4a6e';
  const VERMILION = '#c8452c';
  const MOSS = '#4f6a48';
  const GOLD = '#d9a73a';
  const WOOD = '#4a3a30';
  const STONE = '#a29f94';
  const NIGHT = '#171b2e';

  // Bank houses: the two far ones stand behind the bridge, the rest in front.
  const BEHIND = [
    { side: -1, base: 0.585, eave: 0.465, roof: 0.085, w: 0.1, lanterns: 2 },
    { side: 1, base: 0.585, eave: 0.465, roof: 0.085, w: 0.1, lanterns: 2 },
  ];
  const FRONT = [
    { side: -1, base: 0.76, eave: 0.43, roof: 0.12, w: 0.16, lanterns: 3 },
    { side: 1, base: 0.77, eave: 0.42, roof: 0.12, w: 0.16, lanterns: 3 },
    { side: -1, base: 0.99, eave: 0.35, roof: 0.18, w: 0.4, near: true, lanterns: 4 },
    { side: 1, base: 0.99, eave: 0.36, roof: 0.17, w: 0.4, near: true, lanterns: 4 },
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

  // A colour as the sky lights it: tinted by the ambient light, then pulled toward night blue.
  function shade(c, sky, amb, dark) {
    const lit = mixColor(rgb(c), sky.amb, amb);
    return hex(mixColor(lit, rgb(NIGHT), sky.night * dark));
  }

  // Half width of the canal at a height given as a fraction of the height.
  function half(g, f) {
    return g.W * (HALF_AT_WATER + ((f - WATER) / (1 - WATER)) * HALF_GROWTH);
  }

  function edgeX(g, side, f) {
    return g.W * 0.5 + side * half(g, f);
  }

  function waterPath(ctx, g, from, inset) {
    const d = inset || 0;
    ctx.beginPath();
    ctx.moveTo(edgeX(g, -1, from) + d, g.H * from);
    ctx.lineTo(edgeX(g, 1, from) - d, g.H * from);
    ctx.lineTo(edgeX(g, 1, 1.03) - d, g.H * 1.03);
    ctx.lineTo(edgeX(g, -1, 1.03) + d, g.H * 1.03);
    ctx.closePath();
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H * HORIZON + 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    if (sky.night < 0.8) {
      const sx = g.W * lerp(0.1, 0.9, S.sunT(sky.hour));
      const glow = ctx.createRadialGradient(sx, g.H * 0.48, 0, sx, g.H * 0.48, g.W * 0.5);
      glow.addColorStop(0, hex(sky.amb));
      glow.addColorStop(1, hex(sky.low));
      ctx.globalAlpha = 0.3 * (1 - sky.night);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalAlpha = 1;
    }
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (sky.night > 0.35) paintMoon(ctx, g, sky);
    return c;
  }

  function paintMoon(ctx, g, sky) {
    const mt = S.moonT(sky.hour);
    const mx = g.W * lerp(0.3, 0.7, mt);
    const my = g.H * (0.3 - 0.18 * Math.sin(Math.PI * mt));
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 9);
    halo.addColorStop(0, 'rgba(236,230,212,0.35)');
    halo.addColorStop(1, 'rgba(236,230,212,0)');
    ctx.globalAlpha = Math.min(1, sky.night * 1.2);
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.U * 9, my - g.U * 9, g.U * 18, g.U * 18);
    ctx.fillStyle = WASHI;
    ctx.beginPath();
    ctx.arc(mx, my, g.U * 2.4, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Wisps that tile sideways (the left and right edges agree).
  function paintWisps(w, h, freqY, seed, peak) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (px, py) => fbm(px * 0.012, py * freqY, 4, seed);
    for (let py = 0; py < c.height; py++) {
      const band = Math.sin((py / c.height) * Math.PI);
      for (let px = 0; px < c.width; px++) {
        const v = lerp(density(px, py), density(px - c.width, py), px / c.width);
        const i = (py * c.width + px) * 4;
        img.data[i] = 240;
        img.data[i + 1] = 237;
        img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.48, 0.72, v) * band * peak;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(238,168,84,0.6)');
    grad.addColorStop(0.4, 'rgba(226,130,60,0.22)');
    grad.addColorStop(1, 'rgba(226,130,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function paintLantern() {
    const c = layer(16, 26);
    const ctx = c.getContext('2d');
    ctx.fillStyle = GOLD;
    ctx.fillRect(4, 0, 8, 3);
    ctx.fillRect(5, 21, 6, 2);
    ctx.fillStyle = VERMILION;
    ctx.beginPath();
    ctx.ellipse(8, 12, 7.5, 9, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = '#8c2c1c';
    ctx.lineWidth = 1;
    for (const rx of [3, 6.2]) {
      ctx.beginPath();
      ctx.ellipse(8, 12, rx, 9, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8c874';
    ctx.fillRect(7, 23, 2, 3);
    return c;
  }

  // ---- houses ------------------------------------------------------------

  function resolveHouse(g, spec) {
    const w = g.W * spec.w;
    const base = g.H * spec.base;
    const edge = edgeX(g, spec.side, Math.max(WATER, spec.base) + BANK);
    const x0 = spec.side < 0 ? edge - w - 1 : edge + 1;
    return {
      x0, base, w, eave: g.H * spec.eave, roofH: g.H * spec.roof,
      gable: spec.near ? 0 : -spec.side, lanterns: spec.lanterns, side: spec.side,
    };
  }

  function paintWindows(ctx, sky, p, bays, glow, wood) {
    const h = p.base - p.eave;
    const bayW = p.w / bays;
    const dark = rgb(shade('#1f2026', sky, 0.1, 0.1));
    const inside = hex(mixColor(dark, rgb(GOLD), glow * 0.85));
    for (let i = 0; i < bays; i++) {
      const wx = p.x0 + i * bayW + bayW * 0.2;
      const ww = bayW * 0.6;
      const wy = p.eave + h * 0.1;
      const wh = h * 0.3;
      ctx.fillStyle = wood;
      ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
      ctx.fillStyle = inside;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = wood;
      ctx.fillRect(wx + ww * 0.5, wy, 1, wh);
      ctx.fillRect(wx, wy + wh * 0.5, ww, 1);
      ctx.fillRect(wx + ww * 0.25, wy, 1, wh);
      ctx.fillRect(wx + ww * 0.75, wy, 1, wh);
    }
  }

  function paintGround(ctx, sky, rand, p, bays, glow, wood) {
    const h = p.base - p.eave;
    const bayW = p.w / bays;
    const top = p.eave + h * 0.5 + Math.max(1, h * 0.035);
    ctx.fillStyle = shade('#6a4e3a', sky, 0.2, 0.55);
    ctx.fillRect(p.x0, top, p.w, p.base - top);
    ctx.fillStyle = wood;
    ctx.globalAlpha = 0.35;
    for (let px = p.x0; px < p.x0 + p.w; px += 2.5) ctx.fillRect(px, top, 1, p.base - top);
    ctx.globalAlpha = 1;
    const door = Math.floor(rand() * bays);
    const dark = rgb(shade('#241f1e', sky, 0.1, 0.1));
    ctx.fillStyle = hex(mixColor(dark, rgb(GOLD), glow * 0.8));
    ctx.fillRect(p.x0 + door * bayW + bayW * 0.25, top, bayW * 0.5, p.base - top);
    ctx.fillStyle = wood;
    ctx.fillRect(p.x0 + door * bayW + bayW * 0.25 - 1, top, 1, p.base - top);
    ctx.fillRect(p.x0 + door * bayW + bayW * 0.75, top, 1, p.base - top);
  }

  function paintRoof(ctx, sky, p) {
    const tile = shade('#2d3040', sky, 0.15, 0.5);
    const ry = p.eave - p.roofH;
    const o = p.w * 0.07 + 1;
    const lift = p.roofH * 0.22;
    const drop = p.roofH * 0.1;
    const ridgeL = p.x0 + p.w * 0.1;
    const ridgeR = p.x0 + p.w * 0.9;
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(p.x0 - o, p.eave - lift);
    ctx.quadraticCurveTo(p.x0 + p.w * 0.2, p.eave + drop * 2, p.x0 + p.w * 0.5, p.eave + drop);
    ctx.quadraticCurveTo(p.x0 + p.w * 0.8, p.eave + drop * 2, p.x0 + p.w + o, p.eave - lift);
    ctx.lineTo(ridgeR, ry);
    ctx.lineTo(ridgeL, ry);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb(tile), sky.haze, 0.35));
    ctx.globalAlpha = 0.5;
    const rows = Math.max(3, Math.round(p.roofH / 2.3));
    for (let k = 1; k < rows; k++) {
      const f = k / rows;
      const xl = lerp(ridgeL, p.x0 - o, f);
      const xr = lerp(ridgeR, p.x0 + p.w + o, f);
      ctx.fillRect(xl, ry + f * p.roofH * 0.95, xr - xl, 1);
    }
    ctx.globalAlpha = 1;
    const cap = Math.max(1.5, p.roofH * 0.1);
    ctx.fillStyle = hex(mixColor(rgb(tile), sky.haze, 0.25));
    ctx.fillRect(ridgeL - 1, ry - cap * 0.6, ridgeR - ridgeL + 2, cap);
    ctx.fillStyle = tile;
    for (const dir of [-1, 1]) {
      const ex = dir < 0 ? ridgeL - 1 : ridgeR + 1;
      ctx.beginPath();
      ctx.moveTo(ex, ry);
      ctx.quadraticCurveTo(ex + dir * p.roofH * 0.1, ry - p.roofH * 0.1, ex + dir * p.roofH * 0.18, ry - p.roofH * 0.3);
      ctx.lineTo(ex - dir * 2, ry);
      ctx.fill();
    }
  }

  // The stepped "horse-head" gable wall at the end that faces the canal.
  function paintGable(ctx, sky, p, wall) {
    const gw = Math.max(4, p.w * 0.07);
    const gx = p.gable > 0 ? p.x0 + p.w - gw : p.x0;
    const sw = gw / 3;
    const ry = p.eave - p.roofH;
    const tile = shade('#2d3040', sky, 0.15, 0.5);
    for (let k = 0; k < 3; k++) {
      const sx = p.gable > 0 ? gx + k * sw : gx + gw - (k + 1) * sw;
      const top = ry - p.roofH * 0.2 + k * p.roofH * 0.4;
      ctx.fillStyle = wall;
      ctx.fillRect(sx, top, sw + 0.6, p.base - top);
      ctx.fillStyle = tile;
      ctx.fillRect(sx - 0.3, top - 1, sw + 1, 1.6);
    }
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.16;
    ctx.fillRect(p.gable > 0 ? gx : gx + gw - 1, ry, 1, p.base - ry);
    ctx.globalAlpha = 1;
  }

  function paintHouse(ctx, sky, rand, p, store) {
    const h = p.base - p.eave;
    const glow = smoothstep(0.15, 0.8, sky.night);
    const wall = shade(WASHI, sky, 0.3, 0.72);
    const wood = shade(WOOD, sky, 0.2, 0.55);
    const beam = Math.max(1, h * 0.035);
    const bays = Math.max(2, Math.round(p.w / (h * 0.42)));
    ctx.fillStyle = wall;
    ctx.fillRect(p.x0, p.eave, p.w, h);
    ctx.fillStyle = shade(MOSS, sky, 0.2, 0.6);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(p.x0, p.base - h * 0.07, p.w, h * 0.07);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    for (let px = 0; px < p.w; px += 5) ctx.fillRect(p.x0 + px + rand() * 4, p.eave, 1, h * (0.1 + rand() * 0.2));
    ctx.globalAlpha = 1;
    ctx.fillStyle = wood;
    ctx.fillRect(p.x0, p.eave, p.w, beam * 1.2);
    ctx.fillRect(p.x0, p.eave + h * 0.5, p.w, beam);
    for (let i = 0; i <= bays; i++) ctx.fillRect(p.x0 + (i * p.w) / bays - (i === bays ? beam : 0), p.eave, beam, h);
    paintWindows(ctx, sky, p, bays, glow, wood);
    paintGround(ctx, sky, rand, p, bays, glow, wood);
    ctx.fillStyle = shade(STONE, sky, 0.3, 0.6);
    ctx.fillRect(p.x0, p.base - h * 0.04, p.w, h * 0.04);
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.22;
    ctx.fillRect(p.x0, p.eave + beam * 1.2, p.w, h * 0.05);
    ctx.globalAlpha = 1;
    paintRoof(ctx, sky, p);
    if (p.gable) paintGable(ctx, sky, p, wall);
    hangLanterns(ctx, sky, p, h, beam, store);
  }

  // Cords are painted now; the lanterns themselves go in after every house, with their glow.
  function hangLanterns(ctx, sky, p, h, beam, store) {
    if (!store || !p.lanterns) return;
    const y0 = p.eave + beam * 1.2;
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    for (let k = 0; k < p.lanterns; k++) {
      const lx = p.x0 + (p.w * (k + 0.5)) / p.lanterns;
      const size = Math.max(4, h * 0.1);
      const drop = h * 0.045;
      ctx.fillRect(lx, y0, 1, drop);
      store.push({ x: lx, y: y0 + drop, s: size, near: p.w });
    }
  }

  function paintLanterns(ctx, list, sky, amount) {
    const glowA = Math.min(1, (0.2 + 0.5 * sky.night) * amount);
    if (glowA > 0) {
      ctx.globalAlpha = glowA;
      for (const l of list) {
        const gs = l.s * 5;
        ctx.drawImage(state.glow, l.x - gs / 2, l.y + l.s * 0.5 - gs / 2, gs, gs);
      }
      ctx.globalAlpha = 1;
    }
    for (const l of list) ctx.drawImage(state.lantern, l.x - l.s * 0.3, l.y, l.s * 0.6, l.s);
  }

  // ---- back of the scene: far hills, far row, far canal -----------------

  function paintHills(ctx, g, sky) {
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = hex(mixColor(mixColor(rgb(INDIGO), sky.haze, 0.7 + k * 0.1), sky.low, 0.35 - k * 0.2));
      ctx.beginPath();
      ctx.moveTo(0, g.H * HORIZON);
      for (let px = 0; px <= g.W; px += 3) {
        const top = g.H * (0.45 - k * 0.02) - fbm(px * 0.015, k * 4, 3, 17 + k) * g.H * 0.07;
        ctx.lineTo(px, top);
      }
      ctx.lineTo(g.W, g.H * HORIZON);
      ctx.fill();
    }
  }

  function paintFarRow(ctx, g, sky, rand) {
    const base = g.H * 0.525;
    for (const side of [-1, 1]) {
      let cursor = g.W * 0.5 + side * g.W * 0.06;
      for (let k = 0; k < 7 && cursor > -g.W * 0.05 && cursor < g.W * 1.05; k++) {
        const w = g.W * (0.05 + rand() * 0.03);
        const h = g.H * (0.08 + rand() * 0.03);
        const x0 = side < 0 ? cursor - w : cursor;
        paintHouse(ctx, sky, rand, { x0, base, w, eave: base - h, roofH: h * 0.45, gable: -side, lanterns: 0 }, null);
        cursor += side * w * 0.8;
      }
    }
  }

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHills(ctx, g, sky);
    ctx.fillStyle = shade('#8d8a7c', sky, 0.3, 0.7);
    ctx.fillRect(0, g.H * HORIZON, g.W, g.H);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.44, g.H * 0.52);
    ctx.lineTo(g.W * 0.56, g.H * 0.52);
    ctx.lineTo(edgeX(g, 1, WATER) + 2, g.H * WATER + 2);
    ctx.lineTo(edgeX(g, -1, WATER) - 2, g.H * WATER + 2);
    ctx.closePath();
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#5d7873'), sky.haze, 0.45), rgb(NIGHT), sky.night * 0.5));
    ctx.fill();
    paintFarRow(ctx, g, sky, rand);
    ctx.globalCompositeOperation = 'source-atop';
    const haze = ctx.createLinearGradient(0, g.H * 0.36, 0, g.H * 0.54);
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(1, hex(sky.haze));
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = haze;
    ctx.fillRect(0, g.H * 0.36, g.W, g.H * 0.18);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- bridge ------------------------------------------------------------

  function bridgeGeom(g) {
    const cx = g.W / 2;
    const wl = g.H * WATER;
    const r = g.H * ARCH_R;
    const ring = Math.max(2, r * 0.17);
    const reach = r * REACH;
    const crest = wl - r - ring - g.H * 0.035;
    const endY = wl - g.H * 0.035;
    const rail = Math.max(2, g.U * 1.8);
    const topAt = (px) => crest + (endY - crest) * Math.pow(Math.min(1, Math.abs(px - cx) / reach), 1.7);
    return { cx, wl, r, ring, reach, crest, endY, rail, topAt };
  }

  function paintBridge(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const b = bridgeGeom(g);
    const { cx, wl, r, ring, reach, crest, topAt } = b;
    const light = shade('#b9b2a2', sky, 0.35, 0.65);
    const dark = shade('#6f6a60', sky, 0.3, 0.65);
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(cx - reach, wl + g.U);
      for (let px = cx - reach; px <= cx + reach; px += 1) ctx.lineTo(px, topAt(px));
      ctx.lineTo(cx + reach, wl + g.U);
      ctx.closePath();
    };
    const grad = ctx.createLinearGradient(0, crest, 0, wl);
    grad.addColorStop(0, light);
    grad.addColorStop(1, dark);
    body();
    ctx.fillStyle = grad;
    ctx.fill();
    paintSteps(ctx, g, sky, b, light, dark);
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.22;
    const course = Math.max(3, g.U * 1.8);
    for (let py = crest + course; py < wl; py += course) {
      ctx.fillRect(cx - reach, py, reach * 2, 1);
      for (let px = cx - reach + rand() * 6; px < cx + reach; px += 5 + rand() * 4) ctx.fillRect(px, py, 1, course);
    }
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = shade(MOSS, sky, 0.3, 0.6);
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const mx = cx + side * (r + ring + rand() * (reach - r - ring));
      ctx.beginPath();
      ctx.ellipse(mx, wl - rand() * g.U * 4, g.U * (0.8 + rand() * 1.4), g.U * (0.5 + rand() * 0.6), 0, 0, 6.3);
      ctx.fill();
    }
    for (const side of [-1, 1]) {
      const vx = cx + side * (r + ring * 1.4);
      ctx.fillRect(vx, wl - r * 0.9, Math.max(1, g.U * 0.6), r * 0.55);
    }
    ctx.restore();
    paintParapet(ctx, g, sky, b);
    paintArch(ctx, g, sky, b);
    return c;
  }

  // A low parapet along the deck: a pale coping line, a dark rail band, posts.
  function paintParapet(ctx, g, sky, b) {
    const { cx, reach, rail, topAt } = b;
    ctx.fillStyle = shade('#8e897d', sky, 0.3, 0.65);
    ctx.beginPath();
    ctx.moveTo(cx - reach, topAt(cx - reach));
    for (let px = cx - reach; px <= cx + reach; px += 1) ctx.lineTo(px, topAt(px) - rail);
    for (let px = cx + reach; px >= cx - reach; px -= 1) ctx.lineTo(px, topAt(px));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade('#d4cdbb', sky, 0.35, 0.65);
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    ctx.beginPath();
    for (let px = cx - reach; px <= cx + reach; px += 1) ctx.lineTo(px, topAt(px) - rail);
    ctx.stroke();
    ctx.fillStyle = shade('#55524b', sky, 0.25, 0.6);
    const step = Math.max(4, g.U * 4);
    for (let px = cx - reach; px <= cx + reach + 0.5; px += step) {
      ctx.fillRect(px, topAt(px) - rail - g.U * 0.8, Math.max(1, g.U * 0.8), rail + g.U * 0.8);
    }
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let px = cx - reach; px <= cx + reach; px += 1) ctx.lineTo(px, topAt(px) + 0.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Flights of steps run down from each end of the deck to the bank.
  function paintSteps(ctx, g, sky, b, light, dark) {
    const { cx, wl, reach, endY } = b;
    const n = 5;
    const tread = g.W * 0.012;
    const rise = (wl - endY) / n;
    for (const side of [-1, 1]) {
      for (let k = 0; k < n; k++) {
        const x0 = cx + side * (reach + k * tread);
        const top = endY + k * rise;
        ctx.fillStyle = k % 2 ? dark : light;
        ctx.fillRect(side < 0 ? x0 - tread - 1 : x0, top, tread + 1, wl + g.U - top);
        ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
        ctx.globalAlpha = 0.4;
        ctx.fillRect(side < 0 ? x0 - tread - 1 : x0, top + rise * 0.8, tread + 1, Math.max(1, rise * 0.25));
        ctx.globalAlpha = 1;
      }
    }
  }

  // The arch: a ring of voussoirs, then the opening cut through to the far canal.
  function paintArch(ctx, g, sky, b) {
    const { cx, wl, r, ring } = b;
    ctx.strokeStyle = shade('#c6bfae', sky, 0.35, 0.65);
    ctx.lineWidth = ring;
    ctx.beginPath();
    ctx.arc(cx, wl, r + ring / 2, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (let k = 0; k <= 20; k++) {
      const a = Math.PI + (k * Math.PI) / 20;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, wl + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + ring), wl + Math.sin(a) * (r + ring));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(cx - r, wl + g.U * 2);
    ctx.lineTo(cx - r, wl);
    ctx.arc(cx, wl, r, Math.PI, 2 * Math.PI);
    ctx.lineTo(cx + r, wl + g.U * 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // The barrel of the vault in shadow, just inside the ring.
    ctx.strokeStyle = shade('#2a2a30', sky, 0.15, 0.3);
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.beginPath();
    ctx.arc(cx, wl, r - ctx.lineWidth / 2, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- bank, willow, scene ------------------------------------------------

  function paintBank(ctx, g, sky) {
    const stone = shade('#8a867a', sky, 0.3, 0.7);
    ctx.fillStyle = stone;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(edgeX(g, side, WATER), g.H * WATER);
      ctx.lineTo(edgeX(g, side, 1.03), g.H * 1.03);
      ctx.lineTo(side < 0 ? 0 : g.W, g.H * 1.03);
      ctx.lineTo(side < 0 ? 0 : g.W, g.H * WATER);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = shade('#5c5950', sky, 0.3, 0.7);
    ctx.lineWidth = Math.max(2, g.U * 1.2);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(edgeX(g, side, WATER), g.H * WATER);
      ctx.lineTo(edgeX(g, side, 1.03), g.H * 1.03);
      ctx.stroke();
    }
  }

  // A willow bough reaching in from the top left; its strands hang and sway each frame.
  function paintBough(ctx, g, sky, rand) {
    const pts = [];
    const p0 = { x: -g.W * 0.02, y: -g.H * 0.01 };
    const p1 = { x: g.W * 0.12, y: g.H * 0.01 };
    const p2 = { x: g.W * 0.24, y: g.H * 0.07 };
    ctx.strokeStyle = shade(WOOD, sky, 0.2, 0.55);
    ctx.lineWidth = Math.max(2, g.U * 1.6);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
    ctx.stroke();
    const leaf = [shade('#4f6a48', sky, 0.25, 0.6), shade('#6d8a54', sky, 0.25, 0.6)];
    for (let i = 0; i < 26; i++) {
      const u = rand();
      ctx.fillStyle = leaf[i % 2];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(bez(p0.x, p1.x, p2.x, u) + (rand() - 0.5) * g.U * 3, bez(p0.y, p1.y, p2.y, u) + rand() * g.U * 3,
        g.U * (1.6 + rand() * 1.6), g.U * (1 + rand()), 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < STRANDS; i++) {
      const u = 0.08 + (i / (STRANDS - 1)) * 0.92;
      const ax = bez(p0.x, p1.x, p2.x, u) + (rand() - 0.5) * g.U * 2;
      const ay = bez(p0.y, p1.y, p2.y, u) + g.U;
      const len = g.H * (0.1 + rand() * 0.22) * (1.15 - u * 0.5);
      pts.push({ x: ax, y: ay, len, lean: (rand() - 0.3) * g.U * 2, ph: rand() * 6.3 });
    }
    return pts;
  }

  function bez(a, b, c, u) {
    return (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
  }

  function paintWater(ctx, g, sky) {
    const wl = g.H * WATER;
    const top = mixColor(mixColor(rgb('#46655b'), sky.low, 0.25), rgb('#10162a'), sky.night * 0.55);
    const bottom = mixColor(mixColor(rgb('#26403f'), sky.top, 0.15), rgb('#0b1020'), sky.night * 0.5);
    const grad = ctx.createLinearGradient(0, wl, 0, g.H);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(bottom));
    waterPath(ctx, g, WATER);
    ctx.fillStyle = grad;
    ctx.fill();
    return grad;
  }

  function paintScene(g, sky, rand, mid, amount) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(mid, 0, 0);
    paintWater(ctx, g, sky);
    paintBank(ctx, g, sky);
    const lanterns = [];
    for (const spec of FRONT) paintHouse(ctx, sky, rand, resolveHouse(g, spec), lanterns);
    paintLanterns(ctx, state.behindLanterns.concat(lanterns), sky, amount);
    state.flickers = lanterns.sort((a, b) => b.near - a.near).slice(0, FLICKERS);
    state.strands = paintBough(ctx, g, sky, rand);
    return c;
  }

  // Everything behind the front houses: far canal, back row, the two far houses, the bridge.
  function paintMid(g, sky, rand, back, bridge) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(back, 0, 0);
    state.behindLanterns = [];
    for (const spec of BEHIND) paintHouse(ctx, sky, rand, resolveHouse(g, spec), state.behindLanterns);
    ctx.drawImage(bridge, 0, 0);
    return c;
  }

  // ---- water -------------------------------------------------------------

  // The canal with the sky, the far bank and the bridge mirrored in it, already
  // masked to the canal (inset so the wobble never crosses the bank).
  function paintReflection(g, sky, skyC, mid) {
    const src = layer(g.W, g.H);
    const sctx = src.getContext('2d');
    sctx.drawImage(skyC, 0, 0);
    sctx.drawImage(mid, 0, 0);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wl = g.H * WATER;
    ctx.save();
    waterPath(ctx, g, WATER, state.inset);
    ctx.clip();
    const grad = paintWater(ctx, g, sky);
    ctx.globalAlpha = 0.72;
    ctx.translate(0, 2 * wl);
    ctx.scale(1, -1);
    ctx.drawImage(src, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grad;
    ctx.fillRect(0, wl, g.W, g.H - wl);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = hex(mixColor(rgb('#1d3436'), rgb(NIGHT), sky.night));
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, wl + (g.H - wl) * 0.45, g.W, g.H);
    ctx.globalCompositeOperation = 'source-over';
    paintStreaks(ctx, g, sky);
    ctx.restore();
    return c;
  }

  // Lantern light lying on the water by each bank, and faint lines of current.
  function paintStreaks(ctx, g, sky) {
    const rand = K.rng(5);
    const wl = g.H * WATER;
    ctx.fillStyle = hex(mixColor(sky.low, rgb(WASHI), 0.5));
    for (let i = 0; i < 40; i++) {
      const y = wl + 2 + rand() * (g.H - wl);
      const f = y / g.H;
      const x = lerp(edgeX(g, -1, f), edgeX(g, 1, f), rand());
      ctx.globalAlpha = 0.08 + rand() * 0.1;
      ctx.fillRect(x, y, g.U * (2 + rand() * 6), 1);
    }
    const warm = smoothstep(0.1, 0.7, sky.night);
    ctx.fillStyle = hex(mixColor(rgb(VERMILION), rgb(GOLD), 0.3));
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const y = wl + g.U * 2 + k * g.U * 3.4;
        const x = edgeX(g, side, y / g.H) - side * (state.inset + g.U * (1 + (k % 2)));
        ctx.globalAlpha = (0.25 + 0.35 * warm) * (1 - k / 7);
        ctx.fillRect(x - g.U * 1.5, y, g.U * 3, Math.max(1, g.U * 0.9));
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- boat --------------------------------------------------------------

  // A wupeng boat, side on, bow to the left, with a boatman sculling at the stern.
  function paintBoat(g, sky) {
    const len = Math.round(g.W * 0.24);
    const hh = Math.round(g.H * 0.15);
    const c = layer(len, hh);
    const ctx = c.getContext('2d');
    const hull = shade('#5a4030', sky, 0.25, 0.45);
    const deck = hh * 0.66;
    const keel = hh * 0.9;
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(len * 0.0, deck - hh * 0.1);
    ctx.quadraticCurveTo(len * 0.1, keel, len * 0.3, keel);
    ctx.lineTo(len * 0.78, keel);
    ctx.quadraticCurveTo(len * 0.95, keel, len * 0.99, deck - hh * 0.06);
    ctx.lineTo(len * 0.06, deck);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade('#c9b27a', sky, 0.25, 0.45);
    ctx.fillRect(len * 0.06, deck - 1, len * 0.9, Math.max(1, hh * 0.05));
    const dome = shade(INK, sky, 0.1, 0.3);
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.moveTo(len * 0.24, deck);
    ctx.lineTo(len * 0.24, hh * 0.46);
    ctx.quadraticCurveTo(len * 0.24, hh * 0.28, len * 0.34, hh * 0.28);
    ctx.lineTo(len * 0.6, hh * 0.28);
    ctx.quadraticCurveTo(len * 0.7, hh * 0.28, len * 0.7, hh * 0.46);
    ctx.lineTo(len * 0.7, deck);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb(dome), rgb(INDIGO), 0.6));
    ctx.globalAlpha = 0.6;
    for (let px = len * 0.27; px < len * 0.69; px += Math.max(2, len * 0.04)) ctx.fillRect(px, hh * 0.32, 1, deck - hh * 0.33);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = shade('#8c94a8', sky, 0.25, 0.4);
    ctx.lineWidth = Math.max(1, hh * 0.04);
    ctx.beginPath();
    ctx.moveTo(len * 0.24, hh * 0.46);
    ctx.quadraticCurveTo(len * 0.24, hh * 0.28, len * 0.34, hh * 0.28);
    ctx.lineTo(len * 0.6, hh * 0.28);
    ctx.quadraticCurveTo(len * 0.7, hh * 0.28, len * 0.7, hh * 0.46);
    ctx.stroke();
    paintBoatman(ctx, sky, len, hh, deck, hull);
    ctx.fillStyle = VERMILION;
    ctx.beginPath();
    ctx.ellipse(len * 0.2, hh * 0.44, Math.max(1.2, len * 0.025), Math.max(1.6, hh * 0.06), 0, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintBoatman(ctx, sky, len, hh, deck, hull) {
    const bx = len * 0.83;
    ctx.fillStyle = shade('#2b3448', sky, 0.15, 0.3);
    ctx.fillRect(bx - len * 0.02, hh * 0.3, len * 0.04, deck - hh * 0.3);
    ctx.fillStyle = shade('#c9b27a', sky, 0.25, 0.5);
    ctx.beginPath();
    ctx.moveTo(bx - len * 0.05, hh * 0.3);
    ctx.lineTo(bx + len * 0.05, hh * 0.3);
    ctx.lineTo(bx, hh * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hull;
    ctx.lineWidth = Math.max(1, len * 0.012);
    ctx.beginPath();
    ctx.moveTo(bx - len * 0.04, hh * 0.38);
    ctx.lineTo(len * 0.99, hh * 0.99);
    ctx.stroke();
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, props) {
    const sky = S.at(S.hour(props.time));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    const back = paintBack(g, sky, rand);
    const bridge = paintBridge(g, sky, rand);
    const mid = paintMid(g, sky, rand, back, bridge);
    state.scene = paintScene(g, sky, rand, mid, props.lanterns);
    state.refl = paintReflection(g, sky, state.sky, mid);
    state.boat = paintBoat(g, sky);
    state.cloudAlpha = 0.95 - sky.night * 0.55;
    state.night = sky.night;
    state.tint = hex(mixColor(sky.amb, rgb('#f4f0e4'), 0.5));
    state.willowInk = shade('#6d8a54', sky, 0.25, 0.6);
    state.choice = props.time;
    state.amount = props.lanterns;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawWisps(ctx, c, x, y, alpha) {
    if (alpha <= 0) return;
    const off = -(((x % c.width) + c.width) % c.width);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // The baked reflection redrawn in bands, each slid sideways a little.
  function drawReflection(ctx, g, t) {
    const wl = Math.floor(g.H * WATER);
    const bh = state.band;
    for (let py = wl; py < g.H; py += bh) {
      const k = (py - wl) / (g.H - wl);
      const amp = g.U * (0.35 + 1.15 * k);
      const dx = Math.sin(t * 1.3 + py * 0.5) * amp * 0.75 + Math.sin(t * 0.55 - py * 0.17) * amp * 0.45;
      const x0 = Math.floor(edgeX(g, -1, (py + bh) / g.H));
      const w = g.W - 2 * x0;
      ctx.drawImage(state.refl, x0, py, w, bh, x0 + dx, py, w, bh);
    }
  }

  function drawGlints(ctx, t) {
    ctx.fillStyle = state.tint;
    for (const s of state.glints) {
      ctx.globalAlpha = Math.pow(0.5 + 0.5 * Math.sin(t * 0.7 + s.ph), 3) * 0.45;
      ctx.fillRect(s.x + Math.sin(t * 0.4 + s.ph) * 2, s.y, s.w, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t) {
    ctx.strokeStyle = state.tint;
    ctx.lineWidth = 1;
    for (const r of state.ripples) {
      const a = (t * 0.12 + r.ph) % 1;
      const rx = a * g.U * 9 + 1;
      ctx.globalAlpha = (1 - a) * 0.3;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx, rx * 0.22, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Out from under the arch and down the canal toward you, growing as it comes.
  function drawBoat(ctx, g, t) {
    const b = state.boat;
    const p = (t / BOAT_PERIOD + 0.3) % 1;
    const alpha = smoothstep(0, 0.08, p) * (1 - smoothstep(0.85, 1, p));
    if (alpha <= 0.01) return;
    const e = Math.pow(p, 1.25);
    const wl = g.H * WATER;
    const waterline = lerp(wl + g.U * 3, g.H * 0.95, e);
    const s = lerp(0.3, 1.05, (waterline - wl) / (g.H - wl));
    const w = b.width * s;
    const h = b.height * s;
    const cx = lerp(g.W * 0.5, g.W * 0.4, e);
    const bx = cx - w / 2;
    const by = waterline - h * 0.9 + Math.sin(t * 1.1) * 0.4;
    ctx.strokeStyle = state.tint;
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      ctx.moveTo(bx + w * 0.05, waterline + sgn * g.U * 0.3);
      ctx.lineTo(bx + w * 0.75, waterline + sgn * g.U * 1.6 * s);
    }
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.28;
    ctx.save();
    ctx.translate(0, 2 * waterline);
    ctx.scale(1, -1);
    ctx.drawImage(b, bx, by, w, h);
    ctx.restore();
    ctx.globalAlpha = alpha;
    ctx.drawImage(b, bx, by, w, h);
    ctx.globalAlpha = 1;
  }

  function drawWillow(ctx, g, t) {
    ctx.strokeStyle = state.willowInk;
    ctx.lineWidth = Math.max(1.5, g.U * 1.1);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (const s of state.strands) {
      const sway = (Math.sin(t * 0.7 + s.ph) + 0.4 * Math.sin(t * 1.9 + s.ph * 2)) * g.U * 2.6;
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + s.lean + sway * 0.25, s.y + s.len * 0.55, s.x + s.lean * 1.4 + sway, s.y + s.len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Only a few nearby lanterns breathe a little; the rest are baked.
  function drawFlicker(ctx, t, amount) {
    const base = (0.08 + 0.18 * state.night) * amount;
    if (base <= 0) return;
    for (let i = 0; i < state.flickers.length; i++) {
      const l = state.flickers[i];
      const gs = l.s * 3.2;
      ctx.globalAlpha = Math.min(1, base * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.9)));
      ctx.drawImage(state.glow, l.x - gs / 2, l.y + l.s * 0.5 - gs / 2, gs, gs);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.inset = Math.ceil(g.U * 2.2);
    state.band = Math.max(2, Math.round(g.U * 1.2));
    state.clouds = paintWisps(g.W, g.H * 0.26, 0.07, 21, 210);
    state.mist = paintWisps(g.W, g.H * 0.12, 0.12, 33, 170);
    state.glow = paintGlow();
    state.lantern = paintLantern();
    const rand = K.rng(91);
    const place = () => {
      const y = g.H * (WATER + 0.04 + rand() * (1 - WATER - 0.06));
      const f = y / g.H;
      return { x: lerp(edgeX(g, -1, f) + state.inset, edgeX(g, 1, f) - state.inset * 3, rand()), y };
    };
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) state.glints.push(Object.assign(place(), { w: 1 + Math.floor(rand() * 3), ph: rand() * 6.3 }));
    state.ripples = [];
    for (let i = 0; i < RIPPLES; i++) state.ripples.push(Object.assign(place(), { ph: i / RIPPLES }));
    repaint(g, api.props);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.amount !== props.lanterns) repaint(g, props);
    ctx.drawImage(state.sky, 0, 0);
    drawWisps(ctx, state.clouds, t * g.U * 1.2, g.H * 0.02, state.cloudAlpha);
    ctx.drawImage(state.scene, 0, 0);
    drawReflection(ctx, g, t);
    drawGlints(ctx, t);
    drawRipples(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    drawFlicker(ctx, t, props.lanterns);
    drawWisps(ctx, state.mist, t * g.U * 0.8, g.H * 0.5, 0.45 * props.mist * (1 - state.night * 0.5));
    drawWillow(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', lanterns: 1, mist: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
