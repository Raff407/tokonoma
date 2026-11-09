/*
 * 古道 Kodo — the old pilgrim path in the Kumano hills.
 *
 * Mossy stone steps climb between tall cedars and vanish into the mist. The haze,
 * trunks, banks and steps are baked once into three depth layers. Two tiling mist
 * strips drift between them, and a short pool of needles falls through the light.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep, lerp } = K;

  const TAU = Math.PI * 2;
  const HAZE = K.parseColor('#c9c8b6');
  const SKY = ['#ddd5bc', '#d2ceb8', '#c3c4b0', '#b3b8a4'];
  const STONE = { tread: '#9a9786', riser: '#706d60', gap: '#4b483f', lip: '#b3ae98' };
  const MOSS = ['#4f5d35', '#65733f', '#7f8a4c', '#3c4a2e'];
  const BANK = ['#46553a', '#526142', '#5d6a45'];
  const BARK = { base: '#5b3c2c', dark: '#43291f', light: '#7d5139', glow: '#9a6a48' };
  const CANOPY = ['#2c3a2d', '#3a4b36', '#4b5d40'];
  const NEEDLE_TONES = ['#c9a453', '#a8743e', '#d8ceb0'];
  const MAX_NEEDLES = 36;
  const NEEDLES = 22;
  const STEP_SPAN = 10;
  const STEP_GROWTH = 0.28;
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

  function quad(ctx, x0, y0, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }

  // Haze is applied in four flat steps so the weave keeps a few clean tones.
  function fogged(hex, z) {
    const f = Math.round(smoothstep(1.2, 7, z) * 4) / 4;
    return K.toHex(K.mixColor(K.parseColor(hex), HAZE, f * 0.82));
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const y0 = H * 1.03;
    const k = (STEP_SPAN * U) / STEP_GROWTH;
    const zTop = Math.exp((y0 - H * 0.34) / k);
    return { W, H, U, y0, k, zTop };
  }

  function groundY(g, z) {
    return g.y0 - g.k * Math.log(z);
  }

  function pathX(g, z) {
    return g.W * 0.45 + g.W * 0.13 / z + g.W * 0.05 * Math.sin(z * 0.7);
  }

  function pathHalf(g, z) {
    return (g.U * 32) / z;
  }

  // ---- far haze ------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    const cx = g.W * 0.42;
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const r = Math.hypot((x - cx) / (g.W * 0.5), (y - g.H * 0.3) / (g.H * 0.5));
        const f = Math.min(1, r) * (inks.length - 1);
        const k = Math.floor(f);
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

  // ---- cedars --------------------------------------------------------------

  function makeTrunks(g, rand) {
    const list = [];
    const bands = [[6.5, 9, 26], [4, 6.5, 18], [2.4, 4, 12], [1.5, 2.4, 7], [1, 1.5, 4]];
    for (const [za, zb, n] of bands) {
      for (let i = 0; i < n; i++) {
        const z = lerp(za, zb, rand());
        const x = g.W * (-0.05 + rand() * 1.1);
        const half = pathHalf(g, Math.min(z, g.zTop)) * 1.15 + (g.U * 4) / z;
        if (Math.abs(x - pathX(g, Math.min(z, g.zTop))) < half) continue;
        list.push({ z, x, w: (g.U * (7 + rand() * 4)) / z, seed: (rand() * 1e9) >>> 0 });
      }
    }
    list.sort((a, b) => b.z - a.z);
    return list;
  }

  function trunk(ctx, g, t) {
    const r = K.rng(t.seed);
    const base = Math.min(g.H + 2, groundY(g, Math.min(t.z, g.zTop)) + (g.U * 3) / t.z);
    const top = -g.U * 2;
    const w = t.w;
    const tw = w * 0.82;
    const lean = (r() - 0.5) * w * 0.4;
    ctx.fillStyle = fogged(BARK.base, t.z);
    quad(ctx, t.x - tw / 2 + lean, top, t.x + tw / 2 + lean, top, t.x + w / 2, base, t.x - w / 2, base);
    ctx.fillStyle = fogged(BARK.dark, t.z);
    quad(ctx, t.x + tw * 0.2 + lean, top, t.x + tw / 2 + lean, top, t.x + w / 2, base, t.x + w * 0.2, base);
    blob(ctx, t.x, base, w * 0.85, w * 0.22);
    if (t.z < 2.6) {
      ctx.fillStyle = fogged(BARK.light, t.z);
      quad(ctx, t.x - tw / 2 + lean, top, t.x - tw * 0.22 + lean, top, t.x - w * 0.22, base, t.x - w / 2, base);
      ctx.fillStyle = fogged(BARK.dark, t.z);
      const strands = Math.max(2, Math.round(w / 2.2));
      for (let s = 0; s < strands; s++) {
        const f = (s + 0.5) / strands - 0.5;
        const sw = Math.max(0.6, w * 0.05);
        quad(ctx, t.x + f * tw + lean, top, t.x + f * tw + lean + sw, top, t.x + f * w + sw, base, t.x + f * w, base);
      }
      if (t.z < 1.6) {
        ctx.fillStyle = BARK.glow;
        quad(ctx, t.x - tw * 0.42 + lean, top, t.x - tw * 0.32 + lean, top, t.x - w * 0.32, base, t.x - w * 0.42, base);
      }
    }
  }

  // Ragged cedar foliage hanging from short branches high on the trunk.
  function sprays(ctx, g, rand, t) {
    const n = 2 + Math.floor(rand() * 3);
    const k = 1 / Math.sqrt(t.z);
    for (let i = 0; i < n; i++) {
      const y = g.H * (0.04 + rand() * 0.24);
      const side = rand() < 0.5 ? -1 : 1;
      const len = g.U * (6 + rand() * 8) * k;
      for (let j = 0; j < 7; j++) {
        const f = j / 6;
        const x = t.x + side * (t.w * 0.4 + len * f);
        const yy = y + f * f * len * 0.35 + (rand() - 0.5) * g.U * k;
        const r = g.U * (1.2 + rand() * 1.2) * k * (1 - f * 0.4);
        ctx.fillStyle = fogged(CANOPY[0], t.z);
        blob(ctx, x, yy + r * 0.3, r * 1.3, r * 0.8);
        ctx.fillStyle = fogged(CANOPY[rand() < 0.5 ? 1 : 2], t.z);
        blob(ctx, x - r * 0.2, yy, r * 0.8, r * 0.45);
      }
    }
  }

  function trunksIn(ctx, g, zMin, zMax) {
    const rand = K.rng(91);
    for (const t of state.trunks) {
      if (t.z < zMin || t.z >= zMax) continue;
      trunk(ctx, g, t);
      sprays(ctx, g, rand, t);
    }
  }

  // ---- banks and steps -----------------------------------------------------

  function steps(g) {
    const list = [];
    for (let z = 1; z < g.zTop; z += STEP_GROWTH) list.push(z);
    return list;
  }

  function rise(g, z, x) {
    const d = Math.max(0, Math.abs(x - pathX(g, z)) - pathHalf(g, z));
    return Math.min(1, d / (g.W * 0.45)) * ((g.U * 22) / Math.sqrt(z));
  }

  function paintBanks(ctx, g, zs) {
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      const za = Math.max(0.8, z - STEP_GROWTH);
      const ya = groundY(g, za);
      const yb = groundY(g, z);
      ctx.fillStyle = fogged(BANK[Math.floor(i / 3) % 2], z);
      const la = pathX(g, za) - pathHalf(g, za);
      const lb = pathX(g, z) - pathHalf(g, z);
      quad(ctx, -2, ya + 2, la + 1, ya + 1, lb + 1, yb - (g.U * 2) / z, -2, yb - rise(g, z, -2));
      const ra = pathX(g, za) + pathHalf(g, za);
      const rb = pathX(g, z) + pathHalf(g, z);
      quad(ctx, ra - 1, ya + 1, g.W + 2, ya + 2, g.W + 2, yb - rise(g, z, g.W + 2), rb - 1, yb - (g.U * 2) / z);
    }
  }

  function ferns(ctx, g, rand, zs) {
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      const y = groundY(g, z);
      const cx = pathX(g, z);
      const half = pathHalf(g, z);
      for (let j = 0; j < 9; j++) {
        const side = rand() < 0.5 ? -1 : 1;
        const x = cx + side * (half + rand() * g.W * 0.5);
        const fy = y - rise(g, z, x) + rand() * g.U / z;
        const r = (g.U * (2.2 + rand() * 3.4)) / z;
        ctx.fillStyle = fogged(MOSS[3], z);
        blob(ctx, x, fy - r * 0.2, r * 1.4, r * 0.7);
        ctx.fillStyle = fogged(MOSS[rand() < 0.5 ? 1 : 0], z);
        blob(ctx, x - r * 0.3, fy - r * 0.45, r, r * 0.45);
        ctx.fillStyle = fogged(MOSS[2], z);
        blob(ctx, x - r * 0.5, fy - r * 0.65, r * 0.45, r * 0.2);
      }
    }
  }

  function stone(ctx, g, rand, z, x0, x1, ya, yb) {
    const rise = (ya - yb) * 0.66;
    const yr = ya - rise;
    ctx.fillStyle = fogged(STONE.gap, z);
    ctx.fillRect(x0, yb, x1 - x0, ya - yb + 1);
    const inset = Math.max(0.5, (g.U * 0.6) / z);
    ctx.fillStyle = fogged(rand() < 0.3 ? STONE.lip : STONE.riser, z);
    ctx.fillRect(x0 + inset, yr, x1 - x0 - inset * 2, rise - inset);
    ctx.fillStyle = fogged(STONE.tread, z);
    ctx.fillRect(x0 + inset, yb + inset * 0.5, x1 - x0 - inset * 2, yr - yb - inset * 0.5);
    const patches = 1 + Math.floor(rand() * 3);
    for (let p = 0; p < patches; p++) {
      const px = lerp(x0, x1, rand());
      const r = (g.U * (1.4 + rand() * 2.6)) / z;
      ctx.fillStyle = fogged(MOSS[Math.floor(rand() * 3)], z);
      blob(ctx, px, yr + rand() * rise * 0.3, r, r * 0.45);
    }
  }

  function paintSteps(ctx, g, rand, zs) {
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      const ya = groundY(g, z) + 0.5;
      const yb = groundY(g, z + STEP_GROWTH);
      const cx = pathX(g, z);
      const half = pathHalf(g, z) * 0.92;
      const n = 2 + Math.floor(rand() * 3);
      let x = cx - half;
      for (let s = 0; s < n; s++) {
        const end = s === n - 1 ? cx + half : x + ((half * 2) / n) * (0.7 + rand() * 0.6);
        stone(ctx, g, rand, z, x, end, ya, yb);
        x = end;
      }
      ctx.fillStyle = fogged(MOSS[3], z);
      blob(ctx, cx - half, ya - (ya - yb) * 0.5, (g.U * 3) / z, (ya - yb) * 0.7);
      blob(ctx, cx + half, ya - (ya - yb) * 0.5, (g.U * 3) / z, (ya - yb) * 0.7);
    }
  }

  // ---- canopy and light ----------------------------------------------------

  function paintCanopy(ctx, g, rand) {
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = CANOPY[j];
      for (let x = -g.U * 4; x < g.W + g.U * 6; ) {
        const r = g.U * (3 + rand() * 5) * (1 - j * 0.25);
        const gap = Math.abs(x - g.W * 0.42) < g.W * 0.16 ? 0.4 : 1;
        blob(ctx, x, g.U * (j * 1.2 - 1) + rand() * g.U * 4 * gap, r * 1.4, r * gap);
        x += r * (1 + rand() * 0.8);
      }
    }
  }

  function paintShafts(ctx, g, rand) {
    ctx.fillStyle = '#efe6c8';
    for (let i = 0; i < 4; i++) {
      const x = g.W * (0.18 + i * 0.12 + rand() * 0.05);
      const w = g.U * (2 + rand() * 3);
      const dx = g.H * 0.45;
      ctx.globalAlpha = 0.12;
      quad(ctx, x, 0, x + w, 0, x + w + dx, g.H * 0.95, x + dx, g.H * 0.95);
    }
    ctx.globalAlpha = 1;
  }

  // ---- mist ----------------------------------------------------------------

  function paintMist(g, seed, height, alpha) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.max(2, Math.ceil(g.H * height));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 4), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.6, v) * band * 3) / 3;
        const i = (y * w + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 223;
        img.data[i + 2] = 208;
        img.data[i + 3] = a * alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawStrip(ctx, m, t, rate, y, alpha) {
    const w = m.width;
    const a = Math.round((t * rate) % w);
    ctx.globalAlpha = alpha;
    ctx.drawImage(m, -a, y);
    ctx.drawImage(m, w - a, y);
    ctx.globalAlpha = 1;
  }

  // ---- needles -------------------------------------------------------------

  function makeNeedles() {
    const f = () => new Float32Array(MAX_NEEDLES);
    return { x: f(), y: f(), vy: f(), p: f(), tone: f() };
  }

  function resetNeedle(g, N, i, scatter) {
    const r = state.rand;
    N.x[i] = g.W * (0.1 + r() * 0.8);
    N.y[i] = scatter ? r() * g.H : -g.U * (1 + r() * 20);
    N.vy[i] = g.U * (2 + r() * 2.5);
    N.p[i] = r() * TAU;
    N.tone[i] = Math.floor(r() * NEEDLE_TONES.length);
  }

  function drawNeedles(ctx, g, t, dt, count) {
    const N = state.needles;
    const s = Math.max(1, Math.round(g.U * 0.5));
    for (let i = 0; i < count; i++) {
      N.y[i] += N.vy[i] * dt;
      N.x[i] += Math.sin(t * 0.9 + N.p[i]) * g.U * 1.6 * dt;
      if (N.y[i] > g.H + 2) resetNeedle(g, N, i, false);
      ctx.fillStyle = NEEDLE_TONES[N.tone[i]];
      ctx.fillRect(Math.round(N.x[i]), Math.round(N.y[i]), s, s);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.trunks = makeTrunks(g, rand);
    const zs = steps(g);

    state.back = layer(g.W, g.H);
    const b = state.back.getContext('2d');
    paintSky(b, g, rand);
    trunksIn(b, g, 4, 99);

    state.mid = layer(g.W, g.H);
    const m = state.mid.getContext('2d');
    trunksIn(m, g, 2.4, 4);
    paintBanks(m, g, zs);
    ferns(m, g, rand, zs);
    paintSteps(m, g, rand, zs);

    state.front = layer(g.W, g.H);
    const f = state.front.getContext('2d');
    trunksIn(f, g, 0, 2.4);
    paintCanopy(f, g, rand);
    paintShafts(f, g, rand);

    state.mistFar = paintMist(g, 57, 0.26, 230);
    state.mistLow = paintMist(g, 83, 0.2, 200);
    state.needles = makeNeedles();
    for (let i = 0; i < MAX_NEEDLES; i++) resetNeedle(g, state.needles, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, needles } = api.props;
    const count = Math.min(MAX_NEEDLES, Math.round(NEEDLES * needles));
    ctx.drawImage(state.back, 0, 0);
    if (mist > 0) drawStrip(ctx, state.mistFar, t, g.U * 3, Math.round(g.H * 0.2), Math.min(1, mist * 0.95));
    ctx.drawImage(state.mid, 0, 0);
    if (mist > 0) drawStrip(ctx, state.mistLow, t, g.U * 2, Math.round(g.H * 0.44), Math.min(1, mist * 0.7));
    ctx.drawImage(state.front, 0, 0);
    drawNeedles(ctx, g, t, Math.min(dt, 0.1), count);
  }

  Kasuri.run({
    defaults: { mist: 1, needles: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
