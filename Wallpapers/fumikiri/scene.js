/*
 * 踏切 Fumikiri — a country level crossing on a hill above the sea at dusk.
 *
 * Sky, sea, land, train and signal are all baked once. Each pass only slides the
 * train layer, turns two arm sprites and fades two pairs of lamps, while clouds,
 * sea glints and a few hundred grass strokes keep the picture alive between trains.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const SKY_BANDS = ['#5f82bc', '#789aca', '#97a6d0', '#bca6cc', '#dda8bd', '#f0aaab', '#f8b8a2', '#fccba6', '#fde0b4'];
  const STREAK = ['#bca6cc', '#dda8bd', '#f0aaab'];
  const CUMULUS = ['#a79ec8', '#dda8bd', '#f0aaab', '#fccba6'];
  const GRASS = ['#3f5a48', '#5b7a55', '#83985f', '#bcae84'];
  const LENS_STEPS = 8;
  const LOWER_AT = 3;
  const LOWER_FOR = 6;
  const TRAIN_AT = 11;
  const RISE_FOR = 6;
  const LAMP_PERIOD = 2.8;
  const START_AT = 8.5;
  const TRAIN_SPEED = 25;
  const ARM_UP = (84 * Math.PI) / 180;
  const MAX_GLINTS = 170;
  const MAX_BLADES = 420;
  const BIRDS = 7;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // The track climbs gently to the right; this is its height anywhere along the view.
  function trackY(g, x) {
    return g.yc - g.slope * (x - g.rc);
  }

  function bankY(g, x) {
    return trackY(g, x) - g.U * (5 + fbm(x * 0.09, 3, 2, 21) * 1.6);
  }

  function roadEdge(g, y, side) {
    const f = K.clamp((y - g.yc) / (g.H - g.yc), 0, 1);
    return g.rc - g.U * 8 * f * f + side * g.U * lerp(16, 62, f);
  }

  function paintGlow(radius, colour, peak) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, g, b] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},${peak})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  // Woodblock sky: flat bands of colour that curve up around the low sun.
  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const bands = SKY_BANDS.map(K.parseColor);
    for (let y = 0; y < c.height; y++) {
      const v = Math.min(1, y / g.horizon);
      for (let x = 0; x < c.width; x++) {
        const d = Math.hypot((x - g.sunX) / (g.U * 90), (g.horizon - y) / (g.U * 36));
        const warm = Math.max(0, 1 - d);
        const L = Math.pow(v, 1.25) * 0.86 + warm * warm * 0.26 + (K.noise2(x / g.U * 0.04, y / g.U * 0.2, 4) - 0.5) * 0.05;
        const rgb = bands[K.clamp(Math.floor(L * bands.length), 0, bands.length - 1)];
        const i = (y * c.width + x) * 4;
        img.data[i] = rgb[0];
        img.data[i + 1] = rgb[1];
        img.data[i + 2] = rgb[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#d29fb6';
    for (const [fx, y, w] of [[0.1, 52, 40], [0.48, 50, 34], [0.7, 53.5, 46], [0.32, 54, 22], [0.92, 49, 30]]) {
      ctx.beginPath();
      ctx.ellipse(g.W * fx, g.U * y, g.U * w, Math.max(1, g.U * 0.55), 0, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  // High thin streaks, baked at half size in flat tones. They tile across the sheet.
  function paintStreaks(g) {
    const w = Math.ceil((g.W * 1.5) / 2);
    const h = Math.ceil((g.U * 34) / 2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tones = STREAK.map(K.parseColor);
    const toU = 2 / g.U;
    const tile = (x, y) => lerp(fbm(x * 0.02, y * 0.17, 4, 3), fbm((x - w * toU) * 0.02, y * 0.17, 4, 3), x / toU / w);
    for (let py = 0; py < h; py++) {
      const Y = py * toU;
      const v = py / h;
      const env = Math.pow(Math.sin(Math.PI * v), 0.6);
      for (let px = 0; px < w; px++) {
        const X = px * toU;
        const n = tile(X, Y);
        if (n + (env - 1) * 0.5 - 0.53 <= 0) continue;
        const lit = K.clamp(0.3 + (n - tile(X, Y + 2)) * 8 + v * 0.5, 0, 1);
        const rgb = tones[Math.round(lit * (tones.length - 1))];
        const i = (py * w + px) * 4;
        img.data[i] = rgb[0];
        img.data[i + 1] = rgb[1];
        img.data[i + 2] = rgb[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function puff(ctx, w, x, y, r, colour) {
    ctx.fillStyle = colour;
    for (const dx of [-w, 0, w]) {
      ctx.beginPath();
      ctx.arc(x + dx, y, r, 0, 6.3);
      ctx.fill();
    }
  }

  // One heap of cumulus. Lit from low and to the left, so each billow is a shadow disc
  // with smaller warm discs pushed toward the sun, the warmest near the base.
  function paintHeap(ctx, g, rand, sheetW, cx, base, w, h) {
    const u = g.U;
    const list = [];
    const count = Math.round(w / (u * 0.55));
    for (let i = 0; i < count; i++) {
      const a = (rand() - 0.5) * 2;
      const top = Math.pow(1 - Math.abs(a), 0.65) * h;
      const up = rand() * top;
      list.push({ x: cx + (a * w) / 2, y: base - up, r: u * (1.2 + Math.pow(rand(), 1.6) * 6.5) * (1.15 - (up / h) * 0.4), f: up / h });
    }
    list.sort((p, q) => p.y - q.y);
    const passes = [[0, 0, 1], [0.16, 0.84, 0.8], [0.3, 0.62, 0.55], [0.42, 0.46, 0.3]];
    passes.forEach(([push, size, reach], tone) => {
      for (const b of list) {
        if (b.f > reach) continue;
        puff(ctx, sheetW, b.x - b.r * push, b.y + b.r * push, b.r * size, CUMULUS[tone]);
      }
    });
  }

  function paintCumulus(g, rand) {
    const u = g.U;
    const w = Math.ceil(g.W * 1.5);
    const c = layer(w, u * 56);
    const ctx = c.getContext('2d');
    const base = u * 45;
    paintHeap(ctx, g, rand, w, w * 0.2, base, u * 64, u * 34);
    paintHeap(ctx, g, rand, w, w * 0.46, base + u * 2, u * 34, u * 15);
    paintHeap(ctx, g, rand, w, w * 0.72, base, u * 78, u * 40);
    paintHeap(ctx, g, rand, w, w * 0.96, base + u * 2, u * 30, u * 12);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(0, c.height);
    for (let x = 0; x <= w + 2; x += 2) ctx.lineTo(x, base + u * (1 + K.noise2(x * 0.06, 2, 5) * 3));
    ctx.lineTo(w, c.height);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintHeadland(ctx, g) {
    const y = g.horizon;
    ctx.fillStyle = '#7d7aa8';
    ctx.beginPath();
    ctx.moveTo(-1, y + 1);
    for (let x = 0; x <= g.W * 0.3; x += 2) {
      const f = x / (g.W * 0.3);
      ctx.lineTo(x, y - g.U * (1 - f) * (5.5 + fbm(x * 0.05, 1, 3, 7) * 5));
    }
    ctx.lineTo(g.W * 0.3, y + 1);
    ctx.fill();
    ctx.fillStyle = '#8c82ae';
    ctx.beginPath();
    ctx.ellipse(g.W * 0.58, y, g.U * 7, g.U * 1.5, 0, Math.PI, 0);
    ctx.fill();
  }

  function paintSea(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHeadland(ctx, g);
    const tones = ['#c49ec2', '#a8a0ca', '#8f9ecb', '#7c92c2'];
    tones.forEach((tone, i) => {
      ctx.fillStyle = tone;
      ctx.fillRect(0, g.horizon + i * (i + 1) * g.U * 1.3, g.W, g.H);
    });
    ctx.fillStyle = '#f9d7ae';
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 40; i++) {
      const f = rand();
      const w = g.U * (2 + rand() * 7) * (1 - f * 0.4);
      ctx.fillRect(g.sunX + (rand() - 0.5) * g.U * (5 + f * 16) - w / 2, g.horizon + f * g.U * 13, w, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function hillY(g, x) {
    return bankY(g, x) - smoothstep(g.W * 0.46, g.W * 1.04, x) * g.U * 27 - smoothstep(g.W * 0.5, g.W * 0.7, x) * fbm(x * 0.05, 2, 3, 11) * g.U * 3;
  }

  function paintFarHill(ctx, g, rand) {
    ctx.fillStyle = '#5d6e61';
    ctx.beginPath();
    ctx.moveTo(g.W * 0.44, trackY(g, g.W * 0.44));
    for (let x = g.W * 0.44; x <= g.W + 2; x += 2) ctx.lineTo(x, hillY(g, x));
    ctx.lineTo(g.W, g.H * 0.8);
    ctx.lineTo(g.W * 0.44, g.H * 0.8);
    ctx.fill();
    const tones = ['#46584d', '#536656', '#67795f', '#8b8a70'];
    const count = Math.round(g.W * 2.4);
    for (let i = 0; i < count; i++) {
      const x = g.W * (0.5 + rand() * 0.52);
      const top = hillY(g, x);
      const f = rand();
      const y = lerp(top, bankY(g, x), f * f);
      const r = g.U * (0.7 + rand() * 1.9);
      ctx.fillStyle = tones[Math.min(3, Math.floor(rand() * 2.6 + (1 - f) * 1.4))];
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r, 0, 0, 6.3);
      ctx.fill();
    }
    paintHouse(ctx, g);
  }

  function paintHouse(ctx, g) {
    const u = g.U;
    const x = g.W * 0.875;
    const y = lerp(hillY(g, x), bankY(g, x), 0.86);
    ctx.fillStyle = '#b9ab9c';
    ctx.fillRect(x - u * 7, y - u * 5, u * 14, u * 5);
    ctx.fillStyle = '#403f55';
    ctx.beginPath();
    ctx.moveTo(x - u * 9, y - u * 5);
    ctx.lineTo(x - u * 5, y - u * 9);
    ctx.lineTo(x + u * 5, y - u * 9);
    ctx.lineTo(x + u * 9, y - u * 5);
    ctx.fill();
    state.houseLight = { x: x - u * 4, y: y - u * 3.8, w: u * 4, h: u * 2.6 };
  }

  function paintBank(ctx, g, rand) {
    ctx.fillStyle = '#8f9e68';
    ctx.beginPath();
    ctx.moveTo(0, g.yc + g.U * 8);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, bankY(g, x));
    ctx.lineTo(g.W, g.yc + g.U * 8);
    ctx.fill();
    ctx.fillStyle = '#7f8a60';
    for (let i = 0; i < g.W * 0.5; i++) {
      const x = rand() * g.W;
      ctx.fillRect(x, bankY(g, x) + rand() * g.U * 4, Math.max(1, g.U * (0.5 + rand())), Math.max(1, g.U * 0.5));
    }
    ctx.fillStyle = '#8f8491';
    ctx.beginPath();
    ctx.moveTo(g.rc - g.U * 17, trackY(g, g.rc) + g.U);
    ctx.lineTo(g.rc - g.U * 11, bankY(g, g.rc - g.U * 11));
    ctx.lineTo(g.rc + g.U * 11, bankY(g, g.rc + g.U * 11));
    ctx.lineTo(g.rc + g.U * 17, trackY(g, g.rc) + g.U);
    ctx.fill();
  }

  function paintCatenary(ctx, g) {
    const u = g.U;
    const span = u * 90;
    const contact = (x) => trackY(g, x) - u * 33;
    const first = g.rc + u * 34 - span * Math.ceil((g.rc + u * 34 + span) / span);
    ctx.strokeStyle = '#3e3e56';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, contact(0));
    ctx.lineTo(g.W, contact(g.W));
    for (let x = first; x < g.W + span; x += span) {
      ctx.moveTo(x, contact(x) - u * 5);
      ctx.quadraticCurveTo(x + span / 2, contact(x + span / 2) + u * 1.5, x + span, contact(x + span) - u * 5);
      for (let k = 1; k < 5; k++) {
        const dx = x + (span * k) / 5;
        ctx.moveTo(dx, contact(dx));
        ctx.lineTo(dx, contact(dx) - u * (1.6 + Math.abs(k - 2.5) * 1.2));
      }
    }
    ctx.stroke();
    for (let x = first; x < g.W + span; x += span) paintMast(ctx, g, x, contact(x));
  }

  function paintMast(ctx, g, x, wire) {
    const u = g.U;
    ctx.fillStyle = '#44445c';
    ctx.fillRect(x - u * 0.6, wire - u * 8, Math.max(1, u * 1.2), bankY(g, x) + u * 3 - wire + u * 8);
    ctx.fillRect(x - u * 5, wire - u * 5.6, u * 8, Math.max(1, u * 0.6));
    ctx.fillRect(x - u * 4, wire - u * 1, u * 7, Math.max(1, u * 0.5));
  }

  function paintUtilityPole(ctx, g, x, top, base, w) {
    const u = g.U;
    ctx.fillStyle = '#3d3d54';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.36, top);
    ctx.lineTo(x + w * 0.36, top);
    ctx.lineTo(x + w * 0.5, base);
    ctx.lineTo(x - w * 0.5, base);
    ctx.fill();
    ctx.fillRect(x - w * 4.2, top + w * 2, w * 8.4, Math.max(1, w * 0.5));
    ctx.fillRect(x - w * 3.2, top + w * 4.4, w * 6.4, Math.max(1, w * 0.45));
    ctx.fillStyle = '#d8a79f';
    ctx.globalAlpha = 0.65;
    ctx.fillRect(x + w * 0.2, top, Math.max(1, u * 0.3), base - top);
    ctx.globalAlpha = 1;
  }

  function paintBallast(ctx, g, rand) {
    const u = g.U;
    ctx.save();
    ctx.transform(1, -g.slope, 0, 1, 0, g.slope * g.rc);
    ctx.fillStyle = '#787080';
    ctx.fillRect(-u * 4, g.yc - u * 2.8, g.W + u * 8, u * 5.6);
    ctx.fillStyle = '#5d5668';
    for (let i = 0; i < g.W * 1.4; i++) ctx.fillRect(rand() * g.W, g.yc - u * 2.8 + rand() * u * 5.6, 1, 1);
    ctx.fillStyle = '#4c4656';
    for (let x = -u * 2; x < g.W + u * 2; x += u * 3.2) ctx.fillRect(x, g.yc - u * 1.5, u * 1.4, u * 3.2);
    ctx.fillStyle = '#8e8391';
    ctx.fillRect(g.rc - u * 17, g.yc - u * 2.8, u * 34, u * 5.6);
    ctx.fillStyle = '#6d6474';
    for (let x = g.rc - u * 15; x < g.rc + u * 16; x += u * 5.6) ctx.fillRect(x, g.yc - u * 2.8, Math.max(1, u * 0.35), u * 5.6);
    ctx.fillStyle = '#e2bcb2';
    ctx.fillRect(-u * 4, g.yc - u * 1.5, g.W + u * 8, Math.max(1, u * 0.6));
    ctx.fillRect(-u * 4, g.yc + u * 1.2, g.W + u * 8, Math.max(1, u * 0.7));
    ctx.restore();
  }

  function paintGround(ctx, g, rand) {
    const bands = ['#93a466', '#7d9560', '#6a8759', '#5a7a53', '#4d6e4e'];
    bands.forEach((tone, i) => {
      const y = i * i * g.U * 1.7;
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.moveTo(0, trackY(g, 0) + g.U * 2.4 + y);
      for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, trackY(g, x) + g.U * 2.4 + y + (i ? K.noise2(x * 0.1, i, 6) * g.U * 2 : 0));
      ctx.lineTo(g.W, g.H);
      ctx.lineTo(0, g.H);
      ctx.fill();
    });
    const marks = ['#a5b070', '#6f8a5a', '#4f6e50'];
    for (let i = 0; i < g.W * 2.2; i++) {
      const f = rand();
      const x = rand() * g.W;
      ctx.fillStyle = marks[Math.floor(rand() * 3)];
      ctx.fillRect(x, lerp(trackY(g, x) + g.U * 3, g.H, f), Math.max(1, g.U * (0.5 + f * 1.8)), Math.max(1, g.U * (0.4 + f * 0.4)));
    }
  }

  function paintRoad(ctx, g, rand) {
    ctx.fillStyle = '#90859f';
    ctx.beginPath();
    ctx.moveTo(roadEdge(g, g.yc, -1), g.yc);
    for (let y = g.yc; y <= g.H; y += g.U * 2) ctx.lineTo(roadEdge(g, y, -1), y);
    ctx.lineTo(roadEdge(g, g.H, 1), g.H);
    for (let y = g.H; y >= g.yc; y -= g.U * 2) ctx.lineTo(roadEdge(g, y, 1), y);
    ctx.fill();
    const tones = ['#a897aa', '#9c8ea6'];
    tones.forEach((tone, i) => {
      const reach = g.yc + g.U * (i ? 5 : 2.6);
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.moveTo(roadEdge(g, g.yc, -1), g.yc);
      ctx.lineTo(roadEdge(g, g.yc, 1), g.yc);
      ctx.lineTo(roadEdge(g, reach + g.U * 3, 1), reach + g.U * 3);
      ctx.lineTo(roadEdge(g, reach + g.U * 3, -1), reach + g.U * 3);
      ctx.fill();
    });
    paintRoadMarks(ctx, g, rand);
  }

  function paintRoadMarks(ctx, g, rand) {
    const u = g.U;
    const stop = g.H * 0.8;
    ctx.fillStyle = '#d6ccbc';
    ctx.fillRect(roadEdge(g, stop, -1) + u * 2, stop, roadEdge(g, stop, 1) - roadEdge(g, stop, -1) - u * 4, u * 1.5);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(roadEdge(g, stop, side) - side * u * 1.6, stop);
      ctx.lineTo(roadEdge(g, stop, side) - side * u * 2.4, stop);
      ctx.lineTo(roadEdge(g, g.H, side) - side * u * 4, g.H);
      ctx.lineTo(roadEdge(g, g.H, side) - side * u * 2, g.H);
      ctx.fill();
    }
    const marks = ['#7d7692', '#aa9bb0'];
    for (let i = 0; i < g.W * 0.8; i++) {
      const y = lerp(g.yc + u * 3, g.H, Math.pow(rand(), 0.8));
      const x = lerp(roadEdge(g, y, -1), roadEdge(g, y, 1), rand());
      ctx.fillStyle = marks[i % 2];
      ctx.fillRect(x, y, u * (0.8 + rand() * 4), Math.max(1, u * 0.3));
    }
  }

  function paintCrossbuck(ctx, x, y, u) {
    for (const turn of [-0.62, 0.62]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(turn);
      ctx.fillStyle = '#26273a';
      ctx.fillRect(-u * 14, -u * 2, u * 28, u * 4);
      ctx.fillStyle = '#f2cf5e';
      ctx.fillRect(-u * 13.4, -u * 1.5, u * 26.8, u * 3);
      ctx.fillStyle = '#26273a';
      for (const s of [-10, -4.4, 3, 8.6]) ctx.fillRect(s * u, -u * 1.5, u * 1.8, u * 3);
      ctx.restore();
    }
  }

  function paintPost(ctx, x, base, u) {
    ctx.fillStyle = '#34354a';
    ctx.fillRect(x - u * 1.1, base - u * 60, u * 2.2, u * 60);
    ctx.fillStyle = '#f0cc5a';
    ctx.fillRect(x - u * 1.1, base - u * 24, u * 2.2, u * 24);
    ctx.fillStyle = '#26273a';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - u * 1.1, base - u * (4 + i * 6), u * 2.2, u * 3);
    ctx.fillStyle = '#d29a97';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x + u * 0.5, base - u * 60, Math.max(1, u * 0.3), u * 36);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#8b8795';
    ctx.fillRect(x - u * 3, base - u * 1.2, u * 6, u * 2.4);
  }

  // The crossing signal: post, crossed boards, then a beam with two hooded lamps.
  function paintSignal(ctx, x, base, u) {
    paintPost(ctx, x, base, u);
    paintCrossbuck(ctx, x, base - u * 56, u);
    const y = base - u * 43;
    ctx.fillStyle = '#26273a';
    ctx.fillRect(x - u * 10, y - u * 1, u * 20, u * 2);
    for (const side of [-1, 1]) {
      const lx = x + side * u * 9.5;
      ctx.fillStyle = '#26273a';
      ctx.beginPath();
      ctx.arc(lx, y, u * 5.6, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#3a3b52';
      ctx.beginPath();
      ctx.arc(lx, y - u * 1, u * 6, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(lx + u * 5, y - u * 2.2);
      ctx.fill();
    }
    return { x1: x - u * 9.5, x2: x + u * 9.5, y, r: u * 4.1 };
  }

  function paintMachine(ctx, x, base, u) {
    ctx.fillStyle = '#34354a';
    ctx.fillRect(x - u * 3, base - u * 12, u * 6, u * 12);
    ctx.fillStyle = '#f0cc5a';
    ctx.fillRect(x - u * 3, base - u * 12, u * 6, u * 2);
    ctx.fillStyle = '#8b8795';
    ctx.fillRect(x - u * 4, base - u * 1, u * 8, u * 2);
  }

  function paintArm(u) {
    const tail = u * 9;
    const len = u * 66;
    const h = Math.max(3, u * 3);
    const c = layer(tail + len, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#34354a';
    ctx.fillRect(0, 0, tail, h);
    ctx.fillStyle = '#f4d264';
    ctx.fillRect(tail, 0, len, h);
    ctx.fillStyle = '#26273a';
    for (let x = tail + u * 3; x < tail + len; x += u * 11) ctx.fillRect(x, 0, u * 5.5, h);
    return { canvas: c, tail, h };
  }

  function paintLand(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarHill(ctx, g, rand);
    paintBank(ctx, g, rand);
    const mid = g.W * 0.94;
    const midBase = hillY(g, mid) + g.U * 7;
    paintUtilityPole(ctx, g, mid, g.U * 25, midBase, g.U * 1.3);
    state.midTop = { x: mid, y: g.U * 25 };
    paintCatenary(ctx, g);
    const fx = g.rc - g.U * 26;
    const fb = bankY(g, fx) + g.U * 1;
    state.farLamps = paintSignal(ctx, fx, fb, g.U * 0.58);
    paintMachine(ctx, g.rc - g.U * 12.5, fb, g.U * 0.58);
    state.farPivot = { x: g.rc - g.U * 12.5, y: fb - g.U * 0.58 * 10.5 };
    paintGround(ctx, g, rand);
    paintRoad(ctx, g, rand);
    paintBallast(ctx, g, rand);
    return c;
  }

  function paintWires(ctx, g) {
    const near = { x: g.W * 0.085, y: g.U * 12 };
    const far = state.midTop;
    ctx.strokeStyle = '#3d3d58';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const dx = (i - 1.5) * g.U * 4;
      const fx = (i - 1.5) * g.U * 1.2;
      const drop = i === 3 ? g.U * 5 : 0;
      ctx.moveTo(near.x + dx, near.y + drop);
      ctx.quadraticCurveTo((near.x + far.x) / 2, Math.max(near.y, far.y) + g.U * (6 + i), far.x + fx, far.y + g.U * 2.6 + drop * 0.4);
      ctx.moveTo(near.x + dx, near.y + drop);
      ctx.quadraticCurveTo(near.x * 0.5, near.y + g.U * 2, -g.U, near.y - g.U * 4 + drop);
    }
    ctx.stroke();
  }

  function paintNear(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintWires(ctx, g);
    paintUtilityPole(ctx, g, g.W * 0.085, -u * 2, g.H, u * 3.4);
    ctx.fillStyle = '#4c4c64';
    ctx.fillRect(g.W * 0.085 + u * 1.6, u * 28, u * 4.6, u * 8);
    const postX = g.rc + u * 57;
    const base = g.H * 0.87;
    state.nearLamps = paintSignal(ctx, postX, base, u);
    paintMachine(ctx, g.rc + u * 41, base, u);
    state.nearPivot = { x: g.rc + u * 41, y: base - u * 10 };
    return c;
  }

  function roofBox(ctx, u, x, b, w) {
    ctx.fillStyle = '#4b4b60';
    ctx.fillRect(x, b - u * 28.6, w * u, u * 1.2);
  }

  function paintPantograph(ctx, u, x, b) {
    ctx.strokeStyle = '#34354a';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - u * 5, b - u * 27.5);
    ctx.lineTo(x, b - u * 31);
    ctx.lineTo(x - u * 3.5, b - u * 34.4);
    ctx.moveTo(x - u * 7, b - u * 34.4);
    ctx.lineTo(x + u * 2, b - u * 34.4);
    ctx.stroke();
  }

  function paintBogie(ctx, u, x, b) {
    ctx.fillStyle = '#2c2d40';
    ctx.fillRect(x - u * 7, b - u * 6, u * 14, u * 3);
    for (const dx of [-4, 4]) {
      ctx.fillStyle = '#26273a';
      ctx.beginPath();
      ctx.arc(x + dx * u, b - u * 2.2, u * 2.2, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#6b6a7c';
      ctx.fillRect(x + dx * u - u * 0.4, b - u * 2.6, u * 0.8, u * 0.8);
    }
  }

  function paintWindow(ctx, u, rand, x, y, w, h) {
    ctx.fillStyle = '#f4c25e';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fde49c';
    ctx.fillRect(x, y, w, h * 0.24);
    ctx.fillStyle = '#c0843e';
    ctx.fillRect(x, y + h * 0.74, w, h * 0.26);
    if (rand() < 0.45) {
      const px = x + w * (0.25 + rand() * 0.5);
      ctx.fillStyle = '#4c3b3c';
      ctx.beginPath();
      ctx.arc(px, y + h * 0.42, u * 1.15, 0, 6.3);
      ctx.fill();
      ctx.fillRect(px - u * 1.7, y + h * 0.58, u * 3.4, h * 0.42);
    }
  }

  function paintCarBody(ctx, u, x, b, len, head) {
    const top = b - u * 27.6;
    const bottom = b - u * 6;
    const r = u * 3;
    ctx.fillStyle = '#46618f';
    ctx.beginPath();
    ctx.moveTo(x + (head < 0 ? r * 1.4 : 0), top);
    ctx.lineTo(x + len - (head > 0 ? r * 1.4 : 0), top);
    if (head > 0) ctx.quadraticCurveTo(x + len, top, x + len, top + r * 1.6);
    ctx.lineTo(x + len, bottom);
    ctx.lineTo(x, bottom);
    if (head < 0) ctx.lineTo(x, top + r * 1.6);
    if (head < 0) ctx.quadraticCurveTo(x, top, x + r * 1.4, top);
    else ctx.lineTo(x, top);
    ctx.fill();
    ctx.fillStyle = '#6a6a84';
    ctx.fillRect(x + (head < 0 ? r : 0), top, len - (head ? r : 0), u * 1.4);
    ctx.fillStyle = '#e6c0b2';
    ctx.fillRect(x + (head < 0 ? r : 0), top, len - (head ? r : 0), Math.max(1, u * 0.4));
    ctx.fillStyle = '#ddd0b8';
    ctx.fillRect(x, b - u * 12.8, len, u * 3.8);
    ctx.fillStyle = '#b5482f';
    ctx.fillRect(x, b - u * 9, len, Math.max(1, u * 0.9));
    ctx.fillStyle = '#3f3f58';
    ctx.fillRect(x + u * 2, bottom, len - u * 4, u * 1.4);
  }

  function paintDoor(ctx, u, rand, x, b) {
    ctx.fillStyle = '#3c5580';
    ctx.fillRect(x, b - u * 24, u * 8, u * 18);
    ctx.fillStyle = '#2f3f60';
    ctx.fillRect(x + u * 3.9, b - u * 24, Math.max(1, u * 0.3), u * 18);
    paintWindow(ctx, u, rand, x + u * 0.8, b - u * 22.4, u * 2.6, u * 8);
    paintWindow(ctx, u, rand, x + u * 4.6, b - u * 22.4, u * 2.6, u * 8);
  }

  // One car: doors at three stations, wide lit windows between, a cab at the leading end.
  function paintCar(ctx, u, rand, x, b, len, head) {
    paintCarBody(ctx, u, x, b, len, head);
    const doors = [0.17, 0.5, 0.83].map((f) => x + len * f - u * 4);
    const cuts = [x + u * (head < 0 ? 8 : 1), doors[0], doors[0] + u * 8, doors[1], doors[1] + u * 8, doors[2], doors[2] + u * 8, x + len - u * (head > 0 ? 8 : 1)];
    for (let i = 0; i < cuts.length; i += 2) {
      const bay = cuts[i + 1] - cuts[i];
      const n = bay > u * 15 ? 2 : 1;
      const w = (bay - u * (n + 1)) / n;
      for (let k = 0; k < n; k++) paintWindow(ctx, u, rand, cuts[i] + u + k * (w + u), b - u * 22.8, w, u * 9);
    }
    for (const d of doors) paintDoor(ctx, u, rand, d, b);
    if (head) paintWindow(ctx, u, rand, head > 0 ? x + len - u * 6.4 : x + u * 2.2, b - u * 23, u * 4.2, u * 8);
    paintBogie(ctx, u, x + len * 0.18, b);
    paintBogie(ctx, u, x + len * 0.82, b);
  }

  // Both cars, sheared to the track slope. dir is the way it travels.
  function paintTrain(g, rand, dir) {
    const u = g.U;
    const carLen = u * 76;
    const gap = u * 1.6;
    const len = carLen * 2 + gap;
    const rise = g.slope * len;
    const c = layer(len, u * 44 + rise);
    const ctx = c.getContext('2d');
    const b = u * 37;
    ctx.transform(1, -g.slope, 0, 1, 0, rise);
    ctx.fillStyle = '#f3c982';
    ctx.globalAlpha = 0.2;
    ctx.fillRect(u * 3, b + u * 0.4, len - u * 6, u * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2c2d40';
    ctx.fillRect(carLen, b - u * 22, gap, u * 16);
    paintCar(ctx, u, rand, 0, b, carLen, -1);
    paintCar(ctx, u, rand, carLen + gap, b, carLen, 1);
    ctx.fillStyle = '#e4583c';
    ctx.fillRect(dir > 0 ? u * 0.4 : len - u * 2, b - u * 11.6, u * 1.6, u * 1.4);
    roofBox(ctx, u, u * 16, b, 9);
    roofBox(ctx, u, carLen + gap + u * 50, b, 9);
    paintPantograph(ctx, u, dir > 0 ? carLen + gap + u * 22 : u * 54, b);
    return { canvas: c, b: b + rise, len };
  }

  function makeGlints(g, rand) {
    const n = MAX_GLINTS;
    const o = { x: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n), p: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const f = rand();
      o.y[i] = g.horizon + g.U * (0.5 + f * f * 13);
      o.x[i] = rand() < 0.4 ? g.sunX + (rand() - 0.5) * g.U * 34 : rand() * g.W;
      o.w[i] = g.U * (1 + rand() * 3.5);
      o.p[i] = rand() * 6.28;
    }
    return o;
  }

  function placeBlade(g, rand, o, i, tall) {
    let x = rand() * g.W;
    let y = lerp(g.yc + g.U * 5, g.H + g.U, Math.pow(rand(), 0.7));
    for (let tries = 0; tries < 6 && x > roadEdge(g, y, -1) - g.U && x < roadEdge(g, y, 1) + g.U; tries++) {
      x = rand() * g.W;
    }
    if (x > roadEdge(g, y, -1) - g.U && x < roadEdge(g, y, 1) + g.U) {
      x = rand() < 0.5 ? roadEdge(g, y, -1) - rand() * g.U * 4 : roadEdge(g, y, 1) + rand() * g.U * 4;
    }
    if (tall) {
      x = rand() < 0.45 ? rand() * g.W * 0.2 : g.W * (0.86 + rand() * 0.14);
      y = g.H - rand() * g.U * 6;
    }
    const k = K.clamp((y - g.yc) / (g.H - g.yc), 0, 1);
    o.x[i] = x;
    o.y[i] = y;
    o.h[i] = tall ? g.U * (13 + rand() * 9) : g.U * (1.6 + k * 8) * (0.6 + rand() * 0.8);
    o.p[i] = rand() * 6.28;
  }

  function makeBlades(g, rand) {
    const n = Math.min(MAX_BLADES, Math.round(g.W * 1.5));
    const o = { n, plumes: 16, x: new Float32Array(n), y: new Float32Array(n), h: new Float32Array(n), p: new Float32Array(n) };
    for (let i = 0; i < n; i++) placeBlade(g, rand, o, i, i < o.plumes);
    return o;
  }

  function slideSheet(ctx, g, sheet, y, off, scale) {
    const w = sheet.width * scale;
    const h = sheet.height * scale;
    const x = -(off % w);
    ctx.drawImage(sheet, x, y, w, h);
    if (x + w < g.W) ctx.drawImage(sheet, x + w, y, w, h);
  }

  function drawClouds(ctx, g, wind) {
    state.cloudA += state.dtNow * g.U * 0.35 * wind;
    state.cloudB += state.dtNow * g.U * 0.5 * wind;
    slideSheet(ctx, g, state.streaks, g.U * 2, state.cloudA, 2);
    slideSheet(ctx, g, state.cumulus, 0, state.cloudB, 1);
  }

  function drawBirds(ctx, g, t) {
    const u = g.U;
    const across = ((t * 0.012 + 0.3) % 1) * (g.W + u * 60) - u * 30;
    ctx.strokeStyle = '#3f4366';
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    for (let i = 0; i < BIRDS; i++) {
      const row = Math.abs(i - 3);
      const x = across - row * u * 5;
      const y = u * 21 + (i - 3) * u * 2.2 + row * u * 0.6 + Math.sin(t * 0.3 + i) * u * 0.4;
      const flap = Math.sin(t * 2.2 + i * 1.7) * u * 0.8;
      ctx.moveTo(x - u * 1.8, y - flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + u * 1.8, y - flap);
    }
    ctx.stroke();
  }

  function drawGlints(ctx, g, t) {
    const o = state.glints;
    ctx.fillStyle = '#fbe0c0';
    const h = Math.max(1, g.U * 0.4);
    for (let i = 0; i < MAX_GLINTS; i++) {
      const a = Math.sin(t * 0.8 + o.p[i]);
      if (a < 0.15) continue;
      ctx.globalAlpha = a * 0.6;
      ctx.fillRect(o.x[i] + Math.sin(t * 0.25 + o.p[i]) * g.U, o.y[i], o.w[i], h);
    }
    ctx.globalAlpha = 1;
  }

  function drawBoat(ctx, g, t) {
    const u = g.U;
    const x = g.W * 0.27 + Math.sin(t * 0.012) * u * 14;
    const y = g.horizon + u * 5 + Math.sin(t * 0.6) * u * 0.2;
    ctx.fillStyle = '#4b4663';
    ctx.beginPath();
    ctx.moveTo(x - u * 4.6, y - u * 1.2);
    ctx.lineTo(x + u * 4.6, y - u * 1.6);
    ctx.lineTo(x + u * 3.2, y);
    ctx.lineTo(x - u * 3.6, y);
    ctx.fill();
    ctx.fillRect(x - u * 2, y - u * 3.2, u * 2.6, u * 2.2);
  }

  function drawStar(ctx, g, t) {
    ctx.fillStyle = '#fdf0d0';
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 0.4);
    ctx.fillRect(g.W * 0.6, g.U * 7, Math.max(1, g.U * 0.8), Math.max(1, g.U * 0.8));
    ctx.globalAlpha = 1;
  }

  function drawHouseLight(ctx, t) {
    const l = state.houseLight;
    ctx.fillStyle = '#f2cf80';
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 0.35);
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.globalAlpha = 1;
  }

  // Where the loop stands: how far down the arm is and how lit the lamps are.
  function timeline(g, wait) {
    const c = state.clock;
    const passFor = (g.W + state.trains[0].len) / (g.U * TRAIN_SPEED);
    const riseAt = TRAIN_AT + passFor + 1.5;
    const down = smoothstep(0, 1, (c - LOWER_AT) / LOWER_FOR) - smoothstep(0, 1, (c - riseAt) / RISE_FOR);
    const lamps = smoothstep(0, 1.6, c) * (1 - smoothstep(riseAt + 1, riseAt + 3.5, c));
    return { down, lamps, pass: (c - TRAIN_AT) / passFor, loop: riseAt + RISE_FOR + wait };
  }

  function drawArm(ctx, pivot, base, angle, scale) {
    const a = state.arm;
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(base + angle);
    ctx.scale(scale, scale);
    ctx.drawImage(a.canvas, -a.tail, -a.h / 2);
    ctx.restore();
  }

  function drawLens(ctx, x, y, r, level, glow) {
    const i = Math.round(level * (LENS_STEPS - 1));
    ctx.fillStyle = state.lens[i];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
    if (level < 0.04) return;
    const R = r * glow;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = level;
    ctx.drawImage(state.redGlow, x - R, y - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawLamps(ctx, set, c, env, glow) {
    const side = 0.5 + 0.5 * Math.sin((c * 6.283) / LAMP_PERIOD);
    drawLens(ctx, set.x1, set.y, set.r, side * env, glow);
    drawLens(ctx, set.x2, set.y, set.r, (1 - side) * env, glow);
  }

  function drawRoadWash(ctx, g, env) {
    if (env < 0.03) return;
    const u = g.U;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = env * 0.42;
    ctx.drawImage(state.redGlow, state.nearPivot.x - u * 40, state.nearPivot.y + u * 2, u * 70, u * 18);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawTrain(ctx, g, pass) {
    if (pass <= 0 || pass >= 1) return;
    const u = g.U;
    const tr = state.trains[state.dir > 0 ? 0 : 1];
    const span = g.W + tr.len;
    const x = state.dir > 0 ? -tr.len + pass * span : g.W - pass * span;
    ctx.drawImage(tr.canvas, x, trackY(g, x) + u * 1.6 - tr.b);
    const hx = state.dir > 0 ? x + tr.len : x;
    const hy = trackY(g, hx) + u * 1.6 - u * 11;
    const R = u * 10;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(state.warmGlow, hx - R, hy - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fdeec4';
    ctx.beginPath();
    ctx.arc(hx - state.dir * u * 1.4, hy, u * 1.2, 0, 6.3);
    ctx.fill();
  }

  function strokeBlades(ctx, o, from, to, t, wind, colour) {
    ctx.strokeStyle = colour;
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const h = o.h[i];
      const gust = Math.sin(t * 0.8 + o.x[i] * 0.04) + 0.5 * Math.sin(t * 1.7 + o.p[i]);
      const sway = gust * h * 0.17 * wind;
      ctx.moveTo(o.x[i], o.y[i]);
      ctx.quadraticCurveTo(o.x[i] + sway * 0.3, o.y[i] - h * 0.6, o.x[i] + sway + h * 0.1, o.y[i] - h);
    }
    ctx.stroke();
  }

  function strokePlumes(ctx, g, o, t, wind) {
    ctx.strokeStyle = '#e8cbb0';
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    for (let i = 0; i < o.plumes; i++) {
      const h = o.h[i];
      const gust = Math.sin(t * 0.8 + o.x[i] * 0.04) + 0.5 * Math.sin(t * 1.7 + o.p[i]);
      const tipX = o.x[i] + gust * h * 0.17 * wind + h * 0.1;
      const tipY = o.y[i] - h;
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(tipX + h * 0.14, tipY + h * 0.02, tipX + h * 0.26 + gust * g.U * 0.4, tipY + h * 0.2);
    }
    ctx.stroke();
  }

  function drawGrass(ctx, g, t, wind) {
    const o = state.blades;
    const body = o.n - o.plumes;
    const third = Math.floor(body / 3);
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    strokeBlades(ctx, o, 0, o.plumes, t, wind, GRASS[3]);
    strokeBlades(ctx, o, o.plumes, o.plumes + third, t, wind, GRASS[2]);
    strokeBlades(ctx, o, o.plumes + third, o.plumes + third * 2, t, wind, GRASS[1]);
    strokeBlades(ctx, o, o.plumes + third * 2, o.n, t, wind, GRASS[0]);
    strokePlumes(ctx, g, o, t, wind);
  }

  function makeLens() {
    const off = K.parseColor('#5a2f33');
    const on = K.parseColor('#f0603f');
    const list = [];
    for (let i = 0; i < LENS_STEPS; i++) list.push(K.toHex(K.mixColor(off, on, i / (LENS_STEPS - 1))));
    return list;
  }

  function setup(ctx, api) {
    const U = api.rows / 100;
    const g = { W: api.cols, H: api.rows, U, rc: api.cols * 0.42, yc: U * 73, horizon: U * 56, slope: 0.035, sunX: api.cols * 0.3 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g);
    state.streaks = paintStreaks(g);
    state.cumulus = paintCumulus(g, rand);
    state.sea = paintSea(g, rand);
    state.land = paintLand(g, rand);
    state.near = paintNear(g);
    state.arm = paintArm(U);
    state.trains = [paintTrain(g, K.rng(api.seed + 1), 1), paintTrain(g, K.rng(api.seed + 2), -1)];
    state.glints = makeGlints(g, rand);
    state.blades = makeBlades(g, rand);
    state.lens = makeLens();
    state.redGlow = paintGlow(32, '#ee4a2c', 0.75);
    state.warmGlow = paintGlow(32, '#f8cf88', 0.7);
    if (state.clock === undefined) {
      state.clock = START_AT;
      state.dir = 1;
      state.cloudA = 0;
      state.cloudB = 0;
    }
    state.dtNow = 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const wind = api.props.wind;
    state.dtNow = dt;
    state.clock += dt;
    let now = timeline(g, api.props.wait);
    if (state.clock >= now.loop) {
      state.clock -= now.loop;
      state.dir = -state.dir;
      now = timeline(g, api.props.wait);
    }
    ctx.drawImage(state.sky, 0, 0);
    drawStar(ctx, g, t);
    drawClouds(ctx, g, wind);
    drawBirds(ctx, g, t);
    ctx.drawImage(state.sea, 0, 0);
    drawGlints(ctx, g, t);
    drawBoat(ctx, g, t);
    ctx.drawImage(state.land, 0, 0);
    drawHouseLight(ctx, t);
    drawRoadWash(ctx, g, now.lamps);
    drawArm(ctx, state.farPivot, 0, -ARM_UP * (1 - now.down), 0.42);
    drawLamps(ctx, state.farLamps, state.clock, now.lamps, 2.6);
    drawTrain(ctx, g, now.pass);
    ctx.drawImage(state.near, 0, 0);
    drawArm(ctx, state.nearPivot, Math.PI, ARM_UP * (1 - now.down) - 0.015, 1);
    drawLamps(ctx, state.nearLamps, state.clock, now.lamps, 2.6);
    drawGrass(ctx, g, t, wind);
  }

  Kasuri.run({
    defaults: { wait: 25, wind: 1, ramp: 'lines', cell: 7, boost: 0.28, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
