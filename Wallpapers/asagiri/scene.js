/*
 * 朝霧 Asagiri — a mountain basin town sunk in morning fog.
 *
 * Ridges, sun and the far rows of roofs are baked into a back layer; the
 * near roofs and the thick bottom fog into a front layer. Both are repainted
 * once a minute from the clock. Between them only two fog strips slide
 * sideways, the sun glow breathes and a little hearth smoke climbs.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 9;
  const PAGODA = { x: 0.3, base: 0.8 };
  const HALL = { x: 0.64, base: 0.77 };
  const HEARTH = { x: 0.465, y: 0.675 };
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // Colours are tinted toward the fog by depth: 0 is close, 1 is lost in white.
  function palette(sky) {
    const fog = mixColor(mixColor(sky.low, rgb('#f4efe4'), 0.62), sky.top, sky.night * 0.6);
    const tint = (h, depth) => hex(mixColor(mixColor(rgb(h), sky.amb, 0.12), fog, depth));
    return { fog, tint };
  }

  // ---- sky and ridges ----------------------------------------------------

  function paintSkyBase(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.72);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function sunSpot(g, sky) {
    const night = sky.night > 0.5;
    const t = Math.max(0.09, night ? S.moonT(sky.hour) : S.sunT(sky.hour));
    return {
      x: g.W * lerp(0.78, 0.22, t),
      y: g.H * (0.43 - Math.sin(t * Math.PI) * 0.3),
      night,
    };
  }

  function paintSun(ctx, g, sky) {
    const s = sunSpot(g, sky);
    const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, g.U * 30);
    const warm = s.night ? '214,220,236' : '250,214,160';
    halo.addColorStop(0, `rgba(${warm},0.55)`);
    halo.addColorStop(1, `rgba(${warm},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(s.x - g.U * 30, s.y - g.U * 30, g.U * 60, g.U * 60);
    ctx.fillStyle = s.night ? '#e8e9ee' : '#fbe3b4';
    ctx.beginPath();
    ctx.arc(s.x, s.y, g.U * 4.2, 0, TAU);
    ctx.fill();
    return s;
  }

  function ridgeY(g, x, k) {
    const f = x / g.W;
    const rim = Math.pow(Math.abs(f - 0.5) * 2, 2) * g.U * 9;
    const n = fbm(x * k.freq, k.seed, 4, k.seed);
    return g.H * k.base - n * g.H * k.amp - rim * k.rim;
  }

  function paintRidge(ctx, g, pal, k) {
    const top = [];
    let min = g.H;
    for (let x = 0; x < g.W; x++) {
      const y = ridgeY(g, x, k);
      top.push(y);
      if (y < min) min = y;
    }
    ctx.fillStyle = pal.tint(k.ink, k.depth);
    for (let x = 0; x < g.W; x++) ctx.fillRect(x, top[x], 1, g.H * 0.8 - top[x]);
    // cedar-dark streaks on the nearer slopes
    if (k.depth < 0.5) {
      ctx.fillStyle = pal.tint('#26362e', k.depth + 0.1);
      ctx.globalAlpha = 0.5;
      for (let x = 0; x < g.W; x += 2) ctx.fillRect(x, top[x] + g.U * 1.5, 1, g.U * (1 + (x % 7) * 0.6));
      ctx.globalAlpha = 1;
    }
    const fade = ctx.createLinearGradient(0, min, 0, g.H * (k.base + 0.07));
    const fc = hex(pal.fog);
    fade.addColorStop(0, fc + '00');
    fade.addColorStop(1, fc + 'cc');
    ctx.fillStyle = fade;
    ctx.fillRect(0, min, g.W, g.H * 0.8 - min);
  }

  // ---- roofs and buildings ----------------------------------------------

  // A swept tile roof: concave slopes, upturned eave corners, a pale ridge line.
  function roof(ctx, pal, x, y, w, h, depth, lift) {
    const half = w / 2;
    const rw = w * 0.2;
    const tip = h * (lift ?? 0.18);
    ctx.fillStyle = pal.tint('#4a505c', depth);
    ctx.beginPath();
    ctx.moveTo(x - half, y - tip);
    ctx.quadraticCurveTo(x - half * 0.55, y + h * 0.05, x - rw, y - h);
    ctx.lineTo(x + rw, y - h);
    ctx.quadraticCurveTo(x + half * 0.55, y + h * 0.05, x + half, y - tip);
    ctx.lineTo(x + half * 0.9, y + h * 0.1);
    ctx.lineTo(x - half * 0.9, y + h * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.tint('#8e96a2', depth + 0.1);
    ctx.fillRect(x - rw, y - h - 0.5, rw * 2, Math.max(1, h * 0.12));
    ctx.fillStyle = pal.tint('#252a33', depth);
    ctx.fillRect(x - half * 0.9, y + h * 0.04, half * 1.8, Math.max(1, h * 0.1));
  }

  function house(ctx, pal, x, base, w, h, depth) {
    const wall = h * 0.4;
    ctx.fillStyle = pal.tint('#e4dcc6', depth);
    ctx.fillRect(x - w * 0.38, base - wall, w * 0.76, wall);
    ctx.fillStyle = pal.tint('#4a3a2c', depth);
    ctx.fillRect(x - w * 0.38, base - wall, Math.max(1, w * 0.04), wall);
    ctx.fillRect(x + w * 0.34, base - wall, Math.max(1, w * 0.04), wall);
    ctx.fillRect(x - w * 0.1, base - wall * 0.7, w * 0.2, wall * 0.7);
    roof(ctx, pal, x, base - wall, w, h * 0.6, depth);
  }

  function pagoda(ctx, g, pal) {
    const cx = g.W * PAGODA.x;
    const base = g.H * PAGODA.base;
    const tiers = 5;
    const tierH = g.U * 8.2;
    let w = g.U * 17;
    let y = base;
    const depth = 0.3;
    ctx.fillStyle = pal.tint('#5a4636', depth);
    ctx.fillRect(cx - w * 0.5, y - g.U * 1.2, w, g.U * 1.2);
    for (let i = 0; i < tiers; i++) {
      const bw = w * 0.56;
      const bh = tierH * 0.44;
      ctx.fillStyle = pal.tint('#b2402a', depth);
      ctx.fillRect(cx - bw / 2, y - bh, bw, bh);
      ctx.fillStyle = pal.tint('#3a2a22', depth);
      ctx.fillRect(cx - bw * 0.12, y - bh * 0.75, bw * 0.24, bh * 0.75);
      roof(ctx, pal, cx, y - bh, w, tierH * 0.6, depth, 0.3);
      y -= tierH;
      w *= 0.82;
    }
    // the finial: a mast with gold rings
    const mast = g.U * 11;
    ctx.fillStyle = pal.tint('#3a3a40', depth);
    ctx.fillRect(cx - 0.5, y - mast, 1, mast + g.U);
    ctx.fillStyle = pal.tint('#d6a83e', depth);
    for (let r = 0; r < 5; r++) ctx.fillRect(cx - g.U * 0.9, y - g.U * (1.5 + r * 1.7), g.U * 1.8, Math.max(1, g.U * 0.55));
  }

  function hall(ctx, g, pal) {
    const cx = g.W * HALL.x;
    const base = g.H * HALL.base;
    const w = g.U * 36;
    const depth = 0.32;
    ctx.fillStyle = pal.tint('#5a4636', depth);
    ctx.fillRect(cx - w * 0.44, base - g.U * 1.6, w * 0.88, g.U * 1.6);
    ctx.fillStyle = pal.tint('#e6ddc6', depth);
    ctx.fillRect(cx - w * 0.38, base - g.U * 7, w * 0.76, g.U * 5.4);
    ctx.fillStyle = pal.tint('#b2402a', depth);
    for (let i = 0; i < 6; i++) ctx.fillRect(cx - w * 0.38 + (w * 0.76 * i) / 5 - 0.5, base - g.U * 7, Math.max(1, g.U * 0.7), g.U * 5.4);
    roof(ctx, pal, cx, base - g.U * 7, w, g.U * 11, depth, 0.2);
    // upper smaller roof
    roof(ctx, pal, cx, base - g.U * 12.5, w * 0.58, g.U * 6, depth, 0.2);
    ctx.fillStyle = pal.tint('#d6a83e', depth);
    ctx.fillRect(cx - w * 0.12, base - g.U * 18.8, g.U * 0.9, g.U * 1.2);
    ctx.fillRect(cx + w * 0.12 - g.U * 0.9, base - g.U * 18.8, g.U * 0.9, g.U * 1.2);
  }

  function cedar(ctx, pal, x, base, h, depth) {
    ctx.fillStyle = pal.tint('#24372c', depth);
    ctx.beginPath();
    ctx.moveTo(x, base - h);
    ctx.lineTo(x + h * 0.14, base);
    ctx.lineTo(x - h * 0.14, base);
    ctx.closePath();
    ctx.fill();
  }

  function row(ctx, g, pal, rand, spec) {
    const base = g.H * spec.base;
    for (let x = -g.U * 4; x < g.W + g.U * 4; x += g.U * spec.step * (0.7 + rand() * 0.7)) {
      if (rand() < 0.2) {
        cedar(ctx, pal, x, base + g.U, g.U * spec.size * (1.1 + rand() * 1.1), spec.depth);
      } else {
        const w = g.U * spec.size * (0.9 + rand() * 0.6);
        house(ctx, pal, x, base, w, w * 0.8, spec.depth);
      }
    }
  }

  function fogBand(ctx, g, pal, y, alpha) {
    const fc = hex(pal.fog);
    const grad = ctx.createLinearGradient(0, y - g.U * 4, 0, y + g.U * 5);
    grad.addColorStop(0, fc + '00');
    grad.addColorStop(1, fc + Math.round(alpha * 255).toString(16).padStart(2, '0'));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - g.U * 4, g.W, g.H - y + g.U * 4);
  }

  // ---- bake --------------------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const pal = palette(sky);
    paintSkyBase(ctx, g, sky, rand);
    paintSun(ctx, g, sky);
    paintRidge(ctx, g, pal, { base: 0.52, amp: 0.2, freq: 0.012, seed: 3, rim: 1.2, depth: 0.78, ink: '#5a6a88' });
    paintRidge(ctx, g, pal, { base: 0.6, amp: 0.15, freq: 0.018, seed: 8, rim: 0.8, depth: 0.6, ink: '#4a6070' });
    paintRidge(ctx, g, pal, { base: 0.67, amp: 0.1, freq: 0.03, seed: 14, rim: 0.5, depth: 0.42, ink: '#3e5448' });
    fogBand(ctx, g, pal, g.H * 0.64, 0.75);
    row(ctx, g, pal, rand, { base: 0.71, step: 4.2, size: 5, depth: 0.62 });
    fogBand(ctx, g, pal, g.H * 0.7, 0.72);
    row(ctx, g, pal, rand, { base: 0.77, step: 5.4, size: 7, depth: 0.45 });
    pagoda(ctx, g, pal);
    hall(ctx, g, pal);
    fogBand(ctx, g, pal, g.H * 0.775, 0.78);
    return c;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const pal = palette(sky);
    row(ctx, g, pal, rand, { base: 0.94, step: 9, size: 10, depth: 0.36 });
    fogBand(ctx, g, pal, g.H * 0.93, 0.8);
    const fc = hex(pal.fog);
    const sea = ctx.createLinearGradient(0, g.H * 0.9, 0, g.H);
    sea.addColorStop(0, fc + '00');
    sea.addColorStop(1, fc + 'ee');
    ctx.fillStyle = sea;
    ctx.fillRect(0, g.H * 0.9, g.W, g.H * 0.1);
    return c;
  }

  // A wisp strip that tiles sideways.
  function paintFogStrip(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.02, y * 0.09, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 246;
        img.data[i + 1] = 242;
        img.data[i + 2] = 232;
        img.data[i + 3] = smoothstep(0.4, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(24, 24);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    grad.addColorStop(0, 'rgba(236,232,224,0.55)');
    grad.addColorStop(1, 'rgba(236,232,224,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 24);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.back = paintBack(g, sky, rand);
    state.front = paintFront(g, sky, K.rng(61));
    state.sun = sunSpot(g, sky);
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawStrip(ctx, g, strip, t, speed, y, alpha) {
    const off = -((t * g.U * speed) % strip.width);
    ctx.globalAlpha = alpha;
    ctx.drawImage(strip, off, y);
    ctx.drawImage(strip, off + strip.width, y);
    ctx.globalAlpha = 1;
  }

  function drawGlow(ctx, g, t) {
    const s = state.sun;
    const size = g.U * (46 + Math.sin(t * 0.35) * 3);
    ctx.globalAlpha = (0.16 + Math.sin(t * 0.35) * 0.04) * (1 - state.dim * 0.5);
    ctx.drawImage(state.glow, s.x - size / 2, s.y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t) {
    const px = g.W * HEARTH.x;
    const py = g.H * HEARTH.y;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.06 + i / MAX_PUFFS) % 1;
      const size = g.U * (1.4 + a * 5);
      const dx = a * g.U * 7 + Math.sin(t * 0.5 + i * 2) * g.U * 0.8;
      const dy = -a * g.U * 15;
      ctx.globalAlpha = Math.sin(a * Math.PI) * 0.8;
      ctx.drawImage(state.puff, px + dx - size / 2, py + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.stripA = paintFogStrip(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.16), 21);
    state.stripB = paintFogStrip(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.18), 37);
    state.puff = paintPuff();
    state.glow = layer(64, 64);
    const gc = state.glow.getContext('2d');
    const gr = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,226,170,1)');
    gr.addColorStop(1, 'rgba(255,226,170,0)');
    gc.fillStyle = gr;
    gc.fillRect(0, 0, 64, 64);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    const fog = props.fog;
    ctx.drawImage(state.back, 0, 0);
    drawGlow(ctx, g, t);
    if (props.smoke) drawSmoke(ctx, g, t);
    drawStrip(ctx, g, state.stripA, t, 2.6, g.H * 0.62, Math.min(1, 0.7 * fog));
    drawStrip(ctx, g, state.stripB, t, 3.8, g.H * 0.76, Math.min(1, 0.7 * fog));
    ctx.drawImage(state.front, 0, 0);
    drawStrip(ctx, g, state.stripA, t + 40, 5.5, g.H * 0.86, Math.min(1, 0.5 * fog));
  }

  Kasuri.run({
    defaults: { time: 'auto', fog: 1, smoke: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
