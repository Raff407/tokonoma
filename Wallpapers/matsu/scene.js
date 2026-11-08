/*
 * 松 Matsu — one huge pine leaning from a sea cliff over a pale sea and islands.
 *
 * Sky, islands, cliff and trunk are baked once. Limbs are a few dozen strokes and
 * each foliage pad is two small sprites that follow its limb in the wind, so a
 * frame is some drawImage calls, sliding mist tiles and a handful of foam paths.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const HORIZON = 0.6;
  const SKY = ['#7f9bae', '#a3b8bf', '#cfd6cb', '#ece6d2'];
  const SEA = ['#d8dccd', '#b2c4c1', '#8fabb0', '#6f8f9b'];
  const ROCK = ['#2f3539', '#434b4d', '#5e645e', '#858470'];
  const FOAM = '#f4f2e8';
  const BARK = '#231f1f';
  const BARK_LIT = '#634a35';
  const NEEDLE = { dark: '#1a2622', mid: '#2c4434', light: '#56733f', tip: '#92a35a' };

  // Cliff outline as fractions of the canvas, top edge first, then the seaward drop.
  const CLIFF = [
    [0, 0.6], [0.06, 0.585], [0.13, 0.615], [0.2, 0.635], [0.27, 0.645], [0.31, 0.675],
    [0.325, 0.72], [0.31, 0.77], [0.335, 0.82], [0.355, 0.875], [0.345, 0.92], [0.385, 0.97], [0.4, 1.03],
  ];
  const CLIFF_TOP = 6;
  // Sea rocks: x, waterline y, width, height, and how flat-topped and lopsided.
  const ROCKS = [
    [0.435, 0.93, 15, 12, 0.3, 0.3], [0.535, 0.985, 27, 15, 0.45, -0.4],
    [0.605, 0.885, 8, 6, 0.5, 0.2], [0.7, 0.96, 12, 7, 0.6, 0.5],
  ];
  const ISLANDS = [
    { y: 0.602, colour: '#a7b6bb', list: [[0.46, 30, 9], [0.67, 44, 14], [0.92, 38, 11]] },
    { y: 0.622, colour: '#7f959e', list: [[0.56, 26, 11], [0.83, 40, 17]] },
    { y: 0.66, colour: '#567080', list: [[0.71, 24, 13], [0.99, 36, 18]] },
  ];

  // The tree, in units of g.S from the root, y going up as negative.
  const TRUNK = [[0, 0], [-2.5, -8], [0, -16], [8, -22], [19, -25], [27, -31], [27, -39], [29, -45]];
  const LIMBS = [
    { w: [3.8, 0.7], pts: [[18, -25], [34, -25], [52, -21], [72, -22], [90, -18], [105, -20]] },
    { w: [2.8, 0.6], pts: [[27, -35], [40, -39], [54, -37], [68, -40], [86, -39]] },
    { w: [2.8, 0.6], pts: [[5, -20], [15, -14], [27, -10], [42, -10], [55, -7]] },
    { w: [2.6, 0.6], pts: [[-1, -13], [-10, -21], [-20, -21], [-28, -25]] },
    { w: [2.2, 0.5], pts: [[27, -40], [16, -44], [6, -43], [-4, -46]] },
    { w: [1.8, 0.5], pts: [[28, -44], [38, -48], [50, -48]] },
    { w: [2.0, 0.7], pts: [[29, -44], [31, -49], [33, -53]] },
  ];
  // limb, centre x, centre y, width, height, behind the trunk.
  const PADS = [
    [0, 40, -29, 30, 7, true], [0, 62, -26, 34, 7.5], [0, 86, -23.5, 30, 6.5], [0, 105, -22.5, 16, 4.5],
    [1, 50, -42, 26, 6], [1, 71, -44, 28, 6], [1, 88, -42, 14, 4],
    [2, 22, -15.5, 22, 5], [2, 39, -14.5, 26, 6], [2, 56, -10.5, 16, 4.5],
    [3, -12, -25.5, 20, 5.5], [3, -27, -28.5, 16, 4.5],
    [4, 11, -48, 26, 6.5], [4, -5, -49.5, 16, 4.5],
    [5, 48, -52, 22, 5.5],
    [6, 32, -56, 30, 7.5],
  ];
  const CRESTS = 14;
  const GLINTS = 44;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function spline(pts, perSegment) {
    const out = [];
    const at = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
    for (let i = 0; i < pts.length - 1; i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      for (let k = 0; k < perSegment; k++) {
        const s = k / perSegment;
        const c = (a, b, d, e) => 0.5 * (2 * b + (d - a) * s + (2 * a - 5 * b + 4 * d - e) * s * s + (3 * b - a - 3 * d + e) * s * s * s);
        out.push({ x: c(p0[0], p1[0], p2[0], p3[0]), y: c(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    const last = pts[pts.length - 1];
    out.push({ x: last[0], y: last[1] });
    return out;
  }

  function ramp(stops, f) {
    const v = Math.max(0, Math.min(0.9999, f)) * (stops.length - 1);
    const i = Math.floor(v);
    return K.toHex(K.mixColor(K.parseColor(stops[i]), K.parseColor(stops[i + 1]), v - i));
  }

  // ---- far world: stepped sky, sun, islands in layered mist, the sea underneath

  function paintBands(ctx, g, stops, y0, y1, steps, curve) {
    for (let i = 0; i < steps; i++) {
      const a = y0 + (y1 - y0) * Math.pow(i / steps, curve);
      const b = y0 + (y1 - y0) * Math.pow((i + 1) / steps, curve);
      ctx.fillStyle = ramp(stops, i / (steps - 1));
      ctx.fillRect(0, Math.floor(a), g.W, Math.ceil(b - a) + 1);
    }
  }

  function paintSun(ctx, g) {
    const x = g.W * 0.8;
    const y = g.H * 0.21;
    const r = g.S * 11;
    ctx.fillStyle = '#c75f46';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#b9cac6';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x - r * 1.6, y + r * 0.35, r * 3.2, Math.max(1, g.U * 0.9));
    ctx.fillRect(x - r * 1.2, y + r * 0.62, r * 2.8, Math.max(1, g.U * 1.3));
    ctx.globalAlpha = 1;
    state.sun = { x, y, r };
  }

  function paintIsland(ctx, g, item, baseY, colour, seed) {
    const [fx, w, h] = item;
    const cx = g.W * fx;
    const width = w * g.U;
    const steps = Math.max(10, Math.ceil(width));
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(cx - width / 2, baseY);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const env = Math.pow(Math.sin(u * Math.PI), 0.55);
      const rough = 0.4 + 1.05 * fbm(u * 5 + seed, seed * 0.7, 3, 11);
      ctx.lineTo(cx - width / 2 + u * width, baseY - h * g.U * env * rough);
    }
    ctx.lineTo(cx + width / 2, baseY);
    ctx.fill();
  }

  function paintIslandRow(ctx, g, row, index) {
    const baseY = g.H * row.y;
    row.list.forEach((item, i) => paintIsland(ctx, g, item, baseY + g.U, row.colour, index * 3.1 + i * 1.7 + 2));
    const top = baseY - g.U * 5;
    const bottom = baseY + g.U * 5;
    const haze = ctx.createLinearGradient(0, top, 0, bottom);
    haze.addColorStop(0, 'rgba(226,224,208,0)');
    haze.addColorStop(0.55, 'rgba(226,224,208,0.86)');
    haze.addColorStop(1, 'rgba(226,224,208,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, top, g.W, bottom - top);
  }

  function paintBack(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const horizon = g.H * HORIZON;
    paintBands(ctx, g, SKY, 0, horizon, 18, 0.8);
    paintSun(ctx, g);
    paintBands(ctx, g, SEA, horizon, g.H, 14, 1.2);
    ISLANDS.forEach((row, i) => paintIslandRow(ctx, g, row, i));
    return c;
  }

  function seaMarks(ctx, g, rand, w, h, n, seed) {
    for (let i = 0; i < n; i++) {
      const d = Math.pow(rand(), 0.75);
      const y = d * h;
      const x = rand() * w;
      if (fbm(x / g.U * 0.05, y / g.U * 0.22, 3, seed) < 0.47) continue;
      const len = g.U * (1.5 + d * (2 + rand() * 9));
      const thick = Math.max(1, g.U * (0.2 + d * 0.3));
      ctx.fillRect(x, y, len, thick);
      if (x + len > w) ctx.fillRect(x - w, y, len, thick);
    }
  }

  function paintSeaTile(g, rand, colour, seed) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * (1 - HORIZON));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = colour;
    seaMarks(ctx, g, rand, w, h, Math.floor((w * h) / 40), seed);
    return c;
  }

  // A wandering ribbon of cloud, thick and thin along x, its edges eaten by noise.
  // Half size and seamless across x, with alpha rounded to a few flat tones.
  function ribbon(x, y, w, h, seed) {
    const a = (x / w) * 6.2832;
    const centre = 0.5 + 0.14 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 7 + seed * 2);
    const thick = 0.23 + 0.17 * Math.sin(a * 2 + seed * 3) + 0.05 * Math.sin(a * 5 + seed);
    return thick <= 0.02 ? 0 : 1 - smoothstep(0, thick, Math.abs(y / h - centre));
  }

  function paintMistTile(g, opts) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil((g.H * opts.height) / 2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const scale = 2 / g.U;
    const density = (x, y) => fbm(x * scale * opts.fx, y * scale * opts.fy, 4, opts.seed);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const field = ribbon(x, y, w, h, opts.seed) * 0.75 + v * 0.9;
        const a = Math.round(smoothstep(0.7, 1.08, field) * 5) / 5;
        const i = (y * w + x) * 4;
        img.data[i] = opts.rgb[0];
        img.data[i + 1] = opts.rgb[1];
        img.data[i + 2] = opts.rgb[2];
        img.data[i + 3] = a * opts.alpha * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- near world: the cliff and the rocks at its foot

  function jagged(points, g, seed) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i], points[i + 1]];
      for (let k = 0; k < 7; k++) {
        const s = k / 7;
        const x = lerp(a[0], b[0], s) * g.W;
        const y = lerp(a[1], b[1], s) * g.H;
        const wobble = i < CLIFF_TOP ? 1.6 : 5;
        const n = (fbm(x / g.U * 0.14, y / g.U * 0.14, 3, seed) - 0.5) * 2 * g.U * wobble;
        out.push(i < CLIFF_TOP ? { x, y: y + n } : { x: x + n, y });
      }
    }
    return out;
  }

  function cliffTopAt(g, x) {
    const f = x / g.W;
    for (let i = 0; i < CLIFF_TOP; i++) {
      if (f <= CLIFF[i + 1][0]) return lerp(CLIFF[i][1], CLIFF[i + 1][1], (f - CLIFF[i][0]) / (CLIFF[i + 1][0] - CLIFF[i][0])) * g.H;
    }
    return CLIFF[CLIFF_TOP][1] * g.H;
  }

  function trace(ctx, pts, closeX, closeY) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(closeX, closeY);
    ctx.lineTo(0, closeY);
    ctx.closePath();
  }

  function facets(ctx, g, rand, x0, y0, x1, y1, seed) {
    const n = ((x1 - x0) * (y1 - y0)) / Math.max(0.5, g.U * g.U * 2.2);
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, rand());
      const y = lerp(y0, y1, rand());
      const lit = fbm(x / g.U * 0.05, y / g.U * 0.09, 3, seed) + (x / x1 - 0.5) * 0.2 + (rand() - 0.5) * 0.12;
      const tone = Math.max(0, Math.min(3, Math.floor((lit - 0.3) * 7)));
      const w = g.U * (1.5 + rand() * 5);
      const h = g.U * (2 + rand() * 6);
      const lean = g.U * (rand() * 3 - 1.5);
      ctx.fillStyle = ROCK[tone];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + lean * 0.5);
      ctx.lineTo(x + w + lean, y + h);
      ctx.lineTo(x + lean, y + h * 0.85);
      ctx.fill();
    }
  }

  function cracks(ctx, g, rand, x0, y0, x1, y1, n) {
    ctx.strokeStyle = ROCK[0];
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    for (let i = 0; i < n; i++) {
      let x = lerp(x0, x1, rand());
      let y = lerp(y0, y1, rand());
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += g.U * (rand() * 2.4 - 0.9);
        y += g.U * (2 + rand() * 3);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function moss(ctx, g, rand, x1) {
    const n = Math.ceil((x1 / g.U) * 26);
    for (let i = 0; i < n; i++) {
      const x = rand() * x1;
      const d = Math.pow(rand(), 2.2);
      const y = cliffTopAt(g, x) + d * g.U * 11 - g.U * 0.6;
      ctx.fillStyle = rand() < 0.3 + 0.3 * (1 - d) ? '#7c8a4c' : '#4f6339';
      ctx.fillRect(x, y, g.U * (0.7 + rand() * 2.6), Math.max(1, g.U * (0.5 + rand() * 0.8)));
    }
  }

  function paintRock(ctx, g, rand, item, seed) {
    const [fx, fy, w, h, flat, lean] = item;
    const cx = g.W * fx;
    const y = g.H * fy;
    const rw = (w * g.U) / 2;
    const pts = [];
    const steps = 11;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const skew = Math.pow(u, 1 + lean * 0.8);
      const rise = Math.pow(Math.sin(skew * Math.PI), flat) * (0.72 + rand() * 0.34);
      pts.push({ x: cx - rw + u * rw * 2 + (rand() - 0.5) * g.U * 1.4, y: y - rise * h * g.U });
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - rw, y);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(cx + rw, y);
    ctx.quadraticCurveTo(cx, y + g.U * 1.2, cx - rw, y);
    ctx.clip();
    ctx.fillStyle = ROCK[1];
    ctx.fillRect(cx - rw - g.U, y - h * g.U * 1.2, rw * 2 + g.U * 2, h * g.U * 1.5);
    facets(ctx, g, rand, cx - rw - g.U * 2, y - h * g.U * 1.2, cx + rw, y + g.U, seed);
    ctx.restore();
    return { cx, y, rw };
  }

  function paintCliff(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const pts = jagged(CLIFF, g, 31);
    const right = g.W * 0.42;
    state.rocks = ROCKS.map((item, i) => paintRock(ctx, g, rand, item, 40 + i));
    ctx.save();
    trace(ctx, pts, pts[pts.length - 1].x, g.H + 2);
    ctx.fillStyle = ROCK[1];
    ctx.fill();
    ctx.clip();
    facets(ctx, g, rand, -g.U * 4, g.H * 0.56, right, g.H, 33);
    cracks(ctx, g, rand, 0, g.H * 0.74, right, g.H * 0.86, Math.ceil(g.W / g.U / 7));
    moss(ctx, g, rand, g.W * 0.33);
    ctx.restore();
    state.foot = pts.filter((p) => p.y > g.H * 0.8);
    return c;
  }

  // ---- the pine

  function needleFan(ctx, x, y, angle, spread, len, n, rand) {
    for (let i = 0; i < n; i++) {
      const a = angle + (i / Math.max(1, n - 1) - 0.5) * spread;
      const l = len * (0.7 + rand() * 0.5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
  }

  function padOutline(rand) {
    const [p1, p2, p3] = [rand() * 6.3, rand() * 6.3, rand() * 6.3];
    return {
      top: (u) => Math.pow(1 - u * u, 0.42) * (0.8 + 0.2 * Math.sin(u * 7 + p1) + 0.1 * Math.sin(u * 15 + p2)),
      under: (u) => Math.pow(1 - u * u, 0.6) * (0.75 + 0.2 * Math.sin(u * 9 + p3)),
    };
  }

  function paintPadBody(ctx, s, shape, rand, cx, cy, rw, h) {
    ctx.fillStyle = NEEDLE.dark;
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const u = -1 + i / 14;
      if (i === 0) ctx.moveTo(cx + u * rw, cy - shape.top(u) * h * 0.62);
      else ctx.lineTo(cx + u * rw, cy - shape.top(u) * h * 0.62);
    }
    for (let i = 28; i >= 0; i--) {
      const u = -1 + i / 14;
      ctx.lineTo(cx + u * rw, cy + shape.under(u) * h * 0.38);
    }
    ctx.fill();
    ctx.strokeStyle = NEEDLE.dark;
    ctx.lineWidth = Math.max(0.8, s * 0.42);
    ctx.beginPath();
    const count = Math.ceil(rw / s) * 2;
    for (let i = 0; i < count; i++) {
      const u = (rand() * 2 - 1) * 0.98;
      needleFan(ctx, cx + u * rw, cy - shape.top(u) * h * 0.55, -1.57 + u * 1.1, 1.4, s * 2.6, 3, rand);
      if (i % 2) needleFan(ctx, cx + u * rw, cy + shape.under(u) * h * 0.3, 1.57 - u * 0.6, 1.0, s * 1.5, 2, rand);
    }
    ctx.stroke();
  }

  function fanLayer(ctx, s, shape, rand, cx, cy, rw, h, spec) {
    ctx.strokeStyle = spec.colour;
    ctx.lineWidth = Math.max(0.8, s * spec.weight);
    ctx.beginPath();
    for (let i = 0; i < spec.count; i++) {
      const u = (Math.pow(rand(), spec.bias) * 2 - 1) * 0.92;
      const depth = spec.from + rand() * (spec.to - spec.from);
      const y = cy - shape.top(u) * h * 0.62 * depth;
      needleFan(ctx, cx + u * rw, y, -1.57 + u * 0.9, 1.5, s * spec.len, 4, rand);
    }
    ctx.stroke();
  }

  function paintPad(g, rand, w, h) {
    const s = g.S;
    const m = s * 4;
    const rw = (w * s) / 2;
    const ph = h * s;
    const cw = rw * 2 + m * 2;
    const ch = ph + m * 2;
    const cx = cw / 2;
    const cy = m + ph * 0.62;
    const shape = padOutline(rand);
    const body = layer(cw, ch);
    const crown = layer(cw, ch);
    const bctx = body.getContext('2d');
    const cctx = crown.getContext('2d');
    paintPadBody(bctx, s, shape, rand, cx, cy, rw, ph);
    const size = Math.ceil(w);
    fanLayer(bctx, s, shape, rand, cx, cy, rw, ph, { colour: NEEDLE.mid, weight: 0.5, count: size, bias: 1, from: 0.05, to: 0.75, len: 2.2 });
    fanLayer(cctx, s, shape, rand, cx, cy, rw, ph, { colour: NEEDLE.light, weight: 0.5, count: size, bias: 0.8, from: 0.45, to: 1.02, len: 2 });
    fanLayer(cctx, s, shape, rand, cx, cy, rw, ph, { colour: NEEDLE.tip, weight: 0.42, count: Math.ceil(size * 0.45), bias: 0.55, from: 0.72, to: 1.08, len: 1.5 });
    return { body, crown, cx, cy };
  }

  function placeTree(g) {
    const s = g.S;
    const bx = g.W * 0.2;
    const by = cliffTopAt(g, bx) + s * 0.8;
    return { s, bx, by, px: (x) => bx + x * s, py: (y) => by + y * s };
  }

  function trunkStrip(ctx, spine, from, to) {
    ctx.beginPath();
    spine.forEach((p, i) => (i ? ctx.lineTo(p.x + p.nx * p.w * from, p.y + p.ny * p.w * from) : ctx.moveTo(p.x + p.nx * p.w * from, p.y + p.ny * p.w * from)));
    for (let i = spine.length - 1; i >= 0; i--) ctx.lineTo(spine[i].x + spine[i].nx * spine[i].w * to, spine[i].y + spine[i].ny * spine[i].w * to);
    ctx.fill();
  }

  function trunkSpine(tree) {
    const raw = spline(TRUNK, 8);
    return raw.map((p, i) => {
      const a = raw[Math.max(0, i - 1)];
      const b = raw[Math.min(raw.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const f = i / (raw.length - 1);
      const flare = 1 + 0.55 * smoothstep(0.1, 0, f);
      const nx = (b.y - a.y) / len;
      const ny = -(b.x - a.x) / len;
      return { x: tree.px(p.x), y: tree.py(p.y), nx, ny, w: (tree.s * lerp(5.4, 1.5, Math.pow(f, 0.85))) * flare };
    });
  }

  function paintRoots(ctx, tree, rand) {
    const s = tree.s;
    ctx.strokeStyle = BARK;
    ctx.lineCap = 'round';
    [[-12, 2, 2.4], [-6, 3, 3], [7, 2.2, 3], [13, 2.6, 2], [18, 5, 1.2]].forEach(([dx, dy, w]) => {
      ctx.lineWidth = w * s;
      ctx.beginPath();
      ctx.moveTo(tree.bx + dx * 0.15 * s, tree.by - s);
      ctx.quadraticCurveTo(tree.bx + dx * 0.6 * s, tree.by + (dy * 0.2 + rand()) * s, tree.bx + dx * s, tree.by + dy * s);
      ctx.stroke();
    });
  }

  function barkMarks(ctx, tree, spine, rand) {
    const s = tree.s;
    ctx.lineWidth = Math.max(0.8, s * 0.5);
    for (let n = 0; n < spine.length * 7; n++) {
      const p = spine[Math.floor(rand() * spine.length)];
      const across = (rand() * 1.7 - 0.85) * p.w;
      const x = p.x + p.nx * across;
      const y = p.y + p.ny * across;
      ctx.strokeStyle = rand() < 0.6 ? '#171413' : (rand() < 0.5 ? '#8a6444' : '#4a3a30');
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + p.nx * s * (0.8 + rand() * 1.4), y + p.ny * s * (0.8 + rand() * 1.4));
      ctx.stroke();
    }
  }

  function paintTrunk(g, tree, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spine = trunkSpine(tree);
    paintRoots(ctx, tree, rand);
    ctx.fillStyle = BARK;
    trunkStrip(ctx, spine, -1, 1);
    ctx.fillStyle = BARK_LIT;
    trunkStrip(ctx, spine, 0.15, 0.94);
    barkMarks(ctx, tree, spine, rand);
    return c;
  }

  function buildLimb(tree, def, i) {
    const raw = spline(def.pts, 3);
    const n = raw.length;
    const end = def.pts[def.pts.length - 1];
    const len = Math.hypot(end[0] - def.pts[0][0], end[1] - def.pts[0][1]);
    const limb = {
      n,
      xs: new Float32Array(n), ys: new Float32Array(n),
      bend: new Float32Array(n), width: new Float32Array(n),
      ox: new Float32Array(n), oy: new Float32Array(n),
      phase: i * 1.9 + 0.4,
    };
    raw.forEach((p, k) => {
      const f = k / (n - 1);
      limb.xs[k] = tree.px(p.x);
      limb.ys[k] = tree.py(p.y);
      limb.bend[k] = Math.pow(f, 1.5) * (0.35 + len / 60);
      limb.width[k] = lerp(def.w[0], def.w[1], f) * tree.s;
    });
    return limb;
  }

  function nearestPoint(limb, x, y) {
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < limb.n; k++) {
      const d = Math.hypot(limb.xs[k] - x, limb.ys[k] - y);
      if (d < bestD) [bestD, best] = [d, k];
    }
    return best;
  }

  function buildTree(g, rand) {
    const tree = placeTree(g);
    state.tree = tree;
    state.trunk = paintTrunk(g, tree, rand);
    state.limbs = LIMBS.map((def, i) => buildLimb(tree, def, i));
    state.pads = PADS.map(([limbIndex, x, y, w, h, back], i) => {
      const sprite = paintPad(g, rand, w, h);
      const limb = state.limbs[limbIndex];
      const px = tree.px(x);
      const py = tree.py(y);
      return { ...sprite, limb, point: nearestPoint(limb, px, py), left: px - sprite.cx, top: py - sprite.cy, back: !!back, phase: i * 2.3 };
    });
  }

  // ---- water that moves

  function buildCrests(g, rand) {
    const list = [];
    for (let i = 0; i < CRESTS; i++) {
      const d = rand();
      list.push({
        x: g.W * (0.42 + rand() * 0.66), y: g.H * (0.76 + d * 0.22),
        len: g.U * (10 + d * 20 + rand() * 6),
        rate: 0.035 + rand() * 0.03, start: rand(),
        travel: g.U * (10 + d * 12),
        weight: Math.max(1, g.U * (0.45 + d * 0.5)),
        phase: rand() * 6.28,
      });
    }
    return list;
  }

  function foamLine(xs, ys, nx, ny, rand, reach) {
    return {
      xs: Float32Array.from(xs),
      ys: Float32Array.from(ys),
      nx: Float32Array.from(nx),
      ny: Float32Array.from(ny),
      rate: 0.55 + rand() * 0.35,
      phase: rand() * 6.28,
      reach,
    };
  }

  function buildFoam(g, rand) {
    const lines = state.rocks.map((r) => {
      const [xs, ys, nx, ny] = [[], [], [], []];
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI;
        xs.push(r.cx + Math.cos(a) * r.rw * 1.04);
        ys.push(r.y + Math.sin(a) * g.U * 1.3 - g.U * 0.2);
        nx.push(Math.cos(a));
        ny.push(Math.sin(a) * 0.45);
      }
      return foamLine(xs, ys, nx, ny, rand, g.U * 1.9);
    });
    const foot = state.foot.filter((_, i) => i % 2 === 0);
    lines.push(foamLine(foot.map((p) => p.x + g.U * 0.4), foot.map((p) => p.y), foot.map(() => 1), foot.map(() => 0.1), rand, g.U * 2.6));
    return lines;
  }

  function buildSpray(g, rand) {
    const list = [];
    state.foam.forEach((line, index) => {
      for (let i = 0; i < 6; i++) {
        const k = Math.floor(rand() * line.xs.length);
        list.push({ line: index, x: line.xs[k], y: line.ys[k], lift: g.U * (2 + rand() * 4), drift: (rand() - 0.5) * g.U * 3, lag: rand() * 0.8 });
      }
    });
    return list;
  }

  function buildGlints(g, rand) {
    const list = [];
    for (let i = 0; i < GLINTS; i++) {
      const d = Math.pow(rand(), 0.7);
      list.push({
        x: state.sun.x + (rand() - 0.5) * g.U * (6 + d * 22),
        y: g.H * lerp(0.68, 0.99, d),
        w: g.U * (1.5 + d * 6), h: Math.max(1, g.U * 0.5),
        phase: rand() * 6.28, rate: 0.3 + rand() * 0.5,
      });
    }
    return list;
  }

  function drawCrest(ctx, g, c, t, amount) {
    const life = (t * c.rate + c.start) % 1;
    const x = c.x - life * c.travel * 1.6;
    const y = c.y + life * c.travel * 0.25;
    ctx.globalAlpha = Math.sin(life * Math.PI) * Math.min(1, amount) * 0.85;
    ctx.lineWidth = c.weight;
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      const px = x + (f - 0.5) * c.len;
      const py = y + Math.sin(f * 6 + c.phase + t * 0.3) * g.U * 0.5 - Math.sin(f * 3.14) * g.U * 0.8;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function strokeFoam(ctx, line, out) {
    ctx.beginPath();
    for (let k = 0; k < line.xs.length; k++) {
      const x = line.xs[k] + line.nx[k] * out;
      const y = line.ys[k] + line.ny[k] * out;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawFoam(ctx, g, line, t, amount) {
    const swell = 0.5 + 0.5 * Math.sin(t * line.rate + line.phase);
    const out = swell * line.reach * amount;
    const strength = Math.min(1, amount);
    ctx.globalAlpha = (0.2 + 0.3 * (1 - swell)) * strength;
    ctx.lineWidth = Math.max(1, g.U * 2.2);
    strokeFoam(ctx, line, out);
    ctx.globalAlpha = (0.55 + 0.45 * (1 - swell)) * strength;
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    strokeFoam(ctx, line, out * 0.55);
  }

  function drawSpray(ctx, g, t, amount) {
    const size = Math.max(1, g.U * 0.7);
    for (const s of state.spray) {
      const line = state.foam[s.line];
      const life = ((t * line.rate + line.phase) / 6.283 + s.lag) % 1;
      if (life > 0.4) continue;
      const f = life / 0.4;
      ctx.globalAlpha = (1 - f) * Math.min(1, amount) * 0.9;
      ctx.fillRect(s.x + s.drift * f, s.y - s.lift * amount * Math.sin(f * 2.2), size, size);
    }
  }

  function drawWater(ctx, g, t, waves) {
    const speed = 0.5 + waves * 0.5;
    const seaY = Math.floor(g.H * HORIZON);
    ctx.globalAlpha = Math.min(1, 0.35 + waves * 0.65);
    slide(ctx, state.seaDark, seaY, t * g.U * 0.9 * speed, 1, state.seaDark.height);
    slide(ctx, state.seaLight, seaY, -t * g.U * 0.55 * speed, 1, state.seaLight.height);
    ctx.fillStyle = '#ecd9a8';
    for (const s of state.glints) {
      const glow = 0.25 + 0.3 * Math.sin(t * s.rate + s.phase);
      if (glow <= 0.02) continue;
      ctx.globalAlpha = glow;
      ctx.fillRect(s.x + Math.sin(t * 0.2 + s.phase) * g.U, s.y, s.w, s.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawSurf(ctx, g, t, waves) {
    ctx.strokeStyle = FOAM;
    ctx.fillStyle = FOAM;
    ctx.lineCap = 'round';
    for (const line of state.foam) drawFoam(ctx, g, line, t, waves);
    drawSpray(ctx, g, t, waves);
    ctx.globalAlpha = 1;
  }

  // Draws a tile twice so it wraps; scale stretches half-size textures back up.
  function slide(ctx, tile, y, offset, scale, height) {
    const w = tile.width * scale;
    const x = -(((offset % w) + w) % w);
    ctx.drawImage(tile, x, y, w, height);
    ctx.drawImage(tile, x + w, y, w, height);
  }

  function drawMist(ctx, tile, y, offset, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = Math.min(1, alpha);
    slide(ctx, tile, y, offset, 2, tile.height * 2);
    ctx.globalAlpha = 1;
  }

  // ---- wind in the tree

  function swayLimb(limb, g, t, wind) {
    const amp = g.S * 1.5 * wind;
    const speed = 0.6 + wind * 0.4;
    const lean = Math.sin(t * 0.23 * speed + limb.phase) * 0.5;
    for (let k = 0; k < limb.n; k++) {
      const a = t * speed * 0.8 - k * 0.22 + limb.phase;
      const gust = lean + Math.sin(a) * 0.5 + Math.sin(a * 2.3 + 1.1) * 0.2;
      limb.ox[k] = limb.bend[k] * amp * gust;
      limb.oy[k] = limb.bend[k] * amp * 0.55 * Math.sin(a * 1.3 + 0.7);
    }
  }

  function strokeLimb(ctx, limb, colour, scale, rise) {
    ctx.strokeStyle = colour;
    for (let k = 0; k < limb.n - 1; k++) {
      const w = limb.width[k];
      ctx.lineWidth = Math.max(1, w * scale);
      ctx.beginPath();
      ctx.moveTo(limb.xs[k] + limb.ox[k], limb.ys[k] + limb.oy[k] - w * rise);
      ctx.lineTo(limb.xs[k + 1] + limb.ox[k + 1], limb.ys[k + 1] + limb.oy[k + 1] - w * rise);
      ctx.stroke();
    }
  }

  function drawPad(ctx, g, pad, t, wind) {
    const dx = pad.limb.ox[pad.point];
    const dy = pad.limb.oy[pad.point];
    const flutter = Math.sin(t * (0.9 + wind * 0.5) + pad.phase) * g.S * 0.55 * wind;
    ctx.drawImage(pad.body, pad.left + dx, pad.top + dy);
    ctx.drawImage(pad.crown, pad.left + dx * 1.2 + flutter, pad.top + dy * 1.2 + flutter * 0.3);
  }

  function drawTree(ctx, g, t, wind) {
    for (const limb of state.limbs) swayLimb(limb, g, t, wind);
    for (const pad of state.pads) if (pad.back) drawPad(ctx, g, pad, t, wind);
    ctx.lineCap = 'round';
    for (const limb of state.limbs) strokeLimb(ctx, limb, BARK, 1, 0);
    for (const limb of state.limbs) strokeLimb(ctx, limb, BARK_LIT, 0.34, 0.22);
    ctx.drawImage(state.trunk, 0, 0);
    for (const pad of state.pads) if (!pad.back) drawPad(ctx, g, pad, t, wind);
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const g = { W, H, U: H / 100, S: Math.min(H / 100, W / 150) };
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g);
    state.seaDark = paintSeaTile(g, rand, '#88a2aa', 51);
    state.seaLight = paintSeaTile(g, rand, '#eef0e4', 52);
    state.far = paintMistTile(g, { height: 0.14, fx: 0.03, fy: 0.22, seed: 61, alpha: 0.7, rgb: [232, 230, 214] });
    state.cloud = paintMistTile(g, { height: 0.25, fx: 0.04, fy: 0.12, seed: 62, alpha: 0.94, rgb: [244, 241, 230] });
    state.cloudThin = paintMistTile(g, { height: 0.16, fx: 0.05, fy: 0.2, seed: 63, alpha: 0.5, rgb: [226, 228, 218] });
    state.cliff = paintCliff(g, rand);
    state.foam = buildFoam(g, rand);
    state.spray = buildSpray(g, rand);
    state.crests = buildCrests(g, rand);
    state.glints = buildGlints(g, rand);
    buildTree(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind, mist, waves } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawWater(ctx, g, t, waves);
    drawMist(ctx, state.far, g.H * 0.54, t * g.U * 0.5, mist);
    if (waves > 0) {
      ctx.strokeStyle = FOAM;
      ctx.lineCap = 'round';
      for (const crest of state.crests) drawCrest(ctx, g, crest, t, waves);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(state.cliff, 0, 0);
    if (waves > 0) drawSurf(ctx, g, t, waves);
    drawMist(ctx, state.cloudThin, g.H * 0.72, -t * g.U * 0.6, mist * 0.8);
    drawMist(ctx, state.cloud, g.H * 0.69, t * g.U * 1.1, mist);
    drawTree(ctx, g, t, wind);
  }

  Kasuri.run({
    defaults: { wind: 1, mist: 1, waves: 1, ramp: 'lines', cell: 7, boost: 0.05, gain: 1, dither: 0.25 },
    maxFps: 24,
    setup,
    draw,
  });
})();
