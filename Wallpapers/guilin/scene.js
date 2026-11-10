/*
 * 桂林 Guilin — karst peaks along the Li river in light rain.
 *
 * Sky, three ranks of peaks, water and the river banks are baked once and
 * repainted once a minute from the clock. Between repaints only mist, rain,
 * ripples, a few birds and one bamboo raft move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const WATERLINE = 0.67;
  const RETINT_SECONDS = 60;
  const MAX_DROPS = 110;
  const MAX_RIPPLES = 14;
  const MAX_BIRDS = 3;
  const OVERCAST = 0.5;

  // Peak specs: centre and half width as fractions of the width, height as a fraction of the height.
  const FAR = [[0.05, 0.08, 0.36], [0.19, 0.07, 0.46], [0.34, 0.08, 0.38], [0.5, 0.07, 0.5], [0.66, 0.08, 0.4], [0.82, 0.07, 0.47], [0.97, 0.08, 0.35]];
  const MID = [[0.12, 0.065, 0.5], [0.4, 0.06, 0.56], [0.58, 0.07, 0.44], [0.8, 0.055, 0.54]];
  const NEAR = [[0.03, 0.07, 0.56], [0.27, 0.07, 0.62], [0.72, 0.075, 0.6], [0.96, 0.06, 0.46]];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  // ---- sky ---------------------------------------------------------------

  function skyColors(sky) {
    const grey = mixColor(rgb('#cfd2c8'), sky.low, sky.night);
    return {
      top: mixColor(sky.top, grey, OVERCAST),
      low: mixColor(sky.low, grey, OVERCAST + 0.1),
      haze: mixColor(sky.haze, grey, 0.45),
      grey,
    };
  }

  function paintSky(g, sky, sc, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WATERLINE);
    grad.addColorStop(0, hex(sc.top));
    grad.addColorStop(1, hex(sc.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.5) {
      ctx.fillStyle = '#e8dcae';
      ctx.globalAlpha = 0.55 * sky.night;
      ctx.beginPath();
      ctx.arc(g.W * 0.58, g.H * 0.14, g.U * 3.2, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // ---- peaks -------------------------------------------------------------

  // Steep-sided tower with a rounded crown.
  function profile(d) {
    if (d >= 1) return 0;
    return Math.pow(1 - Math.pow(d, 2.2), 0.55);
  }

  function peakHeight(g, specs, x, seed) {
    let h = 0;
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const d = Math.abs(x - g.W * s[0]) / (g.W * s[1]);
      h = Math.max(h, profile(d) * g.H * s[2]);
    }
    if (h <= 0) return 0;
    return Math.max(0, h + (fbm(x * 0.09, seed, 3, seed) - 0.5) * g.U * 1.6 * smoothstep(0, g.U * 4, h));
  }

  // depth 0 is the nearest rank, 1 the most distant.
  function peakColor(sky, sc, depth, veg, f, ridge) {
    const rock = mixColor(rgb('#76817f'), rgb('#4b566b'), depth * 0.5);
    const moss = mixColor(rgb('#4a6644'), rgb('#6a8466'), depth * 0.4);
    let c = mixColor(rock, moss, veg);
    c = c.map((v) => v * (1 - 0.22 * (1 - depth) * ridge));
    c = mixColor(c, sc.haze, 0.1 + depth * 0.72);
    c = mixColor(c, sc.haze, smoothstep(0.62, 1, f) * (0.35 + depth * 0.4));
    return mixColor(c, rgb('#10162a'), sky.night * 0.72);
  }

  function paintPeaks(g, sky, sc, specs, depth, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const base = Math.floor(g.H * WATERLINE);
    const img = ctx.createImageData(c.width, c.height);
    for (let x = 0; x < g.W; x++) {
      const top = base - peakHeight(g, specs, x, seed);
      if (top >= base) continue;
      const span = base - top;
      for (let y = Math.max(0, Math.floor(top)); y < base; y++) {
        const f = (y - top) / span;
        const rib = fbm(x * 0.45, y * 0.02, 3, seed + 3);
        const patch = fbm(x * 0.11, y * 0.09, 3, seed + 7);
        const veg = smoothstep(0.38, 0.62, patch + (1 - f) * 0.22 - (rib - 0.5) * 0.25);
        const col = peakColor(sky, sc, depth, veg, f, rib);
        const i = (y * c.width + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(w, h, color, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const dens = (x, y) => fbm(x * 0.012, y * 0.08, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(dens(x, y), dens(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = color[0];
        img.data[i + 1] = color[1];
        img.data[i + 2] = color[2];
        img.data[i + 3] = smoothstep(0.42, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(g, sky, sc, layers, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wl = g.H * WATERLINE;
    const grad = ctx.createLinearGradient(0, wl, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sc.low, sc.haze, 0.4)));
    grad.addColorStop(1, hex(mixColor(mixColor(rgb('#3a5a5c'), sc.haze, 0.2), rgb('#10162a'), sky.night * 0.7)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, wl, g.W, g.H - wl);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, wl, g.W, g.H - wl);
    ctx.clip();
    ctx.translate(0, 2 * wl);
    ctx.scale(1, -1);
    const alphas = [0.28, 0.34, 0.46];
    for (let i = 0; i < layers.length; i++) {
      ctx.globalAlpha = alphas[i];
      ctx.drawImage(layers[i], 0, 0);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    const fade = ctx.createLinearGradient(0, wl, 0, wl + g.H * 0.07);
    const hz = sc.haze;
    fade.addColorStop(0, `rgba(${hz[0] | 0},${hz[1] | 0},${hz[2] | 0},0.55)`);
    fade.addColorStop(1, `rgba(${hz[0] | 0},${hz[1] | 0},${hz[2] | 0},0)`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, wl, g.W, g.H * 0.07);
    return c;
  }

  function paintSheen(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wl = g.H * WATERLINE;
    ctx.fillStyle = sky.night > 0.5 ? '#aab4cc' : '#e6e8e0';
    for (let i = 0; i < 90; i++) {
      const y = wl + g.H * 0.02 + rand() * (g.H - wl - g.H * 0.04);
      const depth = (y - wl) / (g.H - wl);
      ctx.globalAlpha = 0.1 + rand() * 0.18;
      ctx.fillRect(rand() * g.W, y, g.U * (1.5 + rand() * 4) * (0.6 + depth), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- foreground --------------------------------------------------------

  function bank(ctx, g, sky, x0, x1, top) {
    const col = mixColor(rgb('#3b4c3a'), rgb('#10162a'), sky.night * 0.7);
    ctx.fillStyle = hex(col);
    ctx.beginPath();
    ctx.moveTo(x0, g.H);
    ctx.quadraticCurveTo(lerp(x0, x1, 0.15), top, lerp(x0, x1, 0.5), top);
    ctx.quadraticCurveTo(lerp(x0, x1, 0.85), top, x1, top + (g.H - top) * 0.55);
    ctx.lineTo(x1, g.H);
    ctx.closePath();
    ctx.fill();
  }

  function paintBamboo(ctx, g, sky, rand) {
    const stalk = mixColor(rgb('#58773f'), rgb('#10162a'), sky.night * 0.7);
    const leaf = mixColor(rgb('#4a6a3c'), rgb('#10162a'), sky.night * 0.7);
    const node = mixColor(stalk, rgb('#c9c28a'), 0.35);
    const base = g.H * 0.86;
    const count = 9;
    for (let i = 0; i < count; i++) {
      const bx = g.W * (0.01 + (i / count) * 0.2) + rand() * g.U;
      const lean = (rand() - 0.2) * g.U * 5;
      const top = g.H * (0.34 + rand() * 0.24);
      const wid = Math.max(1, g.U * (0.45 + rand() * 0.25));
      ctx.strokeStyle = hex(stalk);
      ctx.lineWidth = wid;
      ctx.beginPath();
      ctx.moveTo(bx, g.H);
      ctx.quadraticCurveTo(bx + lean * 0.2, lerp(g.H, top, 0.5), bx + lean, top);
      ctx.stroke();
      ctx.fillStyle = hex(node);
      for (let y = top + g.U * 3; y < base; y += g.U * (4 + rand() * 2)) {
        const f = (y - top) / (g.H - top);
        ctx.fillRect(bx + lean * Math.pow(1 - f, 1.6) - wid * 0.7, y, wid * 1.4, 1);
      }
      ctx.strokeStyle = hex(leaf);
      ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const f = 0.02 + rand() * 0.22;
        const ly = lerp(top, g.H, f);
        const lx = bx + lean * Math.pow(1 - f, 1.6);
        for (let s = 0; s < 3; s++) {
          const dir = rand() < 0.5 ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + dir * g.U * (3 + rand() * 3), ly + g.U * (1.5 + rand() * 2.5));
          ctx.stroke();
        }
      }
    }
  }

  // A small pavilion with upturned eaves and red pillars.
  function paintPavilion(ctx, g, sky, cx, by) {
    const U = g.U;
    const dark = sky.night * 0.7;
    const tile = hex(mixColor(rgb('#3a4252'), rgb('#10162a'), dark));
    const lacquer = hex(mixColor(rgb('#b8432c'), rgb('#2a1a24'), dark));
    ctx.fillStyle = hex(mixColor(rgb('#9aa09a'), rgb('#10162a'), dark));
    ctx.fillRect(cx - 5.2 * U, by - 0.9 * U, 10.4 * U, 0.9 * U);
    ctx.fillStyle = lacquer;
    const pw = Math.max(1, U * 0.7);
    for (const dx of [-4.2, -1.4, 1.4, 4.2]) ctx.fillRect(cx + dx * U - pw / 2, by - 5.9 * U, pw, 5 * U);
    ctx.fillRect(cx - 4.6 * U, by - 6.5 * U, 9.2 * U, 0.8 * U);
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * U, by - 8.4 * U);
    ctx.quadraticCurveTo(cx - 5.5 * U, by - 6.3 * U, cx - 4.4 * U, by - 6.5 * U);
    ctx.lineTo(cx + 4.4 * U, by - 6.5 * U);
    ctx.quadraticCurveTo(cx + 5.5 * U, by - 6.3 * U, cx + 8 * U, by - 8.4 * U);
    ctx.quadraticCurveTo(cx + 5 * U, by - 8.6 * U, cx + 2.2 * U, by - 10.2 * U);
    ctx.lineTo(cx - 2.2 * U, by - 10.2 * U);
    ctx.quadraticCurveTo(cx - 5 * U, by - 8.6 * U, cx - 8 * U, by - 8.4 * U);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - 0.5 * U, by - 11.4 * U, U, 1.2 * U);
    ctx.fillStyle = lacquer;
    for (const dx of [-2.8, 2.8]) ctx.fillRect(cx + dx * U - U * 0.4, by - 5.7 * U, U * 0.8, U * 1.2);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    bank(ctx, g, sky, -g.W * 0.02, g.W * 0.3, g.H * 0.855);
    bank(ctx, g, sky, g.W * 0.7, g.W * 1.02, g.H * 0.875);
    paintBamboo(ctx, g, sky, rand);
    paintPavilion(ctx, g, sky, g.W * 0.86, g.H * 0.883);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const sc = skyColors(sky);
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, sc, rand);
    state.far = paintPeaks(g, sky, sc, FAR, 0.95, 5);
    state.mid = paintPeaks(g, sky, sc, MID, 0.6, 17);
    state.near = paintPeaks(g, sky, sc, NEAR, 0.2, 29);
    state.water = paintWater(g, sky, sc, [state.far, state.mid, state.near], rand);
    state.sheen = paintSheen(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    const mistTone = mixColor(rgb('#e4e6e0'), sc.haze, 0.35 + sky.night * 0.4);
    const mw = Math.ceil(g.W * 1.4);
    state.mistA = paintMist(mw, Math.ceil(g.H * 0.16), mistTone, 21);
    state.mistB = paintMist(mw, Math.ceil(g.H * 0.18), mistTone, 33);
    state.mistC = paintMist(mw, Math.ceil(g.H * 0.1), mistTone, 45);
    state.rainInk = sky.night > 0.5 ? '#9aa6c4' : '#eef0ea';
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, c, y, speed, amount, alpha) {
    if (amount <= 0) return;
    const off = -((t * g.U * speed) % c.width);
    ctx.globalAlpha = Math.min(1, alpha * amount);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function drawSheen(ctx, g, t) {
    const off = (t * g.U * 0.5) % g.W;
    ctx.drawImage(state.sheen, off, 0);
    ctx.drawImage(state.sheen, off - g.W, 0);
  }

  function drawRipples(ctx, g, t, amount) {
    if (amount <= 0) return;
    const wl = g.H * WATERLINE;
    ctx.strokeStyle = state.rainInk;
    ctx.lineWidth = 1;
    const n = Math.min(MAX_RIPPLES, Math.ceil(MAX_RIPPLES * Math.min(1, amount)));
    for (let i = 0; i < n; i++) {
      const a = (t * 0.45 + i * 0.137 * 7) % 1;
      const slot = Math.floor(t * 0.45 + i * 0.137 * 7);
      const px = g.W * ((Math.sin(slot * 12.9898 + i * 4.1) * 43758.5453 % 1 + 1) % 1);
      const py = wl + g.H * (0.05 + ((Math.sin(slot * 7.31 + i * 2.3) * 9631.7 % 1 + 1) % 1) * 0.24);
      const r = g.U * (0.6 + a * 2.6);
      ctx.globalAlpha = (1 - a) * 0.5;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 2, r * 0.55, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawRain(ctx, g, t, amount) {
    if (amount <= 0) return;
    const n = Math.min(MAX_DROPS, Math.ceil(MAX_DROPS * Math.min(1, amount) * (0.6 + amount * 0.2)));
    const len = g.U * 2.6;
    const slant = 0.22;
    const span = g.H + len * 2;
    ctx.strokeStyle = state.rainInk;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 0.55 + (i % 7) * 0.05;
      const y = (i * 53.7 + t * g.H * sp) % span - len;
      const x = ((i * 91.3) % (g.W + g.H * slant)) - y * slant;
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * slant, y + len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = state.dim > 0.5 ? '#1a2036' : '#3a4048';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8 - state.dim * 0.5;
    ctx.beginPath();
    for (let i = 0; i < MAX_BIRDS; i++) {
      const p = ((t * 0.012 + i * 0.045) % 1.2) - 0.1;
      const bx = g.W * (1 - p);
      const by = g.H * (0.2 + i * 0.03) + Math.sin(t * 0.5 + i) * g.U;
      const flap = Math.sin(t * 5 + i * 2) * g.U * 0.8;
      const w = g.U * 1.6;
      ctx.moveTo(bx - w, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + w, by - flap);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawCormorant(ctx, x0, y0, s, flip) {
    ctx.fillStyle = '#1e222c';
    ctx.beginPath();
    ctx.ellipse(x0, y0 - s * 1.6, s * 1.1, s * 1.7, 0, 0, 6.3);
    ctx.fill();
    ctx.fillRect(x0 + flip * s * 0.5, y0 - s * 4.2, Math.max(1, s * 0.5), s * 1.8);
    ctx.fillRect(x0 + flip * s * 0.5, y0 - s * 4.4, s * 1.2 * flip, Math.max(1, s * 0.4));
  }

  // One raft crosses the river about every two minutes.
  function drawRaft(ctx, g, t) {
    const cycle = 150;
    const p = (t % cycle) / cycle;
    const L = g.U * 17;
    const x0 = lerp(-L * 1.4, g.W + L * 0.4, p);
    const bob = Math.sin(t * 0.9) * g.U * 0.25;
    const y0 = g.H * 0.775 + bob;
    const th = Math.max(1, g.U * 0.9);
    ctx.fillStyle = '#10162a';
    ctx.globalAlpha = 0.28;
    ctx.fillRect(x0 + L * 0.05, y0 + th * 2.2, L * 0.9, Math.max(1, th * 0.6));
    ctx.globalAlpha = 1;
    const tones = ['#a89a58', '#bfae68', '#8f8a4c'];
    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = tones[r];
      ctx.fillRect(x0, y0 + r * th * 0.75, L, Math.max(1, th * 0.7));
    }
    ctx.fillStyle = '#6e6a38';
    for (let k = 1; k < 7; k++) ctx.fillRect(x0 + (L * k) / 7, y0, 1, th * 2.2);
    ctx.strokeStyle = '#a89a58';
    ctx.lineWidth = Math.max(1, th * 0.7);
    ctx.beginPath();
    ctx.moveTo(x0 + L, y0 + th * 0.4);
    ctx.quadraticCurveTo(x0 + L * 1.1, y0 + th * 0.3, x0 + L * 1.13, y0 - th * 1.2);
    ctx.stroke();
    ctx.fillStyle = '#5a4a32';
    ctx.fillRect(x0 + L * 0.46, y0 - g.U * 7, Math.max(1, g.U * 0.4), g.U * 7.3);
    drawCormorant(ctx, x0 + L * 0.2, y0, g.U * 0.75, 1);
    drawCormorant(ctx, x0 + L * 0.78, y0, g.U * 0.75, 1);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    const wl = g.H * WATERLINE;
    ctx.drawImage(state.sky, 0, 0);
    drawBirds(ctx, g, t);
    ctx.drawImage(state.far, 0, 0);
    drawMist(ctx, g, t, state.mistA, g.H * 0.3, 0.9, props.mist, 0.95);
    ctx.drawImage(state.mid, 0, 0);
    drawMist(ctx, g, t, state.mistB, g.H * 0.42, 1.5, props.mist, 0.85);
    ctx.drawImage(state.near, 0, 0);
    ctx.drawImage(state.water, 0, 0);
    drawSheen(ctx, g, t);
    drawMist(ctx, g, t, state.mistC, wl - g.H * 0.05, 2.2, props.mist, 0.55);
    drawRipples(ctx, g, t, props.rain);
    if (props.raft) drawRaft(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawRain(ctx, g, t, props.rain);
  }

  Kasuri.run({
    defaults: { time: 'auto', rain: 1, mist: 1, raft: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
