/*
 * 鯉 Koi — a dark pond seen from above.
 *
 * Each fish is a spine of points dragged along behind its head, so the body
 * bends the way a real one does. The body is an outline around that spine,
 * painted with its variety's patches in body space (so the patches bend with
 * it), then shaded at the edges, lit along the back, and given eyes, fins and
 * a tail that trails the beat. Click the desktop to drop food: nearby fish
 * turn for it, race, and gulp it down.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { clamp, lerp, noise2, fbm, hash2, parseColor: P, mixColor } = K;

  const WATER = { deep: P('#020707'), shallow: P('#071a19'), glint: P('#4f9a92') };
  const PAD = { lo: P('#1d4a2a'), hi: P('#3f7a3c') };
  const LOTUS = { petal: P('#f1b9c8'), heart: P('#f4d36a') };
  const FOOD = P('#c79a52');
  const SEGMENTS = 14;

  /*
   * Varieties. `base` fills the body; each patch is an ellipse in body space:
   * s along the body (0 nose → 1 tail), side across it (-1 → 1), with length
   * and width in those same units. `sheen` adds a metallic glint.
   */
  const VARIETIES = {
    kohaku: { base: '#f4efe6', patches: (r) => blotches(r, '#d33f25', 2 + Math.floor(r() * 2)) },
    tancho: { base: '#f4efe6', patches: () => [{ s: 0.1, side: 0, len: 0.12, wid: 1.1, colour: '#d33f25' }] },
    sanke: { base: '#f4efe6', patches: (r) => [...blotches(r, '#d33f25', 2), ...spots(r, '#1d1a1a', 4)] },
    showa: { base: '#211d1d', patches: (r) => [...blotches(r, '#d6452a', 2), ...blotches(r, '#efe9df', 2)] },
    ogon: { base: '#e7b443', sheen: true, patches: () => [] },
    platinum: { base: '#dfe3e6', sheen: true, patches: () => [] },
    asagi: {
      base: '#7d8fa4',
      patches: () => [
        { s: 0.55, side: 0.95, len: 0.7, wid: 0.5, colour: '#d2622f' },
        { s: 0.55, side: -0.95, len: 0.7, wid: 0.5, colour: '#d2622f' },
        { s: 0.08, side: 0, len: 0.12, wid: 1.2, colour: '#c9d2dc' },
      ],
    },
    chagoi: { base: '#8a6440', patches: (r) => spots(r, '#a77c52', 5) },
  };
  const NAMES = Object.keys(VARIETIES);

  function blotches(rand, colour, count) {
    return Array.from({ length: count }, () => ({
      s: 0.12 + rand() * 0.6,
      side: (rand() - 0.5) * 0.9,
      len: 0.14 + rand() * 0.2,
      wid: 0.9 + rand() * 0.9,
      colour,
    }));
  }

  function spots(rand, colour, count) {
    return Array.from({ length: count }, () => ({
      s: 0.15 + rand() * 0.6,
      side: (rand() - 0.5) * 1.4,
      len: 0.04 + rand() * 0.05,
      wid: 0.3 + rand() * 0.35,
      colour,
    }));
  }

  const state = { fish: [], pads: [], ripples: [], petals: [], food: [], last: { x: -1, y: -1 }, water: null };
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- fish -------------------------------------------------------------

  function makeFish(rand, g, i) {
    const len = (0.15 + rand() * 0.1) * g.H;
    const x = lerp(0.15, 0.85, rand()) * g.W;
    const y = lerp(0.15, 0.85, rand()) * g.H;
    const heading = rand() * Math.PI * 2;
    const variety = VARIETIES[NAMES[Math.floor(rand() * NAMES.length)]];
    return {
      spine: Array.from({ length: SEGMENTS }, (_, k) => ({
        x: x - (Math.cos(heading) * k * len) / SEGMENTS,
        y: y - (Math.sin(heading) * k * len) / SEGMENTS,
      })),
      len,
      heading,
      speed: 3 + rand() * 3,
      seed: i * 31 + rand() * 1000,
      base: P(variety.base),
      sheen: Boolean(variety.sheen),
      patches: variety.patches(rand).map((p) => ({ ...p, colour: P(p.colour) })),
      wiggle: rand() * 6,
      gulp: 0,
    };
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function nearestFood(head, reach) {
    let best = null;
    let bestD = reach;
    for (const f of state.food) {
      const d = Math.hypot(f.x - head.x, f.y - head.y);
      if (d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  function steer(f, g, t, dt, pointer) {
    const head = f.spine[0];
    let turn = (noise2(t * 0.25, f.seed) - 0.5) * 2.4;
    let speed = f.speed;

    const margin = 0.1;
    const nx = head.x / g.W;
    const ny = head.y / g.H;
    if (nx < margin || nx > 1 - margin || ny < margin || ny > 1 - margin) {
      turn += angleDiff(Math.atan2(g.H / 2 - head.y, g.W / 2 - head.x), f.heading) * 1.8;
    }

    for (const other of state.fish) {
      if (other === f) continue;
      const dx = other.spine[0].x - head.x;
      const dy = other.spine[0].y - head.y;
      if (dx * dx + dy * dy < (f.len * 0.5) ** 2) turn += angleDiff(Math.atan2(-dy, -dx), f.heading) * 0.5;
    }

    // Food beats everything except fright: turn hard for the closest pellet.
    const meal = nearestFood(head, 0.5 * g.H);
    if (meal) {
      turn = angleDiff(Math.atan2(meal.y - head.y, meal.x - head.x), f.heading) * 4;
      speed *= 1.9;
      if (Math.hypot(meal.x - head.x, meal.y - head.y) < Math.max(1.2, f.len * 0.08)) {
        state.food.splice(state.food.indexOf(meal), 1);
        addRipple(meal.x, meal.y, 0.5);
        f.gulp = 1;
      }
    } else if (pointer.active) {
      const dx = head.x - pointer.x;
      const dy = head.y - pointer.y;
      const d = Math.hypot(dx, dy);
      const reach = 0.16 * g.H;
      if (d < reach) {
        turn += angleDiff(Math.atan2(dy, dx), f.heading) * 3 * (1 - d / reach);
        speed *= 1 + 2.5 * (1 - d / reach);
      }
    }

    f.heading += clamp(turn, -3.2, 3.2) * dt;
    f.wiggle += dt * (2 + speed * 0.9);
    f.gulp = Math.max(0, f.gulp - dt * 3);
    head.x += Math.cos(f.heading) * speed * dt;
    head.y += Math.sin(f.heading) * speed * dt;

    const link = f.len / SEGMENTS;
    for (let k = 1; k < SEGMENTS; k++) {
      const a = f.spine[k - 1];
      const b = f.spine[k];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      b.x = a.x + Math.cos(ang) * link;
      b.y = a.y + Math.sin(ang) * link;
    }
  }

  function halfWidth(s, len) {
    // Blunt rounded head, full shoulders, long taper to the tail root.
    const body = Math.pow(Math.sin(Math.PI * clamp(s * 0.9 + 0.07, 0, 1)), 0.7);
    return Math.max(0.45, body * len * 0.12);
  }

  /** Spine samples with the side-to-side swim wave applied, plus normals. */
  function frame(f) {
    const pts = [];
    for (let k = 0; k < SEGMENTS; k++) {
      const a = f.spine[Math.max(0, k - 1)];
      const b = f.spine[Math.min(SEGMENTS - 1, k + 1)];
      const ang = Math.atan2(a.y - b.y, a.x - b.x);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      const s = k / (SEGMENTS - 1);
      const wave = Math.sin(f.wiggle - k * 0.55) * s * s * f.len * 0.06;
      pts.push({ x: f.spine[k].x + nx * wave, y: f.spine[k].y + ny * wave, nx, ny, ang, s, w: halfWidth(s, f.len) });
    }
    return pts;
  }

  /** Point at body coords (s along, side across) in the world. */
  function at(pts, s, side) {
    const f = clamp(s, 0, 1) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    const u = f - i;
    const a = pts[i];
    const b = pts[i + 1];
    const w = lerp(a.w, b.w, u);
    return {
      x: lerp(a.x, b.x, u) + lerp(a.nx, b.nx, u) * w * side,
      y: lerp(a.y, b.y, u) + lerp(a.ny, b.ny, u) * w * side,
      ang: a.ang + angleDiff(b.ang, a.ang) * u,
      w,
    };
  }

  function bodyPath(pts, dx = 0, dy = 0) {
    const path = new Path2D();
    const left = pts.map((p) => [p.x + p.nx * p.w + dx, p.y + p.ny * p.w + dy]);
    const right = pts.map((p) => [p.x - p.nx * p.w + dx, p.y - p.ny * p.w + dy]).reverse();
    const nose = pts[0];
    path.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) path.lineTo(left[i][0], left[i][1]);
    for (const [x, y] of right) path.lineTo(x, y);
    // Round snout.
    path.quadraticCurveTo(
      nose.x + Math.cos(nose.ang) * nose.w * 1.6 + dx, nose.y + Math.sin(nose.ang) * nose.w * 1.6 + dy,
      left[0][0], left[0][1],
    );
    path.closePath();
    return path;
  }

  function drawFins(ctx, f, pts) {
    const flap = Math.sin(f.wiggle * 0.8) * 0.4;
    ctx.fillStyle = rgb(mixColor(f.base, WATER.deep, 0.35), 0.75);
    for (const side of [-1, 1]) {
      for (const [s, size, spread] of [[0.24, 0.17, 0.9], [0.58, 0.09, 0.6]]) {
        const root = at(pts, s, side * 0.85);
        const out = root.ang + Math.PI + side * (spread + flap * side);
        ctx.beginPath();
        ctx.moveTo(root.x, root.y);
        ctx.lineTo(root.x + Math.cos(out - 0.35) * f.len * size, root.y + Math.sin(out - 0.35) * f.len * size);
        ctx.lineTo(root.x + Math.cos(out + 0.25) * f.len * size * 0.8, root.y + Math.sin(out + 0.25) * f.len * size * 0.8);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Tail: two soft lobes that lag the body's beat.
    const end = pts[pts.length - 1];
    const back = end.ang + Math.PI + Math.sin(f.wiggle * 1.2 - 1) * 0.45;
    const reach = f.len * 0.24;
    const px = (a, r) => end.x + Math.cos(back + a) * reach * r;
    const py = (a, r) => end.y + Math.sin(back + a) * reach * r;
    ctx.fillStyle = rgb(mixColor(f.base, WATER.deep, 0.2), 0.8);
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.quadraticCurveTo(px(-0.7, 0.7), py(-0.7, 0.7), px(-0.45, 1), py(-0.45, 1));
    ctx.lineTo(px(0, 0.55), py(0, 0.55));
    ctx.lineTo(px(0.45, 1), py(0.45, 1));
    ctx.quadraticCurveTo(px(0.7, 0.7), py(0.7, 0.7), end.x, end.y);
    ctx.fill();
  }

  function drawFish(ctx, f, t) {
    const pts = frame(f);
    const body = bodyPath(pts);

    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fill(bodyPath(pts, 1.4, 2));

    drawFins(ctx, f, pts);

    ctx.fillStyle = rgb(f.base);
    ctx.fill(body);

    ctx.save();
    ctx.clip(body);
    for (const p of f.patches) {
      const c = at(pts, p.s, p.side);
      ctx.fillStyle = rgb(p.colour);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, (p.len * f.len) / 2, Math.max(0.6, (p.wid * c.w) / 2), c.ang, 0, Math.PI * 2);
      ctx.fill();
    }
    if (f.sheen) {
      for (let k = 0; k < 6; k++) {
        const glow = Math.max(0, Math.sin(t * 2.2 + k * 1.7 + f.seed)) ** 8;
        if (glow < 0.05) continue;
        const c = at(pts, 0.15 + k * 0.11, (hash2(k, 3, f.seed | 0) - 0.5) * 1.2);
        ctx.fillStyle = `rgba(255,252,236,${glow * 0.9})`;
        ctx.fillRect(c.x, c.y, 1, 1);
      }
    }
    // Volume: a dark rim inside the outline, a lit ridge down the back.
    ctx.lineWidth = Math.max(1, f.len * 0.05);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.stroke(body);
    ctx.lineWidth = Math.max(0.6, f.len * 0.025);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    for (let k = 2; k < SEGMENTS - 3; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.stroke();
    ctx.restore();

    // Eyes, and a mouth that opens on a gulp.
    ctx.fillStyle = 'rgba(12,10,10,0.95)';
    for (const side of [-1, 1]) {
      const e = at(pts, 0.07, side * 0.62);
      ctx.fillRect(e.x - 0.5, e.y - 0.5, 1, 1);
    }
    if (f.gulp > 0) {
      const m = at(pts, 0, 0);
      ctx.fillStyle = `rgba(40,20,18,${f.gulp})`;
      disc(ctx, m.x + Math.cos(m.ang) * m.w * 0.9, m.y + Math.sin(m.ang) * m.w * 0.9, m.w * 0.45 * f.gulp);
    }
  }

  // ---- pond -------------------------------------------------------------

  function paintWater(ctx, g, t) {
    if (!state.water || state.water.width !== g.W || state.water.height !== g.H) {
      state.water = ctx.createImageData(g.W, g.H);
      state.depth = new Float32Array(g.W * g.H);
      for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) state.depth[y * g.W + x] = fbm(x * 0.025, y * 0.04, 2, 3);
    }
    const d = state.water.data;
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const c1 = noise2(x * 0.11 + t * 0.35, y * 0.13 - t * 0.2, 5);
        const c2 = noise2(x * 0.09 - t * 0.25, y * 0.1 + t * 0.3, 9);
        const ridge = 1 - Math.abs(c1 + c2 - 1) * 6;
        const caustic = ridge > 0 ? ridge * ridge * ridge * 0.3 : 0;
        const k = y * g.W + x;
        const depth = state.depth[k] * 0.9;
        const i = k * 4;
        d[i] = lerp(WATER.deep[0], WATER.shallow[0], depth) + WATER.glint[0] * caustic;
        d[i + 1] = lerp(WATER.deep[1], WATER.shallow[1], depth) + WATER.glint[1] * caustic;
        d[i + 2] = lerp(WATER.deep[2], WATER.shallow[2], depth) + WATER.glint[2] * caustic;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(state.water, 0, 0);
  }

  function drawPad(ctx, p, t) {
    const x = p.x + Math.sin(t * 0.1 + p.drift) * 0.6;
    const y = p.y + Math.cos(t * 0.08 + p.drift) * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    disc(ctx, x + 0.8, y + 1.2, p.r);
    ctx.fillStyle = rgb(PAD.lo);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, p.r, p.notch + 0.35, p.notch + Math.PI * 2 - 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgb(PAD.hi);
    disc(ctx, x - p.r * 0.25, y - p.r * 0.25, p.r * 0.45);
    if (p.flower) {
      ctx.fillStyle = rgb(LOTUS.petal);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + p.drift;
        disc(ctx, x + Math.cos(a) * p.r * 0.32, y + Math.sin(a) * p.r * 0.32, p.r * 0.26);
      }
      ctx.fillStyle = rgb(LOTUS.heart);
      disc(ctx, x, y, p.r * 0.18);
    }
  }

  function makePads(rand, g) {
    return Array.from({ length: Math.round((g.W * g.H) / 2600) }, () => {
      const edge = rand() < 0.5;
      const x = edge ? (rand() < 0.5 ? rand() * 0.22 : 1 - rand() * 0.22) * g.W : rand() * g.W;
      const y = edge ? rand() * g.H : (rand() < 0.5 ? rand() * 0.2 : 1 - rand() * 0.2) * g.H;
      return { x, y, r: (2.5 + rand() * 4.5) * g.U, notch: rand() * Math.PI * 2, flower: rand() < 0.22, drift: rand() * 6 };
    });
  }

  function addRipple(x, y, strength = 1) {
    state.ripples.push({ x, y, age: 0, strength });
    if (state.ripples.length > 40) state.ripples.shift();
  }

  function drawRipples(ctx, g, dt) {
    ctx.lineWidth = 0.8;
    for (const r of state.ripples) {
      r.age += dt;
      const radius = r.age * 2.8 * g.U;
      const a = Math.max(0, 0.55 * r.strength * (1 - r.age / 3.2));
      if (a <= 0) continue;
      ctx.strokeStyle = `rgba(150,205,196,${a})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      if (radius > 3) {
        ctx.strokeStyle = `rgba(150,205,196,${a * 0.5})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    state.ripples = state.ripples.filter((r) => r.age < 3.2);
  }

  // ---- food -------------------------------------------------------------

  function dropFood(x, y, amount) {
    const rand = state.rand;
    const count = Math.max(1, Math.round(amount));
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 2.4 * state.g.U;
      state.food.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, age: 0, drift: rand() * 6 });
    }
    state.food = state.food.slice(-60);
    addRipple(x, y, 1.1);
  }

  function drawFood(ctx, dt, t) {
    for (const f of state.food) {
      f.age += dt;
      f.x += Math.sin(t * 0.6 + f.drift) * dt * 0.25;
      f.y += Math.cos(t * 0.5 + f.drift) * dt * 0.25;
      // Pellets soak and sink after half a minute.
      const a = clamp(1 - (f.age - 25) / 5, 0, 1);
      ctx.fillStyle = rgb(FOOD, a);
      ctx.fillRect(f.x - 0.5, f.y - 0.5, 1, 1);
    }
    state.food = state.food.filter((f) => f.age < 30);
  }

  // ---- scene ------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.rand = K.rng(api.seed);
    state.water = null;
    state.fish = Array.from({ length: api.props.fish }, (_, i) => makeFish(state.rand, g, i));
    state.pads = makePads(state.rand, g);
    state.ripples = [];
    state.food = [];
    state.petals = Array.from({ length: Math.round(g.W / 25) }, () => ({
      x: state.rand() * g.W,
      y: state.rand() * g.H,
      a: state.rand() * 6.28,
    }));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    paintWater(ctx, g, t);

    if (state.rand() < dt * api.props.rain) addRipple(state.rand() * g.W, state.rand() * g.H, 0.6);
    const p = api.pointer;
    if (p.active && Math.hypot(p.x - state.last.x, p.y - state.last.y) > 4) {
      addRipple(p.x, p.y, 1);
      state.last = { x: p.x, y: p.y };
    }

    for (const f of state.fish) steer(f, g, t, dt, p);
    drawFood(ctx, dt, t);
    for (const f of state.fish) drawFish(ctx, f, t);
    drawRipples(ctx, g, dt);
    for (const pad of state.pads) drawPad(ctx, pad, t);

    for (const pt of state.petals) {
      pt.x += Math.cos(t * 0.05 + pt.a) * dt * 0.6;
      pt.y += Math.sin(t * 0.04 + pt.a) * dt * 0.4;
      ctx.fillStyle = 'rgba(241,185,200,0.9)';
      ctx.fillRect(pt.x | 0, pt.y | 0, 1, 1);
    }
  }

  Kasuri.run({
    defaults: {
      fish: 7,
      rain: 0.6,
      food: 6,
      mode: 'block',
      cell: 8,
      bg: '#050c0c',
      tint: 0.35,
    },
    setup,
    draw,
    onClick(x, y, api) {
      dropFood(x, y, api.props.food);
    },
    onProps(props, api) {
      if (props.fish !== state.fish.length) setup(null, api);
    },
  });
})();
