/*
 * 弘前 Hirosaki — a castle moat blanketed in fallen cherry petals.
 *
 * Sky, hills, wall, the small keep, the petal carpet, the bridge and the blossom
 * boughs are each baked once. Per frame: a pool of falling petals, a pool of petals
 * sliding over the water, and a few glints in the gaps of the carpet.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.64;
  const SKY = ['#cfd0cb', '#dcd8cd', '#e8e0d0', '#efe5d3'];
  const STONE = ['#9a9788', '#837f72', '#aaa696', '#6f6c62'];
  const PETAL = ['#f0dcd6', '#e8cac6', '#f4e8e0', '#d9b0ae'];
  const BOUGH = '#3a2e28';
  const BLOOM = ['#e6c0bd', '#efd4cf', '#f6e8e2', '#d3a6a6'];
  const VERM = '#c24a32';
  const VERM_DARK = '#8e3326';
  const MAX_FALL = 56;
  const MAX_DRIFT = 36;
  const GLINTS = 14;
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
    return { W, H, U, u, wy, cx: W * 0.6, wallTop: Math.round(H * 0.47) };
  }

  // ---- sky, hills, pines ---------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.wy);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.wy; y++) {
      const f = Math.min(1, y / (g.H * 0.5)) * (inks.length - 1);
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
    // Iwaki-san, a soft blue hill far behind the keep
    ctx.fillStyle = '#aab3b8';
    ctx.beginPath();
    ctx.moveTo(0, g.wallTop);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const peak = Math.exp(-(((x - g.W * 0.22) / (g.W * 0.2)) ** 2));
      ctx.lineTo(x, g.H * 0.4 - peak * g.H * 0.12 + fbm(x / (g.U * 30), 2.2, 3, 9) * g.H * 0.03);
    }
    ctx.lineTo(g.W, g.wallTop);
    ctx.fill();
    ctx.fillStyle = '#c4c9c6';
    for (let i = 0; i < 4; i++) {
      blob(ctx, g.W * (0.1 + rand() * 0.8), g.H * (0.12 + rand() * 0.14), g.U * (10 + rand() * 12), g.U * 0.7);
    }
    return c;
  }

  // A black pine on the bank: leaning trunk, flat tiers of needles.
  function pine(ctx, x, y, h, rand) {
    const lean = h * (rand() - 0.4) * 0.3;
    ctx.strokeStyle = '#3a3128';
    ctx.lineWidth = Math.max(1, h * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - lean, y - h * 0.5, x + lean, y - h * 0.9);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const f = 0.4 + i * 0.22;
      const side = i % 2 ? 1 : -1;
      const px = x + lean * f + side * h * 0.1;
      const py = y - h * f;
      const w = h * (0.3 - f * 0.12);
      ctx.fillStyle = '#2d4034';
      blob(ctx, px, py, w, w * 0.4);
      ctx.fillStyle = '#42584a';
      blob(ctx, px - w * 0.15, py - w * 0.15, w * 0.7, w * 0.25);
    }
  }

  // ---- wall and keep -------------------------------------------------------

  function paintWall(ctx, g, rand) {
    const top = g.wallTop;
    const bottom = g.wy;
    ctx.fillStyle = '#5c5a50';
    ctx.fillRect(0, top, g.W, bottom - top);
    const rowH = Math.max(1.4, g.U * 1.5);
    let y = top;
    let row = 0;
    while (y < bottom) {
      const h = rowH * (0.8 + rand() * 0.4);
      let x = -(row % 2) * rowH * 1.4 - rand() * rowH;
      while (x < g.W) {
        const w = rowH * (1.5 + rand() * 1.8);
        ctx.fillStyle = STONE[Math.floor(rand() * STONE.length)];
        ctx.fillRect(x + 0.3, y + 0.3, w - 0.6, h - 0.5);
        x += w;
      }
      y += h;
      row++;
    }
    // earth bank and clipped pine on the crest
    ctx.fillStyle = '#4b5a43';
    ctx.fillRect(0, top - g.U * 1.2, g.W, g.U * 1.3);
    ctx.fillStyle = '#6a7a58';
    for (let x = 0; x < g.W; x += g.U * 1.6) blob(ctx, x, top - g.U * 1.1, g.U * 1.1, g.U * 0.5);
    for (let x = g.W * 0.04; x < g.W; x += g.U * (14 + rand() * 12)) {
      if (Math.abs(x - g.cx) < g.u * 14) continue;
      pine(ctx, x, top - g.U * 0.6, g.U * (8 + rand() * 5), rand);
    }
  }

  function roofTier(ctx, cx, y, hw, hh, tone) {
    ctx.fillStyle = tone[0];
    poly(ctx, [cx - hw, y, cx - hw * 0.62, y - hh, cx + hw * 0.62, y - hh, cx + hw, y]);
    ctx.fillStyle = tone[1];
    ctx.fillRect(cx - hw, y - 0.2, hw * 2, Math.max(1, hh * 0.18));
    ctx.fillStyle = tone[2];
    for (let i = 1; i < 3; i++) {
      ctx.fillRect(cx - hw * (1 - i * 0.12), y - hh * (i / 3.2), hw * 2 * (1 - i * 0.12), 0.5);
    }
  }

  function paintKeep(ctx, g) {
    const u = g.u * 1.4;
    const cx = g.cx;
    const base = g.wallTop - g.U * 0.9;
    const tone = ['#5b6a68', '#3a4342', '#78857f'];
    const tiers = [
      { hw: u * 7.2, wh: u * 4.2, roofH: u * 3.2 },
      { hw: u * 5.4, wh: u * 3.6, roofH: u * 2.8 },
      { hw: u * 3.6, wh: u * 3.2, roofH: u * 3.4 },
    ];
    let y = base;
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const wallW = t.hw * 0.78;
      ctx.fillStyle = '#ece6d6';
      ctx.fillRect(cx - wallW, y - t.wh, wallW * 2, t.wh);
      ctx.fillStyle = '#c9c2ae';
      ctx.fillRect(cx + wallW * 0.55, y - t.wh, wallW * 0.45, t.wh);
      // shuttered windows
      ctx.fillStyle = '#3d3a34';
      const n = i === 2 ? 2 : 3 + (i === 0 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const wx = cx - wallW * 0.75 + (k + 0.5) * ((wallW * 1.5) / n);
        ctx.fillRect(wx - u * 0.45, y - t.wh * 0.72, u * 0.9, t.wh * 0.42);
      }
      ctx.fillStyle = '#2e2b27';
      ctx.fillRect(cx - wallW, y - t.wh, wallW * 2, Math.max(0.6, u * 0.3));
      y -= t.wh;
      if (i === 2) {
        roofTier(ctx, cx, y, t.hw, t.roofH, tone);
        // gable and finial roofs read as the hip crest
        ctx.fillStyle = '#d2a94a';
        poly(ctx, [cx - t.hw * 0.55, y - t.roofH, cx - t.hw * 0.55 - u * 0.8, y - t.roofH - u * 1.3, cx - t.hw * 0.55 + u * 0.6, y - t.roofH]);
        poly(ctx, [cx + t.hw * 0.55, y - t.roofH, cx + t.hw * 0.55 + u * 0.8, y - t.roofH - u * 1.3, cx + t.hw * 0.55 - u * 0.6, y - t.roofH]);
      } else {
        roofTier(ctx, cx, y, t.hw * 1.35, t.roofH, tone);
        y -= t.roofH * 0.55;
      }
    }
    // low turret to the side
    const sx = cx - u * 13;
    ctx.fillStyle = '#e4ddcb';
    ctx.fillRect(sx - u * 2.8, base - u * 3.6, u * 5.6, u * 3.6);
    ctx.fillStyle = '#3d3a34';
    ctx.fillRect(sx - u * 0.5, base - u * 2.6, u * 1, u * 1.2);
    roofTier(ctx, sx, base - u * 3.6, u * 4.6, u * 2.4, tone);
  }

  // ---- water ---------------------------------------------------------------

  function paintWater(g, rand, wallImg) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const h = g.H - g.wy;
    // dark moat water with a faint flipped wall reflection
    ctx.fillStyle = '#3b4a4c';
    ctx.fillRect(0, g.wy, g.W, h);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate(0, g.wy * 2);
    ctx.scale(1, -1);
    ctx.drawImage(wallImg, 0, 0, g.W, g.wy, 0, 0, g.W, g.wy);
    ctx.restore();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#2d3b3f';
    ctx.fillRect(0, g.wy, g.W, h);
    ctx.globalAlpha = 1;
    // the carpet of petals, denser nearer the wall and thinning at the near edge
    const img = ctx.getImageData(0, g.wy, g.W, h);
    const d = img.data;
    const pal = PETAL.map(K.parseColor);
    for (let y = 0; y < h; y++) {
      const f = y / h;
      const sy = 1 + f * 0.9;
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.U * 2.6 * sy), y / (g.U * 1.8 * sy), 3, 71);
        const thresh = 0.43 + f * 0.06;
        if (n > thresh && rand() < 0.97) {
          const grain = rand();
          const ink = pal[grain < 0.55 ? 0 : grain < 0.8 ? 1 : grain < 0.92 ? 2 : 3];
          const edge = smoothstep(thresh, thresh + 0.08, n);
          const i = (y * g.W + x) * 4;
          const k = 0.35 + 0.65 * edge;
          d[i] = d[i] + (ink[0] - d[i]) * k;
          d[i + 1] = d[i + 1] + (ink[1] - d[i + 1]) * k;
          d[i + 2] = d[i + 2] + (ink[2] - d[i + 2]) * k;
        }
      }
    }
    ctx.putImageData(img, 0, g.wy);
    return c;
  }

  function makeGlints(g, rand) {
    const out = [];
    for (let i = 0; i < GLINTS; i++) {
      out.push({
        x: rand() * g.W,
        y: g.wy + g.U * (2 + rand() * (100 * (1 - WATER) - 3)),
        w: g.U * (1.6 + rand() * 2.4),
        p: rand() * TAU,
        s: 0.4 + rand() * 0.6,
      });
    }
    return out;
  }

  // ---- bridge --------------------------------------------------------------

  function paintBridge(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.u;
    const x0 = g.W * 0.14;
    const x1 = x0 + u * 36;
    const dy = g.wy + g.U * 6.5;
    const rise = u * 8;
    const hw = (x1 - x0) / 2;
    const mid = (x0 + x1) / 2;
    // stone abutments
    ctx.fillStyle = STONE[0];
    ctx.fillRect(x0 - u * 3, dy - u * 1.2, u * 3.4, g.U * 7);
    ctx.fillRect(x1 - u * 0.4, dy - u * 1.2, u * 3.4, g.U * 7);
    // arched deck
    ctx.fillStyle = VERM_DARK;
    ctx.beginPath();
    ctx.moveTo(x0, dy);
    ctx.quadraticCurveTo(mid, dy - rise * 2, x1, dy);
    ctx.lineTo(x1, dy + u * 1.5);
    ctx.quadraticCurveTo(mid, dy - rise * 2 + u * 1.5, x0, dy + u * 1.5);
    ctx.fill();
    // railing: posts and two rails following the arch
    const rail = (off, wd, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(x0, dy - off);
      ctx.quadraticCurveTo(mid, dy - rise * 2 - off, x1, dy - off);
      ctx.stroke();
    };
    rail(u * 3.2, Math.max(1, u * 0.7), VERM);
    rail(u * 1.8, Math.max(0.8, u * 0.4), VERM);
    ctx.fillStyle = VERM;
    const posts = 9;
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const px = x0 + (x1 - x0) * t;
      const arch = 2 * t * (1 - t) * rise * 2;
      ctx.fillRect(px - u * 0.35, dy - arch - u * 3.4, u * 0.7, u * 3.5);
      if (i % 3 === 0) {
        ctx.fillStyle = '#d6b050';
        blob(ctx, px, dy - arch - u * 3.7, u * 0.7, u * 0.7);
        ctx.fillStyle = VERM;
      }
    }
    // shadow on the water beneath
    ctx.fillStyle = 'rgba(30,40,44,0.5)';
    ctx.beginPath();
    ctx.ellipse(mid, dy + u * 2.6, hw * 0.9, u * 0.9, 0, 0, TAU);
    ctx.fill();
    return c;
  }

  // ---- blossoms overhead ---------------------------------------------------

  function cluster(ctx, x, y, r, rand) {
    for (let i = 0; i < 9; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d * 0.75;
      ctx.fillStyle = BLOOM[Math.floor(rand() * BLOOM.length)];
      blob(ctx, px, py, r * (0.28 + rand() * 0.22), r * (0.22 + rand() * 0.18));
    }
    ctx.fillStyle = BLOOM[2];
    blob(ctx, x - r * 0.25, y - r * 0.3, r * 0.3, r * 0.2);
  }

  function bough(ctx, g, rand, sx, sy, dirx, len, bend) {
    const u = g.u;
    let x = sx;
    let y = sy;
    let a = dirx > 0 ? 0.12 : Math.PI - 0.12;
    const steps = 18;
    const pts = [];
    for (let i = 0; i < steps; i++) {
      pts.push([x, y]);
      a += bend * (rand() - 0.4) * 0.18;
      x += Math.cos(a) * len / steps;
      y += Math.sin(a) * len / steps;
    }
    ctx.strokeStyle = BOUGH;
    for (let i = 1; i < pts.length; i++) {
      ctx.lineWidth = Math.max(0.8, u * 1.5 * (1 - i / pts.length) + 0.6);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    for (let i = 3; i < pts.length; i++) {
      const [px, py] = pts[i];
      cluster(ctx, px, py + u * 0.6, u * (4.5 + rand() * 3), rand);
      cluster(ctx, px + u * 2, py + u * 3, u * (3 + rand() * 2), rand);
      if (i % 2) {
        const tx = px + (rand() - 0.5) * u * 5;
        const ty = py + u * (2.5 + rand() * 4);
        ctx.strokeStyle = BOUGH;
        ctx.lineWidth = Math.max(0.7, u * 0.35);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        cluster(ctx, tx, ty, u * (2 + rand() * 1.5), rand);
      }
    }
  }

  function paintBoughs(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    bough(ctx, g, rand, -g.u * 2, g.H * 0.04, 1, g.W * 0.52, 1);
    bough(ctx, g, rand, g.W + g.u * 2, g.H * 0.02, -1, g.W * 0.38, -1);
    bough(ctx, g, rand, g.W * 0.35, -g.u * 2, 1, g.W * 0.2, 1);
    return c;
  }

  // ---- petals --------------------------------------------------------------

  function makePetals(n) {
    return {
      x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n),
      vy: new Float32Array(n), p: new Float32Array(n), s: new Float32Array(n),
      tone: new Uint8Array(n),
    };
  }

  function resetFall(g, P, i, scatter) {
    const r = state.rand;
    P.x[i] = r() * g.W;
    P.y[i] = scatter ? r() * g.wy : -g.U * (1 + r() * 8);
    P.vy[i] = g.U * (3 + r() * 3);
    P.vx[i] = g.U * (1.2 + r() * 1.5);
    P.p[i] = r() * TAU;
    P.s[i] = Math.max(1.6, g.U * (0.8 + r() * 0.7));
    P.tone[i] = Math.floor(r() * 3);
  }

  function resetDrift(g, P, i, scatter) {
    const r = state.rand;
    P.x[i] = scatter ? r() * g.W : -g.U * 3;
    P.y[i] = g.wy + g.U * (3 + r() * (100 * (1 - WATER) - 5));
    P.vx[i] = g.U * (1 + r() * 1.6);
    P.p[i] = r() * TAU;
    P.s[i] = Math.max(1.8, g.U * (0.9 + r() * 0.7));
    P.tone[i] = Math.floor(r() * 3);
  }

  function stepFall(g, P, i, t, dt) {
    P.x[i] += (P.vx[i] + Math.sin(t * 0.9 + P.p[i]) * g.U * 1.6) * dt;
    P.y[i] += P.vy[i] * dt;
    if (P.y[i] > g.H + g.U || P.x[i] > g.W + g.U * 3) resetFall(g, P, i, false);
  }

  function stepDrift(g, P, i, t, dt) {
    P.x[i] += P.vx[i] * dt;
    P.y[i] += Math.sin(t * 0.5 + P.p[i]) * g.U * 0.12 * dt;
    if (P.x[i] > g.W + g.U * 3) resetDrift(g, P, i, false);
  }

  function drawPetals(ctx, P, count, t, flutter) {
    for (let i = 0; i < count; i++) {
      const s = P.s[i];
      const sq = flutter ? 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + P.p[i])) : 0.7;
      ctx.fillStyle = PETAL[P.tone[i]];
      ctx.fillRect(P.x[i], P.y[i], s * (flutter ? sq + 0.5 : 1.4), s * (flutter ? 1 : 0.7));
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const bc = back.getContext('2d');
    bc.drawImage(paintSky(g, rand), 0, 0);
    paintWall(bc, g, rand);
    paintKeep(bc, g);
    state.back = back;
    state.water = paintWater(g, rand, back);
    state.bridge = paintBridge(g);
    state.boughs = paintBoughs(g, rand);
    state.glints = makeGlints(g, rand);
    state.fall = makePetals(MAX_FALL);
    state.drift = makePetals(MAX_DRIFT);
    for (let i = 0; i < MAX_FALL; i++) resetFall(g, state.fall, i, true);
    for (let i = 0; i < MAX_DRIFT; i++) resetDrift(g, state.drift, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, drift } = api.props;
    const nf = Math.min(MAX_FALL, Math.round(40 * petals));
    const nd = Math.min(MAX_DRIFT, Math.round(28 * drift));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < nf; i++) stepFall(g, state.fall, i, t, step);
    for (let i = 0; i < nd; i++) stepDrift(g, state.drift, i, t, step * drift);
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.water, 0, g.wy, g.W, g.H - g.wy, 0, g.wy, g.W, g.H - g.wy);
    ctx.drawImage(state.bridge, 0, 0);
    ctx.fillStyle = '#8fa2a2';
    for (let i = 0; i < GLINTS; i++) {
      const q = state.glints[i];
      ctx.globalAlpha = 0.18 + 0.18 * Math.sin(t * q.s + q.p);
      ctx.fillRect(q.x, q.y, q.w, Math.max(1, g.U * 0.25));
    }
    ctx.globalAlpha = 1;
    drawPetals(ctx, state.drift, nd, t, false);
    ctx.drawImage(state.boughs, 0, 0);
    drawPetals(ctx, state.fall, nf, t, true);
  }

  Kasuri.run({
    defaults: { petals: 1, drift: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
