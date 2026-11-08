/*
 * コンビニ Konbini — a corner convenience store with Mount Fuji right behind it.
 *
 * Sky, mountain, shop and car park are baked into two layers and repainted
 * once a minute from the clock, so the shop glows at night. Between repaints
 * only clouds, a snow plume, four banners and the odd shopper move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  // Heights as fractions of the screen, top to bottom.
  const HORIZON = 0.545;
  const ROOF = 0.525;
  const BAND = [0.565, 0.62];
  const GLASS = [0.625, 0.86];
  const SHOP = [0.07, 0.93];
  const PEAK = { x: 0.765, y: 0.26 };
  const DOOR = 0.43;
  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 16;
  const GOODS = ['#c8453a', '#d9a73a', '#3c6a4a', '#2f4c8a', '#e8e2d0', '#8a5a3a', '#b8412c'];
  const BANNERS = [
    { x: 0.165, ink: '#c8453a' },
    { x: 0.245, ink: '#d9a73a' },
    { x: 0.465, ink: '#d9a73a' },
    { x: 0.595, ink: '#c8453a' },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  // ---- sky ---------------------------------------------------------------

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
      for (let i = 0; i < g.W * 0.7; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.45, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // Wisps that tile sideways, kept to the upper sky.
  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 21);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 246;
        img.data[i + 3] = smoothstep(0.52, 0.7, v) * band * 210;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(244,244,240,0.5)');
    grad.addColorStop(1, 'rgba(244,244,240,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- mountain ----------------------------------------------------------

  // Ridge height at x: steep near the flat crater, flattening toward the base.
  function ridge(g, x) {
    const px = g.W * PEAK.x;
    const half = g.W * (x < px ? 0.4 : 0.48);
    const crater = g.W * 0.018;
    const d = Math.max(0, Math.abs(x - px) - crater) / half;
    const base = g.H * HORIZON;
    const top = g.H * PEAK.y;
    const y = base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.9);
    return y + (fbm(x * 0.06, 2, 3, 5) - 0.5) * g.U * 0.8;
  }

  function mountainPixel(g, sky, x, y) {
    const f = (y - g.H * PEAK.y) / (g.H * (HORIZON - PEAK.y));
    const gully = fbm(x * 0.22, y * 0.015, 3, 9);
    const line = 0.42 + (fbm(x * 0.05, 4, 3, 11) - 0.5) * 0.18 + (gully - 0.5) * 0.35;
    // The east face is a little darker, eased so the summit has no seam.
    const shade = 1 - 0.12 * smoothstep(0, g.W * 0.06, x - g.W * PEAK.x);
    const lit = mixColor(rgb('#ffffff'), sky.amb, 0.5);
    if (f < line) {
      const streak = gully > 0.6 ? 0.9 : 1;
      return mixColor(mixColor(rgb('#eef0f2'), lit, 0.35), sky.top, 0.12 + sky.night * 0.3).map((c) => c * shade * streak);
    }
    const rock = mixColor(mixColor(rgb('#4f6286'), sky.haze, 0.45), rgb('#26304e'), sky.night * 0.6);
    const near = smoothstep(0.7, 1, f) * 0.25;
    return mixColor(rock, sky.low, near).map((c) => c * shade);
  }

  function paintMountain(ctx, g, sky) {
    const x0 = Math.floor(g.W * 0.3);
    const y0 = Math.floor(g.H * PEAK.y - g.U * 2);
    const y1 = Math.ceil(g.H * HORIZON + 1);
    const w = g.W - x0;
    const h = y1 - y0;
    const img = ctx.getImageData(x0, y0, w, h);
    for (let x = 0; x < w; x++) {
      const top = ridge(g, x0 + x);
      for (let y = Math.max(0, Math.floor(top - y0)); y < h; y++) {
        const c = mountainPixel(g, sky, x0 + x, y0 + y);
        const i = (y * w + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  function paintWires(ctx, g, sky) {
    ctx.strokeStyle = hex(mixColor(rgb('#2a2c34'), sky.top, 0.3));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.moveTo(g.W * 0.62, g.H * (0.5 + k * 0.012));
      ctx.quadraticCurveTo(g.W * 0.82, g.H * (0.505 + k * 0.014), g.W * 1.01, g.H * (0.47 + k * 0.01));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintTreesLeft(ctx, g, sky, rand) {
    const leaf = mixColor(rgb('#3c5a3c'), rgb('#141a24'), sky.night * 0.75);
    ctx.fillStyle = hex(leaf);
    for (let i = 0; i < 60; i++) {
      const x = rand() * g.W * 0.12;
      const y = g.H * (0.6 + rand() * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, g.U * (1.2 + rand() * 1.6), 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = hex(mixColor(rgb('#6b6158'), rgb('#1a1c26'), sky.night * 0.7));
    ctx.fillRect(0, g.H * 0.565, g.W * 0.07, g.U * 1.6);
    ctx.fillStyle = hex(mixColor(rgb('#3a3434'), rgb('#101218'), sky.night * 0.7));
    ctx.fillRect(0, g.H * 0.55, g.W * 0.06, g.U * 1.4);
  }

  // ---- shop --------------------------------------------------------------

  function x(g, f) {
    return g.W * f;
  }

  function y(g, f) {
    return g.H * f;
  }

  function paintRoofAndBand(ctx, g, sky) {
    const parapet = mixColor(rgb('#c9ccd0'), sky.amb, 0.3);
    ctx.fillStyle = hex(mixColor(parapet, rgb('#30344a'), sky.night * 0.7));
    ctx.fillRect(x(g, SHOP[0] - 0.005), y(g, ROOF), x(g, SHOP[1] - SHOP[0] + 0.01), y(g, BAND[0] - ROOF));
    ctx.fillStyle = hex(mixColor(rgb('#2c47a8'), rgb('#3a5ad0'), sky.night));
    ctx.fillRect(x(g, SHOP[0]), y(g, BAND[0]), x(g, SHOP[1] - SHOP[0]), y(g, BAND[1] - BAND[0]));
    ctx.fillStyle = hex(mixColor(rgb('#d8dce6'), rgb('#f2f4f8'), sky.night));
    for (let f = SHOP[0]; f <= SHOP[1]; f += 0.0545) ctx.fillRect(x(g, f), y(g, BAND[0]), 1, y(g, BAND[1] - BAND[0]));
    ctx.fillRect(x(g, SHOP[0]), y(g, BAND[0] + 0.012), x(g, SHOP[1] - SHOP[0]), 1);
    // A blank lit sign in the middle and two small coloured ones; no lettering.
    ctx.fillStyle = hex(mixColor(rgb('#e6e8ee'), rgb('#ffffff'), sky.night));
    ctx.fillRect(x(g, 0.32), y(g, BAND[0] + 0.004), x(g, 0.12), y(g, 0.048));
    ctx.fillStyle = '#2f7a52';
    ctx.fillRect(x(g, 0.515), y(g, BAND[0] + 0.012), x(g, 0.065), y(g, 0.03));
    ctx.fillStyle = '#c8562c';
    ctx.fillRect(x(g, 0.585), y(g, BAND[0] + 0.012), x(g, 0.065), y(g, 0.03));
    ctx.fillStyle = '#1c2a6e';
    ctx.fillRect(x(g, SHOP[0]), y(g, BAND[1]), x(g, SHOP[1] - SHOP[0]), Math.max(1, g.U * 0.5));
  }

  function paintInterior(ctx, g, sky, rand) {
    const reflect = (1 - sky.night) * 0.3;
    const room = mixColor(rgb('#e3e6e4'), sky.low, reflect);
    const top = y(g, GLASS[0]);
    const h = y(g, GLASS[1] - GLASS[0]);
    ctx.fillStyle = hex(room);
    ctx.fillRect(x(g, SHOP[0]), top, x(g, SHOP[1] - SHOP[0]), h);
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) ctx.fillRect(x(g, SHOP[0]), top + g.U * (1 + k * 1.4), x(g, SHOP[1] - SHOP[0]), 1);
    for (let row = 0; row < 5; row++) {
      const sy = top + h * (0.3 + row * 0.13);
      for (let gx = x(g, SHOP[0]); gx < x(g, SHOP[1]); gx += 1 + rand() * 1.5) {
        if (Math.abs(gx - x(g, DOOR)) < g.W * 0.035) continue;
        ctx.fillStyle = GOODS[Math.floor(rand() * GOODS.length)];
        ctx.globalAlpha = 0.55 + rand() * 0.4;
        ctx.fillRect(gx, sy, 1, Math.max(1, g.U * (0.6 + rand() * 0.8)));
      }
    }
    ctx.globalAlpha = 1;
  }

  function paintFrames(ctx, g, sky) {
    const frame = mixColor(rgb('#c4c8cc'), rgb('#8c909a'), sky.night * 0.5);
    ctx.fillStyle = hex(frame);
    const top = y(g, GLASS[0]);
    const h = y(g, GLASS[1] - GLASS[0]);
    for (let f = SHOP[0]; f <= SHOP[1] + 0.001; f += 0.0717) ctx.fillRect(x(g, f), top, Math.max(1, g.U * 0.5), h);
    ctx.fillRect(x(g, SHOP[0]), top + h * 0.12, x(g, SHOP[1] - SHOP[0]), 1);
    ctx.fillRect(x(g, SHOP[0]), top + h * 0.93, x(g, SHOP[1] - SHOP[0]), Math.max(1, g.U * 0.6));
    // Door frame and the gold notice above it.
    ctx.fillRect(x(g, DOOR - 0.04), top, Math.max(1, g.U * 0.6), h);
    ctx.fillRect(x(g, DOOR + 0.04), top, Math.max(1, g.U * 0.6), h);
    ctx.fillStyle = '#d9a73a';
    ctx.fillRect(x(g, 0.335), top + h * 0.015, x(g, 0.12), h * 0.095);
    ctx.fillStyle = '#2c3f8c';
    ctx.fillRect(x(g, 0.307), top + h * 0.02, x(g, 0.022), h * 0.08);
  }

  function paintPosters(ctx, g, rand) {
    const top = y(g, GLASS[0]);
    const h = y(g, GLASS[1] - GLASS[0]);
    const spots = [0.1, 0.36, 0.385, 0.53, 0.7, 0.785, 0.86];
    for (const f of spots) {
      ctx.fillStyle = GOODS[Math.floor(rand() * 3)];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x(g, f), top + h * (0.35 + rand() * 0.2), x(g, 0.025 + rand() * 0.02), h * (0.12 + rand() * 0.1));
    }
    ctx.globalAlpha = 1;
  }

  function paintSideWall(ctx, g, sky) {
    const wall = mixColor(rgb('#e8eaee'), rgb('#3a3e52'), sky.night * 0.75);
    const x0 = x(g, SHOP[1]);
    const top = y(g, ROOF);
    const h = y(g, GLASS[1] - ROOF);
    ctx.fillStyle = hex(wall);
    ctx.fillRect(x0, top, x(g, 0.98) - x0, h);
    ctx.fillStyle = hex(mixColor(wall, rgb('#7c8494'), 0.35));
    for (let gx = x0; gx < x(g, 0.98); gx += g.U * 1.6) ctx.fillRect(gx, top, 1, h);
    for (let gy = top; gy < top + h; gy += g.U * 1.6) ctx.fillRect(x0, gy, x(g, 0.98) - x0, 1);
    ctx.fillStyle = '#c8453a';
    ctx.fillRect(x(g, 0.94), y(g, 0.7), x(g, 0.022), y(g, 0.06));
    ctx.fillStyle = '#e8e2d0';
    ctx.fillRect(x(g, 0.944), y(g, 0.74), x(g, 0.014), y(g, 0.012));
  }

  function paintPerson(ctx, g, px, base, s) {
    ctx.fillStyle = '#3c5a86';
    ctx.fillRect(px - s * 0.7, base - s * 4.2, s * 0.6, s * 4.2);
    ctx.fillRect(px + s * 0.1, base - s * 4.2, s * 0.6, s * 4.2);
    ctx.fillStyle = '#1e2228';
    ctx.fillRect(px - s * 1.1, base - s * 8.6, s * 2.2, s * 4.6);
    ctx.fillStyle = '#4a4a50';
    ctx.fillRect(px - s * 1.5, base - s * 8.1, s * 0.8, s * 2.6);
    ctx.fillStyle = '#2a2420';
    ctx.beginPath();
    ctx.arc(px, base - s * 9.5, s * 0.95, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#4c8a5a';
    ctx.fillRect(px - s * 0.7, base - s * 0.4, s * 1.4, s * 0.4);
  }

  // ---- ground ------------------------------------------------------------

  function paintGround(ctx, g, sky) {
    const top = y(g, GLASS[1]);
    const asphalt = mixColor(mixColor(rgb('#5c6066'), sky.amb, 0.15), rgb('#1a1c24'), sky.night * 0.6);
    ctx.fillStyle = hex(asphalt);
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = hex(mixColor(asphalt, rgb('#c8ccd0'), 0.5));
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.9));
    if (sky.night > 0.05) {
      const spill = ctx.createLinearGradient(0, top, 0, g.H);
      spill.addColorStop(0, `rgba(236,232,214,${0.28 * sky.night})`);
      spill.addColorStop(1, 'rgba(236,232,214,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(x(g, SHOP[0]), top, x(g, SHOP[1] - SHOP[0]), g.H - top);
    }
    paintMarkings(ctx, g, top);
  }

  function paintMarkings(ctx, g, top) {
    ctx.fillStyle = '#e4e4de';
    const lineY = y(g, 0.93);
    for (let f = 0.06; f < 1; f += 0.115) {
      if (Math.abs(f - 0.36) < 0.06) continue;
      for (let k = 0; k < g.U * 3; k++) ctx.fillRect(x(g, f) - k * 1.6, lineY + k * 0.9, 2, 1);
      for (let k = 0; k < g.U * 3; k++) ctx.fillRect(x(g, f) + g.U * 3 - k * 1.6, lineY + k * 0.9, 2, 1);
    }
    for (let k = 0; k < 4; k++) ctx.fillRect(x(g, 0.29), top + g.U * (2 + k * 2), x(g, 0.13), 1);
    ctx.fillStyle = '#b4b6b4';
    for (let f = 0.01; f < 1; f += 0.115) ctx.fillRect(x(g, f), top + g.U * 1.2, x(g, 0.06), Math.max(1, g.U * 0.8));
    // Yellow bike rail and a trolley on the left.
    ctx.strokeStyle = '#d9a73a';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    ctx.moveTo(x(g, 0.058), top);
    ctx.lineTo(x(g, 0.058), top - g.U * 3);
    ctx.lineTo(x(g, 0.095), top - g.U * 3);
    ctx.lineTo(x(g, 0.095), top);
    ctx.stroke();
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintMountain(ctx, g, sky);
    paintWires(ctx, g, sky);
    paintTreesLeft(ctx, g, sky, rand);
    paintRoofAndBand(ctx, g, sky);
    paintInterior(ctx, g, sky, rand);
    paintPosters(ctx, g, rand);
    paintFrames(ctx, g, sky);
    paintSideWall(ctx, g, sky);
    paintGround(ctx, g, sky);
    paintPerson(ctx, g, x(g, 0.49), y(g, GLASS[1] + 0.012), g.U * 0.85);
    return c;
  }

  function paintBanner(g, ink) {
    const w = Math.max(3, Math.round(g.U * 2.4));
    const h = Math.max(8, Math.round(g.H * 0.13));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0ece0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ink;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.fillStyle = '#2c3f8c';
    ctx.fillRect(0, 0, w, Math.max(1, h * 0.06));
    ctx.fillStyle = '#8a5a3a';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.4, w * 0.3, 0, 6.3);
    ctx.fill();
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.75 - sky.night * 0.5;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.8) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.04);
    ctx.drawImage(c, off + c.width, g.H * 0.04);
    ctx.globalAlpha = 1;
  }

  // Snow blown off the summit, streaming east.
  function drawPlume(ctx, g, t) {
    const px = g.W * PEAK.x;
    const py = g.H * PEAK.y;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.07 + i / MAX_PUFFS) % 1;
      const size = g.U * (2 + a * 14);
      const dx = a * g.W * 0.2;
      const dy = -a * g.U * 5 + Math.sin(t * 0.4 + i) * g.U * 0.8;
      ctx.globalAlpha = (1 - a) * 0.8 * (1 - state.dim * 0.4);
      ctx.drawImage(state.puff, px + dx - size / 2, py + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawBanners(ctx, g, t) {
    const base = y(g, GLASS[1] + 0.005);
    for (let b = 0; b < BANNERS.length; b++) {
      const art = state.banners[b];
      const bx = x(g, BANNERS[b].x);
      const top = base - art.height;
      for (let s = 0; s < art.height; s++) {
        const k = s / art.height;
        const wave = Math.sin(t * 2.2 - k * 4 + b * 1.7) * g.U * 0.9 * k;
        ctx.drawImage(art, 0, s, art.width, 1, bx + wave, top + s, art.width, 1);
      }
      ctx.fillStyle = '#8c909a';
      ctx.fillRect(bx - 1, top - 1, 1, art.height + 1);
    }
  }

  // Every half minute someone walks in from the left and through the door.
  function drawShopper(ctx, g, t) {
    const cycle = 30;
    const p = (t % cycle) / 22;
    if (p >= 1) return;
    const s = g.U * 0.8;
    const px = lerp(-g.W * 0.03, x(g, DOOR), p);
    const base = y(g, GLASS[1] + 0.03);
    const step = Math.sin(t * 7) * s * 0.7;
    ctx.fillStyle = '#2c2e3a';
    ctx.fillRect(px - s * 0.6 + step, base - s * 4, s * 0.6, s * 4);
    ctx.fillRect(px + s * 0.1 - step, base - s * 4, s * 0.6, s * 4);
    ctx.fillStyle = (Math.floor(t / cycle) % 2) ? '#b8412c' : '#e8e2d0';
    ctx.fillRect(px - s, base - s * 8.4, s * 2, s * 4.6);
    ctx.fillStyle = '#2a2420';
    ctx.beginPath();
    ctx.arc(px, base - s * 9.3, s * 0.9, 0, 6.3);
    ctx.fill();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    state.puff = paintPuff();
    state.banners = BANNERS.map((b) => paintBanner(g, b.ink));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    drawPlume(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawBanners(ctx, g, t);
    if (props.shoppers) drawShopper(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, shoppers: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
