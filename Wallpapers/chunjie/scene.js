/*
 * 春节 Chunjie — a snowy alley at new year. Tiled eaves with snow, a gate with gold studs,
 * lattice windows holding red paper-cut flowers, and red lanterns that sway.
 *
 * Everything still is baked once. Per frame: the lanterns swing as small transforms,
 * flakes and embers are two short reused pools.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const MAX_FLAKES = 150;
  const FLAKES = 80;
  const MAX_EMBERS = 28;
  const EMBERS = 16;
  const RED = '#b5321f';
  const RED_DARK = '#7d2217';
  const RED_LIT = '#d4573a';
  const GOLD = '#d3a84a';
  const GOLD_DIM = '#a88436';
  const TILE = '#232839';
  const TILE_LINE = '#323951';
  const SNOW = '#dfe3ea';
  const SNOW_SHADE = '#aab3c8';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    const gy = Math.round(H * 0.84);
    const xa = W * 0.44;
    const xb = W * 0.58;
    return { W, H, U, u, gy, xa, xb, gx0: W * 0.69, gx1: W * 0.89 };
  }

  // ---- sky and distance ------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.gy);
    grad.addColorStop(0, '#171d38');
    grad.addColorStop(0.5, '#2a3253');
    grad.addColorStop(1, '#4b4f69');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.gy + 1);
  }

  // A far hip roof as a dark silhouette with a snow cap and raised corners.
  function farRoof(ctx, g, x0, x1, yb, h) {
    const w = x1 - x0;
    ctx.fillStyle = '#20263f';
    ctx.beginPath();
    ctx.moveTo(x0 - g.u, yb - h * 0.25);
    ctx.quadraticCurveTo(x0 + w * 0.2, yb + h * 0.1, x0 + w * 0.3, yb - h * 0.6);
    ctx.lineTo(x0 + w * 0.34, yb - h);
    ctx.lineTo(x0 + w * 0.66, yb - h);
    ctx.lineTo(x0 + w * 0.7, yb - h * 0.6);
    ctx.quadraticCurveTo(x0 + w * 0.8, yb + h * 0.1, x1 + g.u, yb - h * 0.25);
    ctx.lineTo(x1, yb + h * 0.6);
    ctx.lineTo(x0, yb + h * 0.6);
    ctx.fill();
    ctx.fillStyle = '#8a92aa';
    ctx.fillRect(x0 + w * 0.33, yb - h - g.u * 0.4, w * 0.34, g.u * 0.9);
    ctx.fillRect(x0 + w * 0.3, yb - h * 0.6, w * 0.4, g.u * 0.5);
  }

  function paintGap(ctx, g, rand) {
    const U = g.U;
    farRoof(ctx, g, g.xa - U * 4, g.xb + U * 10, g.H * 0.34, U * 7);
    farRoof(ctx, g, g.xa + U * 6, g.xb + U * 22, g.H * 0.4, U * 5);
    ctx.fillStyle = '#1a2038';
    ctx.fillRect(g.xa - 2, g.H * 0.4, g.xb - g.xa + 4, g.gy - g.H * 0.4);
    ctx.fillStyle = '#262c46';
    ctx.fillRect(g.xa + U * 6, g.H * 0.48, g.xb - g.xa - U * 12, g.gy - g.H * 0.48);
    ctx.fillStyle = RED_DARK;
    ctx.fillRect(g.xa + (g.xb - g.xa) * 0.4, g.H * 0.62, (g.xb - g.xa) * 0.2, g.gy - g.H * 0.62);
    ctx.fillStyle = GOLD_DIM;
    ctx.fillRect(g.xa + (g.xb - g.xa) * 0.49, g.H * 0.62, 1, g.gy - g.H * 0.62);
    for (let i = 0; i < 4; i++) {
      const x = g.xa + (g.xb - g.xa) * (0.2 + i * 0.2);
      ctx.fillStyle = RED_LIT;
      blob(ctx, x, g.H * 0.55, U * 0.9, U * 1.2);
    }
  }

  // ---- tiled roofs -----------------------------------------------------------

  function edgeY(x, x0, x1, yb, lift) {
    const s = (x - x0) / (x1 - x0);
    return yb - lift * (1 - 4 * s * (1 - s));
  }

  function roofBand(ctx, g, x0, x1, yt, yb, lift, seed) {
    const u = g.u;
    ctx.fillStyle = TILE;
    ctx.beginPath();
    ctx.moveTo(x0, yb - lift);
    ctx.lineTo(x0 + u * 3, yt);
    ctx.lineTo(x1 - u * 3, yt);
    ctx.lineTo(x1, yb - lift);
    for (let x = x1; x >= x0; x -= 2) ctx.lineTo(x, edgeY(x, x0, x1, yb, lift));
    ctx.fill();
    ctx.fillStyle = TILE_LINE;
    const step = Math.max(2, u * 1.1);
    for (let x = x0 + step; x < x1; x += step) {
      const top = yt + (yb - yt) * 0.2;
      ctx.fillRect(Math.round(x), top, 1, edgeY(x, x0, x1, yb, lift) - top);
    }
    ctx.fillStyle = '#3b4360';
    for (let x = x0 + step / 2; x < x1; x += step) blob(ctx, x, edgeY(x, x0, x1, yb, lift) - u * 0.2, step * 0.4, u * 0.55);
    snowCap(ctx, g, x0, x1, yt, yb, lift, seed);
  }

  function snowCap(ctx, g, x0, x1, yt, yb, lift, seed) {
    const u = g.u;
    ctx.fillStyle = SNOW_SHADE;
    ctx.beginPath();
    ctx.moveTo(x0 + u * 2, yt + u * 0.5);
    ctx.lineTo(x1 - u * 2, yt + u * 0.5);
    for (let x = x1 - u * 2; x >= x0 + u * 2; x -= 2) {
      const d = (yb - yt) * (0.5 + 0.28 * fbm(x / (u * 5), 2.2, 3, seed));
      ctx.lineTo(x, yt + d);
    }
    ctx.fill();
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(x0 + u * 2, yt);
    ctx.lineTo(x1 - u * 2, yt);
    for (let x = x1 - u * 2; x >= x0 + u * 2; x -= 2) {
      const d = (yb - yt) * (0.34 + 0.22 * fbm(x / (u * 5), 7.7, 3, seed));
      ctx.lineTo(x, yt + d);
    }
    ctx.fill();
    ctx.fillStyle = SNOW;
    ctx.fillRect(x0 + u * 1.5, yt - u * 0.9, x1 - x0 - u * 3, u * 1.1);
  }

  // ---- walls ----------------------------------------------------------------

  function paintWall(ctx, g, x0, x1, y0) {
    const u = g.u;
    ctx.fillStyle = '#c3c0b4';
    ctx.fillRect(x0, y0, x1 - x0, g.gy - y0);
    const dim = ctx.createLinearGradient(0, y0, 0, g.gy);
    dim.addColorStop(0, 'rgba(14,18,44,0.78)');
    dim.addColorStop(1, 'rgba(22,28,60,0.6)');
    ctx.fillStyle = dim;
    ctx.fillRect(x0, y0, x1 - x0, g.gy - y0);
    const by = g.gy - g.H * 0.11;
    ctx.fillStyle = '#4a4e60';
    ctx.fillRect(x0, by, x1 - x0, g.gy - by);
    ctx.fillStyle = '#383c4c';
    const row = Math.max(2, u * 1.3);
    let k = 0;
    for (let y = by; y < g.gy; y += row, k++) {
      ctx.fillRect(x0, y, x1 - x0, 1);
      for (let x = x0 + (k % 2) * row * 1.3; x < x1; x += row * 2.6) ctx.fillRect(Math.round(x), y, 1, row);
    }
    ctx.fillStyle = SNOW_SHADE;
    ctx.fillRect(x0, by - u * 0.5, x1 - x0, u * 0.6);
  }

  function paintCut(ctx, cx, cy, s) {
    ctx.fillStyle = RED;
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    ctx.fillStyle = '#e3b65c';
    ctx.strokeStyle = '#e3b65c';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.33, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * s * 0.17, cy + Math.sin(a) * s * 0.17);
      ctx.rotate(a);
      blob(ctx, 0, 0, s * 0.11, s * 0.045);
      ctx.restore();
    }
    blob(ctx, cx, cy, s * 0.05, s * 0.05);
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1;
      const sy = i < 2 ? -1 : 1;
      ctx.beginPath();
      ctx.arc(cx + sx * s * 0.5, cy + sy * s * 0.5, s * 0.17, 0, TAU);
      ctx.fill();
      blob(ctx, cx + sx * s * 0.28, cy + sy * s * 0.4, s * 0.04, s * 0.04);
      blob(ctx, cx + sx * s * 0.4, cy + sy * s * 0.28, s * 0.04, s * 0.04);
    }
  }

  function paintWindow(ctx, g, cx, cy, s) {
    const u = g.u;
    const f = Math.max(2, u * 1.3);
    ctx.fillStyle = '#2b2025';
    ctx.fillRect(cx - s / 2 - f, cy - s / 2 - f, s + f * 2, s + f * 2);
    ctx.fillStyle = '#e8bd62';
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    paintCut(ctx, cx, cy, s * 0.8);
    ctx.fillStyle = '#2b2025';
    const t = Math.max(1, u * 0.45);
    ctx.fillRect(cx - t / 2, cy - s / 2, t, s);
    ctx.fillRect(cx - s / 2, cy - t / 2, s, t);
    for (let i = 1; i < 4; i++) {
      ctx.fillRect(cx - s / 2 + (s * i) / 4, cy - s / 2, 1, s);
      ctx.fillRect(cx - s / 2, cy - s / 2 + (s * i) / 4, s, 1);
    }
    ctx.fillStyle = '#3c3036';
    ctx.fillRect(cx - s / 2 - f * 1.6, cy + s / 2 + f, s + f * 3.2, f * 0.9);
    ctx.fillStyle = SNOW;
    ctx.fillRect(cx - s / 2 - f * 1.3, cy + s / 2 + f - u * 0.7, s + f * 2.6, u * 0.9);
    blob(ctx, cx - s * 0.2, cy + s / 2 + f - u * 0.8, u * 2.4, u * 0.8);
    blob(ctx, cx + s * 0.3, cy + s / 2 + f - u * 0.8, u * 1.8, u * 0.7);
  }

  // ---- gate --------------------------------------------------------------------

  function paintGate(ctx, g) {
    const u = g.u;
    const dy = g.H * 0.51;
    const w = g.gx1 - g.gx0;
    ctx.fillStyle = '#2b1f22';
    ctx.fillRect(g.gx0 - u * 1.6, dy - u * 1.2, w + u * 3.2, g.gy - dy + u * 1.2);
    ctx.fillStyle = RED;
    ctx.fillRect(g.gx0, dy, w / 2 - 0.5, g.gy - dy);
    ctx.fillStyle = '#a02c1c';
    ctx.fillRect(g.gx0 + w / 2 + 0.5, dy, w / 2, g.gy - dy);
    ctx.fillStyle = RED_DARK;
    ctx.fillRect(g.gx0 + w / 2 - 0.5, dy, 1.5, g.gy - dy);
    ctx.fillRect(g.gx0, dy + (g.gy - dy) * 0.12, w, 1);
    ctx.fillRect(g.gx0, g.gy - (g.gy - dy) * 0.1, w, 1);
    ctx.fillStyle = GOLD;
    const sz = Math.max(1.5, u * 0.7);
    for (let d = 0; d < 2; d++) {
      const dx0 = g.gx0 + (d * w) / 2;
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const x = dx0 + (w / 2) * (0.1 + i * 0.2);
          const y = dy + (g.gy - dy) * (0.19 + j * 0.14);
          ctx.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
        }
      }
    }
    ctx.fillStyle = GOLD;
    const ky = dy + (g.gy - dy) * 0.55;
    blob(ctx, g.gx0 + w / 2 - u * 1.6, ky, u * 1.1, u * 1.1);
    blob(ctx, g.gx0 + w / 2 + u * 1.6, ky, u * 1.1, u * 1.1);
    ctx.fillStyle = RED_DARK;
    blob(ctx, g.gx0 + w / 2 - u * 1.6, ky, u * 0.5, u * 0.5);
    blob(ctx, g.gx0 + w / 2 + u * 1.6, ky, u * 0.5, u * 0.5);
    paintBeam(ctx, g, dy);
    paintSteps(ctx, g);
  }

  function paintBeam(ctx, g, dy) {
    const u = g.u;
    const x0 = g.gx0 - u * 4;
    const x1 = g.gx1 + u * 4;
    const y0 = dy - u * 6;
    ctx.fillStyle = '#2c4678';
    ctx.fillRect(x0, y0, x1 - x0, dy - y0 - u * 1.2);
    ctx.fillStyle = '#2f6558';
    for (let x = x0 + u; x < x1 - u; x += u * 3.4) ctx.fillRect(Math.round(x), y0 + u * 1.2, Math.max(1, u * 1.5), Math.max(1, u * 1.5));
    ctx.fillStyle = GOLD_DIM;
    ctx.fillRect(x0, y0, x1 - x0, 1);
    ctx.fillRect(x0, dy - u * 1.2 - 2, x1 - x0, 1);
    for (let x = x0 + u * 1.8; x < x1 - u; x += u * 3.4) ctx.fillRect(Math.round(x), y0 + u * 3.6, Math.max(1, u * 0.8), 1);
  }

  function paintSteps(ctx, g) {
    const u = g.u;
    ctx.fillStyle = '#656a7c';
    ctx.fillRect(g.gx0 - u * 2.6, g.gy - u * 1.4, g.gx1 - g.gx0 + u * 5.2, u * 1.4);
    ctx.fillStyle = SNOW;
    ctx.fillRect(g.gx0 - u * 2.6, g.gy - u * 1.9, g.gx1 - g.gx0 + u * 5.2, u * 0.8);
    for (const side of [-1, 1]) {
      const x = side < 0 ? g.gx0 - u * 4.2 : g.gx1 + u * 4.2;
      ctx.fillStyle = '#4e5366';
      blob(ctx, x, g.gy - u * 3, u * 2.6, u * 2.8);
      ctx.fillStyle = '#69708a';
      blob(ctx, x - u * 0.4, g.gy - u * 3.2, u * 1.5, u * 1.6);
      ctx.fillStyle = SNOW;
      blob(ctx, x, g.gy - u * 5.6, u * 2.2, u * 0.7);
    }
  }

  // ---- plum branch -----------------------------------------------------------

  function paintPlum(ctx, g, rand) {
    const u = g.u;
    const pts = [];
    ctx.strokeStyle = '#1b161c';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, u * 0.9);
    ctx.beginPath();
    ctx.moveTo(-u, g.H * 0.04);
    ctx.bezierCurveTo(g.W * 0.07, g.H * 0.02, g.W * 0.12, g.H * 0.16, g.W * 0.2, g.H * 0.15);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      const x = lerp(0, g.W * 0.2, t);
      const y = g.H * (0.03 + 0.12 * t * t);
      const a = 0.6 + rand() * 1.3;
      const len = u * (4 + rand() * 6);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len;
      ctx.lineWidth = Math.max(1, u * 0.45);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      pts.push(ex, ey, x, y);
    }
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] + (rand() - 0.5) * u;
      const y = pts[i + 1] + (rand() - 0.5) * u;
      ctx.fillStyle = '#eadfd2';
      blob(ctx, x, y, u * 0.95, u * 0.95);
      ctx.fillStyle = '#c4533a';
      blob(ctx, x, y, u * 0.38, u * 0.38);
    }
    ctx.fillStyle = SNOW;
    ctx.fillRect(g.W * 0.03, g.H * 0.02, g.W * 0.09, Math.max(1, u * 0.5));
  }

  // ---- ground and glows ------------------------------------------------------

  function paintGround(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.gy, 0, g.H);
    grad.addColorStop(0, '#9aa3bb');
    grad.addColorStop(1, '#6f7897');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.gy, g.W, g.H - g.gy);
    ctx.fillStyle = '#c9cfdc';
    for (let i = 0; i < 24; i++) {
      const x = rand() * g.W;
      const y = g.gy + rand() * (g.H - g.gy);
      blob(ctx, x, y, g.U * (3 + rand() * 6), g.U * (0.4 + rand() * 0.5));
    }
    ctx.fillStyle = '#7e87a4';
    for (let i = 0; i < 10; i++) {
      const x = rand() * g.W;
      const y = g.gy + (g.H - g.gy) * (0.3 + rand() * 0.7);
      blob(ctx, x, y, g.U * (2 + rand() * 4), g.U * 0.35);
    }
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(0, g.gy + g.u * 0.4);
    for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, g.gy + g.u * 0.4 - fbm(x / (g.U * 6), 3.3, 3, 9) * g.u * 1.6);
    ctx.lineTo(g.W, g.gy + g.u * 1.5);
    ctx.lineTo(0, g.gy + g.u * 1.5);
    ctx.fill();
  }

  function glowSprite(size) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(236,150,70,0.7)');
    grad.addColorStop(0.45, 'rgba(210,100,50,0.25)');
    grad.addColorStop(1, 'rgba(180,70,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function lanternSpots(g) {
    const S = Math.min(g.H * 0.2, g.W * 0.11);
    const eave = g.H * 0.38;
    const gateEave = g.H * 0.45;
    const L = g.H * 0.13;
    const rope = g.H * 0.355;
    const gapW = g.xb - g.xa;
    const small = g.H * 0.075;
    const sag = (f) => rope + g.H * 0.035 * (1 - Math.pow(2 * f - 1, 2));
    return {
      S,
      list: [
        { x: g.W * 0.22, y: eave, h: L, ph: 0.2 },
        { x: g.gx0 - g.u * 1.5, y: gateEave, h: L, ph: 1.6 },
        { x: g.gx1 + g.u * 1.5, y: gateEave, h: L, ph: 2.9 },
        { x: g.xa + gapW * 0.25, y: sag(0.25), h: small, ph: 4.1 },
        { x: g.xa + gapW * 0.5, y: sag(0.5), h: small, ph: 0.9 },
        { x: g.xa + gapW * 0.75, y: sag(0.75), h: small, ph: 3.3 },
      ],
      sag,
    };
  }

  function paintGlows(ctx, g, spots, sprite) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of spots.list) {
      const r = l.h * 2.6;
      ctx.globalAlpha = l.h > g.H * 0.1 ? 0.9 : 0.6;
      ctx.drawImage(sprite, l.x - r, l.y + l.h * 0.5 - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 0.7;
    const win = Math.min(g.H * 0.2, g.W * 0.11);
    for (const fx of [0.12, 0.32]) {
      const r = win * 1.5;
      ctx.drawImage(sprite, g.W * fx - r, g.H * 0.58 - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintRope(ctx, g, spots) {
    ctx.strokeStyle = '#3a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.xa - g.u, g.H * 0.355);
    for (let i = 1; i <= 16; i++) {
      const f = i / 16;
      ctx.lineTo(lerp(g.xa - g.u, g.xb + g.u, f), spots.sag(f));
    }
    ctx.stroke();
  }

  function paintBack(g, rand, spots, sprite) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintGap(ctx, g, rand);
    const wallTop = g.H * 0.36;
    paintWall(ctx, g, 0, g.xa, wallTop);
    paintWall(ctx, g, g.xb, g.W, wallTop);
    const S = spots.S;
    paintWindow(ctx, g, g.W * 0.12, g.H * 0.58, S);
    paintWindow(ctx, g, g.W * 0.32, g.H * 0.58, S);
    paintGate(ctx, g);
    paintGround(ctx, g, rand);
    paintGlows(ctx, g, spots, sprite);
    paintRope(ctx, g, spots);
    const lift = g.u * 2.2;
    roofBand(ctx, g, -g.u * 2, g.xa + g.u * 2, g.H * 0.2, g.H * 0.37, lift, 5);
    roofBand(ctx, g, g.xb - g.u * 2, g.W + g.u * 2, g.H * 0.2, g.H * 0.37, lift, 8);
    roofBand(ctx, g, g.gx0 - g.u * 6, g.gx1 + g.u * 6, g.H * 0.31, g.H * 0.445, lift, 12);
    paintPlum(ctx, g, rand);
    return c;
  }

  // ---- lanterns --------------------------------------------------------------

  function lantern(ctx, h) {
    const w = h * 0.78;
    const b = h * 0.72;
    const cap = Math.max(1, h * 0.07);
    const cord = h * 0.12;
    ctx.fillStyle = GOLD_DIM;
    ctx.fillRect(-0.5, -cord, 1, cord);
    ctx.fillStyle = RED_DARK;
    ctx.beginPath();
    ctx.ellipse(0, b / 2, w / 2, b / 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.ellipse(0, b / 2, w * 0.42, b / 2 - 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = RED_LIT;
    ctx.beginPath();
    ctx.ellipse(-w * 0.1, b * 0.45, w * 0.17, b * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = RED_DARK;
    for (const f of [-0.22, 0, 0.22]) ctx.fillRect(Math.round(f * w), 1, 1, b - 2);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-w * 0.2, -cap * 0.5, w * 0.4, cap + 0.5);
    ctx.fillRect(-w * 0.2, b - cap * 0.5, w * 0.4, cap + 0.5);
    ctx.fillStyle = GOLD_DIM;
    ctx.fillRect(-0.5, b, 1, h * 0.2);
    ctx.fillStyle = RED;
    ctx.fillRect(-1, b + h * 0.12, 2, h * 0.16);
  }

  function drawLanterns(ctx, g, t, sway) {
    for (const l of state.spots.list) {
      const a = Math.sin(t * 1.3 + l.ph) * 0.07 * sway + Math.sin(t * 0.55 + l.ph * 2) * 0.035 * sway;
      ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), l.x, l.y);
      lantern(ctx, l.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- flakes and embers ---------------------------------------------------------

  function makePool(n) {
    const f = () => new Float32Array(n);
    return { x: f(), y: f(), vy: f(), vx: f(), p: f(), s: f(), life: f() };
  }

  function resetFlake(g, F, i, scatter) {
    const r = state.rand;
    F.x[i] = r() * g.W;
    F.y[i] = scatter ? r() * g.H : -g.U * 2;
    F.vy[i] = g.U * (3 + r() * 4);
    F.vx[i] = g.U * (0.4 + r() * 0.8);
    F.p[i] = r() * TAU;
    F.s[i] = r() < 0.2 ? 2 : 1.4;
  }

  function resetEmber(g, E, i, scatter) {
    const r = state.rand;
    const l = state.spots.list[Math.floor(r() * 3)];
    E.x[i] = l.x + (r() - 0.5) * g.u * 6;
    E.y[i] = l.y + l.h * 0.7;
    E.vy[i] = -g.U * (2.5 + r() * 2.5);
    E.vx[i] = (r() - 0.5) * g.U * 1.5;
    E.p[i] = r() * TAU;
    E.s[i] = r() < 0.5 ? 0 : 1;
    E.life[i] = scatter ? r() * 7 : 0;
  }

  function drawFlakes(ctx, g, t, dt, count) {
    const F = state.flakes;
    ctx.fillStyle = '#eef0f6';
    for (let i = 0; i < count; i++) {
      F.y[i] += F.vy[i] * dt;
      F.x[i] += (F.vx[i] + Math.sin(t * 0.9 + F.p[i]) * g.U * 1.6) * dt;
      if (F.y[i] > g.H || F.x[i] > g.W + 4) resetFlake(g, F, i, false);
      ctx.globalAlpha = F.s[i] > 1.5 ? 0.95 : 0.7;
      ctx.fillRect(F.x[i], F.y[i], F.s[i], F.s[i]);
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(ctx, g, t, dt, count) {
    const E = state.embers;
    for (let i = 0; i < count; i++) {
      E.life[i] += dt;
      E.y[i] += E.vy[i] * dt;
      E.x[i] += (E.vx[i] + Math.sin(t * 1.4 + E.p[i]) * g.U * 1.2) * dt;
      if (E.life[i] > 7) resetEmber(g, E, i, false);
      const f = E.life[i] / 7;
      ctx.globalAlpha = Math.min(1, f * 6) * (1 - f) * 0.9;
      ctx.fillStyle = E.s[i] ? '#e2b55a' : '#d4573a';
      ctx.fillRect(E.x[i], E.y[i], 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.spots = lanternSpots(g);
    state.back = paintBack(g, rand, state.spots, glowSprite(64));
    state.flakes = makePool(MAX_FLAKES);
    state.embers = makePool(MAX_EMBERS);
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, state.flakes, i, true);
    for (let i = 0; i < MAX_EMBERS; i++) resetEmber(g, state.embers, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, snow, embers } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    drawLanterns(ctx, g, t, sway);
    if (embers) drawEmbers(ctx, g, t, step, EMBERS);
    drawFlakes(ctx, g, t, step, Math.min(MAX_FLAKES, Math.round(FLAKES * snow)));
  }

  Kasuri.run({
    defaults: { sway: 1, snow: 1, embers: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
