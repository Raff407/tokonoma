/*
 * 蛙 Kaeru — a big green frog on a mossy stone at the pond's edge, soft rain.
 *
 * Pond, stone, frog and leaves are baked once. Each frame adds a limited pool of
 * ring ripples worked out from the clock alone, a batch of rain strokes, two
 * ellipses for the throat and an eyelid when it blinks.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const TAU = Math.PI * 2;
  const RINGS = 42;
  const RING_ECHOES = 3;
  const SPLASHES = 12;
  const BLINKS = [2.2, 7.6, 8.05, 15.1, 21.4, 27.3];
  const BLINK_LOOP = 31;
  const BLINK_LENGTH = 0.38;
  const RAIN_BANDS = [
    { count: 44, speed: 62, length: 3, alpha: 0.26, width: 0.3 },
    { count: 30, speed: 88, length: 5, alpha: 0.38, width: 0.4 },
    { count: 14, speed: 120, length: 8, alpha: 0.5, width: 0.55 },
  ];
  const FROG = {
    ink: '#24351f',
    back: '#98c656',
    flank: '#80b04a',
    shade: '#5d8e3c',
    light: '#c6e07c',
    spot: '#4c7c3a',
    belly: '#e4dfb0',
    bellyShade: '#bcbc88',
    gleam: '#e9efc4',
  };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function hash(n) {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  // A closed soft outline through a list of points.
  function blob(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }

  // An open soft line through a list of points.
  function line(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
  }

  function dab(ctx, x, y, rx, ry, colour, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ---------- the far bank and the pond ---------- */

  function paintHill(ctx, g, base, height, scale, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.shore + g.U);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, base - fbm(x * scale, seed, 4, seed) * height);
    }
    ctx.lineTo(g.W, g.shore + g.U);
    ctx.fill();
  }

  function paintLantern(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#44524f';
    ctx.fillRect(x - u * 2.6, y - u * 1.4, u * 5.2, u * 1.4);
    ctx.fillRect(x - u * 1, y - u * 7, u * 2, u * 5.6);
    ctx.fillRect(x - u * 2.6, y - u * 8.2, u * 5.2, u * 1.2);
    ctx.fillRect(x - u * 1.9, y - u * 11, u * 3.8, u * 2.8);
    ctx.fillStyle = '#c9a65a';
    ctx.fillRect(x - u * 0.9, y - u * 10.5, u * 1.8, u * 1.8);
    ctx.fillStyle = '#44524f';
    ctx.beginPath();
    ctx.moveTo(x - u * 4.4, y - u * 11);
    ctx.quadraticCurveTo(x - u * 1.5, y - u * 11.6, x, y - u * 14);
    ctx.quadraticCurveTo(x + u * 1.5, y - u * 11.6, x + u * 4.4, y - u * 11);
    ctx.fill();
  }

  // Clustered shrubs along the shore: many small marks, big clumps, gaps between.
  function paintBushes(ctx, g, rand, height, tones) {
    const u = g.U;
    for (let x = -u * 2; x < g.W + u * 2; x += u * (5 + rand() * 9)) {
      const wide = u * (2.5 + rand() * 5);
      const tall = u * height * (0.5 + rand() * 0.7);
      for (let k = 0; k < 26; k++) {
        const a = rand() * Math.PI;
        const d = Math.sqrt(rand());
        const px = x + Math.cos(a) * d * wide;
        const py = g.shore + u - Math.sin(a) * d * tall;
        dab(ctx, px, py, u * (0.5 + rand() * 0.9), u * (0.4 + rand() * 0.6), tones[Math.floor(rand() * 3)], 0.95);
      }
    }
  }

  function paintBank(g, rand) {
    const c = layer(g.W, g.shore + g.U);
    const ctx = c.getContext('2d');
    const u = g.U;
    const sky = ctx.createLinearGradient(0, 0, 0, g.shore);
    sky.addColorStop(0, '#9aaaa9');
    sky.addColorStop(1, '#c6cdc0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.shore + u);
    for (let i = 0; i < 26; i++) {
      const tone = i % 2 ? '#bdc6ba' : '#94a4a3';
      dab(ctx, rand() * g.W, rand() * g.shore * 0.7, u * (12 + rand() * 24), u * (1.2 + rand() * 2.4), tone, 0.4);
    }
    paintHill(ctx, g, g.shore + u * 2, u * 22, 0.012 / u, 3, '#94a79f');
    paintHill(ctx, g, g.shore + u, u * 17, 0.03 / u, 8, '#7c9685');
    paintBushes(ctx, g, rand, 6.5, ['#6f8c70', '#5f7f66', '#7f9a78']);
    paintHill(ctx, g, g.shore + u * 2, u * 7, 0.07 / u, 13, '#5c7a5e');
    for (let i = 0; i < 12; i++) {
      dab(ctx, rand() * g.W, g.shore - u * (2 + rand() * 5), u * (8 + rand() * 16), u * (0.5 + rand() * 0.8), '#a4b5a8', 0.3);
    }
    paintLantern(ctx, g, g.W * 0.2, g.shore - u * 1.2);
    paintBushes(ctx, g, rand, 2.6, ['#5f8058', '#4d6d4e', '#6f8f5c']);
    return c;
  }

  // Water: flat tone bands that darken toward the viewer, the bank mirrored
  // and broken up on top, row by row, once.
  function paintPond(g, bank) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const water = ctx.createLinearGradient(0, g.shore, 0, g.H);
    water.addColorStop(0, '#8aa5a8');
    water.addColorStop(0.14, '#5d7f88');
    water.addColorStop(0.45, '#436675');
    water.addColorStop(1, '#335266');
    ctx.fillStyle = water;
    ctx.fillRect(0, g.shore, g.W, g.H - g.shore);
    const depth = u * 11;
    for (let row = 0; row < depth; row++) {
      const f = row / depth;
      const sway = Math.sin(row * 0.9) * u * (0.3 + f * 1.4);
      ctx.globalAlpha = 0.6 * (1 - f);
      ctx.drawImage(bank, 0, g.shore - row * 1.2 - 1, g.W, 1, sway, g.shore + row, g.W, 1);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(bank, 0, 0);
    ctx.fillStyle = '#c2cfc9';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, g.shore, g.W, Math.max(1, u * 0.4));
    ctx.globalAlpha = 1;
    return c;
  }

  // A pale broken sheen that tiles sideways, baked at half size in a few flat tones.
  function paintSheen(g) {
    const w = Math.ceil(g.W * 0.6);
    const h = Math.ceil((g.H - g.shore) / 2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const fx = 26 / w;
    const fy = 40 / h;
    const density = (x, y) => fbm(x * fx, y * fy, 3, 41);
    for (let y = 0; y < h; y++) {
      const fade = lerp(0.6, 0.5, y / h);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 176;
        img.data[i + 1] = 200;
        img.data[i + 2] = 204;
        img.data[i + 3] = (Math.round(smoothstep(0.52, 0.72, v) * 3) / 3) * 96 * fade;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---------- lily leaves ---------- */

  function paintPad(ctx, g, rand, pad) {
    const x = pad.x * g.W;
    const y = pad.y * g.U;
    const r = pad.r * g.U;
    const ry = r * 0.4;
    const notch = pad.notch;
    dab(ctx, x + r * 0.05, y + ry * 0.22, r * 1.02, ry * 1.02, '#223a48', 0.6);
    ctx.fillStyle = pad.tone;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.ellipse(x, y, r, ry, 0, notch + 0.2, notch - 0.2 + TAU);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    dab(ctx, x - r * 0.2, y - ry * 0.3, r * 0.66, ry * 0.5, pad.light, 0.65);
    ctx.strokeStyle = pad.vein;
    ctx.lineWidth = Math.max(0.7, g.U * 0.22);
    ctx.globalAlpha = 0.7;
    for (let a = notch + 0.6; a < notch + TAU - 0.4; a += 0.62) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * ry);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = pad.light;
    ctx.lineWidth = Math.max(0.8, g.U * 0.3);
    ctx.beginPath();
    ctx.ellipse(x, y, r, ry, 0, notch + 0.2, notch - 0.2 + TAU);
    ctx.stroke();
    for (let i = 0; i < 4 + r / g.U; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * 0.8;
      dab(ctx, x + Math.cos(a) * d * r, y + Math.sin(a) * d * ry, g.U * (0.2 + rand() * 0.3), g.U * 0.2, '#dfe8dc', 0.75);
    }
  }

  function paintLily(ctx, g, x, y, size) {
    const petal = (a, reach, width, colour) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.62);
      ctx.rotate(a);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(reach * 0.5, -width, reach, 0);
      ctx.quadraticCurveTo(reach * 0.5, width, 0, 0);
      ctx.fill();
      ctx.restore();
    };
    for (let i = 0; i < 9; i++) petal((i / 9) * TAU + 0.2, size, size * 0.36, '#c7a5a0');
    for (let i = 0; i < 7; i++) petal((i / 7) * TAU, size * 0.76, size * 0.3, '#ece3cf');
    dab(ctx, x, y - size * 0.12, size * 0.28, size * 0.18, '#d0a644');
  }

  function padList() {
    const tones = [
      { tone: '#5c8c52', light: '#84b068', vein: '#44703f' },
      { tone: '#4f7f55', light: '#76a566', vein: '#3a6544' },
      { tone: '#6a9450', light: '#93b86c', vein: '#4e7842' },
    ];
    const raw = [
      [0.46, 25.5, 2.4, 0.9], [0.92, 28, 2.8, 3.8], [0.37, 31, 4, 2.1], [0.05, 32, 4.5, 5.1],
      [0.27, 36, 5.2, 0.5], [0.83, 37, 5.2, 4.4], [0.13, 43, 7.4, 1.4], [0.37, 47, 5.6, 5.6],
      [0.91, 49, 7.6, 2.6], [0.05, 59, 11, 5.8], [0.28, 58, 9, 3.3], [0.84, 67, 10.4, 0.3],
      [0.13, 75, 16.5, 4.2],
    ];
    const near = [[0.63, 96.5, 14, 3.7], [0.3, 97, 12, 5.2]];
    const make = (r, i) => ({ x: r[0], y: r[1], r: r[2], notch: r[3], ...tones[i % 3] });
    return { far: raw.map(make), near: near.map(make) };
  }

  /* ---------- the stone, the bank at the bottom ---------- */

  function stoneOutline(g) {
    const s = g.S;
    const pts = [
      [-60, 25], [-57, 12], [-48, 4], [-32, 0.5], [-8, -1.5], [14, -1], [34, -0.5], [47, 3.5],
      [57, 11], [62, 23], [52, 30], [18, 32], [-24, 32], [-52, 30],
    ];
    return pts.map((p) => [g.fx + p[0] * s, g.fy + p[1] * s]);
  }

  function paintStone(ctx, g, rand) {
    const s = g.S;
    const outline = stoneOutline(g);
    ctx.save();
    ctx.translate(g.fx, g.fy + 32 * s);
    ctx.scale(1, -0.28);
    ctx.translate(-g.fx, -g.fy - 32 * s);
    ctx.fillStyle = '#2b4655';
    ctx.globalAlpha = 0.6;
    blob(ctx, outline);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#92968b';
    blob(ctx, outline);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const tones = ['#bcbeae', '#a4a79a', '#80847b', '#686f6b'];
    for (let i = 0; i < 300; i++) {
      const lx = (rand() - 0.5) * 124;
      const f = rand();
      const y = g.fy + f * 33 * s;
      const side = Math.abs(lx) / 62;
      const pick = Math.min(3, Math.floor((f * 0.8 + side * 0.35 + rand() * 0.4) * 3.2));
      dab(ctx, g.fx + lx * s, y, s * (1.6 + rand() * 6), s * (0.6 + rand() * 1.9), tones[pick], 0.8);
    }
    paintCracks(ctx, g, rand);
    ctx.restore();
    paintMoss(ctx, g, rand);
    ctx.strokeStyle = '#c4d6d2';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.globalAlpha = 0.75;
    line(ctx, outline.slice(10).concat([outline[0]]));
    ctx.stroke();
    ctx.globalAlpha = 1;
    paintTuft(ctx, g, rand, g.fx - 52 * s, g.fy + 13 * s, -1);
    paintTuft(ctx, g, rand, g.fx + 50 * s, g.fy + 11 * s, 1);
  }

  function paintCracks(ctx, g, rand) {
    const s = g.S;
    ctx.strokeStyle = '#4f5653';
    ctx.lineWidth = Math.max(1, s * 0.7);
    ctx.lineCap = 'round';
    const cracks = [[-30, 22, -20, 25, -24, 31], [26, 20, 32, 25, 28, 31]];
    for (const k of cracks) {
      line(ctx, [[g.fx + k[0] * s, g.fy + k[1] * s], [g.fx + k[2] * s, g.fy + k[3] * s], [g.fx + k[4] * s, g.fy + k[5] * s]]);
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      dab(ctx, g.fx + (rand() - 0.5) * 110 * s, g.fy + (6 + rand() * 24) * s, s * 0.5, s * 0.4, '#d6d8c8', 0.7);
    }
  }

  // A little spray of grass or fern where the stone meets the moss.
  function paintTuft(ctx, g, rand, x, y, dir) {
    const s = g.S;
    const tones = ['#7fa04e', '#5f8440', '#98b45e'];
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const lean = (i / 9 - 0.3) * dir;
      const tall = s * (7 + rand() * 7);
      ctx.strokeStyle = tones[i % 3];
      ctx.lineWidth = Math.max(1, s * 0.7);
      ctx.beginPath();
      ctx.moveTo(x + (i - 5) * s * 0.6, y);
      ctx.quadraticCurveTo(x + (i - 5) * s * 0.6 + lean * tall * 0.2, y - tall * 0.8, x + (i - 5) * s * 0.6 + lean * tall, y - tall * (0.75 + rand() * 0.25));
      ctx.stroke();
    }
  }

  // A soft cap over the top of the stone, scalloped below, with fine marks on it.
  function paintMoss(ctx, g, rand) {
    const s = g.S;
    const tones = ['#6d8d46', '#7c9c4c', '#5a7a40', '#8cab54'];
    blob(ctx, stoneOutline(g));
    ctx.save();
    ctx.clip();
    const spots = [];
    for (let i = 0; i < 20; i++) {
      const lx = -58 + (i / 19) * 116 + (rand() - 0.5) * 5;
      const drop = Math.abs(lx) < 34 ? 0 : (Math.abs(lx) - 34) * 0.42;
      const spot = { lx, cy: drop + 2 + rand() * 3, rx: 5 + rand() * 7, ry: 3 + rand() * rand() * rand() * 15 };
      spots.push(spot);
      dab(ctx, g.fx + lx * s, g.fy + spot.cy * s, spot.rx * s, spot.ry * s, '#5f7f42');
    }
    for (let i = 0; i < 6; i++) {
      const spot = { lx: -46 + rand() * 92, cy: 16 + rand() * 12, rx: 1.2 + rand() * 3, ry: 0.7 + rand() * 1.1 };
      spots.push(spot);
      dab(ctx, g.fx + spot.lx * s, g.fy + spot.cy * s, spot.rx * s, spot.ry * s, '#5f7f42');
    }
    for (const spot of spots) {
      for (let k = 0; k < 42; k++) {
        const a = rand() * TAU;
        const d = Math.sqrt(rand());
        const x = g.fx + (spot.lx + Math.cos(a) * d * spot.rx) * s;
        const y = g.fy + (spot.cy + Math.sin(a) * d * spot.ry) * s;
        dab(ctx, x, y, s * (0.4 + rand() * 0.7), s * (0.3 + rand() * 0.5), tones[Math.floor(rand() * 4)]);
      }
    }
    ctx.restore();
  }

  function paintBottomBank(ctx, g, rand, x0, x1, top, seed) {
    const u = g.U;
    ctx.fillStyle = '#3f5a3c';
    ctx.beginPath();
    ctx.moveTo(x0, g.H);
    for (let f = 0; f <= 1.001; f += 0.05) {
      const x = lerp(x0, x1, f);
      const y = lerp(g.H, top, Math.sqrt(f)) - fbm(x * 0.2 / u, seed, 3, seed) * u * 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, g.H);
    ctx.fill();
    const tones = ['#5a7d42', '#708f48', '#4a6a3c', '#3c5636'];
    const span = Math.abs(x1 - x0);
    const count = Math.ceil((span / u) * 6);
    for (let i = 0; i < count; i++) {
      const f = rand();
      const x = lerp(x0, x1, f);
      const tp = lerp(g.H, top, Math.sqrt(f));
      const y = lerp(tp, g.H, rand() * rand());
      dab(ctx, x, y, u * (0.4 + rand() * 1.5), u * (0.3 + rand()), tones[Math.floor(rand() * 4)]);
    }
  }

  /* ---------- the frog, all in local units, facing left, feet at y = 0 ---------- */

  const BODY = [
    [-38, -27], [-34, -32], [-26, -37], [-19, -40], [-9, -39], [0, -39], [11, -40.5], [21, -36],
    [29, -27], [33, -16], [31, -6], [22, 0], [-8, 0], [-15, -6], [-17, -14], [-24, -18.5], [-33, -22.5],
  ];
  const THIGH = [
    [33, -24], [23, -30], [9, -28], [-3, -22], [-7, -16], [-2, -12], [12, -12.5], [29, -11],
  ];
  const SHANK = [
    [-6, -15], [6, -14], [22, -9], [35, -5.5], [34, -1], [22, -1.5], [6, -4.5], [-4, -8],
  ];
  const FOOT = [
    [34, -2.6], [18, -1.8], [2, -2.8], [-8, -3.4], [-10, -0.2], [2, 1.3], [18, 1.2], [33, 0.6],
  ];
  const ARM = [
    [-18, -23], [-9, -22], [-8, -15], [-12, -8], [-17, -2], [-23, -1], [-25, -3.5], [-20, -9], [-18, -15],
  ];

  function fillOutlined(ctx, pts, colour) {
    blob(ctx, pts);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.strokeStyle = FROG.ink;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  function paintToes(ctx, x, y, tips, width, colour) {
    ctx.lineCap = 'round';
    for (const tip of tips) {
      ctx.strokeStyle = FROG.ink;
      ctx.lineWidth = width + 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tip[0], tip[1]);
      ctx.stroke();
    }
    for (const tip of tips) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tip[0], tip[1]);
      ctx.stroke();
      dab(ctx, tip[0], tip[1], width * 0.8, width * 0.7, colour);
    }
  }

  function paintBodyMarks(ctx, rand) {
    blob(ctx, BODY);
    ctx.save();
    ctx.clip();
    dab(ctx, 2, -3, 30, 15, FROG.flank);
    dab(ctx, -9, -1, 9, 6, FROG.bellyShade);
    dab(ctx, 2, -44, 32, 7.5, FROG.light, 0.85);
    dab(ctx, -28, -33, 7, 2.6, FROG.light, 0.85);
    const spots = [[-3, -33, 3, 2], [8, -35, 3.6, 2.2], [17, -31, 2.8, 2.2], [4, -28, 2.2, 1.6], [24, -24, 2.4, 1.9], [-11, -22, 1.8, 1.4]];
    for (const p of spots) dab(ctx, p[0], p[1], p[2], p[3], FROG.spot);
    for (let i = 0; i < 16; i++) {
      dab(ctx, -14 + rand() * 42, -38 + rand() * 18, 0.5 + rand() * 0.9, 0.4 + rand() * 0.6, FROG.spot, 0.8);
    }
    ctx.restore();
  }

  function paintHeadMarks(ctx) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = FROG.ink;
    ctx.lineWidth = 0.9;
    line(ctx, [[-37.5, -26], [-29, -23.6], [-19, -22.6], [-11, -26]]);
    ctx.stroke();
    dab(ctx, -33.4, -30, 0.85, 0.7, FROG.ink);
    dab(ctx, -7, -29.5, 4, 4.1, FROG.ink);
    dab(ctx, -7, -29.5, 3.2, 3.3, FROG.shade);
    dab(ctx, -7.8, -30.4, 1.2, 1, FROG.flank);
    ctx.strokeStyle = FROG.shade;
    ctx.lineWidth = 1.5;
    line(ctx, [[-10, -36.5], [-1, -35], [2, -27]]);
    ctx.stroke();
    ctx.strokeStyle = FROG.light;
    ctx.lineWidth = 1.2;
    line(ctx, [[-3, -38], [12, -36.5], [22, -29], [28, -21]]);
    ctx.stroke();
  }

  function paintEye(ctx) {
    dab(ctx, -17, -39, 8, 8, FROG.ink);
    dab(ctx, -17, -39, 7.2, 7.2, FROG.back);
    dab(ctx, -18, -43, 5.4, 2.8, FROG.light);
    dab(ctx, -17, -38.4, 5.7, 5.7, FROG.ink);
    dab(ctx, -17, -38.4, 5, 5, '#c79f3a');
    dab(ctx, -17.8, -40, 3, 2.4, '#e2c26a');
    dab(ctx, -17, -38.3, 3.5, 2.2, '#161c20');
    dab(ctx, -18.6, -39.8, 1.2, 1, '#f4f0dc');
    ctx.strokeStyle = FROG.ink;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(-17, -38.4, 6.4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  function paintHindLeg(ctx, rand) {
    fillOutlined(ctx, FOOT, FROG.back);
    paintToes(ctx, -7, -1, [[-17, -1.6], [-16.5, 1], [-13, 2.6]], 1.4, FROG.back);
    fillOutlined(ctx, SHANK, FROG.flank);
    blob(ctx, SHANK);
    ctx.save();
    ctx.clip();
    dab(ctx, 14, -1.5, 24, 3, FROG.shade);
    for (let x = 4; x < 32; x += 8) dab(ctx, x, -6.5 + (x - 16) * -0.12, 1.2, 2.4, FROG.spot, 0.8);
    ctx.restore();
    fillOutlined(ctx, THIGH, FROG.back);
    blob(ctx, THIGH);
    ctx.save();
    ctx.clip();
    dab(ctx, 13, -7, 26, 6.5, FROG.flank);
    dab(ctx, 8, -30, 20, 6, FROG.light, 0.8);
    ctx.strokeStyle = FROG.shade;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const x = 2 + i * 7.5 + rand() * 1.4;
      line(ctx, [[x + 4, -25], [x + 1, -19], [x + 2, -13]]);
      ctx.stroke();
    }
    ctx.restore();
    dab(ctx, 6, -24.5, 3.4, 0.8, FROG.gleam, 0.8);
    dab(ctx, 18, -22, 1.6, 0.6, FROG.gleam, 0.7);
  }

  function paintFrogBody(g, rand) {
    const size = 90 * g.S;
    const c = layer(size, 62 * g.S);
    const ctx = c.getContext('2d');
    state.frogAt = { x: g.fx - 45 * g.S, y: g.fy - 54 * g.S };
    ctx.setTransform(g.S, 0, 0, g.S, 45 * g.S, 54 * g.S);
    fillOutlined(ctx, BODY, FROG.back);
    paintBodyMarks(ctx, rand);
    paintHeadMarks(ctx);
    paintHindLeg(ctx, rand);
    paintEye(ctx);
    dab(ctx, -27, -34.4, 3, 0.8, FROG.gleam, 0.9);
    return c;
  }

  function paintFrogArm(g) {
    const c = layer(40 * g.S, 34 * g.S);
    const ctx = c.getContext('2d');
    state.armAt = { x: g.fx - 36 * g.S, y: g.fy - 28 * g.S };
    ctx.setTransform(g.S, 0, 0, g.S, 36 * g.S, 28 * g.S);
    paintToes(ctx, -21.5, -1.8, [[-31, -1.6], [-30.4, 0.8], [-26.5, 2.6], [-18.5, 2.8]], 1.5, FROG.back);
    fillOutlined(ctx, ARM, FROG.back);
    blob(ctx, ARM);
    ctx.save();
    ctx.clip();
    dab(ctx, -10, -10, 6, 9, FROG.flank);
    dab(ctx, -15, -21, 5, 4, FROG.light, 0.85);
    dab(ctx, -15, -11, 1.5, 2, FROG.spot, 0.9);
    ctx.restore();
    return c;
  }

  /* ---------- iris ---------- */

  // A sword leaf: narrow at the sheath, widest a third of the way up, long taper.
  function paintBlade(ctx, u, x, base, tipX, tipY, width, tone, rib) {
    const bend = (tipX - x) * 0.3;
    const lowY = lerp(base, tipY, 0.3);
    const highY = lerp(base, tipY, 0.72);
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.5, base);
    ctx.bezierCurveTo(x - width * 1.25, lowY, x - width * 0.55 + bend * 1.4, highY, tipX, tipY);
    ctx.bezierCurveTo(x + width * 0.55 + bend * 1.4, highY, x + width * 1.25, lowY, x + width * 0.5, base);
    ctx.fill();
    ctx.strokeStyle = rib;
    ctx.lineWidth = Math.max(0.7, u * 0.35);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.bezierCurveTo(x, lowY, x + bend * 1.4, highY, tipX, tipY);
    ctx.stroke();
  }

  function paintIrisFlower(ctx, u, x, y, size) {
    const fall = (dir) => {
      ctx.fillStyle = '#6f7cbc';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + dir * size * 0.5, y - size * 0.5, x + dir * size * 1.2, y - size * 0.1, x + dir * size * 0.95, y + size * 0.75);
      ctx.quadraticCurveTo(x + dir * size * 0.4, y + size * 0.5, x, y + size * 0.15);
      ctx.fill();
      dab(ctx, x + dir * size * 0.6, y + size * 0.12, size * 0.28, size * 0.14, '#d3ab48');
    };
    ctx.strokeStyle = '#4a7040';
    ctx.lineWidth = Math.max(1, u * 0.7);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + size * 3);
    ctx.stroke();
    ctx.fillStyle = '#a2abd8';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.34, y);
    ctx.quadraticCurveTo(x - size * 0.5, y - size * 0.9, x, y - size * 1.1);
    ctx.quadraticCurveTo(x + size * 0.5, y - size * 0.9, x + size * 0.34, y);
    ctx.fill();
    fall(-1);
    fall(1);
    ctx.fillStyle = '#515ea0';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.2, y - size * 0.1);
    ctx.quadraticCurveTo(x, y + size * 1.1, x + size * 0.2, y - size * 0.1);
    ctx.fill();
  }

  // One clump of blades. `lean` is +1 when the tips lean right, -1 when left.
  function paintIris(g, rand, wide, blades, lean, height, flowers) {
    const c = layer(wide, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const tones = [['#568c55', '#86b56c'], ['#467a50', '#6f9f62'], ['#659a58', '#98c272'], ['#3c6a4c', '#5d8c58']];
    ctx.lineCap = 'round';
    for (let i = 0; i < blades; i++) {
      const f = i / (blades - 1);
      const x = wide * (0.14 + f * 0.72) + (rand() - 0.5) * u * 2;
      const fan = (f - 0.5) * u * 24 + lean * u * 4;
      const tall = height + rand() * 26 - Math.abs(f - 0.5) * 30;
      const pick = tones[Math.floor(rand() * tones.length)];
      paintBlade(ctx, u, x, g.H + u, x + fan, g.H - tall * u, u * (2.3 + rand() * 1.4), pick[0], pick[1]);
    }
    for (const fl of flowers) paintIrisFlower(ctx, u, wide * fl[0], g.H - fl[1] * u, u * fl[2]);
    return c;
  }

  /* ---------- put the still parts together ---------- */

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const pads = padList();
    for (const pad of pads.far) paintPad(ctx, g, rand, pad);
    paintLily(ctx, g, g.W * 0.13 + u * 4, u * 72.5, u * 6.4);
    paintStone(ctx, g, rand);
    dab(ctx, g.fx + 3 * g.S, g.fy + 1.4 * g.S, 38 * g.S, 2.6 * g.S, '#34452c', 0.8);
    for (const pad of pads.near) paintPad(ctx, g, rand, pad);
    paintBottomBank(ctx, g, rand, g.W * 0.72, g.W + u, u * 80, 5);
    paintBottomBank(ctx, g, rand, g.W * 0.2, -u, u * 87, 11);
    return c;
  }

  function makeRain(g, rand) {
    return RAIN_BANDS.map((band) => {
      const xs = new Float32Array(band.count);
      const ys = new Float32Array(band.count);
      for (let i = 0; i < band.count; i++) {
        xs[i] = rand() * g.W;
        ys[i] = rand() * g.H;
      }
      return { ...band, xs, ys };
    });
  }

  function setup(ctx, api) {
    const U = api.rows / 100;
    const aspect = api.cols / api.rows;
    const g = { W: api.cols, H: api.rows, U, shore: U * 21, S: U * 0.92 * Math.min(1, aspect / 1.3) };
    g.fx = g.W * 0.565;
    g.fy = U * 65;
    const rand = K.rng(api.seed);
    state.g = g;
    state.pond = paintPond(g, paintBank(g, rand));
    state.sheen = paintSheen(g);
    state.sheenW = state.sheen.width * 2;
    state.front = paintFront(g, rand);
    state.frog = paintFrogBody(g, rand);
    state.arm = paintFrogArm(g);
    const clump = Math.ceil(U * 38);
    state.irisR = paintIris(g, rand, clump, 9, 1, 58, [[0.42, 82, 6.6], [0.74, 64, 5.6]]);
    state.irisL = paintIris(g, rand, clump, 6, -1, 56, [[0.74, 66, 5.2]]);
    state.clump = clump;
    state.rain = makeRain(g, rand);
  }

  /* ---------- each frame ---------- */

  function drawSheen(ctx, g, t) {
    const w = state.sheenW;
    const h = g.H - g.shore;
    const a = (t * g.U * 0.9) % w;
    const b = (t * g.U * 0.5) % w;
    for (let x = a - w; x < g.W; x += w) ctx.drawImage(state.sheen, x, g.shore, w, h);
    ctx.globalAlpha = 0.6;
    for (let x = -b; x < g.W; x += w) ctx.drawImage(state.sheen, x, g.shore + g.U * 1.5, w, h);
    ctx.globalAlpha = 1;
  }

  // Every ring is worked out from the clock, so there is nothing to keep or allocate.
  function drawRing(ctx, g, i, t, rain) {
    const period = 2.6 + hash(i + 0.5) * 1.8;
    const clock = t / period + hash(i + 7.5);
    const round = Math.floor(clock);
    const age = clock - round;
    const x = hash(i * 3.17 + round * 1.71 + 0.3) * g.W;
    const depth = hash(i * 5.31 + round * 2.93 + 0.7);
    const y = lerp(g.shore + g.U * 4, g.H, depth);
    const squash = lerp(0.27, 0.38, depth);
    const far = lerp(0.75, 1, depth);
    const near = lerp(0.42, 1.3, depth);
    const reach = g.U * near * (15 + hash(i * 2.2 + round) * 10);
    ctx.lineWidth = Math.max(1, g.U * (0.3 + near * 0.4));
    for (let e = 0; e < RING_ECHOES; e++) {
      const a = age * 1.36 - e * 0.18;
      if (a <= 0 || a >= 1) continue;
      const r = (1 - (1 - a) * (1 - a)) * reach;
      const fade = (1 - a) * (1.15 - e * 0.25) * Math.min(1, a * 14);
      ctx.globalAlpha = fade * far * Math.min(1, rain);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * squash, 0, 0, TAU);
      ctx.stroke();
    }
  }

  function drawRings(ctx, g, t, rain) {
    const count = Math.round(RINGS * rain);
    ctx.strokeStyle = '#e4efe9';
    for (let i = 0; i < count; i++) drawRing(ctx, g, i, t, rain);
    ctx.globalAlpha = 1;
  }

  // Quick shallow pumps, with a slow swell over them, as a resting frog does.
  function drawThroat(ctx, g, t, amount) {
    const s = g.S;
    const pump = 0.5 + 0.5 * Math.sin(t * 3.4);
    const swell = 0.55 + 0.45 * Math.sin(t * 0.37);
    const fill = pump * swell * amount;
    const x = g.fx - 24.5 * s;
    const y = g.fy - 20.5 * s + fill * 0.8 * s;
    const rx = (10.8 + fill * 1.4) * s;
    const ry = (5.4 + fill * 4.6) * s;
    ctx.fillStyle = FROG.ink;
    ctx.beginPath();
    ctx.ellipse(x, y, rx + 0.8 * s, ry + 0.8 * s, 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = FROG.bellyShade;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = FROG.belly;
    ctx.beginPath();
    ctx.ellipse(x - 0.8 * s, y - 1.3 * s, rx * 0.84, ry * 0.76, 0.42, 0, TAU);
    ctx.fill();
  }

  function blinkAmount(t) {
    const at = t % BLINK_LOOP;
    for (let i = 0; i < BLINKS.length; i++) {
      const f = (at - BLINKS[i]) / BLINK_LENGTH;
      if (f > 0 && f < 1) return Math.sin(f * Math.PI);
    }
    return 0;
  }

  function drawBlink(ctx, g, t) {
    const close = blinkAmount(t);
    if (close <= 0) return;
    const s = g.S;
    const x = g.fx - 17 * s;
    const y = g.fy - 38.4 * s;
    const r = 6.2 * s;
    const a = Math.asin(1 - 2 * Math.min(1, close * 1.1));
    ctx.fillStyle = FROG.flank;
    ctx.beginPath();
    ctx.arc(x, y, r, a, Math.PI - a);
    ctx.closePath();
    ctx.fill();
  }

  function drawIris(ctx, g, t) {
    const u = state.clump;
    const swayR = Math.sin(t * 0.47) * 0.012 + Math.sin(t * 1.3 + 1) * 0.004;
    const swayL = Math.sin(t * 0.41 + 2) * 0.012 + Math.sin(t * 1.1) * 0.004;
    ctx.setTransform(1, 0, swayR, 1, -swayR * g.H, 0);
    ctx.drawImage(state.irisR, g.W - u * 0.88, 0);
    ctx.setTransform(1, 0, swayL, 1, -swayL * g.H, 0);
    ctx.drawImage(state.irisL, -u * 0.62, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // A drop landing on the frog's back or the stone: a brief speck and two flecks.
  function drawSplash(ctx, g, i, t) {
    const s = g.S;
    const clock = t / (1.3 + hash(i + 0.25)) + hash(i + 3.5);
    const round = Math.floor(clock);
    const age = (clock - round) * 3.5;
    if (age >= 1) return;
    const pick = hash(i * 1.9 + round * 3.1);
    const lx = pick < 0.5 ? -4 + hash(i + round * 1.3) * 36 : -52 + hash(i + round * 1.3) * 106;
    const ly = pick < 0.5 ? -39 + Math.pow((lx - 6) / 26, 2) * 11 : 3 + hash(i * 2.7 + round) * 20;
    const x = g.fx + lx * s;
    const y = g.fy + ly * s;
    const size = Math.max(1, g.U * 0.55);
    const off = age * g.U * 1.8;
    ctx.globalAlpha = (1 - age) * 0.85;
    ctx.fillRect(x, y, size, size);
    ctx.fillRect(x - off, y - off * 0.6, size * 0.8, size * 0.8);
    ctx.fillRect(x + off, y - off * 0.6, size * 0.8, size * 0.8);
  }

  function drawSplashes(ctx, g, t, rain) {
    const count = Math.round(SPLASHES * rain);
    ctx.fillStyle = '#eef3e6';
    for (let i = 0; i < count; i++) drawSplash(ctx, g, i, t);
    ctx.globalAlpha = 1;
  }

  function drawRain(ctx, g, t, rain) {
    ctx.strokeStyle = '#d7e2e0';
    ctx.lineCap = 'round';
    for (const band of state.rain) {
      const count = Math.round(band.count * rain);
      const fall = t * band.speed * g.U;
      const len = band.length * g.U;
      ctx.globalAlpha = band.alpha;
      ctx.lineWidth = Math.max(1, band.width * g.U);
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const k = i % band.count;
        const y = (band.ys[k] + fall) % (g.H + len);
        const x = (band.xs[k] - y * 0.1 + g.W * 2) % g.W;
        ctx.moveTo(x, y - len);
        ctx.lineTo(x - len * 0.1, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const rain = api.props.rain;
    ctx.drawImage(state.pond, 0, 0);
    drawSheen(ctx, g, t);
    drawRings(ctx, g, t, rain);
    ctx.drawImage(state.front, 0, 0);
    drawThroat(ctx, g, t, api.props.throat);
    ctx.drawImage(state.frog, state.frogAt.x, state.frogAt.y);
    ctx.drawImage(state.arm, state.armAt.x, state.armAt.y);
    drawBlink(ctx, g, t);
    drawSplashes(ctx, g, t, rain);
    drawIris(ctx, g, t);
    drawRain(ctx, g, t, rain);
  }

  Kasuri.run({
    defaults: { rain: 1, throat: 1, ramp: 'lines', cell: 7, boost: 0.14, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
