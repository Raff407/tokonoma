/*
 * 坪庭 Tsuboniwa — a tiny courtyard garden seen from the veranda in the rain.
 *
 * Wall, fence, moss, gravel, stones, lantern, bamboo and the stone basin are baked once.
 * The leaf canopy is a second baked layer drawn in a few strips that sway sideways.
 * Rain is one short pool drawn as a single path; ripples are a small reused pool.
 * The veranda, posts and tiled eave are baked last and drawn on top of everything.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;

  const C = {
    wall: '#cfc3a4',
    wallDim: '#bfb293',
    wallShade: '#a89c80',
    wallLit: '#ddd3b6',
    fence: '#b0a26c',
    fenceAlt: '#9a8d5e',
    rail: '#3b3326',
    moss: '#5f7040',
    mossLight: '#7d8d4c',
    mossDark: '#475a33',
    gravel: '#d9d2bd',
    rake: '#c2baa2',
    stone: '#8b8a84',
    stoneLight: '#aaa89f',
    stoneDark: '#5c5b57',
    water: '#2f4357',
    waterLight: '#7e93a3',
    bamboo: '#6b8a4a',
    bambooLight: '#8aa561',
    bambooDark: '#3f5a3a',
    leafMid: '#58783f',
    gold: '#d8b04e',
    vermilion: '#c4472d',
    tile: '#2e3338',
    tileLine: '#454b52',
    ink: '#23201d',
    wood: '#4a3a2c',
    woodLight: '#6a5440',
    woodDark: '#2f251c',
  };
  const RAIN_MAX = 150;
  const RIPPLES = 20;
  const STRIPS = 8;
  const DRIP_PERIOD = 1.2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function poly(ctx, pts, color) {
    ctx.fillStyle = color;
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
    const post = Math.max(U * 5, W * 0.035);
    return {
      W, H, U,
      x0: post,
      x1: W - post,
      y0: U * 14,
      wallBase: U * 62,
      floor: U * 85,
      cx: W * 0.5,
      basinY: U * 72,
    };
  }

  // ---- back wall, fence, ground -------------------------------------------

  function paintWall(ctx, g, rand) {
    const U = g.U;
    rect(ctx, 0, 0, g.W, g.wallBase, C.wall);
    for (let i = 0; i < 16; i++) {
      const w = U * (6 + rand() * 14);
      rect(ctx, g.x0 + rand() * (g.x1 - g.x0 - w), g.y0 + rand() * U * 26, w, U * (3 + rand() * 6), C.wallDim);
    }
    poly(ctx, [g.W * 0.56, g.y0, g.W * 0.8, g.y0, g.W * 0.52, g.wallBase, g.W * 0.26, g.wallBase], C.wallLit);
    rect(ctx, 0, g.y0, g.W, U * 4, C.wallShade);
    rect(ctx, 0, g.y0 + U * 4, g.W, U * 1, C.wallDim);
  }

  function paintFence(ctx, g) {
    const U = g.U;
    const top = U * 44;
    const step = Math.max(1.4, U * 1.7);
    let i = 0;
    for (let x = g.x0; x < g.x1; x += step, i++) {
      rect(ctx, x, top, Math.max(1, step * 0.78), g.wallBase - top, i % 2 ? C.fence : C.fenceAlt);
    }
    const rh = Math.max(1, U * 1.1);
    rect(ctx, g.x0, top + U * 3, g.x1 - g.x0, rh, C.rail);
    rect(ctx, g.x0, top + U * 14, g.x1 - g.x0, rh, C.rail);
    rect(ctx, g.x0, top - U * 1.2, g.x1 - g.x0, Math.max(1.2, U * 1.4), C.rail);
    rect(ctx, g.x0, g.wallBase - U * 0.8, g.x1 - g.x0, U * 1.6, C.stoneDark);
  }

  function paintGround(ctx, g, rand) {
    const U = g.U;
    rect(ctx, 0, g.wallBase, g.W, g.floor - g.wallBase + 1, C.moss);
    const n = Math.round(g.W / U) * 2;
    for (let i = 0; i < n; i++) {
      const x = g.x0 + rand() * (g.x1 - g.x0);
      const y = g.wallBase + rand() * (g.floor - g.wallBase);
      const r = U * (1.2 + rand() * 3);
      blob(ctx, x, y, r, r * 0.45, rand() < 0.5 ? C.mossLight : C.mossDark);
    }
    const rx = Math.min(g.W * 0.27, U * 44);
    const gy = U * 75;
    blob(ctx, g.cx, gy, rx, U * 8.5, C.gravel);
    ctx.strokeStyle = C.rake;
    ctx.lineWidth = Math.max(1, U * 0.5);
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.ellipse(g.cx, gy, rx * (1 - k * 0.2), U * 8.5 * (1 - k * 0.2), 0, 0, TAU);
      ctx.stroke();
    }
    return { gy, rx };
  }

  function stepStone(ctx, x, y, r) {
    blob(ctx, x, y + r * 0.18, r, r * 0.42, C.stoneDark);
    blob(ctx, x, y, r, r * 0.4, C.stone);
    blob(ctx, x - r * 0.15, y - r * 0.08, r * 0.62, r * 0.2, C.stoneLight);
  }

  function paintStones(ctx, g) {
    const U = g.U;
    stepStone(ctx, g.cx - U * 30, U * 81, U * 5);
    stepStone(ctx, g.cx - U * 22, U * 78, U * 3.6);
    stepStone(ctx, g.cx + U * 25, U * 80, U * 4.6);
    stepStone(ctx, g.cx + U * 31, U * 77, U * 3.2);
  }

  // ---- lantern, basin, bamboo ---------------------------------------------

  function paintLantern(ctx, g) {
    const U = g.U;
    const x = g.cx + U * 26;
    const y = U * 70;
    blob(ctx, x, y + U * 0.6, U * 5, U * 1.5, C.stoneDark);
    rect(ctx, x - U * 3.8, y - U * 1.8, U * 7.6, U * 2.2, C.stone);
    rect(ctx, x - U * 1.3, y - U * 9, U * 2.6, U * 7.4, C.stoneLight);
    rect(ctx, x - U * 3.4, y - U * 11, U * 6.8, U * 2.2, C.stone);
    rect(ctx, x - U * 3, y - U * 18, U * 6, U * 7.2, C.stoneLight);
    rect(ctx, x - U * 1.6, y - U * 16.6, U * 3.2, U * 4.4, C.stoneDark);
    poly(ctx, [x - U * 6.8, y - U * 18, x + U * 6.8, y - U * 18, x + U * 3.2, y - U * 22, x - U * 3.2, y - U * 22], C.stoneDark);
    rect(ctx, x - U * 6.8, y - U * 18.6, U * 13.6, U * 1, C.stone);
    blob(ctx, x, y - U * 23.2, U * 1.3, U * 1.5, C.stone);
    state.lantern = { x: x - U * 1.6, y: y - U * 16.6, w: U * 3.2, h: U * 4.4 };
  }

  function bambooStalk(ctx, g, rand, x, base, w) {
    const U = g.U;
    rect(ctx, x - w / 2, 0, w, base, C.bamboo);
    rect(ctx, x - w / 2, 0, Math.max(1, w * 0.3), base, C.bambooLight);
    rect(ctx, x + w * 0.2, 0, Math.max(1, w * 0.3), base, C.bambooDark);
    for (let y = base - U * (6 + rand() * 4); y > 0; y -= U * (9 + rand() * 4)) {
      rect(ctx, x - w * 0.6, y, w * 1.2, Math.max(1, U * 0.8), C.bambooDark);
    }
    blob(ctx, x, base + U * 0.5, w * 1.5, U * 1.2, C.mossDark);
    blob(ctx, x - w * 0.4, base, w * 1.1, U * 0.9, C.mossLight);
  }

  function stalkSpots(g) {
    const W = g.W;
    const U = g.U;
    return [
      [W * 0.11, U * 73, U * 3], [W * 0.17, U * 70, U * 2.4], [W * 0.235, U * 72, U * 2.8],
      [W * 0.8, U * 71, U * 2.6], [W * 0.86, U * 74, U * 3.1], [W * 0.915, U * 70, U * 2.3],
    ];
  }

  function paintBamboo(ctx, g, rand) {
    for (const [x, base, w] of stalkSpots(g)) bambooStalk(ctx, g, rand, x, base, w);
  }

  function paintBasin(ctx, g) {
    const U = g.U;
    const x = g.cx - U * 3;
    const y = g.basinY;
    state.basin = { x, rx: U * 9.5, wy: y - U * 5.2 };
    blob(ctx, x, y + U * 1.2, U * 11.5, U * 1.6, C.mossDark);
    poly(ctx, [x - U * 10, y - U * 5, x + U * 10, y - U * 5, x + U * 9, y + U * 0.5, x - U * 9, y + U * 0.5], C.stoneLight);
    poly(ctx, [x + U * 3, y - U * 5, x + U * 10, y - U * 5, x + U * 9, y + U * 0.5, x + U * 4, y + U * 0.5], C.stone);
    rect(ctx, x - U * 9.2, y - U * 0.8, U * 18.4, U * 1.3, C.mossDark);
    blob(ctx, x - U * 6, y - U * 0.4, U * 3, U * 0.8, C.mossLight);
    blob(ctx, x, y - U * 5.2, U * 10, U * 3, C.stoneLight);
    blob(ctx, x, y - U * 5.1, U * 8.4, U * 2.4, C.water);
    blob(ctx, x - U * 3, y - U * 5.5, U * 2.6, U * 0.5, C.waterLight);
    // bamboo spout on a short post
    rect(ctx, x + U * 15, U * 56, U * 1.6, y - U * 56, C.bamboo);
    rect(ctx, x + U * 15, U * 56, Math.max(1, U * 0.5), y - U * 56, C.bambooLight);
    ctx.strokeStyle = C.bamboo;
    ctx.lineWidth = Math.max(1.4, U * 1.7);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x + U * 16, U * 58);
    ctx.lineTo(x + U * 5, U * 62.4);
    ctx.stroke();
    rect(ctx, x + U * 4.6, U * 61.4, Math.max(1, U * 0.9), U * 2, C.bambooDark);
    state.spout = { x: x + U * 4.2, y: U * 63.4 };
    // ladle resting across the rim
    ctx.strokeStyle = C.woodLight;
    ctx.lineWidth = Math.max(1, U * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - U * 8, y - U * 6.6);
    ctx.lineTo(x - U * 1, y - U * 4.4);
    ctx.stroke();
    blob(ctx, x - U * 8.4, y - U * 6.7, U * 1.3, U * 0.8, C.wood);
  }

  function paintLeaves(ctx, g, rand) {
    const U = g.U;
    const tones = [C.bambooDark, C.leafMid, C.bambooLight];
    for (let pass = 0; pass < 3; pass++) {
      ctx.fillStyle = tones[pass];
      for (const [x] of stalkSpots(g)) {
        for (let b = 0; b < 3; b++) {
          const by = U * (18 + b * 9 + rand() * 4);
          const dir = x < g.cx ? 1 : -1;
          const bx = x + dir * U * (1 + rand() * 3);
          for (let k = 0; k < 6; k++) {
            const a = Math.PI * (0.3 + rand() * 0.4);
            const len = U * (6 + rand() * 6);
            const sx = dir * Math.cos(a) * len;
            const sy = Math.sin(a) * len;
            const w = U * 0.8;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + sx * 0.5 - dir * w, by + sy * 0.5 - w);
            ctx.lineTo(bx + sx, by + sy);
            ctx.lineTo(bx + sx * 0.5 + dir * w * 0.2, by + sy * 0.5 + w);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  }

  function paintFallen(ctx, g) {
    const U = g.U;
    const spots = [[g.cx - U * 14, U * 79], [g.cx + U * 12, U * 82], [g.W * 0.36, U * 70], [state.basin.x + U * 4, state.basin.wy + U * 0.2]];
    ctx.fillStyle = C.vermilion;
    for (const [x, y] of spots) blob(ctx, x, y, U * 1.2, U * 0.55, C.vermilion);
  }

  // ---- frame: eave, posts, veranda ------------------------------------------

  function paintFrame(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    rect(ctx, 0, 0, g.W, U * 9, C.tile);
    const step = Math.max(2, U * 2.4);
    for (let x = 0; x < g.W; x += step) {
      rect(ctx, x, 0, Math.max(1, U * 0.35), U * 7, C.tileLine);
      blob(ctx, x + step / 2, U * 7.4, step * 0.5, U * 1.2, C.tile);
    }
    rect(ctx, 0, U * 7.6, g.W, U * 0.7, C.tileLine);
    rect(ctx, 0, U * 9, g.W, U * 3, C.ink);
    rect(ctx, 0, U * 12, g.W, Math.max(1, U * 0.8), C.woodLight);
    const post = g.x0;
    for (const x of [0, g.x1]) {
      rect(ctx, x, 0, post, g.H, C.wood);
      rect(ctx, x === 0 ? post - U * 0.8 : x, 0, Math.max(1, U * 0.8), g.H, C.woodDark);
      rect(ctx, x === 0 ? 0 : x + post - U * 1.2, 0, Math.max(1, U * 1.2), g.H, C.woodLight);
    }
    rect(ctx, 0, g.floor - U * 1.6, g.W, U * 1.6, C.woodLight);
    rect(ctx, 0, g.floor, g.W, g.H - g.floor, C.wood);
    let y = g.floor;
    let gap = U * 3.4;
    while (y < g.H) {
      rect(ctx, 0, y, g.W, Math.max(1, U * 0.5), C.woodDark);
      y += gap;
      gap *= 1.22;
    }
    for (let i = 0; i < 7; i++) {
      rect(ctx, g.x0 + rand() * (g.x1 - g.x0), g.floor + U * (2 + rand() * 12), U * (6 + rand() * 10), Math.max(1, U * 0.5), C.woodLight);
    }
    return c;
  }

  // ---- rain and ripples -------------------------------------------------------

  function makeRain(g, rand) {
    const f = () => new Float32Array(RAIN_MAX);
    const R = { x: f(), y: f(), land: f(), v: f() };
    for (let i = 0; i < RAIN_MAX; i++) respawn(g, R, i, rand, true);
    return R;
  }

  function respawn(g, R, i, rand, scatter) {
    R.x[i] = g.x0 + rand() * (g.x1 - g.x0 + g.U * 6);
    R.land[i] = g.U * (66 + rand() * 18);
    R.v[i] = g.U * (62 + rand() * 24);
    R.y[i] = scatter ? rand() * R.land[i] : -g.U * 5;
  }

  function makeRipples() {
    const f = () => new Float32Array(RIPPLES);
    const P = { x: f(), y: f(), age: f(), life: f() };
    for (let i = 0; i < RIPPLES; i++) P.life[i] = 0;
    state.rippleNext = 0;
    return P;
  }

  function addRipple(g, x, y) {
    const P = state.ripples;
    const i = state.rippleNext;
    state.rippleNext = (i + 1) % RIPPLES;
    P.x[i] = x;
    P.y[i] = y;
    P.age[i] = 0;
    P.life[i] = 0.8;
  }

  function stepRain(g, dt, count) {
    const R = state.rain;
    for (let i = 0; i < count; i++) {
      R.y[i] += R.v[i] * dt;
      R.x[i] += R.v[i] * dt * 0.12;
      if (R.y[i] >= R.land[i]) {
        if (R.land[i] > g.wallBase + g.U * 4 && R.x[i] > g.x0 && R.x[i] < g.x1) addRipple(g, R.x[i], R.land[i]);
        respawn(g, R, i, state.rand, false);
      }
    }
    const P = state.ripples;
    for (let i = 0; i < RIPPLES; i++) if (P.life[i] > 0) P.age[i] += dt;
  }

  function drawRain(ctx, g, count) {
    const R = state.rain;
    const len = g.U * 4.2;
    ctx.strokeStyle = 'rgba(240,238,225,0.85)';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      ctx.moveTo(R.x[i], R.y[i]);
      ctx.lineTo(R.x[i] + len * 0.12, R.y[i] + len);
    }
    ctx.stroke();
  }

  function drawRipples(ctx, g) {
    const P = state.ripples;
    ctx.strokeStyle = '#efeadb';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let i = 0; i < RIPPLES; i++) {
      if (P.life[i] <= 0) continue;
      const k = P.age[i] / P.life[i];
      if (k >= 1) {
        P.life[i] = 0;
        continue;
      }
      const r = g.U * (0.5 + k * 2.2);
      ctx.globalAlpha = 0.8 * (1 - k);
      ctx.beginPath();
      ctx.ellipse(P.x[i], P.y[i], r, r * 0.35, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawDrip(ctx, g, t, speed) {
    const b = state.basin;
    const s = state.spout;
    const p = ((t * speed) / DRIP_PERIOD) % 1;
    const U = g.U;
    if (p < 0.55) {
      const f = (p / 0.55) ** 2;
      const y = s.y + (b.wy - s.y) * f;
      rect(ctx, s.x, y, Math.max(1, U * 0.8), Math.max(1.5, U * 1.8), C.waterLight);
      return;
    }
    ctx.strokeStyle = C.waterLight;
    ctx.lineWidth = Math.max(1, U * 0.35);
    for (let k = 0; k < 2; k++) {
      const q = (p - 0.55 - k * 0.12) / 0.45;
      if (q <= 0 || q >= 1) continue;
      const r = U * (0.8 + q * 6);
      ctx.globalAlpha = 1 - q;
      ctx.beginPath();
      ctx.ellipse(s.x + U * 0.4, b.wy + U * 0.3, r, r * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCanopy(ctx, g, t, sway) {
    const c = state.canopy;
    const h = c.height / STRIPS;
    for (let i = 0; i < STRIPS; i++) {
      const phase = Math.sin(t * 0.7 + i * 0.55) + 0.5 * Math.sin(t * 1.3 + i * 1.1);
      const dx = phase * g.U * 0.9 * sway * (0.4 + i / STRIPS);
      const y = Math.floor(i * h);
      const sh = Math.ceil(h) + 1;
      ctx.drawImage(c, 0, y, c.width, sh, dx, y, c.width, sh);
    }
  }

  // ---- run ------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const b = back.getContext('2d');
    paintWall(b, g, rand);
    paintFence(b, g);
    paintGround(b, g, rand);
    paintStones(b, g);
    paintLantern(b, g);
    paintBamboo(b, g, rand);
    paintBasin(b, g);
    paintFallen(b, g);
    state.back = back;
    const canopy = layer(g.W, g.H * 0.6);
    paintLeaves(canopy.getContext('2d'), g, rand);
    state.canopy = canopy;
    state.frame = paintFrame(g, rand);
    state.rain = makeRain(g, rand);
    state.ripples = makeRipples();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, sway, lantern, speed } = api.props;
    const count = Math.min(RAIN_MAX, Math.round(110 * rain));
    stepRain(g, Math.min(dt, 0.1), count);
    ctx.drawImage(state.back, 0, 0);
    if (lantern) {
      const l = state.lantern;
      rect(ctx, l.x, l.y, l.w, l.h, C.gold);
    }
    drawCanopy(ctx, g, t, sway);
    drawDrip(ctx, g, t, 1);
    drawRipples(ctx, g);
    drawRain(ctx, g, count);
    ctx.drawImage(state.frame, 0, 0);
  }

  Kasuri.run({
    defaults: { rain: 1, sway: 1, lantern: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
