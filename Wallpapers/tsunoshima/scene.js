/*
 * 角島 Tsunoshima — a long low bridge curving over turquoise sea to a small
 * island with a white lighthouse.
 *
 * Sky, sea, island and bridge are baked into layers and repainted once a
 * minute from the clock. Between repaints only clouds, two scrolling wave
 * layers, a few glints and three gulls move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.43;
  const RETINT_SECONDS = 60;
  const STEPS = 90;
  const GLINTS = 14;
  // Bridge centreline as a cubic curve, in screen fractions.
  const CURVE = [[-0.04, 1.05], [0.62, 0.93], [0.12, 0.6], [0.7, 0.445]];
  const ISLAND = { x: 0.76, w: 0.3 };
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function bez(t, i) {
    const u = 1 - t;
    return u * u * u * CURVE[0][i] + 3 * u * u * t * CURVE[1][i] + 3 * u * t * t * CURVE[2][i] + t * t * t * CURVE[3][i];
  }

  // ---- sky and sea -------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    const day = 1 - sky.night;
    grad.addColorStop(0, hex(mixColor(sky.top, rgb('#9cc4dc'), 0.35 * day)));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#eef0e6'), 0.3 * day)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * HORIZON * 0.9, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.08, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 248;
        img.data[i + 3] = smoothstep(0.5, 0.68, v) * band * 215;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function seaColors(sky) {
    const deep = mixColor(mixColor(rgb('#2f6f86'), rgb('#26485f'), 0.35), rgb('#10182c'), sky.night * 0.8);
    const shallow = mixColor(mixColor(rgb('#58b0aa'), sky.amb, 0.18), rgb('#1c2e44'), sky.night * 0.8);
    const far = mixColor(mixColor(rgb('#6fb1b4'), sky.low, 0.4), rgb('#1d2440'), sky.night * 0.7);
    return { deep, shallow, far };
  }

  function paintSea(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const col = seaColors(sky);
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(col.far));
    grad.addColorStop(0.25, hex(col.shallow));
    grad.addColorStop(1, hex(col.deep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Paler shallows lie around the island and under the bridge's far end.
    const sx = g.W * ISLAND.x;
    const sy = top + g.U * 3;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, g.W * 0.32);
    glow.addColorStop(0, hex(mixColor(col.shallow, rgb('#e8e2d0'), 0.3 * (1 - sky.night))));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = glow;
    ctx.fillRect(0, top, g.W, g.H * 0.3);
    ctx.globalAlpha = 1;
    // Sun or moon track on the water.
    const lamp = sky.night > 0.5 ? rgb('#e6e4da') : rgb('#fff4d8');
    ctx.save();
    ctx.translate(g.W * 0.38, top);
    ctx.scale(1, 3.2);
    const track = ctx.createRadialGradient(0, 0, 0, 0, 0, g.W * 0.12);
    track.addColorStop(0, `rgba(${lamp[0] | 0},${lamp[1] | 0},${lamp[2] | 0},0.35)`);
    track.addColorStop(1, `rgba(${lamp[0] | 0},${lamp[1] | 0},${lamp[2] | 0},0)`);
    ctx.fillStyle = track;
    ctx.fillRect(-g.W * 0.12, 0, g.W * 0.24, g.H * 0.2);
    ctx.restore();
    return c;
  }

  // Short bright dashes, bigger and further apart toward the viewer.
  function paintWaveTile(g, sky, seed, density) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.H * (1 - HORIZON));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(seed);
    const lit = mixColor(rgb('#f4f0e2'), sky.amb, 0.25).map((v) => v * (1 - sky.night * 0.65));
    const dark = mixColor(rgb('#1f4f68'), rgb('#101a30'), sky.night * 0.7);
    for (let i = 0; i < density; i++) {
      const d = Math.pow(rand(), 1.6);
      const y = d * h;
      const len = g.U * (0.8 + d * 5) * (0.6 + rand() * 0.8);
      const x = rand() * w;
      const th = Math.max(1, g.U * (0.12 + d * 0.5));
      ctx.fillStyle = hex(rand() < 0.7 ? lit : dark);
      ctx.globalAlpha = 0.18 + d * 0.3;
      ctx.fillRect(x, y, len, th);
      if (x + len > w) ctx.fillRect(x - w, y, len, th);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- island ------------------------------------------------------------

  function paintPine(ctx, x, base, s, leaf) {
    ctx.fillStyle = '#4a3a2c';
    ctx.fillRect(x - s * 0.1, base - s * 1.2, Math.max(1, s * 0.2), s * 1.2);
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.ellipse(x, base - s * 1.5, s * 0.9, s * 0.55, 0, 0, 6.3);
    ctx.ellipse(x - s * 0.3, base - s * 1.05, s * 0.7, s * 0.4, 0, 0, 6.3);
    ctx.fill();
  }

  function paintIsland(ctx, g, sky, rand) {
    const top = g.H * HORIZON;
    const cx = g.W * ISLAND.x;
    const hw = g.W * ISLAND.w * 0.5;
    const hgt = g.H * 0.075;
    const moss = mixColor(mixColor(rgb('#4f7a46'), sky.amb, 0.12), rgb('#12201e'), sky.night * 0.75);
    const shade = mixColor(moss, rgb('#26402e'), 0.5);
    const rock = mixColor(mixColor(rgb('#8a7e6c'), sky.amb, 0.15), rgb('#1a1c2a'), sky.night * 0.7);
    // Low rounded headland with a soft ridge.
    ctx.fillStyle = hex(moss);
    ctx.beginPath();
    ctx.moveTo(cx - hw, top + 1);
    for (let i = 0; i <= 40; i++) {
      const f = i / 40;
      const x = cx - hw + f * hw * 2;
      const bump = Math.pow(Math.sin(f * Math.PI), 0.8);
      ctx.lineTo(x, top + 1 - hgt * bump * (0.8 + 0.3 * fbm(f * 5, 3, 2, 7)));
    }
    ctx.lineTo(cx + hw, top + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(shade);
    ctx.fillRect(cx - hw * 0.9, top - g.U * 0.5, hw * 1.8, g.U * 0.9);
    // Pale rock edge at the water.
    ctx.fillStyle = hex(rock);
    ctx.fillRect(cx - hw * 0.95, top, hw * 1.9, Math.max(1, g.U * 0.6));
    const leaf = hex(mixColor(moss, rgb('#25402c'), 0.55));
    for (let i = 0; i < 16; i++) {
      const f = 0.08 + rand() * 0.84;
      const bump = Math.pow(Math.sin(f * Math.PI), 0.8);
      paintPine(ctx, cx - hw + f * hw * 2, top - hgt * bump * 0.55, g.U * (1.4 + rand() * 1.1), leaf);
    }
    paintLighthouse(ctx, g, sky, cx + hw * 0.18, top - hgt * 0.86);
  }

  function paintLighthouse(ctx, g, sky, x, base) {
    const h = g.H * 0.11;
    const w = g.U * 2.1;
    const wash = mixColor(rgb('#f2eee2'), sky.amb, 0.25).map((v) => v * (1 - sky.night * 0.5));
    ctx.fillStyle = hex(wash);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6, base);
    ctx.lineTo(x - w * 0.38, base - h);
    ctx.lineTo(x + w * 0.38, base - h);
    ctx.lineTo(x + w * 0.6, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(wash, rgb('#6a7090'), 0.35));
    ctx.fillRect(x + w * 0.1, base - h, w * 0.3, h);
    // Gallery and lantern room.
    ctx.fillStyle = '#2b2f4a';
    ctx.fillRect(x - w * 0.7, base - h - g.U * 0.5, w * 1.4, Math.max(1, g.U * 0.5));
    ctx.fillStyle = sky.night > 0.4 ? '#e3b94a' : '#c8993a';
    ctx.fillRect(x - w * 0.3, base - h - g.U * 2, w * 0.6, g.U * 1.5);
    ctx.fillStyle = '#c8452c';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42, base - h - g.U * 2);
    ctx.lineTo(x, base - h - g.U * 3.3);
    ctx.lineTo(x + w * 0.42, base - h - g.U * 2);
    ctx.closePath();
    ctx.fill();
    if (sky.night > 0.3) {
      const glow = ctx.createRadialGradient(x, base - h - g.U * 1.3, 0, x, base - h - g.U * 1.3, g.U * 6);
      glow.addColorStop(0, `rgba(240,200,110,${0.5 * sky.night})`);
      glow.addColorStop(1, 'rgba(240,200,110,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - g.U * 6, base - h - g.U * 8, g.U * 12, g.U * 14);
    }
  }

  function paintFarHills(ctx, g, sky) {
    const top = g.H * HORIZON;
    ctx.fillStyle = hex(mixColor(sky.haze, rgb('#4a6a74'), 0.35));
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, top + 1);
    for (let x = 0; x <= g.W * 0.3; x += 2) {
      const f = x / (g.W * 0.3);
      ctx.lineTo(x, top - g.H * 0.03 * Math.pow(1 - f, 1.4) * (0.7 + fbm(x * 0.05, 1, 3, 4) * 0.6));
    }
    ctx.lineTo(g.W * 0.3, top + 1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- bridge ------------------------------------------------------------

  function pt(g, t) {
    const hump = Math.sin(Math.min(1, t * 1.25) * Math.PI) * 0.018 * (1 - t);
    return { x: bez(t, 0) * g.W, y: (bez(t, 1) - hump) * g.H, base: bez(t, 1) * g.H };
  }

  function paintBridge(ctx, g, sky) {
    const top = g.H * HORIZON;
    const deck = mixColor(mixColor(rgb('#f6f2e6'), sky.amb, 0.1), rgb('#2b3150'), sky.night * 0.7);
    const side = mixColor(deck, rgb('#5a6488'), 0.4);
    const rail = mixColor(deck, rgb('#26294a'), 0.5);
    const pier = mixColor(side, rgb('#243050'), 0.3);
    const wk = 0.02;
    let prev = pt(g, 0);
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const p = pt(g, t);
      const ws = (k) => (k.base - top) * wk * 5.2;
      const w0 = ws(prev);
      const w1 = ws(p);
      const drop0 = w0 * 0.55;
      const drop1 = w1 * 0.55;
      // Underside of the deck.
      ctx.fillStyle = hex(side);
      ctx.beginPath();
      ctx.moveTo(prev.x - w0, prev.y);
      ctx.lineTo(p.x - w1, p.y);
      ctx.lineTo(p.x + w1, p.y);
      ctx.lineTo(p.x + w1, p.y + drop1);
      ctx.lineTo(p.x - w1, p.y + drop1);
      ctx.lineTo(prev.x - w0, prev.y + drop0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(prev.x - w0, prev.y);
      ctx.lineTo(prev.x + w0, prev.y);
      ctx.lineTo(p.x + w1, p.y);
      ctx.lineTo(p.x - w1, p.y);
      ctx.closePath();
      ctx.fillStyle = hex(deck);
      ctx.fill();
      // Rails along both edges.
      ctx.fillStyle = hex(rail);
      ctx.fillRect(prev.x - w0, prev.y - Math.max(1, w0 * 0.22), Math.max(1, w0 * 0.12), Math.max(1, w0 * 0.22));
      ctx.fillRect(prev.x + w0 * 0.88, prev.y - Math.max(1, w0 * 0.22), Math.max(1, w0 * 0.12), Math.max(1, w0 * 0.22));
      // Piers dip into the water at regular spacing.
      if (i % 6 === 0 && i < STEPS - 2) {
        ctx.fillStyle = hex(pier);
        const pw = Math.max(1, w1 * 0.16);
        ctx.fillRect(p.x - w1 * 0.7, p.y + drop1, pw, Math.max(1, p.base - p.y));
        ctx.fillRect(p.x + w1 * 0.6, p.y + drop1, pw, Math.max(1, p.base - p.y));
      }
      prev = p;
    }
  }

  // Soft dark band of the bridge reflected below it, shimmering slightly in draw.
  function paintShadow(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * HORIZON;
    ctx.fillStyle = hex(mixColor(rgb('#1d4558'), rgb('#0a1020'), sky.night * 0.6));
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < STEPS; i++) {
      const p = pt(g, i / STEPS);
      const w = (p.base - top) * 0.062;
      ctx.fillRect(p.x - w * 1.1, p.base + w * 0.2, w * 2.2, Math.max(1, w * 0.45));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    state.sky = paintSky(g, sky, rand);
    state.sea = paintSea(g, sky, rand);
    state.shadow = paintShadow(g, sky);
    state.wavesA = paintWaveTile(g, sky, 5, Math.round(g.W * 0.9));
    state.wavesB = paintWaveTile(g, sky, 9, Math.round(g.W * 0.6));
    const front = layer(g.W, g.H);
    const f = front.getContext('2d');
    paintFarHills(f, g, sky);
    paintIsland(f, g, sky, rand);
    paintBridge(f, g, sky);
    state.front = front;
    state.cloudAlpha = 0.8 - sky.night * 0.55;
    state.night = sky.night;
    state.lamp = sky.night > 0.5 ? '#e6e4da' : '#fff4d8';
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.5) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawWaves(ctx, g, t, amount) {
    if (amount <= 0) return;
    const top = Math.floor(g.H * HORIZON);
    const w = state.wavesA.width;
    const h = state.wavesA.height;
    const a = (t * g.U * 1.6) % w;
    const b = w - ((t * g.U * 1.0) % w);
    const bob = Math.sin(t * 0.9) * g.U * 0.5;
    ctx.globalAlpha = Math.min(1, amount);
    ctx.drawImage(state.wavesA, a, top + bob);
    ctx.drawImage(state.wavesA, a - w, top + bob);
    ctx.globalAlpha = Math.min(1, amount * 0.8);
    ctx.drawImage(state.wavesB, b, top - bob * 0.6);
    ctx.drawImage(state.wavesB, b - w, top - bob * 0.6);
    ctx.globalAlpha = 1;
  }

  // Sparkles on the water that swell and fade.
  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    const top = g.H * HORIZON;
    ctx.fillStyle = state.lamp;
    for (let i = 0; i < GLINTS; i++) {
      const ph = (t * 0.25 + i * 0.37) % 1;
      const d = ((i * 0.6180339) % 1);
      const x = g.W * (0.2 + 0.7 * ((i * 0.41 + Math.floor(t * 0.25 + i * 0.37) * 0.23) % 1));
      const y = top + g.H * (0.04 + d * 0.5) * (0.6 + 0.4 * d);
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.55 * (1 - state.night * 0.5) * Math.min(1, amount);
      ctx.fillRect(x, y, g.U * (1 + d * 2.5), Math.max(1, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function drawGull(ctx, x, y, s, flap) {
    ctx.beginPath();
    ctx.moveTo(x - s, y + flap * s * 0.6);
    ctx.lineTo(x, y);
    ctx.lineTo(x + s, y + flap * s * 0.6);
    ctx.stroke();
  }

  function drawGulls(ctx, g, t) {
    ctx.strokeStyle = state.night > 0.5 ? '#9aa0bc' : '#f4f0e6';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < 3; i++) {
      const a = (t * (0.012 + i * 0.002) + i * 0.33) % 1.2 - 0.1;
      const x = g.W * a;
      const y = g.H * (0.17 + i * 0.045) + Math.sin(t * 0.5 + i * 2) * g.U * 1.5;
      drawGull(ctx, x, y, g.U * (1.4 - i * 0.2), Math.sin(t * 3 + i * 1.5));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.sea, 0, 0);
    drawWaves(ctx, g, t, props.waves);
    drawGlints(ctx, g, t, props.waves);
    ctx.drawImage(state.shadow, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    if (props.gulls) drawGulls(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', waves: 1, clouds: 1, gulls: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
