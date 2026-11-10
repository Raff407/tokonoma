/*
 * 陽炎 Kagero — heat haze over a country road between rice fields.
 *
 * The whole world is baked once: sky, three ranges of hills, the road and its
 * paddies, a line of utility poles, and a lone camphor tree wearing its rope
 * beside a small torii. Each frame the band around the horizon is redrawn in
 * thin rows that slide sideways, which is the shimmer. Clouds are one tiling strip.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const VX = 0.46;
  const VY = 0.47;
  const ROAD = 0.2;
  const MIRAGE = 9;
  const FOG = '#e2d9bf';
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky and hills -----------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.vy);
    grad.addColorStop(0, '#8fa5b2');
    grad.addColorStop(0.6, '#c9d2cc');
    grad.addColorStop(1, '#eadfc2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.vy + 1);
    const sun = ctx.createRadialGradient(g.W * 0.8, g.H * 0.16, 0, g.W * 0.8, g.H * 0.16, g.H * 0.3);
    sun.addColorStop(0, 'rgba(244,226,168,0.75)');
    sun.addColorStop(1, 'rgba(244,226,168,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, g.W, g.vy);
  }

  function paintHills(ctx, g, rand) {
    const ranges = [
      { color: '#a4b2b3', rise: 0.2, amp: 0.1, freq: 0.012, seed: 3 },
      { color: '#85999a', rise: 0.14, amp: 0.08, freq: 0.02, seed: 7 },
      { color: '#617c6e', rise: 0.07, amp: 0.05, freq: 0.035, seed: 12 },
    ];
    for (const r of ranges) {
      ctx.fillStyle = r.color;
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x * r.freq, 1.5, 3, r.seed);
        const top = g.vy - g.H * (r.rise + (n - 0.4) * r.amp);
        ctx.fillRect(x, top, 1, g.vy - top + 2);
      }
    }
    // Cedars standing on the nearest range.
    ctx.fillStyle = '#3f5a4c';
    for (let i = 0; i < g.W / (g.U * 3.2); i++) {
      const x = rand() * g.W;
      const n = fbm(x * 0.035, 1.5, 3, 12);
      const base = g.vy - g.H * (0.07 + (n - 0.4) * 0.05) + g.U * 0.6;
      const h = g.U * (1.6 + rand() * 1.8);
      const w = h * 0.34;
      ctx.beginPath();
      ctx.moveTo(x, base - h);
      ctx.lineTo(x + w, base);
      ctx.lineTo(x - w, base);
      ctx.fill();
    }
    // Pale air lying along the foot of the hills.
    const mist = ctx.createLinearGradient(0, g.vy - g.H * 0.1, 0, g.vy + 1);
    mist.addColorStop(0, 'rgba(226,217,191,0)');
    mist.addColorStop(1, 'rgba(226,217,191,0.7)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, g.vy - g.H * 0.1, g.W, g.H * 0.1 + 1);
  }

  // ---- road and paddies --------------------------------------------------

  function hash(a, b) {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  const C = {
    road: rgb('#b6a885'),
    rut: rgb('#9c8f6e'),
    glare: rgb('#f0e8d0'),
    grass: rgb('#7d8f52'),
    verge: rgb('#6f8749'),
    water: rgb('#aebfc0'),
    sheen: rgb('#d9d8c2'),
    seed: rgb('#7c9653'),
    riceA: rgb('#6a8a45'),
    riceB: rgb('#88a45a'),
    bund: rgb('#a89c64'),
    fog: rgb(FOG),
  };

  function groundPixel(g, x, y) {
    const span = g.H - g.vy;
    const z = Math.max(0.002, (y - g.vy) / span);
    const wx = (x - g.vx) / z;
    const ax = Math.abs(wx);
    const R = g.W * ROAD;
    const noise = fbm(x * 0.35, y * 0.35, 2, 4);
    let col;
    if (ax < R) {
      col = C.road;
      if (ax > R * 0.34 && ax < R * 0.62) col = mixColor(C.road, C.rut, 0.8);
      if (ax < R * 0.12) col = mixColor(C.road, C.grass, 0.65 + noise * 0.3);
      col = mixColor(col, C.glare, Math.pow(1 - z, 1.8) * 0.55);
      col = mixColor(col, C.road, (noise - 0.5) * 0.4 + 0.2);
    } else if (ax < R * 1.28) {
      col = mixColor(C.verge, C.grass, noise);
    } else {
      const d = 1 / z;
      const gap = 0.55 * span * z * z;
      const azeN = d * 0.55;
      const a = azeN - Math.floor(azeN);
      const cell = hash(Math.floor(azeN), Math.floor(wx / (g.W * 0.5)));
      const rowW = g.W * 0.035;
      const rowPx = rowW * z;
      const f = wx / rowW - Math.floor(wx / rowW);
      const crisp = smoothstep(1.2, 3, rowPx);
      if (wx < 0) {
        col = mixColor(C.water, C.sheen, Math.pow(1 - z, 1.2) * 0.8 + cell * 0.1);
        const plant = f < 0.3 ? 1 : 0;
        const dots = mixColor(col, C.seed, 0.8);
        col = mixColor(mixColor(col, C.seed, 0.45 + cell * 0.1), plant ? dots : col, crisp);
      } else {
        const rowShade = 0.5 + 0.5 * Math.cos(f * 6.2832);
        col = mixColor(C.riceA, C.riceB, (0.35 + noise * 0.4 + (cell - 0.5) * 0.25) * (1 - crisp) + rowShade * crisp);
      }
      if (gap > 2.5 && a < Math.min(0.3, 1.3 / gap)) col = mixColor(col, C.bund, 0.85);
    }
    return mixColor(col, C.fog, Math.pow(1 - z, 2.4) * 0.8);
  }

  function paintGround(ctx, g) {
    const y0 = Math.floor(g.vy);
    const h = Math.ceil(g.H) - y0;
    const img = ctx.getImageData(0, y0, g.W, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < g.W; x++) {
        const c = groundPixel(g, x, y0 + y + 0.5);
        const i = (y * g.W + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
  }

  // ---- poles, torii and the tree -----------------------------------------

  function paintPoles(ctx, g) {
    const span = g.H - g.vy;
    const zs = [0.95, 0.55, 0.33, 0.2, 0.12, 0.07];
    const tops = [];
    ctx.fillStyle = '#4a4036';
    ctx.strokeStyle = 'rgba(58,52,48,0.7)';
    for (const z of zs) {
      const x = g.vx - g.W * 0.31 * z;
      const base = g.vy + span * z;
      const h = g.H * 0.46 * z;
      const w = Math.max(1, g.U * 0.55 * z);
      ctx.fillRect(x - w / 2, base - h, w, h);
      ctx.fillRect(x - w * 3, base - h + h * 0.06, w * 6, Math.max(1, w * 0.6));
      tops.push({ x, y: base - h + h * 0.06 });
    }
    ctx.lineWidth = Math.max(1, g.U * 0.12);
    for (let i = 0; i + 1 < tops.length; i++) {
      const a = tops[i];
      const b = tops[i + 1];
      const sag = (b.x - a.x) * 0.12;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + Math.abs(sag), b.x, b.y);
      ctx.stroke();
    }
  }

  function paintTorii(ctx, x, base, s) {
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(x - s * 1.1, base - s * 3.1, s * 0.34, s * 3.1);
    ctx.fillRect(x + s * 0.76, base - s * 3.1, s * 0.34, s * 3.1);
    ctx.fillRect(x - s * 1.0, base - s * 2.5, s * 2.0, s * 0.26);
    ctx.fillStyle = '#26221e';
    ctx.fillRect(x - s * 1.5, base - s * 3.45, s * 3.0, s * 0.36);
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(x - s * 1.4, base - s * 3.12, s * 2.8, s * 0.12);
  }

  function paintLantern(ctx, x, base, s) {
    ctx.fillStyle = '#868780';
    ctx.fillRect(x - s * 0.5, base - s * 0.4, s, s * 0.4);
    ctx.fillRect(x - s * 0.18, base - s * 1.7, s * 0.36, s * 1.3);
    ctx.fillRect(x - s * 0.5, base - s * 2.3, s, s * 0.6);
    ctx.fillStyle = '#4c4a44';
    ctx.fillRect(x - s * 0.22, base - s * 2.0, s * 0.44, s * 0.3);
    ctx.fillStyle = '#767770';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.85, base - s * 2.3);
    ctx.lineTo(x, base - s * 3);
    ctx.lineTo(x + s * 0.85, base - s * 2.3);
    ctx.fill();
  }

  function paintTree(ctx, g, rand) {
    const tx = g.W * 0.73;
    const base = g.vy + (g.H - g.vy) * 0.2;
    const T = g.H * 0.3;
    ctx.fillStyle = '#7d8f52';
    ctx.beginPath();
    ctx.ellipse(tx, base, T * 0.5, T * 0.05, 0, 0, 6.3);
    ctx.fill();
    // Trunk, a little wider at the foot.
    ctx.fillStyle = '#3b3029';
    ctx.beginPath();
    ctx.moveTo(tx - T * 0.075, base);
    ctx.lineTo(tx - T * 0.04, base - T * 0.55);
    ctx.lineTo(tx + T * 0.04, base - T * 0.55);
    ctx.lineTo(tx + T * 0.075, base);
    ctx.fill();
    // Canopy of overlapping rounded clumps, shaded dark below and lit above.
    const cy = base - T * 0.78;
    const tones = ['#2f4a34', '#3b5a3c', '#47683f'];
    for (let pass = 0; pass < 3; pass++) {
      ctx.fillStyle = tones[pass];
      for (let i = 0; i < 20; i++) {
        const a = rand() * 6.283;
        const r = Math.sqrt(rand()) * T * 0.46;
        const px = tx + Math.cos(a) * r * 1.15 - pass * T * 0.03;
        const py = cy + Math.sin(a) * r * 0.62 - pass * T * 0.06;
        ctx.beginPath();
        ctx.arc(px, py, T * (0.12 + rand() * 0.07), 0, 6.3);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#6f8c4e';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(tx - T * 0.12 + rand() * T * 0.3, cy - T * 0.25 + rand() * T * 0.14, T * 0.05, 0, 6.3);
      ctx.fill();
    }
    // The shimenawa rope round the trunk with its paper streamers.
    const ry = base - T * 0.3;
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(tx - T * 0.1, ry, T * 0.2, Math.max(1.5, T * 0.035));
    ctx.fillRect(tx - T * 0.08, ry + T * 0.035, T * 0.16, Math.max(1, T * 0.02));
    ctx.fillStyle = '#efe8d6';
    for (let i = -1; i <= 1; i++) {
      const sx = tx + i * T * 0.06;
      const w = Math.max(1, T * 0.025);
      ctx.fillRect(sx, ry + T * 0.04, w, T * 0.05);
      ctx.fillRect(sx + w * 0.8, ry + T * 0.08, w, T * 0.05);
    }
    paintLantern(ctx, tx + T * 0.28, base + T * 0.02, T * 0.1);
    paintTorii(ctx, tx - T * 0.38, base + T * 0.03, T * 0.1);
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintHills(ctx, g, rand);
    paintGround(ctx, g);
    paintPoles(ctx, g);
    paintTree(ctx, g, rand);
    return c;
  }

  // ---- sky motion and haze -----------------------------------------------

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.06, 4, 31), fbm((x - w) * 0.012, y * 0.06, 4, 31), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 248;
        img.data[i + 1] = 244;
        img.data[i + 2] = 232;
        img.data[i + 3] = smoothstep(0.54, 0.74, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintStreak() {
    const c = layer(64, 8);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 4, 0, 32, 4, 32);
    grad.addColorStop(0, 'rgba(244,236,212,0.9)');
    grad.addColorStop(1, 'rgba(244,236,212,0)');
    ctx.setTransform(1, 0, 0, 0.125, 0, 0);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function makeMirage(g, rand) {
    const m = [];
    for (let i = 0; i < MIRAGE; i++) {
      m.push({ x: g.vx + (rand() - 0.5) * g.W * 0.7, w: g.W * (0.08 + rand() * 0.1), p: rand(), r: 0.04 + rand() * 0.04 });
    }
    return m;
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.globalAlpha = Math.min(1, 0.75 * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  // The world is laid down whole, then the horizon band is redrawn row by row.
  function drawWorld(ctx, g, t, amount) {
    ctx.drawImage(state.world, 0, 0);
    if (amount <= 0) return;
    const top = Math.floor(g.vy - g.H * 0.2);
    const bottom = Math.ceil(g.vy + g.H * 0.26);
    const mid = g.vy + g.H * 0.04;
    for (let y = top; y < bottom; y++) {
      const e = (y - mid) / (g.H * (y < mid ? 0.22 : 0.24));
      const env = Math.max(0, 1 - e * e);
      const k = y * 0.37 + Math.sin(y * 0.12 + t * 0.6) * 2.2;
      const dx = (Math.sin(k + t * 1.7) + 0.5 * Math.sin(k * 1.9 - t * 1.1)) * g.U * 0.5 * env * amount;
      ctx.drawImage(state.world, 0, y, g.W, 1, dx, y, g.W, 1);
    }
  }

  function drawMirage(ctx, g, t, amount) {
    if (amount <= 0) return;
    const span = g.H - g.vy;
    for (const m of state.mirage) {
      const p = (t * m.r + m.p) % 1;
      const y = g.vy + span * 0.28 * (1 - p) + g.U * 0.5;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.22 * Math.min(1, amount);
      ctx.drawImage(state.streak, m.x + Math.sin(t * 0.5 + m.p * 9) * g.U, y, m.w, g.U * 0.9);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const g = { W, H, U: H / 100, vx: W * VX, vy: H * VY };
    const rand = K.rng(api.seed);
    state.g = g;
    state.world = paintWorld(g, rand);
    state.clouds = paintClouds(Math.ceil(W * 1.4), Math.ceil(H * 0.26));
    state.streak = paintStreak();
    state.mirage = makeMirage(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { haze, clouds } = api.props;
    drawWorld(ctx, g, t, haze);
    drawClouds(ctx, g, t, clouds);
    drawMirage(ctx, g, t, haze);
  }

  Kasuri.run({
    defaults: { haze: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
