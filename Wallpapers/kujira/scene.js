/*
 * 鯨 Kujira — a humpback and her calf gliding through deep blue water, seen from below.
 *
 * Each whale is baked once and drawn as a stack of thin vertical slices, so a
 * slow wave can run down to the flukes for the price of a few dozen drawImage calls.
 * The water, light shafts and rippling surface are baked sprites that drift; only the shoal is live.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const SLICES = 64;
  const CALF_SLICES = 30;
  const MOTES = 70;
  const MAX_FISH = 420;
  const SHAFTS = [
    { a: 0.56, w: 21, rate: 0.071, phase: 0.4, peak: 0.24 },
    { a: 0.39, w: 14, rate: 0.113, phase: 2.1, peak: 0.3 },
    { a: 0.23, w: 26, rate: 0.057, phase: 4.0, peak: 0.26 },
    { a: 0.05, w: 16, rate: 0.097, phase: 1.2, peak: 0.34 },
    { a: -0.14, w: 24, rate: 0.083, phase: 5.2, peak: 0.28 },
    { a: -0.28, w: 13, rate: 0.127, phase: 3.1, peak: 0.3 },
    { a: -0.44, w: 20, rate: 0.063, phase: 0.9, peak: 0.24 },
  ];
  // Body outline as [position along the body, offset from the spine], in body lengths.
  const BACK = [[0, 0.016], [0.012, -0.012], [0.04, -0.03], [0.08, -0.04], [0.14, -0.052], [0.19, -0.078], [0.26, -0.092], [0.35, -0.105],
    [0.45, -0.11], [0.55, -0.105], [0.62, -0.096], [0.7, -0.074], [0.78, -0.048], [0.85, -0.028], [0.9, -0.018]];
  const BELLY = [[0, 0.016], [0.012, 0.046], [0.05, 0.08], [0.12, 0.112], [0.2, 0.142], [0.28, 0.158], [0.36, 0.16],
    [0.44, 0.15], [0.52, 0.128], [0.6, 0.102], [0.7, 0.07], [0.78, 0.046], [0.85, 0.028], [0.9, 0.018]];
  const MOUTH = [[0, 0.016], [0.06, 0.016], [0.12, 0.014], [0.18, 0.016], [0.22, 0.03], [0.245, 0.05], [0.42, 0.083], [0.6, 0.102], [0.9, 0.102]];
  const HIDE = ['#86aebc', '#3d546a', '#4a6378', '#5c768a', '#74909e'];
  const PALE = ['#c9d3cb', '#d7dccd', '#b9c8c4', '#9fb6bd'];
  const SILVER = ['#9cc8d0', '#b6d6d4', '#cce0d6', '#e0e8d8'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Catmull-Rom through unevenly spaced keys.
  function curve(keys, u) {
    const n = keys.length - 1;
    let i = 0;
    while (i < n - 1 && u > keys[i + 1][0]) i++;
    const a = keys[Math.max(0, i - 1)];
    const b = keys[i];
    const c = keys[i + 1];
    const d = keys[Math.min(n, i + 2)];
    const span = c[0] - b[0];
    const s = Math.min(1, Math.max(0, (u - b[0]) / span));
    const m0 = ((c[1] - a[1]) / Math.max(1e-4, c[0] - a[0])) * span;
    const m1 = ((d[1] - b[1]) / Math.max(1e-4, d[0] - b[0])) * span;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * b[1] + (s3 - 2 * s2 + s) * m0 + (3 * s2 - 2 * s3) * c[1] + (s3 - s2) * m1;
  }

  function toneTable(stops, count) {
    const rgb = stops.map(K.parseColor);
    const table = [];
    for (let i = 0; i < count; i++) {
      const f = (i / (count - 1)) * (rgb.length - 1);
      const k = Math.min(rgb.length - 2, Math.floor(f));
      const m = f - k;
      table.push([lerp(rgb[k][0], rgb[k + 1][0], m), lerp(rgb[k][1], rgb[k + 1][1], m), lerp(rgb[k][2], rgb[k + 1][2], m)]);
    }
    return table;
  }

  function buildShape(L) {
    const w = Math.ceil(L * 1.03);
    const h = Math.ceil(L * 0.62);
    const base = h * 0.46;
    const spine = (u) => base + L * (0.09 * (u - 0.45) - 0.02 * Math.sin(Math.PI * Math.min(1, u)));
    const top = new Float32Array(w);
    const bot = new Float32Array(w);
    const seam = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      const u = Math.min(0.9, x / L);
      const c = spine(u);
      top[x] = c + curve(BACK, u) * L;
      bot[x] = c + curve(BELLY, u) * L;
      seam[x] = Math.min(bot[x], c + curve(MOUTH, u) * L);
    }
    return { L, w, h, spine, top, bot, seam };
  }

  function paintHide(shape, seed) {
    const { L, w, h, top, bot, seam } = shape;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const dark = toneTable(HIDE, 9);
    const pale = toneTable(PALE, 6);
    const f = 22 / L;
    const end = Math.floor(L * 0.9);
    for (let x = 0; x < Math.min(w, end); x++) {
      const y0 = Math.max(0, Math.floor(top[x]) - 1);
      const y1 = Math.min(h - 1, Math.ceil(bot[x]) + 1);
      for (let y = y0; y <= y1; y++) {
        const cover = Math.min(1, Math.min(y + 0.5 - top[x], bot[x] - y - 0.5) + 0.5);
        if (cover <= 0) continue;
        const mottle = fbm(x * f, y * f * 1.7, 3, seed);
        const v = Math.max(0, (y - top[x]) / Math.max(1, bot[x] - top[x]));
        const throat = y > seam[x] + (mottle - 0.5) * L * 0.035;
        const w2 = (y - seam[x]) / Math.max(1, bot[x] - seam[x]);
        let tone;
        if (throat) tone = pale[Math.round(Math.max(0, Math.min(1, w2)) * 5)];
        else tone = dark[Math.min(8, Math.round(Math.min(1, v * 1.15) * 8) + (mottle > 0.64 && v > 0.14 ? 2 : 0))];
        const i = (y * w + x) * 4;
        img.data[i] = tone[0];
        img.data[i + 1] = tone[1];
        img.data[i + 2] = tone[2];
        img.data[i + 3] = cover * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintFlukes(ctx, shape) {
    const { L, spine } = shape;
    const c = spine(0.9);
    const x0 = L * 0.885;
    ctx.fillStyle = '#3d546a';
    ctx.beginPath();
    ctx.moveTo(x0, c - L * 0.02);
    ctx.bezierCurveTo(L * 0.92, c - L * 0.04, L * 0.955, c - L * 0.06, L * 1.02, c - L * 0.082);
    ctx.bezierCurveTo(L * 1.0, c - L * 0.05, L * 0.975, c - L * 0.02, L * 0.945, c + L * 0.002);
    ctx.lineTo(x0, c + L * 0.01);
    ctx.fill();
    ctx.fillStyle = '#5c768a';
    ctx.beginPath();
    ctx.moveTo(x0, c + L * 0.02);
    ctx.bezierCurveTo(L * 0.915, c + L * 0.05, L * 0.93, c + L * 0.11, L * 0.985, c + L * 0.155);
    ctx.bezierCurveTo(L * 1.015, c + L * 0.09, L * 0.99, c + L * 0.03, L * 0.945, c - L * 0.002);
    ctx.lineTo(x0, c - L * 0.01);
    ctx.fill();
    ctx.fillStyle = '#b9c8c4';
    ctx.beginPath();
    ctx.moveTo(L * 0.95, c + L * 0.03);
    ctx.quadraticCurveTo(L * 0.955, c + L * 0.09, L * 0.985, c + L * 0.138);
    ctx.quadraticCurveTo(L * 1.0, c + L * 0.08, L * 0.95, c + L * 0.03);
    ctx.fill();
  }

  function paintDorsal(ctx, shape) {
    const { L, top } = shape;
    const at = (u) => top[Math.floor(u * L)];
    ctx.fillStyle = '#3d546a';
    ctx.beginPath();
    ctx.moveTo(L * 0.585, at(0.585) + L * 0.006);
    ctx.quadraticCurveTo(L * 0.615, at(0.61) - L * 0.012, L * 0.635, at(0.63) - L * 0.026);
    ctx.quadraticCurveTo(L * 0.64, at(0.64) - L * 0.008, L * 0.665, at(0.665) + L * 0.006);
    ctx.fill();
  }

  function paintPleats(ctx, shape, count) {
    const { L, bot, seam } = shape;
    const u0 = 0.018;
    const u1 = 0.585;
    ctx.strokeStyle = '#34485c';
    ctx.lineWidth = Math.max(0.8, L * 0.0058);
    ctx.lineCap = 'round';
    for (let j = 1; j <= count; j++) {
      const f = j / (count + 1);
      const end = lerp(u1, u1 * 0.86, Math.abs(f - 0.5) * 2);
      ctx.beginPath();
      for (let u = u0; u <= end; u += 0.012) {
        const x = Math.floor(u * L);
        const y = lerp(seam[x], bot[x], f);
        if (u === u0) ctx.moveTo(u * L, y);
        else ctx.lineTo(u * L, y);
      }
      ctx.stroke();
    }
  }

  function paintHead(ctx, shape, rand) {
    const { L, top, seam } = shape;
    ctx.strokeStyle = '#1f2f42';
    ctx.lineWidth = Math.max(1, L * 0.007);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let u = 0.004; u <= 0.25; u += 0.008) {
      const x = Math.floor(u * L);
      if (u === 0.004) ctx.moveTo(u * L, seam[x]);
      else ctx.lineTo(u * L, seam[x]);
    }
    ctx.stroke();
    const ex = Math.floor(L * 0.268);
    const ey = seam[ex] - L * 0.016;
    ctx.fillStyle = '#b9c8c4';
    ctx.beginPath();
    ctx.ellipse(ex, ey, L * 0.015, L * 0.01, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#121a26';
    ctx.beginPath();
    ctx.arc(ex, ey, L * 0.0075, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#9fb6bd';
    const knob = Math.max(0.6, L * 0.0042);
    for (let i = 0; i < 16; i++) {
      const u = 0.025 + rand() * 0.17;
      const x = Math.floor(u * L);
      ctx.fillRect(u * L, top[x] + rand() * L * 0.018, knob, knob);
    }
    ctx.fillStyle = '#e6ead6';
    for (let i = 0; i < 12; i++) {
      const u = 0.02 + rand() * 0.07;
      const x = Math.floor(u * L);
      ctx.fillRect(u * L, seam[x] + rand() * L * 0.03, knob, knob);
    }
  }

  function paintScars(ctx, shape, rand) {
    const { L, top, seam } = shape;
    ctx.strokeStyle = '#7f9aa8';
    ctx.lineWidth = Math.max(0.6, L * 0.003);
    for (let i = 0; i < 9; i++) {
      const u = 0.3 + rand() * 0.45;
      const x = Math.floor(u * L);
      const y = lerp(top[x], seam[x], 0.15 + rand() * 0.6);
      ctx.beginPath();
      ctx.moveTo(u * L, y);
      ctx.lineTo(u * L + L * (0.01 + rand() * 0.03), y + L * (rand() - 0.3) * 0.012);
      ctx.stroke();
    }
  }

  function paintWhale(L, seed, pleats) {
    const rand = K.rng(seed);
    const shape = buildShape(L);
    const c = layer(shape.w, shape.h);
    const ctx = c.getContext('2d');
    paintFlukes(ctx, shape);
    paintDorsal(ctx, shape);
    ctx.drawImage(paintHide(shape, seed), 0, 0);
    paintPleats(ctx, shape, pleats);
    paintHead(ctx, shape, rand);
    paintScars(ctx, shape, rand);
    return { canvas: c, shape, L };
  }

  function edgePoint(len, s, side) {
    const width = len * 0.15 * Math.pow(Math.sin(Math.pow(s, 0.62) * Math.PI * 0.97 + 0.1), 0.8) * (1 - s * 0.25);
    const spine = len * 0.14 * s * s;
    if (side < 0) return spine - width * 0.62 - Math.abs(Math.sin(s * 22)) * len * 0.012 * (1 - s * 0.6);
    return spine + width * 0.38;
  }

  // A long pectoral fin, root at the left of the sprite, leading edge up.
  function paintFin(len, pale, dark) {
    const pad = Math.ceil(len * 0.2);
    const c = layer(len + pad * 0.3, len * 0.5);
    const ctx = c.getContext('2d');
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(0, pad + edgePoint(len, 0, -1));
      for (let s = 0.02; s <= 1; s += 0.02) ctx.lineTo(s * len, pad + edgePoint(len, s, -1));
      for (let s = 1; s >= 0; s -= 0.04) ctx.lineTo(s * len, pad + edgePoint(len, s, 1));
    };
    trace();
    ctx.fillStyle = pale;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, len * 0.14, c.height);
    ctx.globalAlpha = 0.6;
    ctx.fillRect(len * 0.14, 0, len * 0.09, c.height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.6, len * 0.012);
    for (const f of [-0.28, 0.08]) {
      ctx.beginPath();
      for (let s = 0.2; s <= 0.92; s += 0.04) {
        const mid = lerp(edgePoint(len, s, -1), edgePoint(len, s, 1), 0.5 + f);
        if (s === 0.2) ctx.moveTo(s * len, pad + mid);
        else ctx.lineTo(s * len, pad + mid);
      }
      ctx.stroke();
    }
    ctx.restore();
    return { canvas: c, pad };
  }

  function paintWater(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const water = ctx.createLinearGradient(0, 0, 0, g.H);
    water.addColorStop(0, '#9accd0');
    water.addColorStop(0.2, '#74b4c6');
    water.addColorStop(0.55, '#4286b2');
    water.addColorStop(1, '#265488');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, g.W, g.H);
    const glow = ctx.createRadialGradient(state.sun.x, 0, 0, state.sun.x, 0, g.H * 0.7);
    glow.addColorStop(0, 'rgba(226,236,214,0.75)');
    glow.addColorStop(0.3, 'rgba(160,210,214,0.3)');
    glow.addColorStop(1, 'rgba(120,180,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    paintRidge(ctx, g, 0.86, 0.16, [58, 118, 168], 7, 0.016);
    paintRidge(ctx, g, 0.93, 0.2, [40, 86, 140], 13, 0.03);
    return c;
  }

  function paintRidge(ctx, g, level, rise, tone, seed, freq) {
    const f = freq * (100 / g.H);
    const top = g.H * (level - rise);
    const fall = ctx.createLinearGradient(0, top, 0, g.H);
    fall.addColorStop(0, `rgba(${tone[0]},${tone[1]},${tone[2]},0.75)`);
    fall.addColorStop(0.55, `rgb(${tone[0]},${tone[1]},${tone[2]})`);
    fall.addColorStop(1, `rgb(${tone[0] * 0.8},${tone[1] * 0.8},${tone[2] * 0.85})`);
    ctx.fillStyle = fall;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const edge = Math.pow(Math.abs(x / g.W - 0.5) * 2, 2);
      ctx.lineTo(x, g.H * (level - rise * edge * 0.9 - (fbm(x * f, seed, 5, seed) - 0.5) * rise * 1.5));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintShaft(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const across = ctx.createLinearGradient(0, 0, w, 0);
    across.addColorStop(0, 'rgba(176,220,222,0)');
    across.addColorStop(0.5, 'rgba(204,230,222,1)');
    across.addColorStop(1, 'rgba(176,220,222,0)');
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const down = ctx.createLinearGradient(0, 0, 0, h);
    down.addColorStop(0, 'rgba(0,0,0,1)');
    down.addColorStop(0.65, 'rgba(0,0,0,0.75)');
    down.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = down;
    ctx.fillRect(0, 0, w, h);
    return c;
  }

  // Ripples are wide near the top and squeeze together as the surface recedes.
  function paintSurface(w, h, seed, peak, g) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const fx = 6 / g.H;
    const line = (x, y) => {
      const ny = Math.pow(y / h, 0.6) * 13;
      return 1 - Math.abs(fbm(x * fx, ny, 3, seed) * 2 - 1);
    };
    for (let y = 0; y < h; y++) {
      const fade = 1 - smoothstep(0.1, 1, y / h);
      for (let x = 0; x < w; x++) {
        const v = lerp(line(x, y), line(x - w, y), x / w);
        const lit = Math.round(smoothstep(0.78, 0.97, v) * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 236;
        img.data[i + 2] = 216;
        img.data[i + 3] = lit * fade * peak;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeFish(rand) {
    const count = MAX_FISH;
    const fish = {
      ox: new Float32Array(count),
      oy: new Float32Array(count),
      size: new Float32Array(count),
      phase: new Float32Array(count),
    };
    for (let i = 0; i < count; i++) {
      const a = rand() * 6.283;
      const d = Math.pow(rand(), 0.62);
      fish.ox[i] = Math.cos(a) * d;
      fish.oy[i] = Math.sin(a) * d * (0.55 + 0.45 * Math.cos(a * 2 + 1));
      fish.size[i] = 0.7 + rand() * 0.6;
      fish.phase[i] = rand() * 6.283;
    }
    return fish;
  }

  function makeMotes(g, rand) {
    const motes = [];
    for (let i = 0; i < MOTES; i++) {
      motes.push({
        x: rand() * g.W,
        y: rand() * g.H,
        rate: g.U * (0.25 + rand() * 0.6),
        size: Math.max(1, g.U * (0.4 + rand() * rand() * 0.8)),
        phase: rand() * 6.283,
        alpha: 0.18 + rand() * 0.3,
      });
    }
    return motes;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const L = Math.min(g.W * 0.84, g.U * 150);
    state.g = g;
    state.L = L;
    state.sun = { x: g.W * 0.58, y: -g.H * 0.8 };
    state.fan = Math.min(1.6, Math.max(0.8, g.W / g.H / 1.53));
    state.water = paintWater(g);
    state.shaft = paintShaft(Math.ceil(g.U * 16), Math.ceil(g.H * 2.1));
    const sw = Math.ceil(g.W * 1.5);
    const sh = Math.ceil(g.H * 0.22);
    state.surfaceA = paintSurface(sw, sh, 31, 235, g);
    state.surfaceB = paintSurface(sw, sh, 47, 170, g);
    state.mother = paintWhale(L, 3, 8);
    state.calf = paintWhale(L * 0.38, 17, 4);
    state.finNear = paintFin(L * 0.34, '#d7dccd', '#3a5066');
    state.finFar = paintFin(L * 0.24, '#7fa8b8', '#4a6378');
    state.calfFin = paintFin(L * 0.38 * 0.32, '#d7dccd', '#3a5066');
    state.fish = makeFish(rand);
    state.motes = makeMotes(g, rand);
  }

  function drawShafts(ctx, g, t, amount) {
    if (amount <= 0) return;
    const { sun, shaft } = state;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of SHAFTS) {
      const breathe = 0.5 + 0.5 * Math.sin(t * s.rate * 2 + s.phase);
      ctx.globalAlpha = Math.min(1, s.peak * amount * (0.35 + 0.65 * breathe));
      ctx.save();
      ctx.translate(sun.x, sun.y);
      ctx.rotate((s.a + Math.sin(t * s.rate + s.phase) * 0.024) * state.fan);
      ctx.drawImage(shaft, (-s.w * g.U) / 2, 0, s.w * g.U, shaft.height);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawSurface(ctx, g, t) {
    const a = state.surfaceA;
    const w = a.width;
    const xa = -w + ((t * g.U * 0.9) % w);
    const xb = -((t * g.U * 0.55) % w);
    ctx.drawImage(a, xa, 0);
    ctx.drawImage(a, xa + w, 0);
    ctx.drawImage(state.surfaceB, xb, 0);
    ctx.drawImage(state.surfaceB, xb + w, 0);
  }

  function drawMotes(ctx, g, t) {
    ctx.fillStyle = '#cfe0d6';
    for (const m of state.motes) {
      const x = (m.x + t * m.rate) % g.W;
      ctx.globalAlpha = m.alpha;
      ctx.fillRect(x, m.y + Math.sin(t * 0.13 + m.phase) * g.U, m.size, m.size);
    }
    ctx.globalAlpha = 1;
  }

  // The slow travelling bend, in cells: nothing at the head, most at the flukes.
  function bend(u, t, reach, pitch, phase) {
    const weight = smoothstep(0.3, 1, u);
    return Math.sin(t * 0.46 + phase - u * 2.6) * reach * weight * weight + pitch * (u - 0.3);
  }

  function drawSlices(ctx, whale, x, y, t, slices, reach, pitch, phase) {
    const c = whale.canvas;
    const sw = c.width / slices;
    for (let i = 0; i < slices; i++) {
      const sx = i * sw;
      const off = bend((i + 0.5) / slices, t, reach, pitch, phase);
      ctx.drawImage(c, sx, 0, sw + 1, c.height, x + sx, y + off, sw + 1, c.height);
    }
  }

  function drawFin(ctx, fin, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1, -1);
    ctx.drawImage(fin.canvas, 0, -fin.pad);
    ctx.restore();
  }

  function drawMother(ctx, g, t) {
    const L = state.L;
    const m = state.mother;
    const x = (g.W - L * 1.02) / 2 + Math.sin(t * 0.031) * g.U * 2;
    const y = g.H * 0.46 - m.shape.h * 0.46 + Math.sin(t * 0.09) * g.U * 1.1;
    const pitch = Math.sin(t * 0.057) * g.U * 1.6;
    const rootOff = bend(0.27, t, g.U * 6, pitch, 0);
    const rootX = x + L * 0.27;
    const rootY = y + m.shape.spine(0.27) + rootOff;
    drawFin(ctx, state.finFar, x + L * 0.2, rootY + L * 0.09, 1.2 + Math.sin(t * 0.16) * 0.05);
    drawSlices(ctx, m, x, y, t, SLICES, g.U * 6, pitch, 0);
    drawFin(ctx, state.finNear, rootX, rootY + L * 0.085, 0.85 + Math.sin(t * 0.19) * 0.06);
  }

  function drawCalf(ctx, g, t) {
    const c = state.calf;
    const x = g.W * 0.56 + Math.sin(t * 0.043 + 1) * g.U * 2.5;
    const y = g.H * 0.8 - c.shape.h * 0.46 + Math.sin(t * 0.12 + 2) * g.U * 1.2;
    const pitch = Math.sin(t * 0.08 + 1) * g.U;
    const off = bend(0.27, t * 1.5, g.U * 3.4, pitch, 1.1);
    drawSlices(ctx, c, x, y, t * 1.5, CALF_SLICES, g.U * 3.4, pitch, 1.1);
    drawFin(ctx, state.calfFin, x + c.L * 0.27, y + c.shape.spine(0.27) + off + c.L * 0.085, 0.8 + Math.sin(t * 0.3) * 0.1);
  }

  function drawShoal(ctx, g, t, amount) {
    const fish = state.fish;
    const count = Math.min(MAX_FISH, Math.round((MAX_FISH / 2) * amount));
    const cx = g.W * 0.2 + Math.sin(t * 0.047) * g.U * 5;
    const cy = g.H * 0.8 + Math.sin(t * 0.067) * g.U * 2.5;
    const a = g.U * 23;
    const b = g.U * 13;
    const turn = Math.sin(t * 0.11) * 0.7;
    const cr = Math.cos(turn);
    const sr = Math.sin(turn);
    const h = Math.max(1, g.U * 0.6);
    let last = -1;
    for (let i = 0; i < count; i++) {
      const ox = fish.ox[i] + Math.sin(t * 0.31 + fish.phase[i]) * 0.05;
      const oy = fish.oy[i] + Math.cos(t * 0.27 + fish.phase[i]) * 0.07;
      const side = Math.abs(Math.cos(t * 0.21 - fish.ox[i] * 1.5 + fish.oy[i] * 0.5));
      const shade = Math.min(3, Math.floor(side * side * 4));
      if (shade !== last) ctx.fillStyle = SILVER[shade];
      last = shade;
      const len = Math.max(1.4, (0.6 + side * 1.2) * g.U * fish.size[i]);
      const sway = Math.sin(ox * 2.2 + t * 0.09) * b * 0.35;
      const y = Math.round(cy + ox * a * sr * 0.6 + oy * b * cr + sway);
      ctx.fillRect(cx + ox * a * cr - oy * b * sr - len / 2, y, len, h);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.water, 0, 0);
    drawShafts(ctx, g, t, api.props.light);
    drawSurface(ctx, g, t);
    drawMotes(ctx, g, t);
    drawMother(ctx, g, t);
    drawCalf(ctx, g, t);
    drawShafts(ctx, g, t + 40, api.props.light * 0.22);
    drawShoal(ctx, g, t, api.props.shoal);
  }

  Kasuri.run({
    defaults: { light: 1, shoal: 1, ramp: 'lines', cell: 7, boost: 0.14, gain: 1.12, dither: 0.6 },
    maxFps: 20,
    setup,
    draw,
  });
})();
