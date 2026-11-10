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

  // The bird is drawn in its own units (ctx scaled by s), facing right, feet at y = 0.
  const PLUM = {
    body: '#3c6a5a', breast: '#2a4a42', wing: '#6f6243', bar: '#4a4130', pale: '#c9b98e',
    neck: '#2c3a58', head: '#26334d', wattle: '#b8402c', bill: '#c9b07a', leg: '#8a7556',
    tail: '#7d6a45', tailDark: '#4f4330',
  };

  // One long feather: a tapering curve from the rump to a tip, filled.
  function feather(ctx, x0, y0, x1, y1, bend, w, color) {
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2 - bend;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - w);
    ctx.quadraticCurveTo(mx, my - w * 0.6, x1, y1);
    ctx.quadraticCurveTo(mx, my + w * 0.6, x0, y0 + w);
    ctx.closePath();
    ctx.fill();
  }

  function tail(ctx, sway) {
    const tx = -27;
    const ty = -16 + sway;
    feather(ctx, -6.5, -10, tx + 6, ty + 3.2, 1.2, 0.9, PLUM.tailDark);
    feather(ctx, -6.5, -10.2, tx + 3, ty + 1.2, 1.6, 0.85, PLUM.tailDark);
    feather(ctx, -6.5, -10.4, tx, ty, 2, 1.0, PLUM.tail);
    // dark bars across the central feather, thinning toward the tip
    ctx.strokeStyle = PLUM.tailDark;
    ctx.lineWidth = 0.45;
    for (let i = 1; i < 7; i++) {
      const f = i / 7.5;
      const x = lerp(-6.5, tx, f);
      const y = lerp(-10.4, ty, f) - 2 * 4 * f * (1 - f) * 0.5;
      const half = 1.0 * (1 - f) + 0.15;
      ctx.beginPath();
      ctx.moveTo(x - half * 0.3, y - half);
      ctx.lineTo(x + half * 0.3, y + half);
      ctx.stroke();
    }
  }

  function legs(ctx, ph) {
    ctx.strokeStyle = PLUM.leg;
    ctx.lineWidth = 0.55;
    for (let i = 0; i < 2; i++) {
      const a = Math.sin(ph + i * Math.PI);
      const lift = Math.max(0, Math.cos(ph + i * Math.PI)) * 0.9;
      const fx = 0.5 + a * 1.8;
      ctx.beginPath();
      ctx.moveTo(0.3 + i * 0.6, -6.2);
      ctx.lineTo(fx - 0.4, -3 - lift * 0.5);
      ctx.lineTo(fx, -lift);
      ctx.lineTo(fx + 1.3, -lift);
      ctx.stroke();
    }
  }

  function body(ctx) {
    ctx.fillStyle = PLUM.body;
    ctx.beginPath();
    ctx.moveTo(6.2, -10.2);
    ctx.bezierCurveTo(6.2, -6.6, 1.5, -5.6, -1.8, -6.1);
    ctx.bezierCurveTo(-5, -6.8, -7.4, -8.4, -8, -10.1);
    ctx.bezierCurveTo(-5, -12.4, 0.5, -13, 3.6, -12.2);
    ctx.bezierCurveTo(5.4, -11.8, 6.2, -11.2, 6.2, -10.2);
    ctx.fill();
    ctx.fillStyle = PLUM.breast;
    blob(ctx, 3.6, -8.4, 2.6, 2.2, 0.3);
    // folded wing with pale scalloped edges
    ctx.fillStyle = PLUM.wing;
    blob(ctx, -1.6, -10.3, 4.8, 1.9, -0.12);
    ctx.strokeStyle = PLUM.pale;
    ctx.lineWidth = 0.3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-4.2 + i * 2.2, -10.9 + i * 0.25, 1.1, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.strokeStyle = PLUM.bar;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(-6.2, -9.6);
    ctx.quadraticCurveTo(-2, -8.4, 2.4, -9.6);
    ctx.stroke();
  }

  function head(ctx) {
    ctx.fillStyle = PLUM.neck;
    ctx.beginPath();
    ctx.moveTo(3.2, -12);
    ctx.quadraticCurveTo(5.2, -14.5, 6.2, -17.2);
    ctx.lineTo(8, -17);
    ctx.quadraticCurveTo(7.6, -13.6, 6.4, -10.4);
    ctx.closePath();
    ctx.fill();
    // the Japanese bird has no white collar: indigo neck straight into the head
    ctx.fillStyle = PLUM.head;
    blob(ctx, 7.2, -17.6, 1.75, 1.45, -0.2);
    ctx.fillStyle = PLUM.head;
    blob(ctx, 6.1, -18.4, 0.9, 0.4, -0.5);
    ctx.fillStyle = PLUM.wattle;
    blob(ctx, 7.8, -17.6, 0.95, 1.0, 0);
    ctx.fillStyle = PLUM.pale;
    ctx.fillRect(7.6, -18.1, 0.35, 0.35);
    ctx.fillStyle = PLUM.bill;
    ctx.beginPath();
    ctx.moveTo(8.5, -18.1);
    ctx.lineTo(9.8, -17.5);
    ctx.lineTo(8.5, -17.1);
    ctx.fill();
  }

  function drawBird(ctx, x, y, s, ph) {
    const bob = Math.abs(Math.sin(ph)) * 0.25;
    const peck = Math.max(0, Math.sin(ph * 0.31 + 1)) ** 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.translate(0, -bob);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    legs(ctx, ph);
    tail(ctx, Math.sin(ph * 0.5) * 0.6);
    body(ctx);
    ctx.translate(4.5, -11.5);
    ctx.rotate(peck * 0.9);
    ctx.translate(-4.5, 11.5);
    head(ctx);
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
    const span = g.W + g.U * 80;
    const pos = ((t * g.U * 1.8 * walk + span * 0.3) % span) - g.U * 20;
    const phase = t * 2.6 * Math.max(0.2, walk);
    drawBird(ctx, pos, g.H * 0.83, g.U * 1.7, walk > 0 ? phase : 0);
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
