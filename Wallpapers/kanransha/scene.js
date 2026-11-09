/*
 * 観覧車 Kanransha — a great wheel turning slowly on the edge of a bay at night.
 *
 * Sky, moon, far shore and the wheel's legs are baked once. Each frame the rim,
 * spokes, lamps and cabins are drawn at the new angle onto a small world layer,
 * which is shown above the waterline and laid back flipped, in sliding rows, below it.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.66;
  const SKY = ['#121a2e', '#18223a', '#1f2b45', '#283550', '#36405a', '#4a4a5c'];
  const INK = { far: '#1b2232', shore: '#141a26', near: '#0f131c', steel: '#8f939a', spoke: '#5c6577', hub: '#b9b3a0' };
  const WINDOW = ['#c9a456', '#a88a4e', '#d8c08a'];
  const LAMP = '#e0bd62';
  const LAMP_WARM = '#cf5f3c';
  const CABINS = ['#c4513a', '#d1a64e', '#56709a', '#6f8a55', '#d9cfb4'];
  const CABIN_COUNT = 16;
  const SPOKES = 32;
  const LAMPS = 64;
  const STREAKS = 60;
  const VEIL = '#16203a';
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const wy = Math.round(H * WATER);
    const R = Math.min(H * 0.27, W * 0.24);
    const cx = W * 0.64;
    const base = wy - U * 1.5;
    const cy = base - R - U * 5;
    return { W, H, U, wy, R, cx, cy, base };
  }

  // ---- baked layers ---------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = g.wy;
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.pow(y / h, 1.6) * (inks.length - 1);
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

  function paintMoon(ctx, g) {
    const x = g.W * 0.2;
    const y = g.H * 0.17;
    const r = g.U * 4.2;
    ctx.fillStyle = '#2c3753';
    blob(ctx, x, y, r * 2.2, r * 2.2);
    ctx.fillStyle = '#3a4562';
    blob(ctx, x, y, r * 1.5, r * 1.5);
    ctx.fillStyle = '#e6dcc0';
    blob(ctx, x, y, r, r);
    ctx.fillStyle = '#cfc6aa';
    blob(ctx, x + r * 0.3, y + r * 0.2, r * 0.3, r * 0.25);
    blob(ctx, x - r * 0.35, y - r * 0.25, r * 0.2, r * 0.18);
  }

  function paintStars(g, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    const n = Math.round((g.W * g.H) / 160);
    for (let i = 0; i < n; i++) {
      const y = Math.pow(rand(), 1.8) * g.wy * 0.7;
      const x = rand() * g.W;
      ctx.fillStyle = rand() < 0.2 ? '#e2cf94' : '#b8bccb';
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    return c;
  }

  function paintShore(ctx, g, rand) {
    const U = g.U;
    ctx.fillStyle = INK.far;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const y = g.wy - U * 7 - K.fbm(x / (U * 30), 2.2, 3, 7) * U * 9 - Math.exp(-(((x - g.W * 0.12) / (g.W * 0.18)) ** 2)) * U * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
    for (let x = -U; x < g.W; ) {
      const w = U * (2 + rand() * 4);
      const h = U * (1.5 + rand() * rand() * 9);
      const top = g.wy - U * 0.8 - h;
      ctx.fillStyle = INK.shore;
      ctx.fillRect(x, top, w, h + U);
      for (let wy = top + U; wy < g.wy - U * 1.5; wy += U * 1.6) {
        for (let wx = x + U * 0.6; wx < x + w - U * 0.6; wx += U * 1.4) {
          if (rand() < 0.22) {
            ctx.fillStyle = WINDOW[Math.floor(rand() * WINDOW.length)];
            ctx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
          }
        }
      }
      x += w + U * rand() * 1.5;
    }
    ctx.fillStyle = INK.near;
    ctx.fillRect(0, g.wy - U * 0.9, g.W, U * 0.9 + 1);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 1);
    paintSky(c.getContext('2d'), g, rand);
    return c;
  }

  function paintScenery(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintMoon(ctx, g);
    paintShore(ctx, g, rand);
    return c;
  }

  // Legs, hub mount, the boarding hall and the pier: everything in front of the turning rim.
  function paintFrame(g) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const U = g.U;
    const spread = g.R * 0.62;
    ctx.strokeStyle = '#767d8c';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, U * 1.1);
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(g.cx, g.cy);
      ctx.lineTo(g.cx + s * spread, g.base);
      ctx.moveTo(g.cx + s * spread * 0.35, lerp(g.cy, g.base, 0.35));
      ctx.lineTo(g.cx - s * spread * 0.62, lerp(g.cy, g.base, 0.62));
    }
    ctx.stroke();
    ctx.fillStyle = '#2a3148';
    ctx.fillRect(g.cx - g.R * 0.75, g.base - U * 4, g.R * 1.5, U * 4);
    ctx.fillStyle = '#2d3550';
    ctx.fillRect(g.cx - g.R * 0.8, g.base - U * 4.6, g.R * 1.6, U * 0.8);
    ctx.fillStyle = WINDOW[0];
    for (let x = g.cx - g.R * 0.68; x < g.cx + g.R * 0.66; x += U * 2.4) ctx.fillRect(Math.round(x), Math.round(g.base - U * 2.8), Math.max(1, U * 1.2), Math.max(1, U * 1.2));
    ctx.fillStyle = INK.near;
    ctx.fillRect(g.cx - g.R * 1.3, g.base, g.R * 2.6, g.wy - g.base + 1);
    ctx.fillStyle = '#29303f';
    ctx.fillRect(g.cx - g.R * 1.3, g.base, g.R * 2.6, Math.max(1, U * 0.4));
    return c;
  }

  // ---- the wheel -----------------------------------------------------------

  function drawWheel(ctx, g, a, t) {
    const R = g.R;
    const U = g.U;
    ctx.strokeStyle = INK.spoke;
    ctx.lineWidth = Math.max(1, U * 0.25);
    ctx.beginPath();
    for (let i = 0; i < SPOKES; i++) {
      const s = a + (i / SPOKES) * TAU;
      ctx.moveTo(g.cx + Math.cos(s) * U * 1.5, g.cy + Math.sin(s) * U * 1.5);
      ctx.lineTo(g.cx + Math.cos(s) * R, g.cy + Math.sin(s) * R);
    }
    ctx.stroke();
    ctx.strokeStyle = INK.steel;
    ctx.lineWidth = Math.max(1, U * 0.55);
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = INK.spoke;
    ctx.lineWidth = Math.max(1, U * 0.35);
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, R * 0.9, 0, TAU);
    ctx.stroke();
    const ls = Math.max(1, Math.round(U * 0.8));
    const wave = t * 0.12;
    for (let i = 0; i < LAMPS; i++) {
      const s = a + (i / LAMPS) * TAU;
      const w = Math.sin((i / LAMPS) * TAU * 2 - wave * TAU);
      ctx.fillStyle = w > 0.55 ? LAMP_WARM : LAMP;
      ctx.fillRect(Math.round(g.cx + Math.cos(s) * R - ls / 2), Math.round(g.cy + Math.sin(s) * R - ls / 2), ls, ls);
    }
    const cw = U * 2.8;
    const ch = U * 3;
    for (let i = 0; i < CABIN_COUNT; i++) {
      const s = a + (i / CABIN_COUNT) * TAU;
      const x = g.cx + Math.cos(s) * R;
      const y = g.cy + Math.sin(s) * R;
      ctx.fillStyle = INK.spoke;
      ctx.fillRect(x - 0.5, y, 1, U * 0.8);
      ctx.fillStyle = CABINS[i % CABINS.length];
      ctx.fillRect(x - cw / 2, y + U * 0.6, cw, ch);
      ctx.fillStyle = '#e8d49a';
      ctx.fillRect(x - cw * 0.3, y + U * 1.1, cw * 0.6, ch * 0.4);
    }
    ctx.fillStyle = INK.hub;
    blob(ctx, g.cx, g.cy, U * 1.6, U * 1.6);
    ctx.fillStyle = '#3c4354';
    blob(ctx, g.cx, g.cy, U * 0.7, U * 0.7);
  }

  // ---- water ---------------------------------------------------------------

  function waveAt(g, y, t, ripple) {
    const d = (y - g.wy) / (g.H - g.wy);
    const amp = g.U * (0.15 + 1.6 * d) * ripple;
    const k = y / g.U;
    return amp * (Math.sin(k * 0.8 + t * 0.9) + 0.5 * Math.sin(k * 2.1 - t * 1.4));
  }

  function drawWater(ctx, g, t, ripple) {
    const f = state.flipCtx;
    f.setTransform(1, 0, 0, -1, 0, g.wy);
    f.drawImage(state.world, 0, 0);
    f.setTransform(1, 0, 0, 1, 0, 0);
    const water = g.H - g.wy;
    ctx.fillStyle = VEIL;
    ctx.fillRect(0, g.wy, g.W, water);
    let y = 0;
    while (y < water) {
      const h = Math.max(1, Math.round(g.U * lerp(0.6, 2.2, y / water)));
      const dx = Math.round(waveAt(g, g.wy + y, t, ripple));
      ctx.drawImage(state.flip, 0, y, g.W, h, dx, g.wy + y, g.W, h);
      y += h;
    }
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = VEIL;
    ctx.fillRect(0, g.wy, g.W, water);
    ctx.globalAlpha = 1;
  }

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS), gold: new Uint8Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      const d = 0.02 + 0.98 * Math.pow(rand(), 1.4);
      const gold = i % 3 === 0;
      s.gold[i] = gold ? 1 : 0;
      s.x[i] = gold ? g.cx + (rand() - 0.5) * g.R * 2 : rand() * g.W;
      s.y[i] = g.wy + d * (g.H - g.wy);
      s.l[i] = g.U * (1.5 + d * 6) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawStreaks(ctx, g, t, ripple) {
    const s = state.streaks;
    const thick = Math.max(1, Math.round(g.U * 0.4));
    const amount = Math.min(1, ripple);
    if (amount <= 0) return;
    for (let i = 0; i < STREAKS; i++) {
      const a = Math.sin(t * 0.45 + s.p[i]);
      if (a < 0.3) continue;
      ctx.fillStyle = s.gold[i] ? '#b99a52' : '#2a3654';
      const x = s.x[i] + Math.sin(t * 0.3 + s.p[i]) * g.U * 2 - s.l[i] / 2;
      ctx.fillRect(Math.round(x), Math.round(s.y[i]), Math.round(s.l[i] * a * amount), thick);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.stars = paintStars(g, rand);
    state.scenery = paintScenery(g, rand);
    state.frame = paintFrame(g);
    state.world = layer(g.W, g.wy + 1);
    state.worldCtx = state.world.getContext('2d');
    state.flip = layer(g.W, g.wy + 1);
    state.flipCtx = state.flip.getContext('2d');
    state.streaks = makeStreaks(g, rand);
    state.angle = rand() * TAU;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { turn, ripple, stars } = api.props;
    state.angle += Math.min(dt, 0.1) * 0.05 * turn;
    const w = state.worldCtx;
    w.drawImage(state.back, 0, 0);
    if (stars) w.drawImage(state.stars, 0, 0);
    w.drawImage(state.scenery, 0, 0);
    drawWheel(w, g, state.angle, t);
    w.drawImage(state.frame, 0, 0);
    ctx.drawImage(state.world, 0, 0);
    drawWater(ctx, g, t, ripple);
    drawStreaks(ctx, g, t, ripple);
  }

  Kasuri.run({
    defaults: { turn: 1, ripple: 1, stars: true, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
