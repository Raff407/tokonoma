/*
 * 厳島 Itsukushima — the great vermilion torii standing in the sea at high tide.
 *
 * Gate, hills, shrine and shore are baked once and multiplied by the clock's sky
 * tint once a minute; after dark the gate takes a warm floodlight instead. The
 * sea is the picture above it redrawn in thin wavering strips, plus a short list
 * of glints, rings at the legs, one far boat and three gulls.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, smoothstep, mixColor, toHex } = K;

  const HORIZON = 0.5;
  const BASE = 0.68;
  const RETINT_SECONDS = 60;
  const GLINTS = 150;
  const BOAT_PERIOD = 150;
  const BOAT_CROSSING = 115;
  const FLOOD = [255, 214, 166];
  const LAMP = '#f3c47c';
  const V = { lit: '#e56c45', body: '#cf4b2d', shade: '#a33a22', deep: '#6e2c20' };
  const CAP = '#3b3534';
  const CAP_EDGE = '#615856';
  const GULLS = [
    { y: 0.21, size: 3.4, speed: 2.1, dir: 1, off: 0.1 },
    { y: 0.31, size: 2.6, speed: 1.7, dir: -1, off: 0.55 },
    { y: 0.12, size: 2.1, speed: 1.4, dir: 1, off: 0.8 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function quad(ctx, a, b, c, d) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.fill();
  }

  function bump(x, centre, width) {
    const d = (x - centre) / width;
    return Math.exp(-d * d);
  }

  function mul(rgb, tintColour) {
    return toHex([0, 1, 2].map((i) => (rgb[i] * tintColour[i]) / 255));
  }

  function paintGlow(radius, rgb) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.8)`);
    grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  // ---- the gate -----------------------------------------------------------

  function paintPillar(ctx, x, bottom, top, w, lean) {
    const wt = w * 0.84;
    ctx.fillStyle = V.body;
    quad(ctx, [x - w / 2, bottom], [x + lean - wt / 2, top], [x + lean + wt / 2, top], [x + w / 2, bottom]);
    ctx.fillStyle = V.shade;
    quad(ctx, [x + w * 0.15, bottom], [x + lean + wt * 0.15, top], [x + lean + wt / 2, top], [x + w / 2, bottom]);
    ctx.fillStyle = V.lit;
    quad(ctx, [x - w * 0.36, bottom], [x + lean - wt * 0.36, top], [x + lean - wt * 0.14, top], [x - w * 0.14, bottom]);
    ctx.fillStyle = V.deep;
    ctx.fillRect(x - w / 2, bottom - w * 0.45, w, w * 0.45);
  }

  function paintBeam(ctx, x0, x1, top, h) {
    const w = x1 - x0;
    ctx.fillStyle = V.body;
    ctx.fillRect(x0, top, w, h);
    ctx.fillStyle = V.lit;
    ctx.fillRect(x0, top, w, Math.max(1, h * 0.3));
    ctx.fillStyle = V.shade;
    ctx.fillRect(x0, top + h * 0.66, w, h * 0.34);
  }

  // A small leg of the ryobu gate. Seen a little from one side, the front leg
  // stands nearer (lower on the picture) and the back one farther.
  function paintLeg(ctx, f, px, front) {
    const u = f.u;
    const x = px + (front ? -6.4 : 6.4) * u;
    const bottom = f.base + (front ? 1.2 : -1.2) * u;
    const top = bottom - 15 * u;
    paintPillar(ctx, x, bottom, top, 2.6 * u, 0);
    ctx.fillStyle = CAP;
    quad(ctx, [x - 2.7 * u, top + 0.5 * u], [x - 1.1 * u, top - 1.5 * u], [x + 1.1 * u, top - 1.5 * u], [x + 2.7 * u, top + 0.5 * u]);
    return { x, y: bottom, w: 2.6 * u };
  }

  function paintTie(ctx, u, a, b, above, h) {
    const x0 = a.x - 1.8 * u;
    const x1 = b.x + 1.8 * u;
    const y0 = a.y - above;
    const y1 = b.y - above;
    ctx.fillStyle = V.body;
    quad(ctx, [x0, y0 - h], [x1, y1 - h], [x1, y1], [x0, y0]);
    ctx.fillStyle = V.shade;
    quad(ctx, [x0, y0 - h * 0.35], [x1, y1 - h * 0.35], [x1, y1], [x0, y0]);
  }

  function band(ctx, cx, reach, topY, botY) {
    const n = 32;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = -reach + (2 * reach * i) / n;
      ctx.lineTo(cx + x, topY(x));
    }
    for (let i = n; i >= 0; i--) {
      const x = -reach + (2 * reach * i) / n;
      ctx.lineTo(cx + x, botY(x));
    }
    ctx.fill();
  }

  // Top beam with upswept ends and its dark cap, and the straight beam under it.
  function paintKasagi(ctx, f) {
    const u = f.u;
    const span = 39 * u;
    const under = f.base - 49.6 * u;
    const rise = (x) => 3.6 * u * Math.pow(Math.abs(x) / span, 2.4);
    const capTop = (x) => under - 2.6 * u - rise(x) * 1.18 - u * (2.3 - 1.3 * Math.pow(x / span, 2));
    ctx.fillStyle = V.deep;
    ctx.fillRect(f.cx - 35 * u, under, 70 * u, 0.7 * u);
    paintBeam(ctx, f.cx - 35 * u, f.cx + 35 * u, under + 0.6 * u, 2.7 * u);
    ctx.fillStyle = V.body;
    band(ctx, f.cx, span, (x) => under - 2.6 * u - rise(x) * 1.1, (x) => under - rise(x));
    ctx.fillStyle = V.shade;
    band(ctx, f.cx, span, (x) => under - 0.9 * u - rise(x) * 1.03, (x) => under - rise(x));
    ctx.fillStyle = CAP;
    band(ctx, f.cx, span * 1.05, capTop, (x) => under - 2.4 * u - rise(x) * 1.1);
    ctx.fillStyle = CAP_EDGE;
    band(ctx, f.cx, span * 1.03, capTop, (x) => capTop(x) + Math.max(1, 0.55 * u));
  }

  function paintStrut(ctx, f) {
    const u = f.u;
    paintBeam(ctx, f.cx - 27.5 * u, f.cx + 27.5 * u, f.base - 37 * u, 3 * u);
    ctx.fillStyle = V.body;
    ctx.fillRect(f.cx - 1.1 * u, f.base - 46.6 * u, 2.2 * u, 9.8 * u);
    ctx.fillStyle = CAP;
    ctx.fillRect(f.cx - 3.3 * u, f.base - 45.8 * u, 6.6 * u, 7.6 * u);
    ctx.fillStyle = '#2b3550';
    ctx.fillRect(f.cx - 2.5 * u, f.base - 45 * u, 5 * u, 6 * u);
    ctx.strokeStyle = '#c9a54e';
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.strokeRect(f.cx - 2.9 * u, f.base - 45.4 * u, 5.8 * u, 6.8 * u);
  }

  function paintTorii(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const f = { cx: g.W * 0.5, base: g.base, u };
    const feet = [];
    paintStrut(ctx, f);
    for (const side of [-1, 1]) {
      const px = f.cx + side * 16.5 * u;
      const back = paintLeg(ctx, f, px, false);
      const front = { x: px - 6.4 * u, y: f.base + 1.2 * u, w: 2.6 * u };
      paintTie(ctx, u, front, back, 13.4 * u, 1.5 * u);
      paintTie(ctx, u, front, back, 5 * u, 1.3 * u);
      paintPillar(ctx, px, f.base, f.base - 49 * u, 4.6 * u, -side * 0.9 * u);
      paintLeg(ctx, f, px, true);
      feet.push(back, { x: px, y: f.base, w: 4.6 * u }, front);
    }
    paintKasagi(ctx, f);
    state.feet = feet;
    return c;
  }

  // ---- hills, shrine, shore -------------------------------------------------

  function farRidge(g, x) {
    const xn = x / g.W;
    const n = fbm((x / g.U) * 0.045, 1.7, 5, 21);
    return g.H * (HORIZON - 0.05 - 0.18 * bump(xn, 0.3, 0.19) - 0.13 * bump(xn, 0.75, 0.2) - 0.1 * n);
  }

  function midRidge(g, x) {
    const xn = x / g.W;
    const n = fbm((x / g.U) * 0.05, 3.1, 4, 27);
    return g.H * (HORIZON - 0.03 - 0.09 * bump(xn, 0.6, 0.16) - 0.07 * bump(xn, 0.1, 0.14) - 0.05 * n);
  }

  function nearRidge(g, x) {
    const xn = x / g.W;
    const n = fbm((x / g.U) * 0.06, 4.2, 4, 33);
    return g.H * (HORIZON - 0.015 - 0.06 * bump(xn, 0.04, 0.16) - 0.05 * bump(xn, 0.95, 0.14) - 0.03 * n);
  }

  function paintSilhouette(ctx, g, rand, ridge, tone) {
    const u = g.U;
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, g.line + 1);
    for (let x = 0; x <= g.W + 1; x += 1) ctx.lineTo(x, ridge(g, x));
    ctx.lineTo(g.W + 1, g.line + 1);
    ctx.fill();
    for (let x = 0; x < g.W; x += u * (0.8 + rand() * 0.8)) {
      const r = u * (0.6 + rand() * 0.9);
      ctx.beginPath();
      ctx.arc(x, ridge(g, x) + r * 0.7, r, 0, 6.283);
      ctx.fill();
    }
  }

  // Tree crowns in small clusters of varied size, then a few dark gullies.
  function paintForest(g, rand, ridge, tones, density) {
    const c = layer(g.W, g.line + 1);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintSilhouette(ctx, g, rand, ridge, tones[0]);
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < g.W * density; i++) {
      const x = rand() * g.W;
      const top = ridge(g, x);
      const y = lerp(top, g.line, Math.pow(rand(), 0.8));
      ctx.fillStyle = tones[1 + Math.floor(rand() * (tones.length - 1))];
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * 3 * u, y + (rand() - 0.5) * 1.6 * u, u * (0.35 + rand() * 0.9), 0, 6.283);
        ctx.fill();
      }
    }
    ctx.strokeStyle = tones[tones.length - 1];
    ctx.lineWidth = Math.max(1, u * 0.7);
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < g.W * 0.05; i++) {
      const x = rand() * g.W;
      ctx.beginPath();
      ctx.moveTo(x, ridge(g, x) + u * 2);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 4 * u, lerp(ridge(g, x), g.line, 0.5), x + (rand() - 0.5) * 8 * u, g.line);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintShrine(ctx, g) {
    const u = g.U;
    const cx = g.W * 0.5;
    const y = g.line;
    const halls = [[-52, -35, 1], [-31, -14, 1.3], [-9, 9, 2.2], [14, 31, 1.3], [35, 52, 1]];
    const lights = [];
    for (const [a, b, h] of halls) {
      const x0 = cx + a * u;
      const x1 = cx + b * u;
      const wall = h * 1.3 * u;
      const eave = y - 0.7 * u - wall;
      ctx.fillStyle = '#5e4c3e';
      ctx.fillRect(x0 - u, y - 0.8 * u, x1 - x0 + 2 * u, 0.9 * u);
      ctx.fillStyle = V.body;
      ctx.fillRect(x0, eave, x1 - x0, wall);
      ctx.fillStyle = '#e6dcc8';
      for (let x = x0 + u; x < x1 - u; x += 2.4 * u) ctx.fillRect(x, eave + wall * 0.25, u, wall * 0.5);
      ctx.fillStyle = '#5c4e47';
      quad(ctx, [x0 - 1.6 * u, eave], [x0 + 0.8 * u, eave - h * 1.2 * u], [x1 - 0.8 * u, eave - h * 1.2 * u], [x1 + 1.6 * u, eave]);
      for (let x = x0 + 2 * u; x < x1; x += 5 * u) lights.push({ x, y: eave + wall * 0.4 });
    }
    state.shrineLights = lights;
  }

  function paintShrineLayer(g) {
    const c = layer(g.W, g.line + 1);
    paintShrine(c.getContext('2d'), g);
    return c;
  }

  function wallTop(g, x) {
    return g.H * (0.9 + 0.036 * Math.pow(1 - x / g.W, 1.5));
  }

  function paintWall(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#6f695f';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 1; x += 2) ctx.lineTo(x, wallTop(g, x));
    ctx.lineTo(g.W + 1, g.H);
    ctx.fill();
    ctx.fillStyle = '#a29c8e';
    ctx.beginPath();
    for (let x = 0; x <= g.W + 1; x += 2) ctx.lineTo(x, wallTop(g, x) - 0.2 * u);
    for (let x = g.W + 1; x >= 0; x -= 2) ctx.lineTo(x, wallTop(g, x) + 1.4 * u);
    ctx.fill();
    ctx.fillStyle = '#48443e';
    for (let x = rand() * 4 * u; x < g.W; x += u * (4 + rand() * 3)) {
      ctx.fillRect(x, wallTop(g, x) - 0.2 * u, Math.max(1, 0.4 * u), 1.6 * u);
      ctx.fillRect(x + u * 2, wallTop(g, x) + 3.2 * u, Math.max(1, 0.4 * u), g.H);
    }
    ctx.globalAlpha = 0.7;
    for (let x = 0; x < g.W; x += 2) ctx.fillRect(x, wallTop(g, x) + 3 * u, 2, Math.max(1, 0.4 * u));
    ctx.globalAlpha = 1;
  }

  function paintLanternBody(ctx, x, y, s) {
    ctx.fillStyle = '#7f7a6f';
    quad(ctx, [x - 4 * s, y], [x - 3 * s, y - 1.8 * s], [x + 3 * s, y - 1.8 * s], [x + 4 * s, y]);
    ctx.fillStyle = '#a39e91';
    quad(ctx, [x - 4 * s, y], [x - 3 * s, y - 1.8 * s], [x + 0.4 * s, y - 1.8 * s], [x + 0.6 * s, y]);
    ctx.fillRect(x - 1.2 * s, y - 8 * s, 2.4 * s, 6.4 * s);
    ctx.fillStyle = '#7f7a6f';
    ctx.fillRect(x + 0.3 * s, y - 8 * s, 0.9 * s, 6.4 * s);
    ctx.fillStyle = '#bdb8aa';
    ctx.fillRect(x - 1.7 * s, y - 5.4 * s, 3.4 * s, 0.8 * s);
    ctx.fillStyle = '#9a9588';
    quad(ctx, [x - 1.9 * s, y - 7.8 * s], [x - 3.7 * s, y - 9.8 * s], [x + 3.7 * s, y - 9.8 * s], [x + 1.9 * s, y - 7.8 * s]);
    ctx.fillStyle = '#a39e91';
    ctx.fillRect(x - 2.7 * s, y - 13.6 * s, 5.4 * s, 3.8 * s);
    ctx.fillStyle = '#7f7a6f';
    ctx.fillRect(x + 1.3 * s, y - 13.6 * s, 1.4 * s, 3.8 * s);
    ctx.fillStyle = '#34302c';
    ctx.fillRect(x - 1.4 * s, y - 12.9 * s, 2.4 * s, 2.4 * s);
  }

  function paintLanternRoof(ctx, x, y, s) {
    ctx.fillStyle = '#8c877b';
    ctx.beginPath();
    ctx.moveTo(x - 5.8 * s, y - 13 * s);
    ctx.lineTo(x - 4.6 * s, y - 14.2 * s);
    ctx.lineTo(x - 1.2 * s, y - 16.6 * s);
    ctx.lineTo(x + 1.2 * s, y - 16.6 * s);
    ctx.lineTo(x + 4.6 * s, y - 14.2 * s);
    ctx.lineTo(x + 5.8 * s, y - 13 * s);
    ctx.lineTo(x + 4.2 * s, y - 13.4 * s);
    ctx.lineTo(x - 4.2 * s, y - 13.4 * s);
    ctx.fill();
    ctx.fillStyle = '#6e6a60';
    quad(ctx, [x + 0.4 * s, y - 16.6 * s], [x + 1.2 * s, y - 16.6 * s], [x + 4.6 * s, y - 14.2 * s], [x + 2.4 * s, y - 13.4 * s]);
    ctx.fillStyle = '#6d7a52';
    ctx.fillRect(x - 3.6 * s, y - 14.6 * s, 2.2 * s, 0.7 * s);
    ctx.fillRect(x - 3.4 * s, y - 1.2 * s, 2.6 * s, 0.8 * s);
    ctx.fillStyle = '#a39e91';
    ctx.fillRect(x - 0.6 * s, y - 17.6 * s, 1.2 * s, 1.2 * s);
    ctx.beginPath();
    ctx.arc(x, y - 18.5 * s, 1.1 * s, 0, 6.283);
    ctx.fill();
  }

  function paintShore(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    const windows = [];
    for (const [fx, scale] of [[0.065, 1.15], [0.2, 0.98], [0.915, 0.86]]) {
      const x = g.W * fx;
      const s = g.U * scale;
      const y = wallTop(g, x) + 0.6 * s;
      paintLanternBody(ctx, x, y, s);
      paintLanternRoof(ctx, x, y, s);
      windows.push({ x: x - 1.4 * s, y: y - 12.9 * s, w: 2.4 * s, h: 2.4 * s, cx: x - 0.2 * s, cy: y - 11.7 * s, r: 7 * s });
    }
    state.windows = windows;
    return c;
  }

  // ---- sky ----------------------------------------------------------------

  function paintCloudMask(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.06, 4, 13);
    for (let y = 0; y < h; y++) {
      const fade = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = (Math.round(smoothstep(0.42, 0.64, v) * fade * 3) / 3) * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function tint(source, colour) {
    const c = layer(source.width, source.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = toHex(colour);
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(source, 0, 0);
    return c;
  }

  function brighten(source, amount) {
    if (amount <= 0.01) return source;
    const c = layer(source.width, source.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = amount;
    ctx.drawImage(source, 0, 0);
    return c;
  }

  function moonX(g, sky) {
    return g.W * lerp(0.84, 0.16, S.moonT(sky.hour));
  }

  function sunX(g, sky) {
    return g.W * lerp(0.12, 0.88, S.sunT(sky.hour));
  }

  // Only near the ends of the day, low and warm, half behind the hills.
  function paintSun(ctx, g, sky, gold) {
    const t = S.sunT(sky.hour);
    const x = sunX(g, sky);
    const y = g.line - (0.12 + Math.sin(Math.PI * t) * 0.4) * g.H;
    const r = g.U * 3.2;
    const halo = ctx.createRadialGradient(x, y, r, x, y, r * 7);
    halo.addColorStop(0, 'rgba(250,214,150,0.45)');
    halo.addColorStop(1, 'rgba(250,214,150,0)');
    ctx.globalAlpha = Math.min(1, gold) * (1 - sky.night * 0.6);
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    ctx.fillStyle = '#f8dc9c';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintMoon(ctx, g, sky) {
    const t = S.moonT(sky.hour);
    const x = moonX(g, sky);
    const y = g.H * (0.065 + 0.2 * (1 - Math.sin(Math.PI * t)));
    const r = g.U * 2.8;
    const halo = ctx.createRadialGradient(x, y, r, x, y, r * 5);
    halo.addColorStop(0, 'rgba(226,228,214,0.3)');
    halo.addColorStop(1, 'rgba(226,228,214,0)');
    ctx.globalAlpha = sky.night;
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    ctx.fillStyle = '#ece6cc';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintBackdrop(g, sky, top, low, gold) {
    const c = layer(g.W, g.line);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.line);
    grad.addColorStop(0, toHex(top));
    grad.addColorStop(1, toHex(low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.line);
    if (sky.night > 0.1) {
      const rand = K.rng(3);
      ctx.fillStyle = '#e4e3d8';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.line * 0.7, 1, 1);
      }
      ctx.globalAlpha = 1;
      paintMoon(ctx, g, sky);
    }
    if (gold > 0.05 && sky.night < 0.8) paintSun(ctx, g, sky, gold);
    return c;
  }

  function paintSea(g, top, low, gold) {
    const h = g.H - g.line;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const near = mixColor(mixColor(low, [46, 78, 92], 0.38), [232, 178, 96], gold * 0.8);
    const far = mixColor(mixColor(mixColor(top, low, 0.4), [24, 46, 60], 0.5), [150, 104, 70], gold * 0.4);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, toHex(near));
    grad.addColorStop(1, toHex(far));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, h);
    return c;
  }

  function goldness(h) {
    return Math.max(0, 1 - Math.abs(h - 17.9) / 1.6) + 0.6 * Math.max(0, 1 - Math.abs(h - 6.6) / 1.2);
  }

  function retintColours(sky, gold) {
    const night = sky.night;
    const amb = mixColor(sky.amb, [128, 138, 176], night * 0.3);
    const pale = mixColor(mixColor(sky.low, [255, 248, 230], 0.55), [255, 208, 124], gold);
    state.glintColour = toHex(mixColor(pale, [196, 204, 226], night));
    state.glintAlpha = 0.5 + gold * 0.3 - night * 0.15;
    state.foamColour = mul([238, 238, 228], mixColor(amb, FLOOD, night * 0.6));
    state.gullColour = mul([242, 240, 232], amb);
    state.gullAlpha = 1 - night;
    state.boat = { hull: mul([78, 64, 52], amb), rail: mul([150, 126, 96], amb), man: mul([56, 52, 58], amb) };
    state.boat.sail = mul([228, 218, 194], amb);
    state.boat.seam = mul([170, 158, 136], amb);
    state.backAlpha = 0.45 + night * 0.1;
    state.toriiAlpha = 0.5 + night * 0.12;
  }

  function retint(g, choice) {
    const sky = S.at(S.hour(choice));
    const night = sky.night;
    const gold = goldness(sky.hour);
    state.sky = sky;
    const top = mixColor(sky.top, [50, 60, 108], night * 0.8);
    const low = mixColor(sky.low, [128, 132, 180], night * 0.8);
    state.backdrop = paintBackdrop(g, sky, top, low, gold);
    state.pathX = night > 0.5 ? moonX(g, sky) : sunX(g, sky);
    state.sea = paintSea(g, top, low, gold);
    state.tintedCloud = tint(state.cloudMask, mixColor(sky.amb, sky.haze, 0.3));
    const haze = mixColor(sky.haze, [96, 128, 116], 0.3);
    state.far = tint(state.farMask, mixColor(haze, [54, 60, 98], night));
    state.mid = tint(state.midMask, mixColor(mixColor(sky.amb, haze, 0.45), [80, 84, 140], night));
    state.shrine = tint(state.shrineMask, mixColor(sky.amb, [236, 190, 150], night));
    state.near = tint(state.nearMask, mixColor(sky.amb, [90, 92, 150], night));
    state.torii = brighten(tint(state.toriiMask, mixColor(sky.amb, FLOOD, night)), night * 0.45);
    state.fg = tint(state.fgMask, mixColor(sky.amb, [140, 146, 186], night * 0.6));
    retintColours(sky, gold);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion -------------------------------------------------------------

  function makeGlints(g, rand) {
    const G = { x: new Float32Array(GLINTS), y: new Float32Array(GLINTS), len: new Float32Array(GLINTS) };
    G.rate = new Float32Array(GLINTS);
    G.phase = new Float32Array(GLINTS);
    G.drift = new Float32Array(GLINTS);
    G.path = new Uint8Array(GLINTS);
    for (let i = 0; i < GLINTS; i++) {
      const f = Math.pow(rand(), 1.2);
      const central = i % 3 === 0;
      G.path[i] = i % 3 === 1 ? 1 : 0;
      G.y[i] = g.line + 1 + f * (g.H * 0.91 - g.line);
      G.x[i] = central ? g.W * 0.5 + (rand() - 0.5) * 50 * g.U : rand() * (g.W + 8 * g.U);
      if (G.path[i]) G.x[i] = (rand() - 0.5) * (4 + f * 26) * g.U;
      G.len[i] = Math.max(1, g.U * (0.8 + f * 3.4 + rand()));
      G.rate[i] = 0.5 + rand() * 0.8;
      G.phase[i] = rand() * 6.283;
      G.drift[i] = g.U * (0.1 + f * 0.5);
    }
    return G;
  }

  function drawBack(b, g, t, props) {
    b.drawImage(state.backdrop, 0, 0);
    const w = state.tintedCloud.width;
    const x = -((t * g.U * 1.2 * props.clouds) % w);
    b.globalAlpha = Math.min(1, props.clouds);
    b.drawImage(state.tintedCloud, x, g.H * 0.04);
    b.drawImage(state.tintedCloud, x + w, g.H * 0.04);
    b.globalAlpha = 1;
    b.drawImage(state.far, 0, 0);
    b.drawImage(state.mid, 0, 0);
    b.drawImage(state.near, 0, 0);
    b.drawImage(state.shrine, 0, 0);
    const night = state.sky.night;
    if (night > 0.05) {
      b.fillStyle = LAMP;
      for (let i = 0; i < state.shrineLights.length; i++) {
        const l = state.shrineLights[i];
        b.globalAlpha = night * (0.75 + 0.25 * Math.sin(t * 0.7 + i * 1.9));
        b.fillRect(l.x, l.y, Math.max(1, g.U * 1.2), Math.max(1, g.U * 1.2));
      }
      b.globalAlpha = 1;
    }
  }

  function drawSea(ctx, g, t, props) {
    ctx.drawImage(state.sea, 0, g.line);
    const sh = state.strip;
    ctx.globalAlpha = state.backAlpha;
    for (let i = 0; i < state.backStrips; i++) {
      const srcY = g.line - (i + 1) * sh;
      if (srcY < 0) break;
      const f = i / state.backStrips;
      const wob = Math.sin(t * 0.8 + i * 1.3) * g.U * (0.2 + f * 1.2) * props.waves;
      ctx.drawImage(state.buffer, 0, srcY, g.W, sh, wob, g.line + i * sh, g.W, sh + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  function drawToriiReflection(ctx, g, t, props) {
    const sh = state.strip;
    const n = state.toriiStrips;
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const wave = Math.sin(t * 0.9 + i * 0.7) + 0.6 * Math.sin(t * 1.7 - i * 1.9);
      const wob = wave * g.U * (0.5 + f * 1.6) * props.waves;
      ctx.globalAlpha = state.toriiAlpha * (1 - f * 0.55) * (0.6 + 0.4 * Math.sin(t * 0.6 + i * 2.1));
      ctx.drawImage(state.torii, 0, g.base - (i + 1) * sh, g.W, sh, wob, g.base + i * sh, g.W, sh + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t, props) {
    const G = state.glints;
    const span = g.W + 8 * g.U;
    const strength = state.glintAlpha * Math.min(1.5, props.waves);
    ctx.fillStyle = state.glintColour;
    for (let i = 0; i < GLINTS; i++) {
      const s = Math.sin(t * G.rate[i] + G.phase[i]);
      if (s <= 0.25) continue;
      ctx.globalAlpha = Math.min(1, (s - 0.25) * strength);
      const x = G.path[i] ? state.pathX + G.x[i] - G.len[i] / 2 : ((G.x[i] + t * G.drift[i]) % span) - 4 * g.U;
      ctx.fillRect(x, G.y[i], G.len[i], 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawFoam(ctx, g, t, props) {
    ctx.strokeStyle = state.foamColour;
    ctx.fillStyle = state.foamColour;
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    const amount = Math.min(1, props.waves);
    for (let i = 0; i < state.feet.length; i++) {
      const foot = state.feet[i];
      ctx.globalAlpha = amount * (0.5 + 0.25 * state.sky.night + 0.2 * Math.sin(t * 1.3 + i));
      ctx.fillRect(foot.x - foot.w * 0.6, foot.y - g.U * 0.3, foot.w * 1.2, Math.max(1, g.U * 0.5));
      for (let k = 0; k < 2; k++) {
        const ring = (t * 0.3 + k * 0.5 + i * 0.37) % 1;
        ctx.globalAlpha = (1 - ring) * 0.55 * amount;
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y, foot.w * 0.6 + ring * g.U * 3.4, g.U * (0.35 + ring * 0.8), 0, 0, Math.PI);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawGate(ctx, g, t, props) {
    const night = state.sky.night;
    if (night > 0.05) {
      const w = 96 * g.U;
      const h = 44 * g.U;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = night * 0.28;
      ctx.drawImage(state.floodGlow, g.W * 0.5 - w / 2, g.base - h * 0.6, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(state.torii, 0, 0);
    drawFoam(ctx, g, t, props);
  }

  function drawBoat(ctx, g, t) {
    const phase = (t + 25) % BOAT_PERIOD;
    if (phase > BOAT_CROSSING) return;
    const u = g.U;
    const x = lerp(-8 * u, g.W + 8 * u, phase / BOAT_CROSSING);
    const y = g.line + 3.4 * g.U + Math.sin(t * 1.1) * g.U * 0.15;
    const C = state.boat;
    ctx.fillStyle = C.hull;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - 4.4 * u, y + 0.5 * u, 8.8 * u, 1.6 * u);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x - 5 * u, y - 1.2 * u);
    ctx.lineTo(x + 4.6 * u, y - 1.2 * u);
    ctx.lineTo(x + 6 * u, y - 2.3 * u);
    ctx.lineTo(x + 4 * u, y + 0.4 * u);
    ctx.lineTo(x - 4.2 * u, y + 0.4 * u);
    ctx.fill();
    ctx.fillStyle = C.rail;
    ctx.fillRect(x - 5 * u, y - 1.3 * u, 9.6 * u, Math.max(1, 0.4 * u));
    ctx.fillRect(x + 0.3 * u, y - 10 * u, Math.max(1, 0.4 * u), 8.8 * u);
    const belly = Math.sin(t * 0.4) * 0.3 * u;
    ctx.fillStyle = C.sail;
    quad(ctx, [x - 2.8 * u + belly, y - 1.8 * u], [x - 2.2 * u, y - 9.4 * u], [x + 3.4 * u, y - 9.4 * u], [x + 4 * u + belly, y - 1.8 * u]);
    ctx.fillStyle = C.seam;
    ctx.fillRect(x - 0.9 * u, y - 9.4 * u, Math.max(1, 0.3 * u), 7.6 * u);
    ctx.fillRect(x + 1.6 * u, y - 9.4 * u, Math.max(1, 0.3 * u), 7.6 * u);
    ctx.fillStyle = C.man;
    ctx.fillRect(x - 4.2 * u, y - 4.2 * u, 1.2 * u, 3 * u);
    quad(ctx, [x - 4.9 * u, y - 4.1 * u], [x - 3.6 * u, y - 5.3 * u], [x - 3.6 * u, y - 5.3 * u], [x - 2.3 * u, y - 4.1 * u]);
    if (state.sky.night > 0.1) {
      ctx.fillStyle = LAMP;
      ctx.globalAlpha = state.sky.night;
      ctx.fillRect(x + 3.4 * u, y - 3 * u, Math.max(1, u), Math.max(1, u));
      ctx.globalAlpha = 1;
    }
  }

  function drawShore(ctx, g, t) {
    ctx.drawImage(state.fg, 0, 0);
    const night = state.sky.night;
    if (night < 0.05) return;
    for (const w of state.windows) {
      const breathe = 0.86 + 0.14 * Math.sin(t * 0.8 + w.x);
      ctx.globalAlpha = night * breathe;
      ctx.fillStyle = LAMP;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = night * 0.5 * breathe;
      ctx.drawImage(state.lampGlow, w.cx - w.r, w.cy - w.r, w.r * 2, w.r * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  function drawGulls(ctx, g, t) {
    if (state.gullAlpha <= 0.02) return;
    ctx.strokeStyle = state.gullColour;
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    ctx.lineCap = 'round';
    ctx.globalAlpha = state.gullAlpha;
    const span = g.W + 24 * g.U;
    for (let i = 0; i < GULLS.length; i++) {
      const b = GULLS[i];
      const s = b.size * g.U;
      let x = ((t * b.speed * g.U + b.off * span) % span) - 12 * g.U;
      if (b.dir < 0) x = g.W - x;
      const y = g.H * b.y + Math.sin(t * 0.23 + i * 2) * g.U * 3;
      const beat = smoothstep(0.55, 0.9, Math.sin(t * 0.19 + i * 1.7)) * Math.sin(t * 4.2 + i);
      const lift = s * (0.32 + beat * 0.35);
      const tip = s * (0.18 - beat * 0.4);
      ctx.beginPath();
      ctx.moveTo(x - s, y + tip);
      ctx.quadraticCurveTo(x - s * 0.45, y - lift, x, y);
      ctx.quadraticCurveTo(x + s * 0.45, y - lift, x + s, y + tip);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.line = Math.round(g.H * HORIZON);
    g.base = Math.round(g.H * BASE);
    state.g = g;
    state.farMask = paintForest(g, K.rng(11), farRidge, ['#ccd5d0', '#bcc7c2', '#dae0da', '#c4ceca', '#aab6b2'], 0.9);
    state.midMask = paintForest(g, K.rng(12), midRidge, ['#6f8f6a', '#5f8060', '#7f9c72', '#648466', '#4f6e54'], 1.2);
    state.nearMask = paintForest(g, K.rng(13), nearRidge, ['#567a55', '#476c4a', '#668a5c', '#3c5c42', '#33503a'], 1.6);
    state.shrineMask = paintShrineLayer(g);
    state.toriiMask = paintTorii(g);
    state.fgMask = paintShore(g, K.rng(14));
    state.cloudMask = paintCloudMask(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.3));
    state.buffer = layer(g.W, g.line);
    state.strip = Math.max(1, g.U);
    state.backStrips = Math.ceil((g.H - g.line) / state.strip);
    state.toriiStrips = Math.ceil((g.H - g.base) / state.strip);
    state.glints = makeGlints(g, K.rng(15));
    state.floodGlow = paintGlow(48, FLOOD);
    state.lampGlow = paintGlow(24, [243, 196, 124]);
    retint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) retint(g, props.time);
    drawBack(state.buffer.getContext('2d'), g, t, props);
    ctx.drawImage(state.buffer, 0, 0);
    drawSea(ctx, g, t, props);
    drawBoat(ctx, g, t);
    drawToriiReflection(ctx, g, t, props);
    drawGlints(ctx, g, t, props);
    drawGate(ctx, g, t, props);
    drawShore(ctx, g, t);
    drawGulls(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', waves: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
