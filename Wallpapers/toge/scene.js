/*
 * 峠 Toge — a mountain pass at the top of the road.
 *
 * Sky, five ridges, the hill, the stone marker, maples and the pine are baked
 * into layers and repainted once a minute from the clock. Between repaints
 * only two mist drifts, the pampas stalks, a slight sway of the pine and a
 * kite high up move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const RIDGE_BASE = [0.46, 0.55, 0.64, 0.72, 0.8];
  const RIDGE_AMP = [0.2, 0.2, 0.19, 0.16, 0.12];
  const NOTCH = 0.47;
  const HILL = 0.8;
  const STONE = { x: 0.3, y: 0.92 };
  const PINE = { x: 0.8, y: 0.93 };
  const STALKS = 44;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour pulled toward the night ink when the sun is down.
  function dark(c, sky, amount) {
    return mixColor(c, rgb('#0e1322'), sky.night * amount * 0.75);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.72);
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
    }
    paintBody(ctx, g, sky);
    return c;
  }

  function disc(ctx, cx, cy, r, color, glow) {
    const halo = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 5);
    halo.addColorStop(0, color.replace(')', `,${glow})`).replace('rgb(', 'rgba('));
    halo.addColorStop(1, color.replace(')', ',0)').replace('rgb(', 'rgba('));
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 5, cy - r * 5, r * 10, r * 10);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
  }

  // Sun low over the ridges by day, a pale moon at night.
  function paintBody(ctx, g, sky) {
    const h = sky.hour;
    if (h > 6 && h < 19.5) {
      const t = S.sunT(h);
      const low = 1 - Math.sin(t * Math.PI);
      const col = mixColor(rgb('#f4ead0'), rgb('#d6552e'), smoothstep(0.35, 0.95, low));
      const c = `rgb(${col.map((v) => Math.round(v)).join(',')})`;
      disc(ctx, g.W * lerp(0.18, 0.55, t), g.H * lerp(0.36, 0.14, Math.sin(t * Math.PI)), g.U * 3.4, c, 0.35);
    } else {
      const t = S.moonT(h);
      disc(ctx, g.W * lerp(0.25, 0.7, t), g.H * lerp(0.3, 0.12, Math.sin(t * Math.PI)), g.U * 2.6, 'rgb(236,232,214)', 0.22);
    }
  }

  // ---- ridges ------------------------------------------------------------

  function ridgeY(g, x, k) {
    const n = K.clamp((fbm(x * 0.008, k * 5.3, 4, 40 + k) - 0.3) / 0.4, 0, 1);
    const r = 1 - Math.abs(2 * fbm(x * 0.005 + 9, k * 2.1, 3, 70 + k) - 1);
    const d = (x / g.W - NOTCH) / 0.14;
    const notch = k >= 3 ? 1 - 0.7 * Math.exp(-d * d) : 1;
    const shape = K.clamp(0.15 + 0.95 * r * r * 0.6 + 0.5 * n * 0.6, 0, 1);
    return g.H * RIDGE_BASE[k] - g.H * RIDGE_AMP[k] * shape * notch;
  }

  function ridgeColor(sky, k) {
    const d = k / (RIDGE_BASE.length - 1);
    const far = mixColor(sky.haze, sky.low, 0.6);
    const near = mixColor(rgb('#2a4440'), sky.haze, 0.12);
    return dark(mixColor(far, near, Math.pow(d, 0.9)), sky, 0.45);
  }

  function paintRidge(ctx, g, sky, k) {
    const col = ridgeColor(sky, k);
    const foot = g.H * (RIDGE_BASE[k] + 0.12);
    const top = g.H * (RIDGE_BASE[k] - RIDGE_AMP[k]);
    const grad = ctx.createLinearGradient(0, top, 0, foot);
    grad.addColorStop(0, hex(col));
    grad.addColorStop(1, hex(mixColor(col, sky.low, 0.5 - k * 0.1)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, ridgeY(g, x, k));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    // A few dark cedar strokes on the nearer slopes.
    if (k >= 2) {
      ctx.fillStyle = hex(dark(mixColor(rgb('#26402f'), col, 0.4), sky, 0.7));
      const rand = K.rng(90 + k);
      for (let i = 0; i < g.W * 0.35; i++) {
        const x = rand() * g.W;
        const y = ridgeY(g, x, k) + rand() * g.U * 3.5;
        ctx.fillRect(x, y, 1, Math.max(1, g.U * (0.5 + 0.2 * k)));
      }
    }
  }

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(paintSky(g, sky, rand), 0, 0);
    paintRidge(ctx, g, sky, 0);
    paintRidge(ctx, g, sky, 1);
    return c;
  }

  function paintMid(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidge(ctx, g, sky, 2);
    paintRidge(ctx, g, sky, 3);
    return c;
  }

  // ---- mist --------------------------------------------------------------

  // A wide band of streaky mist that tiles sideways.
  function paintMist(w, h, sky, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tint = mixColor(mixColor(sky.low, rgb('#f2efe6'), 0.5), rgb('#232a44'), sky.night * 0.6);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.012, y * 0.09, 4, seed);
        const b = fbm((x - w) * 0.012, y * 0.09, 4, seed);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.42, 0.68, v) * band * 215;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- hill, path, stone, maples, grass --------------------------------

  function hillY(g, x) {
    return g.H * HILL + Math.sin(x / g.W * 5.2) * g.U * 1.6 + (fbm(x * 0.02, 3, 3, 12) - 0.5) * g.U * 3
      - smoothstep(0.1, 0.55, x / g.W) * smoothstep(0.85, 0.5, x / g.W) * g.U * 3.5;
  }

  function paintHill(ctx, g, sky) {
    const moss = dark(mixColor(rgb('#56683f'), sky.amb, 0.22), sky, 0.7);
    const deep = dark(mixColor(rgb('#2f4533'), sky.amb, 0.15), sky, 0.7);
    const grad = ctx.createLinearGradient(0, g.H * (HILL - 0.04), 0, g.H);
    grad.addColorStop(0, hex(moss));
    grad.addColorStop(1, hex(deep));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, hillY(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    // Dry gold along the crest where the sun catches it.
    ctx.fillStyle = hex(dark(mixColor(rgb('#c4a352'), sky.amb, 0.3), sky, 0.7));
    ctx.globalAlpha = 0.55;
    for (let x = 0; x < g.W; x += 1) ctx.fillRect(x, hillY(g, x), 1, Math.max(1, g.U * 0.8));
    ctx.globalAlpha = 1;
  }

  // The road climbing to the notch, pale earth narrowing with distance.
  function paintPath(ctx, g, sky) {
    const earth = dark(mixColor(rgb('#b9a98a'), sky.amb, 0.3), sky, 0.65);
    const top = g.H * (HILL - 0.02);
    ctx.fillStyle = hex(earth);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.462, top);
    ctx.bezierCurveTo(g.W * 0.43, g.H * 0.86, g.W * 0.52, g.H * 0.9, g.W * 0.46, g.H);
    ctx.lineTo(g.W * 0.58, g.H);
    ctx.bezierCurveTo(g.W * 0.6, g.H * 0.92, g.W * 0.49, g.H * 0.86, g.W * 0.478, top);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hex(mixColor(earth, rgb('#4a4036'), 0.35));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.47, top);
    ctx.bezierCurveTo(g.W * 0.45, g.H * 0.87, g.W * 0.53, g.H * 0.91, g.W * 0.5, g.H);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function paintStone(ctx, g, sky) {
    const u = g.U;
    const bx = g.W * STONE.x;
    const by = g.H * STONE.y;
    const body = dark(mixColor(rgb('#9a9a92'), sky.amb, 0.3), sky, 0.7);
    const shade = mixColor(body, rgb('#3a4048'), 0.4);
    const w = u * 5;
    const h = u * 17;
    ctx.fillStyle = hex(body);
    ctx.fillRect(bx - w / 2, by - h, w, h);
    ctx.fillStyle = hex(shade);
    ctx.fillRect(bx + w * 0.12, by - h, w * 0.38, h);
    // Little pitched roof of stone on top.
    ctx.fillStyle = hex(mixColor(body, rgb('#5a5e60'), 0.35));
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.95, by - h);
    ctx.lineTo(bx, by - h - u * 3.4);
    ctx.lineTo(bx + w * 0.95, by - h);
    ctx.closePath();
    ctx.fill();
    // Carved panel and moss at the foot.
    ctx.fillStyle = hex(mixColor(body, rgb('#30343a'), 0.45));
    ctx.fillRect(bx - w * 0.2, by - h * 0.82, Math.max(1, w * 0.3), h * 0.5);
    ctx.fillStyle = hex(dark(rgb('#51693a'), sky, 0.7));
    ctx.fillRect(bx - w / 2, by - u * 1.1, w, u * 1.1);
    // Two offering stones beside it.
    ctx.fillStyle = hex(shade);
    ctx.beginPath();
    ctx.ellipse(bx + w * 1.4, by - u * 0.5, u * 1.3, u * 0.6, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = hex(body);
    ctx.beginPath();
    ctx.ellipse(bx + w * 1.4, by - u * 1.2, u * 0.8, u * 0.45, 0, 0, 6.3);
    ctx.fill();
  }

  // Red and gold maples on the left shoulder.
  function paintMaples(ctx, g, sky, rand) {
    const cols = ['#c0442b', '#d6452c', '#d29a3c', '#a8532a'];
    const trunk = hex(dark(rgb('#3a2c26'), sky, 0.6));
    for (const t of [{ x: 0.09, s: 1.15 }, { x: 0.17, s: 0.85 }, { x: 0.215, s: 0.65 }]) {
      const bx = g.W * t.x;
      const by = hillY(g, bx) + g.U * 1.2;
      const s = g.U * t.s;
      ctx.fillStyle = trunk;
      ctx.fillRect(bx - s * 0.35, by - s * 7, s * 0.7, s * 7);
      for (let i = 0; i < 40; i++) {
        const a = rand() * 6.3;
        const r = Math.sqrt(rand()) * s * 6;
        ctx.fillStyle = hex(dark(rgb(cols[Math.floor(rand() * cols.length)]), sky, 0.6));
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(a) * r * 1.2, by - s * 10 + Math.sin(a) * r * 0.75, s * (0.9 + rand() * 1.3), 0, 6.3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Short grass blades over the lower hill.
  function paintBlades(ctx, g, sky, rand) {
    const cols = ['#4d6b3e', '#6a7a45', '#a0914a', '#2f4a36'];
    for (let i = 0; i < g.W * g.H * 0.012; i++) {
      const x = rand() * g.W;
      const y = g.H * (HILL + 0.01) + rand() * (g.H * (1 - HILL - 0.01));
      ctx.strokeStyle = hex(dark(rgb(cols[Math.floor(rand() * cols.length)]), sky, 0.7));
      ctx.globalAlpha = 0.55 + rand() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 0.8, y - g.U * (0.8 + rand() * 1.6));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineWidth = 1;
    paintRidge(ctx, g, sky, 4);
    paintHill(ctx, g, sky);
    paintPath(ctx, g, sky);
    paintMaples(ctx, g, sky, rand);
    paintStone(ctx, g, sky);
    paintBlades(ctx, g, sky, rand);
    return c;
  }

  // ---- pine --------------------------------------------------------------

  // Bent trunk and flat layered pads, baked on its own canvas so it can sway.
  function paintPine(g, sky, rand) {
    const u = g.U * 1.3;
    const w = Math.ceil(u * 34);
    const h = Math.ceil(u * 44);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const bx = w * 0.45;
    const by = h - 1;
    const bark = hex(dark(rgb('#4a362c'), sky, 0.6));
    ctx.strokeStyle = bark;
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx - u * 4, by - u * 14, bx + u * 5, by - u * 24, bx + u * 1, by - u * 36);
    ctx.stroke();
    ctx.lineWidth = u * 0.9;
    const arms = [
      { y: 14, dx: -1, len: 9 }, { y: 22, dx: 1, len: 11 }, { y: 29, dx: -1, len: 7 }, { y: 36, dx: 1, len: 6 },
    ];
    const pads = [];
    for (const a of arms) {
      const ax = bx + (a.y > 24 ? u * 2 : 0) + (a.y === 14 ? -u * 2 : 0);
      const ay = by - u * a.y;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + a.dx * u * a.len * 0.5, ay - u * 2, ax + a.dx * u * a.len, ay - u * 1.5);
      ctx.stroke();
      pads.push({ x: ax + a.dx * u * a.len, y: ay - u * 2.2, r: u * (a.len * 0.55 + 2) });
    }
    pads.push({ x: bx + u * 1, y: by - u * 37, r: u * 5 });
    for (const p of pads) paintPad(ctx, u, sky, rand, p);
    return c;
  }

  // One cloud-shaped tuft: dark underside, lighter flat top, needle ticks.
  function paintPad(ctx, u, sky, rand, p) {
    const deep = dark(rgb('#2a4332'), sky, 0.7);
    const lit = dark(mixColor(rgb('#4c6a40'), sky.amb, 0.2), sky, 0.7);
    for (let i = 0; i < 6; i++) {
      const ox = (rand() - 0.5) * p.r * 1.5;
      const oy = (rand() - 0.5) * p.r * 0.35;
      ctx.fillStyle = hex(deep);
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy, p.r * 0.5, p.r * 0.2, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = hex(lit);
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy - p.r * 0.1, p.r * 0.42, p.r * 0.12, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.strokeStyle = hex(deep);
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = p.x + (rand() - 0.5) * p.r * 1.8;
      const y = p.y + p.r * 0.1 + rand() * p.r * 0.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * u, y + u * (0.6 + rand()));
      ctx.stroke();
    }
  }

  // ---- stalks (animated) -------------------------------------------------

  function initStalks(g, sky) {
    const rand = K.rng(55);
    const s = { x: new Float32Array(STALKS), y: new Float32Array(STALKS), h: new Float32Array(STALKS), ph: new Float32Array(STALKS) };
    for (let i = 0; i < STALKS; i++) {
      s.x[i] = rand() * g.W;
      s.y[i] = g.H * (0.84 + rand() * 0.15);
      s.h[i] = g.U * (7 + rand() * 7) * (0.7 + (s.y[i] / g.H - 0.84) * 3);
      s.ph[i] = rand() * 6.3;
    }
    state.stalks = s;
    state.stalkInk = hex(dark(mixColor(rgb('#8a8450'), sky.amb, 0.2), sky, 0.7));
    state.plumeA = hex(dark(mixColor(rgb('#e8e0c8'), sky.amb, 0.3), sky, 0.6));
    state.plumeB = hex(dark(mixColor(rgb('#c9a85a'), sky.amb, 0.2), sky, 0.6));
  }

  function drawStalks(ctx, g, t, wind) {
    const s = state.stalks;
    const gust = 0.65 + 0.35 * Math.sin(t * 0.35);
    const amp = g.U * (0.6 + 2.6 * gust) * wind;
    ctx.strokeStyle = state.stalkInk;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < STALKS; i++) {
      const sway = Math.sin(t * 1.7 + s.ph[i] + s.x[i] * 0.03) * amp + amp * 0.8;
      ctx.moveTo(s.x[i], s.y[i]);
      ctx.quadraticCurveTo(s.x[i] + sway * 0.2, s.y[i] - s.h[i] * 0.6, s.x[i] + sway, s.y[i] - s.h[i]);
    }
    ctx.stroke();
    for (let i = 0; i < STALKS; i++) {
      const sway = Math.sin(t * 1.7 + s.ph[i] + s.x[i] * 0.03) * amp + amp * 0.8;
      ctx.fillStyle = i % 3 ? state.plumeA : state.plumeB;
      ctx.beginPath();
      ctx.ellipse(s.x[i] + sway + sway * 0.1, s.y[i] - s.h[i] - g.U * 0.8, g.U * 0.7, g.U * 1.9, sway * 0.04, 0, 6.3);
      ctx.fill();
    }
  }

  // ---- bake and draw -----------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.back = paintBack(g, sky, rand);
    state.mid = paintMid(g, sky);
    state.front = paintFront(g, sky, rand);
    state.pine = paintPine(g, sky, rand);
    state.mistA = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.11), sky, 21);
    state.mistB = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.13), sky, 33);
    initStalks(g, sky);
    state.night = sky.night;
    state.ink = hex(dark(rgb('#2a2c3a'), sky, 0.5));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawMist(ctx, g, t, c, y, speed, alpha) {
    if (alpha <= 0) return;
    const off = -((t * g.U * speed) % c.width);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function drawPine(ctx, g, t, wind) {
    const p = state.pine;
    const sway = Math.sin(t * 0.9) * 0.012 * wind + Math.sin(t * 0.37) * 0.008 * wind;
    ctx.save();
    ctx.translate(g.W * PINE.x, g.H * PINE.y);
    ctx.rotate(sway);
    ctx.drawImage(p, -p.width * 0.45, -p.height + 1);
    ctx.restore();
  }

  // A kite turning slowly high over the ridges.
  function drawKite(ctx, g, t) {
    if (state.night > 0.6) return;
    const a = t * 0.12;
    const x = g.W * (0.5 + 0.22 * Math.cos(a));
    const y = g.H * (0.2 + 0.05 * Math.sin(a * 1.7));
    const flap = Math.sin(t * 1.3) * g.U * 0.4;
    ctx.strokeStyle = state.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - g.U * 2.2, y + flap);
    ctx.lineTo(x, y - g.U * 0.5);
    ctx.lineTo(x + g.U * 2.2, y + flap);
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    const mist = props.mist;
    ctx.drawImage(state.back, 0, 0);
    drawKite(ctx, g, t);
    drawMist(ctx, g, t, state.mistA, g.H * 0.4, 2.2, 0.65 * mist);
    ctx.drawImage(state.mid, 0, 0);
    drawMist(ctx, g, t + 40, state.mistB, g.H * 0.56, 3.6, 0.85 * mist);
    ctx.drawImage(state.front, 0, 0);
    drawPine(ctx, g, t, props.wind);
    drawStalks(ctx, g, t, props.wind);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
