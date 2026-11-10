/*
 * 満月 Mangetsu — a big full moon rising over tiled rooftops.
 *
 * Sky with moon, and the roofs, are baked into layers and repainted once a
 * minute from the clock. Between repaints only a thin cloud drifts across the
 * moon and a second wisp passes lower down.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const state = {};
  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Daytime clock values show dusk, so the moon is always the subject.
  function skyHour(choice) {
    if (choice === 'auto') {
      const h = S.hour('auto');
      return h > 7 && h < 17.5 ? 18.4 : h;
    }
    if (choice === 'night') return 22;
    return S.hour(choice);
  }

  // Moon height as a fraction of the screen: low at dusk, high at midnight.
  function moonHeight(h) {
    const into = ((h - 17.5 + 24) % 24);
    const t = into > 14 ? 1 : into / 7;
    return lerp(0.56, 0.3, smoothstep(0, 1, Math.min(1, t)));
  }

  // ---- sky and moon ------------------------------------------------------

  function paintMoon(ctx, g, mx, my, r) {
    const halo = ctx.createRadialGradient(mx, my, r * 0.95, mx, my, r * 2);
    halo.addColorStop(0, 'rgba(236,222,170,0.34)');
    halo.addColorStop(1, 'rgba(236,222,170,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#efe6c4';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, 6.3);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, 6.3);
    ctx.clip();
    const marks = [[-0.3, -0.25, 0.3], [0.25, -0.05, 0.22], [-0.05, 0.38, 0.26], [0.38, 0.35, 0.12], [-0.45, 0.2, 0.14]];
    ctx.fillStyle = '#c9bd96';
    for (const m of marks) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(mx + m[0] * r, my + m[1] * r, m[2] * r, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function paintSky(g, sky, rand, my, r) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.8);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(mixColor(sky.low, rgb('#6a6a9a'), 0.5), rgb('#b88a78'), 0.25)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e6e4da';
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
    }
    ctx.globalAlpha = 1;
    paintMoon(ctx, g, g.W * 0.64, my, r);
    return c;
  }

  // A long thin streak that tiles sideways.
  function paintStreak(w, h, seed, tone) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const dens = (x, y) => fbm(x * 0.012, y * 0.09, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.pow(Math.sin(((y + 0.5) / c.height) * Math.PI), 1.5);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(dens(x, y), dens(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = tone[0];
        img.data[i + 1] = tone[1];
        img.data[i + 2] = tone[2];
        img.data[i + 3] = smoothstep(0.42, 0.68, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- roofs -------------------------------------------------------------

  function roofPath(ctx, cx, by, hw, rise, flat) {
    const L = cx - hw;
    const R = cx + hw;
    const rl = cx - hw * flat;
    const rr = cx + hw * flat;
    ctx.beginPath();
    ctx.moveTo(L, by - rise * 0.08);
    ctx.quadraticCurveTo(L + (rl - L) * 0.4, by - rise * 0.12, rl, by - rise);
    ctx.lineTo(rr, by - rise);
    ctx.quadraticCurveTo(R - (R - rr) * 0.4, by - rise * 0.12, R, by - rise * 0.08);
    ctx.lineTo(R, by + rise * 0.06);
    ctx.lineTo(L, by + rise * 0.06);
    ctx.closePath();
  }

  function paintRoof(ctx, g, o) {
    const { cx, by, hw, rise, flat, body, rim, wall, wallH } = o;
    const u = g.U;
    if (wallH > 0) {
      ctx.fillStyle = hex(wall);
      ctx.fillRect(cx - hw * 0.82, by, hw * 1.64, wallH);
      ctx.fillStyle = hex(mixColor(wall, rgb('#0c0e1c'), 0.6));
      for (let f = -0.82; f <= 0.83; f += 0.41) ctx.fillRect(cx + hw * f - u * 0.3, by, Math.max(1, u * 0.6), wallH);
    }
    roofPath(ctx, cx, by, hw, rise, flat);
    ctx.fillStyle = hex(body);
    ctx.fill();
    ctx.save();
    roofPath(ctx, cx, by, hw, rise, flat);
    ctx.clip();
    ctx.strokeStyle = hex(mixColor(body, rgb('#05070f'), 0.45));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    const n = Math.max(8, Math.round(hw / (u * 1.5)));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      ctx.beginPath();
      ctx.moveTo(cx + (f * 2 - 1) * hw * flat, by - rise);
      ctx.lineTo(cx + (f * 2 - 1) * hw * 1.02, by + rise * 0.06);
      ctx.stroke();
    }
    ctx.strokeStyle = hex(mixColor(body, rim, 0.6));
    ctx.globalAlpha = 0.55;
    const rows = Math.max(3, Math.round(rise / (u * 1.8)));
    for (let k = 1; k < rows; k++) {
      const yy = by - rise + (rise * k) / rows;
      ctx.beginPath();
      ctx.moveTo(cx - hw * 1.1, yy);
      ctx.lineTo(cx + hw * 1.1, yy);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // Bright moon-side ridge line and the ridge-end tiles.
    ctx.fillStyle = hex(rim);
    ctx.fillRect(cx - hw * flat, by - rise - Math.max(1, u * 0.35), hw * flat * 2, Math.max(1, u * 0.35));
    ctx.fillStyle = hex(mixColor(body, rim, 0.3));
    const ow = Math.max(2, u * 1.6);
    ctx.fillRect(cx - hw * flat - ow * 0.4, by - rise - ow, ow, ow * 1.4);
    ctx.fillRect(cx + hw * flat - ow * 0.6, by - rise - ow, ow, ow * 1.4);
    // Eave shadow.
    ctx.fillStyle = hex(mixColor(body, rgb('#05060e'), 0.7));
    ctx.fillRect(cx - hw, by + rise * 0.04, hw * 2, Math.max(1, u * 0.7));
  }

  function paintWindow(ctx, g, wx, wy, w, h, glow) {
    const u = g.U;
    if (glow) {
      const halo = ctx.createRadialGradient(wx + w / 2, wy + h / 2, 0, wx + w / 2, wy + h / 2, u * 14);
      halo.addColorStop(0, 'rgba(232,170,80,0.32)');
      halo.addColorStop(1, 'rgba(232,170,80,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(wx - u * 14, wy - u * 14, w + u * 28, h + u * 28);
    }
    ctx.fillStyle = glow ? '#f0c474' : '#4a4a62';
    ctx.fillRect(wx, wy, w, h);
    ctx.fillStyle = '#1a1624';
    const bar = Math.max(1, u * 0.45);
    ctx.fillRect(wx - bar, wy - bar, w + bar * 2, bar);
    ctx.fillRect(wx - bar, wy + h, w + bar * 2, bar);
    ctx.fillRect(wx - bar, wy, bar, h);
    ctx.fillRect(wx + w, wy, bar, h);
    ctx.fillRect(wx + w / 2 - bar / 2, wy, bar, h);
    for (let k = 1; k < 4; k++) ctx.fillRect(wx, wy + (h * k) / 4, w, 1);
  }

  function paintFront(g, sky, glow) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const dim = sky.night;
    const far = mixColor(rgb('#586088'), sky.haze, 0.3);
    const mid = mixColor(rgb('#2c3256'), rgb('#1e2342'), dim * 0.4);
    const near = mixColor(rgb('#161a34'), rgb('#0e1126'), dim * 0.4);
    const rim = mixColor(rgb('#c4c0b0'), rgb('#efe6c4'), 0.5);
    const wallC = mixColor(rgb('#50536e'), rgb('#363955'), dim * 0.4);
    // Far roofs, hazy and low.
    const farRoofs = [[0.05, 0.76, 0.1, 0.05], [0.3, 0.74, 0.12, 0.06], [0.56, 0.77, 0.1, 0.05], [0.8, 0.75, 0.13, 0.06], [0.98, 0.77, 0.08, 0.04]];
    for (const r of farRoofs) {
      paintRoof(ctx, g, { cx: g.W * r[0], by: g.H * r[1], hw: g.W * r[2], rise: g.H * r[3], flat: 0.5, body: far, rim: mixColor(far, rim, 0.3), wall: far, wallH: g.H * 0.25 });
    }
    // Big roof, left of centre.
    paintRoof(ctx, g, { cx: g.W * 0.27, by: g.H * 0.76, hw: g.W * 0.27, rise: g.H * 0.17, flat: 0.4, body: mid, rim, wall: wallC, wallH: g.H * 0.3 });
    // Smaller house on the right with the lit window.
    const hx = g.W * 0.77;
    paintRoof(ctx, g, { cx: hx, by: g.H * 0.8, hw: g.W * 0.2, rise: g.H * 0.13, flat: 0.45, body: mid, rim, wall: wallC, wallH: g.H * 0.25 });
    paintWindow(ctx, g, hx - g.W * 0.035, g.H * 0.855, g.W * 0.07, g.H * 0.085, glow);
    // Foreground eaves along the bottom.
    paintRoof(ctx, g, { cx: g.W * 0.56, by: g.H * 0.97, hw: g.W * 0.7, rise: g.H * 0.1, flat: 0.55, body: near, rim: mixColor(near, rim, 0.4), wall: near, wallH: 0 });
    return c;
  }

  function repaint(g, props) {
    const h = skyHour(props.time);
    const sky = S.at(h);
    const rand = K.rng(17);
    const r = g.H * 0.17;
    const my = g.H * moonHeight(h);
    state.sky = paintSky(g, sky, rand, my, r);
    state.front = paintFront(g, sky, props.glow);
    state.moonY = my;
    state.moonR = r;
    state.choice = props.time;
    state.glow = props.glow;
    state.alpha = 0.55 + 0.25 * sky.night;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawStreak(ctx, c, off, y, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.cloud = paintStreak(g.W * 1.6, g.H * 0.16, 41, [214, 218, 232]);
    state.wisp = paintStreak(g.W * 1.4, g.H * 0.07, 77, [150, 158, 190]);
    repaint(g, api.props);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.glow !== props.glow) repaint(g, props);
    ctx.drawImage(state.sky, 0, 0);
    const a = props.clouds;
    if (a > 0) {
      const off1 = -((t * g.U * 4.5) % state.cloud.width);
      drawStreak(ctx, state.cloud, off1, state.moonY - state.cloud.height * 0.5 + g.H * 0.01, Math.min(1, state.alpha * a));
      const off2 = -((t * g.U * 2.5 + g.W * 0.4) % state.wisp.width);
      drawStreak(ctx, state.wisp, off2, g.H * 0.44, Math.min(1, 0.4 * a));
    }
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, glow: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
