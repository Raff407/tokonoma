/*
 * 紅葉 Momiji — red maple leaves riding a dark stream.
 *
 * Seen from above. A leaf only knows which lane of the stream it is in, so it
 * follows the bends without any physics, sliding out of its lane to get round
 * a rock or away from the cursor. Leaves are small pre-baked sprites turned to
 * a handful of angles; the canopy overhead is baked and barely breathes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, noise2, smoothstep } = K;

  const LEAVES = ['#c1432a', '#d76c2e', '#cf9a33', '#8e2e2a'];
  const ANGLES = 8;
  const MAX_LEAVES = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const centre = (g, x) => g.H * 0.54 + Math.sin(x * 0.013 + 0.6) * g.H * 0.09;
  const halfWidth = (g, x) => g.H * (0.27 + 0.03 * Math.sin(x * 0.03));

  function leafSprite(radius, colour, angle) {
    const size = Math.ceil(radius * 2.4);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.rotate(angle);
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283;
      const r = (i % 2 === 0 ? 1 : 0.42) * radius;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    return c;
  }

  function bakeSprites(radius) {
    return LEAVES.map((colour) => {
      const turns = [];
      for (let a = 0; a < ANGLES; a++) turns.push(leafSprite(radius, colour, (a / ANGLES) * 6.283));
      return turns;
    });
  }

  function paintWater(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#112b30');
    grad.addColorStop(0.5, '#0c2228');
    grad.addColorStop(1, '#14312f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // Long streaks that tile sideways: the surface sliding downstream.
  function paintFlow(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.03, y * 0.24, 3, 14);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 126;
        img.data[i + 1] = 168;
        img.data[i + 2] = 170;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * 90;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintBanks(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const d = Math.abs(y - centre(g, x)) / halfWidth(g, x) + (fbm(x * 0.07, y * 0.07, 3, 2) - 0.5) * 0.28;
        const a = smoothstep(0.98, 1.02, d);
        if (a === 0) continue;
        const m = fbm(x * 0.09, y * 0.09, 4, 5);
        const moss = smoothstep(0.36, 0.6, m);
        const i = (y * g.W + x) * 4;
        img.data[i] = lerp(38, 46, moss);
        img.data[i + 1] = lerp(48, 66, moss);
        img.data[i + 2] = lerp(34, 40, moss);
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintRock(ctx, r) {
    const grad = ctx.createLinearGradient(r.x - r.r, r.y - r.r, r.x + r.r, r.y + r.r);
    grad.addColorStop(0, '#8d8b81');
    grad.addColorStop(0.55, '#55554f');
    grad.addColorStop(1, '#2a2c2a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.r * 1.2, r.r * 0.82, 0.2, 0, 6.3);
    ctx.fill();
  }

  function paintCanopy(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const clusters = Math.round(g.W * 2.2);
    for (let i = 0; i < clusters; i++) {
      const x = rand() * g.W;
      const top = rand() < 0.68;
      const edge = noise2(x * 0.018, top ? 1 : 2, 6);
      const reach = (top ? 0.03 + edge * 0.26 : 0.02 + edge * 0.14) * Math.pow(rand(), 1.5);
      const y = top ? g.H * reach : g.H * (1 - reach);
      ctx.fillStyle = LEAVES[Math.floor(rand() * LEAVES.length)];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x, y, g.U * (0.7 + rand() * 1.2), 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function placeRocks(g, rand) {
    const rocks = [];
    for (let i = 0; i < 5; i++) {
      const x = g.W * (0.12 + (i / 5) * 0.8 + rand() * 0.06);
      const lane = (i % 2 ? 1 : -1) * (0.25 + rand() * 0.45);
      rocks.push({ x, y: centre(g, x) + lane * halfWidth(g, x), r: g.U * (3 + rand() * 3.5), lane });
    }
    return rocks;
  }

  function spawnLeaf(g, i, anywhere) {
    const r = state.rand;
    state.lx[i] = anywhere ? r() * g.W : -g.U * 4;
    state.ll[i] = (r() * 2 - 1) * 0.8;
    state.lv[i] = 0.7 + r() * 0.6;
    state.ls[i] = (r() - 0.5) * 1.1;
    state.la[i] = r() * ANGLES;
    state.lc[i] = Math.floor(r() * LEAVES.length);
  }

  function steerAroundRocks(g, i, dt) {
    for (const rock of state.rockList) {
      const dx = rock.x - state.lx[i];
      if (dx < -rock.r || dx > rock.r * 3) continue;
      const gap = state.ll[i] - rock.lane;
      const clear = (rock.r * 1.5) / halfWidth(g, rock.x);
      if (Math.abs(gap) < clear) state.ll[i] += (gap >= 0 ? 1 : -1) * dt * 0.5;
    }
  }

  function moveLeaf(g, i, t, dt, props, pointer) {
    const lane = state.ll[i];
    const speed = g.U * 7 * props.flow * state.lv[i] * (1.15 - lane * lane * 0.6);
    state.lx[i] += speed * dt;
    state.ll[i] += (noise2(i * 0.7, t * 0.08, 4) - 0.5) * dt * 0.26;
    steerAroundRocks(g, i, dt);
    if (pointer.active) {
      const dx = state.lx[i] - pointer.x;
      const dy = centre(g, state.lx[i]) + lane * halfWidth(g, state.lx[i]) - pointer.y;
      const reach = g.U * 14;
      if (dx * dx + dy * dy < reach * reach) {
        state.lx[i] += (dx >= 0 ? 1 : -1) * g.U * 8 * dt;
        state.ll[i] += (dy >= 0 ? 1 : -1) * dt * 0.7;
      }
    }
    state.ll[i] = K.clamp(state.ll[i], -0.92, 0.92);
    state.la[i] = (state.la[i] + state.ls[i] * dt + ANGLES) % ANGLES;
    if (state.lx[i] > g.W + g.U * 4) spawnLeaf(g, i, false);
  }

  function drawLeaves(ctx, g, t, dt, props, pointer) {
    const count = Math.min(MAX_LEAVES, Math.round(26 * props.leaves));
    const size = state.sprites[0][0].width;
    for (let i = 0; i < count; i++) {
      moveLeaf(g, i, t, dt, props, pointer);
      const x = state.lx[i];
      const y = centre(g, x) + state.ll[i] * halfWidth(g, x);
      ctx.drawImage(state.sprites[state.lc[i]][state.la[i] | 0], x - size / 2, y - size / 2);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.water = paintWater(g);
    state.flow = paintFlow(Math.ceil(g.W * 1.2), g.H);
    state.rockList = placeRocks(g, rand);
    const banks = paintBanks(g);
    const bctx = banks.getContext('2d');
    for (const r of state.rockList) paintRock(bctx, r);
    state.banks = banks;
    state.canopy = paintCanopy(g, rand);
    state.sprites = bakeSprites(Math.max(3, g.U * 3.8));
    state.lx = new Float32Array(MAX_LEAVES);
    state.ll = new Float32Array(MAX_LEAVES);
    state.lv = new Float32Array(MAX_LEAVES);
    state.ls = new Float32Array(MAX_LEAVES);
    state.la = new Float32Array(MAX_LEAVES);
    state.lc = new Uint8Array(MAX_LEAVES);
    for (let i = 0; i < MAX_LEAVES; i++) spawnLeaf(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.water, 0, 0);
    const w = state.flow.width;
    const x = (t * g.U * 7 * props.flow) % w;
    ctx.drawImage(state.flow, x, 0);
    ctx.drawImage(state.flow, x - w, 0);
    ctx.drawImage(state.banks, 0, 0);
    drawLeaves(ctx, g, t, dt, props, api.pointer);
    ctx.drawImage(state.canopy, Math.sin(t * 0.35) * g.U * 0.5, 0);
  }

  Kasuri.run({
    defaults: { leaves: 1, flow: 1, ramp: 'kana', cell: 8, boost: 0.3, gain: 1.2 },
    maxFps: 24,
    setup,
    draw,
  });
})();
