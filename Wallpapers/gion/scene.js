/*
 * 祇園 Gion — a narrow Kyoto lane of wooden machiya on a rainy night.
 *
 * The lane is drawn in one-point perspective and baked once: sky, house
 * fronts with lattice windows and indigo curtains, and the wet cobbles with
 * lamplight smeared across them. Between repaints only the red paper
 * lanterns, the rain and a few ripples move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, mixColor, toHex, parseColor } = K;

  const VPY = 0.44;       // eye height as a fraction of the screen
  const SIDE = 0.56;      // half width of the lane at depth 1, in screen widths
  const FAR = 16;         // depth where the lane fades into haze
  const GROUND = 0.56;    // eye above the cobbles
  const EAVE_LOW = 0.14;  // lower eave above the eye
  const EAVE_HIGH = 0.34; // upper eave above the eye
  const RIDGE = 0.48;     // roof ridge above the eye
  const DROPS = 150;
  const RIPPLES = 14;

  const WOOD = '#3a2b24';
  const BENGARA = '#5a2c25';
  const PLASTER = '#4a4e66';
  const TILE = '#171a26';
  const GLOW = '#e2b062';
  const NOREN = '#27386b';
  const BAMBOO = '#8a7650';

  const state = {};
  const hex = toHex;
  const rgb = parseColor;
  const tone = (a, b, t) => hex(mixColor(rgb(a), rgb(b), t));

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(W, H) {
    return { W, H, U: H / 100, vx: W * 0.5, vy: H * VPY, s: W * SIDE };
  }

  // Screen y of a height above the eye at depth z.
  const up = (g, h, z) => g.vy - (g.H * h) / z;
  const down = (g, h, z) => g.vy + (g.H * h) / z;

  // ---- houses --------------------------------------------------------------

  function makeHouses(rand, first) {
    const out = [];
    let z = first;
    const kinds = ['shop', 'noren', 'plain', 'shop', 'noren', 'plain', 'gate'];
    let k = Math.floor(rand() * kinds.length);
    while (z < FAR + 2) {
      const width = 0.9 + z * 0.16 + rand() * 0.5;
      out.push({
        z0: z,
        z1: z + width,
        kind: kinds[k % kinds.length],
        tall: 0.94 + rand() * 0.14,
        wood: rand() < 0.4 ? BENGARA : WOOD,
        inu: rand() < 0.6,
        lit: rand() < 0.65,
      });
      k += 1 + Math.floor(rand() * 2);
      z += width;
    }
    // The nearest two fronts are always lit shops so the lane reads at once.
    out[0].kind = first < 1.1 ? 'shop' : 'noren';
    out[1].kind = first < 1.1 ? 'noren' : 'shop';
    out[0].lit = true;
    out[1].lit = true;
    return out;
  }

  function houseAt(houses, z) {
    for (let i = 0; i < houses.length; i++) if (z >= houses[i].z0 && z < houses[i].z1) return houses[i];
    return houses[houses.length - 1];
  }

  function bar(ctx, x, y0, y1, color, alpha) {
    if (y1 <= y0) return;
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y0, 1, y1 - y0);
    ctx.globalAlpha = 1;
  }

  function paintFloorLow(ctx, g, x, z, h, u, yE, yG, fine) {
    const span = yG - yE;
    bar(ctx, x, yE, yG, h.wood);
    if (fine && ((z * 7) % 1) < 0.18) bar(ctx, x, yE, yG, '#000000', 0.35);
    const inside = u > 0.16 && u < 0.84;
    if (inside && h.kind === 'shop') {
      const y0 = yE + span * 0.2;
      const y1 = yG - span * (h.inu ? 0.2 : 0.08);
      bar(ctx, x, y0, y1, h.lit ? GLOW : tone(GLOW, '#14161f', 0.7));
      if (fine && ((z * 9) % 1) < 0.5) bar(ctx, x, y0, y1, '#150f0d', 0.8);
      bar(ctx, x, y0, y0 + 1, '#150f0d');
    } else if (inside && h.kind === 'noren') {
      const y0 = yE + span * 0.16;
      const y1 = yE + span * 0.58;
      const slit = Math.abs(u - 0.5) < 0.025;
      bar(ctx, x, y1, yG, h.lit ? tone(GLOW, '#14161f', 0.35) : tone(GLOW, '#14161f', 0.75));
      if (!slit) {
        bar(ctx, x, y0, y1, NOREN);
        if (fine && ((z * 5) % 1) < 0.12) bar(ctx, x, y0, y1, '#e8e2d0', 0.35);
      }
      bar(ctx, x, y0 - 1, y0, '#0e0c0c');
    } else if (inside && h.kind === 'gate') {
      if (Math.abs(u - 0.5) < 0.04) bar(ctx, x, yE + span * 0.3, yG, tone(GLOW, '#14161f', 0.55));
    }
    if (h.inu && u > 0.1 && u < 0.9) {
      const top = yG - span * 0.2;
      bar(ctx, x, top, yG, tone(BAMBOO, '#14161f', 0.35));
      if (fine && ((z * 6) % 1) < 0.35) bar(ctx, x, top, yG, '#14161f', 0.55);
    }
  }

  function paintFloorUp(ctx, g, x, z, h, u, yTop, yBot, fine) {
    const span = yBot - yTop;
    bar(ctx, x, yTop, yBot, PLASTER);
    if (u > 0.3 && u < 0.7) {
      const y0 = yTop + span * 0.25;
      const y1 = yTop + span * 0.72;
      bar(ctx, x, y0, y1, h.lit ? tone(GLOW, '#14161f', 0.4) : '#1a1c28');
      if (fine && ((z * 10) % 1) < 0.5) bar(ctx, x, y0, y1, '#150f0d', 0.8);
      bar(ctx, x, y0 - 1, y0, '#0e0c0c');
      bar(ctx, x, y1, y1 + 1, '#0e0c0c');
    }
  }

  function paintColumn(ctx, g, houses, x, z, tall) {
    const h = houseAt(houses, z);
    const u = (z - h.z0) / (h.z1 - h.z0);
    const fine = (z * z) / g.s < 0.05;
    const yG = down(g, GROUND, z);
    const yE1 = up(g, EAVE_LOW, z);
    const roofLow = (g.H * 0.05) / z;
    const yE2 = up(g, EAVE_HIGH * h.tall, z);
    const yR = up(g, RIDGE * h.tall, z);
    paintFloorLow(ctx, g, x, z, h, u, yE1, yG, fine);
    bar(ctx, x, yE1 - roofLow, yE1, TILE);
    bar(ctx, x, yE1 - 1, yE1, '#4a5068', 0.7);
    paintFloorUp(ctx, g, x, z, h, u, yE2, yE1 - roofLow, fine);
    bar(ctx, x, yR, yE2, TILE);
    if (fine && ((z * 12) % 1) < 0.3) bar(ctx, x, yR, yE2, '#2a2f44', 0.8);
    bar(ctx, x, yR, yR + 1, '#59607c', 0.8);
    bar(ctx, x, yE2 - 1, yE2 + 1, '#3c4260', 0.9);
    if (u < 0.025) bar(ctx, x, yR, yG, '#05060a', 0.6);
    bar(ctx, x, yG - 1, yG, '#5a5e70', 0.6);
  }

  function paintSide(ctx, g, sign, houses) {
    const dMin = Math.ceil(g.s / FAR);
    const dMax = Math.ceil(g.vx) + 1;
    for (let d = dMin; d <= dMax; d++) {
      const z = g.s / d;
      paintColumn(ctx, g, houses, sign < 0 ? Math.round(g.vx - d) : Math.round(g.vx + d), z);
    }
  }

  // ---- sky and ground ------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.vy);
    grad.addColorStop(0, '#0f1424');
    grad.addColorStop(1, '#2d3652');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const glow = ctx.createRadialGradient(g.vx, g.vy - g.U * 3, 0, g.vx, g.vy - g.U * 3, g.W * 0.32);
    glow.addColorStop(0, 'rgba(226,176,98,0.5)');
    glow.addColorStop(0.5, 'rgba(180,110,70,0.18)');
    glow.addColorStop(1, 'rgba(180,110,70,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function paintCobbles(ctx, g, rand) {
    const base = ctx.createLinearGradient(0, g.vy, 0, g.H);
    base.addColorStop(0, '#2a2c3c');
    base.addColorStop(1, '#10121a');
    ctx.fillStyle = base;
    ctx.fillRect(0, g.vy, g.W, g.H - g.vy);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#6e7490';
    let z = 1.12;
    let row = 0;
    while (z < FAR) {
      const zn = z + 0.14 + z * 0.1;
      const y0 = down(g, GROUND, z);
      const y1 = down(g, GROUND, zn);
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(g.W, y0);
      for (let k = -4; k <= 4; k++) {
        const wx = (k + (row % 2) * 0.5) * 0.26 + (rand() - 0.5) * 0.03;
        ctx.moveTo(g.vx + (wx * g.s) / z, y0);
        ctx.lineTo(g.vx + (wx * g.s) / zn, y1);
      }
      ctx.stroke();
      z = zn;
      row++;
    }
    ctx.globalAlpha = 1;
  }

  function reflect(ctx, g, x, z, color, strength) {
    const yG = down(g, GROUND, z);
    const len = (g.H * 0.3) / z;
    const half = Math.max(1, (g.H * 0.035) / z);
    const grad = ctx.createLinearGradient(0, yG, 0, yG + len);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = strength;
    ctx.fillStyle = grad;
    ctx.fillRect(x - half, yG, half * 2, len);
    ctx.globalAlpha = 1;
  }

  function paintReflections(ctx, g, houses, sign) {
    for (let i = 0; i < houses.length; i++) {
      const h = houses[i];
      if (!h.lit || h.kind === 'plain' || h.kind === 'gate') continue;
      const z = (h.z0 + h.z1) / 2;
      if (z > FAR) continue;
      reflect(ctx, g, g.vx + (sign * g.s * 0.86) / z, z, '#e2b062', 0.33);
    }
  }

  function paintLaneGlow(ctx, g) {
    const grad = ctx.createLinearGradient(0, g.vy, 0, g.H);
    grad.addColorStop(0, 'rgba(226,176,98,0.28)');
    grad.addColorStop(1, 'rgba(226,176,98,0.03)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(g.vx - g.W * 0.01, g.vy);
    ctx.lineTo(g.vx + g.W * 0.01, g.vy);
    ctx.lineTo(g.vx + g.W * 0.2, g.H);
    ctx.lineTo(g.vx - g.W * 0.2, g.H);
    ctx.fill();
  }

  function paintHaze(ctx, g) {
    const grad = ctx.createRadialGradient(g.vx, g.vy, 0, g.vx, g.vy, g.W * 0.1);
    grad.addColorStop(0, 'rgba(226,190,130,0.5)');
    grad.addColorStop(1, 'rgba(226,190,130,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(g.vx - g.W * 0.1, g.vy - g.W * 0.1, g.W * 0.2, g.W * 0.2);
  }

  // ---- lanterns ------------------------------------------------------------

  function paintLanternSprite() {
    const w = 40;
    const h = 56;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(w / 2 - 1, 0, 2, 4);
    ctx.fillRect(w * 0.28, 4, w * 0.44, 4);
    ctx.fillRect(w * 0.28, h - 8, w * 0.44, 4);
    const body = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.6);
    body.addColorStop(0, '#f0a05a');
    body.addColorStop(0.5, '#d6452c');
    body.addColorStop(1, '#8c2a20');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.46, h * 0.37, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c1a14';
    ctx.lineWidth = 1.2;
    for (let k = -3; k <= 3; k++) {
      const yy = h / 2 + k * 5.6;
      const half = w * 0.46 * Math.sqrt(Math.max(0, 1 - Math.pow((k * 5.6) / (h * 0.37), 2)));
      ctx.beginPath();
      ctx.moveTo(w / 2 - half, yy);
      ctx.lineTo(w / 2 + half, yy);
      ctx.stroke();
    }
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(w / 2 - 1, h - 4, 2, 4);
    return c;
  }

  function paintGlowSprite() {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(240,160,90,0.55)');
    grad.addColorStop(0.45, 'rgba(214,100,60,0.18)');
    grad.addColorStop(1, 'rgba(214,100,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function makeLanterns(g) {
    const specs = [
      [-1, 1.4], [-1, 2.7], [-1, 4.4], [-1, 6.6], [-1, 9.4],
      [1, 1.95], [1, 3.4], [1, 5.3], [1, 7.8], [1, 11],
    ];
    return specs.map((sp, i) => {
      const z = sp[1];
      return {
        x: g.vx + (sp[0] * g.s * 0.9) / z,
        y: up(g, EAVE_LOW, z) + (g.H * 0.01) / z,
        z,
        phase: i * 1.9,
      };
    });
  }

  function paintLanternReflections(ctx, g, lanterns) {
    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      reflect(ctx, g, l.x, l.z, '#d6452c', 0.45);
    }
  }

  function drawLanterns(ctx, g, t, sway) {
    const lanterns = state.lanterns;
    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      const sc = (g.H * 0.17) / (l.z * 56);
      const flicker = 0.85 + Math.sin(t * 1.7 + l.phase) * 0.1;
      const gs = (g.H * 0.3) / l.z;
      ctx.globalAlpha = flicker;
      ctx.drawImage(state.glow, l.x - gs / 2, l.y + (g.H * 0.07) / l.z - gs / 2, gs, gs);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(Math.sin(t * 1.2 + l.phase) * 0.09 * sway);
      ctx.scale(sc, sc);
      ctx.drawImage(state.lantern, -20, 0);
      ctx.restore();
    }
  }

  // ---- rain ----------------------------------------------------------------

  function makeRain(g, rand) {
    const drops = [];
    for (let i = 0; i < DROPS; i++) {
      drops.push({ x: rand() * (g.W + g.H * 0.2), y: rand() * g.H, v: 0.9 + rand() * 0.7, len: 0.6 + rand() * 0.8 });
    }
    return drops;
  }

  function drawRain(ctx, g, t, amount) {
    const n = Math.floor(DROPS * Math.min(1, amount));
    const fall = g.H * 0.9;
    ctx.strokeStyle = '#b9c2dc';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3 * Math.min(1, 0.4 + amount);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const d = state.rain[i];
      const y = (d.y + t * fall * d.v) % (g.H * 1.1);
      const x = d.x - y * 0.12 - g.H * 0.1;
      ctx.moveTo(x, y);
      ctx.lineTo(x - g.U * 0.5 * d.len, y + g.U * 3.2 * d.len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function makeRipples(g, rand) {
    const out = [];
    for (let i = 0; i < RIPPLES; i++) {
      const z = 1.3 + rand() * 4;
      out.push({ z, x: (rand() - 0.5) * 1.6, rate: 0.35 + rand() * 0.3, off: rand() * 5 });
    }
    return out;
  }

  function drawRipples(ctx, g, t, amount) {
    const n = Math.ceil(RIPPLES * Math.min(1, amount));
    ctx.strokeStyle = '#aab4d4';
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const r = state.ripples[i];
      const p = (t * r.rate + r.off) % 1;
      const rad = (p * g.H * 0.05) / r.z + 0.5;
      ctx.globalAlpha = (1 - p) * 0.4;
      ctx.beginPath();
      ctx.ellipse(g.vx + (r.x * g.s) / r.z, down(g, GROUND, r.z), rad * 2.4, rad * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- bake ----------------------------------------------------------------

  function bake(g, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(seed + 11);
    paintSky(ctx, g);
    paintCobbles(ctx, g, rand);
    paintLaneGlow(ctx, g);
    const left = makeHouses(rand, 1.05);
    const right = makeHouses(rand, 1.2);
    paintSide(ctx, g, -1, left);
    paintSide(ctx, g, 1, right);
    paintHaze(ctx, g);
    paintReflections(ctx, g, left, -1);
    paintReflections(ctx, g, right, 1);
    state.lanterns = makeLanterns(g);
    paintLanternReflections(ctx, g, state.lanterns);
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api.cols, api.rows);
    state.g = g;
    state.lantern = paintLanternSprite();
    state.glow = paintGlowSprite();
    const rand = K.rng(api.seed + 3);
    state.rain = makeRain(g, rand);
    state.ripples = makeRipples(g, rand);
    state.base = bake(g, api.seed);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, sway } = api.props;
    ctx.drawImage(state.base, 0, 0);
    drawRipples(ctx, g, t, rain);
    drawLanterns(ctx, g, t, sway);
    drawRain(ctx, g, t, rain);
  }

  Kasuri.run({
    defaults: { rain: 1, sway: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
