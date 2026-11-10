/*
 * 鞆の浦 Tomonoura — an old harbour town on the Inland Sea.
 *
 * Sky, far islands, the hill with its tiled roofs, the quay and the tall
 * stone lantern are baked into layers and repainted once a minute from the
 * clock. Between repaints only the water shear, a few glints, the boats,
 * the lantern glow, drifting cloud and three gulls move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.55;
  const QUAY_TOP = 0.72;
  const QUAY_BOT = 0.875;
  const LANTERN_X = 0.4;
  const RETINT_SECONDS = 60;
  const GLINTS = 16;
  const BOATS = [
    { x: 0.68, y: 0.77, s: 1.15, phase: 0.4 },
    { x: 0.82, y: 0.7, s: 0.8, phase: 2.1 },
    { x: 0.9, y: 0.84, s: 1.45, phase: 4.0 },
    { x: 0.64, y: 0.93, s: 1.6, phase: 5.3 },
  ];
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A colour lit by the sky, then pushed toward ink as night comes on.
  function tone(h, sky, k) {
    const lit = mixColor(rgb(h), sky.amb, (k === undefined ? 0.3 : k) * (1 - sky.night));
    return hex(mixColor(lit, rgb('#10142a'), sky.night * 0.7));
  }

  function lerpHex(a, b, t) {
    return hex(mixColor(rgb(a), rgb(b), t));
  }

  function poly(ctx, pts, ox, oy, s) {
    ctx.beginPath();
    ctx.moveTo(ox + pts[0] * s, oy + pts[1] * s);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(ox + pts[i] * s, oy + pts[i + 1] * s);
    ctx.closePath();
    ctx.fill();
  }

  function lanternLit(sky) {
    const h = sky.hour;
    return h >= 12 ? smoothstep(16.5, 18.7, h) : sky.night;
  }

  // ---- sky and far shore -------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hy = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, 0, 0, hy);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, hy + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintSun(ctx, g, sky);
    paintMoon(ctx, g, sky);
    paintFar(ctx, g, sky, rand);
    return c;
  }

  function paintSun(ctx, g, sky) {
    const h = sky.hour;
    if (h < 6 || h > 19.6) return;
    const t = S.sunT(h);
    const sx = g.W * (0.14 + 0.74 * t);
    const sy = g.H * HORIZON - Math.sin(Math.PI * t) * g.H * 0.4;
    const r = g.U * 18;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    glow.addColorStop(0, 'rgba(240,190,120,0.55)');
    glow.addColorStop(1, 'rgba(240,190,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    ctx.fillStyle = lerpHex('#f0c27a', '#f6efe0', Math.sin(Math.PI * t) * 0.8);
    ctx.beginPath();
    ctx.arc(sx, sy, g.U * 3, 0, 6.3);
    ctx.fill();
  }

  function paintMoon(ctx, g, sky) {
    if (sky.night < 0.4) return;
    const t = S.moonT(sky.hour);
    const mx = g.W * (0.18 + 0.64 * t);
    const my = g.H * (0.34 - Math.sin(Math.PI * t) * 0.2);
    ctx.globalAlpha = Math.min(1, (sky.night - 0.4) * 1.6);
    ctx.fillStyle = '#e9e3cf';
    ctx.beginPath();
    ctx.arc(mx, my, g.U * 2.6, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function pine(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x - s * 0.15, y - s * 2.2, Math.max(1, s * 0.3), s * 2.2);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(x + (k - 1) * s * 0.35, y - s * (1.6 + k * 0.7), s * (1.5 - k * 0.25), s * 0.5, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintFar(ctx, g, sky, rand) {
    const hy = g.H * HORIZON;
    // The mainland ridge across the strait, hazy and low.
    const ridge = mixColor(mixColor(rgb('#4b5a7a'), sky.haze, 0.55), sky.low, 0.15);
    ctx.fillStyle = hex(ridge);
    ctx.beginPath();
    ctx.moveTo(0, hy);
    for (let x = 0; x <= g.W; x += 2) {
      const rise = 0.07 + 0.09 * fbm(x * 0.011, 3.1, 4, 17) + 0.03 * Math.sin(x / g.W * 6);
      ctx.lineTo(x, hy - g.H * rise);
    }
    ctx.lineTo(g.W, hy);
    ctx.closePath();
    ctx.fill();
    // A second, nearer range.
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#3a4a66'), sky.haze, 0.4), sky.low, 0.08));
    ctx.beginPath();
    ctx.moveTo(g.W * 0.38, hy);
    for (let x = g.W * 0.38; x <= g.W; x += 2) {
      const f = (x / g.W - 0.38) / 0.62;
      const rise = (0.02 + 0.045 * fbm(x * 0.02, 8.4, 3, 29)) * Math.sin(Math.PI * Math.min(1, f * 1.1));
      ctx.lineTo(x, hy - g.H * rise);
    }
    ctx.lineTo(g.W, hy);
    ctx.closePath();
    ctx.fill();
    // The small pine island with its few trees.
    const moss = hex(mixColor(mixColor(rgb('#2f4634'), sky.haze, 0.25), rgb('#10142a'), sky.night * 0.5));
    ctx.fillStyle = moss;
    ctx.beginPath();
    ctx.ellipse(g.W * 0.8, hy, g.W * 0.085, g.H * 0.034, 0, Math.PI, 0);
    ctx.fill();
    for (const px of [0.745, 0.768, 0.79, 0.812, 0.84]) {
      pine(ctx, g.W * px, hy - g.H * (0.014 + rand() * 0.014), g.U * (1.1 + rand() * 0.5), moss);
    }
    // A pagoda-roofed shrine hall on its crest, a dark notch against the haze.
    ctx.fillStyle = hex(mixColor(rgb('#2b3248'), sky.haze, 0.3));
    ctx.fillRect(g.W * 0.8, hy - g.H * 0.052, g.U * 2.4, g.U * 1.6);
    poly(ctx, [-0.9, 0, 3.3, 0, 2.2, -1.2, 0.2, -1.2], g.W * 0.8, hy - g.H * 0.052, g.U);
  }

  // ---- clouds ------------------------------------------------------------

  function buildCloudNoise(g) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.H * 0.3);
    const noise = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.009, y * 0.07, 4, 41);
        const b = fbm((x - w) * 0.009, y * 0.07, 4, 41);
        noise[y * w + x] = smoothstep(0.5, 0.72, lerp(a, b, x / w)) * band;
      }
    }
    state.cloudNoise = noise;
    state.cloudW = w;
    state.cloudH = h;
    state.clouds = layer(w, h);
  }

  function tintClouds(sky) {
    const w = state.cloudW;
    const h = state.cloudH;
    const ctx = state.clouds.getContext('2d');
    const img = ctx.createImageData(w, h);
    const col = mixColor(rgb('#f4eadb'), sky.amb, 0.55 * (1 - sky.night));
    const dark = mixColor(col, rgb('#2a3050'), sky.night * 0.7);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      img.data[o] = dark[0];
      img.data[o + 1] = dark[1];
      img.data[o + 2] = dark[2];
      img.data[o + 3] = state.cloudNoise[i] * 190;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- town --------------------------------------------------------------

  function hillY(g, xf) {
    return g.H * (0.3 + 0.28 * smoothstep(0.02, 0.37, xf) + 0.014 * (fbm(xf * 14, 5, 3, 7) - 0.5));
  }

  function paintHill(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, g.H * 0.3, 0, g.H * QUAY_TOP);
    grad.addColorStop(0, tone('#3e5a40', sky, 0.25));
    grad.addColorStop(1, tone('#26382c', sky, 0.15));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H * QUAY_TOP);
    for (let x = 0; x <= g.W * 0.42; x += 2) ctx.lineTo(x, hillY(g, x / g.W));
    ctx.lineTo(g.W * 0.42, g.H * QUAY_TOP);
    ctx.closePath();
    ctx.fill();
    // Black pines along the ridge.
    const col = tone('#223226', sky, 0.15);
    for (const px of [0.02, 0.07, 0.15, 0.21, 0.27, 0.32]) {
      pine(ctx, g.W * px, hillY(g, px) + g.U * 1.2, g.U * (2.1 + rand() * 0.8), col);
    }
  }

  // One house seen from the front: plaster wall, dark lower boards, tiled roof.
  function house(ctx, g, sky, d) {
    const X = g.W * d.x;
    const Wd = g.W * d.w;
    const B = g.H * d.base;
    const Hh = g.H * d.h;
    const R = g.H * d.roof;
    const eave = g.U * 1.3;
    const wall = d.plaster || '#e4ddc9';
    ctx.fillStyle = tone(wall, sky, 0.32);
    ctx.fillRect(X, B - Hh, Wd, Hh);
    ctx.fillStyle = tone('#2e3344', sky, 0.2);
    ctx.fillRect(X, B - Hh * 0.36, Wd, Hh * 0.36);
    ctx.fillStyle = tone('#d9d3c0', sky, 0.3);
    for (let y = B - Hh * 0.36 + g.U * 1.1; y < B - 1; y += g.U * 1.5) ctx.fillRect(X, y, Wd, 1);
    const lit = d.lit * lanternLit(sky);
    const wood = tone('#4a3a2c', sky, 0.15);
    const nWin = Math.max(1, Math.round(Wd / (g.U * 5)));
    for (let i = 0; i < nWin; i++) {
      const wx = X + Wd * ((i + 0.5) / nWin) - g.U * 1.1;
      const wy = B - Hh * 0.78;
      ctx.fillStyle = hex(mixColor(rgb(wood), rgb('#e0b25a'), lit));
      ctx.fillRect(wx, wy, g.U * 2.2, g.U * 2.4);
      ctx.fillStyle = tone('#2a2a30', sky, 0.1);
      ctx.fillRect(wx + g.U * 0.5, wy, 1, g.U * 2.4);
      ctx.fillRect(wx + g.U * 1.5, wy, 1, g.U * 2.4);
    }
    const roofCol = tone('#2f3650', sky, 0.28);
    ctx.fillStyle = roofCol;
    const inset = Wd * d.tp;
    ctx.beginPath();
    ctx.moveTo(X - eave, B - Hh + g.U * 0.5);
    ctx.lineTo(X + inset, B - Hh - R);
    ctx.lineTo(X + Wd - inset, B - Hh - R);
    ctx.lineTo(X + Wd + eave, B - Hh + g.U * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tone('#454e6c', sky, 0.3);
    for (let y = B - Hh - R + g.U * 1.2; y < B - Hh; y += g.U * 1.3) {
      const k = (y - (B - Hh - R)) / R;
      ctx.fillRect(lerp(X + inset, X - eave, k), y, lerp(Wd - inset * 2, Wd + eave * 2, k), 1);
    }
    ctx.fillStyle = tone('#6a7088', sky, 0.3);
    ctx.fillRect(X + inset - 1, B - Hh - R - 1, Wd - inset * 2 + 2, Math.max(1, g.U * 0.6));
    ctx.fillStyle = tone('#1a1d2e', sky, 0.1);
    ctx.fillRect(X - eave, B - Hh + g.U * 0.4, Wd + eave * 2, Math.max(1, g.U * 0.5));
  }

  // A temple hall high on the hill with a wide curved roof.
  function hall(ctx, g, sky) {
    const X = g.W * 0.115;
    const Wd = g.W * 0.07;
    const B = g.H * 0.505;
    const Hh = g.H * 0.034;
    const R = g.H * 0.065;
    const eave = g.U * 3;
    ctx.fillStyle = tone('#d8cfb8', sky, 0.32);
    ctx.fillRect(X, B - Hh, Wd, Hh);
    ctx.fillStyle = tone('#a6442e', sky, 0.2);
    for (let i = 0; i <= 4; i++) ctx.fillRect(X + (Wd - g.U * 0.8) * (i / 4), B - Hh, Math.max(1, g.U * 0.8), Hh);
    ctx.fillStyle = tone('#2a3048', sky, 0.28);
    ctx.beginPath();
    ctx.moveTo(X - eave - g.U * 1.2, B - Hh - g.U * 0.8);
    ctx.quadraticCurveTo(X - eave * 0.2, B - Hh - R * 0.15, X + Wd * 0.22, B - Hh - R);
    ctx.lineTo(X + Wd * 0.78, B - Hh - R);
    ctx.quadraticCurveTo(X + Wd + eave * 0.2, B - Hh - R * 0.15, X + Wd + eave + g.U * 1.2, B - Hh - g.U * 0.8);
    ctx.lineTo(X + Wd + eave, B - Hh + g.U * 0.6);
    ctx.lineTo(X - eave, B - Hh + g.U * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tone('#6a7088', sky, 0.3);
    ctx.fillRect(X + Wd * 0.22, B - Hh - R - 1, Wd * 0.56, Math.max(1, g.U * 0.7));
    ctx.fillStyle = tone('#d8cfb8', sky, 0.3);
    ctx.fillRect(X + Wd * 0.2, B - Hh - R - g.U * 1.2, g.U * 1.2, g.U * 1.2);
    ctx.fillRect(X + Wd * 0.8 - g.U * 1.2, B - Hh - R - g.U * 1.2, g.U * 1.2, g.U * 1.2);
  }

  const MID_ROW = [
    { x: 0.025, w: 0.055, base: 0.605, h: 0.075, roof: 0.04, tp: 0.4, lit: 1 },
    { x: 0.105, w: 0.06, base: 0.62, h: 0.08, roof: 0.042, tp: 0.45, lit: 0.8 },
    { x: 0.19, w: 0.05, base: 0.63, h: 0.07, roof: 0.038, tp: 0.35, lit: 1 },
    { x: 0.26, w: 0.055, base: 0.65, h: 0.075, roof: 0.04, tp: 0.45, lit: 0.7 },
    { x: 0.04, w: 0.05, base: 0.535, h: 0.055, roof: 0.034, tp: 0.4, lit: 0.9 },
    { x: 0.235, w: 0.045, base: 0.575, h: 0.055, roof: 0.032, tp: 0.4, lit: 1 },
  ];

  const FRONT_ROW = [
    { x: 0.0, w: 0.085, base: QUAY_TOP, h: 0.15, roof: 0.058, tp: 0.5, lit: 1 },
    { x: 0.093, w: 0.068, base: QUAY_TOP, h: 0.115, roof: 0.05, tp: 0.45, lit: 0.8 },
    { x: 0.169, w: 0.075, base: QUAY_TOP, h: 0.17, roof: 0.052, tp: 0.4, lit: 0.5 },
    { x: 0.252, w: 0.06, base: QUAY_TOP, h: 0.1, roof: 0.044, tp: 0.5, lit: 1 },
  ];

  // ---- quay and lantern --------------------------------------------------

  function paintQuay(ctx, g, sky, rand) {
    const top = g.H * QUAY_TOP;
    const bot = g.H * QUAY_BOT;
    const right = g.W * 0.5;
    const stone = tone('#8a8c92', sky, 0.3);
    ctx.fillStyle = stone;
    ctx.fillRect(0, top, right, bot - top);
    // Courses of cut stone.
    ctx.fillStyle = tone('#5c606c', sky, 0.2);
    const course = g.U * 2.4;
    let row = 0;
    for (let y = top + g.U * 1.6; y < bot; y += course, row++) {
      ctx.fillRect(0, y, right, 1);
      for (let x = (row % 2) * g.U * 2.5; x < right; x += g.U * (5 + rand() * 3)) ctx.fillRect(x, y, 1, course);
    }
    ctx.fillStyle = tone('#b9b5a6', sky, 0.3);
    ctx.fillRect(0, top, right, g.U * 1.6);
    ctx.fillStyle = tone('#74767e', sky, 0.2);
    ctx.fillRect(0, top + g.U * 1.6, right, 1);
    // Landing steps going down into the water.
    const steps = 5;
    const sw = g.W * 0.016;
    const sh = (bot - top) / (steps + 1);
    for (let i = 0; i < steps; i++) {
      const sx = right + i * sw;
      const sy = top + (i + 1) * sh;
      ctx.fillStyle = tone('#8e9096', sky, 0.3);
      ctx.fillRect(sx, sy, sw + 1, bot - sy);
      ctx.fillStyle = tone('#bdb9aa', sky, 0.3);
      ctx.fillRect(sx, sy, sw + 1, Math.max(1, g.U * 0.9));
      ctx.fillStyle = tone('#5c606c', sky, 0.2);
      ctx.fillRect(sx, sy + g.U * 0.9, sw + 1, 1);
    }
    // Mooring posts and a few red floats left on the stone.
    ctx.fillStyle = tone('#3a3430', sky, 0.15);
    for (const px of [0.33, 0.455]) {
      ctx.fillRect(g.W * px, top - g.U * 1.6, g.U * 1.3, g.U * 1.6);
      ctx.fillStyle = tone('#5a5148', sky, 0.15);
      ctx.fillRect(g.W * px - 1, top - g.U * 1.9, g.U * 1.3 + 2, Math.max(1, g.U * 0.5));
      ctx.fillStyle = tone('#3a3430', sky, 0.15);
    }
    ctx.fillStyle = tone('#b0432d', sky, 0.2);
    for (const px of [0.345, 0.358, 0.4725]) {
      ctx.beginPath();
      ctx.arc(g.W * px, top - g.U * 0.8, g.U * 0.9, 0, 6.3);
      ctx.fill();
    }
  }

  // The tall stone lantern: stepped foot, slim pillar, fire chamber, wide roof.
  function paintLantern(ctx, g, sky) {
    const cx = g.W * LANTERN_X;
    const s = g.U * 1.15;
    let y = g.H * QUAY_TOP;
    const stone = tone('#c4bfae', sky, 0.35);
    const shade = tone('#8f8c82', sky, 0.25);
    const widths = [9, 7.4, 6];
    ctx.fillStyle = stone;
    for (const w of widths) {
      ctx.fillRect(cx - w * s / 2, y - s, w * s, s);
      y -= s;
    }
    ctx.fillRect(cx - 2.2 * s, y - 2 * s, 4.4 * s, 2 * s);
    y -= 2 * s;
    poly(ctx, [-1.4, 0, 1.4, 0, 1.15, -15, -1.15, -15], cx, y, s);
    ctx.fillStyle = shade;
    poly(ctx, [0.1, 0, 1.4, 0, 1.15, -15, 0.1, -15], cx, y, s);
    ctx.fillStyle = stone;
    ctx.fillRect(cx - 1.7 * s, y - 6.5 * s, 3.4 * s, 0.7 * s);
    y -= 15 * s;
    ctx.fillRect(cx - 2.6 * s, y - 1.1 * s, 5.2 * s, 1.1 * s);
    y -= 1.1 * s;
    ctx.fillRect(cx - 1.9 * s, y - 4.2 * s, 3.8 * s, 4.2 * s);
    ctx.fillStyle = shade;
    ctx.fillRect(cx + 0.2 * s, y - 4.2 * s, 1.7 * s, 4.2 * s);
    const win = { x: cx - 0.95 * s, y: y - 3.4 * s, w: 1.9 * s, h: 2.6 * s };
    ctx.fillStyle = tone('#262a38', sky, 0.1);
    ctx.fillRect(win.x, win.y, win.w, win.h);
    y -= 4.2 * s;
    ctx.fillStyle = tone('#454c64', sky, 0.28);
    poly(ctx, [-5.3, -1.0, -4.0, 0.4, 4.0, 0.4, 5.3, -1.0, 2.2, -2.0, 1.1, -3.3, -1.1, -3.3, -2.2, -2.0], cx, y, s);
    ctx.fillStyle = tone('#6c7288', sky, 0.3);
    ctx.fillRect(cx - 1.1 * s, y - 3.3 * s, 2.2 * s, Math.max(1, 0.5 * s));
    y -= 3.3 * s;
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.arc(cx, y - 0.6 * s, 0.9 * s, 0, 6.3);
    ctx.fill();
    poly(ctx, [-0.3, -1.2, 0, -2.4, 0.3, -1.2], cx, y, s);
    state.win = win;
    state.lanternTop = y - 2.4 * s;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHill(ctx, g, sky, rand);
    hall(ctx, g, sky);
    for (const d of MID_ROW) house(ctx, g, sky, d);
    for (const d of FRONT_ROW) house(ctx, g, sky, d);
    paintQuay(ctx, g, sky, rand);
    paintLantern(ctx, g, sky);
    return c;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, back, rand) {
    const hy = Math.round(g.H * HORIZON);
    const wh = g.H - hy + 1;
    const pad = state.pad;
    const c = layer(g.W + pad * 2, wh);
    const ctx = c.getContext('2d');
    const deep = mixColor(mixColor(rgb('#2a4260'), sky.amb, 0.1 * (1 - sky.night)), rgb('#080b18'), sky.night * 0.85);
    const grad = ctx.createLinearGradient(0, 0, 0, wh);
    grad.addColorStop(0, hex(mixColor(sky.low, deep, 0.2)));
    grad.addColorStop(1, hex(deep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, wh);
    // The sky and far shore, turned over.
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.scale(1, -1);
    ctx.drawImage(back, 0, hy - wh, g.W, wh, 0, -wh, c.width, wh);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, 0, 0, wh);
    fade.addColorStop(0, hex(deep) + '00');
    fade.addColorStop(1, hex(deep) + 'e0');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, c.width, wh);
    // Fine horizontal streaks.
    const streak = hex(mixColor(sky.amb, rgb('#ffffff'), 0.3));
    ctx.fillStyle = streak;
    for (let i = 0; i < g.W * 0.5; i++) {
      const y = rand() * wh;
      ctx.globalAlpha = (0.05 + rand() * 0.14) * (1 - sky.night * 0.6);
      ctx.fillRect(rand() * c.width, y, g.U * (1 + rand() * 4), 1);
    }
    ctx.globalAlpha = 1;
    // Shadow under the quay wall.
    const sy = g.H * QUAY_BOT - hy;
    const sh = ctx.createLinearGradient(0, sy, 0, sy + g.U * 7);
    sh.addColorStop(0, 'rgba(12,16,30,0.6)');
    sh.addColorStop(1, 'rgba(12,16,30,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(pad, sy, g.W * 0.55, g.U * 7);
    return c;
  }

  // ---- boats -------------------------------------------------------------

  function paintBoat(g, sky, spec) {
    const s = g.U * spec.s;
    const len = Math.ceil(s * 24);
    const hb = Math.ceil(s * 15);
    const c = layer(len, hb);
    const ctx = c.getContext('2d');
    const hullY = hb;
    ctx.fillStyle = tone('#8a6a48', sky, 0.3);
    ctx.beginPath();
    ctx.moveTo(s * 0.6, hullY - s * 3.4);
    ctx.quadraticCurveTo(len * 0.5, hullY - s * 2.4, len - s * 0.3, hullY - s * 4);
    ctx.lineTo(len - s * 3.4, hullY - s * 0.2);
    ctx.lineTo(s * 4.4, hullY - s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = tone('#c4482c', sky, 0.3);
    ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.beginPath();
    ctx.moveTo(s * 0.6, hullY - s * 3.4);
    ctx.quadraticCurveTo(len * 0.5, hullY - s * 2.4, len - s * 0.3, hullY - s * 4);
    ctx.stroke();
    ctx.fillStyle = tone('#c9a272', sky, 0.3);
    ctx.fillRect(s * 4, hullY - s * 1.5, len - s * 8, 1);
    // Small cabin and a mast with a furled sail on its yard.
    ctx.fillStyle = tone('#d9d0b8', sky, 0.3);
    ctx.fillRect(s * 5, hullY - s * 6.4, s * 5, s * 3.3);
    ctx.fillStyle = tone('#2a3048', sky, 0.28);
    ctx.fillRect(s * 4.4, hullY - s * 7.1, s * 6.2, s * 0.9);
    ctx.fillStyle = tone('#4a3a2c', sky, 0.2);
    ctx.fillRect(s * 14, hullY - s * 12.6, Math.max(1, s * 0.55), s * 9.4);
    ctx.fillRect(s * 11, hullY - s * 12.2, s * 6.4, Math.max(1, s * 0.5));
    ctx.fillStyle = tone('#e6dfcc', sky, 0.3);
    ctx.fillRect(s * 11.4, hullY - s * 11.9, s * 5.6, Math.max(1, s * 1.1));
    ctx.fillStyle = hex(mixColor(rgb('#4a3a2c'), rgb('#e0b25a'), lanternLit(sky)));
    ctx.fillRect(s * 14, hullY - s * 9.8, Math.max(1, s * 1.2), Math.max(1, s * 1.2));
    const refl = layer(len, hb);
    const rctx = refl.getContext('2d');
    rctx.translate(0, hb);
    rctx.scale(1, -1);
    rctx.drawImage(c, 0, 0);
    return { art: c, refl };
  }

  // ---- bake --------------------------------------------------------------

  function paintGlow(g) {
    const r = Math.ceil(g.U * 11);
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(238,196,112,0.62)');
    grad.addColorStop(0.35, 'rgba(238,196,112,0.22)');
    grad.addColorStop(1, 'rgba(238,196,112,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(57);
    state.back = paintBack(g, sky, rand);
    state.water = paintWater(g, sky, state.back, rand);
    state.front = paintFront(g, sky, rand);
    state.boats = BOATS.map((b) => paintBoat(g, sky, b));
    tintClouds(sky);
    state.cloudAlpha = 0.8 - sky.night * 0.45;
    state.night = sky.night;
    state.lit = lanternLit(sky);
    state.birdColor = hex(mixColor(rgb('#f1ebdc'), sky.amb, 0.3));
    state.glintColor = hex(mixColor(sky.amb, rgb('#fff4dc'), 0.5));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.1) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  function drawGulls(ctx, g, t) {
    const a = 1 - state.night;
    if (a < 0.05) return;
    ctx.strokeStyle = state.birdColor;
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    ctx.globalAlpha = a * 0.9;
    for (let i = 0; i < 3; i++) {
      const p = (t * (0.011 + i * 0.002) + i * 0.37) % 1.2;
      const bx = g.W * (p - 0.1);
      const by = g.H * (0.16 + i * 0.05) + Math.sin(t * 0.5 + i * 2) * g.U * 1.5;
      const span = g.U * (2.2 + i * 0.4);
      const flap = Math.sin(t * 2.4 + i * 1.7) * g.U * 0.9;
      ctx.beginPath();
      ctx.moveTo(bx - span, by + flap * 0.4);
      ctx.quadraticCurveTo(bx - span * 0.4, by - g.U * 0.8 - flap, bx, by);
      ctx.quadraticCurveTo(bx + span * 0.4, by - g.U * 0.8 - flap, bx + span, by + flap * 0.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Each pair of rows is shifted a little sideways, more so near the viewer.
  function drawWater(ctx, g, t, amount) {
    const hy = Math.round(g.H * HORIZON);
    const src = state.water;
    const pad = state.pad;
    const amp = g.U * 0.55 * amount;
    const step = 2;
    for (let r = 0; r < src.height - 1; r += step) {
      const depth = r / src.height;
      const dx = (Math.sin(t * 1.1 + r * 0.45) + 0.5 * Math.sin(t * 1.9 + r * 1.3)) * amp * (0.25 + depth * 1.1);
      ctx.drawImage(src, pad, r, g.W, step, dx, hy + r, g.W, step);
    }
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    ctx.fillStyle = state.glintColor;
    const top = g.H * (HORIZON + 0.02);
    const span = g.H * (1 - HORIZON - 0.04);
    for (let i = 0; i < GLINTS; i++) {
      const ph = state.glints[i * 3 + 2];
      const a = Math.sin(t * 0.7 + ph);
      if (a <= 0) continue;
      ctx.globalAlpha = a * a * 0.42 * amount * (1 - state.night * 0.5);
      const x = g.W * (0.45 + 0.55 * state.glints[i * 3]) + Math.sin(t * 0.4 + ph) * g.U;
      const y = top + span * state.glints[i * 3 + 1];
      ctx.fillRect(x, y, g.U * (1.6 + (i % 3)), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawLanternReflection(ctx, g, t) {
    const a = state.lit * state.glow;
    if (a <= 0.02) return;
    const cx = g.W * LANTERN_X;
    const y0 = g.H * QUAY_BOT + g.U * 0.5;
    ctx.fillStyle = '#e8c070';
    for (let i = 0; i < 7; i++) {
      const w = g.U * (3.2 - i * 0.25);
      const dx = Math.sin(t * 1.3 + i * 0.9) * g.U * 0.8;
      ctx.globalAlpha = a * (0.4 - i * 0.04);
      ctx.fillRect(cx - w / 2 + dx, y0 + i * g.U * 1.5, w, Math.max(1, g.U * 0.8));
    }
    ctx.globalAlpha = 1;
  }

  function drawBoats(ctx, g, t) {
    for (let i = 0; i < BOATS.length; i++) {
      const b = BOATS[i];
      const sp = state.boats[i];
      const w = sp.art.width;
      const h = sp.art.height;
      const bob = Math.sin(t * 0.8 + b.phase) * g.U * 0.35;
      const tilt = Math.sin(t * 0.6 + b.phase * 1.3) * 0.025;
      const wx = g.W * b.x;
      const wy = g.H * b.y + bob;
      ctx.globalAlpha = 0.3;
      ctx.drawImage(sp.refl, wx - w / 2 + Math.sin(t * 1.2 + b.phase) * g.U * 0.4, wy + g.U * 0.2, w, h);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(tilt);
      ctx.drawImage(sp.art, -w / 2, -h);
      ctx.restore();
    }
  }

  // Warm light around the lantern window, breathing very slowly.
  function drawLanternGlow(ctx, g, t) {
    const a = state.lit * state.glow;
    if (a <= 0.02) return;
    const w = state.win;
    const r = state.glowArt.width / 2;
    const breath = 0.88 + 0.12 * Math.sin(t * 0.9);
    ctx.globalAlpha = Math.min(1, a * breath);
    ctx.drawImage(state.glowArt, w.x + w.w / 2 - r, w.y + w.h / 2 - r);
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = '#ecc474';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.pad = Math.ceil(g.U * 2.5);
    state.glow = api.props.glow;
    const rand = K.rng(9);
    state.glints = new Float32Array(GLINTS * 3);
    for (let i = 0; i < state.glints.length; i++) state.glints[i] = rand() * (i % 3 === 2 ? 6.3 : 1);
    state.glowArt = paintGlow(g);
    buildCloudNoise(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.glow = props.glow;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t);
    drawGulls(ctx, g, t);
    drawWater(ctx, g, t, props.ripple);
    drawGlints(ctx, g, t, props.ripple);
    drawLanternReflection(ctx, g, t);
    if (props.boats) drawBoats(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawLanternGlow(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', glow: 1, ripple: 1, boats: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
