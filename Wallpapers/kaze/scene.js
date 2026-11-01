/*
 * 風 Kaze — a sword left standing in a field of silver grass, under a storm.
 *
 * Clouds are two seamless textures painted once and slid past each other.
 * The susuki is a few hundred stalks in depth order, each a curved stem with
 * a feathery plume; gusts roll across the field as travelling waves, so
 * neighbouring stalks bow one after another. Seed fluff rides the same wind.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { clamp, lerp, smoothstep, fbm, noise2, parseColor: P, mixColor } = K;

  const SKY = { top: P('#141b1d'), mid: P('#2b3637'), low: P('#5d6a69') };
  const CLOUD = { dark: P('#1b2224'), light: P('#9aa8a7') };
  const GRASS = { stem: P('#5a645f'), shade: P('#7d8781'), plume: P('#c8cfca'), glow: P('#eef1ec') };
  const STEEL = { body: P('#8a9aa2'), edge: P('#e6eef1'), back: P('#56656c') };
  const WRAP = { light: P('#e7e7e1'), dark: P('#141716') };
  const TSUBA = P('#232626');
  const FLUFF = P('#eef1ec');

  const state = { stalks: [], fluff: [], gusts: [], clouds: [] };
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ----------------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.8);
    grad.addColorStop(0, rgb(SKY.top));
    grad.addColorStop(0.6, rgb(SKY.mid));
    grad.addColorStop(1, rgb(SKY.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // A pale gap low on the left where the storm thins.
    const gap = ctx.createRadialGradient(g.W * 0.18, g.H * 0.6, 0, g.W * 0.18, g.H * 0.6, g.W * 0.45);
    gap.addColorStop(0, rgb(P('#a4b1af'), 0.45));
    gap.addColorStop(1, rgb(P('#a4b1af'), 0));
    ctx.fillStyle = gap;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // Billowing cloud bank that tiles sideways, lit from below.
  function paintClouds(g, seed, height, scale, cover) {
    const w = Math.ceil(g.W * 2);
    const h = Math.ceil(height);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => {
      const u = x / w;
      const sample = (sx) => {
        // Domain warp turns smooth noise into heaped, billowing masses.
        const wx = fbm(sx * scale * 0.7, y * scale * 0.9, 3, seed + 3) * 3;
        const wy = fbm(sx * scale * 0.7 + 5, y * scale * 0.9, 3, seed + 5) * 2;
        return fbm(sx * scale + wx, y * scale * 1.4 + wy, 4, seed);
      };
      return lerp(sample(x), sample(x - w), u);
    };
    for (let y = 0; y < h; y++) {
      const fade = smoothstep(0, h * 0.25, y) * smoothstep(h, h * 0.55, y);
      for (let x = 0; x < w; x++) {
        const d = density(x, y);
        const a = smoothstep(0.5 - cover * 0.12, 0.72, d) * fade;
        if (a <= 0.01) continue;
        const lit = clamp((d - density(x - 1.5, y + 2.5)) * 5 + 0.45 + (y / h) * 0.35, 0, 1);
        const col = mixColor(CLOUD.dark, CLOUD.light, lit);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawClouds(ctx, g, t, props) {
    for (const cl of state.clouds) {
      const w = cl.canvas.width;
      const off = (t * cl.speed * (0.4 + props.wind * 0.6)) % w;
      ctx.drawImage(cl.canvas, -off, cl.y);
      ctx.drawImage(cl.canvas, w - off, cl.y);
    }
    // Faint air currents sliding across the storm.
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) {
      const y = g.H * (0.38 + i * 0.07) + Math.sin(t * 0.2 + i) * g.U;
      const x = ((t * (6 + i * 2) * props.wind + i * g.W * 0.37) % (g.W * 1.6)) - g.W * 0.3;
      const grad = ctx.createLinearGradient(x, y, x + g.W * 0.35, y - g.H * 0.08);
      grad.addColorStop(0, 'rgba(210,222,220,0)');
      grad.addColorStop(0.5, 'rgba(210,222,220,0.18)');
      grad.addColorStop(1, 'rgba(210,222,220,0)');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + g.W * 0.18, y - g.H * 0.02, x + g.W * 0.35, y - g.H * 0.08);
      ctx.stroke();
    }
  }

  // ---- wind ---------------------------------------------------------------

  // Lean (radians, + = downwind to the right) the wind gives at column x.
  function wind(x, y, t, props, pointer) {
    const base = props.wind * (0.25 + 0.2 * noise2(x * 0.015 - t * 0.25, t * 0.05, 7));
    const roll = Math.pow(Math.max(0, Math.sin(x * 0.045 - t * 1.1)), 6) * 0.45 * props.wind;
    let push = 0;
    for (const gust of state.gusts) {
      const d = Math.hypot(x - gust.x, (y - gust.y) * 0.6);
      const front = (t - gust.t) * 26;
      const band = Math.exp(-((d - front) ** 2) / 40);
      push += Math.sign(x - gust.x || 1) * band * 0.7 * Math.max(0, 1 - (t - gust.t) / 4);
    }
    return base + roll + push;
  }

  // ---- grass --------------------------------------------------------------

  function makeStalks(g, rand) {
    const stalks = [];
    const count = Math.round(g.W * 1.3);
    for (let i = 0; i < count; i++) {
      const depth = Math.pow(rand(), 0.8);
      stalks.push({
        x: rand() * (g.W + 20) - 10,
        base: g.H + 2 + depth * 6,
        height: lerp(0.1, 0.42, depth) * g.H * (0.75 + rand() * 0.5),
        lean: (rand() - 0.5) * 0.25,
        phase: rand() * Math.PI * 2,
        plume: lerp(0.35, 0.5, rand()),
        width: lerp(0.6, 2.6, depth),
        depth,
        tone: rand(),
      });
    }
    return stalks.sort((a, b) => a.depth - b.depth);
  }

  function drawStalk(ctx, s, t, props, pointer) {
    const tipY = s.base - s.height;
    const bend = s.lean + wind(s.x, tipY, t, props, pointer) + Math.sin(t * 1.7 + s.phase) * 0.04 * (1 + props.wind);
    const angle = clamp(bend, -1.1, 1.3);
    const tipX = s.x + Math.sin(angle) * s.height;
    const topY = s.base - Math.cos(angle) * s.height;
    const midX = s.x + Math.sin(angle * 0.4) * s.height * 0.55;
    const midY = s.base - s.height * 0.55;
    const far = 1 - s.depth;

    // Far stems vanish into the haze anyway; only the nearer ones get drawn.
    if (s.depth > 0.3) {
      ctx.strokeStyle = rgb(mixColor(GRASS.stem, SKY.mid, far * 0.6));
      ctx.lineWidth = Math.max(0.35, s.width * 0.3);
      ctx.beginPath();
      ctx.moveTo(s.x, s.base);
      ctx.quadraticCurveTo(midX, midY, tipX, topY);
      ctx.stroke();
    }

    // The plume: an arching feather that starts partway up the stem and curls
    // further downwind towards its tip; widest in the middle, tapered at both ends.
    const steps = 7;
    const len = s.height * s.plume;
    const curl = (0.035 + 0.045 * props.wind) * (0.7 + s.tone * 0.6) + Math.sin(t * 2.1 + s.phase) * 0.015;
    let px = lerp(midX, tipX, 0.5);
    let py = lerp(midY, topY, 0.5);
    let heading = angle * 0.8;
    const spine = [];
    for (let k = 0; k <= steps; k++) {
      spine.push({ x: px, y: py, h: heading });
      px += Math.sin(heading) * (len / steps);
      py -= Math.cos(heading) * (len / steps);
      heading += curl;
    }
    const fat = (k) => s.width * 1.5 * Math.sin(Math.PI * Math.pow(k / steps, 0.75)) + 0.2;
    ctx.fillStyle = rgb(mixColor(mixColor(GRASS.shade, GRASS.plume, s.tone), SKY.mid, far * 0.55), 0.82);
    ctx.beginPath();
    spine.forEach((p, k) => ctx[k ? 'lineTo' : 'moveTo'](p.x + Math.cos(p.h) * fat(k), p.y + Math.sin(p.h) * fat(k)));
    for (let k = steps; k >= 0; k--) ctx.lineTo(spine[k].x - Math.cos(spine[k].h) * fat(k), spine[k].y - Math.sin(spine[k].h) * fat(k));
    ctx.closePath();
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgb(mixColor(GRASS.glow, SKY.mid, far * 0.5), 0.85);
    ctx.lineWidth = Math.max(0.5, s.width * 0.6);
    ctx.beginPath();
    spine.slice(1).forEach((p, k) => ctx[k ? 'lineTo' : 'moveTo'](p.x - Math.cos(p.h) * fat(k + 1) * 0.3, p.y - Math.sin(p.h) * fat(k + 1) * 0.3));
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ---- sword --------------------------------------------------------------

  function drawSword(ctx, g, t) {
    const sw = state.sword;
    ctx.save();
    ctx.translate(sw.x, sw.y);
    ctx.rotate(sw.angle);
    const U = g.U;
    const blade = sw.length * 0.68;
    const handle = sw.length * 0.27;
    const w = 2.4 * U;

    // Blade: steel with a bright cutting edge, a gleam drifts down it now and then.
    const steel = ctx.createLinearGradient(-w, 0, w, 0);
    steel.addColorStop(0, rgb(STEEL.back));
    steel.addColorStop(0.55, rgb(STEEL.body));
    steel.addColorStop(1, rgb(STEEL.edge));
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, 0);
    ctx.lineTo(w * 0.7, 0);
    ctx.quadraticCurveTo(w * 0.85, -blade * 0.5, w * 0.6, -blade);
    ctx.lineTo(-w * 0.55, -blade);
    ctx.closePath();
    ctx.fill();
    const gleam = (t * 0.12) % 1.6;
    if (gleam < 1) {
      const y = -blade * (1 - gleam);
      const shine = ctx.createLinearGradient(0, y - 6 * U, 0, y + 6 * U);
      shine.addColorStop(0, 'rgba(255,255,255,0)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.fillRect(0, y - 6 * U, w * 0.75, 12 * U);
    }

    // Habaki and tsuba.
    ctx.fillStyle = rgb(P('#b8a46a'));
    ctx.fillRect(-w * 0.7, -blade - 1.6 * U, w * 1.5, 1.6 * U);
    ctx.fillStyle = rgb(TSUBA);
    ctx.beginPath();
    ctx.ellipse(0, -blade - 2.2 * U, w * 1.9, 1.1 * U, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tsuka: dark wrap crossing over a pale ray-skin, the diamond pattern.
    const top = -blade - 3 * U;
    const hw = w * 0.8;
    ctx.fillStyle = rgb(WRAP.light);
    ctx.fillRect(-hw, top - handle, hw * 2, handle);
    ctx.fillStyle = rgb(WRAP.dark);
    const diamonds = 7;
    const step = handle / diamonds;
    for (let k = 0; k < diamonds; k++) {
      const cy = top - step * (k + 0.5);
      ctx.beginPath();
      ctx.moveTo(-hw, cy - step * 0.5);
      ctx.lineTo(0, cy - step * 0.18);
      ctx.lineTo(hw, cy - step * 0.5);
      ctx.lineTo(hw, cy - step * 0.3);
      ctx.lineTo(0, cy);
      ctx.lineTo(-hw, cy - step * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(-hw * 1.1, top - handle - 1.2 * U, hw * 2.2, 1.4 * U);
    ctx.restore();
  }

  // ---- fluff --------------------------------------------------------------

  function makeFluff(g, rand) {
    return Array.from({ length: Math.round((g.W * g.H) / 160) }, () => ({
      x: rand() * g.W,
      y: rand() * g.H,
      size: rand() < 0.12 ? 2 : 1,
      phase: rand() * 6.28,
      lift: 0.3 + rand() * 0.9,
    }));
  }

  function drawFluff(ctx, g, t, dt, props, pointer) {
    const shown = Math.round(state.fluff.length * clamp(props.fluff / 2, 0, 1));
    for (let i = 0; i < shown; i++) {
      const f = state.fluff[i];
      const push = wind(f.x, f.y, t, props, pointer);
      f.x += (2 + push * 14) * dt;
      f.y += (Math.sin(t * 0.8 + f.phase) * 1.2 - f.lift) * dt;
      if (f.x > g.W + 3) f.x = -3;
      if (f.x < -3) f.x = g.W + 3;
      if (f.y < -3) f.y = g.H + 2;
      if (f.y > g.H + 3) f.y = -2;
      const a = 0.35 + 0.45 * Math.max(0, Math.sin(t * 1.3 + f.phase));
      ctx.fillStyle = rgb(FLUFF, f.size > 1 ? a * 0.6 : a);
      ctx.fillRect(f.x, f.y, f.size, f.size);
    }
  }

  // ---- scene --------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(api.seed);
    state.sky = paintSky(g);
    state.clouds = [
      { canvas: paintClouds(g, api.seed % 97, g.H * 0.6, 0.016, 1.1), y: -g.H * 0.05, speed: 1.2 },
      { canvas: paintClouds(g, (api.seed % 89) + 30, g.H * 0.7, 0.024, 0.8), y: g.H * 0.12, speed: 2.4 },
    ];
    state.stalks = makeStalks(g, rand);
    state.fluff = makeFluff(g, rand);
    state.gusts = [];
    state.sword = { x: g.W * 0.72, y: g.H * 1.0, angle: -0.22, length: g.H * 0.9 };
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const pointer = api.pointer;
    state.now = t;
    state.gusts = state.gusts.filter((gust) => t - gust.t < 4);

    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props);
    let i = 0;
    const stalks = state.stalks;
    for (; i < stalks.length && stalks[i].depth < 0.55; i++) drawStalk(ctx, stalks[i], t, props, pointer);
    if (props.sword) drawSword(ctx, g, t);
    for (; i < stalks.length; i++) drawStalk(ctx, stalks[i], t, props, pointer);
    drawFluff(ctx, g, t, dt, props, pointer);
  }

  Kasuri.run({
    defaults: {
      wind: 1,
      fluff: 1,
      sword: true,
      ramp: 'lines',
      cell: 8,
      boost: 0.25,
      gain: 1.2,
    },
    maxFps: 24,
    setup,
    draw,
  });
})();
