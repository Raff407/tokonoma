/*
 * 潮騒 Shiosai — waves breaking on black basalt rocks at a cape, with a small
 * lighthouse on a far headland in the evening light.
 *
 * Sky, sea, headland and rocks are baked into layers and repainted once a
 * minute from the clock. Between repaints only swell lines, foam at the rock
 * feet, a few droplets, the lighthouse glow and three gulls move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.46;
  const RETINT_SECONDS = 60;
  const SWELLS = 7;
  const DROPS = 8;
  const state = {};

  // Where the sea meets rock: x and y as fractions, foam width, cycle seconds, offset.
  const SITES = [
    { x: 0.31, y: 0.85, w: 0.2, per: 7.3, off: 0.0 },
    { x: 0.56, y: 0.775, w: 0.17, per: 6.1, off: 0.37 },
    { x: 0.4, y: 0.695, w: 0.08, per: 5.3, off: 0.71 },
    { x: 0.7, y: 0.9, w: 0.18, per: 8.1, off: 0.55 },
  ];
  const GULLS = [
    { y: 0.2, per: 70, off: 0.1, size: 1.3 },
    { y: 0.28, per: 90, off: 0.55, size: 1.0 },
    { y: 0.15, per: 110, off: 0.8, size: 0.8 },
  ];

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky and far shore ---------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.35, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // Long thin evening clouds lying along the horizon.
    ctx.fillStyle = hex(mixColor(sky.amb, sky.top, 0.25 + sky.night * 0.4));
    for (let i = 0; i < 9; i++) {
      ctx.globalAlpha = 0.35;
      ctx.fillRect(rand() * g.W, g.H * (0.2 + rand() * 0.2), g.W * (0.08 + rand() * 0.18), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintSea(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * HORIZON;
    const deep = mixColor(rgb('#2c4068'), rgb('#080c1a'), sky.night * 0.8);
    const far = mixColor(mixColor(sky.low, sky.haze, 0.3), deep, 0.2);
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(0.4, hex(mixColor(far, deep, 0.55)));
    grad.addColorStop(1, hex(deep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, g.H - y0);
    // Low sun path: gold dashes thick near the horizon, thinning toward us.
    const glow = rgb('#d9a73a');
    ctx.fillStyle = hex(mixColor(glow, sky.amb, 0.3));
    for (let i = 0; i < g.W * 1.4; i++) {
      const f = Math.pow(rand(), 1.6);
      const y = y0 + f * (g.H - y0) * 0.7;
      const spread = g.W * (0.05 + f * 0.1);
      ctx.globalAlpha = (1 - f) * 0.5 * (1 - sky.night * 0.85);
      ctx.fillRect(g.W * 0.44 + (rand() - 0.5) * 2 * spread, y, g.U * (1 + rand() * 2.5), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // Foam line for the swell rows, built once.
  function paintSwellLine(g) {
    const c = layer(g.W, 3);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ecebe0';
    const rand = K.rng(7);
    let x = 0;
    while (x < g.W) {
      const len = g.U * (2 + rand() * 7);
      ctx.globalAlpha = 0.35 + rand() * 0.5;
      ctx.fillRect(x, 1, len, 1);
      if (rand() > 0.6) ctx.fillRect(x + len * 0.3, 0, len * 0.4, 1);
      x += len + g.U * (1 + rand() * 6);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintFoam(g) {
    const w = Math.max(16, Math.round(g.U * 22));
    const h = Math.max(5, Math.round(g.U * 4));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - w / 2) / (w / 2);
        const dy = (y - h * 0.6) / (h * 0.6);
        const d = 1 - (dx * dx + dy * dy);
        const v = d + (fbm(x * 0.35, y * 0.5, 3, 41) - 0.5) * 0.9;
        const i = (y * w + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 237;
        img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.1, 0.5, v) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintBeam(g) {
    const w = Math.round(g.W * 0.22);
    const h = Math.max(4, Math.round(g.U * 6));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(w, 0, 0, 0);
    grad.addColorStop(0, 'rgba(236,214,150,0.55)');
    grad.addColorStop(1, 'rgba(236,214,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(w, h / 2);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    return c;
  }

  // ---- headland with lighthouse ---------------------------------------------

  const LH = { x: 0.8 };

  function headlandTop(g, x) {
    const f = x / g.W;
    const hump = Math.max(0, 1 - Math.pow((f - 0.8) / 0.2, 2));
    return g.H * (HORIZON - 0.012 - 0.03 * hump) + (fbm(x * 0.12, 3, 3, 13) - 0.5) * g.U * 1.2;
  }

  function paintHeadland(ctx, g, sky) {
    const col = mixColor(mixColor(rgb('#3a4a62'), sky.haze, 0.55), rgb('#10162a'), sky.night * 0.65);
    ctx.fillStyle = hex(col);
    for (let x = Math.floor(g.W * 0.58); x < g.W; x++) {
      const top = headlandTop(g, x);
      ctx.fillRect(x, top, 1, g.H * HORIZON + 1 - top);
    }
    // A few pines on the ridge.
    ctx.fillStyle = hex(mixColor(col, rgb('#2c3d2c'), 0.4));
    const rand = K.rng(5);
    for (let i = 0; i < 14; i++) {
      const x = g.W * (0.7 + rand() * 0.28);
      const top = headlandTop(g, x);
      ctx.fillRect(x, top - g.U * (1 + rand() * 1.2), Math.max(1, g.U * 0.6), g.U * 1.4);
    }
    // The lighthouse: white tower, one vermilion band, gold lantern.
    const lx = g.W * LH.x;
    const base = headlandTop(g, lx) + 1;
    const th = g.U * 7;
    const tw = Math.max(2, g.U * 1.5);
    const dim = sky.night * 0.6;
    ctx.fillStyle = hex(mixColor(rgb('#ece8dc'), rgb('#40466a'), dim));
    ctx.beginPath();
    ctx.moveTo(lx - tw, base);
    ctx.lineTo(lx - tw * 0.6, base - th);
    ctx.lineTo(lx + tw * 0.6, base - th);
    ctx.lineTo(lx + tw, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb('#c0452c'), rgb('#30283a'), dim));
    ctx.fillRect(lx - tw * 0.85, base - th * 0.62, tw * 1.7, th * 0.2);
    ctx.fillStyle = hex(mixColor(rgb('#d9a73a'), rgb('#f0d890'), sky.night));
    ctx.fillRect(lx - tw * 0.7, base - th - g.U * 1.2, tw * 1.4, g.U * 1.2);
    ctx.fillStyle = hex(mixColor(rgb('#2a2c3a'), rgb('#101420'), sky.night * 0.5));
    ctx.fillRect(lx - tw * 0.9, base - th - g.U * 1.7, tw * 1.8, Math.max(1, g.U * 0.5));
    state.lamp = { x: lx, y: base - th - g.U * 0.6 };
  }

  // ---- black rocks ----------------------------------------------------------

  function inRock(g, x, y) {
    const fx = x / g.W;
    const fy = y / g.H;
    const n = (fbm(x * 0.09, y * 0.09, 3, 17) - 0.5) * g.U * 5;
    const edgeL = g.W * 0.4 * Math.pow(smoothstep(0.57, 1.0, fy), 0.8);
    if (x + n * 0.6 < edgeL) return true;
    const edgeR = g.W * (1 - 0.34 * smoothstep(0.7, 1.0, fy));
    if (fy > 0.7 && x + n * 0.6 > edgeR) return true;
    const e1 = ((fx - 0.56) / 0.085) ** 2 + ((fy - 0.745) / 0.05) ** 2;
    const e2 = ((fx - 0.4) / 0.035) ** 2 + ((fy - 0.675) / 0.03) ** 2;
    const jag = (fbm(x * 0.5, y * 0.25, 3, 51) - 0.5) * 0.9;
    return e1 + jag < 1 || e2 + jag < 1;
  }

  function paintRocks(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const w = c.width;
    const dark = mixColor(rgb('#1e2234'), rgb('#07080e'), sky.night * 0.7);
    const rim = mixColor(mixColor(rgb('#d9a73a'), sky.amb, 0.5), rgb('#46507a'), sky.night * 0.7);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < c.height; y++) {
        if (!inRock(g, x, y)) continue;
        const column = fbm(x * 0.35, y * 0.02, 2, 23) * 0.6 + (((x * 7) % 9) < 1 ? 0.4 : 0);
        const crack = fbm(x * 0.05, y * 0.12, 3, 29);
        let col = mixColor(dark, rgb('#2c3350'), column * 0.35 + crack * 0.2);
        const open = !inRock(g, x, y - 1) ? 1 : !inRock(g, x, y - 2) ? 0.5 : 0;
        const sideOpen = !inRock(g, x + 1, y) ? 0.5 : 0;
        const lit = Math.max(open, sideOpen) * (0.6 + column * 0.4);
        const face = smoothstep(0.55, 0.9, fbm(x * 0.06, y * 0.1, 3, 61)) * 0.35;
        col = mixColor(col, rim, Math.max(lit, face * (1 - sky.night * 0.6)) * (1 - sky.night * 0.5));
        // Wet sheen low on the rock where the water reaches.
        const wet = smoothstep(0.7, 0.98, y / g.H) * 0.12;
        col = mixColor(col, rgb('#4a5a80'), wet * column);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- bake -----------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    bctx.drawImage(paintSea(g, sky, rand), 0, 0);
    paintHeadland(bctx, g, sky);
    state.back = back;
    state.rocks = paintRocks(g, sky);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ---------------------------------------------------------------

  // Swell rows slide in from the horizon, widen and fade as they arrive.
  function drawSwells(ctx, g, t, surf) {
    if (surf <= 0) return;
    const y0 = g.H * HORIZON;
    const span = g.H - y0;
    for (let i = 0; i < SWELLS; i++) {
      const a = (t * 0.045 + i / SWELLS) % 1;
      const y = y0 + g.U * 1.5 + Math.pow(a, 1.7) * span;
      ctx.globalAlpha = Math.min(1, a * 5) * (1 - a * 0.6) * 0.6 * Math.min(1, surf) * (1 - state.night * 0.6);
      const shift = (i * 37 + t * g.U * 0.8) % g.W;
      ctx.drawImage(state.swell, shift - g.W, y);
      ctx.drawImage(state.swell, shift, y);
    }
    ctx.globalAlpha = 1;
  }

  function surge(ph) {
    return ph < 0.25 ? smoothstep(0, 0.25, ph) : 1 - smoothstep(0.25, 0.9, ph);
  }

  function drawSite(ctx, g, t, site, surf) {
    const ph = (t / site.per + site.off) % 1;
    const s = surge(ph);
    const sx = g.W * site.x;
    const sy = g.H * site.y;
    const fw = g.W * site.w * (0.55 + 0.6 * s);
    const fh = g.U * (1.2 + 3.2 * s);
    const dim = 1 - state.night * 0.55;
    ctx.globalAlpha = Math.min(1, (0.2 + 0.75 * s) * surf) * dim;
    ctx.drawImage(state.foam, sx - fw / 2, sy - fh * 0.7, fw, fh);
    ctx.globalAlpha = Math.min(1, 0.3 * (1 - s) * surf) * dim;
    ctx.drawImage(state.foam, sx - fw * 0.6, sy + fh * 0.1, fw * 1.2, fh * 0.5);
    // Droplets thrown up as the wave bursts, falling back.
    if (ph > 0.2 && ph < 0.6 && surf > 0.05) {
      const q = (ph - 0.2) / 0.4;
      ctx.fillStyle = '#ecebe0';
      for (let k = 0; k < DROPS; k++) {
        const vx = (k - (DROPS - 1) / 2) * g.U * 0.9;
        const vy = -g.U * (13 + (k % 3) * 4);
        const px = sx + vx * q * 1.4;
        const py = sy - fh * 0.4 + vy * q + g.U * 26 * q * q;
        ctx.globalAlpha = (1 - q) * 0.85 * Math.min(1, surf) * dim;
        ctx.fillRect(px, py, 1, k % 2 ? 2 : 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLamp(ctx, g, t) {
    const lamp = state.lamp;
    if (!lamp) return;
    const strength = 0.25 + state.night * 0.5;
    const swing = 0.5 + 0.5 * Math.sin(t * 0.5);
    ctx.globalAlpha = strength * (0.55 + 0.45 * swing);
    ctx.drawImage(state.beam, lamp.x - state.beam.width, lamp.y - state.beam.height / 2);
    ctx.globalAlpha = Math.min(1, 0.5 + state.night * 0.5);
    ctx.fillStyle = '#f0d890';
    ctx.fillRect(lamp.x - 1, lamp.y - 1, 2, 2);
    ctx.globalAlpha = 1;
  }

  function drawGull(ctx, g, t, gull) {
    const a = (t / gull.per + gull.off) % 1;
    const x = lerp(-g.W * 0.05, g.W * 1.05, a);
    const y = g.H * gull.y + Math.sin(t * 0.3 + gull.off * 9) * g.U * 1.5;
    const s = g.U * gull.size * 1.6;
    const flap = Math.sin(t * 3.2 + gull.off * 20) * s * 0.45;
    ctx.beginPath();
    ctx.moveTo(x - s, y + flap);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.35, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.35, x + s, y + flap);
    ctx.stroke();
  }

  function drawGulls(ctx, g, t) {
    ctx.strokeStyle = state.night > 0.5 ? '#9aa0b8' : '#f2eee2';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < GULLS.length; i++) drawGull(ctx, g, t, GULLS[i]);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.swell = paintSwellLine(g);
    state.foam = paintFoam(g);
    state.beam = paintBeam(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.back, 0, 0);
    drawLamp(ctx, g, t);
    drawSwells(ctx, g, t, props.surf);
    ctx.drawImage(state.rocks, 0, 0);
    for (let i = 0; i < SITES.length; i++) drawSite(ctx, g, t, SITES[i], props.surf);
    if (props.gulls) drawGulls(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dusk', surf: 1, gulls: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
