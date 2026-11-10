/*
 * 秋吉台 Akiyoshidai — a karst plateau in autumn, tawny grass and pale limestone.
 *
 * Sky, ridge, plateau and rocks are baked once. Wind is two tiling strips of light
 * grass streaks sliding at different speeds; cloud shadows are one wrapped strip of
 * soft dark patches; the silver susuki in front is baked and swayed in a few slices.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.4;
  const SKY = ['#8c97a6', '#b0aeaa', '#d4c4a4', '#e6cfa0', '#ecd6a8'];
  const GRASS = ['#6e6a3a', '#847a42', '#9a8a4c', '#b09a58'];
  const ROCK = { lit: '#e4ddcc', mid: '#c4bfb0', dark: '#8f8c84', deep: '#5e5e58' };
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, hy: Math.round(H * HORIZON) };
  }

  function ridge(g, x) {
    const bump = Math.exp(-(((x - g.W * 0.72) / (g.W * 0.12)) ** 2)) * g.H * 0.035;
    return g.hy - g.H * 0.012 - bump - fbm(x / (g.U * 36), 2.2, 3, 5) * g.H * 0.035;
  }

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.hy + 2);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.hy + 2; y++) {
      const f = Math.min(1, y / g.hy) * (inks.length - 1);
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
    ctx.fillStyle = '#c8553a';
    blob(ctx, g.W * 0.7, g.hy * 0.76, g.U * 4.2, g.U * 4.2);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#e8b878';
    blob(ctx, g.W * 0.7, g.hy * 0.76, g.U * 10, g.U * 10);
    ctx.globalAlpha = 1;
  }

  function paintRidges(ctx, g, rand) {
    ctx.fillStyle = '#7e8590';
    ctx.beginPath();
    ctx.moveTo(0, g.hy + 1);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.hy - g.H * 0.05 - fbm(x / (g.U * 30), 7.1, 3, 9) * g.H * 0.05);
    }
    ctx.lineTo(g.W, g.hy + 1);
    ctx.fill();
    ctx.fillStyle = '#5c6a68';
    ctx.beginPath();
    ctx.moveTo(0, g.hy + 1);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x));
    ctx.lineTo(g.W, g.hy + 1);
    ctx.fill();
    ctx.fillStyle = '#6f7d72';
    for (let i = 0; i < 40; i++) {
      const x = rand() * g.W;
      blob(ctx, x, ridge(g, x) + g.U * (0.4 + rand() * 1.2), g.U * (1 + rand() * 1.5), g.U * 0.4);
    }
  }

  // Ground height for a depth value 0 (far) to 1 (near).
  function groundY(g, f) {
    return g.hy + (g.H - g.hy) * (f * f * 0.85 + f * 0.15);
  }

  function rolling(g, f, x) {
    return fbm(x / (g.U * 55), f * 3.1, 3, 31) * g.U * (1 + f * 4) - g.U * (0.5 + f * 2);
  }

  function paintPlateau(ctx, g, rand) {
    const rows = 90;
    for (let i = 0; i < rows; i++) {
      const f0 = i / rows;
      const f1 = (i + 1) / rows;
      const y0 = groundY(g, f0);
      const y1 = groundY(g, f1) + 1;
      for (let x = 0; x < g.W; x += 2) {
        const n = fbm(x / (g.U * (14 + f0 * 28)), f0 * 6, 3, 17);
        const roll = rolling(g, f0, x) / g.U;
        const t = Math.max(0, Math.min(0.999, n * 1.1 + roll * 0.08 + (rand() - 0.5) * 0.12));
        ctx.fillStyle = GRASS[Math.floor(t * GRASS.length)];
        ctx.fillRect(x, y0 + rolling(g, f0, x) * 0.4, 3, y1 - y0 + 1);
      }
    }
    // fade to haze at the far edge
    const haze = ctx.createLinearGradient(0, g.hy, 0, g.hy + g.H * 0.1);
    haze.addColorStop(0, 'rgba(214,196,160,0.55)');
    haze.addColorStop(1, 'rgba(214,196,160,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, g.hy, g.W, g.H * 0.1);
  }

  function outcrop(ctx, x, y, s, rand) {
    ctx.fillStyle = 'rgba(40,40,30,0.3)';
    blob(ctx, x + s * 0.2, y + s * 0.1, s * 1.05, s * 0.28);
    const parts = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < parts; i++) {
      const px = x + (rand() - 0.5) * s * 1.2;
      const rw = s * (0.35 + rand() * 0.4);
      const rh = rw * (0.55 + rand() * 0.55);
      const py = y - rh * 0.4 + (rand() - 0.5) * s * 0.1;
      ctx.fillStyle = ROCK.dark;
      blob(ctx, px, py, rw, rh);
      ctx.fillStyle = ROCK.mid;
      blob(ctx, px - rw * 0.12, py - rh * 0.12, rw * 0.86, rh * 0.86);
      ctx.fillStyle = ROCK.lit;
      blob(ctx, px - rw * 0.3, py - rh * 0.34, rw * 0.5, rh * 0.42);
      ctx.fillStyle = ROCK.deep;
      ctx.fillRect(px + rw * 0.1, py - rh * 0.1, Math.max(1, rw * 0.06), rh * 0.5);
    }
  }

  function paintRocks(ctx, g, rand) {
    const list = [];
    for (let i = 0; i < 70; i++) {
      const f = 0.06 + Math.pow(rand(), 1.3) * 0.9;
      list.push({ f, x: rand() * g.W });
    }
    list.sort((a, b) => a.f - b.f);
    for (const r of list) {
      const n = fbm(r.x / (g.U * 40), r.f * 4, 2, 77);
      if (n < 0.38) continue;
      const y = groundY(g, r.f) + rolling(g, r.f, r.x) * 0.4;
      const s = g.U * (0.9 + r.f * 7.5) * (0.6 + rand() * 0.8);
      outcrop(ctx, r.x, y, s, rand);
    }
  }

  function paintTufts(ctx, g, rand) {
    for (let i = 0; i < 260; i++) {
      const f = 0.1 + rand() * 0.9;
      const x = rand() * g.W;
      const y = groundY(g, f);
      const s = g.U * (0.4 + f * 2.2);
      ctx.strokeStyle = rand() < 0.5 ? '#c7b36a' : '#5f5a30';
      ctx.lineWidth = Math.max(1, s * 0.12);
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(x + k * s * 0.15, y);
        ctx.lineTo(x + k * s * 0.5, y - s * (0.7 + rand() * 0.4));
      }
      ctx.stroke();
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintRidges(ctx, g, rand);
    paintPlateau(ctx, g, rand);
    paintRocks(ctx, g, rand);
    paintTufts(ctx, g, rand);
    return c;
  }

  // ---- sky clouds ---------------------------------------------------------

  function paintClouds(g, rand) {
    const c = layer(g.W, g.hy);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = rand() * g.W;
      const y = g.hy * (0.1 + rand() * 0.55);
      const w = g.U * (10 + rand() * 18);
      ctx.fillStyle = 'rgba(120,118,128,0.35)';
      blob(ctx, x, y + g.U * 0.6, w, g.U * 1.3);
      ctx.fillStyle = 'rgba(244,228,196,0.7)';
      blob(ctx, x, y, w, g.U * 1.4);
      blob(ctx, x - w * 0.3, y - g.U * 0.9, w * 0.5, g.U * 1.1);
      ctx.fillStyle = 'rgba(255,244,220,0.5)';
      blob(ctx, x + w * 0.1, y - g.U * 0.7, w * 0.4, g.U * 0.6);
    }
    return c;
  }

  // ---- wind strips ----------------------------------------------------------

  function paintWind(g, rand, seed, tone, count, period) {
    const h = g.H - g.hy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const r = K.rng(seed);
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const f = 0.05 + r() * 0.95;
      const y = groundY(g, f) - g.hy;
      const x = r() * g.W;
      const phase = TAU * (x / period) + f * 5;
      const a = Math.pow(0.5 + 0.5 * Math.sin(phase), 2.2);
      if (a < 0.08) continue;
      const len = g.U * (1.5 + f * 7) * (0.7 + r() * 0.8);
      ctx.strokeStyle = tone;
      ctx.globalAlpha = Math.min(0.75, a * 0.75);
      ctx.lineWidth = Math.max(1, g.U * (0.2 + f * 0.5));
      for (const dx of [0, -g.W, g.W]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y);
        ctx.lineTo(x + dx + len, y - len * 0.22);
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
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.3 + rand() * 0.4) * g.W / 4;
      const f = 0.15 + rand() * 0.75;
      const y = groundY(g, f) - g.hy;
      const rx = g.U * (16 + f * 30);
      const ry = g.U * (3 + f * 12);
      for (const dx of [0, -g.W, g.W]) {
        ctx.fillStyle = 'rgba(38,48,58,0.12)';
        blob(ctx, x + dx, y, rx, ry);
        ctx.fillStyle = 'rgba(38,48,58,0.14)';
        blob(ctx, x + dx + rx * 0.1, y, rx * 0.7, ry * 0.7);
        ctx.fillStyle = 'rgba(38,48,58,0.14)';
        blob(ctx, x + dx + rx * 0.2, y, rx * 0.4, ry * 0.45);
      }
    }
    return c;
  }

  // ---- susuki in front ------------------------------------------------------

  function paintSusuki(g, rand) {
    const c = layer(g.W, g.H * 0.3);
    const ctx = c.getContext('2d');
    const h = c.height;
    ctx.lineCap = 'round';
    const n = Math.round(g.W / (g.U * 1.6));
    for (let i = 0; i < n; i++) {
      const x = rand() * g.W;
      const near = rand();
      const top = h * (0.12 + near * 0.35) ;
      const bx = x + (rand() - 0.5) * g.U * 2;
      const lean = (rand() - 0.5) * g.U * 5;
      ctx.strokeStyle = near > 0.5 ? '#5c5a30' : '#6e6a3c';
      ctx.lineWidth = Math.max(1, g.U * (0.25 + near * 0.3));
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(bx + k * g.U * 0.5, h + 2);
        ctx.quadraticCurveTo(bx + lean * 0.3, h * 0.7, bx + lean + k * g.U * 0.6, top + g.U * 3 + k * g.U);
        ctx.stroke();
      }
      if (rand() < 0.55) {
        const hx = bx + lean;
        ctx.strokeStyle = '#8c7a46';
        ctx.lineWidth = Math.max(1, g.U * 0.25);
        ctx.beginPath();
        ctx.moveTo(hx, top + g.U * 3);
        ctx.lineTo(hx + lean * 0.1, top);
        ctx.stroke();
        ctx.fillStyle = '#e8dcc0';
        blob(ctx, hx + lean * 0.1, top + g.U * 0.5, g.U * 0.7, g.U * 2);
        ctx.fillStyle = '#c8b886';
        blob(ctx, hx + lean * 0.1 + g.U * 0.3, top + g.U * 0.9, g.U * 0.4, g.U * 1.3);
      }
    }
    return c;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.clouds = paintClouds(g, rand);
    state.windA = paintWind(g, rand, 3, '#e6d596', 420, g.W / 2);
    state.windB = paintWind(g, rand, 8, '#f0e6b8', 260, g.W / 3);
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
    ctx.globalAlpha = 0.9;
    wrapDraw(ctx, state.clouds, t * g.U * 0.5, 0);
    ctx.globalAlpha = 1;
    ctx.globalAlpha = Math.min(1, 0.5 * wind);
    wrapDraw(ctx, state.windA, t * g.U * 3.2, g.hy);
    ctx.globalAlpha = Math.min(1, 0.45 * wind);
    wrapDraw(ctx, state.windB, t * g.U * 4.6, g.hy);
    ctx.globalAlpha = Math.min(1, shade);
    wrapDraw(ctx, state.shade, t * g.U * 1.6, g.hy);
    ctx.globalAlpha = 1;
    // susuki sways in slices, more at the tips
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
