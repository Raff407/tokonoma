/*
 * 招き猫 Maneki — beckoning cats on a lit shop shelf, seen through wet glass at night.
 *
 * The shop, the cats and the glass are baked once. Each frame only turns one arm
 * sprite per cat about its shoulder, slides a few street reflections and steps a
 * short list of drops down the pane.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const CATS = [
    { f: 0.105, wideF: 0.15, s: 23, side: -1, eyes: 'shut', period: 3.7, phase: 0.6 },
    { f: 0.26, s: 38, side: -1, eyes: 'open', period: 5.3, phase: 2.2, coin: true },
    { f: 0.68, s: 27, side: 1, eyes: 'shut', period: 4.1, phase: 4.1, block: 5 },
    { f: 0.835, s: 41, side: 1, eyes: 'open', period: 5.9, phase: 1.3, coin: true, cloth: '#4f68a0' },
    { f: 0.47, s: 58, side: 1, eyes: 'open', period: 6.8, phase: 0, coin: true, cloth: '#c44a32' },
  ];
  const WIDE_CATS = [
    { f: 0.06, s: 30, side: -1, eyes: 'open', period: 4.7, phase: 3.3 },
    { f: 0.935, s: 27, side: 1, eyes: 'shut', period: 3.9, phase: 5.2 },
  ];
  const WHITE = '#f4eddd';
  const LINE = '#8d7558';
  const PINK = '#d98c78';
  const INK = '#221d24';
  const LIGHTS = ['#e6b35a', '#c9583a', '#6f9aa6', '#e6b35a', '#d98f4a'];
  const TRAIL_STEPS = 6;
  const MAX_DROPS = 90;
  const CAR_MARGIN = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function fillEllipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.fill();
  }

  // Painted small and scaled up, which is the cheap way to throw the room out of focus.
  function paintBlurredRoom(g, rand) {
    const q = 5;
    const small = layer(g.W / q, g.H / q);
    const ctx = small.getContext('2d');
    const w = small.width;
    const h = small.height;
    const wall = ctx.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, '#8d5e34');
    wall.addColorStop(0.35, '#c98f4c');
    wall.addColorStop(0.8, '#b27a44');
    wall.addColorStop(1, '#7a5030');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    for (const y of [0.34, 0.58]) {
      ctx.fillStyle = '#6e4628';
      ctx.fillRect(0, h * y, w, Math.max(1, h * 0.03));
      paintGoods(ctx, w, h * y, h, rand);
    }
    const big = layer(g.W, g.H);
    const out = big.getContext('2d');
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = 'high';
    out.drawImage(small, 0, 0, g.W, g.H);
    return big;
  }

  function paintGoods(ctx, w, y, h, rand) {
    const tones = ['#e2cfa6', '#8a5a34', '#55628a', '#b0543a', '#dcc9a2', '#7f8650', '#d4a850'];
    let x = rand() * 2;
    while (x < w) {
      const gw = 1 + rand() * 2.5;
      const gh = h * (0.05 + rand() * 0.11);
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(x, y - gh, gw, gh);
      x += gw + rand() * 1.6;
    }
  }

  function paintLamp(ctx, x, y, r) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, 'rgba(246,206,132,0.72)');
    glow.addColorStop(0.4, 'rgba(232,170,92,0.28)');
    glow.addColorStop(1, 'rgba(232,170,92,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function paintShelf(ctx, g, rand) {
    const top = g.base - g.U * 3.4;
    const edge = g.base + g.U * 2;
    const surface = ctx.createLinearGradient(0, top, 0, edge);
    surface.addColorStop(0, '#94633a');
    surface.addColorStop(1, '#c08a50');
    ctx.fillStyle = surface;
    ctx.fillRect(0, top, g.W, edge - top);
    ctx.fillStyle = '#e4b87c';
    ctx.fillRect(0, edge, g.W, Math.max(1, g.U * 0.6));
    ctx.fillStyle = '#8d6340';
    ctx.fillRect(0, edge + g.U * 0.6, g.W, g.U * 5);
    ctx.fillStyle = '#6c4c3a';
    ctx.fillRect(0, edge + g.U * 5.6, g.W, g.H - edge);
    ctx.fillStyle = '#946a42';
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < g.W * 0.22; i++) {
      ctx.fillRect(rand() * g.W, edge + g.U * (1 + rand() * 4), g.U * (2 + rand() * 10), 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintBlock(ctx, g, x, base, hw, h) {
    ctx.fillStyle = '#c7a06a';
    ctx.fillRect(x - hw, base - h, hw * 2, h);
    ctx.fillStyle = '#e0bf8c';
    ctx.fillRect(x - hw, base - h, hw * 2, Math.max(1, g.U * 0.5));
    ctx.fillStyle = '#8c6a44';
    ctx.fillRect(x - hw, base - Math.max(1, g.U * 0.4), hw * 2, Math.max(1, g.U * 0.4));
  }

  function paintCushion(ctx, g, cat) {
    const hw = cat.s * 0.52;
    const h = cat.s * 0.1;
    ctx.fillStyle = 'rgba(40,24,18,0.4)';
    fillEllipse(ctx, cat.x, cat.y + h * 0.1, hw * 1.1, h * 0.8);
    ctx.fillStyle = cat.cloth;
    ctx.beginPath();
    ctx.moveTo(cat.x - hw, cat.y);
    ctx.quadraticCurveTo(cat.x - hw * 1.05, cat.y - h, cat.x - hw * 0.8, cat.y - h);
    ctx.lineTo(cat.x + hw * 0.8, cat.y - h);
    ctx.quadraticCurveTo(cat.x + hw * 1.05, cat.y - h, cat.x + hw, cat.y);
    ctx.quadraticCurveTo(cat.x, cat.y + h * 0.4, cat.x - hw, cat.y);
    ctx.fill();
    ctx.fillStyle = '#e0b552';
    fillEllipse(ctx, cat.x - hw, cat.y - h * 0.2, h * 0.3, h * 0.3);
    fillEllipse(ctx, cat.x + hw, cat.y - h * 0.2, h * 0.3, h * 0.3);
  }

  function bodyPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - 0.25 * s, y);
    ctx.bezierCurveTo(x - 0.4 * s, y - 0.06 * s, x - 0.36 * s, y - 0.34 * s, x - 0.18 * s, y - 0.54 * s);
    ctx.lineTo(x + 0.18 * s, y - 0.54 * s);
    ctx.bezierCurveTo(x + 0.36 * s, y - 0.34 * s, x + 0.4 * s, y - 0.06 * s, x + 0.25 * s, y);
    ctx.quadraticCurveTo(x, y + 0.02 * s, x - 0.25 * s, y);
  }

  function paintBody(ctx, x, y, s) {
    const shade = ctx.createRadialGradient(x, y - 0.32 * s, s * 0.06, x, y - 0.22 * s, s * 0.42);
    shade.addColorStop(0, WHITE);
    shade.addColorStop(0.62, '#efe6d3');
    shade.addColorStop(1, '#c4b093');
    ctx.fillStyle = shade;
    bodyPath(ctx, x, y, s);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = Math.max(1, s * 0.016);
    ctx.stroke();
    for (const f of [-1, 1]) paintFoot(ctx, x + f * 0.14 * s, y, s);
  }

  function paintFoot(ctx, x, y, s) {
    ctx.fillStyle = WHITE;
    fillEllipse(ctx, x, y - 0.035 * s, 0.085 * s, 0.045 * s);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.stroke();
    ctx.beginPath();
    for (const k of [-1, 1]) {
      ctx.moveTo(x + k * 0.03 * s, y - 0.055 * s);
      ctx.lineTo(x + k * 0.03 * s, y - 0.025 * s);
    }
    ctx.stroke();
  }

  function paintCollar(ctx, x, y, s) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#c23a26';
    ctx.lineWidth = 0.06 * s;
    ctx.beginPath();
    ctx.moveTo(x - 0.22 * s, y - 0.52 * s);
    ctx.quadraticCurveTo(x, y - 0.41 * s, x + 0.22 * s, y - 0.52 * s);
    ctx.stroke();
    ctx.fillStyle = '#d9a93a';
    fillEllipse(ctx, x, y - 0.415 * s, 0.062 * s, 0.062 * s);
    ctx.fillStyle = '#f3dc92';
    fillEllipse(ctx, x - 0.018 * s, y - 0.435 * s, 0.022 * s, 0.018 * s);
    ctx.fillStyle = '#6e4a1c';
    ctx.fillRect(x - 0.05 * s, y - 0.408 * s, 0.1 * s, Math.max(1, 0.011 * s));
    fillEllipse(ctx, x, y - 0.38 * s, 0.012 * s, 0.012 * s);
  }

  function headPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.ellipse(x, y - 0.72 * s, 0.315 * s, 0.245 * s, 0, 0, 6.3);
    ctx.moveTo(x - 0.3 * s, y - 0.8 * s);
    ctx.lineTo(x - 0.285 * s, y - 1.01 * s);
    ctx.lineTo(x - 0.09 * s, y - 0.93 * s);
    ctx.closePath();
    ctx.moveTo(x + 0.3 * s, y - 0.8 * s);
    ctx.lineTo(x + 0.285 * s, y - 1.01 * s);
    ctx.lineTo(x + 0.09 * s, y - 0.93 * s);
    ctx.closePath();
  }

  function paintHead(ctx, x, y, s) {
    ctx.strokeStyle = LINE;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, s * 0.022);
    headPath(ctx, x, y, s);
    ctx.stroke();
    ctx.fillStyle = WHITE;
    headPath(ctx, x, y, s);
    ctx.fill();
    ctx.fillStyle = PINK;
    for (const f of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + f * 0.265 * s, y - 0.84 * s);
      ctx.lineTo(x + f * 0.265 * s, y - 0.965 * s);
      ctx.lineTo(x + f * 0.14 * s, y - 0.915 * s);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(217,140,120,0.42)';
    fillEllipse(ctx, x - 0.2 * s, y - 0.635 * s, 0.06 * s, 0.038 * s);
    fillEllipse(ctx, x + 0.2 * s, y - 0.635 * s, 0.06 * s, 0.038 * s);
  }

  function paintEyes(ctx, x, y, s, kind) {
    for (const f of [-1, 1]) {
      const ex = x + f * 0.125 * s;
      const ey = y - 0.72 * s;
      if (kind === 'shut') {
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(1, s * 0.026);
        ctx.beginPath();
        ctx.arc(ex, ey + 0.02 * s, 0.05 * s, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        ctx.fillStyle = INK;
        fillEllipse(ctx, ex, ey, 0.047 * s, 0.058 * s);
        ctx.fillStyle = '#f7f1e2';
        fillEllipse(ctx, ex - 0.014 * s, ey - 0.02 * s, 0.014 * s, 0.014 * s);
      }
    }
  }

  function paintMuzzle(ctx, x, y, s) {
    ctx.fillStyle = '#c9503a';
    ctx.beginPath();
    ctx.moveTo(x - 0.028 * s, y - 0.665 * s);
    ctx.lineTo(x + 0.028 * s, y - 0.665 * s);
    ctx.lineTo(x, y - 0.635 * s);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath();
    ctx.arc(x - 0.03 * s, y - 0.632 * s, 0.03 * s, 0.1, Math.PI - 0.3);
    ctx.moveTo(x + 0.06 * s, y - 0.632 * s);
    ctx.arc(x + 0.03 * s, y - 0.632 * s, 0.03 * s, 0.1, Math.PI - 0.3);
    ctx.stroke();
    ctx.strokeStyle = '#7a6a58';
    ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.beginPath();
    for (const f of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(x + f * 0.17 * s, y - (0.65 - i * 0.02) * s);
        ctx.lineTo(x + f * 0.355 * s, y - (0.67 - i * 0.05) * s);
      }
    }
    ctx.stroke();
  }

  // The arm that stays down rests on the belly, by a blank gold coin on some cats.
  function paintRestingArm(ctx, x, y, s, side, coin) {
    const f = -side;
    if (coin) paintCoin(ctx, x + f * 0.035 * s, y - 0.185 * s, s);
    ctx.strokeStyle = LINE;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.125 * s;
    armStroke(ctx, x, y, s, f);
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 0.1 * s;
    armStroke(ctx, x, y, s, f);
  }

  function paintCoin(ctx, x, y, s) {
    ctx.fillStyle = '#d9ac40';
    fillEllipse(ctx, x, y, 0.085 * s, 0.112 * s);
    ctx.strokeStyle = '#8f6c22';
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.stroke();
    ctx.fillStyle = '#f0d690';
    fillEllipse(ctx, x, y - 0.062 * s, 0.045 * s, 0.018 * s);
    ctx.fillStyle = '#b48a2c';
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 0.052 * s, y + (i * 0.036 - 0.025) * s, 0.104 * s, Math.max(1, 0.01 * s));
  }

  function armStroke(ctx, x, y, s, f) {
    ctx.beginPath();
    ctx.moveTo(x + f * 0.185 * s, y - 0.45 * s);
    ctx.quadraticCurveTo(x + f * 0.26 * s, y - 0.3 * s, x + f * 0.135 * s, y - 0.2 * s);
    ctx.stroke();
  }

  function paintCat(ctx, g, cat) {
    const { x, y, s } = cat;
    ctx.fillStyle = 'rgba(40,24,18,0.42)';
    fillEllipse(ctx, x, y + g.U * 0.2, s * 0.38, s * 0.04);
    paintBody(ctx, x, y, s);
    paintRestingArm(ctx, x, y, s, cat.side, cat.coin);
    paintCollar(ctx, x, y, s);
    paintHead(ctx, x, y, s);
    paintEyes(ctx, x, y, s, cat.eyes);
    paintMuzzle(ctx, x, y, s);
  }

  // Pointing straight up, pivot near the bottom, palm to the street.
  function paintArmSprite(s) {
    const w = 0.3 * s + 2;
    const h = 0.56 * s + 2;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const x = c.width / 2;
    const py = 0.44 * s + 1;
    const outline = (fill) => {
      ctx.beginPath();
      ctx.moveTo(x - 0.085 * s, py + 0.04 * s);
      ctx.lineTo(x - 0.075 * s, py - 0.28 * s);
      ctx.arc(x, py - 0.32 * s, 0.1 * s, Math.PI * 0.85, Math.PI * 0.15);
      ctx.lineTo(x + 0.085 * s, py + 0.04 * s);
      ctx.arc(x, py + 0.04 * s, 0.085 * s, 0, Math.PI);
      if (fill) ctx.fill();
      else ctx.stroke();
    };
    ctx.strokeStyle = LINE;
    ctx.lineWidth = Math.max(1.2, s * 0.024);
    outline(false);
    ctx.fillStyle = WHITE;
    outline(true);
    ctx.fillStyle = PINK;
    fillEllipse(ctx, x, py - 0.3 * s, 0.05 * s, 0.04 * s);
    for (const f of [-1, 0, 1]) fillEllipse(ctx, x + f * 0.05 * s, py - 0.37 * s + Math.abs(f) * 0.012 * s, 0.018 * s, 0.022 * s);
    return { canvas: c, px: x, py };
  }

  function makeCats(g) {
    const wide = g.W / g.H > 2.05;
    const specs = wide ? WIDE_CATS.concat(CATS) : CATS;
    const fit = Math.min(1, g.W / (g.H * 1.35));
    return specs.map((spec) => {
      const s = spec.s * g.U * fit;
      const block = (spec.block || 0) * g.U;
      const x = g.W * (wide && spec.wideF ? spec.wideF : spec.f);
      const y = g.base - block - (spec.cloth ? s * 0.085 : 0);
      return {
        ...spec,
        x,
        y,
        s,
        block,
        sx: x + spec.side * 0.2 * s,
        sy: y - 0.46 * s,
        arm: paintArmSprite(s),
        rate: 6.283 / spec.period,
      };
    });
  }

  function paintShop(g, rand) {
    const c = paintBlurredRoom(g, rand);
    const ctx = c.getContext('2d');
    paintLamp(ctx, g.W * 0.47, g.H * 0.36, g.U * 62);
    paintLamp(ctx, g.W * 0.82, g.H * 0.42, g.U * 34);
    paintLamp(ctx, g.W * 0.16, g.H * 0.46, g.U * 30);
    paintShelf(ctx, g, rand);
    for (const cat of state.cats) {
      if (cat.block) paintBlock(ctx, g, cat.x, g.base, cat.s * 0.5, cat.block);
      if (cat.cloth) paintCushion(ctx, g, cat);
      paintCat(ctx, g, cat);
    }
    return c;
  }

  function paintDisc(radius, colour) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, gn, b] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${gn},${b},0.42)`);
    grad.addColorStop(0.72, `rgba(${r},${gn},${b},0.5)`);
    grad.addColorStop(1, `rgba(${r},${gn},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function makeReflections(g, rand) {
    const clusters = [[0.09, 0.3, 7], [0.31, 0.26, 4], [0.77, 0.17, 6], [0.92, 0.22, 7], [0.2, 0.93, 4], [0.77, 0.93, 5]];
    const list = [];
    for (const [fx, fy, n] of clusters) {
      for (let i = 0; i < n; i++) {
        const r = g.U * (2 + rand() * rand() * 9);
        list.push({
          x: g.W * fx + (rand() - 0.5) * g.U * 30,
          y: g.H * fy + (rand() - 0.5) * g.U * 18,
          r,
          sprite: paintDisc(r, LIGHTS[Math.floor(rand() * LIGHTS.length)]),
          phase: rand() * 6.28,
          rate: 0.08 + rand() * 0.16,
        });
      }
    }
    return list;
  }

  function paintGlass(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const [from, to] of [[0, g.W * 0.16], [g.W, g.W * 0.84]]) {
      const tint = ctx.createLinearGradient(from, 0, to, 0);
      tint.addColorStop(0, 'rgba(38,54,92,0.3)');
      tint.addColorStop(1, 'rgba(38,54,92,0)');
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, g.W, g.H);
    }
    const count = Math.floor(g.W * g.H * 0.012);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      if (fbm(x * 0.03 / g.U, y * 0.03 / g.U, 3, 7) < 0.46) continue;
      const big = rand() < 0.12;
      const d = Math.max(1, g.U * (big ? 1 : 0.5));
      ctx.fillStyle = 'rgba(30,28,46,0.3)';
      ctx.fillRect(x, y, d, Math.max(1, d * 0.5));
      ctx.fillStyle = 'rgba(244,236,214,0.42)';
      ctx.fillRect(x, y + d * 0.5, d, Math.max(1, d * 0.6));
    }
    return c;
  }

  function paintFallingRain(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#cdd6dc';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    for (let i = 0; i < g.W * 0.3; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      const len = g.U * (3 + rand() * 6);
      for (const shift of [0, -g.H]) {
        ctx.moveTo(x, y + shift);
        ctx.lineTo(x - len * 0.07, y + len + shift);
      }
    }
    ctx.stroke();
    return c;
  }

  function paintSurround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const post = g.U * 4.5;
    const rail = g.H * 0.93;
    ctx.fillStyle = '#665048';
    ctx.fillRect(0, 0, post, g.H);
    ctx.fillRect(g.W - post, 0, post, g.H);
    const wet = ctx.createLinearGradient(0, rail, 0, g.H);
    wet.addColorStop(0, '#b08a62');
    wet.addColorStop(1, '#6a5048');
    ctx.fillStyle = wet;
    ctx.fillRect(0, rail, g.W, g.H - rail);
    ctx.fillStyle = '#d8d0c0';
    ctx.fillRect(0, rail, g.W, Math.max(1, g.U * 0.7));
    ctx.fillStyle = '#7f6652';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < g.W * 0.2; i++) ctx.fillRect(rand() * g.W, rail + g.U * (1 + rand() * 7), g.U * (2 + rand() * 12), 1);
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(rand() * post, rand() * g.H, 1, g.U * (4 + rand() * 10));
      ctx.fillRect(g.W - rand() * post, rand() * g.H, 1, g.U * (4 + rand() * 10));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4a3a38';
    ctx.fillRect(0, 0, g.W, g.U * 3);
    return c;
  }

  function paintNoren(g) {
    const n = Math.max(4, Math.round(g.W / (g.U * 19)));
    const w = g.W / n;
    const h = g.U * 13;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const gap = Math.max(1, g.U * 0.7);
    const cloth = ctx.createLinearGradient(0, 0, 0, h);
    cloth.addColorStop(0, '#3a4e7c');
    cloth.addColorStop(0.7, '#5a6e9c');
    cloth.addColorStop(1, '#8c8e9c');
    ctx.fillStyle = cloth;
    ctx.fillRect(gap, 0, c.width - gap * 2, h);
    const fold = Math.max(1, g.U * 1.1);
    ctx.fillStyle = 'rgba(30,40,74,0.4)';
    ctx.fillRect(c.width * 0.28, 0, fold, h);
    ctx.fillRect(c.width * 0.68, 0, fold, h);
    ctx.fillStyle = 'rgba(180,192,216,0.3)';
    ctx.fillRect(c.width * 0.28 + fold, 0, fold, h);
    ctx.fillRect(c.width * 0.68 + fold, 0, fold, h);
    return { canvas: c, n, w };
  }

  // Sheets of water: long wavering runs that repeat exactly over the height, so they slide without a seam.
  function paintRunoff(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const runs = Math.floor(g.W / 3);
    ctx.lineCap = 'round';
    for (let i = 0; i < runs; i++) {
      const x = rand() * g.W;
      const start = rand() * g.H;
      const len = g.H * (0.15 + rand() * 0.35);
      const waves = 1 + Math.floor(rand() * 4);
      const amp = g.U * (0.4 + rand() * 1.4);
      const p = rand() * 6.28;
      ctx.lineWidth = Math.max(1, g.U * (0.4 + rand() * 0.6));
      ctx.strokeStyle = rand() < 0.86 ? 'rgba(240,240,228,0.3)' : 'rgba(30,34,58,0.16)';
      for (const shift of [0, -g.H]) {
        ctx.beginPath();
        for (let k = 0; k <= 14; k++) {
          const y = start + (len * k) / 14;
          const wx = x + Math.sin((y / g.H) * 6.283 * waves + p) * amp;
          if (k === 0) ctx.moveTo(wx, y + shift);
          else ctx.lineTo(wx, y + shift);
        }
        ctx.stroke();
      }
    }
    return c;
  }

  function makeDrops(g, rand) {
    const left = g.U * 5;
    const span = g.W - left * 2;
    const count = Math.min(MAX_DROPS, Math.floor(g.W / 3));
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        x: left + ((i * 0.618034) % 1) * span,
        rate: 0.018 + rand() * 0.035,
        start: rand(),
        slip: 0.02 + rand() * 0.015,
        slipPhase: rand() * 6.28,
        a1: g.U * (0.5 + rand() * 1.4),
        f1: (0.06 + rand() * 0.08) / g.U,
        p1: rand() * 6.28,
        size: g.U * (0.8 + rand() * rand() * 1.1),
        trail: g.U * (10 + rand() * 22),
      });
    }
    return list;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.base = g.H * 0.815;
    const rand = K.rng(api.seed);
    state.g = g;
    state.cats = makeCats(g);
    state.shop = paintShop(g, rand);
    state.glass = paintGlass(g, rand);
    state.falling = paintFallingRain(g, rand);
    state.runoff = paintRunoff(g, rand);
    state.surround = paintSurround(g, rand);
    state.noren = paintNoren(g);
    state.reflections = makeReflections(g, rand);
    state.drops = makeDrops(g, rand);
    state.carGlow = paintDisc(g.U * 11, '#e6b35a');
    state.carRed = paintDisc(g.U * 8, '#c9583a');
  }

  function drawArms(ctx, t, beat) {
    for (const cat of state.cats) {
      const wave = 0.5 - 0.5 * Math.cos(t * cat.rate * beat + cat.phase);
      const v = wave * wave * (3 - 2 * wave);
      ctx.save();
      ctx.translate(cat.sx, cat.sy);
      ctx.rotate(cat.side * lerp(0.16, 0.86, v));
      ctx.scale(1, lerp(1, 0.84, v));
      ctx.drawImage(cat.arm.canvas, -cat.arm.px, -cat.arm.py);
      ctx.restore();
    }
  }

  function drawReflections(ctx, g, t, amount) {
    if (amount <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const l of state.reflections) {
      const breathe = 0.55 + 0.45 * Math.sin(t * l.rate + l.phase);
      ctx.globalAlpha = Math.min(1, breathe * 0.75 * amount);
      ctx.drawImage(l.sprite, l.x - l.r + Math.sin(t * l.rate * 0.5 + l.phase) * g.U * 2, l.y - l.r);
    }
    // The margin hides the whole pair of lamps off either edge when the sweep wraps.
    const margin = g.U * CAR_MARGIN;
    const sweep = g.W + margin * 2;
    const a = ((t * g.U * 2.6) % sweep) - margin;
    const b = sweep - ((t * g.U * 1.9 + sweep * 0.4) % sweep) - margin;
    ctx.globalAlpha = Math.min(1, 0.7 * amount);
    ctx.drawImage(state.carGlow, a, g.H * 0.8);
    ctx.drawImage(state.carGlow, a + g.U * 26, g.H * 0.8);
    ctx.drawImage(state.carRed, b, g.H * 0.15);
    ctx.drawImage(state.carRed, b + g.U * 20, g.H * 0.15);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function dropY(d, t, H, margin) {
    const p = (t * d.rate + d.start) % 1;
    const eased = p + d.slip * Math.sin(p * 6.283 * 4 + d.slipPhase);
    return eased * (H + margin) - margin * 0.5;
  }

  function drawDrops(ctx, g, t, amount) {
    const active = Math.floor(state.drops.length * Math.min(1, amount / 2));
    for (let i = 0; i < active; i++) {
      const d = state.drops[i];
      const y = dropY(d, t, g.H, d.trail * 2);
      const step = d.trail / TRAIL_STEPS;
      ctx.fillStyle = '#eef0e8';
      for (let k = TRAIL_STEPS; k > 0; k--) {
        const ty = y - k * step;
        const x = d.x + Math.sin(ty * d.f1 + d.p1) * d.a1;
        ctx.globalAlpha = 0.8 * (1 - k / (TRAIL_STEPS + 1));
        ctx.fillRect(x, ty, Math.max(1, d.size * 0.6), step + 0.5);
      }
      const hx = d.x + Math.sin(y * d.f1 + d.p1) * d.a1;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#23263a';
      ctx.fillRect(hx - d.size * 0.3, y - d.size * 0.2, d.size * 1.6, d.size * 1.8);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#fbf6e8';
      ctx.fillRect(hx, y, d.size, d.size * 1.2);
    }
    ctx.globalAlpha = 1;
  }

  function drawNoren(ctx, g, t) {
    const { canvas, n, w } = state.noren;
    for (let i = 0; i < n; i++) {
      const lean = Math.sin(t * 0.34 + i * 1.1) * 0.05;
      ctx.save();
      const drop = g.U * (0.9 + 0.9 * Math.sin(i * 2.4)) - g.U * 3.4;
      ctx.transform(1, 0, lean, 1, i * w, drop);
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.drawImage(state.shop, 0, 0);
    drawArms(ctx, t, p.beat);
    ctx.drawImage(state.glass, 0, 0);
    drawReflections(ctx, g, t, p.street);
    drawRain(ctx, g, t, p.rain);
    drawDrops(ctx, g, t, p.rain);
    ctx.drawImage(state.surround, 0, 0);
    drawNoren(ctx, g, t);
  }

  // Both rain layers fade with the slider, so rain = 0 leaves only the beads on dry glass.
  function drawRain(ctx, g, t, rain) {
    if (rain <= 0) return;
    ctx.globalAlpha = Math.min(1, rain);
    const fall = (t * g.U * 34) % g.H;
    ctx.drawImage(state.falling, 0, fall);
    ctx.drawImage(state.falling, 0, fall - g.H);
    const run = (t * g.U * 3.2) % g.H;
    ctx.drawImage(state.runoff, 0, run);
    ctx.drawImage(state.runoff, 0, run - g.H);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { rain: 1, beat: 1, street: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
