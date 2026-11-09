/*
 * 川越 Kawagoe — the wooden bell tower over old kura warehouse roofs at dusk.
 *
 * Sky, hills, kura and tower are baked into two layers and repainted once a
 * minute from the clock, so the windows and lanterns warm up as evening comes.
 * Between repaints only clouds, swallows and three hanging lanterns move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const GROUND = 0.88;
  const TOWER_X = 0.615;
  const RETINT_SECONDS = 60;
  const MAX_SWALLOWS = 14;
  const INK = '#1d1f2b';
  const TIMBER = '#3b2c27';
  const TILE = '#262938';
  const WASHI = '#e6e0cf';
  const INDIGO = '#2b3a63';
  const GOLD = '#dcab4c';
  const VERMILION = '#c8453a';
  const state = {};

  // Back row first, then the tower, then the near row.
  const BACK_KURA = [
    { x: 0.02, w: 0.13, top: 0.7, roof: 0.07, base: 0.8 },
    { x: 0.27, w: 0.12, top: 0.71, roof: 0.065, base: 0.8 },
    { x: 0.4, w: 0.1, top: 0.69, roof: 0.07, base: 0.8 },
    { x: 0.7, w: 0.12, top: 0.7, roof: 0.07, base: 0.8 },
    { x: 0.86, w: 0.13, top: 0.69, roof: 0.075, base: 0.8 },
  ];
  const NEAR_KURA = [
    { x: -0.03, w: 0.21, top: 0.64, roof: 0.115, tiers: true, door: true },
    { x: 0.19, w: 0.15, top: 0.71, roof: 0.085, tiers: false, door: false },
    { x: 0.5, w: 0.2, top: 0.7, roof: 0.1, tiers: true, door: true },
    { x: 0.69, w: 0.17, top: 0.66, roof: 0.11, tiers: true, door: false },
    { x: 0.85, w: 0.17, top: 0.72, roof: 0.085, tiers: false, door: true },
  ];
  const LANTERNS = [
    { x: 0.185, y: 0.605, phase: 0 },
    { x: 0.52, y: 0.655, phase: 2.1 },
    { x: 0.69, y: 0.615, phase: 4.2 },
  ];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  // How far the lamps are lit: off by day, rising through dusk, full at night.
  function lampAt(h) {
    if (h < 5.5) return 1;
    if (h < 7) return 1 - smoothstep(5.5, 7, h);
    if (h < 16.5) return 0;
    if (h < 19) return smoothstep(16.5, 19, h);
    return 1;
  }

  // A colour as lit by the current sky, then darkened toward night.
  function tint(sky, c, haze) {
    const lit = mixColor(rgb(c), sky.amb, 0.2);
    const far = haze ? mixColor(lit, sky.haze, haze) : lit;
    return hex(mixColor(far, rgb('#0f121e'), sky.night * 0.74));
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.78);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.12 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintBody(ctx, g, sky);
    return c;
  }

  function paintBody(ctx, g, sky) {
    const h = sky.hour;
    const daytime = h >= 6 && h <= 19.5;
    const t = daytime ? S.sunT(h) : S.moonT(h);
    const bx = g.W * (0.1 + 0.8 * t);
    const by = g.H * (0.5 - 0.38 * Math.sin(Math.PI * t));
    const r = g.U * (daytime ? 3.4 : 2.6);
    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, r * 5);
    const tone = daytime ? 'rgba(240,190,120,' : 'rgba(220,226,240,';
    glow.addColorStop(0, tone + (daytime ? '0.5)' : '0.25)'));
    glow.addColorStop(1, tone + '0)');
    ctx.fillStyle = glow;
    ctx.fillRect(bx - r * 5, by - r * 5, r * 10, r * 10);
    ctx.fillStyle = daytime ? '#eed9a8' : '#e8e6dc';
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, 6.3);
    ctx.fill();
  }

  function paintCloudStrip(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.08, 4, 41);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 232;
        img.data[i + 1] = 222;
        img.data[i + 2] = 208;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- hills and mist ----------------------------------------------------

  function paintHills(ctx, g, sky) {
    const far = tint(sky, '#51628a', 0.55);
    const near = tint(sky, '#3b4a6c', 0.4);
    const rows = [
      { color: far, base: 0.6, amp: 0.07, seed: 3, scale: 0.012 },
      { color: near, base: 0.67, amp: 0.05, seed: 8, scale: 0.02 },
    ];
    for (const row of rows) {
      ctx.fillStyle = row.color;
      for (let px = 0; px < g.W; px++) {
        const top = g.H * (row.base - (fbm(px * row.scale, 1, 3, row.seed) - 0.3) * row.amp * 2);
        ctx.fillRect(px, top, 1, g.H * 0.85 - top);
      }
    }
    const mist = ctx.createLinearGradient(0, g.H * 0.62, 0, g.H * 0.8);
    const m = mixColor(sky.haze, sky.low, 0.5);
    mist.addColorStop(0, `rgba(${m[0] | 0},${m[1] | 0},${m[2] | 0},0)`);
    mist.addColorStop(1, `rgba(${m[0] | 0},${m[1] | 0},${m[2] | 0},0.55)`);
    ctx.fillStyle = mist;
    ctx.fillRect(0, g.H * 0.62, g.W, g.H * 0.18);
  }

  // ---- kura --------------------------------------------------------------

  function litColor(sky, lamp, haze) {
    return hex(mixColor(mixColor(rgb(INK), sky.low, 0.2), rgb(GOLD), lamp * (1 - (haze || 0) * 0.5)));
  }

  function paintRoof(ctx, g, sky, o, x, w, wallTop, ground, haze) {
    const u = g.U;
    const e = u * 2.4;
    const rh = o.roof * g.H;
    const left = x - e;
    const right = x + w + e;
    const ridgeL = x + w * 0.1;
    const ridgeR = x + w * 0.9;
    const top = wallTop - rh;
    ctx.fillStyle = tint(sky, TILE, haze);
    ctx.beginPath();
    ctx.moveTo(left, wallTop + u * 0.4);
    ctx.quadraticCurveTo(x - e * 0.2, wallTop - rh * 0.25, ridgeL, top);
    ctx.lineTo(ridgeR, top);
    ctx.quadraticCurveTo(x + w + e * 0.2, wallTop - rh * 0.25, right, wallTop + u * 0.4);
    ctx.closePath();
    ctx.fill();
    // Tile courses and the pale line of the eave.
    ctx.fillStyle = tint(sky, '#4a4f66', haze);
    ctx.globalAlpha = 0.55;
    for (let yy = top + u * 1.2; yy < wallTop - u * 0.2; yy += u * 1.1) {
      const f = (yy - top) / rh;
      ctx.fillRect(lerp(ridgeL, left, f * 0.9), yy, lerp(ridgeR - ridgeL, right - left, f * 0.9), 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = tint(sky, '#7b7f90', haze);
    ctx.fillRect(left, wallTop + u * 0.1, right - left, Math.max(1, u * 0.3));
    // Ridge cap and the raised ornaments at each end.
    ctx.fillStyle = tint(sky, '#15161f', haze);
    ctx.fillRect(ridgeL, top - u * 0.5, ridgeR - ridgeL, u * 0.7);
    ctx.fillRect(ridgeL - u * 0.5, top - u * 1.6, u * 1.3, u * 1.8);
    ctx.fillRect(ridgeR - u * 0.8, top - u * 1.6, u * 1.3, u * 1.8);
  }

  function paintWall(ctx, g, sky, x, w, wallTop, ground, haze) {
    const u = g.U;
    ctx.fillStyle = tint(sky, WASHI, haze);
    ctx.fillRect(x, wallTop, w, ground - wallTop);
    // Black and white lattice plaster on the lower wall.
    const nh = (ground - wallTop) * 0.36;
    ctx.fillStyle = tint(sky, INDIGO, haze);
    ctx.fillRect(x, ground - nh, w, nh);
    ctx.fillStyle = tint(sky, WASHI, haze);
    const step = Math.max(2, u * 1.5);
    for (let k = -nh; k < w; k += step) {
      for (let j = 0; j < nh; j += 1) {
        ctx.fillRect(x + k + j, ground - nh + j, 1, 1);
        ctx.fillRect(x + k + nh - j, ground - nh + j, 1, 1);
      }
    }
    ctx.fillStyle = tint(sky, '#9a9484', haze);
    ctx.fillRect(x, ground - nh, w, Math.max(1, u * 0.35));
  }

  function paintDoorAndWindow(ctx, g, sky, lamp, o, x, w, wallTop, ground) {
    const u = g.U;
    const wallH = ground - wallTop;
    const lit = litColor(sky, lamp, 0);
    const frame = tint(sky, TIMBER, 0);
    const cx = x + w * 0.5;
    // Barred window high in the wall.
    const ww = Math.max(3, u * 2.6);
    const wh = Math.max(3, u * 3.4);
    ctx.fillStyle = frame;
    ctx.fillRect(cx - ww / 2 - 1, wallTop + wallH * 0.14, ww + 2, wh + 2);
    ctx.fillStyle = lit;
    ctx.fillRect(cx - ww / 2, wallTop + wallH * 0.14 + 1, ww, wh);
    ctx.fillStyle = frame;
    ctx.fillRect(cx - 0.5, wallTop + wallH * 0.14 + 1, 1, wh);
    if (!o.door) return;
    // Heavy double door with a lit gap.
    const dw = Math.max(5, w * 0.2);
    const dh = wallH * 0.4;
    ctx.fillStyle = frame;
    ctx.fillRect(cx - dw / 2, ground - dh, dw, dh);
    ctx.fillStyle = lit;
    ctx.fillRect(cx - 0.5, ground - dh + 2, 1, dh - 2);
    ctx.fillStyle = tint(sky, '#7b7f90', 0);
    ctx.fillRect(cx - dw / 2, ground - dh - Math.max(1, u * 0.4), dw, Math.max(1, u * 0.4));
  }

  function paintMidEave(ctx, g, sky, x, w, wallTop, ground) {
    const u = g.U;
    const ym = wallTop + (ground - wallTop) * 0.36;
    const e = u * 1.4;
    ctx.fillStyle = tint(sky, TILE, 0);
    ctx.fillRect(x - e, ym, w + e * 2, u * 1.2);
    ctx.fillStyle = tint(sky, '#7b7f90', 0);
    ctx.fillRect(x - e, ym + u * 1.2, w + e * 2, 1);
    ctx.fillStyle = tint(sky, '#a9a392', 0);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, ym + u * 1.2 + 1, w, Math.max(1, u * 0.6));
    ctx.globalAlpha = 1;
  }

  function paintKura(ctx, g, sky, lamp, o, haze) {
    const x = o.x * g.W;
    const w = o.w * g.W;
    const wallTop = o.top * g.H;
    const ground = (o.base || GROUND) * g.H;
    paintWall(ctx, g, sky, x, w, wallTop, ground, haze);
    if (!haze) paintDoorAndWindow(ctx, g, sky, lamp, o, x, w, wallTop, ground);
    else paintBackWindow(ctx, g, sky, lamp, x, w, wallTop);
    if (o.tiers) paintMidEave(ctx, g, sky, x, w, wallTop, ground);
    paintRoof(ctx, g, sky, o, x, w, wallTop, ground, haze);
  }

  function paintBackWindow(ctx, g, sky, lamp, x, w, wallTop) {
    ctx.fillStyle = litColor(sky, lamp, 0.6);
    ctx.fillRect(x + w * 0.5 - g.U, wallTop + g.U * 2, Math.max(2, g.U * 2), Math.max(2, g.U * 2.4));
  }

  // ---- bell tower --------------------------------------------------------

  function curvedRoof(ctx, cx, yEave, halfEave, yTop, halfTop, lift) {
    ctx.beginPath();
    ctx.moveTo(cx - halfEave, yEave - lift);
    ctx.quadraticCurveTo(cx - halfEave * 0.6, yEave + lift * 0.5, cx, yEave + lift * 0.5);
    ctx.quadraticCurveTo(cx + halfEave * 0.6, yEave + lift * 0.5, cx + halfEave, yEave - lift);
    ctx.quadraticCurveTo(cx + halfTop + (halfEave - halfTop) * 0.15, yTop + (yEave - yTop) * 0.5, cx + halfTop, yTop);
    ctx.lineTo(cx - halfTop, yTop);
    ctx.quadraticCurveTo(cx - halfTop - (halfEave - halfTop) * 0.15, yTop + (yEave - yTop) * 0.5, cx - halfEave, yEave - lift);
    ctx.closePath();
    ctx.fill();
  }

  function paintTower(ctx, g, sky, lamp) {
    const u = g.U;
    const cx = g.W * TOWER_X;
    const lit = litColor(sky, lamp, 0);
    const timber = tint(sky, TIMBER, 0);
    const tile = tint(sky, TILE, 0);
    const edge = tint(sky, '#7b7f90', 0);
    const base = g.H * 0.72;
    const shaftHalf = u * 5.2;
    const eave1 = g.H * 0.53;
    // Shaft: plaster between timber posts, one lit window.
    ctx.fillStyle = tint(sky, WASHI, 0);
    ctx.fillRect(cx - shaftHalf, eave1, shaftHalf * 2, base - eave1);
    ctx.fillStyle = timber;
    ctx.fillRect(cx - shaftHalf, eave1, u * 0.9, base - eave1);
    ctx.fillRect(cx + shaftHalf - u * 0.9, eave1, u * 0.9, base - eave1);
    ctx.fillRect(cx - shaftHalf, eave1 + (base - eave1) * 0.5, shaftHalf * 2, Math.max(1, u * 0.7));
    ctx.fillStyle = timber;
    ctx.fillRect(cx - u * 1.5 - 1, eave1 + (base - eave1) * 0.16 - 1, u * 3 + 2, u * 4 + 2);
    ctx.fillStyle = lit;
    ctx.fillRect(cx - u * 1.5, eave1 + (base - eave1) * 0.16, u * 3, u * 4);
    ctx.fillStyle = timber;
    ctx.fillRect(cx - 0.5, eave1 + (base - eave1) * 0.16, 1, u * 4);
    // Lower roof.
    ctx.fillStyle = tile;
    curvedRoof(ctx, cx, eave1, u * 9, eave1 - u * 3.4, u * 5.2, u * 1.4);
    ctx.fillStyle = edge;
    ctx.fillRect(cx - u * 8, eave1 + u * 0.4, u * 16, Math.max(1, u * 0.3));
    paintBellRoom(ctx, g, sky, lamp, cx, eave1 - u * 3.4);
  }

  function paintBellRoom(ctx, g, sky, lamp, cx, floor) {
    const u = g.U;
    const lit = litColor(sky, lamp, 0);
    const timber = tint(sky, TIMBER, 0);
    const half = u * 4.8;
    const roomH = u * 11;
    const top = floor - roomH;
    ctx.fillStyle = tint(sky, '#1a1b24', 0);
    ctx.fillRect(cx - half, top, half * 2, roomH);
    ctx.fillStyle = timber;
    ctx.fillRect(cx - half, top, u * 0.9, roomH);
    ctx.fillRect(cx + half - u * 0.9, top, u * 0.9, roomH);
    ctx.fillRect(cx - u * 0.4, top, u * 0.8, roomH);
    // The bell, with warm light caught on it.
    ctx.fillStyle = lit;
    ctx.globalAlpha = 0.45 + lamp * 0.5;
    ctx.fillRect(cx - u * 2.1, top + roomH * 0.4, u * 1.4, roomH * 0.42);
    ctx.fillRect(cx + u * 0.8, top + roomH * 0.4, u * 1.4, roomH * 0.42);
    ctx.globalAlpha = 1;
    ctx.fillStyle = tint(sky, VERMILION, 0);
    ctx.fillRect(cx - half - u * 0.8, floor - u * 2.6, half * 2 + u * 1.6, Math.max(1, u * 0.8));
    // Upper roof and the finial.
    ctx.fillStyle = tint(sky, TILE, 0);
    curvedRoof(ctx, cx, top, u * 10.5, top - u * 9.5, u * 2.2, u * 1.8);
    ctx.fillStyle = tint(sky, '#7b7f90', 0);
    ctx.fillRect(cx - u * 9.6, top + u * 0.6, u * 19.2, Math.max(1, u * 0.3));
    ctx.fillStyle = tint(sky, '#15161f', 0);
    ctx.fillRect(cx - u * 2.6, top - u * 10.3, u * 5.2, u * 1);
    ctx.fillRect(cx - u * 0.4, top - u * 14, u * 0.8, u * 3.8);
    ctx.fillStyle = tint(sky, GOLD, 0);
    ctx.fillRect(cx - u * 0.5, top - u * 14.8, u * 1, u * 1);
  }

  // ---- street and lanterns -----------------------------------------------

  function paintStreet(ctx, g, sky, lamp) {
    const top = g.H * GROUND;
    ctx.fillStyle = tint(sky, '#33303a', 0);
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = tint(sky, '#6b6672', 0);
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.5));
    ctx.fillStyle = tint(sky, '#26242d', 0);
    for (let yy = top + g.U * 2.5; yy < g.H; yy += g.U * 2.8) ctx.fillRect(0, yy, g.W, 1);
    if (lamp > 0.02) {
      for (const l of LANTERNS) {
        const spill = ctx.createRadialGradient(l.x * g.W, top, 0, l.x * g.W, top, g.W * 0.12);
        spill.addColorStop(0, `rgba(220,160,80,${0.35 * lamp})`);
        spill.addColorStop(1, 'rgba(220,160,80,0)');
        ctx.fillStyle = spill;
        ctx.fillRect(l.x * g.W - g.W * 0.12, top, g.W * 0.24, g.H - top);
      }
    }
  }

  function paintLantern(g, sky, lamp) {
    const u = g.U;
    const w = Math.max(8, Math.round(u * 7));
    const h = Math.max(10, Math.round(u * 9));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    if (lamp > 0.02) {
      const glow = ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, w * 0.5);
      glow.addColorStop(0, `rgba(230,160,90,${0.45 * lamp})`);
      glow.addColorStop(1, 'rgba(230,160,90,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
    const bw = w * 0.5;
    const top = h * 0.2;
    const bh = h * 0.6;
    ctx.fillStyle = hex(mixColor(mixColor(rgb(VERMILION), rgb('#6a2a28'), 0.5 * (1 - lamp)), rgb('#f0b070'), 0.25 * lamp));
    ctx.beginPath();
    ctx.ellipse(w / 2, top + bh / 2, bw / 2, bh / 2, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = tint(sky, INK, 0);
    ctx.fillRect(w / 2 - bw / 2, top - 1, bw, Math.max(1, u * 0.6));
    ctx.fillRect(w / 2 - bw / 2, top + bh - 1, bw, Math.max(1, u * 0.6));
    ctx.fillRect(w / 2, 0, 1, top);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, lamp) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHills(ctx, g, sky);
    for (const o of BACK_KURA) paintKura(ctx, g, sky, lamp, o, 0.45);
    paintTower(ctx, g, sky, lamp);
    for (const o of NEAR_KURA) paintKura(ctx, g, sky, lamp, o, 0);
    paintStreet(ctx, g, sky, lamp);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const lamp = lampAt(sky.hour);
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, lamp);
    state.lantern = paintLantern(g, sky, lamp);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.ink = hex(mixColor(mixColor(rgb(INK), sky.amb, 0.15), rgb('#c9c2b4'), sky.night * 0.85));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 2.2) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // Swallows loop round the bell on lazy ellipses, each at its own pace.
  function drawSwallows(ctx, g, t, amount) {
    const count = Math.min(MAX_SWALLOWS, Math.round(7 * amount));
    if (count <= 0) return;
    const u = g.U;
    const cx = g.W * TOWER_X;
    ctx.strokeStyle = state.ink;
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1 - state.night * 0.25;
    for (let i = 0; i < count; i++) {
      const spin = 0.42 + (i % 4) * 0.1;
      const a = t * spin * (i % 2 ? 1 : -1) + i * 2.4;
      const rx = g.W * (0.1 + (i % 5) * 0.035);
      const ry = g.H * (0.07 + (i % 3) * 0.03);
      const sx = cx + Math.cos(a) * rx;
      const sy = g.H * (0.3 + (i % 4) * 0.04) + Math.sin(a * 1.3) * ry;
      const flap = Math.sin(t * 9 + i * 1.7) * u * 0.9;
      const span = u * 2.4;
      ctx.beginPath();
      ctx.moveTo(sx - span, sy - flap);
      ctx.lineTo(sx, sy + u * 0.5);
      ctx.lineTo(sx + span, sy - flap);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, g, t) {
    const lan = state.lantern;
    for (let i = 0; i < LANTERNS.length; i++) {
      const l = LANTERNS[i];
      ctx.save();
      ctx.translate(l.x * g.W, l.y * g.H);
      ctx.rotate(Math.sin(t * 1.1 + l.phase) * 0.16);
      ctx.drawImage(lan, -lan.width / 2, 0);
      ctx.restore();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintCloudStrip(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.front, 0, 0);
    drawSwallows(ctx, g, t, props.swallows);
    drawLanterns(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', swallows: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
