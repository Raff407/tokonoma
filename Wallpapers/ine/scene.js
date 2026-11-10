/*
 * 伊根 Ine — a curving bay of gable-fronted boathouses over still water.
 *
 * Sky, headlands, funaya and their mirrored reflections are baked into layers
 * and repainted once a minute from the clock, so windows glow at night.
 * Between repaints only clouds, the swaying water, a few boats and a gull move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.44;
  const RETINT_SECONDS = 60;
  const SLICE = 2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const NIGHT_INK = rgb('#12141f');
  const dim = (c, sky, k) => mixColor(c, NIGHT_INK, sky.night * k);

  // Waterline of the bay as a fraction of height: near on the left, curving
  // away to the open mouth in the middle, coming back a little on the right.
  function shore(fx) {
    if (fx < 0.47) {
      const near = lerp(0.72, 0.62, smoothstep(0, 0.4, fx));
      return lerp(near, HORIZON, smoothstep(0.38, 0.47, fx));
    }
    if (fx > 0.55) {
      const near = lerp(0.575, 0.64, smoothstep(0.62, 1, fx));
      return lerp(HORIZON, near, smoothstep(0.55, 0.63, fx));
    }
    return HORIZON;
  }

  // Top of the near headlands; Infinity where there is no near land.
  function hillTop(fx) {
    const n = (fbm(fx * 9, 2, 3, 21) - 0.5) * 0.06;
    if (fx < 0.47) return lerp(0.19, HORIZON, smoothstep(0.12, 0.47, fx)) + n * (1 - fx * 2);
    if (fx > 0.55) return lerp(HORIZON, 0.23, smoothstep(0.55, 0.86, fx)) + n * (fx - 0.5) * 2;
    return Infinity;
  }

  // ---- sky and far land --------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.52, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Far ridge across the whole width with a straight foot on the horizon,
  // and the little island at the mouth of the bay.
  function paintFar(ctx, g, sky) {
    const far = dim(mixColor(rgb('#5f7790'), sky.haze, 0.5), sky, 0.7);
    const base = g.H * HORIZON;
    ctx.fillStyle = hex(far);
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= g.W; x += 2) {
      const fx = x / g.W;
      ctx.lineTo(x, g.H * (0.33 + 0.04 * Math.cos(fx * 5.5)) - (fbm(x * 0.006, 7, 3, 7) - 0.4) * g.H * 0.1);
    }
    ctx.lineTo(g.W, base);
    ctx.closePath();
    ctx.fill();
    const isle = dim(mixColor(rgb('#3e5560'), sky.haze, 0.35), sky, 0.75);
    ctx.fillStyle = hex(isle);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.475, base);
    ctx.quadraticCurveTo(g.W * 0.5, base - g.U * 4.5, g.W * 0.535, base);
    ctx.closePath();
    ctx.fill();
  }

  // Near headlands: moss slopes down to the waterline, with rows of pines.
  function paintHeadlands(ctx, g, sky, rand) {
    const moss = dim(mixColor(rgb('#3f5c42'), sky.amb, 0.12), sky, 0.78);
    const deep = dim(mixColor(rgb('#26392d'), sky.haze, 0.08), sky, 0.8);
    for (const [from, to] of [[0, 0.47], [0.55, 1]]) {
      const grad = ctx.createLinearGradient(0, g.H * 0.18, 0, g.H * 0.72);
      grad.addColorStop(0, hex(moss));
      grad.addColorStop(1, hex(mixColor(moss, deep, 0.6)));
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let x = from * g.W; x <= to * g.W + 1; x += 2) ctx.lineTo(x, g.H * hillTop(x / g.W));
      for (let x = to * g.W; x >= from * g.W - 1; x -= 2) ctx.lineTo(x, g.H * shore(x / g.W) + 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = hex(deep);
    for (let i = 0; i < 140; i++) {
      const fx = rand();
      const top = hillTop(fx);
      if (!isFinite(top)) continue;
      const fy = top + 0.02 + rand() * (shore(fx) - top - 0.06);
      if (fy < top + 0.02) continue;
      const s = g.U * (1 + rand() * 1.3) * (fx < 0.5 ? 1 : 0.8);
      const px = fx * g.W;
      const py = fy * g.H;
      ctx.beginPath();
      ctx.moveTo(px, py - s * 2.4);
      ctx.lineTo(px + s, py);
      ctx.lineTo(px - s, py);
      ctx.fill();
    }
  }

  // ---- funaya -----------------------------------------------------------

  const WOODS = ['#5e4230', '#6b4a34', '#4e3628', '#74533a'];
  const ROOFS = ['#2d3550', '#353d58', '#262c42', '#3a4157'];
  const PLASTER = rgb('#d6cfba');

  function pick(rand, list) {
    return rgb(list[Math.floor(rand() * list.length)]);
  }

  // Gable end facing the water: boat bay below, a pent roof, a room above.
  function paintFunaya(ctx, g, sky, h) {
    const { x, w, ht, base, s, rand } = h;
    const u = g.U * s;
    const top = base - ht;
    const wood = dim(mixColor(pick(rand, WOODS), sky.amb, 0.15), sky, 0.7);
    const dark = mixColor(wood, rgb('#1a1410'), 0.45);
    const tile = dim(pick(rand, ROOFS), sky, 0.5);
    const lit = rand() < 0.75;
    const plaster = rand() < 0.3;
    const floor = base - ht * 0.48;
    // Stone footing just above the water.
    ctx.fillStyle = hex(dim(rgb('#4a4640'), sky, 0.7));
    ctx.fillRect(x - u * 0.3, base - u * 0.9, w + u * 0.6, u * 0.9 + 1);
    // Walls.
    ctx.fillStyle = hex(wood);
    ctx.fillRect(x, top, w, base - top - u * 0.9);
    if (plaster) {
      ctx.fillStyle = hex(dim(PLASTER, sky, 0.65));
      ctx.fillRect(x + u * 0.6, top + u * 0.5, w - u * 1.2, floor - top - u * 1.5);
    } else if (u > 0.9) {
      ctx.fillStyle = hex(dark);
      for (let bx = x + u * 1.3; bx < x + w - 1; bx += u * 1.3) ctx.fillRect(bx, top, 1, floor - top);
    }
    // Boat bay: a dark mouth with a bow peeping out.
    ctx.fillStyle = hex(dim(rgb('#17141a'), sky, 0.3));
    ctx.fillRect(x + w * 0.14, floor + u * 1.2, w * 0.72, base - floor - u * 2.1);
    ctx.fillStyle = hex(dim(rgb('#8a6f4c'), sky, 0.65));
    ctx.fillRect(x + w * 0.3, base - u * 2.2, w * 0.4, Math.max(1, u * 0.8));
    // Pent roof between the floors.
    ctx.fillStyle = hex(tile);
    ctx.fillRect(x - u * 0.8, floor, w + u * 1.6, Math.max(1, u * 1.2));
    // Upper window, paper screen glowing at night.
    const winLit = mixColor(rgb('#d8cfb2'), rgb('#e2b65a'), sky.night);
    ctx.fillStyle = hex(lit ? winLit : dim(rgb('#b9b39b'), sky, 0.7));
    const ww = w * (0.36 + rand() * 0.18);
    const wy = top + (floor - top) * 0.3;
    const wh = (floor - top) * 0.42;
    ctx.fillRect(x + (w - ww) / 2, wy, ww, wh);
    ctx.fillStyle = hex(dark);
    ctx.fillRect(x + w / 2, wy, 1, wh);
    // Gable roof: tile edge with the wood gable showing inside it.
    const eave = u * (1.1 + rand() * 0.6);
    const rh = w * (0.32 + rand() * 0.18);
    ctx.fillStyle = hex(tile);
    ctx.beginPath();
    ctx.moveTo(x - eave, top + u * 0.4);
    ctx.lineTo(x + w / 2, top - rh);
    ctx.lineTo(x + w + eave, top + u * 0.4);
    ctx.closePath();
    ctx.fill();
    const inset = u * 1.3;
    ctx.fillStyle = hex(dark);
    ctx.beginPath();
    ctx.moveTo(x + inset, top + 0.5);
    ctx.lineTo(x + w / 2, top - rh + inset * 1.2);
    ctx.lineTo(x + w - inset, top + 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(tile, rgb('#d8d2c0'), 0.35));
    ctx.fillRect(x + w / 2 - u * 0.6, top - rh - u * 0.2, u * 1.2, Math.max(1, u * 0.6));
  }

  // Ridge parallel to the water: a long low roof, for variety.
  function paintLongHouse(ctx, g, sky, h) {
    const { x, w, ht, base, s, rand } = h;
    const u = g.U * s;
    const top = base - ht * 0.8;
    const wood = dim(mixColor(pick(rand, WOODS), sky.amb, 0.15), sky, 0.7);
    const tile = dim(pick(rand, ROOFS), sky, 0.5);
    ctx.fillStyle = hex(dim(rgb('#4a4640'), sky, 0.7));
    ctx.fillRect(x - u * 0.3, base - u * 0.9, w + u * 0.6, u * 0.9 + 1);
    ctx.fillStyle = hex(wood);
    ctx.fillRect(x, top, w, base - top - u * 0.9);
    ctx.fillStyle = hex(dim(rgb('#17141a'), sky, 0.3));
    for (let k = 0; k < 2; k++) ctx.fillRect(x + w * (0.08 + k * 0.48), base - ht * 0.42, w * 0.4, ht * 0.42 - u * 0.9);
    const winLit = mixColor(rgb('#d8cfb2'), rgb('#e2b65a'), sky.night);
    ctx.fillStyle = hex(rand() < 0.7 ? winLit : dim(rgb('#b9b39b'), sky, 0.7));
    ctx.fillRect(x + w * 0.15, top + ht * 0.12, w * 0.7, ht * 0.16);
    const rh = u * (4 + rand() * 1.5);
    ctx.fillStyle = hex(tile);
    ctx.beginPath();
    ctx.moveTo(x - u * 1.4, top + u * 0.3);
    ctx.lineTo(x + w * 0.18, top - rh);
    ctx.lineTo(x + w * 0.82, top - rh);
    ctx.lineTo(x + w + u * 1.4, top + u * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(tile, rgb('#d8d2c0'), 0.3));
    ctx.fillRect(x + w * 0.18, top - rh, w * 0.64, Math.max(1, u * 0.5));
  }

  // Lay out a run of houses whose size and waterline follow the bay's curve.
  function layoutCluster(g, rand, from, to, scaleAt) {
    const out = [];
    let x = g.W * from;
    while (x < g.W * to) {
      const s = scaleAt(x / g.W);
      const u = g.U * s;
      const w = Math.min(u * (9 + rand() * 6), g.W * to - x);
      if (w < u * 5) break;
      const cx = (x + w / 2) / g.W;
      out.push({
        x, w, s,
        ht: u * (10 + rand() * 6),
        base: g.H * shore(cx),
        kind: rand() < 0.22 ? 'long' : 'gable',
        rand: K.rng(Math.floor(rand() * 1e6)),
      });
      x += w + u * (rand() < 0.2 ? 2 + rand() * 3 : 1.6 + rand() * 0.8);
    }
    return out;
  }

  // Main houses (omoya) on the lane behind the boathouses: roofs only.
  function paintOmoya(ctx, g, sky, houses) {
    ctx.fillStyle = hex(dim(rgb('#232a3c'), sky, 0.5));
    for (const h of houses) {
      const u = g.U * h.s;
      const y = h.base - h.ht - u * 3.5;
      const rh = u * 3.2;
      ctx.beginPath();
      ctx.moveTo(h.x - u * 2, y + rh);
      ctx.lineTo(h.x + h.w * 0.25, y);
      ctx.lineTo(h.x + h.w * 1.05, y);
      ctx.lineTo(h.x + h.w * 1.3 + u * 2, y + rh);
      ctx.closePath();
      ctx.fill();
    }
  }

  function paintTown(ctx, g, sky, rand) {
    const left = layoutCluster(g, rand, 0.0, 0.42, (fx) => lerp(1.05, 0.55, fx / 0.42));
    const right = layoutCluster(g, rand, 0.6, 1.0, (fx) => lerp(0.5, 0.85, (fx - 0.6) / 0.4));
    paintOmoya(ctx, g, sky, left.concat(right));
    // Nearer houses overlap farther ones: left run is nearest at its left end.
    const order = left.slice().reverse().concat(right);
    for (const h of order) {
      if (h.kind === 'long') paintLongHouse(ctx, g, sky, h);
      else paintFunaya(ctx, g, sky, h);
    }
  }

  // ---- water -------------------------------------------------------------

  // Land mirrored column by column about the waterline, fading out a short
  // way from the shore so open water keeps its own colour.
  function mirror(g, land) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const reach = Math.ceil(g.H * 0.17);
    const fade = layer(1, reach);
    const fctx = fade.getContext('2d');
    const fg = fctx.createLinearGradient(0, 0, 0, reach);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(0.35, 'rgba(0,0,0,0.25)');
    fg.addColorStop(1, 'rgba(0,0,0,1)');
    fctx.fillStyle = fg;
    fctx.fillRect(0, 0, 1, reach);
    for (let x = 0; x < g.W; x += 2) {
      const yb = Math.round(g.H * shore((x + 1) / g.W));
      const span = Math.min(yb, g.H - yb, reach);
      if (span <= 0) continue;
      ctx.save();
      ctx.translate(0, yb * 2);
      ctx.scale(1, -1);
      ctx.drawImage(land, x, yb - span, 2, span, x, yb - span, 2, span);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (let x = 0; x < g.W; x += 2) {
      const yb = Math.round(g.H * shore((x + 1) / g.W));
      const len = Math.max(2, Math.min(reach, g.H * 0.06 + (yb - g.H * HORIZON) * 0.5));
      ctx.drawImage(fade, 0, 0, 1, reach, x, yb, 2, len);
      ctx.fillRect(x, yb + len - 1, 2, reach);
    }
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintWater(g, sky, land) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, rgb('#3f5a70'), 0.5)));
    grad.addColorStop(0.35, hex(dim(mixColor(rgb('#2f4a5e'), sky.top, 0.25), sky, 0.45)));
    grad.addColorStop(1, hex(dim(mixColor(rgb('#26405a'), sky.top, 0.2), sky, 0.3)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(mirror(g, land), 0, 0);
    ctx.globalAlpha = 1;
    // Ripple lines break the mirror; pale glints catch the sky.
    const rand = K.rng(77);
    const ripple = hex(mixColor(sky.low, rgb('#2f4a5e'), 0.4));
    const glint = hex(mixColor(sky.amb, rgb('#f2eee2'), 0.5));
    for (let i = 0; i < 160; i++) {
      const y = top + Math.pow(rand(), 0.8) * (g.H - top);
      const k = (y - top) / (g.H - top);
      ctx.fillStyle = rand() < 0.75 ? ripple : glint;
      ctx.globalAlpha = 0.25 + rand() * 0.3;
      ctx.fillRect(rand() * g.W, y, g.U * (3 + rand() * 10) * (0.4 + k), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    const land = layer(g.W, g.H);
    const lctx = land.getContext('2d');
    paintFar(lctx, g, sky);
    paintHeadlands(lctx, g, sky, rand);
    paintTown(lctx, g, sky, rand);
    state.water = paintWater(g, sky, land);
    state.land = land;
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.boatInk = hex(dim(rgb('#5a3f2c'), sky, 0.7));
    state.boatPaint = hex(dim(rgb('#a8412c'), sky, 0.6));
    state.boatShadow = hex(dim(rgb('#1a2230'), sky, 0.3));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 2.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  // Water drawn in thin strips that sway; nearer water moves more.
  function drawWater(ctx, g, t) {
    const top = Math.floor(g.H * HORIZON);
    const src = state.water;
    const amp = g.U * 1.1;
    for (let y = top; y < g.H; y += SLICE) {
      const k = (y - top) / (g.H - top);
      const sway = (Math.sin(t * 1.1 + y * 0.55) + 0.5 * Math.sin(t * 0.7 - y * 0.23)) * amp * (0.15 + k);
      ctx.drawImage(src, 0, y, g.W, SLICE, sway, y, g.W, SLICE);
    }
  }

  function boatPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s * 3.2, y - s * 0.9);
    ctx.lineTo(x + s * 3.4, y - s * 1.2);
    ctx.lineTo(x + s * 2.3, y + s * 0.5);
    ctx.lineTo(x - s * 2.4, y + s * 0.5);
    ctx.closePath();
  }

  function drawBoat(ctx, x, y, s, bob, mast) {
    const yy = y + bob * s * 0.35;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = state.boatShadow;
    ctx.fillRect(x - s * 2.6, yy + s * 0.5, s * 5.2, s * 1.3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = state.boatInk;
    boatPath(ctx, x, yy, s);
    ctx.fill();
    ctx.fillStyle = state.boatPaint;
    ctx.fillRect(x - s * 2.8, yy - s * 0.25, s * 5.6, Math.max(1, s * 0.35));
    if (mast) {
      ctx.fillStyle = state.boatInk;
      ctx.fillRect(x + s * 0.8, yy - s * 4.2, Math.max(1, s * 0.25), s * 3.2);
      ctx.fillRect(x - s * 0.6, yy - s * 2.2, s * 1.6, s * 1.1);
    }
  }

  function drawBoats(ctx, g, t) {
    const s = g.U * 1.6;
    drawBoat(ctx, g.W * 0.2, g.H * 0.86, s * 1.6, Math.sin(t * 0.8), true);
    drawBoat(ctx, g.W * 0.86, g.H * 0.8, s * 1.25, Math.sin(t * 0.7 + 2), false);
    drawBoat(ctx, g.W * 0.36, g.H * 0.73, s * 0.85, Math.sin(t * 1.0 + 4), false);
    // A fishing boat motors slowly in and out of the mouth of the bay.
    const drift = Math.sin(t * 0.06) * 0.5 + 0.5;
    drawBoat(ctx, lerp(g.W * 0.45, g.W * 0.6, drift), g.H * lerp(0.47, 0.56, drift), s * lerp(0.45, 0.7, drift), Math.sin(t * 1.3), true);
  }

  // A gull wheeling over the bay now and then.
  function drawGull(ctx, g, t) {
    const cycle = 36;
    const p = (t % cycle) / 24;
    if (p >= 1) return;
    const gx = lerp(-g.W * 0.03, g.W * 1.03, p);
    const gy = g.H * (0.2 + 0.04 * Math.sin(t * 0.4));
    const span = g.U * 2.4;
    const flap = Math.sin(t * 4.5) * g.U;
    ctx.strokeStyle = '#ece8dc';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.globalAlpha = 0.85 - state.night * 0.5;
    ctx.beginPath();
    ctx.moveTo(gx - span, gy + flap);
    ctx.lineTo(gx, gy);
    ctx.lineTo(gx + span, gy + flap);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.26));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    drawWater(ctx, g, t);
    ctx.drawImage(state.land, 0, 0);
    if (props.boats) drawBoats(ctx, g, t);
    drawGull(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, boats: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
