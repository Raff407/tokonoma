/*
 * 手拭い Tenugui — dyed hand towels pegged on a line in a bright sky.
 *
 * Sky, hills, roof and rope are baked once. Each cloth is baked once as a flat
 * dyed piece and drawn back in thin horizontal bands that slide sideways, more
 * toward the free hem, so it sways. Clouds are one tiling strip.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SKY = ['#a9c8dc', '#bfd6e1', '#d4e2e2', '#e6ebe0'];
  const INDIGO = ['#1f2f55', '#2a3f6e', '#3c5a93', '#5a7bb0'];
  const WASHI = '#ece6d3';
  const VERMILION = '#c0472f';
  const GOLD = '#d2ae5c';
  const MOSS = '#6b7b4e';
  const INK = '#2b2a2a';
  const BAND = 3;
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
    const cw = Math.max(12, Math.round(17 * U));
    const n = Math.max(3, Math.min(8, Math.floor(W / (cw * 1.5))));
    return { W, H, U, cw, n, lineY: H * 0.13, sag: H * 0.035 };
  }

  function ropeY(g, x) {
    const f = x / g.W;
    return g.lineY + g.sag * Math.sin(f * Math.PI);
  }

  // ---- backdrop ------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.8)) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[Math.min(inks.length - 1, k + (rand() < f - k ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#f3efdc';
    blob(ctx, g.W * 0.82, g.H * 0.2, g.U * 7, g.U * 7);
    ctx.fillStyle = '#e9e2c4';
    blob(ctx, g.W * 0.82, g.H * 0.2, g.U * 4.5, g.U * 4.5);
  }

  function paintHills(ctx, g) {
    const base = g.H * 0.82;
    const tones = ['#9db3c4', '#7f9a98', '#5f7a62'];
    const heights = [0.2, 0.13, 0.07];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = tones[k];
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 2; x += 2) {
        const y = base - g.H * heights[k] * (0.6 + 0.8 * K.fbm(x / (g.U * (45 - k * 10)), 2 + k * 3, 3, 7 + k));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
  }

  function paintRoof(ctx, g) {
    const top = g.H * 0.9;
    ctx.fillStyle = '#3b3a3c';
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#57565a';
    const s = Math.max(3, g.U * 2.4);
    for (let row = 0, y = top + 1; y < g.H; row++, y += s * 0.9) {
      for (let x = -s + (row % 2) * s * 0.5; x < g.W + s; x += s) {
        blob(ctx, x + s * 0.5, y + s * 0.2, s * 0.5, s * 0.34);
      }
    }
    ctx.fillStyle = INK;
    ctx.fillRect(0, top - 1, g.W, 2);
    ctx.fillStyle = '#8a8a86';
    ctx.fillRect(0, top - 2, g.W, 1);
  }

  function paintPoles(ctx, g) {
    const w = Math.max(2, g.U * 1.5);
    ctx.fillStyle = '#6a5238';
    ctx.fillRect(g.W * 0.015, g.lineY - g.U * 3, w, g.H);
    ctx.fillRect(g.W * 0.985 - w, g.lineY - g.U * 3, w, g.H);
    ctx.fillStyle = '#8b6e4c';
    ctx.fillRect(g.W * 0.015, g.lineY - g.U * 3, w * 0.4, g.H);
    ctx.fillRect(g.W * 0.985 - w, g.lineY - g.U * 3, w * 0.4, g.H);
  }

  function paintRope(ctx, g) {
    ctx.strokeStyle = '#a58f66';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    for (let x = 0; x <= g.W; x += 3) {
      const y = ropeY(g, x);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g);
    paintRoof(ctx, g);
    paintPoles(ctx, g);
    paintRope(ctx, g);
    return c;
  }

  // ---- clouds --------------------------------------------------------------

  function paintClouds(g, rand) {
    const w = Math.ceil(g.W * 1.4);
    const c = layer(w, g.H * 0.5);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f1e4';
    for (let i = 0; i < 9; i++) {
      const x = (i + rand() * 0.6) * (w / 9);
      const y = g.H * (0.06 + rand() * 0.34);
      const r = g.U * (3 + rand() * 4);
      for (let k = 0; k < 5; k++) blob(ctx, x + k * r * 0.8, y + (k % 2) * -r * 0.15, r * (0.9 + rand() * 0.5), r * 0.4);
    }
    return c;
  }

  // ---- cloth patterns ------------------------------------------------------

  function seigaiha(ctx, w, h, R) {
    ctx.fillStyle = INDIGO[1];
    ctx.fillRect(0, 0, w, h);
    const rings = [[1, WASHI], [0.78, INDIGO[2]], [0.56, WASHI], [0.34, INDIGO[1]]];
    for (let row = 0, y = 0; y < h + R; row++, y += R * 0.5) {
      for (let x = -R + (row % 2) * R; x < w + R; x += R * 2) {
        for (const [f, col] of rings) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(x, y, R * f, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function asanoha(ctx, w, h, s) {
    ctx.fillStyle = INDIGO[0];
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = WASHI;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -h; x < w + h; x += s) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.moveTo(x + h, 0);
      ctx.lineTo(x, h);
    }
    for (let x = s / 2; x < w; x += s) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();
    ctx.fillStyle = INDIGO[3];
    for (let y = s / 2; y < h; y += s) for (let x = s / 2; x < w; x += s) ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  function shippo(ctx, w, h, R) {
    ctx.fillStyle = INDIGO[2];
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = WASHI;
    ctx.lineWidth = 1;
    for (let row = 0, y = 0; y < h + R; row++, y += R) {
      for (let x = (row % 2) * R; x < w + R; x += R * 2) {
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.fillStyle = GOLD;
    for (let row = 0, y = 0; y < h + R; row++, y += R) {
      for (let x = (row % 2) * R; x < w + R; x += R * 2) ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
  }

  function koshi(ctx, w, h, s) {
    ctx.fillStyle = WASHI;
    ctx.fillRect(0, 0, w, h);
    let i = 0;
    for (let x = 0; x < w; x += s, i++) {
      ctx.fillStyle = i % 5 === 2 ? VERMILION : INDIGO[i % 2 ? 1 : 0];
      ctx.fillRect(x, 0, i % 5 === 2 ? Math.max(1, s * 0.5) : s, h);
    }
    ctx.fillStyle = INDIGO[1];
    for (let y = s * 3; y < h; y += s * 6) ctx.fillRect(0, y, w, 1);
  }

  function ichimatsu(ctx, w, h, s) {
    for (let y = 0, r = 0; y < h; y += s, r++) {
      for (let x = 0, c = 0; x < w; x += s, c++) {
        ctx.fillStyle = (r + c) % 2 ? WASHI : INDIGO[1];
        ctx.fillRect(x, y, s, s);
      }
    }
  }

  function shibori(ctx, w, h, R) {
    ctx.fillStyle = INDIGO[2];
    ctx.fillRect(0, 0, w, h);
    for (let row = 0, y = R; y < h + R; row++, y += R * 2.2) {
      for (let x = R + (row % 2) * R * 1.1; x < w + R; x += R * 2.2) {
        ctx.fillStyle = INDIGO[0];
        blob(ctx, x, y, R * 1.05, R * 1.05);
        ctx.fillStyle = WASHI;
        blob(ctx, x, y, R * 0.7, R * 0.7);
        ctx.fillStyle = INDIGO[1];
        blob(ctx, x, y, R * 0.28, R * 0.28);
      }
    }
  }

  function moss(ctx, w, h, s) {
    ctx.fillStyle = WASHI;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INDIGO[1];
    for (let y = 0, r = 0; y < h; y += s * 1.5, r++) {
      for (let x = (r % 2) * s; x < w + s; x += s * 2) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s, y + s * 0.75);
        ctx.lineTo(x, y + s * 1.5);
        ctx.lineTo(x - s, y + s * 0.75);
        ctx.fill();
      }
    }
    ctx.fillStyle = MOSS;
    for (let y = s * 0.75, r = 0; y < h; y += s * 1.5, r++) {
      for (let x = (r % 2) * s + s; x < w + s; x += s * 2) ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
  }

  const PATTERNS = [
    (c, w, h, U) => seigaiha(c, w, h, Math.max(3, U * 4.4)),
    (c, w, h, U) => asanoha(c, w, h, Math.max(4, U * 4.4)),
    (c, w, h, U) => koshi(c, w, h, Math.max(2, U * 2.2)),
    (c, w, h, U) => shippo(c, w, h, Math.max(3, U * 3)),
    (c, w, h, U) => shibori(c, w, h, Math.max(2, U * 2.2)),
    (c, w, h, U) => ichimatsu(c, w, h, Math.max(2, U * 2.4)),
    (c, w, h, U) => moss(c, w, h, Math.max(3, U * 3)),
  ];

  function paintCloth(g, rand, kind) {
    const h = Math.round(g.U * (40 + rand() * 16));
    const c = layer(g.cw, h);
    const ctx = c.getContext('2d');
    PATTERNS[kind % PATTERNS.length](ctx, g.cw, h, g.U);
    ctx.fillStyle = WASHI;
    ctx.fillRect(0, 0, g.cw, 1);
    ctx.fillStyle = INDIGO[0];
    ctx.fillRect(0, 1, g.cw, 1);
    ctx.fillStyle = WASHI;
    ctx.fillRect(0, h - 2, g.cw, 2);
    ctx.fillRect(0, 0, 1, h);
    ctx.fillRect(g.cw - 1, 0, 1, h);
    ctx.clearRect(0, h - 1, g.cw, 1);
    for (let x = 1; x < g.cw - 1; x += 2) ctx.clearRect(x, h - 1, 1, 1);
    return c;
  }

  function makeCloths(g, rand) {
    const order = [0, 2, 3, 4, 1, 6, 5, 2];
    const cloths = [];
    for (let i = 0; i < g.n; i++) {
      const img = paintCloth(g, rand, order[i % order.length]);
      const cx = g.W * (i + 0.5) / g.n + (rand() - 0.5) * g.cw * 0.25;
      cloths.push({ img, cx, top: ropeY(g, cx), phase: rand() * TAU, h: img.height });
    }
    return cloths;
  }

  function paintPegs(g, cloths) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const pw = Math.max(2, g.U * 0.9);
    const ph = Math.max(3, g.U * 2.2);
    for (const cl of cloths) {
      for (const f of [0.22, 0.78]) {
        const x = Math.round(cl.cx - g.cw / 2 + g.cw * f - pw / 2);
        ctx.fillStyle = '#9b7a4e';
        ctx.fillRect(x, cl.top - ph * 0.45, pw, ph);
        ctx.fillStyle = '#6a5238';
        ctx.fillRect(x, cl.top + ph * 0.1, pw, 1);
      }
    }
    return c;
  }

  // ---- run -----------------------------------------------------------------

  function drawCloth(ctx, g, cl, t, wind) {
    const h = cl.h;
    const bands = Math.ceil(h / BAND);
    const amp = g.cw * 0.5 * wind;
    const gust = 0.55 + 0.45 * Math.sin(t * 0.37 + cl.phase * 0.7);
    const lean = amp * 0.35 * gust;
    for (let k = 0; k < bands; k++) {
      const sy = k * BAND;
      const sh = Math.min(BAND, h - sy);
      const f = (k + 0.5) / bands;
      const swing = Math.sin(t * 1.25 + cl.phase - f * 1.6) * 0.6 + Math.sin(t * 0.61 + cl.phase * 1.7 - f * 0.9) * 0.4;
      const w = f * f * (lean + amp * 0.55 * swing * gust);
      const squeeze = 1 - Math.min(0.12, Math.abs(w) / (g.cw * 4));
      const lift = Math.abs(w) * 0.12;
      const dw = g.cw * squeeze;
      ctx.drawImage(cl.img, 0, sy, g.cw, sh, cl.cx - dw / 2 + w, cl.top + sy - lift, dw, sh + 0.5);
      const shade = Math.abs(swing) * f * 0.1;
      if (shade > 0.02) {
        ctx.globalAlpha = shade;
        ctx.fillStyle = '#15203c';
        ctx.fillRect(cl.cx - dw / 2 + w, cl.top + sy - lift, dw, sh);
        ctx.globalAlpha = 1;
      }
    }
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.clouds = paintClouds(g, rand);
    state.cloths = makeCloths(g, rand);
    state.pegs = paintPegs(g, state.cloths);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind, clouds } = api.props;
    ctx.drawImage(state.back, 0, 0);
    if (clouds > 0) {
      const cw = state.clouds.width;
      const x = -((t * 1.1 * clouds) % cw);
      ctx.globalAlpha = Math.min(1, 0.45 + clouds * 0.3);
      ctx.drawImage(state.clouds, x, 0);
      ctx.drawImage(state.clouds, x + cw, 0);
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < state.cloths.length; i++) drawCloth(ctx, g, state.cloths[i], t, wind);
    ctx.drawImage(state.pegs, 0, 0);
  }

  Kasuri.run({
    defaults: { wind: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
