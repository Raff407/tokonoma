/*
 * 利尻 Rishiri — a lone conical island peak above a calm northern sea.
 *
 * Sky, island, sea and kelp are baked into layers and repainted once a
 * minute from the clock. Between repaints only cloud, ripples, a gull
 * and the fishing boat move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.6;
  const PEAK = { x: 0.6, y: 0.2 };
  const RETINT_SECONDS = 60;
  const RIPPLES = 36;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      const mg = ctx.createRadialGradient(g.W * 0.25, g.H * 0.16, 0, g.W * 0.25, g.H * 0.16, g.U * 14);
      mg.addColorStop(0, `rgba(236,232,214,${0.5 * sky.night})`);
      mg.addColorStop(1, 'rgba(236,232,214,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, g.W, g.H);
      ctx.fillStyle = '#ece8d6';
      ctx.beginPath();
      ctx.arc(g.W * 0.25, g.H * 0.16, g.U * 2.2, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.08, 4, 23);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 220;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Cone profile: concave sides, a slightly rugged top, a gentle shoulder to the west.
  function ridge(g, x) {
    const px = g.W * PEAK.x;
    const half = g.W * (x < px ? 0.34 : 0.3);
    const d = Math.abs(x - px) / half;
    const base = g.H * HORIZON;
    const top = g.H * PEAK.y;
    const y = base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.35);
    const rough = (fbm(x * 0.08, 3, 3, 7) - 0.5) * g.U * 1.6 * smoothstep(0.1, 0.7, d);
    return y + rough;
  }

  function paintIsland(ctx, g, sky) {
    const x0 = Math.floor(g.W * 0.2);
    const y0 = Math.floor(g.H * PEAK.y - g.U * 2);
    const y1 = Math.ceil(g.H * HORIZON + 1);
    const w = Math.ceil(g.W * 0.84) - x0;
    const h = y1 - y0;
    const img = ctx.getImageData(x0, y0, w, h);
    const rock = mixColor(mixColor(rgb('#3e4c70'), sky.haze, 0.4), rgb('#46547e'), sky.night * 0.55);
    const wood = mixColor(mixColor(rgb('#3d5a44'), sky.haze, 0.3), rgb('#2e4050'), sky.night * 0.6);
    const snow = mixColor(mixColor(rgb('#eceef0'), sky.amb, 0.4), sky.top, 0.1);
    
    for (let x = 0; x < w; x++) {
      const top = ridge(g, x0 + x);
      const side = (x0 + x < g.W * PEAK.x) ? 1 : 0.84;
      for (let y = Math.max(0, Math.floor(top - y0)); y < h; y++) {
        const f = (y0 + y - g.H * PEAK.y) / (g.H * (HORIZON - PEAK.y));
        const gully = fbm((x0 + x) * 0.25, (y0 + y) * 0.018, 3, 13);
        let c;
        if (f < 0.2 + (gully - 0.5) * 0.2) c = snow;
        else if (f > 0.62 + (gully - 0.5) * 0.12) c = mixColor(wood, rock, 0.25);
        else c = mixColor(rock, wood, smoothstep(0.35, 0.8, f) * 0.6);
        const i = (y * w + x) * 4;
        img.data[i] = c[0] * side;
        img.data[i + 1] = c[1] * side;
        img.data[i + 2] = c[2] * side;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  // Low far headland of Rebun to the west, pale in the haze.
  function paintFarIsle(ctx, g, sky) {
    ctx.fillStyle = hex(mixColor(sky.haze, sky.low, 0.5));
    const base = g.H * HORIZON;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= g.W * 0.26; x += 2) {
      const f = x / (g.W * 0.26);
      ctx.lineTo(x, base - g.U * 4.5 * Math.sin(f * 3.1) * (0.6 + 0.4 * fbm(x * 0.05, 1, 2, 3)));
    }
    ctx.lineTo(g.W * 0.26, base);
    ctx.fill();
  }

  function paintSea(ctx, g, sky) {
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    const near = mixColor(mixColor(rgb('#26405f'), sky.low, 0.25), rgb('#1a2848'), sky.night * 0.7);
    const far = mixColor(sky.low, sky.haze, 0.4);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Soft reflection of the cone as a darker column under the peak.
    const ref = ctx.createLinearGradient(0, top, 0, g.H * 0.85);
    ref.addColorStop(0, 'rgba(24,34,58,0.5)');
    ref.addColorStop(1, 'rgba(24,34,58,0)');
    ctx.fillStyle = ref;
    ctx.beginPath();
    ctx.moveTo(g.W * (PEAK.x - 0.2), top);
    ctx.lineTo(g.W * (PEAK.x + 0.18), top);
    ctx.lineTo(g.W * (PEAK.x + 0.05), g.H * 0.85);
    ctx.lineTo(g.W * (PEAK.x - 0.07), g.H * 0.85);
    ctx.fill();
  }

  // Kelp: long ribbons drifting in the shallows, drawn as curved strokes, plus a rock shelf and a vermilion buoy.
  function paintKelp(ctx, g, sky, rand) {
    const kelp = hex(mixColor(mixColor(rgb('#4a5a34'), rgb('#26301e'), 0.35), rgb('#0e141a'), sky.night * 0.7));
    ctx.strokeStyle = kelp;
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.8 + rand() * 0.18);
      const len = g.U * (5 + rand() * 9);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.4, y - g.U, x + len * 0.6, y + g.U * 1.2, x + len, y);
      ctx.stroke();
    }
    ctx.fillStyle = hex(mixColor(rgb('#2a2c36'), rgb('#0c1018'), sky.night * 0.7));
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W * 0.22; x += 3) {
      ctx.lineTo(x, g.H * 0.93 - g.U * 3 * (1 - x / (g.W * 0.22)) * (0.6 + fbm(x * 0.07, 5, 2, 9)));
    }
    ctx.lineTo(g.W * 0.22, g.H);
    ctx.fill();
    ctx.fillStyle = '#b8412c';
    ctx.beginPath();
    ctx.arc(g.W * 0.8, g.H * 0.86, g.U * 0.9, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#c9c2a8'), rgb('#586070'), sky.night * 0.6));
    ctx.fillRect(g.W * 0.8 - g.U * 0.9, g.H * 0.86, g.U * 1.8, Math.max(1, g.U * 0.35));
  }

  function paintBoat(g, sky) {
    const w = Math.round(g.U * 22);
    const h = Math.round(g.U * 12);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const hull = hex(mixColor(rgb('#e8e2d0'), rgb('#4a5066'), sky.night * 0.6));
    const base = h * 0.82;
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(w * 0.04, base - h * 0.34);
    ctx.lineTo(w * 0.96, base - h * 0.4);
    ctx.lineTo(w * 0.82, base);
    ctx.lineTo(w * 0.14, base);
    ctx.fill();
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(w * 0.1, base - h * 0.14, w * 0.78, h * 0.1);
    ctx.fillStyle = hex(mixColor(rgb('#2a3a5a'), rgb('#101626'), sky.night * 0.6));
    ctx.fillRect(w * 0.4, base - h * 0.62, w * 0.22, h * 0.28);
    ctx.fillStyle = '#5a4a38';
    ctx.fillRect(w * 0.7, base - h * 0.95, Math.max(1, g.U * 0.4), h * 0.6);
    if (sky.night > 0.2) {
      ctx.fillStyle = '#e9b95a';
      ctx.beginPath();
      ctx.arc(w * 0.71, base - h * 0.95, g.U * 0.8, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    const f = layer(g.W, g.H);
    const ctx = f.getContext('2d');
    ctx.drawImage(state.sky, 0, 0);
    paintFarIsle(ctx, g, sky);
    paintIsland(ctx, g, sky);
    paintSea(ctx, g, sky);
    paintKelp(ctx, g, sky, rand);
    state.front = f;
    state.boatArt = paintBoat(g, sky);
    state.cloudAlpha = 0.7 - sky.night * 0.45;
    state.ripple = hex(mixColor(rgb('#dfe6ea'), sky.amb, 0.4));
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // Cloud drifts across the upper sky and a second, slower band wraps the cone.
  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const a = Math.min(1, state.cloudAlpha * amount);
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = a * 0.8;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    const off2 = -((t * g.U * 0.7) % c.width);
    ctx.globalAlpha = a;
    ctx.drawImage(c, off2, g.H * 0.3, c.width, g.H * 0.18);
    ctx.drawImage(c, off2 + c.width, g.H * 0.3, c.width, g.H * 0.18);
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t) {
    ctx.fillStyle = state.ripple;
    const top = g.H * HORIZON;
    const span = g.H - top;
    for (let i = 0; i < RIPPLES; i++) {
      const r = ((i * 0.6180339) % 1);
      const depth = ((i * 0.37) % 1);
      const y = top + span * (0.04 + depth * 0.9);
      const x = ((r * g.W * 1.2 + Math.sin(t * 0.3 + i) * g.U * 2) % g.W + g.W) % g.W;
      const w = g.U * (1.5 + depth * 5);
      ctx.globalAlpha = (0.12 + 0.12 * Math.sin(t * 0.8 + i * 2)) * (1 - state.dim * 0.5);
      ctx.fillRect(x, y, w, Math.max(1, g.U * 0.25));
    }
    ctx.globalAlpha = 1;
  }

  function drawBoat(ctx, g, t) {
    const art = state.boatArt;
    const x = g.W * 0.3 + Math.sin(t * 0.05) * g.W * 0.03;
    const y = g.H * 0.74 + Math.sin(t * 0.9) * g.U * 0.5 - art.height * 0.75;
    ctx.save();
    ctx.translate(x + art.width / 2, y + art.height);
    ctx.rotate(Math.sin(t * 0.9 + 1) * 0.02);
    ctx.drawImage(art, -art.width / 2, -art.height);
    ctx.restore();
    ctx.fillStyle = state.ripple;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x - g.U * 2, y + art.height * 0.9, art.width + g.U * 4, Math.max(1, g.U * 0.3));
    ctx.globalAlpha = 1;
  }

  // One gull crossing slowly over the water.
  function drawGull(ctx, g, t) {
    const p = (t % 40) / 40;
    const x = lerp(-g.W * 0.05, g.W * 1.05, p);
    const y = g.H * 0.5 + Math.sin(t * 0.5) * g.U * 2;
    const flap = Math.sin(t * 5) * g.U * 0.8;
    ctx.strokeStyle = '#ece8dc';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    ctx.moveTo(x - g.U * 2, y + flap);
    ctx.lineTo(x, y);
    ctx.lineTo(x + g.U * 2, y + flap);
    ctx.stroke();
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
    ctx.drawImage(state.front, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    drawRipples(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    drawGull(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
