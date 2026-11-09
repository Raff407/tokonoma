/*
 * 夕焼け Yuyake — a crimson sunset over a harbour town.
 *
 * Two skies (early and late sunset) are baked and cross-faded slowly. Sea, hills,
 * tiled roofs, pagoda, torii and moored masts are baked once and again each minute.
 * Between repaints only clouds, sun glints, three boats and a few swallows move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.58;
  const QUAY = 0.63;
  const SUN = { x: 0.62, y: 0.5 };
  const RETINT_SECONDS = 60;
  const FADE_RATE = 0.05;
  const GLINTS = 14;
  const BIRDS = 7;
  const TAU = Math.PI * 2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function palette(sky) {
    return {
      sil: mixColor(rgb('#241e30'), sky.low, 0.12),
      far: mixColor(rgb('#4a3a58'), sky.low, 0.45),
      tile: mixColor(rgb('#2c2538'), sky.low, 0.22),
      post: mixColor(mixColor(rgb('#c4482c'), rgb('#241e30'), 0.1 + sky.night * 0.4), sky.amb, 0.1),
    };
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, hour) {
    const sky = S.at(hour);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const glow = 1 - sky.night;
    const low = mixColor(sky.low, rgb('#d0402c'), 0.5 * glow);
    const mid = mixColor(mixColor(sky.top, low, 0.55), rgb('#8a3040'), 0.2 * glow);
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(0.55, hex(mid));
    grad.addColorStop(1, hex(low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (glow > 0.05) {
      const sx = g.W * SUN.x;
      const sy = g.H * SUN.y;
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, g.U * 42);
      halo.addColorStop(0, `rgba(240,150,90,${0.7 * glow})`);
      halo.addColorStop(1, 'rgba(240,150,90,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, g.W, g.H * HORIZON);
      ctx.fillStyle = hex(mixColor(rgb('#e4573a'), rgb('#f2b27a'), 0.25));
      ctx.globalAlpha = Math.min(1, glow * 1.4);
      ctx.beginPath();
      ctx.arc(sx, sy, g.U * 6.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (sky.night > 0.3) {
      const rand = K.rng(7);
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.09, 4, 17);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = K.lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 140;
        img.data[i + 2] = 120;
        img.data[i + 3] = smoothstep(0.5, 0.68, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- sea and hills -----------------------------------------------------

  function paintBase(g, sky, pal) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * HORIZON;
    const seaTop = mixColor(sky.low, rgb('#3a3050'), 0.4);
    const seaLow = mixColor(rgb('#1c2040'), sky.low, 0.08);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(seaTop));
    grad.addColorStop(1, hex(seaLow));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = hex(pal.far);
    for (let x = 0; x < g.W; x++) {
      const bump = fbm(x / (g.U * 22), 1.7, 3, 29);
      const rise = Math.max(0, bump - 0.35) * g.H * 0.22;
      const edge = smoothstep(0.7, 0.95, x / g.W) * g.H * 0.05;
      const h = rise + edge;
      if (h > 0.5) ctx.fillRect(x, top - h, 1, h + 1);
    }
    return c;
  }

  // ---- town --------------------------------------------------------------

  // Hip roof with eaves lifted at the corners, and two lighter tile rows.
  function roof(ctx, g, pal, cx, y, w, h) {
    const e = g.u * 1.4;
    ctx.fillStyle = hex(pal.tile);
    poly(ctx, [cx - w / 2 - e, y - g.u * 0.5, cx - w / 2, y, cx + w / 2, y, cx + w / 2 + e, y - g.u * 0.5, cx + w * 0.22, y - h, cx - w * 0.22, y - h]);
    ctx.fillStyle = hex(mixColor(pal.tile, rgb('#d8c9a8'), 0.14));
    for (let k = 1; k <= 2; k++) {
      const yy = y - (h * k) / 3;
      ctx.fillRect(cx - w * (0.5 - 0.09 * k), yy, w * (1 - 0.18 * k), 1);
    }
    ctx.fillStyle = hex(pal.sil);
    ctx.fillRect(cx - w * 0.22 - g.u * 0.5, y - h - g.u * 0.7, g.u * 0.9, g.u * 0.9);
    ctx.fillRect(cx + w * 0.22 - g.u * 0.4, y - h - g.u * 0.7, g.u * 0.9, g.u * 0.9);
  }

  function paintPagoda(ctx, g, pal, cx, base) {
    let y = base;
    ctx.fillStyle = hex(pal.sil);
    for (let k = 0; k < 3; k++) {
      const w = g.u * (10 - k * 2);
      ctx.fillRect(cx - w / 2, y - g.u * 4.2, w, g.u * 4.2);
      roof(ctx, g, pal, cx, y - g.u * 4.2, w * 1.5, g.u * 2.6);
      y -= g.u * 6.6;
    }
    ctx.fillStyle = hex(pal.sil);
    ctx.fillRect(cx - 0.5, y - g.u * 6, Math.max(1, g.u * 0.45), g.u * 6);
    for (let k = 0; k < 3; k++) ctx.fillRect(cx - g.u * 1, y - g.u * (1.5 + k * 1.4), g.u * 2, Math.max(1, g.u * 0.35));
  }

  function paintTown(ctx, g, sky, pal, rand) {
    const base = g.H * QUAY;
    paintPagoda(ctx, g, pal, g.W * 0.2, base - g.u * 3);
    const glow = 0.45 + sky.night * 0.5;
    let x = -g.u * 2;
    while (x < g.W * 0.4) {
      const w = g.u * (7 + rand() * 4);
      const wall = g.u * (4 + rand() * 1.6);
      const cx = x + w / 2;
      ctx.fillStyle = hex(pal.sil);
      ctx.fillRect(x, base - wall, w, wall);
      roof(ctx, g, pal, cx, base - wall, w, g.u * (3 + rand() * 1.2));
      ctx.fillStyle = '#e0b058';
      ctx.globalAlpha = glow;
      for (let k = 0; k < 2; k++) if (rand() > 0.35) ctx.fillRect(x + w * (0.22 + k * 0.4), base - wall * 0.7, Math.max(1, g.u * 1.1), Math.max(1, g.u * 1.1));
      ctx.globalAlpha = 1;
      x += w + g.u * (0.4 + rand() * 1.2);
    }
    ctx.fillStyle = hex(pal.sil);
    ctx.fillRect(0, base, g.W * 0.47, g.H * 0.05);
    ctx.fillStyle = hex(mixColor(pal.sil, sky.low, 0.2));
    ctx.fillRect(0, base, g.W * 0.47, 1);
    ctx.fillStyle = '#b8402c';
    for (let i = 0; i < 6; i++) ctx.fillRect(g.W * (0.03 + i * 0.07), base + g.u * 1.5, Math.max(1, g.u * 0.9), Math.max(1, g.u * 1.2));
  }

  function paintMasts(ctx, g, pal, rand) {
    const base = g.H * (QUAY + 0.012);
    ctx.fillStyle = hex(pal.sil);
    for (let i = 0; i < 9; i++) {
      const x = g.W * (0.4 + i * 0.012) + rand() * g.u;
      const h = g.u * (11 + rand() * 9);
      ctx.fillRect(x, base - h, Math.max(1, g.u * 0.4), h);
      ctx.fillRect(x - g.u * 1.6, base - h * (0.55 + rand() * 0.2), g.u * 3.4, Math.max(1, g.u * 0.35));
      poly(ctx, [x - g.u * 2.6, base, x + g.u * 3, base, x + g.u * 2, base + g.u * 1.4, x - g.u * 1.6, base + g.u * 1.4]);
    }
  }

  function paintTorii(ctx, g, pal) {
    const cx = g.W * 0.8;
    const base = g.H * 0.69;
    const span = g.u * 18;
    const top = base - g.u * 17;
    const pw = Math.max(1.5, g.u * 1.7);
    ctx.fillStyle = hex(pal.post);
    ctx.fillRect(cx - span / 2, top, pw, base - top);
    ctx.fillRect(cx + span / 2 - pw, top, pw, base - top);
    ctx.fillRect(cx - span / 2 - g.u * 1.5, top + g.u * 5, span + g.u * 3, Math.max(1, g.u * 1.1));
    poly(ctx, [cx - span / 2 - g.u * 4.2, top - g.u * 1.6, cx - span / 2 - g.u * 1.2, top + g.u * 0.3, cx + span / 2 + g.u * 1.2, top + g.u * 0.3, cx + span / 2 + g.u * 4.2, top - g.u * 1.6, cx + span / 2 + g.u * 3.2, top + g.u * 0.4, cx, top + g.u * 1.1, cx - span / 2 - g.u * 3.2, top + g.u * 0.4]);
    ctx.fillStyle = hex(pal.sil);
    ctx.fillRect(cx - span / 2 - g.u * 0.6, base - g.u * 0.7, pw + g.u * 1.2, g.u * 1.2);
    ctx.fillRect(cx + span / 2 - pw - g.u * 0.6, base - g.u * 0.7, pw + g.u * 1.2, g.u * 1.2);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = hex(pal.post);
    ctx.fillRect(cx - span / 2, base + g.u, pw, g.u * 6);
    ctx.fillRect(cx + span / 2 - pw, base + g.u, pw, g.u * 6);
    ctx.globalAlpha = 1;
  }

  function paintFront(g, sky, pal) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(31);
    paintTown(ctx, g, sky, pal, rand);
    paintMasts(ctx, g, pal, rand);
    paintTorii(ctx, g, pal);
    return c;
  }

  function paintBoat(g, pal, s) {
    const u = g.u * s;
    const w = Math.ceil(u * 16);
    const h = Math.ceil(u * 22);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const deck = h - u * 3;
    ctx.fillStyle = hex(pal.sil);
    poly(ctx, [cx - u * 7, deck - u * 1.2, cx + u * 7, deck - u * 1.2, cx + u * 4.5, h, cx - u * 4.5, h]);
    ctx.fillRect(cx - 0.5, 0, Math.max(1, u * 0.5), deck);
    ctx.fillRect(cx - u * 3.5, deck - u * 12, u * 7, Math.max(1, u * 0.4));
    ctx.fillStyle = hex(mixColor(rgb('#c9b79a'), pal.sil, 0.45));
    poly(ctx, [cx + u * 0.6, u * 2, cx + u * 0.6, deck - u * 2, cx + u * 5.5, deck - u * 2]);
    ctx.fillStyle = '#e0b058';
    ctx.fillRect(cx - u * 6, deck - u * 2.6, Math.max(1, u * 0.9), Math.max(1, u * 0.9));
    return c;
  }

  function repaint(g, choice) {
    const dusk = choice === 'dusk';
    const hA = dusk ? 17.0 : S.hour(choice);
    const hB = dusk ? 18.2 : hA;
    const sky = S.at(dusk ? 17.6 : hA);
    const pal = palette(sky);
    state.skyA = paintSky(g, hA);
    state.skyB = dusk ? paintSky(g, hB) : state.skyA;
    state.base = paintBase(g, sky, pal);
    state.front = paintFront(g, sky, pal);
    state.boats = [paintBoat(g, pal, 1), paintBoat(g, pal, 0.7), paintBoat(g, pal, 1.15)];
    state.glow = 1 - sky.night;
    state.cloudAlpha = 0.7 - sky.night * 0.55;
    state.choice = choice;
    state.dusk = dusk;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    if (state.glow < 0.05) return;
    const sx = g.W * SUN.x;
    const top = g.H * HORIZON;
    ctx.fillStyle = '#f0a868';
    for (let i = 0; i < GLINTS; i++) {
      const f = (i + 1) / GLINTS;
      const y = top + f * f * g.H * 0.3 + g.u * 0.5;
      const w = g.u * (3 + f * 14) * (0.6 + 0.4 * Math.sin(t * 1.1 + i * 2.3));
      const x = sx + Math.sin(t * 0.6 + i * 1.7) * g.u * (1 + f * 5) - w / 2;
      ctx.globalAlpha = state.glow * (0.65 - f * 0.4);
      ctx.fillRect(x, y, w, Math.max(1, g.u * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function drawBoats(ctx, g, t) {
    const spots = [[0.52, 0.715], [0.66, 0.665], [0.9, 0.79]];
    for (let i = 0; i < 3; i++) {
      const b = state.boats[i];
      const bob = Math.sin(t * 0.8 + i * 2.1) * g.u * 0.5;
      ctx.drawImage(b, g.W * spots[i][0] - b.width / 2, g.H * spots[i][1] - b.height + bob);
    }
  }

  function drawSwallows(ctx, g, t) {
    const span = g.W + g.u * 24;
    ctx.fillStyle = hex(state.birdInk);
    const wing = Math.max(1, g.u * 1.5);
    const th = Math.max(1, g.u * 0.5);
    for (let i = 0; i < BIRDS; i++) {
      const b = state.birds[i];
      const dir = i % 2 ? -1 : 1;
      const p = (b.x + dir * t * b.v) % span;
      const x = (p < 0 ? p + span : p) - g.u * 12;
      const y = g.H * b.y + Math.sin(t * 0.9 + b.ph) * g.u * 3;
      const flap = Math.sin(t * 11 + b.ph) > 0 ? 1 : -1;
      ctx.fillRect(x - wing, y - flap * th, wing, th);
      ctx.fillRect(x + wing * 0.2, y - flap * th, wing, th);
      ctx.fillRect(x - th, y, th * 2 + 1, th);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.u = g.U * Math.min(1, g.W / (g.U * 135));
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    const rand = K.rng(5);
    state.birds = [];
    for (let i = 0; i < BIRDS; i++) {
      state.birds.push({ x: rand() * (g.W + g.u * 24), y: 0.22 + rand() * 0.22, v: g.u * (4 + rand() * 3), ph: rand() * TAU });
    }
    state.birdInk = rgb('#241e30');
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.skyA, 0, 0);
    if (state.dusk) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * FADE_RATE);
      ctx.drawImage(state.skyB, 0, 0);
      ctx.globalAlpha = 1;
    }
    drawClouds(ctx, g, t);
    ctx.drawImage(state.base, 0, 0);
    drawGlints(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawBoats(ctx, g, t);
    if (props.swallows) drawSwallows(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dusk', swallows: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
