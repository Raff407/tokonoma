/*
 * 太极 Taiji — a yin and yang disc of ink and washi, turning slowly inside a ring of
 * trigram bars, with mist winding round it over deep indigo.
 *
 * Every picture is baked once: the backdrop, the disc, the trigram ring and two swirls
 * of mist. Each frame only turns those layers and slides a tiling mist strip.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const INK = '#14181d';
  const WASHI = '#e6dec9';
  const GOLD = '#b8975a';
  const VERMILION = '#a8402c';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const R = Math.min(H * 0.3, W * 0.3);
    return { W, H, R, cx: W / 2, cy: H * 0.5, U: H / 100 };
  }

  function paintBack(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#2a3748');
    grad.addColorStop(0.5, '#3d4d5f');
    grad.addColorStop(1, '#2b3846');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const halo = ctx.createRadialGradient(g.cx, g.cy, g.R * 0.9, g.cx, g.cy, g.R * 2.3);
    halo.addColorStop(0, 'rgba(150,160,165,0.35)');
    halo.addColorStop(1, 'rgba(150,160,165,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // The disc is painted centred on its own canvas so one rotation turns it whole.
  function paintDisc(g) {
    const R = g.R;
    const S = Math.ceil(R * 2 + g.U * 4);
    const c = layer(S, S);
    const ctx = c.getContext('2d');
    const m = S / 2;
    const half = (x, y, r, a0, a1, ccw) => ctx.arc(x, y, r, a0, a1, ccw);
    ctx.fillStyle = WASHI;
    ctx.beginPath();
    ctx.arc(m, m, R, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    half(m, m, R, Math.PI / 2, -Math.PI / 2, false);
    half(m, m - R / 2, R / 2, -Math.PI / 2, Math.PI / 2, true);
    half(m, m + R / 2, R / 2, -Math.PI / 2, Math.PI / 2, false);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(m, m - R / 2, R / 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = WASHI;
    ctx.beginPath();
    ctx.arc(m, m + R / 2, R / 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    ctx.arc(m, m, R, 0, TAU);
    ctx.stroke();
    return c;
  }

  // Eight trigrams as unbroken or broken bars laid round the disc.
  function paintRing(g) {
    const R = g.R;
    const S = Math.ceil(R * 3.1);
    const c = layer(S, S);
    const ctx = c.getContext('2d');
    const m = S / 2;
    const pattern = [7, 3, 5, 1, 6, 2, 4, 0];
    const r0 = R * 1.2;
    const bar = R * 0.07;
    const gap = R * 0.045;
    ctx.fillStyle = 'rgba(14,20,28,0.55)';
    ctx.beginPath();
    ctx.arc(m, m, R * 1.62, 0, TAU);
    ctx.arc(m, m, R * 1.12, 0, TAU, true);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.beginPath();
    ctx.arc(m, m, R * 1.12, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(m, m, R * 1.62, 0, TAU);
    ctx.stroke();
    for (let k = 0; k < 8; k++) {
      ctx.save();
      ctx.translate(m, m);
      ctx.rotate((k / 8) * TAU);
      for (let line = 0; line < 3; line++) {
        const r = r0 + line * (bar + gap) + bar / 2;
        const solid = (pattern[k] >> line) & 1;
        const half = R * 0.2;
        ctx.fillStyle = line === 1 && k % 2 ? VERMILION : '#d8cfb8';
        if (solid) ctx.fillRect(r - bar / 2, -half, bar, half * 2);
        else {
          ctx.fillRect(r - bar / 2, -half, bar, half * 0.82);
          ctx.fillRect(r - bar / 2, half * 0.18, bar, half * 0.82);
        }
      }
      ctx.restore();
    }
    return c;
  }

  // A spiral cloud: noise sampled along an angle that twists with the radius.
  function paintSwirl(g, seed, twist) {
    const S = Math.ceil(g.R * 4.4);
    const c = layer(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const m = S / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (x - m) / m;
        const dy = (y - m) / m;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r >= 1) continue;
        const a = Math.atan2(dy, dx) + twist * r;
        const v = fbm(Math.cos(a) * r * 2.6 + 4, Math.sin(a) * r * 2.6 + 4, 4, seed);
        const edge = smoothstep(1, 0.55, r) * smoothstep(0.18, 0.4, r);
        const al = Math.round(smoothstep(0.42, 0.68, v) * edge * 5) / 5;
        const i = (y * S + x) * 4;
        img.data[i] = 214;
        img.data[i + 1] = 214;
        img.data[i + 2] = 204;
        img.data[i + 3] = al * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintStrip(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.18);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 4), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.4, 0.64, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 208;
        img.data[i + 1] = 210;
        img.data[i + 2] = 204;
        img.data[i + 3] = a * 130;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function turned(ctx, img, x, y, a) {
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawStrip(ctx, g, t, mist, y, rate, alpha) {
    const s = state.strip;
    const w = s.width;
    const a = (t * g.U * rate) % w;
    ctx.globalAlpha = Math.min(1, mist * alpha);
    ctx.drawImage(s, -a, y);
    ctx.drawImage(s, w - a, y);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.back = paintBack(g);
    state.disc = paintDisc(g);
    state.ring = paintRing(g);
    state.swirlA = paintSwirl(g, 17, 3.2);
    state.swirlB = paintSwirl(g, 53, -2.6);
    state.strip = paintStrip(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, turn } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawStrip(ctx, g, t, mist, g.H * 0.08, 1.2, 0.7);
    ctx.globalAlpha = 1;
    turned(ctx, state.ring, g.cx, g.cy, -t * 0.05 * turn);
    turned(ctx, state.disc, g.cx, g.cy, t * 0.22 * turn);
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    turned(ctx, state.swirlA, g.cx, g.cy, t * 0.1 + 1);
    ctx.globalAlpha = Math.min(1, mist * 0.6);
    turned(ctx, state.swirlB, g.cx, g.cy, -t * 0.07);
    drawStrip(ctx, g, t, mist, g.H * 0.68, 0.8, 0.55);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { mist: 1, turn: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
