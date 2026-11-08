/*
 * 苔 Koke — a deep moss garden just after rain, a lantern, a stone basin, a path.
 *
 * The garden is baked once into two layers, far and near, and tiling mist slides
 * between and over them. Per frame there are only drips, rings on the basin water,
 * small glints on the wet moss and a dozen falling leaves.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, lerp, smoothstep, clamp, parseColor, mixColor, toHex } = K;

  const HAZE = '#c4d0ba';
  const GREENS = [
    ['#2c4e30', '#487830', '#6c9c3c', '#94b850', '#bcd074'],
    ['#2c4e30', '#34683f', '#4c8a54', '#74aa6c', '#a8c888'],
    ['#2c4e30', '#345f52', '#4c7f6c', '#78a088', '#a8c4a4'],
    ['#2c4e30', '#5c642c', '#82843a', '#a8a44e', '#ccc678'],
  ];
  const STONE = { lit: '#c6c4ac', front: '#9e9e8a', shade: '#6a6e60', deep: '#40453b' };
  const LEAF_TONES = ['#c9a24a', '#ad5f3c', '#b08a44', '#9a9a42'];
  const HUES = [0, 1, 0, 1, 3, 1, 1, 0, 2, 1, 0, 1];
  const SKY = ['#84a08a', '#94ac94', '#a2b8a0', '#b0c2ac', '#bccab4'];
  const LANTERN_SCALE = 1.2;
  const BANDS = 3;
  const SPLIT = 0.6;
  const RING_SLOTS = 10;
  const FALL_SLOTS = 18;
  const MAX_LEAVES = 24;
  const GLINTS = 70;
  const FALL_TIME = 0.9;
  const RING_LIFE = 2.8;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Ramps per hue and per depth band; far bands sink into the haze.
  function makeRamps() {
    const haze = parseColor(HAZE);
    return GREENS.map((hue) => {
      const bands = [];
      for (let b = 0; b < BANDS; b++) {
        const amount = (0.5 * (BANDS - 1 - b)) / (BANDS - 1);
        const source = b === 0 || (b === 1 && hue !== GREENS[0]) ? GREENS[1] : hue;
        bands.push(source.map((c) => mixColor(parseColor(c), haze, amount)));
      }
      return bands;
    });
  }

  function bandAt(g, y) {
    const s = clamp((y - g.H * 0.46) / (g.H * 0.42), 0, 1);
    return Math.min(BANDS - 1, Math.floor(s * BANDS));
  }

  // The path as a curve: s runs from the viewer (0) to where it is lost in mist (1).
  function pathPoint(g, s) {
    const y = g.H * lerp(0.96, 0.5, Math.pow(s, 0.72));
    const x = g.W * (0.47 + Math.sin(s * 6.2 + 3.6) * 0.075 * (1 - s * 0.45));
    return { x, y, w: g.U * lerp(12, 2.6, Math.pow(s, 0.62)) };
  }

  function pathNear(g, y) {
    const s = Math.pow(clamp((0.96 - y / g.H) / 0.46, 0, 1), 1 / 0.72);
    return pathPoint(g, s);
  }

  // Flat tones with broken edges, so the haze has no bands and few colours.
  function paintSky(ctx, g) {
    const h = Math.ceil(g.H * 0.64);
    const img = ctx.createImageData(g.W, h);
    const f = 1 / (g.U * 13);
    const rgb = SKY.map(parseColor);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < g.W; x++) {
        const v = y / (g.H * 0.56) + (fbm(x * f, y * f * 1.3, 2, 51) - 0.5) * 0.3;
        fillRamp(img.data, (y * g.W + x) * 4, rgb[clamp(Math.floor(v * SKY.length), 0, SKY.length - 1)]);
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = HAZE;
    ctx.fillRect(0, h, g.W, g.H - h);
  }

  function paintTrunk(ctx, g, t) {
    const u = g.U;
    const lean = t.lean * u;
    ctx.fillStyle = t.tone;
    ctx.beginPath();
    ctx.moveTo(t.x - t.w * 0.42 + lean, -u);
    ctx.lineTo(t.x + t.w * 0.42 + lean, -u);
    ctx.lineTo(t.x + t.w * 0.55, t.y - u * 4);
    ctx.quadraticCurveTo(t.x + t.w * 0.65, t.y, t.x + t.w * 1.25, t.y + u);
    ctx.lineTo(t.x - t.w * 1.25, t.y + u);
    ctx.quadraticCurveTo(t.x - t.w * 0.65, t.y, t.x - t.w * 0.55, t.y - u * 4);
    ctx.fill();
    if (t.w < u * 2) return;
    const rand = K.rng(t.seed);
    ctx.fillStyle = t.light;
    ctx.fillRect(t.x - t.w * 0.42 + lean * 0.5, 0, Math.max(1, t.w * 0.26), t.y);
    ctx.fillStyle = t.dark;
    for (let i = 0; i < t.y / (u * 1.1); i++) {
      const y = rand() * t.y;
      const f = 1 - y / t.y;
      ctx.fillRect(t.x + (rand() - 0.3) * t.w * 0.7 + lean * f, y, Math.max(1, u * 0.4), u * (1.5 + rand() * 4));
    }
    paintTrunkMoss(ctx, g, rand, t);
  }

  function paintTrunkMoss(ctx, g, rand, t) {
    const u = g.U;
    const rise = u * (9 + t.w);
    const tones = GREENS[1];
    for (let i = 0; i < rise * t.w * 0.4; i++) {
      const f = Math.pow(rand(), 1.6);
      ctx.fillStyle = tones[1 + Math.floor(rand() * 4)];
      const size = Math.max(1, u * 0.5);
      ctx.fillRect(t.x + (rand() - 0.5) * t.w * lerp(1.5, 0.9, f), t.y - f * rise, size, size);
    }
  }

  function makeTrunks(g, rand) {
    const list = [];
    const add = (f, y, w, lean, tone, light, dark) => {
      list.push({ kind: 'trunk', x: g.W * f, y: g.H * y, w: g.U * w, lean: (rand() - 0.5) * lean, tone, light, dark, seed: 1 + rand() * 9999 });
    };
    for (const f of [0.03, 0.135, 0.2, 0.345, 0.385, 0.475, 0.555, 0.615, 0.67, 0.775, 0.84, 0.965]) {
      add(f, 0.5, 1.1 + rand() * 0.7, 3, '#8fa292', '#a3b4a1', '#7f9383');
    }
    for (const f of [0.115, 0.37, 0.64, 0.81]) {
      add(f, 0.56 + rand() * 0.03, 2.2 + rand() * 0.7, 4, '#5e6f5f', '#76876f', '#4d5d50');
    }
    add(0.05, 0.78, 4.4, 5, '#4a4436', '#7a6e52', '#37342a');
    add(0.585, 0.62, 3.4, 4, '#4a4436', '#7a6e52', '#37342a');
    add(0.935, 0.72, 4, 5, '#4a4436', '#7a6e52', '#37342a');
    return list;
  }

  function fillRamp(d, i, rgb) {
    d[i] = rgb[0];
    d[i + 1] = rgb[1];
    d[i + 2] = rgb[2];
    d[i + 3] = 255;
  }

  // One cushion, shaded as a dome lit from upper left, broken up by clumpy noise.
  function paintCushion(ctx, g, c) {
    const under = c.ry * 0.2;
    const bw = Math.ceil(c.rx * 2) + 2;
    const bh = Math.ceil(c.ry * 1.25 + under) + 2;
    const tmp = layer(bw, bh);
    const tc = tmp.getContext('2d');
    const img = tc.createImageData(bw, bh);
    const band = bandAt(g, c.y);
    const ramp = state.ramps[c.hue][band];
    const brightest = 3 + Math.min(band, 1);
    const fine = 1 / (g.U * 0.75);
    const lump = 1 / (g.U * 4.5);
    const baseRow = bh - under - 1;
    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        const dx = (px - bw / 2) / c.rx;
        const across = 1 - dx * dx;
        if (across <= 0) continue;
        const dy = (baseRow - py) / c.ry;
        const wob = 1 + (noise2(px * lump, c.seed, 3) - 0.5) * 0.24;
        const top = Math.pow(across, 0.46) * wob;
        if (dy > top || dy < -0.2 * Math.sqrt(across)) continue;
        const v = clamp(dy / top, 0, 1);
        const wx = px + c.x;
        const wy = py + c.y;
        const clump = fbm(wx * fine, wy * fine * 1.5, 2, 11) - 0.5;
        const swell = noise2(wx * lump, wy * lump * 1.6, 5) - 0.5;
        const shade = 0.15 + c.lift + Math.pow(v, 1.25) * 0.74 - dx * 0.26 * v + clump * 0.52 + swell * 0.24;
        fillRamp(img.data, (py * bw + px) * 4, ramp[clamp(Math.floor(shade * 5), 0, brightest)]);
      }
    }
    tc.putImageData(img, 0, 0);
    ctx.drawImage(tmp, c.x - bw / 2, c.y - baseRow);
  }

  // Low, damp moss everything else sits on. Its far edge is broken by noise.
  function paintGround(ctx, g, top) {
    const h = Math.ceil(g.H - top);
    const tmp = layer(g.W, h);
    const tc = tmp.getContext('2d');
    const img = tc.createImageData(g.W, h);
    const fine = 1 / (g.U * 0.7);
    const wide = 1 / (g.U * 9);
    for (let py = 0; py < h; py++) {
      const y = py + top;
      for (let px = 0; px < g.W; px++) {
        const edge = (fbm(px * wide * 0.7, 2, 2, 9) - 0.5) * g.U * 11 + g.U * 4;
        if (py < edge) continue;
        const v = fbm(px * fine, y * fine * 1.5, 2, 21) - 0.5;
        const w = noise2(px * wide, y * wide * 1.8, 23) - 0.5;
        const shade = 0.42 + v * 0.8 + w * 0.5;
        const ramp = state.ramps[w > 0 ? 1 : 0][bandAt(g, y)];
        fillRamp(img.data, (py * g.W + px) * 4, ramp[clamp(Math.floor(shade * 5), 0, 3)]);
      }
    }
    tc.putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, top);
  }

  function makeCushions(g, rand, keepOut) {
    const list = [];
    let y = g.H * 0.5;
    while (y < g.H * 1.1) {
      const s = clamp((y - g.H * 0.5) / (g.H * 0.5), 0, 1.2);
      const size = g.U * lerp(6.5, 19, Math.pow(s, 1.15));
      let x = -rand() * size;
      while (x < g.W + size) {
        const rx = size * (0.55 + rand() * 0.8);
        const hue = rx > g.U * 11 ? Math.floor(rand() * 2) : HUES[Math.floor(rand() * HUES.length)];
        const ry = rx * (0.46 + rand() * 0.18);
        const c = { kind: 'cushion', x, y: y + (rand() - 0.5) * size * 0.25, rx, ry, hue, lift: rand() * 0.08, seed: rand() * 90 };
        if (placeCushion(g, c, keepOut)) list.push(c);
        x += size * (0.8 + rand() * 0.5);
      }
      y += Math.max(g.U * 2, size * 0.42);
    }
    return list;
  }

  // Moves a cushion off the path, then drops it if its dome would still cover
  // a stepping stone, the lantern or the basin.
  function placeCushion(g, c, keepOut) {
    const near = pathNear(g, c.y);
    const gap = c.rx * 0.6 + near.w * 0.8;
    if (c.y > g.H * 0.5 && Math.abs(c.x - near.x) < gap) {
      c.x = near.x + (c.x < near.x ? -gap : gap);
    }
    return !keepOut.some((k) => coversItem(c, k));
  }

  function coversItem(c, k) {
    if (c.y <= k.y) return false;
    const dx = (clamp(c.x, k.x - k.hw, k.x + k.hw) - c.x) / c.rx;
    if (Math.abs(dx) >= 1) return false;
    const top = c.y - c.ry * 1.15 * Math.pow(1 - dx * dx, 0.46);
    return top < k.y - k.keep;
  }

  function stoneOutline(ctx, seed, x, y, w, h, tone) {
    const rand = K.rng(seed);
    ctx.fillStyle = tone;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283;
      const r = 0.84 + rand() * 0.24;
      const px = x + Math.cos(a) * w * r;
      const py = y + Math.sin(a) * h * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function paintStone(ctx, g, s) {
    const mist = (0.5 * (BANDS - 1 - bandAt(g, s.y))) / (BANDS - 1);
    const tone = (c) => toHex(mixColor(parseColor(c), parseColor(HAZE), mist));
    const h = s.w * 0.36;
    ctx.fillStyle = tone('#2c3d24');
    oval(ctx, s.x, s.y + h * 0.5, s.w * 1.14, h * 1.1);
    stoneOutline(ctx, s.seed, s.x, s.y + h * 0.28, s.w, h, tone('#5a5c50'));
    stoneOutline(ctx, s.seed, s.x, s.y, s.w, h, tone('#a9a892'));
    ctx.fillStyle = tone('#d2d0b8');
    oval(ctx, s.x - s.w * 0.22, s.y - h * 0.3, s.w * 0.52, h * 0.4);
    const rand = K.rng(s.seed + 1);
    ctx.fillStyle = tone('#7d7d6b');
    for (let i = 0; i < s.w * 2.4; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand()) * 0.8;
      ctx.fillRect(s.x + Math.cos(a) * d * s.w, s.y + Math.sin(a) * d * h, Math.max(1, g.U * 0.5), 1);
    }
  }

  function makeStones(g, rand) {
    const list = [];
    let s = 0;
    let side = 1;
    while (s < 1) {
      const p = pathPoint(g, s);
      list.push({ kind: 'stone', x: p.x + side * p.w * 0.28, y: p.y, w: p.w * (0.88 + rand() * 0.2), seed: Math.floor(1 + rand() * 9999) });
      s += lerp(0.17, 0.12, s);
      side = -side;
    }
    return list;
  }

  function oval(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.fill();
  }

  function polygon(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // A six-sided section seen from the front: lit left face, front, shaded right.
  // y0 is the bottom, y1 the top, b and t the half widths there, all in units of u.
  function prism(ctx, x, foot, u, y0, y1, b, t) {
    const bx = (f) => x + f * b * u;
    const tx = (f) => x + f * t * u;
    const low = foot - y0 * u;
    const high = foot - y1 * u;
    ctx.fillStyle = STONE.lit;
    polygon(ctx, [bx(-1), low, bx(-0.5), low, tx(-0.5), high, tx(-1), high]);
    ctx.fillStyle = STONE.front;
    polygon(ctx, [bx(-0.5), low, bx(0.55), low, tx(0.55), high, tx(-0.5), high]);
    ctx.fillStyle = STONE.shade;
    polygon(ctx, [bx(0.55), low, bx(1), low, tx(1), high, tx(0.55), high]);
  }

  function paintLanternRoof(ctx, x, foot, u) {
    const eave = foot - 32.6 * u;
    const peak = foot - 39.6 * u;
    const tip = foot - 34.6 * u;
    ctx.fillStyle = STONE.deep;
    polygon(ctx, [x - 9 * u, eave, x + 9 * u, eave, x + 8 * u, eave + 1.6 * u, x - 8 * u, eave + 1.6 * u]);
    const shape = (fill, a, b) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(x + a * u, eave);
      ctx.lineTo(x + b * u, eave);
      ctx.quadraticCurveTo(x + (b * 0.55 + (b > 0 ? 0.6 : -0.6)) * u, foot - 34.5 * u, x + (b / 13) * 2.2 * u, peak);
      ctx.lineTo(x + (a / 13) * 2.2 * u, peak);
      ctx.quadraticCurveTo(x + (a * 0.55 + (a > 0 ? 0.6 : -0.6)) * u, foot - 34.5 * u, x + a * u, eave);
      ctx.fill();
    };
    shape(STONE.front, -5, 7);
    shape(STONE.lit, -13.2, -5);
    shape(STONE.shade, 7, 13.2);
    ctx.fillStyle = STONE.deep;
    polygon(ctx, [x - 13.2 * u, eave, x + 13.2 * u, eave, x + 13.2 * u, eave + 0.7 * u, x - 13.2 * u, eave + 0.7 * u]);
    ctx.fillStyle = STONE.lit;
    polygon(ctx, [x - 14 * u, tip, x - 13 * u, eave + 0.7 * u, x - 11 * u, eave, x - 12.6 * u, tip + u]);
    ctx.fillStyle = STONE.shade;
    polygon(ctx, [x + 14 * u, tip, x + 13 * u, eave + 0.7 * u, x + 11 * u, eave, x + 12.6 * u, tip + u]);
  }

  function paintLanternTop(ctx, x, foot, u) {
    prism(ctx, x, foot, u, 39.4, 40.6, 2.2, 1.6);
    const cy = foot - 42.8 * u;
    ctx.fillStyle = STONE.front;
    ctx.beginPath();
    ctx.moveTo(x, cy - 3.8 * u);
    ctx.quadraticCurveTo(x + 0.6 * u, cy - 2.2 * u, x + 2.5 * u, cy - 0.4 * u);
    ctx.quadraticCurveTo(x + 2.6 * u, cy + 2 * u, x, cy + 2.2 * u);
    ctx.quadraticCurveTo(x - 2.6 * u, cy + 2 * u, x - 2.5 * u, cy - 0.4 * u);
    ctx.quadraticCurveTo(x - 0.6 * u, cy - 2.2 * u, x, cy - 3.8 * u);
    ctx.fill();
    ctx.fillStyle = STONE.lit;
    oval(ctx, x - 0.9 * u, cy - 0.3 * u, 1.1 * u, 1.5 * u);
    ctx.fillStyle = STONE.shade;
    oval(ctx, x + 1.4 * u, cy + 0.7 * u, 1 * u, 1.3 * u);
  }

  function paintLanternBody(ctx, x, foot, u) {
    prism(ctx, x, foot, u, 0, 2, 9.6, 9.2);
    prism(ctx, x, foot, u, 2, 3.6, 8.4, 4.4);
    prism(ctx, x, foot, u, 3.6, 20, 3.5, 2.9);
    prism(ctx, x, foot, u, 11.2, 12.4, 4.1, 4.1);
    prism(ctx, x, foot, u, 18.8, 20, 3.8, 3.8);
    prism(ctx, x, foot, u, 20, 21.8, 3.2, 6.8);
    prism(ctx, x, foot, u, 21.8, 23.6, 6.8, 6.8);
    prism(ctx, x, foot, u, 23.6, 32.8, 5, 4.6);
    ctx.fillStyle = STONE.deep;
    ctx.fillRect(x - 2.4 * u, foot - 31 * u, 4.8 * u, 6.2 * u);
    ctx.fillRect(x + 3.3 * u, foot - 30.6 * u, 0.9 * u, 5.4 * u);
    ctx.fillStyle = '#b98f46';
    ctx.fillRect(x - 1.8 * u, foot - 30.4 * u, 3.6 * u, 5.2 * u);
  }

  // Bark of age on the lantern: wet streaks, flecks, moss where water sits.
  function ageLantern(ctx, g, x, foot, u, rand) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = STONE.deep;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 26; i++) {
      ctx.fillRect(x + (rand() - 0.5) * 16 * u, foot - (2 + rand() * 40) * u, Math.max(1, u * 0.5), u * (1 + rand() * 4));
    }
    ctx.globalAlpha = 1;
    mossDabs(ctx, g, rand, x, foot - 36 * u, 12 * u, 3 * u, 90);
    mossDabs(ctx, g, rand, x - 2 * u, foot - 34 * u, 11 * u, 1.6 * u, 40);
    mossDabs(ctx, g, rand, x, foot - 2 * u, 9 * u, 2 * u, 60);
    mossDabs(ctx, g, rand, x + 1 * u, foot - 7 * u, 2.6 * u, 2.4 * u, 10);
    mossDabs(ctx, g, rand, x, foot - 22.8 * u, 7 * u, 1 * u, 22);
    ctx.globalCompositeOperation = 'source-over';
  }

  function mossDabs(ctx, g, rand, x, y, rx, ry, count) {
    const tones = GREENS[0];
    const size = Math.max(1, g.U * 0.7);
    for (let i = 0; i < count; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      ctx.fillStyle = tones[1 + Math.floor(rand() * 4)];
      ctx.fillRect(x + Math.cos(a) * d * rx, y + Math.sin(a) * d * ry, size, size);
    }
  }

  function paintLantern(ctx, g, item) {
    const u = g.U * LANTERN_SCALE;
    const w = 32 * u;
    const h = 48 * u;
    const c = layer(w, h);
    const lc = c.getContext('2d');
    const x = w / 2;
    const foot = h - u;
    paintLanternBody(lc, x, foot, u);
    paintLanternRoof(lc, x, foot, u);
    paintLanternTop(lc, x, foot, u);
    ageLantern(lc, g, x, foot, u, K.rng(item.seed));
    ctx.drawImage(c, item.x - x, item.y - foot);
    state.lamp = { x: item.x, y: item.y - 27.8 * u, u };
  }

  function paintBasinBody(ctx, g, b) {
    ctx.fillStyle = '#7f806e';
    ctx.beginPath();
    ctx.moveTo(b.x - b.rx, b.rim);
    ctx.bezierCurveTo(b.x - b.rx * 1.06, b.y - g.U * 4, b.x - b.rx * 0.86, b.y, b.x - b.rx * 0.56, b.y + g.U);
    ctx.lineTo(b.x + b.rx * 0.56, b.y + g.U);
    ctx.bezierCurveTo(b.x + b.rx * 0.86, b.y, b.x + b.rx * 1.06, b.y - g.U * 4, b.x + b.rx, b.rim);
    ctx.fill();
    ctx.save();
    ctx.clip();
    stoneOutline(ctx, b.seed + 3, b.x - b.rx * 0.82, b.rim + g.U * 5, b.rx * 0.5, g.U * 8, '#a2a18c');
    stoneOutline(ctx, b.seed + 4, b.x + b.rx * 0.84, b.rim + g.U * 8, b.rx * 0.56, g.U * 12, '#5c6054');
    const rand = K.rng(b.seed);
    ctx.fillStyle = '#54574b';
    for (let i = 0; i < 70; i++) {
      ctx.fillRect(b.x + (rand() - 0.5) * 2 * b.rx, b.rim + rand() * (b.y - b.rim), Math.max(1, g.U * 1.2), Math.max(1, g.U * 0.5));
    }
    mossDabs(ctx, g, rand, b.x - b.rx * 0.5, b.y - g.U * 1.5, b.rx * 0.6, g.U * 3.5, 130);
    mossDabs(ctx, g, rand, b.x + b.rx * 0.55, b.y - g.U, b.rx * 0.4, g.U * 3, 80);
    ctx.restore();
  }

  function paintBasinWater(ctx, g, b) {
    const w = state.water;
    stoneOutline(ctx, b.seed + 5, b.x, b.rim, b.rx, b.ry, '#b0af99');
    stoneOutline(ctx, b.seed + 5, b.x, b.rim + g.U * 0.5, b.rx * 0.9, b.ry * 0.82, '#3f463e');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, 6.3);
    ctx.clip();
    ctx.fillStyle = '#a4c0b4';
    ctx.fillRect(w.x - w.rx, w.y - w.ry, w.rx * 2, w.ry * 2);
    ctx.fillStyle = '#6c9490';
    oval(ctx, w.x, w.y + w.ry * 0.3, w.rx * 1.1, w.ry);
    ctx.fillStyle = '#4c7078';
    oval(ctx, w.x, w.y + w.ry * 0.62, w.rx * 1.1, w.ry);
    ctx.restore();
    const rand = K.rng(b.seed + 2);
    mossDabs(ctx, g, rand, b.x + b.rx * 0.66, b.rim + b.ry * 0.55, b.rx * 0.2, g.U * 1.2, 24);
    mossDabs(ctx, g, rand, b.x - b.rx * 0.78, b.rim - b.ry * 0.2, b.rx * 0.14, g.U * 1.6, 20);
    ctx.fillStyle = '#7d7d6b';
    for (let i = 0; i < 40; i++) {
      const a = rand() * 6.283;
      ctx.fillRect(b.x + Math.cos(a) * b.rx * 0.95, b.rim + Math.sin(a) * b.ry * 0.93, Math.max(1, g.U * 0.8), 1);
    }
  }

  function makeBasin(g) {
    const u = g.U;
    const x = g.W * 0.765;
    const y = g.H * 0.93;
    const rx = u * 25;
    const ry = u * 11;
    const rim = y - u * 13;
    state.water = { x, y: rim + u, rx: rx * 0.8, ry: ry * 0.66 };
    return { kind: 'basin', x, y, rx, ry, rim, seed: 77 };
  }

  function paintItem(ctx, g, item) {
    if (item.kind === 'cushion') paintCushion(ctx, g, item);
    else if (item.kind === 'trunk') paintTrunk(ctx, g, item);
    else if (item.kind === 'stone') paintStone(ctx, g, item);
    else if (item.kind === 'lantern') paintLantern(ctx, g, item);
    else {
      paintBasinBody(ctx, g, item);
      paintBasinWater(ctx, g, item);
    }
  }

  // Hanging clumps of leaves, so the trunks go up into something.
  function paintCanopy(ctx, g, rand, tones, depth) {
    const u = g.U;
    const size = Math.max(1, u * 0.8);
    const clumps = Math.ceil(g.W / (u * 8));
    for (let i = 0; i < clumps; i++) {
      const cx = (i + rand()) * u * 8;
      const cy = rand() * depth * u;
      const rx = u * (6 + rand() * 9);
      const ry = u * (2 + rand() * 3);
      for (let k = 0; k < (rx * ry) / (size * size) * 1.1; k++) {
        const a = rand() * 6.283;
        const d = Math.sqrt(rand());
        const y = Math.sin(a) * d;
        ctx.fillStyle = tones[clamp(Math.floor((y + 1) * 0.5 * tones.length + rand() - 0.5), 0, tones.length - 1)];
        ctx.fillRect(cx + Math.cos(a) * d * rx, cy + y * ry, size, size);
      }
    }
  }

  function paintLitter(ctx, g, rand, cushions) {
    for (let i = 0; i < 34; i++) {
      const p = mossPoint(g, rand, cushions);
      ctx.fillStyle = LEAF_TONES[Math.floor(rand() * LEAF_TONES.length)];
      ctx.fillRect(p.x, p.y, Math.max(1, g.U * 0.9), Math.max(1, g.U * 0.5));
    }
  }

  // A point on the visible top of some near cushion, clear of the lantern and basin.
  function mossPoint(g, rand, cushions) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 14; tries++) {
      const c = cushions[Math.floor(rand() * cushions.length)];
      const dx = (rand() - 0.5) * 1.4;
      x = c.x + dx * c.rx;
      y = c.y - c.ry * Math.sqrt(1 - dx * dx) * (0.75 + rand() * 0.2);
      const clearLantern = Math.abs(x - state.lanternX) > g.U * 14;
      const clearBasin = Math.abs(x - state.water.x) > g.U * 28;
      if (clearLantern && clearBasin) break;
    }
    return { x, y };
  }

  function paintGarden(g, rand) {
    const u = g.U;
    const lanternX = g.W * 0.255;
    const lanternY = g.H * 0.7;
    state.lanternX = lanternX;
    const basin = makeBasin(g);
    const keepOut = [
      { x: lanternX, y: lanternY, hw: u * 11, keep: u * 1.5 },
      { x: basin.x, y: basin.y, hw: basin.rx * 0.85, keep: u * 3 },
    ];
    const stones = makeStones(g, rand);
    for (const s of stones) keepOut.push({ x: s.x, y: s.y, hw: s.w * 0.85, keep: -s.w * 0.2 });
    const cushions = makeCushions(g, rand, keepOut);
    const mound = { kind: 'cushion', x: lanternX, y: lanternY + u * 2.5, rx: u * 21, ry: u * 6, hue: 1, lift: 0.08, seed: 12, sort: lanternY - 1 };
    const lantern = { kind: 'lantern', x: lanternX, y: lanternY, seed: 31 };
    const anchors = [
      { kind: 'cushion', x: g.W * 0.1, y: g.H * 1.04, rx: u * 36, ry: u * 21, hue: 0, lift: 0.03, seed: 5 },
      { kind: 'cushion', x: g.W * 0.22, y: g.H * 1.1, rx: u * 24, ry: u * 15, hue: 1, lift: 0.04, seed: 8 },
      { kind: 'cushion', x: g.W * 1.0, y: g.H * 1.05, rx: u * 25, ry: u * 19, hue: 1, lift: 0.03, seed: 17 },
    ];
    const items = [...makeTrunks(g, rand), ...cushions, ...anchors, ...stones, mound, lantern, basin];
    items.sort((a, b) => (a.sort || a.y) - (b.sort || b.y));
    const back = layer(g.W, g.H);
    const front = layer(g.W, g.H);
    const bc = back.getContext('2d');
    const fc = front.getContext('2d');
    paintSky(bc, g);
    paintCanopy(bc, g, rand, ['#8aa58f', '#7b9a84', '#6f8f79'], 16);
    paintGround(bc, g, g.H * 0.46);
    paintGround(fc, g, g.H * SPLIT);
    for (const item of items) paintItem((item.sort || item.y) < g.H * SPLIT ? bc : fc, g, item);
    paintCanopy(fc, g, rand, ['#6e8a4c', '#5f7d48', '#4f6d40', '#3f5a3a'], 5);
    const near = cushions.filter((c) => c.y > g.H * 0.66);
    paintLitter(fc, g, rand, near);
    state.back = back;
    state.front = front;
    state.near = near;
  }

  // Soft banks of mist baked small and scaled up; the two ends meet, so it tiles.
  function paintMist(w, h, seed, stretch) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const fx = stretch / w;
    const fy = 7 / h;
    const density = (x, y) => fbm(x * fx, y * fy, 3, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const a = smoothstep(0.34, 0.74, v) * band * band;
        const i = (y * w + x) * 4;
        img.data[i] = 208;
        img.data[i + 1] = 220;
        img.data[i + 2] = 200;
        img.data[i + 3] = (Math.round(a * 5) / 5) * 205;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeMovers(g, rand) {
    for (const key of ['gx', 'gy', 'gp']) state[key] = new Float32Array(GLINTS);
    for (let i = 0; i < GLINTS; i++) {
      const p = mossPoint(g, rand, state.near);
      state.gx[i] = p.x;
      state.gy[i] = p.y;
      state.gp[i] = rand() * 6.28;
    }
    for (const key of ['lx', 'ly', 'lv', 'lp', 'ls']) state[key] = new Float32Array(MAX_LEAVES);
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, i, true);
  }

  function resetLeaf(g, i, anywhere) {
    const r = state.rand;
    state.lx[i] = r() * g.W;
    state.ly[i] = anywhere ? r() * g.H * 0.9 : -g.U * 3;
    state.lv[i] = g.U * (3 + r() * 3);
    state.lp[i] = r() * 6.28;
    state.ls[i] = g.U * (1.5 + r() * 1.1);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.ramps = makeRamps();
    paintGarden(g, rand);
    const tw = Math.ceil(g.W * 0.5);
    state.mistFar = paintMist(tw, Math.ceil(g.H * 0.18), 61, 6);
    state.mistNear = paintMist(tw, Math.ceil(g.H * 0.06), 83, 8);
    makeMovers(g, rand);
  }

  // The textures are baked at a third of their size; scaling up keeps them soft.
  function slideMist(ctx, tex, y, rate, t, alpha) {
    if (alpha <= 0) return;
    const w = tex.width * 3;
    const h = tex.height * 3;
    const x = -((t * rate) % w);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(tex, x, y, w, h);
    ctx.drawImage(tex, x + w, y, w, h);
    ctx.globalAlpha = 1;
  }

  function drawDrip(ctx, g, x, y, grow) {
    ctx.fillStyle = '#eef3e2';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y - g.U * (1 + grow * 2.4), Math.max(1, g.U * 0.5), g.U * (1 + grow * 2.4));
    ctx.globalAlpha = 1;
  }

  // Each slot drops one drip per cycle at a place hashed from the cycle number.
  function dripSpot(w, clock, cycle, i) {
    const n = Math.floor(clock / cycle);
    const a = K.hash2(n, i, 3) * 6.283;
    const d = Math.sqrt(K.hash2(n, i, 4)) * 0.74;
    state.spotX = w.x + Math.cos(a) * d * w.rx;
    state.spotY = w.y + Math.sin(a) * d * w.ry;
  }

  function drawRings(ctx, g, t, count) {
    const w = state.water;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, 6.3);
    ctx.clip();
    ctx.strokeStyle = '#f2f6e8';
    for (let i = 0; i < count; i++) {
      const cycle = 3.8 + ((i * 0.77) % 2.4);
      const clock = t + i * 1.37;
      const age = (clock % cycle - FALL_TIME) / RING_LIFE;
      if (age < 0 || age >= 1) continue;
      dripSpot(w, clock, cycle, i);
      strokeRing(ctx, g, state.spotX, state.spotY, age, w, 0.85);
      if (age > 0.3) strokeRing(ctx, g, state.spotX, state.spotY, age - 0.3, w, 0.55);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBasinDrips(ctx, g, t, count) {
    const w = state.water;
    for (let i = 0; i < count; i++) {
      const cycle = 3.8 + ((i * 0.77) % 2.4);
      const clock = t + i * 1.37;
      const tau = clock % cycle;
      if (tau >= FALL_TIME) continue;
      dripSpot(w, clock, cycle, i);
      const f = tau / FALL_TIME;
      drawDrip(ctx, g, state.spotX, state.spotY * f * f, f);
    }
  }

  function strokeRing(ctx, g, x, y, age, w, strength) {
    const r = Math.max(0.5, age * w.rx * 0.62);
    ctx.globalAlpha = (1 - age) * strength;
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    ctx.ellipse(x, y, r, (r * w.ry) / w.rx, 0, 0, 6.3);
    ctx.stroke();
  }

  function drawMossDrips(ctx, g, t, drips) {
    const count = Math.min(FALL_SLOTS, Math.round(9 * drips));
    for (let i = 0; i < count; i++) {
      const cycle = 2.6 + ((i * 1.3) % 3.1);
      const clock = t + i * 2.11;
      const n = Math.floor(clock / cycle);
      const tau = clock % cycle;
      const land = g.H * (0.56 + K.hash2(n, i, 7) * 0.4);
      const x = K.hash2(n, i, 8) * g.W;
      if (tau < FALL_TIME) {
        const f = tau / FALL_TIME;
        drawDrip(ctx, g, x, land * f * f, f);
      } else if (tau < FALL_TIME + 0.45) {
        ctx.fillStyle = '#eef3e2';
        ctx.globalAlpha = 0.7 * (1 - (tau - FALL_TIME) / 0.45);
        const spread = g.U * (1 + (tau - FALL_TIME) * 5);
        ctx.fillRect(x - spread, land - g.U * 0.3, spread * 2, Math.max(1, g.U * 0.5));
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawGlints(ctx, g, t) {
    const size = Math.max(1, g.U * 0.6);
    ctx.fillStyle = '#f0f4dc';
    for (let i = 0; i < GLINTS; i++) {
      const a = Math.sin(t * 0.5 + state.gp[i]);
      if (a < 0.4) continue;
      ctx.globalAlpha = (a - 0.4) * 1.4;
      ctx.fillRect(state.gx[i], state.gy[i], size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t, dt, amount) {
    const count = Math.min(MAX_LEAVES, Math.round(12 * amount));
    for (let i = 0; i < count; i++) {
      state.ly[i] += state.lv[i] * dt;
      if (state.ly[i] > g.H * (0.8 + (i % 5) * 0.04)) resetLeaf(g, i, false);
      const p = state.lp[i];
      const x = state.lx[i] + Math.sin(t * 0.5 + p) * g.U * 5;
      const y = state.ly[i];
      const a = Math.sin(t * 0.7 + p) * 1.3;
      const s = state.ls[i];
      const wide = (0.25 + Math.abs(Math.sin(t * 1.1 + p)) * 0.5) * s;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      ctx.fillStyle = LEAF_TONES[i % LEAF_TONES.length];
      ctx.beginPath();
      ctx.moveTo(x - cs * s, y - sn * s);
      ctx.lineTo(x - sn * wide, y + cs * wide);
      ctx.lineTo(x + cs * s, y + sn * s);
      ctx.lineTo(x + sn * wide, y - cs * wide);
      ctx.fill();
    }
  }

  function drawLamp(ctx, g, t) {
    const l = state.lamp;
    ctx.fillStyle = '#e8c070';
    ctx.globalAlpha = 0.28 + 0.14 * Math.sin(t * 0.6);
    ctx.fillRect(l.x - l.u * 1.8, l.y - l.u * 2.6, l.u * 3.6, l.u * 5.2);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.drawImage(state.back, 0, 0);
    slideMist(ctx, state.mistFar, g.H * 0.2, g.U * 1.3, t, 0.72 * p.mist);
    ctx.drawImage(state.front, 0, 0);
    drawLamp(ctx, g, t);
    slideMist(ctx, state.mistNear, g.H * 0.46, g.U * 2.2, t + 40, 0.28 * p.mist);
    const rings = Math.min(RING_SLOTS, Math.round(5 * p.drips));
    drawRings(ctx, g, t, rings);
    drawBasinDrips(ctx, g, t, rings);
    drawGlints(ctx, g, t);
    drawMossDrips(ctx, g, t, p.drips);
    drawLeaves(ctx, g, t, dt, p.leaves);
  }

  Kasuri.run({
    defaults: { drips: 1, mist: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
