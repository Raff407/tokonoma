/*
 * 大阪城 Osaka — the castle keep at night above its stone-walled moat.
 *
 * Sky, hills, keep, stone wall and cherry trees are baked once. The moat is the baked
 * world flipped and laid back in thin rows that slide sideways. Clouds are one tiling
 * strip; petals are a short reused pool that fall, then float on the water.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.68;
  const SKY = ['#10162b', '#18203c', '#232c4c', '#34395a', '#4a4a68'];
  const COPPER = { lit: '#78a58f', mid: '#5c8a76', dark: '#3d6556', edge: '#a9c6ae', ridge: '#2f4f45' };
  const PLASTER = { lit: '#eee6cf', mid: '#d6ccb2', dark: '#a79e8c' };
  const STONE = { lit: '#9a9482', mid: '#8a8671', dark: '#5f5c4d', joint: '#3c3a30' };
  const GOLD = { lit: '#e8c964', mid: '#c4a044' };
  const WINDOW = '#f0d58a';
  const BLOSSOM = ['#d9b8b0', '#e6cfc4', '#c49a98'];
  const POND = '#1c2b3a';
  const VEIL = 0.45;
  const MAX_PETALS = 44;
  const PETALS = 22;
  const STREAKS = 60;
  const GLINTS = 14;
  const FLOAT_LIFE = 30;
  const PETAL_TONES = ['#e3c7bd', '#d8aea8', '#efe0d0'];
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

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 135));
    const wy = Math.round(H * WATER);
    return { W, H, U, u, wy, cx: W * 0.5 };
  }

  // ---- sky and distant hills ----------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.wy + 1);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y <= g.wy; y++) {
      const f = Math.min(1, y / (g.wy * 0.95)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#c9c7d0';
    for (let i = 0; i < 46; i++) {
      const y = rand() * g.H * 0.38;
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(y), 1, 1);
    }
    ctx.globalAlpha = 1;
    paintMoon(ctx, g);
    paintHills(ctx, g);
    return c;
  }

  function paintMoon(ctx, g) {
    const mx = g.W * 0.2;
    const my = g.H * 0.17;
    const r = g.U * 4.2;
    ctx.fillStyle = '#8c8ca0';
    for (let i = 3; i > 0; i--) {
      ctx.globalAlpha = 0.09;
      blob(ctx, mx, my, r + i * g.U * 2.2, r + i * g.U * 2.2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f0e8d0';
    blob(ctx, mx, my, r, r);
    ctx.fillStyle = '#34395a';
    blob(ctx, mx + r * 0.5, my - r * 0.15, r * 0.88, r * 0.9);
    ctx.fillStyle = '#4a4a68';
    ctx.globalAlpha = 0.35;
    blob(ctx, mx + r * 0.5, my - r * 0.15, r * 0.88, r * 0.9);
    ctx.globalAlpha = 1;
  }

  function ridge(g, x, k) {
    return g.H * (0.5 + k * 0.04) + fbm(x / (g.U * 38), k * 3.1, 3, 5 + k) * g.H * 0.07;
  }

  function paintHills(ctx, g) {
    const tones = ['#232a46', '#1c2340'];
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = tones[k];
      ctx.beginPath();
      ctx.moveTo(0, g.wy);
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridge(g, x, k));
      ctx.lineTo(g.W, g.wy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- the keep ------------------------------------------------------------

  function paintStoneWall(ctx, g, rand) {
    const top = g.wy - g.u * 13;
    const half = Math.max(g.u * 40, g.W * 0.5 + g.u * 6);
    const slope = g.u * 3;
    ctx.fillStyle = STONE.mid;
    poly(ctx, [g.cx - half, top, g.cx + half, top, g.cx + half + slope, g.wy, g.cx - half - slope, g.wy]);
    const rows = 9;
    const rh = (g.wy - top) / rows;
    for (let r = 0; r < rows; r++) {
      const y = top + r * rh;
      const f = (r + 0.5) / rows;
      const left = g.cx - half - slope * f;
      const right = g.cx + half + slope * f;
      let x = left;
      while (x < right) {
        const w = g.u * (3.2 + rand() * 3.4);
        const tone = rand();
        ctx.fillStyle = tone < 0.3 ? STONE.dark : tone < 0.7 ? STONE.mid : STONE.lit;
        ctx.globalAlpha = 0.8 + (1 - f) * 0.2;
        ctx.fillRect(x, y, Math.min(w, right - x), rh);
        x += w;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = STONE.joint;
      ctx.fillRect(left, y, right - left, 1);
    }
    ctx.fillStyle = '#2c2b25';
    ctx.fillRect(g.cx - half - slope, g.wy - 1, half * 2 + slope * 2, 1);
    ctx.fillStyle = STONE.lit;
    ctx.fillRect(g.cx - half, top - 1, half * 2, 2);
    return top;
  }

  function roof(ctx, cx, yTop, rise, wTop, wEave, lift) {
    const yb = yTop + rise;
    ctx.fillStyle = COPPER.mid;
    poly(ctx, [cx - wTop, yTop, cx + wTop, yTop, cx + wEave, yb, cx + wEave + lift * 1.4, yb - lift, cx - wEave - lift * 1.4, yb - lift, cx - wEave, yb]);
    ctx.fillStyle = COPPER.lit;
    poly(ctx, [cx - wTop * 0.9, yTop + 1, cx - wTop * 0.1, yTop + 1, cx - wEave * 0.15, yb, cx - wEave * 0.95, yb]);
    ctx.fillStyle = COPPER.dark;
    ctx.fillRect(cx - wEave, yb - 1, wEave * 2, Math.max(1.5, lift * 0.55));
    ctx.fillStyle = COPPER.edge;
    ctx.fillRect(cx - wEave - lift * 0.8, yb - lift, wEave * 2 + lift * 1.6, 1);
    ctx.fillStyle = COPPER.ridge;
    ctx.globalAlpha = 0.55;
    const step = Math.max(2, rise / 4);
    for (let y = yTop + step; y < yb - 1; y += step) {
      const f = (y - yTop) / rise;
      const w = lerp(wTop, wEave, f);
      ctx.fillRect(cx - w, y, w * 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function gable(ctx, g, cx, yBase, w) {
    const h = w * 0.62;
    ctx.fillStyle = PLASTER.lit;
    poly(ctx, [cx - w * 0.62, yBase, cx + w * 0.62, yBase, cx, yBase - h]);
    ctx.fillStyle = COPPER.mid;
    poly(ctx, [cx - w, yBase + g.u * 0.4, cx, yBase - h - g.u * 0.9, cx + w, yBase + g.u * 0.4, cx + w * 0.78, yBase + g.u * 0.4, cx, yBase - h + g.u * 0.2, cx - w * 0.78, yBase + g.u * 0.4]);
    ctx.fillStyle = COPPER.edge;
    ctx.fillRect(cx - w, yBase + g.u * 0.2, w * 2, 1);
    ctx.fillStyle = GOLD.lit;
    blob(ctx, cx, yBase - h * 0.38, g.u * 0.9, g.u * 0.9);
  }

  function tierWalls(ctx, g, cx, y, w, h, glow, rand) {
    ctx.fillStyle = PLASTER.mid;
    ctx.fillRect(cx - w, y, w * 2, h);
    ctx.fillStyle = PLASTER.lit;
    ctx.globalAlpha = glow;
    ctx.fillRect(cx - w, y, w * 2, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PLASTER.dark;
    ctx.fillRect(cx + w * 0.7, y, w * 0.3, h);
    ctx.fillStyle = '#6a5e4a';
    ctx.fillRect(cx - w, y, w * 2, 1);
    ctx.fillRect(cx - w, y + h - 1, w * 2, 1);
    const n = Math.max(2, Math.round(w / (g.u * 3.6)));
    const win = g.u * 1.3;
    for (let i = 0; i < n; i++) {
      const wx = cx - w + ((i + 0.5) / n) * w * 2;
      ctx.fillStyle = '#4a4034';
      ctx.fillRect(wx - win * 0.7, y + h * 0.28, win * 1.4, h * 0.46);
      ctx.fillStyle = WINDOW;
      ctx.globalAlpha = 0.55 + rand() * 0.35;
      ctx.fillRect(wx - win * 0.5, y + h * 0.34, win, h * 0.34);
      ctx.globalAlpha = 1;
    }
  }

  function paintKeep(g, rand, baseY) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const u = g.u;
    const cx = g.cx;
    const tiers = [
      { w: 17, h: 6.5, rise: 5 },
      { w: 14.5, h: 5.8, rise: 4.6 },
      { w: 12, h: 5.2, rise: 4.2 },
      { w: 9.6, h: 4.8, rise: 3.8 },
    ];
    let y = baseY - u * 2;
    const lay = [];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      y -= u * t.h;
      lay.push({ y, t });
      y -= u * (t.rise - 0.4);
    }
    const topY = y;
    // lower tier gets a wide base then each storey is walled then roofed
    ctx.fillStyle = '#3a3a34';
    ctx.fillRect(cx - u * 19, baseY - u * 2, u * 38, u * 2);
    for (let i = 0; i < lay.length; i++) {
      const { y: ty, t } = lay[i];
      tierWalls(ctx, g, cx, ty, u * t.w, u * t.h, 1 - i * 0.14, rand);
      roof(ctx, cx, ty - u * (t.rise - 0.4), u * t.rise, u * (t.w - 2.4), u * (t.w + 3.2), u * 1.1);
      if (i < 3) gable(ctx, g, cx, ty - u * 0.3 + u * 0, u * (3.4 - i * 0.3));
    }
    // upper black storey with gold bands
    const uh = u * 5.4;
    const uy = topY - uh;
    ctx.fillStyle = '#23252b';
    ctx.fillRect(cx - u * 7.4, uy, u * 14.8, uh);
    ctx.fillStyle = GOLD.mid;
    ctx.fillRect(cx - u * 7.4, uy, u * 14.8, Math.max(1, u * 0.45));
    ctx.fillRect(cx - u * 7.4, uy + uh - u * 0.45, u * 14.8, Math.max(1, u * 0.45));
    ctx.fillStyle = WINDOW;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - u * 5.4 + i * u * 3.5, uy + uh * 0.35, u * 1.5, uh * 0.35);
    ctx.globalAlpha = 1;
    // topmost roof with gold ridge ornaments
    const ry = uy - u * 4.6;
    roof(ctx, cx, ry + u * 0.4, u * 4.4, u * 3.6, u * 10.6, u * 1.2);
    ctx.fillStyle = GOLD.lit;
    ctx.fillRect(cx - u * 3.7, ry, u * 7.4, Math.max(1, u * 0.6));
    for (const s of [-1, 1]) {
      const sx = cx + s * u * 3.9;
      poly(ctx, [sx, ry + u * 0.6, sx + s * u * 1.6, ry + u * 0.6, sx + s * u * 1.2, ry - u * 2.6, sx + s * u * 0.4, ry - u * 3.4, sx, ry - u * 1.6]);
      ctx.fillStyle = GOLD.mid;
      ctx.fillRect(sx + (s > 0 ? 0 : -u * 1.4), ry + u * 0.6, u * 1.4, 1);
      ctx.fillStyle = GOLD.lit;
    }
    return c;
  }

  // ---- trees on the wall ---------------------------------------------------

  function cherry(ctx, g, rand, x, base, size) {
    ctx.fillStyle = '#2f2a2c';
    ctx.fillRect(x - size * 0.06, base - size * 0.9, size * 0.12, size * 0.9);
    const spots = 11;
    for (let i = 0; i < spots; i++) {
      const a = rand() * TAU;
      const rr = rand() * size * 0.55;
      const px = x + Math.cos(a) * rr * 1.2;
      const py = base - size * 1.05 + Math.sin(a) * rr * 0.7;
      const r = size * (0.22 + rand() * 0.2);
      ctx.fillStyle = BLOSSOM[i % 3];
      ctx.globalAlpha = 0.5 + rand() * 0.3;
      blob(ctx, px, py, r, r * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function pine(ctx, g, rand, x, base, size) {
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(x - size * 0.05, base - size * 0.8, size * 0.1, size * 0.8);
    const pads = ['#1f3a33', '#2b4a3f', '#3b5d4d'];
    for (let i = 0; i < 4; i++) {
      const py = base - size * (0.5 + i * 0.22);
      const pw = size * (0.55 - i * 0.07);
      ctx.fillStyle = pads[Math.min(2, i)];
      blob(ctx, x + (rand() - 0.5) * size * 0.2, py, pw, size * 0.12);
    }
  }

  function paintTrees(g, rand, top) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const u = g.u;
    const spots = [
      [-33, 'c', 13], [-25, 'p', 10], [-17, 'c', 11],
      [19, 'p', 11], [27, 'c', 14], [35, 'c', 11],
    ];
    for (const [dx, kind, s] of spots) {
      const x = g.cx + dx * u;
      if (kind === 'c') cherry(ctx, g, rand, x, top, u * s);
      else pine(ctx, g, rand, x, top, u * s);
    }
    return c;
  }

  // ---- flood light ---------------------------------------------------------

  function paintGlow(g) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(g.cx, g.wy - g.u * 36, g.u * 4, g.cx, g.wy - g.u * 30, g.u * 52);
    gr.addColorStop(0, 'rgba(235,210,150,0.22)');
    gr.addColorStop(1, 'rgba(235,210,150,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.wy + 1);
    return c;
  }

  // ---- clouds --------------------------------------------------------------

  function paintClouds(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 3.5), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.4, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 96;
        img.data[i + 1] = 98;
        img.data[i + 2] = 124;
        img.data[i + 3] = a * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.clouds;
    const w = m.width;
    const a = (t * g.U * 0.9) % w;
    ctx.globalAlpha = Math.min(1, amount * 0.9);
    ctx.drawImage(m, -a, g.H * 0.06);
    ctx.drawImage(m, w - a, g.H * 0.06);
    const b = (t * g.U * 0.5 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, amount * 0.55);
    ctx.drawImage(m, b - w, g.H * 0.22);
    ctx.drawImage(m, b, g.H * 0.22);
    ctx.globalAlpha = 1;
  }

  // ---- moat ----------------------------------------------------------------

  function paintReflection(g) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(state.world, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = POND;
    ctx.globalAlpha = VEIL;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalAlpha = 1;
    return c;
  }

  function waveAt(g, y, t, ripple) {
    const d = (y - g.wy) / (g.H - g.wy);
    const p = ((t * 0.05) % 1.4) - 0.2;
    const swell = 0.55 + 1.0 * Math.exp(-((d - p) * (d - p)) / 0.012);
    const amp = g.U * (0.1 + 1.8 * d) * ripple * swell;
    const k = y / g.U;
    return amp * (Math.sin(k * 0.7 + t * 0.8) + 0.5 * Math.sin(k * 1.9 - t * 1.3));
  }

  function drawWater(ctx, g, t, ripple) {
    const src = state.reflection;
    const water = g.H - g.wy;
    ctx.drawImage(src, 0, g.wy);
    let y = 0;
    while (y < water) {
      const h = Math.max(1, Math.round(g.U * lerp(0.5, 2, y / water)));
      const dx = Math.round(waveAt(g, g.wy + y, t, ripple));
      ctx.drawImage(src, 0, y, g.W, h, dx, g.wy + y, g.W, h);
      y += h;
    }
  }

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      const d = 0.01 + 0.99 * Math.pow(rand(), 1.4);
      s.x[i] = rand() * g.W;
      s.y[i] = g.wy + d * (g.H - g.wy);
      s.l[i] = g.U * (2 + d * 8) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    const gl = { x: new Float32Array(GLINTS), y: new Float32Array(GLINTS), l: new Float32Array(GLINTS), p: new Float32Array(GLINTS) };
    for (let i = 0; i < GLINTS; i++) {
      gl.x[i] = g.cx + (rand() - 0.5) * g.u * 34;
      gl.y[i] = g.wy + g.u * (2 + rand() * 22);
      gl.l[i] = g.U * (1.2 + rand() * 2.4);
      gl.p[i] = rand() * TAU;
    }
    return { s, gl };
  }

  function drawStreaks(ctx, g, t, ripple) {
    const { s, gl } = state.streaks;
    const thick = Math.max(1, g.U * 0.4);
    const slide = t * g.U * (0.3 + ripple * 0.5);
    const amount = Math.min(1, ripple + 0.2);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#0c1520' : '#7d86a0';
      for (let i = pass; i < STREAKS; i += 2) {
        const a = Math.sin(t * 0.5 + s.p[i]);
        if (a <= 0) continue;
        ctx.globalAlpha = a * amount * (pass ? 0.4 : 0.32);
        const x = ((s.x[i] + slide) % (g.W + s.l[i] * 2)) - s.l[i];
        ctx.fillRect(x, s.y[i], s.l[i], thick);
      }
    }
    ctx.fillStyle = '#e8c978';
    for (let i = 0; i < GLINTS; i++) {
      const a = Math.sin(t * 0.7 + gl.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * amount * 0.6;
      ctx.fillRect(gl.x[i] + Math.sin(t * 0.4 + gl.p[i]) * g.U * 1.5, gl.y[i], gl.l[i], thick);
    }
    ctx.globalAlpha = 1;
  }

  // ---- petals --------------------------------------------------------------

  function makePetals() {
    const f = () => new Float32Array(MAX_PETALS);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), land: f(), timer: f(), tone: f(), mode: f() };
  }

  function resetPetal(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = g.W * (0.1 + r() * 0.8);
    L.y[i] = g.H * (0.1 + r() * 0.12) - (scatter ? 0 : g.U * 4);
    L.land[i] = g.wy + g.U * (3 + r() * 24);
    L.vy[i] = g.U * (2.2 + r() * 1.6);
    L.vx[i] = g.U * (0.6 + r() * 1.2);
    L.size[i] = Math.max(1.5, g.U * (0.7 + r() * 0.5));
    L.tone[i] = Math.floor(r() * PETAL_TONES.length);
    L.spin[i] = (r() - 0.5) * 3;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
    L.mode[i] = 0;
    L.timer[i] = 0;
    if (!scatter) return;
    const k = r();
    if (k < 0.5) L.y[i] = lerp(L.y[i], L.land[i], r());
    else if (k < 0.92) {
      L.mode[i] = 1;
      L.y[i] = L.land[i];
      L.timer[i] = 3 + r() * (FLOAT_LIFE - 6);
    } else {
      L.mode[i] = 2;
      L.timer[i] = r() * 6;
    }
  }

  function stepPetal(g, L, i, t, dt) {
    if (L.mode[i] === 0) {
      L.y[i] += L.vy[i] * dt;
      L.x[i] += (L.vx[i] + Math.sin(t * 1.1 + L.p[i]) * g.U * 2) * dt;
      L.a[i] += L.spin[i] * dt;
      if (L.y[i] >= L.land[i]) {
        L.mode[i] = 1;
        L.y[i] = L.land[i];
        L.timer[i] = 0;
      }
    } else if (L.mode[i] === 1) {
      L.timer[i] += dt;
      L.x[i] += L.vx[i] * 0.3 * dt;
      if (L.timer[i] > FLOAT_LIFE || L.x[i] > g.W + g.U * 3) {
        L.mode[i] = 2;
        L.timer[i] = state.rand() * 5;
      }
    } else {
      L.timer[i] -= dt;
      if (L.timer[i] <= 0) resetPetal(g, L, i, false);
    }
  }

  function drawPetals(ctx, g, t, count) {
    const L = state.petals;
    for (let i = 0; i < count; i++) {
      const m = L.mode[i];
      if (m === 2) continue;
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sz = L.size[i];
      ctx.fillStyle = PETAL_TONES[L.tone[i]];
      if (m === 0) {
        const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.7 + L.p[i]));
        ctx.globalAlpha = 1;
        ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      } else {
        ctx.globalAlpha = Math.min(1, (FLOAT_LIFE - L.timer[i]) / 4) * 0.85;
        ctx.setTransform(c, 0.4 * s, -s, 0.4 * c, L.x[i], L.y[i] + Math.sin(t * 0.8 + L.p[i]) * g.U * 0.15);
      }
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = paintBack(g, rand);
    const wallLayer = layer(g.W, g.wy + 1);
    const top = paintStoneWall(wallLayer.getContext('2d'), g, rand);
    const keep = paintKeep(g, rand, top);
    const trees = paintTrees(g, rand, top);
    const glow = paintGlow(g);
    const world = layer(g.W, g.wy + 1);
    const wctx = world.getContext('2d');
    wctx.drawImage(back, 0, 0);
    wctx.drawImage(keep, 0, 0);
    wctx.drawImage(glow, 0, 0);
    wctx.drawImage(wallLayer, 0, 0);
    wctx.drawImage(trees, 0, 0);
    state.world = world;
    state.back = back;
    state.front = layer(g.W, g.wy + 1);
    const fctx = state.front.getContext('2d');
    fctx.drawImage(keep, 0, 0);
    fctx.drawImage(glow, 0, 0);
    fctx.drawImage(wallLayer, 0, 0);
    fctx.drawImage(trees, 0, 0);
    state.reflection = paintReflection(g);
    state.clouds = paintClouds(g);
    state.streaks = makeStreaks(g, rand);
    state.petals = makePetals();
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, ripple, clouds } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepPetal(g, state.petals, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t, clouds);
    ctx.drawImage(state.front, 0, 0);
    drawWater(ctx, g, t, ripple);
    drawStreaks(ctx, g, t, ripple);
    drawPetals(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { petals: 1, ripple: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
