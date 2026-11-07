/*
 * 花火 Hanabi — far-off summer fireworks over a river, unhurried.
 *
 * Sparks are drawn into a transparent trail layer that loses a little alpha
 * each draw, so bursts hang and fade without keeping a past for any spark. The river
 * below shows the same layer flipped and broken into wavering strips. They are
 * distant and slow on purpose: nothing lights up the room.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp } = K;

  const SHELLS = [
    ['#e6c37a', '#c9913f'],
    ['#d9583f', '#e6c37a'],
    ['#e8e3d2', '#9cb0c4'],
    ['#b86a7d', '#e8d2c4'],
    ['#7f9c78', '#e6c37a'],
  ];
  const MAX_SPARKS = 2400;
  const WATERLINE = 0.68;
  const STRIPS = 10;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintBack(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const line = g.H * WATERLINE;
    const sky = ctx.createLinearGradient(0, 0, 0, line);
    sky.addColorStop(0, '#0a0e22');
    sky.addColorStop(1, '#2d3456');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, line);
    ctx.fillStyle = '#171b34';
    ctx.beginPath();
    ctx.moveTo(0, line);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, line - fbm(x * 0.012, 2, 4, 9) * g.H * 0.11);
    ctx.lineTo(g.W, line);
    ctx.fill();
    const water = ctx.createLinearGradient(0, line, 0, g.H);
    water.addColorStop(0, '#242a48');
    water.addColorStop(1, '#0d1122');
    ctx.fillStyle = water;
    ctx.fillRect(0, line, g.W, g.H - line);
    return c;
  }

  function paintBridge(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y = g.H * (WATERLINE - 0.03);
    const u = g.U;
    ctx.strokeStyle = '#06070e';
    ctx.lineWidth = Math.max(1, u * 1.1);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.04, y + u * 4);
    ctx.quadraticCurveTo(g.W * 0.26, y - u * 7, g.W * 0.48, y + u * 4);
    ctx.stroke();
    ctx.fillStyle = '#06070e';
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      const x = lerp(g.W * 0.06, g.W * 0.46, f);
      const top = y + u * 4 - Math.sin(f * Math.PI) * u * 5.6;
      ctx.fillRect(x, top, Math.max(1, u * 0.6), y + u * 7 - top);
    }
    // People watching from the bridge, lanterns among them.
    ctx.fillStyle = '#d9a35f';
    for (let i = 0; i < 6; i++) {
      const f = 0.1 + rand() * 0.8;
      const x = lerp(g.W * 0.06, g.W * 0.46, f);
      ctx.fillRect(x, y + u * 2.6 - Math.sin(f * Math.PI) * u * 5.6, Math.max(1, u * 0.9), Math.max(1, u * 0.9));
    }
    ctx.fillStyle = '#04050b';
    ctx.fillRect(0, g.H * 0.97, g.W, g.H * 0.03);
    return c;
  }

  function launch(g, slot) {
    const r = state.rand;
    const p = state.shells[slot];
    p.x = g.W * (0.3 + r() * 0.62);
    p.y = g.H * WATERLINE;
    p.top = g.H * (0.2 + r() * 0.22);
    p.v = g.U * (34 + r() * 8);
    p.live = true;
    p.kind = Math.floor(r() * SHELLS.length);
    p.size = g.U * (26 + r() * 22) * state.scale;
    p.sparks = Math.round(130 + r() * 130);
    p.ring = r() < 0.3;
  }

  function burst(g, p) {
    const r = state.rand;
    for (let i = 0; i < p.sparks; i++) {
      const n = state.sparkAt;
      state.sparkAt = (n + 1) % MAX_SPARKS;
      const a = (i / p.sparks) * 6.283 + r() * 0.05;
      const speed = p.ring ? p.size * 0.82 : p.size * (0.35 + r() * 0.65);
      state.sx[n] = p.x;
      state.sy[n] = p.y;
      state.svx[n] = Math.cos(a) * speed;
      state.svy[n] = Math.sin(a) * speed;
      state.sl[n] = 1.2 + r() * 0.6;
      state.sc[n] = r() < 0.7 ? 0 : 1;
      state.sk[n] = p.kind;
    }
  }

  function stepShells(g, dt, trail) {
    for (const p of state.shells) {
      if (!p.live) continue;
      p.y -= p.v * dt;
      trail.fillStyle = '#c9a879';
      trail.fillRect(p.x, p.y, 1, 1);
      if (p.y <= p.top) {
        burst(g, p);
        p.live = false;
      }
    }
  }

  function stepSparks(g, dt, trail) {
    const fall = g.U * 3.2 * dt;
    const drag = Math.exp(-dt * 1.5);
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (state.sl[i] <= 0) continue;
      state.sl[i] -= dt * 0.42;
      state.svx[i] *= drag;
      state.svy[i] = state.svy[i] * drag + fall;
      state.sx[i] += state.svx[i] * dt;
      state.sy[i] += state.svy[i] * dt;
      if (state.sy[i] > g.H * WATERLINE) continue;
      trail.fillStyle = SHELLS[state.sk[i]][state.sc[i]];
      trail.globalAlpha = Math.min(1, state.sl[i]);
      trail.fillRect(state.sx[i], state.sy[i], 1, 1);
    }
    trail.globalAlpha = 1;
  }

  function fadeTrail(trail, g, dt) {
    trail.globalCompositeOperation = 'destination-out';
    trail.fillStyle = `rgba(0,0,0,${Math.min(0.5, dt * 1.3).toFixed(3)})`;
    trail.fillRect(0, 0, g.W, g.H);
    trail.globalCompositeOperation = 'source-over';
  }

  function drawReflection(ctx, g, t) {
    const line = g.H * WATERLINE;
    const srcH = line * 0.8;
    const dstH = g.H - line;
    const stripH = dstH / STRIPS;
    ctx.globalAlpha = 0.34;
    ctx.save();
    ctx.translate(0, line + dstH);
    ctx.scale(1, -1);
    for (let i = 0; i < STRIPS; i++) {
      const wob = Math.sin(t * 1.1 + i * 1.7) * g.U * (0.4 + (STRIPS - i) * 0.08);
      const srcY = line - srcH + (i / STRIPS) * srcH;
      ctx.drawImage(state.trail, 0, srcY, g.W, srcH / STRIPS, wob, i * stripH, g.W, stripH + 0.5);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.scale = 1;
    state.back = paintBack(g);
    state.bridge = paintBridge(g, rand);
    state.trail = layer(g.W, g.H);
    state.sx = new Float32Array(MAX_SPARKS);
    state.sy = new Float32Array(MAX_SPARKS);
    state.svx = new Float32Array(MAX_SPARKS);
    state.svy = new Float32Array(MAX_SPARKS);
    state.sl = new Float32Array(MAX_SPARKS);
    state.sc = new Uint8Array(MAX_SPARKS);
    state.sk = new Uint8Array(MAX_SPARKS);
    state.sparkAt = 0;
    state.shells = Array.from({ length: 4 }, () => ({ live: false, x: 0, y: 0, top: 0, v: 0, kind: 0, size: 0, sparks: 0, ring: false }));
    state.wait = 0;
    state.slot = 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.scale = props.size;
    state.wait -= dt;
    if (state.wait <= 0) {
      launch(g, state.slot);
      state.slot = (state.slot + 1) % state.shells.length;
      state.wait = (1.6 + state.rand() * 2) / Math.max(props.pace, 0.1);
    }
    const trail = state.trail.getContext('2d');
    fadeTrail(trail, g, dt);
    stepShells(g, dt, trail);
    stepSparks(g, dt, trail);
    ctx.drawImage(state.back, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(state.trail, 0, 0, g.W, g.H * WATERLINE, 0, 0, g.W, g.H * WATERLINE);
    drawReflection(ctx, g, t);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(state.bridge, 0, 0);
  }

  Kasuri.run({
    defaults: { pace: 1, size: 1, ramp: 'lines', cell: 7, boost: 0.3, gain: 1.2, tint: 0.4 },
    maxFps: 24,
    setup,
    draw,
  });
})();
