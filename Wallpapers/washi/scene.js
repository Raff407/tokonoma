/*
 * Washi, a sea eagle over snowy peaks and a bay of drift ice at dawn.
 *
 * Sky, sun, peaks, ice and the torii are baked once. Cloud is one tiling strip
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

  // [centre x (of W), summit y (of H), half width (of W), spine lean]
  const NEAR = [
    [0.26, 0.25, 0.24, 0.2], [0.04, 0.33, 0.17, -0.12], [0.5, 0.36, 0.15, 0.12],
    [0.93, 0.28, 0.22, -0.18], [0.79, 0.42, 0.12, 0.15],
  ];
  const FAR = [
    [0.16, 0.36, 0.12, 0.1], [0.4, 0.38, 0.11, -0.1], [0.62, 0.42, 0.08, 0.1],
    [0.76, 0.34, 0.1, -0.1], [1.0, 0.36, 0.1, 0.1],
  ];

  function slopePts(g, x0, y0, x1, y1, seed, rough) {
    const pts = [];
    const n = 9;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const j = (fbm(f * 3.1, seed, 2, 5) - 0.5) * rough;
      // a shoulder part way down keeps the slope from being a ruler line
      const sh = Math.sin(f * Math.PI) * rough * 0.35;
      pts.push(lerp(x0, x1, f) + j * 0.4, lerp(y0, y1, Math.pow(f, 0.85)) + j - sh);
    }
    return pts;
  }

  function face(ctx, a) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    for (let i = 2; i < a.length; i += 2) ctx.lineTo(a[i], a[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function paintPeak(ctx, g, p, far, seed) {
    const U = g.U;
    const cx = p[0] * g.W;
    const top = p[1] * g.H;
    const hw = p[2] * g.W;
    const base = g.wy + 1;
    const sunLeft = g.sx < cx; // the face toward the sun is warm
    const lit = far ? '#dcc2b6' : '#f3dcc6';
    const shade = far ? '#a4a6c0' : '#a8aecb';
    const spineX = cx + hw * p[3];
    const rough = U * (far ? 1.6 : 2.6);
    const left = slopePts(g, cx, top, cx - hw, base, seed, rough);
    const right = slopePts(g, cx, top, cx + hw, base, seed + 3.7, rough);
    ctx.fillStyle = sunLeft ? lit : shade;
    face(ctx, [cx, top, ...left, cx - hw, base, spineX, base]);
    ctx.fillStyle = sunLeft ? shade : lit;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(spineX, base);
    ctx.lineTo(cx + hw, base);
    for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
    ctx.closePath();
    ctx.fill();
    // bare rock below a ragged snow line, clipped to the peak
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, top);
    for (let i = 0; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
    ctx.lineTo(cx - hw, base);
    ctx.lineTo(cx + hw, base);
    for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
    ctx.closePath();
    ctx.clip();
    const snowY = lerp(top, base, far ? 0.62 : 0.55);
    ctx.fillStyle = far ? '#5e6488' : '#3c4266';
    ctx.beginPath();
    ctx.moveTo(cx - hw, base);
    const stepX = Math.max(1, U * 1.2);
    for (let x = cx - hw; x <= cx + hw; x += stepX) {
      const v = fbm(x / (U * 3), seed + 9, 3, 7);
      const tooth = (Math.floor(x / stepX) % 2) * U * 1.6;
      ctx.lineTo(x, snowY + (v - 0.5) * U * 10 + tooth);
    }
    ctx.lineTo(cx + hw, base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // couloirs: short dark strokes following the fall line on both faces
    ctx.strokeStyle = far ? 'rgba(98,104,140,0.55)' : 'rgba(84,92,130,0.6)';
    ctx.lineWidth = Math.max(1, U * 0.45);
    ctx.lineCap = 'round';
    const n = far ? 3 : 6;
    for (let k = 0; k < n; k++) {
      const side = k % 2 ? 1 : -1;
      const f = 0.25 + (k / n) * 0.55;
      const sx = cx + side * hw * f * 0.55;
      const sy = top + (base - top) * f * 0.6 + U * 2;
      const len = (base - top) * (0.18 + 0.1 * fbm(k, seed, 1, 3));
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + side * len * 0.35, sy + len * 0.5, sx + side * len * 0.55, sy + len);
      ctx.stroke();
    }
    // the spine catches the light
    ctx.strokeStyle = far ? 'rgba(236,220,210,0.7)' : 'rgba(250,240,226,0.85)';
    ctx.lineWidth = Math.max(1, U * 0.4);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(lerp(cx, spineX, 0.5), lerp(top, base, 0.5));
    ctx.stroke();
  }

  function paintForest(ctx, g, far) {
    const U = g.U;
    ctx.fillStyle = far ? '#6a7396' : '#3e4868';
    ctx.beginPath();
    ctx.moveTo(0, g.wy + 1);
    for (let x = 0; x <= g.W; x += Math.max(1, U * 0.8)) {
      const h = U * (far ? 3 : 6) * (0.6 + fbm(x / (U * 5), far ? 1.7 : 4.4, 3, 5));
      const tooth = (Math.floor(x / Math.max(1, U * 0.8)) % 2) * U * 0.8;
      ctx.lineTo(x, g.wy - h - tooth);
    }
    ctx.lineTo(g.W, g.wy + 1);
    ctx.closePath();
    ctx.fill();
  }

  function paintRange(ctx, g, far) {
    const list = far ? FAR : NEAR;
    for (let i = 0; i < list.length; i++) paintPeak(ctx, g, list[i], far, (far ? 11 : 31) + i * 5.3);
    paintForest(ctx, g, far);
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
    const haze = ctx.createLinearGradient(0, g.wy - g.U * 14, 0, g.wy);
    haze.addColorStop(0, 'rgba(120,126,160,0)');
    haze.addColorStop(1, 'rgba(120,126,160,0.4)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, g.wy - g.U * 14, g.W, g.U * 14 + 1);
    return c;
  }

  // ---- cloud strip ---------------------------------------------------------

  function paintCloud(g, rand) {
    const c = layer(g.W, g.H * 0.4);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.04 + rand() * 0.11);
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

  // ---- torii on the shore ice ---------------------------------------------

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

  function paintFront(g) {
    const c = layer(g.W, g.H);
    paintTorii(c.getContext('2d'), g);
    return c;
  }

  // ---- the eagle -----------------------------------------------------------
  // Steller's sea eagle seen from below: a broad dark plank of a wing with a bent
  // wrist and five fingered primaries, white shoulders, a white wedge tail and a
  // heavy orange bill. Points are written into one reused array, never allocated.

  const WP = new Float32Array(40);
  let wn = 0;
  let ws = 1;

  function put(x, y) {
    WP[wn++] = ws * x;
    WP[wn++] = y;
  }

  function wingShape(s, L, U, lift) {
    const wy = -lift * L * 0.22; // wrist rises with the beat
    const ty = -lift * L * 0.42; // tip rises further, a little behind
    wn = 0;
    ws = s;
    put(U * 1.6, -U * 2.2); // root, leading edge
    put(L * 0.3, wy * 0.6 - U * 3.2);
    put(L * 0.5, wy - U * 3.4); // wrist, the bend in the leading edge
    put(L * 0.74, ty * 0.8 - U * 2.0);
    // five primaries spread like fingers, notched between
    for (let k = 0; k < 4; k++) {
      const fx = L * (1.0 - k * 0.07);
      const fy = ty - U * 1.6 + k * U * 2.2;
      put(fx, fy);
      put(fx - U * 3.6, fy + U * 1.3);
    }
    put(L * 0.62, wy * 0.9 + U * 4.4); // trailing edge, slight S
    put(L * 0.38, wy * 0.55 + U * 5.6);
    put(U * 1.6, U * 5.0);
    return wn;
  }

  function fillPts(ctx, n) {
    ctx.beginPath();
    ctx.moveTo(WP[0], WP[1]);
    for (let i = 2; i < n; i += 2) ctx.lineTo(WP[i], WP[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function wing(ctx, s, L, U, lift) {
    ctx.fillStyle = INK;
    fillPts(ctx, wingShape(s, L, U, lift));
    // white shoulder band along the inner leading edge
    const wy = -lift * L * 0.22;
    ctx.fillStyle = '#f0ead8';
    ctx.beginPath();
    ctx.moveTo(s * U * 1.8, -U * 1.6);
    ctx.lineTo(s * L * 0.3, wy * 0.6 - U * 2.6);
    ctx.lineTo(s * L * 0.46, wy - U * 2.6);
    ctx.lineTo(s * L * 0.42, wy - U * 0.6);
    ctx.lineTo(s * L * 0.22, wy * 0.45 + U * 0.6);
    ctx.lineTo(s * U * 1.8, U * 1.2);
    ctx.closePath();
    ctx.fill();
    // a paler grey on the flight feathers so the wing is not one flat slab
    ctx.fillStyle = '#3a3e52';
    ctx.beginPath();
    ctx.moveTo(s * L * 0.3, wy * 0.6 + U * 2.4);
    ctx.lineTo(s * L * 0.6, wy * 0.9 + U * 1.6);
    ctx.lineTo(s * L * 0.62, wy * 0.9 + U * 4.0);
    ctx.lineTo(s * L * 0.38, wy * 0.55 + U * 5.0);
    ctx.closePath();
    ctx.fill();
  }

  function drawEagle(ctx, g, t, flap) {
    const U = g.U * 1.25;
    const bx = g.W * (0.42 + 0.1 * Math.sin(t * 0.05));
    const by = g.H * (0.3 + 0.03 * Math.sin(t * 0.11));
    const beat = Math.sin(t * 0.9 * (0.4 + flap * 0.6));
    const gate = Math.min(1, Math.max(0, Math.sin(t * 0.25) * 1.5 + 0.8));
    const lift = 0.12 + beat * gate * Math.min(1, flap) * 0.55; // glide holds a shallow V
    const bank = Math.cos(t * 0.05) * 0.08;
    ctx.setTransform(Math.cos(bank), Math.sin(bank), -Math.sin(bank), Math.cos(bank), bx, by);
    const L = U * 22;
    wing(ctx, -1, L, U, lift);
    wing(ctx, 1, L, U, lift);
    // white wedge tail
    ctx.fillStyle = '#f0ead8';
    poly(ctx, [-U * 1.6, U * 4, U * 1.6, U * 4, U * 3.4, U * 11, 0, U * 12.2, -U * 3.4, U * 11]);
    // body, white thighs, yellow feet tucked under
    ctx.fillStyle = INK;
    blob(ctx, 0, U * 1.4, U * 2.6, U * 5.2);
    ctx.fillStyle = '#e6ddc8';
    blob(ctx, -U * 1.3, U * 4.2, U * 1.0, U * 1.3);
    blob(ctx, U * 1.3, U * 4.2, U * 1.0, U * 1.3);
    ctx.fillStyle = '#e0a63a';
    blob(ctx, 0, U * 6.2, U * 1.3, U * 0.7);
    // head and the great bill
    ctx.fillStyle = '#2e2a30';
    blob(ctx, 0, -U * 4.6, U * 1.9, U * 2.0);
    ctx.fillStyle = '#e2902e';
    poly(ctx, [-U * 1.2, -U * 5.6, U * 1.2, -U * 5.6, U * 0.6, -U * 8.4, 0, -U * 8.9, -U * 0.6, -U * 8.4]);
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
    state.front = paintFront(g);
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
