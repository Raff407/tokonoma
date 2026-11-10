/*
 * 鈴虫 Suzumushi — bell crickets in autumn grass under a full moon.
 *
 * Sky, moon, hills and both grass banks are baked once. The grass is laid back
 * in thin rows that lean sideways more the higher they stand. Cloud is one
 * tiling strip, and a short pool of glints drifts over the field.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const MOON = { x: 0.7, y: 0.25, r: 0.085 };
  const GLINTS = 22;
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
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.7);
    grad.addColorStop(0, '#1a2140');
    grad.addColorStop(0.6, '#2a3a63');
    grad.addColorStop(1, '#4a5a7a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e6e4da';
    for (let i = 0; i < g.W * 0.25; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.4;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H * 0.45), 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * MOON.x;
    const my = g.H * MOON.y;
    const mr = g.H * MOON.r;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
    halo.addColorStop(0, 'rgba(236,228,196,0.4)');
    halo.addColorStop(1, 'rgba(236,228,196,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#f0e8c8';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,180,140,0.45)';
    [[-0.3, -0.2, 0.25], [0.25, 0.1, 0.3], [-0.1, 0.4, 0.18]].forEach((m) => {
      ctx.beginPath();
      ctx.arc(mx + m[0] * mr, my + m[1] * mr, m[2] * mr, 0, TAU);
      ctx.fill();
    });
    return c;
  }

  function paintCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = K.lerp(fbm(x * 0.012, y * 0.08, 4, 31), fbm((x - w) * 0.012, y * 0.08, 4, 31), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 214;
        img.data[i + 1] = 218;
        img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintHills(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rows = [
      { y: 0.5, amp: 0.06, f: 0.004, seed: 3, col: '#33405f' },
      { y: 0.58, amp: 0.05, f: 0.006, seed: 8, col: '#263150' },
    ];
    rows.forEach((r) => {
      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) {
        ctx.lineTo(x, g.H * (r.y - (fbm(x * r.f, r.seed, 3, r.seed) - 0.3) * r.amp * 2));
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    });
    return c;
  }

  // One bank of grass: blades fan up from a base line, a few carry plumes.
  function paintBank(g, rand, o) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    for (let i = 0; i < o.count; i++) {
      const bx = rand() * g.W;
      const by = g.H * (o.base + rand() * 0.08);
      const len = g.H * o.len * (0.45 + rand() * 0.55);
      const lean = (rand() - 0.5) * len * 0.5;
      const cols = o.cols;
      ctx.strokeStyle = cols[Math.floor(rand() * cols.length)];
      ctx.lineWidth = Math.max(1, g.U * o.w * (0.7 + rand() * 0.6));
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + lean * 0.2, by - len * 0.6, bx + lean, by - len);
      ctx.stroke();
      if (o.plumes && rand() < 0.14) {
        const tx = bx + lean;
        const ty = by - len;
        ctx.strokeStyle = '#d8d2b8';
        ctx.lineWidth = Math.max(2, g.U * 0.7);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + g.U * 1.5, ty - g.U * 4, tx + g.U * 3.5, ty - g.U * 9);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(216,210,184,0.6)';
        ctx.lineWidth = 1;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(tx + g.U * 1.5, ty - g.U * 4);
          ctx.lineTo(tx + g.U * (2 + k * 1.1), ty - g.U * (8 + (2 - Math.abs(k))));
          ctx.stroke();
        }
      }
    }
    // dark ground under the blades
    ctx.fillStyle = o.ground;
    ctx.fillRect(0, g.H * (o.base + 0.07), g.W, g.H);
    return c;
  }

  // A hagi spray with a few small pink-white flowers, low in the near bank.
  function paintHagi(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const x0 = g.W * 0.16;
    const y0 = g.H * 0.97;
    ctx.strokeStyle = '#2a3a2c';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.lineCap = 'round';
    for (let s = 0; s < 3; s++) {
      const ex = x0 + (s - 1) * g.W * 0.07 + g.W * 0.05;
      const ey = g.H * (0.7 + s * 0.03);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + (ex - x0) * 0.3, ey + g.H * 0.12, ex, ey);
      ctx.stroke();
      for (let k = 0; k < 9; k++) {
        const t = 0.25 + k * 0.09;
        const px = x0 + (ex - x0) * t + (rand() - 0.5) * g.U * 3;
        const py = y0 + (ey - y0) * t + (rand() - 0.5) * g.U * 3;
        ctx.fillStyle = k % 3 === 0 ? '#c9a0a0' : '#8a5a68';
        ctx.fillRect(px, py, Math.max(2, g.U * 0.9), Math.max(2, g.U * 0.9));
      }
    }
    return c;
  }

  function sheared(ctx, src, g, t, amp, top, bottom, phase) {
    const step = Math.max(2, Math.round(g.U * 0.8));
    const span = bottom - top;
    for (let y = top; y < bottom; y += step) {
      const k = 1 - (y - top) / span;
      const dx = amp * k * (Math.sin(t * 0.9 + phase + y * 0.03) + 0.5 * Math.sin(t * 1.7 + y * 0.05));
      ctx.drawImage(src, 0, y, g.W, step, dx, y, g.W, step);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.cloud = paintCloud(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    state.hills = paintHills(g);
    state.far = paintBank(g, rand, {
      base: 0.6, len: 0.2, w: 0.5, count: Math.round(g.W * 1.2), plumes: false,
      cols: ['#2f4a3c', '#3a5640', '#34503a'], ground: '#1f3028',
    });
    state.near = paintBank(g, rand, {
      base: 0.78, len: 0.42, w: 0.9, count: Math.round(g.W * 0.9), plumes: true,
      cols: ['#3f5a3a', '#546a44', '#6a6a48', '#2f4a34'], ground: '#142018',
    });
    state.hagi = paintHagi(g, rand);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      state.glints.push({ x: rand(), y: 0.55 + rand() * 0.4, p: rand() * TAU, s: 0.3 + rand() * 0.7 });
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const sway = api.props.sway;
    const amt = Math.round(GLINTS * Math.min(1, api.props.glints / 1) );
    ctx.drawImage(state.sky, 0, 0);
    const c = state.cloud;
    const off = -((t * g.U * 0.5) % c.width);
    ctx.drawImage(c, off, g.H * 0.12);
    ctx.drawImage(c, off + c.width, g.H * 0.12);
    ctx.drawImage(state.hills, 0, 0);
    sheared(ctx, state.far, g, t, g.U * 0.9 * sway, Math.floor(g.H * 0.38), Math.ceil(g.H * 0.68), 0);
    ctx.fillStyle = '#e8d890';
    for (let i = 0; i < amt; i++) {
      const p = state.glints[i];
      const a = Math.max(0, Math.sin(t * p.s * 1.2 + p.p));
      if (a < 0.2) continue;
      ctx.globalAlpha = a * 0.7;
      const x = (p.x * g.W + Math.sin(t * 0.3 * p.s + p.p) * g.U * 4 + g.W) % g.W;
      const y = p.y * g.H + Math.sin(t * 0.4 + p.p * 2) * g.U * 2;
      ctx.fillRect(x, y, Math.max(2, g.U * 0.5), Math.max(2, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
    sheared(ctx, state.near, g, t, g.U * 1.6 * sway, Math.floor(g.H * 0.2), Math.ceil(g.H * 0.86), 2);
    ctx.drawImage(state.hagi, 0, 0);
  }

  Kasuri.run({
    defaults: { sway: 1, glints: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
