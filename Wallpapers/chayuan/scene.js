/*
 * 茶园 Tea Garden — rows of tea bushes curving over green hills in morning mist.
 *
 * Sky, far hills, the tea slopes with their hut and the foreground slope are
 * baked into layers and repainted once a minute from the clock, so the hut
 * window glows at night. Between repaints only two mist banks and a thread of
 * kitchen smoke move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 7;
  const HUT_X = 0.6;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const rgb = (h) => parseColor(h);

  // Colour as lit by the current sky, darker and bluer at night.
  function tone(sky, hex, lit) {
    const day = mixColor(rgb(hex), sky.amb, lit === undefined ? 0.22 : lit);
    return toHex(mixColor(day, rgb('#0f1426'), sky.night * 0.72));
  }

  const bump = (x, c, w) => Math.exp(-(((x - c) / w) * ((x - c) / w)));

  // ---- land shapes ---------------------------------------------------------

  function farC(g, x) {
    const spire = (c, w, hgt) => hgt * Math.exp(-Math.pow(Math.abs(x - c) / w, 2.4) * 2.2);
    return g.H * 0.46 - spire(g.W * 0.33, g.W * 0.11, g.H * 0.3) - spire(g.W * 0.88, g.W * 0.1, g.H * 0.27) - spire(g.W * 0.5, g.W * 0.06, g.H * 0.17) - spire(g.W * 0.4, g.W * 0.05, g.H * 0.12) + (fbm(x * 0.05, 9, 3, 5) - 0.5) * g.U * 1.6;
  }

  function farA(g, x) {
    return g.H * (0.4 - 0.13 * bump(x, g.W * 0.2, g.W * 0.2)) + (fbm(x * 0.03, 1, 3, 3) - 0.5) * g.U * 3;
  }

  function farB(g, x) {
    return g.H * (0.44 - 0.14 * bump(x, g.W * 0.78, g.W * 0.24) - 0.05 * bump(x, g.W * 0.45, g.W * 0.1)) + (fbm(x * 0.04, 5, 3, 7) - 0.5) * g.U * 2.4;
  }

  function midHill(g, x) {
    return g.H * (0.82 - 0.27 * bump(x, g.W * 0.6, g.W * 0.36) - 0.06 * bump(x, g.W * 0.2, g.W * 0.16));
  }

  function nearHill(g, x) {
    return g.H * (1.02 - 0.3 * bump(x, g.W * 0.2, g.W * 0.42)) + Math.sin(x * 0.03) * g.U * 0.5;
  }

  // ---- sky -----------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    return c;
  }

  // A soft sun by day and a pale moon by night, kept above the far hills.
  function paintLuminary(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const px = g.W * (0.12 + 0.76 * t);
    const py = g.H * (0.2 - 0.12 * Math.sin(t * Math.PI));
    const r = g.U * (night ? 3.2 : 4.5);
    const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
    glow.addColorStop(0, night ? 'rgba(220,224,240,0.3)' : 'rgba(255,240,210,0.45)');
    glow.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - r * 4, py - r * 4, r * 8, r * 8);
    ctx.fillStyle = night ? '#e4e6ee' : '#fbf1d6';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 6.3);
    ctx.fill();
  }

  // ---- hills ---------------------------------------------------------------

  function fillHill(ctx, g, fn, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, fn(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
  }

  function paintFar(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    fillHill(ctx, g, farC, tone(sky, '#a2b4bc', 0.4));
    fillHill(ctx, g, farA, tone(sky, '#7f98a0', 0.35));
    fillHill(ctx, g, farB, tone(sky, '#6a8a82', 0.3));
    // Pale haze sinking into the valley between the far ridges.
    const haze = ctx.createLinearGradient(0, g.H * 0.3, 0, g.H * 0.52);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(1, toHex(sky.haze));
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = haze;
    ctx.fillRect(0, g.H * 0.3, g.W, g.H * 0.22);
    ctx.globalAlpha = 1;
    return c;
  }

  // Tea rows follow the slope: each row is the crest line shifted down, so the
  // rows bend over the hill and settle flatter toward the bottom.
  function paintRows(ctx, g, sky, fn, gap, wide, y0) {
    const earth = tone(sky, '#9c8a5c', 0.2);
    const path = tone(sky, '#b9a674', 0.25);
    const dark = tone(sky, '#3f5c33', 0.2);
    const mid = tone(sky, '#58783f', 0.25);
    const lit = tone(sky, '#86a360', 0.35);
    fillHill(ctx, g, fn, earth);
    const rows = Math.ceil((g.H - y0) / gap) + 2;
    for (let k = 0; k < rows; k++) {
      const flat = Math.min(1, k / 24) * 0.35;
      const stepPath = k % 6 === 5;
      for (let pass = 0; pass < 3; pass++) {
        ctx.strokeStyle = pass === 0 ? dark : pass === 1 ? mid : lit;
        ctx.lineWidth = pass === 0 ? gap * wide : pass === 1 ? gap * wide * 0.55 : Math.max(1, gap * 0.14);
        ctx.beginPath();
        for (let x = -2; x <= g.W + 2; x += 2) {
          const base = fn(g, x);
          const slope = (fn(g, x + 2) - fn(g, x - 2)) / 4;
          const yy = base + k * gap * (1 - flat) + gap * 0.9 + Math.sin(x * 0.05 + k * 0.7) * gap * 0.12;
          const py = pass === 2 ? yy - gap * wide * 0.28 : pass === 1 ? yy - gap * wide * 0.08 : yy;
          if (stepPath && pass === 0) continue;
          if (x === -2) ctx.moveTo(x, py + slope * 0);
          else ctx.lineTo(x, py);
        }
        if (!(stepPath && pass === 0)) ctx.stroke();
      }
      if (stepPath) {
        ctx.strokeStyle = path;
        ctx.lineWidth = gap * 0.5;
        ctx.beginPath();
        for (let x = -2; x <= g.W + 2; x += 2) {
          const yy = fn(g, x) + k * gap * (1 - flat) + gap * 0.9;
          if (x === -2) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
  }

  // Keep the rows inside the hill outline.
  function clipHill(ctx, g, fn) {
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, fn(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.clip();
  }

  // ---- hut and trees -------------------------------------------------------

  function paintTree(ctx, g, sky, px, base, s) {
    ctx.fillStyle = tone(sky, '#4a3a2a', 0.1);
    ctx.fillRect(px - s * 0.25, base - s * 3, s * 0.5, s * 3);
    const leaves = [tone(sky, '#2e4a2e', 0.2), tone(sky, '#3d5e38', 0.25)];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = leaves[i % 2];
      ctx.beginPath();
      ctx.arc(px + (i - 2) * s * 0.7, base - s * (3.6 + (i % 2) * 0.8), s * (1.5 - Math.abs(i - 2) * 0.2), 0, 6.3);
      ctx.fill();
    }
  }

  function roofCurve(ctx, x0, x1, y, lift, thick) {
    // A tiled roof edge that dips in the middle and flicks up at the ends.
    const mid = (x0 + x1) / 2;
    ctx.beginPath();
    ctx.moveTo(x0 - lift * 0.4, y - lift);
    ctx.quadraticCurveTo(x0 + (mid - x0) * 0.5, y + lift * 0.1, mid, y);
    ctx.quadraticCurveTo(x1 - (x1 - mid) * 0.5, y + lift * 0.1, x1 + lift * 0.4, y - lift);
    ctx.lineTo(x1 + lift * 0.4, y - lift + thick);
    ctx.quadraticCurveTo(x1 - (x1 - mid) * 0.5, y + lift * 0.1 + thick, mid, y + thick);
    ctx.quadraticCurveTo(x0 + (mid - x0) * 0.5, y + lift * 0.1 + thick, x0 - lift * 0.4, y - lift + thick);
    ctx.closePath();
    ctx.fill();
  }

  function paintHut(ctx, g, sky, px, base) {
    const s = g.U * 1.5;
    const wall = tone(sky, '#ece6d6', 0.3);
    const tile = tone(sky, '#46504f', 0.15);
    const tileLit = tone(sky, '#667572', 0.25);
    const wood = tone(sky, '#5a3a28', 0.1);
    // Main house with a pitched, tiled roof and upturned eaves.
    ctx.fillStyle = wall;
    ctx.fillRect(px - s * 5, base - s * 4.4, s * 10, s * 4.4);
    ctx.fillStyle = tone(sky, '#a8a292', 0.2);
    ctx.fillRect(px - s * 5, base - s * 0.7, s * 10, s * 0.7);
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(px - s * 6.8, base - s * 4.2);
    ctx.lineTo(px - s * 3.2, base - s * 8);
    ctx.lineTo(px + s * 3.2, base - s * 8);
    ctx.lineTo(px + s * 6.8, base - s * 4.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tileLit;
    for (let r = 0; r < 4; r++) ctx.fillRect(px - s * (6.2 - r * 0.9), base - s * (4.6 + r * 0.85), s * (12.4 - r * 1.8), Math.max(1, s * 0.12));
    ctx.fillStyle = tile;
    roofCurve(ctx, px - s * 6.4, px + s * 6.4, base - s * 4.1, s * 0.9, s * 0.7);
    ctx.fillRect(px - s * 3.6, base - s * 8.5, s * 7.2, s * 0.6);
    ctx.fillRect(px - s * 3.9, base - s * 9.2, s * 0.7, s * 0.9);
    ctx.fillRect(px + s * 3.2, base - s * 9.2, s * 0.7, s * 0.9);
    // Timber door and two lattice windows.
    ctx.fillStyle = wood;
    ctx.fillRect(px - s * 0.9, base - s * 3.2, s * 1.8, s * 3.2);
    const glow = sky.night;
    ctx.fillStyle = glow > 0.2 ? toHex(mixColor(rgb('#3a2e24'), rgb('#e0a850'), glow)) : wood;
    for (const wx of [-3.6, 2.2]) {
      ctx.fillRect(px + s * wx, base - s * 3.4, s * 1.4, s * 1.5);
      ctx.fillStyle = wall;
      ctx.fillRect(px + s * (wx + 0.65), base - s * 3.4, Math.max(1, s * 0.12), s * 1.5);
      ctx.fillStyle = glow > 0.2 ? toHex(mixColor(rgb('#3a2e24'), rgb('#e0a850'), glow)) : wood;
    }
    // A low side shed with a smaller tiled roof, and a horse-head gable wall.
    ctx.fillStyle = wall;
    ctx.fillRect(px + s * 5, base - s * 3, s * 4, s * 3);
    ctx.fillStyle = tile;
    roofCurve(ctx, px + s * 4.6, px + s * 9.4, base - s * 3, s * 0.7, s * 0.6);
    ctx.fillRect(px + s * 5, base - s * 4, s * 4, s * 0.9);
    ctx.fillStyle = tone(sky, '#a8a292', 0.2);
    ctx.fillRect(px + s * 5, base - s * 0.5, s * 4, s * 0.5);
  }

  function hutBase(g) {
    return midHill(g, g.W * HUT_X) + g.U * 3.2;
  }

  // ---- bake ----------------------------------------------------------------

  function paintMid(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    clipHill(ctx, g, midHill);
    paintRows(ctx, g, sky, midHill, Math.max(2.4, g.U * 2.2), 0.62, g.H * 0.5);
    ctx.restore();
    const hx = g.W * HUT_X;
    paintTree(ctx, g, sky, hx - g.U * 17, hutBase(g) - g.U * 0.6, g.U * 2.2);
    paintTree(ctx, g, sky, hx + g.U * 20, hutBase(g) - g.U * 0.2, g.U * 1.8);
    paintHut(ctx, g, sky, hx, hutBase(g));
    paintTree(ctx, g, sky, g.W * 0.9, midHill(g, g.W * 0.9) + g.U * 2, g.U * 1.1);
    return c;
  }

  function paintNear(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    clipHill(ctx, g, nearHill);
    paintRows(ctx, g, sky, nearHill, Math.max(3.4, g.U * 3.4), 0.64, g.H * 0.7);
    ctx.restore();
    // A leafy shrub or two on the near crest.
    paintTree(ctx, g, sky, g.W * 0.05, nearHill(g, g.W * 0.05) + g.U * 2, g.U * 1.8);
    return c;
  }

  // Mist bands that tile sideways.
  function paintMist(w, h, sky) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const col = mixColor(mixColor(rgb('#ffffff'), sky.haze, 0.2), rgb('#5a6488'), sky.night * 0.55);
    const density = (x, y) => fbm(x * 0.012, y * 0.09, 4, 33);
    for (let y = 0; y < c.height; y++) {
      const band = Math.pow(Math.sin((y / c.height) * Math.PI), 1.3);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = smoothstep(0.34, 0.6, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(240,240,236,0.9)');
    grad.addColorStop(1, 'rgba(236,236,232,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    state.far = paintFar(g, sky);
    state.mid = paintMid(g, sky);
    state.near = paintNear(g, sky);
    state.mistHigh = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22), sky);
    state.mistLow = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2), sky);
    state.mistAlpha = 1 - sky.night * 0.2;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion --------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const hi = state.mistHigh;
    const lo = state.mistLow;
    const a = Math.min(1, state.mistAlpha * amount);
    const o1 = -((t * g.U * 3) % hi.width);
    ctx.globalAlpha = Math.min(1, a * 1.1);
    ctx.drawImage(hi, o1, g.H * 0.4);
    ctx.drawImage(hi, o1 + hi.width, g.H * 0.4);
    const o2 = -(hi.width - ((t * g.U * 2 + hi.width * 0.4) % hi.width));
    ctx.drawImage(lo, o2, g.H * 0.6);
    ctx.drawImage(lo, o2 + lo.width, g.H * 0.6);
    ctx.globalAlpha = 1;
  }

  function drawLowMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const lo = state.mistLow;
    const o = -((t * g.U * 4 + lo.width * 0.7) % lo.width);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount * 0.55);
    ctx.drawImage(lo, o, g.H * 0.74);
    ctx.drawImage(lo, o + lo.width, g.H * 0.74);
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t) {
    const px = g.W * HUT_X - g.U * 5.4;
    const py = hutBase(g) - g.U * 15;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.06 + i / MAX_PUFFS) % 1;
      const size = g.U * (2.4 + a * 8);
      const dx = a * g.U * 12 + Math.sin(t * 0.5 + i * 1.3) * g.U * 0.9;
      const dy = -a * g.U * 20;
      ctx.globalAlpha = (1 - a) * (1 - state.dim * 0.3);
      ctx.drawImage(state.puff, px + dx - size / 2, py + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Three egrets crossing the valley, wings beating slowly.
  function drawEgrets(ctx, g, t) {
    ctx.strokeStyle = state.dim > 0.5 ? '#9aa4c0' : '#f2efe6';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.018 + i * 0.11) % 1.2) - 0.1;
      const bx = g.W * p;
      const by = g.H * (0.3 + i * 0.03) + Math.sin(t * 0.6 + i * 2) * g.U * 1.2;
      const flap = Math.sin(t * 3.2 + i * 1.7) * g.U * 0.9;
      ctx.beginPath();
      ctx.moveTo(bx - g.U * 1.6, by + flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + g.U * 1.6, by + flap);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.puff = paintPuff();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    drawEgrets(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    ctx.drawImage(state.mid, 0, 0);
    if (props.smoke) drawSmoke(ctx, g, t);
    drawLowMist(ctx, g, t, props.mist);
    ctx.drawImage(state.near, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, smoke: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
