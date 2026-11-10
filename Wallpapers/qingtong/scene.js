/*
 * 青铜 Qingtong — a bronze ritual ding with a taotie mask and green patina.
 *
 * The vessel is painted twice, once in dull patina tones and once in brighter
 * lamp-lit tones. Each frame the bright copy is cut by a soft slanted band that
 * crosses the vessel and laid over the dull one, plus a small fixed set of glints.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const DULL = {
    body: '#456a54', relief: '#7fa584', deep: '#0f1a14', hi: '#9ab58f',
    gold: '#b8903f', patina: '#6f9f86', rust: '#6b4c2c', leg: '#3b5c48',
  };
  const LIT = {
    body: '#86ad8d', relief: '#d6e8c0', deep: '#1a2c22', hi: '#f0f2d4',
    gold: '#e6c76e', patina: '#a6cbb0', rust: '#9a7240', leg: '#7aa385',
  };
  const GLINTS = 16;
  const SWEEP_PERIOD = 17;
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
    const U = H / 100;
    const rw = 24;
    const bw = (rw + 8) * 2 * U;
    const bx = Math.max(0, Math.floor(W / 2 - bw / 2));
    const by = Math.floor(4 * U);
    return {
      W, H, U, cx: W / 2, rw, yT: 19, yB: 66, yc: 34,
      bx, by, bw: Math.min(W - bx, Math.ceil(bw)), bh: Math.min(H - by, Math.ceil(86 * U)),
    };
  }

  // Half width of the body in units of U at height y (also in units).
  function halfWidth(g, y) {
    const s = Math.min(1, Math.max(0, (y - g.yT) / (g.yB - g.yT)));
    return g.rw * (1 + 0.07 * Math.sin(Math.PI * Math.min(1, s * 1.15))) * (1 - 0.5 * s * s * s);
  }

  // ---- strokes ---------------------------------------------------------------

  function wide(g, w) {
    return Math.max(w, 1.15 / g.U);
  }

  // A carved line: dark edge underneath, lighter ridge on top. Drawn in unit space.
  function relief(ctx, g, pal, w, trace) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = wide(g, w) + wide(g, 0.9);
    ctx.beginPath();
    trace();
    ctx.stroke();
    ctx.strokeStyle = pal.relief;
    ctx.lineWidth = wide(g, w);
    ctx.beginPath();
    trace();
    ctx.stroke();
  }

  function spiral(ctx, x, y, r, dir) {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU * 1.15;
      const rr = r * (1 - (i / steps) * 0.75);
      const px = x + Math.cos(a * dir) * rr;
      const py = y + Math.sin(a * dir) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  function disc(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // ---- body decoration ---------------------------------------------------------

  // Square-spiral ground inside the taotie band.
  function leiwen(ctx, g, pal) {
    const c = 2.6;
    const yt = g.yc - 10.2;
    const yb = g.yc + 10.2;
    ctx.save();
    ctx.beginPath();
    for (let y = yt; y <= yb; y += 1) ctx.lineTo(g.cx / g.U + halfWidth(g, y) - 0.3, y);
    for (let y = yb; y >= yt; y -= 1) ctx.lineTo(g.cx / g.U - halfWidth(g, y) + 0.3, y);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = wide(g, 0.5);
    ctx.lineJoin = 'miter';
    ctx.globalAlpha = 0.75;
    const x0 = g.cx / g.U - g.rw - 2;
    ctx.beginPath();
    for (let row = 0; yt + row * c < yb; row++) {
      for (let col = 0; col * c < g.rw * 2 + 4; col++) {
        const flip = (row + col) % 2 ? -1 : 1;
        const ox = x0 + col * c + (flip > 0 ? 0 : c);
        const oy = yt + row * c;
        ctx.moveTo(ox, oy + c * 0.9);
        ctx.lineTo(ox, oy + c * 0.1);
        ctx.lineTo(ox + flip * c * 0.9, oy + c * 0.1);
        ctx.lineTo(ox + flip * c * 0.9, oy + c * 0.9);
        ctx.lineTo(ox + flip * c * 0.3, oy + c * 0.9);
        ctx.lineTo(ox + flip * c * 0.3, oy + c * 0.45);
        ctx.lineTo(ox + flip * c * 0.65, oy + c * 0.45);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Right half of the mask, in unit space with the axis at x = 0 and band centre y = 0.
  function maskHalf(ctx, g, pal) {
    relief(ctx, g, pal, 2.4, () => {
      ctx.moveTo(0.2, -9);
      ctx.lineTo(0.2, 9);
    });
    relief(ctx, g, pal, 1.8, () => {
      ctx.moveTo(0.4, -9);
      ctx.lineTo(3.2, -8);
      ctx.lineTo(3.2, -6.4);
    });
    relief(ctx, g, pal, 1.2, () => {
      ctx.moveTo(1.4, 3.5);
      ctx.quadraticCurveTo(3.2, 2.2, 3.8, 4.4);
      ctx.moveTo(1.4, 6.5);
      ctx.quadraticCurveTo(3.0, 5.6, 3.6, 7.2);
    });
    // eye: almond lid, round eyeball, bright pupil
    ctx.fillStyle = pal.deep;
    ctx.beginPath();
    ctx.ellipse(6.6, -1.4, 5.1, 3.5, -0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.relief;
    ctx.beginPath();
    ctx.ellipse(6.6, -1.4, 4.2, 2.7, -0.12, 0, TAU);
    ctx.fill();
    disc(ctx, 6.8, -1.4, 2.1, pal.deep);
    disc(ctx, 6.5, -1.7, 1.0, pal.gold);
    // brow arching over the eye and ending in a curl
    relief(ctx, g, pal, 1.9, () => {
      ctx.moveTo(2.2, -6.8);
      ctx.bezierCurveTo(6, -10.4, 11, -9.4, 12.6, -5.6);
      spiral(ctx, 12.0, -4.6, 1.9, 1);
    });
    // jaw and body running out under the eye
    relief(ctx, g, pal, 2.1, () => {
      ctx.moveTo(3.2, 7.4);
      ctx.bezierCurveTo(8, 4.2, 11.5, 9.6, 15.5, 6.2);
      spiral(ctx, 15.8, 4.4, 1.8, -1);
    });
    relief(ctx, g, pal, 1.0, () => {
      ctx.moveTo(6.4, 9.6);
      ctx.lineTo(7.2, 10.4);
      ctx.moveTo(8.8, 9.9);
      ctx.lineTo(9.6, 10.7);
      ctx.moveTo(11.2, 9.6);
      ctx.lineTo(12, 10.4);
    });
    // side dragon in profile
    relief(ctx, g, pal, 1.9, () => {
      ctx.moveTo(15.8, 0.6);
      ctx.bezierCurveTo(17.4, -7.4, 22.6, -7.2, 22.4, -2.2);
      ctx.bezierCurveTo(22.2, 1.8, 18.8, 1.2, 19.2, 4.6);
    });
    relief(ctx, g, pal, 1.2, () => {
      ctx.moveTo(18.5, 8.4);
      ctx.bezierCurveTo(20.4, 6.6, 22.6, 8.2, 22.8, 6);
      spiral(ctx, 22.4, 5.0, 1.2, 1);
    });
    disc(ctx, 19.9, -5.0, 1.0, pal.deep);
    disc(ctx, 19.9, -5.2, 0.5, pal.gold);
  }

  function paintMask(ctx, g, pal) {
    leiwen(ctx, g, pal);
    for (const sgn of [1, -1]) {
      ctx.save();
      ctx.translate(g.cx / g.U, g.yc);
      ctx.scale(sgn, 1);
      maskHalf(ctx, g, pal);
      ctx.restore();
    }
  }

  // Raised bowstring ridges that cross the whole body at height y.
  function ridge(ctx, g, pal, y) {
    ctx.lineCap = 'butt';
    const x = g.cx / g.U;
    const hw = halfWidth(g, y);
    ctx.strokeStyle = pal.deep;
    ctx.lineWidth = wide(g, 1.9);
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x + hw, y);
    ctx.stroke();
    ctx.strokeStyle = pal.relief;
    ctx.lineWidth = wide(g, 1.0);
    ctx.stroke();
  }

  // Round studs under the lip, spaced as they would be around a cylinder.
  function beads(ctx, g, pal, y, n) {
    const x = g.cx / g.U;
    const hw = halfWidth(g, y) - 0.8;
    for (let i = 0; i < n; i++) {
      const a = (-0.5 + i / (n - 1)) * 2.5;
      const sx = Math.sin(a);
      const r = 0.95 * Math.cos(a) + 0.3;
      disc(ctx, x + hw * sx, y, r + 0.45, pal.deep);
      disc(ctx, x + hw * sx, y, r, pal.relief);
    }
  }

  // Curved flutes on the lower belly that gather towards the foot.
  function flutes(ctx, g, pal) {
    const x = g.cx / g.U;
    const y0 = g.yc + 13.2;
    const n = 15;
    for (let i = 0; i < n; i++) {
      const a = (-0.5 + i / (n - 1)) * 2.7;
      const sx = Math.sin(a);
      relief(ctx, g, pal, 1.15 * Math.max(0.4, Math.cos(a)), () => {
        for (let y = y0; y <= g.yB - 1.5; y += 1.5) {
          const px = x + halfWidth(g, y) * sx * 0.97;
          if (y === y0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
      });
    }
  }

  function bodyPath(ctx, g) {
    const x = g.cx / g.U;
    ctx.beginPath();
    for (let y = g.yT; y <= g.yB; y += 0.5) ctx.lineTo(x - halfWidth(g, y), y);
    ctx.quadraticCurveTo(x, g.yB + 3.2, x + halfWidth(g, g.yB), g.yB);
    for (let y = g.yB; y >= g.yT; y -= 0.5) ctx.lineTo(x + halfWidth(g, y), y);
    ctx.closePath();
  }

  // ---- vessel parts ------------------------------------------------------------

  function legPath(ctx, x, top, bottom, topW, botW, splay) {
    ctx.beginPath();
    ctx.moveTo(x - topW / 2, top);
    ctx.lineTo(x + splay - botW / 2, bottom);
    ctx.lineTo(x + splay + botW / 2, bottom);
    ctx.lineTo(x + topW / 2, top);
    ctx.closePath();
  }

  function paintLeg(ctx, g, pal, x, splay, face) {
    const top = 56;
    const bot = 86;
    legPath(ctx, x, top, bot, 9, 4.6, splay);
    ctx.fillStyle = pal.deep;
    ctx.fill();
    ctx.save();
    ctx.translate(0.3, 0);
    legPath(ctx, x, top, bot, 8.2, 3.8, splay);
    ctx.fillStyle = pal.leg;
    ctx.fill();
    ctx.restore();
    if (face) {
      const fy = top + 5;
      disc(ctx, x - 1.9, fy, 1.5, pal.deep);
      disc(ctx, x + 1.9, fy, 1.5, pal.deep);
      disc(ctx, x - 1.9, fy - 0.2, 0.8, pal.gold);
      disc(ctx, x + 1.9, fy - 0.2, 0.8, pal.gold);
      relief(ctx, g, pal, 0.9, () => {
        ctx.moveTo(x, fy - 2);
        ctx.lineTo(x, fy + 6);
        ctx.moveTo(x - 3.2, fy - 2.6);
        ctx.quadraticCurveTo(x - 1.8, fy - 3.6, x - 0.6, fy - 2.4);
        ctx.moveTo(x + 3.2, fy - 2.6);
        ctx.quadraticCurveTo(x + 1.8, fy - 3.6, x + 0.6, fy - 2.4);
      });
    }
    ctx.fillStyle = pal.deep;
    ctx.fillRect(x + splay * 0.8 - 2.6, bot - 1.8, 5.2, 1.8);
    const mid = top + 15;
    relief(ctx, g, pal, 1.0, () => {
      ctx.moveTo(x - 3.1, mid);
      ctx.lineTo(x + 3.1 + splay * 0.4, mid);
    });
  }

  function paintEar(ctx, g, pal, side) {
    const x = g.cx / g.U + side * 20.4;
    relief(ctx, g, pal, 2.1, () => {
      ctx.moveTo(x - 3.3, g.yT - 0.5);
      ctx.lineTo(x - 3.0, 8);
      ctx.lineTo(x + 3.0, 8);
      ctx.lineTo(x + 3.3, g.yT - 0.5);
    });
    relief(ctx, g, pal, 0.8, () => {
      ctx.moveTo(x - 1.5, 8);
      ctx.lineTo(x + 1.5, 8);
    });
  }

  function patinaSpots(ctx, g, pal, rand) {
    const x = g.cx / g.U;
    ctx.save();
    bodyPath(ctx, g);
    ctx.clip();
    for (let i = 0; i < 150; i++) {
      const y = g.yT + rand() * (g.yB - g.yT);
      const hw = halfWidth(g, y);
      const px = x + (rand() * 2 - 1) * hw;
      const r = 0.5 + rand() * 1.6;
      ctx.globalAlpha = 0.28 + rand() * 0.3;
      ctx.fillStyle = rand() < 0.78 ? pal.patina : pal.rust;
      ctx.beginPath();
      ctx.ellipse(px, y, r * 1.3, r * 0.8, rand() * 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function paintVessel(g, pal, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(seed);
    ctx.save();
    ctx.scale(g.U, g.U);
    const x = g.cx / g.U;

    paintLeg(ctx, g, pal, x - 15, -1.4, false);
    paintLeg(ctx, g, pal, x + 15, 1.4, false);
    paintEar(ctx, g, pal, -1);
    paintEar(ctx, g, pal, 1);

    bodyPath(ctx, g);
    ctx.fillStyle = pal.deep;
    ctx.fill();
    ctx.save();
    ctx.translate(0, 0.2);
    bodyPath(ctx, g);
    ctx.fillStyle = pal.body;
    ctx.fill();
    ctx.restore();

    patinaSpots(ctx, g, pal, rand);
    paintMask(ctx, g, pal);
    ridge(ctx, g, pal, g.yc - 11.4);
    ridge(ctx, g, pal, g.yc + 11.4);
    beads(ctx, g, pal, g.yT + 2.1, 15);
    flutes(ctx, g, pal);

    // lip on top of the body
    ctx.fillStyle = pal.deep;
    ctx.fillRect(x - g.rw - 1.8, g.yT - 3.4, (g.rw + 1.8) * 2, 3.8);
    ctx.fillStyle = pal.relief;
    ctx.fillRect(x - g.rw - 1.2, g.yT - 2.9, (g.rw + 1.2) * 2, 1.9);
    ctx.fillStyle = pal.body;
    ctx.fillRect(x - g.rw - 1.2, g.yT - 1, (g.rw + 1.2) * 2, 1);

    paintLeg(ctx, g, pal, x, 0, true);
    ctx.restore();

    // round the form: dark towards both sides, a little light on the left
    ctx.globalCompositeOperation = 'source-atop';
    const sx0 = g.cx - g.rw * g.U * 1.15;
    const sx1 = g.cx + g.rw * g.U * 1.15;
    const grad = ctx.createLinearGradient(sx0, 0, sx1, 0);
    grad.addColorStop(0, 'rgba(6,12,9,0.62)');
    grad.addColorStop(0.2, 'rgba(6,12,9,0.1)');
    grad.addColorStop(0.36, 'rgba(235,240,215,0.07)');
    grad.addColorStop(0.62, 'rgba(6,12,9,0.08)');
    grad.addColorStop(1, 'rgba(6,12,9,0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const down = ctx.createLinearGradient(0, g.yB * g.U * 0.85, 0, 88 * g.U);
    down.addColorStop(0, 'rgba(6,12,9,0)');
    down.addColorStop(1, 'rgba(6,12,9,0.4)');
    ctx.fillStyle = down;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- backdrop ----------------------------------------------------------------

  function paintBackdrop(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const sky = ctx.createLinearGradient(0, 0, 0, g.H);
    sky.addColorStop(0, '#0d1316');
    sky.addColorStop(0.7, '#17211f');
    sky.addColorStop(1, '#0c110f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);

    const halo = ctx.createRadialGradient(g.cx, 44 * U, 4 * U, g.cx, 44 * U, 52 * U);
    halo.addColorStop(0, 'rgba(206,198,166,0.34)');
    halo.addColorStop(0.55, 'rgba(150,170,140,0.13)');
    halo.addColorStop(1, 'rgba(120,140,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);

    // table top
    const ty = 82 * U;
    const table = ctx.createLinearGradient(0, ty, 0, g.H);
    table.addColorStop(0, '#1f1a14');
    table.addColorStop(0.25, '#16130f');
    table.addColorStop(1, '#0a0907');
    ctx.fillStyle = table;
    ctx.fillRect(0, ty, g.W, g.H - ty);
    ctx.fillStyle = 'rgba(176,144,80,0.28)';
    ctx.fillRect(0, ty, g.W, Math.max(1, U * 0.45));

    // shadow under the feet
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(g.cx, 86.2 * U, 25 * U, 2.6 * U, 0, 0, TAU);
    ctx.fill();
    return c;
  }

  // ---- light -------------------------------------------------------------------

  function paintBand(g) {
    const bandW = g.bw * 0.34;
    const slant = g.bh * 0.32;
    const c = layer(bandW + slant, g.bh);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, bandW, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    for (let y = 0; y < g.bh; y++) {
      ctx.setTransform(1, 0, 0, 1, slant * (1 - y / g.bh), y);
      ctx.fillRect(0, 0, bandW, 1);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas: c, w: bandW + slant };
  }

  function makeGlints(g, rand) {
    const n = GLINTS;
    const out = { n, x: new Float32Array(n), y: new Float32Array(n), s: new Float32Array(n), p: new Float32Array(n) };
    const spots = [
      [g.yT - 2.6, 1], [g.yc - 11.4, 1], [g.yc + 11.4, 1], [g.yT + 2.1, 1], [8, 0.1], [g.yc - 2, 1],
    ];
    for (let i = 0; i < n; i++) {
      const sp = spots[i % spots.length];
      const y = sp[0] + (i >= spots.length ? (rand() - 0.5) * 14 : 0);
      const hw = halfWidth(g, Math.min(g.yB, Math.max(g.yT, y))) - 1.5;
      out.x[i] = g.cx + (rand() * 2 - 1) * hw * 0.9 * g.U;
      out.y[i] = y * g.U;
      out.s[i] = 0.35 + rand() * 0.5;
      out.p[i] = rand() * TAU;
    }
    return out;
  }

  function drawSheen(ctx, g, t, amount) {
    if (amount <= 0) return;
    const S = state;
    const ph = (t / SWEEP_PERIOD) % 1;
    const travel = g.bw + S.band.w;
    const x = -S.band.w + travel * Math.min(1, ph * 1.25);
    const sc = S.scratch.getContext('2d');
    sc.globalCompositeOperation = 'source-over';
    sc.clearRect(0, 0, g.bw, g.bh);
    sc.drawImage(S.lit, g.bx, g.by, g.bw, g.bh, 0, 0, g.bw, g.bh);
    sc.globalCompositeOperation = 'destination-in';
    sc.drawImage(S.band.canvas, x, 0);
    sc.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, 0.9 * amount);
    ctx.drawImage(S.scratch, g.bx, g.by);
    // a faint steady breath of the same light
    ctx.globalAlpha = Math.min(1, amount * (0.14 + 0.1 * Math.sin(t * 0.6)));
    ctx.drawImage(S.lit, g.bx, g.by, g.bw, g.bh, g.bx, g.by, g.bw, g.bh);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    const G = state.glints;
    const sz = Math.max(1, g.U * 0.7);
    ctx.fillStyle = '#f1e6b8';
    for (let i = 0; i < G.n; i++) {
      const a = Math.sin(t * G.s[i] + G.p[i]);
      if (a <= 0.3) continue;
      ctx.globalAlpha = Math.min(1, (a - 0.3) * amount * 0.9);
      ctx.fillRect(G.x[i], G.y[i], sz, sz);
      ctx.fillRect(G.x[i] - sz, G.y[i] + sz * 0.35, sz * 3, Math.max(1, sz * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.back = paintBackdrop(g);
    state.vessel = paintVessel(g, DULL, api.seed);
    state.lit = paintVessel(g, LIT, api.seed);
    state.scratch = layer(g.bw, g.bh);
    state.band = paintBand(g);
    state.glints = makeGlints(g, K.rng(api.seed + 7));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sheen, glints } = api.props;
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.vessel, 0, 0);
    drawSheen(ctx, g, t, sheen);
    drawGlints(ctx, g, t, glints);
  }

  Kasuri.run({
    defaults: { sheen: 1, glints: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
