/*
 * 白川郷 Shirakawa — steep thatched farmhouses of a mountain village in deep snow.
 *
 * Sky, hills, cedars and houses are baked into two layers and repainted once a
 * minute from the clock, so the windows warm toward evening. Between repaints
 * only a mist strip, window glows, smoke wisps and the falling snow move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.5;
  const RETINT_SECONDS = 60;
  const MAX_FLAKES = 480;
  const PUFFS = 6;
  const INK = {
    snow: '#eef0f2',
    snowShade: '#b8c2d6',
    thatch: '#8a6a44',
    thatchDark: '#5e4630',
    timber: '#4a3626',
    timberDark: '#2e221a',
    washi: '#d8ccaa',
    warm: '#eaa450',
    warmHot: '#f4c876',
    cedar: '#2c3d30',
    cedarLit: '#4a5e48',
    hill: '#56667a',
  };
  // Houses back to front: x and base as screen fractions, s as size.
  const HOUSES = [
    { x: 0.12, y: 0.555, s: 0.32 },
    { x: 0.3, y: 0.545, s: 0.28 },
    { x: 0.47, y: 0.56, s: 0.34 },
    { x: 0.86, y: 0.555, s: 0.3 },
    { x: 0.66, y: 0.6, s: 0.5 },
    { x: 0.2, y: 0.64, s: 0.58 },
    { x: 0.42, y: 0.84, s: 1.05 },
    { x: 0.8, y: 0.9, s: 1.2 },
  ];
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

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  // Colour lit by the sky: multiplied by its ambient tint.
  function lit(hexInk, sky, k = 1) {
    const c = parseColor(hexInk);
    const a = sky.amb;
    return toHex([0, 1, 2].map((i) => lerp(c[i], (c[i] * a[i]) / 255, k)));
  }

  // ---- sky and hills -------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function ridge(g, x, base, amp, seed) {
    return g.H * base - fbm(x / (g.U * 28), seed, 4, seed) * g.H * amp;
  }

  function paintHill(ctx, g, sky, base, amp, seed, ink, snowK) {
    const rock = parseColor(lit(ink, sky));
    const snow = parseColor(lit(INK.snowShade, sky));
    const haze = sky.haze;
    for (let x = 0; x < g.W; x++) {
      const top = ridge(g, x, base, amp, seed);
      for (let y = Math.floor(top); y < g.H * 0.62; y++) {
        const n = fbm(x / (g.U * 2.2), y / (g.U * 1.4), 3, seed + 7);
        const c = n > 0.5 - snowK ? snow : rock;
        const far = mixColor(c, haze, 0.35 - snowK * 0.4);
        ctx.fillStyle = toHex(far);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function cedar(ctx, x, y, h, sky) {
    const w = h * 0.34;
    ctx.fillStyle = lit(INK.cedar, sky);
    poly(ctx, [x, y - h, x + w, y, x - w, y]);
    ctx.fillStyle = lit(INK.snow, sky);
    for (let i = 1; i < 4; i++) {
      const f = i / 4;
      const yy = y - h + h * f;
      ctx.fillRect(x - w * f * 0.9, yy, w * f * 1.2, Math.max(1, h * 0.06));
    }
  }

  function paintCedars(ctx, g, sky, rand) {
    for (let i = 0; i < 60; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.5 + rand() * 0.07);
      cedar(ctx, x, y, g.U * (3 + rand() * 4), sky);
    }
  }

  // ---- ground --------------------------------------------------------------

  function paintGround(ctx, g, sky, rand) {
    const top = g.H * 0.535;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, lit('#98a4bc', sky));
    grad.addColorStop(0.4, lit('#aeb8cc', sky));
    grad.addColorStop(1, lit('#c6cedc', sky));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Soft drifts with blue shadow under each crest.
    for (let i = 0; i < 14; i++) {
      const x = rand() * g.W;
      const y = lerp(top, g.H, rand());
      const r = g.U * (6 + rand() * 18);
      ctx.fillStyle = lit(INK.snowShade, sky);
      ctx.globalAlpha = 0.5;
      blob(ctx, x, y + r * 0.08, r, r * 0.12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = lit('#d2d8e4', sky);
      blob(ctx, x - r * 0.1, y, r * 0.9, r * 0.09);
    }
  }

  // ---- houses --------------------------------------------------------------

  function houseShape(g, h) {
    const w = g.U * 26 * h.s;
    const x = g.W * h.x;
    const base = g.H * h.y;
    const wallH = w * 0.2;
    const eave = base - wallH;
    const apex = eave - w * 0.95;
    const d = w * 0.85;
    const lift = d * 0.28;
    const over = w * 0.08;
    return { w, x, base, wallH, eave, apex, d, lift, over };
  }

  function windowInk(sky, warmth) {
    return toHex(mixColor(parseColor(lit('#3a3430', sky)), parseColor(INK.warm), warmth));
  }

  function paintSide(ctx, f, sky, warmth) {
    const r = f.x + f.w / 2;
    ctx.fillStyle = lit(INK.timberDark, sky);
    poly(ctx, [r, f.base, r, f.eave, r + f.d, f.eave - f.lift, r + f.d, f.base - f.lift]);
    ctx.fillStyle = windowInk(sky, warmth);
    for (let i = 0; i < 4; i++) {
      const k = (i + 0.3) / 4;
      const wx = r + f.d * k;
      const wy = f.eave - f.lift * k + f.wallH * 0.25;
      ctx.fillRect(wx, wy, f.d * 0.12, f.wallH * 0.35);
    }
  }

  function paintRoofSide(ctx, f, sky) {
    const r = f.x + f.w / 2 + f.over;
    const ey = f.eave + f.over * 0.4;
    const e = f.w * 0.07;
    ctx.fillStyle = lit(INK.thatchDark, sky);
    poly(ctx, [f.x, f.apex, f.x + f.d + e, f.apex - f.lift, r + f.d + e, ey - f.lift + e, r, ey + e]);
    const grad = ctx.createLinearGradient(f.x, f.apex, r, ey);
    grad.addColorStop(0, lit('#fbfbfa', sky, 0.6));
    grad.addColorStop(1, lit('#dfe4ec', sky, 0.8));
    ctx.fillStyle = grad;
    poly(ctx, [f.x, f.apex - e * 0.3, f.x + f.d, f.apex - f.lift - e * 0.3, r + f.d, ey - f.lift, r, ey]);
    // A few thatch streaks showing through the snow near the eave.
    ctx.fillStyle = lit(INK.thatch, sky);
    ctx.globalAlpha = 0.5;
    for (let i = 1; i < 7; i++) {
      const k = i / 7;
      const bx = r + f.d * k;
      const by = ey - f.lift * k;
      poly(ctx, [bx, by - f.w * 0.14, bx + f.w * 0.012, by - f.w * 0.14, bx + f.w * 0.02, by, bx - f.w * 0.01, by]);
    }
    ctx.globalAlpha = 1;
  }

  function paintGable(ctx, g, f, sky, warmth) {
    const t = f.w * 0.07;
    const l = f.x - f.w / 2;
    ctx.fillStyle = lit(INK.thatch, sky);
    poly(ctx, [l - f.over, f.eave + f.over * 0.4, f.x, f.apex - t * 0.6, f.x + f.w / 2 + f.over, f.eave + f.over * 0.4]);
    ctx.fillStyle = lit(INK.snow, sky);
    ctx.lineWidth = Math.max(1, t * 0.5);
    ctx.strokeStyle = lit(INK.snow, sky);
    ctx.beginPath();
    ctx.moveTo(l - f.over, f.eave + f.over * 0.3);
    ctx.lineTo(f.x, f.apex - t * 0.8);
    ctx.lineTo(f.x + f.w / 2 + f.over, f.eave + f.over * 0.3);
    ctx.stroke();
    // Timber gable face inside the thatch edge.
    ctx.fillStyle = lit(INK.timber, sky);
    poly(ctx, [l + t, f.eave, f.x, f.apex + t * 1.6, f.x + f.w / 2 - t, f.eave]);
    paintGableWindows(ctx, f, sky, warmth, t);
    // Ground floor wall with paper doors.
    ctx.fillStyle = lit(INK.timberDark, sky);
    ctx.fillRect(l, f.eave, f.w, f.wallH);
    ctx.fillStyle = toHex(mixColor(parseColor(lit(INK.washi, sky)), parseColor(INK.warmHot), warmth));
    const n = 4;
    for (let i = 0; i < n; i++) {
      ctx.fillRect(l + f.w * (0.08 + i * 0.22), f.eave + f.wallH * 0.18, f.w * 0.16, f.wallH * 0.62);
    }
  }

  function paintGableWindows(ctx, f, sky, warmth, t) {
    const rows = 3;
    const span = f.eave - f.apex;
    ctx.fillStyle = windowInk(sky, warmth);
    for (let r = 0; r < rows; r++) {
      const fy = 0.38 + r * 0.2;
      const y = f.apex + span * fy;
      const half = (f.w / 2 - t * 2) * fy;
      const count = r + 1;
      const ww = Math.max(1, f.w * 0.09);
      const wh = Math.max(1, span * 0.08);
      for (let i = 0; i < count; i++) {
        const k = (i + 0.5) / count;
        ctx.fillRect(f.x - half + half * 2 * k - ww / 2, y, ww, wh);
      }
    }
  }

  function paintHouse(ctx, g, h, sky, warmth) {
    const f = houseShape(g, h);
    paintSide(ctx, f, sky, warmth);
    paintRoofSide(ctx, f, sky);
    paintGable(ctx, g, f, sky, warmth);
    // Snow banked against the walls.
    ctx.fillStyle = lit(INK.snow, sky);
    blob(ctx, f.x + f.d * 0.3, f.base + f.wallH * 0.1, f.w * 0.85, f.wallH * 0.35);
    return f;
  }

  // ---- bake ----------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    const warmth = 0.2 + sky.night * 0.75;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, sky, rand);
    state.back = back;
    const front = layer(g.W, g.H);
    const ctx = front.getContext('2d');
    paintHill(ctx, g, sky, 0.44, 0.24, 3, INK.hill, 0.08);
    paintHill(ctx, g, sky, 0.53, 0.14, 9, INK.cedar, -0.05);
    paintGround(ctx, g, sky, rand);
    paintCedars(ctx, g, sky, rand);
    state.houses = HOUSES.map((h) => paintHouse(ctx, g, h, sky, warmth));
    state.front = front;
    state.warmth = warmth;
    state.night = sky.night;
    state.mistInk = lit('#e4e6ea', sky);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.3);
    const h = Math.ceil(g.H * 0.12);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.02, y * 0.09, 3, 5);
        const b = fbm((x - w) * 0.02, y * 0.09, 3, 5);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 236;
        img.data[i + 3] = smoothstep(0.45, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function glowSprite(rgb, alpha) {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `rgba(${rgb},${alpha})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- motion --------------------------------------------------------------

  function drawMist(ctx, g, t) {
    const c = state.mist;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(c, off, g.H * 0.47);
    ctx.drawImage(c, off + c.width, g.H * 0.47);
    ctx.globalAlpha = 1;
  }

  function drawGlows(ctx, g, t, amount) {
    const k = amount * state.warmth;
    if (k <= 0.05) return;
    ctx.globalCompositeOperation = 'lighter';
    const hs = state.houses;
    for (let i = 0; i < hs.length; i++) {
      const f = hs[i];
      const s = f.w * 0.75;
      ctx.globalAlpha = Math.min(1, k * (0.35 + 0.07 * Math.sin(t * 0.8 + i * 1.9)));
      ctx.drawImage(state.warm, f.x - s, (f.eave + f.apex) / 2 + f.w * 0.15 - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Hearth smoke seeping up through the ridge of the two nearest roofs.
  function drawSmoke(ctx, g, t) {
    const hs = state.houses;
    for (let h = hs.length - 2; h < hs.length; h++) {
      const f = hs[h];
      const sx = f.x + f.d * 0.5;
      const sy = f.apex - f.lift * 0.5 - g.U * 1.5;
      for (let i = 0; i < PUFFS; i++) {
        const a = (t * 0.06 + i / PUFFS + h * 0.37) % 1;
        const size = g.U * (2 + a * 9);
        const dx = a * g.U * 14 + Math.sin(t * 0.5 + i) * g.U;
        ctx.globalAlpha = (1 - a) * a * 1.1;
        ctx.drawImage(state.puff, sx + dx - size / 2, sy - a * g.U * 16 - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function resetFlake(g, i, anywhere) {
    const r = state.rand;
    const near = r() < 0.3;
    state.fx[i] = r() * g.W;
    state.fy[i] = anywhere ? r() * g.H : -2;
    state.fv[i] = g.U * (near ? 8 + r() * 5 : 3 + r() * 3);
    state.fs[i] = near ? 1 : 0;
    state.fp[i] = r() * TAU;
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const count = Math.min(MAX_FLAKES, Math.round(g.W * 1.6 * amount));
    const big = Math.max(1, Math.round(g.U * 0.8));
    ctx.fillStyle = '#f0f2f6';
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.95 : 0.6;
      const size = pass ? big : 1;
      for (let i = 0; i < count; i++) {
        if (state.fs[i] !== pass) continue;
        state.fy[i] += state.fv[i] * dt;
        if (state.fy[i] > g.H) resetFlake(g, i, false);
        const x = state.fx[i] + Math.sin(t * 0.5 + state.fp[i]) * g.U * 1.6;
        ctx.fillRect(x, state.fy[i], size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.rand = K.rng(api.seed || 7);
    state.mist = paintMist(g);
    state.warm = glowSprite('236,160,80', 0.7);
    state.puff = glowSprite('230,230,226', 0.5);
    state.fx = new Float32Array(MAX_FLAKES);
    state.fy = new Float32Array(MAX_FLAKES);
    state.fv = new Float32Array(MAX_FLAKES);
    state.fp = new Float32Array(MAX_FLAKES);
    state.fs = new Uint8Array(MAX_FLAKES);
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, i, true);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== p.time) repaint(g, p.time);
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawMist(ctx, g, t);
    drawSmoke(ctx, g, t);
    drawGlows(ctx, g, t, p.lights);
    drawSnow(ctx, g, t, dt, p.snow);
  }

  Kasuri.run({
    defaults: { time: 'auto', snow: 1, lights: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1, tint: 0.6 },
    maxFps: 24,
    setup,
    draw,
  });
})();
