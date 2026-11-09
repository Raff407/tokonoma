/*
 * 清水寺 Kiyomizu — a temple's wooden stage on tall pillars over a valley of autumn maples.
 *
 * Sky, far hills and the little pagoda are one layer; the hill, hall, stage, pillars
 * and maple canopy are another. Both are repainted once a minute from the clock.
 * Between repaints only a mist strip, a cloud strip and a small pool of leaves move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, fbm, smoothstep, mixColor, toHex, parseColor } = K;

  const TAU = Math.PI * 2;
  const DECK = 0.5;
  const STAGE = [0.27, 0.53];
  const HALL = [0.53, 0.83];
  const RETINT_SECONDS = 60;
  const SKY_BANDS = 6;
  const MAX_LEAVES = 48;
  const LEAVES = 24;
  const MAPLE = [['#8a3022', '#b4442b', '#d6683c'], ['#a55a28', '#cc8038', '#e4a650'], ['#94503e', '#ad654a', '#c27f5a']];
  const GREEN = ['#2e4230', '#3e5638', '#5a7246'];
  const WOOD = { post: '#6e5038', beam: '#8e7050', deck: '#a8865e', edge: '#3a2a20', rail: '#7a3a2a', wall: '#5c4434', panel: '#d8ccb0' };
  const ROOF = { face: '#5e5048', top: '#7a6c60', eave: '#2c2420', under: '#3a2e26', line: '#4a3e36' };
  const LEAF_TONES = ['#d4512f', '#e4843e', '#c4422b', '#e2ad50'];
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function crown(ctx, x, y, r, inks) {
    ctx.fillStyle = inks[0];
    blob(ctx, x, y, r, r * 0.8);
    ctx.fillStyle = inks[1];
    blob(ctx, x - r * 0.2, y - r * 0.18, r * 0.72, r * 0.58);
    ctx.fillStyle = inks[2];
    blob(ctx, x - r * 0.38, y - r * 0.34, r * 0.34, r * 0.28);
  }

  // Ground under the stage: deep at the left, climbing to the hill on the right.
  function ground(g, x) {
    const f = x / g.W;
    return g.H * (0.98 - 0.2 * smoothstep(0.5, 0.9, f)) + (fbm(x * 0.05, 3, 3, 4) - 0.5) * g.U * 3;
  }

  function hillTop(g, x) {
    const f = x / g.W;
    return g.H * (0.62 - 0.4 * smoothstep(0.6, 1.08, f)) + (fbm(x * 0.04, 7, 3, 8) - 0.5) * g.U * 4;
  }

  // ---- back layer ----------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    // A few flat bands rather than a smooth ramp.
    const bands = SKY_BANDS - 1;
    const inks = [];
    for (let k = 0; k <= bands; k++) inks.push(hex(mixColor(sky.top, sky.low, k / bands)));
    ctx.fillStyle = inks[bands];
    ctx.fillRect(0, 0, g.W, g.H);
    const h = g.H * 0.6;
    for (let y = 0; y < h; y++) {
      const f = (y / h) * bands;
      const k = Math.floor(f);
      ctx.fillStyle = inks[Math.min(bands, k + (f - k > 0.5 ? 1 : 0))];
      ctx.fillRect(0, y, g.W, 1);
    }
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function paintRidge(ctx, g, ink, base, amp, freq, seed) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * base - fbm(x * freq, seed, 3, seed) * g.H * amp);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function pagoda(ctx, g, sky, x, base, h) {
    const tier = h / 3.6;
    const red = hex(mixColor(rgb('#b04a30'), sky.haze, 0.3));
    const roof = hex(mixColor(rgb('#3a302c'), sky.haze, 0.3));
    for (let i = 0; i < 3; i++) {
      const y = base - tier * (i + 1);
      const w = h * (0.34 - i * 0.05);
      ctx.fillStyle = red;
      ctx.fillRect(x - w * 0.33, y, w * 0.66, tier);
      ctx.fillStyle = roof;
      poly(ctx, [x - w * 0.62, y + tier * 0.12, x + w * 0.62, y + tier * 0.12, x + w * 0.3, y - tier * 0.22, x - w * 0.3, y - tier * 0.22]);
    }
    ctx.fillStyle = hex(mixColor(rgb('#b49640'), sky.haze, 0.3));
    ctx.fillRect(x - Math.max(0.5, h * 0.015), base - tier * 3 - h * 0.2, Math.max(1, h * 0.03), h * 0.2);
  }

  function paintFarHill(ctx, g, sky, rand) {
    const farGreen = GREEN.map((c) => hex(mixColor(rgb(c), sky.haze, 0.4)));
    const leaf = MAPLE.map((m) => m.map((c) => hex(mixColor(rgb(c), sky.haze, 0.4))));
    const top = (x) => g.H * (0.5 + 0.1 * smoothstep(0.05, 0.4, x / g.W)) + (fbm(x * 0.05, 2, 3, 3) - 0.5) * g.U * 3;
    ctx.fillStyle = hex(mixColor(rgb('#4a5a48'), sky.haze, 0.45));
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W * 0.6; x += 2) ctx.lineTo(x, top(x));
    ctx.lineTo(g.W * 0.6, g.H);
    ctx.fill();
    pagoda(ctx, g, sky, g.W * 0.12, top(g.W * 0.12) + g.U, g.H * 0.2);
    for (let y = g.H * 0.52; y < g.H; y += g.U * 2.2) {
      for (let x = 0; x < g.W * 0.6; x += g.U * (2.5 + rand() * 2)) {
        if (y < top(x) + g.U * 2) continue;
        if (Math.abs(x - g.W * 0.12) < g.U * 4 && y < top(x) + g.U * 4) continue;
        const r = g.U * (1.6 + rand() * 1.2);
        crown(ctx, x, y, r, rand() < 0.25 ? farGreen : leaf[rand() < 0.65 ? 0 : 1]);
      }
    }
  }

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintRidge(ctx, g, hex(mixColor(sky.haze, sky.low, 0.35)), 0.5, 0.1, 0.008, 3);
    paintRidge(ctx, g, hex(mixColor(sky.haze, rgb('#3a4a52'), 0.25)), 0.56, 0.08, 0.012, 6);
    paintFarHill(ctx, g, sky, rand);
    return c;
  }

  // ---- front layer ---------------------------------------------------------

  function paintHill(ctx, g, rand) {
    ctx.fillStyle = '#2a3a2c';
    ctx.beginPath();
    ctx.moveTo(g.W * 0.6, g.H);
    for (let x = g.W * 0.6; x <= g.W + 2; x += 2) ctx.lineTo(x, hillTop(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let y = g.H * 0.22; y < g.H; y += g.U * 2.6) {
      for (let x = g.W * 0.62; x < g.W + g.U * 3; x += g.U * (3 + rand() * 2)) {
        if (y < hillTop(g, x) + g.U) continue;
        const r = g.U * (2.2 + rand() * 1.6);
        crown(ctx, x, y, r, rand() < 0.4 ? GREEN : MAPLE[rand() < 0.6 ? 0 : 1]);
      }
    }
  }

  function paintRoof(ctx, g) {
    const u = g.U;
    const x0 = g.W * HALL[0];
    const x1 = g.W * HALL[1];
    const bot = g.H * 0.4;
    const ov = (x1 - x0) * 0.1;
    const mid = g.H * 0.29;
    const ridge = g.H * 0.2;
    const inset = (x1 - x0) * 0.2;
    ctx.fillStyle = ROOF.under;
    ctx.fillRect(x0 - ov * 0.6, bot, x1 - x0 + ov * 1.2, u * 1.6);
    ctx.fillStyle = ROOF.face;
    ctx.beginPath();
    ctx.moveTo(x0 - ov, bot + u * 0.4);
    ctx.quadraticCurveTo(x0 - ov * 0.2, bot - u * 2, x0 + inset * 0.6, mid);
    ctx.lineTo(x1 - inset * 0.6, mid);
    ctx.quadraticCurveTo(x1 + ov * 0.2, bot - u * 2, x1 + ov, bot + u * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ROOF.top;
    poly(ctx, [x0 + inset * 0.5, mid + u * 0.4, x1 - inset * 0.5, mid + u * 0.4, x1 - inset, ridge, x0 + inset, ridge]);
    ctx.fillStyle = ROOF.line;
    for (let k = 1; k < 5; k++) ctx.fillRect(x0 + inset * 0.6, lerp(mid, bot, k / 5), x1 - x0 - inset * 1.2, 1);
    ctx.fillStyle = ROOF.eave;
    ctx.fillRect(x0 + inset, ridge - u * 0.8, x1 - x0 - inset * 2, u * 1.2);
    ctx.fillRect(x0 - ov, bot, x1 - x0 + ov * 2, Math.max(1, u * 0.7));
  }

  function paintHallBody(ctx, g) {
    const u = g.U;
    const x0 = g.W * HALL[0];
    const x1 = g.W * HALL[1];
    const top = g.H * 0.41;
    const deck = g.H * DECK;
    ctx.fillStyle = WOOD.wall;
    ctx.fillRect(x0, top, x1 - x0, deck - top);
    const bays = 9;
    for (let i = 0; i < bays; i++) {
      const bx = lerp(x0, x1, i / bays);
      ctx.fillStyle = i % 2 ? WOOD.panel : '#a08c6c';
      ctx.fillRect(bx + u * 0.8, top + u * 1.5, (x1 - x0) / bays - u * 1.6, deck - top - u * 3);
    }
    ctx.fillStyle = WOOD.post;
    for (let i = 0; i <= bays; i++) ctx.fillRect(lerp(x0, x1, i / bays) - u * 0.4, top, Math.max(1, u * 0.8), deck - top);
  }

  function paintStage(ctx, g) {
    const u = g.U;
    const x0 = g.W * STAGE[0];
    const x1 = g.W * HALL[1];
    const deck = g.H * DECK;
    // A small wing pavilion at the far end of the stage.
    const wx = x0 + g.W * 0.015;
    ctx.fillStyle = WOOD.wall;
    ctx.fillRect(wx, deck - u * 6, g.W * 0.05, u * 6);
    ctx.fillStyle = WOOD.panel;
    ctx.fillRect(wx + u, deck - u * 5, g.W * 0.05 - u * 2, u * 3.4);
    ctx.fillStyle = ROOF.face;
    poly(ctx, [wx - u * 2.5, deck - u * 5.6, wx + g.W * 0.05 + u * 2.5, deck - u * 5.6, wx + g.W * 0.04, deck - u * 9, wx + g.W * 0.01, deck - u * 9]);
    ctx.fillStyle = ROOF.eave;
    ctx.fillRect(wx - u * 2.5, deck - u * 6, g.W * 0.05 + u * 5, Math.max(1, u * 0.6));
    // Railing along the open stage.
    ctx.fillStyle = WOOD.rail;
    ctx.fillRect(x0, deck - u * 2.4, g.W * HALL[0] - x0, Math.max(1, u * 0.6));
    for (let x = x0; x < g.W * HALL[0]; x += u * 2.2) ctx.fillRect(x, deck - u * 2.4, Math.max(1, u * 0.4), u * 2.4);
    ctx.fillStyle = WOOD.deck;
    ctx.fillRect(x0 - u, deck, x1 - x0 + u, u * 1.4);
    ctx.fillStyle = WOOD.edge;
    ctx.fillRect(x0 - u, deck + u * 1.4, x1 - x0 + u, u * 1.1);
  }

  // The lattice of pillars and cross beams under the stage.
  function paintPillars(ctx, g) {
    const u = g.U;
    const x0 = g.W * STAGE[0];
    const x1 = g.W * HALL[1];
    const deck = g.H * DECK + u * 2.5;
    const n = Math.round((x1 - x0) / (u * 4.2));
    const w = Math.max(1, u * 1.3);
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1 - u, i / n);
      ctx.fillStyle = i % 2 ? WOOD.post : '#7e6044';
      ctx.fillRect(x, deck, w, ground(g, x) - deck + u * 2);
    }
    ctx.fillStyle = WOOD.beam;
    for (let y = deck + u * 5; y < g.H; y += u * 6.5) {
      let a = -1;
      for (let i = 0; i <= n; i++) {
        const x = lerp(x0, x1 - u, i / n);
        if (ground(g, x) > y + u) { if (a < 0) a = x; }
      }
      if (a >= 0) {
        let b = a;
        for (let i = n; i >= 0; i--) {
          const x = lerp(x0, x1 - u, i / n);
          if (ground(g, x) > y + u) { b = x; break; }
        }
        ctx.fillRect(a - u * 0.6, y, b - a + w + u * 1.2, Math.max(1, u * 1));
      }
    }
  }

  function paintCanopy(ctx, g, rand) {
    const top = (x) => g.H * 0.8 + Math.sin(x * 0.03) * g.U * 3 + (fbm(x * 0.06, 1, 3, 12) - 0.5) * g.U * 6;
    for (let y = g.H * 0.74; y < g.H + g.U * 4; y += g.U * 2.4) {
      for (let x = -g.U * 2; x < g.W * 0.75; x += g.U * (2.6 + rand() * 2)) {
        if (y < top(x)) continue;
        const r = g.U * (2.4 + rand() * 1.8);
        const pick = rand();
        crown(ctx, x, y, r, pick < 0.12 ? GREEN : MAPLE[pick < 0.65 ? 0 : 1]);
      }
    }
  }

  function tint(c, g, sky) {
    const shade = mixColor(rgb('#ffffff'), sky.amb, 0.55);
    const night = mixColor(shade, rgb('#3a4060'), sky.night * 0.3);
    const m = layer(g.W, g.H);
    const mx = m.getContext('2d');
    mx.fillStyle = hex(night);
    mx.fillRect(0, 0, g.W, g.H);
    mx.globalCompositeOperation = 'destination-in';
    mx.drawImage(c, 0, 0);
    const ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(m, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Lanterns along the stage and hall eaves, lit after dusk.
  function paintLamps(ctx, g, sky) {
    if (sky.night < 0.05) return;
    const u = g.U;
    ctx.globalAlpha = sky.night;
    ctx.fillStyle = '#e8c070';
    for (let x = g.W * STAGE[0] + u * 3; x < g.W * HALL[1]; x += u * 6) {
      ctx.fillRect(x, g.H * DECK - u * 3.6, Math.max(1, u * 0.9), Math.max(1, u * 1.2));
    }
    for (let i = 1; i < 9; i += 2) {
      const x = lerp(g.W * HALL[0], g.W * HALL[1], i / 9);
      ctx.fillRect(x, g.H * 0.44, (g.W * 0.3) / 9 - u * 1.6, g.H * 0.03);
    }
    ctx.globalAlpha = 1;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHill(ctx, g, rand);
    paintPillars(ctx, g);
    paintHallBody(ctx, g);
    paintRoof(ctx, g);
    paintStage(ctx, g);
    paintCanopy(ctx, g, rand);
    tint(c, g, sky);
    paintLamps(ctx, g, sky);
    return c;
  }

  // ---- moving strips -------------------------------------------------------

  function paintStrip(w, h, seed, alpha, ink) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.02, y * 0.12, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = ink[0];
        img.data[i + 1] = ink[1];
        img.data[i + 2] = ink[2];
        img.data[i + 3] = Math.round(smoothstep(0.45, 0.7, v) * band * 2) / 2 * alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawStrip(ctx, c, t, rate, y, alpha) {
    if (alpha <= 0) return;
    const off = -((t * rate) % c.width);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // ---- leaves --------------------------------------------------------------

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), vy: f(), a: f(), spin: f(), size: f(), p: f(), tone: new Uint8Array(MAX_LEAVES) };
  }

  function resetLeaf(g, L, i, anywhere) {
    const r = state.rand;
    L.x[i] = r() * g.W * 1.1;
    L.y[i] = anywhere ? r() * g.H : -g.U * 2;
    L.vy[i] = g.U * (2.5 + r() * 3);
    L.a[i] = r() * TAU;
    L.spin[i] = (r() - 0.5) * 3;
    L.size[i] = Math.max(1.5, g.U * (0.8 + r() * 0.8));
    L.p[i] = r() * TAU;
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
  }

  function stepLeaf(g, L, i, t, dt) {
    L.y[i] += L.vy[i] * dt;
    L.x[i] += (Math.sin(t * 0.8 + L.p[i]) * 2.5 - 1.6) * g.U * dt;
    L.a[i] += L.spin[i] * dt;
    if (L.y[i] > g.H + g.U * 2 || L.x[i] < -g.U * 3) resetLeaf(g, L, i, false);
  }

  function drawLeaves(ctx, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.6 + L.p[i]));
      const sz = L.size[i];
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    state.back = paintBack(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.mistAlpha = 0.7 - sky.night * 0.35;
    state.cloudAlpha = 0.7 - sky.night * 0.45;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const g = { W, H, U: Math.min(H / 100, W / 150) };
    state.g = g;
    state.rand = K.rng(api.seed || 5);
    state.mist = paintStrip(Math.ceil(W * 1.3), Math.ceil(H * 0.16), 23, 200, [232, 228, 216]);
    state.clouds = paintStrip(Math.ceil(W * 1.4), Math.ceil(H * 0.22), 41, 190, [244, 242, 236]);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { leaves, mist } = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== api.props.time) repaint(g, api.props.time);
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawStrip(ctx, state.clouds, t, g.U * 1.5, g.H * 0.03, state.cloudAlpha);
    drawStrip(ctx, state.mist, t, g.U * 2.4, g.H * 0.58, state.mistAlpha * mist * 0.8);
    ctx.drawImage(state.front, 0, 0);
    drawStrip(ctx, state.mist, t + 40, g.U * 3.2, g.H * 0.76, state.mistAlpha * mist * 0.45);
    drawLeaves(ctx, t, count);
  }

  Kasuri.run({
    defaults: { time: 'auto', leaves: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
