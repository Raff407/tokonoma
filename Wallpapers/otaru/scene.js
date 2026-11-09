/*
 * 小樽 Otaru — the canal on a snowy night, stone warehouses and gas lamps.
 *
 * Sky, hill, warehouses and bank are baked once, then the whole bank is flipped into
 * a dark reflection that slides sideways in thin rows. Lamp light breathes very
 * slowly. Snow is one short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.62;
  const SKY = ['#0f1530', '#1a2142', '#2c3252', '#454a64', '#6a6c7c'];
  const STONE = ['#4c4a4a', '#5a5651', '#3f3e43'];
  const PLASTER = '#cfc8b2';
  const SNOW = '#e4e0d2';
  const ROOF = '#2b2a31';
  const LAMP_GOLD = '#e6c259';
  const WARM = '#e9b95a';
  const VERMILION = '#b33a29';
  const WATER_INK = '#0e1626';
  const VEIL = 0.4;
  const MAX_FLAKES = 260;
  const FLAKES = 130;
  const STREAKS = 40;
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
    const wy = Math.round(H * WATER);
    return { W, H, U, wy, bank: wy - U * 3 };
  }

  // ---- sky and far hill ------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = g.bank;
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / (g.bank * 0.95)) * (inks.length - 1);
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
    ctx.fillStyle = '#8c8a86';
    ctx.globalAlpha = 0.22;
    blob(ctx, g.W * 0.78, g.H * 0.13, g.U * 9, g.U * 9);
    ctx.globalAlpha = 0.3;
    blob(ctx, g.W * 0.78, g.H * 0.13, g.U * 4, g.U * 4);
    ctx.globalAlpha = 1;
  }

  function ridge(g, x) {
    return g.H * 0.3 + fbm(x / (g.U * 35), 2.2, 3, 17) * g.H * 0.12;
  }

  function fir(ctx, x, y, h, ink, snow) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 4; i++) {
      const w = h * (0.14 + i * 0.07);
      const top = y - h + i * h * 0.22;
      poly(ctx, [x, top, x + w, top + h * 0.3, x - w, top + h * 0.3]);
    }
    ctx.fillRect(x - h * 0.02, y - h * 0.1, Math.max(1, h * 0.04), h * 0.1);
    ctx.fillStyle = snow;
    for (let i = 0; i < 4; i++) {
      const w = h * (0.14 + i * 0.07);
      const top = y - h + i * h * 0.22;
      poly(ctx, [x, top, x + w * 0.45, top + h * 0.12, x - w * 0.45, top + h * 0.12]);
    }
  }

  function paintHill(ctx, g, rand) {
    ctx.fillStyle = '#3a4262';
    ctx.beginPath();
    ctx.moveTo(0, g.bank);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x));
    ctx.lineTo(g.W, g.bank);
    ctx.fill();
    ctx.fillStyle = '#8a8da0';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, g.bank);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x) + g.U * 1.4 * (1 + Math.sin(x / (g.U * 3)) * 0.4));
    ctx.lineTo(g.W, g.bank);
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let x = 0; x < g.W; x += g.U * (2 + rand() * 3)) {
      const y = ridge(g, x) + g.U * (2 + rand() * 9);
      fir(ctx, x, y + g.U * 3, g.U * (4 + rand() * 4), '#252f46', '#8f94a0');
    }
  }

  // ---- warehouses ------------------------------------------------------------

  function stoneWall(ctx, g, rand, x, y, w, h) {
    ctx.fillStyle = STONE[0];
    ctx.fillRect(x, y, w, h);
    const course = g.U * 1.3;
    for (let r = 0, yy = y; yy < y + h; r++, yy += course) {
      for (let xx = x + (r % 2) * course; xx < x + w; xx += course * (1.6 + rand() * 0.8)) {
        ctx.fillStyle = STONE[1 + (rand() < 0.5 ? 1 : 0)];
        ctx.fillRect(xx, yy, Math.min(course * 1.5, x + w - xx) - 1, Math.min(course, y + h - yy) - 1);
      }
    }
  }

  function window2(ctx, g, x, y, lit) {
    const u = g.U;
    ctx.fillStyle = '#26242a';
    ctx.fillRect(x - u * 0.9, y - u * 1.4, u * 1.8, u * 2.8);
    ctx.fillStyle = lit ? WARM : '#141826';
    ctx.fillRect(x - u * 0.6, y - u * 1.1, u * 1.2, u * 2.2);
    ctx.fillStyle = '#26242a';
    ctx.fillRect(x - u * 0.05, y - u * 1.1, Math.max(1, u * 0.1), u * 2.2);
    ctx.fillStyle = SNOW;
    ctx.fillRect(x - u * 1.1, y + u * 1.3, u * 2.2, Math.max(1, u * 0.35));
  }

  function warehouse(ctx, g, rand, b) {
    const u = g.U;
    const x = b.x;
    const w = b.w;
    const top = g.bank - b.h;
    stoneWall(ctx, g, rand, x, top, w, b.h);
    ctx.fillStyle = PLASTER;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, top, w, u * 1.6);
    ctx.globalAlpha = 1;
    const cx = x + w / 2;
    const rise = w * 0.3;
    ctx.fillStyle = ROOF;
    poly(ctx, [x - u * 1.2, top + u * 0.6, cx, top - rise, x + w + u * 1.2, top + u * 0.6]);
    ctx.fillStyle = '#3a3942';
    for (let k = 1; k < 4; k++) {
      const f = k / 4;
      ctx.fillRect(lerp(x, cx, f * 0.5) , top - rise * f * 0.5, Math.max(1, u * 0.18), u * 0.5);
    }
    ctx.fillStyle = SNOW;
    poly(ctx, [x - u * 1.5, top + u * 0.5, cx, top - rise - u * 1.4, cx, top - rise + u * 0.4, x - u * 0.6, top + u * 0.9]);
    poly(ctx, [x + w + u * 1.5, top + u * 0.5, cx, top - rise - u * 1.4, cx, top - rise + u * 0.4, x + w + u * 0.6, top + u * 0.9]);
    ctx.fillStyle = ROOF;
    blob(ctx, cx, top - rise - u * 1.6, u * 0.7, u * 0.5);
    const cols = Math.max(1, Math.floor(w / (u * 6)));
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + (w / cols) * (c + 0.5);
        const wyy = top + u * (5 + r * 5.5);
        if (b.door && c === Math.floor(cols / 2) && r === b.rows - 1) continue;
        window2(ctx, g, wx, wyy, rand() < 0.35);
      }
    }
    if (b.door) {
      const dw = u * 4.4;
      const dh = u * 6.4;
      ctx.fillStyle = '#222026';
      ctx.fillRect(cx - dw / 2 - u * 0.4, g.bank - dh - u * 0.4, dw + u * 0.8, dh + u * 0.4);
      ctx.fillStyle = '#6d4a2c';
      ctx.fillRect(cx - dw / 2, g.bank - dh, dw / 2 - 0.5, dh);
      ctx.fillRect(cx + 0.5, g.bank - dh, dw / 2 - 0.5, dh);
      ctx.fillStyle = '#2a2326';
      for (let k = 1; k < 4; k++) ctx.fillRect(cx - dw / 2, g.bank - dh + (dh / 4) * k, dw, Math.max(1, u * 0.25));
      ctx.fillStyle = SNOW;
      ctx.fillRect(cx - dw / 2 - u * 0.6, g.bank - dh - u * 0.9, dw + u * 1.2, Math.max(1, u * 0.55));
      lantern(ctx, g, cx + dw / 2 + u * 1.6, g.bank - dh * 0.8);
    }
  }

  // A small paper lantern hung beside a door.
  function lantern(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#2a2326';
    ctx.fillRect(x - u * 0.1, y - u * 1.9, Math.max(1, u * 0.2), u * 0.8);
    ctx.fillStyle = VERMILION;
    blob(ctx, x, y - u * 0.4, u * 0.85, u * 1.15);
    ctx.fillStyle = '#d98a4c';
    blob(ctx, x - u * 0.1, y - u * 0.5, u * 0.4, u * 0.7);
    ctx.fillStyle = '#2a2326';
    ctx.fillRect(x - u * 0.5, y - u * 1.5, u, Math.max(1, u * 0.25));
    ctx.fillRect(x - u * 0.5, y + u * 0.55, u, Math.max(1, u * 0.25));
  }

  function bankWall(ctx, g, rand) {
    const u = g.U;
    stoneWall(ctx, g, rand, 0, g.bank, g.W, g.wy - g.bank + 1);
    ctx.fillStyle = SNOW;
    ctx.fillRect(0, g.bank - u * 0.5, g.W, u * 0.9);
    for (let x = 0; x < g.W; x += u * (2 + rand() * 4)) blob(ctx, x, g.bank - u * 0.5, u * (1 + rand()), u * 0.5);
    ctx.fillStyle = '#18202c';
    ctx.fillRect(0, g.wy - Math.max(1, u * 0.4), g.W, Math.max(1, u * 0.4) + 1);
  }

  function row(g) {
    const u = g.U;
    const xs = [];
    let x = -u * 4;
    const seq = [
      { w: 26, h: 21, rows: 2, door: true },
      { w: 20, h: 17, rows: 2, door: false },
      { w: 30, h: 24, rows: 2, door: true },
      { w: 22, h: 19, rows: 2, door: false },
      { w: 28, h: 22, rows: 2, door: true },
      { w: 24, h: 18, rows: 2, door: false },
    ];
    for (let i = 0; x < g.W + u * 4; i++) {
      const s = seq[i % seq.length];
      xs.push({ x: x, w: s.w * u, h: s.h * u, rows: s.rows, door: s.door });
      x += s.w * u + u * 1.2;
    }
    return xs;
  }

  // ---- gas lamps ---------------------------------------------------------------

  function lampPositions(g) {
    const out = [];
    const n = Math.max(3, Math.round(g.W / (g.U * 38)));
    for (let i = 0; i < n; i++) out.push(g.W * ((i + 0.5) / n) + (i % 2 ? g.U * 3 : -g.U * 2));
    return out;
  }

  function gasLamp(ctx, x, yBase, s) {
    ctx.fillStyle = '#16161b';
    ctx.fillRect(x - s * 0.55, yBase - s * 1.2, s * 1.1, s * 1.2);
    ctx.fillRect(x - s * 0.22, yBase - s * 9, s * 0.44, s * 8);
    ctx.fillRect(x - s * 0.7, yBase - s * 8.4, s * 1.4, s * 0.3);
    ctx.fillRect(x - s * 0.9, yBase - s * 11.2, s * 1.8, s * 0.35);
    poly(ctx, [x - s * 0.9, yBase - s * 11.2, x, yBase - s * 12.6, x + s * 0.9, yBase - s * 11.2]);
    ctx.fillStyle = SNOW;
    poly(ctx, [x - s * 0.7, yBase - s * 11.5, x, yBase - s * 12.9, x + s * 0.7, yBase - s * 11.5, x, yBase - s * 11.9]);
    ctx.fillStyle = LAMP_GOLD;
    ctx.fillRect(x - s * 0.7, yBase - s * 11, s * 1.4, s * 2.4);
    ctx.fillStyle = '#f6e2a0';
    ctx.fillRect(x - s * 0.3, yBase - s * 10.6, s * 0.6, s * 1.6);
    ctx.fillStyle = '#16161b';
    ctx.fillRect(x - s * 0.05, yBase - s * 11, Math.max(1, s * 0.1), s * 2.4);
  }

  function glowSprite(r) {
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(245,205,115,0.9)');
    grad.addColorStop(0.25, 'rgba(235,185,95,0.45)');
    grad.addColorStop(1, 'rgba(230,180,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  // ---- baking ------------------------------------------------------------------

  function paintWorld(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHill(ctx, g, rand);
    for (const b of row(g)) warehouse(ctx, g, rand, b);
    bankWall(ctx, g, rand);
    for (const x of lampPositions(g)) gasLamp(ctx, x, g.bank - g.U * 0.5, g.U * 1.7);
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const r = Math.round(g.U * 16);
    const spr = glowSprite(r);
    state.sprite = spr;
    for (const x of lampPositions(g)) ctx.drawImage(spr, x - r, g.bank - g.U * 17 - r);
    return c;
  }

  function paintReflection(g, world, glow) {
    const h = g.H - g.wy;
    const flat = layer(g.W, g.wy + 1);
    const fctx = flat.getContext('2d');
    fctx.drawImage(world, 0, 0);
    fctx.drawImage(glow, 0, 0);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(flat, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = WATER_INK;
    ctx.globalAlpha = VEIL;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalAlpha = 1;
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const y0 = g.H - u * 6;
    stoneWall(ctx, g, rand, 0, y0, g.W, u * 6);
    ctx.fillStyle = '#10151f';
    ctx.fillRect(0, y0 - 1, g.W, 2);
    ctx.fillStyle = SNOW;
    ctx.fillRect(0, y0 - u * 0.6, g.W, u * 1.2);
    for (let x = 0; x < g.W; x += u * (2 + rand() * 3)) blob(ctx, x, y0 - u * 0.7, u * (1.2 + rand() * 1.5), u * (0.5 + rand() * 0.5));
    const x = g.W * 0.84;
    gasLamp(ctx, x, y0, u * 2.6);
    ctx.drawImage(glowNear(g), x - u * 24, y0 - u * 2.6 * 10 - u * 24);
    return c;
  }

  function glowNear(g) {
    if (!state.near) state.near = glowSprite(Math.round(g.U * 24));
    return state.near;
  }

  // ---- water -------------------------------------------------------------------

  function waveAt(g, y, t, ripple) {
    const d = (y - g.wy) / (g.H - g.wy);
    const amp = g.U * (0.1 + 1.6 * d) * ripple;
    const k = y / g.U;
    return amp * (Math.sin(k * 0.8 + t * 0.7) + 0.5 * Math.sin(k * 2.1 - t * 1.1));
  }

  function drawWater(ctx, g, t, ripple) {
    const src = state.reflection;
    const water = g.H - g.wy;
    ctx.drawImage(src, 0, g.wy);
    let y = 0;
    while (y < water) {
      const h = Math.max(1, Math.round(g.U * lerp(0.5, 1.8, y / water)));
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
      s.l[i] = g.U * (1.5 + d * 6) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawStreaks(ctx, g, t, ripple) {
    const s = state.streaks;
    const thick = Math.max(1, g.U * 0.35);
    const amount = Math.min(1, ripple + 0.15);
    ctx.fillStyle = '#b9b3a2';
    for (let i = 0; i < STREAKS; i++) {
      const a = Math.sin(t * 0.45 + s.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * amount * 0.22;
      const x = ((s.x[i] + t * g.U * 0.5) % (g.W + s.l[i] * 2)) - s.l[i];
      ctx.fillRect(x, s.y[i], s.l[i], thick);
    }
    ctx.fillStyle = '#e6c259';
    const lamps = state.lamps;
    for (let i = 0; i < lamps.length; i++) {
      for (let k = 0; k < 3; k++) {
        const a = Math.sin(t * 0.6 + i * 2 + k * 1.7);
        if (a <= 0) continue;
        ctx.globalAlpha = a * amount * 0.5;
        const y = g.wy + g.U * (4 + k * 3.5 + Math.sin(t * 0.3 + i) * 0.6);
        ctx.fillRect(lamps[i] - g.U * (1.8 - k * 0.4), y, g.U * (3.6 - k * 0.8), thick);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- lamp glow and snow -------------------------------------------------------

  function drawGlow(ctx, g, t) {
    const swell = 0.9 + 0.1 * Math.sin(t * 0.7) * Math.sin(t * 0.31 + 1);
    ctx.globalAlpha = swell;
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
  }

  function makeFlakes(g, rand) {
    const f = () => new Float32Array(MAX_FLAKES);
    const F = { x: f(), y: f(), vy: f(), p: f(), size: f(), a: f() };
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, F, i, rand, true);
    return F;
  }

  function resetFlake(g, F, i, rand, scatter) {
    const near = rand();
    F.x[i] = rand() * (g.W + g.U * 20) - g.U * 10;
    F.y[i] = scatter ? rand() * g.H : -g.U * 2;
    F.size[i] = near < 0.7 ? 1 : near < 0.93 ? 2 : 3;
    F.vy[i] = g.U * (2.2 + near * 3.2);
    F.p[i] = rand() * TAU;
    F.a[i] = 0.45 + near * 0.5;
  }

  function stepFlakes(g, dt, t, count) {
    const F = state.flakes;
    for (let i = 0; i < count; i++) {
      F.y[i] += F.vy[i] * dt;
      F.x[i] += (g.U * 1.4 + Math.sin(t * 0.8 + F.p[i]) * g.U * 1.6) * dt;
      if (F.y[i] > g.H || F.x[i] > g.W + g.U * 10) resetFlake(g, F, i, state.rand, false);
    }
  }

  function drawFlakes(ctx, g, count) {
    const F = state.flakes;
    ctx.fillStyle = '#ece8da';
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = F.a[i];
      const s = F.size[i];
      ctx.fillRect(F.x[i], F.y[i], s, s);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.near = null;
    state.world = paintWorld(g, rand);
    state.glow = paintGlow(g);
    state.reflection = paintReflection(g, state.world, state.glow);
    state.front = paintFront(g, rand);
    state.lamps = lampPositions(g);
    state.streaks = makeStreaks(g, rand);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, ripple } = api.props;
    const count = Math.min(MAX_FLAKES, Math.round(FLAKES * snow));
    stepFlakes(g, Math.min(dt, 0.1), t, count);
    ctx.drawImage(state.world, 0, 0);
    drawGlow(ctx, g, t);
    drawWater(ctx, g, t, ripple);
    drawStreaks(ctx, g, t, ripple);
    ctx.drawImage(state.front, 0, 0);
    drawFlakes(ctx, g, count);
  }

  Kasuri.run({
    defaults: { snow: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
