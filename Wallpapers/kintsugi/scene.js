/*
 * 金継ぎ Kintsugi — a black raku bowl mended with gold, on a low table by a window.
 *
 * The bowl is a surface of revolution baked once, and each seam is one stroked
 * path. A single dashed wave runs down the whole tree of seams, so the moving
 * gold is a few dozen strokes and the sheen a short stack of soft sprites.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep, fbm, parseColor } = K;

  const TILT = 0.24;
  const FOOT_R = 0.42;
  const LIGHT = [-0.6, -0.52, 0.6];
  const HALF = [-0.33, -0.42, 0.84];
  const GLAZE = ['#3f393a', '#4b4342', '#5a4f4b', '#6c5e56', '#826f62', '#9b8772', '#b6a288'].map(parseColor);
  const RUST = ['#4c3a33', '#624336', '#7d513b', '#976243', '#ad7650'].map(parseColor);
  const CLAY = ['#7a5e45', '#967755', '#b09068', '#c6a884'].map(parseColor);

  const GOLD_BASE = '#ab8a3e';
  const WAVE_PERIOD = 74;
  const WAVE_SPEED = 4.2;
  const PASSES = [
    { len: 28, colour: '#cda84e', alpha: 0.8, width: 1 },
    { len: 12, colour: '#e6c870', alpha: 0.95, width: 1 },
    { len: 4, colour: '#f8ebb6', alpha: 1, width: 1.15 },
  ];
  const STRIPS = 18;
  const MOTES = 16;

  // Control points are [theta, v] on the outside of the bowl, or [x, y] inside
  // the rim's unit circle when inner is set. from/at name the parent seam and
  // which of its control points this one branches off.
  const SEAMS = [
    { w: 1, pts: [[-0.84, 0], [-0.62, 0.14], [-0.42, 0.25], [-0.15, 0.4], [0.08, 0.58], [0.02, 0.78], [0.1, 0.96]] },
    { from: 0, at: 3, w: 1, pts: [[-0.15, 0.4], [0.2, 0.33], [0.36, 0.2], [0.45, 0.09]] },
    { from: 0, at: 4, w: 0.85, pts: [[0.08, 0.58], [0.36, 0.63], [0.62, 0.71], [0.9, 0.6], [1.26, 0.68]] },
    { from: 0, at: 2, w: 0.85, pts: [[-0.42, 0.25], [-0.68, 0.4], [-0.92, 0.45], [-1.1, 0.68], [-1.36, 0.75]] },
    { from: 1, at: 1, w: 0.75, pts: [[0.2, 0.33], [0.6, 0.3], [0.88, 0.38], [1.12, 0.2], [1.25, 0]] },
    { from: 0, at: 3, w: 0.55, pts: [[-0.15, 0.4], [-0.38, 0.56], [-0.48, 0.74], [-0.36, 0.9]] },
    { from: 2, at: 2, w: 0.55, pts: [[0.62, 0.71], [0.52, 0.86], [0.66, 0.96]] },
    { from: 3, at: 2, w: 0.55, pts: [[-0.92, 0.45], [-1.02, 0.26], [-1.24, 0.14]] },
    { from: 4, at: 2, w: 0.5, pts: [[0.88, 0.38], [0.98, 0.5], [1.22, 0.46]] },
    { from: 1, at: 2, w: 0.5, pts: [[0.36, 0.2], [0.6, 0.14], [0.72, 0.03]] },
    { from: 0, at: 1, w: 0.5, pts: [[-0.62, 0.14], [-0.3, 0.1], [-0.12, 0.02]] },
    { from: 2, at: 1, w: 0.45, pts: [[0.36, 0.63], [0.26, 0.8], [0.3, 0.88]] },
    { from: 4, at: 4, w: 0.8, inner: true, pts: [[0.949, 0.315], [0.72, 0.04], [0.42, -0.2], [0.1, -0.36], [-0.22, -0.24], [-0.56, -0.5], [-0.72, -0.68]] },
    { from: 12, at: 2, w: 0.55, inner: true, pts: [[0.42, -0.2], [0.34, -0.62], [0.26, -0.96]] },
    { from: 12, at: 4, w: 0.55, inner: true, pts: [[-0.22, -0.24], [-0.36, 0.14], [-0.2, 0.46]] },
  ];
  const CHIP = [[0.28, 0], [0.32, 0.05], [0.4, 0.075], [0.45, 0.105], [0.53, 0.082], [0.6, 0.06], [0.66, 0]];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /* ---------- the bowl as a shape ---------- */

  function makeBowl(g) {
    const s = Math.min(g.U, g.W / 118);
    const ht = s * 48;
    const footY = g.U * 84;
    return { s, cx: g.W * 0.5, rw: s * 46, ht, rimY: footY - s * 55, wob: s * 0.9 };
  }

  function radius(b, v) {
    if (v >= 1) return b.rw * FOOT_R;
    return b.rw * (lerp(1, FOOT_R, Math.pow(v, 2.6)) + 0.03 * Math.sin(Math.PI * v));
  }

  function wobble(b, th) {
    return b.wob * (Math.sin(2 * th + 0.7) * 0.6 + Math.sin(3 * th + 2) * 0.4);
  }

  function project(b, th, v) {
    const r = radius(b, v);
    const fade = v < 1 ? (1 - v) * (1 - v) : 0;
    return [b.cx + r * Math.sin(th), b.rimY + b.ht * v + TILT * r * Math.cos(th) + wobble(b, th) * fade];
  }

  function projectInner(b, x, y) {
    const ry = b.rw * TILT;
    return [b.cx + x * b.rw, b.rimY + y * ry + wobble(b, Math.atan2(x, y))];
  }

  function rimPath(b) {
    const path = new Path2D();
    for (let i = 0; i <= 72; i++) {
      const p = project(b, (i / 72) * Math.PI * 2, 0);
      if (i === 0) path.moveTo(p[0], p[1]);
      else path.lineTo(p[0], p[1]);
    }
    path.closePath();
    return path;
  }

  /* ---------- the bowl as paint ---------- */

  // Mottled glaze, read by nearest sample so the raster loop stays cheap.
  function mottleTexture(seed) {
    const w = 200;
    const h = 110;
    const data = new Float32Array(w * h * 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 2;
        data[i] = fbm(x * 0.05, y * 0.075, 4, seed);
        data[i + 1] = fbm(x * 0.022, y * 0.03, 3, seed + 7);
      }
    }
    return { w, h, data };
  }

  function normalAt(b, th, v) {
    const e = 0.01;
    const slope = (radius(b, Math.min(0.999, v + e)) - radius(b, Math.max(0, v - e))) / (2 * e * b.ht);
    const ny = v >= 1 ? 0 : -slope;
    const len = Math.sqrt(1 + ny * ny);
    return [Math.sin(th) / len, ny / len, Math.cos(th) / len];
  }

  function glazeColour(n, th, v, tex) {
    const tx = Math.floor(((th + 1.6) / 3.2) * (tex.w - 1));
    const ty = Math.floor(Math.min(1, v) * (tex.h - 1));
    const i = (ty * tex.w + tx) * 2;
    const m = tex.data[i];
    const patch = tex.data[i + 1];
    if (v > 0.93 + m * 0.07) {
      const clay = 0.2 + 0.7 * Math.max(0, n[0] * LIGHT[0] + n[2] * LIGHT[2]);
      return CLAY[Math.min(3, Math.round(clay * 3))];
    }
    const dif = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const sp = Math.pow(Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]), 14);
    const bounce = 0.16 * Math.max(0, n[1]);
    const tone = 0.06 + 0.5 * dif + 0.26 * sp + bounce + (m - 0.5) * 0.42;
    if (patch > 0.635 && v < 0.8) return RUST[Math.max(0, Math.min(4, Math.round(tone * 5.5)))];
    return GLAZE[Math.max(0, Math.min(6, Math.round(tone * 7)))];
  }

  function paintBody(b, tex) {
    const size = Math.ceil(b.rw * 2 + 8);
    const top = Math.floor(b.rimY - b.rw * TILT - 4);
    const height = Math.ceil(b.ht * 1.06 + b.rw * TILT * 2 + 8);
    const c = layer(size, height);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, height);
    const left = b.cx - size / 2;
    const dv = 1 / (b.ht * 3);
    const dth = 0.4 / b.rw;
    for (let v = 1.06; v >= 0; v -= dv) {
      for (let th = -Math.PI / 2; th <= Math.PI / 2; th += dth) {
        const p = project(b, th, v);
        const x = Math.round(p[0] - left);
        const y = Math.round(p[1] - top);
        if (x < 0 || y < 0 || x >= size || y >= height) continue;
        const col = glazeColour(normalAt(b, th, v), th, v, tex);
        const i = (y * size + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, x: left, y: top };
  }

  function paintInside(ctx, b, tex) {
    const ry = b.rw * TILT;
    const size = Math.ceil(b.rw * 2 + 8);
    const height = Math.ceil(ry * 2 + 8);
    const c = layer(size, height);
    const cc = c.getContext('2d');
    const img = cc.createImageData(size, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < size; x++) {
        const px = (x - size / 2) / b.rw;
        const py = (y - height / 2) / ry;
        const edge = Math.sqrt(Math.max(0, 1 - px * px));
        const depth = lerp(0, 1, (py + edge) / (2 * edge + 0.001));
        const tx = Math.floor((x / size) * (tex.w - 1));
        const ty = Math.floor((y / height) * (tex.h - 1));
        const m = tex.data[(ty * tex.w + tx) * 2];
        const lit = (px * 0.5 + 0.5) * (1 - depth * 0.9);
        const tone = 0.1 + 0.55 * lit + (m - 0.5) * 0.32;
        const col = GLAZE[Math.max(0, Math.min(6, Math.round(tone * 7)))];
        const i = (y * size + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    cc.putImageData(img, 0, 0);
    ctx.save();
    ctx.clip(rimPath(b));
    ctx.drawImage(c, b.cx - size / 2, b.rimY - height / 2);
    ctx.restore();
  }

  // Glaze runs from the lip and pale ash specks, so the black isn't plastic.
  function paintGlazeMarks(ctx, b, rand) {
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, b.s * 0.7);
    for (let i = 0; i < 34; i++) {
      const th = (rand() - 0.5) * 2.9;
      const end = 0.04 + rand() * rand() * 0.34;
      const a = project(b, th, 0.012);
      const m = project(b, th + 0.02, end / 2);
      const e = project(b, th, end);
      ctx.strokeStyle = rand() < 0.5 ? '#6f6158' : '#2f2a2b';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(m[0], m[1], e[0], e[1]);
      ctx.stroke();
    }
    const size = Math.max(1, b.s * 0.5);
    ctx.fillStyle = '#a6957f';
    for (let i = 0; i < 260; i++) {
      const p = project(b, (rand() - 0.5) * 3, rand() * 0.9);
      ctx.globalAlpha = 0.2 + rand() * 0.35;
      ctx.fillRect(p[0], p[1], size, size);
    }
    ctx.globalAlpha = 1;
  }

  function paintLip(ctx, b) {
    const tones = ['#c6b59c', '#9c8b78', '#6f6157'];
    ctx.lineWidth = Math.max(1.2, b.s * 1.3);
    ctx.lineCap = 'round';
    const steps = 72;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const n = ((i + 1) / steps) * Math.PI * 2;
      const lit = -Math.sin(a) * 0.7 - Math.cos(a) * 0.4;
      ctx.strokeStyle = tones[lit > 0.3 ? 0 : lit > -0.3 ? 1 : 2];
      const p = project(b, a, 0);
      const q = project(b, n, 0);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }
  }

  /* ---------- seams ---------- */

  // Midpoint displacement between control points, so a seam breaks like pottery.
  function jag(a, b, depth, amp, rand, out) {
    if (depth === 0) {
      out.push(b);
      return;
    }
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const d = (rand() - 0.5) * amp;
    const mid = [(a[0] + b[0]) / 2 + nx * d, (a[1] + b[1]) / 2 + ny * d];
    jag(a, mid, depth - 1, amp, rand, out);
    jag(mid, b, depth - 1, amp, rand, out);
  }

  function buildSeam(b, def, rand, starts) {
    const map = def.inner ? (p) => projectInner(b, p[0], p[1]) : (p) => project(b, p[0], p[1]);
    const path = new Path2D();
    const points = [];
    const marks = [0];
    let len = 0;
    let prev = map(def.pts[0]);
    path.moveTo(prev[0], prev[1]);
    points.push(prev);
    for (let i = 1; i < def.pts.length; i++) {
      const run = [];
      jag(def.pts[i - 1], def.pts[i], 2, 0.55, rand, run);
      for (const raw of run) {
        const q = map(raw);
        len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
        path.lineTo(q[0], q[1]);
        points.push(q);
        prev = q;
      }
      marks.push(len);
    }
    const start = def.from === undefined ? 0 : starts[def.from].start + starts[def.from].marks[def.at];
    return { path, marks, start, len, w: def.w };
  }

  function buildSeams(b, rand) {
    const list = [];
    for (const def of SEAMS) list.push(buildSeam(b, def, rand, list));
    return list;
  }

  function buildChip(b, seams) {
    const path = new Path2D();
    CHIP.forEach((pt, i) => {
      const p = project(b, pt[0], pt[1]);
      if (i === 0) path.moveTo(p[0], p[1]);
      else path.lineTo(p[0], p[1]);
    });
    path.closePath();
    return { path, start: seams[1].start + seams[1].len };
  }

  function paintSeams(ctx, b, seams, chip, line) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.save();
    ctx.translate(0, Math.max(0.5, b.s * 0.5));
    ctx.strokeStyle = '#211b1b';
    for (const seam of seams) {
      ctx.lineWidth = Math.max(1, line * seam.w);
      ctx.stroke(seam.path);
    }
    ctx.restore();
    ctx.strokeStyle = GOLD_BASE;
    for (const seam of seams) {
      ctx.lineWidth = Math.max(1, line * seam.w);
      ctx.stroke(seam.path);
    }
    ctx.fillStyle = GOLD_BASE;
    ctx.fill(chip.path);
    ctx.strokeStyle = '#d3b25c';
    ctx.lineWidth = Math.max(1, b.s * 0.5);
    ctx.stroke(chip.path);
  }

  /* ---------- the room ---------- */

  function paintWall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const wall = ctx.createLinearGradient(0, 0, g.W, 0);
    wall.addColorStop(0, '#a89b82');
    wall.addColorStop(1, '#85795f');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, g.W, g.H);
    const marks = ['#94886f', '#b5a88d', '#7f7359'];
    for (let i = 0; i < g.W * g.H * 0.05; i++) {
      ctx.fillStyle = marks[Math.floor(rand() * 3)];
      ctx.globalAlpha = 0.12 + rand() * 0.14;
      ctx.fillRect(rand() * g.W, rand() * u * 58, Math.max(1, u * (0.4 + rand() * 1.2)), Math.max(1, u * 0.4));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#62492f';
    ctx.fillRect(0, 0, g.W, u * 4.5);
    ctx.fillStyle = '#44331f';
    ctx.fillRect(0, u * 4.5, g.W, Math.max(1, u * 0.7));
    ctx.fillStyle = '#6d5238';
    ctx.fillRect(g.W * 0.9, u * 4.5, u * 7, u * 54);
    ctx.fillStyle = '#8a6b49';
    ctx.fillRect(g.W * 0.9, u * 4.5, Math.max(1, u * 1.2), u * 54);
    paintFloor(ctx, g);
    return c;
  }

  function paintFloor(ctx, g) {
    const u = g.U;
    ctx.fillStyle = '#a6a06a';
    ctx.fillRect(0, u * 58, g.W, g.H - u * 58);
    ctx.fillStyle = '#8f8a58';
    for (let y = u * 59; y < g.H; y += Math.max(2, u * 1.4)) ctx.fillRect(0, y, g.W, 1);
    ctx.fillStyle = '#4a3a29';
    ctx.fillRect(0, u * 57.4, g.W, Math.max(1, u * 1));
  }

  function tablePath(g) {
    const u = g.U;
    const path = new Path2D();
    path.moveTo(g.W * 0.1, u * 66);
    path.lineTo(g.W * 0.9, u * 66);
    path.lineTo(g.W * 0.975, u * 90);
    path.lineTo(g.W * 0.025, u * 90);
    path.closePath();
    return path;
  }

  function paintUnderTable(ctx, g) {
    const u = g.U;
    ctx.fillStyle = '#5c5639';
    ctx.fillRect(g.W * 0.05, u * 94, g.W * 0.9, u * 6);
    ctx.fillStyle = '#493423';
    ctx.fillRect(g.W * 0.05, u * 94, u * 6, u * 6);
    ctx.fillRect(g.W * 0.95 - u * 6, u * 94, u * 6, u * 6);
    ctx.fillStyle = '#5a412b';
    ctx.beginPath();
    ctx.moveTo(g.W * 0.025, u * 90);
    ctx.lineTo(g.W * 0.975, u * 90);
    ctx.lineTo(g.W * 0.975, u * 94.5);
    ctx.lineTo(g.W * 0.025, u * 94.5);
    ctx.fill();
    ctx.fillStyle = '#c29c6a';
    ctx.fillRect(g.W * 0.025, u * 90, g.W * 0.95, Math.max(1, u * 0.6));
  }

  function paintGrain(ctx, g, rand) {
    const u = g.U;
    const tones = ['#83623e', '#a5824f', '#b5915c', '#78593a'];
    for (let i = 0; i < 90; i++) {
      const f = rand();
      const y = u * lerp(66, 90, f * f * 0.6 + f * 0.4);
      const x0 = rand() * g.W;
      const run = u * (20 + rand() * 60);
      const bow = u * (rand() - 0.5) * 1.2;
      ctx.strokeStyle = tones[Math.floor(rand() * 4)];
      ctx.lineWidth = Math.max(1, u * (0.3 + f * 0.5));
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo(x0 + run / 2, y + bow, x0 + run, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function softEllipse(ctx, x, y, rx, ry, colour, amount) {
    const [r, gr, bl] = parseColor(colour);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${r},${gr},${bl},${amount})`);
    grad.addColorStop(0.55, `rgba(${r},${gr},${bl},${amount * 0.7})`);
    grad.addColorStop(1, `rgba(${r},${gr},${bl},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function paintTable(ctx, g, b, rand) {
    const u = g.U;
    paintUnderTable(ctx, g);
    const top = tablePath(g);
    ctx.save();
    ctx.clip(top);
    const wood = ctx.createLinearGradient(0, 0, g.W, 0);
    wood.addColorStop(0, '#b48c5c');
    wood.addColorStop(0.5, '#9a7649');
    wood.addColorStop(1, '#80623e');
    ctx.fillStyle = wood;
    ctx.fillRect(0, u * 60, g.W, u * 34);
    paintGrain(ctx, g, rand);
    softEllipse(ctx, g.W * 0.2, u * 78, g.W * 0.26, u * 12, '#eed8a8', 0.48);
    const footY = b.rimY + b.ht * 1.06;
    softEllipse(ctx, b.cx + b.s * 26, footY - b.s * 1, b.s * 56, b.s * 9, '#2d2015', 0.55);
    softEllipse(ctx, b.cx + b.s * 2, footY + b.s * 0.5, b.s * 29, b.s * 7, '#22170f', 0.7);
    ctx.restore();
    ctx.strokeStyle = '#c6a377';
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.1, u * 66);
    ctx.lineTo(g.W * 0.9, u * 66);
    ctx.stroke();
  }

  function paintFront(g, b, seams, chip, rand, tex) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintTable(ctx, g, b, rand);
    paintInside(ctx, b, tex);
    const body = paintBody(b, tex);
    ctx.drawImage(body.canvas, body.x, body.y);
    paintGlazeMarks(ctx, b, rand);
    paintLip(ctx, b);
    paintSeams(ctx, b, seams, chip, state.line);
    return c;
  }

  /* ---------- window light ---------- */

  function paintWindow(g) {
    const w = g.W / 2;
    const h = g.H / 2;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const u = g.U / 2;
    const top = u * 7;
    const bottom = u * 57;
    const cols = 5;
    const rows = 3;
    const skew = 0.3;
    const span = w * 0.74;
    const x0 = w * 0.02;
    const bar = Math.max(2, u * 3);
    ctx.fillStyle = '#f2e4bf';
    ctx.globalAlpha = 1 / 3;
    for (let pass = -1; pass <= 1; pass++) {
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const a = x0 + (span * i) / cols + bar / 2 + pass * 0.45;
          const pw = span / cols - bar;
          const y0 = top + ((bottom - top) * j) / rows + bar / 2 + pass * 0.3;
          const y1 = top + ((bottom - top) * (j + 1)) / rows - bar / 2 + pass * 0.3;
          ctx.beginPath();
          ctx.moveTo(a + (y0 - top) * skew, y0);
          ctx.lineTo(a + pw + (y0 - top) * skew, y0);
          ctx.lineTo(a + pw + (y1 - top) * skew, y1);
          ctx.lineTo(a + (y1 - top) * skew, y1);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // Shadows of bamboo outside: thin stems with leaves fanning from each node.
  function paintLeafFan(ctx, x, y, u, rand) {
    const count = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const dir = 1.1 + (i / (count - 1) - 0.5) * 1.9 + (rand() - 0.5) * 0.2;
      const len = u * (5 + rand() * 4);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(dir);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len, -u * 1.5, len * 2, 0);
      ctx.quadraticCurveTo(len, u * 1.5, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  function paintLeaves(g, rand, stems) {
    const margin = g.U * 4;
    const c = layer(g.W / 2 + margin, g.H / 2 + margin);
    const ctx = c.getContext('2d');
    const u = g.U / 2;
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(0.8, u * 0.7);
    for (const [fx, fy, reach] of stems) {
      const x = fx * g.W * 0.5;
      const y = fy * g.H * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + reach * u * 0.9, y + reach * u * 0.4);
      ctx.stroke();
      for (let n = 1; n <= 3; n++) {
        const f = n / 3;
        paintLeafFan(ctx, x + reach * u * 0.9 * f, y + reach * u * 0.4 * f, u, rand);
      }
    }
    return c;
  }

  function makeMotes(g, rand) {
    const m = {
      x: new Float32Array(MOTES),
      y: new Float32Array(MOTES),
      p: new Float32Array(MOTES),
      r: new Float32Array(MOTES),
    };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = g.W * (0.04 + rand() * 0.5);
      m.y[i] = g.U * (8 + rand() * 36);
      m.p[i] = rand() * 6.28;
      m.r[i] = 0.05 + rand() * 0.06;
    }
    return m;
  }

  // Rows of the bowl the sheen slides across, filled once.
  function makeStrips(b) {
    const s = { r: new Float32Array(STRIPS), y: new Float32Array(STRIPS), a: new Float32Array(STRIPS) };
    for (let i = 0; i < STRIPS; i++) {
      const f = i / (STRIPS - 1);
      const v = lerp(0.06, 0.66, f);
      s.r[i] = radius(b, v);
      s.y[i] = b.rimY + b.ht * v;
      s.a[i] = smoothstep(0, 0.2, f) * (1 - smoothstep(0.6, 1, f));
    }
    return s;
  }

  function paintBlob() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(222,212,190,0.6)');
    grad.addColorStop(0.5, 'rgba(222,212,190,0.26)');
    grad.addColorStop(1, 'rgba(222,212,190,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  /* ---------- per frame ---------- */

  function drawLight(ctx, g, t) {
    const buf = state.lightCtx;
    const u = g.U;
    buf.clearRect(0, 0, state.lightBuf.width, state.lightBuf.height);
    buf.globalCompositeOperation = 'source-over';
    buf.drawImage(state.window, Math.sin(t * 0.04) * u * 1.5, 0);
    buf.globalCompositeOperation = 'destination-out';
    buf.globalAlpha = 0.6;
    buf.drawImage(state.leavesA, Math.sin(t * 0.31) * u * 1.6 + Math.sin(t * 0.83) * u * 0.4 - u, Math.sin(t * 0.23) * u * 0.7 - u);
    buf.drawImage(state.leavesB, Math.sin(t * 0.24 + 2) * u * 2.2 - u, Math.sin(t * 0.37 + 1) * u * 0.8 - u);
    buf.globalAlpha = 1;
    ctx.globalAlpha = 0.62 + 0.08 * Math.sin(t * 0.11) + 0.03 * Math.sin(t * 0.37);
    ctx.drawImage(state.lightBuf, 0, 0, g.W, g.H);
    ctx.globalAlpha = 1;
  }

  function drawSheen(ctx, b, t, amount) {
    if (amount <= 0) return;
    const s = state.strips;
    const th = -0.5 + 0.62 * Math.sin(t * 0.07);
    const sin = Math.sin(th);
    const cos = Math.cos(th);
    const w = b.s * 20 * cos;
    const h = b.s * 7;
    for (let i = 0; i < STRIPS; i++) {
      const x = b.cx + s.r[i] * sin;
      const y = s.y[i] + TILT * s.r[i] * cos;
      ctx.globalAlpha = Math.min(1, s.a[i] * 0.42 * amount);
      ctx.drawImage(state.blob, x - w / 2, y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawGold(ctx, g, seams, flow) {
    const u = g.U;
    const period = WAVE_PERIOD * u;
    const head = flow * WAVE_SPEED * u;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (let p = 0; p < PASSES.length; p++) {
      const pass = PASSES[p];
      ctx.strokeStyle = pass.colour;
      ctx.globalAlpha = pass.alpha;
      ctx.setLineDash(state.dashes[p]);
      const len = pass.len * u;
      for (let i = 0; i < seams.length; i++) {
        const seam = seams[i];
        const offset = (((len - (head - seam.start)) % period) + period) % period;
        ctx.lineDashOffset = offset;
        ctx.lineWidth = Math.max(1, state.line * seam.w * pass.width);
        ctx.stroke(seam.path);
      }
    }
    ctx.setLineDash(state.noDash);
    ctx.globalAlpha = 1;
    const x = (((head - state.chip.start) % period) + period) % period;
    const glow = smoothstep(0, 6 * u, x) * (1 - smoothstep(8 * u, 32 * u, x));
    if (glow > 0.01) {
      ctx.fillStyle = '#ecd283';
      ctx.globalAlpha = glow * 0.9;
      ctx.fill(state.chip.path);
      ctx.globalAlpha = 1;
    }
  }

  function drawMotes(ctx, g, t) {
    const m = state.motes;
    const size = Math.max(1, g.U * 0.6);
    ctx.fillStyle = '#f6ecd0';
    for (let i = 0; i < MOTES; i++) {
      const a = m.p[i] + t * m.r[i];
      ctx.globalAlpha = 0.2 + 0.16 * Math.sin(a * 3);
      ctx.fillRect(m.x[i] + Math.sin(a) * g.U * 9, m.y[i] + Math.cos(a * 0.7) * g.U * 6, size, size);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- run ---------- */

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const b = makeBowl(g);
    state.g = g;
    state.b = b;
    state.line = Math.max(1.2, b.s * 1.5);
    state.seams = buildSeams(b, rand);
    state.chip = buildChip(b, state.seams);
    state.wall = paintWall(g, rand);
    state.front = paintFront(g, b, state.seams, state.chip, rand, mottleTexture(api.seed % 97));
    state.window = paintWindow(g);
    state.leavesA = paintLeaves(g, rand, [[0.0, 0.1, 30], [0.72, 0.08, 26]]);
    state.leavesB = paintLeaves(g, rand, [[0.03, 0.34, 22], [0.48, 0.04, 22]]);
    state.lightBuf = layer(g.W / 2, g.H / 2);
    state.lightCtx = state.lightBuf.getContext('2d');
    state.strips = makeStrips(b);
    state.blob = paintBlob();
    state.motes = makeMotes(g, rand);
    state.dashes = PASSES.map((p) => [p.len * g.U, (WAVE_PERIOD - p.len) * g.U]);
    state.noDash = [];
    state.flow = 40;
  }

  function draw(ctx, t, dt, api) {
    const { g, b } = state;
    state.flow += dt * api.props.flow;
    ctx.drawImage(state.wall, 0, 0);
    drawLight(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawSheen(ctx, b, t, api.props.sheen);
    drawGold(ctx, g, state.seams, state.flow);
    drawMotes(ctx, g, t);
  }

  Kasuri.run({
    defaults: { flow: 1, sheen: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.2 },
    maxFps: 20,
    setup,
    draw,
  });
})();
