/*
 * 雪まつり Yukimatsuri — a snow festival at night.
 *
 * A snow castle with tiled eaves, a great ice torii and stone lanterns are baked
 * once, with their inner light kept in a separate layer that breathes very slowly.
 * Only the flakes and that soft glow move after that.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp } = K;
  const TAU = Math.PI * 2;
  const GROUND = 0.8;
  const MAX_FLAKES = 300;
  const FLAKES = 150;
  const SKY = ['#141b34', '#1c2646', '#2a3558', '#3d4768'];
  const SNOW = { lit: '#eef0e6', mid: '#cfd8df', shade: '#9fb0c4', deep: '#6d7fa0' };
  const LAMP = '#f3c880';
  const INK = '#2a3354';
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

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    return { W, H, U, u, gy: Math.round(H * GROUND) };
  }

  // ---- sky and far land -------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.gy);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#d9d2b4';
    for (let i = 0; i < 40; i++) {
      const s = rand() < 0.2 ? 1.4 : 0.8;
      ctx.globalAlpha = 0.35 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8dcae';
    blob(ctx, g.W * 0.12, g.H * 0.14, g.U * 3, g.U * 3);
    ctx.fillStyle = SKY[1];
    blob(ctx, g.W * 0.12 + g.U * 1.1, g.H * 0.14 - g.U * 0.5, g.U * 2.6, g.U * 2.6);
    ctx.fillStyle = '#e8dcae';
    ctx.globalAlpha = 0.14;
    blob(ctx, g.W * 0.12, g.H * 0.14, g.U * 7, g.U * 7);
    ctx.globalAlpha = 1;
  }

  function paintMountains(ctx, g) {
    const tones = [['#3a4668', '#8fa0bd'], ['#2b3555', '#b7c3d6']];
    tones.forEach((tone, k) => {
      const base = g.H * (0.5 + k * 0.1);
      const pts = [0, g.gy];
      for (let x = 0; x <= g.W; x += 4) {
        const peak = Math.exp(-(((x - g.W * (k ? 0.82 : 0.2)) / (g.W * 0.18)) ** 2)) * g.H * 0.18;
        pts.push(x, base - peak - fbm(x / (g.U * 30), k * 3.3, 3, 7 + k) * g.H * 0.1);
      }
      pts.push(g.W, g.gy);
      ctx.fillStyle = tone[0];
      poly(ctx, pts);
      ctx.strokeStyle = tone[1];
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, g.U * 0.45);
      ctx.beginPath();
      for (let i = 2; i < pts.length - 2; i += 2) i === 2 ? ctx.moveTo(pts[i], pts[i + 1]) : ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  // ---- pines with snow ------------------------------------------------------

  function pine(ctx, x, y, h) {
    const w = h * 0.34;
    ctx.fillStyle = '#3a2f2c';
    ctx.fillRect(x - h * 0.02, y - h * 0.15, h * 0.04, h * 0.15);
    for (let i = 0; i < 4; i++) {
      const ty = y - h * (0.12 + i * 0.22);
      const tw = w * (1 - i * 0.2);
      ctx.fillStyle = '#233a34';
      poly(ctx, [x - tw, ty, x + tw, ty, x, ty - h * 0.3]);
      ctx.fillStyle = SNOW.shade;
      poly(ctx, [x - tw * 0.62, ty - h * 0.1, x + tw * 0.62, ty - h * 0.1, x, ty - h * 0.3]);
      ctx.fillStyle = SNOW.mid;
      poly(ctx, [x - tw * 0.34, ty - h * 0.19, x + tw * 0.34, ty - h * 0.19, x, ty - h * 0.3]);
    }
  }

  function paintPines(ctx, g, rand) {
    const spots = [[0.03, 20], [0.1, 15], [0.2, 11], [0.64, 11], [0.9, 18], [0.97, 22], [0.55, 9]];
    spots.forEach(([fx, h]) => pine(ctx, g.W * fx, g.gy + g.U * (h > 14 ? 3 : 0.5), g.U * h * 1.5 + rand()));
  }

  // ---- snow castle -------------------------------------------------------------

  function wallBlock(ctx, g, cx, top, w, h) {
    const grad = ctx.createLinearGradient(0, top, 0, top + h);
    grad.addColorStop(0, '#d8d9cc');
    grad.addColorStop(1, '#e9ddb8');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w / 2, top, w, h);
    ctx.fillStyle = SNOW.shade;
    ctx.fillRect(cx + w / 2 - w * 0.07, top, w * 0.07, h);
    ctx.fillStyle = INK;
    ctx.fillRect(cx - w / 2, top + h - g.U * 0.5, w, g.U * 0.5);
  }

  function eave(ctx, g, cx, y, half, rise, thick) {
    const lift = g.U * 1.3;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - half - lift, y - lift);
    ctx.quadraticCurveTo(cx - half * 0.8, y + thick * 0.4, cx - half * 0.35, y + thick);
    ctx.lineTo(cx + half * 0.35, y + thick);
    ctx.quadraticCurveTo(cx + half * 0.8, y + thick * 0.4, cx + half + lift, y - lift);
    ctx.lineTo(cx + half * 0.5, y - rise);
    ctx.lineTo(cx - half * 0.5, y - rise);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SNOW.mid;
    ctx.beginPath();
    ctx.moveTo(cx - half - lift * 0.5, y - lift * 1.1);
    ctx.quadraticCurveTo(cx - half * 0.75, y - thick * 0.1, cx - half * 0.3, y + thick * 0.15);
    ctx.lineTo(cx + half * 0.3, y + thick * 0.15);
    ctx.quadraticCurveTo(cx + half * 0.75, y - thick * 0.1, cx + half + lift * 0.5, y - lift * 1.1);
    ctx.lineTo(cx + half * 0.45, y - rise * 1.02);
    ctx.lineTo(cx - half * 0.45, y - rise * 1.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SNOW.lit;
    ctx.fillRect(cx - half * 0.45, y - rise * 1.05, half * 0.9, rise * 0.25);
  }

  function gable(ctx, g, cx, y, half, rise) {
    ctx.fillStyle = INK;
    poly(ctx, [cx - half * 1.05, y, cx, y - rise, cx + half * 1.05, y]);
    ctx.fillStyle = SNOW.lit;
    poly(ctx, [cx - half * 0.9, y - g.U * 0.3, cx, y - rise * 0.94, cx + half * 0.9, y - g.U * 0.3]);
    ctx.fillStyle = '#c9a247';
    ctx.fillRect(cx - g.U * 0.35, y - rise - g.U * 1.4, g.U * 0.7, g.U * 1.5);
  }

  function castle(ctx, glow, g, cx) {
    const base = g.gy + g.U * 1.5;
    const u = g.u;
    const bw = u * 46;
    const bh = u * 10;
    const stone = ctx.createLinearGradient(0, base - bh, 0, base);
    stone.addColorStop(0, '#aebbcb');
    stone.addColorStop(1, '#7f90ab');
    ctx.fillStyle = stone;
    poly(ctx, [cx - bw * 0.46, base - bh, cx + bw * 0.46, base - bh, cx + bw * 0.5, base, cx - bw * 0.5, base]);
    ctx.strokeStyle = SNOW.deep;
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let i = 1; i < 4; i++) {
      const yy = base - bh + (bh * i) / 4;
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.5, yy);
      ctx.lineTo(cx + bw * 0.5, yy);
      ctx.stroke();
    }
    ctx.fillStyle = SNOW.lit;
    ctx.fillRect(cx - bw * 0.47, base - bh - g.U * 0.5, bw * 0.94, g.U * 0.9);
    const tiers = [[34, 8.5], [26, 8], [19, 7.5], [12, 7]];
    let y = base - bh;
    tiers.forEach(([tw, th], i) => {
      const w = tw * u;
      const h = th * u;
      wallBlock(ctx, g, cx, y - h, w, h);
      const n = i < 2 ? 4 : 3;
      const ww = w / (n * 2 + 1);
      for (let k = 0; k < n; k++) {
        const wx = cx - w / 2 + ww * (1 + k * 2);
        const wy = y - h * 0.8;
        for (const c of [ctx, glow]) {
          c.fillStyle = LAMP;
          c.fillRect(wx, wy, ww, h * 0.55);
        }
        ctx.fillStyle = INK;
        ctx.fillRect(wx + ww * 0.47, wy, ww * 0.06, h * 0.55);
        ctx.fillRect(wx, wy + h * 0.27, ww, h * 0.05);
      }
      const half = w / 2 + u * 3;
      eave(ctx, g, cx, y - h, half, u * 2.4, u * 2.2);
      y -= h + u * 1.6;
    });
    gable(ctx, g, cx, y + u * 1.2, u * 7, u * 6);
    const lit = ctx.createRadialGradient(cx, base - bh - u * 20, u * 4, cx, base - bh - u * 20, u * 40);
    lit.addColorStop(0, 'rgba(243,200,128,0.30)');
    lit.addColorStop(1, 'rgba(243,200,128,0)');
    glow.fillStyle = lit;
    glow.fillRect(cx - u * 45, base - u * 80, u * 90, u * 85);
  }

  // ---- ice torii ----------------------------------------------------------------

  function torii(ctx, glow, g, cx) {
    const u = g.u;
    const base = g.gy + g.U * 2.5;
    const hgt = u * 38;
    const half = u * 14;
    const pw = u * 2.6;
    const gradient = (x) => {
      const gr = ctx.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
      gr.addColorStop(0, '#d9e8ee');
      gr.addColorStop(0.5, '#f2cf9a');
      gr.addColorStop(1, '#a9bdd0');
      return gr;
    };
    for (const s of [-1, 1]) {
      const x = cx + s * half;
      ctx.fillStyle = gradient(x);
      poly(ctx, [x - pw / 2 - u * 0.4, base, x - pw / 2 + u * 0.1, base - hgt, x + pw / 2 - u * 0.1, base - hgt, x + pw / 2 + u * 0.4, base]);
      glow.fillStyle = '#e9a468';
      glow.fillRect(x - pw * 0.28, base - hgt * 0.95, pw * 0.56, hgt * 0.9);
      ctx.fillStyle = SNOW.mid;
      ctx.fillRect(x - pw * 0.9, base - u * 1.6, pw * 1.8, u * 1.6);
    }
    ctx.fillStyle = '#cdd9e4';
    ctx.fillRect(cx - half, base - hgt * 0.72, half * 2, u * 1.8);
    ctx.fillRect(cx - u * 1.2, base - hgt, u * 2.4, hgt * 0.28);
    glow.fillStyle = '#e9a468';
    glow.fillRect(cx - half, base - hgt * 0.72 + u * 0.4, half * 2, u * 0.9);
    const top = base - hgt;
    const span = half + u * 6;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - span - u * 2, top - u * 3.2);
    ctx.quadraticCurveTo(cx, top + u * 1.6, cx + span + u * 2, top - u * 3.2);
    ctx.lineTo(cx + span, top + u * 0.8);
    ctx.quadraticCurveTo(cx, top + u * 3.6, cx - span, top + u * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SNOW.lit;
    ctx.beginPath();
    ctx.moveTo(cx - span - u * 1.4, top - u * 3.6);
    ctx.quadraticCurveTo(cx, top + u * 0.8, cx + span + u * 1.4, top - u * 3.6);
    ctx.lineTo(cx + span, top - u * 1.4);
    ctx.quadraticCurveTo(cx, top + u * 2.2, cx - span, top - u * 1.4);
    ctx.closePath();
    ctx.fill();
    const lit = ctx.createRadialGradient(cx, top + hgt * 0.5, u * 3, cx, top + hgt * 0.5, u * 26);
    lit.addColorStop(0, 'rgba(233,164,104,0.28)');
    lit.addColorStop(1, 'rgba(233,164,104,0)');
    glow.fillStyle = lit;
    glow.fillRect(cx - u * 30, top - u * 8, u * 60, hgt + u * 12);
  }

  // ---- stone lantern carved in snow ---------------------------------------------------

  function lantern(ctx, glow, g, x, s) {
    const base = g.gy + g.U * 3.5;
    const u = g.u * s;
    ctx.fillStyle = SNOW.mid;
    ctx.fillRect(x - u * 1.1, base - u * 7, u * 2.2, u * 7);
    ctx.fillStyle = SNOW.lit;
    ctx.fillRect(x - u * 2.6, base - u * 1.4, u * 5.2, u * 1.4);
    ctx.fillRect(x - u * 2.2, base - u * 8.2, u * 4.4, u * 1.2);
    ctx.fillStyle = SNOW.mid;
    ctx.fillRect(x - u * 2, base - u * 12, u * 4, u * 3.8);
    for (const c of [ctx, glow]) {
      c.fillStyle = LAMP;
      c.fillRect(x - u * 1.1, base - u * 11.2, u * 2.2, u * 2.4);
    }
    ctx.fillStyle = INK;
    poly(ctx, [x - u * 4, base - u * 12, x + u * 4, base - u * 12, x + u * 1.4, base - u * 15, x - u * 1.4, base - u * 15]);
    ctx.fillStyle = SNOW.lit;
    poly(ctx, [x - u * 3.2, base - u * 12.2, x + u * 3.2, base - u * 12.2, x + u * 1.2, base - u * 14.8, x - u * 1.2, base - u * 14.8]);
    ctx.fillRect(x - u * 0.5, base - u * 16.2, u, u * 1.4);
    const lit = glow.createRadialGradient(x, base - u * 10, u, x, base - u * 10, u * 12);
    lit.addColorStop(0, 'rgba(243,200,128,0.4)');
    lit.addColorStop(1, 'rgba(243,200,128,0)');
    glow.fillStyle = lit;
    glow.fillRect(x - u * 12, base - u * 22, u * 24, u * 24);
  }

  // ---- ground ----------------------------------------------------------------------------

  function paintGround(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.gy, 0, g.H);
    grad.addColorStop(0, '#b9c6d6');
    grad.addColorStop(1, '#6d7fa0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.gy, g.W, g.H - g.gy);
    ctx.fillStyle = SNOW.lit;
    ctx.globalAlpha = 0.55;
    for (let x = 0; x < g.W; x += 3) {
      const h = fbm(x / (g.U * 12), 2.2, 3, 5) * g.U * 1.8;
      ctx.fillRect(x, g.gy - h * 0.3, 3, h * 0.6 + 1);
    }
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 40; i++) {
      blob(ctx, rand() * g.W, g.gy + rand() * (g.H - g.gy), g.U * (3 + rand() * 6), g.U * 0.35);
    }
    ctx.globalAlpha = 1;
  }

  function paintGroundGlow(ctx, g, cxs) {
    for (const [x, r, a] of cxs) {
      const lit = ctx.createRadialGradient(x, g.gy + g.U * 5, 0, x, g.gy + g.U * 5, r);
      lit.addColorStop(0, 'rgba(243,200,128,' + a + ')');
      lit.addColorStop(1, 'rgba(243,200,128,0)');
      ctx.save();
      ctx.translate(0, g.gy * 0.0);
      ctx.fillStyle = lit;
      ctx.fillRect(x - r, g.gy, r * 2, g.H - g.gy);
      ctx.restore();
    }
  }

  // ---- flakes ----------------------------------------------------------------------------

  function makeFlakes(g, rand) {
    const f = () => new Float32Array(MAX_FLAKES);
    const F = { x: f(), y: f(), vy: f(), p: f(), sz: f() };
    for (let i = 0; i < MAX_FLAKES; i++) {
      F.x[i] = rand() * g.W;
      F.y[i] = rand() * g.H;
      resetFlake(g, F, i, rand, false);
    }
    return F;
  }

  function resetFlake(g, F, i, rand, top) {
    const near = rand();
    F.sz[i] = Math.max(1, g.U * (0.3 + near * 0.5));
    F.vy[i] = g.U * (3 + near * 5);
    F.p[i] = rand() * TAU;
    if (top) {
      F.x[i] = rand() * g.W;
      F.y[i] = -F.sz[i] - rand() * g.U * 4;
    }
  }

  function drawFlakes(ctx, g, t, dt, count) {
    const F = state.flakes;
    const rand = state.rand;
    ctx.fillStyle = '#f4f2e8';
    for (let i = 0; i < count; i++) {
      F.y[i] += F.vy[i] * dt;
      F.x[i] += Math.sin(t * 0.7 + F.p[i]) * g.U * 1.6 * dt + g.U * 0.9 * dt;
      if (F.y[i] > g.H) resetFlake(g, F, i, rand, true);
      if (F.x[i] > g.W + 4) F.x[i] -= g.W + 8;
      ctx.globalAlpha = 0.55 + F.sz[i] / (g.U * 2);
      ctx.fillRect(F.x[i], F.y[i], F.sz[i], F.sz[i]);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const bc = back.getContext('2d');
    const glow = layer(g.W, g.H);
    const gc = glow.getContext('2d');
    paintSky(bc, g, rand);
    paintMountains(bc, g);
    paintGround(bc, g, rand);
    const cx = g.W * 0.4;
    const tx = g.W * 0.8;
    const lx = [g.W * 0.2, g.W * 0.62, g.W * 0.93];
    paintGroundGlow(gc, g, [[cx, g.u * 40, 0.3], [tx, g.u * 24, 0.25]]);
    paintPines(bc, g, rand);
    castle(bc, gc, g, cx);
    torii(bc, gc, g, tx);
    lantern(bc, gc, g, lx[0], 1);
    lantern(bc, gc, g, lx[1], 0.8);
    lantern(bc, gc, g, lx[2], 0.9);
    state.back = back;
    state.glow = glow;
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, glow } = api.props;
    ctx.drawImage(state.back, 0, 0);
    const breath = Math.min(1, glow * (0.82 + 0.1 * Math.sin(t * 0.6) + 0.06 * Math.sin(t * 1.7 + 1)));
    ctx.globalAlpha = Math.max(0, breath);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    drawFlakes(ctx, g, t, Math.min(dt, 0.1), Math.min(MAX_FLAKES, Math.round(FLAKES * snow)));
  }

  Kasuri.run({
    defaults: { snow: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
