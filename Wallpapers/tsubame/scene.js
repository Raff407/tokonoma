/*
 * 燕 Tsubame — swallows nesting under the eaves of an old farmhouse in early summer.
 *
 * The house, the paddies and the mud cup are baked once. Each frame only slides
 * clouds and their reflection, then draws four chicks and two adults as a few short
 * paths. The flights are read from tables filled in setup, so nothing is allocated.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  // One vanishing point. s is nearness (0 far, 1 at the viewer), v is height on the wall.
  const VPX = 0.76;
  const HOR = 0.66;
  const WALL_X = 0.86;
  const RISE = 0.95;
  const FOOT = -0.84;
  const EAVE_X = 0.16;
  const THATCH_X = 0.06;
  const PATH_X = 0.61;
  const END = 0.372;
  const NEAR = 1.4;

  const MUD = ['#a07c54', '#8c6c49', '#b08e63', '#7c5f40', '#c0a074'];
  const CHICK_X = [-15.5, -5.2, 5.2, 15.5];
  const CHICK_LEAN = [-0.4, -0.14, 0.14, 0.4];
  const FEED_ORDER = [2, 0, 3, 1];
  const FLIGHT = 22;
  const HOLD = 0.16;
  const STEPS = 360;
  const FAR_BIRDS = 8;
  const GLINTS = 90;
  const BLADES = 26;

  // t is a fraction of the loop; x and y are fractions of the picture; s is bird size.
  const FLIGHT_A = [
    [0.0, 0.3, 0.36, 0.95, 1], [HOLD, 0.3, 0.36, 0.95, 1], [0.2, 0.36, 0.52, 1.15, 0.2],
    [0.27, 0.5, 0.8, 1.35, 0], [0.36, 0.7, 0.86, 1.05, 0], [0.46, 0.9, 0.66, 0.62, 0],
    [0.55, 0.95, 0.42, 0.36, 0], [0.64, 0.98, 0.3, 0.26, 0], [0.72, 0.78, 0.5, 0.2, 0],
    [0.8, 0.6, 0.57, 0.32, 0], [0.87, 0.66, 0.44, 0.6, 0], [0.94, 0.5, 0.38, 0.85, 0.05],
    [0.98, 0.36, 0.35, 1.0, 0.7],
  ];
  const FLIGHT_B = [
    [0.0, 0.3, 0.36, 0.95, 1], [HOLD, 0.3, 0.36, 0.95, 1], [0.2, 0.42, 0.42, 1.1, 0.2],
    [0.27, 0.66, 0.5, 0.95, 0], [0.35, 0.92, 0.46, 0.6, 0], [0.43, 0.97, 0.6, 0.34, 0],
    [0.52, 0.8, 0.6, 0.2, 0], [0.61, 0.62, 0.54, 0.24, 0], [0.7, 0.72, 0.72, 0.5, 0],
    [0.79, 0.9, 0.84, 0.9, 0], [0.87, 0.7, 0.9, 1.25, 0], [0.93, 0.48, 0.66, 1.2, 0.05],
    [0.98, 0.37, 0.42, 1.08, 0.7],
  ];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function wallX(g, s) { return g.W * (VPX - s * WALL_X); }
  function eaveX(g, s, e) { return g.W * (VPX + s * e); }
  function heightY(g, s, v) { return g.H * (HOR - s * v * RISE); }

  function quadPath(ctx, ax, ay, bx, by, cx, cy, dx, dy) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.lineTo(dx, dy);
    ctx.closePath();
  }

  function quad(ctx, ax, ay, bx, by, cx, cy, dx, dy) {
    quadPath(ctx, ax, ay, bx, by, cx, cy, dx, dy);
    ctx.fill();
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
  }

  function oval(ctx, x, y, rx, ry, turn) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, turn, 0, 6.3);
    ctx.fill();
  }

  function seg(ctx, ax, ay, bx, by) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  // A patch of the wall between two nearnesses and two heights.
  function wallQuad(ctx, g, s0, s1, v0, v1, colour) {
    ctx.fillStyle = colour;
    const x0 = wallX(g, s0);
    const x1 = wallX(g, s1);
    quad(ctx, x0, heightY(g, s0, v0), x1, heightY(g, s1, v0), x1, heightY(g, s1, v1), x0, heightY(g, s0, v1));
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * HOR);
    sky.addColorStop(0, '#5a9ad0');
    sky.addColorStop(0.6, '#93c1de');
    sky.addColorStop(1, '#dcecec');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H * HOR + 1);
    ctx.fillStyle = '#a4cdd6';
    ctx.fillRect(0, g.H * HOR, g.W, g.H);
    return c;
  }

  // One flat-coloured tile: tone(x, y) returns the alpha, 0 to 1, for each pixel.
  function bakeTile(w, h, rgb, tone) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        img.data[i] = rgb[0];
        img.data[i + 1] = rgb[1];
        img.data[i + 2] = rgb[2];
        img.data[i + 3] = tone(x, y) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Baked at half size, in a few flat tones. Tiles sideways.
  function paintClouds(w, h) {
    const density = (x, y) => fbm((x / w) * 7, (y / h) * 3.2, 4, 17);
    return bakeTile(w, h, [248, 250, 246], (x, y) => {
      const f = y / h;
      const band = smoothstep(0, 0.35, f) * smoothstep(1, 0.72, f);
      const v = lerp(density(x, y), density(x - w, y), x / w);
      return (Math.round(smoothstep(0.46, 0.62, v) * band * 3) / 3) * 0.94;
    });
  }

  function ridge(ctx, g, colour, base, amp, freq, seed) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H * HOR + 1);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (base - fbm(x * freq, seed, 3, 5) * amp));
    ctx.lineTo(g.W, g.H * HOR + 1);
    ctx.fill();
  }

  function paintTrees(ctx, g, rand) {
    const tones = ['#55804f', '#659356', '#78a660', '#4a7249'];
    const y = g.H * HOR;
    for (let i = 0; i < 260; i++) {
      const f = rand();
      const hump = Math.sin(f * Math.PI);
      const x = g.W * lerp(0.38, 0.68, f);
      const top = hump * g.U * 11 * (0.5 + rand() * 0.5);
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      disc(ctx, x, y - rand() * top, g.U * (0.7 + rand() * 1.5));
    }
  }

  function paintFarHouse(ctx, g, x) {
    const u = g.U;
    const y = g.H * HOR;
    ctx.fillStyle = '#d3c9ae';
    ctx.fillRect(x - u * 3.6, y - u * 2.2, u * 7.2, u * 2.4);
    ctx.fillStyle = '#6f6248';
    quad(ctx, x - u * 5, y - u * 2.2, x - u * 1.6, y - u * 5.6, x + u * 1.6, y - u * 5.6, x + u * 5, y - u * 2.2);
  }

  function groundX(g, q, y) {
    const hy = g.H * HOR;
    return g.W * VPX + (q * g.W * (y - hy)) / (g.H - hy);
  }

  function fieldClip(ctx, g, y0, y1, q0, q1) {
    quadPath(ctx, groundX(g, q0, y0), y0, groundX(g, q1, y0), y0, groundX(g, q1, y1), y1, groundX(g, q0, y1), y1);
  }

  function paintRows(ctx, g, rand, y0, y1, q0, q1) {
    const hy = g.H * HOR;
    const rel = (y1 - hy) / (g.H - hy);
    const spacing = Math.max(g.U * 4.2, 3 / Math.max(rel, 0.02));
    const step = spacing / g.W;
    ctx.lineWidth = Math.max(1, spacing * rel * lerp(0.46, 0.66, rel));
    ctx.setLineDash([g.U * 4 * rel + 1, g.U * 0.35 * rel]);
    ctx.strokeStyle = rand() < 0.5 ? '#5a9440' : '#6aa247';
    ctx.beginPath();
    for (let q = q0; q < q1; q += step) {
      ctx.moveTo(groundX(g, q, y0), y0);
      ctx.lineTo(groundX(g, q, y1), y1);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function paintField(ctx, g, rand, y0, y1, q0, q1) {
    const lush = ['#86b552', '#76a84a', '#98c25c'];
    ctx.save();
    fieldClip(ctx, g, y0, y1, q0, q1);
    ctx.clip();
    if (rand() < 0.42) {
      ctx.fillStyle = lush[Math.floor(rand() * lush.length)];
      ctx.fillRect(0, y0, g.W, y1 - y0 + 1);
    }
    paintRows(ctx, g, rand, y0, y1, q0, q1);
    ctx.restore();
    const rel = (y1 - g.H * HOR) / (g.H * (1 - HOR));
    ctx.strokeStyle = '#a3a662';
    ctx.lineWidth = Math.max(1, g.U * 1.3 * rel);
    fieldClip(ctx, g, y0, y1, q0, q1);
    ctx.stroke();
  }

  function paintPaddies(ctx, g, rand) {
    const hy = g.H * HOR;
    const depth = [0, 0.035, 0.08, 0.15, 0.26, 0.44, 0.72, 1.2];
    for (let r = 0; r < depth.length - 1; r++) {
      const y0 = hy + depth[r] * (g.H - hy);
      const y1 = hy + depth[r + 1] * (g.H - hy);
      let q = -3 - rand();
      while (q < 3) {
        const next = q + 0.4 + rand() * 0.5;
        paintField(ctx, g, rand, y0, y1, q, next);
        q = next;
      }
    }
  }

  function paintLand(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ridge(ctx, g, '#a9c3d0', HOR - 0.04, 0.17, 0.011, 3);
    ridge(ctx, g, '#88ad90', HOR - 0.01, 0.09, 0.019, 8);
    paintFarHouse(ctx, g, g.W * 0.9);
    paintTrees(ctx, g, rand);
    ctx.fillStyle = '#86b552';
    ctx.fillRect(0, g.H * HOR - 1, g.W, Math.max(1.5, g.U * 0.6));
    paintPaddies(ctx, g, rand);
    return c;
  }

  function paintTrack(ctx, g) {
    ctx.fillStyle = '#c5b68f';
    const y = heightY(g, NEAR, FOOT);
    quad(ctx, g.W * VPX, g.H * HOR, g.W * VPX, g.H * HOR, g.W * (VPX - NEAR * PATH_X), y, wallX(g, NEAR), y);
  }

  function paintPlaster(ctx, g, rand) {
    wallQuad(ctx, g, END, NEAR, FOOT, 1, '#efe5c9');
    const tones = ['#e1d6b8', '#f6eed6', '#d6caa8'];
    for (let i = 0; i < g.W * g.H * 0.05; i++) {
      const x = rand() * g.W * 0.5;
      const s = (g.W * VPX - x) / (g.W * WALL_X);
      if (s < END) continue;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      const y = heightY(g, s, lerp(-0.2, 0.86, rand()));
      ctx.fillRect(x, y, Math.max(1, g.U * (0.4 + rand() * 1.6)), Math.max(1, g.U * (0.3 + rand() * 0.8)));
    }
    wallQuad(ctx, g, END, NEAR, 0.84, 0.66, 'rgba(120,104,78,0.34)');
    wallQuad(ctx, g, END, NEAR, 0.66, 0.52, 'rgba(120,104,78,0.16)');
  }

  function paintBoards(ctx, g) {
    wallQuad(ctx, g, END, NEAR, FOOT, -0.126, '#a58a6a');
    ctx.strokeStyle = '#806a50';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let z = 0.72; z < 2.8; z += 0.085) {
      const s = 1 / z;
      if (s < END) break;
      seg(ctx, wallX(g, s), heightY(g, s, -0.126), wallX(g, s), heightY(g, s, FOOT));
    }
    wallQuad(ctx, g, END, NEAR, -0.025, -0.126, '#6c5741');
    wallQuad(ctx, g, END, NEAR, -0.025, -0.046, '#8e775a');
  }

  function paintPost(ctx, g, s0, s1) {
    wallQuad(ctx, g, s0, s1, FOOT, 0.9, '#665340');
    wallQuad(ctx, g, s0, lerp(s0, s1, 0.25), FOOT, 0.9, '#846d54');
  }

  function paintBeam(ctx, g) {
    wallQuad(ctx, g, END, NEAR, 1, 0.84, '#6e5a45');
    wallQuad(ctx, g, END, NEAR, 0.875, 0.84, '#8a7358');
    ctx.strokeStyle = '#59483a';
    ctx.lineWidth = 1;
    for (const v of [0.97, 0.93, 0.9]) seg(ctx, wallX(g, END), heightY(g, END, v), wallX(g, NEAR), heightY(g, NEAR, v));
  }

  function paintSoffit(ctx, g) {
    ctx.fillStyle = '#b0946f';
    quad(ctx, wallX(g, END), heightY(g, END, 1), eaveX(g, END, EAVE_X), heightY(g, END, 1),
      eaveX(g, NEAR, EAVE_X), heightY(g, NEAR, 1), wallX(g, NEAR), heightY(g, NEAR, 1));
    ctx.strokeStyle = '#967c5b';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let f = 0.06; f < 1; f += 0.075) {
      const e = lerp(-WALL_X, EAVE_X, f);
      seg(ctx, g.W * (VPX + END * e), heightY(g, END, 1), g.W * (VPX + NEAR * e), heightY(g, NEAR, 1));
    }
  }

  function paintRafters(ctx, g) {
    const span = (s, y, h, colour) => {
      ctx.fillStyle = colour;
      const l = wallX(g, s);
      ctx.fillRect(l, y, eaveX(g, s, EAVE_X) - l, h);
    };
    for (let z = 1 / END; z > 0.7; z -= 0.27) {
      const s = 1 / z;
      const far = 1 / (z + 0.075);
      const low = heightY(g, s, 0.94);
      const lowFar = heightY(g, far, 0.94);
      span(far, lowFar, low - lowFar, '#8a7054');
      span(s, low, heightY(g, s, 0.86) - low, '#68543f');
    }
  }

  function paintPurlin(ctx, g) {
    const e0 = EAVE_X * 0.35;
    const e1 = EAVE_X * 0.62;
    const y0 = heightY(g, END, 0.86);
    const y1 = heightY(g, NEAR, 0.86);
    ctx.fillStyle = '#6d5943';
    quad(ctx, eaveX(g, END, e0), y0, eaveX(g, END, e1), y0, eaveX(g, NEAR, e1), y1, eaveX(g, NEAR, e0), y1);
  }

  function paintThatch(ctx, g, rand) {
    const inner = EAVE_X;
    const outer = EAVE_X + THATCH_X;
    ctx.fillStyle = '#a8925f';
    quad(ctx, eaveX(g, END, inner), heightY(g, END, 1), eaveX(g, END, outer), heightY(g, END, 1.02),
      eaveX(g, NEAR, outer), heightY(g, NEAR, 1.02), eaveX(g, NEAR, inner), heightY(g, NEAR, 1));
    const tones = ['#c2ac74', '#8c7a50', '#d6c388', '#766644'];
    for (let i = 0; i < 700; i++) {
      const s = lerp(END, 1.05, Math.pow(rand(), 0.8));
      const y = heightY(g, s, 1);
      if (y < -4) continue;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(eaveX(g, s, lerp(inner, outer, rand())), y, Math.max(1, s * g.U * 3), Math.max(1, s * g.U * 0.5));
    }
    ctx.fillStyle = '#6a5642';
    ctx.fillRect(wallX(g, END), heightY(g, END, 1) - g.U * 0.2, eaveX(g, END, outer) - wallX(g, END), Math.max(1.5, g.U * 1.3));
  }

  function paintHouse(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintTrack(ctx, g);
    paintPlaster(ctx, g, rand);
    paintBoards(ctx, g);
    paintPost(ctx, g, END, END + 0.026);
    paintPost(ctx, g, 0.75, 0.81);
    paintSoffit(ctx, g);
    paintBeam(ctx, g);
    paintRafters(ctx, g);
    paintPurlin(ctx, g);
    paintThatch(ctx, g, rand);
    ctx.fillStyle = 'rgba(96,82,60,0.42)';
    oval(ctx, state.nest.x + g.U * 3, state.nest.rim + state.nest.h * 0.42, state.nest.w * 0.54, state.nest.h * 0.72, 0);
    return c;
  }

  function cupPath(ctx, n, u) {
    const hw = n.w / 2;
    ctx.beginPath();
    ctx.moveTo(n.x - hw, n.rim);
    ctx.quadraticCurveTo(n.x, n.rim + u * 6, n.x + hw, n.rim);
    ctx.bezierCurveTo(n.x + hw * 1.14, n.rim + n.h * 0.42, n.x + hw * 0.62, n.rim + n.h, n.x, n.rim + n.h);
    ctx.bezierCurveTo(n.x - hw * 0.62, n.rim + n.h, n.x - hw * 1.14, n.rim + n.h * 0.42, n.x - hw, n.rim);
    ctx.closePath();
  }

  function paintNestBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const n = state.nest;
    const u = g.U;
    ctx.fillStyle = '#5c4630';
    ctx.beginPath();
    ctx.ellipse(n.x, n.rim, n.w / 2, u * 6, 0, Math.PI, 0);
    ctx.lineTo(n.x + n.w / 2, n.rim + u * 6);
    ctx.lineTo(n.x - n.w / 2, n.rim + u * 6);
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + rand() * Math.PI;
      ctx.fillStyle = MUD[Math.floor(rand() * MUD.length)];
      disc(ctx, n.x + Math.cos(a) * n.w * 0.49, n.rim + Math.sin(a) * u * 5.8, u * (0.7 + rand() * 0.8));
    }
    return c;
  }

  // Mud goes on in courses, so the pellets run in rows that follow the cup.
  function paintPellets(ctx, g, rand) {
    const n = state.nest;
    const u = g.U;
    const rows = Math.ceil(n.h / (u * 2.5)) + 1;
    for (let r = 0; r < rows; r++) {
      const f = r / (rows - 1);
      const y = n.rim + f * n.h + u * 2 * (1 - f);
      for (let x = -n.w * 0.54; x < n.w * 0.54; x += u * (2.4 + rand() * 1.2)) {
        const bow = (x / n.w) * (x / n.w) * u * 9;
        const shade = Math.min(4, Math.floor(f * 2.4 + rand() * 1.6));
        ctx.fillStyle = MUD[[4, 2, 0, 1, 3][shade]];
        oval(ctx, n.x + x, y - bow + (rand() - 0.5) * u * 0.8, u * (1.3 + rand() * 0.7), u * (0.9 + rand() * 0.5), (rand() - 0.5) * 0.6);
      }
    }
  }

  // Lumps round the outside and along the rim, so the cup has no clean edge.
  function paintLumps(ctx, g, rand) {
    const n = state.nest;
    const u = g.U;
    for (let i = 0; i <= 44; i++) {
      const f = i / 44;
      const low = Math.sin(f * Math.PI);
      ctx.fillStyle = MUD[low > 0.7 ? 3 : 1];
      disc(ctx, n.x + Math.cos(f * Math.PI) * n.w * 0.5, n.rim + Math.pow(low, 0.8) * n.h * 0.97, u * (0.8 + rand() * 0.8));
      ctx.fillStyle = MUD[rand() < 0.6 ? 4 : 2];
      disc(ctx, n.x + (f - 0.5) * n.w, n.rim + low * low * u * 3 + (rand() - 0.5) * u * 0.7, u * (0.9 + rand() * 0.7));
    }
  }

  function paintNestFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    cupPath(ctx, state.nest, g.U);
    ctx.fillStyle = MUD[1];
    ctx.fill();
    ctx.clip();
    paintPellets(ctx, g, rand);
    ctx.restore();
    paintLumps(ctx, g, rand);
    return c;
  }

  function tangent(keys, i, c) {
    const n = keys.length;
    if (keys[i][4] === 1) return 0;
    const a = keys[(i - 1 + n) % n];
    const b = keys[(i + 1) % n];
    const dt = (b[0] - a[0] + 1) % 1 || 1;
    return (b[c] - a[c]) / dt;
  }

  function sampleKeys(keys, f, c) {
    let i = keys.length - 1;
    while (i > 0 && keys[i][0] > f) i--;
    const a = keys[i];
    const b = keys[(i + 1) % keys.length];
    const h = (b[0] - a[0] + 1) % 1 || 1;
    const local = ((f - a[0] + 1) % 1) / h;
    if (c === 4) return lerp(a[4], b[4], smoothstep(0, 1, local));
    const l2 = local * local;
    const l3 = l2 * local;
    const m0 = tangent(keys, i, c);
    const m1 = tangent(keys, (i + 1) % keys.length, c);
    return (2 * l3 - 3 * l2 + 1) * a[c] + (l3 - 2 * l2 + local) * h * m0 + (3 * l2 - 2 * l3) * b[c] + (l3 - l2) * h * m1;
  }

  function smoothHeadings(p) {
    for (let pass = 0; pass < 3; pass++) {
      const cx = p.hc.slice();
      const cy = p.hs.slice();
      for (let i = 0; i < STEPS; i++) {
        let sx = 0;
        let sy = 0;
        for (let j = -5; j <= 5; j++) {
          sx += cx[(i + j + STEPS) % STEPS];
          sy += cy[(i + j + STEPS) % STEPS];
        }
        const l = Math.hypot(sx, sy) || 1;
        p.hc[i] = sx / l;
        p.hs[i] = sy / l;
      }
    }
  }

  function buildFlight(g, keys, holdC, holdS) {
    const p = {
      x: new Float32Array(STEPS), y: new Float32Array(STEPS), s: new Float32Array(STEPS),
      w: new Float32Array(STEPS), hc: new Float32Array(STEPS), hs: new Float32Array(STEPS),
    };
    for (let i = 0; i < STEPS; i++) {
      const f = i / STEPS;
      p.x[i] = sampleKeys(keys, f, 1) * g.W;
      p.y[i] = sampleKeys(keys, f, 2) * g.H;
      p.s[i] = sampleKeys(keys, f, 3);
      p.w[i] = sampleKeys(keys, f, 4);
    }
    for (let i = 0; i < STEPS; i++) {
      const a = (i - 3 + STEPS) % STEPS;
      const b = (i + 3) % STEPS;
      const dx = p.x[b] - p.x[a];
      const dy = p.y[b] - p.y[a];
      const l = Math.hypot(dx, dy) || 1;
      const hx = lerp(dx / l, holdC, p.w[i]);
      const hy = lerp(dy / l, holdS, p.w[i]);
      const m = Math.hypot(hx, hy) || 1;
      p.hc[i] = hx / m;
      p.hs[i] = hy / m;
    }
    smoothHeadings(p);
    return p;
  }

  // Fills gape and lift for the four chicks from the two adults' clocks.
  function updateChicks(g, t) {
    const c = state.chicks;
    const inHold = HOLD * FLIGHT;
    let beg = 0;
    for (let a = 0; a < 2; a++) {
      const clock = t + a * FLIGHT * 0.5;
      const tau = clock % FLIGHT;
      const visit = Math.floor(clock / FLIGHT) + (tau > FLIGHT * 0.5 ? 1 : 0);
      const level = Math.max(smoothstep(FLIGHT - 3.4, FLIGHT - 0.7, tau), 1 - smoothstep(inHold * 0.85, inHold + 1, tau));
      state.adults[a].fed = FEED_ORDER[(visit + a) % 4];
      state.adults[a].level = level;
      beg = Math.max(beg, level);
    }
    for (let i = 0; i < 4; i++) {
      const idle = smoothstep(0.5, 0.92, Math.sin(t * 0.47 + i * 2.1) * 0.5 + Math.sin(t * 1.13 + i * 1.3) * 0.5) * 0.7;
      const asking = beg * (0.46 + 0.2 * Math.sin(t * 4.6 + i * 1.9));
      let fed = 0;
      for (const adult of state.adults) if (adult.fed === i) fed = Math.max(fed, adult.level);
      c.gape[i] = Math.max(idle, asking, fed);
      c.lift[i] = g.U * (0.7 * Math.sin(t * 1.7 + i * 1.9) + beg * 0.9 * Math.sin(t * 6.2 + i * 2.3));
    }
  }

  function chickHeadY(g, i) {
    const c = state.chicks;
    return state.nest.rim - g.U * (3.4 + 4.6 * c.gape[i]) - c.lift[i];
  }

  function chickMouthTop(g, i) {
    return chickHeadY(g, i) - g.U * 6 * (0.05 + 1.3 * state.chicks.gape[i]);
  }

  function diamond(ctx, x, cy, hw, top, low, lean) {
    quad(ctx, x - hw, cy, x + lean, cy - top, x + hw, cy, x, cy + low);
  }

  function drawMouth(ctx, x, y, r, gape, lean) {
    if (gape < 0.1) {
      ctx.fillStyle = '#efcb50';
      diamond(ctx, x, y + r * 0.2, r * 0.86, r * 0.12, r * 0.5, 0);
      ctx.fillStyle = '#8a7444';
      ctx.fillRect(x - r * 0.62, y + r * 0.2, r * 1.24, Math.max(1, r * 0.1));
      return;
    }
    const cy = y + r * 0.2;
    const hw = r * (0.8 + 0.16 * gape);
    const top = r * (0.25 + 1.3 * gape);
    const low = r * (0.25 + 0.5 * gape);
    const tip = lean * gape;
    ctx.fillStyle = '#f2d05a';
    diamond(ctx, x, cy, hw, top, low, tip);
    ctx.fillStyle = '#e88f3a';
    diamond(ctx, x, cy, hw * 0.8, top * 0.84, low * 0.76, tip * 0.84);
    ctx.fillStyle = '#b5482e';
    oval(ctx, x, cy, hw * 0.34, Math.max(1, low * 0.46), 0);
  }

  function drawFluff(ctx, x, y, r, u) {
    const tuft = Math.max(1, u * 0.7);
    ctx.fillStyle = '#dcdbd6';
    for (let k = -2; k <= 2; k++) {
      const rise = k % 2 === 0 ? 1.5 : 0.5;
      ctx.fillRect(x + k * r * 0.36 - tuft / 2, y - r * (1.02 - Math.abs(k) * 0.11) - tuft * rise, tuft, tuft * 2);
    }
    ctx.fillRect(x - r * 1.14, y + r * 0.2, tuft * 1.6, tuft);
    ctx.fillRect(x + r * 1.14 - tuft * 1.6, y + r * 0.2, tuft * 1.6, tuft);
  }

  function drawChick(ctx, g, i) {
    const u = g.U;
    const r = u * 6;
    const x = state.nest.x + CHICK_X[i] * u * state.nest.scale;
    const y = chickHeadY(g, i);
    const bottom = state.nest.rim + u * 5;
    ctx.fillStyle = '#8e8e96';
    ctx.fillRect(x - r * 0.84, y, r * 1.68, bottom - y);
    ctx.fillStyle = '#e6dcc2';
    oval(ctx, x, y + r * 1.75, r * 0.6, r * 1.05, 0);
    ctx.fillStyle = '#8e8e96';
    disc(ctx, x, y, r);
    drawFluff(ctx, x, y, r, u);
    ctx.fillStyle = '#20212f';
    const eye = Math.max(1, r * 0.24);
    ctx.fillRect(x - r * 0.82, y - r * 0.26, eye, eye);
    ctx.fillRect(x + r * 0.82 - eye, y - r * 0.26, eye, eye);
    drawMouth(ctx, x, y, r, state.chicks.gape[i], CHICK_LEAN[i] * r);
  }

  function drawWing(ctx, rootA, rootB, rootY, tipX, tipY, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(rootA, rootY);
    ctx.quadraticCurveTo(rootA - 2, tipY * 0.72, tipX, tipY);
    ctx.quadraticCurveTo(rootB - 1, tipY * 0.42, rootB, rootY);
    ctx.fill();
  }

  // Side view with the bill at +x, drawn in units of g.U and baked once as shapes.
  function makeBirdShapes() {
    return [
      ['#26315c', new Path2D('M-6-1.8L-28-4L-12-.2L-26 4.2L-6 1.8Z M11.5 .3Q8-3.4 2-3.4Q-5-3.2-10-.8Q-5 3.6 1 3.8Q8 3.4 11.5 .3Z')],
      ['#ece3cc', new Path2D('M4 1.6Q-3 1.6-9-.4Q-4 3.6 1 3.8Q3.5 3.7 5 3Z')],
      ['#bd4e2e', new Path2D('M10.6 .8Q8 0 4 1.2L4.6 3.2Q8 3 10.6 .8Z M8.2-2.1h1.8v1.2h-1.8Z')],
      ['#10121c', new Path2D('M6.6-1.5h1.2v1.2h-1.2Z')],
    ];
  }

  function drawAdult(ctx, g, x, y, k, hc, hs, flap) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(hs, hc));
    ctx.scale(g.U * k, hc < 0 ? -g.U * k : g.U * k);
    drawWing(ctx, 5, -5, -2, -17, -17 - 10 * flap, '#333f6e');
    for (const shape of state.birdShapes) {
      ctx.fillStyle = shape[0];
      ctx.fill(shape[1]);
    }
    drawWing(ctx, 6, -6, -0.5, -21, 13 - 15 * flap, '#222c54');
    ctx.restore();
  }

  function drawFlyer(ctx, g, a, t) {
    const adult = state.adults[a];
    const p = adult.path;
    const clock = (t + a * FLIGHT * 0.5) % FLIGHT;
    const pos = (clock / FLIGHT) * STEPS;
    const i = Math.floor(pos) % STEPS;
    const n = (i + 1) % STEPS;
    const f = pos - Math.floor(pos);
    const w = lerp(p.w[i], p.w[n], f);
    const k = lerp(p.s[i], p.s[n], f);
    const hc = lerp(p.hc[i], p.hc[n], f);
    const hs = lerp(p.hs[i], p.hs[n], f);
    const lean = CHICK_LEAN[adult.fed] * g.U * 6 * state.chicks.gape[adult.fed];
    const billX = state.nest.x + CHICK_X[adult.fed] * g.U * state.nest.scale + lean - hc * 11.5 * g.U * k;
    const billY = chickMouthTop(g, adult.fed) - hs * 11.5 * g.U * k - g.U * 1.2;
    const x = lerp(lerp(p.x[i], p.x[n], f), billX, w);
    const y = lerp(lerp(p.y[i], p.y[n], f), billY, w);
    const gate = smoothstep(0.15, 0.55, Math.sin(t * 0.8 + a * 2.2));
    const fly = 0.32 + 0.62 * Math.sin(t * 9.5 + a) * gate;
    const hover = 0.45 + 0.38 * Math.sin(t * 12 + a);
    drawAdult(ctx, g, x, y, k, hc, hs, lerp(fly, hover, w));
  }

  function drawFarBirds(ctx, g, t, count) {
    ctx.strokeStyle = '#2b3660';
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const b = state.far[i];
      const x = g.W * (0.68 + 0.3 * Math.sin(t * b.rx + b.px));
      const y = g.H * (0.5 + 0.1 * Math.sin(t * b.ry + b.py));
      const w = b.size * (1 + 0.25 * Math.sin(t * 7 + b.px));
      const up = b.size * (0.45 + 0.4 * Math.sin(t * 8 + b.py));
      ctx.moveTo(x - w, y - up);
      ctx.lineTo(x, y);
      ctx.lineTo(x + w, y - up);
    }
    ctx.stroke();
  }

  function listOf(count, make) {
    return Array.from({ length: count }, (_, i) => make(i));
  }

  function makeGlint(g, rand) {
    const rel = 0.05 + Math.pow(rand(), 1.6) * 0.95;
    const x = g.W * (0.42 + rand() * 0.6);
    const w = Math.max(1, rel * g.U * (2 + rand() * 4));
    const y = g.H * HOR + rel * g.H * (1 - HOR);
    return { x, y, w, h: Math.max(1, rel * g.U * 0.5), phase: rand() * 6.28, rate: 0.5 + rand() * 0.9 };
  }

  function makeBlade(g, rand, i) {
    const x = g.W * (i < BLADES * 0.35 ? 0.46 + rand() * 0.07 : 0.86 + rand() * 0.16);
    const tone = rand() < 0.5 ? '#7fae4c' : '#a0c862';
    return { x, len: g.U * (9 + rand() * 11), lean: (rand() - 0.5) * g.U * 5, phase: rand() * 6.28, tone };
  }

  function makeFarBird(g, rand) {
    const size = g.U * (0.9 + rand() * 0.9);
    return { rx: 0.08 + rand() * 0.14, ry: 0.2 + rand() * 0.3, px: rand() * 6.28, py: rand() * 6.28, size };
  }

  function drawGlints(ctx, t, breeze) {
    ctx.fillStyle = '#e8f1ee';
    for (const m of state.glints) {
      const a = Math.sin(t * m.rate * (0.5 + breeze * 0.5) + m.phase);
      if (a < 0.2) continue;
      ctx.globalAlpha = (a - 0.2) * 0.36;
      ctx.fillRect(m.x, m.y, m.w, m.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawBlades(ctx, g, t, breeze) {
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    ctx.lineCap = 'round';
    for (const b of state.blades) {
      const sway = Math.sin(t * 1.1 + b.phase) * g.U * 2.2 * breeze;
      ctx.strokeStyle = b.tone;
      ctx.beginPath();
      ctx.moveTo(b.x, g.H + 1);
      ctx.quadraticCurveTo(b.x + b.lean * 0.3, g.H - b.len * 0.6, b.x + b.lean + sway, g.H - b.len);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    const fit = Math.min(1, (g.W * 0.32) / (g.U * 46));
    state.nest = { x: g.W * 0.27, rim: g.H * 0.47, w: g.U * 46 * fit, h: g.U * 23 * fit, scale: fit };
    state.sky = paintSky(g);
    state.clouds = paintClouds(Math.ceil(g.W * 0.75), Math.ceil(g.H * 0.3));
    state.land = paintLand(g, rand);
    state.house = paintHouse(g, rand);
    state.nestBack = paintNestBack(g, rand);
    state.nestFront = paintNestFront(g, rand);
    state.chicks = { gape: new Float32Array(4), lift: new Float32Array(4) };
    state.adults = [
      { path: buildFlight(g, FLIGHT_A, -0.86, 0.5), fed: 2, level: 0 },
      { path: buildFlight(g, FLIGHT_B, -0.76, 0.65), fed: 0, level: 0 },
    ];
    state.birdShapes = makeBirdShapes();
    state.far = listOf(FAR_BIRDS, () => makeFarBird(g, rand));
    state.glints = listOf(GLINTS, () => makeGlint(g, rand));
    state.blades = listOf(BLADES, (i) => makeBlade(g, rand, i));
  }

  function slideTile(ctx, img, x, y, w, h) {
    ctx.drawImage(img, x, y, w, h);
    ctx.drawImage(img, x + w, y, w, h);
  }

  function drawClouds(ctx, g, t, breeze) {
    const w = state.clouds.width * 2;
    const h = state.clouds.height * 2;
    const x = -((t * g.U * (0.5 + breeze)) % w);
    slideTile(ctx, state.clouds, x, g.H * 0.06, w, h);
    ctx.save();
    ctx.translate(0, g.H * HOR * 2);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.3;
    slideTile(ctx, state.clouds, x, g.H * 0.06, w, h);
    ctx.restore();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const breeze = api.props.breeze;
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, breeze);
    ctx.drawImage(state.land, 0, 0);
    drawGlints(ctx, t, breeze);
    drawFarBirds(ctx, g, t, Math.min(FAR_BIRDS, Math.round(api.props.flock)));
    ctx.drawImage(state.house, 0, 0);
    drawBlades(ctx, g, t, breeze);
    updateChicks(g, t);
    ctx.drawImage(state.nestBack, 0, 0);
    for (let i = 0; i < 4; i++) drawChick(ctx, g, i);
    ctx.drawImage(state.nestFront, 0, 0);
    drawFlyer(ctx, g, 1, t);
    drawFlyer(ctx, g, 0, t);
  }

  Kasuri.run({
    defaults: { breeze: 1, flock: 3, ramp: 'lines', cell: 7, boost: 0.12, gain: 1.08, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
