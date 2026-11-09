/*
 * 暁 Akatsuki — the hour before sunrise over a calm sea.
 *
 * A bright planet fades as the first orange light climbs. Fuji stands far off,
 * a vermilion torii wades in the shallows and a squid boat carries a row of lamps.
 * Sky, land, sea and the small sprites are baked and repainted once a minute from
 * the clock. Between repaints only thin sea rows, clouds, birds and the boat move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.56;
  const PLANET = { x: 0.6, y: 0.2 };
  const FUJI = { x: 0.17, y: 0.405, half: 0.19 };
  const RETINT_SECONDS = 60;
  const BAND = 3;
  const LAMPS = [7, 10.5, 14, 17.5, 21];
  const BIRDS = 5;
  const state = {};

  const hex = (c) => toHex(c);
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

  function bell(h, centre, width) {
    return Math.max(0, 1 - Math.abs(h - centre) / width);
  }

  // How much of the first light is in the sky, and how bright the planet shows.
  function lightAt(h, night) {
    const glow = Math.max(bell(h, 6.3, 1.9), bell(h, 18.2, 1.6));
    const vis = h < 12 ? Math.max(night, 1 - smoothstep(6, 7.6, h)) : night;
    return { glow, vis };
  }

  // ---- sky and clouds ---------------------------------------------------

  function paintSky(g, sky, light, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hz = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, 0, 0, hz);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (light.glow > 0.02) {
      const gx = g.W * 0.42;
      const rad = g.W * 0.6;
      const glow = ctx.createRadialGradient(gx, hz, 0, gx, hz, rad);
      glow.addColorStop(0, `rgba(244,170,100,${0.55 * light.glow})`);
      glow.addColorStop(1, 'rgba(244,170,100,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, g.W, hz);
    }
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.12 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * hz * 0.8, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (light.vis > 0.02) {
      ctx.fillStyle = '#fff3da';
      ctx.globalAlpha = light.vis;
      ctx.beginPath();
      ctx.arc(g.W * PLANET.x, g.H * PLANET.y, Math.max(1.1, g.U * 0.9), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // Long thin bands that tile sideways. Kept white so a repaint only retints them.
  function paintCloudMask(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.011, y * 0.1, 4, 23);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = smoothstep(0.5, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function tintClouds(mask, color) {
    const c = layer(mask.width, mask.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = hex(color);
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function paintHalo(rgbText) {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `rgba(${rgbText},0.8)`);
    grad.addColorStop(1, `rgba(${rgbText},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- far land: Fuji and a pine headland -------------------------------

  function fujiTop(g, x) {
    const hz = g.H * HORIZON;
    const top = g.H * FUJI.y;
    const half = g.W * FUJI.half;
    const d = Math.max(0, Math.abs(x - g.W * FUJI.x) - g.W * 0.008) / half;
    return hz - (hz - top) * Math.pow(Math.max(0, 1 - d), 1.8);
  }

  function paintFuji(ctx, g, sky) {
    const hz = g.H * HORIZON;
    const x0 = Math.floor(g.W * (FUJI.x - FUJI.half));
    const x1 = Math.ceil(g.W * (FUJI.x + FUJI.half));
    const body = mixColor(mixColor(sky.haze, rgb('#2a3350'), 0.4), sky.top, 0.1);
    ctx.fillStyle = hex(body);
    ctx.beginPath();
    ctx.moveTo(x0, hz + 1);
    for (let x = x0; x <= x1; x++) ctx.lineTo(x, fujiTop(g, x));
    ctx.lineTo(x1, hz + 1);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    const top = g.H * FUJI.y;
    ctx.fillStyle = hex(mixColor(mixColor(sky.low, rgb('#f6ece6'), 0.55), body, 0.2 + sky.night * 0.35));
    ctx.beginPath();
    ctx.moveTo(x0, top - 2);
    for (let x = x0; x <= x1; x++) ctx.lineTo(x, top + (hz - top) * (0.2 + 0.14 * fbm(x * 0.2, 1, 2, 7)));
    ctx.lineTo(x1, top - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function paintHeadland(ctx, g, sky, rand) {
    const hz = g.H * HORIZON;
    const x0 = g.W * 0.84;
    const rise = (x) => hz - g.U * 5.5 * Math.pow(Math.sin(Math.min(1, (x - x0) / (g.W - x0) * 1.25) * Math.PI * 0.5), 0.8);
    const dark = mixColor(rgb('#26352f'), sky.haze, 0.3);
    ctx.fillStyle = hex(dark);
    ctx.beginPath();
    ctx.moveTo(x0, hz + 1);
    for (let x = x0; x <= g.W; x++) ctx.lineTo(x, rise(x));
    ctx.lineTo(g.W, hz + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(dark, rgb('#3c4f3a'), 0.4));
    for (let i = 0; i < 6; i++) {
      const px = x0 + (0.12 + 0.15 * i) * (g.W - x0);
      const rx = g.U * (1.4 + rand() * 0.9);
      ctx.beginPath();
      ctx.ellipse(px, rise(px) - g.U * 0.6, rx, g.U * 0.75, 0, 0, TAU);
      ctx.fill();
    }
  }

  function paintLand(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFuji(ctx, g, sky);
    paintHeadland(ctx, g, sky, rand);
    const hz = g.H * HORIZON;
    const mist = ctx.createLinearGradient(0, hz - g.U * 7, 0, hz + 1);
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(1, hex(sky.low));
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = mist;
    ctx.fillRect(0, hz - g.U * 7, g.W, g.U * 7 + 1);
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- sea --------------------------------------------------------------

  function streaks(ctx, g, pad, hz, cx, spread, color, strength, rand) {
    if (strength < 0.02) return;
    ctx.fillStyle = color;
    for (let y = hz + 1; y < g.H; y += 2) {
      const f = (y - hz) / (g.H - hz);
      const wid = g.U * (3 + f * 26) * spread;
      for (let j = 0; j < 3; j++) {
        const x = pad + cx + (rand() - 0.5) * wid;
        const len = g.U * (0.8 + rand() * 2.6) * (0.6 + f);
        ctx.globalAlpha = strength * (1 - f * 0.75) * (0.3 + rand() * 0.7);
        ctx.fillRect(x - len / 2, y, len, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function paintScales(ctx, g, pad, sky) {
    ctx.strokeStyle = hex(mixColor(sky.low, rgb('#ffffff'), 0.35));
    ctx.lineWidth = 1;
    const y0 = g.H * 0.7;
    let row = 0;
    for (let y = y0; y < g.H + g.U * 4; row++) {
      const f = (y - y0) / (g.H - y0);
      const r = g.U * (2.2 + 3.5 * f);
      ctx.globalAlpha = (0.05 + 0.13 * f) * (1 - sky.night * 0.5);
      for (let x = -r + (row % 2) * r; x < g.W + 2 * pad + r; x += 2 * r) {
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc(x, y, r * (k / 3), Math.PI, 0);
          ctx.stroke();
        }
      }
      y += r * 0.5;
    }
    ctx.globalAlpha = 1;
  }

  function paintSea(g, pad, sky, light, rand) {
    const c = layer(g.W + pad * 2, g.H);
    const ctx = c.getContext('2d');
    const hz = Math.floor(g.H * HORIZON);
    const grad = ctx.createLinearGradient(0, hz, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, sky.haze, 0.2)));
    grad.addColorStop(0.35, hex(mixColor(mixColor(sky.low, sky.top, 0.55), rgb('#1a2848'), 0.3)));
    grad.addColorStop(1, hex(mixColor(rgb('#12203c'), sky.top, 0.35)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, hz, c.width, g.H - hz);
    paintScales(ctx, g, pad, sky);
    streaks(ctx, g, pad, hz, g.W * 0.42, 2.2, '#f2a66a', light.glow * 0.7, rand);
    streaks(ctx, g, pad, hz, g.W * PLANET.x, 1, '#fff1d6', light.vis * 0.7, rand);
    const lightInk = hex(mixColor(mixColor(sky.amb, rgb('#ffffff'), 0.3), sky.low, 0.3));
    const darkInk = hex(mixColor(rgb('#0e1630'), sky.top, 0.25));
    for (let i = 0; i < g.W * 1.2; i++) {
      const f = Math.pow(rand(), 1.6);
      const y = hz + 1 + f * (g.H - hz - 1);
      const len = g.U * (1 + f * 5) * (0.5 + rand());
      ctx.fillStyle = i % 2 ? lightInk : darkInk;
      ctx.globalAlpha = (0.12 + rand() * 0.18) * (i % 2 ? 1 - sky.night * 0.5 : 1);
      ctx.fillRect(pad + rand() * g.W - len / 2, y, len, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- torii ------------------------------------------------------------

  function paintToriiSprite(g, sky) {
    const s = g.U;
    const w = Math.ceil(16 * s);
    const h = Math.ceil(12.5 * s);
    const c = layer(w, h * 2.3);
    const ctx = c.getContext('2d');
    const night = sky.night;
    const red = mixColor(mixColor(rgb('#b5402c'), rgb('#1c2036'), 0.35), sky.top, night * 0.25);
    const black = mixColor(rgb('#2a2220'), sky.top, 0.2);
    ctx.fillStyle = hex(red);
    poly(ctx, [3 * s, 2.4 * s, 4.2 * s, 2.4 * s, 4.5 * s, 12 * s, 3.2 * s, 12 * s]);
    poly(ctx, [11.8 * s, 2.4 * s, 13 * s, 2.4 * s, 12.8 * s, 12 * s, 11.5 * s, 12 * s]);
    ctx.fillRect(2.4 * s, 4.4 * s, 11.2 * s, Math.max(1, 0.9 * s));
    ctx.fillStyle = hex(black);
    poly(ctx, [0, 0.2 * s, 3 * s, 1.5 * s, 13 * s, 1.5 * s, 16 * s, 0.2 * s, 16 * s, 1.6 * s, 13.5 * s, 2.7 * s, 2.5 * s, 2.7 * s, 0, 1.6 * s]);
    ctx.fillRect(3 * s, 2.7 * s, 10 * s, Math.max(1, 0.6 * s));
    ctx.fillRect(2.9 * s, 11.2 * s, 1.8 * s, Math.max(1, 0.8 * s));
    ctx.fillRect(11.3 * s, 11.2 * s, 1.8 * s, Math.max(1, 0.8 * s));
    ctx.save();
    ctx.translate(0, h * 2 - 0.2 * s);
    ctx.scale(1, -0.9);
    ctx.globalAlpha = 0.28;
    ctx.drawImage(c, 0, 0, w, h, 0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = hex(mixColor(sky.low, rgb('#ffffff'), 0.4));
    ctx.globalAlpha = 0.35;
    ctx.fillRect(2.4 * s, 12 * s, 2.8 * s, Math.max(1, 0.5 * s));
    ctx.fillRect(10.8 * s, 12 * s, 2.8 * s, Math.max(1, 0.5 * s));
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- boat -------------------------------------------------------------

  function paintBoat(g, sky) {
    const bw = Math.ceil(g.U * 26);
    const u = bw / 26;
    const c = layer(bw, Math.ceil(14 * u));
    const ctx = c.getContext('2d');
    const wood = mixColor(rgb('#2b2420'), sky.top, 0.15);
    const line = Math.max(1, u * 0.35);
    ctx.fillStyle = hex(wood);
    ctx.beginPath();
    ctx.moveTo(2 * u, 7.2 * u);
    ctx.quadraticCurveTo(3 * u, 11.6 * u, 7 * u, 11.8 * u);
    ctx.lineTo(18 * u, 11.8 * u);
    ctx.quadraticCurveTo(23 * u, 11 * u, 25.6 * u, 5 * u);
    ctx.lineTo(24.2 * u, 5 * u);
    ctx.quadraticCurveTo(21 * u, 8.3 * u, 17 * u, 8.6 * u);
    ctx.lineTo(5 * u, 8.4 * u);
    ctx.quadraticCurveTo(3.5 * u, 8 * u, 2 * u, 7.2 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#9c3a2a'), rgb('#1c2036'), 0.3 + sky.night * 0.3));
    ctx.fillRect(5 * u, 9.6 * u, 15 * u, Math.max(1, 0.55 * u));
    ctx.fillStyle = hex(mixColor(wood, rgb('#4a3a30'), 0.4));
    ctx.fillRect(3.5 * u, 5 * u, 6 * u, 3.4 * u);
    ctx.fillStyle = hex(mixColor(wood, rgb('#000000'), 0.25));
    poly(ctx, [3 * u, 5 * u, 4.2 * u, 4 * u, 8.8 * u, 4 * u, 10 * u, 5 * u]);
    ctx.fillStyle = hex(wood);
    ctx.fillRect(14 * u, 0.8 * u, line, 7.8 * u);
    ctx.fillRect(6 * u, 1.6 * u, 16 * u, line);
    const lamp = hex(mixColor(rgb('#f2c46a'), sky.low, 0.15));
    for (const lx of LAMPS) {
      ctx.fillStyle = hex(wood);
      ctx.fillRect(lx * u, 1.6 * u, line, 0.8 * u);
      ctx.fillStyle = lamp;
      ctx.beginPath();
      ctx.arc(lx * u + line / 2, 2.9 * u, Math.max(0.8, 0.55 * u), 0, TAU);
      ctx.fill();
    }
    return c;
  }

  function repaint(g, choice) {
    const h = S.hour(choice);
    const sky = S.at(h);
    const light = lightAt(h, sky.night);
    const rand = K.rng(37);
    state.sky = paintSky(g, sky, light, rand);
    state.land = paintLand(g, sky, rand);
    state.sea = paintSea(g, state.pad, sky, light, rand);
    state.torii = paintToriiSprite(g, sky);
    state.boat = paintBoat(g, sky);
    state.clouds = tintClouds(state.mask, mixColor(mixColor(sky.low, sky.amb, 0.45), rgb('#ffffff'), 0.1));
    state.cloudAlpha = 0.7 - sky.night * 0.45;
    state.vis = light.vis;
    state.lamp = 0.55 + 0.45 * sky.night;
    state.ink = hex(mixColor(rgb('#262a3a'), sky.top, 0.3));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion -----------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.1);
    ctx.drawImage(c, off + c.width, g.H * 0.1);
    ctx.globalAlpha = 1;
  }

  function drawPlanet(ctx, g, t) {
    if (state.vis < 0.02) return;
    const size = g.U * 7;
    ctx.globalAlpha = state.vis * (0.4 + 0.07 * Math.sin(t * 0.8));
    ctx.drawImage(state.haloWhite, g.W * PLANET.x - size / 2, g.H * PLANET.y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function drawSea(ctx, g, t) {
    const hz = Math.floor(g.H * HORIZON);
    for (let y = hz; y < g.H; y += BAND) {
      const k = (y - hz) / (g.H - hz);
      const amp = g.U * (0.15 + 0.8 * k);
      const wave = Math.sin(t * 0.7 + y * 0.35) * amp + Math.sin(t * 0.31 + y * 0.13) * amp * 0.6;
      const bh = Math.min(BAND, g.H - y);
      ctx.drawImage(state.sea, state.pad - wave, y, g.W, bh, 0, y, g.W, bh);
    }
  }

  function drawTorii(ctx, g) {
    const c = state.torii;
    ctx.drawImage(c, g.W * 0.76 - c.width / 2, g.H * 0.665 - 12 * g.U);
  }

  function drawBoat(ctx, g, t) {
    const boat = state.boat;
    const u = boat.width / 26;
    const bx = g.W * 0.34 + Math.sin(t * 0.05) * g.U * 3;
    const by = g.H * 0.7 + Math.sin(t * 0.9) * g.U * 0.35;
    const px = boat.width / 2;
    const py = 11 * u;
    ctx.fillStyle = state.ink;
    for (let s = 0; s < 6; s++) {
      const sh = boat.height / 6;
      const wob = Math.sin(t * 1.3 + s * 1.1) * u * 0.5;
      ctx.globalAlpha = 0.22 * (1 - s / 7);
      ctx.save();
      ctx.translate(bx - px + wob, by + py * 0.2 + s * sh * 0.8);
      ctx.drawImage(boat, 0, boat.height - (s + 1) * sh, boat.width, sh, 0, 0, boat.width, sh * 0.8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.sin(t * 0.7) * 0.012);
    ctx.drawImage(boat, -px, -py);
    for (let i = 0; i < LAMPS.length; i++) {
      const flick = 0.9 + 0.1 * Math.sin(t * 2.1 + i * 1.3);
      ctx.globalAlpha = state.lamp * flick;
      const size = u * 5;
      ctx.drawImage(state.haloWarm, (LAMPS[i] + 0.1) * u - px - size / 2, 2.9 * u - py - size / 2, size, size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(mixColor(parseColor(state.ink), rgb('#ffffff'), 0.25));
    ctx.globalAlpha = 0.3;
    ctx.fillRect(bx - px + u * 2, by + u * 1.2 + Math.sin(t * 1.1) * 0.3, boat.width * 0.8, 1);
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = state.ink;
    ctx.lineWidth = 1;
    const span = g.W + g.U * 20;
    ctx.beginPath();
    for (let i = 0; i < BIRDS; i++) {
      const lead = Math.abs(i - 2);
      const x = ((t * g.U * 1.4 + span - i * g.U * 4) % span) - g.U * 10;
      const y = g.H * 0.3 + lead * g.U * 1.6 + Math.sin(t * 0.3 + i) * g.U * 0.8;
      const flap = Math.sin(t * 4 + i * 0.9) * g.U * 0.7;
      ctx.moveTo(x - g.U * 1.3, y + flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + g.U * 1.3, y + flap);
    }
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.pad = Math.ceil(g.U * 2);
    state.mask = paintCloudMask(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.34));
    state.haloWhite = paintHalo('255,246,226');
    state.haloWarm = paintHalo('255,206,130');
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawPlanet(ctx, g, t);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.land, 0, 0);
    drawSea(ctx, g, t);
    drawTorii(ctx, g);
    drawBoat(ctx, g, t);
    if (props.birds) drawBirds(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dawn', clouds: 1, birds: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
