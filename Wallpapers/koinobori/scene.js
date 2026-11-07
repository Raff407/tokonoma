/*
 * 鯉のぼり Koinobori — carp streamers flying from a tall pole in May.
 *
 * A fish is a ribbon of about twenty quads. A wave travels from mouth to tail,
 * growing as it goes, so the cloth fills and ripples the way wind-socks do.
 * Stripes and scales come from colouring each quad in turn, with no texture.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const FISH = [
    { body: '#23222a', band: '#4e4c58', belly: '#c8b45a' },
    { body: '#b53f2b', band: '#d87654', belly: '#ecd9b4' },
    { body: '#27477a', band: '#5a7fa8', belly: '#e0dcc4' },
    { body: '#3e6a50', band: '#74a07e', belly: '#e0d9ae' },
  ];
  const SEGMENTS = 22;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.8);
    sky.addColorStop(0, '#2f6a9e');
    sky.addColorStop(1, '#c6dade');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#7f9aa0';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.9);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.8 - fbm(x * 0.008, 4, 3, 2) * 0.15));
    ctx.lineTo(g.W, g.H * 0.9);
    ctx.fill();
    ctx.fillStyle = '#5a8250';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.9 - fbm(x * 0.012, 9, 3, 5) * 0.08));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let i = 0; i < g.W * 0.8; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#6f9458' : '#476e44';
      ctx.fillRect(rand() * g.W, g.H * (0.87 + rand() * 0.13), Math.max(1, g.U * 0.6), Math.max(1, g.U * 0.5));
    }
    paintHouse(ctx, g, g.W * 0.8, g.H * 0.88);
    return c;
  }

  function paintHouse(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#d6cfb9';
    ctx.fillRect(x - u * 13, y - u * 8, u * 26, u * 8);
    ctx.fillStyle = '#43382c';
    for (let i = 0; i < 5; i++) ctx.fillRect(x - u * 13 + i * u * 6.2, y - u * 8, Math.max(1, u * 0.6), u * 8);
    ctx.fillStyle = '#333640';
    ctx.beginPath();
    ctx.moveTo(x - u * 16, y - u * 8);
    ctx.lineTo(x - u * 9, y - u * 15);
    ctx.lineTo(x + u * 9, y - u * 15);
    ctx.lineTo(x + u * 16, y - u * 8);
    ctx.fill();
  }

  function paintPole(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const x = state.poleX;
    ctx.fillStyle = '#6a5138';
    ctx.fillRect(x - g.U * 0.7, g.H * 0.05, g.U * 1.4, g.H * 0.95);
    ctx.fillStyle = '#c9a54e';
    ctx.beginPath();
    ctx.arc(x, g.H * 0.045, g.U * 1.5, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.018, y * 0.05, 4, 21);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 245;
        img.data[i + 3] = smoothstep(0.5, 0.66, v) * band * 225;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function widthAt(f, size) {
    return size * (f < 0.12 ? lerp(0.86, 1, f / 0.12) : 1 - Math.pow((f - 0.12) / 0.88, 1.6) * 0.72);
  }

  // Fills the wave offsets for one fish; reused arrays, so nothing is allocated.
  function shapeFish(fish, t, wind) {
    const { xs, ys } = state;
    const speed = 3.2 * lerp(0.7, 1.2, wind / 2);
    const droop = lerp(0.35, 0.05, Math.min(1, wind));
    let x = fish.x;
    let y = fish.y;
    const step = fish.length / SEGMENTS;
    for (let i = 0; i <= SEGMENTS; i++) {
      const f = i / SEGMENTS;
      const a = Math.sin(t * speed - f * 7.5 + fish.phase) * (0.1 + f * 0.62) * Math.min(1, wind + 0.2) + droop * f;
      xs[i] = x;
      ys[i] = y;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
    }
  }

  function drawFish(ctx, g, fish, t, wind) {
    shapeFish(fish, t, wind);
    const { xs, ys } = state;
    const ink = fish.ink;
    const size = fish.size;
    for (let i = 0; i < SEGMENTS; i++) {
      const f0 = i / SEGMENTS;
      const f1 = (i + 1) / SEGMENTS;
      const fill = Math.sin(t * 3 - f0 * 9 + fish.phase) * 0.12 + 1;
      const w0 = widthAt(f0, size) * fill;
      const w1 = widthAt(f1, size) * fill;
      ctx.fillStyle = i % 3 === 1 ? ink.band : ink.body;
      ctx.beginPath();
      ctx.moveTo(xs[i], ys[i] - w0);
      ctx.lineTo(xs[i + 1], ys[i + 1] - w1);
      ctx.lineTo(xs[i + 1], ys[i + 1] + w1);
      ctx.lineTo(xs[i], ys[i] + w0);
      ctx.fill();
      ctx.fillStyle = ink.belly;
      ctx.fillRect(xs[i], ys[i] + w0 * 0.42, Math.max(1, xs[i + 1] - xs[i]), Math.max(1, w0 * 0.46));
    }
    drawHead(ctx, xs[0], ys[0], size, ink);
  }

  function drawHead(ctx, x, y, size, ink) {
    ctx.fillStyle = '#efe7d0';
    ctx.fillRect(x - size * 0.16, y - size * 0.9, size * 0.32, size * 1.8);
    ctx.fillStyle = '#efe7d0';
    ctx.beginPath();
    ctx.arc(x + size * 0.82, y - size * 0.22, size * 0.33, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#141318';
    ctx.beginPath();
    ctx.arc(x + size * 0.82, y - size * 0.22, size * 0.16, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = ink.belly;
    ctx.fillRect(x + size * 1.3, y - size * 0.12, size * 0.28, size * 0.3);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.poleX = g.W * 0.2;
    state.world = paintWorld(g, rand);
    state.pole = paintPole(g);
    state.clouds = paintClouds(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.5));
    state.xs = new Float32Array(SEGMENTS + 1);
    state.ys = new Float32Array(SEGMENTS + 1);
    state.fish = FISH.map((ink, i) => ({
      ink,
      x: state.poleX + g.U,
      y: g.H * (0.14 + i * 0.145),
      size: g.U * (7.4 - i * 0.9),
      length: g.U * (66 - i * 9),
      phase: i * 1.7 + rand(),
    }));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const wind = api.props.wind;
    ctx.drawImage(state.world, 0, 0);
    const w = state.clouds.width;
    const x = -((t * g.U * 2 * Math.max(wind, 0.2)) % w);
    ctx.drawImage(state.clouds, x, g.H * 0.02);
    ctx.drawImage(state.clouds, x + w, g.H * 0.02);
    ctx.drawImage(state.pole, 0, 0);
    for (let i = state.fish.length - 1; i >= 0; i--) drawFish(ctx, g, state.fish[i], t, wind);
  }

  Kasuri.run({
    defaults: { wind: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 0.95, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
