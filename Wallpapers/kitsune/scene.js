/*
 * 狐 Kitsune — a red fox mousing in deep snow among birches at dawn.
 *
 * The field, the trees and the sky are baked once. The fox is a small skeleton
 * of about thirty short paths, posed from a keyed timeline, and its feet and
 * nose simply go behind a baked lip of snow. Thrown snow is worked out from
 * the clock, so nothing is stored or allocated while it plays.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  // Fields of a pose: height of the body, pitch, neck, head, tail droop, tail
  // curl, then the front and hind foot relative to the middle of the body.
  const RY = 0, PITCH = 1, NECK = 2, HEAD = 3, TAIL = 4, CURL = 5, FFX = 6, FFY = 7, HFX = 8, HFY = 9;
  const POSE = {
    stand: [19.5, -0.03, -1.0, 0.12, 0.6, -0.55, 11, 19.5, -11, 19.5],
    listen: [19, 0, -0.72, 0.55, 0.52, -0.5, 11, 19, -11, 19],
    crouch: [12.5, -0.17, -0.34, 0.72, 0.18, -0.2, 14, 12.5, -7, 12.5],
    push: [19, -0.7, -1.1, 0.1, 0.7, -0.2, 10, 8, -13, 19],
    apex: [0, 0.05, -0.2, 0.55, -0.3, 0.2, 15, 9, -21, 9],
    dive: [13, 0.95, 1.2, 1.35, 1, -0.45, 8, 20, -14, 4],
    pull: [17, 0.3, -0.1, 0.6, 0.5, -0.4, 12, 17, -10, 17],
    shake: [19, 0, -0.55, 0.22, 0.5, -0.3, 11, 19, -11, 19],
    walk: [19, 0.02, -0.55, 0.3, 0.75, -0.7, 11, 19, -11, 19],
  };
  const KEYS = [
    [0, POSE.stand], [3.5, POSE.stand], [5, POSE.listen], [7.5, POSE.listen], [8.6, POSE.stand],
    [9.6, POSE.stand], [10.6, POSE.listen], [12, POSE.crouch], [13.5, POSE.crouch], [13.9, POSE.push],
    [15, POSE.apex], [16.1, POSE.dive], [19.5, POSE.dive], [20.8, POSE.pull], [21.6, POSE.shake],
    [24.6, POSE.shake], [25.6, POSE.stand], [27.5, POSE.stand], [29, POSE.walk], [37, POSE.walk],
    [38.5, POSE.stand], [39, POSE.stand],
  ];
  const LOOP = 39;
  const LEAP_FROM = 13.9;
  const LEAP_TO = 16.1;
  const LEAP_RISE = 34;
  const WALK_FROM = 29;
  const WALK_TO = 37;
  const START_X = -16;
  const LAND_X = 22;
  const REST_X = LAND_X - 3;
  const STRIDE_TIME = 1.6;
  const WALK_SPAN = WALK_TO - WALK_FROM;
  const WALK_DIST = REST_X - START_X;
  const WALK_TOP = WALK_DIST / (WALK_SPAN - STRIDE_TIME);
  const STRIDE = WALK_TOP * STRIDE_TIME;
  const TURN_OUT = 27.85;
  const TURN_BACK = 37.05;
  const TURN_TIME = 1.12;
  const TURN_SWING = 0.36;
  const SHADOW_FALL = 0.42;
  const SIDES = [-1, 1];
  const TAU = Math.PI * 2;
  const QUARTER = Math.PI / 2;

  const TAIL_N = 12;
  const TAIL_LEN = 23;
  const STREAKS = 170;

  const SKY = ['#7f8dbd', '#c0acd0', '#f2bcbc', '#fbd3b6', '#fde6cc'];
  const SKY_AT = [0, 0.38, 0.68, 0.9, 1];
  const FUR = { rust: '#d8602c', lit: '#f0924a', deep: '#94402a', cream: '#f3e8d8', sock: '#2f2b3f', dark: '#221f2d', dust: '#fbf7f1' };
  const SHADE = '#9dabd2';
  const SHADOW = { rust: SHADE, lit: SHADE, deep: SHADE, cream: SHADE, sock: SHADE, dark: SHADE, dust: SHADE };

  // Fox shapes in fox units, facing right.
  const SHAPES = {
    body: 'M-14 -1C-13.5 -6 -6 -6.6 1 -5.6C6 -5 9 -7 13 -5.6C15.4 -2 15.6 2 12 5.6C7 6.4 1 5.2 -4 4.4C-9 3.8 -14 5 -14 -1Z',
    back: 'M-13 -2.8C-11 -6 -6 -6.6 1 -5.6C6 -5 9 -7 12.6 -5.6C9 -3.8 5 -2.6 0 -3C-5 -3.3 -9 -3 -13 -2.8Z',
    belly: 'M11.6 5.7C7 6.3 1 5.2 -4 4.4C1 3.7 7 3.9 11.6 5.7Z',
    skull: 'M-4.6 -0.5C-4 -3.6 -0.6 -4.5 2 -3.2C4 -2.2 6.6 -1.1 8.8 -0.7L9 0.5C6.6 1.7 3.6 2.2 1.2 2.8C-1 3.8 -3.6 3.8 -5.8 3.6Z',
    cheek: 'M8.6 0.3C5 0.7 1.5 0.4 -1.6 1.1C-3 1.6 -4.6 2.6 -5.8 3.6C-3.6 3.8 -1 3.8 1.2 2.8C3.6 2.2 6.6 1.7 8.6 0.6Z',
    ear: 'M-1.9 0.4L0 -6.8L1.9 0.4Z',
    earTip: 'M-0.85 -3.6L0 -6.8L0.85 -3.6Z',
    earIn: 'M-0.3 0L0.35 -3.2L1.2 0Z',
  };

  const state = {};
  const ik = { kx: 0, ky: 0, fx: 0, fy: 0, c: 1, s: 0, ry: 0 };

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, turn) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, turn || 0, 0, TAU);
    ctx.fill();
  }

  // Flat tones of noise on a transparent tile, seamless left to right.
  function noiseTile(w, h, rgb, density, tones, opacity) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w) * (0.5 + band * 0.5);
        const i = (y * w + x) * 4;
        img.data.set(rgb, i);
        img.data[i + 3] = (Math.round(smoothstep(0.4, 0.58, v) * tones) / tones) * opacity;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function lipY(g, x) {
    const ux = x / g.U;
    return g.ground + g.U * (1.5 + Math.sin(ux * 0.09) * 0.5 + Math.sin(ux * 0.23 + 1) * 0.3);
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.horizon);
    SKY.forEach((colour, i) => sky.addColorStop(SKY_AT[i], colour));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    const r = g.U * 46;
    const glow = ctx.createRadialGradient(g.sunX, g.horizon - g.U * 22, 0, g.sunX, g.horizon - g.U * 22, r);
    glow.addColorStop(0, 'rgba(255,222,190,0.8)');
    glow.addColorStop(0.3, 'rgba(250,186,165,0.3)');
    glow.addColorStop(1, 'rgba(240,170,165,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#fff6e4';
    blob(ctx, g.sunX, g.horizon - g.U * 22, g.U * 5, g.U * 5);
    return c;
  }

  function ridge(ctx, g, base, height, freq, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.horizon + g.U);
    for (let x = 0; x <= g.W + 2; x += 1) ctx.lineTo(x, g.U * (base - fbm((x / g.U) * freq, seed, 4, seed) * height));
    ctx.lineTo(g.W, g.horizon + g.U);
    ctx.fill();
  }

  function paintFarWoods(ctx, g, rand) {
    const hy = g.horizon / g.U;
    ridge(ctx, g, hy + 1, 26, 0.022, 3, '#c9b8d6');
    ridge(ctx, g, hy + 2, 16, 0.05, 7, '#afa8d0');
    ctx.fillStyle = '#9493c2';
    ctx.beginPath();
    ctx.moveTo(0, g.horizon + g.U * 2);
    for (let x = 0; x <= g.W + 2; x += 1) {
      const ux = x / g.U;
      const top = hy + 1 - fbm(ux * 0.07, 11, 3, 11) * 9 - fbm(ux * 0.6, 3, 2, 13) * 1.6;
      ctx.lineTo(x, top * g.U);
    }
    ctx.lineTo(g.W, g.horizon + g.U * 2);
    ctx.fill();
    paintGrove(ctx, g, rand);
    const mist = ctx.createLinearGradient(0, g.horizon - g.U * 7, 0, g.horizon + g.U);
    mist.addColorStop(0, 'rgba(250,222,214,0)');
    mist.addColorStop(1, 'rgba(250,226,218,0.85)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, g.horizon - g.U * 7, g.W, g.U * 8);
  }

  // Crowns of far bare trees: clustered soft blots, never straight tops.
  function paintGrove(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#7f80b0';
    for (let i = 0; i < g.W / (u * 1.2); i++) {
      const x = rand() * g.W;
      const top = g.horizon - u * (2 + fbm((x / u) * 0.07, 11, 3, 11) * 10);
      for (let k = 0; k < 4; k++) {
        const r = u * (0.5 + rand() * 1.3);
        blob(ctx, x + (rand() - 0.5) * u * 3.4, top + rand() * u * 4, r, r);
      }
    }
  }

  // The field: flat tones of wind-cut snow, pink towards the sun, blue away.
  function paintSnow(g) {
    const w = Math.ceil(g.W / 2);
    const top = Math.floor(g.horizon / 2);
    const h = Math.ceil(g.H / 2) - top + 1;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const shade = K.parseColor('#bcc7e6');
    const lit = K.parseColor('#efe5e6');
    const warm = K.parseColor('#f6bfb2');
    const U = g.U / 2;
    for (let y = 0; y < h; y++) {
      const d = y / h;
      const near = 0.28 + d;
      for (let x = 0; x < w; x++) {
        const ux = x / U;
        const uy = (y + top) / U;
        const v = fbm(ux * 0.03 / near, uy * 0.16 / near, 3, 5);
        const tone = Math.round(K.clamp((v - 0.32) * 2.6, 0, 1) * 5) / 5;
        const sun = 1 - Math.min(1, Math.hypot(ux - g.sunX / g.U, (uy - g.horizon / g.U) * 2.4) / 80);
        const heat = (Math.round(sun * 3) / 3) * 0.62 * (1 - d * 0.55);
        const rgb = K.mixColor(K.mixColor(shade, lit, tone), warm, heat);
        const i = (y * w + x) * 4;
        img.data.set(rgb, i);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, top: top * 2 };
  }

  // Tree shadows fan out from the point on the horizon under the sun.
  function paintTreeShadow(ctx, g, x, y, width) {
    const dy = y - g.horizon;
    const away = x - g.sunX;
    const dx = Math.abs(away) < dy * 0.5 ? (away < 0 ? -1 : 1) * dy * 0.5 : away;
    const k = (g.H * 1.4) / Math.max(1, dy);
    const ex = x + dx * k;
    const ey = y + dy * k;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    ctx.fillStyle = '#93a4d2';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - nx * width * 0.5, y - ny * width * 0.5);
    ctx.lineTo(ex - nx * width * 0.9, ey - ny * width * 0.9);
    ctx.lineTo(ex + nx * width * 0.9, ey + ny * width * 0.9);
    ctx.lineTo(x + nx * width * 0.5, y + ny * width * 0.5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintPrints(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#a2afd3';
    const y = g.ground - u * 0.5;
    for (let ux = START_X - 12; ux < LAND_X + 6; ux += 3.4) {
      const x = g.foxX + ux * u + (rand() - 0.5) * u;
      ctx.fillRect(x, y + (rand() - 0.5) * u * 0.8, Math.max(1, u * 1.1), Math.max(1, u * 0.6));
    }
    // The way it came: a line of prints wandering back to the far trees.
    const fromX = g.foxX + (START_X - 14) * u;
    const toX = g.W * 0.42;
    for (let f = 0.03; f < 0.94; f += 0.05) {
      const e = Math.pow(1 - f, 2.2);
      const px = lerp(toX, fromX, e) + Math.sin(f * 9) * u * 3 * e;
      const py = lerp(g.horizon + u * 2, g.ground - u, e);
      const s = Math.max(1, u * (0.3 + e * 0.9));
      ctx.fillRect(px, py, s * 1.5, Math.max(1, s * 0.6));
    }
  }

  function paintCrater(ctx, g, x, y, size) {
    const u = g.U * size;
    ctx.fillStyle = '#f8f1ec';
    blob(ctx, x, y, u * 7, u * 2.4);
    ctx.fillStyle = '#8c9bc7';
    blob(ctx, x + u * 0.4, y + u * 0.2, u * 4.6, u * 1.4);
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarWoods(ctx, g, rand);
    const snow = paintSnow(g);
    ctx.drawImage(snow.canvas, 0, snow.top, g.W + 2, g.H - snow.top + 2);
    for (const tree of g.trees) paintTreeShadow(ctx, g, tree.x, tree.y, tree.w);
    paintPrints(ctx, g, rand);
    paintCrater(ctx, g, g.W * 0.8, g.H * 0.66, 0.42);
    paintCrater(ctx, g, g.W * 0.655, g.H * 0.6, 0.26);
    paintCrater(ctx, g, g.foxX + (LAND_X + 9) * g.U, g.ground - g.U * 0.2, 0.95);
    for (const tree of g.trees) if (!tree.front) paintBirch(ctx, g, rand, tree);
    ctx.strokeStyle = '#a7b3d6';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, lipY(g, x) - g.U * 0.5);
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
    return c;
  }

  function paintReeds(ctx, g, rand) {
    ctx.strokeStyle = '#6d5a55';
    ctx.lineCap = 'round';
    for (const f of [0.27, 0.285, 0.3, 0.83, 0.845, 0.86, 0.875]) {
      const x = g.W * f;
      const y = g.H * (0.93 + rand() * 0.05);
      const h = g.U * (5 + rand() * 6);
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + g.U * 0.6, y - h * 0.6, x + g.U * (rand() * 3 - 0.4), y - h);
      ctx.stroke();
    }
  }

  // The near snow, cut from the same picture, so its edge only shows on the fox.
  function paintFront(g, rand, world) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 1) ctx.lineTo(x, lipY(g, x));
    ctx.lineTo(g.W + 2, g.H);
    ctx.clip();
    ctx.drawImage(world, 0, 0);
    ctx.restore();
    const u = g.U;
    const cx = g.foxX + (LAND_X + 9) * u;
    ctx.fillStyle = '#f8f1ec';
    blob(ctx, cx, g.ground + u * 2.2, u * 9, u * 2.6);
    paintReeds(ctx, g, rand);
    return c;
  }

  function branch(ctx, rand, x, y, angle, len, width, depth) {
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    ctx.lineWidth = Math.max(0.7, width);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth <= 0) return;
    const forks = depth > 2 ? 2 : 1 + (rand() < 0.7 ? 1 : 0);
    for (let i = 0; i < forks; i++) {
      const turn = (i === 0 ? -1 : 1) * (0.25 + rand() * 0.5);
      branch(ctx, rand, ex, ey, angle + turn, len * (0.6 + rand() * 0.2), width * 0.66, depth - 1);
    }
  }

  function paintBark(ctx, g, rand, tree, bend) {
    const u = g.U;
    const span = tree.y - tree.top;
    const count = Math.ceil((span * tree.w) / (u * u * 3.2));
    ctx.fillStyle = '#4a4560';
    for (let i = 0; i < count; i++) {
      const f = Math.pow(rand(), 0.8);
      const y = tree.y - f * span;
      const width = tree.w * (1 - f * 0.45);
      const len = width * (0.1 + rand() * rand() * 0.55);
      ctx.fillRect(bend(y) + (rand() - 0.5) * 0.92 * width - len / 2, y, Math.max(1, len), Math.max(1, u * (0.25 + rand() * 0.4)));
    }
  }

  function paintBirch(ctx, g, rand, tree) {
    const span = tree.y - tree.top;
    const bend = (y) => tree.x + Math.sin((tree.y - y) * 0.02 / g.U + tree.x) * g.U * 1.6;
    const strip = (from, to) => {
      ctx.beginPath();
      for (let k = 0; k <= 29; k++) {
        const f = (k < 15 ? k : 29 - k) / 14;
        const y = tree.y - f * span;
        ctx.lineTo(bend(y) + tree.w * (1 - f * 0.45) * (k < 15 ? from : to), y);
      }
      ctx.fill();
    };
    ctx.strokeStyle = '#6f6388';
    ctx.lineCap = 'round';
    for (let i = 0; i < tree.boughs; i++) {
      const y = tree.y - span * (0.42 + rand() * 0.56);
      const side = i % 2 ? 1 : -1;
      const angle = -QUARTER + side * (0.5 + rand() * 0.6);
      branch(ctx, rand, bend(y), y, angle, g.U * (8 + rand() * 10) * tree.scale, Math.max(0.8, tree.w * 0.16), 3);
    }
    ctx.fillStyle = '#f7f1ec';
    strip(-0.5, 0.5);
    ctx.fillStyle = '#b4bbd8';
    strip(0.1, 0.52);
    paintBark(ctx, g, rand, tree, bend);
    ctx.fillStyle = '#f4ece7';
    blob(ctx, tree.x, tree.y, tree.w * 1.2, tree.w * 0.34 + g.U * 0.4);
  }

  function makeTrees(g) {
    const u = g.U;
    const tree = (fx, fy, w, front, boughs, scale) => ({ x: g.W * fx, y: g.H * fy, w: u * w, top: -u * 4, front, boughs, scale });
    return [
      tree(0.05, 0.98, 9, true, 4, 1.8),
      tree(0.135, 0.91, 5.4, true, 3, 1.5),
      tree(0.945, 0.96, 7.6, true, 4, 1.8),
      tree(0.265, 0.7, 2.4, false, 3, 1),
      tree(0.355, 0.635, 1.5, false, 2, 0.8),
      tree(0.71, 0.66, 2.6, false, 3, 1),
      tree(0.79, 0.625, 1.5, false, 2, 0.8),
      tree(0.86, 0.72, 3.2, false, 3, 1.2),
    ];
  }

  function makeSpray(g, rand) {
    const bursts = [
      { n: 40, at: 13.8, spread: 0.2, x: START_X - 11, xs: 3, y: 0, ys: 0, vx: -9, vxs: 8, vy: 11, vys: 8, life: 1.2 },
      { n: 170, at: 16.02, spread: 0.3, x: LAND_X + 9, xs: 6, y: 0, ys: 0, vx: 2, vxs: 15, vy: 25, vys: 15, life: 2.2 },
      { n: 46, at: 20, spread: 0.6, x: LAND_X + 7, xs: 5, y: 0, ys: 0, vx: 0, vxs: 9, vy: 11, vys: 7, life: 1.3 },
      { n: 120, at: 21.7, spread: 2.8, x: REST_X, xs: 0, y: 22, ys: 0, vx: 0, vxs: 0, vy: 8, vys: 2, life: 1.1, rim: true },
    ];
    const total = bursts.reduce((sum, b) => sum + b.n, 0);
    const s = { n: total, at: new Float32Array(total), x: new Float32Array(total), y: new Float32Array(total),
      vx: new Float32Array(total), vy: new Float32Array(total), life: new Float32Array(total), size: new Float32Array(total) };
    let i = 0;
    for (const b of bursts) {
      for (let k = 0; k < b.n; k++, i++) {
        s.at[i] = b.at + rand() * b.spread;
        s.x[i] = b.x + (rand() - 0.5) * 2 * b.xs;
        s.y[i] = b.y + (rand() - 0.5) * 2 * b.ys;
        s.vx[i] = b.vx + (rand() - 0.5) * 2 * b.vxs;
        s.vy[i] = b.vy + (rand() - 0.5) * 2 * b.vys;
        s.life[i] = b.life * (0.6 + rand() * 0.4);
        s.size[i] = Math.max(1, g.U * (0.35 + rand() * rand() * 1.1));
        if (b.rim) throwFromRim(s, i, b, rand);
      }
    }
    return s;
  }

  // Snow shaken off starts on the outline of the body and only flies outwards.
  function throwFromRim(s, i, b, rand) {
    const a = rand() * TAU;
    const pace = 11 + rand() * 11;
    s.x[i] = b.x + Math.cos(a) * 17;
    s.y[i] = b.y + Math.sin(a) * 12;
    s.vx[i] = Math.cos(a) * pace;
    s.vy[i] = Math.sin(a) * pace + 7;
  }

  function drawSpray(ctx, g, s, lt) {
    const u = g.U;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#fffdf9' : '#cdd5ea';
      for (let i = pass; i < s.n; i += 2) {
        const age = lt - s.at[i];
        if (age < 0 || age > s.life[i]) continue;
        const h = s.y[i] + s.vy[i] * age - 17 * age * age;
        if (h < -1) continue;
        ctx.fillRect(g.foxX + (s.x[i] + s.vx[i] * age) * u, g.ground - h * u, s.size[i], s.size[i]);
      }
    }
  }

  function makeWind(g, rand) {
    const w = { sx: new Float32Array(STREAKS), sy: new Float32Array(STREAKS), sl: new Float32Array(STREAKS), sv: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      w.sx[i] = rand() * g.W;
      w.sy[i] = g.ground + rand() * rand() * (g.H - g.ground);
      w.sl[i] = g.U * (0.7 + rand() * 3.6);
      w.sv[i] = g.U * (7 + rand() * 11);
    }
    return w;
  }

  function drawWind(ctx, g, t, drift) {
    const w = state.wind;
    const wide = g.W + g.U * 8;
    const height = Math.max(1, g.U * 0.32);
    const streaks = Math.floor(Math.min(1, drift) * STREAKS);
    const pace = 0.4 + drift * 0.6;
    ctx.fillStyle = '#fffdf8';
    for (let i = 0; i < streaks; i++) {
      const x = ((w.sx[i] + t * w.sv[i] * pace) % wide) - g.U * 4;
      const wave = Math.sin(x * 0.04 / g.U + i) * g.U * 0.5;
      ctx.fillRect(x, w.sy[i] + wave, w.sl[i], height);
    }
  }

  function drawDriftSheets(ctx, g, t, drift, y, rate, alpha) {
    if (drift <= 0) return;
    const c = state.drift;
    const w = c.width * 2;
    const x = ((t * g.U * rate * (0.4 + drift * 0.6)) % w) - w;
    ctx.globalAlpha = Math.min(1, alpha * drift);
    for (let px = x; px < g.W; px += w) ctx.drawImage(c, px, y, w, c.height);
    ctx.globalAlpha = 1;
  }

  function ease(f) {
    return f * f * f * (f * (f * 6 - 15) + 10);
  }

  function envelope(lt, a, b, c, d) {
    return smoothstep(a, b, lt) * (1 - smoothstep(c, d, lt));
  }

  // Distance walked back: eased in over the first stride, out over the last.
  function walked(lt) {
    const tau = K.clamp(lt - WALK_FROM, 0, WALK_SPAN);
    const a = STRIDE_TIME;
    const rise = (x) => x * x * x - (x * x * x * x) / 2;
    if (tau < a) return WALK_TOP * a * rise(tau / a);
    if (tau <= WALK_SPAN - a) return WALK_TOP * (a / 2 + tau - a);
    return WALK_DIST - WALK_TOP * a * rise((WALK_SPAN - tau) / a);
  }

  function foxOffset(lt) {
    if (lt < LEAP_FROM) return START_X;
    if (lt < LEAP_TO) return lerp(START_X, LAND_X, (lt - LEAP_FROM) / (LEAP_TO - LEAP_FROM));
    if (lt < 19.5) return LAND_X;
    if (lt < 20.8) return lerp(LAND_X, REST_X, ease((lt - 19.5) / 1.3));
    if (lt < WALK_FROM) return REST_X;
    return REST_X - walked(lt);
  }

  // One turn: swing to face the viewer, a short beat head-on, swing on round.
  function turnCurve(lt, from) {
    const u = K.clamp((lt - from) / TURN_TIME, 0, 1);
    const lead = TURN_SWING / TURN_TIME;
    if (u < lead) return 0.5 * smoothstep(0, 1, u / lead);
    if (u < 1 - lead) return 0.5;
    return 0.5 + 0.5 * smoothstep(0, 1, (u - 1 + lead) / lead);
  }

  // Horizontal scale of the profile, passing smoothly through 0 at each turn.
  function facing(lt) {
    const w = turnCurve(lt, TURN_OUT) - turnCurve(lt, TURN_BACK);
    return Math.cos(Math.PI * w);
  }

  function samplePose(lt, out) {
    let i = 0;
    while (i < KEYS.length - 2 && lt >= KEYS[i + 1][0]) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const f = ease(K.clamp((lt - a[0]) / (b[0] - a[0]), 0, 1));
    for (let k = 0; k < 10; k++) out[k] = lerp(a[1][k], b[1][k], f);
    if (lt >= LEAP_FROM && lt < LEAP_TO) {
      const tau = (lt - LEAP_FROM) / (LEAP_TO - LEAP_FROM);
      out[RY] = lerp(19, 12, tau) + 4 * LEAP_RISE * tau * (1 - tau);
    }
  }

  // Small life laid over the keyed pose: ears, breath, wiggle, scrabble, shake.
  function addLife(p, lt, t, live) {
    const rest = 1 - envelope(lt, LEAP_FROM - 0.4, LEAP_FROM, 20.8, 21.6);
    p[NECK] += Math.sin(t * 0.37) * 0.05 * rest;
    p[HEAD] += Math.sin(t * 0.53 + 1) * 0.07 * rest;
    p[RY] += Math.sin(t * 1.6) * 0.14 * rest;
    live.earA = Math.sin(t * 0.8) * 0.3 + Math.sin(t * 2.3 + 1) * 0.14;
    live.earB = Math.sin(t * 0.65 + 0.8) * 0.26 + Math.sin(t * 1.9) * 0.12;
    live.wave = 0.05;
    live.shiftX = 0;
    const wiggle = envelope(lt, 12, 12.6, 13.4, 13.7);
    p[HFX] += Math.sin(t * 11) * 0.7 * wiggle;
    live.wave += wiggle * 0.18;
    const dig = envelope(lt, 16.3, 16.8, 19.2, 19.6);
    p[HFY] += Math.sin(t * 13) * 1.8 * dig;
    p[HFX] += Math.cos(t * 13) * 1.8 * dig;
    p[PITCH] += Math.sin(t * 2.2) * 0.04 * dig;
    live.wave += dig * 0.3;
    const s = envelope(lt, 21.7, 22.1, 24.1, 24.6);
    const shake = Math.sin(t * 15);
    p[NECK] += shake * 0.2 * s;
    p[HEAD] += Math.sin(t * 15 + 1) * 0.34 * s;
    p[PITCH] += Math.sin(t * 15 + 2) * 0.03 * s;
    p[TAIL] += Math.sin(t * 15 + 3) * 0.5 * s;
    live.shiftX = shake * 0.8 * s;
    live.snowy = envelope(lt, 19.8, 20.4, 22.4, 23.6);
    p[NECK] += Math.sin((live.dist * TAU) / STRIDE) * 0.04 * live.gait;
  }

  // Sets where one foot sits in its stride. The phase is distance walked, so
  // planted feet stay put however fast the body is going.
  function gaitOffset(dist, shift, axis) {
    const phase = ((dist / STRIDE + shift) % 1 + 1) % 1;
    if (phase < 0.6) return axis ? 0 : STRIDE * (0.3 - phase);
    const f = (phase - 0.6) / 0.4;
    return axis ? Math.sin(f * Math.PI) * 3 : STRIDE * (-0.3 + f * 0.6);
  }

  // How much of the stride shows: grows over the first half stride walked
  // and fades over the last, so the legs only step while the body moves.
  function gaitWeight(lt, dist) {
    if (lt < WALK_FROM || lt > WALK_TO) return 0;
    return smoothstep(0, STRIDE * 0.6, dist) * smoothstep(0, STRIDE * 0.6, WALK_DIST - dist);
  }

  function limb(ctx, ax, ay, ra, bx, by, rb) {
    const a = Math.atan2(by - ay, bx - ax);
    ctx.beginPath();
    ctx.arc(ax, ay, ra, a + QUARTER, a + QUARTER * 3);
    ctx.arc(bx, by, rb, a - QUARTER, a + QUARTER);
    ctx.fill();
  }

  function reach(ax, ay, bx, by, l1, l2) {
    const dx = bx - ax;
    const dy = by - ay;
    const full = Math.hypot(dx, dy) || 0.001;
    const d = Math.min(full, l1 + l2 - 0.01);
    const ux = dx / full;
    const uy = dy / full;
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    ik.kx = ax + ux * along + uy * h;
    ik.ky = ay + uy * along - ux * h;
    ik.fx = ax + ux * d;
    ik.fy = ay + uy * d;
  }

  function frontLeg(ctx, ink, jx, jy, fx, fy, tone) {
    reach(jx, jy, fx, fy, 9.6, 9.8);
    const kx = ik.kx, ky = ik.ky, ex = ik.fx, ey = ik.fy;
    ctx.fillStyle = tone;
    limb(ctx, jx, jy, 2.8, kx, ky, 1.5);
    ctx.fillStyle = ink.sock;
    limb(ctx, kx, ky, 1.3, ex, ey, 0.95);
    blob(ctx, ex + 0.7, ey + 0.1, 1.7, 0.95);
  }

  function hindLeg(ctx, ink, jx, jy, fx, fy, tone) {
    const hx = fx - 2.3;
    const hy = fy - 6.2;
    reach(jx, jy, hx, hy, 8, 8);
    const kx = ik.kx, ky = ik.ky, ex = ik.fx, ey = ik.fy;
    ctx.fillStyle = ink.deep;
    limb(ctx, jx - 0.2, jy, 4.8, kx, ky + 0.3, 2.4);
    ctx.fillStyle = tone;
    limb(ctx, jx, jy, 4.6, kx, ky, 2.2);
    limb(ctx, kx, ky, 2.1, ex, ey, 1.05);
    ctx.fillStyle = ink.sock;
    const dx = ex + 2.3;
    const dy = ey + 6.2;
    limb(ctx, ex, ey, 1, dx, dy, 0.95);
    blob(ctx, dx + 0.7, dy + 0.1, 1.7, 0.95);
  }

  function buildTail(p, c, s, wave, t) {
    const { tailX: xs, tailY: ys, tailA: as } = state;
    let x = -12.5 * c + 2.5 * s;
    let y = -p[RY] - 12.5 * s - 2.5 * c;
    const step = TAIL_LEN / TAIL_N;
    for (let i = 0; i <= TAIL_N; i++) {
      const f = i / TAIL_N;
      const droop = p[TAIL] + p[CURL] * f * f * 1.6 + Math.sin(t * 1.7 - f * 3.4) * wave * (0.4 + f);
      const a = p[PITCH] + Math.PI - droop;
      xs[i] = x;
      ys[i] = y;
      as[i] = a;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
    }
  }

  function tailShape(ctx, from, to) {
    const { tailX: xs, tailY: ys, tailA: as, tailW: ws } = state;
    ctx.beginPath();
    for (let i = from; i <= to; i++) ctx.lineTo(xs[i] - Math.sin(as[i]) * ws[i], ys[i] + Math.cos(as[i]) * ws[i]);
    for (let i = to; i >= from; i--) ctx.lineTo(xs[i] + Math.sin(as[i]) * ws[i], ys[i] - Math.cos(as[i]) * ws[i]);
    ctx.fill();
  }

  function drawBody(ctx, ink) {
    const paths = state.paths;
    ctx.fillStyle = ink.rust;
    ctx.fill(paths.body);
    ctx.fillStyle = ink.lit;
    ctx.fill(paths.back);
    ctx.fillStyle = ink.cream;
    ctx.fill(paths.belly);
  }

  function drawEar(ctx, ink, x, y, angle, width, tone) {
    const paths = state.paths;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(width, 1);
    ctx.fillStyle = tone;
    ctx.fill(paths.ear);
    ctx.fillStyle = ink.sock;
    ctx.fill(paths.earTip);
    ctx.fillStyle = ink.cream;
    ctx.fill(paths.earIn);
    ctx.restore();
  }

  function drawHead(ctx, ink, x, y, angle, live) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    drawEar(ctx, ink, -3.4, -2.8, -0.2 + live.earB, 0.86, ink.deep);
    ctx.fillStyle = ink.rust;
    ctx.fill(state.paths.skull);
    ctx.fillStyle = ink.cream;
    ctx.fill(state.paths.cheek);
    drawEar(ctx, ink, -0.9, -3.1, 0.06 + live.earA, 1, ink.rust);
    ctx.fillStyle = ink.dark;
    blob(ctx, 8.9, -0.1, 1.05, 0.85);
    blob(ctx, 2.7, -1.5, 0.85, 0.72, 0.2);
    if (live.snowy > 0.15) {
      ctx.fillStyle = ink.dust;
      blob(ctx, 5.4, -1.5, 2.6 * live.snowy, 1.2 * live.snowy, 0.35);
      blob(ctx, 0.6, -3.5, 2.4 * live.snowy, 1.2 * live.snowy);
    }
    ctx.restore();
  }

  function wx(lx, ly) {
    return ik.c * lx - ik.s * ly;
  }

  function wy(lx, ly) {
    return -ik.ry + ik.s * lx + ik.c * ly;
  }

  // Draws in fox units, y up is negative, origin on the ground under the body.
  function drawFox(ctx, p, ink, live, t) {
    const c = Math.cos(p[PITCH]);
    const s = Math.sin(p[PITCH]);
    const ry = p[RY];
    ik.c = c;
    ik.s = s;
    ik.ry = ry;
    const fy = -ry + p[FFY];
    const hy = -ry + p[HFY];
    const g = live.gait;
    const q = live.dist;
    hindLeg(ctx, ink, wx(-9, 0.5) + 1.5, wy(-9, 0.5), p[HFX] + 4.4 + gaitOffset(q, 0.5, 0) * g, hy - gaitOffset(q, 0.5, 1) * g, ink.deep);
    frontLeg(ctx, ink, wx(10, 1.5) + 1.8, wy(10, 1.5), p[FFX] + 4.6 + gaitOffset(q, 0.75, 0) * g, fy - gaitOffset(q, 0.75, 1) * g, ink.deep);
    buildTail(p, c, s, live.wave, t);
    ctx.fillStyle = ink.rust;
    tailShape(ctx, 0, TAIL_N - 2);
    ctx.fillStyle = ink.cream;
    tailShape(ctx, TAIL_N - 3, TAIL_N);
    ctx.save();
    ctx.translate(0, -ry);
    ctx.rotate(p[PITCH]);
    drawBody(ctx, ink);
    ctx.restore();
    hindLeg(ctx, ink, wx(-10, 0.5), wy(-10, 0.5), p[HFX] + gaitOffset(q, 0, 0) * g, hy - gaitOffset(q, 0, 1) * g, ink.rust);
    frontLeg(ctx, ink, wx(10, 1.5), wy(10, 1.5), p[FFX] + gaitOffset(q, 0.25, 0) * g, fy - gaitOffset(q, 0.25, 1) * g, ink.rust);
    const nx = wx(10.8, -2.6);
    const ny = wy(10.8, -2.6);
    const hx = nx + Math.cos(p[NECK]) * 10;
    const hyy = ny + Math.sin(p[NECK]) * 10;
    ctx.fillStyle = ink.rust;
    limb(ctx, nx, ny, 5.4, hx, hyy, 3.3);
    ctx.fillStyle = ink.cream;
    limb(ctx, wx(13, 2.5), wy(13, 2.5), 2.7, hx + 1.2 - Math.sin(p[HEAD]) * 1.6, hyy + Math.cos(p[HEAD]) * 1.6, 1.8);
    drawHead(ctx, ink, hx, hyy, p[HEAD], live);
    live.hx = hx;
    live.hy = hyy;
  }

  // The fox seen from the front, worn over the profile while it turns.
  function drawFrontHead(ctx, ink, live) {
    drawEar(ctx, ink, -2.9, -2.2, -0.42 + live.earB * 0.5, 1.05, ink.deep);
    drawEar(ctx, ink, 2.9, -2.2, 0.42 - live.earA * 0.5, 1.05, ink.rust);
    ctx.fillStyle = ink.rust;
    blob(ctx, 0, 0, 4.7, 4);
    ctx.fillStyle = ink.lit;
    blob(ctx, 0, -1.7, 2.3, 1.5);
    ctx.fillStyle = ink.cream;
    blob(ctx, -2.4, 1.7, 2.5, 1.9, -0.35);
    blob(ctx, 2.4, 1.7, 2.5, 1.9, 0.35);
    blob(ctx, 0, 2.7, 1.8, 2);
    ctx.fillStyle = ink.dark;
    blob(ctx, -1.9, -0.4, 0.75, 0.6);
    blob(ctx, 1.9, -0.4, 0.75, 0.6);
    blob(ctx, 0, 4.1, 1, 0.75);
  }

  function drawFrontChest(ctx, p, ink) {
    const feet = p[FFY];
    for (const side of SIDES) {
      ctx.fillStyle = ink.rust;
      limb(ctx, side * 2.6, 1, 2.3, side * 2.8, 8.5, 1.4);
      ctx.fillStyle = ink.sock;
      limb(ctx, side * 2.8, 8.5, 1.3, side * 2.9, feet - 0.6, 0.95);
      blob(ctx, side * 3, feet, 1.4, 0.9);
    }
    ctx.fillStyle = ink.rust;
    blob(ctx, 0, -1, 6.2, 6.4);
    ctx.fillStyle = ink.cream;
    blob(ctx, 0, 0.4, 3.3, 4.6);
  }

  // weight is how far the fox has turned toward the viewer, 0 to 1.
  function drawFront(ctx, p, ink, live, face, weight) {
    const cx = face * 11;
    const top = -p[RY];
    const headX = face * (live.hx + 1.5);
    ctx.save();
    ctx.translate(cx, top);
    ctx.scale(weight, 1);
    drawFrontChest(ctx, p, ink);
    ctx.restore();
    ctx.fillStyle = ink.rust;
    limb(ctx, cx, top - 3, 4.6 * weight, headX, live.hy, 3.4 * weight);
    ctx.save();
    ctx.translate(headX, live.hy);
    ctx.rotate(live.earA * 0.25);
    ctx.scale(weight, 1);
    drawFrontHead(ctx, ink, live);
    ctx.restore();
  }

  // Puts the origin on the ground under the fox, or on its cast shadow.
  function foxBasis(ctx, g, x, shadow) {
    if (!shadow) {
      ctx.translate(x, g.ground);
      return;
    }
    const lean = (SHADOW_FALL * (x - g.sunX)) / (g.ground - g.horizon);
    ctx.translate(x, g.ground + g.U * 1.2);
    ctx.transform(1, 0, -lean, -SHADOW_FALL, 0, 0);
  }

  function foxPass(ctx, g, x, face, ink, shadow, t) {
    const p = state.pose;
    const live = state.live;
    if (Math.abs(face) > 0.02) {
      ctx.save();
      foxBasis(ctx, g, x, shadow);
      ctx.scale(face * g.U, g.U);
      drawFox(ctx, p, ink, live, t);
      ctx.restore();
    }
    const weight = 1 - smoothstep(0.08, 0.62, Math.abs(face));
    if (weight < 0.02) return;
    ctx.save();
    foxBasis(ctx, g, x, shadow);
    ctx.scale(g.U, g.U);
    drawFront(ctx, p, ink, live, face, weight);
    ctx.restore();
  }

  function setup(ctx, api) {
    const U = api.rows / 100;
    const g = { W: api.cols, H: api.rows, U, horizon: api.rows * 0.47, ground: api.rows * 0.8, sunX: api.cols * 0.2, foxX: api.cols * 0.54 };
    const rand = K.rng(api.seed);
    g.trees = makeTrees(g);
    state.g = g;
    state.sky = paintSky(g);
    const half = 2 / U;
    const cloud = (x, y) => fbm(x * 0.012 * half, y * 0.07 * half, 3, 41);
    const sheet = (x, y) => fbm(x * 0.03 * half, y * 0.3 * half, 3, 77);
    const tileW = Math.ceil(g.W * 0.75);
    state.clouds = noiseTile(tileW, Math.ceil(g.H * 0.2), [247, 208, 192], cloud, 4, 215);
    state.world = paintWorld(g, rand);
    state.front = paintFront(g, rand, state.world);
    state.fore = layer(g.W, g.H);
    for (const tree of g.trees) if (tree.front) paintBirch(state.fore.getContext('2d'), g, rand, tree);
    state.drift = noiseTile(tileW, Math.ceil(U * 8), [255, 251, 248], sheet, 3, 190);
    state.spray = makeSpray(g, rand);
    state.wind = makeWind(g, rand);
    state.pose = new Float32Array(10);
    state.live = { earA: 0, earB: 0, wave: 0, shiftX: 0, snowy: 0, gait: 0, dist: 0, hx: 0, hy: 0 };
    state.paths = {};
    for (const key of Object.keys(SHAPES)) state.paths[key] = new Path2D(SHAPES[key]);
    state.tailX = new Float32Array(TAIL_N + 1);
    state.tailY = new Float32Array(TAIL_N + 1);
    state.tailA = new Float32Array(TAIL_N + 1);
    state.tailW = Float32Array.from({ length: TAIL_N + 1 }, (_, i) => {
      const f = i / TAIL_N;
      return 0.5 + 4.2 * Math.sin(Math.pow(f, 0.72) * Math.PI) * (f > 0.9 ? (1 - f) * 8 + 0.2 : 1);
    });
  }

  function drawBack(ctx, g, t, drift) {
    ctx.drawImage(state.sky, 0, 0);
    const clouds = state.clouds;
    const w = clouds.width * 2;
    const x = -((t * g.U * 0.9) % w);
    for (let px = x; px < g.W; px += w) ctx.drawImage(clouds, px, g.H * 0.1, w, clouds.height * 2);
    ctx.drawImage(state.world, 0, 0);
    drawDriftSheets(ctx, g, t, drift, g.ground - g.U * 8, 5, 0.55);
  }

  function drawHero(ctx, g, t, lt) {
    const p = state.pose;
    const live = state.live;
    samplePose(lt, p);
    live.dist = walked(lt);
    live.gait = gaitWeight(lt, live.dist);
    addLife(p, lt, t, live);
    const face = facing(lt);
    const x = g.foxX + (foxOffset(lt) + live.shiftX) * g.U;
    foxPass(ctx, g, x, face, FUR, false, t);
    ctx.drawImage(state.front, 0, 0);
    // Only parts above the snow cast a shadow; buried ones would land on the fox.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.ground + g.U * 1.2, g.W, g.H - g.ground);
    ctx.clip();
    foxPass(ctx, g, x, face, SHADOW, true, t);
    ctx.restore();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const lt = ((t % LOOP) + LOOP) % LOOP;
    const drift = api.props.drift;
    drawBack(ctx, g, t, drift);
    drawHero(ctx, g, t, lt);
    drawSpray(ctx, g, state.spray, lt);
    drawDriftSheets(ctx, g, t, drift, g.ground + g.U * 3, 8, 0.7);
    drawWind(ctx, g, t, drift);
    ctx.drawImage(state.fore, 0, 0);
  }

  Kasuri.run({
    defaults: { drift: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, tint: 0.75, bg: '#3a3f5c', dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
