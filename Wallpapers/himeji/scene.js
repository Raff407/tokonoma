/*
 * 姫路城 Himeji — the white heron castle on its hill in spring.
 *
 * Sky, hills, castle, stone walls and cherry trees are baked into layers and
 * repainted once a minute from the clock. Between repaints only clouds,
 * ground mist, falling petals and a heron cross the picture.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const CX = 0.6;
  const RETINT_SECONDS = 60;
  const PETALS = 46;
  const BLOSSOM = ['#e6c6c4', '#dcb0b2', '#efd9d2', '#d49ea0'];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Shade a colour by the light of the hour: ambient tint, then darkness.
  function lit(base, sky, tint, dark) {
    const warm = mixColor(rgb(base), sky.amb, tint);
    return hex(mixColor(warm, rgb('#141a2c'), sky.night * dark));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // First light: a warm glow low in the east that fades by mid morning.
    const h = sky.hour;
    const dawn = Math.max(0, 1 - Math.abs(h - 6.4) / 2.2);
    const dusk = Math.max(0, 1 - Math.abs(h - 17.8) / 2);
    const glow = Math.max(dawn, dusk * 0.7);
    if (glow > 0.02) {
      const gx = dawn >= dusk ? g.W * 0.2 : g.W * 0.85;
      const rg = ctx.createRadialGradient(gx, g.H * 0.66, 0, gx, g.H * 0.66, g.W * 0.5);
      rg.addColorStop(0, 'rgba(240,196,130,' + (0.55 * glow).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(240,196,130,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, g.W, g.H);
    }
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.016, y * 0.08, 4, 41), fbm((x - w) * 0.016, y * 0.08, 4, 41), x / w);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.02, y * 0.12, 3, 77), fbm((x - w) * 0.02, y * 0.12, 3, 77), x / w);
        const i = (y * c.width + x) * 4;
        img.data[i] = 240;
        img.data[i + 1] = 238;
        img.data[i + 2] = 232;
        img.data[i + 3] = smoothstep(0.38, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- shapes ------------------------------------------------------------

  function quad(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // A hipped tile roof with swept sides and upturned eave tips.
  function roof(ctx, g, sky, cx, top, bot, hwRidge, hwEave) {
    const u = g.U;
    const tile = lit('#3d4558', sky, 0.22, 0.6);
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(cx - hwEave - u * 0.7, bot - u * 1.0);
    ctx.lineTo(cx - hwEave + u * 1.6, bot);
    ctx.lineTo(cx + hwEave - u * 1.6, bot);
    ctx.lineTo(cx + hwEave + u * 0.7, bot - u * 1.0);
    ctx.quadraticCurveTo(cx + hwRidge + (hwEave - hwRidge) * 0.3, bot - (bot - top) * 0.3, cx + hwRidge, top);
    ctx.lineTo(cx - hwRidge, top);
    ctx.quadraticCurveTo(cx - hwRidge - (hwEave - hwRidge) * 0.3, bot - (bot - top) * 0.3, cx - hwEave - u * 0.7, bot - u * 1.0);
    ctx.fill();
    // Tile rows.
    ctx.fillStyle = lit('#232a3a', sky, 0.1, 0.5);
    ctx.globalAlpha = 0.45;
    for (let r = 1; r < 3; r++) {
      const y = top + ((bot - top) * r) / 3;
      const hw = lerp(hwRidge, hwEave, r / 3);
      ctx.fillRect(cx - hw, y, hw * 2, Math.max(1, u * 0.18));
    }
    ctx.globalAlpha = 1;
    // White plaster at the eave and the ridge.
    ctx.fillStyle = lit('#eeeae0', sky, 0.3, 0.55);
    ctx.fillRect(cx - hwEave + u * 1.4, bot - u * 0.55, (hwEave - u * 1.4) * 2, u * 0.55);
    ctx.fillRect(cx - hwRidge, top - u * 0.4, hwRidge * 2, u * 0.45);
  }

  function windows(ctx, g, sky, cx, top, h, hw, count) {
    const u = g.U;
    const glow = sky.night > 0.35;
    ctx.fillStyle = glow ? '#c9a45c' : lit('#2b3040', sky, 0.15, 0.4);
    const span = (hw * 2) / (count + 1);
    for (let i = 1; i <= count; i++) {
      ctx.fillRect(cx - hw + span * i - u * 0.7, top + h * 0.28, u * 1.4, h * 0.42);
    }
  }

  function wall(ctx, g, sky, cx, top, bot, hw, count) {
    const body = lit('#ece8dc', sky, 0.3, 0.62);
    ctx.fillStyle = body;
    ctx.fillRect(cx - hw, top, hw * 2, bot - top);
    // Shaded eastern end and a plaster seam under the eaves.
    ctx.fillStyle = lit('#c9c8c0', sky, 0.25, 0.6);
    ctx.fillRect(cx + hw * 0.7, top, hw * 0.3, bot - top);
    ctx.fillStyle = lit('#aeb0b4', sky, 0.2, 0.55);
    ctx.fillRect(cx - hw, top, hw * 2, Math.max(1, g.U * 0.4));
    windows(ctx, g, sky, cx, top, bot - top, hw * 0.92, count);
  }

  // A curved karahafu gable laid over a roof, white with a tiled cap.
  function gable(ctx, g, sky, cx, base, hw, h) {
    const u = g.U;
    ctx.fillStyle = lit('#f0ece2', sky, 0.3, 0.6);
    ctx.beginPath();
    ctx.moveTo(cx - hw, base);
    ctx.lineTo(cx - hw, base - h * 0.45);
    ctx.quadraticCurveTo(cx - hw * 0.6, base - h * 0.55, cx - hw * 0.25, base - h * 0.8);
    ctx.quadraticCurveTo(cx - hw * 0.1, base - h * 0.98, cx, base - h);
    ctx.quadraticCurveTo(cx + hw * 0.1, base - h * 0.98, cx + hw * 0.25, base - h * 0.8);
    ctx.quadraticCurveTo(cx + hw * 0.6, base - h * 0.55, cx + hw, base - h * 0.45);
    ctx.lineTo(cx + hw, base);
    ctx.fill();
    ctx.strokeStyle = lit('#3d4558', sky, 0.22, 0.6);
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.beginPath();
    ctx.moveTo(cx - hw - u * 0.3, base - h * 0.4);
    ctx.quadraticCurveTo(cx - hw * 0.6, base - h * 0.52, cx - hw * 0.25, base - h * 0.8);
    ctx.quadraticCurveTo(cx - hw * 0.1, base - h * 1.0, cx, base - h - u * 0.3);
    ctx.quadraticCurveTo(cx + hw * 0.1, base - h * 1.0, cx + hw * 0.25, base - h * 0.8);
    ctx.quadraticCurveTo(cx + hw * 0.6, base - h * 0.52, cx + hw + u * 0.3, base - h * 0.4);
    ctx.stroke();
    ctx.fillStyle = lit('#2b3040', sky, 0.15, 0.4);
    ctx.fillRect(cx - u * 0.5, base - h * 0.42, u, h * 0.3);
  }

  // Fish-shaped ridge ornaments at both ends of the top roof.
  function shachi(ctx, g, sky, x, y, dir) {
    const u = g.U;
    ctx.fillStyle = lit('#2b3040', sky, 0.15, 0.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * u * 1.2, y);
    ctx.quadraticCurveTo(x + dir * u * 1.6, y - u * 1.8, x + dir * u * 0.4, y - u * 2.8);
    ctx.lineTo(x, y - u * 1.6);
    ctx.fill();
  }

  // ---- castle ------------------------------------------------------------

  function paintKeep(ctx, g, sky) {
    const u = g.U;
    const cx = g.W * CX;
    // Great keep, from the lowest tier up.
    wall(ctx, g, sky, cx, 54 * u, 63 * u, 19 * u, 5);
    roof(ctx, g, sky, cx, 48.5 * u, 54.5 * u, 14 * u, 24 * u);
    gable(ctx, g, sky, cx, 49 * u, 6.5 * u, 6.5 * u);
    gable(ctx, g, sky, cx - 14 * u, 50 * u, 3.4 * u, 4.2 * u);
    gable(ctx, g, sky, cx + 14 * u, 50 * u, 3.4 * u, 4.2 * u);

    wall(ctx, g, sky, cx, 43 * u, 49 * u, 15.5 * u, 4);
    roof(ctx, g, sky, cx, 38 * u, 43.5 * u, 11 * u, 19.5 * u);
    gable(ctx, g, sky, cx, 39 * u, 5 * u, 5.4 * u);

    wall(ctx, g, sky, cx, 33 * u, 38.5 * u, 12.5 * u, 3);
    roof(ctx, g, sky, cx, 29 * u, 33.5 * u, 8.5 * u, 16 * u);
    gable(ctx, g, sky, cx, 30 * u, 4 * u, 4.4 * u);

    wall(ctx, g, sky, cx, 23.5 * u, 29.5 * u, 9.5 * u, 3);
    roof(ctx, g, sky, cx, 15 * u, 24 * u, 6 * u, 15 * u);
    gable(ctx, g, sky, cx, 18.5 * u, 4.6 * u, 5 * u);
    shachi(ctx, g, sky, cx - 6 * u, 15 * u, -1);
    shachi(ctx, g, sky, cx + 6 * u, 15 * u, 1);
  }

  function paintSideKeeps(ctx, g, sky) {
    const u = g.U;
    const cx = g.W * CX;
    // West keep, two tiers.
    wall(ctx, g, sky, cx - 33 * u, 56 * u, 63 * u, 8 * u, 2);
    roof(ctx, g, sky, cx - 33 * u, 52 * u, 56.5 * u, 6 * u, 11 * u);
    wall(ctx, g, sky, cx - 33 * u, 49 * u, 52.5 * u, 5.5 * u, 1);
    roof(ctx, g, sky, cx - 33 * u, 43.5 * u, 49.5 * u, 3 * u, 8.5 * u);
    gable(ctx, g, sky, cx - 33 * u, 44.5 * u, 3 * u, 3.2 * u);
    // East keep, a little lower.
    wall(ctx, g, sky, cx + 34 * u, 57 * u, 63 * u, 7 * u, 2);
    roof(ctx, g, sky, cx + 34 * u, 52.5 * u, 57.5 * u, 5 * u, 10 * u);
    gable(ctx, g, sky, cx + 34 * u, 53.5 * u, 3 * u, 3.4 * u);
    // Corridors between keeps, white wall under a low tile roof.
    for (const span of [[-26, -14], [18, 28]]) {
      const mx = cx + ((span[0] + span[1]) / 2) * u;
      const hw = ((span[1] - span[0]) / 2) * u;
      wall(ctx, g, sky, mx, 59 * u, 63 * u, hw, 3);
      roof(ctx, g, sky, mx, 55.5 * u, 59.5 * u, hw - u, hw + u * 0.8);
    }
  }

  // Stone base: fan-curved ishigaki with joints, then the lower plaster wall.
  function paintStone(ctx, g, sky, rand) {
    const u = g.U;
    const cx = g.W * CX;
    const stone = lit('#a29e8e', sky, 0.25, 0.65);
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(cx - 31 * u, 63 * u);
    ctx.lineTo(cx + 40 * u, 63 * u);
    ctx.quadraticCurveTo(cx + 41 * u, 71 * u, cx + 46 * u, 77 * u);
    ctx.lineTo(cx - 46 * u, 77 * u);
    ctx.quadraticCurveTo(cx - 36 * u, 71 * u, cx - 31 * u, 63 * u);
    ctx.fill();
    ctx.fillStyle = lit('#5d5b54', sky, 0.2, 0.6);
    ctx.globalAlpha = 0.55;
    for (let row = 0; row < 8; row++) {
      const y = 63 * u + row * 1.8 * u;
      ctx.fillRect(cx - 46 * u, y, 92 * u, Math.max(1, u * 0.18));
      for (let x = cx - 46 * u + rand() * u * 2; x < cx + 46 * u; x += u * (2.2 + rand() * 2.2)) {
        ctx.fillRect(x, y, Math.max(1, u * 0.18), 1.8 * u);
      }
    }
    ctx.globalAlpha = 1;
    // Lower plaster wall with gun slits and a tile cap.
    const top = 77 * u;
    ctx.fillStyle = lit('#e8e4d8', sky, 0.28, 0.62);
    ctx.fillRect(cx - 52 * u, top, 104 * u, 5.5 * u);
    ctx.fillStyle = lit('#2b3040', sky, 0.15, 0.4);
    for (let x = cx - 50 * u; x < cx + 50 * u; x += u * 4.5) {
      ctx.fillRect(x, top + 2.2 * u, u * 0.9, u * 0.9);
      ctx.fillRect(x + 2.2 * u, top + 2.2 * u, u * 0.9, u * 0.9);
    }
    ctx.fillStyle = lit('#3d4558', sky, 0.22, 0.6);
    ctx.fillRect(cx - 53 * u, top - u * 1.4, 106 * u, u * 1.5);
    ctx.fillStyle = lit('#a29e8e', sky, 0.25, 0.65);
    ctx.fillRect(cx - 52 * u, top + 5.5 * u, 104 * u, 3 * u);
  }

  // ---- landscape ---------------------------------------------------------

  function paintFarHills(ctx, g, sky) {
    const u = g.U;
    ctx.fillStyle = lit('#7d8aa0', sky, 0.15, 0.7);
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) {
      const y = 58 * u - Math.sin(x / g.W * 5.2 + 1) * 6 * u - fbm(x * 0.03, 1, 3, 12) * 8 * u;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = lit('#5e7488', sky, 0.15, 0.7);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) {
      const y = 68 * u - Math.sin(x / g.W * 3.4 + 4) * 5 * u - fbm(x * 0.04, 6, 3, 31) * 6 * u;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  // The castle hill, moss green with pine clumps along the slope.
  function paintHill(ctx, g, sky, rand) {
    const u = g.U;
    const cx = g.W * CX;
    const moss = lit('#56664a', sky, 0.2, 0.75);
    ctx.fillStyle = moss;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) {
      const d = Math.abs(x - cx) / g.W;
      const y = 83 * u - Math.max(0, 1 - d * 2.2) * 8 * u + (fbm(x * 0.05, 3, 3, 5) - 0.5) * 2 * u;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    const pine = lit('#2f4235', sky, 0.15, 0.7);
    for (let i = 0; i < 70; i++) {
      const x = rand() * g.W;
      const y = (80 + rand() * 18) * u;
      ctx.fillStyle = rand() < 0.65 ? pine : lit('#6b7a52', sky, 0.2, 0.75);
      ctx.beginPath();
      ctx.arc(x, y, u * (1 + rand() * 2.2), 0, 6.3);
      ctx.fill();
    }
    // Stone path up to the gate.
    ctx.fillStyle = lit('#a9a596', sky, 0.25, 0.65);
    for (let k = 0; k < 14; k++) {
      const t = k / 13;
      ctx.fillRect(cx - (2 + t * 6) * u, (86 + t * 14) * u, (4 + t * 12) * u, u * 0.7);
    }
  }

  function blossomClump(ctx, g, rand, x, y, r, count) {
    for (let i = 0; i < count; i++) {
      const a = rand() * 6.3;
      const d = Math.sqrt(rand()) * r;
      ctx.fillStyle = BLOSSOM[Math.floor(rand() * BLOSSOM.length)];
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d * 0.85, g.U * (0.9 + rand() * 1.6), 0, 6.3);
      ctx.fill();
    }
  }

  function limb(ctx, g, sky, x0, y0, x1, y1, x2, y2, w) {
    ctx.strokeStyle = lit('#2e2a2a', sky, 0.1, 0.5);
    ctx.lineWidth = Math.max(1, w);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x1, y1, x2, y2);
    ctx.stroke();
  }

  function paintTrees(ctx, g, sky, rand) {
    const u = g.U;
    // Big tree at the left edge, reaching over the slope.
    limb(ctx, g, sky, g.W * 0.03, g.H, g.W * 0.07, 62 * u, g.W * 0.1, 40 * u, u * 5);
    limb(ctx, g, sky, g.W * 0.08, 60 * u, g.W * 0.16, 44 * u, g.W * 0.24, 36 * u, u * 2.4);
    limb(ctx, g, sky, g.W * 0.09, 52 * u, g.W * 0.04, 34 * u, g.W * 0.02, 20 * u, u * 2);
    const left = [[0.04, 20, 11, 90], [0.11, 26, 12, 100], [0.2, 33, 10, 90], [0.26, 38, 7, 60], [0.1, 40, 10, 80], [0.02, 40, 7, 50], [0.16, 16, 9, 70]];
    for (const c of left) blossomClump(ctx, g, rand, g.W * c[0], c[1] * u, c[2] * u, c[3]);
    // Smaller tree at the right edge.
    limb(ctx, g, sky, g.W * 0.97, g.H, g.W * 0.94, 70 * u, g.W * 0.92, 52 * u, u * 3.4);
    limb(ctx, g, sky, g.W * 0.935, 62 * u, g.W * 0.89, 52 * u, g.W * 0.86, 48 * u, u * 1.6);
    const right = [[0.93, 46, 9, 70], [0.88, 50, 7, 50], [0.98, 52, 8, 60], [0.96, 38, 7, 50]];
    for (const c of right) blossomClump(ctx, g, rand, g.W * c[0], c[1] * u, c[2] * u, c[3]);
    // Trees among the walls, in bloom.
    const cx = g.W * CX;
    for (const dx of [-48, -41, -22, 8, 22, 44, 50]) {
      const x = cx + dx * u;
      ctx.fillStyle = lit('#3a302c', sky, 0.1, 0.5);
      ctx.fillRect(x - u * 0.4, 79 * u, u * 0.8, 5 * u);
      blossomClump(ctx, g, rand, x, 77 * u, 3.6 * u, 22);
    }
    // Pines flank the keep.
    ctx.fillStyle = lit('#2f4235', sky, 0.15, 0.7);
    for (const dx of [-39, 38, 47]) {
      const x = cx + dx * u;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(x + (k - 1) * u * 1.2, (68 - k * 2.2) * u, u * (3.2 - k * 0.5), u * 1.2, 0, 0, 6.3);
        ctx.fill();
      }
    }
    // Fallen petals on the grass.
    ctx.fillStyle = BLOSSOM[0];
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < g.W * 0.4; i++) ctx.fillRect(rand() * g.W, (86 + rand() * 14) * u, 1, 1);
    ctx.globalAlpha = 1;
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarHills(ctx, g, sky);
    paintSideKeeps(ctx, g, sky);
    paintKeep(ctx, g, sky);
    paintStone(ctx, g, sky, rand);
    paintHill(ctx, g, sky, rand);
    paintTrees(ctx, g, sky, rand);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(88);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.globalAlpha = Math.min(1, amount * (0.75 - state.night * 0.35));
    ctx.drawImage(c, off, g.H * 0.6);
    ctx.drawImage(c, off + c.width, g.H * 0.6);
    ctx.globalAlpha = 1;
  }

  function drawPetals(ctx, g, t, amount) {
    const n = Math.floor(PETALS * Math.min(1, amount));
    const p = state.petals;
    ctx.fillStyle = BLOSSOM[2];
    for (let i = 0; i < n; i++) {
      const a = (t * p.speed[i] + p.phase[i]) % 1;
      const px = (p.x[i] + a * 0.16 + Math.sin(t * 0.9 + i * 2.1) * 0.012) % 1;
      const py = a * 1.05 * g.H;
      const s = p.size[i] * g.U;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(px * g.W, py, s, s * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  // A heron crosses the sky now and then, wings beating slowly.
  function drawHeron(ctx, g, t) {
    const cycle = 50;
    const p = (t % cycle) / 26;
    if (p >= 1) return;
    const x = lerp(-g.W * 0.05, g.W * 1.05, p);
    const y = g.H * (0.2 + 0.03 * Math.sin(p * 6.3));
    const flap = Math.sin(t * 3) * g.U * 1.3;
    ctx.strokeStyle = state.night > 0.5 ? '#9ea3b8' : '#f2efe6';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - g.U * 3, y - flap);
    ctx.quadraticCurveTo(x - g.U * 1.2, y - flap * 0.4, x, y);
    ctx.quadraticCurveTo(x + g.U * 1.2, y - flap * 0.4, x + g.U * 3, y - flap);
    ctx.stroke();
    ctx.fillRect(x - g.U * 2.4, y, g.U * 1.6, Math.max(1, g.U * 0.3));
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    const rand = K.rng(5);
    state.petals = { x: [], phase: [], speed: [], size: [] };
    for (let i = 0; i < PETALS; i++) {
      state.petals.x.push(rand() * 0.8);
      state.petals.phase.push(rand());
      state.petals.speed.push(0.018 + rand() * 0.02);
      state.petals.size.push(0.55 + rand() * 0.6);
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    drawHeron(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawMist(ctx, g, t, props.mist);
    drawPetals(ctx, g, t, props.petals);
  }

  Kasuri.run({
    defaults: { time: 'auto', petals: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
