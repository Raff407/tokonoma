/*
 * 紙漉き Kamisuki — a washi workshop: a wooden vat of pale pulp, a bamboo screen hung on
 * cords that dips and lifts, steam and soft shoji light.
 *
 * Wall, window, boards, vat and light are baked once. Per frame: the pulp surface layer,
 * a short pool of fibre strokes circling two eddies, the screen (one polygon, a few slats),
 * ripple rings, drips, a few steam puffs and dust motes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep } = K;
  const TAU = Math.PI * 2;

  const PERIOD = 11;
  const FIBRES = 64;
  const PUFFS = 14;
  const MOTES = 18;
  const DRIPS = 5;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
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
    const vl = W * 0.12;
    const vr = W * 0.88;
    return {
      W, H, U, vl, vr,
      backY: H * 0.6,
      frontY: H * 0.76,
      inset: W * 0.035,
      rim: Math.max(1, H * 0.022),
      cx: W * 0.5,
    };
  }

  // ---- wall, window, boards -------------------------------------------------

  function paintWall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { W, H, U } = g;
    ctx.fillStyle = '#3a3029';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H * 0.05; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#43382f' : '#30271f';
      ctx.fillRect(rand() * W, rand() * H * 0.65, 1 + rand() * 2, 1);
    }
    // posts and beam
    ctx.fillStyle = '#241c16';
    ctx.fillRect(0, 0, W, H * 0.07);
    ctx.fillStyle = '#4a3a2c';
    ctx.fillRect(0, H * 0.07, W, Math.max(1, U * 0.5));
    for (const px of [0.015, 0.61, 0.975]) {
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(W * px - U * 1.8, 0, U * 3.6, H * 0.64);
      ctx.fillStyle = '#4a3a2c';
      ctx.fillRect(W * px - U * 1.8, 0, Math.max(1, U * 0.5), H * 0.64);
    }
    // wainscot planks
    ctx.fillStyle = '#2c231b';
    ctx.fillRect(0, H * 0.5, W, H * 0.14);
    ctx.strokeStyle = '#4a3a2c';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += U * 4.5) {
      ctx.beginPath();
      ctx.moveTo(x, H * 0.5);
      ctx.lineTo(x, H * 0.64);
      ctx.stroke();
    }
    ctx.fillStyle = '#5a4634';
    ctx.fillRect(0, H * 0.5, W, Math.max(1, U * 0.6));
    return c;
  }

  function paintWindow(ctx, g, rand) {
    const { W, H, U } = g;
    const x0 = W * 0.2;
    const x1 = W * 0.54;
    const y0 = H * 0.13;
    const y1 = H * 0.5;
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x0 - U * 1.6, y0 - U * 1.6, x1 - x0 + U * 3.2, y1 - y0 + U * 3.2);
    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, '#fbf1d4');
    grad.addColorStop(1, '#ecdcb0');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // bamboo leaf shadows on the paper
    ctx.fillStyle = 'rgba(88,104,72,0.38)';
    for (let i = 0; i < 16; i++) {
      const bx = x0 + (x1 - x0) * (0.55 + rand() * 0.4);
      const by = y0 + (y1 - y0) * (0.05 + rand() * 0.6);
      const a = -0.5 + rand() * 1.0 + (rand() < 0.5 ? 0 : Math.PI);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(U * 3, 0, U * 3.2, U * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(88,104,72,0.38)';
    ctx.lineWidth = Math.max(1, U * 0.4);
    ctx.beginPath();
    ctx.moveTo(x1 - (x1 - x0) * 0.1, y0);
    ctx.lineTo(x1 - (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.7);
    ctx.stroke();
    // kumiko grid
    ctx.strokeStyle = '#3c2e22';
    ctx.lineWidth = Math.max(1, U * 0.55);
    const cols = 5;
    const rows = 7;
    for (let i = 0; i <= cols; i++) {
      const x = x0 + ((x1 - x0) * i) / cols;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = y0 + ((y1 - y0) * j) / rows;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1.5, U * 1.1);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // sill
    ctx.fillStyle = '#5a4634';
    ctx.fillRect(x0 - U * 2.5, y1 + U * 1.4, x1 - x0 + U * 5, U * 1.4);
  }

  function paintBoards(ctx, g) {
    const { W, H, U } = g;
    const bases = [0.74, 0.805, 0.87];
    for (let i = 0; i < bases.length; i++) {
      const lean = U * (7 - i * 1.5);
      const bx = W * bases[i];
      const by = H * 0.62;
      const top = H * (0.14 + i * 0.03);
      const w = W * 0.055;
      ctx.fillStyle = '#7a5c3c';
      poly(ctx, [bx, by, bx + w, by, bx + w + lean, top, bx + lean, top]);
      ctx.fillStyle = '#e8dfc6';
      const ix = U * 0.9;
      poly(ctx, [bx + ix, by - U * 1.2, bx + w - ix, by - U * 1.2, bx + w - ix + lean * 0.98, top + U * 1.6, bx + ix + lean * 0.98, top + U * 1.6]);
      ctx.strokeStyle = '#b9ab88';
      ctx.lineWidth = 1;
      for (let k = 1; k < 5; k++) {
        const f = k / 5;
        const y = lerp(by, top, f);
        ctx.beginPath();
        ctx.moveTo(bx + ix + lean * f, y);
        ctx.lineTo(bx + w - ix + lean * f, y);
        ctx.stroke();
      }
    }
  }

  function paintCloth(ctx, g) {
    const { W, H, U } = g;
    const x0 = W * 0.065;
    const x1 = W * 0.155;
    const y0 = H * 0.07;
    const y1 = H * 0.46;
    ctx.fillStyle = '#2b3d5e';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#1f2d47';
    ctx.fillRect(x0, y0, (x1 - x0) * 0.08, y1 - y0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.strokeStyle = '#dcd6c0';
    ctx.lineWidth = Math.max(1, U * 0.28);
    const r = U * 3.1;
    for (let row = 0; row * r * 0.5 < y1 - y0 + r; row++) {
      for (let col = -1; col * r * 2 < x1 - x0 + r * 2; col++) {
        const cx = x0 + col * r * 2 + (row % 2 ? r : 0);
        const cy = y0 + row * r * 0.5;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc(cx, cy, (r * k) / 3, Math.PI, 0);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x0 - U * 0.6, y0 - U * 1, x1 - x0 + U * 1.2, U * 1.2);
  }

  function paintBundle(ctx, g, rand) {
    const { W, H, U } = g;
    const bx = W * 0.032;
    ctx.strokeStyle = '#d9cdb0';
    ctx.lineWidth = Math.max(1.5, U * 0.9);
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(bx + i * U * 1.1, H * 0.7);
      ctx.lineTo(bx + U * 2 + i * U * 0.9, H * 0.34 + rand() * U * 3);
      ctx.stroke();
    }
    ctx.strokeStyle = '#6b8456';
    ctx.lineWidth = Math.max(1, U * 0.5);
    ctx.beginPath();
    ctx.moveTo(bx + U * 5, H * 0.52);
    ctx.lineTo(bx + U * 8.6, H * 0.5);
    ctx.stroke();
  }

  function paintLight(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { W, H } = g;
    const x0 = W * 0.2;
    const x1 = W * 0.54;
    const y1 = H * 0.5;
    const drift = W * 0.2;
    ctx.fillStyle = '#f4dc9a';
    const cuts = [0, 0.34, 0.68, 1];
    for (let i = 0; i < 3; i++) {
      const a = x0 + (x1 - x0) * cuts[i] + (x1 - x0) * 0.04;
      const b = x0 + (x1 - x0) * cuts[i + 1] - (x1 - x0) * 0.04;
      ctx.globalAlpha = 0.17;
      poly(ctx, [a, y1, b, y1, b + drift, H * 0.92, a + drift, H * 0.92]);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintBack(g, rand) {
    const c = paintWall(g, rand);
    const ctx = c.getContext('2d');
    paintCloth(ctx, g);
    paintBoards(ctx, g);
    paintBundle(ctx, g, rand);
    paintWindow(ctx, g, rand);
    // floor behind the vat
    ctx.fillStyle = '#231b15';
    ctx.fillRect(0, g.H * 0.64, g.W, g.H * 0.36);
    return c;
  }

  // ---- vat -------------------------------------------------------------------

  function paintWater(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { vl, vr, backY, frontY, inset, rim } = g;
    // inner dark wall of vat behind the surface
    ctx.fillStyle = '#4a3a2b';
    poly(ctx, [vl + inset * 0.5, backY - rim * 2.2, vr - inset * 0.5, backY - rim * 2.2, vr - inset, backY + rim, vl + inset, backY + rim]);
    const grad = ctx.createLinearGradient(0, backY, 0, frontY);
    grad.addColorStop(0, '#a9b8b3');
    grad.addColorStop(1, '#d6dccf');
    ctx.fillStyle = grad;
    poly(ctx, [vl + inset, backY + rim, vr - inset, backY + rim, vr - rim * 0.5, frontY - rim, vl + rim * 0.5, frontY - rim]);
    // still pulp clouds
    for (let i = 0; i < 90; i++) {
      const f = rand();
      const y = lerp(backY + rim * 2, frontY - rim * 2, f);
      const x = lerp(vl + inset * (1 - f) + rim * 2, vr - inset * (1 - f) - rim * 2, rand());
      ctx.fillStyle = rand() < 0.5 ? 'rgba(244,240,224,0.35)' : 'rgba(120,138,138,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y, g.U * (2 + rand() * 5), g.U * (0.4 + rand() * 0.7), 0, 0, TAU);
      ctx.fill();
    }
    return c;
  }

  function paintVatFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { W, H, U, vl, vr, backY, frontY, rim } = g;
    // floor
    ctx.fillStyle = '#231b15';
    ctx.fillRect(0, H * 0.93, W, H * 0.07);
    ctx.fillStyle = '#34281e';
    ctx.fillRect(0, H * 0.93, W, Math.max(1, U * 0.5));
    // vermilion lacquer bucket on the left
    const bx = W * 0.03;
    const bw = W * 0.07;
    ctx.fillStyle = '#9d3322';
    poly(ctx, [bx, H * 0.78, bx + bw, H * 0.78, bx + bw * 0.9, H * 0.93, bx + bw * 0.1, H * 0.93]);
    ctx.fillStyle = '#c4452d';
    poly(ctx, [bx, H * 0.78, bx + bw * 0.4, H * 0.78, bx + bw * 0.34, H * 0.93, bx + bw * 0.1, H * 0.93]);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(bx + bw * 0.05, H * 0.83, bw * 0.9, Math.max(1, U * 0.7));
    ctx.fillRect(bx + bw * 0.12, H * 0.89, bw * 0.76, Math.max(1, U * 0.7));
    ctx.fillStyle = '#e2c260';
    ctx.fillRect(bx, H * 0.775, bw, Math.max(1, U * 0.5));
    // back rim
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(vl, backY - rim * 2.2, vr - vl, rim * 2.2);
    ctx.fillStyle = '#9a7650';
    ctx.fillRect(vl, backY - rim * 2.2, vr - vl, Math.max(1, rim * 0.5));
    // side rims
    ctx.fillStyle = '#6a4c30';
    poly(ctx, [vl, backY - rim * 2.2, vl + g.inset, backY, vl + rim * 0.5, frontY, vl, frontY]);
    poly(ctx, [vr, backY - rim * 2.2, vr - g.inset, backY, vr - rim * 0.5, frontY, vr, frontY]);
    // front rim and face
    ctx.fillStyle = '#a07c54';
    ctx.fillRect(vl, frontY - rim, vr - vl, rim * 1.6);
    ctx.fillStyle = '#5b4129';
    ctx.fillRect(vl, frontY + rim * 0.6, vr - vl, H * 0.93 - frontY - rim * 0.6);
    ctx.strokeStyle = '#3e2c1b';
    ctx.lineWidth = 1;
    for (let x = vl + U * 5; x < vr; x += U * 5) {
      ctx.beginPath();
      ctx.moveTo(x, frontY + rim * 0.6);
      ctx.lineTo(x, H * 0.93);
      ctx.stroke();
    }
    ctx.fillStyle = '#6e5238';
    for (let i = 0; i < 40; i++) ctx.fillRect(vl + rand() * (vr - vl), frontY + rim + rand() * (H * 0.93 - frontY - rim), 1 + rand() * 3, 1);
    ctx.fillStyle = '#26211d';
    const bands = [0.795, 0.9];
    for (const b of bands) ctx.fillRect(vl - 1, H * b - U * 0.7, vr - vl + 2, U * 1.4);
    ctx.fillStyle = '#e2c260';
    for (let x = vl + U * 10; x < vr; x += U * 20) {
      for (const b of bands) ctx.fillRect(x, H * b - U * 0.3, Math.max(1, U * 0.6), Math.max(1, U * 0.6));
    }
    return c;
  }

  // ---- animation pools ---------------------------------------------------------

  function makeFibres(g, rand) {
    const f = { cx: new Float32Array(FIBRES), cy: new Float32Array(FIBRES), rx: new Float32Array(FIBRES), ry: new Float32Array(FIBRES), a: new Float32Array(FIBRES), w: new Float32Array(FIBRES), len: new Float32Array(FIBRES), tone: new Uint8Array(FIBRES) };
    const mid = (g.backY + g.frontY) / 2;
    const centres = [[g.W * 0.36, mid], [g.W * 0.64, mid]];
    for (let i = 0; i < FIBRES; i++) {
      const c = centres[i % 2];
      const r = 0.15 + Math.sqrt(rand()) * 0.85;
      f.cx[i] = c[0];
      f.cy[i] = c[1];
      f.rx[i] = r * g.W * 0.14;
      f.ry[i] = r * (g.frontY - g.backY) * 0.4;
      f.a[i] = rand() * TAU;
      f.w[i] = (0.5 - r * 0.25) * (i % 2 ? -1 : 1);
      f.len[i] = 0.25 + rand() * 0.3;
      f.tone[i] = rand() < 0.7 ? 0 : 1;
    }
    return f;
  }

  function makePuffs(g, rand) {
    const p = { x: new Float32Array(PUFFS), ph: new Float32Array(PUFFS), sp: new Float32Array(PUFFS), sz: new Float32Array(PUFFS), dr: new Float32Array(PUFFS) };
    for (let i = 0; i < PUFFS; i++) {
      p.x[i] = g.vl + g.W * 0.08 + rand() * (g.vr - g.vl - g.W * 0.16);
      p.ph[i] = rand();
      p.sp[i] = 0.05 + rand() * 0.04;
      p.sz[i] = 0.7 + rand() * 0.8;
      p.dr[i] = (rand() - 0.5) * 2;
    }
    return p;
  }

  function makeMotes(g, rand) {
    const m = { x: new Float32Array(MOTES), y: new Float32Array(MOTES), ph: new Float32Array(MOTES) };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = g.W * (0.2 + rand() * 0.55);
      m.y[i] = g.H * (0.2 + rand() * 0.6);
      m.ph[i] = rand() * TAU;
    }
    return m;
  }

  // ---- per frame -------------------------------------------------------------------

  function drawFibres(ctx, g, t, amount) {
    const f = state.fibres;
    const n = Math.round(FIBRES * Math.min(1, amount));
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.lineCap = 'round';
    const tones = ['rgba(246,242,226,0.62)', 'rgba(110,130,132,0.4)'];
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = tones[k];
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (f.tone[i] !== k) continue;
        const a = f.a[i] + t * f.w[i] * amount;
        const a2 = a + f.len[i] * (f.w[i] < 0 ? -1 : 1);
        ctx.moveTo(f.cx[i] + Math.cos(a) * f.rx[i], f.cy[i] + Math.sin(a) * f.ry[i]);
        ctx.lineTo(f.cx[i] + Math.cos(a2) * f.rx[i], f.cy[i] + Math.sin(a2) * f.ry[i]);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function cyclePhase(t, on) {
    if (!on) return 0.75;
    const c = (t / PERIOD) % 1;
    const down = smoothstep(0.08, 0.34, c);
    const up = smoothstep(0.62, 0.9, c);
    return down * (1 - up);
  }

  function screenPoly(g, p) {
    // p = 1 lies in the pulp, p = 0 is lifted and tipped to drain
    const cx = g.cx;
    const hw = g.W * (0.13 - (1 - p) * 0.01);
    const lift = 1 - p;
    const yb = g.backY + (g.frontY - g.backY) * 0.28 - lift * g.H * 0.17;
    const yf = g.backY + (g.frontY - g.backY) * 0.88 - lift * g.H * 0.3;
    const sb = hw * 0.78;
    return [cx - sb, yb, cx + sb, yb, cx + hw, yf, cx - hw, yf];
  }

  function drawScreen(ctx, g, t, p, wob) {
    const q = screenPoly(g, p);
    const { U } = g;
    const dx = Math.sin(t * 0.9) * U * 0.25 * (1 - p);
    // cords up to the beam
    ctx.strokeStyle = '#d9cdb0';
    ctx.lineWidth = Math.max(1, U * 0.35);
    ctx.beginPath();
    ctx.moveTo(q[0] + dx, q[1]);
    ctx.lineTo(g.cx - g.W * 0.03, g.H * 0.075);
    ctx.moveTo(q[2] + dx, q[3]);
    ctx.lineTo(g.cx + g.W * 0.03, g.H * 0.075);
    ctx.stroke();
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(g.cx - g.W * 0.05, g.H * 0.06, g.W * 0.1, U * 1.2);
    // frame
    ctx.fillStyle = '#70512f';
    poly(ctx, [q[0] + dx, q[1], q[2] + dx, q[3], q[4] + dx, q[5], q[6] + dx, q[7]]);
    const k = U * 0.9;
    const ix = [q[0] + k * 1.2, q[1] + k * 0.6, q[2] - k * 1.2, q[3] + k * 0.6, q[4] - k * 1.4, q[5] - k * 0.8, q[6] + k * 1.4, q[7] - k * 0.8];
    // mesh of bamboo slats, wet pulp film on top
    ctx.fillStyle = '#c9b88a';
    poly(ctx, [ix[0] + dx, ix[1], ix[2] + dx, ix[3], ix[4] + dx, ix[5], ix[6] + dx, ix[7]]);
    ctx.fillStyle = 'rgba(240,236,220,' + (0.35 + 0.55 * (1 - p)).toFixed(2) + ')';
    poly(ctx, [ix[0] + dx, ix[1], ix[2] + dx, ix[3], ix[4] + dx, ix[5], ix[6] + dx, ix[7]]);
    ctx.strokeStyle = 'rgba(120,98,60,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 12; i++) {
      const f = i / 12;
      ctx.moveTo(lerp(ix[0], ix[2], f) + dx, lerp(ix[1], ix[3], f));
      ctx.lineTo(lerp(ix[6], ix[4], f) + dx, lerp(ix[7], ix[5], f));
    }
    ctx.stroke();
    // water over the submerged screen
    if (p > 0.02) {
      ctx.fillStyle = 'rgba(190,206,200,' + (p * 0.55).toFixed(2) + ')';
      poly(ctx, [q[0] - 1, q[1] - 1, q[2] + 1, q[3] - 1, q[4] + 1, q[5] + 1, q[6] - 1, q[7] + 1]);
    }
    return q;
  }

  function drawRipples(ctx, g, t, q, on) {
    if (!on) return;
    const c = (t / PERIOD) % 1;
    const age = (c - 0.3) * PERIOD;
    if (age < 0 || age > 7) return;
    const cx = g.cx;
    const cy = (q[1] + q[5]) / 2;
    ctx.strokeStyle = '#f2eedc';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    for (let i = 0; i < 3; i++) {
      const a = age - i * 1.2;
      if (a < 0) continue;
      ctx.globalAlpha = 0.5 * (1 - a / 7);
      ctx.beginPath();
      ctx.ellipse(cx, cy, g.W * (0.14 + a * 0.028), (g.frontY - g.backY) * (0.28 + a * 0.05), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawDrips(ctx, g, t, q, on) {
    if (!on) return;
    const c = (t / PERIOD) % 1;
    if (c < 0.5 || c > 0.92) return;
    const lift = 1 - cyclePhase(t, true);
    if (lift < 0.2) return;
    ctx.fillStyle = 'rgba(226,232,222,0.8)';
    const fall = g.H * 0.2;
    for (let i = 0; i < DRIPS; i++) {
      const x = lerp(q[6], q[4], (i + 0.5) / DRIPS);
      const ph = (t * 0.9 + i * 0.37) % 1;
      const y = q[7] + ph * ph * fall;
      if (y > g.frontY - g.rim) continue;
      ctx.fillRect(x, y, Math.max(1, g.U * 0.35), Math.max(1.5, g.U * 0.9));
    }
  }

  function drawSteam(ctx, g, t, amount) {
    const p = state.puffs;
    const n = Math.round(PUFFS * Math.min(1, amount * 0.8 + 0.2));
    ctx.fillStyle = '#f1ebd8';
    const rise = g.H * 0.4;
    for (let i = 0; i < n; i++) {
      const f = (t * p.sp[i] * amount + p.ph[i]) % 1;
      const env = Math.sin(f * Math.PI);
      const x = p.x[i] + Math.sin(f * 5 + p.ph[i] * 9) * g.U * 2 + p.dr[i] * f * g.U * 6;
      const y = g.backY + (g.frontY - g.backY) * 0.3 - f * rise;
      const r = g.U * p.sz[i] * (3 + f * 7);
      ctx.globalAlpha = 0.2 * env * Math.min(1, amount + 0.3);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r * 0.8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t) {
    const m = state.motes;
    ctx.fillStyle = '#f8e7b0';
    const s = Math.max(1, g.U * 0.5);
    for (let i = 0; i < MOTES; i++) {
      const x = m.x[i] + Math.sin(t * 0.25 + m.ph[i]) * g.U * 4 + t * 0.4 % 1;
      const y = m.y[i] + Math.sin(t * 0.18 + m.ph[i] * 2) * g.U * 3;
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 0.5 + m.ph[i]);
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.light = paintLight(g);
    state.water = paintWater(g, rand);
    state.front = paintVatFront(g, rand);
    state.fibres = makeFibres(g, rand);
    state.puffs = makePuffs(g, rand);
    state.motes = makeMotes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { steam, swirl, dip } = api.props;
    ctx.drawImage(state.back, 0, 0);
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 0.3);
    ctx.drawImage(state.light, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.water, 0, 0);
    drawFibres(ctx, g, t, swirl);
    const on = dip !== false && dip !== 0;
    const p = cyclePhase(t, on);
    const q = drawScreen(ctx, g, t, p, 0);
    drawRipples(ctx, g, t, q, on);
    drawDrips(ctx, g, t, q, on);
    ctx.drawImage(state.front, 0, 0);
    drawSteam(ctx, g, t, steam);
    drawMotes(ctx, g, t);
  }

  Kasuri.run({
    defaults: { steam: 1, swirl: 1, dip: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
