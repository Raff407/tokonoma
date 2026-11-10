/*
 * Snow in the bamboo: a night grove under snow, a small two-tier pavilion with red
 * pillars and one lit lattice window. Everything still is baked once; the leaf canopy
 * is one layer that sways a little, snow is a short reused pool of flakes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const FLAKES = 110;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const s = Math.min(H / 100, W / 130);
    return { W, H, s, gy: Math.round(H * 0.8), cx: W * 0.5 };
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // ---- sky, moon, ground ---------------------------------------------------

  function paintSky(ctx, g) {
    const gr = ctx.createLinearGradient(0, 0, 0, g.gy);
    gr.addColorStop(0, '#171d33');
    gr.addColorStop(0.6, '#2a3350');
    gr.addColorStop(1, '#46506a');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    const mx = g.W * 0.78;
    const my = g.H * 0.2;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.s * 22);
    halo.addColorStop(0, 'rgba(226,214,180,0.35)');
    halo.addColorStop(1, 'rgba(226,214,180,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e4dcc0';
    ctx.beginPath();
    ctx.arc(mx, my, g.s * 5, 0, TAU);
    ctx.fill();
  }

  function paintGround(ctx, g) {
    const gr = ctx.createLinearGradient(0, g.gy - g.s * 3, 0, g.H);
    gr.addColorStop(0, '#9aa4b4');
    gr.addColorStop(0.5, '#c4ccd6');
    gr.addColorStop(1, '#8e98ac');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(0, g.gy);
    for (let x = 0; x <= g.W + 4; x += 4) {
      ctx.lineTo(x, g.gy - g.s * 0.8 * (K.fbm(x / (g.s * 30), 2.2, 2, 5) - 0.4));
    }
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
  }

  // ---- bamboo --------------------------------------------------------------

  function stalk(ctx, g, rand, x, w, top, bottom, ink, node, snow) {
    const lean = (rand() - 0.5) * w * 3;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, bottom);
    ctx.lineTo(x + lean - w / 2, top);
    ctx.lineTo(x + lean + w / 2, top);
    ctx.lineTo(x + w / 2, bottom);
    ctx.fill();
    const step = g.s * (7 + rand() * 4) * (w / (g.s * 1.6));
    for (let y = bottom - step * 0.7; y > top; y -= step * (0.85 + rand() * 0.3)) {
      const f = (bottom - y) / (bottom - top);
      const px = x + lean * f;
      ctx.fillStyle = node;
      ctx.fillRect(px - w * 0.62, y, w * 1.24, Math.max(1, w * 0.28));
      if (snow) {
        ctx.fillStyle = snow;
        ctx.fillRect(px - w * 0.62, y - Math.max(1, w * 0.24), w * 1.24, Math.max(1, w * 0.26));
      }
    }
    return lean;
  }

  function leafSpray(ctx, g, rand, x, y, len, dark, snow) {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      const a = dir * (0.35 + rand() * 1.0);
      const l = len * (0.6 + rand() * 0.5);
      const ex = x + Math.sin(a) * l;
      const ey = y + Math.cos(a) * l * 0.55 + l * 0.15;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, g.s * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.sin(a) * l * 0.5, y - l * 0.1, ex, ey);
      ctx.stroke();
      if (snow && rand() < 0.65) {
        ctx.strokeStyle = snow;
        ctx.lineWidth = Math.max(1, g.s * 0.38);
        ctx.beginPath();
        ctx.moveTo(x + Math.sin(a) * l * 0.1, y - g.s * 0.3);
        ctx.quadraticCurveTo(x + Math.sin(a) * l * 0.5, y - l * 0.14, x + Math.sin(a) * l * 0.85, ey - g.s * 0.5);
        ctx.stroke();
      }
    }
  }

  function grove(ctx, g, rand, count, y0, wMin, wMax, ink, node, leafInk, snow, xs, leaves) {
    for (let i = 0; i < count; i++) {
      const x = xs ? xs[i] : g.W * (i + rand() * 0.8) / count;
      const w = wMin + rand() * (wMax - wMin);
      const top = y0 + rand() * g.H * 0.12;
      const lean = stalk(ctx, g, rand, x, w, top, g.gy + g.s * 3, ink, node, snow);
      if (!leaves) continue;
      const n = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const f = 0.02 + k * 0.07 + rand() * 0.05;
        const yy = top + (g.gy - top) * f * 2.2;
        const xx = x + lean * (1 - f * 2.2);
        leafSpray(leaves, g, rand, xx, yy, g.s * (7 + rand() * 6), leafInk, snow);
      }
    }
  }

  function paintFar(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    ctx.globalAlpha = 0.55;
    grove(ctx, g, rand, 16, g.H * 0.08, g.s * 0.9, g.s * 1.4, '#566a78', '#3f5260', '#4f6672', '#9aa8b8', null, ctx);
    ctx.globalAlpha = 1;
    const mist = ctx.createLinearGradient(0, g.gy - g.s * 22, 0, g.gy);
    mist.addColorStop(0, 'rgba(120,134,158,0)');
    mist.addColorStop(1, 'rgba(120,134,158,0.5)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, g.gy - g.s * 22, g.W, g.s * 22);
    paintGround(ctx, g);
    return c;
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const xs = [];
    for (let i = 0; i < 13; i++) {
      const x = g.W * (i + 0.2 + rand() * 0.6) / 13;
      if (Math.abs(x - g.cx) > g.s * 30) xs.push(x);
    }
    grove(ctx, g, rand, xs.length, g.H * 0.04, g.s * 1.5, g.s * 2.1, '#3f5c52', '#2a4038', '#34524a', '#dfe5ee', xs, ctx);
    return c;
  }

  function paintNear(g, rand) {
    const body = layer(g.W, g.H);
    const canopy = layer(g.W, g.H);
    const ctx = body.getContext('2d');
    const cc = canopy.getContext('2d');
    const xs = [g.W * 0.06, g.W * 0.13, g.W * 0.9, g.W * 0.96, g.W * 0.3, g.W * 0.72];
    const sides = [0, 1, 2, 3];
    grove(ctx, g, rand, 4, -g.H * 0.05, g.s * 2.8, g.s * 3.6, '#2c4a40', '#1c322b', '#27443a', '#e8edf4', sides.map((i) => xs[i]), cc);
    grove(cc, g, rand, 2, -g.H * 0.05, 1, 1, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', '#27443a', '#e8edf4', [xs[4], xs[5]], null);
    return { body, canopy };
  }

  // ---- pavilion ------------------------------------------------------------

  function roof(ctx, cx, y, half, rise, s, tile, edge, snow) {
    const lift = 4.5 * s;
    const sag = 1.8 * s;
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(cx - half, y - lift);
    ctx.quadraticCurveTo(cx - half * 0.55, y + sag, cx, y + sag);
    ctx.quadraticCurveTo(cx + half * 0.55, y + sag, cx + half, y - lift);
    ctx.quadraticCurveTo(cx + half * 0.55, y - rise * 0.55, cx + half * 0.16, y - rise);
    ctx.lineTo(cx - half * 0.16, y - rise);
    ctx.quadraticCurveTo(cx - half * 0.55, y - rise * 0.55, cx - half, y - lift);
    ctx.fill();
    ctx.fillStyle = edge;
    ctx.fillRect(cx - half * 0.55, y + sag - s * 0.8, half * 1.1, Math.max(1, s * 0.8));
    ctx.fillStyle = snow;
    ctx.beginPath();
    ctx.moveTo(cx - half * 0.86, y - lift - s * 0.2);
    ctx.quadraticCurveTo(cx - half * 0.5, y - rise * 0.2, cx - half * 0.15, y - rise - s * 0.6);
    ctx.lineTo(cx + half * 0.15, y - rise - s * 0.6);
    ctx.quadraticCurveTo(cx + half * 0.5, y - rise * 0.2, cx + half * 0.86, y - lift - s * 0.2);
    ctx.quadraticCurveTo(cx + half * 0.5, y - rise * 0.5, cx, y - rise * 0.55);
    ctx.quadraticCurveTo(cx - half * 0.5, y - rise * 0.5, cx - half * 0.86, y - lift - s * 0.2);
    ctx.fill();
  }

  function paintPavilion(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = g.s;
    const cx = g.cx;
    const gy = g.gy;
    const bw = 15 * s;
    // stone platform with snow on top
    ctx.fillStyle = '#5c606a';
    ctx.fillRect(cx - 22 * s, gy - 3 * s, 44 * s, 3.4 * s);
    ctx.fillStyle = '#e4e9f0';
    ctx.fillRect(cx - 23 * s, gy - 4 * s, 46 * s, 1.4 * s);
    // lower hall
    const wallTop = gy - 4 * s - 17 * s;
    ctx.fillStyle = '#242a3f';
    ctx.fillRect(cx - bw, wallTop, bw * 2, 17 * s);
    // lit lattice window
    const wx = cx - 6 * s;
    const wy = wallTop + 4 * s;
    ctx.fillStyle = '#e2b457';
    ctx.fillRect(wx, wy, 12 * s, 9 * s);
    ctx.fillStyle = '#f0d58a';
    ctx.fillRect(wx + 2 * s, wy + 2 * s, 8 * s, 5 * s);
    ctx.fillStyle = '#6a3a24';
    const bar = Math.max(1, s * 0.55);
    for (let i = 0; i <= 4; i++) ctx.fillRect(wx + i * 3 * s - (i === 4 ? bar : 0), wy, bar, 9 * s);
    for (let j = 0; j <= 3; j++) ctx.fillRect(wx, wy + j * 3 * s - (j === 3 ? bar : 0), 12 * s, bar);
    ctx.fillRect(wx - bar, wy - bar, 12 * s + bar * 2, bar);
    ctx.fillRect(wx - bar, wy + 9 * s, 12 * s + bar * 2, bar);
    // red pillars
    ctx.fillStyle = '#9a3626';
    for (const dx of [-bw, bw - 2.2 * s, -bw + 5 * s, bw - 7.2 * s]) ctx.fillRect(cx + dx, wallTop, 2.2 * s, 17 * s);
    ctx.fillRect(cx - bw, wallTop, bw * 2, 1.4 * s);
    // upper storey
    const upTop = wallTop - 9 * s;
    ctx.fillStyle = '#242a3f';
    ctx.fillRect(cx - 8 * s, upTop, 16 * s, 9 * s);
    ctx.fillStyle = '#9a3626';
    ctx.fillRect(cx - 8 * s, upTop, 2 * s, 9 * s);
    ctx.fillRect(cx + 6 * s, upTop, 2 * s, 9 * s);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(cx - 2.5 * s, upTop + 2.5 * s, 5 * s, 3.5 * s);
    // roofs
    roof(ctx, cx, wallTop + 1 * s, 29 * s, 11 * s, s, '#2d323c', '#9a3626', '#eef1f6');
    roof(ctx, cx, upTop + 0.5 * s, 18 * s, 9 * s, s, '#2d323c', '#9a3626', '#eef1f6');
    // finial
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(cx - s * 0.5, upTop - 12.5 * s, Math.max(1, s), 3 * s);
    ctx.beginPath();
    ctx.arc(cx, upTop - 13 * s, s * 1.1, 0, TAU);
    ctx.fill();
    // warm light on the snow in front
    const gl = ctx.createRadialGradient(cx, gy + s * 1.5, 0, cx, gy + s * 1.5, s * 26);
    gl.addColorStop(0, 'rgba(240,200,110,0.40)');
    gl.addColorStop(1, 'rgba(240,200,110,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(cx - s * 28, gy - s * 6, s * 56, s * 34);
    ctx.fillStyle = '#4a4e5a';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - 5 * s + i * 0.4 * s, gy + i * 1.6 * s, 10 * s - i * 0.8 * s, 1.1 * s);
    ctx.fillStyle = '#d9dfe8';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - 5 * s + i * 0.4 * s, gy + i * 1.6 * s - 0.5 * s, 10 * s - i * 0.8 * s, 0.7 * s);
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.s * 20, g.s * 16);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, c.width / 2);
    gr.addColorStop(0, 'rgba(255,220,140,0.35)');
    gr.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---- snow ----------------------------------------------------------------

  function makeFlakes(g, rand) {
    const f = { x: new Float32Array(FLAKES), y: new Float32Array(FLAKES), v: new Float32Array(FLAKES), p: new Float32Array(FLAKES), z: new Uint8Array(FLAKES) };
    for (let i = 0; i < FLAKES; i++) resetFlake(g, f, rand, i, true);
    return f;
  }

  function resetFlake(g, f, rand, i, anywhere) {
    f.x[i] = rand() * (g.W + g.H * 0.3);
    f.y[i] = anywhere ? rand() * g.H : -rand() * g.s * 4;
    f.z[i] = rand() < 0.3 ? 1 : 0;
    f.v[i] = g.s * (f.z[i] ? 5.5 : 3.2) * (0.8 + rand() * 0.4);
    f.p[i] = rand() * TAU;
  }

  function stepAndDraw(ctx, g, t, dt, count, wind) {
    const f = state.flakes;
    for (let i = 0; i < count; i++) {
      f.y[i] += f.v[i] * dt;
      f.x[i] -= g.s * (1.2 + wind * 2.2) * dt * (f.z[i] ? 1.3 : 0.8);
      if (f.y[i] > g.gy + g.s * 8 || f.x[i] < -4) {
        resetFlake(g, f, state.rand, i, false);
        f.x[i] = state.rand() * (g.W + g.H * 0.3);
      }
      const sway = Math.sin(t * 0.9 + f.p[i]) * g.s * 0.8;
      ctx.fillStyle = f.z[i] ? '#f2f5fa' : '#c5ced9';
      const sz = f.z[i] ? 2 : 1;
      ctx.fillRect(f.x[i] + sway, f.y[i], sz, sz);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.far = paintFar(g, rand);
    state.mid = paintMid(g, rand);
    state.pavilion = paintPavilion(g);
    state.near = paintNear(g, rand);
    state.glow = paintGlow(g);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, wind } = api.props;
    const count = Math.min(FLAKES, Math.round(FLAKES * 0.6 * snow));
    const step = Math.min(dt, 0.1);
    const sway = Math.sin(t * 0.5) * g.s * 0.5 * wind;
    ctx.drawImage(state.far, 0, 0);
    ctx.drawImage(state.mid, sway * 0.4, 0);
    ctx.drawImage(state.pavilion, 0, 0);
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.7);
    ctx.drawImage(state.glow, g.cx - state.glow.width / 2, g.gy - g.s * 21);
    ctx.globalAlpha = 1;
    stepAndDraw(ctx, g, t, step, count, wind);
    ctx.drawImage(state.near.body, 0, 0);
    ctx.drawImage(state.near.canopy, sway, Math.sin(t * 0.8) * g.s * 0.25 * wind);
  }

  Kasuri.run({
    defaults: { snow: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
