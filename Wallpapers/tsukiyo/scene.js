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
  const GLINTS = 60;
  const WAVES = 44;
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
      glow(ctx, moon.x, moon.y, g.U * 30, '226,230,220', 0.45 * sky.night);
      ctx.fillStyle = '#ecebdc';
      ctx.beginPath();
      ctx.arc(moon.x, moon.y, g.U * 4.2, 0, 6.3);
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
    const far = mixColor(sky.low, rgb('#5a74a2'), 0.35 + sky.night * 0.5);
    const near = mixColor(rgb('#2a4470'), rgb('#1a2c52'), sky.night * 0.8);
    const grad = ctx.createLinearGradient(0, hz, 0, g.H);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.fillRect(0, hz, g.W, g.H - hz);
    ctx.fillStyle = hex(mixColor(rgb(hex(sky.low)), rgb('#e8ecf0'), 0.25));
    ctx.fillRect(0, hz, g.W, 1);
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
        img.data[i] = 214;
        img.data[i + 1] = 216;
        img.data[i + 2] = 224;
        img.data[i + 3] = smoothstep(0.48, 0.68, v) * band * e * 190;
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
    const hz = g.H * HORIZON;
    const rock = ink(sky, '#2e3846', 0.7);
    const top = g.H * 0.6;
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.4);
    ctx.lineTo(g.W * 0.03, g.H * 0.4);
    ctx.quadraticCurveTo(g.W * 0.15, g.H * 0.46, g.W * 0.24, top);
    ctx.quadraticCurveTo(g.W * 0.3, g.H * 0.7, g.W * 0.33, g.H * 0.78);
    ctx.quadraticCurveTo(g.W * 0.26, g.H * 0.82, g.W * 0.12, g.H * 0.86);
    ctx.lineTo(0, g.H * 0.9);
    ctx.closePath();
    ctx.fill();
    // lit upper edge from the moon
    ctx.strokeStyle = `rgba(200,210,224,${0.1 + sky.night * 0.12})`;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.03, g.H * 0.4);
    ctx.quadraticCurveTo(g.W * 0.15, g.H * 0.46, g.W * 0.24, top);
    ctx.stroke();
    paintPine(ctx, g, sky, g.W * 0.07, g.H * 0.43, g.U * 3.6, 0.7, rand);
    paintPine(ctx, g, sky, g.W * 0.17, g.H * 0.5, g.U * 2.6, 0.9, rand);
    paintPine(ctx, g, sky, g.W * 0.045, g.H * 0.46, g.U * 2.0, -0.5, rand);
    paintPine(ctx, g, sky, g.W * 0.22, g.H * 0.585, g.U * 1.7, 0.6, rand);
    // shore rocks and foam line
    ctx.fillStyle = rock;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(g.W * (0.3 + rand() * 0.09), g.H * (0.76 + rand() * 0.1), g.U * (1.2 + rand() * 1.6), g.U * (0.7 + rand() * 0.7), 0, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(214,222,232,0.28)';
    for (let i = 0; i < 14; i++) {
      ctx.fillRect(g.W * (0.19 + rand() * 0.17), g.H * (0.8 + rand() * 0.07), g.U * (1 + rand() * 2), 1);
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
    state.sky = paintSky(g, sky, rand, moon, sun);
    state.sea = paintSea(g, sky);
    state.front = paintFront(g, sky, rand);
    state.night = sky.night;
    state.lightX = sky.night > 0.5 ? moon.x : sun.x;
    state.lit = sky.night > 0.5 || (sky.hour > 6 && sky.hour < 19.5);
    state.cloudAlpha = 0.62 - sky.night * 0.12;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawCloud(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.cloud;
    const span = g.W + c.width;
    const off = ((t * g.U * 2.2) % span) - c.width;
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.1);
    ctx.drawImage(c, ((t * g.U * 1.5 + span * 0.5) % span) - c.width, g.H * 0.26, c.width * 0.8, c.height * 0.8);
    ctx.globalAlpha = 1;
  }

  // Wave lines drift and breathe in place; positions come from fixed seeds.
  function drawWaves(ctx, g, t) {
    const hz = g.H * HORIZON;
    ctx.fillStyle = '#d0dcec';
    for (let i = 0; i < WAVES; i++) {
      const w = state.waves[i];
      const depth = w.d * w.d;
      const y = hz + g.U * 1.5 + depth * (g.H - hz - g.U * 2);
      const len = g.U * (2 + depth * 9);
      const x = (w.x * g.W + Math.sin(t * 0.3 + w.p) * g.U * 2) % g.W;
      ctx.globalAlpha = (0.2 + 0.3 * depth) * (0.55 + 0.45 * Math.sin(t * 0.8 + w.p));
      ctx.fillRect(x, y, len, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Silver dashes in a column under the moon, each shimmering slowly.
  function drawGlitter(ctx, g, t) {
    if (!state.lit) return;
    const hz = g.H * HORIZON;
    const span = g.H - hz;
    ctx.fillStyle = state.night > 0.5 ? '#e6e8dc' : '#f4ecd4';
    const strength = state.night > 0.5 ? 1 : 0.5;
    for (let i = 0; i < GLINTS; i++) {
      const q = state.glints[i];
      const f = (i + 0.5) / GLINTS;
      const y = hz + g.U + f * f * (span - g.U * 2);
      const spread = g.U * (2 + f * 20);
      const x = state.lightX + (q.o - 0.5) * 2 * spread * 0.6 + Math.sin(t * 0.5 + q.p) * g.U * 0.6;
      const len = g.U * (1.5 + f * 8) * (0.6 + 0.4 * Math.sin(t * 1.1 + q.p * 2));
      ctx.globalAlpha = strength * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.9 + q.p * 3))) * (1 - f * 0.4);
      ctx.fillRect(x - len / 2, y, len, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(9);
    state.cloud = paintCloud(Math.ceil(g.W * 0.5), Math.ceil(g.H * 0.16));
    state.waves = Array.from({ length: WAVES }, () => ({ x: rand(), d: rand(), p: rand() * 6.3 }));
    state.glints = Array.from({ length: GLINTS }, () => ({ o: rand(), p: rand() * 6.3 }));
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
    drawWaves(ctx, g, t);
    if (props.glitter) drawGlitter(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, glitter: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
