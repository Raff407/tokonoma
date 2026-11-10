/*
 * 三峡 Sanxia — a Yangtze gorge: layered ridges, steep cliffs, mist and one boat.
 *
 * Sky, ridges, cliffs and water are baked into layers and repainted once a
 * minute from the clock. Between repaints only mist bands, a few water glints
 * and the covered boat move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const WATER = 0.78;
  const RIDGES = 6;
  const RETINT_SECONDS = 60;
  const BOAT_SECONDS = 90;
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
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WATER);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#e8e4d6'), 0.25 * (1 - sky.night))));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.12 + rand() * 0.4);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    return c;
  }

  // Pale sun by day, moon by night, set between the far peaks.
  function paintLuminary(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const px = lerp(g.W * 0.3, g.W * 0.72, t);
    const py = g.H * (0.34 - 0.2 * Math.sin(Math.PI * t));
    const r = g.U * (night ? 3 : 3.6);
    const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
    const tint = night ? '214,220,236' : '250,236,206';
    glow.addColorStop(0, `rgba(${tint},${night ? 0.3 : 0.5})`);
    glow.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(px - r * 5, py - r * 5, r * 10, r * 10);
    ctx.fillStyle = night ? '#e8e8dc' : '#f6ecd0';
    ctx.globalAlpha = night ? 0.9 : 0.85;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- ridges ------------------------------------------------------------

  // Sharp peaks: ridged noise gives the pointed Wu Gorge summits.
  function ridgeY(g, i, x) {
    const d = i / (RIDGES - 1);
    const base = g.H * (0.46 + d * 0.3);
    const amp = g.H * (0.36 + d * 0.1);
    const n = fbm(x * (0.018 + d * 0.01), i * 7.3, 4, 40 + i);
    const sharp = 1 - Math.abs(2 * fbm(x * 0.03, i * 3.1, 3, 90 + i) - 1);
    return base - amp * (0.3 * n + 0.7 * Math.pow(sharp, 1.1)) * (0.9 + 0.3 * d);
  }

  function ridgeColor(sky, d) {
    const day = mixColor(rgb('#a9b7c4'), rgb('#27323f'), Math.pow(d, 0.9));
    const hazed = mixColor(day, sky.haze, (1 - d) * 0.55);
    return mixColor(hazed, rgb('#0d1120'), sky.night * (0.55 + d * 0.3));
  }

  function paintRidge(ctx, g, sky, i) {
    const d = i / (RIDGES - 1);
    const top = ridgeColor(sky, d);
    const foot = mixColor(top, mixColor(sky.low, rgb('#e6e2d6'), 0.5 * (1 - sky.night)), 0.7 - d * 0.3);
    const bottom = g.H * (WATER + 0.01);
    const grad = ctx.createLinearGradient(0, g.H * 0.2, 0, bottom);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(foot));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, ridgeY(g, i, x));
    ctx.lineTo(g.W, bottom);
    ctx.closePath();
    ctx.fill();
    paintStrata(ctx, g, i, top);
  }

  // Thin vertical ink strokes down the faces, like cun texture strokes.
  function paintStrata(ctx, g, i, tone) {
    const rand = K.rng(200 + i);
    ctx.strokeStyle = hex(tone.map((c) => c * 0.8));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.28;
    const count = Math.floor(g.W * 0.35);
    for (let k = 0; k < count; k++) {
      const x = rand() * g.W;
      const y0 = ridgeY(g, i, x) + g.U * (1 + rand() * 3);
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 0.8, y0 + g.U * (2 + rand() * 6));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // A small tiered pagoda on the third ridge, in ink with a touch of vermilion.
  function paintPagoda(ctx, g, sky) {
    const px = g.W * 0.64;
    const base = ridgeY(g, 2, px) + g.U * 0.6;
    const ink = mixColor(rgb('#4a5668'), sky.haze, 0.35);
    const dark = mixColor(ink, rgb('#0d1120'), sky.night * 0.7);
    ctx.fillStyle = hex(dark);
    const s = g.U * 0.9;
    for (let k = 0; k < 5; k++) {
      const w = s * (4.4 - k * 0.65);
      const y = base - k * s * 1.5;
      ctx.beginPath();
      ctx.moveTo(px - w, y);
      ctx.lineTo(px - w * 0.6, y - s * 0.45);
      ctx.lineTo(px + w * 0.6, y - s * 0.45);
      ctx.lineTo(px + w, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(px - w * 0.5, y - s * 1.3, w, s * 0.9);
    }
    ctx.fillRect(px - 0.5, base - 5 * s * 1.5 - s * 2, 1, s * 2);
    ctx.fillStyle = '#b8412c';
    ctx.globalAlpha = 0.6 * (1 - sky.night * 0.6);
    ctx.fillRect(px - s * 0.3, base - s * 1.2, s * 0.6, s * 0.8);
    ctx.globalAlpha = 1;
  }

  // ---- cliffs ------------------------------------------------------------

  // Left edge of the left cliff / right edge of the right cliff, steeper than any ridge.
  function cliffEdge(g, side, y) {
    const f = clamp(y / g.H, 0, 1);
    const n = (fbm(y * 0.05, side * 5, 3, 120 + side) - 0.5) * g.W * 0.07;
    if (side === 0) return g.W * (0.12 + 0.13 * Math.pow(f, 1.5)) + n;
    return g.W * (0.9 - 0.11 * Math.pow(f, 1.4)) - n;
  }

  function cliffTopY(g, side) {
    return g.H * (side === 0 ? 0.08 : 0.2);
  }

  function paintCliff(ctx, g, sky, side) {
    const tone = mixColor(mixColor(rgb('#2a3a34'), rgb('#161c2a'), 0.35), rgb('#080b16'), sky.night * 0.7);
    const lit = mixColor(tone, sky.amb, 0.18 * (1 - sky.night));
    const wy = g.H * (WATER + 0.02);
    const y0 = cliffTopY(g, side);
    const grad = ctx.createLinearGradient(0, y0, 0, wy);
    grad.addColorStop(0, hex(lit));
    grad.addColorStop(1, hex(tone));
    ctx.fillStyle = grad;
    const out = side === 0 ? -2 : g.W + 2;
    ctx.beginPath();
    ctx.moveTo(out, y0);
    for (let y = y0; y <= wy; y += 1) ctx.lineTo(cliffEdge(g, side, y), y);
    ctx.lineTo(out, wy);
    ctx.closePath();
    ctx.fill();
    paintCliffTexture(ctx, g, side, tone, y0, wy);
    paintPines(ctx, g, sky, side, y0, wy);
  }

  function paintCliffTexture(ctx, g, side, tone, y0, wy) {
    const rand = K.rng(300 + side);
    const dir = side === 0 ? 1 : -1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = hex(pass ? tone.map((c) => Math.min(255, c * 1.5 + 14)) : tone.map((c) => c * 0.55));
      ctx.globalAlpha = pass ? 0.18 : 0.4;
      for (let k = 0; k < 160; k++) {
        const y = y0 + rand() * (wy - y0);
        const edge = cliffEdge(g, side, y);
        const x = edge - dir * rand() * g.W * 0.12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dir * (rand() - 0.2) * g.U * 0.6, y + g.U * (2 + rand() * 7));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Flat-topped pines in clusters, as in a hanging scroll.
  function pine(ctx, x, y, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.25);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.3, y - s * 3);
    ctx.stroke();
    ctx.fillStyle = color;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(x + s * 0.3 + (k - 1) * s * 0.4, y - s * (2 + k * 0.9), s * (1.7 - k * 0.3), s * 0.5, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintPines(ctx, g, sky, side, y0, wy) {
    const rand = K.rng(400 + side);
    const color = hex(mixColor(mixColor(rgb('#35523a'), rgb('#1a2a22'), 0.4), rgb('#080c14'), sky.night * 0.8));
    const spots = side === 0 ? [0.0, 0.07, 0.34, 0.5, 0.7] : [0.02, 0.2, 0.42, 0.62];
    for (const f of spots) {
      const y = y0 + (wy - y0) * f + g.U * 2;
      const edge = cliffEdge(g, side, y);
      const s = g.U * (0.9 + rand() * 0.5);
      pine(ctx, edge + (side === 0 ? -g.U * 1.2 : g.U * 1.2), y, s, color);
      if (rand() > 0.4) pine(ctx, edge + (side === 0 ? -g.U * 4 : g.U * 4), y + g.U, s * 0.8, color);
    }
    // A cluster crowning each cliff top.
    for (let k = 0; k < 4; k++) {
      const x = side === 0 ? g.W * (0.01 + k * 0.035) : g.W * (0.93 + k * 0.022);
      pine(ctx, x, y0 + g.U * 1.5 + rand() * g.U * 2, g.U * (1 + rand() * 0.4), color);
    }
  }

  // ---- water -------------------------------------------------------------

  function paintWater(ctx, g, sky, rand) {
    const top = g.H * WATER;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    const near = mixColor(mixColor(rgb('#4e6b78'), rgb('#27384a'), 0.5), sky.low, 0.2);
    const far = mixColor(sky.low, rgb('#dfe0d6'), 0.35 * (1 - sky.night));
    grad.addColorStop(0, hex(mixColor(far, rgb('#0d1428'), sky.night * 0.7)));
    grad.addColorStop(1, hex(mixColor(near, rgb('#0a0f1e'), sky.night * 0.75)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#e4e8e4';
    for (let k = 0; k < g.W * 0.6; k++) {
      const f = rand();
      ctx.globalAlpha = (0.05 + rand() * 0.12) * (1 - sky.night * 0.6);
      ctx.fillRect(rand() * g.W, top + f * f * (g.H - top), 2 + rand() * g.U * 3, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- boat --------------------------------------------------------------

  // A wupeng boat: upturned ends, an arched woven canopy, a lantern at night.
  function paintBoat(g, sky) {
    const u = g.U * 1.5;
    const w = Math.ceil(u * 17);
    const h = Math.ceil(u * 8);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const hull = hex(mixColor(rgb('#2c2622'), rgb('#0a0c14'), sky.night * 0.6));
    const mat = hex(mixColor(mixColor(rgb('#6e5a3a'), sky.amb, 0.15), rgb('#14161e'), sky.night * 0.7));
    const base = h - u * 1.2;
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(u * 0.4, base - u * 2.2);
    ctx.quadraticCurveTo(u * 2, base, u * 5, base);
    ctx.lineTo(u * 12, base);
    ctx.quadraticCurveTo(u * 15, base, u * 16.6, base - u * 1.6);
    ctx.quadraticCurveTo(u * 14, base - u * 0.9, u * 12, base - u * 0.9);
    ctx.lineTo(u * 5, base - u * 0.9);
    ctx.quadraticCurveTo(u * 2.4, base - u * 1.1, u * 0.4, base - u * 2.2);
    ctx.fill();
    ctx.fillStyle = mat;
    ctx.beginPath();
    ctx.moveTo(u * 4.6, base - u * 0.9);
    ctx.quadraticCurveTo(u * 8, base - u * 5.4, u * 11.4, base - u * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1c1810';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) {
      const x = u * (4.6 + k * 1.15);
      ctx.beginPath();
      ctx.moveTo(x, base - u * 0.9);
      ctx.lineTo(x, base - u * (0.9 + 3.4 * Math.sin((k / 6) * Math.PI) * 0.95));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Steering oar at the stern.
    ctx.strokeStyle = hull;
    ctx.beginPath();
    ctx.moveTo(u * 15.4, base - u * 1.4);
    ctx.lineTo(u * 16.8, base + u * 0.9);
    ctx.stroke();
    if (sky.night > 0.35) {
      const lx = u * 3.3;
      const ly = base - u * 2.7;
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, u * 3);
      glow.addColorStop(0, `rgba(236,180,90,${0.7 * sky.night})`);
      glow.addColorStop(1, 'rgba(236,180,90,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - u * 3, ly - u * 3, u * 6, u * 6);
      ctx.fillStyle = '#c8452c';
      ctx.fillRect(lx - u * 0.35, ly - u * 0.5, u * 0.7, u * 1);
    }
    return c;
  }

  // ---- mist --------------------------------------------------------------

  // Soft low bands that tile sideways.
  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.09, 4, 61), fbm((x - w) * 0.012, y * 0.09, 4, 61), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 238;
        img.data[i + 2] = 238;
        img.data[i + 3] = smoothstep(0.36, 0.62, v) * band * 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function paintScenery(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < RIDGES; i++) {
      paintRidge(ctx, g, sky, i);
      if (i === 2) paintPagoda(ctx, g, sky);
    }
    return c;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWater(ctx, g, sky, rand);
    paintCliff(ctx, g, sky, 0);
    paintCliff(ctx, g, sky, 1);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.ridges = paintScenery(g, sky);
    state.front = paintFront(g, sky, rand);
    state.boatArt = paintBoat(g, sky);
    state.mistAlpha = 0.85 - sky.night * 0.3;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mist;
    const rows = [
      { y: 0.46, speed: 2.2, a: 0.8 },
      { y: 0.58, speed: 3.6, a: 1 },
      { y: 0.7, speed: 2.8, a: 0.9 },
    ];
    for (const r of rows) {
      const off = -((t * g.U * r.speed * 0.5) % m.width);
      ctx.globalAlpha = Math.min(1, state.mistAlpha * r.a * amount);
      ctx.drawImage(m, off, g.H * r.y);
      ctx.drawImage(m, off + m.width, g.H * r.y);
    }
    ctx.globalAlpha = 1;
  }

  // A handful of pale glints sliding over the water.
  function drawGlints(ctx, g, t) {
    const top = g.H * WATER;
    ctx.fillStyle = '#eef0ea';
    for (let k = 0; k < 14; k++) {
      const phase = (t * 0.06 * (0.6 + (k % 4) * 0.2) + k * 0.137) % 1;
      const y = top + (g.H - top) * (0.06 + ((k * 0.311) % 0.9));
      const x = (phase * 1.2 - 0.1) * g.W;
      ctx.globalAlpha = (0.25 + 0.2 * Math.sin(t * 0.9 + k * 2.1)) * (1 - state.dim * 0.4);
      ctx.fillRect(x, y, g.U * (2 + (k % 3)), 1);
    }
    ctx.globalAlpha = 1;
  }

  // The boat drifts downstream, left to right, along the middle of the river.
  function drawBoat(ctx, g, t) {
    const art = state.boatArt;
    const p = (t % BOAT_SECONDS) / BOAT_SECONDS;
    const x = lerp(g.W * 0.2, g.W * 0.8, p) - art.width / 2;
    const y = g.H * 0.875 - art.height + Math.sin(t * 0.8) * g.U * 0.25;
    const fade = smoothstep(0, 0.06, p) * (1 - smoothstep(0.94, 1, p));
    ctx.globalAlpha = fade;
    ctx.drawImage(art, x, y);
    ctx.globalAlpha = 0.25 * fade;
    ctx.fillStyle = '#10161f';
    ctx.fillRect(x + art.width * 0.1, g.H * 0.875 + g.U * 0.3, art.width * 0.8, Math.max(1, g.U * 0.5));
    ctx.globalAlpha = 0.22 * fade;
    ctx.fillStyle = '#eef0ea';
    const trail = (t * 6) % 3;
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(x - g.U * (1 + k * 2.4 + trail), g.H * 0.875 + g.U * (0.4 + k * 0.1), g.U * 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.ridges, 0, 0);
    drawMist(ctx, g, t, props.mist);
    ctx.drawImage(state.front, 0, 0);
    drawGlints(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
