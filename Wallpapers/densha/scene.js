/*
 * 夜汽車 Densha — the last train crossing a viaduct over flooded paddies.
 *
 * Land and viaduct are baked; the paddies below reflect them through strips
 * that waver. A lit train comes through, window by window, with its own broken
 * reflection underneath. Between trains there is still the water, a signal
 * lamp and a few farmhouse lights to look at.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, lerp } = K;

  const LIT = '#efc98a';
  const CAR = '#242836';
  const CAR_STRIPE = '#6d3a33';
  const HEAD = '#f3dfae';
  const WATER = 0.68;
  const DECK = 0.5;
  const STRIPS = 12;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSky(ctx, g, rand) {
    const line = g.H * WATER;
    const sky = ctx.createLinearGradient(0, 0, 0, line);
    sky.addColorStop(0, '#080c1c');
    sky.addColorStop(0.65, '#2a3560');
    sky.addColorStop(1, '#6f5c7c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, line);
    ctx.fillStyle = '#c7cbd6';
    for (let i = 0; i < g.W * 0.7; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.45;
      ctx.fillRect(rand() * g.W, rand() * line * 0.75, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8e2cd';
    ctx.beginPath();
    ctx.arc(g.W * 0.18, g.H * 0.16, g.U * 3.2, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#10152b';
    ctx.beginPath();
    ctx.arc(g.W * 0.18 + g.U * 1.3, g.H * 0.16 - g.U * 0.6, g.U * 2.8, 0, 6.3);
    ctx.fill();
  }

  function paintHills(ctx, g, rand) {
    const line = g.H * WATER;
    ctx.fillStyle = '#343f66';
    ctx.beginPath();
    ctx.moveTo(0, line);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.5 - fbm(x * 0.008, 2, 4, 3) * 0.2));
    ctx.lineTo(g.W, line);
    ctx.fill();
    ctx.fillStyle = '#28304f';
    ctx.beginPath();
    ctx.moveTo(0, line);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.62 - fbm(x * 0.016, 6, 3, 7) * 0.08));
    ctx.lineTo(g.W, line);
    ctx.fill();
    state.lights = [];
    for (let i = 0; i < 14; i++) {
      state.lights.push({ x: rand() * g.W, y: g.H * (0.59 + rand() * 0.08), seed: rand() * 100 });
    }
  }

  function paintViaduct(ctx, g) {
    const deck = g.H * DECK;
    const line = g.H * WATER;
    const u = g.U;
    ctx.fillStyle = '#05070e';
    ctx.fillRect(0, deck, g.W, Math.max(2, u * 1.4));
    ctx.fillRect(0, deck + u * 5, g.W, Math.max(1, u * 0.7));
    const span = u * 26;
    for (let x = -span / 2; x < g.W + span; x += span) {
      ctx.beginPath();
      ctx.moveTo(x - u * 1.1, deck);
      ctx.lineTo(x + u * 1.1, deck);
      ctx.lineTo(x + u * 2.4, line);
      ctx.lineTo(x - u * 2.4, line);
      ctx.fill();
    }
    ctx.strokeStyle = '#05070e';
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    const bay = u * 6.5;
    for (let x = -bay; x < g.W + bay; x += bay) {
      ctx.moveTo(x, deck + u * 1.2);
      ctx.lineTo(x + bay / 2, deck + u * 5);
      ctx.lineTo(x + bay, deck + u * 1.2);
    }
    ctx.stroke();
    ctx.fillStyle = '#0a0d17';
    ctx.fillRect(0, deck - Math.max(1, u * 0.5), g.W, Math.max(1, u * 0.5));
    for (let x = 0; x < g.W; x += u * 11) ctx.fillRect(x, deck - u * 7, Math.max(1, u * 0.4), u * 7);
    ctx.fillRect(0, deck - u * 6.6, g.W, 1);
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g, rand);
    paintViaduct(ctx, g);
    const line = g.H * WATER;
    const water = ctx.createLinearGradient(0, line, 0, g.H);
    water.addColorStop(0, '#2a3356');
    water.addColorStop(1, '#0e1326');
    ctx.fillStyle = water;
    ctx.fillRect(0, line, g.W, g.H - line);
    return c;
  }

  function paintLevees(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const line = g.H * WATER;
    ctx.fillStyle = '#0c1020';
    for (let k = 1; k < 5; k++) {
      const y = line + Math.pow(k / 5, 1.5) * (g.H - line);
      const h = Math.max(1, g.U * (0.4 + k * 0.26));
      ctx.fillRect(0, y, g.W, h);
      for (let i = 0; i < 10; i++) {
        const x = rand() * g.W;
        ctx.fillRect(x, y - g.U * 0.3 * k, 1, g.U * 0.3 * k);
      }
    }
    return c;
  }

  function drawTrain(ctx, g, x, dir) {
    const deck = g.H * DECK;
    const u = g.U;
    const h = u * 5.4;
    const len = u * 26;
    for (let car = 0; car < state.cars; car++) {
      const cx = x - dir * car * (len + u * 0.7);
      const left = cx - len / 2;
      if (left > g.W || left + len < 0) continue;
      ctx.fillStyle = CAR;
      ctx.fillRect(left, deck - h, len, h);
      ctx.fillStyle = CAR_STRIPE;
      ctx.fillRect(left, deck - u * 1.5, len, Math.max(1, u * 0.7));
      ctx.fillStyle = LIT;
      const panes = 8;
      for (let p = 0; p < panes; p++) {
        ctx.fillRect(left + u * 1 + (p / panes) * (len - u * 1.4), deck - h + u * 1, (len / panes) * 0.62, u * 2);
      }
    }
    ctx.fillStyle = HEAD;
    ctx.fillRect(x + (dir * len) / 2 - (dir > 0 ? 1 : 0), deck - u * 2, Math.max(1, u * 0.9), Math.max(1, u * 0.9));
  }

  function trainLead(g, t, pace) {
    const train = g.U * 27 * state.cars;
    const loop = g.W + train + g.U * 90;
    const raw = (t * g.U * 15 * pace + state.start) % loop;
    return raw - g.U * 8;
  }

  function drawLights(ctx, t) {
    ctx.fillStyle = LIT;
    for (const l of state.lights) {
      ctx.globalAlpha = 0.45 + 0.4 * noise2(t * 0.05, l.seed, 3);
      ctx.fillRect(l.x, l.y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawSignal(ctx, g, t) {
    const x = g.W * 0.86;
    const deck = g.H * DECK;
    ctx.fillStyle = '#0d101c';
    ctx.fillRect(x, deck - g.U * 11, Math.max(1, g.U * 0.5), g.U * 11);
    ctx.fillStyle = '#c64a33';
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 0.9);
    ctx.fillRect(x - g.U * 0.3, deck - g.U * 11.6, Math.max(1, g.U * 1.1), Math.max(1, g.U * 1.1));
    ctx.globalAlpha = 1;
  }

  function drawReflection(ctx, g, t, buffer) {
    const line = g.H * WATER;
    const dst = g.H - line;
    const stripH = dst / STRIPS;
    const sourceTop = line - dst;
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < STRIPS; i++) {
      const wob = Math.sin(t * 0.9 + i * 1.3) * g.U * (0.3 + i * 0.12);
      const srcY = sourceTop + dst - (i + 1) * (dst / STRIPS);
      ctx.drawImage(buffer, 0, srcY, g.W, dst / STRIPS, wob, line + i * stripH, g.W, stripH + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.world = paintWorld(g, rand);
    state.levees = paintLevees(g, rand);
    state.buffer = layer(g.W, g.H);
    state.cars = 4;
    state.start = g.W * 0.9;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const b = state.buffer.getContext('2d');
    b.drawImage(state.world, 0, 0);
    drawLights(b, t);
    drawSignal(b, g, t);
    drawTrain(b, g, trainLead(g, t, api.props.pace), 1);
    ctx.drawImage(state.buffer, 0, 0);
    drawReflection(ctx, g, t, state.buffer);
    ctx.drawImage(state.levees, 0, 0);
  }

  Kasuri.run({
    defaults: { pace: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, tint: 0.45 },
    maxFps: 24,
    setup,
    draw,
  });
})();
