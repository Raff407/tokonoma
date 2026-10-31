/*
 * 鯉 Koi — a dark pond seen from above.
 *
 * Each fish is a spine of points dragged along behind its head, so the body
 * bends the way a real one does. Heads wander on smooth noise, turn away from
 * the banks and from the cursor. Rings spread where something touches the
 * water. Woven as blocks by default, so it reads like tiles on a pond floor.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { clamp, lerp, noise2, fbm, parseColor: P, mixColor } = K;

  const WATER = { deep: P('#020707'), shallow: P('#071a19'), glint: P('#4f9a92') };
  const PAD = { lo: P('#1d4a2a'), hi: P('#3f7a3c'), vein: P('#17361f') };
  const LOTUS = { petal: P('#f1b9c8'), heart: P('#f4d36a') };

  // Body colours by variety; patches are [start, end] along the body (0 = nose).
  const VARIETIES = [
    { base: '#f3eee6', patch: '#d6402a', patches: [[0.08, 0.3], [0.42, 0.62]] },
    { base: '#f3eee6', patch: '#d6402a', patches: [[0.15, 0.5]], ink: [[0.55, 0.68]] },
    { base: '#e9a93a', patch: '#f4cf6a', patches: [[0.2, 0.7]] },
    { base: '#23201f', patch: '#d84a2c', patches: [[0.1, 0.25], [0.48, 0.6]], spot: '#f0ebe2' },
    { base: '#f0ebe2', patch: '#e07a2e', patches: [[0.05, 0.85]] },
    { base: '#c9cfd4', patch: '#3c4a63', patches: [[0.25, 0.75]] },
  ].map((v) => ({
    base: P(v.base),
    patch: P(v.patch),
    patches: v.patches,
    ink: v.ink || [],
    spot: v.spot ? P(v.spot) : null,
  }));

  const SEGMENTS = 12;

  const state = { fish: [], pads: [], ripples: [], petals: [], last: { x: -1, y: -1 }, water: null };

  function makeFish(rand, g, i) {
    const len = (0.15 + rand() * 0.09) * g.H;
    const x = lerp(0.15, 0.85, rand()) * g.W;
    const y = lerp(0.15, 0.85, rand()) * g.H;
    const heading = rand() * Math.PI * 2;
    const spine = Array.from({ length: SEGMENTS }, (_, k) => ({
      x: x - Math.cos(heading) * (k * len) / SEGMENTS,
      y: y - Math.sin(heading) * (k * len) / SEGMENTS,
    }));
    return {
      spine,
      len,
      heading,
      speed: 3 + rand() * 3,
      seed: i * 31 + rand() * 1000,
      variety: VARIETIES[Math.floor(rand() * VARIETIES.length)],
      wiggle: rand() * 6,
    };
  }

  function makePads(rand, g) {
    const pads = [];
    const count = Math.round((g.W * g.H) / 2600);
    for (let i = 0; i < count; i++) {
      // Lilies gather near the banks.
      const edge = rand() < 0.5;
      const x = edge ? (rand() < 0.5 ? rand() * 0.22 : 1 - rand() * 0.22) * g.W : rand() * g.W;
      const y = edge ? rand() * g.H : (rand() < 0.5 ? rand() * 0.2 : 1 - rand() * 0.2) * g.H;
      pads.push({
        x, y,
        r: (2.5 + rand() * 4.5) * g.U,
        notch: rand() * Math.PI * 2,
        flower: rand() < 0.22,
        drift: rand() * 6,
      });
    }
    return pads;
  }

  function steer(f, g, t, dt, pointer, fish) {
    const head = f.spine[0];
    let turn = (noise2(t * 0.25, f.seed) - 0.5) * 2.4;

    // Bank avoidance: aim back towards the middle when near an edge.
    const margin = 0.12;
    const nx = head.x / g.W;
    const ny = head.y / g.H;
    if (nx < margin || nx > 1 - margin || ny < margin || ny > 1 - margin) {
      const want = Math.atan2(g.H / 2 - head.y, g.W / 2 - head.x);
      turn += angleDiff(want, f.heading) * 1.8;
    }

    // Keep a little room between fish.
    for (const other of fish) {
      if (other === f) continue;
      const dx = other.spine[0].x - head.x;
      const dy = other.spine[0].y - head.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < (f.len * 0.6) ** 2) turn += angleDiff(Math.atan2(-dy, -dx), f.heading) * 0.5;
    }

    let speed = f.speed;
    if (pointer.active) {
      const dx = head.x - pointer.x;
      const dy = head.y - pointer.y;
      const d = Math.hypot(dx, dy);
      const reach = 0.16 * g.H;
      if (d < reach) {
        turn += angleDiff(Math.atan2(dy, dx), f.heading) * 3 * (1 - d / reach);
        speed *= 1 + 2.5 * (1 - d / reach);
      }
    }

    f.heading += clamp(turn, -2.6, 2.6) * dt;
    f.wiggle += dt * (2 + speed * 0.9);
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

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function radiusAt(s, len) {
    const body = Math.pow(Math.sin(Math.PI * clamp(s * 0.92 + 0.06, 0, 1)), 0.75);
    return Math.max(0.5, body * len * 0.13);
  }

  function colourAt(v, s) {
    if (v.ink.some(([a, b]) => s >= a && s <= b)) return P('#1e1b1b');
    if (v.patches.some(([a, b]) => s >= a && s <= b)) return v.patch;
    return v.base;
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function drawFish(ctx, f, t) {
    const s = f.spine;
    const len = f.len;
    // Side-to-side undulation grows towards the tail.
    const offset = (k) => Math.sin(f.wiggle - k * 0.55) * (k / SEGMENTS) * len * 0.045;
    const pt = (k) => {
      const a = s[Math.max(0, k - 1)];
      const b = s[Math.min(SEGMENTS - 1, k + 1)];
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      const o = offset(k);
      return { x: s[k].x + Math.cos(ang) * o, y: s[k].y + Math.sin(ang) * o, ang };
    };

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < SEGMENTS; k++) {
      const p = pt(k);
      disc(ctx, p.x + 1.2, p.y + 1.8, radiusAt(k / (SEGMENTS - 1), len));
    }

    const tail = pt(SEGMENTS - 1);
    const beat = Math.sin(f.wiggle * 1.3) * 0.5;
    const back = Math.atan2(s[SEGMENTS - 1].y - s[SEGMENTS - 2].y, s[SEGMENTS - 1].x - s[SEGMENTS - 2].x) + beat;
    ctx.fillStyle = rgb(mixColor(f.variety.base, P('#04100f'), 0.25), 0.85);
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(tail.x + Math.cos(back - 0.5) * len * 0.2, tail.y + Math.sin(back - 0.5) * len * 0.2);
    ctx.lineTo(tail.x + Math.cos(back) * len * 0.13, tail.y + Math.sin(back) * len * 0.13);
    ctx.lineTo(tail.x + Math.cos(back + 0.5) * len * 0.2, tail.y + Math.sin(back + 0.5) * len * 0.2);
    ctx.closePath();
    ctx.fill();

    const fin = pt(3);
    const flap = 0.6 + Math.sin(f.wiggle * 0.8) * 0.35;
    for (const side of [-1, 1]) {
      const ang = fin.ang + side * (Math.PI / 2 - flap) + (side < 0 ? Math.PI : 0);
      const reach = radiusAt(0.25, len) * 1.1;
      ctx.fillStyle = rgb(mixColor(f.variety.base, WATER.deep, 0.3), 0.8);
      disc(ctx, fin.x + Math.cos(fin.ang) * side * reach + Math.cos(ang) * 0.5, fin.y + Math.sin(fin.ang) * side * reach + Math.sin(ang) * 0.5, len * 0.06);
    }

    for (let k = SEGMENTS - 1; k >= 0; k--) {
      const p = pt(k);
      const sk = k / (SEGMENTS - 1);
      ctx.fillStyle = rgb(colourAt(f.variety, sk));
      disc(ctx, p.x, p.y, radiusAt(sk, len));
      if (f.variety.spot && (k === 4 || k === 8)) {
        ctx.fillStyle = rgb(f.variety.spot);
        disc(ctx, p.x, p.y, radiusAt(sk, len) * 0.45);
      }
    }
    const head = pt(0);
    ctx.fillStyle = rgb(mixColor(colourAt(f.variety, 0.1), P('#ffffff'), 0.2));
    disc(ctx, head.x, head.y, radiusAt(0.12, len) * 0.7);
  }

  function paintWater(ctx, g, t) {
    if (!state.water || state.water.width !== g.W || state.water.height !== g.H) {
      state.water = ctx.createImageData(g.W, g.H);
    }
    const img = state.water;
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const depth = fbm(x * 0.025, y * 0.04, 2, 3);
        const c1 = noise2(x * 0.11 + t * 0.35, y * 0.13 - t * 0.2, 5);
        const c2 = noise2(x * 0.09 - t * 0.25, y * 0.1 + t * 0.3, 9);
        const ridge = 1 - Math.abs(c1 + c2 - 1) * 6;
        const caustic = ridge > 0 ? ridge * ridge * ridge * 0.3 : 0;
        const i = (y * g.W + x) * 4;
        const base = mixColor(WATER.deep, WATER.shallow, depth * 0.9);
        d[i] = base[0] + WATER.glint[0] * caustic;
        d[i + 1] = base[1] + WATER.glint[1] * caustic;
        d[i + 2] = base[2] + WATER.glint[2] * caustic;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
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

  function addRipple(x, y, strength = 1) {
    state.ripples.push({ x, y, age: 0, strength });
    if (state.ripples.length > 40) state.ripples.shift();
  }

  function drawRipples(ctx, g, dt) {
    ctx.lineWidth = 0.8;
    for (const r of state.ripples) {
      r.age += dt;
      const radius = r.age * 7 * g.U * 0.4;
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

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.rand = K.rng(api.seed);
    state.fish = Array.from({ length: api.props.fish }, (_, i) => makeFish(state.rand, g, i));
    state.pads = makePads(state.rand, g);
    state.ripples = [];
    state.petals = Array.from({ length: Math.round(g.W / 25) }, () => ({
      x: state.rand() * g.W,
      y: state.rand() * g.H,
      a: state.rand() * 6.28,
    }));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    paintWater(ctx, g, t);

    if (state.rand() < dt * props.rain) addRipple(state.rand() * g.W, state.rand() * g.H, 0.6);
    const p = api.pointer;
    if (p.active && Math.hypot(p.x - state.last.x, p.y - state.last.y) > 4) {
      addRipple(p.x, p.y, 1);
      state.last = { x: p.x, y: p.y };
    }

    for (const f of state.fish) steer(f, g, t, dt, p, state.fish);
    // Deep fish first so the ones near the surface overlap them.
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
      mode: 'block',
      cell: 11,
      bg: '#050c0c',
      tint: 0.35,
    },
    setup,
    draw,
    onProps(props, api) {
      if (props.fish !== state.fish.length) setup(null, api);
    },
  });
})();
