/*
 * 炬燵 Kotatsu — a winter room, a quilted low table, a cat asleep on the quilt.
 *
 * The room is baked with a hole where the glass is, so snow is a short list of
 * rects drawn between the garden and the room. The cat is three sprites: the
 * body stretches a little with each breath, the head rides on it, an ear twitches.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const SNOW_DENSITY = 1 / 60;
  const SNOW_MAX = 320;
  const SNOW_TONES = ['#c0cce0', '#e0e7f1', '#ffffff'];
  const WISPS = 5;
  const POINTS = 10;
  const BREATH_SECONDS = 4.4;
  const CAT_SCALE = 0.92;
  const TAU = Math.PI * 2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function oval(ctx, x, y, rx, ry, tilt, from, to) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, tilt, from, to);
    ctx.fill();
  }

  function seg(ctx, x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function arc2(ctx, x0, y0, cx, cy, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }

  function tri(ctx, x0, y0, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.fill();
  }

  function flatSteps(grad, tones) {
    tones.forEach((tone, i) => {
      grad.addColorStop(i / tones.length, tone);
      grad.addColorStop((i + 1) / tones.length, tone);
    });
    return grad;
  }

  // Everything is placed once here, in cells, from the display's own shape.
  function plan(g) {
    const u = g.U;
    const cx = g.W * 0.55;
    return {
      cx,
      shoji: { x0: g.W * 0.035, x1: g.W * 0.2 },
      glass: { x0: g.W * 0.2, x1: cx + u * 8, y0: u * 7, y1: u * 47 },
      floorY: u * 52,
      table: { backY: u * 41, nearY: u * 55, backW: u * 38, nearW: u * 46 },
      lamp: { x: g.W * 0.9, foot: u * 60, top: u * 23, w: u * 15 },
      cat: { x: cx - u * 1, y: u * 77 },
      cup: { x: cx + u * 22, y: u * 51.5 },
      bowl: { x: cx - u * 17, y: u * 51 },
    };
  }

  /* ---------- the garden through the glass ---------- */

  // A lumpy pad of needles with snow sitting on its upper half.
  function snowCap(ctx, x, y, rx, ry, dark) {
    const lumps = [[-0.58, 0.72], [0, 1], [0.58, 0.78]];
    ctx.fillStyle = dark;
    for (const l of lumps) oval(ctx, x + l[0] * rx, y + ry * 0.2, rx * 0.58, ry * 1.1 * l[1], 0, 0, TAU);
    ctx.fillStyle = '#e8edf5';
    for (const l of lumps) oval(ctx, x + l[0] * rx, y - ry * 0.52 * l[1], rx * 0.46, ry * 0.36 * l[1], 0, 0, TAU);
  }

  function paintPine(ctx, u, x, ground) {
    ctx.strokeStyle = '#272a38';
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 2.8;
    ctx.beginPath();
    ctx.moveTo(x, ground + u);
    ctx.bezierCurveTo(x + u * 5, ground - u * 8, x - u * 5, ground - u * 12, x + u * 1, ground - u * 21);
    ctx.stroke();
    ctx.lineWidth = u * 1.1;
    const pads = [[-13, -7, 8, 2.6], [12, -10, 9, 2.8], [-9, -14, 8, 2.6], [8, -17, 7, 2.4], [0, -22, 7, 2.6]];
    for (const p of pads) seg(ctx, x, ground + u * p[1] * 0.8, x + u * p[0], ground + u * p[1]);
    for (const p of pads) snowCap(ctx, x + u * p[0], ground + u * p[1], u * p[2], u * p[3], '#22363f');
  }

  function paintStoneLantern(ctx, u, x, ground) {
    ctx.fillStyle = '#3e4356';
    ctx.fillRect(x - u * 1.5, ground - u * 8, u * 3, u * 8);
    ctx.fillRect(x - u * 3.2, ground - u * 1.2, u * 6.4, u * 1.8);
    ctx.fillRect(x - u * 3.2, ground - u * 9.4, u * 6.4, u * 1.4);
    ctx.fillRect(x - u * 2.6, ground - u * 13.8, u * 5.2, u * 4.4);
    ctx.fillStyle = '#f4bd68';
    ctx.fillRect(x - u * 1.5, ground - u * 13.2, u * 3, u * 3.2);
    ctx.fillStyle = '#31364a';
    tri(ctx, x - u * 5.6, ground - u * 13.6, x, ground - u * 17.4, x + u * 5.6, ground - u * 13.6);
    ctx.fillStyle = '#e8edf5';
    oval(ctx, x, ground - u * 16.2, u * 5, u * 1.9, 0, 0, TAU);
  }

  function paintGarden(g, L, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const { x0, x1, y0, y1 } = L.glass;
    const w = x1 - x0;
    const ground = lerp(y0, y1, 0.66);
    const sky = ctx.createLinearGradient(0, y0, 0, ground);
    sky.addColorStop(0, '#5c6ea4');
    sky.addColorStop(0.45, '#5c6ea4');
    sky.addColorStop(0.45, '#6e80b2');
    sky.addColorStop(0.78, '#6e80b2');
    sky.addColorStop(0.78, '#8293bf');
    sky.addColorStop(1, '#8293bf');
    ctx.fillStyle = sky;
    ctx.fillRect(x0, y0, w, y1 - y0);
    ctx.fillStyle = '#5a6a9a';
    for (let x = x0; x < x1; x += u * 2.2) {
      const top = ground - u * (6 + 3 * K.fbm(x * 0.05 / u, 3.1, 3));
      ctx.fillRect(x, top, u * 2.4, ground - top);
    }
    ctx.fillStyle = '#c4d0e4';
    ctx.fillRect(x0, ground, w, y1 - ground);
    ctx.fillStyle = '#a8b9d6';
    for (let i = 0; i < 5; i++) oval(ctx, x0 + w * (0.1 + i * 0.2), ground + u * (5 + (i % 2) * 2), w * 0.14, u * 1.2, 0, 0, TAU);
    paintPine(ctx, u, x0 + w * 0.27, ground + u * 2);
    paintStoneLantern(ctx, u, x0 + w * 0.885, ground + u * 2.5);
    snowCap(ctx, x0 + w * 0.06, ground + u * 3.5, u * 8, u * 4, '#22363f');
    snowCap(ctx, x0 + w * 0.56, ground + u * 1.5, u * 6, u * 3, '#22363f');
    return c;
  }

  /* ---------- the room ---------- */

  // Light falls off in flat rings, which the weave softens. A smooth ramp here
  // would scatter the wall across too many tones.
  function rings(ctx, x, y, inner, outer, tones) {
    return flatSteps(ctx.createRadialGradient(x, y, inner, x, y, outer), tones);
  }

  // Stipple across each ring's edge so no arc shows on the plaster.
  function softenRings(ctx, g, rand, x, y, inner, outer, tones) {
    const step = (outer - inner) / tones.length;
    for (let i = 0; i < tones.length - 1; i++) {
      const r = inner + step * (i + 1);
      const count = Math.round((r * 2.2) / Math.max(0.5, g.U * 0.25));
      for (let n = 0; n < count; n++) {
        const a = rand() * TAU;
        const off = (rand() - 0.5) * step * 0.7;
        ctx.fillStyle = off < 0 ? tones[i + 1] : tones[i];
        ctx.fillRect(x + Math.cos(a) * (r + off), y + Math.sin(a) * (r + off), Math.max(1, g.U * 0.7), Math.max(1, g.U * 0.7));
      }
    }
  }

  function paintWall(ctx, g, L, rand) {
    const tones = ['#d0a060', '#c09060', '#b08050', '#a08050', '#907050', '#806040'];
    const y = g.U * 38;
    ctx.fillStyle = rings(ctx, L.lamp.x, y, g.U * 8, g.U * 120, tones);
    ctx.fillRect(0, 0, g.W, g.H);
    softenRings(ctx, g, rand, L.lamp.x, y, g.U * 8, g.U * 120, tones);
  }

  function paintWoodwork(ctx, g, L) {
    const u = g.U;
    const { x0, x1, y0, y1 } = L.glass;
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#cdb88c';
    ctx.fillRect(L.shoji.x0, y0, L.shoji.x1 - L.shoji.x0, y1 - y0);
    ctx.fillStyle = '#4b3424';
    const sw = L.shoji.x1 - L.shoji.x0;
    for (let i = 0; i <= 3; i++) ctx.fillRect(L.shoji.x0 + (sw * i) / 3 - u * 0.25, y0, u * 0.5, y1 - y0);
    for (let j = 1; j < 5; j++) ctx.fillRect(L.shoji.x0, y0 + ((y1 - y0) * j) / 5 - u * 0.25, sw, u * 0.5);
    ctx.fillStyle = '#3f2c20';
    const panes = Math.max(2, Math.round((x1 - x0) / (u * 24)));
    for (let i = 0; i <= panes; i++) ctx.fillRect(x0 + ((x1 - x0) * i) / panes - u * 0.7, y0, u * 1.4, y1 - y0);
    ctx.fillRect(x0, lerp(y0, y1, 0.3), x1 - x0, u * 0.7);
    ctx.fillRect(L.shoji.x0 - u, y0 - u * 2.4, x1 - L.shoji.x0 + u * 2, u * 2.6);
    ctx.fillRect(L.shoji.x0 - u, y1 - u * 0.2, x1 - L.shoji.x0 + u * 2, u * 2);
    ctx.fillRect(L.shoji.x0 - u * 1.4, y0 - u * 2.4, u * 1.6, y1 - y0 + u * 4.4);
    ctx.fillStyle = '#5b4230';
    ctx.fillRect(0, 0, g.W, u * 3);
  }

  function paintTatami(ctx, g, L, rand) {
    const top = L.floorY;
    ctx.fillStyle = rings(ctx, L.lamp.x, top + g.U * 6, g.U * 6, g.U * 130, ['#c8b878', '#a8a068', '#8c8a58', '#7f7f52']);
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#4a4a2c';
    ctx.globalAlpha = 0.16;
    for (let y = top; y < g.H; y += Math.max(2, g.U * 1.8)) ctx.fillRect(0, y, g.W, 1);
    ctx.globalAlpha = 1;
    paintTatamiEdges(ctx, g, L, rand);
    ctx.fillStyle = '#3c2a1f';
    ctx.fillRect(0, top - g.U, g.W, g.U * 1.4);
  }

  function paintTatamiEdges(ctx, g, L, rand) {
    const u = g.U;
    ctx.fillStyle = '#3f4a3a';
    ctx.beginPath();
    ctx.moveTo(L.cx - u * 62, L.floorY);
    ctx.lineTo(L.cx - u * 60, L.floorY);
    ctx.lineTo(L.cx - u * 118, g.H);
    ctx.lineTo(L.cx - u * 124, g.H);
    ctx.fill();
    ctx.fillStyle = '#5c5c38';
    for (let i = 0; i < 50; i++) ctx.fillRect(rand() * g.W, L.floorY + rand() * (g.H - L.floorY), u * (1 + rand() * 4), 1);
  }

  function paintLamp(ctx, g, L) {
    const u = g.U;
    const { x, foot, top, w } = L.lamp;
    const shade = ctx.createLinearGradient(0, top, 0, foot - u * 6);
    shade.addColorStop(0, '#f7e6b8');
    shade.addColorStop(1, '#efbe6c');
    ctx.fillStyle = shade;
    ctx.fillRect(x - w / 2, top, w, foot - top - u * 6);
    ctx.fillStyle = '#3f2c20';
    ctx.fillRect(x - w / 2 - u * 0.8, top - u * 1.6, w + u * 1.6, u * 1.6);
    ctx.fillRect(x - w / 2 - u * 0.8, foot - u * 6, w + u * 1.6, u * 1.2);
    for (const side of [-1, 1]) ctx.fillRect(x + side * (w / 2 + u * 0.1) - u * 0.7, top - u * 1.6, u * 1.4, foot - top + u * 1.6);
    ctx.fillRect(x - u * 0.35, top, u * 0.7, foot - top - u * 6);
    const rows = 3;
    const h = foot - top - u * 6;
    for (let j = 1; j < rows; j++) ctx.fillRect(x - w / 2, top + (h * j) / rows - u * 0.2, w, u * 0.4);
  }

  function quiltOutline(ctx, L, u) {
    const { cx } = L;
    ctx.beginPath();
    ctx.moveTo(cx - u * 44, u * 54);
    ctx.bezierCurveTo(cx - u * 52, u * 60, cx - u * 60, u * 72, cx - u * 66, u * 84);
    ctx.bezierCurveTo(cx - u * 70, u * 92, cx - u * 66, u * 97, cx - u * 56, u * 98);
    ctx.quadraticCurveTo(cx, u * 108, cx + u * 56, u * 98);
    ctx.bezierCurveTo(cx + u * 66, u * 97, cx + u * 70, u * 92, cx + u * 66, u * 84);
    ctx.bezierCurveTo(cx + u * 60, u * 72, cx + u * 52, u * 60, cx + u * 44, u * 54);
    ctx.closePath();
  }

  function quiltPoint(L, u, a, b) {
    const half = lerp(46, 72, Math.pow(b, 0.8));
    return [L.cx + a * half * u, u * (55 + b * 50)];
  }

  function quiltTile(ctx, L, u, a0, a1, b0, b1, tone) {
    const p = [quiltPoint(L, u, a0, b0), quiltPoint(L, u, a1, b0), quiltPoint(L, u, a1, b1), quiltPoint(L, u, a0, b1)];
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2d3a60';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.stroke();
    const [mx, my] = quiltPoint(L, u, (a0 + a1) / 2, (b0 + b1) / 2);
    ctx.fillStyle = '#c0c3cc';
    ctx.fillRect(mx - u * 0.3, my - u * 0.3, Math.max(1, u * 0.6), Math.max(1, u * 0.6));
  }

  function paintQuilt(ctx, g, L, rand) {
    const u = g.U;
    const zones = [
      ['#4a6098', '#5a72aa', '#6780b4'],
      ['#4a6098', '#5a72aa', '#6780b4'],
      ['#5a72aa', '#6780b4', '#7a8cb8'],
    ];
    ctx.save();
    quiltOutline(ctx, L, u);
    ctx.clip();
    ctx.fillStyle = '#3a4c7c';
    ctx.fillRect(0, 0, g.W, g.H);
    const cols = 10;
    const rows = 6;
    for (let j = 0; j < rows; j++) {
      const b0 = Math.pow(j / rows, 1.25);
      const b1 = Math.pow((j + 1) / rows, 1.25);
      for (let i = -cols / 2; i < cols / 2; i++) {
        const tones = zones[i < -2 ? 0 : i < 2 ? 1 : 2];
        const tone = tones[(Math.abs(i) + j * 3 + Math.floor(rand() * 1.4)) % tones.length];
        quiltTile(ctx, L, u, (i / cols) * 2.1, ((i + 1) / cols) * 2.1, b0, b1, tone);
      }
    }
    paintQuiltFolds(ctx, L, u);
    ctx.restore();
    quiltOutline(ctx, L, u);
    ctx.strokeStyle = '#c0533a';
    ctx.lineWidth = u * 3.2;
    ctx.stroke();
  }

  function paintQuiltFolds(ctx, L, u) {
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.strokeStyle = 'rgba(18,22,44,0.42)';
      ctx.lineWidth = u * 3;
      arc2(ctx, L.cx + side * u * 46, u * 55, L.cx + side * u * 50, u * 72, L.cx + side * u * 62, u * 92);
      ctx.strokeStyle = 'rgba(150,175,215,0.2)';
      ctx.lineWidth = u * 1.2;
      arc2(ctx, L.cx + side * u * 48, u * 56, L.cx + side * u * 54, u * 72, L.cx + side * u * 65, u * 90);
    }
    ctx.fillStyle = 'rgba(14,16,34,0.34)';
    ctx.fillRect(L.cx - u * 70, u * 55, u * 140, u * 4.6);
    for (let i = 2; i > 0; i--) {
      ctx.fillStyle = 'rgba(12,14,30,0.22)';
      oval(ctx, L.cat.x, L.cat.y + u * 7, u * (24 + i * 4), u * (13 + i * 2.4), 0, 0, TAU);
    }
  }

  function paintTable(ctx, g, L, rand) {
    const u = g.U;
    const { cx, table: T } = L;
    ctx.fillStyle = flatSteps(ctx.createLinearGradient(cx - T.nearW, 0, cx + T.nearW, 0), ['#a2703f', '#b27e4a', '#c28d55', '#d09c62']);
    ctx.beginPath();
    ctx.moveTo(cx - T.backW, T.backY);
    ctx.lineTo(cx + T.backW, T.backY);
    ctx.lineTo(cx + T.nearW, T.nearY);
    ctx.lineTo(cx - T.nearW, T.nearY);
    ctx.fill();
    ctx.fillStyle = '#5e3a22';
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 26; i++) {
      const b = rand();
      const half = lerp(T.backW, T.nearW, b);
      const w = half * (0.2 + rand() * 0.5);
      ctx.fillRect(cx - half + rand() * (half * 2 - w), lerp(T.backY, T.nearY, b), w, Math.max(1, u * 0.35));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#62402a';
    ctx.fillRect(cx - T.nearW, T.nearY, T.nearW * 2, u * 2.2);
  }

  function paintMikan(ctx, u, x, y, r) {
    const skin = ctx.createRadialGradient(x + r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    skin.addColorStop(0, '#f8bb5c');
    skin.addColorStop(0.6, '#ea8f2f');
    skin.addColorStop(1, '#b4601f');
    ctx.fillStyle = skin;
    oval(ctx, x, y, r, r * 0.92, 0, 0, TAU);
    ctx.fillStyle = '#4e5a2c';
    ctx.fillRect(x - u * 0.4, y - r * 0.85, Math.max(1, u * 0.8), Math.max(1, u * 0.6));
  }

  function paintBowl(ctx, L, u) {
    const { x, y } = L.bowl;
    ctx.fillStyle = 'rgba(40,20,10,0.45)';
    oval(ctx, x + u * 2, y + u * 0.2, u * 12, u * 2, 0, 0, TAU);
    ctx.fillStyle = '#8f8872';
    oval(ctx, x, y - u * 7, u * 14, u * 3.4, 0, 0, TAU);
    const fruit = [[-6, -13, 4.2], [1, -14, 4.4], [7, -12, 4], [-2, -18.5, 4.2], [-10, -10, 4], [-3.5, -10, 4.4], [3.5, -9.5, 4.4], [10, -9.5, 4]];
    for (const f of fruit) paintMikan(ctx, u, x + u * f[0], y + u * f[1], u * f[2]);
    const glaze = ctx.createLinearGradient(x - u * 14, 0, x + u * 14, 0);
    glaze.addColorStop(0, '#a9a48f');
    glaze.addColorStop(1, '#e7e0ca');
    ctx.fillStyle = glaze;
    ctx.beginPath();
    ctx.moveTo(x - u * 14, y - u * 7);
    ctx.quadraticCurveTo(x, y - u * 3.2, x + u * 14, y - u * 7);
    ctx.quadraticCurveTo(x + u * 13, y - u * 0.5, x + u * 5, y);
    ctx.lineTo(x - u * 5, y);
    ctx.quadraticCurveTo(x - u * 13, y - u * 0.5, x - u * 14, y - u * 7);
    ctx.fill();
    ctx.strokeStyle = '#33466f';
    ctx.lineWidth = Math.max(1, u * 0.7);
    arc2(ctx, x - u * 12.6, y - u * 3.6, x, y - u * 0.6, x + u * 12.6, y - u * 3.6);
    ctx.fillStyle = 'rgba(40,20,10,0.4)';
    oval(ctx, x + u * 19.5, y + u * 1.8, u * 4.4, u * 1.2, 0, 0, TAU);
    paintMikan(ctx, u, x + u * 18.5, y - u * 1.6, u * 4);
  }

  function paintCup(ctx, L, u) {
    const { x, y } = L.cup;
    ctx.fillStyle = '#5a3620';
    oval(ctx, x, y, u * 8, u * 2.2, 0, 0, TAU);
    const glaze = ctx.createLinearGradient(x - u * 5, 0, x + u * 5, 0);
    glaze.addColorStop(0, '#9a9b94');
    glaze.addColorStop(1, '#ece6d4');
    ctx.fillStyle = glaze;
    ctx.beginPath();
    ctx.moveTo(x - u * 5.2, y - u * 10);
    ctx.lineTo(x - u * 4.2, y - u * 0.4);
    ctx.quadraticCurveTo(x, y + u * 1, x + u * 4.2, y - u * 0.4);
    ctx.lineTo(x + u * 5.2, y - u * 10);
    ctx.fill();
    ctx.fillStyle = '#d9d2bc';
    oval(ctx, x, y - u * 10, u * 5.2, u * 1.5, 0, 0, TAU);
    ctx.fillStyle = '#6d7d3e';
    oval(ctx, x, y - u * 9.9, u * 4.3, u * 1, 0, 0, TAU);
    ctx.fillStyle = '#33466f';
    ctx.fillRect(x - u * 4.8, y - u * 6, u * 9.6, Math.max(1, u * 0.8));
  }

  function paintRoom(g, L, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, L, rand);
    paintWoodwork(ctx, g, L);
    paintTatami(ctx, g, L, rand);
    paintLamp(ctx, g, L);
    paintQuilt(ctx, g, L, rand);
    paintTable(ctx, g, L, rand);
    paintBowl(ctx, L, g.U);
    paintCup(ctx, L, g.U);
    return c;
  }

  function paintGlow(radius) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(240,180,100,0.3)');
    grad.addColorStop(0.5, 'rgba(235,165,90,0.08)');
    grad.addColorStop(1, 'rgba(235,165,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  /* ---------- the cat, drawn in its own units around its middle ---------- */

  function catLayer(k, halfW, up, down) {
    const c = layer(halfW * 2 * k, (up + down) * k);
    const ctx = c.getContext('2d');
    ctx.scale(k, k);
    ctx.translate(halfW, up);
    return { canvas: c, ctx, halfW, up };
  }

  function bodyPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-25, 2);
    ctx.bezierCurveTo(-27, -9, -15, -17, -2, -18);
    ctx.bezierCurveTo(11, -19, 25, -15, 29, -5);
    ctx.bezierCurveTo(32, 4, 29, 13, 17, 16);
    ctx.bezierCurveTo(6, 18, -12, 18, -20, 14);
    ctx.bezierCurveTo(-25, 11, -25, 6, -25, 2);
    ctx.closePath();
  }

  function stripe(ctx, a, r0, r1, width) {
    const ox = Math.cos(a) * 31;
    const oy = Math.sin(a) * 21 + 2;
    const nx = -Math.sin(a) * width;
    const ny = Math.cos(a) * width;
    ctx.beginPath();
    ctx.moveTo(ox * r0 + nx, oy * r0 + ny);
    ctx.quadraticCurveTo(ox * (r0 + r1) * 0.5 + nx * 0.9 + 1.5, oy * (r0 + r1) * 0.5 + ny * 0.9, ox * r1 + 1.5, oy * r1);
    ctx.quadraticCurveTo(ox * (r0 + r1) * 0.5 - nx * 0.9 + 1.5, oy * (r0 + r1) * 0.5 - ny * 0.9, ox * r0 - nx, oy * r0 - ny);
    ctx.fill();
  }

  function paintBody(k) {
    const L = catLayer(k, 40, 26, 24);
    const ctx = L.ctx;
    const fur = flatSteps(ctx.createLinearGradient(-8, -19, 8, 18), ['#ffbc66', '#f8aa50', '#f09c42', '#d8843a']);
    bodyPath(ctx);
    ctx.fillStyle = fur;
    ctx.fill();
    ctx.save();
    bodyPath(ctx);
    ctx.clip();
    ctx.fillStyle = '#b4601f';
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (1.02 + i * 0.085);
      stripe(ctx, a, 1.08, i % 2 ? 0.6 : 0.45, 1.5);
    }
    ctx.fillStyle = '#ffc070';
    ctx.globalAlpha = 0.55;
    oval(ctx, 16, 4, 13, 11, -0.2, 0, TAU);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(90,40,14,0.34)';
    oval(ctx, -22, -1, 17, 15, 0, 0, TAU);
    ctx.strokeStyle = '#a0531c';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(10, -9);
    ctx.bezierCurveTo(1, -3, 2, 9, 9, 15);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    for (const s of [[15, -3, 22, 1], [13, 3, 21, 7], [15, 9, 21, 11]]) seg(ctx, s[0], s[1], s[2], s[3]);
    ctx.restore();
    return L;
  }

  function paintFront(k) {
    const L = catLayer(k, 40, 26, 30);
    const ctx = L.ctx;
    ctx.lineCap = 'round';
    const tail = () => {
      ctx.beginPath();
      ctx.moveTo(28, 6);
      ctx.bezierCurveTo(31, 18, 12, 22, -2, 21);
      ctx.quadraticCurveTo(-11, 20.5, -16, 18);
    };
    ctx.strokeStyle = '#7f4218';
    ctx.lineWidth = 8.4;
    tail();
    ctx.stroke();
    ctx.strokeStyle = '#f09c42';
    ctx.lineWidth = 7;
    tail();
    ctx.stroke();
    ctx.strokeStyle = '#b4601f';
    ctx.lineCap = 'butt';
    ctx.setLineDash([2.4, 4.6]);
    tail();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.fillStyle = '#f3e7cf';
    ctx.strokeStyle = '#8c6a40';
    ctx.lineWidth = 0.7;
    oval(ctx, -30, 15.5, 6, 3.6, -0.08, 0, TAU);
    ctx.stroke();
    return L;
  }

  function headPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-13, -3);
    ctx.bezierCurveTo(-11, -9.5, 11, -9.5, 13, -3);
    ctx.bezierCurveTo(15.5, 2, 13, 9, 7, 10.5);
    ctx.quadraticCurveTo(0, 12.5, -7, 10.5);
    ctx.bezierCurveTo(-13, 9, -15.5, 2, -13, -3);
    ctx.closePath();
  }

  function paintFace(ctx) {
    ctx.fillStyle = '#f5ead4';
    ctx.beginPath();
    ctx.ellipse(-2.8, 6.2, 3.8, 3, 0, 0, TAU);
    ctx.ellipse(2.8, 6.2, 3.8, 3, 0, 0, TAU);
    ctx.fill();
    oval(ctx, 0, 8.8, 3.2, 2.2, 0, 0, TAU);
    ctx.fillStyle = '#c0604a';
    tri(ctx, -1.5, 3.6, 1.5, 3.6, 0, 5.4);
    ctx.strokeStyle = '#4a2612';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) arc2(ctx, side * 3, 0.6, side * 6.4, 2.6, side * 9.6, 0);
    ctx.lineWidth = 0.6;
    seg(ctx, 0, 5.4, 0, 6.6);
  }

  function paintHeadStripes(ctx) {
    ctx.strokeStyle = '#b4601f';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    const marks = [[0, -8, 0, -3.5], [-3.6, -8, -2.4, -4], [3.6, -8, 2.4, -4], [-7, -7, -5, -3.6], [7, -7, 5, -3.6]];
    for (const m of marks) seg(ctx, m[0], m[1], m[2], m[3]);
    for (const side of [-1, 1]) {
      for (const y of [3.4, 6.4]) seg(ctx, side * 14, y - 0.5, side * 9.6, y + 0.3);
    }
  }

  function paintHead(k) {
    const L = catLayer(k, 20, 14, 16);
    const ctx = L.ctx;
    headPath(ctx);
    ctx.fillStyle = '#fcae58';
    ctx.fill();
    ctx.strokeStyle = '#7f4218';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    paintHeadStripes(ctx);
    paintFace(ctx);
    return L;
  }

  function paintEar(k, side) {
    const L = catLayer(k, 9, 13, 3);
    const ctx = L.ctx;
    ctx.fillStyle = '#ffae58';
    ctx.strokeStyle = '#7f4218';
    ctx.lineWidth = 0.9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-5.4, 1.5);
    ctx.quadraticCurveTo(side * 2.6 - 0.8, -6, side * 2.6, -11);
    ctx.quadraticCurveTo(side * 2.6 + 1.6, -5, 5.4, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b4583f';
    tri(ctx, -2.8, 0.8, side * 2.2, -7.5, 2.8, 0.8);
    return L;
  }

  function paintCat(g) {
    const k = g.U * CAT_SCALE;
    return {
      k,
      body: paintBody(k),
      front: paintFront(k),
      head: paintHead(k),
      ears: [paintEar(k, -1), paintEar(k, 1)],
      headAt: { x: -23, y: 5.5, tilt: -0.16 },
      earAt: [{ x: -8.6, y: -6.4, tilt: -0.34 }, { x: 8.6, y: -6.4, tilt: 0.34 }],
    };
  }

  /* ---------- what moves ---------- */

  function makeSnow(g, L, rand) {
    const area = (L.glass.x1 - L.glass.x0) * (L.glass.y1 - L.glass.y0);
    const base = Math.min(SNOW_MAX / 2, Math.round(area * SNOW_DENSITY));
    const n = base * 2;
    const snow = { base, n, x: new Float32Array(n), phase: new Float32Array(n), rate: new Float32Array(n), sway: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const depth = i % 3;
      snow.x[i] = rand();
      snow.phase[i] = rand();
      snow.rate[i] = (0.035 + depth * 0.03) * (0.8 + rand() * 0.4);
      snow.sway[i] = g.U * (0.6 + depth * 0.7) * (0.6 + rand() * 0.8);
    }
    return snow;
  }

  function drawSnow(ctx, g, t, amount) {
    const { snow, L } = state;
    const { x0, x1, y0, y1 } = L.glass;
    const w = x1 - x0;
    const h = y1 - y0;
    const count = Math.min(snow.n, Math.round(snow.base * amount));
    for (let depth = 0; depth < 3; depth++) {
      ctx.fillStyle = SNOW_TONES[depth];
      const size = Math.max(1, g.U * (0.5 + depth * 0.32));
      for (let i = depth; i < count; i += 3) {
        const y = y0 + ((t * snow.rate[i] + snow.phase[i]) % 1) * h;
        const x = x0 + ((snow.x[i] * w + Math.sin(t * 0.5 + snow.phase[i] * 40) * snow.sway[i]) % w + w) % w;
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  function makeWisps(g, rand) {
    const list = [];
    for (let i = 0; i < WISPS; i++) {
      list.push({
        offset: (i / (WISPS - 1) - 0.5) * 6 * g.U,
        phase: rand() * 6.28,
        rate: 0.1 + rand() * 0.07,
        start: i / WISPS,
        rise: g.U * (22 + rand() * 12),
        wobble: g.U * (1.5 + rand() * 2),
      });
    }
    return list;
  }

  function drawWisp(ctx, g, w, t, amount) {
    const x0 = state.L.cup.x + w.offset;
    const y0 = state.L.cup.y - g.U * 11;
    const life = (t * w.rate + w.start) % 1;
    const fade = Math.sin(life * Math.PI);
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = Math.min(1, fade * amount * (pass ? 0.34 : 0.22));
      ctx.lineWidth = Math.max(1, g.U * (pass ? 1 : 3));
      ctx.beginPath();
      for (let p = 0; p <= POINTS; p++) {
        const f = p / POINTS;
        const rise = (life * 0.55 + f * 0.45) * w.rise;
        const x = x0 + Math.sin(f * 4 + t * 0.6 + w.phase) * f * w.wobble;
        if (p === 0) ctx.moveTo(x, y0 - rise);
        else ctx.lineTo(x, y0 - rise);
      }
      ctx.stroke();
    }
  }

  // A short list of quiet gaps; after each, one ear twitches twice and settles.
  function makeFlicks(rand) {
    const gaps = [];
    let total = 0;
    for (let i = 0; i < 9; i++) {
      const gap = 3.5 + rand() * 5;
      gaps.push(gap);
      total += gap;
    }
    return { gaps, total };
  }

  function setFlick(t) {
    const { gaps, total } = state.flicks;
    let local = t % total;
    state.ear0 = 0;
    state.ear1 = 0;
    for (let i = 0; i < gaps.length; i++) {
      if (local < gaps[i]) {
        const s = local;
        if (s < 0.9) {
          const swing = Math.sin(s * 15) * Math.exp(-s * 3.6) * 0.62;
          if (i % 3 === 2) state.ear0 = -swing;
          else state.ear1 = swing;
        }
        return;
      }
      local -= gaps[i];
    }
  }

  function drawSprite(ctx, sprite, k) {
    ctx.drawImage(sprite.canvas, -sprite.halfW * k, -sprite.up * k);
  }

  function drawCat(ctx, t) {
    const { cat, L } = state;
    const k = cat.k;
    const b = 0.5 + 0.5 * Math.sin((t * TAU) / BREATH_SECONDS);
    const sx = 1 + 0.012 * b;
    const sy = 1 + 0.06 * b;
    const foot = 17;
    const body = cat.body;
    const dw = body.canvas.width * sx;
    const dh = body.canvas.height * sy;
    const left = L.cat.x - body.halfW * k * sx;
    const top = L.cat.y + foot * k - (body.up + foot) * k * sy;
    ctx.drawImage(body.canvas, left, top, dw, dh);
    ctx.drawImage(cat.front.canvas, L.cat.x - cat.front.halfW * k, L.cat.y - cat.front.up * k);
    setFlick(t);
    ctx.save();
    ctx.translate(L.cat.x + cat.headAt.x * k, L.cat.y + (cat.headAt.y - b * 0.7) * k);
    ctx.rotate(cat.headAt.tilt + b * 0.012);
    for (let i = 0; i < 2; i++) {
      const e = cat.earAt[i];
      ctx.save();
      ctx.translate(e.x * k, e.y * k);
      ctx.rotate(e.tilt + (i ? state.ear1 : state.ear0));
      drawSprite(ctx, cat.ears[i], k);
      ctx.restore();
    }
    drawSprite(ctx, cat.head, k);
    ctx.restore();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const L = plan(g);
    state.g = g;
    state.L = L;
    state.garden = paintGarden(g, L, rand);
    state.room = paintRoom(g, L, rand);
    state.glow = paintGlow(g.U * 24);
    state.cat = paintCat(g);
    state.snow = makeSnow(g, L, rand);
    state.wisps = makeWisps(g, rand);
    state.flicks = makeFlicks(rand);
  }

  function draw(ctx, t, dt, api) {
    const { g, L } = state;
    ctx.drawImage(state.garden, 0, 0);
    drawSnow(ctx, g, t, api.props.snow);
    ctx.drawImage(state.room, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.84 + 0.16 * Math.sin(t * 0.55);
    const r = state.glow.width / 2;
    ctx.drawImage(state.glow, L.lamp.x - r, g.U * 38 - r);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f4ecdb';
    ctx.lineCap = 'round';
    for (const w of state.wisps) drawWisp(ctx, g, w, t, api.props.steam);
    ctx.globalAlpha = 1;
    drawCat(ctx, t);
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.25 },
    maxFps: 20,
    setup,
    draw,
  });
})();
