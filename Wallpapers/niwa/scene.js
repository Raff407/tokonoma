/*
 * 枯山水 Niwa — a dry garden: raked gravel, three rocks, a little moss.
 *
 * Every cell keeps a rake phase. Far from the rocks the lines run straight;
 * near one they curl round it. Dragging the cursor rakes new grooves into the
 * phase field, and a slow sweep eases them back to the garden's own lines, as
 * if someone tidied up. Cloud shadow crosses it all.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, parseColor: P, mixColor, toHex } = K;

  const GROOVE = P('#64604f');
  const CREST = P('#d4cdb8');
  const STEPS = 256;
  const FREQ = 0.72;

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function placeRocks(g) {
    return [
      { x: g.W * 0.28, y: g.H * 0.44, a: g.U * 12, b: g.U * 8, tall: g.U * 11 },
      { x: g.W * 0.38, y: g.H * 0.54, a: g.U * 6, b: g.U * 4, tall: g.U * 5 },
      { x: g.W * 0.72, y: g.H * 0.68, a: g.U * 9, b: g.U * 6, tall: g.U * 8 },
    ];
  }

  // Scaled distance to the nearest rock edge; 0 at the rim.
  function rockDistance(rocks, x, y) {
    let best = 1e9;
    for (const r of rocks) {
      const dx = (x - r.x) / r.a;
      const dy = (y - r.y) / r.b;
      const d = (Math.sqrt(dx * dx + dy * dy) - 1) * Math.min(r.a, r.b);
      if (d < best) best = d;
    }
    return best;
  }

  function buildBase(g, rocks) {
    const base = new Float32Array(g.W * g.H);
    const reach = g.U * 15;
    const pitch = (Math.PI * 2 * FREQ) / (g.U * 2.8);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const d = rockDistance(rocks, x, y);
        base[y * g.W + x] = (d < reach ? Math.max(0, d) : y) * pitch;
      }
    }
    return base;
  }

  function makeTable() {
    const table = new Uint32Array(STEPS);
    for (let i = 0; i < STEPS; i++) {
      const c = mixColor(GROOVE, CREST, i / (STEPS - 1));
      table[i] = (255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0]);
    }
    return table;
  }

  function paintRock(ctx, g, r, rand) {
    const shadow = ctx.createRadialGradient(r.x + r.a * 0.5, r.y + r.b * 0.5, 0, r.x + r.a * 0.5, r.y + r.b * 0.5, r.a * 1.5);
    shadow.addColorStop(0, 'rgba(24,22,20,0.65)');
    shadow.addColorStop(1, 'rgba(24,22,20,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(r.x - r.a * 2, r.y - r.b * 2, r.a * 4, r.b * 4);
    const moss = ctx.createRadialGradient(r.x, r.y, r.b * 0.4, r.x, r.y, r.a * 1.1);
    moss.addColorStop(0, '#47603a');
    moss.addColorStop(0.75, '#34502f');
    moss.addColorStop(1, 'rgba(40,70,40,0)');
    ctx.fillStyle = moss;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.a * 1.08, r.b * 1.12, 0, 0, 6.3);
    ctx.fill();
    const stone = ctx.createLinearGradient(r.x - r.a, r.y - r.tall, r.x + r.a * 0.6, r.y + r.b);
    stone.addColorStop(0, '#a8a397');
    stone.addColorStop(0.5, '#6a6660');
    stone.addColorStop(1, '#2c2a27');
    ctx.fillStyle = stone;
    ctx.beginPath();
    const points = 11;
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * 6.283;
      const rough = 0.78 + rand() * 0.22;
      const px = r.x + Math.cos(a) * r.a * 0.86 * rough;
      const py = r.y - r.tall * 0.25 + Math.sin(a) * (Math.sin(a) < 0 ? r.tall : r.b * 0.75) * rough;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.fill();
  }

  function paintRocks(g, rocks, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const r of rocks) paintRock(ctx, g, r, rand);
    // A clay wall along the top, the one straight thing in the garden.
    ctx.fillStyle = '#6b4f3e';
    ctx.fillRect(0, 0, g.W, g.H * 0.09);
    ctx.fillStyle = '#26211f';
    ctx.fillRect(0, g.H * 0.09, g.W, Math.max(1, g.U * 0.9));
    ctx.fillStyle = '#2b2a2b';
    ctx.fillRect(0, 0, g.W, Math.max(1, g.U * 2.2));
    return c;
  }

  function paintShadow(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.018, y * 0.03, 3, 8);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 22;
        img.data[i + 1] = 26;
        img.data[i + 2] = 38;
        img.data[i + 3] = smoothstep(0.42, 0.66, v) * 70;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function rakeAt(g, x, y, dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 0.3) return;
    const ux = dx / len;
    const uy = dy / len;
    const width = g.U * 7;
    const pitch = (Math.PI * 2 * FREQ) / (g.U * 2.8);
    const x0 = Math.max(0, Math.floor(x - width));
    const x1 = Math.min(g.W - 1, Math.ceil(x + width));
    const y0 = Math.max(0, Math.floor(y - width));
    const y1 = Math.min(g.H - 1, Math.ceil(y + width));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const rx = px - x;
        const ry = py - y;
        if (rx * rx + ry * ry > width * width) continue;
        state.phase[py * g.W + px] = (rx * -uy + ry * ux) * pitch;
      }
    }
  }

  function followPointer(g, pointer) {
    if (!pointer.active) {
      state.last = null;
      return;
    }
    if (state.last) rakeAt(g, pointer.x, pointer.y, pointer.x - state.last.x, pointer.y - state.last.y);
    state.last = state.last || { x: 0, y: 0 };
    state.last.x = pointer.x;
    state.last.y = pointer.y;
  }

  // One row per draw eases back towards the original lines.
  function tidy(g) {
    const y = state.tidyRow;
    state.tidyRow = (y + 1) % g.H;
    const start = y * g.W;
    for (let i = start; i < start + g.W; i++) state.phase[i] += (state.base[i] - state.phase[i]) * 0.04;
  }

  function paintGravel(ctx, g, t, light) {
    const { phase, pixels, table } = state;
    const sweep = t * 0.1;
    const kx = 5 / g.W;
    let i = 0;
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++, i++) {
        const lit = 0.9 + 0.1 * Math.sin(x * kx + sweep);
        const v = (0.5 + 0.5 * Math.sin(phase[i])) * lit * light;
        pixels[i] = table[(v * 255) | 0];
      }
    }
    ctx.putImageData(state.image, 0, 0);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rocks = placeRocks(g);
    state.g = g;
    state.base = buildBase(g, rocks);
    state.phase = state.base.slice();
    state.image = ctx.createImageData(g.W, g.H);
    state.pixels = new Uint32Array(state.image.data.buffer);
    state.table = makeTable();
    state.rocks = paintRocks(g, rocks, K.rng(api.seed));
    state.shadow = paintShadow(Math.ceil(g.W * 1.5), g.H);
    state.tidyRow = 0;
    state.last = null;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    followPointer(g, api.pointer);
    tidy(g);
    paintGravel(ctx, g, t, api.props.light);
    const w = state.shadow.width;
    const x = -((t * g.U * 1.6 * api.props.clouds) % w);
    ctx.drawImage(state.shadow, x, 0);
    ctx.drawImage(state.shadow, x + w, 0);
    ctx.drawImage(state.rocks, 0, 0);
  }

  Kasuri.run({
    defaults: { light: 0.95, clouds: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.25, tint: 0.6 },
    maxFps: 20,
    setup,
    draw,
  });
})();
