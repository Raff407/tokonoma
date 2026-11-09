/*
 * 高山 Takayama — an old merchant street of dark latticed wooden houses.
 *
 * The street is drawn in one-point perspective: two rows of houses, a stone
 * lane and a water channel along each side. Everything still is baked into
 * one layer and repainted once a minute from the clock. Between repaints
 * only mist, glints on the water, a cedar ball and a paper lantern move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const VPY = 0.46;
  const CAM = 0.42;
  const NEAR = 0.4;
  const FAR = 15;
  const RETINT_SECONDS = 60;
  const GLINTS = 10;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Street projection: side s is -1 or 1, z is depth, h is height in metres-ish.
  const px = (g, s, z) => g.W * 0.5 + (s * g.F) / z;
  const py = (g, h, z) => g.H * VPY + ((CAM - h) * g.F) / z;

  function quad(ctx, a, b, c, d) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  }

  // A vertical-edged panel on the wall plane of one side, between two depths.
  function wallQuad(ctx, g, s, inset, z0, z1, h0, h1) {
    const x = s * (1 - inset);
    quad(ctx, [px(g, x, z0), py(g, h1, z0)], [px(g, x, z1), py(g, h1, z1)], [px(g, x, z1), py(g, h0, z1)], [px(g, x, z0), py(g, h0, z0)]);
  }

  // ---- sky and hills -----------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * VPY);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintHills(ctx, g, sky);
    return c;
  }

  // Two ranges of wooded hills behind the end of the street.
  function paintHills(ctx, g, sky) {
    const base = g.H * VPY + g.U * 1;
    const ranges = [
      { lift: 0.2, amp: 0.1, seed: 4, mix: 0.62, tone: '#5d6f86' },
      { lift: 0.1, amp: 0.08, seed: 9, mix: 0.4, tone: '#3d5446' },
    ];
    for (const r of ranges) {
      const col = mixColor(mixColor(rgb(r.tone), sky.haze, r.mix), rgb('#10162a'), sky.night * 0.6);
      ctx.fillStyle = hex(col);
      ctx.beginPath();
      ctx.moveTo(0, base);
      for (let x = 0; x <= g.W; x += 2) {
        const n = fbm(x * 0.018, r.seed, 4, r.seed);
        ctx.lineTo(x, base - g.H * (r.lift * 0.7 + (n - 0.3) * r.amp * 2));
      }
      ctx.lineTo(g.W, base);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- ground and water --------------------------------------------------

  function paintGround(ctx, g, sky, rand) {
    const top = g.H * VPY;
    const stone = mixColor(mixColor(rgb('#7a7468'), sky.amb, 0.3), rgb('#14161f'), sky.night * 0.7);
    const far = mixColor(stone, sky.haze, 0.6);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(0.4, hex(stone));
    grad.addColorStop(1, hex(mixColor(stone, rgb('#000000'), 0.25)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Paving seams run to the vanishing point; a few cross seams between.
    ctx.strokeStyle = hex(mixColor(stone, rgb('#1a1812'), 0.35));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(g.W * 0.5, top);
      ctx.lineTo(g.W * 0.5 + k * g.W * 0.16, g.H);
      ctx.stroke();
    }
    for (let z = NEAR * 1.1; z < 9; z *= 1.28) {
      const y = py(g, 0, z);
      ctx.beginPath();
      ctx.moveTo(px(g, -1, z), y);
      ctx.lineTo(px(g, 1, z), y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Water channel along each wall: a darker strip with a pale lip.
    const water = mixColor(mixColor(rgb('#46607a'), sky.low, 0.45), rgb('#0e1424'), sky.night * 0.6);
    for (const s of [-1, 1]) {
      ctx.fillStyle = hex(water);
      wallQuad(ctx, g, s, 0.1, NEAR, FAR, 0, 0);
      groundStrip(ctx, g, s, 0.82, 0.96, hex(water));
      groundStrip(ctx, g, s, 0.78, 0.82, hex(mixColor(stone, rgb('#d9d4c6'), 0.35)));
    }
  }

  function groundStrip(ctx, g, s, a, b, color) {
    ctx.fillStyle = color;
    quad(ctx, [px(g, s * a, FAR), py(g, 0, FAR)], [px(g, s * b, FAR), py(g, 0, FAR)], [px(g, s * b, NEAR), py(g, 0, NEAR)], [px(g, s * a, NEAR), py(g, 0, NEAR)]);
  }

  // ---- houses ------------------------------------------------------------

  function houseList(side, seed) {
    const rand = K.rng(seed);
    const list = [];
    let z = NEAR - rand() * 0.5;
    while (z < FAR) {
      const len = 0.9 + rand() * 0.9;
      list.push({
        z0: z,
        z1: z + len,
        side,
        top: 1.95 + rand() * 0.2,
        plaster: rand() < 0.3,
        gap: z > 4 && rand() < 0.12,
        tone: rand(),
      });
      z += len + (rand() < 0.15 ? 0.25 : 0);
    }
    return list;
  }

  function paintHouse(ctx, g, sky, hs, k) {
    const s = hs.side;
    const lit = s < 0 ? 1.15 : 0.9;
    const dim = 1 - sky.night * 0.75;
    const fog = smoothstep(2, FAR, hs.z0) * 0.55;
    const tint = (c) => hex(mixColor(mixColor(c, sky.amb, 0.18).map((v) => v * lit * dim + v * 0.22 * (1 - dim)), sky.haze, fog));
    const timber = mixColor(rgb('#5a4332'), rgb('#6c4e38'), hs.tone);
    const z0 = hs.z0;
    const z1 = hs.z1 - 0.04;
    if (hs.gap) {
      ctx.fillStyle = tint(rgb('#28211c'));
      wallQuad(ctx, g, s, 0, z0, z1, 0, 2.1);
      return;
    }
    // Ground floor timber, then the lattice over a dark interior.
    ctx.fillStyle = tint(timber);
    wallQuad(ctx, g, s, 0, z0, z1, 0, 1.0);
    ctx.fillStyle = tint(rgb('#16110e'));
    wallQuad(ctx, g, s, 0, z0 + 0.12, z1 - 0.12, 0.12, 0.92);
    // Warm glow behind the lattice when it is dark.
    if (sky.night > 0.15) {
      ctx.globalAlpha = sky.night * 0.85 * (1 - fog);
      ctx.fillStyle = '#d9a23c';
      wallQuad(ctx, g, s, 0, z0 + 0.12, z1 - 0.12, 0.12, 0.92);
      ctx.globalAlpha = 1;
    }
    // Lattice bars, upright, spaced evenly in depth; thin ones fade out.
    const bars = hex(mixColor(timber, rgb('#b08a5c'), 0.6 * dim).map((v) => v * (0.7 + 0.3 * lit)));
    ctx.fillStyle = hex(mixColor(parseColor(bars), sky.haze, fog));
    for (let z = z0 + 0.12; z < z1 - 0.1; z += 0.085) {
      const a = px(g, s, z);
      const t = py(g, 0.92, z);
      const b = py(g, 0.12, z);
      ctx.fillRect(Math.round(a), t, 1, Math.max(1, b - t));
    }
    // Upper floor: plaster or timber with a lattice window.
    const upper = hs.plaster ? mixColor(rgb('#b7ad98'), sky.amb, 0.2) : mixColor(timber, rgb('#2a1e17'), 0.3);
    ctx.fillStyle = tint(upper);
    wallQuad(ctx, g, s, 0.1, z0, z1, 1.1, 1.92);
    ctx.fillStyle = tint(rgb('#1b1411'));
    wallQuad(ctx, g, s, 0.1, z0 + 0.2, z1 - 0.2, 1.3, 1.75);
    ctx.fillStyle = tint(mixColor(timber, rgb('#7a5a3a'), 0.4));
    for (let z = z0 + 0.2; z < z1 - 0.2; z += 0.1) {
      const a = px(g, s * 0.9, z);
      const t = py(g, 1.75, z);
      ctx.fillRect(Math.round(a), t, 1, Math.max(1, py(g, 1.3, z) - t));
    }
    // Lower eave and the thick roof edge above.
    ctx.fillStyle = tint(rgb('#2a2622'));
    wallQuad(ctx, g, s, 0.16, z0, z1, 1.0, 1.12);
    ctx.fillStyle = tint(rgb('#3c4048'));
    wallQuad(ctx, g, s, 0.24, z0, z1, 1.9, hs.top);
    ctx.fillStyle = tint(rgb('#242830'));
    wallQuad(ctx, g, s, 0.24, z0, z1, 1.9, 1.96);
  }

  function paintStreet(ctx, g, sky) {
    const all = state.houses.slice().sort((a, b) => b.z0 - a.z0);
    for (let i = 0; i < all.length; i++) paintHouse(ctx, g, sky, all[i], i);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGround(ctx, g, sky, rand);
    paintStreet(ctx, g, sky);
    // Soft haze at the far end so the street melts into the hills.
    const haze = ctx.createRadialGradient(g.W * 0.5, g.H * VPY, 0, g.W * 0.5, g.H * VPY, g.W * 0.2);
    haze.addColorStop(0, `rgba(${sky.haze.map(Math.round).join(',')},0.7)`);
    haze.addColorStop(1, `rgba(${sky.haze.map(Math.round).join(',')},0)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // ---- hanging things ----------------------------------------------------

  function paintBall(r) {
    const size = Math.max(6, Math.round(r * 2));
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size * 0.4, size * 0.38, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, '#6f8a4a');
    grad.addColorStop(0.7, '#4a6a34');
    grad.addColorStop(1, '#2c4426');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#1e3018';
    const rand = K.rng(17);
    for (let i = 0; i < size * 1.4; i++) ctx.fillRect(rand() * size, rand() * size, 1, 1);
    return c;
  }

  function paintLantern(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d6452c';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h * 0.45, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#7a2418';
    ctx.fillRect(w * 0.2, 0, w * 0.6, Math.max(1, h * 0.12));
    ctx.fillRect(w * 0.2, h * 0.88, w * 0.6, Math.max(1, h * 0.12));
    ctx.fillStyle = '#8c2a1c';
    for (let k = 1; k < 4; k++) ctx.fillRect(0, h * (0.2 + k * 0.15), w, 1);
    return c;
  }

  // Where each swinging thing hangs from, in screen pixels.
  function placeHangers(g) {
    const r1 = (0.3 * g.F) / 1.6;
    const r2 = (0.22 * g.F) / 3.4;
    state.hang = [
      { kind: 'ball', x: px(g, -0.78, 1.6), y: py(g, 1.0, 1.6), len: g.U * 3, art: paintBall(r1), ph: 0.4 },
      { kind: 'ball', x: px(g, -0.78, 1.6) - r1 * 1.1, y: py(g, 1.0, 1.6), len: g.U * 4.5, art: paintBall(r1 * 0.7), ph: 2.1 },
      { kind: 'ball', x: px(g, 0.76, 3.4), y: py(g, 1.0, 3.4), len: g.U * 1.6, art: paintBall(r2), ph: 1.3 },
      { kind: 'lamp', x: px(g, 0.74, 2.2), y: py(g, 1.02, 2.2), len: g.U * 1.5, art: paintLantern(Math.max(5, Math.round(g.U * 2.8)), Math.max(7, Math.round(g.U * 4.4))), ph: 3.0 },
    ];
  }

  function drawHangers(ctx, g, t, balls) {
    const hang = state.hang;
    for (let i = 0; i < hang.length; i++) {
      const o = hang[i];
      if (o.kind === 'ball' && !balls) continue;
      const a = Math.sin(t * 0.9 + o.ph) * 0.07 + Math.sin(t * 0.37 + o.ph * 2) * 0.03;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(a);
      ctx.fillStyle = '#7a5c3a';
      ctx.fillRect(0, 0, 1, o.len);
      ctx.drawImage(o.art, -o.art.width / 2, o.len);
      ctx.restore();
    }
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.02, y * 0.06, 4, 33), fbm((x - w) * 0.02, y * 0.06, 4, 33), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 238;
        img.data[i + 2] = 234;
        img.data[i + 3] = smoothstep(0.38, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.U * 1.2) % c.width);
    const y = g.H * (VPY - 0.14);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // Pale glints slide down the channels toward the viewer.
  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#e9efef';
    for (let i = 0; i < GLINTS; i++) {
      const a = (t * 0.06 + i / GLINTS) % 1;
      const z = FAR * Math.pow(NEAR / FAR, a);
      const s = i % 2 ? 1 : -1;
      ctx.globalAlpha = 0.45 * (1 - state.dim * 0.6) * Math.sin(a * Math.PI);
      ctx.fillRect(px(g, s * 0.89, z), py(g, 0, z), Math.max(1, 0.1 * g.F / z), 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.mistAlpha = 0.7 - sky.night * 0.4;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100, F: api.cols * 0.2 };
    state.g = g;
    state.houses = houseList(-1, 5).concat(houseList(1, 12));
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.4));
    placeHangers(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawGlints(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    drawHangers(ctx, g, t, props.balls);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, balls: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
