/*
 * 羚羊 Kamoshika — a Japanese serow on a rock ledge among beeches in the first snow.
 *
 * Sky, ridges, pagoda, trees and the crag are baked once into layers. Mist is a few tiling
 * strips sliding at different speeds between them. The stocky serow body is baked; its head,
 * turned to look out, sways a little, an ear flicks and breath rises. Flakes are a reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const FLAKES = 120;
  const PUFFS = 4;
  const BANDS = [
    { y: 0.5, h: 0.2, v: 0.9, a: 0.85, seed: 3 },
    { y: 0.62, h: 0.2, v: 1.5, a: 0.8, seed: 7 },
    { y: 0.84, h: 0.2, v: 2.1, a: 0.9, seed: 13 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const s = Math.min(U * 1.12, W / 72);
    return { W, H, U, s, gy: Math.round(H * 0.74), sx: W * 0.56 };
  }

  // ---- sky, ridges, pagoda -------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    grad.addColorStop(0, '#aeb2ac');
    grad.addColorStop(0.5, '#cfcdbf');
    grad.addColorStop(1, '#e4e0ce');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#eadfb8';
    ctx.globalAlpha = 0.55;
    blob(ctx, g.W * 0.8, g.H * 0.2, g.U * 7, g.U * 7);
    ctx.globalAlpha = 0.3;
    blob(ctx, g.W * 0.8, g.H * 0.2, g.U * 12, g.U * 12);
    ctx.globalAlpha = 1;
    return { c, ctx };
  }

  function ridge(ctx, g, base, amp, seed, fill, snowCap) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    const tops = [];
    for (let x = 0; x <= g.W + 3; x += 3) {
      const y = base - fbm(x / (g.U * 38), seed, 4, seed * 5) * amp;
      tops.push(x, y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    if (snowCap) {
      ctx.strokeStyle = '#e9e7dc';
      ctx.lineWidth = g.U * 0.7;
      ctx.beginPath();
      for (let i = 0; i < tops.length; i += 2) {
        if (i === 0) ctx.moveTo(tops[i], tops[i + 1] + g.U * 0.4);
        else ctx.lineTo(tops[i], tops[i + 1] + g.U * 0.4);
      }
      ctx.stroke();
    }
    return (x) => base - fbm(x / (g.U * 38), seed, 4, seed * 5) * amp;
  }

  function sugi(ctx, x, y, h, ink, snow) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 4; i++) {
      const f = i / 4;
      const w = h * (0.1 + f * 0.17);
      poly(ctx, [x, y - h * (1 - f * 0.78), x - w, y - h * (0.78 - f * 0.78) + 0, x + w, y - h * (0.78 - f * 0.78) + 0]);
    }
    ctx.fillRect(x - h * 0.02, y - h * 0.1, h * 0.04, h * 0.1);
    ctx.fillStyle = snow;
    for (let i = 0; i < 4; i++) {
      const f = i / 4;
      poly(ctx, [x, y - h * (1 - f * 0.78), x - h * 0.05, y - h * (0.93 - f * 0.78), x + h * 0.05, y - h * (0.93 - f * 0.78)]);
    }
  }

  function pagoda(ctx, g, x, y, h) {
    const tiers = 5;
    const th = h / (tiers + 1.2);
    const w0 = h * 0.5;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const w = w0 * (1 - f * 0.45);
      const by = y - i * th;
      ctx.fillStyle = '#8b9695';
      ctx.fillRect(x - w * 0.34, by - th * 0.95, w * 0.68, th * 0.75);
      ctx.fillStyle = '#5c6968';
      poly(ctx, [x - w * 0.62, by - th * 0.2, x - w * 0.36, by - th * 1.05, x + w * 0.36, by - th * 1.05, x + w * 0.62, by - th * 0.2]);
      ctx.fillStyle = '#d9d8cc';
      ctx.fillRect(x - w * 0.5, by - th * 1.07, w, Math.max(0.6, th * 0.1));
    }
    const top = y - tiers * th;
    ctx.fillStyle = '#5c6968';
    ctx.fillRect(x - h * 0.012, top - h * 0.2, h * 0.024, h * 0.2);
    ctx.fillStyle = '#b07a52';
    blob(ctx, x, top - h * 0.14, h * 0.035, h * 0.012);
  }

  function paintBack(g, rand) {
    const base = paintSky(g, rand);
    const ctx = base.ctx;
    ridge(ctx, g, g.H * 0.4, g.H * 0.2, 2, '#b6bab3', true);
    const near = ridge(ctx, g, g.H * 0.5, g.H * 0.12, 5, '#9ca59f', true);
    const px = g.W * 0.22;
    ctx.globalAlpha = 0.9;
    pagoda(ctx, g, px, near(px) + g.U * 1.2, g.H * 0.2);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      if (Math.abs(x - px) < g.U * 6) continue;
      sugi(ctx, x, near(x) + g.U * 2, g.U * (7 + rand() * 6), '#6f7d77', '#dcdbd0');
    }
    ridge(ctx, g, g.H * 0.64, g.H * 0.1, 9, '#c9cbc1', false);
    farTrees(ctx, g, rand);
    return base.c;
  }

  // ---- beeches ---------------------------------------------------------------

  function trunk(ctx, x, base, top, w0, w1, lean, ink) {
    ctx.fillStyle = ink;
    poly(ctx, [x - w0 / 2, base, x + lean - w1 / 2, top, x + lean + w1 / 2, top, x + w0 / 2, base]);
  }

  function limb(ctx, x0, y0, x1, y1, w, ink, snow) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * 0.15, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
    if (snow) {
      ctx.strokeStyle = snow;
      ctx.lineWidth = Math.max(0.6, w * 0.4);
      ctx.beginPath();
      ctx.moveTo(x0, y0 - w * 0.4);
      ctx.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * 0.15, (y0 + y1) / 2 - w * 0.4, x1, y1 - w * 0.4);
      ctx.stroke();
    }
  }

  function copper(ctx, x, y, r, rand, n) {
    ctx.fillStyle = '#a77d45';
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 0.55 + rand() * 0.35;
      blob(ctx, x + (rand() - 0.5) * r * 2, y + (rand() - 0.5) * r, r * 0.22, r * 0.12);
    }
    ctx.globalAlpha = 1;
  }

  function beech(ctx, g, rand, x, base, top, w, ink, spot, snow, leafy) {
    const lean = (rand() - 0.5) * g.U * 2;
    trunk(ctx, x, base, top, w, w * 0.6, lean, ink);
    ctx.fillStyle = spot;
    for (let i = 0; i < w * 2; i++) {
      const f = rand();
      const y = base + (top - base) * f;
      ctx.fillRect(x + lean * f - w * 0.4 * rand(), y, w * (0.2 + rand() * 0.4), Math.max(0.6, w * 0.15));
    }
    ctx.fillStyle = snow;
    ctx.fillRect(x - w * 0.5, base - w * 0.2, w, w * 0.3);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const f = 0.25 + rand() * 0.6;
      const y = base + (top - base) * f;
      const dir = rand() < 0.5 ? -1 : 1;
      const len = (top - base) * -0.2 * (0.6 + rand() * 0.6);
      const ex = x + lean * f + dir * len * 0.8;
      const ey = y - len * 0.7;
      limb(ctx, x + lean * f, y, ex, ey, w * 0.35, ink, snow);
      if (leafy) copper(ctx, ex, ey, w * 3, rand, 6);
    }
  }

  function farTrees(ctx, g, rand) {
    for (let i = 0; i < 16; i++) {
      const x = g.W * (i / 16 + rand() * 0.04);
      beech(ctx, g, rand, x, g.H * (0.56 + rand() * 0.03), g.H * (0.16 + rand() * 0.1), g.U * 0.9, '#b3b4aa', '#9da097', '#e8e6dc', false);
    }
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cdcec3';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.7);
    for (let x = 0; x <= g.W + 4; x += 4) ctx.lineTo(x, g.H * 0.66 + fbm(x / (g.U * 30), 3, 3, 31) * g.H * 0.05);
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      const x = g.W * (i / 9 + 0.03 + rand() * 0.07);
      beech(ctx, g, rand, x, g.H * (0.68 + rand() * 0.02), g.H * (0.02 + rand() * 0.1), g.U * (1.8 + rand() * 0.8), '#8f9189', '#6f716b', '#f0eee4', true);
    }
    return c;
  }

  // ---- ledge ---------------------------------------------------------------

  // The crag top: flat where the serow stands, broken and stepping down either side.
  function crestPoints(g, rand) {
    const xL = g.W * 0.27;
    const xR = g.W * 0.88;
    const foot0 = g.sx - g.s * 12;
    const foot1 = g.sx + g.s * 15;
    const pts = [];
    for (let x = xL; x <= xR; x += g.U * (1.6 + rand() * 1.8)) {
      let y = g.gy + (fbm(x / (g.U * 6), 4, 3, 41) - 0.5) * g.U * 1.6 + (rand() - 0.5) * g.U * 0.8;
      if (x < foot0) y += ((foot0 - x) / (foot0 - xL)) ** 1.3 * g.U * 13 + (rand() < 0.3 ? g.U * 1.2 : 0);
      else if (x > foot1) y += ((x - foot1) / (xR - foot1)) ** 1.2 * g.U * 15 + (rand() < 0.3 ? g.U * 1.2 : 0);
      else y = g.gy + g.U * 0.6 + (rand() - 0.5) * g.U * 0.5;
      pts.push(x, y);
    }
    return pts;
  }

  function crag(ctx, g, rand, top) {
    const n = top.length;
    ctx.beginPath();
    const yb = g.H * 0.95;
    ctx.moveTo(top[0] + g.U * 1.5, yb);
    ctx.lineTo(top[0] - g.U * 1.5, top[1] + g.U * 6);
    ctx.lineTo(top[0] - g.U * 0.4, top[1] + g.U * 2.5);
    for (let i = 0; i < n; i += 2) ctx.lineTo(top[i], top[i + 1]);
    ctx.lineTo(top[n - 2] + g.U * 1.5, top[n - 1] + g.U * 5);
    ctx.lineTo(top[n - 2] + g.U * 0.6, top[n - 1] + g.U * 10);
    ctx.lineTo(top[n - 2] - g.U * 1.5, yb);
    ctx.closePath();
  }

  function facets(ctx, g, rand, top) {
    // lit planes hang off the crest, shadowed planes under them, then cracks
    for (let i = 0; i < top.length - 2; i += 2) {
      const x = top[i];
      const y = top[i + 1];
      const x2 = top[i + 2];
      const y2 = top[i + 3];
      const d = g.U * (2.5 + rand() * 4);
      ctx.fillStyle = rand() < 0.55 ? '#7a7b72' : '#66675f';
      poly(ctx, [x, y, x2, y2, x2 - g.U * (0.5 + rand()), y2 + d, x + g.U * rand(), y + d * (0.6 + rand() * 0.4)]);
      ctx.fillStyle = '#34352f';
      const yb = y + d * 0.9;
      poly(ctx, [x + g.U * 0.3, yb, x2 - g.U * 0.4, yb + g.U * 0.4, x2 - g.U * 0.2, yb + g.U * (3 + rand() * 4), x + g.U * rand() * 1.5, yb + g.U * (2 + rand() * 3)]);
    }
    ctx.strokeStyle = '#262722';
    ctx.lineWidth = Math.max(0.7, g.U * 0.3);
    for (let i = 0; i < top.length; i += 6) {
      const x = top[i] + g.U * rand();
      const y = top[i + 1] + g.U * (1 + rand() * 2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 2, y + g.U * (3 + rand() * 3));
      ctx.lineTo(x + (rand() - 0.5) * g.U * 3, y + g.U * (7 + rand() * 5));
      ctx.stroke();
    }
  }

  function snowCap(ctx, g, rand, top) {
    ctx.fillStyle = '#eeede3';
    ctx.beginPath();
    ctx.moveTo(top[0], top[1] + g.U * 0.6);
    for (let i = 0; i < top.length; i += 2) ctx.lineTo(top[i], top[i + 1] - g.U * (0.4 + rand() * 0.5));
    for (let i = top.length - 2; i >= 0; i -= 2) ctx.lineTo(top[i], top[i + 1] + g.U * (0.5 + rand() * 1.3));
    ctx.fill();
    // snow caught in the ledges below the crest
    for (let i = 0; i < top.length; i += 6) {
      if (rand() < 0.35) continue;
      const x = top[i] + g.U * rand() * 3;
      const y = top[i + 1] + g.U * (3 + rand() * 9);
      const w = g.U * (0.8 + rand() * 2.2);
      poly(ctx, [x - w, y, x + w, y - g.U * (0.2 + rand() * 0.6), x + w * 0.6, y + g.U * 0.4, x - w * 0.7, y + g.U * 0.3]);
    }
  }

  // snow banked against the foot of the crag, so it sits in the slope
  function drift(ctx, g, rand) {
    ctx.fillStyle = '#d8d6ca';
    ctx.beginPath();
    ctx.moveTo(g.W * 0.18, g.H);
    for (let x = g.W * 0.18; x <= g.W * 0.97; x += 4) {
      const f = (x - g.W * 0.18) / (g.W * 0.79);
      ctx.lineTo(x, g.H * (0.93 - Math.sin(f * Math.PI) * 0.03) + fbm(x / (g.U * 5), 5, 3, 19) * g.U * 2.4);
    }
    ctx.lineTo(g.W * 0.97, g.H);
    ctx.fill();
    ctx.fillStyle = '#bdbfb7';
    for (let i = 0; i < 7; i++) blob(ctx, g.W * (0.25 + rand() * 0.65), g.H * (0.955 + rand() * 0.03), g.U * (2 + rand() * 3), g.U * 0.3);
  }

  function paintLedge(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    // snow bank sloping in from the left
    ctx.fillStyle = '#d6d4c8';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    ctx.lineTo(0, g.gy + g.U * 2);
    for (let x = 0; x <= g.W * 0.34; x += 4) ctx.lineTo(x, g.gy + g.U * (2 + (x / (g.W * 0.34)) * 7) + fbm(x / (g.U * 8), 6, 2, 3) * g.U);
    ctx.lineTo(g.W * 0.34, g.H);
    ctx.fill();
    const top = crestPoints(g, rand);
    ctx.fillStyle = '#4b4c46';
    crag(ctx, g, rand, top);
    ctx.fill();
    ctx.save();
    crag(ctx, g, rand, top);
    ctx.clip();
    facets(ctx, g, rand, top);
    ctx.restore();
    snowCap(ctx, g, rand, top);
    drift(ctx, g, rand);
    // a boulder at the crag's foot
    ctx.fillStyle = '#585952';
    poly(ctx, [g.W * 0.3, g.H * 0.93, g.W * 0.31, g.H * 0.87, g.W * 0.335, g.H * 0.855, g.W * 0.36, g.H * 0.88, g.W * 0.365, g.H * 0.93]);
    ctx.fillStyle = '#eeede3';
    blob(ctx, g.W * 0.333, g.H * 0.86, g.W * 0.02, g.U * 0.6);
    nanten(ctx, g, rand, g.W * 0.31, top[1] - g.U * 0.2);
    return c;
  }

  function nanten(ctx, g, rand, x, y) {
    const u = g.U;
    ctx.strokeStyle = '#4a3a2c';
    ctx.lineWidth = Math.max(0.8, u * 0.3);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * u * 0.5, y);
      ctx.lineTo(x + (i - 1.5) * u * 1.2, y - u * (6 + i));
      ctx.stroke();
    }
    ctx.fillStyle = '#3f5a40';
    for (let i = 0; i < 12; i++) {
      const lx = x + (rand() - 0.5) * u * 7;
      const ly = y - u * (3 + rand() * 7);
      poly(ctx, [lx, ly, lx + u * 1.6, ly - u * 0.4, lx + u * 0.4, ly + u * 0.9]);
    }
    ctx.fillStyle = '#e9e8de';
    for (let i = 0; i < 4; i++) blob(ctx, x + (rand() - 0.5) * u * 6, y - u * (3 + rand() * 6), u * 1.1, u * 0.3);
    ctx.fillStyle = '#c4432c';
    for (let i = 0; i < 9; i++) {
      blob(ctx, x + (rand() - 0.5) * u * 3 - u * 0.5, y - u * (8 + rand() * 3.5), u * 0.6, u * 0.6);
    }
    ctx.fillStyle = '#e9e8de';
    ctx.fillRect(x - u * 3, y - u * 0.4, u * 6, u * 0.9);
  }

  // ---- serow ---------------------------------------------------------------
  // Units: s per unit, ground at y = 0, the serow faces left and turns its
  // head to look out at the viewer, the way they do.

  const FUR = '#4a443d';
  const FUR_DK = '#2e2b27';
  const FUR_HI = '#6e655a';
  const PALE = '#d9d2bf';
  const HOOF = '#1c1a17';
  const HEAD_PIVOT = [-11, -24];
  const BODY_BOX = { w: 38, h: 40, ox: 20, oy: 38 };
  const HEAD_BOX = { w: 26, h: 24, ox: 13, oy: 14 };

  function bodyPath() {
    const p = new Path2D();
    p.moveTo(-9.5, -12.5);
    p.bezierCurveTo(-11.5, -16, -12.5, -19.5, -12.6, -23);
    p.lineTo(-9.5, -27.2);
    p.bezierCurveTo(-7, -28.6, -4, -28, -1.6, -26.2);
    p.bezierCurveTo(2, -24.2, 6.5, -22.6, 10, -22);
    p.bezierCurveTo(13.6, -21.4, 15.4, -18.4, 14.8, -15);
    p.bezierCurveTo(14.6, -12, 13.6, -9.8, 12, -9.4);
    p.lineTo(8, -9.8);
    p.bezierCurveTo(4, -8.2, -2, -8, -5.4, -8.6);
    p.bezierCurveTo(-7.8, -9, -9.2, -10.4, -9.5, -12.5);
    p.closePath();
    return p;
  }

  // a short tapering leg: wide at the body, a knee or hock, thin pastern, hoof
  function leg(ctx, x, top, w0, w1, bend, fur) {
    const kneeY = top + (-1.5 - top) * 0.55;
    ctx.fillStyle = fur;
    poly(ctx, [
      x - w0 / 2, top, x + w0 / 2, top,
      x + w1 * 0.75 + bend, kneeY,
      x + w1 / 2, -1.3,
      x - w1 / 2, -1.3,
      x - w1 * 0.75 + bend * 0.6, kneeY,
    ]);
    ctx.fillStyle = HOOF;
    poly(ctx, [x - w1 / 2, -1.4, x + w1 / 2, -1.4, x + w1 / 2 + 0.3, 0, x - w1 / 2 - 0.5, 0]);
  }

  function shadeBody(ctx, body) {
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = FUR_DK;
    blob(ctx, 2, -8, 16, 4.2);
    blob(ctx, 13.5, -13, 3.5, 6);
    ctx.fillStyle = FUR_HI;
    ctx.globalAlpha = 0.7;
    blob(ctx, -5, -24, 6, 3.2);
    blob(ctx, 4, -20, 7, 2.6);
    blob(ctx, 11.5, -18, 2.6, 2.6);
    ctx.globalAlpha = 1;
    // mane: long hair falling over the neck and shoulders
    ctx.strokeStyle = '#7b7165';
    ctx.lineWidth = 0.45;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const x = -10 + i * 0.95;
      const y = -27.4 + Math.abs(i - 5) * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 1.4, y + 2.4, x + 1.1, y + 4.2 + (i % 3) * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintBody(g) {
    const s = g.s;
    const B = BODY_BOX;
    const c = layer(B.w * s, B.h * s);
    const ctx = c.getContext('2d');
    ctx.translate(B.ox * s, B.oy * s);
    ctx.scale(s, s);
    // far legs, in shadow
    leg(ctx, -4.6, -11, 3.8, 1.9, -0.2, FUR_DK);
    leg(ctx, 9.4, -12, 4.2, 1.9, 0.9, FUR_DK);
    const body = bodyPath();
    ctx.fillStyle = FUR;
    ctx.fill(body);
    shadeBody(ctx, body);
    // pale bib down the throat to the chest
    ctx.fillStyle = PALE;
    poly(ctx, [-12.4, -23, -10.6, -22.4, -10, -18.5, -10.4, -15.5, -11.3, -17.2, -12.2, -19.8]);
    // near legs: thick forearm, hind leg with a thigh and hock
    leg(ctx, -8, -12, 4.6, 2.1, -0.3, FUR);
    ctx.fillStyle = FUR;
    blob(ctx, 12, -13, 3.4, 4.4);
    leg(ctx, 12, -11, 4.4, 2, 1.1, FUR);
    // snow dusting along the back
    ctx.strokeStyle = '#efeee5';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(-7.5, -28.2);
    ctx.bezierCurveTo(-4, -28.3, -1.5, -26.6, 2, -24.6);
    ctx.bezierCurveTo(5, -23.2, 8, -22.6, 11, -22.2);
    ctx.stroke();
    return c;
  }

  // head painted relative to the neck pivot, facing the viewer
  function paintHead(g) {
    const s = g.s;
    const B = HEAD_BOX;
    const c = layer(B.w * s, B.h * s);
    const ctx = c.getContext('2d');
    ctx.translate(B.ox * s, B.oy * s);
    ctx.scale(s, s);
    // far ear (the near one flicks and is drawn per frame)
    ctx.fillStyle = FUR;
    poly(ctx, [0.2, -6.8, 4.8, -9.2, 4.6, -7.1, 0.4, -4.9]);
    ctx.fillStyle = '#8c8272';
    poly(ctx, [1, -6.5, 4, -8.3, 3.9, -7.2, 1, -5.6]);
    // horns: short, ringed, sweeping back
    ctx.strokeStyle = '#1b1915';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-4.4, -7.6);
    ctx.quadraticCurveTo(-4.9, -10.4, -3.6, -12);
    ctx.moveTo(-1.6, -7.6);
    ctx.quadraticCurveTo(-1.3, -10.4, 0.2, -11.6);
    ctx.stroke();
    // skull and face
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.moveTo(-6.8, -5.4);
    ctx.bezierCurveTo(-6.4, -8.4, 0.4, -8.4, 0.8, -5.4);
    ctx.bezierCurveTo(1.2, -2.2, 0.2, 2, -1.2, 4.6);
    ctx.bezierCurveTo(-2, 5.6, -4, 5.6, -4.8, 4.6);
    ctx.bezierCurveTo(-6.2, 2, -7.2, -2.2, -6.8, -5.4);
    ctx.fill();
    ctx.fillStyle = FUR_HI;
    blob(ctx, -3, -5.6, 2.6, 1.6);
    // pale cheeks, lips and chin
    ctx.fillStyle = PALE;
    poly(ctx, [-6.6, -1.2, -5, 0.4, -4.4, 3.6, -5, 4.4, -6.2, 1.8]);
    poly(ctx, [0.6, -1.2, -1, 0.4, -1.6, 3.6, -1, 4.4, 0.2, 1.8]);
    blob(ctx, -3, 4.6, 1.9, 1.1);
    ctx.fillStyle = '#7d7365';
    blob(ctx, -3, 2.6, 1.5, 1.6);
    ctx.fillStyle = HOOF;
    blob(ctx, -3, 3.2, 1.1, 0.6);
    // eyes and the dark gland below each
    ctx.fillStyle = '#14120e';
    blob(ctx, -5.1, -3, 0.7, 0.6);
    blob(ctx, -0.9, -3, 0.7, 0.6);
    ctx.fillStyle = '#26231f';
    blob(ctx, -5.3, -1.6, 0.5, 0.8);
    blob(ctx, -0.7, -1.6, 0.5, 0.8);
    ctx.fillStyle = '#efeee5';
    blob(ctx, -3, -7.3, 2.2, 0.5);
    return c;
  }

  function drawEar(ctx, flick) {
    ctx.save();
    ctx.translate(-6.4, -6);
    ctx.rotate(flick * 0.45);
    ctx.fillStyle = FUR;
    poly(ctx, [0, -0.8, -5, -3.2, -4.8, -1.1, -0.2, 1.1]);
    ctx.fillStyle = '#8c8272';
    poly(ctx, [-0.8, -0.5, -4.1, -2.3, -4, -1.2, -0.8, 0.4]);
    ctx.restore();
  }

  // ---- mist, flakes, front ---------------------------------------------------

  function paintMist(g, band, rand) {
    const h = Math.ceil(g.H * band.h);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const n = Math.ceil(g.W / (g.U * 5));
    for (let i = 0; i < n; i++) {
      const x = rand() * g.W;
      const y = h * (0.3 + rand() * 0.4);
      const rx = g.U * (6 + rand() * 12);
      const ry = h * (0.12 + rand() * 0.2);
      ctx.fillStyle = rand() < 0.3 ? '#efe9d6' : '#e3e3da';
      ctx.globalAlpha = 0.22 + rand() * 0.2;
      for (const o of [-g.W, 0, g.W]) blob(ctx, x + o, y, rx, ry);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ink = '#4f524d';
    const spot = '#363934';
    const snow = '#f0eee4';
    beech(ctx, g, rand, g.W * 0.05, g.H * 1.02, g.H * -0.1, g.U * 6, ink, spot, snow, true);
    beech(ctx, g, rand, g.W * 0.97, g.H * 1.02, g.H * -0.1, g.U * 5, ink, spot, snow, true);
    limb(ctx, g.W * 0.03, g.H * 0.3, g.W * 0.3, g.H * 0.06, g.U * 1.6, ink, snow);
    limb(ctx, g.W * 0.18, g.H * 0.17, g.W * 0.34, g.H * 0.17, g.U * 0.8, ink, snow);
    copper(ctx, g.W * 0.3, g.H * 0.07, g.U * 5, rand, 14);
    copper(ctx, g.W * 0.34, g.H * 0.17, g.U * 4, rand, 8);
    limb(ctx, g.W * 0.99, g.H * 0.22, g.W * 0.78, g.H * 0.05, g.U * 1.3, ink, snow);
    copper(ctx, g.W * 0.8, g.H * 0.07, g.U * 4, rand, 10);
    return c;
  }

  function makeFlakes(g, rand) {
    const f = { x: new Float32Array(FLAKES), y: new Float32Array(FLAKES), v: new Float32Array(FLAKES), p: new Float32Array(FLAKES), z: new Float32Array(FLAKES) };
    for (let i = 0; i < FLAKES; i++) {
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.H;
      f.v[i] = 0.7 + rand() * 0.9;
      f.p[i] = rand() * TAU;
      f.z[i] = rand() < 0.25 ? 1.7 : 1;
    }
    return f;
  }

  function drawFlakes(ctx, g, t, dt, count) {
    const f = state.flakes;
    ctx.fillStyle = '#fbfaf2';
    for (let i = 0; i < count; i++) {
      f.y[i] += f.v[i] * g.U * 2.4 * dt;
      f.x[i] += (Math.sin(t * 0.6 + f.p[i]) * 0.8 - 0.6) * g.U * 0.9 * dt;
      if (f.y[i] > g.H + 2) f.y[i] = -2;
      if (f.x[i] < -2) f.x[i] = g.W + 2;
      ctx.globalAlpha = f.z[i] > 1 ? 0.95 : 0.75;
      ctx.fillRect(f.x[i], f.y[i], f.z[i], f.z[i]);
    }
    ctx.globalAlpha = 1;
  }

  function drawBand(ctx, g, i, t, amount) {
    const b = BANDS[i];
    const w = g.W;
    const ox = -((t * b.v * g.U * 0.5) % w);
    const y = g.H * b.y + Math.sin(t * 0.15 + i) * g.U * 0.6;
    ctx.globalAlpha = Math.min(1, b.a * amount);
    ctx.drawImage(state.bands[i], ox, y);
    ctx.drawImage(state.bands[i], ox + w, y);
    ctx.globalAlpha = 1;
  }

  function drawSerow(ctx, g, t, breath) {
    const s = g.s;
    const bx = g.sx;
    const by = g.gy + g.U * 0.5;
    const rise = Math.sin(t * 1.1) * 0.15 * breath;
    ctx.drawImage(state.body, bx - BODY_BOX.ox * s, by - BODY_BOX.oy * s + rise * s * 0.3);
    const pivx = bx + HEAD_PIVOT[0] * s;
    const pivy = by + HEAD_PIVOT[1] * s + rise * s * 0.5;
    const sway = Math.sin(t * 0.35) * 0.06 + Math.sin(t * 0.9) * 0.015;
    ctx.save();
    ctx.translate(pivx, pivy);
    ctx.rotate(sway);
    ctx.drawImage(state.head, -HEAD_BOX.ox * s, -HEAD_BOX.oy * s);
    const phase = (t % 7) / 7;
    const flick = phase < 0.06 ? Math.sin((phase / 0.06) * TAU) : 0;
    ctx.scale(s, s);
    drawEar(ctx, flick);
    ctx.restore();
    // breath from the muzzle at (-3, 5) in head units
    const cs = Math.cos(sway);
    const sn = Math.sin(sway);
    const nx = pivx + (-3 * cs - 5 * sn) * s;
    const ny = pivy + (-3 * sn + 5 * cs) * s;
    const on = Math.sin(t * 0.45) > -0.1 ? 1 : 0.4;
    ctx.fillStyle = '#f2f0e6';
    for (let i = 0; i < PUFFS; i++) {
      const ph = (t * 0.22 + i / PUFFS) % 1;
      ctx.globalAlpha = 0.5 * (1 - ph) * Math.min(1, breath) * on;
      blob(ctx, nx - ph * g.U * 5, ny - ph * g.U * 2.5, g.U * (0.5 + ph * 1.6), g.U * (0.4 + ph));
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.mid = paintMid(g, rand);
    state.ledge = paintLedge(g, rand);
    state.front = paintFront(g, rand);
    state.body = paintBody(g);
    state.head = paintHead(g);
    state.bands = BANDS.map((b) => paintMist(g, b, K.rng(b.seed * 31 + api.seed)));
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, mist, breath } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawBand(ctx, g, 0, t, mist);
    ctx.drawImage(state.mid, 0, 0);
    drawBand(ctx, g, 1, t, mist);
    ctx.drawImage(state.ledge, 0, 0);
    drawSerow(ctx, g, t, breath);
    drawBand(ctx, g, 2, t, mist);
    ctx.drawImage(state.front, 0, 0);
    drawFlakes(ctx, g, t, Math.min(dt, 0.1), Math.min(FLAKES, Math.round(60 * snow)));
  }

  Kasuri.run({
    defaults: { snow: 1, mist: 1, breath: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
