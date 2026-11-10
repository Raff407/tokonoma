/*
 * 瀬戸 Seto — islands layered into the haze on the Inland Sea at dusk.
 *
 * Sky, island ranks, a torii in the shallows and the sea with its reflections
 * are baked into layers and repainted once a minute from the clock. Between
 * repaints only thin cloud, sea glints, a ferry and a small fishing boat move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.56;
  const RETINT_SECONDS = 60;
  const GLINTS = 30;
  // Island ranks from far to near: [centre, half width, height, seed] per hill.
  const RANKS = [
    { haze: 0.8, tone: '#7a86a8', list: [[0.12, 0.14, 0.14, 3], [0.5, 0.22, 0.17, 5], [0.88, 0.16, 0.13, 8]] },
    { haze: 0.64, tone: '#5a6a92', list: [[0.34, 0.15, 0.13, 11], [0.72, 0.2, 0.16, 13]] },
    { haze: 0.46, tone: '#3f5a66', list: [[0.06, 0.14, 0.12, 17], [0.54, 0.15, 0.1, 19]] },
    { haze: 0.2, tone: '#2e4a34', list: [[0.26, 0.2, 0.12, 23], [0.88, 0.2, 0.15, 29]] },
  ];
  const TORII = { x: 0.14, y: 0.78 };
  const state = {};

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hz = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, 0, 0, hz);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(0.5, hex(mixColor(sky.top, sky.low, 0.5)));
    grad.addColorStop(0.85, hex(sky.low));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#f3d9a8'), 0.35 * (1 - sky.night))));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, hz + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * hz * 0.7, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintBody(ctx, g, sky);
    return c;
  }

  // Sun low in the west by day, moon by night.
  function paintBody(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const bx = g.W * (0.14 + t * 0.72);
    const by = g.H * (HORIZON - 0.02 - Math.sin(t * Math.PI) * 0.26);
    const r = g.U * (night ? 3 : 4.2);
    const tint = night ? '226,226,214' : '250,214,160';
    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, r * 7);
    glow.addColorStop(0, `rgba(${tint},${night ? 0.28 : 0.5})`);
    glow.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(bx - r * 7, by - r * 7, r * 14, r * 14);
    ctx.fillStyle = night ? '#ece8d6' : '#f7e2b4';
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, 6.3);
    ctx.fill();
    state.bodyX = bx;
    state.night = sky.night;
  }

  // Wisps that tile sideways, kept to the upper sky.
  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.012, y * 0.09, 4, 37);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 250;
        img.data[i + 1] = 226;
        img.data[i + 2] = 214;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- islands -----------------------------------------------------------

  function ridge(fx, list) {
    let top = 0;
    for (const [cx, wd, pk, sd] of list) {
      const d = Math.abs(fx - cx) / wd;
      if (d >= 1) continue;
      const body = Math.pow(1 - d * d, 1.4);
      top = Math.max(top, pk * body + (fbm(fx * 11, sd, 3, sd) - 0.5) * 0.02 * body);
    }
    return top;
  }

  function paintRank(ctx, g, sky, rank, index) {
    const base = rgb(rank.tone);
    const hazeAmt = Math.min(1, rank.haze * state.hazeAmt);
    const col = mixColor(base, mixColor(sky.haze, sky.low, 0.5), hazeAmt * 0.8);
    const dark = mixColor(col, rgb('#1c2238'), 0.25);
    const hz = g.H * HORIZON;
    for (let px = 0; px < g.W; px++) {
      const top = ridge(px / g.W, rank.list);
      if (top <= 0) continue;
      const y0 = hz - top * g.H;
      ctx.fillStyle = hex(col);
      ctx.fillRect(px, y0, 1, hz + 1 - y0);
      // Ridge edge a touch lighter, foot a touch darker.
      ctx.fillStyle = hex(mixColor(col, sky.low, 0.25));
      ctx.fillRect(px, y0, 1, 1);
      ctx.fillStyle = hex(dark);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(px, hz - g.U * 1.2, 1, g.U * 1.2 + 1);
      ctx.globalAlpha = 1;
    }
    if (index >= 2) paintPines(ctx, g, sky, rank, dark, index);
  }

  // Small pine tufts along the nearer ridges; terraced orchard stripes below them.
  function paintPines(ctx, g, sky, rank, dark, index) {
    const rand = K.rng(60 + index);
    const hz = g.H * HORIZON;
    ctx.fillStyle = hex(mixColor(dark, rgb('#1f3322'), 0.4 * (1 - rank.haze)));
    const count = Math.round(g.W * 0.22);
    for (let i = 0; i < count; i++) {
      const px = rand() * g.W;
      const top = ridge(px / g.W, rank.list);
      if (top < 0.02) continue;
      const y = hz - top * g.H + rand() * top * g.H * 0.35;
      const s = g.U * (0.9 + rand() * 0.9);
      ctx.beginPath();
      ctx.moveTo(px, y - s * 1.6);
      ctx.lineTo(px - s * 0.7, y);
      ctx.lineTo(px + s * 0.7, y);
      ctx.fill();
    }
    ctx.fillStyle = hex(mixColor(rgb('#5f7a48'), sky.amb, 0.3));
    ctx.globalAlpha = 0.28;
    for (let px = 0; px < g.W; px += 2) {
      const top = ridge(px / g.W, rank.list);
      if (top < 0.03) continue;
      const y0 = hz - top * g.H * 0.55;
      for (let k = 0; k < 3; k++) ctx.fillRect(px, y0 + k * g.U * 1.5, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- sea and torii -----------------------------------------------------

  function paintSea(ctx, g, sky) {
    const hz = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, hz, 0, g.H);
    const lowSea = mixColor(rgb('#26405a'), sky.top, 0.35);
    grad.addColorStop(0, hex(mixColor(sky.low, rgb('#f0d6b0'), 0.15 * (1 - sky.night))));
    grad.addColorStop(0.35, hex(mixColor(sky.low, lowSea, 0.55)));
    grad.addColorStop(1, hex(mixColor(lowSea, rgb('#1c2640'), 0.2)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, hz, g.W, g.H - hz);
  }

  // The island ranks flipped into the water, faint, squeezed to a third.
  function paintReflection(ctx, g, source) {
    const hz = Math.round(g.H * HORIZON);
    const rh = Math.round(g.H * 0.16);
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (let y = 0; y < rh; y++) {
      const sy = hz - 1 - Math.round((y / rh) * g.H * 0.18);
      if (sy < 0) break;
      ctx.drawImage(source, 0, sy, g.W, 1, y % 2 ? 1 : 0, hz + y, g.W, 1);
    }
    ctx.restore();
  }

  // A small vermilion torii standing in the shallows, with a gold-lit pier stone beneath.
  function paintTorii(ctx, g, sky) {
    const cx = g.W * TORII.x;
    const by = g.H * TORII.y;
    const u = g.U;
    const post = mixColor(rgb('#b8402a'), sky.haze, 0.18 + 0.25 * sky.night);
    const dark = mixColor(post, rgb('#2a1c24'), 0.4);
    const h = u * 11;
    const half = u * 3.6;
    ctx.fillStyle = hex(post);
    ctx.fillRect(cx - half - u * 0.55, by - h, u * 1.1, h);
    ctx.fillRect(cx + half - u * 0.55, by - h, u * 1.1, h);
    ctx.fillRect(cx - half - u * 0.9, by - h * 0.74, half * 2 + u * 1.8, u * 0.8);
    ctx.fillStyle = hex(dark);
    ctx.beginPath();
    ctx.moveTo(cx - half - u * 2.4, by - h - u * 0.2);
    ctx.lineTo(cx + half + u * 2.4, by - h - u * 0.2);
    ctx.lineTo(cx + half + u * 1.7, by - h - u * 1.5);
    ctx.lineTo(cx - half - u * 1.7, by - h - u * 1.5);
    ctx.fill();
    ctx.fillStyle = hex(post);
    ctx.fillRect(cx - half - u * 1.8, by - h - u * 1.7, half * 2 + u * 3.6, u * 0.6);
    // Reflection in a few thin rows.
    ctx.globalAlpha = 0.28;
    for (let k = 0; k < 8; k++) {
      ctx.fillRect(cx - half - u * 0.5 + (k % 2), by + u * 0.4 + k * u * 0.8, u * 1.1, u * 0.45);
      ctx.fillRect(cx + half - u * 0.5 - (k % 2), by + u * 0.4 + k * u * 0.8, u * 1.1, u * 0.45);
    }
    ctx.globalAlpha = 1;
  }

  // ---- boats -------------------------------------------------------------

  function paintFerry(g, sky) {
    const u = g.U;
    const w = Math.ceil(u * 22);
    const h = Math.ceil(u * 9);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const dim = (hx) => hex(mixColor(rgb(hx), mixColor(sky.haze, sky.top, 0.4), 0.2 + 0.45 * sky.night));
    ctx.fillStyle = dim('#2a3144');
    ctx.beginPath();
    ctx.moveTo(0, h - u * 3);
    ctx.lineTo(w, h - u * 3);
    ctx.lineTo(w - u * 1.6, h);
    ctx.lineTo(u * 1.2, h);
    ctx.fill();
    ctx.fillStyle = dim('#c24a30');
    ctx.fillRect(u * 0.6, h - u * 3, w - u * 1.4, u * 0.7);
    ctx.fillStyle = dim('#e8e0cc');
    ctx.fillRect(u * 2, h - u * 5.4, w - u * 5, u * 2.4);
    ctx.fillRect(u * 6, h - u * 7.4, w - u * 12, u * 2);
    ctx.fillStyle = dim('#2a3144');
    ctx.fillRect(u * 12.5, h - u * 8.8, u * 1.6, u * 1.6);
    ctx.fillStyle = dim('#c24a30');
    ctx.fillRect(u * 12.5, h - u * 8.8, u * 1.6, u * 0.5);
    const lit = 0.25 + sky.night * 0.7;
    ctx.fillStyle = '#f2d890';
    ctx.globalAlpha = lit;
    for (let x = u * 3; x < w - u * 3; x += u * 1.6) ctx.fillRect(x, h - u * 4.8, u * 0.7, u * 0.8);
    for (let x = u * 7; x < w - u * 7; x += u * 1.6) ctx.fillRect(x, h - u * 6.8, u * 0.7, u * 0.7);
    ctx.globalAlpha = 1;
    return c;
  }

  function paintFisher(g, sky) {
    const u = g.U;
    const w = Math.ceil(u * 7);
    const h = Math.ceil(u * 4);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const body = hex(mixColor(rgb('#2a2e3c'), sky.top, 0.2));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, h - u * 1.4);
    ctx.lineTo(w, h - u * 1.4);
    ctx.lineTo(w - u * 1, h);
    ctx.lineTo(u * 0.8, h);
    ctx.fill();
    ctx.fillRect(u * 2.2, h - u * 3, u * 1.8, u * 1.6);
    ctx.fillRect(u * 5, h - u * 3.6, u * 0.3, u * 2.2);
    ctx.fillStyle = hex(rgb('#b8402a'));
    ctx.fillRect(u * 2.2, h - u * 3, u * 1.8, u * 0.4);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.hazeAmt = state.haze;
    state.sky = paintSky(g, sky, rand);
    const front = layer(g.W, g.H);
    const ctx = front.getContext('2d');
    paintSea(ctx, g, sky);
    const land = layer(g.W, g.H);
    const lctx = land.getContext('2d');
    RANKS.forEach((rank, i) => paintRank(lctx, g, sky, rank, i));
    ctx.drawImage(land, 0, 0);
    paintReflection(ctx, g, land);
    paintTorii(ctx, g, sky);
    state.front = front;
    state.ferry = paintFerry(g, sky);
    state.fisher = paintFisher(g, sky);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.glint = mixColor(rgb('#f8dca4'), sky.amb, 0.3);
    state.choice = choice;
    state.hazeSeen = state.haze;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // Short bright dashes on the water, thickest below the sun or moon.
  function drawGlints(ctx, g, t) {
    const hz = g.H * HORIZON;
    ctx.fillStyle = hex(state.glint);
    for (let i = 0; i < GLINTS; i++) {
      const a = state.glintSeed[i];
      const depth = (a[0] + i * 0.037) % 1;
      const y = hz + g.U * 1 + depth * (g.H - hz) * 0.8;
      const spread = g.W * (0.04 + depth * 0.14);
      const x = state.bodyX + (a[1] - 0.5) * 2 * spread;
      const pulse = 0.5 + 0.5 * Math.sin(t * (0.8 + a[2]) + i * 2.3);
      ctx.globalAlpha = pulse * 0.85 * (1 - state.night * 0.4);
      ctx.fillRect(x, y, g.U * (1 + depth * 2.2), Math.max(1, g.U * 0.35));
    }
    ctx.globalAlpha = 1;
  }

  function drawBoats(ctx, g, t) {
    const ferry = state.ferry;
    const fy = g.H * 0.64;
    const span = g.W + ferry.width * 2;
    const fx = ((t * g.W * 0.012 + span * 0.3) % span) - ferry.width;
    ctx.drawImage(ferry, fx, fy - ferry.height);
    ctx.globalAlpha = 0.25;
    ctx.drawImage(ferry, 0, ferry.height - 2, ferry.width, 2, fx, fy + g.U * 0.3, ferry.width, g.U * 1.2);
    ctx.fillStyle = '#e9e2d0';
    ctx.fillRect(fx - g.U * 7, fy - 1, g.U * 7, 1);
    ctx.globalAlpha = 1;
    const fish = state.fisher;
    const fyy = g.H * 0.8;
    const fspan = g.W + fish.width * 2;
    const fxx = g.W + fish.width - ((t * g.W * 0.007 + fspan * 0.55) % fspan);
    ctx.drawImage(fish, fxx, fyy - fish.height + Math.sin(t * 0.9) * g.U * 0.2);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.haze = api.props.haze;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    const rand = K.rng(77);
    state.glintSeed = Array.from({ length: GLINTS }, () => [rand(), rand(), rand()]);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.haze = props.haze;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.hazeSeen !== props.haze) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawGlints(ctx, g, t);
    if (props.boats) drawBoats(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dusk', haze: 1, boats: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
