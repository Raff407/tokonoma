/*
 * 张家界 Zhangjiajie — sandstone pillars standing out of a sea of cloud, in the manner of an ink landscape.
 *
 * Three ranks of pillars (far, middle, near) are baked once, each with pines on top.
 * Cloud banks are tiling layers that slide at their own pace, and soft mist strips
 * drift over them. A handful of cranes cross between the middle and near ranks.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#b9c1bd', '#cbd0c4', '#dcdac8', '#e8e0c6', '#eddfbd'];
  const RANKS = {
    far: { base: '#9fabaa', shade: '#8a9796', light: '#b4bfbb', stain: '#aaa89a', moss: ['#7f9082', '#92a28c'], trunk: '#6d7a78' },
    mid: { base: '#6e7d7b', shade: '#53625f', light: '#8a9791', stain: '#7d7762', moss: ['#4f6a58', '#6c8560'], trunk: '#3d4a47' },
    near: { base: '#454f4d', shade: '#2c3634', light: '#66695d', stain: '#6a5a42', moss: ['#334f3a', '#5a7a47'], trunk: '#252d2b' },
  };
  const SEA = { far: ['#d8d7c8', '#e6e3d2'], mid: ['#dedbca', '#ece8d6'], near: ['#e6e1ce', '#f1ecdb'] };
  const MIST = '#ebe5d2';
  const CRANES = 4;
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
    return { W, H, U };
  }

  // ---- sky -------------------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.7)) * (inks.length - 1);
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
    ctx.fillStyle = '#e4cf93';
    blob(ctx, g.W * 0.74, g.H * 0.2, g.U * 7, g.U * 7);
    ctx.fillStyle = '#ecdca4';
    blob(ctx, g.W * 0.74, g.H * 0.2, g.U * 5, g.U * 5);
    return c;
  }

  // ---- pines -----------------------------------------------------------------

  // A flat-topped pine of the Huangshan kind: a leaning trunk with a few wide pads of needles.
  function pine(ctx, x, y, h, ink, rand) {
    const lean = h * (rand() - 0.5) * 0.5;
    ctx.strokeStyle = ink.trunk;
    ctx.lineWidth = Math.max(1, h * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - lean, y - h * 0.5, x + lean, y - h * 0.85);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const f = 0.55 + i * 0.2;
      const side = i % 2 ? 1 : -1;
      const px = x + lean * f + side * h * 0.22 * (1.05 - f * 0.5);
      const py = y - h * f;
      const w = h * (0.34 - i * 0.05);
      ctx.fillStyle = ink.moss[0];
      blob(ctx, px, py, w, w * 0.34);
      ctx.fillStyle = ink.moss[1];
      blob(ctx, px - w * 0.1, py - w * 0.16, w * 0.7, w * 0.2);
    }
  }

  function shrub(ctx, x, y, r, ink) {
    ctx.fillStyle = ink.moss[0];
    blob(ctx, x, y, r, r * 0.7);
    ctx.fillStyle = ink.moss[1];
    blob(ctx, x - r * 0.25, y - r * 0.25, r * 0.55, r * 0.35);
  }

  // ---- pillars ---------------------------------------------------------------

  // Half widths down a pillar: a domed cap, a neck, then ledges and a slow flare toward the cloud.
  function halfWidth(w, f, seed, U) {
    const cap = Math.exp(-(((f - 0.02) / 0.03) ** 2)) * 0.14;
    const neck = Math.exp(-(((f - 0.09) / 0.025) ** 2)) * 0.1;
    const ledge = (fbm(f * 9, 2.3, 3, seed) - 0.5) * 0.3;
    return (w / 2) * (0.92 + cap - neck + ledge + f * 0.22);
  }

  function pillar(ctx, g, rand, x, top, w, bot, ink, seed, treeH) {
    const U = g.U;
    const step = Math.max(1, U * 0.7);
    const len = bot - top;
    const left = [];
    const right = [];
    for (let y = top; y <= bot; y += step) {
      const f = (y - top) / len;
      const hw = halfWidth(w, f, seed, U);
      const sway = (fbm(f * 3, 7.1, 2, seed + 3) - 0.5) * w * 0.25;
      left.push(x + sway - hw, y);
      right.push(x + sway + hw, y);
    }
    const pts = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(left[0] + (right[0] - left[0]) * t, top + (1 - Math.sqrt(1 - (2 * t - 1) ** 2)) * U * 1.4 * -1 + U * 1.4);
    }
    for (let i = 0; i < right.length; i += 2) pts.push(right[i], right[i + 1]);
    for (let i = left.length - 2; i >= 0; i -= 2) pts.push(left[i], left[i + 1]);
    ctx.save();
    ctx.fillStyle = ink.base;
    poly(ctx, pts);
    ctx.clip();
    // shadow flank on the right
    ctx.fillStyle = ink.shade;
    for (let i = 0; i < left.length; i += 2) {
      const cx = (left[i] + right[i]) / 2;
      const hw = (right[i] - left[i]) / 2;
      const sx = cx + hw * (0.0 + 0.3 * fbm(i * 0.3, 1.7, 2, seed + 9));
      ctx.fillRect(sx, left[i + 1], right[i] - sx + 1, step + 1);
    }
    // lit left edge
    ctx.fillStyle = ink.light;
    for (let i = 0; i < left.length; i += 2) {
      const hw = (right[i] - left[i]) / 2;
      ctx.fillRect(left[i], left[i + 1], hw * (0.12 + 0.12 * fbm(i * 0.4, 5.1, 2, seed + 5)), step + 1);
    }
    // columnar joints
    const lines = Math.max(3, Math.round(w / (U * 1.6)));
    for (let k = 0; k < lines; k++) {
      const fx = (k + 0.5 + (rand() - 0.5) * 0.6) / lines;
      const y0 = top + len * rand() * 0.5;
      const y1 = y0 + len * (0.2 + rand() * 0.5);
      ctx.fillStyle = rand() < 0.6 ? ink.shade : ink.light;
      ctx.globalAlpha = 0.7;
      for (let y = y0; y < y1 && y < bot; y += step) {
        const i = Math.min(left.length - 2, Math.floor((y - top) / step) * 2);
        const px = left[i] + (right[i] - left[i]) * fx;
        ctx.fillRect(px, y, Math.max(1, U * 0.3), step + 0.5);
      }
    }
    // iron-stained bands of warm stone
    ctx.fillStyle = ink.stain;
    ctx.globalAlpha = 0.55;
    for (let b = 0; b < 4; b++) {
      const y = top + len * (0.1 + rand() * 0.6);
      ctx.fillRect(x - w, y, w * 2, U * (0.5 + rand() * 1.1));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // moss and small trees on ledges
    for (let i = 4; i < left.length; i += 2) {
      if (rand() < 0.14) shrub(ctx, left[i] + (rand() - 0.3) * U, left[i + 1], U * (0.9 + rand() * 0.9), ink);
      if (rand() < 0.1) shrub(ctx, right[i] + (rand() - 0.7) * U, right[i + 1], U * (0.8 + rand() * 0.8), ink);
    }
    // crown of trees
    const hw0 = w * 0.42;
    const cx = (left[0] + right[0]) / 2;
    const count = Math.max(2, Math.round(w / (U * 3.2)));
    for (let k = 0; k < count; k++) {
      const tx = cx + (((k + 0.5) / count) * 2 - 1) * hw0 + (rand() - 0.5) * U;
      const ty = top + U * 1.1 - ((1 - Math.abs((tx - cx) / hw0)) * 0.3 - 0.3) * 0;
      if (rand() < 0.28) shrub(ctx, tx, ty, treeH * (0.3 + rand() * 0.15), ink);
      else pine(ctx, tx, ty, treeH * (0.7 + rand() * 0.5), ink, rand);
    }
    return { x: cx, top };
  }

  function pavilion(ctx, g, x, y, s) {
    ctx.fillStyle = '#3a3d3e';
    ctx.fillRect(x - s * 1.7, y - s * 0.5, s * 3.4, s * 0.5);
    ctx.fillStyle = '#9c3f2b';
    for (const dx of [-1.3, -0.45, 0.45, 1.3]) ctx.fillRect(x + dx * s - s * 0.1, y - s * 2.6, Math.max(1, s * 0.2), s * 2.2);
    ctx.fillStyle = '#d6c9a6';
    ctx.fillRect(x - s * 1.3, y - s * 2.1, s * 2.6, Math.max(1, s * 0.25));
    ctx.fillStyle = '#2d3844';
    ctx.beginPath();
    ctx.moveTo(x - s * 2.5, y - s * 3.9);
    ctx.quadraticCurveTo(x - s * 1.6, y - s * 3.0, x - s * 1.1, y - s * 2.85);
    ctx.lineTo(x + s * 1.1, y - s * 2.85);
    ctx.quadraticCurveTo(x + s * 1.6, y - s * 3.0, x + s * 2.5, y - s * 3.9);
    ctx.quadraticCurveTo(x + s * 1.3, y - s * 3.5, x + s * 0.6, y - s * 4.7);
    ctx.lineTo(x - s * 0.6, y - s * 4.7);
    ctx.quadraticCurveTo(x - s * 1.3, y - s * 3.5, x - s * 2.5, y - s * 3.9);
    ctx.fill();
    ctx.fillStyle = '#c9a54e';
    ctx.fillRect(x - s * 0.1, y - s * 5.3, Math.max(1, s * 0.2), s * 0.7);
  }

  function paintRank(g, rand, specs, ink, treeH, withPavilion) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    let n = 0;
    for (const s of specs) {
      const p = pillar(ctx, g, rand, g.W * s[0], g.H * s[1], g.U * s[2], g.H * 1.05, ink, 100 + n * 17, treeH * (s[3] || 1));
      if (withPavilion === n) pavilion(ctx, g, p.x + g.U * 1.2, p.top + g.U * 1.4, g.U * 1.55);
      n++;
    }
    return c;
  }

  // ---- cloud ----------------------------------------------------------------

  // A cloud bank that tiles sideways: scalloped top edge, solid below.
  function paintSea(g, rand, y, amp, tones) {
    const top = Math.max(0, Math.floor(y - amp * 3));
    const c = layer(g.W, g.H - top);
    const ctx = c.getContext('2d');
    const U = g.U;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = tones[pass];
      for (let x = 0; x < g.W; x += U * (2.5 + rand() * 3.5)) {
        const r = U * (3 + rand() * 5) * (pass ? 0.6 : 1);
        const by = y - top + (rand() - 0.5) * amp - (pass ? r * 0.18 : 0);
        for (const o of [-g.W, 0, g.W]) blob(ctx, x + o, by, r, r * 0.42);
      }
    }
    ctx.fillStyle = tones[0];
    ctx.fillRect(0, y - top + amp, g.W, g.H);
    return { c, top };
  }

  function drawSea(ctx, g, sea, t, speed) {
    const a = (t * g.U * speed) % g.W;
    ctx.drawImage(sea.c, -a, sea.top);
    ctx.drawImage(sea.c, g.W - a, sea.top);
  }

  function paintMist(g, seed, hr) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * hr);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const m = K.parseColor(MIST);
    const f = (x, y) => fbm(x / (g.U * 22), y / (g.U * 5), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.58, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = m[0];
        img.data[i + 1] = m[1];
        img.data[i + 2] = m[2];
        img.data[i + 3] = a * 210;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, strip, y, speed, amount, phase) {
    if (amount <= 0) return;
    const w = strip.width;
    const a = (t * g.U * speed + w * phase) % w;
    ctx.globalAlpha = Math.min(1, amount);
    ctx.drawImage(strip, -a, y);
    ctx.drawImage(strip, w - a, y);
    ctx.globalAlpha = 1;
  }

  // ---- cranes ----------------------------------------------------------------

  function makeCranes(g, rand) {
    const f = () => new Float32Array(CRANES);
    const s = { x: f(), y: f(), v: f(), p: f(), z: f() };
    for (let i = 0; i < CRANES; i++) {
      s.x[i] = rand() * g.W;
      s.y[i] = g.H * (0.2 + rand() * 0.35);
      s.v[i] = g.U * (2.2 + rand() * 1.4);
      s.p[i] = rand() * TAU;
      s.z[i] = 0.8 + rand() * 0.5;
    }
    return s;
  }

  function drawCranes(ctx, g, t, count) {
    const s = state.cranes;
    ctx.strokeStyle = '#2b3236';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    for (let i = 0; i < count; i++) {
      const span = g.W + g.U * 20;
      const x = ((s.x[i] + t * s.v[i]) % span) - g.U * 10;
      const y = s.y[i] + Math.sin(t * 0.3 + s.p[i]) * g.U * 2;
      const L = g.U * 2.4 * s.z[i];
      const flap = Math.sin(t * 2.6 + s.p[i]) * L * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - L, y + flap * 0.4);
      ctx.quadraticCurveTo(x - L * 0.4, y - flap, x, y);
      ctx.quadraticCurveTo(x + L * 0.4, y - flap, x + L, y + flap * 0.4);
      ctx.moveTo(x, y);
      ctx.lineTo(x + L * 0.75, y + L * 0.05);
      ctx.moveTo(x, y);
      ctx.lineTo(x - L * 0.7, y + L * 0.08);
      ctx.stroke();
    }
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.far = paintRank(g, rand, [
      [0.05, 0.3, 5], [0.17, 0.2, 6], [0.3, 0.34, 4.5], [0.43, 0.24, 6], [0.56, 0.3, 5], [0.69, 0.18, 6], [0.82, 0.28, 5], [0.94, 0.22, 6],
    ], RANKS.far, g.U * 4, -1);
    state.mid = paintRank(g, rand, [
      [0.1, 0.22, 7, 1.1], [0.27, 0.1, 6], [0.43, 0.3, 6.5], [0.6, 0.06, 8, 1.2], [0.77, 0.2, 6.5], [0.95, 0.14, 7],
    ], RANKS.mid, g.U * 6.5, 3);
    state.near = paintRank(g, rand, [
      [0.03, 0.1, 13, 1.2], [0.36, 0.34, 8, 0.9], [0.9, 0.04, 15, 1.25],
    ], RANKS.near, g.U * 10, -1);
    state.seaFar = paintSea(g, rand, g.H * 0.64, g.U * 3, SEA.far);
    state.seaMid = paintSea(g, rand, g.H * 0.8, g.U * 3, SEA.mid);
    state.seaNear = paintSea(g, rand, g.H * 0.94, g.U * 3, SEA.near);
    state.mistA = paintMist(g, 77, 0.2);
    state.mistB = paintMist(g, 91, 0.22);
    state.mistC = paintMist(g, 53, 0.2);
    state.cranes = makeCranes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, cranes } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    drawSea(ctx, g, state.seaFar, t, 0.7);
    drawMist(ctx, g, t, state.mistA, g.H * 0.3, 1.2, mist * 0.8, 0);
    ctx.drawImage(state.mid, 0, 0);
    drawSea(ctx, g, state.seaMid, t, 1.3);
    drawMist(ctx, g, t, state.mistB, g.H * 0.5, 2.2, mist * 0.9, 0.4);
    if (cranes) drawCranes(ctx, g, t, CRANES);
    ctx.drawImage(state.near, 0, 0);
    drawSea(ctx, g, state.seaNear, t, 2.2);
    drawMist(ctx, g, t, state.mistC, g.H * 0.68, 3.2, mist * 0.9, 0.7);
  }

  Kasuri.run({
    defaults: { mist: 1, cranes: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
