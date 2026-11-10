/*
 * 凤凰 Fenghuang — long phoenix tail feathers on a dark ground.
 *
 * Each feather is a ribbon with fine barbs and a gilded eye near its tip. It is
 * baked in a few linked pieces; every frame the pieces are chained together with a
 * small travelling bend, so the feather ripples like smoke. Cloud scrolls and the
 * dark ground are baked once. A few gold motes drift on top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const PIECES = 5;
  const STEPS = 90;
  const MOTES = 14;
  const state = {};

  const GROUND = ['#0d0f18', '#12152a', '#191d3a'];
  const RED = ['#8f2a1c', '#b8381f', '#d6452c'];
  const GOLD = ['#a98a3c', '#c9a24a', '#e6c46a'];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const u = H / 100;
    return { W, H, u, len: Math.max(H * 1.1, W * 0.75) };
  }

  // ---- ground and clouds ---------------------------------------------------

  function scroll(ctx, x, y, r, turns) {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * turns * TAU;
      const rr = r * (1 - i / 46);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr * 0.9;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function cloud(ctx, x, y, r, tail) {
    scroll(ctx, x, y, r, 1.6);
    ctx.beginPath();
    ctx.moveTo(x - r, y + r * 0.1);
    ctx.quadraticCurveTo(x - r * 1.8, y + r * 1.1, x - tail, y + r * 0.8);
    ctx.stroke();
    scroll(ctx, x + r * 1.7, y + r * 0.5, r * 0.7, 1.4);
  }

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, g.W * 0.3, g.H);
    gr.addColorStop(0, GROUND[2]);
    gr.addColorStop(0.55, GROUND[1]);
    gr.addColorStop(1, GROUND[0]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.strokeStyle = '#3a3f66';
    ctx.lineWidth = Math.max(1, g.u * 0.35);
    ctx.lineCap = 'round';
    const spots = [[0.78, 0.2, 7], [0.9, 0.62, 6], [0.5, 0.82, 5], [0.12, 0.2, 5], [0.62, 0.45, 4]];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      cloud(ctx, g.W * s[0], g.H * s[1], g.u * s[2], g.u * (s[2] + 10));
    }
    return c;
  }

  // ---- feather -------------------------------------------------------------

  // Centre line of one feather, heading integrated along its length.
  function spine(g, f) {
    const pts = [];
    let x = 0;
    let y = 0;
    let th = f.th0;
    const step = f.len / STEPS;
    for (let i = 0; i <= STEPS; i++) {
      const s = i / STEPS;
      const curl = s > 0.8 ? Math.pow((s - 0.8) / 0.2, 2.2) * f.curl : 0;
      const bend = Math.sin(s * TAU * f.freq + f.ph) * f.sway;
      const w = s < 0.82 ? f.wid * (0.3 + 0.7 * Math.sin(Math.PI * Math.pow(s / 0.82, 0.6))) * (s < 0.04 ? s / 0.04 : 1)
        : Math.max(0.5, f.wid * 0.1 * (1 - (s - 0.82) / 0.18) + 0.5);
      pts.push({ x, y, th: th + bend + curl, w });
      const h = th + bend + curl;
      x += Math.cos(h) * step;
      y += Math.sin(h) * step;
    }
    return pts;
  }

  function mix(a, b, t) { return K.toHex(K.mixColor(K.parseColor(a), K.parseColor(b), t)); }

  function paintPiece(ctx, pts, i0, i1, ox, oy, rot, f, g) {
    const cs = Math.cos(-rot);
    const sn = Math.sin(-rot);
    function T(px, py) { return [(px - ox) * cs - (py - oy) * sn, (px - ox) * sn + (py - oy) * cs]; }
    for (let i = i0; i < i1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const s = i / STEPS;
      const na = [-Math.sin(a.th), Math.cos(a.th)];
      const nb = [-Math.sin(b.th), Math.cos(b.th)];
      const p1 = T(a.x + na[0] * a.w, a.y + na[1] * a.w);
      const p2 = T(b.x + nb[0] * b.w, b.y + nb[1] * b.w);
      const p3 = T(b.x - nb[0] * b.w, b.y - nb[1] * b.w);
      const p4 = T(a.x - na[0] * a.w, a.y - na[1] * a.w);
      ctx.fillStyle = mix(f.dim ? '#5a1d18' : RED[0], f.dim ? '#7a5a2a' : RED[2], 0.5 + 0.5 * Math.sin(s * 9 + f.ph));
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]);
      ctx.closePath();
      ctx.fill();
      if (s < 0.84 && i % 2 === 0) {
        // barbs swept toward the tip
        const c0 = T(a.x, a.y);
        const sweep = 0.9;
        for (let side = -1; side <= 1; side += 2) {
          const ang = a.th + side * (Math.PI / 2 - sweep * 0.55) - rot;
          const bl = a.w * 1.05;
          const e0 = T(a.x + na[0] * a.w * side * 0.6, a.y + na[1] * a.w * side * 0.6);
          ctx.strokeStyle = (i % 4 === 0) ? (f.dim ? '#8c7236' : GOLD[2]) : (f.dim ? '#6b2a1e' : GOLD[0]);
          ctx.lineWidth = Math.max(0.7, g.u * 0.2);
          ctx.beginPath();
          ctx.moveTo(c0[0], c0[1]);
          ctx.lineTo(c0[0] + Math.cos(ang) * bl * 0.9 + 0 * e0[0], c0[1] + Math.sin(ang) * bl * 0.9);
          ctx.stroke();
        }
      }
    }
    // spine
    ctx.strokeStyle = f.dim ? '#a98a3c' : GOLD[2];
    ctx.lineWidth = Math.max(0.8, g.u * 0.28);
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const p = T(pts[i].x, pts[i].y);
      if (i === i0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    // gilded eye
    const ie = Math.round(STEPS * 0.7);
    if (ie >= i0 && ie <= i1) {
      const p = pts[ie];
      const c = T(p.x, p.y);
      const rx = p.w * 1.7;
      const ry = p.w * 1.1;
      const rings = [[1, GOLD[2]], [0.78, RED[1]], [0.58, '#27305a'], [0.4, GOLD[1]], [0.22, RED[0]]];
      for (let k = 0; k < rings.length; k++) {
        ctx.fillStyle = f.dim && k === 0 ? GOLD[0] : rings[k][1];
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], rx * rings[k][0], ry * rings[k][0], p.th - rot, 0, TAU);
        ctx.fill();
      }
    }
  }

  function bakeFeather(g, f) {
    const pts = spine(g, f);
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      minx = Math.min(minx, p.x - p.w * 1.6); maxx = Math.max(maxx, p.x + p.w * 1.6);
      miny = Math.min(miny, p.y - p.w * 1.6); maxy = Math.max(maxy, p.y + p.w * 1.6);
    }
    const pad = 3;
    const per = STEPS / PIECES;
    const pieces = [];
    for (let j = 0; j < PIECES; j++) {
      const i0 = Math.round(j * per);
      const i1 = Math.min(STEPS, Math.round((j + 1) * per) + 1);
      // piece frame: origin at joint, x along heading
      const o = pts[i0];
      const R = Math.max(maxx - minx, maxy - miny);
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      const cs = Math.cos(-o.th);
      const sn = Math.sin(-o.th);
      for (let i = i0; i <= i1; i++) {
        const q = [(pts[i].x - o.x) * cs - (pts[i].y - o.y) * sn, (pts[i].x - o.x) * sn + (pts[i].y - o.y) * cs];
        const m = pts[i].w * 1.6 + pad;
        bx0 = Math.min(bx0, q[0] - m); bx1 = Math.max(bx1, q[0] + m);
        by0 = Math.min(by0, q[1] - m); by1 = Math.max(by1, q[1] + m);
      }
      const c = layer(bx1 - bx0, by1 - by0);
      const ctx = c.getContext('2d');
      ctx.translate(-bx0, -by0);
      ctx.lineCap = 'round';
      paintPiece(ctx, pts, i0, i1, o.x, o.y, o.th, f, g);
      const e = pts[Math.min(STEPS, Math.round((j + 1) * per))];
      const ex = (e.x - o.x) * cs - (e.y - o.y) * sn;
      const ey = (e.x - o.x) * sn + (e.y - o.y) * cs;
      pieces.push({ c, px: -bx0, py: -by0, ex, ey, dth: e.th - o.th });
      void R;
    }
    return pieces;
  }

  function makeFeathers(g, rand) {
    const defs = [
      // base x, base y, heading, length, width, sway, freq, curl, dim
      [0.16, 1.04, -1.2, 0.8, 4.6, 0.5, 0.9, 5.2, true],
      [0.24, 1.05, -0.95, 1.0, 6.2, 0.55, 1.0, -5.4, false],
      [0.34, 1.06, -0.62, 1.0, 7.0, 0.5, 0.8, 5.6, false],
      [0.44, 1.06, -0.38, 1.0, 6.6, 0.5, 1.0, -5.2, false],
      [0.56, 1.06, -0.2, 0.85, 5.2, 0.45, 0.9, 5.0, true],
      [0.1, 1.0, -1.45, 0.7, 4.2, 0.5, 1.2, -4.8, true],
    ];

    return defs.map((d, i) => {
      const f = {
        th0: d[2], len: g.len * d[3], wid: g.u * d[4], sway: d[5], freq: d[6], curl: d[7], dim: d[8],
        ph: rand() * TAU,
      };
      return {
        x: g.W * d[0], y: g.H * d[1], pieces: bakeFeather(g, f),
        th0: f.th0, ph: f.ph, spd: 0.32 + 0.08 * i, dim: f.dim,
      };
    });
  }

  function makeMotes(g, rand) {
    const m = { x: new Float32Array(MOTES), y: new Float32Array(MOTES), p: new Float32Array(MOTES), v: new Float32Array(MOTES) };
    for (let i = 0; i < MOTES; i++) { m.x[i] = g.W * (0.1 + rand() * 0.85); m.y[i] = g.H * rand(); m.p[i] = rand() * TAU; m.v[i] = g.u * (0.8 + rand() * 1.2); }
    return m;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.ground = paintGround(g, rand);
    state.feathers = makeFeathers(g, rand);
    state.motes = makeMotes(g, rand);
  }

  function drawFeather(ctx, f, t, flow, g) {
    let x = f.x;
    let y = f.y;
    let th = f.th0 + Math.sin(t * f.spd * 0.6 + f.ph) * 0.05 * flow;
    for (let j = 0; j < f.pieces.length; j++) {
      const p = f.pieces[j];
      const wave = Math.sin(t * f.spd * 1.5 - j * 0.8 + f.ph) * 0.1 * flow * (0.4 + j * 0.25);
      ctx.setTransform(Math.cos(th + wave), Math.sin(th + wave), -Math.sin(th + wave), Math.cos(th + wave), x, y);
      ctx.drawImage(p.c, -p.px, -p.py);
      const a = th + wave;
      x += p.ex * Math.cos(a) - p.ey * Math.sin(a);
      y += p.ex * Math.sin(a) + p.ey * Math.cos(a);
      th = a + p.dth;
    }
    void g;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { flow, dust } = api.props;
    ctx.drawImage(state.ground, 0, 0);
    const list = state.feathers;
    for (let i = 0; i < list.length; i++) drawFeather(ctx, list[i], t, flow, g);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const m = state.motes;
    const n = Math.min(MOTES, Math.round(MOTES * dust * 0.6 + 0.4));
    ctx.fillStyle = '#d9b860';
    for (let i = 0; i < n; i++) {
      m.y[i] -= m.v[i] * dt;
      if (m.y[i] < -2) m.y[i] = g.H + 2;
      const x = m.x[i] + Math.sin(t * 0.5 + m.p[i]) * g.u * 2;
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 0.9 + m.p[i]);
      ctx.fillRect(x, m.y[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { flow: 1, dust: 1, ramp: 'lines', cell: 7, boost: 0.3, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
