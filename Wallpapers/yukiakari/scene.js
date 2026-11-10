/*
 * 雪明かり Yukiakari — a snow village at night, lit by the glow of the snow itself.
 *
 * Sky, hills, cedars, thatched farmhouses and the drifts are baked once and
 * repainted once a minute from the clock. Between repaints only flakes,
 * hearth smoke and a faint lamp flicker move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, smoothstep, fbm } = K;

  const GROUND = 0.72;
  const RETINT_SECONDS = 60;
  const FLAKES = 150;
  const PUFFS = 9;
  const HOUSES = [
    { x: 0.2, s: 1.0, lit: [0, 1] },
    { x: 0.52, s: 1.25, lit: [0, 1, 2] },
    { x: 0.82, s: 0.9, lit: [1] },
  ];
  const state = {};

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // Colours that swing between day and night.
  function tones(sky) {
    const n = sky.night;
    const snowLit = mixColor(rgb('#f0f0ea'), sky.amb, 0.25);
    return {
      snow: mixColor(snowLit, rgb('#a4b0d0'), n * 0.6),
      snowShade: mixColor(mixColor(rgb('#c8d0de'), sky.haze, 0.3), rgb('#4a5688'), n * 0.65),
      thatch: mixColor(rgb('#6a5a40'), rgb('#2a2a3a'), n * 0.7),
      wall: mixColor(rgb('#4a3a2c'), rgb('#1a1a28'), n * 0.75),
      cedar: mixColor(rgb('#3c5a46'), rgb('#141c2a'), n * 0.8),
      hill: mixColor(mixColor(rgb('#c4ccd8'), sky.haze, 0.5), rgb('#3a4674'), n * 0.6),
      glow: mixColor(rgb('#e6bd62'), rgb('#f2d27a'), n),
    };
  }

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const n = sky.night;
    const top = mixColor(sky.top, rgb('#3a4472'), n * 0.4);
    const low = mixColor(sky.low, rgb('#b0bad4'), n * 0.7);
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * GROUND);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (n > 0.1) {
      // Snow cloud mottling and a few stars high up.
      const img = ctx.getImageData(0, 0, g.W, Math.ceil(g.H * GROUND));
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const v = (fbm(x * 0.02, y * 0.05, 3, 7) - 0.5) * 26 * n;
          const i = (y * img.width + x) * 4;
          img.data[i] += v;
          img.data[i + 1] += v;
          img.data[i + 2] += v * 1.1;
        }
      }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = n * (0.1 + rand() * 0.3);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.2, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintHills(ctx, g, t) {
    ctx.fillStyle = hex(t.hill);
    ctx.beginPath();
    ctx.moveTo(0, g.H * GROUND);
    for (let x = 0; x <= g.W; x += 2) {
      const y = g.H * (0.5 - 0.1 * smoothstep(0.1, 0.9, fbm(x * 0.006, 3, 3, 4)) - 0.06 * Math.sin(x / g.W * 5));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H * GROUND);
    ctx.closePath();
    ctx.fill();
    // Cedar ridge, a row of dark pointed trees.
    ctx.fillStyle = hex(mixColor(t.cedar, t.hill, 0.45));
    for (let x = 0; x < g.W; x += g.U * 2.4) {
      const hh = g.U * (6 + fbm(x * 0.05, 1, 2, 3) * 8);
      const by = g.H * 0.63;
      poly(ctx, [x - g.U * 1.3, by, x, by - hh, x + g.U * 1.3, by]);
    }
    ctx.fillRect(0, g.H * 0.63, g.W, g.H * (GROUND - 0.63));
  }

  function paintGround(ctx, g, t, sky) {
    const top = g.H * GROUND;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(t.snow));
    grad.addColorStop(1, hex(mixColor(t.snowShade, t.snow, 0.35)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Soft drifts.
    ctx.fillStyle = hex(t.snowShade);
    ctx.globalAlpha = 0.5;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 3) ctx.lineTo(x, g.H * (0.88 + k * 0.045) + Math.sin(x * 0.012 + k * 2) * g.U * 1.2);
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintCedar(ctx, g, t, cx, base, s) {
    ctx.fillStyle = hex(t.wall);
    ctx.fillRect(cx - s * 0.25, base - s * 2, s * 0.5, s * 2);
    for (let k = 0; k < 5; k++) {
      const w = s * (1.9 - k * 0.22);
      const y = base - s * (2 + k * 3.4);
      ctx.fillStyle = hex(t.cedar);
      poly(ctx, [cx - w, y, cx, y - s * 5, cx + w, y]);
      ctx.fillStyle = hex(t.snow);
      ctx.globalAlpha = 0.9;
      poly(ctx, [cx - w * 0.5, y - s * 2.5, cx, y - s * 5, cx + w * 0.5, y - s * 2.5, cx, y - s * 2]);
      ctx.globalAlpha = 1;
    }
  }

  // A steep thatched farmhouse with the gable toward us and snow on the roof.
  function paintHouse(ctx, g, t, house, rand) {
    const u = g.U * house.s;
    const cx = g.W * house.x;
    const base = g.H * (GROUND + 0.05);
    const wallW = u * 22;
    const wallH = u * 9;
    const ridgeY = base - wallH - u * 17;
    const eaveY = base - wallH + u * 1.5;
    const eaveW = wallW + u * 7;
    // Wall
    ctx.fillStyle = hex(t.wall);
    ctx.fillRect(cx - wallW / 2, base - wallH, wallW, wallH);
    // Roof thatch with its flared base
    ctx.fillStyle = hex(t.thatch);
    poly(ctx, [cx - eaveW / 2, eaveY, cx - u * 1.4, ridgeY, cx + u * 1.4, ridgeY, cx + eaveW / 2, eaveY]);
    // Snow lying on the roof, ragged along its lower edge
    ctx.fillStyle = hex(t.snow);
    poly(ctx, [cx - eaveW * 0.4, eaveY - u * 2.5, cx - u * 1.4, ridgeY - u * 0.8, cx + u * 1.4, ridgeY - u * 0.8, cx + eaveW * 0.4, eaveY - u * 2.5, cx, eaveY - u * 5]);
    ctx.fillStyle = hex(t.snowShade);
    ctx.globalAlpha = 0.5;
    poly(ctx, [cx, ridgeY, cx + u * 1.4, ridgeY, cx + eaveW * 0.46, eaveY - u * 1.5, cx + eaveW * 0.2, eaveY - u * 3]);
    ctx.globalAlpha = 1;
    // Thatch fringe peeking under the snow at the eave
    ctx.fillStyle = hex(t.thatch);
    ctx.fillRect(cx - eaveW / 2, eaveY - u * 0.5, eaveW, u * 1.4);
    ctx.fillStyle = hex(t.snow);
    for (let i = 0; i < 18; i++) ctx.fillRect(cx - eaveW / 2 + (i + rand()) * eaveW / 18, eaveY - u * 0.8, u * 0.7, u * (0.5 + rand() * 0.8));
    // Crossed gable beams
    ctx.strokeStyle = hex(t.wall);
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - u * 1.6, ridgeY - u * 2.4);
    ctx.lineTo(cx + u * 1.6, ridgeY - u * 0.2);
    ctx.moveTo(cx + u * 1.6, ridgeY - u * 2.4);
    ctx.lineTo(cx - u * 1.6, ridgeY - u * 0.2);
    ctx.stroke();
    // Wall timbers and shoji windows
    ctx.fillStyle = hex(mixColor(t.wall, rgb('#000000'), 0.3));
    for (let i = 0; i <= 4; i++) ctx.fillRect(cx - wallW / 2 + i * wallW / 4, base - wallH, Math.max(1, u * 0.5), wallH);
    ctx.fillRect(cx - wallW / 2, base - wallH, wallW, Math.max(1, u * 0.6));
    const winY = base - wallH * 0.82;
    const winH = wallH * 0.5;
    const winW = wallW / 4 - u * 1.4;
    house.windows = [];
    for (let i = 0; i < 4; i++) {
      const wx = cx - wallW / 2 + i * wallW / 4 + u * 0.7;
      const lit = house.lit.includes(i) || (house.lit.length > 2 && i === 3);
      if (lit) house.windows.push({ x: wx, y: winY, w: winW, h: winH });
      ctx.fillStyle = lit ? hex(t.glow) : hex(mixColor(t.wall, t.snowShade, 0.3));
      ctx.fillRect(wx, winY, winW, winH);
      ctx.fillStyle = hex(t.wall);
      ctx.fillRect(wx + winW / 2, winY, Math.max(1, u * 0.35), winH);
      ctx.fillRect(wx, winY + winH / 2, winW, Math.max(1, u * 0.35));
    }
    // Snow banked along the foot of the wall
    ctx.fillStyle = hex(t.snow);
    ctx.beginPath();
    ctx.moveTo(cx - wallW / 2 - u * 2, base + u * 1.5);
    for (let x = -1; x <= 1.001; x += 0.1) ctx.lineTo(cx + x * (wallW / 2 + u * 2), base - u * (1.6 - Math.abs(x) * 0.8 + rand() * 0.5));
    ctx.lineTo(cx + wallW / 2 + u * 2, base + u * 1.5);
    ctx.fill();
    house.smokeAt = { x: cx, y: ridgeY - u * 1.5 };
  }

  // Warm light spilling onto the snow below each lit window.
  function paintSpill(ctx, g, t, house, sky) {
    const a = 0.12 + sky.night * 0.28;
    for (const w of house.windows) {
      const cx = w.x + w.w / 2;
      const r = g.U * 12 * house.s;
      const grad = ctx.createRadialGradient(cx, g.H * (GROUND + 0.06), 0, cx, g.H * (GROUND + 0.06), r);
      grad.addColorStop(0, `rgba(240,196,100,${a})`);
      grad.addColorStop(1, 'rgba(240,196,100,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r, g.H * (GROUND + 0.06) - r, r * 2, r * 2);
    }
  }

  function paintLantern(ctx, g, t, x, base, s, sky) {
    ctx.fillStyle = hex(mixColor(rgb('#6a6a70'), rgb('#26283a'), sky.night * 0.6));
    ctx.fillRect(x - s * 0.5, base - s * 5, s, s * 5);
    ctx.fillRect(x - s * 1.6, base - s * 6.2, s * 3.2, s * 1.2);
    ctx.fillStyle = hex(t.glow);
    ctx.fillRect(x - s * 0.6, base - s * 7.6, s * 1.2, s * 1.4);
    ctx.fillStyle = hex(mixColor(rgb('#6a6a70'), rgb('#26283a'), sky.night * 0.6));
    poly(ctx, [x - s * 2, base - s * 7.6, x, base - s * 9.4, x + s * 2, base - s * 7.6]);
    ctx.fillStyle = hex(t.snow);
    poly(ctx, [x - s * 1.5, base - s * 7.8, x, base - s * 9.8, x + s * 1.5, base - s * 7.8]);
  }

  function paintFront(g, sky, rand) {
    const t = tones(sky);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHills(ctx, g, t);
    paintGround(ctx, g, t, sky);
    for (const x of [0.04, 0.36, 0.67, 0.96]) paintCedar(ctx, g, t, g.W * x, g.H * (GROUND + 0.035 + rand() * 0.02), g.U * (1.5 + rand() * 0.5));
    for (const h of HOUSES) paintHouse(ctx, g, t, h, rand);
    for (const h of HOUSES) paintSpill(ctx, g, t, h, sky);
    paintLantern(ctx, g, t, g.W * 0.36, g.H * 0.88, g.U * 0.9, sky);
    return c;
  }

  // Window glow overlay that breathes very slightly.
  function paintGlowSprite() {
    const c = layer(16, 16);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4d884';
    ctx.fillRect(0, 0, 16, 16);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(230,230,226,0.55)');
    grad.addColorStop(1, 'rgba(230,230,226,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function seedFlakes(g) {
    const rand = K.rng(77);
    const f = new Float32Array(FLAKES * 4);
    for (let i = 0; i < FLAKES; i++) {
      f[i * 4] = rand() * g.W;
      f[i * 4 + 1] = rand() * g.H;
      f[i * 4 + 2] = 0.4 + rand() * 0.9; // depth
      f[i * 4 + 3] = rand() * 6.3;
    }
    return f;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawGlow(ctx, t) {
    const a = (0.1 + state.night * 0.18) * (0.8 + 0.2 * Math.sin(t * 1.3));
    ctx.globalAlpha = a;
    for (const h of HOUSES) {
      for (let i = 0; i < h.windows.length; i++) {
        const w = h.windows[i];
        const k = 0.75 + 0.25 * Math.sin(t * 1.7 + i * 2.1 + h.x * 9);
        ctx.globalAlpha = a * k;
        ctx.drawImage(state.glow, w.x, w.y, w.w, w.h);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t) {
    for (const h of HOUSES) {
      if (!h.smokeAt) continue;
      for (let i = 0; i < PUFFS; i++) {
        const a = (t * 0.05 + i / PUFFS + h.x) % 1;
        const size = g.U * (2 + a * 8);
        const x = h.smokeAt.x + Math.sin(t * 0.5 + i + h.x * 7) * g.U * 0.8 + a * g.U * 6;
        const y = h.smokeAt.y - a * g.U * 20;
        ctx.globalAlpha = (1 - a) * 0.7;
        ctx.drawImage(state.puff, x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFlakes(ctx, g, t, amount) {
    const n = Math.floor(FLAKES * Math.min(1, amount));
    const f = state.flakes;
    ctx.fillStyle = state.night > 0.5 ? '#eef0f4' : '#ffffff';
    const sz = Math.max(1, g.U * 0.45);
    for (let i = 0; i < n; i++) {
      const d = f[i * 4 + 2];
      const x = (f[i * 4] + Math.sin(t * 0.6 * d + f[i * 4 + 3]) * g.U * 2 + t * g.U * 0.8 * d) % g.W;
      const y = (f[i * 4 + 1] + t * g.U * 2.6 * d) % g.H;
      ctx.globalAlpha = 0.45 + 0.4 * d / 1.3;
      const s = sz * (0.7 + d * 0.6);
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.puff = paintPuff();
    state.glow = paintGlowSprite();
    state.flakes = seedFlakes(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawGlow(ctx, t);
    if (props.smoke) drawSmoke(ctx, g, t);
    drawFlakes(ctx, g, t, props.snowfall);
  }

  Kasuri.run({
    defaults: { time: 'auto', snowfall: 1, smoke: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
