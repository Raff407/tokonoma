/*
 * 馬 Uma — wild horses and a foal on a misty upland at dawn.
 *
 * Land, sky and each horse's body are baked once. Per frame a horse only adds
 * its neck, head, mane and tail as a few dozen paths, and the grass is a few
 * batched strokes bent by one travelling wave, so the cost stays small.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, parseColor, mixColor, toHex } = K;

  const TAU = Math.PI * 2;
  const MIST = '#efe0c8';
  const STRIPS = 30;
  const GUST_W = 360;
  const GUST_H = 14;
  const FIELD_TOP = 0.57;

  const COATS = {
    bay: { base: '#855030', shade: '#57331f', light: '#ad7342', rim: '#e6b980', dark: '#2e2529', hoof: '#2b2628', muzzle: '#47322a' },
    roan: { base: '#68666a', shade: '#46454f', light: '#8f8c8c', rim: '#e0cfae', dark: '#2c2c35', hoof: '#2e2e34', muzzle: '#3f3d44' },
    foal: { base: '#b98c5a', shade: '#86613f', light: '#d8b27e', rim: '#f0d9aa', dark: '#6b4c33', hoof: '#55453a', muzzle: '#8a6f55' },
  };

  // Everything below is in horse units: withers height is 1, the ground is
  // y = 0, the horse faces +x. Baking and drawing share these numbers.
  const BODY = [
    [0.30, 1.0], [0.12, 0.955], [-0.08, 0.945], [-0.28, 0.995], [-0.44, 0.975], [-0.55, 0.88], [-0.585, 0.75],
    [-0.5, 0.6], [-0.3, 0.52], [-0.12, 0.5], [0.12, 0.475], [0.3, 0.5], [0.46, 0.6], [0.53, 0.72], [0.5, 0.86], [0.42, 0.96],
  ];
  const LEGS = {
    nearHind: [[-0.38, 0.74, 0.17], [-0.4, 0.5, 0.115], [-0.5, 0.34, 0.058], [-0.49, 0.24, 0.04], [-0.47, 0.1, 0.036], [-0.44, 0.045, 0.038]],
    nearFore: [[0.32, 0.64, 0.13], [0.33, 0.5, 0.085], [0.36, 0.31, 0.052], [0.355, 0.22, 0.036], [0.355, 0.1, 0.036], [0.385, 0.045, 0.038]],
    farHind: [[-0.28, 0.72, 0.12], [-0.25, 0.5, 0.095], [-0.33, 0.33, 0.05], [-0.32, 0.22, 0.034], [-0.3, 0.1, 0.032], [-0.27, 0.045, 0.034]],
    farFore: [[0.38, 0.64, 0.11], [0.46, 0.48, 0.072], [0.54, 0.31, 0.046], [0.56, 0.2, 0.032], [0.58, 0.1, 0.032], [0.62, 0.045, 0.034]],
  };
  const WITHERS = [0.3, 1.0];
  const CHEST = [0.5, 0.67];
  const NECK_BASE = [0.4, 0.82];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function hex(a, b, t) {
    return toHex(mixColor(parseColor(a), parseColor(b), t));
  }

  function closedCurve(path, pts) {
    const n = pts.length;
    path.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    path.closePath();
  }

  function shapePath(pts) {
    const path = new Path2D();
    closedCurve(path, pts);
    return path;
  }

  // Unit head: x runs poll to muzzle, y runs towards the jaw.
  const HEAD = shapePath([
    [-0.04, 0.03], [0.1, -0.05], [0.28, -0.07], [0.55, -0.03], [0.8, -0.01], [0.95, 0.0], [1.02, 0.1], [0.99, 0.21],
    [0.87, 0.27], [0.72, 0.21], [0.5, 0.26], [0.28, 0.44], [0.08, 0.4], [-0.05, 0.22],
  ]);
  const CHEEK = shapePath([[0.12, 0.2], [0.3, 0.14], [0.46, 0.2], [0.34, 0.4], [0.14, 0.38]]);
  const JAW_SHADE = shapePath([[0.02, 0.3], [0.28, 0.36], [0.5, 0.2], [0.8, 0.18], [0.88, 0.28], [0.72, 0.22], [0.5, 0.27], [0.28, 0.46], [0.06, 0.42]]);
  const MUZZLE = shapePath([[0.72, -0.01], [0.95, 0.0], [1.03, 0.1], [1.0, 0.22], [0.87, 0.28], [0.72, 0.22]]);
  const BLAZE = shapePath([[0.22, -0.06], [0.5, -0.03], [0.82, 0.0], [0.82, 0.05], [0.5, 0.03], [0.25, 0.0]]);
  const EAR = shapePath([[0.02, 0.02], [-0.03, -0.13], [-0.1, -0.3], [-0.13, -0.11], [-0.09, 0.03]]);

  /* ---- the land ---- */

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.56);
    sky.addColorStop(0, '#aebcd5');
    sky.addColorStop(0.3, '#c6c6d8');
    sky.addColorStop(0.58, '#e6c2b0');
    sky.addColorStop(0.84, '#f6dcb4');
    sky.addColorStop(1, '#fbecc9');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    const x = state.sun.x;
    const y = state.sun.y;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, g.U * 46);
    glow.addColorStop(0, 'rgba(255,236,190,0.9)');
    glow.addColorStop(0.28, 'rgba(250,216,164,0.4)');
    glow.addColorStop(1, 'rgba(244,200,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath();
    ctx.arc(x, y, g.U * 3.8, 0, TAU);
    ctx.fill();
    return c;
  }

  function ridgeY(g, x, r) {
    const big = fbm((x / g.U) * r.freq, r.seed, 4, r.seed);
    return g.U * (r.base - r.amp * (big - 0.35));
  }

  function paintRidge(g, r) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = r.colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 1; x++) ctx.lineTo(x, ridgeY(g, x, r));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    const y0 = g.U * (r.base - r.amp * 0.5);
    const haze = ctx.createLinearGradient(0, y0, 0, g.U * (r.base + 7));
    haze.addColorStop(0, 'rgba(239,224,200,0)');
    haze.addColorStop(1, 'rgba(244,228,204,0.8)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintRidges(g, list) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const r of list) ctx.drawImage(paintRidge(g, r), 0, 0);
    return c;
  }

  function fieldEdge(g, x) {
    return g.H * FIELD_TOP - g.U * 2.4 * Math.sin((x / g.U) * 0.021 + 0.8) - g.U * 3 * fbm((x / g.U) * 0.03, 3, 3, 41);
  }

  function paintField(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * FIELD_TOP;
    const ground = ctx.createLinearGradient(0, top - g.U * 4, 0, g.H);
    ground.addColorStop(0, '#e6dab2');
    ground.addColorStop(0.2, '#c2bd7c');
    ground.addColorStop(0.55, '#8f9a58');
    ground.addColorStop(1, '#657a42');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 1; x++) ctx.lineTo(x, fieldEdge(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    paintFieldMarks(ctx, g, rand, top);
    return c;
  }

  // Clustered flecks: flat far off, upright blade strokes close to.
  function paintFieldMarks(ctx, g, rand, top) {
    const tones = ['#6f8046', '#849452', '#a0a662', '#bfb873', '#dacb8a', '#587040'];
    const count = Math.round(g.W * g.H * 0.16);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const s = Math.pow(rand(), 0.8);
      const y = top - g.U * 4 + s * (g.H - top + g.U * 4);
      const cluster = fbm((x / g.U) * (0.05 / (0.25 + s)), (y / g.U) * 0.12, 3, 7);
      const pick = Math.min(4, Math.floor(smoothstep(0.3, 0.7, cluster) * 3 + (1 - s) * 2.2 + rand() * 0.8));
      ctx.fillStyle = s > 0.75 && rand() < 0.3 ? tones[5] : tones[pick];
      ctx.globalAlpha = 0.5 + rand() * 0.4;
      const wide = g.U * lerp(1.6, 0.5, s) * (0.5 + rand());
      const tall = g.U * lerp(0.28, 3.4, s * s) * (0.5 + rand());
      ctx.fillRect(x, y - tall, Math.max(1, wide), Math.max(1, tall));
    }
    ctx.globalAlpha = 1;
  }

  // Soft bands of pale mist, half size, seamless across the width.
  function paintBand(w, h, seed, stretch, cut, colour, rows) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const [r, gr, b] = parseColor(colour);
    const value = (x, y) => fbm(x * stretch, y * rows, 4, seed);
    for (let y = 0; y < h; y++) {
      const fade = Math.sin(((y + 0.5) / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(value(x, y), value(x - w, y), x / w);
        const a = smoothstep(cut, cut + 0.3, v) * fade;
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gr;
        img.data[i + 2] = b;
        img.data[i + 3] = (Math.round(a * 8) / 8) * 225;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Doubled tile of light crests and dark troughs for the rolling grass.
  function paintGust() {
    const c = layer(GUST_W * 2, GUST_H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(GUST_W * 2, GUST_H);
    const value = (x, y) => fbm(x * 0.03, y * 0.16, 3, 77);
    for (let y = 0; y < GUST_H; y++) {
      for (let x = 0; x < GUST_W; x++) {
        const v = lerp(value(x, y), value(x - GUST_W, y), x / GUST_W);
        const crest = Math.round(smoothstep(0.5, 0.66, v) * 4) / 4;
        const trough = Math.round(smoothstep(0.46, 0.32, v) * 4) / 4;
        const px = crest > 0 ? [226, 206, 134, crest * 120] : [50, 66, 40, trough * 90];
        for (const col of [x, x + GUST_W]) img.data.set(px, (y * GUST_W * 2 + col) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---- baking one horse ---- */

  function limbPath(pts, xs) {
    const left = [];
    const right = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const w = pts[i][2];
      left.push([pts[i][0] * xs - (dy / len) * w, build(pts[i][1]) - (-dx / len) * w]);
      right.unshift([pts[i][0] * xs + (dy / len) * w, build(pts[i][1]) + (-dx / len) * w]);
    }
    return shapePath(left.concat(right));
  }

  // Leg stretch: the foal stands on longer legs under a shallower body.
  let bellyLift = 0;
  function build(y) {
    return y < 0.5 ? y * (1 + bellyLift) : lerp(0.5 * (1 + bellyLift), 1, (y - 0.5) / 0.5);
  }

  function paintLeg(ctx, pts, h, far) {
    const coat = h.coat;
    const xs = h.xs;
    ctx.fillStyle = far ? coat.shade : coat.base;
    ctx.fill(limbPath(pts, xs));
    const low = pts[pts.length - 1];
    const sock = pts.slice(3);
    ctx.fillStyle = far ? hex(coat.dark, coat.shade, 0.3) : coat.dark;
    ctx.fill(limbPath(sock, xs));
    ctx.fillStyle = coat.hoof;
    ctx.beginPath();
    const x = low[0] * xs;
    ctx.moveTo(x - 0.045, build(low[1]) + 0.012);
    ctx.lineTo(x + 0.04, build(low[1]) + 0.012);
    ctx.lineTo(x + 0.07, 0);
    ctx.lineTo(x - 0.05, 0);
    ctx.fill();
  }

  function softSpot(ctx, x, y, rx, ry, colour, alpha) {
    const [r, gr, b] = parseColor(colour);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const spot = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    spot.addColorStop(0, `rgba(${r},${gr},${b},${alpha})`);
    spot.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = spot;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function paintBodyShading(ctx, h, outline) {
    const coat = h.coat;
    const xs = h.xs;
    ctx.save();
    ctx.clip(outline);
    const round = ctx.createLinearGradient(0, 1.0, 0, build(0.47));
    round.addColorStop(0, coat.light);
    round.addColorStop(0.3, coat.base);
    round.addColorStop(0.68, coat.base);
    round.addColorStop(1, coat.shade);
    ctx.fillStyle = round;
    ctx.fillRect(-0.8, 0.3, 1.6, 0.8);
    softSpot(ctx, -0.34 * xs, build(0.82), 0.25 * xs, 0.2, coat.light, 0.75);
    softSpot(ctx, 0.36 * xs, build(0.78), 0.17 * xs, 0.2, coat.light, 0.6);
    softSpot(ctx, -0.13 * xs, build(0.6), 0.14 * xs, 0.1, coat.shade, 0.7);
    softSpot(ctx, 0.2 * xs, build(0.72), 0.05 * xs, 0.2, coat.shade, 0.5);
    ctx.restore();
  }

  function paintTopline(ctx, h) {
    const xs = h.xs;
    ctx.strokeStyle = h.coat.rim;
    ctx.lineWidth = 0.026;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(BODY[0][0] * xs, BODY[0][1] + 0.003);
    for (let i = 1; i <= 4; i++) {
      const a = BODY[i];
      const b = BODY[i + 1];
      ctx.quadraticCurveTo(a[0] * xs, a[1], (a[0] + b[0]) * 0.5 * xs, (a[1] + b[1]) * 0.5);
    }
    ctx.stroke();
  }

  function paintBody(h) {
    const S = h.S;
    const wide = Math.ceil(S * 2.1);
    const tall = Math.ceil(S * 1.2);
    const c = layer(wide, tall);
    const ctx = c.getContext('2d');
    bellyLift = h.lift;
    ctx.setTransform(h.dir * S, 0, 0, -S, wide / 2, tall - 1);
    paintLeg(ctx, LEGS.farHind, h, true);
    paintLeg(ctx, LEGS.farFore, h, true);
    const outline = shapePath(BODY.map((p) => [p[0] * h.xs, build(p[1])]));
    ctx.fillStyle = h.coat.base;
    ctx.fill(outline);
    paintBodyShading(ctx, h, outline);
    paintLeg(ctx, LEGS.nearHind, h, false);
    paintLeg(ctx, LEGS.nearFore, h, false);
    paintTopline(ctx, h);
    bellyLift = 0;
    return { canvas: c, ox: wide / 2, oy: tall - 1 };
  }

  function makeHorse(g, spec) {
    const S = g.U * spec.size;
    const h = {
      S,
      x: g.W * spec.at,
      ground: g.U * spec.ground,
      dir: spec.dir,
      coat: spec.coat,
      xs: spec.xs || 1,
      lift: spec.lift || 0,
      neck: spec.neck || 0.62,
      headLen: spec.headLen || 0.37,
      thick: spec.thick || 1,
      tailLen: spec.tailLen || 0.72,
      detail: spec.detail,
      blaze: !!spec.blaze,
      cycle: spec.cycle,
      off: spec.off,
      low: spec.low || 0,
      high: spec.high === undefined ? 1 : spec.high,
      maneHi: hex(spec.coat.dark, spec.coat.base, 0.45),
    };
    h.body = paintBody(h);
    return h;
  }

  /* ---- drawing one horse ---- */

  // Horse units to canvas, one value at a time, so nothing is allocated.
  function X(h, x) {
    return h.x + h.dir * h.S * x;
  }

  function Y(h, y) {
    return h.ground - h.S * y;
  }

  function poseOf(h, t) {
    const u = (((t + h.off) / h.cycle) % 1 + 1) % 1;
    const rise = smoothstep(0.38, 0.52, u) * (1 - smoothstep(0.82, 0.97, u));
    const p = lerp(h.low, h.high, rise);
    const nibble = (1 - rise) * Math.sin(t * 2.3 + h.off) * 0.035;
    const sway = Math.sin(t * 0.55 + h.off) * 0.035;
    const a = lerp(-1.0, 0.82, p) + sway + nibble;
    h.drape = lerp(0.42, 1, p);
    h.px = NECK_BASE[0] * h.xs + Math.cos(a) * h.neck;
    h.py = NECK_BASE[1] + Math.sin(a) * h.neck;
    h.ha = lerp(-1.47, -0.58, p) + nibble * 2.4 + sway * 0.6;
    h.ca = Math.cos(h.ha);
    h.sa = Math.sin(h.ha);
    h.tx = h.px + h.sa * 0.19 * h.thick;
    h.ty = h.py - h.ca * 0.19 * h.thick;
  }

  function neckControls(h) {
    const wx = WITHERS[0] * h.xs;
    const dx = h.px - wx;
    const dy = h.py - WITHERS[1];
    const len = Math.hypot(dx, dy) || 1;
    h.cx = (wx + h.px) / 2 - (dy / len) * 0.07;
    h.cy = (WITHERS[1] + h.py) / 2 + (dx / len) * 0.07;
    h.ux = (CHEST[0] * h.xs + h.tx) / 2 + (dy / len) * 0.015;
    h.uy = (CHEST[1] + h.ty) / 2 - (dx / len) * 0.015;
  }

  function drawNeck(ctx, h) {
    const wx = WITHERS[0] * h.xs;
    const chx = CHEST[0] * h.xs;
    ctx.fillStyle = h.coat.base;
    ctx.beginPath();
    ctx.moveTo(X(h, wx - 0.08), Y(h, 0.92));
    ctx.lineTo(X(h, wx), Y(h, WITHERS[1]));
    ctx.quadraticCurveTo(X(h, h.cx), Y(h, h.cy), X(h, h.px), Y(h, h.py));
    ctx.lineTo(X(h, h.tx), Y(h, h.ty));
    ctx.quadraticCurveTo(X(h, h.ux), Y(h, h.uy), X(h, chx), Y(h, CHEST[1]));
    ctx.lineTo(X(h, wx + 0.02), Y(h, 0.74));
    ctx.fill();
    ctx.fillStyle = h.coat.shade;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(X(h, h.tx), Y(h, h.ty));
    ctx.quadraticCurveTo(X(h, h.ux), Y(h, h.uy), X(h, chx), Y(h, CHEST[1]));
    ctx.quadraticCurveTo(X(h, lerp(h.ux, h.cx, 0.32)), Y(h, lerp(h.uy, h.cy, 0.32)), X(h, lerp(h.tx, h.px, 0.38)), Y(h, lerp(h.ty, h.py, 0.38)));
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // One curtain from crest to jagged tips, so it never reads as stripes.
  function drawMane(ctx, h, t, wind) {
    const strands = h.detail >= 2 ? 16 : 8;
    const wx = WITHERS[0] * h.xs;
    const push = h.S * 0.15 * (0.2 + wind);
    const tx = state.tipX;
    const ty = state.tipY;
    const rx = state.rootX;
    const ry = state.rootY;
    for (let i = 0; i < strands; i++) {
      const f = (i + 0.5) / strands;
      const v = 1 - f;
      rx[i] = X(h, v * v * wx + 2 * v * f * h.cx + f * f * h.px);
      ry[i] = Y(h, v * v * WITHERS[1] + 2 * v * f * h.cy + f * f * h.py);
      const ripple = Math.sin(t * 2.1 - f * 7 + h.off);
      const long = h.S * h.maneLen * h.drape * (0.72 + 0.3 * Math.abs(Math.sin(i * 2.4)));
      tx[i] = rx[i] + push * (0.8 + 0.55 * ripple) * (long / (h.S * 0.2)) * (0.5 + 0.5 * h.drape);
      ty[i] = ry[i] + long * (0.74 + 0.14 * ripple);
    }
    ctx.fillStyle = h.coat.dark;
    ctx.beginPath();
    ctx.moveTo(X(h, wx - 0.02), Y(h, WITHERS[1]));
    ctx.quadraticCurveTo(X(h, h.cx), Y(h, h.cy), X(h, h.px), Y(h, h.py));
    for (let i = strands - 1; i >= 0; i--) ctx.lineTo(tx[i], ty[i]);
    ctx.fill();
    if (h.detail < 1) return;
    ctx.strokeStyle = h.maneHi;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, h.S * 0.016);
    ctx.beginPath();
    for (let i = 1; i < strands; i += 3) {
      ctx.moveTo(rx[i], ry[i]);
      ctx.quadraticCurveTo((rx[i] + tx[i]) / 2 + push * 0.1, (ry[i] + ty[i]) / 2, tx[i], ty[i]);
    }
    ctx.stroke();
  }

  function drawTail(ctx, h, t, wind) {
    const strands = h.detail >= 2 ? 11 : 5;
    const rootX = X(h, -0.56 * h.xs);
    const rootY = Y(h, lerp(0.5 * (1 + h.lift), 1, 0.78));
    const len = h.S * h.tailLen;
    const swish = Math.pow(Math.sin(t * 0.37 + h.off), 5) * h.S * 0.1;
    ctx.lineCap = 'round';
    for (let k = 0; k < strands; k++) {
      const spread = (k - (strands - 1) / 2) / strands;
      const reach = 0.78 + 0.22 * Math.cos(k * 2.1);
      ctx.strokeStyle = k % 4 === 2 ? h.maneHi : h.coat.dark;
      ctx.lineWidth = Math.max(1, h.S * (0.04 - Math.abs(spread) * 0.04));
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      for (let j = 1; j <= 6; j++) {
        const f = (j / 6) * reach;
        const out = -h.dir * h.S * 0.11 * Math.sin(Math.min(1, f * 2.4) * 1.57);
        const blow = h.S * 0.2 * wind * f * f * (1 + 0.35 * Math.sin(t * 1.3 + k));
        const ripple = Math.sin(t * 2.2 - f * 4.5 + k * 0.6 + h.off) * h.S * 0.045 * f * (0.4 + wind);
        const fan = spread * h.S * 0.2 * Math.sin(Math.min(1, f * 1.05) * 2.75);
        const x = rootX + out + blow + ripple + swish * f * f + fan;
        const y = rootY + len * f * (1 - 0.14 * wind * f) - h.S * 0.03 * Math.sin(f * 3.14);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawHead(ctx, h, t) {
    const L = h.S * h.headLen;
    const coat = h.coat;
    ctx.save();
    ctx.transform(h.dir * L * h.ca, -L * h.sa, h.dir * L * h.sa, L * h.ca, X(h, h.px), Y(h, h.py));
    const flick = Math.pow(Math.sin(t * 0.5 + h.off * 2), 9) * 0.5;
    ctx.fillStyle = coat.shade;
    ctx.save();
    ctx.translate(0.13, -0.03);
    ctx.rotate(0.42);
    ctx.fill(EAR);
    ctx.restore();
    ctx.fillStyle = coat.base;
    ctx.fill(HEAD);
    ctx.fillStyle = coat.light;
    ctx.globalAlpha = 0.7;
    ctx.fill(CHEEK);
    ctx.fillStyle = coat.shade;
    ctx.globalAlpha = 0.85;
    ctx.fill(JAW_SHADE);
    ctx.globalAlpha = 1;
    ctx.fillStyle = coat.muzzle;
    ctx.fill(MUZZLE);
    if (h.blaze) {
      ctx.fillStyle = '#efe6cf';
      ctx.fill(BLAZE);
    }
    ctx.fillStyle = coat.base;
    ctx.save();
    ctx.rotate(flick);
    ctx.fill(EAR);
    ctx.restore();
    ctx.fillStyle = '#1f1a1c';
    ctx.beginPath();
    ctx.arc(0.3, 0.08, 0.055, 0, TAU);
    ctx.arc(0.92, 0.1, 0.035, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawForelock(ctx, h, t, wind) {
    const L = h.S * h.headLen;
    const px = X(h, h.px);
    const py = Y(h, h.py);
    const axisX = h.dir * h.ca;
    const axisY = -h.sa;
    ctx.strokeStyle = h.coat.dark;
    ctx.lineWidth = Math.max(1, h.S * 0.024);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const f = 0.3 + i * 0.09;
      const blow = (0.2 + wind) * L * 0.09 * (1 + Math.sin(t * 2.4 + i * 1.7));
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + axisX * L * f * 0.5, py + axisY * L * f * 0.5, px + axisX * L * f + blow, py + axisY * L * f);
    }
    ctx.stroke();
  }

  function drawHorse(ctx, h, t, wind) {
    poseOf(h, t);
    neckControls(h);
    drawTail(ctx, h, t, wind);
    ctx.drawImage(h.body.canvas, h.x - h.body.ox, h.ground - h.body.oy);
    drawNeck(ctx, h);
    drawMane(ctx, h, t, wind);
    drawHead(ctx, h, t);
    if (h.detail >= 1) drawForelock(ctx, h, t, wind);
  }

  /* ---- grass ---- */

  function makeBlades(g, rand, spec) {
    const n = Math.round(spec.perU * (g.W / g.U));
    const each = Math.ceil(n / spec.tones.length);
    const sets = spec.tones.map((colour) => {
      const set = { colour, n: each, x: new Float32Array(each), y: new Float32Array(each), h: new Float32Array(each), ph: new Float32Array(each) };
      for (let i = 0; i < each; i++) {
        const x = rand() * g.W;
        const y = g.U * lerp(spec.y0, spec.y1, rand());
        set.x[i] = x;
        set.y[i] = y;
        set.h[i] = g.U * lerp(spec.h0, spec.h1, rand());
        set.ph[i] = (x / g.U) * 0.11 + (y / g.U) * 0.24;
      }
      return set;
    });
    return { sets, lw: Math.max(1, g.U * spec.lw), plume: spec.plume };
  }

  function drawBlades(ctx, group, t, wind) {
    ctx.lineWidth = group.lw;
    ctx.lineCap = 'round';
    const w = 0.15 + wind;
    for (const set of group.sets) {
      ctx.strokeStyle = set.colour;
      ctx.beginPath();
      for (let i = 0; i < set.n; i++) {
        const ph = set.ph[i];
        const wave = Math.sin(ph - t * 1.25) + 0.45 * Math.sin(ph * 2.3 - t * 2.05);
        const h = set.h[i];
        const lean = h * w * (0.32 + 0.42 * wave);
        const x = set.x[i];
        const y = set.y[i];
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + lean * 0.25, y - h * 0.62, x + lean, y - h * (1 - 0.14 * Math.abs(wave) * w));
      }
      ctx.stroke();
    }
  }

  function makePlumes(g, rand, y0, y1, count) {
    const list = [];
    const clearFrom = state.hero.x - state.hero.S * 0.75;
    const clearTo = state.hero.x + state.hero.S * 1.0;
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      if (x > clearFrom && x < clearTo) continue;
      const y = g.U * lerp(y0, y1, rand());
      list.push({ x, y, h: g.U * (11 + rand() * 9), head: g.U * (2.6 + rand() * 2.6), ph: (x / g.U) * 0.11 + (y / g.U) * 0.24 });
    }
    return list;
  }

  // Susuki: a thin stem, then a pale head that streams with the wind.
  function drawPlumes(ctx, g, plumes, t, wind) {
    const w = 0.15 + wind;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#b0a86e';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.beginPath();
    for (const p of plumes) {
      p.wave = Math.sin(p.ph - t * 1.25) + 0.45 * Math.sin(p.ph * 2.3 - t * 2.05);
      p.lean = p.h * w * (0.3 + 0.3 * p.wave);
      p.tx = p.x + p.lean;
      p.ty = p.y - p.h * 0.94;
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + p.lean * 0.2, p.y - p.h * 0.6, p.tx, p.ty);
    }
    ctx.stroke();
    ctx.strokeStyle = '#ddcf9e';
    ctx.lineWidth = Math.max(1, g.U * 0.42);
    ctx.beginPath();
    for (const p of plumes) {
      const head = p.head;
      const lean = 0.3 + w * 0.35 + 0.15 * p.wave;
      ctx.moveTo(p.tx, p.ty);
      ctx.lineTo(p.tx + head * lean, p.ty - head * 0.75);
      ctx.moveTo(p.tx - g.U * 0.5, p.ty + head * 0.15);
      ctx.lineTo(p.tx + head * lean * 0.7 - g.U * 0.7, p.ty - head * 0.45);
      ctx.moveTo(p.tx + g.U * 0.5, p.ty + head * 0.2);
      ctx.lineTo(p.tx + head * lean * 1.05 + g.U * 0.7, p.ty - head * 0.4);
    }
    ctx.stroke();
  }

  function slide(ctx, tex, offset, y, wide, tall, alpha) {
    if (alpha <= 0) return;
    const shift = ((offset % wide) + wide) % wide;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(tex, -shift, y, wide, tall);
    ctx.drawImage(tex, wide - shift, y, wide, tall);
    ctx.globalAlpha = 1;
  }

  function drawGusts(ctx, g, t, wind) {
    const top = g.H * FIELD_TOP - g.U * 2;
    const span = g.H - top;
    const stripH = span / STRIPS + 0.5;
    const flow = t * (6 + wind * 11);
    ctx.globalAlpha = Math.min(1, 0.3 + wind * 0.45);
    for (let i = 0; i < STRIPS; i++) {
      const s = (i + 0.5) / STRIPS;
      const sw = Math.min(GUST_W, 58 / (0.16 + s * s * 1.1));
      const near = 0.25 + s * 1.6;
      const sx = (((i * 7.3 - flow * near / (sw / 60)) % GUST_W) + GUST_W) % GUST_W;
      ctx.drawImage(state.gust, sx, i % GUST_H, sw, 1, 0, top + (i / STRIPS) * span, g.W, stripH);
    }
    ctx.globalAlpha = 1;
  }

  // The same crests again over the near grass, so waves roll past the horses' feet.
  function drawForeGusts(ctx, g, t, wind) {
    const top = g.U * 86;
    const rows = 8;
    const stripH = (g.H - top) / rows + 0.5;
    const flow = t * (6 + wind * 11) * 1.1;
    ctx.globalAlpha = Math.min(1, 0.18 + wind * 0.25);
    for (let i = 0; i < rows; i++) {
      const sx = (((i * 5.1 - flow) % GUST_W) + GUST_W) % GUST_W;
      ctx.drawImage(state.gust, sx, i, 46, 1, 0, top + i * (stripH - 0.5), g.W, stripH);
    }
    ctx.globalAlpha = 1;
  }

  function drawDistance(ctx, g, t, mist, wind) {
    ctx.drawImage(state.sky, 0, 0);
    slide(ctx, state.clouds, t * g.U * 0.32, g.U * 2, state.cloudW, state.cloudH, 0.8);
    ctx.drawImage(state.farRidges, 0, 0);
    slide(ctx, state.mistA, t * g.U * 0.42, g.U * 31, state.mistW, g.U * 20, 0.55 * mist);
    ctx.drawImage(state.nearRidges, 0, 0);
    slide(ctx, state.mistB, t * g.U * 0.75, g.U * 43, state.mistW, g.U * 19, 0.65 * mist);
    ctx.drawImage(state.field, 0, 0);
    drawGusts(ctx, g, t, wind);
  }

  function setupLand(g, rand) {
    state.sun = { x: g.W * 0.2, y: g.U * 25 };
    state.sky = paintSky(g);
    state.farRidges = paintRidges(g, [
      { base: 36, amp: 16, freq: 0.016, seed: 3, colour: '#b3aec4' },
      { base: 42, amp: 14, freq: 0.022, seed: 11, colour: '#979bb4' },
    ]);
    state.nearRidges = paintRidges(g, [
      { base: 48, amp: 12, freq: 0.027, seed: 19, colour: '#7b8ba1' },
      { base: 53.5, amp: 10, freq: 0.034, seed: 29, colour: '#6a8a80' },
    ]);
    state.field = paintField(g, rand);
    state.gust = paintGust();
    const halfW = Math.ceil(g.W * 0.75);
    state.cloudW = halfW * 2;
    state.cloudH = g.U * 26;
    state.clouds = paintBand(halfW, Math.ceil(g.U * 13), 53, 0.024, 0.49, '#f7d2ba', 0.42);
    state.mistW = halfW * 2;
    state.mistA = paintBand(halfW, Math.ceil(g.U * 11), 61, 0.03, 0.47, MIST, 0.13);
    state.mistB = paintBand(halfW, Math.ceil(g.U * 10), 67, 0.042, 0.47, MIST, 0.13);
    state.mistC = paintBand(halfW, Math.ceil(g.U * 8), 71, 0.05, 0.48, MIST, 0.13);
  }

  // The mare, foal and lookout stay a family on any aspect: spaced in U, not W.
  function setupFamily(g) {
    const heroX = g.W * 0.5 + g.U * 14;
    const at = (x) => x / g.W;
    const foalX = Math.max(g.W * 0.115, heroX - g.U * 73);
    const midX = Math.min(g.W * 0.9, heroX + g.U * 47);
    state.mid = makeHorse(g, { at: at(midX), ground: 77, size: 25, dir: -1, coat: COATS.roan, cycle: 37, off: 21, low: 0.55, detail: 1 });
    state.foal = makeHorse(g, {
      at: at(foalX), ground: 91, size: 27, dir: 1, coat: COATS.foal, cycle: 19, off: 8, low: 0.72, high: 1.04, detail: 1,
      xs: 0.75, lift: 0.36, neck: 0.47, headLen: 0.4, thick: 0.84, tailLen: 0.34,
    });
    state.hero = makeHorse(g, { at: at(heroX), ground: 96, size: 45, dir: -1, coat: COATS.bay, cycle: 26, off: 2, detail: 2, blaze: true, xs: 0.95 });
    state.hero.maneLen = 0.2;
    state.mid.maneLen = 0.2;
    state.foal.maneLen = 0.07;
  }

  function setupHorses(g) {
    const far = (at, ground, size, dir, off, tone) => makeHorse(g, {
      at, ground, size, dir, off, cycle: 31, detail: 0,
      coat: {
        base: hex(tone, MIST, 0.28), shade: hex(tone, MIST, 0.14), light: hex(tone, MIST, 0.42),
        rim: hex(tone, MIST, 0.65), dark: hex('#2e2529', MIST, 0.25), hoof: hex('#2e2529', MIST, 0.25), muzzle: hex(tone, MIST, 0.1),
      },
    });
    state.herd = [
      far(0.07, 66, 10, 1, 4, '#5e4030'),
      far(0.31, 63, 8.5, -1, 13, '#4a4752'),
      far(0.73, 64, 9, 1, 22, '#6b4e34'),
      far(0.95, 65, 10, -1, 9, '#4e382e'),
    ];
    setupFamily(g);
    for (const h of state.herd) h.maneLen = 0.12;
  }

  function setupGrass(g, rand) {
    state.tipX = new Float32Array(16);
    state.tipY = new Float32Array(16);
    state.rootX = new Float32Array(16);
    state.rootY = new Float32Array(16);
    const near = ['#8c9a54', '#a8ad64', '#c8bf76', '#6c8042'];
    state.grassBack = makeBlades(g, rand, { perU: 1.0, y0: 66, y1: 79, h0: 1.5, h1: 4, lw: 0.35, tones: ['#9c9d60', '#b6ad6c', '#7f8a4e'] });
    state.grassMid = makeBlades(g, rand, { perU: 1.1, y0: 79, y1: 92, h0: 3, h1: 6.5, lw: 0.5, tones: ['#9da460', '#bab36c', '#7c8c4c'] });
    state.grassNear = makeBlades(g, rand, { perU: 1.3, y0: 96, y1: 110, h0: 6, h1: 13, lw: 0.7, tones: near });
    state.plumes = makePlumes(g, rand, 94, 108, Math.round((g.W / g.U) * 0.25));
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    setupLand(g, rand);
    setupHorses(g);
    setupGrass(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const wind = api.props.wind;
    const mist = api.props.mist;
    drawDistance(ctx, g, t, mist, wind);
    for (const h of state.herd) drawHorse(ctx, h, t, wind);
    slide(ctx, state.mistC, t * g.U * 1.1, g.U * 56, state.mistW, g.U * 15, 0.65 * mist);
    drawBlades(ctx, state.grassBack, t, wind);
    drawHorse(ctx, state.mid, t, wind);
    drawBlades(ctx, state.grassMid, t, wind);
    slide(ctx, state.mistC, -t * g.U * 0.9 + g.W * 0.4, g.U * 71, state.mistW, g.U * 17, 0.45 * mist);
    drawHorse(ctx, state.foal, t, wind);
    drawHorse(ctx, state.hero, t, wind);
    drawBlades(ctx, state.grassNear, t, wind);
    drawForeGusts(ctx, g, t, wind);
    drawPlumes(ctx, g, state.plumes, t, wind);
  }

  Kasuri.run({
    defaults: { wind: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.14, gain: 1.05, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
