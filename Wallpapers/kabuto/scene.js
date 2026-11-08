/*
 * 兜虫 Kabuto — a rhinoceros beetle climbing an oak at night in midsummer.
 *
 * The bark, the woods, the lantern and both beetle bodies are baked once.
 * Each frame solves six two-joint legs and strokes them under the body sprite,
 * then adds a handful of moths, the lantern's breath and a gleam on the sap.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { noise2, fbm, lerp, smoothstep, clamp } = K;

  const TAU = Math.PI * 2;
  const BARK = ['#272b37', '#30333c', '#3b3c42', '#48484b', '#585752', '#6a675b', '#7f7965', '#988e72', '#b3a37e'];
  const MOSS = ['#4b5439', '#69714b'];
  const NIGHT = ['#1d2540', '#222b47', '#27314e', '#2c3755', '#313d5c'];
  const LEAF = ['#1f2c23', '#283a2a', '#33472f'];
  const LIT_LEAF = ['#4f5631', '#6b6a39'];
  const MOTH_TONES = ['#efe6c8', '#e0d5b4', '#cfc3a0'];
  const SHADE = '#0b0912';
  const MAX_MOTHS = 14;
  const STRIDE = 3.4;
  const GAIT = STRIDE / 0.6;
  const TRAVEL = 15;
  const ADV = 32;
  const HOLD = 9;
  const RET = 22;
  const REST = 7;
  const CYCLE = ADV + HOLD + RET + REST;
  // Right-hand legs of the rhinoceros beetle in body units (U), forward is -y.
  const LEGS = [
    { hip: [4.5, -19], foot: [16, -33], femur: 10, tibia: 12.5, bend: 1, tarsus: [1.6, -5.5], teeth: true },
    { hip: [5.5, -12], foot: [21, -8], femur: 9.5, tibia: 11, bend: -1, tarsus: [4.6, 0.8] },
    { hip: [5, -5], foot: [18, 15], femur: 11, tibia: 15.5, bend: -1, tarsus: [2.4, 5.2] },
  ];
  const STAG_LEGS = [
    [[4.5, -9], [10, -13], [12.5, -20], [13.4, -23.5]],
    [[5, -3.5], [12, -3], [15.5, 2.5], [17.4, 4.6]],
    [[4.5, 1.5], [10.5, 6], [12.5, 13.5], [13.4, 16.8]],
  ];
  const SIDES = [-1, 1];
  const CLAW_TURNS = [-0.7, 0.7];
  const TEETH = [0.45, 0.68, 0.9];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- the oak ------------------------------------------------------------

  function trunkHalf(g, sy) {
    return state.hw * (1 + 0.05 * (noise2(sy * 0.05, 0.5, 3) - 0.5) + 0.06 * Math.pow(sy / 100, 3));
  }

  function trunkMid(g, sy) {
    return state.cx + g.U * 3 * (noise2(sy * 0.03, 1.5, 4) - 0.5);
  }

  function barkHeight(su, sy) {
    const warp = (noise2(sy * 0.03, su * 0.05, 5) - 0.5) * 4;
    const r = noise2((su + warp) * 0.2, sy * 0.011, 7);
    const furrow = smoothstep(0.02, 0.34, Math.abs(r * 2 - 1));
    const crack = smoothstep(0.68, 0.76, noise2(su * 0.25, sy * 0.1, 11)) * 0.6;
    const grain = noise2(su * 0.8, sy * 0.3, 13) * 0.2;
    return clamp(furrow - crack + grain - 0.08, 0, 1);
  }

  function barkTone(g, nx, sy, x, y, bark, moss) {
    const z = Math.sqrt(1 - nx * nx);
    const su = Math.asin(nx) * state.hwU;
    const h = barkHeight(su, sy);
    const slope = h - barkHeight(su + 0.9, sy);
    let light = 0.2 + 0.6 * Math.max(0, 0.85 * z - 0.4 * nx);
    light = light * (0.42 + 0.58 * h) + slope * 0.9;
    const lampD = Math.hypot(x - state.lamp.x, y - state.lamp.y) / g.U;
    light += 0.3 * Math.exp(-lampD / 34);
    if (h > 0.5 && nx > -0.4 && fbm(su * 0.07, sy * 0.05, 3, 21) > 0.62) return moss[light > 0.42 ? 1 : 0];
    return bark[Math.round(clamp(light, 0, 1) * (bark.length - 1))];
  }

  function paintBark(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const bark = BARK.map(K.parseColor);
    const moss = MOSS.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < c.height; y++) {
      const sy = y / g.U;
      const half = trunkHalf(g, sy);
      const mid = trunkMid(g, sy);
      for (let x = 0; x < c.width; x++) {
        const nx = (x + 0.5 - mid) / half;
        if (nx <= -0.999 || nx >= 0.999) continue;
        const rgb = barkTone(g, nx, sy, x, y, bark, moss);
        const i = (y * c.width + x) * 4;
        d[i] = rgb[0];
        d[i + 1] = rgb[1];
        d[i + 2] = rgb[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- the woods behind ---------------------------------------------------

  function paintLeafMass(ctx, g, rand, cx, cy, radius, count) {
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const r = Math.sqrt(rand()) * radius;
      const x = cx + Math.cos(a) * r * 1.3;
      const y = cy + Math.sin(a) * r * 0.8;
      const near = Math.hypot(x - state.lamp.x, y - state.lamp.y) / g.U;
      const lit = near < 14 + rand() * 8;
      ctx.fillStyle = lit ? LIT_LEAF[Math.floor(rand() * 2)] : LEAF[Math.floor(rand() * LEAF.length)];
      ctx.beginPath();
      ctx.ellipse(x, y, g.U * (1 + rand() * 1.6), g.U * (0.6 + rand() * 0.7), rand() * TAU, 0, TAU);
      ctx.fill();
    }
  }

  function paintFarTrunks(ctx, g, rand) {
    const left = state.cx - state.hw;
    const right = state.cx + state.hw;
    const spots = [left * 0.22, left * 0.72, right + (g.W - right) * 0.4, right + (g.W - right) * 0.85];
    spots.forEach((x, i) => {
      const w = g.U * (3 + rand() * 4);
      ctx.fillStyle = i % 2 ? '#242d49' : '#2a3452';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.8, 0);
      ctx.lineTo(x + w * 0.8, 0);
      ctx.lineTo(x + w, g.H);
      ctx.lineTo(x - w, g.H);
      ctx.fill();
    });
  }

  function paintNight(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 10; i++) {
      const band = i < 5 ? i : 9 - i;
      ctx.fillStyle = NIGHT[Math.min(NIGHT.length - 1, band + 1)];
      ctx.fillRect(0, (g.H * i) / 10, g.W, g.H / 10 + 1);
    }
    paintFarTrunks(ctx, g, rand);
    const right = state.cx + state.hw;
    paintLeafMass(ctx, g, rand, g.W * 0.02, g.U * 6, g.U * 16, 260);
    paintLeafMass(ctx, g, rand, state.lamp.x + g.U * 4, g.U * 2, g.U * 12, 160);
    paintLeafMass(ctx, g, rand, g.W, g.U * 10, Math.max(g.U * 14, (g.W - right) * 0.7), 260);
    paintLeafMass(ctx, g, rand, g.W, g.H * 0.62, Math.max(g.U * 10, (g.W - right) * 0.6), 160);
    return c;
  }

  // ---- lantern, branch and sap --------------------------------------------

  function branchY(g, x) {
    const a = state.branch;
    const f = clamp((x - a.x0) / (a.x1 - a.x0), 0, 1);
    return lerp(a.y0, a.y1, f) - g.U * 6 * f * (1 - f) * 2;
  }

  function paintBranch(ctx, g) {
    const a = state.branch;
    const u = g.U;
    ctx.fillStyle = '#2b2a31';
    ctx.beginPath();
    ctx.moveTo(a.x0, a.y0 - u * 2.2);
    ctx.quadraticCurveTo((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2 - u * 6 - u * 1.4, a.x1, a.y1 - u * 1);
    ctx.lineTo(a.x1, a.y1 + u * 0.8);
    ctx.quadraticCurveTo((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2 - u * 6 + u * 1.4, a.x0, a.y0 + u * 2.4);
    ctx.fill();
    ctx.strokeStyle = '#6b6152';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(a.x0, a.y0 - u * 2);
    ctx.quadraticCurveTo((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2 - u * 7.3, a.x1, a.y1 - u * 0.9);
    ctx.stroke();
  }

  function paintLantern(ctx, g) {
    const { x, y } = state.lamp;
    const u = g.U;
    ctx.strokeStyle = '#1d1b20';
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath();
    ctx.moveTo(x, branchY(g, x));
    ctx.lineTo(x, y - u * 7);
    ctx.stroke();
    ctx.fillStyle = '#e0a655';
    ctx.beginPath();
    ctx.ellipse(x, y, u * 5.6, u * 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f1c97f';
    ctx.beginPath();
    ctx.ellipse(x - u * 0.7, y, u * 3.8, u * 5.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fae3ab';
    ctx.beginPath();
    ctx.ellipse(x - u * 1.1, y - u * 0.4, u * 1.9, u * 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#a8703a';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(0.6, u * 0.3);
    for (let k = -3; k <= 3; k++) {
      const yy = y + k * u * 1.8;
      const half = u * 5.6 * Math.sqrt(1 - Math.pow((k * 1.8) / 7, 2));
      ctx.beginPath();
      ctx.moveTo(x - half, yy);
      ctx.quadraticCurveTo(x, yy + u * 0.6, x + half, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1f1a1b';
    ctx.fillRect(x - u * 3.4, y - u * 7.8, u * 6.8, u * 1.6);
    ctx.fillRect(x - u * 3.4, y + u * 6.3, u * 6.8, u * 1.6);
  }

  function makeDrip(g) {
    const n = 24;
    const pts = new Float32Array(n * 2);
    const w = state.wound;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      pts[i * 2] = w.x - g.U * (f * 2.5 - Math.sin(f * 7) * 1.1);
      pts[i * 2 + 1] = w.y + g.U * (1 + f * 27);
    }
    return pts;
  }

  function strokeDrip(ctx, pts, width, colour, dx) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(pts[i] + dx, pts[i + 1]);
      else ctx.lineTo(pts[i] + dx, pts[i + 1]);
    }
    ctx.stroke();
  }

  function paintSap(ctx, g) {
    const u = g.U;
    const w = state.wound;
    const pts = state.drip;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokeDrip(ctx, pts, u * 2.8, '#3d2414', 0);
    strokeDrip(ctx, pts, u * 1.7, '#a8682c', 0);
    strokeDrip(ctx, pts, Math.max(0.6, u * 0.5), '#e8b462', -u * 0.4);
    ctx.fillStyle = '#3a2213';
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, u * 5, u * 3.4, -0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b07030';
    ctx.beginPath();
    ctx.ellipse(w.x - u * 0.6, w.y + u * 0.6, u * 3.2, u * 2.1, -0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8c5424';
    ctx.beginPath();
    ctx.arc(pts[pts.length - 2], pts[pts.length - 1] + u * 0.8, u * 1.1, 0, TAU);
    ctx.fill();
  }

  function paintGlow(radius) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e9b464';
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.11;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, (size / 2) * (1 - i * 0.18), 0, TAU);
      ctx.fill();
    }
    return c;
  }

  // ---- the rhinoceros beetle ----------------------------------------------

  function elytraPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-9.8, -13);
    ctx.bezierCurveTo(-12.6, -8, -12.8, 4, -9.5, 10);
    ctx.bezierCurveTo(-6.5, 15.5, -2.5, 16.5, 0, 16.5);
    ctx.bezierCurveTo(2.5, 16.5, 6.5, 15.5, 9.5, 10);
    ctx.bezierCurveTo(12.8, 4, 12.6, -8, 9.8, -13);
    ctx.closePath();
  }

  function paintElytra(ctx) {
    const shell = ctx.createLinearGradient(-12, 0, 12, 0);
    shell.addColorStop(0, '#95562f');
    shell.addColorStop(0.45, '#5a301b');
    shell.addColorStop(1, '#2c1810');
    elytraPath(ctx);
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#1a0f0a';
    ctx.stroke();
    ctx.fillStyle = '#b8774a';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(-6.2, -2, 3.2, 11, -0.06, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8b880';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(-6.4, -4, 1.4, 7.5, -0.06, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(5.4, -6, 0.9, 4.5, 0.05, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#170d08';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, 16.3);
    ctx.stroke();
  }

  function paintPronotum(ctx) {
    const shine = ctx.createRadialGradient(-4, -21, 0.5, -1, -19, 12);
    shine.addColorStop(0, '#8c5634');
    shine.addColorStop(0.5, '#43261a');
    shine.addColorStop(1, '#22140d');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(-10, -12.6);
    ctx.bezierCurveTo(-11.2, -18, -9, -24, -4, -25.6);
    ctx.lineTo(4, -25.6);
    ctx.bezierCurveTo(9, -24, 11.2, -18, 10, -12.6);
    ctx.quadraticCurveTo(0, -11.4, -10, -12.6);
    ctx.fill();
    ctx.strokeStyle = '#140b07';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = '#ecbf88';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(-4.6, -20.5, 2.2, 1.3, -0.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintHead(ctx) {
    ctx.fillStyle = '#241510';
    ctx.beginPath();
    ctx.ellipse(0, -27, 4.6, 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2a1a12';
    ctx.lineWidth = 0.45;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 4, -27.5);
      ctx.lineTo(side * 6.8, -29.4);
      ctx.stroke();
      ctx.fillStyle = '#4a3020';
      ctx.beginPath();
      ctx.ellipse(side * 7.2, -29.8, 0.9, 0.6, side * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#2b1a12';
    ctx.beginPath();
    ctx.moveTo(-3.2, -27);
    ctx.lineTo(-1.9, -42);
    ctx.lineTo(1.9, -42);
    ctx.lineTo(3.2, -27);
    ctx.fill();
    ctx.strokeStyle = '#2b1a12';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -41.2);
      ctx.lineTo(side * 3.4, -45.6);
      ctx.lineTo(side * 3.8, -48.8);
      ctx.moveTo(side * 3.4, -45.6);
      ctx.lineTo(side * 5.6, -47.2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#a06a42';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-1.5, -29);
    ctx.lineTo(-1, -41.5);
    ctx.lineTo(-3, -45.4);
    ctx.stroke();
  }

  function paintThoraxHorn(ctx) {
    ctx.fillStyle = '#2a1810';
    ctx.beginPath();
    ctx.moveTo(-2.7, -21);
    ctx.lineTo(-1.9, -27.5);
    ctx.lineTo(-1.8, -30.2);
    ctx.lineTo(-0.5, -28.8);
    ctx.lineTo(0.5, -28.8);
    ctx.lineTo(1.8, -30.2);
    ctx.lineTo(1.9, -27.5);
    ctx.lineTo(2.7, -21);
    ctx.fill();
    ctx.strokeStyle = '#b07a4c';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(-2, -22);
    ctx.lineTo(-1.5, -28.6);
    ctx.stroke();
  }

  function shadowOf(sprite) {
    const c = layer(sprite.width, sprite.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(sprite, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = SHADE;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function makeRhino(g) {
    const u = g.U;
    const ox = 16 * u;
    const oy = 52 * u;
    const sprite = layer(32 * u, 72 * u);
    const ctx = sprite.getContext('2d');
    ctx.setTransform(u, 0, 0, u, ox, oy);
    paintHead(ctx);
    paintElytra(ctx);
    paintPronotum(ctx);
    paintThoraxHorn(ctx);
    const legs = [];
    for (const side of [1, -1]) LEGS.forEach((spec, i) => legs.push({ spec, side, group: (i + (side > 0 ? 0 : 1)) % 2 }));
    return { sprite, shadow: shadowOf(sprite), ox, oy, legs, pts: new Float32Array(legs.length * 8) };
  }

  // Two-joint leg: the foot slides back while planted, then lifts and reaches.
  function solveLeg(leg, o, gait, pts) {
    const s = leg.spec;
    const p = (((gait + leg.group * 0.5) % 1) + 1) % 1;
    let off;
    let lift = 0;
    if (p < 0.6) {
      off = lerp(1, -1, p / 0.6);
    } else {
      const q = (p - 0.6) / 0.4;
      off = lerp(-1, 1, q * q * (3 - 2 * q));
      lift = Math.sin(q * Math.PI);
    }
    const fx = s.foot[0] + lift * 0.9;
    const fy = s.foot[1] - off * STRIDE * 0.5;
    const dx = fx - s.hip[0];
    const dy = fy - s.hip[1];
    const dist = Math.hypot(dx, dy) || 1;
    const d = Math.min(dist, s.femur + s.tibia - 0.01);
    const ux = dx / dist;
    const uy = dy / dist;
    const along = (s.femur * s.femur - s.tibia * s.tibia + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, s.femur * s.femur - along * along)) * s.bend;
    const ex = s.hip[0] + ux * d;
    const ey = s.hip[1] + uy * d;
    const k = leg.side;
    const reach = 1 - lift * 0.25;
    pts[o] = s.hip[0] * k;
    pts[o + 1] = s.hip[1];
    pts[o + 2] = (s.hip[0] + ux * along - uy * h) * k;
    pts[o + 3] = s.hip[1] + uy * along + ux * h;
    pts[o + 4] = ex * k;
    pts[o + 5] = ey;
    pts[o + 6] = (ex + s.tarsus[0] * reach) * k;
    pts[o + 7] = ey + s.tarsus[1] * reach;
  }

  function strokeSegments(ctx, pts, from, width, colour, dx, dy) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let o = 0; o < pts.length; o += 8) {
      ctx.moveTo(pts[o + from * 2] + dx, pts[o + from * 2 + 1] + dy);
      ctx.lineTo(pts[o + from * 2 + 2] + dx, pts[o + from * 2 + 3] + dy);
    }
    ctx.stroke();
  }

  function strokeClaws(ctx, rig) {
    const pts = rig.pts;
    ctx.beginPath();
    for (let i = 0; i < rig.legs.length; i++) {
      const o = i * 8;
      const tx = pts[o + 6] - pts[o + 4];
      const ty = pts[o + 7] - pts[o + 5];
      const len = Math.hypot(tx, ty) || 1;
      const ax = tx / len;
      const ay = ty / len;
      for (const turn of CLAW_TURNS) {
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        ctx.moveTo(pts[o + 6], pts[o + 7]);
        ctx.lineTo(pts[o + 6] + (ax * c - ay * s) * 1.1, pts[o + 7] + (ax * s + ay * c) * 1.1);
      }
      if (!rig.legs[i].spec.teeth) continue;
      const side = rig.legs[i].side;
      const bx = pts[o + 4] - pts[o + 2];
      const by = pts[o + 5] - pts[o + 3];
      const bl = Math.hypot(bx, by) || 1;
      const flip = -by * side > 0 ? 1 : -1;
      for (const f of TEETH) {
        const x = pts[o + 2] + bx * f;
        const y = pts[o + 3] + by * f;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (-by / bl) * 1.3 * flip, y + (bx / bl) * 1.3 * flip);
      }
    }
    ctx.stroke();
  }

  function drawLegs(ctx, rig) {
    const p = rig.pts;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.38;
    strokeSegments(ctx, p, 0, 2.1, SHADE, 1.8, 1.4);
    strokeSegments(ctx, p, 1, 1.7, SHADE, 1.8, 1.4);
    strokeSegments(ctx, p, 2, 0.9, SHADE, 1.8, 1.4);
    ctx.globalAlpha = 1;
    strokeSegments(ctx, p, 0, 2.1, '#22160f', 0, 0);
    strokeSegments(ctx, p, 1, 1.7, '#22160f', 0, 0);
    strokeSegments(ctx, p, 2, 0.9, '#2a1b12', 0, 0);
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = '#22160f';
    strokeClaws(ctx, rig);
    strokeSegments(ctx, p, 0, 0.55, '#7d5538', -0.4, -0.3);
    strokeSegments(ctx, p, 1, 0.45, '#6e4a31', -0.35, -0.3);
  }

  function travel(clock) {
    const m = clock % CYCLE;
    if (m < ADV) return smoothstep(0, ADV, m);
    if (m < ADV + HOLD) return 1;
    if (m < ADV + HOLD + RET) return 1 - smoothstep(0, RET, m - ADV - HOLD);
    return 0;
  }

  function drawRhino(ctx, g, t, p, flicker) {
    const r = state.rhino;
    const u = g.U;
    const walked = p * TRAVEL;
    const gait = walked / GAIT;
    const sway = Math.sin(gait * TAU);
    const x = r.x + sway * 0.25 * u;
    const y = r.y0 - walked * u;
    const yaw = sway * 0.022 + Math.sin(t * 0.21) * 0.006;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (let i = 0; i < r.legs.length; i++) solveLeg(r.legs[i], i * 8, gait, r.pts);
    ctx.globalAlpha = 0.42;
    ctx.setTransform(c, s, -s, c, x + 2.2 * u, y + 1.6 * u);
    ctx.drawImage(r.shadow, -r.ox, -r.oy);
    ctx.globalAlpha = 1;
    ctx.setTransform(c * u, s * u, -s * u, c * u, x, y);
    drawLegs(ctx, r);
    ctx.setTransform(c, s, -s, c, x, y);
    ctx.drawImage(r.sprite, -r.ox, -r.oy);
    ctx.setTransform(c * u, s * u, -s * u, c * u, x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.14 + 0.12 * flicker;
    ctx.fillStyle = '#d9a46c';
    ctx.beginPath();
    ctx.ellipse(-6.5, -5 + Math.sin(t * 0.17) * 0.8, 1.2, 4.5, -0.06, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- the stag beetle ----------------------------------------------------

  function paintStagLegs(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e130c';
    const widths = [1.3, 1, 0.6];
    for (const side of [-1, 1]) {
      for (const leg of STAG_LEGS) {
        for (let k = 0; k < 3; k++) {
          ctx.lineWidth = widths[k];
          ctx.beginPath();
          ctx.moveTo(leg[k][0] * side, leg[k][1]);
          ctx.lineTo(leg[k + 1][0] * side, leg[k + 1][1]);
          ctx.stroke();
        }
      }
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(5.6 * side, -16);
      ctx.lineTo(9.2 * side, -16.8);
      ctx.lineTo(10.4 * side, -20.4);
      ctx.stroke();
      ctx.fillStyle = '#3a2618';
      ctx.beginPath();
      ctx.ellipse(10.5 * side, -21, 0.8, 0.6, 0, 0, TAU);
      ctx.fill();
    }
  }

  function paintStagBody(ctx) {
    const shell = ctx.createLinearGradient(-6, 0, 6, 0);
    shell.addColorStop(0, '#9a5e34');
    shell.addColorStop(0.45, '#55331e');
    shell.addColorStop(1, '#2c1b11');
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.moveTo(-5.8, -6);
    ctx.bezierCurveTo(-6.5, 0, -6.3, 7, -4, 10.6);
    ctx.quadraticCurveTo(0, 13.6, 4, 10.6);
    ctx.bezierCurveTo(6.3, 7, 6.5, 0, 5.8, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3e2718';
    ctx.beginPath();
    ctx.moveTo(-6.4, -6.4);
    ctx.lineTo(-6.8, -10.8);
    ctx.lineTo(-5.4, -12.4);
    ctx.lineTo(5.4, -12.4);
    ctx.lineTo(6.8, -10.8);
    ctx.lineTo(6.4, -6.4);
    ctx.fill();
    ctx.fillStyle = '#34200f';
    ctx.beginPath();
    ctx.moveTo(-5.2, -12.6);
    ctx.lineTo(-6.8, -15.4);
    ctx.lineTo(-5.6, -17.4);
    ctx.lineTo(5.6, -17.4);
    ctx.lineTo(6.8, -15.4);
    ctx.lineTo(5.2, -12.6);
    ctx.fill();
    ctx.fillStyle = '#d6a36e';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(-3.4, -1, 0.9, 5, 0, 0, TAU);
    ctx.ellipse(-3.6, -9.6, 1.4, 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#140c08';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 12);
    ctx.stroke();
  }

  function makeStag(g) {
    const u = g.U;
    const ox = 19 * u;
    const oy = 25 * u;
    const sprite = layer(38 * u, 44 * u);
    const ctx = sprite.getContext('2d');
    ctx.setTransform(u, 0, 0, u, ox, oy);
    paintStagLegs(ctx);
    paintStagBody(ctx);
    return { sprite, shadow: shadowOf(sprite), ox, oy };
  }

  function turnPoint(out, i, bx, by, c, s, x, y) {
    out[i] = bx + x * c - y * s;
    out[i + 1] = by + x * s + y * c;
  }

  function strokeMandible(ctx, side, open) {
    const bx = 3 * side;
    const by = -17;
    const c = Math.cos(open * side);
    const s = Math.sin(open * side);
    const m = state.mand;
    turnPoint(m, 0, bx, by, c, s, 3.6 * side, -6.6);
    turnPoint(m, 2, bx, by, c, s, -1.8 * side, -12);
    turnPoint(m, 4, bx, by, c, s, 2 * side, -6.6);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(m[0], m[1], m[2], m[3]);
    ctx.moveTo(m[4], m[5]);
    ctx.lineTo(m[4] - 1.3 * side * c, m[5] - 1.3 * side * s);
  }

  function drawStag(ctx, g, t, near) {
    const st = state.stag;
    const u = g.U;
    const a = st.angle + Math.sin(t * 0.13) * 0.03;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const bob = Math.sin(t * 0.9) * 0.35 * u;
    const x = st.x + s * bob;
    const y = st.y - c * bob;
    ctx.globalAlpha = 0.3;
    ctx.setTransform(c, s, -s, c, x + 1.6 * u, y + 1.2 * u);
    ctx.drawImage(st.shadow, -st.ox, -st.oy);
    ctx.globalAlpha = 1;
    ctx.setTransform(c, s, -s, c, x, y);
    ctx.drawImage(st.sprite, -st.ox, -st.oy);
    ctx.setTransform(c * u, s * u, -s * u, c * u, x, y);
    const open = 0.08 + 0.06 * Math.sin(t * 0.5) + 0.26 * smoothstep(0.7, 1, near);
    ctx.lineCap = 'round';
    for (const side of SIDES) {
      strokeMandible(ctx, side, open);
      ctx.strokeStyle = '#23160e';
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.strokeStyle = '#a8744a';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- moths, gleam and glow ----------------------------------------------

  function makeMoths(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_MOTHS; i++) {
      const wander = i % 3 === 2;
      list.push({
        wander,
        rx: g.U * (wander ? 30 + rand() * 18 : 6 + rand() * 10),
        ry: g.U * (wander ? 18 + rand() * 10 : 4 + rand() * 6),
        w: (wander ? 0.05 + rand() * 0.04 : 0.45 + rand() * 0.45) * (rand() < 0.5 ? -1 : 1),
        ph: rand() * TAU,
        ph2: rand() * TAU,
        size: g.U * (1.9 + rand() * 0.9),
        tone: MOTH_TONES[i % MOTH_TONES.length],
        flap: 9 + rand() * 6,
        x: 0,
        y: 0,
        ang: 0,
      });
    }
    return list;
  }

  function placeMoth(m, t, g) {
    const L = state.lamp;
    let x;
    let y;
    if (m.wander) {
      x = L.x + g.U * 4 + m.rx * (0.5 + 0.5 * Math.sin(t * m.w + m.ph));
      y = L.y + m.ry * Math.sin(t * m.w * 1.37 + m.ph2);
    } else {
      const a = t * m.w + m.ph;
      x = L.x + m.rx * Math.cos(a) + m.rx * 0.3 * Math.sin(a * 2.3 + m.ph2);
      y = L.y + m.ry * Math.sin(a) + m.ry * 0.3 * Math.cos(a * 1.7 + m.ph2);
    }
    x += Math.sin(t * 6.1 + m.ph) * g.U * 0.4;
    y += Math.cos(t * 5.3 + m.ph2) * g.U * 0.4;
    const vx = x - m.x;
    const vy = y - m.y;
    if (vx * vx + vy * vy > 1e-6) m.ang = Math.atan2(vy, vx) + Math.PI / 2;
    m.x = x;
    m.y = y;
  }

  function drawMoths(ctx, g, t, count) {
    for (let i = 0; i < state.moths.length; i++) {
      const m = state.moths[i];
      placeMoth(m, t, g);
      if (i >= count) continue;
      const s = m.size;
      const f = 0.3 + 0.7 * Math.abs(Math.sin(t * m.flap + m.ph));
      const c = Math.cos(m.ang);
      const n = Math.sin(m.ang);
      ctx.setTransform(c, n, -n, c, m.x, m.y);
      ctx.fillStyle = m.tone;
      ctx.beginPath();
      ctx.moveTo(0, -0.5 * s);
      ctx.lineTo(s * f, 0.1 * s);
      ctx.lineTo(0.4 * s * f, 0.8 * s);
      ctx.lineTo(0, 0.4 * s);
      ctx.lineTo(-0.4 * s * f, 0.8 * s);
      ctx.lineTo(-s * f, 0.1 * s);
      ctx.fill();
      ctx.fillStyle = '#5c5040';
      ctx.fillRect(-0.16 * s, -0.6 * s, 0.32 * s, 1.1 * s);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawGleam(ctx, g, t) {
    const pts = state.drip;
    const n = pts.length / 2;
    ctx.fillStyle = '#f2cf8a';
    for (let k = 0; k < 2; k++) {
      const f = (t / 8 + k * 0.5) % 1;
      const at = f * (n - 1);
      const i = Math.floor(at);
      const j = Math.min(n - 1, i + 1);
      const x = lerp(pts[i * 2], pts[j * 2], at - i) - g.U * 0.4;
      const y = lerp(pts[i * 2 + 1], pts[j * 2 + 1], at - i);
      ctx.globalAlpha = Math.sin(f * Math.PI) * 0.9;
      ctx.fillRect(x - g.U * 0.5, y - g.U * 0.6, g.U, g.U * 1.2);
    }
    const w = state.wound;
    ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 0.8);
    ctx.fillRect(w.x - g.U * 1.6, w.y, g.U * 1.2, g.U * 0.7);
    ctx.globalAlpha = 1;
  }

  function drawGlow(ctx, g, amount, flicker) {
    const r = g.U * 28;
    const L = state.lamp;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, amount * (0.6 + 0.12 * flicker));
    ctx.drawImage(state.glow, L.x - r, L.y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ---- foreground leaves --------------------------------------------------

  function paintOakLeaf(ctx, x, y, len, angle, fill, vein) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i <= 24; i++) {
        const k = side < 0 ? i : 24 - i;
        const f = k / 24;
        const lobes = 0.62 + 0.38 * Math.abs(Math.sin(f * Math.PI * 4.5));
        const w = len * 0.3 * Math.pow(Math.sin(f * Math.PI), 0.8) * (0.4 + 0.6 * f) * lobes;
        ctx.lineTo(f * len, side * w);
      }
    }
    ctx.fill();
    ctx.strokeStyle = vein;
    ctx.lineWidth = Math.max(1, len * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.95, 0);
    ctx.stroke();
    ctx.restore();
  }

  function paintFront(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const x0 = -u * 2;
    const y0 = g.H + u * 2;
    const x1 = Math.min(g.W * 0.16, state.cx - state.hw + u * 8);
    const y1 = g.H - u * 18;
    ctx.strokeStyle = '#2a2721';
    ctx.lineWidth = Math.max(1, u * 1.1);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x1 * 0.4, y1 + u * 8, x1, y1);
    ctx.stroke();
    const leaves = [[0.25, -2.3, 15], [0.45, 0.2, 13], [0.62, -1.4, 16], [0.8, -0.5, 12], [1, -1.0, 11]];
    leaves.forEach(([f, ang, len], i) => {
      const x = lerp(x0, x1, f);
      const y = lerp(y0, y1, f) + u * 4 * Math.sin(f * Math.PI);
      paintOakLeaf(ctx, x, y, u * len, ang, i % 2 ? '#46603b' : '#527046', '#7d9260');
    });
    ctx.fillStyle = '#6f7a42';
    ctx.beginPath();
    ctx.ellipse(lerp(x0, x1, 0.55), lerp(y0, y1, 0.55) + u * 1.5, u * 1.3, u * 1.6, 0.3, 0, TAU);
    ctx.fill();
    return c;
  }

  // ---- setup and frame ----------------------------------------------------

  function place(g) {
    state.cx = g.W * 0.52;
    state.hw = Math.min(g.W * 0.35, g.U * 64);
    state.hwU = state.hw / g.U;
    const left = state.cx - state.hw;
    state.lamp = { x: Math.max(g.U * 8, left - g.U * 11), y: g.U * 34 };
    state.branch = { x0: left + g.U * 3, y0: g.U * 22, x1: -g.U * 4, y1: g.U * 8 };
    const stag = { x: state.cx + state.hw * 0.58, y: g.U * 40, angle: -0.7 };
    state.wound = { x: stag.x + 22 * g.U * Math.sin(stag.angle), y: stag.y - 22 * g.U * Math.cos(stag.angle) };
    return stag;
  }

  function paintWorld(g, rand) {
    const c = paintNight(g, rand);
    const ctx = c.getContext('2d');
    ctx.drawImage(paintBark(g), 0, 0);
    paintSap(ctx, g);
    paintBranch(ctx, g);
    paintLeafMass(ctx, g, rand, state.branch.x1 + g.U * 6, state.branch.y1 - g.U * 2, g.U * 8, 90);
    paintLantern(ctx, g);
    return c;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    const stagAt = place(g);
    state.drip = makeDrip(g);
    state.world = paintWorld(g, rand);
    state.front = paintFront(g);
    state.glow = paintGlow(48);
    state.mand = new Float32Array(6);
    state.rhino = makeRhino(g);
    state.rhino.x = state.cx - state.hw * 0.24;
    state.rhino.y0 = g.U * 70;
    state.stag = Object.assign(makeStag(g), stagAt);
    state.moths = makeMoths(g, rand);
    for (const m of state.moths) placeMoth(m, 0, g);
    state.clock = 12;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.clock += dt * props.pace;
    const p = travel(state.clock);
    const flicker = Math.sin(t * 1.7) * 0.6 + Math.sin(t * 2.9 + 1) * 0.4;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(state.world, 0, 0);
    drawGleam(ctx, g, t);
    drawStag(ctx, g, t, p);
    drawRhino(ctx, g, t, p, flicker);
    drawGlow(ctx, g, props.lantern, flicker);
    drawMoths(ctx, g, t, Math.round(props.moths));
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { pace: 1, moths: 9, lantern: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
