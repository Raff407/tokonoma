/*
 * 紙風船 Kamifusen — paper balloons rising over a quiet old street at dusk.
 *
 * Sky, mountains, the row of tiled townhouses and the road are baked once.
 * Balloons are six pre-drawn sprites reused by a small pool that rises, sways
 * and leans with a slow wind. Cloud is one tiling strip.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SKY = ['#4d5a78', '#6f7c92', '#a2a0a2', '#d4b894', '#ecd0a0'];
  const BALLOONS = [
    { base: '#cf4a30', shade: '#8f2f20', light: '#ea7a56', seam: '#a73a26' },
    { base: '#e2b04e', shade: '#a77f2c', light: '#f3d98e', seam: '#bf9139' },
    { base: '#e8dfc6', shade: '#b0a68c', light: '#faf5e6', seam: '#c9bfa4' },
    { base: '#4a5f8e', shade: '#2d3c5f', light: '#7589b4', seam: '#36486f' },
    { base: '#7c9358', shade: '#51663a', light: '#a6ba7e', seam: '#5f7443' },
    { base: '#d8643f', shade: '#9a4228', light: '#efa070', seam: '#b24f31' },
  ];
  const MAX_B = 30;
  const COUNT = 15;
  const SPRITE = 64;
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
    const U = H / 100;
    return { W, H, U, road: Math.round(H * 0.88) };
  }

  // ---- sky and mountains ---------------------------------------------------

  function paintSky(ctx, g, rand) {
    const hz = g.road;
    const img = ctx.createImageData(g.W, hz);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < hz; y++) {
      const f = Math.min(1, y / (g.H * 0.66)) * (inks.length - 1);
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
  }

  function paintMountains(ctx, g) {
    const tones = ['#7a7f93', '#5f677e'];
    const bases = [g.H * 0.5, g.H * 0.58];
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = tones[k];
      ctx.beginPath();
      ctx.moveTo(0, g.road);
      for (let x = 0; x <= g.W + 3; x += 3) {
        const y = bases[k] - K.fbm(x / (g.U * 38) + k * 5, 2.2 + k, 4, 7 + k) * g.U * 14
          - Math.exp(-(((x - g.W * (0.25 + k * 0.45)) / (g.U * 22)) ** 2)) * g.U * 9;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W, g.road);
      ctx.fill();
    }
  }

  // ---- townhouses ----------------------------------------------------------

  function tiledBand(ctx, x0, x1, yTop, yBot, tone, line) {
    ctx.fillStyle = tone;
    ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop);
    ctx.fillStyle = line;
    for (let y = yTop; y < yBot; y += 2) ctx.fillRect(x0, Math.round(y), x1 - x0, 1);
  }

  function lattice(ctx, x, y, w, h, dark, light, glow) {
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = glow || light;
    const gap = Math.max(1.4, w / 12);
    for (let i = gap; i < w - gap * 0.5; i += gap * 1.6) ctx.fillRect(x + i, y + 1, Math.max(0.7, gap * 0.45), h - 2);
  }

  function house(ctx, g, rand, x, w, floorH, topH, tone) {
    const U = g.U;
    const y0 = g.road;
    const g1 = y0 - floorH;
    const g2 = g1 - topH;
    const roofH = U * (6 + rand() * 3);
    // ground floor wall and lattice
    ctx.fillStyle = tone.wall;
    ctx.fillRect(x, g1, w, floorH);
    const doorW = w * 0.3;
    const doorX = x + w * (rand() < 0.5 ? 0.12 : 0.58);
    lattice(ctx, x + w * 0.06, g1 + floorH * 0.18, w * 0.88, floorH * 0.7, tone.wood, tone.woodLight, rand() < 0.5 ? '#c79c4c' : null);
    ctx.fillStyle = tone.noren;
    ctx.fillRect(doorX, g1 + floorH * 0.12, doorW, floorH * 0.5);
    ctx.fillStyle = tone.wood;
    ctx.fillRect(doorX + doorW * 0.48, g1 + floorH * 0.12, Math.max(1, doorW * 0.04), floorH * 0.5);
    // lower eave
    const ex = U * 1.6;
    ctx.fillStyle = tone.eaveEdge;
    poly(ctx, [x - ex, g1 + 1, x + w + ex, g1 + 1, x + w + ex - U * 0.4, g1 - U * 2.4, x - ex + U * 0.4, g1 - U * 2.4]);
    tiledBand(ctx, x - ex + U * 0.4, x + w + ex - U * 0.4, g1 - U * 2.4, g1 - U * 0.5, tone.roof, tone.roofLine);
    // upper floor plaster and mushiko window
    ctx.fillStyle = tone.plaster;
    ctx.fillRect(x, g2, w, topH - U * 2.4);
    const wx = x + w * 0.2;
    const ww = w * 0.6;
    ctx.fillStyle = tone.wood;
    ctx.fillRect(wx, g2 + topH * 0.2, ww, topH * 0.4);
    ctx.fillStyle = tone.plasterShade;
    for (let i = 1; i < 6; i++) ctx.fillRect(wx + (ww * i) / 6, g2 + topH * 0.2, Math.max(0.7, ww * 0.04), topH * 0.4);
    ctx.fillRect(x, g2 + topH * 0.78, w, 1);
    // main roof
    const rx = U * 1.8;
    ctx.fillStyle = tone.eaveEdge;
    poly(ctx, [x - rx, g2 + 1, x + w + rx, g2 + 1, x + w + rx - U * 0.4, g2 - U * 1.3, x - rx + U * 0.4, g2 - U * 1.3]);
    ctx.fillStyle = tone.roof;
    poly(ctx, [x - rx + U * 0.4, g2 - U * 1.3, x + w + rx - U * 0.4, g2 - U * 1.3, x + w * 0.9, g2 - roofH, x + w * 0.1, g2 - roofH]);
    ctx.fillStyle = tone.roofLine;
    for (let yy = g2 - U * 1.6; yy > g2 - roofH; yy -= 2) ctx.fillRect(x - rx, Math.round(yy), w + rx * 2, 1);
    ctx.fillStyle = tone.ridge;
    ctx.fillRect(x + w * 0.07, g2 - roofH - U * 0.7, w * 0.86, U * 0.8);
    ctx.fillRect(x + w * 0.07 - U * 0.5, g2 - roofH - U * 1.5, U * 1.2, U * 1.6);
    ctx.fillRect(x + w * 0.93 - U * 0.7, g2 - roofH - U * 1.5, U * 1.2, U * 1.6);
    // firewall step between houses
    ctx.fillStyle = tone.plaster;
    ctx.fillRect(x + w, g2 - U * 3.5, U * 0.9, U * 3.5 + topH);
    ctx.fillStyle = tone.roof;
    ctx.fillRect(x + w - U * 0.3, g2 - U * 4.4, U * 1.5, U * 0.9);
    return { top: g2 - roofH, mid: g2 + topH * 0.2 };
  }

  function paintStreet(ctx, g, rand) {
    const U = g.U;
    const tones = [
      { wall: '#5d4a3a', wood: '#2f2723', woodLight: '#8b6a48', noren: '#2d3a5a', plaster: '#a89d84', plasterShade: '#7c7360', roof: '#383f4d', roofLine: '#2b313d', ridge: '#232832', eaveEdge: '#22262e' },
      { wall: '#66503c', wood: '#322822', woodLight: '#97724a', noren: '#3b4a6c', plaster: '#b4a88c', plasterShade: '#867c66', roof: '#434b5a', roofLine: '#30374a', ridge: '#272c36', eaveEdge: '#262a33' },
    ];
    ctx.fillStyle = '#4b4e5c';
    ctx.fillRect(0, g.road - U * 0.2, g.W, g.H - g.road + U * 0.2);
    let x = -U * 3;
    let n = 0;
    while (x < g.W) {
      const w = U * (22 + rand() * 12);
      house(ctx, g, rand, x, w, U * (15 + rand() * 3), U * (9 + rand() * 6), tones[n++ % 2]);
      x += w + U * 1.2;
    }
    // road: dark packed earth with faint stone setts
    ctx.fillStyle = '#5a5a66';
    ctx.fillRect(0, g.road + U * 1.2, g.W, g.H - g.road);
    ctx.fillStyle = '#6d6a70';
    for (let i = 0; i < 70; i++) {
      ctx.fillRect(rand() * g.W, g.road + U * 2 + rand() * (g.H - g.road - U * 2), U * (1.5 + rand() * 2.5), Math.max(1, U * 0.3));
    }
  }

  function paintLanterns(ctx, g) {
    const U = g.U;
    const spots = [0.14, 0.43, 0.76];
    for (const f of spots) {
      const x = g.W * f;
      const y = g.road - U * 17;
      ctx.fillStyle = '#2e2a2a';
      ctx.fillRect(x - U * 0.15, y - U * 1.4, U * 0.3, U * 1.4);
      ctx.fillStyle = '#e7bd62';
      ctx.beginPath();
      ctx.ellipse(x, y + U * 1.5, U * 1.05, U * 1.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f3dc9a';
      ctx.beginPath();
      ctx.ellipse(x - U * 0.2, y + U * 1.2, U * 0.4, U * 0.8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2e2a2a';
      ctx.fillRect(x - U * 0.8, y, U * 1.6, U * 0.35);
      ctx.fillRect(x - U * 0.7, y + U * 2.9, U * 1.4, U * 0.35);
    }
  }

  function paintCloud(g, rand) {
    const w = g.W;
    const c = layer(w, g.H * 0.36);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e6d3ae';
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + rand() * g.U * 6;
      const y = g.H * (0.05 + rand() * 0.24);
      const len = g.U * (10 + rand() * 18);
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(x - len / 2 + k * g.U * 3, y + k * g.U * 0.6, len * (1 - k * 0.2), Math.max(1, g.U * 0.9));
        const wrap = x - len / 2 + k * g.U * 3 + len;
        if (wrap > w) ctx.fillRect(wrap - w - len, y + k * g.U * 0.6, len * (1 - k * 0.2), Math.max(1, g.U * 0.9));
      }
    }
    return c;
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintMountains(ctx, g);
    return c;
  }

  function paintTown(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintStreet(ctx, g, rand);
    paintLanterns(ctx, g);
    return c;
  }

  // ---- balloons ------------------------------------------------------------

  function balloonSprite(col) {
    const c = layer(SPRITE, SPRITE * 1.25);
    const ctx = c.getContext('2d');
    const cx = SPRITE / 2;
    const cy = SPRITE * 0.48;
    const r = SPRITE * 0.43;
    ctx.fillStyle = col.base;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.94, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col.shade;
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.2, cy + r * 0.28, r * 0.78, r * 0.62, 0, 0, TAU);
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col.seam;
    ctx.lineWidth = Math.max(1, SPRITE * 0.025);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(i) * r * 0.36 + 0.01, r * 0.94, 0, 0, TAU);
      if (i !== 0) ctx.stroke();
    }
    ctx.fillStyle = col.light;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.38, r * 0.25, r * 0.17, -0.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col.shade;
    poly(ctx, [cx - r * 0.2, cy + r * 0.9, cx + r * 0.2, cy + r * 0.9, cx + r * 0.1, cy + r * 1.12, cx - r * 0.1, cy + r * 1.12]);
    ctx.fillStyle = col.seam;
    ctx.fillRect(cx - 0.5, cy + r * 1.1, Math.max(1, SPRITE * 0.02), SPRITE * 0.12);
    return c;
  }

  function makeBalloons(g, rand) {
    const B = {
      x: new Float32Array(MAX_B), y: new Float32Array(MAX_B), s: new Float32Array(MAX_B),
      v: new Float32Array(MAX_B), p: new Float32Array(MAX_B), k: new Uint8Array(MAX_B),
      order: [],
    };
    for (let i = 0; i < MAX_B; i++) {
      B.x[i] = rand() * g.W;
      B.y[i] = g.H * (-0.1 + rand() * 1.05);
      B.s[i] = g.U * (6 + rand() * 6);
      B.v[i] = 0.7 + rand() * 0.7;
      B.p[i] = rand() * TAU;
      B.k[i] = Math.floor(rand() * BALLOONS.length);
    }
    return B;
  }

  function stepBalloons(g, B, t, dt, count, wind) {
    const gust = 0.55 + 0.45 * Math.sin(t * 0.17) + 0.2 * Math.sin(t * 0.43 + 1);
    for (let i = 0; i < count; i++) {
      const depth = B.s[i] / (g.U * 12);
      B.y[i] -= g.U * 2.6 * B.v[i] * (0.6 + depth * 0.5) * dt;
      B.x[i] += (g.U * 3.4 * gust * wind * (0.5 + depth) + Math.cos(t * 0.7 + B.p[i]) * g.U * 1.1) * dt;
      if (B.y[i] < -B.s[i] * 1.6) {
        B.y[i] = g.H + B.s[i] * 0.8;
        B.x[i] = (B.x[i] * 7.31 + 13) % g.W;
      }
      if (B.x[i] > g.W + B.s[i]) B.x[i] = -B.s[i];
    }
  }

  function drawBalloons(ctx, g, B, t, count) {
    for (let n = 0; n < MAX_B; n++) {
      const i = B.order[n];
      if (i >= count) continue;
      const d = B.s[i] * 2.1;
      const tilt = Math.sin(t * 0.9 + B.p[i]) * 0.1;
      ctx.setTransform(1, 0, 0, 1, B.x[i], B.y[i]);
      ctx.rotate(tilt);
      ctx.drawImage(state.sprites[B.k[i]], -d / 2, -d * 0.48, d, d * 1.25);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawCloud(ctx, g, t) {
    const w = state.cloud.width;
    const a = (t * g.U * 0.9) % w;
    ctx.drawImage(state.cloud, a - w, 0);
    ctx.drawImage(state.cloud, a, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.cloud = paintCloud(g, rand);
    state.town = paintTown(g, rand);
    state.sprites = BALLOONS.map(balloonSprite);
    state.b = makeBalloons(g, rand);
    state.b.order = Array.from({ length: MAX_B }, (_, i) => i).sort((a, b) => state.b.s[a] - state.b.s[b]);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { balloons, wind } = api.props;
    const count = Math.min(MAX_B, Math.round(COUNT * balloons));
    stepBalloons(g, state.b, t, Math.min(dt, 0.1), count, wind);
    ctx.drawImage(state.back, 0, 0);
    drawCloud(ctx, g, t);
    ctx.drawImage(state.town, 0, 0);
    drawBalloons(ctx, g, state.b, t, count);
  }

  Kasuri.run({
    defaults: { balloons: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
