/*
 * 琵琶湖 Biwako — a wide lake at first light with one torii in the shallows.
 *
 * Sky, ridges, water and the gate are baked into layers and repainted once a
 * minute from the clock. Between repaints only mist, a few ripple lines,
 * rings round the pillars and a small flight of birds move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.5;
  const GATE = { x: 0.6, base: 0.78, h: 0.42, w: 0.24 };
  const RETINT_SECONDS = 60;
  const RIPPLES = 44;
  const BIRDS = 5;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky and ridges ----------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function paintSun(ctx, g, sky) {
    const h = sky.hour;
    const day = h >= 6 && h <= 19.5;
    const t = day ? S.sunT(h) : S.moonT(h);
    const sx = g.W * lerp(0.12, 0.88, t);
    const lift = Math.sin(t * Math.PI);
    const sy = g.H * (HORIZON - 0.2 - lift * 0.22);
    const r = g.U * (day ? 6.5 : 3.6);
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 6);
    const tone = day ? 'rgba(250,214,160,' : 'rgba(210,216,236,';
    glow.addColorStop(0, tone + (day ? 0.55 : 0.3) + ')');
    glow.addColorStop(1, tone + '0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - r * 6, sy - r * 6, r * 12, r * 12);
    ctx.fillStyle = day ? '#f6dcb0' : '#e8e6dc';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, 6.3);
    ctx.fill();
    state.sunX = sx;
    state.sunUp = day ? 1 : 0.6;
  }

  function ridgeY(g, x, seed, amp, base) {
    const u = x / g.W;
    const swell = Math.sin(u * 5.1 + seed) * 0.5 + Math.sin(u * 11.3 + seed * 2) * 0.22;
    return g.H * (base - amp * (0.5 + swell * 0.5 + (fbm(x * 0.05, seed, 3, 7) - 0.5) * 0.5));
  }

  function paintRidge(ctx, g, color, seed, amp, base) {
    ctx.fillStyle = hex(color);
    ctx.beginPath();
    ctx.moveTo(0, g.H * HORIZON + 1);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridgeY(g, x, seed, amp, base));
    ctx.lineTo(g.W, g.H * HORIZON + 1);
    ctx.closePath();
    ctx.fill();
  }

  // The far shore: two hazy ridges and a low strip of wooded bank.
  function paintHills(ctx, g, sky) {
    const far = mixColor(mixColor(rgb('#56668e'), sky.haze, 0.35), rgb('#1c2440'), sky.night * 0.5);
    const mid = mixColor(mixColor(rgb('#2a3a60'), sky.haze, 0.12), rgb('#1c2440'), sky.night * 0.6);
    const bank = mixColor(mixColor(rgb('#2a3a3c'), sky.haze, 0.15), rgb('#141a24'), sky.night * 0.7);
    paintRidge(ctx, g, far, 1.3, 0.15, HORIZON - 0.02);
    paintRidge(ctx, g, mid, 4.1, 0.1, HORIZON - 0.005);
    paintRidge(ctx, g, bank, 8.7, 0.025, HORIZON + 0.002);
    // A band of haze where the shore meets the water.
    const band = ctx.createLinearGradient(0, g.H * (HORIZON - 0.06), 0, g.H * HORIZON);
    band.addColorStop(0, hex(sky.low) + '00');
    band.addColorStop(1, hex(mixColor(sky.low, rgb('#f2ede0'), 0.4)) + '66');
    ctx.fillStyle = band;
    ctx.fillRect(0, g.H * (HORIZON - 0.06), g.W, g.H * 0.06 + 1);
  }

  // ---- water -------------------------------------------------------------

  function paintWater(ctx, g, sky, back) {
    const top = g.H * HORIZON;
    const hh = g.H - top;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, rgb('#f0e8da'), 0.15)));
    grad.addColorStop(0.35, hex(mixColor(sky.haze, rgb('#4a6a98'), 0.5)));
    grad.addColorStop(1, hex(mixColor(rgb('#2e4268'), sky.top, 0.3)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, hh + 1);
    // Mirror the sky and far shore into the water, softer with depth.
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.translate(0, top * 2);
    ctx.scale(1, -1);
    const sh = Math.min(top, hh);
    ctx.drawImage(back, 0, top - sh, g.W, sh, 0, top, g.W, sh);
    ctx.restore();
    const veil = ctx.createLinearGradient(0, top, 0, g.H);
    veil.addColorStop(0, 'rgba(31,44,76,0)');
    veil.addColorStop(1, hex(mixColor(rgb('#2e4268'), sky.top, 0.3)) + '88');
    ctx.fillStyle = veil;
    ctx.fillRect(0, top, g.W, hh + 1);
    ctx.globalAlpha = 1;
  }

  // ---- the gate ----------------------------------------------------------

  function paintGate(ctx, g, sky) {
    const lit = 1 - sky.night * 0.65;
    const red = mixColor(mixColor(rgb('#b9402c'), sky.amb, 0.18), rgb('#241a2a'), 1 - lit);
    const dark = mixColor(rgb('#1d1a20'), sky.top, 0.15);
    const cx = g.W * GATE.x;
    const base = g.H * GATE.base;
    const h = g.H * GATE.h;
    const half = g.H * GATE.w * 0.5;
    const pw = Math.max(2, g.U * 1.5);
    const topY = base - h;
    ctx.fillStyle = hex(red);
    // Pillars lean in a little toward the top.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * (half + pw * 0.6), base);
      ctx.lineTo(cx + s * (half - pw * 0.4), base);
      ctx.lineTo(cx + s * (half - pw * 0.4 - g.U * 0.5), topY + h * 0.1);
      ctx.lineTo(cx + s * (half + pw * 0.4 - g.U * 0.5), topY + h * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    // Lower tie beam.
    ctx.fillRect(cx - half - pw * 0.2, topY + h * 0.27, half * 2 + pw * 0.4, Math.max(1, g.U * 1.1));
    // Central strut.
    ctx.fillRect(cx - g.U * 0.5, topY + h * 0.06, g.U, h * 0.21);
    // Upper beam: black cap curving up at both ends.
    const wide = half + g.U * 5;
    const sag = g.U * 1.4;
    ctx.fillStyle = hex(dark);
    ctx.beginPath();
    ctx.moveTo(cx - wide, topY - g.U * 2.2);
    ctx.quadraticCurveTo(cx, topY + sag, cx + wide, topY - g.U * 2.2);
    ctx.lineTo(cx + wide - g.U * 1.2, topY + g.U * 0.4);
    ctx.quadraticCurveTo(cx, topY + sag + g.U * 1.8, cx - wide + g.U * 1.2, topY + g.U * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(red);
    ctx.fillRect(cx - half - g.U * 1.5, topY + g.U * 1.2, half * 2 + g.U * 3, Math.max(1, g.U * 1.2));
    // Foot of the pillars darkened where the water has stained them.
    ctx.fillStyle = hex(mixColor(red, dark, 0.6));
    for (const s of [-1, 1]) ctx.fillRect(cx + s * half - pw * 0.5 - (s < 0 ? 0 : -0) , base - g.U * 2.4, pw, g.U * 2.4);
  }

  // The gate, flipped about the waterline and faded, in its own layer.
  function paintGateReflection(g, gate) {
    const base = g.H * GATE.base;
    const drop = Math.min(g.H - base, g.H * GATE.h);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(0, base * 2);
    ctx.scale(1, -1);
    ctx.drawImage(gate, 0, base - drop, g.W, drop, 0, base, g.W, drop);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, base, 0, base + drop);
    fade.addColorStop(0, 'rgba(0,0,0,0.65)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, base, g.W, drop);
    return c;
  }

  // ---- reeds and shore ---------------------------------------------------

  function paintReeds(ctx, g, sky, rand) {
    const blade = mixColor(mixColor(rgb('#5c6a46'), sky.amb, 0.12), rgb('#12181e'), sky.night * 0.7);
    const gold = mixColor(rgb('#b49a58'), rgb('#2a2a30'), sky.night * 0.7);
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < 70; i++) {
      const left = i % 2 === 0;
      const x = left ? rand() * g.W * 0.2 : g.W * (0.86 + rand() * 0.14);
      const y0 = g.H * (0.98 + rand() * 0.04);
      const h = g.H * (0.1 + rand() * 0.16);
      const lean = (rand() - 0.5) * g.U * 5;
      ctx.strokeStyle = hex(rand() < 0.25 ? gold : blade);
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + lean * 0.3, y0 - h * 0.6, x + lean, y0 - h);
      ctx.stroke();
    }
    // A few seed heads in gold.
    ctx.fillStyle = hex(gold);
    for (let i = 0; i < 9; i++) {
      const x = i % 2 ? g.W * (0.88 + rand() * 0.1) : rand() * g.W * 0.16;
      ctx.fillRect(x, g.H * (0.8 + rand() * 0.08), Math.max(1, g.U * 0.5), g.U * 1.8);
    }
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.09, 4, 31), fbm((x - w) * 0.012, y * 0.09, 4, 31), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 244;
        img.data[i + 1] = 238;
        img.data[i + 2] = 228;
        img.data[i + 3] = smoothstep(0.42, 0.72, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, sky, rand);
    paintSun(bctx, g, sky);
    paintHills(bctx, g, sky);

    const scene = layer(g.W, g.H);
    const sctx = scene.getContext('2d');
    sctx.drawImage(back, 0, 0);
    paintWater(sctx, g, sky, back);

    const gate = layer(g.W, g.H);
    paintGate(gate.getContext('2d'), g, sky);
    const refl = paintGateReflection(g, gate);
    sctx.globalAlpha = 0.8;
    sctx.drawImage(refl, 0, 0);
    sctx.globalAlpha = 1;
    sctx.drawImage(gate, 0, 0);
    paintReeds(sctx, g, sky, rand);

    state.scene = scene;
    state.night = sky.night;
    state.glint = mixColor(sky.amb, rgb('#fff4dc'), 0.5);
    state.ripple = hex(mixColor(sky.low, rgb('#f4eadb'), 0.55));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.U * 2.6) % c.width);
    const y = g.H * (HORIZON - 0.06);
    ctx.globalAlpha = Math.min(1, (0.8 - state.night * 0.4) * amount);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    const rise = Math.sin(t * 0.18) * g.U * 1.2;
    ctx.globalAlpha = Math.min(1, (0.55 - state.night * 0.3) * amount);
    ctx.drawImage(c, -off * 0.6 - c.width * 0.3, y + g.H * 0.06 + rise);
    ctx.drawImage(c, -off * 0.6 + c.width * 0.7, y + g.H * 0.06 + rise);
    ctx.globalAlpha = 1;
  }

  // Short light dashes sliding across the water, smaller toward the horizon.
  function drawRipples(ctx, g, t) {
    ctx.fillStyle = state.ripple;
    const top = g.H * HORIZON;
    const span = g.H - top;
    for (let i = 0; i < RIPPLES; i++) {
      const f = (i * 0.6180339) % 1;
      const depth = (f * f * 0.85 + 0.04);
      const y = top + span * depth;
      const len = g.U * (2 + depth * 14);
      const x = ((f * 7.3 + i * 0.37) % 1) * (g.W + len) + Math.sin(t * 0.5 + i * 2.1) * g.U * 2 * depth - len;
      ctx.globalAlpha = (0.2 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7))) * (1 - state.night * 0.5);
      ctx.fillRect(x, y, len, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
    // Warm glitter under the sun.
    ctx.fillStyle = hex(state.glint);
    for (let i = 0; i < 10; i++) {
      const depth = 0.04 + i * 0.07;
      const y = top + span * depth;
      const w = g.U * (2 + depth * 12) * (0.6 + 0.4 * Math.sin(t * 1.3 + i * 2.3));
      ctx.globalAlpha = 0.5 * state.sunUp * (1 - depth * 0.7);
      ctx.fillRect(state.sunX - w / 2 + Math.sin(t * 0.7 + i) * g.U, y, w, Math.max(1, g.U * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  // Widening rings where the water meets the pillars.
  function drawRings(ctx, g, t) {
    const base = g.H * GATE.base;
    const half = g.H * GATE.w * 0.5;
    ctx.strokeStyle = state.ripple;
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const a = (t * 0.22 + k * 0.5 + (s > 0 ? 0.25 : 0)) % 1;
        ctx.globalAlpha = (1 - a) * 0.5;
        ctx.beginPath();
        ctx.ellipse(g.W * GATE.x + s * half, base, g.U * (1.5 + a * 8), g.U * (0.4 + a * 1.8), 0, 0, 6.3);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = '#2a2c3a';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.globalAlpha = 0.7 - state.night * 0.4;
    for (let i = 0; i < BIRDS; i++) {
      const p = (t * 0.02 + i * 0.045) % 1;
      const x = g.W * (1.05 - p * 1.15);
      const y = g.H * (0.2 + i * 0.022) + Math.sin(t * 0.6 + i) * g.U * 1.2;
      const flap = Math.sin(t * 5 + i * 1.3) * g.U * 0.9;
      const s = g.U * 2.2;
      ctx.beginPath();
      ctx.moveTo(x - s, y - flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + s, y - flap);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.scene, 0, 0);
    drawRipples(ctx, g, t);
    drawRings(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    if (props.birds) drawBirds(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dawn', mist: 1, birds: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
