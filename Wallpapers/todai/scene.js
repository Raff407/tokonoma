/*
 * 灯台 Todai — a white lighthouse on a rock headland at night, above a rolling sea.
 *
 * Sky, rock and tower are baked once. The sea is a stack of tiling swell strips
 * that slide and bob, and the beam is one baked cone sprite turned by a transform.
 * Clouds catch it through one masked overlay; on the water a short list of glints lights up.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, lerp, smoothstep } = K;

  const HORIZON = 0.56;
  const PERIOD = 34;
  const STRIPS = 11;
  const FOAM_LINES = 3;
  const FOAM_LEVELS = 3;
  const SPRAY = 30;
  const TWINKLES = 18;
  const GLINTS = 260;
  const CONE_W = 160;
  const CONE_H = 80;
  const CONE_ALPHA = 0.46;
  const ROCK_CUT = 0.82;
  const TAU = Math.PI * 2;
  const ROCK_TONES = ['#2a3149', '#39415f', '#4a5376', '#5e698c', '#7581a3'];

  // Outlines as fractions of the canvas. Crest runs along the top, shore along the waterline.
  const HEAD_CREST = [
    [0.33, 0.742], [0.365, 0.715], [0.395, 0.705], [0.42, 0.668], [0.455, 0.655], [0.48, 0.612],
    [0.515, 0.6], [0.55, 0.566], [0.6, 0.55], [0.66, 0.542], [0.72, 0.546], [0.78, 0.538],
    [0.84, 0.55], [0.89, 0.526], [0.95, 0.506], [1.01, 0.49],
  ];
  const HEAD_SHORE = [
    [0.33, 0.742], [0.38, 0.775], [0.44, 0.79], [0.5, 0.835], [0.56, 0.85], [0.63, 0.885],
    [0.7, 0.895], [0.78, 0.925], [0.87, 0.93], [0.95, 0.955], [1.01, 0.955],
  ];
  const STACK_CREST = [[0.195, 0.74], [0.203, 0.7], [0.218, 0.668], [0.232, 0.658], [0.244, 0.69], [0.265, 0.704], [0.285, 0.722], [0.3, 0.745]];
  const STACK_SHORE = [[0.195, 0.735], [0.245, 0.752], [0.3, 0.74]];
  const NEAR_CREST = [[-0.01, 0.885], [0.03, 0.865], [0.07, 0.885], [0.105, 0.92], [0.145, 0.94], [0.185, 0.985], [0.2, 1.01]];
  const NEAR_SHORE = [[-0.01, 1.01], [0.2, 1.01]];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function fract(v) {
    return v - Math.floor(v);
  }

  // Walks an outline in short steps, roughening it with noise so rock never looks ruled.
  function roughen(g, points, amp, seed) {
    const xs = [];
    const ys = [];
    const step = Math.max(1, g.U * 2);
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const dist = Math.hypot((bx - ax) * g.W, (by - ay) * g.H);
      const n = Math.max(1, Math.round(dist / step));
      for (let k = 0; k < n; k++) {
        const f = k / n;
        const x = lerp(ax, bx, f) * g.W;
        xs.push(x);
        ys.push(lerp(ay, by, f) * g.H + (fbm(x * 0.09 / g.U, 3, 3, seed) - 0.5) * amp * g.U);
      }
    }
    const last = points[points.length - 1];
    xs.push(last[0] * g.W);
    ys.push(last[1] * g.H);
    return { xs, ys };
  }

  function crestAt(g, xf) {
    for (let i = 0; i < HEAD_CREST.length - 1; i++) {
      const [ax, ay] = HEAD_CREST[i];
      const [bx, by] = HEAD_CREST[i + 1];
      if (xf >= ax && xf <= bx) return lerp(ay, by, (xf - ax) / (bx - ax)) * g.H;
    }
    return g.H * 0.55;
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * HORIZON;
    const sky = ctx.createLinearGradient(0, 0, 0, top);
    sky.addColorStop(0, '#2a3668');
    sky.addColorStop(0.55, '#3f5085');
    sky.addColorStop(1, '#8a98bc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    paintStars(ctx, g, rand, top);
    ctx.fillStyle = '#4c5a88';
    ctx.beginPath();
    ctx.moveTo(0, top + 1);
    for (let x = 0; x <= g.W * 0.36; x += 2) {
      const fade = 1 - smoothstep(g.W * 0.2, g.W * 0.36, x);
      ctx.lineTo(x, top - fade * g.U * (2 + fbm(x * 0.05 / g.U, 2, 3, 8) * 8));
    }
    ctx.lineTo(g.W * 0.36, top + 1);
    ctx.fill();
    ctx.fillStyle = '#3d5484';
    ctx.fillRect(0, top, g.W, g.H - top);
    return c;
  }

  function paintStars(ctx, g, rand, top) {
    const tones = ['#e9e4d0', '#a9b5da', '#d9c99c', '#c8cfe4'];
    const count = Math.round((g.W * top) / 58);
    for (let i = 0; i < count; i++) {
      const y = Math.pow(rand(), 1.5) * top * 0.86;
      const x = rand() * g.W;
      const big = rand() < 0.05;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.globalAlpha = 0.45 + rand() * 0.55;
      ctx.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }

  // A low bank of cloud: a noise height field with billowed tops and flat tones by depth.
  // Returns a dim copy and a pale one that catches the beam.
  function paintClouds(g) {
    const w = Math.ceil((g.W * 1.5) / 2);
    const h = Math.ceil((g.H * 0.38) / 2);
    const dim = layer(w, h);
    const lit = layer(w, h);
    const dctx = dim.getContext('2d');
    const lctx = lit.getContext('2d');
    const sc = 200 / g.H;
    const density = (x, y) => fbm(x * sc * 0.03, y * sc * 0.07, 4, 31) + (fbm(x * sc * 0.012, 3, 2, 37) - 0.5) * 0.5;
    const tones = ['#6a789f', '#8290b3', '#9ca9c6', '#b9c3d8'];
    const lits = [0.35, 0.48, 0.62, 0.78];
    lctx.fillStyle = '#f3e7c2';
    for (let y = 0; y < h; y++) {
      const f = y / h;
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const raw = 0.98 - v * 1.05;
        const depth = f - (raw < 0.22 ? 0.22 - (0.22 - raw) * 0.4 : raw);
        const floor = 0.62 + (v - 0.5) * 0.3;
        if (depth < 0 || f > floor) continue;
        const level = depth < 0.05 ? 3 : depth < 0.13 ? 2 : depth < 0.24 ? 1 : 0;
        dctx.fillStyle = tones[level];
        dctx.globalAlpha = f > floor - 0.05 ? 0.45 : 0.9;
        dctx.fillRect(x, y, 1, 1);
        lctx.globalAlpha = lits[level];
        lctx.fillRect(x, y, 1, 1);
      }
    }
    return { dim, lit, w: w * 2, h: h * 2 };
  }

  function waveAt(x, tw, s) {
    const roll = 0.5 + 0.5 * Math.sin((2 * Math.PI * s.c1 * x) / tw + s.p1);
    const chop = 1 - Math.abs(Math.sin((Math.PI * s.c2 * x) / tw + s.p2));
    const small = Math.sin((2 * Math.PI * s.c3 * x) / tw + s.p3);
    return Math.pow(roll, 1.4) * 0.82 + chop * 0.14 + small * 0.04;
  }

  function seaTone(far, near, f) {
    return K.toHex(K.mixColor(K.parseColor(far), K.parseColor(near), Math.sqrt(f)));
  }

  function paintStrip(g, rand, s, tw) {
    // Two spare columns repeat the start, so sliding copies overlap and leave no seam.
    const c = layer(tw + 2, s.h);
    const ctx = c.getContext('2d');
    const f = s.f;
    const body = seaTone('#5a6d99', '#37528c', f);
    const lee = seaTone('#51638d', '#2f467a', f);
    const face = seaTone('#6c7fa8', '#4e6fa8', f);
    const crest = seaTone('#8b9bbd', '#8ba7cc', f);
    const hi = Math.max(1, s.amp * 0.34);
    for (let x = 0; x < tw + 2; x++) {
      const w = waveAt(x, tw, s);
      const top = s.amp * 1.2 * (1 - w);
      ctx.fillStyle = body;
      ctx.fillRect(x, top, 1, s.h - top);
      ctx.fillStyle = waveAt(x + 1, tw, s) > w ? face : lee;
      ctx.fillRect(x, top, 1, hi * 3);
      if (w > 0.3) {
        ctx.fillStyle = crest;
        ctx.fillRect(x, top, 1, hi * (0.3 + w * 0.7));
      }
      if (w > 0.78 && f > 0.25 && noise2((x % tw) * 0.22, s.i * 3.1, 7) > 0.42) {
        ctx.fillStyle = '#e8eae4';
        ctx.fillRect(x, top - 1, 1, Math.max(1, hi * 0.8));
      }
    }
    paintRipples(ctx, g, rand, s, tw, face);
    return c;
  }

  function paintRipples(ctx, g, rand, s, tw, tone) {
    ctx.fillStyle = tone;
    const count = Math.round(tw * 0.05 * (0.5 + s.f));
    for (let i = 0; i < count; i++) {
      const y = s.amp * 1.4 + rand() * (s.h - s.amp * 1.4);
      const len = g.U * (1 + rand() * (2 + s.f * 7));
      ctx.fillRect(rand() * (tw - len), y, len, 1);
    }
  }

  function makeStrips(g, rand) {
    const top = g.H * HORIZON;
    const span = g.H - top;
    const tw = Math.ceil(g.W * 1.5);
    const list = [];
    for (let i = 0; i < STRIPS; i++) {
      const f = i / (STRIPS - 1);
      const y = top + span * Math.pow(f, 1.55) * 0.97;
      const amp = g.U * (0.5 + f * f * 3.3);
      const below = top + span * Math.pow(Math.min(1, f + 1 / (STRIPS - 1)), 1.55) * 0.97;
      const s = {
        f, i, y, amp, tw,
        h: Math.ceil(i === STRIPS - 1 ? g.H - y + amp * 3 + g.U * 4 : below - y + amp * 3.2 + g.U * 2),
        c1: Math.round(lerp(26, 3.5, Math.sqrt(f)) * (g.W / g.H)),
        c2: Math.round(lerp(44, 11, Math.sqrt(f)) * (g.W / g.H)),
        c3: Math.round(lerp(60, 17, f) * (g.W / g.H)),
        p1: rand() * 3,
        p2: rand() * 3,
        p3: rand() * 6,
        drift: g.U * (0.14 + f * 0.75) * (i % 2 ? 1 : -0.7),
      };
      s.canvas = paintStrip(g, rand, s, tw);
      list.push(s);
    }
    return list;
  }

  function drawStrip(ctx, g, s, t, swell) {
    const offset = fract((t * s.drift * (0.4 + swell * 0.6)) / s.tw) * s.tw;
    const y = s.y - s.amp * 1.2 + Math.sin(t * 0.55 - s.i * 0.75) * s.amp * 0.8 * swell;
    ctx.drawImage(s.canvas, offset - s.tw, y);
    if (offset < g.W) ctx.drawImage(s.canvas, offset, y);
  }

  // Pale dashes on the water. They only show where a beam comes down on them.
  // They slide on a loop wider than the view, so the wrap always happens out of view.
  function makeGlints(g, rand) {
    const top = g.H * HORIZON;
    const margin = Math.ceil(g.W * 0.3);
    const list = { w: Math.ceil(g.W) + margin * 2, margin, n: GLINTS };
    list.x = new Float32Array(GLINTS);
    list.y = new Float32Array(GLINTS);
    list.len = new Float32Array(GLINTS);
    list.tall = new Float32Array(GLINTS);
    for (let i = 0; i < GLINTS; i++) {
      const f = Math.pow(rand(), 1.3);
      list.x[i] = rand() * list.w;
      list.y[i] = top + f * (g.H - top);
      list.len[i] = g.U * (0.8 + f * 5 * rand());
      list.tall[i] = Math.max(1, f * g.U * 0.8);
    }
    return list;
  }

  function outlinePath(ctx, crest, shore) {
    ctx.beginPath();
    ctx.moveTo(crest.xs[0], crest.ys[0]);
    for (let i = 1; i < crest.xs.length; i++) ctx.lineTo(crest.xs[i], crest.ys[i]);
    ctx.lineTo(shore.xs[shore.xs.length - 1], shore.ys[shore.ys.length - 1]);
    for (let i = shore.xs.length - 2; i >= 0; i--) ctx.lineTo(shore.xs[i], shore.ys[i]);
    ctx.closePath();
  }

  // Long slanted strata that follow the fall of the coast, lighter near the crown.
  function paintShards(ctx, g, rand, box) {
    const count = Math.min(620, Math.round((box.w * box.h) / (g.U * g.U * 2.4)));
    const u = g.U;
    for (let i = 0; i < count; i++) {
      const x = box.x - u * 6 + rand() * (box.w + u * 6);
      const y = box.y + rand() * box.h;
      const depth = (y - box.y) / box.h;
      const len = u * (4 + rand() * 11);
      const tall = u * (0.8 + rand() * 2.2);
      const pick = (1 - depth) * 2.4 + rand() * 2.2 - 0.2;
      ctx.fillStyle = ROCK_TONES[Math.max(0, Math.min(ROCK_TONES.length - 1, Math.floor(pick)))];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + len * 0.24);
      ctx.lineTo(x + len - tall * 0.5, y + len * 0.24 + tall);
      ctx.lineTo(x - tall * 0.7, y + tall * 0.9);
      ctx.fill();
    }
    paintLedges(ctx, g, rand, box, Math.round(count * 0.3));
  }

  // Stepped ledges: a thin pale lip with a dark wedge of shadow under it.
  function paintLedges(ctx, g, rand, box, count) {
    const u = g.U;
    for (let i = 0; i < count; i++) {
      const x = box.x + rand() * box.w;
      const y = box.y + rand() * box.h;
      const len = u * (3 + rand() * 8);
      const fall = len * (0.12 + rand() * 0.2);
      const drop = u * (1 + rand() * 2.4);
      ctx.fillStyle = ROCK_TONES[0];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + fall);
      ctx.lineTo(x + len * 0.7, y + fall + drop);
      ctx.lineTo(x + len * 0.1, y + drop * 0.7);
      ctx.fill();
      ctx.fillStyle = rand() < 0.6 ? ROCK_TONES[3] : ROCK_TONES[4];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + fall);
      ctx.lineTo(x + len, y + fall - Math.max(1, u * 0.7));
      ctx.lineTo(x, y - Math.max(1, u * 0.7));
      ctx.fill();
    }
  }

  function paintRock(ctx, g, rand, crest, shore, grass) {
    const xs = crest.xs.concat(shore.xs);
    const ys = crest.ys.concat(shore.ys);
    const box = { x: Math.min(...xs), y: Math.min(...ys) };
    box.w = Math.max(...xs) - box.x;
    box.h = Math.max(...ys) - box.y;
    ctx.save();
    outlinePath(ctx, crest, shore);
    ctx.fillStyle = ROCK_TONES[1];
    ctx.fill();
    ctx.clip();
    paintShards(ctx, g, rand, box);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ROCK_TONES[0];
    ctx.lineWidth = g.U * 2.6;
    ctx.beginPath();
    shore.xs.forEach((x, i) => ctx.lineTo(x, shore.ys[i]));
    ctx.stroke();
    if (grass) paintGrass(ctx, g, rand, crest);
    ctx.restore();
    ctx.strokeStyle = '#8590ae';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    crest.xs.forEach((x, i) => ctx.lineTo(x, crest.ys[i]));
    ctx.stroke();
  }

  function paintGrass(ctx, g, rand, crest) {
    ctx.strokeStyle = '#4a6452';
    ctx.lineWidth = g.U * 4;
    ctx.beginPath();
    crest.xs.forEach((x, i) => ctx.lineTo(x, crest.ys[i] + g.U * 0.6));
    ctx.stroke();
    for (let i = 0; i < crest.xs.length; i++) {
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = rand() < 0.5 ? '#6b8568' : '#3c5245';
        ctx.fillRect(crest.xs[i] + rand() * g.U * 2, crest.ys[i] + rand() * g.U * 3.4, Math.max(1, g.U * 0.9), Math.max(1, g.U * 0.4));
      }
    }
  }

  function paintShaft(ctx, g, x, baseY, topY) {
    const u = g.U;
    const tones = ['#b9bac2', '#ece8dc', '#f6f2e6', '#e0ddd4', '#b2b4c0', '#858ca6'];
    const lowHalf = u * 7;
    const topHalf = u * 4.2;
    for (let j = 0; j < tones.length; j++) {
      const a = (j / tones.length) * 2 - 1;
      const b = ((j + 1) / tones.length) * 2 - 1;
      ctx.fillStyle = tones[j];
      ctx.beginPath();
      ctx.moveTo(x + a * lowHalf, baseY);
      ctx.lineTo(x + b * lowHalf + 0.5, baseY);
      ctx.lineTo(x + b * topHalf + 0.5, topY);
      ctx.lineTo(x + a * topHalf, topY);
      ctx.fill();
    }
    ctx.fillStyle = '#7e8498';
    ctx.fillRect(x - lowHalf - u * 1.6, baseY - u * 2, (lowHalf + u * 1.6) * 2, u * 3);
    ctx.fillStyle = '#28324f';
    ctx.fillRect(x - u * 1.7, baseY - u * 6.5, u * 3.4, u * 5);
    ctx.beginPath();
    ctx.arc(x, baseY - u * 6.5, u * 1.7, Math.PI, 0);
    ctx.fill();
    for (const f of [0.34, 0.6, 0.84]) {
      ctx.fillStyle = f === 0.6 ? '#d9a95a' : '#2e3958';
      ctx.fillRect(x - u * 0.75, lerp(baseY, topY, f), u * 1.5, u * 2.6);
    }
  }

  function paintLantern(ctx, g, x, topY) {
    const u = g.U;
    ctx.fillStyle = '#2a2e42';
    ctx.fillRect(x - u * 6.4, topY - u * 1.3, u * 12.8, u * 1.6);
    ctx.fillRect(x - u * 6.2, topY - u * 3.6, u * 12.4, Math.max(1, u * 0.5));
    for (let i = 0; i <= 6; i++) ctx.fillRect(x - u * 6.2 + (i * u * 12.4) / 6 - 0.25, topY - u * 3.6, Math.max(1, u * 0.4), u * 2.5);
    ctx.fillStyle = '#f3dc9a';
    ctx.fillRect(x - u * 3.5, topY - u * 9, u * 7, u * 7.8);
    ctx.fillStyle = '#3a3c4e';
    for (let i = 0; i <= 3; i++) ctx.fillRect(x - u * 3.5 + (i * u * 7) / 3 - u * 0.25, topY - u * 9, Math.max(1, u * 0.5), u * 7.8);
    ctx.fillStyle = '#8f3f2e';
    ctx.beginPath();
    ctx.moveTo(x - u * 4.4, topY - u * 9);
    ctx.quadraticCurveTo(x, topY - u * 14.6, x + u * 4.4, topY - u * 9);
    ctx.fill();
    ctx.fillStyle = '#2a2e42';
    ctx.fillRect(x - u * 0.35, topY - u * 15, Math.max(1, u * 0.7), u * 3);
  }

  function paintHouse(ctx, g, x, ground) {
    const u = g.U;
    ctx.fillStyle = '#b5b5b8';
    ctx.fillRect(x - u * 8, ground - u * 5.5, u * 16, u * 6.5);
    ctx.fillStyle = '#8c8f9f';
    ctx.fillRect(x + u * 3, ground - u * 5.5, u * 5, u * 6.5);
    ctx.fillStyle = '#d9a95a';
    ctx.fillRect(x - u * 4.5, ground - u * 3.8, u * 2.6, u * 2.4);
    ctx.fillStyle = '#2c3550';
    ctx.fillRect(x + u * 0.5, ground - u * 3.8, u * 2, u * 4.6);
    ctx.fillStyle = '#39415f';
    ctx.beginPath();
    ctx.moveTo(x - u * 10, ground - u * 5.2);
    ctx.lineTo(x - u * 6, ground - u * 10);
    ctx.lineTo(x + u * 6, ground - u * 10);
    ctx.lineTo(x + u * 10, ground - u * 5.2);
    ctx.fill();
  }

  // A wind-bent pine: a leaning trunk, then flat pads built from many small marks.
  function paintPine(ctx, g, rand, x, ground) {
    const u = g.U;
    ctx.strokeStyle = '#232a36';
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, ground + u);
    ctx.bezierCurveTo(x + u * 2.5, ground - u * 7, x - u * 2, ground - u * 12, x - u * 7, ground - u * 17);
    ctx.stroke();
    ctx.lineWidth = u * 0.8;
    const pads = [[-12, -19, 8, 2.4], [-5, -21, 7, 2.2], [-3, -14, 7, 2], [-10, -13, 5, 1.7], [2, -9, 5, 1.6]];
    for (const [dx, dy] of pads) {
      ctx.beginPath();
      ctx.moveTo(x + u * (dx * 0.6), ground + u * (dy * 0.75));
      ctx.lineTo(x + u * dx, ground + u * dy);
      ctx.stroke();
    }
    for (const [dx, dy, rx, ry] of pads) {
      for (let i = 0; i < 46; i++) {
        const a = rand() * 6.283;
        const d = Math.sqrt(rand());
        ctx.fillStyle = Math.sin(a) < -0.1 && rand() < 0.6 ? '#4d6a58' : rand() < 0.5 ? '#2c3f38' : '#3a5147';
        ctx.fillRect(x + u * (dx + Math.cos(a) * d * rx), ground + u * (dy + Math.sin(a) * d * ry), Math.max(1, u * 1.2), Math.max(1, u * 0.6));
      }
    }
  }

  function paintHeadland(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const crest = roughen(g, HEAD_CREST, 2.2, 5);
    const shore = roughen(g, HEAD_SHORE, 1.6, 9);
    const stackCrest = roughen(g, STACK_CREST, 1.2, 12);
    const stackShore = roughen(g, STACK_SHORE, 0.5, 13);
    paintRock(ctx, g, rand, stackCrest, stackShore, false);
    paintRock(ctx, g, rand, crest, shore, true);
    const lamp = state.lamp;
    paintPine(ctx, g, rand, g.W * 0.915, crestAt(g, 0.915));
    paintHouse(ctx, g, g.W * 0.79, crestAt(g, 0.79) + g.U);
    paintShaft(ctx, g, lamp.x, state.towerBase, state.towerTop);
    paintLantern(ctx, g, lamp.x, state.towerTop);
    return { canvas: c, shores: [makeFoam(g, shore, rand), makeFoam(g, stackShore, rand)] };
  }

  function paintNearRock(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const crest = roughen(g, NEAR_CREST, 2, 17);
    paintRock(ctx, g, rand, crest, roughen(g, NEAR_SHORE, 0, 18), false);
    return { canvas: c, foam: makeFoam(g, crest, rand) };
  }

  function makeFoam(g, line, rand) {
    // Every other outline point is plenty for a foam line, and halves the strokes.
    const xs = Float32Array.from(line.xs.filter((v, i) => i % 2 === 0));
    const ys = Float32Array.from(line.ys.filter((v, i) => i % 2 === 0));
    const n = xs.length;
    const jit = new Float32Array(n);
    const gate = new Float32Array(n * FOAM_LINES);
    const rate = 0.05 + rand() * 0.012;
    for (let i = 0; i < n; i++) {
      jit[i] = noise2(i * 0.22, 2.5, 41) * 0.55;
      for (let k = 0; k < FOAM_LINES; k++) gate[i * FOAM_LINES + k] = smoothstep(0.3, 0.52, noise2(i * 0.5, k * 7.3, 43));
    }
    return { n, xs, ys, jit, gate, rate, off: new Float32Array(n), bucket: new Uint8Array(n) };
  }

  // One line of foam at three strengths, so a whole shore costs nine strokes.
  function foamLine(ctx, g, foam, t, k, reach) {
    const { n, xs, ys, off, bucket } = foam;
    for (let i = 0; i < n; i++) {
      const life = fract(t * foam.rate + k / FOAM_LINES + foam.jit[i]);
      off[i] = reach * (1 - life) * (1 - life) + g.U * 0.4;
      bucket[i] = Math.round(Math.sin(life * Math.PI) * foam.gate[i * FOAM_LINES + k] * FOAM_LEVELS);
    }
    for (let level = 1; level <= FOAM_LEVELS; level++) {
      ctx.globalAlpha = (level / FOAM_LEVELS) * 0.92;
      ctx.beginPath();
      for (let i = 0; i < n - 1; i++) {
        if (bucket[i] !== level) continue;
        ctx.moveTo(xs[i], ys[i] + off[i]);
        ctx.lineTo(xs[i + 1], ys[i + 1] + off[i + 1]);
      }
      ctx.stroke();
    }
  }

  function drawFoam(ctx, g, foam, t, swell) {
    const reach = g.U * (1.5 + 3.5 * swell);
    ctx.strokeStyle = '#f0f1ea';
    for (let k = 0; k < FOAM_LINES; k++) {
      ctx.lineWidth = Math.max(1, g.U * (k === 0 ? 0.9 : 0.6));
      foamLine(ctx, g, foam, t, k, reach);
    }
    ctx.globalAlpha = 1;
  }

  function makeSpray(rand) {
    const list = [];
    for (let i = 0; i < SPRAY; i++) {
      list.push({ along: rand(), phase: rand(), rate: 0.09 + rand() * 0.06, rise: 3 + rand() * 7, lean: (rand() - 0.5) * 4 });
    }
    return list;
  }

  function drawSpray(ctx, g, foam, t, swell) {
    ctx.fillStyle = '#f3f3ec';
    for (const p of state.spray) {
      const life = fract(t * p.rate + p.phase);
      const i = Math.floor(p.along * (foam.n - 1));
      const arc = 4 * life * (1 - life);
      ctx.globalAlpha = Math.sin(life * Math.PI) * 0.85;
      const size = Math.max(1, g.U * 0.6);
      ctx.fillRect(foam.xs[i] + p.lean * life * g.U, foam.ys[i] - arc * p.rise * g.U * swell, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function paintCone() {
    const c = layer(CONE_W, CONE_H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(CONE_W, CONE_H);
    for (let y = 0; y < CONE_H; y++) {
      const v = Math.abs((y + 0.5) / (CONE_H / 2) - 1);
      for (let x = 0; x < CONE_W; x++) {
        const u = x / CONE_W;
        const spread = 0.05 + u * 0.95;
        const across = 1 - smoothstep(spread * 0.25, spread, v);
        const along = Math.pow(1 - u, 0.62);
        const i = (y * CONE_W + x) * 4;
        img.data[i] = 244;
        img.data[i + 1] = 232;
        img.data[i + 2] = 196;
        img.data[i + 3] = across * along * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow(size, colour, peak) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, g, b] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},${peak})`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},${peak * 0.35})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  // Where each of the two opposed beams points this instant. Front means towards the viewer.
  function aimBeams(g, t) {
    const a = 1.7 + (t * TAU) / PERIOD;
    const lamp = state.lamp;
    for (let i = 0; i < 2; i++) {
      const b = state.beams[i];
      const th = fract((a + i * Math.PI) / TAU) * TAU;
      b.front = Math.sin(th);
      if (b.front > 0) aimFront(g, b, th / Math.PI);
      else aimBack(g, b, th);
      b.len = Math.max(g.U * 22, Math.hypot(b.ex - lamp.x, b.ey - lamp.y));
      b.angle = Math.atan2(b.ey - lamp.y, b.ex - lamp.x);
    }
  }

  // Behind the tower the beam stays in the sky, swinging left to right. It fades as it
  // comes round to the right, where it would turn towards the viewer over the land.
  function aimBack(g, b, th) {
    const s = Math.sin(th);
    const c = Math.cos(th);
    b.ex = state.lamp.x + c * g.W * 0.8;
    b.ey = g.H * (0.3 + s * 0.33 + s * s * 0.17);
    b.width = g.U * 30;
    b.show = 1 - smoothstep(0.35, 0.9, c);
    b.pool = 0;
  }

  // In front, u runs 0..1 from pointing right to pointing left. The landing point only
  // travels over open sea: the foreground water under the headland, out past the stack,
  // then up to the left horizon, where it meets the back half of the turn. While the beam
  // faces the viewer the cone stays hidden and the lantern flares instead.
  function aimFront(g, b, u) {
    b.ex = g.W * (0.46 - 0.6 * u);
    b.ey = g.H * (0.92 - 0.24 * u - 0.38 * smoothstep(0.8, 1, u));
    b.width = g.U * (30 + 10 * b.front);
    b.show = smoothstep(0.45, 0.75, u);
    b.pool = smoothstep(0, 0.12, u);
  }

  function frontBeam() {
    return state.beams[0].front > 0 ? state.beams[0] : state.beams[1];
  }

  function placeCone(c, lamp, b) {
    c.save();
    c.translate(lamp.x, lamp.y);
    c.rotate(b.angle);
    c.scale((b.len * 1.1) / CONE_W, b.width / CONE_H);
    c.drawImage(state.cone, 0, -CONE_H / 2);
    c.restore();
  }

  function drawClouds(ctx, g, t) {
    const cl = state.clouds;
    const backW = cl.w * 0.8;
    const backX = -fract((t * g.U * 0.32) / backW) * backW;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(cl.dim, backX, g.H * 0.3, backW, cl.h * 0.8);
    if (backX + backW < g.W) ctx.drawImage(cl.dim, backX + backW - 1, g.H * 0.3, backW, cl.h * 0.8);
    ctx.globalAlpha = 1;
    state.cloudX = -fract((t * g.U * 0.6) / cl.w) * cl.w;
    ctx.drawImage(cl.dim, state.cloudX, g.H * 0.2, cl.w, cl.h);
    if (state.cloudX + cl.w < g.W) ctx.drawImage(cl.dim, state.cloudX + cl.w - 1, g.H * 0.2, cl.w, cl.h);
  }

  // The bright cloud copy, cut to the shape of both cones through the scratch canvas.
  function drawLitClouds(ctx, g, amount) {
    const s = state.skyMask.getContext('2d');
    const cl = state.clouds;
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, g.W, g.H);
    for (const b of state.beams) {
      s.globalAlpha = b.show;
      placeCone(s, state.lamp, b);
    }
    s.globalAlpha = 1;
    s.globalCompositeOperation = 'source-in';
    s.drawImage(cl.lit, state.cloudX, g.H * 0.2, cl.w, cl.h);
    if (state.cloudX + cl.w < g.W) s.drawImage(cl.lit, state.cloudX + cl.w - 1, g.H * 0.2, cl.w, cl.h);
    ctx.globalAlpha = Math.min(1, amount);
    ctx.drawImage(state.skyMask, 0, 0);
    ctx.globalAlpha = 1;
  }

  // Where the front beam comes down on the water: a soft wash, and the glints inside it
  // light up. Glint brightness falls to nothing at the rim of the pool.
  function paintPool(m, g, b, t, on) {
    const top = g.H * HORIZON;
    const scale = (b.ey - top) / (g.H - top);
    const rx = g.U * (26 + scale * 26);
    const ry = g.U * (7 + scale * 15);
    const glints = state.glints;
    const slide = fract((t * g.U * 0.5) / glints.w) * glints.w;
    m.globalAlpha = Math.min(1, on * 0.5);
    m.drawImage(state.pool, b.ex - rx, b.ey - ry, rx * 2, ry * 2);
    m.fillStyle = '#fbf0ca';
    for (let i = 0; i < glints.n; i++) {
      const x = ((glints.x[i] + slide) % glints.w) - glints.margin;
      const dx = (x - b.ex) / rx;
      const dy = (glints.y[i] - b.ey) / ry;
      const d = dx * dx + dy * dy;
      if (d >= 1) continue;
      m.globalAlpha = Math.min(1, on * 1.1 * (1 - d) * (1 - d));
      m.fillRect(x, glints.y[i], glints.len[i], glints.tall[i]);
    }
    m.globalAlpha = 1;
  }

  // The pool goes through the scratch canvas with the headland cut out of it, so it is
  // drawn over every wave strip yet never lands on rock.
  function drawWaterLight(ctx, g, t, amount) {
    const b = frontBeam();
    const top = g.H * HORIZON;
    const on = smoothstep(top, top + g.U * 6, b.ey) * b.pool * amount;
    if (on <= 0.01) return;
    const m = state.lightCtx;
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, g.W, g.H);
    paintPool(m, g, b, t, on);
    m.globalCompositeOperation = 'destination-out';
    m.drawImage(state.head.canvas, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(state.light, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBackCone(ctx, amount) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.beams) {
      if (b.front > 0 || b.show <= 0) continue;
      ctx.globalAlpha = Math.min(1, amount * CONE_ALPHA * b.show);
      placeCone(ctx, state.lamp, b);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // The front cone lies over the whole picture, but rock, tower, house and pine are mostly
  // cut out of it, so it lights the air over the sea and only grazes the stone.
  function drawFrontCone(ctx, g, amount) {
    const b = frontBeam();
    const alpha = Math.min(1, amount * CONE_ALPHA * b.show);
    if (alpha <= 0.01) return;
    const m = state.lightCtx;
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, g.W, g.H);
    placeCone(m, state.lamp, b);
    m.globalCompositeOperation = 'destination-out';
    m.globalAlpha = ROCK_CUT;
    m.drawImage(state.head.canvas, 0, 0);
    m.drawImage(state.near.canvas, 0, 0);
    m.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(state.light, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // The lantern swells while a beam faces the viewer, which is when the front cone is hidden.
  function drawLamp(ctx, g, amount) {
    const lamp = state.lamp;
    const near = Math.max(0, frontBeam().front);
    const r = g.U * 15;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, (0.4 + 0.4 * near * near) * Math.max(0.5, amount));
    ctx.drawImage(state.glow, lamp.x - r, lamp.y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff7dc';
    ctx.fillRect(lamp.x - g.U * 1.6, lamp.y - g.U * 2.2, g.U * 3.2, g.U * 4.4);
  }

  function makeTwinkles(g, rand) {
    const list = [];
    for (let i = 0; i < TWINKLES; i++) {
      list.push({ x: rand() * g.W, y: rand() * rand() * g.H * 0.42, phase: rand() * 6.28, rate: 0.25 + rand() * 0.4 });
    }
    return list;
  }

  function drawTwinkles(ctx, t) {
    ctx.fillStyle = '#f2ecd8';
    for (const s of state.twinkles) {
      ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * s.rate + s.phase);
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.towerBase = crestAt(g, 0.66) + g.U * 1.2;
    state.towerTop = g.H * 0.2;
    state.lamp = { x: g.W * 0.66, y: state.towerTop - g.U * 5.1 };
    state.sky = paintSky(g, rand);
    state.clouds = paintClouds(g);
    state.strips = makeStrips(g, rand);
    state.glints = makeGlints(g, rand);
    state.head = paintHeadland(g, rand);
    state.near = paintNearRock(g, rand);
    state.spray = makeSpray(rand);
    state.twinkles = makeTwinkles(g, rand);
    state.cone = paintCone();
    state.glow = paintGlow(64, '#f6e2a8', 0.8);
    state.pool = paintGlow(64, '#d9c99e', 0.9);
    state.skyMask = layer(g.W, g.H * HORIZON);
    state.light = layer(g.W, g.H);
    state.lightCtx = state.light.getContext('2d');
    state.beams = [{}, {}];
    state.splitAt = g.H * 0.905;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const beam = api.props.beam;
    const swell = api.props.swell;
    aimBeams(g, t);
    ctx.drawImage(state.sky, 0, 0);
    drawTwinkles(ctx, t);
    drawClouds(ctx, g, t);
    if (beam > 0) drawLitClouds(ctx, g, beam);
    if (beam > 0) drawBackCone(ctx, beam);
    for (const s of state.strips) if (s.y < state.splitAt) drawStrip(ctx, g, s, t, swell);
    ctx.drawImage(state.head.canvas, 0, 0);
    for (const s of state.strips) if (s.y >= state.splitAt) drawStrip(ctx, g, s, t, swell);
    if (beam > 0) drawWaterLight(ctx, g, t, beam);
    for (const foam of state.head.shores) drawFoam(ctx, g, foam, t, swell);
    drawSpray(ctx, g, state.head.shores[0], t, swell);
    ctx.drawImage(state.near.canvas, 0, 0);
    drawFoam(ctx, g, state.near.foam, t, swell);
    if (beam > 0) drawFrontCone(ctx, g, beam);
    drawLamp(ctx, g, beam);
  }

  Kasuri.run({
    defaults: { beam: 1, swell: 1, ramp: 'lines', cell: 7, boost: 0.3, gain: 1.2, tint: 0.5, dither: 0.55 },
    maxFps: 20,
    setup,
    draw,
  });
})();
