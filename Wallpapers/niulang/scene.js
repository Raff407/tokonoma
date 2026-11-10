/*
 * Qixi, the milky way over a summer night with a bridge of magpies.
 *
 * Sky, river of stars, bridge, hills and pavilion roof are baked once. Each frame lays
 * the sky down, slides one soft haze strip along the river, twinkles a short list of
 * stars and breathes a glow along the bridge arc.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;
  const TAU = Math.PI * 2;
  const SKY = ['#0d1226', '#141b3a', '#1f2a52', '#2c3a64'];
  const TWINKLERS = 90;
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

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const hill = H * 0.8;
    return { W, H, U, hill, bx0: W * 0.14, bx1: W * 0.86, by: H * 0.64, bh: H * 0.36 };
  }

  // River of stars: an arch from the lower left over the top to the lower right.
  function riverY(g, x) {
    const s = x / g.W * 2 - 1;
    return g.H * 0.5 - (1 - s * s) * g.H * 0.4 + s * g.H * 0.08;
  }

  function bridgeY(g, x) {
    const s = (x - g.bx0) / (g.bx1 - g.bx0) * 2 - 1;
    return g.by - (1 - s * s) * g.bh;
  }

  function paintSky(ctx, g, rand) {
    const inks = SKY.map(K.parseColor);
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / g.hill) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintRiver(ctx, g, rand) {
    const wide = g.H * 0.075;
    for (let x = 0; x < g.W; x += 1) {
      const cy = riverY(g, x);
      const w = wide * (0.8 + fbm(x / (g.U * 22), 2.7, 3, 7) * 0.7);
      const n = Math.round(g.H * 0.22);
      for (let i = 0; i < n; i++) {
        const o = (rand() + rand() + rand() - 1.5) * w * 1.4;
        const fall = 1 - Math.min(1, Math.abs(o) / (w * 1.5));
        const dust = fbm(x / (g.U * 9), o / (g.U * 9) + 4, 3, 19);
        if (rand() > fall * (0.5 + dust)) continue;
        ctx.globalAlpha = 0.14 + fall * 0.4;
        ctx.fillStyle = dust > 0.55 ? '#e9e3cf' : '#a9b4d2';
        ctx.fillRect(x, cy + o, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#10152c';
    for (let i = 0; i < 14; i++) {
      const x = g.W * (0.18 + rand() * 0.64);
      blob(ctx, x, riverY(g, x) + (rand() - 0.5) * g.U * 2, g.U * (2 + rand() * 4), g.U * 0.5);
    }
  }

  function paintStars(ctx, g, rand) {
    const tw = [];
    for (let i = 0; i < 230; i++) {
      const x = rand() * g.W;
      const y = rand() * g.hill * 0.92;
      const near = Math.abs(y - riverY(g, x)) < g.H * 0.09;
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      ctx.fillStyle = rand() < 0.2 ? '#e3c778' : '#dfe3ef';
      ctx.fillRect(x, y, 1, 1);
      if (!near && rand() < 0.45 && tw.length < TWINKLERS) tw.push({ x, y, p: rand() * TAU, s: 0.4 + rand() * 0.6 });
    }
    ctx.globalAlpha = 1;
    return tw;
  }

  // Two bright stars, one each side of the river.
  function bigStar(ctx, x, y, r, tint) {
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.18;
    blob(ctx, x, y, r * 3.4, r * 3.4);
    ctx.globalAlpha = 0.35;
    blob(ctx, x, y, r * 1.8, r * 1.8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f6efd8';
    blob(ctx, x, y, r, r);
    ctx.fillRect(x - r * 3, y - 0.5, r * 6, 1);
    ctx.fillRect(x - 0.5, y - r * 3, 1, r * 6);
  }

  function magpie(ctx, x, y, u, flip, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(flip, 1);
    ctx.fillStyle = '#eae4cf';
    blob(ctx, 0, 0, u * 1.5, u * 0.8);
    blob(ctx, u * 1.5, -u * 0.5, u * 0.65, u * 0.55);
    poly(ctx, [-u * 1.2, 0, -u * 4.2, u * 0.2, -u * 1.2, u * 0.7]);
    poly(ctx, [-u * 0.6, -u * 0.2, -u * 1.6, -u * 1.8, u * 0.4, -u * 0.5]);
    ctx.fillStyle = '#7f8baa';
    poly(ctx, [u * 2.1, -u * 0.5, u * 2.9, -u * 0.35, u * 2.1, -u * 0.2]);
    ctx.restore();
  }

  function paintBridge(ctx, g, rand) {
    const u = Math.max(1.4, g.U * 1.25);
    ctx.strokeStyle = '#c9cfe0';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, g.U * 1.1);
    ctx.beginPath();
    for (let x = g.bx0; x <= g.bx1; x += 2) ctx[x === g.bx0 ? 'moveTo' : 'lineTo'](x, bridgeY(g, x));
    ctx.stroke();
    ctx.globalAlpha = 1;
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const x = lerp(g.bx0, g.bx1, i / n) + (rand() - 0.5) * u * 0.6;
      const y = bridgeY(g, x) + (rand() - 0.5) * u * 0.8;
      const slope = (bridgeY(g, x + 2) - bridgeY(g, x - 2)) / 4;
      magpie(ctx, x, y, u, rand() < 0.5 ? 1 : -1, Math.atan(slope) * 0.6);
    }
    bigStar(ctx, g.bx0 - g.W * 0.05, g.by - g.H * 0.02, Math.max(1.5, g.U * 0.9), '#cfd8f2');
    bigStar(ctx, g.bx1 + g.W * 0.05, g.by - g.H * 0.02, Math.max(1.5, g.U * 0.8), '#e3c778');
  }

  function roofEave(ctx, cx, y, w, h) {
    poly(ctx, [cx - w, y, cx - w * 0.55, y - h * 0.1, cx, y - h * 0.5, cx + w * 0.55, y - h * 0.1, cx + w, y,
      cx + w * 0.55, y + h * 0.1, cx - w * 0.55, y + h * 0.1]);
  }

  function paintLand(ctx, g, rand) {
    ctx.fillStyle = '#26365a';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * 0.82 - fbm(x / (g.U * 30), 1.7, 3, 5) * g.H * 0.12);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = '#18233e';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * 0.9 - fbm(x / (g.U * 22), 6.3, 3, 9) * g.H * 0.09);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    // pavilion with a double roof and upswept eaves, on the left hill
    const u = g.U * 1.6;
    const px = g.W * 0.2;
    const py = g.H * 0.93;
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(px - u * 4, py - u * 6, u * 8, u * 6.5);
    roofEave(ctx, px, py - u * 6, u * 8, u * 6);
    ctx.fillRect(px - u * 2.5, py - u * 11, u * 5, u * 4);
    roofEave(ctx, px, py - u * 11, u * 6, u * 5);
    ctx.fillRect(px - 0.5, py - u * 15.5, 1, u * 2.5);
    ctx.fillStyle = '#c9a24a';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(px - u * 1, py - u * 4.5, u * 2, u * 3);
    ctx.globalAlpha = 1;
    // bamboo and a willow on the right
    ctx.strokeStyle = '#0a1020';
    ctx.lineWidth = Math.max(1, u * 0.35);
    for (let i = 0; i < 6; i++) {
      const x = g.W * (0.74 + i * 0.035 + rand() * 0.01);
      const top = g.H * (0.5 + rand() * 0.12);
      ctx.beginPath();
      ctx.moveTo(x, g.H * 0.92);
      ctx.quadraticCurveTo(x + u * 1.2, (top + g.H * 0.92) / 2, x + u * 2.2, top);
      ctx.stroke();
      for (let j = 0; j < 5; j++) {
        const ly = top + j * u * 5;
        ctx.beginPath();
        ctx.moveTo(x + u * 2, ly);
        ctx.lineTo(x + u * 6, ly + u * 2.4);
        ctx.moveTo(x + u * 2, ly);
        ctx.lineTo(x - u * 3, ly + u * 2.2);
        ctx.stroke();
      }
    }
  }

  function paintHaze(g, rand) {
    const c = layer(g.W, g.H * 0.4);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = 0.08 + rand() * 0.07;
      ctx.fillStyle = '#c3cbe0';
      const y = c.height * (0.2 + rand() * 0.6);
      const x = rand() * g.W;
      const rx = g.U * (6 + rand() * 12);
      for (const dx of [-g.W, 0, g.W]) blob(ctx, x + dx, y, rx, g.U * (0.8 + rand()));
    }
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    const back = layer(g.W, g.H);
    const b = back.getContext('2d');
    paintSky(b, g, rand);
    paintRiver(b, g, rand);
    state.stars = paintStars(b, g, rand);
    paintLand(b, g, rand);
    state.back = back;
    const bridge = layer(g.W, g.H);
    paintBridge(bridge.getContext('2d'), g, rand);
    state.bridge = bridge;
    state.haze = paintHaze(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { twinkle, glow } = api.props;
    ctx.drawImage(state.back, 0, 0);
    // haze strip slides along the river
    const off = (t * g.U * 0.9) % g.W;
    const hy = riverY(g, g.W / 2) - state.haze.height / 2;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(state.haze, off, hy);
    ctx.drawImage(state.haze, off - g.W, hy);
    ctx.globalAlpha = 1;
    // bridge glow breathes
    ctx.globalAlpha = Math.min(1, 0.55 + 0.25 * Math.sin(t * 0.7) * glow);
    ctx.drawImage(state.bridge, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4efdc';
    const stars = state.stars;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.globalAlpha = Math.max(0, 0.2 + 0.8 * Math.sin(t * s.s * 1.4 + s.p) * twinkle);
      ctx.fillRect(s.x - 0.5, s.y - 0.5, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { twinkle: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
