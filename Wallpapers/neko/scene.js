/*
 * 猫 Neko — a cat asleep on the veranda while it rains in the garden.
 *
 * Breathing scales the body, the tail tip stirs and an ear flicks every so
 * often. Bring the cursor near and one eye opens and follows it; take it away
 * and the cat goes back to sleep. Everything but the cat and the rain is baked.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const COATS = {
    tora: { body: '#c99a58', dark: '#8c5f30', belly: '#e4d0a8', nose: '#b4553f' },
    kuro: { body: '#26252a', dark: '#17161a', belly: '#34333a', nose: '#5a4a4a' },
    shiro: { body: '#e4dfd2', dark: '#b3ab9b', belly: '#f0ecdf', nose: '#c0705f' },
  };
  const RAIN = '#9db2b5';
  const MAX_DROPS = 240;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintGarden(ctx, g, rand, box) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    grad.addColorStop(0, '#6f8a80');
    grad.addColorStop(1, '#3d5b4a');
    ctx.fillStyle = grad;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    for (let i = 0; i < 220; i++) {
      const x = box.x + rand() * box.w;
      const y = box.y + rand() * box.h * 0.62;
      ctx.fillStyle = rand() < 0.08 ? '#9c5a3c' : rand() < 0.5 ? '#2f4c3b' : '#42654c';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(x, y, g.U * (1 + rand() * 2.2), 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#34503c';
    ctx.fillRect(box.x, box.y + box.h * 0.72, box.w, box.h * 0.28);
    ctx.fillStyle = '#62655f';
    ctx.beginPath();
    ctx.ellipse(box.x + box.w * 0.3, box.y + box.h * 0.82, g.U * 8, g.U * 4, 0, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a211c';
    ctx.fillRect(0, 0, g.W, g.H);
    const box = { x: g.W * 0.1, y: g.H * 0.08, w: g.W * 0.8, h: g.H * 0.56 };
    state.box = box;
    paintGarden(ctx, g, rand, box);
    ctx.fillStyle = '#1a1411';
    ctx.fillRect(0, box.y - g.U * 2, g.W, g.U * 2);
    ctx.fillRect(box.x - g.U * 2, box.y, g.U * 2.4, box.h);
    ctx.fillRect(box.x + box.w - g.U * 0.4, box.y, g.U * 2.4, box.h);
    ctx.fillRect(box.x + box.w * 0.62, box.y, g.U * 1.2, box.h);
    paintShoji(ctx, g, box);
    paintFloor(ctx, g, rand, box);
    return c;
  }

  function paintShoji(ctx, g, box) {
    const x0 = box.x - g.U * 1.6;
    const w = box.w * 0.24;
    ctx.fillStyle = '#d9cfb8';
    ctx.fillRect(x0, box.y, w, box.h);
    ctx.fillStyle = '#3a2c22';
    for (let i = 0; i <= 3; i++) ctx.fillRect(x0 + (w * i) / 3 - 0.5, box.y, Math.max(1, g.U * 0.5), box.h);
    for (let j = 0; j <= 5; j++) ctx.fillRect(x0, box.y + (box.h * j) / 5 - 0.5, w, Math.max(1, g.U * 0.5));
  }

  function paintFloor(ctx, g, rand, box) {
    const top = box.y + box.h;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#7f5e3e');
    grad.addColorStop(1, '#3f2c1d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#2c1f15';
    for (let i = 0; i < 7; i++) {
      const y = top + Math.pow(i / 7, 1.4) * (g.H - top);
      ctx.fillRect(0, y, g.W, 1);
    }
    ctx.fillStyle = '#1a120d';
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < g.W * 0.8; i++) {
      ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), g.U * (2 + rand() * 7), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawTail(ctx, s, t, coat) {
    const stir = Math.sin(t * 0.8) * Math.max(0, Math.sin(t * 0.17)) * 3.5;
    ctx.strokeStyle = coat.dark;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.quadraticCurveTo(19, 11, 8, 12.4);
    ctx.quadraticCurveTo(-4, 13, -10, 11 + stir * 0.4);
    ctx.stroke();
    ctx.strokeStyle = coat.body;
    ctx.lineWidth = 1.7;
    ctx.stroke();
  }

  function drawBody(ctx, coat, breath) {
    ctx.fillStyle = coat.body;
    ctx.beginPath();
    ctx.ellipse(3, 2, 15.5, 10.2 + breath, 0.05, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = coat.belly;
    ctx.beginPath();
    ctx.ellipse(0, 8, 9.5, 3.2, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = coat.dark;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = -3 + i * 3.4;
      ctx.moveTo(x, -7.6 - breath * 0.6 + Math.abs(i - 2) * 0.7);
      ctx.quadraticCurveTo(x + 1.2, -3.6, x + 0.2, -0.4);
    }
    ctx.stroke();
  }

  function drawEar(ctx, x, flick, coat) {
    ctx.fillStyle = coat.body;
    ctx.beginPath();
    ctx.moveTo(x - 2.6, -4.2);
    ctx.lineTo(x + flick * 0.5, -9.4 + Math.abs(flick) * 0.6);
    ctx.lineTo(x + 2.6, -4);
    ctx.fill();
    ctx.fillStyle = coat.nose;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x - 1.2, -4.8);
    ctx.lineTo(x + flick * 0.5, -7.8 + Math.abs(flick) * 0.6);
    ctx.lineTo(x + 1.2, -4.8);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawEye(ctx, x, open, look) {
    if (open < 0.12) {
      ctx.strokeStyle = '#1b1512';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - 1.2, 0);
      ctx.quadraticCurveTo(x, 0.8, x + 1.2, 0);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = '#d7c464';
    ctx.beginPath();
    ctx.ellipse(x, 0, 1.25, 1.2 * open, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#0f0d0c';
    ctx.beginPath();
    ctx.ellipse(x + look * 0.6, 0, 0.42, 1.1 * open, 0, 0, 6.3);
    ctx.fill();
  }

  function drawHead(ctx, s, t, coat) {
    ctx.save();
    ctx.translate(-13.5, 2.6 + s.breath * 0.25);
    const flick = Math.max(0, Math.sin(t * 0.55) - 0.96) * 26 * Math.sin(t * 16);
    drawEar(ctx, -4, 0, coat);
    drawEar(ctx, 4, flick, coat);
    ctx.fillStyle = coat.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5.8, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = coat.dark;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = coat.belly;
    ctx.beginPath();
    ctx.ellipse(0, 2.8, 3.6, 2.2, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = coat.nose;
    ctx.fillRect(-0.5, 1.5, 1, 0.7);
    drawEye(ctx, -2.8, s.wake * 0.5, s.look);
    drawEye(ctx, 2.8, s.wake, s.look);
    ctx.restore();
  }

  function followPointer(g, s, pointer, dt) {
    const reach = g.U * 34;
    const dx = pointer.x - s.x;
    const dy = pointer.y - s.y;
    const near = pointer.active && dx * dx + dy * dy < reach * reach;
    s.wake += ((near ? 1 : 0) - s.wake) * Math.min(1, dt * (near ? 3 : 0.6));
    const goal = pointer.active ? K.clamp(dx / (g.U * 22), -1, 1) : 0;
    s.look += (goal - s.look) * Math.min(1, dt * 5);
  }

  function drawCat(ctx, g, t, dt, props, pointer) {
    const s = state.cat;
    followPointer(g, s, pointer, dt);
    s.breath = Math.sin(t * 1.15) * 0.65;
    const coat = COATS[props.coat] || COATS.tora;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(s.size, s.size);
    ctx.fillStyle = '#17100b';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(1, 12.5, 23, 3.4, 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawTail(ctx, s, t, coat);
    drawBody(ctx, coat, s.breath);
    drawHead(ctx, s, t, coat);
    ctx.restore();
  }

  function drawRain(ctx, g, dt, props) {
    const { box } = state;
    const count = Math.min(MAX_DROPS, Math.round(160 * props.rain));
    ctx.fillStyle = RAIN;
    ctx.globalAlpha = 0.6;
    const left = box.x + box.w * 0.22;
    const span = box.w * 0.78;
    for (let i = 0; i < count; i++) {
      state.ry[i] += state.rv[i] * dt;
      if (state.ry[i] > box.h) state.ry[i] = 0;
      ctx.fillRect(left + state.rx[i] * span, box.y + state.ry[i], 1, Math.max(1, g.U * 1.8));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.room = paintRoom(g, rand);
    state.cat = { x: g.W * 0.58, y: g.H * 0.74, size: g.U * 1.05, wake: 0, look: 0, breath: 0 };
    state.rx = new Float32Array(MAX_DROPS);
    state.ry = new Float32Array(MAX_DROPS);
    state.rv = new Float32Array(MAX_DROPS);
    for (let i = 0; i < MAX_DROPS; i++) {
      state.rx[i] = rand();
      state.ry[i] = rand() * state.box.h;
      state.rv[i] = g.U * (40 + rand() * 26);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.room, 0, 0);
    drawRain(ctx, g, dt, api.props);
    ctx.drawImage(state.room, 0, state.box.y + state.box.h, g.W, g.H, 0, state.box.y + state.box.h, g.W, g.H);
    drawCat(ctx, g, t, dt, api.props, api.pointer);
  }

  Kasuri.run({
    defaults: { coat: 'tora', rain: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
