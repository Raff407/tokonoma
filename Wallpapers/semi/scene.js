/*
 * 蝉 Semi — a cicada on a shrine cedar in dappled summer light.
 *
 * The grove, the bound trunk and the cicada are baked once into one wide layer. Each frame
 * lays that layer back in thin rows that slide sideways for the heat. Light patches, sunbeams,
 * paper streamers, a few drifting motes and a brief wing tremor are the only moving parts.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const PAD = 6;
  const ROW = 2;
  const MOTES = 18;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.3), Math.max(ry, 0.3), rot || 0, 0, TAU);
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
    const cx = W * 0.64;
    const hw = Math.min(U * 17, W * 0.2);
    return { W, H, U, cx, hw, cicY: H * 0.6, ropeY: H * 0.24 };
  }

  // ---- grove behind the tree ----------------------------------------------

  function paintGrove(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#2d3f38');
    grad.addColorStop(0.5, '#3d5240');
    grad.addColorStop(1, '#23311f');
    ctx.fillStyle = grad;
    ctx.fillRect(-PAD, 0, g.W + PAD * 2, g.H);
    for (let i = 0; i < 16; i++) {
      const x = rand() * g.W;
      const w = g.U * (2 + rand() * 4);
      ctx.fillStyle = rand() < 0.5 ? '#2b3a2f' : '#34473a';
      ctx.fillRect(x, 0, w, g.H);
    }
    ctx.fillStyle = '#c9d0a0';
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = 0.07 + rand() * 0.05;
      blob(ctx, rand() * g.W, g.H * (0.3 + rand() * 0.4), g.U * (14 + rand() * 18), g.U * (6 + rand() * 6));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1f2c1e';
    ctx.fillRect(-PAD, g.H * 0.92, g.W + PAD * 2, g.H * 0.1);
    ctx.fillStyle = '#4a6038';
    for (let x = 0; x < g.W; x += g.U * (1 + rand() * 2)) blob(ctx, x, g.H * 0.92, g.U * 1.6, g.U * 0.7);
  }

  function paintTorii(ctx, g, x, base, h) {
    const w = h * 0.9;
    const pw = Math.max(1.5, h * 0.07);
    ctx.fillStyle = '#9b4430';
    ctx.fillRect(x - w / 2, base - h, pw, h);
    ctx.fillRect(x + w / 2 - pw, base - h, pw, h);
    ctx.fillRect(x - w / 2 + pw, base - h * 0.78, w - pw * 2, pw * 0.8);
    ctx.fillStyle = '#5a2c24';
    poly(ctx, [x - w * 0.62, base - h * 0.98, x + w * 0.62, base - h * 0.98, x + w * 0.55, base - h * 1.1, x - w * 0.55, base - h * 1.1]);
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(x - w * 0.6, base - h * 1.0, w * 1.2, pw * 0.5);
  }

  function paintLantern(ctx, g, x, base, h) {
    const p = h * 0.08;
    ctx.fillStyle = '#a2a595';
    ctx.fillRect(x - h * 0.2, base - h * 0.08, h * 0.4, h * 0.08);
    ctx.fillRect(x - p, base - h * 0.55, p * 2, h * 0.47);
    ctx.fillRect(x - h * 0.16, base - h * 0.68, h * 0.32, h * 0.14);
    ctx.fillStyle = '#d6b45c';
    ctx.fillRect(x - h * 0.07, base - h * 0.65, h * 0.14, h * 0.08);
    ctx.fillStyle = '#85887a';
    poly(ctx, [x - h * 0.3, base - h * 0.68, x + h * 0.3, base - h * 0.68, x + h * 0.14, base - h * 0.82, x - h * 0.14, base - h * 0.82]);
    blob(ctx, x, base - h * 0.84, h * 0.06, h * 0.06);
    ctx.fillStyle = '#7b7e72';
    ctx.fillRect(x - h * 0.28, base - h * 0.7, h * 0.56, h * 0.025);
  }

  function paintBackdrop(ctx, g, rand) {
    paintGrove(ctx, g, rand);
    paintTorii(ctx, g, g.W * 0.3, g.H * 0.93, g.H * 0.36);
    ctx.fillStyle = '#9fb09a';
    ctx.globalAlpha = 0.28;
    ctx.fillRect(-PAD, g.H * 0.25, g.W + PAD * 2, g.H * 0.7);
    ctx.globalAlpha = 1;
    paintLantern(ctx, g, g.W * 0.11, g.H * 0.96, g.H * 0.46);
    ctx.fillStyle = '#9fb09a';
    ctx.globalAlpha = 0.14;
    ctx.fillRect(-PAD, g.H * 0.4, g.W + PAD * 2, g.H * 0.6);
    ctx.globalAlpha = 1;
  }

  // ---- the cedar ------------------------------------------------------------

  function edgeL(g, y) {
    return g.cx - g.hw * (1 + 0.03 * (y / g.H)) + fbm(y / (g.U * 22), 2.3, 3, 7) * g.U * 2.2 - g.U * 1.1;
  }

  function edgeR(g, y) {
    return g.cx + g.hw * (1 + 0.03 * (y / g.H)) + fbm(y / (g.U * 22), 8.1, 3, 9) * g.U * 2.2 - g.U * 1.1;
  }

  const BARK = ['#2a1d15', '#3a281b', '#4d3523', '#654630', '#7e5a3c', '#97704a'];

  function paintTrunk(ctx, g, rand) {
    for (let x = Math.floor(g.cx - g.hw * 1.2); x <= g.cx + g.hw * 1.2; x++) {
      let y = 0;
      while (y < g.H) {
        const seg = g.U * (1.5 + rand() * 7);
        const l = edgeL(g, y);
        const r = edgeR(g, y);
        if (x >= l && x <= r) {
          const f = (x - l) / (r - l);
          const lit = 0.9 - Math.abs(f - 0.34) * 1.9;
          const ridge = fbm(x / (g.U * 0.9), y / (g.U * 30), 2, 3);
          let k = lit * 3.2 + (ridge - 0.5) * 3.6 + (rand() - 0.5) * 1.4;
          if (f < 0.04 || f > 0.96) k -= 1.2;
          const i = Math.max(0, Math.min(BARK.length - 1, Math.round(k)));
          ctx.fillStyle = BARK[i];
          ctx.fillRect(x, y, 1, seg + 1);
        }
        y += seg;
      }
    }
    ctx.fillStyle = '#4c5a2f';
    for (let i = 0; i < 26; i++) {
      const y = g.H * (0.7 + rand() * 0.3);
      const l = edgeL(g, y);
      ctx.globalAlpha = 0.5 + rand() * 0.4;
      blob(ctx, l + g.U * rand() * 5, y, g.U * (0.6 + rand() * 1.6), g.U * (1 + rand() * 3));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a2014';
    for (let i = 0; i < 10; i++) {
      const y = g.H * rand();
      const x = g.cx + (rand() - 0.5) * g.hw * 1.4;
      ctx.fillRect(x, y, 1, g.U * (4 + rand() * 6));
    }
  }

  // Straw rope with a slight droop, twisted by short diagonal strokes.
  function paintRope(ctx, g) {
    const x0 = edgeL(g, g.ropeY) - g.U * 2.5;
    const x1 = edgeR(g, g.ropeY) + g.U * 2.5;
    const th = Math.max(2.4, g.U * 2.4);
    const sag = (x) => g.ropeY + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * g.U * 1.6;
    ctx.fillStyle = '#b79c62';
    for (let x = x0; x <= x1; x++) ctx.fillRect(x, sag(x) - th / 2, 1, th);
    ctx.fillStyle = '#7c6638';
    for (let x = x0; x < x1; x += th * 0.8) {
      poly(ctx, [x, sag(x) + th / 2, x + 1.1, sag(x) + th / 2, x + th * 0.55, sag(x) - th / 2, x + th * 0.55 - 1.1, sag(x) - th / 2]);
    }
    ctx.fillStyle = '#d9c487';
    for (let x = x0; x < x1; x += th * 0.8) ctx.fillRect(x + th * 0.4, sag(x) - th / 2, 1, 1);
    ctx.fillStyle = '#8a7444';
    blob(ctx, x0, sag(x0) + th * 0.3, th * 0.5, th * 0.8);
    blob(ctx, x1, sag(x1) + th * 0.3, th * 0.5, th * 0.8);
    return { x0, x1, sag };
  }

  // Paper streamers: a zigzag strip of washi, hung from its top-left corner.
  function paintShide(g) {
    const w = Math.max(5, g.U * 3.6);
    const h = g.U * 11;
    const c = layer(w + 2, h + 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ebe5d2';
    const seg = h / 4;
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? w * 0.45 : 0;
      poly(ctx, [sx, i * seg, sx + w * 0.55, i * seg, sx + w * 0.55, (i + 1) * seg, sx, (i + 1) * seg]);
    }
    ctx.fillStyle = '#b8b09a';
    for (let i = 1; i < 4; i++) ctx.fillRect(0, i * seg, w, 1);
    return c;
  }

  // ---- the cicada -------------------------------------------------------------

  function paintCicadaBody(ctx, s) {
    ctx.fillStyle = '#17110c';
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const y = -0.5 + i * 0.22;
        ctx.strokeStyle = '#17110c';
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.beginPath();
        ctx.moveTo(sd * 0.1 * s, y * s);
        ctx.lineTo(sd * 0.34 * s, (y - 0.05) * s);
        ctx.lineTo(sd * 0.44 * s, (y + 0.12) * s);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#2a1c12';
    blob(ctx, 0, 0.28 * s, 0.14 * s, 0.4 * s);
    ctx.fillStyle = '#3d2a1a';
    blob(ctx, -0.03 * s, 0.22 * s, 0.07 * s, 0.3 * s);
    ctx.fillStyle = '#17110c';
    for (let i = 0; i < 5; i++) ctx.fillRect(-0.13 * s, (0.05 + i * 0.1) * s, 0.26 * s, Math.max(1, 0.015 * s));
    ctx.fillStyle = '#3b2a1b';
    blob(ctx, 0, -0.42 * s, 0.19 * s, 0.3 * s);
    ctx.fillStyle = '#6b4c2e';
    blob(ctx, -0.06 * s, -0.5 * s, 0.07 * s, 0.14 * s);
    ctx.fillStyle = '#d6c79a';
    blob(ctx, 0, -0.35 * s, 0.05 * s, 0.07 * s);
    ctx.fillStyle = '#2a1d13';
    blob(ctx, 0, -0.84 * s, 0.22 * s, 0.11 * s);
    ctx.fillStyle = '#a8412a';
    blob(ctx, -0.22 * s, -0.86 * s, 0.07 * s, 0.07 * s);
    blob(ctx, 0.22 * s, -0.86 * s, 0.07 * s, 0.07 * s);
    ctx.fillStyle = '#e6b8a0';
    ctx.fillRect(-0.24 * s, -0.89 * s, Math.max(1, 0.03 * s), Math.max(1, 0.03 * s));
  }

  function paintWings(g, s) {
    const c = layer(s * 1.6, s * 2.1);
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, s * 0.8);
    for (const sd of [-1, 1]) {
      const rot = sd * 0.1;
      ctx.fillStyle = 'rgba(226,216,186,0.78)';
      blob(ctx, sd * 0.2 * s, 0.1 * s, 0.17 * s, 0.78 * s, rot);
      ctx.strokeStyle = 'rgba(70,52,34,0.75)';
      ctx.lineWidth = Math.max(1, s * 0.022);
      ctx.beginPath();
      ctx.moveTo(sd * 0.1 * s, -0.5 * s);
      ctx.quadraticCurveTo(sd * 0.27 * s, 0.1 * s, sd * 0.3 * s, 0.82 * s);
      ctx.moveTo(sd * 0.1 * s, -0.4 * s);
      ctx.quadraticCurveTo(sd * 0.16 * s, 0.2 * s, sd * 0.2 * s, 0.84 * s);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 6; i++) {
        ctx.moveTo(sd * 0.13 * s, (-0.3 + i * 0.18) * s);
        ctx.lineTo(sd * 0.3 * s, (-0.22 + i * 0.17) * s);
      }
      ctx.stroke();
    }
    return { c, ox: c.width / 2, oy: s * 0.8 };
  }

  // ---- light ---------------------------------------------------------------

  function paintDapple(g, rand) {
    const w = g.W * 1.4;
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0d88a';
    for (let i = 0; i < 70; i++) {
      const x = rand() * w;
      const y = rand() * g.H;
      const r = g.U * (1.4 + rand() * 3.4);
      ctx.globalAlpha = 0.16 + rand() * 0.2;
      blob(ctx, x, y, r, r * (0.6 + rand() * 0.4), rand() * 3);
      ctx.globalAlpha = 0.18;
      blob(ctx, x - r * 0.15, y - r * 0.1, r * 0.45, r * 0.4);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintBeams(g, rand) {
    const w = g.W * 1.6;
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const slant = g.H * 0.5;
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.2 + rand() * 0.6) * (w / 6);
      const bw = g.U * (7 + rand() * 12);
      const grad = ctx.createLinearGradient(0, 0, 0, g.H);
      grad.addColorStop(0, 'rgba(240,216,140,0.42)');
      grad.addColorStop(0.7, 'rgba(240,216,140,0.2)');
      grad.addColorStop(1, 'rgba(240,216,140,0)');
      ctx.fillStyle = grad;
      poly(ctx, [x, 0, x + bw, 0, x + bw - slant, g.H, x - slant, g.H]);
    }
    return c;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const world = layer(g.W + PAD * 2, g.H);
    const wctx = world.getContext('2d');
    wctx.translate(PAD, 0);
    paintBackdrop(wctx, g, rand);
    paintTrunk(wctx, g, rand);
    const rope = paintRope(wctx, g);
    wctx.fillStyle = '#c08a52';
    wctx.globalAlpha = 0.35;
    blob(wctx, g.cx - g.hw * 0.1, g.cicY, g.hw * 0.75, g.U * 24);
    wctx.globalAlpha = 1;
    const s = g.U * 27;
    wctx.save();
    wctx.translate(g.cx - g.hw * 0.12, g.cicY);
    wctx.rotate(0.07);
    paintCicadaBody(wctx, s);
    wctx.restore();
    state.g = g;
    state.world = world;
    state.rope = rope;
    state.shide = paintShide(g);
    state.wings = paintWings(g, s);
    state.s = s;
    state.dapple = paintDapple(g, rand);
    state.beams = paintBeams(g, rand);
    state.motes = [];
    for (let i = 0; i < MOTES; i++) state.motes.push({ x: rand(), y: rand(), v: 0.2 + rand() * 0.5, p: rand() * TAU });
  }

  function drawWorld(ctx, g, t, amount) {
    const amp = 0.9 * amount;
    for (let y = 0; y < g.H; y += ROW) {
      const f = 0.35 + 0.65 * (y / g.H);
      const dx = amp * f * (Math.sin(y * 0.33 + t * 2.4) + 0.5 * Math.sin(y * 0.13 - t * 1.5));
      ctx.drawImage(state.world, 0, y, g.W + PAD * 2, ROW, dx - PAD, y, g.W + PAD * 2, ROW);
    }
  }

  function drawShide(ctx, g, t) {
    const r = state.rope;
    for (let i = 0; i < 3; i++) {
      const x = r.x0 + (r.x1 - r.x0) * (0.2 + i * 0.3);
      const sway = 0.07 * Math.sin(t * 0.9 + i * 1.7) + 0.04 * Math.sin(t * 1.9 + i);
      ctx.save();
      ctx.translate(x, r.sag(x) + 1);
      ctx.transform(1, 0, sway, 1, 0, 0);
      ctx.drawImage(state.shide, 0, 0);
      ctx.restore();
    }
  }

  function drawWings(ctx, g, t) {
    const burst = Math.pow(Math.max(0, Math.sin(t * 0.6)), 10);
    const jx = burst * 0.35 * Math.sin(t * 22);
    ctx.save();
    ctx.translate(g.cx - g.hw * 0.12 + jx, g.cicY);
    ctx.rotate(0.07);
    ctx.drawImage(state.wings.c, -state.wings.ox, -state.wings.oy);
    ctx.restore();
  }

  function drawLight(ctx, g, t, beams) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(state.dapple, -g.W * 0.2 + Math.sin(t * 0.12) * g.W * 0.08, Math.sin(t * 0.17) * g.U * 2);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(state.dapple, -g.W * 0.35 - Math.sin(t * 0.09 + 1) * g.W * 0.07, g.U * 5 + Math.cos(t * 0.13) * g.U * 2);
    ctx.globalAlpha = Math.min(1, beams * (0.75 + 0.25 * Math.sin(t * 0.3)));
    ctx.drawImage(state.beams, -g.W * 0.3 + Math.sin(t * 0.07) * g.W * 0.12, 0);
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t, beams) {
    if (beams <= 0) return;
    ctx.fillStyle = '#f2e2a8';
    for (let i = 0; i < MOTES; i++) {
      const m = state.motes[i];
      const x = ((m.x + t * 0.004 * m.v + 1) % 1) * g.W + Math.sin(t * 0.6 + m.p) * g.U;
      const y = ((m.y - t * 0.006 * m.v) % 1 + 1) % 1 * g.H;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { shimmer, beams } = api.props;
    drawWorld(ctx, g, t, shimmer);
    drawShide(ctx, g, t);
    drawWings(ctx, g, t);
    drawLight(ctx, g, t, beams);
    drawMotes(ctx, g, t, beams);
  }

  Kasuri.run({
    defaults: { shimmer: 1, beams: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
