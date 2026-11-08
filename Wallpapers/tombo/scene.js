/*
 * 蜻蛉 Tombo — dragonflies among tall reeds at the edge of a late-summer pond.
 *
 * The hills and water are baked small and scaled up, which blurs them for free.
 * Every reed, leaf, wing and body is a sprite turned with one drawImage, so a
 * step of the animation is a couple of hundred image draws and no per-cell work.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const SS = 2;
  const MAX_FLUFF = 130;
  const PERCH_PITCH = 0.14;
  const PERCHED = 0;
  const DART = 1;
  const HOVER = 2;
  const SETTLE = 3;

  // Tip positions as fractions of the picture. Rear reeds are thin and hazy.
  const REEDS = [
    { x: 0.13, y: 0.3, w: 1.1, kind: 'plume', bow: 6, rear: true, blades: 2 },
    { x: 0.33, y: 0.25, w: 1.1, kind: 'plume', bow: -5, rear: true, blades: 2 },
    { x: 0.405, y: 0.14, w: 1.1, kind: 'gama', bow: 6, rear: true, blades: 1 },
    { x: 0.67, y: 0.13, w: 1.1, kind: 'gama', bow: -6, rear: true, blades: 2 },
    { x: 0.9, y: 0.28, w: 1.1, kind: 'plume', bow: 8, rear: true, blades: 2 },
    { x: 0.55, y: 0.47, w: 2.5, kind: 'gama', bow: -9, face: -1, blades: 2, top: 0.34 },
    { x: 0.25, y: 0.29, w: 2.2, kind: 'spike', bow: 11, face: 1, blades: 3, top: 0.62 },
    { x: 0.39, y: 0.63, w: 2.2, kind: 'spike', bow: -7, face: 1, blades: 1, top: 0.4 },
    { x: 0.81, y: 0.25, w: 2.3, kind: 'gama', bow: 10, face: -1, blades: 3, top: 0.56 },
    { x: 0.94, y: 0.55, w: 2.3, kind: 'spike', bow: -8, face: -1, blades: 2, top: 0.6 },
    { x: 0.07, y: 0.52, w: 2.4, kind: 'gama', bow: 7, face: 1, blades: 3, top: 0.56 },
    { x: 0.68, y: 0.74, w: 2.0, kind: 'spike', bow: 6, face: -1, blades: 1, top: 0.5 },
  ];

  const REAR_INK = { low: '#50786a', mid: '#7e8c60', high: '#a09c68', lit: '#c0b888', dark: '#3e6058' };
  const MAIN_INK = { low: '#2f5236', mid: '#7f9145', high: '#dcc065', lit: '#f2e29a', dark: '#2a4230' };

  const RED = {
    back: '#d9452a', belly: '#7e2316', ring: '#34140f', thorax: '#b0432a', stripe: '#2a1510',
    eye: '#bf3f28', eyeLow: '#e4a06a', lit: '#f2926a', stigma: '#6e2014',
    base: 'rgba(226,150,70,0.72)', film: 'rgba(248,240,214,0.6)', vein: 'rgba(58,32,24,0.75)',
  };
  const TEAL = {
    back: '#2ea59c', belly: '#125250', ring: '#0d2528', thorax: '#59a85c', stripe: '#14302a',
    eye: '#37b3a8', eyeLow: '#a6e0c6', lit: '#8fe0cf', stigma: '#123a3a',
    base: 'rgba(170,215,190,0.6)', film: 'rgba(232,246,232,0.6)', vein: 'rgba(16,44,48,0.75)',
  };
  const RUST = {
    back: '#e0702c', belly: '#84401a', ring: '#3a1e10', thorax: '#b86a30', stripe: '#2e1a10',
    eye: '#c9622e', eyeLow: '#ecb67c', lit: '#f6ad6e', stigma: '#6a3414',
    base: 'rgba(232,176,92,0.66)', film: 'rgba(248,240,214,0.6)', vein: 'rgba(60,38,20,0.75)',
  };

  // size is body length in units of g.U. perches index into REEDS.
  const FLIES = [
    { ink: RED, size: 46, perches: [5, 7], rest: [18, 34], start: PERCHED, perch: 5, clock: 26 },
    { ink: TEAL, size: 37, perches: [8, 6, 11], rest: [7, 15], start: HOVER, at: [0.33, 0.47], clock: 2 },
    { ink: RED, size: 27, perches: [6, 10, 7], rest: [6, 16], start: PERCHED, perch: 6, clock: 5 },
    { ink: TEAL, size: 24, perches: [10, 9, 11], rest: [8, 18], start: PERCHED, perch: 9, clock: 12 },
    { ink: RUST, size: 25, perches: [8, 9, 6], rest: [6, 14], start: PERCHED, perch: 8, clock: 8 },
  ];

  // Roots sit on the thorax; angles are radians from the head end of the body.
  const WINGS = [
    { hind: false, far: true, x: 0.04, a: -1.2, len: 0.78, chord: 0.8 },
    { hind: true, far: true, x: -0.03, a: -1.72, len: 0.76, chord: 0.8 },
    { hind: true, far: false, x: -0.03, a: 1.72, len: 1, chord: 1 },
    { hind: false, far: false, x: 0.04, a: 1.26, len: 1, chord: 1 },
  ];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Paints in picture units onto a small canvas; scaled up later, that is the blur.
  function soft(g, blur, paint) {
    const shrink = Math.max(1, g.U * blur);
    const c = layer(g.W / shrink, g.H / shrink);
    const ctx = c.getContext('2d');
    ctx.scale(c.width / g.W, c.height / g.H);
    paint(ctx);
    return c;
  }

  // Scales a small layer up in two steps, so the blur has no staircase in it.
  function spread(ctx, g, small) {
    const mid = layer(Math.min(g.W, small.width * 2.2), Math.min(g.H, small.height * 2.2));
    const m = mid.getContext('2d');
    m.imageSmoothingQuality = 'high';
    m.drawImage(small, 0, 0, mid.width, mid.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mid, 0, 0, g.W, g.H);
  }

  function ridge(ctx, g, y, amp, freq, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-4, g.H);
    const step = g.W / 70;
    for (let x = -4; x <= g.W + step; x += step) {
      ctx.lineTo(x, g.H * y - smoothstep(0.12, 0.88, fbm((x / g.U) * freq, seed, 4, seed)) * g.U * amp);
    }
    ctx.lineTo(g.W + 4, g.H);
    ctx.fill();
  }

  function paintSky(ctx, g) {
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.34);
    sky.addColorStop(0, '#b6c4b4');
    sky.addColorStop(1, '#f0dfac');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ridge(ctx, g, 0.36, 26, 0.011, 3, '#a4b8ac');
    ridge(ctx, g, 0.41, 24, 0.017, 8, '#7fa297');
    ridge(ctx, g, 0.44, 14, 0.03, 12, '#5f8c78');
    ridge(ctx, g, 0.455, 5, 0.09, 17, '#4a7560');
  }

  function paintWater(ctx, g) {
    const top = g.H * 0.44;
    const water = ctx.createLinearGradient(0, top, 0, g.H);
    water.addColorStop(0, '#c4cfae');
    water.addColorStop(0.18, '#92b8aa');
    water.addColorStop(0.55, '#649ca0');
    water.addColorStop(1, '#488292');
    ctx.fillStyle = water;
    ctx.fillRect(0, top, g.W, g.H - top);
    paintMirror(ctx, g, top);
  }

  // The hills again, upside down and fainter, under the far shore.
  function paintMirror(ctx, g, top) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#6c9880';
    ctx.beginPath();
    ctx.moveTo(-4, top - 1);
    const step = g.W / 60;
    for (let x = -4; x <= g.W + step; x += step) {
      ctx.lineTo(x, top + fbm((x / g.U) * 0.026, 12, 4, 12) * g.U * 15);
    }
    ctx.lineTo(g.W + 4, top - 1);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Low sun on the water, broken into thin soft dashes that widen toward the viewer.
  function paintSunPath(ctx, g, rand) {
    const top = g.H * 0.46;
    const x = g.W * 0.28;
    ctx.fillStyle = '#fbe6a6';
    for (let i = 0; i < 40; i++) {
      const f = Math.pow(rand(), 0.85);
      const reach = g.U * (4 + f * 20);
      const half = g.U * (2 + f * 8) * (0.5 + rand() * 0.8);
      ctx.globalAlpha = lerp(0.5, 0.16, f);
      ctx.beginPath();
      ctx.ellipse(x + (rand() - 0.5) * 2 * reach, top + f * (g.H - top), half, g.U * (0.8 + f * 1.1), 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function softBlade(ctx, x, y, h, lean, w, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.5 + lean * 0.25, y - h * 0.6, x + lean, y - h);
    ctx.quadraticCurveTo(x + w * 0.5 + lean * 0.25, y - h * 0.6, x + w, y);
    ctx.fill();
  }

  // The far bank: a soft mass of out-of-focus reeds at both sides, water open between.
  function paintBank(ctx, g, rand) {
    const tones = ['#5a8058', '#6f8c55', '#94a25c', '#4e7458'];
    const count = Math.round((g.W / g.U) * 1.5);
    for (let i = 0; i < count; i++) {
      const f = i / count;
      const edge = Math.pow(Math.abs(f - 0.5) * 2, 1.7);
      if (edge < 0.05) continue;
      const foot = g.H * (0.82 + rand() * 0.2);
      const h = g.U * (10 + edge * 44 + rand() * 12);
      ctx.globalAlpha = 0.55 + edge * 0.45;
      softBlade(ctx, f * g.W, foot, h, g.U * (rand() - 0.5) * 8, g.U * (0.9 + rand() * 1.1), tones[i % tones.length]);
    }
    ctx.globalAlpha = 1;
  }

  // Near leaves, well out of focus, so the reeds grow out of something.
  function paintFront(ctx, g, rand) {
    const tones = ['#34583c', '#446c40', '#5a8044', '#2e5038'];
    const count = Math.round((g.W / g.U) * 1.1);
    for (let i = 0; i < count; i++) {
      const f = i / count;
      const edge = Math.pow(Math.abs(f - 0.46) * 2, 2.4);
      const h = g.U * (4 + rand() * 7 + edge * 34 * (0.5 + rand() * 0.5));
      softBlade(ctx, f * g.W, g.H + g.U, h, g.U * (rand() - 0.5) * 12, g.U * (1 + rand() * 1.6), tones[i % tones.length]);
    }
  }

  function paintBackdrop(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const painted = soft(g, 3.4, (s) => {
      paintSky(s, g);
      paintWater(s, g);
    });
    spread(ctx, g, painted);
    spread(ctx, g, soft(g, 1.8, (s) => paintSunPath(s, g, rand)));
    return c;
  }

  // Bright ripple bands that tile sideways; thin at the far shore, wide up close.
  function paintRipples(g) {
    const w = Math.ceil((g.W * 1.5) / 2);
    const h = Math.ceil((g.H * 0.57) / 2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const u = g.U / 2;
    const density = (x, y) => {
      const f = y / h;
      return fbm(((x / u) * 0.05) / (0.3 + f * 1.1), Math.pow(f, 0.55) * 15, 3, 31);
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 214;
        img.data[i + 1] = 224;
        img.data[i + 2] = 196;
        img.data[i + 3] = (Math.round(smoothstep(0.5, 0.7, v) * 4) / 4) * 56 * smoothstep(0, 0.14, y / h);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function softDisc(rx, ry, colour, peak) {
    const c = layer(rx * 2, ry * 2);
    const ctx = c.getContext('2d');
    const [r, g, b] = K.parseColor(colour);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(rx, rx, 0, rx, rx, rx);
    grad.addColorStop(0, `rgba(${r},${g},${b},${peak})`);
    grad.addColorStop(0.65, `rgba(${r},${g},${b},${peak * 0.7})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, rx * 2, rx * 2);
    return c;
  }

  // Sun on the water: clustered on the sun path, a few strays, many sizes.
  function makeGlints(g, rand) {
    const sizes = [1, 1.7, 2.6, 3.8];
    const sprites = sizes.map((s) => softDisc(g.U * s * 1.9, g.U * s * 0.8, '#f8ecc0', 0.7));
    const list = [];
    for (let i = 0; i < 26; i++) {
      const down = Math.pow(rand(), 1.3);
      const reach = i < 22 ? 6 + down * 22 : 60;
      list.push({
        x: g.W * 0.28 + (rand() - 0.5) * 2 * g.U * reach,
        y: g.H * (0.45 + down * 0.5),
        sprite: sprites[Math.min(3, Math.floor(down * 2.4 + rand() * 1.8))],
        rate: 0.3 + rand() * 0.6,
        phase: rand() * 6.28,
      });
    }
    return list;
  }

  // A seed under a fan of fine hairs.
  function fluffSprite(radius, strands, rand) {
    const c = layer(radius * 2 + 2, radius * 2 + 2);
    const ctx = c.getContext('2d');
    const mid = radius + 1;
    const foot = mid + radius * 0.55;
    ctx.strokeStyle = '#f4eccf';
    ctx.lineWidth = Math.max(0.45, radius * 0.11);
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < strands; i++) {
      const a = -0.45 - (i / (strands - 1)) * 2.24 + (rand() - 0.5) * 0.14;
      const l = radius * (1.15 + rand() * 0.35);
      ctx.beginPath();
      ctx.moveTo(mid, foot);
      ctx.lineTo(mid + Math.cos(a) * l, foot + Math.sin(a) * l);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#a58a5c';
    ctx.fillRect(mid - 0.5, foot - 0.5, 1, Math.max(1, radius * 0.4));
    return c;
  }

  function makeFluff(g, rand) {
    const sprites = [
      fluffSprite(g.U * 1.7, 7, rand),
      fluffSprite(g.U * 2.5, 9, rand),
      fluffSprite(g.U * 3.6, 11, rand),
      softDisc(g.U * 3.6, g.U * 3.6, '#f2ead0', 0.26),
    ];
    const f = {
      sprites,
      kind: new Uint8Array(MAX_FLUFF),
      x: new Float32Array(MAX_FLUFF),
      y: new Float32Array(MAX_FLUFF),
      v: new Float32Array(MAX_FLUFF),
      phase: new Float32Array(MAX_FLUFF),
    };
    for (let i = 0; i < MAX_FLUFF; i++) {
      const pick = rand();
      const kind = pick < 0.56 ? 0 : pick < 0.86 ? 1 : pick < 0.96 ? 2 : 3;
      f.kind[i] = kind;
      f.x[i] = rand() * g.W * 1.2;
      f.y[i] = g.H * (0.04 + rand() * 0.86);
      f.v[i] = g.U * (1.2 + kind * 1.1 + rand());
      f.phase[i] = rand() * 6.28;
    }
    return f;
  }

  function stemPoint(r, s) {
    return { x: r.bx + r.bow * s * s, y: lerp(r.by, r.ty, s) };
  }

  function paintStemBody(ctx, g, r, ink, map) {
    const grad = ctx.createLinearGradient(0, map(stemPoint(r, 0)).y, 0, map(stemPoint(r, 1)).y);
    grad.addColorStop(0, ink.low);
    grad.addColorStop(0.55, ink.mid);
    grad.addColorStop(1, ink.high);
    ctx.fillStyle = grad;
    const half = (s) => g.U * r.w * 0.5 * lerp(1, 0.22, s * s);
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const p = map(stemPoint(r, i / 24));
      if (i === 0) ctx.moveTo(p.x - half(i / 24), p.y);
      else ctx.lineTo(p.x - half(i / 24), p.y);
    }
    for (let i = 24; i >= 0; i--) {
      const p = map(stemPoint(r, i / 24));
      ctx.lineTo(p.x + half(i / 24), p.y);
    }
    ctx.fill();
    paintStemEdges(ctx, g, r, ink, map, half);
  }

  function paintStemEdges(ctx, g, r, ink, map, half) {
    ctx.lineWidth = Math.max(0.6, g.U * r.w * 0.26);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = side < 0 ? ink.lit : ink.dark;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (let i = 4; i <= 24; i++) {
        const p = map(stemPoint(r, i / 24));
        ctx.lineTo(p.x + (side * half(i / 24)) / 1.5, p.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink.dark;
    const nodes = Math.max(2, Math.floor((r.by - r.ty) / (g.U * 15)));
    for (let i = 1; i < nodes; i++) {
      const s = i / nodes;
      const p = map(stemPoint(r, s));
      ctx.fillRect(p.x - half(s) * 1.25, p.y, half(s) * 2.5, Math.max(1, g.U * 0.5));
    }
  }

  function paintGama(ctx, g, r, map) {
    const u = g.U * r.w * 0.42;
    const h = r.by - r.ty;
    const p0 = map(stemPoint(r, 1 - (u * 7) / h));
    const p1 = map(stemPoint(r, 1 - (u * 24) / h));
    const stroke = (colour, width, off) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(p0.x + off, p0.y);
      ctx.lineTo(p1.x + off, p1.y);
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    stroke('#6e4228', u * 5.4, 0);
    stroke('#40261a', u * 1.8, u * 1.7);
    stroke('#b07a44', u * 1.5, -u * 1.3);
    ctx.lineCap = 'butt';
  }

  function paintPlume(ctx, g, r, map, rand) {
    const tones = ['#c9bd98', '#ae9c80', '#9a8474', '#d8ccaa'];
    const span = g.U * 11;
    ctx.lineWidth = Math.max(0.7, g.U * 0.42);
    ctx.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      const s = 1 - rand() * (span / (r.by - r.ty));
      const p = map(stemPoint(r, s));
      const side = rand() < 0.72 ? 1 : -1;
      const l = g.U * (3 + rand() * 6);
      ctx.strokeStyle = tones[i % tones.length];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + side * l * 0.6, p.y - l * 0.2, p.x + side * l, p.y + l * 0.55);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function paintStem(g, r, rand) {
    const pad = g.U * 18 + Math.abs(r.bow);
    const head = g.U * 12;
    const c = layer(pad * 2, r.by - r.ty + head);
    const ctx = c.getContext('2d');
    const map = (p) => ({ x: p.x - r.bx + pad, y: p.y - r.ty + head });
    const ink = r.rear ? REAR_INK : MAIN_INK;
    paintStemBody(ctx, g, r, ink, map);
    if (r.kind === 'gama') paintGama(ctx, g, r, map);
    if (r.kind === 'plume') paintPlume(ctx, g, r, map, rand);
    return { canvas: c, ox: pad, oy: r.by - r.ty + head };
  }

  // A reed leaf: leaves the stem climbing, then bends over under its own length.
  function paintBlade(g, len, ink) {
    const L = g.U * len;
    const c = layer(L * 1.04, L * 0.52);
    const ctx = c.getContext('2d');
    const oy = L * 0.16;
    ctx.translate(1, oy);
    const grad = ctx.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, ink.low);
    grad.addColorStop(0.5, ink.mid);
    grad.addColorStop(1, ink.high);
    ctx.fillStyle = grad;
    const w = Math.max(g.U * 2, L * 0.075);
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.5);
    ctx.quadraticCurveTo(L * 0.52, -L * 0.1 - w, L, L * 0.33);
    ctx.quadraticCurveTo(L * 0.5, -L * 0.1 + w, 0, w * 0.5);
    ctx.fill();
    ctx.strokeStyle = ink.lit;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(0.6, w * 0.26);
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.2);
    ctx.quadraticCurveTo(L * 0.52, -L * 0.1 - w * 0.55, L * 0.97, L * 0.31);
    ctx.stroke();
    return { canvas: c, ox: 1, oy };
  }

  function makeBlades(g, r, rand, sets) {
    const list = [];
    const set = r.rear ? sets.rear : sets.main;
    const top = r.top || 0.7;
    for (let i = 0; i < r.blades; i++) {
      const s = lerp(0.14, top, (i + 0.4) / r.blades);
      const p = stemPoint(r, s);
      list.push({
        dx: p.x - r.bx,
        dy: p.y - r.by,
        side: i % 2 ? 1 : -1,
        angle: -0.75 - rand() * 0.5,
        sprite: set[Math.floor(rand() * set.length)],
        phase: rand() * 6.28,
        rate: 0.9 + rand() * 0.8,
      });
    }
    return list;
  }

  function makeReeds(g, rand) {
    const sets = {
      main: [30, 38, 46].map((l) => paintBlade(g, l, MAIN_INK)),
      rear: [22, 30].map((l) => paintBlade(g, l, REAR_INK)),
    };
    return REEDS.map((spec, i) => {
      const bow = spec.bow * g.U;
      const r = {
        ...spec,
        bow,
        tx: spec.x * g.W,
        ty: spec.y * g.H,
        bx: spec.x * g.W - bow,
        by: g.H + g.U * 2,
        taken: -1,
        phase: rand() * 6.28,
        lean: i * 0.7,
        angle: 0,
        tipX: 0,
        tipY: 0,
      };
      r.stem = paintStem(g, r, rand);
      r.leaves = makeBlades(g, r, rand, sets);
      return r;
    });
  }

  function wingOutline(ctx, L, hind) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.25, -L * 0.05, L * 0.7, -L * 0.085, L * 0.93, -L * 0.065);
    ctx.quadraticCurveTo(L * 1.01, -L * 0.04, L * 0.985, -L * 0.005);
    if (hind) {
      ctx.bezierCurveTo(L * 0.88, L * 0.1, L * 0.5, L * 0.175, L * 0.2, L * 0.205);
      ctx.bezierCurveTo(L * 0.1, L * 0.215, L * 0.02, L * 0.12, 0, L * 0.02);
    } else {
      ctx.bezierCurveTo(L * 0.9, L * 0.075, L * 0.55, L * 0.11, L * 0.22, L * 0.075);
      ctx.bezierCurveTo(L * 0.12, L * 0.06, L * 0.04, L * 0.04, 0, L * 0.015);
    }
    ctx.closePath();
  }

  function paintVeins(ctx, L, hind, ink, rand, beating) {
    const lines = hind ? 6 : 5;
    const reach = (k, x) => lerp(-0.045, hind ? 0.17 : 0.085, Math.pow(k / lines, 1.1)) * Math.sin(Math.min(1, x + 0.12) * 2.6);
    ctx.strokeStyle = ink.vein;
    ctx.lineWidth = L * 0.0075;
    for (let k = 1; k <= lines; k++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 1; i <= 14; i++) {
        const x = i / 14;
        ctx.lineTo(x * L * (1 - k * 0.02), reach(k, x) * L);
      }
      ctx.stroke();
    }
    if (beating) return;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = L * 0.0045;
    for (let x = 0.08; x < 0.97; x += 0.034) {
      const k = 1 + Math.floor(rand() * lines);
      ctx.beginPath();
      ctx.moveTo(x * L, reach(k - 1, x) * L);
      ctx.lineTo((x + 0.012) * L, reach(k + 1, x) * L);
      ctx.moveTo((x + 0.012) * L, reach(1, x) * L);
      ctx.lineTo(x * L, reach(0, x) * L);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintWing(L, hind, ink, rand, beating) {
    const pad = L * 0.04;
    const up = L * 0.11;
    const c = layer(L * 1.06 + pad, L * (hind ? 0.36 : 0.23));
    const ctx = c.getContext('2d');
    ctx.translate(pad, up);
    wingOutline(ctx, L, hind);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = ink.film;
    ctx.fillRect(-pad, -up, L * 1.2, L * 0.5);
    const base = ctx.createLinearGradient(0, 0, L * 0.34, 0);
    base.addColorStop(0, ink.base);
    base.addColorStop(1, 'rgba(240,230,200,0)');
    ctx.fillStyle = base;
    ctx.fillRect(-pad, -up, L * 0.4, L * 0.5);
    ctx.globalAlpha = beating ? 0.32 : 1;
    paintVeins(ctx, L, hind, ink, rand, beating);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink.stigma;
    ctx.beginPath();
    ctx.ellipse(L * 0.885, -L * 0.056, L * 0.036, L * 0.013, -0.02, 0, 6.3);
    ctx.fill();
    ctx.restore();
    wingOutline(ctx, L, hind);
    ctx.strokeStyle = ink.vein;
    ctx.lineWidth = L * 0.012;
    ctx.stroke();
    return { canvas: c, ox: pad, oy: up };
  }

  // Half width of the abdomen along its length, 0 at the waist, 1 at the tail.
  function abdomenWidth(s) {
    if (s < 0.14) return lerp(0.054, 0.036, s / 0.14);
    if (s < 0.85) return lerp(0.036, 0.04, (s - 0.14) / 0.71);
    return lerp(0.04, 0.028, (s - 0.85) / 0.15);
  }

  function paintAbdomen(ctx, ink) {
    const y = (s) => 0.012 + 0.022 * s * s;
    const x = (s) => -0.08 - 0.74 * s;
    for (let i = 0; i < 10; i++) {
      const s0 = i / 10;
      const s1 = (i + 1) / 10;
      const a = abdomenWidth(s0);
      const b = abdomenWidth(s1);
      ctx.fillStyle = ink.back;
      ctx.beginPath();
      ctx.moveTo(x(s0), y(s0) - a);
      ctx.lineTo(x(s1), y(s1) - b);
      ctx.lineTo(x(s1), y(s1) + b * 0.2);
      ctx.lineTo(x(s0), y(s0) + a * 0.2);
      ctx.fill();
      ctx.fillStyle = ink.belly;
      ctx.beginPath();
      ctx.moveTo(x(s0), y(s0) + a * 0.2);
      ctx.lineTo(x(s1), y(s1) + b * 0.2);
      ctx.lineTo(x(s1), y(s1) + b);
      ctx.lineTo(x(s0), y(s0) + a);
      ctx.fill();
      ctx.fillStyle = ink.lit;
      ctx.fillRect(x(s1), y(s0) - a * 0.72, x(s0) - x(s1), a * 0.34);
      ctx.fillStyle = ink.ring;
      ctx.fillRect(x(s1) - 0.004, y(s1) - b * 1.02, 0.012, b * 2.04);
    }
    ctx.fillStyle = ink.ring;
    ctx.beginPath();
    ctx.moveTo(x(1), y(1) - 0.02);
    ctx.lineTo(x(1) - 0.04, y(1) - 0.008);
    ctx.lineTo(x(1) - 0.03, y(1) + 0.004);
    ctx.lineTo(x(1) - 0.04, y(1) + 0.016);
    ctx.lineTo(x(1), y(1) + 0.02);
    ctx.fill();
  }

  function paintThorax(ctx, ink) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0.002, 0.098, 0.066, -0.14, 0, 6.3);
    ctx.fillStyle = ink.thorax;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = ink.stripe;
    ctx.lineWidth = 0.014;
    for (const off of [-0.05, 0.002, 0.05]) {
      ctx.beginPath();
      ctx.moveTo(off + 0.03, -0.08);
      ctx.lineTo(off - 0.028, 0.08);
      ctx.stroke();
    }
    ctx.fillStyle = ink.lit;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(-0.012, -0.036, 0.06, 0.016, -0.14, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function paintHead(ctx, ink) {
    ctx.fillStyle = ink.ring;
    ctx.beginPath();
    ctx.ellipse(0.1, 0.002, 0.018, 0.026, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = ink.eye;
    ctx.beginPath();
    ctx.ellipse(0.142, -0.006, 0.052, 0.066, 0.1, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = ink.eyeLow;
    ctx.beginPath();
    ctx.ellipse(0.152, 0.024, 0.036, 0.032, 0.1, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath();
    ctx.ellipse(0.148, -0.036, 0.015, 0.011, 0, 0, 6.3);
    ctx.fill();
  }

  const LEGS_TUCKED = [
    [0.05, 0.05, 0.085, 0.082, 0.125, 0.066],
    [0.015, 0.058, 0.04, 0.098, 0.082, 0.09],
    [-0.025, 0.056, -0.01, 0.1, 0.03, 0.1],
  ];
  const LEGS_PERCHED = [
    [0.05, 0.05, 0.078, 0.092, 0.024, 0.128],
    [0.012, 0.058, 0.022, 0.1, 0.012, 0.128],
    [-0.03, 0.054, -0.05, 0.096, -0.004, 0.128],
  ];

  function paintLegs(ctx, ink, legs) {
    ctx.strokeStyle = ink.ring;
    ctx.lineWidth = 0.0095;
    ctx.lineCap = 'round';
    for (const l of legs) {
      ctx.beginPath();
      ctx.moveTo(l[0], l[1]);
      ctx.lineTo(l[2], l[3]);
      ctx.lineTo(l[4], l[5]);
      ctx.stroke();
    }
  }

  // Head toward +x, thorax at the origin; units are fractions of body length.
  function paintBody(B, ink, legs) {
    const ox = B * 0.92;
    const oy = B * 0.12;
    const c = layer(B * 1.14, B * 0.28);
    const ctx = c.getContext('2d');
    ctx.translate(ox, oy);
    ctx.scale(B, B);
    paintLegs(ctx, ink, legs);
    paintAbdomen(ctx, ink);
    paintThorax(ctx, ink);
    paintHead(ctx, ink);
    return { canvas: c, ox, oy };
  }

  function makeFly(g, spec, index, rand) {
    const body = g.U * spec.size;
    const B = body * SS;
    const f = {
      ...spec,
      index,
      body,
      flying: paintBody(B, spec.ink, LEGS_TUCKED),
      resting: paintBody(B, spec.ink, LEGS_PERCHED),
      fore: paintWing(B * 0.8, false, spec.ink, rand, false),
      hind: paintWing(B * 0.76, true, spec.ink, rand, false),
      foreBeat: paintWing(B * 0.8, false, spec.ink, rand, true),
      hindBeat: paintWing(B * 0.76, true, spec.ink, rand, true),
      state: spec.start,
      x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, hx: 0, hy: 0,
      age: 0, span: 1,
      trips: 0,
      yaw: 1, face: 1, pitch: 0, pitchTo: 0,
      phase: rand() * 6.28,
      landing: -1,
      benched: false,
    };
    if (spec.start === HOVER) f.perch = -1;
    if (spec.start === HOVER) {
      f.hx = f.x = g.W * spec.at[0];
      f.hy = f.y = g.H * spec.at[1];
      f.trips = 2;
    }
    return f;
  }

  function seatFly(f) {
    const r = state.reeds[f.perch];
    r.taken = f.index;
    f.face = r.face;
    f.yaw = r.face;
    f.pitch = PERCH_PITCH;
    f.pitchTo = PERCH_PITCH;
    f.x = anchorX(f, r);
    f.y = anchorY(f, r);
  }

  function anchorX(f, r) {
    const c = Math.cos(PERCH_PITCH);
    const s = Math.sin(PERCH_PITCH);
    return r.tipX - r.face * f.body * (0.01 * c - 0.128 * s);
  }

  function anchorY(f, r) {
    const c = Math.cos(PERCH_PITCH);
    const s = Math.sin(PERCH_PITCH);
    return r.tipY - f.body * (0.01 * s + 0.128 * c);
  }

  function swayReeds(t, breeze) {
    state.gust = 0.62 + 0.38 * Math.sin(t * 0.17);
    const amount = breeze * state.gust;
    for (const r of state.reeds) {
      r.angle = amount * (0.021 * Math.sin(t * 0.62 + r.phase) + 0.007 * Math.sin(t * 1.43 + r.lean));
      const dx = r.tx - r.bx;
      const dy = r.ty - r.by;
      const c = Math.cos(r.angle);
      const s = Math.sin(r.angle);
      r.tipX = r.bx + dx * c - dy * s;
      r.tipY = r.by + dx * s + dy * c;
    }
  }

  function dartTo(f, x, y, g) {
    const dx = x - f.x;
    const dy = y - f.y;
    const d = Math.hypot(dx, dy);
    f.sx = f.x;
    f.sy = f.y;
    f.tx = x;
    f.ty = y;
    f.age = 0;
    f.span = Math.max(0.28, d / (g.U * 95));
    f.state = DART;
    if (Math.abs(dx) > g.U * 2) f.face = dx > 0 ? 1 : -1;
    f.pitchTo = Math.max(-0.5, Math.min(0.5, (dy / (Math.abs(dx) + g.U)) * 0.5));
  }

  function pickRun(f, g, rand) {
    const wide = f.size > 40 ? 0.22 : 0.06;
    for (let tries = 0; tries < 6; tries++) {
      const a = rand() * 6.283;
      const d = g.U * (16 + rand() * 30);
      const x = f.hx + Math.cos(a) * d * 1.3;
      const y = f.hy + Math.sin(a) * d * 0.7;
      if (x > g.W * wide && x < g.W * (1 - wide) && y > g.H * 0.14 && y < g.H * 0.72) return dartTo(f, x, y, g);
    }
    dartTo(f, lerp(f.hx, g.W * 0.5, 0.3), lerp(f.hy, g.H * 0.42, 0.3), g);
  }

  function pickLanding(f, g, rand) {
    const start = Math.floor(rand() * f.perches.length);
    for (let i = 0; i < f.perches.length; i++) {
      const id = f.perches[(start + i) % f.perches.length];
      const r = state.reeds[id];
      if (r.taken >= 0) continue;
      r.taken = f.index;
      f.landing = id;
      dartTo(f, anchorX(f, r) - r.face * g.U * 10, anchorY(f, r) - g.U * 8, g);
      return;
    }
    f.trips = 1;
    pickRun(f, g, rand);
  }

  function enterHover(f, rand) {
    f.state = HOVER;
    f.hx = f.x;
    f.hy = f.y;
    f.age = 0;
    f.span = f.landing >= 0 ? 0.7 : 1.1 + rand() * 2.8;
    f.pitchTo = -0.04;
  }

  function stepPerched(f, g, dt, rand) {
    const r = state.reeds[f.perch];
    f.x = anchorX(f, r);
    f.y = anchorY(f, r);
    f.clock -= dt;
    if (f.clock > 0) return;
    r.taken = -1;
    f.perch = -1;
    f.trips = Math.floor(rand() * 4);
    f.hx = f.x;
    f.hy = f.y;
    dartTo(f, f.x + (rand() - 0.5) * g.U * 26, f.y - g.U * (6 + rand() * 12), g);
  }

  function stepHover(f, g, t, dt, rand) {
    f.age += dt;
    const settle = Math.min(1, f.age * 1.5);
    const reach = g.U * settle * (0.9 + f.size * 0.03);
    f.x = f.hx + Math.sin(t * 1.5 + f.phase) * reach;
    f.y = f.hy + Math.sin(t * 2.3 + f.phase * 2) * reach * 0.7;
    if (f.age < f.span) return;
    f.hx = f.x;
    f.hy = f.y;
    if (f.landing >= 0) {
      const r = state.reeds[f.landing];
      f.state = SETTLE;
      f.sx = f.x;
      f.sy = f.y;
      f.age = 0;
      f.span = 0.8;
      f.face = r.face;
      f.pitchTo = PERCH_PITCH;
    } else if (f.trips > 0) {
      f.trips--;
      pickRun(f, g, rand);
    } else {
      pickLanding(f, g, rand);
    }
  }

  function stepDart(f, dt, rand) {
    f.age += dt;
    const k = smoothstep(0, 1, f.age / f.span);
    f.x = lerp(f.sx, f.tx, k);
    f.y = lerp(f.sy, f.ty, k);
    if (f.age >= f.span) enterHover(f, rand);
  }

  function stepSettle(f, dt, rand) {
    const r = state.reeds[f.landing];
    f.age += dt;
    const k = smoothstep(0, 1, f.age / f.span);
    f.x = lerp(f.sx, anchorX(f, r), k);
    f.y = lerp(f.sy, anchorY(f, r), k);
    if (f.age < f.span) return;
    f.perch = f.landing;
    f.landing = -1;
    f.state = PERCHED;
    f.clock = lerp(f.rest[0], f.rest[1], rand());
  }

  function stepFly(f, g, t, dt, rand) {
    if (f.state === PERCHED) stepPerched(f, g, dt, rand);
    else if (f.state === HOVER) stepHover(f, g, t, dt, rand);
    else if (f.state === DART) stepDart(f, dt, rand);
    else stepSettle(f, dt, rand);
    const ease = Math.min(1, dt * 11);
    f.yaw += (f.face - f.yaw) * ease;
    f.pitch += (f.pitchTo - f.pitch) * ease;
  }

  function benchFly(f) {
    if (f.perch >= 0) state.reeds[f.perch].taken = -1;
    if (f.landing >= 0) state.reeds[f.landing].taken = -1;
    f.perch = -1;
    f.landing = -1;
    f.benched = true;
  }

  // Back from the bench when the slider rises: wherever the hover point left it.
  function wakeFly(f, g) {
    f.benched = false;
    f.hx = f.x = g.W * (0.2 + f.index * 0.15);
    f.hy = f.y = g.H * 0.35;
    f.trips = 2;
    f.state = HOVER;
    f.age = 0;
    f.span = 1.5;
  }

  function drawWing(ctx, f, w, angle, beating) {
    const sprite = beating ? (w.hind ? f.hindBeat : f.foreBeat) : w.hind ? f.hind : f.fore;
    ctx.save();
    ctx.translate(w.x * f.body, -0.022 * f.body);
    ctx.rotate(angle);
    ctx.scale(w.len / SS, ((w.far ? -1 : 1) * w.chord) / SS);
    ctx.drawImage(sprite.canvas, -sprite.ox, -sprite.oy);
    ctx.restore();
  }

  function drawWings(ctx, f, far, t) {
    const still = f.state === PERCHED;
    for (const w of WINGS) {
      if (w.far !== far) continue;
      const toward = w.far ? 1 : -1;
      if (still) {
        const dip = 0.05 + 0.03 * Math.sin(t * 0.5 + f.phase);
        const air = 0.012 * Math.sin(t * 2.1 + f.phase + w.x * 40) * state.gust;
        ctx.globalAlpha = 1;
        drawWing(ctx, f, w, w.a + toward * (w.hind ? dip * 0.3 : dip) + air, false);
      } else {
        const beat = 0.13 + 0.04 * Math.sin(t * 27 + f.phase + (w.hind ? 1.6 : 0));
        ctx.globalAlpha = 0.44;
        drawWing(ctx, f, w, w.a - beat, true);
        drawWing(ctx, f, w, w.a + beat, true);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFly(ctx, f, t) {
    const yaw = Math.abs(f.yaw) < 0.14 ? (f.yaw < 0 ? -0.14 : 0.14) : f.yaw;
    const body = f.state === PERCHED || f.state === SETTLE ? f.resting : f.flying;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(yaw, 1);
    ctx.rotate(f.pitch);
    drawWings(ctx, f, true, t);
    ctx.save();
    ctx.scale(1 / SS, 1 / SS);
    ctx.drawImage(body.canvas, -body.ox, -body.oy);
    ctx.restore();
    drawWings(ctx, f, false, t);
    ctx.restore();
  }

  function drawReed(ctx, r, t, amount) {
    ctx.save();
    ctx.translate(r.bx, r.by);
    ctx.rotate(r.angle);
    for (const b of r.leaves) {
      ctx.save();
      ctx.translate(b.dx, b.dy);
      ctx.scale(b.side, 1);
      ctx.rotate(b.angle + amount * 0.035 * Math.sin(t * b.rate + b.phase));
      ctx.drawImage(b.sprite.canvas, -b.sprite.ox, -b.sprite.oy);
      ctx.restore();
    }
    ctx.drawImage(r.stem.canvas, -r.stem.ox, -r.stem.oy);
    ctx.restore();
  }

  function drawWater(ctx, g, t) {
    const tex = state.ripples;
    const w = tex.width * 2;
    const h = tex.height * 2;
    const y = g.H * 0.44;
    const a = -((t * g.U * 1.3) % w);
    const b = -w + ((t * g.U * 0.8) % w);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(tex, a, y, w, h);
    ctx.drawImage(tex, a + w, y, w, h);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tex, b, y + g.U, w, h);
    ctx.drawImage(tex, b + w, y + g.U, w, h);
    for (const s of state.glints) {
      ctx.globalAlpha = 0.28 + 0.26 * Math.sin(t * s.rate + s.phase);
      ctx.drawImage(s.sprite, s.x + Math.sin(t * 0.2 + s.phase) * g.U * 1.5, s.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawFluff(ctx, g, t, from, to) {
    const f = state.fluff;
    const wrap = g.W * 1.2;
    for (let i = from; i < to; i++) {
      const sprite = f.sprites[f.kind[i]];
      const x = (f.x[i] + state.drift * f.v[i]) % wrap;
      const y = f.y[i] + Math.sin(t * 0.3 + f.phase[i]) * g.U * 3 - Math.sin(t * 0.11 + f.phase[i]) * g.U * 4;
      ctx.drawImage(sprite, x - g.W * 0.1, y);
    }
  }

  function drawSoftLayer(ctx, g, img, lean) {
    ctx.save();
    ctx.transform(1, 0, lean, 1, -lean * g.H, 0);
    ctx.drawImage(img, 0, 0, g.W, g.H);
    ctx.restore();
  }

  function drawFlies(ctx, g, t, dt, count) {
    const rand = state.rand;
    for (let i = state.flies.length - 1; i >= 0; i--) {
      const f = state.flies[i];
      if (i >= count) {
        if (!f.benched) benchFly(f);
        continue;
      }
      if (f.benched) wakeFly(f, g);
      stepFly(f, g, t, dt, rand);
      drawFly(ctx, f, t);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.drift = 0;
    state.gust = 1;
    state.back = paintBackdrop(g, rand);
    state.bank = soft(g, 1.5, (s) => paintBank(s, g, rand));
    state.front = soft(g, 1.3, (s) => paintFront(s, g, rand));
    state.ripples = paintRipples(g);
    state.glints = makeGlints(g, rand);
    state.fluff = makeFluff(g, rand);
    state.reeds = makeReeds(g, rand);
    swayReeds(0, 1);
    state.flies = FLIES.map((spec, i) => makeFly(g, spec, i, rand));
    for (const f of state.flies) if (f.state === PERCHED) seatFly(f);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const breeze = api.props.breeze;
    swayReeds(t, breeze);
    state.drift += dt * (0.25 + breeze * 0.75);
    ctx.drawImage(state.back, 0, 0);
    drawWater(ctx, g, t);
    drawSoftLayer(ctx, g, state.bank, breeze * 0.006 * Math.sin(t * 0.5));
    for (const r of state.reeds) if (r.rear) drawReed(ctx, r, t, breeze);
    const fluffCount = Math.min(MAX_FLUFF, Math.round((g.W / g.H) * 34 * api.props.fluff));
    const fluffRear = Math.floor(fluffCount * 0.6);
    drawFluff(ctx, g, t, 0, fluffRear);
    for (const r of state.reeds) if (!r.rear) drawReed(ctx, r, t, breeze);
    drawFlies(ctx, g, t, dt, Math.round(api.props.flies));
    drawSoftLayer(ctx, g, state.front, breeze * 0.011 * Math.sin(t * 0.7 + 1));
    drawFluff(ctx, g, t, fluffRear, fluffCount);
  }

  Kasuri.run({
    defaults: { flies: 5, breeze: 1, fluff: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.08, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
