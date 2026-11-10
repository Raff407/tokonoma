/*
 * 龙舟 Dragon Boats — three carved dragon boats in a row on a green river.
 *
 * Sky, hills, pagoda, willow bank and pavilion are baked into one layer and
 * repainted once a minute from the clock. The river is that layer flipped
 * and laid back in thin rows. Each boat is a sprite baked once. Between
 * repaints only the boats, their oars, wakes, ripples and a few glints move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.4;
  const RETINT_SECONDS = 60;
  const ROW = 2;
  const GLINTS = 20;
  const OARS = 7;
  const CROSS_SECONDS = 120;
  const BOATS = [
    { fy: 0.58, scale: 0.9, hull: '#a8372a', phase: 0.0, lag: 0.0 },
    { fy: 0.73, scale: 1.15, hull: '#4a6b4a', phase: 1.3, lag: 0.07 },
    { fy: 0.88, scale: 1.4, hull: '#a8372a', phase: 2.6, lag: 0.14 },
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, wy: Math.round(H * WATER) };
  }

  function tone(sky, ink, haze, dark) {
    const base = mixColor(rgb(ink), sky.haze, haze);
    return hex(mixColor(base, rgb('#10142a'), sky.night * dark));
  }

  // ---- sky and hills -------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, hex(mixColor(sky.top, rgb('#d8d4c4'), 0.2)));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#e6e0cc'), 0.4)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.2; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.4);
        ctx.fillRect(rand() * g.W, rand() * g.wy * 0.7, 1, 1);
      }
      ctx.fillStyle = '#ece6cf';
      ctx.globalAlpha = 0.9 * sky.night;
      blob(ctx, g.W * 0.2, g.H * 0.1, g.U * 2.2, g.U * 2.2);
      ctx.globalAlpha = 0.12 * sky.night;
      blob(ctx, g.W * 0.2, g.H * 0.1, g.U * 5.5, g.U * 5.5);
    } else {
      ctx.fillStyle = '#f4ecd2';
      ctx.globalAlpha = 0.4 * (1 - sky.night);
      blob(ctx, g.W * 0.5, g.H * 0.15, g.U * 3, g.U * 3);
      ctx.globalAlpha = 0.12;
      blob(ctx, g.W * 0.5, g.H * 0.15, g.U * 8, g.U * 8);
    }
    ctx.globalAlpha = 1;
  }

  function ridgeFar(g, x) {
    const peak = Math.exp(-(((x - g.W * 0.82) / (g.W * 0.1)) ** 2)) * g.H * 0.14
      + Math.exp(-(((x - g.W * 0.18) / (g.W * 0.08)) ** 2)) * g.H * 0.09;
    return g.wy - g.H * 0.05 - peak + (fbm(x / (g.U * 30), 1.7, 3, 13) - 0.5) * g.H * 0.04;
  }

  function ridgeNear(g, x) {
    const hump = Math.exp(-(((x - g.W * 0.7) / (g.W * 0.2)) ** 2));
    return g.wy - g.H * 0.012 - hump * g.H * 0.07 + (fbm(x / (g.U * 14), 4.2, 3, 7) - 0.5) * g.H * 0.02;
  }

  function fillRidge(ctx, g, fn, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, fn(g, x));
    ctx.lineTo(g.W + 2, g.wy);
    ctx.closePath();
    ctx.fill();
  }

  function mistBand(ctx, g, sky, y, h, alpha) {
    const grad = ctx.createLinearGradient(0, y - h, 0, y + h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, hex(mixColor(rgb('#e8e4d6'), sky.low, 0.35)));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - h, g.W, h * 2);
    ctx.globalAlpha = 1;
  }

  // Slim stone pagoda on the far hill.
  function paintPagoda(ctx, g, sky) {
    const u = g.U;
    const px = g.W * 0.82;
    const base = ridgeNear(g, px) + u * 0.5;
    const n = 5;
    const tier = u * 2.3;
    const wall = tone(sky, '#9a5a44', 0.45, 0.55);
    const eave = tone(sky, '#3a3c44', 0.4, 0.4);
    let y = base;
    for (let i = 0; i < n; i++) {
      const w = u * (2.4 - i * 0.28);
      ctx.fillStyle = wall;
      ctx.fillRect(px - w * 0.6, y - tier * 0.6, w * 1.2, tier * 0.6);
      y -= tier * 0.6;
      const ew = w * 1.5;
      ctx.fillStyle = eave;
      poly(ctx, [px - ew, y - tier * 0.3, px - ew * 0.6, y, px + ew * 0.6, y, px + ew, y - tier * 0.3, px + ew * 0.6, y + tier * 0.12, px - ew * 0.6, y + tier * 0.12]);
      y -= tier * 0.2;
    }
    ctx.fillStyle = tone(sky, '#c9a24c', 0.4, 0.3);
    ctx.fillRect(px - 0.5, y - u * 2.4, Math.max(1, u * 0.22), u * 2.4);
  }

  // Willow bank at left with a small pavilion with upturned eaves.
  function paintBank(ctx, g, sky, rand) {
    const u = g.U;
    ctx.fillStyle = tone(sky, '#3c4a38', 0.25, 0.6);
    ctx.fillRect(0, g.wy - u * 1.1, g.W * 0.36, u * 1.1);
    const px = g.W * 0.2;
    const by = g.wy - u * 1.1;
    ctx.fillStyle = tone(sky, '#a04a38', 0.3, 0.55);
    ctx.fillRect(px - u * 2.2, by - u * 2.8, u * 4.4, u * 2.8);
    ctx.fillStyle = tone(sky, '#2a2c34', 0.25, 0.4);
    ctx.fillRect(px - u * 1.3, by - u * 2.4, u * 2.6, u * 2.2);
    ctx.fillStyle = tone(sky, '#34363e', 0.2, 0.4);
    poly(ctx, [px - u * 4.6, by - u * 4.6, px - u * 2.6, by - u * 3.4, px + u * 2.6, by - u * 3.4, px + u * 4.6, by - u * 4.6,
      px + u * 2.6, by - u * 6.4, px, by - u * 7.2, px - u * 2.6, by - u * 6.4]);
    ctx.fillStyle = tone(sky, '#c9a24c', 0.3, 0.3);
    ctx.fillRect(px - u * 0.2, by - u * 8.4, Math.max(1, u * 0.4), u * 1.4);
    // Willows with drooping strands.
    const tones = [tone(sky, '#5f7448', 0.3, 0.55), tone(sky, '#7a8e58', 0.3, 0.5)];
    const xs = [0.03, 0.09, 0.14, 0.27, 0.32];
    for (let i = 0; i < xs.length; i++) {
      const x = g.W * xs[i];
      const h = u * (11 + rand() * 5);
      ctx.strokeStyle = tone(sky, '#3a3228', 0.2, 0.5);
      ctx.lineWidth = Math.max(1, u * 0.45);
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.quadraticCurveTo(x + u * 0.6, by - h * 0.5, x, by - h);
      ctx.stroke();
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = tones[k];
        blob(ctx, x + (rand() - 0.5) * u, by - h - u * k * 0.5, u * (3.8 - k * 0.8), u * (2 - k * 0.3));
      }
      ctx.strokeStyle = tones[0];
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      for (let s = -3; s <= 3; s++) {
        const sx = x + s * u * 0.9;
        ctx.moveTo(sx, by - h);
        ctx.quadraticCurveTo(sx + s * 0.5, by - h * 0.65, sx + s * 0.3, by - h * 0.35);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function paintWorld(g, sky, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    fillRidge(ctx, g, ridgeFar, tone(sky, '#5c7074', 0.6, 0.5));
    mistBand(ctx, g, sky, g.wy - g.H * 0.07, g.U * 6, 0.6);
    fillRidge(ctx, g, ridgeNear, tone(sky, '#3f5a4c', 0.38, 0.6));
    paintPagoda(ctx, g, sky);
    mistBand(ctx, g, sky, g.wy - g.U * 1.5, g.U * 3, 0.45);
    paintBank(ctx, g, sky, rand);
    return c;
  }

  // ---- boat sprite -----------------------------------------------------------

  // Side view facing right, drawn in units of one boat-length/40, origin on the waterline.
  function bakeBoat(sky, hullInk) {
    const w = 52;
    const h = 22;
    const c = layer(w * 4, h * 4);
    const ctx = c.getContext('2d');
    ctx.scale(4, 4);
    ctx.translate(w / 2, 16);
    const hull = tone(sky, hullInk, 0.05, 0.6);
    const gold = tone(sky, '#c9a24c', 0.05, 0.5);
    const dark = tone(sky, '#2a2024', 0.05, 0.4);
    const deep = tone(sky, '#26362c', 0.05, 0.5);
    // Hull: long and shallow, rising at both ends.
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(-19, -4.2);
    ctx.quadraticCurveTo(-15, -1.1, -8, -1.1);
    ctx.lineTo(10, -1.1);
    ctx.quadraticCurveTo(16, -1.1, 19.5, -3.4);
    ctx.quadraticCurveTo(15, 1.6, 6, 1.9);
    ctx.lineTo(-7, 1.9);
    ctx.quadraticCurveTo(-15, 1.7, -19, -4.2);
    ctx.fill();
    // Gold band along the gunwale and dark keel line.
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-18.4, -3.8);
    ctx.quadraticCurveTo(-14, -1, -8, -0.9);
    ctx.lineTo(10, -0.9);
    ctx.quadraticCurveTo(15.5, -0.9, 18.8, -3.1);
    ctx.stroke();
    ctx.strokeStyle = deep;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-14, 1.2);
    ctx.lineTo(12, 1.2);
    ctx.stroke();
    // Cross benches.
    ctx.fillStyle = dark;
    for (let x = -11; x <= 11; x += 2.2) ctx.fillRect(x, -1.7, 0.7, 0.8);
    // Drum on a stand amidships.
    ctx.fillStyle = tone(sky, '#8a4a30', 0.05, 0.5);
    ctx.fillRect(-1.6, -4.6, 3.2, 3.2);
    ctx.fillStyle = gold;
    ctx.fillRect(-1.8, -4.8, 3.6, 0.6);
    ctx.fillRect(-1.8, -2, 3.6, 0.5);
    ctx.fillStyle = dark;
    ctx.fillRect(-0.4, -1.5, 0.8, 0.7);
    // Dragon neck and head at the bow.
    ctx.strokeStyle = hull;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(18.2, -3.2);
    ctx.quadraticCurveTo(21.2, -5, 20.4, -8.6);
    ctx.stroke();
    ctx.fillStyle = hull;
    poly(ctx, [19.2, -9.6, 21.6, -10.6, 25.6, -10.2, 26.4, -9, 22.8, -8.6, 22.2, -7.4, 19.8, -7.8]);
    ctx.fillStyle = gold;
    poly(ctx, [22.8, -8.6, 26.2, -8.8, 25.6, -7.8, 22.4, -7.6]);
    ctx.fillRect(25.6, -11.2, 0.9, 1);
    ctx.fillStyle = dark;
    ctx.fillRect(23.2, -10.3, 0.8, 0.8);
    // Horns and mane sweeping back.
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(21.2, -10.4);
    ctx.quadraticCurveTo(20, -13.2, 17.6, -13);
    ctx.moveTo(20.4, -9.2);
    ctx.quadraticCurveTo(18.2, -10.8, 16.6, -9.4);
    ctx.stroke();
    // Gold scales along the neck.
    ctx.fillStyle = gold;
    ctx.fillRect(19.7, -5.6, 0.8, 0.7);
    ctx.fillRect(20.4, -7.2, 0.8, 0.7);
    // Tail curling up at the stern.
    ctx.strokeStyle = hull;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18.2, -3.6);
    ctx.quadraticCurveTo(-21.4, -5.6, -20.2, -8.8);
    ctx.stroke();
    ctx.fillStyle = gold;
    poly(ctx, [-21.6, -9.6, -20.2, -9.4, -18.4, -11.6, -19.8, -8.2]);
    return c;
  }

  // ---- bake ------------------------------------------------------------------

  function paintLeaves(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spots = [[0.05, 0.94], [0.12, 0.98], [0.93, 0.93], [0.88, 0.99], [0.98, 0.98]];
    for (const s of spots) {
      const r = g.U * (2.6 + rand() * 2);
      ctx.fillStyle = tone(sky, '#35523a', 0.1, 0.55);
      blob(ctx, g.W * s[0], g.H * s[1], r, r * 0.36);
      ctx.fillStyle = tone(sky, '#5a7a4a', 0.1, 0.5);
      blob(ctx, g.W * s[0] - r * 0.15, g.H * s[1] - r * 0.06, r * 0.68, r * 0.22);
    }
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(61);
    state.world = paintWorld(g, sky, rand);
    state.leaves = paintLeaves(g, sky, rand);
    state.sprites = BOATS.map((b) => bakeBoat(sky, b.hull));
    state.water = hex(mixColor(mixColor(rgb('#4a7064'), sky.low, 0.28), rgb('#0e1426'), sky.night * 0.7));
    state.foam = hex(mixColor(rgb('#eef0e4'), sky.low, 0.3));
    state.oar = hex(mixColor(rgb('#5a4430'), rgb('#141824'), sky.night * 0.6));
    state.glint = hex(mixColor(rgb('#f2ecd6'), sky.low, 0.3));
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ----------------------------------------------------------------

  function boatX(g, b, t) {
    const span = g.W * 1.6;
    const p = ((t / CROSS_SECONDS + 1.55 - b.lag * 2) % 1 + 1) % 1;
    return -g.W * 0.3 + p * span;
  }

  function drawLake(ctx, g, t) {
    ctx.fillStyle = state.water;
    ctx.fillRect(0, g.wy, g.W, g.H - g.wy);
    const depth = g.H - g.wy;
    ctx.globalAlpha = 0.7;
    for (let y = g.wy; y < g.H; y += ROW) {
      const d = y - g.wy;
      const sy = Math.max(0, g.wy - d * 0.6 - ROW);
      const amp = g.U * (0.15 + 0.7 * (d / depth));
      const dx = Math.sin(t * 0.8 + y * 0.45) * amp;
      ctx.drawImage(state.world, 0, sy, g.W, ROW, dx, y, g.W, ROW);
    }
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = state.water;
    ctx.fillRect(0, g.wy, g.W, depth);
    ctx.globalAlpha = 1;
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const fy = (i * 0.618) % 1;
      const y = g.wy + g.U * 1.5 + fy * (depth - g.U * 3);
      const x = ((i * 37.7 + t * g.U * (0.4 + fy)) % (g.W + 40)) - 20;
      ctx.globalAlpha = 0.3 * (0.5 + 0.5 * Math.sin(t * 1.2 + i * 2.1));
      ctx.fillRect(x, y, g.U * (1.5 + fy * 3), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawWake(ctx, g, b, x, y, s, t, amount) {
    const u = g.U * s;
    ctx.strokeStyle = state.foam;
    ctx.lineWidth = 1;
    // V wake behind the stern: two lines spreading back.
    ctx.globalAlpha = 0.34 * amount;
    ctx.beginPath();
    ctx.moveTo(x - u * 22, y + u * 0.6);
    ctx.lineTo(x - u * 58, y + u * 2.6);
    ctx.moveTo(x - u * 22, y + u * 0.6);
    ctx.lineTo(x - u * 58, y - u * 1.2);
    ctx.stroke();
    // Rings ringing out from the drum beat.
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 0.5 + b.phase * 0.2 + k / 3) % 1);
      ctx.globalAlpha = 0.4 * (1 - ph) * amount;
      ctx.beginPath();
      ctx.ellipse(x - u * (4 + ph * 14), y + u * 1.4, u * (3 + ph * 11), u * (0.5 + ph * 1.4), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawOars(ctx, g, b, x, y, s, t) {
    const u = g.U * s;
    ctx.strokeStyle = state.oar;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < OARS; i++) {
      const ox = x - u * 12 + i * u * 4;
      const sw = Math.sin(t * 2.4 + b.phase) * u * 2.6;
      ctx.moveTo(ox, y - u * 1.4);
      ctx.lineTo(ox - sw, y + u * 3.2);
    }
    ctx.stroke();
  }

  function drawBoat(ctx, g, b, i, t, props) {
    const s = b.scale;
    const x = boatX(g, b, t);
    const y = g.H * b.fy;
    const bob = Math.sin(t * 1.1 + b.phase) * g.U * 0.18;
    const sp = state.sprites[i];
    const sw = sp.width / 4 * g.U * s;
    const sh = sp.height / 4 * g.U * s;
    const ox = x - 26 * g.U * s;
    const oy = y + bob - 16 * g.U * s;
    if (props.wakes > 0) drawWake(ctx, g, b, x, y, s, t, Math.min(1, props.wakes));
    // Reflection, flipped and faint.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.translate(0, y + bob);
    ctx.scale(1, -0.6);
    ctx.drawImage(sp, ox, oy - y - bob, sw, sh);
    ctx.restore();
    ctx.drawImage(sp, ox, oy, sw, sh);
    if (props.oars) drawOars(ctx, g, b, x, y + bob, s, t);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.world, 0, 0);
    drawLake(ctx, g, t);
    for (let i = 0; i < BOATS.length; i++) drawBoat(ctx, g, BOATS[i], i, t, props);
    ctx.drawImage(state.leaves, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', wakes: 1, oars: true, ramp: 'lines', cell: 7, boost: 0.14, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
