/*
 * 能舞台 Noh stage — an empty noh stage in a night garden.
 *
 * Sky, roof, pillars, the painted pine wall, boards, bridge and gravel are baked once.
 * Two iron baskets of fire flicker with slow summed waves, a few embers rise, and a
 * strip of mist slides along the gravel.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const EMBERS = 24;
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
    return {
      W, H, U,
      sx0: W * 0.2, sx1: W * 0.7,
      roofY: H * 0.14, eaveY: H * 0.3,
      wallY0: H * 0.3, floorY: H * 0.6, floorY1: H * 0.78,
      baskets: [[W * 0.15, H * 0.8], [W * 0.75, H * 0.8]],
    };
  }

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#141a2c');
    grad.addColorStop(0.6, '#1f2a40');
    grad.addColorStop(1, '#2a3446');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#d8d2b8';
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.globalAlpha = 0.2 + rand() * 0.45;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * 0.9;
    const my = g.H * 0.12;
    ctx.fillStyle = 'rgba(214,190,120,0.18)';
    blob(ctx, mx, my, g.U * 9, g.U * 9);
    ctx.fillStyle = '#dccb8c';
    blob(ctx, mx, my, g.U * 4.2, g.U * 4.2);
    ctx.fillStyle = '#2a3a4a';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, g.H * 0.6);
      for (let x = 0; x <= g.W; x += 4) {
        ctx.lineTo(x, g.H * (0.46 + i * 0.04) - Math.sin(x / (g.U * 18) + i * 2) * g.U * 3 - fbm(x / (g.U * 30), i, 3, 5) * g.U * 6);
      }
      ctx.lineTo(g.W, g.H * 0.7);
      ctx.lineTo(0, g.H * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1c2a34';
    }
  }

  function gardenTree(ctx, x, base, h, u, rand, dark) {
    ctx.fillStyle = dark ? '#16241f' : '#1d3126';
    ctx.fillRect(x - u * 0.5, base - h * 0.5, u, h * 0.5);
    for (let i = 0; i < 4; i++) {
      const y = base - h * (0.3 + i * 0.2);
      blob(ctx, x + (rand() - 0.5) * u * 3, y, u * (7 - i * 1.3), u * 2.2);
    }
  }

  function paintGarden(ctx, g, rand) {
    const u = g.U;
    for (let i = 0; i < 9; i++) {
      const x = i < 4 ? g.W * (0.02 + i * 0.045) : g.W * (0.78 + (i - 4) * 0.055);
      gardenTree(ctx, x, g.floorY + u * 2, u * (22 + rand() * 12), u, rand, i % 2 === 0);
    }
    ctx.fillStyle = '#7a3a2a';
    blob(ctx, g.W * 0.08, g.H * 0.4, u * 4.5, u * 3);
    ctx.fillStyle = '#9a4a30';
    blob(ctx, g.W * 0.1, g.H * 0.38, u * 2.6, u * 1.8);
  }

  // The painted pine on the back wall: a gold ground, a leaning trunk, flat needle clusters.
  function paintWall(ctx, g, rand) {
    const x0 = g.sx0 + g.U * 4;
    const x1 = g.sx1 - g.U * 4;
    const y0 = g.wallY0 + g.U * 1;
    const y1 = g.floorY;
    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, '#7e6d44');
    grad.addColorStop(1, '#a58c52');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = 'rgba(70,52,30,0.4)';
    for (let i = 1; i < 4; i++) ctx.fillRect(x0 + ((x1 - x0) * i) / 4, y0, 1, y1 - y0);
    const cx = (x0 + x1) / 2;
    ctx.strokeStyle = '#3a2a1c';
    ctx.lineCap = 'round';
    ctx.lineWidth = g.U * 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - g.U * 2, y1);
    ctx.bezierCurveTo(cx - g.U * 6, y1 - g.U * 10, cx + g.U * 5, y1 - g.U * 14, cx + g.U * 1, y0 + g.U * 6);
    ctx.stroke();
    const limbs = [[-16, 8], [14, 6], [-10, 16], [18, 15], [0, 4]];
    ctx.lineWidth = g.U * 0.9;
    const tones = ['#2c4a2a', '#43622f', '#6c8a3e'];
    for (const [dx, up] of limbs) {
      const bx = cx + g.U * dx * 0.3;
      const by = y1 - g.U * (up + 6);
      ctx.beginPath();
      ctx.moveTo(cx + g.U * 0.5, by + g.U * 3);
      ctx.quadraticCurveTo(bx, by, cx + g.U * dx, by - g.U * 1.5);
      ctx.stroke();
      for (let t = 0; t < 3; t++) {
        ctx.fillStyle = tones[t];
        blob(ctx, cx + g.U * dx + (rand() - 0.5) * g.U, by - g.U * (1.6 + t * 0.5), g.U * (6 - t * 1.3), g.U * (1.9 - t * 0.35));
      }
    }
  }

  function paintRoof(ctx, g) {
    const { sx0, sx1, roofY, eaveY, U } = g;
    const o = U * 6;
    ctx.fillStyle = '#2a2a30';
    poly(ctx, [sx0 + U * 8, roofY, sx1 - U * 8, roofY, sx1 + o, eaveY, sx0 - o, eaveY]);
    ctx.fillStyle = '#3c3c44';
    for (let i = 1; i < 8; i++) {
      const f = i / 8;
      ctx.fillRect(lerp(sx0 + U * 8, sx0 - o, f * 0.9) + (sx1 - sx0) * 0.05 * f, roofY + 1, 1, eaveY - roofY - 1);
    }
    ctx.fillRect(sx0 - o, eaveY - U * 0.6, sx1 - sx0 + o * 2, U * 0.6);
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(sx0 + U * 6, roofY - U * 1.2, sx1 - sx0 - U * 12, U * 1.4);
    ctx.fillStyle = '#6a5636';
    ctx.fillRect(sx0 - o, eaveY, sx1 - sx0 + o * 2, U * 0.9);
  }

  function paintStage(ctx, g, rand) {
    const { sx0, sx1, floorY, floorY1, U } = g;
    const grad = ctx.createLinearGradient(0, floorY, 0, floorY1);
    grad.addColorStop(0, '#7a5530');
    grad.addColorStop(1, '#b98a52');
    ctx.fillStyle = grad;
    poly(ctx, [sx0, floorY, sx1, floorY, sx1 + U * 4, floorY1, sx0 - U * 4, floorY1]);
    ctx.fillStyle = 'rgba(40,24,12,0.5)';
    for (let x = -4; x <= 12; x++) {
      const f = x / 12;
      ctx.beginPath();
      ctx.moveTo(lerp(sx0, sx1, f), floorY);
      ctx.lineTo(lerp(sx0 - U * 4, sx1 + U * 4, f), floorY1);
      ctx.lineTo(lerp(sx0 - U * 4, sx1 + U * 4, f) + 1, floorY1);
      ctx.lineTo(lerp(sx0, sx1, f) + 1, floorY);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(240,210,150,0.18)';
    for (let i = 0; i < 20; i++) ctx.fillRect(lerp(sx0, sx1, rand()), floorY + (floorY1 - floorY) * rand(), U * (2 + rand() * 5), 1);
    ctx.fillStyle = '#4a3420';
    ctx.fillRect(sx0 - U * 4, floorY1, sx1 - sx0 + U * 8, U * 1.6);
    // front steps of pale wood and the pillars
    ctx.fillStyle = '#5a4026';
    for (const px of [sx0 + U * 1, sx0 + (sx1 - sx0) * 0.5, sx1 - U * 2]) {
      ctx.fillRect(px, g.eaveY, U * 1.8, floorY - g.eaveY + U * 1);
    }
    ctx.fillRect(sx0, g.eaveY + U * 4, sx1 - sx0, U * 0.8);
  }

  // The bridge walkway runs off to the right, lower and narrower, with a low roof on posts.
  function paintBridge(ctx, g) {
    const { sx1, floorY, U, W } = g;
    const x0 = sx1 + U * 2;
    ctx.fillStyle = '#6a4a2a';
    poly(ctx, [x0, floorY + U * 1, W, floorY + U * 4, W, floorY + U * 10, x0 + U * 2, floorY + U * 8]);
    ctx.fillStyle = '#8c6838';
    poly(ctx, [x0, floorY + U * 1, W, floorY + U * 4, W, floorY + U * 5.5, x0, floorY + U * 2.6]);
    ctx.fillStyle = '#3c2c1c';
    for (let x = x0 + U * 6; x < W; x += U * 12) ctx.fillRect(x, floorY - U * 2, U * 1, U * 8);
    ctx.fillStyle = '#26262c';
    poly(ctx, [x0 - U * 2, floorY - U * 3, W, floorY - U * 1, W, floorY + U * 0.6, x0 - U * 2, floorY - U * 1.6]);
  }

  function paintGravel(ctx, g, rand) {
    const y0 = g.floorY1 + g.U * 2;
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, '#6a6a68');
    grad.addColorStop(1, '#8a8a84');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, g.H - y0);
    ctx.fillStyle = '#d2cfc0';
    for (let i = 0; i < g.W * 1.2; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.35;
      ctx.fillRect(rand() * g.W, y0 + rand() * (g.H - y0), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(30,30,34,0.35)';
    for (let i = 0; i < 5; i++) ctx.fillRect(0, y0 + g.U * (4 + i * 3.2), g.W, 1);
  }

  function paintPines(ctx, g, rand) {
    const u = g.U;
    for (const [fx, s] of [[0.04, 1.1], [0.3, 0.9], [0.88, 1]]) {
      const x = g.W * fx;
      const base = g.H * 0.95;
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(x - u * 0.5, base - u * 12 * s, u, u * 12 * s);
      for (let i = 0; i < 4; i++) {
        const y = base - u * s * (6 + i * 3.4);
        ctx.fillStyle = '#233a26';
        blob(ctx, x + (rand() - 0.5) * u, y + u * 0.5, u * s * (6.5 - i), u * s * 1.7);
        ctx.fillStyle = '#4d6a36';
        blob(ctx, x + (rand() - 0.5) * u, y - u * 0.3, u * s * (5 - i * 0.8), u * s * 1.1);
      }
    }
  }

  function paintBasketBase(ctx, g) {
    const u = g.U;
    for (const [x, y] of g.baskets) {
      ctx.strokeStyle = '#18181c';
      ctx.lineWidth = Math.max(1, u * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, y - u * 3);
      ctx.lineTo(x - u * 3, y + u * 10);
      ctx.moveTo(x, y - u * 3);
      ctx.lineTo(x + u * 3, y + u * 10);
      ctx.moveTo(x, y - u * 3);
      ctx.lineTo(x, y + u * 10);
      ctx.stroke();
      ctx.fillStyle = '#202026';
      poly(ctx, [x - u * 4, y - u * 6, x + u * 4, y - u * 6, x + u * 2.5, y - u * 2.5, x - u * 2.5, y - u * 2.5]);
      ctx.fillStyle = '#7a2a1a';
      blob(ctx, x, y - u * 6, u * 3.6, u * 0.9);
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintGarden(ctx, g, rand);
    paintWall(ctx, g, rand);
    paintStage(ctx, g, rand);
    paintRoof(ctx, g);
    paintBridge(ctx, g);
    paintGravel(ctx, g, rand);
    paintPines(ctx, g, rand);
    paintBasketBase(ctx, g);
    return c;
  }

  function paintGlow(g) {
    const r = Math.ceil(g.U * 48);
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,190,90,0.8)');
    grad.addColorStop(0.35, 'rgba(230,130,50,0.38)');
    grad.addColorStop(1, 'rgba(200,90,30,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return { c, r };
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.14);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 14), y / (g.U * 4), 4, 31);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 190;
        img.data[i + 1] = 200;
        img.data[i + 2] = 208;
        img.data[i + 3] = Math.round(smoothstep(0.4, 0.66, v) * band * 4) * 22;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function flameShape(ctx, x, y, w, h, lean) {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.9, y - h * 0.5, x + lean, y - h);
    ctx.quadraticCurveTo(x + w * 0.9, y - h * 0.5, x + w, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawFire(ctx, g, t, fire) {
    if (fire <= 0) return;
    const u = g.U;
    const s = state.glow;
    for (let i = 0; i < 2; i++) {
      const [x, y] = g.baskets[i];
      const p = i * 1.7;
      const fl = 0.8 + 0.12 * Math.sin(t * 3.1 + p) + 0.08 * Math.sin(t * 5.3 + p * 2) + 0.05 * Math.sin(t * 8.7 + p * 3);
      const lean = Math.sin(t * 1.3 + p) * u * 0.8;
      ctx.globalAlpha = Math.min(1, fl * fire * 0.8);
      ctx.drawImage(s.c, x - s.r, y - u * 8 - s.r);
      ctx.globalAlpha = 1;
      const hgt = u * (6.5 + 2.2 * Math.sin(t * 4.1 + p) + 1.2 * Math.sin(t * 6.7 + p)) * fire;
      ctx.fillStyle = '#c4501f';
      flameShape(ctx, x, y - u * 6, u * 4, hgt * 1.4, lean);
      ctx.fillStyle = '#e8963a';
      flameShape(ctx, x + lean * 0.2, y - u * 6, u * 2.6, hgt * 1.0, lean * 0.7);
      ctx.fillStyle = '#f5d98a';
      flameShape(ctx, x + lean * 0.1, y - u * 6, u * 1.4, hgt * 0.6, lean * 0.4);
    }
  }

  function makeEmbers(g, rand) {
    const e = { x: new Float32Array(EMBERS), y: new Float32Array(EMBERS), p: new Float32Array(EMBERS), s: new Float32Array(EMBERS) };
    for (let i = 0; i < EMBERS; i++) {
      const b = g.baskets[i % 2];
      e.x[i] = b[0];
      e.p[i] = rand() * 10;
      e.s[i] = 0.2 + rand() * 0.15;
      e.y[i] = rand();
    }
    return e;
  }

  function drawEmbers(ctx, g, t, fire, dt) {
    if (fire <= 0) return;
    const e = state.embers;
    const u = g.U;
    ctx.fillStyle = '#f0b060';
    for (let i = 0; i < EMBERS; i++) {
      e.y[i] += e.s[i] * dt;
      if (e.y[i] > 1) e.y[i] -= 1;
      const f = e.y[i];
      const b = g.baskets[i % 2];
      const x = b[0] + Math.sin(t * 0.9 + e.p[i]) * u * (1 + f * 4);
      const y = b[1] - u * 8 - f * u * 34;
      ctx.globalAlpha = (1 - f) * 0.9;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const c = (t * g.U * 0.7) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.6);
    ctx.drawImage(m, -c, g.H * 0.36);
    ctx.drawImage(m, w - c, g.H * 0.36);
    const a = (t * g.U * 1.6) % w;
    const y = g.floorY1 + g.U * 1;
    ctx.globalAlpha = Math.min(1, mist * 1.0);
    ctx.drawImage(m, -a, y);
    ctx.drawImage(m, w - a, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.glow = paintGlow(g);
    state.mist = paintMist(g);
    state.embers = makeEmbers(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { fire, mist } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawFire(ctx, g, t, fire);
    drawMist(ctx, g, t, mist);
    drawEmbers(ctx, g, t, fire, Math.min(dt, 0.1));
  }

  Kasuri.run({
    defaults: { fire: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
