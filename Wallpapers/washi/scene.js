/*
 * Washi, a sea eagle over snowy peaks and a bay of drift ice at dawn.
 *
 * Sky, sun, peaks, ice and the pine branch are baked once. Cloud is one tiling strip
 * that slides sideways, the ice sheet sways a little, a few glints shimmer on the
 * sun path, and the eagle is drawn each frame from a handful of polygons.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;
  const TAU = Math.PI * 2;
  const HORIZON = 0.6;
  const GLINTS = 14;
  const INK = '#1d2030';
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
    return { W, H, U, wy: Math.round(H * HORIZON), sx: W * 0.68 };
  }

  // ---- sky and sun ---------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, '#3d4a74');
    grad.addColorStop(0.45, '#6a7398');
    grad.addColorStop(0.75, '#b69a99');
    grad.addColorStop(1, '#e2b48a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy + 1);
  }

  function paintSun(ctx, g) {
    const sy = g.wy - g.U * 19;
    ctx.fillStyle = 'rgba(214,100,70,0.28)';
    blob(ctx, g.sx, sy, g.U * 30, g.U * 20);
    ctx.fillStyle = 'rgba(232,150,100,0.4)';
    blob(ctx, g.sx, sy, g.U * 17, g.U * 12);
    ctx.fillStyle = '#d6452c';
    blob(ctx, g.sx, sy, g.U * 7, g.U * 7);
    ctx.fillStyle = '#e5a45c';
    blob(ctx, g.sx - g.U * 1.2, sy - g.U * 1.2, g.U * 3.5, g.U * 3.5);
  }

  // ---- peaks ---------------------------------------------------------------

  const PEAKS = [
    [0.1, 0.4, 0.5], [0.3, 0.3, 0.7], [0.5, 0.45, 0.45], [1.0, 0.62, 0.55],
  ];

  function ridge(g, x, far) {
    let y = g.H;
    for (let i = 0; i < PEAKS.length; i++) {
      const p = PEAKS[i];
      const px = (far ? p[0] * 0.8 + 0.08 : p[0]) * g.W;
      const top = g.H * (far ? p[1] - 0.02 : p[1] - 0.26 + (i % 2) * 0.08);
      const slope = 1.0 + p[2] * 0.5;
      y = Math.min(y, top + Math.abs(x - px) * slope);
    }
    return y + (fbm(x / (g.U * 9), far ? 3.3 : 7.7, 4, 19) - 0.5) * g.U * 18 + fbm(x / (g.U * 2.5), 2.2, 2, 8) * g.U * 2.5;
  }

  function paintRange(ctx, g, far) {
    const snow = far ? '#cfc7cb' : '#eee8dc';
    const lit = far ? '#e0c0b0' : '#f4dcc4';
    const shade = far ? '#8e92b0' : '#7e86ab';
    const foot = far ? '#6a7396' : '#4a5478';
    const step = 1;
    for (let x = 0; x < g.W; x += step) {
      const y = ridge(g, x, far);
      const slope = (ridge(g, x + 6, far) - ridge(g, x - 6, far)) / 3;
      const top = Math.min(y, g.wy);
      const face = slope > 0.5 ? shade : slope < -0.5 ? lit : snow;
      ctx.fillStyle = face;
      ctx.fillRect(x, top, step, g.wy - top + 1);
      const tree = g.wy - g.U * (far ? 3 : 5) + fbm(x / (g.U * 4), 1.7, 2, 5) * g.U * 3;
      if (tree < g.wy) {
        ctx.fillStyle = foot;
        ctx.fillRect(x, tree, step, g.wy - tree + 1);
      }
      const gully = fbm(x / (g.U * 1.4), 6.1, 2, 13);
      if (gully > 0.56 && top + g.U * 3 < tree) {
        ctx.fillStyle = face === lit ? '#d6a890' : face === shade ? '#5c6590' : '#b8b0c0';
        ctx.fillRect(x, top + g.U * 3, step, Math.min(tree - top, g.U * 4 + (gully - 0.5) * g.U * 90));
      }
    }
  }

  function paintBack(g) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintSun(ctx, g);
    paintRange(ctx, g, true);
    ctx.fillStyle = 'rgba(226,190,160,0.28)';
    ctx.fillRect(0, g.wy - g.U * 6, g.W, g.U * 6 + 1);
    paintRange(ctx, g, false);
    const haze = ctx.createLinearGradient(0, g.wy - g.U * 34, 0, g.wy);
    haze.addColorStop(0, 'rgba(120,126,160,0)');
    haze.addColorStop(1, 'rgba(120,126,160,0.85)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, g.wy - g.U * 34, g.W, g.U * 34 + 1);
    return c;
  }

  // ---- cloud strip ---------------------------------------------------------

  function paintCloud(g, rand) {
    const c = layer(g.W, g.H * 0.4);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.05 + rand() * 0.25);
      const rx = g.U * (10 + rand() * 16);
      const ry = g.U * (0.9 + rand() * 0.8);
      for (let k = -1; k <= 1; k++) {
        const cx = x + k * g.W;
        ctx.fillStyle = 'rgba(86,94,126,0.7)';
        blob(ctx, cx, y + ry * 0.5, rx, ry);
        ctx.fillStyle = 'rgba(206,176,170,0.8)';
        blob(ctx, cx - rx * 0.1, y - ry * 0.2, rx * 0.82, ry * 0.65);
        ctx.fillStyle = 'rgba(240,214,190,0.75)';
        blob(ctx, cx - rx * 0.25, y - ry * 0.55, rx * 0.4, ry * 0.3);
      }
    }
    return c;
  }

  // ---- drift ice bay -------------------------------------------------------

  function paintSea(g) {
    const c = layer(g.W, g.H - g.wy + 1);
    const ctx = c.getContext('2d');
    const h = g.H - g.wy;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#6b6f8a');
    grad.addColorStop(0.15, '#3c4764');
    grad.addColorStop(1, '#1f2842');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, h + 1);
    const path = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    path.addColorStop(0, 'rgba(226,130,86,0.6)');
    path.addColorStop(1, 'rgba(214,80,50,0)');
    ctx.fillStyle = path;
    ctx.beginPath();
    ctx.moveTo(g.sx - g.U * 6, 0);
    ctx.lineTo(g.sx + g.U * 6, 0);
    ctx.lineTo(g.sx + g.U * 20, h * 0.7);
    ctx.lineTo(g.sx - g.U * 20, h * 0.7);
    ctx.fill();
    return c;
  }

  function paintIce(g, rand) {
    const w = g.W + g.U * 4;
    const h = g.H - g.wy + 1;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    for (let y = g.U * 0.6; y < h; ) {
      const f = y / h;
      const size = g.U * (1.2 + f * 7);
      for (let x = -size; x < w + size; ) {
        const rx = size * (0.7 + rand() * 1.2);
        const ry = rx * (0.14 + f * 0.1);
        if (rand() < 0.74) {
          const warm = Math.abs(x - g.sx) < g.U * (8 + f * 22);
          ctx.fillStyle = '#7a86a6';
          blob(ctx, x, y + ry * 0.35, rx, ry);
          ctx.fillStyle = warm ? '#e8c8a6' : '#dcd8da';
          blob(ctx, x, y, rx * 0.96, ry * 0.8);
          ctx.fillStyle = warm ? '#f5e2c4' : '#f0ece4';
          blob(ctx, x - rx * 0.15, y - ry * 0.2, rx * 0.6, ry * 0.4);
        }
        x += rx * (1.3 + rand() * 1.4);
      }
      y += size * 0.55;
    }
    return c;
  }

  // ---- foreground pine branch and torii ------------------------------------

  function needles(ctx, x, y, len, dir, up) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 1.4 + up;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len * dir, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }

  function paintBranch(ctx, g, rand) {
    const U = g.U;
    ctx.strokeStyle = '#2a2a2c';
    ctx.lineWidth = Math.max(1, U * 0.9);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-U, U * 6);
    ctx.quadraticCurveTo(U * 12, U * 9, U * 26, U * 20);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, U * 0.28);
    ctx.strokeStyle = '#2f4a38';
    for (let i = 0; i < 7; i++) {
      const f = 0.12 + i * 0.13;
      const x = lerp(0, U * 26, f);
      const y = lerp(U * 6.5, U * 20, f) + U * 0.6;
      needles(ctx, x, y, U * (3.6 - f * 1.5), 1, 0.6);
    }
    ctx.fillStyle = '#eee8dc';
    for (let i = 0; i < 6; i++) {
      const f = 0.1 + i * 0.15;
      blob(ctx, lerp(0, U * 26, f) + U * 0.4, lerp(U * 6.5, U * 20, f) - U * 0.5, U * (1.6 - f * 0.6), U * 0.5);
    }
  }

  function paintTorii(ctx, g) {
    const U = g.U;
    const x = g.W * 0.14;
    const y = g.wy + U * 9;
    const s = U * 0.9;
    ctx.fillStyle = '#3a3c58';
    blob(ctx, x, y + s * 0.2, s * 8, s * 0.7);
    ctx.fillStyle = '#c4452f';
    ctx.fillRect(x - s * 4.2, y - s * 9, s * 0.9, s * 9.2);
    ctx.fillRect(x + s * 3.3, y - s * 9, s * 0.9, s * 9.2);
    ctx.fillRect(x - s * 3.6, y - s * 6.4, s * 7.2, s * 0.8);
    ctx.fillStyle = '#2a2224';
    poly(ctx, [x - s * 6, y - s * 9.2, x + s * 6, y - s * 9.2, x + s * 5, y - s * 8.1, x - s * 5, y - s * 8.1]);
    ctx.fillStyle = '#eee8dc';
    blob(ctx, x, y - s * 9.3, s * 5.5, s * 0.45);
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintTorii(ctx, g);
    ctx.save();
    ctx.translate(g.W - g.U * 2, 0);
    ctx.scale(-1.5, 1.5);
    paintBranch(ctx, g, rand);
    ctx.restore();
    return c;
  }

  // ---- the eagle -----------------------------------------------------------

  function wing(ctx, bx, by, s, span, lift, U) {
    const a1 = 0.3 + lift * 0.5;
    const a2 = a1 * 0.4 - 0.45 - lift * 0.3;
    const sx = bx + s * U * 1.2;
    const ex = sx + s * Math.cos(a1) * span * 0.5;
    const ey = by - Math.sin(a1) * span * 0.5;
    const tx = ex + s * Math.cos(a2) * span * 0.55;
    const ty = ey - Math.sin(a2) * span * 0.55;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(sx, by - U * 0.9);
    ctx.lineTo(ex, ey - U * 1.1);
    ctx.lineTo(tx, ty);
    for (let k = 0; k < 4; k++) {
      const f = 0.95 - k * 0.2;
      const px = lerp(ex, tx, f);
      const py = lerp(ey, ty, f);
      const ch = U * (1.6 + k * 1.1);
      ctx.lineTo(px - s * U * 0.5, py + ch);
      ctx.lineTo(px - s * U * 1.5, py + ch * 0.45);
    }
    ctx.lineTo(ex, ey + U * 5);
    ctx.lineTo(sx, by + U * 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f0ead8';
    blob(ctx, lerp(sx, ex, 0.45), lerp(by, ey, 0.45) + U * 0.8, U * 2.4, U * 1.0);
  }

  function drawEagle(ctx, g, t, flap) {
    const U = g.U * 1.15;
    const bx = g.W * (0.4 + 0.12 * Math.sin(t * 0.05));
    const by = g.H * (0.3 + 0.025 * Math.sin(t * 0.11));
    const beat = Math.sin(t * 0.9 * (0.4 + flap * 0.6));
    const gate = Math.min(1, Math.max(0, Math.sin(t * 0.25) * 1.5 + 0.8));
    const lift = beat * gate * Math.min(1, flap) + (1 - gate) * 0.15;
    const bank = Math.cos(t * 0.05) * 0.06;
    ctx.setTransform(Math.cos(bank), Math.sin(bank), -Math.sin(bank), Math.cos(bank), bx, by);
    const span = U * 22;
    wing(ctx, 0, 0, -1, span, lift, U);
    wing(ctx, 0, 0, 1, span, lift, U);
    ctx.fillStyle = '#f0ead8';
    poly(ctx, [-U * 1.1, U * 3, U * 1.1, U * 3, U * 2, U * 8, 0, U * 7, -U * 2, U * 8]);
    ctx.fillStyle = INK;
    blob(ctx, 0, U * 1.5, U * 2.2, U * 4);
    ctx.fillStyle = '#3a3030';
    blob(ctx, U * 0.3, -U * 2.2, U * 1.7, U * 1.5);
    ctx.fillStyle = '#e0a63a';
    poly(ctx, [U * 0.9, -U * 2.7, U * 3.2, -U * 1.7, U * 1.2, -U * 0.8]);
    ctx.fillStyle = '#f0ead8';
    blob(ctx, 0, -U * 1.0, U * 1.1, U * 0.5);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- glints and run ------------------------------------------------------

  function makeGlints(g, rand) {
    const out = new Float32Array(GLINTS * 3);
    for (let i = 0; i < GLINTS; i++) {
      const f = rand();
      out[i * 3] = g.sx + (rand() - 0.5) * g.U * (6 + f * 30);
      out[i * 3 + 1] = g.wy + g.U * (1 + f * 22);
      out[i * 3 + 2] = rand() * TAU;
    }
    return out;
  }

  function drawGlints(ctx, g, t) {
    const G = state.glints;
    ctx.fillStyle = '#f5d9a0';
    for (let i = 0; i < GLINTS; i++) {
      const a = Math.sin(t * 0.8 + G[i * 3 + 2]);
      if (a < 0.2) continue;
      ctx.globalAlpha = a * 0.7;
      ctx.fillRect(G[i * 3], G[i * 3 + 1], g.U * (1 + a), Math.max(1, g.U * 0.2));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g);
    state.cloud = paintCloud(g, rand);
    state.sea = paintSea(g);
    state.ice = paintIce(g, rand);
    state.front = paintFront(g, rand);
    state.glints = makeGlints(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { flap, cloud } = api.props;
    ctx.drawImage(state.back, 0, 0);
    const off = (t * g.U * 0.5 * cloud) % g.W;
    ctx.drawImage(state.cloud, -off, 0);
    ctx.drawImage(state.cloud, g.W - off, 0);
    ctx.drawImage(state.sea, 0, g.wy);
    drawGlints(ctx, g, t);
    ctx.drawImage(state.ice, -g.U * 2 + Math.sin(t * 0.07) * g.U * 1.6, g.wy);
    drawEagle(ctx, g, t, flap);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { flap: 1, cloud: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
