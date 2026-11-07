/*
 * 水車 Suisha — a water wheel turning beside an old mill, under your clock.
 *
 * Mill, hills and stream are baked in daylight colours, then the whole layer
 * is multiplied by the sky's ambient tint once a minute. The wheel, the water
 * from the flume and the splash are live, tinted the same way, and the mill's
 * window lights up when it gets dark.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex } = K;

  const SPOKES = 8;
  const PADDLES = 16;
  const MAX_SPRAY = 120;
  const RETINT_SECONDS = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintLand(ctx, g, rand) {
    ctx.fillStyle = '#6b8569';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.74);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.56 - fbm(x * 0.009, 2, 4, 4) * 0.28));
    ctx.lineTo(g.W, g.H * 0.74);
    ctx.fill();
    ctx.fillStyle = '#4f6a4d';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.8);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.72 - fbm(x * 0.018, 8, 3, 9) * 0.14));
    ctx.lineTo(g.W, g.H * 0.8);
    ctx.fill();
    for (let i = 0; i < g.W * 0.2; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#3a5540' : '#567555';
      ctx.beginPath();
      ctx.arc(rand() * g.W, g.H * (0.56 + rand() * 0.18), g.U * (1 + rand() * 2.6), 0, 6.3);
      ctx.fill();
    }
  }

  function paintMill(ctx, g) {
    const w = state.wheel;
    const u = g.U;
    const x = w.x + w.r * 0.5;
    const y = g.H * 0.78;
    const wide = u * 54;
    const high = u * 24;
    ctx.fillStyle = '#8f7a60';
    ctx.fillRect(x, y - high, wide, high);
    ctx.fillStyle = '#5b4733';
    for (let i = 0; i <= 6; i++) ctx.fillRect(x + (wide * i) / 6, y - high, Math.max(1, u * 0.7), high);
    ctx.fillRect(x, y - high * 0.55, wide, Math.max(1, u * 0.6));
    ctx.fillStyle = '#6a5e4a';
    ctx.beginPath();
    ctx.moveTo(x - u * 6, y - high);
    ctx.lineTo(x + wide * 0.5, y - high - u * 19);
    ctx.lineTo(x + wide + u * 6, y - high);
    ctx.fill();
    ctx.fillStyle = '#3f372c';
    ctx.fillRect(x - u * 6, y - high - u * 0.5, wide + u * 12, Math.max(1, u));
    state.pane = { x: x + wide * 0.56, y: y - high * 0.48, w: u * 9, h: u * 7 };
    ctx.fillStyle = '#2b241c';
    ctx.fillRect(state.pane.x, state.pane.y, state.pane.w, state.pane.h);
  }

  function paintFlume(ctx, g) {
    const w = state.wheel;
    const u = g.U;
    const top = w.y - w.r - u * 5;
    ctx.fillStyle = '#4a3a2a';
    ctx.beginPath();
    ctx.moveTo(-u, top - u * 3);
    ctx.lineTo(w.x + u * 3, top);
    ctx.lineTo(w.x + u * 3, top + u * 2);
    ctx.lineTo(-u, top - u);
    ctx.fill();
    ctx.fillRect(w.x - w.r * 1.15, top - u, u * 1.4, g.H * 0.8 - top);
    ctx.fillStyle = '#7fa3b0';
    ctx.beginPath();
    ctx.moveTo(-u, top - u * 3);
    ctx.lineTo(w.x + u * 3, top);
    ctx.lineTo(w.x + u * 3, top + u * 0.7);
    ctx.lineTo(-u, top - u * 2.3);
    ctx.fill();
    state.lip = { x: w.x + u * 3, y: top + u * 2 };
  }

  function paintStream(ctx, g) {
    const top = g.H * 0.78;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#4c6f7c');
    grad.addColorStop(1, '#1f3a45');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#39492f';
    ctx.fillRect(0, top - g.U * 0.6, g.W, Math.max(1, g.U));
  }

  function paintDay(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintLand(ctx, g, rand);
    paintStream(ctx, g);
    paintMill(ctx, g);
    paintFlume(ctx, g);
    return c;
  }

  function retint(g, choice) {
    const h = S.hour(choice);
    const sky = S.at(h);
    state.sky = sky;
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const tinted = layer(g.W, g.H);
    const tctx = tinted.getContext('2d');
    tctx.drawImage(state.day, 0, 0);
    tctx.globalCompositeOperation = 'source-atop';
    tctx.globalAlpha = 0.86;
    tctx.fillStyle = toHex(mixColor(sky.amb, [38, 46, 74], sky.night * 0.45));
    tctx.globalCompositeOperation = 'multiply';
    tctx.fillRect(0, 0, g.W, g.H);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.globalAlpha = 1;
    tctx.drawImage(state.day, 0, 0);
    ctx.drawImage(tinted, 0, 0);
    state.world = c;
    state.wood = toHex(mixColor(mixColor([44, 32, 22], sky.amb, 0.15), [20, 22, 34], sky.night * 0.4));
    state.woodLight = toHex(mixColor(mixColor([110, 84, 56], sky.amb, 0.25), [30, 32, 48], sky.night * 0.5));
    state.water = toHex(mixColor([190, 214, 220], sky.amb, 0.4));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawWheel(ctx, g, angle) {
    const w = state.wheel;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(angle);
    ctx.strokeStyle = state.wood;
    ctx.lineWidth = Math.max(1, g.U * 1.5);
    ctx.beginPath();
    ctx.arc(0, 0, w.r, 0, 6.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, w.r * 0.74, 0, 6.3);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    for (let i = 0; i < SPOKES; i++) {
      const a = (i / SPOKES) * 6.283;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * w.r, Math.sin(a) * w.r);
    }
    ctx.stroke();
    ctx.strokeStyle = state.woodLight;
    ctx.lineWidth = Math.max(1, g.U * 1.3);
    ctx.beginPath();
    for (let i = 0; i < PADDLES; i++) {
      const a = (i / PADDLES) * 6.283;
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.moveTo(c * w.r * 0.74, s * w.r * 0.74);
      ctx.lineTo(c * w.r * 1.16, s * w.r * 1.16);
    }
    ctx.stroke();
    ctx.fillStyle = state.wood;
    ctx.beginPath();
    ctx.arc(0, 0, g.U * 2.2, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function drawFall(ctx, g, t) {
    const w = state.wheel;
    const lip = state.lip;
    const r = w.r * 1.14;
    const start = -1.32;
    const end = 0.55;
    ctx.strokeStyle = state.water;
    ctx.fillStyle = state.water;
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(lip.x, lip.y - g.U * 1.4);
    ctx.lineTo(w.x + Math.cos(start) * r, w.y + Math.sin(start) * r);
    ctx.arc(w.x, w.y, r, start, end);
    const dropX = w.x + Math.cos(end) * r;
    const dropY = w.y + Math.sin(end) * r;
    ctx.lineTo(dropX + g.U, g.H * 0.8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Bright beads carried round on the same path.
    for (let i = 0; i < 16; i++) {
      const f = ((t * 0.34 * state.flow + i / 16) % 1);
      const a = lerp(start, end, f);
      ctx.fillRect(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r, Math.max(1, g.U * 0.9), Math.max(1, g.U * 0.9));
    }
    state.foot = dropX + g.U;
    return dropY;
  }

  function drawSpray(ctx, g, dt) {
    const r = state.rand;
    const floor = g.H * 0.8;
    ctx.fillStyle = state.water;
    for (let i = 0; i < MAX_SPRAY; i++) {
      state.pl[i] -= dt * 1.2;
      if (state.pl[i] <= 0) {
        state.px[i] = state.foot + (r() - 0.4) * g.U * 7;
        state.py[i] = floor;
        state.pvx[i] = (r() - 0.25) * g.U * 15;
        state.pvy[i] = -g.U * (5 + r() * 16);
        state.pl[i] = 0.3 + r() * 0.7;
      }
      state.pvy[i] += g.U * 42 * dt;
      state.px[i] += state.pvx[i] * dt;
      state.py[i] += state.pvy[i] * dt;
      if (state.py[i] > floor + g.U) continue;
      ctx.globalAlpha = Math.min(1, state.pl[i] * 1.3) * 0.8;
      ctx.fillRect(state.px[i], state.py[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawStream(ctx, g, t) {
    const top = g.H * 0.81;
    ctx.fillStyle = state.water;
    for (let i = 0; i < 26; i++) {
      const y = top + (i / 26) * (g.H - top);
      const span = g.W + g.U * 20;
      const x = ((t * g.U * (9 + (i % 5) * 2.4) + i * 37.3) % span) - g.U * 10;
      ctx.globalAlpha = 0.2 + (i % 3) * 0.08;
      ctx.fillRect(x, y, g.U * (4 + (i % 4) * 2.4), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawPane(ctx) {
    const night = state.sky.night;
    if (night < 0.05 || !state.pane) return;
    ctx.fillStyle = '#e4b66f';
    ctx.globalAlpha = night * 0.9;
    ctx.fillRect(state.pane.x, state.pane.y, state.pane.w, state.pane.h);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.wheel = { x: g.W * 0.36, y: g.H * 0.58, r: g.U * 24 };
    state.day = paintDay(g, rand);
    state.angle = 0;
    state.flow = 1;
    state.foot = state.wheel.x + state.wheel.r;
    state.px = new Float32Array(MAX_SPRAY);
    state.py = new Float32Array(MAX_SPRAY);
    state.pvx = new Float32Array(MAX_SPRAY);
    state.pvy = new Float32Array(MAX_SPRAY);
    state.pl = new Float32Array(MAX_SPRAY);
    retint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) retint(g, props.time);
    state.flow = props.flow;
    state.angle += dt * 0.34 * props.flow;
    ctx.drawImage(state.world, 0, 0);
    drawPane(ctx);
    drawWheel(ctx, g, state.angle);
    drawFall(ctx, g, t);
    drawStream(ctx, g, t);
    drawSpray(ctx, g, dt);
  }

  Kasuri.run({
    defaults: { time: 'auto', flow: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.35 },
    maxFps: 24,
    setup,
    draw,
  });
})();
