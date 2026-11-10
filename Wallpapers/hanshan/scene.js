/*
 * 寒山 Hanshan — a temple on a cold mountain at dusk.
 *
 * Sky, ridges, hall, pagoda, bell and pines are baked into layers and
 * repainted once a minute from the clock. Between repaints only three
 * bands of mist, a few rising wisps and the lamp glow move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.62;
  const RETINT_SECONDS = 60;
  const WISPS = 9;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour for something lit by the sky: base tinted by ambient light, darkened at night.
  function lit(base, sky, amt, dark) {
    return mixColor(mixColor(rgb(base), sky.amb, amt), rgb(dark || '#12162a'), sky.night * 0.65);
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
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // A pale cold moon, high on the left.
    const mx = g.W * 0.2;
    const my = g.H * 0.17;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 9);
    mg.addColorStop(0, 'rgba(236,234,220,0.5)');
    mg.addColorStop(1, 'rgba(236,234,220,0)');
    ctx.globalAlpha = 0.35 + sky.night * 0.65;
    ctx.fillStyle = mg;
    ctx.fillRect(mx - g.U * 9, my - g.U * 9, g.U * 18, g.U * 18);
    ctx.fillStyle = '#e8e6d6';
    ctx.beginPath();
    ctx.arc(mx, my, g.U * 2.4, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- far peaks ---------------------------------------------------------

  // One ridge of steep ink peaks, filled to the bottom of the canvas.
  function paintRidge(ctx, g, top, amp, seed, color, freq) {
    ctx.fillStyle = hex(color);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 1) {
      const n = fbm(x * freq, seed, 4, seed + 3);
      const spire = Math.pow(n, 1.6);
      ctx.lineTo(x, g.H * top - spire * g.H * amp);
    }
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
  }

  function paintFar(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const far = mixColor(mixColor(rgb('#4a5878'), sky.haze, 0.55), rgb('#1c2240'), sky.night * 0.5);
    const mid = mixColor(mixColor(rgb('#38466a'), sky.haze, 0.38), rgb('#161c38'), sky.night * 0.5);
    paintRidge(ctx, g, 0.5, 0.36, 3, far, 0.012);
    paintRidge(ctx, g, 0.57, 0.3, 17, mid, 0.017);
    // A distant pagoda on the far ridge, almost lost in haze.
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
    ctx.fillRect(cx - hw * 0.4, y - h - Math.max(1, h * 0.12), hw * 0.8, Math.max(1, h * 0.14));
    ctx.fillRect(cx - hw * 0.4 - 1, y - h - h * 0.3, 2, h * 0.3);
    ctx.fillRect(cx + hw * 0.4 - 1, y - h - h * 0.3, 2, h * 0.3);
    // tile lines
    ctx.fillStyle = hex(mixColor(tile, rgb('#000000'), 0.3));
    for (let i = -4; i <= 4; i++) {
      ctx.fillRect(cx + i * hw * 0.2, y - h * 0.9, 1, h * 0.8 - Math.abs(i) * h * 0.05);
    }
  }

  function bracketBand(ctx, x0, y, w, h, color, gold) {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x0, y, w, h);
    ctx.fillStyle = hex(gold);
    const step = Math.max(2, h * 1.1);
    for (let x = x0 + 1; x < x0 + w - 1; x += step) ctx.fillRect(x, y + h * 0.3, Math.max(1, step * 0.4), h * 0.4);
  }

  // The main hall: double eaves, vermilion columns, a lit doorway.
  function paintHall(ctx, g, sky, ox, base) {
    const U = g.U;
    const col = lit('#a8402c', sky, 0.25, '#2a1820');
    const wall = lit('#6e2f26', sky, 0.2, '#1e1418');
    const tile = lit('#66728a', sky, 0.3, '#3a4668');
    const ridge = lit('#a4adbc', sky, 0.3, '#5a6684');
    const gold = lit('#c9a24c', sky, 0.2, '#6a5a30');
    const stone = lit('#8c8a86', sky, 0.35, '#1c2030');
    const w = U * 46;
    // stone terrace with steps
    ctx.fillStyle = hex(stone);
    ctx.fillRect(ox - w * 0.62, base - U * 1.6, w * 1.24, U * 1.6);
    ctx.fillStyle = hex(mixColor(stone, rgb('#000000'), 0.25));
    for (let i = 0; i < 4; i++) ctx.fillRect(ox - w * 0.2 + i, base - U * 1.6 + i * (U * 0.4), w * 0.4 - i * 2, 1);
    // lower storey
    const wallTop = base - U * 8;
    ctx.fillStyle = hex(wall);
    ctx.fillRect(ox - w * 0.46, wallTop, w * 0.92, U * 6.4);
    ctx.fillStyle = hex(col);
    for (let i = -3; i <= 3; i++) ctx.fillRect(ox + i * w * 0.14 - 1, wallTop, Math.max(2, U * 0.7), U * 6.4);
    // lattice doors
    ctx.fillStyle = hex(lit('#d9a85a', sky, 0.1, '#e0a24a'));
    ctx.globalAlpha = 0.35 + sky.night * 0.5;
    ctx.fillRect(ox - w * 0.12, wallTop + U * 1, w * 0.24, U * 5.4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(col);
    ctx.fillRect(ox - 1, wallTop + U * 1, 1, U * 5.4);
    bracketBand(ctx, ox - w * 0.5, wallTop - U * 1.3, w, U * 1.3, wall, gold);
    roof(ctx, ox, wallTop - U * 1.3, w * 0.62, U * 4.2, U * 3.2, tile, ridge);
    // upper storey
    const upTop = wallTop - U * 9;
    ctx.fillStyle = hex(wall);
    ctx.fillRect(ox - w * 0.28, upTop, w * 0.56, U * 3.8);
    ctx.fillStyle = hex(col);
    for (let i = -2; i <= 2; i++) ctx.fillRect(ox + i * w * 0.12 - 1, upTop, Math.max(2, U * 0.6), U * 3.8);
    bracketBand(ctx, ox - w * 0.31, upTop - U * 1.1, w * 0.62, U * 1.1, wall, gold);
    roof(ctx, ox, upTop - U * 1.1, w * 0.46, U * 4.6, U * 3.4, tile, ridge);
    // finial
    ctx.fillStyle = hex(gold);
    ctx.fillRect(ox - 1, upTop - U * 7.6, 2, U * 1.8);
    ctx.beginPath();
    ctx.arc(ox, upTop - U * 7.8, Math.max(1, U * 0.6), 0, 6.3);
    ctx.fill();
  }

  // A seven-storey pagoda: each tier a little narrower, gold finial.
  function paintPagoda(ctx, g, sky, ox, base, scale) {
    const U = g.U * scale;
    const tile = lit('#66728a', sky, 0.3, '#3a4668');
    const ridge = lit('#a4adbc', sky, 0.3, '#5a6684');
    const wall = lit('#7a3a2c', sky, 0.2, '#201418');
    const gold = lit('#c9a24c', sky, 0.2, '#6a5a30');
    let y = base;
    ctx.fillStyle = hex(lit('#8c8a86', sky, 0.35, '#1c2030'));
    ctx.fillRect(ox - U * 6, y - U * 1.4, U * 12, U * 1.4);
    y -= U * 1.4;
    for (let i = 0; i < 7; i++) {
      const hw = U * (5.2 - i * 0.55);
      ctx.fillStyle = hex(wall);
      ctx.fillRect(ox - hw * 0.62, y - U * 2.4, hw * 1.24, U * 2.4);
      roof(ctx, ox, y - U * 2.4, hw, U * 1.7, U * 1.2, tile, ridge);
      y -= U * 3.5;
    }
    ctx.fillStyle = hex(gold);
    ctx.fillRect(ox - 0.5, y - U * 5, 1.5, U * 5);
    for (let k = 0; k < 3; k++) ctx.fillRect(ox - U * (1.1 - k * 0.3), y - U * (1.2 + k * 1.2), U * (2.2 - k * 0.6), Math.max(1, U * 0.4));
  }

  // A small pavilion with a bronze bell hung from the beam. Bell is its own sprite.
  function paintBellHouse(ctx, g, sky, ox, base) {
    const U = g.U;
    const col = lit('#a8402c', sky, 0.25, '#2a1820');
    const tile = lit('#66728a', sky, 0.3, '#3a4668');
    const ridge = lit('#a4adbc', sky, 0.3, '#5a6684');
    const stone = lit('#8c8a86', sky, 0.35, '#1c2030');
    const gold = lit('#c9a24c', sky, 0.2, '#6a5a30');
    ctx.fillStyle = hex(stone);
    ctx.fillRect(ox - U * 8, base - U * 1.4, U * 16, U * 1.4);
    ctx.fillStyle = hex(col);
    const hh = U * 11;
    for (const dx of [-6, 6]) ctx.fillRect(ox + dx * U - U * 0.5, base - U * 1.4 - hh, Math.max(2, U * 1), hh);
    ctx.fillRect(ox - U * 6.6, base - U * 1.4 - hh, U * 13.2, Math.max(2, U * 0.9));
    ctx.fillStyle = hex(gold);
    ctx.fillRect(ox - U * 6.6, base - U * 1.4 - hh + U * 0.9, U * 13.2, Math.max(1, U * 0.4));
    roof(ctx, ox, base - U * 1.4 - hh, U * 9.5, U * 4, U * 3, tile, ridge);
    state.bellPivot = { x: ox, y: base - U * 1.4 - hh + U * 1.4 };
  }

  function paintBell(g, sky) {
    const U = g.U;
    const w = Math.ceil(U * 5);
    const h = Math.ceil(U * 8);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const bronze = lit('#6a5a3a', sky, 0.25, '#2a2418');
    ctx.fillStyle = hex(bronze);
    ctx.fillRect(w / 2 - 0.5, 0, 1, U * 1.4);
    ctx.beginPath();
    ctx.moveTo(w / 2 - U * 0.6, U * 1.4);
    ctx.quadraticCurveTo(w / 2 - U * 1.2, U * 4.6, w / 2 - U * 2.2, h - 1);
    ctx.lineTo(w / 2 + U * 2.2, h - 1);
    ctx.quadraticCurveTo(w / 2 + U * 1.2, U * 4.6, w / 2 + U * 0.6, U * 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(lit('#c9a24c', sky, 0.2, '#6a5a30'));
    ctx.fillRect(w / 2 - U * 1.6, U * 4.2, U * 3.2, Math.max(1, U * 0.4));
    return c;
  }

  // ---- slope and pines ---------------------------------------------------

  // The temple stands on a steep shoulder of rock: x -> top of ground.
  function groundY(g, x) {
    const f = x / g.W;
    const hill = 0.9 - 0.22 * smoothstep(0.05, 0.5, f);
    const dip = Math.exp(-Math.pow((f - 0.3) / 0.12, 2)) * 0.1;
    return g.H * (hill + dip) + (fbm(x * 0.05, 8, 3, 21) - 0.5) * g.U * 2;
  }

  function paintSlope(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    // stepped terraces for the hall and the pagoda, flat tops on the slope
    const rock = lit('#4a566e', sky, 0.3, '#232c4a');
    const moss = lit('#3a4a3a', sky, 0.3, '#0e1620');
    const grad = ctx.createLinearGradient(0, g.H * 0.5, 0, g.H);
    grad.addColorStop(0, hex(mixColor(rock, moss, 0.4)));
    grad.addColorStop(1, hex(mixColor(rock, rgb('#000000'), 0.15)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, state.ground[Math.min(x, g.W - 1)]);
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    // cracks in the rock
    ctx.fillStyle = hex(mixColor(rock, rgb('#000000'), 0.5));
    const rand = K.rng(41);
    for (let i = 0; i < g.W * 0.9; i++) {
      const x = rand() * g.W;
      const y = state.ground[Math.floor(x)] + rand() * g.H * 0.2;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x, y, 1, 1 + rand() * g.U * 2.5);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // Pine: slanted trunk, flat tiers of needles in the Chinese ink manner.
  function pine(ctx, g, sky, x, base, s, lean, rand) {
    const U = g.U * s;
    const trunk = lit('#3a2e28', sky, 0.2, '#100c10');
    const needle = lit('#2e4a3a', sky, 0.28, '#0a1418');
    const needleHi = lit('#4c6a48', sky, 0.4, '#142018');
    const height = U * 30;
    ctx.strokeStyle = hex(trunk);
    ctx.lineWidth = Math.max(1.5, U * 1.3);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * height * 0.2, base - height * 0.5, x + lean * height * 0.5, base - height);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const t = 0.3 + i * 0.1;
      const px = x + lean * height * 0.5 * t * t * 2 * 0.5 + lean * height * 0.2 * t;
      const py = base - height * t;
      const side = i % 2 ? 1 : -1;
      const len = U * (9 - i * 0.7) * (0.8 + rand() * 0.4);
      const cx = px + side * len * 0.45;
      const cy = py - U * 1.4;
      ctx.strokeStyle = hex(trunk);
      ctx.lineWidth = Math.max(1, U * 0.5);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + side * len * 0.3, py - U, cx, cy);
      ctx.stroke();
      // flat cloud-like needle pad
      ctx.fillStyle = hex(needle);
      ctx.beginPath();
      ctx.ellipse(cx, cy - U * 0.4, len * 0.55, U * 1.7, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = hex(needleHi);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(cx - len * 0.05, cy - U * 1.0, len * 0.38, U * 0.7, 0, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = hex(needle);
    ctx.beginPath();
    ctx.ellipse(x + lean * height * 0.5, base - height - U * 0.6, U * 4, U * 1.6, 0, 0, 6.3);
    ctx.fill();
  }

  function paintBack(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(state.slope, 0, 0);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    // pagoda far up on the left peak, then the hall, drawn behind the slope pines
    paintPagoda(ctx, g, sky, g.W * 0.4, g.H * 0.6, 1.0);
    ctx.drawImage(state.slope, 0, 0);
    // back pines on the shoulder
    for (let i = 0; i < 5; i++) {
      const x = g.W * (0.46 + i * 0.1);
      pine(ctx, g, sky, x, state.ground[Math.floor(x)] + U * 2, 0.5, (rand() - 0.5) * 0.4, rand);
    }
    paintHall(ctx, g, sky, g.W * 0.69, state.ground[Math.floor(g.W * 0.69)] + U * 1);
    paintBellHouse(ctx, g, sky, g.W * 0.2, state.ground[Math.floor(g.W * 0.2)] + U * 1);
    // foreground pines, big, leaning in from the edges
    pine(ctx, g, sky, g.W * 0.045, g.H * 1.02, 1.55, 0.35, rand);
    pine(ctx, g, sky, g.W * 0.35, g.H * 0.98, 1.0, -0.2, rand);
    pine(ctx, g, sky, g.W * 0.955, g.H * 1.03, 1.6, -0.35, rand);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.ground = new Float32Array(Math.ceil(g.W) + 1);
    for (let x = 0; x < state.ground.length; x++) state.ground[x] = groundY(g, x);
    // terraces: flatten under the hall and the bell house
    for (const [cf, hw] of [[0.69, 0.2], [0.2, 0.09]]) {
      const x0 = Math.floor(g.W * (cf - hw));
      const x1 = Math.floor(g.W * (cf + hw));
      const y = state.ground[Math.floor(g.W * cf)];
      for (let x = x0; x <= x1; x++) state.ground[x] = Math.min(y, state.ground[x] + g.U * 0.0) ;
    }
    state.slope = paintSlope(g, sky);
    state.sky = paintSky(g, sky, rand);
    state.far = paintFar(g, sky);
    state.front = paintFront(g, sky, rand);
    state.bell = paintBell(g, sky);
    state.glow = sky.night;
    state.mistColor = mixColor(mixColor(rgb('#d8dde0'), sky.haze, 0.45), rgb('#2a3050'), sky.night * 0.6);
    state.mist = paintMist(g, state.mistColor);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(g, color) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.22);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const r = Math.round(color[0]);
    const gg = Math.round(color[1]);
    const b = Math.round(color[2]);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.05, 4, 7), fbm((x - w) * 0.012, y * 0.05, 4, 7), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = b;
        img.data[i + 3] = smoothstep(0.38, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintWisp() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(226,230,232,0.5)');
    grad.addColorStop(1, 'rgba(226,230,232,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function drawMist(ctx, g, t, amount, y, speed, alpha) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.U * speed) % c.width);
    ctx.globalAlpha = Math.min(1, alpha * amount);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // Wisps climbing out of the gorge between the pines.
  function drawWisps(ctx, g, t, amount) {
    if (amount <= 0) return;
    for (let i = 0; i < WISPS; i++) {
      const a = (t * 0.03 + i / WISPS) % 1;
      const size = g.U * (10 + a * 16);
      const x = g.W * (0.12 + ((i * 0.37) % 1) * 0.7) + Math.sin(t * 0.2 + i * 2) * g.U * 2;
      const y = g.H * 0.8 - a * g.H * 0.3;
      ctx.globalAlpha = Math.sin(a * Math.PI) * 0.5 * Math.min(1, amount) * (1 - state.glow * 0.4);
      ctx.drawImage(state.wisp, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawBell(ctx, g, t) {
    const p = state.bellPivot;
    if (!p) return;
    const swing = Math.sin(t * 0.9) * 0.02;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(swing);
    ctx.drawImage(state.bell, -state.bell.width / 2, 0);
    ctx.restore();
  }

  // Lamps under the hall eaves glow gently as the light goes.
  function drawLamps(ctx, g, t) {
    const hall = g.W * 0.69;
    const base = state.ground[Math.floor(hall)] + g.U;
    const glow = 0.35 + state.glow * 0.5;
    const pulse = 0.9 + Math.sin(t * 1.3) * 0.1;
    ctx.fillStyle = '#d9a24a';
    for (const dx of [-0.17, -0.09, 0.09, 0.17]) {
      const lx = hall + g.W * dx * 0.45;
      const ly = base - g.U * 8.8;
      ctx.globalAlpha = glow * 0.35 * pulse;
      ctx.beginPath();
      ctx.arc(lx, ly, g.U * 2.2, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, glow * pulse);
      ctx.fillRect(lx - g.U * 0.4, ly - g.U * 0.5, Math.max(1, g.U * 0.8), Math.max(1, g.U * 1.1));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.wisp = paintWisp();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    drawMist(ctx, g, t, props.mist, g.H * 0.4, 0.9, 0.55);
    drawMist(ctx, g, t, props.mist, g.H * 0.55, 1.5, 0.45);
    ctx.drawImage(state.front, 0, 0);
    drawBell(ctx, g, t);
    if (props.lamps) drawLamps(ctx, g, t);
    drawMist(ctx, g, t, props.mist, g.H * 0.74, 2.2, 0.5);
    drawWisps(ctx, g, t, props.mist);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, lamps: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
