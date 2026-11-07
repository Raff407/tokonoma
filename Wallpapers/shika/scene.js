/*
 * 鹿 Shika — a stag in a cedar forest at first light.
 *
 * Trunks, ferns and light shafts are baked in depth order. The stag is a few
 * shapes redrawn each time: he lowers his head to graze, raises it, looks
 * around, flicks an ear. Mist slides through behind him.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, parseColor: P, mixColor, toHex } = K;

  const FOG = P('#d0c6a8');
  const BARK = P('#231d18');
  const COAT = '#8f6239';
  const COAT_DARK = '#5e3f26';
  const SPOT = '#d6c09a';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintTrunks(ctx, g, rand, count, fog, wide) {
    ctx.fillStyle = toHex(mixColor(BARK, FOG, fog));
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const w = g.U * (wide + rand() * wide * 0.6);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.6, g.H);
      ctx.lineTo(x - w * 0.34, 0);
      ctx.lineTo(x + w * 0.34, 0);
      ctx.lineTo(x + w * 0.6, g.H);
      ctx.fill();
    }
  }

  function paintTrunk(ctx, g, x, w, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6, g.H);
    ctx.lineTo(x - w * 0.34, 0);
    ctx.lineTo(x + w * 0.34, 0);
    ctx.lineTo(x + w * 0.6, g.H);
    ctx.fill();
  }

  function paintShafts(ctx, g, rand) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = rand() * g.W * 1.2 - g.W * 0.1;
      const w = g.U * (5 + rand() * 12);
      const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.85);
      grad.addColorStop(0, 'rgba(226,196,130,0.13)');
      grad.addColorStop(1, 'rgba(226,196,130,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w + g.U * 32, g.H * 0.85);
      ctx.lineTo(x + g.U * 22, g.H * 0.85);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintFern(ctx, g, rand, x, y, size) {
    ctx.strokeStyle = rand() < 0.5 ? '#3f5d36' : '#2d4a2c';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -1.57 + (i - 2.5) * 0.42;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * size * 0.6, y + Math.sin(a) * size, x + Math.cos(a) * size * 1.4, y + Math.sin(a) * size * 0.5);
    }
    ctx.stroke();
  }

  function paintForest(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H);
    sky.addColorStop(0, '#9fa58f');
    sky.addColorStop(0.65, '#d7ca9f');
    sky.addColorStop(1, '#6a6a4c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    paintTrunks(ctx, g, rand, Math.round(g.W / 7), 0.72, 2);
    paintTrunks(ctx, g, rand, Math.round(g.W / 13), 0.48, 3.4);
    paintShafts(ctx, g, rand);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ground = ctx.createLinearGradient(0, g.H * 0.78, 0, g.H);
    ground.addColorStop(0, '#49543a');
    ground.addColorStop(1, '#1e2619');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.82 + fbm(x * 0.02, 2, 3, 3) * 0.05));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let i = 0; i < g.W * 0.28; i++) paintFern(ctx, g, rand, rand() * g.W, g.H * (0.86 + rand() * 0.14), g.U * (2.5 + rand() * 3.5));
    for (const fx of [0.07, 0.29, 0.93]) paintTrunk(ctx, g, g.W * fx, g.U * (11 + rand() * 5), toHex(BARK));
    return c;
  }

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.05, 4, 5);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = FOG[0];
        img.data[i + 1] = FOG[1];
        img.data[i + 2] = FOG[2];
        img.data[i + 3] = smoothstep(0.4, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // 0 upright, 1 nose in the grass: long grazes, short looks around.
  function grazeAmount(t) {
    const p = (t * 0.045) % 1;
    return smoothstep(0.02, 0.1, p) * (1 - smoothstep(0.62, 0.7, p));
  }

  function drawLegs(ctx, u) {
    ctx.fillStyle = COAT_DARK;
    for (const [x, w] of [[-10.5, 1.3], [-8, 1.3], [7.5, 1.2], [10, 1.2]]) ctx.fillRect(x * u, 2 * u, w * u, 14 * u);
  }

  function drawBody(ctx, u, spots) {
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13.5 * u, 6.3 * u, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = SPOT;
    for (const [x, y] of spots) ctx.fillRect(x * u, y * u, Math.max(1, 0.8 * u), Math.max(1, 0.8 * u));
    ctx.beginPath();
    ctx.ellipse(-13 * u, -1.5 * u, 2.3 * u, 3 * u, 0, 0, 6.3);
    ctx.fill();
  }

  function drawAntler(ctx, u, side) {
    ctx.beginPath();
    ctx.moveTo(0, -2 * u);
    ctx.lineTo(side * u, -7 * u);
    ctx.lineTo(side * 3 * u, -11 * u);
    ctx.moveTo(side * 0.8 * u, -5.4 * u);
    ctx.lineTo(side * 3.4 * u, -6.2 * u);
    ctx.moveTo(side * 1.5 * u, -8 * u);
    ctx.lineTo(side * -0.6 * u, -11 * u);
    ctx.stroke();
  }

  function drawHead(ctx, u, graze, look, flick) {
    const neck = lerp(-0.85, 0.95, graze);
    ctx.save();
    ctx.translate(10.5 * u, -2.5 * u);
    ctx.rotate(neck);
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.moveTo(-2.6 * u, 2.2 * u);
    ctx.lineTo(8 * u, -1.5 * u);
    ctx.lineTo(8 * u, 1.3 * u);
    ctx.lineTo(0, 4 * u);
    ctx.fill();
    ctx.translate(9 * u, 0);
    ctx.rotate(-neck * 0.7 + look);
    ctx.strokeStyle = '#3a2a1e';
    ctx.lineWidth = Math.max(1, 0.45 * u);
    drawAntler(ctx, u, 1);
    drawAntler(ctx, u, -1);
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.ellipse(1.6 * u, 0, 4.2 * u, 2 * u, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#1c1512';
    ctx.fillRect(5 * u, -0.5 * u, 1.1 * u, 1.1 * u);
    ctx.fillRect(1.6 * u, -0.9 * u, Math.max(1, 0.7 * u), Math.max(1, 0.7 * u));
    ctx.fillStyle = COAT_DARK;
    ctx.beginPath();
    ctx.ellipse(-1.8 * u, -1.5 * u - flick * u, 2.2 * u, 0.9 * u, -0.5 - flick * 0.4, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function drawStag(ctx, g, t) {
    const u = g.U * 1.55;
    const x = g.W * 0.56;
    const y = g.H * 0.64;
    const graze = grazeAmount(t);
    const look = (1 - graze) * Math.sin(t * 0.3) * 0.2;
    const flick = Math.max(0, Math.sin(t * 0.7) - 0.93) * 12;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.2) * u * 0.12);
    drawLegs(ctx, u);
    drawBody(ctx, u, state.spots);
    drawHead(ctx, u, graze, look, flick);
    ctx.restore();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.forest = paintForest(g, rand);
    state.front = paintFront(g, rand);
    state.mist = paintMist(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.5));
    state.spots = [];
    for (let i = 0; i < 24; i++) state.spots.push([rand() * 22 - 11, -5 + rand() * 7]);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.forest, 0, 0);
    const w = state.mist.width;
    const x = -((t * g.U * 1.3 * api.props.mist) % w);
    ctx.drawImage(state.mist, x, g.H * 0.36);
    ctx.drawImage(state.mist, x + w, g.H * 0.36);
    drawStag(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { mist: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
