/*
 * 雀 Suzume — plump sparrows on a sagging telephone wire at sunset, low town roofs below.
 *
 * Sky, roofs and poles are baked once, and every bird is a few baked parts (tail,
 * body, head) moved with plain transforms. The wire is one polyline a frame, so a
 * landing can set it bouncing for almost nothing.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const CAP = '#9a5230', CAP_LIT = '#bb7040', CHEEK = '#f1e6cf', BIB = '#241c22', BEAK = '#54464a';
  const EYE = '#110d10', GLINT = '#e8e0d0', BACK = '#7d5636', DARK = '#3d2b24', BUFF = '#d9b582';
  const BELLY = '#bfae94', BELLY_LIT = '#d4c3a6', BELLY_DIM = '#a4907a', LEG = '#7f5442';
  const WIRE = '#3c2733', WIRE_LIT = '#e9a56e', POLE_LIT = '#d2926a', POLE_DIM = '#3f2d38', CROW = '#4b3142';

  // Sprite sizes and origins, in bird units.
  const SPRITE = 64, ORIGIN_X = 32, ORIGIN_Y = 46, HEAD = 40, HEAD_X = 20, HEAD_Y = 16, TAIL = 30;
  const BODY_LIFT = 3.6, FLOCK = 7, WIRE_STEPS = 56, HERO = 1;
  const FLAP_ORDER = [0, 1, 2, 1];
  const MODE = { PERCHED: 0, CROUCH: 1, LEAVING: 2, AWAY: 3, ARRIVING: 4 };
  const SCALES = [0.74, 1.08, 0.8, 0.86, 0.72, 0.84, 0.76, 0.9, 0.74, 0.82];
  const KINDS = ['front', 'side', 'back', 'side', 'front', 'side', 'back', 'side', 'front', 'side'];
  const FACES = [1, 1, -1, -1, 1, -1, 1, 1, -1, -1];
  const GAPS = [1.32, 1.34, 1.05, 1.15, 1, 1.25, 0.95, 1.15, 1.05];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, colour, pts) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.fill();
  }

  function disc(ctx, colour, x, y, rx, ry) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry === undefined ? rx : ry, 0, 0, 6.3);
    ctx.fill();
  }

  function rect(ctx, colour, x, y, w, h) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  function stroke(ctx, colour, width, x0, y0, x1, y1) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // A sprite drawn in bird units, with its origin where the feet grip the wire.
  function sprite(size, ox, oy, paint) {
    const px = state.px;
    const c = layer(size * px, size * px);
    const ctx = c.getContext('2d');
    ctx.scale(px, px);
    ctx.translate(ox, oy);
    ctx.lineCap = 'round';
    paint(ctx);
    return c;
  }

  // ---- heads, centred on the skull, looking right ----
  function paintHeadSide(ctx) {
    disc(ctx, CHEEK, -4, 7, 5, 3.6);
    disc(ctx, CHEEK, 0, 0, 10, 9.4);
    ctx.fillStyle = CAP;
    ctx.beginPath();
    ctx.moveTo(9.6, -2.4);
    ctx.bezierCurveTo(6.5, -12, -8.5, -12, -10.4, 1.4);
    ctx.quadraticCurveTo(-4, -2.6, 2, -2.6);
    ctx.fill();
    disc(ctx, CAP_LIT, -0.5, -7, 5.8, 2);
    poly(ctx, BIB, [9.6, 0.2, 5.4, 3.6, 4.2, 7.6, 6.4, 10.4, 9.4, 9, 10.6, 5]);
    stroke(ctx, BIB, 1, 9, -1.4, 2, -1.8);
    disc(ctx, BIB, -3.4, 2.8, 2.3, 2.1);
    poly(ctx, BEAK, [9, -3.6, 15.2, -0.2, 9, 2.4]);
    disc(ctx, EYE, 4.6, -2, 1.8);
    disc(ctx, GLINT, 5.2, -2.7, 0.55);
  }

  // Turned part way to the viewer, beak and bib off to one side.
  function paintHeadTurned(ctx) {
    disc(ctx, CHEEK, 0, 0, 10.4, 9.6);
    ctx.fillStyle = CAP;
    ctx.beginPath();
    ctx.moveTo(10.2, -1);
    ctx.bezierCurveTo(8, -12.5, -8.5, -12.5, -10.3, 1.6);
    ctx.quadraticCurveTo(-4, -3.4, 2, -3.2);
    ctx.quadraticCurveTo(7, -3, 10.2, -1);
    ctx.fill();
    disc(ctx, CAP_LIT, -0.5, -7.4, 5.8, 2);
    poly(ctx, BIB, [3, 3.6, 9.4, 3.2, 9.6, 6.2, 7.2, 10.6, 3.6, 10, 2.2, 6.6]);
    disc(ctx, BIB, -5.6, 3, 2.2, 2);
    poly(ctx, '#7c6a64', [2.6, -1.4, 9, -1.4, 6.6, 3.6]);
    disc(ctx, EYE, 0.6, -1.4, 1.7);
    disc(ctx, GLINT, 1.1, -2, 0.5);
    disc(ctx, EYE, 8, -2.2, 1.2);
  }

  function paintHeadRear(ctx) {
    disc(ctx, CHEEK, 0, 2, 10, 8.2);
    disc(ctx, CAP, 0, -1.4, 9.4, 8.8);
    disc(ctx, CAP_LIT, 0, -6.6, 5.2, 2);
    disc(ctx, BIB, -8.4, 3.2, 1.6, 2.2);
    disc(ctx, BIB, 8.4, 3.2, 1.6, 2.2);
  }

  // ---- bodies, feet at the origin ----
  function paintTail(ctx) {
    poly(ctx, DARK, [-3.2, 0, -4.6, 17, -0.6, 15.5, 0.6, 15.5, 4.6, 17, 3.2, 0]);
    stroke(ctx, BUFF, 0.7, -3.8, 15.4, -2.6, 2);
    stroke(ctx, BUFF, 0.7, 3.8, 15.4, 2.6, 2);
  }

  function paintFeet(ctx) {
    for (const x of [-3.2, 3.2]) {
      stroke(ctx, LEG, 1.5, x, -5.4, x, -0.6);
      disc(ctx, LEG, x, 0.1, 3.1, 1.7);
    }
  }

  // Folded wing: coverts, two pale bars, long primaries, all along one axis.
  function paintWing(ctx, ax, ay, bx, by, side) {
    const len = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / len;
    const dy = (by - ay) / len;
    const at = (t, k) => [ax + dx * len * t - dy * side * k, ay + dy * len * t + dx * side * k];
    poly(ctx, BACK, [at(0, -3), at(0.5, -6.5), at(1, -1), at(0.6, 6), at(0.15, 7.5)].flat());
    poly(ctx, CAP, [at(0, -3), at(0.32, -5.6), at(0.34, 6.6), at(0.12, 7.4)].flat());
    for (const k of [-5, -2.6, -0.2, 2.2, 4.6]) {
      stroke(ctx, DARK, 1.5, ...at(0.42, k), ...at(0.98, k * 0.28));
      stroke(ctx, BUFF, 0.6, ...at(0.46, k + 1.2), ...at(0.92, (k + 1.2) * 0.32));
    }
    stroke(ctx, CHEEK, 1.3, ...at(0.34, -5.4), ...at(0.36, 6.2));
    stroke(ctx, BUFF, 1.1, ...at(0.14, -3), ...at(0.16, 6.8));
    for (const k of [-2.4, 0.4, 3.2]) stroke(ctx, DARK, 1.2, ...at(0.2, k), ...at(0.3, k));
  }

  function paintSideBody(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-4, -29);
    ctx.bezierCurveTo(-15, -25, -18, -9, -9, -1.5);
    ctx.quadraticCurveTo(0, 3.5, 8, 0);
    ctx.bezierCurveTo(17, -4, 20, -18, 11, -27);
    ctx.closePath();
    ctx.clip();
    rect(ctx, BELLY, -24, -34, 48, 44);
    disc(ctx, BELLY_DIM, -1, 2, 15, 7.5);
    disc(ctx, BELLY_LIT, 10, -14, 6.5, 10);
    poly(ctx, BACK, [-6, -33, 5, -28, 2, -14, -22, 4, -26, -33]);
    ctx.restore();
    paintWing(ctx, 1, -22, -14.5, -0.5, 1);
  }

  function paintFrontBody(ctx) {
    disc(ctx, BELLY, 0, -13.5, 15.5, 16.5);
    disc(ctx, BELLY_DIM, 0, -2, 12, 6);
    disc(ctx, BELLY_LIT, 0, -17, 9, 8.5);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 12, -12);
      ctx.scale(0.5, 0.82);
      paintWing(ctx, side * -2, -12, side * 1, 12, side);
      ctx.restore();
    }
  }

  function paintRearBody(ctx) {
    disc(ctx, BACK, 0, -13.5, 15, 16.5);
    disc(ctx, '#a08258', 0, -2.5, 7, 6);
    for (let row = 0; row < 3; row++) {
      for (let i = -1; i <= 1; i++) {
        const x = i * 3.2;
        const y = -24 + row * 4.6;
        stroke(ctx, DARK, 1.5, x, y, x * 1.2, y + 3.4);
        stroke(ctx, BUFF, 0.7, x + 1.5, y + 0.4, x * 1.2 + 1.5, y + 3);
      }
    }
    paintWing(ctx, -9, -20, -2, 3, -1);
    paintWing(ctx, 9, -20, 2, 3, 1);
    disc(ctx, CHEEK, 0, -26.5, 9, 3);
  }

  // ---- flying bird, centred on the body, heading right ----
  function paintFlyingWing(ctx, angle, spread, length, tone) {
    const tip = (i, r) => {
      const a = angle - (i - 2) * spread;
      const len = length * (1 - i * 0.07) * r;
      return [1 + Math.cos(a) * len, -4 + Math.sin(a) * len];
    };
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(5, -3);
    for (let i = 0; i <= 6; i++) {
      ctx.lineTo(...tip(i, 1));
      if (i < 6) ctx.lineTo(...tip(i + 0.5, 0.86));
    }
    ctx.lineTo(-5, -3);
    ctx.fill();
    for (let i = 0.5; i < 6; i++) stroke(ctx, DARK, 0.9, ...tip(i, 0.42), ...tip(i, 0.86));
    disc(ctx, CAP, ...tip(2.6, 0.3), 7, 5.6);
    stroke(ctx, CHEEK, 1.3, ...tip(0.4, 0.5), ...tip(5.4, 0.54));
  }

  function paintFlyer(ctx, angle, spread, length) {
    paintFlyingWing(ctx, angle + 0.35, spread, length * 0.88, '#5a4030');
    poly(ctx, DARK, [-9, -3.4, -24, -5.6, -25, 0.6, -24, 4, -9, 3]);
    stroke(ctx, BUFF, 0.7, -23, -4.6, -11, -2.8);
    disc(ctx, BELLY, 0, 0.6, 12, 7.4);
    disc(ctx, BELLY_DIM, -2, 4.6, 8.6, 3.4);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0.6, 12, 7.4, 0, 0, 6.3);
    ctx.clip();
    rect(ctx, BACK, -14, -9, 28, 7.6);
    ctx.restore();
    ctx.save();
    ctx.translate(10.5, -4.6);
    ctx.scale(0.76, 0.76);
    paintHeadSide(ctx);
    ctx.restore();
    paintFlyingWing(ctx, angle, spread, length, BACK);
  }

  function bakeBirds() {
    state.sprites = {
      tail: sprite(TAIL, TAIL / 2, 1, paintTail),
      feet: sprite(TAIL, TAIL / 2, TAIL / 2, paintFeet),
      headSide: sprite(HEAD, HEAD_X, HEAD_Y, paintHeadSide),
      flaps: [
        sprite(SPRITE, 32, 32, (c) => paintFlyer(c, -1.72, 0.2, 27)),
        sprite(SPRITE, 32, 32, (c) => paintFlyer(c, -2.72, 0.16, 25)),
        sprite(SPRITE, 32, 32, (c) => paintFlyer(c, 2.05, -0.2, 25)),
      ],
      flare: sprite(SPRITE, 32, 32, (c) => paintFlyer(c, -1.2, 0.3, 28)),
    };
    const turned = sprite(HEAD, HEAD_X, HEAD_Y, paintHeadTurned);
    state.kinds = {
      side: { body: sprite(SPRITE, ORIGIN_X, ORIGIN_Y, paintSideBody), rest: turned, hx: 4.5, hy: -28.5, tx: -8.5, ty: -5, ta: 0.48, tl: 1 },
      front: { body: sprite(SPRITE, ORIGIN_X, ORIGIN_Y, paintFrontBody), rest: turned, hx: 0, hy: -27.5, tx: 0, ty: -6, ta: 0.05, tl: 0.62 },
      back: { body: sprite(SPRITE, ORIGIN_X, ORIGIN_Y, paintRearBody), rest: sprite(HEAD, HEAD_X, HEAD_Y, paintHeadRear), hx: 0, hy: -28, tx: 0, ty: -5, ta: 0.03, tl: 1 },
    };
  }

  // ---- the still world ----
  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.82);
    sky.addColorStop(0, '#7c6c9a');
    sky.addColorStop(0.26, '#c07f88');
    sky.addColorStop(0.5, '#ee9f6c');
    sky.addColorStop(0.76, '#f8c67c');
    sky.addColorStop(1, '#fbdc9e');
    rect(ctx, sky, 0, 0, g.W, g.H);
    const sx = g.W * 0.53;
    const sy = g.H * 0.645;
    const r = g.U * 46;
    const glow = ctx.createRadialGradient(sx, sy, g.U * 6, sx, sy, r);
    glow.addColorStop(0, 'rgba(250,216,150,0.75)');
    glow.addColorStop(1, 'rgba(250,216,150,0)');
    rect(ctx, glow, sx - r, sy - r, r * 2, r * 2);
    disc(ctx, '#fff3cf', sx, sy, g.U * 14.5);
    return c;
  }

  // Long streaks of cloud, half size, in a few flat tones. Tiles sideways.
  function paintClouds(g, w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const scale = 2 / g.U;
    const density = (x, y) => fbm(x * scale * 0.032, y * scale * 0.17, 4, 37);
    const high = K.parseColor('#c98f9c');
    const low = K.parseColor('#ffd8a0');
    for (let y = 0; y < h; y++) {
      const f = y / h;
      const band = Math.sin(f * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const tone = Math.round(smoothstep(0.46, 0.68, v) * band * 3) / 3;
        const mix = Math.round((f * 0.7 + tone * 0.3) * 3) / 3;
        const i = (y * w + x) * 4;
        for (let n = 0; n < 3; n++) img.data[i + n] = lerp(high[n], low[n], mix);
        img.data[i + 3] = tone * 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function roofPath(ctx, x, w, top, eave, inset) {
    const lift = (eave - top) * 0.16;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, eave - lift);
    ctx.quadraticCurveTo(x - w / 2 + inset * 0.45, eave - (eave - top) * 0.3, x - w / 2 + inset, top);
    ctx.lineTo(x + w / 2 - inset, top);
    ctx.quadraticCurveTo(x + w / 2 - inset * 0.45, eave - (eave - top) * 0.3, x + w / 2, eave - lift);
    ctx.quadraticCurveTo(x, eave + lift, x - w / 2, eave - lift);
  }

  function paintTiles(ctx, x, w, top, eave, ink, step) {
    const bar = Math.max(1, step * 0.34);
    for (let tx = x - w / 2; tx < x + w / 2; tx += step) {
      const lean = ((tx - x) / w) * (eave - top) * 0.7;
      const a = tx - lean * 0.3;
      const b = tx + lean;
      poly(ctx, ink.tile, [a, top, b, eave + 2, b + bar, eave + 2, a + bar, top]);
    }
  }

  function paintRoof(ctx, g, x, w, top, eave, ink) {
    const inset = (eave - top) * 1.15;
    roofPath(ctx, x, w, top, eave, inset);
    ctx.fillStyle = ink.roof;
    ctx.fill();
    ctx.save();
    roofPath(ctx, x, w, top, eave, inset);
    ctx.clip();
    paintTiles(ctx, x, w, top, eave, ink, Math.max(2, ink.tileStep * g.U));
    ctx.restore();
    const ridge = Math.max(1, ink.ridge * g.U);
    const left = x - w / 2 + inset - ridge;
    const span = w - inset * 2 + ridge * 2;
    rect(ctx, ink.rim, left, top - ridge * 0.9, span, ridge);
    rect(ctx, ink.cap, left, top - ridge * 0.1, span, ridge * 0.8);
    disc(ctx, ink.cap, left, top - ridge * 0.2, ridge * 1.25);
    disc(ctx, ink.cap, left + span, top - ridge * 0.2, ridge * 1.25);
  }

  function paintWall(ctx, g, rand, x, w, top, base, ink) {
    rect(ctx, ink.wall, x - w * 0.47, top, w * 0.94, base - top);
    if (!ink.windows) return;
    const size = g.U * ink.windows;
    const count = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const wx = x - w * 0.34 + rand() * w * 0.5;
      const ww = size * (1 + rand() * 0.8);
      const wy = top + size * 0.5;
      rect(ctx, rand() < 0.6 ? '#f1c97e' : ink.dark, wx, wy, ww, size * 0.9);
      rect(ctx, ink.dark, wx + ww / 2, wy, Math.max(1, g.U * 0.35), size * 0.9);
    }
  }

  function paintRow(ctx, g, rand, ink, baseY) {
    const u = g.U;
    let x = -u * ink.wMax * rand() * 0.5;
    while (x < g.W + u * ink.wMax) {
      const w = u * lerp(ink.wMin, ink.wMax, rand());
      const roofH = u * lerp(ink.rMin, ink.rMax, rand());
      const wallH = u * lerp(ink.hMin, ink.hMax, rand());
      const eave = baseY + u * rand() * ink.jitter - wallH;
      paintWall(ctx, g, rand, x + w / 2, w, eave - u, eave + wallH + u * 40, ink);
      paintRoof(ctx, g, x + w / 2, w, eave - roofH, eave, ink);
      x += w * lerp(0.62, 0.98, rand());
    }
  }

  const FAR_ROW = { roof: '#d08a6c', tile: '#bf7a64', rim: '#f8d08e', cap: '#b06e60', wall: '#c07e68', dark: '#a0645a', windows: 0, ridge: 0.45, tileStep: 2, wMin: 13, wMax: 24, rMin: 3, rMax: 5, hMin: 1, hMax: 3, jitter: 2 };
  const MID_ROW = { roof: '#ae767c', tile: '#7c4e5c', rim: '#f8cc88', cap: '#6e4656', wall: '#7e5560', dark: '#5c3c4c', windows: 1.5, ridge: 0.6, tileStep: 1.8, wMin: 22, wMax: 36, rMin: 5.5, rMax: 8, hMin: 2, hMax: 4, jitter: 3 };
  const NEAR_ROW = { roof: '#8e7084', tile: '#4e3a4e', rim: '#fbcf8c', cap: '#4e3a4e', wall: '#8e6a68', dark: '#3c2e3e', windows: 2.6, ridge: 0.9, tileStep: 2.2, wMin: 34, wMax: 66, rMin: 8, rMax: 13, hMin: 5, hMax: 8, jitter: 5 };

  function paintTown(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8ab7c';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.76 - fbm(x * 0.012, 3, 3, 8) * 0.07));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    paintRow(ctx, g, rand, FAR_ROW, g.H * 0.785);
    paintRow(ctx, g, rand, MID_ROW, g.H * 0.855);
    rect(ctx, '#6e4a58', 0, g.H * 0.9, g.W, g.H * 0.1);
    paintRow(ctx, g, rand, NEAR_ROW, g.H);
    return c;
  }

  function farWire(ctx, x0, y0, cx, cy, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }

  function paintPole(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const x = state.poleX;
    ctx.strokeStyle = WIRE;
    ctx.lineWidth = Math.max(1, u * 0.45);
    farWire(ctx, x + u * 7, g.H * 0.11, g.W * 0.55, g.H * 0.27, g.W + 2, g.H * 0.12);
    farWire(ctx, x - u * 7, g.H * 0.11, g.W * 0.5, g.H * 0.29, g.W + 2, g.H * 0.15);
    farWire(ctx, x + u, g.H * 0.57, g.W * 0.24, g.H * 0.78, g.W * 0.4, g.H * 0.8);
    paintPoleBody(ctx, g, x);
    paintCrossarm(ctx, g, x, g.H * 0.1);
    paintCrossarm(ctx, g, x, state.wire.y0);
    paintTransformer(ctx, g, x, g.H * 0.31);
    return c;
  }

  function paintPoleBody(ctx, g, x) {
    const u = g.U;
    poly(ctx, '#54404a', [x - u * 1.6, 0, x + u * 1.6, 0, x + u * 2.4, g.H, x - u * 2.4, g.H]);
    rect(ctx, POLE_LIT, x + u * 0.7, 0, Math.max(1, u * 0.9), g.H);
    for (let i = 0; i < 9; i++) rect(ctx, '#35262f', x + (i % 2 ? u * 1.6 : -u * 3.2), g.H * (0.6 + i * 0.045), u * 1.6, Math.max(1, u * 0.5));
  }

  function paintCrossarm(ctx, g, x, y) {
    const u = g.U;
    rect(ctx, POLE_DIM, x - u * 8.5, y, u * 17, u * 1.3);
    rect(ctx, POLE_LIT, x - u * 8.5, y, u * 17, Math.max(1, u * 0.35));
    for (const dx of [-7, 7]) {
      disc(ctx, '#e6d7bd', x + u * dx, y - u * 0.5, u * 0.95, u * 1.25);
      rect(ctx, '#8d7a70', x + u * dx - u * 0.9, y - u * 0.5, u * 1.8, Math.max(1, u * 0.3));
    }
  }

  function paintTransformer(ctx, g, x, y) {
    const u = g.U;
    disc(ctx, '#7c686e', x - u * 4.4, y - u * 5, u * 3, u * 1.1);
    disc(ctx, '#7c686e', x - u * 4.4, y + u * 5, u * 3, u * 1.1);
    rect(ctx, '#7c686e', x - u * 7.4, y - u * 5, u * 6, u * 10);
    rect(ctx, POLE_LIT, x - u * 2.4, y - u * 5, Math.max(1, u * 0.7), u * 10);
    for (const dy of [-2.4, 0, 2.4]) rect(ctx, '#4a3844', x - u * 7.4, y + dy * u, u * 6, Math.max(1, u * 0.4));
  }

  // ---- the wire ----
  function wireBase(x) {
    const w = state.wire;
    const f = (x - w.xv) / (w.x0 - w.xv);
    return w.yv - (w.yv - w.y0) * f * f;
  }

  // Height of the wire now: the curve, the slow sway, the bounce, a dip under each bird.
  function wireY(x, t) {
    const g = state.g;
    const along = (x - state.wire.x0) / (g.W * 1.1);
    const shape = Math.sin(Math.min(1, Math.max(0, along)) * Math.PI);
    let y = wireBase(x) + shape * (state.bob * g.U + Math.sin(t * 0.55) * g.U * 0.5 * state.breeze);
    for (const b of state.birds) {
      if (b.mode > MODE.CROUCH) continue;
      const d = (x - b.x) / (g.U * 16);
      if (d > -1 && d < 1) y += g.U * b.s * 1.1 * (1 - d * d) * (1 - d * d);
    }
    return y;
  }

  function strokeWire(ctx, colour, width, shift, x0, step) {
    const ys = state.wireYs;
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, ys[0] + shift);
    for (let i = 1; i <= WIRE_STEPS; i++) ctx.lineTo(x0 + i * step, ys[i] + shift);
    ctx.stroke();
  }

  function drawWire(ctx, g, t) {
    const x0 = state.wire.x0;
    const step = (g.W + 4 - x0) / WIRE_STEPS;
    for (let i = 0; i <= WIRE_STEPS; i++) state.wireYs[i] = wireY(x0 + i * step, t);
    strokeWire(ctx, WIRE, Math.max(2, g.U * 1.25), 0, x0, step);
    strokeWire(ctx, WIRE_LIT, Math.max(0.7, g.U * 0.3), -g.U * 0.45, x0, step);
  }

  // ---- birds alive ----
  function makeBirds(g, rand) {
    const count = Math.max(3, Math.min(SCALES.length, Math.round(g.W / g.U / 30)));
    const x0 = state.wire.x0 + g.U * 18;
    const x1 = g.W * 0.95;
    let total = 0;
    for (let i = 0; i < count - 1; i++) total += GAPS[i];
    const birds = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      birds.push(makeBird(g, rand, i, lerp(x0, x1, sum / total), (x1 - x0) / total));
      sum += GAPS[Math.min(i, GAPS.length - 1)];
    }
    return birds;
  }

  function makeBird(g, rand, i, home, spacing) {
    return {
      hero: i === HERO, home, x: home, range: spacing * (i === HERO ? 0.06 : 0.12),
      s: g.U * 0.86 * SCALES[i], kind: KINDS[i], face: FACES[i], phase: rand() * 6.28,
      look: 1, tilt: 0, tiltTo: 0, lookAt: 0.3 + rand() * 2,
      puff: rand() * 0.6, puffTo: rand(), puffAt: 2 + rand() * 5,
      hopAt: 3 + rand() * 9, hops: 0, hop: -1, hopFrom: home, hopTo: home,
      shake: 0, squash: 0, flick: 0,
      mode: MODE.PERCHED, clock: 0, dir: 1, fromX: 0, fromY: 0,
    };
  }

  function updateHead(b, dt, rate, rand) {
    b.lookAt -= dt * rate;
    if (b.lookAt <= 0) {
      const roll = rand();
      b.look = roll < 0.54 ? 1 : roll < 0.74 ? 0 : -1;
      b.tiltTo = (rand() - 0.5) * 0.5;
      b.lookAt = 0.5 + rand() * rand() * 5;
    }
    b.tilt += (b.tiltTo - b.tilt) * Math.min(1, dt * 16);
  }

  function updatePuff(b, dt, rate, rand) {
    b.puffAt -= dt * rate;
    if (b.puffAt <= 0) {
      b.puffTo = rand() * rand() < 0.2 ? 0 : 0.4 + rand() * 0.8;
      b.puffAt = 4 + rand() * 7;
      if (rand() < 0.3) b.shake = 0.5;
      if (rand() < 0.5) b.flick = 1;
    }
    b.puff += (b.puffTo - b.puff) * Math.min(1, dt * 0.9);
    b.shake = Math.max(0, b.shake - dt);
    b.squash *= Math.max(0, 1 - dt * 9);
    b.flick = Math.max(0, b.flick - dt * 3);
  }

  function startHop(b, g, rand) {
    const step = g.U * (1.6 + rand() * 2.2);
    let dir = b.x < b.home ? 1 : -1;
    if (rand() < 0.3) dir = -dir;
    b.hop = 0;
    b.hopFrom = b.x;
    b.hopTo = Math.max(b.home - b.range, Math.min(b.home + b.range, b.x + dir * step));
    if (rand() < 0.22) b.face = -b.face;
  }

  function updateHop(b, g, dt, rate, rand) {
    if (b.hop >= 0) {
      b.hop += dt / 0.2;
      if (b.hop >= 1) {
        b.hop = -1;
        b.x = b.hopTo;
        state.bobV += 0.5;
        return;
      }
      b.x = lerp(b.hopFrom, b.hopTo, b.hop);
      return;
    }
    b.hopAt -= dt * rate;
    if (b.hopAt > 0) return;
    if (b.hops === 0) b.hops = 1 + Math.floor(rand() * 3);
    b.hops -= 1;
    b.hopAt = b.hops > 0 ? 0.28 : 4 + rand() * 10;
    startHop(b, g, rand);
  }

  function launch(b, t) {
    b.mode = MODE.LEAVING;
    b.clock = 0;
    b.fromX = b.x;
    b.fromY = wireY(b.x, t) - b.s * 14;
    b.dir = b.home < state.birds[HERO].home ? -1 : 1;
    state.bobV -= 5;
  }

  function reroll(b, rand) {
    const roll = rand();
    b.kind = roll < 0.5 ? 'side' : roll < 0.75 ? 'front' : 'back';
    b.face = rand() < 0.5 ? 1 : -1;
    b.dir = b.home < state.birds[HERO].home ? 1 : -1;
    b.x = b.home + (rand() - 0.5) * b.range;
    b.fromX = b.dir > 0 ? -state.g.W * 0.12 : state.g.W * 1.12;
    b.fromY = state.g.H * (0.05 + rand() * 0.3);
    b.look = 1;
  }

  function land(b) {
    b.mode = MODE.PERCHED;
    b.squash = -0.14;
    b.shake = 0.35;
    b.puff = 0.1;
    b.puffTo = 0.7;
    b.lookAt = 0.4;
    state.bobV += 6;
  }

  function updateFlight(b, t, dt, restless, rand) {
    b.clock += dt;
    if (b.mode === MODE.CROUCH && b.clock > 0.28) launch(b, t);
    else if (b.mode === MODE.LEAVING && b.clock > 2.6) {
      b.mode = MODE.AWAY;
      b.clock = -(2.5 + rand() * 7) / Math.max(0.3, restless);
    } else if (b.mode === MODE.AWAY && b.clock > 0) {
      b.mode = MODE.ARRIVING;
      reroll(b, rand);
    } else if (b.mode === MODE.ARRIVING && b.clock > 2.4) land(b);
  }

  function chooseLeaver(dt, restless, rand) {
    if (restless < 0.05) return;
    state.leaveAt -= dt * restless;
    if (state.leaveAt > 0) return;
    state.leaveAt = 7 + rand() * 11;
    const birds = state.birds;
    const start = Math.floor(rand() * birds.length);
    for (let i = 0; i < birds.length; i++) {
      const b = birds[(start + i) % birds.length];
      if (b.hero || b.mode !== MODE.PERCHED || b.hop >= 0) continue;
      b.mode = MODE.CROUCH;
      b.clock = 0;
      b.squash = -0.1;
      return;
    }
  }

  function updateBirds(g, t, dt, api) {
    const restless = api.props.restless;
    const rate = 0.25 + restless;
    const rand = state.rand;
    chooseLeaver(dt, restless, rand);
    for (const b of state.birds) {
      if (b.mode !== MODE.PERCHED) updateFlight(b, t, dt, restless, rand);
      if (b.mode > MODE.CROUCH) continue;
      updateHead(b, dt, rate, rand);
      updatePuff(b, dt, rate, rand);
      if (b.mode === MODE.PERCHED) updateHop(b, g, dt, restless, rand);
    }
    state.bobV += (-state.bob * 26 - state.bobV * 2.2) * dt;
    state.bob += state.bobV * dt;
  }

  function perchHeight(b, t) {
    const lift = b.hop >= 0 ? Math.sin(b.hop * Math.PI) * b.s * 4 : 0;
    return wireY(b.x, t) - lift;
  }

  function drawPerched(ctx, b, t) {
    const parts = state.kinds[b.kind];
    const sp = state.sprites;
    const breath = Math.sin(t * 2.1 + b.phase) * 0.014;
    const shiver = b.shake > 0 ? Math.sin(t * 46) * 0.035 : 0;
    const crouch = b.mode === MODE.CROUCH ? 0.1 : 0;
    const sx = b.s * b.face * (1 + 0.15 * b.puff + breath + shiver + crouch * 0.4);
    const sy = b.s * (1 + 0.04 * b.puff - breath + b.squash - crouch);
    ctx.save();
    ctx.translate(b.x, perchHeight(b, t) - b.s * BODY_LIFT);
    ctx.scale(sx, sy);
    ctx.save();
    ctx.translate(parts.tx, parts.ty);
    ctx.rotate(parts.ta - b.flick * 0.22);
    ctx.drawImage(sp.tail, -TAIL / 2, -1, TAIL, TAIL * parts.tl);
    ctx.restore();
    ctx.drawImage(parts.body, -ORIGIN_X, -ORIGIN_Y, SPRITE, SPRITE);
    ctx.translate(parts.hx - (b.look < 0 ? parts.hx * 0.7 : 0), parts.hy + b.puff * 2.4);
    ctx.rotate(b.tilt);
    if (b.look < 0) ctx.scale(-1, 1);
    ctx.drawImage(b.look === 0 ? parts.rest : sp.headSide, -HEAD_X, -HEAD_Y, HEAD, HEAD);
    ctx.restore();
  }

  function drawFeet(ctx, b, t) {
    ctx.save();
    ctx.translate(b.x, perchHeight(b, t));
    ctx.scale(b.s * b.face, b.s);
    ctx.drawImage(state.sprites.feet, -TAIL / 2, -TAIL / 2, TAIL, TAIL);
    ctx.restore();
  }

  function drawFlyer(ctx, img, x, y, s, face, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * face, s);
    ctx.rotate(angle);
    ctx.drawImage(img, -32, -32, SPRITE, SPRITE);
    ctx.restore();
  }

  function drawLeaving(ctx, g, b) {
    const u = Math.min(1, b.clock / 2.6);
    const img = state.sprites.flaps[FLAP_ORDER[Math.floor(b.clock * 17) % 4]];
    const x = b.fromX + b.dir * g.W * 0.8 * Math.pow(u, 1.45);
    const y = lerp(b.fromY, -g.H * 0.3, Math.pow(u, 1.1)) + Math.sin(u * 13) * g.U * 1.6;
    drawFlyer(ctx, img, x, y, b.s * lerp(1, 0.55, u), b.dir, -0.32);
  }

  function drawArriving(ctx, g, b, t) {
    const u = Math.min(1, b.clock / 2.4);
    const e = 1 - (1 - u) * (1 - u);
    const sp = state.sprites;
    const flaring = u > 0.74;
    const beat = Math.floor(b.clock * (flaring ? 11 : 17));
    const img = flaring ? (beat % 2 ? sp.flare : sp.flaps[1]) : sp.flaps[FLAP_ORDER[beat % 4]];
    const x = lerp(b.fromX, b.x, e);
    const y = lerp(b.fromY, wireY(b.x, t) - b.s * 14, e) + Math.sin(u * 11) * g.U * 1.2 * (1 - u);
    drawFlyer(ctx, img, x, y, b.s * lerp(0.55, 1, e), b.dir, lerp(-0.08, -0.62, smoothstep(0.55, 1, u)));
  }

  // ---- what keeps moving behind them ----
  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const w = c.width * 2;
    const h = c.height * 2;
    const drift = t * g.U * Math.max(0.1, state.breeze);
    const a = -((drift * 0.55) % w);
    ctx.drawImage(c, a, g.H * 0.02, w, h);
    ctx.drawImage(c, a + w, g.H * 0.02, w, h);
    const b = -((drift * 0.95 + w * 0.4) % w);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(c, b, g.H * 0.2, w, h * 0.72);
    ctx.drawImage(c, b + w, g.H * 0.2, w, h * 0.72);
    ctx.globalAlpha = 1;
  }

  function makeFlock(g, rand) {
    return Array.from({ length: FLOCK }, (_, i) => ({
      dx: (i + rand() * 0.6) * g.U * 4.2,
      dy: (Math.abs(i - 3) + rand() * 0.8) * g.U * 1.6,
      phase: rand() * 6.28,
    }));
  }

  // Far crows going home along the top of the sky, then a while with none.
  function drawFlock(ctx, g, t) {
    const span = g.W + g.U * 50;
    const head = g.W + g.U * 8 - ((t * g.U * 1.5 + span * 0.42) % (span * 1.3));
    const wing = g.U * 1.3;
    ctx.strokeStyle = CROW;
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    for (const b of state.flock) {
      const x = head + b.dx;
      const y = g.H * 0.03 + b.dy;
      const beat = Math.sin(t * 3.6 + b.phase) * g.U * 0.7;
      ctx.moveTo(x - wing, y - beat);
      ctx.lineTo(x, y);
      ctx.lineTo(x + wing, y - beat);
    }
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.px = Math.max(1.5, g.U * 1.5);
    state.breeze = api.props.breeze;
    state.poleX = g.W * 0.07;
    state.wire = { x0: state.poleX + g.U * 7, y0: g.H * 0.46, xv: g.W * 0.62, yv: g.H * 0.68 };
    state.wireYs = new Float32Array(WIRE_STEPS + 1);
    bakeBirds();
    state.sky = paintSky(g);
    state.clouds = paintClouds(g, Math.ceil(g.W * 0.75), Math.ceil(g.H * 0.3));
    state.town = paintTown(g, rand);
    state.pole = paintPole(g);
    state.bob = 0;
    state.bobV = 0;
    state.leaveAt = 3.5;
    state.birds = makeBirds(g, rand);
    state.flock = makeFlock(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    state.breeze = api.props.breeze;
    updateBirds(g, t, Math.min(dt, 0.1), api);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    drawFlock(ctx, g, t);
    ctx.drawImage(state.town, 0, 0);
    ctx.drawImage(state.pole, 0, 0);
    ctx.lineCap = 'round';
    for (const b of state.birds) if (b.mode <= MODE.CROUCH) drawPerched(ctx, b, t);
    drawWire(ctx, g, t);
    for (const b of state.birds) if (b.mode <= MODE.CROUCH) drawFeet(ctx, b, t);
    for (const b of state.birds) {
      if (b.mode === MODE.LEAVING) drawLeaving(ctx, g, b);
      else if (b.mode === MODE.ARRIVING) drawArriving(ctx, g, b, t);
    }
  }

  Kasuri.run({
    defaults: { restless: 1, breeze: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
