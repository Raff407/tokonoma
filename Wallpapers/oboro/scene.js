/*
 * 朧月 Oboro — a hazy spring moon behind thin clouds over a quiet river.
 *
 * Sky, moon, hills, banks and the boat are baked once. The river is that baked
 * world flipped and laid back in thin rows that sway sideways. Per frame only
 * two tiling cloud strips, a column of moon glints, willow strands and a few
 * petals move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.64;
  const MOON = { x: 0.64, y: 0.27, r: 6.5 };
  const SKY = ['#141a30', '#1c2540', '#27324f', '#36405c', '#4a5068'];
  const STRANDS = 34;
  const GLINTS = 22;
  const MAX_PETALS = 14;
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
    const U = H / 100;
    const wy = Math.round(H * WATER);
    return { W, H, U, wy, mx: W * MOON.x, my: H * MOON.y, mr: U * MOON.r };
  }

  // ---- sky ---------------------------------------------------------------

  function paintSkyGradient(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    SKY.forEach((ink, i) => grad.addColorStop(i / (SKY.length - 1), ink));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy);
  }

  // The haze around the moon is the point of the scene: a wide soft ring.
  function paintHalo(ctx, g) {
    const r = g.mr * 7;
    const halo = ctx.createRadialGradient(g.mx, g.my, g.mr * 0.8, g.mx, g.my, r);
    halo.addColorStop(0, 'rgba(232,214,168,0.75)');
    halo.addColorStop(0.18, 'rgba(208,186,140,0.45)');
    halo.addColorStop(0.45, 'rgba(150,140,130,0.2)');
    halo.addColorStop(1, 'rgba(90,96,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.wy);
  }

  function paintMoon(ctx, g) {
    const disc = ctx.createRadialGradient(g.mx - g.mr * 0.3, g.my - g.mr * 0.3, 0, g.mx, g.my, g.mr);
    disc.addColorStop(0, '#f6eed6');
    disc.addColorStop(0.8, '#ecdfba');
    disc.addColorStop(1, '#dcc894');
    ctx.fillStyle = disc;
    blob(ctx, g.mx, g.my, g.mr, g.mr);
    ctx.fillStyle = 'rgba(190,176,140,0.35)';
    blob(ctx, g.mx + g.mr * 0.25, g.my - g.mr * 0.15, g.mr * 0.28, g.mr * 0.22);
    blob(ctx, g.mx - g.mr * 0.3, g.my + g.mr * 0.3, g.mr * 0.2, g.mr * 0.16);
  }

  function paintStars(ctx, g, rand) {
    ctx.fillStyle = '#d8d4c4';
    for (let i = 0; i < g.W * 0.25; i++) {
      const x = rand() * g.W;
      const y = rand() * g.wy * 0.55;
      const d = Math.hypot(x - g.mx, y - g.my) / (g.mr * 6);
      if (d < 1) continue;
      ctx.globalAlpha = 0.12 + rand() * 0.3;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- land --------------------------------------------------------------

  function ridge(g, x, base, amp, scale, seed) {
    return base - fbm(x / (g.U * scale), 0.5, 4, seed) * amp;
  }

  function paintHills(ctx, g) {
    const layers = [
      { ink: '#4a5270', base: g.wy - g.U * 6, amp: g.U * 16, scale: 34, seed: 3 },
      { ink: '#343e5a', base: g.wy - g.U * 1, amp: g.U * 10, scale: 22, seed: 9 },
    ];
    for (const L of layers) {
      ctx.fillStyle = L.ink;
      ctx.beginPath();
      ctx.moveTo(0, g.wy);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, L.base, L.amp, L.scale, L.seed));
      ctx.lineTo(g.W, g.wy);
      ctx.fill();
    }
    // A band of low mist resting on the far bank.
    const mist = ctx.createLinearGradient(0, g.wy - g.U * 7, 0, g.wy);
    mist.addColorStop(0, 'rgba(120,124,140,0)');
    mist.addColorStop(1, 'rgba(140,140,150,0.55)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, g.wy - g.U * 7, g.W, g.U * 7);
  }

  function paintFarBank(ctx, g, rand) {
    ctx.fillStyle = '#20283e';
    ctx.fillRect(0, g.wy - g.U * 0.8, g.W, g.U * 0.8 + 1);
    for (let i = 0; i < g.W / (g.U * 2); i++) {
      const x = rand() * g.W;
      ctx.fillStyle = rand() < 0.5 ? '#232c3e' : '#2a3442';
      blob(ctx, x, g.wy - g.U * 1.2, g.U * (1 + rand() * 2.2), g.U * (0.7 + rand() * 1));
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    paintSkyGradient(ctx, g);
    paintStars(ctx, g, rand);
    paintHalo(ctx, g);
    paintMoon(ctx, g);
    paintHills(ctx, g);
    paintFarBank(ctx, g, rand);
    return c;
  }

  // The baked world flipped upside down and dimmed, for the river.
  function paintReflection(g) {
    const c = layer(g.W, g.H - g.wy);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(state.back, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dim = ctx.createLinearGradient(0, 0, 0, c.height);
    dim.addColorStop(0, 'rgba(22,30,50,0.35)');
    dim.addColorStop(1, 'rgba(16,22,38,0.75)');
    ctx.fillStyle = dim;
    ctx.fillRect(0, 0, c.width, c.height);
    const rw = g.mr * 3;
    const glow = ctx.createRadialGradient(g.mx, 0, 0, g.mx, 0, c.height);
    glow.addColorStop(0, 'rgba(214,196,150,0.32)');
    glow.addColorStop(1, 'rgba(214,196,150,0)');
    ctx.setTransform(rw / c.height, 0, 0, 1, g.mx * (1 - rw / c.height), 0);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W * c.height / rw, c.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }

  // Near bank, willow trunk and a moored boat with a paper lantern.
  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a2030';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    ctx.lineTo(0, g.H * 0.8);
    for (let x = 0; x <= g.W * 0.34; x += 2) {
      const f = x / (g.W * 0.34);
      ctx.lineTo(x, lerp(g.H * 0.8, g.H * 1.02, f * f) + (fbm(x / (g.U * 5), 2, 3, 5) - 0.5) * g.U * 2);
    }
    ctx.lineTo(g.W * 0.34, g.H);
    ctx.fill();
    ctx.fillStyle = '#2c3a30';
    for (let i = 0; i < 40; i++) {
      const x = rand() * g.W * 0.3;
      const f = x / (g.W * 0.34);
      blob(ctx, x, lerp(g.H * 0.8, g.H * 1.02, f * f) - g.U * 0.3, g.U * (0.6 + rand()), g.U * (0.3 + rand() * 0.5));
    }
    paintTrunk(ctx, g);
    paintBoat(ctx, g);
    return c;
  }

  function paintTrunk(ctx, g) {
    ctx.strokeStyle = '#2a2420';
    ctx.lineCap = 'round';
    ctx.lineWidth = g.U * 2.6;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.09, g.H * 0.86);
    ctx.quadraticCurveTo(g.W * 0.07, g.H * 0.5, g.W * 0.13, g.H * 0.12);
    ctx.stroke();
    ctx.lineWidth = g.U * 1.2;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.1, g.H * 0.36);
    ctx.quadraticCurveTo(g.W * 0.18, g.H * 0.16, g.W * 0.3, g.H * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g.W * 0.12, g.H * 0.2);
    ctx.quadraticCurveTo(g.W * 0.08, g.H * 0.06, g.W * 0.02, g.H * 0.03);
    ctx.stroke();
  }

  function boatAt(g) {
    return { x: g.W * 0.82, y: g.H * 0.8, s: g.U * 1.1 };
  }

  function paintBoat(ctx, g) {
    const b = boatAt(g);
    const s = b.s;
    ctx.fillStyle = '#2a2420';
    ctx.beginPath();
    ctx.moveTo(b.x - s * 12, b.y - s * 1.6);
    ctx.quadraticCurveTo(b.x - s * 6, b.y + s * 1.6, b.x + s * 4, b.y + s * 1.2);
    ctx.lineTo(b.x + s * 11, b.y - s * 2.4);
    ctx.lineTo(b.x - s * 12, b.y - s * 1.6);
    ctx.fill();
    ctx.fillStyle = '#6e5a46';
    ctx.fillRect(b.x - s * 11, b.y - s * 2.3, s * 22, s * 0.4);
    ctx.fillStyle = '#5a4636';
    ctx.fillRect(b.x - s * 9, b.y - s * 1.9, s * 18, s * 0.5);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(b.x - s * 2, b.y - s * 8.5, s * 0.4, s * 6.8);
    ctx.fillRect(b.x - s * 2, b.y - s * 8.5, s * 3, s * 0.3);
    const lx = b.x + s * 0.8;
    const ly = b.y - s * 7;
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 6);
    glow.addColorStop(0, 'rgba(214,110,70,0.45)');
    glow.addColorStop(1, 'rgba(214,110,70,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx - s * 6, ly - s * 6, s * 12, s * 12);
    ctx.fillStyle = '#d6603c';
    blob(ctx, lx, ly, s * 0.9, s * 1.2);
    ctx.fillStyle = '#e6a070';
    blob(ctx, lx - s * 0.2, ly - s * 0.2, s * 0.4, s * 0.6);
  }

  // Thin wisps that tile sideways.
  function paintClouds(g, seed, scaleX, scaleY, alpha) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.H * 0.22);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * scaleX), y / (g.U * scaleY), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 196;
        img.data[i + 1] = 190;
        img.data[i + 2] = 176;
        img.data[i + 3] = smoothstep(0.46, 0.7, v) * band * alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- moving things -----------------------------------------------------

  function makeStrands(g, rand) {
    const n = STRANDS;
    const s = { x: new Float32Array(n), y: new Float32Array(n), len: new Float32Array(n), p: new Float32Array(n), w: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const f = rand();
      s.x[i] = lerp(g.W * 0.0, g.W * 0.3, f);
      s.y[i] = g.H * (0.04 + Math.abs(f - 0.45) * 0.14 + rand() * 0.05);
      s.len[i] = g.H * (0.22 + rand() * 0.24);
      s.p[i] = rand() * TAU;
      s.w[i] = Math.max(1, g.U * (0.4 + rand() * 0.5));
    }
    return s;
  }

  function drawStrands(ctx, g, t) {
    const s = state.strands;
    ctx.lineCap = 'round';
    for (let i = 0; i < STRANDS; i++) {
      const sway = Math.sin(t * 0.7 + s.p[i]) * g.U * 2.2 + Math.sin(t * 0.31 + i) * g.U;
      const x = s.x[i];
      const y = s.y[i];
      const L = s.len[i];
      ctx.strokeStyle = i % 3 === 0 ? '#4c6446' : '#33463a';
      ctx.lineWidth = s.w[i];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway * 0.3, y + L * 0.6, x + sway, y + L);
      ctx.stroke();
    }
  }

  function drawWater(ctx, g, t, ripple) {
    const r = state.reflection;
    const h = r.height;
    ctx.fillStyle = '#18203a';
    ctx.fillRect(0, g.wy, g.W, h);
    for (let y = 0; y < h; y++) {
      const depth = 0.3 + y / h;
      const dx = Math.sin(t * 0.9 + y * 0.55) * g.U * 0.5 * depth * ripple + Math.sin(t * 0.37 + y * 0.13) * g.U * 0.4 * ripple;
      ctx.drawImage(r, 0, y, g.W, 1, dx, g.wy + y, g.W, 1);
    }
  }

  // Broken dashes of moonlight down the river, and the lantern's own.
  function drawGlints(ctx, g, t, ripple) {
    const h = g.H - g.wy;
    ctx.fillStyle = '#e6dab4';
    for (let i = 0; i < GLINTS; i++) {
      const f = (i + 0.5) / GLINTS;
      const y = g.wy + h * f * 0.95;
      const pulse = 0.5 + 0.5 * Math.sin(t * (0.8 + (i % 5) * 0.17) + i * 2.3);
      const w = g.U * (1.5 + f * 6) * (0.4 + 0.6 * pulse);
      const dx = Math.sin(t * 0.6 + i * 1.9) * g.U * (0.6 + f * 2) * (0.4 + ripple * 0.6);
      ctx.globalAlpha = (0.25 + 0.4 * pulse) * (1 - f * 0.5);
      ctx.fillRect(g.mx + dx - w / 2, y, w, Math.max(1, g.U * 0.5));
    }
    const b = boatAt(g);
    ctx.fillStyle = '#c8603c';
    for (let k = 0; k < 4; k++) {
      const y = b.y + b.s * (3 + k * 2.2);
      const w = b.s * (2.2 - k * 0.3) * (0.7 + 0.3 * Math.sin(t * 1.1 + k));
      ctx.globalAlpha = 0.4 - k * 0.07;
      ctx.fillRect(b.x + b.s * 0.8 - w / 2 + Math.sin(t * 0.8 + k * 1.3) * b.s * 0.6, y, w, Math.max(1, b.s * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const pairs = [
      [state.cloudsA, g.U * 1.3, g.H * 0.14, 0.9],
      [state.cloudsB, g.U * 0.7, g.H * 0.02, 0.6],
    ];
    for (const [c, v, top, a] of pairs) {
      const off = -((t * v) % c.width);
      ctx.globalAlpha = Math.min(1, a * amount);
      ctx.drawImage(c, off, top);
      ctx.drawImage(c, off + c.width, top);
    }
    ctx.globalAlpha = 1;
  }

  function makePetals(g, rand) {
    const n = MAX_PETALS;
    const p = { x: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), a: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      p.x[i] = rand() * g.W;
      p.y[i] = g.wy + (g.H - g.wy) * (0.1 + rand() * 0.85);
      p.v[i] = g.U * (0.6 + rand() * 0.8);
      p.a[i] = rand() * TAU;
    }
    return p;
  }

  function drawPetals(ctx, g, t, dt) {
    const p = state.petals;
    ctx.fillStyle = '#d8c4bc';
    for (let i = 0; i < MAX_PETALS; i++) {
      const f = (p.y[i] - g.wy) / (g.H - g.wy);
      p.x[i] += p.v[i] * (0.5 + f) * dt;
      if (p.x[i] > g.W + g.U * 2) p.x[i] = -g.U * 2;
      const s = g.U * (0.4 + f * 0.7);
      const bob = Math.sin(t * 0.9 + p.a[i]) * g.U * 0.2;
      ctx.globalAlpha = 0.5 + f * 0.4;
      ctx.fillRect(p.x[i] - s, p.y[i] + bob - s * 0.35, s * 2, Math.max(1, s * 0.7));
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.reflection = paintReflection(g);
    state.front = paintFront(g, rand);
    state.cloudsA = paintClouds(g, 17, 18, 3, 170);
    state.cloudsB = paintClouds(g, 41, 26, 4, 120);
    state.strands = makeStrands(g, rand);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { clouds, ripple, petals } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t, clouds);
    drawWater(ctx, g, t, ripple);
    drawGlints(ctx, g, t, ripple);
    if (petals) drawPetals(ctx, g, t, Math.min(dt, 0.1));
    ctx.drawImage(state.front, 0, 0);
    drawStrands(ctx, g, t);
  }

  Kasuri.run({
    defaults: { clouds: 1, ripple: 1, petals: true, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
