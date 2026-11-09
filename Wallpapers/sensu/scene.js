/*
 * 扇子 Sensu — three folding fans laid on dark indigo cloth, opening and closing.
 *
 * The cloth and each fan's fully open paper are painted once. The paper is cut into
 * pleats, each baked as its own small strip; a frame only turns and squeezes those
 * strips about the rivet, then strokes the sticks over them.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { clamp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const PLEATS = 14;
  const SPREAD = Math.PI * 0.86;
  const INNER = 0.4;
  const MIN_OPEN = 0.05;
  const CLOTH = ['#1c2536', '#24304a', '#2c3a56'];
  const FANS = [
    {
      x: 0.37, y: 0.9, r: 0.62, tilt: -0.1, period: 17, phase: 0.6,
      paper: '#e4d8bc', wave: '#2f4a72', foam: '#d8ccb0', mid: '#6b84a4', rim: '#c49a46',
    },
    {
      x: 0.75, y: 0.76, r: 0.44, tilt: 0.32, period: 21, phase: 2.6,
      paper: '#b4472f', wave: '#d6ae58', foam: '#a63f2a', mid: '#c4703c', rim: '#e0c27a',
    },
    {
      x: 0.86, y: 0.3, r: 0.26, tilt: -0.5, period: 14, phase: 4.4,
      paper: '#c9a04e', wave: '#33496a', foam: '#bf964a', mid: '#6f7a72', rim: '#7a3a2a',
    },
  ];
  const STICK = '#3b2b22';
  const GUARD = '#2a1d17';
  const RIVET = '#d4b462';
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
    const S = Math.min(H, W * 0.62);
    return { W, H, S };
  }

  // ---- cloth ---------------------------------------------------------------

  function paintCloth(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const inks = CLOTH.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.S * 0.18), y / (g.S * 0.12), 3, 7);
        const f = clamp(n * 1.6 - 0.3 + (1 - y / g.H) * 0.3 + (rand() - 0.5) * 0.25, 0, 1.999);
        const ink = inks[Math.floor(f * 1.5)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = '#34476a';
    ctx.lineWidth = 1;
    const step = g.S * 0.11;
    for (let y = step; y < g.H; y += step * 2.2) {
      ctx.beginPath();
      for (let x = 0; x <= g.W; x += 2) {
        const yy = y + Math.sin(x / (g.S * 0.07) + y) * g.S * 0.015;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- fan paper -----------------------------------------------------------

  function sector(ctx, cx, cy, r0, r1, a0, a1) {
    ctx.beginPath();
    ctx.arc(cx, cy, r1, a0, a1);
    ctx.arc(cx, cy, r0, a1, a0, true);
    ctx.closePath();
  }

  function seigaiha(ctx, f, cx, cy, R) {
    const s = R * 0.14;
    let row = 0;
    for (let y = cy - R - s; y < cy + s; y += s * 0.5, row++) {
      const off = row % 2 ? s : 0;
      for (let x = cx - R - s * 2 + off; x < cx + R + s * 2; x += s * 2) {
        const rings = [[s, f.wave], [s * 0.78, f.foam], [s * 0.58, f.mid], [s * 0.4, f.foam], [s * 0.22, f.wave]];
        for (const [r, ink] of rings) {
          ctx.fillStyle = ink;
          ctx.beginPath();
          ctx.arc(x, y, r, Math.PI, TAU);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  function paintLeaf(f, R) {
    const size = Math.ceil(R) + 2;
    const c = layer(size * 2, size);
    const ctx = c.getContext('2d');
    const cx = size;
    const cy = size;
    const a0 = -Math.PI / 2 - SPREAD / 2;
    const a1 = -Math.PI / 2 + SPREAD / 2;
    ctx.save();
    sector(ctx, cx, cy, R * INNER, R, a0 - 0.05, a1 + 0.05);
    ctx.clip();
    ctx.fillStyle = f.paper;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    sector(ctx, cx, cy, R * 0.5, R * 0.9, a0 - 0.05, a1 + 0.05);
    ctx.clip();
    seigaiha(ctx, f, cx, cy, R);
    ctx.restore();
    ctx.strokeStyle = f.rim;
    ctx.lineWidth = Math.max(1, R * 0.035);
    for (const r of [R * 0.5, R * 0.9, R - ctx.lineWidth / 2]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0 - 0.05, a1 + 0.05);
      ctx.stroke();
    }
    ctx.restore();
    return c;
  }

  // One pleat, its centre turned to point straight up from the rivet.
  function paintPleat(leaf, R, i) {
    const half = SPREAD / PLEATS / 2;
    const w = Math.ceil(2 * R * Math.sin(half) + 4);
    const h = Math.ceil(R) + 2;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const a = -SPREAD / 2 + (i + 0.5) * (SPREAD / PLEATS);
    ctx.translate(w / 2, h);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, -Math.PI / 2 - half * 1.08, -Math.PI / 2 + half * 1.08);
    ctx.closePath();
    ctx.clip();
    ctx.save();
    ctx.rotate(-a);
    ctx.drawImage(leaf, -h, -h);
    ctx.restore();
    const tone = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    if (i % 2) {
      tone.addColorStop(0, 'rgba(20,18,26,0.28)');
      tone.addColorStop(1, 'rgba(20,18,26,0.06)');
    } else {
      tone.addColorStop(0, 'rgba(255,248,230,0.04)');
      tone.addColorStop(1, 'rgba(255,248,230,0.14)');
    }
    ctx.fillStyle = tone;
    ctx.fillRect(-w / 2, -h, w, h);
    return c;
  }

  function makeFan(g, f) {
    const R = f.r * g.S;
    const leaf = paintLeaf(f, R);
    const pleats = [];
    for (let i = 0; i < PLEATS; i++) pleats.push(paintPleat(leaf, R, i));
    return { spec: f, R, px: f.x * g.W, py: f.y * g.H, pleats, h: Math.ceil(R) + 2 };
  }

  // ---- motion --------------------------------------------------------------

  function openness(f, t, hold) {
    const c = 0.5 - 0.5 * Math.cos((t / f.period) * TAU + f.phase);
    return MIN_OPEN + (1 - MIN_OPEN) * smoothstep(0.1, 1 - 0.45 * hold, c);
  }

  function drawSticks(ctx, fan, base, span) {
    const R = fan.R;
    ctx.strokeStyle = STICK;
    ctx.lineWidth = Math.max(1, R * 0.025);
    ctx.beginPath();
    for (let i = 0; i <= PLEATS; i++) {
      const a = base - span / 2 + (i * span) / PLEATS;
      const s = Math.sin(a);
      const c = Math.cos(a);
      ctx.moveTo(fan.px, fan.py);
      ctx.lineTo(fan.px + s * R * (INNER + 0.04), fan.py - c * R * (INNER + 0.04));
    }
    ctx.stroke();
    ctx.strokeStyle = GUARD;
    ctx.lineWidth = Math.max(1.5, R * 0.05);
    ctx.beginPath();
    for (let k = -1; k <= 1; k += 2) {
      const a = base + (k * span) / 2 + k * 0.02;
      ctx.moveTo(fan.px, fan.py);
      ctx.lineTo(fan.px + Math.sin(a) * R * 1.01, fan.py - Math.cos(a) * R * 1.01);
    }
    ctx.stroke();
    ctx.fillStyle = RIVET;
    ctx.beginPath();
    ctx.arc(fan.px, fan.py, Math.max(1, R * 0.04), 0, TAU);
    ctx.fill();
  }

  function drawFan(ctx, fan, t, props) {
    const f = fan.spec;
    const o = openness(f, t, props.hold);
    const span = SPREAD * o;
    const base = f.tilt + Math.sin(t * 0.35 + f.phase) * 0.06 * props.sway;
    const w = fan.pleats[0].width;
    for (let i = 0; i < PLEATS; i++) {
      const a = base - span / 2 + (i + 0.5) * (span / PLEATS);
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.setTransform(c * o, s * o, -s, c, fan.px, fan.py);
      ctx.drawImage(fan.pleats[i], -w / 2, -fan.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSticks(ctx, fan, base, span);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.cloth = paintCloth(g, rand);
    state.fans = FANS.map((f) => makeFan(g, f));
  }

  function draw(ctx, t, dt, api) {
    ctx.drawImage(state.cloth, 0, 0);
    for (let i = state.fans.length - 1; i >= 0; i--) drawFan(ctx, state.fans[i], t, api.props);
  }

  Kasuri.run({
    defaults: { sway: 1, hold: 0.5, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
