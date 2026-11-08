/*
 * 鷺 Sagi — a tall white egret stalking a flooded paddy at first light.
 *
 * Mountains, water and rice are baked once. The bird is a dozen short paths from
 * a small skeleton: two-bone legs and a bezier neck that curls into an S when
 * slack, drawn again upside down as its reflection.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const INK = {
    lit: '#f7f2e6', shade: '#b4bcc8', halo: '#2b3650', legNear: '#20242f', legFar: '#343b4c',
    bill: '#d9a53c', billTip: '#6d5a34', eye: '#1a1d28', lore: '#c9c26a', water: '#6e7e9c',
    ring: '#f2f4f2', trough: '#3c4a68', glint: '#ecd3a0', reflect: '#c3cad0',
  };
  const RICE = ['#8fb563', '#6f9c55', '#b0c874', '#5a8a50'];
  const HORIZON = 0.335;
  const FOOT = 0.76;
  const NECK = 14;
  const NECK_LENGTH = 33;
  const RIPPLES = 14;
  const GLINTS = 70;
  const TAU = Math.PI * 2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSky(ctx, g, rand) {
    const hy = g.H * HORIZON;
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, '#7787ab');
    sky.addColorStop(0.45, '#aab2c8');
    sky.addColorStop(0.8, '#dcc4b8');
    sky.addColorStop(1, '#f4dfba');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, hy + 2);
    const gx = g.W * 0.17;
    const glow = ctx.createRadialGradient(gx, hy, 0, gx, hy, g.W * 0.4);
    glow.addColorStop(0, 'rgba(250,228,180,0.55)');
    glow.addColorStop(1, 'rgba(248,226,176,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, hy + 2);
    for (let i = 0; i < 26; i++) {
      const y = g.U * (2 + rand() * 24);
      ctx.fillStyle = y > g.U * 12 && i % 2 ? '#efc6a4' : '#b0aabc';
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.ellipse(rand() * g.W, y, g.U * (10 + rand() * 26), g.U * (0.5 + rand() * 1.1), 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Taller behind the bird's path, with a low notch on the left for the dawn.
  function ridgeShape(xf, centre) {
    const peak = Math.exp(-Math.pow((xf - centre) / 0.3, 2));
    const left = Math.exp(-Math.pow((xf + 0.04) / 0.13, 2));
    return 0.18 + 0.82 * peak + 0.5 * left;
  }

  function paintRidge(ctx, g, r) {
    const hy = g.H * HORIZON;
    const fade = ctx.createLinearGradient(0, hy - r.height * g.U, 0, hy);
    fade.addColorStop(0, r.colour);
    fade.addColorStop(1, r.foot);
    ctx.fillStyle = fade;
    ctx.beginPath();
    ctx.moveTo(0, hy + 1);
    const scale = 1 / (g.U * r.rough);
    for (let x = 0; x <= g.W + 2; x += 1) {
      const n = fbm(x * scale, r.seed, 4, r.seed);
      ctx.lineTo(x, hy - ridgeShape(x / g.W, r.centre) * r.height * g.U * (0.55 + n * 0.75));
    }
    ctx.lineTo(g.W, hy + 1);
    ctx.fill();
  }

  function paintFarShore(ctx, g, rand) {
    const hy = g.H * HORIZON;
    for (let x = 0; x < g.W; x += g.U * 0.9) {
      const bump = fbm(x * 0.05 / g.U, 3, 3, 8);
      if (bump < 0.42) continue;
      ctx.fillStyle = rand() < 0.5 ? '#74828c' : '#68767f';
      ctx.beginPath();
      ctx.ellipse(x, hy - g.U * 0.4, g.U * (0.7 + rand() * 1.0), g.U * (bump * 4.2), 0, 0, TAU);
      ctx.fill();
    }
    paintFarm(ctx, g, g.W * 0.87, hy - g.U * 0.3);
    ctx.fillStyle = '#76847e';
    ctx.fillRect(0, hy - g.U * 0.5, g.W, Math.max(1, g.U * 1.1));
  }

  function paintFarm(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#b4aea4';
    ctx.fillRect(x - u * 3.6, y - u * 2, u * 7.2, u * 2);
    ctx.fillStyle = '#3e4658';
    ctx.beginPath();
    ctx.moveTo(x - u * 5, y - u * 2);
    ctx.lineTo(x - u * 2.2, y - u * 4.6);
    ctx.lineTo(x + u * 2.2, y - u * 4.6);
    ctx.lineTo(x + u * 5, y - u * 2);
    ctx.fill();
  }

  // The water is the sky seen again: a dim, squashed, upside-down copy.
  function paintWater(ctx, g, canvas) {
    const hy = g.H * HORIZON;
    const water = ctx.createLinearGradient(0, hy, 0, g.H);
    water.addColorStop(0, '#d0cac8');
    water.addColorStop(0.16, '#9ea8ba');
    water.addColorStop(0.5, '#8493ae');
    water.addColorStop(1, '#6a7a98');
    ctx.fillStyle = water;
    ctx.fillRect(0, hy, g.W, g.H - hy);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(0, hy);
    ctx.scale(1, -0.62);
    ctx.drawImage(canvas, 0, 0, g.W, hy, 0, -hy, g.W, hy);
    ctx.restore();
    const blend = ctx.createLinearGradient(0, hy + hy * 0.3, 0, hy + hy * 0.62);
    blend.addColorStop(0, 'rgba(132,147,174,0)');
    blend.addColorStop(1, 'rgba(132,147,174,0.9)');
    ctx.fillStyle = blend;
    ctx.fillRect(0, hy + hy * 0.3, g.W, hy * 0.33);
    paintWarmth(ctx, g, hy);
  }

  function paintWarmth(ctx, g, hy) {
    ctx.save();
    ctx.translate(g.W * 0.17, hy);
    ctx.scale(1, 1.5);
    const warm = ctx.createRadialGradient(0, 0, 0, 0, 0, g.W * 0.26);
    warm.addColorStop(0, 'rgba(246,216,164,0.6)');
    warm.addColorStop(1, 'rgba(246,216,164,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(-g.W * 0.3, 0, g.W * 0.6, g.H);
    ctx.restore();
  }

  function paintTuft(ctx, rand, x, y, h, fade) {
    const blades = h > 3 ? 7 : h > 1.5 ? 3 : 2;
    const width = Math.max(1, h * 0.09);
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#3a4866';
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.16, h * 0.55, Math.max(0.6, h * 0.12), 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = fade;
    for (let i = 0; i < blades; i++) {
      const lean = ((i + 0.5) / blades - 0.5) * 2;
      const tall = h * (0.7 + rand() * 0.34) * (1 - Math.abs(lean) * 0.25);
      const tipX = x + lean * h * 0.52 + (rand() - 0.5) * h * 0.1;
      ctx.strokeStyle = RICE[Math.floor(rand() * RICE.length)];
      ctx.beginPath();
      ctx.moveTo(x + lean * h * 0.08, y);
      ctx.quadraticCurveTo(x + lean * h * 0.14, y - tall * 0.65, tipX, y - tall);
      ctx.stroke();
    }
  }

  // Rows run to one vanishing point; each hill of rice lands on the back layer
  // or the front one depending on whether it stands behind the bird's feet.
  function paintRice(g, rand, back, front) {
    const hy = g.H * HORIZON;
    const drop = g.H - hy;
    const vx = g.W * 0.43;
    const gap = g.U * 20;
    const feet = g.H * FOOT;
    back.lineCap = front.lineCap = 'round';
    for (let z = 12; z > 0.8; z -= Math.max(0.1, z * 0.07)) {
      const y = hy + drop / z;
      const h = 0.1 * (y - hy);
      const reach = (g.W + g.U * 10) * z / gap;
      const loose = smoothstep(3.5, 8, z) * 0.55;
      for (let i = -Math.ceil(reach); i <= Math.ceil(reach); i++) {
        const x = vx + ((i + 0.5 + (rand() - 0.5) * loose) * gap) / z + (rand() - 0.5) * h * 0.2;
        if (x < -h || x > g.W + h) continue;
        const yy = y + (rand() - 0.5) * loose * (y - hy) * 0.12;
        const target = yy < feet ? back : front;
        paintTuft(target, rand, x, yy, h, lerp(1, 0.3, Math.min(1, z / 7)));
      }
    }
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const front = layer(g.W, g.H);
    paintSky(ctx, g, rand);
    paintRidge(ctx, g, { colour: '#7f89a8', foot: '#c8c2c4', height: 27, centre: 0.7, rough: 26, seed: 2 });
    paintRidge(ctx, g, { colour: '#636f92', foot: '#aeaeb8', height: 18, centre: 0.54, rough: 15, seed: 11 });
    paintRidge(ctx, g, { colour: '#5e6c88', foot: '#a0a8b2', height: 9, centre: 0.82, rough: 8, seed: 23 });
    paintFarShore(ctx, g, rand);
    paintWater(ctx, g, c);
    paintRice(g, rand, ctx, front.getContext('2d'));
    state.front = front;
    return c;
  }

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.03, y * 0.09, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.68, v) * band * 5) / 5;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 216;
        img.data[i + 3] = a * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Long thin dashes on the water, widening toward the viewer, tiled sideways.
  function paintDashes(g, rand, count, colour, alpha, fromY) {
    const w = Math.ceil(g.W * 1.2);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const hy = g.H * HORIZON;
    ctx.fillStyle = colour;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const y = lerp(Math.max(hy, fromY), g.H, Math.pow(rand(), 1.3));
      const near = (y - hy) / (g.H - hy);
      const len = g.U * (2 + near * 15) * (0.6 + rand());
      const x = rand() * w;
      const h = Math.max(1, near * g.U * 0.9);
      ctx.fillRect(x, y, len, h);
      if (x + len > w) ctx.fillRect(x - w, y, len, h);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function makeWalk(g) {
    const b = g.B;
    const right = g.W * 0.67;
    const left = g.W * 0.38;
    const steps = Math.max(2, Math.min(5, Math.round((right - left) / (b * 15))));
    const stride = (right - left) / steps;
    const gap = b * 3;
    const walk = { list: [], clock: 0, feet: [right + gap, right], leg: 0 };
    walkOneWay(walk, -1, stride, steps, gap);
    walkOneWay(walk, 1, stride, steps, gap);
    return { list: walk.list, total: walk.clock };
  }

  function pushMove(walk, kind, dur, extra) {
    const mid = (walk.feet[0] + walk.feet[1]) / 2;
    const move = { kind, dur, t0: walk.clock, foot0: walk.feet[0], foot1: walk.feet[1], b0: mid, b1: mid, leg: 0, to: 0, face0: 0, face1: 0 };
    walk.clock += dur;
    walk.list.push(Object.assign(move, extra));
    return move;
  }

  function pushStep(walk, to, face, dur) {
    const leg = walk.leg;
    const other = walk.feet[1 - leg];
    const move = pushMove(walk, 'step', dur, { leg, to, face0: face, face1: face });
    move.b1 = (other + to) / 2;
    walk.feet[leg] = to;
    walk.leg = 1 - leg;
  }

  function walkOneWay(walk, dir, stride, steps, gap) {
    const hold = { face0: dir, face1: dir };
    for (let i = 0; i < steps; i++) {
      pushStep(walk, walk.feet[1 - walk.leg] + dir * stride, dir, 4.6);
      pushMove(walk, 'hold', i % 2 ? 2.4 : 1.4, hold);
      if (i === steps - 2) {
        pushMove(walk, 'reach', 11, hold);
        pushMove(walk, 'hold', 1.8, hold);
      }
    }
    pushStep(walk, walk.feet[1 - walk.leg] - dir * gap, dir, 3.6);
    pushMove(walk, 'hold', 1.6, hold);
    pushMove(walk, 'reach', 11, hold);
    pushMove(walk, 'hold', 2, hold);
    pushMove(walk, 'turn', 4, { face0: dir, face1: -dir });
    pushMove(walk, 'hold', 1.2, { face0: -dir, face1: -dir });
  }

  function currentMove(tm) {
    const list = state.walk.list;
    let i = state.cursor;
    if (tm < list[i].t0) i = 0;
    while (i < list.length - 1 && tm >= list[i].t0 + list[i].dur) i++;
    if (i !== state.cursor) enterMove(list[state.cursor], list[i]);
    state.cursor = i;
    return list[i];
  }

  function enterMove(old, next) {
    const g = state.g;
    if (old.kind === 'step') spawnRipple(old.to, g.footY, 1);
    if (next.kind === 'step') spawnRipple(next.leg ? next.foot1 : next.foot0, g.footY, 0.8);
    state.touched = false;
  }

  // Fills state.pose from the clock. Scalars only, so nothing is allocated.
  function solveMove(t) {
    const p = state.pose;
    const tm = t % state.walk.total;
    const m = currentMove(tm);
    const u = Math.min(1, (tm - m.t0) / m.dur);
    p.foot0 = m.foot0;
    p.foot1 = m.foot1;
    p.lift0 = p.lift1 = 0;
    p.body = m.b0;
    p.face = m.face0;
    p.reach = 0;
    p.lead = 0;
    if (m.kind === 'step') {
      const f = smoothstep(0.1, 0.9, u);
      const x = lerp(m.leg ? m.foot1 : m.foot0, m.to, f);
      const lift = Math.sin(Math.PI * f) * state.g.B * 9;
      if (m.leg) { p.foot1 = x; p.lift1 = lift; } else { p.foot0 = x; p.lift0 = lift; }
      p.body = lerp(m.b0, m.b1, smoothstep(0, 1, u));
      p.lead = Math.sin(TAU * u);
    } else if (m.kind === 'reach') {
      p.reach = smoothstep(0, 0.42, u) * (1 - smoothstep(0.62, 1, u));
      if (u > 0.44 && !state.touched) {
        state.touched = true;
        state.touchNow = true;
      }
    } else if (m.kind === 'turn') {
      p.face = lerp(m.face0, m.face1, smoothstep(0, 1, u));
    }
    if (Math.abs(p.face) < 0.07) p.face = p.face < 0 ? -0.07 : 0.07;
  }

  function solveSkeleton(t) {
    const p = state.pose;
    const g = state.g;
    const b = g.B;
    const f = p.face;
    const r = p.reach;
    p.hx = p.body + f * r * 3 * b;
    p.hy = g.footY - b * (lerp(32, 28, r) + Math.sin(t * 0.6) * 0.25);
    p.pitch = lerp(0.36, -0.16, r) + Math.sin(t * 0.47) * 0.012;
    const lx = 12.5 * b;
    const ly = -1 * b;
    const cos = Math.cos(p.pitch);
    const sin = Math.sin(p.pitch);
    p.sx = p.hx + f * (lx * cos + ly * sin);
    p.sy = p.hy - lx * sin + ly * cos;
    const headX = lerp(p.hx + f * b * (16 + p.lead * 3.2 + Math.sin(t * 0.31) * 0.6), p.hx + f * 36 * b, r);
    const headY = lerp(p.hy - b * (27 + Math.sin(t * 0.43) * 0.4), g.footY - 12.4 * b, r);
    p.hdx = headX;
    p.hdy = headY;
    p.bill = lerp(0.12 + Math.sin(t * 0.29) * 0.05, 1.12, r);
    p.tipX = headX + f * Math.cos(p.bill) * 12.5 * b;
    p.tipY = headY + Math.sin(p.bill) * 12.5 * b;
    solveNeck(p, b);
    solveLeg(p, 0, p.foot0, g.footY + b * 1.2 - p.lift0, b);
    solveLeg(p, 1, p.foot1, g.footY - b * 1.2 - p.lift1, b);
  }

  // A cubic from shoulder to head; the slacker the neck, the deeper the S.
  function solveNeck(p, b) {
    const dx = p.hdx - p.sx;
    const dy = p.hdy - p.sy;
    const chord = Math.max(0.001, Math.hypot(dx, dy));
    const ux = dx / chord;
    const uy = dy / chord;
    const length = NECK_LENGTH * b;
    const bulge = Math.sqrt(Math.max(0, length - chord) * length) * lerp(0.82, 0.5, p.reach);
    const px = -uy * p.face;
    const py = ux * p.face;
    const ax = p.sx + ux * chord * 0.3 + px * bulge;
    const ay = p.sy + uy * chord * 0.3 + py * bulge;
    const cx = p.sx + ux * chord * 0.72 - px * bulge * 1.15;
    const cy = p.sy + uy * chord * 0.72 - py * bulge * 1.15;
    const { nx, ny } = state;
    for (let i = 0; i <= NECK; i++) {
      const s = i / NECK;
      const m = 1 - s;
      nx[i] = m * m * m * p.sx + 3 * m * m * s * ax + 3 * m * s * s * cx + s * s * s * p.hdx;
      ny[i] = m * m * m * p.sy + 3 * m * m * s * ay + 3 * m * s * s * cy + s * s * s * p.hdy;
    }
  }

  // Two bones, hip to foot, with the joint bending backward as a bird's does.
  function solveLeg(p, id, fx, fy, b) {
    const rootX = p.hx - p.face * 2 * b;
    const rootY = p.hy + 4 * b;
    const upper = 15 * b;
    const lower = 16.5 * b;
    const dx = fx - rootX;
    const dy = fy - rootY;
    const d = Math.max(0.001, Math.min(upper + lower - 0.01, Math.hypot(dx, dy)));
    const a = (upper * upper - lower * lower + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, upper * upper - a * a));
    const leg = state.legs[id];
    leg.rx = rootX;
    leg.ry = rootY;
    leg.ax = rootX + (a * dx) / d - ((h * dy) / d) * p.face;
    leg.ay = rootY + (a * dy) / d + ((h * dx) / d) * p.face;
    leg.fx = fx;
    leg.fy = fy;
  }

  function traceBody(ctx, b) {
    ctx.beginPath();
    ctx.moveTo(13 * b, -2 * b);
    ctx.bezierCurveTo(11 * b, -7.5 * b, 2 * b, -7.5 * b, -6 * b, -5 * b);
    ctx.bezierCurveTo(-10 * b, -3.5 * b, -14 * b, -0.5 * b, -18 * b, 3.5 * b);
    ctx.bezierCurveTo(-14 * b, 5 * b, -10 * b, 6 * b, -5 * b, 6 * b);
    ctx.bezierCurveTo(2 * b, 6.4 * b, 10 * b, 4.6 * b, 13 * b, -2 * b);
    ctx.closePath();
  }

  function traceBelly(ctx, b) {
    ctx.beginPath();
    ctx.moveTo(12 * b, b);
    ctx.bezierCurveTo(8 * b, 4.6 * b, 2 * b, 6 * b, -5 * b, 6 * b);
    ctx.bezierCurveTo(-10 * b, 6 * b, -14 * b, 5 * b, -18 * b, 3.5 * b);
    ctx.bezierCurveTo(-11 * b, 3 * b, -6 * b, 2.8 * b, 0, 2.8 * b);
    ctx.bezierCurveTo(5 * b, 2.8 * b, 9 * b, 2.6 * b, 12 * b, b);
    ctx.closePath();
  }

  function traceNeck(ctx, b, grow, shiftX, shiftY) {
    const { nx, ny } = state;
    ctx.beginPath();
    for (let pass = 0; pass < 2; pass++) {
      const side = pass ? -1 : 1;
      for (let k = 0; k <= NECK; k++) {
        const i = pass ? NECK - k : k;
        const i0 = Math.max(0, i - 1);
        const i1 = Math.min(NECK, i + 1);
        const tx = nx[i1] - nx[i0];
        const ty = ny[i1] - ny[i0];
        const len = Math.max(0.001, Math.hypot(tx, ty));
        const half = (lerp(3, 1.25, i / NECK) * b + grow) * side;
        const x = nx[i] + (-ty / len) * half + shiftX;
        const y = ny[i] + (tx / len) * half + shiftY;
        if (pass === 0 && k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  }

  function traceHead(ctx, b) {
    ctx.beginPath();
    ctx.moveTo(-2.4 * b, 0.3 * b);
    ctx.bezierCurveTo(-2 * b, -2 * b, 1.6 * b, -2.3 * b, 3.6 * b, -0.9 * b);
    ctx.lineTo(3.8 * b, 1 * b);
    ctx.bezierCurveTo(1.6 * b, 1.8 * b, -1.6 * b, 1.8 * b, -2.4 * b, 0.3 * b);
    ctx.closePath();
  }

  function traceBill(ctx, b) {
    ctx.beginPath();
    ctx.moveTo(3 * b, -1 * b);
    ctx.lineTo(12.5 * b, 0.3 * b);
    ctx.lineTo(3 * b, 1.1 * b);
    ctx.closePath();
  }

  function strokeLeg(ctx, leg, width) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(leg.rx, leg.ry);
    ctx.lineTo(leg.ax, leg.ay);
    ctx.lineTo(leg.fx, leg.fy);
    ctx.stroke();
  }

  function strokeToes(ctx, leg, lift, f, b) {
    if (lift < b * 0.6) return;
    const s = Math.min(1, lift / (b * 3)) * b;
    ctx.lineWidth = Math.max(1, b * 0.6);
    ctx.beginPath();
    ctx.moveTo(leg.fx + f * 3.4 * s, leg.fy + 3.2 * s);
    ctx.lineTo(leg.fx, leg.fy);
    ctx.lineTo(leg.fx + f * 1.2 * s, leg.fy + 4.4 * s);
    ctx.moveTo(leg.fx, leg.fy);
    ctx.lineTo(leg.fx - f * 2 * s, leg.fy + 2.4 * s);
    ctx.stroke();
  }

  function enterBody(ctx, p) {
    ctx.translate(p.hx, p.hy);
    ctx.scale(p.face, 1);
    ctx.rotate(-p.pitch);
  }

  function enterHead(ctx, p) {
    ctx.translate(p.hdx, p.hdy);
    ctx.scale(p.face, 1);
    ctx.rotate(p.bill);
  }

  // Seen end-on mid-turn, the body has depth: an oval that opens as |face| drops.
  function fillBulk(ctx, p, b, colour) {
    const q = Math.sqrt(Math.max(0, 1 - p.face * p.face));
    if (q < 0.05) return;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(p.hx, p.hy - b, 4.8 * q * b, 9 * b, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.hdx, p.hdy, 2 * q * b, 2 * b, 0, 0, TAU);
    ctx.fill();
  }

  function fillTorso(ctx, p, b, colour) {
    fillBulk(ctx, p, b, colour);
    ctx.save();
    enterBody(ctx, p);
    ctx.fillStyle = colour;
    traceBody(ctx, b);
    ctx.fill();
    ctx.restore();
  }

  function fillHead(ctx, p, b, colour, billColour) {
    ctx.save();
    enterHead(ctx, p);
    ctx.fillStyle = billColour;
    traceBill(ctx, b);
    ctx.fill();
    ctx.fillStyle = colour;
    traceHead(ctx, b);
    ctx.fill();
    ctx.restore();
  }

  // The reflection is a squashed upside-down silhouette pivoting at the feet.
  function drawReflection(ctx, g, t) {
    const p = state.pose;
    const b = g.B;
    const y = g.footY;
    ctx.save();
    ctx.translate(Math.sin(t * 0.8) * g.U * 0.4, y * 1.64);
    ctx.scale(1, -0.64);
    ctx.globalAlpha = 0.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2c3448';
    strokeLeg(ctx, state.legs[1], Math.max(1.2, b * 1.1));
    strokeLeg(ctx, state.legs[0], Math.max(1.2, b * 1.1));
    ctx.fillStyle = INK.reflect;
    traceNeck(ctx, b, 0, 0, 0);
    ctx.fill();
    fillTorso(ctx, p, b, INK.reflect);
    fillHead(ctx, p, b, INK.reflect, INK.bill);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawLegs(ctx, g, p, b) {
    const width = Math.max(1.3, b * 1.2);
    const legs = state.legs;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK.legFar;
    strokeLeg(ctx, legs[1], width);
    strokeToes(ctx, legs[1], p.lift1, p.face, b);
    ctx.strokeStyle = INK.legNear;
    strokeLeg(ctx, legs[0], width);
    strokeToes(ctx, legs[0], p.lift0, p.face, b);
  }

  function drawPlumes(ctx, g, p, b, t) {
    ctx.save();
    enterBody(ctx, p);
    ctx.strokeStyle = INK.lit;
    ctx.lineWidth = Math.max(1, b * 0.55);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const sway = Math.sin(t * 0.7 + i * 0.9) * b * 0.7;
      ctx.moveTo(-6 * b, (-3 + i * 1.3) * b);
      ctx.quadraticCurveTo(-15 * b, (0.5 + i * 1.1) * b, (-21 - i * 1.3) * b, (4.5 + i * 1.5) * b + sway);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawTorso(ctx, p, b) {
    fillBulk(ctx, p, b, INK.lit);
    ctx.save();
    enterBody(ctx, p);
    ctx.fillStyle = INK.lit;
    traceBody(ctx, b);
    ctx.fill();
    ctx.fillStyle = INK.shade;
    traceBelly(ctx, b);
    ctx.fill();
    ctx.strokeStyle = INK.shade;
    ctx.lineWidth = Math.max(1, b * 0.5);
    ctx.beginPath();
    ctx.moveTo(8 * b, -2.2 * b);
    ctx.bezierCurveTo(1 * b, -2 * b, -8 * b, -1 * b, -16 * b, 2.6 * b);
    ctx.stroke();
    ctx.restore();
  }

  function drawThigh(ctx, leg, b) {
    ctx.strokeStyle = INK.lit;
    ctx.lineWidth = Math.max(1.4, b * 2.6);
    ctx.beginPath();
    ctx.moveTo(leg.rx, leg.ry - b);
    ctx.lineTo(lerp(leg.rx, leg.ax, 0.34), lerp(leg.ry, leg.ay, 0.34));
    ctx.stroke();
  }

  function drawFace(ctx, p, b) {
    ctx.save();
    enterHead(ctx, p);
    ctx.fillStyle = INK.billTip;
    ctx.beginPath();
    ctx.moveTo(9 * b, -0.45 * b);
    ctx.lineTo(12.5 * b, 0.3 * b);
    ctx.lineTo(9 * b, 0.65 * b);
    ctx.fill();
    ctx.fillStyle = INK.lore;
    ctx.fillRect(1.8 * b, -0.7 * b, 1.6 * b, Math.max(1, 0.8 * b));
    ctx.fillStyle = INK.eye;
    ctx.fillRect(0.6 * b, -0.9 * b, Math.max(1, b * 0.9), Math.max(1, b * 0.9));
    ctx.restore();
  }

  function drawBird(ctx, g, t) {
    const p = state.pose;
    const b = g.B;
    drawLegs(ctx, g, p, b);
    ctx.globalAlpha = 0.55;
    fillTorso(ctx, p, b * 1.07, INK.halo);
    ctx.fillStyle = INK.halo;
    traceNeck(ctx, b, b * 0.8, 0, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawPlumes(ctx, g, p, b, t);
    drawTorso(ctx, p, b);
    drawThigh(ctx, state.legs[0], b);
    ctx.fillStyle = INK.shade;
    traceNeck(ctx, b, 0, 0, 0);
    ctx.fill();
    ctx.fillStyle = INK.lit;
    traceNeck(ctx, b, -b * 0.5, -p.face * b * 0.55, -b * 0.2);
    ctx.fill();
    fillHead(ctx, p, b, INK.lit, INK.bill);
    drawFace(ctx, p, b);
  }

  function spawnRipple(x, y, size) {
    const list = state.ripples;
    let pick = list[0];
    for (const r of list) if (r.age > pick.age) pick = r;
    pick.x = x;
    pick.y = y;
    pick.age = 0;
    pick.size = size;
  }

  function strokeRing(ctx, g, x, y, radius, alpha) {
    const flat = 0.27;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.strokeStyle = INK.ring;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * flat, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, alpha * 0.8);
    ctx.strokeStyle = INK.trough;
    ctx.beginPath();
    ctx.ellipse(x, y + g.U * 0.5, radius * 0.94, radius * flat, 0, 0, TAU);
    ctx.stroke();
  }

  function drawRipples(ctx, g, t, dt, amount) {
    const p = state.pose;
    const b = g.B;
    if (state.touchNow) {
      state.touchNow = false;
      spawnRipple(p.tipX, g.footY, 1);
      spawnRipple(p.tipX, g.footY, 0.6);
    }
    ctx.lineWidth = Math.max(1, g.U * 0.42);
    for (const r of state.ripples) {
      r.age += dt;
      if (r.age > r.life) continue;
      const u = r.age / r.life;
      strokeRing(ctx, g, r.x, r.y, b * (2 + 34 * r.size * Math.sqrt(u)), Math.pow(1 - u, 1.2) * 0.85 * amount);
    }
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.16 + i / 3) % 1;
      const alpha = Math.pow(1 - u, 1.3) * 0.6 * amount;
      if (p.lift0 < b) strokeRing(ctx, g, p.foot0, g.footY + b, b * (1.5 + 15 * u), alpha);
      if (p.lift1 < b) strokeRing(ctx, g, p.foot1, g.footY - b, b * (1.5 + 13 * ((u + 0.4) % 1)), alpha * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function makeGlints(g, rand) {
    const hy = g.H * HORIZON;
    const list = [];
    for (let i = 0; i < GLINTS; i++) {
      const near = Math.pow(rand(), 1.5);
      list.push({
        x: g.W * 0.17 + (rand() - 0.5) * g.U * (8 + near * 60), y: lerp(hy + g.U, g.H * 0.86, near),
        len: g.U * (1.4 + near * 7) * (0.6 + rand()), h: Math.max(1, g.U * (0.3 + near * 0.5)),
        phase: rand() * TAU, rate: 0.5 + rand() * 0.8,
      });
    }
    return list;
  }

  function drawGlints(ctx, t) {
    ctx.fillStyle = INK.glint;
    for (const d of state.glints) {
      const a = Math.sin(t * d.rate + d.phase);
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.85;
      ctx.fillRect(d.x, d.y, d.len, d.h);
    }
    ctx.globalAlpha = 1;
  }

  function slide(ctx, img, x, y) {
    const w = img.width;
    const at = -(((x % w) + w) % w);
    ctx.drawImage(img, at, y);
    ctx.drawImage(img, at + w, y);
  }

  function setup(ctx, api) {
    const U = api.rows / 100;
    const g = { W: api.cols, H: api.rows, U, B: Math.min(U, api.cols / 120) };
    g.footY = g.H * FOOT;
    const rand = K.rng(api.seed);
    state.g = g;
    state.world = paintWorld(g, rand);
    const mistW = Math.ceil(Math.min(g.W * 1.5, 420));
    const mistH = Math.ceil(Math.max(8, g.H * 0.16));
    state.mistA = paintMist(mistW, mistH, 31);
    state.mistB = paintMist(mistW, Math.ceil(mistH * 0.7), 47);
    state.paleDash = paintDashes(g, rand, 150, '#aab6c0', 0.3, 0);
    state.darkDash = paintDashes(g, rand, 170, INK.water, 0.62, g.footY);
    state.glints = makeGlints(g, rand);
    state.walk = makeWalk(g);
    state.cursor = 0;
    state.touched = state.touchNow = false;
    state.pose = {};
    state.legs = [{}, {}];
    state.nx = new Float32Array(NECK + 1);
    state.ny = new Float32Array(NECK + 1);
    state.ripples = [];
    for (let i = 0; i < RIPPLES; i++) state.ripples.push({ x: 0, y: 0, age: 99, life: 7 + i % 3, size: 1 });
  }

  function drawMist(ctx, g, t, amount) {
    const hy = g.H * HORIZON;
    ctx.globalAlpha = Math.min(1, 0.62 * amount);
    slide(ctx, state.mistA, t * g.U * 0.34, hy - g.H * 0.115);
    ctx.globalAlpha = Math.min(1, 0.5 * amount);
    slide(ctx, state.mistB, -t * g.U * 0.2 + 90, hy - g.H * 0.035);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    solveMove(t);
    solveSkeleton(t);
    ctx.drawImage(state.world, 0, 0);
    drawMist(ctx, g, t, api.props.mist);
    slide(ctx, state.paleDash, t * g.U * 0.5, 0);
    drawGlints(ctx, t);
    drawReflection(ctx, g, t);
    slide(ctx, state.darkDash, -t * g.U * 0.7, 0);
    drawRipples(ctx, g, t, Math.min(dt, 0.2), api.props.ripples);
    drawBird(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { mist: 1, ripples: 1, ramp: 'lines', cell: 7, boost: 0.18, gain: 1.08, dither: 0.42 },
    maxFps: 20,
    setup,
    draw,
  });
})();
