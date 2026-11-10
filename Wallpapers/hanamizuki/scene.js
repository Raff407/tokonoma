/*
 * 花水木 Hanamizuki — a white dogwood in bloom behind a tiled temple roof.
 *
 * Sky, hills, the tree and the roof are baked once (and again on resize).
 * The tree grows from one trunk behind the ridge into flat tiers of limbs,
 * dogwood-style, each flower four notched bracts round a green-gold eye.
 * Each frame the tree layer is drawn in a few horizontal bands that lean a
 * little more the higher they sit, a cloud strip and a dapple strip slide,
 * and a short pool of bracts drifts down onto the tiles.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const TAU = Math.PI * 2;
  const RIDGE = 0.66;
  const EAVE = 0.9;
  const BANDS = 12;
  const MAX_PETALS = 30;
  const BARK = '#3a2b22';
  const BARK_LIT = '#5e4a3a';
  const BRACTS = ['#f6f2e6', '#ede7d6', '#f3ebe0'];
  const BRACT_SHADE = '#cdc8b8';
  const LEAVES = ['#6f8f52', '#557547', '#7f9a5a'];
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
    grad.addColorStop(0, '#86a7bd');
    grad.addColorStop(0.6, '#b8ccd0');
    grad.addColorStop(1, '#e2e2d0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const ranges = [['#aebfbb', 0.5, 0.16, 5], ['#8ea694', 0.58, 0.1, 9]];
    for (const [ink, base, amp, seed] of ranges) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) {
        const lean = 1 - (x / g.W) * 0.5;
        ctx.lineTo(x, g.H * base - fbm(x / (g.H * 0.5), seed, 4, seed) * g.H * amp * lean);
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
        const a = fbm(x * 0.02, y * 0.1, 4, 17);
        const b = fbm((x - w) * 0.02, y * 0.1, 4, 17);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 248;
        img.data[i + 1] = 246;
        img.data[i + 2] = 238;
        img.data[i + 3] = smoothstep(0.48, 0.68, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- tree ----------------------------------------------------------------

  // A limb as a tapered, gently wandering polyline. Returns its points.
  function limb(ctx, g, x0, y0, x1, y1, w0, w1, seed) {
    const n = 10;
    const pts = [];
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const wob = (fbm(f * 2.5, seed, 2, seed) - 0.5) * len * 0.12 * Math.sin(f * Math.PI);
      pts.push({ x: lerp(x0, x1, f), y: lerp(y0, y1, f) + wob, w: lerp(w0, w1, f) });
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      ctx.strokeStyle = BARK;
      ctx.lineWidth = Math.max(1, a.w);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (a.w > 2.5) {
        ctx.strokeStyle = BARK_LIT;
        ctx.lineWidth = Math.max(1, a.w * 0.3);
        ctx.beginPath();
        ctx.moveTo(a.x - a.w * 0.2, a.y - a.w * 0.2);
        ctx.lineTo(b.x - b.w * 0.2, b.y - b.w * 0.2);
        ctx.stroke();
      }
    }
    return pts;
  }

  function flower(ctx, x, y, r, rot, tone, shaded) {
    for (let k = 0; k < 4; k++) {
      const a = rot + k * (TAU / 4);
      const bx = x + Math.cos(a) * r * 0.55;
      const by = y + Math.sin(a) * r * 0.55;
      ctx.fillStyle = shaded ? BRACT_SHADE : tone;
      blob(ctx, bx, by, r * 0.52, r * 0.4, a);
      // the rusty notch at each bract tip
      ctx.fillStyle = '#a8664f';
      blob(ctx, x + Math.cos(a) * r * 1.02, y + Math.sin(a) * r * 1.02, r * 0.12, r * 0.12);
    }
    ctx.fillStyle = '#8e9c44';
    blob(ctx, x, y, r * 0.24, r * 0.24);
    ctx.fillStyle = '#c9ad4a';
    blob(ctx, x - r * 0.06, y - r * 0.06, r * 0.1, r * 0.1);
  }

  // Twigs rise from a limb; flowers sit flat along the top of each tier.
  function bloomLimb(ctx, g, rand, pts, count, placed) {
    const R = g.H * 0.042;
    const tips = [];
    for (let i = 2; i < pts.length; i += 1) {
      if (rand() < 0.35) continue;
      const p = pts[i];
      const dir = rand() < 0.5 ? -1 : 1;
      const tx = p.x + dir * g.H * (0.03 + rand() * 0.05);
      const ty = p.y - g.H * (0.03 + rand() * 0.05);
      ctx.strokeStyle = BARK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo((p.x + tx) / 2, p.y - g.H * 0.01, tx, ty);
      ctx.stroke();
      tips.push({ x: tx, y: ty });
    }
    const spots = [];
    for (let tries = 0; spots.length < count && tries < count * 12; tries++) {
      const base = rand() < 0.5 && tips.length
        ? tips[Math.floor(rand() * tips.length)]
        : pts[2 + Math.floor(rand() * (pts.length - 2))];
      const x = base.x + (rand() - 0.5) * R * 4;
      const y = base.y + (rand() - 0.7) * R * 2.6;
      let ok = !(Math.abs(x - g.W * 0.78) < R * 1.6 && y > g.H * 0.4);
      for (const q of placed) {
        if (Math.hypot(q.x - x, q.y - y) < R * 1.55) { ok = false; break; }
      }
      if (!ok) continue;
      const s = { x, y, r: R * (0.85 + rand() * 0.35) };
      placed.push(s);
      spots.push(s);
    }
    for (const s of spots) {
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = LEAVES[Math.floor(rand() * LEAVES.length)];
        const a = rand() * TAU;
        blob(ctx, s.x + Math.cos(a) * s.r * 1.1, s.y + Math.sin(a) * s.r * 0.8 + s.r * 0.3,
          s.r * 0.7, s.r * 0.32, a);
      }
    }
    for (const s of spots) {
      const shaded = s.y > s.r && rand() < 0.25;
      flower(ctx, s.x, s.y, s.r, rand() * TAU, BRACTS[Math.floor(rand() * 3)], shaded);
    }
  }

  function paintTree(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { W, H } = g;
    const rand = K.rng(71);
    // trunk rises from behind the ridge
    limb(ctx, g, W * 0.8, H * 0.78, W * 0.765, H * 0.36, H * 0.06, H * 0.035, 3);
    const tiers = [
      // x0,y0 on trunk, x1,y1 tip, w0, w1, seed, flowers
      [0.775, 0.52, 0.1, 0.44, 0.03, 0.008, 11, 30],
      [0.77, 0.42, 0.26, 0.24, 0.026, 0.007, 13, 24],
      [0.765, 0.38, 0.62, 0.08, 0.022, 0.006, 17, 16],
      [0.78, 0.46, 1.04, 0.32, 0.024, 0.008, 19, 14],
      [0.77, 0.37, 1.03, 0.1, 0.02, 0.007, 23, 14],
      [0.785, 0.6, 0.55, 0.58, 0.018, 0.006, 29, 10],
      [0.56, 0.47, 0.36, 0.33, 0.01, 0.004, 31, 9],
    ];
    const placed = [];
    const limbs = tiers.map((t) => limb(ctx, g, W * t[0], H * t[1], W * t[2], H * t[3],
      H * t[4], H * t[5], t[6]));
    tiers.forEach((t, i) => bloomLimb(ctx, g, rand, limbs[i], t[7], placed));
    return c;
  }

  // ---- roof ----------------------------------------------------------------

  function eaveY(g, x) {
    const f = (x / g.W) * 2 - 1;
    return g.H * EAVE - f * f * g.H * 0.025;
  }

  function paintRoof(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { W, H } = g;
    const top = H * RIDGE;
    const cx = W * 0.5;
    const tw = Math.max(4, Math.round(H * 0.055));
    // under-eave shadow, fascia and plaster wall
    ctx.fillStyle = '#d6cdb6';
    ctx.fillRect(0, H * EAVE, W, H);
    ctx.fillStyle = '#5a3f2e';
    for (let x = tw * 3; x < W; x += tw * 9) ctx.fillRect(x, H * EAVE, Math.max(2, tw * 0.6), H);
    ctx.fillStyle = '#1e232b';
    ctx.beginPath();
    ctx.moveTo(0, eaveY(g, 0));
    for (let x = 0; x <= W; x += 2) ctx.lineTo(x, eaveY(g, x) + H * 0.045);
    ctx.lineTo(W, H * 0.9);
    ctx.lineTo(0, H * 0.9);
    ctx.fill();
    // roof body
    const body = ctx.createLinearGradient(0, top, 0, H * EAVE);
    body.addColorStop(0, '#4c586a');
    body.addColorStop(1, '#55627a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(W, top);
    for (let x = W; x >= 0; x -= 2) ctx.lineTo(x, eaveY(g, x));
    ctx.fill();
    // round tile columns, converging a little toward the ridge
    for (let x = -tw; x < W + tw; x += tw) {
      const xb = x + tw * 0.5;
      const xt = cx + (xb - cx) * 0.9;
      const yb = eaveY(g, xb);
      ctx.fillStyle = '#85929f';
      ctx.beginPath();
      ctx.moveTo(xt - tw * 0.27, top);
      ctx.lineTo(xt + tw * 0.27, top);
      ctx.lineTo(xb + tw * 0.32, yb);
      ctx.lineTo(xb - tw * 0.32, yb);
      ctx.fill();
      ctx.fillStyle = '#a9b3bf';
      ctx.fillRect(xb - tw * 0.18, top, Math.max(1, tw * 0.14), yb - top);
      ctx.fillStyle = '#2c333e';
      ctx.fillRect(x, top, 1, yb - top);
    }
    // courses: joints that grow apart toward the eave
    let y = top + H * 0.035;
    let step = H * 0.035;
    while (y < H * EAVE - step * 0.4) {
      ctx.fillStyle = 'rgba(30,35,44,0.65)';
      ctx.fillRect(0, y, W, Math.max(1, H * 0.006));
      y += step;
      step *= 1.22;
    }
    // eave: a row of round tile ends with a pale rim
    for (let x = -tw; x < W + tw; x += tw) {
      const xb = x + tw * 0.5;
      const yb = eaveY(g, xb);
      ctx.fillStyle = '#c3c8cc';
      blob(ctx, xb, yb, tw * 0.46, tw * 0.46);
      ctx.fillStyle = '#4a5464';
      blob(ctx, xb, yb, tw * 0.32, tw * 0.32);
      ctx.fillStyle = '#2a313b';
      blob(ctx, xb + tw * 0.5, yb + tw * 0.15, tw * 0.14, tw * 0.22);
    }
    // ridge: stacked noshi tiles with a plaster seam, cap tiles on top
    ctx.fillStyle = '#2b323c';
    ctx.fillRect(0, top - H * 0.05, W, H * 0.055);
    ctx.fillStyle = '#d9d1bc';
    ctx.fillRect(0, top - H * 0.026, W, Math.max(1, H * 0.008));
    ctx.fillStyle = '#6a7686';
    ctx.fillRect(0, top - H * 0.05, W, Math.max(1, H * 0.008));
    ctx.fillStyle = '#353d48';
    for (let x = 0; x < W + tw; x += tw * 0.8) blob(ctx, x, top - H * 0.055, tw * 0.45, H * 0.016);
    return c;
  }

  function paintDapple(g) {
    const w = Math.ceil(g.W * 0.5);
    const h = Math.ceil(g.H * (EAVE - RIDGE));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.06, y * 0.12, 3, 29);
        const b = fbm((x - w) * 0.06, y * 0.12, 3, 29);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 246;
        img.data[i + 2] = 214;
        img.data[i + 3] = smoothstep(0.55, 0.7, v) * 110;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPetal(tone) {
    const c = layer(8, 8);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone;
    blob(ctx, 4, 4, 3.4, 2.4, 0.5);
    return c;
  }

  // ---- setup and draw ------------------------------------------------------

  function seedPetals(g) {
    const rand = K.rng(5);
    const list = [];
    for (let i = 0; i < MAX_PETALS; i++) {
      list.push({
        x: g.W * (0.1 + rand() * 0.9),
        y: g.H * (0.1 + rand() * 0.8),
        v: 0.6 + rand() * 0.8,
        ph: rand() * TAU,
        s: 0.8 + rand() * 0.7,
        tone: i % 3,
      });
    }
    return list;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.sky = paintSky(g);
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.26));
    state.tree = paintTree(g);
    state.roof = paintRoof(g);
    state.dapple = paintDapple(g);
    state.petalArt = BRACTS.map(paintPetal);
    state.petals = seedPetals(g);
  }

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = 0.75;
    ctx.drawImage(c, off, g.H * 0.02);
    ctx.drawImage(c, off + c.width, g.H * 0.02);
    ctx.globalAlpha = 1;
  }

  // The tree leans from the trunk base: higher bands move further.
  function drawTree(ctx, g, t, breeze) {
    const tree = state.tree;
    const base = g.H * 0.75;
    const bh = Math.ceil(base / BANDS);
    const gust = Math.sin(t * 0.6) * 0.7 + Math.sin(t * 1.1 + 1.3) * 0.3;
    for (let i = 0; i < BANDS; i++) {
      const y = i * bh;
      const lift = 1 - (y + bh * 0.5) / base;
      const dx = gust * lift * g.H * 0.018 * breeze;
      ctx.drawImage(tree, 0, y, g.W, bh, dx, y, g.W, bh);
    }
    ctx.drawImage(tree, 0, BANDS * bh, g.W, g.H - BANDS * bh, 0, BANDS * bh, g.W, g.H - BANDS * bh);
  }

  function drawDapple(ctx, g, t) {
    const d = state.dapple;
    const y = g.H * RIDGE;
    const off = -((t * g.U * 0.9) % d.width);
    ctx.globalAlpha = 0.5 + Math.sin(t * 0.4) * 0.12;
    for (let x = off; x < g.W; x += d.width) ctx.drawImage(d, x, y);
    ctx.globalAlpha = 1;
  }

  function drawPetals(ctx, g, t, dt, amount) {
    const n = Math.round(MAX_PETALS * Math.min(1, amount / 1.5));
    for (let i = 0; i < n; i++) {
      const p = state.petals[i];
      p.y += dt * g.U * 4 * p.v;
      p.x -= dt * g.U * (2.5 + Math.sin(t * 0.6 + p.ph) * 2) * p.v;
      if (p.y > g.H * 0.95 || p.x < -8) {
        p.y = g.H * (0.1 + (i % 5) * 0.08);
        p.x = g.W * (0.15 + (i % 9) * 0.1);
      }
      const sway = Math.sin(t * 1.3 + p.ph) * g.U * 1.2;
      const s = g.H * 0.012 * p.s;
      ctx.drawImage(state.petalArt[p.tone], p.x + sway, p.y, s * 2, s * 2);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    drawTree(ctx, g, t, api.props.breeze);
    ctx.drawImage(state.roof, 0, 0);
    drawDapple(ctx, g, t);
    drawPetals(ctx, g, t, dt, api.props.petals);
  }

  Kasuri.run({
    defaults: { breeze: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
