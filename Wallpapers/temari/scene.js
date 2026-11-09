/*
 * 手毬 Temari — an embroidered thread ball turning slowly on a cushion at night.
 *
 * The room and cushion are baked once. The ball's pattern repeats every eighth of a
 * turn, so that eighth is baked as a short strip of poses when the grid or tilt
 * changes; each tick draws two neighbouring poses and fades between them.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { smoothstep } = K;

  const TAU = Math.PI * 2;
  const SEGMENTS = 8;
  const SEG = TAU / SEGMENTS;
  const FRAMES = 24;
  const SEG_SECONDS = 7;
  const LIGHT = normalise([-0.5, 0.62, 0.6]);
  const INK = {
    indigo: K.parseColor('#2c3c62'),
    indigoLit: K.parseColor('#3d5284'),
    verm: K.parseColor('#b4442c'),
    vermLit: K.parseColor('#d26a46'),
    washi: K.parseColor('#e8dec4'),
    gold: K.parseColor('#cfa64c'),
    moss: K.parseColor('#6e7f48'),
    plum: K.parseColor('#7a3a4a'),
  };
  const NORTH_RINGS = [INK.verm, INK.washi, INK.vermLit, INK.gold, INK.verm, INK.washi];
  const SOUTH_RINGS = [INK.moss, INK.washi, INK.gold, INK.moss, INK.washi];
  const state = {};

  function normalise(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const R = Math.max(6, Math.round(Math.min(H * 0.31, W * 0.26)));
    return { W, H, R, cx: Math.round(W * 0.5), cy: Math.round(H * 0.45) };
  }

  // ---- the thread pattern on the sphere ------------------------------------

  function ring(rings, d, out) {
    const k = Math.min(rings.length - 1, Math.floor(d * rings.length));
    const c = rings[k];
    const stitch = 0.9 + 0.1 * Math.sin(d * 90);
    out[0] = c[0] * stitch;
    out[1] = c[1] * stitch;
    out[2] = c[2] * stitch;
  }

  function pattern(lat, lon, out) {
    const cl = Math.cos(lat);
    const a = ((lon % SEG) + SEG) % SEG;
    const u = a / SEG;
    const al = Math.abs(lat);
    if (lat > 1.38) return copy(INK.gold, out, 1);
    if (Math.min(u, 1 - u) * SEG * cl < 0.022) return copy(INK.gold, out, 1);
    if (al < 0.1) {
      if (al < 0.022) return copy(INK.verm, out, 1);
      if (al > 0.078) return copy(INK.gold, out, 1);
      return copy(INK.washi, out, 0.94 + 0.06 * Math.sin(lon * 60));
    }
    if (lat > 0) {
      const d = Math.abs(u - 0.5) * 2 + Math.abs(lat - 0.74) / 0.62;
      if (d < 1) return ring(NORTH_RINGS, d, out);
    } else {
      const v = Math.min(u, 1 - u) * 2;
      const d = v + Math.abs(lat + 0.74) / 0.62;
      if (d < 1) return ring(SOUTH_RINGS, d, out);
    }
    const wrap = 0.5 + 0.5 * Math.sin((lon * cl * 2.2 + lat) * 70);
    out[0] = INK.indigo[0] + (INK.indigoLit[0] - INK.indigo[0]) * wrap * 0.6;
    out[1] = INK.indigo[1] + (INK.indigoLit[1] - INK.indigo[1]) * wrap * 0.6;
    out[2] = INK.indigo[2] + (INK.indigoLit[2] - INK.indigo[2]) * wrap * 0.6;
    return out;
  }

  function copy(c, out, k) {
    out[0] = c[0] * k;
    out[1] = c[1] * k;
    out[2] = c[2] * k;
    return out;
  }

  // ---- baking the turning ball ---------------------------------------------

  function diskMap(R, tilt) {
    const D = R * 2;
    const n = D * D;
    const lat = new Float32Array(n);
    const lon = new Float32Array(n);
    const lum = new Float32Array(n);
    const alpha = new Float32Array(n);
    const ca = Math.cos(tilt);
    const sa = Math.sin(tilt);
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < D; x++) {
        const i = y * D + x;
        const sx = (x + 0.5 - R) / R;
        const up = -(y + 0.5 - R) / R;
        const rr = sx * sx + up * up;
        alpha[i] = smoothstep(1.0, 0.94, Math.sqrt(rr));
        if (rr >= 1) continue;
        const z = Math.sqrt(1 - rr);
        const by = up * ca + z * sa;
        const bz = -up * sa + z * ca;
        lat[i] = Math.asin(Math.max(-1, Math.min(1, by)));
        lon[i] = Math.atan2(sx, bz);
        const diff = Math.max(0, sx * LIGHT[0] + up * LIGHT[1] + z * LIGHT[2]);
        const rim = Math.pow(1 - z, 3) * 0.25;
        lum[i] = 0.28 + diff * 0.82 - rim;
      }
    }
    return { D, lat, lon, lum, alpha };
  }

  function bakeBall(g, tilt) {
    const m = diskMap(g.R, tilt);
    const sheet = layer(m.D * FRAMES, m.D);
    const ctx = sheet.getContext('2d');
    const img = ctx.createImageData(m.D, m.D);
    const d = img.data;
    const c = [0, 0, 0];
    for (let f = 0; f < FRAMES; f++) {
      const turn = (f / FRAMES) * SEG;
      for (let i = 0; i < m.D * m.D; i++) {
        const o = i * 4;
        if (m.alpha[i] <= 0) {
          d[o + 3] = 0;
          continue;
        }
        pattern(m.lat[i], m.lon[i] + turn, c);
        const l = m.lum[i];
        d[o] = Math.min(255, c[0] * l);
        d[o + 1] = Math.min(255, c[1] * l);
        d[o + 2] = Math.min(255, c[2] * l);
        d[o + 3] = m.alpha[i] * 255;
      }
      ctx.putImageData(img, f * m.D, 0);
    }
    return sheet;
  }

  // ---- the room ------------------------------------------------------------

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const glow = ctx.createRadialGradient(g.cx, g.cy, g.R * 0.5, g.cx, g.cy, g.H * 1.1);
    glow.addColorStop(0, '#2e3448');
    glow.addColorStop(0.5, '#1d2132');
    glow.addColorStop(1, '#13151d');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    const floor = Math.round(g.cy + g.R * 1.12);
    ctx.fillStyle = '#2a2a22';
    ctx.fillRect(0, floor, g.W, g.H - floor);
    ctx.fillStyle = '#34342a';
    for (let y = floor + 2; y < g.H; y += Math.max(2, Math.round(g.R * 0.09))) {
      ctx.fillRect(0, y, g.W, 1);
    }
    ctx.fillStyle = '#4a4430';
    ctx.fillRect(0, floor, g.W, Math.max(1, Math.round(g.R * 0.03)));
    paintCushion(ctx, g);
    return c;
  }

  function paintCushion(ctx, g) {
    const top = g.cy + g.R * 0.86;
    const w = g.R * 1.7;
    const h = g.R * 0.32;
    ctx.fillStyle = '#121218';
    ctx.beginPath();
    ctx.ellipse(g.cx, top + h * 1.05, w * 1.05, h * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6e2c22';
    ctx.beginPath();
    ctx.ellipse(g.cx, top + h * 0.55, w, h * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8f3e2c';
    ctx.beginPath();
    ctx.ellipse(g.cx, top + h * 0.35, w * 0.96, h * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c9a24a';
    for (const s of [-1, 1]) {
      const x = g.cx + s * w * 0.98;
      ctx.fillRect(x - 0.5, top + h * 0.5, 1, h * 0.45);
      ctx.beginPath();
      ctx.ellipse(x, top + h * 0.45, Math.max(1, g.R * 0.04), Math.max(1, g.R * 0.04), 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(10,10,16,0.55)';
    ctx.beginPath();
    ctx.ellipse(g.cx + g.R * 0.12, top + h * 0.28, g.R * 0.8, h * 0.28, 0, 0, TAU);
    ctx.fill();
  }

  // ---- run -----------------------------------------------------------------

  function rebake(api) {
    state.tilt = api.props.tilt;
    state.sheet = bakeBall(state.g, 0.12 + state.tilt * 0.6);
  }

  function setup(ctx, api) {
    state.g = geometry(api);
    state.room = paintRoom(state.g, K.rng(api.seed));
    state.angle = 0;
    rebake(api);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    if (api.props.tilt !== state.tilt) rebake(api);
    state.angle = (state.angle + (Math.min(dt, 0.1) * api.props.turn) / SEG_SECONDS) % 1;
    const p = state.angle * FRAMES;
    const a = Math.floor(p) % FRAMES;
    const b = (a + 1) % FRAMES;
    const D = g.R * 2;
    const x = g.cx - g.R;
    const y = g.cy - g.R;
    ctx.drawImage(state.room, 0, 0);
    ctx.drawImage(state.sheet, a * D, 0, D, D, x, y, D, D);
    ctx.globalAlpha = p - Math.floor(p);
    ctx.drawImage(state.sheet, b * D, 0, D, D, x, y, D, D);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { turn: 1, tilt: 0.5, ramp: 'lines', cell: 6, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
