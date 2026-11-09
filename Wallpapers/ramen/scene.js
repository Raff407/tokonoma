/*
 * ラーメン Ramen — a bowl of noodles on a wooden counter, late at night.
 *
 * The wall, noren and lanterns are baked into one layer and the counter and
 * bowl into another. Between them each frame only the lantern glow breathes,
 * and in front a few dozen puffs of steam rise and curl from the broth.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, parseColor } = K;

  const MAX_PUFFS = 72;
  const STREAMS = 4;
  const LANTERNS = [
    { x: 0.17, y: 0.3, s: 1 },
    { x: 0.83, y: 0.3, s: 1 },
    { x: 0.36, y: 0.22, s: 0.62 },
    { x: 0.66, y: 0.22, s: 0.62 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function sprite(colour, alpha) {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const [r, g, b] = parseColor(colour);
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.4})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  // Bowl geometry shared by the painter and the steam.
  function bowlShape(g) {
    return { cx: g.W * 0.5, rimY: g.H * 0.6, rx: g.U * 31, ry: g.U * 7.5, depth: g.U * 21 };
  }

  // ---- back wall ---------------------------------------------------------

  function paintWall(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.7);
    grad.addColorStop(0, '#0f1222');
    grad.addColorStop(1, '#2a2230');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // Vertical slats of dark wood.
    const step = g.U * 6;
    for (let x = 0; x < g.W; x += step) {
      ctx.fillStyle = rand() < 0.5 ? '#1b1820' : '#221c22';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x, 0, step - Math.max(1, g.U * 0.6), g.H * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  function paintNoren(ctx, g) {
    const panels = 5;
    const w = g.W * 0.56;
    const x0 = g.W * 0.22;
    const pw = w / panels;
    const h = g.H * 0.15;
    for (let i = 0; i < panels; i++) {
      const x = x0 + i * pw;
      ctx.fillStyle = i % 2 ? '#2c3f6a' : '#2a3b64';
      ctx.fillRect(x + g.U * 0.4, 0, pw - g.U * 0.8, h + (i % 2) * g.U);
      ctx.fillStyle = '#e8dfc8';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(x + pw / 2, h * 0.5, g.U * 2.6, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2c3f6a';
      ctx.beginPath();
      ctx.arc(x + pw / 2, h * 0.5, g.U * 1.5, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(x0 - g.U * 2, 0, w + g.U * 4, g.U * 1.2);
  }

  function paintLantern(ctx, g, l) {
    const x = g.W * l.x;
    const y = g.H * l.y;
    const rw = g.U * 8 * l.s;
    const rh = g.U * 10.5 * l.s;
    ctx.fillStyle = '#1a1414';
    ctx.fillRect(x - Math.max(1, g.U * 0.2), 0, Math.max(1, g.U * 0.4), y - rh);
    const body = ctx.createRadialGradient(x - rw * 0.2, y - rh * 0.2, 0, x, y, rw * 1.2);
    body.addColorStop(0, '#f0b070');
    body.addColorStop(0.45, '#d6583a');
    body.addColorStop(1, '#8a2a22');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = '#7a2a20';
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    ctx.globalAlpha = 0.55;
    for (let k = -3; k <= 3; k++) {
      const yy = y + (k / 4) * rh;
      const half = rw * Math.sqrt(Math.max(0, 1 - Math.pow(k / 4, 2)));
      ctx.beginPath();
      ctx.moveTo(x - half, yy);
      ctx.lineTo(x + half, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1e1818';
    ctx.fillRect(x - rw * 0.55, y - rh - g.U * 1.2 * l.s, rw * 1.1, g.U * 1.6 * l.s);
    ctx.fillRect(x - rw * 0.55, y + rh - g.U * 0.4 * l.s, rw * 1.1, g.U * 1.6 * l.s);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    paintNoren(ctx, g);
    for (const l of LANTERNS) paintLantern(ctx, g, l);
    return c;
  }

  // ---- counter -----------------------------------------------------------

  function paintCounter(ctx, g) {
    const top = g.H * 0.7;
    const edge = g.H * 0.92;
    const img = ctx.createImageData(g.W, g.H - Math.floor(top));
    const y0 = Math.floor(top);
    for (let y = y0; y < g.H; y++) {
      const front = y >= edge;
      const f = (y - top) / (edge - top);
      for (let x = 0; x < g.W; x++) {
        const grain = fbm(x * 0.012, y * (front ? 0.5 : 0.35), 3, 7);
        const ring = 0.85 + 0.3 * grain;
        const i = ((y - y0) * g.W + x) * 4;
        const base = front ? [70, 44, 28] : [lerp(110, 150, f), lerp(72, 98, f), lerp(44, 58, f)];
        img.data[i] = base[0] * ring;
        img.data[i + 1] = base[1] * ring;
        img.data[i + 2] = base[2] * ring;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
    // Warm light pooled under the bowl, and the lip of the counter.
    const b = bowlShape(g);
    const pool = ctx.createRadialGradient(b.cx, b.rimY + b.depth, 0, b.cx, b.rimY + b.depth, b.rx * 1.8);
    pool.addColorStop(0, 'rgba(230,170,90,0.25)');
    pool.addColorStop(1, 'rgba(230,170,90,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, top, g.W, edge - top);
    ctx.fillStyle = '#d9b47a';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, edge - Math.max(1, g.U * 0.5), g.W, Math.max(1, g.U * 0.5));
    ctx.globalAlpha = 1;
  }

  function paintChopsticks(ctx, g) {
    const b = bowlShape(g);
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = k ? '#c9a46a' : '#b8925a';
      ctx.lineWidth = Math.max(1.5, g.U * 1.1);
      ctx.beginPath();
      ctx.moveTo(b.cx + b.rx * 1.12 + k * g.U * 2.2, b.rimY + g.U * 23);
      ctx.lineTo(b.cx + b.rx * 1.9 + k * g.U * 2.6, b.rimY + g.U * 9);
      ctx.stroke();
    }
    // Rest under the tips.
    ctx.fillStyle = '#3a4a7a';
    ctx.fillRect(b.cx + b.rx * 1.72, b.rimY + g.U * 11, g.U * 7, g.U * 2.2);
  }

  // ---- bowl --------------------------------------------------------------

  function paintBowlBody(ctx, g, b) {
    const foot = b.rimY + b.depth;
    const shadow = ctx.createRadialGradient(b.cx, foot + g.U, 0, b.cx, foot + g.U, b.rx * 1.1);
    shadow.addColorStop(0, 'rgba(20,12,10,0.7)');
    shadow.addColorStop(1, 'rgba(20,12,10,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(b.cx, foot + g.U, b.rx * 1.1, g.U * 5, 0, 0, 6.3);
    ctx.fill();
    const body = ctx.createLinearGradient(b.cx - b.rx, 0, b.cx + b.rx, 0);
    body.addColorStop(0, '#2a2226');
    body.addColorStop(0.3, '#4a3a3c');
    body.addColorStop(1, '#141014');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(b.cx - b.rx, b.rimY);
    ctx.bezierCurveTo(b.cx - b.rx, b.rimY + b.depth * 0.8, b.cx - b.rx * 0.45, foot, b.cx - b.rx * 0.32, foot);
    ctx.lineTo(b.cx + b.rx * 0.32, foot);
    ctx.bezierCurveTo(b.cx + b.rx * 0.45, foot, b.cx + b.rx, b.rimY + b.depth * 0.8, b.cx + b.rx, b.rimY);
    ctx.closePath();
    ctx.fill();
    // A vermilion band with a plain repeating key pattern.
    ctx.save();
    ctx.clip();
    const bandY = b.rimY + g.U * 3.5;
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(b.cx - b.rx, bandY, b.rx * 2, g.U * 3.4);
    ctx.fillStyle = '#e8dcc0';
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n;
      const x = b.cx - b.rx + a * b.rx * 2;
      ctx.globalAlpha = 0.25 + 0.65 * Math.sin(a * Math.PI);
      ctx.fillRect(x - g.U * 0.9, bandY + g.U * 0.9, g.U * 1.8, g.U * 0.5);
      ctx.fillRect(x - g.U * 0.9, bandY + g.U * 0.9, g.U * 0.5, g.U * 1.6);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = '#1a1416';
    ctx.fillRect(b.cx - b.rx * 0.34, foot - g.U * 0.5, b.rx * 0.68, g.U * 1.6);
  }

  function inBroth(b, x, y, k) {
    const dx = (x - b.cx) / (b.rx * k);
    const dy = (y - b.rimY) / (b.ry * k);
    return dx * dx + dy * dy < 1;
  }

  function paintNoodles(ctx, g, b, rand) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = b.cx + (rand() - 0.5) * b.rx * 1.6;
      const y = b.rimY + (rand() - 0.3) * b.ry * 1.2;
      if (!inBroth(b, x, y, 0.85)) continue;
      ctx.strokeStyle = rand() < 0.5 ? '#ecd79a' : '#e2c47a';
      ctx.lineWidth = Math.max(1, g.U * 0.55);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const len = g.U * (5 + rand() * 7);
      const dir = rand() < 0.5 ? -1 : 1;
      ctx.bezierCurveTo(x + dir * len * 0.3, y - g.U * 1.6, x + dir * len * 0.7, y + g.U * 1.6, x + dir * len, y);
      ctx.stroke();
    }
  }

  function paintToppings(ctx, g, b, rand) {
    // Nori standing up at the back.
    ctx.fillStyle = '#1e2a22';
    ctx.beginPath();
    ctx.moveTo(b.cx + b.rx * 0.22, b.rimY - b.ry * 0.2);
    ctx.lineTo(b.cx + b.rx * 0.3, b.rimY - b.ry * 2.6);
    ctx.lineTo(b.cx + b.rx * 0.62, b.rimY - b.ry * 2.3);
    ctx.lineTo(b.cx + b.rx * 0.6, b.rimY - b.ry * 0.1);
    ctx.fill();
    ctx.fillStyle = '#2c3c30';
    ctx.fillRect(b.cx + b.rx * 0.3, b.rimY - b.ry * 2.2, g.U * 0.6, b.ry * 1.9);
    // Two slices of pork.
    for (let k = 0; k < 2; k++) {
      const x = b.cx - b.rx * (0.42 - k * 0.16);
      const y = b.rimY - b.ry * (0.15 - k * 0.3);
      ctx.fillStyle = '#e0b48a';
      ctx.beginPath();
      ctx.ellipse(x, y, g.U * 7.5, g.U * 3.6, -0.2, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#b07050';
      ctx.beginPath();
      ctx.ellipse(x, y, g.U * 6.3, g.U * 2.8, -0.2, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#e6c49c';
      ctx.beginPath();
      ctx.ellipse(x + g.U, y - g.U * 0.3, g.U * 2.4, g.U * 0.9, -0.2, 0, 6.3);
      ctx.fill();
    }
    // Half an egg.
    const ex = b.cx + b.rx * 0.18;
    const ey = b.rimY + b.ry * 0.38;
    ctx.fillStyle = '#efe6d2';
    ctx.beginPath();
    ctx.ellipse(ex, ey, g.U * 5, g.U * 3.4, 0.1, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#e0a23a';
    ctx.beginPath();
    ctx.ellipse(ex + g.U * 0.3, ey, g.U * 2.6, g.U * 1.9, 0.1, 0, 6.3);
    ctx.fill();
    // A fishcake swirl.
    const nx = b.cx - b.rx * 0.05;
    const ny = b.rimY - b.ry * 0.35;
    ctx.fillStyle = '#f2ece0';
    ctx.beginPath();
    ctx.ellipse(nx, ny, g.U * 3.6, g.U * 2.2, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = '#c8452f';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    for (let a = 0; a < 12; a += 0.3) {
      const r = (a / 12) * g.U * 2.8;
      ctx.lineTo(nx + Math.cos(a) * r, ny + Math.sin(a) * r * 0.6);
    }
    ctx.stroke();
    // Spring onion scattered over the top.
    for (let i = 0; i < 60; i++) {
      const x = b.cx + (rand() - 0.5) * b.rx * 1.5;
      const y = b.rimY + (rand() - 0.5) * b.ry * 1.5;
      if (!inBroth(b, x, y, 0.8)) continue;
      ctx.fillStyle = rand() < 0.5 ? '#6f9a4a' : '#9ab860';
      ctx.fillRect(x, y, Math.max(1, g.U * 1.1), Math.max(1, g.U * 0.8));
    }
  }

  function paintBowlTop(ctx, g, b, rand) {
    // Rim, then broth inset a little.
    ctx.fillStyle = '#c8452f';
    ctx.beginPath();
    ctx.ellipse(b.cx, b.rimY, b.rx, b.ry, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#e8c9a0';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(b.cx, b.rimY, b.rx, b.ry, 0, Math.PI * 0.95, Math.PI * 1.6);
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.strokeStyle = '#efd8b0';
    ctx.stroke();
    ctx.globalAlpha = 1;
    const broth = ctx.createRadialGradient(b.cx - b.rx * 0.2, b.rimY - b.ry * 0.3, 0, b.cx, b.rimY, b.rx);
    broth.addColorStop(0, '#d9a85a');
    broth.addColorStop(1, '#9a6a34');
    ctx.fillStyle = broth;
    ctx.beginPath();
    ctx.ellipse(b.cx, b.rimY + g.U * 0.3, b.rx * 0.93, b.ry * 0.85, 0, 0, 6.3);
    ctx.fill();
    ctx.save();
    ctx.clip();
    paintNoodles(ctx, g, b, rand);
    ctx.restore();
    paintToppings(ctx, g, b, rand);
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintCounter(ctx, g);
    const b = bowlShape(g);
    paintBowlBody(ctx, g, b);
    paintBowlTop(ctx, g, b, rand);
    paintChopsticks(ctx, g);
    return c;
  }

  // ---- steam -------------------------------------------------------------

  function resetPuff(g, i, anywhere) {
    const r = state.rand;
    const b = state.bowl;
    const lane = i % STREAMS;
    state.px[i] = b.cx + ((lane + 0.5) / STREAMS - 0.5) * b.rx * 1.2 + (r() - 0.5) * g.U * 3;
    state.life[i] = 5 + r() * 2;
    state.age[i] = anywhere ? r() * state.life[i] : 0;
    state.ph[i] = lane * 2.1;
    state.sz[i] = g.U * (3 + r() * 3);
  }

  // Each stream sways as one, so its puffs line up into a curling wisp.
  function drawSteam(ctx, g, t, dt, amount) {
    const b = state.bowl;
    const count = Math.min(MAX_PUFFS, Math.round(MAX_PUFFS * 0.5 * amount));
    const rise = g.U * 10;
    for (let i = 0; i < count; i++) {
      state.age[i] += dt;
      if (state.age[i] > state.life[i]) resetPuff(g, i, false);
      const a = state.age[i];
      const f = a / state.life[i];
      const sway = Math.sin(a * 1.3 - t * 0.5 + state.ph[i]) * g.U * 5 * f;
      const x = state.px[i] + sway + f * f * g.U * 8;
      const y = b.rimY - b.ry * 0.3 - a * rise;
      const s = state.sz[i] * (1 + f * 2.2);
      ctx.globalAlpha = Math.sin(Math.min(1, f * 1.4) * Math.PI) * 0.7 * (1 - f * 0.3);
      ctx.drawImage(state.puff, x - s, y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlow(ctx, g, t, amount) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < LANTERNS.length; i++) {
      const l = LANTERNS[i];
      const r = g.U * 26 * l.s;
      ctx.globalAlpha = Math.min(1, amount * (0.55 + 0.12 * Math.sin(t * 0.6 + i * 1.7)));
      ctx.drawImage(state.glow, g.W * l.x - r, g.H * l.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.bowl = bowlShape(g);
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.glow = sprite('#e07a40', 0.6);
    state.puff = sprite('#efe9de', 0.6);
    state.px = new Float32Array(MAX_PUFFS);
    state.age = new Float32Array(MAX_PUFFS);
    state.life = new Float32Array(MAX_PUFFS);
    state.ph = new Float32Array(MAX_PUFFS);
    state.sz = new Float32Array(MAX_PUFFS);
    for (let i = 0; i < MAX_PUFFS; i++) resetPuff(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawGlow(ctx, g, t, props.glow);
    ctx.drawImage(state.front, 0, 0);
    drawSteam(ctx, g, t, dt, props.steam);
  }

  Kasuri.run({
    defaults: { steam: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, tint: 0.55 },
    maxFps: 20,
    setup,
    draw,
  });
})();
