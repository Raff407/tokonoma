/*
 * 土楼 Tulou — a round rammed-earth house of Fujian among terraced hills.
 *
 * Sky and ridges are one baked layer, the house and paddies another, both
 * repainted once a minute from the clock so windows glow after dark. Between
 * repaints only mist banks and hearth smoke move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const GROUND = 0.6;
  const RETINT_SECONDS = 60;
  const PUFFS = 9;
  const TAU = Math.PI * 2;
  const state = {};

  // Hearth chimneys inside the courtyard, as offsets of the inner radius.
  const HEARTHS = [
    { ox: -0.52, oy: 0.1, seed: 0.0 },
    { ox: 0.0, oy: -0.2, seed: 0.37 },
    { ox: 0.55, oy: 0.14, seed: 0.71 },
  ];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  // Any base colour, lit by the sky and darkened toward night.
  function tone(c, sky, lit = 0.25) {
    const base = mixColor(rgb(c), sky.amb, lit);
    return hex(mixColor(base, rgb('#161a30'), sky.night * 0.72));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * GROUND);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
      const m = S.moonT(sky.hour);
      const mx = g.W * (0.1 + 0.8 * m);
      const my = g.H * (0.2 - 0.12 * Math.sin(Math.PI * m));
      ctx.globalAlpha = sky.night * 0.9;
      ctx.fillStyle = '#e9e5d2';
      ctx.beginPath();
      ctx.arc(mx, my, g.U * 2.4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ---- hills -------------------------------------------------------------

  function ridgeY(g, x, i) {
    const base = [0.32, 0.4, 0.48][i];
    const amp = [0.5, 0.42, 0.36][i];
    return g.H * (base - amp * (fbm(x * (0.012 + i * 0.006), i * 3.3, 4, 40 + i) - 0.5));
  }

  function paintHills(ctx, g, sky, rand) {
    const moss = rgb('#4a6a46');
    for (let i = 0; i < 3; i++) {
      const col = mixColor(mixColor(moss, rgb('#34503a'), i * 0.35), sky.haze, [0.45, 0.25, 0.05][i]);
      const night = mixColor(col, rgb('#161a30'), sky.night * 0.7);
      ctx.fillStyle = hex(night);
      for (let x = 0; x < g.W; x++) {
        const top = ridgeY(g, x, i);
        ctx.fillRect(x, top, 1, g.H * (GROUND + 0.1) - top);
      }
      // Tea terraces and trees as short darker strokes along the slope.
      ctx.fillStyle = hex(mixColor(night, rgb('#1c2c24'), 0.35));
      const n = Math.floor(g.W * (0.5 + i * 0.5));
      for (let k = 0; k < n; k++) {
        const x = rand() * g.W;
        const top = ridgeY(g, x, i);
        const y = top + rand() * (g.H * (GROUND - 0.02) - top) * 0.55;
        ctx.fillRect(x, y, 1 + Math.floor(rand() * 2), 1);
      }
    }
  }

  // ---- earthen drum ------------------------------------------------------

  // One round building: earth wall, eave, tiled ring. Opens onto a courtyard if asked.
  function paintDrum(ctx, g, sky, d) {
    const { cx, cyB, rx, ry, h } = d;
    const cyT = cyB - h;
    const earth = d.earth || '#b0693a';
    // Dirt apron under the wall.
    ctx.fillStyle = tone('#a08a62', sky);
    ctx.beginPath();
    ctx.ellipse(cx, cyB + ry * 0.05, rx * 1.1, ry * 1.18, 0, 0, TAU);
    ctx.fill();
    // Wall body with a lit-left, shaded-right gradient.
    const shade = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
    shade.addColorStop(0, tone(earth, sky, 0.1));
    shade.addColorStop(0.35, tone('#c07c46', sky, 0.3));
    shade.addColorStop(1, tone('#7a4528', sky, 0.1));
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cyT);
    ctx.lineTo(cx - rx, cyB);
    ctx.ellipse(cx, cyB, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, cyT);
    ctx.ellipse(cx, cyT, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    // Rammed strata follow the curve.
    ctx.strokeStyle = tone('#6a3c22', sky, 0.1);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.28;
    const rows = Math.max(3, Math.round(h / (g.U * 1.6)));
    for (let k = 1; k < rows; k++) {
      ctx.beginPath();
      ctx.ellipse(cx, cyT + (h * k) / rows, rx, ry, 0, 0, Math.PI, false);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (d.windows) paintWindows(ctx, g, sky, d);
    if (d.gate) paintGate(ctx, g, sky, d);
    // Shadow under the eave.
    ctx.strokeStyle = tone('#2a1a14', sky, 0.05);
    ctx.lineWidth = Math.max(1, ry * 0.12);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, cyT, rx * 1.01, ry * 1.04, 0, 0.04, Math.PI - 0.04, false);
    ctx.stroke();
    ctx.globalAlpha = 1;
    paintRoof(ctx, g, sky, d);
  }

  function paintRoof(ctx, g, sky, d) {
    const { cx, cyB, rx, ry, h } = d;
    const cyT = cyB - h;
    const inner = d.court ? 0.9 : 0.0;
    // Eave edge, a little wider than the wall.
    ctx.fillStyle = tone('#2e3036', sky, 0.15);
    ctx.beginPath();
    ctx.ellipse(cx, cyT - ry * 0.03, rx * 1.05, ry * 1.07, 0, 0, TAU);
    ctx.fill();
    // Tile rows as concentric rings, alternating tone.
    const steps = d.court ? 6 : 4;
    for (let k = 0; k < steps; k++) {
      const f = lerp(1.04, Math.max(inner, 0.2), k / steps);
      ctx.fillStyle = tone(k % 2 ? '#4a4c52' : '#5c5e62', sky, 0.15);
      ctx.beginPath();
      ctx.ellipse(cx, cyT - ry * 0.03 * (1 - k / steps), rx * f, ry * f, 0, 0, TAU);
      ctx.fill();
    }
    if (!d.court) {
      ctx.fillStyle = tone('#2a2c32', sky, 0.15);
      ctx.beginPath();
      ctx.ellipse(cx, cyT - ry * 0.04, rx * 0.16, ry * 0.16, 0, 0, TAU);
      ctx.fill();
    }
  }

  function paintWindows(ctx, g, sky, d) {
    const { cx, cyB, rx, ry, h } = d;
    const cyT = cyB - h;
    const lit = sky.night;
    const count = d.windows;
    const rowsAt = [0.38, 0.6, 0.82];
    for (let r = 0; r < rowsAt.length; r++) {
      const cy = cyT + h * rowsAt[r];
      const ww = Math.max(1, g.U * (r === 0 ? 0.5 : 0.65));
      const wh = Math.max(1, h * 0.09);
      for (let i = 1; i < count; i++) {
        const th = (i / count) * Math.PI;
        if (r === 2 && Math.abs(th - Math.PI / 2) < 0.28) continue;
        const x = cx + Math.cos(th) * rx;
        const y = cy + Math.sin(th) * ry;
        const w = Math.max(1, ww * Math.sin(th));
        ctx.fillStyle = tone('#2c2018', sky, 0.05);
        ctx.fillRect(x - w / 2, y - wh / 2, w, wh);
        if (lit > 0.05 && ((i * 7 + r * 3) % 5 !== 0)) {
          ctx.globalAlpha = lit * 0.9;
          ctx.fillStyle = '#e0a84a';
          ctx.fillRect(x - w / 2, y - wh / 2, w, wh);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function paintGate(ctx, g, sky, d) {
    const { cx, cyB, rx, ry, h } = d;
    const gy = cyB + ry;
    const gw = Math.max(3, rx * 0.075);
    const gh = h * 0.5;
    ctx.fillStyle = tone('#8a8880', sky, 0.2);
    ctx.fillRect(cx - gw * 0.65, gy - gh - 1, gw * 1.3, gh + 1);
    ctx.fillStyle = tone('#1c1410', sky, 0.0);
    ctx.fillRect(cx - gw / 2, gy - gh + 1, gw, gh - 1);
    ctx.beginPath();
    ctx.arc(cx, gy - gh + 1, gw / 2, Math.PI, 0);
    ctx.fill();
    if (sky.night > 0.05) {
      ctx.globalAlpha = sky.night * 0.7;
      ctx.fillStyle = '#e0a84a';
      ctx.fillRect(cx - gw * 0.2, gy - gh * 0.7, gw * 0.4, gh * 0.7);
      ctx.globalAlpha = 1;
    }
    // Vermilion door strips and two lanterns, with no lettering.
    ctx.fillStyle = tone('#c0432c', sky, 0.15);
    ctx.fillRect(cx - gw * 1.1, gy - gh * 0.95, Math.max(1, gw * 0.18), gh * 0.85);
    ctx.fillRect(cx + gw * 0.92, gy - gh * 0.95, Math.max(1, gw * 0.18), gh * 0.85);
    const lr = Math.max(1, gw * 0.2);
    for (const sx of [-1, 1]) {
      ctx.fillStyle = sky.night > 0.3 ? '#e36a3c' : tone('#c0432c', sky, 0.2);
      ctx.beginPath();
      ctx.arc(cx + sx * gw * 1.55, gy - gh * 0.95, lr, 0, TAU);
      ctx.fill();
    }
  }

  // The open inside: far wall with galleries, stone floor and the small hall.
  function paintCourtyard(ctx, g, sky, d) {
    const { cx, cyB, rx, ry, h } = d;
    const cyT = cyB - h;
    const rxi = rx * 0.9;
    const ryi = ry * 0.9;
    const drop = h * 0.78;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cyT, rxi, ryi, 0, 0, TAU);
    ctx.clip();
    const wall = ctx.createLinearGradient(cx - rxi, 0, cx + rxi, 0);
    wall.addColorStop(0, tone('#8c5430', sky, 0.15));
    wall.addColorStop(0.5, tone('#a06238', sky, 0.25));
    wall.addColorStop(1, tone('#6e4026', sky, 0.1));
    ctx.fillStyle = wall;
    ctx.fillRect(cx - rxi, cyT - ryi, rxi * 2, ryi * 2 + drop);
    // Wooden galleries along the far wall.
    ctx.strokeStyle = tone('#3a2418', sky, 0.1);
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(cx, cyT + (drop * k) / 4, rxi, ryi, 0, Math.PI, TAU, false);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const n = Math.round(rxi * 0.42);
      for (let i = 1; i < n; i++) {
        const th = Math.PI + (i / n) * Math.PI;
        const x = cx + Math.cos(th) * rxi;
        const y = cyT + (drop * (k - 0.5)) / 4 + Math.sin(th) * ryi;
        const w = Math.max(1, g.U * 0.5 * Math.abs(Math.sin(th)));
        ctx.fillStyle = tone('#2c2018', sky, 0.05);
        ctx.fillRect(x - w / 2, y - 1, w, Math.max(1, drop * 0.1));
        if (sky.night > 0.05 && (i * 5 + k) % 4 !== 0) {
          ctx.globalAlpha = sky.night * 0.9;
          ctx.fillStyle = '#e0a84a';
          ctx.fillRect(x - w / 2, y - 1, w, Math.max(1, drop * 0.1));
          ctx.globalAlpha = 1;
        }
      }
    }
    // Floor: the inner ring shifted down by the wall height.
    ctx.fillStyle = tone('#a89a7c', sky, 0.3);
    ctx.beginPath();
    ctx.ellipse(cx, cyT + drop, rxi, ryi, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = tone('#7a6e56', sky, 0.2);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, cyT + drop, rxi * 0.62, ryi * 0.62, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    // Round ancestral hall at the centre of the floor.
    const hall = {
      cx, cyB: cyT + drop + ryi * 0.1, rx: rxi * 0.2, ry: ryi * 0.2, h: h * 0.5,
      earth: '#c8a070', windows: 0, gate: false, court: false,
    };
    paintDrum(ctx, g, sky, Object.assign(hall, { apron: false }));
    state.floorY = cyT + drop;
    state.rxi = rxi;
    state.ryi = ryi;
  }

  // ---- surroundings ------------------------------------------------------

  function paintFields(ctx, g, sky, rand) {
    const n = 9;
    const water = mixColor(mixColor(sky.low, rgb('#2f4a60'), 0.45), rgb('#161a30'), sky.night * 0.5);
    const cols = [
      hex(water),
      tone('#5d7a44', sky, 0.2),
      tone('#8c9a52', sky, 0.2),
      hex(mixColor(water, rgb('#4a6a46'), 0.3)),
      tone('#b0a050', sky, 0.2),
    ];
    for (let k = 0; k < n; k++) {
      const y0 = g.H * (GROUND + 0.4 * Math.pow(k / n, 1.4));
      const y1 = g.H * (GROUND + 0.4 * Math.pow((k + 1) / n, 1.4));
      ctx.fillStyle = cols[(k * 2 + 1) % cols.length];
      for (let x = 0; x < g.W; x++) {
        const wob = Math.sin(x * 0.045 + k * 2.1) * g.U * (0.5 + k * 0.2);
        const a = y0 + wob;
        const b = y1 + Math.sin(x * 0.045 + (k + 1) * 2.1) * g.U * (0.5 + (k + 1) * 0.2);
        ctx.fillRect(x, a, 1, b - a + 1);
      }
      ctx.fillStyle = tone('#3a4a30', sky, 0.1);
      ctx.globalAlpha = 0.5;
      for (let x = 0; x < g.W; x++) ctx.fillRect(x, y0 + Math.sin(x * 0.045 + k * 2.1) * g.U * (0.5 + k * 0.2), 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  function paintBamboo(ctx, g, sky, rand, x0, spread, count) {
    const stalk = tone('#5a7040', sky, 0.15);
    const leaf = tone('#4a6a3c', sky, 0.15);
    for (let i = 0; i < count; i++) {
      const x = x0 + (rand() - 0.5) * spread;
      const base = g.H * (0.78 + rand() * 0.2);
      const top = base - g.H * (0.2 + rand() * 0.16);
      const lean = (rand() - 0.5) * g.U * 3;
      ctx.strokeStyle = stalk;
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + lean * 0.3, (base + top) / 2, x + lean, top);
      ctx.stroke();
      ctx.fillStyle = leaf;
      for (let j = 0; j < 7; j++) {
        const f = 0.55 + rand() * 0.45;
        const px = x + lean * f + (rand() - 0.5) * g.U * 3;
        const py = lerp(base, top, f) + (rand() - 0.5) * g.U;
        ctx.fillRect(px, py, Math.max(2, g.U * 1.6), 1);
      }
    }
  }

  // ---- bake --------------------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintHills(ctx, g, sky, rand);
    return c;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFields(ctx, g, sky, rand);
    // A small house far to the right, then the great one.
    paintDrum(ctx, g, sky, {
      cx: g.W * 0.9, cyB: g.H * 0.63, rx: g.H * 0.09, ry: g.H * 0.028, h: g.H * 0.035,
      earth: '#a8683c', windows: 0, gate: false, court: false,
    });
    const d = {
      cx: g.W * 0.46, cyB: g.H * 0.74, rx: g.H * 0.52, ry: g.H * 0.155, h: g.H * 0.17,
      windows: 34, gate: true, court: true,
    };
    state.drum = d;
    paintDrum(ctx, g, sky, d);
    paintCourtyard(ctx, g, sky, d);
    paintBamboo(ctx, g, sky, rand, g.W * 0.045, g.W * 0.08, 10);
    paintBamboo(ctx, g, sky, rand, g.W * 0.95, g.W * 0.07, 9);
    return c;
  }

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const dens = (x, y) => fbm(x * 0.012, y * 0.08, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 240;
        img.data[i + 2] = 238;
        img.data[i + 3] = smoothstep(0.3, 0.55, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(236,232,224,0.8)');
    grad.addColorStop(1, 'rgba(226,222,214,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    state.back = paintBack(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.mistAlpha = 0.7 - sky.night * 0.45;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const a = Math.min(1, state.mistAlpha * amount);
    const hi = state.mistHigh;
    const lo = state.mistLow;
    ctx.globalAlpha = a * 0.8;
    let off = -((t * g.U * 2.4) % hi.width);
    ctx.drawImage(hi, off, g.H * 0.2);
    ctx.drawImage(hi, off + hi.width, g.H * 0.2);
    ctx.globalAlpha = a * 0.6;
    off = -((t * g.U * 1.4 + hi.width * 0.5) % lo.width);
    ctx.drawImage(lo, off, g.H * 0.4);
    ctx.drawImage(lo, off + lo.width, g.H * 0.4);
    ctx.globalAlpha = 1;
  }

  function drawFootMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mistLow;
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount * 0.4);
    const off = -((t * g.U * 0.8 + 40) % m.width);
    ctx.drawImage(m, off, g.H * 0.8, m.width, g.H * 0.16);
    ctx.drawImage(m, off + m.width, g.H * 0.8, m.width, g.H * 0.16);
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t, amount) {
    if (amount <= 0) return;
    const d = state.drum;
    for (let h = 0; h < HEARTHS.length; h++) {
      const s = HEARTHS[h];
      const x0 = d.cx + s.ox * state.rxi;
      const y0 = state.floorY + s.oy * state.ryi;
      for (let i = 0; i < PUFFS; i++) {
        const a = (t * 0.08 + i / PUFFS + s.seed) % 1;
        const size = g.U * (3 + a * 9);
        const sway = Math.sin(t * 0.5 + i * 1.3 + h * 2) * g.U * 0.9 * a;
        const px = x0 + a * g.U * 7 + sway;
        const py = y0 - a * g.H * 0.3;
        ctx.globalAlpha = Math.min(1, amount) * Math.sin(Math.PI * a) * 0.95 * (1 - state.dim * 0.35);
        ctx.drawImage(state.puff, px - size / 2, py - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.mistHigh = paintMist(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.24), 21);
    state.mistLow = paintMist(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.2), 33);
    state.puff = paintPuff();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, props.mist);
    ctx.drawImage(state.front, 0, 0);
    drawFootMist(ctx, g, t, props.mist);
    drawSmoke(ctx, g, t, props.smoke);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, smoke: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
