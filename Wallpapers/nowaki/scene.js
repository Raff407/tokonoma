/*
 * 野分 Nowaki — the autumn typhoon wind over a field of pampas grass and bamboo.
 *
 * Sky, ridge, thatched farmhouse and far pines are baked once. Cloud banks are one wide
 * strip scrolled past. Grass plumes, the bamboo and the streaming leaves are a few small
 * pooled shapes bent by one travelling gust function.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const SKY_INKS = ['#59646c', '#6d777d', '#848c90', '#9ea29b'];
  const LEAF_TONES = ['#b4572f', '#c98a3a', '#8e3a26', '#a39a54'];
  const GRASS = 56;
  const STALKS = 6;
  const SEGS = 9;
  const LEAVES = 34;
  const MAX_LEAVES = 52;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
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
    return { W, H, U, hy: Math.round(H * 0.64) };
  }

  function gradientSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.hy);
    SKY_INKS.forEach((c, i) => grad.addColorStop(i / (SKY_INKS.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.hy + 2);
  }

  // wide strip of ragged cloud bands, tileable sideways
  function paintClouds(g, rand) {
    const tw = Math.ceil(g.W * 1.5);
    const c = layer(tw, g.hy);
    const ctx = c.getContext('2d');
    const tones = ['#454f57', '#5c676e', '#8e9699', '#b4b8b0'];
    for (let band = 0; band < 14; band++) {
      const y = g.H * (0.03 + band * 0.04) + rand() * g.U * 3;
      ctx.fillStyle = tones[Math.min(3, Math.floor(band / 3.5))];
      ctx.globalAlpha = 0.62;
      for (let x = 0; x < tw; ) {
        const rx = g.U * (10 + rand() * 22);
        const ry = g.U * (2 + rand() * 2.6);
        for (const dx of [0, -tw, tw]) blob(ctx, x + dx, y, rx, ry);
        x += rx * (0.7 + rand() * 0.8);
      }
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#c8c9bd';
    for (let i = 0; i < 9; i++) {
      const x = rand() * tw;
      const y = g.H * (0.2 + rand() * 0.3);
      const rx = g.U * (14 + rand() * 18);
      for (const dx of [0, -tw, tw]) blob(ctx, x + dx, y, rx, g.U * 0.9);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    // far ridge
    ctx.fillStyle = '#6b7878';
    ctx.beginPath();
    ctx.moveTo(0, g.hy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * 0.5 + fbm(x / (g.U * 38), 2.2, 4, 7) * g.H * 0.14);
    ctx.lineTo(g.W, g.hy);
    ctx.fill();
    // nearer ridge with pines
    ctx.fillStyle = '#55665f';
    ctx.beginPath();
    ctx.moveTo(0, g.hy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * 0.56 + fbm(x / (g.U * 24), 5.1, 3, 19) * g.H * 0.08);
    ctx.lineTo(g.W, g.hy);
    ctx.fill();
    ctx.fillStyle = '#3a4a44';
    for (let x = 0; x < g.W; x += g.U * (1.2 + rand() * 1.8)) {
      const top = g.H * 0.56 + fbm(x / (g.U * 24), 5.1, 3, 19) * g.H * 0.08;
      const h = g.U * (2 + rand() * 3);
      ctx.beginPath();
      ctx.moveTo(x - h * 0.3, top + 1);
      ctx.lineTo(x, top - h);
      ctx.lineTo(x + h * 0.3, top + 1);
      ctx.fill();
    }
    // field
    const field = ctx.createLinearGradient(0, g.hy - 4, 0, g.H);
    field.addColorStop(0, '#7f7f5e');
    field.addColorStop(0.5, '#6a6a4a');
    field.addColorStop(1, '#3f4632');
    ctx.fillStyle = field;
    ctx.fillRect(0, g.hy, g.W, g.H - g.hy);
    paintFarmhouse(ctx, g);
    return c;
  }

  // small thatched farmhouse low on the right with a heavy hipped roof
  function paintFarmhouse(ctx, g) {
    const U = g.U * 1.5;
    const x = g.W * 0.7;
    const y = g.hy + U * 0.5;
    ctx.fillStyle = '#d6cdb2';
    ctx.fillRect(x - U * 5, y - U * 3, U * 10, U * 3);
    ctx.fillStyle = '#3c2f26';
    ctx.fillRect(x - U * 5, y - U * 3, U * 10, U * 0.5);
    ctx.fillRect(x - U * 2.5, y - U * 2.4, U * 0.5, U * 2.4);
    ctx.fillRect(x + U * 2, y - U * 2.4, U * 0.5, U * 2.4);
    ctx.fillStyle = '#6a5a3e';
    ctx.beginPath();
    ctx.moveTo(x - U * 7.5, y - U * 2.6);
    ctx.lineTo(x - U * 3, y - U * 8);
    ctx.lineTo(x + U * 3, y - U * 8);
    ctx.lineTo(x + U * 7.5, y - U * 2.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4c4030';
    ctx.fillRect(x - U * 3.2, y - U * 8.4, U * 6.4, U * 0.6);
    ctx.fillStyle = '#8a7a56';
    ctx.fillRect(x - U * 6, y - U * 3.2, U * 12, U * 0.35);
    // dark pole windbreak pines either side
    ctx.fillStyle = '#34443c';
    for (const dx of [-9.5, 9.5, 11.5]) blob(ctx, x + dx * U, y - U * 3, U * 2.2, U * 3.2);
  }

  // low full-width field grass band drawn behind the moving stalks
  function paintTurf(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    for (let i = 0; i < g.W * 1.3; i++) {
      const x = rand() * g.W;
      const y = g.hy + rand() * (g.H - g.hy);
      const f = (y - g.hy) / (g.H - g.hy);
      ctx.strokeStyle = rand() < 0.5 ? '#8c8a5a' : '#5a6140';
      ctx.lineWidth = Math.max(1, g.U * (0.15 + f * 0.35));
      const l = g.U * (1.2 + f * 3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + l * 0.7, y - l);
      ctx.stroke();
    }
    return c;
  }

  function makeGrass(g, rand) {
    const a = [];
    for (let i = 0; i < GRASS; i++) {
      const f = Math.pow(rand(), 0.8);
      a.push({
        x: rand() * g.W,
        y: g.hy + g.U * 2 + f * (g.H - g.hy - g.U * 2),
        h: g.U * (9 + f * 22) * (0.8 + rand() * 0.4),
        p: rand() * TAU,
        f,
      });
    }
    a.sort((p, q) => p.y - q.y);
    return a;
  }

  function makeStalks(g, rand) {
    const a = [];
    const xs = [0.04, 0.1, 0.15, 0.19, 0.93, 0.97];
    for (let i = 0; i < STALKS; i++) {
      a.push({
        x: g.W * xs[i] + (rand() - 0.5) * g.U * 2,
        y: g.H + g.U * 2,
        h: g.H * (0.8 + rand() * 0.28),
        w: g.U * (1 + rand() * 0.6),
        p: rand() * TAU,
      });
    }
    return a;
  }

  function makeLeaves(g, rand) {
    const L = { x: [], y: [], vx: [], vy: [], a: [], s: [], p: [], tone: [] };
    for (let i = 0; i < MAX_LEAVES; i++) {
      L.x.push(rand() * g.W);
      L.y.push(g.H * (0.2 + rand() * 0.75));
      L.vx.push(0.7 + rand() * 0.8);
      L.vy.push((rand() - 0.5) * 0.2);
      L.a.push(rand() * TAU);
      L.s.push(g.U * (1.4 + rand() * 1.2));
      L.p.push(rand() * TAU);
      L.tone.push(Math.floor(rand() * LEAF_TONES.length));
    }
    return L;
  }

  // wind pushing right, in 0..1.4: slow swell plus a gust front travelling along x
  function wind(g, x, t) {
    const front = Math.sin((x / g.W) * 3.4 - t * 0.9);
    const swell = Math.sin(t * 0.37 + 1.2);
    return 0.62 + 0.28 * front + 0.16 * swell + 0.06 * Math.sin(t * 2.3 + x * 0.05);
  }

  function drawClouds(ctx, g, t) {
    const tile = state.clouds;
    const off = (t * g.W * 0.045) % tile.width;
    ctx.drawImage(tile, -off, 0);
    ctx.drawImage(tile, tile.width - off, 0);
    ctx.drawImage(tile, -off * 1.0 - tile.width, 0);
  }

  function drawGrass(ctx, g, t, gale) {
    const arr = state.grass;
    ctx.lineCap = 'round';
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const w = wind(g, s.x, t) * gale;
      const lean = (0.25 + w * 0.75) * s.h * 0.55 + Math.sin(t * 3.1 + s.p) * s.h * 0.04 * w;
      const tx = s.x + lean;
      const ty = s.y - s.h * (1 - 0.18 * w);
      const cx = s.x + lean * 0.12;
      const cy = s.y - s.h * 0.62;
      ctx.strokeStyle = s.f > 0.55 ? '#a39b66' : '#7e7c52';
      ctx.lineWidth = Math.max(1, g.U * (0.22 + s.f * 0.35));
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(cx, cy, tx, ty);
      ctx.stroke();
      // silvery plume swept downwind
      const px = tx + lean * 0.35 + s.h * 0.12;
      const py = ty + s.h * 0.1 * (0.4 + w);
      ctx.strokeStyle = s.f > 0.55 ? '#dcd5bb' : '#bdb89a';
      ctx.lineWidth = Math.max(1, g.U * (0.5 + s.f * 0.7));
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + (px - tx) * 0.5, ty - s.h * 0.05, px, py);
      ctx.stroke();
    }
  }

  function drawBamboo(ctx, g, t, gale) {
    const arr = state.stalks;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const w = wind(g, s.x, t + i * 0.08) * gale;
      let x = s.x;
      let y = s.y;
      let ang = -Math.PI / 2 + 0.05;
      const seg = s.h / SEGS;
      ctx.strokeStyle = i % 2 ? '#4f6a45' : '#5e7a4c';
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < SEGS; k++) {
        const bend = (0.02 + w * 0.055) * (0.4 + k / SEGS) + Math.sin(t * 2.2 + s.p + k * 0.5) * 0.012 * w;
        ang += bend;
        x += Math.cos(ang) * seg;
        y += Math.sin(ang) * seg;
        ctx.lineTo(x, y);
        s.nx = x;
      }
      ctx.stroke();
      // nodes
      ctx.fillStyle = '#b6b27a';
      x = s.x;
      y = s.y;
      ang = -Math.PI / 2 + 0.05;
      for (let k = 0; k < SEGS; k++) {
        const bend = (0.02 + w * 0.055) * (0.4 + k / SEGS) + Math.sin(t * 2.2 + s.p + k * 0.5) * 0.012 * w;
        ang += bend;
        x += Math.cos(ang) * seg;
        y += Math.sin(ang) * seg;
        if (k > 2) {
          ctx.fillRect(x - s.w * 0.7, y - 0.5, s.w * 1.4, Math.max(1, s.w * 0.35));
          // leaf pair streaming downwind
          if (k > 4) {
            ctx.strokeStyle = '#3d5a3a';
            ctx.lineWidth = Math.max(1, s.w * 0.5);
            const ll = g.U * 5 * (1 + 0.3 * w);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + ll * 0.5, y - ll * 0.25, x + ll, y + ll * (0.1 + 0.3 * w));
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + ll * 0.3, y + ll * 0.1, x + ll * 0.8, y + ll * (0.5 + 0.2 * w));
            ctx.stroke();
          }
        }
      }
    }
  }

  function drawLeaves(ctx, g, t, dt, count, gale) {
    const L = state.leaves;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      const w = wind(g, L.x[i], t) * gale;
      L.x[i] += L.vx[i] * (6 + 40 * w) * step * g.U * 0.2;
      L.y[i] += (L.vy[i] * 3 + Math.sin(t * 2.4 + L.p[i]) * 5) * step * g.U * 0.2 + w * 0.05;
      L.a[i] += (1.5 + w * 3) * step;
      if (L.x[i] > g.W + g.U * 3) {
        L.x[i] = -g.U * 3;
        L.y[i] = g.H * (0.2 + state.rand() * 0.75);
      }
      if (L.y[i] > g.H + g.U) L.y[i] = g.H * 0.2;
      if (L.y[i] < 0) L.y[i] = g.H * 0.9;
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + L.p[i]));
      const sz = L.s[i];
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz * 0.7, -sz * 0.3, sz * 1.4, sz * 0.6);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.clouds = paintClouds(g, rand);
    state.turf = paintTurf(g, rand);
    state.grass = makeGrass(g, rand);
    state.stalks = makeStalks(g, rand);
    state.leaves = makeLeaves(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const gale = api.props.gale;
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * api.props.leaves));
    gradientSky(ctx, g);
    drawClouds(ctx, g, t);
    // ridge, farmhouse and field cover the lower sky, so draw the baked back only below clouds
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.turf, 0, 0);
    drawGrass(ctx, g, t, gale);
    drawBamboo(ctx, g, t, gale);
    drawLeaves(ctx, g, t, dt, count, gale);
  }

  Kasuri.run({
    defaults: { gale: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
