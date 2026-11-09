/*
 * 雲雀 Hibari — a skylark climbing over a barley field on a pale spring morning.
 *
 * Sky, Fuji, hills, cherry tree and torii are baked once. The barley and the rapeseed
 * edge are baked textures drawn in thin rows that sway; a soft sheen of light runs
 * through the barley as the wind passes. Larks follow a closed-form path, petals are a
 * short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  const SKY = ['#c9d3d0', '#d9ddd2', '#e8e4d2', '#efe8d4'];
  const BARLEY = ['#5f7d3c', '#7b9a4e', '#9db262', '#b5c377'];
  const BLOOM = ['#c4a238', '#d8b844', '#e6c85a'];
  const PETAL = '#e9d6cf';
  const MARGIN = 4;
  const PERIOD = 34;
  const MAX_PETALS = 16;
  const state = {};
  const pos = { x: 0, y: 0 };
  const petals = { x: new Float32Array(MAX_PETALS), y: new Float32Array(MAX_PETALS), p: new Float32Array(MAX_PETALS), v: new Float32Array(MAX_PETALS) };

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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const hy = Math.round(H * 0.5);
    const fy0 = Math.round(H * 0.54);
    const fy1 = Math.round(H * 0.84);
    return { W, H, U, hy, fy0, fy1 };
  }

  function hillY(g, x) {
    return g.hy - g.U * (1.5 + fbm(x / (g.U * 30), 2.2, 3, 7) * 5);
  }

  // ---- back layer ----------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.hy + 2);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < img.height; y++) {
      const f = Math.min(1, y / g.hy) * (inks.length - 1);
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

  function paintFuji(ctx, g, rand) {
    const px = g.W * 0.72;
    const half = g.W * 0.2;
    const peak = g.hy - g.H * 0.27;
    for (let x = Math.floor(px - half); x <= px + half; x++) {
      const f = Math.abs(x - px) / half;
      const top = peak + (g.hy - peak) * Math.pow(f, 0.82);
      ctx.fillStyle = '#a8b4bc';
      ctx.fillRect(x, top, 1, g.hy - top + 1);
      const snow = (g.hy - peak) * (0.2 + 0.07 * fbm(x / (g.U * 4), 0.7, 2, 31)) * (1 - f * 0.6);
      ctx.fillStyle = '#eceae0';
      ctx.fillRect(x, top, 1, Math.max(0, snow));
    }
    ctx.fillStyle = '#e3e5da';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, g.hy - g.U * 3.5, g.W, g.U * 3.5);
    ctx.globalAlpha = 1;
  }

  function paintHills(ctx, g, rand) {
    ctx.fillStyle = '#92a79a';
    ctx.beginPath();
    ctx.moveTo(0, g.fy0);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, hillY(g, x) - g.U * 1.2 * (1 + Math.sin(x / (g.U * 14))));
    ctx.lineTo(g.W, g.fy0);
    ctx.fill();
    ctx.fillStyle = '#6f8a62';
    ctx.beginPath();
    ctx.moveTo(0, g.fy0);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, hillY(g, x + 90) + g.U * 1.2);
    ctx.lineTo(g.W, g.fy0);
    ctx.fill();
    ctx.fillStyle = '#586f4d';
    for (let x = 0; x < g.W; x += g.U * (1.5 + rand() * 2)) {
      const y = hillY(g, x + 90) + g.U * 1.2;
      blob(ctx, x, y + g.U * 0.4, g.U * (0.9 + rand() * 0.9), g.U * 0.6);
    }
  }

  function sakura(ctx, g, rand) {
    const x = g.W * 0.2;
    const y = hillY(g, x + 90) + g.U * 2;
    const h = g.U * 11;
    ctx.strokeStyle = '#3d3029';
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - h * 0.1, y - h * 0.45, x + h * 0.05, y - h * 0.7);
    ctx.moveTo(x - h * 0.05, y - h * 0.4);
    ctx.lineTo(x - h * 0.4, y - h * 0.68);
    ctx.moveTo(x + h * 0.02, y - h * 0.5);
    ctx.lineTo(x + h * 0.38, y - h * 0.72);
    ctx.stroke();
    const tones = ['#d9bfb9', '#e6d2cb', '#efe3dc'];
    for (let i = 0; i < 26; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * h * 0.5;
      ctx.fillStyle = tones[Math.floor(rand() * 3)];
      blob(ctx, x + Math.cos(a) * d * 1.2, y - h * 0.72 + Math.sin(a) * d * 0.6, h * (0.1 + rand() * 0.08), h * (0.07 + rand() * 0.06));
    }
  }

  function torii(ctx, g) {
    const x = g.W * 0.45;
    const y = hillY(g, x + 90) + g.U * 2.2;
    const u = g.U;
    const w = u * 3.2;
    const h = u * 5.2;
    ctx.fillStyle = '#b4452c';
    ctx.fillRect(x - w + u * 0.4, y - h, u * 0.7, h);
    ctx.fillRect(x + w - u * 1.1, y - h, u * 0.7, h);
    ctx.fillRect(x - w - u * 0.9, y - h - u * 0.5, w * 2 + u * 1.8, u * 0.8);
    ctx.fillRect(x - w, y - h + u * 1.2, w * 2, u * 0.55);
    ctx.fillStyle = '#2d2824';
    ctx.fillRect(x - w - u * 1.1, y - h - u * 0.9, w * 2 + u * 2.2, u * 0.5);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.fy0 + 2);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintFuji(ctx, g, rand);
    paintHills(ctx, g, rand);
    sakura(ctx, g, rand);
    torii(ctx, g);
    return c;
  }

  function paintHaze(g, rand) {
    const c = layer(g.W, g.hy);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2ede0';
    for (let i = 0; i < 6; i++) {
      const x = (i + rand() * 0.5) * (g.W / 6);
      const y = g.H * (0.06 + rand() * 0.22);
      ctx.globalAlpha = 0.28 + rand() * 0.2;
      blob(ctx, x, y, g.U * (9 + rand() * 12), g.U * (0.5 + rand() * 0.5));
      blob(ctx, x + g.U * 5, y - g.U * 0.6, g.U * (4 + rand() * 6), g.U * 0.4);
      if (x + g.U * 20 > g.W) blob(ctx, x - g.W, y, g.U * (9 + rand() * 12), g.U * 0.6);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- barley and rapeseed -------------------------------------------------

  function paintBarley(g, rand) {
    const h = g.fy1 - g.fy0;
    const c = layer(g.W + MARGIN * 2, h + 1);
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const d = y / h;
      ctx.fillStyle = K.mixColor(BARLEY[1], BARLEY[0], d * 0.7);
      ctx.fillRect(0, y, c.width, 1);
    }
    for (let y = 0; y < h; ) {
      const d = y / h;
      const s = g.U * (0.45 + d * 0.9);
      const sh = g.U * (0.8 + d * 1.8);
      for (let x = -s; x < c.width; x += s * (0.8 + rand() * 0.8)) {
        const k = Math.min(3, Math.floor(rand() * rand() * 4 + d * 1.2));
        ctx.fillStyle = BARLEY[k];
        ctx.fillRect(x, y - sh * rand(), Math.max(1, s * 0.5), sh);
      }
      y += Math.max(1, s * 0.55);
    }
    return c;
  }

  function paintSheen(g) {
    const h = g.fy1 - g.fy0;
    const c = layer(g.W, h + 1);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const d = img.data;
    const cyc = Math.max(2, Math.round(g.W / (g.U * 38)));
    for (let y = 0; y < c.height; y++) {
      const depth = 0.45 + 0.55 * (y / h);
      for (let x = 0; x < c.width; x++) {
        const a = x / c.width;
        let v = Math.sin(a * TAU * cyc) * 0.6 + Math.sin(a * TAU * (cyc * 2 + 1)) * 0.4;
        v = Math.max(0, v);
        const i = (y * c.width + x) * 4;
        d[i] = 214;
        d[i + 1] = 222;
        d[i + 2] = 150;
        d[i + 3] = Math.round(v * v * 105 * depth);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintRape(g, rand) {
    const h = g.H - g.fy1;
    const c = layer(g.W + MARGIN * 2, h + 1);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6a8238';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < h + g.U * 2; ) {
      const d = Math.min(1, y / h);
      const s = g.U * (0.7 + d * 1.5);
      for (let x = -s; x < c.width; x += s * (0.7 + rand() * 0.6)) {
        ctx.fillStyle = '#566e30';
        ctx.fillRect(x, y + s * 0.3, Math.max(1, s * 0.25), s * 1.4);
        ctx.fillStyle = BLOOM[Math.floor(rand() * 3)];
        blob(ctx, x, y, s * (0.5 + rand() * 0.35), s * (0.36 + rand() * 0.2));
      }
      y += s * 0.55;
    }
    ctx.fillStyle = '#5a7234';
    ctx.fillRect(0, 0, c.width, Math.max(1, g.U * 0.5));
    return c;
  }

  function drawRows(ctx, src, y0, h, t, amp, speed, sx) {
    for (let y = 0; y < h; y++) {
      const dx = amp * Math.sin(y * 0.42 - t * 1.5 * speed + y * y * 0.002) * (0.4 + y / h);
      ctx.drawImage(src, 0, y, src.width, 1, -MARGIN + dx + sx, y0 + y, src.width, 1);
    }
  }

  function drawSheen(ctx, g, t, wind) {
    const h = g.fy1 - g.fy0;
    const sh = state.sheen;
    const w = sh.width;
    ctx.globalAlpha = Math.min(1, 0.35 + wind * 0.4);
    for (let y = 0; y < h; y += 1) {
      const off = ((t * wind * g.U * 2.2 + y * 1.6) % w + w) % w;
      ctx.drawImage(sh, 0, y, w, 1, -off, g.fy0 + y, w, 1);
      ctx.drawImage(sh, 0, y, w, 1, w - off, g.fy0 + y, w, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- skylark -------------------------------------------------------------

  function larkAt(g, t, off, xs) {
    const tt = t + off;
    const c = Math.floor(tt / PERIOD);
    const p = tt / PERIOD - c;
    const hx = Math.sin(c * 12.9898 + xs * 78.233) * 43758.5453;
    const x0 = g.W * (0.22 + 0.5 * (hx - Math.floor(hx)));
    const climb = smoothstep(0, 0.74, p);
    const fall = smoothstep(0.9, 1, p);
    const top = g.fy0 - g.H * 0.4;
    const wob = Math.sin(tt * 0.9) * g.U * 2.2 * climb;
    pos.x = x0 + p * g.U * 22 + wob + Math.sin(tt * 3.1) * g.U * 0.25;
    pos.y = g.fy0 + g.U * 3 + (top - g.fy0 - g.U * 3) * climb + (g.fy0 + g.U * 5 - top) * fall + Math.sin(tt * 2.3) * g.U * 0.35 * climb;
    return p;
  }

  function drawLark(ctx, g, t, off, xs, scale) {
    const p = larkAt(g, t, off, xs);
    if (p > 0.97) return;
    const s = g.U * scale;
    const x = pos.x;
    const y = pos.y;
    const fl = Math.sin(t * 15 + off) * 0.5 + 0.5;
    ctx.fillStyle = '#e9e3cf';
    ctx.globalAlpha = 0.5;
    for (let k = 1; k <= 3; k++) {
      larkAt(g, t - k * 0.5, off, xs);
      ctx.fillRect(pos.x, pos.y, Math.max(1, s * 0.3), Math.max(1, s * 0.3));
      ctx.globalAlpha -= 0.15;
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3a3126';
    ctx.lineWidth = Math.max(1, s * 0.45);
    ctx.beginPath();
    ctx.moveTo(x - s * 1.5, y - s * 0.2 - fl * s);
    ctx.lineTo(x - s * 0.2, y);
    ctx.lineTo(x + s * 1.5, y - s * 0.2 - fl * s);
    ctx.stroke();
    ctx.fillStyle = '#4a3d30';
    blob(ctx, x, y + s * 0.1, s * 0.9, s * 0.45);
    ctx.fillStyle = '#6b5a45';
    ctx.fillRect(x + s * 0.5, y - s * 0.5, Math.max(1, s * 0.4), Math.max(1, s * 0.3));
  }

  // ---- petals --------------------------------------------------------------

  function resetPetal(g, i, rand) {
    petals.x[i] = g.W * (0.14 + rand() * 0.12);
    petals.y[i] = hillY(g, g.W * 0.2) - g.U * (3 + rand() * 8);
    petals.p[i] = rand() * TAU;
    petals.v[i] = 0.6 + rand() * 0.8;
  }

  function stepPetals(g, dt, wind, count) {
    for (let i = 0; i < count; i++) {
      petals.x[i] += dt * g.U * (2 + wind * 3) * petals.v[i];
      petals.y[i] += dt * g.U * 1.6 * petals.v[i];
      if (petals.y[i] > g.fy0 + g.U * 2 || petals.x[i] > g.W) resetPetal(g, i, state.rand);
    }
  }

  function drawPetals(ctx, g, t, count) {
    const sz = Math.max(1, g.U * 0.5);
    ctx.fillStyle = PETAL;
    for (let i = 0; i < count; i++) {
      ctx.fillRect(petals.x[i] + Math.sin(t * 1.3 + petals.p[i]) * g.U * 0.8, petals.y[i], sz, sz * 0.7);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.haze = paintHaze(g, rand);
    state.barley = paintBarley(g, rand);
    state.sheen = paintSheen(g);
    state.rape = paintRape(g, rand);
    for (let i = 0; i < MAX_PETALS; i++) {
      resetPetal(g, i, rand);
      petals.x[i] += rand() * g.U * 10;
      petals.y[i] += rand() * g.U * 8;
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const wind = api.props.wind;
    const count = Math.min(MAX_PETALS, Math.round(8 * api.props.petals));
    stepPetals(g, Math.min(dt, 0.1), wind, count);
    ctx.drawImage(state.back, 0, 0);
    const hz = ((t * g.U * 0.5) % g.W + g.W) % g.W;
    ctx.drawImage(state.haze, -hz, 0);
    ctx.drawImage(state.haze, g.W - hz, 0);
    drawPetals(ctx, g, t, count);
    drawLark(ctx, g, t, 0, 1, 1.1);
    drawLark(ctx, g, t, 17, 2, 0.65);
    const amp = g.U * 0.5 * wind;
    drawRows(ctx, state.barley, g.fy0, state.barley.height - 1, t, amp, 1 + wind * 0.5, 0);
    drawSheen(ctx, g, t, wind);
    drawRows(ctx, state.rape, g.fy1, state.rape.height - 1, t, amp * 0.7, 1 + wind * 0.5, 0);
  }

  Kasuri.run({
    defaults: { wind: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
