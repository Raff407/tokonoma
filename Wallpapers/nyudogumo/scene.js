/*
 * 入道雲 Nyudogumo — a summer thunderhead over rice paddies and a shrine roof.
 *
 * Sky, hills, cedars, shrine and paddies are baked once. Each frame only
 * draws the cloud puffs (breathing slowly), a few cloud shadows and wind
 * glints over the fields, and one white heron.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp } = K;

  const GY = 0.655;
  const TOWERS = [
    { x: 0.64, base: 0.55, w: 0.2, h: 0.46, n: 78 },
    { x: 0.86, base: 0.555, w: 0.13, h: 0.3, n: 34 },
    { x: 0.4, base: 0.56, w: 0.12, h: 0.18, n: 20 },
    { x: 0.12, base: 0.56, w: 0.1, h: 0.1, n: 10 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sprites -----------------------------------------------------------

  function paintPuff(lit, shade) {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(26, 22, 0, 32, 32, 32);
    grad.addColorStop(0, lit);
    grad.addColorStop(0.55, lit);
    grad.addColorStop(0.86, shade);
    grad.addColorStop(1, 'rgba(160,172,196,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function paintSoft(w, h, rgb, alpha) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.translate(w / 2, h / 2);
    ctx.scale(w / 2, h / 2);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${rgb},${alpha})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(-1, -1, 2, 2);
    return c;
  }

  // ---- sky and mountains -------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    grad.addColorStop(0, '#3f6a9e');
    grad.addColorStop(0.55, '#8fb0c8');
    grad.addColorStop(1, '#d9dcc8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const glow = ctx.createRadialGradient(g.W * 0.2, g.H * 0.1, 0, g.W * 0.2, g.H * 0.1, g.W * 0.6);
    glow.addColorStop(0, 'rgba(240,224,170,0.22)');
    glow.addColorStop(1, 'rgba(240,224,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    paintRidge(ctx, g, 0.5, 0.07, '#8aa3b6', 3);
    paintRidge(ctx, g, 0.55, 0.05, '#6c8a90', 7);
    return c;
  }

  function paintRidge(ctx, g, base, amp, color, seed) {
    ctx.fillStyle = color;
    for (let x = 0; x < g.W; x++) {
      const top = g.H * base - fbm(x * 0.012, 1.5, 4, seed) * g.H * amp;
      ctx.fillRect(x, top, 1, g.H * GY - top);
    }
  }

  // ---- hill, cedars, shrine ----------------------------------------------

  function paintHill(ctx, g) {
    ctx.fillStyle = '#496a45';
    for (let x = 0; x < g.W; x++) {
      const top = g.H * 0.605 + (fbm(x * 0.02, 4, 3, 12) - 0.5) * g.U * 4;
      ctx.fillRect(x, top, 1, g.H * GY - top + 2);
    }
  }

  function paintCedar(ctx, x, base, h, w) {
    ctx.fillStyle = '#24402f';
    ctx.fillRect(x - w * 0.06, base - h * 0.1, w * 0.12, h * 0.1);
    for (let k = 0; k < 5; k++) {
      const f = k / 5;
      const yTop = base - h + f * h * 0.78;
      const hw = w * (0.22 + f * 0.78) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x + hw, yTop + h * 0.3);
      ctx.lineTo(x - hw, yTop + h * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }

  function paintCedars(ctx, g, rand) {
    const gy = g.H * GY;
    const spots = [0.02, 0.05, 0.085, 0.31, 0.345, 0.37, 0.52, 0.56, 0.93, 0.965];
    for (const f of spots) {
      const h = g.U * (15 + rand() * 9);
      paintCedar(ctx, g.W * f, gy - g.U * (0.5 + rand() * 1.5), h, h * 0.34);
    }
  }

  function paintShrine(ctx, g) {
    const u = g.U;
    const sx = g.W * 0.2;
    const gy = g.H * GY;
    // Stone steps and platform.
    ctx.fillStyle = '#9a978c';
    ctx.fillRect(sx - u * 9, gy - u * 1, u * 18, u * 1);
    ctx.fillRect(sx - u * 4, gy - u * 2, u * 8, u * 1);
    ctx.fillStyle = '#b4b0a2';
    ctx.fillRect(sx - u * 12, gy - u * 3.2, u * 24, u * 1.2);
    // Washi wall and vermilion pillars.
    ctx.fillStyle = '#e4dcc4';
    ctx.fillRect(sx - u * 11, gy - u * 8.4, u * 22, u * 5.2);
    ctx.fillStyle = '#3a2f2a';
    ctx.fillRect(sx - u * 3, gy - u * 8, u * 6, u * 4.8);
    ctx.fillStyle = '#b8452c';
    for (let i = -2; i <= 2; i++) ctx.fillRect(sx + i * u * 5 - u * 0.5, gy - u * 8.6, u * 1, u * 5.4);
    ctx.fillRect(sx - u * 11, gy - u * 8.8, u * 22, u * 0.8);
    // Hip-and-gable roof with deep curved eaves.
    ctx.fillStyle = '#39414f';
    ctx.beginPath();
    ctx.moveTo(sx - u * 15, gy - u * 8);
    ctx.quadraticCurveTo(sx - u * 8, gy - u * 10, sx - u * 6, gy - u * 17.5);
    ctx.lineTo(sx + u * 6, gy - u * 17.5);
    ctx.quadraticCurveTo(sx + u * 8, gy - u * 10, sx + u * 15, gy - u * 8);
    ctx.lineTo(sx + u * 12, gy - u * 8);
    ctx.lineTo(sx - u * 12, gy - u * 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#566070';
    for (let r = 0; r < 6; r++) {
      const ry = gy - u * (9 + r * 1.35);
      const half = u * (13.4 - r * 1.25);
      ctx.fillRect(sx - half, ry, half * 2, Math.max(1, u * 0.18));
    }
    // Ridge log ends and crossed finials.
    ctx.fillStyle = '#d8cfb4';
    for (let i = -2; i <= 2; i++) ctx.fillRect(sx + i * u * 2.1 - u * 0.6, gy - u * 19, u * 1.2, u * 1.6);
    ctx.strokeStyle = '#d8cfb4';
    ctx.lineWidth = Math.max(1, u * 0.45);
    for (const side of [-1, 1]) {
      const ex = sx + side * u * 6.2;
      ctx.beginPath();
      ctx.moveTo(ex - u * 1.6, gy - u * 17.5);
      ctx.lineTo(ex + u * 1.6, gy - u * 22);
      ctx.moveTo(ex + u * 1.6, gy - u * 17.5);
      ctx.lineTo(ex - u * 1.6, gy - u * 22);
      ctx.stroke();
    }
  }

  function paintLantern(ctx, g) {
    const u = g.U;
    const lx = g.W * 0.2 + u * 19;
    const gy = g.H * GY;
    ctx.fillStyle = '#8d8a80';
    ctx.fillRect(lx - u * 1.6, gy - u * 1, u * 3.2, u * 1);
    ctx.fillRect(lx - u * 0.6, gy - u * 5, u * 1.2, u * 4);
    ctx.fillRect(lx - u * 1.8, gy - u * 7, u * 3.6, u * 2);
    ctx.fillStyle = '#e4dcc4';
    ctx.fillRect(lx - u * 0.7, gy - u * 6.6, u * 1.4, u * 1.2);
    ctx.fillStyle = '#767368';
    ctx.beginPath();
    ctx.moveTo(lx - u * 2.8, gy - u * 7);
    ctx.lineTo(lx, gy - u * 9.4);
    ctx.lineTo(lx + u * 2.8, gy - u * 7);
    ctx.closePath();
    ctx.fill();
  }

  function paintTorii(ctx, g) {
    const u = g.U;
    const tx = g.W * 0.2 - u * 27;
    const gy = g.H * GY;
    ctx.fillStyle = '#b8452c';
    ctx.fillRect(tx - u * 4, gy - u * 12, u * 1.1, u * 12);
    ctx.fillRect(tx + u * 2.9, gy - u * 12, u * 1.1, u * 12);
    ctx.fillRect(tx - u * 4.6, gy - u * 9.4, u * 9.2, u * 0.9);
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(tx - u * 5.8, gy - u * 13.4, u * 11.6, u * 1.4);
  }

  // ---- paddies -----------------------------------------------------------

  const BANDS = 7;
  const GREENS = ['#7a9c4c', '#678c43', '#5c8240', '#4f7838', '#6d9243', '#4a7335', '#436c33'];

  function bandEdge(g, k) {
    const gy = g.H * GY;
    return gy + (g.H - gy) * Math.pow(k / BANDS, 1.55);
  }

  function paintPaddies(ctx, g) {
    const vx = g.W * 0.5;
    const gy = g.H * GY;
    for (let k = 0; k < BANDS; k++) {
      const y0 = bandEdge(g, k);
      const y1 = bandEdge(g, k + 1);
      ctx.fillStyle = GREENS[k];
      ctx.fillRect(0, y0, g.W, y1 - y0 + 1);
      ctx.strokeStyle = 'rgba(214,230,150,0.2)';
      ctx.lineWidth = 1;
      const spread = g.W * (0.012 + k * 0.012);
      const half = Math.ceil(g.W * 0.6 / spread);
      ctx.beginPath();
      for (let i = -half; i <= half; i++) {
        const xa = vx + i * spread * (0.3 + (y0 - gy) / (g.H - gy));
        const xb = vx + i * spread * (0.3 + (y1 - gy) / (g.H - gy));
        ctx.moveTo(xa, y0);
        ctx.lineTo(xb, y1);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(40,70,40,0.25)';
      const step = Math.max(2, (y1 - y0) / 5);
      ctx.beginPath();
      for (let yy = y0 + step; yy < y1; yy += step) {
        ctx.moveTo(0, yy);
        ctx.lineTo(g.W, yy);
      }
      ctx.stroke();
      // Raised earth path between fields.
      ctx.fillStyle = '#b4a678';
      for (let x = 0; x < g.W; x++) {
        const wob = (fbm(x * 0.03, k * 3, 2, 17) - 0.5) * g.U * 0.6;
        ctx.fillRect(x, y0 + wob, 1, Math.max(1, g.U * (0.3 + k * 0.12)));
      }
    }
  }

  // ---- clouds ------------------------------------------------------------

  function buildPuffs(g, tow, rand) {
    const out = [];
    for (const t of TOWERS) {
      for (let j = 0; j < t.n; j++) {
        const f = Math.pow(j / t.n, 0.9);
        const width = t.w * g.W * (1 - f * 0.5 + (f > 0.88 ? 0.35 : 0)) * (0.75 + rand() * 0.3);
        const r = g.W * t.w * (0.26 - 0.1 * f) * (0.7 + rand() * 0.6);
        out.push({
          x: g.W * t.x + (rand() - 0.5) * width,
          y: g.H * t.base - f * g.H * t.h * tow,
          r: Math.max(g.U * 2, r),
          ph: rand() * 6.28,
          sp: 0.6 + rand() * 0.8,
          kind: f < 0.1 ? 1 : 0,
        });
      }
    }
    out.sort((a, b) => b.y - a.y);
    return out;
  }

  function drawClouds(ctx, g, t) {
    const puffs = state.puffs;
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      const w = Math.sin(t * 0.5 * p.sp + p.ph);
      const s = p.r * (1 + 0.1 * w);
      const yy = p.y - (0.5 + 0.5 * w) * g.U * 1.4;
      ctx.drawImage(state.puffArt[p.kind], p.x - s, yy - s, s * 2, s * 2);
    }
  }

  // ---- fields in motion --------------------------------------------------

  function drawFieldLight(ctx, g, t) {
    const gy = g.H * GY;
    const span = g.H - gy;
    for (let i = 0; i < 3; i++) {
      const cx = (((t * (0.012 + i * 0.004) + i * 0.37) % 1.5) - 0.25) * g.W;
      const cy = gy + span * (0.18 + i * 0.3);
      const w = g.W * 0.5;
      ctx.drawImage(state.shadow, cx - w / 2, cy - w * 0.07, w, w * 0.14);
    }
    for (let i = 0; i < 5; i++) {
      const cx = (((t * (0.05 + i * 0.012) + i * 0.23) % 1.4) - 0.2) * g.W;
      const cy = gy + span * (0.1 + i * 0.19);
      const w = g.W * 0.22;
      ctx.drawImage(state.glint, cx - w / 2, cy - w * 0.03, w, w * 0.06);
    }
  }

  function drawHeron(ctx, g, t) {
    const u = g.U;
    const x = (((t * 0.014) % 1.3) - 0.15) * g.W;
    const y = g.H * 0.3 + Math.sin(t * 0.3) * u * 2;
    const flap = Math.sin(t * 3.2) * u * 2.4;
    ctx.strokeStyle = '#f2eedf';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - u * 3, y);
    ctx.lineTo(x + u * 1.6, y);
    ctx.moveTo(x + u * 1.6, y);
    ctx.lineTo(x + u * 3, y - u * 0.8);
    ctx.moveTo(x - u * 3, y);
    ctx.lineTo(x - u * 5.2, y + u * 0.4);
    ctx.moveTo(x - u * 0.4, y);
    ctx.lineTo(x - u * 1.8, y - flap - u * 2);
    ctx.moveTo(x - u * 0.4, y);
    ctx.lineTo(x + u * 1.2, y + flap * 0.6 - u * 2.4);
    ctx.stroke();
  }

  // ---- run ---------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(41);
    state.sky = paintSky(g);
    const front = layer(g.W, g.H);
    const fx = front.getContext('2d');
    paintHill(fx, g);
    paintCedars(fx, g, rand);
    paintTorii(fx, g);
    paintShrine(fx, g);
    paintLantern(fx, g);
    paintPaddies(fx, g);
    state.front = front;
    state.puffArt = [
      paintPuff('rgba(252,250,242,1)', 'rgba(186,198,216,0.75)'),
      paintPuff('rgba(176,186,204,1)', 'rgba(126,140,170,0.7)'),
    ];
    state.shadow = paintSoft(128, 32, '28,52,48', 0.3);
    state.glint = paintSoft(128, 16, '236,244,190', 0.3);
    state.tow = null;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    if (state.tow !== props.towering) {
      state.tow = props.towering;
      state.puffs = buildPuffs(g, props.towering, K.rng(77));
    }
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    if (props.heron) drawHeron(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawFieldLight(ctx, g, t);
  }

  Kasuri.run({
    defaults: { towering: 1, heron: true, ramp: 'lines', cell: 6, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
