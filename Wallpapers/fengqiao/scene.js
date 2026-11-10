/*
 * 枫桥 Maple Bridge — a boat with a black awning moored under a humped
 * stone bridge. Frosted maples on the bank, a low moon, a far pagoda.
 *
 * The whole night is baked into one layer (with its reflection in the
 * canal) and repainted once a minute. Between repaints only mist, water
 * glints, a lantern, frost sparkles, a few leaves and a slow bell ring move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const WATER = 0.665;
  const MOON = { x: 0.7, y: 0.3 };
  const BRIDGE = { x: 0.36, l: 0.1, r: 0.62, hole: 0.1, rise: 0.12 };
  const PAGODA = { x: 0.86, y: 0.545 };
  const LEAF_COUNT = 12;
  const GLINTS = 40;
  const SPARKS = 14;
  const BELL_EVERY = 16;
  const RETINT_SECONDS = 60;
  const state = {};

  const hex = toHex;
  const rgb = parseColor;

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const dark = (c, sky, k) => hex(mixColor(rgb(c), rgb('#242c54'), k * 0.55 * sky.night));
  const moonlit = (sky) => ({ top: mixColor(sky.top, rgb('#2a3a70'), 0.65 * sky.night), low: mixColor(sky.low, rgb('#7484ae'), 0.6 * sky.night) });

  // ---- sky and far hills --------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WATER);
    const lit = moonlit(sky);
    grad.addColorStop(0, hex(lit.top));
    grad.addColorStop(1, hex(lit.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e8e2cc';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const mx = g.W * MOON.x;
    const my = g.H * MOON.y;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 22);
    halo.addColorStop(0, `rgba(232,226,204,${0.38 * sky.night})`);
    halo.addColorStop(1, 'rgba(232,226,204,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.U * 22, my - g.U * 22, g.U * 44, g.U * 44);
    ctx.fillStyle = hex(mixColor(rgb('#ebe4cc'), sky.low, 0.55 * (1 - sky.night)));
    ctx.beginPath();
    ctx.arc(mx, my, g.U * 4.2, 0, 6.3);
    ctx.fill();
  }

  function hills(ctx, g, sky, base, amp, seed, col, k) {
    ctx.fillStyle = dark(col, sky, k);
    ctx.beginPath();
    ctx.moveTo(0, g.H * WATER);
    for (let px = 0; px <= g.W; px += 2) {
      const f = px / g.W;
      const wave = fbm(f * 3.2, seed, 3, seed + 2) - 0.5;
      ctx.lineTo(px, g.H * base - g.H * amp * (wave + 0.35 * Math.sin(f * 5 + seed)));
    }
    ctx.lineTo(g.W, g.H * WATER);
    ctx.fill();
  }

  function mound(ctx, g, sky) {
    ctx.fillStyle = dark('#3a4670', sky, 0.3);
    ctx.beginPath();
    ctx.ellipse(g.W * PAGODA.x, g.H * (PAGODA.y + 0.05), g.W * 0.1, g.H * 0.06, 0, Math.PI, 0);
    ctx.fill();
  }

  // Three-tier pagoda: upturned eaves, a tall spire, one gold window.
  function paintPagoda(ctx, g, sky) {
    const px = g.W * PAGODA.x;
    const base = g.H * PAGODA.y;
    const u = g.U;
    ctx.fillStyle = dark('#10142c', sky, 0.1);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = Math.max(1, u * 0.35);
    for (let t = 0; t < 3; t++) {
      const w = u * (3.6 - t * 0.8);
      const top = base - u * (3 + t * 3.4);
      ctx.fillRect(px - w * 0.55, top, w * 1.1, u * 2.4);
      ctx.beginPath();
      ctx.moveTo(px - w * 1.5, top - u * 0.1);
      ctx.quadraticCurveTo(px - w * 0.5, top + u * 0.5, px, top - u * 0.7);
      ctx.quadraticCurveTo(px + w * 0.5, top + u * 0.5, px + w * 1.5, top - u * 0.1);
      ctx.lineTo(px + w * 0.9, top + u * 0.5);
      ctx.lineTo(px - w * 0.9, top + u * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(px, base - u * 10.3);
    ctx.lineTo(px, base - u * 13.6);
    ctx.stroke();
    ctx.fillStyle = hex(mixColor(rgb('#c9a24a'), rgb('#141828'), 0.35));
    ctx.fillRect(px - u * 0.3, base - u * 6.2, u * 0.6, u * 0.9);
    // Low roofs and trees at the foot of the tower.
    ctx.fillStyle = dark('#10142c', sky, 0.1);
    ctx.fillRect(px - u * 7, base - u * 1.2, u * 14, u * 4);
    ctx.fillRect(px - u * 9, base - u * 0.2, u * 4, u * 3);
  }

  // ---- bridge ------------------------------------------------------------

  const deckY = (g, f) => {
    const d = (f - BRIDGE.x) / (BRIDGE.r - BRIDGE.x);
    return g.H * (0.57 - BRIDGE.rise * Math.max(0, 1 - d * d));
  };

  function paintBridge(ctx, g, sky) {
    const stone = dark('#9098b0', sky, 0.15);
    const edge = dark('#c4c8d4', sky, 0.1);
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(g.W * BRIDGE.l, g.H * WATER);
    for (let f = BRIDGE.l; f <= BRIDGE.r + 0.001; f += 0.004) ctx.lineTo(g.W * f, deckY(g, f));
    ctx.lineTo(g.W * BRIDGE.r, g.H * WATER);
    ctx.fill();
    // Parapet slab along the deck.
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    ctx.beginPath();
    for (let f = BRIDGE.l; f <= BRIDGE.r + 0.001; f += 0.004) {
      const px = g.W * f;
      const py = deckY(g, f) - g.U * 0.4;
      if (f === BRIDGE.l) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Stone courses fanning from the arch.
    const cx = g.W * BRIDGE.x;
    const cy = g.H * WATER;
    const rx = g.W * BRIDGE.hole;
    const ry = g.H * BRIDGE.rise * 1.02;
    ctx.strokeStyle = dark('#4a5068', sky, 0.2);
    ctx.lineWidth = 1;
    for (let a = 0.15; a < Math.PI; a += 0.21) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rx, cy - Math.sin(a) * ry);
      ctx.lineTo(cx + Math.cos(a) * rx * 1.28, cy - Math.sin(a) * ry * 1.3);
      ctx.stroke();
    }
    ctx.strokeStyle = edge;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.08, ry * 1.08, 0, Math.PI, 0);
    ctx.stroke();
    // The opening, dark with a little warmth from the lantern.
    ctx.fillStyle = dark('#2c3562', sky, 0.2);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
    ctx.fill();
    const glow = ctx.createRadialGradient(cx - rx * 0.45, cy - g.H * 0.04, 0, cx - rx * 0.45, cy - g.H * 0.04, g.U * 9);
    glow.addColorStop(0, 'rgba(214,150,70,0.22)');
    glow.addColorStop(1, 'rgba(214,150,70,0)');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
    ctx.clip();
    ctx.fillStyle = glow;
    ctx.fillRect(cx - rx, cy - ry, rx * 2, ry);
    ctx.restore();
  }

  // Wupeng boat: low hull with lifted ends, a black woven awning.
  function paintBoat(ctx, g, sky) {
    const cx = g.W * BRIDGE.x;
    const wy = g.H * WATER;
    const u = g.U;
    const hl = u * 8;
    ctx.fillStyle = dark('#2a1e1c', sky, 0.35);
    ctx.beginPath();
    ctx.moveTo(cx - hl, wy - u * 1.8);
    ctx.quadraticCurveTo(cx - hl * 0.4, wy + u * 0.6, cx, wy + u * 0.4);
    ctx.quadraticCurveTo(cx + hl * 0.4, wy + u * 0.6, cx + hl, wy - u * 1.5);
    ctx.lineTo(cx + hl * 0.8, wy - u * 0.6);
    ctx.lineTo(cx - hl * 0.8, wy - u * 0.8);
    ctx.fill();
    ctx.fillStyle = dark('#0a0a12', sky, 0);
    ctx.beginPath();
    ctx.ellipse(cx + u * 0.5, wy - u * 0.8, u * 4.6, u * 3.6, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = dark('#3a3a4a', sky, 0.3);
    ctx.lineWidth = 1;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + u * 0.5 + k * u * 1.3, wy - u * 0.8);
      ctx.quadraticCurveTo(cx + u * 0.5 + k * u * 0.9, wy - u * 3.6, cx + u * 0.5 + k * u * 0.2, wy - u * 4.4);
      ctx.stroke();
    }
    ctx.fillStyle = dark('#2a1e1c', sky, 0.3);
    ctx.fillRect(cx + hl - u * 0.5, wy - u * 4.2, u * 0.4, u * 3);
    ctx.fillRect(cx - hl + u * 0.3, wy - u * 3.8, u * 0.4, u * 2.2);
  }

  // ---- maples ------------------------------------------------------------

  const LEAF = ['#9a3a28', '#b0502e', '#b88a36', '#8a6a2e', '#4e5c3a', '#a8412c'];

  function maple(ctx, g, sky, rand, fx, fy, size) {
    const u = g.U;
    const x0 = g.W * fx;
    const y0 = g.H * fy;
    ctx.strokeStyle = dark('#2c2420', sky, 0.4);
    ctx.lineWidth = Math.max(1, u * 0.9);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 - u * 1.4, y0 - size * u * 0.5, x0 + u * 0.8, y0 - size * u * 1.1);
    ctx.stroke();
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 - size * u * 0.6);
      ctx.lineTo(x0 + (b - 1) * size * u * 0.5, y0 - size * u * (1.2 + b * 0.05));
      ctx.stroke();
    }
    for (let i = 0; i < 46; i++) {
      const a = rand() * 6.3;
      const r = Math.sqrt(rand()) * size * u * 0.75;
      const px = x0 + Math.cos(a) * r * 1.2;
      const py = y0 - size * u * 1.15 + Math.sin(a) * r * 0.7;
      ctx.fillStyle = dark(LEAF[Math.floor(rand() * LEAF.length)], sky, 0.5);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(px, py, u * (0.9 + rand() * 1.3), 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Frost on the crown.
    ctx.fillStyle = '#dfe6ee';
    for (let i = 0; i < 18; i++) {
      const a = rand() * 3.1;
      const r = rand() * size * u * 0.7;
      ctx.globalAlpha = 0.25 + rand() * 0.35;
      ctx.fillRect(x0 + Math.cos(a) * r * 1.2, y0 - size * u * 1.15 - Math.sin(a) * r * 0.7, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintBanks(ctx, g, sky) {
    ctx.fillStyle = dark('#3e5238', sky, 0.3);
    ctx.beginPath();
    ctx.moveTo(0, g.H * WATER);
    ctx.lineTo(0, g.H * 0.6);
    ctx.quadraticCurveTo(g.W * 0.06, g.H * 0.585, g.W * BRIDGE.l + g.W * 0.01, g.H * 0.58);
    ctx.lineTo(g.W * BRIDGE.l + g.W * 0.01, g.H * WATER);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(g.W, g.H * WATER);
    ctx.lineTo(g.W, g.H * 0.61);
    ctx.quadraticCurveTo(g.W * 0.8, g.H * 0.595, g.W * BRIDGE.r - g.W * 0.01, g.H * 0.58);
    ctx.lineTo(g.W * BRIDGE.r - g.W * 0.01, g.H * WATER);
    ctx.fill();
    // Frost on the grass edge.
    ctx.fillStyle = '#dfe6ee';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, g.H * 0.602, g.W * 0.1, 1);
    ctx.fillRect(g.W * 0.7, g.H * 0.6, g.W * 0.3, 1);
    ctx.globalAlpha = 1;
  }

  // ---- water -------------------------------------------------------------

  function reflect(ctx, g, sky, scene) {
    const wy = Math.round(g.H * WATER);
    const rows = g.H - wy;
    const mirror = layer(g.W, rows);
    const mc = mirror.getContext('2d');
    for (let dy = 0; dy < rows; dy++) {
      const sy = wy - 1 - dy * 0.95;
      if (sy < 0) break;
      const off = Math.sin(dy * 0.9) * g.U * 0.25 * (0.4 + dy / rows);
      mc.drawImage(scene, 0, sy, g.W, 1, off, dy, g.W, 1);
    }
    ctx.fillStyle = dark('#27325a', sky, 0.5);
    ctx.fillRect(0, wy, g.W, rows);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(mirror, 0, wy);
    ctx.globalAlpha = 1;
    const fade = ctx.createLinearGradient(0, wy, 0, g.H);
    fade.addColorStop(0, 'rgba(12,16,32,0)');
    fade.addColorStop(1, 'rgba(20,26,52,0.4)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, wy, g.W, rows);
  }

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.08, 4, 33), fbm((x - c.width) * 0.012, y * 0.08, 4, 33), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 190;
        img.data[i + 1] = 200;
        img.data[i + 2] = 220;
        img.data[i + 3] = smoothstep(0.38, 0.7, v) * band * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function bake(g, sky) {
    const rand = K.rng(17);
    const scene = layer(g.W, g.H);
    const ctx = scene.getContext('2d');
    paintSky(ctx, g, sky, rand);
    hills(ctx, g, sky, 0.56, 0.12, 3, '#4a5888', 0.3);
    mound(ctx, g, sky);
    paintPagoda(ctx, g, sky);
    hills(ctx, g, sky, 0.62, 0.06, 8, '#1a2040', 0.2);
    ctx.clearRect(0, g.H * WATER, g.W, g.H);
    paintBridge(ctx, g, sky);
    paintBoat(ctx, g, sky);
    paintBanks(ctx, g, sky);
    maple(ctx, g, sky, rand, 0.06, 0.62, 17);
    maple(ctx, g, sky, rand, 0.15, 0.61, 11);
    maple(ctx, g, sky, rand, 0.7, 0.61, 14);
    maple(ctx, g, sky, rand, 0.95, 0.63, 19);
    const out = layer(g.W, g.H);
    const octx = out.getContext('2d');
    octx.drawImage(scene, 0, 0, g.W, Math.ceil(g.H * WATER), 0, 0, g.W, Math.ceil(g.H * WATER));
    reflect(octx, g, sky, scene);
    return out;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    state.base = bake(g, sky);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mist;
    const off = -((t * g.U * 0.9) % m.width);
    const y = g.H * 0.56;
    ctx.globalAlpha = Math.min(1, 0.8 * amount * (0.4 + state.night * 0.6));
    ctx.drawImage(m, off, y);
    ctx.drawImage(m, off + m.width, y);
    ctx.globalAlpha = 1;
  }

  function drawHigh(ctx, g, t, amount) {
    const m = state.mist;
    const off = -((t * g.U * 0.5 + m.width * 0.3) % m.width);
    ctx.globalAlpha = Math.min(1, 0.35 * amount);
    ctx.drawImage(m, off, g.H * 0.1);
    ctx.drawImage(m, off + m.width, g.H * 0.1);
    ctx.globalAlpha = 1;
  }

  function drawWater(ctx, g, t) {
    const wy = g.H * WATER;
    const rows = g.H - Math.round(wy);
    ctx.globalAlpha = 0.4;
    ctx.drawImage(state.base, 0, Math.round(wy), g.W, rows, Math.sin(t * 0.9) * g.U * 0.7, Math.round(wy), g.W, rows);
    ctx.globalAlpha = 1;
    const mx = g.W * MOON.x;
    for (let i = 0; i < GLINTS; i++) {
      const q = state.glints[i];
      const y = wy + q.y * (g.H - wy);
      const near = 1 - Math.abs(q.x - 0.5);
      const a = (0.5 + 0.5 * Math.sin(t * q.s + q.p)) * q.a;
      ctx.fillStyle = q.moon ? '#e8e2cc' : '#9aa6c0';
      ctx.globalAlpha = a * (q.moon ? 1 : 0.5) * (0.4 + near * 0.4) * (0.3 + state.night * 0.7);
      const px = q.moon ? mx + (q.x - 0.5) * g.U * 16 * (0.4 + q.y) : g.W * q.x;
      ctx.fillRect(px, y, g.U * q.w, Math.max(1, g.U * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  function drawLantern(ctx, g, t) {
    const cx = g.W * BRIDGE.x + g.U * 8;
    const cy = g.H * WATER - g.U * 4.2;
    const flick = 0.75 + 0.25 * Math.sin(t * 2.3) * Math.sin(t * 0.6 + 1);
    ctx.globalAlpha = 0.5 * flick;
    ctx.drawImage(state.glow, cx - g.U * 5, cy - g.U * 5, g.U * 10, g.U * 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d9a248';
    ctx.fillRect(cx - 1, cy - 1, 2, 3);
  }

  function drawSparks(ctx, g, t) {
    ctx.fillStyle = '#e6edf5';
    for (let i = 0; i < SPARKS; i++) {
      const q = state.sparks[i];
      ctx.globalAlpha = (0.5 + 0.5 * Math.sin(t * 0.7 + q.p)) * 0.55;
      ctx.fillRect(g.W * q.x, g.H * q.y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t) {
    for (let i = 0; i < LEAF_COUNT; i++) {
      const q = state.leaves[i];
      const a = (t * q.v + q.p) % 1;
      const px = g.W * q.x + Math.sin(t * 0.8 + q.p * 9) * g.U * 2 + a * g.U * 8;
      const py = g.H * (0.5 + a * (WATER + 0.12 - 0.5));
      ctx.fillStyle = q.c;
      ctx.globalAlpha = 0.85 * (1 - state.night * 0.4);
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawBell(ctx, g, t) {
    const a = (t % BELL_EVERY) / 6;
    const px = g.W * PAGODA.x;
    const py = g.H * PAGODA.y - g.U * 6;
    if (a >= 1) return;
    ctx.strokeStyle = '#d9b868';
    ctx.lineWidth = 1;
    ctx.globalAlpha = (1 - a) * 0.28;
    ctx.beginPath();
    ctx.arc(px, py, g.U * (2 + a * 14), 0, 6.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(5);
    state.mist = paintMist(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.16));
    state.glow = layer(16, 16);
    const gc = state.glow.getContext('2d');
    const grad = gc.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(236,176,86,0.9)');
    grad.addColorStop(1, 'rgba(236,176,86,0)');
    gc.fillStyle = grad;
    gc.fillRect(0, 0, 16, 16);
    state.glints = Array.from({ length: GLINTS }, (_, i) => ({
      x: rand(), y: rand(), w: 2 + rand() * 4, s: 0.5 + rand() * 0.9, p: rand() * 6.3, a: 0.7 + rand() * 0.3, moon: i < 26,
    }));
    state.sparks = Array.from({ length: SPARKS }, () => ({ x: rand() < 0.5 ? rand() * 0.2 : 0.65 + rand() * 0.34, y: 0.4 + rand() * 0.2, p: rand() * 6.3 }));
    state.leaves = Array.from({ length: LEAF_COUNT }, () => ({
      x: rand() < 0.5 ? 0.04 + rand() * 0.12 : 0.66 + rand() * 0.3, v: 0.012 + rand() * 0.01, p: rand(), c: LEAF[Math.floor(rand() * 4)],
    }));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.base, 0, 0);
    drawWater(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    drawHigh(ctx, g, t, props.mist);
    drawLantern(ctx, g, t);
    drawSparks(ctx, g, t);
    if (props.leaves) drawLeaves(ctx, g, t);
    drawBell(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'night', mist: 1, leaves: true, ramp: 'lines', cell: 7, boost: 0.3, gain: 1.3, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
