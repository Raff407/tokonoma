/*
 * 時雨 Shigure — a passing autumn drizzle over the slate roofs of an old town.
 *
 * Hills, roofs, the pagoda, lane and maple branch are baked once. Rain is a pool of
 * short slanted strokes plus two soft curtains that slide across; puddle rings and
 * falling leaves are small reused pools.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SKY = ['#6f7b86', '#8b949a', '#a6aaa6', '#bdbab0'];
  const SLATE = ['#3d4650', '#4a5560', '#56626c'];
  const LEAF_TONES = ['#b4442b', '#cc6a33', '#a23a26', '#d49a48'];
  const DROPS = 110;
  const RINGS = 14;
  const LEAVES = 14;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, U: H / 100, lane: Math.round(H * 0.8) };
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.6)) * (inks.length - 1);
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
    ctx.fillStyle = '#7f8991';
    for (let i = 0; i < 6; i++) blob(ctx, g.W * rand(), g.H * (0.04 + rand() * 0.22), g.U * (10 + rand() * 18), g.U * (1.2 + rand()));
    return c;
  }

  function hills(ctx, g, rand, base, amp, ink, seed, fogInk) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) {
      ctx.lineTo(x, base - K.fbm(x / (g.U * 34), seed, 4, seed * 7) * amp);
    }
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = fogInk;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, base - amp * 0.2, g.W, g.H);
    ctx.globalAlpha = 1;
  }

  function pagoda(ctx, x, base, u) {
    const tiers = 5;
    ctx.fillStyle = '#4a5560';
    ctx.fillRect(x - u * 0.35, base - u * 36, u * 0.7, u * 6);
    for (let i = 0; i < tiers; i++) {
      const w = u * (9 - i * 1.3);
      const y = base - i * u * 6.4;
      ctx.fillStyle = '#6a625a';
      ctx.fillRect(x - w * 0.34, y - u * 3.6, w * 0.68, u * 3.6);
      ctx.fillStyle = SLATE[i % 2];
      poly(ctx, [x - w * 0.62, y - u * 3.6, x - w * 0.34, y - u * 5.6, x + w * 0.34, y - u * 5.6, x + w * 0.62, y - u * 3.6, x + w * 0.5, y - u * 3.2, x - w * 0.5, y - u * 3.2]);
    }
  }

  function house(ctx, g, x, base, w, h, tone) {
    const u = g.U;
    ctx.fillStyle = '#cfc8b4';
    ctx.fillRect(x - w * 0.42, base - h, w * 0.84, h);
    ctx.fillStyle = '#5a4636';
    ctx.fillRect(x - w * 0.42, base - h, w * 0.84, Math.max(1, u * 0.35));
    ctx.fillRect(x - w * 0.42, base - h * 0.5, w * 0.84, Math.max(1, u * 0.25));
    for (let i = 1; i < 4; i++) ctx.fillRect(x - w * 0.42 + (w * 0.84 * i) / 4, base - h, Math.max(1, u * 0.3), h);
    const r = h * 0.7;
    ctx.fillStyle = SLATE[tone];
    poly(ctx, [x - w * 0.62, base - h + u * 0.6, x - w * 0.32, base - h - r, x + w * 0.32, base - h - r, x + w * 0.62, base - h + u * 0.6]);
    ctx.fillStyle = '#2c333b';
    ctx.fillRect(x - w * 0.32, base - h - r, w * 0.64, Math.max(1, u * 0.45));
    ctx.fillStyle = SLATE[(tone + 2) % 3];
    ctx.globalAlpha = 0.5;
    for (let i = 1; i < 4; i++) {
      const yy = base - h - r + (r * i) / 4;
      ctx.fillRect(x - w * (0.32 + 0.3 * (i / 4)), yy, w * (0.64 + 0.6 * (i / 4)), Math.max(1, u * 0.18));
    }
    ctx.globalAlpha = 1;
  }

  function paintTown(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    hills(ctx, g, rand, g.H * 0.4, g.H * 0.2, '#8e9a9e', 3.1, '#bdbab0');
    hills(ctx, g, rand, g.H * 0.5, g.H * 0.16, '#6e7e7e', 5.7, '#a6aaa6');
    pagoda(ctx, g.W * 0.76, g.H * 0.52, u * 1.15);
    ctx.fillStyle = '#7d8a8c';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, g.H * 0.3, g.W, g.H * 0.3);
    ctx.globalAlpha = 1;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const f = r / (rows - 1);
      const base = g.H * (0.56 + f * 0.17);
      const s = u * (3.6 + f * 3.2);
      ctx.fillStyle = r < rows - 1 ? '#4c5659' : '#3a4044';
      ctx.fillRect(0, base, g.W, g.H - base);
      for (let x = -s * rand(); x < g.W + s; ) {
        const w = s * (2.2 + rand() * 1.6);
        house(ctx, g, x + w / 2, base + s * 0.35, w, s * (1 + rand() * 0.5), Math.floor(rand() * 3));
        x += w * (0.78 + rand() * 0.15);
      }
    }
    ctx.fillStyle = '#9a8f7c';
    ctx.fillRect(0, g.lane, g.W, g.H - g.lane);
    ctx.fillStyle = '#b4a88f';
    ctx.fillRect(0, g.lane, g.W, Math.max(1, u * 0.5));
    ctx.fillStyle = '#7b715f';
    for (let i = 0; i < g.W / (u * 3); i++) {
      ctx.fillRect(rand() * g.W, g.lane + u * 1.5 + rand() * (g.H - g.lane - u * 2), u * (1 + rand() * 1.6), Math.max(1, u * 0.35));
    }
    return c;
  }

  function maple(ctx, g, rand) {
    const u = g.U;
    ctx.strokeStyle = '#3a2c22';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, u * 1.1);
    ctx.beginPath();
    ctx.moveTo(g.W + u * 2, u * 14);
    ctx.quadraticCurveTo(g.W * 0.9, u * 12, g.W * 0.8, u * 22);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.9, u * 12.6);
    ctx.quadraticCurveTo(g.W * 0.86, u * 6, g.W * 0.78, u * 5);
    ctx.stroke();
    for (let i = 0; i < 120; i++) {
      const a = rand();
      const x = g.W * (0.76 + a * 0.26);
      const y = u * (4 + rand() * 22 + (1 - a) * 4);
      ctx.fillStyle = LEAF_TONES[Math.floor(rand() * 4)];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * TAU);
      ctx.fillRect(-u * 0.9, -u * 0.6, u * 1.8, u * 1.2);
      ctx.restore();
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    maple(ctx, g, rand);
    return c;
  }

  function makePuddles(g, rand) {
    const out = [];
    const u = g.U;
    for (let i = 0; i < 5; i++) {
      out.push({ x: g.W * (0.1 + rand() * 0.8), y: g.lane + (g.H - g.lane) * (0.25 + rand() * 0.6), rx: u * (5 + rand() * 6) });
    }
    return out;
  }

  function paintPuddles(g, puddles) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const p of puddles) {
      ctx.fillStyle = '#7d8a91';
      blob(ctx, p.x, p.y, p.rx, p.rx * 0.22);
      ctx.fillStyle = '#9aa3a6';
      blob(ctx, p.x - p.rx * 0.1, p.y - p.rx * 0.03, p.rx * 0.7, p.rx * 0.12);
    }
    return c;
  }

  function paintCurtain(g) {
    const w = Math.ceil(g.W * 0.9);
    const c = layer(w, g.H * 0.7);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(190,198,200,0)');
    gr.addColorStop(0.5, 'rgba(190,198,200,0.32)');
    gr.addColorStop(1, 'rgba(190,198,200,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, c.height);
    return c;
  }

  function makeDrops(g, rand) {
    const d = { x: new Float32Array(DROPS), y: new Float32Array(DROPS), v: new Float32Array(DROPS), n: new Float32Array(DROPS) };
    for (let i = 0; i < DROPS; i++) {
      d.x[i] = rand() * g.W;
      d.y[i] = rand() * g.H;
      d.v[i] = g.H * (0.7 + rand() * 0.5);
      d.n[i] = 0.5 + rand() * 0.8;
    }
    return d;
  }

  function makeRings(g, rand) {
    const r = { p: new Int8Array(RINGS), age: new Float32Array(RINGS), dx: new Float32Array(RINGS), dy: new Float32Array(RINGS) };
    for (let i = 0; i < RINGS; i++) {
      r.p[i] = Math.floor(rand() * state.puddles.length);
      r.age[i] = rand() * 1.6;
      r.dx[i] = (rand() - 0.5) * 1.4;
      r.dy[i] = (rand() - 0.5) * 0.4;
    }
    return r;
  }

  function makeLeaves(g, rand) {
    const l = { x: new Float32Array(LEAVES), y: new Float32Array(LEAVES), a: new Float32Array(LEAVES), p: new Float32Array(LEAVES), s: new Float32Array(LEAVES), t: new Uint8Array(LEAVES) };
    for (let i = 0; i < LEAVES; i++) respawn(g, l, i, rand, true);
    return l;
  }

  function respawn(g, l, i, rand, scatter) {
    l.x[i] = g.W * (0.45 + rand() * 0.6);
    l.y[i] = scatter ? rand() * g.H : -g.U * 2;
    l.a[i] = rand() * TAU;
    l.p[i] = rand() * TAU;
    l.s[i] = g.U * (0.8 + rand() * 0.8);
    l.t[i] = Math.floor(rand() * 4);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.sky = paintSky(g, rand);
    state.town = paintTown(g, rand);
    state.puddles = makePuddles(g, rand);
    state.puddleLayer = paintPuddles(g, state.puddles);
    state.front = paintFront(g, rand);
    state.curtain = paintCurtain(g);
    state.drops = makeDrops(g, rand);
    state.rings = makeRings(g, rand);
    state.leaves = makeLeaves(g, rand);
  }

  function drawCurtains(ctx, g, t) {
    const c = state.curtain;
    const span = g.W + c.width;
    ctx.drawImage(c, ((t * g.U * 3.2) % span) - c.width, 0);
    ctx.drawImage(c, g.W - ((t * g.U * 2.1 + span * 0.4) % span), g.H * 0.2);
  }

  function drawDrops(ctx, g, dt, count) {
    const d = state.drops;
    const len = g.U * 2.2;
    ctx.strokeStyle = '#d5dadb';
    ctx.lineWidth = Math.max(1, g.U * 0.18);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      d.y[i] += d.v[i] * dt;
      d.x[i] -= d.v[i] * dt * 0.18;
      if (d.y[i] > g.H || d.x[i] < -len) {
        d.y[i] = -len;
        d.x[i] = state.rand() * (g.W + g.H * 0.2);
      }
      ctx.moveTo(d.x[i], d.y[i]);
      ctx.lineTo(d.x[i] - len * 0.18 * d.n[i], d.y[i] + len * d.n[i]);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawRings(ctx, g, dt, amount) {
    const R = state.rings;
    const n = Math.min(RINGS, Math.round(RINGS * Math.min(1, amount)));
    ctx.strokeStyle = '#e1e4df';
    ctx.lineWidth = Math.max(1, g.U * 0.22);
    for (let i = 0; i < n; i++) {
      R.age[i] += dt;
      if (R.age[i] > 1.8) {
        R.age[i] = 0;
        R.p[i] = Math.floor(state.rand() * state.puddles.length);
        R.dx[i] = (state.rand() - 0.5) * 1.4;
        R.dy[i] = (state.rand() - 0.5) * 0.4;
      }
      const p = state.puddles[R.p[i]];
      const f = R.age[i] / 1.8;
      const r = p.rx * 0.5 * f + g.U * 0.3;
      ctx.globalAlpha = 0.6 * (1 - f);
      ctx.beginPath();
      ctx.ellipse(p.x + R.dx[i] * p.rx * 0.5, p.y + R.dy[i] * p.rx * 0.2, r, r * 0.25, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t, dt, count) {
    const l = state.leaves;
    for (let i = 0; i < count; i++) {
      l.y[i] += g.U * 7 * dt;
      l.x[i] += Math.sin(t * 1.3 + l.p[i]) * g.U * 2 * dt - g.U * 1.2 * dt;
      l.a[i] += dt * 1.1;
      if (l.y[i] > g.H + g.U * 2) respawn(g, l, i, state.rand, false);
      const c = Math.cos(l.a[i]);
      const s = Math.sin(l.a[i]);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + l.p[i]));
      ctx.fillStyle = LEAF_TONES[l.t[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, l.x[i], l.y[i]);
      ctx.fillRect(-l.s[i] / 2, -l.s[i] * 0.35, l.s[i], l.s[i] * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, leaves } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.town, 0, 0);
    ctx.drawImage(state.puddleLayer, 0, 0);
    drawRings(ctx, g, step, rain);
    if (rain > 0.05) drawCurtains(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawDrops(ctx, g, step, Math.min(DROPS, Math.round(DROPS * rain * 0.8)));
    drawLeaves(ctx, g, t, step, Math.min(LEAVES, Math.round(LEAVES * 0.7 * leaves)));
  }

  Kasuri.run({
    defaults: { rain: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
