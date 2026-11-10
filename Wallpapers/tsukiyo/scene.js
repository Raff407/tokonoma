/*
 * 月夜 Tsukiyo — a moonlit pine coast.
 *
 * Sky, sea, island and headland are baked into layers and repainted once a
 * minute from the clock. Between repaints only a cloud, the moon's glitter
 * and a few wave lines move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.5;
  const ISLAND_X = 0.64;
  const RETINT_SECONDS = 60;
  const GLINTS = 150;
  const WAVES = 96;
  const SWELLS = 7;
  const FOAM = 22;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Moon sits on an arc across the sky, low in the east and west.
  function moonPos(g, h) {
    const t = K.clamp(((h - 19 + 24) % 24) / 11, 0, 1);
    return { x: g.W * lerp(0.82, 0.18, t), y: g.H * (0.34 - 0.2 * Math.sin(t * Math.PI)) };
  }

  function sunPos(g, h) {
    const t = S.sunT(h);
    return { x: g.W * lerp(0.15, 0.85, t), y: g.H * (0.4 - 0.28 * Math.sin(t * Math.PI)) };
  }

  function glow(ctx, x, y, r, col, a) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${col},${a})`);
    grad.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---- sky and sea -------------------------------------------------------

  function paintSky(g, sky, rand, moon, sun) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hz = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, 0, 0, hz);
    grad.addColorStop(0, hex(mixColor(sky.top, rgb('#2c3b6c'), sky.night * 0.85)));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#7488b4'), sky.night * 0.8)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, hz + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.35; i++) {
        ctx.globalAlpha = sky.night * (0.12 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * hz * 0.8, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (sky.night > 0.5) {
      glow(ctx, moon.x, moon.y, g.U * 34, '226,230,220', 0.55 * sky.night);
      glow(ctx, moon.x, moon.y, g.U * 11, '240,240,228', 0.5 * sky.night);
      ctx.fillStyle = '#ecebdc';
      ctx.beginPath();
      ctx.arc(moon.x, moon.y, g.U * 5.4, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = 'rgba(150,152,150,0.35)';
      ctx.beginPath();
      ctx.arc(moon.x - g.U * 1.2, moon.y - g.U * 0.8, g.U * 0.9, 0, 6.3);
      ctx.arc(moon.x + g.U * 1.3, moon.y + g.U * 1.0, g.U * 0.6, 0, 6.3);
      ctx.fill();
    } else if (sky.hour > 6 && sky.hour < 19.5) {
      glow(ctx, sun.x, sun.y, g.U * 14, '255,236,200', 0.3);
      ctx.fillStyle = '#f6e6c0';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, g.U * 3.2, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  function paintSea(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hz = g.H * HORIZON;
    const far = mixColor(sky.low, rgb('#6a84b2'), 0.35 + sky.night * 0.5);
    const near = mixColor(rgb('#2e4a78'), rgb('#22385e'), sky.night * 0.8);
    const grad = ctx.createLinearGradient(0, hz, 0, g.H);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.fillRect(0, hz, g.W, g.H - hz);
    ctx.fillStyle = hex(mixColor(rgb(hex(sky.low)), rgb('#e8ecf0'), 0.35));
    ctx.fillRect(0, hz, g.W, 1);
    if (state.lightX !== undefined) {
      const span = g.H - hz;
      ctx.save();
      ctx.translate(state.lightX, hz);
      ctx.scale(1, span / (g.U * 26));
      glow(ctx, 0, g.U * 8, g.U * 26, '210,220,230', 0.32 * (state.night > 0.5 ? 1 : 0.6));
      ctx.restore();
    }
    return c;
  }

  function paintCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const e = Math.sin((x / w) * Math.PI);
        const v = fbm(x * 0.03, y * 0.09, 4, 17);
        const i = (y * w + x) * 4;
        img.data[i] = 222;
        img.data[i + 1] = 226;
        img.data[i + 2] = 232;
        img.data[i + 3] = smoothstep(0.36, 0.58, v) * band * e * 245;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- island and headland ----------------------------------------------

  function ink(sky, base, k) {
    return hex(mixColor(mixColor(rgb(base), sky.haze, 0.15), rgb('#04060e'), k * sky.night));
  }

  // A pine drawn as a leaning trunk with flat cloud-pruned tufts.
  function paintPine(ctx, g, sky, px, py, s, lean, rand) {
    const trunk = ink(sky, '#2a2420', 0.5);
    const leaf = ink(sky, '#2c4636', 0.55);
    ctx.strokeStyle = trunk;
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + lean * s * 2, py - s * 4, px + lean * s * 0.6, py - s * 9);
    ctx.stroke();
    ctx.fillStyle = leaf;
    const tufts = [
      [0.6 * lean, -9.2, 4.2, 1.15], [-3.2, -6.6, 3.4, 0.95], [3.6 * Math.sign(lean || 1), -4.6, 3.6, 0.95],
      [-1.2, -3.0, 2.8, 0.8],
    ];
    for (const t of tufts) {
      const cx = px + t[0] * s;
      const cy = py + t[1] * s;
      ctx.beginPath();
      ctx.ellipse(cx, cy, t[2] * s, t[3] * s, 0, 0, 6.3);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + (rand() - 0.5) * s, cy - t[3] * s * 0.6, t[2] * s * 0.6, t[3] * s * 0.7, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.strokeStyle = trunk;
    ctx.lineWidth = Math.max(1, s * 0.25);
    ctx.beginPath();
    ctx.moveTo(px + lean * s * 1.2, py - s * 5.5);
    ctx.lineTo(px - 2.6 * s, py - s * 6.4);
    ctx.moveTo(px + lean * s * 1.4, py - s * 4.6);
    ctx.lineTo(px + 3.2 * s, py - s * 4.6);
    ctx.stroke();
  }

  function paintRockIsland(ctx, g, sky, rand) {
    const cx = g.W * ISLAND_X;
    const hz = g.H * HORIZON;
    const rock = ink(sky, '#3c4658', 0.6);
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(cx - g.U * 11, hz + 1);
    ctx.quadraticCurveTo(cx - g.U * 8, hz - g.U * 4, cx - g.U * 3, hz - g.U * 5.5);
    ctx.quadraticCurveTo(cx + g.U * 1, hz - g.U * 7, cx + g.U * 4, hz - g.U * 4.5);
    ctx.quadraticCurveTo(cx + g.U * 9, hz - g.U * 3, cx + g.U * 12, hz + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ink(sky, '#2a3244', 0.7);
    ctx.beginPath();
    ctx.ellipse(cx + g.U * 15, hz, g.U * 3.2, g.U * 1.6, 0, Math.PI, 0);
    ctx.fill();
    paintPine(ctx, g, sky, cx - g.U * 0.5, hz - g.U * 5.4, g.U * 1.3, 0.5, rand);
    // wet rim and a soft reflection under the rock
    ctx.fillStyle = 'rgba(190,200,215,0.16)';
    ctx.fillRect(cx - g.U * 10, hz + g.U * 0.8, g.U * 20, 1);
  }

  function paintHeadland(ctx, g, sky, rand) {
    const rock = ink(sky, '#2e3846', 0.6);
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.55);
    ctx.quadraticCurveTo(g.W * 0.1, g.H * 0.57, g.W * 0.17, g.H * 0.68);
    ctx.quadraticCurveTo(g.W * 0.21, g.H * 0.76, g.W * 0.25, g.H * 0.86);
    ctx.quadraticCurveTo(g.W * 0.2, g.H * 0.93, g.W * 0.1, g.H * 0.97);
    ctx.lineTo(0, g.H);
    ctx.closePath();
    ctx.fill();
    // moonlit upper edge
    ctx.strokeStyle = `rgba(206,216,228,${0.22 + sky.night * 0.2})`;
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.55);
    ctx.quadraticCurveTo(g.W * 0.1, g.H * 0.57, g.W * 0.17, g.H * 0.68);
    ctx.quadraticCurveTo(g.W * 0.21, g.H * 0.76, g.W * 0.25, g.H * 0.86);
    ctx.stroke();
    paintPine(ctx, g, sky, g.W * 0.06, g.H * 0.565, g.U * 2.4, 0.8, rand);
    paintPine(ctx, g, sky, g.W * 0.13, g.H * 0.62, g.U * 1.7, 1.0, rand);
    paintPine(ctx, g, sky, g.W * 0.025, g.H * 0.57, g.U * 1.4, -0.5, rand);
    // shore rocks
    ctx.fillStyle = rock;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(g.W * (0.23 + rand() * 0.07), g.H * (0.84 + rand() * 0.1), g.U * (1.2 + rand() * 1.6), g.U * (0.7 + rand() * 0.7), 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRockIsland(ctx, g, sky, rand);
    paintHeadland(ctx, g, sky, rand);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    const moon = moonPos(g, sky.hour);
    const sun = sunPos(g, sky.hour);
    state.night = sky.night;
    state.lightX = sky.night > 0.5 ? moon.x : sun.x;
    state.sky = paintSky(g, sky, rand, moon, sun);
    state.sea = paintSea(g, sky);
    state.front = paintFront(g, sky, rand);
    state.lit = sky.night > 0.5 || (sky.hour > 6 && sky.hour < 19.5);
    state.cloudAlpha = 0.85;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawCloud(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.cloud;
    const span = g.W + c.width;
    const off = ((t * g.U * 3) % span) - c.width;
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.08);
    ctx.drawImage(c, ((t * g.U * 1.5 + span * 0.5) % span) - c.width, g.H * 0.26, c.width * 0.8, c.height * 0.8);
    ctx.globalAlpha = 1;
  }

  // Long swell bands roll slowly toward the shore.
  function drawSwells(ctx, g, t) {
    const hz = g.H * HORIZON;
    const span = g.H - hz;
    ctx.fillStyle = '#c4d2e6';
    for (let i = 0; i < SWELLS; i++) {
      const f = ((i + t * 0.05) % SWELLS) / SWELLS;
      const d = f * f;
      const y = hz + g.U + d * (span - g.U);
      ctx.globalAlpha = 0.1 * Math.sin(f * Math.PI);
      ctx.fillRect(0, y, g.W, Math.max(1, g.U * (0.6 + d * 4)));
    }
    ctx.globalAlpha = 1;
  }

  // Wave lines travel sideways and breathe; positions come from fixed seeds.
  function drawWaves(ctx, g, t) {
    const hz = g.H * HORIZON;
    ctx.fillStyle = '#d6e0ee';
    for (let i = 0; i < WAVES; i++) {
      const w = state.waves[i];
      const depth = w.d * w.d;
      const y = hz + g.U * 1.2 + depth * (g.H - hz - g.U * 2) + Math.sin(t * 0.6 + w.p) * g.U * (0.3 + depth);
      const len = g.U * (3 + depth * 14);
      const span = g.W + len;
      const x = ((w.x * span + t * g.U * (0.6 + depth * 2.4)) % span) - len;
      ctx.globalAlpha = (0.3 + 0.4 * depth) * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.7 + w.p)));
      ctx.fillRect(x, y, len, Math.max(1, g.U * depth * 0.6));
    }
    ctx.globalAlpha = 1;
  }

  // Silver dashes in a column under the moon; a shimmer runs down the path.
  function drawGlitter(ctx, g, t) {
    if (!state.lit) return;
    const hz = g.H * HORIZON;
    const span = g.H - hz;
    ctx.fillStyle = state.night > 0.5 ? '#eef0e4' : '#f6eed6';
    const strength = state.night > 0.5 ? 1 : 0.6;
    for (let i = 0; i < GLINTS; i++) {
      const q = state.glints[i];
      const f = q.f;
      const y = hz + g.U * 0.6 + f * f * (span - g.U);
      const spread = g.U * (2.5 + f * 16);
      const x = state.lightX + (q.o - 0.5) * 2 * spread + Math.sin(t * 0.7 + q.p) * g.U * (0.5 + f);
      const wave = 0.5 + 0.5 * Math.sin(t * 1.6 - f * 14 + q.p);
      const len = g.U * (2 + f * 10) * (0.4 + 0.6 * wave);
      const edge = 1 - Math.abs(q.o - 0.5) * 1.4;
      ctx.globalAlpha = strength * (0.2 + 0.8 * wave * wave) * edge;
      ctx.fillRect(x - len / 2, y, len, Math.max(1, g.U * (0.4 + f * 0.6)));
    }
    ctx.globalAlpha = 1;
  }

  // Foam breathes along the foot of the headland.
  function drawFoam(ctx, g, t) {
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < FOAM; i++) {
      const q = state.foam[i];
      const k = 0.5 + 0.5 * Math.sin(t * 0.9 + q.p);
      const x = g.W * (0.17 + q.o * 0.16) + k * g.U * 1.5;
      const y = g.H * (0.72 + q.o * 0.22) + q.d * g.U * 2;
      ctx.globalAlpha = 0.15 + 0.5 * k;
      ctx.fillRect(x, y, g.U * (1.5 + q.d * 3) * (0.5 + k), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(9);
    state.cloud = paintCloud(Math.ceil(g.W * 0.45), Math.ceil(g.H * 0.18));
    state.waves = Array.from({ length: WAVES }, () => ({ x: rand(), d: rand(), p: rand() * 6.3 }));
    state.glints = Array.from({ length: GLINTS }, () => ({ f: rand(), o: rand(), p: rand() * 6.3 }));
    state.foam = Array.from({ length: FOAM }, () => ({ o: rand(), d: rand(), p: rand() * 6.3 }));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawCloud(ctx, g, t, props.clouds);
    ctx.drawImage(state.sea, 0, 0);
    drawSwells(ctx, g, t);
    drawWaves(ctx, g, t);
    if (props.glitter) drawGlitter(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawFoam(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, glitter: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
