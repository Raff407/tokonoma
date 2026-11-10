/*
 * 秋吉台 Akiyoshidai — a karst plateau at autumn dusk: tawny rolling grass with grey
 * limestone pinnacles breaking through it, and silver susuki in front.
 *
 * Everything still is baked once: the sky is a row-blended gradient, the plateau is a
 * voxel-style height field shaded by slope, the pinnacles are angular fluted polygons
 * clipped behind nearer swells. Per frame: clouds drift, two wind strips and a cloud
 * shadow strip slide over the grass, and the susuki layer sways in a few slices.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.38;
  const SUN_X = 0.7;
  const SKY = ['#3a4a66', '#5d6a82', '#9a98a0', '#d0b48a', '#e8c88e'];
  const SKY_STOPS = [0, 0.3, 0.58, 0.85, 1];
  const GRASS = ['#3f4a2c', '#5e6234', '#867a42', '#ab9150', '#cdb06a'];
  const HAZE = '#b6a68c';
  const ROCK = { lit: '#e6dcc4', mid: '#b2aea2', shade: '#7c7c76', deep: '#4c4f50' };
  const STEPS = 360;
  const F_MAX = 1.3;
  const SLICES = 14;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function rampColor(inks, t) {
    const f = clamp01(t) * (inks.length - 1);
    const k = Math.min(inks.length - 2, Math.floor(f));
    return K.mixColor(inks[k], inks[k + 1], f - k);
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, U: H / 100, hy: Math.round(H * HORIZON) };
  }

  // ---- terrain model -------------------------------------------------------

  function groundY(g, f) {
    return g.hy + (g.H - g.hy) * (f * f * 0.85 + f * 0.15);
  }

  function scaleAt(f) {
    return f * f * 0.85 + f * 0.15 + 0.03;
  }

  // Hill height (screen rows) of the plateau at column x and depth f.
  function hill(g, x, f) {
    const s = scaleAt(f);
    const wx = (x - g.W * 0.5) / (s * g.U * 95);
    const wz = 2.2 / (s + 0.08);
    const n = fbm(wx + 11, wz, 3, 31) - 0.5;
    return n * s * g.H * 0.5;
  }

  function terrainY(g, x, f) {
    return groundY(g, f) - hill(g, x, f);
  }

  // ---- sky -----------------------------------------------------------------

  function paintSky(ctx, g) {
    const inks = SKY.map(K.parseColor);
    for (let y = 0; y < g.hy + 2; y++) {
      const t = Math.min(1, y / g.hy);
      let k = 0;
      while (k < SKY_STOPS.length - 2 && t > SKY_STOPS[k + 1]) k++;
      const u = (t - SKY_STOPS[k]) / (SKY_STOPS[k + 1] - SKY_STOPS[k]);
      ctx.fillStyle = K.toHex(K.mixColor(inks[k], inks[k + 1], u));
      ctx.fillRect(0, y, g.W, 1);
    }
    const sx = g.W * SUN_X;
    const sy = g.hy * 0.66;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, g.U * 22);
    glow.addColorStop(0, 'rgba(236,196,128,0.55)');
    glow.addColorStop(1, 'rgba(236,196,128,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.hy + 2);
    ctx.fillStyle = '#c9553a';
    blob(ctx, sx, sy, g.U * 3.6, g.U * 3.6);
    ctx.fillStyle = '#d8704a';
    blob(ctx, sx - g.U * 0.8, sy - g.U * 0.8, g.U * 2.2, g.U * 2.2);
  }

  function paintRidges(ctx, g) {
    const bands = [
      { col: '#6c7488', top: 0.06, amp: 0.045, sc: 26, seed: 7 },
      { col: '#55606c', top: 0.025, amp: 0.035, sc: 18, seed: 9 },
    ];
    for (const b of bands) {
      ctx.fillStyle = b.col;
      ctx.beginPath();
      ctx.moveTo(0, g.hy + 2);
      for (let x = 0; x <= g.W + 2; x += 2) {
        const bump = Math.exp(-(((x - g.W * 0.22) / (g.W * 0.14)) ** 2)) * g.H * 0.02;
        ctx.lineTo(x, g.hy - g.H * b.top - bump - fbm(x / (g.U * b.sc), 2.2, 3, b.seed) * g.H * b.amp);
      }
      ctx.lineTo(g.W, g.hy + 2);
      ctx.fill();
    }
  }

  // ---- plateau: front-to-back height field -----------------------------------

  function grassTone(g, x, f, light, inks, haze) {
    const s = scaleAt(f);
    const grain = fbm(x / (g.U * (3 + s * 8)), f * 60, 2, 5) - 0.5;
    const patch = fbm(x / (g.U * 30), f * 7, 2, 13) - 0.5;
    const rgb = rampColor(inks, light + grain * 0.22 + patch * 0.35);
    return K.mixColor(rgb, haze, Math.pow(1 - clamp01(s * 1.4), 3) * 0.85);
  }

  function paintPlateau(ctx, g) {
    const img = ctx.getImageData(0, 0, g.W, g.H);
    const d = img.data;
    const inks = GRASS.map(K.parseColor);
    const haze = K.parseColor(HAZE);
    const ybuf = new Float32Array(g.W).fill(g.H);
    let nearer = null;
    for (let i = 0; i <= STEPS; i++) {
      const f = F_MAX * (1 - i / STEPS);
      const row = new Float32Array(g.W);
      const flat = Math.max(0.01, groundY(g, f + F_MAX / STEPS) - groundY(g, f));
      for (let x = 0; x < g.W; x++) row[x] = terrainY(g, x, f);
      for (let x = 0; x < g.W; x++) {
        const sy = Math.max(g.hy, row[x]);
        if (sy >= ybuf[x]) continue;
        const s = scaleAt(f);
        const across = (row[Math.min(g.W - 1, x + 1)] - row[Math.max(0, x - 1)]) / (s * g.H * 0.012);
        const ratio = nearer ? (nearer[x] - row[x]) / flat : 1;
        const light = 0.56 - (ratio - 1) * 0.22 + across * 0.12;
        const rgb = grassTone(g, x, f, light, inks, haze);
        const r = rgb[0], gg = rgb[1], b = rgb[2];
        const y0 = Math.floor(sy);
        const y1 = Math.min(g.H, Math.ceil(ybuf[x]));
        for (let y = y0; y < y1; y++) {
          const k = (y * g.W + x) * 4;
          d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
        }
        ybuf[x] = sy;
      }
      nearer = row;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- limestone pinnacles ---------------------------------------------------

  function occluderY(g, x, f) {
    let top = g.H;
    for (let k = 1; k <= 60; k++) {
      const fn = f + (F_MAX - f) * (k / 60);
      top = Math.min(top, terrainY(g, x, fn));
    }
    return top;
  }

  function tooth(ctx, cx, by, w, h, rand) {
    const xl = cx - w / 2;
    const xr = cx + w / 2;
    const peakX = cx + (rand() - 0.5) * w * 0.4;
    const topY = by - h;
    const path = new Path2D();
    path.moveTo(xl, by);
    path.lineTo(xl + w * 0.06, by - h * (0.35 + rand() * 0.2));
    path.lineTo(xl + w * 0.18, by - h * (0.72 + rand() * 0.15));
    path.lineTo(peakX - w * 0.12, topY + h * 0.06);
    path.lineTo(peakX, topY);
    path.lineTo(peakX + w * 0.16, topY + h * (0.08 + rand() * 0.1));
    path.lineTo(xr - w * 0.12, by - h * (0.55 + rand() * 0.2));
    path.lineTo(xr, by - h * (0.25 + rand() * 0.15));
    path.lineTo(xr + w * 0.04, by);
    path.closePath();
    ctx.fillStyle = ROCK.shade;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    // sun on the right: right face lit, left face in shade
    ctx.fillStyle = ROCK.mid;
    ctx.fillRect(peakX - w * 0.05, topY, xr - peakX + w * 0.2, h);
    ctx.fillStyle = ROCK.lit;
    ctx.fillRect(peakX - w * 0.2, topY - 1, w * 0.45, h * 0.12 + 1);
    ctx.fillRect(peakX + w * 0.05, topY, w * 0.14, h * 0.6);
    // vertical fluting
    if (w > 2.5) {
      ctx.fillStyle = ROCK.deep;
      const n = Math.max(2, Math.round(w / 2.2));
      for (let j = 1; j < n; j++) {
        const fx = xl + (w * j) / n + (rand() - 0.5) * w * 0.08;
        const len = h * (0.45 + rand() * 0.45);
        ctx.fillRect(fx, by - len, Math.max(0.6, w * 0.05), len);
      }
    }
    ctx.fillStyle = ROCK.deep;
    ctx.fillRect(xl - 1, by - h * 0.12, w + 2, h * 0.12 + 1);
    ctx.restore();
  }

  function pinnacleGroup(ctx, g, x, f, rand) {
    const s = scaleAt(f);
    const by = terrainY(g, x, f) + g.U * 0.25 * s;
    const occ = occluderY(g, x, f);
    const size = g.U * (1.6 + s * 8) * (0.7 + rand() * 0.6);
    if (occ < by - size * 1.2) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, g.W, occ);
    ctx.clip();
    const teeth = 1 + Math.floor(rand() * 3);
    for (let j = 0; j < teeth; j++) {
      const w = size * (0.45 + rand() * 0.35);
      const h = size * (0.8 + rand() * 0.9);
      const cx = x + (j - (teeth - 1) / 2) * size * 0.55 + (rand() - 0.5) * size * 0.2;
      tooth(ctx, cx, by + rand() * size * 0.12, w, h, rand);
    }
    // grass closing over the base
    ctx.strokeStyle = '#4c522e';
    ctx.lineWidth = Math.max(0.7, size * 0.07);
    ctx.beginPath();
    const blades = Math.max(3, Math.round(size * 1.2));
    for (let k = 0; k < blades; k++) {
      const bx = x + (rand() - 0.5) * size * 1.8;
      const bl = size * (0.15 + rand() * 0.2);
      ctx.moveTo(bx, by + size * 0.05);
      ctx.lineTo(bx + (rand() - 0.3) * bl * 0.6, by - bl);
    }
    ctx.stroke();
    ctx.restore();
  }

  function paintRocks(ctx, g, rand) {
    const list = [];
    for (let i = 0; i < 300 && list.length < 60; i++) {
      const f = 0.08 + Math.pow(rand(), 1.15) * 0.82;
      const x = rand() * g.W;
      const cluster = fbm(x / (g.U * 22), f * 6, 2, 77);
      if (cluster < 0.5) continue;
      list.push({ f, x });
    }
    list.sort((a, b) => a.f - b.f);
    for (const r of list) pinnacleGroup(ctx, g, r.x, r.f, rand);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    paintSky(ctx, g);
    paintRidges(ctx, g);
    paintPlateau(ctx, g);
    paintRocks(ctx, g, rand);
    return c;
  }

  // ---- clouds, wind, shade ---------------------------------------------------

  function paintClouds(g, rand) {
    const c = layer(g.W, g.hy);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const x = rand() * g.W;
      const y = g.hy * (0.15 + rand() * 0.5);
      const w = g.U * (12 + rand() * 16);
      const lit = y > g.hy * 0.4;
      for (const dx of [0, -g.W, g.W]) {
        ctx.fillStyle = 'rgba(70,74,96,0.28)';
        blob(ctx, x + dx, y + g.U * 0.7, w, g.U * 1.2);
        ctx.fillStyle = lit ? 'rgba(236,206,160,0.5)' : 'rgba(176,170,182,0.45)';
        blob(ctx, x + dx, y, w * 0.9, g.U * 1.1);
        blob(ctx, x + dx - w * 0.25, y - g.U * 0.7, w * 0.45, g.U * 0.9);
      }
    }
    return c;
  }

  function paintWind(g, seed, tone, count, period) {
    const h = g.H - g.hy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const r = K.rng(seed);
    ctx.lineCap = 'round';
    ctx.strokeStyle = tone;
    for (let i = 0; i < count; i++) {
      const f = 0.08 + r() * 0.92;
      const x = r() * g.W;
      const y = terrainY(g, x, f) - g.hy;
      const a = Math.pow(0.5 + 0.5 * Math.sin(TAU * (x / period) + f * 5), 2.4);
      if (a < 0.1 || y < 0) continue;
      const len = g.U * (1.2 + scaleAt(f) * 6) * (0.7 + r() * 0.8);
      ctx.globalAlpha = Math.min(0.6, a * 0.6);
      ctx.lineWidth = Math.max(1, g.U * (0.15 + scaleAt(f) * 0.4));
      for (const dx of [0, -g.W, g.W]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y);
        ctx.lineTo(x + dx + len, y - len * 0.12);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintShade(g, rand) {
    const h = g.H - g.hy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 3; i++) {
      const x = (i + 0.3 + rand() * 0.4) * g.W / 3;
      const f = 0.2 + rand() * 0.6;
      const y = groundY(g, f) - g.hy;
      const rx = g.U * (18 + f * 30);
      const ry = g.U * (3 + f * 10);
      for (const dx of [0, -g.W, g.W]) {
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = 'rgba(30,38,52,0.09)';
          blob(ctx, x + dx + rx * 0.08 * k, y, rx * (1 - k * 0.2), ry * (1 - k * 0.2));
        }
      }
    }
    return c;
  }

  // ---- susuki in front -------------------------------------------------------

  function plume(ctx, g, x, y, lean, size) {
    ctx.strokeStyle = '#d6caa8';
    ctx.lineWidth = Math.max(1, g.U * 0.22);
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      const sx = x + lean * 0.05 * t;
      const sy = y + size * t * 0.9;
      const len = size * (0.55 - t * 0.25);
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + lean * 0.4 + len * 0.3, sy + len * 0.2, sx + lean * 0.5 + len * 0.6, sy + len * 0.75);
    }
    ctx.stroke();
    ctx.strokeStyle = '#b89a5c';
    ctx.lineWidth = Math.max(1, g.U * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean * 0.05, y + size);
    ctx.stroke();
  }

  function paintSusuki(g, rand) {
    const c = layer(g.W, g.H * 0.36);
    const ctx = c.getContext('2d');
    const h = c.height;
    ctx.lineCap = 'round';
    const spacing = g.U * 12;
    const n = Math.ceil(g.W / spacing);
    for (let i = 0; i < n; i++) {
      if (rand() < 0.25) continue;
      const bx = (i + rand()) * spacing;
      const stems = 3 + Math.floor(rand() * 4);
      // arching blades
      ctx.strokeStyle = '#424a2a';
      ctx.lineWidth = Math.max(1, g.U * 0.3);
      for (let k = 0; k < stems + 2; k++) {
        const dir = rand() < 0.5 ? -1 : 1;
        const len = h * (0.3 + rand() * 0.3);
        ctx.beginPath();
        ctx.moveTo(bx, h + 1);
        ctx.quadraticCurveTo(bx + dir * len * 0.2, h - len, bx + dir * len * 0.6, h - len * (0.55 + rand() * 0.2));
        ctx.stroke();
      }
      for (let k = 0; k < stems; k++) {
        const top = h * (0.18 + rand() * 0.4);
        const lean = g.U * (1 + rand() * 3);
        const tx = bx + (k - stems / 2) * g.U * 1.2 + lean;
        ctx.strokeStyle = '#6a6238';
        ctx.lineWidth = Math.max(1, g.U * 0.2);
        ctx.beginPath();
        ctx.moveTo(bx + (rand() - 0.5) * g.U, h + 1);
        ctx.quadraticCurveTo(bx + (tx - bx) * 0.3, h * 0.6, tx, top);
        ctx.stroke();
        plume(ctx, g, tx, top, lean, g.U * (2.6 + rand() * 2));
      }
    }
    return c;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.clouds = paintClouds(g, rand);
    state.windA = paintWind(g, 3, '#d8c890', 380, g.W / 2);
    state.windB = paintWind(g, 8, '#ece0b4', 220, g.W / 3);
    state.shade = paintShade(g, rand);
    state.susuki = paintSusuki(g, rand);
  }

  function wrapDraw(ctx, img, off, y) {
    const w = img.width;
    const x = ((off % w) + w) % w;
    ctx.drawImage(img, x, y);
    ctx.drawImage(img, x - w, y);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind, shade } = api.props;
    ctx.drawImage(state.back, 0, 0);
    wrapDraw(ctx, state.clouds, t * g.U * 0.5, 0);
    ctx.globalAlpha = Math.min(1, 0.5 * wind);
    wrapDraw(ctx, state.windA, t * g.U * 3.2, g.hy);
    ctx.globalAlpha = Math.min(1, 0.4 * wind);
    wrapDraw(ctx, state.windB, t * g.U * 4.6, g.hy);
    ctx.globalAlpha = Math.min(1, shade);
    wrapDraw(ctx, state.shade, t * g.U * 1.6, g.hy);
    ctx.globalAlpha = 1;
    const sh = state.susuki;
    const sy = g.H - sh.height;
    const sliceH = sh.height / SLICES;
    for (let i = 0; i < SLICES; i++) {
      const top = 1 - i / SLICES;
      const sway = Math.sin(t * 1.3 + i * 0.2) * g.U * 0.9 * top * top * (0.3 + wind * 0.7)
        + Math.sin(t * 0.5) * g.U * 0.6 * top * wind;
      ctx.drawImage(sh, 0, i * sliceH, sh.width, sliceH + 1, sway, sy + i * sliceH, sh.width, sliceH + 1);
    }
  }

  Kasuri.run({
    defaults: { wind: 1, shade: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
