/*
 * 阿蘇 Aso — the vast grassy caldera in Kyushu, Nakadake steaming above the plain.
 *
 * Sky, rim, cones, grass, shrine gate and silver grass are baked into layers and
 * repainted once a minute from the clock. Between repaints only clouds, their
 * shadows, the steam plume and a few grazing horses move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const RIM = 0.40;
  const FLOOR = 0.52;
  const CRATER = { x: 0.56, y: 0.235 };
  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 14;
  const HORSES = [
    { x: 0.2, y: 0.8, s: 1.5, coat: '#6b4a34', phase: 0.0, dir: 1 },
    { x: 0.3, y: 0.75, s: 1.2, coat: '#3a2c26', phase: 2.1, dir: -1 },
    { x: 0.7, y: 0.7, s: 1.0, coat: '#8a6a44', phase: 4.0, dir: 1 },
    { x: 0.8, y: 0.78, s: 1.4, coat: '#5a3e2e', phase: 1.2, dir: -1 },
  ];
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

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * FLOOR);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.35, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.012, y * 0.06, 4, 33);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 246;
        img.data[i + 3] = smoothstep(0.52, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(240,240,236,0.55)');
    grad.addColorStop(1, 'rgba(240,240,236,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // A soft dark patch laid on the grass as a cloud shadow.
  function paintShadow(g) {
    const w = Math.ceil(g.W * 0.35);
    const h = Math.ceil(g.H * 0.12);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(20,34,40,0.5)');
    grad.addColorStop(1, 'rgba(20,34,40,0)');
    ctx.save();
    ctx.scale(1, h / w);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, w);
    ctx.restore();
    return c;
  }

  // ---- land --------------------------------------------------------------

  // Outer rim of the caldera: a long low wall with gentle humps.
  function rimY(g, x) {
    const f = x / g.W;
    const hump = Math.sin(f * 7 + 1) * 0.012 + Math.sin(f * 17) * 0.005;
    const ends = Math.pow(Math.abs(f - 0.5) * 2, 3) * 0.05;
    return g.H * (RIM - ends - hump) + (fbm(x * 0.05, 1, 3, 5) - 0.5) * g.U * 0.8;
  }

  // The five peaks: a jagged west (Nekodake), the tall cone, a broad crown, two soft knolls.
  function coneY(g, x) {
    const f = x / g.W;
    const peaks = [
      { c: 0.33, h: 0.19, w: 0.1, jag: 1.0 },
      { c: 0.43, h: 0.24, w: 0.12, jag: 0.4 },
      { c: CRATER.x, h: FLOOR - CRATER.y, w: 0.17, jag: 0.15 },
      { c: 0.70, h: 0.22, w: 0.11, jag: 0.3 },
      { c: 0.79, h: 0.14, w: 0.09, jag: 0.2 },
    ];
    let best = g.H * FLOOR;
    for (const p of peaks) {
      const d = Math.abs(f - p.c) / p.w;
      if (d >= 1) continue;
      let h = p.h * Math.pow(1 - d, 1.25);
      h += (fbm(x * 0.2, 7 + p.c * 9, 3, 13) - 0.5) * 0.03 * p.jag;
      if (p === peaks[2] && d < 0.12) h = Math.min(h, p.h * 0.9);
      best = Math.min(best, g.H * (FLOOR - h));
    }
    return best;
  }

  function paintRim(ctx, g, sky) {
    const col = mixColor(mixColor(rgb('#587a76'), sky.haze, 0.45), rgb('#1c2638'), sky.night * 0.65);
    ctx.fillStyle = hex(col);
    ctx.beginPath();
    ctx.moveTo(0, g.H * FLOOR);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, rimY(g, x));
    ctx.lineTo(g.W, g.H * FLOOR);
    ctx.closePath();
    ctx.fill();
  }

  function paintCones(ctx, g, sky) {
    const x0 = Math.floor(g.W * 0.2);
    const x1 = Math.ceil(g.W * 0.9);
    const y0 = Math.floor(g.H * 0.18);
    const y1 = Math.ceil(g.H * FLOOR + 1);
    const w = x1 - x0;
    const h = y1 - y0;
    const img = ctx.getImageData(x0, y0, w, h);
    const lit = mixColor(rgb('#7a8f6a'), sky.amb, 0.25);
    const bare = mixColor(rgb('#8b7e6e'), sky.amb, 0.2);
    const deep = rgb('#202a3a');
    for (let x = 0; x < w; x++) {
      const top = coneY(g, x0 + x);
      for (let y = Math.max(0, Math.floor(top - y0)); y < h; y++) {
        const wy = y0 + y;
        const f = (wy - top) / (g.H * 0.16);
        const streak = fbm((x0 + x) * 0.25, wy * 0.02, 3, 17);
        // Bare ash near the crowns, grass lower down.
        let c = mixColor(bare, lit, smoothstep(0.1, 0.55, f + (streak - 0.5) * 0.4));
        c = mixColor(c, sky.haze, 0.12);
        c = mixColor(c, deep, sky.night * 0.65);
        const k = 0.8 + streak * 0.35 - smoothstep(0, 0.3, f) * 0.1;
        const i = (y * w + x) * 4;
        img.data[i] = c[0] * k;
        img.data[i + 1] = c[1] * k;
        img.data[i + 2] = c[2] * k;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
    // Crater mouth: a dark notch at the crown of the main cone.
    ctx.fillStyle = hex(mixColor(rgb('#4a4238'), deep, sky.night * 0.6));
    const cx = g.W * CRATER.x;
    const cy = coneY(g, cx) + g.U * 0.5;
    poly(ctx, [cx - g.U * 3, cy - g.U * 0.4, cx + g.U * 3, cy - g.U * 0.4, cx + g.U * 1.6, cy + g.U * 1.3, cx - g.U * 1.6, cy + g.U * 1.3]);
  }

  function paintFloor(ctx, g, sky) {
    const top = g.H * FLOOR;
    const far = mixColor(mixColor(rgb('#8aa26a'), sky.haze, 0.35), rgb('#1e2a30'), sky.night * 0.7);
    const near = mixColor(mixColor(rgb('#5c8446'), sky.amb, 0.15), rgb('#16221f'), sky.night * 0.75);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Mown and unmown patches, and lighter paths across the plain.
    const img = ctx.getImageData(0, Math.floor(top), g.W, Math.ceil(g.H - top));
    const w = img.width;
    const h = img.height;
    for (let y = 0; y < h; y++) {
      const depth = y / h;
      for (let x = 0; x < w; x++) {
        const n = fbm(x * 0.035, (y * 0.07) / (0.3 + depth), 3, 41);
        const k = 0.86 + n * 0.3;
        const i = (y * w + x) * 4;
        img.data[i] *= k;
        img.data[i + 1] *= k * (1 + (n - 0.5) * 0.12);
        img.data[i + 2] *= k;
      }
    }
    ctx.putImageData(img, 0, Math.floor(top));
    // A warm band of haze where plain meets cone.
    const mist = ctx.createLinearGradient(0, top - g.U * 2, 0, top + g.U * 6);
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(0.4, 'rgba(' + sky.low.map((v) => Math.round(v)).join(',') + ',0.45)');
    mist.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, top - g.U * 2, g.W, g.U * 8);
  }

  // Small vermilion shrine gate out on the plain.
  function paintTorii(ctx, g, sky) {
    const s = g.U * 0.55;
    const bx = g.W * 0.43;
    const by = g.H * 0.585;
    const red = mixColor(rgb('#c0472f'), rgb('#3a2630'), sky.night * 0.65);
    ctx.fillStyle = hex(red);
    ctx.fillRect(bx - s * 4, by - s * 11, s * 1.1, s * 11);
    ctx.fillRect(bx + s * 3, by - s * 11, s * 1.1, s * 11);
    ctx.fillRect(bx - s * 4.5, by - s * 11.4, s * 9.2, s * 1.2);
    ctx.fillRect(bx - s * 5.5, by - s * 12.2, s * 11.2, s * 1.0);
    ctx.fillRect(bx - s * 4, by - s * 8.6, s * 8.2, s * 0.8);
    ctx.fillStyle = hex(mixColor(rgb('#2a2220'), rgb('#101218'), sky.night * 0.6));
    ctx.fillRect(bx - s * 5.5, by - s * 12.6, s * 11.2, s * 0.5);
    // Two small cedars beside it.
    ctx.fillStyle = hex(mixColor(rgb('#2f4a35'), rgb('#101a1c'), sky.night * 0.7));
    poly(ctx, [bx + s * 8, by, bx + s * 10.5, by - s * 14, bx + s * 13, by]);
    poly(ctx, [bx + s * 11.5, by, bx + s * 13.5, by - s * 10, bx + s * 15.5, by]);
  }

  // Silver grass in the foreground, leaning in the wind (baked still).
  function paintSusuki(ctx, g, sky, rand) {
    const stem = hex(mixColor(rgb('#8c8a5a'), rgb('#1e2420'), sky.night * 0.7));
    const plume = hex(mixColor(rgb('#d8cfb2'), rgb('#4a5060'), sky.night * 0.6));
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.9 + rand() * 0.14);
      const hgt = g.U * (6 + rand() * 9);
      const lean = (rand() - 0.3) * g.U * 3;
      ctx.strokeStyle = stem;
      ctx.lineWidth = Math.max(1, g.U * 0.18);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.3, y - hgt * 0.6, x + lean, y - hgt);
      ctx.stroke();
      ctx.strokeStyle = plume;
      ctx.lineWidth = Math.max(1, g.U * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + lean, y - hgt);
      ctx.lineTo(x + lean * 1.3, y - hgt - g.U * 2.4);
      ctx.stroke();
    }
  }

  // ---- horses (drawn each frame, small) -----------------------------------

  function drawHorse(ctx, g, h, t, night) {
    const s = g.U * 0.95 * h.s;
    const px = g.W * h.x;
    const py = g.H * h.y;
    const d = h.dir;
    const bob = Math.max(0, Math.sin(t * 0.6 + h.phase));
    const dip = 0.5 + bob * 0.5;
    ctx.fillStyle = h.coat;
    ctx.globalAlpha = 1 - night * 0.25;
    // Legs.
    ctx.fillRect(px - d * s * 2.2, py - s * 3, s * 0.7, s * 3);
    ctx.fillRect(px - d * s * 1.2 - s * 0.7, py - s * 3, s * 0.7, s * 3);
    ctx.fillRect(px + d * s * 1.4, py - s * 3, s * 0.7, s * 3);
    ctx.fillRect(px + d * s * 2.3 - s * 0.7, py - s * 3, s * 0.7, s * 3);
    // Body.
    ctx.beginPath();
    ctx.ellipse(px, py - s * 4.2, s * 3.3, s * 1.7, 0, 0, TAU);
    ctx.fill();
    // Neck and head sloping down to the grass.
    const nx = px + d * s * 2.8;
    const ny = py - s * 5;
    const hx = nx + d * s * 2.4;
    const hy = py - s * (1.2 + dip * 2.4);
    ctx.beginPath();
    ctx.moveTo(nx - d * s * 0.4, ny - s * 0.8);
    ctx.lineTo(nx + d * s * 0.9, ny + s * 0.9);
    ctx.lineTo(hx + d * s * 0.2, hy + s * 0.9);
    ctx.lineTo(hx - d * s * 0.6, hy - s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx + d * s * 0.5, hy + s * 0.5, s * 1.1, s * 0.6, d * 0.7, 0, TAU);
    ctx.fill();
    // Tail.
    const sway = Math.sin(t * 1.3 + h.phase) * s * 0.4;
    ctx.fillRect(px - d * s * 3.6 + sway, py - s * 5.2, s * 0.7, s * 2.6);
    ctx.globalAlpha = 1;
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRim(ctx, g, sky);
    paintCones(ctx, g, sky);
    paintFloor(ctx, g, sky);
    paintTorii(ctx, g, sky);
    paintSusuki(ctx, g, sky, rand);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(19);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.75 - sky.night * 0.5;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 3) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawShadows(ctx, g, t, amount) {
    if (amount <= 0) return;
    const sh = state.shadow;
    const span = g.W + sh.width;
    const a = Math.min(1, amount) * (1 - state.dim * 0.7);
    ctx.globalAlpha = a;
    ctx.drawImage(sh, ((t * g.U * 2.4) % span) - sh.width, g.H * 0.6);
    ctx.drawImage(sh, ((t * g.U * 2.4 + span * 0.55) % span) - sh.width, g.H * 0.74);
    ctx.globalAlpha = 1;
  }

  // Steam rising from Nakadake and leaning east.
  function drawSteam(ctx, g, t, amount) {
    if (amount <= 0) return;
    const px = g.W * CRATER.x;
    const py = coneY(g, px) + g.U * 0.5;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.1 + i / MAX_PUFFS) % 1;
      const size = g.U * (3 + a * 16);
      const dx = a * g.W * 0.1 + Math.sin(t * 0.5 + i * 1.7) * g.U * 0.8;
      const dy = -a * g.H * 0.17;
      ctx.globalAlpha = Math.min(1, (1 - a) * 0.9 * amount) * (1 - state.dim * 0.4);
      ctx.drawImage(state.puff, px + dx - size / 2, py + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.puff = paintPuff();
    state.shadow = paintShadow(g);
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
    drawShadows(ctx, g, t, props.clouds);
    drawSteam(ctx, g, t, props.steam);
    for (let i = 0; i < HORSES.length; i++) drawHorse(ctx, g, HORSES[i], t, state.dim);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
