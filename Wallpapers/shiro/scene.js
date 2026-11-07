/*
 * 城 Shiro — a white castle on its stone base above the moat, under your clock.
 *
 * The keep is baked in daylight and multiplied by the sky's ambient tint once a
 * minute; windows light up after dark. Moat reflection is the picture flipped
 * into wavering strips. Cloud and a few birds keep the sky alive.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, smoothstep, mixColor, toHex } = K;

  const WATER = 0.72;
  const STRIPS = 12;
  const RETINT_SECONDS = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintTier(ctx, u, cx, base, width, wall, panes, windows) {
    ctx.fillStyle = '#e6e2d6';
    ctx.fillRect(cx - width, base - wall, width * 2, wall);
    ctx.fillStyle = '#34383f';
    const eave = width + u * 3.4;
    const roofTop = base - wall - u * 5;
    ctx.beginPath();
    ctx.moveTo(cx - eave - u * 1.4, base - wall + u * 0.2);
    ctx.quadraticCurveTo(cx - width * 0.7, base - wall - u * 1.4, cx - width * 0.55, roofTop);
    ctx.lineTo(cx + width * 0.55, roofTop);
    ctx.quadraticCurveTo(cx + width * 0.7, base - wall - u * 1.4, cx + eave + u * 1.4, base - wall + u * 0.2);
    ctx.fill();
    ctx.fillStyle = '#6f7a78';
    ctx.fillRect(cx - width * 0.55, roofTop, width * 1.1, Math.max(1, u * 0.6));
    for (let i = 0; i < panes; i++) {
      const x = cx - width * 0.8 + ((i + 0.5) / panes) * width * 1.6;
      const y = base - wall * 0.72;
      ctx.fillStyle = '#26282c';
      ctx.fillRect(x - u * 0.9, y, u * 1.8, wall * 0.42);
      windows.push({ x: x - u * 0.9, y, w: u * 1.8, h: wall * 0.42 });
    }
  }

  function paintKeep(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const cx = g.W * 0.56;
    const line = g.H * WATER;
    ctx.fillStyle = '#58705a';
    ctx.beginPath();
    ctx.moveTo(0, line);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.62 - fbm(x * 0.014, 2, 3, 5) * 0.08));
    ctx.lineTo(g.W, line);
    ctx.fill();
    for (let i = 0; i < g.W * 0.3; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#3f5a48' : '#4d6d50';
      ctx.beginPath();
      ctx.arc(rand() * g.W, g.H * (0.56 + rand() * 0.12), u * (0.9 + rand() * 2.4), 0, 6.3);
      ctx.fill();
    }
    const stone = ctx.createLinearGradient(0, line - u * 18, 0, line);
    stone.addColorStop(0, '#8d877a');
    stone.addColorStop(1, '#58544c');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(cx - u * 40, line);
    ctx.quadraticCurveTo(cx - u * 29, line - u * 8, cx - u * 25, line - u * 18);
    ctx.lineTo(cx + u * 25, line - u * 18);
    ctx.quadraticCurveTo(cx + u * 29, line - u * 8, cx + u * 40, line);
    ctx.fill();
    ctx.strokeStyle = '#413e38';
    ctx.lineWidth = Math.max(1, u * 0.25);
    ctx.beginPath();
    for (let k = 1; k < 7; k++) {
      const y = line - k * u * 2.6;
      ctx.moveTo(cx - u * 36 + k * u * 1.6, y);
      ctx.lineTo(cx + u * 36 - k * u * 1.6, y);
    }
    ctx.stroke();
    const windows = [];
    let base = line - u * 18;
    const tiers = [[20, 8, 5], [15.5, 7, 4], [11, 6, 3], [7, 5.4, 2]];
    for (const [w, h, p] of tiers) {
      paintTier(ctx, u, cx, base, w * u, h * u, p, windows);
      base -= (h + 4.2) * u;
    }
    state.windows = windows;
    ctx.fillStyle = '#c9a54a';
    ctx.fillRect(cx - u * 4.4, base + u * 3.6, u * 1.2, u * 1.6);
    ctx.fillRect(cx + u * 3.2, base + u * 3.6, u * 1.2, u * 1.6);
    paintPines(ctx, g, rand, line);
    return c;
  }

  function paintPines(ctx, g, rand, line) {
    ctx.fillStyle = '#26402f';
    for (let i = 0; i < 9; i++) {
      const left = i % 2 === 0;
      const x = left ? g.W * (0.02 + rand() * 0.24) : g.W * (0.82 + rand() * 0.16);
      const h = g.U * (8 + rand() * 10);
      ctx.fillRect(x, line - h, Math.max(1, g.U * 0.5), h);
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(x + (k - 1) * g.U * 2, line - h + k * g.U * 2.5, g.U * (3.2 + rand() * 2), g.U * 1.1, 0, 0, 6.3);
        ctx.fill();
      }
    }
  }

  function paintCloudMask(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.05, 4, 13);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = smoothstep(0.46, 0.66, v) * band * 210;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function tint(source, colour) {
    const c = layer(source.width, source.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = toHex(colour);
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(source, 0, 0);
    return c;
  }

  function retint(g, choice) {
    const h = S.hour(choice);
    const sky = S.at(h);
    state.sky = sky;
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WATER);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      const rand = K.rng(3);
      ctx.fillStyle = '#e4e3d8';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.55, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    state.backdrop = c;
    state.tintedKeep = tint(state.keep, mixColor(sky.amb, [46, 54, 86], sky.night * 0.3));
    state.tintedCloud = tint(state.cloudMask, mixColor(sky.amb, sky.haze, 0.3));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = toHex(mixColor([40, 44, 54], state.sky.top, 0.3));
    ctx.lineWidth = 1;
    const span = g.W + g.U * 30;
    for (let i = 0; i < 4; i++) {
      const x = ((t * g.U * 2.4 + i * g.U * 6) % span) - g.U * 15;
      const y = g.H * 0.2 + i * g.U * 2 + Math.sin(t * 0.3 + i) * g.U;
      const flap = Math.sin(t * 4 + i) * g.U * 0.8;
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.5, y - flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + g.U * 1.5, y - flap);
      ctx.stroke();
    }
  }

  function drawUpper(b, g, t, props) {
    b.drawImage(state.backdrop, 0, 0);
    const w = state.tintedCloud.width;
    const x = -((t * g.U * 1.5 * props.clouds) % w);
    b.drawImage(state.tintedCloud, x, g.H * 0.05);
    b.drawImage(state.tintedCloud, x + w, g.H * 0.05);
    drawBirds(b, g, t);
    b.drawImage(state.tintedKeep, 0, 0);
    const night = state.sky.night;
    if (night > 0.05) {
      b.fillStyle = '#e6b86f';
      b.globalAlpha = night * 0.92;
      for (const pane of state.windows) b.fillRect(pane.x, pane.y, pane.w, pane.h);
      b.globalAlpha = 1;
    }
  }

  function drawMoat(ctx, g, t) {
    const line = g.H * WATER;
    const dst = g.H - line;
    const stripH = dst / STRIPS;
    ctx.fillStyle = toHex(mixColor(state.sky.low, [28, 38, 46], 0.72));
    ctx.fillRect(0, line, g.W, dst);
    ctx.globalAlpha = 0.72;
    for (let i = 0; i < STRIPS; i++) {
      const wob = Math.sin(t * 0.8 + i * 1.5) * g.U * (0.15 + i * 0.12);
      const srcY = line - (i + 1) * stripH * 2;
      ctx.drawImage(state.buffer, 0, srcY, g.W, stripH * 2, wob, line + i * stripH, g.W, stripH + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.keep = paintKeep(g, K.rng(api.seed));
    state.cloudMask = paintCloudMask(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.4));
    state.buffer = layer(g.W, g.H);
    retint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) retint(g, props.time);
    drawUpper(state.buffer.getContext('2d'), g, t, props);
    const line = g.H * WATER;
    ctx.drawImage(state.buffer, 0, 0, g.W, line, 0, 0, g.W, line);
    drawMoat(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
