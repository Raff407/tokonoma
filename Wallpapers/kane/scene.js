/*
 * 鐘 Kane — a great bronze temple bell in its open belfry on a snowy dusk.
 *
 * The world is baked into a few layers. Each frame only slides a cloud tile, turns
 * the bell a hair, moves the log on its ropes and draws short lists of rings, birds
 * and snowflakes, all worked out from the time since the last stroke.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const TAU = Math.PI * 2;
  const CYCLE = 18;
  const RELEASE = 1.7;
  const PULL_BACK = 0.46;
  const BELL_UNIT = 1.16;
  const HOOK_Y = 36;
  const ROPE = 27;
  const RINGS = [0, 0.5, 1.2, 2.2, 3.4];
  const RING_LIFE = 10;
  const MAX_BIRDS = 44;
  const MAX_FLAKES = 340;
  const SIFT = 70;
  const INK = '#1a2036';
  const SNOW = '#d9e3f1';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.fill();
  }

  /* ---------- far world ---------- */

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.64);
    sky.addColorStop(0, '#566aa8');
    sky.addColorStop(0.4, '#8294c8');
    sky.addColorStop(0.72, '#b3b8d2');
    sky.addColorStop(1, '#ecc9aa');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#dfe6f4';
    for (let i = 0; i < g.W * 0.12; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.45;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.26, 1, 1);
    }
    ctx.globalAlpha = 1;
    paintMoon(ctx, g.W * 0.84, g.H * 0.14, g.U * 5.4);
    return c;
  }

  function paintMoon(ctx, x, y, r) {
    const c = layer(r * 2 + 2, r * 2 + 2);
    const m = c.getContext('2d');
    m.fillStyle = '#f6edd6';
    m.beginPath();
    m.arc(r + 1, r + 1, r, 0, TAU);
    m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath();
    m.arc(r + 1 + r * 0.55, r + 1 - r * 0.28, r * 0.92, 0, TAU);
    m.fill();
    ctx.drawImage(c, x - r - 1, y - r - 1);
  }

  function paintClouds(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e6d3cf';
    const sample = (x, y) => fbm(x * 0.05, y * 0.34, 3, 41);
    for (let y = 0; y < h; y++) {
      const edge = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(sample(x, y), sample(x - w, y), x / w) * edge;
        const tone = Math.round(smoothstep(0.34, 0.62, v) * 4) / 4;
        if (tone <= 0) continue;
        ctx.globalAlpha = tone * 0.38;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function ridge(ctx, g, y, amp, freq, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (y - fbm(x * freq, 3, 4, seed) * amp));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintCedar(ctx, x, base, h, w, rand, leaf, snow) {
    const tiers = 7;
    ctx.fillStyle = leaf;
    ctx.fillRect(x - w * 0.07, base - h * 0.3, w * 0.14, h * 0.3);
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const y = base - h * (0.14 + 0.72 * f);
      const half = w * (1 - f * 0.84) * (0.9 + rand() * 0.18);
      const tall = (h / tiers) * (1.7 - f * 0.4);
      const dip = tall * 0.26;
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.moveTo(x - half, y + dip);
      ctx.quadraticCurveTo(x - half * 0.3, y - tall * 0.3, x, y - tall);
      ctx.quadraticCurveTo(x + half * 0.3, y - tall * 0.3, x + half, y + dip);
      ctx.quadraticCurveTo(x, y + dip * 2.2, x - half, y + dip);
      ctx.fill();
      ctx.fillStyle = snow;
      ctx.beginPath();
      ctx.moveTo(x - half * 0.94, y + dip * 0.6);
      ctx.quadraticCurveTo(x - half * 0.3, y - tall * 0.3, x, y - tall);
      ctx.quadraticCurveTo(x + half * 0.3, y - tall * 0.3, x + half * 0.94, y + dip * 0.6);
      ctx.quadraticCurveTo(x + half * 0.42, y - tall * 0.08, x + half * 0.2, y + dip * 0.2);
      ctx.quadraticCurveTo(x - half * 0.1, y - tall * 0.2, x - half * 0.36, y + dip * 0.1);
      ctx.quadraticCurveTo(x - half * 0.6, y - tall * 0.08, x - half * 0.94, y + dip * 0.6);
      ctx.fill();
    }
    return { x, y: base - h * 0.86 - (h / tiers) * 1.3 };
  }

  // Cedars stand either side of the belfry, as many as the width allows.
  function paintWoods(ctx, g, rand) {
    const u = g.U;
    const clear = u * 46;
    const tops = [];
    const row = (base, tall, wide, step, leaf, snow, keep) => {
      for (let x = -step * 0.3; x < g.W + step; x += step * (0.8 + rand() * 0.4)) {
        const gap = Math.abs(x - state.cx);
        if (gap < clear * (keep ? 1 : 0.8)) continue;
        const near = smoothstep(clear, clear + u * 34, gap);
        const h = tall * (0.82 + near * 0.3 + rand() * 0.14);
        const top = paintCedar(ctx, x, base, h, wide * (0.85 + rand() * 0.3), rand, leaf, snow);
        if (keep) tops.push(top);
      }
    };
    row(g.H * 0.8, u * 40, u * 8, u * 10, '#607599', '#bccae0', false);
    row(g.H * 0.87, u * 52, u * 11, u * 13, '#335070', '#dbe5f2', true);
    return tops;
  }

  function paintGround(ctx, g, rand) {
    const top = g.H * 0.85;
    const land = ctx.createLinearGradient(0, top, 0, g.H);
    land.addColorStop(0, '#ccd6e8');
    land.addColorStop(1, '#aebcd8');
    ctx.fillStyle = land;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, top - fbm(x * 0.02, 7, 3, 6) * g.U * 3);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = '#7f90b8';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(state.cx + g.U * 7, g.H * 0.905, g.U * 56, g.U * 4.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    paintStones(ctx, g, rand);
  }

  function paintStones(ctx, g, rand) {
    const u = g.U;
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const x = state.cx + (rand() - 0.5) * u * 2 - f * u * 6;
      const y = g.H * (0.935 + f * 0.052);
      const w = u * (5 + f * 4);
      ctx.fillStyle = '#5d6786';
      ctx.beginPath();
      ctx.ellipse(x, y, w, u * (1 + f * 0.6), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = SNOW;
      ctx.beginPath();
      ctx.ellipse(x - w * 0.15, y - u * 0.3, w * 0.6, u * (0.45 + f * 0.3), 0, 0, TAU);
      ctx.fill();
    }
  }

  /* ---------- belfry ---------- */

  function paintPost(ctx, u, x0, x1, y0, y1, w0, w1, tone, lit) {
    const cx = state.cx;
    ctx.fillStyle = tone;
    poly(ctx, [cx + x0 * u - w0 * u, y0 * u, cx + x0 * u + w0 * u, y0 * u, cx + x1 * u + w1 * u, y1 * u, cx + x1 * u - w1 * u, y1 * u]);
    ctx.fillStyle = lit;
    poly(ctx, [cx + x0 * u - w0 * u, y0 * u, cx + x0 * u - w0 * 0.2 * u, y0 * u, cx + x1 * u - w1 * 0.2 * u, y1 * u, cx + x1 * u - w1 * u, y1 * u]);
  }

  function paintFrame(ctx, g) {
    const u = g.U;
    const cx = state.cx;
    for (const s of [-1, 1]) paintPost(ctx, u, s * 23, s * 25, 34, 82, 1.2, 1.5, '#5a586e', '#6f6c80');
    ctx.fillStyle = '#5a586e';
    ctx.fillRect(cx - u * 25, u * 72, u * 50, u * 1.6);
    ctx.fillStyle = SNOW;
    ctx.fillRect(cx - u * 25, u * 71.4, u * 50, u * 0.8);
    for (const s of [-1, 1]) {
      paintPost(ctx, u, s * 33, s * 38, 33, 84.5, 1.9, 2.5, '#6e523e', '#a6825f');
      ctx.fillStyle = '#6e523e';
      poly(ctx, [cx + s * u * 31, u * 46, cx + s * u * 31, u * 36, cx + s * u * 21, u * 36]);
      ctx.fillStyle = '#54403a';
      ctx.fillRect(cx + s * u * 33 - u * 3.8, u * 33, u * 7.6, u * 3);
    }
    ctx.fillStyle = '#7a5e48';
    ctx.fillRect(cx - u * 42, u * 32, u * 84, u * 3.4);
    ctx.fillStyle = '#b08d68';
    ctx.fillRect(cx - u * 42, u * 32, u * 84, u * 0.9);
    ctx.fillStyle = '#2e2728';
    ctx.fillRect(cx - u * 3.4, u * 35.2, u * 6.8, u * 1.5);
    paintPlinth(ctx, g);
  }

  function paintPlinth(ctx, g) {
    const u = g.U;
    const cx = state.cx;
    ctx.fillStyle = '#7c84a2';
    ctx.fillRect(cx - u * 45, u * 84.5, u * 90, u * 4.5);
    ctx.fillStyle = '#939ab4';
    ctx.fillRect(cx - u * 16, u * 89, u * 32, u * 2);
    ctx.fillStyle = '#5a6280';
    for (let i = 0; i <= 8; i++) ctx.fillRect(cx - u * 45 + i * u * 11.25, u * 85.5, Math.max(1, u * 0.45), u * 3.5);
    ctx.fillRect(cx - u * 45, u * 88.6, u * 90, Math.max(1, u * 0.5));
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(cx - u * 46, u * 86);
    ctx.quadraticCurveTo(cx - u * 46, u * 84, cx - u * 41, u * 84);
    ctx.lineTo(cx + u * 41, u * 84);
    ctx.quadraticCurveTo(cx + u * 46, u * 84, cx + u * 46, u * 86);
    ctx.quadraticCurveTo(cx, u * 85.6, cx - u * 46, u * 86);
    ctx.fill();
    ctx.fillStyle = '#c3cfe3';
    ctx.fillRect(cx - u * 16, u * 88.6, u * 32, Math.max(1, u * 0.6));
  }

  function roofEdge(ctx, u, cx, s, lift) {
    ctx.quadraticCurveTo(cx + s * u * 33, u * (21 - lift), cx + s * u * 22, u * (9.5 - lift));
  }

  function paintRoof(ctx, g) {
    const u = g.U;
    const cx = state.cx;
    ctx.fillStyle = '#272b40';
    ctx.fillRect(cx - u * 46, u * 28, u * 92, u * 4);
    ctx.fillStyle = '#6d6a72';
    for (let x = -44; x <= 44; x += 3) ctx.fillRect(cx + x * u, u * 29.6, Math.max(1, u * 0.9), u * 1.4);
    ctx.fillStyle = '#34384f';
    ctx.beginPath();
    ctx.moveTo(cx - u * 52, u * 26.5);
    roofEdge(ctx, u, cx, -1, 0);
    ctx.lineTo(cx + u * 22, u * 9.5);
    ctx.quadraticCurveTo(cx + u * 33, u * 21, cx + u * 52, u * 26.5);
    ctx.quadraticCurveTo(cx + u * 44, u * 29, cx, u * 29);
    ctx.quadraticCurveTo(cx - u * 44, u * 29, cx - u * 52, u * 26.5);
    ctx.fill();
    paintRoofSnow(ctx, g);
  }

  function paintRoofSnow(ctx, g) {
    const u = g.U;
    const cx = state.cx;
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(cx - u * 50, u * 25.6);
      roofEdge(ctx, u, cx, -1, 2);
      ctx.quadraticCurveTo(cx, u * 6.4, cx + u * 22, u * 7.5);
      ctx.quadraticCurveTo(cx + u * 33, u * 19, cx + u * 50, u * 25.6);
      for (let x = 47; x >= -47; x -= 5.2) {
        const drop = 27.2 + Math.sin(x * 1.7) * 0.7 - Math.abs(x) * 0.016;
        ctx.quadraticCurveTo(cx + (x - 1.5) * u, u * (drop + 1.3), cx + (x - 3) * u, u * (drop - 0.4));
      }
      ctx.closePath();
    };
    const fall = ctx.createLinearGradient(0, u * 6, 0, u * 28);
    fall.addColorStop(0, '#e6edf6');
    fall.addColorStop(1, '#b9c7df');
    ctx.fillStyle = fall;
    shape();
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    ctx.fillStyle = '#8c9cc0';
    for (const s of [-1, 1]) {
      ctx.globalAlpha = s < 0 ? 0.22 : 0.5;
      poly(ctx, [cx + s * u * 22, u * 6, cx + s * u * 60, u * 6, cx + s * u * 60, u * 30, cx + s * u * 38, u * 30]);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = '#34384f';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * u * 22.6, u * 7.6, u * 1.7, u * 2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f0f4fa';
    ctx.beginPath();
    ctx.ellipse(cx, u * 7.2, u * 22, u * 1.5, 0, 0, TAU);
    ctx.fill();
  }

  /* ---------- bell and striker ---------- */

  function bellPath(ctx, x, b) {
    ctx.beginPath();
    ctx.moveTo(x - b * 3.4, b * 3);
    ctx.quadraticCurveTo(x - b * 9.6, b * 3.2, x - b * 10.3, b * 7.6);
    ctx.lineTo(x - b * 11.2, b * 27);
    ctx.quadraticCurveTo(x - b * 11.5, b * 32, x - b * 12.8, b * 36);
    ctx.quadraticCurveTo(x, b * 37.4, x + b * 12.8, b * 36);
    ctx.quadraticCurveTo(x + b * 11.5, b * 32, x + b * 11.2, b * 27);
    ctx.lineTo(x + b * 10.3, b * 7.6);
    ctx.quadraticCurveTo(x + b * 9.6, b * 3.2, x + b * 3.4, b * 3);
    ctx.closePath();
  }

  function paintBellMarks(ctx, x, b, rand) {
    ctx.fillStyle = '#74ab94';
    for (let i = 0; i < 30; i++) {
      ctx.globalAlpha = 0.22 + rand() * 0.34;
      ctx.fillRect(x + (rand() - 0.5) * b * 23, b * (3 + rand() * 24), Math.max(1, b * 0.8), b * (2 + rand() * 7));
    }
    ctx.globalAlpha = 1;
    const band = (y, h) => {
      ctx.fillStyle = '#3a2f2c';
      ctx.fillRect(x - b * 14, b * (y + h), b * 28, Math.max(1, b * 0.45));
      ctx.fillStyle = '#f0d48e';
      ctx.fillRect(x - b * 14, b * y, b * 28, Math.max(1, b * h));
    };
    ctx.globalAlpha = 0.85;
    band(8, 0.8);
    band(17.4, 0.8);
    band(27.2, 1.1);
    band(33.6, 0.7);
    for (const f of [-0.52, 0, 0.52]) {
      ctx.fillStyle = '#e4c67f';
      ctx.fillRect(x + f * b * 21 - b * 0.35, b * 8.8, Math.max(1, b * 0.7), b * 18.4);
    }
    ctx.globalAlpha = 1;
    paintBosses(ctx, x, b);
  }

  function paintBosses(ctx, x, b) {
    const size = Math.max(1, b * 0.85);
    ctx.fillStyle = '#f4dc9a';
    for (const f of [-0.76, -0.26, 0.26, 0.76]) {
      for (let row = 0; row < 3; row++) {
        for (let col = -1; col <= 1; col++) {
          ctx.fillRect(x + f * b * 21 + col * b * 1.9 - size / 2, b * (10 + row * 2.5), size, size);
        }
      }
    }
    ctx.strokeStyle = '#f4dc9a';
    ctx.lineWidth = Math.max(1, b * 0.55);
    ctx.beginPath();
    ctx.arc(x, b * 22.8, b * 3, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#e8c97f';
    ctx.beginPath();
    ctx.arc(x, b * 22.8, b * 1.3, 0, TAU);
    ctx.fill();
  }

  function paintCrown(ctx, x, b) {
    ctx.strokeStyle = '#a58a54';
    ctx.lineWidth = Math.max(1.4, b * 1.1);
    ctx.beginPath();
    ctx.arc(x, b * 1.5, b * 2.1, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#b4955a';
    ctx.beginPath();
    ctx.ellipse(x, b * 3.1, b * 4, b * 1, 0, 0, TAU);
    ctx.fill();
  }

  function paintBell(g, rand) {
    const b = g.U * BELL_UNIT;
    const pad = g.U * 3;
    const c = layer(b * 30, b * 38 + pad * 2);
    const ctx = c.getContext('2d');
    const x = c.width / 2;
    ctx.translate(0, pad);
    paintCrown(ctx, x, b);
    const metal = ctx.createLinearGradient(x - b * 13, 0, x + b * 13, 0);
    metal.addColorStop(0, '#8a7346');
    metal.addColorStop(0.22, '#d2ab64');
    metal.addColorStop(0.52, '#97773f');
    metal.addColorStop(0.86, '#5a4838');
    metal.addColorStop(1, '#7a8688');
    ctx.fillStyle = metal;
    bellPath(ctx, x, b);
    ctx.fill();
    ctx.save();
    bellPath(ctx, x, b);
    ctx.clip();
    paintBellMarks(ctx, x, b, rand);
    ctx.restore();
    return { canvas: c, pivotX: x, pad };
  }

  function paintLog(g) {
    const u = g.U;
    const c = layer(u * 19, u * 5);
    const ctx = c.getContext('2d');
    const h = u * 3.6;
    const y = u * 0.7;
    const bark = ctx.createLinearGradient(0, y, 0, y + h);
    bark.addColorStop(0, '#c9a678');
    bark.addColorStop(0.5, '#8d6d4e');
    bark.addColorStop(1, '#594539');
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.roundRect(0, y, c.width, h, u * 1.3);
    ctx.fill();
    ctx.fillStyle = '#d1b78a';
    ctx.fillRect(0, y + u * 0.5, Math.max(1, u * 0.8), h - u);
    ctx.fillStyle = '#403436';
    for (const f of [0.12, 0.88]) ctx.fillRect(c.width * f, y, Math.max(1, u * 0.7), h);
    return c;
  }

  /* ---------- foreground ---------- */

  function paintGlow(radius, colour) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, gr, b] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${gr},${b},0.75)`);
    grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function paintLantern(ctx, g, x, y) {
    const u = g.U;
    const stone = '#7f88a6';
    ctx.fillStyle = '#d6a65c';
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.ellipse(x, y - u * 0.4, u * 11, u * 2.2, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = stone;
    ctx.fillRect(x - u * 4.4, y - u * 2.4, u * 8.8, u * 2.4);
    ctx.fillStyle = '#69718f';
    ctx.fillRect(x - u * 1.8, y - u * 13, u * 3.6, u * 11);
    ctx.fillStyle = stone;
    ctx.fillRect(x - u * 4.8, y - u * 15, u * 9.6, u * 2.2);
    ctx.fillStyle = '#eec477';
    ctx.fillRect(x - u * 3.2, y - u * 20.6, u * 6.4, u * 5.6);
    ctx.fillStyle = '#464e6c';
    for (const f of [-3.6, -0.5, 2.8]) ctx.fillRect(x + f * u, y - u * 20.6, u * 0.9, u * 5.6);
    ctx.fillStyle = '#5f6785';
    poly(ctx, [x - u * 8.4, y - u * 20.2, x + u * 8.4, y - u * 20.2, x + u * 2, y - u * 25.4, x - u * 2, y - u * 25.4]);
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(x - u * 8.8, y - u * 20.8);
    ctx.quadraticCurveTo(x - u * 4, y - u * 28, x, y - u * 28.4);
    ctx.quadraticCurveTo(x + u * 4, y - u * 28, x + u * 8.8, y - u * 20.8);
    ctx.quadraticCurveTo(x, y - u * 23.4, x - u * 8.8, y - u * 20.8);
    ctx.fill();
    state.flame = { x, y: y - u * 17.8 };
  }

  function paintShrub(ctx, g, rand, x, y) {
    const u = g.U;
    ctx.fillStyle = '#8fa0c2';
    ctx.beginPath();
    ctx.ellipse(x + u * 2, y + u * 1.2, u * 19, u * 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#44656a';
    ctx.beginPath();
    ctx.ellipse(x, y, u * 15, u * 10, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#5f8680';
    for (let i = 0; i < 60; i++) ctx.fillRect(x + (rand() - 0.5) * u * 26, y - rand() * u * 6, Math.max(1, u * 1.2), Math.max(1, u * 0.6));
    ctx.fillStyle = '#f2f6fb';
    ctx.beginPath();
    ctx.moveTo(x - u * 14, y - u * 4);
    ctx.quadraticCurveTo(x - u * 9, y - u * 12, x, y - u * 11.4);
    ctx.quadraticCurveTo(x + u * 10, y - u * 12, x + u * 14.6, y - u * 3);
    ctx.quadraticCurveTo(x + u * 6, y - u * 7.6, x + u * 2, y - u * 5);
    ctx.quadraticCurveTo(x - u * 4, y - u * 8, x - u * 14, y - u * 4);
    ctx.fill();
    ctx.fillStyle = '#e0553a';
    const size = Math.max(1, u * 1.1);
    for (let i = 0; i < 22; i++) ctx.fillRect(x + (rand() - 0.5) * u * 24, y - u * (0.8 + rand() * 4.4), size, size);
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#dbe4f1';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const open = smoothstep(g.U * 22, g.U * 46, Math.abs(x - state.cx));
      ctx.lineTo(x, g.H - g.U * open * (2 + fbm(x * 0.03, 2, 3, 12) * 8));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    paintLantern(ctx, g, g.W * 0.095, g.H * 0.96);
    paintShrub(ctx, g, rand, g.W * 0.915, g.H * 0.975);
    return c;
  }

  /* ---------- lists prepared once ---------- */

  function makeBirds(g, tops, rand) {
    const birds = new Float32Array(MAX_BIRDS * 9);
    for (let i = 0; i < MAX_BIRDS; i++) {
      const top = tops[Math.floor(rand() * tops.length)];
      const o = i * 9;
      const inward = top.x < state.cx ? 1 : -1;
      birds[o] = top.x + (rand() - 0.5) * g.U * 3;
      birds[o + 1] = top.y + g.U * (rand() * 3);
      birds[o + 2] = inward * (rand() < 0.72 ? 1 : -0.5) * g.U * (26 + rand() * 42);
      birds[o + 3] = g.U * (3 + rand() * 15);
      birds[o + 4] = 0.25 + (Math.abs(top.x - state.cx) / g.W) * 1.4 + rand() * 0.7;
      birds[o + 5] = 12 + rand() * 3.2;
      birds[o + 6] = g.U * (2.3 + rand() * 1.3);
      birds[o + 7] = rand() * TAU;
      birds[o + 8] = (rand() - 0.5) * g.U * 14;
    }
    return birds;
  }

  function makeFlakes(g, rand) {
    const flakes = new Float32Array(MAX_FLAKES * 5);
    for (let i = 0; i < MAX_FLAKES; i++) {
      const o = i * 5;
      const near = i / MAX_FLAKES;
      flakes[o] = rand() * g.W;
      flakes[o + 1] = rand() * g.H;
      flakes[o + 2] = g.U * (1.6 + near * 3.4 + rand());
      flakes[o + 3] = rand() * TAU;
      flakes[o + 4] = g.U * (0.5 + rand() * 1.4);
    }
    return flakes;
  }

  function makeSift(g, rand) {
    const sift = new Float32Array(SIFT * 4);
    for (let i = 0; i < SIFT; i++) {
      const o = i * 4;
      sift[o] = state.cx + (rand() * 2 - 1) * g.U * 49;
      sift[o + 1] = 0.3 + rand() * 1.5;
      sift[o + 2] = g.U * (1.5 + rand() * 3);
      sift[o + 3] = rand() * TAU;
    }
    return sift;
  }

  /* ---------- motion ---------- */

  function logAngle(tau) {
    const settle = 0.17 * Math.exp(-0.5 * tau) * Math.sin(1.7 * tau);
    const pull = PULL_BACK * smoothstep(5.5, CYCLE - RELEASE - 1.6, tau);
    if (tau < CYCLE - RELEASE) return settle + pull;
    return PULL_BACK * Math.cos(((tau - (CYCLE - RELEASE)) / RELEASE) * Math.PI * 0.5);
  }

  function drawRings(ctx, g, tau) {
    ctx.strokeStyle = '#ece3cc';
    for (let i = 0; i < RINGS.length; i++) {
      const age = (tau - RINGS[i]) / RING_LIFE;
      if (age <= 0 || age >= 1) continue;
      const r = g.U * (16 + 100 * (1 - Math.pow(1 - age, 2.4)));
      const fade = Math.pow(1 - age, 1.6) * smoothstep(0, 0.03, age) * (1 - i * 0.12);
      ctx.beginPath();
      ctx.ellipse(state.ringX, state.ringY, r, r * 0.84, 0, 0, TAU);
      ctx.globalAlpha = fade * 0.13;
      ctx.lineWidth = g.U * 2.6;
      ctx.stroke();
      ctx.globalAlpha = fade * 0.42;
      ctx.lineWidth = Math.max(1, g.U * 0.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBell(ctx, g, tau) {
    const bell = state.bell;
    const angle = 0.036 * Math.exp(-tau / 5) * Math.sin((TAU * tau) / 3.4);
    ctx.save();
    ctx.translate(state.cx, g.U * HOOK_Y);
    ctx.rotate(angle);
    ctx.drawImage(bell.canvas, -bell.pivotX, -bell.pad);
    ctx.restore();
  }

  // The bronze holds a little warmth for a few seconds after the stroke.
  function drawHum(ctx, g, tau) {
    const r = g.U * 44;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28 * Math.exp(-tau / 2.6) * smoothstep(0, 0.2, tau);
    ctx.drawImage(state.glow, state.cx - r / 2, g.U * 56 - r / 2, r, r);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawStriker(ctx, g, tau, t) {
    const u = g.U;
    const a = logAngle(tau);
    const dx = Math.sin(a) * ROPE * u;
    const y = u * 35 + Math.cos(a) * ROPE * u;
    const left = state.logX + dx;
    const log = state.log;
    ctx.strokeStyle = '#d5c49c';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(left + log.width * 0.25 - dx, u * 35);
    ctx.lineTo(left + log.width * 0.25, y);
    ctx.moveTo(left + log.width * 0.75 - dx, u * 35);
    ctx.lineTo(left + log.width * 0.75, y);
    const endX = left + log.width;
    ctx.moveTo(endX - u * 0.5, y + u);
    const sway = Math.sin(t * 0.8) * u * 1.2 + a * u * 7;
    ctx.quadraticCurveTo(endX + u * 0.6 + sway * 0.4, y + u * 7, endX - u * 0.4 + sway, y + u * 14);
    ctx.stroke();
    ctx.drawImage(log, left, y - log.height / 2);
  }

  function drawBirds(ctx, g, tau, t, amount) {
    const b = state.birds;
    const count = Math.min(MAX_BIRDS, Math.round(22 * amount));
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = Math.max(1, g.U * 0.75);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const o = i * 9;
      const raw = (tau - b[o + 4]) / b[o + 5];
      if (raw <= 0 || raw >= 1) {
        ctx.fillRect(b[o] - 1, b[o + 1] - 1, Math.max(2, g.U * 1.5), Math.max(1, g.U));
        continue;
      }
      const s = Math.pow(raw, 0.8);
      const arc = Math.sin(s * Math.PI);
      const x = b[o] + b[o + 2] * arc + b[o + 8] * Math.sin(s * TAU);
      const y = lerp(b[o + 1], b[o + 3], Math.pow(arc, 0.7));
      const span = b[o + 6];
      const beat = Math.sin(t * 13 + b[o + 7]) * lerp(0.75, 0.3, smoothstep(0.08, 0.5, raw));
      const tip = y - beat * span * 0.8;
      ctx.moveTo(x - span, tip);
      ctx.quadraticCurveTo(x - span * 0.45, y - span * 0.5 + beat * span * 0.2, x, y);
      ctx.quadraticCurveTo(x + span * 0.45, y - span * 0.5 + beat * span * 0.2, x + span, tip);
    }
    ctx.stroke();
  }

  function drawSift(ctx, g, tau) {
    const s = state.sift;
    ctx.fillStyle = '#eef3fa';
    for (let i = 0; i < SIFT; i++) {
      const o = i * 4;
      const a = tau - s[o + 1];
      if (a <= 0 || a > 7) continue;
      const y = g.U * 28 + s[o + 2] * a + g.U * 0.9 * a * a;
      if (y > g.U * 85) continue;
      ctx.globalAlpha = 0.75 * (1 - a / 7);
      ctx.fillRect(s[o] + Math.sin(a * 1.4 + s[o + 3]) * g.U * 1.4, y, Math.max(1, g.U * 0.7), Math.max(1, g.U * 0.7));
    }
    ctx.globalAlpha = 1;
  }

  // Each flake trembles outward as the first ring passes it.
  function drawSnow(ctx, g, tau, t, amount) {
    const f = state.flakes;
    const count = Math.min(MAX_FLAKES, Math.round(MAX_FLAKES * 0.7 * amount));
    const age = tau / RING_LIFE;
    const front = g.U * (16 + 100 * (1 - Math.pow(1 - Math.min(age, 1), 2.4)));
    const shove = g.U * 3 * Math.max(0, 1 - age * 1.4);
    const width = g.U * 12;
    ctx.fillStyle = '#e9eff8';
    for (let i = 0; i < count; i++) {
      const o = i * 5;
      const near = i / MAX_FLAKES;
      let x = f[o] + Math.sin(t * 0.4 + f[o + 3]) * f[o + 4] * 2 + t * g.U * 0.5;
      x = ((x % g.W) + g.W) % g.W;
      const y = (f[o + 1] + t * f[o + 2]) % g.H;
      const dx = x - state.ringX;
      const dy = y - state.ringY;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const q = (d - front) / width;
      const push = shove * Math.exp(-q * q) / d;
      const size = near > 0.8 ? Math.max(1, g.U * 0.9) : 1;
      ctx.globalAlpha = 0.34 + near * 0.5;
      ctx.fillRect(x + dx * push, y + dy * push, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.cx = g.W * 0.5;
    state.sky = paintSky(g, rand);
    state.clouds = paintClouds(g);
    const mid = layer(g.W, g.H);
    const mctx = mid.getContext('2d');
    ridge(mctx, g, 0.69, 0.22, 0.012, 3, '#bcc7de');
    ridge(mctx, g, 0.76, 0.12, 0.02, 8, '#9dabca');
    const tops = paintWoods(mctx, g, rand);
    paintGround(mctx, g, rand);
    paintFrame(mctx, g);
    paintRoof(mctx, g);
    state.mid = mid;
    state.bell = paintBell(g, rand);
    state.log = paintLog(g);
    state.front = paintFront(g, rand);
    state.glow = paintGlow(g.U * 16, '#e8ac5c');
    state.birds = makeBirds(g, tops, rand);
    state.flakes = makeFlakes(g, rand);
    state.sift = makeSift(g, rand);
    state.logX = state.cx + g.U * 13.4;
    state.ringX = state.cx;
    state.ringY = g.U * 56;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const stroke = Math.floor(t / CYCLE);
    const tau = t - stroke * CYCLE;
    ctx.drawImage(state.sky, 0, 0);
    const cw = state.clouds.width * 2;
    const cx = -((t * g.U * 0.35) % cw);
    for (let x = cx; x < g.W; x += cw) ctx.drawImage(state.clouds, x, g.H * 0.06, cw, state.clouds.height * 2);
    ctx.drawImage(state.mid, 0, 0);
    drawRings(ctx, g, tau);
    drawBell(ctx, g, tau);
    drawHum(ctx, g, tau);
    drawStriker(ctx, g, tau, t);
    drawBirds(ctx, g, tau, t, api.props.birds);
    drawSift(ctx, g, tau);
    ctx.drawImage(state.front, 0, 0);
    const r = state.glow.width * (0.92 + 0.08 * Math.sin(t * 0.7));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.1 * Math.sin(t * 1.1);
    ctx.drawImage(state.glow, state.flame.x - r / 2, state.flame.y - r / 2, r, r);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawSnow(ctx, g, tau, t, api.props.snow);
  }

  Kasuri.run({
    defaults: { snow: 1, birds: 1, ramp: 'lines', cell: 7, boost: 0.14, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
