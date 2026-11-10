/*
 * 敦煌 Dunhuang — a crescent spring among the sand dunes, with a small
 * pavilion under upturned eaves on the shore.
 *
 * Sky, dunes, spring and pavilion are baked into layers and repainted once
 * a minute from the clock. Between repaints only thin clouds, the rippling
 * sand, drifting sand wisps, water glints and a few reeds move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const RETINT_SECONDS = 60;
  const RIPPLE_TOP = 0.67;
  const SPRING = { x: 0.4, y: 0.76, rx: 0.27, ry: 0.085, ix: 0.075, iy: -0.032, irx: 0.225, iry: 0.07 };
  const PAV = { x: 0.64, y: 0.745 };
  const MAX_WISPS = 16;
  const MAX_GLINTS = 9;
  const MAX_CLUMPS = 11;
  // Far to near; base is the crest height as a fraction of the height.
  const DUNES = [
    { base: 0.47, amp: 0.06, f1: 1.3, p1: 0.4, f2: 2.9, p2: 1.7, tone: 0.6 },
    { base: 0.55, amp: 0.085, f1: 1.5, p1: 2.2, f2: 3.7, p2: 0.3, tone: 0.32 },
    { base: 0.615, amp: 0.07, f1: 1.1, p1: 4.1, f2: 2.3, p2: 2.6, tone: 0.12 },
    { base: 0.655, amp: 0.012, f1: 1.5, p1: 1.0, f2: 3.1, p2: 3.3, tone: 0 },
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
  const dark = (col, sky, k) => mixColor(col, rgb('#171c30'), sky.night * k);

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.55);
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

  function paintBody(ctx, g, sky) {
    const h = sky.hour;
    const night = sky.night;
    const day = h >= 6 && h <= 19.5;
    const t = day ? S.sunT(h) : S.moonT(h);
    const bx = g.W * (0.08 + 0.84 * t);
    const by = g.H * (0.36 - 0.27 * Math.sin(Math.PI * t));
    const r = g.U * (day ? 3.4 : 2.6);
    const halo = ctx.createRadialGradient(bx, by, 0, bx, by, r * 5);
    const tint = day ? '240,214,160' : '226,224,210';
    halo.addColorStop(0, `rgba(${tint},${day ? 0.4 : 0.22})`);
    halo.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(bx - r * 5, by - r * 5, r * 10, r * 10);
    ctx.fillStyle = day ? '#f0dcae' : '#ebe8da';
    ctx.globalAlpha = day ? 0.9 - night * 0.3 : 0.9;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    state.bodyX = bx;
    state.bodyY = by;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.08, 4, 17);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.55, 0.72, v) * band * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- dunes -------------------------------------------------------------

  function ridgeY(g, d, x) {
    const u = x / g.W;
    const a = 1 - Math.abs(Math.sin(u * Math.PI * d.f1 + d.p1));
    const b = Math.sin(u * TAU * d.f2 + d.p2) * 0.35;
    return g.H * (d.base - d.amp * (a + b));
  }

  function duneColors(sky, d) {
    const lit = mixColor(mixColor(rgb('#d9b878'), sky.amb, 0.22), sky.haze, d.tone * 0.7);
    const shade = mixColor(mixColor(rgb('#a77a52'), sky.haze, 0.2), sky.haze, d.tone * 0.7);
    return { lit: dark(lit, sky, 0.82), shade: dark(shade, sky, 0.85) };
  }

  function paintDune(ctx, g, sky, d) {
    const col = duneColors(sky, d);
    const span = g.U * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x++) ctx.lineTo(x, ridgeY(g, d, x));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fillStyle = hex(col.lit);
    ctx.fill();
    // Lee side: columns where the crest falls away to the right.
    for (let x = 0; x < g.W; x++) {
      const slope = ridgeY(g, d, x + 2) - ridgeY(g, d, x - 2);
      const k = smoothstep(-span, span, slope);
      if (k < 0.05) continue;
      const top = ridgeY(g, d, x);
      ctx.globalAlpha = k;
      ctx.fillStyle = hex(col.shade);
      ctx.fillRect(x, top, 1, Math.min(g.H - top, g.H * d.amp * 2 * k));
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.clip();
    const haze = ctx.createLinearGradient(0, g.H * (d.base - d.amp), 0, g.H * (d.base + 0.1));
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(1, `rgba(${sky.haze.map(Math.round).join(',')},${0.08 + d.tone * 0.25})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();
  }

  function paintRidgeFar(ctx, g, sky) {
    // A pale range of hills behind the first dune.
    ctx.fillStyle = hex(dark(mixColor(rgb('#6a7da0'), sky.haze, 0.6), sky, 0.7));
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.5);
    for (let x = 0; x <= g.W; x += 2) {
      const y = g.H * (0.43 - 0.045 * fbm(x * 0.012, 3, 3, 8) - 0.012 * Math.sin(x * 0.03));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintBack(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidgeFar(ctx, g, sky);
    for (const d of DUNES) paintDune(ctx, g, sky, d);
    return c;
  }

  // Ripples are periodic in x so the strip can slide and loop.
  function paintRipples(g, sky) {
    const period = Math.max(8, Math.round(g.W / 3));
    const w = g.W + period;
    const top = Math.floor(g.H * RIPPLE_TOP);
    const c = layer(w, g.H - top);
    const ctx = c.getContext('2d');
    const rand = K.rng(77);
    const light = hex(dark(mixColor(rgb('#ead3a0'), sky.amb, 0.25), sky, 0.7));
    const shade = hex(dark(rgb('#8f6a48'), sky, 0.8));
    const step = Math.max(2, g.U * 1.25);
    for (let y = 2; y < c.height; y += step) {
      const k1 = Math.round(2 + rand() * 3);
      const k2 = Math.round(5 + rand() * 4);
      const ph = rand() * TAU;
      const amp = g.U * (0.25 + (y / c.height) * 0.35);
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass ? shade : light;
        ctx.globalAlpha = pass ? 0.18 : 0.22;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x++) {
          const a = x / period * TAU;
          const yy = y + (pass ? 1.2 : 0) + amp * (Math.sin(a * k1 + ph) + 0.5 * Math.sin(a * k2 + ph * 2));
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    return { canvas: c, period, top };
  }

  // ---- spring ------------------------------------------------------------

  function inSpring(g, x, y) {
    const s = SPRING;
    const o = ((x - g.W * s.x) / (g.W * s.rx)) ** 2 + ((y - g.H * s.y) / (g.H * s.ry)) ** 2;
    const i = ((x - g.W * (s.x + s.ix)) / (g.W * s.irx)) ** 2 + ((y - g.H * (s.y + s.iy)) / (g.H * s.iry)) ** 2;
    return o < 1 && i > 1;
  }

  function ellipse(ctx, g, cx, cy, rx, ry, grow) {
    ctx.beginPath();
    ctx.ellipse(g.W * cx, g.H * cy, g.W * rx + grow, g.H * ry + grow * 0.6, 0, 0, TAU);
  }

  function crescent(g, grow, color) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = SPRING;
    ctx.fillStyle = color;
    ellipse(ctx, g, s.x, s.y, s.rx, s.ry, grow);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ellipse(ctx, g, s.x + s.ix, s.y + s.iy, s.irx, s.iry, -grow);
    ctx.fill();
    return c;
  }

  function paintSpring(ctx, g, sky) {
    ctx.drawImage(crescent(g, g.U * 1.1, hex(dark(rgb('#7f6c46'), sky, 0.8))), 0, 0);
    ctx.drawImage(crescent(g, g.U * 0.5, hex(dark(rgb('#566e45'), sky, 0.75))), 0, 0);
    const water = crescent(g, 0, '#000');
    const wc = water.getContext('2d');
    const s = SPRING;
    const grad = wc.createLinearGradient(0, g.H * (s.y - s.ry), 0, g.H * (s.y + s.ry));
    grad.addColorStop(0, hex(mixColor(rgb('#365e66'), sky.low, 0.45)));
    grad.addColorStop(1, hex(mixColor(rgb('#223c52'), sky.top, 0.35)));
    wc.globalCompositeOperation = 'source-in';
    wc.fillStyle = grad;
    wc.fillRect(0, 0, g.W, g.H);
    ctx.drawImage(water, 0, 0);
  }

  // ---- pavilion ----------------------------------------------------------

  function roof(ctx, cx, yb, w, h, body, edge) {
    const up = h * 0.55;
    const p = new Path2D();
    p.moveTo(cx - w, yb - up);
    p.quadraticCurveTo(cx, yb + h * 0.5, cx + w, yb - up);
    p.quadraticCurveTo(cx + w * 0.6, yb - h * 0.45, cx + w * 0.3, yb - h);
    p.lineTo(cx - w * 0.3, yb - h);
    p.quadraticCurveTo(cx - w * 0.6, yb - h * 0.45, cx - w, yb - up);
    p.closePath();
    ctx.fillStyle = body;
    ctx.fill(p);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.9, yb - up * 0.55);
    ctx.quadraticCurveTo(cx, yb + h * 0.42, cx + w * 0.9, yb - up * 0.55);
    ctx.stroke();
  }

  function paintPavilion(ctx, g, sky) {
    const u = g.U * 1.3;
    const cx = g.W * PAV.x;
    const base = g.H * PAV.y;
    const col = (h, k) => hex(dark(rgb(h), sky, k));
    const post = col('#a83a28', 0.75);
    // Stone platform and steps.
    ctx.fillStyle = col('#9c9a94', 0.8);
    ctx.fillRect(cx - u * 8.6, base - u * 1.6, u * 17.2, u * 1.6);
    ctx.fillStyle = col('#c2bfb4', 0.75);
    ctx.fillRect(cx - u * 8.6, base - u * 1.6, u * 17.2, 1);
    ctx.fillStyle = col('#8a8880', 0.8);
    ctx.fillRect(cx - u * 2.4, base, u * 4.8, u * 0.7);
    // Dark open interior, four columns, crossbeam.
    ctx.fillStyle = col('#2a2230', 0.5);
    ctx.fillRect(cx - u * 6.6, base - u * 8.4, u * 13.2, u * 6.8);
    ctx.fillStyle = post;
    for (const f of [-6.8, -2.3, 2.1, 6.4]) ctx.fillRect(cx + u * f, base - u * 8.6, Math.max(1, u * 0.5), u * 7);
    ctx.fillRect(cx - u * 7, base - u * 8.9, u * 14, u * 0.6);
    // Bracket band under the eave: indigo, moss and gold blocks.
    const tones = ['#2f4a86', '#4f7a4c', '#c9a24a'];
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = col(tones[i % 3], 0.7);
      ctx.fillRect(cx - u * 7 + i * u, base - u * 10, Math.max(1, u * 0.8), u * 1.1);
    }
    const tile = col('#3c4152', 0.5);
    const ridge = col('#6c7284', 0.6);
    roof(ctx, cx, base - u * 10, u * 10.5, u * 3.6, tile, ridge);
    // Upper tier and finial.
    ctx.fillStyle = post;
    ctx.fillRect(cx - u * 3.4, base - u * 14.4, u * 6.8, u * 1.4);
    roof(ctx, cx, base - u * 14.2, u * 6.6, u * 3.2, tile, ridge);
    ctx.fillStyle = col('#c9a24a', 0.7);
    ctx.fillRect(cx - 1, base - u * 20, Math.max(2, u * 0.5), u * 3);
    ctx.beginPath();
    ctx.arc(cx, base - u * 20.4, u * 0.6, 0, TAU);
    ctx.fill();
  }

  function paintTrees(ctx, g, sky) {
    // Two slender poplars on the far shore, behind the spring.
    const trunk = hex(dark(rgb('#5a4a38'), sky, 0.7));
    const leaf = hex(dark(rgb('#5f7a45'), sky, 0.75));
    const leaf2 = hex(dark(rgb('#7a8a4a'), sky, 0.75));
    [[0.17, 0.665, 1], [0.205, 0.67, 0.75], [0.89, 0.69, 0.9]].forEach(([fx, fy, s]) => {
      const x = g.W * fx;
      const y = g.H * fy;
      const h = g.U * 13 * s;
      ctx.fillStyle = trunk;
      ctx.fillRect(x - 1, y - h * 0.3, Math.max(1, g.U * 0.35), h * 0.3);
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(x, y - h * 0.62, g.U * 1.9 * s, h * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = leaf2;
      ctx.beginPath();
      ctx.ellipse(x + g.U * 0.5, y - h * 0.7, g.U * 0.9 * s, h * 0.3, 0, 0, TAU);
      ctx.fill();
    });
  }

  function paintFore(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintTrees(ctx, g, sky);
    paintSpring(ctx, g, sky);
    paintPavilion(ctx, g, sky);
    // Soft lower edge so the sand does not end on a hard line.
    const fade = ctx.createLinearGradient(0, g.H * 0.9, 0, g.H);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, `rgba(${dark(rgb('#8f6a48'), sky, 0.8).map(Math.round).join(',')},0.55)`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, g.H * 0.9, g.W, g.H * 0.1);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function placeLoose(g, rand) {
    state.glints = [];
    let guard = 0;
    while (state.glints.length < MAX_GLINTS && guard++ < 400) {
      const gx = g.W * (0.14 + rand() * 0.52);
      const gy = g.H * (0.68 + rand() * 0.16);
      if (inSpring(g, gx, gy)) state.glints.push({ x: gx, y: gy, ph: rand() * TAU, sp: 0.6 + rand() * 0.8, w: g.U * (1.2 + rand() * 2) });
    }
    state.clumps = [];
    guard = 0;
    while (state.clumps.length < MAX_CLUMPS && guard++ < 600) {
      const gx = g.W * (0.1 + rand() * 0.6);
      const gy = g.H * (0.66 + rand() * 0.2);
      const edge = !inSpring(g, gx, gy) && (inSpring(g, gx + g.U * 2, gy) || inSpring(g, gx - g.U * 2, gy) || inSpring(g, gx, gy + g.U * 1.5));
      if (edge) state.clumps.push({ x: gx, y: gy, ph: rand() * TAU, h: g.U * (3 + rand() * 3) });
    }
    state.wisps = [];
    for (let i = 0; i < MAX_WISPS; i++) {
      const d = DUNES[1 + Math.floor(rand() * 2)];
      state.wisps.push({ u: rand(), d, len: g.U * (4 + rand() * 6), lift: g.U * (0.5 + rand() * 2.5), sp: 0.015 + rand() * 0.02, ph: rand() * TAU });
    }
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(52);
    state.sky = paintSky(g, sky, rand);
    state.back = paintBack(g, sky);
    state.ripples = paintRipples(g, sky);
    state.fore = paintFore(g, sky);
    state.cloudAlpha = 0.55 - sky.night * 0.4;
    state.night = sky.night;
    state.sandInk = hex(dark(mixColor(rgb('#ead3a0'), sky.amb, 0.3), sky, 0.7));
    state.reedInk = hex(dark(rgb('#6a8248'), sky, 0.75));
    state.glintInk = sky.night > 0.5 ? '#e8e6da' : '#f2ecd8';
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t, wind) {
    const r = state.ripples;
    const off = (t * g.U * 0.7 * wind) % r.period;
    ctx.drawImage(r.canvas, -off, r.top);
  }

  function drawWisps(ctx, g, t, wind) {
    if (wind <= 0) return;
    ctx.strokeStyle = state.sandInk;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < state.wisps.length; i++) {
      const w = state.wisps[i];
      const u = (w.u + t * w.sp * wind) % 1;
      const x = u * (g.W + w.len) - w.len;
      const y = ridgeY(g, w.d, Math.max(0, Math.min(g.W, x))) - w.lift + Math.sin(t * 0.8 + w.ph) * g.U * 0.4;
      ctx.moveTo(x, y);
      ctx.lineTo(x + w.len, y - g.U * 0.3);
    }
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, t) {
    ctx.fillStyle = state.glintInk;
    for (let i = 0; i < state.glints.length; i++) {
      const p = state.glints[i];
      const a = Math.max(0, Math.sin(t * p.sp + p.ph));
      ctx.globalAlpha = a * a * 0.55;
      ctx.fillRect(p.x, p.y, p.w, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawReeds(ctx, g, t, wind) {
    ctx.strokeStyle = state.reedInk;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < state.clumps.length; i++) {
      const c = state.clumps[i];
      const sway = Math.sin(t * 1.3 + c.ph) * g.U * 0.9 * (0.4 + wind * 0.6);
      for (let k = -2; k <= 2; k++) {
        const bx = c.x + k * g.U * 0.45;
        const h = c.h * (1 - Math.abs(k) * 0.13);
        ctx.moveTo(bx, c.y);
        ctx.quadraticCurveTo(bx + sway * 0.3 + k * g.U * 0.2, c.y - h * 0.6, bx + sway + k * g.U * 0.5, c.y - h);
      }
    }
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.25));
    placeLoose(g, K.rng(9));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, 1);
    ctx.drawImage(state.back, 0, 0);
    drawRipples(ctx, g, t, props.wind);
    drawWisps(ctx, g, t, props.wind);
    ctx.drawImage(state.fore, 0, 0);
    drawGlints(ctx, t);
    if (props.reeds) drawReeds(ctx, g, t, props.wind);
  }

  Kasuri.run({
    defaults: { time: 'auto', wind: 1, reeds: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
