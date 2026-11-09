/*
 * 富良野 Furano — lavender rows curving over the hills of Hokkaido.
 *
 * Sky, peaks, hills and the lavender field are baked and repainted once a
 * minute from the clock. Between repaints only clouds and a wind ripple
 * through the rows move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.47;
  const FIELD_TOP = 0.5;
  const VP_X = 0.52;
  const ROWS = 24;
  const SEGS = 22;
  const RETINT_SECONDS = 60;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Dim a colour toward night ink and warm it a little with the ambient light.
  function lit(base, sky, haze) {
    const warm = mixColor(rgb(base), sky.amb, 0.22);
    const hazed = mixColor(warm, sky.haze, haze);
    return mixColor(hazed, rgb('#1a1e34'), sky.night * 0.72);
  }

  // ---- sky and peaks -----------------------------------------------------

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
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.35, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintBody(ctx, g, sky);
    return c;
  }

  function paintBody(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const bx = g.W * (0.12 + 0.76 * t);
    const by = g.H * (0.3 - 0.2 * Math.sin(Math.PI * t));
    const r = g.U * (night ? 2.6 : 3.4);
    const halo = ctx.createRadialGradient(bx, by, 0, bx, by, r * 5);
    halo.addColorStop(0, night ? 'rgba(226,226,214,0.25)' : 'rgba(250,236,200,0.4)');
    halo.addColorStop(1, 'rgba(250,236,200,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(bx - r * 5, by - r * 5, r * 10, r * 10);
    ctx.fillStyle = night ? '#e6e4d6' : '#f6ecd0';
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, 6.3);
    ctx.fill();
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.013, y * 0.075, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Tokachi range: jagged peaks with snow on the upper slopes.
  function peakY(g, x) {
    const u = x / g.W;
    const base = g.H * 0.36;
    const mass = Math.max(0, 1 - Math.abs(u - 0.74) * 1.5);
    const hump = g.H * 0.17 * Math.pow(mass, 1.2) + g.H * 0.05 * Math.sin(u * 5.1 + 1);
    const jag = (fbm(x * 0.045, 3, 4, 17) - 0.5) * g.H * 0.09;
    return base - hump + jag;
  }

  function paintPeaks(ctx, g, sky) {
    const horizon = g.H * (HORIZON + 0.02);
    const rock = lit('#4a5878', sky, 0.5);
    const snow = lit('#eef0f2', sky, 0.25);
    for (let x = 0; x < g.W; x++) {
      const top = peakY(g, x);
      const snowLine = top + (horizon - top) * (0.22 + (fbm(x * 0.07, 9, 3, 7) - 0.5) * 0.5);
      ctx.fillStyle = hex(snow);
      ctx.fillRect(x, top, 1, Math.max(1, snowLine - top));
      const body = ctx.createLinearGradient(0, snowLine, 0, horizon);
      body.addColorStop(0, hex(rock));
      body.addColorStop(1, hex(mixColor(rock, sky.low, 0.55)));
      ctx.fillStyle = body;
      ctx.fillRect(x, snowLine, 1, horizon - snowLine);
    }
  }

  // ---- hills, trees, farm ------------------------------------------------

  function hillY(g, x, k) {
    const u = x / g.W;
    return g.H * (0.48 + k * 0.04) + Math.sin(u * 4 + k * 2) * g.H * 0.014 + Math.sin(u * 9 + k) * g.H * 0.005;
  }

  function paintFarHill(ctx, g, sky) {
    ctx.fillStyle = hex(lit('#5a7048', sky, 0.4));
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.56);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, hillY(g, x, 0));
    ctx.lineTo(g.W, g.H * 0.56);
    ctx.lineTo(0, g.H * 0.56);
    ctx.fill();
  }

  // A windbreak of tall larches in a line along the far hill.
  function paintLarches(ctx, g, sky, rand) {
    const dark = lit('#2f4a34', sky, 0.3);
    const light = lit('#556b3c', sky, 0.3);
    for (let i = 0; i < 26; i++) {
      const x = g.W * (0.04 + i * 0.012) + rand() * g.U * 0.6;
      const base = hillY(g, x, 0) + g.U * 0.4;
      const h = g.U * (4 + rand() * 2.2);
      const w = g.U * (0.9 + rand() * 0.4);
      ctx.fillStyle = hex(i % 3 ? dark : light);
      ctx.beginPath();
      ctx.moveTo(x, base - h);
      ctx.lineTo(x + w, base);
      ctx.lineTo(x - w, base);
      ctx.fill();
    }
    for (let i = 0; i < 9; i++) {
      const x = g.W * (0.62 + i * 0.014) + rand() * g.U;
      const base = hillY(g, x, 0) + g.U * 0.3;
      ctx.fillStyle = hex(i % 2 ? dark : light);
      ctx.beginPath();
      ctx.arc(x, base - g.U * 1.3, g.U * (1.2 + rand() * 0.6), 0, 6.3);
      ctx.fill();
    }
  }

  function paintFarmhouse(ctx, g, sky) {
    const x = g.W * 0.8;
    const base = hillY(g, x, 0) + g.U * 0.5;
    const w = g.U * 5;
    const h = g.U * 2.6;
    ctx.fillStyle = hex(lit('#ece6d4', sky, 0.1));
    ctx.fillRect(x - w / 2, base - h, w, h);
    ctx.fillStyle = hex(lit('#c0452c', sky, 0.08));
    ctx.beginPath();
    ctx.moveTo(x - w * 0.62, base - h);
    ctx.lineTo(x - w * 0.18, base - h - g.U * 2.2);
    ctx.lineTo(x + w * 0.18, base - h - g.U * 2.2);
    ctx.lineTo(x + w * 0.62, base - h);
    ctx.fill();
    ctx.fillStyle = hex(lit('#3a2e28', sky, 0.1));
    ctx.fillRect(x - g.U * 0.5, base - h * 0.7, g.U, h * 0.7);
  }

  function paintTorii(ctx, g, sky) {
    const x = g.W * 0.2;
    const base = g.H * 0.585;
    const h = g.U * 5.5;
    const w = g.U * 4.2;
    ctx.fillStyle = hex(lit('#c8452c', sky, 0.1));
    ctx.fillRect(x - w / 2, base - h, g.U * 0.5, h);
    ctx.fillRect(x + w / 2 - g.U * 0.5, base - h, g.U * 0.5, h);
    ctx.fillRect(x - w / 2, base - h * 0.78, w, g.U * 0.4);
    ctx.fillStyle = hex(lit('#26222a', sky, 0.1));
    ctx.fillRect(x - w * 0.68, base - h - g.U * 0.5, w * 1.36, g.U * 0.7);
  }

  // ---- lavender field ----------------------------------------------------

  function rowPoint(g, k, t) {
    const vpx = g.W * VP_X;
    const vpy = g.H * 0.455;
    const e0 = (g.H * FIELD_TOP - vpy) / (g.H - vpy);
    const e = e0 + (1 - e0) * t;
    const bottomX = g.W * (-0.7 + (k / ROWS) * 2.5);
    const bend = Math.sin(t * 3.4 + 0.6) * g.W * 0.11 * Math.sqrt(t);
    return {
      x: vpx + (bottomX - vpx) * e + bend,
      y: vpy + (g.H - vpy) * e,
      w: g.W * 0.034 * e,
    };
  }

  function paintRows(ctx, g, sky, rand) {
    const soil = lit('#6b7a46', sky, 0.15);
    const bloomA = lit('#8c64b6', sky, 0.0);
    const bloomB = lit('#6c4a9a', sky, 0.0);
    const hi = lit('#b79ad8', sky, 0.0);
    for (let k = 0; k < ROWS; k++) {
      const base = k % 2 ? bloomA : bloomB;
      let prev = rowPoint(g, k, 0);
      for (let s = 1; s <= SEGS; s++) {
        const t = s / SEGS;
        const p = rowPoint(g, k, t);
        const haze = (1 - t) * 0.5;
        ctx.fillStyle = hex(mixColor(soil, sky.haze, haze * 0.6));
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.w * 1.6, prev.y);
        ctx.lineTo(prev.x + prev.w * 1.6, prev.y);
        ctx.lineTo(p.x + p.w * 1.6, p.y);
        ctx.lineTo(p.x - p.w * 1.6, p.y);
        ctx.fill();
        ctx.fillStyle = hex(mixColor(base, sky.haze, haze));
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.w, prev.y);
        ctx.lineTo(prev.x + prev.w, prev.y);
        ctx.lineTo(p.x + p.w, p.y);
        ctx.lineTo(p.x - p.w, p.y);
        ctx.fill();
        ctx.fillStyle = hex(mixColor(hi, sky.haze, haze));
        ctx.globalAlpha = 0.5 + rand() * 0.3;
        ctx.fillRect(p.x - p.w * 0.5, p.y, Math.max(1, p.w * 0.7), Math.max(1, (p.y - prev.y) * 0.5));
        ctx.globalAlpha = 1;
        prev = p;
      }
    }
  }

  function paintField(g, sky, rand) {
    const m = state.margin;
    const c = layer(g.W + m * 2, g.H);
    const ctx = c.getContext('2d');
    ctx.translate(m, 0);
    ctx.beginPath();
    ctx.moveTo(-m, g.H);
    for (let x = -m; x <= g.W + m; x += 2) ctx.lineTo(x, hillY(g, Math.min(Math.max(x, 0), g.W), 1));
    ctx.lineTo(g.W + m, g.H);
    ctx.clip();
    ctx.fillStyle = hex(lit('#6b7a46', sky, 0.2));
    ctx.fillRect(-m, 0, g.W + m * 2, g.H);
    paintRows(ctx, g, sky, rand);
    return c;
  }

  function paintLight(field, g) {
    const c = layer(field.width, field.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(field, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(236,222,246,0.38)';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintPeaks(ctx, g, sky);
    paintFarHill(ctx, g, sky);
    paintLarches(ctx, g, sky, rand);
    paintFarmhouse(ctx, g, sky);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.back = paintBack(g, sky, rand);
    state.field = paintField(g, sky, rand);
    state.light = paintLight(state.field, g);
    state.torii = paintToriiLayer(g, sky);
    state.cloudAlpha = 0.75 - sky.night * 0.5;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function paintToriiLayer(g, sky) {
    const c = layer(g.W, g.H);
    paintTorii(c.getContext('2d'), g, sky);
    return c;
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

  // The field is drawn in thin strips; each sways a little and a pale ripple
  // runs through them, so the wind seems to pass over the rows.
  function drawField(ctx, g, t, wind) {
    const m = state.margin;
    const y0 = Math.floor(g.H * 0.46);
    const sh = state.strip;
    for (let y = y0; y < g.H; y += sh) {
      const h = Math.min(sh, g.H - y);
      const depth = (y - y0) / (g.H - y0);
      const sway = Math.sin(t * 1.3 - y * 0.09) * g.U * 0.35 * wind * (0.3 + depth);
      ctx.globalAlpha = 1;
      ctx.drawImage(state.field, 0, y, state.field.width, h, -m + sway, y, state.field.width, h);
      const wave = 0.5 + 0.5 * Math.sin(t * 0.9 - y * 0.05 + Math.sin(t * 0.3) * 2);
      const a = wave * wave * 0.7 * Math.min(1, wind);
      if (a < 0.03) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(state.light, 0, y, state.light.width, h, -m + sway, y, state.light.width, h);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.margin = Math.ceil(g.U * 2);
    state.strip = Math.max(2, Math.round(g.U * 1.1));
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.back, 0, 0);
    drawField(ctx, g, t, props.wind);
    ctx.drawImage(state.torii, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', wind: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
