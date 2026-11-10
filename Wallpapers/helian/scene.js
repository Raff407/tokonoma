/*
 * 荷莲 Helian — a lotus pond in light rain.
 *
 * Bank, hills, pavilion and rock are baked once, then the water with a faint reflection.
 * Leaves and tall plants are small baked sprites that bob or shear a little. Rain is a
 * short pool of streaks; each one that lands starts a ring from a reused ring pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#b9c0b2', '#c9cdbb', '#d9d6c0'];
  const HILL = ['#a4b2ae', '#869a9a'];
  const WATER = ['#6a8078', '#4f6e66', '#3d5d55', '#2d4a45'];
  const LEAF_TONES = [
    ['#3a5c44', '#5b8458', '#8fb27a'],
    ['#45694c', '#6e9566', '#a3c088'],
    ['#33564f', '#518070', '#7fa896'],
    ['#5c6e3a', '#82964f', '#b0b872'],
  ];
  const PETAL_BASE = '#eadfcc';
  const PETAL_TIP = '#c4706a';
  const PETAL_DARK = '#a85a58';
  const STEM = '#3a5a45';
  const STEM_LIT = '#5f8060';
  const RAIN_MAX = 60;
  const RIPPLES = 56;
  const RIPPLE_LIFE = 1.5;
  const STREAKS = 44;
  const FLOATERS = 13;
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
    return { W, H, U, wy: Math.round(H * 0.3) };
  }

  // ---- far bank --------------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, SKY[0]);
    grad.addColorStop(0.6, SKY[1]);
    grad.addColorStop(1, SKY[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy + 1);
  }

  function ridge(ctx, g, seed, base, amp, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, base + fbm(x / (g.U * 34), 2.2, 3, seed) * amp);
    }
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
  }

  // One roof with raised corners: flat run at the middle, tips swept up.
  function roof(ctx, g, cx, ye, hw, rise, ink, lit) {
    const U = g.U;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(cx - hw, ye - U * 2.4);
    ctx.quadraticCurveTo(cx - hw * 0.78, ye + U * 0.3, cx - hw * 0.45, ye + U * 0.1);
    ctx.lineTo(cx + hw * 0.45, ye + U * 0.1);
    ctx.quadraticCurveTo(cx + hw * 0.78, ye + U * 0.3, cx + hw, ye - U * 2.4);
    ctx.quadraticCurveTo(cx + hw * 0.6, ye - U * 1.6, cx + hw * 0.22, ye - rise);
    ctx.lineTo(cx - hw * 0.22, ye - rise);
    ctx.quadraticCurveTo(cx - hw * 0.6, ye - U * 1.6, cx - hw, ye - U * 2.4);
    ctx.fill();
    ctx.strokeStyle = lit;
    ctx.lineWidth = Math.max(1, U * 0.22);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * hw * 0.08, ye - rise + U * 0.4);
      ctx.lineTo(cx + i * hw * 0.34, ye - U * 0.4);
      ctx.stroke();
    }
    ctx.fillStyle = '#242d30';
    ctx.fillRect(cx - hw * 0.45, ye + U * 0.1, hw * 0.9, U * 0.7);
    ctx.fillStyle = lit;
    ctx.fillRect(cx - hw * 0.24, ye - rise - U * 0.5, hw * 0.48, U * 0.6);
  }

  function pavilion(ctx, g, cx, by) {
    const U = g.U;
    const hw = U * 9.5;
    const ye = by - U * 8;
    ctx.fillStyle = '#c9c4b0';
    ctx.fillRect(cx - U * 7.2, by - U * 1.6, U * 14.4, U * 1.6);
    ctx.fillStyle = '#8f8c7c';
    ctx.fillRect(cx - U * 7.2, by - U * 1.6, U * 14.4, Math.max(1, U * 0.3));
    ctx.fillStyle = '#3a2d29';
    ctx.fillRect(cx - U * 5.4, by - U * 6.6, U * 10.8, U * 4.9);
    ctx.fillStyle = '#6b3a30';
    ctx.fillRect(cx - U * 5.4, by - U * 3.8, U * 10.8, Math.max(1, U * 0.5));
    ctx.fillStyle = '#9a4234';
    const pw = Math.max(1, U * 0.9);
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - U * 5.4 + i * U * 3.6 - pw / 2, ye + U * 0.6, pw, by - ye - U * 2.2);
    roof(ctx, g, cx, ye, hw, U * 4.6, '#4d5b61', '#7d8c8e');
    ctx.fillStyle = '#9a4234';
    ctx.fillRect(cx - U * 2.6, ye - U * 7.4, U * 5.2, U * 3);
    roof(ctx, g, cx, ye - U * 7.4, hw * 0.58, U * 3.8, '#44525a', '#7d8c8e');
    ctx.fillStyle = '#b08f45';
    blob(ctx, cx, ye - U * 12.2, U * 0.7, U * 0.7);
    ctx.fillRect(cx - U * 0.15, ye - U * 12, Math.max(1, U * 0.3), U * 0.7);
  }

  // A weathered garden rock with holes through it.
  function taihu(ctx, g, rand, x, by, s) {
    const pts = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const wob = 0.7 + rand() * 0.5;
      pts.push([x + Math.cos(a) * s * 0.55 * wob, by + Math.sin(a) * s * 1.2 * (0.65 + rand() * 0.45)]);
    }
    ctx.fillStyle = '#6e7a78';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, by);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(x + s * 0.6, by);
    ctx.fill();
    ctx.fillStyle = '#9ba39c';
    blob(ctx, x - s * 0.2, by - s * 0.7, s * 0.16, s * 0.4);
    blob(ctx, x - s * 0.1, by - s * 0.2, s * 0.12, s * 0.3);
    ctx.fillStyle = '#2f3b3a';
    blob(ctx, x + s * 0.1, by - s * 0.55, s * 0.12, s * 0.17);
    blob(ctx, x - s * 0.05, by - s * 0.95, s * 0.08, s * 0.1);
    blob(ctx, x + s * 0.2, by - s * 0.2, s * 0.09, s * 0.12);
  }

  function paintBank(ctx, g, rand) {
    const U = g.U;
    ctx.fillStyle = '#34463a';
    ctx.fillRect(0, g.wy - U * 1.8, g.W, U * 1.8 + 1);
    for (let x = 0; x < g.W; x += U * (1.6 + rand() * 2.4)) {
      const r = U * (1.2 + rand() * 1.5);
      ctx.fillStyle = '#2b3d30';
      blob(ctx, x, g.wy - U * 1.6, r, r * 0.55);
      ctx.fillStyle = '#4a6446';
      blob(ctx, x - r * 0.3, g.wy - U * 1.8 - r * 0.2, r * 0.5, r * 0.2);
    }
    for (let x = 0; x < g.W; x += U * (1.4 + rand() * 2.8)) {
      ctx.fillStyle = rand() < 0.5 ? '#7a7c70' : '#9a9888';
      blob(ctx, x, g.wy - U * 0.4, U * (0.5 + rand() * 0.9), U * 0.4);
    }
  }

  function paintTrunk(ctx, g, tx, ty) {
    const U = g.U;
    ctx.strokeStyle = '#3a3128';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, U * 1.7);
    ctx.beginPath();
    ctx.moveTo(tx + U * 1.5, g.wy);
    ctx.quadraticCurveTo(tx - U * 0.8, (ty + g.wy) / 2, tx, ty);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, U * 0.9);
    ctx.beginPath();
    ctx.moveTo(tx, ty + U * 1.5);
    ctx.quadraticCurveTo(tx + U * 5, ty + U * 0.5, tx + U * 11, ty + U * 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty + U * 2);
    ctx.quadraticCurveTo(tx - U * 4, ty + U * 1, tx - U * 9, ty + U * 4.5);
    ctx.stroke();
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    ridge(ctx, g, 7, g.wy - g.U * 17, g.U * 9, HILL[0]);
    ridge(ctx, g, 19, g.wy - g.U * 9, g.U * 6, HILL[1]);
    const px = g.W * 0.74;
    pavilion(ctx, g, px, g.wy - g.U * 0.4);
    taihu(ctx, g, rand, g.W * 0.57, g.wy - g.U * 0.6, g.U * 8);
    taihu(ctx, g, rand, g.W * 0.92, g.wy - g.U * 0.6, g.U * 5);
    paintBank(ctx, g, rand);
    paintTrunk(ctx, g, g.W * 0.1, g.wy - g.U * 24);
    return c;
  }

  // Willow strands hang from the top of the trunk; this sprite shears from its top edge.
  function paintWillow(g, rand) {
    const U = g.U;
    const tx = g.W * 0.1;
    const ty = g.wy - U * 24;
    const w = Math.ceil(U * 44);
    const h = Math.ceil(U * 36);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const ox = tx - w / 2;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, U * 0.24);
    const inks = ['#5f7f58', '#7f9a68', '#486a4c'];
    for (let i = 0; i < 46; i++) {
      const sx = tx + (rand() - 0.5) * U * 26 - ox;
      const sy = U * 1.2 + rand() * U * 3 + Math.abs(sx - w / 2) * 0.05;
      const len = U * (9 + rand() * 20);
      ctx.strokeStyle = inks[i % 3];
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + (rand() - 0.5) * U * 2.4, sy + len * 0.5, sx + (rand() - 0.5) * U * 3, sy + len);
      ctx.stroke();
    }
    return { c, x: ox, y: ty, ay: ty, ph: 1.3 };
  }

  // ---- water -----------------------------------------------------------------

  function paintWater(g, rand) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, WATER[0]);
    grad.addColorStop(0.18, WATER[1]);
    grad.addColorStop(0.55, WATER[2]);
    grad.addColorStop(1, WATER[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, h);
    const R = Math.min(h, g.U * 26);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.setTransform(1, 0, 0, -1, 0, 0);
    ctx.drawImage(state.back, 0, g.wy - R, g.W, R, 0, -R, g.W, R);
    ctx.restore();
    for (let i = 0; i < 140; i++) {
      const d = rand();
      ctx.globalAlpha = 0.1 + rand() * 0.12;
      ctx.fillStyle = rand() < 0.5 ? '#0f1c1d' : '#8aa092';
      ctx.fillRect(rand() * g.W, d * h, g.U * (2 + rand() * 7 * (0.3 + d)), Math.max(1, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function makeShimmer(g, rand) {
    const f = () => new Float32Array(STREAKS);
    const s = { x: f(), y: f(), l: f(), p: f() };
    for (let i = 0; i < STREAKS; i++) {
      const d = Math.pow(rand(), 1.3);
      s.x[i] = rand() * g.W;
      s.y[i] = g.wy + g.U * 1 + d * (g.H - g.wy - g.U);
      s.l[i] = g.U * (2 + d * 7) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawShimmer(ctx, g, t) {
    const s = state.shimmer;
    const thick = Math.max(1, g.U * 0.32);
    ctx.fillStyle = '#c3cdbb';
    for (let i = 0; i < STREAKS; i++) {
      const a = Math.sin(t * 0.45 + s.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.3;
      const x = ((s.x[i] + t * g.U * 0.35) % (g.W + s.l[i] * 2)) - s.l[i];
      ctx.fillRect(x, s.y[i], s.l[i], thick);
    }
    ctx.globalAlpha = 1;
  }

  // ---- lotus -------------------------------------------------------------------

  // A round peltate leaf: dark rim, lighter dish, radial veins, one slit, a few beads of water.
  function drawLeaf(ctx, cx, cy, r, ratio, tone, rand, rot, U) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = tone[0];
    blob(ctx, 0, r * ratio * 0.05, r, r * ratio);
    ctx.fillStyle = tone[1];
    blob(ctx, -r * 0.04, -r * ratio * 0.06, r * 0.9, r * ratio * 0.88);
    ctx.fillStyle = tone[2];
    blob(ctx, -r * 0.1, -r * ratio * 0.14, r * 0.45, r * ratio * 0.4);
    ctx.save();
    ctx.scale(1, ratio);
    ctx.strokeStyle = tone[0];
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, U * 0.22);
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand() * 0.15;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = tone[2];
    blob(ctx, 0, 0, Math.max(1, r * 0.07), Math.max(1, r * ratio * 0.07));
    ctx.globalCompositeOperation = 'destination-out';
    const a = rand() * TAU;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - 0.09) * r * 1.2, Math.sin(a - 0.09) * r * ratio * 1.2);
    ctx.lineTo(Math.cos(a + 0.09) * r * 1.2, Math.sin(a + 0.09) * r * ratio * 1.2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#dbd9c6';
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 3; i++) blob(ctx, (rand() - 0.5) * r * 0.9, (rand() - 0.5) * r * ratio * 0.9, Math.max(1, U * 0.5), Math.max(0.8, U * 0.3));
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function leafSprite(g, rand, r, ratio) {
    const w = Math.ceil(r * 2 + 6);
    const h = Math.ceil(r * ratio * 2 + 8);
    const c = layer(w, h);
    const tone = LEAF_TONES[Math.floor(rand() * LEAF_TONES.length)];
    drawLeaf(c.getContext('2d'), w / 2, h / 2, r, ratio, tone, rand, 0, g.U);
    return c;
  }

  function petal(ctx, len, wid, rot, c0, c1) {
    ctx.save();
    ctx.rotate(rot);
    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.72, 0, -len);
    ctx.bezierCurveTo(-wid * 0.8, -len * 0.72, -wid, -len * 0.25, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function bud(ctx, x, y, s, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    petal(ctx, s * 1.0, s * 0.42, -0.2, '#d8b6a4', PETAL_DARK);
    petal(ctx, s * 1.0, s * 0.42, 0.2, '#d8b6a4', PETAL_DARK);
    petal(ctx, s * 1.08, s * 0.4, 0, PETAL_BASE, PETAL_TIP);
    ctx.fillStyle = STEM;
    blob(ctx, 0, 0, s * 0.24, s * 0.14);
    ctx.restore();
  }

  function flower(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    const back = [-1.15, 1.15, -0.8, 0.8];
    for (const r of back) petal(ctx, s * 0.95, s * 0.4, r, '#dcc2b0', PETAL_DARK);
    for (const r of [-0.42, 0.42]) petal(ctx, s * 1.08, s * 0.42, r, '#e6d3c0', '#bd6a66');
    petal(ctx, s * 1.15, s * 0.44, 0, PETAL_BASE, PETAL_TIP);
    ctx.fillStyle = '#c8a24a';
    blob(ctx, 0, -s * 0.12, s * 0.2, s * 0.09);
    ctx.fillStyle = STEM;
    blob(ctx, 0, 0, s * 0.26, s * 0.13);
    ctx.restore();
  }

  function stem(ctx, g, x0, y0, x1, y1) {
    const U = g.U;
    ctx.lineCap = 'round';
    ctx.strokeStyle = STEM;
    ctx.lineWidth = Math.max(2, U * 1.1);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(lerp(x0, x1, 0.2), (y0 + y1) / 2, x1, y1);
    ctx.stroke();
    ctx.strokeStyle = STEM_LIT;
    ctx.lineWidth = Math.max(1, U * 0.3);
    ctx.beginPath();
    ctx.moveTo(x0 - U * 0.15, y0);
    ctx.quadraticCurveTo(lerp(x0, x1, 0.2) - U * 0.15, (y0 + y1) / 2, x1 - U * 0.15, y1);
    ctx.stroke();
  }

  // A standing plant: stem from the waterline up to a flower, bud or leaf. Bounds are local.
  function plant(g, rand, o) {
    const U = g.U;
    const R = Math.ceil(U * 16 + Math.abs(o.lean));
    const x0 = Math.floor(o.x - R);
    const y0 = Math.floor(o.top - U * 16);
    const c = layer(R * 2, o.base - y0 + U * 3);
    const ctx = c.getContext('2d');
    ctx.translate(-x0, -y0);
    const hx = o.x + o.lean;
    stem(ctx, g, o.x, o.base, hx, o.top);
    if (o.head === 'bud') bud(ctx, hx, o.top, U * o.size, o.lean * 0.012);
    if (o.head === 'buds') {
      const mx = lerp(o.x, hx, 0.55) - U * 3;
      stem(ctx, g, lerp(o.x, hx, 0.25), lerp(o.base, o.top, 0.4), mx, o.top + U * 11);
      bud(ctx, mx, o.top + U * 11, U * o.size * 0.8, -0.15);
      bud(ctx, hx, o.top, U * o.size, 0.1);
    }
    if (o.head === 'flower') flower(ctx, hx, o.top, U * o.size);
    if (o.head === 'leaf') drawLeaf(ctx, hx, o.top, U * o.size, 0.62, LEAF_TONES[o.tone], rand, o.rot, U);
    ctx.strokeStyle = '#a8b8a8';
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1, U * 0.25);
    ctx.beginPath();
    ctx.ellipse(o.x, o.base, U * 2.4, U * 0.8, 0, 0, TAU);
    ctx.stroke();
    return { c, x: x0, y: y0, ay: o.base, ph: o.ph, y2: o.base };
  }

  function makeScene(g, rand) {
    const U = g.U;
    const W = g.W;
    const H = g.H;
    const items = [];
    const placed = [];
    for (let i = 0, tries = 0; i < FLOATERS && tries < 400; tries++) {
      const d = Math.pow(rand(), 0.8);
      const y = g.wy + H * 0.06 + d * (H * 0.98 - g.wy - H * 0.06);
      const r = U * (2.4 + d * 11);
      const x = rand() * W;
      if (placed.some((p) => Math.hypot(p[0] - x, (p[1] - y) * 2) < (p[2] + r) * 0.8)) continue;
      placed.push([x, y, r]);
      const ratio = 0.3 + d * 0.22;
      items.push({ kind: 0, c: leafSprite(g, rand, r, ratio), x: x - r - 3, y: y - r * ratio - 4, ph: rand() * TAU, key: y, amp: 1 });
      i++;
    }
    const specs = [
      { x: W * 0.64, top: H * 0.4, base: H * 0.62, lean: U * 2, head: 'flower', size: 8.5, ph: 0.5 },
      { x: W * 0.37, top: H * 0.5, base: H * 0.68, lean: -U * 2, head: 'leaf', size: 7, tone: 1, rot: -0.2, ph: 2.1 },
      { x: W * 0.15, top: H * 0.3, base: H * 0.8, lean: U * 1.5, head: 'buds', size: 8.5, ph: 3.4 },
      { x: W * 0.88, top: H * 0.42, base: H * 0.92, lean: -U * 3, head: 'leaf', size: 12, tone: 0, rot: 0.28, ph: 4.2 },
    ];
    for (const s of specs) {
      const p = plant(g, rand, s);
      items.push({ kind: 1, c: p.c, x: p.x, y: p.y, ay: p.ay, ph: p.ph, key: s.base, amp: 1 });
    }
    items.sort((a, b) => a.key - b.key);
    return items;
  }

  function drawItems(ctx, g, t, sway) {
    const items = state.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 0) {
        const dx = Math.sin(t * 0.5 + it.ph) * g.U * 0.35 * sway;
        const dy = Math.sin(t * 0.7 + it.ph * 1.7) * g.U * 0.18 * sway;
        ctx.drawImage(it.c, it.x + dx, it.y + dy);
      } else {
        const k = (Math.sin(t * 0.6 + it.ph) * 0.014 + Math.sin(t * 1.3 + it.ph) * 0.006) * sway;
        ctx.setTransform(1, 0, k, 1, -k * it.ay, 0);
        ctx.drawImage(it.c, it.x, it.y);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
  }

  // ---- mist ------------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.16);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 14), y / (g.U * 4), 4, 77);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 224;
        img.data[i + 1] = 226;
        img.data[i + 2] = 212;
        img.data[i + 3] = a * 140;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 0.9) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.wy - g.H * 0.12);
    ctx.drawImage(m, w - a, g.wy - g.H * 0.12);
    const b = (t * g.U * 0.5 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.45);
    ctx.drawImage(m, b - w, g.wy - g.H * 0.02);
    ctx.drawImage(m, b, g.wy - g.H * 0.02);
    ctx.globalAlpha = 1;
  }

  // ---- rain and rings -----------------------------------------------------------

  function makeRain(g) {
    const f = () => new Float32Array(RAIN_MAX);
    const r = { x: f(), y: f(), v: f(), land: f() };
    const rings = { x: new Float32Array(RIPPLES), y: new Float32Array(RIPPLES), age: new Float32Array(RIPPLES).fill(-1), head: 0 };
    for (let i = 0; i < RAIN_MAX; i++) resetDrop(g, r, i, true);
    return { r, rings };
  }

  function resetDrop(g, r, i, scatter) {
    const rand = state.rand;
    r.x[i] = rand() * (g.W + g.H * 0.2);
    r.v[i] = g.U * (52 + rand() * 18);
    const water = g.H - g.wy;
    r.land[i] = g.wy + g.H * 0.03 + Math.pow(rand(), 0.8) * (water - g.H * 0.03);
    r.y[i] = scatter ? rand() * r.land[i] : -rand() * g.H * 0.25;
  }

  function stepRain(g, dt, count) {
    const { r, rings } = state.rain;
    for (let i = 0; i < count; i++) {
      r.y[i] += r.v[i] * dt;
      if (r.y[i] < r.land[i]) continue;
      const k = rings.head;
      rings.head = (k + 1) % RIPPLES;
      rings.x[k] = r.x[i] - r.land[i] * 0.15;
      rings.y[k] = r.land[i];
      rings.age[k] = 0;
      resetDrop(g, r, i, false);
    }
    for (let k = 0; k < RIPPLES; k++) {
      if (rings.age[k] < 0) continue;
      rings.age[k] += dt;
      if (rings.age[k] > RIPPLE_LIFE) rings.age[k] = -1;
    }
  }

  function drawRings(ctx, g) {
    const rings = state.rain.rings;
    ctx.strokeStyle = '#cfd6c4';
    ctx.lineWidth = Math.max(1, g.U * 0.26);
    for (let k = 0; k < RIPPLES; k++) {
      const age = rings.age[k];
      if (age < 0) continue;
      const f = age / RIPPLE_LIFE;
      const d = (rings.y[k] - g.wy) / (g.H - g.wy);
      const rx = g.U * (1.2 + d * 4.2) * Math.pow(f, 0.7) + 0.5;
      ctx.globalAlpha = (1 - f) * 0.6;
      ctx.beginPath();
      ctx.ellipse(rings.x[k], rings.y[k], rx, rx * 0.34, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawRain(ctx, g, count) {
    const r = state.rain.r;
    ctx.strokeStyle = '#d8dcca';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, g.U * 0.22);
    ctx.beginPath();
    const len = g.U * 3.6;
    for (let i = 0; i < count; i++) {
      if (r.y[i] < 0) continue;
      const x = r.x[i] - r.y[i] * 0.15;
      ctx.moveTo(x, r.y[i]);
      ctx.lineTo(x - len * 0.15, r.y[i] - len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.willow = paintWillow(g, rand);
    state.water = paintWater(g, rand);
    state.shimmer = makeShimmer(g, rand);
    state.items = makeScene(g, rand);
    state.mist = paintMist(g);
    state.rain = makeRain(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, sway, mist } = api.props;
    const count = Math.min(RAIN_MAX, Math.round(30 * rain));
    stepRain(g, Math.min(dt, 0.1), count);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    const w = state.willow;
    const k = Math.sin(t * 0.5 + w.ph) * 0.03 * sway;
    ctx.setTransform(1, 0, k, 1, -k * w.ay, 0);
    ctx.drawImage(w.c, w.x, w.y);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(state.water, 0, g.wy);
    drawShimmer(ctx, g, t);
    drawRings(ctx, g);
    drawItems(ctx, g, t, sway);
    drawRain(ctx, g, count);
  }

  Kasuri.run({
    defaults: { rain: 1, sway: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
