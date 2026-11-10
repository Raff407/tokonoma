/*
 * 満月 Mangetsu — a big full moon rising over tiled rooftops.
 *
 * Sky with moon, the roofs and the window light are baked into layers and
 * repainted once a minute from the clock. Each frame a soft cloud bank drifts
 * across the moon, two fainter wisps pass higher and lower, and the paper
 * windows breathe.
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

  // A soft cloud bank built from overlapping puffs along a flat-ish base:
  // rounded tops, a soft underside, tapered ends, broken up by noise.
  function paintCloud(w, h, seed, tone, peak) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const rand = K.rng(seed);
    const puffs = [];
    const n = 7;
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      const mid = 1 - Math.abs(f * 2 - 1);
      const ry = c.height * (0.18 + 0.22 * mid + rand() * 0.08);
      puffs.push({ x: c.width * (0.08 + f * 0.84), y: c.height * 0.62 - ry * 0.35, rx: c.width * (0.07 + 0.05 * mid + rand() * 0.03), ry });
    }
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        let f = 0;
        for (const p of puffs) {
          const dx = (x - p.x) / p.rx;
          const dy = (y - p.y) / (y > p.y ? p.ry * 0.6 : p.ry);
          f = Math.max(f, Math.exp(-(dx * dx + dy * dy)));
        }
        const d = fbm(x * 0.06, y * 0.12, 4, seed);
        const a = smoothstep(0.08, 0.85, f * (0.55 + d * 0.8));
        const i = (y * c.width + x) * 4;
        const shade = 0.8 + 0.2 * (1 - y / c.height);
        img.data[i] = tone[0] * shade;
        img.data[i + 1] = tone[1] * shade;
        img.data[i + 2] = tone[2] * shade;
        img.data[i + 3] = Math.min(255, a * peak);
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
    ctx.strokeStyle = hex(mixColor(body, rim, 0.45));
    ctx.globalAlpha = 0.8;
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

  // Window frame and lattice; the panes stay a dim warm paper here and the
  // light itself lives in a separate layer so it can breathe.
  function paintWindowFrame(ctx, g, win) {
    const { x, y, w, h } = win;
    const u = g.U;
    ctx.fillStyle = '#6a4a30';
    ctx.fillRect(x, y, w, h);
    paintLattice(ctx, u, x, y, w, h, '#1a1624');
  }

  function paintLattice(ctx, u, x, y, w, h, col) {
    ctx.fillStyle = col;
    const bar = Math.max(1, u * 0.5);
    ctx.fillRect(x - bar, y - bar, w + bar * 2, bar);
    ctx.fillRect(x - bar, y + h, w + bar * 2, bar);
    ctx.fillRect(x - bar, y, bar, h);
    ctx.fillRect(x + w, y, bar, h);
    for (let k = 1; k < 4; k++) ctx.fillRect(x + (w * k) / 4 - bar / 2, y, bar, h);
    for (let k = 1; k < 3; k++) ctx.fillRect(x, y + (h * k) / 3 - bar / 2, w, bar);
  }

  function paintGlow(g, wins) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    for (const win of wins) {
      const { x, y, w, h, s } = win;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const R = u * 26 * s;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      halo.addColorStop(0, 'rgba(232,170,80,0.45)');
      halo.addColorStop(0.4, 'rgba(214,140,60,0.16)');
      halo.addColorStop(1, 'rgba(214,140,60,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.fillStyle = '#f4cf7e';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,236,180,0.6)';
      ctx.fillRect(x + w * 0.1, y + h * 0.12, w * 0.8, h * 0.76);
      paintLattice(ctx, u, x, y, w, h, '#2a1c18');
    }
    return c;
  }

  function paintFront(g, sky, wins) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const dim = sky.night;
    const far = mixColor(rgb('#5a6290'), sky.haze, 0.3);
    const mid = mixColor(rgb('#343c68'), rgb('#2a3058'), dim * 0.4);
    const near = mixColor(rgb('#1e2342'), rgb('#161a34'), dim * 0.4);
    const rim = mixColor(rgb('#d4cfb8'), rgb('#efe6c4'), 0.5);
    const wallC = mixColor(rgb('#5e6282'), rgb('#474a68'), dim * 0.4);
    const farRoofs = [[0.05, 0.74, 0.1, 0.05], [0.3, 0.72, 0.12, 0.06], [0.56, 0.75, 0.1, 0.05], [0.8, 0.73, 0.13, 0.06], [0.98, 0.75, 0.08, 0.04]];
    for (const r of farRoofs) {
      paintRoof(ctx, g, { cx: g.W * r[0], by: g.H * r[1], hw: g.W * r[2], rise: g.H * r[3], flat: 0.5, body: far, rim: mixColor(far, rim, 0.35), wall: far, wallH: g.H * 0.25 });
    }
    paintRoof(ctx, g, { cx: g.W * 0.27, by: g.H * 0.72, hw: g.W * 0.27, rise: g.H * 0.17, flat: 0.4, body: mid, rim, wall: wallC, wallH: g.H * 0.3 });
    paintRoof(ctx, g, { cx: g.W * 0.77, by: g.H * 0.77, hw: g.W * 0.2, rise: g.H * 0.13, flat: 0.45, body: mid, rim, wall: wallC, wallH: g.H * 0.25 });
    for (const w of wins) paintWindowFrame(ctx, g, w);
    paintRoof(ctx, g, { cx: g.W * 0.56, by: g.H * 1.05, hw: g.W * 0.7, rise: g.H * 0.08, flat: 0.55, body: near, rim: mixColor(near, rim, 0.45), wall: near, wallH: 0 });
    return c;
  }

  function windows(g) {
    return [
      { x: g.W * 0.715, y: g.H * 0.8, w: g.W * 0.12, h: g.H * 0.11, s: 1 },
      { x: g.W * 0.14, y: g.H * 0.76, w: g.W * 0.07, h: g.H * 0.08, s: 0.6 },
    ];
  }

  function repaint(g, props) {
    const h = skyHour(props.time);
    const sky = S.at(h);
    const rand = K.rng(17);
    const r = g.H * 0.17;
    const my = g.H * moonHeight(h);
    const wins = windows(g);
    state.sky = paintSky(g, sky, rand, my, r);
    state.front = paintFront(g, sky, wins);
    state.glowLayer = paintGlow(g, wins);
    state.moonY = my;
    state.moonR = r;
    state.choice = props.time;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  // A cloud drifting left to right, wrapping off-screen; phase in seconds.
  function drawCloud(ctx, g, c, speed, phase, y, alpha, t) {
    const span = g.W + c.width;
    const x = ((t + phase) * speed) % span - c.width;
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, x, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.cloud = paintCloud(g.W * 0.42, g.H * 0.2, 41, [122, 124, 156], 255);
    state.wisp = paintCloud(g.W * 0.36, g.H * 0.12, 77, [160, 160, 184], 220);
    state.high = paintCloud(g.W * 0.32, g.H * 0.1, 93, [120, 122, 152], 210);
    repaint(g, api.props);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props);
    ctx.drawImage(state.sky, 0, 0);
    const a = props.clouds;
    if (a > 0) {
      const sp = g.U * 8;
      // Phase puts the main cloud's middle on the moon soon after start.
      const ph = (g.W * 0.64 + state.cloud.width * 0.5) / sp - 6;
      drawCloud(ctx, g, state.high, g.U * 3.5, 40, g.H * 0.12, Math.min(1, 0.9 * a), t);
      const cy = state.moonY - state.cloud.height * 0.6;
      const half = (g.W + state.cloud.width) / sp / 2;
      drawCloud(ctx, g, state.cloud, sp, ph, cy, Math.min(1, a), t);
      drawCloud(ctx, g, state.cloud, sp, ph + half, cy + g.H * 0.08, Math.min(1, 0.8 * a), t);
      drawCloud(ctx, g, state.wisp, g.U * 5, 20, g.H * 0.44, Math.min(1, 0.8 * a), t);
    }
    ctx.drawImage(state.front, 0, 0);
    if (props.glow) {
      ctx.globalAlpha = 0.72 + 0.28 * Math.sin(t * 0.8) * Math.sin(t * 0.31 + 1);
      ctx.drawImage(state.glowLayer, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, glow: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
