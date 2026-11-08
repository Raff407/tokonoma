/*
 * 珊瑚 Sango — a coral garden in warm shallow water, blue fading behind it.
 *
 * The reef, sand and distance are baked once. Each frame only slides light
 * textures over them, shifts fan sprites strip by strip, strokes anemone
 * tentacles and draws the shoals as one small polygon per fish.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const ROSE = { shade: '#7c4340', body: '#bd6f5a', light: '#e2a78b', tip: '#f2dcbd' };
  const OCHRE = { shade: '#7a5f37', body: '#bf9953', light: '#dfc484', tip: '#f4e7be' };
  const MOSS = { shade: '#4d6243', body: '#7f9560', light: '#abba7f', tip: '#dde1b2' };
  const EMBER = { shade: '#752e25', body: '#c05a40', light: '#e08c6a', tip: '#efc3a0' };
  const HAZE = { shade: '#4f6684', body: '#73809c', light: '#919bae', tip: '#b4bbc2' };
  const PLUM = { shade: '#54405f', body: '#86597a', light: '#ab7f95', tip: '#d9bdb8' };
  const ROCK = ['#6d6c78', '#807d82', '#8a8580', '#6f7c6c'];
  const WATER = ['#b0e0d0', '#90d0c0', '#80c0c0', '#70b0c0', '#60a0c0', '#5090b0', '#4080b0', '#4070a0', '#3070a0'];
  const SAND = ['#80a0a0', '#a0b090', '#c0c090', '#d0c090', '#d0c090'];
  const SNAP = [
    ROSE.shade, ROSE.body, ROSE.light, ROSE.tip, OCHRE.shade, OCHRE.body, OCHRE.light,
    MOSS.shade, MOSS.body, MOSS.light, PLUM.shade, PLUM.body, PLUM.light,
    HAZE.shade, HAZE.body, HAZE.light, ROCK[0], ROCK[2], '#d6c596', '#b1a27d', EMBER.body, EMBER.light,
  ].map(K.parseColor);
  const STRIP_U = 1.5;
  const TENTACLE_U = 1.15;
  const RAY_SCALE = 0.22;
  const HERO_SEED = 7;
  const BRAIN_STRIPES = 16;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Bakes a layer down to the house tones: no soft edges, no stray colours.
  function snap(c, palette) {
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i + 3] = d[i + 3] < 110 ? 0 : 255;
      if (d[i + 3] === 0) continue;
      let best = palette[0];
      let bestDist = 1e9;
      for (const p of palette) {
        const dist = (d[i] - p[0]) ** 2 + (d[i + 1] - p[1]) ** 2 + (d[i + 2] - p[2]) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = p;
        }
      }
      d.set(best, i);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- the water and the blue distance

  function ridgeY(g, tier, x) {
    return g.H * (tier.base - tier.amp * (fbm((x / g.U) * 0.045, tier.seed, 4, tier.seed) - 0.5) * 2);
  }

  function fallTones(ctx, top, bottom, tones) {
    const fall = ctx.createLinearGradient(0, top, 0, bottom);
    tones.forEach((tone, i) => fall.addColorStop(i / (tones.length - 1), tone));
    return fall;
  }

  function paintWater(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = fallTones(ctx, 0, g.H * 0.95, WATER);
    ctx.fillRect(0, 0, g.W, g.H);
    paintFar(ctx, g, rand);
    return c;
  }

  function paintFar(ctx, g, rand) {
    const tiers = [
      { base: 0.62, amp: 0.13, seed: 3, colour: '#5090b0', scale: 0.5 },
      { base: 0.72, amp: 0.13, seed: 8, colour: '#4080b0', scale: 0.7 },
    ];
    for (const tier of tiers) {
      for (let x = rand() * g.U * 12; x < g.W; x += g.U * (16 + rand() * 22)) {
        const y = ridgeY(g, tier, x);
        const segs = [];
        grow(x, y + g.U * 2, -1.57, g.U * 9 * tier.scale * (0.8 + rand() * 0.7), g.U * 2 * tier.scale, 4, rand, segs);
        strokeSegs(ctx, segs, tier.colour, 0, 0, 1);
      }
      ctx.fillStyle = tier.colour;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridgeY(g, tier, x));
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
  }

  function paintSand(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = fallTones(ctx, g.H * 0.76, g.H, SAND);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.76 + 0.05 * fbm((x / g.U) * 0.014, 6, 3, 11)));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    for (let y = g.H * 0.78; y < g.H; y += g.U * (0.9 + ((y / g.H) - 0.78) * 7)) {
      const dash = (y / g.H - 0.7) * g.U * 34;
      for (let x = -rand() * dash; x < g.W; x += dash * (1 + rand())) {
        ctx.fillStyle = rand() < 0.5 ? '#ab9f7c' : '#ecdeb2';
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x, y + Math.sin(x * 0.2 / g.U) * g.U * 0.5, dash * (0.4 + rand() * 0.6), Math.max(1, g.U * 0.5));
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- branching coral: a list of segments, stroked in tone passes

  function grow(x, y, angle, len, width, depth, rand, out) {
    const a = lerp(angle, -1.57, 0.12) + (rand() - 0.5) * 0.25;
    const x1 = x + Math.cos(a) * len;
    const y1 = y + Math.sin(a) * len;
    out.push({ x0: x, y0: y, x1, y1, w: width, tip: depth === 0 });
    if (depth === 0) return;
    const forks = rand() < 0.25 ? 3 : 2;
    for (let i = 0; i < forks; i++) {
      const spread = (i - (forks - 1) / 2) * (0.62 + rand() * 0.4);
      grow(x1, y1, a + spread, len * (0.74 + rand() * 0.14), width * 0.8, depth - 1, rand, out);
    }
  }

  function strokeSegs(ctx, segs, colour, dx, dy, scale) {
    ctx.strokeStyle = colour;
    ctx.lineCap = 'round';
    for (const s of segs) {
      ctx.lineWidth = Math.max(1, s.w * scale);
      ctx.beginPath();
      ctx.moveTo(s.x0 + dx, s.y0 + dy);
      ctx.lineTo(s.x1 + dx, s.y1 + dy);
      ctx.stroke();
    }
  }

  function paintBranching(ctx, g, rand, x, y, opts) {
    const u = g.U;
    const segs = [];
    for (let i = 0; i < opts.trunks; i++) {
      const f = opts.trunks === 1 ? 0 : i / (opts.trunks - 1) - 0.5;
      const bx = x + f * opts.foot * u;
      grow(bx, y, -1.57 + f * opts.fan, u * opts.len, u * opts.width, opts.depth, rand, segs);
    }
    const tone = opts.tone;
    strokeSegs(ctx, segs, tone.shade, u * 0.55, u * 0.65, 1.1);
    strokeSegs(ctx, segs, tone.body, 0, 0, 1);
    strokeSegs(ctx, segs, tone.light, -u * 0.3, -u * 0.3, 0.42);
    ctx.fillStyle = tone.tip;
    for (const s of segs) {
      if (s.tip) ctx.fillRect(s.x1 - u * 0.6, s.y1 - u * 0.6, Math.max(1, u * 1.1), Math.max(1, u * 1.1));
    }
  }

  // ---- the other corals

  function roughEllipse(ctx, x, y, rx, ry, seed) {
    ctx.beginPath();
    for (let i = 0; i <= 44; i++) {
      const a = (i / 44) * 6.2832;
      const r = 0.86 + 0.28 * fbm(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6, 3, seed);
      ctx.lineTo(x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r);
    }
    ctx.closePath();
  }

  function paintPlate(ctx, g, rand, x, y, rx, tone) {
    const u = g.U;
    const ry = rx * 0.15;
    const seed = rand() * 50;
    ctx.fillStyle = tone.shade;
    roughEllipse(ctx, x, y + u * 1.3, rx * 0.98, ry * 1.1, seed);
    ctx.fill();
    for (let i = 0; i < rx * 2.4; i++) {
      const f = rand() * 2 - 1;
      ctx.fillRect(x + f * rx * 0.9, y + ry * 0.5, Math.max(1, u * 0.5), u * (1 + rand() * 2.2));
    }
    ctx.fillStyle = tone.body;
    roughEllipse(ctx, x, y, rx, ry, seed);
    ctx.fill();
    ctx.fillStyle = tone.light;
    roughEllipse(ctx, x - rx * 0.06, y - ry * 0.2, rx * 0.8, ry * 0.62, seed + 3);
    ctx.fill();
  }

  function paintTable(ctx, g, rand, x, y, rx, tone) {
    const u = g.U;
    ctx.strokeStyle = tone.shade;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const foot = (i - 1) * rx * 0.2;
      ctx.lineWidth = Math.max(1, u * 2.4);
      ctx.beginPath();
      ctx.moveTo(x + foot * 1.7, y + rx * 0.95);
      ctx.quadraticCurveTo(x + foot * 0.5, y + rx * 0.5, x + foot * 0.5, y + u);
      ctx.stroke();
    }
    paintPlate(ctx, g, rand, x + rx * 0.42, y + rx * 0.66, rx * 0.56, tone);
    paintPlate(ctx, g, rand, x, y, rx, tone);
  }

  // Dome mapped like a ball; the meanders are contour lines of noise on a slope.
  function paintBrain(g, rx, ry, tone, seed) {
    const w = Math.ceil(rx * 2.1);
    const h = Math.ceil(ry * 1.15);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tones = [tone.shade, tone.body, tone.light, tone.tip].map(K.parseColor);
    const dark = K.mixColor(tones[0], K.parseColor('#3a3648'), 0.35);
    const cx = w / 2;
    const cy = ry * 1.02;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 0.97) continue;
        const nz = Math.sqrt(1 - d);
        const u = nx / (nz + 0.55);
        const v = ny / (nz + 0.55);
        const n = fbm(u * 2.4 + seed, v * 2.4, 3, seed);
        const groove = Math.abs(Math.sin((n * 1.5 + u * 0.55 + v * 0.22) * BRAIN_STRIPES)) < 0.4;
        const lit = 0.36 - ny * 0.62 - nx * 0.18;
        const pick = groove ? (lit > 0.2 ? tones[0] : dark) : tones[lit > 0.72 ? 2 : lit > 0.1 ? 1 : 0];
        const i = (y * w + x) * 4;
        img.data.set(pick, i);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, x: cx, y: cy };
  }

  // ---- the great rock and everything that grows on it

  function paintRock(g, rand, c) {
    const u = g.U;
    const ctx = c.getContext('2d');
    const cx = state.heroX;
    const hw = u * 50;
    const base = g.H * 0.88;
    const profile = (x) => {
      const d = Math.min(1, Math.abs(x - cx) / hw);
      return base - u * 37 * Math.pow(1 - d * d, 0.7) * (0.66 + 0.68 * fbm((x / u) * 0.05, 2, 3, 41));
    };
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - hw, base);
    for (let x = cx - hw; x <= cx + hw; x += 1.5) ctx.lineTo(x, profile(x));
    ctx.lineTo(cx + hw, base);
    ctx.quadraticCurveTo(cx, base + u * 6, cx - hw, base);
    ctx.fillStyle = '#5a5a6e';
    ctx.fill();
    ctx.clip();
    const area = Math.round(hw * u * 34);
    for (let i = 0; i < area; i++) {
      const x = cx - hw + rand() * hw * 2;
      const y = profile(x) + rand() * u * 42;
      const n = fbm((x / u) * 0.09, (y / u) * 0.09, 3, 17);
      ctx.fillStyle = ROCK[Math.min(3, Math.floor(n * 4 + rand() * 0.9))];
      ctx.fillRect(x, y, Math.max(1, u * (0.5 + rand() * 1.6)), Math.max(1, u * (0.4 + rand() * 0.9)));
    }
    ctx.restore();
  }

  function paintReef(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const x = state.heroX;
    const y = g.H;
    paintBranching(ctx, g, rand, x - u * 27, y * 0.72, { tone: HAZE, trunks: 4, foot: 12, fan: 1.1, len: 9, width: 2.1, depth: 5 });
    paintBranching(ctx, g, rand, x + u * 22, y * 0.68, { tone: HAZE, trunks: 4, foot: 12, fan: 1.1, len: 10, width: 2.1, depth: 5 });
    paintRock(g, rand, c);
    paintBranching(ctx, g, K.rng(HERO_SEED), x - u * 2, y * 0.64, { tone: ROSE, trunks: 5, foot: 18, fan: 1.2, len: 10.5, width: 3.1, depth: 5 });
    paintTable(ctx, g, rand, x + u * 30, y * 0.6, u * 19, MOSS);
    paintTable(ctx, g, rand, x - u * 37, y * 0.68, u * 13, OCHRE);
    paintBranching(ctx, g, rand, x - u * 33, y * 0.8, { tone: PLUM, trunks: 3, foot: 8, fan: 1, len: 6, width: 1.9, depth: 4 });
    paintBranching(ctx, g, rand, x - u * 17, y * 0.79, { tone: OCHRE, trunks: 3, foot: 9, fan: 0.9, len: 5.5, width: 1.8, depth: 4 });
    return c;
  }

  function paintFront(g, rand, ctx) {
    const u = g.U;
    ctx.fillStyle = '#d6c596';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.H * (0.905 + 0.06 * fbm((x / u) * 0.02, 13, 3, 23)));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = '#b1a27d';
    for (let i = 0; i < g.W * 0.9; i++) {
      ctx.fillRect(rand() * g.W, g.H * (0.92 + rand() * 0.08), Math.max(1, u * (0.5 + rand() * 1.4)), Math.max(1, u * 0.45));
    }
    const big = paintBrain(g, u * 25, u * 20, OCHRE, 4);
    ctx.drawImage(big.canvas, g.W * 0.66 - big.x, g.H * 0.93 - big.y);
    const small = paintBrain(g, u * 12, u * 9.5, MOSS, 19);
    ctx.drawImage(small.canvas, g.W * 0.17 - small.x, g.H * 0.94 - small.y);
  }

  // ---- sea fans: a net baked once, then shifted a strip at a time

  function paintFanNet(ctx, cx, base, height, tone, rand, seed, u) {
    const spokes = 21;
    const reach = (f) => height * (1 - 0.22 * f * f) * (0.76 + 0.48 * fbm(f * 5 + seed, seed, 3, seed));
    const ends = [];
    for (let s = 0; s < spokes; s++) {
      const f = (s / (spokes - 1)) * 2 - 1;
      ctx.strokeStyle = s % 2 ? tone.body : tone.light;
      ctx.lineWidth = Math.max(1, u * 0.7);
      ends.push(spoke(ctx, cx, base, f, reach(f), u, rand));
    }
    paintFanLinks(ctx, ends, tone, rand, u);
  }

  // One rib from the foot, forking in two for its outer third.
  function spoke(ctx, cx, base, f, r, u, rand) {
    const point = (ff, d) => {
      const a = -1.57 + ff * 1.2;
      return [cx + Math.cos(a) * d * 0.85, base + Math.sin(a) * d];
    };
    const mid = point(f + (rand() - 0.5) * 0.04, r * 0.66);
    const oy = base - r * 0.3 * (1 - Math.abs(f));
    ctx.beginPath();
    ctx.moveTo(cx, oy);
    ctx.lineTo(mid[0], mid[1]);
    ctx.stroke();
    for (const side of [-1, 1]) {
      const end = point(f + side * 0.05, r * (0.92 + rand() * 0.1));
      ctx.beginPath();
      ctx.moveTo(mid[0], mid[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
    }
    return { x: cx, y: oy, mx: mid[0], my: mid[1] };
  }

  function paintFanLinks(ctx, ends, tone, rand, u) {
    ctx.lineWidth = Math.max(1, u * 0.45);
    for (let s = 0; s < ends.length - 1; s++) {
      const a = ends[s];
      const b = ends[s + 1];
      for (let k = 0; k < 6; k++) {
        const d = 0.3 + rand() * 1.05;
        const e = d + (rand() - 0.5) * 0.14;
        ctx.strokeStyle = d > 0.7 ? tone.light : tone.body;
        ctx.beginPath();
        ctx.moveTo(lerp(a.x, a.mx, d), lerp(a.y, a.my, d));
        ctx.lineTo(lerp(b.x, b.mx, e), lerp(b.y, b.my, e));
        ctx.stroke();
      }
    }
  }

  function makeFan(g, rand, x, y, heightU, tone, seed) {
    const u = g.U;
    const height = heightU * u;
    const w = height * 1.75;
    const h = height * 1.12;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    paintFanNet(ctx, w / 2, h - u, height, tone, rand, seed, u);
    ctx.strokeStyle = tone.shade;
    ctx.lineWidth = Math.max(1, u * 2);
    ctx.beginPath();
    ctx.moveTo(w / 2, h);
    ctx.lineTo(w / 2, h - height * 0.3);
    ctx.stroke();
    return {
      sprite: snap(c, SNAP),
      x: Math.round(x - c.width / 2),
      y: Math.round(y - c.height),
      strip: Math.max(1, Math.round(STRIP_U * u)),
      sway: heightU * 0.09,
      phase: rand() * 6.28,
    };
  }

  function drawFan(ctx, g, f, t, amount) {
    const sprite = f.sprite;
    const h = sprite.height;
    for (let sy = 0; sy < h; sy += f.strip) {
      const up = 1 - (sy + f.strip / 2) / h;
      const swing = Math.sin(t * 0.55 + f.phase - up * 1.7) + 0.4 * Math.sin(t * 1.27 + f.phase * 2 - up * 3.2);
      const off = amount * g.U * f.sway * up * Math.sqrt(up) * swing;
      const sh = Math.min(f.strip, h - sy);
      ctx.drawImage(sprite, 0, sy, sprite.width, sh, f.x + off, f.y + sy, sprite.width, sh);
    }
  }

  // ---- anemones

  function makeAnemone(g, rand, x, y, spreadU, lenU, count, ink) {
    const u = g.U;
    const a = {
      count, ink, x, y,
      bx: new Float32Array(count), by: new Float32Array(count),
      dx: new Float32Array(count), dy: new Float32Array(count),
      bend: new Float32Array(count), ph: new Float32Array(count),
    };
    for (let i = 0; i < count; i++) {
      const f = (i / (count - 1)) * 2 - 1 + (rand() - 0.5) * 0.08;
      const inner = rand();
      const ang = -1.57 + f * 1.45;
      const len = u * lenU * (0.6 + rand() * 0.5);
      a.bx[i] = x + f * u * spreadU * lerp(0.35, 0.8, inner);
      a.by[i] = y - u * lenU * 0.42 * (1 - f * f * 0.75) * inner - u * 2;
      a.dx[i] = Math.cos(ang) * len;
      a.dy[i] = Math.sin(ang) * len * (0.7 + inner * 0.4);
      a.bend[i] = (rand() < 0.5 ? -1 : 1) * len * (0.14 + rand() * 0.2);
      a.ph[i] = f * 2.2 + rand() * 1.4;
    }
    return a;
  }

  function tentacles(ctx, a, g, t, amount, start, tips) {
    const u = g.U;
    const size = Math.max(1, u * 1.2);
    ctx.beginPath();
    for (let i = start; i < a.count; i += 2) {
      const sw = amount * u * 2.4 * (Math.sin(t * 0.8 + a.ph[i]) + 0.5 * Math.sin(t * 1.9 + a.ph[i] * 2));
      const ex = a.bx[i] + a.dx[i] + sw;
      const ey = a.by[i] + a.dy[i] + Math.abs(sw) * 0.25;
      if (tips) {
        ctx.rect(ex - size / 2, ey - size / 2, size, size);
      } else {
        ctx.moveTo(a.bx[i], a.by[i]);
        ctx.quadraticCurveTo(a.bx[i] + a.dx[i] * 0.5 + a.bend[i] - sw * 0.2, a.by[i] + a.dy[i] * 0.55, ex, ey);
      }
    }
  }

  function drawAnemone(ctx, g, a, t, amount) {
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * TENTACLE_U);
    ctx.strokeStyle = a.ink.back;
    tentacles(ctx, a, g, t, amount, 0, false);
    ctx.stroke();
    ctx.strokeStyle = a.ink.front;
    tentacles(ctx, a, g, t, amount, 1, false);
    ctx.stroke();
    ctx.fillStyle = a.ink.tip;
    tentacles(ctx, a, g, t, amount, 1, true);
    ctx.fill();
  }

  // ---- shoals: a formation turned about an upright axis, each fish a beat late

  function makeShoal(g, rand, opts) {
    const u = g.U;
    const max = opts.count * 2;
    const s = {
      ...opts,
      a: new Float32Array(max), b: new Float32Array(max), c: new Float32Array(max),
      lag: new Float32Array(max), ph: new Float32Array(max), tone: new Uint8Array(max),
      cx: g.W * opts.fx, cy: g.H * opts.fy,
      rx: opts.rx * u, ry: opts.ry * u, rz: opts.rz * u, len: opts.len * u,
    };
    for (let i = 0; i < max; i++) {
      const r = Math.pow(rand(), 0.5);
      const ang = rand() * 6.2832;
      const elev = rand() * 2 - 1;
      const flat = Math.sqrt(1 - elev * elev);
      s.a[i] = Math.cos(ang) * flat * r * s.rx;
      s.c[i] = Math.sin(ang) * flat * r * s.rz;
      s.b[i] = elev * r * s.ry;
      s.lag[i] = (1 - (s.a[i] / s.rx + 1) / 2) * 2.6 + rand() * 0.8;
      s.ph[i] = rand() * 6.28;
      s.tone[i] = Math.floor(rand() * opts.tones.length);
    }
    return s;
  }

  function fishPath(ctx, x, y, len, fx, wag) {
    const nose = len * 0.5 * fx;
    const belly = len * 0.2;
    ctx.moveTo(x + nose, y);
    ctx.lineTo(x + nose * 0.2, y - belly);
    ctx.lineTo(x - nose * 0.6, y - belly * 0.25);
    ctx.lineTo(x - nose * 1.05, y - belly * 0.95 + wag);
    ctx.lineTo(x - nose * 0.85, y + wag * 0.5);
    ctx.lineTo(x - nose * 1.05, y + belly * 0.95 + wag);
    ctx.lineTo(x - nose * 0.6, y + belly * 0.25);
    ctx.lineTo(x + nose * 0.2, y + belly);
    ctx.closePath();
  }

  function shoalFish(ctx, g, s, i, t, cx, cy) {
    const phase = (t - s.lag[i]) / s.period + s.start;
    const turn = Math.floor(phase);
    const f = phase - turn;
    const heading = (turn + smoothstep(0.55, 1, f)) * Math.PI;
    const co = Math.cos(heading);
    const si = Math.sin(heading);
    const ph = s.ph[i];
    const wander = Math.sin(t * 0.37 + ph) * g.U;
    const x = cx + (s.a[i] + wander) * co - s.c[i] * si;
    const depth = s.a[i] * si + s.c[i] * co;
    const y = cy + s.b[i] + depth * 0.2 + Math.sin(t * 0.61 + ph * 2) * g.U * 0.7;
    const len = s.len * (1 + (depth / s.rz) * 0.2);
    const fx = Math.abs(co) < 0.3 ? (co < 0 ? -0.3 : 0.3) : co;
    fishPath(ctx, x, y, len, fx, Math.sin(t * 6 + ph) * len * 0.09);
  }

  function drawShoal(ctx, g, s, t, density) {
    const count = Math.round(s.count * density);
    const cx = s.cx + Math.sin(t * 0.05 + s.start) * g.U * 7;
    const cy = s.cy + Math.sin(t * 0.083 + s.start * 2) * g.U * 3;
    for (let k = 0; k < s.tones.length; k++) {
      ctx.fillStyle = s.tones[k];
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        if (s.tone[i] === k) shoalFish(ctx, g, s, i, t, cx, cy);
      }
      ctx.fill();
    }
  }

  // ---- a few larger fish on slow patrol, baked and turned by narrowing them

  function paintBigFish(g, len, deep, ink) {
    const c = layer(len * 1.2, len * deep * 2.1);
    const ctx = c.getContext('2d');
    const cx = c.width * 0.55;
    const cy = c.height / 2;
    const h = len * deep;
    ctx.fillStyle = ink.fin;
    ctx.beginPath();
    ctx.moveTo(cx + len * 0.14, cy - h * 0.62);
    ctx.quadraticCurveTo(cx - len * 0.2, cy - h * 1.2, cx - len * 0.42, cy - h * 0.45);
    ctx.lineTo(cx - len * 0.3, cy);
    ctx.moveTo(cx + len * 0.08, cy + h * 0.62);
    ctx.quadraticCurveTo(cx - len * 0.2, cy + h * 1.15, cx - len * 0.4, cy + h * 0.42);
    ctx.lineTo(cx - len * 0.3, cy);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + len * 0.5, cy + h * 0.08);
    ctx.bezierCurveTo(cx + len * 0.28, cy - h * 0.95, cx - len * 0.22, cy - h * 0.92, cx - len * 0.45, cy);
    ctx.bezierCurveTo(cx - len * 0.2, cy + h * 0.9, cx + len * 0.25, cy + h * 0.85, cx + len * 0.5, cy + h * 0.08);
    ctx.fillStyle = ink.body;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = ink.band;
    for (const b of ink.bands) ctx.fillRect(cx + len * b, cy - h, len * ink.bandWidth, h * 2);
    ctx.fillStyle = ink.belly;
    ctx.fillRect(cx - len * 0.5, cy + h * 0.4, len, h);
    ctx.restore();
    ctx.fillStyle = '#20202c';
    ctx.beginPath();
    ctx.arc(cx + len * 0.28, cy - h * 0.1, Math.max(0.7, len * 0.035), 0, 6.3);
    ctx.fill();
    return c;
  }

  function drawBigFish(ctx, g, f, t) {
    const p = f.phase + t * f.rate;
    const x = f.x + Math.sin(p) * f.ax;
    const y = f.y + Math.sin(p * 1.7 + f.phase) * f.ay;
    const clamped = Math.max(-1, Math.min(1, Math.cos(p) * 3.5));
    const fx = Math.abs(clamped) < 0.24 ? (clamped < 0 ? -0.24 : 0.24) : clamped;
    const sw = f.sprite.width;
    const sh = f.sprite.height;
    const wag = Math.sin(t * 4.2 + f.phase) * f.len * 0.08;
    const root = -sw * 0.55 + f.len * 0.25;
    ctx.setTransform(fx, 0, 0, 1, x, y);
    ctx.fillStyle = f.tail;
    ctx.beginPath();
    ctx.moveTo(root + f.len * 0.1, 0);
    ctx.lineTo(root - f.len * 0.2, -f.len * 0.2 + wag);
    ctx.lineTo(root - f.len * 0.13, wag);
    ctx.lineTo(root - f.len * 0.2, f.len * 0.2 + wag);
    ctx.fill();
    ctx.drawImage(f.sprite, -sw * 0.55, -sh / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function makeBigFish(g, spec) {
    const len = spec.len * g.U;
    const sprite = paintBigFish(g, len, spec.deep, spec.ink);
    return { sprite, len, tail: spec.ink.fin, x: g.W * spec.fx, y: g.H * spec.fy, ax: spec.ax * g.U, ay: spec.ay * g.U, rate: spec.rate, phase: spec.phase };
  }

  // ---- light: rays, the shimmering surface, dapples on everything solid

  function paintRays(g, rand) {
    const small = RAY_SCALE * g.U;
    const w = Math.ceil(g.W * 1.5 * small / g.U);
    const h = Math.ceil(g.H * 0.85 * small / g.U);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const fall = ctx.createLinearGradient(0, 0, 0, h);
    fall.addColorStop(0, 'rgba(245,238,204,0.3)');
    fall.addColorStop(0.5, 'rgba(245,238,204,0.11)');
    fall.addColorStop(1, 'rgba(245,238,204,0)');
    ctx.fillStyle = fall;
    const slant = h * 0.3;
    const count = Math.max(3, Math.round(w / (small * 26)));
    for (let i = 0; i < count; i++) {
      const x = (i + rand() * 0.7) * (w / count);
      const top = small * (1.5 + rand() * 4);
      const foot = top * (1.6 + rand());
      for (const wrap of [-w, 0, w]) {
        ctx.beginPath();
        ctx.moveTo(x + wrap, 0);
        ctx.lineTo(x + wrap + top, 0);
        ctx.lineTo(x + wrap + top - slant + foot, h);
        ctx.lineTo(x + wrap - slant, h);
        ctx.fill();
      }
    }
    return c;
  }

  // Tiles by mixing each column with the one a full width away; flat tones only.
  function paintNet(w, h, freq, squash, seed, colour, lo, hi, fade) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const [r, gr, b] = K.parseColor(colour);
    const f = (x, y) => fbm(x * freq, y * freq * squash, 3, seed);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const ridged = 1 - Math.abs(v - 0.5) * 2;
        const a = Math.round(smoothstep(lo, hi, ridged) * 2) / 2;
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gr;
        img.data[i + 2] = b;
        img.data[i + 3] = a * 255 * (fade ? 1 - y / h : 1);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function slide(ctx, img, x, y, w, h) {
    const o = ((x % w) + w) % w;
    ctx.drawImage(img, o - w, y, w, h);
    ctx.drawImage(img, o, y, w, h);
  }

  function drawDapples(ctx, g, t, amount) {
    const lit = state.litCtx;
    const w = g.W * 1.5;
    lit.globalCompositeOperation = 'source-over';
    lit.clearRect(0, 0, g.W, g.H);
    slide(lit, state.netA, t * g.U * 0.9, 0, w, g.H);
    slide(lit, state.netB, -t * g.U * 0.7, 0, w, g.H);
    lit.globalCompositeOperation = 'destination-in';
    lit.drawImage(state.mask, 0, 0);
    ctx.globalAlpha = Math.min(1, 0.5 * amount);
    ctx.drawImage(state.lit, 0, 0);
    ctx.globalAlpha = 1;
  }

  function drawLightBack(ctx, g, t, amount) {
    const w = g.W * 1.5;
    const h = g.H * 0.85;
    const breathe = 0.75 + 0.25 * Math.sin(t * 0.13);
    ctx.globalAlpha = Math.min(1, amount * breathe);
    slide(ctx, state.rays, t * g.U * 0.55, 0, w, h);
    ctx.globalAlpha = Math.min(1, amount * (1.25 - breathe) * 1.4);
    slide(ctx, state.rays, -t * g.U * 0.31 + w * 0.4, 0, w, h);
    const sh = g.H * 0.15;
    ctx.globalAlpha = Math.min(1, amount * 0.55);
    slide(ctx, state.surface, t * g.U * 1.1, 0, w, sh);
    slide(ctx, state.surface, -t * g.U * 0.8 + w * 0.3, 0, w, sh);
    ctx.globalAlpha = 1;
  }

  // ---- setting it all up

  function bakeReef(g, rand) {
    const reef = paintReef(g, rand);
    const rctx = reef.getContext('2d');
    paintFront(g, rand, rctx);
    const specs = [
      { fx: 0.43, spread: 12, len: 17, count: 66, ink: { foot: '#7c6880', back: '#a48aa8', front: '#cdb4c6', tip: '#f2e6dc' } },
      { fx: 0.9, spread: 9, len: 13, count: 44, ink: { foot: '#6f8455', back: '#6f8455', front: '#98ad70', tip: '#e2e4b6' } },
      { fx: 0.29, spread: 6, len: 9, count: 26, ink: { foot: '#a0665c', back: '#b5705f', front: '#d59a82', tip: '#f1dcbd' } },
    ];
    state.anemones = specs.map((s) => {
      const a = makeAnemone(g, rand, g.W * s.fx, g.H * 0.945, s.spread, s.len, s.count, s.ink);
      rctx.fillStyle = s.ink.foot;
      rctx.beginPath();
      rctx.ellipse(a.x, a.y - g.U * 2, g.U * s.spread * 0.62, g.U * 4, 0, 0, 6.3);
      rctx.fill();
      return a;
    });
    return snap(reef, SNAP);
  }

  function makeFishes(g, rand) {
    state.shoals = [
      makeShoal(g, rand, { fx: 0.17, fy: 0.27, count: 26, rx: 17, ry: 7, rz: 12, len: 4, period: 31, start: 0.3, tones: ['#4a7e96', '#3f7490', '#5c8d9e'] }),
      makeShoal(g, rand, { fx: 0.77, fy: 0.3, count: 38, rx: 27, ry: 12, rz: 18, len: 6, period: 24, start: 0.1, tones: ['#c79a4a', '#a97c3e', '#e2c98a', '#7d6a50'] }),
      makeShoal(g, rand, { fx: 0.57, fy: 0.46, count: 12, rx: 9, ry: 5, rz: 7, len: 4.4, period: 17, start: 0.6, tones: ['#c75f42', '#dc8a68'] }),
    ];
    const gold = { body: '#dcc98e', band: '#2f2f3e', belly: '#e8d9aa', fin: '#c49c4c', bands: [0.2, -0.04, -0.26], bandWidth: 0.075 };
    const slim = { body: '#4c6a8a', band: '#7d9db0', belly: '#d7cda4', fin: '#34506e', bands: [-0.3, 0.05], bandWidth: 0.05 };
    const clown = { body: '#c9633c', band: '#efe3c6', belly: '#c9633c', fin: '#a24a2c', bands: [0.14, -0.14], bandWidth: 0.09 };
    state.big = [
      makeBigFish(g, { fx: 0.7, fy: 0.47, len: 15, deep: 0.42, ink: gold, ax: 13, ay: 3, rate: 0.11, phase: 0.8 }),
      makeBigFish(g, { fx: 0.8, fy: 0.6, len: 12, deep: 0.42, ink: gold, ax: 11, ay: 3, rate: 0.09, phase: 1.5 }),
      makeBigFish(g, { fx: 0.12, fy: 0.55, len: 15, deep: 0.2, ink: slim, ax: 10, ay: 3, rate: 0.08, phase: 3.4 }),
      makeBigFish(g, { fx: 0.43, fy: 0.8, len: 8.5, deep: 0.3, ink: clown, ax: 6, ay: 2, rate: 0.27, phase: 0.3 }),
      makeBigFish(g, { fx: 0.45, fy: 0.84, len: 6.5, deep: 0.3, ink: clown, ax: 5, ay: 2, rate: 0.27, phase: 2.2 }),
    ];
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.heroX = g.W * 0.42;
    const water = paintWater(g, rand);
    const sand = paintSand(g, rand);
    state.back = layer(g.W, g.H);
    const back = state.back.getContext('2d');
    back.drawImage(water, 0, 0);
    back.drawImage(sand, 0, 0);
    state.reef = bakeReef(g, rand);
    state.mask = layer(g.W, g.H);
    const mask = state.mask.getContext('2d');
    mask.drawImage(sand, 0, 0);
    mask.drawImage(state.reef, 0, 0);
    state.lit = layer(g.W, g.H);
    state.litCtx = state.lit.getContext('2d');
    const netW = Math.ceil(g.W * 0.75);
    const netH = Math.ceil(g.H * 0.5);
    const freq = 0.15 / g.U;
    state.netA = paintNet(netW, netH, freq, 1.5, 31, '#f4ebc6', 0.955, 0.995);
    state.netB = paintNet(netW, netH, freq * 0.8, 1.6, 57, '#f4ebc6', 0.96, 0.995);
    state.surface = paintNet(netW, Math.ceil(g.H * 0.075), freq * 0.8, 4, 73, '#f6f1d4', 0.945, 0.99, true);
    state.rays = paintRays(g, rand);
    state.backFan = makeFan(g, rand, g.W * 0.93, g.H * 0.86, 38, PLUM, 5);
    state.frontFan = makeFan(g, rand, g.W * 0.08, g.H * 0.93, 46, EMBER, 9);
    makeFishes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { current, light, fish } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawLightBack(ctx, g, t, light);
    drawShoal(ctx, g, state.shoals[0], t, fish);
    drawFan(ctx, g, state.backFan, t, current);
    drawShoal(ctx, g, state.shoals[1], t, fish);
    ctx.drawImage(state.reef, 0, 0);
    drawDapples(ctx, g, t, light);
    if (fish > 0) for (let i = 0; i < 3; i++) drawBigFish(ctx, g, state.big[i], t);
    drawShoal(ctx, g, state.shoals[2], t, fish);
    drawFan(ctx, g, state.frontFan, t, current);
    for (const a of state.anemones) drawAnemone(ctx, g, a, t, current);
    if (fish > 0) for (let i = 3; i < 5; i++) drawBigFish(ctx, g, state.big[i], t);
  }

  Kasuri.run({
    defaults: { current: 1, light: 1, fish: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1.08, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
