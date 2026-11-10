/*
 * 笔墨 Bimo — a brush dips into an ink stone and paints bamboo on washi paper.
 *
 * The paper and ink stone are baked once. Ink lives on its own layer that only ever gains
 * a few round stamps per frame at the brush tip. A cycle is a timeline of events (move,
 * stroke, dip, seal); when it ends the ink fades and a fresh arrangement is planned.
 */
(function () {
  'use strict';

  const K = KasuriCore;

  const TAU = Math.PI * 2;
  const PAPER = '#e4dcc6';
  const INKS = ['#2b2f31', '#4b5357', '#7b8286', '#4d5b42', '#3a4252'];
  const SEAL = '#b8412b';
  const HOLD = 9;
  const FADE = 6;
  const state = { clock: 0, idx: 0, pi: 0, cycle: 0, evs: [], key: '' };

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = Math.max(0.6, H / 100);
    return { W, H, U, sx: W * 0.9, sy: H * 0.9 };
  }

  // ---- paper and ink stone ------------------------------------------------

  function paintPaper(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const base = K.parseColor(PAPER);
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    for (let i = 0; i < g.W * g.H; i++) {
      const j = 1 + (rand() - 0.5) * 0.045;
      d[i * 4] = base[0] * j;
      d[i * 4 + 1] = base[1] * j;
      d[i * 4 + 2] = base[2] * j;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(255,250,235,0.35)' : 'rgba(150,135,105,0.18)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 7, y + (rand() - 0.5) * g.U * 3);
      ctx.stroke();
    }
    const v = ctx.createRadialGradient(g.W / 2, g.H / 2, g.H * 0.4, g.W / 2, g.H / 2, g.W * 0.62);
    v.addColorStop(0, 'rgba(160,140,100,0)');
    v.addColorStop(1, 'rgba(160,140,100,0.3)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, g.W, g.H);
    stone(ctx, g);
    return c;
  }

  function stone(ctx, g) {
    const u = g.U;
    const x = g.sx;
    const y = g.sy;
    ctx.fillStyle = 'rgba(60,50,40,0.25)';
    ctx.fillRect(x - u * 8.5, y - u * 3.6, u * 17, u * 8.4);
    ctx.fillStyle = '#323744';
    ctx.fillRect(x - u * 8, y - u * 4, u * 16, u * 8);
    ctx.fillStyle = '#464c5a';
    ctx.fillRect(x - u * 8, y - u * 4, u * 16, Math.max(1, u * 0.7));
    ctx.fillStyle = '#c4a24e';
    ctx.fillRect(x - u * 8, y + u * 3.2, u * 16, Math.max(1, u * 0.5));
    ctx.fillStyle = '#1d1f22';
    ctx.beginPath();
    ctx.ellipse(x - u * 1.5, y - u * 0.3, u * 5.2, u * 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#34393d';
    ctx.beginPath();
    ctx.ellipse(x - u * 3, y - u * 1.1, u * 1.8, u * 0.6, 0, 0, TAU);
    ctx.fill();
  }

  // ---- planning a cycle ---------------------------------------------------

  function planner(g, rand, props) {
    const U = g.U;
    const evs = [];
    let t = 0;
    let lx = g.sx - U * 1.5;
    let ly = g.sy - U * 0.3;

    function add(ev) {
      ev.t0 = t;
      t += ev.dur;
      ev.t1 = t;
      evs.push(ev);
    }

    function move(tx, ty, slow) {
      const dist = Math.hypot(tx - lx, ty - ly);
      const dur = Math.max(0.15, Math.min(1.0, dist / (U * (slow ? 45 : 70))));
      add({ k: 0, dur, ax: lx, ay: ly, bx: tx, by: ty, st: null });
      lx = tx;
      ly = ty;
    }

    function dip() {
      move(g.sx - U * 1.5, g.sy - U * 0.3, true);
      add({ k: 2, dur: 0.7, ax: lx, ay: ly, bx: lx, by: ly, st: null });
    }

    function stroke(xs, ys, rs, col, dur) {
      move(xs[0], ys[0], false);
      const n = xs.length;
      add({ k: 1, dur, ax: xs[0], ay: ys[0], bx: xs[n - 1], by: ys[n - 1], st: { xs, ys, rs, n, col } });
      lx = xs[n - 1];
      ly = ys[n - 1];
    }

    return { evs, add, move, dip, stroke, now: () => t };
  }

  function leaf(plan, rand, g, px, py, ang, len, rmax, col) {
    const n = Math.ceil(len * 1.4);
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const rs = new Float32Array(n);
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const bend = (rand() - 0.3) * 0.18 * len;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      xs[i] = px + dx * len * s - dy * bend * s * s;
      ys[i] = py + dy * len * s + dx * bend * s * s + len * 0.16 * s * s;
      rs[i] = 0.3 + rmax * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.9);
    }
    plan.stroke(xs, ys, rs, col, 0.22 + len / (g.U * 70));
  }

  function fan(plan, rand, g, px, py, side, count, up, scale, col) {
    const U = g.U;
    for (let i = 0; i < count; i++) {
      const th = up
        ? -(0.25 + rand() * 0.9)
        : 0.2 + (i / Math.max(1, count - 1)) * 1.1 + (rand() - 0.5) * 0.3;
      const ang = side > 0 ? th : Math.PI - th;
      const len = U * (14 + rand() * 7) * scale;
      leaf(plan, rand, g, px, py, ang, len, U * (0.5 + rand() * 0.25) * scale, col);
    }
  }

  function line(plan, g, x0, y0, x1, y1, bow, r0, r1, col, dur) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(3, Math.ceil(len * 1.3));
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const rs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const b = Math.sin(Math.PI * s) * bow;
      xs[i] = x0 + (x1 - x0) * s + b;
      ys[i] = y0 + (y1 - y0) * s;
      rs[i] = r0 + (r1 - r0) * s;
    }
    plan.stroke(xs, ys, rs, col, dur);
  }

  function makeStalk(g, rand, i, count) {
    const f = 0.55 + rand() * 0.45;
    const x0 = g.W * (0.14 + 0.64 * (i + 0.5) / count) + (rand() - 0.5) * g.U * 7;
    const lean = (rand() - 0.5) * g.U * 14;
    const top = g.H * (0.1 + rand() * 0.22) + (1 - f) * g.H * 0.2;
    const r = g.U * (1.0 + 1.0 * f);
    const col = f > 0.8 ? 0 : 1;
    const nodes = [];
    let y = g.H + g.U * 2;
    let step = g.H * (0.15 + 0.07 * rand());
    while (y > top) {
      nodes.push(y);
      y -= step;
      step *= 0.93;
    }
    nodes.push(Math.max(top, y));
    const xAt = (yy) => x0 + lean * Math.pow(Math.max(0, (g.H - yy) / g.H), 1.4);
    return { f, r, col, nodes, xAt, x0, top };
  }

  function stalkSegments(plan, rand, g, s) {
    const U = g.U;
    const gap = U * 0.8;
    for (let k = 0; k + 1 < s.nodes.length; k++) {
      const ya = s.nodes[k] - (k ? gap : 0);
      const yb = s.nodes[k + 1] + gap;
      const len = ya - yb;
      const n = Math.max(4, Math.ceil(len * 1.2));
      const xs = new Float32Array(n);
      const ys = new Float32Array(n);
      const rs = new Float32Array(n);
      const rr = s.r * (1 - 0.3 * (k / s.nodes.length));
      for (let i = 0; i < n; i++) {
        const q = i / (n - 1);
        ys[i] = ya - len * q;
        xs[i] = s.xAt(ys[i]) + Math.sin(q * Math.PI) * U * 0.25;
        rs[i] = rr * (0.92 + 0.12 * Math.sin(Math.PI * q));
      }
      plan.stroke(xs, ys, rs, s.col, 0.4 + len / (U * 30));
      if (k + 2 < s.nodes.length) {
        const yn = s.nodes[k + 1];
        const xn = s.xAt(yn);
        line(plan, g, xn - rr * 1.25, yn, xn + rr * 1.25, yn, 0, 0.7, 0.7, 0, 0.18);
      }
    }
  }

  function foliage(plan, rand, g, s, amount) {
    const U = g.U;
    const scale = 0.7 + 0.3 * s.f;
    const leafCol = s.f > 0.8 ? 0 : (rand() < 0.5 ? 1 : 3);
    let side = rand() < 0.5 ? 1 : -1;
    for (let k = 2; k + 1 < s.nodes.length; k += 1) {
      if (rand() > 0.85 * amount + 0.15) continue;
      const y = s.nodes[k];
      const x = s.xAt(y);
      const up = 0.45 + rand() * 0.5;
      const len = U * (9 + rand() * 9) * scale;
      const ex = x + side * Math.sin(up) * len;
      const ey = y - Math.cos(up) * len * 0.8;
      line(plan, g, x, y, ex, ey, side * U * 0.8, U * 0.55, U * 0.3, 1, 0.45);
      const mx = (x + ex) / 2 + side * U * 0.4;
      const my = (y + ey) / 2;
      if (rand() < 0.7) fan(plan, rand, g, mx, my, side, 3, false, scale * 0.9, leafCol);
      fan(plan, rand, g, ex, ey, side, 4 + (rand() < 0.4 ? 1 : 0), false, scale, leafCol);
      side = -side;
      if (k % 2 === 0) plan.dip();
    }
    const tx = s.xAt(s.nodes[s.nodes.length - 1]);
    const ty = s.nodes[s.nodes.length - 1];
    fan(plan, rand, g, tx, ty, -1, 2, true, scale, leafCol);
    fan(plan, rand, g, tx, ty, 1, 3, true, scale, leafCol);
    plan.dip();
  }

  function seal(plan, g) {
    const u = g.U * 5;
    const x = g.W * 0.07;
    const y = g.H * 0.74;
    plan.move(x + u, y, false);
    plan.add({ k: 3, dur: 0.6, ax: x, ay: y, bx: u, by: u, st: null });
  }

  function layout(g, props) {
    const rand = K.rng(((state.cycle + 1) * 7919) ^ 0x5eed);
    const plan = planner(g, rand, props);
    const count = Math.max(1, Math.round(props.stalks));
    const stalks = [];
    for (let i = 0; i < count; i++) stalks.push(makeStalk(g, rand, i, count));
    stalks.sort((a, b) => a.f - b.f);
    for (let i = 0; i < count; i++) {
      if (i) plan.dip();
      stalkSegments(plan, rand, g, stalks[i]);
      plan.dip();
      foliage(plan, rand, g, stalks[i], props.leaves);
    }
    seal(plan, g);
    plan.move(g.sx - g.U * 1.5, g.sy - g.U * 0.3, true);
    state.evs = plan.evs;
    state.endBuild = plan.now();
  }

  // ---- painting -----------------------------------------------------------

  function paintStroke(ev, upto) {
    const st = ev.st;
    const ctx = state.inkCtx;
    ctx.fillStyle = INKS[st.col];
    const last = Math.min(upto, st.n - 1);
    for (let i = state.pi; i <= last; i++) {
      ctx.beginPath();
      ctx.arc(st.xs[i], st.ys[i], st.rs[i], 0, TAU);
      ctx.fill();
    }
    state.pi = last + 1;
  }

  function paintSeal(ev) {
    const ctx = state.inkCtx;
    const g = state.g;
    const w = ev.bx;
    ctx.fillStyle = SEAL;
    ctx.fillRect(ev.ax, ev.ay, w, w);
    ctx.fillStyle = PAPER;
    const t = Math.max(1, g.U * 0.5);
    ctx.fillRect(ev.ax + t * 1.2, ev.ay + t * 1.2, w - t * 2.4, t);
    ctx.fillRect(ev.ax + t * 1.2, ev.ay + w - t * 2.2, w - t * 2.4, t);
    ctx.fillRect(ev.ax + t * 1.2, ev.ay + t * 1.2, t, w - t * 2.4);
    ctx.fillRect(ev.ax + w - t * 2.2, ev.ay + t * 1.2, t, w - t * 2.4);
    ctx.fillRect(ev.ax + w * 0.46, ev.ay + w * 0.3, t, w * 0.4);
  }

  function finish(ev) {
    if (ev.k === 1) paintStroke(ev, ev.st.n - 1);
    else if (ev.k === 3) paintSeal(ev);
    state.pi = 0;
  }

  function drawBrush(ctx, g, x, y) {
    const u = g.U;
    const dx = 0.42;
    const dy = -0.91;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8c7b4a';
    ctx.lineWidth = Math.max(1.5, u * 1.5);
    ctx.beginPath();
    ctx.moveTo(x + dx * u * 5, y + dy * u * 5);
    ctx.lineTo(x + dx * u * 24, y + dy * u * 24);
    ctx.stroke();
    ctx.strokeStyle = '#c4a24e';
    ctx.lineWidth = Math.max(1.5, u * 1.8);
    ctx.beginPath();
    ctx.moveTo(x + dx * u * 3.4, y + dy * u * 3.4);
    ctx.lineTo(x + dx * u * 5, y + dy * u * 5);
    ctx.stroke();
    ctx.strokeStyle = '#25282b';
    ctx.lineWidth = Math.max(2, u * 2.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * u * 3.4, y + dy * u * 3.4);
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.paper = paintPaper(g, K.rng(api.seed));
    state.ink = layer(g.W, g.H);
    state.inkCtx = state.ink.getContext('2d');
    state.key = '';
  }

  function restart(api) {
    state.inkCtx.clearRect(0, 0, state.g.W, state.g.H);
    state.clock = 0;
    state.idx = 0;
    state.pi = 0;
    layout(state.g, api.props);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const key = props.stalks + ':' + props.leaves;
    if (key !== state.key) {
      state.key = key;
      restart(api);
    }
    state.clock += Math.min(dt, 0.1);
    const c = state.clock;
    const evs = state.evs;
    while (state.idx < evs.length && evs[state.idx].t1 <= c) {
      finish(evs[state.idx]);
      state.idx++;
    }
    let bx = g.sx - g.U * 1.5;
    let by = g.sy - g.U * 0.3;
    if (state.idx < evs.length) {
      const ev = evs[state.idx];
      const u = Math.max(0, Math.min(1, (c - ev.t0) / (ev.t1 - ev.t0)));
      const e = u * u * (3 - 2 * u);
      if (ev.k === 1) {
        const at = Math.floor(e * (ev.st.n - 1));
        paintStroke(ev, at);
        bx = ev.st.xs[at];
        by = ev.st.ys[at];
      } else if (ev.k === 2) {
        bx = ev.ax;
        by = ev.ay + Math.sin(u * Math.PI * 2) * g.U * 1.2;
      } else {
        bx = ev.ax + (ev.bx - ev.ax) * e;
        by = ev.ay + (ev.by - ev.ay) * e - (ev.k === 0 ? Math.sin(Math.PI * e) * g.U * 2 : 0);
      }
    }
    ctx.drawImage(state.paper, 0, 0);
    const over = c - state.endBuild - HOLD;
    ctx.globalAlpha = over > 0 ? Math.max(0, 1 - over / FADE) : 1;
    ctx.drawImage(state.ink, 0, 0);
    ctx.globalAlpha = 1;
    if (props.brush !== false) drawBrush(ctx, g, bx, by);
    if (over > FADE) {
      state.cycle++;
      restart(api);
    }
  }

  Kasuri.run({
    defaults: { stalks: 3, leaves: 1, brush: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
