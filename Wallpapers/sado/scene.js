/*
 * 佐渡 Sado — a rocky cove with round tub boats, below a pine cliff.
 *
 * Sky, islands, water, cliff, pines and foam are baked once. Each frame lays
 * down two sliding wave textures, a mist strip, three rocking tubs with their
 * reflections, and a few ripple rings.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.3;
  // Cliff crest from the left edge, then the foot back to it (fractions of the screen).
  const CREST = [[-0.02, 0.15], [0.05, 0.11], [0.12, 0.15], [0.2, 0.19], [0.26, 0.27], [0.29, 0.38], [0.31, 0.47], [0.35, 0.55], [0.41, 0.6], [0.46, 0.64]];
  const FOOT = [[0.46, 0.64], [0.4, 0.68], [0.32, 0.71], [0.22, 0.75], [0.12, 0.8], [-0.02, 0.85]];
  const BOATS = [
    { x: 0.58, y: 0.6, rx: 7.5, phase: 0.0 },
    { x: 0.76, y: 0.74, rx: 10, phase: 2.1 },
    { x: 0.27, y: 0.9, rx: 12, phase: 4.2 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky and distance ------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, '#9fb3b8');
    grad.addColorStop(0.6, '#d6d9c9');
    grad.addColorStop(1, '#ebe0c2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    const sx = g.W * 0.74;
    const sy = g.H * 0.2;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, g.U * 22);
    glow.addColorStop(0, 'rgba(232,194,122,0.7)');
    glow.addColorStop(1, 'rgba(232,194,122,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    ctx.fillStyle = '#e2bd72';
    ctx.beginPath();
    ctx.arc(sx, sy, g.U * 3.6, 0, TAU);
    ctx.fill();
  }

  function paintIslands(ctx, g) {
    const base = g.H * HORIZON;
    const specs = [
      { seed: 3, col: '#8a9ea8', h: 0.07, x0: 0.42, x1: 0.95 },
      { seed: 8, col: '#667f90', h: 0.045, x0: 0.5, x1: 0.8 },
    ];
    for (const s of specs) {
      ctx.fillStyle = s.col;
      ctx.beginPath();
      ctx.moveTo(g.W * s.x0, base + 1);
      for (let x = g.W * s.x0; x <= g.W * s.x1; x += 2) {
        const f = (x / g.W - s.x0) / (s.x1 - s.x0);
        const env = Math.sin(f * Math.PI);
        ctx.lineTo(x, base - g.H * s.h * env * (0.35 + fbm(x * 0.05, 1, 3, s.seed)));
      }
      ctx.lineTo(g.W * s.x1, base + 1);
      ctx.fill();
    }
  }

  // ---- water -------------------------------------------------------------------

  function paintWater(ctx, g, rand) {
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#a3b8bb');
    grad.addColorStop(0.25, '#4f7387');
    grad.addColorStop(0.6, '#3f6a73');
    grad.addColorStop(1, '#486f64');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Gold light on the water under the sun.
    ctx.save();
    ctx.translate(g.W * 0.74, top);
    ctx.scale(1, 2.2);
    const sun = ctx.createRadialGradient(0, 0, 0, 0, 0, g.W * 0.13);
    sun.addColorStop(0, 'rgba(226,189,114,0.55)');
    sun.addColorStop(1, 'rgba(226,189,114,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(-g.W * 0.2, 0, g.W * 0.4, g.H * 0.3);
    ctx.restore();
    // Stones seen through the clear shallows near the cliff and the front.
    for (let i = 0; i < 70; i++) {
      const x = rand() < 0.5 ? g.W * (0.2 + rand() * 0.35) : g.W * rand();
      const y = g.H * (0.66 + rand() * 0.34);
      const r = g.U * (0.8 + rand() * 2.4);
      ctx.globalAlpha = 0.2 + rand() * 0.25;
      ctx.fillStyle = rand() < 0.6 ? '#2d4f52' : '#6f8f76';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r * 0.8, 0, 0, TAU);
      ctx.fill();
    }
    // Pale sand light in the shallows below the foot of the cliff.
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#c9c9a2';
    ctx.beginPath();
    ctx.ellipse(g.W * 0.35, g.H * 0.74, g.W * 0.2, g.H * 0.05, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Rows of short pale dashes that tile sideways. Rows spread out toward the viewer.
  function paintWaves(g, seed, tone, alpha) {
    const rand = K.rng(seed);
    const top = g.H * HORIZON;
    const h = g.H - top;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone;
    let y = 2;
    while (y < h) {
      const depth = y / h;
      const gap = g.U * (0.9 + depth * 3.2);
      const len = g.U * (1.5 + depth * 6);
      const n = Math.round(g.W / (len * 3.2));
      for (let i = 0; i < n; i++) {
        const x = rand() * g.W;
        const l = len * (0.5 + rand());
        ctx.globalAlpha = alpha * (0.4 + rand() * 0.6);
        ctx.fillRect(x, y + rand() * gap * 0.4, l, Math.max(1, g.U * (0.18 + depth * 0.25)));
        if (x + l > g.W) ctx.fillRect(x - g.W, y, l, Math.max(1, g.U * 0.3));
      }
      y += gap;
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function drawWaves(ctx, g, t, amount) {
    if (amount <= 0) return;
    const top = g.H * HORIZON;
    const A = state.wavesA;
    const B = state.wavesB;
    const oa = (t * g.U * 0.9) % g.W;
    const ob = g.W - ((t * g.U * 0.5) % g.W);
    const bob = Math.sin(t * 0.8) * g.U * 0.5;
    ctx.globalAlpha = Math.min(1, 0.85 * amount);
    ctx.drawImage(A, oa, top + bob);
    ctx.drawImage(A, oa - g.W, top + bob);
    ctx.globalAlpha = Math.min(1, 0.7 * amount);
    ctx.drawImage(B, ob, top - bob * 0.8);
    ctx.drawImage(B, ob - g.W, top - bob * 0.8);
    ctx.globalAlpha = 1;
  }

  // ---- cliff -------------------------------------------------------------------

  function jitter(rand, g) {
    return (rand() - 0.5) * g.U * 1.4;
  }

  function cliffPath(ctx, g, rand) {
    ctx.beginPath();
    const pts = CREST.concat(FOOT.slice(1));
    for (let i = 0; i < pts.length; i++) {
      const px = g.W * pts[i][0] + jitter(rand, g);
      const py = g.H * pts[i][1] + jitter(rand, g);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function paintCliff(ctx, g, rand) {
    ctx.save();
    cliffPath(ctx, g, rand);
    const grad = ctx.createLinearGradient(0, 0, g.W * 0.4, g.H * 0.7);
    grad.addColorStop(0, '#56646a');
    grad.addColorStop(1, '#2b3640');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.clip();
    // Strata and cracks, leaning with the rock.
    for (let i = 0; i < 90; i++) {
      const x = g.W * rand() * 0.46;
      const y = g.H * (0.1 + rand() * 0.62);
      ctx.globalAlpha = 0.15 + rand() * 0.25;
      ctx.fillStyle = rand() < 0.5 ? '#5d6c72' : '#161d26';
      ctx.fillRect(x, y, g.U * (1.5 + rand() * 4), Math.max(1, g.U * 0.25));
    }
    // Lit faces toward the sun side and moss patches along the ledges.
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#7d8a86';
    for (let i = 0; i < 14; i++) {
      const y = g.H * (0.2 + rand() * 0.42);
      ctx.fillRect(g.W * (0.2 + rand() * 0.2), y, g.U * (1 + rand() * 2), g.U * (2 + rand() * 6));
    }
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#4a6a45';
    for (let i = 0; i < 26; i++) {
      const f = rand();
      const idx = Math.min(CREST.length - 2, Math.floor(f * (CREST.length - 1)));
      const a = CREST[idx];
      const b = CREST[idx + 1];
      const k = f * (CREST.length - 1) - idx;
      ctx.beginPath();
      ctx.ellipse(g.W * lerp(a[0], b[0], k), g.H * lerp(a[1], b[1], k) + g.U * 0.8, g.U * (1.5 + rand() * 3), g.U * (0.7 + rand()), 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // A pine with flat cloud pads on a leaning trunk.
  function paintPine(ctx, g, rand, x, y, s, lean) {
    ctx.strokeStyle = '#2a2a26';
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * s * 0.4, y - s * 0.5, x + lean * s * 0.2, y - s);
    ctx.stroke();
    const pads = [[0.1, 0.45, 0.4], [-0.25, 0.7, 0.34], [0.35, 0.82, 0.3], [lean * 0.2, 1.0, 0.36]];
    for (const p of pads) {
      const px = x + p[0] * s * 1.2 + lean * s * 0.1;
      const py = y - p[1] * s;
      const r = p[2] * s;
      for (let k = 0; k < 7; k++) {
        const ox = (rand() - 0.5) * r * 1.8;
        const oy = (rand() - 0.5) * r * 0.35;
        ctx.fillStyle = rand() < 0.35 ? '#4a6a45' : '#2f4a38';
        ctx.beginPath();
        ctx.ellipse(px + ox, py + oy, r * (0.4 + rand() * 0.3), r * 0.2, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  function paintPines(ctx, g, rand) {
    const U = g.U;
    paintPine(ctx, g, rand, g.W * 0.045, g.H * 0.125, U * 15, 0.3);
    paintPine(ctx, g, rand, g.W * 0.125, g.H * 0.165, U * 11, -0.2);
    paintPine(ctx, g, rand, g.W * 0.2, g.H * 0.205, U * 13, 0.4);
    paintPine(ctx, g, rand, g.W * 0.255, g.H * 0.285, U * 8, 0.8);
    paintPine(ctx, g, rand, g.W * 0.3, g.H * 0.46, U * 6, 1.0);
    paintPine(ctx, g, rand, g.W * 0.38, g.H * 0.59, U * 5, 0.6);
  }

  // ---- shore: rocks and foam -----------------------------------------------------

  function paintRocks(ctx, g, rand) {
    const spots = [[0.47, 0.66, 4], [0.5, 0.69, 2.5], [0.38, 0.7, 3], [0.29, 0.73, 3.4], [0.17, 0.79, 4.2], [0.06, 0.84, 5], [0.92, 0.97, 9], [0.84, 1.01, 7], [0.97, 0.87, 6]];
    for (const s of spots) {
      const x = g.W * s[0];
      const y = g.H * s[1];
      const r = g.U * s[2];
      ctx.fillStyle = '#262f38';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r * 0.9, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#6b766f';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.4, r * 0.9, r * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#4a6a45';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.1, y - r * 0.7, r * 0.6, r * 0.2, 0, 0, TAU);
      ctx.fill();
    }
  }

  function paintFoam(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#f0ead6';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    const pts = CREST.slice(5).concat(FOOT.slice(1));
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.4 : 0.8;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = g.W * pts[i][0] + pass * g.U * 0.8 + jitter(rand, g) * 0.6;
        const py = g.H * pts[i][1] + g.U * (0.6 + pass * 0.9);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 30; i++) {
      const f = rand() * (pts.length - 1);
      const idx = Math.floor(f);
      const k = f - idx;
      const x = g.W * lerp(pts[idx][0], pts[idx + 1][0], k);
      const y = g.H * lerp(pts[idx][1], pts[idx + 1][1], k) + g.U * (1 + rand() * 1.5);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, y, g.U * (1 + rand() * 2), Math.max(1, g.U * 0.25));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- mist ----------------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.H * 0.16);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.06, 3, 14), fbm((x - w) * 0.012, y * 0.06, 3, 14), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 232;
        img.data[i + 2] = 214;
        img.data[i + 3] = smoothstep(0.45, 0.75, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const off = (t * g.U * 0.6) % g.W;
    ctx.globalAlpha = Math.min(1, 0.7 * amount);
    const y = g.H * (HORIZON - 0.06);
    ctx.drawImage(state.mist, off, y);
    ctx.drawImage(state.mist, off - g.W, y);
    ctx.globalAlpha = 1;
  }

  // ---- tub boats -------------------------------------------------------------------

  function paintTub(g, rx) {
    const r = g.U * rx;
    const ry = r * 0.36;
    const body = r * 0.34;
    const w = Math.ceil(r * 2 + 6);
    const h = Math.ceil(ry * 2 + body + 6);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const cy = ry + 2;
    ctx.fillStyle = '#7a4f2c';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx - r * 0.9, cy + body);
    ctx.ellipse(cx, cy + body, r * 0.9, ry * 0.9, 0, Math.PI, 0, true);
    ctx.lineTo(cx + r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4d311d';
    ctx.lineWidth = 1;
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + k * r * 0.22, cy + ry * 0.7);
      ctx.lineTo(cx + k * r * 0.2, cy + body + ry * 0.8);
      ctx.stroke();
    }
    ctx.fillStyle = '#b4432d';
    ctx.fillRect(cx - r * 0.97, cy + body * 0.45, r * 1.94, Math.max(1, g.U * 0.5));
    ctx.fillStyle = '#c99a5c';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#34261a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.12, r * 0.84, ry * 0.78, 0, 0, TAU);
    ctx.fill();
    // A paddle resting across the tub.
    ctx.strokeStyle = '#d8c9a2';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy + ry * 0.3);
    ctx.lineTo(cx + r * 0.9, cy - ry * 0.5);
    ctx.stroke();
    return { img: c, w, h, cx, cy: cy + body * 0.6 };
  }

  function drawBoats(ctx, g, t, rocking) {
    for (let i = 0; i < BOATS.length; i++) {
      const b = BOATS[i];
      const s = state.tubs[i];
      const ph = b.phase;
      const ang = Math.sin(t * 0.9 + ph) * 0.06 * rocking;
      const bob = Math.sin(t * 1.3 + ph) * g.U * 0.3 * rocking;
      const x = g.W * b.x + Math.sin(t * 0.25 + ph) * g.U * 0.8 * rocking;
      const y = g.H * b.y + bob;
      // Reflection, pushed down and softened.
      ctx.globalAlpha = 0.28;
      ctx.setTransform(1, 0, 0, -0.8, x, y + g.U * 1.4);
      ctx.drawImage(s.img, -s.cx, -s.cy);
      ctx.globalAlpha = 1;
      // Ripple rings.
      ctx.strokeStyle = '#eee6cf';
      ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const p = ((t * 0.18 + k * 0.5 + ph) % 1 + 1) % 1;
        ctx.globalAlpha = (1 - p) * 0.5 * Math.min(1, rocking);
        ctx.setTransform(1, 0, 0, 0.3, x, y + g.U * 1.2);
        ctx.beginPath();
        ctx.arc(0, 0, s.cx * (0.95 + p * 0.5), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      ctx.setTransform(c, sn, -sn, c, x, y);
      ctx.drawImage(s.img, -s.cx, -s.cy);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run ---------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(api.seed || 7);
    const back = layer(g.W, g.H);
    const bc = back.getContext('2d');
    paintSky(bc, g);
    paintIslands(bc, g);
    paintWater(bc, g, rand);
    state.back = back;
    state.wavesA = paintWaves(g, 11, '#ece6d2', 0.55);
    state.wavesB = paintWaves(g, 23, '#b9d0cf', 0.5);
    const front = layer(g.W, g.H);
    const fc = front.getContext('2d');
    paintCliff(fc, g, rand);
    paintPines(fc, g, rand);
    paintRocks(fc, g, rand);
    state.front = front;
    state.foam = paintFoam(g, rand);
    state.mist = paintMist(g);
    state.tubs = BOATS.map((b) => paintTub(g, b.rx));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rocking, swell, mist } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawWaves(ctx, g, t, swell);
    drawMist(ctx, g, t, mist);
    drawBoats(ctx, g, t, rocking);
    ctx.drawImage(state.front, 0, 0);
    ctx.globalAlpha = (0.55 + 0.4 * Math.sin(t * 0.7)) * Math.min(1, swell);
    ctx.drawImage(state.foam, 0, Math.sin(t * 0.7) * g.U * 0.5);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { rocking: 1, swell: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
