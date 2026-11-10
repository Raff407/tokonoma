/*
 * 渔火 Yuhuo — fishing lamps on a dark river under karst peaks.
 *
 * Sky, moon, three ridges and a bamboo clump are baked once. The river is that
 * world flipped and laid back in thin rows that slide sideways. Mist is a tiling
 * strip. Each raft is one baked sprite with a lamp on a pole; its lamp breathes
 * a little and drops a short column of light onto the water.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, clamp } = K;

  const HORIZON = 0.6;
  const MOON = { x: 0.7, y: 0.17, r: 0.045 };
  const ROW_STEP = 2;
  const SKY_TOP = '#0e1328';
  const SKY_LOW = '#3a4670';
  const RAFTS = [
    { scale: 0.7, y: 0.64, speed: 1.1, phase: 0.2, dir: 1 },
    { scale: 1.6, y: 0.78, speed: 2.4, phase: 0.62, dir: -1 },
    { scale: 1.1, y: 0.7, speed: 1.6, phase: 0.85, dir: 1 },
    { scale: 2.2, y: 0.92, speed: 3.4, phase: 0.35, dir: -1 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky and moon ------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const hz = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, 0, 0, hz);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(0.6, '#222c52');
    grad.addColorStop(1, SKY_LOW);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, hz + 1);
    ctx.fillStyle = '#e6e2d0';
    for (let i = 0; i < g.W * 0.35; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.45;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * hz * 0.6), 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * MOON.x;
    const my = g.H * MOON.y;
    const mr = Math.max(2.5, g.H * MOON.r);
    const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 6);
    halo.addColorStop(0, 'rgba(226,214,170,0.3)');
    halo.addColorStop(0.3, 'rgba(226,214,170,0.1)');
    halo.addColorStop(0.7, 'rgba(226,214,170,0.02)');
    halo.addColorStop(1, 'rgba(226,214,170,0)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, mr * 6, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = halo;
    ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
    ctx.restore();
    ctx.fillStyle = '#e8e0bc';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- karst ridges ------------------------------------------------------

  function makePeaks(g, rand, count, minH, maxH, minW, maxW) {
    const peaks = [];
    for (let i = 0; i < count; i++) {
      peaks.push({
        c: ((i + 0.2 + rand() * 0.6) / count) * g.W * 1.1 - g.W * 0.05,
        h: g.H * lerp(minH, maxH, rand()),
        w: g.W * lerp(minW, maxW, rand()),
      });
    }
    return peaks;
  }

  function ridgeY(g, peaks, x, seed) {
    let top = g.H * HORIZON;
    for (const p of peaks) {
      const d = Math.abs(x - p.c) / p.w;
      if (d >= 1) continue;
      const y = g.H * HORIZON - p.h * Math.pow(1 - Math.pow(d, 3), 0.42);
      if (y < top) top = y;
    }
    return top - fbm(x * 0.09, seed, 3, seed) * g.U * 1.2;
  }

  function paintRidge(ctx, g, rand, spec) {
    const hz = g.H * HORIZON;
    const peaks = makePeaks(g, rand, spec.count, spec.minH, spec.maxH, spec.minW, spec.maxW);
    const grad = ctx.createLinearGradient(0, hz - g.H * spec.maxH, 0, hz);
    grad.addColorStop(0, spec.top);
    grad.addColorStop(1, spec.foot);
    ctx.fillStyle = grad;
    for (let x = 0; x < g.W; x++) {
      const y = ridgeY(g, peaks, x, spec.seed);
      if (y < hz) ctx.fillRect(x, y, 1, hz - y + 1);
    }
    // Cliff streaks and a thin moss crown.
    for (let x = 0; x < g.W; x++) {
      const y = ridgeY(g, peaks, x, spec.seed);
      if (y >= hz - 1) continue;
      if (spec.crown && fbm(x * 0.2, 3, 2, spec.seed) > 0.45) {
        ctx.fillStyle = spec.crown;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x, y, 1, Math.max(1, g.U * 0.9));
      }
      if (rand() < 0.16) {
        ctx.fillStyle = spec.streak;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x, y + g.U * 2, 1, (hz - y) * (0.2 + rand() * 0.5));
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }

  function paintBamboo(ctx, g, rand) {
    const hz = g.H * HORIZON;
    const stalks = 7;
    for (let i = 0; i < stalks; i++) {
      const x = g.W * (0.035 + i * 0.012) + rand() * g.U;
      const top = hz - g.H * (0.2 + rand() * 0.12);
      const lean = (rand() - 0.5) * g.U * 4;
      ctx.strokeStyle = i % 2 ? '#1b2a2a' : '#223330';
      ctx.lineWidth = Math.max(1, g.U * 0.7);
      ctx.beginPath();
      ctx.moveTo(x, hz);
      ctx.lineTo(x + lean, top);
      ctx.stroke();
      ctx.fillStyle = '#4a5c44';
      for (let n = 1; n < 7; n++) {
        const f = n / 7;
        ctx.fillRect(x + lean * f - 1, lerp(hz, top, f), Math.max(2, g.U), 1);
      }
      ctx.fillStyle = '#26382f';
      for (let k = 0; k < 9; k++) {
        const f = 0.45 + rand() * 0.55;
        const lx = x + lean * f;
        const ly = lerp(hz, top, f);
        const len = g.U * (3 + rand() * 4);
        const sx = rand() < 0.5 ? -1 : 1;
        for (let s = 0; s < len; s++) ctx.fillRect(lx + sx * s, ly + s * 0.45, 1, 1);
      }
    }
  }

  function paintWorld(g) {
    const c = layer(g.W, Math.ceil(g.H * HORIZON) + 1);
    const ctx = c.getContext('2d');
    const rand = K.rng(88);
    paintSky(ctx, g, rand);
    paintRidge(ctx, g, rand, { count: 9, minH: 0.22, maxH: 0.4, minW: 0.03, maxW: 0.055, top: '#6a78a2', foot: '#4a5a86', streak: '#2a3558', seed: 3 });
    paintRidge(ctx, g, rand, { count: 7, minH: 0.14, maxH: 0.34, minW: 0.028, maxW: 0.05, top: '#3e4c78', foot: '#33426e', streak: '#1b2442', seed: 7, crown: '#2f4a44' });
    paintRidge(ctx, g, rand, { count: 6, minH: 0.05, maxH: 0.16, minW: 0.02, maxW: 0.04, top: '#2a3458', foot: '#222c4e', streak: '#10162c', seed: 11, crown: '#27403a' });
    paintBamboo(ctx, g, rand);
    return c;
  }

  // ---- river -------------------------------------------------------------

  function paintWater(g, world) {
    const hz = Math.ceil(g.H * HORIZON);
    const h = Math.ceil(g.H) - hz + 1;
    const pad = Math.ceil(g.U * 4);
    const c = layer(g.W + pad * 2, h);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(0, 0);
    ctx.scale(1, -1);
    ctx.drawImage(world, 0, 0, world.width, world.height, 0, -world.height, g.W + pad * 2, world.height);
    ctx.restore();
    const tint = ctx.createLinearGradient(0, 0, 0, h);
    tint.addColorStop(0, 'rgba(16,22,44,0.2)');
    tint.addColorStop(1, 'rgba(8,12,26,0.55)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, c.width, h);
    const rand = K.rng(52);
    ctx.fillStyle = '#8a98c0';
    for (let i = 0; i < g.W * 0.9; i++) {
      const y = Math.floor(rand() * h);
      ctx.globalAlpha = 0.05 + rand() * 0.1;
      ctx.fillRect(rand() * c.width, y, g.U * (1 + rand() * 3), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function drawWater(ctx, g, t) {
    const water = state.water;
    const hz = Math.ceil(g.H * HORIZON);
    const pad = Math.ceil(g.U * 4);
    const rows = water.height;
    for (let r = 0; r < rows; r += ROW_STEP) {
      const depth = 0.25 + r / rows;
      const dx = Math.sin(t * 0.8 + r * 0.33) * g.U * 0.9 * depth + Math.sin(t * 0.37 + r * 0.11) * g.U * 0.6 * depth;
      ctx.drawImage(water, pad - dx, r, g.W, ROW_STEP, 0, hz + r, g.W, ROW_STEP);
    }
  }

  // A broken column of moonlight under the moon.
  function drawMoonlight(ctx, g, t) {
    const mx = g.W * MOON.x;
    const hz = g.H * HORIZON;
    ctx.fillStyle = '#e2d8ac';
    for (let k = 0; k < 14; k++) {
      const y = hz + g.U * (1.5 + k * 2.6);
      const w = g.U * (7 - k * 0.35) * (0.6 + 0.4 * Math.sin(t * 1.1 + k * 1.7));
      ctx.globalAlpha = 0.5 - k * 0.025;
      ctx.fillRect(mx - w / 2 + Math.sin(t * 0.6 + k) * g.U, y, Math.max(1, w), Math.max(1, g.U * 0.7));
    }
    ctx.globalAlpha = 1;
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const dens = (x, y) => fbm(x * 0.012, y * 0.09, 4, 31);
    for (let y = 0; y < c.height; y++) {
      const band = Math.pow(Math.sin(((y + 0.5) / c.height) * Math.PI), 1.3);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(dens(x, y), dens(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 176;
        img.data[i + 1] = 186;
        img.data[i + 2] = 208;
        img.data[i + 3] = smoothstep(0.42, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mist;
    const bands = [
      { y: HORIZON - 0.2, speed: 0.9, alpha: 0.7 },
      { y: HORIZON - 0.09, speed: -1.5, alpha: 0.7 },
      { y: HORIZON + 0.02, speed: 1.2, alpha: 0.55 },
    ];
    for (const b of bands) {
      const off = -(((t * b.speed * g.U) % m.width) + m.width) % m.width;
      ctx.globalAlpha = Math.min(1, b.alpha * amount);
      ctx.drawImage(m, off, g.H * b.y);
      ctx.drawImage(m, off + m.width, g.H * b.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- rafts -------------------------------------------------------------

  function paintRaft(u, flip) {
    const w = Math.ceil(23 * u);
    const h = Math.ceil(17 * u);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const wl = h - 1.6 * u;
    if (flip) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    // Three rows of poles with a lifted prow on the right.
    const rowH = Math.max(1.3, 0.9 * u);
    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = r === 1 ? '#c8bd78' : '#a39c5c';
      const y = wl - 0.4 * u + r * rowH * 0.8;
      ctx.fillRect(1.5 * u, y, 18 * u, rowH);
      ctx.fillRect(19.5 * u, y - 0.6 * u * (r + 1), 1.4 * u, rowH);
    }
    ctx.fillStyle = '#3e4230';
    for (let n = 0; n < 7; n++) ctx.fillRect(3 * u + n * 2.6 * u, wl - 0.4 * u, Math.max(1, 0.4 * u), 2.4 * u);
    // Tall lamp pole at the prow, short one at the stern.
    const poleX = 17 * u;
    const poleTop = wl - 12.5 * u;
    ctx.fillStyle = '#1a1c24';
    ctx.fillRect(poleX, poleTop, Math.max(1, 0.7 * u), 12.2 * u);
    ctx.fillRect(poleX, poleTop, 3.4 * u, Math.max(1, 0.6 * u));
    ctx.fillRect(4 * u, wl - 6 * u, Math.max(1, 0.6 * u), 5.8 * u);
    ctx.fillRect(4 * u, wl - 6 * u, 2.4 * u, Math.max(1, 0.5 * u));
    const lamps = [paintLamp(ctx, 19.7 * u, poleTop + 0.7 * u, u, '#c4472e', '#f0c870'), paintLamp(ctx, 6.1 * u, wl - 5.4 * u, u * 0.7, '#c9a040', '#f2dca0')];
    return { canvas: c, wl, lamps: lamps.map((p) => ({ x: flip ? w - p.x : p.x, y: p.y })) };
  }

  function paintLamp(ctx, x, y, u, shell, core) {
    ctx.fillStyle = '#1a1c24';
    ctx.fillRect(x, y, Math.max(1, 0.4 * u), 1.1 * u);
    const top = y + 1.1 * u;
    const bw = 2.6 * u;
    const bh = 3.2 * u;
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(x, top + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(x, top + bh / 2, bw * 0.28, bh * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1c24';
    ctx.fillRect(x - bw * 0.3, top - 0.2 * u, bw * 0.6, Math.max(1, 0.5 * u));
    ctx.fillRect(x - bw * 0.3, top + bh - 0.2 * u, bw * 0.6, Math.max(1, 0.5 * u));
    return { x, y: top + bh / 2 };
  }

  function paintGlow() {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(244,196,110,0.7)');
    grad.addColorStop(0.35, 'rgba(226,150,80,0.28)');
    grad.addColorStop(1, 'rgba(226,150,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function makeRafts(g) {
    return RAFTS.map((spec) => {
      const u = g.U * spec.scale;
      const art = paintRaft(u, spec.dir < 0);
      return { spec, u, art, span: g.W + art.canvas.width * 2 };
    });
  }

  function drawRaft(ctx, g, t, raft, index, glow) {
    const { spec, art, u, span } = raft;
    const travel = (t * spec.speed * g.U * 0.5 + spec.phase * span) % span;
    const x = (spec.dir > 0 ? travel : span - travel) - art.canvas.width;
    const bob = Math.sin(t * 0.9 + index * 2) * 0.3 * u;
    const base = g.H * spec.y + bob;
    const sy = base - art.wl;
    const cw = art.canvas.width;
    const ch = art.canvas.height;
    // Reflection: the sprite flipped about the waterline.
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.translate(x, base + art.wl - ch + ch);
    ctx.scale(1, -1);
    ctx.drawImage(art.canvas, 0, 0, cw, art.wl, 0, -art.wl + (ch - art.wl) * 0, cw, art.wl);
    ctx.restore();
    ctx.globalAlpha = 1;
    // Columns of light under each lamp.
    for (let l = 0; l < art.lamps.length; l++) {
      const lamp = art.lamps[l];
      const lx = x + lamp.x;
      const reach = (l === 0 ? 7 : 4.5) * u;
      const flick = 0.82 + 0.18 * Math.sin(t * 2.3 + index * 1.7 + l * 2.1) * Math.sin(t * 0.7 + index);
      ctx.fillStyle = l === 0 ? '#e8b56a' : '#e6cf90';
      for (let k = 0; k < 7; k++) {
        const wob = Math.sin(t * 1.8 + k * 1.3 + index * 2 + l) * 0.5 * u;
        const w = Math.max(1, (2.6 - k * 0.3) * u * (0.7 + 0.3 * Math.sin(t * 2.4 + k * 1.9 + index)));
        ctx.globalAlpha = Math.max(0, (0.5 - k * 0.06) * flick * glow);
        ctx.fillRect(lx - w / 2 + wob, base + 0.8 * u + (k * reach) / 7, w, Math.max(1, 0.55 * u));
      }
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(art.canvas, x, sy);
    // Glow around the lamps.
    for (let l = 0; l < art.lamps.length; l++) {
      const lamp = art.lamps[l];
      const flick = 0.82 + 0.18 * Math.sin(t * 2.3 + index * 1.7 + l * 2.1) * Math.sin(t * 0.7 + index);
      const size = (l === 0 ? 13 : 8) * u * (0.95 + 0.05 * flick);
      ctx.globalAlpha = Math.min(1, 0.85 * flick * glow);
      ctx.drawImage(state.glow, x + lamp.x - size / 2, sy + lamp.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // ---- frame -------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.world = paintWorld(g);
    state.water = paintWater(g, state.world);
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2));
    state.glow = paintGlow();
    state.rafts = makeRafts(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.world, 0, 0);
    drawMist(ctx, g, t, props.mist * 0.6);
    drawWater(ctx, g, t);
    drawMoonlight(ctx, g, t);
    const count = clamp(Math.round(props.rafts), 1, state.rafts.length);
    const order = [0, 2, 1, 3];
    for (let i = 0; i < count; i++) {
      const idx = order[i];
      drawRaft(ctx, g, t, state.rafts[idx], idx, props.glow);
    }
    drawMist(ctx, g, t + 40, props.mist * 0.4);
  }

  Kasuri.run({
    defaults: { mist: 1, glow: 1, rafts: 4, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
