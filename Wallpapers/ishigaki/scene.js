/*
 * 石垣 Ishigaki — a turquoise coral lagoon, a white sand bar and an island
 * house with a red tile roof and a pair of shisa on the ridge.
 *
 * Sky, water, sand and house are baked into layers and repainted once a
 * minute from the clock. Between repaints only clouds, shimmer, foam and
 * one egret move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.36;
  const REEF = 0.4;
  const HOUSE_X = 0.7;
  const RETINT_SECONDS = 60;
  const state = {};

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Centre line and half thickness of the sand bar, u from 0 to 1 across.
  function barY(g, u) {
    return g.H * (0.7 + 0.035 * Math.sin(u * 4.2 + 0.6) - 0.05 * u);
  }

  function barHalf(g, u) {
    const taper = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.02) / 0.96)))), 0.55);
    const island = Math.exp(-Math.pow((u - HOUSE_X) / 0.13, 2));
    return g.H * (0.035 * taper + 0.045 * island);
  }

  function tint(c, sky, amount) {
    const lit = mixColor(c, sky.amb, amount);
    return mixColor(lit, rgb('#101c34'), sky.night * 0.62);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.32, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.08, 4, 17);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 248;
        img.data[i + 3] = smoothstep(0.5, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- water -------------------------------------------------------------

  function waterColor(g, sky, x, y) {
    const u = x / g.W;
    const hz = g.H * HORIZON;
    const t = (y - hz) / (g.H - hz);
    if (y < g.H * REEF) {
      const deep = mixColor(rgb('#274a82'), rgb('#31609a'), smoothstep(0, 1, (y - hz) / (g.H * (REEF - HORIZON))));
      return tint(deep, sky, 0.12);
    }
    const d = Math.abs(y - barY(g, u)) / (barHalf(g, u) + g.H * 0.05);
    const shallow = Math.exp(-d * 0.9);
    const lagoon = mixColor(rgb('#2f8a94'), rgb('#4fb0a8'), Math.min(1, shallow + t * 0.3));
    let col = mixColor(lagoon, rgb('#8fd0bc'), shallow * 0.75);
    const patch = smoothstep(0.56, 0.72, fbm(x * 0.045, y * 0.1, 4, 7));
    const coral = mixColor(rgb('#2c6670'), rgb('#4d6a4a'), fbm(x * 0.09, y * 0.2, 2, 3));
    col = mixColor(col, coral, patch * (0.2 + 0.35 * (1 - shallow)) * smoothstep(0, 0.12, t));
    return tint(col, sky, 0.14);
  }

  function paintWater(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = Math.floor(g.H * HORIZON);
    const h = g.H - y0;
    const img = ctx.createImageData(g.W, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < g.W; x++) {
        const col = waterColor(g, sky, x, y + y0);
        const i = (y * g.W + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
    // The far island hump on the horizon.
    ctx.fillStyle = hex(tint(rgb('#4f6e66'), sky, 0.2));
    ctx.beginPath();
    ctx.moveTo(g.W * 0.06, g.H * HORIZON + 1);
    ctx.quadraticCurveTo(g.W * 0.16, g.H * (HORIZON - 0.05), g.W * 0.27, g.H * HORIZON + 1);
    ctx.fill();
    return c;
  }

  // Streaks of light that tile sideways.
  function paintShimmer(g) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.H * (1 - REEF));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(5);
    ctx.fillStyle = '#eefaf2';
    for (let i = 0; i < g.W * 0.55; i++) {
      const y = rand() * h;
      const len = g.U * (1.5 + rand() * 4) * (0.6 + (y / h));
      ctx.globalAlpha = 0.25 + rand() * 0.3;
      const x = rand() * w;
      ctx.fillRect(x, y, len, Math.max(1, g.U * 0.35));
      if (x + len > w) ctx.fillRect(x - w, y, len, Math.max(1, g.U * 0.35));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- sand and island ---------------------------------------------------

  function barPath(ctx, g) {
    const steps = 48;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = 0.02 + (i / steps) * 0.96;
      const y = barY(g, u) - barHalf(g, u);
      if (i === 0) ctx.moveTo(g.W * u, y);
      else ctx.lineTo(g.W * u, y);
    }
    for (let i = steps; i >= 0; i--) {
      const u = 0.02 + (i / steps) * 0.96;
      ctx.lineTo(g.W * u, barY(g, u) + barHalf(g, u));
    }
    ctx.closePath();
  }

  function paintSand(ctx, g, sky, rand) {
    barPath(ctx, g);
    ctx.fillStyle = hex(tint(rgb('#f0e9d6'), sky, 0.12));
    ctx.fill();
    ctx.save();
    barPath(ctx, g);
    ctx.clip();
    ctx.fillStyle = hex(tint(rgb('#cfc4a2'), sky, 0.1));
    for (let i = 0; i < g.W * 0.5; i++) {
      const u = 0.03 + rand() * 0.94;
      ctx.globalAlpha = 0.3 + rand() * 0.3;
      ctx.fillRect(g.W * u, barY(g, u) + (rand() - 0.2) * barHalf(g, u), 1, 1);
    }
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = hex(tint(rgb('#d8cfb0'), sky, 0.1));
    for (let i = 0; i <= 40; i++) {
      const u = 0.03 + (i / 40) * 0.94;
      ctx.fillRect(g.W * u, barY(g, u) + barHalf(g, u) * 0.7, g.W / 40 + 1, Math.max(1, g.U * 0.5));
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function leafBlob(ctx, x, y, r, rand, n) {
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(x + (rand() - 0.5) * r * 1.8, y + (rand() - 0.5) * r * 0.9, r * (0.5 + rand() * 0.5), 0, 6.3);
      ctx.fill();
    }
  }

  function paintPalm(ctx, g, sky, px, base, s) {
    const trunk = hex(tint(rgb('#6b5a46'), sky, 0.1));
    ctx.strokeStyle = trunk;
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.quadraticCurveTo(px + s * 1.2, base - s * 7, px + s * 0.4, base - s * 14);
    ctx.stroke();
    const topX = px + s * 0.4;
    const topY = base - s * 14;
    ctx.strokeStyle = hex(tint(rgb('#3c6a46'), sky, 0.14));
    ctx.lineWidth = Math.max(1, s * 0.4);
    const fronds = [-3.4, -2.3, -1.2, -0.3, 0.7, 1.7, 2.7];
    for (const a of fronds) {
      const dx = Math.cos(a * 0.5) * s * 6.5 * Math.sign(a || 1);
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + dx * 0.5, topY - s * 3, topX + dx, topY + s * (1.5 + Math.abs(a) * 0.8));
      ctx.stroke();
    }
  }

  function paintShisa(ctx, g, sky, sx, sy, s, flip) {
    const body = hex(tint(rgb('#c4924a'), sky, 0.12));
    const mane = hex(tint(rgb('#8a5a2a'), sky, 0.1));
    ctx.fillStyle = body;
    ctx.fillRect(sx - s * 0.9, sy - s * 1.6, s * 1.8, s * 1.6);
    ctx.fillRect(sx - s * 1.2, sy - s * 0.4, s * 2.4, s * 0.4);
    ctx.fillStyle = mane;
    ctx.beginPath();
    ctx.arc(sx + flip * s * 0.1, sy - s * 2.4, s * 1.15, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(sx + flip * s * 0.1, sy - s * 2.3, s * 0.75, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = hex(tint(rgb('#26241f'), sky, 0.05));
    ctx.fillRect(sx + flip * s * 0.1 - s * 0.45, sy - s * 2.5, Math.max(1, s * 0.25), Math.max(1, s * 0.25));
    ctx.fillRect(sx + flip * s * 0.1 + s * 0.2, sy - s * 2.5, Math.max(1, s * 0.25), Math.max(1, s * 0.25));
  }

  function paintHouse(ctx, g, sky) {
    const U = g.U;
    const cx = g.W * HOUSE_X;
    const base = barY(g, HOUSE_X) + barHalf(g, HOUSE_X) * 0.15;
    const wallW = U * 34;
    const wallH = U * 8;
    const roofH = U * 11;
    const wallTop = base - U * 3 - wallH;
    // Plaster walls and the dark open veranda between pillars.
    ctx.fillStyle = hex(tint(rgb('#e9e3d0'), sky, 0.14));
    ctx.fillRect(cx - wallW / 2, wallTop, wallW, wallH);
    ctx.fillStyle = hex(tint(rgb('#3a2f26'), sky, 0.05));
    ctx.fillRect(cx - wallW * 0.36, wallTop + U * 1.2, wallW * 0.72, wallH - U * 1.2);
    if (sky.night > 0.2) {
      ctx.fillStyle = `rgba(236,190,110,${0.7 * sky.night})`;
      ctx.fillRect(cx - wallW * 0.3, wallTop + U * 2.4, wallW * 0.18, wallH * 0.5);
      ctx.fillRect(cx + wallW * 0.1, wallTop + U * 2.4, wallW * 0.18, wallH * 0.5);
    }
    ctx.fillStyle = hex(tint(rgb('#cfc4a8'), sky, 0.12));
    for (let k = 0; k < 5; k++) ctx.fillRect(cx - wallW * 0.36 + k * wallW * 0.18, wallTop + U * 1.2, Math.max(1, U * 0.7), wallH - U * 1.2);
    // Hip roof of red tile with white plaster ridge and hips.
    const eave = wallW / 2 + U * 5;
    const ridge = wallW * 0.2;
    const top = wallTop - roofH;
    const tile = tint(rgb('#b4432c'), sky, 0.15);
    ctx.fillStyle = hex(tile);
    ctx.beginPath();
    ctx.moveTo(cx - eave, wallTop + U * 0.8);
    ctx.lineTo(cx - ridge, top);
    ctx.lineTo(cx + ridge, top);
    ctx.lineTo(cx + eave, wallTop + U * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hex(mixColor(tile, rgb('#4a1a14'), 0.4));
    ctx.lineWidth = 1;
    for (let k = -8; k <= 8; k++) {
      const f = k / 8;
      ctx.beginPath();
      ctx.moveTo(cx + f * ridge, top);
      ctx.lineTo(cx + f * eave, wallTop + U * 0.8);
      ctx.stroke();
    }
    ctx.strokeStyle = hex(tint(rgb('#efe8d8'), sky, 0.14));
    ctx.lineWidth = Math.max(1, U * 0.9);
    ctx.beginPath();
    ctx.moveTo(cx - eave, wallTop + U * 0.8);
    ctx.lineTo(cx - ridge, top);
    ctx.lineTo(cx + ridge, top);
    ctx.lineTo(cx + eave, wallTop + U * 0.8);
    ctx.stroke();
    ctx.fillStyle = hex(tint(rgb('#efe8d8'), sky, 0.14));
    ctx.fillRect(cx - eave, wallTop + U * 0.4, eave * 2, Math.max(1, U * 0.8));
    paintShisa(ctx, g, sky, cx - ridge * 0.8, top + U * 0.3, U * 2, 1);
    paintShisa(ctx, g, sky, cx + ridge * 0.8, top + U * 0.3, U * 2, -1);
    return base;
  }

  function paintWall(ctx, g, sky, rand, base) {
    const U = g.U;
    const x0 = g.W * (HOUSE_X - 0.15);
    const x1 = g.W * (HOUSE_X + 0.15);
    const wh = U * 4;
    ctx.fillStyle = hex(tint(rgb('#c9c3ae'), sky, 0.12));
    ctx.fillRect(x0, base - wh, x1 - x0, wh);
    ctx.fillStyle = hex(tint(rgb('#8f8a78'), sky, 0.1));
    for (let row = 0; row < 3; row++) {
      ctx.fillRect(x0, base - wh + (row + 1) * wh / 3, x1 - x0, 1);
      for (let x = x0 + (row % 2) * U * 2; x < x1; x += U * (3 + rand() * 2)) ctx.fillRect(x, base - wh + row * wh / 3, 1, wh / 3);
    }
    ctx.fillStyle = hex(tint(rgb('#d8d2be'), sky, 0.12));
    ctx.fillRect(x0 - 1, base - wh - 1, x1 - x0 + 2, Math.max(1, U * 0.5));
  }

  function paintGreens(ctx, g, sky, rand, base) {
    const U = g.U;
    const hx = g.W * HOUSE_X;
    ctx.fillStyle = hex(tint(rgb('#3a5a3c'), sky, 0.14));
    leafBlob(ctx, hx - U * 28, base - U * 12, U * 7, rand, 14);
    leafBlob(ctx, hx + U * 27, base - U * 11, U * 6, rand, 12);
    ctx.fillStyle = hex(tint(rgb('#4c7048'), sky, 0.14));
    leafBlob(ctx, hx - U * 27, base - U * 14, U * 4, rand, 8);
    ctx.fillStyle = hex(tint(rgb('#2f4c34'), sky, 0.1));
    leafBlob(ctx, hx - U * 20, base - U * 3, U * 3.4, rand, 10);
    leafBlob(ctx, hx + U * 20, base - U * 3, U * 3, rand, 10);
    // Hibiscus blooms in front of the wall.
    ctx.fillStyle = hex(tint(rgb('#c8452c'), sky, 0.14));
    for (let i = 0; i < 6; i++) ctx.fillRect(hx - U * 21 + rand() * U * 6, base - U * 5 + rand() * U * 3, Math.max(1, U * 0.7), Math.max(1, U * 0.7));
    paintPalm(ctx, g, sky, hx + U * 33, base, U * 1.7);
    paintPalm(ctx, g, sky, hx - U * 34, base, U * 1.5);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSand(ctx, g, sky, rand);
    const base = paintHouse(ctx, g, sky);
    paintGreens(ctx, g, sky, rand, base);
    paintWall(ctx, g, sky, rand, base);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(29);
    state.sky = paintSky(g, sky, rand);
    state.water = paintWater(g, sky);
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.8 - sky.night * 0.55;
    state.foam = hex(tint(rgb('#f4f6f0'), sky, 0.1));
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawShimmer(ctx, g, t, amount) {
    if (amount <= 0) return;
    const s = state.shimmer;
    const top = g.H * REEF;
    const a = 0.55 * (1 - state.night * 0.7) * Math.min(1, amount);
    const o1 = (t * g.U * 1.2) % s.width;
    const o2 = (t * g.U * 0.7) % s.width;
    ctx.globalAlpha = a;
    ctx.drawImage(s, -o1, top + Math.sin(t * 0.8) * g.U * 0.5);
    ctx.drawImage(s, s.width - o1, top + Math.sin(t * 0.8) * g.U * 0.5);
    ctx.globalAlpha = a * 0.7;
    ctx.drawImage(s, o2 - s.width, top + g.U * 3 + Math.sin(t * 0.6 + 2) * g.U * 0.5);
    ctx.drawImage(s, o2, top + g.U * 3 + Math.sin(t * 0.6 + 2) * g.U * 0.5);
    ctx.globalAlpha = 1;
  }

  function foamLine(ctx, g, t, y, amp, x0, x1, phase) {
    const steps = 36;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = lerp(x0, x1, i / steps);
      const yy = typeof y === 'function' ? y(x / g.W) : y;
      const py = yy + Math.sin(t * 0.9 + phase + i * 0.7) * g.U * amp;
      if (i === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();
  }

  function drawFoam(ctx, g, t, amount) {
    if (amount <= 0) return;
    ctx.strokeStyle = state.foam;
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.globalAlpha = 0.7 * Math.min(1, amount);
    foamLine(ctx, g, t, g.H * REEF, 0.5 * amount, 0, g.W, 0);
    foamLine(ctx, g, t, g.H * (REEF + 0.012), 0.4 * amount, 0, g.W, 2);
    ctx.globalAlpha = 0.6 * Math.min(1, amount);
    const edge = (u) => barY(g, u) + barHalf(g, u) + g.U * 0.5;
    foamLine(ctx, g, t, edge, 0.7 * amount, g.W * 0.06, g.W * 0.96, 1);
    foamLine(ctx, g, t, (u) => edge(u) + g.U * 1.6, 0.8 * amount, g.W * 0.1, g.W * 0.92, 3.5);
    ctx.globalAlpha = 1;
  }

  // One white egret crossing the sky, wings beating gently.
  function drawEgret(ctx, g, t) {
    const cycle = 70;
    const p = (t % cycle) / 52;
    if (p >= 1) return;
    const s = g.U;
    const px = lerp(g.W * 1.03, -g.W * 0.03, p);
    const py = g.H * 0.2 + Math.sin(p * 6) * s * 1.5;
    const flap = Math.sin(t * 3.2) * s * 1.4;
    ctx.fillStyle = state.night > 0.5 ? '#9aa0b4' : '#f6f4ec';
    ctx.fillRect(px - s * 1.2, py - s * 0.3, s * 2.4, s * 0.7);
    ctx.fillRect(px - s * 1.7, py - s * 0.5, s * 0.8, Math.max(1, s * 0.3));
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = Math.max(1, s * 0.45);
    ctx.beginPath();
    ctx.moveTo(px - s * 0.2, py);
    ctx.lineTo(px + s * 1.1, py - s * 1.6 - flap);
    ctx.moveTo(px - s * 0.2, py);
    ctx.lineTo(px - s * 1.0, py - s * 1.6 - flap);
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.shimmer = paintShimmer(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.water, 0, 0);
    drawShimmer(ctx, g, t, props.waves);
    drawFoam(ctx, g, t, props.waves);
    ctx.drawImage(state.front, 0, 0);
    if (props.egret) drawEgret(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', waves: 1, clouds: 1, egret: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
