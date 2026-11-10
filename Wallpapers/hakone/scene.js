/*
 * 箱根 Hakone — an avenue of old cedars beside a mountain lake.
 *
 * Sky, Fuji, far shore and lake are baked into one layer; the cedars, path and
 * a pair of stone lanterns into another; the torii into a small third. Both are
 * repainted once a minute from the clock. Between repaints only the lake rows
 * (the reflection), two mist strips and a few glints move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const HY = 0.53;
  const VX = 0.45;
  const EYE = 0.47;
  const TREE_H = 1.25;
  const FUJI = { x: 0.72, y: 0.255 };
  const TORII = { x: 0.745, base: 0.69, h: 0.2 };
  const RETINT_SECONDS = 60;
  const GLINTS = 30;
const BIRDS = 3;
const NEEDLES = 26;
  const LEFT_ROW = [0.82, 1.05, 1.35, 1.75, 2.25, 2.9, 3.7, 4.8, 6.2, 8, 10.5, 14];
  const RIGHT_ROW = [1.7, 2.2, 2.85, 3.7, 4.8, 6.2, 8, 10.5, 14];
  const BACK_ROW = [3, 4, 5.2, 6.8, 9, 12, 16];
  const LANTERNS = [{ x: 0.17, z: 1.6 }, { x: -0.13, z: 3.4 }];
  const FOLIAGE = { dark: '#233427', mid: '#32492f', light: '#4c6a42' };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  // Colour of something lit by the sky, softened by distance and darkened at night.
  function tone(sky, base, fog) {
    let c = mixColor(rgb(base), sky.amb, 0.12);
    c = mixColor(c, sky.haze, fog || 0);
    return hex(mixColor(c, rgb('#0c1018'), sky.night * 0.28));
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // Ground plane projection: lateral offset X and depth z to fractions of the picture.
  function px(g, X, z) {
    return (VX + X / z) * g.W;
  }

  function py(g, z) {
    return (HY + EYE / z) * g.H;
  }

  // ---- far world ---------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const hy = g.hy;
    const grad = ctx.createLinearGradient(0, 0, 0, hy);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, hy);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.12 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * hy * 0.7, 1, 1);
      }
      ctx.globalAlpha = 1;
      const mt = S.moonT(sky.hour);
      const mx = g.W * lerp(0.08, 0.5, mt);
      const my = g.H * (0.3 - 0.17 * Math.sin(mt * Math.PI));
      ctx.globalAlpha = Math.min(1, sky.night * 1.2);
      ctx.fillStyle = '#e4dcc0';
      ctx.beginPath();
      ctx.arc(mx, my, g.U * 2.4, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function fujiRidge(g, xx) {
    const cx = g.W * FUJI.x;
    const half = g.W * (xx < cx ? 0.25 : 0.29);
    const d = Math.max(0, Math.abs(xx - cx) - g.W * 0.01) / half;
    const top = g.H * FUJI.y;
    return g.hy - (g.hy - top) * Math.pow(Math.max(0, 1 - d), 1.85) + (fbm(xx * 0.05, 2, 3, 5) - 0.5) * g.U * 0.5;
  }

  function paintFuji(ctx, g, sky) {
    const x0 = Math.floor(g.W * (FUJI.x - 0.3));
    const x1 = Math.ceil(g.W * (FUJI.x + 0.34));
    const body = mixColor(mixColor(rgb('#3f4e74'), sky.haze, 0.3), sky.low, 0.18);
    const snow = mixColor(mixColor(rgb('#e6e4e2'), sky.low, 0.42), sky.top, 0.08);
    const dim = mixColor(rgb('#0c1018'), rgb('#000000'), 0).map((c) => c);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, g.hy);
    for (let xx = x0; xx <= x1; xx += 1) ctx.lineTo(xx, fujiRidge(g, xx));
    ctx.lineTo(x1, g.hy);
    ctx.closePath();
    ctx.fillStyle = hex(mixColor(body, dim, sky.night * 0.45));
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = hex(mixColor(snow, dim, sky.night * 0.5));
    ctx.beginPath();
    ctx.moveTo(x0, g.H * FUJI.y - 4);
    const span = g.hy - g.H * FUJI.y;
    for (let xx = x0; xx <= x1; xx += 1) {
      const gully = fbm(xx * 0.3, 3, 3, 9);
      ctx.lineTo(xx, g.H * FUJI.y + span * (0.26 + gully * 0.3));
    }
    ctx.lineTo(x1, g.H * FUJI.y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function paintHaze(ctx, g, sky) {
    const grad = ctx.createLinearGradient(0, g.hy - g.H * 0.14, 0, g.hy);
    const wash = hex(mixColor(mixColor(rgb('#e6e2d6'), sky.low, 0.5), rgb('#101420'), sky.night * 0.5));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, wash);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.hy - g.H * 0.14, g.W, g.H * 0.14);
    ctx.globalAlpha = 1;
  }

  // A low ridge of tiny cedar tips along the far shore.
  function paintShore(ctx, g, sky, rand, lift, fog, seed) {
    ctx.fillStyle = tone(sky, '#3c5240', fog);
    ctx.beginPath();
    ctx.moveTo(0, g.hy);
    for (let xx = 0; xx <= g.W + 2; xx += g.U * 0.9) {
      const swell = fbm(xx / (g.U * 40), seed, 3, seed + 3);
      const tip = rand() < 0.45 ? rand() * g.U * 1.6 : 0;
      ctx.lineTo(xx, g.H * (HY - lift) - swell * g.H * 0.05 - tip);
    }
    ctx.lineTo(g.W, g.hy);
    ctx.closePath();
    ctx.fill();
  }

  function paintLake(ctx, g, sky) {
    const grad = ctx.createLinearGradient(0, g.hy, 0, g.H);
    const near = mixColor(mixColor(rgb('#2c4a52'), sky.top, 0.3), rgb('#0c1018'), sky.night * 0.5);
    const far = mixColor(mixColor(sky.low, sky.haze, 0.5), rgb('#0c1018'), sky.night * 0.25);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.hy, g.W, g.H - g.hy);
  }

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintFuji(ctx, g, sky);
    paintHaze(ctx, g, sky);
    paintShore(ctx, g, sky, rand, 0.045, 0.6, 1.7);
    paintShore(ctx, g, sky, rand, 0.012, 0.4, 4.4);
    paintLake(ctx, g, sky);
    return c;
  }

  // ---- torii -------------------------------------------------------------

  function paintTorii(g, sky) {
    const h = Math.round(g.H * TORII.h);
    const w = Math.round(h * 1.5);
    const c = layer(w, h + 2);
    const ctx = c.getContext('2d');
    const mid = w / 2;
    const red = tone(sky, '#b4442c', 0.15);
    const deep = tone(sky, '#8e3322', 0.15);
    const black = tone(sky, '#262028', 0.1);
    const post = Math.max(2, h * 0.07);
    const top = h * 0.1;
    ctx.fillStyle = red;
    for (const s of [-1, 1]) {
      const cx = mid + s * h * 0.34;
      poly(ctx, [cx - post * 0.5, top, cx + post * 0.5, top, cx + post * 0.62, h, cx - post * 0.62, h]);
      ctx.fillStyle = black;
      ctx.fillRect(cx - post * 0.7, h - h * 0.07, post * 1.4, h * 0.07);
      ctx.fillStyle = red;
    }
    ctx.fillRect(mid - h * 0.48, top + h * 0.22, h * 0.96, Math.max(1.5, h * 0.05));
    ctx.fillRect(mid - post * 0.4, top - h * 0.02, post * 0.8, h * 0.24);
    // The curved head beam, the dark cap above it, and a shadow line beneath.
    ctx.beginPath();
    ctx.moveTo(mid - h * 0.66, top - h * 0.08);
    ctx.quadraticCurveTo(mid, top + h * 0.06, mid + h * 0.66, top - h * 0.08);
    ctx.lineTo(mid + h * 0.6, top + h * 0.02);
    ctx.quadraticCurveTo(mid, top + h * 0.14, mid - h * 0.6, top + h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = black;
    ctx.lineWidth = Math.max(1, h * 0.03);
    ctx.beginPath();
    ctx.moveTo(mid - h * 0.66, top - h * 0.09);
    ctx.quadraticCurveTo(mid, top + h * 0.05, mid + h * 0.66, top - h * 0.09);
    ctx.stroke();
    ctx.fillStyle = deep;
    ctx.fillRect(mid - h * 0.48, top + h * 0.22 + Math.max(1.5, h * 0.05), h * 0.96, 1);
    return c;
  }

  // ---- cedars, path and lanterns ----------------------------------------

  function fogOf(z) {
    return clamp((z - 1) / 14, 0, 1) * 0.72;
  }

  function paintTrunk(ctx, g, sky, bx, by, ht, tw, fog, near) {
    const top = by - ht;
    ctx.fillStyle = tone(sky, '#4a352a', fog);
    poly(ctx, [bx - tw * 0.5, by, bx + tw * 0.5, by, bx + tw * 0.34, top, bx - tw * 0.34, top]);
    ctx.fillStyle = tone(sky, '#6a4a36', fog);
    poly(ctx, [bx + tw * 0.1, by, bx + tw * 0.5, by, bx + tw * 0.34, top, bx + tw * 0.14, top]);
    if (near) {
      ctx.fillStyle = tone(sky, '#2e2019', fog);
      ctx.fillRect(bx - tw * 0.22, top, 1, ht);
      ctx.fillRect(bx + tw * 0.04, top, 1, ht);
    }
  }

  // Jagged drooping tiers, widest near the lower edge of the crown.
  function crownShape(bx, top, depth, half, tiers, rand) {
    const left = [];
    const right = [];
    for (let i = 0; i <= tiers; i++) {
      const f = i / tiers;
      const w = half * Math.pow(f, 0.72);
      const y = top + f * depth;
      const wob = 1 + (rand() - 0.5) * 0.18;
      left.push(bx - w * wob, y + depth * 0.05);
      right.push(bx + w * wob, y + depth * 0.05);
      if (i < tiers) {
        const f2 = (i + 0.55) / tiers;
        const w2 = half * Math.pow(f2, 0.72) * 0.58;
        left.push(bx - w2, top + f2 * depth);
        right.push(bx + w2, top + f2 * depth);
      }
    }
    const pts = [bx, top - depth * 0.06].concat(left);
    for (let i = right.length - 2; i >= 0; i -= 2) pts.push(right[i], right[i + 1]);
    return pts;
  }

  function paintCedar(ctx, g, sky, rand, X, z) {
    const bx = px(g, X + (rand() - 0.5) * 0.05, z);
    const by = py(g, z);
    const ht = (g.H * TREE_H * (0.92 + rand() * 0.16)) / z;
    const tw = Math.max(1.2, (g.H * 0.07 * (0.9 + rand() * 0.25)) / z);
    const fog = fogOf(z);
    paintTrunk(ctx, g, sky, bx, by, ht, tw, fog, z < 3);
    const top = by - ht;
    const half = (g.H * 0.17 * (0.9 + rand() * 0.2)) / z;
    const depth = ht * 0.64;
    const tiers = z < 3 ? 8 : 5;
    ctx.fillStyle = tone(sky, FOLIAGE.dark, fog);
    poly(ctx, crownShape(bx, top, depth, half, tiers, rand));
    ctx.fillStyle = tone(sky, FOLIAGE.mid, fog);
    poly(ctx, crownShape(bx + half * 0.12, top + depth * 0.05, depth * 0.78, half * 0.66, tiers, rand));
    if (z < 6) {
      ctx.fillStyle = tone(sky, FOLIAGE.light, fog);
      poly(ctx, crownShape(bx + half * 0.24, top + depth * 0.1, depth * 0.5, half * 0.34, tiers - 2, rand));
    }
  }

  function paintBank(ctx, g, sky) {
    const pts = [0, g.hy, g.W * VX, g.hy];
    for (let z = 30; z >= 0.45; z *= 0.9) {
      const X = 0.46 + 0.04 * Math.sin(z * 1.7) + 0.02 * Math.sin(z * 4.1);
      pts.push(px(g, X, z), py(g, z));
    }
    pts.push(g.W * 1.4, g.H * 1.6, 0, g.H * 1.6);
    const grad = ctx.createLinearGradient(0, g.H, 0, g.hy);
    grad.addColorStop(0, tone(sky, '#34462f', 0));
    grad.addColorStop(1, tone(sky, '#34462f', 0.7));
    ctx.fillStyle = grad;
    poly(ctx, pts);
  }

  function paintPath(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, g.H, 0, g.hy);
    grad.addColorStop(0, tone(sky, '#8a7e68', 0.05));
    grad.addColorStop(1, tone(sky, '#8a7e68', 0.8));
    ctx.fillStyle = grad;
    poly(ctx, [px(g, -0.22, 40), py(g, 40), px(g, 0.14, 40), py(g, 40), px(g, 0.14, 0.45), py(g, 0.45), px(g, -0.22, 0.45), py(g, 0.45)]);
    // Dappled light patches lying along the gravel.
    ctx.fillStyle = tone(sky, '#c8bc9a', 0.3);
    for (let i = 0; i < 16; i++) {
      const z = 0.9 + rand() * 9;
      ctx.globalAlpha = 0.28 * (1 - sky.night);
      ctx.beginPath();
      ctx.ellipse(px(g, -0.2 + rand() * 0.32, z), py(g, z), g.H * 0.06 / z, g.H * 0.008 / z + 0.4, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintLantern(ctx, g, sky, X, z) {
    const bx = px(g, X, z);
    const by = py(g, z);
    const h = (g.H * 0.3) / z;
    const stone = tone(sky, '#7c7f76', fogOf(z));
    const moss = tone(sky, '#566446', fogOf(z));
    ctx.fillStyle = stone;
    ctx.fillRect(bx - h * 0.2, by - h * 0.1, h * 0.4, h * 0.1);
    ctx.fillRect(bx - h * 0.07, by - h * 0.45, h * 0.14, h * 0.36);
    ctx.fillRect(bx - h * 0.22, by - h * 0.52, h * 0.44, h * 0.08);
    ctx.fillRect(bx - h * 0.14, by - h * 0.75, h * 0.28, h * 0.23);
    if (sky.night > 0.3) {
      ctx.globalAlpha = 0.22 * sky.night;
      ctx.fillStyle = '#e2bf5c';
      ctx.beginPath();
      ctx.arc(bx, by - h * 0.64, h * 0.38, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = hex(mixColor(rgb('#e2bf5c'), rgb('#2a2620'), 1 - sky.night));
    ctx.fillRect(bx - h * 0.07, by - h * 0.7, h * 0.14, h * 0.13);
    ctx.fillStyle = stone;
    poly(ctx, [bx - h * 0.34, by - h * 0.75, bx + h * 0.34, by - h * 0.75, bx + h * 0.14, by - h * 0.9, bx - h * 0.14, by - h * 0.9]);
    ctx.fillRect(bx - h * 0.04, by - h, h * 0.08, h * 0.1);
    ctx.fillStyle = moss;
    ctx.fillRect(bx - h * 0.2, by - h * 0.12, h * 0.4, h * 0.05);
  }

  function paintShafts(ctx, g, sky) {
    if (sky.night > 0.6) return;
    ctx.fillStyle = tone(sky, '#f4e6b8', 0.1);
    for (let i = 0; i < 4; i++) {
      const x0 = g.W * (0.06 + i * 0.1);
      ctx.globalAlpha = 0.07 * (1 - sky.night);
      poly(ctx, [x0, 0, x0 + g.W * 0.05, 0, x0 + g.W * 0.2, g.H * 0.95, x0 + g.W * 0.14, g.H * 0.95]);
    }
    ctx.globalAlpha = 1;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBank(ctx, g, sky);
    paintPath(ctx, g, sky, rand);
    const order = [];
    for (const z of BACK_ROW) order.push({ X: -0.78, z, k: 0 });
    for (const z of LEFT_ROW) order.push({ X: -0.36, z, k: 0 });
    for (const z of RIGHT_ROW) order.push({ X: 0.26, z, k: 0 });
    for (const l of LANTERNS) order.push({ X: l.x, z: l.z, k: 1 });
    order.sort((a, b) => b.z - a.z);
    for (const o of order) {
      if (o.k) paintLantern(ctx, g, sky, o.X, o.z);
      else paintCedar(ctx, g, sky, rand, o.X, o.z);
    }
    paintShafts(ctx, g, sky);
    return c;
  }

  // ---- mist --------------------------------------------------------------

  // A strip that tiles sideways, tinted by the sky.
  function paintMist(w, h, seed, color) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const dens = (xx, yy) => fbm(xx * 0.012, yy * 0.09, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin(((y + 0.5) / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const i = (y * w + x) * 4;
        d[i] = color[0];
        d[i + 1] = color[1];
        d[i + 2] = color[2];
        d[i + 3] = smoothstep(0.42, 0.68, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.back = paintBack(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.torii = paintTorii(g, sky);
    const tint = mixColor(mixColor(rgb('#e8e4d8'), sky.low, 0.4), rgb('#7c86b0'), sky.night * 0.8);
    state.mistLow = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.26), 31, tint);
    state.mistHigh = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.16), 77, tint);
    state.cloud = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2), 13, mixColor(mixColor(rgb('#ece8dc'), sky.low, 0.35), rgb('#6a74a0'), sky.night * 0.75));
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  // The lake is the far world turned over, laid back in rows that slide sideways.
  function drawReflection(ctx, g, t, amount) {
    const rows = g.H - g.hy;
    const amp = g.U * 0.9 * amount;
    for (let r = 0; r < rows; r++) {
      const f = r / rows;
      ctx.globalAlpha = 0.6 + 0.16 * amount * Math.sin(t * 0.9 - r * 0.45);
      const dx = Math.sin(t * 0.9 + r * 0.55) * amp * (0.25 + f) + Math.sin(t * 0.37 - r * 0.21) * amp * 0.5;
      ctx.drawImage(state.back, 0, g.hy - 1 - r, g.W, 1, dx, g.hy + r, g.W, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawTorii(ctx, g, t, amount) {
    const c = state.torii;
    const left = g.W * TORII.x - c.width / 2;
    const base = g.H * TORII.base;
    const rows = Math.floor(c.height * 0.95);
    const amp = g.U * 0.45 * amount;
    for (let r = 0; r < rows; r++) {
      ctx.globalAlpha = 0.5 * (1 - r / rows);
      const dx = Math.sin(t * 1.1 + r * 0.7) * amp * (0.4 + r / rows);
      ctx.drawImage(c, 0, c.height - 2 - r, c.width, 1, left + dx, base + r + 1, c.width, 1);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(c, left, base - c.height + 2);
    // A faint ring where the pillars meet the water.
    ctx.strokeStyle = 'rgba(232,228,214,0.35)';
    ctx.lineWidth = 1;
    const ring = (1 + Math.sin(t * 0.8)) * 0.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(left + c.width / 2 + s * c.height * 0.34, base + 1, c.height * (0.06 + ring * 0.03), c.height * 0.016, 0, 0, 6.3);
      ctx.stroke();
    }
  }

  function drawGlints(ctx, g, t, amount) {
    ctx.fillStyle = hex(mixColor(rgb('#e8d9a8'), rgb('#b4bcd8'), state.night));
    for (let i = 0; i < GLINTS; i++) {
      const k = state.glints[i];
      const wave = 0.5 + 0.5 * Math.sin(t * k.rate + k.phase);
      ctx.globalAlpha = (0.6 + 0.3 * state.night) * wave * amount;
      ctx.fillRect(g.W * (0.52 + k.x * 0.46) + Math.sin(t * 0.2 + k.phase) * g.U, g.H * (0.6 + k.y * 0.38), g.U * (1.4 + k.x), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, c, t, speed, y, alpha) {
    const off = -((t * speed) % c.width);
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // Slow wisps of cloud across the sky behind Fuji.
  function drawCloud(ctx, g, t) {
    const c = state.cloud;
    const off = -((t * g.U * 1.3) % c.width);
    ctx.globalAlpha = 0.7 * (1 - state.night * 0.35);
    ctx.drawImage(c, off, g.H * 0.08);
    ctx.drawImage(c, off + c.width, g.H * 0.08);
    ctx.globalAlpha = 1;
  }

  // Three small birds cross the lake, wings rising and falling.
  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = hex(mixColor(rgb('#2a2c3a'), rgb('#9aa0b8'), state.night * 0.5));
    ctx.lineWidth = 1;
    for (let i = 0; i < BIRDS; i++) {
      const b = state.birds[i];
      const p = (t * b.v + b.p) % 1;
      const bx = g.W * (1.05 - p * 1.15);
      const by = g.H * b.y + Math.sin(p * 9 + i) * g.U;
      const flap = Math.sin(t * 5 + i * 2) * g.U * 0.7;
      ctx.beginPath();
      ctx.moveTo(bx - g.U * 1.4, by - flap * 0.5);
      ctx.lineTo(bx, by + g.U * 0.3);
      ctx.lineTo(bx + g.U * 1.4, by - flap * 0.5);
      ctx.stroke();
    }
  }

  // Cedar needles sifting down through the avenue.
  function drawNeedles(ctx, g, t) {
    ctx.fillStyle = hex(mixColor(rgb('#8a6a3c'), rgb('#40466a'), state.night));
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < NEEDLES; i++) {
      const n = state.needles[i];
      const p = (t * n.v + n.p) % 1;
      ctx.fillRect(g.W * (n.x + Math.sin(t * 0.8 + n.p * 20) * 0.01 - p * 0.03), g.H * (0.1 + p * 0.85), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100, hy: Math.round(api.rows * HY) };
    state.g = g;
    const rand = K.rng(9);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      state.glints.push({ x: rand(), y: rand(), phase: rand() * 6.3, rate: 0.3 + rand() * 0.5 });
    }
    state.birds = [];
    for (let i = 0; i < BIRDS; i++) state.birds.push({ y: 0.34 + rand() * 0.12, v: 0.012 + rand() * 0.006, p: rand() });
    state.needles = [];
    for (let i = 0; i < NEEDLES; i++) state.needles.push({ x: 0.05 + rand() * 0.45, v: 0.02 + rand() * 0.02, p: rand() });
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    const calm = 1 - state.night * 0.1;
    ctx.drawImage(state.back, 0, 0);
    drawCloud(ctx, g, t);
    drawReflection(ctx, g, t, props.ripple);
    drawGlints(ctx, g, t, props.ripple * calm);
    drawTorii(ctx, g, t, props.ripple);
    drawBirds(ctx, g, t);
    drawMist(ctx, state.mistLow, t, g.U * 3, g.H * 0.41, Math.min(1, 1 * props.mist * calm));
    ctx.drawImage(state.front, 0, 0);
    drawNeedles(ctx, g, t);
    drawMist(ctx, state.mistHigh, t + 40, -g.U * 2, g.H * 0.5, Math.min(1, 0.5 * props.mist * calm));
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
