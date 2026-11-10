/*
 * 元阳 Yuanyang — flooded rice terraces in Yunnan at sunrise.
 *
 * Sky, ridges, terraces and the Hani village are baked into two layers and
 * repainted once a minute from the clock. Between repaints only mist, a few
 * slow glints on the water and thin hearth smoke move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TERRACES = 34;
  const TOP = 0.36;
  const SUN = { x: 0.7, y: 0.27 };
  const RETINT_SECONDS = 60;
  const GLINTS = 30;
  const SMOKE = 5;
  const HOUSES = [
    { x: 0.2, k: 14 },
    { x: 0.255, k: 15 },
    { x: 0.31, k: 14 },
    { x: 0.58, k: 19 },
    { x: 0.64, k: 20 },
  ];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- terrace geometry --------------------------------------------------

  // Row k sits lower and spreads wider toward the viewer.
  function rowTop(g, k) {
    return g.H * (TOP + (1 - TOP) * Math.pow(k / TERRACES, 1.2));
  }

  // Height of the bund of row k at pixel column px: a bowl of nested curves.
  function curve(g, k, px) {
    const u = px / g.W;
    const depth = k / TERRACES;
    const amp = g.H * (0.008 + depth * 0.03);
    const bowl = Math.cos((u - 0.46) * Math.PI) * g.H * 0.09 * (0.3 + depth);
    const swell = Math.sin(u * 6.28 * 1.1 + k * 0.33) * amp;
    const wob = (fbm(u * 3 + k * 0.17, k * 0.5, 3, 7) - 0.5) * amp * 1.2;
    return rowTop(g, k) - bowl + swell + wob;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.46);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const day = Math.max(0.55, 1 - sky.night);
    const glowR = g.H * 0.4;
    const gl = ctx.createRadialGradient(g.W * SUN.x, g.H * SUN.y, 0, g.W * SUN.x, g.H * SUN.y, glowR);
    gl.addColorStop(0, `rgba(255,214,150,${0.7 * day})`);
    gl.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // Soft banks that tile sideways.
  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.05, 4, seed), fbm((x - c.width) * 0.012, y * 0.05, 4, seed), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 248;
        img.data[i + 1] = 240;
        img.data[i + 2] = 232;
        img.data[i + 3] = smoothstep(0.42, 0.72, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintSmoke() {
    const c = layer(24, 24);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    grad.addColorStop(0, 'rgba(226,218,208,0.5)');
    grad.addColorStop(1, 'rgba(226,218,208,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 24);
    return c;
  }

  // ---- ridges ------------------------------------------------------------

  function paintRidge(ctx, g, sky, base, amp, seed, mix) {
    const col = mixColor(rgb('#4a5a6a'), sky.haze, mix);
    ctx.fillStyle = hex(mixColor(col, rgb('#12182a'), sky.night * 0.6));
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.5);
    for (let px = 0; px <= g.W; px += 2) {
      const y = g.H * base - (fbm(px * 0.012, seed, 4, seed) - 0.3) * g.H * amp;
      ctx.lineTo(px, y);
    }
    ctx.lineTo(g.W, g.H * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // ---- terraces ----------------------------------------------------------

  function waterColor(sky, k, rand) {
    const depth = k / TERRACES;
    let c = mixColor(sky.low, sky.top, 0.1 + depth * 0.55);
    c = mixColor(c, rgb('#f0b078'), Math.max(0.55, 1 - sky.night) * 0.6 * (1 - depth * 0.4));
    if (rand() < 0.15) c = mixColor(c, rgb('#7a9560'), 0.35);
    return c;
  }

  function paintTerraces(ctx, g, sky, rand) {
    const earth = mixColor(rgb('#6a5a46'), rgb('#141a24'), sky.night * 0.6);
    const moss = mixColor(rgb('#56703f'), rgb('#18241e'), sky.night * 0.7);
    for (let k = 0; k < TERRACES; k++) {
      const next = k + 1 < TERRACES ? rowTop(g, k + 1) : g.H * 1.1;
      const span = Math.max(4, next - rowTop(g, k));
      const water = waterColor(sky, k, rand);
      const lit = mixColor(water, rgb('#ffe4bc'), Math.max(0.55, 1 - sky.night) * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let px = 0; px <= g.W; px += 2) ctx.lineTo(px, curve(g, k, px));
      ctx.lineTo(g.W, g.H);
      ctx.closePath();
      const gr = ctx.createLinearGradient(0, rowTop(g, k) - span * 0.4, 0, rowTop(g, k) + span * 1.4);
      gr.addColorStop(0, hex(lit));
      gr.addColorStop(1, hex(mixColor(water, earth, 0.15)));
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.lineWidth = Math.max(1, g.U * (0.25 + 0.35 * k / TERRACES));
      ctx.strokeStyle = hex(earth);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, g.U * 0.25);
      ctx.strokeStyle = hex(mixColor(moss, sky.amb, 0.15));
      ctx.globalAlpha = 0.8;
      ctx.translate(0, -ctx.lineWidth);
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  // ---- village -----------------------------------------------------------

  // A Hani mushroom house: mud walls under a fat hipped thatch roof.
  function paintHouse(ctx, g, sky, hx, base, s) {
    const night = sky.night;
    const wall = mixColor(rgb('#b49a78'), rgb('#2a2630'), night * 0.7);
    const thatch = mixColor(rgb('#9a7a40'), rgb('#2a2418'), night * 0.7);
    ctx.fillStyle = hex(wall);
    ctx.fillRect(hx - s * 2, base - s * 3, s * 4, s * 3);
    ctx.fillStyle = hex(mixColor(wall, rgb('#1c1c24'), 0.55));
    ctx.fillRect(hx - s * 0.4, base - s * 1.8, s * 0.8, s * 1.8);
    ctx.fillStyle = hex(thatch);
    ctx.beginPath();
    ctx.moveTo(hx - s * 2.9, base - s * 2.7);
    ctx.lineTo(hx - s * 1.3, base - s * 5.6);
    ctx.lineTo(hx + s * 1.3, base - s * 5.6);
    ctx.lineTo(hx + s * 2.9, base - s * 2.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(thatch, rgb('#e0b860'), 0.25 * (1 - night)));
    ctx.fillRect(hx - s * 1.3, base - s * 5.9, s * 2.6, s * 0.4);
  }

  function paintTree(ctx, g, sky, tx, base, s) {
    ctx.fillStyle = hex(mixColor(rgb('#3f5a36'), rgb('#101a18'), sky.night * 0.75));
    ctx.beginPath();
    ctx.arc(tx, base - s * 3, s * 2.2, 0, 6.3);
    ctx.arc(tx + s * 1.6, base - s * 2.4, s * 1.7, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#4a3a2c'), rgb('#101018'), sky.night * 0.7));
    ctx.fillRect(tx - s * 0.2, base - s * 1.6, s * 0.4, s * 1.6);
  }

  function paintVillage(ctx, g, sky) {
    const s = g.U * 0.9;
    for (const h of HOUSES) {
      const hx = g.W * h.x;
      const base = curve(g, h.k, hx) + g.U * 0.6;
      paintTree(ctx, g, sky, hx - s * 4.4, base, s);
      paintHouse(ctx, g, sky, hx, base, s);
    }
    paintTree(ctx, g, sky, g.W * 0.31 + s * 5, curve(g, 14, g.W * 0.31 + s * 5) + g.U * 0.5, s * 1.2);
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand, village) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidge(ctx, g, sky, 0.32, 0.18, 3, 0.85);
    paintRidge(ctx, g, sky, 0.37, 0.14, 8, 0.55);
    paintTerraces(ctx, g, sky, rand);
    if (village) paintVillage(ctx, g, sky);
    return c;
  }

  function repaint(g, props) {
    const sky = S.at(S.hour(props.time));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand, props.village);
    state.mistAlpha = 0.8 - sky.night * 0.45;
    state.dim = sky.night;
    state.choice = props.time;
    state.village = props.village;
    state.retintIn = RETINT_SECONDS;
    const r = K.rng(5);
    for (let i = 0; i < GLINTS; i++) {
      const k = 8 + Math.floor(r() * (TERRACES - 10));
      const px = r() * g.W;
      state.glints[i] = { x: px, y: curve(g, k, px) + g.U * (1.2 + k * 0.08), w: g.U * (2.5 + r() * 4), ph: r() * 6.3, sp: 0.4 + r() * 0.5 };
    }
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const a = Math.min(1, state.mistAlpha * amount);
    const rows = [
      { img: state.mistA, y: 0.3, speed: 2.2 },
      { img: state.mistB, y: 0.5, speed: 3.4 },
      { img: state.mistA, y: 0.68, speed: 4.6 },
    ];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const off = -((t * g.U * r.speed + i * 97) % r.img.width);
      ctx.globalAlpha = a * (i === 1 ? 1 : 0.7);
      ctx.drawImage(r.img, off, g.H * r.y);
      ctx.drawImage(r.img, off + r.img.width, g.H * r.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#ffe6bc';
    const k = 1 - state.dim * 0.8;
    for (let i = 0; i < GLINTS; i++) {
      const q = state.glints[i];
      const v = 0.5 + 0.5 * Math.sin(t * q.sp + q.ph);
      ctx.globalAlpha = v * 0.7 * k;
      ctx.fillRect(q.x, q.y, q.w, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t) {
    const s = g.U * 0.9;
    for (let h = 0; h < 2; h++) {
      const house = HOUSES[h === 0 ? 1 : 3];
      const bx = g.W * house.x;
      const by = curve(g, house.k, bx) - s * 5.8;
      for (let i = 0; i < SMOKE; i++) {
        const a = (t * 0.05 + i / SMOKE + h * 0.37) % 1;
        const size = g.U * (2 + a * 5);
        ctx.globalAlpha = (1 - a) * 0.8 * (1 - state.dim * 0.4);
        ctx.drawImage(state.smoke, bx + a * g.U * 4 + Math.sin(t * 0.5 + i) * g.U * 0.5 - size / 2, by - a * g.U * 14 - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.glints = new Array(GLINTS);
    state.mistA = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2), 21);
    state.mistB = paintMist(Math.ceil(g.W * 1.6), Math.ceil(g.H * 0.2), 33);
    state.smoke = paintSmoke();
    repaint(g, api.props);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.village !== props.village) repaint(g, props);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawGlints(ctx, g, t);
    if (props.village) drawSmoke(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, village: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
