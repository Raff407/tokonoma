/*
 * 雪の大谷 Yuki no Otani — a mountain road cut between walls of spring snow.
 *
 * The sky with the far ridge, and the corridor of snow and road, are baked once.
 * Clouds slide on a tiling strip, sunbeams are one layer faded very slowly,
 * and snow is a short pool of small flakes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const MAX_FLAKES = 110;
  const FLAKES = 55;
  const SKY = ['#5f93c0', '#7ba7cc', '#a0c1d8', '#c6d9e2', '#e2e8e5'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
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
    const vy = H * 0.5;
    return { W, H, U: H / 100, vy, rw: W * 0.17, wallH: H * 0.62 };
  }

  // road centre bends a little as it recedes
  function centre(g, s) {
    return g.W * 0.5 + Math.sin(s * 2.4 + 0.4) * (1 - s) * g.W * 0.07;
  }

  // ---- sky and ridge -------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const inks = SKY.map(K.parseColor);
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / g.vy) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    paintRidge(ctx, g);
    return c;
  }

  function ridgeY(g, x) {
    const peak = Math.exp(-(((x - g.W * 0.46) / (g.W * 0.12)) ** 2)) * g.H * 0.17;
    const peak2 = Math.exp(-(((x - g.W * 0.62) / (g.W * 0.08)) ** 2)) * g.H * 0.1;
    return g.vy - g.H * 0.05 - peak - peak2 + fbm(x / (g.U * 12), 2.2, 4, 7) * g.H * 0.05;
  }

  function paintRidge(ctx, g) {
    ctx.fillStyle = '#6b7f9c';
    ctx.beginPath();
    ctx.moveTo(0, g.vy + 4);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridgeY(g, x));
    ctx.lineTo(g.W, g.vy + 4);
    ctx.fill();
    // snow cap and gullies
    ctx.fillStyle = '#e6eaea';
    for (let x = 0; x < g.W; x += 2) {
      const y = ridgeY(g, x);
      if (y < g.vy - g.H * 0.07) {
        const depth = (g.vy - g.H * 0.07 - y) * 0.9 + g.U * 1.5;
        const gully = fbm(x / (g.U * 3), 0.5, 2, 5);
        ctx.fillRect(x, y, 2, depth * (0.55 + gully * 0.7));
      }
    }
    ctx.fillStyle = '#566a8c';
    for (let x = 0; x < g.W; x += 6) {
      const y = ridgeY(g, x);
      if (y < g.vy - g.H * 0.09) ctx.fillRect(x + 2, y + g.U * 3, 1, g.U * 4);
    }
    // haze at the foot
    const grad = ctx.createLinearGradient(0, g.vy - g.H * 0.12, 0, g.vy + 2);
    grad.addColorStop(0, 'rgba(219,227,226,0)');
    grad.addColorStop(1, 'rgba(219,227,226,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.vy - g.H * 0.12, g.W, g.H * 0.12 + 2);
  }

  // ---- corridor ------------------------------------------------------------

  function wallTop(g, x, s) {
    return g.vy + s * (g.H - g.vy - g.wallH) + (fbm(x / (g.U * 7), 3.3, 3, 17) - 0.5) * g.U * 7 * s;
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function paintCorridor(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const lit = K.parseColor('#f1efe6');
    const litShade = K.parseColor('#cbd8e2');
    const dark = K.parseColor('#a7b8cf');
    const darkShade = K.parseColor('#6c82a6');
    const haze = K.parseColor('#d3dde3');
    const road = K.parseColor('#4b5260');
    const wet = K.parseColor('#7b8794');
    const slush = K.parseColor('#d8dedf');
    for (let y = 0; y < g.H; y++) {
      const sRow = (y - g.vy) / (g.H - g.vy);
      for (let x = 0; x < g.W; x++) {
        let col = null;
        if (sRow > 0) {
          const cx = centre(g, sRow);
          const half = sRow * g.rw;
          const dx = x - cx;
          if (Math.abs(dx) < half) {
            const n = fbm(x / (g.U * 3), y / (g.U * 2), 3, 31);
            col = mix(road, wet, Math.min(1, n * 0.9 + sRow * 0.15));
            if (n > 0.64) col = mix(col, slush, 0.7);
            const edge = Math.abs(dx) / half;
            if (edge > 0.86) col = mix(col, slush, (edge - 0.86) * 6);
            col = mix(col, haze, Math.max(0, 0.55 - sRow));
          }
        }
        if (!col) {
          const left = x < centre(g, Math.max(0, sRow));
          let s = Math.abs(x - centre(g, Math.max(0, sRow))) / g.rw;
          for (let k = 0; k < 2; k++) s = Math.abs(x - centre(g, Math.min(1, s))) / g.rw;
          if (s > 0.02) {
            const sc = Math.min(s, 3);
            const top = wallTop(g, x, sc);
            const base = g.vy + Math.min(sc, 1) * (g.H - g.vy);
            if (y >= top && y <= base + 1 + (sc > 1 ? 40 : 0)) {
              const v = (base - y) / Math.max(1, base - top);
              const strata = fbm(x / (g.U * 20), v * 11, 2, 9);
              const band = Math.sin(v * 38 + strata * 5) > 0.82 ? 0.55 : 0;
              const cut = fbm(x / (g.U * 2.2), v * 5, 3, 3);
              let t = band * 0.7 + (cut > 0.62 ? 0.45 : 0) + (1 - v) * 0.25;
              const a = left ? lit : dark;
              const b = left ? litShade : darkShade;
              col = mix(a, b, Math.min(1, t));
              col = mix(col, haze, Math.max(0, 0.7 - s * 1.2));
              if (v > 0.93) col = mix(col, left ? lit : dark, 0.8);
            }
          }
        }
        if (col) {
          const i = (y * g.W + x) * 4;
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    paintDetails(ctx, g, rand);
    return c;
  }

  function paintDetails(ctx, g, rand) {
    // red and white snow poles along both road edges
    for (let i = 0; i < 6; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const s = 0.1 + i * 0.15 + (side > 0 ? 0.05 : 0);
        const x = centre(g, s) + side * s * g.rw * 0.97;
        const y = g.vy + s * (g.H - g.vy);
        const h = s * g.H * 0.2 + 2;
        const w = Math.max(1, s * g.U * 1.2);
        ctx.fillStyle = '#ece8dc';
        ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.fillStyle = '#c4452f';
        ctx.fillRect(x - w / 2, y - h, w, h * 0.35);
        ctx.fillRect(x - w / 2, y - h * 0.6, w, h * 0.2);
      }
    }
    // cedar tips above the far wall edges
    ctx.fillStyle = '#35503f';
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const s = 0.06 + rand() * 0.28;
      const x = centre(g, s) + side * (s * g.rw + g.U * (1 + rand() * 3));
      const y = wallTop(g, x, s + 0.05);
      const h = g.U * (3 + rand() * 4);
      poly(ctx, [x - h * 0.22, y + 1, x, y - h, x + h * 0.22, y + 1]);
    }
  }

  // ---- sunbeams, clouds, flakes -------------------------------------------

  function paintBeams(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ox = g.W * 0.82;
    const oy = -g.H * 0.15;
    const beams = [[0.0, 0.2], [0.12, 0.3], [0.3, 0.16], [0.42, 0.26], [0.56, 0.14]];
    for (const [off, wd] of beams) {
      const x0 = ox - g.W * (0.2 + off);
      const grad = ctx.createLinearGradient(ox, oy, x0, g.H);
      grad.addColorStop(0, 'rgba(247,231,170,0.34)');
      grad.addColorStop(0.7, 'rgba(247,231,170,0.12)');
      grad.addColorStop(1, 'rgba(247,231,170,0)');
      ctx.fillStyle = grad;
      poly(ctx, [ox, oy, ox + g.W * wd * 0.25, oy, x0 + g.W * wd * 0.35, g.H, x0 - g.W * wd * 0.2, g.H]);
    }
    return c;
  }

  function paintClouds(g, rand) {
    const w = Math.round(g.W * 1.4);
    const c = layer(w, g.vy);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eef0ec';
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * w + rand() * g.W * 0.05;
      const y = g.vy * (0.15 + rand() * 0.55);
      const rx = g.W * (0.04 + rand() * 0.06);
      for (let j = -2; j <= 2; j++) {
        ctx.beginPath();
        ctx.ellipse(x + j * rx * 0.6, y + Math.abs(j) * g.U * 0.2, rx * (1 - Math.abs(j) * 0.15), g.U * (1.2 + rand()), 0, 0, TAU);
        ctx.fill();
      }
    }
    return c;
  }

  function makeFlakes(g, rand) {
    const f = { x: new Float32Array(MAX_FLAKES), y: new Float32Array(MAX_FLAKES), v: new Float32Array(MAX_FLAKES), p: new Float32Array(MAX_FLAKES), z: new Float32Array(MAX_FLAKES) };
    for (let i = 0; i < MAX_FLAKES; i++) {
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.H;
      f.v[i] = 0.6 + rand() * 0.8;
      f.p[i] = rand() * TAU;
      f.z[i] = rand() < 0.3 ? 2 : 1;
    }
    return f;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.clouds = paintClouds(g, rand);
    state.corridor = paintCorridor(g, rand);
    state.beams = paintBeams(g);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { beams, snow } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.sky, 0, 0);
    const cw = state.clouds.width;
    const off = (t * g.W * 0.006) % cw;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(state.clouds, -off, 0);
    ctx.drawImage(state.clouds, cw - off, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.corridor, 0, 0);
    ctx.globalAlpha = Math.min(1, Math.max(0, beams * (0.78 + 0.22 * Math.sin(t * 0.25))));
    ctx.drawImage(state.beams, 0, 0);
    ctx.globalAlpha = 1;
    const F = state.flakes;
    const count = Math.min(MAX_FLAKES, Math.round(FLAKES * snow));
    ctx.fillStyle = '#f4f2ea';
    for (let i = 0; i < count; i++) {
      F.y[i] += F.v[i] * g.U * 2.2 * step;
      F.x[i] += (Math.sin(t * 0.7 + F.p[i]) * 0.6 - 0.35) * g.U * step * 2;
      if (F.y[i] > g.H) { F.y[i] = -2; F.x[i] = (F.x[i] + g.W * 0.37) % g.W; }
      if (F.x[i] < 0) F.x[i] += g.W;
      ctx.fillRect(F.x[i], F.y[i], F.z[i], F.z[i]);
    }
  }

  Kasuri.run({
    defaults: { beams: 1, snow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
