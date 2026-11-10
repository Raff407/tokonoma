/*
 * 伊根 Ine — a bay of wooden boathouses standing over still water.
 *
 * Sky, hills, houses and water are baked into layers and repainted once a
 * minute from the clock, so windows glow at night. Between repaints only
 * clouds, the water's reflection, a few boats and a gull move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.5;
  const BASE = 0.7;
  const RETINT_SECONDS = 60;
  const SLICE = 2;
  const CLUSTERS = [{ from: 0.02, to: 0.37 }, { from: 0.63, to: 0.98 }];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);
  const dim = (c, sky, k) => mixColor(c, rgb('#12141f'), sky.night * k);

  // ---- sky and hills -----------------------------------------------------

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
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
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

  // A ridge filled down to the horizon: far ones pale and blue, near ones green.
  function paintRidge(ctx, g, color, topF, amp, seed, freq) {
    ctx.fillStyle = hex(color);
    ctx.beginPath();
    ctx.moveTo(0, g.H * HORIZON + 1);
    for (let x = 0; x <= g.W; x += 2) {
      const y = g.H * topF - (fbm(x * freq, seed, 3, seed) - 0.3) * g.H * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H * HORIZON + 1);
    ctx.closePath();
    ctx.fill();
  }

  function paintHills(ctx, g, sky) {
    const far = dim(mixColor(rgb('#6f8aa0'), sky.haze, 0.55), sky, 0.7);
    const mid = dim(mixColor(rgb('#4d6e66'), sky.haze, 0.4), sky, 0.75);
    paintRidge(ctx, g, far, 0.4, 0.22, 7, 0.004);
    paintRidge(ctx, g, mid, 0.45, 0.2, 13, 0.006);
  }

  // Tall steep hills behind each cluster of houses, with moss and pine shapes.
  function paintBackHills(ctx, g, sky, rand) {
    const moss = dim(mixColor(rgb('#3e5a40'), sky.amb, 0.1), sky, 0.78);
    const deep = dim(mixColor(rgb('#2a4234'), sky.haze, 0.1), sky, 0.78);
    ctx.fillStyle = hex(moss);
    ctx.beginPath();
    ctx.moveTo(0, g.H * BASE);
    const bottoms = [];
    for (let x = 0; x <= g.W; x += 2) {
      const fx = x / g.W;
      const open = smoothstep(0.26, 0.45, fx) * (1 - smoothstep(0.55, 0.74, fx));
      const rise = 0.5 + 0.2 * Math.sin(fx * 4.2 + 1) + (fbm(x * 0.012, 3, 3, 21) - 0.5) * 0.3;
      const top = lerp(g.H * (0.5 - rise * 0.38), g.H * 0.5, open);
      ctx.lineTo(x, top);
      bottoms.push(x, lerp(g.H * BASE, g.H * HORIZON, open));
    }
    for (let i = bottoms.length - 2; i >= 0; i -= 2) ctx.lineTo(bottoms[i], bottoms[i + 1]);
    ctx.closePath();
    ctx.fill();
    // Dark pines in rows along the slopes.
    ctx.fillStyle = hex(deep);
    for (let i = 0; i < 90; i++) {
      const px = rand() * g.W;
      const fx = px / g.W;
      if (fx > 0.36 && fx < 0.64) continue;
      const py = g.H * (0.34 + rand() * 0.2);
      const s = g.U * (1.2 + rand() * 1.4);
      ctx.beginPath();
      ctx.moveTo(px, py - s * 2.2);
      ctx.lineTo(px + s, py);
      ctx.lineTo(px - s, py);
      ctx.fill();
    }
  }

  // ---- boathouses --------------------------------------------------------

  const WOODS = ['#6b4a34', '#5e4230', '#74533a', '#523a2c'];
  const ROOFS = ['#2d3550', '#353d58', '#2a3048'];

  function paintHouse(ctx, g, sky, rand, hx, w, h, lit) {
    const base = g.H * BASE;
    const top = base - h;
    const post = dim(rgb('#3b2c24'), sky, 0.75);
    // Stilts and the open boat bay below the floor.
    ctx.fillStyle = hex(post);
    for (let p = 0; p <= 5; p++) ctx.fillRect(hx + (w - 1) * (p / 5), base, Math.max(1, g.U * 0.35), g.U * 2.2);
    // Wall of vertical boards.
    const wood = dim(mixColor(rgb(WOODS[Math.floor(rand() * WOODS.length)]), sky.amb, 0.15), sky, 0.7);
    ctx.fillStyle = hex(wood);
    ctx.fillRect(hx, top, w, h);
    ctx.fillStyle = hex(mixColor(wood, rgb('#1c1612'), 0.35));
    for (let x = hx + g.U * 0.9; x < hx + w; x += g.U * 0.9) ctx.fillRect(x, top, 1, h);
    // Upper window with paper screen, lit from within at night.
    const win = mixColor(rgb('#cfc7ae'), rgb('#e0b45a'), sky.night);
    ctx.fillStyle = hex(lit ? win : dim(rgb('#b9b39b'), sky, 0.6));
    const ww = w * 0.42;
    ctx.fillRect(hx + w * 0.29, top + h * 0.1, ww, h * 0.3);
    ctx.fillStyle = hex(post);
    ctx.fillRect(hx + w * 0.29 + ww / 2, top + h * 0.1, 1, h * 0.3);
    ctx.fillRect(hx + w * 0.29, top + h * 0.25, ww, 1);
    // Boat bay, dark with the bow of a boat peeping out.
    ctx.fillStyle = hex(dim(rgb('#1e1a1a'), sky, 0.3));
    ctx.fillRect(hx + w * 0.12, base - h * 0.42, w * 0.76, h * 0.42);
    ctx.fillStyle = hex(dim(rgb('#8a6f4c'), sky, 0.7));
    ctx.fillRect(hx + w * 0.22, base - h * 0.1, w * 0.56, Math.max(1, h * 0.08));
    // Tiled roof with wide eaves and a ridge line.
    const tile = dim(rgb(ROOFS[Math.floor(rand() * ROOFS.length)]), sky, 0.5);
    const rh = g.U * (6 + rand() * 2);
    ctx.fillStyle = hex(tile);
    ctx.beginPath();
    ctx.moveTo(hx - w * 0.12, top);
    ctx.lineTo(hx + w * 0.2, top - rh);
    ctx.lineTo(hx + w * 0.8, top - rh);
    ctx.lineTo(hx + w * 1.12, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(tile, rgb('#9aa3b8'), 0.22 * (1 - sky.night)));
    for (let k = 1; k < 4; k++) ctx.fillRect(hx - w * 0.12 + k * g.U * 0.3, top - rh * (k / 4), w * 1.24 - k * g.U * 0.6, 1);
    ctx.fillStyle = hex(mixColor(tile, rgb('#d8d2c0'), 0.3));
    ctx.fillRect(hx + w * 0.2, top - rh, w * 0.6, Math.max(1, g.U * 0.35));
  }

  function paintCluster(ctx, g, sky, rand, c) {
    let hx = g.W * c.from;
    const end = g.W * c.to;
    while (hx < end - g.U * 6) {
      const w = g.U * (9 + rand() * 5);
      const h = g.U * (8 + rand() * 4);
      paintHouse(ctx, g, sky, rand, hx, Math.min(w, end - hx), h, rand() < 0.7);
      hx += w + g.U * (0.3 + rand() * 0.8);
    }
  }

  function paintQuay(ctx, g, sky) {
    const base = g.H * BASE;
    ctx.fillStyle = hex(dim(rgb('#4a4640'), sky, 0.7));
    for (const c of CLUSTERS) ctx.fillRect(g.W * c.from - g.U, base - Math.max(1, g.U * 0.4), g.W * (c.to - c.from) + g.U * 2, g.U * 0.9);
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, scene) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, rgb('#4b6577'), 0.45)));
    grad.addColorStop(1, hex(dim(mixColor(rgb('#2d4658'), sky.top, 0.3), sky, 0.5)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Mirror of everything above the waterline, softened.
    const base = g.H * BASE;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(0, base * 2);
    ctx.scale(1, -1);
    ctx.drawImage(scene, 0, 0, g.W, base, 0, 0, g.W, base);
    ctx.restore();
    ctx.globalAlpha = 1;
    // Pale glints low on the water.
    ctx.fillStyle = hex(mixColor(sky.amb, rgb('#ffffff'), 0.4));
    const rand = K.rng(77);
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.16;
      ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), g.U * (1 + rand() * 3), 1);
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
    paintHills(lctx, g, sky);
    paintBackHills(lctx, g, sky, rand);
    for (const cl of CLUSTERS) paintCluster(lctx, g, sky, rand, cl);
    paintQuay(lctx, g, sky);
    const whole = layer(g.W, g.H);
    const wctx = whole.getContext('2d');
    wctx.drawImage(state.sky, 0, 0);
    wctx.drawImage(land, 0, 0);
    state.water = paintWater(g, sky, whole);
    state.land = land;
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.boatInk = hex(dim(rgb('#6b4a34'), sky, 0.7));
    state.boatPaint = hex(dim(rgb('#a8412c'), sky, 0.6));
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

  // Water is shown in thin strips that sway a little, the further the stiller.
  function drawWater(ctx, g, t) {
    const top = Math.floor(g.H * HORIZON);
    const src = state.water;
    for (let y = top; y < g.H; y += SLICE) {
      const k = (y - top) / (g.H - top);
      const sway = Math.sin(t * 1.4 + y * 0.9) * g.U * 0.3 * (0.3 + k);
      ctx.drawImage(src, 0, y, g.W, SLICE, sway, y, g.W, SLICE);
    }
  }

  function drawBoat(ctx, g, x, y, s, bob, ink, paint) {
    const dy = bob * s * 0.3;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x - s * 3, y + dy - s * 0.8);
    ctx.lineTo(x + s * 3.2, y + dy - s * 1.0);
    ctx.lineTo(x + s * 2.2, y + dy + s * 0.6);
    ctx.lineTo(x - s * 2.2, y + dy + s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = paint;
    ctx.fillRect(x - s * 2.6, y + dy - s * 0.1, s * 5, Math.max(1, s * 0.3));
  }

  function drawBoats(ctx, g, t) {
    const s = g.U * 1.3;
    const ink = state.boatInk;
    const paint = state.boatPaint;
    drawBoat(ctx, g, g.W * 0.22, g.H * 0.8, s * 1.1, Math.sin(t * 0.9), ink, paint);
    drawBoat(ctx, g, g.W * 0.78, g.H * 0.84, s * 1.2, Math.sin(t * 0.8 + 2), ink, paint);
    drawBoat(ctx, g, g.W * 0.6, g.H * 0.77, s * 0.8, Math.sin(t * 1.1 + 4), ink, paint);
    // One boat drifts slowly across the open gap and back.
    const drift = Math.sin(t * 0.05) * 0.5 + 0.5;
    const bx = lerp(g.W * 0.43, g.W * 0.57, drift);
    drawBoat(ctx, g, bx, g.H * 0.62, s * 0.6, Math.sin(t * 1.3), ink, paint);
    ctx.fillStyle = ink;
    ctx.fillRect(bx - 1, g.H * 0.62 - s * 2.2, 1, s * 1.6);
  }

  // A single gull crossing the sky now and then.
  function drawGull(ctx, g, t) {
    const cycle = 40;
    const p = (t % cycle) / 26;
    if (p >= 1) return;
    const gx = lerp(-g.W * 0.03, g.W * 1.03, p);
    const gy = g.H * (0.24 + 0.03 * Math.sin(t * 0.5));
    const flap = Math.sin(t * 5) * g.U * 0.7;
    ctx.strokeStyle = '#ece8dc';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8 - state.night * 0.5;
    ctx.beginPath();
    ctx.moveTo(gx - g.U * 1.6, gy + flap);
    ctx.lineTo(gx, gy);
    ctx.lineTo(gx + g.U * 1.6, gy + flap);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
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
