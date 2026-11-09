/*
 * ロープウェイ Ropeway — a gondola climbing its cable over a cedar and maple
 * valley toward a torii and shrine on the summit, Fuji faint behind.
 *
 * Sky, hills, forest, cable and shrine are baked into two layers and repainted
 * once a minute from the clock. Between repaints only clouds, mist, two
 * cabins, three kites and a few leaves move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  // Cable runs from the low station A to the summit station B (fractions of the screen).
  const A = { x: 0.1, y: 0.8 };
  const B = { x: 0.79, y: 0.35 };
  const SUMMIT_Y = 0.36;
  const PYLONS = [0.3, 0.64];
  const CYCLE = 80;
  const LEAVES = 14;
  const KITES = 3;
  const NIGHT_INK = parseColor('#0a0e1e');
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Tint a colour toward the sky haze with distance, and toward ink at night.
  function shade(sky, color, haze) {
    const hazed = mixColor(parseColor(color), sky.haze, haze || 0);
    return toHex(mixColor(hazed, NIGHT_INK, sky.night * 0.62));
  }

  function lineX(g, s) { return g.W * lerp(A.x, B.x, s); }
  function lineY(g, s) { return g.H * lerp(A.y, B.y, s); }

  // Height of the forested slope under the cable (a valley sagging between two high points).
  function ridge(g, fx) {
    const n = (fbm(fx * 9, 3, 3, 8) - 0.5) * 0.03;
    if (fx <= A.x) return g.H * (A.y + 0.03 + (A.x - fx) * 0.25);
    if (fx <= B.x) {
      const s = (fx - A.x) / (B.x - A.x);
      const dip = 0.035 + 0.16 * Math.pow(Math.sin(Math.PI * s), 0.85);
      return g.H * (lerp(A.y, B.y, s) + dip + n);
    }
    const shoulder = SUMMIT_Y + 0.012 + (fx - B.x) * 0.05;
    const fall = smoothstep(0.93, 1.06, fx) * 0.22;
    return g.H * (shoulder + fall + n * 0.4);
  }

  // ---- sky and far hills -------------------------------------------------

  function paintBackdrop(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
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
    paintLuminary(ctx, g, sky);
    paintFuji(ctx, g, sky);
    paintFarHills(ctx, g, sky);
    return c;
  }

  function paintLuminary(ctx, g, sky) {
    const h = sky.hour;
    const day = h >= 6 && h <= 19.5;
    const t = day ? S.sunT(h) : S.moonT(h);
    const x = g.W * (0.08 + 0.5 * t);
    const y = g.H * (0.5 - 0.4 * Math.sin(Math.PI * t));
    const r = g.U * (day ? 4.2 : 3.4);
    const low = 1 - Math.pow(Math.sin(Math.PI * t), 0.6);
    const col = day
      ? toHex(mixColor(parseColor('#f6ecd0'), parseColor('#d6452c'), low * 0.85))
      : '#ece8d6';
    const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
    halo.addColorStop(0, col);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
  }

  // Mount Fuji, a pale cone with snow, seen across the valley.
  function paintFuji(ctx, g, sky) {
    const cx = g.W * 0.4;
    const half = g.W * 0.3;
    const base = g.H * 0.74;
    const top = g.H * 0.42;
    const snowLine = g.H * 0.5;
    const edge = (x) => base - (base - top) * Math.pow(Math.max(0, 1 - Math.abs(x - cx) / half), 1.7);
    ctx.fillStyle = shade(sky, '#6a7894', 0.55);
    ctx.beginPath();
    ctx.moveTo(cx - half, base);
    for (let x = cx - half; x <= cx + half; x += g.U) ctx.lineTo(x, edge(x));
    ctx.lineTo(cx + half, base);
    ctx.fill();
    ctx.fillStyle = shade(sky, '#e8e6dc', 0.3);
    const lo = cx - half * 0.3;
    const hi = cx + half * 0.3;
    ctx.beginPath();
    ctx.moveTo(lo, edge(lo));
    for (let x = lo; x <= hi; x += g.U * 0.5) ctx.lineTo(x, edge(x));
    for (let x = hi; x >= lo; x -= g.U * 0.5) {
      const drip = (fbm(x * 0.2, 1, 2, 4) - 0.3) * g.U * 3;
      ctx.lineTo(x, snowLine + drip);
    }
    ctx.fill();
  }

  function paintFarHills(ctx, g, sky) {
    const rows = [
      { y: 0.66, amp: 0.07, col: '#70809a', haze: 0.55, seed: 3, f: 4 },
      { y: 0.72, amp: 0.06, col: '#506280', haze: 0.4, seed: 9, f: 6 },
    ];
    for (const r of rows) {
      ctx.fillStyle = shade(sky, r.col, r.haze);
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += g.U) {
        ctx.lineTo(x, g.H * (r.y - r.amp * fbm(x / g.W * r.f, r.seed, 3, r.seed)));
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
  }

  // ---- forest ------------------------------------------------------------

  function cedar(ctx, x, yb, h, w) {
    ctx.beginPath();
    ctx.moveTo(x, yb - h);
    ctx.lineTo(x + w * 0.32, yb - h * 0.62);
    ctx.lineTo(x + w * 0.18, yb - h * 0.62);
    ctx.lineTo(x + w * 0.42, yb - h * 0.3);
    ctx.lineTo(x + w * 0.26, yb - h * 0.3);
    ctx.lineTo(x + w * 0.5, yb);
    ctx.lineTo(x - w * 0.5, yb);
    ctx.lineTo(x - w * 0.26, yb - h * 0.3);
    ctx.lineTo(x - w * 0.42, yb - h * 0.3);
    ctx.lineTo(x - w * 0.18, yb - h * 0.62);
    ctx.lineTo(x - w * 0.32, yb - h * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  function round(ctx, x, yb, h, w) {
    ctx.beginPath();
    ctx.ellipse(x, yb - h * 0.45, w * 0.5, h * 0.45, 0, 0, 6.3);
    ctx.fill();
  }

  function pickTree(sky, rand, haze) {
    const p = rand();
    if (p < 0.1) return { col: shade(sky, '#b8412c', haze), kind: 1 };
    if (p < 0.16) return { col: shade(sky, '#cf9b3a', haze), kind: 1 };
    if (p < 0.27) return { col: shade(sky, '#5d7a46', haze), kind: 1 };
    if (p < 0.6) return { col: shade(sky, '#2f4c3a', haze), kind: 0 };
    return { col: shade(sky, '#243e30', haze), kind: 0 };
  }

  function paintForest(ctx, g, sky, rand) {
    const U = g.U;
    const step = U * 2.1;
    for (let j = 0; j < 40; j++) {
      for (let x = -U; x < g.W + U; x += U * 1.6) {
        const fx = x / g.W;
        const yb = ridge(g, fx) + j * step * (0.85 + rand() * 0.3) + U * 2;
        if (yb > g.H + U * 6) continue;
        const depth = Math.min(1, j / 14);
        const tree = pickTree(sky, rand, 0.32 * (1 - depth));
        const h = U * (4 + depth * 4 + rand() * 2);
        const w = h * (tree.kind ? 0.8 : 0.5);
        ctx.fillStyle = tree.col;
        if (tree.kind) round(ctx, x + (rand() - 0.5) * U, yb, h, w);
        else cedar(ctx, x + (rand() - 0.5) * U, yb, h, w);
      }
    }
  }

  // ---- cable, stations, shrine -------------------------------------------

  function paintCable(ctx, g, sky) {
    const U = g.U;
    ctx.fillStyle = shade(sky, '#2a2e44', 0.1);
    for (const s of PYLONS) {
      const x = lineX(g, s);
      const top = lineY(g, s) - U * 0.5;
      const bottom = ridge(g, lerp(A.x, B.x, s)) + U * 3;
      ctx.beginPath();
      ctx.moveTo(x - U * 1.2, bottom);
      ctx.lineTo(x - U * 0.35, top);
      ctx.lineTo(x + U * 0.35, top);
      ctx.lineTo(x + U * 1.2, bottom);
      ctx.fill();
      ctx.fillRect(x - U * 2, top - U * 0.4, U * 4, Math.max(1, U * 0.8));
    }
    ctx.strokeStyle = shade(sky, '#232738', 0.1);
    ctx.lineWidth = Math.max(1, U * 0.35);
    for (const k of [0, 1.5]) {
      ctx.beginPath();
      ctx.moveTo(lineX(g, 0), lineY(g, 0) + k * U);
      ctx.lineTo(lineX(g, 1), lineY(g, 1) + k * U);
      ctx.stroke();
    }
  }

  // A small hip roof with upturned corners.
  function roof(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.62, y + h * 0.1);
    ctx.lineTo(x - w * 0.5, y);
    ctx.lineTo(x - w * 0.22, y - h);
    ctx.lineTo(x + w * 0.22, y - h);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.62, y + h * 0.1);
    ctx.lineTo(x + w * 0.5, y + h * 0.28);
    ctx.lineTo(x - w * 0.5, y + h * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  function glow(ctx, x, y, r, sky) {
    if (sky.night < 0.15) return;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(230,184,92,0.55)');
    grad.addColorStop(1, 'rgba(230,184,92,0)');
    ctx.globalAlpha = Math.min(1, sky.night * 1.2);
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  function paintStation(ctx, g, sky) {
    const U = g.U;
    const x = lineX(g, 0) - U * 1;
    const base = lineY(g, 0) + U * 4;
    ctx.fillStyle = shade(sky, '#6b4a34', 0.05);
    ctx.fillRect(x - U * 6, base - U * 1.5, U * 12, U * 2.5);
    ctx.fillStyle = shade(sky, '#e8e2d0', 0.1);
    ctx.fillRect(x - U * 5, base - U * 5.5, U * 10, U * 4.2);
    ctx.fillStyle = shade(sky, '#b8412c', 0.1);
    ctx.fillRect(x - U * 5, base - U * 5.5, U * 0.7, U * 4.2);
    ctx.fillRect(x + U * 4.3, base - U * 5.5, U * 0.7, U * 4.2);
    ctx.fillStyle = sky.night > 0.3 ? '#e3b659' : shade(sky, '#475a74', 0.1);
    ctx.fillRect(x - U * 3, base - U * 4.5, U * 6, U * 1.6);
    ctx.fillStyle = shade(sky, '#2d3350', 0.1);
    roof(ctx, x, base - U * 5.5, U * 13, U * 3);
    glow(ctx, x, base - U * 3.7, U * 8, sky);
    ctx.fillStyle = shade(sky, '#2a2e44', 0.1);
    ctx.fillRect(lineX(g, 0) - U * 0.4, lineY(g, 0) - U * 3, Math.max(1, U * 0.8), U * 3);
  }

  function paintTorii(ctx, x, yb, U, sky) {
    ctx.fillStyle = shade(sky, '#c8452c', 0.08);
    const pw = Math.max(1, U * 0.7);
    ctx.fillRect(x - U * 2.6, yb - U * 6.8, pw, U * 6.8);
    ctx.fillRect(x + U * 2.6 - pw, yb - U * 6.8, pw, U * 6.8);
    ctx.fillRect(x - U * 3.1, yb - U * 5.2, U * 6.2, Math.max(1, U * 0.6));
    ctx.fillStyle = shade(sky, '#1e1f2b', 0.05);
    ctx.beginPath();
    ctx.moveTo(x - U * 4.2, yb - U * 7.5);
    ctx.lineTo(x - U * 3, yb - U * 6.6);
    ctx.lineTo(x + U * 3, yb - U * 6.6);
    ctx.lineTo(x + U * 4.2, yb - U * 7.5);
    ctx.lineTo(x + U * 3.4, yb - U * 7.9);
    ctx.lineTo(x - U * 3.4, yb - U * 7.9);
    ctx.closePath();
    ctx.fill();
  }

  function paintLantern(ctx, x, yb, U, sky) {
    ctx.fillStyle = shade(sky, '#8e9096', 0.15);
    ctx.fillRect(x - U * 0.4, yb - U * 2, Math.max(1, U * 0.8), U * 2);
    ctx.fillRect(x - U * 1, yb - U * 3.2, U * 2, U * 1.2);
    ctx.fillRect(x - U * 1.3, yb - U * 3.6, U * 2.6, Math.max(1, U * 0.45));
    if (sky.night > 0.3) {
      ctx.fillStyle = '#e3b659';
      ctx.fillRect(x - U * 0.4, yb - U * 3, Math.max(1, U * 0.8), U * 0.7);
      glow(ctx, x, yb - U * 2.8, U * 5, sky);
    }
  }

  function paintShrine(ctx, g, sky) {
    const U = g.U;
    const gx = (fx) => g.W * fx;
    const ground = (fx) => ridge(g, fx) + U * 0.6;
    ctx.fillStyle = shade(sky, '#243e30', 0.05);
    cedar(ctx, gx(0.835), ground(0.835) + U * 1, U * 14, U * 6);
    cedar(ctx, gx(0.97), ground(0.97) + U * 1, U * 13, U * 5.5);
    cedar(ctx, gx(0.995), ground(0.995) + U * 1, U * 10, U * 4.5);
    const hx = gx(0.915);
    const hb = ground(0.915);
    ctx.fillStyle = shade(sky, '#7b7e86', 0.1);
    ctx.fillRect(hx - U * 6, hb - U * 0.4, U * 12, U * 1.4);
    ctx.fillStyle = shade(sky, '#b8412c', 0.08);
    ctx.fillRect(hx - U * 4, hb - U * 4.6, U * 8, U * 4.4);
    ctx.fillStyle = shade(sky, '#e8e2d0', 0.1);
    ctx.fillRect(hx - U * 2.6, hb - U * 4.2, U * 5.2, U * 3.6);
    ctx.fillStyle = sky.night > 0.3 ? '#e3b659' : shade(sky, '#2d3350', 0.1);
    ctx.fillRect(hx - U * 0.8, hb - U * 3.8, U * 1.6, U * 3.2);
    ctx.fillStyle = shade(sky, '#2d3350', 0.05);
    roof(ctx, hx, hb - U * 4.6, U * 11, U * 4);
    ctx.fillRect(hx - U * 0.2, hb - U * 9.2, U * 0.4, U * 1.2);
    glow(ctx, hx, hb - U * 2.4, U * 8, sky);
    paintTorii(ctx, gx(0.86), ground(0.86) + U * 0.5, U, sky);
    paintLantern(ctx, gx(0.875), ground(0.875) + U * 0.6, U, sky);
    paintLantern(ctx, gx(0.95), ground(0.95) + U * 0.6, U, sky);
    paintSummitStation(ctx, g, sky);
  }

  function paintSummitStation(ctx, g, sky) {
    const U = g.U;
    const x = lineX(g, 1);
    const y = lineY(g, 1);
    ctx.fillStyle = shade(sky, '#2a2e44', 0.1);
    ctx.fillRect(x - U * 0.4, y - U * 1, Math.max(1, U * 0.8), U * 7);
    ctx.fillStyle = shade(sky, '#e8e2d0', 0.1);
    ctx.fillRect(x - U * 3.5, y + U * 2.8, U * 7, U * 3.4);
    ctx.fillStyle = shade(sky, '#2d3350', 0.1);
    roof(ctx, x, y + U * 2.8, U * 9, U * 2.4);
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintForest(ctx, g, sky, rand);
    paintStation(ctx, g, sky);
    paintShrine(ctx, g, sky);
    paintCable(ctx, g, sky);
    return c;
  }

  function paintSoft(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.014, y * 0.06, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 220;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.back = paintBackdrop(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.night = sky.night;
    state.cloudAlpha = 0.75 - sky.night * 0.5;
    state.mistAlpha = 0.5 - sky.night * 0.3;
    state.cabinLight = sky.night > 0.3;
    state.choice = choice;
    state.retintIn = 60;
  }

  // ---- motion ------------------------------------------------------------

  function drawBand(ctx, g, c, t, speed, y, alpha) {
    const off = -((t * g.U * speed) % c.width);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function drawCabin(ctx, g, s, k, body, stripe) {
    const U = g.U;
    const x = lineX(g, s);
    const y = lineY(g, s) + k * U;
    ctx.fillStyle = '#232738';
    ctx.fillRect(x - U * 0.2, y, Math.max(1, U * 0.4), U * 1.8);
    ctx.fillRect(x - U * 1.2, y + U * 1.5, U * 2.4, Math.max(1, U * 0.5));
    ctx.fillStyle = body;
    ctx.fillRect(x - U * 2.4, y + U * 2, U * 4.8, U * 3.6);
    ctx.fillStyle = stripe;
    ctx.fillRect(x - U * 2.4, y + U * 4.7, U * 4.8, U * 0.9);
    ctx.fillStyle = state.cabinLight ? '#e3b659' : '#aebcc4';
    ctx.fillRect(x - U * 2, y + U * 2.5, U * 1.8, U * 1.7);
    ctx.fillRect(x + U * 0.2, y + U * 2.5, U * 1.8, U * 1.7);
  }

  function drawCabins(ctx, g, t) {
    const p = 0.5 - 0.5 * Math.cos((t / CYCLE) * 6.2832);
    drawCabin(ctx, g, p, 0, '#b8412c', '#e8e2d0');
    drawCabin(ctx, g, 1 - p, 1.5, '#e8e2d0', '#2c3f8c');
  }

  function drawKites(ctx, g, t) {
    const U = g.U;
    ctx.strokeStyle = state.night > 0.5 ? '#9aa0b4' : '#26283a';
    ctx.lineWidth = Math.max(1, U * 0.4);
    ctx.beginPath();
    for (let i = 0; i < KITES; i++) {
      const a = t * 0.1 + i * 2.1;
      const x = g.W * (0.5 + 0.17 * Math.cos(a)) + i * U * 6;
      const y = g.H * (0.2 + 0.05 * Math.sin(a * 1.3 + i)) + i * U * 2;
      const lift = Math.sin(t * 1.4 + i) * U * 0.4;
      ctx.moveTo(x - U * 2.2, y + U * 0.4 - lift);
      ctx.quadraticCurveTo(x - U * 0.8, y - U * 0.9, x, y);
      ctx.quadraticCurveTo(x + U * 0.8, y - U * 0.9, x + U * 2.2, y + U * 0.4 - lift);
    }
    ctx.stroke();
  }

  // Maple leaves drifting down and to the side.
  function drawLeaves(ctx, g, t) {
    const U = g.U;
    for (let i = 0; i < LEAVES; i++) {
      const life = ((t * 0.04 + i / LEAVES) % 1);
      const x = ((i * 0.37 + 0.1) % 1) * g.W + Math.sin(t * 0.8 + i * 2.3) * U * 3 + life * U * 14;
      const y = life * g.H * 0.95;
      ctx.fillStyle = i % 3 ? '#b8412c' : '#cf9b3a';
      ctx.fillRect(x, y, Math.max(1, U * 0.9), Math.max(1, U * 0.7));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintSoft(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.25), 21);
    state.mist = paintSoft(Math.ceil(g.W * 1.6), Math.ceil(g.H * 0.2), 47);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    if (props.clouds > 0) drawBand(ctx, g, state.clouds, t, 3, g.H * 0.03, state.cloudAlpha * props.clouds);
    ctx.drawImage(state.front, 0, 0);
    if (props.clouds > 0) drawBand(ctx, g, state.mist, t, 2.2, g.H * 0.5, state.mistAlpha * props.clouds);
    drawCabins(ctx, g, t);
    drawKites(ctx, g, t);
    if (props.leaves) drawLeaves(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, leaves: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
