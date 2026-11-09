/*
 * 菜の花 Nanohana — rapeseed fields in flower below a railway embankment.
 *
 * Sky, hills, embankment and the near field are baked and repainted once a
 * minute from the clock. Between repaints the field sways in strips, clouds
 * drift and a small two-car local train crosses every half minute or so.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, noise2, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const HORIZON = 0.47;
  const RAIL = 0.555;
  const BANK_FOOT = 0.64;
  const RETINT_SECONDS = 60;
  const STRIPS = 28;
  const MARGIN = 6;
  const CYCLE = 34;
  const CROSSING = 18;
  const FLOWER = parseColor('#e2bf3c');
  const FLOWER_DEEP = parseColor('#c99a2a');
  const FLOWER_LIGHT = parseColor('#efdc86');
  const LEAF = parseColor('#4f6a3a');
  const LEAF_DARK = parseColor('#2f4428');
  const BANK = parseColor('#5d7444');
  const BALLAST = parseColor('#8a8478');
  const CREAM = parseColor('#e8e0c8');
  const BAND = parseColor('#b8412c');
  const SKIRT = parseColor('#2f4c7a');
  const GLASS_DAY = parseColor('#3a4152');
  const GLASS_LIT = parseColor('#efc98a');
  const SAKURA = parseColor('#e6b8b8');
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Multiply a base colour by the sky light, then haze it with distance.
  function lit(base, sky, haze, lift) {
    const a = mixColor(sky.amb, [255, 255, 255], (lift || 0) * sky.night);
    const shaded = [base[0] * a[0] / 255, base[1] * a[1] / 255, base[2] * a[2] / 255];
    return mixColor(shaded, sky.haze, haze || 0);
  }

  const hex = (c) => toHex(c);

  // ---- sky ---------------------------------------------------------------

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
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintSunMoon(ctx, g, sky);
    return c;
  }

  function paintSunMoon(ctx, g, sky) {
    const day = sky.night < 0.5;
    const t = day ? S.sunT(sky.hour) : S.moonT(sky.hour);
    const cx = g.W * lerp(0.08, 0.92, t);
    const cy = g.H * (HORIZON - Math.sin(t * Math.PI) * 0.34);
    ctx.fillStyle = day ? '#f4e6c0' : '#e8e2cd';
    ctx.globalAlpha = day ? 0.85 : 0.95;
    ctx.beginPath();
    ctx.arc(cx, cy, g.U * (day ? 3.4 : 2.8), 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.08, 4, 17);
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

  // ---- land behind the train ---------------------------------------------

  function ridge(ctx, g, base, amp, freq, seed, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (base - fbm(x * freq, 1.3, 4, seed) * amp));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
  }

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ridge(ctx, g, HORIZON + 0.02, 0.2, 0.006, 5, hex(lit(parseColor('#55678c'), sky, 0.45, 0.25)));
    ridge(ctx, g, HORIZON + 0.035, 0.16, 0.01, 9, hex(lit(parseColor('#3e5a48'), sky, 0.2, 0.1)));
    paintFarField(ctx, g, sky);
    paintTrees(ctx, g, sky, rand);
    paintBank(ctx, g, sky);
    paintPoles(ctx, g, sky);
    return c;
  }

  // A thin far strip of yellow fields between the hills and the bank.
  function paintFarField(ctx, g, sky) {
    const top = g.H * (HORIZON + 0.025);
    ctx.fillStyle = hex(lit(FLOWER_LIGHT, sky, 0.12, 0.3));
    ctx.fillRect(0, top, g.W, g.H * RAIL - top);
    ctx.fillStyle = hex(lit(FLOWER_DEEP, sky, 0.15));
    for (let i = 0; i < 3; i++) {
      const y = top + (g.H * RAIL - top) * (i + 0.5) / 3;
      ctx.fillRect(0, y, g.W, 1);
    }
  }

  function paintTrees(ctx, g, sky, rand) {
    const blossom = hex(lit(SAKURA, sky, 0.15));
    const shade = hex(lit(mixColor(SAKURA, parseColor('#b07a82'), 0.6), sky, 0.15));
    const trunk = hex(lit(parseColor('#4a3a34'), sky, 0.1));
    const spots = [0.1, 0.33, 0.7, 0.88];
    for (const sx of spots) {
      const cx = g.W * sx;
      const base = g.H * (RAIL - 0.005);
      const r = g.U * (3.5 + rand() * 1.5);
      ctx.fillStyle = trunk;
      ctx.fillRect(cx - g.U * 0.35, base - r * 1.4, g.U * 0.7, r * 1.4);
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = k < 4 ? shade : blossom;
        ctx.beginPath();
        ctx.arc(cx + (rand() - 0.5) * r * 1.8, base - r * 1.6 - (rand() - 0.3) * r, r * (0.5 + rand() * 0.4), 0, 6.3);
        ctx.fill();
      }
    }
  }

  function paintBank(ctx, g, sky) {
    const rail = g.H * RAIL;
    const foot = g.H * BANK_FOOT;
    const grad = ctx.createLinearGradient(0, rail, 0, foot);
    grad.addColorStop(0, hex(lit(BANK, sky, 0)));
    grad.addColorStop(1, hex(lit(mixColor(BANK, LEAF_DARK, 0.35), sky, 0)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-2, foot);
    ctx.lineTo(-2, rail + g.U * 0.6);
    ctx.lineTo(g.W + 2, rail + g.U * 0.6);
    ctx.lineTo(g.W + 2, foot);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(lit(BALLAST, sky, 0));
    ctx.fillRect(0, rail - g.U * 0.2, g.W, g.U * 1.1);
    ctx.fillStyle = hex(lit(parseColor('#3a3634'), sky, 0));
    ctx.fillRect(0, rail - g.U * 0.35, g.W, Math.max(1, g.U * 0.3));
  }

  // Wooden poles strung along the line.
  function paintPoles(ctx, g, sky) {
    const pole = hex(lit(parseColor('#3a302c'), sky, 0));
    const rail = g.H * RAIL;
    const tall = g.U * 9;
    ctx.fillStyle = pole;
    ctx.strokeStyle = pole;
    ctx.lineWidth = Math.max(1, g.U * 0.15);
    const step = g.W / 6;
    for (let x = step * 0.4; x < g.W; x += step) {
      ctx.fillRect(x, rail - tall, Math.max(1, g.U * 0.5), tall);
      ctx.fillRect(x - g.U * 1.2, rail - tall + g.U * 0.8, g.U * 2.9, Math.max(1, g.U * 0.35));
    }
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (let x = step * 0.4; x < g.W - step; x += step) {
      const y0 = rail - tall + g.U * 0.9;
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + step / 2, y0 + g.U * 1.2, x + step, y0);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- the near field ------------------------------------------------------

  function paintField(g, sky) {
    const top = Math.floor(g.H * (BANK_FOOT - 0.03));
    const w = g.W + MARGIN * 2;
    const h = g.H - top;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const flower = lit(FLOWER, sky, 0, 0.35);
    const deep = lit(FLOWER_DEEP, sky, 0, 0.2);
    const light = lit(FLOWER_LIGHT, sky, 0, 0.45);
    const leaf = lit(LEAF, sky, 0);
    const dark = lit(LEAF_DARK, sky, 0);
    for (let y = 0; y < h; y++) {
      const d = y / h;
      const f = lerp(0.9, 0.12, Math.pow(d, 0.6));
      const edge = smoothstep(0, 3, y);
      for (let x = 0; x < w; x++) {
        const n = fbm(x * f, y * f * 1.8, 3, 41);
        const fine = noise2(x * f * 3, y * f * 5, 7);
        const path = pathMask(g, x - MARGIN, y + top);
        let col = n > 0.42 ? mixColor(flower, light, smoothstep(0.6, 0.8, fine)) : mixColor(deep, leaf, smoothstep(0.42, 0.3, n));
        if (fine < 0.18 && d > 0.3) col = mixColor(col, dark, 0.55);
        if (path > 0) col = mixColor(col, lit(parseColor('#8a7860'), sky, 0), path);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255 * edge;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, top };
  }

  // A worn footpath running from the bottom left up to the bank.
  function pathMask(g, x, y) {
    const d = clamp((y - g.H * BANK_FOOT) / (g.H * (1 - BANK_FOOT)), 0, 1);
    const cx = g.W * lerp(0.46, 0.18, d);
    const half = g.U * lerp(0.4, 4.5, d);
    return smoothstep(half, half * 0.6, Math.abs(x - cx));
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(23);
    state.sky = paintSky(g, sky, rand);
    state.back = paintBack(g, sky, rand);
    state.field = paintField(g, sky);
    state.cloudAlpha = 0.8 - sky.night * 0.55;
    state.night = sky.night;
    state.colors = trainColors(sky);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function trainColors(sky) {
    return {
      body: hex(lit(CREAM, sky, 0)),
      band: hex(lit(BAND, sky, 0)),
      skirt: hex(lit(SKIRT, sky, 0)),
      glass: hex(mixColor(lit(GLASS_DAY, sky, 0), GLASS_LIT, sky.night)),
      wheel: '#24242a',
    };
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = Math.max(0, state.cloudAlpha);
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  function drawCar(ctx, g, x0, len, col, front) {
    const rail = g.H * RAIL;
    const h = g.U * 4.2;
    const top = rail - h - g.U * 0.6;
    ctx.fillStyle = col.body;
    ctx.fillRect(x0, top, len, h);
    ctx.fillStyle = col.band;
    ctx.fillRect(x0, top + h * 0.62, len, h * 0.16);
    ctx.fillStyle = col.skirt;
    ctx.fillRect(x0, top + h * 0.82, len, h * 0.18);
    ctx.fillStyle = col.glass;
    const win = g.U * 1.6;
    for (let wx = x0 + g.U * 1.2; wx < x0 + len - win - g.U * 0.6; wx += win + g.U * 0.9) {
      ctx.fillRect(wx, top + h * 0.18, win, h * 0.34);
    }
    if (front) ctx.fillRect(x0 + len - g.U * 0.8, top + h * 0.14, g.U * 0.8, h * 0.4);
    ctx.fillStyle = col.wheel;
    ctx.fillRect(x0 + g.U, rail - g.U * 0.6, g.U * 2.4, g.U * 0.6);
    ctx.fillRect(x0 + len - g.U * 3.4, rail - g.U * 0.6, g.U * 2.4, g.U * 0.6);
  }

  // A two-car diesel crossing left to right, a gentle bounce on the joints.
  function drawTrain(ctx, g, t) {
    const p = (t % CYCLE) / CROSSING;
    if (p >= 1) return;
    const len = g.U * 22;
    const gap = g.U * 0.6;
    const x = lerp(-len * 2 - gap, g.W, p);
    const bob = Math.sin(t * 9) > 0.92 ? -1 : 0;
    ctx.save();
    ctx.translate(0, bob);
    drawCar(ctx, g, x, len, state.colors, false);
    drawCar(ctx, g, x + len + gap, len, state.colors, true);
    ctx.restore();
  }

  // The near field drawn as strips, each swaying a little, more near the top.
  function drawField(ctx, g, t, breeze) {
    const f = state.field;
    const h = f.canvas.height;
    const strip = h / STRIPS;
    for (let s = 0; s < STRIPS; s++) {
      const sy = Math.floor(s * strip);
      const sh = Math.ceil(strip) + 1;
      const k = 1 - s / STRIPS;
      const sway = Math.sin(t * 1.3 - s * 0.35) * breeze * g.U * (0.4 + 0.8 * k) + Math.sin(t * 0.37 + s) * breeze * g.U * 0.25;
      ctx.drawImage(f.canvas, 0, sy, f.canvas.width, sh, -MARGIN + sway, f.top + sy, f.canvas.width, sh);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.back, 0, 0);
    if (props.trains) drawTrain(ctx, g, t);
    drawField(ctx, g, t, props.breeze);
  }

  Kasuri.run({
    defaults: { time: 'auto', breeze: 1, trains: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
