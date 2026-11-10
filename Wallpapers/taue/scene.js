/*
 * 田植え Taue — flooded rice paddies in early summer.
 *
 * Sky, hills, water, seedlings and the farm hut are baked into layers and
 * repainted once a minute from the clock. Between repaints only the clouds
 * (and their reflection), a few soft glints, a white heron and two swallows move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HOR = 0.345;
  const BUND_A = 0.46;
  const BUND_B = 0.69;
  const RETINT_SECONDS = 60;
  const GLINTS = 16;
  const STRIKE_CYCLE = 18;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const NIGHT_INK = rgb('#0d1222');

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A scene colour lit by the sky's ambient tint and dimmed at night.
  function tint(color, sky, amount) {
    const lit = mixColor(rgb(color), sky.amb, amount === undefined ? 0.22 : amount);
    return hex(mixColor(lit, NIGHT_INK, sky.night * 0.68));
  }

  // ---- sky and hills -----------------------------------------------------

  function paintHills(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hor = g.H * HOR;
    const far = hex(mixColor(mixColor(sky.haze, rgb('#3b4a72'), 0.35), NIGHT_INK, sky.night * 0.5));
    const near = hex(mixColor(mixColor(rgb('#4c6a4a'), sky.haze, 0.42), NIGHT_INK, sky.night * 0.55));
    for (let x = 0; x < g.W; x++) {
      const u = x / g.W;
      const farTop = hor - g.H * (0.1 + 0.09 * Math.exp(-Math.pow((u - 0.74) / 0.28, 2)) + 0.05 * fbm(x * 0.03, 3, 3, 7));
      ctx.fillStyle = far;
      ctx.fillRect(x, farTop, 1, hor - farTop + 1);
    }
    for (let x = 0; x < g.W; x++) {
      const u = x / g.W;
      const top = hor - g.H * (0.045 + 0.13 * Math.exp(-Math.pow((u - 0.2) / 0.2, 2)) + 0.04 * fbm(x * 0.04, 9, 3, 13));
      ctx.fillStyle = near;
      ctx.fillRect(x, top, 1, hor - top + 1);
    }
    return c;
  }

  function paintSky(g, sky, hills, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HOR);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.28, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(hills, 0, 0);
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.08, 4, 41);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 248;
        img.data[i + 3] = smoothstep(0.5, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, hills) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hor = g.H * HOR;
    const top = mixColor(mixColor(sky.low, rgb('#2b3a5e'), 0.18), NIGHT_INK, sky.night * 0.2);
    const bottom = mixColor(mixColor(sky.top, rgb('#26303c'), 0.55), NIGHT_INK, sky.night * 0.3);
    const grad = ctx.createLinearGradient(0, hor, 0, g.H);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, hor, g.W, g.H - hor);
    // Hills mirrored and stretched, softly.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hor, g.W, g.H - hor);
    ctx.clip();
    ctx.globalAlpha = 0.45;
    ctx.translate(0, hor);
    ctx.scale(1, -1.5);
    ctx.translate(0, -hor);
    ctx.drawImage(hills, 0, 0);
    ctx.restore();
    return c;
  }

  // ---- far bank: tree line, cedars and the farm hut -----------------------

  function cedar(ctx, x, base, w, h, col) {
    ctx.fillStyle = col;
    for (let k = 0; k < 3; k++) {
      const top = base - h + k * h * 0.26;
      const bot = base - h * (1 - (k + 1) * 0.3) + h * 0.12;
      const half = w * (0.38 + k * 0.28) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + half, Math.min(base, bot + h * 0.2));
      ctx.lineTo(x - half, Math.min(base, bot + h * 0.2));
      ctx.fill();
    }
    ctx.fillRect(x - Math.max(0.5, w * 0.05), base - h * 0.12, Math.max(1, w * 0.1), h * 0.12);
  }

  function paintHut(ctx, g, sky) {
    const U = g.U;
    const x0 = g.W * 0.69;
    const base = g.H * HOR + U * 0.3;
    const w = U * 19;
    const wallH = U * 5;
    // wooden wall
    ctx.fillStyle = tint('#6a5642', sky, 0.28);
    ctx.fillRect(x0, base - wallH, w, wallH);
    // plaster band under the eaves
    ctx.fillStyle = tint('#d8cfba', sky, 0.3);
    ctx.fillRect(x0, base - wallH, w, Math.max(1, U * 0.7));
    // door and window
    ctx.fillStyle = tint('#2a2420', sky, 0.1);
    ctx.fillRect(x0 + w * 0.12, base - wallH * 0.78, w * 0.2, wallH * 0.78);
    ctx.fillStyle = sky.night > 0.45 ? hex(mixColor(rgb('#d9a73a'), sky.amb, 0.1)) : tint('#1c1a20', sky, 0.05);
    ctx.fillRect(x0 + w * 0.58, base - wallH * 0.7, w * 0.18, wallH * 0.38);
    // gabled roof with eaves, dark indigo tin
    ctx.fillStyle = tint('#32384e', sky, 0.3);
    ctx.beginPath();
    ctx.moveTo(x0 - U * 1.4, base - wallH + U * 0.3);
    ctx.lineTo(x0 + w * 0.5, base - wallH - U * 5.6);
    ctx.lineTo(x0 + w + U * 1.4, base - wallH + U * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tint('#1e2234', sky, 0.2);
    ctx.fillRect(x0 - U * 1.4, base - wallH + U * 0.1, w + U * 2.8, Math.max(1, U * 0.45));
    // stacked rice straw bundle beside the hut
    ctx.fillStyle = tint('#b99a54', sky, 0.3);
    ctx.beginPath();
    ctx.moveTo(x0 + w + U * 2.2, base);
    ctx.lineTo(x0 + w + U * 3.1, base - U * 4.2);
    ctx.lineTo(x0 + w + U * 4, base);
    ctx.fill();
  }

  function paintBank(ctx, g, sky, rand) {
    const U = g.U;
    const base = g.H * HOR;
    // low tree line
    ctx.fillStyle = tint('#3d5638', sky, 0.2);
    for (let x = 0; x < g.W; x += U * 1.2) {
      const r = U * (1.3 + rand() * 1.6);
      ctx.beginPath();
      ctx.arc(x, base - U * 0.6, r, Math.PI, 0);
      ctx.fill();
    }
    const cedarCol = tint('#26382f', sky, 0.15);
    const spots = [0.6, 0.64, 0.93, 0.965, 0.05, 0.09, 0.34, 0.37];
    for (let i = 0; i < spots.length; i++) {
      const h = U * (11 + rand() * 6);
      cedar(ctx, g.W * spots[i], base + U * 0.2, U * 5, h, cedarCol);
    }
    paintHut(ctx, g, sky);
    ctx.fillStyle = tint('#4e6a3e', sky, 0.22);
    ctx.fillRect(0, base, g.W, Math.max(1, U * 0.7));
  }

  // ---- seedlings in perspective -----------------------------------------

  function seedlingRows(ctx, g, sky) {
    const hor = g.H * HOR;
    const depth = g.H - hor;
    const A = depth * 2;
    const dark = tint('#3e5a35', sky, 0.15);
    const mid = tint('#6c8a48', sky, 0.28);
    const light = tint('#8aa45e', sky, 0.3);
    const shadow = hex(mixColor(mixColor(sky.top, rgb('#1a2230'), 0.6), NIGHT_INK, sky.night * 0.4));
    const cx = g.W * 0.5;
    const stepZ = 0.3;
    let rowIndex = 0;
    for (let z = 26; z >= 2.1; z -= stepZ) {
      const y = hor + A / z;
      rowIndex++;
      if (y < hor + g.U * 1.6 || y > g.H - g.U * 0.5) continue;
      const lat = stepZ * 0.7 * (y - hor);
      const stride = Math.max(1, Math.ceil(2.2 / lat));
      const spacing = lat * stride;
      const h = Math.max(1.2, lat * 0.62);
      const off = (rowIndex % 2) * spacing * 0.5;
      const startI = Math.floor(-cx / spacing) - 1;
      const endI = Math.ceil(cx / spacing) + 1;
      ctx.lineWidth = Math.max(1, lat * 0.07);
      ctx.lineCap = 'round';
      // reflections, then three tones of leaf per row
      ctx.fillStyle = shadow;
      ctx.globalAlpha = 0.55;
      for (let i = startI; i <= endI; i++) {
        const x = cx + i * spacing + off;
        ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, Math.max(1, Math.round(h * 0.55)));
      }
      ctx.globalAlpha = 1;
      const tones = [dark, mid, light];
      for (let tone = 0; tone < 3; tone++) {
        ctx.strokeStyle = tones[tone];
        ctx.beginPath();
        for (let i = startI; i <= endI; i++) {
          const x = cx + i * spacing + off;
          const lean = (tone - 1) * h * 0.38;
          const hh = h * (tone === 1 ? 1 : 0.8);
          ctx.moveTo(x, y);
          ctx.lineTo(x + lean, y - hh);
        }
        ctx.stroke();
      }
    }
  }

  function paintBund(ctx, g, sky, yf, thick, seed) {
    const y = g.H * yf;
    const t = Math.max(1.4, g.U * thick);
    const top = tint('#6f8a46', sky, 0.28);
    const body = tint('#4e6a3c', sky, 0.2);
    const earth = tint('#5a4a3a', sky, 0.2);
    const shade = tint('#25301f', sky, 0.1);
    const sag = g.U * 0.9;
    const path = (dy, h) => {
      ctx.beginPath();
      ctx.moveTo(0, y + dy);
      ctx.bezierCurveTo(g.W * 0.3, y + dy + sag, g.W * 0.7, y + dy - sag, g.W, y + dy);
      ctx.lineTo(g.W, y + dy + h);
      ctx.bezierCurveTo(g.W * 0.7, y + dy + h - sag, g.W * 0.3, y + dy + h + sag, 0, y + dy + h);
      ctx.closePath();
    };
    path(0, t * 1.15);
    ctx.fillStyle = shade;
    ctx.fill();
    path(-t * 0.1, t);
    ctx.fillStyle = earth;
    ctx.fill();
    path(-t * 0.35, t * 0.7);
    ctx.fillStyle = body;
    ctx.fill();
    path(-t * 0.55, t * 0.3);
    ctx.fillStyle = top;
    ctx.fill();
    // grass tufts along the bund
    const rand = K.rng(seed);
    ctx.strokeStyle = top;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < g.W; x += 2 + rand() * 3) {
      const bx = x;
      const by = y + Math.sin((x / g.W) * Math.PI) * sag * 0.0 + (bx / g.W - 0.5) * 0;
      const h = t * (0.5 + rand() * 0.7);
      ctx.moveTo(bx, by - t * 0.4);
      ctx.lineTo(bx + (rand() - 0.5) * 2, by - t * 0.4 - h);
    }
    ctx.stroke();
  }

  function paintForeground(ctx, g, sky, rand) {
    const base = g.H;
    const col = tint('#31452d', sky, 0.15);
    const col2 = tint('#4c6a3a', sky, 0.2);
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = k ? col2 : col;
      ctx.lineWidth = Math.max(1, g.U * 0.3);
      ctx.beginPath();
      for (let i = 0; i < g.W * 0.45; i++) {
        const side = rand() < 0.5 ? 0 : 1;
        const x = side ? g.W * (1 - Math.pow(rand(), 2) * 0.16) : g.W * Math.pow(rand(), 2) * 0.16;
        const h = g.U * (2 + rand() * 5);
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(x + (rand() - 0.5) * g.U, base - h * 0.6, x + (rand() - 0.5) * g.U * 3, base - h);
      }
      ctx.stroke();
    }
  }

  function paintFront(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(77);
    paintBank(ctx, g, sky, rand);
    seedlingRows(ctx, g, sky);
    const hor = HOR;
    paintBund(ctx, g, sky, hor + (1 - hor) * 0.18, 1.5, 3);
    paintBund(ctx, g, sky, hor + (1 - hor) * 0.52, 2.6, 5);
    paintForeground(ctx, g, sky, rand);
    return c;
  }

  // ---- heron -------------------------------------------------------------

  function drawHeron(ctx, g, x, y, strike, sway, flip, cols) {
    const U = g.U * 1.25;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(1, -1);
    ctx.lineCap = 'round';
    // legs
    ctx.strokeStyle = cols.leg;
    ctx.lineWidth = Math.max(1, U * 0.25);
    ctx.beginPath();
    ctx.moveTo(-U * 0.4, -U * 5.4);
    ctx.lineTo(-U * 0.6, 0);
    ctx.moveTo(U * 0.6, -U * 5.4);
    ctx.lineTo(U * 0.9, 0);
    ctx.stroke();
    // body
    const lean = strike * U * 0.9;
    ctx.fillStyle = cols.body;
    ctx.save();
    ctx.translate(lean * 0.4, -U * 6.6 + strike * U * 0.4);
    ctx.rotate(-0.6 + strike * 0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, U * 3.3, U * 1.7, 0, 0, 6.3);
    ctx.fill();
    // tail wedge
    ctx.beginPath();
    ctx.moveTo(-U * 2.8, -U * 0.8);
    ctx.lineTo(-U * 5.2, U * 0.8);
    ctx.lineTo(-U * 2.6, U * 1.0);
    ctx.fill();
    ctx.restore();
    // neck: an S at rest, reaching down for the strike
    const sx = U * 1.8 + lean * 0.5;
    const sy = -U * 7.8 + strike * U * 0.6;
    const hx = U * (3.4 + 4.4 * strike) + sway * U * 0.4;
    const hy = -U * (14.2 - 12.4 * strike) + sway * U * 0.15;
    ctx.strokeStyle = cols.body;
    ctx.lineWidth = Math.max(1, U * 0.95);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx - U * 2.4 * (1 - strike), sy - U * 3, hx - U * 2.6 * (1 - strike), hy + U * 3, hx, hy);
    ctx.stroke();
    // head and bill
    ctx.fillStyle = cols.body;
    ctx.beginPath();
    ctx.arc(hx, hy, Math.max(1, U * 0.72), 0, 6.3);
    ctx.fill();
    const ang = 0.12 + strike * 1.15;
    ctx.strokeStyle = cols.beak;
    ctx.lineWidth = Math.max(1, U * 0.4);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(ang) * U * 2.8, hy + Math.sin(ang) * U * 2.8);
    ctx.stroke();
    ctx.restore();
  }

  // ---- repaint and motion ------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    const hills = paintHills(g, sky);
    state.sky = paintSky(g, sky, hills, rand);
    state.water = paintWater(g, sky, hills);
    state.front = paintFront(g, sky);
    state.cloudAlpha = 0.8 - sky.night * 0.55;
    state.dim = sky.night;
    state.glint = hex(mixColor(sky.low, rgb('#ffffff'), 0.45));
    state.heronCols = {
      body: tint('#ece8dc', sky, 0.3),
      leg: tint('#2a2620', sky, 0.1),
      beak: tint('#c9a24a', sky, 0.25),
    };
    state.ring = hex(mixColor(sky.low, rgb('#ffffff'), 0.4));
    state.bird = tint('#1c1e2c', sky, 0.1);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.3) % c.width);
    const hor = g.H * HOR;
    const alpha = Math.min(1, state.cloudAlpha * amount);
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    // Reflection in the flooded fields: mirrored, stretched, a little dimmer.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hor + 1, g.W, g.H - hor);
    ctx.clip();
    ctx.translate(0, hor);
    ctx.scale(1, -1.8);
    ctx.translate(0, -hor);
    ctx.globalAlpha = alpha * 0.5;
    const wob = Math.sin(t * 0.5) * g.U * 0.25;
    ctx.drawImage(c, off + wob, g.H * 0.03);
    ctx.drawImage(c, off + wob + c.width, g.H * 0.03);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function seedGlints(g) {
    const hor = g.H * HOR;
    const rand = K.rng(12);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      const f = Math.pow(rand(), 1.4);
      state.glints.push({ x: rand() * g.W, y: hor + g.U * 2 + f * (g.H - hor - g.U * 4), f, ph: rand() * 6.3, sp: 0.15 + rand() * 0.2 });
    }
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = state.glint;
    for (let i = 0; i < state.glints.length; i++) {
      const s = state.glints[i];
      const a = 0.5 + 0.5 * Math.sin(t * s.sp * 2 + s.ph);
      ctx.globalAlpha = (0.06 + 0.16 * a) * (1 - state.dim * 0.6);
      const w = g.U * (1.5 + s.f * 6);
      ctx.fillRect(s.x + Math.sin(t * s.sp + s.ph) * g.U * 1.2, s.y, w, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawHeronScene(ctx, g, t) {
    const hx = g.W * 0.3 + Math.sin(t * 0.07) * g.U * 3;
    const hy = g.H * 0.855;
    const q = (t % STRIKE_CYCLE) / STRIKE_CYCLE;
    const strike = smoothstep(0.56, 0.63, q) * (1 - smoothstep(0.66, 0.78, q));
    const sway = Math.sin(t * 0.5);
    // reflection first, then the bird
    ctx.globalAlpha = 0.28;
    drawHeron(ctx, g, hx, hy, strike, sway, true, state.heronCols);
    ctx.globalAlpha = 1;
    drawHeron(ctx, g, hx, hy, strike, sway, false, state.heronCols);
    // slow rings around the feet
    ctx.strokeStyle = state.ring;
    ctx.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      const a = ((t * 0.12 + k * 0.5) % 1);
      ctx.globalAlpha = (1 - a) * 0.35 * (1 - state.dim * 0.5);
      ctx.beginPath();
      ctx.ellipse(hx, hy + 1, g.U * (0.8 + a * 5), g.U * (0.3 + a * 1.4), 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Two swallows skimming over the paddies in daylight.
  function drawSwallows(ctx, g, t) {
    const vis = 1 - state.dim;
    if (vis < 0.15) return;
    ctx.strokeStyle = state.bird;
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    ctx.lineCap = 'round';
    ctx.globalAlpha = vis;
    for (let i = 0; i < 2; i++) {
      const p = ((t * (0.022 + i * 0.006) + i * 0.47) % 1);
      const x = g.W * (1.1 - p * 1.2);
      const y = g.H * (0.5 + i * 0.07) + Math.sin(t * 0.9 + i * 2) * g.U * 2.5;
      const flap = Math.sin(t * 9 + i) * g.U * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.6, y + flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + g.U * 1.6, y + flap);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.31));
    seedGlints(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.water, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    drawGlints(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    if (props.heron) drawHeronScene(ctx, g, t);
    drawSwallows(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, heron: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
