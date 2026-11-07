/*
 * 漁火 Isaribi — squid boats on the night horizon, their lamps strung over the sea.
 *
 * Each boat is a small row of lamps with a soft glow and a broken column of
 * light on the water. The far ones barely move. One near boat rocks on the
 * swell in silhouette. Water is two streak textures sliding past each other.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const LAMP = '#f2e0a8';
  const COLUMN = '#c9b06e';
  const HORIZON = 0.46;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintGlow(radius) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(226,212,150,0.65)');
    grad.addColorStop(1, 'rgba(180,170,120,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const line = g.H * HORIZON;
    const sky = ctx.createLinearGradient(0, 0, 0, line);
    sky.addColorStop(0, '#0b1128');
    sky.addColorStop(0.75, '#232d52');
    sky.addColorStop(1, '#5a5a70');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, line);
    ctx.fillStyle = '#d3d7e0';
    for (let i = 0; i < g.W; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.5;
      ctx.fillRect(rand() * g.W, rand() * line * 0.8, 1, 1);
    }
    ctx.globalAlpha = 1;
    const sea = ctx.createLinearGradient(0, line, 0, g.H);
    sea.addColorStop(0, '#2c3657');
    sea.addColorStop(1, '#0c1226');
    ctx.fillStyle = sea;
    ctx.fillRect(0, line, g.W, g.H - line);
    ctx.fillStyle = '#1b2140';
    ctx.beginPath();
    ctx.moveTo(0, line);
    for (let x = 0; x <= g.W * 0.32; x += 2) ctx.lineTo(x, line - (1 - x / (g.W * 0.32)) * fbm(x * 0.03, 2, 3, 5) * g.H * 0.15);
    ctx.lineTo(g.W * 0.32, line);
    ctx.fill();
    return c;
  }

  function paintStreaks(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.03, y * 0.55, 3, seed);
    for (let y = 0; y < h; y++) {
      const near = y / h;
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 118;
        img.data[i + 1] = 136;
        img.data[i + 2] = 176;
        img.data[i + 3] = smoothstep(0.55, 0.72, v) * (35 + near * 70);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeBoats(g, rand) {
    const list = [];
    for (let i = 0; i < 11; i++) {
      list.push({
        x: g.W * (0.2 + rand() * 0.82),
        dist: rand(),
        lamps: 4 + Math.floor(rand() * 5),
        phase: rand() * 6.28,
        drift: g.U * (0.1 + rand() * 0.3),
      });
    }
    return list.sort((a, b) => a.dist - b.dist);
  }

  function drawBoat(ctx, g, b, t) {
    const line = g.H * HORIZON;
    const y = line + b.dist * g.U * 6 - g.U * 0.5;
    const span = g.W + g.U * 30;
    const x = ((b.x + t * b.drift) % span) - g.U * 15;
    const s = lerp(0.6, 1.1, b.dist);
    const gap = g.U * 1.05 * s;
    const glow = state.glow;
    const r = g.U * 9 * s;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.72 + Math.sin(t * 0.4 + b.phase) * 0.14;
    ctx.drawImage(glow, x - r, y - g.U * 2 - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    // A long column on the water, broken by the swell.
    ctx.fillStyle = COLUMN;
    const rows = 14;
    for (let k = 0; k < rows; k++) {
      const yy = y + g.U * 1.2 + k * g.U * (1.1 + k * 0.12) * s;
      const wob = Math.sin(t * 1.1 + k * 1.4 + b.phase) * g.U * (0.2 + k * 0.1);
      const w = g.U * (1.2 + k * 0.28) * s * (0.6 + 0.4 * Math.sin(t * 0.8 + k * 2.1 + b.phase));
      ctx.globalAlpha = 0.5 * (1 - k / rows);
      ctx.fillRect(x + wob - w, yy, w * 2, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#080a14';
    ctx.fillRect(x - gap * b.lamps * 0.5, y - g.U * 0.5, gap * b.lamps, Math.max(1, g.U * 0.8));
    ctx.fillStyle = LAMP;
    for (let l = 0; l < b.lamps; l++) ctx.fillRect(x - gap * b.lamps * 0.5 + l * gap, y - g.U * 2, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.5));
  }

  function drawNearBoat(ctx, g, t) {
    const u = g.U;
    const x = g.W * 0.26 + Math.sin(t * 0.05) * u * 6;
    const y = g.H * 0.8 + Math.sin(t * 0.7) * u * 0.7;
    const r = u * 18;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(state.glow, x + u * 8 - r, y - u * 12 - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 0.55) * 0.035);
    ctx.fillStyle = '#05070e';
    ctx.beginPath();
    ctx.moveTo(-u * 20, -u * 3);
    ctx.lineTo(u * 21, -u * 4.5);
    ctx.lineTo(u * 14, u * 2);
    ctx.lineTo(-u * 15, u * 2);
    ctx.fill();
    ctx.fillRect(-u * 9, -u * 8, u * 10, u * 5);
    ctx.fillRect(u * 8, -u * 15, Math.max(1, u * 0.5), u * 11);
    ctx.fillStyle = LAMP;
    ctx.fillRect(u * 7, -u * 16, u * 2, u * 1.4);
    ctx.fillRect(-u * 7, -u * 6.8, u * 2, u * 1.6);
    ctx.restore();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.glow = paintGlow(40);
    const w = Math.ceil(g.W * 1.3);
    const h = Math.ceil(g.H * (1 - HORIZON));
    state.far = paintStreaks(w, h, 7);
    state.near = paintStreaks(w, h, 19);
    state.boats = makeBoats(g, rand);
  }

  function slide(ctx, tile, y, offset) {
    const w = tile.width;
    const x = -(((offset % w) + w) % w);
    ctx.drawImage(tile, x, y);
    ctx.drawImage(tile, x + w, y);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const swell = api.props.swell;
    ctx.drawImage(state.back, 0, 0);
    const line = g.H * HORIZON;
    slide(ctx, state.far, line, t * g.U * 1.2 * swell);
    slide(ctx, state.near, line, -t * g.U * 2 * swell);
    for (const b of state.boats) drawBoat(ctx, g, b, t);
    drawNearBoat(ctx, g, t);
  }

  Kasuri.run({
    defaults: { swell: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, tint: 0.5 },
    maxFps: 20,
    setup,
    draw,
  });
})();
