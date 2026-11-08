/*
 * 鹿威し Shishi — a bamboo deer-scarer in a mossy stone garden.
 *
 * The garden, the basin and the bamboo tube are baked once; the tube is one
 * sprite turned about its axle, on a clock that fills, tips, spills and falls.
 * Water is a few strokes, a small pool of drops and a fixed list of ring ellipses.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const FRESH = ['#7d8a3c', '#b6be5e', '#ece9a0', '#c8ca6c', '#9ca84c', '#667434'];
  const POST = ['#6f6a3a', '#9c9452', '#c6bc78', '#a89f5a', '#857d44', '#585530'];
  const AGED = ['#6a8370', '#7b947c', '#8ca486', '#7f977e', '#6f8974', '#5f7866'];
  const STONE = { dark: '#565e60', mid: '#7a8380', light: '#a0aaa4', wet: '#dfe8e4' };
  const MOSS = ['#7f9f4f', '#9ab85c', '#6c8c48'];
  const LEAVES = ['#cf5433', '#de7a45', '#bd4630', '#d39a4c'];

  const CYCLE = { sag: 10.5, tip: 11.2, spill: 13, fall: 13.7, end: 15.5 };
  const ANGLE = { rest: -0.42, sag: -0.3, down: 0.3 };
  const MAX_RINGS = 14;
  const MAX_DROPS = 56;
  const FALLING = 4;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(g) {
    const u = g.U;
    const px = g.W * 0.5 - u * 12;
    const py = u * 46;
    return {
      px, py,
      front: u * 52,
      rear: u * 34,
      r: u * 7,
      cut: u * 12,
      spoutX: px + u * 42,
      spoutY: u * 15,
      cx: g.W * 0.5 + u * 33,
      cy: u * 78,
      rx: u * 33,
      ry: u * 9.5,
    };
  }

  // A length of bamboo along +x in the current transform, shaded in flat bands.
  function paintCulm(ctx, x0, x1, r, tones, nodes) {
    const n = tones.length;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = tones[i];
      ctx.fillRect(x0, -r + (2 * r * i) / n, x1 - x0, (2 * r) / n + 0.3);
    }
    for (const x of nodes) {
      ctx.fillStyle = tones[5];
      ctx.fillRect(x - r * 0.1, -r * 1.04, r * 0.16, r * 2.08);
      ctx.fillStyle = tones[2];
      ctx.fillRect(x + r * 0.06, -r * 1.04, r * 0.14, r * 2.08);
    }
  }

  function paintGround(ctx, g, rand) {
    const u = g.U;
    const edge = (x) => u * (57 + fbm(x * 0.02, 3, 3, 11) * 7);
    ctx.fillStyle = '#74944c';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, edge(x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    const tones = ['#7c9c4c', '#93b158', '#5a7a44', '#aec76a', '#4c6c42'];
    const count = Math.floor(g.W * g.H * 0.09);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = edge(x) + rand() * (g.H - edge(x));
      const patch = fbm(x * 0.05, y * 0.09, 3, 5);
      ctx.fillStyle = tones[Math.min(4, Math.floor(rand() * 2 + patch * 3.2))];
      const s = u * (0.5 + rand() * 1.3);
      ctx.fillRect(x, y, s * 1.5, s);
    }
  }

  function paintGrove(ctx, g, rand) {
    const u = g.U;
    const sky = ['#8ea896', '#9bb19d', '#a9baa4', '#9db19c', '#8ca590'];
    for (let i = 0; i < sky.length; i++) {
      ctx.fillStyle = sky[i];
      ctx.fillRect(0, (i * u * 62) / sky.length, g.W, g.H);
    }
    const stems = Math.ceil(g.W / (u * 9));
    for (let i = 0; i < stems; i++) {
      const near = i % 3 === 0;
      const r = u * (near ? 2 + rand() * 0.8 : 0.9 + rand() * 0.6);
      const x = ((i + 0.2 + rand() * 0.6) / stems) * g.W;
      ctx.save();
      ctx.translate(x, u * 70);
      ctx.rotate(-Math.PI / 2 + (rand() - 0.5) * 0.04);
      paintCulm(ctx, 0, u * 74, r, AGED, near ? [u * 12, u * 34, u * 58] : [u * 22, u * 50]);
      ctx.restore();
    }
    paintCanopy(ctx, g, rand);
    paintMaple(ctx, g, rand);
  }

  function paintCanopy(ctx, g, rand) {
    const u = g.U;
    const tones = ['#5a7c58', '#6d8f60', '#82a26c', '#648658'];
    const count = Math.floor(g.W * 3.2);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, u * 0.7);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const clump = fbm(x * 0.03, 2, 3, 31);
      const y = -u * 2 + rand() * rand() * u * (16 + clump * 30);
      const a = 0.9 + rand() * 1.3;
      const len = u * (2 + rand() * 3);
      ctx.strokeStyle = tones[Math.floor(rand() * tones.length)];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }

  // An old maple bough leaning in from the top left, the one warm note up high.
  function paintMaple(ctx, g, rand) {
    const u = g.U;
    const tips = [[0.04, 9], [0.13, 14], [0.22, 7], [0.31, 15], [0.4, 8], [0.48, 13]];
    ctx.strokeStyle = '#6b5a4c';
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 1.8;
    ctx.beginPath();
    ctx.moveTo(-u * 2, u * 1);
    ctx.quadraticCurveTo(g.W * 0.25, u * 3, g.W * 0.52, u * 9);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, u * 0.6);
    for (const [f, y] of tips) {
      ctx.beginPath();
      ctx.moveTo(f * g.W - u * 5, u * (1 + f * 12));
      ctx.quadraticCurveTo(f * g.W, u * (y - 2), f * g.W + u * 4, u * y);
      ctx.stroke();
    }
    for (const [f, y] of tips) {
      speckle(ctx, f * g.W + u * 3, u * y, u * 11, u * 6, 46, rand, LEAVES, u * 1.5);
      speckle(ctx, f * g.W + u * 5, u * (y + 1), u * 7, u * 4, 16, rand, LEAVES, u * 1.1);
    }
  }

  function paintHedges(ctx, g, rand) {
    const u = g.U;
    const spots = [0.03, 0.17, 0.3, 0.46, 0.63, 0.79, 0.95];
    for (const f of spots) {
      const x = f * g.W;
      const y = u * (56 + rand() * 4);
      const rx = u * (13 + rand() * 7);
      const ry = u * (10 + rand() * 5);
      ctx.fillStyle = '#5f8260';
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
      ctx.fill();
      speckle(ctx, x - rx * 0.1, y - ry * 0.3, rx * 0.8, ry * 0.6, 120, rand, ['#769768', '#8cac6e', '#6a8c64'], u * 1.2);
    }
  }

  function speckle(ctx, x, y, rx, ry, count, rand, tones, size) {
    for (let i = 0; i < count; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      const s = size * (0.4 + rand() * 0.8);
      ctx.fillRect(x + Math.cos(a) * d * rx, y + Math.sin(a) * d * ry, s * 1.4, s);
    }
  }

  function rockPath(ctx, x, y, rx, ry, seed) {
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI + (i / 18) * Math.PI;
      const rad = 0.84 + fbm(i * 0.45, seed, 2, 3) * 0.34;
      const px = x + Math.cos(a) * rx * rad;
      const py = y + Math.sin(a) * ry * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.quadraticCurveTo(x, y + ry * 0.14, x - rx * 0.92, y);
    ctx.closePath();
  }

  function paintRock(ctx, g, rand, x, y, rx, ry, seed, mossy) {
    const u = g.U;
    ctx.fillStyle = 'rgba(46,66,50,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.05, y, rx * 1.12, u * 2.6, 0, 0, 6.3);
    ctx.fill();
    ctx.save();
    rockPath(ctx, x, y, rx, ry, seed);
    ctx.fillStyle = STONE.dark;
    ctx.fill();
    ctx.clip();
    rockPath(ctx, x - rx * 0.1, y - ry * 0.12, rx * 0.86, ry * 0.86, seed + 1);
    ctx.fillStyle = STONE.mid;
    ctx.fill();
    rockPath(ctx, x - rx * 0.2, y - ry * 0.36, rx * 0.6, ry * 0.56, seed + 2);
    ctx.fillStyle = STONE.light;
    ctx.fill();
    ctx.fillStyle = STONE.wet;
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(x - rx * 0.6 + rand() * rx * 0.9, y - ry * (0.5 + rand() * 0.45), u * (1 + rand() * 3.2), Math.max(1, u * 0.45));
    }
    if (mossy) speckle(ctx, x + rx * 0.2, y - ry * 0.72, rx * 0.7, ry * 0.32, Math.floor(40 + rx), rand, MOSS, u * 1.2);
    ctx.restore();
    speckle(ctx, x, y, rx * 1.1, u * 2, Math.floor(30 + rx), rand, MOSS, u * 1.4);
  }

  function paintBasin(ctx, g, rand, geo) {
    const u = g.U;
    const { cx, cy, rx, ry } = geo;
    const ox = rx + u * 6.5;
    const oy = ry + u * 4.2;
    ctx.fillStyle = '#737b78';
    ctx.beginPath();
    ctx.ellipse(cx, cy, ox, oy, 0, 0, Math.PI);
    ctx.lineTo(cx - ox * 1.05, g.H + 2);
    ctx.lineTo(cx + ox * 1.05, g.H + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - ox * 1.03, cy, ox * 2.06, g.H - cy + 2);
    ctx.fillStyle = '#5c6464';
    for (let i = 0; i < 70; i++) ctx.fillRect(cx - ox + rand() * ox * 2, cy + oy * 0.3 + rand() * (g.H - cy), u * (0.5 + rand()), u * (1 + rand() * 3));
    ctx.fillStyle = '#a3aca5';
    ctx.beginPath();
    ctx.ellipse(cx, cy, ox, oy, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#c4cbc2';
    ctx.beginPath();
    ctx.ellipse(cx, cy, ox * 0.98, oy * 0.94, 0, 0.3, 2.6);
    ctx.ellipse(cx, cy, rx * 1.03, ry * 1.03, 0, 2.6, 0.3, true);
    ctx.fill();
    ctx.fillStyle = '#48545a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.02, ry * 1.04, 0, 0, 6.3);
    ctx.fill();
    speckle(ctx, cx - ox * 0.82, cy + oy * 0.5, ox * 0.24, oy * 0.5, 60, rand, MOSS, u * 1.3);
    speckle(ctx, cx + ox * 0.7, cy - oy * 0.4, ox * 0.2, oy * 0.4, 40, rand, MOSS, u * 1.2);
    paintWater(ctx, g, geo);
  }

  function paintWater(ctx, g, geo) {
    const { cx, cy, rx, ry } = geo;
    const bands = ['#a3bcbc', '#8cabaf', '#7a9ba3', '#688a95', '#587a88'];
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + g.U * 0.9, rx, ry, 0, 0, 6.3);
    ctx.clip();
    for (let i = 0; i < bands.length; i++) {
      ctx.fillStyle = bands[i];
      ctx.fillRect(cx - rx, cy - ry + (i * (ry * 2 + g.U)) / bands.length, rx * 2, g.H);
    }
    ctx.restore();
  }

  function paintGarden(g, rand, geo) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintGrove(ctx, g, rand);
    paintHedges(ctx, g, rand);
    paintGround(ctx, g, rand);
    paintRock(ctx, g, rand, g.W * 0.92, u * 72, u * 20, u * 15, 7, true);
    paintRock(ctx, g, rand, g.W * 0.06, u * 82, u * 17, u * 19, 9, true);
    state.strike = strikePoint(geo);
    paintSpoutPost(ctx, g, geo);
    paintRock(ctx, g, rand, state.strike.x - u, u * 91, u * 19, (u * 91 - state.strike.y) / 0.94, 4, true);
    paintStrikeMark(ctx, g);
    paintFarPost(ctx, g, geo);
    paintBasin(ctx, g, rand, geo);
    return c;
  }

  // The pale worn spot where the tube has been landing for years.
  function paintStrikeMark(ctx, g) {
    const u = g.U;
    const hit = state.strike;
    ctx.fillStyle = STONE.wet;
    ctx.beginPath();
    ctx.ellipse(hit.x, hit.y + u * 0.6, u * 5, u * 1.3, 0, 0, 6.3);
    ctx.fill();
  }

  function strikePoint(geo) {
    const cos = Math.cos(ANGLE.rest);
    const sin = Math.sin(ANGLE.rest);
    return {
      x: geo.px - geo.rear * cos - geo.r * sin,
      y: geo.py - geo.rear * sin + geo.r * cos,
    };
  }

  function uprightPost(ctx, x, top, bottom, r, tones, nodes) {
    ctx.save();
    ctx.translate(x, bottom);
    ctx.rotate(-Math.PI / 2);
    paintCulm(ctx, 0, bottom - top, r, tones, nodes);
    ctx.restore();
  }

  function paintFarPost(ctx, g, geo) {
    const u = g.U;
    uprightPost(ctx, geo.px + u * 4, geo.py - u * 9, u * 84, u * 2.7, POST, [u * 20]);
  }

  function paintSpoutPost(ctx, g, geo) {
    const u = g.U;
    uprightPost(ctx, geo.spoutX + u * 36, geo.spoutY - u * 10, u * 74, u * 2.6, POST, [u * 22, u * 44]);
  }

  function paintFront(g, rand, geo) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const { px, py, spoutX, spoutY } = geo;
    uprightPost(ctx, px - u * 2, py - u * 10, u * 90, u * 3.2, POST, [u * 16, u * 38]);
    ctx.fillStyle = '#d8d09a';
    ctx.beginPath();
    ctx.arc(px - u * 2, py, u * 1.8, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#6a6436';
    ctx.beginPath();
    ctx.arc(px - u * 2, py, u * 0.9, 0, 6.3);
    ctx.fill();
    speckle(ctx, px, u * 90, u * 12, u * 3, 50, rand, MOSS, u * 1.2);
    const holdX = spoutX + u * 36;
    ctx.save();
    ctx.translate(spoutX, spoutY);
    ctx.rotate(-0.16);
    paintCulm(ctx, 0, u * 44, u * 2.3, FRESH, [u * 14, u * 38]);
    ctx.fillStyle = '#2b3120';
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 0.9, u * 2.3, 0, 0, 6.3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2f2c20';
    ctx.fillRect(holdX - u * 3, spoutY - u * 6.6, u * 6, u * 1.1);
    ctx.fillRect(holdX - u * 3, spoutY - u * 5, u * 6, u * 1.1);
    return c;
  }

  function paintTube(g, rand, geo) {
    const S = 2;
    const pad = g.U;
    const { front, rear, r, cut } = geo;
    const c = layer((front + rear + pad * 2) * S, (r + pad) * 2 * S);
    const ctx = c.getContext('2d');
    ctx.scale(S, S);
    ctx.translate(rear + pad, r + pad);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-rear, -r);
    ctx.lineTo(front - cut, -r);
    ctx.lineTo(front, r);
    ctx.lineTo(-rear, r);
    ctx.closePath();
    ctx.clip();
    paintCulm(ctx, -rear, front, r, FRESH, [-rear * 0.55, front * 0.22, front * 0.62]);
    ctx.fillStyle = '#5c6a2e';
    for (let i = 0; i < 40; i++) ctx.fillRect(-rear + rand() * (rear + front), -r + rand() * r * 2, g.U * (0.5 + rand() * 2.5), Math.max(0.5, g.U * 0.18));
    ctx.restore();
    paintMouth(ctx, geo);
    ctx.fillStyle = '#c9c88a';
    ctx.beginPath();
    ctx.ellipse(-rear, 0, r * 0.26, r, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#7f7f42';
    ctx.beginPath();
    ctx.ellipse(-rear, 0, r * 0.15, r * 0.74, 0, 0, 6.3);
    ctx.fill();
    state.tubeW = c.width / S;
    state.tubeH = c.height / S;
    state.tubeOX = rear + pad;
    state.tubeOY = r + pad;
    return c;
  }

  function paintMouth(ctx, geo) {
    const m = mouth(geo);
    ctx.save();
    ctx.translate(m.x, 0);
    ctx.rotate(m.tilt);
    ctx.fillStyle = '#e4e1a8';
    ctx.beginPath();
    ctx.ellipse(0, 0, m.long, m.short, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#39402a';
    ctx.beginPath();
    ctx.ellipse(0, 0, m.long * 0.86, m.short * 0.72, 0, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function mouth(geo) {
    const { front, r, cut } = geo;
    return {
      x: front - cut / 2,
      tilt: Math.atan2(2 * r, cut),
      long: Math.hypot(cut, 2 * r) / 2,
      short: r * 0.5,
    };
  }

  function paintFrond(size, tones, droop) {
    const c = layer(size * 1.25, size * 1.05);
    const ctx = c.getContext('2d');
    const bx = size * 0.08;
    const by = size;
    const steps = 22;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const x = bx + f * size * 1.02;
      const y = by - Math.sin(f * 1.5) * size * 0.72 + f * f * f * size * droop;
      const dir = -1.0 + f * 1.7;
      const len = size * 0.27 * Math.pow(Math.sin(Math.min(1, f * 1.08) * 2.9 + 0.12), 0.8);
      ctx.fillStyle = tones[i % tones.length];
      for (const side of [-1, 1]) {
        const a = dir + side * 1.05;
        const ex = x + Math.cos(a) * len;
        const ey = y + Math.sin(a) * len;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo((x + ex) / 2 + side * len * 0.08, (y + ey) / 2 - len * 0.16, ex, ey);
        ctx.quadraticCurveTo((x + ex) / 2 - side * len * 0.08, (y + ey) / 2 + len * 0.16, x, y);
        ctx.fill();
      }
    }
    ctx.strokeStyle = '#3c5230';
    ctx.lineWidth = Math.max(1, size * 0.012);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + size * 0.4, by - size * 0.6, bx + size * 1.02, by - size * 0.72 + size * droop);
    ctx.stroke();
    return { canvas: c, bx, by };
  }

  function makeFerns(g, rand) {
    const u = g.U;
    const big = paintFrond(u * 28, ['#8cae52', '#a4c264', '#78994c'], 0.34);
    const small = paintFrond(u * 18, ['#94b45a', '#adc86c', '#7f9f52'], 0.3);
    const list = [];
    const plant = (x, y, sprite, angles, flip) => {
      for (const a of angles) list.push({ x, y, sprite, a, flip, phase: rand() * 6.28, rate: 0.4 + rand() * 0.3 });
    };
    plant(g.W * 0.5 - u * 70, u * 102, big, [-0.75, -0.3, 0.1, 0.45], 1);
    plant(g.W * 0.5 - u * 70, u * 102, big, [-0.5, 0.0], -1);
    plant(g.W * 0.98, u * 96, small, [-0.8, -0.35, 0.05], -1);
    plant(g.W * 0.5 - u * 24, u * 101, small, [-0.5, -0.05, 0.3], -1);
    return list;
  }

  function drawFerns(ctx, t) {
    for (const f of state.ferns) {
      const sway = Math.sin(t * f.rate + f.phase) * 0.03;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.flip, 1);
      ctx.rotate(f.a + sway);
      ctx.drawImage(f.sprite.canvas, -f.sprite.bx, -f.sprite.by);
      ctx.restore();
    }
  }

  // Water streaks for the basin, one seamless tile baked at half size.
  function paintSheen(g) {
    const w = Math.ceil(g.W * 0.5);
    const h = Math.ceil(g.U * 12);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x * (24 / w), y * (10 / h), 3, 77);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 236;
        img.data[i + 2] = 232;
        img.data[i + 3] = Math.round(smoothstep(0.53, 0.66, v) * 3) / 3 * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.35);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x * (9 / w), y * (5 / h), 3, 41);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = 222;
        img.data[i + 2] = 212;
        img.data[i + 3] = Math.round(smoothstep(0.42, 0.68, v) * band * 4) / 4 * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeDrops() {
    return {
      x: new Float32Array(MAX_DROPS),
      y: new Float32Array(MAX_DROPS),
      vx: new Float32Array(MAX_DROPS),
      vy: new Float32Array(MAX_DROPS),
      life: new Float32Array(MAX_DROPS),
      ring: new Uint8Array(MAX_DROPS),
      next: 0,
    };
  }

  function makeRings() {
    return {
      x: new Float32Array(MAX_RINGS),
      y: new Float32Array(MAX_RINGS),
      age: new Float32Array(MAX_RINGS).fill(99),
      size: new Float32Array(MAX_RINGS),
      next: 0,
    };
  }

  function makeLeaves(g, rand, geo) {
    const spots = [[-0.58, 0.05], [-0.2, 0.5], [0.42, -0.25], [0.68, 0.32]];
    return spots.map((s, i) => ({
      hx: geo.cx + s[0] * geo.rx,
      hy: geo.cy + g.U + s[1] * geo.ry,
      kx: 0,
      ky: 0,
      phase: rand() * 6.28,
      turn: rand() * 3,
      colour: LEAVES[i % LEAVES.length],
    }));
  }

  function addRing(x, y, size) {
    const r = state.rings;
    const i = r.next;
    r.x[i] = x;
    r.y[i] = y;
    r.age[i] = 0;
    r.size[i] = size;
    r.next = (i + 1) % MAX_RINGS;
  }

  function addDrop(x, y, vx, vy, life, ring) {
    const d = state.drops;
    const i = d.next;
    d.x[i] = x;
    d.y[i] = y;
    d.vx[i] = vx;
    d.vy[i] = vy;
    d.life[i] = life;
    d.ring[i] = ring;
    d.next = (i + 1) % MAX_DROPS;
  }

  function easeIn(x) {
    return x * x;
  }

  // Sets the tube's angle, how full it is and how hard it is pouring, from the clock.
  function pose(c) {
    if (c < CYCLE.sag) {
      const f = c / CYCLE.sag;
      state.angle = lerp(ANGLE.rest, ANGLE.sag, easeIn(f));
      state.level = f;
      state.pour = 0;
    } else if (c < CYCLE.tip) {
      const f = (c - CYCLE.sag) / (CYCLE.tip - CYCLE.sag);
      state.angle = lerp(ANGLE.sag, ANGLE.down, easeIn(f));
      state.level = 1;
      state.pour = f > 0.5 ? (f - 0.5) * 2 : 0;
    } else if (c < CYCLE.spill) {
      const f = (c - CYCLE.tip) / (CYCLE.spill - CYCLE.tip);
      state.angle = ANGLE.down + Math.sin(f * 9) * Math.exp(-f * 5) * 0.03;
      state.level = 1 - f;
      state.pour = 1 - smoothstep(0.45, 1, f);
    } else if (c < CYCLE.fall) {
      const f = (c - CYCLE.spill) / (CYCLE.fall - CYCLE.spill);
      state.angle = lerp(ANGLE.down, ANGLE.rest, easeIn(f));
      state.level = 0;
      state.pour = 0;
    } else {
      const f = c - CYCLE.fall;
      state.angle = ANGLE.rest + Math.abs(Math.sin(f * 11)) * Math.exp(-f * 5) * 0.05;
      state.level = 0;
      state.pour = 0;
    }
  }

  function lipPoint(geo) {
    const cos = Math.cos(state.angle);
    const sin = Math.sin(state.angle);
    state.lipX = geo.px + geo.front * cos - geo.r * 0.7 * sin;
    state.lipY = geo.py + geo.front * sin + geo.r * 0.7 * cos;
  }

  function onStrike(g, geo) {
    const u = g.U;
    const hit = state.strike;
    for (let i = 0; i < 8; i++) {
      addDrop(hit.x + (i - 4) * u, hit.y, (i - 3.5) * u * 3.5, -u * (16 + (i % 3) * 7), 0.7, 0);
    }
    lipPoint(geo);
    for (let i = 0; i < 4; i++) addDrop(state.lipX - i * u, state.lipY, u * (2 - i), -u * (3 + i * 3), 1.5, 1);
  }

  function updateClock(dt, flow, g, geo) {
    const before = state.clock;
    state.clock = (before + dt * flow) % CYCLE.end;
    const c = state.clock;
    pose(c);
    lipPoint(geo);
    if (before < CYCLE.fall && c >= CYCLE.fall) onStrike(g, geo);
    if (state.pour > 0.05) {
      state.pulse -= dt;
      if (state.pulse <= 0) {
        state.pulse = 0.34;
        pourRing(g, geo);
      }
    } else if (c < CYCLE.sag) {
      state.drip -= dt * flow;
      if (state.drip <= 0) {
        state.drip = 1.5;
        addDrop(state.lipX, state.lipY, 0, 0, 2, 1);
      }
    }
  }

  function pourRing(g, geo) {
    const u = g.U;
    const x = state.lipX + u * 5;
    const y = geo.cy + u * 0.6;
    addRing(x, y, 1);
    for (const leaf of state.leaves) {
      const dx = leaf.hx - x;
      const dy = (leaf.hy - y) * 2.5;
      const d = Math.hypot(dx, dy) + u;
      leaf.kx += (dx / d) * u * 2.2;
      leaf.ky += (dy / d) * u * 0.7;
    }
    for (let i = 0; i < 6; i++) {
      addDrop(x + (i - 2.5) * u, y, (i - 2.5) * u * 4, -u * (10 + (i % 3) * 9), 0.7, 0);
    }
  }

  function updateDrops(dt, g, geo) {
    const d = state.drops;
    const gravity = g.U * 95;
    for (let i = 0; i < MAX_DROPS; i++) {
      if (d.life[i] <= 0) continue;
      d.life[i] -= dt;
      d.vy[i] += gravity * dt;
      d.x[i] += d.vx[i] * dt;
      d.y[i] += d.vy[i] * dt;
      if (d.ring[i] && d.y[i] >= geo.cy + g.U) {
        addRing(d.x[i], geo.cy + g.U, 0.42);
        d.life[i] = 0;
      }
    }
  }

  function drawDrops(ctx, g) {
    const d = state.drops;
    const s = Math.max(1, g.U * 0.7);
    ctx.fillStyle = '#f0f6f2';
    for (let i = 0; i < MAX_DROPS; i++) {
      if (d.life[i] > 0) ctx.fillRect(d.x[i] - s / 2, d.y[i] - s / 2, s, s * 1.4);
    }
  }

  function drawRings(ctx, g, geo, dt) {
    const r = state.rings;
    const reach = geo.rx * 0.95;
    for (let i = 0; i < MAX_RINGS; i++) {
      r.age[i] += dt;
      const f = r.age[i] / (r.size[i] > 0.6 ? 3 : 2.1);
      if (f >= 1) continue;
      const rad = (0.05 + f * 0.95) * reach * r.size[i];
      const fade = (1 - f) * (1 - f);
      ctx.lineWidth = Math.max(1, g.U * 0.75);
      ctx.strokeStyle = '#2f5362';
      ctx.globalAlpha = fade * 0.6;
      ctx.beginPath();
      ctx.ellipse(r.x[i], r.y[i], rad * 0.92, rad * 0.92 * 0.3, 0, 0, 6.3);
      ctx.stroke();
      ctx.strokeStyle = '#eef6f2';
      ctx.globalAlpha = fade * 0.95;
      ctx.beginPath();
      ctx.ellipse(r.x[i], r.y[i], rad, rad * 0.3, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t, dt) {
    const u = g.U;
    for (const l of state.leaves) {
      l.kx -= l.kx * dt * 0.5;
      l.ky -= l.ky * dt * 0.5;
      const x = l.hx + l.kx + Math.sin(t * 0.13 + l.phase) * u * 2.2;
      const y = l.hy + l.ky + Math.cos(t * 0.17 + l.phase) * u * 0.6;
      ctx.fillStyle = '#3a5866';
      ctx.beginPath();
      ctx.ellipse(x + u * 0.3, y + u * 0.6, u * 2.2, u * 0.8, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = l.colour;
      ctx.beginPath();
      ctx.ellipse(x, y, u * 2.2, u * 1, l.turn + t * 0.04, 0, 6.3);
      ctx.fill();
    }
  }

  // A few maple leaves let go of the bough and drift down behind the bamboo.
  function drawFalling(ctx, g, t) {
    const u = g.U;
    for (let i = 0; i < FALLING; i++) {
      const life = (t * 0.045 + i / FALLING) % 1;
      const x = g.W * (0.1 + 0.13 * i) + life * u * 14 + Math.sin(t * 0.7 + i * 2) * u * 3;
      const y = u * lerp(12, 76, life);
      ctx.globalAlpha = smoothstep(0, 0.08, life) * (1 - smoothstep(0.88, 1, life));
      ctx.fillStyle = LEAVES[i % LEAVES.length];
      ctx.beginPath();
      ctx.ellipse(x, y, u * 1.3, u * 0.7, t * 0.9 + i, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWater(ctx, g, geo, t, dt) {
    const { cx, cy, rx, ry } = geo;
    const u = g.U;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + u * 0.9, rx, ry, 0, 0, 6.3);
    ctx.clip();
    const sw = state.sheen.width * 2;
    const sh = state.sheen.height * 2;
    const off = ((t * u * 1.2) % sw);
    for (let x = cx - rx - off; x < cx + rx; x += sw) ctx.drawImage(state.sheen, x, cy - ry, sw, sh);
    drawReflection(ctx, geo);
    drawRings(ctx, g, geo, dt);
    drawLeaves(ctx, g, t, dt);
    ctx.restore();
  }

  function drawReflection(ctx, geo) {
    const surface = geo.cy - geo.ry * 0.7;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.translate(0, surface);
    ctx.scale(1, -0.32);
    ctx.translate(0, -surface);
    drawTubeSprite(ctx, geo);
    ctx.restore();
  }

  function drawTubeSprite(ctx, geo) {
    ctx.save();
    ctx.translate(geo.px, geo.py);
    ctx.rotate(state.angle);
    ctx.drawImage(state.tube, -state.tubeOX, -state.tubeOY, state.tubeW, state.tubeH);
    ctx.restore();
  }

  function drawTube(ctx, geo) {
    drawTubeSprite(ctx, geo);
    if (state.level <= 0.02) return;
    const m = state.mouth;
    ctx.save();
    ctx.translate(geo.px, geo.py);
    ctx.rotate(state.angle);
    ctx.translate(m.x, 0);
    ctx.rotate(m.tilt);
    ctx.fillStyle = '#cfe2e2';
    ctx.beginPath();
    ctx.ellipse(0, 0, m.long * 0.78 * state.level, m.short * 0.56 * state.level, 0, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function drawTrickle(ctx, g, geo, t, flow) {
    const u = g.U;
    const x = geo.spoutX;
    const y0 = geo.spoutY + u * 1.4;
    const dx = x - geo.px;
    const slope = Math.tan(state.angle);
    const lift = state.angle > 0 ? geo.r / Math.cos(state.angle) : u;
    const y1 = geo.py + slope * dx - lift;
    ctx.strokeStyle = '#e6f1ee';
    ctx.lineWidth = Math.max(1, u * lerp(0.7, 1.4, Math.min(1, flow / 2)));
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + Math.sin(t * 3) * u * 0.2, y1);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    const s = Math.max(1, u * 1.1);
    for (let i = 0; i < 5; i++) {
      const f = (t * 1.6 + i / 5) % 1;
      ctx.fillRect(x - s / 2, lerp(y0, y1, f * f), s, s * 1.6);
    }
    state.splash -= 1;
    if (state.splash <= 0) {
      state.splash = 7;
      addDrop(x, y1, (Math.sin(t * 7) * u * 7), -u * 10, 0.3, 0);
    }
  }

  function drawPour(ctx, g, geo) {
    if (state.pour <= 0.02) return;
    const u = g.U;
    const land = geo.cy + u * 0.8;
    const fall = land - state.lipY;
    const reach = u * 5;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = state.pour * (pass ? 1 : 0.6);
      ctx.lineWidth = Math.max(1, u * (pass ? 1.2 : 3.4) * (0.4 + state.pour * 0.6));
      ctx.strokeStyle = pass ? '#ffffff' : '#c6dcdc';
      ctx.beginPath();
      ctx.moveTo(state.lipX, state.lipY);
      ctx.quadraticCurveTo(state.lipX + reach * 0.9, state.lipY + fall * 0.2, state.lipX + reach, land);
      ctx.stroke();
    }
    ctx.globalAlpha = state.pour * 0.75;
    ctx.fillStyle = '#f2f7f4';
    ctx.beginPath();
    ctx.ellipse(state.lipX + reach, land, u * 5, u * 1.3, 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const sw = state.mist.width * 2;
    const sh = state.mist.height * 2;
    const off = (t * g.U * 0.9) % sw;
    ctx.globalAlpha = Math.min(1, amount);
    for (let x = -off; x < g.W; x += sw) ctx.drawImage(state.mist, x, g.U * 8, sw, sh);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const geo = geometry(g);
    state.g = g;
    state.geo = geo;
    state.garden = paintGarden(g, rand, geo);
    state.tube = paintTube(g, rand, geo);
    state.mouth = mouth(geo);
    state.front = paintFront(g, rand, geo);
    state.sheen = paintSheen(g);
    state.mist = paintMist(g);
    state.ferns = makeFerns(g, rand);
    state.drops = makeDrops();
    state.rings = makeRings();
    state.leaves = makeLeaves(g, rand, geo);
    state.clock = 6;
    state.pulse = 0;
    state.drip = 0.4;
    state.splash = 0;
    pose(state.clock);
    addRing(geo.cx - geo.rx * 0.1, geo.cy + g.U, 0.7);
  }

  function draw(ctx, t, dt, api) {
    const { g, geo } = state;
    const flow = api.props.flow;
    updateClock(dt, flow, g, geo);
    updateDrops(dt, g, geo);
    ctx.drawImage(state.garden, 0, 0);
    drawMist(ctx, g, t, api.props.mist);
    drawFalling(ctx, g, t);
    drawWater(ctx, g, geo, t, dt);
    drawPour(ctx, g, geo);
    drawTube(ctx, geo);
    drawTrickle(ctx, g, geo, t, flow);
    ctx.drawImage(state.front, 0, 0);
    drawDrops(ctx, g);
    drawFerns(ctx, t);
  }

  Kasuri.run({
    defaults: { flow: 1, mist: 0.6, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
