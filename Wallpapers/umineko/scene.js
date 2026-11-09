/*
 * 海猫 Umineko — black-tailed gulls on a sea cliff at the first sunrise of the year.
 *
 * Sky, sun, cliff, shrine, sea stack and the nesting gulls are baked once. The sea is a
 * baked strip laid back in thin rows that slide sideways. Foam is a few breathing blobs,
 * clouds are two tiling strips, and the flying gulls are drawn from a handful of strokes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.56;
  const MAX_GULLS = 12;
  const GULLS = 6;
  const ORBITERS = 3;
  const GLINTS = 14;
  const FOAM_BLOBS = 14;
  const INK = '#20252b';
  const WASHI = '#ece4d0';
  const VERMILION = '#c4452c';
  const GOLD = '#dcb766';
  const MOSS = ['#2f4430', '#43603f', '#6a8556'];
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

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const u = Math.min(H / 100, W / 170);
    const wy = Math.round(H * HORIZON);
    return {
      W, H, u, wy,
      py: H * 0.3,
      fy: H * 0.86,
      sunX: W * 0.2,
      sunY: wy - u * 11,
      stackX: W * 0.3,
      stackFoot: wy + u * 15,
      margin: Math.ceil(u * 4),
    };
  }

  // ---- sky -----------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, '#7f93a9');
    grad.addColorStop(0.45, '#b9c3c6');
    grad.addColorStop(0.8, '#ecd3ac');
    grad.addColorStop(1, '#f0c39a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy + 1);
    const halo = ctx.createRadialGradient(g.sunX, g.sunY, 0, g.sunX, g.sunY, g.u * 38);
    halo.addColorStop(0, 'rgba(236,196,140,0.75)');
    halo.addColorStop(1, 'rgba(236,196,140,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.wy + 1);
    ctx.fillStyle = '#d2573a';
    blob(ctx, g.sunX, g.sunY, g.u * 7.5, g.u * 7.5);
    ctx.fillStyle = '#e07a4a';
    blob(ctx, g.sunX - g.u * 1.2, g.sunY - g.u * 1.2, g.u * 5, g.u * 5);
    paintIslands(ctx, g, rand);
  }

  function paintIslands(ctx, g, rand) {
    const ridge = (x0, x1, h, ink, seed) => {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x0, g.wy + 1);
      for (let x = x0; x <= x1; x += 1) {
        const f = (x - x0) / (x1 - x0);
        const bell = Math.sin(f * Math.PI) ** 0.8;
        ctx.lineTo(x, g.wy - bell * (h + (fbm(x / (g.u * 6), seed, 3, seed) - 0.5) * g.u * 2));
      }
      ctx.lineTo(x1, g.wy + 1);
      ctx.fill();
    };
    ridge(g.W * 0.33, g.W * 0.58, g.u * 8, '#a4aeb4', 4);
    ridge(g.W * 0.62, g.W * 0.8, g.u * 5, '#97a3ab', 9);
    ridge(g.W * 0.4, g.W * 0.52, g.u * 4, '#8a99a2', 14);
    ctx.fillStyle = '#e8c7a0';
    ctx.fillRect(0, g.wy - 1, g.W, 2);
  }

  function paintClouds(w, h, rand, count, scale) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = h * (0.15 + rand() * 0.75);
      const rx = scale * (6 + rand() * 14);
      for (const dx of [-w, 0, w]) {
        ctx.fillStyle = 'rgba(236,228,208,0.6)';
        blob(ctx, x + dx, y, rx, scale * 0.5);
        ctx.fillStyle = 'rgba(232,185,160,0.5)';
        blob(ctx, x + dx + rx * 0.2, y + scale * 0.45, rx * 0.8, scale * 0.3);
        ctx.fillStyle = 'rgba(236,228,208,0.5)';
        blob(ctx, x + dx - rx * 0.4, y - scale * 0.3, rx * 0.5, scale * 0.3);
      }
    }
    return c;
  }

  // ---- sea -----------------------------------------------------------------

  function paintSea(g, rand) {
    const h = g.H - g.wy;
    const w = g.W + g.margin * 2;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#8d9ba2');
    grad.addColorStop(0.25, '#5d788b');
    grad.addColorStop(0.7, '#2f4966');
    grad.addColorStop(1, '#1f3350');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const path = ctx.createLinearGradient(0, 0, 0, h);
    path.addColorStop(0, 'rgba(232,190,130,0.45)');
    path.addColorStop(1, 'rgba(232,190,130,0.08)');
    ctx.fillStyle = path;
    for (let y = 0; y < h; y += 2) {
      const half = g.u * (3 + (y / h) * 9);
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(y * 0.9);
      ctx.fillRect(g.sunX + g.margin - half, y, half * 2, 1);
    }
    ctx.globalAlpha = 1;
    let y = 1.5;
    while (y < h) {
      const depth = y / h;
      const len = g.u * (2 + depth * 8);
      for (let x = -len; x < w; x += len * (1.2 + rand() * 1.6)) {
        ctx.fillStyle = rand() < 0.5 ? 'rgba(180,196,200,0.45)' : 'rgba(22,38,62,0.45)';
        ctx.fillRect(x, y, len * (0.5 + rand() * 0.7), Math.max(1, g.u * 0.3));
      }
      y += g.u * (1.1 + depth * 2.6);
    }
    return c;
  }

  function drawSea(ctx, g, t, waves) {
    const sea = state.sea;
    const h = sea.height;
    const amp = Math.min(g.margin - 1, g.u * 1.1 * waves);
    for (let y = 0; y < h; y += 2) {
      const depth = 0.3 + y / h;
      const dx = Math.sin(t * 0.7 + y * 0.42) * amp * depth;
      ctx.drawImage(sea, g.margin + dx, y, g.W, Math.min(2, h - y), 0, g.wy + y, g.W, Math.min(2, h - y));
    }
  }

  function drawGlints(ctx, g, t) {
    const h = g.H - g.wy;
    for (let i = 0; i < GLINTS; i++) {
      const f = (i + 0.5) / GLINTS;
      const y = g.wy + 1 + f * f * h * 0.95;
      const swing = Math.sin(t * 0.5 + i * 2.1);
      const half = g.u * (1 + f * 6) * (0.6 + 0.3 * swing);
      const x = g.sunX + Math.sin(t * 0.3 + i * 1.7) * g.u * (1 + f * 4);
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 0.4 + i * 3.3);
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - half, y, half * 2, Math.max(1, g.u * 0.35));
    }
    ctx.globalAlpha = 1;
  }

  // ---- cliff ---------------------------------------------------------------

  function leftEdge(g, y) {
    const f = Math.max(0, (y - g.py) / (g.fy - g.py));
    return g.W * 0.47 - f * g.W * 0.07 + (fbm(y / (g.u * 5), 3.3, 3, 5) - 0.5) * g.u * 7;
  }

  function topEdge(g, x) {
    return g.py + (fbm(x / (g.u * 8), 1.1, 2, 9) - 0.5) * g.u * 1.5;
  }

  function rockTone(g, x, y, edge) {
    const n = fbm(x / (g.u * 6), y / (g.u * 2.2), 3, 7);
    const strata = Math.sin((y / g.u) * 1.25 + n * 4) * 0.5;
    const lit = smoothstep(g.u * 34, 0, x - edge);
    const v = 0.5 + n * 0.4 + strata * 0.2 + lit * 0.3;
    const dark = K.parseColor('#3c424b');
    const mid = K.parseColor('#a29c8c');
    const warm = K.parseColor('#c79c78');
    const base = K.mixColor(dark, mid, Math.min(1, Math.max(0, v)));
    return K.toHex(K.mixColor(base, warm, lit * 0.35));
  }

  function paintRock(ctx, g) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(leftEdge(g, g.py), g.py);
    for (let y = g.py; y <= g.fy; y += 2) ctx.lineTo(leftEdge(g, y), y);
    ctx.lineTo(g.W + 2, g.fy);
    ctx.lineTo(g.W + 2, g.py);
    for (let x = g.W + 2; x >= leftEdge(g, g.py); x -= 2) ctx.lineTo(x, topEdge(g, x));
    ctx.closePath();
    ctx.clip();
    for (let y = Math.floor(g.py - g.u * 2); y < g.fy + 1; y += 1) {
      const edge = leftEdge(g, y);
      for (let x = Math.floor(edge - 2); x < g.W; x += 2) {
        ctx.fillStyle = rockTone(g, x, y, edge);
        ctx.fillRect(x, y, 2, 1);
      }
    }
    ctx.restore();
  }

  function paintStack(ctx, g, rand) {
    const foot = g.stackFoot;
    const hgt = g.u * 24;
    const w = g.u * 11;
    const left = [];
    const right = [];
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      const y = foot - f * hgt;
      const half = w * (1 - f * 0.55) * (0.85 + fbm(f * 3, 2.2, 2, 3) * 0.3);
      left.push(g.stackX - half, y);
      right.unshift(g.stackX + half * 0.9, y);
    }
    ctx.fillStyle = '#4a4d52';
    poly(ctx, left.concat(right));
    ctx.fillStyle = '#7d7769';
    poly(ctx, left.slice(0, 14).concat([g.stackX - w * 0.1, foot - hgt * 0.5, g.stackX - w * 0.2, foot]));
    ctx.fillStyle = '#6a7d55';
    blob(ctx, g.stackX - g.u * 0.5, foot - hgt, g.u * 4.4, g.u * 1.2);
    pine(ctx, g.stackX + g.u * 0.5, foot - hgt + g.u * 0.6, g.u * 12, -0.3, 21);
    perch(ctx, g.stackX - g.u * 3, foot - hgt * 0.62, g.u * 0.9, 1);
    perch(ctx, g.stackX + g.u * 1.5, foot - hgt * 0.8, g.u * 0.9, -1);
    rocks(ctx, g, g.stackX - w, g.stackX + w, foot, rand);
  }

  function rocks(ctx, g, x0, x1, y, rand) {
    for (let x = x0; x < x1; x += g.u * (1.5 + rand() * 1.5)) {
      ctx.fillStyle = rand() < 0.5 ? '#3a3f45' : '#59595a';
      blob(ctx, x, y + rand() * g.u * 0.6, g.u * (1 + rand() * 1.2), g.u * 0.9);
    }
  }

  function pine(ctx, x, y, h, lean, seed) {
    const r = K.rng(seed);
    const bend = h * lean;
    ctx.strokeStyle = '#3c2e24';
    ctx.lineWidth = Math.max(1, h * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + bend * 0.2, y - h * 0.5, x + bend, y - h * 0.9);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const f = 0.4 + i * 0.17;
      const side = i % 2 ? 1 : -1;
      const px = x + bend * f * f + side * h * 0.14 * (1 - f * 0.5);
      const py = y - h * f;
      const w = h * (0.3 - f * 0.12);
      ctx.fillStyle = MOSS[0];
      blob(ctx, px, py, w, w * 0.42);
      ctx.fillStyle = MOSS[1];
      blob(ctx, px - w * 0.1, py - w * 0.14, w * 0.75, w * 0.28);
      ctx.fillStyle = MOSS[2];
      blob(ctx, px - w * 0.3, py - w * 0.24 - r() * 0.3, w * 0.4, w * 0.13);
    }
  }

  function perch(ctx, x, y, s, dir) {
    ctx.fillStyle = WASHI;
    blob(ctx, x, y - s * 0.7, s * 1.5, s * 0.8);
    blob(ctx, x + dir * s * 1.4, y - s * 1.3, s * 0.6, s * 0.6);
    ctx.fillStyle = INK;
    blob(ctx, x - dir * s * 0.2, y - s * 0.95, s * 1.1, s * 0.4);
    ctx.fillRect(x - dir * s * 1.6 - (dir > 0 ? 0 : s * 0.5), y - s * 0.9, s * 0.5, s * 0.4);
    ctx.fillStyle = '#e0b84a';
    ctx.fillRect(x + dir * s * 1.9 - (dir > 0 ? 0 : s * 0.5), y - s * 1.3, s * 0.5, Math.max(1, s * 0.3));
  }

  function paintLedges(ctx, g, rand) {
    const count = 11;
    for (let i = 0; i < count; i++) {
      const y = g.py + g.u * (7 + i * 5.6 + rand() * 2);
      if (y > g.fy - g.u * 5) continue;
      const edge = leftEdge(g, y);
      const w = g.u * (4 + rand() * 3);
      ctx.fillStyle = 'rgba(236,228,208,0.5)';
      for (let k = 0; k < 3; k++) ctx.fillRect(edge + g.u * (1 + rand() * w * 0.1 + k), y + g.u * 0.8, Math.max(1, g.u * 0.3), g.u * (2 + rand() * 3));
      ctx.fillStyle = '#9b958a';
      ctx.fillRect(edge - g.u * 2.2, y, w, Math.max(1, g.u * 0.9));
      ctx.fillStyle = '#5a5850';
      ctx.fillRect(edge - g.u * 2.2, y + g.u * 0.9, w, Math.max(1, g.u * 0.35));
      perch(ctx, edge - g.u * 0.6, y, g.u * 1.2, -1);
      if (rand() < 0.6) perch(ctx, edge + g.u * 1.8, y, g.u * 1.2, rand() < 0.5 ? 1 : -1);
    }
  }

  function paintTurf(ctx, g, rand) {
    const x0 = leftEdge(g, g.py) - g.u * 2;
    for (let x = x0; x < g.W + g.u * 3; x += g.u * (1 + rand() * 1.2)) {
      const y = topEdge(g, x);
      const r = g.u * (1 + rand() * 1.1);
      ctx.fillStyle = MOSS[0];
      blob(ctx, x, y, r, r * 0.6);
      ctx.fillStyle = MOSS[1];
      blob(ctx, x - r * 0.2, y - r * 0.3, r * 0.7, r * 0.35);
      if (rand() < 0.4) {
        ctx.fillStyle = MOSS[2];
        blob(ctx, x - r * 0.4, y - r * 0.5, r * 0.35, r * 0.16);
      }
    }
  }

  // ---- shrine --------------------------------------------------------------

  function torii(ctx, g, x, y) {
    const u = g.u;
    const h = u * 9;
    const half = u * 3.7;
    const pw = Math.max(1, u * 0.95);
    ctx.fillStyle = VERMILION;
    ctx.fillRect(x - half - pw / 2, y - h, pw, h);
    ctx.fillRect(x + half - pw / 2, y - h, pw, h);
    ctx.fillRect(x - half * 1.15, y - h * 0.68, half * 2.3, Math.max(1, u * 0.7));
    ctx.fillRect(x - half * 1.45, y - h - u * 0.2, half * 2.9, Math.max(1, u * 0.8));
    poly(ctx, [x - half * 1.9, y - h - u * 1.6, x - half * 1.3, y - h - u * 0.5, x + half * 1.3, y - h - u * 0.5, x + half * 1.9, y - h - u * 1.6, x + half * 1.5, y - h - u * 0.3, x - half * 1.5, y - h - u * 0.3]);
    ctx.fillStyle = INK;
    poly(ctx, [x - half * 2, y - h - u * 2.1, x - half * 1.3, y - h - u * 1, x + half * 1.3, y - h - u * 1, x + half * 2, y - h - u * 2.1, x + half * 1.5, y - h - u * 0.6, x - half * 1.5, y - h - u * 0.6]);
    ctx.fillRect(x - half - pw / 2, y - u * 1.1, pw, u * 1.1);
    ctx.fillRect(x + half - pw / 2, y - u * 1.1, pw, u * 1.1);
  }

  function lantern(ctx, g, x, y) {
    const u = g.u;
    ctx.fillStyle = '#8c897e';
    ctx.fillRect(x - u * 1.2, y - u * 0.8, u * 2.4, u * 0.8);
    ctx.fillRect(x - u * 0.4, y - u * 2.6, u * 0.8, u * 1.9);
    ctx.fillRect(x - u * 1.1, y - u * 3.2, u * 2.2, u * 0.7);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - u * 0.6, y - u * 4.6, u * 1.2, u * 1.4);
    ctx.fillStyle = '#8c897e';
    ctx.fillRect(x - u * 0.2, y - u * 4.7, u * 0.4, u * 1.5);
    poly(ctx, [x - u * 1.9, y - u * 4.6, x + u * 1.9, y - u * 4.6, x + u * 0.4, y - u * 6, x - u * 0.4, y - u * 6]);
    ctx.fillStyle = '#6f6c63';
    blob(ctx, x, y - u * 6.1, u * 0.45, u * 0.45);
  }

  function roof(ctx, g, x, eave, hw) {
    const u = g.u;
    const top = eave - u * 4;
    ctx.fillStyle = '#2b2622';
    poly(ctx, [x - hw, eave - u * 1.2, x + hw, eave - u * 1.2, x + hw - u, eave + u * 0.5, x - hw + u, eave + u * 0.5]);
    ctx.fillStyle = '#454a50';
    poly(ctx, [x - hw - u * 0.5, eave - u * 1.8, x - hw * 0.45, top, x + hw * 0.45, top, x + hw + u * 0.5, eave - u * 1.8, x + hw, eave - u * 0.7, x - hw, eave - u * 0.7]);
    ctx.fillStyle = '#5c6268';
    poly(ctx, [x - hw * 0.45, top, x + hw * 0.45, top, x + hw * 0.4, top + u * 0.9, x - hw * 0.4, top + u * 0.9]);
    ctx.fillStyle = '#7e8288';
    ctx.fillRect(x - hw * 0.75, eave - u * 2.2, hw * 1.5, Math.max(1, u * 0.3));
    ctx.fillStyle = '#d9c9a0';
    for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * u * 2.4 - u * 0.8, top - u * 0.7, u * 1.6, u * 0.7);
    ctx.strokeStyle = '#d9c9a0';
    ctx.lineWidth = Math.max(1, u * 0.45);
    for (const s of [-1, 1]) {
      const rx = x + s * hw * 0.5;
      ctx.beginPath();
      ctx.moveTo(rx - u * 1.2, top - u * 2.1);
      ctx.lineTo(rx + u * 1.2, top + u * 0.4);
      ctx.moveTo(rx + u * 1.2, top - u * 2.1);
      ctx.lineTo(rx - u * 1.2, top + u * 0.4);
      ctx.stroke();
    }
  }

  function hall(ctx, g, x, y) {
    const u = g.u;
    const hw = u * 11;
    ctx.fillStyle = '#8f8a7c';
    ctx.fillRect(x - hw - u, y - u * 1.4, hw * 2 + u * 2, u * 1.4);
    const wallTop = y - u * 6.4;
    ctx.fillStyle = '#d6c8a6';
    ctx.fillRect(x - hw + u, wallTop, hw * 2 - u * 2, u * 5);
    ctx.fillStyle = '#4a3a2c';
    ctx.fillRect(x - u * 2.2, wallTop + u * 1.2, u * 4.4, u * 3.8);
    ctx.fillStyle = '#7b6a52';
    for (let i = -1; i <= 1; i += 2) ctx.fillRect(x + i * u * 6.4 - u * 1.8, wallTop + u * 1.4, u * 3.6, u * 2.4);
    ctx.fillStyle = VERMILION;
    for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * hw * 0.4 - u * 0.4, wallTop, Math.max(1, u * 0.8), u * 5);
    roof(ctx, g, x, wallTop, hw + u * 1.5);
    ctx.strokeStyle = '#c9b27a';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - hw * 0.8, wallTop + u * 0.6);
    ctx.quadraticCurveTo(x, wallTop + u * 2, x + hw * 0.8, wallTop + u * 0.6);
    ctx.stroke();
    ctx.fillStyle = WASHI;
    for (const s of [-0.5, 0, 0.5]) ctx.fillRect(x + s * hw * 1.2 - u * 0.3, wallTop + u * (1.2 + (1 - Math.abs(s) * 2) * 0.6), Math.max(1, u * 0.6), u * 1.1);
  }

  // ---- layers --------------------------------------------------------------

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintStack(ctx, g, rand);
    paintRock(ctx, g);
    paintLedges(ctx, g, rand);
    paintTurf(ctx, g, rand);
    paintShrineScene(ctx, g, rand);
    rocks(ctx, g, leftEdge(g, g.fy) - g.u * 3, g.W * 0.7, g.fy, rand);
    return c;
  }

  function paintShrineScene(ctx, g, rand) {
    const baseY = g.py + g.u * 0.4;
    pine(ctx, g.W * 0.935, baseY, g.u * 24, -0.1, 33);
    pine(ctx, leftEdge(g, g.py) + g.u * 5, baseY, g.u * 19, -0.35, 37);
    hall(ctx, g, g.W * 0.76, baseY);
    torii(ctx, g, g.W * 0.585, baseY);
    lantern(ctx, g, g.W * 0.665, baseY);
    perch(ctx, g.W * 0.64, baseY, g.u * 0.9, -1);
    perch(ctx, g.W * 0.69, baseY, g.u * 0.9, 1);
    perch(ctx, leftEdge(g, g.py) + g.u * 1.5, baseY, g.u * 0.9, -1);
  }

  // ---- foam ----------------------------------------------------------------

  function drawFoam(ctx, g, t, waves) {
    const anchors = [
      [leftEdge(g, g.fy) + g.u * 1, g.fy, g.u * 14],
      [g.stackX, g.stackFoot, g.u * 9],
    ];
    ctx.fillStyle = WASHI;
    for (let a = 0; a < anchors.length; a++) {
      const [ax, ay, span] = anchors[a];
      for (let i = 0; i < FOAM_BLOBS; i++) {
        const f = i / (FOAM_BLOBS - 1);
        const swell = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 0.9 + a * 2);
        const x = ax - span + f * span * 2;
        const y = ay + g.u * (0.4 + 0.9 * swell * waves) + Math.sin(i * 2.7) * g.u * 0.4;
        ctx.globalAlpha = (0.35 + 0.4 * swell) * Math.min(1, 0.4 + waves * 0.6);
        blob(ctx, x, y, g.u * (1.2 + swell * 1.4), g.u * (0.35 + swell * 0.3));
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- gulls ---------------------------------------------------------------

  function makeGulls(rand) {
    const gulls = [];
    for (let i = 0; i < MAX_GULLS; i++) {
      gulls.push({
        orbit: i < ORBITERS,
        phase: rand(),
        speed: 0.012 + rand() * 0.01,
        dir: rand() < 0.5 ? -1 : 1,
        y: 0.12 + rand() * 0.45,
        wob: rand() * TAU,
        size: 2.2 + rand() * 0.9,
      });
    }
    return gulls;
  }

  function wing(ctx, x, y, dx, dy, s, lift) {
    const ex = x + dx * s * 2.2;
    const ey = y - s * 0.2 - lift * s * 1.5;
    const tx = x + dx * s * 4.6;
    const ty = ey + s * (0.55 - lift * 0.5);
    const mx = lerp(ex, tx, 0.65);
    const my = lerp(ey, ty, 0.65);
    ctx.lineWidth = Math.max(1, s * 0.75);
    ctx.strokeStyle = WASHI;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.2);
    ctx.lineTo(ex, ey);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  function gull(ctx, x, y, s, dir, lift) {
    wing(ctx, x, y, -1, 0, s, lift);
    wing(ctx, x, y, 1, 0, s, lift);
    ctx.fillStyle = WASHI;
    blob(ctx, x, y, s * 1.5, s * 0.55);
    blob(ctx, x + dir * s * 1.7, y - s * 0.1, s * 0.5, s * 0.5);
    ctx.fillStyle = INK;
    ctx.fillRect(x - dir * s * 1.9 - (dir > 0 ? 0 : -s * 0.2), y - s * 0.2, s * 0.5, Math.max(1, s * 0.4));
    ctx.fillStyle = '#e0b84a';
    ctx.fillRect(x + dir * s * 2.1 - (dir > 0 ? 0 : s * 0.5), y - s * 0.15, s * 0.5, Math.max(1, s * 0.3));
  }

  function liftOf(gl, t) {
    const burst = smoothstep(0.2, 0.9, 0.5 + 0.5 * Math.sin(t * 0.25 + gl.wob * 3));
    return 0.22 + 0.1 * Math.sin(t * 0.7 + gl.wob) + burst * 0.4 * Math.sin(t * 3.6 + gl.wob);
  }

  function drawGulls(ctx, g, t, count) {
    for (let i = 0; i < count; i++) {
      const gl = state.gulls[i];
      const lift = liftOf(gl, t);
      if (gl.orbit) {
        const a = t * 0.14 * gl.dir + gl.phase * TAU;
        const depth = 0.75 + 0.25 * Math.sin(a);
        const x = g.W * 0.4 + Math.cos(a) * g.u * (20 + i * 5);
        const y = g.H * (0.34 + i * 0.07) + Math.sin(a) * g.u * 6;
        const heading = -Math.sin(a) * gl.dir >= 0 ? 1 : -1;
        gull(ctx, x, y, g.u * gl.size * depth, heading, lift);
      } else {
        const span = g.W + g.u * 24;
        const p = (t * gl.speed + gl.phase) % 1;
        const x = gl.dir > 0 ? -g.u * 12 + p * span : g.W + g.u * 12 - p * span;
        const y = g.H * gl.y + Math.sin(p * TAU * 1.5 + gl.wob) * g.u * 4;
        gull(ctx, x, y, g.u * gl.size, gl.dir, lift);
      }
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = layer(g.W, g.wy + 1);
    paintSky(state.back.getContext('2d'), g, rand);
    state.cloudsA = paintClouds(g.W, g.wy * 0.5, rand, 6, g.u);
    state.cloudsB = paintClouds(g.W, g.wy * 0.5, rand, 5, g.u * 0.7);
    state.sea = paintSea(g, rand);
    state.front = paintFront(g, rand);
    state.gulls = makeGulls(rand);
  }

  function drawClouds(ctx, g, t) {
    const w = g.W;
    const a = (t * 1.4) % w;
    const b = (t * 0.8) % w;
    ctx.drawImage(state.cloudsB, -b, g.H * 0.05);
    ctx.drawImage(state.cloudsB, w - b, g.H * 0.05);
    ctx.drawImage(state.cloudsA, -a, g.H * 0.16);
    ctx.drawImage(state.cloudsA, w - a, g.H * 0.16);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { gulls, waves } = api.props;
    const count = Math.min(MAX_GULLS, Math.round(GULLS * gulls));
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t);
    drawSea(ctx, g, t, waves);
    drawGlints(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawFoam(ctx, g, t, waves);
    drawGulls(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { gulls: 1, waves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
