/*
 * 東大寺 Todaiji — the great timber hall of a Nara temple at dusk.
 *
 * Sky and hills, the hall and the foreground (pines, path, lanterns) are baked
 * once. Per frame: two mist strips slide, stone lanterns light one after another
 * and fade together before the cycle starts again, and three crows cross.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const CX = 0.5;
  const GROUND = 0.745;
  const PAIRS = 5;
  const CYCLE = 72;
  const FIRST = 3;
  const GAP = 2.4;
  const FADE_OUT = [64, 70];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, U: H / 100, cx: W * CX, gy: H * GROUND };
  }

  // ---- sky and hills -------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.gy);
    grad.addColorStop(0, '#2a3260');
    grad.addColorStop(0.35, '#4a4a7a');
    grad.addColorStop(0.6, '#9a6a78');
    grad.addColorStop(0.82, '#d68e60');
    grad.addColorStop(1, '#e8b870');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e8e2d0';
    for (let i = 0; i < g.W * 0.35; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.28, 1, 1);
    }
    ctx.globalAlpha = 1;
    // Pale moon with a soft halo.
    const mx = g.W * 0.8;
    const my = g.H * 0.14;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 11);
    halo.addColorStop(0, 'rgba(232,226,208,0.35)');
    halo.addColorStop(1, 'rgba(232,226,208,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.U * 11, my - g.U * 11, g.U * 22, g.U * 22);
    ctx.fillStyle = '#e6e0cc';
    ctx.beginPath();
    ctx.arc(mx, my, g.U * 2.6, 0, 6.3);
    ctx.fill();
    // Afterglow behind the hall.
    const glow = ctx.createRadialGradient(g.cx, g.gy, 0, g.cx, g.gy, g.W * 0.5);
    glow.addColorStop(0, 'rgba(226,170,96,0.4)');
    glow.addColorStop(1, 'rgba(226,170,96,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.gy);
    paintHills(ctx, g);
    return c;
  }

  function ridgeLine(ctx, g, base, amp, seed, freq, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.gy + 2);
    for (let x = 0; x <= g.W; x += 2) {
      ctx.lineTo(x, base - amp * fbm(x * freq, 3, 3, seed));
    }
    ctx.lineTo(g.W, g.gy + 2);
    ctx.fill();
  }

  function paintHills(ctx, g) {
    ridgeLine(ctx, g, g.H * 0.64, g.H * 0.16, 7, 0.011, '#4a4466');
    ridgeLine(ctx, g, g.H * 0.68, g.H * 0.1, 19, 0.016, '#38395a');
    // Wakakusa-yama: one smooth, rounded mound.
    const hx = g.W * 0.86;
    const grad = ctx.createLinearGradient(0, g.H * 0.5, 0, g.gy);
    grad.addColorStop(0, '#4c5262');
    grad.addColorStop(1, '#2c3450');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.58, g.gy + 2);
    ctx.bezierCurveTo(g.W * 0.7, g.H * 0.6, g.W * 0.76, g.H * 0.5, hx, g.H * 0.5);
    ctx.bezierCurveTo(g.W * 0.98, g.H * 0.5, g.W * 1.02, g.H * 0.62, g.W * 1.05, g.gy + 2);
    ctx.fill();
  }

  // ---- the hall ------------------------------------------------------------

  // A hip roof seen from the front: flat ridge, curved sides, eaves that lift at the corners.
  function roofPath(ctx, cx, topHalf, eaveHalf, yTop, yEave, tip, thick) {
    const dy = yEave - yTop;
    const sag = thick * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - topHalf, yTop);
    ctx.lineTo(cx + topHalf, yTop);
    ctx.quadraticCurveTo(cx + topHalf + (eaveHalf - topHalf) * 0.2, yEave + dy * 0.04, cx + eaveHalf, yEave - tip);
    ctx.lineTo(cx + eaveHalf, yEave - tip + thick);
    ctx.quadraticCurveTo(cx, yEave + thick + sag, cx - eaveHalf, yEave - tip + thick);
    ctx.lineTo(cx - eaveHalf, yEave - tip);
    ctx.quadraticCurveTo(cx - topHalf - (eaveHalf - topHalf) * 0.2, yEave + dy * 0.04, cx - topHalf, yTop);
    ctx.closePath();
  }

  function paintRoof(ctx, g, topHalf, eaveHalf, yTop, yEave, tip, thick) {
    const cx = g.cx;
    roofPath(ctx, cx, topHalf, eaveHalf, yTop, yEave, tip, thick);
    const grad = ctx.createLinearGradient(0, yTop, 0, yEave + thick);
    grad.addColorStop(0, '#4d4a5e');
    grad.addColorStop(0.5, '#2b2d42');
    grad.addColorStop(1, '#1b1d2e');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(120,112,140,0.35)';
    const step = Math.max(2, g.U * 0.85);
    for (let x = cx - eaveHalf; x < cx + eaveHalf; x += step) ctx.fillRect(x, yTop, 1, yEave - yTop + thick);
    ctx.fillStyle = 'rgba(214,164,99,0.35)';
    ctx.fillRect(cx - topHalf, yTop, topHalf * 2, 1);
    ctx.fillStyle = '#12141f';
    ctx.fillRect(cx - eaveHalf, yEave + thick * 0.35, eaveHalf * 2, thick);
    ctx.restore();
  }

  function paintRidgeEnds(ctx, g, half, y) {
    ctx.fillStyle = '#b08a4c';
    const w = Math.max(2, g.U * 1.3);
    const h = Math.max(3, g.U * 3.6);
    for (const dir of [-1, 1]) {
      const x = g.cx + dir * half;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y + 1);
      ctx.lineTo(x - w * 0.5, y - h * 0.6);
      ctx.quadraticCurveTo(x - w * 0.5 + dir * w, y - h, x + dir * w * 0.9, y - h * 0.75);
      ctx.lineTo(x + w * 0.5, y - h * 0.3);
      ctx.lineTo(x + w * 0.5, y + 1);
      ctx.fill();
    }
  }

  function paintWalls(ctx, g, rand) {
    const cx = g.cx;
    // Upper storey: dark timber with a few pale plaster panels.
    const uy = g.H * 0.462;
    const uh = g.H * 0.05;
    ctx.fillStyle = '#26273a';
    ctx.fillRect(cx - g.W * 0.25, uy, g.W * 0.5, uh);
    ctx.fillStyle = '#6a3a34';
    const bay = g.W * 0.0625;
    for (let i = -4; i <= 4; i++) ctx.fillRect(cx + i * bay - 1, uy, Math.max(1, g.U * 0.5), uh);
    ctx.fillStyle = '#8c8470';
    for (let i = -3; i <= 3; i++) ctx.fillRect(cx + i * bay + 2, uy + uh * 0.2, bay - 5, uh * 0.55);
    // Main storey: plaster, vermilion pillars, three dark doorways.
    const my = g.H * 0.612;
    const mh = g.gy - my - g.H * 0.04;
    const half = g.W * 0.33;
    ctx.fillStyle = '#8c8470';
    ctx.fillRect(cx - half, my, half * 2, mh);
    ctx.fillStyle = '#24253a';
    ctx.fillRect(cx - bay * 1.5, my, bay * 3, mh);
    state.door = { x: cx - bay * 1.5, y: my, w: bay * 3, h: mh };
    ctx.fillStyle = '#9a3d2c';
    const pw = Math.max(1, g.U * 0.7);
    for (let i = -4; i <= 4; i++) ctx.fillRect(cx + i * (half / 4) - pw / 2, my, pw, mh);
    ctx.fillRect(cx - half, my, half * 2, Math.max(1, g.U * 0.7));
    ctx.fillRect(cx - half, my + mh - Math.max(1, g.U * 0.6), half * 2, Math.max(1, g.U * 0.6));
    // Lattice on the side bays.
    ctx.fillStyle = 'rgba(40,38,56,0.55)';
    for (const dir of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const x0 = cx + dir * (bay * 1.5 + k * (half - bay * 1.5) / 6);
        ctx.fillRect(Math.min(x0, x0 + dir * 1), my + mh * 0.2, 1, mh * 0.65);
      }
    }
    rand();
  }

  function paintPlatform(ctx, g) {
    const cx = g.cx;
    const top = g.gy - g.H * 0.045;
    ctx.fillStyle = '#5c5a66';
    ctx.fillRect(cx - g.W * 0.38, top, g.W * 0.76, g.H * 0.05);
    ctx.fillStyle = '#7a7684';
    ctx.fillRect(cx - g.W * 0.38, top, g.W * 0.76, Math.max(1, g.U * 0.7));
    ctx.fillStyle = '#3c3b4a';
    for (let x = cx - g.W * 0.38; x < cx + g.W * 0.38; x += g.U * 3.2) ctx.fillRect(x, top + g.U * 1.2, 1, g.H * 0.04);
    // Steps up the middle.
    for (let k = 0; k < 4; k++) {
      const y = g.gy + g.U * (0.6 + k * 1.5);
      const half = g.W * (0.07 + k * 0.006);
      ctx.fillStyle = k % 2 ? '#6a6674' : '#807c8a';
      ctx.fillRect(cx - half, y, half * 2, g.U * 1.5);
    }
  }

  function paintHall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const t1 = g.U * 0.9;
    paintWalls(ctx, g, rand);
    paintRoof(ctx, g, g.W * 0.31, g.W * 0.385, g.H * 0.505, g.H * 0.587, g.H * 0.02, g.U * 2.2);
    paintRoof(ctx, g, g.W * 0.145, g.W * 0.31, g.H * 0.3, g.H * 0.45, g.H * 0.024, g.U * 2.6);
    paintRidgeEnds(ctx, g, g.W * 0.145, g.H * 0.3);
    paintPlatform(ctx, g);
    ctx.fillStyle = '#12141f';
    ctx.fillRect(g.cx - g.W * 0.385, g.H * 0.612 - t1, g.W * 0.77, 1);
    return c;
  }

  // ---- foreground ----------------------------------------------------------

  function pine(ctx, g, x, base, h, lean, rand) {
    ctx.strokeStyle = '#1a1a26';
    ctx.lineWidth = Math.max(2, h * 0.035);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.bezierCurveTo(x + lean * 0.2, base - h * 0.35, x - lean * 0.5, base - h * 0.55, x + lean, base - h);
    ctx.stroke();
    const tiers = [[0.38, 1.0, -1], [0.55, 0.85, 1], [0.7, 0.7, -1], [0.86, 0.55, 1], [1.0, 0.4, 0]];
    for (const [f, sz, dir] of tiers) {
      const tx = x + lean * f * f + dir * h * 0.12 * sz;
      const ty = base - h * f;
      for (let i = 0; i < 7; i++) {
        const ox = (rand() - 0.5) * h * 0.34 * sz;
        const oy = (rand() - 0.5) * h * 0.05;
        ctx.fillStyle = i % 3 === 0 ? '#2c3a3a' : '#1c2630';
        ctx.beginPath();
        ctx.ellipse(tx + ox, ty + oy, h * 0.1 * sz, h * 0.032 * sz, 0, 0, 6.3);
        ctx.fill();
      }
    }
  }

  function lanternShape(ctx, x, y, s) {
    const stone = '#4c4e5c';
    const lit = '#767486';
    ctx.fillStyle = stone;
    ctx.fillRect(x - s * 1.1, y - s * 0.8, s * 2.2, s * 0.8);
    ctx.fillRect(x - s * 0.4, y - s * 3.8, s * 0.8, s * 3.0);
    ctx.fillRect(x - s * 1.2, y - s * 4.2, s * 2.4, s * 0.45);
    ctx.fillStyle = '#32333f';
    ctx.fillRect(x - s * 0.8, y - s * 5.9, s * 1.6, s * 1.7);
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(x - s * 1.8, y - s * 5.9);
    ctx.lineTo(x + s * 1.8, y - s * 5.9);
    ctx.lineTo(x + s * 0.7, y - s * 6.9);
    ctx.lineTo(x - s * 0.7, y - s * 6.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - s * 0.25, y - s * 7.5, s * 0.5, s * 0.7);
    ctx.fillStyle = lit;
    ctx.fillRect(x - s * 1.8, y - s * 5.95, s * 3.6, Math.max(1, s * 0.2));
    ctx.fillRect(x - s * 1.1, y - s * 0.8, s * 2.2, Math.max(1, s * 0.2));
  }

  function makeLanterns(g) {
    const list = [];
    for (let i = 0; i < PAIRS; i++) {
      const d = i / (PAIRS - 1);
      const y = g.H * (0.8 + 0.17 * Math.pow(d, 1.3));
      const s = g.U * (0.55 + 1.9 * d);
      const off = g.W * (0.1 + 0.3 * d);
      list.push({ x: g.cx - off, y, s, k: i * 2 });
      list.push({ x: g.cx + off, y, s, k: i * 2 + 1 });
    }
    return list;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.gy, 0, g.H);
    grad.addColorStop(0, '#2a2c3a');
    grad.addColorStop(1, '#14161f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.gy, g.W, g.H - g.gy);
    // Gravel approach, widening toward the viewer.
    ctx.fillStyle = '#5a5866';
    ctx.beginPath();
    ctx.moveTo(g.cx - g.W * 0.075, g.gy + g.U * 6);
    ctx.lineTo(g.cx + g.W * 0.075, g.gy + g.U * 6);
    ctx.lineTo(g.cx + g.W * 0.2, g.H);
    ctx.lineTo(g.cx - g.W * 0.2, g.H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(30,30,44,0.4)';
    for (let i = 0; i < g.W * 1.2; i++) {
      const y = g.gy + g.U * 7 + rand() * (g.H - g.gy - g.U * 7);
      const half = lerp(g.W * 0.075, g.W * 0.2, (y - g.gy) / (g.H - g.gy));
      ctx.fillRect(g.cx + (rand() * 2 - 1) * half, y, 1, 1);
    }
    for (const L of state.lanterns) lanternShape(ctx, L.x, L.y, L.s);
    pine(ctx, g, g.W * 0.07, g.H * 0.99, g.H * 0.78, g.W * 0.06, rand);
    pine(ctx, g, g.W * 0.94, g.H * 0.99, g.H * 0.7, -g.W * 0.05, rand);
    pine(ctx, g, g.W * 0.2, g.gy + g.U * 2, g.H * 0.3, g.W * 0.02, rand);
    pine(ctx, g, g.W * 0.82, g.gy + g.U * 2, g.H * 0.26, -g.W * 0.02, rand);
    return c;
  }

  // ---- mist and glow sprites ----------------------------------------------

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.012, y * 0.09, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 206;
        img.data[i + 1] = 196;
        img.data[i + 2] = 214;
        img.data[i + 3] = smoothstep(0.38, 0.66, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(232,184,96,0.6)');
    grad.addColorStop(0.35, 'rgba(214,150,80,0.22)');
    grad.addColorStop(1, 'rgba(214,150,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- motion --------------------------------------------------------------

  function drawMist(ctx, g, c, t, speed, y, amount) {
    if (amount <= 0) return;
    const off = -((t * g.U * speed) % c.width);
    ctx.globalAlpha = Math.min(1, 0.9 * amount);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function lanternLevel(L, t) {
    const p = t % CYCLE;
    const on = smoothstep(FIRST + L.k * GAP, FIRST + L.k * GAP + 2, p);
    const off = 1 - smoothstep(FADE_OUT[0], FADE_OUT[1], p);
    return on * off;
  }

  function drawLanterns(ctx, g, t, strength) {
    if (strength <= 0) return;
    let total = 0;
    ctx.globalCompositeOperation = 'lighter';
    for (const L of state.lanterns) {
      const lv = lanternLevel(L, t);
      total += lv;
      if (lv <= 0.01) continue;
      const flick = 1 + Math.sin(t * 2.3 + L.k * 1.7) * 0.05;
      const a = Math.min(1, lv * flick * strength);
      const r = L.s * 14;
      ctx.globalAlpha = a * 0.75;
      ctx.drawImage(state.glow, L.x - r, L.y - L.s * 5.2 - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const L of state.lanterns) {
      const lv = lanternLevel(L, t);
      if (lv <= 0.01) continue;
      ctx.globalAlpha = Math.min(1, lv * strength);
      ctx.fillStyle = '#e8b860';
      ctx.fillRect(L.x - L.s * 0.55, L.y - L.s * 5.6, L.s * 1.1, L.s * 1.1);
    }
    ctx.globalAlpha = 1;
    // The open doors warm up as the approach fills with light.
    const d = state.door;
    ctx.globalAlpha = Math.min(0.55, (0.12 + (total / state.lanterns.length) * 0.45) * strength);
    ctx.fillStyle = '#b9873f';
    ctx.fillRect(d.x + 1, d.y + d.h * 0.18, d.w - 2, d.h * 0.8);
    ctx.globalAlpha = 1;
  }

  function drawCrows(ctx, g, t) {
    ctx.strokeStyle = '#161826';
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.03 + i * 0.05) % 1.3) - 0.15;
      const x = g.W * p;
      const y = g.H * (0.2 + i * 0.03) + Math.sin(t * 0.6 + i) * g.U * 1.2;
      const s = g.U * (2.2 - i * 0.3);
      const flap = Math.sin(t * 5 + i * 2) * s * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - s * 1.4, y - s * 0.4 - flap);
      ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.2, x, y);
      ctx.quadraticCurveTo(x + s * 0.6, y - s * 0.2, x + s * 1.4, y - s * 0.4 - flap);
      ctx.stroke();
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.lanterns = makeLanterns(g);
    state.sky = paintSky(g, rand);
    state.hall = paintHall(g, rand);
    state.front = paintFront(g, rand);
    state.mistFar = paintMist(Math.ceil(g.W * 1.3), Math.ceil(g.H * 0.2), 13);
    state.mistNear = paintMist(Math.ceil(g.W * 1.3), Math.ceil(g.H * 0.16), 29);
    state.glow = paintGlow();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { lanterns, mist, crows } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    if (crows) drawCrows(ctx, g, t);
    drawMist(ctx, g, state.mistFar, t, 2.2, g.H * 0.58, mist);
    ctx.drawImage(state.hall, 0, 0);
    drawMist(ctx, g, state.mistNear, t, 3.4, g.H * 0.7, mist);
    ctx.drawImage(state.front, 0, 0);
    drawLanterns(ctx, g, t, lanterns);
    drawMist(ctx, g, state.mistNear, t + 40, 4.4, g.H * 0.86, mist * 0.6);
  }

  Kasuri.run({
    defaults: { lanterns: 1, mist: 1, crows: true, ramp: 'lines', cell: 7, boost: 0.3, gain: 1.3, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
