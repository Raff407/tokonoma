/*
 * 民家 Minka — a thatched farmhouse among rice paddies and cedar hills.
 *
 * Sky, hills, house, gate and paddies are baked into layers and repainted
 * once a minute from the clock, so the windows glow at night. Between
 * repaints only clouds, chimney smoke, a few egrets and the rice wave move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.5;
  const FIELD_TOP = 0.7;
  const HOUSE = { x0: 0.2, x1: 0.56, ridge: 0.4, eave: 0.585, wall: 0.665 };
  const VENT = { x: 0.38, y: 0.455 };
  const GATE_X = 0.8;
  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 14;
  const WAVES = 12;
  const SEASONS = {
    spring: { rice: '#8fae62', water: 0.5, leaf: '#4f6a46', fleck: '#d8b4b0', snow: 0 },
    summer: { rice: '#4f7a3e', water: 0.15, leaf: '#33523a', fleck: null, snow: 0 },
    autumn: { rice: '#b79a3c', water: 0, leaf: '#4a5a38', fleck: '#b4492c', snow: 0 },
    winter: { rice: '#c9ccd0', water: 0.2, leaf: '#3a4a46', fleck: null, snow: 1 },
  };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const px = (g, f) => g.W * f;
  const py = (g, f) => g.H * f;
  const dim = (c, sky, k) => hex(mixColor(rgb(c), mixColor(rgb(c), rgb('#141828'), 0.7), sky.night * k));

  // ---- sky and hills -----------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.38, 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ece6cc';
      ctx.globalAlpha = 0.9 * sky.night;
      ctx.beginPath();
      ctx.arc(px(g, 0.78), py(g, 0.14), g.U * 2.6, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 17);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.52, 0.7, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(226,224,218,0.55)');
    grad.addColorStop(1, 'rgba(226,224,218,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // A soft ridge of hills filled down to the horizon.
  function paintRidge(ctx, g, base, amp, seed, color, freq) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, py(g, HORIZON) + 1);
    for (let x = 0; x <= g.W; x += 2) {
      ctx.lineTo(x, py(g, base) - fbm(x * freq, seed, 3, seed) * g.H * amp);
    }
    ctx.lineTo(g.W, py(g, HORIZON) + 1);
    ctx.fill();
  }

  function cedar(ctx, x, y, h, w) {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x - w, y);
    ctx.fill();
  }

  function paintHills(g, sky, season, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidge(ctx, g, 0.5, 0.1, 3, hex(mixColor(sky.haze, sky.low, 0.35)), 0.012);
    paintRidge(ctx, g, 0.53, 0.09, 8, hex(mixColor(rgb('#56708a'), sky.haze, 0.5)), 0.02);
    const green = mixColor(mixColor(rgb(season.leaf), sky.amb, 0.12), rgb('#10161e'), sky.night * 0.7);
    paintRidge(ctx, g, 0.575, 0.075, 12, hex(green), 0.03);
    // Cedars along the near ridge, taller on the left and right edges.
    ctx.fillStyle = hex(mixColor(green, rgb('#0f1a16'), 0.35));
    for (let i = 0; i < 70; i++) {
      const x = rand() * g.W;
      const edge = Math.abs(x / g.W - 0.4) > 0.3 ? 1 : 0.55;
      const y = py(g, 0.585) - fbm(x * 0.03, 12, 3, 12) * g.H * 0.075 + g.U * 2;
      cedar(ctx, x, y, g.U * (5 + rand() * 6) * edge, g.U * (0.8 + rand() * 0.5));
    }
    if (season.fleck) {
      ctx.fillStyle = season.fleck;
      ctx.globalAlpha = 0.55 * (1 - sky.night * 0.6);
      for (let i = 0; i < 36; i++) {
        ctx.beginPath();
        ctx.arc(rand() * g.W, py(g, 0.56 + rand() * 0.04), g.U * (0.6 + rand() * 0.8), 0, 6.3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Low mist at the foot of the hills.
    const mist = ctx.createLinearGradient(0, py(g, 0.54), 0, py(g, HORIZON + 0.12));
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(1, hex(sky.haze));
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = mist;
    ctx.fillRect(0, py(g, 0.54), g.W, py(g, 0.12));
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- house -------------------------------------------------------------

  function paintWall(ctx, g, sky) {
    const x0 = px(g, HOUSE.x0 + 0.03);
    const w = px(g, HOUSE.x1 - HOUSE.x0 - 0.06);
    const top = py(g, HOUSE.eave);
    const h = py(g, HOUSE.wall - HOUSE.eave);
    ctx.fillStyle = dim('#e4dccb', sky, 0.55);
    ctx.fillRect(x0, top, w, h);
    // Shoji panes glow warm after dusk.
    const glow = mixColor(rgb('#f0e6c8'), rgb('#f2c872'), sky.night);
    const pane = hex(mixColor(mixColor(glow, sky.amb, (1 - sky.night) * 0.2), rgb('#6a6c7c'), (1 - sky.night) * 0.15));
    const wins = [0.07, 0.17, 0.27];
    for (const f of wins) {
      ctx.fillStyle = pane;
      ctx.fillRect(x0 + w * f * 2.4 + w * 0.06, top + h * 0.15, w * 0.15, h * 0.7);
    }
    ctx.fillStyle = dim('#3a2c24', sky, 0.7);
    for (const f of wins) {
      const wx = x0 + w * f * 2.4 + w * 0.06;
      ctx.fillRect(wx, top + h * 0.15, w * 0.15, 1);
      ctx.fillRect(wx, top + h * 0.85, w * 0.15, 1);
      ctx.fillRect(wx + w * 0.075, top + h * 0.15, 1, h * 0.7);
    }
    // Dark timber posts and a plinth of stones.
    for (let k = 0; k <= 8; k++) ctx.fillRect(x0 + (w * k) / 8, top, Math.max(1, g.U * 0.5), h);
    ctx.fillRect(x0, top + h * 0.45, w, 1);
    ctx.fillStyle = dim('#6c6860', sky, 0.7);
    ctx.fillRect(x0 - 1, top + h * 0.9, w + 2, h * 0.14);
    // Veranda and a lit entrance.
    ctx.fillStyle = dim('#7a5a3c', sky, 0.7);
    ctx.fillRect(x0 - g.U, top + h, w + g.U * 2, Math.max(1, g.U * 0.7));
  }

  function paintThatch(ctx, g, sky, season) {
    const rf = px(g, HOUSE.ridge === 0 ? 0 : 0.3);
    const ridgeL = px(g, 0.3);
    const ridgeR = px(g, 0.46);
    const ridgeY = py(g, HOUSE.ridge);
    const eaveY = py(g, HOUSE.eave);
    const eaveL = px(g, HOUSE.x0 - 0.02);
    const eaveR = px(g, HOUSE.x1 + 0.02);
    const base = mixColor(rgb('#8a7248'), sky.amb, 0.22);
    const thatch = hex(mixColor(base, rgb('#2c3248'), sky.night * 0.6));
    const dark = hex(mixColor(mixColor(base, rgb('#3a2e1e'), 0.5), rgb('#12141e'), sky.night * 0.7));
    const grad = ctx.createLinearGradient(0, ridgeY, 0, eaveY);
    grad.addColorStop(0, thatch);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ridgeL, ridgeY);
    ctx.lineTo(ridgeR, ridgeY);
    ctx.lineTo(eaveR, eaveY);
    ctx.lineTo(eaveL, eaveY);
    ctx.fill();
    // Thick bundled courses of straw.
    ctx.strokeStyle = dark;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (let y = ridgeY + g.U * 1.6; y < eaveY; y += g.U * 1.9) {
      const k = (y - ridgeY) / (eaveY - ridgeY);
      ctx.beginPath();
      ctx.moveTo(lerp(ridgeL, eaveL, k), y);
      ctx.lineTo(lerp(ridgeR, eaveR, k), y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Gable vent: a small hipped hood on the upper face lets the smoke out.
    const vx = px(g, VENT.x);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(vx, ridgeY + g.U * 0.5);
    ctx.lineTo(vx + g.U * 4.5, ridgeY + g.U * 7);
    ctx.lineTo(vx - g.U * 4.5, ridgeY + g.U * 7);
    ctx.fill();
    ctx.fillStyle = dim('#3a2c24', sky, 0.9);
    ctx.fillRect(vx - g.U * 2, ridgeY + g.U * 3.4, g.U * 4, g.U * 3.4);
    // Ridge roll with crossed ends.
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#a28a58'), sky.amb, 0.2), rgb('#1c2030'), sky.night * 0.7));
    ctx.fillRect(ridgeL - g.U, ridgeY - g.U * 1.1, ridgeR - ridgeL + g.U * 2, g.U * 1.3);
    ctx.strokeStyle = dim('#5a4a30', sky, 0.8);
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (const ex of [ridgeL - g.U * 0.5, ridgeR + g.U * 0.5]) {
      ctx.beginPath();
      ctx.moveTo(ex - g.U * 1.3, ridgeY - g.U * 3.4);
      ctx.lineTo(ex + g.U * 1.3, ridgeY - g.U * 0.5);
      ctx.moveTo(ex + g.U * 1.3, ridgeY - g.U * 3.4);
      ctx.lineTo(ex - g.U * 1.3, ridgeY - g.U * 0.5);
      ctx.stroke();
    }
    if (season.snow) {
      ctx.fillStyle = '#e8ecee';
      ctx.globalAlpha = 0.8 - sky.night * 0.35;
      ctx.beginPath();
      ctx.moveTo(ridgeL, ridgeY - g.U * 0.8);
      ctx.lineTo(ridgeR, ridgeY - g.U * 0.8);
      ctx.lineTo(lerp(ridgeR, eaveR, 0.5), lerp(ridgeY, eaveY, 0.5));
      ctx.lineTo(lerp(ridgeL, eaveL, 0.5), lerp(ridgeY, eaveY, 0.5));
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return rf;
  }

  function paintGate(ctx, g, sky, season) {
    const gx = px(g, GATE_X);
    const base = py(g, 0.78);
    const post = g.U * 1.2;
    const span = g.U * 11;
    const top = base - g.U * 12;
    ctx.fillStyle = dim('#4a3426', sky, 0.8);
    ctx.fillRect(gx - span / 2, top, post, base - top);
    ctx.fillRect(gx + span / 2 - post, top, post, base - top);
    ctx.fillRect(gx - span / 2 - g.U, top + g.U * 2.4, span + g.U * 2, g.U * 1.1);
    // Low tiled cap over the beam.
    ctx.fillStyle = dim('#34383e', sky, 0.8);
    ctx.beginPath();
    ctx.moveTo(gx - span / 2 - g.U * 2.6, top + g.U * 1.2);
    ctx.lineTo(gx + span / 2 + g.U * 2.6, top + g.U * 1.2);
    ctx.lineTo(gx + span / 2 + g.U * 0.5, top - g.U * 1.6);
    ctx.lineTo(gx - span / 2 - g.U * 0.5, top - g.U * 1.6);
    ctx.fill();
    // Plank doors, one slightly open, and a bamboo fence either side.
    ctx.fillStyle = dim('#6a4c32', sky, 0.8);
    ctx.fillRect(gx - span / 2 + post, top + g.U * 3.6, span / 2 - post - 1, base - top - g.U * 3.6);
    ctx.fillRect(gx + 1, top + g.U * 3.6, span / 2 - post, base - top - g.U * 3.6);
    ctx.fillStyle = dim('#3a281c', sky, 0.8);
    for (let k = 1; k < 5; k++) ctx.fillRect(gx - span / 2 + post + k * (span / 2 - post) / 5, top + g.U * 3.6, 1, base - top - g.U * 3.6);
    ctx.fillStyle = dim('#a79a68', sky, 0.7);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const fx = gx + side * (span / 2 + g.U * 1 + k * g.U * 1.6);
        ctx.fillRect(fx, base - g.U * 6, Math.max(1, g.U * 0.55), g.U * 6);
      }
      const x0 = gx + side * (span / 2 + g.U);
      ctx.fillRect(Math.min(x0, x0 + side * g.U * 9.6), base - g.U * 4.4, g.U * 9.6, 1);
    }
    if (season.snow) {
      ctx.fillStyle = '#e4e8ea';
      ctx.fillRect(gx - span / 2 - g.U * 2.6, top - g.U * 2.2, span + g.U * 5.2, g.U * 0.9);
    }
  }

  // ---- paddies and path ---------------------------------------------------

  function paintPaddies(g, sky, season, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = py(g, FIELD_TOP);
    const bottom = g.H;
    const rice = mixColor(mixColor(rgb(season.rice), sky.amb, 0.15), rgb('#121a22'), sky.night * 0.7);
    const water = mixColor(sky.low, rgb('#2c3a54'), 0.3 + sky.night * 0.3);
    let y = top;
    let row = 0;
    while (y < bottom) {
      const k = (y - top) / (bottom - top);
      const hgt = g.U * (3.5 + k * 11);
      const tone = hex(mixColor(rice, rgb('#2a3a22'), (row % 2) * 0.18 + 0.02));
      ctx.fillStyle = tone;
      ctx.fillRect(0, y, g.W, hgt);
      if (season.water > 0) {
        ctx.fillStyle = hex(water);
        ctx.globalAlpha = season.water;
        ctx.fillRect(0, y, g.W, hgt);
        ctx.globalAlpha = 1;
      }
      // Rows of seedlings seen in perspective.
      ctx.fillStyle = hex(mixColor(rice, rgb('#0e1a10'), 0.35));
      ctx.globalAlpha = 0.55;
      const step = g.U * (1.6 + k * 4);
      for (let x = (row * 7) % step; x < g.W; x += step) ctx.fillRect(x, y + 1, 1, hgt - 1);
      ctx.globalAlpha = 1;
      // Earthen bund between terraces.
      ctx.fillStyle = hex(mixColor(mixColor(rgb('#8a7a58'), sky.amb, 0.15), rgb('#1a1c26'), sky.night * 0.7));
      ctx.fillRect(0, y + hgt - Math.max(1, g.U * 0.5), g.W, Math.max(1, g.U * 0.7));
      y += hgt + g.U * 0.4;
      row++;
    }
    // Packed-earth lane from the gate down to the viewer.
    const lane = mixColor(mixColor(rgb('#a69272'), sky.amb, 0.2), rgb('#1c1e2a'), sky.night * 0.7);
    ctx.fillStyle = hex(lane);
    ctx.beginPath();
    ctx.moveTo(px(g, GATE_X) - g.U * 3, py(g, 0.78));
    ctx.lineTo(px(g, GATE_X) + g.U * 3, py(g, 0.78));
    ctx.lineTo(px(g, GATE_X) + g.W * 0.12, g.H);
    ctx.lineTo(px(g, GATE_X) - g.W * 0.2, g.H);
    ctx.fill();
    // Field edge at the house: a strip of earth and grass.
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#7e8a52'), sky.amb, 0.12), rgb('#16201a'), sky.night * 0.7));
    ctx.fillRect(0, py(g, HOUSE.wall - 0.004), g.W, py(g, FIELD_TOP - HOUSE.wall + 0.004));
    ctx.fillStyle = hex(mixColor(rgb('#6c6254'), rgb('#1a1c24'), sky.night * 0.7));
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(px(g, HOUSE.x0) + rand() * px(g, 0.4), py(g, 0.67 + rand() * 0.03), g.U * 0.9, g.U * 0.5);
    }
    if (season.snow) {
      ctx.fillStyle = '#e6eaec';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, py(g, HOUSE.wall), g.W, g.H - py(g, HOUSE.wall));
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, season, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(state.hills, 0, 0);
    paintWall(ctx, g, sky);
    paintThatch(ctx, g, sky, season);
    return c;
  }

  function repaint(g, props) {
    const sky = S.at(S.hour(props.time));
    const season = SEASONS[props.season] || SEASONS.summer;
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.hills = paintHills(g, sky, season, rand);
    state.field = paintPaddies(g, sky, season, rand);
    state.front = paintFront(g, sky, season, rand);
    state.gate = layer(g.W, g.H);
    paintGate(state.gate.getContext('2d'), g, sky, season);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.sheen = hex(mixColor(sky.low, rgb('#e8e4d4'), 0.5));
    state.choice = props.time;
    state.season = props.season;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 3) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // Egrets cross the sky now and then, three white wings beating slowly.
  function drawEgrets(ctx, g, t) {
    if (state.night > 0.6) return;
    const p = (t % 50) / 28;
    if (p >= 1) return;
    ctx.strokeStyle = '#ece8dc';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < 3; i++) {
      const bx = lerp(-g.W * 0.05, g.W * 1.05, p) - i * g.U * 4;
      const by = g.H * 0.3 + i * g.U * 1.6 + Math.sin(t * 0.7 + i) * g.U;
      const flap = Math.sin(t * 3.2 + i * 1.3) * g.U * 0.9;
      ctx.beginPath();
      ctx.moveTo(bx - g.U * 1.5, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + g.U * 1.5, by - flap);
      ctx.stroke();
    }
  }

  function drawSmoke(ctx, g, t, amount) {
    if (amount <= 0) return;
    const x0 = px(g, VENT.x);
    const y0 = py(g, VENT.y);
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.09 + i / MAX_PUFFS) % 1;
      const size = g.U * (3 + a * 12);
      const dx = a * g.U * 12 + Math.sin(t * 0.5 + i * 1.9) * g.U * (0.5 + a * 2);
      const dy = -a * g.U * 24;
      ctx.globalAlpha = Math.min(1, amount) * (1 - a) * 1.2;
      ctx.drawImage(state.puff, x0 + dx - size / 2, y0 + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Slow gusts run along the paddies as pale bands of light.
  function drawRiceWave(ctx, g, t) {
    const top = py(g, FIELD_TOP);
    ctx.fillStyle = state.sheen;
    for (let i = 0; i < WAVES; i++) {
      const k = (i + 0.5) / WAVES;
      const y = top + k * k * (g.H - top);
      const w = g.W * (0.14 + k * 0.1);
      const x = ((t * g.U * (1.2 + k) + i * g.W * 0.31) % (g.W + w)) - w;
      ctx.globalAlpha = 0.45 * (1 - state.night * 0.5);
      ctx.fillRect(x, y, w, Math.max(1, g.U * (0.9 + k * 2.4)));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.26));
    state.puff = paintPuff();
    repaint(g, api.props);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.season !== props.season) repaint(g, props);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    drawEgrets(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    ctx.drawImage(state.field, 0, 0);
    ctx.drawImage(state.gate, 0, 0);
    drawRiceWave(ctx, g, t);
    drawSmoke(ctx, g, t, props.smoke);
  }

  Kasuri.run({
    defaults: { time: 'auto', season: 'summer', smoke: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
