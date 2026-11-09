/*
 * 流星 Ryusei — a quiet meteor shower over a mountain lake.
 *
 * Sky, stars, peaks and the shore are baked once, and so is their mirror image.
 * The lake is that mirror laid back in thin rows that sway by whole pixels.
 * Meteors are a small reused pool of faint streaks that fade in and out, each
 * with a dimmer twin in the water where open sky is reflected.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, parseColor } = K;

  const HORIZON = 0.6;
  const SKY = ['#18213c', '#1b2541', '#1e2946', '#222d4b', '#263250', '#2a3755', '#2f3c5a', '#34415f', '#3a4764', '#414d68', '#48536c', '#4f5a70'];
  const GLOW = ['#34446a', '#3e4f76'];
  const STARS = ['#e8e0cc', '#b9b4a6', '#8e8c86', '#d8c48a'];
  const FAR = '#303b57';
  const FAR_LIT = '#3d4968';
  const NEAR = '#1f283a';
  const NEAR_LIT = '#2c3750';
  const SNOW = '#b8bcc4';
  const SNOW_SHADE = '#7c8597';
  const PINES = '#1f3029';
  const SHORE = '#141c1a';
  const WATER_TINT = '#0f1a2c';
  const REEDS = '#1a2420';
  const STREAK = ['#f2ead6', '#ead9a8'];
  const MAX_METEORS = 8;
  const TAIL = 7;
  const TWINKLES = 24;
  const PAD = 6;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const HZ = Math.round(H * HORIZON);
    return { W, H, HZ, U: H / 100 };
  }

  // ---- baked layers ----------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.HZ);
    const px = new Uint32Array(img.data.buffer);
    const tones = SKY.map(parseColor);
    const glow = GLOW.map(parseColor);
    const pack = (c) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
    const toneInts = tones.map(pack);
    const glowInts = glow.map(pack);
    for (let y = 0; y < g.HZ; y++) {
      const band = Math.min(SKY.length - 1, Math.floor((y / g.HZ) * SKY.length));
      for (let x = 0; x < g.W; x++) {
        const u = x / g.W;
        const v = y / g.HZ;
        const along = v - (0.9 - u * 0.75);
        const n = fbm(x / (g.U * 14), y / (g.U * 14), 3, 7);
        const haze = Math.exp(-along * along * 30) * (0.5 + n);
        let c = toneInts[band];
        if (haze > 0.95) c = glowInts[1];
        else if (haze > 0.6) c = glowInts[0];
        px[y * g.W + x] = c;
      }
    }
    ctx.putImageData(img, 0, 0);
    const count = Math.round((g.W * g.HZ) / 70);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * g.W);
      const y = Math.floor(Math.pow(rand(), 1.3) * g.HZ * 0.95);
      const r = rand();
      ctx.fillStyle = STARS[r < 0.12 ? 0 : r < 0.4 ? 1 : r < 0.92 ? 2 : 3];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function ridge(g, x, seed, base, height, peak) {
    const u = x / g.W;
    const n = fbm(x / (g.U * 22), seed, 4, seed);
    const cone = Math.max(0, 1 - Math.abs(u - peak) * 2.6);
    return g.HZ - g.H * (base + height * (0.35 * n + 0.65 * cone * cone));
  }

  function paintRange(ctx, g, tops, seed, base, height, peak, dark, lit, snowAt) {
    let prev = ridge(g, -1, seed, base, height, peak);
    for (let x = 0; x < g.W; x++) {
      const fy = ridge(g, x, seed, base, height, peak);
      const y = Math.round(fy);
      const rising = fy < prev;
      prev = fy;
      ctx.fillStyle = dark;
      ctx.fillRect(x, y, 1, g.HZ - y);
      const face = Math.round(g.U * (0.8 + 1.6 * fbm(x / (g.U * 5), seed, 2, 5)));
      if (rising) {
        ctx.fillStyle = lit;
        ctx.fillRect(x, y, 1, Math.min(g.HZ - y, face));
      }
      if (snowAt > 0) {
        const peakY = g.HZ - g.H * snowAt;
        const snow = Math.round(g.U * (4 + 4 * fbm(x / (g.U * 3), 5, 2, 9)) - (y - peakY) * 0.45);
        if (snow > 0) {
          ctx.fillStyle = rising ? SNOW : SNOW_SHADE;
          ctx.fillRect(x, y, 1, snow);
        }
      }
      tops[x] = Math.min(tops[x], y);
    }
  }

  function paintLand(ctx, g) {
    const tops = new Float32Array(g.W).fill(g.HZ);
    paintRange(ctx, g, tops, 3, 0.05, 0.2, 0.22, FAR, FAR_LIT, 0);
    paintRange(ctx, g, tops, 11, 0.03, 0.3, 0.64, NEAR, NEAR_LIT, 0.3);
    ctx.fillStyle = PINES;
    for (let x = 0; x < g.W; x++) {
      const tooth = Math.abs(((x / (g.U * 2.2)) % 1) - 0.5) * 2;
      const h = g.U * (1.6 + 2.2 * fbm(x / (g.U * 9), 2, 3, 4)) * (1 - tooth * 0.55);
      const y = Math.round(g.HZ - h);
      ctx.fillRect(x, y, 1, g.HZ - y);
      tops[x] = Math.min(tops[x], y);
    }
    return tops;
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.HZ);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    const tops = paintLand(ctx, g);
    return { canvas: c, tops };
  }

  function paintReflection(g, world) {
    const c = layer(g.W + PAD * 2, g.HZ);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, -1, 0, g.HZ);
    ctx.drawImage(world, PAD, 0);
    ctx.drawImage(world, 0, 0, 1, g.HZ, 0, 0, PAD, g.HZ);
    ctx.drawImage(world, g.W - 1, 0, 1, g.HZ, g.W + PAD, 0, PAD, g.HZ);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = WATER_TINT;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalAlpha = 1;
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = SHORE;
    for (let x = 0; x < g.W; x++) {
      const u = x / g.W;
      const lift = Math.max(0, 0.22 - u) / 0.22;
      const h = g.U * (1.2 + 5 * lift * lift + 1.2 * fbm(x / (g.U * 6), 8, 3, 2));
      ctx.fillRect(x, Math.round(g.H - h), 1, Math.ceil(h));
    }
    ctx.strokeStyle = REEDS;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    const reeds = Math.round(g.W / (g.U * 2.2));
    for (let i = 0; i < reeds; i++) {
      const x = Math.pow(rand(), 1.8) * g.W * 0.3;
      const h = g.U * (5 + rand() * 9) * (1 - x / (g.W * 0.36));
      const lean = (rand() - 0.3) * g.U * 2;
      ctx.beginPath();
      ctx.moveTo(x, g.H);
      ctx.quadraticCurveTo(x, g.H - h * 0.6, x + lean, g.H - h);
      ctx.stroke();
    }
    return c;
  }

  function makeTwinkles(g, rand) {
    const T = { x: new Int16Array(TWINKLES), y: new Int16Array(TWINKLES), p: new Float32Array(TWINKLES) };
    for (let i = 0; i < TWINKLES; i++) {
      T.x[i] = Math.floor(rand() * g.W);
      T.y[i] = Math.floor(rand() * g.HZ * 0.7);
      T.p[i] = rand() * Math.PI * 2;
    }
    return T;
  }

  function makeMeteors() {
    const n = MAX_METEORS;
    return {
      x: new Float32Array(n), y: new Float32Array(n),
      vx: new Float32Array(n), vy: new Float32Array(n),
      age: new Float32Array(n), life: new Float32Array(n),
      len: new Float32Array(n), tone: new Uint8Array(n),
      live: new Uint8Array(n), wait: 0.6,
    };
  }

  // ---- motion ----------------------------------------------------------------

  function spawn(g, M, rand) {
    for (let i = 0; i < MAX_METEORS; i++) {
      if (M.live[i]) continue;
      const speed = g.U * (26 + rand() * 22);
      const angle = 0.55 + rand() * 0.45;
      const dir = rand() < 0.75 ? 1 : -1;
      M.x[i] = g.W * (0.1 + rand() * 0.8);
      M.y[i] = g.HZ * rand() * 0.35;
      M.vx[i] = Math.cos(angle) * speed * dir;
      M.vy[i] = Math.sin(angle) * speed;
      M.age[i] = 0;
      M.life[i] = 0.9 + rand() * 0.9;
      M.len[i] = g.U * (8 + rand() * 9);
      M.tone[i] = rand() < 0.7 ? 0 : 1;
      M.live[i] = 1;
      return;
    }
  }

  function stepMeteors(g, M, rand, dt, rate) {
    if (rate > 0) {
      M.wait -= dt;
      if (M.wait <= 0) {
        spawn(g, M, rand);
        M.wait = (0.4 + rand() * 1.2) / rate;
      }
    }
    for (let i = 0; i < MAX_METEORS; i++) {
      if (!M.live[i]) continue;
      M.age[i] += dt;
      if (M.age[i] >= M.life[i]) M.live[i] = 0;
    }
  }

  function drawMeteors(ctx, g, M, tops) {
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    for (let i = 0; i < MAX_METEORS; i++) {
      if (!M.live[i]) continue;
      const a = M.age[i];
      const fade = Math.min(1, Math.sin((Math.PI * a) / M.life[i]) * 1.4) * 0.8;
      const hx = M.x[i] + M.vx[i] * a;
      const hy = M.y[i] + M.vy[i] * a;
      const sp = Math.hypot(M.vx[i], M.vy[i]);
      const dx = (M.vx[i] / sp) * (M.len[i] / TAIL);
      const dy = (M.vy[i] / sp) * (M.len[i] / TAIL);
      ctx.strokeStyle = STREAK[M.tone[i]];
      for (let k = 0; k < TAIL; k++) {
        const x0 = hx - dx * k;
        const y0 = hy - dy * k;
        if (y0 >= g.HZ) continue;
        const col = x0 | 0;
        if (col < 0 || col >= g.W || y0 >= tops[col]) continue;
        const alpha = fade * (1 - k / TAIL);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 - dx, y0 - dy);
        ctx.stroke();
        const ry = 2 * g.HZ - y0;
        if (ry < g.H) {
          ctx.globalAlpha = alpha * 0.35;
          ctx.beginPath();
          ctx.moveTo(x0, ry);
          ctx.lineTo(x0 - dx, ry + dy);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTwinkles(ctx, T, t) {
    ctx.fillStyle = STARS[0];
    for (let i = 0; i < TWINKLES; i++) {
      const s = Math.sin(t * 0.9 + T.p[i]);
      if (s < 0.2) continue;
      ctx.globalAlpha = (s - 0.2) * 0.8;
      ctx.fillRect(T.x[i], T.y[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawWater(ctx, g, t, ripple) {
    const rows = g.H - g.HZ;
    const refl = state.reflection;
    for (let r = 0; r < rows; r++) {
      const depth = r / rows;
      const amp = ripple * (0.4 + depth * 3.2) * g.U * 0.5;
      const wave = Math.sin(t * 0.9 + r * 0.9 / Math.max(0.6, g.U * 0.6)) + 0.5 * Math.sin(t * 0.47 - r * 0.31);
      let dx = Math.round(wave * amp);
      if (dx > PAD) dx = PAD;
      else if (dx < -PAD) dx = -PAD;
      ctx.drawImage(refl, PAD - dx, r, g.W, 1, 0, g.HZ + r, g.W, 1);
    }
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = K.rng((api.seed || 1) + 17);
    const world = paintWorld(g, rand);
    state.world = world.canvas;
    state.tops = world.tops;
    state.reflection = paintReflection(g, world.canvas);
    state.front = paintFront(g, rand);
    state.twinkles = makeTwinkles(g, rand);
    state.meteors = makeMeteors();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { meteors, ripple } = api.props;
    ctx.imageSmoothingEnabled = false;
    stepMeteors(g, state.meteors, state.rand, Math.min(dt, 0.1), meteors);
    ctx.drawImage(state.world, 0, 0);
    drawTwinkles(ctx, state.twinkles, t);
    drawWater(ctx, g, t, ripple);
    drawMeteors(ctx, g, state.meteors, state.tops);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { meteors: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
