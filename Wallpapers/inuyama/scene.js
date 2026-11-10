/*
 * 犬山 Inuyama — a small white castle on a wooded hill above a wide river.
 *
 * Sky, ridges, hill and castle are baked into one world layer, repainted once a
 * minute from the clock. The river is that world flipped and laid back in thin
 * rows that slide sideways. Mist is one tiling strip; the boat is a small sprite.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.56;
  const HILL_X = 0.7;
  const HILL_TOP = 0.335;
  const RETINT_SECONDS = 60;
  const GLINTS = 18;
  const NIGHT_INK = parseColor('#34426a');
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, TAU);
    ctx.fill();
  }

  // Colour tinted by the sky: lit, pushed toward haze with distance, darkened at night.
  function tint(sky, col, depth, lit) {
    const c = mixColor(mixColor(parseColor(col), sky.amb, lit === undefined ? 0.12 : lit), sky.haze, depth || 0);
    return toHex(mixColor(c, NIGHT_INK, sky.night * 0.6));
  }

  // Same as tint, then pushed darker at night so the wooded hill reads as a silhouette.
  function shade(sky, col, depth) {
    return toHex(mixColor(parseColor(tint(sky, col, depth)), parseColor('#0c1220'), sky.night * 0.55));
  }

  // Plaster catches the moon: lifted back toward white at night.
  function plaster(sky) {
    return toHex(mixColor(parseColor(tint(sky, '#e9e2cd', 0.04, 0.2)), parseColor('#e9e2cd'), sky.night * 0.4));
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, wy: Math.round(H * WATER), hx: W * HILL_X, hwL: W * 0.27, hwR: W * 0.23 };
  }

  // ---- hill ----------------------------------------------------------------

  function ridgeY(g, x) {
    const left = x < g.hx;
    const a = Math.abs(x - g.hx) / (left ? g.hwL : g.hwR);
    let bump = 1 - smoothstep(0.17, 1, a);
    bump = Math.pow(bump, left ? 1.25 : 0.75);
    const top = g.H * HILL_TOP;
    const rough = (fbm(x * 0.07, 3, 3, 7) - 0.5) * g.U * (a < 0.17 ? 0.5 : 3.2);
    return g.wy - (g.wy - top) * bump + rough;
  }

  // ---- sky -----------------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.45; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.36, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (sky.night > 0.1) {
      const glow = ctx.createLinearGradient(0, g.H * 0.2, 0, g.wy);
      glow.addColorStop(0, 'rgba(0,0,0,0)');
      glow.addColorStop(1, '#6a7aa6');
      ctx.globalAlpha = sky.night * 0.6;
      ctx.fillStyle = glow;
      ctx.fillRect(0, g.H * 0.2, g.W, g.wy - g.H * 0.2);
      ctx.globalAlpha = 1;
    }
    paintBody(ctx, g, sky);
  }

  function disc(ctx, x, y, r, col, glow, alpha) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    halo.addColorStop(0, col);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = glow * alpha;
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    blob(ctx, x, y, r, r);
    ctx.globalAlpha = 1;
  }

  function paintBody(ctx, g, sky) {
    const h = sky.hour;
    const sunUp = h > 6 && h < 19.5;
    if (sunUp) {
      const t = S.sunT(h);
      const edge = Math.min(smoothstep(0, 0.1, t), 1 - smoothstep(0.9, 1, t));
      disc(ctx, lerp(0.1, 0.9, t) * g.W, g.H * (0.4 - 0.3 * Math.sin(Math.PI * t)), g.U * 2.2, '#f2dcae', 0.22, edge * (1 - sky.night));
    }
    if (sky.night > 0.2) {
      const t = S.moonT(h);
      disc(ctx, lerp(0.12, 0.88, t) * g.W, g.H * (0.38 - 0.28 * Math.sin(Math.PI * t)), g.U * 1.8, '#e8e3ce', 0.2, sky.night);
    }
  }

  // ---- ridges and shore -----------------------------------------------------

  function paintRidge(ctx, g, sky, base, amp, seed, depth, col, tilt) {
    ctx.fillStyle = toHex(mixColor(mixColor(parseColor(col), sky.haze, depth), NIGHT_INK, sky.night * 0.5));
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W; x += 2) {
      const y = g.H * (base + amp * fbm(x * 0.008, 1.5, 4, seed) - tilt * (1 - x / g.W));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.wy);
    ctx.closePath();
    ctx.fill();
  }

  function pine(ctx, sky, x, yb, h) {
    const w = h * 0.34;
    ctx.fillStyle = tint(sky, '#3b2f26', 0.1);
    ctx.fillRect(x - Math.max(0.5, h * 0.05), yb - h * 0.35, Math.max(1, h * 0.1), h * 0.35);
    for (let k = 0; k < 3; k++) {
      const ty = yb - h * (0.3 + k * 0.24);
      const tw = w * (1 - k * 0.22);
      ctx.fillStyle = shade(sky, k === 0 ? '#2e4430' : k === 1 ? '#36503a' : '#405c42', 0.1);
      poly(ctx, [x - tw, ty, x + tw, ty, x + tw * 0.15, ty - h * 0.36, x - tw * 0.15, ty - h * 0.36]);
    }
  }

  function paintHill(ctx, g, sky, rand) {
    const u = g.U;
    const x0 = Math.floor(g.hx - g.hwL);
    const x1 = Math.ceil(g.hx + g.hwR);
    const grad = ctx.createLinearGradient(0, g.H * HILL_TOP, 0, g.wy);
    grad.addColorStop(0, shade(sky, '#4f6048', 0.18));
    grad.addColorStop(1, shade(sky, '#2f4332', 0.05));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0, g.wy);
    for (let x = x0; x <= x1; x += 1) ctx.lineTo(x, ridgeY(g, x));
    ctx.lineTo(x1, g.wy);
    ctx.closePath();
    ctx.fill();
    paintCliff(ctx, g, sky, rand);
    paintTrees(ctx, g, sky, rand);
    paintMaples(ctx, g, sky, rand);
    paintCastle(ctx, g, sky, g.hx, ridgeY(g, g.hx) + u * 0.4);
  }

  function paintCliff(ctx, g, sky, rand) {
    const u = g.U;
    for (let i = 0; i < 90; i++) {
      const x = g.hx + g.hwR * (0.12 + rand() * 0.84);
      const top = ridgeY(g, x) + u * (1 + rand() * 6);
      const len = u * (2 + rand() * 7);
      ctx.fillStyle = tint(sky, rand() < 0.5 ? '#80796a' : '#6a6458', 0.2);
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, Math.min(top, g.wy - 1), Math.max(1, u * 0.7), Math.min(len, g.wy - top));
    }
    ctx.globalAlpha = 1;
  }

  function paintTrees(ctx, g, sky, rand) {
    const u = g.U;
    const spots = [];
    for (let i = 0; i < 80; i++) {
      const x = g.hx + (rand() * 2 - 1) * (rand() < 0.5 ? g.hwL : g.hwR) * 0.92;
      const top = ridgeY(g, x);
      const y = top + rand() * (g.wy - top) * 0.85 + u;
      if (Math.abs(x - g.hx) < u * 11 && y < g.H * HILL_TOP + u * 6) continue;
      if (x > g.hx + g.hwR * 0.45 && rand() < 0.6) continue;
      spots.push([x, y]);
    }
    spots.sort((a, b) => a[1] - b[1]);
    for (const s of spots) {
      const depth = (s[1] - g.H * HILL_TOP) / (g.wy - g.H * HILL_TOP);
      pine(ctx, sky, s[0], s[1], u * (3.4 + rand() * 2.6) * (0.8 + depth * 0.7));
    }
  }

  function paintMaples(ctx, g, sky, rand) {
    const u = g.U;
    const tones = ['#b8412c', '#c9a24a', '#a8512a', '#b8412c'];
    for (let c = 0; c < 5; c++) {
      const cx = g.hx - g.hwL * (0.2 + c * 0.17);
      const cy = ridgeY(g, cx) + (g.wy - ridgeY(g, cx)) * (0.55 + (c % 2) * 0.18);
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = tint(sky, tones[Math.floor(rand() * tones.length)], 0.08, 0.2);
        blob(ctx, cx + (rand() - 0.5) * u * 4, cy + (rand() - 0.5) * u * 2, u * (0.9 + rand() * 1.2), u * (0.8 + rand() * 0.9));
      }
    }
  }

  function paintShore(ctx, g, sky, rand) {
    const u = g.U;
    ctx.fillStyle = shade(sky, '#2c3f2f', 0.15);
    ctx.fillRect(0, g.wy - u * 0.6, g.W, u * 0.6);
    for (let x = 0; x < g.W; x += u * 1.4) {
      if (rand() < 0.35) continue;
      ctx.fillStyle = shade(sky, rand() < 0.5 ? '#2c3f2f' : '#364c36', 0.18);
      blob(ctx, x, g.wy - u * 0.8, u * (1 + rand() * 1.5), u * (0.8 + rand() * 1.2));
    }
  }

  // ---- castle ----------------------------------------------------------------

  function window3(ctx, sky, x, y, w, h, u) {
    const lit = sky.night;
    ctx.fillStyle = lit > 0.4 ? toHex(mixColor(parseColor('#3a3a40'), parseColor('#d9a73a'), lit)) : tint(sky, '#33353b', 0);
    ctx.fillRect(x, y, Math.max(1, w), Math.max(1, h));
  }

  function wall(ctx, sky, x, y, w, h, u, windows) {
    ctx.fillStyle = plaster(sky);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = tint(sky, '#3a3a3f', 0.04);
    ctx.fillRect(x, y + h - u * 1.1, w, u * 1.1);
    const step = w / (windows + 1);
    for (let i = 1; i <= windows; i++) window3(ctx, sky, x + step * i - u * 0.55, y + h * 0.25, u * 1.1, h * 0.38, u);
  }

  function roof(ctx, sky, cx, y, wBase, wTop, h, u) {
    ctx.fillStyle = tint(sky, '#343842', 0.05);
    poly(ctx, [cx - wBase, y, cx + wBase, y, cx + wTop, y - h, cx - wTop, y - h]);
    ctx.fillStyle = tint(sky, '#ece6d2', 0.04, 0.2);
    ctx.fillRect(cx - wBase, y - u * 0.15, wBase * 2, Math.max(1, u * 0.5));
  }

  function gable(ctx, sky, cx, y, wd, hh, u) {
    ctx.fillStyle = tint(sky, '#343842', 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - wd, y);
    ctx.quadraticCurveTo(cx - wd * 0.35, y - hh * 0.25, cx, y - hh);
    ctx.quadraticCurveTo(cx + wd * 0.35, y - hh * 0.25, cx + wd, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = plaster(sky);
    ctx.beginPath();
    ctx.moveTo(cx - wd * 0.74, y);
    ctx.quadraticCurveTo(cx - wd * 0.26, y - hh * 0.22, cx, y - hh * 0.8);
    ctx.quadraticCurveTo(cx + wd * 0.26, y - hh * 0.22, cx + wd * 0.74, y);
    ctx.closePath();
    ctx.fill();
  }

  function paintCastle(ctx, g, sky, cx, by) {
    const u = g.U;
    ctx.fillStyle = tint(sky, '#6f6a5e', 0.1);
    poly(ctx, [cx - 13 * u, by + 2 * u, cx + 13 * u, by + 2 * u, cx + 11.5 * u, by - 1.5 * u, cx - 11.5 * u, by - 1.5 * u]);
    ctx.fillStyle = tint(sky, '#4d4a42', 0.1);
    for (let k = 0; k < 3; k++) ctx.fillRect(cx - 12.6 * u + k * 0.3 * u, by - 0.2 * u + k * 0.8 * u, 25.2 * u - k * 0.6 * u, 1);
    const y1 = by - 1.5 * u - 5.5 * u;
    wall(ctx, sky, cx - 10 * u, y1, 20 * u, 5.5 * u, u, 5);
    roof(ctx, sky, cx, y1, 12.5 * u, 9.5 * u, 2.4 * u, u);
    gable(ctx, sky, cx, y1 - 1.0 * u, 4.8 * u, 4.6 * u, u);
    const y2 = y1 - 2.4 * u - 3.8 * u;
    wall(ctx, sky, cx - 6.8 * u, y2, 13.6 * u, 3.8 * u, u, 3);
    roof(ctx, sky, cx, y2, 8.6 * u, 6.4 * u, 2.1 * u, u);
    const y3 = y2 - 2.1 * u - 3 * u;
    wall(ctx, sky, cx - 4.2 * u, y3, 8.4 * u, 3 * u, u, 3);
    ctx.fillStyle = tint(sky, '#b8412c', 0.04, 0.2);
    ctx.fillRect(cx - 5.4 * u, y3 + 3 * u, 10.8 * u, Math.max(1, 0.6 * u));
    ctx.fillRect(cx - 5.4 * u, y3 + 2.1 * u, 10.8 * u, Math.max(1, 0.3 * u));
    roof(ctx, sky, cx, y3, 6.4 * u, 3.0 * u, 2.4 * u, u);
    ctx.fillStyle = tint(sky, '#c9a24a', 0.02, 0.2);
    poly(ctx, [cx - 3.6 * u, y3 - 2.4 * u, cx - 2.4 * u, y3 - 2.4 * u, cx - 3.3 * u, y3 - 3.6 * u]);
    poly(ctx, [cx + 3.6 * u, y3 - 2.4 * u, cx + 2.4 * u, y3 - 2.4 * u, cx + 3.3 * u, y3 - 3.6 * u]);
  }

  // ---- layers ----------------------------------------------------------------

  function paintWorld(g, sky, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintRidge(ctx, g, sky, 0.3, 0.13, 13, 0.5, '#5d6f8f', 0.05);
    paintRidge(ctx, g, sky, 0.4, 0.1, 21, 0.38, '#4c5f7c', 0.0);
    const fog = ctx.createLinearGradient(0, g.H * 0.34, 0, g.wy);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(1, toHex(sky.haze));
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = fog;
    ctx.fillRect(0, g.H * 0.34, g.W, g.wy - g.H * 0.34);
    ctx.globalAlpha = 1;
    paintHill(ctx, g, sky, rand);
    paintShore(ctx, g, sky, rand);
    const low = ctx.createLinearGradient(0, g.wy - g.U * 9, 0, g.wy);
    low.addColorStop(0, 'rgba(0,0,0,0)');
    low.addColorStop(1, toHex(mixColor(sky.haze, parseColor('#f0ede2'), 0.25)));
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = low;
    ctx.fillRect(0, g.wy - g.U * 9, g.W, g.U * 9);
    ctx.globalAlpha = 1;
    return c;
  }

  function paintFlip(g, world) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    ctx.translate(0, g.wy);
    ctx.scale(1, -1);
    ctx.drawImage(world, 0, 0);
    return c;
  }

  function paintWater(g, sky) {
    const wh = g.H - g.wy;
    const c = layer(g.W, wh);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, wh);
    grad.addColorStop(0, toHex(mixColor(sky.low, sky.haze, 0.35)));
    grad.addColorStop(1, toHex(mixColor(mixColor(sky.top, sky.haze, 0.2), NIGHT_INK, 0.55)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, wh);
    return c;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const veil = ctx.createLinearGradient(0, g.wy, 0, g.H);
    veil.addColorStop(0, 'rgba(20,26,48,0)');
    veil.addColorStop(1, 'rgba(20,26,48,0.5)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, g.wy, g.W, g.H - g.wy);
    ctx.fillStyle = toHex(mixColor(sky.amb, parseColor('#e9e2cd'), 0.5));
    for (let i = 0; i < 46; i++) {
      const y = g.wy + u * 2 + rand() * (g.H - g.wy - u * 3);
      ctx.globalAlpha = 0.07 + rand() * 0.07;
      ctx.fillRect(rand() * g.W, y, u * (3 + rand() * 9), 1);
    }
    ctx.globalAlpha = 1;
    paintReeds(ctx, g, sky, rand);
    return c;
  }

  function paintReeds(ctx, g, sky, rand) {
    const u = g.U;
    const stalk = tint(sky, '#3e4a2c', 0, 0.05);
    const plume = tint(sky, '#c8b57a', 0, 0.2);
    for (let i = 0; i < 70; i++) {
      const left = i % 2 === 0;
      const x = left ? rand() * g.W * 0.16 : g.W * (0.86 + rand() * 0.14);
      const reach = (left ? 1 - x / (g.W * 0.16) : (x - g.W * 0.86) / (g.W * 0.14)) * 0.5 + 0.5;
      const hh = u * (6 + rand() * 12) * reach;
      const lean = (left ? 1 : -1) * u * (1 + rand() * 4) * (rand() < 0.5 ? -0.4 : 1);
      ctx.strokeStyle = stalk;
      ctx.lineWidth = Math.max(1, u * 0.35);
      ctx.beginPath();
      ctx.moveTo(x, g.H + 1);
      ctx.quadraticCurveTo(x + lean * 0.3, g.H - hh * 0.6, x + lean, g.H - hh);
      ctx.stroke();
      if (hh > u * 9 && rand() < 0.55) {
        ctx.fillStyle = plume;
        blob(ctx, x + lean, g.H - hh - u * 0.6, u * 0.55, u * 1.5);
      }
    }
  }

  function paintMist(w, h, sky) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const col = mixColor(parseColor('#f0ede2'), sky.haze, 0.35 + sky.night * 0.4);
    const d = img.data;
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.013, y * 0.09, 4, 33), fbm((x - c.width) * 0.013, y * 0.09, 4, 33), x / c.width);
        const i = (y * c.width + x) * 4;
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
        d[i + 3] = smoothstep(0.46, 0.82, v) * band * 175;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,196,120,0.9)');
    grad.addColorStop(0.35, 'rgba(240,150,80,0.35)');
    grad.addColorStop(1, 'rgba(240,150,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- boat --------------------------------------------------------------------

  function paintBoat(g, sky) {
    const u = g.U;
    const w = Math.ceil(17 * u);
    const h = Math.ceil(11 * u);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tint(sky, '#3a2c22', 0, 0.1);
    poly(ctx, [0.3 * u, h - 2.5 * u, 16.4 * u, h - 2.9 * u, 14.2 * u, h - 0.2 * u, 2.4 * u, h - 0.2 * u]);
    ctx.fillStyle = tint(sky, '#7a6240', 0, 0.15);
    ctx.fillRect(0.3 * u, h - 2.7 * u, 16 * u, Math.max(1, 0.45 * u));
    ctx.fillStyle = tint(sky, '#a8905a', 0.05, 0.15);
    ctx.beginPath();
    ctx.moveTo(6 * u, h - 2.6 * u);
    ctx.quadraticCurveTo(9.5 * u, h - 6 * u, 13 * u, h - 2.6 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tint(sky, '#4a3a2a', 0, 0.1);
    ctx.fillRect(2.6 * u, h - 8.6 * u, Math.max(1, 0.4 * u), 6.2 * u);
    ctx.fillRect(2.6 * u, h - 8.6 * u, 2.2 * u, Math.max(1, 0.35 * u));
    const lx = 4.6 * u;
    const ly = h - 6.9 * u;
    ctx.fillStyle = toHex(mixColor(parseColor('#c8452c'), parseColor('#e8883e'), sky.night * 0.7));
    ctx.beginPath();
    ctx.ellipse(lx, ly, Math.max(1, 1.1 * u), Math.max(1.4, 1.6 * u), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(lx - 0.8 * u, ly - 1.7 * u, Math.max(1, 1.6 * u), Math.max(1, 0.35 * u));
    return { c, lx, ly, w, h };
  }

  function drawBoat(ctx, g, t, props) {
    const b = state.boat;
    const u = g.U;
    const span = g.W + 40 * u;
    const bx = ((g.W * 0.34 + t * u * 0.85 + 20 * u) % span) - 20 * u;
    const bob = Math.sin(t * 0.9) * u * 0.25;
    const water = g.H * 0.8 + bob;
    const top = water - b.h + u * 0.4;
    const lx = bx + b.lx;
    const ly = top + b.ly;
    ctx.globalAlpha = 0.3;
    ctx.save();
    ctx.translate(0, water + u * 0.4);
    ctx.scale(1, -0.7);
    ctx.drawImage(b.c, bx, -b.h);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.drawImage(b.c, bx, top);
    const flick = 0.92 + 0.08 * Math.sin(t * 2.3 + Math.sin(t * 0.9) * 2);
    const glow = (0.3 + 0.7 * state.dim) * flick;
    ctx.globalAlpha = glow;
    ctx.drawImage(state.glow, lx - u * 6, ly - u * 6, u * 12, u * 12);
    ctx.globalAlpha = glow * 0.55;
    ctx.drawImage(state.glow, lx - u * 2.5, water + u * 0.6, u * 5, u * 11);
    ctx.fillStyle = '#e8b86a';
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = glow * (0.6 - k * 0.12);
      const w = u * (3.2 - k * 0.6) * (1 + 0.15 * Math.sin(t * 1.7 + k));
      ctx.fillRect(lx - w / 2 + Math.sin(t * 1.3 + k * 2) * u * 0.3, water + u * (1.6 + k * 1.7), w, Math.max(1, u * 0.35));
    }
    ctx.globalAlpha = 1;
  }

  // ---- bake and draw ------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.world = paintWorld(g, sky, rand);
    state.flip = paintFlip(g, state.world);
    state.water = paintWater(g, sky);
    state.front = paintFront(g, sky, rand);
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.17), sky);
    state.boat = paintBoat(g, sky);
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawMist(ctx, g, t, y, speed, alpha) {
    const c = state.mist;
    const off = -((t * g.U * speed) % c.width);
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
  }

  function drawRiver(ctx, g, t, amount) {
    const wh = g.H - g.wy;
    const amp = amount * g.U * 0.9;
    ctx.globalAlpha = 1;
    ctx.drawImage(state.water, 0, g.wy);
    for (let y = 0; y < wh; y++) {
      const k = y / wh;
      const sx = Math.sin(t * 1.5 + y * 0.45 + Math.sin(y * 0.13) * 2) * amp * (0.2 + k);
      ctx.globalAlpha = 0.72 + 0.12 * Math.sin(t * 0.8 + y * 0.9);
      ctx.drawImage(state.flip, 0, y, g.W, 1, sx, g.wy + y, g.W, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    ctx.fillStyle = '#efe6c8';
    for (let i = 0; i < GLINTS; i++) {
      const ph = Math.sin(t * 0.7 + state.gp[i]);
      if (ph < 0.2) continue;
      ctx.globalAlpha = (ph - 0.2) * 0.4 * amount * (1 - state.dim * 0.6);
      ctx.fillRect(state.gx[i] * g.W, g.wy + state.gy[i] * (g.H - g.wy), g.U * (1.5 + ph * 2), 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.glow = paintGlow();
    const rand = K.rng(5);
    state.gx = new Float32Array(GLINTS);
    state.gy = new Float32Array(GLINTS);
    state.gp = new Float32Array(GLINTS);
    for (let i = 0; i < GLINTS; i++) {
      state.gx[i] = rand();
      state.gy[i] = 0.08 + rand() * 0.85;
      state.gp[i] = rand() * TAU;
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    const mist = props.mist;
    const fade = 1 - state.dim * 0.35;
    ctx.globalAlpha = 1;
    ctx.drawImage(state.world, 0, 0);
    if (mist > 0) {
      drawMist(ctx, g, t, g.H * 0.05, 0.9, Math.min(1, 0.35 * mist) * fade);
      drawMist(ctx, g, t, g.wy - g.H * 0.15, 1.4, Math.min(1, 0.7 * mist) * fade);
    }
    drawRiver(ctx, g, t, props.ripple);
    ctx.drawImage(state.front, 0, 0);
    drawGlints(ctx, g, t, props.ripple);
    if (props.boat) drawBoat(ctx, g, t, props);
    if (mist > 0) {
      drawMist(ctx, g, t, g.wy - g.H * 0.04, -1.1, Math.min(1, 0.8 * mist) * fade);
      drawMist(ctx, g, t, g.wy + g.H * 0.17, 0.7, Math.min(1, 0.5 * mist) * fade);
    }
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, ripple: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
