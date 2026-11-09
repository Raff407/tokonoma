/*
 * 平泉 Hiraizumi — a small golden hall under its timber canopy in a mossy cedar grove.
 *
 * Sky, cedar trunks, ground, hall and lantern are baked once. Per frame: a mist strip
 * slides across, soft light shafts breathe slowly and a short pool of maple and
 * ginkgo leaves drifts down.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.82;
  const SKY = ['#8f9d95', '#a7b2a6', '#bcc4b4', '#cfd2bf'];
  const TRUNK = ['#46564a', '#33443a', '#222f27'];
  const FOLIAGE = ['#2c4034', '#223329', '#18261f'];
  const FOG = '#bcc5b6';
  const GOLD = { lit: '#d9b552', mid: '#bd9638', dark: '#8d6d28', shine: '#f0d98c' };
  const WOOD = { post: '#3a2b20', beam: '#2c211a', inner: '#1c1713', bracket: '#4a382a' };
  const TILE = { slope: '#3d4245', line: '#555b5c', side: '#2e3234', ridge: '#25282a' };
  const MOSS = ['#3b5233', '#4d6740', '#6a8450'];
  const LEAF_TONES = ['#b8432b', '#cf6a35', '#c4422b', '#d9ac4a'];
  const MAX_LEAVES = 36;
  const LEAVES = 18;
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
    const u = U * Math.min(1, W / (U * 120));
    return { W, H, U, u, gy: Math.round(H * GROUND), cx: W * 0.5 };
  }

  // ---- sky and trunks ------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.gy);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.gy; y++) {
      const f = Math.min(1, y / (g.H * 0.6)) * (inks.length - 1);
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
  }

  function crownBand(ctx, g, rand, ink, depth) {
    ctx.fillStyle = ink;
    const size = g.U * (3.2 + depth * 1.2);
    for (let x = -size; x < g.W + size; x += size * (0.7 + rand() * 0.5)) {
      blob(ctx, x, g.H * (0.02 + depth * 0.02) + rand() * g.U * 3, size * (0.8 + rand() * 0.6), size * (0.9 + rand() * 0.8));
    }
  }

  function trunk(ctx, g, rand, x, w, ink, shade, top) {
    ctx.fillStyle = ink;
    poly(ctx, [x - w / 2, top, x + w / 2, top, x + w / 2 + w * 0.05, g.gy - w, x + w * 0.9, g.gy + 1, x - w * 0.9, g.gy + 1, x - w / 2 - w * 0.05, g.gy - w]);
    ctx.fillStyle = shade;
    ctx.fillRect(x + w * 0.12, top, w * 0.36, g.gy - top);
    ctx.fillStyle = ink;
    for (let y = top + g.U * 3; y < g.gy; y += g.U * (3 + rand() * 6)) {
      ctx.fillRect(x - w * 0.3 + rand() * w * 0.5, y, Math.max(1, w * 0.07), g.U * (1.5 + rand() * 3));
    }
  }

  function paintGrove(ctx, g, rand) {
    const fog = K.parseColor(FOG);
    for (let depth = 0; depth < 3; depth++) {
      const mixed = K.mixColor(K.parseColor(TRUNK[depth]), fog, 0.5 - depth * 0.2);
      const shade = K.mixColor(K.parseColor(FOLIAGE[depth]), fog, 0.5 - depth * 0.2);
      const hex = (c) => 'rgb(' + c.map(Math.round).join(',') + ')';
      const n = 7 - depth * 1.5;
      const w = g.U * (1.3 + depth * 1.1);
      crownBand(ctx, g, rand, hex(shade), depth);
      for (let i = 0; i < n; i++) {
        const x = (i + 0.2 + rand() * 0.6) * (g.W / n);
        trunk(ctx, g, rand, x, w * (0.8 + rand() * 0.5), hex(mixed), hex(shade), g.H * 0.02);
      }
      if (depth < 2) {
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = FOG;
        ctx.fillRect(0, 0, g.W, g.gy);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---- ground ---------------------------------------------------------------

  function paintGround(ctx, g, rand) {
    const h = g.H - g.gy;
    ctx.fillStyle = MOSS[0];
    ctx.fillRect(0, g.gy - g.U * 0.6, g.W, h + g.U * 0.6);
    for (let i = 0; i < 90; i++) {
      const y = g.gy + rand() * h;
      const k = (y - g.gy) / h;
      const x = rand() * g.W;
      ctx.fillStyle = MOSS[1 + (rand() < 0.4 ? 1 : 0)];
      blob(ctx, x, y, g.U * (2 + k * 5) * (0.6 + rand()), g.U * (0.5 + k * 1.2) * (0.6 + rand()));
    }
    // stone path leading to the hall
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      const y = g.gy + g.U * 1.5 + k * (h - g.U * 2.2);
      const rx = g.u * (3 + k * 5);
      ctx.fillStyle = '#6f7268';
      blob(ctx, g.cx + (i % 2 ? 1 : -1) * g.u * 0.8, y, rx, rx * 0.22);
      ctx.fillStyle = '#9a9c8c';
      blob(ctx, g.cx + (i % 2 ? 1 : -1) * g.u * 0.8 - rx * 0.1, y - rx * 0.06, rx * 0.8, rx * 0.12);
    }
    // ferns at the edges
    for (let i = 0; i < 18; i++) {
      const x = rand() < 0.5 ? rand() * g.W * 0.25 : g.W * (0.75 + rand() * 0.25);
      const y = g.gy + h * (0.15 + rand() * 0.8);
      ctx.strokeStyle = MOSS[2];
      ctx.lineWidth = Math.max(1, g.U * 0.3);
      for (let j = -2; j <= 2; j++) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + j * g.U * 0.9, y - g.U * 2.2, x + j * g.U * 1.7, y - g.U * (1.2 + (2 - Math.abs(j)) * 0.5));
        ctx.stroke();
      }
    }
  }

  // ---- the hall -------------------------------------------------------------

  function goldHall(ctx, g, base) {
    const u = g.u;
    const hw = u * 8.5;
    const top = base - u * 7.2;
    ctx.fillStyle = GOLD.lit;
    ctx.fillRect(g.cx - hw, top, hw * 2, base - top);
    ctx.fillStyle = GOLD.mid;
    for (let i = 0; i <= 4; i++) ctx.fillRect(g.cx - hw + (i / 4) * (hw * 2 - u * 0.7), top, Math.max(1, u * 0.7), base - top);
    ctx.fillStyle = WOOD.inner;
    ctx.fillRect(g.cx - hw * 0.25, top + u * 1.4, hw * 0.5, base - top - u * 1.4);
    ctx.fillStyle = GOLD.dark;
    ctx.fillRect(g.cx - hw * 0.25, top + u * 1.4, Math.max(1, u * 0.4), base - top - u * 1.4);
    ctx.fillRect(g.cx + hw * 0.25 - Math.max(1, u * 0.4), top + u * 1.4, Math.max(1, u * 0.4), base - top - u * 1.4);
    ctx.fillStyle = GOLD.shine;
    ctx.fillRect(g.cx - hw, top, hw * 2, Math.max(1, u * 0.5));
    for (const s of [-1, 1]) {
      ctx.fillStyle = GOLD.dark;
      ctx.fillRect(g.cx + s * hw * 0.62 - u * 0.9, top + u * 2, u * 1.8, u * 3.2);
      ctx.fillStyle = GOLD.shine;
      ctx.fillRect(g.cx + s * hw * 0.62 - u * 0.5, top + u * 2.4, u * 1, u * 2.4);
    }
    // small gold eave over the hall
    const ey = top - u * 0.2;
    ctx.fillStyle = GOLD.dark;
    poly(ctx, [g.cx - hw - u * 2, ey + u * 0.8, g.cx + hw + u * 2, ey + u * 0.8, g.cx + hw, ey - u * 0.4, g.cx - hw, ey - u * 0.4]);
    ctx.fillStyle = GOLD.lit;
    poly(ctx, [g.cx - hw - u * 1.6, ey - u * 0.2, g.cx + hw + u * 1.6, ey - u * 0.2, g.cx + hw * 0.5, ey - u * 3.2, g.cx - hw * 0.5, ey - u * 3.2]);
    ctx.fillStyle = GOLD.shine;
    ctx.fillRect(g.cx - hw * 0.5, ey - u * 3.2, hw, Math.max(1, u * 0.35));
    ctx.fillStyle = GOLD.mid;
    ctx.fillRect(g.cx - u * 0.25, ey - u * 5.2, Math.max(1, u * 0.5), u * 2);
    blob(ctx, g.cx, ey - u * 5.4, u * 0.7, u * 0.6);
  }

  function canopyRoof(ctx, g, ye) {
    const u = g.u;
    const hw = u * 27;
    const ridgeHw = u * 9;
    const rise = u * 12;
    const eave = (x) => {
      const d = Math.max(0, (Math.abs(x - g.cx) - hw * 0.6) / (hw * 0.4));
      return ye - u * 1.6 * d * d;
    };
    const flank = (x) => {
      const q = Math.min(1, Math.max(0, (hw - Math.abs(x - g.cx)) / (hw - ridgeHw)));
      return eave(x) - u * 1.4 - rise * Math.pow(q, 1.6);
    };
    const under = [];
    const fascia = [];
    const slope = [];
    for (let i = 0; i <= 28; i++) {
      const x = lerp(g.cx - hw, g.cx + hw, i / 28);
      under.push(x, eave(x) + u * 0.9 * Math.sqrt(1 - Math.abs(i / 14 - 1)));
      fascia.push(x, eave(x) - u * 1.4);
      slope.push(x, flank(x));
    }
    for (let i = 28; i >= 0; i--) {
      const x = lerp(g.cx - hw, g.cx + hw, i / 28);
      under.push(x, eave(x) - 1);
      fascia.push(x, eave(x));
    }
    ctx.fillStyle = WOOD.beam;
    poly(ctx, under);
    ctx.fillStyle = TILE.side;
    poly(ctx, fascia);
    const top = [g.cx - ridgeHw, ye - u * 1.4 - rise, g.cx + ridgeHw, ye - u * 1.4 - rise];
    ctx.fillStyle = TILE.slope;
    poly(ctx, top.concat(slope.slice(-2)).concat(slope.slice(0, 2)).reverse());
    // flanks of the pyramid plus the trapezoid between them
    ctx.fillStyle = TILE.slope;
    const body = [];
    for (let i = 0; i <= 28; i++) body.push(slope[i * 2], slope[i * 2 + 1]);
    poly(ctx, body);
    ctx.fillStyle = TILE.side;
    const right = [g.cx + ridgeHw, flank(g.cx + ridgeHw)];
    for (let i = 0; i <= 14; i++) {
      const x = lerp(g.cx + ridgeHw, g.cx + hw, i / 14);
      right.push(x, flank(x));
    }
    right.push(g.cx + ridgeHw + u * 3, eave(g.cx + ridgeHw + u * 3) - u * 1.4);
    poly(ctx, right);
    // tile rows
    ctx.strokeStyle = TILE.line;
    ctx.lineWidth = Math.max(1, u * 0.3);
    for (let i = 1; i < 14; i++) {
      const x0 = lerp(g.cx - hw * 0.95, g.cx + hw * 0.95, i / 14);
      const x1 = g.cx + (x0 - g.cx) * (ridgeHw / hw);
      ctx.beginPath();
      ctx.moveTo(x0, eave(x0) - u * 1.5);
      ctx.lineTo(x1, ye - u * 1.4 - rise + u * 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = TILE.ridge;
    ctx.fillRect(g.cx - ridgeHw - u * 0.6, ye - u * 1.4 - rise - u * 0.7, ridgeHw * 2 + u * 1.2, u * 1.1);
    for (const s of [-1, 1]) {
      blob(ctx, g.cx + s * (ridgeHw + u * 0.4), ye - u * 1.4 - rise - u * 1.6, u * 0.9, u * 1.5);
    }
    // moss along the eaves
    ctx.fillStyle = MOSS[1];
    for (let i = 0; i < 22; i++) {
      const x = lerp(g.cx - hw * 0.9, g.cx + hw * 0.9, (i * 0.618) % 1);
      blob(ctx, x, eave(x) - u * 1.7, u * (0.8 + (i % 3) * 0.5), u * 0.4);
    }
  }

  function paintHall(g, rand) {
    const c = layer(g.W, g.gy + g.U * 3);
    const ctx = c.getContext('2d');
    const u = g.u;
    const base = g.gy - u * 0.4;
    const ye = base - u * 14;
    ctx.fillStyle = '#6a6c62';
    ctx.fillRect(g.cx - u * 28, g.gy - u * 1.4, u * 56, u * 1.6);
    ctx.fillStyle = '#8e9082';
    ctx.fillRect(g.cx - u * 28, g.gy - u * 1.4, u * 56, Math.max(1, u * 0.4));
    ctx.fillStyle = WOOD.inner;
    ctx.fillRect(g.cx - u * 22, ye, u * 44, base - ye - u * 1);
    goldHall(ctx, g, base - u * 1);
    // timber posts, beam, brackets
    ctx.fillStyle = WOOD.post;
    for (let i = 0; i <= 4; i++) ctx.fillRect(g.cx - u * 22 + (i / 4) * u * 44 - u * 0.5, ye, Math.max(1, u * 1), base - ye);
    ctx.fillStyle = WOOD.beam;
    ctx.fillRect(g.cx - u * 24, ye, u * 48, u * 1.3);
    ctx.fillStyle = WOOD.bracket;
    for (let i = 0; i <= 4; i++) {
      const x = g.cx - u * 22 + (i / 4) * u * 44;
      ctx.fillRect(x - u * 1.3, ye - u * 0.2, u * 2.6, u * 0.9);
    }
    canopyRoof(ctx, g, ye);
    return c;
  }

  function paintLantern(g) {
    const c = layer(g.W, g.gy + g.U * 3);
    const ctx = c.getContext('2d');
    const u = g.U;
    const x = g.cx - g.u * 38;
    const y = g.gy + u * 2;
    ctx.fillStyle = '#7a7b70';
    ctx.fillRect(x - u * 2, y - u * 1.2, u * 4, u * 1.2);
    ctx.fillRect(x - u * 0.7, y - u * 6, u * 1.4, u * 4.8);
    ctx.fillRect(x - u * 1.8, y - u * 7.2, u * 3.6, u * 1.2);
    ctx.fillStyle = '#5c5e55';
    ctx.fillRect(x - u * 1.5, y - u * 10, u * 3, u * 2.8);
    ctx.fillStyle = '#e0c070';
    ctx.fillRect(x - u * 0.7, y - u * 9.4, u * 1.4, u * 1.6);
    ctx.fillStyle = '#6c6e63';
    poly(ctx, [x - u * 3, y - u * 10, x + u * 3, y - u * 10, x + u * 1.2, y - u * 12, x - u * 1.2, y - u * 12]);
    ctx.fillStyle = '#8e9082';
    blob(ctx, x, y - u * 12.4, u * 0.8, u * 0.7);
    ctx.fillStyle = MOSS[1];
    blob(ctx, x - u * 1, y - u * 12, u * 1.4, u * 0.4);
    blob(ctx, x + u * 1.5, y - u * 0.5, u * 1.6, u * 0.5);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sides = [g.W * 0.05, g.W * 0.955];
    sides.forEach((x, i) => {
      const w = g.U * (6 + i * 1.5);
      trunk(ctx, g, rand, x, w, '#202c25', '#161f1a', -g.U);
      ctx.fillStyle = MOSS[0];
      blob(ctx, x - w * 0.2, g.gy - g.U * 1.5, w * 0.9, g.U * 2.2);
      ctx.fillStyle = MOSS[1];
      blob(ctx, x - w * 0.1, g.gy - g.U * 2.4, w * 0.55, g.U * 1.2);
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = MOSS[k % 2];
        blob(ctx, x + (rand() - 0.5) * w * 0.6, g.H * (0.35 + rand() * 0.45), w * 0.18, g.U * (1.2 + rand() * 2));
      }
    });
    ctx.fillStyle = FOLIAGE[2];
    for (let x = -g.U * 2; x < g.W * 0.16; x += g.U * 3) blob(ctx, x, g.U * (1 + (x * 7 % 3)), g.U * 4, g.U * 3.5);
    for (let x = g.W * 0.86; x < g.W + g.U * 3; x += g.U * 3) blob(ctx, x, g.U * (1 + (x * 5 % 3)), g.U * 4, g.U * 3.5);
    return c;
  }

  // ---- light shafts, mist ---------------------------------------------------

  function paintBeams(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4ead0';
    const starts = [0.18, 0.34, 0.62, 0.8];
    starts.forEach((s, i) => {
      ctx.globalAlpha = 0.1 + (i % 2) * 0.04;
      const w = g.U * (3.5 + i * 1.2);
      poly(ctx, [g.W * s, 0, g.W * s + w, 0, g.W * s + w + g.U * 22, g.gy, g.W * s + g.U * 22 - w * 0.2, g.gy]);
    });
    ctx.globalAlpha = 1;
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 14), y / (g.U * 4), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.6, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 224;
        img.data[i + 1] = 228;
        img.data[i + 2] = 214;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 1.0) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.58);
    ctx.drawImage(m, w - a, g.H * 0.58);
    const b = (t * g.U * 0.55 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.45);
    ctx.drawImage(m, b - w, g.H * 0.3);
    ctx.drawImage(m, b, g.H * 0.3);
    ctx.globalAlpha = 1;
  }

  // ---- leaves ---------------------------------------------------------------

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), land: f(), timer: f(), tone: f() };
  }

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = r() * g.W;
    L.y[i] = -g.U * 2;
    L.land[i] = g.H * (0.86 + r() * 0.12);
    L.vy[i] = g.U * (2.2 + r() * 1.6);
    L.vx[i] = g.U * (0.4 + r() * 0.8);
    L.size[i] = g.U * (1.3 + r() * 0.9);
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
    L.spin[i] = (r() - 0.5) * 3;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
    L.timer[i] = 0;
    if (scatter) L.y[i] = r() * L.land[i];
  }

  function stepLeaf(g, L, i, t, dt) {
    if (L.timer[i] > 0) {
      L.timer[i] -= dt;
      if (L.timer[i] <= 0) resetLeaf(g, L, i, false);
      return;
    }
    L.y[i] += L.vy[i] * dt;
    L.x[i] += (L.vx[i] + Math.sin(t * 1.1 + L.p[i]) * g.U * 2.2) * dt;
    L.a[i] += L.spin[i] * dt;
    if (L.y[i] >= L.land[i]) L.timer[i] = 2 + state.rand() * 6;
  }

  function drawLeaves(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      const resting = L.timer[i] > 0;
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = resting ? 0.35 : 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + L.p[i]));
      const sz = L.size[i];
      ctx.globalAlpha = resting ? Math.min(1, L.timer[i] / 2) : 1;
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, rand);
    paintGrove(bctx, g, rand);
    paintGround(bctx, g, rand);
    state.back = back;
    state.hall = paintHall(g, rand);
    state.lantern = paintLantern(g);
    state.front = paintFront(g, rand);
    state.beams = paintBeams(g);
    state.mist = paintMist(g);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, leaves, light } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    ctx.globalAlpha = Math.min(1, light * (0.7 + 0.3 * Math.sin(t * 0.25)));
    ctx.drawImage(state.beams, 0, 0);
    ctx.globalAlpha = 1;
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.hall, 0, 0);
    ctx.drawImage(state.lantern, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawLeaves(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { mist: 1, leaves: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
