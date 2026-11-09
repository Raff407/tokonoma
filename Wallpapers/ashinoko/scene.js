/*
 * 芦ノ湖 Ashinoko — a vermilion torii standing in a mountain lake, Fuji faint in morning mist.
 *
 * Sky, mountain, hills and the torii are baked once. The lake is that world flipped and
 * laid back in thin rows that slide sideways. Mist is one tiling strip; a small wooden
 * boat crosses the water now and then.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const SHORE = 0.56;
  const PEAK = { x: 0.64, y: 0.17 };
  const TORII = { x: 0.37, base: 0.84, height: 0.34 };
  const BOAT_LANE = 0.69;
  const BOAT_CYCLE = 70;
  const SPARKS = 22;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky and mountains ---------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * SHORE);
    grad.addColorStop(0, '#9fb0c2');
    grad.addColorStop(0.6, '#d9d9d2');
    grad.addColorStop(1, '#efe4cc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * SHORE + 1);
    const glow = ctx.createRadialGradient(g.W * 0.82, g.H * 0.4, 0, g.W * 0.82, g.H * 0.4, g.H * 0.5);
    glow.addColorStop(0, 'rgba(226,190,120,0.45)');
    glow.addColorStop(1, 'rgba(226,190,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H * SHORE);
  }

  function fujiTop(g, x) {
    const px = g.W * PEAK.x;
    const half = g.W * (x < px ? 0.36 : 0.44);
    const d = Math.max(0, Math.abs(x - px) - g.W * 0.012) / half;
    const base = g.H * SHORE;
    const top = g.H * PEAK.y;
    return base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.85) + (fbm(x * 0.05, 3, 3, 5) - 0.5) * g.U * 0.5;
  }

  function paintFuji(ctx, g) {
    const base = g.H * SHORE;
    const snowLine = g.H * (PEAK.y + 0.17);
    for (let x = 0; x < g.W; x++) {
      const top = fujiTop(g, x);
      if (top >= base - 1) continue;
      const jag = snowLine + (fbm(x * 0.2, 7, 3, 9) - 0.5) * g.U * 7 + Math.sin(x * 0.7) * g.U * 0.8;
      ctx.fillStyle = x > g.W * PEAK.x + g.U * 4 ? '#8b9db6' : '#97a8bf';
      ctx.fillRect(x, top, 1, base - top + 1);
      ctx.fillStyle = '#eef0ee';
      ctx.fillRect(x, top, 1, Math.max(0, jag - top));
    }
    const fade = ctx.createLinearGradient(0, g.H * 0.3, 0, base);
    fade.addColorStop(0, 'rgba(232,226,208,0.15)');
    fade.addColorStop(1, 'rgba(232,226,208,0.7)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, g.H * 0.3, g.W, base - g.H * 0.3);
  }

  function paintHills(ctx, g) {
    const base = g.H * SHORE;
    const rows = [
      { y: 0.06, amp: 0.06, freq: 0.012, seed: 3, color: '#7b8ea0', fog: 0.35 },
      { y: 0.025, amp: 0.07, freq: 0.02, seed: 11, color: '#566d73', fog: 0.18 },
    ];
    for (const r of rows) {
      ctx.fillStyle = r.color;
      for (let x = 0; x < g.W; x++) {
        const side = Math.abs(x / g.W - 0.5) * 2;
        const top = base - g.H * (r.y + r.amp * fbm(x * r.freq, r.seed, 4, r.seed) * (0.5 + side));
        ctx.fillRect(x, top, 1, base - top + 1);
      }
      ctx.fillStyle = `rgba(236,230,212,${r.fog})`;
      ctx.fillRect(0, base - g.H * (r.y + r.amp), g.W, g.H * (r.y + r.amp));
    }
    ctx.fillStyle = '#3f5a48';
    for (let x = 0; x < g.W; x++) {
      const edge = Math.min(x, g.W - 1 - x) / (g.W * 0.22);
      const rise = Math.max(0, 1 - edge);
      const top = base - g.H * 0.012 - g.H * 0.13 * rise * rise * (0.6 + fbm(x * 0.05, 5, 3, 15) * 0.8);
      ctx.fillRect(x, top, 1, base - top + 1);
    }
  }

  // A tall slim cedar, drawn as stacked drooping tiers.
  function cedar(ctx, x, base, h, color) {
    ctx.fillStyle = color;
    const tiers = 7;
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers;
      const top = base - h + h * k * 0.92;
      const w = h * (0.05 + 0.1 * k);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + w, top + (h / tiers) * 1.6);
      ctx.lineTo(x - w, top + (h / tiers) * 1.6);
      ctx.fill();
    }
    ctx.fillRect(x - 0.5, base - h * 0.1, 1, h * 0.1);
  }

  function paintShore(ctx, g, rand) {
    const base = g.H * SHORE;
    for (let i = 0; i < 16; i++) {
      const left = i < 10;
      const x = left ? g.W * (0.01 + rand() * 0.2) : g.W * (0.82 + rand() * 0.17);
      const h = g.H * (0.1 + rand() * 0.16) * (left ? 1 : 0.8);
      cedar(ctx, x, base + g.H * 0.012 + rand() * g.H * 0.01, h, i % 3 ? '#2b4333' : '#35503c');
    }
    ctx.fillStyle = '#2a3a30';
    ctx.fillRect(0, base, g.W, 1);
  }

  // ---- torii ---------------------------------------------------------------

  function paintTorii(g) {
    const h = g.H * TORII.height;
    const span = h * 0.62;
    const w = Math.ceil(span * 1.8);
    const c = layer(w, h * 1.12);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const bottom = c.height - 1;
    const pw = Math.max(2, h * 0.07);
    const red = '#c8452c';
    const shade = '#a2331f';
    const ink = '#26211f';
    const kasagiY = bottom - h;
    const lift = h * 0.06;
    [-1, 1].forEach((side) => {
      const px = cx + side * span * 0.5;
      ctx.fillStyle = side < 0 ? red : shade;
      ctx.beginPath();
      ctx.moveTo(px - pw * 0.55, kasagiY + h * 0.05);
      ctx.lineTo(px + pw * 0.55, kasagiY + h * 0.05);
      ctx.lineTo(px + pw * 0.5 + h * 0.012 * side, bottom);
      ctx.lineTo(px - pw * 0.5 + h * 0.012 * side, bottom);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.fillRect(px - pw * 0.6 + h * 0.012 * side, bottom - h * 0.07, pw * 1.1, h * 0.07);
    });
    const nukiY = kasagiY + h * 0.27;
    ctx.fillStyle = red;
    ctx.fillRect(cx - span * 0.62, nukiY, span * 1.24, pw * 0.65);
    ctx.fillStyle = shade;
    ctx.fillRect(cx - span * 0.62, nukiY + pw * 0.5, span * 1.24, pw * 0.15);
    ctx.fillStyle = red;
    ctx.fillRect(cx - pw * 0.3, kasagiY + h * 0.1, pw * 0.6, nukiY - kasagiY - h * 0.1);
    ctx.fillRect(cx - span * 0.66, kasagiY + h * 0.05, span * 1.32, pw * 0.5);
    const half = span * 0.9;
    const thick = pw * 0.9;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(cx - half, kasagiY - lift);
    ctx.quadraticCurveTo(cx, kasagiY + lift * 0.9, cx + half, kasagiY - lift);
    ctx.lineTo(cx + half - 0.5, kasagiY - lift + thick * 0.55);
    ctx.quadraticCurveTo(cx, kasagiY + lift * 0.9 + thick * 0.6, cx - half + 0.5, kasagiY - lift + thick * 0.55);
    ctx.fill();
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.moveTo(cx - half + 1, kasagiY - lift + thick * 0.5);
    ctx.quadraticCurveTo(cx, kasagiY + lift * 0.9 + thick * 0.55, cx + half - 1, kasagiY - lift + thick * 0.5);
    ctx.lineTo(cx + half - 1.5, kasagiY - lift + thick * 1.2);
    ctx.quadraticCurveTo(cx, kasagiY + lift * 0.9 + thick * 1.25, cx - half + 1.5, kasagiY - lift + thick * 1.2);
    ctx.fill();
    return c;
  }

  // ---- lake ----------------------------------------------------------------

  function flipInto(ctx, src, x, y, pivot, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, pivot * 2);
    ctx.scale(1, -1);
    ctx.drawImage(src, x, y);
    ctx.restore();
  }

  function paintLake(g, back, torii, tx, ty) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * SHORE;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#b9c3c4');
    grad.addColorStop(0.5, '#6f8a93');
    grad.addColorStop(1, '#2f4856');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, g.W, g.H - top);
    ctx.clip();
    flipInto(ctx, back, 0, 0, top, 0.6);
    ctx.restore();
    flipInto(ctx, torii, tx, ty, ty + torii.height, 0.55);
    const dark = ctx.createLinearGradient(0, top, 0, g.H);
    dark.addColorStop(0, 'rgba(230,224,206,0.1)');
    dark.addColorStop(1, 'rgba(30,48,60,0.35)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, top, g.W, g.H - top);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.07, 4, 31), fbm((x - w) * 0.012, y * 0.07, 4, 31), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 240;
        img.data[i + 1] = 236;
        img.data[i + 2] = 224;
        img.data[i + 3] = smoothstep(0.38, 0.68, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- boat ----------------------------------------------------------------

  function paintBoat(g) {
    const u = g.U;
    const w = Math.ceil(u * 17);
    const h = Math.ceil(u * 8);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const keel = h - 1;
    ctx.fillStyle = '#3b2c25';
    ctx.beginPath();
    ctx.moveTo(0, keel - u * 2.6);
    ctx.quadraticCurveTo(w * 0.15, keel - u * 0.6, w * 0.3, keel);
    ctx.lineTo(w * 0.78, keel);
    ctx.quadraticCurveTo(w * 0.95, keel - u * 0.4, w, keel - u * 1.6);
    ctx.lineTo(w * 0.97, keel - u * 1.2);
    ctx.lineTo(w * 0.05, keel - u * 1.5);
    ctx.fill();
    ctx.fillStyle = '#6a4f3a';
    ctx.fillRect(w * 0.22, keel - u * 3.4, w * 0.5, u * 1.9);
    ctx.fillStyle = '#2a2a30';
    ctx.beginPath();
    ctx.moveTo(w * 0.16, keel - u * 3.3);
    ctx.lineTo(w * 0.5, keel - u * 5.4);
    ctx.lineTo(w * 0.78, keel - u * 3.3);
    ctx.fill();
    ctx.fillStyle = '#d9a73a';
    ctx.fillRect(w * 0.3, keel - u * 2.9, u * 1.2, u * 1.1);
    ctx.fillStyle = '#c8452c';
    ctx.fillRect(w * 0.94, keel - u * 4.4, 1, u * 2.8);
    return c;
  }

  function drawBoat(ctx, g, t) {
    const boat = state.boat;
    const p = (t % BOAT_CYCLE) / BOAT_CYCLE;
    const span = g.W + boat.width * 2;
    const x = g.W + boat.width - p * span;
    const y = g.H * BOAT_LANE + Math.sin(t * 0.9) * g.U * 0.25;
    ctx.drawImage(boat, x, y - boat.height);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate(0, y * 2);
    ctx.scale(1, -1);
    ctx.drawImage(boat, x, y - boat.height);
    ctx.restore();
    ctx.fillStyle = 'rgba(240,236,224,0.5)';
    for (let i = 1; i < 5; i++) {
      ctx.fillRect(x + boat.width + i * g.U * 1.6, y + (i % 2) * 1, g.U * (2.2 - i * 0.3), 1);
    }
  }

  // ---- per frame -------------------------------------------------------------

  function drawLake(ctx, g, t, ripple) {
    const top = Math.floor(g.H * SHORE);
    const lake = state.lake;
    for (let y = top; y < g.H; y++) {
      const depth = (y - top) / (g.H - top);
      const off = ripple * (Math.sin(t * 0.9 + y * 0.55) * 0.5 + Math.sin(t * 0.5 - y * 0.2)) * (0.4 + depth * 1.8);
      ctx.drawImage(lake, 0, y, g.W, 1, off, y, g.W, 1);
    }
    ctx.fillStyle = 'rgba(244,238,220,0.55)';
    const sp = state.sparks;
    for (let i = 0; i < SPARKS; i++) {
      const phase = Math.sin(t * (0.5 + sp[i * 3 + 2] * 0.4) + i * 2.1);
      if (phase < 0.55) continue;
      const y = top + 2 + sp[i * 3 + 1] * (g.H - top - 3);
      ctx.fillRect(sp[i * 3] * g.W, y, 2 + sp[i * 3 + 2] * 3, 1);
    }
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const mist = state.mist;
    const base = g.H * SHORE;
    const lanes = [
      { y: base - g.H * 0.13, speed: 2.4, alpha: 0.7 },
      { y: base - g.H * 0.04, speed: 3.6, alpha: 0.9 },
    ];
    for (const lane of lanes) {
      const shift = (t * lane.speed) % mist.width;
      ctx.globalAlpha = Math.min(1, lane.alpha * amount);
      for (let x = -shift; x < g.W; x += mist.width) ctx.drawImage(mist, x, lane.y);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g);
    paintFuji(bctx, g);
    paintHills(bctx, g);
    paintShore(bctx, g, rand);
    state.back = back;
    const torii = paintTorii(g);
    const tx = g.W * TORII.x - torii.width / 2;
    const ty = g.H * TORII.base - torii.height + 1;
    state.torii = torii;
    state.toriiPos = { x: tx, y: ty };
    state.lake = paintLake(g, back, torii, tx, ty);
    state.mist = paintMist(g);
    state.boat = paintBoat(g);
    state.sparks = new Float32Array(SPARKS * 3);
    for (let i = 0; i < SPARKS * 3; i++) state.sparks[i] = rand();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, ripple, boat } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    drawLake(ctx, g, t, ripple);
    const pos = state.toriiPos;
    ctx.drawImage(state.torii, pos.x, pos.y);
    ctx.fillStyle = 'rgba(240,236,224,0.5)';
    ctx.fillRect(pos.x + state.torii.width * 0.5 - g.U * 6, g.H * TORII.base, g.U * 12, 1);
    if (boat) drawBoat(ctx, g, t);
  }

  Kasuri.run({
    defaults: { mist: 1, ripple: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
