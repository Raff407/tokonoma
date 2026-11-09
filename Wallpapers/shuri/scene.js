/*
 * 首里城 Shuri Castle — the vermilion Ryukyu palace on its limestone hill.
 *
 * Sky, sea, hill, palace and wall are baked into two layers and repainted
 * once a minute from the clock. Between repaints only clouds, sea glitter,
 * one small sail and three gulls move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.42;
  const PLATEAU = 0.55;
  const SHORE = 0.8;
  const RETINT_SECONDS = 60;
  const GLINTS = 56;
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A colour lit by the sky and dimmed toward indigo at night.
  function tone(h, sky, lit) {
    const base = mixColor(rgb(h), sky.amb, lit === undefined ? 0.15 : lit);
    return hex(mixColor(base, rgb('#141a34'), sky.night * 0.62));
  }

  // ---- sky and sea ---------------------------------------------------------

  function paintDisk(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    if (t <= 0.02 || t >= 0.98) return;
    const px = g.W * (0.12 + 0.76 * t);
    const py = g.H * (0.4 - 0.3 * Math.sin(Math.PI * t));
    const r = g.U * (night ? 3.4 : 4.4);
    const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
    glow.addColorStop(0, night ? 'rgba(220,226,240,0.3)' : 'rgba(250,226,180,0.4)');
    glow.addColorStop(1, 'rgba(250,226,180,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - r * 4, py - r * 4, r * 8, r * 8);
    ctx.fillStyle = night ? '#e4e2d4' : '#f4e6c0';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 6.3);
    ctx.fill();
  }

  function paintIslands(ctx, g, sky) {
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#5d7894'), sky.haze, 0.55), rgb('#1c2444'), sky.night * 0.6));
    const base = g.H * HORIZON;
    const spans = [[0.02, 0.2, 0.025], [0.82, 1.02, 0.03], [0.7, 0.78, 0.012]];
    for (const [a, b, hh] of spans) {
      ctx.beginPath();
      ctx.moveTo(g.W * a, base + 1);
      for (let x = g.W * a; x <= g.W * b; x += 2) {
        const k = (x - g.W * a) / (g.W * (b - a));
        ctx.lineTo(x, base - Math.sin(k * Math.PI) * g.H * hh * (0.8 + fbm(x * 0.05, 3, 2, 7) * 0.4));
      }
      ctx.lineTo(g.W * b, base + 1);
      ctx.fill();
    }
  }

  function paintSkyAndSea(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const horizonY = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, horizonY + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * horizonY * 0.9, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintDisk(ctx, g, sky);
    paintIslands(ctx, g, sky);
    const sea = ctx.createLinearGradient(0, horizonY, 0, g.H);
    sea.addColorStop(0, hex(mixColor(mixColor(rgb('#6fa4aa'), sky.low, 0.4), rgb('#1c2a4c'), sky.night * 0.6)));
    sea.addColorStop(1, tone('#28607a', sky, 0.1));
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizonY, g.W, g.H - horizonY);
    ctx.fillStyle = hex(mixColor(sky.amb, rgb('#e8e2d0'), 0.5));
    for (let i = 0; i < 90; i++) {
      const y = horizonY + (g.H - horizonY) * Math.pow(rand(), 1.4);
      ctx.globalAlpha = 0.07 + rand() * 0.07;
      ctx.fillRect(rand() * g.W, y, g.U * (2 + rand() * 6), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 21);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 246;
        img.data[i + 3] = smoothstep(0.5, 0.68, v) * band * 215;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- hill, trees, wall -----------------------------------------------------

  function hillY(g, fx) {
    const out = Math.max(0, 0.2 - fx, fx - 0.8) / 0.2;
    return g.H * (PLATEAU + 0.2 * smoothstep(0, 1, out) + (fbm(fx * 9, 5, 2, 3) - 0.5) * 0.01);
  }

  function paintHill(ctx, g, sky) {
    const top = hillY(g, 0.5) - g.U * 2;
    const grad = ctx.createLinearGradient(0, top, 0, g.H * SHORE);
    grad.addColorStop(0, tone('#4f6b3a', sky));
    grad.addColorStop(1, tone('#2f4a30', sky));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-2, g.H * SHORE);
    for (let x = -2; x <= g.W + 2; x += 2) ctx.lineTo(x, hillY(g, x / g.W));
    ctx.lineTo(g.W + 2, g.H * SHORE);
    ctx.fill();
    // Limestone shore and a thin line of surf.
    ctx.fillStyle = tone('#bfb8a2', sky);
    ctx.fillRect(0, g.H * SHORE - g.U * 1.2, g.W, g.U * 1.2);
    ctx.fillStyle = hex(mixColor(rgb('#e8e2d0'), sky.amb, 0.2));
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, g.H * SHORE, g.W, Math.max(1, g.U * 0.5));
    ctx.globalAlpha = 1;
  }

  function paintTrees(ctx, g, sky, rand) {
    const leaf = [tone('#3c5a3c', sky), tone('#4a6a40', sky), tone('#2e4a34', sky)];
    const groves = [[0.015, 0.17], [0.83, 0.985]];
    for (const [a, b] of groves) {
      for (let i = 0; i < 46; i++) {
        const fx = a + rand() * (b - a);
        const x = g.W * fx;
        const y = hillY(g, fx) - g.U * (1 + rand() * 4);
        const r = g.U * (1.8 + rand() * 2.2);
        ctx.fillStyle = tone('#4a3a2c', sky);
        ctx.fillRect(x - 1, y, 2, r * 1.2);
        ctx.fillStyle = leaf[Math.floor(rand() * 3)];
        ctx.beginPath();
        ctx.arc(x, y - r * 0.3, r, 0, 6.3);
        ctx.fill();
      }
    }
    // Red hibiscus along the lower slope.
    ctx.fillStyle = '#c4402c';
    for (let i = 0; i < 40; i++) {
      const fx = 0.04 + rand() * 0.92;
      const y = hillY(g, fx) + g.U * 4 + rand() * (g.H * SHORE - hillY(g, fx) - g.U * 8);
      ctx.globalAlpha = 0.5 + rand() * 0.3;
      ctx.fillRect(g.W * fx, y, Math.max(1, g.U * 0.7), Math.max(1, g.U * 0.7));
    }
    ctx.globalAlpha = 1;
  }

  // Curved limestone wall along the front of the plateau, with an arched gate.
  function paintWall(ctx, g, sky) {
    const x0 = g.W * 0.2;
    const x1 = g.W * 0.8;
    const top = g.H * PLATEAU;
    const hh = g.U * 6;
    const stone = tone('#d9d2bc', sky, 0.25);
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(x0, top + hh);
    for (let x = x0; x <= x1; x += 2) {
      const k = (x - x0) / (x1 - x0);
      ctx.lineTo(x, top + Math.sin(k * Math.PI) * -g.U * 1.2 + Math.pow(Math.abs(k - 0.5) * 2, 3) * g.U * 2);
    }
    ctx.lineTo(x1, top + hh);
    ctx.fill();
    ctx.strokeStyle = tone('#a89f86', sky);
    ctx.lineWidth = 1;
    for (let r = 1; r < 4; r++) {
      const y = top + g.U * (r * 2.2 + 1);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
    // Arched gate.
    const gx = g.W * 0.5;
    const gw = g.U * 5;
    ctx.fillStyle = tone('#2a2a3a', sky, 0);
    ctx.beginPath();
    ctx.moveTo(gx - gw, top + hh);
    ctx.lineTo(gx - gw, top + g.U * 4.5);
    ctx.arc(gx, top + g.U * 4.5, gw, Math.PI, 0);
    ctx.lineTo(gx + gw, top + hh);
    ctx.fill();
    // Steps down from the gate.
    ctx.fillStyle = stone;
    for (let s = 0; s < 5; s++) {
      const w = gw * (1.6 + s * 0.5);
      ctx.fillRect(gx - w, top + hh + s * g.U * 1.2, w * 2, g.U * 1.2);
      ctx.fillStyle = tone('#b8b09a', sky);
      ctx.fillRect(gx - w, top + hh + s * g.U * 1.2, w * 2, 1);
      ctx.fillStyle = stone;
    }
  }

  // A seated shisa lion on a stone block, facing the gate.
  function paintShisa(ctx, g, sky, cx, base, dir) {
    const s = g.U * 1.25;
    const clay = tone('#b5894e', sky, 0.2);
    const dark = tone('#7c5a30', sky, 0.1);
    ctx.fillStyle = tone('#cfc8b0', sky, 0.25);
    ctx.fillRect(cx - s * 4, base - s * 2, s * 8, s * 2);
    ctx.fillStyle = clay;
    ctx.fillRect(cx - s * 2.6, base - s * 7, s * 5.2, s * 5);
    ctx.beginPath();
    ctx.arc(cx + dir * s * 1.2, base - s * 8.6, s * 2.6, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(cx + dir * s * 1.2, base - s * 8.6, s * 3.1, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(cx + dir * s * 1.2, base - s * 8.6);
    ctx.fill();
    ctx.fillStyle = clay;
    ctx.beginPath();
    ctx.arc(cx + dir * s * 1.8, base - s * 8.3, s * 2.1, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#1e1a22';
    ctx.fillRect(cx + dir * s * 2.6, base - s * 9, Math.max(1, s * 0.5), Math.max(1, s * 0.5));
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(cx - dir * s * 2.8, base - s * 5.2, s * 1.6, 0, 6.3);
    ctx.fill();
  }

  // ---- palace -----------------------------------------------------------------

  function paintWall2(ctx, g, sky, cx, w, y0, y1) {
    ctx.fillStyle = tone('#c4402a', sky, 0.1);
    ctx.fillRect(cx - w / 2, y0, w, y1 - y0);
    ctx.fillStyle = tone('#8e2c20', sky, 0.1);
    const n = Math.max(3, Math.round(w / (g.U * 4.2)));
    for (let i = 0; i <= n; i++) ctx.fillRect(cx - w / 2 + (w - Math.max(1, g.U * 0.6)) * (i / n), y0, Math.max(1, g.U * 0.6), y1 - y0);
    // Gold lattice windows, warm at night.
    const lit = sky.night;
    for (let i = 0; i < n; i++) {
      const wx = cx - w / 2 + (w / n) * (i + 0.5) - g.U * 1.1;
      ctx.fillStyle = hex(mixColor(rgb('#4a2a22'), rgb('#e0b45a'), lit * 0.85));
      ctx.fillRect(wx, y0 + (y1 - y0) * 0.3, g.U * 2.2, (y1 - y0) * 0.5);
    }
    ctx.fillStyle = tone('#d9d2bc', sky, 0.2);
    ctx.fillRect(cx - w / 2 - 1, y1 - g.U * 1.1, w + 2, g.U * 1.1);
  }

  function paintRoof(ctx, g, sky, cx, eave, w, rise, upW) {
    const lift = g.U * 1.6;
    const tl = [cx - w / 2, eave - lift];
    const tr = [cx + w / 2, eave - lift];
    const al = [cx - upW / 2, eave - rise];
    const ar = [cx + upW / 2, eave - rise];
    ctx.beginPath();
    ctx.moveTo(tl[0], tl[1]);
    ctx.quadraticCurveTo(tl[0] + w * 0.13, eave - rise * 0.08, al[0], al[1]);
    ctx.lineTo(ar[0], ar[1]);
    ctx.quadraticCurveTo(tr[0] - w * 0.13, eave - rise * 0.08, tr[0], tr[1]);
    ctx.quadraticCurveTo(cx, eave + g.U * 1.4, tl[0], tl[1]);
    ctx.fillStyle = tone('#a53a28', sky, 0.12);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = tone('#7a281c', sky, 0.1);
    ctx.globalAlpha = 0.6;
    for (let x = cx - w / 2; x < cx + w / 2; x += g.U * 1.5) {
      ctx.beginPath();
      ctx.moveTo(x, eave - rise);
      ctx.lineTo(x + (x - cx) * 0.25, eave + g.U * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // White plaster edge on the eave and a ridge line.
    ctx.strokeStyle = tone('#ece6d4', sky, 0.2);
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    ctx.beginPath();
    ctx.moveTo(tl[0], tl[1]);
    ctx.quadraticCurveTo(cx, eave + g.U * 1.4, tr[0], tr[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(al[0], al[1]);
    ctx.lineTo(ar[0], ar[1]);
    ctx.lineWidth = Math.max(1, g.U * 1.1);
    ctx.stroke();
    // Gold dragons curling up at both ridge ends.
    ctx.strokeStyle = tone('#d6a640', sky, 0.1);
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    for (const d of [-1, 1]) {
      const rx = cx + d * upW / 2;
      ctx.beginPath();
      ctx.moveTo(rx, al[1]);
      ctx.quadraticCurveTo(rx + d * g.U * 2.4, al[1] - g.U * 0.5, rx + d * g.U * 1.4, al[1] - g.U * 3.4);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  function paintHall(ctx, g, sky, cx, wallW, y0, y1, roofW, rise, upW) {
    paintWall2(ctx, g, sky, cx, wallW, y0, y1);
    paintRoof(ctx, g, sky, cx, y0, roofW, rise, upW);
  }

  function paintPalace(ctx, g, sky) {
    const cx = g.W * 0.5;
    const base = g.H * PLATEAU;
    // Side halls first, then the two-storey main hall.
    for (const d of [-1, 1]) {
      paintHall(ctx, g, sky, cx + d * g.W * 0.235, g.W * 0.11, base - g.H * 0.06, base, g.W * 0.18, g.H * 0.05, g.W * 0.08);
    }
    paintWall2(ctx, g, sky, cx, g.W * 0.2, base - g.H * 0.16, base - g.H * 0.075);
    paintRoof(ctx, g, sky, cx, base - g.H * 0.16, g.W * 0.28, g.H * 0.08, g.W * 0.1);
    paintWall2(ctx, g, sky, cx, g.W * 0.3, base - g.H * 0.085, base);
    paintRoof(ctx, g, sky, cx, base - g.H * 0.085, g.W * 0.42, g.H * 0.065, g.W * 0.26);
    // Hall doorway and a stone base.
    ctx.fillStyle = hex(mixColor(rgb('#2a1a1c'), rgb('#e0b45a'), sky.night * 0.5));
    ctx.fillRect(cx - g.U * 2.4, base - g.U * 6.5, g.U * 4.8, g.U * 6.5);
  }

  // ---- bake ------------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHill(ctx, g, sky);
    paintTrees(ctx, g, sky, rand);
    paintPalace(ctx, g, sky);
    paintWall(ctx, g, sky);
    paintShisa(ctx, g, sky, g.W * 0.41, g.H * PLATEAU + g.U * 1.5, 1);
    paintShisa(ctx, g, sky, g.W * 0.59, g.H * PLATEAU + g.U * 1.5, -1);
    return c;
  }

  function makeGlints(g) {
    const rand = K.rng(77);
    const xs = new Float32Array(GLINTS);
    const ys = new Float32Array(GLINTS);
    const ph = new Float32Array(GLINTS);
    for (let i = 0; i < GLINTS; i++) {
      xs[i] = rand() * g.W;
      ys[i] = g.H * (HORIZON + 0.01 + (0.97 - HORIZON) * Math.pow(rand(), 1.3));
      ph[i] = rand() * 6.3;
    }
    return { xs, ys, ph };
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSkyAndSea(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.75 - sky.night * 0.5;
    state.night = sky.night;
    state.glint = hex(mixColor(rgb('#f4eedc'), sky.amb, 0.3));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ----------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 3.2) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    const gl = state.glints;
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const v = Math.sin(t * 2 + gl.ph[i]);
      if (v < 0.2) continue;
      ctx.globalAlpha = Math.min(0.85, (v - 0.2) * 1.2 * amount) * (1 - state.night * 0.6);
      ctx.fillRect(gl.xs[i], gl.ys[i], Math.max(1, g.U * (2 + v * 2)), Math.max(1, g.U * 0.6));
    }
    ctx.globalAlpha = 1;
  }

  // A small fishing boat with a white sail, crossing the open sea.
  function drawBoat(ctx, g, t) {
    const span = g.W + g.U * 20;
    const x = ((t * g.U * 2.2) % span) - g.U * 10;
    const y = g.H * 0.5 + Math.sin(t * 0.9) * g.U * 0.25;
    const s = g.U * 1.5;
    ctx.fillStyle = hex(mixColor(rgb('#5a3a2a'), rgb('#141a34'), state.night * 0.6));
    ctx.beginPath();
    ctx.moveTo(x - s * 3, y - s * 0.6);
    ctx.lineTo(x + s * 3, y - s * 0.6);
    ctx.lineTo(x + s * 2, y + s * 0.5);
    ctx.lineTo(x - s * 2, y + s * 0.5);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#ece6d4'), rgb('#6a7398'), state.night * 0.6));
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.6);
    ctx.lineTo(x, y - s * 5.2);
    ctx.lineTo(x + s * 2.4, y - s * 0.6);
    ctx.fill();
  }

  function drawGulls(ctx, g, t) {
    ctx.strokeStyle = hex(mixColor(rgb('#e8e2d0'), rgb('#6a7398'), state.night * 0.7));
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.03 + i * 0.31) % 1;
      const x = g.W * (1.05 - phase * 1.15) + i * g.U * 3;
      const y = g.H * (0.2 + i * 0.045) + Math.sin(t * 0.5 + i * 2) * g.U * 1.5;
      const s = g.U * (2.6 + i * 0.5);
      const flap = Math.sin(t * 3.2 + i * 1.7) * s * 0.55;
      ctx.beginPath();
      ctx.moveTo(x - s, y - flap);
      ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.4, x, y);
      ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.4, x + s, y - flap);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.glints = makeGlints(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    drawGlints(ctx, g, t, props.glitter);
    drawBoat(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawGulls(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, glitter: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
