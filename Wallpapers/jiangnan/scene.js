/*
 * 江南 Jiangnan — a misty southern river village.
 *
 * Sky, hills, pagoda, whitewashed houses with stepped gables, the stone arch bridge and
 * the far willow are baked into layers and repainted once a minute from the clock.
 * The canal is that world flipped and laid back in thin rows that slide sideways.
 * Between repaints only mist, willow strands, the moored boat and a few ripples move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, fbm, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.6;
  const RETINT_SECONDS = 60;
  const SEG = 6;
  const RIPPLES = 3;
  const NIGHT_INK = parseColor('#1a2038');
  const GLOW = '#e2b65a';
  const HOUSES = [
    { a: -0.02, b: 0.19, wall: 20, roof: 7, win: [0.35, 0.68], door: 0.52, lantern: 0.83 },
    { a: 0.19, b: 0.36, wall: 24, roof: 8, win: [0.28, 0.62], door: 0.82, lantern: 0.12 },
    { a: 0.36, b: 0.5, wall: 18, roof: 6.5, win: [0.3, 0.7], door: 0.5, lantern: 0.9 },
    { a: 0.86, b: 1.03, wall: 22, roof: 7.5, win: [0.3, 0.66], door: 0.48, lantern: 0.1 },
  ];
  // Willow branches: x as a fraction of width, y in units of one hundredth of the height.
  const BRANCHES = [
    [0.11, 36, 0.2, 20, 0.34, 14, 2.4],
    [0.11, 36, 0.06, 22, 0.0, 12, 2.2],
    [0.11, 36, 0.15, 16, 0.2, 3, 1.8],
    [0.12, 34, 0.25, 30, 0.42, 24, 1.6],
  ];
  const STRAND_COUNT = 30;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const rgb = (h) => parseColor(h);

  // A colour lit by the sky and darkened toward night.
  function tone(h, sky, lit, dark) {
    const c = mixColor(rgb(h), sky.amb, lit === undefined ? 0.2 : lit);
    return toHex(mixColor(c, NIGHT_INK, sky.night * (dark === undefined ? 0.5 : dark) ));
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, wy: Math.round(H * WATER) };
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function glowAt(ctx, x, y, r, alpha) {
    if (alpha <= 0.02) return;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(226,182,90,${alpha})`);
    grad.addColorStop(1, 'rgba(226,182,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---- sky, hills, pagoda ------------------------------------------------

  function paintPagoda(ctx, g, sky) {
    const U = g.U;
    const cx = g.W * 0.46;
    const base = U * 45;
    ctx.fillStyle = toHex(mixColor(mixColor(sky.haze, rgb('#2c3e5a'), 0.55), NIGHT_INK, sky.night * 0.3));
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 5; i++) {
      const w = (7.2 - i * 0.95) * U;
      const top = base - (i + 1) * 3.7 * U;
      ctx.fillRect(cx - w * 0.3, top + U, w * 0.6, 2.9 * U);
      poly(ctx, [
        cx - w / 2 - 0.9 * U, top + 0.6 * U,
        cx - w / 2, top + 1.5 * U,
        cx + w / 2, top + 1.5 * U,
        cx + w / 2 + 0.9 * U, top + 0.6 * U,
        cx + w * 0.28, top,
        cx - w * 0.28, top,
      ]);
    }
    ctx.fillRect(cx - 0.2 * U, base - 5 * 3.7 * U - 3 * U, 0.4 * U, 3.2 * U);
    ctx.globalAlpha = 1;
  }

  function paintHills(ctx, g, sky) {
    const U = g.U;
    const far = toHex(mixColor(sky.haze, sky.top, 0.3));
    const near = toHex(mixColor(sky.haze, sky.low, 0.35));
    const rows = [
      { base: 38, amp: 7, seed: 3, ink: far },
      { base: 46, amp: 5, seed: 8, ink: near },
    ];
    for (const r of rows) {
      ctx.fillStyle = r.ink;
      ctx.beginPath();
      ctx.moveTo(0, g.wy);
      for (let x = 0; x <= g.W + 2; x += 2) {
        ctx.lineTo(x, U * r.base + (fbm(x * 0.012, r.seed, 3, r.seed) - 0.5) * U * r.amp * 2);
      }
      ctx.lineTo(g.W, g.wy);
      ctx.closePath();
      ctx.fill();
      if (r.seed === 3) paintPagoda(ctx, g, sky);
    }
  }

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy * 0.85);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.35; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.U * 34, 1, 1);
      }
      ctx.globalAlpha = sky.night * 0.85;
      ctx.fillStyle = '#ece6cf';
      ctx.beginPath();
      ctx.arc(g.W * 0.8, g.U * 14, g.U * 2.8, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    paintHills(ctx, g, sky);
    const haze = ctx.createLinearGradient(0, g.U * 34, 0, g.wy);
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(1, `rgba(${sky.haze.map(Math.round).join(',')},0.55)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, g.U * 34, g.W, g.wy - g.U * 34);
    return c;
  }

  // ---- houses ------------------------------------------------------------

  function paintStains(ctx, g, sky, rand, x0, w, top, base) {
    ctx.fillStyle = tone('#3a3f3c', sky, 0.1, 0.4);
    for (let i = 0; i < w / (g.U * 3.2); i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.06;
      ctx.fillRect(x0 + rand() * w, top + g.U, 1, g.U * (3 + rand() * 9));
    }
    const damp = ctx.createLinearGradient(0, base - g.U * 5, 0, base);
    damp.addColorStop(0, 'rgba(70,86,76,0)');
    damp.addColorStop(1, 'rgba(70,86,76,0.22)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = damp;
    ctx.fillRect(x0, base - g.U * 5, w, g.U * 5);
  }

  function paintGables(ctx, g, sky, x0, w, top, ridge, wall, cap) {
    const U = g.U;
    const gw = Math.min(w * 0.2, 6 * U);
    const sw = gw / 3;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 3; i++) {
        const rise = (0.9 + i * 1.8) * U;
        const sx = side === 0 ? x0 + i * sw : x0 + w - (i + 1) * sw;
        ctx.fillStyle = wall;
        ctx.fillRect(sx, ridge - rise, sw + 0.3, top - ridge + rise);
        ctx.fillStyle = cap;
        ctx.fillRect(sx - 0.3, ridge - rise - 0.7 * U, sw + 0.8, 0.8 * U);
      }
    }
    return gw;
  }

  function paintWindow(ctx, g, sky, wx, wy0) {
    const U = g.U;
    const ww = 3.2 * U;
    const wh = 4.4 * U;
    ctx.fillStyle = tone('#4a392c', sky);
    ctx.fillRect(wx - 0.4 * U, wy0 - 0.4 * U, ww + 0.8 * U, wh + 0.8 * U);
    ctx.fillStyle = toHex(mixColor(rgb('#2a2622'), rgb(GLOW), sky.night * 0.9));
    ctx.fillRect(wx, wy0, ww, wh);
    ctx.fillStyle = tone('#4a392c', sky);
    ctx.fillRect(wx + ww / 2 - 0.2, wy0, Math.max(1, 0.4 * U), wh);
    ctx.fillRect(wx, wy0 + wh * 0.4, ww, Math.max(1, 0.4 * U));
    ctx.fillStyle = tone('#a2a49c', sky);
    ctx.fillRect(wx - 0.8 * U, wy0 + wh + 0.4 * U, ww + 1.6 * U, 0.7 * U);
  }

  function paintLantern(ctx, g, sky, lx, ly) {
    const U = g.U;
    ctx.fillStyle = tone('#4a392c', sky);
    ctx.fillRect(lx - 0.2, ly - 1.4 * U, Math.max(1, 0.4 * U), 1.4 * U);
    glowAt(ctx, lx, ly + 1.2 * U, 5 * U, sky.night * 0.5);
    ctx.fillStyle = toHex(mixColor(rgb('#b8412c'), rgb('#e0653f'), sky.night * 0.6));
    ctx.beginPath();
    ctx.ellipse(lx, ly + 1.2 * U, 1.1 * U, 1.6 * U, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tone('#2f2a24', sky);
    ctx.fillRect(lx - 0.6 * U, ly - 0.2 * U, 1.2 * U, 0.4 * U);
  }

  function paintHouse(ctx, g, sky, rand, h) {
    const U = g.U;
    const base = g.wy - 1.8 * U;
    const x0 = g.W * h.a;
    const w = g.W * (h.b - h.a);
    const top = base - h.wall * U;
    const ridge = top - h.roof * U;
    const wall = tone('#ebe6d6', sky, 0.28, 0.42);
    const tile = tone('#2f353b', sky, 0.12, 0.5);
    const cap = tone('#23282d', sky, 0.1, 0.5);
    ctx.fillStyle = wall;
    ctx.fillRect(x0, top, w, base - top);
    const gw = paintGables(ctx, g, sky, x0, w, top, ridge, wall, cap);
    ctx.fillStyle = tile;
    ctx.fillRect(x0 + gw, ridge, w - 2 * gw, top - ridge + 0.5 * U);
    ctx.fillStyle = tone('#586068', sky, 0.15, 0.5);
    ctx.globalAlpha = 0.45;
    for (let yy = ridge + 1.3 * U; yy < top; yy += 1.4 * U) ctx.fillRect(x0 + gw, yy, w - 2 * gw, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cap;
    ctx.fillRect(x0 + gw, ridge - 0.6 * U, w - 2 * gw, 0.8 * U);
    ctx.fillRect(x0 + gw - 0.7 * U, top, w - 2 * gw + 1.4 * U, 0.9 * U);
    ctx.globalAlpha = 0.18;
    ctx.fillRect(x0, top + 0.9 * U, w, 1.3 * U);
    ctx.globalAlpha = 1;
    paintStains(ctx, g, sky, rand, x0, w, top, base);
    // Stone footing along the water, with block joints.
    ctx.fillStyle = tone('#8f918a', sky, 0.2, 0.55);
    ctx.fillRect(x0, base, w, g.wy - base);
    ctx.fillStyle = tone('#5f625e', sky, 0.1, 0.5);
    ctx.fillRect(x0, base, w, 1);
    for (let sx = x0; sx < x0 + w; sx += 3.4 * U) ctx.fillRect(sx, base, 1, g.wy - base);
    for (const f of h.win) paintWindow(ctx, g, sky, x0 + w * f, top + (base - top) * 0.28);
    ctx.fillStyle = tone('#4a392c', sky);
    ctx.fillRect(x0 + w * h.door, base - 8 * U, 4 * U, 8 * U);
    ctx.fillStyle = tone('#2f2a24', sky);
    ctx.fillRect(x0 + w * h.door - 0.5 * U, base - 8.8 * U, 5 * U, 0.8 * U);
    paintLantern(ctx, g, sky, x0 + w * h.lantern, top + 1.6 * U);
  }

  // ---- bridge and far willow ---------------------------------------------

  function paintBridge(ctx, g, sky, rand) {
    const U = g.U;
    const wy = g.wy;
    const cx = g.W * 0.705;
    const hw = g.W * 0.155;
    const rx = Math.min(12 * U, hw * 0.55);
    const ry = 9 * U;
    const profile = (x) => {
      const d = (x - cx) / hw;
      return wy - 6 * U - 9 * U * (1 - d * d);
    };
    const stone = tone('#9a9d96', sky, 0.22, 0.55);
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(cx - hw, wy);
    for (let x = cx - hw; x <= cx + hw; x += 2) ctx.lineTo(x, profile(x));
    ctx.lineTo(cx + hw, profile(cx + hw));
    ctx.lineTo(cx + hw, wy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = tone('#bcbdb4', sky, 0.25, 0.5);
    ctx.lineWidth = 1.3 * U;
    ctx.beginPath();
    for (let x = cx - hw; x <= cx + hw; x += 2) {
      if (x === cx - hw) ctx.moveTo(x, profile(x));
      else ctx.lineTo(x, profile(x));
    }
    ctx.stroke();
    ctx.strokeStyle = tone('#5f625e', sky, 0.1, 0.5);
    ctx.lineWidth = Math.max(1, 0.35 * U);
    ctx.beginPath();
    for (let x = cx - hw; x <= cx + hw; x += 2) {
      if (x === cx - hw) ctx.moveTo(x, profile(x) + 1.1 * U);
      else ctx.lineTo(x, profile(x) + 1.1 * U);
    }
    ctx.stroke();
    ctx.strokeStyle = tone('#b3b5ac', sky, 0.25, 0.5);
    ctx.lineWidth = 1.6 * U;
    ctx.beginPath();
    ctx.ellipse(cx, wy, rx + 0.8 * U, ry + 0.8 * U, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.strokeStyle = tone('#5f625e', sky, 0.1, 0.5);
    ctx.lineWidth = 1;
    for (let k = 1; k < 10; k++) {
      const a = Math.PI + (k / 10) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rx, wy + Math.sin(a) * ry);
      ctx.lineTo(cx + Math.cos(a) * (rx + 1.6 * U), wy + Math.sin(a) * (ry + 1.6 * U));
      ctx.stroke();
    }
    ctx.fillStyle = tone('#55705a', sky, 0.1, 0.5);
    for (let i = 0; i < 26; i++) {
      const x = cx - hw + rand() * hw * 2;
      ctx.globalAlpha = 0.1 + rand() * 0.15;
      ctx.fillRect(x, wy - U * (1 + rand() * 4), 1, U * (1 + rand() * 3));
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(cx, wy, rx, ry, 0, Math.PI, TAU);
    ctx.fill();
    ctx.restore();
  }

  function paintFarWillow(ctx, g, sky, rand) {
    const U = g.U;
    const x = g.W * 0.525;
    const base = g.wy - 1.8 * U;
    ctx.strokeStyle = tone('#3a2e26', sky);
    ctx.lineWidth = 1.6 * U;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x - 1.5 * U, base - 9 * U, x + 0.5 * U, base - 17 * U);
    ctx.stroke();
    const greens = [tone('#556f45', sky), tone('#6b8656', sky), tone('#8aa26a', sky)];
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = greens[i % 3];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(x + (rand() - 0.5) * 11 * U, base - (15 + rand() * 6) * U, (1.5 + rand() * 2) * U, (1 + rand() * 1.2) * U, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = greens[i % 3];
      const sx = x + (rand() - 0.5) * 12 * U;
      const sy = base - (14 + rand() * 5) * U;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + (rand() - 0.5) * 2 * U, sy + 6 * U, sx + (rand() - 0.5) * 3 * U, sy + (8 + rand() * 9) * U);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintWorld(g, sky, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    // Stone embankment along the whole far bank.
    ctx.fillStyle = tone('#8f918a', sky, 0.2, 0.55);
    ctx.fillRect(0, g.wy - 1.8 * g.U, g.W, 1.8 * g.U);
    for (const h of HOUSES) paintHouse(ctx, g, sky, rand, h);
    paintFarWillow(ctx, g, sky, rand);
    paintBridge(ctx, g, sky, rand);
    return c;
  }

  // ---- water -------------------------------------------------------------

  function waterColor(sky) {
    return toHex(mixColor(mixColor(rgb('#4f6b6a'), sky.low, 0.3), NIGHT_INK, sky.night * 0.75));
  }

  function paintReflection(g, sky, skyLayer, world) {
    const hh = g.H - g.wy;
    const c = layer(g.W, hh);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(skyLayer, 0, 0);
    ctx.drawImage(world, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.48;
    ctx.fillStyle = waterColor(sky);
    ctx.fillRect(0, 0, g.W, hh);
    const fade = ctx.createLinearGradient(0, 0, 0, hh);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, waterColor(sky));
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.W, hh);
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- foreground: near bank and the big willow --------------------------

  function branchPoint(b, t, g) {
    const u = 1 - t;
    return [
      g.W * (u * u * b[0] + 2 * u * t * b[2] + t * t * b[4]),
      g.U * (u * u * b[1] + 2 * u * t * b[3] + t * t * b[5]),
    ];
  }

  function paintNearBank(ctx, g, sky, rand) {
    const U = g.U;
    const top = g.H - 6 * U;
    ctx.fillStyle = tone('#6f726c', sky, 0.2, 0.6);
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = tone('#a2a49c', sky, 0.25, 0.55);
    ctx.fillRect(0, top, g.W, 1.3 * U);
    ctx.fillStyle = tone('#4a4d4a', sky, 0.1, 0.5);
    for (let x = 0; x < g.W; x += 5 * U + rand() * 4 * U) ctx.fillRect(x, top + 1.3 * U, 1, g.H - top);
    ctx.fillRect(0, top + 3.6 * U, g.W, 1);
    ctx.fillStyle = tone('#55705a', sky, 0.1, 0.5);
    for (let i = 0; i < 30; i++) {
      ctx.globalAlpha = 0.2 + rand() * 0.25;
      ctx.fillRect(rand() * g.W, top + rand() * 2 * U, 1 + rand() * 3 * U, U * (0.6 + rand()));
    }
    ctx.globalAlpha = 1;
  }

  function paintWillow(ctx, g, sky, rand) {
    const U = g.U;
    const bark = tone('#3a2e26', sky, 0.1, 0.55);
    ctx.lineCap = 'round';
    ctx.strokeStyle = bark;
    let prev = [g.W * 0.075, g.H];
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      const u = 1 - t;
      const p = [g.W * (u * u * 0.075 + 2 * u * t * 0.045 + t * t * 0.11), U * (u * u * 100 + 2 * u * t * 70 + t * t * 36)];
      ctx.lineWidth = lerp(7 * U, 3.4 * U, t);
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      prev = p;
    }
    for (const b of BRANCHES) {
      ctx.lineWidth = b[6] * U;
      ctx.beginPath();
      ctx.moveTo(g.W * b[0], U * b[1]);
      ctx.quadraticCurveTo(g.W * b[2], U * b[3], g.W * b[4], U * b[5]);
      ctx.stroke();
    }
    const greens = [tone('#3f5a3e', sky), tone('#556f45', sky), tone('#6b8656', sky), tone('#8aa26a', sky)];
    for (const b of BRANCHES) {
      for (let i = 0; i < 16; i++) {
        const p = branchPoint(b, 0.4 + rand() * 0.6, g);
        ctx.fillStyle = greens[Math.floor(rand() * greens.length)];
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.ellipse(p[0], p[1], (1.2 + rand() * 2.2) * U, (0.9 + rand() * 1.3) * U, rand() * 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  function paintFore(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintNearBank(ctx, g, sky, rand);
    paintWillow(ctx, g, sky, rand);
    return c;
  }

  function makeStrands(g) {
    const rand = K.rng(77);
    const s = {
      ax: new Float32Array(STRAND_COUNT),
      ay: new Float32Array(STRAND_COUNT),
      len: new Float32Array(STRAND_COUNT),
      ph: new Float32Array(STRAND_COUNT),
      amp: new Float32Array(STRAND_COUNT),
      drift: new Float32Array(STRAND_COUNT),
    };
    for (let i = 0; i < STRAND_COUNT; i++) {
      const b = BRANCHES[i % BRANCHES.length];
      const p = branchPoint(b, 0.35 + rand() * 0.65, g);
      s.ax[i] = p[0];
      s.ay[i] = p[1];
      s.len[i] = g.U * (11 + rand() * 22);
      s.ph[i] = rand() * TAU;
      s.amp[i] = g.U * (1.2 + rand() * 1.6);
      s.drift[i] = g.U * (rand() - 0.5) * 2;
    }
    return s;
  }

  // ---- boat --------------------------------------------------------------

  function paintBoat(g, sky) {
    const U = g.U;
    const c = layer(44 * U, 16 * U);
    const ctx = c.getContext('2d');
    const wood = tone('#4b3a2c', sky, 0.15, 0.55);
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(1 * U, 5 * U);
    ctx.quadraticCurveTo(4 * U, 8.6 * U, 8 * U, 8.6 * U);
    ctx.lineTo(28 * U, 8.6 * U);
    ctx.quadraticCurveTo(32 * U, 8.6 * U, 35 * U, 5.4 * U);
    ctx.quadraticCurveTo(35 * U, 9.8 * U, 31 * U, 11.5 * U);
    ctx.lineTo(7 * U, 11.5 * U);
    ctx.quadraticCurveTo(2 * U, 10.5 * U, 1 * U, 5 * U);
    ctx.fill();
    ctx.strokeStyle = tone('#b8934a', sky, 0.15, 0.45);
    ctx.lineWidth = Math.max(1, 0.7 * U);
    ctx.beginPath();
    ctx.moveTo(2.4 * U, 6.4 * U);
    ctx.quadraticCurveTo(4.5 * U, 8.6 * U, 8 * U, 8.6 * U);
    ctx.lineTo(28 * U, 8.6 * U);
    ctx.quadraticCurveTo(31.5 * U, 8.6 * U, 34 * U, 6 * U);
    ctx.stroke();
    // The black woven awning.
    const awning = tone('#23272c', sky, 0.1, 0.4);
    ctx.fillStyle = awning;
    ctx.beginPath();
    ctx.moveTo(10 * U, 8.4 * U);
    ctx.bezierCurveTo(10 * U, 1 * U, 26 * U, 1 * U, 26 * U, 8.4 * U);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = tone('#454a50', sky, 0.15, 0.4);
    ctx.lineWidth = 1;
    for (let x = 11.5; x < 26; x += 1.8) {
      const d = (x - 18) / 8;
      const apex = 8.4 - 5.5 * Math.max(0, 1 - d * d);
      ctx.beginPath();
      ctx.moveTo(x * U, apex * U + 1);
      ctx.lineTo(x * U, 8.2 * U);
      ctx.stroke();
    }
    ctx.fillStyle = toHex(mixColor(rgb('#171410'), rgb(GLOW), sky.night * 0.8));
    ctx.beginPath();
    ctx.ellipse(10 * U, 7 * U, 1.2 * U, 2.4 * U, 0, 0, TAU);
    ctx.fill();
    glowAt(ctx, 9 * U, 7 * U, 5 * U, sky.night * 0.5);
    ctx.strokeStyle = wood;
    ctx.lineWidth = Math.max(1, 0.55 * U);
    ctx.beginPath();
    ctx.moveTo(31 * U, 5.5 * U);
    ctx.lineTo(39 * U, 14.8 * U);
    ctx.stroke();
    return c;
  }

  function drawBoat(ctx, g, t) {
    const U = g.U;
    const bx = g.W * 0.3;
    const wl = g.wy + 14 * U;
    const bob = Math.sin(t * 0.9) * 0.22 * U;
    const roll = Math.sin(t * 0.7 + 1) * 0.012;
    const b = state.boat;
    ctx.save();
    ctx.translate(bx, wl + bob);
    ctx.rotate(roll);
    ctx.globalAlpha = 0.28;
    ctx.save();
    ctx.scale(1, -0.8);
    ctx.drawImage(b, 0, -11.5 * U);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.drawImage(b, 0, -11.5 * U);
    ctx.restore();
  }

  function drawRipples(ctx, g, t) {
    const U = g.U;
    const cx = g.W * 0.3 + 18 * U;
    const cy = g.wy + 14 * U + 0.2 * U;
    ctx.strokeStyle = state.rippleInk;
    ctx.lineWidth = 1;
    for (let i = 0; i < RIPPLES; i++) {
      const a = (t * 0.08 + i / RIPPLES) % 1;
      const rx = (10 + a * 22) * U;
      ctx.globalAlpha = (1 - a) * 0.35;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, rx * 0.12, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.012, y * 0.06, 4, 41);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 230;
        img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.38, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mistTex;
    const a = state.mistAlpha * Math.min(1, amount);
    const bands = [
      { y: g.wy - 0.2 * g.H, speed: 1.1, alpha: 0.9 },
      { y: g.wy - 0.07 * g.H, speed: -0.8, alpha: 0.7 },
      { y: g.wy + 0.02 * g.H, speed: 0.6, alpha: 0.45 },
    ];
    for (const b of bands) {
      const off = -((((t * g.U * b.speed) % m.width) + m.width) % m.width);
      ctx.globalAlpha = a * b.alpha;
      ctx.drawImage(m, off, b.y);
      ctx.drawImage(m, off + m.width, b.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- per frame ---------------------------------------------------------

  function drawWater(ctx, g, t) {
    const hh = g.H - g.wy;
    ctx.fillStyle = state.water;
    ctx.fillRect(0, g.wy, g.W, hh);
    for (let y = 0; y < hh; y += 2) {
      const k = y / hh;
      const dx = Math.sin(t * 1.3 + y * 0.5) * g.U * (0.12 + 0.8 * k);
      ctx.drawImage(state.refl, 0, y, g.W, 2, dx, g.wy + y, g.W, 2);
    }
  }

  function drawStrands(ctx, g, t, sway) {
    const s = state.strands;
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.globalAlpha = 0.85;
    for (let c = 0; c < 3; c++) {
      ctx.strokeStyle = state.strandInk[c];
      ctx.beginPath();
      for (let i = c; i < STRAND_COUNT; i += 3) {
        ctx.moveTo(s.ax[i], s.ay[i]);
        for (let k = 1; k <= SEG; k++) {
          const f = k / SEG;
          const x = s.ax[i] + s.drift[i] * f + Math.sin(t * 0.9 + s.ph[i] + f * 1.6) * s.amp[i] * f * f * sway;
          ctx.lineTo(x, s.ay[i] + s.len[i] * f);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.world = paintWorld(g, sky, rand);
    state.refl = paintReflection(g, sky, state.sky, state.world);
    state.fore = paintFore(g, sky, rand);
    state.boat = paintBoat(g, sky);
    state.water = waterColor(sky);
    state.mistAlpha = 0.62 - sky.night * 0.38;
    state.rippleInk = toHex(mixColor(rgb('#e9e4d3'), NIGHT_INK, sky.night * 0.4));
    state.strandInk = [tone('#556f45', sky), tone('#6b8656', sky), tone('#3f5a3e', sky)];
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.mistTex = paintMist(g.W * 1.4, g.H * 0.22);
    state.strands = makeStrands(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawWater(ctx, g, t);
    ctx.drawImage(state.world, 0, 0);
    drawMist(ctx, g, t, props.mist);
    drawRipples(ctx, g, t);
    drawBoat(ctx, g, t);
    ctx.drawImage(state.fore, 0, 0);
    drawStrands(ctx, g, t, props.sway);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, sway: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
