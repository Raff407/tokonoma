/*
 * 中秋 Mid-Autumn — a full moon over the double eaves of a garden pavilion.
 *
 * Sky, moon, pavilion, rockery and osmanthus are baked into layers and
 * repainted once a minute from the clock. Between repaints only thin cloud,
 * the branches, a red lantern and drifting petals move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const MAX_PETALS = 44;
  const MOON = { x: 0.4, y: 33, r: 24 };
  const PAV = { x: 0.71 };
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky and moon --------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.9);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e2d0';
      for (let i = 0; i < g.W * 0.25; i++) {
        ctx.globalAlpha = sky.night * (0.1 + rand() * 0.35);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const mx = g.W * MOON.x;
    const my = g.U * MOON.y;
    const halo = ctx.createRadialGradient(mx, my, g.U * MOON.r * 0.9, mx, my, g.U * MOON.r * 3.2);
    halo.addColorStop(0, `rgba(238,226,184,${0.2 + sky.night * 0.28})`);
    halo.addColorStop(1, 'rgba(238,226,184,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintMoon(g, sky) {
    const r = Math.round(g.U * MOON.r);
    const size = r * 2 + 2;
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const lit = mixColor(rgb('#f2ead0'), sky.amb, 0.12);
    const sea = mixColor(rgb('#c4b992'), sky.haze, 0.1);
    const dim = 0.82 + sky.night * 0.18;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - r) / r;
        const dy = (y - r) / r;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) continue;
        const maria = smoothstep(0.5, 0.68, fbm(x * 0.022, y * 0.022, 4, 77)) * 0.7;
        const fine = (fbm(x * 0.12, y * 0.12, 2, 5) - 0.5) * 0.08;
        const limb = 1 - 0.22 * smoothstep(0.7, 1, d);
        const col = mixColor(lit, sea, Math.min(1, maria + fine));
        const i = (y * size + x) * 4;
        img.data[i] = col[0] * limb * dim;
        img.data[i + 1] = col[1] * limb * dim;
        img.data[i + 2] = col[2] * limb * dim;
        img.data[i + 3] = 255 * smoothstep(1, 0.985, d);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Thin cloud that tiles sideways.
  function paintCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.06, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 214;
        img.data[i + 1] = 214;
        img.data[i + 2] = 220;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- pavilion ------------------------------------------------------------

  function tone(sky, day, night) {
    return hex(mixColor(rgb(day), rgb(night), sky.night * 0.85));
  }

  // One hip roof tier with upturned corners. a: half ridge, w: half eave.
  function roofTier(ctx, g, sky, cx, yt, a, w, h, up) {
    const U = g.U;
    const tip = up * U;
    const path = new Path2D();
    path.moveTo(cx - a * U, yt * U);
    path.lineTo(cx + a * U, yt * U);
    path.quadraticCurveTo(cx + (a + (w - a) * 0.35) * U, (yt + h * 0.7) * U, cx + w * U, (yt + h) * U - tip);
    path.quadraticCurveTo(cx + (w - 2) * U, (yt + h + 1.6) * U, cx + (w - 6) * U, (yt + h + 1.6) * U);
    path.lineTo(cx - (w - 6) * U, (yt + h + 1.6) * U);
    path.quadraticCurveTo(cx - (w - 2) * U, (yt + h + 1.6) * U, cx - w * U, (yt + h) * U - tip);
    path.quadraticCurveTo(cx - (a + (w - a) * 0.35) * U, (yt + h * 0.7) * U, cx - a * U, yt * U);
    ctx.fillStyle = tone(sky, '#3d4a62', '#161c34');
    ctx.fill(path);
    // Tile rows run down the slope.
    ctx.strokeStyle = tone(sky, '#566480', '#232b48');
    ctx.lineWidth = 1;
    for (let k = -8; k <= 8; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + (k / 8) * a * U, yt * U + 1);
      ctx.lineTo(cx + (k / 8) * (w - 3) * U, (yt + h) * U - tip * Math.abs(k / 8) * 0.9);
      ctx.stroke();
    }
    // Moonlit ridge.
    ctx.strokeStyle = `rgba(232,222,180,${0.3 + 0.3 * sky.night})`;
    ctx.lineWidth = Math.max(1, U * 0.35);
    ctx.beginPath();
    ctx.moveTo(cx - a * U, yt * U);
    ctx.lineTo(cx + a * U, yt * U);
    ctx.stroke();
    // Ridge end ornaments curling up.
    ctx.fillStyle = tone(sky, '#3d4a62', '#161c34');
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * a * U, yt * U);
      ctx.quadraticCurveTo(cx + s * (a + 1.6) * U, (yt - 0.2) * U, cx + s * (a + 1.2) * U, (yt - 2.4) * U);
      ctx.quadraticCurveTo(cx + s * (a + 0.2) * U, (yt - 1.2) * U, cx + s * (a - 1.6) * U, yt * U);
      ctx.fill();
    }
  }

  function paintPavilion(ctx, g, sky) {
    const U = g.U;
    const cx = g.W * PAV.x;
    // Platform and stone steps.
    ctx.fillStyle = tone(sky, '#6a7088', '#1e243c');
    ctx.fillRect(cx - 30 * U, 86 * U, 60 * U, 3 * U);
    ctx.fillStyle = tone(sky, '#7c8298', '#262c46');
    ctx.fillRect(cx - 12 * U, 89 * U, 24 * U, 1.3 * U);
    ctx.fillRect(cx - 14 * U, 90.3 * U, 28 * U, 1.3 * U);
    // Dark hall behind the columns, with a faint lamp glow at night.
    ctx.fillStyle = tone(sky, '#242a3c', '#0c1020');
    ctx.fillRect(cx - 22 * U, 66 * U, 44 * U, 20 * U);
    const glow = ctx.createRadialGradient(cx, 74 * U, 0, cx, 74 * U, 14 * U);
    glow.addColorStop(0, `rgba(214,160,70,${0.1 + 0.28 * sky.night})`);
    glow.addColorStop(1, 'rgba(214,160,70,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 22 * U, 62 * U, 44 * U, 24 * U);
    // Lattice between the middle columns.
    ctx.strokeStyle = tone(sky, '#7a4a38', '#3a2428');
    ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - 22 * U + k * 7.3 * U, 68.5 * U);
      ctx.lineTo(cx - 22 * U + k * 7.3 * U, 80 * U);
      ctx.stroke();
    }
    for (const yy of [71, 75, 79]) {
      ctx.beginPath();
      ctx.moveTo(cx - 22 * U, yy * U);
      ctx.lineTo(cx + 22 * U, yy * U);
      ctx.stroke();
    }
    // Railing.
    ctx.fillStyle = tone(sky, '#8a3e2e', '#40222a');
    ctx.fillRect(cx - 24 * U, 80 * U, 48 * U, Math.max(1, U * 0.8));
    ctx.fillRect(cx - 24 * U, 84 * U, 48 * U, Math.max(1, U * 0.8));
    // Columns.
    for (const k of [-24, -13, 0, 13, 24]) {
      ctx.fillRect(cx + k * U - U * 0.9, 63 * U, U * 1.8, 23.5 * U);
    }
    // Bracket sets under the lower eave.
    ctx.fillStyle = tone(sky, '#2e3c5c', '#121832');
    ctx.fillRect(cx - 28 * U, 62 * U, 56 * U, 1.8 * U);
    ctx.fillStyle = tone(sky, '#c0963e', '#5a4630');
    for (let k = -26; k <= 26; k += 6.5) {
      ctx.fillRect(cx + k * U - U * 1.1, 63.3 * U, U * 2.2, U * 1.1);
    }
    roofTier(ctx, g, sky, cx, 52, 12, 34, 9, 3.2);
    ctx.fillStyle = tone(sky, '#2e3c5c', '#121832');
    ctx.fillRect(cx - 17 * U, 48.6 * U, 34 * U, 1.2 * U);
    ctx.fillStyle = tone(sky, '#8a3e2e', '#40222a');
    ctx.fillRect(cx - 14 * U, 47 * U, 28 * U, 1.8 * U);
    roofTier(ctx, g, sky, cx, 36, 7, 24, 11, 3.6);
    // Gold finial on the top ridge.
    ctx.fillStyle = tone(sky, '#b08a3a', '#8a7440');
    ctx.beginPath();
    ctx.arc(cx, 33 * U, U * 1.1, 0, 6.3);
    ctx.fill();
    ctx.fillRect(cx - U * 0.25, 33 * U, U * 0.5, 3 * U);
  }

  // ---- rockery, wall, bamboo-free ground ------------------------------------

  function paintGround(ctx, g, sky, rand) {
    const U = g.U;
    ctx.fillStyle = tone(sky, '#2c3448', '#0a0e1c');
    ctx.fillRect(0, 91 * U, g.W, g.H - 91 * U);
    ctx.strokeStyle = tone(sky, '#4a5470', '#1a2038');
    ctx.lineWidth = 1;
    for (let gx = 0; gx < g.W; gx += U * 7) {
      ctx.beginPath();
      ctx.moveTo(gx, 91 * U);
      ctx.lineTo(gx - U * 3, g.H);
      ctx.stroke();
    }
    // Garden wall with a tile cap, left of the pavilion.
    const wx = g.W * 0.2;
    const ww = g.W * 0.2;
    ctx.fillStyle = tone(sky, '#aeb2bc', '#2a3050');
    ctx.fillRect(wx, 80 * U, ww, 11 * U);
    ctx.fillStyle = tone(sky, '#3d4a62', '#161c34');
    ctx.fillRect(wx - U, 78 * U, ww + 2 * U, 2.2 * U);
    // Rockery, rough taihu forms with holes.
    ctx.fillStyle = tone(sky, '#4a5468', '#141a2e');
    const rocks = [[0.045, 58, 9], [0.085, 70, 11], [0.02, 78, 8]];
    for (const [fx, top, rad] of rocks) {
      ctx.beginPath();
      ctx.moveTo(g.W * fx - rad * U * 1.3, 92 * U);
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI + (k / 10) * Math.PI;
        const wob = 1 + (rand() - 0.5) * 0.3;
        ctx.lineTo(g.W * fx + Math.cos(a) * rad * U * 1.3 * wob, 92 * U - (92 - top) * U * Math.sin(-a + Math.PI * 0) * -1 * wob * 0 + (top - 92) * U * Math.sin(k / 10 * Math.PI) * wob);
      }
      ctx.lineTo(g.W * fx + rad * U * 1.3, 92 * U);
      ctx.fill();
    }
    ctx.fillStyle = tone(sky, '#242c40', '#080c18');
    for (const [fx, cy, rad] of [[0.085, 78, 2.2], [0.045, 70, 1.6]]) {
      ctx.beginPath();
      ctx.ellipse(g.W * fx, cy * U, rad * U * 0.8, rad * U, 0, 0, 6.3);
      ctx.fill();
    }
    // Moss along the foot.
    ctx.fillStyle = tone(sky, '#4a6a4a', '#18281e');
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.4 + rand() * 0.4;
      ctx.fillRect(rand() * g.W * 0.14, 88 * U + rand() * 3 * U, 1 + rand() * U, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- osmanthus -----------------------------------------------------------

  function leaf(ctx, x, y, ang, len, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, len, len * 0.36, ang, 0, 6.3);
    ctx.fill();
  }

  function blossoms(ctx, g, x, y, rand) {
    const U = g.U;
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = rand() > 0.35 ? '#d9b44a' : '#e8d58a';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x + (rand() - 0.5) * U * 2.4, y + (rand() - 0.5) * U * 2.4, Math.max(0.8, U * 0.34), 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function branch(ctx, g, sky, p0, p1, p2, rand) {
    const U = g.U;
    const dark = tone(sky, '#3a4a3a', '#0e1620');
    const leafCol = tone(sky, '#4a6a4a', '#16261c');
    const leafCol2 = tone(sky, '#5c7c52', '#1e3322');
    ctx.strokeStyle = tone(sky, '#3a3430', '#10121a');
    ctx.lineWidth = Math.max(1.5, U * 0.8);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
    ctx.stroke();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
      const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
      const side = i % 2 ? 1 : -1;
      const ox = x + (rand() - 0.2) * U * 1.5;
      const oy = y + side * U * (1.5 + rand() * 2.2);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ox, oy);
      ctx.stroke();
      leaf(ctx, ox, oy, side * (0.5 + rand() * 0.8), U * (1.8 + rand() * 1.2), rand() > 0.5 ? leafCol : leafCol2);
      leaf(ctx, x, y, -side * (0.4 + rand() * 0.9), U * (1.6 + rand()), leafCol);
      if (t > 0.15 && rand() > 0.35) blossoms(ctx, g, ox, oy + side * U * 0.4, rand);
    }
  }

  function paintBranches(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    branch(ctx, g, sky, [-U * 4, 40 * U], [18 * U, 4 * U], [64 * U, 9 * U], rand);
    branch(ctx, g, sky, [-U * 2, 48 * U], [10 * U, 30 * U], [30 * U, 54 * U], rand);
    branch(ctx, g, sky, [g.W + U * 4, 6 * U], [g.W * 0.9, 20 * U], [g.W * 0.7, 21 * U], rand);
    branch(ctx, g, sky, [g.W + U * 4, 20 * U], [g.W * 0.96, 36 * U], [g.W * 0.9, 34 * U], rand);
    return c;
  }

  // ---- sprites -------------------------------------------------------------

  function paintPetal() {
    const c = layer(8, 8);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e0bd54';
    ctx.beginPath();
    ctx.ellipse(4, 4, 3.2, 1.8, 0.6, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintLantern(g) {
    const s = Math.max(6, Math.round(g.U * 7));
    const c = layer(s * 3, s * 3);
    const ctx = c.getContext('2d');
    const m = s * 1.5;
    const halo = ctx.createRadialGradient(m, m * 1.1, 0, m, m * 1.1, m);
    halo.addColorStop(0, 'rgba(214,120,60,0.4)');
    halo.addColorStop(1, 'rgba(214,120,60,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, s * 3, s * 3);
    ctx.fillStyle = '#b4412c';
    ctx.beginPath();
    ctx.ellipse(m, m * 1.1, s * 0.5, s * 0.65, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = '#7a2a20';
    ctx.lineWidth = 1;
    for (const k of [-0.25, 0, 0.25]) {
      ctx.beginPath();
      ctx.ellipse(m, m * 1.1, s * (0.5 - Math.abs(k) * 0.3) * Math.abs(1 - k), s * 0.65, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.fillStyle = '#c0963e';
    ctx.fillRect(m - s * 0.22, m * 1.1 - s * 0.74, s * 0.44, s * 0.14);
    ctx.fillRect(m - s * 0.22, m * 1.1 + s * 0.6, s * 0.44, s * 0.14);
    ctx.fillRect(m - 0.5, m * 1.1 + s * 0.74, 1, s * 0.5);
    return c;
  }

  // ---- bake ----------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGround(ctx, g, sky, rand);
    paintPavilion(ctx, g, sky);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(51);
    state.sky = paintSky(g, sky, rand);
    state.moon = paintMoon(g, sky);
    state.front = paintFront(g, sky, rand);
    state.branches = paintBranches(g, sky, rand);
    state.cloudAlpha = 0.5 + sky.night * 0.3;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion --------------------------------------------------------------

  function drawCloud(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.cloud;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.U * 10);
    ctx.drawImage(c, off + c.width, g.U * 10);
    ctx.globalAlpha = 1;
  }

  function drawBranches(ctx, g, t) {
    const sway = Math.sin(t * 0.5) * g.U * 0.5;
    const lift = Math.sin(t * 0.37 + 1) * g.U * 0.3;
    ctx.drawImage(state.branches, sway, lift);
  }

  function drawLantern(ctx, g, t) {
    const s = state.lantern;
    const cx = g.W * PAV.x;
    const swing = Math.sin(t * 0.9) * 0.1;
    ctx.save();
    ctx.translate(cx, g.U * 63.6);
    ctx.rotate(swing);
    ctx.drawImage(s, -s.width / 2, -s.height * 0.5 + g.U * 0.5);
    ctx.restore();
  }

  function drawPetals(ctx, g, t, amount) {
    const n = Math.floor(MAX_PETALS * Math.min(2, amount));
    const p = state.petal;
    for (let i = 0; i < n; i++) {
      const life = 26 + (i % 7) * 3;
      const a = ((t + i * 5.7) % life) / life;
      const x0 = g.W * (0.18 + ((i * 0.6180339) % 1) * 0.82);
      const x = x0 - a * g.U * 18 + Math.sin(t * 0.8 + i * 1.9) * g.U * 2.2;
      const y = -g.U * 2 + a * (g.H + g.U * 4);
      const size = g.U * (0.8 + (i % 4) * 0.28);
      ctx.globalAlpha = 0.85 * Math.min(1, a * 10) * Math.min(1, (1 - a) * 6);
      ctx.drawImage(p, x, y, size, size * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.cloud = paintCloud(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.45));
    state.petal = paintPetal();
    state.lantern = paintLantern(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    const r = state.moon.width / 2;
    ctx.drawImage(state.moon, g.W * MOON.x - r, g.U * MOON.y - r);
    drawCloud(ctx, g, t, props.cloud);
    ctx.drawImage(state.front, 0, 0);
    drawLantern(ctx, g, t);
    drawBranches(ctx, g, t);
    drawPetals(ctx, g, t, props.petals);
  }

  Kasuri.run({
    defaults: { time: 'auto', petals: 1, cloud: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
