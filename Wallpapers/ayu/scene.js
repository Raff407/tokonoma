/*
 * 鮎 Ayu — sweetfish in a clear gravel stream, seen from above.
 *
 * The gravel bed, the net of sunlight, the dappled shade, the stepping stones and
 * the banks are baked once. Light and shade slide over the bed in two tiles, a few
 * fish hold against the current and now and then dart, and leaves ride the surface.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const GRAVEL = ['#8b8573', '#a49c85', '#b9ae90', '#c9bf9f', '#9a947f'];
  const DEEP = '#2f4f55';
  const MOSS = ['#2f4430', '#3f5636', '#566b3f', '#6f8650'];
  const LEAF_TONES = ['#b4432a', '#d6683c', '#c9a24a'];
  const MAX_FISH = 12;
  const FISH = 7;
  const MAX_LEAVES = 36;
  const LEAVES = 16;
  const STREAKS = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.3), Math.max(ry, 0.3), 0, 0, TAU);
    ctx.fill();
  }

  function ell(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
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
    const U = H / 100;
    return { W, H, U, lo: H * 0.2, hi: H * 0.8 };
  }

  function bankTop(g, x) {
    return g.H * 0.11 + fbm(x / (g.U * 22), 3.3, 3, 5) * g.H * 0.07;
  }

  function bankBot(g, x) {
    return g.H * 0.92 - fbm(x / (g.U * 22), 8.1, 3, 9) * g.H * 0.07;
  }

  // ---- the bed -------------------------------------------------------------

  function paintBed(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const inks = GRAVEL.map(K.parseColor);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.U * 7), y / (g.U * 7), 3, 7) + (rand() - 0.5) * 0.35;
        const ink = inks[Math.max(0, Math.min(inks.length - 1, Math.floor(n * inks.length)))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const count = Math.floor((g.W * g.H) / (g.U * g.U * 5));
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      const r = g.U * (0.45 + rand() * 0.9);
      ctx.fillStyle = 'rgba(30,48,52,0.35)';
      blob(ctx, x + r * 0.25, y + r * 0.3, r, r * 0.8);
      ctx.fillStyle = GRAVEL[Math.floor(rand() * GRAVEL.length)];
      blob(ctx, x, y, r, r * 0.8);
      ctx.fillStyle = 'rgba(232,220,186,0.18)';
      blob(ctx, x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.28);
    }
    for (let i = 0; i < 14; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.25 + rand() * 0.5);
      const r = g.U * (2.2 + rand() * 2.2);
      ctx.fillStyle = 'rgba(24,40,44,0.4)';
      blob(ctx, x + r * 0.2, y + r * 0.3, r * 1.1, r * 0.8);
      ctx.fillStyle = rand() < 0.5 ? '#5f5d52' : '#76705f';
      blob(ctx, x, y, r, r * 0.75);
      ctx.fillStyle = 'rgba(210,200,165,0.3)';
      blob(ctx, x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.3);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, 'rgba(47,79,85,0.12)');
    grad.addColorStop(0.5, 'rgba(47,79,85,0.24)');
    grad.addColorStop(1, 'rgba(47,79,85,0.12)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // A net of bright lines that tiles in both directions.
  function paintNet(g, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const a = Math.max(2, Math.round(g.W / (g.U * 11)));
    const b = Math.max(2, Math.round(g.H / (g.U * 11)));
    const ph = seed * 1.7;
    for (let y = 0; y < g.H; y++) {
      const fy = (y / g.H) * TAU;
      for (let x = 0; x < g.W; x++) {
        const fx = (x / g.W) * TAU;
        const w1 = Math.sin(fx * a + 1.2 * Math.sin(fy * b + ph));
        const w2 = Math.sin(fy * b + fx * 1 + 1.1 * Math.sin(fx * a * 0.5 - ph));
        const w3 = Math.sin(fx * (a - 1) - fy * (b - 1) + 0.9 * Math.sin(fy * 2));
        const v = (w1 + w2 + w3) / 3;
        const line = Math.max(0, 1 - Math.abs(v - 0.1) * 5);
        const level = Math.round(line * line * 3) / 3;
        const i = (y * g.W + x) * 4;
        d[i] = 244;
        d[i + 1] = 230;
        d[i + 2] = 176;
        d[i + 3] = level * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Dappled shade from maple leaves overhead, tiling sideways.
  function paintShade(g, rand) {
    const w = Math.ceil(g.W * 1.2);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(22,38,44,0.5)';
    for (let i = 0; i < 46; i++) {
      const x = rand() * w;
      const y = rand() * g.H;
      const r = g.U * (2 + rand() * 4);
      const rot = rand() * TAU;
      for (let k = 0; k < 5; k++) {
        const a = rot + (k / 5) * TAU;
        blob(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.3);
      }
      blob(ctx, x, y, r * 0.5, r * 0.5);
      if (x < r * 3) {
        blob(ctx, x + w, y, r * 0.9, r * 0.9);
      }
    }
    return c;
  }

  // ---- banks and stepping stones -------------------------------------------

  function mossEdge(ctx, g, rand, edge, dir) {
    ctx.fillStyle = MOSS[0];
    ctx.beginPath();
    ctx.moveTo(0, dir > 0 ? 0 : g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, edge(g, x));
    ctx.lineTo(g.W, dir > 0 ? 0 : g.H);
    ctx.fill();
    for (let x = -g.U; x < g.W + g.U; x += g.U * (1.4 + rand() * 1.6)) {
      const r = g.U * (1.4 + rand() * 1.8);
      const y = edge(g, x) - dir * r * 0.15;
      ctx.fillStyle = 'rgba(20,36,40,0.28)';
      blob(ctx, x + r * 0.2, y + dir * r * 0.9, r * 1.1, r * 0.5);
      ctx.fillStyle = MOSS[1 + Math.floor(rand() * 2)];
      blob(ctx, x, y, r, r * 0.65);
      ctx.fillStyle = MOSS[3];
      blob(ctx, x - r * 0.3, y - r * 0.2, r * 0.4, r * 0.2);
    }
    for (let x = 0; x < g.W; x += g.U * (4 + rand() * 6)) {
      const r = g.U * (1 + rand() * 1.4);
      const y = edge(g, x) + dir * r * 0.1;
      ctx.fillStyle = 'rgba(20,36,40,0.35)';
      blob(ctx, x + r * 0.3, y + dir * r * 0.4, r * 1.1, r * 0.8);
      ctx.fillStyle = rand() < 0.5 ? '#6d695d' : '#8a8474';
      blob(ctx, x, y, r, r * 0.8);
      ctx.fillStyle = 'rgba(224,214,180,0.35)';
      blob(ctx, x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.28);
    }
  }

  function bambooLeaf(ctx, x, y, len, ang, ink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = ink;
    poly(ctx, [-len / 2, 0, -len * 0.1, -len * 0.14, len / 2, 0, -len * 0.1, len * 0.14]);
    ctx.restore();
  }

  function stone(ctx, g, rand, x, y, rx, ry) {
    const u = g.U;
    ctx.fillStyle = 'rgba(16,30,34,0.42)';
    blob(ctx, x + u * 1.2, y + u * 1.6, rx * 1.08, ry * 1.05);
    ctx.fillStyle = 'rgba(224,216,186,0.55)';
    blob(ctx, x, y, rx * 1.12, ry * 1.12);
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const k = 0.9 + rand() * 0.18;
      pts.push(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k);
    }
    ctx.fillStyle = '#625f55';
    poly(ctx, pts);
    ctx.fillStyle = '#827c6b';
    blob(ctx, x - rx * 0.08, y - ry * 0.12, rx * 0.8, ry * 0.76);
    ctx.fillStyle = '#a49c85';
    blob(ctx, x - rx * 0.28, y - ry * 0.3, rx * 0.4, ry * 0.3);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = MOSS[1 + Math.floor(rand() * 3)];
      blob(ctx, x + (rand() - 0.75) * rx * 0.8, y + (rand() - 0.7) * ry * 0.7, rx * (0.16 + rand() * 0.18), ry * (0.14 + rand() * 0.14));
    }
    ctx.fillStyle = 'rgba(224,216,186,0.4)';
    for (let i = 0; i < 4; i++) {
      const l = u * (5 + rand() * 7);
      ctx.fillRect(x + rx * 1.05 + u * rand() * 2, y + (i - 1.5) * ry * 0.45, l, Math.max(1, u * 0.28));
    }
  }

  function paintMaple(ctx, g, rand) {
    const cx = g.W * 0.92;
    const cy = g.H * 0.03;
    ctx.strokeStyle = '#2a201b';
    ctx.lineCap = 'round';
    ctx.lineWidth = g.U * 1.3;
    ctx.beginPath();
    ctx.moveTo(g.W + g.U * 2, g.H * 0.0);
    ctx.quadraticCurveTo(g.W * 0.97, g.H * 0.05, g.W * 0.84, g.H * 0.075);
    ctx.stroke();
    for (let i = 0; i < 20; i++) {
      const a = rand() * TAU;
      const dd = Math.sqrt(rand()) * g.U * 11;
      const x = cx + Math.cos(a) * dd - g.U * 3;
      const y = cy + Math.sin(a) * dd * 0.45 + g.U * 3;
      const r = g.U * (1.4 + rand() * 1.2);
      ctx.fillStyle = '#7a2a1d';
      blob(ctx, x + r * 0.2, y + r * 0.25, r, r * 0.85);
      ctx.fillStyle = LEAF_TONES[rand() < 0.65 ? 0 : 1];
      blob(ctx, x, y, r * 0.85, r * 0.7);
      ctx.fillStyle = rand() < 0.5 ? '#e8a24e' : LEAF_TONES[1];
      blob(ctx, x - r * 0.25, y - r * 0.2, r * 0.4, r * 0.3);
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spots = [[0.3, 0.74], [0.4, 0.62], [0.5, 0.5], [0.6, 0.39], [0.69, 0.27]];
    for (let i = 0; i < spots.length; i++) {
      const [fx, fy] = spots[i];
      stone(ctx, g, rand, g.W * fx, g.H * fy, g.U * (6.5 + rand() * 2), g.U * (5 + rand() * 1.5));
    }
    mossEdge(ctx, g, rand, bankTop, 1);
    mossEdge(ctx, g, rand, bankBot, -1);
    for (let i = 0; i < 40; i++) {
      const top = rand() < 0.5;
      const x = rand() * g.W;
      const y = top ? bankTop(g, x) - g.U * (0.5 + rand() * 6) : bankBot(g, x) + g.U * (0.5 + rand() * 6);
      bambooLeaf(ctx, x, y, g.U * (3 + rand() * 2.5), rand() * Math.PI, rand() < 0.5 ? '#6f8650' : '#566b3f');
    }
    for (let i = 0; i < 7; i++) {
      const top = rand() < 0.5;
      const x = rand() * g.W;
      const y = top ? bankTop(g, x) - g.U * (1 + rand() * 4) : bankBot(g, x) + g.U * (1 + rand() * 4);
      ctx.fillStyle = LEAF_TONES[Math.floor(rand() * 3)];
      blob(ctx, x, y, g.U * 1.3, g.U * 1);
    }
    paintMaple(ctx, g, rand);
    return c;
  }

  // ---- leaf sprites --------------------------------------------------------

  function mapleSprite(size, ink, shadow) {
    const c = layer(size * 2, size * 2);
    const ctx = c.getContext('2d');
    const m = size;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const r = size * (i % 2 ? 0.45 : 1);
      pts.push(m + Math.cos(a) * r, m + Math.sin(a) * r);
    }
    ctx.fillStyle = shadow ? '#142830' : ink;
    poly(ctx, pts);
    if (!shadow) {
      ctx.fillStyle = 'rgba(240,200,120,0.35)';
      blob(ctx, m - size * 0.15, m - size * 0.2, size * 0.3, size * 0.25);
      ctx.strokeStyle = '#7a2a1d';
      ctx.lineWidth = Math.max(1, size * 0.14);
      ctx.beginPath();
      ctx.moveTo(m, m);
      ctx.lineTo(m + size * 0.2, m + size * 0.95);
      ctx.stroke();
    }
    return c;
  }

  function bambooSprite(size, shadow) {
    const c = layer(size * 2, size * 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = shadow ? '#142830' : '#6f8650';
    poly(ctx, [size * 0.1, size, size * 0.9, size * 0.7, size * 1.9, size, size * 0.9, size * 1.3]);
    return c;
  }

  function makeSprites(g) {
    const s = Math.max(3, Math.round(g.U * 3.6));
    const sp = { maple: [], mapleShadow: mapleSprite(s, '', true), bamboo: bambooSprite(s * 1.2, false), bambooShadow: bambooSprite(s * 1.2, true) };
    for (const ink of LEAF_TONES) sp.maple.push(mapleSprite(s, ink, false));
    return sp;
  }

  // ---- fish ----------------------------------------------------------------

  function makeFish(g, rand) {
    const f = () => new Float32Array(MAX_FISH);
    const F = { x: f(), y: f(), sx: f(), sy: f(), tx: f(), ty: f(), ang: f(), ph: f(), mode: f(), timer: f(), dur: f(), size: f() };
    const cx = g.W * (0.25 + rand() * 0.4);
    for (let i = 0; i < MAX_FISH; i++) {
      F.x[i] = cx + (rand() - 0.5) * g.W * 0.4;
      F.y[i] = lerp(g.lo, g.hi, rand());
      F.ang[i] = Math.PI;
      F.ph[i] = rand() * TAU;
      F.timer[i] = 0.5 + rand() * 4;
      F.size[i] = g.U * (21 + rand() * 5);
    }
    return F;
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }

  function startDart(g, F, i) {
    const r = state.rand;
    F.sx[i] = F.x[i];
    F.sy[i] = F.y[i];
    const back = F.x[i] > g.W * 0.85;
    const dx = back ? -g.W * (0.15 + r() * 0.15) : (r() - 0.65) * g.W * 0.26;
    F.tx[i] = Math.min(g.W * 0.96, Math.max(g.W * 0.04, F.x[i] + dx));
    F.ty[i] = Math.min(g.hi, Math.max(g.lo, F.y[i] + (r() - 0.5) * g.H * 0.26));
    F.mode[i] = 1;
    F.dur[i] = 0.35 + r() * 0.3;
    F.timer[i] = 0;
  }

  function stepFish(g, F, i, dt) {
    let want = Math.PI;
    if (F.mode[i] === 0) {
      F.x[i] += g.U * 0.7 * dt;
      F.y[i] += Math.sin(F.ph[i] * 0.3) * g.U * 0.25 * dt;
      F.ph[i] += dt * 7;
      F.timer[i] -= dt;
      if (F.timer[i] <= 0 || F.x[i] > g.W * 0.97) startDart(g, F, i);
    } else {
      F.timer[i] += dt;
      const p = Math.min(1, F.timer[i] / F.dur[i]);
      const e = 1 - (1 - p) * (1 - p) * (1 - p);
      F.x[i] = lerp(F.sx[i], F.tx[i], e);
      F.y[i] = lerp(F.sy[i], F.ty[i], e);
      F.ph[i] += dt * 26;
      want = Math.atan2(F.ty[i] - F.sy[i], F.tx[i] - F.sx[i]);
      if (p >= 1) {
        F.mode[i] = 0;
        F.timer[i] = 1.5 + state.rand() * 4.5;
      }
    }
    F.ang[i] += wrapAngle(want - F.ang[i]) * Math.min(1, dt * 7);
  }

  function E(ctx, L, x, y, rx, ry) {
    ell(ctx, x * L, y * L, rx * L, ry * L);
  }

  function P(ctx, L, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0] * L, pts[1] * L);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * L, pts[i + 1] * L);
    ctx.closePath();
    ctx.fill();
  }

  function drawFish(ctx, g, F, i) {
    const L = F.size[i];
    const c = Math.cos(F.ang[i]);
    const s = Math.sin(F.ang[i]);
    const amp = F.mode[i] === 1 ? 1.8 : 0.7;
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#10222a';
    ctx.setTransform(c, s, -s, c, F.x[i] + g.U * 1.6, F.y[i] + g.U * 2.2);
    E(ctx, L, 0, 0, 0.52, 0.12);
    ctx.globalAlpha = 1;
    ctx.setTransform(c, s, -s, c, F.x[i], F.y[i]);
    const ph = F.ph[i];
    const yTail = Math.sin(ph - 4.2) * 0.06 * amp;
    ctx.fillStyle = '#6a6f45';
    P(ctx, L, [-0.38, yTail, -0.58, yTail - 0.1 + Math.sin(ph - 5) * 0.04 * amp, -0.58, yTail + 0.1 + Math.sin(ph - 5) * 0.04 * amp]);
    P(ctx, L, [0.04, -0.07, -0.12, -0.15, -0.14, -0.07]);
    for (let k = 0; k < 6; k++) {
      const x = 0.42 - k * 0.15;
      const y = Math.sin(ph - k * 0.9) * 0.05 * amp * (k / 5);
      const ry = 1.4 * (0.095 - k * 0.012 + (k === 0 ? -0.02 : 0));
      ctx.fillStyle = '#d8d2bb';
      E(ctx, L, x, y + ry * 0.2, 0.14, ry);
      ctx.fillStyle = '#3a4a2e';
      E(ctx, L, x, y - ry * 0.3, 0.14, ry * 0.65);
    }
    ctx.fillStyle = '#e0b94a';
    E(ctx, L, 0.27, Math.sin(ph - 0.9) * 0.01, 0.04, 0.035);
    ctx.fillStyle = '#1d2b2c';
    E(ctx, L, 0.5, -0.02, 0.015, 0.015);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- leaves --------------------------------------------------------------

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), a: f(), spin: f(), p: f(), v: f(), kind: f() };
  }

  function placeLeaf(g, L, i, anywhere) {
    const r = state.rand;
    L.x[i] = anywhere ? r() * g.W : -g.U * 5;
    L.y[i] = lerp(g.lo - g.U * 4, g.hi + g.U * 4, r());
    L.a[i] = r() * TAU;
    L.spin[i] = (r() - 0.5) * 0.8;
    L.p[i] = r() * TAU;
    L.v[i] = g.U * (2.2 + r() * 2.2);
    L.kind[i] = i % 4 === 3 ? 3 : i % 3;
  }

  function stepLeaf(g, L, i, t, dt) {
    L.x[i] += L.v[i] * dt;
    L.y[i] += Math.sin(t * 0.6 + L.p[i]) * g.U * 0.9 * dt;
    L.a[i] += L.spin[i] * dt;
    if (L.x[i] > g.W + g.U * 5) placeLeaf(g, L, i, false);
  }

  function drawLeaves(ctx, g, count, shadow) {
    const L = state.leaves;
    const sp = state.sprites;
    ctx.globalAlpha = shadow ? 0.3 : 1;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const k = L.kind[i];
      const img = k === 3 ? (shadow ? sp.bambooShadow : sp.bamboo) : shadow ? sp.mapleShadow : sp.maple[k];
      const off = shadow ? g.U * 1.4 : 0;
      ctx.setTransform(c, s, -s, c, L.x[i] + off, L.y[i] + off * 1.3);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- flow lines ----------------------------------------------------------

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS), v: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      s.x[i] = rand() * g.W;
      s.y[i] = lerp(g.lo - g.U * 4, g.hi + g.U * 4, rand());
      s.l[i] = g.U * (3 + rand() * 7);
      s.p[i] = rand() * TAU;
      s.v[i] = g.U * (1.5 + rand() * 2);
    }
    return s;
  }

  function drawStreaks(ctx, g, t) {
    const s = state.streaks;
    const th = Math.max(1, g.U * 0.35);
    ctx.fillStyle = '#ddd6bd';
    for (let i = 0; i < STREAKS; i++) {
      const a = Math.sin(t * 0.6 + s.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.32;
      ctx.fillRect(((s.x[i] + t * s.v[i]) % (g.W + s.l[i])) - s.l[i], s.y[i], s.l[i], th);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function tileDraw(ctx, tile, ox, oy, w, h) {
    const x = ((ox % w) + w) % w;
    const y = ((oy % h) + h) % h;
    ctx.drawImage(tile, x - w, y - h);
    ctx.drawImage(tile, x, y - h);
    ctx.drawImage(tile, x - w, y);
    ctx.drawImage(tile, x, y);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.bed = paintBed(g, rand);
    state.netA = paintNet(g, 1);
    state.netB = paintNet(g, 3);
    state.shade = paintShade(g, rand);
    state.front = paintFront(g, rand);
    state.sprites = makeSprites(g);
    state.fish = makeFish(g, rand);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) placeLeaf(g, state.leaves, i, true);
    state.streaks = makeStreaks(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { fish, leaves, light } = api.props;
    const nf = Math.min(MAX_FISH, Math.round(FISH * fish));
    const nl = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < nf; i++) stepFish(g, state.fish, i, step);
    for (let i = 0; i < nl; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.bed, 0, 0);
    const amount = Math.min(1, 0.15 + light * 0.55);
    if (light > 0) {
      ctx.globalAlpha = amount * 0.9;
      tileDraw(ctx, state.netA, t * g.U * 1.6, Math.sin(t * 0.25) * g.U * 2, g.W, g.H);
      ctx.globalAlpha = amount * 0.75;
      tileDraw(ctx, state.netB, -t * g.U * 1.1, Math.cos(t * 0.2) * g.U * 2.5, g.W, g.H);
      ctx.globalAlpha = 1;
    }
    const sw = state.shade.width;
    const sx = (t * g.U * 0.9) % sw;
    ctx.globalAlpha = 0.32 * Math.min(1, light);
    ctx.drawImage(state.shade, sx, Math.sin(t * 0.15) * g.U * 2);
    ctx.drawImage(state.shade, sx - sw, Math.sin(t * 0.15) * g.U * 2);
    ctx.globalAlpha = 1;
    for (let i = 0; i < nf; i++) drawFish(ctx, g, state.fish, i);
    drawStreaks(ctx, g, t);
    drawLeaves(ctx, g, nl, true);
    drawLeaves(ctx, g, nl, false);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { fish: 1, leaves: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
