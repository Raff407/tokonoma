/*
 * 夕立 Yudachi — a sudden summer shower at dusk over low tiled rooftops.
 *
 * Sky, roofs and the wet street are baked once into one layer in flat tones.
 * Two rain layers that tile both ways are baked once too: a fine steady fall,
 * and a heavier one gathered into slanted sheets that drift across town.
 * Per frame: a few drawImage calls, a small pool of puddle rings and one walker.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, hash2, smoothstep } = K;

  const HORIZON = 0.5;
  const STREET = 0.74;
  const SLANT = 0.22;
  const RINGS = 18;
  const RING_LIFE = 1.1;
  const WALK_CYCLE = 38;
  const WALK_TIME = 26;

  const SKY = ['#3a3f55', '#464b60', '#545869', '#626474', '#706e74'];
  const GLOW = ['#7e6458', '#a07650', '#b88a52'];
  const CLOUD = { dark: '#2a2e42', mid: '#5a5e70' };
  const HAZE = '#3a3e52';
  const ROOF = { far: '#555a6e', mid: '#3e4358', near: '#70748a', farLine: '#464b60', line: '#2c3044', nearLine: '#2a2e40', ridge: '#16181f' };
  const WALL = { far: '#2c3044', farWood: '#2a2a38', mid: '#4a4650', wood: '#3a2e28', near: '#8a8272', woodNear: '#4a3a30' };
  const WINDOW = { lit: '#b8883a', warm: '#9a723a', dark: '#1c1f2c', bar: '#5a4636' };
  const ROAD = { base: '#2a2e3e', wet: '#363b50', glow: '#6a5638', puddle: '#5a5e72', puddleGlow: '#9a7448' };
  const RAIN = '#d8d6cc';
  const INK = '#15171f';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ---------------------------------------------------------------

  function hexToRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  // Flat bands of storm sky, a low strip of evening light, and cloud in two tones.
  function skyTone(g, x, y) {
    const f = y / (g.H * HORIZON);
    const v = fbm(x * 0.018, y * 0.05, 4, 7);
    if (f < 0.7 && v > 0.56) return CLOUD.dark;
    if (f < 0.8 && v > 0.47 && v < 0.5) return CLOUD.mid;
    if (f > 0.72) {
      const glow = (f - 0.72) / 0.28;
      const gap = fbm(x * 0.01, 3, 3, 11);
      const band = Math.floor(glow * 3.4 + (gap - 0.5) * 2.4);
      if (band >= 1) return GLOW[Math.min(GLOW.length - 1, band - 1)];
    }
    return SKY[Math.min(SKY.length - 1, Math.floor(f * SKY.length))];
  }

  function paintSky(ctx, g) {
    const h = Math.ceil(g.H * HORIZON);
    const img = ctx.createImageData(g.W, h);
    const cache = new Map();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < g.W; x++) {
        const tone = skyTone(g, x, y);
        let rgb = cache.get(tone);
        if (!rgb) {
          rgb = hexToRgb(tone);
          cache.set(tone, rgb);
        }
        const i = (y * g.W + x) * 4;
        img.data[i] = rgb[0];
        img.data[i + 1] = rgb[1];
        img.data[i + 2] = rgb[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- town --------------------------------------------------------------

  // One house: wall, windows, then a tiled roof with eaves and a wet shine.
  function paintHouse(ctx, g, house, row, rand) {
    const { x, w, base, wallH, roofH } = house;
    const top = base - wallH;
    ctx.fillStyle = rand() < 0.45 ? row.wood : row.wall;
    ctx.fillRect(x, top, w, wallH);
    paintWindows(ctx, g, house, row, rand);
    const eave = Math.max(1, w * 0.08);
    const inset = w * (0.12 + rand() * 0.2);
    ctx.fillStyle = row.roof;
    ctx.beginPath();
    ctx.moveTo(x - eave, top + 1);
    ctx.lineTo(x + w + eave, top + 1);
    ctx.lineTo(x + w - inset, top - roofH);
    ctx.lineTo(x + inset, top - roofH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = row.shine;
    for (let k = 1; k < row.courses; k++) {
      const yy = top - roofH * (k / row.courses);
      const spread = inset * (k / row.courses);
      ctx.fillRect(x - eave + spread + eave * (k / row.courses), Math.round(yy), w + 2 * eave - 2 * spread - 2 * eave * (k / row.courses), 1);
    }
    ctx.fillStyle = ROOF.ridge;
    ctx.fillRect(x + inset - 1, top - roofH - 1, w - 2 * inset + 2, Math.max(1, g.U * 0.6));
    ctx.fillRect(x - eave, top, w + 2 * eave, 1);
    ctx.fillStyle = INK;
    ctx.fillRect(x, top + 1, w, Math.max(1, g.U * 0.8));
  }

  function paintWindows(ctx, g, house, row, rand) {
    const { x, w, base, wallH } = house;
    const count = Math.max(1, Math.floor(w / (g.U * 7)));
    const ww = Math.max(2, w / count * 0.55);
    const wh = Math.max(2, wallH * 0.42);
    const wy = base - wallH * 0.72;
    for (let k = 0; k < count; k++) {
      const wx = x + (w / count) * (k + 0.5) - ww / 2;
      const lit = rand() < row.lit;
      ctx.fillStyle = lit ? (rand() < 0.6 ? WINDOW.lit : WINDOW.warm) : WINDOW.dark;
      ctx.fillRect(Math.round(wx), Math.round(wy), Math.round(ww), Math.round(wh));
      if (lit) {
        state.glows.push({ x: wx, w: ww, row: row.name });
        if (ww > 5) {
          ctx.fillStyle = WINDOW.bar;
          ctx.fillRect(Math.round(wx + ww / 2), Math.round(wy), 1, Math.round(wh));
          ctx.fillRect(Math.round(wx), Math.round(wy + wh / 2), Math.round(ww), 1);
        }
      }
    }
  }

  function rows(g) {
    return [
      { name: 'far', base: 0.585, minW: g.U * 9, maxW: g.U * 16, size: [3, 5], roofH: [3, 4.5], gap: [0.5, 3], jitter: 2,
        roof: ROOF.far, shine: ROOF.farLine, wall: WALL.far, wood: WALL.farWood, courses: 2, lit: 0.2 },
      { name: 'mid', base: 0.655, minW: g.U * 14, maxW: g.U * 24, size: [5, 7], roofH: [4.5, 6.5], gap: [1, 4], jitter: 2,
        roof: ROOF.mid, shine: ROOF.line, wall: WALL.mid, wood: WALL.wood, courses: 3, lit: 0.4 },
      { name: 'near', base: STREET, minW: g.U * 26, maxW: g.U * 42, size: [10, 13], roofH: [9, 12], gap: [2, 6], jitter: 0,
        roof: ROOF.near, shine: ROOF.nearLine, wall: WALL.near, wood: WALL.woodNear, courses: 4, lit: 0.55 },
    ];
  }

  function paintRow(ctx, g, row, rand) {
    let x = -rand() * row.minW;
    while (x < g.W) {
      const w = row.minW + rand() * (row.maxW - row.minW);
      const house = {
        x,
        w,
        base: g.H * row.base + (rand() - 0.5) * g.U * row.jitter,
        wallH: g.U * (row.size[0] + rand() * (row.size[1] - row.size[0])),
        roofH: g.U * (row.roofH[0] + rand() * (row.roofH[1] - row.roofH[0])),
      };
      paintHouse(ctx, g, house, row, rand);
      x += w + g.U * (row.gap[0] + rand() * row.gap[1]);
    }
  }

  function paintTown(ctx, g, rand) {
    for (const row of rows(g)) paintRow(ctx, g, row, rand);
  }

  function paintPole(ctx, g) {
    const px = g.W * 0.8;
    ctx.fillStyle = INK;
    ctx.fillRect(px, g.H * 0.3, Math.max(1, g.U * 0.9), g.H * (STREET - 0.3) + g.U * 2);
    ctx.fillRect(px - g.U * 3, g.H * 0.33, g.U * 7, Math.max(1, g.U * 0.5));
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const y0 = g.H * 0.335 + k * g.U * 0.2;
      ctx.beginPath();
      ctx.moveTo(-2, g.H * (0.28 + k * 0.02));
      ctx.quadraticCurveTo(g.W * 0.4, g.H * (0.4 + k * 0.015), px, y0);
      ctx.quadraticCurveTo(g.W * 0.9, g.H * (0.36 + k * 0.01), g.W + 2, g.H * (0.31 + k * 0.015));
      ctx.stroke();
    }
  }

  // ---- street ------------------------------------------------------------

  function paintStreet(ctx, g, rand) {
    const top = Math.round(g.H * STREET);
    ctx.fillStyle = ROAD.base;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = ROAD.wet;
    for (let y = top + 2; y < g.H; y += 3 + Math.floor(rand() * 4)) {
      const x0 = rand() * g.W;
      ctx.fillRect(x0, y, g.W * (0.1 + rand() * 0.3), 1);
    }
    // Lit windows smear down into the wet road.
    ctx.fillStyle = ROAD.glow;
    for (const glow of state.glows) {
      if (glow.row !== 'near') continue;
      for (let y = top + 1; y < g.H; y += 2) {
        if (rand() < 0.35) continue;
        const wob = (rand() - 0.5) * glow.w * 0.5;
        ctx.fillRect(Math.round(glow.x + wob), y, Math.max(1, Math.round(glow.w * (1 - (y - top) / (g.H - top) * 0.6))), 1);
      }
    }
    ctx.fillStyle = INK;
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.5));
    paintPuddles(ctx, g, rand);
  }

  function paintPuddles(ctx, g, rand) {
    const top = g.H * STREET;
    state.puddles = [];
    for (let k = 0; k < 6; k++) {
      const p = {
        x: g.W * (0.08 + k * 0.16 + (rand() - 0.5) * 0.06),
        y: top + (g.H - top) * (0.3 + rand() * 0.55),
        rx: g.U * (7 + rand() * 9),
        ry: 0,
      };
      p.ry = p.rx * 0.22;
      ctx.fillStyle = ROAD.puddle;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ROAD.puddleGlow;
      ctx.fillRect(p.x - p.rx * 0.5, p.y - p.ry * 0.3, p.rx * 0.7, Math.max(1, p.ry * 0.35));
      state.puddles.push(p);
    }
  }

  // ---- rain --------------------------------------------------------------

  // A rain texture that tiles in both directions. `density(x, y)` picks where streaks gather.
  function paintRain(w, h, count, len, density, veil, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(seed);
    if (veil) {
      ctx.fillStyle = RAIN;
      ctx.globalAlpha = veil;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x += 1) {
          if (density(x, y) > 0.72) ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = RAIN;
    let placed = 0;
    let tries = 0;
    while (placed < count && tries < count * 8) {
      tries++;
      const x0 = rand() * w;
      const y0 = rand() * h;
      if (rand() > density(x0, y0)) continue;
      placed++;
      const n = len[0] + Math.floor(rand() * (len[1] - len[0]));
      for (let k = 0; k < n; k++) {
        const px = ((Math.round(x0 - k * SLANT) % w) + w) % w;
        const py = Math.round(y0 + k) % h;
        ctx.fillRect(px, py, 1, 1);
      }
    }
    return c;
  }

  function drawTiled(ctx, img, ox, oy, alpha) {
    if (alpha <= 0.01) return;
    const w = img.width;
    const h = img.height;
    const x = ((ox % w) + w) % w;
    const y = ((oy % h) + h) % h;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(img, x - w, y - h);
    ctx.drawImage(img, x, y - h);
    ctx.drawImage(img, x - w, y);
    ctx.drawImage(img, x, y);
    ctx.globalAlpha = 1;
  }

  // ---- motion ------------------------------------------------------------

  // Rings on the puddles, each reborn somewhere new when it fades.
  function drawRings(ctx, g, t, amount) {
    if (amount <= 0) return;
    const n = Math.min(RINGS, Math.round(RINGS * amount * 0.7));
    ctx.strokeStyle = RAIN;
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const life = t / RING_LIFE + i / n;
      const gen = Math.floor(life);
      const a = life - gen;
      const pick = hash2(i, gen, 5);
      const p = state.puddles[Math.floor(pick * state.puddles.length)];
      const ang = hash2(i, gen, 9) * Math.PI * 2;
      const dist = Math.sqrt(hash2(i, gen, 13)) * 0.7;
      const cx = p.x + Math.cos(ang) * p.rx * dist;
      const cy = p.y + Math.sin(ang) * p.ry * dist;
      const r = 1 + a * g.U * 3.2;
      ctx.globalAlpha = (1 - a) * 0.55;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Now and then someone hurries along the street under a red umbrella.
  function drawWalker(ctx, g, t) {
    const p = (t % WALK_CYCLE) / WALK_TIME;
    if (p >= 1) return;
    const s = g.U * 1.25;
    const px = g.W * 1.04 - p * g.W * 1.1;
    const base = g.H * (STREET + 0.075);
    const step = Math.sin(t * 6) * s * 0.6;
    ctx.fillStyle = '#20222c';
    ctx.fillRect(px - s * 0.7 + step, base - s * 4, s * 0.6, s * 4);
    ctx.fillRect(px + s * 0.1 - step, base - s * 4, s * 0.6, s * 4);
    ctx.fillStyle = '#3c4258';
    ctx.fillRect(px - s, base - s * 8.6, s * 2, s * 4.8);
    ctx.fillStyle = '#5a4636';
    ctx.fillRect(px - s * 0.1, base - s * 12, Math.max(1, s * 0.25), s * 4);
    ctx.fillStyle = '#b8452c';
    ctx.beginPath();
    ctx.moveTo(px - s * 4.2, base - s * 10.6);
    ctx.quadraticCurveTo(px, base - s * 14.8, px + s * 4.2, base - s * 10.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a3426';
    ctx.fillRect(px - s * 4.2, base - s * 10.8, s * 8.4, Math.max(1, s * 0.4));
  }

  function sheetDensity(w) {
    return (x, y) => {
      const u = ((x + y * SLANT) / w) * Math.PI * 2;
      const v = 0.5 + 0.5 * Math.sin(u * 2 + Math.sin(u * 3) * 0.8);
      return smoothstep(0.35, 0.95, v);
    };
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.glows = [];
    const base = layer(g.W, g.H);
    const b = base.getContext('2d');
    const rand = K.rng(41);
    b.fillStyle = HAZE;
    b.fillRect(0, 0, g.W, g.H);
    paintSky(b, g);
    paintPole(b, g);
    paintTown(b, g, rand);
    paintStreet(b, g, rand);
    state.base = base;
    const area = g.W * g.H;
    state.fine = paintRain(g.W, g.H, Math.round(area / 90), [2, 5], () => 1, 0, 3);
    state.heavy = paintRain(g.W, g.H, Math.round(area / 28), [4, 9], sheetDensity(g.W), 0.05, 8);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.base, 0, 0);
    drawRings(ctx, g, t, props.rain);
    if (props.walker) drawWalker(ctx, g, t);
    const fallFine = g.H * 1.1;
    drawTiled(ctx, state.fine, -t * fallFine * SLANT, t * fallFine, 0.26 * props.rain);
    const swell = 0.7 + 0.3 * Math.sin(t * 0.11);
    const fallHeavy = g.H * 1.6;
    const drift = -t * g.W * 0.035;
    drawTiled(ctx, state.heavy, drift - t * fallHeavy * SLANT, t * fallHeavy, 0.3 * props.sheets * swell * Math.min(1, props.rain + 0.3));
  }

  Kasuri.run({
    defaults: { rain: 1, sheets: 1, walker: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
