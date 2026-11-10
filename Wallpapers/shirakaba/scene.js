/*
 * 白樺 Shirakaba — a highland birch grove in mist.
 *
 * Sky, ridge and three rows of pale trunks are baked once, with fog laid between the
 * rows. Light shafts breathe slowly, two mist strips drift past and a few yellow
 * leaves come down through the stems.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.8;
  const SKY = ['#6f8284', '#8a9a94', '#a6ae9a', '#bdbea4'];
  const FOG = [210, 214, 196];
  const BARK = { lit: '#ece7d4', mid: '#cfcab4', shade: '#8f9582', mark: '#2e302b', warm: '#c9bc94' };
  const LEAF = ['#c9b35a', '#d8c26a', '#b79f4a', '#e0cf86'];
  const FALL = ['#d8b84e', '#e2c866', '#c49a3c'];
  const SASA = ['#2f4430', '#3c5538', '#4f6a42', '#6b8456'];
  const EARTH = ['#232b24', '#2c352a', '#394233'];
  const MAX_LEAVES = 10;
  const SHAFTS = 5;
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
    const U = H / 100;
    return { W, H, U, gy: Math.round(H * GROUND) };
  }

  // ---- sky and ridge ---------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.gy);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.gy; y++) {
      const f = Math.min(1, y / (g.H * 0.55)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function ridge(ctx, g, base, amp, seed, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.gy);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const bump = Math.exp(-(((x - g.W * 0.7) / (g.W * 0.2)) ** 2)) * g.H * 0.08;
      ctx.lineTo(x, g.H * base + fbm(x / (g.U * 36), seed, 4, seed * 7) * g.H * amp - bump);
    }
    ctx.lineTo(g.W, g.gy);
    ctx.fill();
  }

  function fogOver(ctx, g, alpha) {
    ctx.fillStyle = `rgba(${FOG[0]},${FOG[1]},${FOG[2]},${alpha})`;
    ctx.fillRect(0, 0, g.W, g.gy + 1);
  }

  // ---- birch -----------------------------------------------------------------

  function crownBlobs(ctx, g, rand, x, y, r) {
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)];
      ctx.globalAlpha = 0.55 + rand() * 0.3;
      blob(ctx, x + (rand() - 0.5) * r * 2, y + (rand() - 0.5) * r * 0.9, r * (0.3 + rand() * 0.35), r * (0.2 + rand() * 0.2));
    }
    ctx.globalAlpha = 1;
  }

  function limb(ctx, rand, x, y, len, w, dir, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, w);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * len * 0.5, y - len * 0.25, x + dir * len * 0.8, y - len * 0.7 - rand() * len * 0.2);
    ctx.stroke();
  }

  // One trunk: lit left face, shaded right edge, dark chevron marks, a few thin limbs.
  function trunk(ctx, g, rand, x, top, bot, w, near) {
    const lean = (rand() - 0.5) * w * 1.2;
    const wt = w * 0.8;
    const pts = [x - w / 2, bot, x - wt / 2 + lean, top, x + wt / 2 + lean, top, x + w / 2, bot];
    ctx.fillStyle = BARK.mid;
    poly(ctx, pts);
    ctx.fillStyle = BARK.lit;
    poly(ctx, [pts[0], bot, pts[2], top, lerp(pts[2], pts[4], 0.55), top, lerp(pts[0], pts[6], 0.55), bot]);
    ctx.fillStyle = BARK.shade;
    poly(ctx, [lerp(pts[0], pts[6], 0.82), bot, lerp(pts[2], pts[4], 0.82), top, pts[4], top, pts[6], bot]);
    const step = Math.max(g.U * 2.4, w * 3.2);
    for (let y = bot - step * (0.4 + rand() * 0.6); y > top; y -= step * (0.5 + rand() * 0.9)) {
      const f = (bot - y) / (bot - top);
      const cx = x + lean * f + (rand() - 0.5) * w * 0.3;
      const mw = w * (0.22 + rand() * 0.34);
      ctx.fillStyle = BARK.mark;
      ctx.globalAlpha = near ? 0.9 : 0.6;
      blob(ctx, cx, y, mw, Math.max(0.5, w * 0.045));
      if (rand() < 0.4) blob(ctx, cx + w * 0.1, y + w * 0.16, mw * 0.55, Math.max(0.5, w * 0.035));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = BARK.warm;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - w / 2, bot - w * 0.5, w, w * 0.5);
    ctx.globalAlpha = 1;
    const tx = x + lean;
    const nl = near ? 3 : 2;
    for (let i = 0; i < nl; i++) {
      const ly = lerp(top, bot, 0.15 + rand() * 0.4);
      limb(ctx, rand, tx, ly, g.U * (7 + rand() * 7), Math.max(1, w * 0.1), i % 2 ? 1 : -1, BARK.shade);
    }
    return tx;
  }

  function row(ctx, g, rand, count, y0, top, w0, w1, near, crowns) {
    const span = g.W + w1 * 4;
    for (let i = 0; i < count; i++) {
      const x = -w1 * 2 + (i + 0.2 + rand() * 0.6) * (span / count);
      const w = lerp(w0, w1, rand());
      const tx = trunk(ctx, g, rand, x, top, y0 + rand() * g.U * 1.5, w, near);
      if (crowns) crownBlobs(ctx, g, rand, tx, top + g.U * 3, g.U * (7 + rand() * 6));
    }
  }

  function sasa(ctx, g, rand, y0, y1, density, size) {
    for (let i = 0; i < density; i++) {
      const x = rand() * g.W;
      const y = lerp(y0, y1, Math.pow(rand(), 0.8));
      const h = size * (0.6 + rand() * 0.9) * (0.5 + (y - y0) / (y1 - y0));
      ctx.strokeStyle = SASA[Math.floor(rand() * SASA.length)];
      ctx.lineWidth = Math.max(1, size * 0.14);
      const lean = (rand() - 0.5) * h * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h);
      ctx.stroke();
    }
  }

  function fence(ctx, g, y, x0, x1, span) {
    const u = g.U * 1.6;
    const post = Math.max(2, u * 1.2);
    ctx.fillStyle = '#4a3b2b';
    for (let x = x0; x <= x1; x += span) ctx.fillRect(x - post / 2, y - u * 9, post, u * 10);
    ctx.fillStyle = '#7b6648';
    for (let x = x0; x < x1; x += span) {
      ctx.fillRect(x, y - u * 7.2, span, Math.max(1, u * 0.9));
      ctx.fillRect(x, y - u * 4, span, Math.max(1, u * 0.9));
    }
    ctx.fillStyle = '#a89a78';
    for (let x = x0; x < x1; x += span) ctx.fillRect(x, y - u * 7.2, span, Math.max(1, u * 0.3));
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.gy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ridge(ctx, g, 0.3, 0.12, 3, '#6a7f86');
    ridge(ctx, g, 0.4, 0.1, 5, '#58706f');
    fogOver(ctx, g, 0.25);
    row(ctx, g, rand, Math.round(g.W / (g.U * 14)), g.gy, g.H * 0.12, g.U * 3.2, g.U * 4.6, false, true);
    fogOver(ctx, g, 0.35);
    row(ctx, g, rand, Math.round(g.W / (g.U * 26)), g.gy + g.U * 2, -g.U * 4, g.U * 6.5, g.U * 9, false, true);
    fogOver(ctx, g, 0.12);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gy = g.gy;
    const grad = ctx.createLinearGradient(0, gy - g.U * 3, 0, g.H);
    grad.addColorStop(0, '#7f8c74');
    grad.addColorStop(0.12, EARTH[2]);
    grad.addColorStop(0.4, EARTH[1]);
    grad.addColorStop(1, EARTH[0]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, gy - g.U * 3, g.W, g.H - gy + g.U * 3);
    sasa(ctx, g, rand, gy - g.U * 3, gy + g.U * 8, 320, g.U * 5);
    fence(ctx, g, gy + g.U * 9, -g.U * 4, g.W + g.U * 4, g.U * 22);
    row(ctx, g, rand, Math.max(3, Math.round(g.W / (g.U * 60))), g.H * 0.98, -g.U * 6, g.U * 12, g.U * 17, true, false);
    sasa(ctx, g, rand, gy + g.U * 8, g.H, 120, g.U * 10);
    ctx.fillStyle = FALL[0];
    for (let i = 0; i < 36; i++) {
      ctx.globalAlpha = 0.5 + rand() * 0.4;
      ctx.fillStyle = FALL[Math.floor(rand() * FALL.length)];
      blob(ctx, rand() * g.W, lerp(gy + g.U * 2, g.H, rand()), g.U * (0.5 + rand() * 0.6), g.U * 0.3);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- light and mist --------------------------------------------------------

  function paintShafts(g) {
    const c = layer(g.W, g.gy);
    const ctx = c.getContext('2d');
    for (let i = 0; i < SHAFTS; i++) {
      const x = g.W * (0.08 + (i / SHAFTS) * 0.9);
      const w = g.U * (9 + (i % 3) * 5);
      const grad = ctx.createLinearGradient(0, 0, 0, g.gy);
      grad.addColorStop(0, 'rgba(250,242,200,0.7)');
      grad.addColorStop(1, 'rgba(248,240,200,0)');
      ctx.fillStyle = grad;
      poly(ctx, [x, 0, x + w, 0, x + w + g.gy * 0.35, g.gy, x + g.gy * 0.35 - w * 0.2, g.gy]);
    }
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.22);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 18), y / (g.U * 6), 4, 61);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = FOG[0];
        img.data[i + 1] = FOG[1];
        img.data[i + 2] = FOG[2];
        img.data[i + 3] = a * 220;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawShafts(ctx, g, t, light) {
    if (light <= 0) return;
    const s = state.shafts;
    ctx.globalAlpha = Math.min(1, light * (0.55 + 0.4 * Math.sin(t * 0.3)));
    ctx.drawImage(s, Math.sin(t * 0.09) * g.U * 7, 0);
    ctx.globalAlpha = Math.min(1, light * (0.4 + 0.35 * Math.sin(t * 0.25 + 2)));
    ctx.drawImage(s, g.U * 9 + Math.sin(t * 0.07 + 1) * g.U * 8, 0);
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 0.8) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.46);
    ctx.drawImage(m, w - a, g.H * 0.46);
    const b = (t * g.U * 0.45 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.5);
    ctx.drawImage(m, b - w, g.H * 0.2);
    ctx.drawImage(m, b, g.H * 0.2);
    ctx.globalAlpha = 1;
  }

  // ---- falling leaves --------------------------------------------------------

  function makeLeaves() {
    const n = MAX_LEAVES;
    return { x: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), p: new Float32Array(n),
      a: new Float32Array(n), s: new Float32Array(n), tone: new Uint8Array(n), wait: new Float32Array(n) };
  }

  function resetLeaf(g, L, i, first) {
    const r = state.rand;
    L.x[i] = g.W * (0.1 + r() * 0.8);
    L.y[i] = first ? g.H * r() * 0.8 : -g.U * 2;
    L.v[i] = g.U * (5 + r() * 3);
    L.p[i] = r() * TAU;
    L.a[i] = r() * TAU;
    L.s[i] = g.U * (2.2 + r() * 1.4);
    L.tone[i] = Math.floor(r() * FALL.length);
    L.wait[i] = first ? 0 : r() * 6;
  }

  function stepLeaf(g, L, i, t, dt) {
    if (L.wait[i] > 0) {
      L.wait[i] -= dt;
      return;
    }
    L.y[i] += L.v[i] * dt;
    L.x[i] += Math.cos(t * 0.9 + L.p[i]) * g.U * 3 * dt + g.U * 0.8 * dt;
    L.a[i] += dt * 0.8;
    if (L.y[i] > g.gy + g.U * 8) resetLeaf(g, L, i, false);
  }

  function drawLeaves(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      if (L.wait[i] > 0) continue;
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + L.p[i]));
      const sz = L.s[i];
      ctx.fillStyle = FALL[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.shafts = paintShafts(g);
    state.mist = paintMist(g);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { light, mist, leaves } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(5 * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawShafts(ctx, g, t, light);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.front, 0, 0);
    drawLeaves(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { light: 1, mist: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
