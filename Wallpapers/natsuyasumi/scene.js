/*
 * 夏休み Natsuyasumi — a country road in the summer holidays.
 *
 * Sky, ground and poles are baked into layers and repainted once a minute
 * from the clock. Between repaints only the cloud tower, a low wisp band,
 * strips of heat shimmer and soft bands of wind in the rice move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HY = 0.5;
  const VPX = 0.6;
  const BEND = -0.16;
  const NEAR_Z = 0.7;
  const FAR_Z = 70;
  const RETINT_SECONDS = 60;
  const POLES = [0.9, 1.5, 2.4, 3.8, 5.8, 8.6, 12.5, 18];
  const POLE_X = 1.55;
  const state = {};

  // Cloud puffs: x and y from the cloud base centre, radius, all in cloud widths.
  const PUFFS = [
    [-0.30, -0.03, 0.10], [-0.16, -0.04, 0.13], [0.0, -0.05, 0.14], [0.16, -0.04, 0.13], [0.30, -0.03, 0.09],
    [-0.24, -0.13, 0.12], [-0.08, -0.17, 0.15], [0.10, -0.16, 0.14], [0.25, -0.12, 0.10],
    [-0.15, -0.28, 0.12], [0.0, -0.32, 0.15], [0.15, -0.27, 0.11],
    [-0.06, -0.45, 0.12], [0.07, -0.47, 0.10], [-0.03, -0.58, 0.08],
  ];

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Screen point for sideways offset X at depth z. One unit is half the screen height.
  function pt(g, X, z) {
    const u = g.H * 0.5;
    return [g.W * (VPX + BEND * (1 - 1 / z)) + (X * u) / z, g.H * HY + u / z];
  }

  function tint(ctx, g, sky, amount) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = amount * (1 - sky.night);
    ctx.fillStyle = hex(sky.amb);
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalAlpha = 0.6 * sky.night;
    ctx.fillStyle = '#0d1226';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HY);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.45, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const day = 1 - sky.night;
    if (day > 0.05) {
      const sx = g.W * (0.12 + 0.76 * S.sunT(sky.hour));
      const sy = g.H * (0.34 - 0.26 * Math.sin(Math.PI * S.sunT(sky.hour)));
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, g.H * 0.5);
      glow.addColorStop(0, 'rgba(250,236,196,0.55)');
      glow.addColorStop(1, 'rgba(250,236,196,0)');
      ctx.globalAlpha = day;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, g.W, g.H * HY);
      ctx.globalAlpha = 1;
    } else {
      const mx = g.W * (0.12 + 0.76 * S.moonT(sky.hour));
      ctx.fillStyle = '#ece6d0';
      ctx.beginPath();
      ctx.arc(mx, g.H * 0.2, g.U * 2.2, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  // ---- cumulus -----------------------------------------------------------

  function puff(ctx, x, y, r, lit, mid, shade) {
    const grad = ctx.createRadialGradient(x - r * 0.15, y - r * 0.55, r * 0.1, x, y + r * 0.1, r * 1.05);
    grad.addColorStop(0, hex(lit));
    grad.addColorStop(0.6, hex(mid));
    grad.addColorStop(1, hex(mixColor(mid, shade, 0.55)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
  }

  function paintCumulus(g, sky) {
    const cw = Math.min(g.W * 0.52, g.H * 1.0);
    const base = g.H * 0.43;
    const c = layer(g.W, g.H * HY);
    const ctx = c.getContext('2d');
    const day = 1 - sky.night;
    const lit = mixColor(mixColor(rgb('#fbf8ee'), sky.amb, 0.35), rgb('#3a4262'), sky.night * 0.7);
    const mid = mixColor(mixColor(rgb('#dfe3e4'), sky.low, 0.25), rgb('#2a3150'), sky.night * 0.7);
    const shade = mixColor(mixColor(rgb('#9eaec0'), sky.low, 0.3), rgb('#1c2240'), sky.night * 0.75);
    const cx = g.W * 0.58;
    const rand = K.rng(17);
    for (let i = 0; i < PUFFS.length; i++) {
      const p = PUFFS[i];
      puff(ctx, cx + p[0] * cw, base + p[1] * cw, p[2] * cw * 1.15, lit, mid, shade);
      for (let k = 0; k < 5; k++) {
        const a = rand() * 6.283;
        const d = p[2] * (0.55 + rand() * 0.5);
        puff(ctx, cx + (p[0] + Math.cos(a) * d) * cw, base + (p[1] + Math.sin(a) * d * 0.8) * cw, p[2] * cw * (0.3 + rand() * 0.25), lit, mid, shade);
      }
    }
    // Flat grey underside, as a cumulus has.
    ctx.globalCompositeOperation = 'source-atop';
    const under = ctx.createLinearGradient(0, base - cw * 0.14, 0, base + cw * 0.08);
    under.addColorStop(0, 'rgba(120,138,168,0)');
    under.addColorStop(1, hex(mixColor(rgb('#7f90ae'), rgb('#1a2040'), sky.night * 0.7)));
    ctx.fillStyle = under;
    ctx.fillRect(0, base - cw * 0.14, g.W, cw * 0.3);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, base + cw * 0.03 * day + cw * 0.01, g.W, g.H);
    return c;
  }

  // Low wisps along the hills that tile sideways.
  function paintWisps(g, sky) {
    const w = Math.ceil(g.W * 1.3);
    const c = layer(w, g.H * 0.2);
    const ctx = c.getContext('2d');
    const col = mixColor(mixColor(rgb('#f4f1e6'), sky.amb, 0.3), rgb('#34395a'), sky.night * 0.75);
    const rand = K.rng(8);
    ctx.fillStyle = hex(col);
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + rand() * g.U * 6;
      const y = c.height * (0.3 + rand() * 0.5);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(x + k * g.U * 3, y - (k % 2) * g.U * 0.6, g.U * (3 + rand() * 3), g.U * (0.8 + rand() * 0.5), 0, 0, 6.3);
        ctx.fill();
      }
    }
    return c;
  }

  // ---- ground ------------------------------------------------------------

  function ridge(g, x, amp, seed, base) {
    return base - amp * (0.4 + fbm(x * 0.012, seed, 3, seed + 3) * 0.9);
  }

  function paintHills(ctx, g, sky) {
    const hy = g.H * HY;
    const layers = [
      { amp: g.H * 0.15, seed: 2, mix: 0.7, col: '#6f8a8a' },
      { amp: g.H * 0.1, seed: 7, mix: 0.45, col: '#4f6d57' },
      { amp: g.H * 0.05, seed: 12, mix: 0.2, col: '#3f5e3f' },
    ];
    for (const l of layers) {
      ctx.fillStyle = hex(mixColor(rgb(l.col), sky.haze, l.mix));
      for (let x = 0; x < g.W; x++) {
        const top = ridge(g, x, l.amp, l.seed, hy + g.H * 0.012);
        ctx.fillRect(x, top, 1, hy - top + 2);
      }
    }
    // A stand of sugi on the nearest ridge.
    const rand = K.rng(41);
    ctx.fillStyle = hex(mixColor(rgb('#2a4234'), sky.haze, 0.1));
    for (let i = 0; i < 26; i++) {
      const x = g.W * (0.02 + rand() * 0.34);
      const top = ridge(g, x, g.H * 0.05, 12, hy + g.H * 0.012);
      const h = g.U * (3 + rand() * 3);
      ctx.beginPath();
      ctx.moveTo(x, top - h * 0.6);
      ctx.lineTo(x + h * 0.22, top + g.U);
      ctx.lineTo(x - h * 0.22, top + g.U);
      ctx.fill();
    }
  }

  function strokeLine(ctx, g, X, z0, z1, steps) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const z = z0 * Math.pow(z1 / z0, i / steps);
      const p = pt(g, X, z);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }

  function paintPaddies(ctx, g, sky) {
    const hy = g.H * HY;
    const grad = ctx.createLinearGradient(0, hy, 0, g.H);
    grad.addColorStop(0, hex(mixColor(rgb('#6f9358'), sky.haze, 0.2)));
    grad.addColorStop(0.3, '#58803f');
    grad.addColorStop(1, '#3e6a38');
    ctx.fillStyle = grad;
    ctx.fillRect(0, hy, g.W, g.H - hy);
    // Rows of seedlings, converging on the hills.
    for (let X = -60; X <= 60; X += 0.36) {
      if (Math.abs(X) < 1.5) continue;
      ctx.strokeStyle = (Math.round(X / 0.36) % 2) ? 'rgba(36,76,40,0.38)' : 'rgba(150,186,96,0.3)';
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      strokeLine(ctx, g, X, NEAR_Z, FAR_Z, 14);
    }
    // Paddy bunds across the rows, with a bright strip of standing water beside some.
    const bunds = [1.7, 2.7, 4.3, 7, 12, 21, 36];
    for (const z of bunds) {
      const a = pt(g, -60, z);
      const b = pt(g, 60, z);
      const th = Math.max(1, (g.H * 0.5 * 0.05) / z);
      ctx.fillStyle = hex(mixColor(rgb('#9a9a68'), sky.haze, 0.2));
      ctx.fillRect(0, a[1] - th * 0.5, g.W, th);
      ctx.fillStyle = 'rgba(190,214,200,0.12)';
      ctx.fillRect(0, a[1] + th * 0.5, g.W, th * 0.5);
    }
  }

  function roadPath(g, half) {
    const p = new Path2D();
    for (let i = 0; i <= 14; i++) {
      const q = pt(g, -half, NEAR_Z * Math.pow(FAR_Z / NEAR_Z, i / 14));
      if (i === 0) p.moveTo(q[0], q[1]);
      else p.lineTo(q[0], q[1]);
    }
    for (let i = 14; i >= 0; i--) {
      const q = pt(g, half, NEAR_Z * Math.pow(FAR_Z / NEAR_Z, i / 14));
      p.lineTo(q[0], q[1]);
    }
    p.closePath();
    return p;
  }

  function paintRoad(ctx, g, sky) {
    const edge = [];
    ctx.fillStyle = hex(mixColor(rgb('#73777a'), sky.amb, 0.1));
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const p = pt(g, -1, NEAR_Z * Math.pow(FAR_Z / NEAR_Z, i / 16));
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    for (let i = 16; i >= 0; i--) {
      const p = pt(g, 1, NEAR_Z * Math.pow(FAR_Z / NEAR_Z, i / 16));
      ctx.lineTo(p[0], p[1]);
    }
    ctx.fill();
    edge.length = 0;
    // Concrete gutters either side and worn white edge lines.
    ctx.strokeStyle = hex(mixColor(rgb('#b5b3a6'), sky.haze, 0.2));
    ctx.lineWidth = Math.max(1, g.U * 1.2);
    strokeLine(ctx, g, -1.12, NEAR_Z, FAR_Z, 14);
    strokeLine(ctx, g, 1.12, NEAR_Z, FAR_Z, 14);
    ctx.strokeStyle = 'rgba(232,230,216,0.7)';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    strokeLine(ctx, g, -0.9, NEAR_Z, FAR_Z, 14);
    strokeLine(ctx, g, 0.9, NEAR_Z, FAR_Z, 14);
    // Patched tar and a soft pale glare toward the horizon.
    const hy = g.H * HY;
    const glare = ctx.createLinearGradient(0, hy, 0, hy + g.H * 0.2);
    glare.addColorStop(0, 'rgba(250,244,220,0.3)');
    glare.addColorStop(1, 'rgba(250,244,220,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
    return glare;
  }

  function paintFarmhouse(ctx, g, sky) {
    const z = 10;
    const u = g.H * 0.5 / z;
    const p = pt(g, -3.2, z);
    const wall = hex(mixColor(rgb('#e6e0cc'), sky.haze, 0.3));
    const roof = hex(mixColor(rgb('#3a4560'), sky.haze, 0.25));
    ctx.fillStyle = wall;
    ctx.fillRect(p[0] - u * 1.3, p[1] - u * 0.9, u * 2.6, u * 0.9);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(p[0] - u * 1.8, p[1] - u * 0.85);
    ctx.lineTo(p[0] - u * 0.9, p[1] - u * 1.7);
    ctx.lineTo(p[0] + u * 0.9, p[1] - u * 1.7);
    ctx.lineTo(p[0] + u * 1.8, p[1] - u * 0.85);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#2f4a38'), sky.haze, 0.1));
    ctx.beginPath();
    ctx.arc(p[0] + u * 2.3, p[1] - u * 0.9, u * 0.9, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p[0] - u * 2.4, p[1] - u * 0.7, u * 0.7, 0, 6.3);
    ctx.fill();
  }

  function paintGround(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHills(ctx, g, sky);
    paintPaddies(ctx, g, sky);
    paintFarmhouse(ctx, g, sky);
    const glare = paintRoad(ctx, g, sky);
    ctx.save();
    ctx.clip(roadPath(g, 1), 'nonzero');
    ctx.fillStyle = glare;
    ctx.fillRect(0, g.H * HY, g.W, g.H * 0.2);
    ctx.restore();
    tint(ctx, g, sky, 0.28);
    return c;
  }

  // ---- poles and flowers ---------------------------------------------------

  function wire(ctx, a, b, sag) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag, b[0], b[1]);
    ctx.stroke();
  }

  function paintPoles(ctx, g, sky) {
    const wood = hex(mixColor(rgb('#4a3b30'), sky.haze, 0.1));
    const arm = [-0.16, 0, 0.16];
    const lastTops = [null, null, null];
    for (let i = 0; i < POLES.length; i++) {
      const z = POLES[i];
      const p = pt(g, POLE_X, z);
      const h = g.H * 0.5 * 1.9 / z;
      const th = Math.max(1, (g.H * 0.5 * 0.1) / z);
      ctx.fillStyle = wood;
      ctx.fillRect(p[0] - th / 2, p[1] - h, th, h);
      ctx.fillRect(p[0] - th * 3, p[1] - h * 0.93, th * 6, Math.max(1, th * 0.7));
      ctx.fillRect(p[0] - th * 2.2, p[1] - h * 0.8, th * 4.4, Math.max(1, th * 0.5));
      if (i % 3 === 1) {
        ctx.fillStyle = hex(mixColor(rgb('#6d7078'), sky.haze, 0.1));
        ctx.fillRect(p[0] - th * 0.5, p[1] - h * 0.72, th * 2, th * 3);
      }
      ctx.strokeStyle = hex(mixColor(rgb('#232630'), sky.top, 0.2));
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const top = [p[0] + arm[k] * g.H * 0.5 / z * 1.6, p[1] - h * (k === 1 ? 0.98 : 0.935)];
        if (lastTops[k]) wire(ctx, lastTops[k], top, g.H * 0.05 / z);
        lastTops[k] = top;
      }
    }
    // Wires that come in from the near side.
    ctx.strokeStyle = hex(mixColor(rgb('#232630'), sky.top, 0.2));
    const first = pt(g, POLE_X, POLES[0]);
    for (let k = 0; k < 3; k++) {
      const a = [first[0] + g.W * 0.3, first[1] - g.H * 1.1];
      const b = [first[0] + arm[k] * g.H * 0.5 / POLES[0] * 1.6, first[1] - g.H * 0.5 * 1.9 / POLES[0] * (k === 1 ? 0.98 : 0.935)];
      wire(ctx, a, b, g.H * 0.1);
    }
  }

  function paintSunflower(ctx, g, x, base, top, r, sky) {
    ctx.strokeStyle = hex(mixColor(rgb('#4c6e38'), sky.haze, 0.1));
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + r * 0.5, (base + top) / 2, x + r * 0.3, top);
    ctx.stroke();
    ctx.fillStyle = hex(mixColor(rgb('#4c6e38'), sky.haze, 0.1));
    ctx.beginPath();
    ctx.ellipse(x - r * 0.9, (base + top) / 2 + r, r * 0.9, r * 0.35, -0.5, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * 1.1, (base + top) / 2 + r * 1.8, r * 0.9, r * 0.35, 0.5, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#d9a73a'), sky.haze, 0.08));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283;
      ctx.beginPath();
      ctx.ellipse(x + r * 0.3 + Math.cos(a) * r * 0.8, top + Math.sin(a) * r * 0.8, r * 0.5, r * 0.22, a, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = '#3a2a1c';
    ctx.beginPath();
    ctx.arc(x + r * 0.3, top, r * 0.5, 0, 6.3);
    ctx.fill();
  }

  function paintFront(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintPoles(ctx, g, sky);
    const flowers = [[0.05, 0.62, 4], [0.1, 0.7, 3.4], [0.015, 0.74, 3.8], [0.145, 0.8, 3]];
    for (const f of flowers) paintSunflower(ctx, g, g.W * f[0], g.H * 1.02, g.H * f[1], g.U * f[2], sky);
    tint(ctx, g, sky, 0.22);
    return c;
  }

  function paintWindTile(g) {
    const w = Math.ceil(g.W * 0.7);
    const c = layer(w, g.H * 0.5);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(236,244,170,0)');
    grad.addColorStop(0.5, 'rgba(236,244,170,0.34)');
    grad.addColorStop(1, 'rgba(236,244,170,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, c.height);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.cumulus = paintCumulus(g, sky);
    state.wisps = paintWisps(g, sky);
    state.ground = paintGround(g, sky);
    state.front = paintFront(g, sky);
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function buildRoadClip(g) {
    const p = new Path2D();
    p.rect(0, g.H * HY, g.W, g.H);
    const a = pt(g, -1.12, NEAR_Z);
    p.moveTo(a[0], a[1]);
    for (let i = 1; i <= 12; i++) {
      const q = pt(g, -1.12, NEAR_Z * Math.pow(FAR_Z / NEAR_Z, i / 12));
      p.lineTo(q[0], q[1]);
    }
    for (let i = 12; i >= 0; i--) {
      const q = pt(g, 1.12, NEAR_Z * Math.pow(FAR_Z / NEAR_Z, i / 12));
      p.lineTo(q[0], q[1]);
    }
    p.closePath();
    return p;
  }

  // ---- motion ------------------------------------------------------------

  function drawShimmer(ctx, g, t, heat) {
    if (heat <= 0) return;
    const hy = g.H * HY;
    const strip = Math.max(2, Math.round(g.U * 1.1));
    const y0 = Math.floor(hy - g.H * 0.03);
    const y1 = Math.floor(hy + g.H * 0.16);
    for (let y = y0; y < y1; y += strip) {
      const d = (y - hy) / (g.H * 0.16);
      const fall = d < 0 ? 0.5 : 1 - d;
      const off = Math.sin(t * 1.6 + y * 0.45) * g.U * 0.8 * heat * fall + Math.sin(t * 0.7 + y * 0.12) * g.U * 0.35 * heat * fall;
      ctx.drawImage(state.ground, 0, y, g.W, strip, off, y, g.W, strip);
    }
  }

  function drawWind(ctx, g, t) {
    const tile = state.wind;
    const w = tile.width;
    const hy = g.H * HY;
    ctx.save();
    ctx.clip(state.roadClip, 'evenodd');
    const off = (t * g.U * 3.5) % (w * 1.5);
    for (let k = 0; k < 2; k++) {
      ctx.globalAlpha = (0.55 + 0.45 * Math.sin(t * 0.3 + k * 2)) * (1 - state.dim * 0.4);
      ctx.drawImage(tile, -w + off + k * w * 1.5, hy + g.H * 0.04);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.wind = paintWindTile(g);
    state.roadClip = buildRoadClip(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    // The tower breathes slowly: a gentle sideways sway and rise.
    ctx.drawImage(state.cumulus, Math.sin(t * 0.11) * g.U * 2.2, Math.sin(t * 0.13) * g.U * 0.5);
    const w = state.wisps.width;
    const off = -((t * g.U * 0.9) % w);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(state.wisps, off, g.H * HY - state.wisps.height * 0.95);
    ctx.drawImage(state.wisps, off + w, g.H * HY - state.wisps.height * 0.95);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.ground, 0, 0);
    drawShimmer(ctx, g, t, props.heat);
    if (props.wind) drawWind(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', heat: 1, wind: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
