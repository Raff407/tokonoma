/*
 * 稲荷 Inari — a tunnel of vermilion torii climbing a cedar hill in late sun.
 *
 * The hill, the path and every gate are projected once into two baked layers,
 * a back one and a see-through front one. Per tick only the sun stripes on the
 * path (one quad per gap), a few dozen motes and a handful of leaves are drawn.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep } = K;

  const GATES = 27;
  const Z0 = 2.3;
  const STEP = 0.62;
  const PATH = 0.78;
  const PW = 0.11;
  const GATE_H = 2.5;
  const CAM_X = -0.12;
  const CAM_Y = 0.95;
  const CURVE = 0.045;
  const SLOPE = 0.1;
  const STRIPES = 22;
  const MOTES = 90;
  const LEAVES = 10;
  const HAZE = '#e0a46c';
  const LEAF_TONES = ['#c4502e', '#d68a3c', '#c9a24a', '#b2442c'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const curveX = (z) => CURVE * Math.max(0, z - Z0) ** 2;
  const groundY = (z) => SLOPE * Math.max(0, z - Z0);

  // World to canvas. x is measured from the path centre at depth z.
  function proj(g, x, y, z) {
    const zz = Math.max(z, 0.3);
    state.pt[0] = g.cx + (g.f * (x + curveX(z) - CAM_X)) / zz;
    state.pt[1] = g.cy - (g.f * (y + groundY(z) - CAM_Y)) / zz;
    return state.pt;
  }

  function moveP(ctx, g, x, y, z) {
    const p = proj(g, x, y, z);
    ctx.moveTo(p[0], p[1]);
  }

  function lineP(ctx, g, x, y, z) {
    const p = proj(g, x, y, z);
    ctx.lineTo(p[0], p[1]);
  }

  // A face at constant x running from z0 to z1 (pillar sides, walls).
  function sideFace(ctx, g, x, y0, y1, z0, z1) {
    ctx.beginPath();
    moveP(ctx, g, x, y0, z0);
    lineP(ctx, g, x, y0, z1);
    lineP(ctx, g, x, y1, z1);
    lineP(ctx, g, x, y1, z0);
    ctx.fill();
  }

  // A face at constant z facing the viewer.
  function frontFace(ctx, g, x0, x1, y0, y1, z) {
    const a = proj(g, x0, y0, z);
    const ax = a[0];
    const ay = a[1];
    const b = proj(g, x1, y1, z);
    ctx.fillRect(Math.min(ax, b[0]), Math.min(ay, b[1]), Math.abs(b[0] - ax) + 0.4, Math.abs(b[1] - ay) + 0.4);
  }

  // A level face at height y (ground slabs, beam undersides).
  function flatFace(ctx, g, x0, x1, y, z0, z1) {
    ctx.beginPath();
    moveP(ctx, g, x0, y, z0);
    lineP(ctx, g, x1, y, z0);
    lineP(ctx, g, x1, y, z1);
    lineP(ctx, g, x0, y, z1);
    ctx.fill();
  }

  function paintSkyAndHill(ctx, g, rand) {
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    sky.addColorStop(0, '#9aa49c');
    sky.addColorStop(1, '#ecd096');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#66704a';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.16);
    for (let i = 0; i <= 24; i++) {
      const x = (g.W * i) / 24;
      const lift = Math.sin(i * 1.7) * g.U * 3 + Math.sin(i * 0.6) * g.U * 4;
      ctx.lineTo(x, g.H * 0.12 + lift + Math.abs(x - g.far.x) * 0.02);
    }
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
  }

  function paintCedar(ctx, g, rand, x, top, w, lit) {
    ctx.fillStyle = lit ? '#6a5040' : '#4f3d33';
    ctx.fillRect(x - w * 0.5, top, w, g.H * 0.75 - top);
    const tufts = 9;
    for (let i = 0; i < tufts; i++) {
      const y = top + i * g.U * 4.6;
      const span = g.U * (3 + i * 1.4) * (0.7 + rand() * 0.6);
      ctx.fillStyle = i % 2 ? '#48603f' : '#56704a';
      ctx.beginPath();
      ctx.moveTo(x - span, y + g.U * 4);
      ctx.quadraticCurveTo(x, y - g.U * 2, x + span, y + g.U * 4);
      ctx.fill();
      if (lit) {
        ctx.fillStyle = '#8c8a4c';
        ctx.fillRect(x + span * 0.3, y + g.U * 1.5, span * 0.6, Math.max(1, g.U * 0.9));
      }
    }
  }

  function paintMaple(ctx, g, rand, x, y, r, tones) {
    for (let i = 0; i < 90; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand()) * r;
      const s = g.U * (0.7 + rand() * 1.5);
      const lit = Math.cos(a) > 0.2 && rand() < 0.6;
      ctx.fillStyle = tones[lit ? 0 : 1 + Math.floor(rand() * 2)];
      ctx.fillRect(x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d * 0.8, s, s * 0.8);
    }
  }

  function paintForest(ctx, g, rand) {
    const cedars = 16;
    for (let i = 0; i < cedars; i++) {
      const x = ((i + 0.3 + rand() * 0.4) / cedars) * g.W;
      if (Math.abs(x - g.far.x) < g.U * 6) continue;
      paintCedar(ctx, g, rand, x, g.H * (0.02 + rand() * 0.12), g.U * (1.6 + rand() * 1.4), x > g.cx);
    }
    const tones = [
      ['#e2b25a', '#c98a3c', '#a9662e'],
      ['#e48a4a', '#c45a30', '#9c3e28'],
      ['#c2c06a', '#8f9450', '#6f7a44'],
    ];
    for (let i = 0; i < 22; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.08 + rand() * 0.4);
      paintMaple(ctx, g, rand, x, y, g.U * (5 + rand() * 6), tones[i % 3]);
    }
    ctx.fillStyle = '#dcc48c';
    for (let i = 0; i < 160; i++) {
      const x = rand() * g.W;
      const y = rand() ** 1.6 * g.H * 0.42;
      if (K.noise2(x * 0.06, y * 0.1, 7) < 0.58) continue;
      const s = g.U * (0.6 + rand() * 1.8);
      ctx.fillRect(x, y, s, s * 0.7);
    }
  }

  function paintGlow(ctx, g, x, y, r, colour, alpha) {
    const [cr, cg, cb] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Sunlit undergrowth behind both walls: it is what shows in the gaps.
  function paintWallLight(ctx, g) {
    const zFar = Z0 + GATES * STEP;
    for (let z = zFar; z >= Z0 + PW; z -= STEP / 2) {
      const z1 = Math.max(Z0 + PW, z - STEP / 2);
      ctx.fillStyle = '#c6a964';
      sideFace(ctx, g, PATH + PW * 0.6, -0.2, GATE_H * 0.92, z1, z);
      ctx.fillStyle = '#f2d084';
      sideFace(ctx, g, -PATH - PW * 0.6, -0.2, GATE_H * 0.92, z1, z);
    }
  }

  // The slope the tunnel climbs, seen to the right where it leaves the mouth.
  function paintSlope(ctx, g) {
    const zFar = Z0 + GATES * STEP + 1;
    ctx.fillStyle = '#6e6c45';
    ctx.beginPath();
    moveP(ctx, g, PATH + PW + 0.6, 0, Z0);
    for (let z = Z0; z <= zFar; z += 0.5) lineP(ctx, g, PATH + PW + 0.6, 0, z);
    const end = proj(g, PATH + PW + 0.6, 0, zFar)[0];
    ctx.lineTo(end, g.H);
    ctx.lineTo(proj(g, -PATH, 0, Z0)[0], g.H);
    ctx.fill();
  }

  function paintBushes(ctx, g, rand, top) {
    const tones = ['#4f6238', '#5f7140', '#7c8448', '#3f5232'];
    for (let i = 0; i < 26; i++) {
      const cx = (i / 26) * g.W + rand() * g.U * 6;
      const r = g.U * (3 + rand() * 4);
      for (let j = 0; j < 30; j++) {
        const a = rand() * 3.14;
        const d = Math.sqrt(rand()) * r;
        ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
        ctx.fillRect(cx + Math.cos(a) * d * 1.4, top - Math.sin(a) * d * 0.8, g.U * (1 + rand()), g.U * (1 + rand()));
      }
    }
  }

  function paintGround(ctx, g, rand) {
    const top = proj(g, 0, 0, Z0)[1];
    paintSlope(ctx, g);
    ctx.fillStyle = '#6e6c45';
    ctx.fillRect(0, top - g.U * 3, g.W, g.H);
    paintBushes(ctx, g, rand, top - g.U * 2);
    ctx.fillStyle = '#58603c';
    for (let i = 0; i < 160; i++) {
      const y = top + rand() * (g.H - top);
      ctx.fillRect(rand() * g.W, y, g.U * (1 + rand() * 4), Math.max(1, g.U * 0.8));
    }
    ctx.fillStyle = '#8c8452';
    for (let i = 0; i < 70; i++) ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), g.U * 1.2, g.U * 0.7);
  }

  function slabTone(z, i) {
    if (z < Z0) return i % 2 ? '#b3a080' : '#a39272';
    return i % 2 ? '#665648' : '#5c4d41';
  }

  function paintPath(ctx, g) {
    const zFar = Z0 + GATES * STEP + 1;
    let i = 0;
    for (let z = zFar; z > 1.0; z -= 0.34) {
      const z1 = z - 0.34;
      ctx.fillStyle = slabTone(z1, i++);
      flatFace(ctx, g, -PATH - PW, PATH + PW, 0, z, z1);
      ctx.fillStyle = z1 < Z0 ? '#7d6e58' : '#45392f';
      flatFace(ctx, g, -PATH - PW, PATH + PW, 0, z1 + 0.04, z1);
      if (z1 < Z0) {
        ctx.fillStyle = '#7d6e58';
        const off = (i % 2) * 0.35;
        for (let x = -0.5 + off; x < PATH; x += 0.7) flatFace(ctx, g, x, x + 0.04, 0, z, z1);
      }
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSkyAndHill(ctx, g, rand);
    paintForest(ctx, g, rand);
    paintGlow(ctx, g, g.W * 0.22, g.H * 0.2, g.U * 70, '#f0c47c', 0.5);
    paintGlow(ctx, g, g.far.x, g.far.y, g.U * 30, '#f8e2a8', 0.8);
    paintWallLight(ctx, g);
    paintGround(ctx, g, rand);
    paintPath(ctx, g);
    return c;
  }

  function gateTones(z) {
    const t = smoothstep(4, 26, z) * 0.62;
    const m = (hex) => K.toHex(K.mixColor(K.parseColor(hex), K.parseColor(HAZE), t));
    return {
      lit: m('#ee7440'),
      shade: m('#93321f'),
      front: m('#c9472a'),
      frontR: m('#b53e26'),
      under: m('#74281c'),
      black: m('#2e2628'),
      blackLit: m('#4a3a34'),
      edge: m('#f0a060'),
    };
  }

  function paintPillar(ctx, g, side, z, c) {
    const inner = side * PATH;
    const outer = side * (PATH + PW);
    const foot = 0.34;
    ctx.fillStyle = side > 0 ? c.lit : c.shade;
    sideFace(ctx, g, inner, foot, GATE_H - 0.1, z, z + PW);
    ctx.fillStyle = side > 0 ? c.blackLit : c.black;
    sideFace(ctx, g, inner, 0, foot, z, z + PW);
    ctx.fillStyle = side > 0 ? c.frontR : c.front;
    frontFace(ctx, g, Math.min(inner, outer), Math.max(inner, outer), foot, GATE_H - 0.1, z);
    ctx.fillStyle = c.black;
    frontFace(ctx, g, Math.min(inner, outer) - 0.015, Math.max(inner, outer) + 0.015, 0, foot, z);
    ctx.fillStyle = c.edge;
    if (side < 0) frontFace(ctx, g, outer, outer + 0.02, foot, GATE_H - 0.1, z);
    else frontFace(ctx, g, inner, inner + 0.02, foot, GATE_H - 0.1, z);
  }

  function paintBeams(ctx, g, z, c) {
    const b = PATH + PW;
    ctx.fillStyle = c.under;
    flatFace(ctx, g, -b - 0.1, b + 0.1, 1.95, z + 0.02, z + 0.1);
    ctx.fillStyle = c.front;
    frontFace(ctx, g, -b - 0.12, b + 0.12, 1.95, 2.08, z + 0.02);
    frontFace(ctx, g, -0.06, 0.06, 2.08, 2.22, z + 0.03);
    ctx.fillStyle = c.under;
    flatFace(ctx, g, -b - 0.26, b + 0.26, 2.22, z - 0.02, z + 0.14);
    ctx.fillStyle = c.front;
    frontFace(ctx, g, -b - 0.26, b + 0.26, 2.22, 2.34, z - 0.02);
    paintKasagi(ctx, g, z - 0.03, b + 0.34, c.black);
  }

  // The black top beam, its ends lifted a little.
  function paintKasagi(ctx, g, z, half, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    moveP(ctx, g, -half, 2.34, z);
    lineP(ctx, g, half, 2.34, z);
    lineP(ctx, g, half + 0.04, 2.52, z);
    lineP(ctx, g, half * 0.6, 2.47, z);
    lineP(ctx, g, -half * 0.6, 2.47, z);
    lineP(ctx, g, -half - 0.04, 2.52, z);
    ctx.fill();
  }

  function paintGates(ctx, g) {
    for (let i = GATES - 1; i >= 0; i--) {
      const z = Z0 + i * STEP;
      const c = gateTones(z);
      paintPillar(ctx, g, 1, z, c);
      paintPillar(ctx, g, -1, z, c);
      paintBeams(ctx, g, z, c);
    }
  }

  function paintPlinth(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#6c6a60';
    ctx.fillRect(x - u * 12, y + u * 20, u * 24, u * 8);
    ctx.fillStyle = '#8a877a';
    ctx.fillRect(x - u * 9, y + u * 3, u * 18, u * 18);
    ctx.fillStyle = '#a7a292';
    ctx.fillRect(x + u * 4, y + u * 3, u * 5, u * 18);
    ctx.fillStyle = '#9c988a';
    ctx.fillRect(x - u * 11, y, u * 22, u * 3.4);
    ctx.fillStyle = '#c4bca2';
    ctx.fillRect(x + u * 2, y, u * 9, u * 1.4);
    ctx.fillStyle = '#6f7a42';
    ctx.fillRect(x - u * 11, y + u * 3.4, u * 7, u * 1.2);
    ctx.fillRect(x - u * 12, y + u * 20, u * 9, u * 1.6);
    ctx.fillStyle = '#5c5a52';
    ctx.fillRect(x - u * 9, y + u * 3.4, u * 18, Math.max(1, u * 0.8));
  }

  // Outline of a seated fox facing right, in units of u from the middle of
  // its seat. Drawn twice, offset, to leave a lit rim along the back and head.
  function foxPath(ctx, x, y, u) {
    const P = (px, py) => [x + px * u, y + py * u];
    ctx.beginPath();
    ctx.moveTo(...P(7, 0));
    ctx.lineTo(...P(6.2, -10));
    ctx.bezierCurveTo(...P(6.4, -13), ...P(8.4, -16), ...P(7.8, -20));
    ctx.bezierCurveTo(...P(7.4, -23), ...P(7.4, -25), ...P(8.6, -27.4));
    ctx.lineTo(...P(14.6, -29.6));
    ctx.lineTo(...P(14.4, -30.8));
    ctx.bezierCurveTo(...P(12, -31.4), ...P(10, -32), ...P(8.6, -33.6));
    ctx.lineTo(...P(8.8, -40.5));
    ctx.lineTo(...P(5.6, -34.6));
    ctx.lineTo(...P(3.9, -39.8));
    ctx.lineTo(...P(2.4, -33.4));
    ctx.bezierCurveTo(...P(1.4, -31), ...P(1.2, -28), ...P(0.6, -25));
    ctx.bezierCurveTo(...P(-0.4, -20), ...P(-4, -16), ...P(-7.4, -12.5));
    ctx.bezierCurveTo(...P(-11, -9), ...P(-11, -3), ...P(-8.6, 0));
    ctx.closePath();
  }

  function tailPath(ctx, x, y, u) {
    const P = (px, py) => [x + px * u, y + py * u];
    ctx.beginPath();
    ctx.moveTo(...P(-8, -1));
    ctx.bezierCurveTo(...P(-16, -4), ...P(-17.5, -16), ...P(-14.5, -27));
    ctx.bezierCurveTo(...P(-13.4, -31), ...P(-11, -34.5), ...P(-8.6, -35));
    ctx.bezierCurveTo(...P(-9.6, -31), ...P(-10.6, -27), ...P(-10.2, -22));
    ctx.bezierCurveTo(...P(-10, -15), ...P(-8, -9), ...P(-4, -5));
    ctx.closePath();
  }

  function paintFoxShape(ctx, g, x, y, pathFn, rim, body) {
    const u = g.U;
    ctx.fillStyle = rim;
    pathFn(ctx, x, y, u);
    ctx.fill();
    ctx.fillStyle = body;
    pathFn(ctx, x + u * 0.8, y + u * 0.7, u);
    ctx.fill();
  }

  function paintFoxMarks(ctx, g, x, y) {
    const u = g.U;
    const P = (px, py) => [x + px * u, y + py * u];
    ctx.strokeStyle = '#5e5b53';
    ctx.lineWidth = Math.max(1, u * 0.7);
    ctx.beginPath();
    ctx.moveTo(...P(-6, -11));
    ctx.bezierCurveTo(...P(-2, -10), ...P(0, -5), ...P(-0.5, -0.4));
    ctx.moveTo(...P(4, -10));
    ctx.lineTo(...P(4, -0.4));
    ctx.stroke();
    ctx.fillStyle = '#4a4743';
    ctx.beginPath();
    ctx.moveTo(...P(8.4, -34.5));
    ctx.lineTo(...P(8.6, -39));
    ctx.lineTo(...P(6.6, -34.8));
    ctx.fill();
    ctx.fillRect(...P(10.2, -32), u * 1.6, u * 0.8);
    ctx.fillRect(...P(14, -31), u * 0.9, u * 0.9);
    ctx.fillStyle = '#c3412a';
    ctx.beginPath();
    ctx.moveTo(...P(1.4, -25.5));
    ctx.quadraticCurveTo(...P(5, -24), ...P(8.2, -26));
    ctx.quadraticCurveTo(...P(8.6, -21), ...P(6.2, -17));
    ctx.quadraticCurveTo(...P(3, -20), ...P(1.4, -25.5));
    ctx.fill();
    ctx.fillStyle = '#e06a42';
    ctx.fillRect(...P(5.6, -25), u * 2, u * 0.9);
  }

  function paintFox(ctx, g, x, y) {
    paintFoxShape(ctx, g, x, y, tailPath, '#bdb59c', '#a29d8f');
    paintFoxShape(ctx, g, x, y, foxPath, '#ddd3b4', '#918d81');
    const u = g.U;
    ctx.fillStyle = '#7d8446';
    ctx.fillRect(x - u * 10, y - u * 5, u * 3.4, u * 2.4);
    ctx.fillRect(x - u * 16, y - u * 14, u * 2, u * 4);
    ctx.fillRect(x - u * 6, y - u * 1.6, u * 5, u * 1.6);
    paintFoxMarks(ctx, g, x, y);
  }

  function paintForeground(ctx, g, rand) {
    const u = g.U;
    const mouthLeft = proj(g, -PATH - PW, 0, Z0)[0];
    const fx = Math.max(u * 16, mouthLeft - u * 22);
    const fy = g.H * 0.68;
    ctx.fillStyle = '#4f5a34';
    ctx.beginPath();
    ctx.ellipse(fx, g.H, u * 34, u * 10, 0, 0, 6.3);
    ctx.fill();
    paintPlinth(ctx, g, fx, fy);
    paintFox(ctx, g, fx + u * 1, fy);
    const tx = g.W * 0.9;
    ctx.fillStyle = '#5a4436';
    ctx.fillRect(tx - u * 4, 0, u * 8, g.H);
    ctx.fillStyle = '#7e6048';
    ctx.fillRect(tx - u * 4, 0, u * 2, g.H);
    ctx.fillStyle = '#433429';
    for (let i = 0; i < 30; i++) ctx.fillRect(tx - u * 3 + rand() * u * 6, rand() * g.H, Math.max(1, u * 0.5), u * (3 + rand() * 6));
    ctx.fillStyle = '#4a5a34';
    ctx.beginPath();
    ctx.ellipse(tx, g.H, u * 16, u * 6, 0, 0, 6.3);
    ctx.fill();
  }

  // Trunks and undergrowth in front of the stretch of tunnel that has left
  // the mouth, so it reads as climbing on through the wood.
  function paintOuterWoods(ctx, g, rand) {
    const u = g.U;
    const right = proj(g, PATH + PW, 0, Z0)[0] + u * 3;
    const tones = ['#4f6238', '#5f7140', '#7c8448', '#46583a'];
    for (let z = Z0 + 6 * STEP; z < Z0 + GATES * STEP; z += 0.35) {
      const p = proj(g, PATH + PW + 0.25, 0.1, z);
      if (p[0] < right) continue;
      const px = p[0];
      const py = p[1];
      for (let j = 0; j < 14; j++) {
        ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
        ctx.fillRect(px + (rand() - 0.5) * u * 7, py - rand() * u * 4, u * (1 + rand()), u * (1 + rand()));
      }
    }
    for (let i = 0; i < 2; i++) {
      const x = lerp(right + u * 10, g.W * 0.8, i) + (rand() - 0.5) * u * 4;
      const w = u * (2.4 + rand() * 1.2);
      ctx.fillStyle = '#5c4636';
      ctx.fillRect(x, 0, w, g.H * (0.64 + rand() * 0.04));
      ctx.fillStyle = '#86684c';
      ctx.fillRect(x, 0, Math.max(1, w * 0.35), g.H * 0.64);
    }
  }

  // Soft slanting light from the low sun, baked at half size.
  function paintShafts(g, rand) {
    const c = layer(g.W / 2, g.H / 2);
    const ctx = c.getContext('2d');
    const h = c.height;
    for (let i = 0; i < 5; i++) {
      const x = c.width * (0.05 + i * 0.2 + rand() * 0.06);
      const w = h * (0.07 + rand() * 0.07);
      const run = h * 0.55;
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, 'rgba(246,215,154,0)');
      grad.addColorStop(0.5, 'rgba(246,215,154,0.5)');
      grad.addColorStop(1, 'rgba(246,215,154,0)');
      ctx.fillStyle = grad;
      ctx.setTransform(1, 0, 0.55, 1, 0, 0);
      ctx.fillRect(x - run * 0.55, 0, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGates(ctx, g);
    paintOuterWoods(ctx, g, rand);
    paintForeground(ctx, g, rand);
    return c;
  }

  function makeMotes(g, rand) {
    const list = [];
    for (let i = 0; i < MOTES; i++) {
      list.push({ x: rand(), y: rand(), ph: rand() * 6.28, rate: 0.05 + rand() * 0.1, amp: g.U * (2 + rand() * 4) });
    }
    return list;
  }

  function makeLeaves(g, rand) {
    const list = [];
    for (let i = 0; i < LEAVES; i++) {
      list.push({ x: rand(), y: rand(), ph: rand() * 6.28, fall: g.U * (3 + rand() * 3), tone: LEAF_TONES[i % LEAF_TONES.length] });
    }
    return list;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const g = { W, H, U: H / 100, f: H * 0.66, cx: W * 0.47, cy: H * 0.56 };
    state.g = g;
    state.pt = new Float32Array(2);
    const rand = K.rng(api.seed);
    const far = proj(g, -PATH - 1.2, 1.3, Z0 + 11 * STEP);
    g.far = { x: far[0], y: far[1] };
    const mx = proj(g, -PATH - PW, 0, Z0)[0];
    g.mouth = { x: mx - g.U * 6, w: proj(g, PATH + PW, 0, Z0)[0] - mx + g.U * 12 };
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.shafts = paintShafts(g, rand);
    state.motes = makeMotes(g, rand);
    state.leaves = makeLeaves(g, rand);
  }

  // Light from the low sun comes through the left wall's gaps and lies
  // across the path towards the viewer. Its slant drifts with the sun.
  function drawStripes(ctx, g, t, amount) {
    if (amount <= 0) return;
    const k = 0.7 + 0.3 * Math.sin(t * 0.06);
    const across = 2 * PATH * k;
    ctx.fillStyle = '#f6cc7e';
    for (let i = 0; i < STRIPES; i++) {
      const za = Z0 + i * STEP + PW;
      const zb = Z0 + (i + 1) * STEP;
      ctx.globalAlpha = Math.min(1, amount * (0.68 + 0.12 * Math.sin(t * 0.5 + i * 1.9)));
      ctx.beginPath();
      moveP(ctx, g, -PATH, 0, za);
      lineP(ctx, g, -PATH, 0, zb);
      lineP(ctx, g, PATH, 0, Math.max(Z0, zb - across));
      lineP(ctx, g, PATH, 0, Math.max(Z0, za - across));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t, amount) {
    const s = Math.max(1, g.U * 0.9);
    const left = g.mouth.x;
    const span = g.mouth.w;
    ctx.fillStyle = '#fbe8b8';
    for (const m of state.motes) {
      const x = left + ((m.x * span + t * g.U * 0.6 + Math.sin(t * m.rate + m.ph) * m.amp) % span);
      const y = g.H * (0.22 + m.y * 0.6) + Math.sin(t * m.rate * 1.3 + m.ph * 2) * m.amp;
      const glint = 0.5 + 0.5 * Math.sin(t * m.rate * 4 + m.ph);
      ctx.globalAlpha = Math.min(1, amount * (0.2 + 0.8 * glint * glint));
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t, amount) {
    const count = Math.round(LEAVES * Math.min(1, amount));
    const span = g.H * 1.2;
    for (let i = 0; i < count; i++) {
      const l = state.leaves[i];
      const y = ((l.y * span + t * l.fall) % span) - g.H * 0.1;
      const x = l.x * g.W + Math.sin(t * 0.6 + l.ph) * g.U * 6 - y * 0.15;
      const w = g.U * (0.5 + 1.8 * Math.abs(Math.cos(t * 1.1 + l.ph)));
      ctx.fillStyle = l.tone;
      ctx.fillRect(x - w / 2, y, w, g.U * 1.6);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawStripes(ctx, g, t, p.sun);
    ctx.globalAlpha = Math.min(1, p.sun * (0.7 + 0.3 * Math.sin(t * 0.13)));
    ctx.drawImage(state.shafts, Math.sin(t * 0.05) * g.U * 3, 0, g.W, g.H);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.front, 0, 0);
    drawMotes(ctx, g, t, p.dust * (0.4 + 0.6 * p.sun));
    drawLeaves(ctx, g, t, p.dust);
  }

  Kasuri.run({
    defaults: { sun: 1, dust: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.05, dither: 0.35 },
    maxFps: 20,
    setup,
    draw,
  });
})();
