/*
 * 白鳥 Hakucho — whooper swans on a winter lake at sunrise, mist lifting off the water.
 *
 * Sky, mountains and water are baked. Each near swan is a small sprite: a baked
 * body plus a neck ribbon and wing fans redrawn from reused typed arrays, and the
 * same sprite is laid back down in thin slices for its reflection.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, lerp, smoothstep } = K;

  const HORIZON = 0.52;
  const SUN_X = 0.595;
  const NECK_STEPS = 14;
  const FEATHERS = 13;
  const RINGS = 6;
  const GLINTS = 90;
  const PUFFS = 24;
  const TAU = Math.PI * 2;

  // A pose: head x, y, neck control points c1 and c2, head angle, nibble amount.
  const REST = [24, -40, 9, -20, 31, -27, 0.14, 0];
  const TALL = [20, -44, 12, -22, 25, -32, 0.03, 0];
  const DIP = [41, 4, 24, -27, 45, -22, 1.35, 0];
  const PREEN = [-5, -19, 16, -34, -10, -39, 2.7, 1];
  const HERO_TRACK = {
    length: 60,
    keys: [[0, REST], [12, REST], [15, PREEN], [24, PREEN], [27, REST], [36, REST], [39, DIP], [45, DIP], [48, REST], [60, REST]],
  };
  const STRETCH_TRACK = { length: 30, keys: [[0, REST], [9, REST], [13, TALL], [24, TALL], [28, REST], [30, REST]] };

  const NEAR_WING = ['#f8f1e6', '#d9dce4', '#fff7ea'];
  const FAR_WING = ['#c9cede', '#aeb5ca', '#d8dbe6'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blot(c, x, y, rx, ry) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fill();
  }

  function addStops(gradient, ...pairs) {
    for (let i = 0; i < pairs.length; i += 2) gradient.addColorStop(pairs[i], pairs[i + 1]);
  }

  function paintSky(ctx, g) {
    const hy = g.H * HORIZON;
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    addStops(sky, 0, '#94a6ce', 0.42, '#c4c0d6', 0.75, '#efc6ae', 1, '#fadcb2');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, hy + 1);
    const sx = g.W * SUN_X;
    const sy = hy - g.U * 20;
    const glow = ctx.createRadialGradient(sx, sy, g.U * 3, sx, sy, g.U * 46);
    addStops(glow,
      0, 'rgba(255,226,176,0.8)',
      0.18, 'rgba(252,212,164,0.42)',
      0.5, 'rgba(250,200,158,0.16)',
      1, 'rgba(240,190,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, hy + 1);
    ctx.fillStyle = '#fff6da';
    ctx.beginPath();
    ctx.arc(sx, sy, g.U * 5, 0, TAU);
    ctx.fill();
    state.sun = { x: sx, y: sy };
  }

  // Height of the snowy range above the waterline at x, in cells.
  function farRidge(x, g) {
    const f = x / g.W;
    const xu = x / g.U;
    const peaks = state.peaks;
    let env = 7;
    for (let i = 0; i < peaks.length; i += 3) {
      const d = Math.abs(f - peaks[i]) / peaks[i + 2];
      if (d < 1) env = Math.max(env, peaks[i + 1] * Math.pow(1 - d, 1.15));
    }
    return g.U * (env * (0.84 + 0.32 * fbm(xu * 0.05, 3.1, 3, 7)) + (fbm(xu * 0.24, 9.4, 3, 8) - 0.5) * 4.5);
  }

  function peakTone(xu, yu, depth, lit) {
    const edge = 0.4 + 0.42 * fbm(xu * 0.2, yu * 0.09, 3, 12);
    const gully = noise2(xu * 0.42 + yu * 0.2, yu * 0.5, 15);
    const sunny = gully > 0.68 ? !lit : lit;
    if (depth < edge) return sunny ? '#fff0e0' : '#bcc1de';
    return sunny ? '#8f92b2' : '#6a7096';
  }

  function paintPeaks(ctx, g) {
    const hy = Math.ceil(g.H * HORIZON);
    const sunX = g.W * SUN_X;
    for (let x = 0; x < g.W; x++) {
      const top = hy - farRidge(x, g);
      const slope = farRidge(x + g.U, g) - farRidge(x - g.U, g);
      const lit = x < sunX ? slope < 0 : slope > 0;
      let from = Math.floor(top);
      let tone = null;
      for (let y = from; y <= hy; y++) {
        const next = y === hy ? null : peakTone(x / g.U, y / g.U, (y - top) / (hy - top), lit);
        if (next === tone) continue;
        if (tone) {
          ctx.fillStyle = tone;
          ctx.fillRect(x, from, 1, y - from);
        }
        tone = next;
        from = y;
      }
    }
  }

  function paintHills(ctx, g, rand) {
    const hy = g.H * HORIZON;
    ctx.fillStyle = '#6a7496';
    ctx.beginPath();
    ctx.moveTo(0, hy + 1);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, hillTop(x, g, hy));
    }
    ctx.lineTo(g.W, hy + 1);
    ctx.fill();
    paintHillTexture(ctx, g, rand, hy);
    const hazy = ctx.createLinearGradient(0, hy - g.U * 18, 0, hy);
    addStops(hazy, 0, 'rgba(240,205,175,0)', 1, 'rgba(240,205,175,0.55)');
    ctx.fillStyle = hazy;
    ctx.fillRect(0, hy - g.U * 18, g.W, g.U * 18 + 1);
    paintTrees(ctx, g, rand, hy);
  }

  function hillTop(x, g, hy) {
    const dip = 1 - 0.75 * Math.exp(-Math.pow((x / g.W - SUN_X) / 0.14, 2));
    return hy - g.U * (5 + 13 * dip * fbm((x / g.U) * 0.05, 5.5, 3, 31));
  }

  function paintHillTexture(ctx, g, rand, hy) {
    const step = Math.max(1, g.U * 0.9);
    for (let x = 0; x < g.W; x += step) {
      const top = hillTop(x, g, hy);
      const tall = g.U * (0.8 + rand() * 1.8);
      ctx.fillStyle = '#5f6a8c';
      ctx.beginPath();
      ctx.moveTo(x - tall * 0.5, top + g.U);
      ctx.lineTo(x, top - tall);
      ctx.lineTo(x + tall * 0.5, top + g.U);
      ctx.fill();
      const down = rand() * (hy - top);
      ctx.fillStyle = rand() < 0.45 ? '#9ca2be' : '#596486';
      ctx.fillRect(x, top + down, Math.max(1, g.U * 0.8), Math.max(1, g.U * 0.5));
    }
  }

  function paintTrees(ctx, g, rand, hy) {
    const step = Math.max(1, g.U * 1.1);
    for (let x = -step; x < g.W + step; x += step) {
      const tall = g.U * (1.6 + rand() * 3.2) * (0.7 + 0.8 * fbm(x / g.U * 0.04, 2.2, 2, 41));
      ctx.fillStyle = rand() < 0.5 ? '#45506f' : '#4d5a7a';
      ctx.beginPath();
      ctx.moveTo(x - tall * 0.32, hy + 1);
      ctx.lineTo(x, hy - tall);
      ctx.lineTo(x + tall * 0.32, hy + 1);
      ctx.fill();
    }
    ctx.fillStyle = '#45506f';
    ctx.fillRect(0, hy - Math.max(1, g.U * 0.5), g.W, Math.max(1, g.U * 0.5) + 1);
  }

  function paintBackdrop(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    state.peaks = [0.15, 40, 0.2, 0.33, 27, 0.13, 0.64, 14, 0.07, 0.87, 37, 0.17, 1.02, 24, 0.09];
    paintSky(ctx, g);
    paintPeaks(ctx, g);
    paintHills(ctx, g, rand);
    return c;
  }

  function paintWater(g, backdrop) {
    const pad = Math.ceil(g.U * 5);
    const hy = Math.floor(g.H * HORIZON);
    const h = g.H - hy;
    const c = layer(g.W + pad * 2, h);
    const ctx = c.getContext('2d');
    const base = ctx.createLinearGradient(0, 0, 0, h);
    addStops(base, 0, '#868aa6', 0.35, '#5a6686', 1, '#38456a');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, c.width, h);
    ctx.globalAlpha = 0.5;
    ctx.save();
    ctx.scale(1, -0.86);
    ctx.drawImage(backdrop, 0, 0, g.W, hy, 0, -hy, c.width, hy);
    ctx.restore();
    ctx.globalAlpha = 1;
    const deep = ctx.createLinearGradient(0, 0, 0, h);
    addStops(deep, 0, 'rgba(34,45,72,0.08)', 0.5, 'rgba(40,52,84,0.3)', 1, 'rgba(40,52,84,0.6)');
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, c.width, h);
    const sx = pad + g.W * SUN_X;
    const path = ctx.createLinearGradient(sx - g.U * 22, 0, sx + g.U * 22, 0);
    addStops(path, 0, 'rgba(240,190,140,0)', 0.5, 'rgba(244,198,146,0.42)', 1, 'rgba(240,190,140,0)');
    ctx.fillStyle = path;
    ctx.fillRect(sx - g.U * 22, 0, g.U * 44, h);
    state.waterPad = pad;
    state.waterTop = hy;
    return c;
  }

  function makeWaterSlices(g) {
    const h = g.H - state.waterTop;
    const sh = Math.max(1, Math.round(g.U * 1.4));
    const count = Math.ceil(h / sh);
    const phase = new Float32Array(count);
    const amp = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const f = i / count;
      phase[i] = i * 0.9 + Math.sin(i * 0.37) * 2;
      amp[i] = g.U * (0.25 + f * 2.2);
    }
    return { sh, count, phase, amp };
  }

  function paintRippleTile(g, rand, tone, count) {
    const h = g.H - state.waterTop;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone;
    for (let i = 0; i < count; i++) {
      const f = 0.1 + 0.9 * Math.pow(rand(), 1.3);
      const len = g.U * (1.5 + f * 13 * (0.5 + rand()));
      const thick = Math.max(1, g.U * (0.25 + f * 0.5));
      const x = rand() * g.W;
      const y = f * h;
      ctx.fillRect(x, y, len, thick);
      if (x + len > g.W) ctx.fillRect(x - g.W, y, len, thick);
    }
    return c;
  }

  function makeGlints(g, rand) {
    const h = g.H - state.waterTop;
    const d = new Float32Array(GLINTS * 6);
    for (let i = 0; i < GLINTS; i++) {
      const f = Math.pow(rand(), 0.9);
      const spread = (rand() + rand() - 1) * g.U * (5 + f * 20);
      const len = g.U * (1.2 + f * 5 * rand());
      d[i * 6] = state.sun.x + spread - len / 2;
      d[i * 6 + 1] = state.waterTop + f * h * 0.92 + g.U;
      d[i * 6 + 2] = len;
      d[i * 6 + 3] = Math.max(1, g.U * (0.25 + f * 0.25));
      d[i * 6 + 4] = rand() * TAU;
      d[i * 6 + 5] = 0.5 + rand() * 1.1;
    }
    return d;
  }

  function drawWater(ctx, g, t, ripple) {
    const s = state.slices;
    const top = state.waterTop;
    const pad = state.waterPad;
    const water = state.water;
    for (let i = 0; i < s.count; i++) {
      const dx = Math.sin(t * 0.55 + s.phase[i]) * s.amp[i] * Math.min(ripple, 1.5);
      ctx.drawImage(water, 0, i * s.sh, water.width, s.sh, -pad + dx, top + i * s.sh, water.width, s.sh);
    }
    const a = (t * g.U * 0.9) % g.W;
    const b = (t * g.U * 1.5) % g.W;
    ctx.globalAlpha = Math.min(1, 0.3 * ripple);
    ctx.drawImage(state.lights, a - g.W, top);
    ctx.drawImage(state.lights, a, top);
    ctx.globalAlpha = Math.min(1, 0.42 * ripple);
    ctx.drawImage(state.darks, -b, top);
    ctx.drawImage(state.darks, g.W - b, top);
    drawGlints(ctx, t, ripple);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, t, ripple) {
    const d = state.glints;
    ctx.fillStyle = '#ffe6b4';
    for (let i = 0; i < GLINTS; i++) {
      const on = Math.sin(t * d[i * 6 + 5] + d[i * 6 + 4]);
      if (on < 0) continue;
      ctx.globalAlpha = Math.min(1, on * 0.6 * ripple);
      ctx.fillRect(d[i * 6], d[i * 6 + 1], d[i * 6 + 2], d[i * 6 + 3]);
    }
  }

  // Half-size tile; alpha sits on a few flat steps and scaling softens them.
  function paintMistTile(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const v = (x, y) => fbm(x * 0.03, y * 0.14, 3, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const n = lerp(v(x, y), v(x - c.width, y), x / c.width);
        const a = Math.round(smoothstep(0.34, 0.66, n) * band * 5) / 5;
        const i = (y * c.width + x) * 4;
        img.data[i] = 244;
        img.data[i + 1] = 226;
        img.data[i + 2] = 208;
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const r = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
    addStops(r, 0, 'rgba(246,232,218,0.9)', 0.55, 'rgba(246,232,218,0.38)', 1, 'rgba(246,232,218,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function makePuffs(g, rand) {
    const list = [];
    for (let i = 0; i < PUFFS; i++) {
      list.push({
        x: ((i + rand() * 0.8) / PUFFS) * g.W,
        y: g.H * (HORIZON + 0.13 + rand() * 0.3),
        w: g.U * (7 + rand() * 7),
        h: g.U * (10 + rand() * 8),
        rise: g.U * (5 + rand() * 6),
        drift: g.U * (2 + rand() * 4),
        rate: 0.03 + rand() * 0.035,
        start: rand(),
      });
    }
    return list;
  }

  function drawPuffs(ctx, t, amount, from, to) {
    const puffs = state.puffs;
    for (let i = from; i < to; i++) {
      const p = puffs[i];
      const life = (t * p.rate + p.start) % 1;
      ctx.globalAlpha = Math.min(1, Math.sin(life * Math.PI) * 0.62 * amount);
      const w = p.w * (0.7 + life * 0.8);
      ctx.drawImage(state.puff, p.x + life * p.drift - w / 2, p.y - life * p.rise - p.h, w, p.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawMistBand(ctx, g, tile, y, h, t, rate, alpha) {
    const w = tile.width * 2;
    const x = (t * g.U * rate) % w;
    ctx.globalAlpha = Math.min(1, alpha);
    for (let px = -x; px < g.W; px += w) ctx.drawImage(tile, px, y, w, h);
    ctx.globalAlpha = 1;
  }

  function traceBody(c) {
    c.beginPath();
    c.moveTo(-35, -11.5);
    c.bezierCurveTo(-29, -10.5, -23, -11.5, -16, -13.8);
    c.bezierCurveTo(-8, -16.6, 4, -16.8, 12, -13.5);
    c.bezierCurveTo(20, -12.5, 26.5, -7, 25, 0.5);
    c.lineTo(25, 4);
    c.lineTo(-20, 4);
    c.lineTo(-20, 0.5);
    c.bezierCurveTo(-25, -1, -29, -6, -35, -11.5);
    c.closePath();
  }

  function paintFoldedWing(c) {
    const wing = c.createLinearGradient(0, -16, 0, -3);
    addStops(wing, 0, '#fffaf0', 0.7, '#ece9e6', 1, '#bfc5d6');
    c.fillStyle = wing;
    c.beginPath();
    c.moveTo(15, -10);
    c.bezierCurveTo(9, -16, -8, -16.5, -16, -13.4);
    c.bezierCurveTo(-22, -11.4, -27, -11, -33, -11);
    c.bezierCurveTo(-24, -5.5, -12, -3, 0, -3.2);
    c.bezierCurveTo(8, -3.4, 14, -5, 15, -10);
    c.fill();
    c.strokeStyle = '#aab1c6';
    c.lineCap = 'round';
    c.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo(-6 - i * 2, -13.5 + i * 2);
      c.quadraticCurveTo(-18 - i, -11 + i * 1.6, -31 + i * 2.5, -10.4 + i * 0.5);
      c.stroke();
    }
    c.strokeStyle = '#ccd0de';
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.arc(11 - i * 2.6, -8.5 - (i % 2) * 2.6 + i * 0.1, 1.7, 0.4, 2.6);
      c.stroke();
    }
  }

  function paintBody(s) {
    const canvas = layer(66 * s, 26 * s);
    const c = canvas.getContext('2d');
    c.scale(canvas.width / 66, canvas.height / 26);
    c.translate(35, 20);
    const fill = c.createLinearGradient(0, -17, 0, 1);
    addStops(fill, 0, '#fff8ec', 0.72, '#f1ebe4', 1, '#a9b1c6');
    traceBody(c);
    c.fillStyle = fill;
    c.fill();
    c.save();
    traceBody(c);
    c.clip();
    const rear = c.createLinearGradient(-32, 0, -4, 0);
    addStops(rear, 0, 'rgba(120,130,165,0.5)', 1, 'rgba(120,130,165,0)');
    c.fillStyle = rear;
    c.fillRect(-35, -20, 40, 26);
    const breast = c.createRadialGradient(22, -6, 1, 22, -6, 14);
    addStops(breast, 0, 'rgba(255,226,190,0.8)', 1, 'rgba(255,226,190,0)');
    c.fillStyle = breast;
    c.fillRect(6, -20, 25, 26);
    paintFoldedWing(c);
    c.restore();
    return canvas;
  }

  function samplePose(track, t, out) {
    const keys = track.keys;
    const at = t % track.length;
    let i = 0;
    while (i < keys.length - 2 && at >= keys[i + 1][0]) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const f = smoothstep(a[0], b[0], at);
    for (let n = 0; n < out.length; n++) out[n] = lerp(a[1][n], b[1][n], f);
  }

  function shapeNeck(p, t) {
    const { nx, ny, nl, nr } = state.neck;
    const sway = Math.sin(t * 0.6) * 0.9;
    const hx = p[0] + sway;
    const hy = p[1] + Math.sin(t * 0.43) * 0.5;
    const c2x = p[4] + sway * 0.6;
    for (let i = 0; i <= NECK_STEPS; i++) {
      const f = i / NECK_STEPS;
      const m = 1 - f;
      nx[i] = m * m * m * 16 + 3 * m * m * f * p[2] + 3 * m * f * f * c2x + f * f * f * hx;
      ny[i] = m * m * m * -9 + 3 * m * m * f * p[3] + 3 * m * f * f * p[5] + f * f * f * hy;
      nl[i] = lerp(5.4, 1.75, Math.pow(f, 0.6));
    }
    for (let i = 0; i <= NECK_STEPS; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(NECK_STEPS, i + 1);
      const dx = nx[b] - nx[a];
      const dy = ny[b] - ny[a];
      const len = Math.hypot(dx, dy) || 1;
      nr[i * 2] = -dy / len;
      nr[i * 2 + 1] = dx / len;
    }
  }

  function traceRibbon(c, widen, shiftX, shiftY) {
    const { nx, ny, nl, nr } = state.neck;
    c.beginPath();
    for (let i = 0; i <= NECK_STEPS; i++) {
      const w = nl[i] * (widen < 1 ? widen : lerp(0.8, widen, Math.min(1, i / 4)));
      const x = nx[i] + nr[i * 2] * w + shiftX;
      const y = ny[i] + nr[i * 2 + 1] * w + shiftY;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    for (let i = NECK_STEPS; i >= 0; i--) {
      const w = nl[i] * (widen < 1 ? widen : lerp(0.8, widen, Math.min(1, i / 4)));
      c.lineTo(nx[i] - nr[i * 2] * w + shiftX, ny[i] - nr[i * 2 + 1] * w + shiftY);
    }
    c.closePath();
    c.fill();
  }

  function paintBill(c) {
    c.fillStyle = '#1d1f2a';
    c.beginPath();
    c.moveTo(1.8, -2.5);
    c.lineTo(9.8, -0.5);
    c.quadraticCurveTo(10.5, 0.6, 9.4, 1.1);
    c.lineTo(2, 2.2);
    c.closePath();
    c.fill();
    c.fillStyle = '#eec23c';
    c.beginPath();
    c.moveTo(1.2, -2.7);
    c.lineTo(7, -1);
    c.lineTo(4.4, 0.8);
    c.lineTo(1.4, 1.2);
    c.closePath();
    c.fill();
  }

  function paintHead(c, p, t) {
    const nibble = p[7] * Math.sin(t * 4.2) * 0.14;
    const angle = p[6] + nibble;
    c.save();
    c.translate(state.neck.nx[NECK_STEPS], state.neck.ny[NECK_STEPS]);
    c.rotate(angle);
    if (Math.cos(angle) < 0) c.scale(1, -1);
    c.fillStyle = '#a9b0c6';
    blot(c, -0.3, 0.3, 4, 3);
    c.fillStyle = '#fff8ec';
    blot(c, 0, -0.1, 3.7, 2.7);
    paintBill(c);
    c.fillStyle = '#1d1f2a';
    c.beginPath();
    c.arc(0.7, -0.8, 0.7, 0, TAU);
    c.fill();
    c.restore();
  }

  function paintNeck(c, p, t) {
    shapeNeck(p, t);
    c.fillStyle = '#9fa8c0';
    traceRibbon(c, 1, 0, 0);
    c.fillStyle = '#f4efe6';
    traceRibbon(c, 0.82, 0.5, -0.1);
    c.fillStyle = '#fff4e2';
    traceRibbon(c, 0.42, 1.25, -0.2);
    paintHead(c, p, t);
  }

  function paintWing(c, sx, sy, o, beat, far) {
    const tones = far ? FAR_WING : NEAR_WING;
    const arm = lerp(3.2, far ? 4.62 : 4.2, o) + beat * 0.22;
    const hand = lerp(3.14, far ? 4.05 : 3.5, o) + beat * 0.42;
    const reach = lerp(0.45, 1, smoothstep(0, 0.55, o));
    const wx = sx + Math.cos(arm) * 19 * reach;
    const wy = sy + Math.sin(arm) * 19 * reach;
    const tx = wx + Math.cos(hand) * 20 * reach;
    const ty = wy + Math.sin(hand) * 20 * reach;
    const trail = lerp(3.14, 2.4, o) - beat * 0.2;
    for (let i = FEATHERS - 1; i >= 0; i--) {
      const f = i / (FEATHERS - 1);
      const rx = f < 0.5 ? lerp(tx, wx, f * 2) : lerp(wx, sx, f * 2 - 1);
      const ry = f < 0.5 ? lerp(ty, wy, f * 2) : lerp(wy, sy, f * 2 - 1);
      const ang = lerp(hand, trail, Math.pow(f, 0.7));
      const len = lerp(25, 17, f) * reach;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      c.fillStyle = tones[i % 2];
      c.beginPath();
      c.moveTo(rx - sa * 2.7, ry + ca * 2.7);
      c.lineTo(rx + ca * len, ry + sa * len);
      c.lineTo(rx + sa * 2.7, ry - ca * 2.7);
      c.closePath();
      c.fill();
    }
    c.strokeStyle = tones[2];
    c.lineWidth = 3.4;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(wx, wy);
    c.lineTo(tx, ty);
    c.stroke();
  }

  // Wings open from 0 to 1 on a slow loop; beat is the slow flex while they are up.
  function wingOpen(t) {
    return smoothstep(9, 14, t % 30) * (1 - smoothstep(23, 28, t % 30));
  }

  function wingBeat(t) {
    const at = t % 30;
    return Math.sin((at - 14) * 1.25) * smoothstep(13, 15, at) * (1 - smoothstep(21, 24, at));
  }

  function paintSwan(swan, track, t) {
    const c = swan.ctx;
    const s = swan.s;
    const open = swan.wings ? wingOpen(t) : 0;
    const beat = swan.wings ? wingBeat(t) : 0;
    samplePose(track, t + swan.offset, state.pose);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, swan.canvas.width, swan.canvas.height);
    c.setTransform(swan.dir * s, 0, 0, s, swan.ax, swan.canvas.height);
    c.translate(0, Math.sin(t * 0.8 + swan.offset) * 0.35);
    if (open > 0.01) {
      c.translate(-18, -2.5 * open);
      c.rotate(-0.2 * open);
      c.translate(18, 0);
      c.globalAlpha = smoothstep(0, 0.2, open);
      paintWing(c, 11, -14, open, beat, true);
      c.globalAlpha = 1;
    }
    c.drawImage(swan.body, -31, -23, 58, 30);
    paintNeck(c, state.pose, t);
    if (open > 0.01) {
      c.globalAlpha = smoothstep(0, 0.2, open);
      paintWing(c, 6, -14, open, beat, false);
      c.globalAlpha = 1;
    }
  }

  function makeSwan(g, o) {
    const s = o.size * g.U;
    const back = o.wings ? 66 : 38;
    const front = 50;
    const canvas = layer((back + front) * s, (o.wings ? 82 : 56) * s);
    const swan = {
      s,
      dir: o.dir,
      x0: o.x * g.W,
      wy: g.H * o.y,
      vel: (o.glide || 0) * g.U,
      span: g.W + g.U * 90 * o.size + g.U * 30,
      sway: (o.sway || 0) * g.U,
      wings: !!o.wings,
      offset: o.offset || 0,
      canvas,
      ctx: canvas.getContext('2d'),
      ax: o.dir > 0 ? back * s : front * s,
      body: paintBody(s),
      stride: Math.max(1, Math.round(s * 2.2)),
    };
    swan.slices = Math.min(Math.ceil(canvas.height / swan.stride), Math.ceil((g.H - swan.wy) / (swan.stride * 0.86)));
    return swan;
  }

  function swanX(swan, t) {
    if (!swan.vel) return swan.x0 + Math.sin((t * TAU) / 140) * swan.sway;
    const margin = (swan.span - state.g.W) / 2;
    const raw = (swan.x0 + margin + swan.vel * t * swan.dir) % swan.span;
    return (raw < 0 ? raw + swan.span : raw) - margin;
  }

  function drawRings(ctx, swan, t, amount) {
    const life = swan.vel ? 26 : 16;
    ctx.strokeStyle = '#cfd5e6';
    ctx.lineWidth = Math.max(1, swan.s * 0.8);
    for (let i = 0; i < RINGS; i++) {
      const age = ((t / life + i / RINGS) % 1) * life;
      const f = age / life;
      const rx = swan.s * (29 + f * 34);
      ctx.globalAlpha = Math.min(1, (1 - f) * (1 - f) * smoothstep(0, 0.08, f) * 0.42 * amount);
      ctx.beginPath();
      ctx.ellipse(swanX(swan, t - age) + swan.dir * swan.s * 2, swan.wy + swan.s, rx, rx * 0.17, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawReflection(ctx, swan, x, t) {
    const { width: sw, height: sh } = swan.canvas;
    const st = swan.stride;
    const left = x - swan.ax;
    for (let j = 0; j < swan.slices; j++) {
      const f = j / swan.slices;
      const dx = Math.sin(j * 0.75 + t * 1.3) * swan.s * (0.3 + f * 2.4);
      ctx.globalAlpha = 0.5 * (1 - f * 0.7);
      ctx.drawImage(swan.canvas, 0, sh - (j + 1) * st, sw, st, left + dx, swan.wy + j * st * 0.86, sw, st * 0.86 + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  function drawSwan(ctx, swan, t, ripple) {
    const x = swanX(swan, t);
    drawRings(ctx, swan, t, ripple);
    const weight = Math.min(1, swan.s / state.g.U);
    ctx.fillStyle = '#1c2640';
    ctx.globalAlpha = 0.42 * weight;
    blot(ctx, x - swan.dir * swan.s * 3, swan.wy + swan.s * 1.4, swan.s * 30, swan.s * 3.2);
    drawReflection(ctx, swan, x, t);
    ctx.fillStyle = '#26314e';
    ctx.globalAlpha = 0.6 * weight;
    blot(ctx, x - swan.dir * swan.s * 3, swan.wy + swan.s * 0.5, swan.s * 27, Math.max(1, swan.s * 1.5));
    ctx.globalAlpha = 1;
    ctx.drawImage(swan.canvas, x - swan.ax, swan.wy - swan.canvas.height);
  }

  function paintBank(g, rand) {
    const h = g.U * 16;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const start = g.W - g.U * 34;
    const edge = (x) => h - (h * 0.82 * Math.pow(Math.max(0, (x - start) / (g.W - start)), 0.7) + fbm(x / g.U * 0.2, 2, 2, 51) * g.U * 1.6);
    ctx.fillStyle = '#c9cfe0';
    ctx.beginPath();
    ctx.moveTo(start, h);
    for (let x = start; x <= g.W + 1; x += 1) ctx.lineTo(x, edge(x));
    ctx.lineTo(g.W, h);
    ctx.fill();
    ctx.fillStyle = '#f6e6d6';
    for (let x = start; x <= g.W; x += 1) ctx.fillRect(x, edge(x), 1, Math.max(1, g.U * (0.5 + 1.2 * rand())));
    ctx.fillStyle = '#aab2cb';
    for (let i = 0; i < g.U * 14; i++) {
      const x = start + rand() * (g.W - start);
      ctx.fillRect(x, edge(x) + g.U * (2 + rand() * 9), g.U * (1 + rand() * 3), Math.max(1, g.U * 0.3));
    }
    return c;
  }

  function makeReeds(g, rand) {
    const list = [];
    const bases = g.W - g.U * 20;
    for (let i = 0; i < 10; i++) {
      list.push({
        x: bases + rand() * g.U * 20,
        y: g.H - g.U * (2 + rand() * 6),
        tall: g.U * (12 + rand() * 11),
        lean: g.U * (-3 - rand() * 4),
        phase: rand() * TAU,
        plume: i % 2 === 0,
      });
    }
    return list;
  }

  function drawReeds(ctx, g, t) {
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    for (const r of state.reeds) {
      const sway = Math.sin(t * 0.7 + r.phase) * g.U * 1.3;
      const tx = r.x + r.lean + sway;
      const ty = r.y - r.tall;
      ctx.strokeStyle = '#a8906a';
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.quadraticCurveTo(r.x + r.lean * 0.2, r.y - r.tall * 0.6, tx, ty);
      ctx.stroke();
      if (!r.plume) continue;
      ctx.strokeStyle = '#e0c99a';
      ctx.lineWidth = Math.max(1, g.U * 1.1);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - g.U * 2.2 + sway * 0.8, ty - g.U * 5);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, g.U * 0.45);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.backdrop = paintBackdrop(g, rand);
    state.water = paintWater(g, state.backdrop);
    state.slices = makeWaterSlices(g);
    state.lights = paintRippleTile(g, rand, '#a9b1cc', 90);
    state.darks = paintRippleTile(g, rand, '#18213a', 110);
    state.glints = makeGlints(g, rand);
    state.mistFar = paintMistTile(g.W * 0.75, g.U * 8, 61);
    state.mistNear = paintMistTile(g.W * 0.75, g.U * 8, 67);
    state.puff = paintPuff();
    state.puffs = makePuffs(g, rand);
    const n = NECK_STEPS + 1;
    state.neck = { nx: new Float32Array(n), ny: new Float32Array(n), nl: new Float32Array(n), nr: new Float32Array(n * 2) };
    state.pose = new Float32Array(8);
    state.glideA = makeSwan(g, { size: 0.26, x: 0.2, y: 0.585, dir: 1, glide: 1.0, offset: 7 });
    state.glideB = makeSwan(g, { size: 0.21, x: 0.09, y: 0.565, dir: 1, glide: 1.0, offset: 19 });
    state.glideC = makeSwan(g, { size: 0.36, x: 0.86, y: 0.625, dir: -1, glide: 1.3, offset: 31 });
    state.stretch = makeSwan(g, { size: 0.62, x: 0.79, y: 0.665, dir: -1, wings: true });
    state.hero = makeSwan(g, { size: 1.05, x: 0.29, y: 0.8, dir: 1, sway: 3 });
    for (const glider of [state.glideA, state.glideB, state.glideC]) paintSwan(glider, { length: 1, keys: [[0, TALL], [1, TALL]] }, glider.offset);
    state.bank = paintBank(g, rand);
    state.reeds = makeReeds(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, ripple } = api.props;
    const hy = g.H * HORIZON;
    ctx.drawImage(state.backdrop, 0, 0, g.W, Math.ceil(hy) + 1, 0, 0, g.W, Math.ceil(hy) + 1);
    drawWater(ctx, g, t, ripple);
    drawMistBand(ctx, g, state.mistFar, hy - g.U * 8, g.U * 17, t, 0.5, 1.05 * mist);
    drawSwan(ctx, state.glideB, t, ripple);
    drawSwan(ctx, state.glideA, t, ripple);
    drawSwan(ctx, state.glideC, t, ripple);
    drawPuffs(ctx, t, mist, 0, 12);
    paintSwan(state.stretch, STRETCH_TRACK, t);
    drawSwan(ctx, state.stretch, t, ripple);
    drawPuffs(ctx, t, mist, 12, 18);
    paintSwan(state.hero, HERO_TRACK, t);
    drawSwan(ctx, state.hero, t, ripple);
    drawPuffs(ctx, t, mist, 18, PUFFS);
    drawMistBand(ctx, g, state.mistNear, g.H * 0.74, g.U * 16, t, -0.8, 0.2 * mist);
    drawReeds(ctx, g, t);
    ctx.drawImage(state.bank, 0, g.H - state.bank.height);
  }

  Kasuri.run({
    defaults: { mist: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.02, dither: 0.5 },
    maxFps: 20,
    setup,
    draw,
  });
})();
