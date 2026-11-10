/*
 * 宏村 Hongcun — whitewashed Huizhou houses with stepped gables and dark
 * tile roofs around a half-moon pond.
 *
 * Sky, hills, houses and trees are baked once (and again each minute from
 * the clock). The pond reflection is that same picture turned over; each
 * frame it is drawn in thin strips that sway a little, with a few ripple
 * rings, drifting cloud and a band of mist on top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const SHORE = 0.64;
  const POND_RX = 0.46;
  const POND_RY = 0.34;
  const STRIP = 2;
  const RETINT_SECONDS = 60;
  const RINGS = [
    { x: 0.3, y: 0.3, p: 7.3, o: 0.0 },
    { x: 0.62, y: 0.55, p: 9.1, o: 3.1 },
    { x: 0.46, y: 0.75, p: 8.3, o: 5.2 },
    { x: 0.78, y: 0.28, p: 6.7, o: 1.9 },
    { x: 0.2, y: 0.62, p: 10.3, o: 7.4 },
  ];
  // centre, width, wall height and tiers, as fractions of the frame.
  const FAR = [
    { x: 0.2, w: 0.15, h: 0.16 }, { x: 0.43, w: 0.17, h: 0.19 },
    { x: 0.64, w: 0.14, h: 0.15 }, { x: 0.84, w: 0.16, h: 0.18 },
  ];
  const NEAR = [
    { x: 0.14, w: 0.15, h: 0.19, win: 1, door: false },
    { x: 0.31, w: 0.17, h: 0.24, win: 2, door: true },
    { x: 0.5, w: 0.15, h: 0.18, win: 1, door: true },
    { x: 0.67, w: 0.19, h: 0.25, win: 2, door: false },
    { x: 0.86, w: 0.15, h: 0.19, win: 1, door: true },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  // ---- sky and hills -----------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * SHORE);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
      const mx = g.W * (0.15 + 0.7 * S.moonT(sky.hour));
      ctx.globalAlpha = sky.night * 0.9;
      ctx.fillStyle = '#ece6d2';
      ctx.beginPath();
      ctx.arc(mx, g.H * 0.14, g.U * 3.2, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function paintHills(ctx, g, sky) {
    const layers = [
      { base: 0.3, amp: 0.16, f: 0.011, seed: 3, mix: 0.3 },
      { base: 0.37, amp: 0.12, f: 0.016, seed: 8, mix: 0.15 },
    ];
    for (const L of layers) {
      const col = mixColor(mixColor(rgb('#4a5878'), sky.haze, L.mix), rgb('#1c2238'), sky.night * 0.5);
      ctx.fillStyle = hex(col);
      ctx.beginPath();
      ctx.moveTo(0, g.H * SHORE);
      for (let x = 0; x <= g.W; x += 2) {
        const n = fbm(x * L.f, L.seed, 4, L.seed);
        ctx.lineTo(x, g.H * (L.base - L.amp * Math.pow(n, 1.4) + 0.04));
      }
      ctx.lineTo(g.W, g.H * SHORE);
      ctx.closePath();
      ctx.fill();
    }
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.014, y * 0.07, 4, 21), fbm((x - w) * 0.014, y * 0.07, 4, 21), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 240;
        img.data[i + 3] = smoothstep(0.55, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Long low streaks that tile sideways.
  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.pow(Math.sin((y / h) * Math.PI), 1.5);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.16, 4, 33), fbm((x - w) * 0.012, y * 0.16, 4, 33), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 236;
        img.data[i + 3] = smoothstep(0.42, 0.68, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- houses ------------------------------------------------------------

  function wallColor(sky, haze) {
    const day = mixColor(rgb('#d8d3c2'), sky.amb, 0.3);
    return mixColor(mixColor(day, rgb('#2c3350'), sky.night * 0.72), sky.haze, haze);
  }

  function roofColor(sky, haze) {
    return mixColor(mixColor(rgb('#2f3340'), rgb('#10131e'), sky.night * 0.6), sky.haze, haze);
  }

  // One house: white wall, a stepped gable on each side, dark tiled roof between.
  function paintHouse(ctx, g, sky, rand, spec, base, haze, lit) {
    const w = g.W * spec.w;
    const x0 = g.W * spec.x - w / 2;
    const top = base - g.H * spec.h;
    const step = Math.max(2, g.U * 2.4);
    const tw = w / 7;
    const wall = wallColor(sky, haze);
    const roof = roofColor(sky, haze);
    ctx.fillStyle = hex(wall);
    ctx.fillRect(x0, top, w, base - top);
    // Tiled roof between the two gables.
    ctx.fillStyle = hex(roof);
    ctx.beginPath();
    ctx.moveTo(x0 + tw * 2.6, top - step * 2);
    ctx.lineTo(x0 + tw * 4.4, top - step * 2);
    ctx.lineTo(x0 + tw * 4.6, top - step * 3.4);
    ctx.lineTo(x0 + tw * 2.4, top - step * 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x0 + tw * 2.2, top - step * 2.1, tw * 2.6, step * 2.1);
    ctx.fillStyle = hex(mixColor(roof, wall, 0.18));
    for (let k = 0; k < 3; k++) ctx.fillRect(x0 + tw * 2.3, top - step * (0.4 + k * 0.6), tw * 2.4, 1);
    // Horsehead gable tiers, tallest in the middle.
    for (let t = 0; t < 3; t++) {
      const hgt = step * (t + 1) * 0.95;
      ctx.fillStyle = hex(wall);
      ctx.fillRect(x0 + t * tw, top - hgt, tw + 0.5, hgt + 1);
      ctx.fillRect(x0 + w - (t + 1) * tw, top - hgt, tw + 0.5, hgt + 1);
      ctx.fillStyle = hex(roof);
      const capH = Math.max(1, g.U * 0.55);
      ctx.fillRect(x0 + t * tw - 1, top - hgt - capH, tw + 2, capH);
      ctx.fillRect(x0 + w - (t + 1) * tw - 1, top - hgt - capH, tw + 2, capH);
      ctx.fillRect(x0 + t * tw - 1, top - hgt - capH - 1, 1, 1);
      ctx.fillRect(x0 + w - (t + 1) * tw + tw, top - hgt - capH - 1, 1, 1);
    }
    // Eave line under the roofs and weathering near the foot.
    ctx.fillStyle = hex(mixColor(wall, rgb('#6e7080'), 0.4));
    ctx.fillRect(x0, top, w, 1);
    const stain = ctx.createLinearGradient(0, base - g.H * spec.h * 0.4, 0, base);
    stain.addColorStop(0, 'rgba(70,74,84,0)');
    stain.addColorStop(1, `rgba(70,74,84,${0.32 - haze * 0.2})`);
    ctx.fillStyle = stain;
    ctx.fillRect(x0, base - g.H * spec.h * 0.4, w, g.H * spec.h * 0.4);
    ctx.fillStyle = 'rgba(74,78,88,0.14)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x0 + rand() * w, top + 1, 1, g.H * spec.h * (0.3 + rand() * 0.5));
    if (!lit) return;
    paintOpenings(ctx, g, sky, spec, x0, w, top, base, wall);
  }

  function paintOpenings(ctx, g, sky, spec, x0, w, top, base, wall) {
    const night = sky.night;
    const frame = mixColor(rgb('#b9b4a6'), rgb('#4a4e60'), night * 0.7);
    const ww = Math.max(3, g.U * 1.8);
    const wh = Math.max(4, g.U * 2.6);
    for (let k = 0; k < spec.win; k++) {
      const wx = x0 + w * ((k + 1) / (spec.win + 1)) - ww / 2;
      const wy = top + g.H * spec.h * 0.2;
      ctx.fillStyle = hex(frame);
      ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
      ctx.fillStyle = hex(mixColor(rgb('#2b2e3a'), rgb('#d9a73a'), night * 0.75));
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = hex(frame);
      ctx.fillRect(wx + ww / 2, wy, 1, wh);
    }
    if (!spec.door) return;
    const dw = Math.max(4, g.U * 2.4);
    const dh = Math.max(6, g.U * 4.4);
    const dx = x0 + w * 0.5 - dw / 2;
    ctx.fillStyle = hex(frame);
    ctx.fillRect(dx - 2, base - dh - 2, dw + 4, dh + 2);
    ctx.fillStyle = hex(mixColor(rgb('#4a3226'), rgb('#d9a73a'), night * 0.5));
    ctx.fillRect(dx, base - dh, dw, dh);
    ctx.fillStyle = hex(mixColor(rgb('#d6452c'), rgb('#e8a24a'), night * 0.4));
    ctx.fillRect(dx - g.U * 1.6, base - dh - g.U * 1.2, Math.max(2, g.U * 0.9), Math.max(2, g.U * 1.2));
    ctx.fillRect(dx + dw + g.U * 0.7, base - dh - g.U * 1.2, Math.max(2, g.U * 0.9), Math.max(2, g.U * 1.2));
  }

  // ---- trees -------------------------------------------------------------

  function paintCamphor(ctx, g, sky, rand, cx, base, size) {
    const leaf = mixColor(mixColor(rgb('#4c6a40'), sky.amb, 0.1), rgb('#121a22'), sky.night * 0.75);
    ctx.fillStyle = hex(mixColor(rgb('#3a3028'), rgb('#101218'), sky.night * 0.6));
    ctx.fillRect(cx - size * 0.05, base - size * 0.5, size * 0.1, size * 0.5);
    for (let i = 0; i < 26; i++) {
      const a = rand() * 6.3;
      const r = Math.sqrt(rand());
      const px = cx + Math.cos(a) * size * 0.5 * r;
      const py = base - size * 0.78 + Math.sin(a) * size * 0.34 * r;
      ctx.fillStyle = hex(mixColor(leaf, rgb('#243824'), rand() * 0.5));
      ctx.beginPath();
      ctx.ellipse(px, py, size * (0.12 + rand() * 0.08), size * 0.08, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.strokeStyle = hex(mixColor(leaf, rgb('#8aa070'), 0.2));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 14; i++) {
      const sx = cx - size * 0.45 + rand() * size * 0.9;
      const sy = base - size * 0.7 + rand() * size * 0.15;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + size * 0.02, sy + size * 0.2, sx - size * 0.02, sy + size * (0.3 + rand() * 0.2));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintBamboo(ctx, g, sky, rand, x0, base) {
    const stem = hex(mixColor(rgb('#5a7a48'), rgb('#141c20'), sky.night * 0.75));
    const leaf = mixColor(rgb('#4c6e42'), rgb('#141c20'), sky.night * 0.75);
    for (let i = 0; i < 7; i++) {
      const bx = x0 + i * g.U * 1.3 + rand() * g.U;
      const bh = g.H * (0.16 + rand() * 0.1);
      ctx.fillStyle = stem;
      ctx.fillRect(bx, base - bh, Math.max(1, g.U * 0.35), bh);
      ctx.fillStyle = hex(mixColor(leaf, rgb('#7c9a60'), rand() * 0.4));
      for (let k = 0; k < 4; k++) {
        const ly = base - bh + rand() * bh * 0.4;
        ctx.beginPath();
        ctx.ellipse(bx + (rand() - 0.5) * g.U * 3, ly, g.U * 1.3, g.U * 0.3, (rand() - 0.5) * 1.2, 0, 6.3);
        ctx.fill();
      }
    }
  }

  // ---- ground and water --------------------------------------------------

  function pond(g) {
    return { cx: g.W * 0.5, cy: g.H * SHORE, rx: g.W * POND_RX, ry: g.H * POND_RY };
  }

  function paintGround(ctx, g, sky) {
    const p = pond(g);
    const earth = mixColor(mixColor(rgb('#5e6a4c'), sky.amb, 0.1), rgb('#161c1e'), sky.night * 0.7);
    ctx.fillStyle = hex(earth);
    ctx.fillRect(0, p.cy, g.W, g.H - p.cy);
    // Stone edge along the houses and around the pond.
    const stone = mixColor(mixColor(rgb('#a6a496'), sky.amb, 0.2), rgb('#2e3248'), sky.night * 0.7);
    ctx.fillStyle = hex(stone);
    ctx.fillRect(0, p.cy - g.U * 0.4, g.W, g.U * 1.8);
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy, p.rx + g.U * 1.4, p.ry + g.U * 1.4, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(stone, rgb('#3c4050'), 0.45));
    ctx.fillRect(0, p.cy + g.U * 1.3, g.W, 1);
  }

  function paintWater(ctx, g, sky) {
    const p = pond(g);
    const near = mixColor(mixColor(rgb('#3c5a64'), sky.low, 0.25), rgb('#0e1424'), sky.night * 0.7);
    const far = mixColor(mixColor(rgb('#58788a'), sky.low, 0.4), rgb('#1a2238'), sky.night * 0.6);
    const grad = ctx.createLinearGradient(0, p.cy, 0, p.cy + p.ry);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }

  // The upper picture turned over and cut to the pond, a little darker.
  function paintReflection(above, g, sky) {
    const p = pond(g);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rise = Math.ceil(p.ry);
    ctx.save();
    ctx.translate(0, p.cy);
    ctx.scale(1, -1);
    ctx.drawImage(above, 0, p.cy - rise, g.W, rise, 0, -rise, g.W, rise);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = hex(mixColor(rgb('#2c4650'), rgb('#0c1220'), sky.night * 0.6));
    ctx.globalAlpha = 0.34;
    ctx.fillRect(0, p.cy, g.W, rise);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy, p.rx - 1, p.ry - 1, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    const above = layer(g.W, g.H);
    const ctx = above.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintHills(ctx, g, sky);
    const base = g.H * SHORE;
    for (const s of FAR) paintHouse(ctx, g, sky, rand, s, base - g.H * 0.06, 0.45, false);
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#7a8a6a'), sky.haze, 0.5), rgb('#1a2030'), sky.night * 0.6));
    ctx.fillRect(0, base - g.H * 0.06, g.W, g.H * 0.06);
    for (const s of NEAR) paintHouse(ctx, g, sky, rand, s, base, 0.0, true);
    paintCamphor(ctx, g, sky, rand, g.W * 0.03, base, g.H * 0.3);
    paintBamboo(ctx, g, sky, rand, g.W * 0.93, base);
    state.refl = paintReflection(above, g, sky);
    paintGround(ctx, g, sky);
    paintWater(ctx, g, sky);
    state.back = above;
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.mistAlpha = 0.55 - sky.night * 0.25;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawReflection(ctx, g, t, amount) {
    const p = pond(g);
    const amp = g.U * 0.3 * (0.4 + amount);
    const end = Math.ceil(p.cy + p.ry);
    for (let y = Math.floor(p.cy); y < end; y += STRIP) {
      const k = (y - p.cy) / p.ry;
      const sway = Math.sin(t * 1.1 + y * 0.55) * amp * (0.3 + k) + Math.sin(t * 2.3 + y * 1.3) * amp * 0.3;
      ctx.drawImage(state.refl, 0, y, g.W, STRIP, sway, y, g.W, STRIP);
    }
  }

  function drawRings(ctx, g, t, amount) {
    if (amount <= 0) return;
    const p = pond(g);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy, p.rx - 2, p.ry - 2, 0, 0, Math.PI);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = '#e8ecea';
    ctx.lineWidth = 1;
    for (const r of RINGS) {
      const a = ((t + r.o) % r.p) / r.p;
      const cx = p.cx + (r.x - 0.5) * 2 * p.rx * 0.9;
      const cy = p.cy + r.y * p.ry;
      for (let k = 0; k < 2; k++) {
        const b = a - k * 0.12;
        if (b <= 0) continue;
        ctx.globalAlpha = (1 - b) * 0.7 * Math.min(1, amount);
        ctx.beginPath();
        ctx.ellipse(cx, cy, g.U * (0.8 + b * 14), g.U * (0.3 + b * 4.5), 0, 0, 6.3);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawDrift(ctx, img, y, speed, t, alpha, g) {
    if (alpha <= 0) return;
    const off = -((t * g.U * speed) % img.width);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(img, off, y);
    ctx.drawImage(img, off + img.width, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.12));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawDrift(ctx, state.clouds, g.H * 0.03, 1.6, t, state.cloudAlpha, g);
    drawReflection(ctx, g, t, props.ripple);
    drawRings(ctx, g, t, props.ripple);
    drawDrift(ctx, state.mist, g.H * 0.3, 2.4, t, state.mistAlpha * props.mist, g);
  }

  Kasuri.run({
    defaults: { time: 'auto', ripple: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
