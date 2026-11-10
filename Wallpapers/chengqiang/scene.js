/*
 * 城墙 City wall — an old brick rampart with a double-roofed gate tower and
 * rows of red lanterns, lit by the clock.
 *
 * Sky, hills, wall, tower and paving are baked into two layers and repainted
 * once a minute. Between repaints only clouds, swallows and the lanterns
 * (a slow sway and a soft glow) move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const HORIZON = 0.6;
  const WALL_TOP = 0.64;
  const GROUND = 0.9;
  const CX = 0.5;
  const RETINT_SECONDS = 60;
  const BIRDS = 7;
  const LANTERN_ROW = 0.655;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour under the current light: warmed by the sky, then darkened at night.
  function tone(base, sky, amount) {
    const c = mixColor(rgb(base), sky.amb, amount === undefined ? 0.2 : amount);
    return hex(mixColor(c, rgb('#0e1022'), sky.night * 0.6));
  }

  // 0 in daylight, 1 once the lanterns are fully lit.
  function litAmount(h) {
    if (h < 12) return 1 - smoothstep(5.5, 7.5, h);
    return smoothstep(16.2, 18.6, h);
  }

  // ---- sky and hills -----------------------------------------------------

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
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
      const mt = S.moonT(sky.hour);
      const mx = g.W * lerp(0.12, 0.88, mt);
      const my = g.H * (0.34 - Math.sin(mt * Math.PI) * 0.22);
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 9);
      halo.addColorStop(0, `rgba(236,230,205,${0.35 * sky.night})`);
      halo.addColorStop(1, 'rgba(236,230,205,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(mx - g.U * 9, my - g.U * 9, g.U * 18, g.U * 18);
      ctx.globalAlpha = sky.night;
      ctx.fillStyle = '#ece6cd';
      ctx.beginPath();
      ctx.arc(mx, my, g.U * 2, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.09, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintHills(ctx, g, sky) {
    const far = hex(mixColor(mixColor(rgb('#6e7898'), sky.haze, 0.55), rgb('#10122a'), sky.night * 0.5));
    const near = hex(mixColor(mixColor(rgb('#4c5b6e'), sky.haze, 0.4), rgb('#0e1226'), sky.night * 0.6));
    const layers = [{ col: far, base: 0.5, amp: 0.1, seed: 3, f: 0.011 }, { col: near, base: 0.56, amp: 0.06, seed: 8, f: 0.02 }];
    for (const l of layers) {
      ctx.fillStyle = l.col;
      ctx.beginPath();
      ctx.moveTo(0, g.H * HORIZON + 2);
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, g.H * (l.base - (fbm(x * l.f, 1, 4, l.seed) - 0.3) * l.amp));
      ctx.lineTo(g.W, g.H * HORIZON + 2);
      ctx.fill();
    }
    paintPagoda(ctx, g, sky);
  }

  // A thin seven-tier pagoda standing on the far hill.
  function paintPagoda(ctx, g, sky) {
    const px = g.W * 0.15;
    const base = g.H * 0.545;
    const u = g.U;
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#3d4660'), sky.haze, 0.35), rgb('#0e1226'), sky.night * 0.55));
    for (let i = 0; i < 7; i++) {
      const w = u * (2.7 - i * 0.28);
      const y = base - u * 2.2 * (i + 1);
      ctx.fillRect(px - w * 0.5, y, w, u * 1.9);
      ctx.beginPath();
      ctx.moveTo(px - w * 0.5 - u * 0.9, y + u * 0.2);
      ctx.lineTo(px - w * 0.3, y - u * 0.5);
      ctx.lineTo(px + w * 0.3, y - u * 0.5);
      ctx.lineTo(px + w * 0.5 + u * 0.9, y + u * 0.2);
      ctx.fill();
    }
    ctx.fillRect(px - 0.5, base - u * 17.5, 1, u * 2.4);
  }

  // Old pines with flat pads of needles, standing behind the rampart.
  function paintPine(ctx, g, sky, fx, top, lean) {
    const x0 = g.W * fx;
    const u = g.U;
    const trunk = tone('#3a3030', sky, 0.15);
    const leaf = tone('#5f7448', sky, 0.15);
    ctx.strokeStyle = trunk;
    ctx.lineWidth = Math.max(2, u * 1.6);
    ctx.beginPath();
    ctx.moveTo(x0, g.H * WALL_TOP);
    ctx.quadraticCurveTo(x0 + lean * u * 3, g.H * (top + 0.14), x0 + lean * u, g.H * (top + 0.04));
    ctx.stroke();
    ctx.fillStyle = leaf;
    const pads = [[0, 0, 7, 1.6], [-5 * lean, 3.5, 6, 1.4], [4 * lean, 6.5, 5.5, 1.4], [-2 * lean, 9.5, 4.5, 1.2]];
    for (const p of pads) {
      ctx.beginPath();
      ctx.ellipse(x0 + lean * u + p[0] * u, g.H * top + p[1] * u * 1.3, p[2] * u, p[3] * u, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // ---- brick wall --------------------------------------------------------

  function paintBricks(ctx, g, sky, rand, x0, y0, x1, y1, base) {
    const bh = Math.max(2, g.U * 1.5);
    const bw = bh * 2.3;
    ctx.fillStyle = tone(base, sky, 0.2);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const joint = tone('#444a5a', sky, 0.15);
    let row = 0;
    for (let y = y0; y < y1; y += bh, row++) {
      const shift = (row % 2) * bw * 0.5;
      for (let x = x0 - shift; x < x1; x += bw) {
        const a = rand();
        if (a > 0.55) {
          ctx.globalAlpha = (a - 0.55) * 0.5;
          ctx.fillStyle = a > 0.8 ? '#e8e0cc' : '#20253a';
          ctx.fillRect(Math.max(x0, x), y, Math.min(bw, x1 - x), bh);
        }
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = joint;
        ctx.fillRect(Math.max(x0, x), y, 1, bh);
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = joint;
      ctx.fillRect(x0, y, x1 - x0, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintRampart(ctx, g, sky, rand) {
    const top = g.H * WALL_TOP;
    const bottom = g.H * GROUND;
    paintBricks(ctx, g, sky, rand, 0, top, g.W, bottom, '#7a7f8a');
    // Capstone course, then merlons with a small slit each.
    ctx.fillStyle = tone('#9a9a98', sky, 0.25);
    ctx.fillRect(0, top - g.U * 0.6, g.W, g.U * 1.2);
    const step = g.W * 0.024;
    const mh = g.H * 0.04;
    for (let x = step * 0.4; x < g.W; x += step) {
      paintBricks(ctx, g, sky, rand, x, top - mh, x + step * 0.62, top - g.U * 0.6, '#7a7f8a');
      ctx.fillStyle = tone('#2a2c3a', sky, 0.1);
      ctx.fillRect(x + step * 0.28, top - mh * 0.72, Math.max(1, step * 0.06), mh * 0.4);
    }
    // Damp stain along the foot of the wall.
    ctx.fillStyle = tone('#4a5440', sky, 0.1);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, bottom - g.U * 1.2, g.W, g.U * 1.2);
    ctx.globalAlpha = 1;
  }

  // ---- gate tower --------------------------------------------------------

  function tileRoof(ctx, g, sky, cx, yBase, halfW, h, lift, topK) {
    const tile = tone('#3a4560', sky, 0.15);
    const ridgeW = halfW * topK;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - halfW, yBase - lift);
      ctx.quadraticCurveTo(cx - halfW * 0.82, yBase + lift * 0.3, cx - halfW * 0.55, yBase);
      ctx.lineTo(cx + halfW * 0.55, yBase);
      ctx.quadraticCurveTo(cx + halfW * 0.82, yBase + lift * 0.3, cx + halfW, yBase - lift);
      ctx.quadraticCurveTo(cx + ridgeW + halfW * 0.12, yBase - h * 0.3, cx + ridgeW, yBase - h);
      ctx.lineTo(cx - ridgeW, yBase - h);
      ctx.quadraticCurveTo(cx - ridgeW - halfW * 0.12, yBase - h * 0.3, cx - halfW, yBase - lift);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = tile;
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = hex(mixColor(rgb(tile), rgb('#0e1022'), 0.3));
    const n = Math.max(6, Math.round(halfW / (g.U * 0.9)));
    for (let i = -n; i <= n; i++) ctx.fillRect(cx + (i / n) * halfW, yBase - h, 1, h + lift);
    ctx.fillStyle = hex(mixColor(rgb(tile), sky.amb, 0.35));
    ctx.fillRect(cx - halfW, yBase - Math.max(1, g.U * 0.6), halfW * 2, Math.max(1, g.U * 0.6));
    ctx.restore();
    // Ridge, with a turned-up tail at each end.
    ctx.fillStyle = tone('#2a3048', sky, 0.1);
    ctx.fillRect(cx - ridgeW - g.U * 0.5, yBase - h - g.U * 0.6, ridgeW * 2 + g.U, g.U * 1.2);
    for (const s of [-1, 1]) {
      const ex = cx + s * (ridgeW + g.U * 0.5);
      ctx.fillRect(ex - (s > 0 ? 0 : g.U * 0.9), yBase - h - g.U * 2.2, g.U * 0.9, g.U * 2.2);
    }
  }

  function paintStorey(ctx, g, sky, cx, y0, y1, halfW, lit, bays) {
    const body = tone('#a8382a', sky, 0.2);
    ctx.fillStyle = body;
    ctx.fillRect(cx - halfW, y0, halfW * 2, y1 - y0);
    const wb = halfW * 2 / bays;
    // Lattice windows between the pillars, warm inside once the light is on.
    for (let b = 0; b < bays; b++) {
      const wx = cx - halfW + b * wb + wb * 0.18;
      const ww = wb * 0.64;
      const wy = y0 + (y1 - y0) * 0.2;
      const wh = (y1 - y0) * 0.6;
      ctx.fillStyle = hex(mixColor(rgb('#2a2230'), rgb('#e8a13c'), lit * 0.8));
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = tone('#7a2a22', sky, 0.15);
      for (let k = 1; k < 4; k++) ctx.fillRect(wx, wy + (wh * k) / 4, ww, 1);
      for (let k = 1; k < 3; k++) ctx.fillRect(wx + (ww * k) / 3, wy, 1, wh);
    }
    ctx.fillStyle = tone('#8c2a20', sky, 0.15);
    for (let b = 0; b <= bays; b++) ctx.fillRect(cx - halfW + b * wb - g.U * 0.4, y0, Math.max(1, g.U * 0.8), y1 - y0);
    // Gilt band of brackets under the eaves.
    ctx.fillStyle = tone('#c9a043', sky, 0.1);
    ctx.fillRect(cx - halfW, y0, halfW * 2, Math.max(1, g.U * 0.7));
  }

  function paintGateBase(ctx, g, sky, rand, lit) {
    const cx = g.W * CX;
    const half = g.W * 0.16;
    const top = g.H * 0.53;
    const ground = g.H * GROUND;
    paintBricks(ctx, g, sky, rand, cx - half, top, cx + half, ground, '#868a92');
    ctx.fillStyle = tone('#a2a09a', sky, 0.25);
    ctx.fillRect(cx - half - g.U, top - g.U * 0.8, half * 2 + g.U * 2, g.U * 1.6);
    // Balustrade posts along the platform.
    ctx.fillStyle = tone('#8e8c88', sky, 0.2);
    for (let x = cx - half; x < cx + half; x += g.U * 2.4) ctx.fillRect(x, top - g.U * 3, Math.max(1, g.U * 0.7), g.U * 2.4);
    ctx.fillRect(cx - half, top - g.U * 3.2, half * 2, Math.max(1, g.U * 0.7));
    // Arched passage and the lit court beyond it.
    const aw = g.W * 0.045;
    const ay = g.H * 0.72;
    const grad = ctx.createLinearGradient(0, ay, 0, ground);
    grad.addColorStop(0, hex(mixColor(rgb('#3a3040'), rgb('#f0b25a'), lit * 0.75)));
    grad.addColorStop(1, hex(mixColor(rgb('#4a4650'), rgb('#f6c874'), lit * 0.85)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - aw, ground);
    ctx.lineTo(cx - aw, ay + aw);
    ctx.arc(cx, ay + aw, aw, Math.PI, 0);
    ctx.lineTo(cx + aw, ground);
    ctx.fill();
    ctx.strokeStyle = tone('#9a9892', sky, 0.25);
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    ctx.moveTo(cx - aw - 1, ground);
    ctx.lineTo(cx - aw - 1, ay + aw);
    ctx.arc(cx, ay + aw, aw + 1, Math.PI, 0);
    ctx.lineTo(cx + aw + 1, ground);
    ctx.stroke();
    // A far gate inside the passage.
    ctx.fillStyle = tone('#5a3a36', sky, 0.1);
    ctx.fillRect(cx - aw * 0.45, ay + aw * 1.1, aw * 0.9, ground - ay - aw * 1.1);
  }

  function paintTower(ctx, g, sky, rand, lit) {
    const cx = g.W * CX;
    paintGateBase(ctx, g, sky, rand, lit);
    paintStorey(ctx, g, sky, cx, g.H * 0.425, g.H * 0.527, g.W * 0.105, lit, 5);
    tileRoof(ctx, g, sky, cx, g.H * 0.425, g.W * 0.175, g.H * 0.055, g.H * 0.02, 0.62);
    paintStorey(ctx, g, sky, cx, g.H * 0.31, g.H * 0.372, g.W * 0.07, lit, 3);
    tileRoof(ctx, g, sky, cx, g.H * 0.31, g.W * 0.135, g.H * 0.105, g.H * 0.024, 0.3);
    ctx.fillStyle = tone('#c9a043', sky, 0.1);
    ctx.fillRect(cx - 0.5, g.H * 0.185, 1, g.H * 0.02);
    ctx.beginPath();
    ctx.arc(cx, g.H * 0.185, Math.max(1, g.U * 0.7), 0, 6.3);
    ctx.fill();
  }

  // ---- ground ------------------------------------------------------------

  function paintGround(ctx, g, sky, rand, lit) {
    const top = g.H * GROUND;
    ctx.fillStyle = tone('#5c6068', sky, 0.15);
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = tone('#2e3240', sky, 0.1);
    let y = top + g.U * 1.2;
    let gap = g.U * 1.3;
    while (y < g.H) {
      ctx.fillRect(0, y, g.W, 1);
      const w = gap * 3.2;
      const off = rand() * w;
      for (let x = -off; x < g.W; x += w) ctx.fillRect(x, y, 1, gap);
      y += gap;
      gap *= 1.28;
    }
    if (lit > 0.02) {
      const spill = ctx.createRadialGradient(g.W * CX, top, 0, g.W * CX, top, g.W * 0.3);
      spill.addColorStop(0, `rgba(246,190,100,${0.5 * lit})`);
      spill.addColorStop(1, 'rgba(246,190,100,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(0, top, g.W, g.H - top);
    }
  }

  // ---- lanterns ----------------------------------------------------------

  // Each lantern hangs from (fx, fy) in screen fractions, on a short cord.
  function lanternSpots() {
    const spots = [];
    for (let i = 0; i < 6; i++) {
      spots.push({ x: 0.035 + i * 0.054, y: LANTERN_ROW, cord: 0.01 });
      spots.push({ x: 0.965 - i * 0.054, y: LANTERN_ROW, cord: 0.01 });
    }
    for (let i = 0; i < 5; i++) {
      const fx = 0.5 + (i - 2) * 0.062;
      spots.push({ x: fx, y: 0.446 - Math.abs(i - 2) * 0.0, cord: 0.01 });
    }
    for (const s of [-1, 1]) {
      spots.push({ x: 0.5 + s * 0.185, y: 0.415, cord: 0.01 });
      spots.push({ x: 0.5 + s * 0.14, y: 0.325, cord: 0.008 });
      spots.push({ x: 0.5 + s * 0.09, y: 0.545, cord: 0.012 });
    }
    return spots;
  }

  function paintLanternSprite(g, lit) {
    const w = Math.max(4, Math.round(g.U * 3.4));
    const h = Math.max(5, Math.round(g.U * 4.2));
    const c = layer(w, h + 3);
    const ctx = c.getContext('2d');
    const body = hex(mixColor(rgb('#b83a26'), rgb('#e8663a'), lit));
    ctx.fillStyle = '#c9a043';
    ctx.fillRect(w * 0.3, 0, w * 0.4, Math.max(1, h * 0.13));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.52, w * 0.5, h * 0.4, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb(body), rgb('#f6c874'), 0.35 + lit * 0.4));
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.52, w * 0.2, h * 0.34, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#c9a043';
    ctx.fillRect(w * 0.3, h * 0.88, w * 0.4, Math.max(1, h * 0.1));
    ctx.fillStyle = '#a8382a';
    ctx.fillRect(w / 2, h, 1, 3);
    return c;
  }

  function paintGlowSprite() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,176,90,0.85)');
    grad.addColorStop(0.4, 'rgba(240,120,60,0.34)');
    grad.addColorStop(1, 'rgba(240,120,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const hour = S.hour(choice);
    const sky = S.at(hour);
    const rand = K.rng(41);
    const lit = litAmount(hour);
    state.sky = paintSky(g, sky, rand);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHills(ctx, g, sky);
    paintPine(ctx, g, sky, 0.045, 0.44, 1);
    paintPine(ctx, g, sky, 0.93, 0.47, -1);
    paintRampart(ctx, g, sky, rand);
    paintTower(ctx, g, sky, rand, lit);
    paintGround(ctx, g, sky, rand, lit);
    state.front = c;
    state.lantern = paintLanternSprite(g, lit);
    state.lit = lit;
    state.cloudTint = hex(mixColor(rgb('#ffffff'), sky.amb, 0.6));
    state.cloudAlpha = 0.55 - sky.night * 0.38;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 2.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, g, t) {
    ctx.fillStyle = '#20243a';
    for (let i = 0; i < BIRDS; i++) {
      const b = state.birds[i];
      const p = (t * b.v + b.p) % 1;
      const bx = g.W * (1.05 - p * 1.1);
      const by = g.H * b.y + Math.sin(t * 0.8 + i * 2) * g.U * 1.2;
      const flap = Math.sin(t * 6 + i) > 0 ? -1 : 0;
      ctx.fillRect(bx - 2, by + flap, 2, 1);
      ctx.fillRect(bx, by, 1, 1);
      ctx.fillRect(bx + 1, by + flap, 2, 1);
    }
  }

  function drawLanterns(ctx, g, t, glowAmount) {
    const spots = state.spots;
    const sprite = state.lantern;
    const glow = state.glow;
    const lit = state.lit * glowAmount;
    const gs = g.U * 15;
    if (lit > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.82 + Math.sin(t * 0.7) * 0.08;
      ctx.globalAlpha = Math.min(1, lit * pulse);
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const sway = Math.sin(t * 0.9 + s.phase) * 0.1;
        const lx = g.W * s.x + sway * g.H * s.cord * 8;
        const ly = g.H * (s.y + s.cord) + sprite.height * 0.5;
        ctx.drawImage(glow, lx - gs / 2, ly - gs / 2, gs, gs);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#4a3030';
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const sway = Math.sin(t * 0.9 + s.phase) * 0.1;
      const px = g.W * s.x;
      const py = g.H * s.y;
      const cord = g.H * s.cord;
      ctx.fillStyle = '#4a3030';
      ctx.fillRect(px, py, 1, cord);
      ctx.save();
      ctx.translate(px, py + cord);
      ctx.rotate(sway);
      ctx.drawImage(sprite, -sprite.width / 2, 0);
      ctx.restore();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.glow = paintGlowSprite();
    const rand = K.rng(9);
    state.spots = lanternSpots().map((s) => Object.assign({ phase: rand() * 6.3 }, s));
    state.birds = [];
    for (let i = 0; i < BIRDS; i++) state.birds.push({ v: 0.012 + rand() * 0.008, p: rand(), y: 0.1 + rand() * 0.2 });
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
    if (props.birds) drawBirds(ctx, g, t);
    drawLanterns(ctx, g, t, props.glow);
  }

  Kasuri.run({
    defaults: { time: 'auto', glow: 1, clouds: 1, birds: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
