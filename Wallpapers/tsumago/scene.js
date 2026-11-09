/*
 * 妻籠 Tsumago — an old post-town lane at dusk.
 *
 * Sky, mountain, lane and the wooden houses on both sides are baked into
 * layers and repainted once a minute from the clock. Between repaints only
 * two bands of mist, the swaying paper lanterns and a few petals move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const TAU = Math.PI * 2;
  const HOR = 0.5;
  const EYE = 0.5;
  const LANE = 0.85;
  const Z_NEAR = -0.3;
  const Z_FAR = 22;
  const Z_SPLIT = 4.2;
  const RETINT_SECONDS = 60;
  const PETALS = 14;
  const WOOD = '#4a3426';
  const BOARD = '#5a4232';
  const PLASTER = '#d6cbb0';
  const TILE = '#3a3f52';
  const TILE_LIT = '#4d5468';
  const DARK = '#1f1813';
  const WARM = '#e8b25a';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // ---- projection --------------------------------------------------------

  function scaleAt(z) {
    return 1 / (1 + z);
  }

  // Lane point: z is depth, lat the sideways offset, h the height above the ground.
  function P(g, z, lat, h) {
    const s = scaleAt(z);
    return [g.W / 2 + lat * g.H * s, g.H * (HOR + (EYE - h) * s)];
  }

  function quad(ctx, g, a, b) {
    poly(ctx, [].concat(P(g, a[0], a[1], a[2]), P(g, b[0], b[1], a[2]), P(g, b[0], b[1], b[2]), P(g, a[0], a[1], b[2])));
  }

  // A flat shape on a plane at fixed lateral offset: z0..z1, h0..h1.
  function wall(ctx, g, lat, z0, z1, h0, h1) {
    poly(ctx, [].concat(P(g, z0, lat, h0), P(g, z1, lat, h0), P(g, z1, lat, h1), P(g, z0, lat, h1)));
  }

  // A horizontal slab seen from above or below: z0..z1, lat0..lat1 at height h.
  function slab(ctx, g, z0, z1, lat0, lat1, h) {
    poly(ctx, [].concat(P(g, z0, lat0, h), P(g, z1, lat0, h), P(g, z1, lat1, h), P(g, z0, lat1, h)));
  }

  // ---- colour ------------------------------------------------------------

  function tint(colour, sky, z) {
    const fog = (1 - smoothstep(0.05, 0.8, scaleAt(Math.max(z, 0)))) * 0.72;
    const lit = mixColor(rgb(colour), sky.amb, 0.2);
    const dark = mixColor(lit, rgb('#0e1020'), sky.night * 0.62);
    return hex(mixColor(dark, sky.haze, fog));
  }

  function lampAmount(sky) {
    return clamp(0.5 + sky.night * 0.9, 0, 1);
  }

  // ---- sky and mountain --------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HOR);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 0.9 * sky.night;
      ctx.fillStyle = '#e9dfb8';
      ctx.beginPath();
      ctx.arc(g.W * 0.64, g.H * 0.16, g.H * 0.03, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function ridgeY(g, x, base, amp, seed) {
    const n = fbm(x / g.W * 4.2, seed, 4, seed) - 0.5;
    return g.H * base + n * g.H * amp;
  }

  function paintRidge(ctx, g, base, amp, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.7);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridgeY(g, x, base, amp, seed));
    ctx.lineTo(g.W, g.H * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  function paintCedars(ctx, g, colour, rand) {
    ctx.fillStyle = colour;
    for (let x = 0; x < g.W; x += 1.5 + rand() * 2.5) {
      const top = ridgeY(g, x, 0.4, 0.2, 7);
      const h = g.H * (0.012 + rand() * 0.02);
      poly(ctx, [x - h * 0.22, top + 1, x, top - h, x + h * 0.22, top + 1]);
    }
  }

  function paintMountain(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const far = mixColor(mixColor(rgb('#55688e'), sky.haze, 0.4), rgb('#1a2036'), sky.night * 0.5);
    const near = mixColor(mixColor(rgb('#2a3a5c'), sky.haze, 0.2), rgb('#10162a'), sky.night * 0.6);
    const moss = mixColor(mixColor(rgb('#2f4a3a'), sky.haze, 0.25), rgb('#0e1822'), sky.night * 0.65);
    paintRidge(ctx, g, 0.3, 0.22, 3, hex(far));
    paintRidge(ctx, g, 0.4, 0.2, 7, hex(mixColor(near, moss, 0.4)));
    paintCedars(ctx, g, hex(moss), rand);
    return c;
  }

  // ---- ground ------------------------------------------------------------

  function paintGround(ctx, g, sky) {
    const a = P(g, Z_FAR, -LANE, 0);
    const b = P(g, Z_FAR, LANE, 0);
    const c = P(g, Z_NEAR, LANE, 0);
    const d = P(g, Z_NEAR, -LANE, 0);
    const grad = ctx.createLinearGradient(0, g.H * HOR, 0, g.H);
    grad.addColorStop(0, hex(mixColor(rgb('#7a6e58'), sky.haze, 0.55)));
    grad.addColorStop(1, tint('#5c5040', sky, 0));
    ctx.fillStyle = grad;
    poly(ctx, [].concat(a, b, c, d));
    // Worn pale middle of the road and paving joints.
    ctx.fillStyle = tint('#7d7258', sky, 2);
    ctx.globalAlpha = 0.45;
    quad(ctx, g, [Z_NEAR, -0.2, 0], [Z_FAR, 0.2, 0]);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = tint('#3a3228', sky, 1);
    for (let z = 0; z < 14; z += 0.35 + z * 0.12) {
      const p = P(g, z, -LANE, 0);
      const q = P(g, z, LANE, 0);
      ctx.fillRect(p[0], p[1], q[0] - p[0], 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintPools(ctx, g, sky, lamps) {
    const lamp = lampAmount(sky);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lamps) {
      const foot = P(g, l.z, l.lat, 0);
      const s = scaleAt(l.z);
      const rx = g.H * 0.2 * s;
      const grad = ctx.createRadialGradient(foot[0], foot[1], 0, foot[0], foot[1], rx);
      grad.addColorStop(0, `rgba(210,140,70,${0.5 * lamp})`);
      grad.addColorStop(1, 'rgba(210,140,70,0)');
      ctx.fillStyle = grad;
      ctx.save();
      ctx.translate(foot[0], foot[1]);
      ctx.scale(1, 0.28);
      ctx.translate(-foot[0], -foot[1]);
      ctx.fillRect(foot[0] - rx, foot[1] - rx, rx * 2, rx * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---- houses ------------------------------------------------------------

  function makeHouses(side, rand) {
    const list = [];
    let z = Z_NEAR - rand() * 0.5;
    while (z < Z_FAR) {
      const w = 1.5 + rand() * 0.9;
      const low = rand() < 0.22;
      list.push({ z0: z, z1: z + w, low, plaster: rand() < 0.4, sign: side, seed: Math.floor(rand() * 1000), door: rand() < 0.4, lift: (rand() - 0.5) * 0.1 });
      z += w + (rand() < 0.2 ? 0.45 : 0);
    }
    return list;
  }

  function paintLowerWall(ctx, g, sky, hs, rand, lat) {
    const { z0, z1, sign } = hs;
    const zm = (z0 + z1) / 2;
    ctx.fillStyle = tint(WOOD, sky, zm);
    wall(ctx, g, lat, z0, z1, 0, 0.42);
    ctx.fillStyle = tint(BOARD, sky, zm);
    ctx.globalAlpha = 0.6;
    for (let z = z0 + 0.1; z < z1; z += 0.18) wall(ctx, g, lat, z, z + 0.035, 0, 0.4);
    ctx.globalAlpha = 1;
    const lamp = lampAmount(sky);
    // A lattice window, or a wide sliding door on some houses.
    const wa = hs.door ? z0 + 0.35 : z0 + 0.3;
    const wb = hs.door ? z1 - 0.35 : z1 - 0.3;
    const h0 = hs.door ? 0.02 : 0.1;
    const h1 = hs.door ? 0.34 : 0.3;
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#1a1612'), rgb(WARM), 0.8 * lamp), sky.haze, 0.2 * (1 - lamp)));
    wall(ctx, g, lat, wa, wb, h0, h1);
    ctx.fillStyle = tint(DARK, sky, zm);
    for (let z = wa; z < wb; z += 0.07) wall(ctx, g, lat, z, z + 0.02, h0, h1);
    wall(ctx, g, lat, wa - 0.03, wb + 0.03, h1, h1 + 0.025);
    wall(ctx, g, lat, wa - 0.03, wb + 0.03, h0 - 0.02, h0 + 0.01);
    wall(ctx, g, lat, wa, wb, (h0 + h1) / 2, (h0 + h1) / 2 + 0.015);
    return sign;
  }

  function paintUpper(ctx, g, sky, hs, lat) {
    const { z0, z1 } = hs;
    const zm = (z0 + z1) / 2;
    const lamp = lampAmount(sky);
    ctx.fillStyle = tint(hs.plaster ? PLASTER : BOARD, sky, zm);
    wall(ctx, g, lat, z0, z1, 0.44, 0.8);
    ctx.fillStyle = tint(DARK, sky, zm);
    wall(ctx, g, lat, z0, z1, 0.44, 0.465);
    wall(ctx, g, lat, z0, z0 + 0.04, 0.44, 0.8);
    // Two slatted plaster windows, one lit.
    for (let k = 0; k < 2; k++) {
      const wa = z0 + 0.3 + k * ((z1 - z0) * 0.42);
      const wb = wa + 0.4;
      const lit = (hs.seed + k) % 3 !== 0;
      ctx.fillStyle = hex(mixColor(rgb(lit ? '#2a2018' : '#41362c'), rgb(WARM), lit ? 0.7 * lamp : 0.1));
      wall(ctx, g, lat, wa, wb, 0.54, 0.72);
      ctx.fillStyle = tint(DARK, sky, zm);
      for (let z = wa; z < wb; z += 0.06) wall(ctx, g, lat, z, z + 0.018, 0.54, 0.72);
      ctx.fillStyle = tint(PLASTER, sky, zm);
      wall(ctx, g, lat, wa - 0.04, wb + 0.04, 0.72, 0.745);
    }
  }

  function paintRoof(ctx, g, sky, hs, lat, top) {
    const { z0, z1, sign } = hs;
    const zm = (z0 + z1) / 2;
    const out = sign * (Math.abs(lat) - 0.2);
    const back = sign * (Math.abs(lat) + 0.22);
    // Tile slope up to the ridge, then soffit and fascia of the deep eave.
    ctx.fillStyle = tint(TILE, sky, zm);
    poly(ctx, [].concat(P(g, z0, out, top + 0.04), P(g, z1, out, top + 0.04), P(g, z1, back, top + 0.16), P(g, z0, back, top + 0.16)));
    ctx.fillStyle = tint(TILE_LIT, sky, zm);
    ctx.globalAlpha = 0.55;
    for (let k = 1; k < 4; k++) {
      const f = k / 4;
      poly(ctx, [].concat(P(g, z0, lerp(out, back, f), top + 0.04 + 0.12 * f), P(g, z1, lerp(out, back, f), top + 0.04 + 0.12 * f), P(g, z1, lerp(out, back, f), top + 0.05 + 0.12 * f), P(g, z0, lerp(out, back, f), top + 0.05 + 0.12 * f)));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = tint('#2c241d', sky, zm);
    slab(ctx, g, z0, z1, lat, out, top - 0.02);
    ctx.fillStyle = tint(DARK, sky, zm);
    wall(ctx, g, out, z0, z1, top - 0.02, top + 0.04);
  }

  function paintLowerEave(ctx, g, sky, hs, lat, top) {
    const { z0, z1, sign } = hs;
    const zm = (z0 + z1) / 2;
    const out = sign * (Math.abs(lat) - 0.17);
    ctx.fillStyle = tint(TILE_LIT, sky, zm);
    poly(ctx, [].concat(P(g, z0, lat, top + 0.03), P(g, z1, lat, top + 0.03), P(g, z1, out, top - 0.03), P(g, z0, out, top - 0.03)));
    ctx.fillStyle = tint(DARK, sky, zm);
    wall(ctx, g, out, z0, z1, top - 0.07, top - 0.03);
    ctx.fillStyle = tint('#120e0b', sky, zm);
    ctx.globalAlpha = 0.55;
    wall(ctx, g, lat, z0, z1, top - 0.1, top - 0.02);
    ctx.globalAlpha = 1;
  }

  function paintHouse(ctx, g, sky, hs, rand) {
    const lat = hs.sign * LANE;
    if (hs.low) {
      paintLowerWall(ctx, g, sky, hs, rand, lat);
      paintRoof(ctx, g, sky, hs, lat, 0.46);
      return;
    }
    paintRoof(ctx, g, sky, hs, lat, 0.82 + hs.lift);
    paintUpper(ctx, g, sky, hs, lat);
    paintLowerWall(ctx, g, sky, hs, rand, lat);
    paintLowerEave(ctx, g, sky, hs, lat, 0.44);
  }

  function paintRow(ctx, g, sky, houses, zLo, zHi, rand) {
    const row = houses.filter((h) => h.z0 >= zLo && h.z0 < zHi).sort((a, b) => b.z0 - a.z0);
    for (const h of row) paintHouse(ctx, g, sky, h, rand);
  }

  function lampList(houses) {
    const out = [];
    for (const h of houses) {
      if (h.low || h.z0 > 14) continue;
      const zm = (h.z0 + h.z1) / 2;
      out.push({ z: zm, lat: h.sign * (LANE - 0.15), phase: (h.seed % 100) / 16 });
    }
    return out;
  }

  // ---- mist --------------------------------------------------------------

  function paintMistMask(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.06, 4, seed), fbm((x - w) * 0.012, y * 0.06, 4, seed), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = smoothstep(0.42, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function tintMist(mask, colour) {
    const c = layer(mask.width, mask.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---- lanterns ----------------------------------------------------------

  function paintLantern() {
    const c = layer(24, 32);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a211b';
    ctx.fillRect(7, 0, 10, 3);
    ctx.fillRect(7, 29, 10, 3);
    ctx.fillStyle = '#c8452c';
    ctx.beginPath();
    ctx.ellipse(12, 16, 11, 13, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e07a4a';
    ctx.beginPath();
    ctx.ellipse(12, 15, 7, 9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4a1f18';
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(12, 16, 11, 2 + k * 2.6, 0, 0, Math.PI);
      ctx.stroke();
    }
    return c;
  }

  function paintGlow() {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(236,160,84,0.62)');
    grad.addColorStop(0.35, 'rgba(220,130,64,0.24)');
    grad.addColorStop(1, 'rgba(220,130,64,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function paintPetal() {
    const c = layer(6, 4);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e3bcb6';
    ctx.beginPath();
    ctx.ellipse(3, 2, 2.6, 1.5, 0.4, 0, TAU);
    ctx.fill();
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    state.mountain = paintMountain(g, sky, rand);

    const far = layer(g.W, g.H);
    const fctx = far.getContext('2d');
    fctx.drawImage(state.mountain, 0, 0);
    paintGround(fctx, g, sky);
    paintPools(fctx, g, sky, state.lamps);
    paintRow(fctx, g, sky, state.houses, Z_SPLIT, Z_FAR + 1, rand);
    state.far = far;

    const near = layer(g.W, g.H);
    paintRow(near.getContext('2d'), g, sky, state.houses, Z_NEAR - 1, Z_SPLIT, rand);
    state.near = near;

    state.mistHigh = tintMist(state.maskHigh, hex(mixColor(sky.haze, sky.amb, 0.35)));
    state.mistLow = tintMist(state.maskLow, hex(mixColor(sky.haze, sky.amb, 0.5)));
    state.lamp = lampAmount(sky);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const hi = state.mistHigh;
    const lo = state.mistLow;
    const offA = -((t * g.H * 0.03) % hi.width);
    const offB = -((t * g.H * 0.05 + hi.width * 0.4) % lo.width);
    ctx.globalAlpha = Math.min(1, 0.75 * amount);
    ctx.drawImage(hi, offA, g.H * 0.27);
    ctx.drawImage(hi, offA + hi.width, g.H * 0.27);
    ctx.globalAlpha = Math.min(1, 0.7 * amount);
    ctx.drawImage(lo, offB, g.H * 0.42);
    ctx.drawImage(lo, offB + lo.width, g.H * 0.42);
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, g, t) {
    const lamp = state.lamp;
    for (const l of state.lamps) {
      const s = scaleAt(l.z);
      const top = P(g, l.z, l.lat, 0.36);
      const w = Math.max(2.5, g.H * 0.11 * s);
      const h = w * 1.35;
      const sway = Math.sin(t * 1.1 + l.phase) * w * 0.34;
      const x = top[0] + sway - w / 2;
      const gl = w * 6;
      const flick = 0.82 + 0.1 * Math.sin(t * 2.3 + l.phase * 2) + 0.05 * Math.sin(t * 5.1 + l.phase);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, lamp * flick * 0.9);
      ctx.drawImage(state.glow, x + w / 2 - gl / 2, top[1] + h / 2 - gl / 2, gl, gl);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(state.lantern, x, top[1], w, h);
    }
  }

  function drawPetals(ctx, g, t) {
    const night = 1 - state.night * 0.55;
    ctx.globalAlpha = 0.8 * night;
    for (let i = 0; i < PETALS; i++) {
      const a = (t * 0.03 + i / PETALS) % 1;
      const px = g.W * (0.2 + 0.6 * ((i * 0.37) % 1)) + Math.sin(t * 0.7 + i * 2) * g.H * 0.03 + a * g.W * 0.05;
      const py = g.H * (0.05 + a * 0.8);
      const s = g.H * (0.01 + (i % 3) * 0.003);
      ctx.drawImage(state.petal, px, py, s * 1.6, s);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.houses = makeHouses(-1, K.rng(5)).concat(makeHouses(1, K.rng(9)));
    state.lamps = lampList(state.houses);
    state.maskHigh = paintMistMask(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2), 13);
    state.maskLow = paintMistMask(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2), 29);
    state.lantern = paintLantern();
    state.glow = paintGlow();
    state.petal = paintPetal();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    drawMist(ctx, g, t, props.mist);
    ctx.drawImage(state.near, 0, 0);
    drawLanterns(ctx, g, t);
    if (props.petals) drawPetals(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dusk', mist: 1, petals: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
