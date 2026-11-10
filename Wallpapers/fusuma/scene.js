/*
 * 襖絵 Fusuma — gold-leaf sliding doors painted with a pine and cranes.
 *
 * The room, the doors and the painting are baked once. A dark veil, a warm glow and
 * the paper lamp are separate layers; each frame only changes how strongly the
 * veil and glow show, so the lamp flickers. One soft shadow slides across on top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, clamp } = K;

  const TAU = Math.PI * 2;
  const LEAF = ['#c8a14a', '#d3b05a', '#bf9843', '#d9ba66', '#c3a04f'];
  const INK = '#1d1b1c';
  const WASHI = '#f1ead7';
  const WASHI_SHADE = '#d3cab1';
  const VERMILION = '#c9402a';
  const MOSS = { dark: '#2f4026', mid: '#4c6030', light: '#7a8a48' };
  const BARK = { base: '#2c2419', plate: '#40331f', high: '#5f4c2e' };
  const INDIGO = { deep: '#22324f', mid: '#33496d', foam: '#d6dcd8' };
  const WOOD = { lintel: '#4a3626', lintelHi: '#6a4f36', ceiling: '#17130f', rail: '#1a1613', railHi: '#3a2f27' };
  const MAT = { base: '#767d4c', alt: '#6c7345', edge: '#1d1913' };
  const GLINTS = 14;
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const n = Math.max(2, Math.round(W / (U * 46)));
    return { W, H, U, n, pw: W / n, top: Math.round(U * 6), bot: Math.round(U * 82), floor: Math.round(U * 85) };
  }

  // ---- gold ground ---------------------------------------------------------

  function paintLeaf(ctx, g, rand) {
    const s = Math.max(3, g.U * 3.4);
    const rows = Math.ceil((g.bot - g.top) / s);
    const cols = Math.ceil(g.W / s) + 1;
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * s * 0.5;
      for (let i = -1; i < cols; i++) {
        ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)];
        ctx.fillRect(Math.floor(i * s + off), Math.floor(g.top + j * s), Math.ceil(s), Math.ceil(s));
      }
    }
    ctx.fillStyle = 'rgba(120,88,32,0.22)';
    for (let j = 0; j <= rows; j++) ctx.fillRect(0, Math.floor(g.top + j * s), g.W, 1);
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * s * 0.5;
      for (let i = -1; i < cols; i++) ctx.fillRect(Math.floor(i * s + off), Math.floor(g.top + j * s), 1, Math.ceil(s));
    }
  }

  // A long low band of gold cloud with a scalloped top and tapered ends.
  function cloud(ctx, x, y, w, h, phase) {
    const steps = 28;
    const path = (dy) => {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const body = Math.pow(Math.sin(Math.PI * t), 0.6);
        const scallop = 0.78 + 0.22 * Math.cos(t * 17 + phase);
        const px = x + w * t;
        const py = y + dy - (h / 2) * body * scallop;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        ctx.lineTo(x + w * t, y + dy + (h / 4) * Math.pow(Math.sin(Math.PI * t), 0.6));
      }
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = '#9d7a32';
    path(g1(h));
    ctx.fillStyle = '#e2c878';
    path(0);
    ctx.fillStyle = '#d3b45f';
    ctx.save();
    ctx.translate(0, h * 0.18);
    path(0);
    ctx.restore();
  }

  function g1(h) {
    return Math.max(1, h * 0.14);
  }

  // ---- ground, stream, pine ------------------------------------------------

  function mound(ctx, x, y, rx, ry, rand) {
    ctx.fillStyle = MOSS.dark;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = MOSS.mid;
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.06, y - ry * 0.05, rx * 0.9, ry * 0.8, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = MOSS.light;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + 0.25 + rand() * 2.6;
      blob(ctx, x + Math.cos(a) * rx * 0.7, y + Math.sin(a) * ry * 0.7, rx * 0.07, ry * 0.12);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, Math.PI, TAU);
    ctx.stroke();
  }

  function stream(ctx, g, x0, y0, y1, rand) {
    ctx.fillStyle = INDIGO.deep;
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    for (let x = x0; x <= g.W + 2; x += 2) {
      const f = (x - x0) / (g.W - x0);
      ctx.lineTo(x, y0 + (1 - Math.sin(f * Math.PI * 0.5)) * g.U * 7 + Math.sin(x * 0.2) * g.U * 0.4);
    }
    ctx.lineTo(g.W, y1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INDIGO.mid;
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const x = x0 + g.U * 6 + rand() * (g.W - x0 - g.U * 8);
      const y = y0 + g.U * (1.6 + rand() * (y1 - y0) / g.U * 0.8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + g.U * 1.2, y - g.U * 1.3, x + g.U * 3, y - g.U * 0.4, x + g.U * 3.4, y + g.U * 0.8);
      ctx.stroke();
    }
    ctx.strokeStyle = INDIGO.foam;
    for (let i = 0; i < 10; i++) {
      const x = x0 + g.U * 8 + rand() * (g.W - x0 - g.U * 12);
      const y = y0 + g.U * (2 + rand() * 3.5);
      ctx.beginPath();
      ctx.arc(x, y, g.U * (0.9 + rand() * 0.9), Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
  }

  function at(p, t) {
    const m = 1 - t;
    return {
      x: m * m * m * p[0] + 3 * m * m * t * p[2] + 3 * m * t * t * p[4] + t * t * t * p[6],
      y: m * m * m * p[1] + 3 * m * m * t * p[3] + 3 * m * t * t * p[5] + t * t * t * p[7],
    };
  }

  // A limb is a run of overlapping discs along a curve, thinning toward the end.
  function limb(ctx, p, w0, w1, rand) {
    const steps = 46;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = at(p, t);
      const r = lerp(w0, w1, t) / 2;
      ctx.fillStyle = BARK.base;
      blob(ctx, c.x, c.y, r, r);
    }
    for (let i = 0; i <= steps * 2; i++) {
      const t = i / (steps * 2);
      const c = at(p, t);
      const r = lerp(w0, w1, t) / 2;
      const k = rand();
      if (k < 0.45) {
        ctx.fillStyle = BARK.plate;
        ctx.fillRect(Math.round(c.x + (rand() - 0.5) * r * 1.5), Math.round(c.y), Math.max(1, Math.round(r * 0.8)), 1);
      } else if (k < 0.6) {
        ctx.fillStyle = BARK.high;
        ctx.fillRect(Math.round(c.x - r * 0.5 + rand() * r * 0.6), Math.round(c.y), 1, 1);
      }
    }
  }

  // A round burst of needles, the way pines are painted on screens.
  function pad(ctx, x, y, r, rand) {
    ctx.fillStyle = MOSS.dark;
    blob(ctx, x, y, r * 0.55, r * 0.4);
    const tones = [MOSS.dark, MOSS.mid, MOSS.mid, MOSS.light];
    const count = Math.round(26 + r * 2.2);
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rand() * 0.1;
      const len = r * (0.7 + rand() * 0.3);
      const squash = a > Math.PI ? 0.78 : 0.5;
      ctx.strokeStyle = tones[Math.floor(rand() * 4)];
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.12, y + Math.sin(a) * r * 0.1);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * squash);
      ctx.stroke();
    }
    ctx.fillStyle = MOSS.light;
    for (let i = 0; i < 4; i++) {
      blob(ctx, x - r * 0.1 + (rand() - 0.5) * r * 0.5, y - r * (0.1 + rand() * 0.15), r * 0.14, r * 0.06);
    }
  }

  function padsAlong(ctx, p, from, to, count, r, rand) {
    for (let i = 0; i < count; i++) {
      const t = lerp(from, to, count === 1 ? 1 : i / (count - 1));
      const c = at(p, t);
      pad(ctx, c.x, c.y - r * 0.25, r * (0.85 + rand() * 0.3), rand);
    }
  }

  function paintPine(ctx, g, rand) {
    const W = g.W;
    const U = g.U;
    const trunk = [W * 0.21, U * 90, W * 0.12, U * 62, W * 0.27, U * 40, W * 0.2, U * 4];
    const high = [W * 0.205, U * 17, W * 0.27, U * 10, W * 0.33, U * 15, W * 0.4, U * 9];
    const mid = [W * 0.225, U * 37, W * 0.3, U * 27, W * 0.4, U * 36, W * 0.53, U * 24];
    const low = [W * 0.19, U * 55, W * 0.12, U * 50, W * 0.08, U * 52, W * 0.02, U * 44];
    limb(ctx, trunk, U * 7.5, U * 3.2, rand);
    limb(ctx, high, U * 2.2, U * 0.8, rand);
    limb(ctx, mid, U * 3, U * 0.9, rand);
    limb(ctx, low, U * 2.4, U * 0.8, rand);
    padsAlong(ctx, mid, 0.45, 1, 4, U * 11, rand);
    padsAlong(ctx, high, 0.4, 1, 3, U * 9.5, rand);
    padsAlong(ctx, low, 0.35, 1, 3, U * 9.5, rand);
    pad(ctx, W * 0.2, U * 6, U * 11, rand);
    pad(ctx, W * 0.285, U * 25, U * 9, rand);
    pad(ctx, W * 0.13, U * 34, U * 8.5, rand);
  }

  // ---- cranes --------------------------------------------------------------

  function standingCrane(ctx, x, y, h, dir) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    const lw = Math.max(1, h * 0.04);
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-h * 0.02, -h * 0.5);
    ctx.lineTo(-h * 0.05, -h * 0.25);
    ctx.lineTo(-h * 0.04, 0);
    ctx.moveTo(h * 0.05, -h * 0.5);
    ctx.lineTo(h * 0.09, -h * 0.24);
    ctx.lineTo(h * 0.12, 0);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(-h * 0.12, -h * 0.62);
    ctx.quadraticCurveTo(-h * 0.3, -h * 0.58, -h * 0.34, -h * 0.4);
    ctx.quadraticCurveTo(-h * 0.2, -h * 0.47, -h * 0.04, -h * 0.5);
    ctx.fill();
    ctx.fillStyle = WASHI;
    blob(ctx, -h * 0.02, -h * 0.6, h * 0.19, h * 0.115, -0.22);
    ctx.fillStyle = WASHI_SHADE;
    blob(ctx, -h * 0.05, -h * 0.56, h * 0.12, h * 0.055, -0.22);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.2, h * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(h * 0.13, -h * 0.64);
    ctx.bezierCurveTo(h * 0.24, -h * 0.72, h * 0.04, -h * 0.84, h * 0.17, -h * 0.97);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = WASHI;
    blob(ctx, h * 0.18, -h * 1.0, h * 0.05, h * 0.04);
    ctx.fillStyle = VERMILION;
    blob(ctx, h * 0.17, -h * 1.035, h * 0.03, h * 0.016);
    ctx.strokeStyle = '#a89a6e';
    ctx.lineWidth = Math.max(1, h * 0.03);
    ctx.beginPath();
    ctx.moveTo(h * 0.22, -h * 1.0);
    ctx.lineTo(h * 0.33, -h * 0.97);
    ctx.stroke();
    ctx.restore();
  }

  function flyingCrane(ctx, x, y, s, dir, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(dir, 1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 0.03);
    ctx.lineTo(-s * 0.85, s * 0.1);
    ctx.moveTo(-s * 0.3, s * 0.06);
    ctx.lineTo(-s * 0.8, s * 0.17);
    ctx.stroke();
    const wing = (flip, tone) => {
      const k = flip;
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.moveTo(s * 0.12, -k * s * 0.04);
      ctx.quadraticCurveTo(-s * 0.08, -k * s * 0.55, -s * 0.5, -k * s * 0.78);
      ctx.lineTo(-s * 0.62, -k * s * 0.5);
      ctx.quadraticCurveTo(-s * 0.4, -k * s * 0.3, -s * 0.28, -k * s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let i = 0; i < 5; i++) {
        const f = i / 4;
        ctx.beginPath();
        ctx.moveTo(-s * (0.46 + f * 0.13), -k * s * (0.74 - f * 0.26));
        ctx.lineTo(-s * (0.5 + f * 0.2), -k * s * (0.9 - f * 0.4));
        ctx.stroke();
      }
    };
    wing(1, '#e4dcc6');
    ctx.fillStyle = WASHI;
    blob(ctx, -s * 0.05, 0, s * 0.34, s * 0.075, 0.04);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.02);
    ctx.lineTo(-s * 0.46, s * 0.04);
    ctx.lineTo(-s * 0.3, s * 0.07);
    ctx.fill();
    wing(-1, WASHI);
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.2, s * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.25, -s * 0.01);
    ctx.quadraticCurveTo(s * 0.4, -s * 0.03, s * 0.52, -s * 0.07);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = WASHI;
    blob(ctx, s * 0.55, -s * 0.08, s * 0.045, s * 0.035);
    ctx.fillStyle = VERMILION;
    blob(ctx, s * 0.55, -s * 0.108, s * 0.025, s * 0.012);
    ctx.strokeStyle = '#a89a6e';
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(s * 0.59, -s * 0.08);
    ctx.lineTo(s * 0.7, -s * 0.07);
    ctx.stroke();
    ctx.restore();
  }

  // ---- the painted doors ---------------------------------------------------

  function paintDoors(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const W = g.W;
    paintLeaf(ctx, g, rand);
    cloud(ctx, -U * 4, U * 58, W * 0.55, U * 8, 1.1);
    cloud(ctx, W * 0.5, U * 32, W * 0.62, U * 7, 2.4);
    stream(ctx, g, W * 0.52, U * 72, g.bot, rand);
    mound(ctx, W * 0.72, U * 79, U * 15, U * 5, rand);
    mound(ctx, W * 0.22, U * 82, U * 22, U * 5.5, rand);
    mound(ctx, W * 0.96, U * 80, U * 12, U * 4, rand);
    paintPine(ctx, g, rand);
    standingCrane(ctx, W * 0.68, U * 77.5, U * 27, 1);
    standingCrane(ctx, W * 0.775, U * 78, U * 22, -1);
    cloud(ctx, W * 0.1, U * 70, W * 0.5, U * 7, 0.3);
    flyingCrane(ctx, W * 0.62, U * 27, U * 19, 1, -0.1);
    flyingCrane(ctx, W * 0.79, U * 18, U * 15, 1, -0.16);
    flyingCrane(ctx, W * 0.9, U * 32, U * 12, 1, -0.05);
    return c;
  }

  function paintFrames(ctx, g, rand) {
    const U = g.U;
    ctx.fillStyle = WOOD.ceiling;
    ctx.fillRect(0, 0, g.W, g.top);
    ctx.fillStyle = WOOD.lintel;
    ctx.fillRect(0, U * 2.6, g.W, g.top - U * 2.6);
    ctx.fillStyle = WOOD.lintelHi;
    ctx.fillRect(0, U * 2.6, g.W, 1);
    for (let i = 0; i < g.W / 6; i++) ctx.fillRect(Math.floor(rand() * g.W), Math.floor(U * 3 + rand() * (g.top - U * 3.5)), Math.floor(4 + rand() * 9), 1);
    ctx.fillStyle = '#100d0a';
    ctx.fillRect(0, g.top - 1, g.W, 1);
    const sw = Math.max(2, Math.round(U * 1.1));
    for (let i = 0; i <= g.n; i++) {
      const x = Math.round(i * g.pw - sw / 2);
      ctx.fillStyle = WOOD.rail;
      ctx.fillRect(x, g.top, sw, g.bot - g.top);
      ctx.fillStyle = WOOD.railHi;
      ctx.fillRect(x + (i % 2 ? 0 : sw - 1), g.top, 1, g.bot - g.top);
    }
    ctx.fillStyle = WOOD.rail;
    ctx.fillRect(0, g.top, g.W, Math.max(1, Math.round(U * 0.8)));
    ctx.fillRect(0, g.bot - Math.round(U * 0.8), g.W, Math.round(U * 0.8));
    for (let i = 0; i < g.n; i++) {
      const hx = i % 2 ? (i + 1) * g.pw - U * 4 : i * g.pw + U * 4;
      const hy = U * 52;
      ctx.fillStyle = '#d6b050';
      blob(ctx, hx, hy, U * 1.5, U * 1.5);
      ctx.fillStyle = '#2a211b';
      blob(ctx, hx, hy, U * 0.95, U * 0.95);
    }
    ctx.fillStyle = WOOD.rail;
    ctx.fillRect(0, g.bot, g.W, g.floor - g.bot);
    ctx.fillStyle = WOOD.railHi;
    ctx.fillRect(0, g.bot, g.W, 1);
  }

  function paintFloor(ctx, g, rand) {
    const U = g.U;
    const h = g.H - g.floor;
    ctx.fillStyle = MAT.base;
    ctx.fillRect(0, g.floor, g.W, h);
    for (let y = g.floor; y < g.H; y += 2) {
      ctx.fillStyle = y % 4 ? MAT.alt : MAT.base;
      ctx.fillRect(0, y, g.W, 1);
    }
    ctx.fillStyle = 'rgba(150,158,98,0.35)';
    for (let i = 0; i < g.W / 3; i++) ctx.fillRect(Math.floor(rand() * g.W), Math.floor(g.floor + rand() * h), 2 + Math.floor(rand() * 4), 1);
    const vx = g.W * 0.5;
    const vy = U * 38;
    ctx.strokeStyle = MAT.edge;
    ctx.lineWidth = Math.max(1, U * 0.5);
    for (let i = -2; i <= g.n + 2; i += 2) {
      const x0 = i * g.pw;
      ctx.beginPath();
      ctx.moveTo(x0, g.floor);
      ctx.lineTo(vx + (x0 - vx) * ((g.H - vy) / (g.floor - vy)), g.H);
      ctx.stroke();
    }
    ctx.fillRect(0, g.floor + U * 6.2, g.W, Math.max(1, U * 0.5));
    ctx.fillStyle = MAT.edge;
    ctx.fillRect(0, g.floor, g.W, Math.max(1, U * 0.5));
  }

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d', { alpha: false });
    ctx.drawImage(paintDoors(g, rand), 0, 0);
    paintFrames(ctx, g, rand);
    paintFloor(ctx, g, rand);
    return c;
  }

  // ---- lamp, veil, glow, shadow --------------------------------------------

  function lampSpot(g) {
    return { x: g.W * 0.075, y: g.H * 0.78, base: g.H * 0.975, size: g.U };
  }

  function paintLamp(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const L = lampSpot(g);
    const u = L.size;
    const w = u * 9;
    const top = L.base - u * 34;
    const gr = ctx.createLinearGradient(0, top, 0, L.base - u * 4);
    gr.addColorStop(0, '#f6e2ae');
    gr.addColorStop(0.55, '#f2d28c');
    gr.addColorStop(1, '#e0aa5c');
    ctx.fillStyle = gr;
    ctx.fillRect(L.x - w / 2, top, w, u * 30);
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(L.x - w / 2 - 1, top - u * 1.4, w + 2, u * 1.5);
    ctx.fillRect(L.x - w / 2 - u, L.base - u * 4, w + u * 2, u * 4);
    ctx.fillStyle = '#6a4d33';
    ctx.fillRect(L.x - w / 2 - u, L.base - u * 4, w + u * 2, 1);
    ctx.fillStyle = '#5a3f2a';
    const post = Math.max(1, Math.round(u * 0.6));
    for (let i = 0; i <= 3; i++) ctx.fillRect(Math.round(L.x - w / 2 + (w - post) * (i / 3)), top, post, u * 30);
    for (let y = top + u * 6; y < L.base - u * 4; y += u * 7.4) ctx.fillRect(L.x - w / 2, Math.round(y), w, post);
    return c;
  }

  function paintVeil(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const L = lampSpot(g);
    const gr = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, g.W * 1.05);
    gr.addColorStop(0, 'rgba(12,14,32,0.02)');
    gr.addColorStop(0.18, 'rgba(12,14,32,0.1)');
    gr.addColorStop(0.5, 'rgba(12,14,32,0.26)');
    gr.addColorStop(1, 'rgba(12,14,32,0.44)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const L = lampSpot(g);
    const gr = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, g.W * 0.8);
    gr.addColorStop(0, 'rgba(255,196,110,0.5)');
    gr.addColorStop(0.15, 'rgba(255,178,92,0.28)');
    gr.addColorStop(0.4, 'rgba(240,150,70,0.1)');
    gr.addColorStop(1, 'rgba(240,150,70,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // A soft slanted band of shade, like the edge of something hanging beyond the lamp.
  function paintShade(g) {
    const sw = g.W * 0.34;
    const slant = 0.24;
    const c = layer(sw + g.H * slant, g.H);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, -slant, 1, g.H * slant, 0);
    const gr = ctx.createLinearGradient(0, 0, sw, 0);
    gr.addColorStop(0, 'rgba(8,8,18,0)');
    gr.addColorStop(0.3, 'rgba(8,8,18,0.34)');
    gr.addColorStop(0.55, 'rgba(8,8,18,0.4)');
    gr.addColorStop(1, 'rgba(8,8,18,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, sw, g.H);
    return c;
  }

  function makeGlints(g, rand) {
    const out = [];
    for (let i = 0; i < GLINTS; i++) {
      out.push({
        x: Math.floor(g.W * (0.04 + rand() * 0.92)),
        y: Math.floor(g.top + rand() * (g.bot - g.top - 4) + 2),
        p: rand() * TAU,
        f: 0.25 + rand() * 0.5,
      });
    }
    return out;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.room = paintRoom(g, rand);
    state.lamp = paintLamp(g);
    state.veil = paintVeil(g);
    state.glow = paintGlow(g);
    state.shade = paintShade(g);
    state.glints = makeGlints(g, rand);
  }

  function lampLevel(t) {
    return 0.5 * Math.sin(t * 5.3) + 0.3 * Math.sin(t * 8.9 + 1.2) + 0.2 * Math.sin(t * 2.1 + 0.4);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { flicker, shadow, glints } = api.props;
    const f = lampLevel(t) * flicker;
    ctx.drawImage(state.room, 0, 0);
    if (shadow > 0) {
      const sw = state.shade.width;
      const phase = 0.5 + 0.5 * Math.sin(t * 0.07 - 1.2);
      ctx.globalAlpha = Math.min(1, shadow * 0.875);
      ctx.drawImage(state.shade, Math.round(lerp(-sw, g.W - sw * 0.2, phase)), 0);
    }
    ctx.globalAlpha = clamp(1 - f * 0.12, 0, 1);
    ctx.drawImage(state.veil, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.lamp, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(0.8 + f * 0.2, 0, 1);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (glints) {
      ctx.fillStyle = '#f6e6a8';
      for (let i = 0; i < GLINTS; i++) {
        const s = state.glints[i];
        const a = Math.sin(t * s.f + s.p);
        if (a < 0.55) continue;
        ctx.globalAlpha = (a - 0.55) * 1.6;
        ctx.fillRect(s.x, s.y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  Kasuri.run({
    defaults: { flicker: 1, shadow: 1, glints: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    seed: 4417,
    setup,
    draw,
  });
})();
