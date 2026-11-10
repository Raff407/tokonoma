/*
 * 釧路 Kushiro — a reed wetland at first light.
 *
 * Sky, hills, marsh and river are baked and repainted once a minute from
 * the clock. Between repaints only two mist bands, swaying foreground
 * reeds, one wading crane and a flying pair move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.43;
  const RETINT_SECONDS = 60;
  const state = {};
  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
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
    const sx = g.W * 0.7;
    const sy = g.H * (HORIZON - 0.04);
    if (sky.night < 0.6) {
      const r = g.U * 34;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      glow.addColorStop(0, 'rgba(250,214,150,0.75)');
      glow.addColorStop(0.3, 'rgba(240,180,110,0.3)');
      glow.addColorStop(1, 'rgba(240,180,110,0)');
      ctx.globalAlpha = 1 - sky.night * 1.4;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, g.W, g.H * HORIZON);
      ctx.fillStyle = '#f4d9a0';
      ctx.beginPath();
      ctx.arc(sx, sy, g.U * 3.2, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ece8d6';
      ctx.globalAlpha = sky.night;
      ctx.beginPath();
      ctx.arc(g.W * 0.3, g.H * 0.16, g.U * 2.4, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintHills(ctx, g, sky) {
    const far = mixColor(rgb('#4a5a7c'), sky.haze, 0.6);
    const near = mixColor(rgb('#34466a'), sky.haze, 0.4);
    const dark = sky.night * 0.6;
    const base = g.H * HORIZON;
    const tones = [mixColor(far, rgb('#141a30'), dark), mixColor(near, rgb('#10162a'), dark)];
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = hex(tones[k]);
      ctx.beginPath();
      ctx.moveTo(0, base + 1);
      for (let px = 0; px <= g.W; px += 2) {
        const f = px / g.W;
        // A broad volcano shoulder at left and a low swell at right.
        const cone = Math.max(0, 1 - Math.abs(f - (k ? 0.2 : 0.3)) / (k ? 0.3 : 0.26));
        const h = (k ? 0.07 : 0.1) * Math.pow(cone, 1.4) + 0.012 + (fbm(px * 0.03, k * 5, 3, 7) - 0.5) * 0.02;
        ctx.lineTo(px, base - h * g.H);
      }
      ctx.lineTo(g.W, base + 1);
      ctx.fill();
    }
  }

  // ---- marsh and river ---------------------------------------------------

  function riverCenter(g, v) {
    return g.W * (0.46 + 0.2 * Math.sin(4.2 * Math.pow(v, 0.62) + 0.4) * (0.35 + v * 0.65));
  }

  function riverHalf(g, v) {
    return g.W * (0.004 + 0.13 * Math.pow(v, 1.5));
  }

  function paintMarsh(ctx, g, sky) {
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    const farC = mixColor(rgb('#8a8a62'), sky.haze, 0.5);
    const nearC = mixColor(rgb('#5e5a34'), sky.amb, 0.15);
    const dark = rgb('#12161a');
    grad.addColorStop(0, hex(mixColor(farC, dark, sky.night * 0.65)));
    grad.addColorStop(1, hex(mixColor(nearC, dark, sky.night * 0.75)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
  }

  function paintRiver(ctx, g, sky) {
    const top = g.H * HORIZON;
    const steps = 60;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const v = i / steps;
      const y = lerp(top, g.H + 4, v);
      left.push([riverCenter(g, v) - riverHalf(g, v), y]);
      right.push([riverCenter(g, v) + riverHalf(g, v), y]);
    }
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    const waterFar = mixColor(sky.low, rgb('#f6dcaa'), 0.5);
    const waterNear = mixColor(mixColor(sky.top, sky.low, 0.6), rgb('#3c5060'), 0.15);
    grad.addColorStop(0, hex(waterFar));
    grad.addColorStop(1, hex(waterNear));
    ctx.fillStyle = grad;
    ctx.beginPath();
    left.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    for (let i = steps; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.fill();
    // Dark bank line along each edge.
    ctx.strokeStyle = hex(mixColor(rgb('#4a4630'), rgb('#10141a'), sky.night * 0.7));
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (const edge of [left, right]) {
      ctx.beginPath();
      edge.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
  }

  // ---- reeds -------------------------------------------------------------

  function reedTone(sky, k, rand) {
    const base = k < 0.5 ? rgb('#b89a52') : rgb('#7e7a3c');
    const tone = mixColor(base, rgb(rand() < 0.3 ? '#d6b266' : '#8a8a48'), rand() * 0.6);
    return hex(mixColor(mixColor(tone, sky.amb, 0.2), rgb('#10141a'), sky.night * 0.75));
  }

  function stem(ctx, x0, y0, h, lean, sky, rand) {
    ctx.strokeStyle = reedTone(sky, rand(), rand);
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + lean * 0.3, y0 - h * 0.6, x0 + lean, y0 - h);
    ctx.stroke();
    if (rand() < 0.4) {
      ctx.fillStyle = hex(mixColor(rgb('#e8d8a8'), sky.amb, 0.25));
      ctx.globalAlpha = 0.8 - sky.night * 0.5;
      ctx.beginPath();
      ctx.ellipse(x0 + lean, y0 - h, Math.max(1, h * 0.05), h * 0.12, lean * 0.02, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function paintMidReeds(ctx, g, sky, rand) {
    const top = g.H * HORIZON;
    const count = Math.round(g.W * 1.5);
    const items = [];
    for (let i = 0; i < count; i++) {
      const v = Math.pow(rand(), 1.4) * 0.8 + 0.03;
      const px = rand() * g.W;
      if (Math.abs(px - riverCenter(g, v)) < riverHalf(g, v) * 1.05) continue;
      items.push({ v, px });
    }
    items.sort((a, b) => a.v - b.v);
    for (const it of items) {
      const y = lerp(top, g.H, it.v);
      const h = g.U * (1.2 + it.v * 9);
      for (let s = 0; s < 3; s++) stem(ctx, it.px + s * h * 0.12, y, h * (0.8 + rand() * 0.4), (rand() - 0.5) * h * 0.4, sky, rand);
    }
  }

  function paintTufts(g, sky, rand, side) {
    const w = Math.ceil(g.W * 0.3);
    const h = Math.ceil(g.H * 0.34);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const n = Math.round(w * 0.5);
    for (let i = 0; i < n; i++) {
      const edge = side ? 1 - Math.pow(rand(), 1.6) : Math.pow(rand(), 1.6);
      const px = edge * w;
      const reach = 0.4 + 0.6 * (1 - Math.abs(edge - (side ? 1 : 0)));
      const sh = h * (0.45 + rand() * 0.55) * reach;
      stem(ctx, px, h + 1, sh, (rand() - 0.5) * g.U * 7 + (side ? -1 : 1) * g.U * 2, sky, rand);
    }
    return c;
  }

  // ---- cranes ------------------------------------------------------------

  const CRANE_WHITE = '#eeeade';
  const CRANE_BLACK = '#26262c';
  const CRANE_RED = '#c8402c';

  function paintCrane(g, s, sky, dip) {
    const w = Math.ceil(s * 9);
    const h = Math.ceil(s * 10);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const tint = (col) => hex(mixColor(mixColor(rgb(col), sky.amb, 0.18), rgb('#161a26'), sky.night * 0.7));
    const gy = h - 1;
    ctx.strokeStyle = tint(CRANE_BLACK);
    ctx.lineWidth = Math.max(1, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(s * 4.2, gy - s * 3.6);
    ctx.lineTo(s * 4.2, gy);
    ctx.moveTo(s * 4.9, gy - s * 3.6);
    ctx.lineTo(s * 5.1, gy);
    ctx.stroke();
    ctx.fillStyle = tint(CRANE_WHITE);
    ctx.beginPath();
    ctx.ellipse(s * 4.6, gy - s * 4.6, s * 2.4, s * 1.4, -0.1, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = tint(CRANE_BLACK);
    ctx.beginPath();
    ctx.moveTo(s * 2.4, gy - s * 4.8);
    ctx.lineTo(s * 1.2, gy - s * 3.9);
    ctx.lineTo(s * 2.8, gy - s * 3.7);
    ctx.fill();
    // Black neck, white face, red crown.
    const hx = dip ? s * 7.6 : s * 6.9;
    const hy = dip ? gy - s * 2.6 : gy - s * 8.6;
    ctx.strokeStyle = tint(CRANE_BLACK);
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(s * 6.3, gy - s * 5.2);
    ctx.quadraticCurveTo(s * 7, gy - s * 6.6, hx, hy);
    ctx.stroke();
    ctx.fillStyle = tint(CRANE_WHITE);
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.55, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = tint(CRANE_RED);
    ctx.fillRect(hx - s * 0.3, hy - s * 0.65, s * 0.6, s * 0.3);
    ctx.fillStyle = tint('#b99a4a');
    ctx.fillRect(hx + s * 0.4, hy - s * 0.1, s * 0.7, Math.max(1, s * 0.18));
    return c;
  }

  function drawFlyingCrane(ctx, px, py, s, flap, tone) {
    const lift = Math.sin(flap) * s * 1.7;
    ctx.fillStyle = tone.white;
    ctx.strokeStyle = tone.white;
    ctx.lineWidth = Math.max(1, s * 0.35);
    ctx.beginPath();
    ctx.ellipse(px, py, s * 1.6, s * 0.45, 0, 0, 6.3);
    ctx.fill();
    // Neck forward, legs trailing, both held straight.
    ctx.beginPath();
    ctx.moveTo(px + s * 1.4, py);
    ctx.lineTo(px + s * 3, py - s * 0.2);
    ctx.moveTo(px - s * 1.5, py + s * 0.1);
    ctx.lineTo(px - s * 3.4, py + s * 0.3);
    ctx.stroke();
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(px - s * 0.6, py);
      ctx.lineTo(px + s * 0.8, py);
      ctx.lineTo(px + dir * s * 0.4 - s * 0.6, py - lift * 1.1 + s * 0.2 * dir);
      ctx.lineTo(px - s * 1.8, py - lift * 0.6);
      ctx.fill();
    }
    ctx.fillStyle = tone.black;
    ctx.fillRect(px - s * 1.6, py - s * 0.15, s * 0.9, s * 0.4);
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(w, h, sky, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tint = mixColor(mixColor(rgb('#f4eadc'), sky.haze, 0.35), rgb('#8890b4'), sky.night * 0.6);
    const density = (px, py) => fbm(px * 0.012, py * 0.06, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let px = 0; px < w; px++) {
        const v = lerp(density(px, y), density(px - w, y), px / w);
        const i = (y * w + px) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.34, 0.62, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(52);
    state.sky = paintSky(g, sky, rand);
    const f = layer(g.W, g.H);
    const ctx = f.getContext('2d');
    paintHills(ctx, g, sky);
    paintMarsh(ctx, g, sky);
    paintRiver(ctx, g, sky);
    paintMidReeds(ctx, g, sky, rand);
    // Two cranes standing in the shallows.
    const stand = paintCrane(g, g.U * 1.9, sky, false);
    const pair = paintCrane(g, g.U * 1.6, sky, true);
    const v1 = 0.42;
    const v2 = 0.3;
    ctx.drawImage(stand, riverCenter(g, v1) + riverHalf(g, v1) * 1.5, lerp(g.H * HORIZON, g.H, v1) - stand.height + g.U);
    ctx.drawImage(pair, riverCenter(g, v2) - riverHalf(g, v2) * 1.6 - pair.width, lerp(g.H * HORIZON, g.H, v2) - pair.height + g.U);
    state.front = f;
    state.tuftL = paintTufts(g, sky, rand, 0);
    state.tuftR = paintTufts(g, sky, rand, 1);
    state.walker = paintCrane(g, g.U * 2.2, sky, false);
    state.mistA = paintMist(Math.ceil(g.W * 1.3), Math.ceil(g.H * 0.16), sky, 31);
    state.mistB = paintMist(Math.ceil(g.W * 1.3), Math.ceil(g.H * 0.2), sky, 77);
    state.tone = {
      white: hex(mixColor(rgb(CRANE_WHITE), sky.amb, 0.2)),
      black: hex(mixColor(rgb(CRANE_BLACK), rgb('#161a26'), sky.night * 0.7)),
    };
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount, img, y, rate) {
    if (amount <= 0) return;
    const off = -((t * g.U * rate) % img.width);
    ctx.globalAlpha = Math.min(1, amount * 0.95);
    ctx.drawImage(img, off, y);
    ctx.drawImage(img, off + img.width, y);
    ctx.globalAlpha = 1;
  }

  // Row-sliced sway, tips moving most.
  function drawSway(ctx, g, t, img, x, y, phase) {
    for (let s = 0; s < img.height; s++) {
      const k = 1 - s / img.height;
      const wave = Math.sin(t * 1.3 + phase + s * 0.05) * g.U * 1.6 * k * k;
      ctx.drawImage(img, 0, s, img.width, 1, x + wave, y + s, img.width, 1);
    }
  }

  function drawWalker(ctx, g, t) {
    const w = state.walker;
    const p = (t % 90) / 90;
    const v = 0.7;
    const px = lerp(g.W * 0.12, g.W * 0.4, p) + Math.sin(t * 0.8) * g.U * 0.2;
    const bob = Math.abs(Math.sin(t * 1.6)) * g.U * 0.3;
    ctx.drawImage(w, px, lerp(g.H * HORIZON, g.H, v) - w.height - bob);
  }

  function drawFlight(ctx, g, t) {
    const span = g.W * 1.3;
    const p = ((t * 0.018) % 1);
    const s = g.U * 2.1;
    const px = -g.W * 0.15 + p * span;
    for (let i = 0; i < 2; i++) {
      const x = px - i * g.U * 14;
      const y = g.H * (0.2 - p * 0.04) + i * g.U * 3 + Math.sin(t * 0.5 + i) * g.U * 0.6;
      drawFlyingCrane(ctx, x, y, s, t * 3.2 + i * 1.1, state.tone);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    if (props.cranes) drawFlight(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawMist(ctx, g, t, props.mist, state.mistA, g.H * (HORIZON - 0.05), 1.2);
    if (props.cranes) drawWalker(ctx, g, t);
    drawMist(ctx, g, t + 40, props.mist * 0.8, state.mistB, g.H * (HORIZON + 0.1), -0.9);
    drawSway(ctx, g, t, state.tuftL, 0, g.H - state.tuftL.height, 0);
    drawSway(ctx, g, t, state.tuftR, g.W - state.tuftR.width, g.H - state.tuftR.height, 2);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, cranes: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
