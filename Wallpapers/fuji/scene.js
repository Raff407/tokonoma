/*
 * 富士 Fuji — the mountain over a still lake, on your clock.
 *
 * Sky and mountain are cached and refreshed twice a minute. Each frame the
 * clouds drift across, then the whole upper half is mirrored row by row into
 * the lake with a small sideways wobble per row, which is all a reflection
 * on calm water needs. A pagoda and pines stand in silhouette on the shore.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const Sky = KasuriSky;
  const { clamp, lerp, fbm, noise2, hash2, parseColor: P, mixColor } = K;

  const ROCK = { lit: P('#7a768f'), shade: P('#3e3b52') };
  const SNOW = { lit: P('#f3f1ec'), shade: P('#a9b0c4') };
  const SHORE = P('#121218');

  const state = { refreshIn: 0, shooting: null, birds: [], nextBirds: 12 };

  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const tint = (c, amb, k = 1) => [c[0] * amb[0] * k, c[1] * amb[1] * k, c[2] * amb[2] * k];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, horizon: Math.round(H * 0.6), peakX: W * 0.58, peakY: H * 0.19, base: Math.min(W * 0.4, H * 0.95) };
  }

  // Ridge height at x: two gentle concave flanks meeting at a flat summit.
  function ridgeY(g, x) {
    const d = Math.abs(x - g.peakX) / g.base;
    if (d < 0.035) return g.peakY + d * 6;
    const fall = Math.pow(clamp(d, 0, 1), 0.72);
    return lerp(g.peakY, g.horizon + 2 * g.U, fall) + (fbm(x * 0.15, 4.2, 2) - 0.5) * 0.8;
  }

  function paintSky(ctx, g, sky, seed) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.horizon);
    grad.addColorStop(0, rgb(sky.top));
    grad.addColorStop(1, rgb(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.horizon + 1);

    if (sky.night < 0.98) {
      const t = Sky.sunT(sky.hour);
      const sx = lerp(0.1, 0.9, t) * g.W;
      const sy = g.horizon - Math.sin(t * Math.PI) * g.H * 0.45;
      const warm = mixColor(P('#fff3d6'), P('#ffa860'), 1 - Math.sin(t * Math.PI));
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18 * g.U);
      halo.addColorStop(0, rgb(warm, 0.5 * (1 - sky.night)));
      halo.addColorStop(1, rgb(warm, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, g.W, g.horizon);
      ctx.fillStyle = rgb(warm, 1 - sky.night);
      disc(ctx, sx, sy, 3.6 * g.U);
    }
    if (sky.night > 0.02) {
      const t = Sky.moonT(sky.hour);
      const mx = lerp(0.12, 0.88, t) * g.W;
      const my = g.H * 0.08 + (1 - Math.sin(t * Math.PI)) * g.H * 0.25;
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 16 * g.U);
      halo.addColorStop(0, rgb(P('#e9e4cf'), 0.4 * sky.night));
      halo.addColorStop(1, rgb(P('#e9e4cf'), 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, g.W, g.horizon);
      ctx.fillStyle = rgb(P('#f4eed8'), sky.night);
      disc(ctx, mx, my, 2.8 * g.U);
      ctx.fillStyle = rgb(P('#cfc8b0'), sky.night * 0.8);
      disc(ctx, mx - 0.8 * g.U, my - 0.4 * g.U, 0.9 * g.U);
    }

    // Far hills either side of the mountain, in haze.
    ctx.fillStyle = rgb(mixColor(sky.haze, P('#1c2030'), 0.35));
    ctx.beginPath();
    ctx.moveTo(0, g.horizon);
    for (let x = 0; x <= g.W; x++) {
      ctx.lineTo(x, g.horizon - (2 + fbm(x * 0.03, seed % 50, 3) * 7) * g.U);
    }
    ctx.lineTo(g.W, g.horizon);
    ctx.closePath();
    ctx.fill();
  }

  function paintMountain(ctx, g, sky) {
    const amb = sky.amb.map((c) => c / 255);
    const img = ctx.getImageData(0, 0, g.W, g.horizon);
    const d = img.data;
    for (let x = 0; x < g.W; x++) {
      const top = ridgeY(g, x);
      const left = x < g.peakX;
      for (let y = Math.max(0, Math.floor(top)); y < g.horizon; y++) {
        const depth = (y - g.peakY) / (g.horizon - g.peakY);
        // Snow line: ragged fingers reaching down the gullies.
        const gully = fbm(x * 0.11, 3.3, 3);
        const snowLine = 0.3 + gully * 0.22 + (fbm(x * 0.35, 1.7, 2) - 0.5) * 0.08;
        const snowy = depth < snowLine;
        const lit = left ? 1 : 0.55 + 0.25 * gully;
        const pal = snowy ? SNOW : ROCK;
        let c = mixColor(pal.shade, pal.lit, lit);
        c = mixColor(c, sky.haze, clamp(depth * 0.55, 0, 0.55));
        // Moonlight: the shared night tint is tuned for close things; lift the far slope a touch.
        c = tint(c, amb, 1 + 0.35 * sky.night);
        const i = (y * g.W + x) * 4;
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function rebuild(api) {
    const g = state.g;
    const sky = Sky.at(Sky.hour(api.props.time));
    state.sky = sky;
    const ctx = state.far.getContext('2d');
    paintSky(ctx, g, sky, state.seed);
    paintMountain(ctx, g, sky);
    paintShore(state.shore.getContext('2d'), g, sky);
    state.refreshIn = 30;
  }

  function paintShore(ctx, g, sky) {
    ctx.clearRect(0, 0, g.W, g.H);
    const ink = rgb(mixColor(SHORE, sky.top, 0.25));
    ctx.fillStyle = ink;
    // A low hill on the left with a five-storey pagoda, pines along the right bank.
    const hill = (x) => g.H - (18 - 14 * clamp(x / (g.W * 0.32), 0, 1) ** 1.6) * g.U;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W * 0.34; x++) ctx.lineTo(x, hill(x) + (fbm(x * 0.2, 9, 2) - 0.5) * 1.5);
    ctx.lineTo(g.W * 0.34, g.H);
    ctx.closePath();
    ctx.fill();

    const px = g.W * 0.13;
    const pb = hill(px);
    for (let k = 0; k < 5; k++) {
      const w = (7 - k * 0.9) * g.U;
      const y = pb - (k + 1) * 3.4 * g.U;
      ctx.fillRect(px - w * 0.35, y, w * 0.7, 3.4 * g.U);
      ctx.beginPath();
      ctx.moveTo(px - w, y + 0.6 * g.U);
      ctx.lineTo(px + w, y + 0.6 * g.U);
      ctx.lineTo(px + w * 0.55, y - 0.6 * g.U);
      ctx.lineTo(px - w * 0.55, y - 0.6 * g.U);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(px - 0.2 * g.U, pb - 23 * g.U, 0.4 * g.U, 6 * g.U);

    for (let i = 0; i < 9; i++) {
      const x = g.W * (0.78 + i * 0.03) + hash2(i, 1, 3) * 3 * g.U;
      const h = (6 + hash2(i, 2, 3) * 9) * g.U;
      const base = g.horizon + 1.5 * g.U;
      ctx.fillRect(x - 0.3 * g.U, base - h, 0.6 * g.U, h);
      for (let k = 0; k < 4; k++) {
        const y = base - h + k * h * 0.22;
        const w = (1.4 + k * 0.9) * g.U;
        ctx.beginPath();
        ctx.ellipse(x, y, w, 1.1 * g.U, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillRect(g.W * 0.74, g.horizon, g.W * 0.26, 2 * g.U);
  }

  function drawClouds(ctx, g, t, sky, amount) {
    if (amount <= 0) return;
    const img = ctx.getImageData(0, 0, g.W, g.horizon);
    const d = img.data;
    const light = mixColor(P('#ffffff'), sky.low, 0.35).map((c, i) => c * (sky.amb[i] / 255));
    const shade = mixColor(sky.haze, sky.top, 0.3);
    const bands = [g.H * 0.24, g.H * 0.4, g.H * 0.52];
    for (let y = 0; y < g.horizon; y++) {
      let band = 0;
      for (const b of bands) band = Math.max(band, 1 - Math.abs(y - b) / (5 * g.U));
      if (band <= 0) continue;
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x * 0.025 - t * 0.04, y * 0.12, 4, 21);
        const a = clamp((n - 0.62 + 0.25 * amount) * 4, 0, 1) * band;
        if (a <= 0.01) continue;
        const top = noise2(x * 0.05 - t * 0.04, y * 0.2 - 0.3, 22);
        const c = mixColor(shade, light, top);
        const i = (y * g.W + x) * 4;
        d[i] = lerp(d[i], c[0], a * 0.9);
        d[i + 1] = lerp(d[i + 1], c[1], a * 0.9);
        d[i + 2] = lerp(d[i + 2], c[2], a * 0.9);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function drawStars(ctx, g, t) {
    const night = state.sky.night;
    if (night < 0.05) return;
    for (const s of state.stars) {
      if (s.y >= ridgeY(g, s.x) - 1) continue;
      ctx.fillStyle = `rgba(255,248,230,${night * s.b * (0.55 + 0.45 * Math.sin(t * s.speed + s.p))})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    if (!state.shooting && state.rand() < 0.002 * night) {
      state.shooting = { x: state.rand() * g.W, y: state.rand() * g.H * 0.25, age: 0 };
    }
    const s = state.shooting;
    if (s) {
      s.age += 1 / 30;
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgba(255,250,240,${(1 - k / 6) * (1 - s.age / 0.8)})`;
        ctx.fillRect(s.x + s.age * 60 - k * 1.5, s.y + s.age * 22 - k * 0.55, 1, 1);
      }
      if (s.age > 0.8) state.shooting = null;
    }
  }

  function drawBirds(ctx, g, t, dt) {
    if (state.sky.night > 0.7) return;
    state.nextBirds -= dt;
    if (state.nextBirds <= 0 && state.birds.length === 0) {
      const y = g.H * (0.1 + state.rand() * 0.25);
      for (let i = 0; i < 5; i++) {
        state.birds.push({ x: -6 - Math.abs(i - 2) * 4, y: y + Math.abs(i - 2) * 2.5, phase: state.rand() * 3 });
      }
      state.nextBirds = 40 + state.rand() * 60;
    }
    ctx.fillStyle = rgb(mixColor(P('#1a1820'), state.sky.top, 0.2));
    for (const b of state.birds) {
      b.x += 7 * dt;
      const up = Math.sin(t * 6 + b.phase) > 0 ? -1 : 0;
      ctx.fillRect(b.x - 2, b.y + up, 2, 1);
      ctx.fillRect(b.x, b.y + 1, 1, 1);
      ctx.fillRect(b.x + 1, b.y + up, 2, 1);
    }
    state.birds = state.birds.filter((b) => b.x < g.W + 10);
  }

  function drawLake(ctx, g, t, ripple) {
    const lakeTop = g.horizon;
    const upper = state.upper;
    upper.getContext('2d').drawImage(ctx.canvas, 0, 0);
    // Under the wobbling rows, so their edges never show a gap.
    ctx.fillStyle = rgb(mixColor(state.sky.low, state.sky.top, 0.5));
    ctx.fillRect(0, lakeTop, g.W, g.H - lakeTop);
    for (let y = lakeTop; y < g.H; y++) {
      const depth = (y - lakeTop) / (g.H - lakeTop);
      const src = lakeTop - 1 - (y - lakeTop) * 1.15;
      if (src < 0) break;
      const wobble = Math.sin(y * 1.7 + t * 1.3) * ripple * (0.4 + depth * 2.2) + (noise2(y * 0.3, t * 0.6) - 0.5) * ripple * 1.5;
      ctx.drawImage(upper, 0, Math.floor(src), g.W, 1, wobble - 3, y, g.W + 6, 1);
    }
    const dim = ctx.createLinearGradient(0, lakeTop, 0, g.H);
    dim.addColorStop(0, 'rgba(8,10,20,0.25)');
    dim.addColorStop(1, 'rgba(8,10,20,0.6)');
    ctx.fillStyle = dim;
    ctx.fillRect(0, lakeTop, g.W, g.H - lakeTop);

    // Glints: short bright dashes that come and go on the water.
    const glint = mixColor(state.sky.low, P('#ffffff'), 0.5);
    for (let i = 0; i < g.W * 0.4; i++) {
      const x = hash2(i, 7, 5) * g.W;
      const y = lakeTop + 1 + hash2(i, 9, 5) * (g.H - lakeTop);
      const a = Math.max(0, Math.sin(t * (0.8 + hash2(i, 3, 5)) + i)) ** 6;
      if (a < 0.05) continue;
      ctx.fillStyle = rgb(glint, a * 0.5);
      ctx.fillRect(x, y, 2, 1);
    }
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.seed = api.seed % 100000;
    state.rand = K.rng(api.seed);
    state.far = layer(g.W, g.H);
    state.shore = layer(g.W, g.H);
    state.upper = layer(g.W, g.horizon);
    state.stars = Array.from({ length: Math.round((g.W * g.horizon) / 40) }, () => ({
      x: Math.floor(state.rand() * g.W),
      y: Math.floor(state.rand() * g.horizon),
      p: state.rand() * 6.28,
      b: 0.4 + state.rand() * 0.6,
      speed: 0.6 + state.rand() * 2,
    }));
    rebuild(api);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    state.refreshIn -= dt / Math.max(api.props.speed, 0.01);
    if (state.refreshIn <= 0) rebuild(api);
    ctx.drawImage(state.far, 0, 0);
    drawStars(ctx, g, t);
    drawClouds(ctx, g, t, state.sky, api.props.clouds);
    drawBirds(ctx, g, t, dt);
    drawLake(ctx, g, t, api.props.ripple);
    ctx.drawImage(state.shore, 0, 0);
  }

  Kasuri.run({
    defaults: {
      time: 'auto',
      clouds: 1,
      ripple: 1,
      ramp: 'lines',
      cell: 9,
    },
    maxFps: 20,
    setup,
    draw,
    onProps(props, api) {
      rebuild(api);
    },
  });
})();
