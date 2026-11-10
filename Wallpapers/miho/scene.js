/*
 * 三保 Miho — a black sand beach under old pines, curving toward Mount Fuji across the bay.
 *
 * Sky, mountain, sea, sand and pines are baked into two layers and repainted once a
 * minute from the clock. Between repaints only drifting clouds, a few rolling surf
 * lines and a handful of sea glints move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.5;
  const PEAK = { x: 0.64, y: 0.17 };
  const RETINT_SECONDS = 60;
  const WAVES = 5;
  const STEPS = 48;
  const GLINTS = 28;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Shoreline height at fraction u (0 left, 1 right): near the bottom on the left, far and high on the right.
  function shoreY(g, u) {
    return g.H * (0.585 + 0.39 * Math.pow(1 - u, 2.3));
  }

  // Width of the sand strip below the shoreline.
  function sandH(g, u) {
    return g.H * (0.014 + 0.2 * Math.pow(1 - u, 1.7));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, choiceHour, rand) {
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
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
      const mt = S.moonT(choiceHour);
      const mx = g.W * (0.12 + mt * 0.5);
      const my = g.H * (0.3 - Math.sin(mt * Math.PI) * 0.18);
      ctx.fillStyle = '#ece6cc';
      ctx.globalAlpha = 0.9 * sky.night;
      ctx.beginPath();
      ctx.arc(mx, my, g.U * 2.4, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.014, y * 0.075, 4, 41);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.52, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- mountain ----------------------------------------------------------

  function ridge(g, x) {
    const px = g.W * PEAK.x;
    const half = g.W * (x < px ? 0.34 : 0.4);
    const crater = g.W * 0.012;
    const d = Math.max(0, Math.abs(x - px) - crater) / half;
    const base = g.H * HORIZON;
    const top = g.H * PEAK.y;
    return base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.85) + (fbm(x * 0.07, 2, 3, 5) - 0.5) * g.U * 0.5;
  }

  function paintMountain(ctx, g, sky) {
    const base = g.H * HORIZON;
    const x0 = Math.floor(g.W * 0.2);
    const x1 = Math.ceil(g.W * 1.05);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, base + 1);
    for (let px = x0; px <= x1; px += 2) ctx.lineTo(px, ridge(g, px));
    ctx.lineTo(x1, base + 1);
    ctx.closePath();
    ctx.clip();
    const rock = mixColor(mixColor(rgb('#4d6088'), sky.haze, 0.5), rgb('#232c4a'), sky.night * 0.6);
    const foot = mixColor(rock, sky.low, 0.45);
    const grad = ctx.createLinearGradient(0, g.H * PEAK.y, 0, base);
    grad.addColorStop(0, hex(rock));
    grad.addColorStop(1, hex(foot));
    ctx.fillStyle = grad;
    ctx.fillRect(x0, 0, x1 - x0, base + 1);
    // Snow cap with a ragged lower edge.
    const snow = mixColor(mixColor(rgb('#eef0f2'), sky.amb, 0.4), sky.top, 0.1 + sky.night * 0.3);
    ctx.fillStyle = hex(snow);
    const capH = (base - g.H * PEAK.y) * 0.4;
    ctx.beginPath();
    ctx.moveTo(x0, g.H * PEAK.y - 4);
    for (let px = x0; px <= x1; px += 2) {
      const gully = fbm(px * 0.22, 3, 3, 9);
      ctx.lineTo(px, g.H * PEAK.y + capH * (0.55 + (fbm(px * 0.05, 4, 3, 11) - 0.5) * 0.5) + (gully - 0.5) * capH * 0.5 + Math.abs(px - g.W * PEAK.x) * 0.0);
    }
    ctx.lineTo(x1, g.H * PEAK.y - 4);
    ctx.closePath();
    ctx.fill();
    // East face a little darker.
    ctx.fillStyle = 'rgba(20,28,56,0.14)';
    ctx.fillRect(g.W * PEAK.x + g.W * 0.01, 0, g.W, base + 1);
    ctx.restore();
  }

  function paintFarHills(ctx, g, sky) {
    const base = g.H * HORIZON;
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#6f84a0'), sky.haze, 0.6), rgb('#242a48'), sky.night * 0.5));
    ctx.beginPath();
    ctx.moveTo(0, base + 1);
    for (let px = 0; px <= g.W * 0.3; px += 3) {
      ctx.lineTo(px, base - g.U * (1.5 + fbm(px * 0.03, 8, 3, 3) * 3) * smoothstep(g.W * 0.3, g.W * 0.1, px));
    }
    ctx.lineTo(g.W * 0.3, base + 1);
    ctx.closePath();
    ctx.fill();
    // Low cape beyond the end of the beach.
    ctx.beginPath();
    ctx.moveTo(g.W * 0.9, base + 1);
    for (let px = g.W * 0.9; px <= g.W; px += 3) {
      ctx.lineTo(px, base - g.U * 2.2 * Math.sin(((px - g.W * 0.9) / (g.W * 0.1)) * Math.PI * 0.8));
    }
    ctx.lineTo(g.W, base + 1);
    ctx.closePath();
    ctx.fill();
  }

  // ---- sea ---------------------------------------------------------------

  function paintSea(ctx, g, sky) {
    const base = g.H * HORIZON;
    const far = mixColor(sky.low, rgb('#4a6a88'), 0.5);
    const mid = mixColor(rgb('#34526e'), sky.top, 0.25);
    const near = mixColor(rgb('#1f3a56'), rgb('#0c1424'), sky.night * 0.7);
    const grad = ctx.createLinearGradient(0, base, 0, g.H * 0.95);
    grad.addColorStop(0, hex(mixColor(far, rgb('#0c1424'), sky.night * 0.6)));
    grad.addColorStop(0.35, hex(mixColor(mid, rgb('#0c1424'), sky.night * 0.65)));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.fillRect(0, base, g.W, g.H - base);
    // Long swell lines across the bay.
    ctx.fillStyle = hex(mixColor(sky.low, rgb('#e8e2d0'), 0.4));
    const rand = K.rng(77);
    const pick = rand;
    for (let i = 0; i < 90; i++) {
      const v = Math.pow(rand(), 1.6);
      const yy = base + 2 + v * (g.H * 0.4);
      const len = g.U * (1 + v * 5) * (0.6 + rand());
      ctx.globalAlpha = (0.08 + rand() * 0.12) * (1 - sky.night * 0.6);
      ctx.fillRect(rand() * g.W, yy, len, 1);
    }
    ctx.globalAlpha = 1;
    if (sky.night > 0.3) {
      // A broken column of moonlight on the water.
      const mt = S.moonT(sky.hour);
      const mx = g.W * (0.12 + mt * 0.5);
      ctx.fillStyle = '#ece6cc';
      for (let i = 0; i < 40; i++) {
        const v = i / 40;
        ctx.globalAlpha = sky.night * (0.5 - v * 0.3) * (0.4 + rand() * 0.6);
        const w = g.U * (1 + v * 5) * (0.5 + rand());
        ctx.fillRect(mx - w / 2 + (rand() - 0.5) * g.U * 3 * v, base + 2 + v * g.H * 0.18, w, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- sand and pines ----------------------------------------------------

  function paintGround(ctx, g, sky, rand) {
    const night = sky.night;
    const sand = mixColor(mixColor(rgb('#5e5f66'), sky.amb, 0.18), rgb('#3a4052'), night * 0.7);
    const wet = mixColor(sand, sky.low, 0.35);
    const soil = mixColor(rgb('#2a3a28'), rgb('#141c26'), night * 0.7);
    // Grove floor below the sand.
    ctx.fillStyle = hex(soil);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      ctx.lineTo(g.W * u, shoreY(g, u) + sandH(g, u));
    }
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    // Sand strip.
    ctx.fillStyle = hex(sand);
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const yy = shoreY(g, u);
      if (i === 0) ctx.moveTo(0, yy);
      else ctx.lineTo(g.W * u, yy);
    }
    for (let i = STEPS; i >= 0; i--) {
      const u = i / STEPS;
      ctx.lineTo(g.W * u, shoreY(g, u) + sandH(g, u) + 1);
    }
    ctx.closePath();
    ctx.fill();
    // Wet sheen along the water's edge.
    ctx.strokeStyle = hex(wet);
    ctx.lineWidth = Math.max(1, g.U * 1.1);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const yy = shoreY(g, u) + g.H * 0.012 * (1 - u) + 1;
      if (i === 0) ctx.moveTo(0, yy);
      else ctx.lineTo(g.W * u, yy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Pale grains.
    ctx.fillStyle = hex(mixColor(sand, rgb('#9a9a98'), 0.5));
    for (let i = 0; i < g.W * 1.2; i++) {
      const u = rand();
      ctx.globalAlpha = 0.25 + rand() * 0.3;
      ctx.fillRect(g.W * u, shoreY(g, u) + rand() * sandH(g, u), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function pineTones(sky) {
    const n = sky.night * 0.75;
    return {
      trunk: hex(mixColor(rgb('#4a382a'), rgb('#2a2e3c'), n)),
      dark: hex(mixColor(mixColor(rgb('#21361f'), sky.haze, 0.12), rgb('#1a2a2c'), n)),
      mid: hex(mixColor(mixColor(rgb('#38542c'), sky.amb, 0.1), rgb('#27403a'), n)),
      light: hex(mixColor(mixColor(rgb('#5a7a3c'), sky.amb, 0.18), rgb('#3c5c52'), n)),
    };
  }

  function pad(ctx, x, y, rx, ry, tones, rand) {
    const lobes = [[0, 0.25, 1, 1, tones.dark], [0, 0, 0.92, 0.8, tones.mid], [-0.1, -0.28, 0.65, 0.4, tones.light]];
    for (const [ox, oy, sx, sy, col] of lobes) {
      ctx.fillStyle = col;
      for (let k = 0; k < 4; k++) {
        const jx = (k - 1.5) * rx * 0.34 + (rand() - 0.5) * rx * 0.12;
        const jy = (rand() - 0.5) * ry * 0.5;
        ctx.beginPath();
        ctx.ellipse(x + rx * ox + jx, y + ry * oy + jy, rx * sx * 0.45, ry * sy * (0.8 + rand() * 0.4), 0, 0, 6.3);
        ctx.fill();
      }
    }
  }

  // One pine: a leaning trunk carrying flat layered pads of needles.
  function paintPine(ctx, x, base, h, lean, tones, rand) {
    const w = Math.max(1, h * 0.05);
    ctx.strokeStyle = tones.trunk;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * 0.2, base - h * 0.5, x + lean, base - h * 0.95);
    ctx.stroke();
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
      const f = 0.45 + (k / tiers) * 0.55;
      const cx = x + lean * f * 1.05 + (rand() - 0.5) * h * 0.1;
      const cy = base - h * f;
      const rx = h * (0.34 - k * 0.055) * (0.85 + rand() * 0.3);
      pad(ctx, cx + (k % 2 ? 1 : -1) * rx * 0.22, cy, rx, Math.max(1.2, rx * 0.34), tones, rand);
    }
    ctx.strokeStyle = tones.trunk;
    ctx.lineWidth = Math.max(1, w * 0.6);
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.7, base - h * 0.72);
    ctx.lineTo(x + lean * 0.7 + h * 0.2, base - h * 0.62);
    ctx.stroke();
  }

  function paintGrove(ctx, g, sky, rand) {
    const tones = pineTones(sky);
    // Far to near along the beach so near trees overlap far ones.
    const n = 26;
    for (let i = 0; i < n; i++) {
      const u = 0.98 - (i / n) * 0.98 + (rand() - 0.5) * 0.02;
      const near = Math.pow(1 - u, 1.2);
      const base = shoreY(g, u) + sandH(g, u) + g.H * 0.012 + near * g.H * 0.02;
      const h = g.H * (0.045 + near * 0.3) * (0.85 + rand() * 0.3);
      paintPine(ctx, g.W * u, base, h, (rand() - 0.4) * h * 0.25, tones, rand);
    }
    // Rows of nearer trunks behind the first line fill the foreground.
    for (let r = 1; r <= 2; r++) {
      const count = 9 - r * 2;
      for (let i = 0; i < count; i++) {
        const u = 0.2 + (i + rand() * 0.6) / count * 0.8;
        const base = shoreY(g, u) + sandH(g, u) + g.H * (0.14 * r + 0.1);
        if (base > g.H * 1.05) continue;
        const h = g.H * (0.12 + r * 0.07) * (0.85 + rand() * 0.3);
        paintPine(ctx, g.W * u, base, h, (rand() - 0.5) * h * 0.3, tones, rand);
      }
    }
    // A great pine on the left edge, nearest of all.
    paintPine(ctx, g.W * 0.07, g.H * 1.02, g.H * 0.72, g.W * 0.05, tones, rand);
    paintPine(ctx, g.W * 0.2, g.H * 1.02, g.H * 0.42, -g.W * 0.015, tones, rand);
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const hr = S.hour(choice);
    const sky = S.at(hr);
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, hr, rand);
    const f = layer(g.W, g.H);
    const ctx = f.getContext('2d');
    paintFarHills(ctx, g, sky);
    paintMountain(ctx, g, sky);
    paintSea(ctx, g, sky);
    paintGround(ctx, g, sky, rand);
    paintGrove(ctx, g, sky, rand);
    state.front = f;
    state.cloudAlpha = 0.72 - sky.night * 0.5;
    state.foam = hex(mixColor(rgb('#ece8d8'), sky.amb, 0.2 * (1 - sky.night)));
    state.foamAlpha = 0.75 - sky.night * 0.35;
    state.glint = hex(mixColor(sky.amb, rgb('#ffffff'), 0.4));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.6) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  // Foam lines slide in from the bay and thin out on the sand.
  function drawSurf(ctx, g, t, amount) {
    if (amount <= 0) return;
    ctx.strokeStyle = state.foam;
    for (let k = 0; k < WAVES; k++) {
      const p = (t * 0.075 + k / WAVES) % 1;
      const reach = (1 - p) * g.H * 0.09;
      ctx.globalAlpha = Math.min(1, amount) * state.foamAlpha * Math.sin(p * Math.PI) * 0.9;
      ctx.lineWidth = Math.max(1, g.U * (0.5 + (1 - p) * 0.5));
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i += 2) {
        const u = i / STEPS;
        const scale = 0.25 + 0.75 * Math.pow(1 - u, 1.2);
        const yy = shoreY(g, u) - reach * scale + Math.sin(u * 40 + k * 2 + t * 0.6) * g.U * 0.3 * scale;
        if (i === 0) ctx.moveTo(0, yy);
        else ctx.lineTo(g.W * u, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = state.glint;
    const base = g.H * HORIZON;
    for (let i = 0; i < GLINTS; i++) {
      const s = state.glints[i];
      const a = Math.sin(t * s.rate + s.ph);
      if (a < 0.2) continue;
      ctx.globalAlpha = a * 0.5;
      ctx.fillRect(g.W * s.x, base + s.d * g.H * 0.3, g.U * (0.8 + s.d * 3), 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    const rand = K.rng(5);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      const d = Math.pow(rand(), 1.5);
      state.glints.push({ x: 0.3 + rand() * 0.7, d, rate: 0.5 + rand() * 0.8, ph: rand() * 6.3 });
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.front, 0, 0);
    drawGlints(ctx, g, t);
    drawSurf(ctx, g, t, props.surf);
  }

  Kasuri.run({
    defaults: { time: 'auto', surf: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
