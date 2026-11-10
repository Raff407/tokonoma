/*
 * 上海 Shanghai — a wide river at dusk with a far skyline.
 *
 * Sky, skyline, bank and water are baked from the clock and repainted once a
 * minute. Between repaints only clouds, the water shimmer and a lantern
 * sampan move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.56;
  const RETINT_SECONDS = 60;
  const state = {};

  const hex = (c) => toHex(c);
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
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.12 + rand() * 0.4);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.35, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.08, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 214;
        img.data[i + 2] = 206;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- skyline -----------------------------------------------------------

  // One entry per building: kind, left edge and width as fractions, height as a fraction of the view.
  function makeCity(rand) {
    const far = [];
    let fx = -0.02;
    while (fx < 1.02) {
      const w = 0.03 + rand() * 0.04;
      far.push({ kind: rand() < 0.3 ? 'step' : 'slab', x: fx, w, h: 0.1 + rand() * 0.16 });
      fx += w + rand() * 0.008;
    }
    const near = [];
    let nx = -0.01;
    while (nx < 1.01) {
      const r = rand();
      const kind = r < 0.2 ? 'tower' : 'old';
      const w = kind === 'tower' ? 0.04 + rand() * 0.025 : 0.065 + rand() * 0.05;
      const h = kind === 'tower' ? 0.2 + rand() * 0.17 : 0.1 + rand() * 0.06;
      near.push({ kind, x: nx, w, h, seed: Math.floor(rand() * 9999) });
      nx += w + rand() * 0.006;
    }
    // A tiered pagoda stands on the bank, right of centre.
    near.push({ kind: 'pagoda', x: 0.64, w: 0.07, h: 0.27, seed: 7 });
    return { far, near };
  }

  function bodyColor(sky, depth) {
    const base = mixColor(rgb('#2f3a5c'), rgb('#1f2438'), 0.35);
    const hazed = mixColor(base, sky.haze, 0.1 + depth * 0.45);
    return mixColor(hazed, rgb('#1b2140'), sky.night * 0.3).map((c) => c * (1 - 0.35 * (1 - sky.night) * (1 - depth)));
  }

  function windows(ctx, g, bx, by, bw, bh, lit, rand, step) {
    const s = Math.max(1, Math.round(step));
    for (let wy = by + s * 2; wy < by + bh - s; wy += s * 2) {
      for (let wx = bx + s; wx < bx + bw - s; wx += s * 2) {
        if (rand() > lit) continue;
        ctx.fillStyle = rand() < 0.8 ? '#e8c66a' : '#f0e2b0';
        ctx.globalAlpha = 0.55 + rand() * 0.4;
        ctx.fillRect(wx, wy, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  function paintFar(ctx, g, sky, city) {
    const base = g.H * HORIZON - g.U * 1.2;
    ctx.fillStyle = hex(bodyColor(sky, 1));
    for (const b of city.far) {
      const bx = b.x * g.W;
      const bw = b.w * g.W;
      const bh = b.h * g.H;
      ctx.fillRect(bx, base - bh, bw, bh + g.U);
      if (b.kind === 'step') {
        ctx.fillRect(bx + bw * 0.2, base - bh - g.U * 3, bw * 0.6, g.U * 3);
        ctx.fillRect(bx + bw * 0.4, base - bh - g.U * 6, bw * 0.2, g.U * 3);
      }
    }
  }

  // Eaves sweep up at the corners, as on a Jiangnan tile roof.
  function roof(ctx, cx, y, w, h, color) {
    const e = w * 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - e, y - h * 0.35);
    ctx.quadraticCurveTo(cx - w / 2 + e * 0.5, y + h * 0.05, cx - w * 0.3, y - h * 0.4);
    ctx.lineTo(cx - w * 0.18, y - h);
    ctx.lineTo(cx + w * 0.18, y - h);
    ctx.lineTo(cx + w * 0.3, y - h * 0.4);
    ctx.quadraticCurveTo(cx + w / 2 - e * 0.5, y + h * 0.05, cx + w / 2 + e, y - h * 0.35);
    ctx.lineTo(cx + w / 2, y + h * 0.1);
    ctx.lineTo(cx - w / 2, y + h * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  function paintOld(ctx, g, sky, b, base, lit) {
    const rand = K.rng(b.seed);
    const bx = b.x * g.W;
    const bw = b.w * g.W;
    const bh = b.h * g.H;
    const wall = mixColor(bodyColor(sky, 0.2), rgb('#b9a98c'), 0.18 * (1 - sky.night));
    ctx.fillStyle = hex(wall);
    ctx.fillRect(bx, base - bh, bw, bh + g.U);
    ctx.fillStyle = hex(mixColor(wall, rgb('#12162a'), 0.4));
    ctx.fillRect(bx, base - bh, bw, Math.max(1, g.U * 0.6));
    windows(ctx, g, bx, base - bh, bw, bh, lit, rand, Math.max(1, g.U * 0.9));
    roof(ctx, bx + bw / 2, base - bh, bw * 1.05, g.U * 5.5, hex(mixColor(bodyColor(sky, 0.1), rgb('#0e1224'), 0.3)));
  }

  function paintTower(ctx, g, sky, b, base, lit) {
    const rand = K.rng(b.seed);
    const bx = b.x * g.W;
    const bw = b.w * g.W;
    const bh = b.h * g.H;
    const col = bodyColor(sky, 0.25);
    ctx.fillStyle = hex(col);
    ctx.fillRect(bx, base - bh, bw, bh + g.U);
    ctx.fillRect(bx + bw * 0.15, base - bh - g.U * 3, bw * 0.7, g.U * 3);
    ctx.fillRect(bx + bw * 0.32, base - bh - g.U * 5.5, bw * 0.36, g.U * 2.6);
    ctx.fillRect(bx + bw / 2, base - bh - g.U * 10, Math.max(1, g.U * 0.35), g.U * 5);
    windows(ctx, g, bx, base - bh, bw, bh, lit * 0.8, rand, Math.max(1, g.U * 0.8));
    // A pale lit crown band.
    ctx.fillStyle = hex(mixColor(rgb('#d9a73a'), col, 0.5 - sky.night * 0.3));
    ctx.fillRect(bx + bw * 0.15, base - bh - g.U * 3, bw * 0.7, Math.max(1, g.U * 0.5));
  }

  function paintPagoda(ctx, g, sky, b, base, lit) {
    const cx = (b.x + b.w / 2) * g.W;
    const w = b.w * g.W;
    const total = b.h * g.H;
    const tiers = 5;
    const th = total / (tiers + 1.3);
    const wall = hex(mixColor(bodyColor(sky, 0.15), rgb('#b8442c'), 0.3 * (1 - sky.night * 0.5)));
    const tile = hex(mixColor(bodyColor(sky, 0.05), rgb('#12162a'), 0.4));
    for (let k = 0; k < tiers; k++) {
      const tw = w * (1 - k * 0.14);
      const y = base - k * th;
      ctx.fillStyle = wall;
      ctx.fillRect(cx - tw * 0.36, y - th * 0.62, tw * 0.72, th * 0.62);
      if (lit > 0.05) {
        ctx.fillStyle = '#e8c66a';
        ctx.globalAlpha = 0.5 + 0.4 * Math.min(1, lit);
        ctx.fillRect(cx - tw * 0.08, y - th * 0.5, Math.max(1, tw * 0.16), th * 0.3);
        ctx.globalAlpha = 1;
      }
      roof(ctx, cx, y - th * 0.62, tw * 1.18, th * 0.7, tile);
    }
    const top = base - tiers * th;
    ctx.fillStyle = tile;
    ctx.fillRect(cx - Math.max(0.5, g.U * 0.2), top - g.U * 4, Math.max(1, g.U * 0.4), g.U * 4);
    ctx.fillStyle = hex(mixColor(rgb('#d9a73a'), rgb('#12162a'), 0.3));
    ctx.beginPath();
    ctx.arc(cx, top - g.U * 4.3, g.U * 0.7, 0, 6.3);
    ctx.fill();
  }

  function paintNear(ctx, g, sky, city, lit) {
    const base = g.H * HORIZON;
    for (const b of city.near) {
      if (b.kind === 'old') paintOld(ctx, g, sky, b, base, lit);
      else if (b.kind === 'tower') paintTower(ctx, g, sky, b, base, lit);
    }
    for (const b of city.near) if (b.kind === 'pagoda') paintPagoda(ctx, g, sky, b, base, lit);
  }

  function paintBank(ctx, g, sky, lit) {
    const top = g.H * HORIZON;
    const stone = mixColor(rgb('#4a4a50'), rgb('#12162a'), 0.3 + sky.night * 0.5);
    ctx.fillStyle = hex(stone);
    ctx.fillRect(0, top, g.W, Math.max(2, g.U * 1.6));
    // Lamps along the embankment.
    for (let f = 0.03; f < 1; f += 0.06) {
      ctx.fillStyle = '#e8c66a';
      ctx.globalAlpha = 0.3 + 0.6 * Math.min(1, lit);
      ctx.fillRect(f * g.W, top - g.U * 0.5, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, skylineLayer) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = Math.floor(g.H * HORIZON);
    const h = g.H - top;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, rgb('#1f2438'), 0.35)));
    grad.addColorStop(1, hex(mixColor(sky.top, rgb('#12162a'), 0.55)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, h);
    // Skyline mirrored, softly.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, g.W, h);
    ctx.clip();
    ctx.globalAlpha = 0.7;
    ctx.translate(0, top * 2);
    ctx.scale(1, -1);
    ctx.drawImage(skylineLayer, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    // Long pale ripples.
    const rand = K.rng(55);
    ctx.fillStyle = hex(mixColor(sky.low, rgb('#f2ecd8'), 0.5));
    for (let i = 0; i < g.W * 0.35; i++) {
      const y = top + Math.pow(rand(), 1.5) * h;
      ctx.globalAlpha = 0.08 + rand() * 0.14;
      ctx.fillRect(rand() * g.W, y, g.U * (1 + rand() * 4), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- near bank: willow and lanterns -------------------------------------

  function paintNearBank(g, sky, lit) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(91);
    const dark = hex(mixColor(rgb('#1f2438'), rgb('#0a0c18'), sky.night * 0.7));
    const moss = hex(mixColor(rgb('#4a5e45'), rgb('#12162a'), 0.4 + sky.night * 0.4));
    // Willow strands hanging from the upper left.
    ctx.lineWidth = 1;
    ctx.strokeStyle = moss;
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, g.W * 0.015, g.H * 0.2);
    for (let i = 0; i < 26; i++) {
      const x = rand() * g.W * 0.2;
      const len = g.H * (0.1 + rand() * 0.22) * (1 - x / (g.W * 0.35));
      ctx.globalAlpha = 0.5 + rand() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, g.H * 0.02 + rand() * g.U * 3);
      ctx.quadraticCurveTo(x + g.U * 2, len * 0.5, x + g.U * (1 + rand() * 2), len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // A stone rail along the bottom with two red lanterns on the right.
    ctx.fillStyle = dark;
    ctx.fillRect(0, g.H * 0.94, g.W, g.H * 0.06);
    ctx.fillStyle = hex(mixColor(rgb('#4a4a50'), rgb('#12162a'), 0.4 + sky.night * 0.4));
    ctx.fillRect(0, g.H * 0.94, g.W, Math.max(1, g.U * 0.6));
    for (const fx of [0.86, 0.93]) {
      const lx = fx * g.W;
      const ly = g.H * 0.82;
      ctx.fillStyle = dark;
      ctx.fillRect(lx, g.H * 0.74, Math.max(1, g.U * 0.35), g.H * 0.2);
      ctx.fillStyle = '#b8442c';
      ctx.beginPath();
      ctx.ellipse(lx, ly, g.U * 1.6, g.U * 2.1, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#e8c66a';
      ctx.globalAlpha = 0.25 + 0.5 * Math.min(1, lit);
      ctx.fillRect(lx - g.U * 0.5, ly - g.U * 0.8, g.U, g.U * 1.6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#d9a73a';
      ctx.fillRect(lx - g.U * 0.8, ly - g.U * 2.3, g.U * 1.6, Math.max(1, g.U * 0.4));
    }
    return c;
  }

  // ---- sampan --------------------------------------------------------------

  function paintBoat(g, sky, lit) {
    const w = Math.round(g.U * 16);
    const h = Math.round(g.U * 7);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const dark = hex(mixColor(rgb('#1f2438'), rgb('#0a0c18'), sky.night * 0.6));
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.lineTo(w, h * 0.62);
    ctx.lineTo(w * 0.9, h);
    ctx.lineTo(w * 0.1, h);
    ctx.closePath();
    ctx.fill();
    // Woven awning, arched.
    ctx.fillStyle = hex(mixColor(rgb('#6a5a3a'), rgb('#12162a'), 0.4 + sky.night * 0.3));
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.3, h * 0.5, 0, Math.PI, 0);
    ctx.fill();
    // Lantern at the bow.
    ctx.fillStyle = '#b8442c';
    ctx.fillRect(w * 0.88, h * 0.2, Math.max(2, g.U * 1.2), Math.max(2, g.U * 1.5));
    ctx.fillStyle = '#e8c66a';
    ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, lit);
    ctx.fillRect(w * 0.88 + 1, h * 0.2 + 1, Math.max(1, g.U * 0.6), Math.max(1, g.U * 0.7));
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- bake ----------------------------------------------------------------

  function repaint(g, choice, glow) {
    const sky = S.at(S.hour(choice));
    const lit = Math.min(1.4, (0.3 + 0.7 * sky.night) * glow);
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    const sk = layer(g.W, g.H);
    const sctx = sk.getContext('2d');
    paintFar(sctx, g, sky, state.city);
    paintNear(sctx, g, sky, state.city, lit);
    paintBank(sctx, g, sky, lit);
    state.skyline = sk;
    state.water = paintWater(g, sky, sk);
    state.near = paintNearBank(g, sky, lit);
    state.boat = paintBoat(g, sky, lit);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.choice = choice;
    state.glow = glow;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion --------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // Water drawn in thin strips that slide a little, so reflections shimmer.
  function drawWater(ctx, g, t) {
    const top = Math.floor(g.H * HORIZON);
    const step = 2;
    for (let yy = top; yy < g.H; yy += step) {
      const k = (yy - top) / (g.H - top);
      const dx = Math.sin(t * 1.3 + yy * 0.9) * g.U * (0.15 + k * 0.5);
      ctx.drawImage(state.water, 0, yy, g.W, step, dx, yy, g.W, step);
    }
  }

  function drawBoat(ctx, g, t, speed) {
    const b = state.boat;
    const span = g.W + b.width * 2;
    const x = ((t * g.U * 1.1) % span) - b.width;
    const y = g.H * 0.74 + Math.sin(t * 1.1) * g.U * 0.3;
    ctx.drawImage(b, x, y);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#e8c66a';
    ctx.fillRect(x + b.width * 0.88, y + b.height, Math.max(1, g.U * 0.8), g.U * 3);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.city = makeCity(K.rng(17));
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    repaint(g, api.props.time, api.props.glow);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.glow !== props.glow) repaint(g, props.time, props.glow);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.skyline, 0, 0);
    drawWater(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t, props.speed);
    ctx.drawImage(state.near, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'dusk', boat: true, glow: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
