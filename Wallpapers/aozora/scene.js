/*
 * 青空 Aozora — a clear blue sky over a quiet street of tiled roofs.
 *
 * Sky and roofs are baked into two layers and repainted once a minute from the
 * clock. Between repaints only two cloud strips, the power line and a pair of
 * swallows move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.62;
  const STREET = 0.86;
  const POLE_X = 0.8;
  const RETINT_SECONDS = 60;
  const WIRE_STEPS = 18;
  const WIRES = [0.2, 0.235, 0.27];
  // x centre, width, ridge y, eave y, depth (0 far, 1 near)
  const HOUSES = [
    { x: 0.1, w: 0.2, top: 0.6, eave: 0.68, far: 1 },
    { x: 0.36, w: 0.22, top: 0.58, eave: 0.67, far: 1 },
    { x: 0.62, w: 0.2, top: 0.6, eave: 0.68, far: 1 },
    { x: 0.9, w: 0.22, top: 0.59, eave: 0.68, far: 1 },
    { x: 0.2, w: 0.34, top: 0.64, eave: 0.76, far: 0 },
    { x: 0.55, w: 0.36, top: 0.62, eave: 0.75, far: 0 },
    { x: 0.88, w: 0.32, top: 0.65, eave: 0.76, far: 0 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const dusk = (c, sky, k) => mixColor(c, rgb('#1a1e34'), sky.night * k);

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    const clear = 0.3 * (1 - sky.night);
    grad.addColorStop(0, hex(mixColor(sky.top, rgb('#5f9ad8'), clear)));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#bcdcf0'), clear)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // Fair-weather cumulus: round tops, flat shaded bases. Tiles sideways.
  function paintClouds(g, w, h, seed, count, scale) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(seed);
    for (let n = 0; n < count; n++) {
      const cx = ((n + 0.3 + rand() * 0.4) / count) * w;
      const cy = h * (0.35 + rand() * 0.45);
      const span = g.U * scale * (9 + rand() * 7);
      const base = cy + span * 0.12;
      const lobes = 6 + Math.floor(rand() * 3);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, base);
      ctx.clip();
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 0; k < lobes; k++) {
          const f = k / (lobes - 1) - 0.5;
          const lx = cx + f * span * 1.6;
          const r = span * (0.22 + (1 - Math.abs(f) * 1.7) * 0.3 + rand() * 0.16);
          const ly = base - r * 0.55;
          ctx.fillStyle = pass === 0 ? '#c9d4e2' : '#fbfbf8';
          ctx.beginPath();
          ctx.arc(lx + (w * 0 + 0), ly + (pass === 0 ? r * 0.12 : 0), r * (pass === 0 ? 1 : 0.94), 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    // Soft bottom edge: cut anything below each baseline with a gradient mask.
    return c;
  }

  // ---- roofs -------------------------------------------------------------

  function paintRoof(ctx, g, sky, hs) {
    const cx = g.W * hs.x;
    const hw = (g.W * hs.w) / 2;
    const yTop = g.H * hs.top;
    const yEave = g.H * hs.eave;
    const haze = hs.far ? 0.4 : 0;
    const tile = mixColor(mixColor(rgb('#3a4258'), sky.amb, 0.1), sky.haze, haze);
    const tileLight = mixColor(tile, rgb('#7d88a4'), 0.3);
    const tileDark = mixColor(tile, rgb('#1c2030'), 0.4);
    const mat = (c) => hex(dusk(c, sky, 0.7));
    // Wall below the eave: plaster with a dark timber band.
    const wallW = hw * 1.7;
    const wallBottom = g.H * (hs.far ? 0.8 : STREET - 0.03);
    const plaster = mixColor(mixColor(rgb('#ebe4d0'), sky.amb, 0.25), sky.haze, haze * 0.8);
    ctx.fillStyle = mat(plaster);
    ctx.fillRect(cx - wallW / 2, yEave, wallW, wallBottom - yEave);
    ctx.fillStyle = mat(mixColor(rgb('#4a382a'), sky.haze, haze));
    ctx.fillRect(cx - wallW / 2, yEave, wallW, Math.max(1, g.U * 0.9));
    const post = Math.max(1, g.U * 0.5);
    for (let k = 0; k <= 4; k++) ctx.fillRect(cx - wallW / 2 + (wallW - post) * (k / 4), yEave, post, wallBottom - yEave);
    // Lattice windows, lit warm at night.
    if (!hs.far) {
      for (let k = 0; k < 3; k++) {
        const wx = cx - wallW / 2 + wallW * (0.12 + k * 0.3);
        const wy = yEave + g.U * 3;
        ctx.fillStyle = mat(mixColor(rgb('#d9cfa8'), rgb('#f2c86a'), sky.night));
        ctx.fillRect(wx, wy, wallW * 0.2, g.U * 4.5);
        ctx.fillStyle = mat(rgb('#4a382a'));
        for (let b = 0; b <= 4; b++) ctx.fillRect(wx + (wallW * 0.2) * (b / 4), wy, 1, g.U * 4.5);
      }
    }
    // Hip roof: trapezoid with upturned eaves.
    const over = hw * 1.05;
    const ridgeHalf = hw * 0.34;
    ctx.fillStyle = mat(tile);
    ctx.beginPath();
    ctx.moveTo(cx - ridgeHalf, yTop);
    ctx.lineTo(cx + ridgeHalf, yTop);
    ctx.lineTo(cx + over, yEave);
    ctx.quadraticCurveTo(cx, yEave + g.U * 0.9, cx - over, yEave);
    ctx.closePath();
    ctx.fill();
    // Tile courses: rows of slightly lighter lines with staggered ticks.
    const rows = Math.max(4, Math.round((yEave - yTop) / (g.U * 1.2)));
    for (let r = 1; r < rows; r++) {
      const f = r / rows;
      const ry = lerp(yTop, yEave, f);
      const half = lerp(ridgeHalf, over, f);
      ctx.fillStyle = mat(tileDark);
      ctx.fillRect(cx - half, ry, half * 2, 1);
      ctx.fillStyle = mat(tileLight);
      const pitch = Math.max(2, g.U * 1.3);
      for (let tx = -half + ((r % 2) * pitch) / 2; tx < half; tx += pitch) ctx.fillRect(cx + tx, ry - Math.max(1, g.U * 0.6), 1, Math.max(1, g.U * 0.6));
    }
    // Ridge capping and the end tiles that curl up at each side.
    ctx.fillStyle = mat(tileDark);
    ctx.fillRect(cx - ridgeHalf - g.U * 0.6, yTop - g.U * 0.8, ridgeHalf * 2 + g.U * 1.2, g.U * 1.1);
    ctx.fillStyle = mat(tileLight);
    ctx.fillRect(cx - ridgeHalf - g.U * 0.6, yTop - g.U * 0.8, ridgeHalf * 2 + g.U * 1.2, 1);
    ctx.fillStyle = mat(tileDark);
    ctx.beginPath();
    ctx.arc(cx - ridgeHalf - g.U * 0.6, yTop - g.U * 0.9, g.U * 0.9, 0, TAU);
    ctx.arc(cx + ridgeHalf + g.U * 0.6, yTop - g.U * 0.9, g.U * 0.9, 0, TAU);
    ctx.fill();
    // White plaster seams along the hips.
    ctx.strokeStyle = mat(plaster);
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.beginPath();
    ctx.moveTo(cx - ridgeHalf, yTop);
    ctx.lineTo(cx - over, yEave);
    ctx.moveTo(cx + ridgeHalf, yTop);
    ctx.lineTo(cx + over, yEave);
    ctx.stroke();
    // Eave shadow.
    ctx.fillStyle = mat(mixColor(rgb('#6a5a48'), rgb('#1c1a1c'), 0.3));
    ctx.fillRect(cx - over, yEave, over * 2, Math.max(1, g.U * 0.5));
  }

  function paintStreet(ctx, g, sky) {
    const top = g.H * STREET;
    // Plaster wall with a tiled cap along the street edge.
    const wallTop = g.H * (STREET - 0.075);
    ctx.fillStyle = hex(dusk(mixColor(rgb('#e4dcc6'), sky.amb, 0.25), sky, 0.7));
    ctx.fillRect(0, wallTop, g.W, top - wallTop);
    ctx.fillStyle = hex(dusk(rgb('#3a4258'), sky, 0.7));
    ctx.fillRect(0, wallTop - g.U * 1.2, g.W, g.U * 1.4);
    ctx.fillStyle = hex(dusk(rgb('#7d88a4'), sky, 0.7));
    ctx.fillRect(0, wallTop - g.U * 1.2, g.W, 1);
    // Dark timber boards at the foot of the wall.
    ctx.fillStyle = hex(dusk(rgb('#3c2e22'), sky, 0.7));
    ctx.fillRect(0, top - g.U * 3.4, g.W, g.U * 3.4);
    ctx.fillStyle = hex(dusk(rgb('#5a4636'), sky, 0.7));
    for (let x = 0; x < g.W; x += g.U * 2) ctx.fillRect(x, top - g.U * 3.4, 1, g.U * 3.4);
    // Road.
    const road = dusk(mixColor(rgb('#8a8d94'), sky.amb, 0.15), sky, 0.7);
    ctx.fillStyle = hex(road);
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = hex(mixColor(road, rgb('#e8e6dc'), 0.45));
    ctx.fillRect(0, top + g.U * 2.5, g.W, Math.max(1, g.U * 0.5));
    ctx.fillRect(0, g.H - g.U * 2.4, g.W, Math.max(1, g.U * 0.5));
  }

  function paintPole(ctx, g, sky) {
    const px = g.W * POLE_X;
    const w = Math.max(2, g.U * 1.5);
    const top = g.H * 0.17;
    const base = g.H * STREET;
    const body = hex(dusk(mixColor(rgb('#8c8a84'), sky.amb, 0.2), sky, 0.7));
    ctx.fillStyle = body;
    ctx.fillRect(px - w / 2, top, w, base - top);
    ctx.fillStyle = hex(dusk(rgb('#5e5c58'), sky, 0.7));
    ctx.fillRect(px + w / 2 - 1, top, 1, base - top);
    ctx.fillStyle = body;
    for (const f of [0.19, 0.255]) ctx.fillRect(px - g.U * 7, g.H * f, g.U * 14, Math.max(1, g.U * 0.9));
    ctx.fillRect(px - g.U * 4, g.H * 0.31, g.U * 8, Math.max(1, g.U * 0.9));
    // Rungs of the climbing steps and small insulators.
    ctx.fillStyle = hex(dusk(rgb('#4a4a4c'), sky, 0.7));
    for (let y = g.H * 0.4; y < base; y += g.U * 5) ctx.fillRect(px - w, y, w * 2, 1);
    ctx.fillStyle = hex(dusk(rgb('#e6e2d4'), sky, 0.6));
    for (const dx of [-6, -3, 3, 6]) ctx.fillRect(px + g.U * dx - 1, g.H * 0.19 - g.U * 1.3, 2, g.U * 1.3);
    for (const dx of [-6, -3, 3, 6]) ctx.fillRect(px + g.U * dx - 1, g.H * 0.255 - g.U * 1.3, 2, g.U * 1.3);
  }

  function paintFront(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    // A low band of haze where the far roofs meet the sky.
    for (const hs of HOUSES.filter((h) => h.far)) paintRoof(ctx, g, sky, hs);
    for (const hs of HOUSES.filter((h) => !h.far)) paintRoof(ctx, g, sky, hs);
    paintStreet(ctx, g, sky);
    paintPole(ctx, g, sky);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    state.sky = paintSky(g, sky, K.rng(17));
    state.front = paintFront(g, sky);
    state.cloudAlpha = 0.95 - sky.night * 0.65;
    state.wire = hex(mixColor(rgb('#2a2c34'), sky.top, 0.35));
    state.bird = hex(mixColor(rgb('#20222c'), sky.top, 0.2));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawStrip(ctx, c, off, y, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const a = Math.min(1, state.cloudAlpha * amount);
    drawStrip(ctx, state.farClouds, -((t * g.U * 0.9) % state.farClouds.width), g.H * 0.28, a * 0.8);
    drawStrip(ctx, state.nearClouds, -((t * g.U * 2.1) % state.nearClouds.width), g.H * 0.04, a);
  }

  // Wires hang from the cross-arm and run off both sides; the sag swells and eases.
  function drawWires(ctx, g, t, sway) {
    const px = g.W * POLE_X;
    ctx.strokeStyle = state.wire;
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.globalAlpha = 0.85;
    const rest = sway ? 1 : 0;
    for (let w = 0; w < WIRES.length; w++) {
      const y0 = g.H * WIRES[w];
      for (let side = -1; side <= 1; side += 2) {
        const xe = side < 0 ? -g.W * 0.02 : g.W * 1.02;
        const len = Math.abs(xe - px);
        const sag = g.U * (6 + w * 1.2) * (1 + rest * 0.18 * Math.sin(t * 0.7 + w * 1.3 + side));
        ctx.beginPath();
        for (let i = 0; i <= WIRE_STEPS; i++) {
          const f = i / WIRE_STEPS;
          const gust = rest * Math.sin(t * 0.9 + f * 3 + w) * g.U * 0.6 * Math.sin(f * Math.PI);
          const x = px + (xe - px) * f;
          const y = y0 + (xe < px ? 0 : 0) + sag * 4 * f * (1 - f) + gust + (xe - px) * 0.0 + (y0 > 0 ? f * g.U * 3 * (side > 0 ? 1 : -0.4) : 0);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        void len;
      }
    }
    ctx.globalAlpha = 1;
  }

  // Two swallows circling on the same slow loop.
  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = state.bird;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let b = 0; b < 2; b++) {
      const a = t * 0.12 + b * 0.31;
      const bx = g.W * (0.3 + 0.4 * (0.5 + 0.5 * Math.sin(a * TAU)));
      const by = g.H * (0.34 + 0.05 * Math.sin(a * TAU * 2 + b)) + b * g.U * 5;
      const flap = Math.sin(t * 6 + b * 2) * g.U * 0.9;
      ctx.beginPath();
      ctx.moveTo(bx - g.U * 2, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + g.U * 2, by - flap);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.nearClouds = paintClouds(g, Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3), 41, 3, 1);
    state.farClouds = paintClouds(g, Math.ceil(g.W * 1.2), Math.ceil(g.H * 0.2), 77, 3, 0.6);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    drawBirds(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawWires(ctx, g, t, props.sway);
  }

  Kasuri.run({
    defaults: { time: 'day', clouds: 1, sway: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
