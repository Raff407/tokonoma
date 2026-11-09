/*
 * 松本城 Matsumoto — the black keep in its moat, a red bridge at its side, the Alps behind.
 *
 * Sky, peaks, castle, bank and trees are baked into two layers and repainted
 * once a minute from the clock, so the windows glow at night. The moat is the
 * baked world flipped and laid back in thin rows that slide sideways. Between
 * repaints only clouds, those rows, two swans and a few petals move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.63;
  const BASE = 0.59;
  const RETINT_SECONDS = 60;
  const PETALS = 18;
  const GLINTS = 14;
  const SCALE = 1.2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  // Colour lit by the sky, then sunk toward ink as night comes on.
  function tint(sky, base, lit, dark) {
    const c = mixColor(rgb(base), sky.amb, lit);
    return hex(mixColor(c, rgb(dark), sky.night * 0.7));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WATER);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.fillStyle = '#e8e2cc';
      ctx.globalAlpha = sky.night * 0.9;
      blob(ctx, g.W * 0.8, g.H * 0.17, g.U * 2.6, g.U * 2.6);
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 21);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- mountains ---------------------------------------------------------

  function alpsTop(g, x) {
    const s = x / g.U;
    const r = 1 - Math.abs(fbm(s * 0.03, 3, 4, 7) * 2 - 1);
    const h = Math.pow(r, 1.4);
    return g.H * (0.5 - 0.23 * h) + (fbm(s * 0.22, 9, 3, 4) - 0.5) * g.U * 2.4;
  }

  function alpsPixel(g, sky, x, y, top) {
    const depth = (y - top) / (g.H * 0.2);
    const gully = fbm(x * 0.2 / g.U * 4, y * 0.02, 3, 9);
    const line = 0.5 + (fbm(x * 0.05 / g.U * 4, 4, 3, 11) - 0.5) * 0.3 + (gully - 0.5) * 0.45;
    const lit = mixColor(rgb('#ffffff'), sky.amb, 0.5);
    const east = 1 - 0.1 * smoothstep(0.3, 0.9, fbm(x * 0.01, 1, 2, 2));
    if (depth < line) {
      const snow = mixColor(mixColor(rgb('#eef0f2'), lit, 0.35), sky.top, 0.1 + sky.night * 0.3);
      return snow.map((c) => c * east * (gully > 0.62 ? 0.9 : 1));
    }
    const rock = mixColor(mixColor(rgb('#4d6088'), sky.haze, 0.45), rgb('#252f4e'), sky.night * 0.6);
    return mixColor(rock, sky.low, smoothstep(0.7, 1.4, depth) * 0.45).map((c) => c * east);
  }

  function paintAlps(ctx, g, sky) {
    const y0 = Math.floor(g.H * 0.2);
    const y1 = Math.ceil(g.H * 0.58);
    const w = g.W;
    const h = y1 - y0;
    const img = ctx.getImageData(0, y0, w, h);
    for (let x = 0; x < w; x++) {
      const top = alpsTop(g, x);
      for (let y = Math.max(0, Math.floor(top - y0)); y < h; y++) {
        const c = alpsPixel(g, sky, x, y0 + y, top);
        const i = (y * w + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
  }

  function paintHills(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, g.H * 0.46, 0, g.H * 0.6);
    grad.addColorStop(0, tint(sky, '#52665e', 0.3, '#10161e'));
    grad.addColorStop(1, tint(sky, '#3a4e44', 0.2, '#0c1218'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.6);
    for (let x = 0; x <= g.W; x += 2) {
      ctx.lineTo(x, g.H * 0.535 - g.U * (3 + 6 * fbm(x / g.U * 0.05, 5, 3, 13)));
    }
    ctx.lineTo(g.W, g.H * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tint(sky, '#2f4238', 0.15, '#0a0f14');
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      blob(ctx, x, g.H * (0.52 + rand() * 0.06), g.U * (0.8 + rand() * 1.3), g.U * (0.7 + rand() * 0.9));
    }
    const mist = ctx.createLinearGradient(0, g.H * 0.48, 0, g.H * 0.6);
    const m = hex(sky.haze);
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(1, m);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = mist;
    ctx.fillRect(0, g.H * 0.48, g.W, g.H * 0.12);
    ctx.globalAlpha = 1;
  }

  // ---- castle ------------------------------------------------------------

  function makeColors(sky) {
    return {
      wall: tint(sky, '#23252e', 0.1, '#0c0e16'),
      roof: tint(sky, '#4c5058', 0.2, '#12151e'),
      roofLine: tint(sky, '#6a6e74', 0.2, '#1c2030'),
      plaster: tint(sky, '#e8e3d2', 0.25, '#2a2e42'),
      stone: tint(sky, '#7a746a', 0.25, '#1a1c26'),
      stoneLine: tint(sky, '#4e4a44', 0.1, '#0e1018'),
      red: tint(sky, '#b4402a', 0.2, '#2a1418'),
      glow: hex(mixColor(mixColor(rgb('#d8d4c4'), sky.amb, 0.2), rgb('#e8b45c'), sky.night)),
    };
  }

  function keep(ctx, g, sky, col) {
    const u = g.U * SCALE;
    const cx = g.W * 0.5;
    const by = g.H * BASE;
    const X = (lx) => cx + lx * u;
    const Y = (ly) => by - ly * u;

    const roof = (hwEave, ly, hwTop, lyTop) => {
      ctx.fillStyle = col.roof;
      poly(ctx, [X(-hwEave - 1.6), Y(ly + 1), X(-hwEave), Y(ly), X(hwEave), Y(ly), X(hwEave + 1.6), Y(ly + 1), X(hwTop), Y(lyTop), X(-hwTop), Y(lyTop)]);
      ctx.fillStyle = col.roofLine;
      for (let k = 1; k < 3; k++) {
        const f = k / 3;
        ctx.fillRect(X(-lerp(hwEave, hwTop, f)), Y(lerp(ly, lyTop, f)), lerp(hwEave, hwTop, f) * 2 * u, Math.max(1, u * 0.12));
      }
      ctx.fillStyle = col.plaster;
      ctx.fillRect(X(-hwEave), Y(ly), hwEave * 2 * u, Math.max(1, u * 0.5));
      ctx.fillStyle = col.wall;
      ctx.fillRect(X(-hwEave), Y(ly - 0.5), hwEave * 2 * u, Math.max(1, u * 0.45));
    };

    const body = (hw, ly0, ly1, wins) => {
      ctx.fillStyle = col.wall;
      ctx.fillRect(X(-hw), Y(ly1), hw * 2 * u, (ly1 - ly0) * u);
      ctx.fillStyle = col.plaster;
      ctx.fillRect(X(-hw), Y(ly0 + 0.7), hw * 2 * u, Math.max(1, u * 0.7));
      const n = Math.max(1, Math.round((hw * 2) / 3.6));
      const step = (hw * 2) / n;
      for (let k = 0; k < n && wins; k++) {
        const wx = -hw + step * (k + 0.5);
        ctx.fillStyle = col.plaster;
        ctx.fillRect(X(wx - 0.95), Y(ly0 + 0.55 + (ly1 - ly0) * 0.72), u * 1.9, u * 1.9);
        ctx.fillStyle = col.glow;
        ctx.fillRect(X(wx - 0.7), Y(ly0 + 0.55 + (ly1 - ly0) * 0.72 - 0.25), u * 1.4, u * 1.4);
        ctx.fillStyle = col.wall;
        ctx.fillRect(X(wx - 0.05), Y(ly0 + 0.55 + (ly1 - ly0) * 0.72 - 0.25), Math.max(1, u * 0.12), u * 1.4);
      }
    };

    const gable = (lx, ly, hw, h) => {
      ctx.fillStyle = col.plaster;
      poly(ctx, [X(lx - hw), Y(ly), X(lx), Y(ly + h), X(lx + hw), Y(ly)]);
      ctx.strokeStyle = col.wall;
      ctx.lineWidth = Math.max(1, u * 0.35);
      ctx.beginPath();
      ctx.moveTo(X(lx - hw - 0.4), Y(ly - 0.1));
      ctx.lineTo(X(lx), Y(ly + h + 0.3));
      ctx.lineTo(X(lx + hw + 0.4), Y(ly - 0.1));
      ctx.stroke();
    };

    // Stone base across the whole group.
    ctx.fillStyle = col.stone;
    poly(ctx, [X(-37), Y(0), X(37), Y(0), X(36), Y(2.6), X(-36), Y(2.6)]);
    poly(ctx, [X(-20), Y(2.6), X(20), Y(2.6), X(17.6), Y(3.8), X(-17.6), Y(3.8)]);
    ctx.fillStyle = col.stoneLine;
    for (let k = 1; k < 3; k++) ctx.fillRect(X(-37), Y(k * 0.9), 74 * u, 1);

    // Black annex at the left.
    ctx.fillStyle = col.wall;
    ctx.fillRect(X(-35), Y(9.5), 20 * u, 6.9 * u);
    ctx.fillStyle = col.plaster;
    ctx.fillRect(X(-35), Y(3.3), 20 * u, Math.max(1, u * 0.7));
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(X(-32.5 + k * 6), Y(8), u * 1.9, u * 1.9);
      ctx.fillStyle = col.glow;
      ctx.fillRect(X(-32.2 + k * 6), Y(7.7), u * 1.3, u * 1.3);
      ctx.fillStyle = col.plaster;
    }
    ctx.fillStyle = col.roof;
    poly(ctx, [X(-38), Y(10.6), X(-36), Y(9.6), X(-14), Y(9.6), X(-12), Y(10.6), X(-18), Y(13), X(-32), Y(13)]);
    ctx.fillStyle = col.plaster;
    ctx.fillRect(X(-36), Y(9.6), 22 * u, Math.max(1, u * 0.45));

    // Open red-railed moon-viewing hall at the right.
    ctx.fillStyle = col.wall;
    ctx.fillRect(X(17), Y(9.4), 19 * u, 6.8 * u);
    ctx.fillStyle = col.glow;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(X(18.2), Y(8.2), 16.6 * u, 3.6 * u);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col.wall;
    for (let k = 0; k <= 5; k++) ctx.fillRect(X(18 + k * 3.4), Y(8.4), Math.max(1, u * 0.45), 4.2 * u);
    ctx.fillStyle = col.red;
    ctx.fillRect(X(17), Y(5.6), 19 * u, Math.max(1, u * 0.7));
    ctx.fillRect(X(17), Y(4.4), 19 * u, Math.max(1, u * 0.4));
    ctx.fillStyle = col.roof;
    poly(ctx, [X(14), Y(10.8), X(16), Y(9.8), X(38), Y(9.8), X(40), Y(10.8), X(35), Y(13.4), X(19), Y(13.4)]);
    ctx.fillStyle = col.plaster;
    ctx.fillRect(X(16), Y(9.8), 22 * u, Math.max(1, u * 0.45));

    // Main keep: three black floors under three roofs.
    body(15.2, 3.8, 10.2, true);
    roof(20.4, 10.2, 14.4, 13.8);
    gable(-8.4, 11, 4.2, 3);
    gable(8.4, 11, 4.2, 3);
    body(11.4, 13.8, 19.6, true);
    roof(16.2, 19.6, 10.2, 22.8);
    gable(0, 20.4, 4.4, 3.4);
    body(8.6, 22.8, 28.2, true);
    roof(13.2, 28.2, 4, 33.2);
    ctx.fillStyle = col.roofLine;
    ctx.fillRect(X(-4.4), Y(33.4), 8.8 * u, Math.max(1, u * 0.45));
    ctx.fillStyle = '#c9a24a';
    blob(ctx, X(-4.6), Y(34.4), u * 0.55, u * 0.9);
    blob(ctx, X(4.6), Y(34.4), u * 0.55, u * 0.9);
  }

  // ---- bridge ------------------------------------------------------------

  function bridge(ctx, g, sky, col) {
    const x0 = g.W * 0.085;
    const x1 = g.W * 0.27;
    const top = g.H * 0.575;
    const arch = g.U * 2.4;
    const deckAt = (f) => top - Math.sin(f * Math.PI) * arch;
    ctx.fillStyle = col.red;
    ctx.beginPath();
    ctx.moveTo(x0, deckAt(0));
    for (let k = 1; k <= 24; k++) ctx.lineTo(lerp(x0, x1, k / 24), deckAt(k / 24));
    for (let k = 24; k >= 0; k--) ctx.lineTo(lerp(x0, x1, k / 24), deckAt(k / 24) + g.U * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = col.wall;
    ctx.globalAlpha = 0.55;
    for (let k = 0; k < 24; k++) ctx.fillRect(lerp(x0, x1, k / 24), deckAt(k / 24) + g.U * 0.9, Math.max(1, (x1 - x0) / 24), g.U * 0.5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col.red;
    for (let k = 0; k <= 12; k++) {
      const f = k / 12;
      ctx.fillRect(lerp(x0, x1, f), deckAt(f) - g.U * 2.6, Math.max(1, g.U * 0.35), g.U * 2.6);
      blob(ctx, lerp(x0, x1, f) + 0.5, deckAt(f) - g.U * 2.8, g.U * 0.5, g.U * 0.5);
    }
    ctx.strokeStyle = col.red;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (const lift of [2.4, 1.2]) {
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const f = k / 24;
        const px = lerp(x0, x1, f);
        if (k === 0) ctx.moveTo(px, deckAt(f) - g.U * lift);
        else ctx.lineTo(px, deckAt(f) - g.U * lift);
      }
      ctx.stroke();
    }
    ctx.fillStyle = col.stone;
    ctx.fillRect(x0 - g.U * 1.2, top - g.U * 0.5, g.U * 2.4, g.H * BASE + g.U * 3.5 - top);
    ctx.fillRect(x1 - g.U * 1.2, top - g.U * 0.5, g.U * 2.4, g.H * BASE + g.U * 3.5 - top);
  }

  // ---- trees, bank -------------------------------------------------------

  function pine(ctx, g, sky, px, base, s) {
    ctx.strokeStyle = tint(sky, '#4a382a', 0.1, '#10121a');
    ctx.lineWidth = Math.max(1.5, s * 0.55);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.quadraticCurveTo(px + s * 1.4, base - s * 6, px + s * 0.4, base - s * 12);
    ctx.stroke();
    const pads = [[1.2, -12.5, 5.4], [-4.2, -9.4, 4.4], [5.8, -8, 4.6], [-1.8, -5.2, 4.2], [4.2, -3.8, 3.4]];
    for (const [dx, dy, r] of pads) {
      ctx.fillStyle = tint(sky, '#2f4a35', 0.15, '#0a1016');
      blob(ctx, px + dx * s, base + dy * s * 0.9, r * s, r * s * 0.42);
      ctx.fillStyle = tint(sky, '#486a46', 0.25, '#101a20');
      blob(ctx, px + dx * s, base + dy * s * 0.9 - s * 0.5, r * s * 0.8, r * s * 0.26);
    }
  }

  function cherry(ctx, g, sky, px, base, s, rand) {
    ctx.strokeStyle = tint(sky, '#3a2c28', 0.1, '#0e1016');
    ctx.lineWidth = Math.max(2, s * 0.9);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.quadraticCurveTo(px - s * 1.5, base - s * 6, px - s * 0.6, base - s * 11);
    ctx.stroke();
    const tones = [tint(sky, '#e8c4c2', 0.2, '#2c2438'), tint(sky, '#d8a3a2', 0.2, '#2a2034'), tint(sky, '#f1dcd6', 0.2, '#30283c')];
    for (let i = 0; i < 70; i++) {
      const a = rand() * TAU;
      const r = Math.sqrt(rand());
      ctx.fillStyle = tones[Math.floor(rand() * 3)];
      blob(ctx, px - s * 0.6 + Math.cos(a) * r * s * 7.5, base - s * 12.5 + Math.sin(a) * r * s * 4.4, s * (0.8 + rand() * 1.2), s * (0.6 + rand() * 0.8));
    }
  }

  function paintBank(ctx, g, sky, col, rand) {
    // Hedges either side of the keep.
    for (let i = 0; i < 70; i++) {
      const left = rand() < 0.5;
      const x = left ? rand() * g.W * 0.26 : g.W * 0.74 + rand() * g.W * 0.26;
      ctx.fillStyle = tint(sky, '#33503a', 0.15, '#0a1218');
      blob(ctx, x, g.H * (BASE - 0.004), g.U * (1 + rand() * 1.4), g.U * (0.9 + rand() * 1));
    }
    const lawn = ctx.createLinearGradient(0, g.H * (BASE - 0.002), 0, g.H * 0.605);
    lawn.addColorStop(0, tint(sky, '#52704a', 0.2, '#101a18'));
    lawn.addColorStop(1, tint(sky, '#3c5a3c', 0.2, '#0c1412'));
    ctx.fillStyle = lawn;
    ctx.fillRect(0, g.H * (BASE - 0.002), g.W, g.H * (WATER - BASE));
  }

  function paintWall(ctx, g, sky, col) {
    const top = g.H * 0.6;
    const h = g.H * WATER - top;
    ctx.fillStyle = col.stone;
    ctx.fillRect(0, top, g.W, h);
    ctx.fillStyle = col.stoneLine;
    const rows = Math.max(2, Math.round(h / (g.U * 0.9)));
    for (let r = 1; r < rows; r++) ctx.fillRect(0, top + (h * r) / rows, g.W, 1);
    const rand = K.rng(5);
    for (let r = 0; r < rows; r++) {
      for (let x = rand() * g.U * 3; x < g.W; x += g.U * (2.2 + rand() * 2.4)) {
        ctx.fillRect(x, top + (h * r) / rows, 1, h / rows);
      }
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const col = makeColors(sky);
    paintAlps(ctx, g, sky);
    paintHills(ctx, g, sky, rand);
    paintBank(ctx, g, sky, col, rand);
    keep(ctx, g, sky, col);
    pine(ctx, g, sky, g.W * 0.045, g.H * 0.6, g.U * 1.25);
    cherry(ctx, g, sky, g.W * 0.9, g.H * 0.6, g.U * 1.2, rand);
    bridge(ctx, g, sky, col);
    paintWall(ctx, g, sky, col);
    return c;
  }

  // ---- foreground --------------------------------------------------------

  function lantern(ctx, g, sky, px, base, s) {
    const stone = tint(sky, '#8a8478', 0.2, '#1c1e28');
    const dark = tint(sky, '#5a564e', 0.1, '#10121a');
    ctx.fillStyle = dark;
    ctx.fillRect(px - s * 2.2, base - s * 1, s * 4.4, s * 1);
    ctx.fillStyle = stone;
    ctx.fillRect(px - s * 0.7, base - s * 6, s * 1.4, s * 5);
    ctx.fillRect(px - s * 1.8, base - s * 7, s * 3.6, s * 1);
    ctx.fillStyle = dark;
    ctx.fillRect(px - s * 1.4, base - s * 10, s * 2.8, s * 3);
    ctx.fillStyle = state.glow;
    ctx.fillRect(px - s * 0.7, base - s * 9.2, s * 1.4, s * 1.5);
    ctx.fillStyle = stone;
    poly(ctx, [px - s * 3, base - s * 10, px + s * 3, base - s * 10, px + s * 1.6, base - s * 12.2, px - s * 1.6, base - s * 12.2]);
    blob(ctx, px, base - s * 12.8, s * 0.7, s * 0.7);
  }

  function paintNear(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tint(sky, '#40583e', 0.15, '#0a1214');
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    ctx.lineTo(0, g.H * 0.86);
    for (let x = 0; x <= g.W * 0.4; x += 2) {
      const f = x / (g.W * 0.4);
      ctx.lineTo(x, g.H * (0.86 + 0.14 * Math.pow(f, 0.8)) + (fbm(x * 0.1, 3, 2, 3) - 0.5) * g.U);
    }
    ctx.lineTo(g.W * 0.4, g.H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tint(sky, '#5c7a4e', 0.2, '#101c18');
    for (let x = 0; x < g.W * 0.3; x += g.U * 1.6) blob(ctx, x, g.H * 0.875 + (x / g.W) * g.H * 0.1, g.U * 1.2, g.U * 0.5);
    lantern(ctx, g, sky, g.W * 0.13, g.H * 0.945, g.U * 0.62);
    return c;
  }

  // ---- water -------------------------------------------------------------

  function paintReflection(g, sky, world) {
    const wy = Math.round(g.H * WATER);
    const wh = g.H - wy;
    const c = layer(g.W, wh);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, wy);
    ctx.drawImage(world, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const water = mixColor(mixColor(rgb('#3a5560'), sky.low, 0.2), rgb('#0e1420'), sky.night * 0.7);
    const veil = ctx.createLinearGradient(0, 0, 0, wh);
    veil.addColorStop(0, `rgba(${water.map(Math.round).join(',')},0.38)`);
    veil.addColorStop(1, `rgba(${water.map(Math.round).join(',')},0.8)`);
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, g.W, wh);
    return { canvas: c, wy, wh, water: hex(water) };
  }

  function drawWater(ctx, g, t) {
    const w = state.water;
    const m = Math.ceil(g.U * 0.8) + 1;
    ctx.fillStyle = w.water;
    ctx.fillRect(0, w.wy, g.W, w.wh);
    for (let r = 0; r < w.wh; r++) {
      const depth = r / w.wh;
      const off = Math.sin(r * 0.5 + t * 1.4) * g.U * 0.35 * (0.4 + depth)
        + Math.sin(r * 0.11 - t * 0.45) * g.U * 0.5;
      ctx.drawImage(w.canvas, m, r, g.W - m * 2, 1, m + off, w.wy + r, g.W - m * 2, 1);
    }
    ctx.fillStyle = state.sheen;
    for (let i = 0; i < GLINTS; i++) {
      const a = (i * 0.618) % 1;
      const gy = w.wy + g.U * 1.5 + a * (w.wh - g.U * 4);
      const gx = ((a * 977 + t * g.U * (0.5 + a)) % (g.W + 40)) - 20;
      ctx.globalAlpha = (0.12 + 0.16 * Math.sin(t * 0.8 + i * 2) ** 2) * (1 - state.dim * 0.5);
      ctx.fillRect(gx, gy, g.U * (2 + a * 3), Math.max(1, g.U * 0.18));
    }
    ctx.globalAlpha = 1;
  }

  function drawSwan(ctx, g, px, py, s, dir) {
    ctx.fillStyle = '#e6e2d4';
    ctx.globalAlpha = 0.28;
    blob(ctx, px, py + s * 1.1, s * 1.9, s * 0.45);
    ctx.globalAlpha = 1;
    blob(ctx, px, py, s * 1.8, s * 0.8);
    blob(ctx, px - dir * s * 1.5, py - s * 0.7, s * 0.9, s * 0.7);
    ctx.strokeStyle = '#e6e2d4';
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + dir * s * 1.2, py - s * 0.3);
    ctx.quadraticCurveTo(px + dir * s * 2.4, py - s * 1.2, px + dir * s * 1.9, py - s * 2.6);
    ctx.stroke();
    blob(ctx, px + dir * s * 1.95, py - s * 2.8, s * 0.5, s * 0.4);
    ctx.fillStyle = '#c8562c';
    ctx.fillRect(px + dir * s * 2.2 - (dir < 0 ? s * 0.7 : 0), py - s * 2.85, s * 0.7, Math.max(1, s * 0.3));
  }

  function drawSwans(ctx, g, t) {
    const s = g.U * 0.85;
    drawSwan(ctx, g, g.W * 0.38 + Math.sin(t * 0.07) * g.W * 0.07, g.H * 0.74 + Math.sin(t * 0.5) * s * 0.12, s, 1);
    drawSwan(ctx, g, g.W * 0.7 + Math.sin(t * 0.05 + 2) * g.W * 0.06, g.H * 0.8 + Math.sin(t * 0.45 + 1) * s * 0.12, s * 1.1, -1);
  }

  function drawPetals(ctx, g, t) {
    ctx.fillStyle = state.petal;
    for (let i = 0; i < PETALS; i++) {
      const a = (t * 0.035 + i * 0.318) % 1;
      const px = g.W * (0.7 + 0.28 * ((i * 0.37) % 1)) - a * g.W * 0.22 + Math.sin(t * 0.9 + i * 1.7) * g.U * 1.2;
      const py = g.H * 0.3 + a * g.H * 0.62;
      ctx.globalAlpha = 0.85 * Math.min(1, (1 - a) * 4);
      ctx.fillRect(px, py, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  // ---- bake and run ------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    const skyLayer = paintSky(g, sky, rand);
    const front = paintFront(g, sky, rand);
    const world = layer(g.W, g.H);
    const wctx = world.getContext('2d');
    wctx.drawImage(skyLayer, 0, 0);
    wctx.drawImage(front, 0, 0);
    state.sky = skyLayer;
    state.front = front;
    state.water = paintReflection(g, sky, world);
    state.glow = hex(mixColor(rgb('#d8d4c4'), rgb('#e8b45c'), sky.night));
    state.near = paintNear(g, sky);
    state.sheen = hex(mixColor(mixColor(rgb('#f4f0e6'), sky.amb, 0.4), rgb('#8a94b0'), sky.night * 0.7));
    state.petal = hex(mixColor(rgb('#ecd0cc'), rgb('#4a4660'), sky.night * 0.6));
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.front, 0, 0);
    drawWater(ctx, g, t);
    drawSwans(ctx, g, t);
    ctx.drawImage(state.near, 0, 0);
    if (props.petals) drawPetals(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, petals: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
