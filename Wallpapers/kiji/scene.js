/*
 * 雉 Kiji — a green pheasant walking through tall dewy grass at dawn.
 *
 * Sky, hills, torii and far trees are baked once. Two grass layers are baked and drawn
 * in thin bands that lean with a slow wind. The bird is a handful of shapes redrawn each
 * frame; mist is one tiling strip.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;
  const TAU = Math.PI * 2;
  const SKY = ['#9aa7b3', '#c3c1b6', '#e4d3bb', '#efd7b0', '#f0cfa2'];
  const BANDS = 12;
  const STRIPS = 6;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    return { W, H, U, u, hz: Math.round(H * 0.56) };
  }

  // ---- back layer: sky, sun, hills, torii ------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.hz);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.hz; y++) {
      const f = Math.min(1, y / g.hz) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const sx = g.W * 0.72;
    const sy = g.hz - g.U * 13;
    ctx.fillStyle = '#f2dcae';
    blob(ctx, sx, sy, g.U * 9, g.U * 9);
    ctx.fillStyle = '#d8573a';
    blob(ctx, sx, sy, g.U * 5.2, g.U * 5.2);
    ctx.fillStyle = '#e8c9a0';
    for (let i = 0; i < 5; i++) {
      blob(ctx, g.W * (0.1 + rand() * 0.8), g.H * (0.07 + rand() * 0.14), g.U * (9 + rand() * 12), g.U * 0.6);
    }
  }

  function ridge(ctx, g, base, amp, seed, scale, color, peakX) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.hz + 2);
    for (let x = 0; x <= g.W + 2; x += 2) {
      let y = base - fbm(x / (g.U * scale), seed, 4, seed) * amp;
      if (peakX !== undefined) {
        const d = Math.abs(x - peakX) / (g.U * 34);
        y -= Math.max(0, 1 - d) ** 1.4 * g.U * 20;
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.hz + 2);
    ctx.fill();
  }

  function torii(ctx, x, y, s) {
    ctx.fillStyle = '#a8432e';
    ctx.fillRect(x - s * 3.4, y - s * 9, s * 0.9, s * 9);
    ctx.fillRect(x + s * 2.5, y - s * 9, s * 0.9, s * 9);
    ctx.fillRect(x - s * 2.8, y - s * 7, s * 5.6, s * 0.7);
    ctx.fillStyle = '#3a312c';
    ctx.beginPath();
    ctx.moveTo(x - s * 5, y - s * 9);
    ctx.quadraticCurveTo(x, y - s * 8.4, x + s * 5, y - s * 9);
    ctx.lineTo(x + s * 4.4, y - s * 10.3);
    ctx.quadraticCurveTo(x, y - s * 9.7, x - s * 4.4, y - s * 10.3);
    ctx.fill();
  }

  function sugi(ctx, x, y, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - h * 0.17, y);
    ctx.lineTo(x + h * 0.17, y);
    ctx.fill();
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.hz + 2);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ridge(ctx, g, g.hz - g.U * 20, g.H * 0.2, 3, 38, '#a3aab0', g.W * 0.2);
    ridge(ctx, g, g.hz - g.U * 11, g.H * 0.14, 7, 26, '#86938f');
    ridge(ctx, g, g.hz - g.U * 4, g.H * 0.09, 12, 18, '#5f7466');
    torii(ctx, g.W * 0.4, g.hz - g.U * 3, g.U * 0.9);
    for (let x = g.W * 0.05; x < g.W; x += g.U * (3 + rand() * 6)) {
      if (Math.abs(x - g.W * 0.4) < g.U * 7) continue;
      sugi(ctx, x, g.hz + g.U, g.U * (7 + rand() * 7), '#3c5446');
    }
    ctx.fillStyle = '#41594a';
    ctx.fillRect(0, g.hz, g.W, 2);
    return c;
  }

  // ---- grass layers -----------------------------------------------------------

  function blade(ctx, x, y, h, lean, w) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
  }

  function plume(ctx, g, x, y, lean, size) {
    const tx = x + lean;
    ctx.strokeStyle = '#cdb98e';
    ctx.lineWidth = Math.max(1, size * 0.12);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.quadraticCurveTo(tx + i * size * 0.4, y - size * 0.6, tx + i * size * 0.7 + lean * 0.1, y - size * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#e9ddc0';
    blob(ctx, tx, y - size * 0.8, size * 0.16, size * 0.8);
  }

  function dew(ctx, rand, x, y, s) {
    ctx.fillStyle = '#e9efe2';
    ctx.fillRect(x, y, s, s);
  }

  function paintGrass(g, rand, opts) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    for (let x = -g.U * 2; x < g.W + g.U * 2; x += g.U * opts.gap * (0.6 + rand() * 0.8)) {
      const base = opts.base + (rand() - 0.5) * g.U * 3;
      const h = g.U * opts.h * (0.6 + rand() * 0.6);
      const lean = (rand() - 0.5) * h * 0.5;
      ctx.strokeStyle = opts.tones[Math.floor(rand() * opts.tones.length)];
      blade(ctx, x, base, h, lean, Math.max(1, g.U * opts.w));
      if (rand() < opts.dew) dew(ctx, rand, x + lean * 0.8, base - h * 0.8, Math.max(1, g.U * 0.35));
      if (rand() < opts.plume) plume(ctx, g, x, base - h, lean, g.U * opts.plumeSize);
    }
    return c;
  }

  function paintMeadow(g, rand) {
    const c = layer(g.W, g.H - g.hz);
    const ctx = c.getContext('2d');
    const h = c.height;
    const top = K.parseColor('#6f8a5c');
    const bot = K.parseColor('#33482f');
    for (let y = 0; y < h; y++) {
      const k = Math.min(1, y / (h * 0.8));
      ctx.fillStyle = K.toHex(K.mixColor(top, bot, k));
      ctx.fillRect(0, y, g.W, 1);
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < g.W / (g.U * 0.9); i++) {
      const y = rand() * h;
      const f = y / h;
      ctx.strokeStyle = rand() < 0.5 ? '#587a46' : '#2c3f2a';
      blade(ctx, rand() * g.W, y + g.U, g.U * (2 + f * 4), (rand() - 0.5) * g.U, Math.max(1, g.U * 0.35));
    }
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.6);
    const c = layer(w, g.H * 0.3);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 20; i++) {
      const x = (i / 20) * w;
      const y = c.height * (0.2 + 0.6 * fbm(i * 0.7, 2.2, 3, 9));
      const grad = ctx.createLinearGradient(0, y - g.U * 4, 0, y + g.U * 4);
      grad.addColorStop(0, 'rgba(238,230,212,0)');
      grad.addColorStop(0.5, 'rgba(238,230,212,0.5)');
      grad.addColorStop(1, 'rgba(238,230,212,0)');
      ctx.fillStyle = grad;
      for (const dx of [0, -w]) ctx.fillRect(x + dx - g.U * 14, y - g.U * 4, g.U * 28 + 1, g.U * 8);
    }
    return c;
  }

  function drawMist(ctx, g, t, amount, y, alpha) {
    if (amount <= 0) return;
    const w = state.mist.width;
    const off = (t * g.U * 0.9 * amount) % w;
    ctx.globalAlpha = Math.min(1, alpha * (0.5 + amount * 0.5));
    for (let x = -off; x < g.W; x += w) ctx.drawImage(state.mist, x, y);
    ctx.globalAlpha = 1;
  }

  // Draw a layer in horizontal bands and vertical strips, each leaning with the wind.
  function drawSway(ctx, g, img, t, amp, y0, y1, phase) {
    const bh = (y1 - y0) / BANDS;
    const sw = g.W / STRIPS;
    for (let b = 0; b < BANDS; b++) {
      const f = 1 - (b + 0.5) / BANDS;
      const sy = y0 + b * bh;
      for (let s = 0; s < STRIPS; s++) {
        const o = Math.sin(t * 0.9 + phase + s * 1.3 + b * 0.18) * amp * f * g.U * 1.6
          + Math.sin(t * 0.37 + s * 0.6) * amp * f * g.U * 0.8;
        ctx.drawImage(img, s * sw, sy, sw + 1, bh + 1, s * sw + o, sy, sw + 1, bh + 1);
      }
    }
  }

  // ---- the pheasant ------------------------------------------------------------

  function tail(ctx, s, sway) {
    ctx.lineCap = 'round';
    const ink = ['#8f6a3a', '#5a4630'];
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = ink[k];
      ctx.lineWidth = s * (k ? 0.5 : 2.2);
      ctx.beginPath();
      ctx.moveTo(-5 * s, -10 * s);
      ctx.quadraticCurveTo(-14 * s, -10.5 * s + sway, -27 * s, -6.5 * s + sway * 1.6);
      ctx.stroke();
    }
    ctx.strokeStyle = '#4a3a28';
    ctx.lineWidth = s * 0.55;
    for (let i = 1; i < 6; i++) {
      const f = i / 6;
      const x = -5 * s - f * 22 * s;
      const y = -10 * s + f * 3.5 * s + sway * f * f * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.0);
      ctx.lineTo(x - s * 0.4, y + s * 1.0);
      ctx.stroke();
    }
  }

  function legs(ctx, s, ph) {
    ctx.strokeStyle = '#8a7556';
    ctx.lineWidth = Math.max(1, s * 0.5);
    for (let i = 0; i < 2; i++) {
      const a = Math.sin(ph + i * Math.PI);
      const lift = Math.max(0, Math.cos(ph + i * Math.PI)) * s * 1.2;
      ctx.beginPath();
      ctx.moveTo(-0.5 * s, -6 * s);
      ctx.lineTo(a * 2.4 * s, -lift);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a * 2.4 * s, -lift);
      ctx.lineTo(a * 2.4 * s + 1.5 * s, -lift);
      ctx.stroke();
    }
  }

  function drawBird(ctx, x, y, s, ph) {
    const bob = Math.abs(Math.sin(ph)) * s * 0.35;
    const peck = Math.max(0, Math.sin(ph * 0.5 + 1)) ** 6 * s * 2.2;
    ctx.save();
    ctx.translate(x, y - bob);
    legs(ctx, s, ph);
    tail(ctx, s, Math.sin(ph) * s * 0.4);
    ctx.fillStyle = '#9a5128';
    blob(ctx, 0, -9.5 * s, 7.4 * s, 4.6 * s, -0.12);
    ctx.fillStyle = '#b8683a';
    blob(ctx, 1.5 * s, -10.2 * s, 4.6 * s, 3 * s, -0.1);
    ctx.fillStyle = '#2f3b2a';
    for (let i = -2; i <= 1; i++) blob(ctx, i * 1.9 * s - 1.2 * s, -11.6 * s, 0.7 * s, 0.7 * s);
    ctx.fillStyle = '#3f6a4a';
    blob(ctx, 5.4 * s, -10.6 * s, 2.8 * s, 3 * s);
    ctx.beginPath();
    ctx.moveTo(4 * s, -11.5 * s);
    ctx.lineTo(5.8 * s, -16.5 * s + peck);
    ctx.lineTo(9 * s, -16 * s + peck);
    ctx.lineTo(8 * s, -10 * s);
    ctx.fill();
    ctx.fillStyle = '#ebe6d6';
    ctx.fillRect(5.6 * s, -15.2 * s + peck, 3.6 * s, 0.7 * s);
    ctx.fillStyle = '#1f4a52';
    blob(ctx, 7.6 * s, -17.6 * s + peck, 2.6 * s, 2.4 * s);
    ctx.fillStyle = '#b43a28';
    blob(ctx, 8.4 * s, -17.1 * s + peck, 1.8 * s, 1.6 * s);
    ctx.fillStyle = '#e4d6a8';
    blob(ctx, 8 * s, -18 * s + peck, 0.6 * s, 0.6 * s);
    ctx.fillStyle = '#c9a85a';
    ctx.beginPath();
    ctx.moveTo(9.8 * s, -18 * s + peck);
    ctx.lineTo(12 * s, -17 * s + peck);
    ctx.lineTo(9.8 * s, -16.4 * s + peck);
    ctx.fill();
    ctx.restore();
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.meadow = paintMeadow(g, rand);
    state.mist = paintMist(g);
    state.far = paintGrass(g, rand, {
      base: g.H * 0.78, h: 12, gap: 0.9, w: 0.45, dew: 0.05, plume: 0.03, plumeSize: 2.2,
      tones: ['#6f8a58', '#5b7a4a', '#7f9560'],
    });
    state.near = paintGrass(g, rand, {
      base: g.H * 1.04, h: 27, gap: 1.5, w: 0.7, dew: 0.12, plume: 0.05, plumeSize: 3.6,
      tones: ['#3e5a34', '#4f6d3c', '#2f4a2e', '#6b8450'],
    });
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, mist, walk } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist, g.hz - g.U * 16, 0.55);
    ctx.drawImage(state.meadow, 0, g.hz);
    drawSway(ctx, g, state.far, t, sway, g.H * 0.5, g.H * 0.82, 0);
    const span = g.W + g.U * 60;
    const pos = ((t * g.U * 1.8 * walk + span * 0.3) % span) - g.U * 30;
    const phase = t * 2.6 * Math.max(0.2, walk);
    drawBird(ctx, pos, g.H * 0.88, g.U * 2.7, walk > 0 ? phase : 0);
    drawMist(ctx, g, t + 40, mist, g.H * 0.6, 0.3);
    drawSway(ctx, g, state.near, t, sway, g.H * 0.6, g.H, 1.7);
  }

  Kasuri.run({
    defaults: { sway: 1, mist: 1, walk: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
