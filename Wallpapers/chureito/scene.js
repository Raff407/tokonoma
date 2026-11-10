/*
 * 忠霊塔 Chureito — a vermilion five-storey pagoda on a wooded hillside in spring.
 *
 * Sky, Fuji, hills, forest, pagoda and the two blossom boughs are baked once.
 * Between bakes only haze strips, a cloud strip, a pool of petals and a tiny
 * sway of the boughs move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const PEAK = { x: 0.66, y: 0.17 };
  const FUJI_BASE = 0.62;
  const PAGODA = { x: 0.3, base: 0.805 };
  const MAX_PETALS = 90;
  const PETAL_INKS = ['#f0d6cf', '#e6b9b3', '#f6e8e0'];
  const BLOSSOM = ['#e8b9b4', '#dba5a5', '#f0d3cb', '#f4e4da'];
  const CEDAR = ['#1f3228', '#2a4033', '#35503c'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

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

  // ---- sky and clouds ------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    grad.addColorStop(0, '#8aa5c2');
    grad.addColorStop(0.55, '#bccbd6');
    grad.addColorStop(1, '#eadbcb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintStrip(w, h, seed, tint, peak) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const dens = (x, y) => fbm(x * 0.012, y * 0.08, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(dens(x, y), dens(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.4, 0.72, v) * band * peak;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- Fuji and far hills --------------------------------------------------

  function fujiRidge(g, x) {
    const px = g.W * PEAK.x;
    const half = g.W * (x < px ? 0.42 : 0.5);
    const crater = g.W * 0.014;
    const d = Math.max(0, Math.abs(x - px) - crater) / half;
    const base = g.H * FUJI_BASE;
    const top = g.H * PEAK.y;
    return base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.55) + (fbm(x * 0.07, 2, 3, 5) - 0.5) * g.U * 0.6;
  }

  function paintFuji(ctx, g) {
    const x0 = Math.floor(g.W * 0.2);
    const y0 = Math.floor(g.H * PEAK.y - g.U * 2);
    const w = Math.ceil(g.W) - x0;
    const h = Math.ceil(g.H * FUJI_BASE) - y0;
    const img = ctx.getImageData(x0, y0, w, h);
    const snow = rgb('#e4e7ea');
    const rock = rgb('#6f7f9a');
    const haze = rgb('#d4cdc8');
    const shadow = rgb('#8c97ad');
    for (let x = 0; x < w; x++) {
      const gx = x0 + x;
      const top = fujiRidge(g, gx);
      const side = gx > g.W * PEAK.x ? 0.1 : 0;
      for (let y = Math.max(0, Math.floor(top - y0)); y < h; y++) {
        const gy = y0 + y;
        const f = (gy - g.H * PEAK.y) / (g.H * (FUJI_BASE - PEAK.y));
        const gully = fbm(gx * 0.07, 7, 3, 9);
        const line = 0.46 + (fbm(gx * 0.03, 4, 3, 11) - 0.5) * 0.14 + (gully - 0.5) * 0.2 + (gx > g.W * PEAK.x ? 0.04 : 0);
        let c = f < line ? mixColor(snow, shadow, side + (gully > 0.6 ? 0.22 : 0)) : mixColor(rock, shadow, side + (gully > 0.6 ? 0.18 : 0));
        c = mixColor(c, haze, smoothstep(0.35, 1, f) * 0.62);
        const i = (y * w + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  function hillRidge(g, x, level, amp, seed) {
    return g.H * level + (fbm(x * 0.012, 5, 4, seed) - 0.5) * g.H * amp;
  }

  function paintHill(ctx, g, level, amp, seed, tone, rand, dots) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, hillRidge(g, x, level, amp, seed));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < dots; i++) {
      const x = rand() * g.W;
      const y = hillRidge(g, x, level, amp, seed) + rand() * g.H * 0.05 + g.U * 0.5;
      ctx.fillStyle = BLOSSOM[Math.floor(rand() * 3)];
      ctx.globalAlpha = 0.55 + rand() * 0.3;
      blob(ctx, x, y, g.U * (0.8 + rand() * 1.2), g.U * (0.6 + rand() * 0.8));
    }
    ctx.globalAlpha = 1;
  }

  function paintFar(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFuji(ctx, g);
    // Warm haze pooling where the mountain meets the hills.
    const mist = ctx.createLinearGradient(0, g.H * 0.36, 0, g.H * 0.56);
    mist.addColorStop(0, 'rgba(236,222,208,0)');
    mist.addColorStop(1, 'rgba(236,222,208,0.8)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, g.H * 0.36, g.W, g.H * 0.2);
    paintHill(ctx, g, 0.52, 0.06, 21, '#a9b3a8', rand, 90);
    paintHill(ctx, g, 0.56, 0.07, 33, '#7f9484', rand, 140);
    return c;
  }

  // ---- forest ----------------------------------------------------------------

  function forestY(g, x) {
    return g.H * (0.57 + 0.11 * smoothstep(0.3, 1, x / g.W)) + (fbm(x * 0.03, 3, 3, 7) - 0.5) * g.U * 5;
  }

  function lawnY(g, x) {
    return g.H * (0.815 + 0.085 * (x / g.W));
  }

  function cedar(ctx, x, base, h, w, tone) {
    ctx.fillStyle = tone;
    const tiers = 4;
    for (let t = 0; t < tiers; t++) {
      const k = t / tiers;
      const y = base - h * k;
      const half = w * (1 - k * 0.7) * 0.5;
      poly(ctx, [x - half, y, x, y - h / tiers * 1.5, x + half, y]);
    }
    ctx.fillRect(x - 0.5, base, 1, Math.max(1, h * 0.12));
  }

  function cherry(ctx, g, x, y, r, rand) {
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = BLOSSOM[Math.floor(rand() * BLOSSOM.length)];
      ctx.globalAlpha = 0.9;
      blob(ctx, x + (rand() - 0.5) * r * 1.4, y + (rand() - 0.5) * r * 0.8, r * (0.45 + rand() * 0.4), r * (0.35 + rand() * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function paintForest(ctx, g, rand) {
    ctx.fillStyle = '#26392d';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, forestY(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    // Cedars crowd behind the pagoda and fade toward the open slope on the right.
    for (let i = 0; i < 110; i++) {
      const x = rand() * g.W * 0.7;
      const top = forestY(g, x);
      const base = top + g.U * (3 + rand() * 20);
      cedar(ctx, x, base, g.U * (6 + rand() * 5), g.U * (4 + rand() * 2.5), CEDAR[Math.floor(rand() * 3)]);
    }
    // Cherry trees, thickest on the right where the slope is open.
    for (let i = 0; i < 150; i++) {
      const x = rand() * g.W;
      const lean = x / g.W;
      if (rand() > 0.12 + lean * 0.8) continue;
      if (Math.abs(x - g.W * PAGODA.x) < g.W * 0.15) continue;
      const top = forestY(g, x);
      const y = top + rand() * Math.max(g.U * 3, lawnY(g, x) - top - g.U * 4);
      cherry(ctx, g, x, y, g.U * (1.2 + rand() * 1.5), rand);
    }
  }

  // ---- pagoda ------------------------------------------------------------------

  function roof(ctx, cx, eave, top, ridge, r, p) {
    ctx.fillStyle = '#2d3347';
    ctx.beginPath();
    ctx.moveTo(cx - ridge, top);
    ctx.lineTo(cx + ridge, top);
    ctx.quadraticCurveTo(cx + ridge + (r - ridge) * 0.3, eave + 0.1 * p, cx + r, eave - 0.5 * p);
    ctx.lineTo(cx + r * 0.9, eave + 0.3 * p);
    ctx.lineTo(cx - r * 0.9, eave + 0.3 * p);
    ctx.lineTo(cx - r, eave - 0.5 * p);
    ctx.quadraticCurveTo(cx - ridge - (r - ridge) * 0.3, eave + 0.1 * p, cx - ridge, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#12141c';
    ctx.fillRect(cx - r * 0.88, eave + 0.05 * p, r * 1.76, Math.max(1, 0.32 * p));
    ctx.fillStyle = '#5b6279';
    ctx.fillRect(cx - ridge, top, Math.max(1, ridge * 2), Math.max(1, 0.15 * p));
  }

  function tier(ctx, cx, y0, hw, wh, p) {
    ctx.fillStyle = '#b8402b';
    ctx.fillRect(cx - hw, y0 - wh, hw * 2, wh);
    ctx.fillStyle = '#7b2a1f';
    const post = Math.max(1, 0.4 * p);
    for (let k = -2; k <= 2; k++) ctx.fillRect(cx + (k * hw) / 2 - post / 2, y0 - wh, post, wh);
    ctx.fillStyle = '#5a1f18';
    ctx.fillRect(cx - hw, y0 - wh, hw * 2, Math.max(1, 0.4 * p));
    ctx.fillStyle = '#d28a45';
    ctx.fillRect(cx - hw, y0 - 0.3 * p, hw * 2, Math.max(1, 0.28 * p));
    ctx.fillStyle = '#e3d8c4';
    for (let k = -1; k <= 1; k++) ctx.fillRect(cx + (k * hw) / 2 + post, y0 - wh * 0.7, Math.max(1, hw * 0.28), wh * 0.38);
  }

  function paintPagoda(ctx, g) {
    const p = g.U * 1.8;
    const cx = g.W * PAGODA.x;
    const base = g.H * PAGODA.base;
    // Stone terrace.
    ctx.fillStyle = '#8b887d';
    ctx.fillRect(cx - p * 11, base, p * 22, g.H * 0.05);
    ctx.fillStyle = '#6c6a62';
    for (let k = 1; k < 4; k++) ctx.fillRect(cx - p * 11, base + k * g.U * 1.3, p * 22, 1);
    ctx.fillStyle = '#a19d90';
    ctx.fillRect(cx - p * 11, base - 0.4 * p, p * 22, 0.5 * p);
    ctx.fillStyle = '#a8a396';
    ctx.fillRect(cx - p * 6.6, base - 1.2 * p, p * 13.2, 0.9 * p);
    let y0 = base - 1.2 * p;
    const wh = 2.7 * p;
    const rh = 1.55 * p;
    for (let i = 0; i < 5; i++) {
      const hw = (5.4 - i * 0.78) * p;
      const nextHw = i === 4 ? 0.4 * p : (5.4 - (i + 1) * 0.78) * p;
      const r = hw + (2.4 - i * 0.1) * p;
      tier(ctx, cx, y0, hw, wh, p);
      roof(ctx, cx, y0 - wh, y0 - wh - rh, nextHw + 0.15 * p, r, p);
      y0 = y0 - wh - rh + 0.35 * p;
    }
    // Finial: pole with gold rings.
    const pole = Math.max(1, 0.45 * p);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(cx - pole / 2, y0 - 6.4 * p, pole, 6.6 * p);
    ctx.fillStyle = '#d1a64a';
    for (let k = 0; k < 6; k++) ctx.fillRect(cx - 0.8 * p, y0 - (1.2 + k * 0.85) * p, 1.6 * p, Math.max(1, 0.3 * p));
    poly(ctx, [cx - 0.5 * p, y0 - 6.4 * p, cx, y0 - 7.6 * p, cx + 0.5 * p, y0 - 6.4 * p]);
  }

  function paintGround(ctx, g, rand) {
    ctx.fillStyle = '#5f7449';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, lawnY(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a603b';
    for (let i = 0; i < g.W * 1.2; i++) {
      const x = rand() * g.W;
      const y = lawnY(g, x) + rand() * (g.H - lawnY(g, x));
      ctx.fillRect(x, y, 1 + rand() * 2, 1);
    }
    // Stone stair from the terrace down to the bottom edge.
    const cx = g.W * PAGODA.x;
    const top = g.H * (PAGODA.base + 0.05);
    for (let y = top, k = 0; y < g.H; y += g.U * 1.6, k++) {
      const half = g.U * (4.5 + (y - top) * 0.09);
      ctx.fillStyle = k % 2 ? '#9a9688' : '#7d796e';
      ctx.fillRect(cx - half, y, half * 2, g.U * 1.6);
      ctx.fillStyle = '#34382f';
      ctx.fillRect(cx - half - g.U * 0.7, y, g.U * 0.7, g.U * 1.6);
      ctx.fillRect(cx + half, y, g.U * 0.7, g.U * 1.6);
    }
    // Stone lanterns at the terrace corners.
    for (const sx of [-1, 1]) {
      const lx = cx + sx * g.U * 20;
      const ly = g.H * (PAGODA.base + 0.04);
      ctx.fillStyle = '#7d796e';
      ctx.fillRect(lx - g.U * 0.5, ly - g.U * 3, g.U, g.U * 3);
      ctx.fillStyle = '#9a9688';
      ctx.fillRect(lx - g.U * 1.3, ly - g.U * 4.6, g.U * 2.6, g.U * 1.7);
      ctx.fillStyle = '#6c6a62';
      poly(ctx, [lx - g.U * 1.8, ly - g.U * 4.6, lx, ly - g.U * 6.2, lx + g.U * 1.8, ly - g.U * 4.6]);
    }
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintForest(ctx, g, rand);
    paintGround(ctx, g, rand);
    paintPagoda(ctx, g);
    // Blossom drifting in front of the lawn edge.
    for (let i = 0; i < 26; i++) {
      const x = rand() * g.W;
      if (Math.abs(x - g.W * PAGODA.x) < g.W * 0.1) continue;
      cherry(ctx, g, x, lawnY(g, x) + g.U * (rand() * 3), g.U * (1.6 + rand() * 1.6), rand);
    }
    return c;
  }

  // ---- boughs ----------------------------------------------------------------

  function paintBough(g, rand, fromRight, reach, drop) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sx = fromRight ? g.W : 0;
    const dir = fromRight ? -1 : 1;
    const ex = sx + dir * g.W * reach;
    const ey = g.H * drop;
    ctx.strokeStyle = '#3b2a22';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, g.U * 1.1);
    ctx.beginPath();
    ctx.moveTo(sx + dir * g.U * 4, -g.U * 2);
    ctx.quadraticCurveTo(sx + dir * g.W * reach * 0.45, g.H * drop * 0.1, ex, ey);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    for (let i = 0; i < 7; i++) {
      const t = 0.2 + i * 0.12;
      const bx = lerp(sx, ex, t);
      const by = lerp(0, ey, t * t);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + dir * g.U * (2 + rand() * 4), by + g.U * (3 + rand() * 6));
      ctx.stroke();
    }
    for (let i = 0; i < 34; i++) {
      const t = 0.08 + rand() * 0.92;
      const bx = lerp(sx, ex, t) + (rand() - 0.5) * g.U * 8;
      const by = lerp(0, ey, t * t) + rand() * g.U * 8;
      cherry(ctx, g, bx, by, g.U * (1.3 + rand() * 1.8), rand);
    }
    return c;
  }

  // ---- bake ------------------------------------------------------------------

  function bake(api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(41);
    state.g = g;
    state.sky = paintSky(g);
    state.clouds = paintStrip(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22), 21, [250, 244, 238], 170);
    state.far = paintFar(g, rand);
    state.hazeHigh = paintStrip(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.18), 33, [240, 228, 218], 200);
    state.hazeLow = paintStrip(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.14), 57, [236, 224, 214], 150);
    state.mid = paintMid(g, rand);
    state.boughR = paintBough(g, rand, true, 0.26, 0.2);
    state.boughL = paintBough(g, rand, false, 0.17, 0.14);
    state.petals = [];
    for (let i = 0; i < MAX_PETALS; i++) {
      state.petals.push({
        x: rand() * g.W * 1.2,
        y: rand() * g.H * 1.1,
        vx: g.U * (5 + rand() * 7),
        vy: g.U * (2 + rand() * 3.5),
        ph: rand() * TAU,
        fl: 1.2 + rand() * 1.6,
        s: Math.max(1.4, g.U * (0.7 + rand() * 0.7)),
        ink: Math.floor(rand() * PETAL_INKS.length),
      });
    }
    state.size = g.W + 'x' + g.H;
  }

  // ---- motion ----------------------------------------------------------------

  function drawStrip(ctx, g, strip, t, speed, y, amount) {
    if (amount <= 0) return;
    const off = -((t * g.U * speed) % strip.width);
    ctx.globalAlpha = Math.min(1, amount);
    ctx.drawImage(strip, off, y);
    ctx.drawImage(strip, off + strip.width, y);
    ctx.globalAlpha = 1;
  }

  function drawBough(ctx, g, img, t, fromRight, on) {
    if (!on) {
      ctx.drawImage(img, 0, 0);
      return;
    }
    const a = Math.sin(t * 0.55 + (fromRight ? 0 : 2)) * 0.011;
    const px = fromRight ? g.W : 0;
    ctx.save();
    ctx.translate(px, 0);
    ctx.rotate(fromRight ? -a : a);
    ctx.drawImage(img, -px, 0);
    ctx.restore();
  }

  function drawPetals(ctx, g, t, amount) {
    const n = Math.round(MAX_PETALS * Math.min(1, amount / 1.4));
    const wrapW = g.W * 1.2;
    const wrapH = g.H * 1.1;
    for (let i = 0; i < n; i++) {
      const p = state.petals[i];
      const x = (((p.x + t * p.vx) % wrapW) + wrapW) % wrapW - g.W * 0.1;
      const y = (((p.y + t * p.vy) % wrapH) + wrapH) % wrapH - g.H * 0.05 + Math.sin(t * p.fl + p.ph) * g.U * 1.6;
      ctx.fillStyle = PETAL_INKS[p.ink];
      ctx.fillRect(x, y, p.s * 1.3, p.s);
    }
  }

  function setup(ctx, api) {
    bake(api);
  }

  function draw(ctx, t, dt, api) {
    if (state.size !== api.cols + 'x' + api.rows) bake(api);
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.sky, 0, 0);
    drawStrip(ctx, g, state.clouds, t, 1.4, g.H * 0.05, 0.8);
    ctx.drawImage(state.far, 0, 0);
    drawStrip(ctx, g, state.hazeHigh, t, 2.2, g.H * 0.45, 0.8 * props.haze);
    ctx.drawImage(state.mid, 0, 0);
    drawStrip(ctx, g, state.hazeLow, t, 3.4, g.H * 0.64, 0.55 * props.haze);
    drawBough(ctx, g, state.boughR, t, true, props.sway);
    drawBough(ctx, g, state.boughL, t, false, props.sway);
    drawPetals(ctx, g, t, props.petals);
  }

  Kasuri.run({
    defaults: { petals: 1, haze: 1, sway: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
