/*
 * 雕漆 Diaoqi — carved red lacquer: ruyi cloud scrolls in relief inside a key-fret border.
 *
 * The relief is baked once: a base layer with groove, face and rim, and a pale layer
 * holding only the lit faces and rims. Each frame a slanted soft band of the pale layer
 * (thin clipped strips, no full-screen scratch pass) is laid over the base, so the light
 * seems to slide over the carving.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const INK = { ground: '#3c120e', lattice: '#4e1812', groove: '#240908', face: '#bd3e2f', mid: '#8c2a20', rim: '#e07a5a', gold: '#b8923e', goldHi: '#dcc27a' };
  const SHEAR = -0.32;
  const PERIOD = 16;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- shapes in unit space, drawn under the current transform ----------------

  function circle(ctx, x, y, r) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, Math.max(r, 0.01), 0, TAU);
  }

  // A ruyi head: a fan of three lobes round a filler disc.
  function head(ctx) {
    circle(ctx, 0, 0.05, 0.5);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * (1.16 + i * 0.34);
      circle(ctx, Math.cos(a) * 0.52, 0.05 + Math.sin(a) * 0.52, 0.34);
    }
  }

  // A tail of shrinking discs that sweeps away and curls up at its end.
  function tail(ctx) {
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = 0.35 + 1.5 * t;
      const y = 0.3 + 0.22 * Math.sin(t * 2.6) - 0.5 * t * t * t;
      circle(ctx, x, y, 0.25 * Math.pow(1 - t, 0.8) + 0.05);
    }
  }

  function cloud(ctx) {
    head(ctx);
    tail(ctx);
  }

  function lobeCentres() {
    const out = [[0, 0.05, 0.5]];
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * (1.16 + i * 0.34);
      out.push([Math.cos(a) * 0.52, 0.05 + Math.sin(a) * 0.52, 0.34]);
    }
    return out;
  }

  // ---- carving ------------------------------------------------------------------

  function xf(ctx, o, ox, oy) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(o.x + ox, o.y + oy);
    ctx.rotate(o.rot);
    ctx.scale(o.s * o.flip, o.s);
  }

  function fillShape(ctx, o, ox, oy, build, style, op) {
    ctx.save();
    xf(ctx, o, ox, oy);
    ctx.beginPath();
    build(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = op || 'source-over';
    ctx.fillStyle = style;
    ctx.fill();
    ctx.restore();
  }

  // Lit rim on the upper left: the shape minus itself nudged down-right.
  function rim(ctx, o, build, d, rimStyle, cut) {
    ctx.save();
    xf(ctx, o, 0, 0);
    ctx.beginPath();
    build(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clip();
    ctx.fillStyle = rimStyle;
    ctx.fill();
    ctx.restore();
    ctx.save();
    xf(ctx, o, 0, 0);
    ctx.beginPath();
    build(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clip();
    fillShape(ctx, o, d, d, build, INK.face, cut ? 'destination-out' : 'source-over');
    ctx.restore();
  }

  // Raise one shape onto base b and onto the pale layer p.
  function carve(b, p, o, build, d) {
    fillShape(b, o, d * 1.3, d * 1.3, build, INK.groove);
    fillShape(b, o, 0, 0, build, INK.face);
    rim(b, o, build, d, INK.rim, false);
    fillShape(p, o, 0, 0, build, 'rgba(244,160,120,0.62)');
    rim(p, o, build, d * 1.2, '#f6bd92', true);
  }

  // Engraved arc lines inside each lobe of a head.
  function engrave(b, o, d) {
    b.save();
    xf(b, o, 0, 0);
    b.lineWidth = d / o.s;
    b.strokeStyle = INK.groove;
    const lobes = lobeCentres();
    for (let i = 1; i < lobes.length; i++) {
      const a = Math.PI * (1.16 + (i - 1) * 0.34);
      b.beginPath();
      b.arc(lobes[i][0], lobes[i][1], lobes[i][2] * 0.66, a - 1.1, a + 1.1);
      b.stroke();
    }
    b.beginPath();
    b.arc(0, 0.05, 0.28, 0.4, TAU - 0.5);
    b.stroke();
    b.restore();
  }

  function spiral(ctx) {
    // square key-fret spiral in a 1 x 1 cell
    ctx.moveTo(0.1, 0.9);
    ctx.lineTo(0.1, 0.1);
    ctx.lineTo(0.9, 0.1);
    ctx.lineTo(0.9, 0.9);
    ctx.lineTo(0.35, 0.9);
    ctx.lineTo(0.35, 0.35);
    ctx.lineTo(0.65, 0.35);
    ctx.lineTo(0.65, 0.65);
  }

  function strokeCarve(b, p, o, d, lw) {
    const run = (ctx, ox, oy, style, w) => {
      ctx.save();
      xf(ctx, o, ox, oy);
      ctx.beginPath();
      spiral(ctx);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.lineWidth = w;
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = style;
      ctx.stroke();
      ctx.restore();
    };
    run(b, d * 1.2, d * 1.2, INK.groove, lw);
    run(b, 0, 0, INK.face, lw);
    run(b, -d * 0.35, -d * 0.35, INK.rim, lw * 0.35);
    run(p, 0, 0, 'rgba(246,189,146,0.8)', lw * 0.45);
  }

  // ---- bake -----------------------------------------------------------------------

  function paintGround(b, g) {
    b.fillStyle = INK.ground;
    b.fillRect(0, 0, g.W, g.H);
    b.strokeStyle = INK.lattice;
    b.lineWidth = 1;
    const step = Math.max(3, g.k * 0.28);
    b.beginPath();
    for (let i = -g.H; i < g.W + g.H; i += step) {
      b.moveTo(i, 0);
      b.lineTo(i + g.H, g.H);
      b.moveTo(i, 0);
      b.lineTo(i - g.H, g.H);
    }
    b.stroke();
  }

  function paintClouds(b, p, g) {
    const k = g.k;
    const d = Math.max(1, k * 0.09);
    const colW = k * 2.3;
    const rowH = k * 1.25;
    let row = 0;
    for (let y = g.m + k * 0.6; y < g.H - g.m + k; y += rowH, row++) {
      const off = row % 2 ? colW * 0.5 : 0;
      for (let x = g.m - colW + off; x < g.W - g.m + colW; x += colW) {
        const o = { x, y, s: k * 0.95, flip: row % 2 ? -1 : 1, rot: 0 };
        carve(b, p, o, cloud, d);
        engrave(b, o, d);
      }
    }
  }

  function paintMedallion(b, p, g) {
    const k = g.k;
    const d = Math.max(1, k * 0.1);
    const R = g.H * 0.27;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const disc = (ctx) => circle(ctx, 0, 0, 1);
    fillShape(b, { x: cx, y: cy, s: R * 1.12, flip: 1, rot: 0 }, 0, 0, disc, INK.groove);
    fillShape(b, { x: cx, y: cy, s: R * 1.04, flip: 1, rot: 0 }, 0, 0, disc, INK.ground);
    carve(b, p, { x: cx, y: cy, s: R * 1.04, flip: 1, rot: 0 }, (ctx) => {
      circle(ctx, 0, 0, 1);
      ctx.moveTo(0.86, 0);
      ctx.arc(0, 0, 0.86, 0, TAU, true);
    }, d);
    fillShape(b, { x: cx, y: cy, s: R * 0.84, flip: 1, rot: 0 }, 0, 0, disc, INK.ground);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2;
      const o = { x: cx + Math.cos(a) * R * 0.42, y: cy + Math.sin(a) * R * 0.42, s: R * 0.4, flip: 1, rot: a + Math.PI / 2 };
      carve(b, p, o, head, d);
      engrave(b, o, d);
    }
    const boss = { x: cx, y: cy, s: R * 0.17, flip: 1, rot: 0 };
    fillShape(b, boss, d, d, disc, INK.groove);
    fillShape(b, boss, 0, 0, disc, INK.gold);
    fillShape(b, { x: cx - R * 0.04, y: cy - R * 0.04, s: R * 0.07, flip: 1, rot: 0 }, 0, 0, disc, INK.goldHi);
  }

  function paintBorder(b, p, g) {
    const k = g.k;
    const m = g.m;
    const bw = k * 0.95;
    const d = Math.max(1, k * 0.08);
    const frame = (inset) => (ctx) => {
      ctx.rect(inset, inset, g.W - inset * 2, g.H - inset * 2);
    };
    // cover the cloud field outside the frame with ground, then lay the frame
    b.save();
    b.beginPath();
    b.rect(0, 0, g.W, g.H);
    b.rect(m, m, g.W - m * 2, g.H - m * 2);
    b.clip('evenodd');
    paintGround(b, g);
    b.restore();
    p.save();
    p.globalCompositeOperation = 'destination-out';
    p.beginPath();
    p.rect(0, 0, g.W, g.H);
    p.rect(m, m, g.W - m * 2, g.H - m * 2);
    p.fill('evenodd');
    p.restore();
    const lines = [m, m + bw];
    for (const inset of lines) {
      const o = { x: 0, y: 0, s: 1, flip: 1, rot: 0 };
      const build = (ctx) => {
        ctx.rect(inset - d, inset - d, g.W - (inset - d) * 2, d * 2);
        ctx.rect(inset - d, g.H - inset - d, g.W - (inset - d) * 2, d * 2);
        ctx.rect(inset - d, inset - d, d * 2, g.H - (inset - d) * 2);
        ctx.rect(g.W - inset - d, inset - d, d * 2, g.H - (inset - d) * 2);
      };
      carve(b, p, o, build, d);
    }
    // key-fret cells between the two lines
    const cell = bw * 0.82;
    const lw = Math.max(1.2, cell * 0.14);
    const nx = Math.floor((g.W - m * 2 - bw * 2) / cell);
    const ny = Math.floor((g.H - m * 2 - bw * 2) / cell);
    const x0 = (g.W - nx * cell) / 2;
    const y0 = (g.H - ny * cell) / 2;
    const pad = (bw - cell) / 2;
    const cellAt = (x, y, rot) => strokeCarve(b, p, { x, y, s: cell, flip: 1, rot }, d, lw);
    for (let i = 0; i < nx; i++) {
      cellAt(x0 + i * cell, m + pad + bw * 0.03, 0);
      cellAt(x0 + (i + 1) * cell, g.H - m - pad - bw * 0.03, Math.PI);
    }
    for (let j = 0; j < ny; j++) {
      cellAt(m + pad + bw * 0.03 + cell, y0 + j * cell, Math.PI / 2);
      cellAt(g.W - m - pad - bw * 0.03 - cell, y0 + (j + 1) * cell, -Math.PI / 2);
    }
    // gold studs at the four corners
    const stud = { s: bw * 0.3, flip: 1, rot: 0 };
    const disc = (ctx) => circle(ctx, 0, 0, 1);
    for (const [sx, sy] of [[m + bw * 0.5, m + bw * 0.5], [g.W - m - bw * 0.5, m + bw * 0.5], [m + bw * 0.5, g.H - m - bw * 0.5], [g.W - m - bw * 0.5, g.H - m - bw * 0.5]]) {
      fillShape(b, { ...stud, x: sx, y: sy }, d, d, disc, INK.groove);
      fillShape(b, { ...stud, x: sx, y: sy }, 0, 0, disc, INK.gold);
    }
  }

  // The band is cut into thin slanted strips of even alpha; each strip lays its slice
  // of the pale layer straight onto the frame, so only the band's own pixels are touched.
  const STRIPS = 14;
  const stripAlpha = new Float32Array(STRIPS);
  for (let i = 0; i < STRIPS; i++) {
    const u = (i + 0.5) / STRIPS;
    const s = Math.sin(Math.PI * u);
    stripAlpha[i] = s * s;
  }

  function strip(ctx, pale, x0, x1, H, a) {
    const sh = SHEAR * H;
    const left = Math.max(0, Math.floor(Math.min(x0, x0 + sh)));
    const right = Math.min(pale.width, Math.ceil(Math.max(x1, x1 + sh)));
    if (right <= left) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x1, 0);
    ctx.lineTo(x1 + sh, H);
    ctx.lineTo(x0 + sh, H);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = a;
    ctx.drawImage(pale, left, 0, right - left, H, left, 0, right - left, H);
    ctx.restore();
  }

  function bake(api) {
    const W = api.cols;
    const H = api.rows;
    const k = Math.min(H / 9.5, W / 14);
    const g = { W, H, k, m: Math.max(2, H * 0.045) };
    const base = layer(W, H);
    const pale = layer(W, H);
    const b = base.getContext('2d');
    const p = pale.getContext('2d');
    paintGround(b, g);
    paintClouds(b, p, g);
    paintMedallion(b, p, g);
    paintBorder(b, p, g);
    state.g = g;
    state.base = base;
    state.pale = pale;
  }

  // ---- run ------------------------------------------------------------------------

  function setup(ctx, api) {
    bake(api);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const sheen = api.props.sheen;
    const sw = api.props.sweep || 1;
    ctx.drawImage(state.base, 0, 0);
    if (sheen <= 0) return;
    const bw = g.W * 0.3 * sw;
    const lean = g.H * Math.abs(SHEAR);
    const span = g.W + bw + lean;
    const ph = (t / PERIOD) % 1;
    const x = -bw + ph * span;
    const peak = Math.min(1, sheen * 0.95);
    const step = bw / STRIPS;
    for (let i = 0; i < STRIPS; i++) {
      const x0 = x + i * step;
      strip(ctx, state.pale, x0, x0 + step + 0.5, g.H, peak * stripAlpha[i]);
    }
  }

  Kasuri.run({
    defaults: { sheen: 1, sweep: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
