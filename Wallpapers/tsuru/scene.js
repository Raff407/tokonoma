/*
 * 鶴 Tsuru — red-crowned cranes crossing a winter dusk.
 *
 * The skein is a V of a few birds, each flapping on its own beat; the wing is
 * one polygon whose tip rises and falls, with a black trailing edge drawn over
 * it. A low vermilion sun, a snowy marsh and two more cranes standing in the
 * reeds complete the print. A little snow keeps the air moving.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp } = K;

  const WHITE = '#ece9e0';
  const BLACK = '#17171b';
  const CROWN = '#c8452f';
  const MAX_FLAKES = 260;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintStanding(ctx, g, x, y, s, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);
    ctx.lineCap = 'round';
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.moveTo(-0.3, 0);
    ctx.lineTo(-0.2, -4);
    ctx.moveTo(0.4, 0);
    ctx.lineTo(0.3, -4);
    ctx.stroke();
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.ellipse(0, -5, 2.6, 1.5, -0.2, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.ellipse(-2.2, -4.3, 1.5, 0.7, 0.3, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(1.6, -5.6);
    ctx.quadraticCurveTo(2.6, -7.5, 2.1, -9.2);
    ctx.stroke();
    ctx.fillStyle = CROWN;
    ctx.fillRect(1.85, -9.9, 0.7, 0.7);
    ctx.restore();
  }

  function paintScene(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.78);
    sky.addColorStop(0, '#26304a');
    sky.addColorStop(0.55, '#65697e');
    sky.addColorStop(1, '#c2b29c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#bf4f38';
    ctx.beginPath();
    ctx.arc(g.W * 0.7, g.H * 0.56, g.U * 15, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#8d8a92';
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(g.W * (0.46 + rand() * 0.3), g.H * (0.48 + i * 0.035), g.W * (0.14 + rand() * 0.28), Math.max(1, g.U * 0.6));
    }
    ctx.globalAlpha = 1;
    paintGround(ctx, g, rand);
    paintStanding(ctx, g, g.W * 0.18, g.H * 0.88, g.U * 2.4, false);
    paintStanding(ctx, g, g.W * 0.27, g.H * 0.92, g.U * 2, true);
    return c;
  }

  function paintGround(ctx, g, rand) {
    ctx.fillStyle = '#b6b7ba';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.8 - fbm(x * 0.012, 3, 3, 6) * 0.05));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = '#dcdcd6';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.9 - fbm(x * 0.02, 8, 3, 2) * 0.1));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.strokeStyle = '#3a3a3b';
    ctx.lineWidth = 1;
    for (let i = 0; i < g.W * 0.3; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.9 + rand() * 0.1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 2.4, y - g.U * (2 + rand() * 5));
      ctx.stroke();
    }
  }

  function makeSkein(g, rand) {
    const birds = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const rank = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      birds.push({
        dx: -rank * g.U * 13,
        dy: side * rank * g.U * 4.6,
        phase: rand() * 6.28,
        beat: 1.5 + rand() * 0.35,
        size: g.U * (0.92 + rand() * 0.18),
      });
    }
    return birds;
  }

  function drawWing(ctx, flap, far) {
    const up = flap * 6.5 * far;
    const span = 7 * (1 - Math.abs(flap) * 0.18);
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(1.4, -0.3);
    ctx.lineTo(-1.2 + span * 0.1, -up * 0.55 - 0.3);
    ctx.lineTo(-1.5, -up);
    ctx.lineTo(-3.6, -up * 0.5);
    ctx.lineTo(-2, 0.3);
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-1.5, -up);
    ctx.lineTo(-3.6, -up * 0.5);
    ctx.lineTo(-2, 0.3);
    ctx.stroke();
  }

  function drawCrane(ctx, x, y, s, flap) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    drawWing(ctx, flap, 0.85);
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.42;
    ctx.beginPath();
    ctx.moveTo(-2.6, 0.1);
    ctx.lineTo(-7.6, 0.45);
    ctx.stroke();
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.ellipse(-0.5, 0, 3, 0.95, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 0.62;
    ctx.beginPath();
    ctx.moveTo(2.2, -0.2);
    ctx.lineTo(5.6, -0.6);
    ctx.stroke();
    ctx.fillStyle = CROWN;
    ctx.fillRect(5.3, -1.1, 0.8, 0.7);
    drawWing(ctx, flap, 1);
    ctx.restore();
  }

  function drawSkein(ctx, g, t, props) {
    const span = g.W + g.U * 60;
    const lead = ((t * g.U * 3.4 * props.pace + state.start) % span) - g.U * 10;
    const y = g.H * 0.3 + Math.sin(t * 0.09) * g.U * 7;
    for (const b of state.skein) {
      const wobble = Math.sin(t * 0.4 + b.phase) * g.U * 0.9;
      const flap = Math.sin(t * b.beat * 1.6 + b.phase);
      drawCrane(ctx, lead + b.dx, y + b.dy + wobble - flap * g.U * 0.5, b.size, flap);
    }
  }

  function drawSnow(ctx, g, t, dt) {
    ctx.fillStyle = '#efece4';
    for (let i = 0; i < MAX_FLAKES; i++) {
      state.fy[i] += state.fv[i] * dt;
      state.fx[i] += (g.U * 1.6 + Math.sin(t * 0.7 + i) * g.U * 1.2) * dt;
      if (state.fy[i] > g.H) state.fy[i] = -1;
      if (state.fx[i] > g.W) state.fx[i] = 0;
      ctx.globalAlpha = 0.3 + (i % 3) * 0.2;
      ctx.fillRect(state.fx[i], state.fy[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.scene = paintScene(g, rand);
    state.skein = makeSkein(g, rand);
    state.start = g.W * (0.3 + rand() * 0.5);
    state.fx = new Float32Array(MAX_FLAKES);
    state.fy = new Float32Array(MAX_FLAKES);
    state.fv = new Float32Array(MAX_FLAKES);
    for (let i = 0; i < MAX_FLAKES; i++) {
      state.fx[i] = rand() * g.W;
      state.fy[i] = rand() * g.H;
      state.fv[i] = g.U * (2 + rand() * 4);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.scene, 0, 0);
    drawSkein(ctx, g, t, api.props);
    drawSnow(ctx, g, t, dt);
  }

  Kasuri.run({
    defaults: { pace: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.35 },
    maxFps: 24,
    setup,
    draw,
  });
})();
