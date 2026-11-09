/*
 * ネモフィラ Nemophila — a rolling hill of blue flowers, Fuji faint beyond the sea haze.
 *
 * Sky, Fuji, hill and pines are baked once. A second, paler copy of the flowers is
 * baked with a wavy alpha and slides across the hill as wind. Clouds are one tiling
 * strip; cranes are a short pool of drifting wings.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const SKY = ['#8fa9c4', '#a9bdd0', '#c4d0d8', '#dcdccf', '#e8e0cc'];
  const BLUES = ['#7f9bd0', '#93abdc', '#6f8cc4', '#a8bfe6'];
  const PALE = ['#c4d4f0', '#d3def3', '#b4c7ea'];
  const CRANES = 4;
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, U: H / 100, hz: H * 0.4 };
  }

  // crest of the hill: a broad dome, higher on the right
  function crest(g, x) {
    const f = x / g.W;
    return g.H * (0.5 - 0.1 * Math.exp(-(((f - 0.62) / 0.34) ** 2))) + fbm(f * 3, 2.2, 2, 7) * g.H * 0.03;
  }

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, Math.ceil(g.hz) + 2);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < img.height; y++) {
      const f = Math.min(1, y / g.hz) * (inks.length - 1);
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
  }

  function paintFuji(ctx, g) {
    const cx = g.W * 0.27;
    const hw = g.U * 34;
    const top = g.hz - g.U * 22;
    const prof = (x) => {
      const d = Math.abs(x - cx) / hw;
      return top + (g.hz - top) * Math.pow(Math.min(1, d), 0.95);
    };
    ctx.fillStyle = '#6d84ab';
    ctx.beginPath();
    ctx.moveTo(cx - hw * 1.3, g.hz + 2);
    for (let x = cx - hw * 1.3; x <= cx + hw * 1.3; x += 1) ctx.lineTo(x, Math.min(g.hz, prof(x)));
    ctx.lineTo(cx + hw * 1.3, g.hz + 2);
    ctx.fill();
    ctx.fillStyle = '#f6f6f3';
    ctx.beginPath();
    const capY = top + g.U * 9;
    ctx.moveTo(cx, top);
    for (let x = cx - hw; x <= cx + hw; x += 1) {
      const y = prof(x);
      if (y < capY + Math.sin(x * 0.9) * g.U * 0.8) ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8fa4bc';
    ctx.fillRect(0, g.hz - g.U * 1.5, g.W, g.U * 1.6);
  }

  function paintSea(ctx, g) {
    ctx.fillStyle = '#9fb7c9';
    ctx.fillRect(0, g.hz, g.W, g.H - g.hz);
    ctx.fillStyle = '#c9d6dc';
    ctx.fillRect(0, g.hz, g.W, Math.max(1, g.U * 0.6));
  }

  // dabs of bloom from the horizon down, bigger as they come near
  function dabs(ctx, g, rand, palette, count, flat) {
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const top = crest(g, x);
      const y = top + Math.pow(rand(), 1.15) * (g.H - top);
      const near = (y - top) / (g.H - top);
      const r = g.U * (0.35 + near * 1.5) * (0.7 + rand() * 0.6);
      ctx.fillStyle = palette[(rand() * palette.length) | 0];
      blob(ctx, x, y, r, r * flat);
    }
  }

  function paintHill(ctx, g, rand) {
    ctx.fillStyle = '#6683bd';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, crest(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    dabs(ctx, g, rand, BLUES, Math.round(g.W * g.H * 0.09), 0.6);
    // soft green showing at the far edge of the hill
    for (let x = 0; x < g.W; x += g.U * 1.2) {
      ctx.fillStyle = rand() < 0.5 ? '#6f8a62' : '#8da57a';
      blob(ctx, x, crest(g, x) + g.U * 0.3, g.U * 1.2, g.U * 0.5);
    }
    const haze = ctx.createLinearGradient(0, g.H * 0.38, 0, g.H * 0.62);
    haze.addColorStop(0, 'rgba(200,214,232,0.55)');
    haze.addColorStop(1, 'rgba(200,214,232,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, g.H * 0.38, g.W, g.H * 0.24);
  }

  // a Japanese black pine, trunk and flat pads
  function pine(ctx, x, y, h, lean) {
    ctx.strokeStyle = '#3c2f26';
    ctx.lineWidth = Math.max(1, h * 0.07);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * h * 0.3, y - h * 0.5, x + lean * h * 0.1, y - h * 0.9);
    ctx.stroke();
    const pads = [[0.45, -0.28, 0.26], [0.62, 0.3, 0.3], [0.8, -0.16, 0.26], [0.95, 0.06, 0.22]];
    for (const p of pads) {
      const px = x + lean * h * 0.15 + p[1] * h;
      const py = y - h * p[0];
      const w = h * p[2];
      ctx.fillStyle = '#2d4230';
      blob(ctx, px, py, w, w * 0.4);
      ctx.fillStyle = '#44603e';
      blob(ctx, px - w * 0.1, py - w * 0.14, w * 0.7, w * 0.26);
      ctx.fillStyle = '#6a8450';
      blob(ctx, px - w * 0.3, py - w * 0.22, w * 0.35, w * 0.12);
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintFuji(ctx, g);
    paintSea(ctx, g);
    paintHill(ctx, g, rand);
    const px = g.W * 0.7;
    pine(ctx, px, crest(g, px) + g.U * 1.5, g.U * 20, -0.5);
    const qx = g.W * 0.9;
    pine(ctx, qx, crest(g, qx) + g.U * 1, g.U * 12, 0.4);
    return c;
  }

  // the paler flowers, with alpha in diagonal waves that tile across the width
  function paintGust(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    dabs(ctx, g, rand, PALE, Math.round(g.W * g.H * 0.035), 0.6);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const k1 = (TAU * 3) / c.width;
    const k2 = TAU / (g.H * 1.6);
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4 + 3;
        if (!d[i]) continue;
        const w = Math.sin(x * k1 + y * k2 * 3) + 0.6 * Math.sin(x * k1 * 2 - y * k2 * 1.5);
        d[i] = d[i] * smoothstep(0.3, 1.4, w);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintClouds(g, rand) {
    const c = layer(g.W, g.hz);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eef0ee';
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * g.W + rand() * g.W * 0.06;
      const y = g.hz * (0.08 + rand() * 0.5);
      const w = g.U * (9 + rand() * 12);
      for (let j = 0; j < 4; j++) {
        blob(ctx, x + (j - 1.5) * w * 0.35, y - Math.sin(j * 1.1) * g.U * 0.9, w * (0.3 + rand() * 0.15), g.U * (0.8 + rand() * 0.9));
      }
      blob(ctx, x, y + g.U * 0.6, w * 0.7, g.U * 0.55);
    }
    return c;
  }

  function makeCranes(g, rand) {
    const out = [];
    for (let i = 0; i < CRANES; i++) {
      out.push({ x: rand() * g.W, y: g.hz * (0.12 + rand() * 0.4), v: g.U * (1.2 + rand() * 0.8), s: g.U * (1.8 + rand() * 0.8), p: rand() * TAU });
    }
    return out;
  }

  function drawCrane(ctx, c, t) {
    const flap = Math.sin(t * 3 + c.p);
    const s = c.s;
    ctx.fillStyle = '#f2f0ea';
    ctx.beginPath();
    ctx.moveTo(c.x - s * 2.2, c.y - flap * s * 0.9);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c.x + s * 2.2, c.y - flap * s * 0.9);
    ctx.lineTo(c.x + s * 0.4, c.y + s * 0.35);
    ctx.lineTo(c.x - s * 0.4, c.y + s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b2a2c';
    ctx.fillRect(c.x - s * 1.8, c.y - flap * s * 0.7 - s * 0.15, s * 0.7, Math.max(1, s * 0.3));
    ctx.fillRect(c.x + s * 1.1, c.y - flap * s * 0.7 - s * 0.15, s * 0.7, Math.max(1, s * 0.3));
    ctx.fillStyle = '#d6452c';
    ctx.fillRect(c.x + s * 0.5, c.y - s * 0.55, Math.max(1, s * 0.4), Math.max(1, s * 0.4));
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.front = paintFront(g, rand);
    state.gust = paintGust(g, rand);
    state.clouds = paintClouds(g, rand);
    state.cranes = makeCranes(g, rand);
  }

  function wrapped(ctx, img, off, h) {
    const w = img.width;
    const x = ((off % w) + w) % w;
    ctx.drawImage(img, 0, 0, w, h, -x, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h, w - x, 0, w, h);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind, clouds, cranes } = api.props;
    ctx.drawImage(state.front, 0, 0, g.W, g.hz, 0, 0, g.W, g.hz);
    ctx.globalAlpha = Math.min(1, 0.5 * clouds);
    wrapped(ctx, state.clouds, t * g.U * 0.6, state.clouds.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.front, 0, g.hz, g.W, g.H - g.hz, 0, g.hz, g.W, g.H - g.hz);
    ctx.globalAlpha = Math.min(1, 0.7 * wind);
    wrapped(ctx, state.gust, t * g.U * 2.2, g.H);
    ctx.globalAlpha = 1;
    const n = Math.min(CRANES, Math.round(CRANES * cranes * 0.5));
    for (let i = 0; i < n; i++) {
      const c = state.cranes[i];
      c.x += c.v * Math.min(dt, 0.1);
      if (c.x > g.W + c.s * 3) c.x = -c.s * 3;
      drawCrane(ctx, c, t);
    }
  }

  Kasuri.run({
    defaults: { wind: 1, clouds: 1, cranes: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
