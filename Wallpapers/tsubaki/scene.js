/*
 * 椿 Tsubaki — a dark camellia heavy with red flowers in a snowy garden.
 *
 * The garden, the bush and the fallen flowers are baked once. Each frame slides
 * a few dozen flower sprites, a whole bloom dropping now and then, and a few
 * hundred snowflakes read from arrays filled in setup.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep, fbm } = K;

  const TAU = Math.PI * 2;
  const LIGHT = -2.2;
  const RED = ['#5e0f1c', '#b01b28', '#d42631', '#ee4238', '#fb9076'];
  const LEAF = ['#25604c', '#2f7259', '#3b8a6b', '#57a584'];
  const GLOSS = '#9ed6b9';
  const LEAF_BACK = '#1b4c3e';
  const SNOW = '#f1f2f1';
  const SNOW_SHADE = '#b4c0d2';
  const REGROW_START = 14;
  const REGROW_END = 44;
  const FALL_SLOTS = 2;
  const FALLEN_SLOTS = 5;
  const PUFFS = 48;

  // Flowers on the big bush: position inside its ellipse, radius in U, may it drop, snow on top.
  const BLOOMS = [
    [-0.2, 0.08, 17, false, true],
    [0.32, 0.36, 13.5, false, false],
    [0.12, -0.5, 12, false, true],
    [0.66, -0.12, 8.5, true, false],
    [-0.6, 0.4, 8, true, false],
    [-0.5, -0.36, 7, true, false],
    [0.72, 0.56, 6.5, true, false],
    [0.05, 0.86, 6.5, true, false],
    [0.42, -0.72, 5.5, false, false],
    [-0.14, -0.82, 5, false, false],
    [-0.84, -0.02, 5, false, false],
  ];

  // Closed buds tucked into the foliage, baked.
  const BUDS = [
    [0.3, -0.2], [-0.42, 0.04], [0.52, 0.12], [-0.3, -0.62], [0.72, -0.48],
    [-0.68, -0.22], [0.5, 0.72], [-0.3, 0.74], [0.2, -0.86], [0.88, 0.18],
  ];

  // Flowers lying on the snow, as fractions of the picture. Under the bush, thinning outward.
  const FALLEN = [
    [0.385, 0.765], [0.5, 0.79], [0.575, 0.765], [0.7, 0.8], [0.775, 0.772],
    [0.87, 0.825], [0.455, 0.872], [0.61, 0.872], [0.69, 0.925], [0.33, 0.915],
    [0.86, 0.945], [0.53, 0.985],
  ];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function oval(ctx, color, x, y, rx, ry, turn) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, turn, 0, TAU);
    ctx.fill();
  }

  function horizonAt(g, x) {
    return g.H * (0.63 + fbm(x * 0.012, 3.1, 3, 11) * 0.035);
  }

  function groundRadius(g, y) {
    const depth = smoothstep(g.H * 0.66, g.H, y);
    return g.U * lerp(3.4, 10, depth);
  }

  // ---- flowers

  function petalPath(ctx, len, wid) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.25, -wid * 0.9, len * 0.7, -wid * 1.15, len * 0.94, -wid * 0.38);
    ctx.quadraticCurveTo(len * 1.02, -wid * 0.08, len * 0.93, 0);
    ctx.quadraticCurveTo(len * 1.02, wid * 0.08, len * 0.94, wid * 0.38);
    ctx.bezierCurveTo(len * 0.7, wid * 1.15, len * 0.25, wid * 0.9, 0, 0);
  }

  function paintPetal(ctx, a, len, wid, tone, line) {
    ctx.save();
    ctx.rotate(a);
    petalPath(ctx, len, wid);
    ctx.fillStyle = RED[tone];
    ctx.strokeStyle = RED[0];
    ctx.lineWidth = line;
    ctx.fill();
    ctx.stroke();
    // One flat lighter lobe on the lit side, so petals read by shape, not by rings.
    ctx.translate(len * 0.3, -wid * 0.34);
    oval(ctx, RED[Math.min(4, tone + 1)], len * 0.24, 0, len * 0.33, wid * 0.36, -0.12);
    ctx.restore();
  }

  function paintRing(ctx, r, ring, rand) {
    const line = Math.max(0.6, r * 0.05);
    const start = rand() * TAU;
    for (let i = 0; i < ring.n; i++) {
      const a = start + (i / ring.n) * TAU + (rand() - 0.5) * 0.3;
      const lit = 0.5 + 0.5 * Math.cos(a - LIGHT);
      const shade = ring.cup ? 1 - lit : lit;
      const tone = 1 + Math.min(2, Math.floor(shade * 2.6));
      const len = r * ring.len * (0.86 + rand() * 0.22);
      paintPetal(ctx, a, len, r * ring.wid * (0.9 + rand() * 0.2), tone, line);
    }
  }

  // The stamens are a short thick tube: cream filaments, a gold crown standing off them.
  function paintStamens(ctx, x, y, r, tx, ty, rand) {
    const w = r * 0.25;
    oval(ctx, RED[0], x, y, w * 1.25, w * 1.25, 0);
    oval(ctx, '#f0e4bb', x, y, w * 1.02, w * 1.02, 0);
    const cx = x + tx * r * 0.5;
    const cy = y + ty * r * 0.5;
    oval(ctx, '#e3a91f', cx, cy, w * 0.9, w * 0.9, 0);
    const fleck = Math.max(1, r * 0.06);
    const count = Math.min(30, 6 + r * 2);
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * w * 0.95;
      ctx.fillStyle = i % 3 === 0 ? '#a26a14' : '#fbe27a';
      ctx.fillRect(cx + Math.cos(a) * d - fleck / 2, cy + Math.sin(a) * d - fleck / 2, fleck, fleck);
    }
  }

  // Each flower faces its own way: the whole thing is foreshortened along a random axis
  // and its heart slides toward the near side.
  function paintFlower(ctx, x, y, r, rand, faceUp) {
    const turn = rand() * TAU;
    const squash = faceUp ? 1 : 0.76 + rand() * 0.24;
    const shift = (1 - squash) * 0.7 + 0.04;
    const tx = -Math.sin(turn) * shift;
    const ty = Math.cos(turn) * shift;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn);
    ctx.scale(1, squash);
    ctx.rotate(-turn);
    oval(ctx, RED[0], 0, 0, r * 0.62, r * 0.62, 0);
    paintRing(ctx, r, { n: 5 + Math.floor(rand() * 2), len: 1.02, wid: 0.56, cup: false }, rand);
    ctx.translate(tx * r * 0.4, ty * r * 0.4);
    paintRing(ctx, r, { n: 4, len: 0.62, wid: 0.42, cup: true }, rand);
    paintStamens(ctx, tx * r * 0.2, ty * r * 0.2, r, tx, ty, rand);
    ctx.restore();
  }

  function paintFlowerSnow(ctx, x, y, r, rand) {
    for (let i = 0; i < 6; i++) {
      const a = -2.5 + (i / 5) * 1.9;
      const px = x + Math.cos(a) * r * 0.82;
      const py = y + Math.sin(a) * r * 0.82;
      const w = r * (0.13 + rand() * 0.12);
      oval(ctx, SNOW_SHADE, px, py + w * 0.35, w * 1.4, w * 0.8, a + 1.57);
      oval(ctx, SNOW, px, py, w * 1.3, w * 0.72, a + 1.57);
    }
  }

  function makeFlower(r, rand, capped) {
    const half = Math.ceil(r * 1.25);
    const c = layer(half * 2, half * 2);
    const ctx = c.getContext('2d');
    paintFlower(ctx, half, half, r, rand);
    if (capped) paintFlowerSnow(ctx, half, half, r, rand);
    return { c, half };
  }

  // ---- leaves and bushes

  function paintLeaf(ctx, x, y, a, len, wid, tone, shine) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
    ctx.fill();
    if (shine) {
      ctx.strokeStyle = shine;
      ctx.lineWidth = Math.max(0.6, wid * 0.42);
      ctx.beginPath();
      ctx.moveTo(len * 0.18, -wid * 0.26);
      ctx.quadraticCurveTo(len * 0.5, -wid * 0.5, len * 0.84, -wid * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintClumpLeaves(ctx, u, x, y, r, rand) {
    const count = Math.round((r * r) / (u * u) * 0.5);
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r;
      const lx = x + Math.cos(a) * d * 1.08;
      const ly = y + Math.sin(a) * d * 0.9;
      const lit = (y - ly) / r * 0.55 + (x - lx) / r * 0.25 + rand() * 0.55 + 0.1;
      const tone = LEAF[Math.max(0, Math.min(3, Math.floor(lit * 3.3)))];
      const shine = lit > 0.3 && rand() < 0.6 ? GLOSS : null;
      const dir = (rand() < 0.6 ? a : rand() * TAU) + (rand() - 0.5) * 1.8;
      paintLeaf(ctx, lx, ly, dir, u * (3.8 + rand() * 1.9), u * (1.25 + rand() * 0.5), tone, shine);
    }
  }

  function paintClumpSnow(ctx, u, x, y, r, rand, tops) {
    const span = 0.9 + rand() * 0.9;
    const mid = -1.57 + (rand() - 0.5) * 0.7;
    const dabs = Math.max(5, Math.round(r / u * 1.1));
    for (let pass = 0; pass < 2; pass++) {
      const tone = pass ? SNOW : SNOW_SHADE;
      const rand2 = K.rng(Math.floor(x * 31 + y * 17) + 3);
      for (let i = 0; i < dabs; i++) {
        const a = mid - span / 2 + (i / (dabs - 1)) * span;
        const px = x + Math.cos(a) * r * 0.86;
        const py = y + Math.sin(a) * r * 0.78 + (pass ? 0 : u * 0.8);
        oval(ctx, tone, px, py, u * (2 + rand2() * 2), u * (1.1 + rand2() * 1.3), a + 1.57);
      }
    }
    if (tops) tops.push(x + Math.cos(mid) * r * 0.86, y + Math.sin(mid) * r * 0.78);
  }

  function paintClump(ctx, u, x, y, r, rand, snowy, tops) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rand();
      const w = r * (0.42 + rand() * 0.26);
      oval(ctx, LEAF_BACK, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.38, w, w, 0);
    }
    paintClumpLeaves(ctx, u, x, y, r, rand);
    if (snowy) paintClumpSnow(ctx, u, x, y, r, rand, tops);
  }

  function paintBush(ctx, g, b, rand, tops) {
    const u = g.U;
    const base = u * b.clump;
    const count = Math.round(((b.rx * b.ry) / (base * base)) * 3.4);
    const list = [];
    oval(ctx, LEAF_BACK, b.x, b.y - b.ry * 0.04, b.rx * 0.88, b.ry * 0.86, 0);
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const d = Math.pow(rand(), 0.42);
      const dy = Math.sin(a) * d * b.ry;
      list.push({ x: b.x + Math.cos(a) * d * b.rx, y: b.y + (dy > 0 ? dy * 0.68 : dy), r: base * (0.72 + rand() * 0.6) });
    }
    list.sort((p, q) => p.y - q.y);
    for (const p of list) {
      const high = 1 - smoothstep(b.y - b.ry * 0.2, b.y + b.ry, p.y);
      paintClump(ctx, u, p.x, p.y, p.r, rand, rand() < 0.26 + high * 0.5, tops);
    }
  }

  function paintBloomSeat(ctx, u, x, y, r, rand) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rand() * 0.6;
      const tone = LEAF[Math.floor(rand() * 2) + (Math.sin(a) < 0 ? 2 : 0)];
      const len = r * 1.32 + u * rand() * 2;
      paintLeaf(ctx, x, y, a, len, Math.max(u, r * 0.3), tone, rand() < 0.5 ? GLOSS : null);
    }
  }

  function paintBud(ctx, u, x, y, rand) {
    const r = u * (2.2 + rand() * 1.2);
    const a = -1.57 + (rand() - 0.5) * 1.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    oval(ctx, LEAF[1], -r * 0.3, 0, r * 0.9, r * 0.8, 0);
    oval(ctx, RED[2], r * 0.3, 0, r * 1, r * 0.66, 0);
    oval(ctx, RED[3], r * 0.46, -r * 0.2, r * 0.46, r * 0.24, 0);
    ctx.restore();
  }

  // Leaves in front of the flowers, in their own layer, so blooms sit in the bush, not on it.
  function bakeOverlay(g, sites, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    for (const s of sites) {
      if (s.r < u * 6) continue;
      const count = s.r > u * 10 ? 4 : 2;
      const start = 0.3 + rand() * 1.4;
      for (let i = 0; i < count; i++) {
        const a = start + i * 0.6 + rand() * 0.25;
        const x = s.x + Math.cos(a) * s.r * 1.28;
        const y = s.y + Math.sin(a) * s.r * 1.28;
        const dir = a + Math.PI + (rand() - 0.5) * 0.8;
        const tone = LEAF[1 + Math.floor(rand() * 3)];
        paintLeaf(ctx, x, y, dir, s.r * 0.55 + u * 2, u * 1.7, tone, GLOSS);
      }
    }
    return c;
  }

  function paintTrunks(ctx, g, b) {
    const u = g.U;
    const foot = b.foot;
    const crown = b.y + b.ry * 0.4;
    ctx.fillStyle = '#6d6056';
    for (const lean of [-1, 0.25, 1]) {
      const x = b.x + lean * u * 3;
      const w = u * (lean === 0.25 ? 1.7 : 1.15);
      ctx.beginPath();
      ctx.moveTo(x - w, foot + u * 0.5);
      ctx.quadraticCurveTo(x - w * 0.6, foot - u * 6, x + lean * u * 16 - w * 0.5, crown);
      ctx.lineTo(x + lean * u * 16 + w * 0.5, crown);
      ctx.quadraticCurveTo(x + w * 0.6, foot - u * 6, x + w, foot + u * 0.5);
      ctx.fill();
    }
  }

  // ---- garden

  function paintCedar(ctx, x, foot, h, w, tone, cap, rand) {
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers;
      const top = foot - h + f * h * 0.82;
      const bottom = top + h * 0.34;
      const half = w * (0.25 + f * 0.75);
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.quadraticCurveTo(x + half * 0.4, top + (bottom - top) * 0.7, x + half, bottom);
      ctx.quadraticCurveTo(x, bottom - h * 0.05, x - half, bottom);
      ctx.quadraticCurveTo(x - half * 0.4, top + (bottom - top) * 0.7, x, top);
      ctx.fill();
      oval(ctx, cap, x + (rand() - 0.5) * half * 0.5, top + h * 0.1, half * 0.5, h * 0.022, 0);
    }
  }

  function paintSky(ctx, g, rand) {
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.66);
    sky.addColorStop(0, '#a3b2c6');
    sky.addColorStop(1, '#d8dcdd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    const stand = g.H * 0.6;
    for (let row = 0; row < 2; row++) {
      const tone = row ? '#6f8498' : '#98a9b7';
      const cap = row ? '#d0d8de' : '#d6dce1';
      const scale = row ? 1 : 0.75;
      for (let x = -g.U * 6; x < g.W + g.U * 8;) {
        const h = g.U * (36 + rand() * 22) * scale;
        paintCedar(ctx, x, stand, h, g.U * (7 + rand() * 3) * scale, tone, cap, rand);
        x += g.U * (8 + rand() * 11) * scale;
      }
    }
  }

  function paintWall(ctx, g, rand) {
    const u = g.U;
    const top = g.H * 0.545;
    const foot = g.H * 0.66;
    ctx.fillStyle = '#d0c9b6';
    ctx.fillRect(0, top, g.W, foot - top);
    ctx.fillStyle = '#bdb6a3';
    for (let i = 0; i < g.W / (u * 2); i++) {
      ctx.fillRect(rand() * g.W, top + rand() * (foot - top), u * (2 + rand() * 7), Math.max(1, u * 0.5));
    }
    ctx.fillStyle = '#4a5362';
    ctx.fillRect(0, top - u * 1.6, g.W, u * 2.4);
    ctx.fillStyle = SNOW_SHADE;
    ctx.fillRect(0, top - u * 2, g.W, u * 1.4);
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(0, top - u * 1.8);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, top - u * (3 + fbm(x * 0.05, 7.7, 3, 4) * 3.5));
    ctx.lineTo(g.W, top - u * 1.4);
    ctx.lineTo(0, top - u * 1.4);
    ctx.fill();
  }

  function groundPath(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, horizonAt(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
  }

  // Blue drift shadows on a half-size map, quantized to a few flat tones.
  function bakeDrifts(g) {
    const top = Math.floor(g.H * 0.6);
    const w = Math.ceil(g.W / 2);
    const h = Math.ceil((g.H - top) / 2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const tones = ['#c2ccda', '#d3d9e2', '#e2e5ea', '#ecedee', '#f4f4f1'];
    for (let y = 0; y < h; y++) {
      const depth = (y + 8) / (h + 8);
      const scale = 0.09 / (depth * g.U);
      for (let x = 0; x < w; x++) {
        const v = fbm(x * scale * 0.6, (1 / depth) * 1.5, 3, 21);
        const lift = v * 1.5 - 0.2 + depth * 0.25;
        const i = Math.max(0, Math.min(4, Math.round(lift * 4)));
        ctx.fillStyle = tones[i];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return { c, top };
  }

  function paintGround(ctx, g) {
    const drifts = bakeDrifts(g);
    ctx.save();
    groundPath(ctx, g);
    ctx.clip();
    ctx.drawImage(drifts.c, 0, drifts.top, g.W, g.H - drifts.top);
    ctx.restore();
  }

  function paintLanternBody(ctx, u, x, y) {
    ctx.fillStyle = '#596170';
    for (const side of [-1, 0, 1]) {
      const foot = x + side * u * 11;
      const head = x + side * u * 3.4;
      ctx.beginPath();
      ctx.moveTo(foot - u * 1.7, y);
      ctx.quadraticCurveTo(foot - side * u * 1.5 - u * 1.2, y - u * 9, head - u * 1.6, y - u * 14);
      ctx.lineTo(head + u * 1.6, y - u * 14);
      ctx.quadraticCurveTo(foot - side * u * 1.5 + u * 1.2, y - u * 9, foot + u * 1.7, y);
      ctx.fill();
    }
    ctx.fillStyle = '#7f8693';
    ctx.fillRect(x - u * 7.5, y - u * 16.5, u * 15, u * 3);
    ctx.fillStyle = '#747b88';
    ctx.fillRect(x - u * 5.6, y - u * 25, u * 11.2, u * 8.8);
    ctx.fillStyle = '#39414f';
    ctx.fillRect(x - u * 2.8, y - u * 23.6, u * 5.6, u * 6);
    ctx.fillStyle = '#979eaa';
    ctx.fillRect(x - u * 5.6, y - u * 25, u * 1.4, u * 8.8);
  }

  function paintLantern(ctx, u, x, y) {
    oval(ctx, '#b6c1d1', x + u, y + u * 0.3, u * 16, u * 2.8, 0);
    paintLanternBody(ctx, u, x, y);
    ctx.fillStyle = '#4e5664';
    ctx.beginPath();
    ctx.moveTo(x - u * 18, y - u * 23);
    ctx.quadraticCurveTo(x - u * 9, y - u * 26, x, y - u * 32);
    ctx.quadraticCurveTo(x + u * 9, y - u * 26, x + u * 18, y - u * 23);
    ctx.quadraticCurveTo(x, y - u * 25.5, x - u * 18, y - u * 23);
    ctx.fill();
    ctx.fillStyle = SNOW_SHADE;
    ctx.beginPath();
    ctx.moveTo(x - u * 17, y - u * 25.4);
    ctx.bezierCurveTo(x - u * 11, y - u * 36, x + u * 11, y - u * 38, x + u * 17, y - u * 25.6);
    ctx.quadraticCurveTo(x, y - u * 27, x - u * 17, y - u * 25.4);
    ctx.fill();
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(x - u * 16.5, y - u * 26.6);
    ctx.bezierCurveTo(x - u * 11, y - u * 37, x + u * 11, y - u * 39, x + u * 16.5, y - u * 26.8);
    ctx.quadraticCurveTo(x, y - u * 29, x - u * 16.5, y - u * 26.6);
    ctx.fill();
  }

  function paintFallen(ctx, g, x, y, r, rand) {
    const u = g.U;
    oval(ctx, '#aab6c8', x + u * 0.5, y + r * 0.16, r * 1.08, r * 0.64, 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.64);
    paintFlower(ctx, 0, 0, r, rand, true);
    ctx.restore();
    if (rand() < 0.3) paintFallenSnow(ctx, x, y, r, rand);
  }

  function paintFallenSnow(ctx, x, y, r, rand) {
    const side = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const px = x + side * r * (0.5 + rand() * 0.42);
      const py = y + r * (0.02 + rand() * 0.34);
      oval(ctx, SNOW, px, py, r * (0.1 + rand() * 0.13), r * (0.05 + rand() * 0.05), 0);
    }
  }

  function heroBush(g) {
    const rx = Math.max(g.H * 0.52, g.W * 0.31);
    return { x: g.W * 0.62, y: g.H * 0.39, rx, ry: g.H * 0.28, foot: g.H * 0.73, clump: 8.5 };
  }

  function bakeFront(g, hero, sites, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintWall(ctx, g, rand);
    paintGround(ctx, g);
    paintBush(ctx, g, { x: -g.W * 0.01, y: g.H * 0.6, rx: g.H * 0.2, ry: g.H * 0.12, clump: 7.5 }, rand, null);
    paintLantern(ctx, u, g.W * 0.175, g.H * 0.77);
    oval(ctx, '#b0bccd', hero.x, hero.foot + u, hero.rx * 0.84, u * 5.5, 0);
    paintTrunks(ctx, g, hero);
    state.tops = [];
    paintBush(ctx, g, hero, rand, state.tops);
    for (const s of sites) paintBloomSeat(ctx, u, s.x, s.y, s.r, rand);
    for (const [fx, fy] of BUDS) paintBud(ctx, u, hero.x + fx * hero.rx, hero.y + fy * hero.ry * (fy > 0 ? 0.76 : 1), rand);
    for (const [fx, fy] of FALLEN) {
      const y = g.H * fy;
      paintFallen(ctx, g, g.W * fx, y, groundRadius(g, y) * (0.82 + rand() * 0.3), rand);
    }
    paintForeground(ctx, g, rand);
    return c;
  }

  // A low shrub cut by the corner of the picture, nearest thing to the viewer.
  function paintForeground(ctx, g, rand) {
    const u = g.U;
    paintBush(ctx, g, { x: g.W * 0.035, y: g.H * 1.0, rx: Math.max(g.W * 0.12, u * 24), ry: g.H * 0.11, clump: 8 }, rand, null);
    const x = g.W * 0.085;
    const y = g.H * 0.925;
    const r = u * 10;
    paintBloomSeat(ctx, u, x, y, r, rand);
    paintFlower(ctx, x, y, r, rand);
    paintFlowerSnow(ctx, x, y, r, rand);
  }

  function bakeBack(g, rand) {
    const c = layer(g.W, g.H);
    paintSky(c.getContext('2d'), g, rand);
    return c;
  }

  function makeSites(g, hero, rand) {
    return BLOOMS.map(([fx, fy, r, drops, capped]) => {
      const rPx = g.U * r;
      const sprite = makeFlower(rPx, rand, capped);
      return {
        x: hero.x + fx * hero.rx,
        y: hero.y + fy * hero.ry * (fy > 0 ? 0.76 : 1),
        r: rPx,
        drops,
        sprite,
        age: 100,
        phase: rand() * TAU,
      };
    });
  }

  // ---- moving things

  function makeFlakes(g, n, rand, v0, v1, a0, a1) {
    const arr = () => new Float32Array(n);
    const f = { n, x: arr(), y: arr(), v: arr(), a: arr(), w: arr(), p: arr() };
    for (let i = 0; i < n; i++) {
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.H;
      f.v[i] = g.U * lerp(v0, v1, rand());
      f.a[i] = g.U * lerp(a0, a1, rand());
      f.w[i] = 0.3 + rand() * 0.6;
      f.p[i] = rand() * TAU;
    }
    return f;
  }

  function drawFlakes(ctx, g, f, t, amount, size, wind, sprite) {
    const count = Math.min(f.n, Math.round(f.n * amount * 0.5));
    const m = size + 2;
    for (let i = 0; i < count; i++) {
      const y = (f.y[i] + t * f.v[i]) % (g.H + m);
      const raw = f.x[i] + Math.sin(t * f.w[i] + f.p[i]) * f.a[i] + t * g.U * wind;
      const x = ((raw % (g.W + m)) + g.W + m) % (g.W + m);
      if (sprite) ctx.drawImage(sprite, x - m / 2, y - m / 2);
      else ctx.fillRect(x - m / 2, y - m / 2, size, size);
    }
  }

  function makeRound(r) {
    const c = layer(r * 2 + 2, r * 2 + 2);
    const ctx = c.getContext('2d');
    oval(ctx, SNOW, r + 1, r + 1, r, r, 0);
    return c;
  }

  function makePuffs() {
    const arr = () => new Float32Array(PUFFS);
    return { x: arr(), y: arr(), vx: arr(), vy: arr(), life: arr(), next: 0 };
  }

  function emitPuff(g, x, y, count, spread, lift) {
    const p = state.puffs;
    const rand = state.rand;
    for (let k = 0; k < count; k++) {
      const i = p.next;
      p.next = (p.next + 1) % PUFFS;
      p.x[i] = x + (rand() - 0.5) * spread;
      p.y[i] = y + (rand() - 0.5) * g.U;
      p.vx[i] = (rand() - 0.5) * g.U * 8;
      p.vy[i] = -rand() * g.U * lift;
      p.life[i] = 0.7 + rand() * 0.8;
    }
  }

  function drawPuffs(ctx, g, dt) {
    const p = state.puffs;
    const size = Math.max(1, g.U * 0.9);
    ctx.fillStyle = SNOW;
    for (let i = 0; i < PUFFS; i++) {
      if (p.life[i] <= 0) continue;
      p.life[i] -= dt;
      p.vy[i] += g.U * 26 * dt;
      p.x[i] += p.vx[i] * dt;
      p.y[i] += p.vy[i] * dt;
      ctx.globalAlpha = Math.min(1, Math.max(0, p.life[i]) * 1.6);
      ctx.fillRect(p.x[i], p.y[i], size, size);
    }
    ctx.globalAlpha = 1;
  }

  function launchBloom(g) {
    let fall = null;
    for (const s of state.falls) if (!s.active) fall = s;
    const rand = state.rand;
    const list = state.droppers;
    let site = null;
    const from = Math.floor(rand() * list.length);
    for (let i = 0; i < list.length && !site; i++) {
      const s = list[(from + i) % list.length];
      if (s.age > REGROW_END) site = s;
    }
    if (!fall || !site) return;
    site.age = 0;
    fall.active = true;
    fall.site = site;
    fall.f = 0;
    fall.dur = 3.6 + rand() * 1.2;
    fall.x0 = site.x;
    fall.y0 = site.y;
    fall.x1 = site.x + (rand() - 0.5) * g.U * 18;
    fall.y1 = g.H * (0.74 + rand() * 0.2);
    fall.r1 = groundRadius(g, fall.y1) * 0.95;
    fall.spin = (rand() < 0.5 ? -1 : 1) * (1.6 + rand() * 1.8);
    fall.phase = rand() * TAU;
    emitPuff(g, site.x, site.y - site.r * 0.5, 9, site.r * 1.4, 4);
  }

  function landBloom(g, fall) {
    fall.active = false;
    let slot = state.fallen[0];
    for (const s of state.fallen) if (s.age > slot.age) slot = s;
    slot.age = 0;
    slot.site = fall.site;
    slot.x = fall.x1;
    slot.y = fall.y1;
    slot.r = fall.r1;
    emitPuff(g, fall.x1, fall.y1, 12, fall.r1 * 1.3, 14);
  }

  function drawBloomAt(ctx, site, x, y, r, rot, squash) {
    const s = r / site.r;
    const half = site.sprite.half * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, squash);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(site.sprite.c, -half, -half, half * 2, half * 2);
    ctx.restore();
  }

  function drawGroundShadow(ctx, x, y, r, alpha) {
    ctx.globalAlpha = alpha;
    oval(ctx, '#a4b1c4', x, y + r * 0.2, r * 1.08, r * 0.6, 0);
    ctx.globalAlpha = 1;
  }

  function drawFalls(ctx, g, dt) {
    for (const fall of state.falls) {
      if (!fall.active) continue;
      fall.f = Math.min(1, fall.f + dt / fall.dur);
      const f = fall.f;
      const eased = f * f * 0.72 + f * 0.28;
      const x = lerp(fall.x0, fall.x1, f) + Math.sin(f * 6.3 + fall.phase) * g.U * 2.5 * (1 - f);
      const y = lerp(fall.y0, fall.y1, eased);
      const r = lerp(fall.site.r, fall.r1, f);
      const squash = 0.64 + 0.36 * Math.abs(Math.cos(f * Math.PI * 2.5));
      if (f > 0.55) drawGroundShadow(ctx, fall.x1, fall.y1, fall.r1, (f - 0.55) * 2);
      drawBloomAt(ctx, fall.site, x, y, r, fall.spin * (1 - f) * 3.2, squash);
      if (f >= 1) landBloom(g, fall);
    }
  }

  function drawFallen(ctx, dt) {
    for (const s of state.fallen) {
      s.age += dt;
      if (!s.site || s.age > 90) continue;
      const alpha = 1 - smoothstep(45, 90, s.age);
      drawGroundShadow(ctx, s.x, s.y, s.r, alpha);
      ctx.globalAlpha = alpha;
      drawBloomAt(ctx, s.site, s.x, s.y, s.r, 0, 0.64);
      ctx.globalAlpha = 1;
    }
  }

  function drawSites(ctx, g, t, dt) {
    const sway = g.U * 0.4;
    for (const s of state.sites) {
      s.age += dt;
      const grow = s.age > REGROW_END ? 1 : smoothstep(REGROW_START, REGROW_END, s.age);
      if (grow < 0.05) continue;
      const half = s.sprite.half * grow;
      const x = s.x + Math.sin(t * 0.47 + s.phase) * sway;
      const y = s.y + Math.sin(t * 0.61 + s.phase * 2) * sway * 0.6;
      ctx.drawImage(s.sprite.c, x - half, y - half, half * 2, half * 2);
    }
  }

  function stepTimers(g, dt, drops) {
    state.wait -= dt;
    if (drops > 0 && state.wait <= 0) {
      launchBloom(g);
      state.wait = (9 + state.rand() * 7) / drops;
    }
    state.slide -= dt;
    if (state.slide <= 0 && state.tops.length) {
      const i = Math.floor(state.rand() * (state.tops.length / 2)) * 2;
      emitPuff(g, state.tops[i], state.tops[i + 1], 7, g.U * 5, 2);
      state.slide = 2 + state.rand() * 3;
    }
  }

  function makeFall() {
    return { active: false, site: null, f: 0, dur: 1, x0: 0, y0: 0, x1: 0, y1: 0, r1: 1, spin: 0, phase: 0 };
  }

  function setupMotion(g, sites, rand) {
    const k = Math.max(0.6, Math.min(1.4, (g.W * g.H) / 30000));
    state.far = makeFlakes(g, Math.round(260 * k), rand, 4, 7, 0.6, 2);
    state.mid = makeFlakes(g, Math.round(200 * k), rand, 9, 14, 1, 3);
    state.near = makeFlakes(g, 40, rand, 19, 27, 2, 5);
    state.round = makeRound(Math.max(1, g.U * 1.25));
    state.puffs = makePuffs();
    state.droppers = sites.filter((s) => s.drops);
    state.falls = [];
    for (let i = 0; i < FALL_SLOTS; i++) state.falls.push(makeFall());
    state.fallen = [];
    for (let i = 0; i < FALLEN_SLOTS; i++) state.fallen.push({ age: 1000, site: null, x: 0, y: 0, r: 1 });
    state.wait = 1.5;
    state.slide = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const hero = heroBush(g);
    state.g = g;
    state.rand = rand;
    state.sites = makeSites(g, hero, rand);
    state.back = bakeBack(g, rand);
    state.front = bakeFront(g, hero, state.sites, rand);
    state.over = bakeOverlay(g, state.sites, rand);
    state.farSize = Math.max(1, g.U * 0.6);
    state.midSize = Math.max(1, g.U * 1.25);
    setupMotion(g, state.sites, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const step = Math.min(0.1, Math.max(0, dt));
    const snow = api.props.snow;
    stepTimers(g, step, api.props.drops);
    ctx.drawImage(state.back, 0, 0);
    ctx.fillStyle = '#d9dee4';
    drawFlakes(ctx, g, state.far, t, snow, state.farSize, 0.9, null);
    ctx.drawImage(state.front, 0, 0);
    drawSites(ctx, g, t, step);
    ctx.drawImage(state.over, 0, 0);
    drawFallen(ctx, step);
    drawFalls(ctx, g, step);
    drawPuffs(ctx, g, step);
    ctx.fillStyle = SNOW;
    drawFlakes(ctx, g, state.mid, t, snow, state.midSize, 0.9, null);
    ctx.globalAlpha = 0.82;
    drawFlakes(ctx, g, state.near, t, snow, state.round.width, 1.5, state.round);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { snow: 1, drops: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
