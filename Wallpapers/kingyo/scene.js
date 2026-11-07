/*
 * 金魚 Kingyo — goldfish in a glass bowl on a low table, by the window.
 *
 * The bowl's body and its highlights are two baked layers with the fish between
 * them. Fish turn at the glass and swish a fan tail, the weed sways and a few
 * bubbles rise. Window light slides slowly across the wall behind.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const MAX_BUBBLES = 22;
  const WEEDS = 7;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintRoom(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wall = ctx.createLinearGradient(0, 0, g.W, g.H);
    wall.addColorStop(0, '#6e6a5d');
    wall.addColorStop(1, '#3a3a38');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, g.W, g.H);
    const top = g.H * 0.76;
    const table = ctx.createLinearGradient(0, top, 0, g.H);
    table.addColorStop(0, '#6b4728');
    table.addColorStop(1, '#2e1e12');
    ctx.fillStyle = table;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#1e140c';
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.7));
    const b = state.bowl;
    ctx.fillStyle = 'rgba(14,10,6,0.5)';
    ctx.beginPath();
    ctx.ellipse(b.x + g.U * 4, top + g.U * 6, b.r * 0.95, g.U * 4, 0, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintSun(g) {
    const c = layer(g.W * 0.7, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(232,212,160,0.3)';
    const paneW = g.U * 17;
    const paneH = g.H * 0.3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.beginPath();
        const x = g.U * 6 + i * (paneW + g.U * 2) + j * g.U * 6;
        const y = g.H * 0.06 + j * (paneH + g.U * 2);
        ctx.moveTo(x, y);
        ctx.lineTo(x + paneW, y);
        ctx.lineTo(x + paneW + g.U * 5, y + paneH);
        ctx.lineTo(x + g.U * 5, y + paneH);
        ctx.fill();
      }
    }
    return c;
  }

  function paintWater(g) {
    const b = state.bowl;
    const size = Math.ceil(b.r * 2.3);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const m = size / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(m, m, b.r, 0, 6.3);
    ctx.clip();
    const water = ctx.createLinearGradient(0, m - b.r * 0.62, 0, m + b.r);
    water.addColorStop(0, '#6da3a3');
    water.addColorStop(1, '#215159');
    ctx.fillStyle = water;
    ctx.fillRect(0, m - b.r * 0.62, size, size);
    ctx.fillStyle = '#a5907a';
    ctx.fillRect(0, m + b.r * 0.76, size, b.r);
    ctx.fillStyle = '#c9d8d0';
    ctx.fillRect(0, m - b.r * 0.62, size, Math.max(1, g.U * 0.5));
    ctx.restore();
    return c;
  }

  function paintGlass(g) {
    const b = state.bowl;
    const size = Math.ceil(b.r * 2.3);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const m = size / 2;
    ctx.strokeStyle = 'rgba(214,228,226,0.9)';
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    ctx.arc(m, m, b.r, Math.PI * 1.34, Math.PI * 1.66, true);
    ctx.stroke();
    ctx.strokeStyle = '#d7e4e2';
    ctx.lineWidth = Math.max(1, g.U * 1.2);
    ctx.beginPath();
    ctx.ellipse(m, m - b.r * 0.86, b.r * 0.5, b.r * 0.1, 0, 0, 6.3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(246,250,248,0.75)';
    ctx.lineWidth = Math.max(1, g.U * 1.6);
    ctx.beginPath();
    ctx.arc(m, m, b.r * 0.84, Math.PI * 1.06, Math.PI * 1.32);
    ctx.stroke();
    return c;
  }

  function makeFish(g, rand) {
    const list = [];
    const inks = [['#d9602c', '#f0c58a'], ['#e0e0d0', '#c9472c'], ['#c9472c', '#e8a255']];
    for (let i = 0; i < 3; i++) {
      list.push({
        x: rand() * 0.8 - 0.4,
        y: rand() * 0.6 - 0.2,
        dir: rand() < 0.5 ? 1 : -1,
        turn: 1,
        goal: 1,
        speed: 0.06 + rand() * 0.05,
        phase: rand() * 6.28,
        ink: inks[i],
        size: g.U * (3.4 + rand() * 1.4),
      });
    }
    return list;
  }

  function moveFish(f, t, dt) {
    if (Math.abs(f.x) > 0.56) f.dir = f.x > 0 ? -1 : 1;
    f.goal = f.dir;
    f.turn += (f.goal - f.turn) * Math.min(1, dt * 2.6);
    f.x += f.turn * f.speed * dt;
    f.y += Math.sin(t * 0.3 + f.phase) * 0.012 * dt * 4;
    f.y = K.clamp(f.y, -0.42, 0.56);
  }

  function drawOneFish(ctx, g, f, t) {
    const b = state.bowl;
    const x = b.x + f.x * b.r;
    const y = b.y + f.y * b.r;
    const s = f.size;
    const swish = Math.sin(t * 5.5 + f.phase);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f.turn >= 0 ? Math.max(0.2, f.turn) : Math.min(-0.2, f.turn), 1);
    ctx.fillStyle = f.ink[1];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.quadraticCurveTo(-s * 1.8, -s * 0.9 + swish * s * 0.4, -s * 2.3, -s * 0.8 + swish * s * 0.6);
    ctx.quadraticCurveTo(-s * 1.7, swish * s * 0.2, -s * 2.3, s * 0.8 + swish * s * 0.6);
    ctx.quadraticCurveTo(-s * 1.8, s * 0.9 + swish * s * 0.4, -s * 0.7, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = f.ink[0];
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.62, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = f.ink[1];
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.55);
    ctx.lineTo(s * 0.3, -s * 1);
    ctx.lineTo(s * 0.5, -s * 0.45);
    ctx.fill();
    ctx.fillStyle = '#121212';
    ctx.fillRect(s * 0.55, -s * 0.2, Math.max(1, s * 0.2), Math.max(1, s * 0.2));
    ctx.restore();
  }

  function drawWeed(ctx, g, t) {
    const b = state.bowl;
    ctx.strokeStyle = '#3e7a4c';
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    for (let i = 0; i < WEEDS; i++) {
      const fx = (i - (WEEDS - 1) / 2) * 0.1 - 0.2;
      const base = b.y + b.r * 0.82;
      const h = b.r * (0.5 + (i % 3) * 0.16);
      ctx.beginPath();
      ctx.moveTo(b.x + fx * b.r, base);
      for (let k = 1; k <= 5; k++) {
        const f = k / 5;
        ctx.lineTo(b.x + fx * b.r + Math.sin(t * 0.9 + i + f * 3) * f * g.U * 1.8, base - f * h);
      }
      ctx.stroke();
    }
  }

  function drawBubbles(ctx, g, dt) {
    const b = state.bowl;
    ctx.fillStyle = '#e4efeb';
    for (let i = 0; i < MAX_BUBBLES; i++) {
      state.by[i] -= state.bv[i] * dt;
      if (state.by[i] < b.y - b.r * 0.62) state.by[i] = b.y + b.r * 0.75;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(state.bx[i], state.by[i], Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.bowl = { x: g.W * 0.56, y: g.H * 0.54, r: g.U * 32 };
    state.room = paintRoom(g);
    state.sun = paintSun(g);
    state.water = paintWater(g);
    state.glass = paintGlass(g);
    state.fish = makeFish(g, rand);
    state.bx = new Float32Array(MAX_BUBBLES);
    state.by = new Float32Array(MAX_BUBBLES);
    state.bv = new Float32Array(MAX_BUBBLES);
    for (let i = 0; i < MAX_BUBBLES; i++) {
      state.bx[i] = state.bowl.x + (rand() - 0.5) * state.bowl.r * 1.2;
      state.by[i] = state.bowl.y + rand() * state.bowl.r * 0.8;
      state.bv[i] = g.U * (2 + rand() * 3);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const b = state.bowl;
    const pace = api.props.pace;
    ctx.drawImage(state.room, 0, 0);
    ctx.drawImage(state.sun, Math.sin(t * 0.03) * g.U * 10, 0);
    const size = state.water.width;
    ctx.drawImage(state.water, b.x - size / 2, b.y - size / 2);
    drawWeed(ctx, g, t);
    drawBubbles(ctx, g, dt);
    for (const f of state.fish) {
      moveFish(f, t, dt * pace);
      drawOneFish(ctx, g, f, t);
    }
    ctx.drawImage(state.glass, b.x - size / 2, b.y - size / 2);
  }

  Kasuri.run({
    defaults: { pace: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
