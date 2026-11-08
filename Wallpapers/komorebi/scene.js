/*
 * 木漏れ日 Komorebi — midday sun through a maple canopy onto a mossy stone path.
 *
 * The garden is painted twice, once in shade and once in full sun. Each frame a
 * small mask of pool sprites reveals the sunlit copy, so moss and stone keep their
 * texture as the light moves. Leaves, shafts and dust are a short list on top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, clamp, smoothstep, parseColor, mixColor, toHex } = K;

  const HORIZON = 0.47;
  const HAZE = '#dfe8bb';
  const MOSS = ['#4f8038', '#5f9440', '#72a746', '#86b64d', '#9cc558', '#b3d268'];
  const STONE = ['#9a9c88', '#a8a892', '#b3b09a'];
  const BARK = ['#55503f', '#6b6450', '#847b60', '#a39776', '#c8b98a'];
  const LEAF_BACK = ['#b0d662', '#c4e272', '#dbec8c'];
  const LEAF_MID = ['#6fab4a', '#88bf53', '#a2cf5e'];
  const LEAF_DARK = ['#46793c', '#558b42', '#679e48'];
  const SLAB = [[1, 0], [1.08, 1.08], [0, 1], [-1.08, 1.08], [-1, 0], [-1.08, -1.08], [0, -1], [1.08, -1.08]];
  const WALL_SPOTS = 16;
  const LOBES = [[-2.25, 0.42], [-1.5, 0.72], [-0.75, 0.92], [0, 1], [0.75, 0.92], [1.5, 0.72], [2.25, 0.42]];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // s runs from 0 at the far end of the garden to 1 at the viewer.
  function depthAt(g, y) {
    return clamp((y - g.H * HORIZON) / (g.H * (1 - HORIZON)), 0, 1);
  }

  function rowAt(g, s) {
    return g.H * HORIZON + s * g.H * (1 - HORIZON);
  }

  function pathX(g, s) {
    return g.W * 0.56 + g.U * (24 * s * Math.sin(s * 5) - 10 * s * s);
  }

  function pathHalf(g, s) {
    return g.U * (1.4 + 25 * Math.pow(s, 1.25));
  }

  function hazed(hex, s) {
    const k = Math.pow(1 - s, 3) * 0.6;
    return toHex(mixColor(parseColor(hex), parseColor(HAZE), Math.round(k * 2) / 2));
  }

  function paintBackdrop(ctx, g, rand) {
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    sky.addColorStop(0, '#f1f1d0');
    sky.addColorStop(1, '#d4e2a8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    const tones = ['#b4cf8c', '#a4c47e', '#c3d99c'];
    const count = (g.W / g.U) * 2.2;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.beginPath();
      ctx.ellipse(rand() * g.W, g.H * (0.2 + rand() * 0.18), g.U * (3 + rand() * 6), g.U * (2.5 + rand() * 4), 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintWall(ctx, g) {
    const u = g.U;
    const top = g.H * 0.355;
    const foot = g.H * HORIZON + u * 0.6;
    ctx.fillStyle = '#d2cba8';
    ctx.fillRect(0, top, g.W, foot - top);
    ctx.fillStyle = '#e2dcbc';
    for (let i = 1; i <= 4; i++) ctx.fillRect(0, top + u * 2 + i * u * 1.7, g.W, Math.max(1, u * 0.5));
    ctx.fillStyle = '#9a9a84';
    ctx.fillRect(0, foot - u * 1.8, g.W, u * 1.8);
    ctx.fillStyle = '#596069';
    ctx.fillRect(0, top - u * 1.2, g.W, u * 2.4);
    ctx.fillStyle = '#7a818a';
    ctx.fillRect(0, top - u * 1.8, g.W, Math.max(1, u * 0.7));
    ctx.fillStyle = '#a79f80';
    ctx.fillRect(0, top + u * 1.2, g.W, Math.max(1, u * 0.7));
  }

  function paintGateRoof(ctx, g, x, y, w) {
    const u = g.U;
    ctx.fillStyle = '#4c5460';
    ctx.beginPath();
    ctx.moveTo(x - w * 1.12, y - u * 1.4);
    ctx.quadraticCurveTo(x - w * 0.72, y - u * 1.6, x - w * 0.46, y - u * 9);
    ctx.lineTo(x + w * 0.46, y - u * 9);
    ctx.quadraticCurveTo(x + w * 0.72, y - u * 1.6, x + w * 1.12, y - u * 1.4);
    ctx.quadraticCurveTo(x, y + u * 0.8, x - w * 1.12, y - u * 1.4);
    ctx.fill();
    ctx.fillStyle = '#6d7680';
    ctx.globalAlpha = 0.8;
    for (let i = -7; i <= 7; i++) {
      const lx = x + (i / 7) * w * 0.86;
      ctx.fillRect(lx, y - u * (6.8 - Math.abs(i) * 0.5), Math.max(1, u * 0.45), u * (6 - Math.abs(i) * 0.42));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3c434e';
    ctx.fillRect(x - w * 0.5, y - u * 10, w, u * 1.5);
  }

  function paintGate(ctx, g, x, base) {
    const u = g.U;
    const w = u * 15;
    const beam = base - u * 13.5;
    ctx.fillStyle = '#f1efcf';
    ctx.fillRect(x - w * 0.7, beam, w * 1.4, base - beam);
    ctx.fillStyle = '#b9d08e';
    ctx.fillRect(x - w * 0.34, base - u * 7, w * 0.68, u * 7);
    ctx.fillStyle = '#a84f37';
    for (const f of [-0.74, -0.32, 0.26, 0.68]) ctx.fillRect(x + f * w, beam, u * 1.3, base - beam);
    ctx.fillRect(x - w * 0.84, beam, w * 1.68, u * 1.6);
    ctx.fillRect(x - w * 0.8, beam + u * 3, w * 1.6, Math.max(1, u * 0.7));
    ctx.fillStyle = '#6e3a2c';
    ctx.fillRect(x - w * 0.84, beam + u * 1.6, w * 1.68, Math.max(1, u * 0.6));
    paintGateRoof(ctx, g, x, beam, w);
    ctx.fillStyle = '#9c9a84';
    ctx.fillRect(x - w * 0.92, base - u * 0.6, w * 1.84, u * 1.2);
  }

  function paintMoss(ctx, g) {
    const top = Math.floor(g.H * HORIZON);
    const h = g.H - top;
    const img = ctx.createImageData(g.W, h);
    const ramp = MOSS.map(parseColor);
    const haze = parseColor(HAZE);
    for (let y = 0; y < h; y++) {
      const s = (y + 0.5) / h;
      const d = s + 0.1;
      const fade = Math.round(Math.pow(1 - s, 3) * 0.55 * 2) / 2;
      for (let x = 0; x < g.W; x++) {
        const u = (x - g.W / 2) / g.U / d;
        const n = fbm(u * 0.05, 3.2 / d, 3, 11);
        const fine = noise2(u * 0.3, 16 / d, 5);
        const k = clamp((n - 0.22) / 0.44 + (fine - 0.5) * 0.16, 0, 1);
        const c = mixColor(ramp[Math.round(k * 5)], haze, fade);
        const i = (y * g.W + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, top);
  }

  function paintTufts(ctx, g, rand) {
    const count = (g.W / g.U) * 11;
    for (let i = 0; i < count; i++) {
      const s = Math.pow(rand(), 0.7);
      const x = rand() * g.W;
      const y = rowAt(g, s);
      const size = g.U * (0.5 + s * 2.6) * (0.5 + rand());
      ctx.fillStyle = hazed(MOSS[Math.floor(rand() * MOSS.length)], s);
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.55, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // A rounded slab: eight jittered points, joined through their midpoints.
  function stonePath(ctx, x, y, w, h, rand) {
    const n = SLAB.length;
    const pts = SLAB.map((p) => [x + p[0] * w * (0.92 + rand() * 0.14), y + p[1] * h * (0.9 + rand() * 0.16)]);
    ctx.beginPath();
    ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const b = pts[(i + 1) % n];
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + b[0]) / 2, (pts[i][1] + b[1]) / 2);
    }
    ctx.closePath();
  }

  function paintStone(ctx, g, rand, x, y, w, h, s) {
    const tone = STONE[Math.floor(rand() * STONE.length)];
    ctx.fillStyle = hazed('#5a6a4c', s);
    stonePath(ctx, x, y + h * 0.24, w, h, rand);
    ctx.fill();
    ctx.fillStyle = hazed(tone, s);
    stonePath(ctx, x, y, w, h, rand);
    ctx.fill();
    const marks = Math.round(2 + s * 6);
    ctx.fillStyle = hazed('#c6c2ac', s);
    for (let i = 0; i < marks; i++) {
      ctx.fillRect(x + (rand() - 0.5) * w * 1.3, y + (rand() - 0.6) * h * 1.1, Math.max(1, g.U * s * 1.6), Math.max(1, g.U * 0.4));
    }
    ctx.fillStyle = hazed('#858a76', s);
    for (let i = 0; i < marks; i++) {
      ctx.fillRect(x + (rand() - 0.5) * w * 1.3, y + (rand() - 0.3) * h * 0.9, Math.max(1, g.U * s * 1.1), Math.max(1, g.U * 0.35));
    }
  }

  function paintRow(ctx, g, rand, y, s) {
    const cx = pathX(g, s);
    const half = pathHalf(g, s);
    const rowH = g.U * (0.32 + 4.8 * s);
    let x = cx - half + (rand() - 0.5) * half * 0.16;
    const right = cx + half + (rand() - 0.5) * half * 0.16;
    while (x < right) {
      const w = Math.min(half * (0.34 + rand() * 0.5), right - x);
      if (w > g.U * 0.4) paintStone(ctx, g, rand, x + w / 2, y, (w / 2) * 0.94, rowH, s);
      x += w + g.U * (0.15 + s * 0.5);
    }
    return rowH;
  }

  function paintPath(ctx, g, rand) {
    ctx.fillStyle = '#44703f';
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) ctx.lineTo(pathX(g, i / 40) - pathHalf(g, i / 40) * 1.08, rowAt(g, i / 40));
    for (let i = 40; i >= 0; i--) ctx.lineTo(pathX(g, i / 40) + pathHalf(g, i / 40) * 1.08, rowAt(g, i / 40));
    ctx.fill();
    let y = g.H * HORIZON + g.U * 0.5;
    while (y < g.H + g.U * 4) {
      const s = depthAt(g, y);
      y += paintRow(ctx, g, rand, y, s) * 2.3;
    }
    paintPathEdge(ctx, g, rand);
  }

  // Moss creeps over the stones at both edges, so the path never has a ruled line.
  function paintPathEdge(ctx, g, rand) {
    const count = 200;
    for (let i = 0; i < count; i++) {
      const s = Math.pow(rand(), 0.6);
      const side = rand() < 0.5 ? -1 : 1;
      const x = pathX(g, s) + side * pathHalf(g, s) * (0.98 + rand() * 0.26);
      const size = g.U * (0.4 + s * 2.2) * (0.5 + rand() * 0.6);
      ctx.fillStyle = hazed(MOSS[1 + Math.floor(rand() * 5)], s);
      ctx.beginPath();
      ctx.ellipse(x, rowAt(g, s), size, size * 0.6, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function box(ctx, x, y, w, h, lit, mid, dark) {
    ctx.fillStyle = mid;
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = dark;
    ctx.fillRect(x - w / 2, y, w * 0.3, h);
    ctx.fillStyle = lit;
    ctx.fillRect(x + w * 0.3, y, w * 0.2, h);
  }

  function paintLanternRoof(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#858976';
    ctx.beginPath();
    ctx.moveTo(x - u * 10, y - u * 1.4);
    ctx.quadraticCurveTo(x - u * 6, y - u * 0.9, x - u * 1.6, y - u * 6.5);
    ctx.lineTo(x + u * 1.6, y - u * 6.5);
    ctx.quadraticCurveTo(x + u * 6, y - u * 0.9, x + u * 10, y - u * 1.4);
    ctx.quadraticCurveTo(x + u * 8, y + u * 0.8, x + u * 6.5, y + u * 0.6);
    ctx.lineTo(x - u * 6.5, y + u * 0.6);
    ctx.quadraticCurveTo(x - u * 8, y + u * 0.8, x - u * 10, y - u * 1.4);
    ctx.fill();
    ctx.fillStyle = '#b4b39b';
    ctx.beginPath();
    ctx.moveTo(x, y - u * 6.5);
    ctx.lineTo(x + u * 1.6, y - u * 6.5);
    ctx.quadraticCurveTo(x + u * 6, y - u * 0.9, x + u * 10, y - u * 1.4);
    ctx.lineTo(x + u * 3, y - u * 1);
    ctx.fill();
    ctx.fillStyle = '#7f826f';
    ctx.beginPath();
    ctx.arc(x, y - u * 8, u * 1.7, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#a7a58d';
    ctx.fillRect(x + u * 0.2, y - u * 9, u * 1, u * 1.6);
  }

  function paintLantern(ctx, g, rand, x, foot) {
    const u = g.U;
    const lit = '#cdc9ae';
    const mid = '#a2a38d';
    const dark = '#767b69';
    ctx.fillStyle = 'rgba(38,62,40,0.55)';
    ctx.beginPath();
    ctx.ellipse(x - u * 3, foot + u * 0.2, u * 12, u * 2.6, 0, 0, 6.3);
    ctx.fill();
    box(ctx, x, foot - u * 3, u * 13, u * 3.2, lit, mid, dark);
    box(ctx, x, foot - u * 5, u * 9, u * 2.2, lit, mid, dark);
    box(ctx, x, foot - u * 18, u * 4.6, u * 13.2, lit, mid, dark);
    box(ctx, x, foot - u * 12, u * 6, u * 1, lit, mid, dark);
    box(ctx, x, foot - u * 20.5, u * 11.5, u * 2.6, lit, mid, dark);
    const room = foot - u * 28;
    box(ctx, x, room, u * 8.4, u * 7.6, lit, mid, dark);
    ctx.fillStyle = '#3e4538';
    ctx.fillRect(x - u * 2.5, room + u * 1.5, u * 5, u * 4.8);
    ctx.fillStyle = mid;
    ctx.fillRect(x - u * 0.3, room + u * 1.5, u * 0.6, u * 4.8);
    paintLanternRoof(ctx, g, x, room);
    for (let i = 0; i < 60; i++) {
      const up = rand() * rand();
      ctx.fillStyle = MOSS[2 + Math.floor(rand() * 4)];
      ctx.fillRect(x + (rand() - 0.5) * u * (13 - up * 7), foot - u * (0.5 + up * 16), Math.max(1, u * (0.4 + rand())), Math.max(1, u * 0.7));
    }
    ctx.fillStyle = MOSS[4];
    for (let i = 0; i < 14; i++) ctx.fillRect(x + (rand() - 0.5) * u * 14, room - u * (0.2 + rand() * 1.8), Math.max(1, u * (0.5 + rand())), Math.max(1, u * 0.6));
  }

  function moundTop(g, x, from, peak, reach, seed) {
    const t = clamp(1 - Math.abs(x - from) / reach, 0, 1);
    return g.H - t * t * (3 - 2 * t) * peak * (0.85 + fbm(x / g.U * 0.05, seed, 3, seed) * 0.3);
  }

  function paintMound(ctx, g, rand, from, peak, reach, seed) {
    for (let band = 0; band < 3; band++) {
      ctx.fillStyle = [MOSS[0], MOSS[2], MOSS[3]][band];
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, moundTop(g, x, from, peak * (1 - band * 0.2), reach * (1 - band * 0.1), seed));
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
    const count = (reach / g.U) * 7;
    for (let i = 0; i < count; i++) {
      const x = from + (rand() - 0.5) * reach * 2;
      const top = moundTop(g, x, from, peak, reach, seed);
      const y = top + rand() * (g.H - top);
      const size = g.U * (0.6 + rand() * 2);
      ctx.fillStyle = MOSS[1 + Math.floor(rand() * 5)];
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.7, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintShrub(ctx, g, rand, x, y, w, h) {
    ctx.fillStyle = 'rgba(46,84,48,0.6)';
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.1, w * 1.1, h * 0.28, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#4c8040';
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.45, w, h * 0.62, 0, 0, 6.3);
    ctx.fill();
    const count = (w * h) / (g.U * g.U) * 1.6;
    for (let i = 0; i < count; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      const py = Math.sin(a) * d;
      const tone = clamp(Math.round((0.4 - py) * 2.2 + rand() - 0.5), 0, 5);
      ctx.fillStyle = MOSS[tone];
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * d * w * 0.97, y - h * 0.45 + py * h * 0.6, g.U * (0.5 + rand()), g.U * (0.4 + rand() * 0.6), 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintShrubs(ctx, g, rand) {
    const u = g.U;
    const list = [[0.04, 10, 7], [0.2, 9, 6], [0.27, 6.5, 4.5], [0.4, 7, 4.6], [0.7, 6, 4], [0.87, 10, 6.5], [0.97, 8, 6]];
    for (const [f, w, h] of list) paintShrub(ctx, g, rand, g.W * f, rowAt(g, 0.09 + (w % 3) * 0.015), u * w, u * h);
  }

  function paintFern(ctx, g, x, y, len, ang, tone) {
    const steps = 18;
    const bend = ang < -1.57 ? -1 : 1;
    ctx.strokeStyle = tone;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const a = ang + f * f * bend * 0.9;
      const along = ang + f * f * bend * 0.45;
      const px = x + Math.cos(along) * len * f;
      const py = y + Math.sin(along) * len * f;
      const leaf = g.U * 6.5 * Math.sin(Math.min(1, f * 1.15 + 0.1) * 3.14) + g.U * 0.4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a + side * 1.05) * leaf, py + Math.sin(a + side * 1.05) * leaf);
        ctx.stroke();
      }
    }
  }

  function paintFerns(ctx, g, rand) {
    const u = g.U;
    const tones = ['#9ccb5c', '#bcdc70', '#d0e784', '#aed566'];
    const rx = g.W * 0.93;
    for (let i = 0; i < 7; i++) {
      const ang = -2.75 + i * 0.27 + (rand() - 0.5) * 0.1;
      paintFern(ctx, g, rx + (i - 3) * u, g.H + u * 2, u * (26 + rand() * 12), ang, tones[i % 4]);
    }
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBackdrop(ctx, g, rand);
    paintWall(ctx, g);
    paintGate(ctx, g, pathX(g, 0), g.H * HORIZON + g.U * 0.6);
    paintMoss(ctx, g);
    paintTufts(ctx, g, rand);
    paintShrubs(ctx, g, rand);
    paintPath(ctx, g, rand);
    paintLantern(ctx, g, rand, g.W * 0.77, g.H * 0.74);
    paintMound(ctx, g, rand, g.W * 0.98, g.U * 22, g.U * 46, 3);
    paintMound(ctx, g, rand, 0, g.U * 16, g.U * 34, 7);
    paintFerns(ctx, g, rand);
    return c;
  }

  function paintLit(world, g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(world, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#303a12';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = '#efe486';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintPool(rand) {
    const c = layer(48, 48);
    const ctx = c.getContext('2d');
    const blobs = 3 + Math.floor(rand() * 7);
    for (let i = 0; i < blobs; i++) {
      const r = 5 + rand() * 11;
      const x = 24 + (rand() - 0.5) * (40 - r * 2);
      const y = 24 + (rand() - 0.5) * (40 - r * 2);
      const d = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
      d.addColorStop(0, 'rgba(255,255,255,1)');
      d.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = d;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  }

  function placeSpot(g, rand, o, i, cluster, cx, cs) {
    const s = clamp(cs + (rand() - 0.5) * 0.2, 0.02, 1);
    const big = rand() * rand();
    const w = g.U * (2.4 + big * 22) * (0.36 + s * 0.78);
    o.x[i] = cx + (rand() - 0.5) * g.U * (10 + s * 46);
    o.y[i] = rowAt(g, s);
    o.w[i] = w;
    o.h[i] = w * (0.34 + s * 0.16);
    o.a[i] = 0.62 + rand() * 0.38;
    o.rate[i] = 0.14 + rand() * 0.34;
    o.phase[i] = rand() * 6.283;
    o.sprite[i] = Math.floor(rand() * state.pools.length);
    o.cluster[i] = cluster;
  }

  function placeWallSpot(g, rand, o, i, cluster) {
    const w = g.U * (2.4 + rand() * 5);
    o.x[i] = rand() * g.W;
    o.y[i] = g.H * (0.36 + rand() * 0.08);
    o.w[i] = w;
    o.h[i] = w * 0.8;
    o.a[i] = 0.5 + rand() * 0.4;
    o.rate[i] = 0.14 + rand() * 0.3;
    o.phase[i] = rand() * 6.283;
    o.sprite[i] = Math.floor(rand() * state.pools.length);
    o.cluster[i] = cluster;
  }

  function makeSpots(g, rand) {
    const clusters = Math.round(clamp((g.W / g.U) * 0.16, 16, 44));
    const perCluster = 13;
    const n = clusters * perCluster + WALL_SPOTS;
    const o = {
      n, clusters,
      x: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n), h: new Float32Array(n),
      a: new Float32Array(n), rate: new Float32Array(n), phase: new Float32Array(n),
      sprite: new Uint8Array(n), cluster: new Uint8Array(n),
      ox: new Float32Array(clusters), oy: new Float32Array(clusters),
      cAmp: new Float32Array(clusters), cRate: new Float32Array(clusters), cPhase: new Float32Array(clusters),
    };
    for (let c = 0; c < clusters; c++) {
      const cs = 0.05 + Math.pow((c + rand()) / clusters, 0.8) * 0.95;
      const nearPath = rand() < 0.5;
      const cx = nearPath ? pathX(g, cs) + (rand() - 0.5) * pathHalf(g, cs) * 2 : rand() * g.W;
      o.cAmp[c] = g.U * (1.4 + cs * 10);
      o.cRate[c] = 0.05 + rand() * 0.08;
      o.cPhase[c] = rand() * 6.283;
      for (let k = 0; k < perCluster; k++) placeSpot(g, rand, o, c * perCluster + k, c, cx, cs);
    }
    for (let i = n - WALL_SPOTS; i < n; i++) placeWallSpot(g, rand, o, i, i % clusters);
    return o;
  }

  function trunkEdge(g, base, x, lean, y) {
    const up = 1 - y / base;
    return x + lean * up * up + (fbm(y / g.U * 0.05, x * 0.01, 2, 4) - 0.5) * g.U * 3;
  }

  function trunkWidth(g, base, w0, y) {
    const up = 1 - y / base;
    return w0 * (0.62 + 0.38 * (1 - up)) + g.U * 6 * Math.pow(smoothstep(0.14, 0, up), 2) * (w0 / (g.U * 12));
  }

  function paintTrunk(ctx, g, x, base, w0, lean) {
    const step = Math.max(1, Math.round(g.U * 0.5));
    for (let y = 0; y < base; y += step) {
      const mid = trunkEdge(g, base, x, lean, y);
      const w = trunkWidth(g, base, w0, y);
      for (let px = Math.floor(mid - w / 2); px < mid + w / 2; px++) {
        const across = (px - (mid - w / 2)) / w;
        const grain = noise2(px / g.U * 0.32, y / g.U * 0.05, 8);
        const low = smoothstep(base * 0.55, base, y);
        const tone = clamp(Math.round(across * across * 4 + (grain - 0.5) * 1.8), 0, 4);
        const moss = low * (1.1 - across) * noise2(px / g.U * 0.25, y / g.U * 0.25, 9);
        ctx.fillStyle = moss > 0.42 ? MOSS[Math.round(moss * 4)] : BARK[tone];
        ctx.fillRect(px, y, 1, step);
      }
    }
  }

  function limb(ctx, x0, y0, cx, cy, x1, y1, width) {
    ctx.strokeStyle = BARK[0];
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, width);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
    ctx.strokeStyle = BARK[3];
    ctx.lineWidth = Math.max(1, width * 0.22);
    ctx.beginPath();
    ctx.moveTo(x0 + width * 0.2, y0 + width * 0.3);
    ctx.quadraticCurveTo(cx, cy + width * 0.3, x1, y1);
    ctx.stroke();
  }

  function paintTrunks(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const lx = g.W * 0.13;
    ctx.fillStyle = 'rgba(34,58,38,0.5)';
    ctx.beginPath();
    ctx.ellipse(lx + u * 3, g.H * 0.86, u * 18, u * 3.4, 0, 0, 6.3);
    ctx.ellipse(g.W * 0.9, g.H * 0.645, u * 9, u * 1.8, 0, 0, 6.3);
    ctx.fill();
    limb(ctx, lx + u * 3, g.H * 0.4, lx + u * 16, g.H * 0.28, lx + u * 34, g.H * 0.08, u * 3.8);
    limb(ctx, lx + u * 2, g.H * 0.26, lx + u * 8, g.H * 0.16, lx + u * 16, 0, u * 2.6);
    limb(ctx, g.W * 0.9, g.H * 0.3, g.W * 0.9 - u * 12, g.H * 0.22, g.W * 0.9 - u * 26, g.H * 0.04, u * 2.4);
    paintTrunk(ctx, g, g.W * 0.33, g.H * 0.535, u * 2.6, u * 5);
    paintTrunk(ctx, g, g.W * 0.9, g.H * 0.65, u * 6.5, u * -5);
    paintTrunk(ctx, g, lx, g.H * 0.87, u * 13, u * 7);
    return c;
  }

  function mapleLeaf(ctx, x, y, r, rot) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const lobe of LOBES) {
      const a = rot + lobe[0];
      ctx.lineTo(x + Math.cos(a - 0.36) * r * 0.36, y + Math.sin(a - 0.36) * r * 0.36);
      ctx.lineTo(x + Math.cos(a) * r * lobe[1], y + Math.sin(a) * r * lobe[1]);
    }
    const end = rot + 2.25 + 0.36;
    ctx.lineTo(x + Math.cos(end) * r * 0.3, y + Math.sin(end) * r * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  function canopyEdge(g, x) {
    const f = x / g.W - 0.56;
    const n = fbm(x / g.U * 0.045, 2.5, 3, 21);
    return g.H * (0.1 + Math.pow(Math.abs(f), 1.5) * 0.66 + n * 0.16);
  }

  function paintFoliage(g, rand, o) {
    const c = layer(g.W + g.M * 2, g.H * 0.8);
    const ctx = c.getContext('2d');
    const count = (c.width / g.U) * 80 * o.density;
    for (let i = 0; i < count; i++) {
      const x = rand() * c.width;
      const y = rand() * c.height;
      if (y > canopyEdge(g, x - g.M) + o.reach * g.U) continue;
      const n = fbm(x / g.U * 0.055, y / g.U * 0.08, 3, o.seed);
      if (n < o.gate) continue;
      ctx.fillStyle = o.tones[clamp(Math.round((n - o.gate) * 6 + rand() * 1.2 - 0.6), 0, 2)];
      mapleLeaf(ctx, x, y, g.U * (o.r + rand() * o.dr), rand() * 6.283);
    }
    return c;
  }

  function paintSpray(g, rand, tones) {
    const u = g.U;
    const c = layer(u * 44, u * 40);
    const ctx = c.getContext('2d');
    const ax = c.width / 2;
    const leaves = 7 + Math.floor(rand() * 4);
    const droop = (rand() - 0.5) * u * 18;
    ctx.strokeStyle = BARK[1];
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.quadraticCurveTo(ax + droop * 0.2, u * 16, ax + droop, u * 28);
    ctx.stroke();
    for (let i = 0; i < leaves; i++) {
      const f = (i + 0.6) / leaves;
      const px = ax + droop * f * f + (i % 2 ? 1 : -1) * u * (3 + rand() * 7);
      const py = f * u * 30 + u * rand() * 2;
      const r = u * (5 + rand() * 3);
      const rot = 1.57 + (rand() - 0.5) * 1.1;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      mapleLeaf(ctx, px, py, r, rot);
      ctx.strokeStyle = BARK[1];
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = Math.max(1, u * 0.22);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(rot) * r * 0.75, py + Math.sin(rot) * r * 0.75);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function makeSprays(g, rand) {
    const sprites = [];
    const sets = [LEAF_MID, LEAF_BACK, LEAF_DARK, LEAF_MID, LEAF_BACK];
    for (const tones of sets) sprites.push(paintSpray(g, rand, tones));
    const spots = [0.02, 0.1, 0.19, 0.29, 0.41, 0.69, 0.8, 0.9, 0.98];
    return spots.map((f, i) => ({
      x: f * g.W,
      y: -g.U * (6 + (i % 3) * 3),
      sprite: sprites[i % sprites.length],
      rate: 0.22 + rand() * 0.2,
      phase: rand() * 6.283,
    }));
  }

  function paintShaft() {
    const c = layer(24, 160);
    const ctx = c.getContext('2d');
    const across = ctx.createLinearGradient(0, 0, 24, 0);
    across.addColorStop(0, 'rgba(255,242,184,0)');
    across.addColorStop(0.5, 'rgba(255,242,184,1)');
    across.addColorStop(1, 'rgba(255,242,184,0)');
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, 24, 160);
    ctx.globalCompositeOperation = 'destination-in';
    const along = ctx.createLinearGradient(0, 0, 0, 160);
    along.addColorStop(0, 'rgba(0,0,0,0)');
    along.addColorStop(0.18, 'rgba(0,0,0,1)');
    along.addColorStop(0.7, 'rgba(0,0,0,0.8)');
    along.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = along;
    ctx.fillRect(0, 0, 24, 160);
    return c;
  }

  // Sun rays are close to parallel: one slant, each shaft nudged a little off it.
  function makeShafts(g, rand) {
    const feet = [0.16, 0.24, 0.3, 0.39, 0.46, 0.55, 0.62, 0.72];
    return feet.map((f, i) => {
      const fy = g.H * (0.68 + (i % 3) * 0.12);
      const lean = 0.36 + (rand() - 0.5) * 0.05;
      const top = g.H * (0.06 + rand() * 0.1);
      const dy = fy - top;
      return {
        x: g.W * f + dy * lean,
        y: top,
        len: Math.hypot(dy * lean, dy),
        rot: Math.atan2(dy, -dy * lean) - Math.PI / 2,
        width: g.U * (1.4 + rand() * 3.6),
        a: 0.2 + rand() * 0.18,
        rate: 0.09 + rand() * 0.13,
        phase: rand() * 6.283,
      };
    });
  }

  function makeDust(g, rand) {
    const n = Math.round(clamp((g.W / g.U) * 0.6, 60, 180));
    const o = {
      n,
      x: new Float32Array(n), y: new Float32Array(n), a: new Float32Array(n),
      rate: new Float32Array(n), phase: new Float32Array(n), rise: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) {
      const shaft = state.shafts[i % state.shafts.length];
      const f = rand() * 0.9;
      o.x[i] = shaft.x - Math.sin(shaft.rot) * shaft.len * f + (rand() - 0.5) * g.U * 7;
      o.y[i] = shaft.y + Math.cos(shaft.rot) * shaft.len * f;
      o.a[i] = 0.4 + rand() * 0.6;
      o.rate[i] = 0.12 + rand() * 0.3;
      o.phase[i] = rand() * 6.283;
      o.rise[i] = g.U * (0.15 + rand() * 0.3);
    }
    return o;
  }

  function drawLight(ctx, g, t, api) {
    const o = state.spots;
    const m = state.maskCtx;
    const light = api.props.light;
    const sway = api.props.breeze;
    for (let c = 0; c < o.clusters; c++) {
      const a = t * o.cRate[c] + o.cPhase[c];
      o.ox[c] = Math.sin(a) * o.cAmp[c] * sway;
      o.oy[c] = Math.sin(a * 0.73 + 1.3) * o.cAmp[c] * 0.3 * sway;
    }
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, g.W, g.H);
    for (let i = 0; i < o.n; i++) {
      const alpha = (o.a[i] + 0.75 * Math.sin(t * o.rate[i] + o.phase[i])) * light;
      if (alpha < 0.02) continue;
      const c = o.cluster[i];
      m.globalAlpha = alpha > 1 ? 1 : alpha;
      m.drawImage(state.pools[o.sprite[i]], o.x[i] + o.ox[c], o.y[i] + o.oy[c], o.w[i], o.h[i]);
    }
    m.globalAlpha = 1;
    m.globalCompositeOperation = 'source-in';
    m.drawImage(state.lit, 0, 0);
    ctx.drawImage(state.mask, 0, 0);
  }

  function drawShafts(ctx, g, t, sway) {
    ctx.globalCompositeOperation = 'lighter';
    for (const s of state.shafts) {
      ctx.globalAlpha = s.a * (0.66 + 0.34 * Math.sin(t * s.rate + s.phase));
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot + Math.sin(t * s.rate * 0.7 + s.phase) * 0.012 * sway);
      ctx.drawImage(state.shaft, -s.width / 2, 0, s.width, s.len);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawCanopy(ctx, g, t, sway) {
    const u = g.U * sway;
    // Whole cells only: a fractional offset would blur the leaves and muddy the palette.
    ctx.drawImage(state.back, Math.round(-g.M + Math.sin(t * 0.21) * u * 0.8), Math.round(Math.sin(t * 0.17) * u * 0.3));
    ctx.drawImage(state.mid, Math.round(-g.M + Math.sin(t * 0.27 + 1) * u * 1.4), Math.round(Math.sin(t * 0.19 + 2) * u * 0.5));
    ctx.drawImage(state.dark, Math.round(-g.M + Math.sin(t * 0.33 + 2) * u * 2), Math.round(Math.sin(t * 0.23 + 4) * u * 0.7));
    for (const s of state.sprays) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.sin(t * s.rate + s.phase) * 0.05 * sway);
      ctx.drawImage(s.sprite, -s.sprite.width / 2, 0);
      ctx.restore();
    }
  }

  function drawDust(ctx, g, t, amount) {
    const o = state.dust;
    if (amount <= 0) return;
    const size = Math.max(1, Math.round(g.U * 0.7));
    const span = g.H * 0.9;
    ctx.fillStyle = '#fff4c6';
    for (let i = 0; i < o.n; i++) {
      const a = o.a[i] * (0.55 + 0.45 * Math.sin(t * o.rate[i] + o.phase[i])) * amount;
      if (a < 0.03) continue;
      const y = ((o.y[i] - t * o.rise[i]) % span + span) % span;
      ctx.globalAlpha = a > 1 ? 1 : a;
      ctx.fillRect(Math.round(o.x[i] + Math.sin(t * o.rate[i] * 0.8 + o.phase[i]) * g.U * 2.2), Math.round(y), size, size);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100, M: Math.ceil(api.rows * 0.05) };
    const rand = K.rng(api.seed);
    state.g = g;
    state.world = paintWorld(g, rand);
    state.lit = paintLit(state.world, g);
    state.mask = layer(g.W, g.H);
    state.maskCtx = state.mask.getContext('2d');
    state.pools = [];
    for (let i = 0; i < 7; i++) state.pools.push(paintPool(rand));
    state.spots = makeSpots(g, rand);
    state.trunks = paintTrunks(g);
    state.back = paintFoliage(g, rand, { tones: LEAF_BACK, density: 0.34, reach: 0, gate: 0.34, r: 1.5, dr: 1.6, seed: 31 });
    state.mid = paintFoliage(g, rand, { tones: LEAF_MID, density: 0.3, reach: -2, gate: 0.46, r: 1.8, dr: 1.9, seed: 37 });
    state.dark = paintFoliage(g, rand, { tones: LEAF_DARK, density: 0.2, reach: -7, gate: 0.53, r: 2, dr: 2.2, seed: 41 });
    state.sprays = makeSprays(g, rand);
    state.shaft = paintShaft();
    state.shafts = makeShafts(g, rand);
    state.dust = makeDust(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const sway = api.props.breeze;
    ctx.drawImage(state.world, 0, 0);
    drawLight(ctx, g, t, api);
    ctx.drawImage(state.trunks, 0, 0);
    drawCanopy(ctx, g, t, sway);
    drawShafts(ctx, g, t, sway);
    drawDust(ctx, g, t, api.props.dust);
  }

  Kasuri.run({
    defaults: { light: 1, breeze: 1, dust: 1, ramp: 'lines', cell: 7, boost: 0.3, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
