/*
 * 塔 Tawa — a red and white lattice radio tower over the city at dusk.
 *
 * Sky, skyline and tower are baked once per grid. Lit windows live on their
 * own layer and are switched a few at a time, so the city slowly comes on.
 * Per frame: clouds, the mast beacon and a train on the viaduct.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const HORIZON = 0.7;
  const TOWER = { x: 0.6, top: 0.15, base: 0.72, halfBase: 0.11, halfTop: 0.006 };
  const MAST_TOP = 0.04;
  const BANDS = 9;
  const DECKS = [
    { f: 0.36, half: 0.022, h: 2.2 },
    { f: 0.62, half: 0.04, h: 3.4 },
  ];
  const VIADUCT = 0.875;
  const TRAIN_CYCLE = 26;
  const TRAIN_RUN = 14;
  const TRAIN_CARS = 6;
  const WINDOW_TICK = 0.25;
  const WINDOW_CYCLE = 90;
  const LIT = ['#e8c47a', '#efe2c0', '#d9a35a', '#e6d6a8'];
  const RED = parseColor('#c4452e');
  const WHITE = parseColor('#e6dccb');
  const state = {};

  const hex = toHex;
  const rgb = parseColor;

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, '#1a2048');
    grad.addColorStop(0.45, '#3e3f6e');
    grad.addColorStop(0.75, '#9a5a66');
    grad.addColorStop(1, '#e0905a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // Low warm glow where the sun has just gone.
    const glow = ctx.createRadialGradient(g.W * 0.22, g.H * HORIZON, 0, g.W * 0.22, g.H * HORIZON, g.W * 0.45);
    glow.addColorStop(0, 'rgba(238,176,98,0.55)');
    glow.addColorStop(1, 'rgba(238,176,98,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e6e4da';
    for (let i = 0; i < g.W * 0.25; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.25, 1, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.09, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        const warm = y / h;
        img.data[i] = lerp(150, 236, warm);
        img.data[i + 1] = lerp(120, 150, warm);
        img.data[i + 2] = lerp(150, 120, warm);
        img.data[i + 3] = smoothstep(0.5, 0.68, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- tower -------------------------------------------------------------

  function towerY(g, f) {
    return g.H * lerp(TOWER.top, TOWER.base, f);
  }

  // Half width at fraction f down the tower; the legs flare toward the base.
  function towerHalf(g, f) {
    return g.W * lerp(TOWER.halfTop, TOWER.halfBase, Math.pow(f, 2.1));
  }

  function bandColor(f, shade) {
    const band = Math.min(BANDS - 1, Math.floor(f * BANDS));
    const base = band % 2 === 0 ? RED : WHITE;
    return hex(mixColor(base, rgb('#3a2a40'), shade));
  }

  function paintTowerBody(ctx, g) {
    const cx = g.W * TOWER.x;
    const y0 = Math.floor(towerY(g, 0));
    const y1 = Math.ceil(towerY(g, 1));
    for (let y = y0; y < y1; y++) {
      const f = (y - y0) / (y1 - y0);
      const half = towerHalf(g, f);
      // Lattice fill: a see-through panel between the legs.
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = bandColor(f, 0.2);
      ctx.fillRect(cx - half, y, half * 2, 1);
      ctx.globalAlpha = 1;
      const leg = Math.max(1, half * 0.16);
      ctx.fillStyle = bandColor(f, 0);
      ctx.fillRect(cx - half, y, leg, 1);
      ctx.fillStyle = bandColor(f, 0.35);
      ctx.fillRect(cx + half - leg, y, leg, 1);
    }
    paintBracing(ctx, g, cx);
  }

  function paintBracing(ctx, g, cx) {
    const steps = 14;
    ctx.lineWidth = 1;
    for (let k = 0; k < steps; k++) {
      const fa = k / steps;
      const fb = (k + 1) / steps;
      const ya = towerY(g, fa);
      const yb = towerY(g, fb);
      const ha = towerHalf(g, fa);
      const hb = towerHalf(g, fb);
      ctx.strokeStyle = bandColor((fa + fb) / 2, 0.1);
      ctx.beginPath();
      ctx.moveTo(cx - ha, ya);
      ctx.lineTo(cx + hb, yb);
      ctx.moveTo(cx + ha, ya);
      ctx.lineTo(cx - hb, yb);
      ctx.moveTo(cx - hb, yb);
      ctx.lineTo(cx + hb, yb);
      ctx.stroke();
    }
    // Arch between the feet.
    const yb = towerY(g, 1);
    const hb = towerHalf(g, 1);
    ctx.fillStyle = '#2a2236';
    ctx.beginPath();
    ctx.ellipse(cx, yb, hb * 0.62, g.U * 7, 0, Math.PI, 0);
    ctx.fill();
  }

  function paintDecks(ctx, g) {
    const cx = g.W * TOWER.x;
    for (const d of DECKS) {
      const yy = towerY(g, d.f);
      const half = g.W * d.half;
      const h = g.U * d.h;
      ctx.fillStyle = '#d8d0c0';
      ctx.fillRect(cx - half, yy - h, half * 2, h);
      ctx.fillStyle = '#e8c47a';
      ctx.fillRect(cx - half + 1, yy - h * 0.7, half * 2 - 2, Math.max(1, h * 0.4));
      ctx.fillStyle = '#5a3a3e';
      ctx.fillRect(cx - half, yy, half * 2, Math.max(1, g.U * 0.5));
    }
  }

  function paintMast(ctx, g) {
    const cx = g.W * TOWER.x;
    const y0 = g.H * MAST_TOP;
    const y1 = towerY(g, 0);
    const segs = 6;
    for (let k = 0; k < segs; k++) {
      ctx.fillStyle = hex(k % 2 === 0 ? RED : WHITE);
      const ya = lerp(y0, y1, k / segs);
      ctx.fillRect(cx - 1, ya, 2, (y1 - y0) / segs + 1);
    }
  }

  // ---- city --------------------------------------------------------------

  function paintFarCity(ctx, g, rand) {
    ctx.fillStyle = '#4c3a5c';
    let x = 0;
    while (x < g.W) {
      const w = g.U * (2 + rand() * 5);
      const h = g.H * (0.03 + rand() * 0.09);
      ctx.fillRect(x, g.H * HORIZON - h, w + 1, h + g.H);
      x += w;
    }
  }

  function addWindows(list, x0, y0, w, h, g, rand, far) {
    const step = far ? g.U * 1.6 : g.U * 2;
    for (let yy = y0 + g.U; yy < y0 + h - g.U; yy += step) {
      for (let xx = x0 + g.U * 0.8; xx < x0 + w - g.U; xx += step) {
        if (rand() < 0.15) continue;
        list.push({ x: xx, y: yy, w: Math.max(1, step * 0.5), h: Math.max(1, step * 0.45), c: LIT[Math.floor(rand() * LIT.length)], far });
      }
    }
  }

  function paintMidCity(ctx, g, rand, list) {
    let x = 0;
    while (x < g.W) {
      const w = g.U * (5 + rand() * 9);
      const nearTower = Math.abs(x + w / 2 - g.W * TOWER.x) < g.W * 0.13;
      const h = g.H * (nearTower ? 0.03 + rand() * 0.04 : 0.05 + rand() * 0.1);
      const top = g.H * 0.78 - h;
      ctx.fillStyle = hex(mixColor(rgb('#2e2c4c'), rgb('#4a3654'), rand()));
      ctx.fillRect(x, top, w, g.H - top);
      addWindows(list, x, top, w, g.H * 0.78 - top, g, rand, true);
      x += w + g.U * rand() * 2;
    }
  }

  function paintNearCity(ctx, g, rand, list) {
    let x = -g.U * 2;
    while (x < g.W) {
      const w = g.U * (8 + rand() * 14);
      const nearTower = Math.abs(x + w / 2 - g.W * TOWER.x) < g.W * 0.12;
      const h = g.H * (nearTower ? 0.07 + rand() * 0.05 : 0.1 + rand() * 0.13);
      const top = g.H * 0.9 - h;
      ctx.fillStyle = hex(mixColor(rgb('#171a30'), rgb('#262640'), rand()));
      ctx.fillRect(x, top, w, g.H - top);
      ctx.fillStyle = 'rgba(214,160,120,0.18)';
      ctx.fillRect(x, top, w, 1);
      addWindows(list, x, top, w, g.H * VIADUCT - top - g.U, g, rand, false);
      x += w + g.U * (0.5 + rand() * 1.5);
    }
  }

  function paintViaduct(ctx, g) {
    const y = g.H * VIADUCT;
    ctx.fillStyle = '#2a2a3c';
    ctx.fillRect(0, y, g.W, g.U * 1.6);
    ctx.fillStyle = '#121424';
    ctx.fillRect(0, y + g.U * 1.6, g.W, g.H);
    ctx.fillStyle = '#3a3448';
    for (let x = 0; x < g.W; x += g.U * 12) ctx.fillRect(x, y + g.U * 1.6, g.U * 2, g.H);
    // A row of warm street lamps under the deck.
    ctx.fillStyle = '#c8954a';
    for (let x = g.U * 6; x < g.W; x += g.U * 12) ctx.fillRect(x, y + g.U * 5, 1, 1);
  }

  function bake(g) {
    const rand = K.rng(4417);
    state.sky = paintSky(g, rand);
    const front = layer(g.W, g.H);
    const ctx = front.getContext('2d');
    const list = [];
    paintFarCity(ctx, g, rand);
    paintTowerBody(ctx, g);
    paintDecks(ctx, g);
    paintMast(ctx, g);
    paintMidCity(ctx, g, rand, list);
    paintNearCity(ctx, g, rand, list);
    paintViaduct(ctx, g);
    state.front = front;
    state.windows = list;
    state.lit = new Uint8Array(list.length);
    state.litCount = 0;
    state.glass = layer(g.W, g.H);
    state.glassCtx = state.glass.getContext('2d');
    state.rand = K.rng(91);
    state.tick = 0;
  }

  // ---- windows -----------------------------------------------------------

  function targetLit(t, amount) {
    const wave = 0.5 - 0.5 * Math.cos((t / WINDOW_CYCLE) * Math.PI * 2);
    return clamp((0.2 + wave * 0.45) * amount, 0, 0.95);
  }

  function setWindow(i, on) {
    const w = state.windows[i];
    const ctx = state.glassCtx;
    if (on) {
      ctx.globalAlpha = w.far ? 0.65 : 0.95;
      ctx.fillStyle = w.c;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.globalAlpha = 1;
    } else {
      ctx.clearRect(Math.floor(w.x), Math.floor(w.y), Math.ceil(w.w) + 1, Math.ceil(w.h) + 1);
    }
    state.lit[i] = on ? 1 : 0;
    state.litCount += on ? 1 : -1;
  }

  // Flip one window toward the target; a few tries is plenty.
  function nudge(want) {
    const n = state.windows.length;
    for (let tries = 0; tries < 8; tries++) {
      const i = Math.floor(state.rand() * n);
      if (state.lit[i] !== (want ? 1 : 0)) {
        setWindow(i, want);
        return;
      }
    }
  }

  function updateWindows(t, dt, amount) {
    const n = state.windows.length;
    if (!n) return;
    const goal = Math.round(targetLit(t, amount) * n);
    if (state.tick === 0) {
      while (state.litCount < goal) nudge(true);
    }
    state.tick += dt;
    if (state.tick < WINDOW_TICK) return;
    state.tick = 1e-6;
    const flips = 1 + Math.floor(n / 300);
    for (let k = 0; k < flips; k++) {
      if (state.litCount < goal) nudge(true);
      else if (state.litCount > goal) nudge(false);
      else if (state.rand() < 0.5) nudge(state.rand() < 0.5);
    }
  }

  // ---- moving things -----------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = Math.min(1, amount * 0.85);
    ctx.drawImage(c, off, g.H * 0.08);
    ctx.drawImage(c, off + c.width, g.H * 0.08);
    ctx.globalAlpha = 1;
  }

  function drawBeacon(ctx, g, t) {
    const cx = g.W * TOWER.x;
    const y = g.H * MAST_TOP;
    const pulse = 0.55 + 0.35 * Math.sin(t * 1.3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#d6452c';
    ctx.fillRect(cx - 1.5, y - 1.5, 3, 3);
    ctx.globalAlpha = pulse * 0.25;
    ctx.fillRect(cx - g.U * 1.2, y - g.U * 1.2, g.U * 2.4, g.U * 2.4);
    ctx.globalAlpha = 1;
  }

  function drawTrain(ctx, g, t) {
    const p = (t % TRAIN_CYCLE) / TRAIN_RUN;
    if (p >= 1) return;
    const carW = g.U * 9;
    const len = carW * TRAIN_CARS;
    const x0 = lerp(g.W + g.U, -len - g.U, p);
    const top = g.H * VIADUCT - g.U * 3;
    const h = g.U * 3;
    for (let k = 0; k < TRAIN_CARS; k++) {
      const x = x0 + k * carW;
      ctx.fillStyle = '#b8b4a8';
      ctx.fillRect(x, top, carW - 1, h);
      ctx.fillStyle = '#e8c47a';
      ctx.fillRect(x + g.U, top + h * 0.25, carW - g.U * 2 - 1, Math.max(1, h * 0.35));
      ctx.fillStyle = '#3c5a86';
      ctx.fillRect(x, top + h * 0.75, carW - 1, Math.max(1, h * 0.15));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    bake(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    updateWindows(t, dt, props.windows);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.front, 0, 0);
    ctx.drawImage(state.glass, 0, 0);
    drawBeacon(ctx, g, t);
    if (props.train) drawTrain(ctx, g, t);
  }

  Kasuri.run({
    defaults: { windows: 1, clouds: 1, train: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
