/*
 * 乌镇 Wuzhen — a Jiangnan water town canal at the foot of a single-arch stone bridge.
 *
 * Sky, houses, bridge, bank and water colour are baked into layers and
 * repainted once a minute from the clock, so the windows glow at night.
 * Between repaints only the reflection ripple, a boat, willow strands,
 * lantern glow, drifting cloud and mist move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.5;
  const WATER = 0.62;
  const HALF_AT_WATER = 0.155;
  const HALF_GROWTH = 0.245;
  const BANK = 0.018;
  const ARCH_R = 0.15;
  const RETINT_SECONDS = 60;
  const STRANDS = 18;
  const RIPPLES = 5;
  const GLINTS = 14;
  const BOAT_LANE = 0.86;

  const INK = '#23252e';
  const WASHI = '#ece6d4';
  const INDIGO = '#3a4a6e';
  const VERMILION = '#c8452c';
  const MOSS = '#4f6a48';
  const GOLD = '#d9a73a';
  const WOOD = '#4a3a30';
  const STONE = '#a29f94';

  // Bank houses from far to near. side -1 stands left of the canal, +1 right.
  const HOUSES = [
    { side: -1, base: 0.64, eave: 0.46, roof: 0.09, w: 0.095, far: true, lanterns: 2 },
    { side: -1, base: 0.76, eave: 0.42, roof: 0.13, w: 0.15, lanterns: 3 },
    { side: -1, base: 0.98, eave: 0.34, roof: 0.19, w: 0.4, near: true, lanterns: 4 },
    { side: 1, base: 0.65, eave: 0.46, roof: 0.09, w: 0.1, far: true, lanterns: 2 },
    { side: 1, base: 0.78, eave: 0.41, roof: 0.13, w: 0.15, lanterns: 3 },
    { side: 1, base: 0.98, eave: 0.35, roof: 0.18, w: 0.4, near: true, lanterns: 4 },
  ];
  const WILLOW = { x: 0.8, base: 0.87, top: 0.5 };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  // A colour as the sky lights it: tinted by the ambient light, then pulled toward night blue.
  function shade(c, sky, amb, dark) {
    const lit = mixColor(rgb(c), sky.amb, amb);
    return hex(mixColor(lit, rgb('#171b2e'), sky.night * dark));
  }

  // Half width of the canal at a height given as a fraction of the height.
  function half(g, f) {
    return g.W * (HALF_AT_WATER + ((f - WATER) / (1 - WATER)) * HALF_GROWTH);
  }

  function edgeX(g, side, f) {
    return g.W * 0.5 + side * half(g, f);
  }

  function waterPath(ctx, g, from) {
    ctx.beginPath();
    ctx.moveTo(edgeX(g, -1, from), g.H * from);
    ctx.lineTo(edgeX(g, 1, from), g.H * from);
    ctx.lineTo(edgeX(g, 1, 1.03), g.H * 1.03);
    ctx.lineTo(edgeX(g, -1, 1.03), g.H * 1.03);
    ctx.closePath();
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = hex(sky.low);
    ctx.fillRect(0, g.H * HORIZON, g.W, g.H);
    if (sky.night < 0.8) {
      const sx = g.W * lerp(0.1, 0.9, S.sunT(sky.hour));
      const glow = ctx.createRadialGradient(sx, g.H * 0.48, 0, sx, g.H * 0.48, g.W * 0.5);
      glow.addColorStop(0, hex(sky.amb));
      ctx.globalAlpha = 0.3 * (1 - sky.night);
      glow.addColorStop(1, hex(sky.low));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, g.W, g.H * HORIZON);
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
    const mx = g.W * lerp(0.12, 0.88, mt);
    const my = g.H * (0.34 - 0.2 * Math.sin(Math.PI * mt));
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

  // Wisps that tile sideways, kept to the upper sky.
  function paintWisps(w, h, freqY, seed, peak) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (px, py) => fbm(px * 0.012, py * freqY, 4, seed);
    for (let py = 0; py < h; py++) {
      const band = Math.sin((py / h) * Math.PI);
      for (let px = 0; px < w; px++) {
        const v = lerp(density(px, py), density(px - w, py), px / w);
        const i = (py * w + px) * 4;
        img.data[i] = 240;
        img.data[i + 1] = 237;
        img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * peak;
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
    const edge = edgeX(g, spec.side, spec.base + BANK);
    const x0 = spec.side < 0 ? edge - w - 1 : edge + 1;
    return {
      x0, base, w, eave: g.H * spec.eave, roofH: g.H * spec.roof,
      gable: spec.near ? 0 : -spec.side, lanterns: spec.lanterns, far: !!spec.far,
    };
  }

  function paintWindows(ctx, g, sky, p, bays, glow, wood) {
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

  function paintGround(ctx, g, sky, rand, p, bays, glow, wood) {
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

  function paintRoof(ctx, sky, p, h) {
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

  // The stepped gable wall at the end that faces the canal.
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

  function paintHouse(ctx, g, sky, rand, p, store) {
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
    paintWindows(ctx, g, sky, p, bays, glow, wood);
    paintGround(ctx, g, sky, rand, p, bays, glow, wood);
    ctx.fillStyle = shade(STONE, sky, 0.3, 0.6);
    ctx.fillRect(p.x0, p.base - h * 0.04, p.w, h * 0.04);
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.22;
    ctx.fillRect(p.x0, p.eave + beam * 1.2, p.w, h * 0.05);
    ctx.globalAlpha = 1;
    paintRoof(ctx, sky, p, h);
    if (p.gable) paintGable(ctx, sky, p, wall);
    hangLanterns(ctx, sky, p, h, beam, store);
  }

  function hangLanterns(ctx, sky, p, h, beam, store) {
    if (!store || !p.lanterns) return;
    const y0 = p.eave + beam * 1.2;
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    for (let k = 0; k < p.lanterns; k++) {
      const lx = p.x0 + (p.w * (k + 0.5)) / p.lanterns;
      const size = Math.max(4, h * 0.1);
      const drop = h * 0.045;
      ctx.fillRect(lx, y0, 1, drop);
      store.push({ x: lx, y: y0 + drop, s: size, ph: k * 1.7 + p.base * 9 });
    }
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
      let cursor = edgeX(g, side, 0.525);
      for (let k = 0; k < 6 && cursor > -g.W * 0.05 && cursor < g.W * 1.05; k++) {
        const w = g.W * (0.055 + rand() * 0.03);
        const h = g.H * (0.1 + rand() * 0.03);
        const x0 = side < 0 ? cursor - w : cursor;
        paintHouse(ctx, g, sky, rand, { x0, base, w, eave: base - h, roofH: h * 0.45, gable: -side, lanterns: 0 }, null);
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
    waterPath(ctx, g, HORIZON);
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#5d7873'), sky.haze, 0.45), rgb('#171b2e'), sky.night * 0.5));
    ctx.fill();
    ctx.fillStyle = shade(MOSS, sky, 0.3, 0.6);
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(rand() * g.W, g.H * (0.49 + rand() * 0.03), g.U * (0.8 + rand() * 1.4), 0, 6.3);
      ctx.fill();
    }
    paintFarRow(ctx, g, sky, rand);
    ctx.globalCompositeOperation = 'source-atop';
    const haze = ctx.createLinearGradient(0, g.H * 0.36, 0, g.H * 0.52);
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(1, hex(sky.haze));
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = haze;
    ctx.fillRect(0, g.H * 0.36, g.W, g.H * 0.16);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- bridge ------------------------------------------------------------

  function paintBridge(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const cx = g.W / 2;
    const wl = g.H * WATER;
    const r = Math.min(g.W * ARCH_R, g.H * 0.3);
    const ring = r * 0.13;
    const reach = r * 1.55;
    const crest = wl - r - ring - r * 0.2;
    const endY = wl - g.H * 0.02;
    const topAt = (px) => crest + (endY - crest) * Math.pow(Math.min(1, Math.abs(px - cx) / reach), 1.8);
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(cx - reach, wl + g.U);
      for (let px = cx - reach; px <= cx + reach; px += 2) ctx.lineTo(px, topAt(px));
      ctx.lineTo(cx + reach, wl + g.U);
      ctx.closePath();
    };
    body();
    ctx.fillStyle = shade(STONE, sky, 0.35, 0.7);
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.16;
    const course = Math.max(3, g.U * 1.8);
    for (let py = crest; py < wl; py += course) {
      ctx.fillRect(cx - reach, py, reach * 2, 1);
      for (let px = cx - reach + rand() * 6; px < cx + reach; px += 6 + rand() * 4) ctx.fillRect(px, py, 1, course);
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = shade(MOSS, sky, 0.3, 0.6);
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const mx = cx + side * (r + ring + rand() * (reach - r - ring));
      ctx.beginPath();
      ctx.ellipse(mx, wl - rand() * g.U * 3, 2 + rand() * 3, 1 + rand() * 1.5, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = shade('#c4c0b2', sky, 0.35, 0.7);
    ctx.lineWidth = Math.max(2, g.U * 1.1);
    ctx.beginPath();
    for (let px = cx - reach; px <= cx + reach; px += 2) ctx.lineTo(px, topAt(px) + 0.5);
    ctx.stroke();
    ctx.fillStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.3;
    for (let px = cx - reach; px < cx + reach; px += 3) {
      if (Math.abs(px - cx) > reach * 0.4) ctx.fillRect(px, topAt(px) + g.U * 0.8, 1, 2);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = shade('#85827a', sky, 0.3, 0.7);
    ctx.lineWidth = ring;
    ctx.beginPath();
    ctx.arc(cx, wl, r + ring / 2, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    for (let k = 0; k <= 24; k++) {
      const a = Math.PI + (k * Math.PI) / 24;
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
    ctx.strokeStyle = shade(INK, sky, 0.2, 0.3);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, wl, r - 1.5, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- bank, willow, scene ------------------------------------------------

  function paintBank(ctx, g, sky) {
    ctx.strokeStyle = shade('#7d7a70', sky, 0.3, 0.7);
    ctx.lineWidth = Math.max(2, g.U * 1.2);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(edgeX(g, side, WATER), g.H * WATER);
      ctx.lineTo(edgeX(g, side, 1.03), g.H * 1.03);
      ctx.stroke();
    }
  }

  function bez(a, b, c, u) {
    return (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
  }

  function paintWillow(ctx, g, sky, rand) {
    const wx = g.W * WILLOW.x;
    const top = { x: wx - g.W * 0.015, y: g.H * WILLOW.top };
    const left = { x: wx - g.W * 0.14, y: g.H * 0.43 };
    const right = { x: wx + g.W * 0.12, y: g.H * 0.44 };
    const ctrl = { x: wx, y: g.H * 0.34 };
    const bark = shade(WOOD, sky, 0.2, 0.55);
    ctx.strokeStyle = bark;
    ctx.lineWidth = Math.max(2, g.U * 1.7);
    ctx.beginPath();
    ctx.moveTo(wx, g.H * WILLOW.base);
    ctx.quadraticCurveTo(wx + g.W * 0.006, g.H * 0.68, top.x, top.y);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    for (const end of [left, right]) {
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y);
      ctx.stroke();
    }
    const leaf = shade('#6d8a54', sky, 0.25, 0.6);
    ctx.fillStyle = leaf;
    ctx.globalAlpha = 0.8;
    state.strands = [];
    for (let i = 0; i < STRANDS; i++) {
      const u = i / (STRANDS - 1);
      const end = u < 0.5 ? left : right;
      const k = u < 0.5 ? u * 2 : (u - 0.5) * 2;
      const ax = bez(top.x, ctrl.x, end.x, k);
      const ay = bez(top.y, ctrl.y, end.y, k);
      state.strands.push({ x: ax, y: ay, len: g.H * (0.14 + rand() * 0.14), ph: rand() * 6.3 });
      ctx.beginPath();
      ctx.ellipse(ax, ay, g.U * (1.2 + rand()), g.U * 0.9, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintScene(g, sky, rand, back, bridge, water, lanterns) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(back, 0, 0);
    ctx.drawImage(water, 0, 0);
    const houses = HOUSES.map((spec) => resolveHouse(g, spec));
    for (const p of houses) paintHouse(ctx, g, sky, rand, p, lanterns);
    ctx.drawImage(bridge, 0, 0);
    paintBank(ctx, g, sky);
    paintWillow(ctx, g, sky, rand);
    state.edgeLanterns = houses.filter((p) => p.lanterns).map((p) => ({ x: edgeX(g, -p.gable, p.base / g.H + BANK), y: p.base + g.H * BANK, side: -p.gable }));
    return c;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wl = g.H * WATER;
    const top = mixColor(mixColor(rgb('#46655b'), sky.low, 0.25), rgb('#10162a'), sky.night * 0.55);
    const bottom = mixColor(mixColor(rgb('#26403f'), sky.top, 0.15), rgb('#0b1020'), sky.night * 0.5);
    const grad = ctx.createLinearGradient(0, wl, 0, g.H);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(bottom));
    waterPath(ctx, g, WATER);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.save();
    waterPath(ctx, g, WATER);
    ctx.clip();
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = g.U * 4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(edgeX(g, side, WATER) - side * g.U * 2, wl);
      ctx.lineTo(edgeX(g, side, 1.03) - side * g.U * 2, g.H * 1.03);
      ctx.stroke();
    }
    ctx.restore();
    return c;
  }

  function paintReflection(g, sky, skyC, back, bridge) {
    const src = layer(g.W, g.H);
    const sctx = src.getContext('2d');
    sctx.drawImage(skyC, 0, 0);
    sctx.drawImage(back, 0, 0);
    sctx.drawImage(bridge, 0, 0);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wl = g.H * WATER;
    ctx.save();
    waterPath(ctx, g, WATER);
    ctx.clip();
    ctx.translate(0, 2 * wl);
    ctx.scale(1, -1);
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, wl, 0, g.H);
    fade.addColorStop(0, 'rgba(0,0,0,0.7)');
    fade.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = VERMILION;
    ctx.globalAlpha = 0.4;
    for (const e of state.edgeLanterns) ctx.fillRect(e.x - e.side * g.U * 3, e.y + g.U * 0.5, 1.5, g.U * 3.5);
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- boat --------------------------------------------------------------

  function paintBoat(g, sky) {
    const len = Math.round(g.W * 0.25);
    const hh = Math.round(g.H * 0.13);
    const c = layer(len, hh * 1.1);
    const ctx = c.getContext('2d');
    const hull = shade('#3a2c26', sky, 0.2, 0.5);
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(len * 0.02, hh * 0.5);
    ctx.quadraticCurveTo(len * 0.1, hh * 0.86, len * 0.3, hh * 0.88);
    ctx.lineTo(len * 0.78, hh * 0.88);
    ctx.quadraticCurveTo(len * 0.95, hh * 0.86, len * 0.99, hh * 0.58);
    ctx.lineTo(len * 0.08, hh * 0.64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade('#6a4e3a', sky, 0.2, 0.5);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(len * 0.14, hh * 0.72, len * 0.76, 1);
    ctx.globalAlpha = 1;
    const dome = shade(INK, sky, 0.1, 0.3);
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.moveTo(len * 0.22, hh * 0.64);
    ctx.lineTo(len * 0.22, hh * 0.38);
    ctx.quadraticCurveTo(len * 0.22, hh * 0.12, len * 0.34, hh * 0.12);
    ctx.lineTo(len * 0.64, hh * 0.12);
    ctx.quadraticCurveTo(len * 0.76, hh * 0.12, len * 0.76, hh * 0.38);
    ctx.lineTo(len * 0.76, hh * 0.64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb(dome), rgb(INDIGO), 0.5));
    ctx.globalAlpha = 0.5;
    for (let px = len * 0.25; px < len * 0.75; px += 3) ctx.fillRect(px, hh * 0.2, 1, hh * 0.42);
    ctx.fillRect(len * 0.22, hh * 0.38, len * 0.54, 1);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = hull;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(len * 0.05, hh * 0.52);
    ctx.lineTo(len * 0.05, hh * 0.28);
    ctx.moveTo(len * 0.88, hh * 0.58);
    ctx.lineTo(len * 0.99, hh * 1.06);
    ctx.stroke();
    ctx.fillStyle = VERMILION;
    ctx.beginPath();
    ctx.ellipse(len * 0.05, hh * 0.34, 1.6, 2.2, 0, 0, 6.3);
    ctx.fill();
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.lanterns = [];
    const skyC = paintSky(g, sky, rand);
    const back = paintBack(g, sky, rand);
    const bridge = paintBridge(g, sky, rand);
    state.sky = skyC;
    state.scene = paintScene(g, sky, rand, back, bridge, paintWater(g, sky), state.lanterns);
    state.refl = paintReflection(g, sky, skyC, back, bridge);
    state.boat = paintBoat(g, sky);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.tint = hex(mixColor(sky.amb, rgb('#f4f0e4'), 0.5));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.0) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.U * 0.6) % c.width);
    ctx.globalAlpha = Math.min(1, 0.4 * amount * (1 - state.night * 0.5));
    ctx.drawImage(c, off, g.H * 0.46);
    ctx.drawImage(c, off + c.width, g.H * 0.46);
    ctx.globalAlpha = 1;
  }

  function drawReflection(ctx, g, t) {
    const wl = Math.floor(g.H * WATER);
    ctx.save();
    waterPath(ctx, g, WATER);
    ctx.clip();
    for (let py = wl; py < g.H; py += 3) {
      const k = (py - wl) / (g.H - wl);
      const amp = g.U * (0.4 + 1.4 * k);
      const dx = Math.sin(t * 1.4 + py * 0.55) * amp + Math.sin(t * 0.7 + py * 0.2) * amp * 0.6;
      ctx.drawImage(state.refl, 0, py, g.W, 3, dx, py, g.W, 3);
    }
    ctx.restore();
  }

  function drawGlints(ctx, t) {
    ctx.fillStyle = state.tint;
    for (const s of state.glints) {
      ctx.globalAlpha = (0.5 + 0.5 * Math.sin(t * 0.6 + s.ph)) * 0.3;
      ctx.fillRect(s.x, s.y, s.w, 1);
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

  function drawBoat(ctx, g, t) {
    const b = state.boat;
    const p = (t * 0.011) % 1;
    const alpha = smoothstep(0, 0.12, p) * (1 - smoothstep(0.88, 1, p));
    if (alpha <= 0.01) return;
    const bx = lerp(g.W * 0.66, g.W * 0.34, p) - b.width / 2;
    const waterline = g.H * BOAT_LANE;
    const hullBottom = b.height / 1.1 * 0.88;
    const by = waterline - hullBottom + Math.sin(t * 1.1) * 0.4;
    ctx.strokeStyle = state.tint;
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha * 0.25;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(bx + b.width * 0.12, waterline + s * g.U * 0.4);
      ctx.lineTo(bx + b.width * 0.7, waterline + s * g.U * 1.3);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.3;
    ctx.save();
    ctx.translate(0, 2 * waterline);
    ctx.scale(1, -1);
    ctx.drawImage(b, bx, by);
    ctx.restore();
    ctx.globalAlpha = alpha;
    ctx.drawImage(b, bx, by);
    ctx.globalAlpha = 1;
  }

  function drawWillow(ctx, g, t) {
    ctx.strokeStyle = state.willowInk;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (const s of state.strands) {
      const sway = Math.sin(t * 0.8 + s.ph) * g.U * 1.4;
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + sway * 0.3, s.y + s.len * 0.5, s.x + sway, s.y + s.len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, t, amount) {
    const glowA = (0.2 + 0.5 * state.night) * amount;
    for (const l of state.lanterns) {
      const sway = Math.sin(t * 0.9 + l.ph) * l.s * 0.05;
      const pulse = 0.9 + 0.1 * Math.sin(t * 0.5 + l.ph * 1.3);
      const gs = l.s * 5;
      ctx.globalAlpha = Math.min(1, glowA * pulse);
      ctx.drawImage(state.glow, l.x + sway - gs / 2, l.y + l.s * 0.5 - gs / 2, gs, gs);
      ctx.globalAlpha = 1;
      ctx.drawImage(state.lantern, l.x + sway - l.s * 0.3, l.y, l.s * 0.6, l.s);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintWisps(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3), 0.07, 21, 200);
    state.mist = paintWisps(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2), 0.1, 33, 150);
    state.glow = paintGlow();
    state.lantern = paintLantern();
    const rand = K.rng(91);
    const waterY = () => g.H * (WATER + 0.03 + rand() * (1 - WATER - 0.04));
    const place = () => {
      const y = waterY();
      const f = y / g.H;
      return { x: lerp(edgeX(g, -1, f), edgeX(g, 1, f), rand()), y };
    };
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) state.glints.push(Object.assign(place(), { w: 1 + Math.floor(rand() * 3), ph: rand() * 6.3 }));
    state.ripples = [];
    for (let i = 0; i < RIPPLES; i++) state.ripples.push(Object.assign(place(), { ph: i / RIPPLES }));
    repaint(g, api.props.time);
    state.willowInk = shade('#5f8050', S.at(S.hour(api.props.time)), 0.25, 0.6);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) {
      repaint(g, props.time);
      state.willowInk = shade('#5f8050', S.at(S.hour(props.time)), 0.25, 0.6);
    }
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.scene, 0, 0);
    drawReflection(ctx, g, t);
    drawGlints(ctx, t);
    drawRipples(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    drawWillow(ctx, g, t);
    drawLanterns(ctx, t, props.lanterns);
    drawMist(ctx, g, t, props.mist);
  }

  Kasuri.run({
    defaults: { time: 'auto', lanterns: 1, mist: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
