/*
 * 长城 Great Wall — the wall climbing a mountain ridge in autumn.
 *
 * Sky, far ridges, the wall with its watchtowers and the maple slopes are
 * baked into layers and repainted once a minute from the clock. Between
 * repaints only mist banks, a thin beacon smoke and a few leaves move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const MAX_SMOKE = 10;
  const MAX_LEAVES = 24;
  const TOWERS = [0.1, 0.27, 0.47, 0.66, 0.84];
  const LEAF_INK = ['#b8472e', '#c99a3a', '#9a3a28', '#d0a64a'];
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Tint a colour by the light of the hour.
  function lit(sky, c, amount) {
    const base = mixColor(rgb(c), sky.amb, amount === undefined ? 0.18 : amount);
    return hex(mixColor(base, rgb('#10131e'), sky.night * 0.68));
  }

  // ---- shapes ------------------------------------------------------------

  // Height of the main ridge crest at x: rising from lower left to upper right.
  function crest(g, x) {
    const u = x / g.W;
    return g.H * (0.72 - 0.4 * u) + Math.sin(u * 9 + 0.6) * g.H * 0.032 + Math.sin(u * 23) * g.H * 0.01
      + (fbm(x * 0.03, 3, 3, 8) - 0.5) * g.U * 1.6;
  }

  function farRidge(g, x, k) {
    const u = x / g.W;
    return g.H * (0.5 - 0.12 * k) + Math.sin(u * (5 + k * 3) + k * 2) * g.H * (0.06 - k * 0.012)
      + (fbm(x * 0.02, k * 7, 4, 17) - 0.5) * g.H * 0.08;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
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
    paintOrb(ctx, g, sky);
    return c;
  }

  function paintOrb(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const px = g.W * (0.12 + 0.5 * t);
    const py = g.H * (0.3 - 0.2 * Math.sin(Math.PI * t));
    const r = g.U * (night ? 3.2 : 3.8);
    const halo = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
    halo.addColorStop(0, night ? 'rgba(220,226,240,0.28)' : 'rgba(250,224,170,0.4)');
    halo.addColorStop(1, 'rgba(250,224,170,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px - r * 5, py - r * 5, r * 10, r * 10);
    ctx.fillStyle = night ? '#e4e4da' : '#f3dfae';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 6.3);
    ctx.fill();
  }

  // ---- far ridges --------------------------------------------------------

  function paintFar(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let k = 2; k >= 0; k--) {
      const tone = mixColor(mixColor(rgb('#5d6f8a'), sky.haze, 0.55), sky.low, 0.15 + k * 0.2);
      ctx.fillStyle = hex(mixColor(tone, rgb('#141828'), sky.night * 0.6));
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, farRidge(g, x, k) + k * g.U * 2);
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
    return c;
  }

  // ---- main ridge, wall and towers ----------------------------------------

  function paintSlope(ctx, g, sky, rand) {
    const top = lit(sky, '#5a6248');
    const low = lit(sky, '#2f3a2e');
    const grad = ctx.createLinearGradient(0, g.H * 0.3, 0, g.H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, low);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, crest(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    // Rock bands, then maple and pine crowns below the crest.
    ctx.fillStyle = lit(sky, '#6d6a60');
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      ctx.fillRect(x, crest(g, x) + g.U * (2 + rand() * 10), g.U * (1 + rand() * 3), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
    const count = Math.floor(g.W * 2.2);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const depth = rand();
      const y = crest(g, x) + g.U * 3 + Math.pow(depth, 1.6) * (g.H - crest(g, x));
      const pine = rand() < 0.3;
      const ink = pine ? ['#3d5238', '#2f4430'][i % 2] : LEAF_INK[Math.floor(rand() * LEAF_INK.length)];
      ctx.fillStyle = lit(sky, ink, 0.12);
      ctx.beginPath();
      ctx.arc(x, y, g.U * (0.8 + rand() * 1.0 + depth * 1.6), 0, 6.3);
      ctx.fill();
    }
    // A few bare grey trunks and pale grass dashes in the lowest slope.
    ctx.fillStyle = lit(sky, '#8a8366');
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 40; i++) ctx.fillRect(rand() * g.W, g.H * (0.82 + rand() * 0.18), g.U * 1.2, 1);
    ctx.globalAlpha = 1;
  }

  function paintWall(ctx, g, sky) {
    const wh = g.U * 4.4;
    const stone = lit(sky, '#8e8c82', 0.2);
    const shade = lit(sky, '#5c5a56', 0.2);
    const cap = lit(sky, '#b4b0a2', 0.22);
    const step = Math.max(1, Math.round(g.U * 0.5));
    let n = 0;
    for (let x = 0; x < g.W; x += step, n++) {
      const y = crest(g, x);
      const y2 = crest(g, x + step);
      const lo = Math.max(y, y2);
      ctx.fillStyle = shade;
      ctx.fillRect(x, y - wh * 0.4, step, lo - y + wh * 0.4 + wh * 0.45);
      ctx.fillStyle = stone;
      ctx.fillRect(x, y - wh * 0.4, step, lo - y + wh * 0.7);
      ctx.fillStyle = cap;
      ctx.fillRect(x, y - wh * 0.45, step, Math.max(1, g.U * 0.35));
      if (n % 2 === 0) {
        ctx.fillStyle = stone;
        ctx.fillRect(x, y - wh * 0.4 - Math.max(1, g.U * 0.8), step, Math.max(1, g.U * 0.8) + 1);
        ctx.fillStyle = cap;
        ctx.fillRect(x, y - wh * 0.4 - Math.max(1, g.U * 0.8), step, 1);
      }
    }
  }

  function paintTower(ctx, g, sky, cx) {
    const U = g.U;
    const w = U * 8;
    const h = U * 9;
    const base = crest(g, cx) + U * 1.2;
    const x0 = cx - w / 2;
    const stone = lit(sky, '#98958a', 0.2);
    const edge = lit(sky, '#66645e', 0.2);
    const dark = lit(sky, '#1f2128', 0.1);
    ctx.fillStyle = stone;
    ctx.fillRect(x0, base - h, w, h);
    ctx.fillStyle = edge;
    ctx.fillRect(x0 + w * 0.72, base - h, w * 0.28, h);
    ctx.fillStyle = lit(sky, '#b8b4a4', 0.22);
    ctx.fillRect(x0 - U * 0.4, base - h, w + U * 0.8, Math.max(1, U * 0.55));
    // Crenellations along the top.
    const merlon = Math.max(1, U * 0.7);
    ctx.fillStyle = stone;
    for (let mx = x0 - U * 0.4; mx < x0 + w + U * 0.4; mx += merlon * 2) ctx.fillRect(mx, base - h - merlon, merlon, merlon + 1);
    // Arched windows.
    ctx.fillStyle = dark;
    for (let k = 0; k < 2; k++) {
      const wx = x0 + w * (0.2 + k * 0.4);
      ctx.fillRect(wx, base - h * 0.7, w * 0.18, h * 0.3);
      ctx.beginPath();
      ctx.arc(wx + w * 0.09, base - h * 0.7, w * 0.09, Math.PI, 0);
      ctx.fill();
    }
    // Small tiled room with up-curved eaves.
    const rw = w * 0.62;
    const rx = cx - rw / 2;
    const rt = base - h - merlon;
    ctx.fillStyle = lit(sky, '#a8a396', 0.2);
    ctx.fillRect(rx, rt - U * 1.8, rw, U * 1.8);
    ctx.fillStyle = lit(sky, '#b8472e', 0.12);
    ctx.fillRect(rx + rw * 0.12, rt - U * 1.3, rw * 0.76, U * 0.9);
    const tile = lit(sky, '#3b4048', 0.12);
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(rx - U * 1.4, rt - U * 2.9);
    ctx.quadraticCurveTo(rx + U * 0.2, rt - U * 1.7, rx + U * 0.6, rt - U * 1.8);
    ctx.lineTo(rx + rw - U * 0.6, rt - U * 1.8);
    ctx.quadraticCurveTo(rx + rw - U * 0.2, rt - U * 1.7, rx + rw + U * 1.4, rt - U * 2.9);
    ctx.lineTo(cx, rt - U * 4.4);
    ctx.fill();
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSlope(ctx, g, sky, rand);
    paintWall(ctx, g, sky);
    for (const f of TOWERS) paintTower(ctx, g, sky, g.W * f);
    // Foreground maples crowd the lower left and right corners.
    for (let i = 0; i < 46; i++) {
      const left = i % 2 === 0;
      const x = left ? rand() * g.W * 0.22 : g.W * (0.8 + rand() * 0.2);
      const y = g.H * (0.86 + rand() * 0.14);
      ctx.fillStyle = lit(sky, LEAF_INK[Math.floor(rand() * LEAF_INK.length)], 0.1);
      ctx.beginPath();
      ctx.arc(x, y, g.U * (2 + rand() * 2.4), 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  // ---- sprites -----------------------------------------------------------

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const dens = (x, y) => fbm(x * 0.012, y * 0.05, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(dens(x, y), dens(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 232;
        img.data[i + 1] = 234;
        img.data[i + 2] = 236;
        img.data[i + 3] = smoothstep(0.36, 0.62, v) * band * 210;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(24, 24);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    grad.addColorStop(0, 'rgba(226,224,216,0.55)');
    grad.addColorStop(1, 'rgba(226,224,216,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 24);
    return c;
  }

  function paintLeaf(ink) {
    const c = layer(7, 5);
    const ctx = c.getContext('2d');
    ctx.fillStyle = ink;
    ctx.fillRect(1, 1, 5, 3);
    ctx.fillRect(0, 2, 7, 1);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.far = paintFar(g, sky);
    state.front = paintFront(g, sky, rand);
    state.mistAlpha = 0.7 - sky.night * 0.45;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount, which) {
    if (amount <= 0) return;
    const c = state.mist[which];
    const speed = which === 0 ? 2.4 : 4;
    const off = -((t * g.U * speed) % c.width);
    const y = which === 0 ? g.H * 0.4 : g.H * 0.58;
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount * (which === 0 ? 0.9 : 1));
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // A thin beacon smoke from the highest tower.
  function drawSmoke(ctx, g, t) {
    const sx = g.W * TOWERS[3];
    const sy = crest(g, sx) - g.U * 12;
    for (let i = 0; i < MAX_SMOKE; i++) {
      const a = (t * 0.06 + i / MAX_SMOKE) % 1;
      const size = g.U * (1.4 + a * 5);
      ctx.globalAlpha = (1 - a) * 0.7 * (1 - state.dim * 0.4);
      ctx.drawImage(state.puff, sx + Math.sin(t * 0.5 + i) * g.U * 0.5 + a * g.U * 4 - size / 2, sy - a * g.H * 0.18 - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t) {
    for (let i = 0; i < MAX_LEAVES; i++) {
      const a = (t * 0.07 + i * 0.37) % 1;
      const lx = ((i * 0.173 + 0.05) % 1) * g.W + a * g.W * 0.12 + Math.sin(t * 0.9 + i * 2) * g.U * 1.5;
      const ly = g.H * (0.25 + a * 0.7);
      ctx.globalAlpha = 0.85 * Math.min(1, a * 6) * (1 - state.dim * 0.4);
      ctx.drawImage(state.leaf[i % state.leaf.length], lx, ly);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.mist = [paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22), 23), paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2), 61)];
    state.puff = paintPuff();
    state.leaf = LEAF_INK.map(paintLeaf);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    drawMist(ctx, g, t, props.mist, 0);
    ctx.drawImage(state.front, 0, 0);
    drawSmoke(ctx, g, t);
    drawMist(ctx, g, t, props.mist, 1);
    if (props.leaves) drawLeaves(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, leaves: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
