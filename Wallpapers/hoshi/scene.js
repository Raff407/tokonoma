/*
 * 星 Hoshi — the whole sky turning around the pole star, over a dark ridge.
 *
 * Stars are polar coordinates about the pole, so turning the sky is one angle
 * per star. The river of the Milky Way is painted once at a third of the grid
 * and rotated as a single image. Now and then a slow meteor crosses.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep, lerp } = K;

  const COLOURS = ['#7f8aa6', '#b2b9cc', '#e8e4d6'];
  const WARM = '#d8a56a';
  const MAX_STARS = 3000;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintRiver(side) {
    const small = Math.ceil(side / 3);
    const c = layer(small, small);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(small, small);
    const tilt = 0.7;
    for (let y = 0; y < small; y++) {
      for (let x = 0; x < small; x++) {
        const nx = x / small - 0.5;
        const ny = y / small - 0.5;
        const along = nx * Math.cos(tilt) + ny * Math.sin(tilt);
        const across = -nx * Math.sin(tilt) + ny * Math.cos(tilt) - 0.09;
        const band = Math.exp(-across * across * 240);
        const cloud = fbm(along * 16 + 3, across * 22 + 7, 4, 9);
        const dust = smoothstep(0.52, 0.66, fbm(along * 26, across * 40, 3, 20));
        const v = band * smoothstep(0.2, 0.62, cloud) * (1 - dust * 0.55);
        const i = (y * small + x) * 4;
        img.data[i] = 150;
        img.data[i + 1] = 158;
        img.data[i + 2] = 196;
        img.data[i + 3] = v * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintRidge(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const far = ctx.createLinearGradient(0, g.H * 0.6, 0, g.H);
    far.addColorStop(0, '#1b2444');
    far.addColorStop(1, '#0e1326');
    ctx.fillStyle = far;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.9 - fbm(x * 0.009, 1, 4, 3) * 0.34));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = '#05070e';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    const near = (x) => g.H * (0.98 - fbm(x * 0.014, 5, 4, 8) * 0.22);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, near(x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let i = 0; i < g.W / 3; i++) {
      const x = rand() * g.W;
      const h = g.U * (2 + rand() * 4);
      ctx.fillRect(x - 0.5, near(x) - h, Math.max(1, h * 0.28), h + 2);
    }
    const hutX = g.W * 0.2;
    const hutY = near(hutX);
    ctx.beginPath();
    ctx.moveTo(hutX - g.U * 4.4, hutY - g.U * 2.2);
    ctx.lineTo(hutX, hutY - g.U * 6.4);
    ctx.lineTo(hutX + g.U * 4.4, hutY - g.U * 2.2);
    ctx.fill();
    ctx.fillRect(hutX - g.U * 3, hutY - g.U * 2.4, g.U * 6, g.U * 3);
    ctx.fillStyle = WARM;
    ctx.fillRect(hutX + g.U * 0.5, hutY - g.U * 1.9, Math.max(1, g.U * 1.2), Math.max(1, g.U * 1.1));
    return c;
  }

  function placeStars(g, rand, reach) {
    state.sr = new Float32Array(MAX_STARS);
    state.sa = new Float32Array(MAX_STARS);
    state.sk = new Float32Array(MAX_STARS);
    for (let i = 0; i < MAX_STARS; i++) {
      state.sr[i] = Math.sqrt(rand()) * reach;
      state.sa[i] = rand() * 6.283;
      state.sk[i] = rand() * 6.283;
    }
  }

  function drawStars(ctx, g, t, turn, density) {
    const count = Math.min(MAX_STARS, Math.round(g.W * g.H * 0.1 * density));
    const cx = state.pole.x;
    const cy = state.pole.y;
    const third = Math.ceil(count / 3);
    for (let band = 0; band < 3; band++) {
      ctx.fillStyle = COLOURS[band];
            const end = Math.min(count, third * (band + 1));
      for (let i = third * band; i < end; i += 1) {
        const a = state.sa[i] + turn;
        const x = cx + Math.cos(a) * state.sr[i];
        const y = cy + Math.sin(a) * state.sr[i];
        if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
        ctx.globalAlpha = 0.68 + 0.32 * Math.sin(t * 0.7 + state.sk[i]);
        const big = band === 2 && i % 7 === 0 ? 2 : 1;
        ctx.fillRect(x, y, big, big);
      }
    }
    ctx.globalAlpha = 1;
  }

  function startMeteor(g) {
    const r = state.rand;
    const m = state.meteor;
    m.life = 1;
    m.x = g.W * (0.1 + r() * 0.7);
    m.y = g.H * (0.04 + r() * 0.28);
    m.vx = g.U * (26 + r() * 20) * (r() < 0.5 ? -1 : 1);
    m.vy = g.U * (12 + r() * 12);
  }

  function drawMeteor(ctx, g, dt, props) {
    const m = state.meteor;
    state.wait -= dt;
    if (state.wait <= 0 && props.meteors) {
      startMeteor(g);
      state.wait = 14 + state.rand() * 26;
    }
    if (m.life <= 0) return;
    m.life -= dt * 0.55;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    ctx.strokeStyle = COLOURS[2];
    ctx.lineWidth = 1;
    ctx.globalAlpha = Math.sin(Math.max(0, m.life) * 3.14) * 0.8;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.vx * 0.32, m.y - m.vy * 0.32);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.pole = { x: g.W * 0.62, y: g.H * 0.26 };
    const reach = Math.hypot(g.W * 0.62, g.H * 0.74);
    state.side = Math.ceil(reach * 2);
    state.river = paintRiver(state.side);
    state.ridge = paintRidge(g, rand);
    placeStars(g, rand, reach);
    state.meteor = { life: 0, x: 0, y: 0, vx: 0, vy: 0 };
    state.wait = 6;
    state.backStyle = (() => {
      const grad = ctx.createLinearGradient(0, 0, 0, g.H);
      grad.addColorStop(0, '#05081a');
      grad.addColorStop(0.7, '#141d3e');
      grad.addColorStop(1, '#39446e');
      return grad;
    })();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const turn = t * 0.012 * props.turn;
    ctx.fillStyle = state.backStyle;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.save();
    ctx.translate(state.pole.x, state.pole.y);
    ctx.rotate(turn);
    ctx.drawImage(state.river, -state.side / 2, -state.side / 2, state.side, state.side);
    ctx.restore();
    drawStars(ctx, g, t, turn, props.stars);
    drawMeteor(ctx, g, dt, props);
    ctx.drawImage(state.ridge, 0, 0);
  }

  Kasuri.run({
    defaults: { stars: 1, turn: 1, meteors: true, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.25, tint: 0.4 },
    maxFps: 20,
    setup,
    draw,
  });
})();
