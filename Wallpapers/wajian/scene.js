/*
 * 瓦当 Wajian — a row of round eave tile ends on a grey roof in steady rain.
 *
 * Roof, tile ends, drip tiles, the red beam and the wet courtyard are baked once.
 * Rain is a short pool of slanted strokes, drips fall from the drip tile points,
 * and rings open on the puddles and where the drips land.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const RAIN_MAX = 100;
  const RING_MAX = 28;
  const DRIP_MAX = 16;
  const SLANT = 0.1;
  const KINDS = 4;
  const state = {};

  const INK = {
    sky: ['#5d676a', '#6c7679', '#7d8688'],
    pan: '#40494c',
    panLit: '#566164',
    cyl: '#69746f',
    cylLit: '#929d96',
    cylDark: '#2a3234',
    seam: '#242b2d',
    disc: '#67726f',
    discLit: '#a3ada4',
    discDark: '#222a2b',
    moss: '#56664a',
    beam: '#7b3226',
    beamDark: '#552219',
    gold: '#b9953f',
    shadow: '#1b2123',
    ground: '#2d3536',
    slab: '#3d4747',
    water: '#6d7b7f',
    waterLit: '#93a0a2',
  };

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
    const gap = Math.max(U * 22, Math.min(W / 5.5, U * 34));
    const r = gap * 0.43;
    const n = Math.ceil(W / gap) + 2;
    const x0 = W / 2 - (n / 2) * gap + gap / 2;
    const ey = H * 0.54;
    const lift = H * 0.07;
    return { W, H, U, gap, r, n, x0, ey, lift, beamH: H * 0.075, ground: H * 0.8 };
  }

  function eaveY(g, x) {
    const d = (x - g.W / 2) / (g.W / 2);
    return g.ey - g.lift * d * d;
  }

  // ---- the roof ------------------------------------------------------------

  function paintRoofField(ctx, g) {
    ctx.fillStyle = INK.pan;
    ctx.fillRect(0, 0, g.W, g.H);
    const hi = g.U * 4.2;
    for (let i = 0; i < g.n; i++) {
      const xm = g.x0 + (i + 0.5) * g.gap;
      ctx.fillStyle = INK.panLit;
      ctx.fillRect(xm - g.gap * 0.24, 0, g.gap * 0.48, g.H * 0.7);
      ctx.fillStyle = INK.seam;
      for (let y = hi * 0.3; y < g.H * 0.7; y += hi) ctx.fillRect(xm - g.gap * 0.26, y, g.gap * 0.52, Math.max(1, g.U * 0.35));
    }
  }

  function paintCylinders(ctx, g, rand) {
    const w = g.gap * 0.36;
    const hi = g.U * 6;
    for (let i = 0; i < g.n; i++) {
      const x = g.x0 + i * g.gap;
      const ye = eaveY(g, x);
      ctx.fillStyle = INK.cylDark;
      ctx.fillRect(x - w / 2 - 1, 0, w + 2, ye);
      ctx.fillStyle = INK.cyl;
      ctx.fillRect(x - w / 2 + 1, 0, w - 2, ye);
      ctx.fillStyle = INK.cylLit;
      ctx.fillRect(x - w * 0.28, 0, w * 0.2, ye);
      ctx.fillStyle = INK.seam;
      for (let y = hi * 0.5 + rand() * hi * 0.2; y < ye - g.r * 0.5; y += hi) ctx.fillRect(x - w / 2 - 1, y, w + 2, Math.max(1, g.U * 0.5));
      if (rand() < 0.3) {
        ctx.fillStyle = INK.moss;
        for (let k = 0; k < 3; k++) blob(ctx, x - w * 0.3 + rand() * w * 0.6, ye * (0.55 + rand() * 0.3), g.U * (0.8 + rand() * 1.2), g.U * 0.5);
      }
    }
  }

  // ---- tile end patterns ---------------------------------------------------

  function petals(ctx, r, count, inner, outer, ink) {
    ctx.fillStyle = ink;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -r * inner);
      ctx.quadraticCurveTo(r * 0.2, -r * (inner + outer) * 0.55, 0, -r * outer);
      ctx.quadraticCurveTo(-r * 0.2, -r * (inner + outer) * 0.55, 0, -r * inner);
      ctx.fill();
      ctx.restore();
    }
  }

  function cloud(ctx, r, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * TAU);
      ctx.beginPath();
      ctx.moveTo(r * 0.14, 0);
      ctx.bezierCurveTo(r * 0.15, -r * 0.5, r * 0.62, -r * 0.5, r * 0.62, -r * 0.18);
      ctx.bezierCurveTo(r * 0.62, r * 0.06, r * 0.36, r * 0.08, r * 0.38, -r * 0.1);
      ctx.stroke();
      ctx.restore();
    }
  }

  function rays(ctx, r, ink) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate((i / 12) * TAU);
      ctx.fillRect(-r * 0.05, -r * 0.72, r * 0.1, r * 0.38);
      ctx.restore();
    }
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.76, 0, TAU);
    ctx.stroke();
  }

  function diamonds(ctx, r, ink) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * TAU);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.3);
      ctx.lineTo(r * 0.2, -r * 0.5);
      ctx.lineTo(0, -r * 0.74);
      ctx.lineTo(-r * 0.2, -r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    petals(ctx, r, 4, 0.2, 0.5, ink);
  }

  function disc(ctx, g, x, y, kind, rand) {
    const r = g.r;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = INK.shadow;
    blob(ctx, 0, r * 0.12, r * 1.08, r * 1.08);
    ctx.fillStyle = INK.discDark;
    blob(ctx, 0, 0, r, r);
    ctx.fillStyle = INK.disc;
    blob(ctx, -r * 0.03, -r * 0.03, r * 0.92, r * 0.92);
    ctx.fillStyle = INK.discLit;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, Math.PI * 1.1, Math.PI * 1.65);
    ctx.arc(0, 0, r * 0.84, Math.PI * 1.65, Math.PI * 1.1, true);
    ctx.fill();
    ctx.strokeStyle = INK.discDark;
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, TAU);
    ctx.stroke();
    const carve = INK.discDark;
    if (kind === 0) {
      petals(ctx, r, 8, 0.28, 0.76, carve);
      petals(ctx, r, 8, 0.3, 0.6, INK.disc);
    } else if (kind === 1) cloud(ctx, r, carve);
    else if (kind === 2) rays(ctx, r, carve);
    else diamonds(ctx, r, carve);
    ctx.fillStyle = INK.discLit;
    blob(ctx, 0, 0, r * 0.2, r * 0.2);
    ctx.fillStyle = INK.discDark;
    blob(ctx, r * 0.03, r * 0.03, r * 0.1, r * 0.1);
    if (rand() < 0.35) {
      ctx.fillStyle = INK.moss;
      blob(ctx, -r * 0.5, r * 0.55, r * 0.28, r * 0.12);
    }
    ctx.restore();
  }

  // The pointed drip tile under each pan tile.
  function dripTile(ctx, g, x, y) {
    const w = g.gap * 0.22;
    ctx.fillStyle = INK.discDark;
    poly(ctx, [x - w, y - g.r * 0.5, x + w, y - g.r * 0.5, x + w * 0.9, y + g.r * 0.15, x, y + g.r * 0.62, x - w * 0.9, y + g.r * 0.15]);
    ctx.fillStyle = INK.cyl;
    poly(ctx, [x - w * 0.7, y - g.r * 0.46, x + w * 0.7, y - g.r * 0.46, x + w * 0.62, y + g.r * 0.1, x, y + g.r * 0.46, x - w * 0.62, y + g.r * 0.1]);
    ctx.fillStyle = INK.cylLit;
    ctx.fillRect(x - w * 0.12, y - g.r * 0.42, w * 0.24, g.r * 0.6);
  }

  // ---- beam, shadow and courtyard ------------------------------------------

  function paintBeam(ctx, g) {
    const top = [];
    const bot = [];
    const dark = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * g.W;
      const y = eaveY(g, x) + g.r * 1.15;
      top.push(x, y);
      bot.push(x, y + g.beamH);
    }
    ctx.fillStyle = INK.shadow;
    poly(ctx, top.concat([g.W, g.ground, 0, g.ground]));
    const band = (pts, off, ink) => {
      const poly2 = [];
      for (let i = 0; i < pts.length; i += 2) poly2.push(pts[i], pts[i + 1] + off);
      return { poly2, ink };
    };
    ctx.fillStyle = INK.beamDark;
    const upper = top.concat([]);
    const lower = [];
    for (let i = bot.length - 2; i >= 0; i -= 2) lower.push(bot[i], bot[i + 1]);
    poly(ctx, upper.concat(lower));
    ctx.fillStyle = INK.beam;
    const a = band(top, g.U * 0.5, INK.beam).poly2;
    const b = [];
    for (let i = bot.length - 2; i >= 0; i -= 2) b.push(bot[i], bot[i + 1] - g.U * 1.4);
    poly(ctx, a.concat(b));
    ctx.fillStyle = INK.gold;
    for (let i = 0; i < g.n; i++) {
      const x = g.x0 + (i + 0.5) * g.gap;
      blob(ctx, x, eaveY(g, x) + g.r * 1.15 + g.beamH * 0.48, g.U * 0.9, g.U * 0.9);
    }
    dark.length = 0;
  }

  function makePuddles(g, rand) {
    const out = [];
    const rows = 3;
    for (let j = 0; j < rows; j++) {
      const y = lerp(g.ground + g.H * 0.05, g.H - g.H * 0.04, (j + 0.5) / rows);
      const count = 2 + (j % 2);
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.3 + rand() * 0.4 + j * 0.2) / count) * g.W;
        out.push([x % g.W, y, g.W * (0.07 + rand() * 0.06 + j * 0.02), g.H * (0.018 + j * 0.008)]);
      }
    }
    return out;
  }

  function paintGround(ctx, g, rand, puddles) {
    ctx.fillStyle = INK.ground;
    ctx.fillRect(0, g.ground, g.W, g.H - g.ground);
    ctx.fillStyle = INK.shadow;
    ctx.fillRect(0, g.ground, g.W, Math.max(1, g.U * 0.8));
    ctx.fillStyle = INK.slab;
    const rowH = g.U * 4.5;
    for (let y = g.ground + g.U * 1.5, row = 0; y < g.H; y += rowH * (1 + row * 0.25), row++) {
      ctx.fillRect(0, y, g.W, Math.max(1, g.U * 0.4));
      for (let x = (row % 2) * g.U * 7; x < g.W; x += g.U * (14 + row * 3)) ctx.fillRect(x, y, Math.max(1, g.U * 0.4), rowH * 1.2);
    }
    for (const p of puddles) {
      ctx.fillStyle = INK.water;
      blob(ctx, p[0], p[1], p[2], p[3]);
      ctx.fillStyle = INK.waterLit;
      blob(ctx, p[0] - p[2] * 0.15, p[1] - p[3] * 0.25, p[2] * 0.6, p[3] * 0.35);
    }
  }

  function paintBack(g, rand, puddles) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRoofField(ctx, g);
    paintCylinders(ctx, g, rand);
    for (let i = 0; i < g.n; i++) {
      const xm = g.x0 + (i + 0.5) * g.gap;
      dripTile(ctx, g, xm, eaveY(g, xm) + g.r * 0.5);
    }
    paintBeam(ctx, g);
    for (let i = 0; i < g.n; i++) {
      const x = g.x0 + i * g.gap;
      disc(ctx, g, x, eaveY(g, x), (i + (i >> 2)) % KINDS, rand);
    }
    paintGround(ctx, g, rand, puddles);
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.3);
    grad.addColorStop(0, 'rgba(160,170,170,0.35)');
    grad.addColorStop(1, 'rgba(160,170,170,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * 0.3);
    return c;
  }

  // ---- motion --------------------------------------------------------------

  function makeRain(g, rand) {
    const rain = { x: new Float32Array(RAIN_MAX), y: new Float32Array(RAIN_MAX), v: new Float32Array(RAIN_MAX) };
    for (let i = 0; i < RAIN_MAX; i++) {
      rain.x[i] = rand() * (g.W + g.H * 0.3);
      rain.y[i] = rand() * g.H;
      rain.v[i] = 0.9 + rand() * 0.5;
    }
    return rain;
  }

  function makeDrips(g, rand) {
    const n = Math.min(DRIP_MAX, g.n);
    const dr = { n, x: new Float32Array(n), y0: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), wait: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const xm = g.x0 + (i + 0.5) * g.gap;
      dr.x[i] = xm;
      dr.y0[i] = eaveY(g, xm) + g.r * 1.05;
      dr.y[i] = dr.y0[i];
      dr.wait[i] = rand() * 1.6;
    }
    return dr;
  }

  function makeRings() {
    return { x: new Float32Array(RING_MAX), y: new Float32Array(RING_MAX), age: new Float32Array(RING_MAX).fill(2), life: new Float32Array(RING_MAX), size: new Float32Array(RING_MAX), next: 0 };
  }

  function spawnRing(R, x, y, size, life) {
    const i = R.next;
    R.next = (i + 1) % RING_MAX;
    R.x[i] = x;
    R.y[i] = y;
    R.size[i] = size;
    R.life[i] = life;
    R.age[i] = 0;
  }

  function drawRain(ctx, g, dt, amount) {
    const R = state.rain;
    const count = Math.min(RAIN_MAX, Math.round(70 * amount));
    const len = g.U * 5;
    const fall = g.H * 1.5;
    ctx.strokeStyle = 'rgba(214,220,218,0.45)';
    ctx.lineWidth = Math.max(0.8, g.U * 0.3);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      R.y[i] += fall * R.v[i] * dt;
      R.x[i] -= fall * R.v[i] * dt * SLANT;
      if (R.y[i] > g.H + len) {
        R.y[i] = -len;
        R.x[i] = state.rand() * (g.W + g.H * 0.3);
      }
      ctx.moveTo(R.x[i], R.y[i]);
      ctx.lineTo(R.x[i] + len * SLANT, R.y[i] - len);
    }
    ctx.stroke();
  }

  function drawDrips(ctx, g, dt, amount) {
    const D = state.drips;
    const count = Math.min(D.n, Math.round(D.n * amount * 0.8));
    ctx.fillStyle = 'rgba(224,230,228,0.85)';
    for (let i = 0; i < count; i++) {
      if (D.wait[i] > 0) {
        D.wait[i] -= dt;
        continue;
      }
      D.v[i] += g.H * 2.2 * dt;
      D.y[i] += D.v[i] * dt;
      const land = g.ground + g.H * 0.04 + (i % 3) * g.H * 0.05;
      if (D.y[i] >= land) {
        spawnRing(state.rings, D.x[i], land, g.U * 1.6, 0.9);
        D.y[i] = D.y0[i];
        D.v[i] = 0;
        D.wait[i] = 0.2 + state.rand() * 1.2;
        continue;
      }
      ctx.fillRect(D.x[i] - 0.5, D.y[i], Math.max(1, g.U * 0.4), g.U * 1.8);
    }
  }

  function drawRings(ctx, g, dt, amount) {
    const R = state.rings;
    ctx.lineWidth = Math.max(0.8, g.U * 0.3);
    for (let i = 0; i < RING_MAX; i++) {
      if (R.age[i] >= 1) continue;
      R.age[i] += dt / R.life[i];
      const a = R.age[i];
      if (a >= 1) continue;
      const rx = R.size[i] * (0.3 + a * 2.2);
      ctx.strokeStyle = 'rgba(224,230,228,' + (0.75 * (1 - a)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(R.x[i], R.y[i], rx, rx * 0.35, 0, 0, TAU);
      ctx.stroke();
    }
    state.ringTimer -= dt;
    if (state.ringTimer <= 0 && amount > 0) {
      const p = state.puddles[Math.floor(state.rand() * state.puddles.length)];
      spawnRing(R, p[0] + (state.rand() - 0.5) * p[2] * 1.4, p[1] + (state.rand() - 0.5) * p[3] * 1.2, g.U * (1.2 + state.rand() * 1.4), 1.1 + state.rand() * 0.8);
      state.ringTimer = (0.12 + state.rand() * 0.25) / amount;
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.puddles = makePuddles(g, rand);
    state.back = paintBack(g, rand, state.puddles);
    state.rain = makeRain(g, rand);
    state.drips = makeDrips(g, rand);
    state.rings = makeRings();
    state.ringTimer = 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, drips, rings } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    drawRings(ctx, g, step, rings);
    drawDrips(ctx, g, step, drips);
    drawRain(ctx, g, step, rain);
  }

  Kasuri.run({
    defaults: { rain: 1, drips: 1, rings: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
