/*
 * 彼岸花 Higan — red spider lilies along the banks of a rice field in September.
 *
 * Land, banks and far drifts are baked once. The rice moves through a baked wave
 * texture drawn in perspective rows and a few hundred reused head strokes, and
 * each tall lily is one sprite that nods about the foot of its stalk.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, noise2, smoothstep } = K;

  const HORIZON = 0.4;
  const GROUND_SPAN = 0.64;
  const RICE = ['#b38e2e', '#c7a23f', '#d6b24a'];
  const HEAD_TONES = ['#b38e2e', '#d6b24a', '#ecd27c'];
  const SKY = ['#92b4c6', '#aac4cc', '#c4d3cc', '#dcdcc6', '#efe4c2'];
  const MOSS = ['#4a6a3c', '#5a7a44', '#6a8a4e', '#7a9a58'];
  const PETALS = { back: '#a8281a', mid: '#c92f1c', front: '#dd3c22', lit: '#ec6442' };
  const STAMEN = { back: '#b83a22', front: '#e0462a', tip: '#f2d486' };
  const STALK = { dark: '#566f3b', lit: '#88a25a' };
  const MAX_HEADS = 620;
  const WAVE_ROWS = 46;

  // x and y are fractions of the canvas, r is in units of g.U, foot is where the stalk meets ground.
  const PLANTS = [
    { x: 0.115, y: 0.54, r: 13, foot: 0.98 },
    { x: 0.925, y: 0.6, r: 12.5, foot: 1.0 },
    { x: 0.34, y: 0.58, r: 12.5, foot: 1.02 },
    { x: 0.225, y: 0.34, r: 20, foot: 1.02 },
    { x: 0.05, y: 0.77, r: 8.5, foot: 1.0 },
    { x: 0.86, y: 0.79, r: 8.5, foot: 1.02 },
    { x: 0.98, y: 0.81, r: 7.5, foot: 1.02 },
    { x: 0.165, y: 0.77, r: 9.5, foot: 1.02 },
    { x: 0.285, y: 0.8, r: 10, foot: 1.03 },
    { x: 0.4, y: 0.84, r: 7.5, foot: 1.03 },
  ];

  const state = { phase: 0 };

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // s runs from 0 at the horizon to 1 at the bottom edge of the picture.
  function groundY(g, s) {
    return g.H * (HORIZON + GROUND_SPAN * s);
  }

  function pathX(g, s) {
    const bend = Math.sin(Math.pow(s, 0.6) * Math.PI * 2) * g.U * 11 * Math.pow(s, 0.5);
    return lerp(g.W * 0.7, g.W * 0.6, s) + bend;
  }

  function pathHalf(g, s) {
    return g.U * (0.6 + s * 13);
  }

  function bankWidth(g, s) {
    return g.U * (0.8 + s * 11);
  }

  /* ---------- flowers ---------- */

  function paintPetal(ctx, x, y, ang, len, width, tone, lit) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const flip = c >= 0 ? 1 : -1;
    const nx = -s * flip;
    const ny = c * flip;
    const ex = x + c * len * 0.74 + nx * len * 0.42;
    const ey = y + s * len * 0.74 + ny * len * 0.42;
    const ax = x + c * len * 0.55 + nx * len * 0.1;
    const ay = y + s * len * 0.55 + ny * len * 0.1;
    const bx = x + c * len * 1.08 + nx * len * 0.06;
    const by = y + s * len * 1.08 + ny * len * 0.06;
    ctx.strokeStyle = tone;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(ax, ay, bx, by, ex, ey);
    ctx.stroke();
    if (!lit || width < 1.3) return;
    ctx.strokeStyle = lit;
    ctx.lineWidth = Math.max(1, width * 0.34);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(ax - ny * width * 0.2, ay, bx - ny * width * 0.2, by);
    ctx.stroke();
  }

  function paintStamen(ctx, g, x, y, ang, len, tone, tipSize) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const flip = c >= 0 ? 1 : -1;
    const mx = x + c * len * 0.8;
    const my = y + s * len * 0.8;
    const curl = len * 0.34 * (0.2 + 0.8 * Math.abs(c));
    const ex = mx + c * len * 0.14 + s * flip * curl;
    const ey = my + s * len * 0.14 - c * flip * curl;
    ctx.strokeStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    if (tipSize > 0) {
      ctx.fillStyle = STAMEN.tip;
      ctx.fillRect(ex - tipSize / 2, ey - tipSize / 2, tipSize, tipSize);
    }
  }

  function paintFloret(ctx, g, rand, f) {
    const { x, y, ang, r, back, detail } = f;
    const width = Math.max(1, r * 0.058);
    for (let k = 0; k < detail.petals; k++) {
      const a = ang + (k - (detail.petals - 1) / 2) * (2.5 / detail.petals) + (rand() - 0.5) * 0.16;
      const roll = rand();
      const tone = back ? PETALS.back : roll < 0.25 ? PETALS.lit : roll < 0.65 ? PETALS.front : PETALS.mid;
      paintPetal(ctx, x, y, a, r * (0.4 + rand() * 0.12), width, tone, back ? null : PETALS.lit);
    }
    ctx.lineWidth = Math.max(1, r * 0.024);
    const tip = r > g.U * 6 ? Math.max(1, r * 0.035) : 0;
    for (let k = 0; k < detail.stamens; k++) {
      const a = ang + (k - (detail.stamens - 1) / 2) * 0.2 + (rand() - 0.5) * 0.1;
      paintStamen(ctx, g, x, y, a, r * (0.72 + rand() * 0.36), back ? STAMEN.back : STAMEN.front, tip);
    }
  }

  // The hero gets every floret; smaller umbels lose petals first so they stay spidery.
  function headDetail(g, r) {
    if (r > g.U * 15) return { backs: 3, fronts: 5, petals: 5, stamens: 5, fan: 5 };
    if (r > g.U * 8) return { backs: 2, fronts: 4, petals: 3, stamens: 5, fan: 3 };
    return { backs: 2, fronts: 3, petals: 2, stamens: 4, fan: 2 };
  }

  // One umbel: back florets fan upward and darker, front ones spread out and lit.
  function paintHead(ctx, g, rand, x, y, r) {
    const detail = headDetail(g, r);
    for (let i = 0; i < detail.backs; i++) {
      const ang = lerp(-2.7, -0.44, i / (detail.backs - 1)) + (rand() - 0.5) * 0.2;
      paintFloret(ctx, g, rand, { x, y: y - r * 0.05, ang, r: r * 0.92, back: true, detail });
    }
    ctx.fillStyle = PETALS.mid;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.03, r * 0.15, r * 0.11, 0, 0, 6.3);
    ctx.fill();
    for (let i = 0; i < detail.fronts; i++) {
      const ang = lerp(-3.45, 0.3, i / (detail.fronts - 1)) + (rand() - 0.5) * 0.2;
      const fx = x + Math.cos(ang) * r * 0.17;
      const fy = y + Math.sin(ang) * r * 0.1;
      paintFloret(ctx, g, rand, { x: fx, y: fy, ang, r, back: false, detail });
    }
    paintPetalFan(ctx, x, y, r, detail.fan);
  }

  // Short petals hanging toward the viewer, closing the underside of the umbel.
  function paintPetalFan(ctx, x, y, r, count) {
    const width = Math.max(1, r * 0.05);
    for (let k = 0; k < count; k++) {
      const a = 1.57 + (k - (count - 1) / 2) * 0.55;
      paintPetal(ctx, x, y + r * 0.04, a, r * 0.3, width, k % 2 ? PETALS.front : PETALS.mid, PETALS.lit);
    }
  }

  function paintStalk(ctx, x0, y0, x1, y1, width) {
    const mx = lerp(x0, x1, 0.25);
    const my = lerp(y0, y1, 0.55);
    ctx.strokeStyle = STALK.dark;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx, my, x1, y1);
    ctx.stroke();
    if (width < 1.6) return;
    ctx.strokeStyle = STALK.lit;
    ctx.lineWidth = Math.max(1, width * 0.4);
    ctx.beginPath();
    ctx.moveTo(x0 - width * 0.2, y0);
    ctx.quadraticCurveTo(mx - width * 0.2, my, x1 - width * 0.2, y1);
    ctx.stroke();
  }

  // A small burst for the far drifts: a few radial strokes, not a dot.
  function paintBurst(ctx, rand, x, y, r) {
    const rays = Math.max(4, Math.min(13, Math.round(r * 2)));
    ctx.lineWidth = 1;
    for (let i = 0; i < rays; i++) {
      const a = -Math.PI * 1.15 + (i / rays) * Math.PI * 1.3 + rand() * 0.3;
      const len = r * (0.7 + rand() * 0.6);
      ctx.strokeStyle = rand() < 0.3 ? PETALS.lit : rand() < 0.6 ? PETALS.front : PETALS.mid;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.7, y + Math.sin(a) * len * 0.7, x + Math.cos(a) * len, y + Math.sin(a) * len * 0.8 - r * 0.2);
      ctx.stroke();
    }
  }

  function paintBloom(ctx, g, rand, item) {
    const { x, y, r } = item;
    const top = y - r * 2.1;
    if (r < 1.1) {
      ctx.fillStyle = rand() < 0.5 ? PETALS.front : PETALS.mid;
      ctx.fillRect(x, y - 1 - r, Math.max(1, r * 1.6), 1);
      return;
    }
    if (r >= 1.8) paintStalk(ctx, x, y, x + (rand() - 0.5) * r * 0.5, top, Math.max(1, r * 0.09));
    if (r < 7) paintBurst(ctx, rand, x, top, r);
    else paintHead(ctx, g, rand, x, top, r);
  }

  function makePlant(g, rand, p, index) {
    const r = p.r * g.U;
    const reach = r * 1.5;
    const headX = p.x * g.W;
    const headY = p.y * g.H;
    const footX = headX + (index % 2 ? 1 : -1) * g.U * 2.5;
    const footY = p.foot * g.H;
    const left = Math.min(headX - reach, footX - g.U);
    const top = headY - reach;
    const c = layer(reach * 2 + Math.abs(footX - headX) + g.U * 2, footY - top + g.U);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    ctx.translate(-left, -top);
    paintStalk(ctx, footX, footY, headX, headY + r * 0.12, Math.max(1, r * 0.062));
    paintHead(ctx, g, rand, headX, headY, r);
    return { c, footX, footY, ax: footX - left, ay: footY - top, phase: rand() * 6.28, nod: 0.5 + rand() * 0.25 };
  }

  /* ---------- far land ---------- */

  function paintSky(g) {
    const c = layer(g.W, g.H * (HORIZON + 0.02));
    const ctx = c.getContext('2d');
    ctx.fillStyle = SKY[0];
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 1; i < SKY.length; i++) {
      const base = c.height * Math.pow(i / SKY.length, 0.8);
      ctx.fillStyle = SKY[i];
      ctx.beginPath();
      ctx.moveTo(0, c.height);
      for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, base + (fbm((x / g.U) * 0.05, i * 7, 3, 44) - 0.5) * g.U * 9);
      ctx.lineTo(g.W, c.height);
      ctx.fill();
    }
    return c;
  }

  // Cirrus bands, baked at half size in flat tones; both ends of the tile agree.
  function paintClouds(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.16);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm((x * 42) / w, (y * 11) / h, 4, 31);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const a = smoothstep(0.5, 0.66, v) * band;
        const i = (y * w + x) * 4;
        img.data[i] = 246;
        img.data[i + 1] = 240;
        img.data[i + 2] = 222;
        img.data[i + 3] = (a > 0.4 ? 1 : 0) * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintRidge(ctx, g, base, height, scale, seed, tone) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, g.H * (HORIZON + 0.02));
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.H * (base - fbm((x / g.U) * scale, seed, 4, seed) * height));
    }
    ctx.lineTo(g.W, g.H * (HORIZON + 0.02));
    ctx.fill();
  }

  function paintRice(ctx, g, rand) {
    const top = groundY(g, 0);
    const bands = ['#e0c672', '#d6b24a', '#c7a23f', '#b38e2e'];
    for (let i = 0; i < bands.length; i++) {
      const y = top + (g.H - top) * Math.pow(i / bands.length, 1.3);
      ctx.fillStyle = bands[i];
      ctx.fillRect(0, y, g.W, g.H - y);
    }
    const marks = Math.min(16000, Math.round((g.W * g.H) / 5));
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    for (let i = 0; i < marks; i++) {
      const s = Math.pow(rand(), 1.4);
      const x = rand() * g.W;
      const y = groundY(g, s);
      const len = Math.max(1, s * g.U * 6);
      ctx.strokeStyle = RICE[Math.floor(rand() * RICE.length)];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x, y - len, x + (rand() < 0.5 ? -1 : 1) * len * 0.5, y - len * 0.6);
      ctx.stroke();
    }
  }

  function paintLand(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidge(ctx, g, HORIZON + 0.005, 0.2, 0.012, 3, '#93a5ad');
    paintRidge(ctx, g, HORIZON + 0.01, 0.12, 0.022, 8, '#6f8c80');
    paintRidge(ctx, g, HORIZON + 0.012, 0.045, 0.06, 13, '#536f55');
    paintRice(ctx, g, rand);
    return c;
  }

  /* ---------- farmhouse ---------- */

  function paintGrove(ctx, g, rand, x, y) {
    const u = g.U;
    for (let i = 0; i < 7; i++) {
      const cx = x + (i - 3) * u * 6.5 + (rand() - 0.5) * u * 2;
      const h = u * (15 + rand() * 11) * (1 - Math.abs(i - 3) * 0.11);
      ctx.fillStyle = i % 2 ? '#3d5a4c' : '#476555';
      ctx.beginPath();
      ctx.moveTo(cx - u * 4.4, y);
      ctx.lineTo(cx, y - h);
      ctx.lineTo(cx + u * 4.4, y);
      ctx.fill();
    }
    for (let i = 0; i < 260; i++) {
      const a = rand() * 6.28;
      const d = Math.sqrt(rand());
      const cx = x - u * 21 + (rand() < 0.5 ? 0 : u * 42);
      ctx.fillStyle = MOSS[Math.floor(rand() * MOSS.length)];
      ctx.fillRect(cx + Math.cos(a) * d * u * 7, y - u * 5 + Math.sin(a) * d * u * 5.5, Math.max(1, u), Math.max(1, u * 0.7));
    }
  }

  function paintWalls(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#ddd2b6';
    ctx.fillRect(x - u * 12, y - u * 6.4, u * 24, u * 6.4);
    ctx.fillStyle = '#3b3028';
    for (let i = 0; i <= 5; i++) ctx.fillRect(x - u * 12 + i * u * 4.7, y - u * 6.4, Math.max(1, u * 0.6), u * 6.4);
    ctx.fillRect(x - u * 12, y - u * 1.2, u * 24, Math.max(1, u * 1.2));
    ctx.fillStyle = '#4c4033';
    ctx.fillRect(x - u * 2.5, y - u * 5.4, u * 5, u * 5.4);
  }

  function paintThatch(ctx, g, x, y) {
    const u = g.U;
    const eave = y - u * 6.2;
    const ridge = y - u * 19;
    ctx.fillStyle = '#7c6a48';
    ctx.beginPath();
    ctx.moveTo(x - u * 16, eave);
    ctx.lineTo(x - u * 8, ridge);
    ctx.lineTo(x + u * 8, ridge);
    ctx.lineTo(x + u * 16, eave);
    ctx.fill();
    ctx.fillStyle = '#94815a';
    ctx.beginPath();
    ctx.moveTo(x - u * 11, eave);
    ctx.lineTo(x - u * 5.5, ridge + u * 3);
    ctx.lineTo(x + u * 2, ridge + u * 3);
    ctx.lineTo(x + u * 1, eave);
    ctx.fill();
    ctx.fillStyle = '#4d4031';
    ctx.fillRect(x - u * 16.4, eave, u * 32.8, Math.max(1, u * 0.9));
    ctx.fillRect(x - u * 8.6, ridge - u * 0.8, u * 17.2, Math.max(1, u * 1.5));
  }

  function paintFarm(ctx, g, rand, x, y) {
    paintGrove(ctx, g, rand, x, y);
    paintWalls(ctx, g, x, y);
    paintThatch(ctx, g, x, y);
  }

  /* ---------- banks and drifts ---------- */

  function strip(ctx, g, innerOf, outerOf) {
    ctx.beginPath();
    for (let s = 0.015; s <= 1.04; s += 0.02) ctx.lineTo(pathX(g, s) + innerOf(s), groundY(g, s));
    for (let s = 1.04; s >= 0.015; s -= 0.02) ctx.lineTo(pathX(g, s) + outerOf(s), groundY(g, s));
    ctx.fill();
  }

  function paintPath(ctx, g, rand) {
    for (const side of [-1, 1]) {
      ctx.fillStyle = MOSS[1];
      strip(ctx, g, (s) => side * pathHalf(g, s), (s) => side * (pathHalf(g, s) + bankWidth(g, s)));
    }
    ctx.fillStyle = '#bda982';
    strip(ctx, g, (s) => -pathHalf(g, s), (s) => pathHalf(g, s));
    ctx.fillStyle = '#d1bf98';
    strip(ctx, g, (s) => -pathHalf(g, s) * 0.45, (s) => pathHalf(g, s) * 0.2);
    for (let i = 0; i < 500; i++) {
      const s = Math.pow(rand(), 1.3);
      const x = pathX(g, s) + (rand() * 2 - 1) * pathHalf(g, s);
      ctx.fillStyle = rand() < 0.5 ? '#a08c66' : '#dccba6';
      ctx.fillRect(x, groundY(g, s), Math.max(1, s * g.U * 2.6), Math.max(1, s * g.U * 0.7));
    }
  }

  function paintBankGrass(ctx, g, rand) {
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < 2200; i++) {
      const s = 0.03 + Math.pow(rand(), 1.5) * 0.97;
      const side = rand() < 0.5 ? -1 : 1;
      const x = pathX(g, s) + side * (pathHalf(g, s) + rand() * bankWidth(g, s));
      const y = groundY(g, s);
      const len = Math.max(1, s * g.U * 3.5);
      ctx.strokeStyle = MOSS[Math.floor(rand() * MOSS.length)];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * len, y - len);
      ctx.stroke();
    }
  }

  function levees() {
    return [
      { side: -1, s: 0.05 }, { side: -1, s: 0.125 }, { side: -1, s: 0.25 },
      { side: 1, s: 0.08 }, { side: 1, s: 0.19 },
    ];
  }

  function leveeSpan(g, l) {
    const edge = pathX(g, l.s) + l.side * (pathHalf(g, l.s) + bankWidth(g, l.s) * 0.5);
    return l.side < 0 ? [0, edge] : [edge, g.W];
  }

  function leveeY(g, l, x) {
    return groundY(g, l.s) + Math.sin(x * 0.03 + l.s * 40) * l.s * g.U * 2.2;
  }

  function paintLevees(ctx, g) {
    for (const l of levees()) {
      const [x0, x1] = leveeSpan(g, l);
      const h = Math.max(1, l.s * g.U * 4);
      ctx.fillStyle = MOSS[1];
      ctx.beginPath();
      ctx.moveTo(x0, leveeY(g, l, x0));
      for (let x = x0; x <= x1 + 2; x += 2) ctx.lineTo(x, leveeY(g, l, x) - h * 0.5 - noise2(x * 0.3, l.s * 50, 2) * h * 0.5);
      for (let x = x1; x >= x0 - 2; x -= 2) ctx.lineTo(x, leveeY(g, l, x) + h * 0.5);
      ctx.fill();
    }
  }

  function pathDrift(g, rand, out) {
    for (const side of [-1, 1]) {
      for (let s = 0.03; s < 0.95; s += 0.006 + s * 0.04) {
        if (noise2(s * 16, side * 3 + 7, 5) < 0.36) continue;
        const clump = 1 + Math.floor(rand() * 2.4);
        for (let i = 0; i < clump; i++) {
          const ss = s * (0.98 + rand() * 0.04);
          const x = pathX(g, ss) + side * (pathHalf(g, ss) + rand() * bankWidth(g, ss));
          out.push({ x, y: groundY(g, ss), r: g.U * (0.4 + ss * 4.6) * (0.65 + rand() * 0.55) });
        }
      }
    }
  }

  function leveeDrift(g, rand, out) {
    for (const l of levees()) {
      const [x0, x1] = leveeSpan(g, l);
      const step = Math.max(0.9, l.s * g.U * 6);
      for (let x = x0; x < x1; x += step * (0.5 + rand())) {
        if (noise2(x * 0.05, l.s * 90, 9) < 0.42) continue;
        out.push({ x, y: leveeY(g, l, x), r: g.U * (0.35 + l.s * 3.4) * (0.7 + rand() * 0.5) });
      }
    }
  }

  function paintOverlay(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    paintFarm(ctx, g, rand, pathX(g, 0.015), groundY(g, 0.015));
    paintLevees(ctx, g);
    paintPath(ctx, g, rand);
    paintBankGrass(ctx, g, rand);
    const blooms = [];
    pathDrift(g, rand, blooms);
    leveeDrift(g, rand, blooms);
    blooms.sort((a, b) => a.y - b.y);
    for (const b of blooms) paintBloom(ctx, g, rand, b);
    return c;
  }

  // Near bank the tall lilies stand behind: dark moss with a low fringe of lesser blooms.
  function frontEdge(g, x) {
    const f = x / g.W;
    const left = smoothstep(0.54, 0.0, f) * 0.11;
    const right = smoothstep(0.78, 1.0, f) * 0.1;
    return g.H * (1.0 - Math.max(left, right)) + Math.sin(x * 0.11) * g.U * 0.7;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    ctx.fillStyle = MOSS[0];
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, frontEdge(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    paintFrontGrass(ctx, g, rand);
    const span = g.W / g.U;
    const blooms = [];
    for (let i = 0; i < span * 0.16; i++) {
      const x = rand() * g.W;
      if (frontEdge(g, x) > g.H * 0.975) continue;
      blooms.push({ x, y: frontEdge(g, x) + g.U * (1 + rand() * 7), r: g.U * (2.4 + rand() * 2.2) });
    }
    blooms.sort((a, b) => a.y - b.y);
    for (const b of blooms) paintBloom(ctx, g, rand, b);
    return c;
  }

  function paintFrontGrass(ctx, g, rand) {
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    const count = Math.round((g.W / g.U) * 7);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const top = frontEdge(g, x);
      if (top > g.H * 0.985) continue;
      const y = top + rand() * (g.H - top);
      const len = g.U * (2 + rand() * 5);
      ctx.strokeStyle = MOSS[1 + Math.floor(rand() * 3)];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x, y - len * 0.7, x + (rand() - 0.5) * len, y - len);
      ctx.stroke();
    }
  }

  /* ---------- moving rice ---------- */

  // Light crests in one flat tone, drawn twice over so any slice stays in range.
  function paintWaveTile(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.3);
    const tile = layer(w, h);
    const tctx = tile.getContext('2d');
    const img = tctx.createImageData(w, h);
    const f = (x, y) => fbm((x * 18) / w, (y * 7) / h, 3, 57);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const crest = v > 0.58 ? 1 : 0;
        const i = (y * w + x) * 4;
        img.data[i] = 248;
        img.data[i + 1] = 228;
        img.data[i + 2] = 150;
        img.data[i + 3] = crest * 0.32 * 255;
      }
    }
    tctx.putImageData(img, 0, 0);
    const c = layer(w * 2, h);
    const ctx = c.getContext('2d');
    ctx.drawImage(tile, 0, 0);
    ctx.drawImage(tile, w, 0);
    return { c, w, h };
  }

  function makeWaveRows(g) {
    const top = groundY(g, 0.012);
    const rows = Math.min(WAVE_ROWS, Math.ceil((g.H - top) / Math.max(1, g.U * 0.9)));
    const h = (g.H - top) / rows;
    const tile = state.wave;
    const r = { n: rows, h: h + 0.5, y: new Float32Array(rows), sw: new Float32Array(rows), off: new Float32Array(rows), sy: new Float32Array(rows) };
    for (let i = 0; i < rows; i++) {
      const y = top + i * h;
      const s = (y - groundY(g, 0)) / (g.H * GROUND_SPAN);
      r.y[i] = y;
      r.sw[i] = Math.min(tile.w, (tile.w * 0.25) / Math.max(s, 0.01));
      r.off[i] = -0.7 * r.sw[i] + (tile.w * 0.1) / Math.max(s, 0.08);
      r.sy[i] = (tile.h - 2) * (1 - Math.sqrt(Math.max(s, 0)));
    }
    return r;
  }

  function drawWaves(ctx, g, wind) {
    const tile = state.wave;
    const rows = state.rows;
    const drift = state.phase * g.U * 1.5;
    ctx.globalAlpha = Math.min(1, 0.3 + wind * 0.7);
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < rows.n; i++) {
      let sx = (rows.off[i] - drift) % tile.w;
      if (sx < 0) sx += tile.w;
      ctx.drawImage(tile.c, sx, rows.sy[i], rows.sw[i], 1.5, 0, rows.y[i], g.W, rows.h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
  }

  function makeHeads(g, rand) {
    const n = Math.min(MAX_HEADS, Math.round((g.W / g.U) * 3.8));
    const heads = { n, near: 0, x: new Float32Array(n), y: new Float32Array(n), len: new Float32Array(n), key: new Float32Array(n), dir: new Int8Array(n), bend: new Float32Array(n), tone: new Uint8Array(n) };
    const picks = [];
    while (picks.length < n) {
      const s = 0.1 + Math.pow(rand(), 0.8) * 0.9;
      const x = rand() * g.W;
      if (Math.abs(x - pathX(g, s)) < pathHalf(g, s) + bankWidth(g, s)) continue;
      picks.push({ s, x });
    }
    picks.sort((a, b) => a.s - b.s);
    picks.forEach((p, i) => {
      heads.x[i] = p.x;
      heads.y[i] = groundY(g, p.s);
      heads.len[i] = g.U * p.s * (8 + rand() * 4);
      heads.key[i] = (p.x - g.W * 0.7) / (p.s * g.U * 15) + 3 / p.s + rand() * 0.5;
      heads.dir[i] = rand() < 0.75 ? 1 : -1;
      if (p.s < 0.5) heads.near = i + 1;
    });
    return heads;
  }

  function strokeHeads(ctx, h, from, to, tone) {
    ctx.strokeStyle = HEAD_TONES[tone];
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      if (h.tone[i] !== tone) continue;
      const x = h.x[i];
      const y = h.y[i];
      const len = h.len[i];
      const bend = h.bend[i];
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + bend * 0.4, y - len, x + bend + h.dir[i] * len * 0.42, y - len * 0.62);
    }
    ctx.stroke();
  }

  function drawHeads(ctx, g, wind) {
    const h = state.heads;
    const reach = 0.25 + wind * 0.5;
    for (let i = 0; i < h.n; i++) {
      const v = Math.sin(state.phase * 0.55 - h.key[i]) * 0.7 + Math.sin(state.phase * 0.31 - h.key[i] * 0.43) * 0.3;
      h.bend[i] = v * h.len[i] * reach;
      h.tone[i] = v > 0.3 ? 2 : v < -0.3 ? 0 : 1;
    }
    ctx.lineCap = 'round';
    for (let tone = 0; tone < 3; tone++) {
      ctx.lineWidth = 1;
      strokeHeads(ctx, h, 0, h.near, tone);
      ctx.lineWidth = Math.max(1, g.U * 0.7);
      strokeHeads(ctx, h, h.near, h.n, tone);
    }
  }

  function drawPlants(ctx, t, wind) {
    for (const p of state.plants) {
      const a = (Math.sin(t * p.nod + p.phase) + 0.5 * Math.sin(t * p.nod * 0.47 + p.phase * 2)) * 0.012 * (0.3 + wind);
      ctx.save();
      ctx.translate(p.footX, p.footY);
      ctx.rotate(a);
      ctx.drawImage(p.c, -p.ax, -p.ay);
      ctx.restore();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g);
    state.clouds = paintClouds(g);
    state.land = paintLand(g, rand);
    state.overlay = paintOverlay(g, rand);
    state.front = paintFront(g, rand);
    state.wave = paintWaveTile(g);
    state.rows = makeWaveRows(g);
    state.heads = makeHeads(g, rand);
    state.plants = PLANTS.map((p, i) => makePlant(g, rand, p, i));
  }

  function drawClouds(ctx, g, t) {
    const w = g.W * 1.5;
    const h = g.H * 0.32;
    const x = -((t * g.U * 0.7) % w);
    ctx.drawImage(state.clouds, x, g.H * 0.02, w, h);
    ctx.drawImage(state.clouds, x + w, g.H * 0.02, w, h);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const wind = api.props.wind;
    state.phase += dt * wind;
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.land, 0, 0);
    drawWaves(ctx, g, wind);
    ctx.drawImage(state.overlay, 0, 0);
    drawHeads(ctx, g, wind);
    drawPlants(ctx, t, wind);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { wind: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.12, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
