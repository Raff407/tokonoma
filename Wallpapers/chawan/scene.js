/*
 * 茶碗 Chawan — a bowl of matcha and an iron kettle in a quiet tea room.
 *
 * Everything is still except for what would be: steam off the bowl and the
 * kettle spout, a few curved strokes that rise and fade, and the shoji light
 * shifting very slowly on the wall. About the cheapest scene here, on purpose.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const WISPS = 9;
  const POINTS = 12;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const wall = ctx.createLinearGradient(0, 0, 0, g.H * 0.68);
    wall.addColorStop(0, '#39342c');
    wall.addColorStop(1, '#5f5646');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, g.W, g.H);
    const sx = g.W * 0.08;
    const sw = g.W * 0.32;
    ctx.fillStyle = '#d5caae';
    ctx.fillRect(sx, u * 6, sw, g.H * 0.62 - u * 6);
    ctx.fillStyle = '#2c2118';
    for (let i = 0; i <= 4; i++) ctx.fillRect(sx + (sw * i) / 4 - u * 0.2, u * 6, Math.max(1, u * 0.5), g.H * 0.62 - u * 6);
    for (let j = 0; j <= 5; j++) ctx.fillRect(sx, u * 6 + ((g.H * 0.62 - u * 6) * j) / 5, sw, Math.max(1, u * 0.5));
    ctx.fillRect(sx - u, u * 5, u * 1.6, g.H * 0.64);
    ctx.fillRect(sx + sw - u * 0.5, u * 5, u * 1.6, g.H * 0.64);
    paintMat(ctx, g, rand);
    return c;
  }

  function paintMat(ctx, g, rand) {
    const top = g.H * 0.62;
    const mat = ctx.createLinearGradient(0, top, 0, g.H);
    mat.addColorStop(0, '#8f8c5c');
    mat.addColorStop(1, '#4d4d2f');
    ctx.fillStyle = mat;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#3d3d24';
    ctx.globalAlpha = 0.34;
    for (let y = top; y < g.H; y += Math.max(1.5, g.U * 0.8)) ctx.fillRect(0, y, g.W, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#23331f';
    ctx.fillRect(0, g.H * 0.8, g.W, Math.max(2, g.U * 1.6));
    ctx.fillStyle = '#2f2a22';
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 120; i++) ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), g.U * (1 + rand() * 5), 1);
    ctx.globalAlpha = 1;
  }

  function paintKettle(ctx, g, x, y) {
    const u = g.U;
    ctx.strokeStyle = '#1a1919';
    ctx.lineWidth = Math.max(1, u * 0.9);
    ctx.beginPath();
    ctx.ellipse(x, y - u * 15, u * 10, u * 12, 0, Math.PI, 0);
    ctx.stroke();
    const iron = ctx.createRadialGradient(x - u * 5, y - u * 13, u, x, y - u * 8, u * 15);
    iron.addColorStop(0, '#4b4a48');
    iron.addColorStop(1, '#141413');
    ctx.fillStyle = iron;
    ctx.beginPath();
    ctx.ellipse(x, y - u * 8, u * 14, u * 10, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#272625';
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(x - u * 10 + i * u * 1.8 + (j % 2) * u * 0.9, y - u * 13.5 + j * u * 2, u * 0.45, 0, 6.3);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#141413';
    ctx.beginPath();
    ctx.moveTo(x + u * 12, y - u * 12);
    ctx.lineTo(x + u * 19, y - u * 17);
    ctx.lineTo(x + u * 20, y - u * 15);
    ctx.lineTo(x + u * 13, y - u * 7);
    ctx.fill();
    state.spout = { x: x + u * 19.5, y: y - u * 17 };
    ctx.fillRect(x - u * 6, y - u * 19, u * 12, u * 1.4);
    ctx.beginPath();
    ctx.arc(x, y - u * 19.5, u * 1.1, 0, 6.3);
    ctx.fill();
  }

  function paintBowl(ctx, g, rand, x, y) {
    const u = g.U;
    const w = u * 19;
    const h = u * 15;
    ctx.fillStyle = 'rgba(20,16,10,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + u * 2, y + u * 0.5, w * 1.05, u * 2.6, 0, 0, 6.3);
    ctx.fill();
    const clay = ctx.createLinearGradient(x - w, 0, x + w, 0);
    clay.addColorStop(0, '#6a2f22');
    clay.addColorStop(0.45, '#2a1c17');
    clay.addColorStop(1, '#17110e');
    ctx.fillStyle = clay;
    ctx.beginPath();
    ctx.moveTo(x - w, y - h);
    ctx.quadraticCurveTo(x - w * 1.02, y, x - w * 0.42, y);
    ctx.lineTo(x + w * 0.42, y);
    ctx.quadraticCurveTo(x + w * 1.02, y, x + w, y - h);
    ctx.fill();
    ctx.fillStyle = '#a05a33';
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 26; i++) ctx.fillRect(x - w * 0.9 + rand() * w * 1.1, y - h + rand() * h * 0.85, Math.max(1, u * 0.5), u * (1 + rand() * 3));
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1b1411';
    ctx.beginPath();
    ctx.ellipse(x, y - h, w, u * 4.2, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#7f9a44';
    ctx.beginPath();
    ctx.ellipse(x, y - h + u * 0.5, w * 0.9, u * 3.3, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#afc26c';
    for (let i = 0; i < 70; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      ctx.fillRect(x + Math.cos(a) * d * w * 0.8, y - h + u * 0.5 + Math.sin(a) * d * u * 2.8, 1, 1);
    }
    state.mouth = { x, y: y - h, w };
  }

  function paintScene(g, rand) {
    const c = paintRoom(g, rand);
    const ctx = c.getContext('2d');
    paintKettle(ctx, g, g.W * 0.78, g.H * 0.82);
    paintBowl(ctx, g, rand, g.W * 0.5, g.H * 0.9);
    return c;
  }

  function makeWisps(g, rand) {
    const list = [];
    for (let i = 0; i < WISPS; i++) {
      const fromSpout = i >= 6;
      list.push({
        fromSpout,
        offset: fromSpout ? 0 : (rand() - 0.5) * 1.3,
        phase: rand() * 6.28,
        rate: 0.09 + rand() * 0.07,
        start: rand(),
        rise: g.U * (fromSpout ? 22 : 40 + rand() * 18),
        wobble: g.U * (2 + rand() * 3),
      });
    }
    return list;
  }

  function drawWisp(ctx, g, w, t, amount) {
    const mouth = state.mouth;
    const x0 = w.fromSpout ? state.spout.x : mouth.x + w.offset * mouth.w * 0.6;
    const y0 = w.fromSpout ? state.spout.y : mouth.y - g.U;
    const life = (t * w.rate + w.start) % 1;
    const fade = Math.sin(life * Math.PI);
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = fade * amount * (pass ? 0.3 : 0.14);
      ctx.lineWidth = Math.max(1, g.U * (pass ? 0.9 : 2.6));
      ctx.beginPath();
      for (let k = 0; k <= POINTS; k++) {
        const f = k / POINTS;
        const rise = (life * 0.55 + f * 0.45) * w.rise;
        const x = x0 + Math.sin(f * 4 + t * 0.6 + w.phase) * f * w.wobble + (w.fromSpout ? f * g.U * 7 : 0);
        if (k === 0) ctx.moveTo(x, y0 - rise);
        else ctx.lineTo(x, y0 - rise);
      }
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.scene = paintScene(g, rand);
    state.wisps = makeWisps(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.scene, 0, 0);
    ctx.fillStyle = '#e8d8ae';
    ctx.globalAlpha = 0.09 + 0.05 * Math.sin(t * 0.09);
    ctx.fillRect(g.W * 0.42 + Math.sin(t * 0.05) * g.U * 7, g.H * 0.1, g.W * 0.2, g.H * 0.5);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#efe9d8';
    ctx.lineCap = 'round';
    for (const w of state.wisps) drawWisp(ctx, g, w, t, api.props.steam);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { steam: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
