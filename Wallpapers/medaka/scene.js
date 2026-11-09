/*
 * 目高 Medaka — rice fish in a glazed water bowl on a wooden deck, seen from above.
 *
 * Deck, bowl and its cast shadow are baked once, the rim again as a ring laid on top.
 * Inside the water: a baked shimmer drifting, a few small fish with soft shadows on the
 * bowl floor, floating leaves that turn slowly, and a short pool of reused rings.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;

  const TAU = Math.PI * 2;
  const MAX_FISH = 22;
  const FISH = 11;
  const PADS = 6;
  const RINGS = 8;
  const DECK = ['#3a2c22', '#46352a', '#52402f'];
  const GLAZE = { lit: '#e2d6b8', mid: '#cdbf9e', dark: '#9e917a', band: '#3e5470', bandLit: '#56708e' };
  const WATER = { deep: '#1f3036', mid: '#2c4446', shallow: '#3c5752', floor: '#4a5b4c' };
  const FISH_TONES = ['#e2a24e', '#d8903e', '#e8b766', '#c9803a'];
  const PAD_TONES = [['#4f6b3c', '#6f8a4e', '#93a96a'], ['#5a7442', '#7d955a', '#a2b378']];
  const LEAF_RED = '#b8482e';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 0.4), 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const R = Math.min(H * 0.46, W * 0.44);
    const U = R / 46;
    return { W, H, U, R, cx: W * 0.5, cy: H * 0.5, rimIn: R * 0.86, water: R * 0.8 };
  }

  // ---- baked layers ----------------------------------------------------------

  function paintDeck(ctx, g, rand) {
    const plank = Math.max(4, g.U * 9);
    const inks = DECK.map(K.parseColor);
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const row = Math.floor(y / plank);
      const gap = y % plank < 1;
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.U * 22), (y + row * 37) / (g.U * 1.6), 3, 5 + row);
        const k = gap ? 0 : n > 0.58 ? 2 : n > 0.4 ? 1 : 0;
        const ink = inks[k];
        const i = (y * g.W + x) * 4;
        const f = gap ? 0.55 : 1;
        d[i] = ink[0] * f;
        d[i + 1] = ink[1] * f;
        d[i + 2] = ink[2] * f;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(20,16,14,0.35)';
    for (let i = 0; i < 14; i++) disc(ctx, rand() * g.W, rand() * g.H, g.U * (0.4 + rand() * 0.5));
  }

  function paintBowl(ctx, g) {
    const { cx, cy, R } = g;
    ctx.fillStyle = 'rgba(14,10,8,0.5)';
    disc(ctx, cx + R * 0.08, cy + R * 0.1, R * 1.03);
    ctx.fillStyle = 'rgba(14,10,8,0.35)';
    disc(ctx, cx + R * 0.05, cy + R * 0.06, R * 1.06);
    paintRimRing(ctx, g);
    const wall = ctx.createRadialGradient(cx - R * 0.1, cy - R * 0.1, g.water * 0.9, cx, cy, g.rimIn);
    wall.addColorStop(0, GLAZE.dark);
    wall.addColorStop(1, '#6e6656');
    ctx.fillStyle = wall;
    disc(ctx, cx, cy, g.rimIn);
    const water = ctx.createRadialGradient(cx - R * 0.12, cy - R * 0.14, R * 0.05, cx, cy, g.water);
    water.addColorStop(0, WATER.floor);
    water.addColorStop(0.45, WATER.shallow);
    water.addColorStop(0.8, WATER.mid);
    water.addColorStop(1, WATER.deep);
    ctx.fillStyle = water;
    disc(ctx, cx, cy, g.water);
  }

  function paintPebbles(ctx, g, rand) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.water, 0, TAU);
    ctx.clip();
    for (let i = 0; i < 70; i++) {
      const a = rand() * TAU;
      const r = g.water * Math.sqrt(rand()) * 0.95;
      ctx.fillStyle = rand() < 0.5 ? 'rgba(90,100,80,0.45)' : 'rgba(30,42,40,0.4)';
      disc(ctx, g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r, g.U * (0.7 + rand() * 1.2));
    }
    ctx.restore();
  }

  function paintRimRing(ctx, g) {
    const { cx, cy, R } = g;
    const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rim.addColorStop(0, GLAZE.lit);
    rim.addColorStop(0.55, GLAZE.mid);
    rim.addColorStop(1, GLAZE.dark);
    ctx.fillStyle = rim;
    disc(ctx, cx, cy, R);
    ctx.strokeStyle = GLAZE.band;
    ctx.lineWidth = Math.max(1, R * 0.035);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.93, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = GLAZE.bandLit;
    ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.975, 0, TAU);
    ctx.stroke();
  }

  function paintRim(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRimRing(ctx, g);
    ctx.globalCompositeOperation = 'destination-out';
    disc(ctx, g.cx, g.cy, g.rimIn);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(40,34,28,0.6)';
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.rimIn + g.U * 0.3, 0, TAU);
    ctx.stroke();
    return c;
  }

  function paintShimmer(g) {
    const size = Math.ceil(g.water * 2.4);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    const s = g.U * 7;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x / s, y / s, 3, 77);
        const v = Math.max(0, 1 - Math.abs(n - 0.5) * 14);
        const i = (y * size + x) * 4;
        d[i] = 200;
        d[i + 1] = 210;
        d[i + 2] = 190;
        d[i + 3] = v * 90;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- moving things ----------------------------------------------------------

  function makeFish(g, rand) {
    const F = {
      x: new Float32Array(MAX_FISH), y: new Float32Array(MAX_FISH),
      a: new Float32Array(MAX_FISH), v: new Float32Array(MAX_FISH),
      turn: new Float32Array(MAX_FISH), p: new Float32Array(MAX_FISH),
      len: new Float32Array(MAX_FISH), tone: new Uint8Array(MAX_FISH),
      dart: new Float32Array(MAX_FISH),
    };
    for (let i = 0; i < MAX_FISH; i++) {
      const a = rand() * TAU;
      const r = g.water * 0.6 * Math.sqrt(rand());
      F.x[i] = g.cx + Math.cos(a) * r;
      F.y[i] = g.cy + Math.sin(a) * r;
      F.a[i] = rand() * TAU;
      F.v[i] = g.U * (2.5 + rand() * 2);
      F.p[i] = rand() * TAU;
      F.len[i] = g.U * (5.2 + rand() * 1.8);
      F.tone[i] = Math.floor(rand() * FISH_TONES.length);
      F.dart[i] = rand() * 6;
    }
    return F;
  }

  function makePads(g, rand) {
    const P = { x: [], y: [], r: [], a: [], spin: [], tone: [], p: [] };
    for (let i = 0; i < PADS; i++) {
      const a = (i / PADS) * TAU + rand() * 0.6;
      const r = g.water * (0.35 + rand() * 0.45);
      P.x.push(g.cx + Math.cos(a) * r);
      P.y.push(g.cy + Math.sin(a) * r);
      P.r.push(g.U * (i === 0 ? 4 : 5 + rand() * 4.5));
      P.a.push(rand() * TAU);
      P.spin.push((rand() - 0.5) * 0.06);
      P.tone.push(i === 0 ? 2 : rand() < 0.5 ? 0 : 1);
      P.p.push(rand() * TAU);
    }
    return P;
  }

  function makeRings() {
    return { x: new Float32Array(RINGS), y: new Float32Array(RINGS), age: new Float32Array(RINGS).fill(99) };
  }

  function spawnRing(x, y) {
    const R = state.rings;
    let best = 0;
    for (let i = 1; i < RINGS; i++) if (R.age[i] > R.age[best]) best = i;
    R.x[best] = x;
    R.y[best] = y;
    R.age[best] = 0;
  }

  function stepFish(g, F, i, t, dt, ripple) {
    const rand = state.rand;
    F.dart[i] -= dt;
    if (F.dart[i] <= 0) {
      F.dart[i] = 3 + rand() * 7;
      F.turn[i] = (rand() - 0.5) * 2.4;
      if (ripple > 0 && rand() < 0.25 * ripple) spawnRing(F.x[i], F.y[i]);
    }
    const burst = F.dart[i] > 0 && F.dart[i] < 0.6 ? 2.6 : 1;
    const dx = F.x[i] - g.cx;
    const dy = F.y[i] - g.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let steer = F.turn[i] * 0.4 + Math.sin(t * 0.5 + F.p[i]) * 0.35;
    const edge = g.water * 0.72;
    if (dist > edge) {
      const home = Math.atan2(-dy, -dx);
      let diff = home - F.a[i];
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      steer += diff * 2.2 * Math.min(2, (dist - edge) / (g.U * 4));
    }
    F.turn[i] *= 1 - Math.min(1, dt * 0.5);
    F.a[i] += steer * dt;
    const v = F.v[i] * burst;
    F.x[i] += Math.cos(F.a[i]) * v * dt;
    F.y[i] += Math.sin(F.a[i]) * v * dt;
  }

  function fishShape(ctx, len, wag) {
    const w = len * 0.21;
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.5, w, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-len * 0.4, 0);
    ctx.lineTo(-len * 0.82, -w * 1.1 + wag);
    ctx.lineTo(-len * 0.82, w * 1.1 + wag);
    ctx.closePath();
    ctx.fill();
  }

  function drawFish(ctx, g, t, count, shadow) {
    const F = state.fish;
    const off = g.U * 2.2;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(F.a[i]);
      const s = Math.sin(F.a[i]);
      const len = F.len[i];
      const wag = Math.sin(t * 9 + F.p[i]) * len * 0.14;
      if (shadow) {
        ctx.setTransform(c, s, -s, c, F.x[i] + off, F.y[i] + off * 1.2);
        fishShape(ctx, len, wag);
      } else {
        ctx.setTransform(c, s, -s, c, F.x[i], F.y[i]);
        ctx.fillStyle = FISH_TONES[F.tone[i]];
        fishShape(ctx, len, wag);
        ctx.fillStyle = '#f0cf8a';
        ctx.beginPath();
        ctx.ellipse(len * 0.18, 0, len * 0.22, len * 0.13, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function padShape(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, 0.22, TAU - 0.22);
    ctx.closePath();
    ctx.fill();
  }

  function drawPads(ctx, g, t, dt, shadow) {
    const P = state.pads;
    for (let i = 0; i < PADS; i++) {
      if (!shadow) {
        P.a[i] += P.spin[i] * dt;
        P.x[i] += Math.cos(t * 0.05 + P.p[i]) * g.U * 0.25 * dt;
        P.y[i] += Math.sin(t * 0.04 + P.p[i]) * g.U * 0.25 * dt;
      }
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const r = P.r[i];
      const bob = Math.sin(t * 0.7 + P.p[i]) * g.U * 0.15;
      if (shadow) {
        ctx.setTransform(c, s, -s, c, P.x[i] + g.U * 1.6, P.y[i] + g.U * 2);
        padShape(ctx, r);
        continue;
      }
      ctx.setTransform(c, s, -s, c, P.x[i], P.y[i] + bob);
      if (P.tone[i] === 2) {
        ctx.fillStyle = LEAF_RED;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.45, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#d0703e';
        ctx.fillRect(-r * 0.9, -r * 0.05, r * 1.8, Math.max(0.6, r * 0.1));
        continue;
      }
      const inks = PAD_TONES[P.tone[i]];
      ctx.fillStyle = inks[0];
      padShape(ctx, r);
      ctx.fillStyle = inks[1];
      padShape(ctx, r * 0.82);
      ctx.fillStyle = inks[2];
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.3, r * 0.2, 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawRings(ctx, g, dt, ripple) {
    const R = state.rings;
    ctx.strokeStyle = '#d8d4c0';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    for (let i = 0; i < RINGS; i++) {
      R.age[i] += dt;
      const age = R.age[i];
      if (age > 4) continue;
      const k = age / 4;
      ctx.globalAlpha = 0.4 * (1 - k) * Math.min(1, ripple);
      ctx.beginPath();
      ctx.arc(R.x[i], R.y[i], g.U * (1 + age * 4), 0, TAU);
      ctx.stroke();
      if (age > 0.6) {
        ctx.beginPath();
        ctx.arc(R.x[i], R.y[i], g.U * (age - 0.6) * 4, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawShimmer(ctx, g, t, ripple) {
    const S = state.shimmer;
    const base = g.water * 1.2;
    ctx.globalAlpha = 0.35 + 0.25 * Math.min(1, ripple);
    ctx.drawImage(S, g.cx - base + Math.sin(t * 0.13) * g.U * 6, g.cy - base + Math.cos(t * 0.11) * g.U * 5);
    ctx.globalAlpha = 0.25 + 0.2 * Math.min(1, ripple);
    ctx.drawImage(S, g.cx - base - Math.cos(t * 0.09) * g.U * 7, g.cy - base - Math.sin(t * 0.15) * g.U * 6);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintDeck(bctx, g, rand);
    paintBowl(bctx, g);
    paintPebbles(bctx, g, rand);
    state.back = back;
    state.rim = paintRim(g);
    state.shimmer = paintShimmer(g);
    state.fish = makeFish(g, rand);
    state.pads = makePads(g, rand);
    state.rings = makeRings();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { fish, ripple } = api.props;
    const count = Math.min(MAX_FISH, Math.round(FISH * fish));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepFish(g, state.fish, i, t, step, ripple);
    ctx.drawImage(state.back, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.water, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,16,18,0.4)';
    drawFish(ctx, g, t, count, true);
    drawPads(ctx, g, t, step, true);
    drawShimmer(ctx, g, t, ripple);
    drawFish(ctx, g, t, count, false);
    drawRings(ctx, g, step, ripple);
    drawPads(ctx, g, t, step, false);
    ctx.restore();
    ctx.drawImage(state.rim, 0, 0);
  }

  Kasuri.run({
    defaults: { fish: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
