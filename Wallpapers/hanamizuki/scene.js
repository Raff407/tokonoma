/*
 * 花水木 Hanamizuki — a white dogwood in bloom above a tiled wooden roof.
 *
 * Sky, hills, roof and two blossom layers are baked once and again on resize.
 * Each frame slides the blossom layers a little, drifts a cloud strip and a
 * dapple strip, and moves a short pool of petals.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const TAU = Math.PI * 2;
  const RIDGE = 0.64;
  const MAX_PETALS = 36;
  const PETAL_TONES = ['#f4f0e4', '#ece6d6', '#f1e4dc'];
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

  // ---- sky and hills -------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * RIDGE);
    grad.addColorStop(0, '#8fb0c4');
    grad.addColorStop(0.55, '#b9cfd2');
    grad.addColorStop(1, '#e4e6d6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // far hills in two soft ranges
    const ranges = [['#b4c4bf', 0.5, 0.08, 5], ['#97ae9f', 0.58, 0.06, 9]];
    for (const [ink, base, amp, seed] of ranges) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) {
        ctx.lineTo(x, g.H * base - fbm(x / (g.U * 38), seed, 4, seed) * g.H * amp);
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.013, y * 0.08, 4, 17);
        const b = fbm((x - w) * 0.013, y * 0.08, 4, 17);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 248;
        img.data[i + 1] = 246;
        img.data[i + 2] = 238;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- roof ----------------------------------------------------------------

  function paintRoof(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * RIDGE;
    const u = g.U;
    // slightly sloping roof body in curved tile columns
    const tileW = Math.max(3, u * 2.2);
    const body = ctx.createLinearGradient(0, top, 0, g.H);
    body.addColorStop(0, '#8d99a8');
    body.addColorStop(1, '#667384');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, top + u * 5);
    ctx.lineTo(g.W, top - u * 1.5);
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
    for (let x = 0; x < g.W; x += tileW) {
      const y0 = lerp(top + u * 5, top - u * 1.5, x / g.W) + u * 2.2;
      ctx.fillStyle = '#c4ccd4';
      ctx.fillRect(x, y0, Math.max(1, tileW * 0.34), g.H - y0);
      ctx.fillStyle = '#4c5664';
      ctx.fillRect(x + tileW * 0.6, y0, Math.max(1, tileW * 0.25), g.H - y0);
    }
    // courses of overlapping tile ends
    ctx.fillStyle = '#2e3540';
    for (let y = top + u * 7; y < g.H; y += u * 3.6) {
      ctx.globalAlpha = 0.55;
      ctx.fillRect(0, y + (y - top) * 0.04, g.W, 1);
    }
    ctx.globalAlpha = 1;
    // ridge: a row of rounded cap tiles with a pale plaster line under it
    const ridgeY = (x) => lerp(top + u * 5, top - u * 1.5, x / g.W);
    ctx.fillStyle = '#d9d2bd';
    ctx.beginPath();
    ctx.moveTo(0, ridgeY(0) - u * 0.5);
    ctx.lineTo(g.W, ridgeY(g.W) - u * 0.5);
    ctx.lineTo(g.W, ridgeY(g.W) + u * 1.4);
    ctx.lineTo(0, ridgeY(0) + u * 1.4);
    ctx.fill();
    ctx.fillStyle = '#39404a';
    for (let x = 0; x < g.W; x += u * 2.6) blob(ctx, x + u * 1.3, ridgeY(x) - u * 1.1, u * 1.35, u * 1.05);
    ctx.fillStyle = '#566170';
    for (let x = 0; x < g.W; x += u * 2.6) blob(ctx, x + u * 1.1, ridgeY(x) - u * 1.5, u * 0.5, u * 0.4);
    // gable end with an ornamental tile at the left
    const gx = g.W * 0.06;
    ctx.fillStyle = '#2a3038';
    blob(ctx, gx, ridgeY(gx) - u * 2.2, u * 2.6, u * 3.2);
    ctx.fillStyle = '#c8a24a';
    blob(ctx, gx, ridgeY(gx) - u * 2.2, u * 0.9, u * 1.2);
    return c;
  }

  // ---- blossoms ------------------------------------------------------------

  function flower(ctx, x, y, s, rot, tone) {
    ctx.fillStyle = tone;
    for (let k = 0; k < 4; k++) {
      const a = rot + k * (TAU / 4);
      blob(ctx, x + Math.cos(a) * s * 0.52, y + Math.sin(a) * s * 0.52, s * 0.52, s * 0.36, a);
    }
    ctx.fillStyle = '#c9b45e';
    blob(ctx, x, y, s * 0.16, s * 0.16);
    ctx.fillStyle = '#b86a58';
    for (let k = 0; k < 4; k++) {
      const a = rot + k * (TAU / 4);
      ctx.fillRect(x + Math.cos(a) * s * 0.98, y + Math.sin(a) * s * 0.98, 1, 1);
    }
  }

  function limb(ctx, pts, w) {
    ctx.strokeStyle = '#3c2e24';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }

  // One tier of branch from the right, flowers and young leaves along it.
  function tier(ctx, g, rand, y0, y1, count, size, reach) {
    const u = g.U;
    const x0 = g.W * 1.04;
    const x1 = g.W * (1 - reach);
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      pts.push(lerp(x0, x1, f), lerp(y0, y1, f) + Math.sin(f * 5 + y0) * u * 2);
    }
    limb(ctx, pts, Math.max(2, u * 2));
    limb(ctx, [pts[4], pts[5], pts[4] - u * 6, pts[5] - u * 8], Math.max(1.5, u * 1.1));
    for (let i = 0; i < count; i++) {
      const f = rand();
      const j = Math.min(5, Math.floor(f * 6)) * 2;
      const t = f * 6 - Math.floor(f * 6);
      const bx = lerp(pts[j], pts[j + 2], t);
      const by = lerp(pts[j + 1], pts[j + 3], t);
      const spread = u * (3 + f * 5);
      const px = bx + (rand() - 0.5) * spread * 2.4;
      const py = by + (rand() - 0.3) * spread * 1.6;
      if (rand() < 0.5) {
        ctx.fillStyle = rand() < 0.5 ? '#7a9a5c' : '#5f8250';
        blob(ctx, px, py, size * 0.7, size * 0.38, rand() * TAU);
      }
      flower(ctx, px, py, size * (0.7 + rand() * 0.6), rand() * TAU, PETAL_TONES[Math.floor(rand() * 3)]);
    }
  }

  function paintBack(g) {
    const c = layer(g.W * 1.1, g.H * 0.62);
    const ctx = c.getContext('2d');
    ctx.translate(g.W * 0.05, 0);
    const rand = K.rng(71);
    tier(ctx, g, rand, g.H * 0.1, g.H * 0.2, 50, g.U * 3.2, 0.55);
    tier(ctx, g, rand, g.H * 0.34, g.H * 0.42, 55, g.U * 3.3, 0.62);
    return c;
  }

  function paintFront(g) {
    const c = layer(g.W * 1.1, g.H * 0.7);
    const ctx = c.getContext('2d');
    ctx.translate(g.W * 0.05, 0);
    const rand = K.rng(113);
    tier(ctx, g, rand, g.H * -0.02, g.H * 0.1, 60, g.U * 4.6, 0.5);
    tier(ctx, g, rand, g.H * 0.22, g.H * 0.3, 48, g.U * 4.4, 0.42);
    tier(ctx, g, rand, g.H * 0.5, g.H * 0.56, 36, g.U * 4.2, 0.3);
    return c;
  }

  function paintDapple(g) {
    const w = Math.ceil(g.W * 0.5);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.05, y * 0.09, 3, 29);
        const b = fbm((x - w) * 0.05, y * 0.09, 3, 29);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 248;
        img.data[i + 2] = 220;
        img.data[i + 3] = smoothstep(0.55, 0.72, v) * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPetal(tone) {
    const c = layer(8, 8);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone;
    blob(ctx, 4, 4, 3.4, 2.2, 0.5);
    return c;
  }

  // ---- setup and draw ------------------------------------------------------

  function seedPetals(g) {
    const rand = K.rng(5);
    const list = [];
    for (let i = 0; i < MAX_PETALS; i++) {
      list.push({
        x: rand() * g.W,
        y: rand() * g.H * 0.9,
        v: 0.6 + rand() * 0.8,
        ph: rand() * TAU,
        s: 0.7 + rand() * 0.8,
        tone: i % 3,
      });
    }
    return list;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.sky = paintSky(g);
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    state.roof = paintRoof(g);
    state.back = paintBack(g);
    state.front = paintFront(g);
    state.dapple = paintDapple(g);
    state.petalArt = PETAL_TONES.map(paintPetal);
    state.petals = seedPetals(g);
  }

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawDapple(ctx, g, t) {
    const d = state.dapple;
    const y = g.H * RIDGE + g.U * 3;
    const off = -((t * g.U * 0.9) % d.width);
    ctx.globalAlpha = 0.55 + Math.sin(t * 0.5) * 0.15;
    for (let x = off; x < g.W; x += d.width) {
      ctx.drawImage(d, x, y, d.width, d.height);
      ctx.drawImage(d, x, y + d.height, d.width, d.height * 0.6);
    }
    ctx.globalAlpha = 1;
  }

  function drawPetals(ctx, g, t, dt, amount) {
    const n = Math.round(MAX_PETALS * Math.min(1, amount / 1.5));
    for (let i = 0; i < n; i++) {
      const p = state.petals[i];
      p.y += dt * g.U * 4 * p.v;
      p.x -= dt * g.U * (3 + Math.sin(t * 0.6 + p.ph) * 2.2) * p.v;
      if (p.y > g.H || p.x < -8) {
        p.y = -4;
        p.x = g.W * (0.25 + (i % 7) * 0.12);
      }
      const sway = Math.sin(t * 1.3 + p.ph) * g.U * 1.2;
      const s = g.U * 0.9 * p.s;
      ctx.drawImage(state.petalArt[p.tone], p.x + sway, p.y, s * 2, s * 2);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const breeze = api.props.breeze;
    const sway = Math.sin(t * 0.7) * g.U * 1.4 * breeze;
    const swayB = Math.sin(t * 0.55 + 1.2) * g.U * 0.9 * breeze;
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.back, -g.W * 0.05 + swayB, g.U * Math.sin(t * 0.8) * 0.4 * breeze);
    ctx.drawImage(state.roof, 0, 0);
    drawDapple(ctx, g, t);
    ctx.drawImage(state.front, -g.W * 0.05 + sway, Math.sin(t * 0.9 + 0.5) * g.U * 0.6 * breeze);
    drawPetals(ctx, g, t, dt, api.props.petals);
  }

  Kasuri.run({
    defaults: { breeze: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
