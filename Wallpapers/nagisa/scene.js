/*
 * 渚 Nagisa — a shoreline seen from above, the tide breathing in and out.
 *
 * Three edges of about a hundred points each, wet sand, foam and open water,
 * follow one slow swell at different lags. The sand and its shells are baked,
 * and a small crab crosses it every so often. No per-cell work at all.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const FOAM = '#e8e6da';
  const POINTS = 110;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSand(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x * 0.06, y * 0.14, 3, 4);
        const i = (y * g.W + x) * 4;
        img.data[i] = 186 + n * 40;
        img.data[i + 1] = 160 + n * 38;
        img.data[i + 2] = 118 + n * 34;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < g.W * 0.2; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#efe7d4' : '#83705a';
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.55, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.5));
    }
    return c;
  }

  function paintSea(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.H * 0.3, 0, g.H);
    grad.addColorStop(0, '#6fa39e');
    grad.addColorStop(0.35, '#3c7a84');
    grad.addColorStop(1, '#173e5c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintSwell(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.03, y * 0.16, 3, 11);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 214;
        img.data[i + 1] = 232;
        img.data[i + 2] = 228;
        img.data[i + 3] = smoothstep(0.55, 0.72, v) * 70;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Fixed scallops for each edge, so nothing calls noise while drawing.
  function makeEdges(g) {
    state.edge = [0, 1, 2].map((k) => {
      const e = new Float32Array(POINTS + 1);
      for (let i = 0; i <= POINTS; i++) {
        const x = i / POINTS;
        const wrap = lerp(fbm(x * 6, k * 3.3, 3, 8), fbm((x - 1) * 6, k * 3.3, 3, 8), x);
        e[i] = (wrap - 0.5) * g.H * 0.18;
      }
      return e;
    });
  }

  function traceBelow(ctx, g, edge, y, slip) {
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let i = 0; i <= POINTS; i++) {
      const f = i / POINTS;
      ctx.lineTo(f * g.W, y + edge[i] + Math.sin(f * 7 + slip) * g.U * 1.6);
    }
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
  }

  function waterLevel(g, t, lag) {
    const breath = Math.sin(t * 0.32 - lag) * 0.6 + Math.sin(t * 0.13 - lag * 0.5) * 0.4;
    return g.H * (0.52 - breath * 0.11);
  }

  function drawCrab(ctx, g, t) {
    const p = (t * 0.018) % 1;
    if (p > 0.45) return;
    const x = g.W * (-0.05 + (p / 0.45) * 1.1);
    const y = g.H * 0.15 + Math.sin(p * 40) * g.U * 0.6;
    const u = Math.max(1, g.U * 0.6);
    const step = Math.sin(t * 9) > 0 ? u * 0.5 : 0;
    ctx.fillStyle = '#a7452f';
    ctx.fillRect(x - u * 1.5, y - u * 0.8, u * 3, u * 1.6);
    ctx.fillRect(x - u * 2.6, y - u * 1.2 + step, u, u * 0.7);
    ctx.fillRect(x + u * 1.6, y - u * 1.2 - step, u, u * 0.7);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.sand = paintSand(g, K.rng(api.seed));
    state.sea = paintSea(g);
    state.swell = paintSwell(Math.ceil(g.W * 1.3), g.H);
    state.seaCut = layer(g.W, g.H);
    makeEdges(g);
  }

  function drawWater(g, t, rate) {
    const c = state.seaCut.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, g.W, g.H);
    traceBelow(c, g, state.edge[1], waterLevel(g, t * rate, 0), t * 0.05);
    c.fillStyle = '#000';
    c.fill();
    c.globalCompositeOperation = 'source-in';
    c.drawImage(state.sea, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    const w = state.swell.width;
    const x = -((t * g.U * 1.4) % w);
    c.drawImage(state.swell, x, Math.sin(t * rate * 0.32) * g.U * 4);
    c.drawImage(state.swell, x + w, Math.sin(t * rate * 0.32) * g.U * 4);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const rate = api.props.tide;
    ctx.drawImage(state.sand, 0, 0);
    drawCrab(ctx, g, t);
    // Wet sand trails behind the water and dries slowly.
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#4c4436';
    traceBelow(ctx, g, state.edge[0], waterLevel(g, t * rate, 1.5) - g.U * 7, t * 0.04);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawWater(g, t, rate);
    ctx.fillStyle = FOAM;
    traceBelow(ctx, g, state.edge[1], waterLevel(g, t * rate, 0) - g.U * 1.5, t * 0.05);
    ctx.fill();
    ctx.drawImage(state.seaCut, 0, 0);
    // A second band of foam further out, thin and lagging.
    ctx.strokeStyle = FOAM;
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.globalAlpha = 0.65;
    const y = waterLevel(g, t * rate, -0.9) + g.U * 13;
    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) {
      const f = i / POINTS;
      ctx.lineTo(f * g.W, y + state.edge[2][i] + Math.sin(f * 9 + t * 0.1) * g.U * 1.3);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { tide: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
