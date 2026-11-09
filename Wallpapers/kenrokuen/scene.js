/*
 * 兼六園 Kenrokuen — a stroll garden in snow.
 *
 * Sky, hills, bank, the roped pines and the stone lantern are baked once. The pond is
 * that baked world flipped and laid back in thin rows that slide sideways. Snow is a
 * small pool of flakes reused as they leave the bottom.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.6;
  const SKY = ['#7f8a9a', '#98a1ac', '#b2b8bc', '#c9cbc6', '#d9d8cf'];
  const SNOW = '#f1eee4';
  const SNOW_SHADE = '#cfd2d2';
  const NEEDLE = ['#2a3d31', '#3a5239', '#4f6a47'];
  const FAR_NEEDLE = ['#6d7f78', '#7d8e86'];
  const STONE = ['#4f5253', '#6f7271', '#8d8f8a'];
  const ROPE = '#c9b58a';
  const POND = '#4d6270';
  const VEIL = 0.4;
  const MAX_FLAKES = 160;
  const FLAKES = 90;
  const STREAKS = 50;
  const REFLECT_INKS = 16;
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
    const u = U * Math.min(1, W / (U * 130));
    const wy = Math.round(H * WATER);
    return { W, H, U, u, wy, bank: wy - U * 0.6 };
  }

  // ---- sky and far hills ---------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.wy);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.wy; y++) {
      const f = Math.min(1, y / (g.wy * 0.8)) * (inks.length - 1);
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
    ctx.fillStyle = '#d6d7d2';
    for (let i = 0; i < 5; i++) {
      blob(ctx, g.W * (0.08 + rand() * 0.84), g.H * (0.06 + rand() * 0.14), g.U * (10 + rand() * 16), g.U * (0.6 + rand() * 0.6));
    }
  }

  function ridge(g, x, base, amp, seed) {
    return base + fbm(x / (g.U * 36), 2.2, 4, seed) * amp;
  }

  function paintHills(ctx, g, rand) {
    const layers = [['#aab3b8', g.H * 0.3, g.H * 0.1, 7], ['#8d9a9d', g.H * 0.4, g.H * 0.09, 19]];
    for (const [ink, base, amp, seed] of layers) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, g.wy);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, base, amp, seed));
      ctx.lineTo(g.W, g.wy);
      ctx.fill();
    }
    // a few far pines standing on the last ridge, dim in the snow haze
    for (let x = g.U * 2; x < g.W; x += g.U * (3 + rand() * 5)) {
      const y = ridge(g, x, g.H * 0.4, g.H * 0.09, 19) + g.U * 1.5;
      const h = g.U * (6 + rand() * 7);
      ctx.fillStyle = FAR_NEEDLE[rand() < 0.5 ? 0 : 1];
      poly(ctx, [x, y - h, x - h * 0.28, y, x + h * 0.28, y]);
      ctx.fillStyle = SNOW_SHADE;
      poly(ctx, [x, y - h, x - h * 0.1, y - h * 0.62, x + h * 0.1, y - h * 0.62]);
    }
  }

  // ---- bank ----------------------------------------------------------------

  function paintBank(ctx, g, rand) {
    const top = g.bank - g.U * 2.2;
    ctx.fillStyle = '#d7d8d2';
    ctx.beginPath();
    ctx.moveTo(0, g.wy + 1);
    for (let x = 0; x <= g.W + 4; x += 4) ctx.lineTo(x, top + Math.sin(x / (g.U * 9)) * g.U * 0.7 + fbm(x / (g.U * 5), 6.1, 2, 3) * g.U * 1.5);
    ctx.lineTo(g.W, g.wy + 1);
    ctx.fill();
    ctx.fillStyle = '#b9bfc0';
    ctx.fillRect(0, g.bank, g.W, g.wy - g.bank + 1);
    for (let x = 0; x < g.W; x += g.U * (1.4 + rand() * 2.4)) {
      const r = g.U * (0.7 + rand() * 0.9);
      ctx.fillStyle = STONE[rand() < 0.5 ? 0 : 1];
      blob(ctx, x, g.wy - g.U * 0.2, r, r * 0.6);
      ctx.fillStyle = SNOW;
      blob(ctx, x - r * 0.1, g.wy - g.U * 0.2 - r * 0.45, r * 0.8, r * 0.3);
    }
  }

  // ---- the roped pine ------------------------------------------------------

  // Tiered pads of needles, snow on the top of each, ropes running from the pole tip to the pad edges.
  function yukitsuri(ctx, g, rand, x, y, h, seed) {
    const r = K.rng(seed);
    const tiers = 6;
    const top = y - h;
    ctx.fillStyle = '#3a2e24';
    ctx.fillRect(x - g.U * 0.7, y - h * 0.2, g.U * 1.4, h * 0.2);
    ctx.fillRect(x - g.U * 0.3, top - g.U * 1.5, g.U * 0.6, h + g.U * 1.5);
    const edges = [];
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const ty = y - h * (0.16 + 0.76 * (1 - f));
      const w = h * (0.1 + 0.2 * f);
      edges.push(ty, w);
      ctx.fillStyle = NEEDLE[0];
      blob(ctx, x, ty, w, w * 0.34);
      ctx.fillStyle = NEEDLE[1];
      blob(ctx, x - w * 0.15, ty - w * 0.08, w * 0.82, w * 0.26);
      ctx.fillStyle = NEEDLE[2];
      blob(ctx, x - w * 0.3, ty - w * 0.14, w * 0.4, w * 0.12);
      ctx.fillStyle = SNOW_SHADE;
      blob(ctx, x + w * (r() - 0.5) * 0.3, ty - w * 0.2, w * 0.7, w * 0.15);
      ctx.fillStyle = SNOW;
      blob(ctx, x - w * 0.1, ty - w * 0.26, w * 0.58, w * 0.12);
    }
    ctx.strokeStyle = ROPE;
    ctx.lineWidth = Math.max(1, g.U * 0.2);
    for (let i = 0; i < 9; i++) {
      const s = (i / 8 - 0.5) * 2;
      const ey = edges[edges.length - 2] + g.U * 0.5 * (1 - Math.abs(s));
      ctx.beginPath();
      ctx.moveTo(x, top - g.U * 1.3);
      ctx.lineTo(x + s * edges[edges.length - 1] * 1.02, ey);
      ctx.stroke();
    }
    ctx.fillStyle = SNOW;
    blob(ctx, x, top - g.U * 1.6, g.U * 0.9, g.U * 0.5);
  }

  function paintBare(ctx, g, x, y, h, seed) {
    const r = K.rng(seed);
    ctx.strokeStyle = '#2d2a28';
    ctx.lineCap = 'round';
    const limb = (x0, y0, len, a, w, depth) => {
      const x1 = x0 + Math.cos(a) * len;
      const y1 = y0 + Math.sin(a) * len;
      ctx.lineWidth = Math.max(1, w);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (depth <= 0) return;
      limb(x1, y1, len * 0.72, a - 0.5 - r() * 0.3, w * 0.65, depth - 1);
      limb(x1, y1, len * 0.7, a + 0.45 + r() * 0.3, w * 0.65, depth - 1);
    };
    limb(x, y, h * 0.34, -Math.PI / 2 + (r() - 0.5) * 0.2, g.U * 1.1, 4);
  }

  // ---- the lantern ---------------------------------------------------------

  // A two-legged lantern at the water's edge, snow lying on its cap and crossbar.
  function lantern(ctx, g, x, y, s) {
    const stone = (i) => STONE[i];
    ctx.fillStyle = stone(0);
    poly(ctx, [x - s * 1.8, y, x - s * 1.2, y, x - s * 0.55, y - s * 6, x - s * 1.05, y - s * 6]);
    ctx.fillStyle = stone(1);
    poly(ctx, [x + s * 0.4, y, x + s * 1.0, y, x + s * 2.2, y - s * 4.2, x + s * 1.4, y - s * 4.2]);
    ctx.fillStyle = stone(1);
    poly(ctx, [x + s * 1.4, y - s * 4.2, x + s * 2.2, y - s * 4.2, x + s * 2.0, y - s * 6.4, x + s * 1.2, y - s * 6.4]);
    ctx.fillStyle = stone(2);
    ctx.fillRect(x - s * 2.1, y - s * 7.4, s * 4.8, s * 1.1);
    ctx.fillStyle = stone(1);
    ctx.fillRect(x - s * 1.5, y - s * 9.8, s * 3.4, s * 2.4);
    ctx.fillStyle = '#e1c783';
    ctx.fillRect(x - s * 0.7, y - s * 9.2, s * 1.6, s * 1.3);
    ctx.fillStyle = stone(0);
    poly(ctx, [x - s * 3.4, y - s * 9.8, x + s * 3.8, y - s * 9.8, x + s * 1.7, y - s * 12.4, x - s * 1.3, y - s * 12.4]);
    ctx.fillStyle = stone(2);
    blob(ctx, x + s * 0.2, y - s * 12.7, s * 0.7, s * 0.5);
    ctx.fillStyle = SNOW;
    poly(ctx, [x - s * 2.8, y - s * 10.1, x + s * 3.3, y - s * 10.1, x + s * 1.7, y - s * 12.6, x - s * 1.3, y - s * 12.6]);
    blob(ctx, x + s * 0.2, y - s * 13.1, s * 0.6, s * 0.4);
    ctx.fillRect(x - s * 2.1, y - s * 7.7, s * 4.8, s * 0.4);
    ctx.fillStyle = SNOW_SHADE;
    ctx.fillRect(x - s * 2.1, y - s * 7.35, s * 4.8, s * 0.15);
  }

  function rock(ctx, g, rand, x, y, r) {
    ctx.fillStyle = STONE[0];
    blob(ctx, x, y, r, r * 0.6);
    ctx.fillStyle = STONE[1];
    blob(ctx, x - r * 0.2, y - r * 0.15, r * 0.7, r * 0.4);
    ctx.fillStyle = SNOW;
    blob(ctx, x - r * 0.1, y - r * 0.45, r * 0.75, r * 0.25);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g, rand);
    paintBank(ctx, g, rand);
    paintBare(ctx, g, g.W * 0.05, g.bank, g.H * 0.5, 4);
    paintBare(ctx, g, g.W * 0.43, g.bank, g.H * 0.36, 8);
    yukitsuri(ctx, g, rand, g.W * 0.79, g.bank, g.u * 54, 11);
    yukitsuri(ctx, g, rand, g.W * 0.63, g.bank, g.u * 30, 17);
    yukitsuri(ctx, g, rand, g.W * 0.92, g.bank, g.u * 26, 23);
    lantern(ctx, g, g.W * 0.3, g.bank + g.U * 0.3, g.u * 2.3);
    rock(ctx, g, rand, g.W * 0.26, g.bank + g.U * 0.5, g.u * 2.2);
    rock(ctx, g, rand, g.W * 0.35, g.bank + g.U * 0.6, g.u * 1.6);
    return c;
  }

  // ---- water ---------------------------------------------------------------

  function commonColours(d, count) {
    const hits = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      hits.set(key, (hits.get(key) || 0) + 1);
    }
    const top = [...hits.entries()].sort((p, q) => q[1] - p[1]).slice(0, count);
    return top.map(([key]) => [((key >> 10) << 3) | 4, (((key >> 5) & 31) << 3) | 4, ((key & 31) << 3) | 4]);
  }

  function snapColours(c, count) {
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const inks = commonColours(d, count);
    for (let i = 0; i < d.length; i += 4) {
      let best = inks[0];
      let gap = Infinity;
      for (const ink of inks) {
        const e = (d[i] - ink[0]) ** 2 + (d[i + 1] - ink[1]) ** 2 + (d[i + 2] - ink[2]) ** 2;
        if (e < gap) {
          gap = e;
          best = ink;
        }
      }
      d[i] = best[0];
      d[i + 1] = best[1];
      d[i + 2] = best[2];
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintReflection(g) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(state.back, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = POND;
    ctx.globalAlpha = VEIL;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalAlpha = 1;
    snapColours(c, REFLECT_INKS);
    return c;
  }

  function waveAt(g, y, t, ripple) {
    const d = (y - g.wy) / (g.H - g.wy);
    const amp = g.U * (0.1 + 1.6 * d) * ripple;
    const k = y / g.U;
    return amp * (Math.sin(k * 0.7 + t * 0.7) + 0.5 * Math.sin(k * 1.9 - t * 1.1));
  }

  function drawWater(ctx, g, t, ripple) {
    const src = state.reflection;
    const water = g.H - g.wy;
    ctx.drawImage(src, 0, g.wy);
    let y = 0;
    while (y < water) {
      const h = Math.max(1, Math.round(g.U * lerp(0.5, 2, y / water)));
      const dx = Math.round(waveAt(g, g.wy + y, t, ripple));
      ctx.drawImage(src, 0, y, g.W, h, dx, g.wy + y, g.W, h);
      y += h;
    }
  }

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      const d = 0.02 + 0.98 * Math.pow(rand(), 1.4);
      s.x[i] = rand() * g.W;
      s.y[i] = g.wy + d * (g.H - g.wy);
      s.l[i] = g.U * (2 + d * 8) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawStreaks(ctx, g, t, ripple) {
    const s = state.streaks;
    const thick = Math.max(1, g.U * 0.35);
    const slide = t * g.U * (0.25 + ripple * 0.4);
    const amount = Math.min(1, ripple + 0.2);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#26343c' : '#dfe0da';
      for (let i = pass; i < STREAKS; i += 2) {
        const a = Math.sin(t * 0.5 + s.p[i]);
        if (a <= 0) continue;
        ctx.globalAlpha = a * amount * (pass ? 0.4 : 0.4);
        const x = ((s.x[i] + slide) % (g.W + s.l[i] * 2)) - s.l[i];
        ctx.fillRect(x, s.y[i], s.l[i], thick);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- snow ----------------------------------------------------------------

  function makeFlakes(g, rand) {
    const f = () => new Float32Array(MAX_FLAKES);
    const F = { x: f(), y: f(), vy: f(), sway: f(), p: f(), size: f() };
    for (let i = 0; i < MAX_FLAKES; i++) {
      F.x[i] = rand() * g.W;
      F.y[i] = rand() * g.H;
      resetFlake(g, F, i, rand, false);
    }
    return F;
  }

  function resetFlake(g, F, i, rand, top) {
    if (top) {
      F.y[i] = -g.U * 2;
      F.x[i] = rand() * g.W;
    }
    const big = rand() < 0.3;
    F.size[i] = Math.max(1, g.U * (big ? 0.7 : 0.4));
    F.vy[i] = g.U * (big ? 5 + rand() * 2 : 3 + rand() * 2);
    F.sway[i] = g.U * (0.8 + rand() * 1.4);
    F.p[i] = rand() * TAU;
  }

  function stepFlakes(g, t, dt, count) {
    const F = state.flakes;
    for (let i = 0; i < count; i++) {
      F.y[i] += F.vy[i] * dt;
      F.x[i] += Math.sin(t * 0.9 + F.p[i]) * F.sway[i] * dt;
      if (F.y[i] > g.H) resetFlake(g, F, i, state.rand, true);
      if (F.x[i] < 0) F.x[i] += g.W;
      else if (F.x[i] > g.W) F.x[i] -= g.W;
    }
  }

  function drawFlakes(ctx, count) {
    const F = state.flakes;
    ctx.fillStyle = SNOW;
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = F.size[i] > 1.4 ? 0.95 : 0.75;
      ctx.fillRect(F.x[i], F.y[i], F.size[i], F.size[i]);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.reflection = paintReflection(g);
    state.streaks = makeStreaks(g, rand);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, ripple } = api.props;
    const count = Math.min(MAX_FLAKES, Math.round(FLAKES * snow));
    stepFlakes(g, t, Math.min(dt, 0.1), count);
    ctx.drawImage(state.back, 0, 0);
    drawWater(ctx, g, t, ripple);
    drawStreaks(ctx, g, t, ripple);
    drawFlakes(ctx, count);
  }

  Kasuri.run({
    defaults: { snow: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
