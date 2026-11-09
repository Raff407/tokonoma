/*
 * 渡月橋 Togetsukyo — a long wooden bridge over a wide river below maple hills.
 *
 * Sky, hills, bridge and the river with its reflection are baked into one
 * layer and repainted once a minute from the clock. Between repaints only
 * two mist bands, a few water glints, a boat and some falling leaves move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const WATER = 0.6;
  const DECK = 0.565;
  const RAIL = 0.515;
  const RETINT_SECONDS = 60;
  const GLINTS = 70;
  const LEAVES = 30;
  const BOAT_SECONDS = 150;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A colour as seen through haze and dusk.
  function tone(sky, h, fog, shade) {
    let c = mixColor(rgb(h), sky.amb, 0.1);
    c = mixColor(c, sky.haze, fog);
    c = mixColor(c, rgb('#0c1020'), Math.min(1, sky.night * 0.68 + (shade || 0)));
    return hex(c);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WATER);
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
      ctx.globalAlpha = 1;
    }
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const cx = g.W * (0.12 + 0.76 * t);
    const cy = g.H * (0.3 - 0.2 * Math.sin(Math.PI * t));
    ctx.fillStyle = night ? '#e6e4da' : hex(mixColor(rgb('#f4e3b8'), sky.low, 0.35));
    ctx.globalAlpha = night ? 0.85 : 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, g.U * 2.4, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- hills -------------------------------------------------------------

  const RIDGES = [
    { top: 0.16, amp: 0.1, fog: 0.62, base: '#3a4a6c', seed: 3, patch: false },
    { top: 0.26, amp: 0.1, fog: 0.4, base: '#3f5a46', seed: 5, patch: true },
    { top: 0.36, amp: 0.07, fog: 0.16, base: '#2f4a38', seed: 8, patch: true },
  ];

  function ridgeY(g, r, i, x) {
    return g.H * (r.top + (fbm(x * 0.018 + i * 9, i * 3, 4, r.seed) - 0.5) * r.amp * 2);
  }

  function leafColor(n) {
    if (n < 0.4) return '#3c5a3c';
    if (n < 0.52) return '#d9a73a';
    if (n < 0.66) return '#c8452c';
    return '#a8381f';
  }

  function paintRidge(ctx, g, sky, r, i, rand) {
    ctx.fillStyle = tone(sky, r.base, r.fog, 0);
    ctx.beginPath();
    ctx.moveTo(0, g.H * WATER);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, ridgeY(g, r, i, x));
    ctx.lineTo(g.W, g.H * WATER);
    ctx.fill();
    if (!r.patch) return;
    const count = Math.floor(g.W * g.H * 0.012);
    for (let k = 0; k < count; k++) {
      const x = rand() * g.W;
      const top = ridgeY(g, r, i, x);
      const y = top + rand() * rand() * g.H * 0.3;
      if (y > g.H * WATER) continue;
      const n = fbm(x * 0.03 + i * 10, y * 0.06, 3, 17 + i);
      ctx.fillStyle = tone(sky, leafColor(n + (rand() - 0.5) * 0.12), r.fog, 0.05 * (y - top) / g.H);
      ctx.beginPath();
      ctx.arc(x, y, g.U * (0.7 + rand() * 1.1), 0, 6.3);
      ctx.fill();
    }
  }

  // A small five-tier pagoda standing on the middle hill.
  function paintPagoda(ctx, g, sky) {
    const px = g.W * 0.2;
    const base = ridgeY(g, RIDGES[1], 1, px) + g.U * 1.2;
    const u = g.U;
    ctx.fillStyle = tone(sky, '#2a2a34', 0.25, 0);
    ctx.fillRect(px - u * 0.15, base - u * 9, u * 0.3, u * 3);
    for (let k = 0; k < 4; k++) {
      const w = u * (2.6 - k * 0.45);
      const y = base - u * (1.6 + k * 1.8);
      ctx.fillRect(px - w / 2, y - u * 1.2, w * 0.7 + u * 0.3, u * 1.2);
      ctx.beginPath();
      ctx.moveTo(px - w * 0.9, y);
      ctx.lineTo(px + w * 0.9, y);
      ctx.lineTo(px + w * 0.5, y - u * 0.7);
      ctx.lineTo(px - w * 0.5, y - u * 0.7);
      ctx.fill();
    }
  }

  // ---- bridge ------------------------------------------------------------

  function paintBridge(ctx, g, sky) {
    const u = g.U;
    const wood = tone(sky, '#5a4430', 0.05, 0);
    const pale = tone(sky, '#b08a5c', 0.05, 0);
    const deck = g.H * DECK;
    const rail = g.H * RAIL;
    const water = g.H * WATER;
    ctx.fillStyle = wood;
    for (let px = g.W * 0.03; px < g.W; px += g.W * 0.085) {
      ctx.fillRect(px - u * 0.5, deck, u, water - deck);
      ctx.fillRect(px - u * 1.1, deck + u * 0.2, u * 2.2, u * 0.6);
    }
    ctx.fillRect(0, deck, g.W, u * 1.6);
    ctx.fillStyle = pale;
    ctx.fillRect(0, deck - u * 0.2, g.W, u * 0.5);
    ctx.fillStyle = wood;
    for (let px = 0; px < g.W; px += u * 2.4) ctx.fillRect(px, rail, Math.max(2, u * 0.7), deck - rail);
    ctx.fillRect(0, rail, g.W, Math.max(2, u * 0.8));
    ctx.fillRect(0, rail + (deck - rail) * 0.5, g.W, Math.max(1, u * 0.5));
    ctx.fillStyle = pale;
    ctx.fillRect(0, rail - u * 0.4, g.W, Math.max(1, u * 0.5));
    if (sky.night > 0.3) paintLamps(ctx, g, sky);
  }

  function paintLamps(ctx, g, sky) {
    ctx.fillStyle = '#e8b64a';
    ctx.globalAlpha = Math.min(1, sky.night * 1.2);
    for (let px = g.W * 0.03; px < g.W; px += g.W * 0.17) {
      ctx.fillRect(px - g.U * 0.4, g.H * RAIL - g.U * 1.6, g.U * 0.8, g.U * 1.2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- water and banks ---------------------------------------------------

  function paintWater(ctx, g, sky, scene) {
    const y0 = g.H * WATER;
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, sky.haze, 0.4)));
    grad.addColorStop(1, hex(mixColor(sky.top, rgb('#1a2438'), 0.6)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, g.H - y0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, g.W, g.H - y0);
    ctx.clip();
    ctx.translate(0, y0 * 2);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(scene, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    // Still-water streaks across the reflection.
    ctx.fillStyle = hex(mixColor(sky.low, rgb('#ffffff'), 0.3));
    const rand = K.rng(77);
    for (let i = 0; i < g.H * 0.4; i++) {
      ctx.globalAlpha = 0.08 + rand() * 0.12;
      ctx.fillRect(rand() * g.W, y0 + rand() * (g.H - y0), g.W * (0.03 + rand() * 0.08), 1);
    }
    ctx.globalAlpha = 1;
    // Pier feet and the ring of water around each.
    for (let px = g.W * 0.03; px < g.W; px += g.W * 0.085) {
      ctx.fillStyle = tone(sky, '#3a2c20', 0.1, 0);
      ctx.fillRect(px - g.U * 0.5, y0, g.U, g.U * 1.6);
      ctx.fillStyle = hex(mixColor(sky.low, rgb('#ffffff'), 0.4));
      ctx.globalAlpha = 0.5;
      ctx.fillRect(px - g.U * 1.6, y0 + g.U * 1.6, g.U * 3.2, 1);
      ctx.globalAlpha = 1;
    }
  }

  function paintBank(ctx, g, sky, rand) {
    const top = g.H * 0.9;
    ctx.fillStyle = tone(sky, '#25382e', 0, 0);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W * 0.4; x += 1) ctx.lineTo(x, top + (fbm(x * 0.05, 1, 3, 4) - 0.5) * g.U * 3 + smoothstep(0.1, 0.4, x / g.W) * g.U * 7);
    ctx.lineTo(g.W * 0.4, g.H);
    ctx.fill();
    for (let k = 0; k < g.W * 0.5; k++) {
      const x = rand() * g.W * 0.36;
      const y = top + rand() * (g.H - top) + g.U * 2 * smoothstep(0.1, 0.4, x / g.W);
      ctx.fillStyle = tone(sky, rand() < 0.4 ? '#d9a73a' : '#3c5a3c', 0, 0);
      ctx.fillRect(x, y - g.U * (0.8 + rand() * 1.4), 1, g.U * (0.8 + rand() * 1.4));
    }
  }

  // A maple branch hanging in from the top right.
  function paintBranch(ctx, g, sky, rand) {
    ctx.strokeStyle = tone(sky, '#2a2018', 0, 0);
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    ctx.beginPath();
    ctx.moveTo(g.W * 1.02, g.H * 0.04);
    ctx.quadraticCurveTo(g.W * 0.88, g.H * 0.08, g.W * 0.74, g.H * 0.2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.9, g.H * 0.075);
    ctx.quadraticCurveTo(g.W * 0.86, g.H * 0.15, g.W * 0.84, g.H * 0.24);
    ctx.stroke();
    const spots = [[0.74, 0.2], [0.78, 0.17], [0.84, 0.24], [0.88, 0.1], [0.81, 0.12], [0.93, 0.06]];
    for (const s of spots) {
      for (let k = 0; k < 26; k++) {
        const a = rand() * 6.3;
        const d = rand() * g.U * 4.5;
        ctx.fillStyle = tone(sky, rand() < 0.65 ? '#c8452c' : '#d9a73a', 0, 0);
        ctx.fillRect(g.W * s[0] + Math.cos(a) * d, g.H * s[1] + Math.sin(a) * d * 0.7, Math.max(1, g.U * 0.9), Math.max(1, g.U * 0.9));
      }
    }
  }

  // ---- bake --------------------------------------------------------------

  function paintAll(g, sky) {
    const rand = K.rng(31);
    const scene = layer(g.W, g.H);
    const sc = scene.getContext('2d');
    paintSky(sc, g, sky, rand);
    RIDGES.forEach((r, i) => paintRidge(sc, g, sky, r, i, rand));
    paintPagoda(sc, g, sky);
    paintBridge(sc, g, sky);
    const out = layer(g.W, g.H);
    const ctx = out.getContext('2d');
    ctx.drawImage(scene, 0, 0, g.W, g.H * WATER, 0, 0, g.W, g.H * WATER);
    paintWater(ctx, g, sky, scene);
    paintBank(ctx, g, sky, rand);
    paintBranch(ctx, g, sky, rand);
    return out;
  }

  function paintMist(g, w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.pow(Math.sin((y / c.height) * Math.PI), 1.5);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.08, 4, seed), fbm((x - c.width) * 0.012, y * 0.08, 4, seed), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = smoothstep(0.42, 0.7, v) * band * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintBoat(g) {
    const u = g.U;
    const w = Math.ceil(u * 12);
    const h = Math.ceil(u * 6);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a2018';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7);
    ctx.lineTo(w, h * 0.7);
    ctx.lineTo(w * 0.9, h);
    ctx.lineTo(w * 0.1, h);
    ctx.fill();
    ctx.fillStyle = '#6a5440';
    ctx.fillRect(w * 0.3, h * 0.28, w * 0.34, h * 0.42);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(w * 0.27, h * 0.22, w * 0.4, Math.max(1, u * 0.5));
    ctx.fillRect(w * 0.82, 0, Math.max(1, u * 0.3), h * 0.75);
    ctx.fillStyle = '#e8b64a';
    ctx.fillRect(w * 0.42, h * 0.4, w * 0.1, h * 0.22);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    state.scene = paintAll(g, sky);
    state.mistTone = hex(mixColor(sky.amb, sky.haze, 0.5));
    state.dark = sky.night;
    state.mistA = 0.5 - sky.night * 0.25;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const bands = [
      { c: state.mist1, y: g.H * 0.38, v: 0.9, a: 0.4 },
      { c: state.mist2, y: g.H * 0.585, v: -1.4, a: 0.45 },
    ];
    for (const b of bands) {
      const off = -(((t * g.U * b.v) % b.c.width) + b.c.width) % b.c.width;
      ctx.globalAlpha = Math.min(1, b.a * state.mistA * 2 * amount);
      ctx.drawImage(b.c, off, b.y);
      ctx.drawImage(b.c, off + b.c.width, b.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#f4efe0';
    for (let i = 0; i < GLINTS; i++) {
      const a = 0.5 + 0.5 * Math.sin(t * (0.5 + state.gv[i]) + state.gp[i]);
      ctx.globalAlpha = a * a * 0.8 * (1 - state.dark * 0.5);
      ctx.fillRect(state.gx[i] * g.W, g.H * (WATER + 0.04 + state.gy[i] * 0.3), g.U * (1.5 + state.gv[i] * 3), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function drawBoat(ctx, g, t) {
    const p = (t % BOAT_SECONDS) / BOAT_SECONDS;
    const b = state.boat;
    const x = lerp(-b.width, g.W, p);
    const y = g.H * 0.74 + Math.sin(t * 0.7) * g.U * 0.3;
    ctx.drawImage(b, x, y);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(b, x, y + b.height * 2 - 1, b.width, -b.height);
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t, amount) {
    const n = Math.min(LEAVES, Math.round(LEAVES * amount));
    const s = Math.max(2, g.U * 1.4);
    for (let i = 0; i < n; i++) {
      const life = ((t * state.lv[i] * 0.05 + state.lp[i]) % 1 + 1) % 1;
      const x = state.lx[i] * g.W * 0.7 + g.W * 0.3 - life * g.W * 0.3 + Math.sin(t * 0.8 + i) * g.U * 1.5;
      const y = -s + life * (g.H * 0.95);
      ctx.fillStyle = i % 3 === 0 ? '#d9a73a' : '#c8452c';
      ctx.globalAlpha = 0.9 - state.dark * 0.4;
      ctx.fillRect(x, y, s, s * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(5);
    state.mist1 = paintMist(g, Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.16), 21);
    state.mist2 = paintMist(g, Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.14), 33);
    state.boat = paintBoat(g);
    state.gx = new Float32Array(GLINTS).map(() => rand());
    state.gy = new Float32Array(GLINTS).map(() => rand());
    state.gv = new Float32Array(GLINTS).map(() => rand());
    state.gp = new Float32Array(GLINTS).map(() => rand() * 6.3);
    state.lx = new Float32Array(LEAVES).map(() => rand());
    state.lp = new Float32Array(LEAVES).map(() => rand());
    state.lv = new Float32Array(LEAVES).map(() => 0.6 + rand() * 0.8);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.scene, 0, 0);
    drawGlints(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    if (props.boat) drawBoat(ctx, g, t);
    drawLeaves(ctx, g, t, props.leaves);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, leaves: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
