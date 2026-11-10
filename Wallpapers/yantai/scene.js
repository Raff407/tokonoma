/*
 * 砚台 Yantai — a dark inkstone on washi. The pool holds black ink, an ink stick
 * grinds at the slope and slow grey swirls turn in the water.
 *
 * Table, stone, rim and the small objects are baked once. Two swirl discs are baked
 * and turned inside the pool; the stick is one baked sprite that circles gently.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const MOSS = '#4f5a44';
  const GOLD = '#b99a52';
  const VERMILION = '#a8402b';
  const RINGS = 3;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
    ctx.fill();
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const s = Math.min(H / 100, W / 150);
    const cx = W * 0.5;
    const cy = H * 0.47;
    return {
      W, H, s, cx, cy,
      px: cx, py: cy - 6 * s, prx: 24 * s, pry: 12 * s,
      tx: cx + 1 * s, ty: cy + 10 * s,
    };
  }

  // ---- table and stone ---------------------------------------------------------

  function paintPaper(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, g.W, g.H);
    grad.addColorStop(0, '#d9d0b8');
    grad.addColorStop(0.5, '#e4dcc6');
    grad.addColorStop(1, '#cfc5aa');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#c4b992';
    for (let i = 0; i < g.W * g.H * 0.012; i++) {
      ctx.globalAlpha = 0.1 + rand() * 0.2;
      ctx.fillRect(rand() * g.W, rand() * g.H, 1 + rand() * g.s * 1.2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function ruyi(ctx, x, y, r, flip) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 1.6 * flip, flip < 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 1.7, y, r * 0.55, Math.PI, Math.PI * 2.4);
    ctx.stroke();
  }

  function paintStone(ctx, g, rand) {
    const s = g.s;
    const w = 76 * s;
    const h = 50 * s;
    const x0 = g.cx - w / 2;
    const y0 = g.cy - h / 2;
    ctx.fillStyle = 'rgba(60,50,38,0.28)';
    rrect(ctx, x0 + 1.5 * s, y0 + 5 * s, w, h, 7 * s);
    ctx.fill();
    ctx.fillStyle = '#1d1e24';
    rrect(ctx, x0, y0 + 3 * s, w, h, 7 * s);
    ctx.fill();
    const top = ctx.createLinearGradient(0, y0, 0, y0 + h);
    top.addColorStop(0, '#454650');
    top.addColorStop(1, '#33343d');
    ctx.fillStyle = top;
    rrect(ctx, x0, y0, w, h, 7 * s);
    ctx.fill();
    for (let i = 0; i < w * h * 0.05; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#50515c' : '#2b2c34';
      ctx.globalAlpha = 0.3 + rand() * 0.4;
      ctx.fillRect(x0 + rand() * w, y0 + rand() * h, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#5e5f6b';
    ctx.lineWidth = Math.max(1, s * 0.5);
    rrect(ctx, x0 + 0.5, y0 + 0.5, w - 1, h - 1, 7 * s);
    ctx.stroke();
    ctx.strokeStyle = '#25262d';
    ctx.lineWidth = Math.max(1, s * 0.7);
    rrect(ctx, x0 + 3 * s, y0 + 3 * s, w - 6 * s, h - 6 * s, 5 * s);
    ctx.stroke();
    // the grinding slope, polished
    ctx.fillStyle = '#3c3d47';
    rrect(ctx, g.cx - 28 * s, g.cy + 3 * s, 56 * s, 18 * s, 4 * s);
    ctx.fill();
    // carved cloud scrolls on the upper rim
    ctx.strokeStyle = '#6a6b78';
    ctx.lineWidth = Math.max(1, s * 0.45);
    for (let i = 0; i < 5; i++) {
      ruyi(ctx, x0 + 8 * s + i * 7.5 * s, y0 + 5.2 * s, 1.6 * s, 1);
      ruyi(ctx, g.cx + 37 * s - i * 7.5 * s - 3 * s, y0 + 5.2 * s, 1.6 * s, 1);
    }
    ctx.strokeStyle = '#5a5b68';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x0 + 6 * s, y0 + 14 * s + i * 6 * s, 1.1 * s, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x0 + w - 6 * s, y0 + 14 * s + i * 6 * s, 1.1 * s, 0, TAU);
      ctx.stroke();
    }
  }

  function paintPoolBase(ctx, g) {
    const s = g.s;
    ctx.fillStyle = '#585966';
    blob(ctx, g.px, g.py, g.prx + 2.2 * s, g.pry + 2.2 * s);
    ctx.fillStyle = '#1f2026';
    blob(ctx, g.px, g.py + 0.6 * s, g.prx + 1.2 * s, g.pry + 1.2 * s);
    ctx.fillStyle = '#0d0e11';
    blob(ctx, g.px, g.py, g.prx, g.pry);
    const gl = ctx.createRadialGradient(g.px, g.py, 0, g.px, g.py, g.prx);
    gl.addColorStop(0, 'rgba(60,64,80,0.45)');
    gl.addColorStop(1, 'rgba(60,64,80,0)');
    ctx.save();
    ctx.translate(g.px, g.py);
    ctx.scale(1, g.pry / g.prx);
    ctx.translate(-g.px, -g.py);
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(g.px, g.py, g.prx, 0, TAU);
    ctx.fill();
    ctx.restore();
    // a stream of ink from the slope into the pool
    ctx.fillStyle = '#0d0e11';
    ctx.beginPath();
    ctx.moveTo(g.tx - 2.6 * s, g.ty - 0.5 * s);
    ctx.quadraticCurveTo(g.tx - 2 * s, g.py + g.pry - 1 * s, g.tx - 1.2 * s, g.py + g.pry - 3 * s);
    ctx.lineTo(g.tx + 1.4 * s, g.py + g.pry - 3 * s);
    ctx.quadraticCurveTo(g.tx + 2.4 * s, g.py + g.pry - 1 * s, g.tx + 3 * s, g.ty - 0.5 * s);
    ctx.closePath();
    ctx.fill();
  }

  // ---- small objects ----------------------------------------------------------

  function paintDropper(ctx, g) {
    const s = g.s;
    const x = g.cx - 51 * s;
    const y = g.cy - 12 * s;
    ctx.fillStyle = 'rgba(60,50,38,0.3)';
    blob(ctx, x + 1.5 * s, y + 3.2 * s, 7.5 * s, 5 * s);
    ctx.fillStyle = '#7f9a8c';
    blob(ctx, x, y, 7 * s, 5.6 * s);
    ctx.fillStyle = '#9db5a4';
    blob(ctx, x - 1 * s, y - 1 * s, 5.4 * s, 4 * s);
    ctx.fillStyle = '#b9ccba';
    blob(ctx, x - 2.4 * s, y - 2 * s, 2.2 * s, 1.3 * s, -0.4);
    ctx.fillStyle = '#6a8578';
    blob(ctx, x + 6.5 * s, y - 2.2 * s, 2.4 * s, 1.5 * s, -0.3);
    ctx.fillStyle = '#16171b';
    blob(ctx, x + 7 * s, y - 2.5 * s, 1.2 * s, 0.7 * s, -0.3);
    ctx.fillStyle = '#16171b';
    blob(ctx, x + 1 * s, y + 0.5 * s, 1.5 * s, 1 * s);
  }

  function paintSeal(ctx, g) {
    const s = g.s;
    const x = g.cx + 51 * s;
    const y = g.cy - 10 * s;
    ctx.fillStyle = 'rgba(60,50,38,0.3)';
    blob(ctx, x + 1.4 * s, y + 3 * s, 8 * s, 5.6 * s);
    ctx.fillStyle = '#7a2d1e';
    blob(ctx, x, y + 1.5 * s, 8 * s, 6 * s);
    ctx.fillStyle = VERMILION;
    blob(ctx, x, y, 8 * s, 6 * s);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, s * 0.6);
    ctx.beginPath();
    ctx.ellipse(x, y, 6.2 * s, 4.5 * s, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#d08a6a';
    ctx.lineWidth = Math.max(1, s * 0.4);
    for (let i = 0; i < 4; i++) {
      const a = i * (TAU / 4) + 0.5;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 2.4 * s, y + Math.sin(a) * 1.7 * s, 1.1 * s, 0, TAU);
      ctx.stroke();
    }
  }

  function paintBrush(ctx, g) {
    const s = g.s;
    const y = g.cy + 36 * s;
    const x0 = g.cx - 46 * s;
    ctx.fillStyle = '#6f6f78';
    for (let i = 0; i < 3; i++) {
      const bx = x0 + 18 * s + i * 7 * s;
      const bh = (i === 1 ? 4.4 : 3.2) * s;
      ctx.beginPath();
      ctx.moveTo(bx - 4 * s, y + 3 * s);
      ctx.lineTo(bx, y + 3 * s - bh);
      ctx.lineTo(bx + 4 * s, y + 3 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(60,50,38,0.28)';
    rrect(ctx, x0 + 1 * s, y + 1.5 * s, 46 * s, 1.8 * s, 0.9 * s);
    ctx.fill();
    ctx.fillStyle = '#a49058';
    rrect(ctx, x0 + 11 * s, y - 1 * s, 36 * s, 1.9 * s, 0.9 * s);
    ctx.fill();
    ctx.fillStyle = MOSS;
    ctx.fillRect(x0 + 11 * s, y - 1 * s, 1.6 * s, 1.9 * s);
    ctx.fillRect(x0 + 40 * s, y - 1 * s, 1.2 * s, 1.9 * s);
    ctx.fillStyle = '#e7dfc9';
    ctx.beginPath();
    ctx.moveTo(x0 + 11 * s, y - 1.3 * s);
    ctx.lineTo(x0 + 3 * s, y - 0.2 * s);
    ctx.lineTo(x0 + 11 * s, y + 1.3 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#17181b';
    ctx.beginPath();
    ctx.moveTo(x0 + 7 * s, y - 1.2 * s);
    ctx.lineTo(x0 + 3 * s, y - 0.2 * s);
    ctx.lineTo(x0 + 7 * s, y + 1 * s);
    ctx.closePath();
    ctx.fill();
  }

  function bambooLeaf(ctx, x, y, len, ang, tone) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.16, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.1, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function paintBamboo(ctx, g) {
    const s = g.s;
    const x = g.cx + 44 * s;
    const y = g.cy + 31 * s;
    ctx.strokeStyle = '#6a7552';
    ctx.lineWidth = Math.max(1, s * 0.6);
    ctx.beginPath();
    ctx.moveTo(x + 14 * s, y + 8 * s);
    ctx.quadraticCurveTo(x + 4 * s, y + 3 * s, x - 6 * s, y - 2 * s);
    ctx.stroke();
    const tones = [MOSS, '#66724e', '#3f4a38'];
    const leaves = [[-6, -2, -2.7], [-6, -2, -3.5], [-2, 0, -2.2], [2, 1.5, 0.4], [4, 2.5, -0.5], [-1, 0, -3.1], [6, 3.5, 0.1]];
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      bambooLeaf(ctx, x + l[0] * s, y + l[1] * s, (9 + (i % 3) * 2) * s, l[2], tones[i % 3]);
    }
  }

  // ---- ink water ---------------------------------------------------------------

  function swirlDisc(g, seed, arms, tone) {
    const R = Math.ceil(g.prx * 1.15);
    const c = layer(R * 2, R * 2);
    const ctx = c.getContext('2d');
    const r = K.rng(seed);
    ctx.translate(R, R);
    ctx.lineCap = 'round';
    for (let a = 0; a < arms; a++) {
      const base = (a / arms) * TAU + r();
      const tight = 0.9 + r() * 0.7;
      for (let pass = 0; pass < 3; pass++) {
        ctx.strokeStyle = tone;
        ctx.globalAlpha = 0.18 + pass * 0.16;
        ctx.lineWidth = Math.max(1, g.s * (2.6 - pass * 0.85));
        ctx.beginPath();
        for (let i = 0; i <= 34; i++) {
          const f = i / 34;
          const ang = base + f * tight * 3.2 + pass * 0.05;
          const rad = R * (0.08 + f * 0.82) * (1 + Math.sin(f * 9 + a) * 0.04);
          const x = Math.cos(ang) * rad;
          const y = Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = tone;
    for (let i = 0; i < 6; i++) blob(ctx, (r() - 0.5) * R, (r() - 0.5) * R, g.s * (1.5 + r() * 2.5), g.s * (1 + r() * 1.5), r() * 3);
    ctx.globalAlpha = 1;
    return { canvas: c, R };
  }

  function paintRim(ctx, g) {
    const s = g.s;
    ctx.strokeStyle = '#6a6b78';
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.beginPath();
    ctx.ellipse(g.px, g.py, g.prx + 0.6 * s, g.pry + 0.6 * s, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#a2a4b4';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(1, s * 0.7);
    ctx.beginPath();
    ctx.ellipse(g.px, g.py, g.prx * 0.8, g.pry * 0.7, 0, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function paintStick(g) {
    const s = g.s;
    const L = 42 * s;
    const w = 5.6 * s;
    const pad = 3 * s;
    const c = layer(L + pad * 2 + 3 * s, w + pad * 2 + 3 * s);
    const ctx = c.getContext('2d');
    const my = pad + w / 2;
    ctx.fillStyle = 'rgba(10,10,14,0.4)';
    rrect(ctx, pad + 1.2 * s, my - w / 2 + 2.2 * s, L, w, 1.1 * s);
    ctx.fill();
    ctx.fillStyle = '#17181c';
    rrect(ctx, pad, my - w / 2, L, w, 1.1 * s);
    ctx.fill();
    ctx.fillStyle = '#2d2f38';
    ctx.fillRect(pad + 2 * s, my - w / 2 + 0.7 * s, L - 4 * s, 0.9 * s);
    // gilded panel with a vermilion band
    const gx = pad + L * 0.34;
    const gw = L * 0.5;
    ctx.fillStyle = VERMILION;
    ctx.fillRect(gx - 1.5 * s, my - w / 2, 1.5 * s, w);
    ctx.fillRect(gx + gw, my - w / 2, 1.5 * s, w);
    ctx.fillStyle = GOLD;
    ctx.fillRect(gx, my - w / 2 + 0.9 * s, gw, w - 1.8 * s);
    ctx.fillStyle = '#17181c';
    for (let i = 0; i < 6; i++) {
      const cx = gx + gw * (0.1 + i * 0.16);
      ctx.beginPath();
      ctx.arc(cx, my, 0.9 * s, 0, TAU);
      ctx.fill();
      ctx.fillRect(cx + 1.4 * s, my - 0.3 * s, 1.7 * s, 0.6 * s);
    }
    // worn tip
    ctx.fillStyle = '#3a3c46';
    ctx.fillRect(pad, my - w / 2, 1.1 * s, w);
    return { canvas: c, pad, my };
  }

  function bake(api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    const base = layer(g.W, g.H);
    const ctx = base.getContext('2d');
    paintPaper(ctx, g, rand);
    paintBamboo(ctx, g);
    paintBrush(ctx, g);
    paintStone(ctx, g, rand);
    paintPoolBase(ctx, g);
    paintDropper(ctx, g);
    paintSeal(ctx, g);
    state.base = base;
    const over = layer(g.W, g.H);
    paintRim(over.getContext('2d'), g);
    state.over = over;
    state.disc = [swirlDisc(g, api.seed + 3, 5, '#7f8498'), swirlDisc(g, api.seed + 9, 4, '#5a5f74')];
    state.stick = paintStick(g);
  }

  // ---- per frame ---------------------------------------------------------------

  function drawPool(ctx, g, t, swirl, ripple) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(g.px, g.py, g.prx, g.pry, 0, 0, TAU);
    ctx.clip();
    const q = g.pry / g.prx;
    for (let i = 0; i < state.disc.length; i++) {
      const d = state.disc[i];
      const dir = i === 0 ? 1 : -1;
      const ox = Math.sin(t * 0.13 + i * 2) * g.s * 2.2;
      const oy = Math.cos(t * 0.11 + i) * g.s * 1.2;
      ctx.globalAlpha = Math.min(1, (i === 0 ? 0.9 : 0.7) * swirl);
      ctx.setTransform(Math.cos(t * 0.16 * dir + i), Math.sin(t * 0.16 * dir + i) * q, -Math.sin(t * 0.16 * dir + i), Math.cos(t * 0.16 * dir + i) * q, g.px + ox, g.py + oy);
      ctx.drawImage(d.canvas, -d.R, -d.R);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // dark cloud where fresh ink enters
    const pulse = 1 + Math.sin(t * 0.9) * 0.12;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#0d0e11';
    blob(ctx, g.tx, g.py + g.pry * 0.62, g.s * 7 * pulse, g.s * 2.8 * pulse);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#8a8fa4';
    ctx.lineWidth = Math.max(1, g.s * 0.45);
    for (let i = 0; i < RINGS; i++) {
      const f = (t * 0.12 + i / RINGS) % 1;
      ctx.globalAlpha = (1 - f) * 0.5 * ripple;
      ctx.beginPath();
      ctx.ellipse(g.tx, g.py + g.pry * 0.62, g.s * (2 + f * 18), g.s * (0.8 + f * 7), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawStick(ctx, g, t) {
    const k = state.stick;
    const p = t * 1.5;
    const x = g.tx + Math.cos(p) * g.s * 2.4;
    const y = g.ty + Math.sin(p) * g.s * 0.9;
    const a = 0.42 + Math.sin(p + 1) * 0.035;
    ctx.fillStyle = '#0d0e11';
    blob(ctx, g.tx + Math.cos(p) * g.s * 0.8, g.ty, g.s * (3.6 + Math.sin(p * 0.5) * 0.4), g.s * 1.6);
    ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), x, y);
    ctx.drawImage(k.canvas, -k.pad, -k.my);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function setup(ctx, api) {
    bake(api);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { swirl, ripple } = api.props;
    ctx.drawImage(state.base, 0, 0);
    drawPool(ctx, g, t, swirl, ripple);
    ctx.drawImage(state.over, 0, 0);
    drawStick(ctx, g, t);
  }

  Kasuri.run({
    defaults: { swirl: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
