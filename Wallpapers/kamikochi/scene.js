/*
 * 上高地 Kamikochi — a clear river on a high alpine plain.
 *
 * Sky, peaks, far forest, water mirror and the near bank with larches and
 * the footbridge are baked into layers and repainted once a minute from the
 * clock. Between repaints only mist, ripples in the mirror, current glints
 * and a few drifting larch needles move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const WL = 0.52; // water line
  const WB = 0.9; // bottom of the water
  const RETINT_SECONDS = 60;
  const NEEDLES = 14;
  const GLINTS = 22;
  const PEAKS = [
    { x: 0.14, h: 0.24, w: 0.2 },
    { x: 0.33, h: 0.3, w: 0.2 },
    { x: 0.5, h: 0.34, w: 0.15 },
    { x: 0.66, h: 0.27, w: 0.19 },
    { x: 0.86, h: 0.31, w: 0.22 },
  ];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Tint a colour by the light of the hour.
  function tone(h, sky, amount = 0.2, dark = '#10142a') {
    return hex(mixColor(mixColor(rgb(h), sky.amb, amount), rgb(dark), sky.night * 0.75));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WL);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
      const mt = S.moonT(sky.hour);
      const mx = g.W * lerp(0.15, 0.85, mt);
      const my = g.H * (0.2 - 0.1 * Math.sin(mt * Math.PI));
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 9);
      halo.addColorStop(0, `rgba(236,232,210,${0.45 * sky.night})`);
      halo.addColorStop(1, 'rgba(236,232,210,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(mx - g.U * 9, my - g.U * 9, g.U * 18, g.U * 18);
      ctx.globalAlpha = sky.night;
      ctx.fillStyle = '#ece6cc';
      ctx.beginPath();
      ctx.arc(mx, my, g.U * 2.2, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 246;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- peaks -------------------------------------------------------------

  // Ridge height and which peak owns the column, craggy rather than smooth.
  function ridgeAt(g, px) {
    const base = g.H * WL;
    let best = 0;
    let owner = 0;
    for (let i = 0; i < PEAKS.length; i++) {
      const p = PEAKS[i];
      const d = Math.abs(px - g.W * p.x) / (g.W * p.w);
      const v = g.H * p.h * Math.pow(Math.max(0, 1 - d), 0.85);
      if (v > best) {
        best = v;
        owner = i;
      }
    }
    const crag = (fbm(px * 0.09, 3, 3, 7) - 0.5) * g.U * 7 + (fbm(px * 0.4, 8, 2, 3) - 0.5) * g.U * 2;
    return { y: base - best + crag * Math.min(1, best / (g.H * 0.1)), owner };
  }

  function rockPixel(g, sky, px, py, top, owner, lit) {
    const depth = (py - top) / (g.H * 0.3);
    const gully = fbm(px * 0.35, py * 0.03, 3, 9);
    const snowLine = 0.2 + (fbm(px * 0.05, 4, 3, 11) - 0.5) * 0.18 + (gully - 0.5) * 0.4;
    const shade = lit ? 1 : 0.78;
    if (depth < snowLine) {
      const snow = mixColor(rgb('#e9ecef'), sky.amb, 0.35);
      return mixColor(snow, sky.top, 0.14 + sky.night * 0.3).map((c) => c * shade);
    }
    const rock = mixColor(mixColor(rgb('#4a5878'), sky.haze, 0.4), rgb('#232c4a'), sky.night * 0.6);
    const strata = gully > 0.62 ? 0.88 : 1;
    const near = smoothstep(0.55, 1.1, depth) * 0.45;
    return mixColor(rock, sky.haze, near).map((c) => c * shade * strata);
  }

  function paintPeaks(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = Math.floor(g.H * (WL - 0.36));
    const h = Math.ceil(g.H * WL) - y0 + 1;
    const img = ctx.getImageData(0, y0, g.W, h);
    for (let px = 0; px < g.W; px++) {
      const r = ridgeAt(g, px);
      const lit = px < g.W * PEAKS[r.owner].x;
      for (let py = Math.max(0, Math.floor(r.y - y0)); py < h; py++) {
        const col = rockPixel(g, sky, px, py + y0, r.y, r.owner, lit);
        const i = (py * g.W + px) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
    return c;
  }

  // A dark band of far forest at the foot of the peaks.
  function paintFarForest(ctx, g, sky, rand, autumn) {
    const base = g.H * WL;
    ctx.fillStyle = tone('#2a3a34', sky, 0.15);
    ctx.fillRect(0, base - g.U * 4, g.W, g.U * 4.5);
    const hues = autumn ? ['#2f4636', '#6b6a30', '#8a7230', '#3a5238'] : ['#2f4636', '#3a5238', '#2c4034', '#456040'];
    for (let i = 0; i < g.W * 1.4; i++) {
      const px = rand() * g.W;
      const py = base - g.U * (1 + rand() * 5.5);
      ctx.fillStyle = tone(hues[Math.floor(rand() * hues.length)], sky, 0.18);
      ctx.beginPath();
      ctx.moveTo(px, py - g.U * (2 + rand() * 2));
      ctx.lineTo(px - g.U * 1.1, py + g.U * 1.2);
      ctx.lineTo(px + g.U * 1.1, py + g.U * 1.2);
      ctx.fill();
    }
  }

  // ---- water -------------------------------------------------------------

  function paintMirror(g, sky, skyLayer, back) {
    const wh = Math.ceil(g.H * (WB - WL));
    const wy = Math.round(g.H * WL);
    const scratch = layer(g.W, g.H);
    const sctx = scratch.getContext('2d');
    sctx.drawImage(skyLayer, 0, 0);
    sctx.drawImage(back, 0, 0);
    const c = layer(g.W, wh);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(0, wh);
    ctx.scale(1, -1);
    ctx.drawImage(scratch, 0, wy - wh, g.W, wh, 0, 0, g.W, wh);
    ctx.restore();
    const deep = ctx.createLinearGradient(0, 0, 0, wh);
    const clear = mixColor(rgb('#3d6a78'), sky.low, 0.25);
    deep.addColorStop(0, `rgba(${clear.map(Math.round).join(',')},0.18)`);
    deep.addColorStop(1, `rgba(${mixColor(rgb('#2b4f5e'), rgb('#10182c'), sky.night * 0.7).map(Math.round).join(',')},0.6)`);
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, g.W, wh);
    return c;
  }

  // ---- near bank, larches, bridge ---------------------------------------

  function bankEdge(g, side, f) {
    // f 0 at the water line, 1 at the bottom: the bank widens toward us.
    const w = lerp(0.13, 0.3, f * f + f * 0.2);
    return side < 0 ? g.W * w : g.W * (1 - w);
  }

  function paintBanks(ctx, g, sky, rand) {
    const top = g.H * WL + g.U * 4;
    const steps = 24;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side < 0 ? 0 : g.W, top);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const jag = (fbm(f * 6, side + 3, 2, 5) - 0.5) * g.U * 3;
        ctx.lineTo(bankEdge(g, side, f) + jag, top + (g.H - top) * f * 0.9 + (g.H * WB - top) * 0.1 * f);
      }
      ctx.lineTo(side < 0 ? 0 : g.W, g.H);
      ctx.closePath();
      ctx.fillStyle = tone('#4d6038', sky, 0.15);
      ctx.fill();
    }
    // Gravel and stones along the lower edge.
    const bottom = g.H * WB;
    ctx.fillStyle = tone('#8c8678', sky, 0.2);
    ctx.fillRect(0, bottom, g.W, g.H - bottom);
    ctx.fillStyle = tone('#5e6a48', sky, 0.15);
    ctx.fillRect(0, bottom + g.U * 4, g.W, g.H - bottom);
    for (let i = 0; i < 40; i++) {
      const sx = rand() * g.W;
      const sy = bottom + rand() * (g.H - bottom);
      ctx.fillStyle = tone(rand() > 0.5 ? '#6b6e78' : '#a39c8a', sky, 0.2);
      ctx.beginPath();
      ctx.ellipse(sx, sy, g.U * (0.8 + rand() * 1.6), g.U * (0.5 + rand()), 0, 0, 6.3);
      ctx.fill();
    }
    // Pale water edge.
    ctx.fillStyle = tone('#dcdcd0', sky, 0.3);
    ctx.fillRect(0, bottom - 1, g.W, Math.max(1, g.U * 0.7));
  }

  function paintLarch(ctx, g, sky, rand, lx, base, height, autumn) {
    const trunk = tone('#4a3a2c', sky, 0.15);
    ctx.fillStyle = trunk;
    ctx.fillRect(lx - g.U * 0.35, base - height, Math.max(1, g.U * 0.7), height);
    const hues = autumn ? ['#c49a34', '#b0842c', '#d2ae46', '#8f7a2c'] : ['#5b7a3c', '#4d6b3a', '#6a8a48', '#3f5a34'];
    const rows = 13;
    for (let k = 0; k < rows; k++) {
      const f = k / (rows - 1);
      const y = base - height * (0.96 - f * 0.86);
      const reach = g.U * (1 + f * 5.6);
      for (let n = 0; n < 6; n++) {
        const dx = (rand() * 2 - 1) * reach;
        ctx.fillStyle = tone(hues[Math.floor(rand() * hues.length)], sky, 0.18);
        ctx.beginPath();
        ctx.ellipse(lx + dx, y + Math.abs(dx) * 0.25, g.U * (1.1 + rand() * 0.9), g.U * (0.7 + rand() * 0.5), 0, 0, 6.3);
        ctx.fill();
      }
    }
  }

  function paintLarches(ctx, g, sky, rand, autumn) {
    const base = g.H * 0.95;
    const trees = [
      [0.015, 0.5], [0.075, 0.42], [0.13, 0.36], [0.2, 0.3],
      [0.985, 0.52], [0.925, 0.42], [0.87, 0.35], [0.8, 0.29],
    ];
    for (const [f, hgt] of trees) {
      const small = hgt < 0.33;
      const b = small ? g.H * 0.8 : base - (0.5 - hgt) * g.H * 0.4;
      paintLarch(ctx, g, sky, rand, g.W * f, b, g.H * hgt, autumn);
    }
  }

  // A wooden suspension footbridge: tall posts, hanging cables, plank deck.
  function paintBridge(ctx, g, sky) {
    const deck = g.H * 0.63;
    const xl = bankEdge(g, -1, 0.15) - g.U * 2;
    const xr = bankEdge(g, 1, 0.15) + g.U * 2;
    const wood = tone('#7a5a3a', sky, 0.2);
    const post = tone('#4e3a2a', sky, 0.15);
    ctx.fillStyle = post;
    for (const f of [0.35, 0.5, 0.65]) {
      ctx.fillRect(g.W * f - g.U * 0.5, deck, g.U, g.U * 6);
    }
    ctx.fillStyle = wood;
    ctx.fillRect(xl, deck, xr - xl, Math.max(2, g.U * 1.4));
    ctx.fillStyle = tone('#3a2c20', sky, 0.15);
    ctx.fillRect(xl, deck + g.U * 1.4, xr - xl, Math.max(1, g.U * 0.5));
    ctx.fillStyle = post;
    for (const x of [xl, xr]) {
      ctx.fillRect(x - g.U * 0.6, deck - g.U * 10, g.U * 1.2, g.U * 10.5);
      ctx.fillRect(x - g.U * 1.6, deck - g.U * 9, g.U * 3.2, g.U * 0.8);
    }
    const topY = deck - g.U * 9;
    const ctrl = deck + g.U * 7;
    ctx.strokeStyle = tone('#2e2a28', sky, 0.15);
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    ctx.beginPath();
    ctx.moveTo(xl, topY);
    ctx.quadraticCurveTo((xl + xr) / 2, ctrl, xr, topY);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 1; i < 16; i++) {
      const f = i / 16;
      const cy = (1 - f) * (1 - f) * topY + 2 * f * (1 - f) * ctrl + f * f * topY;
      ctx.beginPath();
      ctx.moveTo(lerp(xl, xr, f), cy);
      ctx.lineTo(lerp(xl, xr, f), deck);
      ctx.stroke();
    }
  }

  function paintTopPlain(ctx, g, sky) {
    // Soft grass shelf at the far bank, just under the forest band.
    ctx.fillStyle = tone('#5a6a40', sky, 0.15);
    ctx.fillRect(0, g.H * WL, g.W, g.U * 1.5);
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, props) {
    const sky = S.at(S.hour(props.time));
    const rand = K.rng(17);
    state.sky = paintSky(g, sky, rand);
    state.back = paintPeaks(g, sky);
    const bctx = state.back.getContext('2d');
    paintFarForest(bctx, g, sky, rand, props.autumn);
    paintTopPlain(bctx, g, sky);
    state.mirror = paintMirror(g, sky, state.sky, state.back);
    const front = layer(g.W, g.H);
    const fctx = front.getContext('2d');
    paintBanks(fctx, g, sky, rand);
    paintBridge(fctx, g, sky);
    paintLarches(fctx, g, sky, rand, props.autumn);
    state.front = front;
    state.cloudAlpha = 0.7 - sky.night * 0.45;
    state.night = sky.night;
    state.glint = sky.night > 0.5 ? '#c8d0e0' : '#f2f2ea';
    state.needle = props.autumn ? '#d2ae46' : '#6a8a48';
    state.choice = props.time;
    state.autumn = props.autumn;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const hi = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount * 0.9);
    ctx.drawImage(c, hi, g.H * 0.03);
    ctx.drawImage(c, hi + c.width, g.H * 0.03);
    const lo = -((t * g.U * 0.7) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount * 0.55);
    ctx.drawImage(c, lo, g.H * 0.3, c.width, g.H * 0.2);
    ctx.drawImage(c, lo + c.width, g.H * 0.3, c.width, g.H * 0.2);
    ctx.globalAlpha = 1;
  }

  function drawWater(ctx, g, t) {
    const wy = Math.round(g.H * WL);
    const wh = state.mirror.height;
    ctx.fillStyle = state.waterBase;
    ctx.fillRect(0, wy, g.W, wh);
    for (let r = 0; r < wh; r += 2) {
      const f = r / wh;
      const amp = g.U * (0.4 + 1.6 * f);
      const sx = Math.sin(t * 1.1 + r * 0.5) * amp + Math.sin(t * 0.6 - r * 0.21) * amp * 0.6;
      ctx.drawImage(state.mirror, 0, r, g.W, 2, sx, wy + r, g.W, 2);
    }
  }

  // Short bright dashes drifting with the current.
  function drawGlints(ctx, g, t) {
    const wy = g.H * WL;
    const span = g.H * (WB - WL);
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const lane = (i * 0.618) % 1;
      const gy = wy + span * (0.06 + lane * 0.92);
      const speed = (0.8 + lane * 2.2) * g.U;
      const gx = (((i * 53.7) + t * speed) % (g.W + 20)) - 10;
      const len = g.U * (1.5 + lane * 3.5);
      ctx.globalAlpha = (0.2 + 0.35 * Math.sin(t * 1.3 + i * 2.1) ** 2) * (1 - state.night * 0.5);
      ctx.fillRect(gx, gy, len, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function drawNeedles(ctx, g, t) {
    ctx.fillStyle = state.needle;
    for (let i = 0; i < NEEDLES; i++) {
      const life = (t * 0.05 + i / NEEDLES) % 1;
      const nx = g.W * (i % 2 ? 0.04 + (i * 0.037) % 0.2 : 0.8 + (i * 0.029) % 0.19) + Math.sin(t * 0.9 + i) * g.U * 2 + life * g.U * 6;
      const ny = g.H * (0.35 + life * 0.55);
      ctx.globalAlpha = 0.8 * Math.sin(life * Math.PI);
      ctx.fillRect(nx, ny, Math.max(1, g.U * 0.7), Math.max(1, g.U * 0.7));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    repaint(g, api.props);
    state.waterBase = hex(mixColor(rgb('#34606e'), rgb('#10182c'), state.night * 0.7));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.autumn !== props.autumn) {
      repaint(g, props);
      state.waterBase = hex(mixColor(rgb('#34606e'), rgb('#10182c'), state.night * 0.7));
    }
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, props.mist);
    drawWater(ctx, g, t);
    drawGlints(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawNeedles(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, autumn: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
