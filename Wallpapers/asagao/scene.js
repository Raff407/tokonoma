/*
 * 朝顔 Asagao — morning glories on a bamboo trellis at first light.
 *
 * Sky, hills, farmhouse and ground are baked once. The trellis with its vines is
 * baked as a separate layer and drawn in a few slices that sway together. Flowers
 * are four small reused sprites that open and close on slow cycles, a wind bell
 * hangs from the eave, and one tiling strip of mist drifts over the hills.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  const GROUND = 0.8;
  const EAVE = 0.46;
  const SUN = { x: 0.47, y: 0.29, r: 0.08 };
  const SLICES = 10;
  const VINES = 6;
  const FLOWERS = 18;
  const STAGES = 4;
  const state = {};

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

  function geometry(api) {
    return { W: api.cols, H: api.rows, U: api.rows / 100 };
  }

  const X = (g, f) => g.W * f;
  const Y = (g, f) => g.H * f;

  // ---- sky and hills -----------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, Y(g, 0.66));
    grad.addColorStop(0, '#34406a');
    grad.addColorStop(0.4, '#6c6c96');
    grad.addColorStop(0.72, '#e8aa90');
    grad.addColorStop(1, '#f6d8a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const glow = ctx.createRadialGradient(X(g, SUN.x), Y(g, SUN.y), 0, X(g, SUN.x), Y(g, SUN.y), g.W * 0.42);
    glow.addColorStop(0, 'rgba(250,214,150,0.75)');
    glow.addColorStop(0.35, 'rgba(238,170,120,0.32)');
    glow.addColorStop(1, 'rgba(238,170,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintSun(g) {
    const r = g.H * SUN.r;
    const size = Math.ceil(r * 5);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const halo = ctx.createRadialGradient(size / 2, size / 2, r * 0.8, size / 2, size / 2, size / 2);
    halo.addColorStop(0, 'rgba(250,200,130,0.5)');
    halo.addColorStop(1, 'rgba(250,200,130,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#e6623c';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f0905a';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r * 0.8, 0, TAU);
    ctx.fill();
    return c;
  }

  function ridgeLayer(g, base, amp, seed, color, freq) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, Y(g, base) - fbm(x * freq, 3, 3, seed) * amp * g.H);
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    return c;
  }

  function paintCedar(ctx, px, base, h, color) {
    ctx.fillStyle = color;
    for (let k = 0; k < 5; k++) {
      const yy = base - h + (k * h) / 5.5;
      const w = h * (0.1 + k * 0.045);
      poly(ctx, [px, yy - h * 0.12, px - w, yy + h * 0.2, px + w, yy + h * 0.2]);
    }
    ctx.fillRect(px - h * 0.02, base - h * 0.1, h * 0.04, h * 0.1);
  }

  function paintHills(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(ridgeLayer(g, 0.64, 0.1, 5, '#7a7498', 0.012), 0, 0);
    ctx.drawImage(ridgeLayer(g, 0.7, 0.08, 9, '#566186', 0.016), 0, 0);
    paintCedar(ctx, X(g, 0.965), Y(g, 0.74), Y(g, 0.3), '#2e3d3c');
    paintCedar(ctx, X(g, 0.925), Y(g, 0.74), Y(g, 0.22), '#364442');
    paintCedar(ctx, X(g, 0.4), Y(g, 0.74), Y(g, 0.16), '#3a4a4a');
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.08, 4, 33), fbm((x - w) * 0.012, y * 0.08, 4, 33), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 246;
        img.data[i + 1] = 226;
        img.data[i + 2] = 212;
        img.data[i + 3] = smoothstep(0.4, 0.68, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- farmhouse ---------------------------------------------------------

  function roofRows(ctx, g, x0, x1, y0, y1, color, line) {
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = line;
    const step = Math.max(2, g.U * 1.3);
    for (let yy = y0; yy < y1; yy += step) ctx.fillRect(x0, yy, x1 - x0, 1);
  }

  function paintHouse(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const xl = X(g, 0.44);
    const xr = X(g, 0.96);
    const eave = Y(g, EAVE);
    const floor = Y(g, 0.72);
    // plaster wall, posts and lit paper screens
    ctx.fillStyle = '#d8c9ab';
    ctx.fillRect(xl + g.U, eave, xr - xl - 2 * g.U, floor - eave);
    ctx.fillStyle = '#e4b66c';
    const panes = [0.49, 0.6, 0.71, 0.82];
    for (const f of panes) ctx.fillRect(X(g, f), Y(g, 0.52), X(g, 0.075), Y(g, 0.17));
    ctx.fillStyle = '#8a5f2c';
    for (const f of panes) {
      ctx.fillRect(X(g, f) + X(g, 0.0375) - 0.5, Y(g, 0.52), 1, Y(g, 0.17));
      for (let k = 1; k < 4; k++) ctx.fillRect(X(g, f), Y(g, 0.52) + (Y(g, 0.17) * k) / 4, X(g, 0.075), 1);
    }
    ctx.fillStyle = '#3a2a1e';
    for (let f = 0.455; f <= 0.96; f += 0.0525) ctx.fillRect(X(g, f), eave, Math.max(1, g.U * 0.7), floor - eave);
    ctx.fillRect(xl, Y(g, 0.5), xr - xl, Math.max(1, g.U * 0.5));
    // veranda boards and shadow beneath
    ctx.fillStyle = '#6c4c30';
    ctx.fillRect(xl - g.U * 2, floor, xr - xl + g.U * 4, Y(g, 0.035));
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(xl - g.U * 2, floor + Y(g, 0.035), xr - xl + g.U * 4, Y(g, 0.03));
    // tiled hip roof
    const rows = Y(g, EAVE) - Y(g, 0.31);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(X(g, 0.42), eave + g.U * 1.2);
    ctx.lineTo(X(g, 0.98), eave + g.U * 1.2);
    ctx.lineTo(X(g, 0.87), Y(g, 0.31));
    ctx.lineTo(X(g, 0.53), Y(g, 0.31));
    ctx.closePath();
    ctx.clip();
    roofRows(ctx, g, X(g, 0.4), X(g, 1), Y(g, 0.3), eave + g.U * 2, '#3b4150', '#555c6c');
    ctx.restore();
    ctx.fillStyle = '#242830';
    ctx.fillRect(X(g, 0.42), eave + g.U * 0.4, X(g, 0.56), g.U * 1.2);
    // upper gable: plaster face under a second small roof
    ctx.fillStyle = '#cdbd9c';
    poly(ctx, [X(g, 0.57), Y(g, 0.31), X(g, 0.83), Y(g, 0.31), X(g, 0.7), Y(g, 0.19)]);
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(X(g, 0.695), Y(g, 0.21), Math.max(1, g.U * 0.6), Y(g, 0.1));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(X(g, 0.54), Y(g, 0.325));
    ctx.lineTo(X(g, 0.86), Y(g, 0.325));
    ctx.lineTo(X(g, 0.7), Y(g, 0.165));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#3b4150';
    ctx.fillRect(X(g, 0.5), Y(g, 0.15), X(g, 0.4), Y(g, 0.2));
    ctx.restore();
    ctx.fillStyle = '#2e333f';
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    ctx.strokeStyle = '#2a2e38';
    ctx.beginPath();
    ctx.moveTo(X(g, 0.54), Y(g, 0.325));
    ctx.lineTo(X(g, 0.7), Y(g, 0.165));
    ctx.lineTo(X(g, 0.86), Y(g, 0.325));
    ctx.stroke();
    ctx.fillStyle = '#c9a85a';
    ctx.fillRect(X(g, 0.7) - g.U * 0.4, Y(g, 0.155), g.U * 0.8, g.U * 1.6);
    return c;
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = Y(g, GROUND);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#5a6a3c');
    grad.addColorStop(1, '#2c3a28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = '#7a8450';
    for (let i = 0; i < g.W * 0.8; i++) ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), 1, Math.max(1, g.U * 0.6));
    // stepping stones toward the veranda
    ctx.fillStyle = '#8a8478';
    const stones = [[0.52, 0.83, 0.05], [0.56, 0.88, 0.055], [0.62, 0.93, 0.06]];
    for (const s of stones) {
      ctx.beginPath();
      ctx.ellipse(X(g, s[0]), Y(g, s[1]), X(g, s[2]), Y(g, 0.02), 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(X(g, 0.42), Y(g, 0.755), X(g, 0.56), g.U * 0.8);
    return c;
  }

  // ---- trellis and vines -------------------------------------------------

  function vinePath(g, i) {
    const x0 = 0.06 + (i / (VINES - 1)) * 0.32;
    const pts = [];
    const steps = 22;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const yy = lerp(GROUND, 0.2 + (i % 3) * 0.04, f);
      const xx = x0 + Math.sin(f * 9 + i * 1.7) * 0.025 + (i % 2 ? 0.03 : -0.03) * f;
      pts.push(X(g, xx), Y(g, yy));
    }
    return pts;
  }

  function heartLeaf(ctx, px, py, s, tone) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(px - s * 0.35, py, s * 0.5, 0, TAU);
    ctx.arc(px + s * 0.35, py, s * 0.5, 0, TAU);
    ctx.fill();
    poly(ctx, [px - s * 0.8, py + s * 0.1, px + s * 0.8, py + s * 0.1, px, py + s * 1.1]);
  }

  function paintTrellis(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const x0 = X(g, 0.03);
    const x1 = X(g, 0.42);
    const top = Y(g, 0.16);
    const bot = Y(g, GROUND + 0.02);
    const bamboo = '#9a9658';
    const cord = '#2e2418';
    ctx.lineCap = 'butt';
    ctx.strokeStyle = bamboo;
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    const gap = X(g, 0.07);
    for (let d = -(bot - top); d < x1 - x0 + (bot - top); d += gap) {
      ctx.beginPath();
      ctx.moveTo(x0 + d, top);
      ctx.lineTo(x0 + d + (bot - top), bot);
      ctx.moveTo(x0 + d + (bot - top), top);
      ctx.lineTo(x0 + d, bot);
      ctx.stroke();
    }
    // clip the lattice to the frame by painting the outside back transparent
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    ctx.fillRect(x0, top, x1 - x0, bot - top);
    ctx.globalCompositeOperation = 'source-over';
    // frame poles and cross rails
    ctx.fillStyle = '#8c8850';
    const w = Math.max(2, g.U * 1.1);
    ctx.fillRect(x0 - w / 2, top - g.U * 2, w, bot - top + g.U * 2);
    ctx.fillRect(x1 - w / 2, top - g.U * 2, w, bot - top + g.U * 2);
    ctx.fillRect(x0 - w, top, x1 - x0 + 2 * w, w);
    ctx.fillRect(x0 - w, Y(g, 0.48), x1 - x0 + 2 * w, w);
    ctx.fillStyle = cord;
    for (const rail of [top, Y(g, 0.48)]) {
      for (let px = x0; px <= x1 + 1; px += (x1 - x0) / 4) ctx.fillRect(px - w * 0.6, rail - 1, w * 1.2, w + 2);
    }
    return c;
  }

  function paintVines(g, rand, flowerSpots) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const tones = ['#4f6a3a', '#5f7b44', '#3f5a34', '#6f8a4c'];
    for (let i = 0; i < VINES; i++) {
      const pts = vinePath(g, i);
      ctx.strokeStyle = '#3c5230';
      ctx.lineWidth = Math.max(1, g.U * 0.5);
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
      ctx.stroke();
      for (let k = 2; k < pts.length; k += 2) {
        const side = rand() < 0.5 ? -1 : 1;
        const s = g.U * (1.6 + rand() * 1.4);
        heartLeaf(ctx, pts[k] + side * g.U * 1.6, pts[k + 1] + g.U * rand() * 1.5, s, tones[Math.floor(rand() * 4)]);
        if (rand() < 0.5) heartLeaf(ctx, pts[k] - side * g.U * 1.4, pts[k + 1] - g.U, s * 0.85, tones[Math.floor(rand() * 4)]);
        if (rand() < 0.2 && flowerSpots.length < FLOWERS) flowerSpots.push({ x: pts[k] + side * g.U * 2.4, y: pts[k + 1] + g.U * 2, p: rand() });
      }
    }
    while (flowerSpots.length < FLOWERS) {
      const pts = vinePath(g, Math.floor(rand() * VINES));
      const k = 2 * (3 + Math.floor(rand() * 17));
      flowerSpots.push({ x: pts[k] + g.U * 2, y: pts[k + 1] + g.U * 2, p: rand() });
    }
    return c;
  }

  // ---- flower sprites ----------------------------------------------------

  function paintFlower(g, stage) {
    const s = Math.max(6, Math.round(g.U * 6));
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    const m = s / 2;
    const open = stage / (STAGES - 1);
    if (stage === 0) {
      ctx.fillStyle = '#4a4a86';
      ctx.beginPath();
      ctx.ellipse(m, m, s * 0.14, s * 0.3, 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a78b4';
      ctx.fillRect(m - 0.5, m - s * 0.2, 1, s * 0.3);
      return c;
    }
    const rx = s * (0.18 + open * 0.3);
    const ry = s * (0.28 + open * 0.2);
    ctx.fillStyle = '#35509a';
    ctx.beginPath();
    ctx.ellipse(m, m, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6b88c8';
    ctx.beginPath();
    ctx.ellipse(m, m, rx * 0.68, ry * 0.68, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e6e0d0';
    ctx.beginPath();
    ctx.ellipse(m, m, rx * 0.3, ry * 0.3, 0, 0, TAU);
    ctx.fill();
    return c;
  }

  // ---- wind bell ---------------------------------------------------------

  function drawBell(ctx, g, t) {
    const px = X(g, 0.62);
    const py = Y(g, EAVE) + g.U * 1.4;
    const a = Math.sin(t * 1.25) * 0.22 + Math.sin(t * 0.53) * 0.08;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = '#2a2e38';
    ctx.fillRect(-0.5, 0, 1, g.U * 2.2);
    ctx.fillStyle = '#9ec0cc';
    ctx.beginPath();
    ctx.arc(0, g.U * 3.6, g.U * 1.5, Math.PI, 0);
    ctx.lineTo(g.U * 1.6, g.U * 4.4);
    ctx.lineTo(-g.U * 1.6, g.U * 4.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e9eee4';
    ctx.fillRect(-0.5, g.U * 4.4, 1, g.U * 2);
    ctx.fillStyle = '#d6452c';
    ctx.fillRect(-g.U * 0.5, g.U * 6.4, g.U, g.U * 3.2);
    ctx.restore();
  }

  // ---- motion ------------------------------------------------------------

  const sway = (g, t, yy) => Math.sin(t * 0.9 + yy * 0.06) * g.U * 0.35 * (1 - yy / g.H);

  function drawVines(ctx, g, t) {
    const top = Y(g, 0.12);
    const hh = Y(g, 0.76) - top;
    const sh = hh / SLICES;
    for (let s = 0; s < SLICES; s++) {
      const sy = top + s * sh;
      ctx.drawImage(state.trellis, 0, sy, g.W, sh + 1, sway(g, t, sy) * 0.4, sy, g.W, sh + 1);
      ctx.drawImage(state.vines, 0, sy, g.W, sh + 1, sway(g, t, sy), sy, g.W, sh + 1);
    }
  }

  function drawFlowers(ctx, g, t, bloom) {
    if (bloom <= 0) return;
    const spots = state.spots;
    for (let i = 0; i < spots.length; i++) {
      const f = spots[i];
      const p = (t * 0.02 * bloom + f.p) % 1;
      const amt = smoothstep(0.05, 0.4, p) * (1 - smoothstep(0.78, 0.95, p));
      const stage = Math.min(STAGES - 1, Math.round(amt * (STAGES - 1)));
      const spr = state.flowers[stage];
      ctx.drawImage(spr, f.x - spr.width / 2 + sway(g, t, f.y), f.y - spr.height / 2);
    }
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = Math.min(1, 0.85 * amount);
    ctx.drawImage(c, off, Y(g, 0.6));
    ctx.drawImage(c, off + c.width, Y(g, 0.6));
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(17);
    const spots = [];
    state.g = g;
    state.sky = paintSky(g);
    state.sun = paintSun(g);
    state.hills = paintHills(g);
    state.mist = paintMist(g);
    state.house = paintHouse(g);
    state.ground = paintGround(g, rand);
    state.trellis = paintTrellis(g);
    state.vines = paintVines(g, rand, spots);
    state.spots = spots;
    state.flowers = [];
    for (let s = 0; s < STAGES; s++) state.flowers.push(paintFlower(g, s));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { bloom, mist, bell } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    const sz = state.sun.width;
    ctx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 0.35);
    ctx.drawImage(state.sun, X(g, SUN.x) - sz / 2, Y(g, SUN.y) - sz / 2);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.hills, 0, 0);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.house, 0, 0);
    if (bell) drawBell(ctx, g, t);
    ctx.drawImage(state.ground, 0, 0);
    drawVines(ctx, g, t);
    drawFlowers(ctx, g, t, bloom);
  }

  Kasuri.run({
    defaults: { bloom: 1, mist: 1, bell: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
