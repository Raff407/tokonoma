/*
 * 交差点 Kosaten — a scramble crossing seen from high above on a rainy evening.
 *
 * Road, stripes, pavements, roofs and the lamp pools are baked once. Each cycle the
 * lights let the crowd go: umbrellas leave every corner at once, cross straight and
 * on the diagonals, and gather on the far side. Then the cars take their turn while
 * the crowd waits. Rain is a short pool of streaks and rings.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, clamp } = K;

  const TAU = Math.PI * 2;
  const CYCLE = 36;
  const WALK = 17;
  const ROAD_H = 0.2;
  const ROAD_V = 0.25;
  const MAX_FOLK = 150;
  const FOLK = 90;
  const MAX_DROPS = 90;
  const DROPS = 45;
  const MAX_RINGS = 28;
  const RINGS = 14;
  const CARS = 12;
  const ASPHALT = '#2c3242';
  const PUDDLE = '#334058';
  const STRIPE = '#cfc8b4';
  const PAVE = '#5a5d66';
  const CURB = '#8a8a88';
  const ROOFS = ['#3a3a42', '#45423e', '#33363f', '#4b4740', '#3d4048'];
  const ROOF_BITS = '#6a6862';
  const LAMP = 'rgba(217,167,58,';
  const TREE = ['#3c5638', '#4f6b48'];
  const CANOPY = ['#b8412c', '#2f4c8a', '#e8e2d0', '#d9a73a', '#4f6b48', '#1f2129', '#a9b0b4', '#c8453a', '#e8e2d0', '#1f2129'];
  const CAR_INKS = ['#e8e2d0', '#1f2129', '#2f4c8a', '#b88a3a', '#8a8d92', '#8a3a2c'];
  const state = {};

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
    const rh = H * ROAD_H;
    const rv = Math.min(W * 0.2, H * ROAD_V);
    const gap = U * 1.6;
    const cw = U * 8;
    return { W, H, U, cx: W / 2, cy: H / 2, rh, rv, gap, cw };
  }

  // ---- still layer ---------------------------------------------------------

  function paintAsphalt(ctx, g) {
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const base = K.parseColor(ASPHALT);
    const wet = K.parseColor(PUDDLE);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x * 0.05, y * 0.07, 3, 9);
        const k = clamp((n - 0.56) * 5, 0, 1);
        const i = (y * g.W + x) * 4;
        d[i] = lerp(base[0], wet[0], k);
        d[i + 1] = lerp(base[1], wet[1], k);
        d[i + 2] = lerp(base[2], wet[2], k);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintBlocks(ctx, g, rand) {
    const { W, H, U, cx, cy, rh, rv } = g;
    const blocks = [
      [0, 0, cx - rv, cy - rh],
      [cx + rv, 0, W, cy - rh],
      [0, cy + rh, cx - rv, H],
      [cx + rv, cy + rh, W, H],
    ];
    const walk = U * 7;
    for (const [x0, y0, x1, y1] of blocks) {
      ctx.fillStyle = CURB;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = PAVE;
      ctx.fillRect(x0 + U * 0.5, y0 + U * 0.5, x1 - x0 - U, y1 - y0 - U);
      const bx0 = x0 === 0 ? 0 : x0 + walk;
      const by0 = y0 === 0 ? 0 : y0 + walk;
      const bx1 = x1 === W ? W : x1 - walk;
      const by1 = y1 === H ? H : y1 - walk;
      paintRoofs(ctx, g, rand, bx0, by0, bx1, by1);
    }
  }

  function paintRoofs(ctx, g, rand, x0, y0, x1, y1) {
    const U = g.U;
    let x = x0;
    while (x < x1 - U * 4) {
      const w = Math.min(x1 - x, U * (12 + rand() * 18));
      let y = y0;
      while (y < y1 - U * 4) {
        const h = Math.min(y1 - y, U * (12 + rand() * 16));
        ctx.fillStyle = '#24252c';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = ROOFS[Math.floor(rand() * ROOFS.length)];
        ctx.fillRect(x + U * 0.6, y + U * 0.6, w - U * 1.2, h - U * 1.2);
        paintRoofBits(ctx, g, rand, x, y, w, h);
        y += h;
      }
      x += w;
    }
  }

  function paintRoofBits(ctx, g, rand, x, y, w, h) {
    const U = g.U;
    ctx.fillStyle = ROOF_BITS;
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const s = U * (1.6 + rand() * 2.4);
      ctx.fillRect(x + U * 2 + rand() * Math.max(0, w - s - U * 4), y + U * 2 + rand() * Math.max(0, h - s - U * 4), s, s * 0.8);
    }
    if (rand() < 0.3) {
      ctx.fillStyle = '#7a7466';
      ctx.beginPath();
      ctx.arc(x + w * 0.7, y + h * 0.35, U * 2, 0, TAU);
      ctx.fill();
    }
  }

  // Zebra bars along a band from (ax, ay) to (bx, by), band width cw.
  function paintBand(ctx, g, ax, ay, bx, by, rand) {
    const len = Math.hypot(bx - ax, by - ay);
    const ang = Math.atan2(by - ay, bx - ax);
    const bar = g.U * 1.7;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    for (let s = bar * 0.5; s < len - bar * 0.5; s += bar * 2) {
      ctx.globalAlpha = 0.78 + rand() * 0.2;
      ctx.fillStyle = STRIPE;
      ctx.fillRect(s, -g.cw / 2, bar, g.cw);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function paintMarkings(ctx, g, rand) {
    const { W, H, U, cx, cy, rh, rv, gap, cw } = g;
    const off = gap + cw / 2;
    paintBand(ctx, g, cx - rv, cy - rh - off, cx + rv, cy - rh - off, rand);
    paintBand(ctx, g, cx - rv, cy + rh + off, cx + rv, cy + rh + off, rand);
    paintBand(ctx, g, cx - rv - off, cy - rh, cx - rv - off, cy + rh, rand);
    paintBand(ctx, g, cx + rv + off, cy - rh, cx + rv + off, cy + rh, rand);
    paintBand(ctx, g, cx - rv + U * 3, cy - rh + U * 3, cx + rv - U * 3, cy + rh - U * 3, rand);
    paintBand(ctx, g, cx + rv - U * 3, cy - rh + U * 3, cx - rv + U * 3, cy + rh - U * 3, rand);
    ctx.fillStyle = 'rgba(207,200,180,0.55)';
    const stop = gap + cw + U * 1.5;
    ctx.fillRect(cx - rv - stop - U * 0.6, cy - rh, U * 0.6, rh);
    ctx.fillRect(cx + rv + stop, cy, U * 0.6, rh);
    ctx.fillRect(cx, cy - rh - stop - U * 0.6, rv, U * 0.6);
    ctx.fillRect(cx - rv, cy + rh + stop, rv, U * 0.6);
    for (let x = 0; x < cx - rv - stop; x += U * 8) ctx.fillRect(x, cy - U * 0.3, U * 4, U * 0.6);
    for (let x = cx + rv + stop + U * 2; x < W; x += U * 8) ctx.fillRect(x, cy - U * 0.3, U * 4, U * 0.6);
    for (let y = 0; y < cy - rh - stop; y += U * 8) ctx.fillRect(cx - U * 0.3, y, U * 0.6, U * 4);
    for (let y = cy + rh + stop + U * 2; y < H; y += U * 8) ctx.fillRect(cx - U * 0.3, y, U * 0.6, U * 4);
  }

  function paintTrees(ctx, g, rand) {
    const { U, cx, cy, rh, rv } = g;
    const spots = [];
    for (let i = 0; i < 4; i++) {
      spots.push([cx - rv - U * (18 + i * 14), cy - rh - U * 3.5]);
      spots.push([cx + rv + U * (18 + i * 14), cy + rh + U * 3.5]);
      spots.push([cx + rv + U * (18 + i * 14), cy - rh - U * 3.5]);
      spots.push([cx - rv - U * (18 + i * 14), cy + rh + U * 3.5]);
    }
    for (const [x, y] of spots) {
      ctx.fillStyle = TREE[0];
      ctx.beginPath();
      ctx.arc(x, y, U * 2.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = TREE[1];
      ctx.beginPath();
      ctx.arc(x - U * 0.6, y - U * 0.6, U * 1.5 + rand() * U * 0.4, 0, TAU);
      ctx.fill();
    }
  }

  function paintLamps(ctx, g) {
    const { U, cx, cy, rh, rv } = g;
    const pools = [
      [cx - rv - U * 3, cy - rh - U * 3], [cx + rv + U * 3, cy - rh - U * 3],
      [cx - rv - U * 3, cy + rh + U * 3], [cx + rv + U * 3, cy + rh + U * 3],
    ];
    for (const [x, y] of pools) {
      const r = U * 16;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, LAMP + '0.26)');
      grad.addColorStop(1, LAMP + '0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function paintStill(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintAsphalt(ctx, g);
    paintMarkings(ctx, g, rand);
    paintBlocks(ctx, g, rand);
    paintTrees(ctx, g, rand);
    paintLamps(ctx, g);
    return c;
  }

  // ---- sprites -------------------------------------------------------------

  function paintCanopy(ink, r) {
    const s = Math.ceil(r * 2 + 2);
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    const m = s / 2;
    const rgb = K.parseColor(ink);
    ctx.fillStyle = K.toHex(K.mixColor(rgb, [10, 10, 16], 0.35));
    ctx.beginPath();
    ctx.arc(m, m, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ink;
    for (let i = 0; i < 8; i += 2) {
      ctx.beginPath();
      ctx.moveTo(m, m);
      ctx.arc(m, m, r * 0.96, (i / 8) * TAU, ((i + 1) / 8) * TAU);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = K.toHex(K.mixColor(rgb, [240, 236, 224], 0.3));
    ctx.beginPath();
    ctx.arc(m - r * 0.3, m - r * 0.3, r * 0.35, 0, TAU);
    ctx.fill();
    return c;
  }

  function paintCar(ink, len, wid, upright) {
    const c = upright ? layer(wid, len) : layer(len, wid);
    const ctx = c.getContext('2d');
    if (upright) {
      ctx.translate(wid, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.fillStyle = '#16171d';
    ctx.fillRect(0, 0, len, wid);
    ctx.fillStyle = ink;
    ctx.fillRect(len * 0.04, wid * 0.08, len * 0.92, wid * 0.84);
    ctx.fillStyle = K.toHex(K.mixColor(K.parseColor(ink), [20, 22, 30], 0.4));
    ctx.fillRect(len * 0.32, wid * 0.16, len * 0.4, wid * 0.68);
    ctx.fillStyle = '#d9b66a';
    ctx.fillRect(len * 0.93, wid * 0.1, len * 0.07, wid * 0.22);
    ctx.fillRect(len * 0.93, wid * 0.68, len * 0.07, wid * 0.22);
    return c;
  }

  // ---- crowd ---------------------------------------------------------------

  function routes(g) {
    const { U, cx, cy, rh, rv, gap, cw } = g;
    const off = gap + cw / 2;
    const q = U * 3;
    const d = U * 2;
    return [
      [cx - rv - q, cy - rh - off, cx + rv + q, cy - rh - off],
      [cx - rv - q, cy + rh + off, cx + rv + q, cy + rh + off],
      [cx - rv - off, cy - rh - q, cx - rv - off, cy + rh + q],
      [cx + rv + off, cy - rh - q, cx + rv + off, cy + rh + q],
      [cx - rv - d, cy - rh - d, cx + rv + d, cy + rh + d],
      [cx + rv + d, cy - rh - d, cx - rv - d, cy + rh + d],
    ];
  }

  function makeFolk(g, rand) {
    const n = MAX_FOLK;
    const F = {
      ax: new Float32Array(n), ay: new Float32Array(n), bx: new Float32Array(n), by: new Float32Array(n),
      delay: new Float32Array(n), dur: new Float32Array(n), phase: new Float32Array(n),
      ink: new Uint8Array(n), x: new Float32Array(n), y: new Float32Array(n),
    };
    const R = routes(g);
    for (let i = 0; i < n; i++) {
      const r = R[i % R.length];
      const [ax, ay, bx, by] = rand() < 0.5 ? r : [r[2], r[3], r[0], r[1]];
      const len = Math.hypot(bx - ax, by - ay);
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      const side = (rand() - 0.5) * g.cw * 1.4;
      const back = rand() * rand() * g.U * 14;
      const ahead = rand() * rand() * g.U * 14;
      F.ax[i] = ax - ux * back - uy * side;
      F.ay[i] = ay - uy * back + ux * side;
      F.bx[i] = bx + ux * ahead - uy * side;
      F.by[i] = by + uy * ahead + ux * side;
      F.delay[i] = rand() * 2.5 + (back / g.U) * 0.15;
      F.dur[i] = Math.min(WALK - F.delay[i] - 0.5, 9 + rand() * 5);
      F.phase[i] = rand() * TAU;
      F.ink[i] = Math.floor(rand() * CANOPY.length);
    }
    return F;
  }

  function placeFolk(F, i, t) {
    const lap = Math.floor(t / CYCLE);
    const p = t - lap * CYCLE;
    const k = clamp((p - F.delay[i]) / F.dur[i], 0, 1);
    const e = k * k * (3 - 2 * k) * 0.3 + k * 0.7;
    const f = lap % 2 === 0 ? e : 1 - e;
    const sway = Math.sin(t * 0.7 + F.phase[i]) * 0.35;
    F.x[i] = lerp(F.ax[i], F.bx[i], f) + sway;
    F.y[i] = lerp(F.ay[i], F.by[i], f) + Math.cos(t * 0.6 + F.phase[i]) * 0.3;
  }

  function drawFolk(ctx, g, t, count) {
    const F = state.folk;
    const sprites = state.canopies;
    const half = sprites[0].width / 2;
    for (let i = 0; i < count; i++) {
      placeFolk(F, i, t);
      ctx.drawImage(sprites[F.ink[i]], F.x[i] - half, F.y[i] - half);
    }
  }

  // ---- cars ----------------------------------------------------------------

  function makeCars(g, rand) {
    const list = [];
    for (let i = 0; i < CARS; i++) {
      const across = i < CARS / 2;
      const forward = i % 2 === 0;
      list.push({ across, forward, delay: Math.floor(i / 2) % 3 * 1.6 + rand() * 0.8, ink: Math.floor(rand() * CAR_INKS.length) });
    }
    return list;
  }

  function drawCars(ctx, g, t) {
    const p = t % CYCLE;
    const len = state.carLen;
    for (const car of state.cars) {
      const start = car.across ? WALK + 0.5 : WALK + 9;
      const k = (p - start - car.delay) / 5.5;
      if (k <= 0 || k >= 1) continue;
      const dir = car.forward ? k : 1 - k;
      const art = car.across ? state.carArt[car.ink][car.forward ? 0 : 1] : state.carArt[car.ink][car.forward ? 2 : 3];
      if (car.across) {
        const x = lerp(-len, g.W + len, dir) - len / 2;
        const lane = car.forward ? g.cy - g.rh * 0.5 : g.cy + g.rh * 0.5;
        ctx.drawImage(art, x, lane - art.height / 2);
      } else {
        const y = lerp(-len, g.H + len, dir) - len / 2;
        const lane = car.forward ? g.cx + g.rv * 0.5 : g.cx - g.rv * 0.5;
        ctx.drawImage(art, lane - art.width / 2, y);
      }
    }
  }

  function bakeCars(g) {
    const len = g.U * 9;
    const wid = g.U * 4.4;
    state.carLen = len;
    state.carArt = CAR_INKS.map((ink) => {
      const right = paintCar(ink, len, wid, false);
      const down = paintCar(ink, len, wid, true);
      return [right, flip(right, true), down, flip(down, false)];
    });
  }

  function flip(src, sideways) {
    const c = layer(src.width, src.height);
    const ctx = c.getContext('2d');
    if (sideways) ctx.setTransform(-1, 0, 0, 1, src.width, 0);
    else ctx.setTransform(1, 0, 0, -1, 0, src.height);
    ctx.drawImage(src, 0, 0);
    return c;
  }

  // ---- rain ----------------------------------------------------------------

  function makeRain(rand) {
    return {
      x: Float32Array.from({ length: MAX_DROPS }, rand),
      y: Float32Array.from({ length: MAX_DROPS }, rand),
      rx: Float32Array.from({ length: MAX_RINGS }, rand),
      ry: Float32Array.from({ length: MAX_RINGS }, rand),
      rp: Float32Array.from({ length: MAX_RINGS }, rand),
    };
  }

  function drawRain(ctx, g, t, amount) {
    const R = state.rain;
    const drops = Math.min(MAX_DROPS, Math.round(DROPS * amount));
    const rings = Math.min(MAX_RINGS, Math.round(RINGS * amount));
    ctx.fillStyle = '#c4c8cc';
    ctx.globalAlpha = 0.4;
    const fall = g.U * 1.2;
    for (let i = 0; i < drops; i++) {
      const y = ((R.y[i] + t * 0.9) % 1) * (g.H + fall * 4) - fall * 2;
      const x = ((R.x[i] + t * 0.12) % 1) * g.W;
      ctx.fillRect(x, y, 1, fall * 2.4);
    }
    ctx.strokeStyle = '#aab4c4';
    ctx.lineWidth = 1;
    for (let i = 0; i < rings; i++) {
      const a = (R.rp[i] + t * 0.7) % 1;
      const lap = Math.floor(R.rp[i] + t * 0.7);
      const jx = ((R.rx[i] + lap * 0.618) % 1) * g.W;
      const jy = ((R.ry[i] + lap * 0.382) % 1) * g.H;
      ctx.globalAlpha = (1 - a) * 0.55;
      ctx.beginPath();
      ctx.arc(jx, jy, 0.5 + a * g.U * 2.2, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed || 17);
    state.g = g;
    state.still = paintStill(g, rand);
    state.canopies = CANOPY.map((ink) => paintCanopy(ink, g.U * 2.4));
    state.folk = makeFolk(g, rand);
    state.cars = makeCars(g, rand);
    bakeCars(g);
    state.rain = makeRain(rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { crowd, rain, cars } = api.props;
    const count = Math.min(MAX_FOLK, Math.round(FOLK * crowd));
    ctx.drawImage(state.still, 0, 0);
    if (cars) drawCars(ctx, g, t);
    drawFolk(ctx, g, t, count);
    drawRain(ctx, g, t, rain);
  }

  Kasuri.run({
    defaults: { crowd: 1, rain: 1, cars: true, ramp: 'lines', cell: 7, boost: 0.18, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
