/*
 * 桜島 Sakurajima — the volcano of Kagoshima across a calm bay at sunset.
 *
 * Sky, volcano, water and the shore with its black pine and stone lantern are
 * baked into layers and repainted once a minute from the clock. Between
 * repaints only clouds, the ash plume, water glints and the ferry move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.62;
  const PEAKS = [
    { x: 0.47, h: 0.27, w: 0.2 },
    { x: 0.535, h: 0.37, w: 0.18 },
    { x: 0.6, h: 0.34, w: 0.19 },
    { x: 0.675, h: 0.2, w: 0.26 },
  ];
  const CRATER = { x: 0.545, y: 0.25 };
  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 26;
  const GLINTS = 26;
  const state = {};

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ---------------------------------------------------------------

  function sunPlace(g, hour) {
    const t = S.sunT(hour);
    const rise = Math.pow(Math.sin(Math.PI * t), 1.3);
    return { x: g.W * (0.1 + 0.8 * t), y: g.H * (HORIZON - 0.02 - rise * 0.5), up: hour > 5.8 && hour < 19.6 };
  }

  function moonPlace(g, hour) {
    const t = S.moonT(hour);
    return { x: g.W * (0.12 + 0.76 * t), y: g.H * (HORIZON - 0.05 - Math.sin(Math.PI * t) * 0.45) };
  }

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
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.45, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const sun = sunPlace(g, sky.hour);
    if (sun.up) {
      const warm = smoothstep(0.45, 0.2, (HORIZON * g.H - sun.y) / g.H);
      const halo = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, g.U * 30);
      halo.addColorStop(0, `rgba(240,160,100,${0.45 * (0.4 + warm)})`);
      halo.addColorStop(1, 'rgba(240,160,100,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, g.W, g.H * HORIZON);
      ctx.fillStyle = hex(mixColor(rgb('#f4e6c0'), rgb('#d6452c'), warm * 0.85));
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, g.U * 3.6, 0, 6.3);
      ctx.fill();
    }
    if (sky.night > 0.3) {
      const m = moonPlace(g, sky.hour);
      ctx.globalAlpha = sky.night;
      ctx.fillStyle = '#e8e4d0';
      ctx.beginPath();
      ctx.arc(m.x, m.y, g.U * 2.4, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
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
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 240;
        img.data[i + 3] = smoothstep(0.53, 0.72, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff(sky) {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const tone = mixColor(mixColor(rgb('#b4aea4'), sky.amb, 0.4), sky.top, sky.night * 0.55);
    const [r, gg, b] = tone.map(Math.round);
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `rgba(${r},${gg},${b},0.85)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- volcano -----------------------------------------------------------

  function ridge(g, px) {
    const base = g.H * HORIZON;
    let best = 0;
    for (const p of PEAKS) {
      const d = Math.abs(px / g.W - p.x) / p.w;
      if (d < 1) best = Math.max(best, p.h * Math.pow(1 - d, 1.55));
    }
    const rough = (fbm(px * 0.05, 3, 3, 7) - 0.5) * g.U * 1.6 * smoothstep(0.02, 0.2, best);
    return base - best * g.H + rough;
  }

  function slopePixel(g, sky, x, y, top) {
    const base = g.H * HORIZON;
    const f = (y - top) / Math.max(1, base - top);
    const gully = fbm(x * 0.35, y * 0.012, 3, 13);
    const sunX = sunPlace(g, sky.hour).x;
    const day = 1 - sky.night;
    const lit = smoothstep(-g.W * 0.3, g.W * 0.3, sunX - x) * day;
    let c = mixColor(rgb('#2c3558'), rgb('#161c34'), gully > 0.55 ? 0.6 : 0.1);
    c = mixColor(c, rgb('#4d5b3c'), smoothstep(0.55, 0.95, f) * 0.7);
    c = mixColor(c, rgb('#7a7c84'), (1 - smoothstep(0, 0.22, f)) * 0.35);
    c = mixColor(c, sky.haze, 0.06 + 0.1 * (1 - f));
    c = mixColor(c, rgb('#d98a5a'), lit * 0.5 * (1 - f * 0.3));
    return mixColor(c, rgb('#12162a'), sky.night * 0.5);
  }

  function paintVolcano(ctx, g, sky) {
    const x0 = Math.floor(g.W * 0.15);
    const x1 = Math.ceil(g.W * 0.95);
    const y0 = Math.floor(g.H * 0.2);
    const y1 = Math.ceil(g.H * HORIZON);
    const w = x1 - x0;
    const h = y1 - y0;
    const img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const top = ridge(g, x0 + x);
      for (let y = Math.max(0, Math.floor(top - y0)); y < h; y++) {
        const c = slopePixel(g, sky, x0 + x, y0 + y, top);
        const i = (y * w + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  function paintFarHills(ctx, g, sky) {
    const base = g.H * HORIZON;
    const col = mixColor(rgb('#6c7898'), sky.haze, 0.55);
    ctx.fillStyle = hex(mixColor(col, rgb('#1c2038'), sky.night * 0.6));
    for (const [from, to, seed, amp] of [[0, 0.3, 3, 0.07], [0.8, 1.02, 9, 0.05]]) {
      ctx.beginPath();
      ctx.moveTo(g.W * from, base + 1);
      for (let px = g.W * from; px <= g.W * to; px += 2) {
        const k = Math.sin(Math.PI * (px / g.W - from) / (to - from));
        const hh = (0.25 + 0.75 * fbm(px * 0.03, seed, 3, seed)) * k * amp * g.H;
        ctx.lineTo(px, base - hh);
      }
      ctx.lineTo(g.W * to, base + 1);
      ctx.fill();
    }
  }

  // ---- water -------------------------------------------------------------

  function paintWater(ctx, g, sky, back) {
    const top = Math.floor(g.H * HORIZON);
    const h = g.H - top;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, sky.haze, 0.3)));
    grad.addColorStop(1, hex(mixColor(sky.top, rgb('#1c2a48'), 0.6)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, h);
    // Reflection: mirrored rows of what stands above, nudged sideways row by row.
    ctx.globalAlpha = 0.3;
    const rows = Math.min(h, top);
    for (let r = 0; r < rows; r++) {
      const wob = Math.sin(r * 0.9) * g.U * 0.35 * (1 + r / rows);
      ctx.drawImage(back, 0, top - 1 - r, g.W, 1, wob, top + r, g.W, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(mixColor(sky.low, rgb('#f2ece0'), 0.4));
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, top, g.W, 1);
    ctx.globalAlpha = 1;
  }

  // ---- shore -------------------------------------------------------------

  function paintBank(ctx, g, sky) {
    const dark = mixColor(rgb('#232c24'), rgb('#0c0e18'), sky.night * 0.6);
    ctx.fillStyle = hex(dark);
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.8);
    ctx.quadraticCurveTo(g.W * 0.12, g.H * 0.8, g.W * 0.2, g.H * 0.88);
    ctx.quadraticCurveTo(g.W * 0.27, g.H * 0.95, g.W * 0.36, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(dark, sky.amb, 0.12));
    ctx.fillRect(0, g.H * 0.8, g.W * 0.12, Math.max(1, g.U * 0.5));
  }

  function paintPine(ctx, g, sky, rand) {
    const bark = hex(mixColor(rgb('#1c1a1a'), rgb('#0c0e18'), sky.night * 0.5));
    const needle = mixColor(rgb('#2e4430'), rgb('#101a1c'), sky.night * 0.6);
    const bx = g.W * 0.085;
    const by = g.H * 0.805;
    ctx.strokeStyle = bark;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, g.U * 1.5);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx - g.U * 3, by - g.H * 0.12, bx + g.U * 3, by - g.H * 0.22, bx + g.U * 1, by - g.H * 0.36);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    const arms = [[0.1, 0.16, 12], [0.22, 0.3, 15], [0.31, 0.39, 11], [0.34, 0.47, 9]];
    for (const [ax, ay, len] of arms) {
      const sx = bx + (ax - 0.09) * g.W * 0.3;
      const sy = by - g.H * ay * 0.85;
      ctx.beginPath();
      ctx.moveTo(bx + g.U * 0.4, sy + g.U * 3);
      ctx.quadraticCurveTo(sx - g.U * 2, sy + g.U, sx + g.U * len * 0.9, sy);
      ctx.stroke();
      paintPad(ctx, g, needle, sx + g.U * len * 0.9, sy, len, rand);
    }
    paintPad(ctx, g, needle, bx + g.U, by - g.H * 0.37, 9, rand);
  }

  // A flat tier of needles, the shape of a pruned pine.
  function paintPad(ctx, g, needle, cx, cy, len, rand) {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = hex(mixColor(needle, rgb('#4d5b3c'), rand() * 0.3));
      ctx.beginPath();
      ctx.ellipse(cx + (rand() - 0.5) * g.U * len, cy + (rand() - 0.7) * g.U * 1.4,
        g.U * (2 + rand() * 2.4), g.U * (0.7 + rand() * 0.7), 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintLantern(ctx, g, sky) {
    const stone = mixColor(rgb('#8a8c90'), rgb('#2a2e44'), sky.night * 0.65);
    const dark = mixColor(stone, rgb('#14161e'), 0.4);
    const lx = g.W * 0.15;
    const ly = g.H * 0.845;
    const u = g.U * 1.5;
    ctx.fillStyle = hex(dark);
    ctx.fillRect(lx - u * 2.2, ly - u * 1, u * 4.4, u * 1);
    ctx.fillStyle = hex(stone);
    ctx.fillRect(lx - u * 0.7, ly - u * 6, u * 1.4, u * 5);
    ctx.fillRect(lx - u * 1.8, ly - u * 6.8, u * 3.6, u * 0.8);
    ctx.fillStyle = hex(dark);
    ctx.fillRect(lx - u * 1.5, ly - u * 10, u * 3, u * 3.2);
    const glow = sky.night * 0.9 + 0.15;
    ctx.fillStyle = hex(mixColor(rgb('#3a3028'), rgb('#e2b04a'), glow));
    ctx.fillRect(lx - u * 0.7, ly - u * 9.2, u * 1.4, u * 1.6);
    ctx.fillStyle = hex(stone);
    ctx.beginPath();
    ctx.moveTo(lx - u * 3, ly - u * 10);
    ctx.lineTo(lx, ly - u * 12.6);
    ctx.lineTo(lx + u * 3, ly - u * 10);
    ctx.fill();
    ctx.fillRect(lx - u * 0.4, ly - u * 13.6, u * 0.8, u * 1.2);
    if (sky.night > 0.1) {
      const halo = ctx.createRadialGradient(lx, ly - u * 8.4, 0, lx, ly - u * 8.4, u * 9);
      halo.addColorStop(0, `rgba(226,176,74,${0.3 * sky.night})`);
      halo.addColorStop(1, 'rgba(226,176,74,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(lx - u * 10, ly - u * 18, u * 20, u * 20);
    }
  }

  function paintCraterGlow(ctx, g, sky) {
    const r = g.U * 7;
    const cx = g.W * CRATER.x;
    const cy = g.H * CRATER.y;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, `rgba(214,100,60,${0.18 + 0.4 * sky.night})`);
    glow.addColorStop(1, 'rgba(214,100,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // ---- bake --------------------------------------------------------------

  function paintFerry(g, sky) {
    const u = g.U;
    const w = Math.ceil(u * 17);
    const h = Math.ceil(u * 7);
    const c = layer(w * 1.55, h * 1.55);
    const ctx = c.getContext('2d');
    ctx.scale(1.55, 1.55);
    const white = hex(mixColor(rgb('#e8e4d6'), rgb('#40466a'), sky.night * 0.65));
    const shade = hex(mixColor(rgb('#b8b6b0'), rgb('#2a2e4c'), sky.night * 0.65));
    ctx.fillStyle = hex(mixColor(rgb('#2c3a68'), rgb('#161a30'), sky.night * 0.5));
    ctx.beginPath();
    ctx.moveTo(0, h - u * 2.6);
    ctx.lineTo(w, h - u * 2.6);
    ctx.lineTo(w - u * 1.6, h);
    ctx.lineTo(u * 1.2, h);
    ctx.fill();
    ctx.fillStyle = white;
    ctx.fillRect(u * 1, h - u * 4.4, w - u * 3, u * 1.8);
    ctx.fillRect(u * 3, h - u * 6.1, w - u * 9, u * 1.7);
    ctx.fillRect(u * 6, h - u * 7, u * 5, u * 0.9);
    ctx.fillStyle = shade;
    ctx.fillRect(u * 1, h - u * 2.8, w - u * 3, u * 0.2 + 1);
    ctx.fillStyle = hex(mixColor(rgb('#3a4a6a'), rgb('#e2b04a'), sky.night * 0.9));
    for (let wx = u * 3.4; wx < w - u * 7; wx += u * 1.5) ctx.fillRect(wx, h - u * 5.6, u * 0.8, u * 0.8);
    ctx.fillStyle = '#d6452c';
    ctx.fillRect(w - u * 5.8, h - u * 7.1, u * 1.6, u * 1.6);
    ctx.fillStyle = white;
    ctx.fillRect(w - u * 5.6, h - u * 8, u * 1.2, u * 1);
    return c;
  }

  function paintWorld(g, sky, rand) {
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    bctx.drawImage(state.sky, 0, 0);
    paintFarHills(bctx, g, sky);
    paintVolcano(bctx, g, sky);
    paintCraterGlow(bctx, g, sky);
    const mid = layer(g.W, g.H);
    const mctx = mid.getContext('2d');
    paintFarHills(mctx, g, sky);
    paintVolcano(mctx, g, sky);
    paintCraterGlow(mctx, g, sky);
    paintWater(mctx, g, sky, back);
    const fore = layer(g.W, g.H);
    const fctx = fore.getContext('2d');
    paintBank(fctx, g, sky);
    paintPine(fctx, g, sky, rand);
    paintLantern(fctx, g, sky);
    return { mid, fore };
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    const world = paintWorld(g, sky, rand);
    state.mid = world.mid;
    state.fore = world.fore;
    state.puff = paintPuff(sky);
    state.ferryArt = paintFerry(g, sky);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.dim = sky.night;
    state.glint = hex(mixColor(rgb('#f2e6cc'), sky.amb, 0.3));
    state.sunX = sunPlace(g, sky.hour).x;
    state.sunUp = sunPlace(g, sky.hour).up ? 1 - sky.night : sky.night * 0.5;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // Ash leaning east: puffs climb from the crater and bend with the wind.
  function drawPlume(ctx, g, t, amount) {
    if (amount <= 0) return;
    const px = g.W * CRATER.x;
    const py = g.H * CRATER.y;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.06 + i / MAX_PUFFS) % 1;
      const size = g.U * (4 + a * 20);
      const dx = a * a * g.W * 0.34 + a * g.U * 5;
      const dy = -Math.sqrt(a) * g.H * 0.17 + Math.sin(t * 0.3 + i * 1.7) * g.U * 0.6;
      ctx.globalAlpha = Math.min(1, (1 - a) * 0.95 * amount);
      ctx.drawImage(state.puff, px + dx - size / 2, py + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    const top = g.H * HORIZON;
    const span = g.H - top;
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const k = (i * 0.618) % 1;
      const gy = top + span * (0.04 + 0.9 * k * k);
      const spread = g.W * (0.04 + 0.2 * k);
      const gx = state.sunX + Math.sin(i * 12.9) * spread;
      const flick = Math.sin(t * 0.9 + i * 2.3);
      if (flick < -0.2) continue;
      ctx.globalAlpha = 0.5 * state.sunUp * (0.4 + 0.6 * flick);
      ctx.fillRect(gx, gy, g.U * (1.5 + 3 * k), Math.max(1, g.U * 0.25));
    }
    ctx.globalAlpha = 1;
  }

  function drawFerry(ctx, g, t) {
    const art = state.ferryArt;
    const span = g.W + art.width * 2;
    const x = ((t * g.U * 3) % span) - art.width;
    const y = g.H * 0.74 - art.height + Math.sin(t * 0.8) * g.U * 0.15;
    ctx.drawImage(art, x, y);
    ctx.fillStyle = state.glint;
    for (let i = 1; i <= 5; i++) {
      ctx.globalAlpha = 0.5 - i * 0.08;
      ctx.fillRect(x - i * g.U * 3.2, y + art.height - g.U * 0.2 + (i % 2) * g.U * 0.3, g.U * (3 + i), Math.max(1, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.mid, 0, 0);
    drawPlume(ctx, g, t, props.ash);
    drawGlints(ctx, g, t);
    if (props.ferry) drawFerry(ctx, g, t);
    ctx.drawImage(state.fore, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', ash: 1, ferry: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
