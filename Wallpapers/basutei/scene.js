/*
 * バス停 Basutei — a lone country bus stop in steady summer rain.
 *
 * The land, the shelter and the wet road are baked once. Each frame only slides
 * two cloud tiles and a wind tile, sways a few hundred grass strokes, and draws
 * the rain, the drips off the eave and the rings on the puddles from reused arrays.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, lerp, smoothstep } = K;

  const MAX_RAIN = 520;
  const DRIPS = 30;
  const RINGS = 32;
  const RING_SPOTS = 180;
  const ROOF_TICKS = 26;
  const FAR_PEAKS = [[0.13, 0.33, 0.13], [0.5, 0.26, 0.14], [0.88, 0.31, 0.12]];
  const NEAR_PEAKS = [[0.02, 0.16, 0.08], [0.33, 0.19, 0.09], [0.76, 0.22, 0.08]];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function quad(ctx, a, b, c, d, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.fill();
  }

  function disc(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
  }

  function line(ctx, x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Every key position, so the land, the road and the moving parts agree.
  function makeLayout(g) {
    const s = Math.min(g.U, g.W / 125);
    const ground = g.H * 0.74;
    const cx = g.W * 0.6;
    const x0 = cx - s * 27;
    const x1 = cx + s * 27;
    return {
      s, ground, x0, x1,
      fieldTop: g.H * 0.5,
      roadTop: ground + s * 5,
      roadEnd: g.H * 0.955,
      signX: x0 - s * 21,
      eave: { x0: x0 - s * 4, x1: x1 + s * 4, y: ground - s * 34, land: ground + s * 3.6 },
      ridge: { x0: x0 - s * 12, x1: x1 - s * 6, y: ground - s * 50 },
    };
  }

  // Peaks sit at fixed fractions of the width: [where, how high, how broad].
  function ridgeLine(ctx, g, base, peaks, seed, freq) {
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      let top = 0;
      for (const [at, tall, broad] of peaks) {
        const d = (x / g.W - at) / broad;
        top = Math.max(top, tall / (1 + d * d));
      }
      const rough = (fbm((x / g.U) * freq, seed, 4, seed) - 0.5) * 0.14;
      ctx.lineTo(x, g.H * (base - top - rough));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintBack(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.55);
    sky.addColorStop(0, '#a8b5bb');
    sky.addColorStop(1, '#dde0d8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#7e9aa4';
    ridgeLine(ctx, g, 0.54, FAR_PEAKS, 3, 0.035);
    return c;
  }

  function paintNearRidge(g, rand) {
    const c = layer(g.W, g.H * 0.62);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4f7f72';
    ridgeLine(ctx, g, 0.58, NEAR_PEAKS, 11, 0.04);
    ctx.globalCompositeOperation = 'source-atop';
    const marks = ['#457165', '#649382', '#3e675b'];
    const count = g.W * g.H * 0.05;
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.25 + rand() * 0.35);
      const clump = noise2(x * 0.06 / g.U, y * 0.1 / g.U, 5);
      ctx.fillStyle = marks[clump > 0.55 ? 1 : clump < 0.42 ? 2 : 0];
      ctx.fillRect(x, y, g.U * (0.6 + rand() * 1.6), g.U * (0.5 + rand() * 0.9));
    }
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // A seamless tile of drifting cloud in a few flat tones.
  function paintMist(w, h, scaleX, scaleY, seed, tone, soft) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const [r, g, b] = K.parseColor(tone);
    const density = (x, y) => fbm(x * scaleX, y * scaleY, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const a = smoothstep(soft[0], soft[1], v) * band;
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = (Math.round(a * 6) / 6) * 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintStrip(ctx, g, rand, y0, y1, tone, marks, k) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, y1 + g.U);
    for (let x = 0; x <= g.W + 3; x += 3) {
      ctx.lineTo(x, y0 + (noise2((x / g.U) * 0.05, k * 3.1, 8) - 0.5) * g.U * (1 + k * 0.6));
    }
    ctx.lineTo(g.W, y1 + g.U);
    ctx.fill();
    const count = (g.W * (y1 - y0)) / (g.U * g.U) * 2.4;
    const tall = g.U * (0.5 + k * 0.42);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = marks[Math.floor(rand() * marks.length)];
      ctx.fillRect(rand() * g.W, lerp(y0, y1, rand()), Math.max(1, g.U * 0.5), tall * (0.6 + rand()));
    }
  }

  function paintClump(ctx, g, rand, x, y, w, h) {
    const tones = ['#3a6a52', '#4a7c5c', '#5f9265', '#7cab78'];
    const count = Math.round(w * h * 0.9);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI;
      const d = Math.sqrt(rand());
      const px = x + Math.cos(a) * d * w;
      const py = y - Math.sin(a) * d * h;
      const lit = smoothstep(0, h, y - py) * 0.7 + rand() * 0.3 - (px > x ? 0.15 : 0);
      disc(ctx, px, py, g.U * (0.5 + rand() * 1.5), tones[Math.max(0, Math.min(3, Math.floor(lit * 4)))]);
    }
  }

  function paintFarmhouse(ctx, u, x, y) {
    ctx.fillStyle = '#c8c4ac';
    ctx.fillRect(x - u * 6, y - u * 4.5, u * 12, u * 4.5);
    ctx.fillStyle = '#6e6a5c';
    ctx.fillRect(x - u * 2, y - u * 3.6, u * 3, u * 3.6);
    quad(ctx, [x - u * 8, y - u * 4.2], [x - u * 4.5, y - u * 9], [x + u * 4.5, y - u * 9], [x + u * 8, y - u * 4.2], '#46566e');
  }

  function paintPole(ctx, g, x, base) {
    const u = g.U;
    const top = g.H * 0.12;
    ctx.fillStyle = '#58524a';
    ctx.fillRect(x - u * 0.5, top, Math.max(1, u), base - top);
    ctx.fillRect(x - u * 3.4, top + u * 2, u * 6.8, Math.max(1, u * 0.6));
    ctx.strokeStyle = '#737e84';
    ctx.lineWidth = 1;
    for (const off of [-3, 3]) {
      ctx.beginPath();
      ctx.moveTo(x + u * off, top + u * 2);
      ctx.quadraticCurveTo(g.W * 0.55, top + u * (9 + off * 0.4), g.W + u, top + u * (1 + off * 0.5));
      ctx.stroke();
    }
  }

  function paintField(g, rand, L) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const tones = ['#9cb97a', '#8bb068', '#7ba85c', '#6f9f50', '#639549', '#578a42', '#4c7f3c', '#44763a'];
    const marks = ['#b0c98a', '#7fa45a', '#5e8e48', '#99bd6c'];
    const n = tones.length;
    const span = L.ground + g.U * 2 - L.fieldTop;
    for (let k = 0; k < n; k++) {
      const y0 = L.fieldTop + span * Math.pow(k / n, 1.5);
      const y1 = L.fieldTop + span * Math.pow((k + 1) / n, 1.5);
      paintStrip(ctx, g, rand, y0, y1, tones[k], marks, k);
      if (k === 1) paintFarmhouse(ctx, g.U, g.W * 0.88, y1);
      if (k === 2) paintClump(ctx, g, rand, g.W * 0.15, y1, g.U * 20, g.U * 17);
      if (k === 3) paintPole(ctx, g, g.W * 0.06, y1);
    }
    return c;
  }

  function paintPlanks(ctx, g, rand, left, right, topAt, botAt, count, tones, seam) {
    for (let i = 0; i < count; i++) {
      const a = lerp(left, right, i / count);
      const b = lerp(left, right, (i + 1) / count);
      const tone = tones[Math.floor(rand() * tones.length)];
      quad(ctx, [a, topAt(a)], [b, topAt(b)], [b, botAt(b)], [a, botAt(a)], tone);
      ctx.strokeStyle = seam;
      ctx.lineWidth = Math.max(0.7, g.U * 0.3);
      line(ctx, a, topAt(a), a, botAt(a));
    }
  }

  function paintBench(ctx, L, x0, x1, floorY) {
    const s = L.s;
    const seat = floorY - s * 11;
    ctx.fillStyle = '#4a392b';
    for (const f of [0.06, 0.5, 0.94]) ctx.fillRect(lerp(x0, x1, f) - s, seat, s * 2, s * 11 + s * 2);
    quad(ctx, [x0, seat - s * 2.4], [x1, seat - s * 2.4], [x1 + s, seat], [x0 + s, seat], '#c2a678');
    ctx.fillStyle = '#7d6244';
    ctx.fillRect(x0 + s, seat, x1 - x0, s * 1.8);
    const cx = lerp(x0, x1, 0.2);
    ctx.fillStyle = '#3f5a86';
    ctx.fillRect(cx - s * 5.6, seat - s * 1.9, s * 12.2, s * 1.3);
    quad(ctx, [cx - s * 6.4, seat - s * 3.5], [cx + s * 5.6, seat - s * 3.5], [cx + s * 6.6, seat - s * 1.8], [cx - s * 5.6, seat - s * 1.8], '#6c8cb2');
  }

  // A folded umbrella stood on its tip, drawn along its own axis.
  function paintUmbrella(ctx, L, x, y, lean) {
    const s = L.s;
    const len = s * 30;
    const w = s * 2.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#d8d4c4';
    ctx.lineWidth = Math.max(1, s * 0.5);
    line(ctx, 0, 0, 0, -len * 0.1);
    ctx.fillStyle = '#c64b30';
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.06);
    ctx.quadraticCurveTo(w * 0.9, -len * 0.4, w, -len * 0.74);
    ctx.lineTo(w * 0.62, -len * 0.8);
    ctx.lineTo(-w * 0.62, -len * 0.8);
    ctx.lineTo(-w, -len * 0.74);
    ctx.quadraticCurveTo(-w * 0.9, -len * 0.4, 0, -len * 0.06);
    ctx.fill();
    ctx.strokeStyle = '#8c3122';
    ctx.lineWidth = Math.max(1, s * 0.5);
    for (const side of [-0.4, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.1);
      ctx.quadraticCurveTo(side * w, -len * 0.45, side * w * 1.2, -len * 0.76);
      ctx.stroke();
    }
    ctx.fillStyle = '#ea8a62';
    ctx.fillRect(-w * 0.72, -len * 0.7, Math.max(1, s * 0.5), len * 0.2);
    ctx.fillStyle = '#7c2b1e';
    ctx.fillRect(-w * 0.72, -len * 0.58, w * 1.44, Math.max(1, s * 0.7));
    ctx.strokeStyle = '#e6c88c';
    ctx.lineWidth = Math.max(1, s * 0.95);
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.8);
    ctx.lineTo(0, -len * 0.94);
    ctx.arc(s * 1.8, -len * 0.94, s * 1.8, Math.PI, 0, false);
    ctx.stroke();
    ctx.restore();
  }

  function paintWindow(ctx, s, x, y) {
    const w = s * 13;
    const h = s * 9;
    ctx.fillStyle = '#a6c0a0';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#7ca35e';
    ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
    ctx.fillStyle = '#3f3024';
    ctx.strokeStyle = '#3f3024';
    ctx.lineWidth = s * 0.9;
    ctx.fillRect(x + w * 0.5 - s * 0.4, y, s * 0.8, h);
    ctx.strokeRect(x - s * 0.4, y - s * 0.4, w + s * 0.8, h + s * 0.8);
  }

  function paintInterior(ctx, g, rand, L, p) {
    const s = L.s;
    const seam = '#5f4a36';
    quad(ctx, [p.bx0, p.bb], [p.bx1, p.bb], [L.x1, p.fb], [L.x0, p.fb], '#8c8a7c');
    const flat = (y) => () => y;
    paintPlanks(ctx, g, rand, p.bx0, p.bx1, flat(p.bt), flat(p.bb), 13, ['#9a7f5e', '#907554', '#a58a68'], seam);
    const slope = (y0, y1) => (x) => lerp(y0, y1, (x - p.bx1) / (L.x1 - p.bx1));
    paintPlanks(ctx, g, rand, p.bx1, L.x1, slope(p.bt, p.ft), slope(p.bb, p.fb), 4, ['#a68a66', '#9b7f5c'], seam);
    paintWindow(ctx, s, L.x0 + s * 6, L.ground - s * 30);
    ctx.fillStyle = '#ddd6bd';
    ctx.fillRect(L.x0 + s * 26, L.ground - s * 30, s * 7, s * 9);
    const shade = ctx.createLinearGradient(0, L.ground - s * 34, 0, L.ground - s * 27);
    shade.addColorStop(0, 'rgba(40,30,26,0.55)');
    shade.addColorStop(1, 'rgba(40,30,26,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(L.x0, L.ground - s * 34, L.x1 - L.x0, s * 7);
    paintBench(ctx, L, L.x0 + s * 2, p.bx1 - s * 1.5, p.bb + s * 1.5);
    paintUmbrella(ctx, L, L.x1 - s * 18, L.ground + s * 0.2, 0.25);
  }

  function paintLeftWall(ctx, g, rand, L, p) {
    const topAt = (x) => lerp(p.bt, p.ft, (x - p.bx0) / (L.x0 - p.bx0));
    const botAt = (x) => lerp(p.bb, p.fb, (x - p.bx0) / (L.x0 - p.bx0));
    paintPlanks(ctx, g, rand, p.bx0, L.x0, topAt, botAt, 4, ['#b0966f', '#a68c66', '#ba9f7a'], '#74604a');
    ctx.fillStyle = '#5f8a4c';
    for (let i = 0; i < 30; i++) {
      const x = lerp(p.bx0, L.x0, rand());
      ctx.fillRect(x, botAt(x) - L.s * (0.5 + rand() * 3), Math.max(1, L.s * 0.6), L.s * 2);
    }
  }

  function paintRoof(ctx, g, rand, L) {
    const E = L.eave;
    const R = L.ridge;
    const ribs = 34;
    const steps = 12;
    for (let i = 0; i < ribs; i++) {
      const lit = i % 2 === 0;
      for (let j = 0; j < steps; j++) {
        const n = noise2(i * 0.28, j * 0.42, 31) + (rand() - 0.5) * 0.12;
        const rust = n > 0.52 ? (lit ? '#b76a3c' : '#8a4b2e') : n > 0.4 ? (lit ? '#a58a70' : '#6f5c50') : lit ? '#a9aca4' : '#74766f';
        const f0 = j / steps;
        const f1 = (j + 1) / steps;
        const pt = (fi, fj) => [lerp(lerp(R.x0, R.x1, fi), lerp(E.x0, E.x1, fi), fj), lerp(R.y, E.y, fj)];
        quad(ctx, pt(i / ribs, f0), pt((i + 1) / ribs, f0), pt((i + 1) / ribs, f1 + 0.01), pt(i / ribs, f1 + 0.01), rust);
      }
    }
    quad(ctx, [R.x0 - L.s, R.y - L.s], [R.x1 + L.s, R.y - L.s], [R.x1, R.y + L.s * 0.6], [R.x0, R.y + L.s * 0.6], '#7c6d60');
    ctx.fillStyle = '#3a2d24';
    ctx.fillRect(E.x0, E.y, E.x1 - E.x0, L.s * 1.7);
    ctx.fillStyle = '#c3b9a0';
    ctx.fillRect(E.x0, E.y - Math.max(1, L.s * 0.3), E.x1 - E.x0, Math.max(1, L.s * 0.5));
  }

  function paintShelter(g, rand, L) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = L.s;
    const p = {
      fb: L.ground + s,
      bb: L.ground - s * 5,
      ft: L.ground - s * 36,
      bt: L.ground - s * 47,
      bx0: L.x0 - s * 9,
      bx1: L.x1 - s * 9,
    };
    paintInterior(ctx, g, rand, L, p);
    paintLeftWall(ctx, g, rand, L, p);
    for (const x of [L.x0, L.x1]) {
      ctx.fillStyle = '#5b4632';
      ctx.fillRect(x - s * 1.5, p.ft, s * 3, p.fb - p.ft);
      ctx.fillStyle = '#86694a';
      ctx.fillRect(x - s * 1.5, p.ft, Math.max(1, s * 0.9), p.fb - p.ft);
    }
    paintRoof(ctx, g, rand, L);
    return c;
  }

  function paintSign(g, rand, L) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = L.s;
    const x = L.signX;
    const y = L.ground + s * 1.5;
    ctx.fillStyle = '#7f7f76';
    ctx.fillRect(x - s * 4.5, y - s * 2.5, s * 9, s * 3.4);
    ctx.fillStyle = '#a5a498';
    ctx.fillRect(x - s * 4.5, y - s * 2.5, s * 9, s);
    ctx.fillStyle = '#a7a292';
    ctx.fillRect(x - s * 0.9, y - s * 50, s * 1.8, s * 48);
    ctx.fillStyle = '#74523a';
    ctx.fillRect(x - s * 0.9, y - s * 10, s * 1.8, s * 8);
    paintSignPanel(ctx, rand, s, x, y - s * 34);
    paintSignDisc(ctx, rand, s, x, y - s * 47);
    return c;
  }

  function paintSignPanel(ctx, rand, s, x, y) {
    ctx.fillStyle = '#6d5a48';
    ctx.fillRect(x - s * 5.5, y, s * 11, s * 14);
    ctx.fillStyle = '#d2cbb2';
    ctx.fillRect(x - s * 4.6, y + s * 0.9, s * 9.2, s * 12.2);
    const tones = ['#b98f68', '#c6a585', '#a97a52'];
    for (let i = 0; i < 26; i++) {
      const corner = i % 2 ? -1 : 1;
      ctx.fillStyle = tones[i % 3];
      ctx.fillRect(x + corner * s * (4.2 - rand() * rand() * 5), y + s * (13 - rand() * rand() * 7), s * (0.5 + rand()), s * (0.4 + rand() * 0.6));
    }
  }

  function paintSignDisc(ctx, rand, s, x, y) {
    const r = s * 10;
    disc(ctx, x, y, r, '#8f4a2c');
    disc(ctx, x, y, r * 0.8, '#e4dcc0');
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, 6.3);
    ctx.clip();
    paintDiscStains(ctx, rand, s, x, y, r);
    ctx.restore();
  }

  // Rust creeps in from the rim and runs down faintly. Nothing near the middle.
  function paintDiscStains(ctx, rand, s, x, y, r) {
    const tones = ['#c79468', '#b77e52', '#d3ad86'];
    for (let i = 0; i < 46; i++) {
      const a = 0.5 + rand() * 2.1;
      const d = r * (0.66 + rand() * 0.16);
      disc(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, s * (0.4 + rand() * 0.9), tones[i % 3]);
    }
    ctx.fillStyle = '#d3b896';
    for (let i = 0; i < 16; i++) {
      const a = 3.5 + rand() * 2.4;
      const px = x + Math.cos(a) * r * 0.76;
      const py = y + Math.sin(a) * r * 0.76;
      ctx.fillRect(px, py, Math.max(1, s * 0.3), s * (0.8 + rand() * 2));
    }
  }

  function makePuddles(g, L) {
    const d = L.roadEnd - L.roadTop;
    const s = g.U;
    return [
      { x: L.x0 + s * 22, y: L.roadTop + d * 0.42, rx: s * 36, ry: s * 5.6 },
      { x: L.signX - s * 5, y: L.roadTop + d * 0.66, rx: s * 22, ry: s * 3.6 },
      { x: g.W * 0.92, y: L.roadTop + d * 0.72, rx: s * 15, ry: s * 3 },
    ];
  }

  function tracePuddle(ctx, p, i) {
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const a = (k / 40) * 6.2832;
      const wob = 0.72 + noise2(Math.cos(a) * 1.6 + i * 5, Math.sin(a) * 1.6, 41) * 0.56;
      const x = p.x + Math.cos(a) * p.rx * wob;
      const y = p.y + Math.sin(a) * p.ry * wob;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function paintRoadSurface(ctx, g, rand, L) {
    ctx.fillStyle = '#9a9c8e';
    ctx.beginPath();
    ctx.moveTo(0, L.roadTop + g.U);
    for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, L.ground - g.U * 0.6 + noise2((x / g.U) * 0.14, 2, 9) * g.U * 2);
    ctx.lineTo(g.W, L.roadTop + g.U);
    ctx.fill();
    ctx.fillStyle = '#7f8176';
    for (let i = 0; i < g.W * 0.5; i++) ctx.fillRect(rand() * g.W, lerp(L.ground, L.roadTop, rand()), Math.max(1, g.U * 0.5), 1);
    const bands = ['#939da1', '#8a9499', '#818c91', '#788389', '#6f7a81'];
    bands.forEach((tone, i) => {
      ctx.fillStyle = tone;
      ctx.fillRect(0, lerp(L.roadTop, L.roadEnd, i / bands.length), g.W, g.H);
    });
    const marks = ['#7d888e', '#a0aaad', '#69747a', '#909a9e'];
    const count = (g.W * (L.roadEnd - L.roadTop)) / (g.U * g.U) * 1.3;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = marks[Math.floor(rand() * marks.length)];
      ctx.fillRect(rand() * g.W, lerp(L.roadTop, L.roadEnd, rand()), g.U * (1 + rand() * 7), Math.max(1, g.U * 0.35));
    }
    ctx.fillStyle = '#d2d1be';
    for (let x = 0; x < g.W; x += g.U * 2.6) {
      if (noise2((x / g.U) * 0.09, 7, 13) > 0.38) ctx.fillRect(x, L.roadTop + g.U * 1.6, g.U * 2.6, Math.max(1, g.U * 0.7));
    }
    ctx.fillStyle = '#747c76';
    ctx.fillRect(L.eave.x0, L.eave.land - L.s * 0.9, L.eave.x1 - L.eave.x0, L.s * 1.8);
  }

  // Scaled down and back up, so a reflection is a soft shape and not a second drawing.
  function softCopy(g, source) {
    const small = layer(g.W / 5, g.H / 5);
    small.getContext('2d').drawImage(source, 0, 0, small.width, small.height);
    const c = layer(g.W, g.H);
    c.getContext('2d').drawImage(small, 0, 0, g.W, g.H);
    return c;
  }

  function paintPuddles(ctx, g, L, mirrors) {
    state.puddles.forEach((p, i) => {
      ctx.save();
      tracePuddle(ctx, p, i);
      ctx.fillStyle = '#c6d2d4';
      ctx.fill();
      ctx.clip();
      ctx.translate(0, 2 * (L.ground + g.U * 2));
      ctx.scale(1, -1);
      ctx.globalAlpha = 0.42;
      for (const m of mirrors) ctx.drawImage(m, 0, 0);
      ctx.restore();
      ctx.strokeStyle = '#5c666c';
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      tracePuddle(ctx, p, i);
      ctx.stroke();
    });
  }

  function paintVerge(ctx, g, rand, L) {
    ctx.fillStyle = '#4b7a3e';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, L.roadEnd + (noise2((x / g.U) * 0.08, 4, 15) - 0.5) * g.U * 3);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    const marks = ['#6c9a50', '#3c6a38', '#86ad5e', '#568746'];
    for (let i = 0; i < g.W * 2.5; i++) {
      ctx.fillStyle = marks[Math.floor(rand() * marks.length)];
      ctx.fillRect(rand() * g.W, L.roadEnd - g.U * 1.5 + rand() * (g.H - L.roadEnd + g.U), Math.max(1, g.U * 0.5), g.U * (1 + rand() * 2.4));
    }
  }

  function paintBaseWeeds(ctx, g, rand, L) {
    const marks = ['#5e8c48', '#78a254', '#467a3e'];
    const spots = [[L.signX, 12], [L.x0 - L.s * 6, 14], [L.x1 + L.s * 5, 18]];
    for (const [x, spread] of spots) {
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = marks[Math.floor(rand() * 3)];
        const tall = L.s * (1.5 + rand() * 4.5);
        ctx.fillRect(x + (rand() - 0.5) * spread * L.s, L.ground + L.s * (rand() * 2) - tall, Math.max(1, L.s * 0.5), tall);
      }
    }
  }

  function paintFront(g, rand, L) {
    const shelter = paintShelter(g, rand, L);
    const sign = paintSign(g, rand, L);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRoadSurface(ctx, g, rand, L);
    state.puddles = makePuddles(g, L);
    paintPuddles(ctx, g, L, [softCopy(g, sign), softCopy(g, shelter)]);
    paintVerge(ctx, g, rand, L);
    ctx.drawImage(sign, 0, 0);
    ctx.drawImage(shelter, 0, 0);
    paintBaseWeeds(ctx, g, rand, L);
    return c;
  }

  function makeBlades(g, rand, count, place, colours, width) {
    const set = {
      count, colours, width,
      x: new Float32Array(count), y: new Float32Array(count), len: new Float32Array(count),
      lean: new Float32Array(count), ph: new Float32Array(count), tone: new Uint8Array(count),
    };
    for (let i = 0; i < count; i++) {
      const b = place(rand);
      set.x[i] = b.x;
      set.y[i] = b.y;
      set.len[i] = b.len;
      set.lean[i] = (rand() - 0.35) * b.len * 0.45;
      set.ph[i] = rand() * 6.28;
      set.tone[i] = Math.floor(rand() * colours.length);
    }
    return set;
  }

  function drawBlades(ctx, set, t, amount) {
    ctx.lineWidth = set.width;
    for (let tone = 0; tone < set.colours.length; tone++) {
      ctx.strokeStyle = set.colours[tone];
      ctx.beginPath();
      for (let i = 0; i < set.count; i++) {
        if (set.tone[i] !== tone) continue;
        const x = set.x[i];
        const y = set.y[i];
        const len = set.len[i];
        const sway = Math.sin(t * 1.2 - x * 0.05 + set.ph[i] * 0.25) * len * amount + Math.sin(t * 2.7 + set.ph[i]) * len * 0.02;
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + set.lean[i] * 0.2, y - len * 0.6, x + set.lean[i] + sway, y - len);
      }
      ctx.stroke();
    }
  }

  function makeRingSpots(g, L, rand) {
    for (const key of ['spotX', 'spotY', 'spotR']) state[key] = new Float32Array(RING_SPOTS);
    const weight = state.puddles.reduce((sum, p) => sum + p.rx, 0);
    for (let i = 0; i < RING_SPOTS; i++) {
      let pick = rand() * weight;
      let p = state.puddles[0];
      for (const q of state.puddles) {
        p = q;
        pick -= q.rx;
        if (pick <= 0) break;
      }
      const a = rand() * 6.2832;
      const d = Math.sqrt(rand()) * 0.78;
      state.spotX[i] = p.x + Math.cos(a) * d * p.rx;
      state.spotY[i] = p.y + Math.sin(a) * d * p.ry;
      state.spotR[i] = g.U * lerp(3.6, 6.6, (state.spotY[i] - L.roadTop) / (L.roadEnd - L.roadTop));
    }
    for (const key of ['ringRate', 'ringPh']) state[key] = new Float32Array(RINGS);
    for (let i = 0; i < RINGS; i++) {
      state.ringRate[i] = 0.38 + rand() * 0.34;
      state.ringPh[i] = rand() * 100;
    }
  }

  function drawRings(ctx, g, t, rain) {
    const active = Math.round(RINGS * Math.min(1, 0.12 + rain * 0.7));
    ctx.strokeStyle = '#eef3f2';
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    for (let i = 0; i < active; i++) {
      const life = t * state.ringRate[i] + state.ringPh[i];
      const age = life % 1;
      const spot = (Math.floor(life) * 37 + i * 13) % RING_SPOTS;
      const r = state.spotR[spot] * (0.2 + age * 0.8);
      ctx.globalAlpha = 0.85 * (1 - age);
      ctx.beginPath();
      ctx.ellipse(state.spotX[spot], state.spotY[spot], r, r * 0.42, 0, 0, 6.2832);
            ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function makeDrips(L, rand) {
    const E = L.eave;
    for (const key of ['dripX', 'dripRate', 'dripPh']) state[key] = new Float32Array(DRIPS);
    for (let i = 0; i < DRIPS; i++) {
      state.dripX[i] = lerp(E.x0 + L.s, E.x1 - L.s, (i + 0.5) / DRIPS);
      state.dripRate[i] = 0.75 + rand() * 0.6;
      state.dripPh[i] = rand() * 10;
    }
  }

  // Each drip hangs, drops with gravity, then opens a small ring where it lands.
  function drawDrips(ctx, L, t, rain) {
    const E = L.eave;
    const s = L.s;
    const fall = E.land - E.y - s * 1.7;
    const rate = 0.3 + Math.min(rain, 1.6) * 0.75;
    const dropW = Math.max(1, s * 0.7);
    ctx.fillStyle = '#eef4f4';
    for (let i = 0; i < DRIPS; i++) {
      const p = (t * state.dripRate[i] * rate + state.dripPh[i]) % 1;
      const x = state.dripX[i];
      if (p < 0.2) {
        ctx.fillRect(x, E.y + s * 1.7, dropW, s * (0.4 + p * 5));
      } else if (p < 0.62) {
        const f = (p - 0.2) / 0.42;
        const len = s * (1.5 + f * 8);
        ctx.fillRect(x, E.y + s * 1.7 + fall * f * f - len * 0.6, dropW, len);
      } else {
        const f = (p - 0.62) / 0.38;
        ctx.strokeStyle = '#e4ecec';
        ctx.globalAlpha = 0.9 * (1 - f);
        ctx.lineWidth = Math.max(1, s * 0.35);
        ctx.beginPath();
        ctx.ellipse(x, E.land, s * (0.5 + f * 2.2), s * (0.2 + f * 0.65), 0, 0, 6.2832);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function makeRain(g, rand) {
    for (const key of ['rx', 'ry', 'rv', 'rl']) state[key] = new Float32Array(MAX_RAIN);
    for (let i = 0; i < MAX_RAIN; i++) {
      const near = i % 3 === 0;
      state.rx[i] = rand() * g.W;
      state.ry[i] = rand() * g.H;
      state.rv[i] = g.U * (near ? 90 + rand() * 30 : 55 + rand() * 20);
      state.rl[i] = g.U * (near ? 3 + rand() * 2 : 1.6 + rand() * 1.2);
    }
  }

  function drawRain(ctx, g, dt, rain) {
    const count = Math.min(MAX_RAIN, Math.round(g.W * 1.35 * rain));
    const rand = state.rand;
    const slant = -0.09;
    for (let pass = 0; pass < 3; pass++) {
      ctx.strokeStyle = pass === 0 ? '#f0f4f4' : '#d6dfe2';
      ctx.globalAlpha = pass === 0 ? 0.55 : 0.34;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = pass; i < count; i += 3) {
        const v = state.rv[i] * dt;
        state.ry[i] += v;
        state.rx[i] += v * slant;
        if (state.ry[i] > g.H + g.U * 6) {
          state.ry[i] = -g.U * 6;
          state.rx[i] = rand() * (g.W + g.U * 12);
        }
        ctx.moveTo(state.rx[i], state.ry[i]);
        ctx.lineTo(state.rx[i] + state.rl[i] * slant, state.ry[i] + state.rl[i]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Rain striking the tin: a pale tick that jumps to a new spot many times a second.
  function drawRoofTicks(ctx, L, t, rain) {
    const E = L.eave;
    const R = L.ridge;
    const count = Math.round(ROOF_TICKS * Math.min(1.5, rain));
    const size = Math.max(1, L.s * 0.7);
    ctx.fillStyle = '#eef2f0';
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < count; i++) {
      const k = Math.floor(t * 9 + i * 0.37);
      const fx = Math.max(0, Math.min(1, (noise2(k * 0.73, i * 1.9, 51) - 0.25) * 2));
      const fy = Math.max(0, Math.min(1, (noise2(i * 2.3, k * 0.61, 52) - 0.25) * 2));
      ctx.fillRect(lerp(lerp(R.x0, R.x1, fx), lerp(E.x0, E.x1, fx), fy), lerp(R.y, E.y, fy), size, size);
    }
    ctx.globalAlpha = 1;
  }

  function slideTile(ctx, tile, x, y) {
    const offset = Math.round(-(x % tile.width));
    ctx.drawImage(tile, offset, y);
    ctx.drawImage(tile, offset + tile.width, y);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const L = makeLayout(g);
    state.g = g;
    state.L = L;
    state.rand = rand;
    state.back = paintBack(g);
    state.near = paintNearRidge(g, rand);
    state.field = paintField(g, rand, L);
    state.front = paintFront(g, rand, L);
    const tw = Math.ceil(g.W * 1.5);
    state.skyMist = paintMist(tw, Math.ceil(g.H * 0.46), 0.022 / g.U, 0.055 / g.U, 61, '#e9ebe5', [0.32, 0.62]);
    state.lowMist = paintMist(tw, Math.ceil(g.H * 0.2), 0.026 / g.U, 0.1 / g.U, 67, '#e6eae4', [0.42, 0.66]);
    state.wind = paintMist(tw, Math.ceil(g.H * 0.2), 0.03 / g.U, 0.16 / g.U, 73, '#c5d890', [0.5, 0.68]);
    state.midBlades = makeBlades(g, rand, Math.min(380, Math.round(g.W * 1.5)), (r) => ({
      x: r() * g.W, y: L.ground + g.U * 0.5, len: g.U * (9 + r() * 10),
    }), ['#7fae50', '#6a9c47', '#9cc066', '#578a42'], Math.max(1, g.U * 0.55));
    state.foreBlades = makeBlades(g, rand, 110, (r) => {
      const left = r() < 0.7;
      const f = r();
      return {
        x: left ? f * f * g.W * 0.2 : g.W - f * f * g.W * 0.11,
        y: g.H + g.U,
        len: g.U * (5 + r() * 6 + (1 - f) * 11),
      };
    }, ['#3f6f3c', '#5a8c46', '#7ba652'], Math.max(1, g.U * 0.8));
    makeRingSpots(g, L, rand);
    makeDrips(L, rand);
    makeRain(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const { g, L } = state;
    const { rain, mist } = api.props;
    const veil = Math.min(1, mist * 0.75);
    ctx.drawImage(state.back, 0, 0);
    ctx.globalAlpha = veil;
    slideTile(ctx, state.skyMist, t * g.U * 0.9, g.H * 0.04);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.near, 0, 0);
    ctx.globalAlpha = veil;
    slideTile(ctx, state.lowMist, t * g.U * 1.5, g.H * 0.36);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.field, 0, 0);
    ctx.globalAlpha = 0.34;
    slideTile(ctx, state.wind, t * g.U * 5, L.fieldTop + g.U * 2);
    ctx.globalAlpha = 1;
    drawBlades(ctx, state.midBlades, t, 0.09);
    ctx.drawImage(state.front, 0, 0);
    drawRoofTicks(ctx, L, t, rain);
    drawRings(ctx, g, t, rain);
    drawDrips(ctx, L, t, rain);
    drawBlades(ctx, state.foreBlades, t, 0.06);
    drawRain(ctx, g, dt, rain);
  }

  Kasuri.run({
    defaults: { rain: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.08, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
