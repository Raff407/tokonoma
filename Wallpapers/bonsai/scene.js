/*
 * 盆栽 Bonsai — an old windswept pine in a shallow glazed tray, against plaster.
 *
 * Wall, stand, tray and trunk are baked once. Each foliage pad is a baked sprite
 * nudged by a hair, with a few hundred short needle strokes on top. The window
 * light is one sprite sliding along the wall with the tree's shadow cut out of it.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, noise2, smoothstep } = K;

  const NEEDLE_TONES = ['#2a4233', '#385c41', '#50774a', '#719552', '#97b166', '#c0ca80'];
  const TIP_TONES = ['#50774a', '#87a65e', '#c0ca80'];
  const MOSS = ['#5c7d44', '#769750', '#94b160', '#b6c875'];
  const FALL_SLOTS = 8;
  const FALL_ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
  const FALL_PERIOD = 46;
  const FALL_SHARE = 0.34;
  const MOTES = 10;

  // Positions are in units of g.U from the foot of the trunk, y pointing down.
  const TRUNK = [
    [-1, 0.5, 10], [-3, -5, 7.8], [-7, -12, 6.6], [-9, -20, 6], [-3, -28, 5.6], [7, -31, 5], [14, -37, 4.4],
    [12, -45, 3.8], [15, -51, 3.1], [24, -55, 2.5], [34, -58, 1.8], [44, -60, 1],
  ];
  const BRANCHES = [
    [[-6, -14, 3.2], [6, -14, 2.8], [18, -18, 2.2], [32, -17, 1.7], [46, -21, 1.1], [58, -21, 0.6]],
    [[8, -32, 2.6], [20, -32, 2], [30, -37, 1.5], [42, -36, 1], [54, -39, 0.6]],
    [[13, -44, 1.9], [23, -46, 1.5], [32, -50, 1.1], [42, -50, 0.6]],
    [[14, -50, 1.5], [10, -56, 1.2], [4, -60, 0.8], [-1, -61, 0.5]],
    [[-9, -19, 2.1], [-18, -21, 1.6], [-25, -18, 1.1], [-31, -19, 0.6]],
  ];
  const JINS = [
    [[-10, -25, 2.3], [-19, -32, 1.7], [-27, -36, 1.1], [-35, -37, 0.45]],
    [[-22, -34, 0.9], [-25, -41, 0.6], [-24, -46, 0.3]],
    [[11, -43, 1.5], [5, -47, 1], [1, -53, 0.45]],
  ];
  const ROOTS = [
    [[-6, -2, 3], [-16, -1, 1.9], [-26, 0, 1], [-33, 1.2, 0.35]],
    [[4, -2, 2.8], [13, -0.8, 1.8], [23, 0.2, 0.9], [31, 1.2, 0.35]],
    [[-2, 1, 2.4], [-8, 2, 1.4], [-15, 2.6, 0.4]],
    [[3, 1, 2.2], [9, 2.2, 1.2], [15, 2.8, 0.4]],
  ];
  // x, y, half width, half height, front of the trunk or behind it.
  const PADS = [
    { x: 47, y: -62, rx: 18, ry: 6, front: false },
    { x: 8, y: -59, rx: 13, ry: 5, front: false },
    { x: 35, y: -50, rx: 18, ry: 5.5, front: true },
    { x: 47, y: -38, rx: 23, ry: 6.5, front: false },
    { x: 52, y: -22, rx: 25, ry: 7, front: true },
    { x: 21, y: -20, rx: 13, ry: 4.5, front: false },
    { x: -28, y: -21, rx: 13, ry: 5.5, front: true },
  ];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintWall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const small = layer(g.W / 3, g.H / 3);
    const sc = small.getContext('2d');
    const tones = ['#6b6556', '#756e5d', '#7f7764', '#89806b', '#938a73'];
    for (let y = 0; y < small.height; y++) {
      for (let x = 0; x < small.width; x++) {
        const fx = x / small.width;
        const fy = y / small.height;
        const n = fbm((x * 3) / g.U * 0.05, (y * 3) / g.U * 0.05, 3, 11);
        const v = 0.62 - fx * 0.26 + (n - 0.5) * 0.32 + (fy - 0.4) * 0.12;
        sc.fillStyle = tones[Math.max(0, Math.min(4, Math.round(v * 4)))];
        sc.fillRect(x, y, 1, 1);
      }
    }
    ctx.drawImage(small, 0, 0, g.W, g.H);
    paintFloor(ctx, g, rand);
    ctx.fillStyle = '#a89d84';
    for (let i = 0; i < g.W * g.H * 0.006; i++) {
      ctx.globalAlpha = 0.18 + rand() * 0.2;
      ctx.fillRect(rand() * g.W, rand() * g.H, 1, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // One leaded window of light, skewed by the low sun. Painted small for soft edges.
  function paintWindow(g) {
    const u = g.U / 3;
    const pw = u * 118;
    const ph = u * 92;
    const c = layer(pw, ph);
    const ctx = c.getContext('2d');
    const skew = (x, y) => [x + y * 0.3, y];
    ctx.fillStyle = '#f4e6bf';
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        const x0 = u * (3 + col * 28);
        const y0 = u * (3 + row * 29);
        const pane = [skew(x0, y0), skew(x0 + u * 26, y0), skew(x0 + u * 26, y0 + u * 27), skew(x0, y0 + u * 27)];
        ctx.beginPath();
        pane.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.fill();
      }
    }
    return c;
  }

  function paintFloor(ctx, g, rand) {
    const top = g.U * 90;
    ctx.fillStyle = '#3c3429';
    ctx.fillRect(0, top - g.U * 1.2, g.W, g.U * 1.3);
    ctx.fillStyle = '#7f694b';
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#a0875f';
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.9));
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.fillStyle = rand() < 0.6 ? '#6c583f' : '#8e7755';
      ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), g.U * (3 + rand() * 12), 1);
    }
    ctx.fillStyle = '#4c3e2e';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(g.cx + g.U * 7, g.U * 94.6, g.U * 62, g.U * 3.2, 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintStandLeg(ctx, u, x, y) {
    ctx.fillStyle = '#6f4733';
    ctx.beginPath();
    ctx.moveTo(x - u * 7, y);
    ctx.lineTo(x + u * 7, y);
    ctx.quadraticCurveTo(x + u * 5.5, y + u * 3.2, x + u * 7.5, y + u * 7);
    ctx.lineTo(x + u * 3, y + u * 7);
    ctx.quadraticCurveTo(x, y + u * 3.5, x - u * 3, y + u * 7);
    ctx.lineTo(x - u * 7.5, y + u * 7);
    ctx.quadraticCurveTo(x - u * 5.5, y + u * 3.2, x - u * 7, y);
    ctx.fill();
    ctx.fillStyle = '#8a5a41';
    ctx.fillRect(x - u * 7, y, u * 1.8, u * 4);
  }

  function paintStand(ctx, g, rand) {
    const u = g.U;
    const x = g.cx;
    const hw = u * 58;
    const y = u * 83.4;
    paintStandLeg(ctx, u, x - hw * 0.72, y + u * 3.6);
    paintStandLeg(ctx, u, x + hw * 0.72, y + u * 3.6);
    ctx.fillStyle = '#b87a57';
    ctx.beginPath();
    ctx.moveTo(x - hw * 0.96, y - u * 1.6);
    ctx.lineTo(x + hw * 0.96, y - u * 1.6);
    ctx.lineTo(x + hw, y + u * 0.3);
    ctx.lineTo(x - hw, y + u * 0.3);
    ctx.fill();
    ctx.fillStyle = '#96553a';
    ctx.fillRect(x - hw, y + u * 0.3, hw * 2, u * 3.8);
    ctx.fillStyle = '#c98c66';
    ctx.fillRect(x - hw, y + u * 0.3, hw, Math.max(1, u * 0.6));
    ctx.fillStyle = '#6e3f2a';
    for (let i = 0; i < 26; i++) {
      ctx.fillRect(x - hw + rand() * hw * 2, y + u * (1 + rand() * 2.8), u * (3 + rand() * 9), Math.max(1, u * 0.3));
    }
  }

  function paintTray(ctx, g, rand) {
    const u = g.U;
    const x = g.cx;
    const rx = u * 49;
    const rim = u * 74.5;
    const ry = u * 4.6;
    const foot = u * 82.6;
    ctx.fillStyle = '#34302c';
    ctx.fillRect(x - rx * 0.62, foot - u * 0.4, u * 8, u * 1.6);
    ctx.fillRect(x + rx * 0.62 - u * 8, foot - u * 0.4, u * 8, u * 1.6);
    ctx.fillStyle = '#5b86a6';
    ctx.beginPath();
    ctx.ellipse(x, rim, rx, ry, 0, 0, Math.PI);
    ctx.quadraticCurveTo(x - rx * 0.98, foot, x - rx * 0.72, foot);
    ctx.lineTo(x + rx * 0.72, foot);
    ctx.quadraticCurveTo(x + rx * 0.98, foot, x + rx, rim);
    ctx.fill();
    paintGlaze(ctx, g, rand, x, rim, rx, foot);
    ctx.fillStyle = '#d3e0d6';
    ctx.beginPath();
    ctx.ellipse(x, rim, rx, ry, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#5c7f96';
    ctx.beginPath();
    ctx.ellipse(x + u * 0.8, rim + u * 0.2, rx - u * 1.2, ry - u * 0.5, 0, 0, 6.3);
    ctx.fill();
    paintSoil(ctx, g, rand, x, rim, rx - u * 2.2, ry - u * 0.9);
    ctx.strokeStyle = '#d3e0d6';
    ctx.lineWidth = Math.max(1, u * 0.8);
    ctx.beginPath();
    ctx.ellipse(x, rim, rx - u * 0.3, ry - u * 0.3, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  function paintGlaze(ctx, g, rand, x, rim, rx, foot) {
    const u = g.U;
    const drips = ['#6c98b4', '#95bcc8', '#44708f', '#c3d9d3'];
    for (let i = 0; i < 260; i++) {
      const f = rand() * 2 - 1;
      const edge = Math.sqrt(1 - f * f);
      const y0 = rim + edge * u * 4.6 + u * 0.2;
      const span = foot - y0;
      const y1 = y0 + rand() * span * (0.5 + rand() * 0.5);
      const lit = (1 - f) * 0.5;
      const pick = rand() < lit * 0.85 ? (rand() < 0.12 ? 3 : 1) : rand() < 0.5 ? 2 : 0;
      ctx.fillStyle = drips[pick];
      ctx.fillRect(x + f * rx * (1 - ((y1 - rim) / (foot - rim)) * 0.25), y0, Math.max(1, u * 0.9), y1 - y0);
    }
    ctx.fillStyle = '#e0e8da';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.56, rim + u * 5.2, rx * 0.2, u * 0.9, -0.02, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintSoil(ctx, g, rand, x, y, rx, ry) {
    const u = g.U;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.clip();
    ctx.fillStyle = '#4d4235';
    ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    const moss = MOSS;
    for (let i = 0; i < 1300; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      const px = x + Math.cos(a) * d * rx;
      const py = y + Math.sin(a) * d * ry;
      const clump = noise2(px * 0.12 / u, py * 0.4 / u, 7);
      if (clump < 0.3) continue;
      ctx.fillStyle = moss[Math.min(3, Math.floor((clump - 0.3) * 7 + rand() * 1.4))];
      ctx.fillRect(px, py - u * 0.5, u * (0.5 + rand()), u * (0.4 + rand() * 0.7));
    }
    ctx.restore();
    paintMound(ctx, g, rand, g.bx + u * 2, y - u * 0.2);
    ctx.fillStyle = '#c9a24e';
    for (let i = 0; i < 16; i++) {
      ctx.fillRect(x + (rand() - 0.5) * rx * 1.7, y + (rand() - 0.5) * ry * 1.5, u * (1 + rand()), Math.max(1, u * 0.3));
    }
  }

  // The mossy rise the pine grows out of, above the rim.
  function paintMound(ctx, g, rand, x, y) {
    const u = g.U;
    const rx = u * 40;
    ctx.fillStyle = MOSS[0];
    ctx.beginPath();
    ctx.ellipse(x, y, rx, u * 4.4, 0, Math.PI, 0);
    ctx.ellipse(x, y, rx, u * 2.6, 0, 0, Math.PI);
    ctx.fill();
    for (let i = 0; i < 800; i++) {
      const f = rand() * 2 - 1;
      const top = Math.sqrt(1 - f * f) * u * 4.4;
      const py = y + u * 2.2 * Math.sqrt(1 - f * f) - rand() * (top + u * 2.2 * Math.sqrt(1 - f * f));
      const lit = (y + u * 2.4 - py) / (u * 6.8) - f * 0.2 + (rand() - 0.5) * 0.5;
      ctx.fillStyle = MOSS[Math.max(0, Math.min(3, Math.round(lit * 3.6)))];
      ctx.fillRect(x + f * rx, py, u * (0.7 + rand() * 1.1), u * (0.5 + rand() * 0.7));
    }
  }

  // Catmull-Rom through [x, y, halfWidth] points, in pixels, with its normals.
  function samplePath(points, g, wobble, seed) {
    const out = [];
    const u = g.U;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      for (let k = 0; k < 10; k++) {
        const s = k / 10;
        const s2 = s * s;
        const s3 = s2 * s;
        const at = (j) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * s + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * s2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * s3);
        const n = out.length;
        const lump = 1 + (noise2(n * 0.17, 2, seed) - 0.5) * wobble;
        out.push({ x: g.bx + at(0) * u, y: g.by + at(1) * u, w: Math.max(0.3, at(2)) * u * lump, nx: 0, ny: -1 });
      }
    }
    for (let i = 0; i < out.length; i++) {
      const a = out[Math.max(0, i - 1)];
      const b = out[Math.min(out.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      out[i].nx = (b.y - a.y) / len;
      out[i].ny = -(b.x - a.x) / len;
    }
    return out;
  }

  // Fills the band of a path between two sideways offsets (1 is the lit edge).
  function band(ctx, path, a, b, colour, from, to) {
    const lo = Math.floor((from || 0) * (path.length - 1));
    const hi = Math.ceil((to === undefined ? 1 : to) * (path.length - 1));
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = lo; i <= hi; i++) {
      const p = path[i];
      ctx.lineTo(p.x + p.nx * p.w * a, p.y + p.ny * p.w * a);
    }
    for (let i = hi; i >= lo; i--) {
      const p = path[i];
      ctx.lineTo(p.x + p.nx * p.w * b, p.y + p.ny * p.w * b);
    }
    ctx.closePath();
    ctx.fill();
  }

  function paintLimb(ctx, path) {
    band(ctx, path, 1.06, -1.06, '#342a23');
    band(ctx, path, 0.98, -0.72, '#574537');
    band(ctx, path, 0.86, -0.1, '#7c6650');
    band(ctx, path, 0.8, 0.32, '#a68c6c');
  }

  // Long twisting sinews make the wood look old; a pale strip of dead wood runs up the trunk.
  function paintSinews(ctx, path, rand, count) {
    const tones = ['#342a23', '#403328', '#b89d7a', '#342a23'];
    for (let j = 0; j < count; j++) {
      const f0 = rand() * 2 - 1;
      const twist = (rand() - 0.5) * 0.9;
      const phase = rand() * 6;
      ctx.strokeStyle = tones[j % tones.length];
      ctx.lineWidth = Math.max(1, path[0].w * 0.075);
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const s = i / path.length;
        const f = Math.max(-0.96, Math.min(0.96, f0 + twist * s * 3 + Math.sin(s * 15 + phase) * 0.13));
        const p = path[i];
        ctx.lineTo(p.x + p.nx * p.w * f, p.y + p.ny * p.w * f);
      }
      ctx.stroke();
    }
  }

  // A strip of bare dead wood, tapered at both ends, winding up the old trunk.
  function paintShari(ctx, trunk) {
    const lo = Math.floor(trunk.length * 0.08);
    const hi = Math.floor(trunk.length * 0.46);
    const side = (i, sign) => {
      const f = (i - lo) / (hi - lo);
      const p = trunk[i];
      const off = 0.34 + Math.sin(f * 8) * 0.28 + sign * Math.pow(Math.sin(f * Math.PI), 0.7) * 0.24;
      ctx.lineTo(p.x + p.nx * p.w * off, p.y + p.ny * p.w * off);
    };
    ctx.fillStyle = '#d6ccb1';
    ctx.beginPath();
    for (let i = lo; i <= hi; i++) side(i, 1);
    for (let i = hi; i >= lo; i--) side(i, -1);
    ctx.fill();
  }

  function paintRoot(ctx, path) {
    band(ctx, path, 1.1, -1.1, '#4a3b2f');
    band(ctx, path, 0.9, -0.5, '#8a7258');
    band(ctx, path, 0.8, 0.1, '#b39a78');
  }

  function paintWood(ctx, g, rand) {
    const trunk = samplePath(TRUNK, g, 0.34, 3);
    for (let i = 0; i < ROOTS.length; i++) paintRoot(ctx, samplePath(ROOTS[i], g, 0.3, 5 + i));
    for (const jin of JINS) {
      const p = samplePath(jin, g, 0.25, 19);
      band(ctx, p, 1.15, -1.15, '#4a463b');
      band(ctx, p, 1, -0.3, '#c6bea6');
    }
    for (let i = 0; i < BRANCHES.length; i++) {
      const p = samplePath(BRANCHES[i], g, 0.3, 30 + i);
      paintLimb(ctx, p);
      paintSinews(ctx, p, rand, 3);
    }
    paintLimb(ctx, trunk);
    paintSinews(ctx, trunk, rand, 15);
    paintShari(ctx, trunk);
    paintBurls(ctx, g, trunk, rand);
  }

  function paintBurls(ctx, g, trunk, rand) {
    const u = g.U;
    for (const f of [0.14, 0.27, 0.38, 0.52]) {
      const p = trunk[Math.floor(f * trunk.length)];
      const side = rand() < 0.5 ? -0.5 : 0.5;
      const bx = p.x + p.nx * p.w * side;
      const by = p.y + p.ny * p.w * side;
      ctx.fillStyle = '#2a211c';
      ctx.beginPath();
      ctx.ellipse(bx, by, u * 2.4, u * 1.8, rand() * 3, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#7d6650';
      ctx.beginPath();
      ctx.ellipse(bx - u * 0.3, by - u * 0.3, u * 1.3, u * 0.9, rand() * 3, 0, 6.3);
      ctx.fill();
    }
  }

  // Wind thins each pad away to a tail on its downwind side.
  function tail(a) {
    return 1 - 0.5 * Math.max(0, a);
  }

  // A tier of foliage: dark flat dome, then fans of needles lit from above and the left.
  function paintTier(ctx, g, rand, cx, cy, rx, ry, tips, pad, world) {
    const u = g.U;
    ctx.fillStyle = NEEDLE_TONES[0];
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = Math.PI + (i / 28) * Math.PI;
      const r = 1 + (noise2(i * 0.7, cy * 0.1, 41) - 0.5) * 0.3;
      ctx.lineTo(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r * tail(Math.cos(a)));
    }
    ctx.quadraticCurveTo(cx + rx * 0.2, cy + ry * 0.42, cx - rx, cy);
    ctx.fill();
    const count = Math.ceil(rx * ry * 0.5);
    const tufts = [];
    for (let i = 0; i < count; i++) tufts.push(placeTuft(rand, cx, cy, rx, ry));
    tufts.sort((a, b) => a.lit - b.lit);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, u * 0.42);
    for (const t of tufts) {
      paintTuft(ctx, u, rand, t);
      if (t.lit > 0.45 && tips.length < 44 * (pad + 1)) {
        tips.push({ x: t.x + world.x, y: t.y + world.y, pad, tone: Math.min(2, Math.floor((t.lit - 0.45) * 6)), angle: -1.57 + (rand() - 0.2) * 1.3, len: u * (1.4 + rand()), phase: rand() * 6.28 });
      }
    }
  }

  function placeTuft(rand, cx, cy, rx, ry) {
    const a = rand() * 2 - 1;
    const b = Math.pow(rand(), 0.75);
    const top = Math.sqrt(1 - a * a) * tail(a);
    const x = cx + a * rx * 0.98;
    const y = cy + ry * 0.22 - b * (ry * 0.22 + top * ry);
    const lit = b * 0.8 - a * 0.07 + (rand() - 0.5) * 0.26 + 0.08;
    return { x, y, lit };
  }

  function paintTuft(ctx, u, rand, t) {
    const tone = Math.max(0, Math.min(5, Math.round(t.lit * 5)));
    ctx.strokeStyle = NEEDLE_TONES[tone];
    ctx.beginPath();
    const spread = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < spread; i++) {
      const angle = -1.57 + ((i - spread / 2) / spread) * 2.6 + (rand() - 0.5) * 0.3;
      const len = u * (1.5 + rand() * 1.5);
      ctx.moveTo(t.x, t.y + u * 0.5);
      ctx.lineTo(t.x + Math.cos(angle) * len, t.y + u * 0.5 + Math.sin(angle) * len * 0.8);
    }
    ctx.stroke();
  }

  function paintPad(g, rand, spec, index, tips) {
    const u = g.U;
    const margin = u * 5;
    const w = spec.rx * u * 2 + margin * 2;
    const h = spec.ry * u * 2.6 + margin * 2;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const base = h - margin - spec.ry * u * 0.4;
    const world = { x: g.bx + spec.x * u - cx, y: g.by + spec.y * u - base + spec.ry * u * 0.5 };
    const tiers = [
      [-0.2, 1.1, 0.52, 0.5],
      [0.06, 0.55, 0.78, 0.7],
      [0, 0, 1, 0.85],
    ];
    for (const [dx, dy, sx, sy] of tiers) {
      paintTier(ctx, g, rand, cx + dx * spec.rx * u, base - dy * spec.ry * u, spec.rx * u * sx, spec.ry * u * sy, tips, index, world);
    }
    return { canvas: c, x: world.x, y: world.y, reach: 0.5 + (Math.abs(spec.x) + Math.abs(spec.y)) / 90, phase: spec.x * 0.05 + spec.y * 0.03, front: spec.front };
  }

  function bakeTips(tips) {
    tips.sort((a, b) => a.tone - b.tone);
    const n = tips.length;
    const tip = { n, x: new Float32Array(n), y: new Float32Array(n), dx: new Float32Array(n), dy: new Float32Array(n), phase: new Float32Array(n), pad: new Uint8Array(n), ends: [0, 0, 0] };
    tips.forEach((t, i) => {
      tip.x[i] = t.x;
      tip.y[i] = t.y;
      tip.dx[i] = Math.cos(t.angle) * t.len;
      tip.dy[i] = Math.sin(t.angle) * t.len;
      tip.phase[i] = t.phase;
      tip.pad[i] = t.pad;
      tip.ends[t.tone] = i + 1;
    });
    tip.ends[1] = Math.max(tip.ends[0], tip.ends[1]);
    tip.ends[2] = Math.max(tip.ends[1], tip.ends[2]);
    return tip;
  }

  // The shadow is the whole tree, in one tone, at a third size so it blurs when scaled up.
  function bakeShadow(g) {
    const c = layer(g.W / 3, g.H / 3);
    const ctx = c.getContext('2d');
    ctx.scale(1 / 3, 1 / 3);
    ctx.drawImage(state.base, 0, 0);
    for (const pad of state.pads) if (!pad.front) ctx.drawImage(pad.canvas, pad.x, pad.y);
    ctx.drawImage(state.wood, 0, 0);
    for (const pad of state.pads) if (pad.front) ctx.drawImage(pad.canvas, pad.x, pad.y);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function makeFalls(g, rand) {
    const n = 48;
    const origins = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const spec = PADS[i % PADS.length];
      origins[i * 2] = g.bx + (spec.x + (rand() - 0.5) * spec.rx * 1.4) * g.U;
      origins[i * 2 + 1] = g.by + (spec.y + spec.ry * 0.3) * g.U;
    }
    state.origins = origins;
    state.originCount = n;
  }

  function makeMotes(rand) {
    const motes = new Float32Array(MOTES * 4);
    for (let i = 0; i < MOTES; i++) {
      motes[i * 4] = rand();
      motes[i * 4 + 1] = rand();
      motes[i * 4 + 2] = 0.006 + rand() * 0.01;
      motes[i * 4 + 3] = rand() * 6.28;
    }
    return motes;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.cx = g.W * 0.5;
    g.bx = g.cx - g.U * 15;
    g.by = g.U * 74.5;
    const rand = K.rng(api.seed);
    state.g = g;
    state.wall = paintWall(g, rand);
    state.window = paintWindow(g);
    state.lit = layer(g.W, g.H);
    state.litCtx = state.lit.getContext('2d');
    const base = layer(g.W, g.H);
    const bc = base.getContext('2d');
    paintStand(bc, g, rand);
    paintTray(bc, g, rand);
    state.base = base;
    state.wood = layer(g.W, g.H);
    paintWood(state.wood.getContext('2d'), g, rand);
    const tips = [];
    state.pads = PADS.map((spec, i) => paintPad(g, rand, spec, i, tips));
    state.tip = bakeTips(tips);
    state.padX = new Float32Array(state.pads.length);
    state.padY = new Float32Array(state.pads.length);
    state.shadow = bakeShadow(g);
    state.motes = makeMotes(rand);
    makeFalls(g, rand);
  }

  function lightOffset(g, t) {
    return Math.sin(t * 0.013 - 0.6) * g.W * 0.15;
  }

  function drawLight(ctx, g, t, amount) {
    const lc = state.litCtx;
    const off = lightOffset(g, t);
    const pw = g.U * 118;
    const ph = g.U * 92;
    lc.clearRect(0, 0, g.W, g.H);
    lc.globalCompositeOperation = 'source-over';
    lc.drawImage(state.window, g.W * 0.5 - pw * 0.56 + off, g.U * 1, pw, ph);
    lc.clearRect(0, g.U * 88.9, g.W, g.U * 12);
    lc.globalAlpha = 0.3;
    lc.drawImage(state.window, g.W * 0.5 - pw * 0.42 + off, g.U * 90, pw * 1.1, g.U * 26);
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'destination-out';
    lc.globalAlpha = 0.72;
    lc.drawImage(state.shadow, g.U * 8 - off * 0.07, g.U * 3, g.W, g.H);
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-over';
    const cloud = 0.86 + 0.14 * Math.sin(t * 0.083) * Math.sin(t * 0.031 + 1);
    ctx.globalAlpha = Math.min(1, 0.62 * amount * cloud);
    ctx.drawImage(state.lit, 0, 0);
    ctx.globalAlpha = 1;
  }

  function movePads(g, t, breeze) {
    const gust = 0.5 + 0.5 * Math.sin(t * 0.19) * Math.sin(t * 0.07 + 2);
    for (let i = 0; i < state.pads.length; i++) {
      const pad = state.pads[i];
      const wave = Math.sin(t * 0.8 + pad.phase);
      state.padX[i] = (wave * 0.28 + gust * 0.4) * g.U * pad.reach * breeze;
      state.padY[i] = Math.sin(t * 1.05 + pad.phase * 2) * 0.16 * g.U * pad.reach * breeze;
    }
  }

  function drawPads(ctx, front) {
    for (let i = 0; i < state.pads.length; i++) {
      const pad = state.pads[i];
      if (pad.front === front) ctx.drawImage(pad.canvas, pad.x + state.padX[i], pad.y + state.padY[i]);
    }
  }

  function drawTips(ctx, g, t, breeze) {
    const tip = state.tip;
    const amp = g.U * 0.55 * breeze;
    ctx.lineWidth = Math.max(1, g.U * 0.42);
    ctx.lineCap = 'round';
    let start = 0;
    for (let tone = 0; tone < 3; tone++) {
      ctx.strokeStyle = TIP_TONES[tone];
      ctx.beginPath();
      for (let i = start; i < tip.ends[tone]; i++) {
        const x = tip.x[i] + state.padX[tip.pad[i]];
        const y = tip.y[i] + state.padY[tip.pad[i]];
        const stir = Math.sin(t * 1.5 + tip.phase[i] + x * 0.05) * amp;
        ctx.moveTo(x, y);
        ctx.lineTo(x + tip.dx[i] + stir, y + tip.dy[i]);
      }
      ctx.stroke();
      start = tip.ends[tone];
    }
  }

  // Where a needle comes to rest: the moss if it is over the tray, else the stand or floor.
  function restY(g, x) {
    const off = Math.abs(x - g.cx) / g.U;
    return g.U * (off < 45 ? 74.5 : off < 56 ? 82.6 : 95);
  }

  function drawNeedle(ctx, g, t, slot) {
    const life = (t / FALL_PERIOD + FALL_ORDER[slot] / FALL_SLOTS) % 1;
    if (life > FALL_SHARE) return;
    const cycle = Math.floor(t / FALL_PERIOD + FALL_ORDER[slot] / FALL_SLOTS);
    const pick = (cycle * 7 + slot * 13) % state.originCount;
    const f = life / FALL_SHARE;
    const x0 = state.origins[pick * 2];
    const y0 = state.origins[pick * 2 + 1];
    const drift = f * g.U * (6 + (pick % 5) * 2);
    const x = x0 + drift + Math.sin(f * 11 + pick) * g.U * 1.6 * (0.3 + f);
    const end = restY(g, x0 + drift);
    const y = lerp(y0, end, smoothstep(0, 0.9, f) * 0.35 + Math.min(1, f / 0.9) * 0.65);
    const a = f < 0.9 ? 1.1 + Math.sin(f * 15 + pick) * 0.8 : 0.08;
    const len = g.U * 1.7;
    ctx.globalAlpha = f < 0.9 ? Math.min(1, f * 14) : Math.max(0, (1 - f) * 10);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  function drawNeedles(ctx, g, t, amount) {
    const active = Math.round(amount * 4);
    if (!active) return;
    ctx.strokeStyle = '#d8ad55';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.lineCap = 'round';
    for (let slot = 0; slot < active; slot++) drawNeedle(ctx, g, t, slot);
    ctx.globalAlpha = 1;
  }

  // Pale dust drifting up through the patch of light.
  function drawMotes(ctx, g, t, amount) {
    const off = lightOffset(g, t);
    const motes = state.motes;
    const size = Math.max(1, g.U * 0.5);
    ctx.fillStyle = '#f2e6c4';
    for (let i = 0; i < MOTES; i++) {
      const y = (motes[i * 4 + 1] - t * motes[i * 4 + 2]) % 1;
      const py = (y < 0 ? y + 1 : y) * g.H * 0.85;
      const px = g.W * 0.5 + off + (motes[i * 4] - 0.5) * g.U * 100 + Math.sin(t * 0.2 + motes[i * 4 + 3]) * g.U * 3;
      ctx.globalAlpha = (0.28 + 0.2 * Math.sin(t * 0.3 + motes[i * 4 + 3])) * Math.min(1, amount);
      ctx.fillRect(px, py, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const breeze = api.props.breeze;
    ctx.drawImage(state.wall, 0, 0);
    drawLight(ctx, g, t, api.props.light);
    drawMotes(ctx, g, t, api.props.light);
    ctx.drawImage(state.base, 0, 0);
    movePads(g, t, breeze);
    drawPads(ctx, false);
    ctx.drawImage(state.wood, 0, 0);
    drawPads(ctx, true);
    drawTips(ctx, g, t, breeze);
    drawNeedles(ctx, g, t, api.props.needles);
  }

  Kasuri.run({
    defaults: { breeze: 1, needles: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
