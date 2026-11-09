/*
 * 鴛鴦 Oshidori — a pair of mandarin ducks on a still autumn pond.
 *
 * Far bank (hills, maples, torii, stone lantern) and the near maple branch are baked once.
 * The pond is the bank flipped and laid back in thin rows that slide sideways. Ducks are two
 * small baked sprites that drift and bob; rings widen around them; a short pool of leaves
 * floats on the water and a few more fall from the branch.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const WATER = 0.36;
  const SKY = ['#7d8da3', '#98a5ad', '#b9b8a8', '#d4c49e', '#e3cb97'];
  const LEAF_TONES = ['#b9462b', '#d2733a', '#a63a27', '#d8a24c'];
  const MAPLE = ['#a63a27', '#c4562f', '#d4812f', '#dba94a', '#8f3224'];
  const MOSS = ['#4a5f45', '#5d7050', '#3b4d3d'];
  const FLOATERS = 16;
  const FALLERS = 7;
  const RINGS = 4;
  const GLINTS = 14;
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
    const wy = Math.round(H * WATER);
    return { W, H, U: H / 100, wy, wh: H - wy };
  }

  // ---- far bank ------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.wy);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.wy; y++) {
      const f = Math.min(1, y / (g.wy * 0.95)) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[Math.min(inks.length - 1, k + (rand() < f - k ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#d9c9a6';
    for (let i = 0; i < 4; i++) {
      const x = g.W * (0.08 + rand() * 0.84);
      const y = g.H * (0.03 + rand() * 0.08);
      blob(ctx, x, y, g.U * (9 + rand() * 12), g.U * (0.5 + rand() * 0.4));
    }
  }

  function paintRidge(ctx, g, color, base, amp, seed, scale) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W; x += 2) {
      ctx.lineTo(x, g.wy - base - fbm(x / (g.U * scale), 0.5, 3, seed) * amp);
    }
    ctx.lineTo(g.W, g.wy);
    ctx.closePath();
    ctx.fill();
  }

  function pineTree(ctx, x, yb, h, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const w = h * (0.34 - i * 0.07);
      const y = yb - h * (0.18 + i * 0.27);
      poly(ctx, [x - w, y, x + w, y, x, y - h * 0.4]);
    }
    ctx.fillRect(x - 0.5, yb - h * 0.2, 1, h * 0.2);
  }

  function paintTrees(ctx, g, rand) {
    const U = g.U;
    for (let x = -U * 2; x < g.W + U * 2; x += U * (2.2 + rand() * 1.8)) {
      const r = U * (2.2 + rand() * 3);
      if (rand() < 0.22) {
        pineTree(ctx, x, g.wy - U * 0.3, U * (7 + rand() * 6), MOSS[rand() < 0.5 ? 2 : 0]);
        continue;
      }
      const yb = g.wy - U * (2.6 + rand() * 4);
      ctx.fillStyle = '#4a3a30';
      ctx.fillRect(x - 0.5, yb, 1, g.wy - yb);
      ctx.fillStyle = MAPLE[Math.floor(rand() * MAPLE.length)];
      blob(ctx, x, yb, r, r * 0.8);
      ctx.fillStyle = MAPLE[Math.floor(rand() * MAPLE.length)];
      blob(ctx, x + r * 0.35, yb - r * 0.3, r * 0.65, r * 0.5);
    }
    ctx.fillStyle = '#394a3a';
    ctx.fillRect(0, g.wy - U * 1.1, g.W, U * 1.1);
  }

  function paintTorii(ctx, g) {
    const U = g.U;
    const x = g.W * 0.74;
    const h = U * 15;
    const hw = U * 5.4;
    const yb = g.wy - U * 0.4;
    const top = yb - h;
    ctx.fillStyle = '#a93d29';
    ctx.fillRect(x - hw, top + U * 2.4, U * 1.2, h - U * 2.4);
    ctx.fillRect(x + hw - U * 1.2, top + U * 2.4, U * 1.2, h - U * 2.4);
    ctx.fillRect(x - hw - U * 0.6, top + U * 5.6, hw * 2 + U * 1.2, U * 1);
    poly(ctx, [x - hw - U * 2.6, top + U * 1.2, x - hw - U * 1.6, top + U * 2.8, x + hw + U * 1.6, top + U * 2.8, x + hw + U * 2.6, top + U * 1.2, x, top + U * 1.8]);
    ctx.fillStyle = '#2a2420';
    poly(ctx, [x - hw - U * 2.8, top + U * 0.5, x - hw - U * 2.6, top + U * 1.4, x + hw + U * 2.6, top + U * 1.4, x + hw + U * 2.8, top + U * 0.5, x, top + U * 1.1]);
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(x - hw, yb - U * 0.5, U * 1.2, U * 0.5);
    ctx.fillRect(x + hw - U * 1.2, yb - U * 0.5, U * 1.2, U * 0.5);
  }

  function paintLantern(ctx, g) {
    const U = g.U;
    const s = U * 21;
    const x = g.W * 0.2;
    const yb = g.wy + U * 0.2;
    const part = (y0, y1, w, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x - (w * s) / 2, yb - y1 * s, w * s, (y1 - y0) * s);
    };
    part(0, 0.07, 0.36, '#6f7268');
    part(0.07, 0.15, 0.27, '#868980');
    part(0.15, 0.47, 0.095, '#7d8078');
    part(0.47, 0.53, 0.3, '#868980');
    part(0.53, 0.73, 0.22, '#6c6f66');
    ctx.fillStyle = '#e0b552';
    ctx.fillRect(x - s * 0.05, yb - s * 0.69, s * 0.1, s * 0.12);
    ctx.fillStyle = '#9a9c92';
    ctx.fillRect(x - s * 0.1, yb - s * 0.72, s * 0.03, s * 0.2);
    const ry = yb - s * 0.73;
    ctx.fillStyle = '#7d8078';
    poly(ctx, [x - s * 0.26, ry, x + s * 0.26, ry, x + s * 0.17, ry - s * 0.07, x + s * 0.08, ry - s * 0.13, x - s * 0.08, ry - s * 0.13, x - s * 0.17, ry - s * 0.07]);
    ctx.fillStyle = '#6a6d64';
    ctx.fillRect(x - s * 0.26, ry - s * 0.015, s * 0.52, s * 0.025);
    ctx.fillStyle = '#868980';
    blob(ctx, x, ry - s * 0.17, s * 0.05, s * 0.06);
    ctx.fillStyle = MOSS[1];
    blob(ctx, x - s * 0.1, yb - s * 0.05, s * 0.09, s * 0.03);
    blob(ctx, x + s * 0.06, ry - s * 0.1, s * 0.07, s * 0.025);
    ctx.fillStyle = '#4b5d46';
    blob(ctx, x - s * 0.4, yb - s * 0.02, s * 0.2, s * 0.05);
    blob(ctx, x + s * 0.4, yb - s * 0.02, s * 0.18, s * 0.045);
  }

  function paintBank(g, rand) {
    const c = layer(g.W, g.wy + 2);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintRidge(ctx, g, '#8795a0', g.U * 8, g.U * 14, 3, 18);
    paintRidge(ctx, g, '#6c7c80', g.U * 4, g.U * 9, 11, 11);
    paintTrees(ctx, g, rand);
    paintTorii(ctx, g);
    paintLantern(ctx, g);
    return c;
  }

  // ---- water ---------------------------------------------------------------

  function paintWater(g) {
    const c = layer(g.W, g.wh);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, g.wh);
    gr.addColorStop(0, '#7a9490');
    gr.addColorStop(0.35, '#4a6874');
    gr.addColorStop(1, '#2a4055');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.wh);
    return c;
  }

  function paintReflection(g, bank) {
    const c = layer(g.W, g.wh);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(bank, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fade = ctx.createLinearGradient(0, 0, 0, g.wh * 0.7);
    fade.addColorStop(0, 'rgba(42,64,85,0.05)');
    fade.addColorStop(1, 'rgba(42,64,85,0.6)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.W, g.wh);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.U * 7);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    for (let x = 0; x < w; x++) {
      const a = 0.1 + fbm(x / (g.U * 10), 2, 3, 7) * 0.28;
      for (let y = 0; y < h; y++) {
        const f = Math.sin((y / h) * Math.PI);
        ctx.fillStyle = 'rgba(226,214,186,' + (a * f * f).toFixed(3) + ')';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  // ---- maple branch --------------------------------------------------------

  function mapleLeaf(ctx, x, y, r, a) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const ang = a + (i / 10) * TAU;
      if (i === 0) ctx.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      else ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function paintBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const pts = [];
    ctx.strokeStyle = '#2a211c';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, U * 0.9);
    ctx.beginPath();
    ctx.moveTo(g.W + U * 2, U * 4);
    for (let i = 1; i <= 8; i++) {
      const f = i / 8;
      const x = g.W + U * 2 - f * g.W * 0.4;
      const y = U * 4 + f * U * 14 + Math.sin(f * 5) * U * 2;
      ctx.lineTo(x, y);
      pts.push(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1, U * 0.4);
    const trunk = pts.length;
    for (let i = 0; i < trunk; i += 2) {
      const len = U * (4 + rand() * 4);
      const dir = i % 4 === 0 ? 1 : -0.4;
      ctx.beginPath();
      ctx.moveTo(pts[i], pts[i + 1]);
      ctx.lineTo(pts[i] - len * 0.4, pts[i + 1] + len * dir);
      ctx.stroke();
      pts.push(pts[i] - len * 0.4, pts[i + 1] + len * dir);
    }
    for (let i = 0; i < pts.length; i += 2) {
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = MAPLE[Math.floor(rand() * MAPLE.length)];
        mapleLeaf(ctx, pts[i] + (rand() - 0.5) * U * 6, pts[i + 1] + rand() * U * 6, U * (1.5 + rand() * 1), rand() * TAU);
      }
    }
    // low rocks at the near corners
    ctx.fillStyle = '#3c4640';
    blob(ctx, g.W * 0.02, g.H + U * 1, U * 12, U * 5);
    blob(ctx, g.W * 0.98, g.H + U * 1, U * 14, U * 4);
    ctx.fillStyle = MOSS[0];
    blob(ctx, g.W * 0.02, g.H - U * 3.5, U * 8, U * 1.5);
    blob(ctx, g.W * 0.98, g.H - U * 3, U * 9, U * 1.2);
    return c;
  }

  // ---- ducks ---------------------------------------------------------------

  function drakeSprite(g) {
    const s = g.U * 0.58;
    const c = layer(46 * s, 30 * s);
    const ctx = c.getContext('2d');
    ctx.translate(23 * s, 24 * s);
    ctx.scale(s, s);
    ctx.fillStyle = '#7b5c46';
    ctx.beginPath();
    ctx.moveTo(-20, -6);
    ctx.quadraticCurveTo(-8, 1.5, 8, 1);
    ctx.quadraticCurveTo(16, -3, 14, -9);
    ctx.quadraticCurveTo(0, -12, -20, -6);
    ctx.fill();
    ctx.fillStyle = '#c99d57';
    ctx.beginPath();
    ctx.ellipse(-3, -4.5, 12, 3.4, -0.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4a3a58';
    ctx.beginPath();
    ctx.ellipse(10, -4.5, 5, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#efe6cf';
    ctx.fillRect(6.2, -9, 1.3, 7);
    ctx.fillRect(4.2, -9, 0.7, 7);
    ctx.fillStyle = '#d0691f';
    poly(ctx, [-6, -8, -10, -21, -3, -19, 3, -10]);
    ctx.fillStyle = '#9c4a1a';
    poly(ctx, [-3, -9, -6, -19, -1, -16, 2, -10]);
    ctx.fillStyle = '#2f4a3d';
    ctx.beginPath();
    ctx.arc(13, -13, 5.4, 0, TAU);
    ctx.fill();
    poly(ctx, [10, -17, 5, -19, 7, -14]);
    ctx.fillStyle = '#c9692f';
    poly(ctx, [11, -12, 6, -8, 11, -8.5, 15, -9]);
    ctx.strokeStyle = '#efe6cf';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(14.5, -15);
    ctx.lineTo(7.5, -16.2);
    ctx.stroke();
    ctx.fillStyle = '#c4452c';
    poly(ctx, [17.6, -14, 22, -12.6, 17.8, -11.6]);
    ctx.fillStyle = '#1c1a1a';
    ctx.fillRect(14.4, -14.2, 1.2, 1.2);
    return { c, ox: 23 * s, oy: 24 * s };
  }

  function henSprite(g) {
    const s = g.U * 0.5;
    const c = layer(44 * s, 28 * s);
    const ctx = c.getContext('2d');
    ctx.translate(22 * s, 22 * s);
    ctx.scale(s, s);
    ctx.fillStyle = '#b0a691';
    ctx.beginPath();
    ctx.moveTo(-20, -5.5);
    ctx.quadraticCurveTo(-8, 1.5, 8, 1);
    ctx.quadraticCurveTo(16, -3, 14, -9);
    ctx.quadraticCurveTo(0, -11, -20, -5.5);
    ctx.fill();
    ctx.fillStyle = '#d2c7ac';
    ctx.beginPath();
    ctx.ellipse(8, -3.5, 5.5, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5f5e58';
    for (let i = 0; i < 5; i++) ctx.fillRect(-8 + i * 3.5, -7.5 + (i % 2), 1.2, 1.2);
    ctx.fillStyle = '#968e7c';
    ctx.beginPath();
    ctx.arc(13, -12, 4.9, 0, TAU);
    ctx.fill();
    poly(ctx, [10, -15, 6, -17, 7.5, -12]);
    ctx.strokeStyle = '#ece4ce';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14.4, -13.4);
    ctx.lineTo(6.8, -13.8);
    ctx.stroke();
    ctx.fillStyle = '#ece4ce';
    ctx.fillRect(13, -13.6, 2.6, 2.4);
    ctx.fillStyle = '#1c1a1a';
    ctx.fillRect(14, -13, 1.2, 1.2);
    ctx.fillStyle = '#4a4a44';
    poly(ctx, [16.6, -12.6, 20.6, -11.4, 16.8, -10.4]);
    return { c, ox: 22 * s, oy: 22 * s };
  }

  function makeDucks(g) {
    return [
      { spr: drakeSprite(g), x: g.W * 0.5, y: g.wy + g.wh * 0.46, ax: g.W * 0.04, f: 0.17, p: 0.5 },
      { spr: henSprite(g), x: g.W * 0.35, y: g.wy + g.wh * 0.58, ax: g.W * 0.035, f: 0.13, p: 2.2 },
    ];
  }

  function duckPos(d, t, out) {
    out.x = d.x + Math.sin(t * d.f + d.p) * d.ax;
    out.y = d.y + Math.sin(t * 0.7 + d.p) * 0.35;
  }

  const pos = { x: 0, y: 0 };

  function drawDuck(ctx, d, t) {
    duckPos(d, t, pos);
    const s = d.spr;
    ctx.globalAlpha = 0.34;
    ctx.save();
    ctx.translate(pos.x - s.ox + Math.sin(t * 1.3 + d.p) * 0.6, pos.y + 1.2);
    ctx.scale(1, -0.9);
    ctx.drawImage(s.c, 0, -s.oy);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.drawImage(s.c, pos.x - s.ox, pos.y - s.oy);
    ctx.fillStyle = 'rgba(214,224,214,0.55)';
    ctx.fillRect(pos.x - s.ox * 0.7, pos.y, s.ox * 1.4, 0.8);
  }

  function drawRings(ctx, g, t, ripple) {
    if (ripple <= 0) return;
    ctx.lineWidth = 0.9;
    for (let d = 0; d < state.ducks.length; d++) {
      duckPos(state.ducks[d], t, pos);
      for (let i = 0; i < RINGS; i++) {
        const ph = ((t * 0.12 + i / RINGS + d * 0.31) % 1 + 1) % 1;
        const rx = g.U * (5 + ph * 16);
        const a = (1 - ph) * (1 - ph) * 0.38 * Math.min(1, ripple);
        ctx.strokeStyle = 'rgba(205,218,212,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.ellipse(pos.x + (d ? -g.U : g.U), pos.y + 0.6, rx, rx * 0.28, 0, 0, TAU);
        ctx.stroke();
      }
    }
    const R = state.drops;
    for (let i = 0; i < R.x.length; i++) {
      const ph = ((t * 0.09 + R.p[i]) % 1 + 1) % 1;
      const rx = g.U * (1 + ph * 8);
      const a = (1 - ph) * (1 - ph) * 0.3 * Math.min(1, ripple);
      ctx.strokeStyle = 'rgba(205,218,212,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(R.x[i], R.y[i], rx, rx * 0.28, 0, 0, TAU);
      ctx.stroke();
    }
  }

  function makeDrops(g, rand) {
    const n = 4;
    const R = { x: new Float32Array(n), y: new Float32Array(n), p: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      R.x[i] = g.W * (0.1 + rand() * 0.8);
      R.y[i] = g.wy + g.wh * (0.22 + rand() * 0.7);
      R.p[i] = i / n;
    }
    return R;
  }

  // ---- leaves and glints ---------------------------------------------------

  function makeLeafPool(g, rand, n, yLo, yHi) {
    const L = { x: new Float32Array(n), y: new Float32Array(n), p: new Float32Array(n), a: new Float32Array(n), v: new Float32Array(n), tone: new Uint8Array(n) };
    for (let i = 0; i < n; i++) {
      L.x[i] = rand() * g.W;
      L.y[i] = lerp(yLo, yHi, rand());
      L.p[i] = rand() * TAU;
      L.a[i] = rand() * TAU;
      L.v[i] = 0.5 + rand();
      L.tone[i] = Math.floor(rand() * LEAF_TONES.length);
    }
    return L;
  }

  function drawFloating(ctx, g, t, count) {
    const L = state.floaters;
    for (let i = 0; i < count; i++) {
      const x = (((L.x[i] + t * 0.9 * L.v[i]) % g.W) + g.W) % g.W;
      const y = L.y[i] + Math.sin(t * 0.5 + L.p[i]) * 0.5;
      const sz = g.U * 0.95;
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(1, 0, 0, 1, x, y);
      ctx.rotate(L.a[i] + Math.sin(t * 0.3 + L.p[i]) * 0.3);
      ctx.scale(1, 0.4);
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawFalling(ctx, g, t, count) {
    const L = state.fallers;
    const span = g.wy + g.wh * 0.9;
    for (let i = 0; i < count; i++) {
      const ph = (((t * 0.028 * L.v[i] + L.p[i]) % 1) + 1) % 1;
      const x = L.x[i] + Math.sin(t * 0.8 + L.p[i] * 9) * g.U * 3 - ph * g.U * 8;
      const y = g.U * 8 + ph * span;
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + L.p[i] * 7));
      const sz = g.U * 1.3;
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      const c = Math.cos(L.a[i] + t * 0.6);
      const s = Math.sin(L.a[i] + t * 0.6);
      ctx.setTransform(c * sq, s * sq, -s, c, x, y);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function makeGlints(g, rand) {
    const G = { x: new Float32Array(GLINTS), y: new Float32Array(GLINTS), p: new Float32Array(GLINTS), w: new Float32Array(GLINTS) };
    for (let i = 0; i < GLINTS; i++) {
      G.x[i] = rand() * g.W;
      G.y[i] = g.wy + g.wh * (0.05 + rand() * 0.9);
      G.p[i] = rand() * TAU;
      G.w[i] = g.U * (1.5 + rand() * 3.5);
    }
    return G;
  }

  function drawGlints(ctx, g, t) {
    const G = state.glints;
    ctx.fillStyle = '#d8d9c4';
    for (let i = 0; i < GLINTS; i++) {
      const s = Math.sin(t * 0.5 + G.p[i]);
      if (s < 0.2) continue;
      ctx.globalAlpha = (s - 0.2) * 0.3;
      ctx.fillRect(G.x[i] + Math.sin(t * 0.2 + G.p[i]) * g.U, G.y[i], G.w[i], 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t) {
    const m = state.mist;
    const y = g.wy - g.U * 6;
    const off = (t * 0.8) % m.width;
    ctx.drawImage(m, -off, y);
    ctx.drawImage(m, m.width - off, y);
  }

  function drawWater(ctx, g, t) {
    ctx.drawImage(state.water, 0, g.wy);
    const R = state.refl;
    ctx.globalAlpha = 0.85;
    for (let y = 0; y < g.wh; y += 2) {
      const dx = Math.sin(t * 1.1 + y * 0.33) * (0.35 + y * 0.012);
      ctx.drawImage(R, 0, y, g.W, 2, dx, g.wy + y, g.W, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.bank = paintBank(g, rand);
    state.water = paintWater(g);
    state.refl = paintReflection(g, state.bank);
    state.mist = paintMist(g);
    state.branch = paintBranch(g, rand);
    state.ducks = makeDucks(g);
    state.drops = makeDrops(g, rand);
    state.floaters = makeLeafPool(g, rand, FLOATERS, g.wy + g.wh * 0.12, g.wy + g.wh * 0.95);
    state.fallers = makeLeafPool(g, rand, FALLERS, 0, 1);
    for (let i = 0; i < FALLERS; i++) {
      state.fallers.x[i] = g.W * (0.62 + rand() * 0.36);
      state.fallers.p[i] = rand();
    }
    state.glints = makeGlints(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { ripple, leaves } = api.props;
    const fl = Math.min(FLOATERS, Math.round((FLOATERS / 2) * leaves));
    const fa = Math.min(FALLERS, Math.round((FALLERS * 0.6) * leaves));
    ctx.drawImage(state.bank, 0, 0);
    drawMist(ctx, g, t);
    drawWater(ctx, g, t);
    drawGlints(ctx, g, t);
    drawRings(ctx, g, t, ripple);
    drawFloating(ctx, g, t, fl);
    drawDuck(ctx, state.ducks[1], t);
    drawDuck(ctx, state.ducks[0], t);
    ctx.drawImage(state.branch, 0, 0);
    drawFalling(ctx, g, t, fa);
  }

  Kasuri.run({
    defaults: { ripple: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
