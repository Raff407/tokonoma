/*
 * 月门 Moon Gate — a round gate in a whitewashed garden wall.
 *
 * Gate view, bamboo, wall and ground are baked into layers and repainted once
 * a minute from the clock. Between repaints the bamboo layers rock a little,
 * leaf shadows drift over the plaster, a light patch slides along the path
 * and a few leaves fall.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const WALL_TOP = 0.1;
  const GROUND = 0.9;
  const GATE = { x: 0.5, y: 0.52, r: 0.36 };
  const RETINT_SECONDS = 60;
  const LEAVES = 7;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A slim pointed leaf from (x, y) at angle a.
  function leaf(ctx, x, y, len, a, wid) {
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    const nx = -Math.sin(a) * wid;
    const ny = Math.cos(a) * wid;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + ex) / 2 + nx, (y + ey) / 2 + ny, ex, ey);
    ctx.quadraticCurveTo((x + ex) / 2 - nx, (y + ey) / 2 - ny, x, y);
    ctx.fill();
  }

  // A fan of drooping leaves.
  function spray(ctx, x, y, len, rand, dir) {
    const n = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0.1 : Math.PI - 0.1) + dir * (rand() * 1.3 - 0.2);
      leaf(ctx, x, y, len * (0.7 + rand() * 0.5), a, len * 0.09);
    }
  }

  function stalk(ctx, x, yb, yt, w, body, node, light, rand, U, withLeaves, leafCol) {
    ctx.fillStyle = body;
    ctx.fillRect(x - w / 2, yt, w, yb - yt);
    ctx.fillStyle = light;
    ctx.fillRect(x - w / 2, yt, Math.max(1, w * 0.3), yb - yt);
    const seg = U * (6 + rand() * 3);
    for (let y = yb - seg; y > yt; y -= seg * (0.85 + rand() * 0.3)) {
      ctx.fillStyle = node;
      ctx.fillRect(x - w * 0.62, y, w * 1.24, Math.max(1, U * 0.45));
      if (withLeaves && y < yb - U * 18 && rand() < 0.7) {
        ctx.fillStyle = leafCol;
        spray(ctx, x, y, U * (6 + rand() * 4), rand, rand() < 0.5 ? 1 : -1);
      }
    }
    if (withLeaves) {
      ctx.fillStyle = leafCol;
      spray(ctx, x, yt, U * 8, rand, 1);
      spray(ctx, x, yt, U * 8, rand, -1);
    }
  }

  function dim(c, night, k) {
    return mixColor(c, rgb('#1a2236'), night * k);
  }

  // ---- gate view ---------------------------------------------------------

  function gateGeom(g) {
    return { cx: g.W * GATE.x, cy: g.H * GATE.y, r: g.H * GATE.r };
  }

  function paintView(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { cx, cy, r } = gateGeom(g);
    const U = g.U;
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * GROUND);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#e8e6dc'), 0.4 * (1 - sky.night))));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.2) {
      ctx.fillStyle = '#e8e4d2';
      ctx.globalAlpha = Math.min(1, sky.night * 1.1);
      ctx.beginPath();
      ctx.arc(g.W * 0.58, g.H * 0.2, U * 4.2, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Far bamboo, pale in the haze.
    const far = hex(dim(mixColor(rgb('#7f9a78'), sky.haze, 0.5), sky.night, 0.7));
    const farNode = hex(dim(mixColor(rgb('#5d7a5a'), sky.haze, 0.45), sky.night, 0.7));
    for (let i = 0; i < 26; i++) {
      const x = cx - r + (i + rand() * 0.8) * (2 * r / 26);
      const top = g.H * (0.16 + rand() * 0.25);
      stalk(ctx, x, g.H * 0.7, top, U * 0.7, far, farNode, far, rand, U * 0.6, true, farNode);
    }
    ctx.fillStyle = hex(mixColor(sky.haze, rgb('#f2f0e6'), 0.5));
    ctx.globalAlpha = 0.45 * (1 - sky.night * 0.6);
    ctx.fillRect(cx - r, g.H * 0.52, 2 * r, g.H * 0.12);
    ctx.globalAlpha = 1;
    // Mid bamboo.
    const mid = hex(dim(rgb('#4e7a4c'), sky.night, 0.7));
    const midNode = hex(dim(rgb('#2f5236'), sky.night, 0.7));
    const midLight = hex(dim(rgb('#7ea068'), sky.night, 0.7));
    for (let i = 0; i < 9; i++) {
      const x = cx - r * 0.95 + (i + rand() * 0.7) * (1.9 * r / 9);
      stalk(ctx, x, g.H * 0.8, g.H * (0.1 + rand() * 0.2), U * 1.5, mid, midNode, midLight, rand, U * 0.85, true, midNode);
    }
    paintPath(ctx, g, sky, rand);
    return c;
  }

  function paintPath(ctx, g, sky, rand) {
    const { cx } = gateGeom(g);
    const top = g.H * 0.64;
    const bot = g.H * GROUND;
    const earth = hex(dim(mixColor(rgb('#7a8670'), sky.low, 0.2), sky.night, 0.7));
    ctx.fillStyle = earth;
    ctx.fillRect(0, top, g.W, bot - top);
    // Mossy edge beds.
    ctx.fillStyle = hex(dim(rgb('#3f5f3c'), sky.night, 0.7));
    for (let i = 0; i < 260; i++) {
      const f = rand();
      const y = top + f * (bot - top);
      const side = rand() < 0.5 ? -1 : 1;
      const half = lerp(g.W * 0.035, g.W * 0.12, f);
      ctx.fillRect(cx + side * (half + rand() * g.W * 0.2), y, 1 + rand() * g.U, 1);
    }
    // Slabs in perspective, set in a running bond.
    const rows = 9;
    const slab = hex(dim(mixColor(rgb('#b9b6a8'), sky.amb, 0.25), sky.night, 0.65));
    const joint = hex(dim(rgb('#6d6e66'), sky.night, 0.6));
    for (let r = 0; r < rows; r++) {
      const f0 = Math.pow(r / rows, 1.5);
      const f1 = Math.pow((r + 1) / rows, 1.5);
      const y0 = top + f0 * (bot - top);
      const y1 = top + f1 * (bot - top);
      const w0 = lerp(g.W * 0.035, g.W * 0.115, f0);
      const w1 = lerp(g.W * 0.035, g.W * 0.115, f1);
      ctx.fillStyle = slab;
      ctx.beginPath();
      ctx.moveTo(cx - w0, y0);
      ctx.lineTo(cx + w0, y0);
      ctx.lineTo(cx + w1, y1);
      ctx.lineTo(cx - w1, y1);
      ctx.fill();
      ctx.fillStyle = joint;
      ctx.fillRect(cx - w1, y1 - 1, w1 * 2, 1);
      const cut = ((r % 2) ? 0.3 : -0.3) + (rand() - 0.5) * 0.1;
      ctx.fillRect(cx + cut * w1, y0, 1, y1 - y0);
      ctx.fillRect(cx - w1 * 0.01, y0 + (r % 2) * 0, 0, 0);
    }
  }

  // Bamboo near the camera inside the gate; rocks as one piece.
  function paintSwayNear(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { cx, r } = gateGeom(g);
    const U = g.U;
    const body = hex(dim(rgb('#3f6a44'), sky.night, 0.7));
    const node = hex(dim(rgb('#223d2c'), sky.night, 0.7));
    const light = hex(dim(rgb('#6f9a62'), sky.night, 0.7));
    const leafCol = hex(dim(rgb('#355c3a'), sky.night, 0.7));
    const xs = [-0.86, -0.7, -0.55, 0.62, 0.78, 0.9];
    for (let i = 0; i < xs.length; i++) {
      stalk(ctx, cx + xs[i] * r, g.H * 0.92, g.H * (0.02 + rand() * 0.14), U * 2.1, body, node, light, rand, U * 1.1, true, leafCol);
    }
    return c;
  }

  // ---- wall --------------------------------------------------------------

  function paintWall(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { cx, cy, r } = gateGeom(g);
    const U = g.U;
    const top = g.H * WALL_TOP;
    const bot = g.H * GROUND;
    const plaster = dim(mixColor(rgb('#ece7d8'), sky.amb, 0.22), sky.night, 0.62);
    ctx.fillStyle = hex(plaster);
    ctx.fillRect(0, top, g.W, bot - top);
    // Weathering: damp streaks from the coping and a stained skirt.
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      const len = U * (3 + rand() * 14);
      ctx.fillStyle = hex(dim(rgb('#8f8f84'), sky.night, 0.5));
      ctx.globalAlpha = 0.07 + rand() * 0.08;
      ctx.fillRect(x, top + U * 2.5, 1 + rand() * U * 0.5, len);
    }
    ctx.globalAlpha = 1;
    const skirt = ctx.createLinearGradient(0, bot - U * 14, 0, bot);
    skirt.addColorStop(0, 'rgba(70,86,64,0)');
    skirt.addColorStop(1, `rgba(70,86,64,${0.35 - sky.night * 0.1})`);
    ctx.fillStyle = skirt;
    ctx.fillRect(0, bot - U * 14, g.W, U * 14);
    // Grey tile coping with round-ended eave tiles and a ridge line.
    const tile = hex(dim(rgb('#4b4f58'), sky.night, 0.5));
    const tileHi = hex(dim(rgb('#6a6f78'), sky.night, 0.5));
    ctx.fillStyle = tile;
    ctx.fillRect(0, top - U * 2.2, g.W, U * 3.4);
    ctx.fillStyle = tileHi;
    ctx.fillRect(0, top - U * 2.2, g.W, Math.max(1, U * 0.6));
    ctx.fillStyle = tile;
    for (let x = 0; x < g.W; x += U * 1.8) {
      ctx.beginPath();
      ctx.arc(x + U * 0.9, top + U * 1.2, U * 0.9, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = hex(dim(rgb('#2b2e36'), sky.night, 0.5));
    for (let x = 0; x < g.W; x += U * 1.8) ctx.fillRect(x, top - U * 2.2, 1, U * 2.4);
    // Stone plinth.
    ctx.fillStyle = hex(dim(rgb('#8d8c82'), sky.night, 0.6));
    ctx.fillRect(0, bot - U * 1.4, g.W, U * 1.4);
    // Cut the gate.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Stone rim: dark outer line, pale ring, thin inner shadow.
    ctx.lineWidth = U * 1.6;
    ctx.strokeStyle = hex(dim(rgb('#9c9a8e'), sky.night, 0.6));
    ctx.beginPath();
    ctx.arc(cx, cy, r + U * 0.8, 0, 6.3);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, U * 0.5);
    ctx.strokeStyle = hex(dim(rgb('#4f5058'), sky.night, 0.5));
    ctx.beginPath();
    ctx.arc(cx, cy, r + U * 1.7, 0, 6.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r - U * 0.1, 0, 6.3);
    ctx.stroke();
    return c;
  }

  function paintGround(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const top = g.H * GROUND;
    ctx.fillStyle = hex(dim(mixColor(rgb('#a6a498'), sky.amb, 0.2), sky.night, 0.65));
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = hex(dim(rgb('#6b6c64'), sky.night, 0.6));
    for (let y = top + U * 3; y < g.H; y += U * 3.2) ctx.fillRect(0, y, g.W, 1);
    let row = 0;
    for (let y = top; y < g.H; y += U * 3.2, row++) {
      for (let x = (row % 2) * U * 4; x < g.W; x += U * 8) ctx.fillRect(x, y, 1, U * 3.2);
    }
    return c;
  }

  // Leaf shadows for the plaster: dark sprays, with the gate cut out.
  function paintShadow(g, sky, rand) {
    const w = Math.ceil(g.W * 1.3);
    const c = layer(w, g.H * 0.95);
    const ctx = c.getContext('2d');
    const U = g.U;
    ctx.fillStyle = hex(dim(rgb('#2a3350'), sky.night, 0.2));
    for (let b = 0; b < 16; b++) {
      const x = rand() * w;
      const y = rand() * g.H * 0.8;
      ctx.lineWidth = Math.max(1, U * 0.5);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.moveTo(x, y - U * 8);
      ctx.lineTo(x + (rand() - 0.5) * U * 4, y + U * 6);
      ctx.stroke();
      for (let k = 0; k < 4; k++) spray(ctx, x + (rand() - 0.5) * U * 2, y + (rand() - 0.5) * U * 10, U * (5 + rand() * 4), rand, rand() < 0.5 ? 1 : -1);
    }
    return c;
  }

  function paintBeam() {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(250,240,200,0.5)');
    gr.addColorStop(1, 'rgba(250,240,200,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function paintLeaf(U) {
    const s = Math.max(4, Math.round(U * 3));
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7d9552';
    leaf(ctx, 0.5, s / 2, s - 1, 0, s * 0.18);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(88);
    state.view = paintView(g, sky, rand);
    state.near = paintSwayNear(g, sky, rand);
    state.wall = paintWall(g, sky, rand);
    state.ground = paintGround(g, sky, rand);
    state.shadow = paintShadow(g, sky, rand);
    state.shadowAlpha = 0.22 * (1 - sky.night * 0.85);
    state.beamAlpha = 0.7 * (1 - sky.night);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.beam = paintBeam();
    state.leaf = paintLeaf(g.U);
    repaint(g, api.props.time);
  }

  function rock(ctx, g, img, angle) {
    ctx.save();
    ctx.translate(g.W * 0.5, g.H * GROUND);
    ctx.rotate(angle);
    ctx.drawImage(img, -g.W * 0.5, -g.H * GROUND);
    ctx.restore();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== p.time) repaint(g, p.time);
    const { cx, cy, r } = gateGeom(g);
    ctx.drawImage(state.view, 0, 0);
    // Light patch sliding along the path.
    const bs = g.U * 22;
    const bx = cx + Math.sin(t * 0.2) * g.W * 0.03;
    const by = g.H * (0.76 + Math.sin(t * 0.13) * 0.03);
    ctx.globalAlpha = state.beamAlpha;
    ctx.drawImage(state.beam, bx - bs, by - bs * 0.4, bs * 2, bs * 0.8);
    ctx.globalAlpha = 1;
    const a = 0.012 * p.sway;
    rock(ctx, g, state.near, Math.sin(t * 0.9) * a + Math.sin(t * 1.7 + 1) * a * 0.4);
    ctx.drawImage(state.wall, 0, 0);
    // Leaf shadows over the wall only (the layer is clipped to its boundary).
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.H * WALL_TOP, g.W, g.H * (GROUND - WALL_TOP));
    ctx.arc(cx, cy, r, 0, 6.3, true);
    ctx.clip('evenodd');
    ctx.globalAlpha = state.shadowAlpha * p.dapple;
    const sw = state.shadow.width;
    const off = -(sw - g.W) * 0.5 + Math.sin(t * 0.35) * g.U * 3;
    ctx.drawImage(state.shadow, off + Math.sin(t * 1.1) * g.U * 0.8, g.H * 0.04 + Math.sin(t * 0.8) * g.U * 0.8);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.drawImage(state.ground, 0, 0);
    // A few leaves falling through the gate.
    ctx.globalAlpha = 0.85 * (1 - 0.7 * (1 - state.beamAlpha / 0.7));
    for (let i = 0; i < LEAVES; i++) {
      const f = (t * 0.03 + i / LEAVES) % 1;
      const lx = cx + (Math.sin(t * 0.7 + i * 2.1) * 0.5 + (i / LEAVES - 0.5) * 1.4) * r * 0.9;
      const ly = g.H * (0.12 + f * 0.72);
      ctx.drawImage(state.leaf, lx, ly);
    }
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { time: 'auto', sway: 1, dapple: 1, ramp: 'lines', cell: 7, boost: 0.18, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
