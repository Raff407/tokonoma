/*
 * 凤凰 Fenghuang — long phoenix tail plumes on a dark ground.
 *
 * The plumes sweep up out of the lower-left corner and arc across the frame,
 * as if the bird has just passed out of view. Each plume is a thin gold shaft
 * with fine barbs fanning off both sides toward the tip, ragged and parted in
 * the lower length, filling into a broad vane round a gilded eye, then a
 * curling wisp. Plumes are baked once in a few linked pieces; every frame the
 * pieces are chained with a small travelling bend so they ripple like silk.
 * The ground, a low sun and cloud scrolls are baked once. Gold motes drift.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const PIECES = 6;
  const STEPS = 160;
  const EYE_S = 0.84;
  const MOTES = 16;
  const state = {};

  const GROUND = ['#0b0d16', '#11142a', '#1a1e3c'];
  const RED = ['#7e2418', '#b8381f', '#d6452c'];
  const GOLD = ['#a98a3c', '#c9a24a', '#e8c96e'];
  const INDIGO = '#26305e';
  const CLOUD = '#4b5590';

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function mix(a, b, t) { return K.toHex(K.mixColor(K.parseColor(a), K.parseColor(b), t)); }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const u = H / 100;
    return { W, H, u, len: Math.hypot(W, H) * 0.78 };
  }

  // ---- ground, sun and clouds ----------------------------------------------

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

  function cloud(ctx, x, y, r) {
    scroll(ctx, x, y, r, 1.5);
    scroll(ctx, x + r * 1.75, y + r * 0.35, r * 0.75, 1.4);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9, y + r * 0.9);
    ctx.quadraticCurveTo(x + r * 1.2, y + r * 1.6, x + r * 4.2, y + r * 1.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.95, y + r * 0.3);
    ctx.quadraticCurveTo(x - r * 2.6, y + r * 1.1, x - r * 4.5, y + r * 0.9);
    ctx.stroke();
  }

  function paintGround(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(g.W, 0, g.W * 0.2, g.H);
    gr.addColorStop(0, GROUND[2]);
    gr.addColorStop(0.55, GROUND[1]);
    gr.addColorStop(1, GROUND[0]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);

    // low red-gold sun the plumes reach toward
    const sx = g.W * 0.8;
    const sy = g.H * 0.27;
    const sr = g.u * 13;
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 2.6);
    halo.addColorStop(0, 'rgba(184,56,31,0.22)');
    halo.addColorStop(1, 'rgba(184,56,31,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#5e1f1a';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a3a22';
    ctx.lineWidth = Math.max(1, g.u * 0.5);
    ctx.stroke();

    ctx.strokeStyle = CLOUD;
    ctx.lineWidth = Math.max(1, g.u * 0.55);
    ctx.lineCap = 'round';
    const spots = [[0.66, 0.14, 4.2], [0.9, 0.42, 3.6], [0.42, 0.1, 3.4], [0.93, 0.8, 3.2]];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      cloud(ctx, g.W * s[0], g.H * s[1], g.u * s[2]);
    }
    return c;
  }

  // ---- plume ---------------------------------------------------------------

  // Half-width of the vane at s along the plume.
  function vane(f, s) {
    if (s < EYE_S) {
      const t = s / EYE_S;
      return f.wid * (0.22 + 0.78 * Math.pow(t, 1.6)) * Math.min(1, s / 0.03);
    }
    const t = (s - EYE_S) / (1 - EYE_S);
    return f.wid * Math.max(0.12, Math.cos(t * Math.PI * 0.5) * (1.1 - 0.6 * t));
  }

  function spine(f) {
    const pts = [];
    let x = 0;
    let y = 0;
    const step = f.len / STEPS;
    for (let i = 0; i <= STEPS; i++) {
      const s = i / STEPS;
      const curl = s > 0.9 ? Math.pow((s - 0.9) / 0.1, 2) * f.curl : 0;
      const th = f.th0 + f.arc * s + Math.sin(s * TAU * f.freq + f.ph) * f.sway + curl;
      pts.push({ x, y, th, w: vane(f, s) });
      x += Math.cos(th) * step;
      y += Math.sin(th) * step;
    }
    return pts;
  }

  // Fine barbs off both sides of the shaft, swept toward the tip.
  function paintBarbs(ctx, pts, i0, i1, f, g, T) {
    const rand = f.rand;
    ctx.lineWidth = Math.max(0.6, g.u * 0.26);
    for (let i = i0; i < i1; i++) {
      const p = pts[i];
      const s = i / STEPS;
      for (let side = -1; side <= 1; side += 2) {
        if (rand() > 0.35 + 0.65 * Math.min(1, s * 1.6)) continue; // parted lower length
        const sweep = 0.42 + 0.5 * Math.min(1, s / EYE_S);
        const a = p.th + side * sweep;
        const ln = p.w * (0.7 + rand() * 0.45) / Math.sin(sweep);
        const ex = p.x + Math.cos(a) * ln;
        const ey = p.y + Math.sin(a) * ln;
        const bend = ln * 0.25;
        const cx = p.x + Math.cos(a) * ln * 0.5 + Math.cos(p.th) * bend;
        const cy = p.y + Math.sin(a) * ln * 0.5 + Math.sin(p.th) * bend;
        const warm = 0.5 + 0.5 * Math.sin(s * 11 + f.ph + side);
        ctx.strokeStyle = rand() < 0.22 ? GOLD[1] : mix(RED[2], '#e86a48', warm);
        const q0 = T(p.x, p.y);
        const q1 = T(cx, cy);
        const q2 = T(ex, ey);
        ctx.beginPath();
        ctx.moveTo(q0[0], q0[1]);
        ctx.quadraticCurveTo(q1[0], q1[1], q2[0], q2[1]);
        ctx.stroke();
        if (rand() < 0.5) {
          // gold fringe at the barb tip
          ctx.strokeStyle = GOLD[2];
          const q3 = T(p.x + Math.cos(a) * ln * 0.78 + Math.cos(p.th) * bend * 0.6,
            p.y + Math.sin(a) * ln * 0.78 + Math.sin(p.th) * bend * 0.6);
          ctx.beginPath();
          ctx.moveTo(q3[0], q3[1]);
          ctx.lineTo(q2[0], q2[1]);
          ctx.stroke();
        }
      }
    }
  }

  function paintShaft(ctx, pts, i0, i1, g, T) {
    ctx.strokeStyle = GOLD[2];
    ctx.lineWidth = Math.max(0.8, g.u * 0.38);
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const p = T(pts[i].x, pts[i].y);
      if (i === i0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }

  function paintEye(ctx, pts, i0, i1, rot, T) {
    const ie = Math.round(STEPS * EYE_S);
    if (ie < i0 || ie > i1) return;
    const p = pts[ie];
    const c = T(p.x, p.y);
    const rx = p.w * 0.95;
    const ry = p.w * 0.7;
    const rings = [[1, GOLD[2]], [0.8, RED[2]], [0.6, INDIGO], [0.38, GOLD[1]], [0.18, RED[0]]];
    for (let k = 0; k < rings.length; k++) {
      ctx.fillStyle = rings[k][1];
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], rx * rings[k][0], ry * rings[k][0], p.th - rot, 0, TAU);
      ctx.fill();
    }
  }

  function paintPiece(ctx, pts, i0, i1, ox, oy, rot, f, g) {
    const cs = Math.cos(-rot);
    const sn = Math.sin(-rot);
    const T = (px, py) => [(px - ox) * cs - (py - oy) * sn, (px - ox) * sn + (py - oy) * cs];
    ctx.globalAlpha = f.value;
    paintBarbs(ctx, pts, i0, i1, f, g, T);
    paintShaft(ctx, pts, i0, i1, g, T);
    paintEye(ctx, pts, i0, i1, rot, T);
    ctx.globalAlpha = 1;
  }

  function bakeFeather(g, f) {
    const pts = spine(f);
    const per = STEPS / PIECES;
    const pieces = [];
    for (let j = 0; j < PIECES; j++) {
      const i0 = Math.round(j * per);
      const i1 = Math.min(STEPS, Math.round((j + 1) * per) + 1);
      const o = pts[i0];
      const cs = Math.cos(-o.th);
      const sn = Math.sin(-o.th);
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (let i = i0; i <= i1; i++) {
        const q0 = (pts[i].x - o.x) * cs - (pts[i].y - o.y) * sn;
        const q1 = (pts[i].x - o.x) * sn + (pts[i].y - o.y) * cs;
        const m = pts[i].w * 2.4 + 3;
        bx0 = Math.min(bx0, q0 - m); bx1 = Math.max(bx1, q0 + m);
        by0 = Math.min(by0, q1 - m); by1 = Math.max(by1, q1 + m);
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
    }
    return pieces;
  }

  function makeFeathers(g, rand) {
    // base x, base y, heading, arc, length, width, sway, curl, value (back plumes first)
    const defs = [
      [0.02, 1.04, -1.5, 0.6, 0.62, 5.5, 0.08, -2.2, 0.55],
      [0.22, 1.12, -0.22, 0.35, 0.5, 5.5, 0.07, 2.4, 0.55],
      [0.0, 1.06, -1.3, 0.95, 0.9, 7.0, 0.09, 2.6, 1],
      [0.03, 1.08, -1.04, 1.0, 1.0, 7.6, 0.08, -2.4, 1],
      [0.05, 1.1, -0.8, 0.95, 0.96, 7.2, 0.08, 2.6, 1],
      [0.08, 1.12, -0.6, 0.62, 0.84, 6.4, 0.07, -2.4, 1],
    ];
    return defs.map((d, i) => {
      const f = {
        th0: d[2], arc: d[3], len: g.len * d[4], wid: g.u * d[5], sway: d[6], freq: 1.1,
        curl: d[7], value: d[8], ph: rand() * TAU, rand: K.rng(1000 + i * 7919),
      };
      return {
        x: g.W * d[0], y: g.H * d[1], pieces: bakeFeather(g, f),
        th0: f.th0, ph: f.ph, spd: 0.3 + 0.06 * i,
      };
    });
  }

  function makeMotes(g, rand) {
    const m = { x: new Float32Array(MOTES), y: new Float32Array(MOTES), p: new Float32Array(MOTES), v: new Float32Array(MOTES) };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = g.W * (0.1 + rand() * 0.85);
      m.y[i] = g.H * rand();
      m.p[i] = rand() * TAU;
      m.v[i] = g.u * (0.8 + rand() * 1.2);
    }
    return m;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.ground = paintGround(g);
    state.feathers = makeFeathers(g, rand);
    state.motes = makeMotes(g, rand);
  }

  function drawFeather(ctx, f, t, flow) {
    let x = f.x;
    let y = f.y;
    let th = f.th0 + Math.sin(t * f.spd * 0.6 + f.ph) * 0.03 * flow;
    for (let j = 0; j < f.pieces.length; j++) {
      const p = f.pieces[j];
      const a = th + Math.sin(t * f.spd * 1.4 - j * 0.8 + f.ph) * 0.045 * flow * (0.4 + j * 0.25);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ctx.setTransform(ca, sa, -sa, ca, x, y);
      ctx.drawImage(p.c, -p.px, -p.py);
      x += p.ex * ca - p.ey * sa;
      y += p.ex * sa + p.ey * ca;
      th = a + p.dth;
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { flow, dust } = api.props;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(state.ground, 0, 0);
    const list = state.feathers;
    for (let i = 0; i < list.length; i++) drawFeather(ctx, list[i], t, flow);
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
