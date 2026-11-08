/*
 * 梅 Ume — an old plum branch in late winter, white and pink, snow still on it.
 *
 * The sky, the tree and its blossom are baked once; a frame is three drawImage
 * calls, then two birds put together from three small sprites each and a short
 * pool of falling petals. Nothing loops over cells while it runs.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep, noise2, fbm } = K;

  const ART_SEED = 4177;
  const PAPER = '#f1ead9';
  const TAU = Math.PI * 2;

  // Each limb runs from its thick end: [x / W, y / H, width in U].
  const LIMBS = [
    { key: 'main', twigs: 9, pts: [[-0.05, 1.08, 21], [0.04, 0.86, 18], [0.1, 0.74, 14], [0.18, 0.66, 11], [0.27, 0.71, 8.5], [0.37, 0.65, 6.8], [0.49, 0.69, 5.4], [0.61, 0.62, 4.2], [0.73, 0.58, 3], [0.84, 0.46, 2], [0.95, 0.41, 1.3], [1.04, 0.32, 0.8]] },
    { key: 'upper', twigs: 8, pts: [[0.165, 0.68, 8.5], [0.2, 0.51, 7.4], [0.27, 0.39, 5.8], [0.38, 0.335, 4.8], [0.5, 0.36, 3.8], [0.62, 0.27, 2.8], [0.73, 0.22, 1.9], [0.83, 0.12, 1.1], [0.89, 0.04, 0.7]] },
    { key: 'low', twigs: 5, pts: [[0.365, 0.665, 4.4], [0.43, 0.8, 3.4], [0.54, 0.85, 2.6], [0.64, 0.82, 1.9], [0.74, 0.9, 1.2], [0.81, 0.96, 0.7]] },
    { key: 'stem', twigs: 4, pts: [[0.065, 0.82, 7], [0.055, 0.62, 5], [0.09, 0.45, 3.4], [0.065, 0.28, 2.1], [0.095, 0.14, 1.2], [0.085, 0.03, 0.7]] },
  ];
  const PERCHES = [
    { limb: 'main', from: 0.39, to: 0.67, scale: 1 },
    { limb: 'upper', from: 0.31, to: 0.58, scale: 0.92 },
  ];
  const WASHES = ['#a9c0cf', '#b3c7d2', '#bdcdd4', '#c8d3d5', '#d3d9d6', '#dedfd6', '#e8e4d6', '#f0e8d8'];
  const BARK = { deep: '#1c181e', body: '#302829', lit: '#6b5a4c', moss: '#76835a' };
  const SNOW = { shade: '#a9bccb', top: '#fdfcf7' };
  const FLOWERS = [
    { petal: '#fdfaf1', base: '#e9c3c8', eye: '#b65a68' },
    { petal: '#f7d6d8', base: '#e7a2ae', eye: '#b4465c' },
    { petal: '#e891a1', base: '#c95b73', eye: '#94304a' },
  ];
  const BIRD = { back: '#7c9a3e', crown: '#93ab46', wing: '#51692f', quill: '#303c25', edge: '#a3b65a', belly: '#e6e1cd', flank: '#bfb898', throat: '#d9c93f', beak: '#29282d', leg: '#3f3c46', ring: '#fdfcf5', pupil: '#121218', tail: '#55693a', line: '#2f3726' };
  const PETAL_TONES = ['#fdf6ee', '#f5c6ce', '#ec9fb0'];
  const MAX_PETALS = 48;
  const HOP_TIME = 0.3;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /* ---------- limbs as sampled ribbons ---------- */

  function catmull(a, b, c, d, f) {
    const f2 = f * f;
    const f3 = f2 * f;
    return 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (3 * b - a - 3 * c + d) * f3);
  }

  function resample(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.7));
      for (let k = 0; k < steps; k++) {
        const f = k / steps;
        out.push([catmull(p0[0], p1[0], p2[0], p3[0], f), catmull(p0[1], p1[1], p2[1], p3[1], f), lerp(p1[2], p2[2], f)]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // Turn control points in pixels into a ribbon with a gnarled, uneven outline.
  function ribbon(pts, g, seed, gnarl) {
    const raw = resample(pts);
    const n = raw.length;
    const path = { n, x: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), s: new Float32Array(n) };
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = raw[Math.max(0, i - 2)];
      const b = raw[Math.min(n - 1, i + 2)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      if (i > 0) s += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
      const up = dx > 0 ? 1 : -1;
      const nx = (dy / len) * up;
      const ny = (-dx / len) * up;
      const su = s / g.U;
      const wobble = (fbm(su * 0.09, seed * 3.1, 3, seed) - 0.5) * (raw[i][2] * 0.5 + g.U * 1.2) * gnarl;
      path.x[i] = raw[i][0] + nx * wobble;
      path.y[i] = raw[i][1] + ny * wobble;
      path.w[i] = raw[i][2] * (0.82 + 0.36 * noise2(su * 0.16, seed * 1.7, seed));
      path.nx[i] = nx;
      path.ny[i] = ny;
      path.s[i] = s;
    }
    return path;
  }

  function stroke(ctx, path, offset, widthShare, colour, minR) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 0; i < path.n; i++) {
      const r = Math.max(minR, (path.w[i] * widthShare) / 2);
      const x = path.x[i] + path.nx[i] * offset * path.w[i];
      const y = path.y[i] + path.ny[i] * offset * path.w[i];
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
  }

  function paintGrain(ctx, path, g, rand, seed) {
    const count = Math.ceil(path.s[path.n - 1] / g.U / 1.2);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.7, g.U * 0.5);
    for (let k = 0; k < count; k++) {
      const start = Math.floor(rand() * path.n);
      if (path.w[start] < g.U * 2.8) continue;
      const side = (rand() - 0.5) * 0.8;
      const span = Math.floor((3 + rand() * 12) * g.U / 0.7);
      ctx.strokeStyle = rand() < 0.62 ? BARK.deep : BARK.lit;
      ctx.beginPath();
      for (let i = start; i < Math.min(path.n, start + span); i += 3) {
        const off = side * path.w[i];
        ctx.lineTo(path.x[i] + path.nx[i] * off, path.y[i] + path.ny[i] * off);
      }
      ctx.stroke();
    }
    paintMoss(ctx, path, g, rand, seed);
  }

  function paintMoss(ctx, path, g, rand, seed) {
    ctx.fillStyle = BARK.moss;
    for (let i = 0; i < path.n; i += 2) {
      if (path.w[i] < g.U * 4) continue;
      if (noise2(path.s[i] / g.U * 0.1, seed * 2.3, seed) < 0.62 || rand() > 0.5) continue;
      const off = -0.05 + rand() * 0.5;
      ctx.fillRect(path.x[i] + path.nx[i] * off * path.w[i], path.y[i] + path.ny[i] * off * path.w[i], Math.max(1, g.U * 0.8), Math.max(1, g.U * 0.6));
    }
  }

  function paintLimb(ctx, path, g, rand, seed) {
    stroke(ctx, path, 0, 1, BARK.deep, 0.5);
    stroke(ctx, path, 0.1, 0.68, BARK.body, 0.3);
    stroke(ctx, path, 0.29, 0.14, BARK.lit, 0.01);
    paintGrain(ctx, path, g, rand, seed);
  }

  /* ---------- snow lying on the top of limbs ---------- */

  function paintSnow(ctx, path, g, seed) {
    const passes = [[SNOW.shade, 0.26, 1.12], [SNOW.top, 0, 1]];
    for (const [colour, drop, grow] of passes) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      for (let i = 0; i < path.n; i++) {
        const v = noise2((path.s[i] / g.U) * 0.075, seed * 4.3, seed + 11);
        const h = smoothstep(0.5, 0.68, v) * Math.min(path.w[i] * 0.55, g.U * 3) * smoothstep(0.45, 0.8, -path.ny[i]);
        if (h < g.U * 0.35) continue;
        const x = path.x[i] + path.nx[i] * path.w[i] * 0.42;
        const y = path.y[i] + path.ny[i] * path.w[i] * 0.42 + h * drop;
        ctx.moveTo(x + h * grow, y);
        ctx.arc(x, y, h * grow, 0, TAU);
      }
      ctx.fill();
    }
  }

  /* ---------- blossom ---------- */

  function paintFlower(ctx, g, b) {
    const tone = FLOWERS[b.tone];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.turn);
    ctx.scale(1, b.squash);
    ctx.fillStyle = 'rgba(112,84,96,0.34)';
    ctx.beginPath();
    ctx.arc(b.r * 0.12, b.r * 0.2, b.r * 1.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tone.petal;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5;
      ctx.moveTo(Math.cos(a) * b.r * 0.56 + b.r * 0.48, Math.sin(a) * b.r * 0.56);
      ctx.arc(Math.cos(a) * b.r * 0.56, Math.sin(a) * b.r * 0.56, b.r * 0.48, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = tone.base;
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.32, 0, TAU);
    ctx.fill();
    paintStamens(ctx, g, b, tone);
    ctx.restore();
  }

  function paintStamens(ctx, g, b, tone) {
    ctx.fillStyle = tone.eye;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.5, b.r * 0.2), 0, TAU);
    ctx.fill();
    if (b.r < g.U * 2.1) return;
    ctx.fillStyle = '#cda033';
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + b.turn;
      ctx.fillRect(Math.cos(a) * b.r * 0.5 - 0.4, Math.sin(a) * b.r * 0.5 - 0.4, 0.8, 0.8);
    }
  }

  function paintBud(ctx, b) {
    ctx.fillStyle = '#3f2a2c';
    ctx.beginPath();
    ctx.arc(b.x, b.y + b.r * 0.5, b.r * 0.75, 0, TAU);
    ctx.fill();
    ctx.fillStyle = b.tone === 0 ? '#e9b9bd' : '#b63f55';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
  }

  function flower(x, y, r, rand, tone, front) {
    return { x, y, r, tone, front, bud: false, turn: rand() * TAU, squash: 0.68 + rand() * 0.32 };
  }

  function toneAt(x, y, g, rand) {
    const pink = fbm(x / g.U * 0.03, y / g.U * 0.03, 2, 7);
    const roll = rand();
    if (roll < 0.14 + (pink - 0.5) * 0.5) return 2;
    return roll < 0.42 + (pink - 0.5) * 1.1 ? 1 : 0;
  }

  // Blossom bunches along a limb: density comes in waves, so they gather in sprays.
  function bloomLimb(path, g, rand, seed, list) {
    const end = path.s[path.n - 1];
    for (let s = g.U * 2; s < end; s += g.U * (1.7 + rand() * 2)) {
      const i = Math.min(path.n - 1, Math.floor((s / end) * path.n));
      const w = path.w[i];
      if (w > g.U * 8) continue;
      const wave = noise2((s / g.U) * 0.11, seed * 5.9, seed + 3);
      if (rand() > smoothstep(0.34, 0.66, wave) * 0.94 + 0.03) continue;
      const side = rand() < 0.62 ? 1 : -1;
      const off = side * (w * 0.5 + g.U * (0.2 + rand() * rand() * 7));
      const x = path.x[i] + path.nx[i] * off + (rand() - 0.5) * g.U * 3;
      const y = path.y[i] + path.ny[i] * off;
      const big = rand();
      const r = g.U * (big > 0.84 ? 3.8 + rand() * 1.5 : big > 0.42 ? 2.2 + rand() * 0.8 : 1.2 + rand() * 0.6);
      list.push(flower(x, y, r, rand, toneAt(x, y, g, rand), rand() < 0.68));
    }
  }

  // Straight young whips that rise off the old wood, the plum's own gesture.
  function growTwig(path, g, rand, seed, at, list) {
    const i = Math.floor(at * (path.n - 1));
    const lean = (rand() - 0.5) * 0.9 + 0.28;
    const down = rand() < 0.22;
    const angle = (down ? 0.5 + rand() * 0.7 : -Math.PI / 2 + lean);
    const len = g.U * (12 + rand() * 20);
    const x0 = path.x[i];
    const y0 = path.y[i];
    const kink = 0.35 + rand() * 0.3;
    const bend = (rand() - 0.5) * 0.5;
    const pts = [
      [x0, y0, Math.min(path.w[i], g.U * 1.5)],
      [x0 + Math.cos(angle) * len * kink, y0 + Math.sin(angle) * len * kink, g.U * 0.95],
      [x0 + Math.cos(angle + bend) * len, y0 + Math.sin(angle + bend) * len, g.U * 0.55],
    ];
    const twig = ribbon(pts, g, seed, 0.25);
    bloomTwig(twig, g, rand, list);
    return twig;
  }

  function bloomTwig(twig, g, rand, list) {
    const end = twig.s[twig.n - 1];
    let side = rand() < 0.5 ? 1 : -1;
    for (let s = g.U * 3; s < end; s += g.U * (2.2 + rand() * 2.2)) {
      const i = Math.min(twig.n - 1, Math.floor((s / end) * twig.n));
      const tip = s / end;
      side = -side;
      const off = side * g.U * (0.7 + rand() * 1.3);
      const x = twig.x[i] + twig.nx[i] * off;
      const y = twig.y[i] + twig.ny[i] * off;
      if (tip > 0.78) {
        list.push({ x, y, r: g.U * (0.75 + rand() * 0.35), tone: rand() < 0.4 ? 0 : 2, front: true, bud: true });
      } else {
        list.push(flower(x, y, g.U * (1.7 + rand() * 1.5), rand, toneAt(x, y, g, rand), rand() < 0.75));
      }
    }
  }

  // Keep a small tuft in reach of the beak every few steps along each perch.
  function tuftPerch(path, perch, g, rand, list) {
    for (let s = perch.s0; s < perch.s1; s += g.U * 8) {
      const i = Math.floor((s / path.s[path.n - 1]) * path.n);
      const x = path.x[i];
      const y = path.y[i] - path.w[i] * 0.5;
      list.push(flower(x + g.U * 1.5, y - g.U * (4.5 + rand() * 6), g.U * (3 + rand() * 1.5), rand, toneAt(x, y, g, rand), true));
      if (rand() < 0.7) list.push(flower(x - g.U * 2, y - g.U * (2 + rand() * 2.5), g.U * (1.7 + rand() * 0.8), rand, toneAt(x, y, g, rand), true));
      if (rand() < 0.6) list.push(flower(x + g.U * 3, y + g.U * (3.5 + rand() * 4), g.U * (2 + rand() * 1), rand, toneAt(x, y, g, rand), true));
    }
  }

  function buildTree(g, rand) {
    const limbs = {};
    const twigs = [];
    const blooms = [];
    LIMBS.forEach((limb, n) => {
      const pts = limb.pts.map((p) => [p[0] * g.W, p[1] * g.H, p[2] * g.U]);
      const path = ribbon(pts, g, n + 1, 1);
      limbs[limb.key] = path;
      bloomLimb(path, g, rand, n + 1, blooms);
      const count = Math.round((limb.twigs * g.W) / (g.H * 1.54));
      for (let k = 0; k < count; k++) {
        const at = 0.34 + (0.62 * (k + rand() * 0.7)) / count;
        twigs.push(growTwig(path, g, rand, 20 + n * 9 + k, at, blooms));
      }
    });
    return { limbs, twigs, blooms };
  }

  function paintBlooms(ctx, g, blooms, front) {
    for (const b of blooms) {
      if (b.front !== front) continue;
      if (b.bud) paintBud(ctx, b);
      else paintFlower(ctx, g, b);
    }
  }

  function paintTree(g, tree, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sorted = tree.blooms.slice().sort((a, b) => a.r - b.r);
    paintBlooms(ctx, g, sorted, false);
    for (const twig of tree.twigs) stroke(ctx, twig, 0, 1, BARK.deep, 0.42);
    LIMBS.forEach((limb, n) => paintLimb(ctx, tree.limbs[limb.key], g, rand, n + 1));
    LIMBS.forEach((limb, n) => paintSnow(ctx, tree.limbs[limb.key], g, n + 1));
    paintBlooms(ctx, g, sorted, true);
    return c;
  }

  /* ---------- the far world ---------- */

  function wavyFill(ctx, g, y, amp, freq, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, y + (fbm((x / g.U) * freq, seed * 1.3, 3, seed) - 0.5) * amp);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = WASHES[0];
    ctx.fillRect(0, 0, g.W, g.H);
    WASHES.forEach((tone, i) => {
      if (i > 0) wavyFill(ctx, g, g.H * (i / WASHES.length) * 0.92, g.U * 7, 0.022, i + 30, tone);
    });
    paintRidge(ctx, g);
    paintField(ctx, g, rand);
    return c;
  }

  // One snow-capped mountain low on the right, in the room the branch leaves open.
  function paintRidge(ctx, g) {
    const peak = (x) => g.H * 0.92 - g.H * 0.34 * Math.exp(-Math.pow((x / g.W - 0.75) / 0.19, 2)) + (fbm((x / g.U) * 0.05, 3.3, 3, 71) - 0.5) * g.U * 6;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, peak(x));
    ctx.lineTo(g.W, g.H);
    ctx.clip();
    ctx.fillStyle = '#f8f7f1';
    ctx.fillRect(0, 0, g.W, g.H);
    wavyFill(ctx, g, g.H * 0.655, g.U * 10, 0.13, 73, '#92a7b6');
    ctx.restore();
  }

  // The snow field falls away to the right, against the line of the branch.
  function fieldEdge(x, g, rise) {
    const roll = fbm((x / g.U) * 0.02, rise * 0.7, 3, 67) - 0.5;
    return g.H * (0.76 + rise + (0.15 * x) / g.W) + roll * g.U * 7;
  }

  function fillBelow(ctx, g, colour, edge) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 1; x += 1) ctx.lineTo(x, edge(x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintField(ctx, g, rand) {
    fillBelow(ctx, g, '#a3b3ba', (x) => fieldEdge(x, g, 0) - fbm((x / g.U) * 0.03, 8.1, 2, 81) * g.U * 6 - noise2((x / g.U) * 0.42, 2.7, 83) * g.U * 2.2);
    fillBelow(ctx, g, '#f4f0e4', (x) => fieldEdge(x, g, 0));
    fillBelow(ctx, g, '#e2e5e3', (x) => fieldEdge(x, g, 0.1));
    fillBelow(ctx, g, '#f0ede2', (x) => fieldEdge(x, g, 0.14));
    paintTufts(ctx, g, rand);
  }

  // Dead grass through the snow and a few fallen petals, so the field isn't blank.
  function paintTufts(ctx, g, rand) {
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.7, g.U * 0.42);
    ctx.strokeStyle = '#a4a99c';
    for (let k = 0; k < Math.ceil(g.W / g.U / 16); k++) {
      const x = g.W * (0.14 + rand() * 0.86);
      const y = Math.min(g.H - g.U * 2, fieldEdge(x, g, 0.03 + rand() * 0.16));
      const blades = 2 + Math.floor(rand() * 3);
      for (let n = 0; n < blades; n++) {
        ctx.beginPath();
        ctx.moveTo(x + n * g.U * 0.9, y);
        ctx.lineTo(x + n * g.U * 0.9 + (rand() - 0.3) * g.U * 1.6, y - g.U * (1 + rand() * 2.6));
        ctx.stroke();
      }
    }
    for (let k = 0; k < g.W / g.U / 4; k++) {
      const x = rand() * g.W;
      ctx.fillStyle = PETAL_TONES[1 + Math.floor(rand() * 2)];
      ctx.fillRect(x, fieldEdge(x, g, 0.02 + rand() * 0.2), Math.max(1, g.U * 0.9), Math.max(1, g.U * 0.5));
    }
  }

  // Bands of mist with rounded ends, the way they are stylised on folding screens.
  function paintMist(g, rand) {
    const w = Math.ceil(g.W * 1.6);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const clouds = [[0.06, 0.1], [0.42, 0.04], [0.5, 0.42], [0.14, 0.58], [0.78, 0.82], [0.3, 0.86]];
    ctx.fillStyle = '#f3ecd4';
    for (const [fx, fy] of clouds) paintCloud(ctx, g, rand, fx * w, g.H * fy, w);
    return c;
  }

  function paintCloud(ctx, g, rand, x, y, w) {
    const h = g.U * 2.2;
    const steps = 3 + Math.floor(rand() * 2);
    const span = g.W * (0.24 + rand() * 0.16);
    for (let j = 0; j < steps; j++) {
      const len = span * (0.45 + rand() * 0.55);
      const start = x + rand() * (span - len);
      for (const shift of [0, -w]) {
        ctx.beginPath();
        ctx.roundRect(start + shift, y + j * h * 0.92, len, h, h / 2);
        ctx.fill();
      }
    }
  }

  /* ---------- birds, three sprites each ---------- */

  function spriteCanvas(wide, tall, px, ox, oy) {
    const c = layer(wide * px, tall * px);
    const ctx = c.getContext('2d');
    ctx.scale(px, px);
    ctx.translate(ox, oy);
    return { c, ctx, ox, oy, wide, tall };
  }

  function shape(ctx, colour, pts) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
    ctx.closePath();
    ctx.fill();
  }

  // Bird units: feet at 0,0, facing right, about 20 tall and 30 long.
  function paintBirdBody(px) {
    const s = spriteCanvas(26, 16, px, 13, 16);
    const ctx = s.ctx;
    shape(ctx, BIRD.back, [6, -13.4, 10, -9.5, 7.6, -6, 5, -2.8, 0, -3.2, -5, -3.4, -8.6, -7, -5, -12.8, 1.5, -14.6, 4, -14.6, 6, -13.4]);
    shape(ctx, BIRD.belly, [8.2, -11, 9.8, -8.4, 7.2, -5.6, 4.8, -2.8, 0, -3.1, -4.4, -3.3, -6.2, -5.4, -2, -6.4, 2, -7.4, 5.4, -8.6, 8.2, -11]);
    shape(ctx, BIRD.flank, [3.6, -7.6, 2.4, -5.8, -0.6, -5, -3.4, -4.6, -5.6, -5.2, -2, -6.2, 3.6, -7.6]);
    shape(ctx, BIRD.throat, [7.2, -13, 10, -11, 8.6, -9.2, 6, -9, 5.4, -10.8, 5.6, -12, 7.2, -13]);
    shape(ctx, BIRD.throat, [-3.2, -3.4, -2, -3, -5.2, -3.8, -7, -5, -6, -5.2, -5, -4.6, -3.2, -3.4]);
    shape(ctx, BIRD.wing, [4.2, -12.4, 1, -13.2, -3, -11.8, -8, -9, -12, -5.8, -7, -5.6, -3, -6.4, 1, -7.2, 3.4, -9, 5, -10.4, 4.2, -12.4]);
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = BIRD.quill;
    for (const [x0, y0, x1, y1] of [[1, -9.2, -10.6, -6.1], [0.4, -8.2, -8, -5.9], [2.2, -10.4, -7.4, -7.8]]) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.strokeStyle = BIRD.edge;
    ctx.beginPath();
    ctx.moveTo(3.4, -11.8);
    ctx.quadraticCurveTo(-1, -12.2, -5.4, -9.4);
    ctx.stroke();
    paintBodyContour(ctx);
    return s;
  }

  function paintBodyContour(ctx) {
    ctx.strokeStyle = BIRD.line;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(8.6, -11);
    ctx.quadraticCurveTo(10, -9.5, 7.6, -6);
    ctx.quadraticCurveTo(5, -2.8, 0, -3.2);
    ctx.quadraticCurveTo(-5, -3.4, -8.6, -7);
    ctx.quadraticCurveTo(-7.4, -10, -5, -12.8);
    ctx.quadraticCurveTo(-2, -14.2, 1.5, -14.6);
    ctx.stroke();
  }

  // Pivots at the neck, which sits at 3.5, -13.4 on the body.
  function paintBirdHead(px) {
    const s = spriteCanvas(19, 13, px, 5, 9);
    const ctx = s.ctx;
    shape(ctx, BIRD.beak, [6.8, -4.6, 9.4, -3.9, 11.8, -3.1, 9.4, -2.8, 6.8, -2.1, 6.8, -3.4, 6.8, -4.6]);
    ctx.fillStyle = BIRD.back;
    ctx.beginPath();
    ctx.arc(2.8, -3, 4.9, 0, TAU);
    ctx.fill();
    shape(ctx, BIRD.crown, [-1.4, -5, 1, -8.2, 4, -7.8, 6.6, -7, 7.6, -4.2, 4.4, -6, 1.4, -5.8, -0.2, -5.4, -1.4, -5]);
    shape(ctx, BIRD.throat, [7.6, -2.4, 7.6, 0, 5, 1.4, 3, 2.2, 1.8, 1.4, 4.4, -0.4, 5.2, -1.6, 6, -2.4, 7.6, -2.4]);
    ctx.strokeStyle = BIRD.line;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.arc(2.8, -3, 4.9, 2.9, TAU + 1.7);
    ctx.stroke();
    ctx.fillStyle = BIRD.ring;
    ctx.beginPath();
    ctx.arc(4.2, -3.5, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = BIRD.pupil;
    ctx.beginPath();
    ctx.arc(4.35, -3.5, 1.28, 0, TAU);
    ctx.fill();
    ctx.fillStyle = BIRD.quill;
    ctx.fillRect(6.2, -4.1, 1.2, 0.6);
    return s;
  }

  // Pivots at the base, which sits at -6, -6.6 on the body.
  function paintBirdTail(px) {
    const s = spriteCanvas(14, 12, px, 12.5, 3);
    const ctx = s.ctx;
    shape(ctx, BIRD.tail, [1, -2, -4.4, -0.8, -10.4, 3.4, -11.6, 5.6, -10, 7, -4.6, 5, 1, 2.2, 1.6, 0, 1, -2]);
    ctx.strokeStyle = BIRD.quill;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0.1);
    ctx.lineTo(-10.6, 5.2);
    ctx.stroke();
    return s;
  }

  function perchLine(path, spec, g) {
    const iA = Math.floor(path.n * spec.from);
    const iB = Math.floor(path.n * spec.to);
    const n = iB - iA;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const i = iA + k;
      x[k] = path.x[i] + path.nx[i] * path.w[i] * 0.46;
      y[k] = path.y[i] + path.ny[i] * path.w[i] * 0.46;
    }
    return { n, x, y, step: path.s[iB] > 0 ? (path.s[iB] - path.s[iA]) / n : 1, s0: path.s[iA], s1: path.s[iB], unit: g.U * spec.scale };
  }

  function makeBird(perch, at, dir, rand) {
    return {
      perch, dir, rand,
      i: Math.floor(perch.n * at), from: 0, to: 0,
      phase: 'rest', timer: 0.4 + rand() * 1.5, hopT: 0, hops: 0,
      clock: rand() * 9, dip: 0, look: 0, lookAim: 0, lookIn: 0, flick: 0, lift: 0, pitch: -0.27,
      struck: false, beakX: 0, beakY: 0,
    };
  }

  function startHops(b) {
    b.phase = 'hop';
    b.hops = 1 + Math.floor(b.rand() * 3);
    nextHop(b);
  }

  function nextHop(b) {
    const reach = (b.perch.unit * (5 + b.rand() * 4)) / b.perch.step;
    let to = b.i + b.dir * reach;
    if (to < 2 || to > b.perch.n - 3) {
      b.dir = -b.dir;
      to = b.i + b.dir * reach;
    }
    b.from = b.i;
    b.to = Math.max(2, Math.min(b.perch.n - 3, to));
    b.hopT = 0;
  }

  function stepHop(b, dt) {
    b.hopT += dt / HOP_TIME;
    if (b.hopT < 1) {
      b.i = lerp(b.from, b.to, b.hopT);
      b.lift = Math.sin(b.hopT * Math.PI) * b.perch.unit * 5;
      return;
    }
    b.i = b.to;
    b.lift = 0;
    b.flick = 1;
    b.hops -= 1;
    if (b.hops > 0) {
      nextHop(b);
    } else {
      b.phase = 'rest';
      b.timer = 0.25 + b.rand() * 0.9;
    }
  }

  function stepRest(b, dt) {
    b.timer -= dt;
    b.lookIn -= dt;
    if (b.lookIn <= 0) {
      b.lookAim = (b.rand() - 0.6) * 0.5;
      b.lookIn = 0.25 + b.rand() * 0.7;
    }
    if (b.timer > 0) return;
    if (b.rand() < 0.68) {
      b.phase = 'peck';
      b.timer = 1.8 + b.rand() * 3.2;
      b.clock = 0;
    } else {
      if (b.rand() < 0.3) b.dir = -b.dir;
      startHops(b);
    }
  }

  function stepPeck(b, dt) {
    b.timer -= dt;
    b.clock += dt;
    const wave = Math.sin(b.clock * 8.5);
    b.dip = wave > 0 ? wave : 0;
    if (b.dip > 0.92 && !b.struck) {
      b.struck = true;
      if (b.rand() < 0.3) dropPetal(state.petals, b.beakX, b.beakY, b.rand);
    } else if (b.dip < 0.2) {
      b.struck = false;
    }
    if (b.timer <= 0) {
      b.dip = 0;
      b.phase = 'rest';
      b.timer = 0.4 + b.rand() * 1.2;
    }
  }

  function stepBird(b, dt) {
    if (b.phase === 'hop') stepHop(b, dt);
    else if (b.phase === 'peck') stepPeck(b, dt);
    else stepRest(b, dt);
    const pecking = b.phase === 'peck';
    const aim = pecking ? 0.1 : b.phase === 'hop' ? -0.36 : -0.27;
    b.pitch += (aim - b.pitch) * Math.min(1, dt * 9);
    b.look += ((pecking ? 0.3 + b.dip * 0.85 : b.lookAim) - b.look) * Math.min(1, dt * 22);
    b.flick *= Math.exp(-dt * 5);
  }

  function drawSprite(ctx, s, unit) {
    ctx.drawImage(s.c, -s.ox * unit, -s.oy * unit, s.wide * unit, s.tall * unit);
  }

  function drawBird(ctx, g, b) {
    const k = Math.floor(b.i);
    const f = b.i - k;
    const u = b.perch.unit;
    const x = lerp(b.perch.x[k], b.perch.x[k + 1], f);
    const y = lerp(b.perch.y[k], b.perch.y[k + 1], f) - b.lift;
    const air = b.phase === 'hop';
    const lean = b.pitch;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(b.dir, 1);
    drawLegs(ctx, u, air);
    ctx.translate(0, air ? -u : 0);
    ctx.rotate(lean);
    ctx.save();
    ctx.translate(-6 * u, -6.6 * u);
    ctx.rotate(-b.flick * 0.55 + Math.sin(b.clock * 2.2) * 0.03);
    drawSprite(ctx, state.tail, u);
    ctx.restore();
    drawSprite(ctx, state.body, u);
    ctx.translate(3.5 * u, -13.4 * u);
    ctx.rotate(b.look - lean * 0.8);
    drawSprite(ctx, state.head, u);
    ctx.restore();
    const reach = b.look + lean * 0.2;
    b.beakX = x + b.dir * (3.5 + Math.cos(reach) * 11) * u;
    b.beakY = y + (-13.4 + Math.sin(reach) * 11) * u;
  }

  function drawLegs(ctx, u, air) {
    ctx.strokeStyle = BIRD.leg;
    ctx.lineWidth = Math.max(1, u * 0.85);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (air) {
      ctx.moveTo(u * 1.5, -u * 5);
      ctx.lineTo(-u * 1.5, -u * 2.2);
    } else {
      ctx.moveTo(u * 2.2, -u * 4.6);
      ctx.lineTo(u * 2.8, 0);
      ctx.lineTo(u * 5, u * 0.5);
      ctx.moveTo(-u * 0.6, -u * 4.6);
      ctx.lineTo(-u * 0.4, 0);
      ctx.lineTo(u * 1.8, u * 0.5);
    }
    ctx.stroke();
  }

  /* ---------- falling petals ---------- */

  function paintPetalSprites(g) {
    const r = g.U * 1.55;
    const size = Math.ceil(r * 2.6) * 2;
    const list = [];
    for (const tone of PETAL_TONES) {
      for (const [rx, ry, turn] of [[1, 0.62, 0.5], [0.8, 0.42, -0.4], [0.95, 0.22, 0.15]]) {
        const c = layer(size, size);
        const ctx = c.getContext('2d');
        ctx.translate(size / 2, size / 2);
        ctx.rotate(turn);
        ctx.fillStyle = tone;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * r * 2, ry * r * 2, 0, 0, TAU);
        ctx.fill();
        list.push(c);
      }
    }
    return { list, size: size / 2 };
  }

  function makePetals(g, blooms) {
    const sources = blooms.filter((b) => !b.bud && b.y < g.H * 0.8 && b.x > 0 && b.x < g.W);
    return {
      n: MAX_PETALS, sources,
      x: new Float32Array(MAX_PETALS), y: new Float32Array(MAX_PETALS),
      fall: new Float32Array(MAX_PETALS), drift: new Float32Array(MAX_PETALS),
      phase: new Float32Array(MAX_PETALS), tone: new Uint8Array(MAX_PETALS),
      live: new Uint8Array(MAX_PETALS), wait: 0, g,
    };
  }

  function dropPetal(p, x, y, rand) {
    for (let i = 0; i < p.n; i++) {
      if (p.live[i]) continue;
      p.live[i] = 1;
      p.x[i] = x;
      p.y[i] = y;
      p.fall[i] = p.g.U * (4 + rand() * 3.5);
      p.drift[i] = p.g.U * (0.6 + rand() * 1.8);
      p.phase[i] = rand() * TAU;
      p.tone[i] = Math.floor(rand() * PETAL_TONES.length);
      return;
    }
  }

  function dropFromTree(p, rand) {
    const b = p.sources[Math.floor(rand() * p.sources.length)];
    if (b) dropPetal(p, b.x, b.y, rand);
  }

  function prewarm(p, g, rand) {
    for (let k = 0; k < 20; k++) {
      dropFromTree(p, rand);
      const i = k;
      if (p.live[i]) p.y[i] += rand() * Math.max(0, g.H - p.y[i]);
    }
  }

  function stepPetals(ctx, g, p, t, dt, amount, rand) {
    p.wait -= dt * amount;
    if (p.wait <= 0 && amount > 0 && p.sources.length) {
      p.wait = 0.32 + rand() * 0.55;
      dropFromTree(p, rand);
    }
    const sprites = state.petalSprites;
    const size = sprites.size;
    for (let i = 0; i < p.n; i++) {
      if (!p.live[i]) continue;
      const beat = Math.sin(t * 1.5 + p.phase[i]);
      p.y[i] += p.fall[i] * (0.8 + 0.3 * beat) * dt;
      p.x[i] += (p.drift[i] + Math.cos(t * 1.1 + p.phase[i]) * g.U * 3.4) * dt;
      if (p.y[i] > g.H + size) {
        p.live[i] = 0;
        continue;
      }
      const pose = Math.min(2, Math.floor((beat + 1) * 1.5));
      ctx.drawImage(sprites.list[p.tone[i] * 3 + pose], p.x[i] - size / 2, p.y[i] - size / 2, size, size);
    }
  }

  /* ---------- running it ---------- */

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(ART_SEED);
    const tree = buildTree(g, rand);
    const perches = PERCHES.map((spec) => perchLine(tree.limbs[spec.limb], spec, g));
    PERCHES.forEach((spec, n) => tuftPerch(tree.limbs[spec.limb], perches[n], g, rand, tree.blooms));
    state.g = g;
    state.sky = paintSky(g, rand);
    state.mist = paintMist(g, rand);
    state.tree = paintTree(g, tree, rand);
    const px = Math.max(2, Math.ceil(g.U * 2));
    state.body = paintBirdBody(px);
    state.head = paintBirdHead(px);
    state.tail = paintBirdTail(px);
    state.birds = [makeBird(perches[0], 0.45, 1, K.rng(ART_SEED + 1)), makeBird(perches[1], 0.55, -1, K.rng(ART_SEED + 2))];
    state.petalSprites = paintPetalSprites(g);
    state.petals = makePetals(g, tree.blooms);
    state.fallRand = K.rng(ART_SEED + 3);
    prewarm(state.petals, g, state.fallRand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.sky, 0, 0);
    const mw = state.mist.width;
    const slide = (t * g.U * 0.55) % mw;
    ctx.globalAlpha = Math.min(1, api.props.mist * 0.62);
    ctx.drawImage(state.mist, slide, 0);
    ctx.drawImage(state.mist, slide - mw, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.tree, 0, 0);
    for (const b of state.birds) {
      stepBird(b, step);
      drawBird(ctx, g, b);
    }
    stepPetals(ctx, g, state.petals, t, step, api.props.petals, state.fallRand);
  }

  Kasuri.run({
    defaults: { petals: 1, mist: 1, ramp: 'kana', cell: 7, invert: true, bg: PAPER, tint: 0.8, gain: 1.05, dither: 0.25, boost: 0.2 },
    maxFps: 24,
    setup,
    draw,
  });
})();
