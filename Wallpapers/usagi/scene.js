/*
 * 月見 Usagi — a rabbit watching the harvest moon from the silver grass.
 *
 * A huge low moon, a stand of dumplings set out for it, and the rabbit sitting
 * up with its nose going and one ear that won't stay still. The grass is a
 * couple of hundred curved stems bowing together in slow gusts.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const FUR = '#e7e1d2';
  const FUR_SHADE = '#b6ae9e';
  const STEMS = ['#7d8466', '#99a07d', '#5f6950'];
  const PLUME = '#d8d3bd';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H);
    sky.addColorStop(0, '#111a36');
    sky.addColorStop(0.75, '#3a4068');
    sky.addColorStop(1, '#6a5f78');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#d3d6dd';
    for (let i = 0; i < g.W * 0.55; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.5;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.6, 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * 0.62;
    const my = g.H * 0.46;
    const r = g.U * 31;
    const halo = ctx.createRadialGradient(mx, my, r * 0.8, mx, my, r * 2);
    halo.addColorStop(0, 'rgba(240,206,130,0.4)');
    halo.addColorStop(1, 'rgba(240,206,130,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    const face = ctx.createRadialGradient(mx - r * 0.3, my - r * 0.3, 0, mx, my, r);
    face.addColorStop(0, '#f6e5ad');
    face.addColorStop(1, '#e0b865');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#cda45e';
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 14; i++) {
      const a = rand() * 6.28;
      const d = Math.sqrt(rand()) * r * 0.82;
      ctx.beginPath();
      ctx.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, r * (0.05 + rand() * 0.13), 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#262c47';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.82 - fbm(x * 0.01, 2, 3, 6) * 0.1));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    return c;
  }

  function paintGround(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.H * 0.82, 0, g.H);
    grad.addColorStop(0, '#39402f');
    grad.addColorStop(1, '#1b2019');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.H * 0.84, g.W, g.H * 0.16);
    paintDango(ctx, g, g.W * 0.48, g.H * 0.92);
    return c;
  }

  function paintDango(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#6d4a2c';
    ctx.fillRect(x - u * 5, y - u * 3, u * 10, u * 3);
    ctx.fillStyle = '#4c3320';
    ctx.fillRect(x - u * 3, y - u * 1, u * 6, u * 4);
    const rows = [[-3.4, 0, 3.4], [-1.7, 1.7], [0]];
    rows.forEach((row, level) => {
      for (const dx of row) {
        ctx.fillStyle = '#f0ead8';
        ctx.beginPath();
        ctx.arc(x + dx * u, y - u * (4.4 + level * 2.7), u * 1.75, 0, 6.3);
        ctx.fill();
      }
    });
  }

  function drawRabbit(ctx, g, t) {
    const u = g.U * 1.05;
    const x = g.W * 0.32;
    const y = g.H * 0.9;
    const twitch = Math.max(0, Math.sin(t * 0.5) - 0.92) * 16;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = FUR_SHADE;
    ctx.beginPath();
    ctx.ellipse(-u * 8.5, -u * 2.6, u * 2.8, u * 2.8, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(-u * 1, -u * 7.4 + Math.sin(t * 1.6) * u * 0.12, u * 8.2, u * 9.2, 0.2, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = FUR_SHADE;
    ctx.beginPath();
    ctx.ellipse(u * 4, -u * 0.8, u * 4.2, u * 1.4, 0, 0, 6.3);
    ctx.fill();
    ctx.translate(u * 3.4, -u * 17);
    drawEar(ctx, u, -1.6, 0.05);
    drawEar(ctx, u, 1.5, 0.3 + twitch * 0.08);
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(u * 0.3, 0, u * 5.2, u * 4.5, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#1d1716';
    ctx.fillRect(u * 1.8, -u * 1.2, Math.max(1, u * 1.1), Math.max(1, u * 1.1));
    ctx.fillStyle = '#c17b6e';
    const nose = Math.sin(t * 7) > 0.3 ? u * 0.25 : 0;
    ctx.fillRect(u * 4.6, u * 0.6 - nose, Math.max(1, u * 0.8), Math.max(1, u * 0.7));
    ctx.restore();
  }

  function drawEar(ctx, u, x, lean) {
    ctx.save();
    ctx.translate(x * u, -u * 3);
    ctx.rotate(lean);
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(0, -u * 5, u * 1.5, u * 6, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#d4a39a';
    ctx.beginPath();
    ctx.ellipse(0, -u * 5, u * 0.6, u * 4.4, 0, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function makeGrass(g, rand) {
    const list = [];
    const count = Math.round(g.W * 0.7);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      // Keep a clearing in front of the rabbit and the dango.
      const gap = Math.abs(x / g.W - 0.4) < 0.17 ? 0.38 : 1;
      list.push({
        x,
        y: g.H * (0.9 + rand() * 0.14),
        h: g.U * (22 + rand() * 30) * gap,
        phase: rand() * 6.28,
        colour: STEMS[Math.floor(rand() * STEMS.length)],
      });
    }
    return list.sort((a, b) => a.y - b.y);
  }

  function drawGrass(ctx, g, t, wind) {
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    const lean = wind * g.U * 2.4;
    for (const s of state.grass) {
      const gust = Math.sin(t * 0.55 - s.x * 0.012) * 0.8 + Math.sin(t * 1.4 + s.phase) * 0.2;
      const tipX = s.x + (gust * 2.4 + 1) * lean;
      const tipY = s.y - s.h;
      ctx.strokeStyle = s.colour;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x, s.y - s.h * 0.6, tipX, tipY);
      ctx.stroke();
      if (s.h > g.U * 16) {
        ctx.strokeStyle = PLUME;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + (gust + 1) * lean * 0.9, tipY + g.U * 4.2);
        ctx.stroke();
      }
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.ground = paintGround(g);
    state.grass = makeGrass(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.ground, 0, 0);
    drawRabbit(ctx, g, t);
    drawGrass(ctx, g, t, api.props.wind);
  }

  Kasuri.run({
    defaults: { wind: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
