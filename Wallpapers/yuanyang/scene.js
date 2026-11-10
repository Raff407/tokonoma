/*
 * 元阳 Yuanyang — flooded rice terraces in Yunnan.
 *
 * A hillside of curved, nested paddies under two blue ridges. Each pool
 * mirrors the sky, with a path of sunlight laid across the water below the
 * sun. A Hani village of mushroom-roofed houses sits on a dry shelf at the
 * left. Sky, ridges, terraces and village are baked into two layers and
 * repainted once a minute from the clock; between repaints only mist, slow
 * glints on the water and hearth smoke move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const TERRACES = 15;
  const RETINT_SECONDS = 60;
  const GLINTS = 26;
  const SMOKE = 5;
  const SHELF = { from: 0.05, to: 0.4, k: 2 };
  const HOUSES = [
    { x: 0.11, s: 1.5 },
    { x: 0.19, s: 1.8 },
    { x: 0.28, s: 1.6 },
  ];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const INK = rgb('#1a1c26');
  const EARTH = rgb('#4a3a2a');
  const MOSS = rgb('#56703f');
  const GOLD = rgb('#e8b45a');
  const VERMILION = rgb('#d6603c');
  const WASHI = rgb('#f2e8d6');

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- geometry ----------------------------------------------------------

  // Top of the terraced hill: high at the left shoulder, dipping toward the
  // right where the valley opens.
  function hillTop(u) {
    const shoulder = Math.exp(-Math.pow((u - 0.22) / 0.26, 2)) * 0.07;
    return 0.47 - shoulder + u * 0.03 + Math.sin(u * 7.1 + 1) * 0.008;
  }

  // Contour k (0 = hill top, TERRACES = below the screen), sampled per column.
  function buildContours(g) {
    const cols = g.W + 1;
    const ys = new Float32Array((TERRACES + 1) * cols);
    for (let k = 0; k <= TERRACES; k++) {
      const t = k / TERRACES;
      const spread = 4 * t * (1 - t);
      for (let px = 0; px < cols; px++) {
        const u = px / g.W;
        const top = hillTop(u) * g.H;
        const base = lerp(top, g.H * 1.04, Math.pow(t, 1.25));
        // Spurs bulge toward the viewer, gullies pull back: nested curves.
        const spur = (Math.cos((u - 0.55) * Math.PI * 2.4) * 0.07 + Math.cos(u * Math.PI * 5.2 + 0.6) * 0.02) * g.H * spread;
        const wob = (fbm(u * 4 + k * 0.21, k * 0.37, 3, 11) - 0.5) * g.H * 0.012 * (0.4 + t);
        ys[k * cols + px] = base + spur + wob;
      }
    }
    for (let k = 1; k <= TERRACES; k++) {
      for (let px = 0; px < cols; px++) {
        const i = k * cols + px;
        ys[i] = Math.max(ys[i], ys[i - cols] + 1.5);
      }
    }
    return ys;
  }

  function contourY(g, k, px) {
    const cols = g.W + 1;
    const x = clamp(Math.round(px), 0, g.W);
    return state.ys[k * cols + x];
  }

  function tracePath(ctx, g, k) {
    for (let px = 0; px <= g.W; px += 2) ctx.lineTo(px, contourY(g, k, px));
    ctx.lineTo(g.W, contourY(g, k, g.W));
  }

  function sunPos(sky) {
    const t = S.sunT(sky.hour);
    return { x: 0.3 + 0.5 * t, y: 0.17 - 0.09 * Math.sin(Math.PI * t) };
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.34);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const day = 1 - sky.night;
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.35; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (day > 0.05) {
      const sp = sunPos(sky);
      const sx = g.W * sp.x;
      const sy = g.H * sp.y;
      const glowR = g.H * 0.16;
      const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      gl.addColorStop(0, `rgba(255,220,160,${0.45 * day})`);
      gl.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
      ctx.fillStyle = hex(mixColor(rgb('#fff0d0'), VERMILION, sky.hour < 8 || sky.hour > 16.5 ? 0.35 : 0));
      ctx.globalAlpha = day;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.5, g.U * 2.6), 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = hex(WASHI);
      ctx.globalAlpha = sky.night;
      ctx.beginPath();
      ctx.arc(g.W * 0.74, g.H * 0.13, Math.max(1.5, g.U * 2.2), 0, 6.3);
      ctx.fill();
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
        const v = lerp(fbm(x * 0.014, y * 0.06, 4, seed), fbm((x - c.width) * 0.014, y * 0.06, 4, seed), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 244;
        img.data[i + 1] = 238;
        img.data[i + 2] = 230;
        img.data[i + 3] = smoothstep(0.4, 0.7, v) * band * 210;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintSmoke() {
    const c = layer(24, 24);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    grad.addColorStop(0, 'rgba(226,218,208,0.55)');
    grad.addColorStop(1, 'rgba(226,218,208,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 24);
    return c;
  }

  // ---- ridges ------------------------------------------------------------

  function paintRidge(ctx, g, sky, base, amp, freq, seed, col) {
    ctx.fillStyle = hex(col);
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.6);
    for (let px = 0; px <= g.W; px += 2) {
      const u = px / g.W;
      const y = base - (fbm(u * freq, seed, 4, seed) - 0.35) * amp;
      ctx.lineTo(px, g.H * y);
    }
    ctx.lineTo(g.W, g.H * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  function paintRidges(ctx, g, sky) {
    const far = mixColor(rgb('#3e5276'), sky.haze, 0.45);
    const near = mixColor(rgb('#26344c'), sky.haze, 0.2);
    paintRidge(ctx, g, sky, 0.32, 0.28, 2.6, 3, mixColor(far, INK, sky.night * 0.4));
    paintRidge(ctx, g, sky, 0.4, 0.26, 3.4, 8, mixColor(near, INK, sky.night * 0.5));
  }

  // ---- terraces ----------------------------------------------------------

  // A pool mirrors the sky: deeper sky at its far bank, horizon light near.
  // Each paddy gets its own shade, so neighbours read as separate pools.
  function waterColors(sky, k, rand) {
    const t = k / TERRACES;
    const day = 1 - sky.night;
    const warm = sky.hour < 9 || sky.hour > 16 ? GOLD : rgb('#eadfc4');
    let far = mixColor(sky.top, sky.low, 0.45 + 0.3 * t);
    let near = mixColor(sky.low, warm, 0.3 * day);
    const v = rand();
    if (v < 0.22) near = mixColor(near, VERMILION, 0.3 * day);
    else if (v < 0.42) far = mixColor(far, rgb('#24366a'), 0.45);
    else if (v < 0.52) near = mixColor(near, MOSS, 0.45);
    return { far, near };
  }

  // Short field walls split each terrace into paddies.
  function paddySplits(g, rand) {
    const splits = [];
    for (let k = 0; k < TERRACES; k++) {
      const n = 2 + Math.floor(rand() * 3);
      const xs = [0];
      for (let i = 0; i < n; i++) xs.push(Math.round(g.W * ((i + 0.25 + rand() * 0.5) / n)));
      xs.push(g.W);
      splits.push(xs);
    }
    return splits;
  }

  function paddyPath(ctx, g, k, xa, xb) {
    ctx.beginPath();
    ctx.moveTo(xa, contourY(g, k, xa));
    for (let px = xa; px <= xb; px += 2) ctx.lineTo(px, contourY(g, k, px));
    ctx.lineTo(xb, contourY(g, k, xb));
    ctx.lineTo(xb, contourY(g, k + 1, xb));
    for (let px = xb; px >= xa; px -= 2) ctx.lineTo(px, contourY(g, k + 1, px));
    ctx.lineTo(xa, contourY(g, k + 1, xa));
    ctx.closePath();
  }

  function paintWater(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let k = 0; k < TERRACES; k++) {
      const xs = state.splits[k];
      for (let j = 0; j + 1 < xs.length; j++) {
        const { far, near } = waterColors(sky, k, rand);
        const mid = (xs[j] + xs[j + 1]) / 2;
        const y0 = contourY(g, k, mid);
        const y1 = contourY(g, k + 1, mid);
        paddyPath(ctx, g, k, xs[j], xs[j + 1]);
        const gr = ctx.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, hex(far));
        gr.addColorStop(1, hex(near));
        ctx.fillStyle = gr;
        ctx.fill();
      }
    }
    // Sunlight path laid across the pools below the sun.
    // Light path across the pools below the sun, or the moon at night.
    const day = 1 - sky.night;
    const lit = day > 0.05;
    const lx = lit ? sunPos(sky).x : 0.74;
    const tone = lit ? `255,226,170,${0.55 * day}` : `220,226,240,${0.45 * sky.night}`;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.save();
    ctx.translate(g.W * lx, g.H * 0.75);
    ctx.scale(0.45, 1);
    const r = g.H * 0.5;
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gl.addColorStop(0, `rgba(${tone})`);
    gl.addColorStop(1, `rgba(${tone.slice(0, tone.lastIndexOf(','))},0)`);
    ctx.fillStyle = gl;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintBunds(ctx, g, sky) {
    const earth = mixColor(EARTH, INK, sky.night * 0.6);
    const grass = mixColor(mixColor(MOSS, sky.amb, 0.15), INK, sky.night * 0.65);
    for (let k = 0; k <= TERRACES; k++) {
      const t = k / TERRACES;
      ctx.beginPath();
      ctx.moveTo(0, contourY(g, k, 0));
      tracePath(ctx, g, k);
      ctx.lineWidth = Math.max(1, g.U * (0.6 + 1.6 * t));
      ctx.strokeStyle = hex(earth);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, g.U * (0.3 + 0.7 * t));
      ctx.strokeStyle = hex(grass);
      ctx.translate(0, -g.U * (0.3 + 0.7 * t));
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.strokeStyle = hex(earth);
    for (let k = 0; k < TERRACES; k++) {
      const xs = state.splits[k];
      ctx.lineWidth = Math.max(1, g.U * (0.5 + 1.2 * k / TERRACES));
      ctx.beginPath();
      for (let j = 1; j + 1 < xs.length; j++) {
        ctx.moveTo(xs[j], contourY(g, k, xs[j]));
        ctx.lineTo(xs[j] + g.U * 0.8, contourY(g, k + 1, xs[j]));
      }
      ctx.stroke();
    }
  }

  // ---- village -----------------------------------------------------------

  // A dry shelf of earth and trees at the left, where the houses stand.
  function paintShelf(ctx, g, sky) {
    const a = Math.round(g.W * SHELF.from);
    const b = Math.round(g.W * SHELF.to);
    ctx.fillStyle = hex(mixColor(rgb('#4e5a34'), INK, sky.night * 0.65));
    ctx.beginPath();
    for (let px = a; px <= b; px += 2) {
      const e = Math.sin(((px - a) / (b - a)) * Math.PI);
      const top = contourY(g, SHELF.k, px) - g.U * 4 * Math.sqrt(e);
      ctx.lineTo(px, top);
    }
    for (let px = b; px >= a; px -= 2) {
      const e = Math.sin(((px - a) / (b - a)) * Math.PI);
      ctx.lineTo(px, lerp(contourY(g, SHELF.k, px), contourY(g, SHELF.k + 2, px), Math.sqrt(e)));
    }
    ctx.closePath();
    ctx.fill();
  }

  function paintTree(ctx, sky, tx, base, s) {
    ctx.fillStyle = hex(mixColor(rgb('#2f4a2e'), INK, sky.night * 0.7));
    ctx.beginPath();
    ctx.arc(tx, base - s * 3.4, s * 2.4, 0, 6.3);
    ctx.arc(tx + s * 1.8, base - s * 2.6, s * 1.9, 0, 6.3);
    ctx.arc(tx - s * 1.6, base - s * 2.2, s * 1.6, 0, 6.3);
    ctx.fill();
  }

  // A Hani mushroom house: mud walls under a fat rounded thatch roof.
  function paintHouse(ctx, sky, hx, base, s) {
    const night = sky.night;
    const wall = mixColor(rgb('#c4a47c'), INK, night * 0.7);
    const thatch = mixColor(rgb('#a8823e'), INK, night * 0.7);
    const shade = mixColor(thatch, INK, 0.45);
    ctx.fillStyle = hex(wall);
    ctx.fillRect(hx - s * 2.2, base - s * 3, s * 4.4, s * 3);
    ctx.fillStyle = hex(mixColor(wall, INK, 0.6));
    ctx.fillRect(hx - s * 0.5, base - s * 2, s * 1, s * 2);
    if (night > 0.4) {
      ctx.fillStyle = hex(GOLD);
      ctx.fillRect(hx + s * 1, base - s * 2.2, s * 0.6, s * 0.6);
    }
    ctx.fillStyle = hex(shade);
    ctx.beginPath();
    ctx.moveTo(hx - s * 3.4, base - s * 2.6);
    ctx.quadraticCurveTo(hx - s * 3.2, base - s * 7.4, hx, base - s * 7.6);
    ctx.quadraticCurveTo(hx + s * 3.2, base - s * 7.4, hx + s * 3.4, base - s * 2.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(thatch);
    ctx.beginPath();
    ctx.moveTo(hx - s * 3, base - s * 3);
    ctx.quadraticCurveTo(hx - s * 2.8, base - s * 7.2, hx, base - s * 7.3);
    ctx.quadraticCurveTo(hx + s * 1.4, base - s * 7.2, hx + s * 1.2, base - s * 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(thatch, GOLD, 0.4 * (1 - night)));
    ctx.fillRect(hx - s * 0.6, base - s * 7.9, s * 1.2, s * 0.6);
  }

  function houseBase(g, h) {
    const px = g.W * h.x;
    return contourY(g, SHELF.k, px) + g.U * 2.4;
  }

  function paintVillage(ctx, g, sky) {
    paintShelf(ctx, g, sky);
    paintTree(ctx, sky, g.W * 0.07, houseBase(g, HOUSES[0]), g.U * 1.6);
    paintTree(ctx, sky, g.W * 0.25, houseBase(g, HOUSES[1]) - g.U * 2, g.U * 1.4);
    paintTree(ctx, sky, g.W * 0.36, houseBase(g, HOUSES[2]), g.U * 1.5);
    for (const h of HOUSES) paintHouse(ctx, sky, g.W * h.x, houseBase(g, h), g.U * h.s);
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand, village) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidges(ctx, g, sky);
    ctx.drawImage(paintWater(g, sky, rand), 0, 0);
    paintBunds(ctx, g, sky);
    if (village) paintVillage(ctx, g, sky);
    return c;
  }

  function placeGlints(g, sky) {
    const r = K.rng(5);
    const sx = g.W * sunPos(sky).x;
    for (let i = 0; i < GLINTS; i++) {
      const k = 1 + Math.floor(r() * (TERRACES - 2));
      const near = i < GLINTS * 0.6;
      const px = near ? sx + (r() - 0.5) * g.W * 0.3 : r() * g.W;
      const y0 = contourY(g, k, px);
      const y1 = contourY(g, k + 1, px);
      const t = k / TERRACES;
      state.glints[i] = {
        x: px,
        y: lerp(y0, y1, 0.35 + r() * 0.35),
        w: g.U * (3 + r() * 5) * (0.6 + t),
        h: Math.max(1, g.U * (0.5 + t * 0.8)),
        ph: r() * 6.3,
        sp: 0.35 + r() * 0.45,
      };
    }
  }

  function repaint(g, props) {
    const sky = S.at(S.hour(props.time));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand, props.village);
    state.mistAlpha = 0.85 - sky.night * 0.45;
    state.dim = sky.night;
    state.glintColor = sky.night > 0.5 ? '#d8dce6' : '#fff0cc';
    state.choice = props.time;
    state.village = props.village;
    state.retintIn = RETINT_SECONDS;
    placeGlints(g, sky);
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const a = Math.min(1, state.mistAlpha * amount);
    const rows = state.mistRows;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const off = -((t * g.U * r.speed + i * 97) % r.img.width);
      ctx.globalAlpha = a * r.a;
      ctx.drawImage(r.img, off, g.H * r.y);
      ctx.drawImage(r.img, off + r.img.width, g.H * r.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, t) {
    ctx.fillStyle = state.glintColor;
    const k = 1 - state.dim * 0.75;
    for (let i = 0; i < GLINTS; i++) {
      const q = state.glints[i];
      const v = Math.max(0, Math.sin(t * q.sp + q.ph));
      const slide = Math.sin(t * q.sp * 0.5 + q.ph) * q.w * 0.3;
      ctx.globalAlpha = v * v * 0.85 * k;
      ctx.fillRect(q.x - q.w / 2 + slide, q.y, q.w, q.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t) {
    for (let h = 0; h < 2; h++) {
      const house = HOUSES[h === 0 ? 0 : 2];
      const s = g.U * house.s;
      const bx = g.W * house.x;
      const by = houseBase(g, house) - s * 7.6;
      for (let i = 0; i < SMOKE; i++) {
        const a = (t * 0.05 + i / SMOKE + h * 0.37) % 1;
        const size = g.U * (2.5 + a * 6);
        ctx.globalAlpha = (1 - a) * 0.75 * (1 - state.dim * 0.4);
        ctx.drawImage(state.smoke, bx + a * g.U * 5 + Math.sin(t * 0.5 + i) * g.U * 0.6 - size / 2, by - a * g.U * 16 - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.ys = buildContours(g);
    state.splits = paddySplits(g, K.rng(91));
    state.glints = new Array(GLINTS);
    const mistA = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.16), 21);
    const mistB = paintMist(Math.ceil(g.W * 1.6), Math.ceil(g.H * 0.2), 33);
    state.mistRows = [
      { img: mistA, y: 0.34, speed: 3, a: 0.9 },
      { img: mistB, y: 0.52, speed: 4.5, a: 1 },
      { img: mistA, y: 0.74, speed: 6, a: 0.6 },
    ];
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
    drawGlints(ctx, t);
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
