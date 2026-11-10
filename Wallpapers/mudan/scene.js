/*
 * 牡丹 Mudan — a bed of full peonies before a pierced garden rock, under a pale moon.
 *
 * Sky, moon, rock, leaves and moss are baked once. Each bloom is baked at a few stages
 * of opening; every frame blends two neighbouring stages by drawImage. Petals that drop
 * are a short reused pool of small ellipses.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const STAGES = 7;
  const NPETAL = 16;
  const SKY = ['#1d2a3f', '#2b3a50', '#43515c', '#5d6a69'];
  const ROCK = ['#68716f', '#7d8581', '#979d92', '#b3b6a6'];
  const TINTS = [
    { out: '#c9a79a', mid: '#e3cdbd', in: '#f0e2cf', core: '#d9b45c', edge: '#8c6a5c' },
    { out: '#8f2a1f', mid: '#b83a28', in: '#d6573a', core: '#d9b45c', edge: '#5a1a14' },
    { out: '#d9c9b2', mid: '#ece0cb', in: '#f4ecda', core: '#d9b45c', edge: '#9a8a74' },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
    ctx.fill();
  }

  // ---- bloom sprites -------------------------------------------------------

  function ring(ctx, n, dist, pr, turn, fill, edge, lw) {
    for (let i = 0; i < n; i++) {
      const a = turn + (i / n) * TAU;
      const px = Math.cos(a) * dist;
      const py = Math.sin(a) * dist * 0.82;
      ctx.fillStyle = edge;
      blob(ctx, px, py, pr + lw, pr * 0.8 + lw, a);
      ctx.fillStyle = fill;
      blob(ctx, px, py, pr, pr * 0.8, a);
    }
  }

  function bloomAt(size, tint, s) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const R = size * 0.46;
    ctx.translate(size / 2, size / 2);
    const lw = Math.max(1, size * 0.012);
    // sepals
    ctx.fillStyle = '#35502f';
    ring(ctx, 5, R * 0.2, R * (0.3 + 0.1 * s), 0.3, '#3d5a35', '#24381f', lw);
    const k = 0.55 + 0.45 * s;
    ring(ctx, 9, R * 0.6 * k, R * 0.42 * k, 0.1, tint.out, tint.edge, lw);
    ring(ctx, 8, R * (0.36 + 0.2 * s), R * (0.36 + 0.06 * s), 0.5, tint.mid, tint.edge, lw);
    ring(ctx, 7, R * (0.2 + 0.14 * s), R * (0.3 + 0.04 * s), 0.9, tint.in, tint.edge, lw);
    ring(ctx, 5, R * (0.08 + 0.06 * s), R * 0.2, 0.2, tint.mid, tint.edge, lw);
    ctx.fillStyle = tint.core;
    blob(ctx, 0, 0, R * (0.1 - 0.03 * s), R * (0.08 - 0.02 * s), 0);
    return c;
  }

  function bakeBlooms(g) {
    const size = Math.ceil(g.U * 30);
    const sets = TINTS.map((t) => {
      const a = [];
      for (let i = 0; i < STAGES; i++) a.push(bloomAt(size, t, i / (STAGES - 1)));
      return a;
    });
    return { sets, size };
  }

  // ---- backdrop ------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const mx = g.W * 0.7;
    const my = g.H * 0.26;
    for (let i = 4; i > 0; i--) {
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#e8dcc0';
      blob(ctx, mx, my, g.U * (11 + i * 4), g.U * (11 + i * 4), 0);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ecdfbd';
    blob(ctx, mx, my, g.U * 11, g.U * 11, 0);
    ctx.fillStyle = '#dccfa8';
    blob(ctx, mx - g.U * 3, my + g.U * 2, g.U * 2.5, g.U * 1.6, 0);
    blob(ctx, mx + g.U * 4, my - g.U * 3, g.U * 1.6, g.U * 1.2, 0);
    // low roofline of a wall with grey tiles
    const wy = g.H * 0.58;
    ctx.fillStyle = '#2c3640';
    ctx.fillRect(0, wy, g.W, g.H - wy);
    ctx.fillStyle = '#e1d9c6';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, wy + g.U * 3, g.W, g.U * 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1f272f';
    for (let x = -g.U; x < g.W + g.U * 3; x += g.U * 2.2) blob(ctx, x, wy + g.U * 0.4, g.U * 1.2, g.U * 1.6, 0);
    ctx.fillRect(0, wy - g.U * 0.2, g.W, g.U * 0.8);
  }

  function rockOutline(g, cx, base, hh, ww) {
    const pts = [];
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const side = f < 0.5 ? -1 : 1;
      const t = f < 0.5 ? f * 2 : (1 - f) * 2;
      const y = base - t * hh;
      const lean = Math.sin(t * 3.1) * ww * 0.1;
      const lobes = 0.78 + 0.2 * Math.sin(t * 7.5 + 0.6) + 0.1 * Math.sin(t * 13 + side * 2.3);
      const waist = side > 0 ? 1 + 0.35 * Math.sin(t * 5 + 1) : 1 - 0.2 * Math.sin(t * 4);
      const cap = t > 0.85 ? 1 - Math.pow((t - 0.85) / 0.15, 2) * 0.7 : 1;
      const foot = t < 0.12 ? 0.6 + t * 3.3 : 1;
      const x = cx + lean + side * ww * 0.5 * lobes * waist * cap * foot;
      pts.push(x, y);
    }
    return pts;
  }

  function paintRock(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const cx = g.W * 0.36;
    const base = g.H * 0.8;
    const hh = g.H * 0.7;
    const ww = g.U * 50;
    const pts = rockOutline(g, cx, base, hh, ww);
    const path = new Path2D();
    path.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
    path.closePath();
    ctx.fillStyle = ROCK[0];
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    // lit left side, softly stepped tones
    for (let k = 1; k < ROCK.length; k++) {
      ctx.fillStyle = ROCK[k];
      for (let j = 0; j < 22; j++) {
        const t = rand();
        const y = base - t * hh;
        const x = cx - ww * 0.28 + (rand() - 0.5) * ww * 0.5 * (1 - t * 0.5);
        const s = g.U * (1.6 + rand() * 3);
        ctx.globalAlpha = 0.5;
        blob(ctx, x, y, s * 0.7, s * 1.5, (rand() - 0.5) * 0.8);
      }
    }
    ctx.globalAlpha = 1;
    // shadow side
    ctx.fillStyle = '#2f373b';
    ctx.globalAlpha = 0.55;
    for (let j = 0; j < 26; j++) {
      const t = rand();
      const y = base - t * hh;
      const x = cx + ww * 0.2 + (rand() - 0.2) * ww * 0.3;
      blob(ctx, x, y, g.U * (1 + rand() * 2.2), g.U * (2 + rand() * 3), (rand() - 0.5));
    }
    ctx.globalAlpha = 1;
    // pierced holes and hollows
    const holes = [[0.34, -0.12, 9, 5, 0.9], [0.52, 0.1, 5, 12, -0.25], [0.7, -0.05, 6, 4, -0.7], [0.2, 0.14, 4, 3, 0.2], [0.82, 0.04, 3, 2.4, 0.5]];
    for (const h of holes) {
      const hx = cx + ww * h[1];
      const hy = base - hh * h[0];
      ctx.fillStyle = '#1b232b';
      blob(ctx, hx, hy, g.U * h[2] * 0.6, g.U * h[3] * 0.6, h[4]);
      ctx.fillStyle = '#0f151b';
      blob(ctx, hx + g.U * 0.4, hy + g.U * 0.4, g.U * h[2] * 0.42, g.U * h[3] * 0.45, h[4]);
      ctx.strokeStyle = ROCK[3];
      ctx.lineWidth = Math.max(1, g.U * 0.5);
      ctx.beginPath();
      ctx.ellipse(hx, hy, g.U * h[2] * 0.6, g.U * h[3] * 0.6, h[4], Math.PI * 0.95, Math.PI * 1.7);
      ctx.stroke();
    }
    ctx.restore();
    return c;
  }

  function leafCluster(ctx, x, y, r, rand) {
    const tones = ['#2b4630', '#3a5a38', '#4f6d42'];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand() * 0.5;
      const d = r * (0.6 + rand() * 0.6);
      const lx = x + Math.cos(a) * d;
      const ly = y + Math.sin(a) * d * 0.55;
      ctx.fillStyle = tones[i % 3];
      blob(ctx, lx, ly, r * 0.5, r * 0.3, a);
      ctx.fillStyle = tones[(i + 1) % 3];
      blob(ctx, lx + r * 0.12, ly - r * 0.06, r * 0.28, r * 0.17, a + 0.4);
    }
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gy = g.H * 0.78;
    const grad = ctx.createLinearGradient(0, gy, 0, g.H);
    grad.addColorStop(0, '#3b4a35');
    grad.addColorStop(1, '#1f2b22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gy, g.W, g.H - gy);
    ctx.fillStyle = '#566a45';
    for (let i = 0; i < 70; i++) blob(ctx, rand() * g.W, gy + rand() * (g.H - gy), g.U * (1 + rand() * 2.5), g.U * 0.35, 0);
    return c;
  }

  function paintFoliage(g, rand, blooms) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const b of blooms) {
      ctx.strokeStyle = '#2f4a31';
      ctx.lineWidth = Math.max(1, g.U * 0.7);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + (rand() - 0.5) * g.U * 3, g.H * 0.9);
      ctx.stroke();
      leafCluster(ctx, b.x, b.y + b.r * 0.9, b.r * 1.15, rand);
    }
    for (let x = 0; x < g.W; x += g.U * 6) leafCluster(ctx, x + rand() * g.U * 3, g.H * (0.93 + rand() * 0.05), g.U * 5, rand);
    return c;
  }

  // ---- layout and pools ----------------------------------------------------

  function layout(g, rand) {
    const spec = [
      [0.1, 0.8, 0.9, 0], [0.21, 0.69, 0.8, 1], [0.5, 0.72, 0.85, 2], [0.62, 0.84, 1.1, 0],
      [0.74, 0.68, 0.85, 1], [0.86, 0.8, 1.0, 2], [0.38, 0.88, 0.9, 1], [0.95, 0.66, 0.7, 0],
    ];
    return spec.map((s, i) => ({
      x: g.W * s[0], y: g.H * s[1], r: g.U * 12 * s[2], set: s[3], ph: rand() * TAU + i, rate: 0.28 + rand() * 0.18,
    }));
  }

  function makePetals(g, rand, blooms) {
    const p = { x: new Float32Array(NPETAL), y: new Float32Array(NPETAL), v: new Float32Array(NPETAL),
      a: new Float32Array(NPETAL), w: new Float32Array(NPETAL), s: new Float32Array(NPETAL),
      src: new Uint8Array(NPETAL), blooms };
    for (let i = 0; i < NPETAL; i++) {
      respawn(g, p, i, rand);
      p.y[i] = g.H * 0.4 + rand() * g.H * 0.55;
    }
    return p;
  }

  function respawn(g, p, i, rand) {
    const b = p.blooms[Math.floor(rand() * p.blooms.length)];
    p.x[i] = b.x + (rand() - 0.5) * b.r;
    p.y[i] = b.y - b.r * 0.2;
    p.v[i] = g.U * (2.2 + rand() * 1.8);
    p.a[i] = rand() * TAU;
    p.w[i] = rand() * TAU;
    p.s[i] = g.U * (0.9 + rand() * 0.7);
    p.src[i] = b.set;
  }

  // ---- scene ---------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = KasuriCore.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    paintSky(back.getContext('2d'), g, rand);
    state.back = back;
    state.rock = paintRock(g, rand);
    state.ground = paintGround(g, rand);
    state.blooms = layout(g, rand);
    state.foliage = paintFoliage(g, rand, state.blooms);
    state.sprites = bakeBlooms(g);
    state.petals = makePetals(g, rand, state.blooms);
    state.mist = layer(g.W, g.U * 10);
    const m = state.mist.getContext('2d');
    m.fillStyle = '#c9cfc4';
    for (let i = 0; i < 6; i++) blob(m, (i + 0.5) * g.W / 6, g.U * 5, g.W / 7, g.U * (2 + (i % 3)), 0);
  }

  function drawBlooms(ctx, g, t, amount) {
    const S = state.sprites;
    const top = STAGES - 1;
    for (const b of state.blooms) {
      const k = 0.5 + 0.5 * Math.sin(t * b.rate + b.ph);
      const open = Math.min(1, Math.max(0, 0.5 + (k - 0.5) * Math.min(1.6, amount)));
      const f = open * top;
      const i = Math.min(top - 1, Math.floor(f));
      const mix = f - i;
      const set = S.sets[b.set];
      const d = b.r * 2.4;
      ctx.globalAlpha = 1;
      ctx.drawImage(set[i], b.x - d / 2, b.y - d / 2, d, d);
      ctx.globalAlpha = mix;
      ctx.drawImage(set[i + 1], b.x - d / 2, b.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
  }

  function drawPetals(ctx, g, dt, t, amount) {
    const p = state.petals;
    if (amount <= 0) return;
    const groundY = g.H * 0.96;
    for (let i = 0; i < NPETAL; i++) {
      p.y[i] += p.v[i] * dt;
      p.a[i] += dt * 0.8;
      if (p.y[i] > groundY) respawn(g, p, i, state.rand);
      const x = p.x[i] + Math.sin(t * 0.7 + p.w[i]) * g.U * 2.2;
      ctx.fillStyle = TINTS[p.src[i]].mid;
      ctx.globalAlpha = Math.min(1, amount) * 0.9;
      ctx.beginPath();
      ctx.ellipse(x, p.y[i], p.s[i], p.s[i] * 0.62, p.a[i], 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { bloom, petals } = api.props;
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.rock, 0, 0);
    ctx.drawImage(state.ground, 0, 0);
    ctx.globalAlpha = 0.28;
    ctx.drawImage(state.mist, ((t * g.U * 0.8) % g.W) - g.W, g.H * 0.74);
    ctx.drawImage(state.mist, (t * g.U * 0.8) % g.W, g.H * 0.74);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.foliage, 0, 0);
    drawBlooms(ctx, g, t, bloom);
    drawPetals(ctx, g, Math.min(dt, 0.1), t, petals);
  }

  Kasuri.run({
    defaults: { bloom: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
