/*
 * 縁側 Engawa — a wooden veranda on a summer evening, looking out on a small garden.
 *
 * Sky, garden and the house frame are baked into two layers and repainted once a
 * minute from the clock. Between repaints only clouds, the coil smoke, the wind
 * chime and a few fireflies after dark move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, smoothstep, toHex, parseColor } = K;

  const TAU = Math.PI * 2;
  const EAVE = 0.13;
  const HORIZON = 0.5;
  const LIP = 0.665;
  const POSTS = [0.055, 0.93];
  const COIL = { x: 0.2, y: 0.85 };
  const CHIME = { x: 0.64, y: EAVE };
  const RETINT_SECONDS = 60;
  const PUFFS = 36;
  const FLIES = 9;
  const WOOD = { eave: '#3a2a20', rafter: '#2a1e17', post: '#5a4030', postLit: '#7a5a40', board: ['#a07a52', '#946e48', '#aa845a'], gap: '#4a3424', lip: '#5e4330' };
  const state = {};

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

  // Multiply a colour by the sky light, k = how much of the light it takes.
  function lit(hex, amb, k) {
    const c = parseColor(hex);
    return toHex([0, 1, 2].map((i) => c[i] * lerp(1, amb[i] / 255, k)));
  }

  // ---- sky ------------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H * LIP);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.H * EAVE, 0, g.H * HORIZON);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, g.H * (EAVE + rand() * 0.25), 1, 1);
      }
      ctx.globalAlpha = sky.night;
      ctx.fillStyle = '#ece6cf';
      blob(ctx, g.W * 0.27, g.H * 0.22, g.U * 3.2, g.U * 3.2);
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.09, 4, 37);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff(rgb) {
    const c = layer(24, 24);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    grad.addColorStop(0, `rgba(${rgb},0.85)`);
    grad.addColorStop(0.5, `rgba(${rgb},0.35)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 24);
    return c;
  }

  // ---- garden ----------------------------------------------------------------

  function treeLine(g, x) {
    return g.H * 0.3 + fbm(x / (g.U * 22), 2.2, 4, 17) * g.H * 0.14;
  }

  function paintTrees(ctx, g, rand) {
    ctx.fillStyle = '#3a4a3a';
    ctx.beginPath();
    ctx.moveTo(0, g.H * LIP);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, treeLine(g, x));
    ctx.lineTo(g.W, g.H * LIP);
    ctx.fill();
    const inks = ['#2c3c2e', '#435a40', '#58704c'];
    for (let x = 0; x < g.W; x += g.U * (3 + rand() * 3)) {
      const y = treeLine(g, x) + g.U * 2;
      const r = g.U * (2.5 + rand() * 2.5);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = inks[k];
        blob(ctx, x - r * 0.25 * k, y - r * 0.2 * k, r * (1 - k * 0.3), r * (0.8 - k * 0.25));
      }
    }
  }

  function paintHedge(ctx, g, rand) {
    const top = g.H * 0.52;
    ctx.fillStyle = '#2e4430';
    ctx.fillRect(0, top + g.U * 2, g.W, g.H * LIP - top);
    for (let x = -g.U * 4; x < g.W + g.U * 4; x += g.U * (5 + rand() * 4)) {
      const r = g.U * (4 + rand() * 2.5);
      const y = top + g.U * (2 + rand() * 2);
      ctx.fillStyle = '#2e4430';
      blob(ctx, x, y + r * 0.2, r * 1.2, r * 0.75);
      ctx.fillStyle = '#466244';
      blob(ctx, x - r * 0.25, y - r * 0.1, r * 0.85, r * 0.45);
      ctx.fillStyle = '#5e7a50';
      blob(ctx, x - r * 0.45, y - r * 0.25, r * 0.4, r * 0.18);
    }
  }

  function paintHydrangea(ctx, g, rand, cx, cy, spread) {
    const inks = [['#3c4a7c', '#5a68a0', '#8a92c0'], ['#5a4a80', '#7a68a4', '#a898c4']];
    for (let i = 0; i < 9; i++) {
      const x = cx + (rand() - 0.5) * spread;
      const y = cy + (rand() - 0.5) * spread * 0.35;
      const r = g.U * (1.6 + rand() * 0.9);
      const ink = inks[rand() < 0.6 ? 0 : 1];
      ctx.fillStyle = ink[0];
      blob(ctx, x, y, r, r * 0.85);
      ctx.fillStyle = ink[1];
      blob(ctx, x - r * 0.2, y - r * 0.2, r * 0.7, r * 0.6);
      ctx.fillStyle = ink[2];
      blob(ctx, x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.25);
    }
  }

  // A stone lantern: base, post, light box, umbrella cap and knob.
  function paintLantern(ctx, g, x, base) {
    const u = g.U;
    const parts = [
      [3.2, 1.4, '#6e6c62'], [1.3, 5, '#7e7b70'], [2.6, 1.2, '#6e6c62'],
      [2.0, 3.0, '#858174'], [4.4, 1.3, '#5e5c54'], [1.0, 1.1, '#6e6c62'],
    ];
    let y = base;
    for (const [hw, h, ink] of parts) {
      ctx.fillStyle = ink;
      ctx.fillRect(x - hw * u, y - h * u, hw * 2 * u, h * u);
      y -= h * u;
    }
    state.lanternWindow = { x, y: base - u * 9.1, w: u * 1.6, h: u * 1.6 };
  }

  function paintGround(ctx, g, rand) {
    const y0 = g.H * 0.6;
    ctx.fillStyle = '#4a5c3c';
    ctx.fillRect(0, y0, g.W, g.H * LIP - y0);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#8a8676' : '#9a9584';
      blob(ctx, g.W * (0.42 + i * 0.07), y0 + g.U * (2 + (i % 2) * 1.5), g.U * 2.4, g.U * 0.8);
    }
  }

  function paintGarden(ctx, g, sky, rand) {
    paintTrees(ctx, g, rand);
    paintHedge(ctx, g, rand);
    paintGround(ctx, g, rand);
    paintHydrangea(ctx, g, rand, g.W * 0.14, g.H * 0.585, g.U * 16);
    paintHydrangea(ctx, g, rand, g.W * 0.8, g.H * 0.6, g.U * 12);
    paintLantern(ctx, g, g.W * 0.33, g.H * 0.625);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = toHex(sky.amb.map((v) => lerp(v, 255, 0.3)));
    ctx.fillRect(0, g.H * EAVE, g.W, g.H * (LIP - EAVE) + 1);
    ctx.globalCompositeOperation = 'source-over';
    const lw = state.lanternWindow;
    ctx.fillStyle = sky.night > 0.3 ? '#e0a050' : '#3a3a34';
    ctx.fillRect(lw.x - lw.w / 2, lw.y, lw.w, lw.h);
  }

  // ---- the house ---------------------------------------------------------------

  function paintEave(ctx, g, amb) {
    const h = g.H * EAVE;
    ctx.fillStyle = lit(WOOD.eave, amb, 0.6);
    ctx.fillRect(0, 0, g.W, h);
    ctx.fillStyle = lit(WOOD.rafter, amb, 0.6);
    for (let x = g.U * 2; x < g.W; x += g.U * 6) ctx.fillRect(x, h * 0.25, g.U * 2.2, h * 0.55);
    ctx.fillStyle = lit('#6a4c36', amb, 0.6);
    ctx.fillRect(0, h * 0.82, g.W, h * 0.18);
  }

  // A bamboo blind half let down on the right.
  function paintBlind(ctx, g, amb) {
    const x0 = g.W * 0.76;
    const x1 = g.W * POSTS[1];
    const y0 = g.H * EAVE;
    const y1 = g.H * 0.36;
    ctx.globalAlpha = 0.82;
    for (let y = y0; y < y1; y += Math.max(1, g.U * 0.7)) {
      ctx.fillStyle = lit((Math.round(y) & 1) ? '#b0905c' : '#9a7a4c', amb, 0.5);
      ctx.fillRect(x0, y, x1 - x0, Math.max(1, g.U * 0.45));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = lit('#6a5034', amb, 0.5);
    ctx.fillRect(x0, y1 - g.U * 0.8, x1 - x0, g.U * 0.8);
    ctx.fillStyle = lit('#c0503a', amb, 0.4);
    ctx.fillRect(x0 + (x1 - x0) * 0.3, y0, g.U * 0.4, y1 - y0 + g.U * 2);
    ctx.fillRect(x0 + (x1 - x0) * 0.7, y0, g.U * 0.4, y1 - y0 + g.U * 2);
  }

  function paintPosts(ctx, g, amb) {
    const w = g.U * 4.5;
    for (const p of POSTS) {
      const x = g.W * p - w / 2;
      ctx.fillStyle = lit(WOOD.post, amb, 0.6);
      ctx.fillRect(x, 0, w, g.H * LIP + g.U);
      ctx.fillStyle = lit(WOOD.postLit, amb, 0.6);
      ctx.fillRect(x + w * 0.6, 0, w * 0.25, g.H * LIP + g.U);
    }
  }

  // Boards run along the veranda and widen toward the viewer.
  function paintFloor(ctx, g, amb, rand) {
    let y = g.H * LIP;
    ctx.fillStyle = lit(WOOD.lip, amb, 0.6);
    ctx.fillRect(0, y, g.W, g.U * 1.4);
    y += g.U * 1.4;
    let i = 0;
    while (y < g.H) {
      const f = (y - g.H * LIP) / (g.H * (1 - LIP));
      const h = g.U * (2 + f * 6);
      ctx.fillStyle = lit(WOOD.board[i % 3], amb, 0.55);
      ctx.fillRect(0, y, g.W, h);
      ctx.fillStyle = lit('#b89468', amb, 0.55);
      for (let k = 0; k < 4; k++) ctx.fillRect(rand() * g.W, y + h * (0.3 + rand() * 0.4), g.U * (6 + rand() * 14), Math.max(1, h * 0.06));
      ctx.fillStyle = lit(WOOD.gap, amb, 0.6);
      ctx.fillRect(0, y + h - Math.max(1, g.U * 0.35), g.W, Math.max(1, g.U * 0.35));
      ctx.fillRect(g.W * ((0.3 + i * 0.37) % 1), y, Math.max(1, g.U * 0.3), h);
      y += h;
      i++;
    }
  }

  // Warm light from the room behind, falling across the boards after dark.
  function paintRoomGlow(ctx, g, night) {
    if (night < 0.15) return;
    const grad = ctx.createRadialGradient(g.W * 0.35, g.H * 1.15, 0, g.W * 0.35, g.H * 1.15, g.H * 0.75);
    grad.addColorStop(0, `rgba(224,170,96,${0.45 * night})`);
    grad.addColorStop(1, 'rgba(224,170,96,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.H * LIP, g.W, g.H * (1 - LIP));
  }

  // The coil on its dish, wound inward, ember on the outer end.
  function paintCoil(ctx, g, amb) {
    const cx = g.W * COIL.x;
    const cy = g.H * COIL.y;
    const u = g.U;
    ctx.fillStyle = lit('#2a2c3c', amb, 0.3);
    blob(ctx, cx + u * 0.6, cy + u * 1.4, u * 8.5, u * 2.8);
    ctx.fillStyle = lit('#3c4a6c', amb, 0.4);
    blob(ctx, cx, cy, u * 8, u * 2.6);
    ctx.fillStyle = lit('#55648a', amb, 0.4);
    blob(ctx, cx, cy - u * 0.3, u * 7, u * 2);
    ctx.strokeStyle = lit('#3e5034', amb, 0.4);
    ctx.lineWidth = Math.max(1, u * 0.8);
    ctx.beginPath();
    for (let a = 0; a <= TAU * 3.2; a += 0.15) {
      const r = u * (1 + a * 0.3);
      const x = cx + Math.cos(a) * r;
      const y = cy - u * 0.4 + Math.sin(a) * r * 0.3;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const a = TAU * 3.2;
    const r = u * (1 + a * 0.3);
    state.ember = { x: cx + Math.cos(a) * r, y: cy - u * 0.4 + Math.sin(a) * r * 0.3 };
  }

  // A round paper fan lying on the boards.
  function paintFan(ctx, g, amb) {
    const cx = g.W * 0.44;
    const cy = g.H * 0.9;
    const u = g.U;
    ctx.strokeStyle = lit('#7a5a36', amb, 0.4);
    ctx.lineWidth = Math.max(1, u * 1.2);
    ctx.beginPath();
    ctx.moveTo(cx + u * 5, cy + u * 1.5);
    ctx.lineTo(cx + u * 13, cy + u * 4);
    ctx.stroke();
    ctx.fillStyle = lit('#2c3a6a', amb, 0.4);
    blob(ctx, cx, cy, u * 7.4, u * 3.6);
    ctx.fillStyle = lit('#e8e0cc', amb, 0.4);
    blob(ctx, cx, cy, u * 6.6, u * 3.1);
    ctx.fillStyle = lit('#c2462e', amb, 0.4);
    blob(ctx, cx - u * 1.5, cy - u * 0.3, u * 2.6, u * 1.3);
    ctx.fillStyle = lit('#3c5a8a', amb, 0.4);
    for (let i = 0; i < 3; i++) blob(ctx, cx + u * (1.5 + i * 1.4), cy + u * (0.6 - i * 0.5), u * 1.2, u * 0.4);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGarden(ctx, g, sky, rand);
    const amb = sky.amb.map((v) => lerp(v, 120, sky.night * 0.35));
    paintEave(ctx, g, amb);
    paintBlind(ctx, g, amb);
    paintPosts(ctx, g, amb);
    paintFloor(ctx, g, amb, rand);
    paintRoomGlow(ctx, g, sky.night);
    paintCoil(ctx, g, amb);
    paintFan(ctx, g, amb);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * (EAVE + 0.01));
    ctx.drawImage(c, off + c.width, g.H * (EAVE + 0.01));
    ctx.globalAlpha = 1;
  }

  // Smoke rises in a thin ribbon, then loosens and curls as the breeze takes it.
  function drawSmoke(ctx, g, t, amount, breeze) {
    if (amount <= 0) return;
    const e = state.ember;
    const rise = g.H * 0.5;
    for (let i = 0; i < PUFFS; i++) {
      const a = (t * 0.05 + i / PUFFS) % 1;
      const curl = Math.sin(a * 9 - t * 0.6) * g.U * (0.5 + a * 5);
      const drift = a * a * g.U * 14 * breeze;
      const size = g.U * (1.8 + a * 8);
      const x = e.x + curl + drift;
      const y = e.y - a * rise;
      ctx.globalAlpha = Math.min(1, amount * 0.75) * smoothstep(0, 0.06, a) * (1 - a);
      ctx.drawImage(state.puff, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d6452c';
    ctx.fillRect(e.x - g.U * 0.6, e.y - g.U * 0.6, g.U * 1.2, g.U * 1.2);
  }

  // A glass bell with a paper strip, swinging under the eave.
  function drawChime(ctx, g, t, breeze) {
    const u = g.U;
    const swing = Math.sin(t * 1.1) * 0.12 * breeze + Math.sin(t * 2.3) * 0.04 * breeze;
    ctx.save();
    ctx.translate(g.W * CHIME.x, g.H * CHIME.y);
    ctx.rotate(swing);
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(-0.5, 0, 1, u * 4);
    ctx.fillStyle = '#c4cfd6';
    ctx.beginPath();
    ctx.arc(0, u * 7, u * 3, Math.PI, 0);
    ctx.lineTo(u * 3, u * 7.4);
    ctx.lineTo(-u * 3, u * 7.4);
    ctx.fill();
    ctx.fillStyle = '#c2462e';
    ctx.fillRect(-u * 2.6, u * 5.6, u * 1.4, u * 1.4);
    ctx.fillRect(u * 0.8, u * 5.2, u * 1.4, u * 1.4);
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(-0.5, u * 7, 1, u * 4);
    ctx.rotate(swing * 1.6);
    ctx.fillStyle = '#e8e0cc';
    ctx.fillRect(-u * 1.2, u * 10.5, u * 2.4, u * 8);
    ctx.fillStyle = '#3c5a8a';
    ctx.fillRect(-u * 1.2, u * 16.5, u * 2.4, u * 0.8);
    ctx.restore();
  }

  function drawFlies(ctx, g, t) {
    if (state.night < 0.3) return;
    ctx.fillStyle = '#e2d080';
    for (let i = 0; i < FLIES; i++) {
      const x = g.W * (0.12 + ((i * 0.37 + Math.sin(t * 0.07 + i) * 0.05) % 0.76));
      const y = g.H * (0.5 + Math.sin(t * 0.21 + i * 2.1) * 0.05 + (i % 3) * 0.03);
      ctx.globalAlpha = state.night * (0.45 + 0.35 * Math.sin(t * 0.8 + i * 1.7));
      ctx.fillRect(x, y, Math.max(1, g.U * 0.9), Math.max(1, g.U * 0.9));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2));
    state.puff = paintPuff('226,222,210');
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawFlies(ctx, g, t);
    drawChime(ctx, g, t, props.breeze);
    drawSmoke(ctx, g, t, props.smoke, props.breeze);
  }

  Kasuri.run({
    defaults: { time: 'auto', smoke: 1, breeze: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
