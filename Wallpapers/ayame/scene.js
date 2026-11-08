/*
 * 菖蒲 Ayame — irises in a shallow marsh garden, a plank walkway zig-zagging across.
 *
 * Far water, shore and bridge are baked once. Middle clumps are two sprites that
 * shear from the foot; the two big clumps redraw only their blades as short paths
 * and rotate baked blooms. Reflections are one layer slid in strips.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, parseColor, mixColor, toHex } = K;

  const TONES = {
    purple: { rim: '#c0a8e4', body: '#7f5cbc', deep: '#553c90', vein: '#3f2c72', std: '#a386d6' },
    indigo: { rim: '#a09ade', body: '#5552b0', deep: '#3b3a84', vein: '#2c2b66', std: '#8682cc' },
    white: { rim: '#faf5e8', body: '#e9e3d8', deep: '#bfb6c8', vein: '#a89fc0', std: '#f3edde' },
    lilac: { rim: '#efe3f0', body: '#c6acdc', deep: '#9c82be', vein: '#7e62a8', std: '#dccbe8' },
  };
  const GOLD = '#dcb040';
  const LEAVES = ['#4a7c50', '#5a8e58', '#70a262', '#42725a', '#86b06a'];
  const LEAF_LIGHT = '#a0c47c';
  const STEM = '#6c9c5c';
  const VIEWS = [{ sx: 1, rot: 0 }, { sx: 0.86, rot: 0.16 }, { sx: 0.86, rot: -0.16 }, { sx: 0.68, rot: 0.08 }];
  // Where blooms sit in a clump: sideways and up, as fractions of its height. r is a bud.
  const PATTERNS = [
    [[-0.3, 0.64], [0.2, 0.82], [0.4, 0.46], [-0.05, 0.42], [-0.46, 0.3], [0.1, 1.02, 'r'], [-0.42, 0.9, 'r']],
    [[0.28, 0.68], [-0.22, 0.86], [-0.42, 0.46], [0.08, 0.44], [0.44, 0.3], [-0.04, 1.04, 'r'], [0.46, 0.92, 'r']],
    [[-0.16, 0.7], [0.26, 0.54], [-0.34, 0.38], [0.04, 0.34], [0.32, 0.94, 'r']],
  ];
  const BRIDGE = [[0.38, 0.92], [-0.6, 1.7], [0.7, 2.55], [-0.78, 3.7], [0.84, 5.2], [-0.72, 7.2], [0.36, 10]];
  const BRIDGE_HALF = 0.115;
  const DECK_RISE = 0.055;
  const MIDDLE = [
    [-24, 55, 11, 'white', 'lilac'], [33, 51, 11, 'purple', 'indigo'], [-9, 59, 9, 'white', 'lilac'],
    [-29, 46, 8, 'purple', 'indigo'], [26, 42, 8, 'white', 'white'], [12, 46, 6, 'purple', 'purple'],
    [-36, 39, 6, 'indigo', 'purple'], [38, 39, 6, 'purple', 'lilac'], [-14, 37, 4.5, 'white', 'lilac'],
    [20, 34, 4.5, 'purple', 'white'], [-46, 52, 13, 'purple', 'lilac'], [50, 56, 15, 'white', 'purple'],
  ];
  const RIPPLES = 18;
  const RAIN = 110;
  const CYCLE = 96;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function shoreY(g) {
    return g.U * 27;
  }

  // Ground plane: X sideways, Z away, h height, all in eye heights. Eye height is 85U.
  function project(g, X, Z, h) {
    const f = g.U * 85;
    return [g.W / 2 + state.squeeze * f * X / Z, g.U * 20 + f * (1 - h) / Z];
  }

  function quad(ctx, a, b, c, d) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.fill();
  }

  function paintSky(ctx, g) {
    const top = parseColor('#cdd7d2');
    const low = parseColor('#f0ecdc');
    const bands = 5;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = toHex(mixColor(top, low, i / (bands - 1)));
      ctx.fillRect(0, (shoreY(g) * i) / bands, g.W, shoreY(g) / bands + 1);
    }
  }

  function ridge(ctx, g, base, rise, scale, seed, tone) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, shoreY(g));
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.U * (base - fbm(x / g.U * scale, seed, 3, seed) * rise));
    }
    ctx.lineTo(g.W, shoreY(g));
    ctx.fill();
  }

  // A garden tree: a crowd of small dabs, lit from the upper left.
  function paintTree(ctx, g, rand, x, y, size) {
    const inks = ['#5c7f66', '#6c9072', '#84a880', '#a0bd90'];
    ctx.fillStyle = inks[0];
    ctx.fillRect(x - g.U * 0.5, y, g.U, shoreY(g) - y);
    ctx.fillStyle = inks[1];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * size * g.U * 0.72, y + Math.sin(a) * size * g.U * 0.4, size * g.U * 0.42, size * g.U * 0.3, 0, 0, 6.3);
      ctx.fill();
    }
    for (let i = 0; i < size * 16; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      const dx = Math.cos(a) * d * 1.12;
      const dy = Math.sin(a) * d * 0.68;
      const lit = (0.5 - dx * 0.3 - dy * 0.6 + rand() * 0.35) * inks.length;
      ctx.fillStyle = inks[Math.max(0, Math.min(inks.length - 1, Math.floor(lit)))];
      const s = g.U * (0.5 + rand() * 1);
      ctx.fillRect(x + dx * size * g.U, y + dy * size * g.U, s * 1.5, s);
    }
  }

  function paintArbour(ctx, g, x) {
    const u = g.U;
    const foot = shoreY(g);
    ctx.fillStyle = '#3f352c';
    ctx.fillRect(x - u * 6, foot - u * 6, Math.max(1, u * 0.6), u * 6);
    ctx.fillRect(x + u * 5.4, foot - u * 6, Math.max(1, u * 0.6), u * 6);
    ctx.fillStyle = '#7a6a54';
    ctx.beginPath();
    ctx.moveTo(x - u * 9, foot - u * 5.4);
    ctx.quadraticCurveTo(x - u * 3, foot - u * 8, x, foot - u * 11);
    ctx.quadraticCurveTo(x + u * 3, foot - u * 8, x + u * 9, foot - u * 5.4);
    ctx.fill();
    ctx.fillStyle = '#9a8a6e';
    ctx.fillRect(x - u * 7, foot - u * 6.2, u * 14, Math.max(1, u * 0.5));
  }

  function paintShore(ctx, g, rand) {
    ridge(ctx, g, 24, 22, 0.014, 3, '#c6d2c8');
    ridge(ctx, g, 27, 18, 0.028, 8, '#a6baa8');
    const spots = [0.06, 0.2, 0.34, 0.66, 0.8, 0.94];
    const sizes = [12, 9, 7, 8, 11, 13];
    spots.forEach((f, i) => {
      paintTree(ctx, g, rand, g.W * f, g.U * (19 - sizes[i] * 0.45), sizes[i]);
    });
    paintArbour(ctx, g, g.W / 2 + g.U * 24);
    ctx.fillStyle = '#6e8c72';
    ctx.fillRect(0, shoreY(g) - g.U * 1.5, g.W, g.U * 1.8);
    for (let x = 0; x < g.W; x += Math.max(1, g.U * 0.5)) {
      ctx.fillStyle = rand() < 0.5 ? '#86a47a' : '#668670';
      ctx.fillRect(x, shoreY(g) - g.U * (1 + rand() * 2.2), 1, g.U * 2.5);
    }
  }

  function paintWater(ctx, g) {
    const y0 = shoreY(g);
    const bands = [['#c4d4ca', 0], ['#9cbab6', 0.05], ['#7ca2a8', 0.13], ['#6a92a0', 0.28], ['#5e8696', 0.5], ['#557c8c', 0.74]];
    for (const [tone, f] of bands) {
      ctx.fillStyle = tone;
      ctx.fillRect(0, y0 + (g.H - y0) * f, g.W, g.H - y0);
    }
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    state.treeline = layer(g.W, g.H);
    paintShore(state.treeline.getContext('2d'), g, rand);
    paintSky(ctx, g);
    paintWater(ctx, g);
    ctx.drawImage(state.treeline, 0, 0);
    return c;
  }

  // Long pale streaks on the water, baked small. Quantized so they stay flat tones.
  function paintGlints(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil((g.H - shoreY(g)) / 2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const sx = 0.05 / g.U;
    const at = (x, yy) => fbm(x * sx, yy, 3, 41);
    for (let y = 0; y < h; y++) {
      const yy = Math.log(1 + (y / h) * 6) * 16;
      for (let x = 0; x < w; x++) {
        const v = lerp(at(x, yy), at(x - w, yy), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 176;
        img.data[i + 1] = 204;
        img.data[i + 2] = 204;
        img.data[i + 3] = Math.round(smoothstep(0.5, 0.7, v) * 2) * 34;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // bend pushes the tip sideways, so a fall can arch over and hang.
  function petal(ctx, ang, len, wid, fill, bend = 0) {
    const o = bend * len;
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, -wid * 0.08);
    ctx.bezierCurveTo(len * 0.3, -wid * 0.14, len * 0.42, -wid * 0.56 + o * 0.4, len * 0.72, -wid * 0.54 + o * 0.7);
    ctx.bezierCurveTo(len * 0.92, -wid * 0.48 + o, len * 1.04, -wid * 0.2 + o, len, o);
    ctx.bezierCurveTo(len * 1.04, wid * 0.2 + o, len * 0.92, wid * 0.48 + o, len * 0.72, wid * 0.54 + o * 0.7);
    ctx.bezierCurveTo(len * 0.42, wid * 0.56 + o * 0.4, len * 0.3, wid * 0.14, 0, wid * 0.08);
    ctx.fill();
    ctx.restore();
  }

  function veins(ctx, ang, R, ink, bend) {
    const o = bend * R;
    ctx.save();
    ctx.rotate(ang);
    ctx.strokeStyle = ink.vein;
    ctx.lineWidth = Math.max(0.5, R * 0.045);
    ctx.globalAlpha = 0.7;
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      ctx.beginPath();
      ctx.moveTo(R * 0.34, i * R * 0.035);
      ctx.quadraticCurveTo(R * 0.6, i * R * 0.11 + o * 0.4, R * 0.88, i * R * 0.1 + o * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  // One of the three big hanging petals: pale rim, body, veins, a thin gold ray from the throat.
  function fall(ctx, ang, R, wid, ink, bend) {
    petal(ctx, ang, R, wid, ink.rim, bend);
    petal(ctx, ang, R * 0.94, wid * 0.8, ink.body, bend);
    if (R > 3) veins(ctx, ang, R, ink, bend);
    petal(ctx, ang, R * 0.52, R * 0.17, ink.rim, bend * 0.4);
    petal(ctx, ang, R * 0.46, R * 0.09, GOLD, bend * 0.4);
  }

  function standard(ctx, ang, len, wid, ink) {
    petal(ctx, ang, len, wid, ink.rim);
    petal(ctx, ang, len * 0.9, wid * 0.62, ink.std);
  }

  function paintBloom(ctx, R, ink) {
    petal(ctx, Math.PI / 2, R * 0.7, R * 0.22, '#5d8f55');
    standard(ctx, -Math.PI / 2 - 0.5, R * 0.92, R * 0.38, ink);
    standard(ctx, -Math.PI / 2 + 0.5, R * 0.92, R * 0.38, ink);
    standard(ctx, -Math.PI / 2, R * 1.08, R * 0.42, ink);
    fall(ctx, Math.PI - 0.14, R * 1.16, R * 0.7, ink, -0.2);
    fall(ctx, 0.14, R * 1.16, R * 0.7, ink, 0.2);
    petal(ctx, Math.PI / 2, R * 1.16, R * 0.84, ink.deep);
    fall(ctx, Math.PI / 2, R * 1.12, R * 0.76, ink, 0);
    petal(ctx, -Math.PI / 2, R * 0.2, R * 0.2, ink.rim);
  }

  function bloomSprite(tone, view, R) {
    const key = tone + view + Math.round(R * 2);
    if (state.sprites[key]) return state.sprites[key];
    const c = layer(R * 3.2, R * 3.2);
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(VIEWS[view].rot);
    ctx.scale(VIEWS[view].sx, 1);
    paintBloom(ctx, R, TONES[tone]);
    state.sprites[key] = c;
    return c;
  }

  function budSprite(tone, R) {
    const key = 'bud' + tone + Math.round(R * 2);
    if (state.sprites[key]) return state.sprites[key];
    const c = layer(R * 2, R * 3);
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height * 0.72);
    petal(ctx, -Math.PI / 2, R * 1.7, R * 0.72, TONES[tone].deep);
    petal(ctx, -Math.PI / 2 + 0.06, R * 1.5, R * 0.38, TONES[tone].std);
    petal(ctx, -Math.PI / 2, R * 0.72, R * 0.72, '#4f7f4c');
    state.sprites[key] = c;
    return c;
  }

  function makeBlades(rand, h, count, front) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const x0 = (rand() - 0.5) * h * 0.36;
      list.push({
        x0,
        drop: rand() * h * (front ? 0.09 : 0.06),
        lean: x0 * (1 + rand() * 1.6) + (rand() - 0.5) * h * 0.14,
        len: h * (front ? 0.3 + rand() * 0.25 : 0.72 + rand() * 0.55),
        hw: Math.max(0.9, h * (0.018 + rand() * 0.012)),
        tone: LEAVES[Math.floor(rand() * LEAVES.length)],
        rib: rand() < 0.5,
        phase: rand() * 6.28,
      });
    }
    return list;
  }

  function makeBlooms(rand, spec, pattern) {
    return pattern.map((p, i) => {
      const isBud = p[2] === 'r';
      const tone = spec.tones[i % spec.tones.length];
      const R = spec.h * (isBud ? 0.075 : 0.16 + rand() * 0.025);
      const view = Math.floor(rand() * VIEWS.length);
      return {
        dx: p[0] * spec.h * state.spread,
        up: p[1] * spec.h,
        R,
        isBud,
        sprite: isBud ? budSprite(tone, R) : bloomSprite(tone, view, R),
        phase: rand() * 6.28,
      };
    });
  }

  function makeClump(rand, spec) {
    const pattern = spec.h < 8 ? PATTERNS[2].slice(0, 3) : PATTERNS[spec.pattern % PATTERNS.length];
    return {
      x: spec.x,
      foot: spec.foot,
      h: spec.h,
      back: makeBlades(rand, spec.h, Math.round(10 + spec.h * 0.16), false),
      front: makeBlades(rand, spec.h, Math.round(3 + spec.h * 0.05), true),
      blooms: makeBlooms(rand, spec, pattern),
      phase: rand() * 6.28,
    };
  }

  function swing(t, phase) {
    return Math.sin(t * 0.62 + phase) + 0.4 * Math.sin(t * 1.41 + phase * 1.7);
  }

  function drawBlade(ctx, b, x, y, sway) {
    const y1 = y + b.drop;
    const tx = x + b.x0 + b.lean + sway;
    const ty = y - b.len;
    const cx = x + b.x0 + b.lean * 0.3 + sway * 0.35;
    const cy = y - b.len * 0.58;
    ctx.fillStyle = b.tone;
    ctx.beginPath();
    ctx.moveTo(x + b.x0 - b.hw, y1);
    ctx.quadraticCurveTo(cx - b.hw, cy, tx, ty);
    ctx.quadraticCurveTo(cx + b.hw, cy, x + b.x0 + b.hw, y1);
    ctx.fill();
    if (!b.rib) return;
    ctx.fillStyle = LEAF_LIGHT;
    ctx.beginPath();
    ctx.moveTo(x + b.x0 - b.hw * 0.7, y1);
    ctx.quadraticCurveTo(cx - b.hw * 0.8, cy, tx, ty);
    ctx.quadraticCurveTo(cx - b.hw * 0.25, cy, x + b.x0 - b.hw * 0.2, y1);
    ctx.fill();
  }

  function drawBlades(ctx, list, x, y, t, amt) {
    for (const b of list) drawBlade(ctx, b, x, y, amt ? swing(t, b.phase) * amt * b.len * 0.035 : 0);
  }

  function drawBlooms(ctx, g, c, t, amt) {
    const x = c.x;
    const y = c.foot;
    ctx.strokeStyle = STEM;
    ctx.lineWidth = Math.max(1.2, c.h * 0.018);
    for (const b of c.blooms) {
      const sway = amt ? swing(t, b.phase) * amt * b.up * 0.03 : 0;
      const bx = x + b.dx + sway;
      const by = y - b.up;
      ctx.beginPath();
      ctx.moveTo(x + b.dx * 0.28, y);
      ctx.quadraticCurveTo(x + b.dx * 0.5, y - b.up * 0.5, bx, by);
      ctx.stroke();
      const nod = amt ? Math.sin(t * 0.9 + b.phase) * 0.07 * amt : 0;
      const s = b.sprite;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(nod + sway / Math.max(1, b.up) * 1.2);
      ctx.drawImage(s, -s.width / 2, b.isBud ? -s.height * 0.72 : -s.height / 2);
      ctx.restore();
    }
  }

  function paintClump(ctx, g, c) {
    drawBlades(ctx, c.back, c.x, c.foot, 0, 0);
    drawBlooms(ctx, g, c, 0, 0);
    drawBlades(ctx, c.front, c.x, c.foot, 0, 0);
  }

  // Bake a middle clump into a blade sprite and a bloom sprite, foot at the bottom centre.
  function spriteClump(g, c) {
    const w = c.h * 2.4;
    const h = c.h * 1.85;
    const blades = layer(w, h);
    const heads = layer(w, h);
    const drop = c.h * 0.1;
    const local = { ...c, x: w / 2, foot: h - drop };
    const bctx = blades.getContext('2d');
    drawBlades(bctx, c.back, local.x, local.foot, 0, 0);
    const hctx = heads.getContext('2d');
    drawBlooms(hctx, g, local, 0, 0);
    drawBlades(hctx, c.front, local.x, local.foot, 0, 0);
    return { ...c, blades, heads, ax: w / 2, ay: h - drop };
  }

  function deckQuad(ctx, g, a, b, from, to, rise) {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const nx = (dz / len) * BRIDGE_HALF;
    const nz = (-dx / len) * BRIDGE_HALF;
    const ex = (dx / len) * 0.07;
    const ez = (dz / len) * 0.07;
    const p = (s, o, e) => project(g, s[0] + nx * o + ex * e, s[1] + nz * o + ez * e, rise);
    quad(ctx, p(a, from, -1), p(b, from, 1), p(b, to, 1), p(a, to, -1));
  }

  function paintPosts(ctx, g, a) {
    for (const o of [-0.09, 0.09]) {
      const top = project(g, a[0] + o, a[1], DECK_RISE);
      const low = project(g, a[0] + o, a[1], 0);
      const w = Math.max(1, (g.U * 2.2) / a[1]);
      ctx.fillRect(top[0] - w / 2, top[1], w, low[1] - top[1] + 1);
    }
  }

  function paintLeg(ctx, g, a, b, lit) {
    if (a[1] < 4.5) {
      ctx.fillStyle = '#5a4a38';
      deckQuad(ctx, g, a, b, -1.04, 1.04, DECK_RISE * 0.45);
      ctx.fillStyle = '#44382c';
      deckQuad(ctx, g, a, b, -1.02, 1.02, DECK_RISE);
    }
    const boards = 3;
    const inks = lit ? ['#c6b08a', '#d6c29c', '#b8a27c'] : ['#b09b76', '#bea982', '#a18c68'];
    for (let i = 0; i < boards; i++) {
      const from = lerp(-1, 1, i / boards) + 0.04;
      const to = lerp(-1, 1, (i + 1) / boards) - 0.04;
      ctx.fillStyle = inks[i];
      deckQuad(ctx, g, a, b, from, to, DECK_RISE);
    }
  }

  function paintBridge(ctx, g) {
    ctx.fillStyle = '#332a22';
    for (let i = 3; i >= 0; i--) paintPosts(ctx, g, BRIDGE[i]);
    for (let i = BRIDGE.length - 2; i >= 0; i--) {
      paintLeg(ctx, g, BRIDGE[i + 1], BRIDGE[i], i % 2 === 0);
    }
  }

  function paintBridgeReflection(ctx, g) {
    ctx.fillStyle = '#6a5a44';
    for (let i = 0; i < BRIDGE.length - 1; i++) {
      deckQuad(ctx, g, BRIDGE[i + 1], BRIDGE[i], -1, 1, -DECK_RISE * 1.3);
    }
  }

  // Far bank of irises: a band of leaf strokes with flowers massed in colour drifts.
  function paintFarDrifts(ctx, g, rand) {
    const y0 = shoreY(g);
    const inks = ['#4f7d55', '#3f6a4c', '#689060'];
    for (let i = 0; i < g.W * 3; i++) {
      const d = rand();
      const y = y0 + g.U * (0.3 + d * d * 8);
      ctx.fillStyle = inks[Math.floor(rand() * inks.length)];
      ctx.fillRect(rand() * g.W, y - g.U * (0.8 + d * 2), 1, g.U * (0.8 + d * 2));
    }
    const drifts = Math.ceil(g.W / (g.U * 11));
    for (let i = 0; i < drifts; i++) {
      const tone = TONES[i % 3 === 1 ? 'white' : i % 3 === 2 ? 'lilac' : 'purple'];
      const cx = ((i + 0.5 + (rand() - 0.5) * 0.5) / drifts) * g.W;
      for (let j = 0; j < 30; j++) {
        const d = rand();
        const y = y0 + g.U * (0.2 + d * d * 6);
        const s = Math.max(1, g.U * (0.5 + d * 0.7));
        const spread = (rand() + rand() - 1) * g.U * 11;
        ctx.fillStyle = rand() < 0.75 ? tone.body : tone.rim;
        ctx.fillRect(cx + spread, y - g.U * (1 + d), s * (0.7 + rand()), s);
      }
    }
  }

  function buildClumps(g, rand) {
    const cx = g.W / 2;
    const u = g.U;
    const specs = MIDDLE.map((m, i) => ({
      x: cx + m[0] * u * state.squeeze, foot: m[1] * u, h: m[2] * u, tones: [m[3], m[4], m[3]], pattern: i,
    }));
    const rows = [[60, 22], [44, 14], [78, 36], [38, 9]];
    let n = 0;
    for (let d = 84; cx - d * u > -u * 16; d += 21) {
      for (const side of [-1, 1]) {
        const [foot, h] = rows[n % rows.length];
        specs.push({ x: cx + side * d * u, foot: foot * u, h: h * u, tones: n % 3 ? ['purple', 'indigo'] : ['white', 'lilac'], pattern: n });
        n++;
      }
    }
    return specs.map((s) => makeClump(rand, s));
  }

  function buildHeroes(g, rand) {
    const u = g.U;
    const reach = Math.min(g.W * 0.33, u * 62);
    return [
      makeClump(rand, { x: g.W / 2 + reach, foot: u * 90, h: u * 64, tones: ['white', 'white', 'lilac', 'white', 'purple', 'white', 'white'], pattern: 1 }),
      makeClump(rand, { x: g.W / 2 - reach, foot: u * 84, h: u * 66, tones: ['purple', 'indigo', 'purple', 'white', 'purple', 'purple', 'indigo'], pattern: 0 }),
    ];
  }

  function paintFarReflection(ctx, g) {
    const y0 = shoreY(g);
    ctx.save();
    ctx.setTransform(1, 0, 0, -0.9, 0, y0 * 1.9);
    ctx.drawImage(state.treeline, 0, 0, g.W, y0, 0, 0, g.W, y0);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (const f of [0.3, 0.6]) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, y0 + g.U * 16 * f, g.W, g.H);
    }
    ctx.globalAlpha = 1;
    ctx.fillRect(0, y0 + g.U * 16, g.W, g.H);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#4f7468';
    ctx.fillRect(0, y0, g.W, g.H);
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintReflections(g, clumps, heroes) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarReflection(ctx, g);
    paintBridgeReflection(ctx, g);
    for (const clump of [...clumps, ...heroes]) {
      ctx.save();
      ctx.setTransform(1, 0, 0, -0.82, 0, clump.foot * 1.82);
      paintClump(ctx, g, clump);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, shoreY(g), g.W, g.H);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function makeStrips(g) {
    const y0 = Math.floor(shoreY(g));
    const step = Math.max(2, Math.ceil((g.H - y0) / 64));
    const ys = [];
    for (let y = y0; y < g.H; y += step) ys.push(y);
    const amps = new Float32Array(ys.length);
    ys.forEach((y, i) => { amps[i] = g.U * lerp(0.25, 1.5, (y - y0) / (g.H - y0)); });
    return { ys: Float32Array.from(ys), amps, step };
  }

  function makeRipples(g, rand) {
    const y0 = shoreY(g);
    const list = [];
    for (let i = 0; i < RIPPLES; i++) {
      const f = 0.08 + rand() * rand() * 0.92;
      list.push({ x: rand() * g.W, y: y0 + (g.H - y0) * f, r: g.U * (2 + f * 7), rate: 0.2 + rand() * 0.16, start: rand() });
    }
    return list;
  }

  function makeRain(g, rand) {
    const xs = new Float32Array(RAIN);
    const ys = new Float32Array(RAIN);
    const vs = new Float32Array(RAIN);
    for (let i = 0; i < RAIN; i++) {
      xs[i] = rand() * g.W * 1.2;
      ys[i] = rand() * g.H;
      vs[i] = g.U * (42 + rand() * 22);
    }
    return { xs, ys, vs, len: g.U * 3, slant: 0.14 };
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.squeeze = Math.min(1, g.W / (g.U * 150));
    state.spread = Math.max(0.72, state.squeeze);
    state.sprites = {};
    state.world = paintWorld(g, rand);
    state.glints = paintGlints(g);
    const clumps = buildClumps(g, rand).sort((a, b) => a.foot - b.foot);
    state.heroes = buildHeroes(g, rand);
    state.reflection = paintReflections(g, clumps, state.heroes);
    state.overlay = layer(g.W, g.H);
    const octx = state.overlay.getContext('2d');
    paintFarDrifts(octx, g, rand);
    paintBridge(octx, g);
    for (const c of clumps) if (c.h < g.U * 8) paintClump(octx, g, c);
    state.middle = clumps.filter((c) => c.h >= g.U * 8).map((c) => spriteClump(g, c));
    state.strips = makeStrips(g);
    state.ripples = makeRipples(g, rand);
    state.rain = makeRain(g, rand);
  }

  function drawGlints(ctx, g, t) {
    const y0 = shoreY(g);
    const h = g.H - y0;
    const w = g.W * 1.5;
    const a = (t * g.U * 0.7) % w;
    ctx.globalAlpha = 0.8;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(state.glints, -a, y0, w, h);
    ctx.drawImage(state.glints, w - a, y0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
  }

  function drawReflection(ctx, g, t) {
    const { ys, amps, step } = state.strips;
    const src = state.reflection;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      const off = (Math.sin(y * 0.55 / g.U + t * 1.15) + 0.5 * Math.sin(y * 1.3 / g.U - t * 0.8)) * amps[i];
      ctx.drawImage(src, 0, y, g.W, step, Math.round(off), y, g.W, step);
    }
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t, amount) {
    if (amount <= 0.01) return;
    ctx.strokeStyle = '#d9e6e0';
    ctx.lineWidth = 1;
    for (const r of state.ripples) {
      const life = (t * r.rate + r.start) % 1;
      ctx.globalAlpha = Math.min(0.75, (1 - life) * (1 - life) * amount);
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 0.5 + r.r * life, 0.4 + r.r * life * 0.34, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMiddle(ctx, g, t, breeze) {
    for (const c of state.middle) {
      const a = swing(t, c.phase) * 0.028 * breeze;
      const b = swing(t * 1.12, c.phase + 1.4) * 0.024 * breeze;
      ctx.setTransform(1, 0, a, 1, c.x, c.foot);
      ctx.drawImage(c.blades, -c.ax, -c.ay);
      ctx.setTransform(1, 0, b, 1, c.x, c.foot);
      ctx.drawImage(c.heads, -c.ax, -c.ay);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawHero(ctx, g, c, t, breeze) {
    drawBlades(ctx, c.back, c.x, c.foot, t, breeze);
    drawBlooms(ctx, g, c, t, breeze);
    drawBlades(ctx, c.front, c.x, c.foot, t, breeze);
  }

  function drawRain(ctx, g, t, amount) {
    const n = Math.floor(RAIN * Math.min(1, amount));
    if (!n) return;
    const { xs, ys, vs, len, slant } = state.rain;
    const span = g.H + len;
    ctx.strokeStyle = '#e4ece6';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const y = (ys[i] + t * vs[i]) % span;
      const x = (xs[i] - y * slant) % (g.W * 1.2);
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * slant, y + len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function wing(ctx, u, dir, flap) {
    ctx.fillStyle = '#d9843c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(dir * u * 3.2 * flap, -u * 3.4, dir * u * 3.6 * flap, -u * 1);
    ctx.quadraticCurveTo(dir * u * 2.8 * flap, u * 0.5, 0, 0);
    ctx.fill();
    ctx.fillStyle = '#a8522c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(dir * u * 2.6 * flap, u * 0.4, dir * u * 1.9 * flap, u * 2.2);
    ctx.quadraticCurveTo(dir * u * 0.6 * flap, u * 2, 0, 0);
    ctx.fill();
  }

  function drawButterfly(ctx, g, t, phase) {
    const p = (phase - 0.2) / 0.6;
    if (p <= 0 || p >= 1) return;
    const x = lerp(-g.U * 8, g.W + g.U * 8, p) + Math.sin(t * 0.8) * g.U * 7;
    const y = g.U * (48 + Math.sin(p * 9) * 12 + Math.sin(t * 1.9) * 2.5);
    const flap = 0.3 + 0.7 * Math.abs(Math.sin(t * 7));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.3) * 0.25);
    const u = g.U * 1.5;
    wing(ctx, u, -1, flap);
    wing(ctx, u, 1, flap);
    ctx.fillStyle = '#3a2f24';
    ctx.fillRect(-u * 0.25, -u * 1.1, u * 0.5, u * 2.6);
    ctx.restore();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const breeze = api.props.breeze;
    const phase = (t % CYCLE) / CYCLE;
    const rainy = 0.14 + 0.86 * (0.5 + 0.5 * Math.cos(phase * 6.283));
    const rain = api.props.rain * rainy;
    ctx.drawImage(state.world, 0, 0);
    drawGlints(ctx, g, t);
    drawReflection(ctx, g, t);
    drawRipples(ctx, g, t, Math.min(1.4, rain * 1.3));
    ctx.drawImage(state.overlay, 0, 0);
    drawMiddle(ctx, g, t, breeze);
    for (const c of state.heroes) drawHero(ctx, g, c, t, breeze);
    drawButterfly(ctx, g, t, phase);
    drawRain(ctx, g, t, rain * 0.8);
  }

  Kasuri.run({
    defaults: { breeze: 1, rain: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1.05, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
