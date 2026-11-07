/*
 * 風鈴 Furin — a glass wind chime under the eaves, on a still summer afternoon.
 *
 * The garden behind is out of focus and baked; the eave and morning glories sit
 * in front. Bell and paper strip are a pair of slow pendulums, the strip a beat
 * behind the bell, moved by occasional soft gusts.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, noise2 } = K;

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintGarden(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    sky.addColorStop(0, '#7fb0cc');
    sky.addColorStop(1, '#d9e7df');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#4d7d55';
    ctx.fillRect(0, g.H * 0.46, g.W, g.H * 0.54);
    const inks = ['#4d7d55', '#6c9b62', '#3a6a4c', '#90b071'];
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      const y = g.H * (0.46 + rand() * 0.56);
      const r = g.U * (5 + rand() * 11);
      const [cr, cg, cb] = K.parseColor(inks[Math.floor(rand() * inks.length)]);
      const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
      blob.addColorStop(0, `rgba(${cr},${cg},${cb},0.85)`);
      blob.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = blob;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  }

  function paintCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.04, 4, 3);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 248;
        img.data[i + 3] = smoothstep(0.48, 0.64, v) * band * 225;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintEave(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const beam = ctx.createLinearGradient(0, 0, 0, u * 11);
    beam.addColorStop(0, '#2b2019');
    beam.addColorStop(1, '#5c4530');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, g.W, u * 11);
    ctx.fillStyle = '#20170f';
    for (let x = 0; x < g.W; x += u * 15) ctx.fillRect(x, 0, u * 2.4, u * 8);
    ctx.fillStyle = '#6f5338';
    ctx.fillRect(0, u * 10, g.W, u * 1.2);
    ctx.fillStyle = '#3c2c1f';
    ctx.fillRect(g.W * 0.9, 0, u * 6, g.H);
    ctx.fillRect(0, g.H - u * 10, g.W, u * 10);
    ctx.fillStyle = '#6f5338';
    ctx.fillRect(0, g.H - u * 10, g.W, u * 1);
    paintVine(ctx, g, rand);
    return c;
  }

  function paintVine(ctx, g, rand) {
    const u = g.U;
    const x0 = g.W * 0.92;
    ctx.strokeStyle = '#3c6a3e';
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    ctx.moveTo(x0, g.H - u * 10);
    for (let y = g.H - u * 10; y > u * 8; y -= u * 3) ctx.lineTo(x0 + Math.sin(y * 0.12) * u * 3, y);
    ctx.stroke();
    for (let y = g.H - u * 13; y > u * 12; y -= u * 4.6) {
      const x = x0 + Math.sin(y * 0.12) * u * 3;
      const side = rand() < 0.5 ? -1 : 1;
      ctx.fillStyle = rand() < 0.5 ? '#46793f' : '#376a37';
      ctx.beginPath();
      ctx.ellipse(x + side * u * 2.6, y, u * 2.6, u * 1.9, 0, 0, 6.3);
      ctx.fill();
      if (rand() < 0.45) {
        ctx.fillStyle = rand() < 0.5 ? '#3f5aa6' : '#7b4f9c';
        ctx.beginPath();
        ctx.arc(x - side * u * 2.4, y + u, u * 2.4, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = '#e8e6da';
        ctx.beginPath();
        ctx.arc(x - side * u * 2.4, y + u, u * 0.8, 0, 6.3);
        ctx.fill();
      }
    }
  }

  function paintBell(r) {
    const size = Math.ceil(r * 2.4);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const m = size / 2;
    const glass = ctx.createRadialGradient(m - r * 0.3, m - r * 0.45, r * 0.1, m, m, r);
    glass.addColorStop(0, 'rgba(244,250,248,1)');
    glass.addColorStop(0.55, 'rgba(160,204,214,0.95)');
    glass.addColorStop(1, 'rgba(58,110,138,1)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.arc(m, m, r, Math.PI * 0.02, Math.PI * 0.98, true);
    ctx.closePath();
    ctx.fill();
    // A little painted goldfish, as these usually have.
    ctx.fillStyle = '#c64a2f';
    ctx.beginPath();
    ctx.ellipse(m - r * 0.18, m - r * 0.36, r * 0.22, r * 0.12, -0.2, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(m + r * 0.02, m - r * 0.38);
    ctx.lineTo(m + r * 0.28, m - r * 0.55);
    ctx.lineTo(m + r * 0.28, m - r * 0.24);
    ctx.fill();
    ctx.strokeStyle = '#a24f3c';
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.arc(m, m, r * 0.98, Math.PI * 0.02, Math.PI * 0.98, true);
    ctx.stroke();
    return c;
  }

  // Quiet air with the odd soft gust.
  function gust(t) {
    return smoothstep(0.52, 0.72, noise2(t * 0.12, 3.3, 9));
  }

  function drawChime(ctx, g, t, wind) {
    const u = g.U;
    const x = g.W * 0.46;
    const top = u * 11;
    const air = (0.14 + gust(t)) * wind;
    const bell = Math.sin(t * 1.5) * 0.09 * air;
    const clapper = Math.sin(t * 1.5 - 0.7) * 0.2 * air + bell;
    const strip = Math.sin(t * 1.5 - 1.5) * 0.46 * air + Math.sin(t * 3.1) * 0.05 * air + 0.05 * air;
    const stringLen = u * 12;
    const bx = x + Math.sin(bell) * stringLen;
    const by = top + Math.cos(bell) * stringLen;
    ctx.strokeStyle = '#3b3128';
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const hang = u * 14;
    const cx = bx + Math.sin(clapper) * hang;
    const cy = by + Math.cos(clapper) * hang;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    drawStrip(ctx, u, cx, cy, strip);
    ctx.fillStyle = '#c9a54a';
    ctx.fillRect(cx - u * 0.6, cy - u, u * 1.2, u * 2);
    ctx.save();
    ctx.translate(bx, by + u * 10);
    ctx.rotate(-bell);
    ctx.drawImage(state.bell, -state.bell.width / 2, -state.bell.height / 2);
    ctx.restore();
  }

  function drawStrip(ctx, u, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    ctx.fillStyle = '#ece4cc';
    ctx.fillRect(-u * 2.6, 0, u * 5.2, u * 28);
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(-u * 2.6, u * 24, u * 5.2, u * 2);
    ctx.fillRect(-u * 2.6, u * 2, u * 5.2, Math.max(1, u * 0.7));
    ctx.restore();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.garden = paintGarden(g, rand);
    state.cloud = paintCloud(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.42));
    state.eave = paintEave(g, rand);
    state.bell = paintBell(g.U * 13);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.garden, 0, 0, g.W, g.H * 0.4, 0, 0, g.W, g.H * 0.4);
    const w = state.cloud.width;
    const x = -((t * g.U * 1.2) % w);
    ctx.drawImage(state.cloud, x, g.H * 0.08);
    ctx.drawImage(state.cloud, x + w, g.H * 0.08);
    ctx.drawImage(state.garden, 0, g.H * 0.4, g.W, g.H * 0.6, Math.sin(t * 0.3) * g.U * 0.4, g.H * 0.4, g.W, g.H * 0.6);
    ctx.drawImage(state.eave, 0, 0);
    drawChime(ctx, g, t, props.wind);
  }

  Kasuri.run({
    defaults: { wind: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 0.95, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
