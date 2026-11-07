/*
 * 梟 Fukuro — an owl on a branch under a low moon.
 *
 * The body is baked with its barred feathers. The head turns in slow steps,
 * pauses, and turns back, as owls do, and the eyes blink now and then. Cloud
 * slides past the moon and a few leaves let go.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const MAX_LEAVES = 40;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H);
    sky.addColorStop(0, '#0e1730');
    sky.addColorStop(1, '#2f3c63');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#cdd2dc';
    for (let i = 0; i < g.W * 0.6; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.5;
      ctx.fillRect(rand() * g.W, rand() * g.H, 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * 0.7;
    const my = g.H * 0.36;
    const r = g.U * 22;
    const halo = ctx.createRadialGradient(mx, my, r * 0.8, mx, my, r * 2.6);
    halo.addColorStop(0, 'rgba(226,214,170,0.35)');
    halo.addColorStop(1, 'rgba(226,214,170,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#ece0bc';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#cdbf9c';
    for (let i = 0; i < 9; i++) {
      const a = rand() * 6.28;
      const d = rand() * r * 0.75;
      ctx.beginPath();
      ctx.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, r * (0.08 + rand() * 0.14), 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  function twig(ctx, g, rand, x, y, angle, len, width, depth, tips) {
    const nx = x + Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    tips.push({ x: nx, y: ny });
    if (depth === 0) return;
    twig(ctx, g, rand, nx, ny, angle + 0.3 + rand() * 0.3, len * 0.72, width * 0.66, depth - 1, tips);
    twig(ctx, g, rand, nx, ny, angle - 0.4 - rand() * 0.3, len * 0.66, width * 0.62, depth - 1, tips);
  }

  function paintBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#150f0d';
    ctx.lineCap = 'round';
    const tips = [];
    ctx.lineWidth = g.U * 4.6;
    ctx.beginPath();
    ctx.moveTo(-g.U, g.H * 0.84);
    ctx.quadraticCurveTo(g.W * 0.3, g.H * 0.74, g.W * 0.6, g.H * 0.76);
    ctx.stroke();
    twig(ctx, g, rand, g.W * 0.6, g.H * 0.76, -0.25, g.U * 17, g.U * 2.8, 5, tips);
    twig(ctx, g, rand, g.W * 0.18, g.H * 0.8, -1.1, g.U * 18, g.U * 2.2, 5, tips);
    ctx.fillStyle = '#231d1a';
    for (const tip of tips) {
      if (rand() > 0.55) continue;
      ctx.beginPath();
      ctx.ellipse(tip.x, tip.y, g.U * 1.3, g.U * 0.7, rand() * 3, 0, 6.3);
      ctx.fill();
    }
    state.tips = tips;
    return c;
  }

  function paintBody(u) {
    const w = Math.ceil(u * 30);
    const h = Math.ceil(u * 40);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.translate(w / 2, h);
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-u * 12, -u * 28);
      ctx.bezierCurveTo(-u * 15, -u * 12, -u * 10, -u * 2, 0, -u * 1);
      ctx.bezierCurveTo(u * 10, -u * 2, u * 15, -u * 12, u * 12, -u * 28);
      ctx.closePath();
    };
    ctx.fillStyle = '#7c6a54';
    body();
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = '#d7c9ab';
    ctx.beginPath();
    ctx.ellipse(0, -u * 13, u * 8.5, u * 14, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#6b5a45';
    for (let row = 0; row < 8; row++) {
      const y = -u * (25 - row * 3);
      for (let k = -3; k <= 3; k++) {
        ctx.fillRect(k * u * 2.2 + (row % 2) * u * 1.1 - u * 0.5, y, u, Math.max(1, u * 0.6));
      }
    }
    ctx.fillStyle = '#493a2c';
    ctx.beginPath();
    ctx.ellipse(-u * 12, -u * 14, u * 4, u * 14, 0.12, 0, 6.3);
    ctx.ellipse(u * 12, -u * 14, u * 4, u * 14, -0.12, 0, 6.3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#c29a4e';
    for (const x of [-4, -2.6, 2.6, 4]) ctx.fillRect(x * u - u * 0.5, -u * 1.6, u, u * 2);
    return c;
  }

  // Slow stepped turning: hold, swing, hold, swing back.
  function headTurn(t) {
    const p = (t * 0.04) % 1;
    return smoothstep(0.1, 0.17, p) * (1 - smoothstep(0.4, 0.47, p)) * 0.8
      - smoothstep(0.58, 0.65, p) * (1 - smoothstep(0.86, 0.93, p)) * 0.6;
  }

  function drawEye(ctx, u, x, turn, shut) {
    ctx.fillStyle = '#e0ad3f';
    ctx.beginPath();
    ctx.arc(x, 0, u * 2.9, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#11100e';
    ctx.beginPath();
    ctx.arc(x + turn * u * 0.5, 0, u * 1.6, 0, 6.3);
    ctx.fill();
    if (shut > 0) {
      ctx.fillStyle = '#7c6a54';
      ctx.fillRect(x - u * 3.1, -u * 3.1, u * 6.2, u * 6.2 * shut);
    }
  }

  function drawHead(ctx, g, u, t) {
    const turn = headTurn(t);
    const blink = (t * 0.17) % 1 < 0.03 ? 1 : 0;
    const shift = turn * u * 3.4;
    ctx.save();
    ctx.translate(state.perch.x, state.perch.y - u * 33);
    ctx.fillStyle = '#7c6a54';
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 12.5, u * 10.5, 0, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(shift - u * 10, -u * 7);
    ctx.lineTo(shift - u * 8.5, -u * 14);
    ctx.lineTo(shift - u * 3.4, -u * 9);
    ctx.moveTo(shift + u * 10, -u * 7);
    ctx.lineTo(shift + u * 8.5, -u * 14);
    ctx.lineTo(shift + u * 3.4, -u * 9);
    ctx.fill();
    ctx.fillStyle = '#d7c9ab';
    ctx.beginPath();
    ctx.ellipse(shift - u * 4.5, u * 0.6, u * 5, u * 5.6, 0, 0, 6.3);
    ctx.ellipse(shift + u * 4.5, u * 0.6, u * 5, u * 5.6, 0, 0, 6.3);
    ctx.fill();
    drawEye(ctx, u, shift - u * 4.5, turn, blink);
    drawEye(ctx, u, shift + u * 4.5, turn, blink);
    ctx.fillStyle = '#3b3126';
    ctx.beginPath();
    ctx.moveTo(shift - u * 1, u * 2.4);
    ctx.lineTo(shift, u * 5);
    ctx.lineTo(shift + u * 1, u * 2.4);
    ctx.fill();
    ctx.restore();
  }

  function paintCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.018, y * 0.05, 4, 16);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 112;
        img.data[i + 1] = 122;
        img.data[i + 2] = 152;
        img.data[i + 3] = smoothstep(0.46, 0.68, v) * band * 180;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawLeaves(ctx, g, t, dt) {
    ctx.fillStyle = '#8c6a44';
    for (let i = 0; i < MAX_LEAVES; i++) {
      state.ly[i] += state.lv[i] * dt;
      state.lx[i] += (g.U * 2.2 + Math.sin(t * 0.9 + i) * g.U * 3) * dt;
      if (state.ly[i] > g.H || state.lx[i] > g.W) {
        const tip = state.tips[i % state.tips.length];
        state.lx[i] = tip.x;
        state.ly[i] = tip.y;
      }
      ctx.fillRect(state.lx[i], state.ly[i], Math.sin(t * 2 + i) > 0 ? 2 : 1, 1);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.branch = paintBranch(g, rand);
    state.u = g.U * 1.05;
    state.body = paintBody(state.u);
    state.perch = { x: g.W * 0.34, y: g.H * 0.76 };
    state.cloud = paintCloud(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.46));
    state.lx = new Float32Array(MAX_LEAVES);
    state.ly = new Float32Array(MAX_LEAVES);
    state.lv = new Float32Array(MAX_LEAVES);
    for (let i = 0; i < MAX_LEAVES; i++) {
      state.lx[i] = rand() * g.W;
      state.ly[i] = rand() * g.H;
      state.lv[i] = g.U * (3 + rand() * 3);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const u = state.u;
    ctx.drawImage(state.sky, 0, 0);
    const w = state.cloud.width;
    const x = -((t * g.U * 2 * api.props.clouds) % w);
    ctx.drawImage(state.cloud, x, g.H * 0.12);
    ctx.drawImage(state.cloud, x + w, g.H * 0.12);
    ctx.drawImage(state.branch, 0, 0);
    const breath = Math.sin(t * 0.9) * u * 0.18;
    ctx.drawImage(state.body, state.perch.x - state.body.width / 2, state.perch.y - state.body.height + u * 0.8 + breath);
    drawHead(ctx, g, u, t);
    drawLeaves(ctx, g, t, dt);
  }

  Kasuri.run({
    defaults: { clouds: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
