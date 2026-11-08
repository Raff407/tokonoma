/*
 * 藤棚 Fujidana — looking along a wisteria trellis in full bloom toward the light.
 *
 * The tunnel, path and distant blossom are baked once. Racemes nearer the viewer
 * are baked into small bundles, each drawn with one shear in a wave that runs down
 * the tunnel, so a few dozen images plus petals and bees are all a tick costs.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { smoothstep, fbm } = K;

  const LILAC = ['#6a5c9e', '#8a7cc0', '#a899d6', '#c4b8e6', '#dcd3f2', '#efeaf6', '#f8f4ea'];
  const HUES = [[0, 1, 2, 3], [0, 1, 3, 4], [1, 3, 4, 5]];
  const PETAL_TONES = ['#f8f4ea', '#dcd3f2', '#a899d6', '#c4b8e6', '#8a7cc0'];
  const GREENS = ['#7c9468', '#98ad7c', '#b4c290', '#c9d2a4'];
  const GRAVEL = ['#f0e7cf', '#e2d6bc', '#d0c2a8', '#bfb096'];
  const CANOPY = ['#f0e8d0', '#d9d7bf', '#b9c0a6', '#99a68f', '#84917f'];
  const HEROES = [
    [0.035, 0.66, 0], [0.12, 0.5, 1], [0.205, 0.62, 0], [0.295, 0.42, 1], [0.385, 0.3, 2], [0.49, 0.2, 0],
    [0.6, 0.28, 1], [0.69, 0.44, 0], [0.78, 0.58, 2], [0.87, 0.48, 1], [0.965, 0.68, 0],
  ];
  const TIERS = [
    { from: 0.42, to: 0.62, rows: 3, perRow: 24, bundles: 14, shift: 1 },
    { from: 0.62, to: 0.9, rows: 3, perRow: 22, bundles: 14, shift: 1 },
    { from: 0.9, to: 1.3, rows: 3, perRow: 18, bundles: 14, shift: 0 },
  ];
  const BEES = [
    [0.31, 0.44, 5.5, 0.2], [0.67, 0.4, 5, 1.9], [0.44, 0.27, 3, 3.1],
    [0.55, 0.4, 2.6, 4.4], [0.14, 0.6, 6.5, 5.3], [0.85, 0.64, 6, 0.9],
  ];
  const SPRING = 0.1;
  const TOP = 1.15;
  const FLOOR = 0.82;
  const PATH = 0.58;
  const MAX_PETALS = 140;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function archHeight(u) {
    const a = Math.min(1, Math.abs(u));
    return SPRING + (TOP - SPRING) * Math.pow(1 - a * a * a, 1 / 3);
  }

  function sx(g, u, s) { return g.vx + s * u * g.ws; }
  function sy(g, h, s) { return g.vy - s * h * g.hs; }
  function pick(list, rand) { return list[Math.floor(rand() * list.length)]; }
  function depthTone(list, s) {
    const f = smoothstep(0.06, 1.1, s);
    return list[Math.min(list.length - 1, Math.floor(f * list.length))];
  }

  function blob(ctx, x, y, rx, ry, angle) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, 6.3);
    ctx.fill();
  }

  function paintGarden(ctx, g, rand) {
    ctx.fillStyle = GREENS[2];
    ctx.fillRect(0, 0, g.W, g.H);
    const dabs = Math.round(g.W * g.H * 0.01);
    for (let i = 0; i < dabs; i++) {
      const x = rand() * g.W;
      const y = rand() * g.vy * 1.02;
      const near = Math.abs(x - g.vx) / (g.W * 0.5);
      const r = g.U * (0.8 + rand() * 2.4) * (0.5 + near);
      ctx.fillStyle = near < 0.3 ? GREENS[3] : pick(GREENS, rand);
      blob(ctx, x, y, r, r * 0.7, rand() * 3);
    }
  }

  function groundWedge(ctx, g, u0, u1, s0, s1) {
    ctx.beginPath();
    ctx.moveTo(sx(g, u0, s0), sy(g, -FLOOR, s0));
    ctx.lineTo(sx(g, u0, s1), sy(g, -FLOOR, s1));
    ctx.lineTo(sx(g, u1, s1), sy(g, -FLOOR, s1));
    ctx.lineTo(sx(g, u1, s0), sy(g, -FLOOR, s0));
    ctx.fill();
  }

  function blend(a, b, f) {
    return K.toHex(K.mixColor(K.parseColor(a), K.parseColor(b), f));
  }

  function paintGround(ctx, g, rand) {
    const bands = 5;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);
      const s0 = i === 0 ? 0 : 0.03 * Math.pow(44, (i - 1) / (bands - 1));
      const s1 = 0.03 * Math.pow(44, i / (bands - 1));
      ctx.fillStyle = blend('#a8b98a', GREENS[0], f);
      groundWedge(ctx, g, -4, 4, s0, s1);
      ctx.fillStyle = blend('#f2ead2', '#cdbfa6', f);
      groundWedge(ctx, g, -PATH, PATH, s0, s1);
    }
    paintMoss(ctx, g, rand);
    paintStipple(ctx, g, rand);
    paintShadows(ctx, g, rand);
    paintHedge(ctx, g, rand);
    paintMounds(ctx, g, rand);
    paintEdgeStones(ctx, g, rand);
    paintFallen(ctx, g, rand);
  }

  function paintMoss(ctx, g, rand) {
    const count = Math.round(g.W * g.H * 0.05);
    for (let i = 0; i < count; i++) {
      const y = g.vy + rand() * (g.H - g.vy);
      const s = (y - g.vy) / (FLOOR * g.hs);
      const x = rand() * g.W;
      if (Math.abs((x - g.vx) / Math.max(1, s * g.ws)) < PATH) continue;
      const r = Math.max(1, s * g.U * (0.8 + rand() * 1.3));
      ctx.fillStyle = GREENS[Math.floor(rand() * 3)];
      blob(ctx, x, y, r, r * 0.45, 0);
    }
  }

  // A soft hedge line at the far edge of the garden, parted around the path's end.
  function paintHedge(ctx, g, rand) {
    const gap = g.U * 13;
    const step = Math.max(1, g.U * 1.6);
    for (let x = 0; x < g.W; x += step) {
      const away = Math.abs(x - g.vx);
      if (away < gap) continue;
      const tall = rand() < 0.2 ? 1.7 : 1;
      const r = g.U * (3 + rand() * 7) * tall * Math.min(1, 0.35 + (away - gap) / (g.W * 0.3));
      const y = g.vy + g.U * (0.5 + rand() * 1.5);
      ctx.fillStyle = rand() < 0.5 ? GREENS[1] : rand() < 0.5 ? GREENS[0] : GREENS[2];
      blob(ctx, x, y - r * 0.4, r, r * 0.8, 0);
    }
  }

  // Clipped azalea mounds along both sides, so the horizon never shows as a line.
  function paintMounds(ctx, g, rand) {
    for (let s = 0.07; s < 1.3; s *= 1.14) {
      for (const side of [-1, 1]) {
        const x = sx(g, side * (1.12 + rand() * 0.2), s);
        const y = sy(g, -FLOOR, s);
        const r = s * g.U * (15 + rand() * 9);
        ctx.fillStyle = s < 0.3 ? GREENS[1] : '#607a54';
        blob(ctx, x, y - r * 0.32, r, r * 0.66, 0);
        for (let i = 0; i < 14; i++) {
          const a = rand() * 6.28;
          const d = Math.sqrt(rand()) * 0.86;
          const m = Math.max(1, s * g.U * (1.2 + rand() * 1.8));
          ctx.fillStyle = Math.sin(a) < 0 ? GREENS[2] : GREENS[Math.floor(rand() * 2)];
          blob(ctx, x + Math.cos(a) * d * r, y - r * 0.32 + Math.sin(a) * d * r * 0.66, m, m * 0.7, 0);
        }
      }
    }
  }

  function paintStipple(ctx, g, rand) {
    const count = Math.round(g.W * g.H * 0.2);
    for (let i = 0; i < count; i++) {
      const y = g.vy + Math.pow(rand(), 0.8) * (g.H - g.vy);
      const s = (y - g.vy) / (FLOOR * g.hs);
      const u = (rand() * 2 - 1) * PATH;
      const w = Math.max(1, s * g.U * 1.1);
      ctx.fillStyle = pick(GRAVEL, rand);
      ctx.fillRect(sx(g, u, s), y, w, Math.max(1, w * 0.5));
    }
  }

  // Soft pools of canopy shade lying on the gravel, flattened by perspective.
  function paintShadows(ctx, g, rand) {
    ctx.fillStyle = '#b3a58e';
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 46; i++) {
      const s = 0.1 + Math.pow(rand(), 0.7) * 0.95;
      const rx = s * g.U * (4 + rand() * 11);
      blob(ctx, sx(g, (rand() * 2 - 1) * PATH * 0.86, s), sy(g, -FLOOR, s), rx, rx * 0.24, 0);
    }
    ctx.globalAlpha = 1;
  }

  function paintEdgeStones(ctx, g, rand) {
    for (let s = 0.08; s < 1.3; s *= 1.1) {
      for (const side of [-1, 1]) {
        const r = s * g.U * (2.2 + rand() * 1.3);
        const x = sx(g, side * (PATH + rand() * 0.015), s);
        const y = sy(g, -FLOOR, s);
        ctx.fillStyle = s < 0.25 ? '#a39f8b' : '#5f6052';
        blob(ctx, x, y + r * 0.22, r * 1.1, r * 0.55, 0);
        ctx.fillStyle = s < 0.25 ? '#c9c4ae' : rand() < 0.5 ? '#a39f8b' : '#8d8a78';
        blob(ctx, x, y, r, r * 0.46, 0);
      }
    }
  }

  function paintFallen(ctx, g, rand) {
    const count = Math.round(g.W * g.H * 0.16);
    for (let i = 0; i < count; i++) {
      const y = g.vy + rand() * (g.H - g.vy);
      const s = (y - g.vy) / (FLOOR * g.hs);
      const x = rand() * g.W;
      const u = (x - g.vx) / Math.max(1, s * g.ws);
      const edge = Math.abs(Math.abs(u) - PATH);
      const drift = fbm(u * 3.2, Math.log(s + 0.02) * 2.4, 3, 8) + (edge < 0.16 ? 0.16 : 0);
      if (drift < (Math.abs(u) < PATH ? 0.54 : 0.66)) continue;
      const w = Math.max(1, s * g.U * (0.6 + rand() * 1.3));
      ctx.fillStyle = pick(PETAL_TONES, rand);
      blob(ctx, x, y, w, Math.max(0.5, w * 0.42), (rand() - 0.5) * 0.7);
    }
  }

  function archPath(ctx, g, s, reverse) {
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const f = reverse ? 1 - i / steps : i / steps;
      const u = f * 2 - 1;
      ctx.lineTo(sx(g, u, s), sy(g, archHeight(u), s));
    }
  }

  function paintCanopy(ctx, g, rand) {
    for (let s = 2.4; s > 0.05; s /= 1.13) {
      ctx.fillStyle = depthTone(CANOPY, s);
      ctx.beginPath();
      archPath(ctx, g, s, false);
      archPath(ctx, g, s / 1.13, true);
      ctx.fill();
      paintLeaves(ctx, g, rand, s);
    }
  }

  function paintLeaves(ctx, g, rand, s) {
    for (let i = 0; i < 36; i++) {
      const u = rand() * 2 - 1;
      const z = s / (1 + rand() * 0.13);
      const r = z * g.U * (2 + rand() * 3.2);
      const roll = rand();
      ctx.fillStyle = roll < 0.16 ? '#f8f1d4' : roll < 0.42 ? GREENS[Math.floor(rand() * 3)] : LILAC[2 + Math.floor(rand() * 3)];
      blob(ctx, sx(g, u, z), sy(g, archHeight(u) * (0.97 + rand() * 0.05), z), r, r * 0.6, rand() * 3);
    }
  }

  function paintPosts(ctx, g) {
    const h = archHeight(0.96);
    for (let s = 0.1; s < 2; s *= 1.6) {
      const w = Math.max(1, s * g.U * 4.4);
      const tall = s * g.hs * (FLOOR + h);
      for (const side of [-1, 1]) {
        const x = sx(g, side * 0.96, s);
        ctx.fillStyle = s < 0.25 ? '#a39484' : '#6b5645';
        ctx.fillRect(x - w / 2, sy(g, h, s), w, tall);
        ctx.fillStyle = s < 0.25 ? '#c1b4a0' : '#967c62';
        ctx.fillRect(x - side * w * 0.5, sy(g, h, s), Math.max(1, w * 0.32), tall);
      }
      ctx.strokeStyle = s < 0.25 ? '#a39484' : '#6b5645';
      ctx.lineWidth = Math.max(1, s * g.U * 1.8);
      ctx.beginPath();
      archPath(ctx, g, s, false);
      ctx.stroke();
    }
  }

  function paintFarLight(ctx, g) {
    const r = g.U * 15;
    const glow = ctx.createRadialGradient(g.vx, g.vy - r * 0.2, 0, g.vx, g.vy - r * 0.2, r);
    glow.addColorStop(0, 'rgba(252,247,226,1)');
    glow.addColorStop(0.45, 'rgba(250,244,220,0.85)');
    glow.addColorStop(1, 'rgba(248,240,212,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(g.vx - r, g.vy - r * 1.2, r * 2, r * 2);
  }

  function paintBackdrop(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGarden(ctx, g, rand);
    paintGround(ctx, g, rand);
    paintCanopy(ctx, g, rand);
    paintPosts(ctx, g);
    paintFarLight(ctx, g);
    return c;
  }

  function tonesFor(hue, shift) {
    return HUES[hue].map((i) => LILAC[Math.min(LILAC.length - 1, i + shift)]);
  }

  // Pale open flowers at the root, deep buds at the tip, lit from the left.
  function floretTone(tones, f, off, rand) {
    const side = off > 0.3 ? 0.18 : off < -0.3 ? -0.1 : 0;
    const depth = f + (rand() - 0.5) * 0.35 + side;
    const index = depth < 0.16 ? 3 : depth < 0.46 ? 2 : depth < 0.76 ? 1 : 0;
    return tones[rand() < 0.16 ? Math.max(0, index - 1) : index];
  }

  function paintRaceme(len, half, tones, rand) {
    const c = layer(half * 2.5 + 4, len + 2);
    const ctx = c.getContext('2d');
    const mark = Math.max(0.8, Math.min(half * 0.24, len * 0.02 + 0.6));
    const steps = Math.ceil(len / (mark * 0.75));
    const kink = rand() * 6.28;
    const cx = c.width / 2;
    for (let i = 0; i < steps; i++) {
      const f = i / steps;
      const lump = 0.84 + 0.22 * Math.sin(f * 26 + kink) + 0.1 * Math.sin(f * 61 + kink * 2);
      const width = half * lump * Math.pow(1 - f, 1.05) * (0.7 + 0.3 * smoothstep(0, 0.14, f)) + 0.4;
      const axis = cx + Math.sin(f * 4 + kink) * half * 0.14;
      const n = Math.max(2, Math.round((width / mark) * 1.5));
      for (let j = 0; j < n; j++) {
        const off = rand() * 2 - 1;
        const size = mark * (0.7 + rand() * 0.7) * (1 - f * 0.5);
        ctx.fillStyle = floretTone(tones, f, off, rand);
        blob(ctx, axis + off * width, f * len, size, size * 0.72, rand() * 3);
      }
    }
    return c;
  }

  // A pinnate leaf spray, so the blossom hangs among some green.
  function paintSpray(len, shift, rand) {
    const c = layer(len * 0.7, len + 2);
    const ctx = c.getContext('2d');
    const cx = c.width / 2;
    const pairs = 6;
    const light = Math.min(3, shift + 1);
    for (let i = 1; i <= pairs; i++) {
      const y = (i / pairs) * len * 0.88;
      const r = Math.max(1, len * 0.11 * (1 - i * 0.05));
      for (const side of [-1, 1]) {
        ctx.fillStyle = side < 0 ? GREENS[light] : GREENS[light - 1];
        blob(ctx, cx + side * r * 0.95, y + rand() * r * 0.3, r, r * 0.42, side * 0.5);
      }
    }
    ctx.fillStyle = GREENS[light];
    blob(ctx, cx, len * 0.95, Math.max(1, len * 0.04), Math.max(1, len * 0.08), 0);
    return c;
  }

  function makeSprites(g, rand, s, shift) {
    const len = 0.8 * s * g.hs;
    const list = [];
    for (let i = 0; i < 6; i++) list.push(paintRaceme(len, len * 0.1, tonesFor(i % 3, shift), rand));
    list.push(paintSpray(len * 0.55, shift, rand));
    return { len, list };
  }

  function hangRow(g, rand, s, perRow, sprites) {
    const list = [];
    for (let i = 0; i < perRow; i++) {
      const u = -1 + ((i + 0.15 + rand() * 0.7) / perRow) * 2;
      const reach = (0.6 + rand() * 0.45) * (1 + 0.35 * Math.pow(Math.abs(u), 4));
      const length = reach * 0.72 * s * g.hs;
      list.push({
        sprite: pick(sprites.list, rand),
        scale: length / sprites.len,
        x: sx(g, u, s),
        y: sy(g, archHeight(u) * (0.97 + rand() * 0.04), s),
      });
    }
    return list;
  }

  function placeOn(ctx, r, ox, oy) {
    const w = r.sprite.width * r.scale;
    ctx.drawImage(r.sprite, r.x - w / 2 - ox, r.y - oy, w, r.sprite.height * r.scale);
  }

  // Far blossom needs no per-raceme motion: one layer per stretch of tunnel.
  function bakeFar(g, rand, from, to, shift) {
    const x0 = Math.max(0, Math.floor(g.vx - to * g.ws * 1.05));
    const y0 = Math.max(0, Math.floor(sy(g, TOP * 1.05, to)));
    const c = layer(Math.min(g.W - x0, to * g.ws * 2.1), Math.min(g.H - y0, to * g.hs * 2.4));
    const ctx = c.getContext('2d');
    for (let s = from; s < to; s *= 1.17) {
      const sprites = makeSprites(g, rand, s, shift);
      for (const r of hangRow(g, rand, s, 22, sprites)) placeOn(ctx, r, x0, y0);
    }
    return { canvas: c, x: x0, y: y0, s: to, wave: Math.log(to) * 2.2 };
  }

  function bakeBundle(g, list, s, xf) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const r of list) {
      const w = (r.sprite.width * r.scale) / 2;
      x0 = Math.min(x0, r.x - w);
      x1 = Math.max(x1, r.x + w);
      y0 = Math.min(y0, r.y);
      y1 = Math.max(y1, r.y + r.sprite.height * r.scale);
    }
    x0 = Math.floor(x0);
    y0 = Math.floor(y0);
    const c = layer(x1 - x0 + 1, y1 - y0 + 1);
    const ctx = c.getContext('2d');
    for (const r of list) placeOn(ctx, r, x0, y0);
    return { canvas: c, x: x0, y: y0, wave: Math.log(s) * 2.2 + xf * 3.4, phase: xf * 37, rate: 0.8 + (xf * 91 % 1) * 0.35 };
  }

  function makeTier(g, rand, tier) {
    const sprites = makeSprites(g, rand, tier.to, tier.shift);
    const bins = [];
    for (let i = 0; i < tier.bundles; i++) bins.push([]);
    const ratio = Math.pow(tier.to / tier.from, 1 / tier.rows);
    for (let k = 0, s = tier.from; k < tier.rows; k++, s *= ratio) {
      for (const r of hangRow(g, rand, s, tier.perRow, sprites)) {
        const xf = Math.min(0.999, Math.max(0, r.x / g.W));
        bins[Math.floor(xf * tier.bundles)].push(r);
      }
    }
    return bins.filter((b) => b.length).map((b, i) => bakeBundle(g, b, tier.to, (i + 0.5) / bins.length));
  }

  function sliceHero(canvas, seg) {
    const parts = [];
    for (let k = 0; k < 3; k++) {
      const c = layer(canvas.width, seg + 1);
      c.getContext('2d').drawImage(canvas, 0, -k * seg);
      parts.push(c);
    }
    return parts;
  }

  function makeHeroes(g, rand) {
    return HEROES.map((h, i) => {
      const half = g.U * (6.2 + (i % 3) * 1);
      const canvas = paintRaceme(g.H * h[1], half, tonesFor(h[2], 0), rand);
      const seg = Math.ceil(canvas.height / 3);
      return {
        parts: sliceHero(canvas, seg),
        seg,
        x: Math.round(g.W * h[0] - canvas.width / 2),
        y: -Math.round(g.U * 3),
        wave: 1.1 + h[0] * 3.4,
        phase: i * 2.3,
        rate: 0.75 + (i % 4) * 0.1,
      };
    });
  }

  function leanAt(b, t, breeze) {
    const wave = Math.sin(t * 0.62 - b.wave);
    const flutter = Math.sin(t * b.rate + b.phase) * 0.3;
    return (wave + flutter) * breeze * 0.085;
  }

  // Three linked shears: the tail lags behind the root, so a hero raceme bends.
  function drawHeroes(ctx, t, breeze) {
    for (let i = 0; i < state.heroes.length; i++) {
      const b = state.heroes[i];
      const lean = leanAt(b, t, breeze);
      let drift = 0;
      for (let k = 0; k < b.parts.length; k++) {
        const shear = lean * (0.5 + k * 0.5);
        ctx.setTransform(1, 0, shear, 1, b.x + drift, b.y + k * b.seg);
        ctx.drawImage(b.parts[k], 0, 0);
        drift += shear * b.seg;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawFar(ctx, g, t, breeze) {
    for (let i = 0; i < state.far.length; i++) {
      const f = state.far[i];
      ctx.drawImage(f.canvas, f.x + Math.sin(t * 0.62 - f.wave) * f.s * g.U * 3 * breeze, f.y);
    }
  }

  function drawBundles(ctx, list, t, breeze) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      ctx.setTransform(1, 0, leanAt(b, t, breeze), 1, b.x, b.y);
      ctx.drawImage(b.canvas, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function makeDapples(g, rand) {
    const list = [];
    for (let i = 0; i < 20; i++) {
      const z = 0.12 + Math.pow(rand(), 0.8) * 0.9;
      const rx = z * g.U * (2.5 + rand() * rand() * 12);
      list.push({
        x: sx(g, (rand() * 2 - 1) * PATH * 0.88, z), y: sy(g, -FLOOR, z),
        rx, ry: rx * 0.24, drift: z * g.U * 2.8, phase: rand() * 6.28, rate: 0.16 + rand() * 0.2,
      });
    }
    return list;
  }

  function drawDapples(ctx, t, breeze) {
    ctx.fillStyle = '#fbf3d6';
    for (let i = 0; i < state.dapples.length; i++) {
      const d = state.dapples[i];
      const size = 0.72 + 0.28 * Math.sin(t * d.rate + d.phase);
      const x = d.x + Math.sin(t * d.rate * 1.4 + d.phase) * d.drift * breeze;
      ctx.globalAlpha = 0.34;
      blob(ctx, x, d.y, d.rx * size, d.ry * size, 0);
      ctx.globalAlpha = 0.5;
      blob(ctx, x, d.y, d.rx * size * 0.55, d.ry * size * 0.55, 0);
    }
    ctx.globalAlpha = 1;
  }

  function makeShafts(g) {
    return [[0.26, 7, 0.4], [0.64, 9, 4.2], [0.82, 6, 1.3]].map((a) => ({
      x: g.W * a[0], w: g.U * a[1], phase: a[2],
    }));
  }

  function drawShafts(ctx, g, t) {
    const drop = g.H * 0.86;
    const lean = drop * 0.2;
    ctx.fillStyle = '#fbf3d6';
    for (let i = 0; i < state.shafts.length; i++) {
      const b = state.shafts[i];
      const a = 0.07 + 0.04 * Math.sin(t * 0.21 + b.phase);
      const w = b.w;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(b.x - w * 0.7, 0);
      ctx.lineTo(b.x + w * 0.7, 0);
      ctx.lineTo(b.x + lean + w * 1.4, drop);
      ctx.lineTo(b.x + lean - w * 1.4, drop);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function resetPetal(g, i, anywhere) {
    const r = state.rand;
    const s = 0.16 + r() * r() * 1.05;
    const floorY = sy(g, -FLOOR, s);
    const topY = sy(g, 0.9, s);
    state.px[i] = sx(g, (r() * 2 - 1) * 0.92, s);
    state.py[i] = anywhere ? topY + r() * (floorY - topY) : topY;
    state.pf[i] = floorY;
    state.pv[i] = s * g.U * (3.4 + r() * 3);
    state.ps[i] = Math.max(1, s * g.U * 1.3);
    state.pp[i] = r() * 6.28;
  }

  function drawPetals(ctx, g, t, dt, amount) {
    const count = Math.round(Math.min(MAX_PETALS, 70 * amount));
    for (let i = 0; i < count; i++) {
      state.py[i] += state.pv[i] * dt;
      if (state.py[i] > state.pf[i]) resetPetal(g, i, false);
      const size = state.ps[i];
      const flip = Math.abs(Math.sin(t * 2.1 + state.pp[i]));
      const x = state.px[i] + Math.sin(t * 0.8 + state.pp[i]) * size * 3;
      ctx.fillStyle = PETAL_TONES[i % 3];
      ctx.fillRect(x, state.py[i], size * (1 + flip), Math.max(1, size * (1.2 - flip * 0.6)));
    }
  }

  function paintBee(size, wingUp) {
    const c = layer(size * 2.4, size * 2.4);
    const ctx = c.getContext('2d');
    const u = size / 10;
    const cx = size * 1.2;
    const cy = size * 1.35;
    paintWings(ctx, cx, cy, u, wingUp);
    ctx.fillStyle = '#e0b04a';
    blob(ctx, cx - u * 4, cy + u * 0.9, u * 5.2, u * 3.6, -0.2);
    ctx.fillStyle = '#372c24';
    for (let i = 0; i < 3; i++) blob(ctx, cx - u * (2 + i * 2.6), cy + u * (0.5 + i * 0.5), u * 0.85, u * (3.2 - i * 0.6), -0.2);
    ctx.fillStyle = '#b98a38';
    blob(ctx, cx + u * 2.3, cy, u * 3, u * 3, 0);
    ctx.fillStyle = '#372c24';
    blob(ctx, cx + u * 5.5, cy + u * 0.6, u * 1.9, u * 1.9, 0);
    ctx.lineWidth = Math.max(0.7, u * 0.6);
    ctx.strokeStyle = '#372c24';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(cx + u * (1 + i * 1.6), cy + u * 2.6);
      ctx.lineTo(cx + u * (0.2 + i * 1.6), cy + u * 5);
    }
    ctx.stroke();
    return c;
  }

  function paintWings(ctx, cx, cy, u, wingUp) {
    const tilt = wingUp ? -0.95 : -0.4;
    ctx.fillStyle = '#f4f1ea';
    blob(ctx, cx - u * 1.6, cy - u * 4.6, u * 4.8, u * 2, tilt);
    ctx.fillStyle = '#d9d6e2';
    blob(ctx, cx - u * 4, cy - u * 3.2, u * 3.4, u * 1.5, tilt - 0.35);
  }

  function makeBees(g) {
    return BEES.map((b, i) => {
      const size = Math.max(3, Math.round(g.U * b[2]));
      return {
        x: g.W * b[0], y: g.H * b[1], phase: b[3],
        up: paintBee(size, true), down: paintBee(size, false),
        rx: g.U * (7 + i * 1.6), ry: g.U * (4 + (i % 3) * 1.6), rate: 0.2 + (i % 4) * 0.045,
      };
    });
  }

  function drawBee(ctx, g, b, t) {
    const a = t * b.rate + b.phase;
    const x = b.x + Math.sin(a) * b.rx + Math.sin(a * 2.3) * b.rx * 0.28;
    const y = b.y + Math.sin(a * 1.4 + 1) * b.ry + Math.sin(t * 3.4 + b.phase) * g.U * 0.35;
    const dir = Math.cos(a) + Math.cos(a * 2.3) * 0.64 >= 0 ? 1 : -1;
    const sprite = Math.floor(t * 9 + b.phase) % 2 === 0 ? b.up : b.down;
    const half = sprite.width / 2;
    ctx.setTransform(dir, 0, 0, 1, x, y);
    ctx.drawImage(sprite, -half, -half);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawBees(ctx, g, t, from, to, amount) {
    const count = Math.round(amount * 3.5);
    for (let i = from; i < to && i < count; i++) drawBee(ctx, g, state.bees[i], t);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.vx = g.W * 0.49;
    g.vy = g.H * 0.56;
    g.ws = g.W * 0.62;
    g.hs = g.H * 0.55;
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.backdrop = paintBackdrop(g, rand);
    state.far = [bakeFar(g, rand, 0.07, 0.2, 2), bakeFar(g, rand, 0.2, 0.42, 1)];
    state.tiers = TIERS.map((tier) => makeTier(g, rand, tier));
    state.heroes = makeHeroes(g, rand);
    state.dapples = makeDapples(g, rand);
    state.shafts = makeShafts(g);
    state.bees = makeBees(g);
    for (const key of ['px', 'py', 'pf', 'pv', 'ps', 'pp']) state[key] = new Float32Array(MAX_PETALS);
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { breeze, petals, bees } = api.props;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(state.backdrop, 0, 0);
    drawDapples(ctx, t, breeze);
    drawFar(ctx, g, t, breeze);
    drawBundles(ctx, state.tiers[0], t, breeze);
    drawBundles(ctx, state.tiers[1], t, breeze);
    drawBees(ctx, g, t, 2, 4, bees);
    drawShafts(ctx, g, t);
    drawBundles(ctx, state.tiers[2], t, breeze);
    drawBees(ctx, g, t, 0, 2, bees);
    drawPetals(ctx, g, t, dt, petals);
    drawHeroes(ctx, t, breeze);
    drawBees(ctx, g, t, 4, 6, bees);
  }

  Kasuri.run({
    defaults: { breeze: 1, petals: 1, bees: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
