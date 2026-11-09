/*
 * 独楽 Koma — painted wooden tops spinning on a tatami floor.
 *
 * The room is a simple perspective camera looking down at the mats. Wall, shoji
 * and floor (with the window light falling across it) are baked once per grid.
 * Each frame only the tops move: every top is a short stack of projected discs
 * leaning on its tip, the lean circling slowly while painted wedges spin.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep, parseColor } = K;

  const TAU = Math.PI * 2;
  const CAM_H = 0.55;
  const HORIZON = -0.3;
  const FOCAL = 1.6;
  const WALL_Y = 0.2;
  const MAT_DEPTH = 0.9;
  const MAT_LEN = 1.8;
  const HERI = 0.022;
  const ROW_SHIFT = 0.25;
  const SEGS = 18;
  const MAX_TOPS = 5;
  const STRAW = ['#c4b57a', '#b5a86c', '#a9a46e', '#cdbd80'].map(parseColor);
  const HERI_INK = parseColor('#2d3a52');
  const SEAM_INK = parseColor('#6f6640');
  const WOOD = '#b58a56';
  const WOOD_DARK = '#7a5430';
  const TIP = '#2b2622';
  const WASHI = '#e8dfc6';
  const GOLD = '#d4a94a';
  const SCHEMES = [
    ['#c2462e', '#2f4a78'],
    ['#2f4a78', '#d4a94a'],
    ['#4f6a3c', '#c2462e'],
    ['#c2462e', '#d4a94a'],
    ['#2f4a78', '#c2462e'],
  ];
  const SPOTS = [
    { x: -0.3, z: 1.0, s: 1.35, p: 0.0 },
    { x: 0.32, z: 1.18, s: 1.2, p: 2.1 },
    { x: 0.04, z: 0.86, s: 1.25, p: 4.0 },
    { x: -0.62, z: 1.35, s: 1.1, p: 1.2 },
    { x: 0.6, z: 0.9, s: 1.15, p: 3.3 },
  ];
  // Body profile from the tip up: height, radius, paint (0 tip, 1 wood, 2 dark wood, 3 c1, 4 c2, 5 washi).
  const PROFILE = [
    [0.000, 0.004, 0], [0.004, 0.010, 2], [0.008, 0.017, 2], [0.012, 0.024, 1],
    [0.016, 0.031, 1], [0.020, 0.037, 3], [0.024, 0.043, 3], [0.028, 0.048, 5],
    [0.032, 0.053, 1], [0.036, 0.057, 1], [0.040, 0.060, 4], [0.044, 0.062, 4],
    [0.048, 0.062, 5], [0.052, 0.062, 3], [0.056, 0.062, 3], [0.060, 0.061, 1],
  ];
  const FACE_H = 0.062;
  const STEM = [[0.064, 0.011], [0.072, 0.010], [0.080, 0.009], [0.088, 0.009], [0.096, 0.008]];
  const state = {};
  const P = { x: 0, y: 0 };
  const COS = new Float32Array(SEGS);
  const SIN = new Float32Array(SEGS);
  for (let i = 0; i < SEGS; i++) {
    COS[i] = Math.cos((i / SEGS) * TAU);
    SIN[i] = Math.sin((i / SEGS) * TAU);
  }

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, cx: W / 2, hy: H * HORIZON, f: H * FOCAL, wall: H * WALL_Y };
  }

  function project(g, x, h, z) {
    P.x = g.cx + (g.f * x) / z;
    P.y = g.hy + (g.f * (CAM_H - h)) / z;
  }

  // ---- room ------------------------------------------------------------------

  function windowLight(x, z) {
    const sx = x + 0.55 * (z - 1.0);
    const inside = smoothstep(-1.05, -0.9, sx) * (1 - smoothstep(-0.05, 0.12, sx));
    const depth = smoothstep(0.75, 0.9, z) * (1 - smoothstep(1.6, 1.75, z));
    const bar = Math.abs(((sx + 3) % 0.36) - 0.18) < 0.015 ? 0.4 : 1;
    return inside * depth * bar;
  }

  function strawInk(x, z) {
    const zs = z + ROW_SHIFT;
    const row = Math.floor(zs / MAT_DEPTH);
    const zin = zs - row * MAT_DEPTH;
    const shift = row % 2 === 0 ? 0 : MAT_LEN / 2;
    const xm = x + shift + 10 * MAT_LEN;
    const xin = xm % MAT_LEN;
    if (zin < HERI || zin > MAT_DEPTH - HERI) return HERI_INK;
    if (xin < 0.006 || xin > MAT_LEN - 0.006) return SEAM_INK;
    const mat = Math.floor(xm / MAT_LEN) + row * 7;
    const n = fbm(x * 2 + mat * 3.1, z * 14, 3, 17);
    return STRAW[Math.min(STRAW.length - 1, Math.floor(n * n * 1.6 * STRAW.length))];
  }

  function paintFloor(ctx, g, rand) {
    const top = Math.floor(g.wall);
    const img = ctx.createImageData(g.W, g.H - top);
    const d = img.data;
    for (let y = top; y < g.H; y++) {
      const z = (g.f * CAM_H) / (y + 0.5 - g.hy);
      const far = smoothstep(1.0, 1.8, z);
      for (let x = 0; x < g.W; x++) {
        const wx = ((x + 0.5 - g.cx) * z) / g.f;
        const ink = strawInk(wx, z);
        const lit = 0.97 - far * 0.16 + windowLight(wx, z) * 0.22;
        const i = ((y - top) * g.W + x) * 4;
        d[i] = Math.min(255, ink[0] * lit);
        d[i + 1] = Math.min(255, ink[1] * lit);
        d[i + 2] = Math.min(255, ink[2] * lit);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, top);
  }

  function paintWall(ctx, g) {
    const b = Math.ceil(g.wall);
    ctx.fillStyle = '#5a4630';
    ctx.fillRect(0, 0, g.W, b);
    const panel = g.H * 0.36;
    const x0 = -g.W * 0.12;
    for (let k = 0; k * panel + x0 < g.W; k++) {
      const px = x0 + k * panel;
      const lit = k < 2 + g.W / panel / 3;
      ctx.fillStyle = lit ? '#e6dcc0' : '#cfc4a6';
      ctx.fillRect(px + 1, 0, panel - 2, b - g.H * 0.03);
      ctx.fillStyle = '#6a5236';
      for (let c = 1; c < 3; c++) ctx.fillRect(px + (panel * c) / 3, 0, 1, b - g.H * 0.03);
      for (let r = 1; r < 4; r++) ctx.fillRect(px, (b - g.H * 0.03) * (r / 4) - 0.5, panel, 1);
    }
    ctx.fillStyle = '#3e3022';
    ctx.fillRect(0, b - g.H * 0.03, g.W, g.H * 0.03);
  }

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g);
    paintFloor(ctx, g, rand);
    return c;
  }

  // ---- tops ------------------------------------------------------------------

  function makeTops() {
    return {
      x: new Float32Array(MAX_TOPS),
      z: new Float32Array(MAX_TOPS),
      ax: new Float32Array(MAX_TOPS),
      ay: new Float32Array(MAX_TOPS),
      az: new Float32Array(MAX_TOPS),
      order: new Int8Array(MAX_TOPS),
    };
  }

  function placeTops(T, t, wobble, count) {
    for (let i = 0; i < count; i++) {
      const s = SPOTS[i];
      const w = 0.11 + 0.02 * i;
      T.x[i] = s.x + Math.cos(t * w + s.p) * 0.07 + Math.sin(t * w * 2.3 + s.p) * 0.02;
      T.z[i] = s.z + Math.sin(t * w + s.p) * 0.05;
      const lean = (0.08 + 0.06 * Math.sin(t * 0.21 + s.p)) * wobble;
      const phi = t * (0.9 + 0.12 * i) + s.p;
      T.ax[i] = Math.sin(lean) * Math.cos(phi);
      T.az[i] = Math.sin(lean) * Math.sin(phi);
      T.ay[i] = Math.cos(lean);
      T.order[i] = i;
    }
    for (let i = 1; i < count; i++) {
      const k = T.order[i];
      let j = i - 1;
      while (j >= 0 && T.z[T.order[j]] < T.z[k]) {
        T.order[j + 1] = T.order[j];
        j--;
      }
      T.order[j + 1] = k;
    }
  }

  function paint(scheme, k) {
    if (k === 0) return TIP;
    if (k === 1) return WOOD;
    if (k === 2) return WOOD_DARK;
    if (k === 3) return scheme[0];
    if (k === 4) return scheme[1];
    return WASHI;
  }

  // A circle of radius r around the axis at height h, from start to end segment.
  function disc(ctx, g, F, h, r, a0, a1) {
    const cx = F.x + F.ax * h;
    const cy = F.ay * h;
    const cz = F.z + F.az * h;
    ctx.beginPath();
    for (let i = a0; i <= a1; i++) {
      const k = i % SEGS;
      const px = cx + r * (F.ux * COS[k] + F.vx * SIN[k]);
      const py = cy + r * (F.uy * COS[k] + F.vy * SIN[k]);
      const pz = cz + r * (F.uz * COS[k] + F.vz * SIN[k]);
      project(g, px, py, pz);
      if (i === a0) ctx.moveTo(P.x, P.y);
      else ctx.lineTo(P.x, P.y);
    }
  }

  function frameOf(F, T, i, scale) {
    const ax = T.ax[i];
    const ay = T.ay[i];
    const az = T.az[i];
    let ux = ay;
    let uy = -ax;
    const len = Math.hypot(ux, uy) || 1;
    ux /= len;
    uy /= len;
    F.x = T.x[i];
    F.z = T.z[i];
    F.ax = ax * scale;
    F.ay = ay * scale;
    F.az = az * scale;
    F.ux = ux;
    F.uy = uy;
    F.uz = 0;
    F.vx = ay * 0 - az * uy;
    F.vy = az * ux - ax * 0;
    F.vz = ax * uy - ay * ux;
  }

  function drawShadow(ctx, g, F, scale) {
    const sx = F.x + F.ax * 0.03 + 0.012 * scale;
    const sz = F.z + F.az * 0.03 - 0.01 * scale;
    project(g, sx, 0, sz);
    const rx = (g.f * 0.07 * scale) / sz;
    const ry = (rx * CAM_H) / sz;
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#3a3220';
    ctx.beginPath();
    ctx.ellipse(P.x, P.y, rx * 1.05, ry * 1.05, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawFace(ctx, g, F, scheme, spin, scale) {
    const h = FACE_H;
    ctx.fillStyle = scheme[0];
    disc(ctx, g, F, h, 0.062 * scale, 0, SEGS);
    ctx.fill();
    ctx.fillStyle = WASHI;
    disc(ctx, g, F, h, 0.05 * scale, 0, SEGS);
    ctx.fill();
    ctx.fillStyle = WOOD_DARK;
    const off = Math.floor(((spin % TAU) / TAU) * SEGS);
    for (let w = 0; w < 2; w++) {
      const a0 = off + (w * SEGS) / 2;
      disc(ctx, g, F, h, 0.05 * scale, a0, a0 + 2);
      project(g, F.x + F.ax * h, F.ay * h, F.z + F.az * h);
      ctx.lineTo(P.x, P.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = scheme[1];
    disc(ctx, g, F, h, 0.03 * scale, 0, SEGS);
    ctx.fill();
    ctx.fillStyle = GOLD;
    disc(ctx, g, F, h, 0.02 * scale, 0, SEGS);
    ctx.fill();
  }

  function drawTop(ctx, g, T, i, t) {
    const s = SPOTS[i];
    const scale = s.s;
    const F = state.frame;
    const scheme = SCHEMES[i];
    frameOf(F, T, i, scale);
    drawShadow(ctx, g, F, scale);
    for (let k = 0; k < PROFILE.length; k++) {
      const row = PROFILE[k];
      ctx.fillStyle = paint(scheme, row[2]);
      disc(ctx, g, F, row[0], row[1] * scale, 0, SEGS);
      ctx.fill();
    }
    drawFace(ctx, g, F, scheme, t * (6 + i) + s.p, scale);
    for (let k = 0; k < STEM.length; k++) {
      ctx.fillStyle = k === STEM.length - 1 ? '#d8c9a2' : WOOD_DARK;
      disc(ctx, g, F, STEM[k][0], STEM[k][1] * scale, 0, SEGS);
      ctx.fill();
    }
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.room = paintRoom(g, rand);
    state.tops = makeTops();
    state.frame = { x: 0, z: 0, ax: 0, ay: 0, az: 0, ux: 0, uy: 0, uz: 0, vx: 0, vy: 0, vz: 0 };
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const count = Math.max(1, Math.min(MAX_TOPS, Math.round(api.props.tops)));
    const T = state.tops;
    placeTops(T, t, api.props.wobble, count);
    ctx.drawImage(state.room, 0, 0);
    for (let n = 0; n < count; n++) drawTop(ctx, g, T, T.order[n], t);
  }

  Kasuri.run({
    defaults: { tops: 3, wobble: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
