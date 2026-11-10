/*
 * 利尻 Rishiri — a lone island peak above a calm northern sea.
 *
 * Sky, island, its broken reflection and the shore are baked into layers
 * once a minute from the clock. Each frame the reflection is laid down in
 * a few horizontal strips that sway apart, then cloud, swell lines, kelp,
 * a small fishing boat and a gull move over it.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, clamp, mixColor, toHex, parseColor, smoothstep, hash2 } = K;

  const HORIZON = 0.58;
  const PEAK = { x: 0.6, y: 0.17 };
  const HALF_W = { west: 0.4, east: 0.31 };
  const RETINT_SECONDS = 60;
  const STRIPS = 22;
  const SWELLS = 34;
  const KELP = 7;
  const GLINTS = 24;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Island height 0..1 at x: concave flanks, a blunt summit, a broad western
  // shoulder and a lumpy skirt of foothills that tapers into the sea.
  function islandHeight(g, x) {
    const px = g.W * PEAK.x;
    const west = x < px;
    const d = Math.abs(x - px) / (g.W * (west ? HALF_W.west : HALF_W.east));
    if (d >= 1) return 0;
    const blunt = Math.sqrt(d * d + 0.0016) - 0.04;
    const cone = Math.pow(Math.max(0, 1 - blunt), 2.6) * 1.03;
    const shoulder = west ? 0.13 * Math.exp(-Math.pow((d - 0.4) / 0.13, 2)) : 0.05 * Math.exp(-Math.pow((d - 0.5) / 0.08, 2));
    const skirt = (fbm(x * 0.03, 2.5, 3, 31) - 0.4) * 0.22 * smoothstep(0.25, 0.7, d);
    const crag = (fbm(x * 0.22, 7.1, 2, 5) - 0.5) * 0.03 * smoothstep(0.05, 0.35, d);
    const taper = 1 - smoothstep(0.82, 1, d);
    return Math.max(0, (cone + shoulder + Math.max(0, skirt) + crag) * taper + 0.035 * taper);
  }

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.hz);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.hz + 1);
    if (sky.night < 0.95) {
      const t = S.sunT(sky.hour);
      const sx = lerp(0.08, 0.5, t) * g.W;
      const sy = g.hz - Math.sin(t * Math.PI) * g.H * 0.42;
      const warm = mixColor(rgb('#fff1d2'), rgb('#f0954f'), 1 - Math.sin(t * Math.PI));
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, g.U * 16);
      halo.addColorStop(0, rgba(warm, 0.45 * (1 - sky.night)));
      halo.addColorStop(1, rgba(warm, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, g.W, g.hz);
      ctx.fillStyle = rgba(warm, 1 - sky.night);
      ctx.beginPath();
      ctx.arc(sx, sy, g.U * 3, 0, 6.3);
      ctx.fill();
    }
    if (sky.night > 0.1) {
      const mx = g.W * 0.24;
      const my = g.H * 0.15;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 14);
      mg.addColorStop(0, `rgba(236,232,214,${0.45 * sky.night})`);
      mg.addColorStop(1, 'rgba(236,232,214,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, g.W, g.hz);
      ctx.fillStyle = rgba(rgb('#ece8d6'), sky.night);
      ctx.beginPath();
      ctx.arc(mx, my, g.U * 2.4, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.hz * 0.7, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Rebun, a long low island far to the west, pale in the haze.
  function paintFarIsle(ctx, g, sky) {
    ctx.fillStyle = hex(mixColor(sky.haze, sky.low, 0.45));
    const x1 = g.W * 0.3;
    ctx.beginPath();
    ctx.moveTo(-1, g.hz + 1);
    for (let x = 0; x <= x1; x += 1) {
      const f = x / x1;
      const h = g.U * (2.2 + 2.6 * fbm(x * 0.04, 1, 3, 3)) * smoothstep(0, 0.15, f) * (1 - smoothstep(0.7, 1, f));
      ctx.lineTo(x, g.hz - h);
    }
    ctx.lineTo(x1, g.hz + 1);
    ctx.fill();
  }

  function islandColours(sky) {
    const rockLit = mixColor(mixColor(rgb('#58607e'), sky.amb, 0.25), rgb('#46547e'), sky.night * 0.5);
    const rockShade = mixColor(mixColor(rgb('#2c3350'), sky.top, 0.2), rgb('#1c2238'), sky.night * 0.5);
    const woodLit = mixColor(mixColor(rgb('#506650'), sky.amb, 0.2), rgb('#2e4050'), sky.night * 0.6);
    const woodShade = mixColor(rgb('#26382e'), rgb('#18222c'), sky.night * 0.6);
    const snowLit = mixColor(mixColor(rgb('#f1efe8'), sky.amb, 0.35), rgb('#b8c0d4'), sky.night * 0.4);
    const snowShade = mixColor(mixColor(rgb('#a9b0c4'), sky.top, 0.2), rgb('#6a7398'), sky.night * 0.4);
    return { rockLit, rockShade, woodLit, woodShade, snowLit, snowShade };
  }

  function paintIsland(ctx, g, sky) {
    const x0 = Math.floor(g.W * (PEAK.x - HALF_W.west) - 1);
    const x1 = Math.ceil(g.W * (PEAK.x + HALF_W.east) + 1);
    const w = x1 - x0;
    const y0 = Math.floor(g.H * PEAK.y - g.U * 3);
    const h = Math.ceil(g.hz) - y0;
    const img = ctx.getImageData(x0, y0, w, h);
    const d = img.data;
    const col = islandColours(sky);
    const px = g.W * PEAK.x;
    const span = g.hz - g.H * PEAK.y;
    for (let x = 0; x < w; x++) {
      const wx = x0 + x;
      const top = g.hz - islandHeight(g, wx) * span;
      for (let y = Math.max(0, Math.ceil(top - y0)); y < h; y++) {
        const wy = y0 + y;
        const depth = (wy - g.H * PEAK.y) / span;
        const gully = fbm(wx * 0.18, wy * 0.035, 3, 13);
        // Ragged light/shade line: ridges catch light past the centre line.
        const edge = (px - wx) / (g.U * 6) + (gully - 0.5) * 3.2 + depth * 1.2;
        const lit = clamp(0.5 + edge * 0.5, 0, 1) * (0.75 + 0.25 * gully);
        const snowLine = 0.27 + (fbm(wx * 0.16, 2.2, 3, 4) - 0.5) * 0.4 + (gully - 0.5) * 0.08;
        const woodLine = 0.7 + (gully - 0.5) * 0.2;
        let c;
        if (depth < Math.max(0.12, snowLine)) c = mixColor(col.snowShade, col.snowLit, lit);
        else if (depth > woodLine) c = mixColor(col.woodShade, col.woodLit, lit * 0.85);
        else c = mixColor(col.rockShade, col.rockLit, lit);
        c = mixColor(c, sky.haze, 0.08 + depth * 0.18);
        const i = (y * w + x) * 4;
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  // Mirror the sky and island into the sea, row by row, with each row nudged
  // sideways and the whole fading into deep water.
  function paintReflection(g, far, sky) {
    const seaH = g.H - g.hz;
    const c = layer(g.W, seaH);
    const ctx = c.getContext('2d');
    for (let r = 0; r < seaH; r++) {
      const src = Math.max(0, g.hz - 1 - r * 1.05);
      const depth = r / seaH;
      const shift = (fbm(r * 0.3, 4.4, 2, 61) - 0.5) * g.U * (1.5 + depth * 12);
      ctx.drawImage(far, 0, src, g.W, 1, shift, r, g.W, 1);
    }
    const deep = mixColor(rgb('#1f3352'), rgb('#0e1424'), sky.night * 0.7);
    const shallow = mixColor(mixColor(sky.low, rgb('#26405f'), 0.5), deep, 0.3);
    const tint = ctx.createLinearGradient(0, 0, 0, seaH);
    tint.addColorStop(0, rgba(shallow, 0.38));
    tint.addColorStop(0.4, rgba(deep, 0.8));
    tint.addColorStop(1, rgba(deep, 0.93));
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, g.W, seaH);
    // Calm bands of light across the reflection break the mirrored shape.
    const sheen = mixColor(sky.low, rgb('#dfe6ea'), 0.4);
    for (let r = 2; r < seaH; r += 2 + Math.floor(r / 14)) {
      const a = 0.08 + 0.12 * hash2(r, 3, 9);
      ctx.fillStyle = rgba(sheen, a * (1 - r / seaH));
      ctx.fillRect(0, r, g.W, 1);
    }
    return c;
  }

  function paintShore(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const dark = mixColor(mixColor(rgb('#1c1e26'), sky.top, 0.12), rgb('#08090f'), sky.night * 0.6);
    const top = mixColor(mixColor(rgb('#6a6c78'), sky.amb, 0.25), rgb('#4a5272'), sky.night * 0.6);
    const foam = mixColor(rgb('#e6e4da'), rgb('#8a92ac'), sky.night * 0.5);
    const x1 = g.W * 0.3;
    const edge = (x) => {
      const f = x / x1;
      const lift = Math.pow(1 - f, 1.4) * 15 + 2;
      return g.H - g.U * lift * (0.7 + 0.6 * fbm(x * 0.06, 5, 3, 9)) - g.U * 4 * Math.max(0, fbm(x * 0.2, 2, 2, 17) - 0.55);
    };
    ctx.fillStyle = hex(dark);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= x1; x++) ctx.lineTo(x, edge(x));
    ctx.lineTo(x1, g.H);
    ctx.fill();
    // Lit tops of the boulders.
    ctx.strokeStyle = hex(top);
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.beginPath();
    for (let x = 0; x <= x1 * 0.92; x++) {
      const y = edge(x) + g.U * 0.4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Foam where the swell meets the point.
    ctx.fillStyle = rgba(foam, 0.55);
    for (let x = x1 * 0.6; x < x1 * 1.02; x += g.U * 1.6) {
      ctx.fillRect(x, edge(Math.min(x, x1)) + g.U * (1.2 + hash2(x | 0, 3, 5) * 1.5), g.U * (0.8 + hash2(x | 0, 4, 5) * 1.4), Math.max(1, g.U * 0.35));
    }
    // A few loose stones in the shallows off the point.
    const rand = K.rng(91);
    ctx.fillStyle = hex(dark);
    for (let i = 0; i < 5; i++) {
      const x = x1 * (0.85 + rand() * 0.45);
      const y = g.H - g.U * (1 + rand() * 4);
      ctx.beginPath();
      ctx.ellipse(x, y, g.U * (1.2 + rand() * 2), g.U * (0.6 + rand() * 0.8), 0, Math.PI, 0);
      ctx.fill();
    }
    // Racks of drying kombu on the rocks.
    const rack = mixColor(rgb('#5a4a38'), rgb('#141820'), sky.night * 0.7);
    const kombu = mixColor(rgb('#2f3a26'), rgb('#0e141a'), sky.night * 0.6);
    for (let k = 0; k < 2; k++) {
      const rx = g.W * (0.04 + k * 0.1);
      const ry = edge(rx + g.U * 4) - g.U * 0.3;
      ctx.fillStyle = hex(rack);
      ctx.fillRect(rx, ry - g.U * 5, g.U * 0.5, g.U * 5);
      ctx.fillRect(rx + g.U * 8, ry - g.U * 5, g.U * 0.5, g.U * 5);
      ctx.fillRect(rx, ry - g.U * 5, g.U * 8.5, g.U * 0.4);
      ctx.fillStyle = hex(kombu);
      for (let s = 0; s < 6; s++) ctx.fillRect(rx + g.U * (1 + s * 1.2), ry - g.U * 4.6, g.U * 0.6, g.U * (2.6 + (s % 3) * 0.7));
    }
    return c;
  }

  function paintBoat(g, sky) {
    const w = Math.round(g.U * 10);
    const h = Math.round(g.U * 6);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const base = h * 0.85;
    ctx.fillStyle = hex(mixColor(rgb('#e8e2d0'), rgb('#4a5066'), sky.night * 0.6));
    ctx.beginPath();
    ctx.moveTo(0, base - h * 0.32);
    ctx.lineTo(w, base - h * 0.4);
    ctx.lineTo(w * 0.86, base);
    ctx.lineTo(w * 0.12, base);
    ctx.fill();
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(w * 0.1, base - h * 0.14, w * 0.78, Math.max(1, h * 0.1));
    ctx.fillStyle = hex(mixColor(rgb('#2a3a5a'), rgb('#101626'), sky.night * 0.6));
    ctx.fillRect(w * 0.36, base - h * 0.64, w * 0.24, h * 0.3);
    ctx.fillStyle = '#5a4a38';
    ctx.fillRect(w * 0.72, base - h, Math.max(1, g.U * 0.35), h * 0.62);
    if (sky.night > 0.2) {
      ctx.fillStyle = '#e9b95a';
      ctx.fillRect(w * 0.7, base - h, Math.max(1, g.U * 0.7), Math.max(1, g.U * 0.7));
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.018, y * 0.09, 4, 23);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.48, 0.7, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    const far = layer(g.W, g.hz + 1);
    const fctx = far.getContext('2d');
    paintSky(fctx, g, sky, rand);
    paintFarIsle(fctx, g, sky);
    paintIsland(fctx, g, sky);
    state.far = far;
    state.reflection = paintReflection(g, far, sky);
    state.shore = paintShore(g, sky);
    state.boatArt = paintBoat(g, sky);
    state.cloudAlpha = 0.75 - sky.night * 0.45;
    state.swell = hex(mixColor(rgb('#dfe6ea'), sky.amb, 0.4));
    state.kelp = hex(mixColor(rgb('#5e6e3a'), rgb('#2c3a2c'), sky.night * 0.6));
    state.glint = hex(mixColor(rgb('#f1e6c4'), rgb('#e6e4da'), sky.night));
    state.lightX = sky.night > 0.5 ? g.W * 0.24 : lerp(0.08, 0.5, S.sunT(sky.hour)) * g.W;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawSea(ctx, g, t) {
    const ref = state.reflection;
    const seaH = ref.height;
    let y = 0;
    for (let i = 0; i < STRIPS && y < seaH; i++) {
      const h = Math.max(1, Math.round(seaH * (0.012 + 0.09 * i / STRIPS)));
      const depth = y / seaH;
      const sway = Math.sin(t * (0.5 + 0.13 * (i % 4)) + i * 1.9) * g.U * (0.3 + depth * 2.2);
      ctx.drawImage(ref, 0, y, g.W, h, sway, g.hz + y, g.W, h);
      ctx.drawImage(ref, 0, y, g.W, h, sway + (sway > 0 ? -g.W : g.W), g.hz + y, g.W, h);
      y += h;
    }
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const a = Math.min(1, state.cloudAlpha * amount);
    const off = -((t * g.U * 2.4) % c.width);
    ctx.globalAlpha = a * 0.75;
    ctx.drawImage(c, off, g.H * 0.02);
    ctx.drawImage(c, off + c.width, g.H * 0.02);
    // A lower band wraps the cone's waist.
    const off2 = -((t * g.U * 1.3 + c.width * 0.4) % c.width);
    ctx.globalAlpha = a * 0.85;
    ctx.drawImage(c, off2, g.H * 0.3, c.width, g.H * 0.14);
    ctx.drawImage(c, off2 + c.width, g.H * 0.3, c.width, g.H * 0.14);
    ctx.globalAlpha = 1;
  }

  // Long low swell lines drifting toward the shore.
  function drawSwells(ctx, g, t) {
    ctx.fillStyle = state.swell;
    const span = g.H - g.hz;
    const fade = 1 - state.dim * 0.5;
    for (let i = 0; i < SWELLS; i++) {
      const depth = ((i * 0.6180339 + t * 0.012) % 1);
      const y = g.hz + span * (0.02 + depth * depth * 0.96);
      const x = ((hash2(i, 1, 7) * g.W * 1.3 + t * g.U * (0.6 + depth * 1.6)) % (g.W * 1.3)) - g.W * 0.15;
      const w = g.U * (3 + depth * 16) * (0.6 + hash2(i, 2, 7));
      ctx.globalAlpha = (0.1 + 0.16 * depth) * smoothstep(0, 0.12, depth) * smoothstep(1, 0.85, depth) * fade;
      ctx.fillRect(x, y, w, Math.max(1, g.U * (0.2 + depth * 0.4)));
    }
    ctx.globalAlpha = 1;
  }

  // A path of light on the water below the sun or moon.
  function drawGlints(ctx, g, t) {
    ctx.fillStyle = state.glint;
    const span = g.H - g.hz;
    for (let i = 0; i < GLINTS; i++) {
      const depth = ((i * 0.381966 + t * 0.01) % 1);
      const y = g.hz + span * (0.03 + depth * 0.6);
      const spread = g.U * (2 + depth * 14);
      const x = state.lightX + (hash2(i, 8, 3) - 0.5) * 2 * spread + Math.sin(t * 0.4 + i) * g.U;
      ctx.globalAlpha = (0.45 + 0.3 * Math.sin(t * 0.6 + i * 2.3)) * (1 - depth * 0.7) * smoothstep(0, 0.08, depth);
      ctx.fillRect(x, y, g.U * (1 + depth * 4), Math.max(1, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function drawKelp(ctx, g, t) {
    ctx.strokeStyle = state.kelp;
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.lineCap = 'round';
    for (let i = 0; i < KELP; i++) {
      const x = g.W * (0.33 + 0.08 * i) + hash2(i, 4, 2) * g.U * 6;
      const y = g.H * (0.9 + hash2(i, 5, 2) * 0.07);
      const len = g.U * (6 + hash2(i, 6, 2) * 6);
      const s = Math.sin(t * 0.7 + i * 1.3) * g.U * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.33, y - g.U + s, x + len * 0.66, y + g.U - s, x + len, y + s * 0.4);
      ctx.stroke();
    }
  }

  function drawBuoy(ctx, g, t) {
    const x = g.W * 0.93;
    const y = g.H * 0.8 + Math.sin(t * 1.1) * g.U * 0.4;
    ctx.fillStyle = '#b8412c';
    ctx.beginPath();
    ctx.arc(x, y, g.U * 1.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = state.swell;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - g.U * 2, y + g.U * 0.2, g.U * 4, Math.max(1, g.U * 0.3));
    ctx.globalAlpha = 1;
  }

  function drawBoat(ctx, g, t) {
    const art = state.boatArt;
    const x = g.W * 0.12 + Math.sin(t * 0.04) * g.W * 0.04;
    const y = g.H * 0.67 + Math.sin(t * 0.9) * g.U * 0.35 - art.height * 0.85;
    ctx.save();
    ctx.translate(x + art.width / 2, y + art.height);
    ctx.rotate(Math.sin(t * 0.9 + 1) * 0.025);
    ctx.drawImage(art, -art.width / 2, -art.height);
    ctx.restore();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = state.swell;
    ctx.fillRect(x - g.U * 1.5, y + art.height * 0.92, art.width + g.U * 3, Math.max(1, g.U * 0.3));
    ctx.globalAlpha = 1;
  }

  function drawGull(ctx, g, t) {
    const p = (t % 45) / 45;
    const x = lerp(-g.W * 0.05, g.W * 1.05, p);
    const y = g.H * 0.46 + Math.sin(t * 0.5) * g.U * 2;
    const flap = Math.sin(t * 5) * g.U * 0.8;
    ctx.strokeStyle = state.dim > 0.5 ? '#9aa0b4' : '#ece8dc';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    ctx.moveTo(x - g.U * 1.8, y + flap);
    ctx.lineTo(x, y);
    ctx.lineTo(x + g.U * 1.8, y + flap);
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.hz = Math.round(g.H * HORIZON);
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.26));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.far, 0, 0);
    drawSea(ctx, g, t);
    drawClouds(ctx, g, t, props.clouds);
    drawSwells(ctx, g, t);
    drawGlints(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    drawBuoy(ctx, g, t);
    drawKelp(ctx, g, t);
    ctx.drawImage(state.shore, 0, 0);
    drawGull(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
