/*
 * 月 Tsuki — tonight's moon, in its real phase, behind thin cloud.
 *
 * The disc is lit per cell from the actual synodic month, so a waxing gibbous
 * here is a waxing gibbous outside. It repaints rarely. Two cloud bands slide
 * past it at different speeds; a pine and a low ridge hold the bottom.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, parseColor: P, mixColor, toHex, clamp } = K;

  const SYNODIC_DAYS = 29.530588853;
  const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
  const PHASES = { full: 0.5, half: 0.25, crescent: 0.12 };
  const LIT = P('#efe5cc');
  const SEA = P('#8d8b84');
  const DARK = P('#141a2c');
  const REPAINT_SECONDS = 300;

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
  function phaseOf(choice, now) {
    if (PHASES[choice] !== undefined) return PHASES[choice];
    const days = (now - NEW_MOON_MS) / 86400000;
    return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS / SYNODIC_DAYS;
  }

  function moonPixel(nx, ny, sx, sz) {
    const nz = Math.sqrt(1 - nx * nx - ny * ny);
    const light = clamp((nx * sx + nz * sz) * 2.2, 0, 1);
    const tilt = 0.45;
    const u = nx * Math.cos(tilt) - ny * Math.sin(tilt);
    const v = nx * Math.sin(tilt) + ny * Math.cos(tilt);
    const sea = K.smoothstep(0.48, 0.6, fbm(u * 2.2 + 4, v * 2.2 + 9, 4, 12));
    const ground = mixColor(LIT, SEA, sea * 0.75);
    return mixColor(DARK, ground, Math.max(light, 0.13));
  }

  function paintMoon(radius, phase) {
    const size = Math.ceil(radius * 2) + 2;
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const a = phase * Math.PI * 2;
    const sx = Math.sin(a);
    const sz = -Math.cos(a);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x - size / 2 + 0.5) / radius;
        const ny = (y - size / 2 + 0.5) / radius;
        const r = nx * nx + ny * ny;
        if (r >= 1) continue;
        const col = moonPixel(nx, ny, sx, sz);
        const i = (y * size + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintSky(g, moon, radius, phase, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H);
    sky.addColorStop(0, '#080c1a');
    sky.addColorStop(1, '#1a2340');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#c7cfdc';
    for (let i = 0; i < g.W * 0.8; i++) {
      ctx.globalAlpha = 0.1 + rand() * 0.45;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.8, 1, 1);
    }
    ctx.globalAlpha = 1;
    const fullness = 1 - Math.abs(phase - 0.5) * 2;
    const halo = ctx.createRadialGradient(moon.x, moon.y, radius * 0.8, moon.x, moon.y, radius * 3.4);
    halo.addColorStop(0, `rgba(190,190,190,${0.12 + 0.3 * fullness})`);
    halo.addColorStop(1, 'rgba(120,130,170,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // A pine as gardeners shape them: leaning trunk, flat pads of needles on each limb.
  function pinePad(ctx, g, rand, x, y, width) {
    ctx.fillStyle = '#0c1320';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(x + (rand() - 0.5) * width, y + (rand() - 0.5) * g.U * 1.2, width * (0.34 + rand() * 0.2), g.U * (0.9 + rand() * 0.8), 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0d1424';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.94 - fbm(x * 0.011, 7, 4, 3) * 0.2));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.lineCap = 'round';
    const u = g.U;
    const baseX = g.W * 0.07;
    ctx.strokeStyle = '#080b12';
    ctx.lineWidth = u * 3.6;
    ctx.beginPath();
    ctx.moveTo(baseX, g.H);
    ctx.bezierCurveTo(baseX + u * 26, g.H - u * 18, baseX + u * 2, g.H - u * 34, baseX + u * 20, g.H - u * 54);
    ctx.stroke();
    const limbs = [[18, 40, 22], [10, 24, -14], [20, 54, 18], [8, 44, 26], [14, 62, -8]];
    for (const [fx, up, reach] of limbs) {
      const x = baseX + u * fx;
      const y = g.H - u * up;
      ctx.lineWidth = u * 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y + u * 3);
      ctx.quadraticCurveTo(x + u * reach * 0.5, y + u, x + u * reach, y);
      ctx.stroke();
      pinePad(ctx, g, rand, x + u * reach, y - u * 0.8, u * (9 + rand() * 5));
    }
    return c;
  }

  function paintClouds(w, h, seed, scale) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * scale, y * scale * 2.6, 4, seed);
    for (let y = 0; y < h; y++) {
      const fall = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 150;
        img.data[i + 1] = 158;
        img.data[i + 2] = 182;
        img.data[i + 3] = K.smoothstep(0.46, 0.72, v) * fall * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawClouds(ctx, tile, y, offset) {
    const x = -((offset % tile.width) + tile.width) % tile.width;
    ctx.drawImage(tile, x, y);
    ctx.drawImage(tile, x + tile.width, y);
  }

  function repaint(g, choice, now) {
    const phase = phaseOf(choice, now);
    const rand = K.rng(state.seed);
    state.moon = paintMoon(state.place.r, phase);
    state.sky = paintSky(g, state.place, state.place.r, phase, rand);
    state.choice = choice;
    state.repaintIn = REPAINT_SECONDS;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.seed = api.seed;
    state.place = { x: g.W * 0.64, y: g.H * 0.36, r: g.U * 21 };
    state.front = paintFront(g, K.rng(api.seed + 1));
    state.far = paintClouds(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.5), 3, 0.02);
    state.near = paintClouds(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.42), 21, 0.032);
    repaint(g, api.props.phase, Date.now());
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.repaintIn -= dt;
    if (state.repaintIn <= 0 || state.choice !== props.phase) repaint(g, props.phase, Date.now());
    const m = state.place;
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.moon, m.x - state.moon.width / 2, m.y - state.moon.height / 2);
    const drift = t * g.U * props.clouds;
    drawClouds(ctx, state.far, g.H * 0.06, drift * 1.5);
    drawClouds(ctx, state.near, g.H * 0.3, drift * 2.8);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { phase: 'auto', clouds: 1, ramp: 'lines', cell: 8, boost: 0.15, gain: 1.15 },
    maxFps: 20,
    setup,
    draw,
  });
})();
