/*
 * 卢沟 Lugou — an old many-arched stone bridge, a lion on every post, in dawn mist.
 *
 * Sky, hills, bridge and willow are baked into layers and repainted once a minute
 * from the clock. Between repaints only mist strips, the water rows, willow
 * strands and a few egrets move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.66;
  const DECK_END = 0.575;
  const DECK_MID = 0.5;
  const ARCHES = 9;
  const RETINT_SECONDS = 60;
  const BIRDS = 3;
  const RIPPLE_STEP = 2;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, wy: Math.round(H * WATER) };
  }

  function deckY(g, x) {
    const k = (2 * x) / g.W - 1;
    return g.H * lerp(DECK_MID, DECK_END, k * k);
  }

  // ---- sky and hills -----------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, sky.haze, 0.3)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintHills(ctx, g, sky);
    return c;
  }

  function ridge(g, x, seed, base, amp) {
    const bump = Math.exp(-(((x - g.W * (seed === 3 ? 0.78 : 0.2)) / (g.W * 0.2)) ** 2));
    return g.H * (base - amp * bump) + (fbm(x / (g.U * 18), seed, 4, seed * 7) - 0.5) * g.H * 0.12;
  }

  function paintHills(ctx, g, sky) {
    const far = mixColor(mixColor(sky.haze, sky.top, 0.35), rgb('#56708a'), 0.25);
    const near = mixColor(rgb('#4d6a68'), sky.haze, 0.55);
    const layers = [
      { seed: 3, base: 0.42, amp: 0.1, ink: far },
      { seed: 5, base: 0.5, amp: 0.06, ink: mixColor(far, near, 0.6) },
    ];
    for (const l of layers) {
      ctx.fillStyle = hex(l.ink);
      ctx.beginPath();
      ctx.moveTo(0, g.wy);
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridge(g, x, l.seed, l.base, l.amp));
      ctx.lineTo(g.W, g.wy);
      ctx.closePath();
      ctx.fill();
    }
    // far bank: a low dark strip of trees at the waterline
    ctx.fillStyle = hex(mixColor(rgb('#3f5648'), sky.haze, 0.5));
    for (let x = 0; x < g.W; x += g.U * 1.4) {
      const r = g.U * (1.1 + fbm(x / (g.U * 9), 7, 2, 3) * 1.8);
      ctx.beginPath();
      ctx.ellipse(x, g.wy - r * 0.3, r * 1.2, r, 0, 0, TAU);
      ctx.fill();
    }
  }

  // ---- bridge ------------------------------------------------------------

  function stoneInks(sky) {
    const day = mixColor(rgb('#b3aa96'), sky.amb, 0.3);
    const night = rgb('#2a2e44');
    const body = mixColor(day, night, sky.night * 0.78);
    return {
      body,
      light: mixColor(body, rgb('#f0eadb'), 0.28),
      dark: mixColor(body, rgb('#2a2630'), 0.4),
      seam: mixColor(body, rgb('#4a4036'), 0.35),
    };
  }

  function archSpan(g) {
    const left = g.W * 0.015;
    const right = g.W * 0.985;
    return { left, step: (right - left) / ARCHES };
  }

  function archHeight(g, i) {
    const mid = (ARCHES - 1) / 2;
    const k = 1 - Math.abs(i - mid) / mid;
    return lerp(g.H * 0.075, g.H * 0.13, k);
  }

  function paintBody(ctx, g, sky, stone) {
    const { left, step } = archSpan(g);
    ctx.fillStyle = hex(stone.body);
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, deckY(g, x));
    ctx.lineTo(g.W, g.wy);
    ctx.closePath();
    ctx.fill();
    // coping stone: pale edge along the deck
    ctx.strokeStyle = hex(stone.light);
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    ctx.beginPath();
    for (let x = 0; x <= g.W; x += 2) ctx[x === 0 ? 'moveTo' : 'lineTo'](x, deckY(g, x) + g.U * 0.4);
    ctx.stroke();
    // courses of masonry
    ctx.fillStyle = hex(stone.seam);
    ctx.globalAlpha = 0.5;
    for (let x = 0; x < g.W; x += 2) {
      const top = deckY(g, x) + g.U * 2;
      for (let y = top; y < g.wy; y += g.U * 2.2) ctx.fillRect(x, y, 2, 1);
    }
    ctx.globalAlpha = 1;
    // arch openings show the misty far bank
    const through = mixColor(sky.haze, sky.low, 0.5);
    for (let i = 0; i < ARCHES; i++) {
      const cx = left + step * (i + 0.5);
      const rx = step * 0.36;
      const ry = archHeight(g, i);
      const grad = ctx.createLinearGradient(0, g.wy - ry, 0, g.wy);
      grad.addColorStop(0, hex(mixColor(through, stone.dark, 0.45)));
      grad.addColorStop(1, hex(mixColor(through, stone.dark, 0.15)));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, g.wy, rx, ry, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = hex(stone.light);
      ctx.lineWidth = Math.max(1, g.U * 0.7);
      ctx.beginPath();
      ctx.ellipse(cx, g.wy, rx + g.U * 0.5, ry + g.U * 0.5, 0, Math.PI, TAU);
      ctx.stroke();
    }
    // wedge-shaped cutwaters on the piers
    ctx.fillStyle = hex(stone.dark);
    for (let i = 1; i < ARCHES; i++) {
      const px = left + step * i;
      ctx.beginPath();
      ctx.moveTo(px - g.U * 0.5, g.wy - g.U * 6);
      ctx.lineTo(px, g.wy + g.U * 0.6);
      ctx.lineTo(px + g.U * 0.5, g.wy - g.U * 6);
      ctx.fill();
    }
  }

  function paintLion(ctx, x, y, u, stone) {
    // post
    ctx.fillStyle = hex(stone.light);
    ctx.fillRect(x - u * 0.55, y - u * 3, u * 1.1, u * 3);
    // seated lion: body, chest, head, mane
    ctx.fillStyle = hex(stone.body);
    ctx.beginPath();
    ctx.ellipse(x, y - u * 3.7, u * 0.85, u * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hex(stone.light);
    ctx.beginPath();
    ctx.arc(x + u * 0.1, y - u * 4.8, u * 0.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hex(stone.dark);
    ctx.fillRect(x - u * 0.35, y - u * 5.1, u * 0.3, u * 0.25);
    ctx.fillRect(x + u * 0.25, y - u * 5.1, u * 0.3, u * 0.25);
    ctx.fillRect(x - u * 0.7, y - u * 5.6, u * 0.45, u * 0.5);
    ctx.fillRect(x + u * 0.4, y - u * 5.6, u * 0.45, u * 0.5);
  }

  function paintBalustrade(ctx, g, stone) {
    const u = Math.max(g.U * 0.9, 1.2);
    const gap = u * 5.6;
    ctx.fillStyle = hex(stone.body);
    ctx.strokeStyle = hex(stone.dark);
    ctx.lineWidth = 1;
    for (let x = 0; x < g.W; x += 2) {
      const y = deckY(g, x);
      ctx.fillStyle = hex(stone.light);
      ctx.fillRect(x, y - u * 1.9, 2, u * 0.45);
      ctx.fillStyle = hex(stone.dark);
      ctx.fillRect(x, y - u * 1.4, 2, u * 0.25);
      if (Math.floor(x / 2) % 2 === 0) ctx.fillRect(x, y - u * 1.1, 1, u * 1.1);
    }
    for (let x = gap * 0.5; x < g.W; x += gap) paintLion(ctx, x, deckY(g, x), u, stone);
  }

  function paintBridge(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const stone = stoneInks(sky);
    paintBody(ctx, g, sky, stone);
    paintBalustrade(ctx, g, stone);
    return c;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, bridge) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hex(mixColor(sky.haze, sky.low, 0.4)));
    grad.addColorStop(1, hex(mixColor(rgb('#2b3a47'), sky.top, 0.4)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, h);
    // the bridge upside down, softened
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(0, -g.wy + 0);
    ctx.translate(0, 2 * g.wy);
    ctx.scale(1, -1);
    ctx.drawImage(bridge, 0, 0, g.W, g.wy, 0, 0, g.W, g.wy);
    ctx.restore();
    ctx.globalAlpha = 1;
    // fade the reflection into the deeper water
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, hex(mixColor(rgb('#2b3a47'), sky.top, 0.4)));
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalCompositeOperation = 'source-over';
    // pale ripple lines
    const rand = K.rng(19);
    ctx.fillStyle = hex(mixColor(sky.amb, rgb('#ffffff'), 0.3));
    for (let i = 0; i < g.W * 0.9; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.2;
      ctx.fillRect(rand() * g.W, rand() * h, 2 + rand() * g.U * 3, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- willow and bank ---------------------------------------------------

  function paintWillow(g, sky) {
    const w = Math.ceil(g.W * 0.34);
    const c = layer(w, g.H * 0.62);
    const ctx = c.getContext('2d');
    const rand = K.rng(77);
    const leaf = mixColor(rgb('#5f7a4a'), rgb('#141a24'), sky.night * 0.7);
    const dark = mixColor(rgb('#34482f'), rgb('#101620'), sky.night * 0.7);
    // limb from top left, arcing down to the right
    ctx.strokeStyle = hex(mixColor(rgb('#3a2e24'), rgb('#101218'), sky.night * 0.7));
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    ctx.moveTo(-2, g.H * 0.04);
    ctx.quadraticCurveTo(w * 0.55, g.H * 0.0, w * 0.9, g.H * 0.1);
    ctx.stroke();
    const strands = Math.floor(w / 1.3);
    for (let i = 0; i < strands; i++) {
      const t = (i + rand()) / strands;
      const x = lerp(0, w * 0.92, t);
      const y = lerp(g.H * 0.04, g.H * 0.095, t * t) - Math.sin(t * Math.PI) * g.H * 0.02;
      const len = g.H * (0.08 + rand() * 0.3) * Math.pow(1 - t, 0.8) + g.U * 2;
      ctx.strokeStyle = hex(rand() < 0.4 ? dark : leaf);
      ctx.globalAlpha = 0.55 + rand() * 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rand() - 0.4) * g.U * 3, y + len * 0.5, x + (rand() - 0.2) * g.U * 2, y + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintBank(g, sky) {
    const c = layer(g.W, g.H - g.wy);
    const ctx = c.getContext('2d');
    // reed edge along the near foreground
    const reed = mixColor(rgb('#4c5f3c'), rgb('#10151d'), sky.night * 0.7);
    ctx.fillStyle = hex(reed);
    const rand = K.rng(55);
    const h = c.height;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= g.W * 0.22; x += 2) ctx.lineTo(x, h - g.U * (4 + (1 - x / (g.W * 0.22)) * 7) - rand() * g.U * 1.5);
    ctx.lineTo(g.W * 0.22, h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(g.W, h);
    for (let x = g.W; x >= g.W * 0.84; x -= 2) ctx.lineTo(x, h - g.U * (3 + ((x - g.W * 0.84) / (g.W * 0.16)) * 5) - rand() * g.U * 1.2);
    ctx.lineTo(g.W * 0.84, h);
    ctx.fill();
    return c;
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.09, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 238;
        img.data[i + 2] = 232;
        img.data[i + 3] = smoothstep(0.38, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.bridge = paintBridge(g, sky);
    state.water = paintWater(g, sky, state.bridge);
    state.willow = paintWillow(g, sky);
    state.bank = paintBank(g, sky);
    state.mistAlpha = 0.5 - sky.night * 0.28;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const strips = [
      { c: state.mistFar, y: g.H * 0.34, speed: 0.9, a: 0.55 },
      { c: state.mistMid, y: g.H * 0.52, speed: 1.6, a: 0.55 },
    ];
    for (const s of strips) {
      const off = -((t * g.U * s.speed) % s.c.width);
      ctx.globalAlpha = Math.min(1, state.mistAlpha * s.a * amount * 1.3);
      ctx.drawImage(s.c, off, s.y);
      ctx.drawImage(s.c, off + s.c.width, s.y);
    }
    ctx.globalAlpha = 1;
  }

  // Water rows slide sideways, each at its own pace.
  function drawWater(ctx, g, t) {
    const w = state.water;
    for (let y = 0; y < w.height; y += RIPPLE_STEP) {
      const k = y / w.height;
      const dx = Math.sin(t * 0.9 + y * 0.55) * g.U * (0.25 + k * 1.1);
      ctx.drawImage(w, 0, y, w.width, RIPPLE_STEP, dx, g.wy + y, w.width, RIPPLE_STEP);
    }
  }

  function drawWaterMist(ctx, g, t, amount) {
    const c = state.mistMid;
    const off = -((t * g.U * 1.1 + c.width * 0.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * 0.9 * amount);
    ctx.drawImage(c, off, g.wy - g.U * 1.5);
    ctx.drawImage(c, off + c.width, g.wy - g.U * 1.5);
    ctx.globalAlpha = 1;
  }

  function drawWillow(ctx, g, t) {
    const w = state.willow;
    for (let y = 0; y < w.height; y += RIPPLE_STEP) {
      const k = y / w.height;
      const dx = Math.sin(t * 0.8 + y * 0.09) * g.U * 1.4 * k;
      ctx.drawImage(w, 0, y, w.width, RIPPLE_STEP, dx - g.U * 2, y - g.U, w.width, RIPPLE_STEP);
    }
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = hex(mixColor(rgb('#f2eee2'), rgb('#9aa0b4'), state.night * 0.7));
    ctx.lineWidth = 1;
    for (let i = 0; i < BIRDS; i++) {
      const p = (t * 0.012 + i * 0.31) % 1;
      const x = g.W * (1.05 - p * 1.15);
      const y = g.H * (0.2 + i * 0.045) + Math.sin(t * 0.5 + i * 2) * g.U * 1.2;
      const flap = Math.sin(t * 3.2 + i * 1.7) * g.U * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.6, y + flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + g.U * 1.6, y + flap);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.mistFar = paintMist(Math.ceil(g.W * 1.3), Math.ceil(g.H * 0.22), 21);
    state.mistMid = paintMist(Math.ceil(g.W * 1.3), Math.ceil(g.H * 0.18), 33);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    if (props.birds) drawBirds(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    ctx.drawImage(state.bridge, 0, 0);
    drawWater(ctx, g, t);
    drawWaterMist(ctx, g, t, props.mist);
    ctx.drawImage(state.bank, 0, g.wy);
    drawWillow(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, birds: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
