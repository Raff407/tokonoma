/*
 * 寒山 Hanshan — a temple on a cold mountain at dusk.
 *
 * Sky, three ink-wash ridges, the hall, pagoda, bell pavilion and pines are
 * baked into layers and repainted once a minute from the clock. Each ridge
 * fades to pale at its foot, so mist bands drifting between them read clearly.
 * Per frame: a few drawImage calls for the layers and mist, the lamps, the
 * bell's slow sway and a skein of geese now and then.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const RETINT_SECONDS = 60;
  const GEESE = 7;
  const state = { geese: [], nextGeese: 4 };

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const INK = rgb('#141826');

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour for something lit by the sky: base tinted by ambient light, darkened at night.
  function lit(base, sky, amt, dark) {
    return mixColor(mixColor(rgb(base), sky.amb, amt), rgb(dark || '#12162a'), sky.night * 0.55);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.62);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(0.55, hex(mixColor(sky.top, sky.low, 0.45)));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#ece8da';
      for (let i = 0; i < g.W * 0.35; i++) {
        ctx.globalAlpha = sky.night * (0.2 + rand() * 0.6);
        ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H * 0.35), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // Moon by night, a low warm sun by day: large enough to weave cleanly.
    const n = sky.night;
    const body = mixColor(rgb('#f3d49a'), rgb('#f2eedf'), n);
    const mx = g.W * 0.22;
    const my = g.H * (0.2 - n * 0.04);
    const R = g.U * 5.2;
    const halo = ctx.createRadialGradient(mx, my, R * 0.8, mx, my, R * 3.2);
    halo.addColorStop(0, rgba(body, 0.45));
    halo.addColorStop(1, rgba(body, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(mx - R * 3.3, my - R * 3.3, R * 6.6, R * 6.6);
    ctx.fillStyle = hex(body);
    ctx.beginPath();
    ctx.arc(mx, my, R, 0, 6.3);
    ctx.fill();
    if (n > 0.3) {
      ctx.fillStyle = rgba(rgb('#c9c2a8'), 0.5 * n);
      ctx.beginPath();
      ctx.arc(mx - R * 0.3, my - R * 0.2, R * 0.32, 0, 6.3);
      ctx.arc(mx + R * 0.35, my + R * 0.3, R * 0.22, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  // ---- ridges ------------------------------------------------------------

  // One ridge of steep ink peaks whose foot dissolves into pale haze.
  function paintRidge(g, top, amp, seed, freq, ink, foot) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    let peak = g.H;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 1) {
      const v = fbm(x * freq, seed, 4, seed + 3);
      const y = g.H * top - Math.pow(v, 2.2) * g.H * amp;
      peak = Math.min(peak, y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, peak, 0, g.H * top + g.H * 0.06);
    grad.addColorStop(0, hex(ink));
    grad.addColorStop(0.55, hex(mixColor(ink, foot, 0.35)));
    grad.addColorStop(1, hex(foot));
    ctx.fillStyle = grad;
    ctx.fill();
    return c;
  }

  // ---- temple pieces -----------------------------------------------------

  // A hall roof: concave slopes, eaves swept up at the corners.
  function roof(ctx, cx, y, hw, h, lift, tile, ridge) {
    ctx.fillStyle = hex(tile);
    ctx.beginPath();
    ctx.moveTo(cx - hw, y - lift);
    ctx.quadraticCurveTo(cx - hw * 0.62, y + h * 0.12, cx - hw * 0.34, y - h);
    ctx.lineTo(cx + hw * 0.34, y - h);
    ctx.quadraticCurveTo(cx + hw * 0.62, y + h * 0.12, cx + hw, y - lift);
    ctx.quadraticCurveTo(cx, y + h * 0.5, cx - hw, y - lift);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hex(ridge);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - hw, y - lift);
    ctx.quadraticCurveTo(cx, y + h * 0.5, cx + hw, y - lift);
    ctx.stroke();
    ctx.fillStyle = hex(ridge);
    ctx.fillRect(cx - hw * 0.4, y - h - Math.max(1, h * 0.12), hw * 0.8, Math.max(1, h * 0.16));
  }

  function bracketBand(ctx, x0, y, w, h, color, gold) {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x0, y, w, h);
    ctx.fillStyle = hex(gold);
    const step = Math.max(3, h * 1.4);
    for (let x = x0 + 1; x < x0 + w - 1; x += step) ctx.fillRect(x, y + h * 0.3, Math.max(1, step * 0.45), h * 0.4);
  }

  // The main hall: double eaves, vermilion columns, a lit doorway.
  function paintHall(ctx, g, sky, ox, base) {
    const U = g.U;
    const col = lit('#c24a30', sky, 0.15, '#5a2420');
    const wall = lit('#7a3024', sky, 0.15, '#2a1618');
    const tile = lit('#3a4258', sky, 0.15, '#1a2034');
    const ridge = lit('#8a94a8', sky, 0.2, '#4a5470');
    const gold = lit('#d4aa50', sky, 0.1, '#8a6a30');
    const stone = lit('#9a958a', sky, 0.25, '#3a3e4c');
    const door = mixColor(rgb('#e8b45a'), rgb('#f2c46a'), sky.night);
    const w = U * 52;
    ctx.fillStyle = hex(stone);
    ctx.fillRect(ox - w * 0.6, base - U * 2, w * 1.2, U * 2);
    ctx.fillStyle = hex(mixColor(stone, INK, 0.35));
    ctx.fillRect(ox - w * 0.6, base - U * 0.5, w * 1.2, U * 0.5);
    const wallTop = base - U * 9;
    ctx.fillStyle = hex(wall);
    ctx.fillRect(ox - w * 0.45, wallTop, w * 0.9, U * 7);
    ctx.fillStyle = hex(door);
    ctx.globalAlpha = 0.55 + sky.night * 0.4;
    ctx.fillRect(ox - w * 0.13, wallTop + U * 1.2, w * 0.26, U * 5.8);
    ctx.fillRect(ox - w * 0.34, wallTop + U * 2, w * 0.1, U * 3);
    ctx.fillRect(ox + w * 0.24, wallTop + U * 2, w * 0.1, U * 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(col);
    for (let i = -3; i <= 3; i++) ctx.fillRect(ox + i * w * 0.14 - U * 0.4, wallTop, Math.max(2, U * 0.9), U * 7);
    bracketBand(ctx, ox - w * 0.5, wallTop - U * 1.4, w, U * 1.4, wall, gold);
    roof(ctx, ox, wallTop - U * 1.4, w * 0.64, U * 4.6, U * 3.6, tile, ridge);
    const upTop = wallTop - U * 10;
    ctx.fillStyle = hex(wall);
    ctx.fillRect(ox - w * 0.27, upTop, w * 0.54, U * 4.2);
    ctx.fillStyle = hex(door);
    ctx.globalAlpha = 0.45 + sky.night * 0.4;
    ctx.fillRect(ox - w * 0.18, upTop + U * 1, w * 0.36, U * 2.2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(col);
    for (let i = -2; i <= 2; i++) ctx.fillRect(ox + i * w * 0.12 - U * 0.4, upTop, Math.max(2, U * 0.8), U * 4.2);
    bracketBand(ctx, ox - w * 0.31, upTop - U * 1.2, w * 0.62, U * 1.2, wall, gold);
    roof(ctx, ox, upTop - U * 1.2, w * 0.46, U * 5, U * 3.8, tile, ridge);
    ctx.fillStyle = hex(gold);
    ctx.fillRect(ox - U * 0.4, upTop - U * 8.4, U * 0.8, U * 2.4);
    ctx.beginPath();
    ctx.arc(ox, upTop - U * 8.6, Math.max(1, U * 0.8), 0, 6.3);
    ctx.fill();
    state.lampY = wallTop - U * 0.2;
    state.lampXs = [-0.4, -0.2, 0.2, 0.4].map((f) => ox + f * w);
  }

  // A seven-storey pagoda on the far shoulder, half lost in haze.
  function paintPagoda(ctx, g, sky, ox, base, scale, haze) {
    const U = g.U * scale;
    const tile = mixColor(lit('#3a4258', sky, 0.15, '#1a2034'), haze, 0.25);
    const ridge = mixColor(lit('#8a94a8', sky, 0.2, '#4a5470'), haze, 0.25);
    const wall = mixColor(lit('#9a3a28', sky, 0.15, '#3a1c1c'), haze, 0.25);
    const gold = lit('#d4aa50', sky, 0.1, '#8a6a30');
    let y = base;
    for (let i = 0; i < 7; i++) {
      const hw = U * (5.2 - i * 0.55);
      ctx.fillStyle = hex(wall);
      ctx.fillRect(ox - hw * 0.6, y - U * 2.4, hw * 1.2, U * 2.4);
      roof(ctx, ox, y - U * 2.4, hw, U * 1.6, U * 1.2, tile, ridge);
      y -= U * 3.5;
    }
    ctx.fillStyle = hex(gold);
    ctx.fillRect(ox - U * 0.3, y - U * 5, U * 0.6, U * 5);
    for (let k = 0; k < 3; k++) ctx.fillRect(ox - U * (1.1 - k * 0.3), y - U * (1.2 + k * 1.2), U * (2.2 - k * 0.6), Math.max(1, U * 0.4));
  }

  // A small pavilion; the bronze bell is its own sprite.
  function paintBellHouse(ctx, g, sky, ox, base) {
    const U = g.U;
    const col = lit('#c24a30', sky, 0.15, '#5a2420');
    const tile = lit('#3a4258', sky, 0.15, '#1a2034');
    const ridge = lit('#8a94a8', sky, 0.2, '#4a5470');
    const stone = lit('#9a958a', sky, 0.25, '#3a3e4c');
    const gold = lit('#d4aa50', sky, 0.1, '#8a6a30');
    ctx.fillStyle = hex(stone);
    ctx.fillRect(ox - U * 9, base - U * 1.6, U * 18, U * 1.6);
    const hh = U * 12;
    const top = base - U * 1.6 - hh;
    ctx.fillStyle = hex(col);
    for (const dx of [-6.5, 6.5]) ctx.fillRect(ox + dx * U - U * 0.6, top, Math.max(2, U * 1.2), hh);
    ctx.fillRect(ox - U * 7.2, top, U * 14.4, Math.max(2, U * 1));
    ctx.fillStyle = hex(gold);
    ctx.fillRect(ox - U * 7.2, top + U, U * 14.4, Math.max(1, U * 0.5));
    roof(ctx, ox, top, U * 10.5, U * 4.4, U * 3.2, tile, ridge);
    state.bellPivot = { x: ox, y: top + U * 1.5 };
  }

  function paintBell(g, sky) {
    const U = g.U;
    const w = Math.ceil(U * 7);
    const h = Math.ceil(U * 8.5);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const bronze = lit('#8a6a3a', sky, 0.15, '#4a3a22');
    ctx.fillStyle = hex(bronze);
    ctx.fillRect(w / 2 - U * 0.3, 0, U * 0.6, U * 1.4);
    ctx.beginPath();
    ctx.moveTo(w / 2 - U * 0.9, U * 1.4);
    ctx.quadraticCurveTo(w / 2 - U * 1.6, U * 4.6, w / 2 - U * 2.8, h - 1);
    ctx.lineTo(w / 2 + U * 2.8, h - 1);
    ctx.quadraticCurveTo(w / 2 + U * 1.6, U * 4.6, w / 2 + U * 0.9, U * 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(lit('#d4aa50', sky, 0.1, '#8a6a30'));
    ctx.fillRect(w / 2 - U * 2, U * 4.4, U * 4, Math.max(1, U * 0.5));
    ctx.fillRect(w / 2 - U * 2.6, h - U * 1.6, U * 5.2, Math.max(1, U * 0.5));
    return c;
  }

  // ---- slope and pines ---------------------------------------------------

  // The temple's shoulder of rock: x -> top of ground. Rises to a terrace on the right.
  function groundY(g, x) {
    const f = x / g.W;
    const hill = 0.88 - 0.12 * smoothstep(0.32, 0.55, f);
    const bump = Math.exp(-Math.pow((f - 0.2) / 0.1, 2)) * 0.03;
    return g.H * (hill - bump) + (fbm(x * 0.04, 8, 3, 21) - 0.5) * g.U * 2.4;
  }

  function paintSlope(ctx, g, sky) {
    const top = mixColor(lit('#3c4c40', sky, 0.25, '#141c22'), sky.haze, 0.15);
    const bottom = mixColor(INK, sky.top, 0.15);
    const grad = ctx.createLinearGradient(0, g.H * 0.72, 0, g.H);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(bottom));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, state.ground[Math.min(x, g.W - 1)]);
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    // a lighter lip along the top edge, like a dry-brush stroke
    ctx.strokeStyle = hex(mixColor(top, sky.haze, 0.35));
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.beginPath();
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, state.ground[Math.min(x, g.W - 1)] + g.U * 0.3);
    ctx.stroke();
  }

  // Pine: slanted trunk, flat tiers of needles in the Chinese ink manner.
  function pine(ctx, g, sky, x, base, s, lean, rand, tone) {
    const U = g.U * s;
    const trunk = mixColor(lit('#3a2e28', sky, 0.15, '#100c10'), INK, tone);
    const needle = mixColor(lit('#2e5040', sky, 0.2, '#0e1c1c'), INK, tone);
    const needleHi = mixColor(lit('#5a7a50', sky, 0.3, '#1c2c22'), INK, tone);
    const height = U * 30;
    const tipX = x + lean * height * 0.5;
    ctx.strokeStyle = hex(trunk);
    ctx.lineWidth = Math.max(1.5, U * 1.4);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * height * 0.15, base - height * 0.5, tipX, base - height);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const t = 0.38 + i * 0.12;
      const px = x + lean * height * 0.5 * t;
      const py = base - height * t;
      const side = i % 2 ? 1 : -1;
      const len = U * (10 - i * 1.1) * (0.85 + rand() * 0.3);
      const cx = px + side * len * 0.5;
      const cy = py - U * 1.2;
      ctx.strokeStyle = hex(trunk);
      ctx.lineWidth = Math.max(1, U * 0.55);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + side * len * 0.3, py - U, cx, cy);
      ctx.stroke();
      ctx.fillStyle = hex(needle);
      ctx.beginPath();
      ctx.ellipse(cx, cy - U * 0.3, len * 0.6, U * 1.9, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = hex(needleHi);
      ctx.beginPath();
      ctx.ellipse(cx - len * 0.06, cy - U * 1.1, len * 0.42, U * 0.75, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = hex(needle);
    ctx.beginPath();
    ctx.ellipse(tipX, base - height - U * 0.4, U * 4.4, U * 1.8, 0, 0, 6.3);
    ctx.fill();
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    paintSlope(ctx, g, sky);
    for (let i = 0; i < 3; i++) {
      const x = g.W * (0.44 + i * 0.05);
      pine(ctx, g, sky, x, state.ground[Math.floor(x)] + U, 0.45, (rand() - 0.5) * 0.3, rand, 0.15);
    }
    paintHall(ctx, g, sky, g.W * 0.7, state.ground[Math.floor(g.W * 0.7)] + U);
    paintBellHouse(ctx, g, sky, g.W * 0.22, state.ground[Math.floor(g.W * 0.22)] + U);
    // foreground pines lean in from the edges, darker, framing the view
    pine(ctx, g, sky, g.W * 0.04, g.H * 1.04, 1.5, 0.35, rand, 0.45);
    pine(ctx, g, sky, g.W * 0.965, g.H * 1.05, 1.45, -0.35, rand, 0.45);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.ground = new Float32Array(Math.ceil(g.W) + 1);
    for (let x = 0; x < state.ground.length; x++) state.ground[x] = groundY(g, x);
    // flat terraces under the hall and the bell pavilion
    for (const [cf, hw] of [[0.7, 0.2], [0.22, 0.08]]) {
      const x0 = Math.max(0, Math.floor(g.W * (cf - hw)));
      const x1 = Math.min(state.ground.length - 1, Math.floor(g.W * (cf + hw)));
      const y = state.ground[Math.floor(g.W * cf)];
      for (let x = x0; x <= x1; x++) state.ground[x] = y;
    }
    const pale = mixColor(sky.low, sky.haze, 0.5);
    const ink = mixColor(INK, sky.top, 0.35);
    state.sky = paintSky(g, sky, rand);
    state.ridgeA = paintRidge(g, 0.5, 0.7, 3, 0.012, mixColor(sky.haze, ink, 0.35), pale);
    state.ridgeB = paintRidge(g, 0.6, 0.5, 17, 0.017, mixColor(sky.haze, ink, 0.6), pale);
    state.ridgeC = paintRidge(g, 0.7, 0.26, 29, 0.022, mixColor(sky.haze, ink, 0.82), mixColor(pale, ink, 0.3));
    // the pagoda stands on the middle ridge
    const pctx = state.ridgeC.getContext('2d');
    paintPagoda(pctx, g, sky, g.W * 0.43, g.H * 0.66, 0.85, pale);
    state.front = paintFront(g, sky, rand);
    state.bell = paintBell(g, sky);
    state.glow = sky.night;
    state.mistColor = mixColor(mixColor(rgb('#e4e2da'), sky.low, 0.3), rgb('#3a4060'), sky.night * 0.45);
    state.mist = paintMist(g, state.mistColor);
    state.inkGoose = mixColor(INK, sky.top, 0.15);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- mist --------------------------------------------------------------

  // A seamless strip of mist, densest along its middle.
  function paintMist(g, color) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.12);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const r = Math.round(color[0]);
    const gg = Math.round(color[1]);
    const b = Math.round(color[2]);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const f = x / w;
        const v = fbm(x * 0.014, y * 0.07, 4, 7) * (1 - f) + fbm((x - w) * 0.014, y * 0.07, 4, 7) * f;
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = b;
        img.data[i + 3] = smoothstep(0.4, 0.66, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, amount, y, speed, alpha, flip) {
    if (amount <= 0) return;
    const c = state.mist;
    let off = -((t * g.U * speed) % c.width);
    if (flip) off = -c.width - off;
    ctx.globalAlpha = Math.min(1, alpha * amount);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // ---- living bits -------------------------------------------------------

  function drawBell(ctx, t) {
    const p = state.bellPivot;
    if (!p) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(t * 0.7) * 0.035);
    ctx.drawImage(state.bell, -state.bell.width / 2, 0);
    ctx.restore();
  }

  // Lamps hung under the lower eaves; they warm as the light goes.
  function drawLamps(ctx, g, t) {
    const glow = 0.45 + state.glow * 0.5;
    const U = g.U;
    for (let i = 0; i < state.lampXs.length; i++) {
      const lx = state.lampXs[i];
      const ly = state.lampY + U * 1.6;
      const pulse = 0.88 + Math.sin(t * 1.1 + i * 1.7) * 0.12;
      ctx.fillStyle = '#e0a24a';
      ctx.globalAlpha = glow * 0.3 * pulse;
      ctx.beginPath();
      ctx.arc(lx, ly, U * 2.6, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#d6452c';
      ctx.globalAlpha = Math.min(1, glow * pulse + 0.2);
      ctx.fillRect(lx - U * 0.7, ly - U * 0.9, U * 1.4, U * 1.8);
    }
    ctx.globalAlpha = 1;
  }

  // A skein of geese crosses the evening sky every so often.
  function drawGeese(ctx, g, dt, speed) {
    if (state.geese.length === 0) {
      state.nextGeese -= dt;
      if (state.nextGeese > 0) return;
      const y = g.H * (0.1 + Math.random() * 0.14);
      for (let i = 0; i < GEESE; i++) {
        const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        state.geese.push({ x: -g.U * 4 - Math.abs(k) * g.U * 3, y: y + k * g.U * 1.8, p: i * 0.9 });
      }
      state.nextGeese = 25 + Math.random() * 25;
    }
    ctx.fillStyle = hex(state.inkGoose);
    const v = g.U * 4.5 * speed * dt;
    let alive = 0;
    for (const b of state.geese) {
      b.x += v;
      b.p += dt * 5;
      if (b.x < g.W + g.U * 6) alive++;
      const wing = Math.sin(b.p) > 0 ? -1 : 0;
      const s = Math.max(1, Math.round(g.U * 0.8));
      ctx.fillRect(b.x - s * 2, b.y + wing * s, s * 2, s);
      ctx.fillRect(b.x, b.y, s, s);
      ctx.fillRect(b.x + s, b.y + wing * s, s * 2, s);
    }
    if (alive === 0) state.geese.length = 0;
  }

  function setup(ctx, api) {
    state.g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    repaint(state.g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const sp = clamp(props.speed || 1, 0.1, 3);
    const tt = t * sp;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawGeese(ctx, g, dt, sp);
    ctx.drawImage(state.ridgeA, 0, 0);
    drawMist(ctx, g, tt, props.mist, g.H * 0.4, 5, 0.6, false);
    ctx.drawImage(state.ridgeB, 0, 0);
    drawMist(ctx, g, tt, props.mist, g.H * 0.53, 7, 0.55, true);
    ctx.drawImage(state.ridgeC, 0, 0);
    drawMist(ctx, g, tt, props.mist, g.H * 0.64, 9, 0.5, false);
    ctx.drawImage(state.front, 0, 0);
    drawBell(ctx, tt);
    if (props.lamps) drawLamps(ctx, g, tt);
    drawMist(ctx, g, tt, props.mist, g.H * 0.86, 12, 0.22, true);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, lamps: true, ramp: 'lines', cell: 7, speed: 1, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
