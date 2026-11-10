/*
 * 高山 Takayama — an old merchant street of dark latticed wooden houses.
 *
 * One-point perspective from a low eye in a narrow lane: two rows of
 * two-storey machiya, each with a stone base, a ground floor of chunky
 * vertical lattice, a short lower eave, a low upper storey and a deep main
 * eave whose rafters run back to the wall. Stone flags and a water channel
 * run along each side. Everything still is baked into layers and repainted
 * once a minute from the clock. Between repaints only mist, glints on the
 * water, the noren curtains, two cedar balls and a paper lantern move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const VPY = 0.42; // vanishing point, fraction of height
  const CAM = 0.68; // eye height, in street half-widths
  const NEAR = 0.45;
  const FAR = 16;
  const RETINT_SECONDS = 60;
  const GLINTS = 14;

  // Heights of the facade, in street half-widths.
  const BASE = 0.13;
  const LOW_EAVE = 1.2; // where the lower eave meets the wall
  const LOW_EDGE = 1.08; // its outer edge, lower
  const LOW_IN = 0.8; // its outer edge, as a fraction of the half-width
  const UP_TOP = 2.0;
  const EAVE_EDGE = 1.88;
  const EAVE_IN = 0.6;

  const state = {};
  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const INK = rgb('#100c0a');

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // x is across the street (-1 left wall, 1 right wall), h up, z depth.
  const px = (g, x, z) => g.W * 0.5 + (x * g.F) / z;
  const py = (g, h, z) => g.H * VPY + ((CAM - h) * g.F) / z;
  const P = (g, x, h, z) => [px(g, x, z), py(g, h, z)];

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // A panel standing on the plane x, between two depths and two heights.
  function wall(ctx, g, x, z0, z1, h0, h1) {
    poly(ctx, [P(g, x, h1, z0), P(g, x, h1, z1), P(g, x, h0, z1), P(g, x, h0, z0)]);
  }

  // A sloping strip from (xa, ha) to (xb, hb) between two depths: eaves.
  function slope(ctx, g, xa, ha, xb, hb, z0, z1) {
    poly(ctx, [P(g, xa, ha, z0), P(g, xa, ha, z1), P(g, xb, hb, z1), P(g, xb, hb, z0)]);
  }

  // A strip lying on the ground between two x and two z.
  function flat(ctx, g, xa, xb, z0, z1) {
    poly(ctx, [P(g, xa, 0, z0), P(g, xb, 0, z0), P(g, xb, 0, z1), P(g, xa, 0, z1)]);
  }

  // ---- light ---------------------------------------------------------------

  // How warm the low sky is: 0 at midday and midnight, 1 at sunrise and sunset.
  function warmth(sky) {
    return clamp((sky.low[0] - sky.low[2]) / 110, 0, 1);
  }

  function shader(sky, side) {
    const lit = side < 0 ? 1.08 : 0.84;
    const day = 1 - sky.night * 0.72;
    return (c, z) => {
      const fog = smoothstep(1.5, FAR, z) * 0.75;
      const toned = mixColor(c, sky.amb, 0.16).map((v) => v * lit * day);
      return hex(mixColor(toned, sky.haze, fog));
    };
  }

  // ---- sky and hills ---------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * VPY);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * VPY * 0.8, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // Low sun or dawn glow sitting at the far end of the street.
    const w = warmth(sky);
    if (w > 0.05) {
      const r = g.H * 0.5;
      const glow = ctx.createRadialGradient(g.W * 0.5, g.H * VPY, 0, g.W * 0.5, g.H * VPY, r);
      glow.addColorStop(0, `rgba(242,178,110,${0.75 * w})`);
      glow.addColorStop(1, 'rgba(242,178,110,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, g.W, g.H);
    }
    paintHills(ctx, g, sky);
    return c;
  }

  function paintHills(ctx, g, sky) {
    const base = g.H * VPY + 2;
    const ranges = [
      { lift: 0.13, amp: 0.07, seed: 4, mix: 0.6, tone: '#5d6f86' },
      { lift: 0.06, amp: 0.05, seed: 9, mix: 0.38, tone: '#3d5446' },
    ];
    for (const r of ranges) {
      const col = mixColor(mixColor(rgb(r.tone), sky.haze, r.mix), rgb('#10162a'), sky.night * 0.6);
      ctx.fillStyle = hex(col);
      ctx.beginPath();
      ctx.moveTo(0, base);
      for (let x = 0; x <= g.W; x += 2) {
        const n = fbm(x * 0.03, r.seed, 4, r.seed);
        ctx.lineTo(x, base - g.H * (r.lift + (n - 0.4) * r.amp * 2));
      }
      ctx.lineTo(g.W, base);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- ground and water ------------------------------------------------------

  function paintGround(ctx, g, sky, rand) {
    const top = g.H * VPY;
    const dark = sky.night * 0.7;
    const stone = mixColor(mixColor(rgb('#7c766a'), sky.amb, 0.25), rgb('#14161f'), dark);
    const far = mixColor(stone, sky.haze, 0.7);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(0.25, hex(stone));
    grad.addColorStop(1, hex(mixColor(stone, INK, 0.35)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // A wet sheen down the middle of the lane, catching the sky.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = hex(mixColor(sky.low, stone, 0.35));
    flat(ctx, g, -0.22, 0.22, NEAR * 0.8, FAR);
    ctx.globalAlpha = 1;
    paintFlags(ctx, g, stone, rand);
    // Channel along each wall: pale curb, dark water, stone edge.
    const water = mixColor(mixColor(rgb('#3c5874'), sky.low, 0.35), rgb('#0e1424'), sky.night * 0.6);
    const curb = mixColor(stone, rgb('#ddd6c6'), 0.4 * (1 - dark));
    for (const s of [-1, 1]) {
      ctx.fillStyle = hex(curb);
      flat(ctx, g, s * 0.8, s * 0.85, NEAR * 0.8, FAR);
      ctx.fillStyle = hex(water);
      flat(ctx, g, s * 0.85, s * 0.97, NEAR * 0.8, FAR);
      ctx.fillStyle = hex(mixColor(water, sky.low, 0.35));
      flat(ctx, g, s * 0.85, s * 0.87, NEAR * 0.8, FAR);
    }
  }

  // Stone flags: rows across the lane, each split into staggered slabs.
  function paintFlags(ctx, g, stone, rand) {
    const seam = hex(mixColor(stone, INK, 0.55));
    const light = hex(mixColor(stone, rgb('#e2dccd'), 0.18));
    let z = NEAR * 0.8;
    let row = 0;
    while (z < 9) {
      const z1 = z * 1.16;
      const n = 3 + (row % 2);
      for (let k = 0; k < n; k++) {
        const a = -0.8 + (1.6 * k) / n + (row % 2 ? 0.1 : 0);
        const b = Math.min(0.8, a + 1.6 / n);
        if (rand() < 0.35) {
          ctx.fillStyle = light;
          flat(ctx, g, a + 0.02, b - 0.02, z + 0.01 * z, z1 - 0.01 * z);
        }
        ctx.fillStyle = seam;
        flat(ctx, g, a, a + 0.015, z, z1);
      }
      ctx.fillStyle = seam;
      flat(ctx, g, -0.8, 0.8, z, z + 0.012 * z);
      z = z1;
      row++;
    }
  }

  // ---- houses ----------------------------------------------------------------

  function houseList(side, seed) {
    const rand = K.rng(seed);
    const list = [];
    let z = NEAR - rand() * 0.3;
    while (z < FAR) {
      const len = 1.0 + rand() * 0.9;
      list.push({ z0: z, z1: z + len, side, plaster: rand() < 0.3, tone: rand(), lift: rand() * 0.1, door: rand() < 0.5 ? 0.25 : 0.6 });
      z += len;
    }
    return list;
  }

  // Upright bars on a wall plane; when they would be finer than a cell the
  // whole opening is washed with their colour instead.
  function bars(ctx, g, x, z0, z1, h0, h1, step, width, color) {
    const dpx = (g.F * step) / (z0 * z0);
    ctx.fillStyle = color;
    if (dpx < 1.6) {
      ctx.globalAlpha = 0.45;
      wall(ctx, g, x, z0, z1, h0, h1);
      ctx.globalAlpha = 1;
      return;
    }
    for (let z = z0 + step * 0.5; z < z1 - width; z += step) wall(ctx, g, x, z, z + width, h0, h1);
    // Top and bottom rails.
    wall(ctx, g, x, z0, z1, h1 - 0.04, h1);
    wall(ctx, g, x, z0, z1, h0, h0 + 0.03);
  }

  function paintHouse(ctx, g, sky, hs) {
    const s = hs.side;
    const tint = shader(sky, s);
    const z0 = hs.z0;
    const z1 = hs.z1;
    const zc = z0;
    const timber = mixColor(rgb('#3e2c20'), rgb('#4e3626'), hs.tone);
    const barCol = mixColor(rgb('#a8845a'), rgb('#c09a66'), hs.tone);
    const night = sky.night;
    // Stone base and ground storey frame.
    ctx.fillStyle = tint(rgb('#55524a'), zc);
    wall(ctx, g, s, z0, z1, 0, BASE);
    ctx.fillStyle = tint(timber, zc);
    wall(ctx, g, s, z0, z1, BASE, LOW_EAVE);
    // Dark interior behind the lattice, warm at night.
    const room = mixColor(rgb('#120d0b'), rgb('#c98a34'), night * 0.75);
    ctx.fillStyle = tint(room, zc);
    wall(ctx, g, s, z0 + 0.06, z1 - 0.06, BASE + 0.06, 1.02);
    // Doorway with no lattice; the noren hangs here.
    const d0 = z0 + hs.door;
    const d1 = d0 + 0.38;
    ctx.fillStyle = tint(mixColor(rgb('#0c0908'), rgb('#d9a23c'), night * 0.6), zc);
    wall(ctx, g, s, d0, d1, BASE, 1.02);
    // Chunky lattice either side of the door.
    const bc = tint(barCol.map((v) => v * (1 - night * 0.55)), zc);
    bars(ctx, g, s, z0 + 0.06, d0 - 0.03, BASE + 0.06, 1.02, 0.065, 0.026, bc);
    bars(ctx, g, s, d1 + 0.03, z1 - 0.06, BASE + 0.06, 1.02, 0.065, 0.026, bc);
    // Posts at each end of the house.
    ctx.fillStyle = tint(mixColor(timber, INK, 0.45), zc);
    wall(ctx, g, s, z0, z0 + 0.06, BASE, LOW_EAVE);
    wall(ctx, g, s, d0 - 0.03, d0, BASE, 1.02);
    wall(ctx, g, s, d1, d1 + 0.03, BASE, 1.02);

    // Upper storey: timber or plaster, a lattice window.
    const upper = hs.plaster ? rgb('#c9bfa8') : mixColor(timber, rgb('#5a4030'), 0.3);
    ctx.fillStyle = tint(upper, zc);
    wall(ctx, g, s, z0, z1, LOW_EAVE, UP_TOP + hs.lift);
    ctx.fillStyle = tint(room, zc);
    wall(ctx, g, s, z0 + 0.18, z1 - 0.18, 1.4, 1.78);
    bars(ctx, g, s, z0 + 0.18, z1 - 0.18, 1.4, 1.78, 0.085, 0.032, bc);
    ctx.fillStyle = tint(mixColor(timber, INK, 0.5), zc);
    wall(ctx, g, s, z0, z1, LOW_EAVE, LOW_EAVE + 0.05);

    // Lower eave: dark underside, then a tiled edge.
    const under = tint(rgb('#1a1513'), zc);
    const tile = tint(rgb('#4a4e58'), zc);
    const tileHi = tint(rgb('#7a808a'), zc);
    ctx.fillStyle = under;
    slope(ctx, g, s, LOW_EAVE, s * LOW_IN, LOW_EDGE, z0, z1);
    ctx.fillStyle = tile;
    wall(ctx, g, s * LOW_IN, z0, z1, LOW_EDGE - 0.07, LOW_EDGE);
    ctx.fillStyle = tileHi;
    wall(ctx, g, s * LOW_IN, z0, z1, LOW_EDGE - 0.07, LOW_EDGE - 0.05);

    // Main eave: deep underside crossed by rafters, then a thick tiled edge.
    const top = UP_TOP + hs.lift;
    const edge = EAVE_EDGE + hs.lift;
    ctx.fillStyle = under;
    slope(ctx, g, s, top, s * EAVE_IN, edge, z0, z1);
    ctx.fillStyle = tint(mixColor(timber, rgb('#8a6a48'), 0.35), zc);
    for (let z = z0 + 0.08; z < z1 - 0.04; z += 0.2) slope(ctx, g, s, top, s * EAVE_IN, edge, z, z + 0.05);
    ctx.fillStyle = tile;
    wall(ctx, g, s * EAVE_IN, z0, z1, edge - 0.11, edge);
    ctx.fillStyle = tileHi;
    wall(ctx, g, s * EAVE_IN, z0, z1, edge - 0.11, edge - 0.08);
    // A dark seam between neighbours.
    ctx.fillStyle = tint(INK, zc);
    wall(ctx, g, s * EAVE_IN, z0, z0 + 0.025, edge - 0.11, edge);
  }

  function paintStreet(ctx, g, sky) {
    const all = state.houses.slice().sort((a, b) => b.z0 - a.z0);
    for (let i = 0; i < all.length; i++) paintHouse(ctx, g, sky, all[i]);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGround(ctx, g, sky, rand);
    paintStreet(ctx, g, sky);
    const hz = sky.haze.map(Math.round).join(',');
    const haze = ctx.createRadialGradient(g.W * 0.5, g.H * VPY, 0, g.W * 0.5, g.H * VPY, g.H * 0.22);
    haze.addColorStop(0, `rgba(${hz},0.75)`);
    haze.addColorStop(1, `rgba(${hz},0)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // ---- hanging things ----------------------------------------------------

  function paintBall(r) {
    const size = Math.max(6, Math.round(r * 2));
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size * 0.36, size * 0.34, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, '#8aa058');
    grad.addColorStop(0.6, '#4f6e36');
    grad.addColorStop(1, '#263d22');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, 6.3);
    ctx.fill();
    // Clipped needle tufts.
    const rand = K.rng(17);
    ctx.fillStyle = '#1e3018';
    for (let i = 0; i < size * 2; i++) {
      const a = rand() * 6.3;
      const d = Math.sqrt(rand()) * size * 0.46;
      ctx.fillRect(size / 2 + Math.cos(a) * d, size / 2 + Math.sin(a) * d, 1, 1);
    }
    return c;
  }

  function paintLantern(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d6452c';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h * 0.44, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#e8b04a';
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(w * 0.42, h * 0.45, w * 0.2, h * 0.28, 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1c1410';
    ctx.fillRect(w * 0.2, 0, w * 0.6, Math.max(1, h * 0.1));
    ctx.fillRect(w * 0.2, h * 0.9, w * 0.6, Math.max(1, h * 0.1));
    ctx.fillStyle = '#8c2a1c';
    for (let k = 1; k < 5; k++) ctx.fillRect(0, h * (0.1 + k * 0.16), w, 1);
    return c;
  }

  // Hung from the lower eave's edge, in screen pixels.
  function placeHangers(g) {
    const hang = (kind, s, z, len, art, ph, amp) => ({ kind, x: px(g, s * LOW_IN * 1.02, z), y: py(g, LOW_EDGE - 0.07, z), len: (len * g.F) / z, art, ph, amp });
    const ball = (s, z, r) => paintBall((r * g.F) / z);
    const lw = (0.2 * g.F) / 1.9;
    state.hang = [
      hang('ball', -1, 1.25, 0.1, ball(-1, 1.25, 0.24), 0.4, 0.09),
      hang('ball', -1, 3.6, 0.08, ball(-1, 3.6, 0.22), 2.1, 0.08),
      hang('lamp', 1, 1.9, 0.12, paintLantern(Math.max(5, Math.round(lw)), Math.max(7, Math.round(lw * 1.5))), 3.0, 0.07),
      hang('ball', 1, 5.2, 0.06, ball(1, 5.2, 0.22), 1.2, 0.08),
    ];
  }

  function drawHangers(ctx, g, t, balls) {
    const hang = state.hang;
    ctx.fillStyle = '#2a1e16';
    for (let i = 0; i < hang.length; i++) {
      const o = hang[i];
      if (o.kind === 'ball' && !balls) continue;
      const a = Math.sin(t * 0.8 + o.ph) * o.amp + Math.sin(t * 0.31 + o.ph * 2) * o.amp * 0.4;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(a);
      ctx.fillRect(-0.5, 0, Math.max(1, o.art.width * 0.06), o.len + 1);
      ctx.drawImage(o.art, -o.art.width / 2, o.len);
      ctx.restore();
    }
  }

  // Indigo noren in the doorways; the hem swings out into the street.
  function nearDoors() {
    const out = [];
    for (const hs of state.houses) {
      const d0 = hs.z0 + hs.door;
      if (d0 > 6) continue;
      out.push({ s: hs.side, z0: d0 + 0.01, z1: d0 + 0.37, ph: hs.tone * 6 });
    }
    return out;
  }

  function drawNoren(ctx, g, t) {
    const top = 1.04;
    const hem = 0.58;
    for (const n of state.noren) {
      const step = (n.z1 - n.z0) / 3;
      for (let k = 0; k < 3; k++) {
        const sway = 0.06 + 0.05 * Math.sin(t * 0.9 + n.ph + k * 0.7);
        const xt = n.s * 0.985;
        const xb = n.s * (0.985 - sway);
        const za = n.z0 + k * step + 0.01;
        const zb = za + step - 0.02;
        ctx.fillStyle = state.norenCol;
        poly(ctx, [P(g, xt, top, za), P(g, xt, top, zb), P(g, xb, hem, zb), P(g, xb, hem, za)]);
        if (k === 1) {
          const xm = n.s * (0.985 - sway * 0.45);
          ctx.fillStyle = state.norenMark;
          poly(ctx, [P(g, xt, 0.96, za + step * 0.3), P(g, xt, 0.96, zb - step * 0.3), P(g, xm, 0.8, zb - step * 0.3), P(g, xm, 0.8, za + step * 0.3)]);
        }
      }
    }
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.025, y * 0.07, 4, 33), fbm((x - w) * 0.025, y * 0.07, 4, 33), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 234;
        img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.32, 0.68, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.H * 0.02) % c.width);
    const y = g.H * (VPY - 0.06);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // Pale glints slide down the channels toward the viewer.
  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#e9efef';
    for (let i = 0; i < GLINTS; i++) {
      const a = (t * 0.07 + i / GLINTS + (i % 3) * 0.013) % 1;
      const z = 9 * Math.pow(NEAR / 9, a);
      const s = i % 2 ? 1 : -1;
      const x = px(g, s * (0.89 + (i % 3) * 0.025), z);
      const w = Math.max(1, (0.05 * g.F) / z);
      ctx.globalAlpha = 0.7 * (1 - state.dim * 0.5) * Math.sin(a * Math.PI);
      ctx.fillRect(x - w / 2, py(g, 0, z), w, Math.max(1, w * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.mistAlpha = 0.8 - sky.night * 0.4;
    state.dim = sky.night;
    const day = 1 - sky.night * 0.6;
    state.norenCol = hex(rgb('#2b4170').map((v) => v * day));
    state.norenMark = hex(rgb('#e4dccb').map((v) => v * day));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, F: api.cols * 0.3 };
    state.g = g;
    state.houses = houseList(-1, 5).concat(houseList(1, 12));
    state.noren = nearDoors();
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.26));
    placeHangers(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawGlints(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    drawNoren(ctx, g, t);
    drawHangers(ctx, g, t, props.balls);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, balls: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
