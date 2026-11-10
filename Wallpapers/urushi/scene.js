/*
 * 漆 Urushi — black lacquer with a gold maki-e plum branch.
 *
 * The lacquer, flecks and branch are baked once, with a second brighter copy of the gold.
 * A soft slanted band of light crosses slowly: it lifts the lacquer a little and lets
 * the bright gold show only where the band passes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep } = K;
  const TAU = Math.PI * 2;
  const GOLD = { deep: '#8f7232', body: '#b8943f', fine: '#cdae5a', petal: '#c9a548', bud: '#a98838' };
  const BRIGHT = { deep: '#c9a24a', body: '#ecd283', fine: '#f6e7aa', petal: '#f3dc92', bud: '#e2c571' };
  const CENTRE = ['#a8402a', '#e8dcc0'];
  const CYCLE = 15;
  const TRAVEL = 0.62;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 0.5), 0, TAU);
    ctx.fill();
  }

  // ---- lacquer ground --------------------------------------------------------

  function paintGround(ctx, g, rand, flecks) {
    const grad = ctx.createLinearGradient(0, 0, g.W, g.H);
    grad.addColorStop(0, '#1d1a18');
    grad.addColorStop(0.5, '#0f0e10');
    grad.addColorStop(1, '#0a0a0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // sunago haze: soft pale-gold clouds low on the right
    for (let i = 0; i < 9; i++) {
      const x = g.W * (0.45 + rand() * 0.55);
      const y = g.H * (0.7 + rand() * 0.3);
      ctx.fillStyle = 'rgba(184,148,63,0.05)';
      ctx.beginPath();
      ctx.ellipse(x, y, g.U * (10 + rand() * 18), g.U * (1.5 + rand() * 3), 0, 0, TAU);
      ctx.fill();
    }
    // nashiji flecks
    const n = Math.round((g.W * g.H) / 90 * flecks);
    for (let i = 0; i < n; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      const bright = rand();
      ctx.fillStyle = bright > 0.85 ? 'rgba(205,174,90,0.75)' : 'rgba(143,114,50,0.55)';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // ---- the plum branch ---------------------------------------------------------

  function bough(ctx, pal, pts, w0, w1) {
    const n = pts.length / 2;
    for (let i = 0; i < n - 1; i++) {
      const f = i / (n - 1);
      ctx.lineWidth = Math.max(1, lerp(w0, w1, f));
      ctx.beginPath();
      ctx.moveTo(pts[i * 2], pts[i * 2 + 1]);
      ctx.lineTo(pts[i * 2 + 2], pts[i * 2 + 3]);
      ctx.stroke();
    }
  }

  // A curved line from (x,y) heading at angle a, bending by 'bend' per step.
  function trace(x, y, a, len, bend, steps, rand) {
    const pts = [x, y];
    const step = len / steps;
    for (let i = 0; i < steps; i++) {
      a += bend + (rand() - 0.5) * 0.18;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push(x, y);
    }
    return pts;
  }

  function blossom(ctx, pal, x, y, r, rot, rand) {
    ctx.fillStyle = pal.petal;
    for (let k = 0; k < 5; k++) {
      const a = rot + (k * TAU) / 5;
      disc(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.58);
    }
    ctx.fillStyle = pal.fine;
    disc(ctx, x, y, r * 0.5);
    ctx.fillStyle = CENTRE[rand() < 0.5 ? 0 : 1];
    disc(ctx, x, y, r * 0.24);
    ctx.strokeStyle = pal.fine;
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const a = rot + (k * TAU) / 5 + TAU / 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15);
      ctx.stroke();
      ctx.fillStyle = pal.fine;
      disc(ctx, x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15, 0.8);
    }
  }

  function bud(ctx, pal, x, y, r) {
    ctx.fillStyle = pal.bud;
    disc(ctx, x, y, r);
    ctx.fillStyle = pal.fine;
    disc(ctx, x - r * 0.25, y - r * 0.25, r * 0.4);
  }

  function twig(ctx, pal, g, rand, x, y, a, len, depth, tips) {
    const bend = (rand() - 0.5) * 0.25;
    const pts = trace(x, y, a, len, bend, 10, rand);
    ctx.strokeStyle = pal.body;
    ctx.lineCap = 'round';
    bough(ctx, pal, pts, g.u * (0.5 + depth * 0.45), g.u * 0.25);
    const n = pts.length / 2;
    if (depth > 0) {
      for (let s = 0; s < 2; s++) {
        const i = 3 + Math.floor(rand() * (n - 4));
        const side = s % 2 ? 1 : -1;
        twig(ctx, pal, g, rand, pts[i * 2], pts[i * 2 + 1], a + side * (0.7 + rand() * 0.5), len * (0.45 + rand() * 0.2), depth - 1, tips);
      }
    }
    tips.push(pts[n * 2 - 2], pts[n * 2 - 1]);
  }

  function paintBranch(ctx, pal, g, seed) {
    const rand = K.rng(seed);
    const u = g.u;
    const tips = [];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const specs = [
      [-u * 2, g.H * 0.88, -0.32, g.W * 0.95, -0.006, 5],
      [g.W * 0.2, -u * 2, 1.15, g.H * 0.78, 0.012, 6],
    ];
    for (const sp of specs) {
      const main = trace(sp[0], sp[1], sp[2], sp[3], sp[4], 26, rand);
      ctx.strokeStyle = pal.deep;
      bough(ctx, pal, main, u * 3.6, u * 0.8);
      ctx.strokeStyle = pal.body;
      bough(ctx, pal, main, u * 2.3, u * 0.5);
      const n = main.length / 2;
      ctx.fillStyle = pal.deep;
      for (let i = 1; i < n - 3; i += 2) {
        ctx.fillRect(main[i * 2] - u * 0.4, main[i * 2 + 1] - u * 0.2, u * 1.2, 1);
      }
      for (let i = sp[5]; i < n - 2; i += 5) {
        const side = i % 2 ? 1 : -1;
        const a = Math.atan2(main[i * 2 + 1] - main[i * 2 - 1], main[i * 2] - main[i * 2 - 2]);
        twig(ctx, pal, g, rand, main[i * 2], main[i * 2 + 1], a + side * (0.55 + rand() * 0.4), u * (14 + rand() * 12), 2, tips);
      }
      tips.push(main[n * 2 - 2], main[n * 2 - 1]);
    }
    for (let i = 0; i < tips.length; i += 2) {
      const r = u * (2 + rand() * 1);
      if (rand() < 0.28) bud(ctx, pal, tips[i], tips[i + 1], r * 0.45);
      else blossom(ctx, pal, tips[i], tips[i + 1], r, rand() * TAU, rand);
    }
  }

  function paintPetals(ctx, pal, g, seed) {
    const rand = K.rng(seed + 7);
    ctx.fillStyle = pal.petal;
    for (let i = 0; i < 14; i++) {
      const x = g.W * (0.12 + rand() * 0.82);
      const y = g.H * (0.5 + rand() * 0.45);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * TAU);
      ctx.beginPath();
      ctx.ellipse(0, 0, g.u * 0.9, g.u * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- light band -------------------------------------------------------------------

  function paintBand(g) {
    const bw = Math.round(g.W * 0.3);
    const skew = 0.45;
    const c = layer(bw + g.H * skew, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, bw, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.setTransform(1, 0, -skew, 1, g.H * skew, 0);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, bw, g.H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }

  // ---- run ------------------------------------------------------------------------

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const g = { W, H, U, u: U * Math.min(1, W / (U * 150)) };
    state.g = g;
    state.flecks = -1;
    state.seed = api.seed;
    const gold = layer(W, H);
    paintBranch(gold.getContext('2d'), GOLD, g, api.seed);
    paintPetals(gold.getContext('2d'), GOLD, g, api.seed);
    const hi = layer(W, H);
    paintBranch(hi.getContext('2d'), BRIGHT, g, api.seed);
    paintPetals(hi.getContext('2d'), BRIGHT, g, api.seed);
    state.gold = gold;
    state.hi = hi;
    state.band = paintBand(g);
    state.tmp = layer(W, H);
    state.ground = layer(W, H);
    state.base = layer(W, H);
  }

  function bake(api) {
    const g = state.g;
    const flecks = api.props.flecks;
    if (state.flecks === flecks) return;
    state.flecks = flecks;
    paintGround(state.ground.getContext('2d'), g, K.rng(state.seed + 3), flecks);
    const b = state.base.getContext('2d');
    b.drawImage(state.ground, 0, 0);
    b.drawImage(state.gold, 0, 0);
  }

  function draw(ctx, t, dt, api) {
    bake(api);
    const g = state.g;
    const amt = api.props.glint;
    ctx.drawImage(state.base, 0, 0);
    if (amt <= 0) return;
    const ph = (t / CYCLE) % 1;
    const f = ph / TRAVEL;
    if (f >= 1) return;
    const e = smoothstep(0, 1, f);
    const bandW = state.band.width;
    const x = lerp(-bandW, g.W + g.H * 0.45, e) - g.H * 0.0;
    const fade = Math.min(1, Math.min(f, 1 - f) * 6);
    const tc = state.tmp.getContext('2d');
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, g.W, g.H);
    tc.drawImage(state.hi, 0, 0);
    tc.globalCompositeOperation = 'destination-in';
    tc.drawImage(state.band, x, 0);
    tc.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, fade * amt);
    ctx.drawImage(state.tmp, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.09 * fade * amt;
    ctx.drawImage(state.band, x, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { glint: 1, flecks: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
