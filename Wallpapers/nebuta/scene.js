/*
 * ねぶた Nebuta — a lantern-lit warrior float on a summer festival night.
 *
 * Sky, roofs, street, the float and its glow are baked once. Each frame the
 * float is drawn rocking a little on its bearers' shoulders, the glow breathes,
 * two strings of paper lanterns swing, and a few sparks drift upward.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;

  const INK = '#12151f';
  const WASHI = '#e8dfc8';
  const INDIGO = '#27345a';
  const VERMILION = '#c8452c';
  const GOLD = '#d9a73a';
  const BEAM = '#5a4636';

  const STREET = 0.74;
  const BASE = 0.85;
  const STRINGS = [
    { y: 0.06, sag: 0.05, n: 15 },
    { y: 0.095, sag: 0.03, n: 13 },
  ];
  const POLES = [0.06, 0.94];
  const MAX_LANTERNS = 32;
  const MAX_SPARKS = 18;
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
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    return { W, H, U, u, cx: W * 0.5, by: H * BASE, s: u * 0.88, top: H * STREET };
  }

  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }

  function paint(ctx, fill, line, lw) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (line) {
      ctx.strokeStyle = line;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  function ellipse(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  }

  // ---- sky, hills and roofs -------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.top);
    grad.addColorStop(0, '#0d1120');
    grad.addColorStop(0.6, '#1b2442');
    grad.addColorStop(1, '#3a4670');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.top + 1);
    ctx.fillStyle = WASHI;
    for (let i = 0; i < g.W * 0.35; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e6d9ad';
    ellipse(ctx, g.W * 0.15, g.H * 0.2, g.U * 3.2, g.U * 3.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 223, 200, 0.12)';
    ellipse(ctx, g.W * 0.15, g.H * 0.2, g.U * 7, g.U * 7);
    ctx.fill();
  }

  function paintHills(ctx, g) {
    ctx.fillStyle = '#1a2240';
    ctx.beginPath();
    ctx.moveTo(0, g.top);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const peak = Math.exp(-(((x - g.W * 0.8) / (g.W * 0.12)) ** 2)) * g.H * 0.1;
      ctx.lineTo(x, g.H * 0.5 - peak - K.fbm(x / (g.U * 38), 2.2, 3, 7) * g.H * 0.07);
    }
    ctx.lineTo(g.W, g.top);
    ctx.fill();
  }

  function roof(ctx, x, y, w, rise, eave) {
    ctx.fillStyle = '#222b47';
    ctx.beginPath();
    ctx.moveTo(x - eave, y);
    ctx.quadraticCurveTo(x + w * 0.1, y - rise * 0.2, x + w * 0.25, y - rise);
    ctx.lineTo(x + w * 0.75, y - rise);
    ctx.quadraticCurveTo(x + w * 0.9, y - rise * 0.2, x + w + eave, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#12182c';
    ctx.fillRect(x - eave, y, w + eave * 2, Math.max(1, rise * 0.14));
  }

  function house(ctx, g, rand, x, w, h) {
    const u = g.u;
    const y = g.top;
    ctx.fillStyle = '#151a2b';
    ctx.fillRect(x, y - h, w, h);
    roof(ctx, x, y - h, w, u * (3 + rand() * 2), u * 1.4);
    const cols = Math.max(2, Math.floor(w / (u * 3.2)));
    const step = w / cols;
    for (let i = 0; i < cols; i++) {
      const lit = rand() < 0.62;
      ctx.fillStyle = lit ? (rand() < 0.5 ? GOLD : '#c9a24f') : '#222b47';
      ctx.globalAlpha = lit ? 0.75 : 0.9;
      ctx.fillRect(x + i * step + step * 0.2, y - h + u * 2, step * 0.6, u * 3.4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK;
      ctx.fillRect(x + i * step + step * 0.5 - 0.5, y - h + u * 2, 1, u * 3.4);
    }
    ctx.fillStyle = '#1f2640';
    ctx.fillRect(x - u * 0.6, y - h * 0.5, w + u * 1.2, Math.max(1, u * 0.6));
    ctx.fillStyle = '#0e111b';
    ctx.fillRect(x + w * 0.1, y - h * 0.5 + u * 0.8, w * 0.8, h * 0.5 - u * 0.8);
  }

  function paintHouses(ctx, g, rand) {
    for (let x = -g.u * 2; x < g.W; ) {
      const w = g.u * (11 + rand() * 7);
      house(ctx, g, rand, x, w, g.u * (17 + rand() * 9));
      x += w + g.u * (0.3 + rand() * 1.2);
    }
  }

  // ---- street ----------------------------------------------------------------

  function paintStreet(ctx, g) {
    const grad = ctx.createLinearGradient(0, g.top, 0, g.H);
    grad.addColorStop(0, '#242633');
    grad.addColorStop(1, '#0f1119');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.top, g.W, g.H - g.top);
    ctx.fillStyle = 'rgba(217, 167, 58, 0.32)';
    ellipse(ctx, g.cx, g.by + g.u * 2, g.s * 58, g.u * 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(217, 167, 58, 0.2)';
    ellipse(ctx, g.cx, g.by + g.u * 4, g.s * 86, g.u * 9);
    ctx.fill();
  }

  function paintPoles(ctx, g) {
    const w = Math.max(2, g.u * 1.2);
    for (const f of POLES) {
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(g.W * f - w / 2, g.H * 0.04, w, g.H * 0.86);
      ctx.fillStyle = '#3a2d20';
      ctx.fillRect(g.W * f - w / 2, g.H * 0.04, Math.max(1, w * 0.3), g.H * 0.86);
      ctx.fillStyle = GOLD;
      ctx.fillRect(g.W * f - w * 0.8, g.H * 0.04 - g.u * 0.5, w * 1.6, g.u * 0.7);
    }
  }

  function stringY(g, st, f) {
    return g.H * (st.y + st.sag * 4 * f * (1 - f));
  }

  function paintStrings(ctx, g) {
    const x0 = g.W * POLES[0];
    const x1 = g.W * POLES[1];
    ctx.strokeStyle = '#3a3226';
    ctx.lineWidth = Math.max(1, g.u * 0.25);
    for (const st of STRINGS) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const f = i / 40;
        const x = x0 + (x1 - x0) * f;
        if (i === 0) ctx.moveTo(x, stringY(g, st, f));
        else ctx.lineTo(x, stringY(g, st, f));
      }
      ctx.stroke();
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g);
    paintHouses(ctx, g, rand);
    paintStreet(ctx, g);
    paintPoles(ctx, g);
    paintStrings(ctx, g);
    return c;
  }

  // ---- the float ---------------------------------------------------------------

  function halo(ctx) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      const w = 0.17;
      path(ctx, [
        Math.cos(a - w) * 23.5, -49 + Math.sin(a - w) * 23.5,
        Math.cos(a) * 29, -49 + Math.sin(a) * 29,
        Math.cos(a + w) * 23.5, -49 + Math.sin(a + w) * 23.5,
      ]);
      paint(ctx, i % 2 ? GOLD : VERMILION, INK, 0.6);
    }
    const g = ctx.createRadialGradient(0, -49, 2, 0, -49, 24);
    g.addColorStop(0, '#efe3bd');
    g.addColorStop(0.55, '#e6c462');
    g.addColorStop(1, '#d28a3a');
    ellipse(ctx, 0, -49, 24, 24);
    paint(ctx, g, INK, 0.9);
    ellipse(ctx, 0, -49, 20.5, 20.5);
    paint(ctx, null, 'rgba(18, 21, 31, 0.5)', 0.4);
  }

  function ribbons(ctx) {
    for (const sg of [-1, 1]) {
      const sets = [
        [28, -33, 40, -42, 52, -30, 46, -16],
        [28, -24, 38, -22, 44, -12, 36, -6],
      ];
      for (const r of sets) {
        ctx.beginPath();
        ctx.moveTo(sg * r[0], r[1]);
        ctx.bezierCurveTo(sg * r[2], r[3], sg * r[4], r[5], sg * r[6], r[7]);
        paint(ctx, null, INK, 3.6);
        paint(ctx, null, GOLD, 2.3);
        paint(ctx, null, VERMILION, 0.8);
      }
    }
  }

  function sword(ctx) {
    path(ctx, [24, -24, 38, -71, 40.6, -70.4, 27, -22]);
    paint(ctx, '#e8d9a0', INK, 0.7);
    ellipse(ctx, 25.6, -22.5, 3.6, 1.2, -0.3);
    paint(ctx, GOLD, INK, 0.6);
    path(ctx, [24.4, -22, 27, -22, 26.6, -13, 24, -13]);
    paint(ctx, INK, null, 0);
  }

  function plate(ctx, sg) {
    const x0 = sg > 0 ? 16 : -30;
    ctx.beginPath();
    ctx.roundRect(x0, -36, 14, 24, 2);
    paint(ctx, INDIGO, INK, 0.8);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.5;
    for (let y = -33; y < -13; y += 3) {
      ctx.beginPath();
      ctx.moveTo(x0 + 1, y);
      ctx.lineTo(x0 + 13, y);
      ctx.stroke();
    }
    ctx.fillStyle = VERMILION;
    ctx.fillRect(x0 + 6.4, -36, 1.2, 24);
  }

  function tomoe(ctx, x, y) {
    ellipse(ctx, x, y, 6.2, 6.2);
    paint(ctx, GOLD, INK, 0.8);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - 1.57;
      const px = x + Math.cos(a) * 3.1;
      const py = y + Math.sin(a) * 3.1;
      ellipse(ctx, px, py, 1.25, 1.25);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 3.1, a - 1.3, a, false);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  function body(ctx) {
    const grad = ctx.createLinearGradient(0, -38, 0, -9);
    grad.addColorStop(0, '#dd6a3a');
    grad.addColorStop(1, '#b53a28');
    ctx.beginPath();
    ctx.moveTo(-6, -38);
    ctx.bezierCurveTo(-14, -37, -24, -33, -28, -26);
    ctx.lineTo(-30, -9);
    ctx.lineTo(30, -9);
    ctx.lineTo(28, -26);
    ctx.bezierCurveTo(24, -33, 14, -37, 6, -38);
    ctx.closePath();
    paint(ctx, grad, INK, 0.9);
    plate(ctx, 1);
    plate(ctx, -1);
    path(ctx, [-6, -38, 6, -38, 0, -22]);
    paint(ctx, WASHI, INK, 0.7);
    path(ctx, [-4.2, -38, 4.2, -38, 0, -28]);
    paint(ctx, INDIGO, null, 0);
    tomoe(ctx, 0, -17);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-30, -14, 60, 4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-30, -14, 60, 4);
    ctx.fillStyle = INK;
    for (let x = -26; x <= 26; x += 4) ctx.fillRect(x, -14, 0.5, 4);
  }

  function hair(ctx) {
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sg * 8, -57);
      ctx.bezierCurveTo(sg * 15, -59, sg * 19, -52, sg * 16, -44);
      ctx.bezierCurveTo(sg * 15, -48, sg * 13, -49, sg * 11, -49);
      ctx.closePath();
      paint(ctx, INK, null, 0);
      ctx.beginPath();
      ctx.moveTo(sg * 10, -46);
      ctx.bezierCurveTo(sg * 17, -44, sg * 21, -34, sg * 16, -28);
      ctx.bezierCurveTo(sg * 15, -33, sg * 12, -35, sg * 10, -36);
      ctx.closePath();
      paint(ctx, INK, null, 0);
    }
  }

  function shikoro(ctx) {
    for (const sg of [-1, 1]) {
      path(ctx, [sg * 9, -57, sg * 14, -48, sg * 13, -39, sg * 8, -40]);
      paint(ctx, INDIGO, INK, 0.7);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 0.45;
      for (let y = -54; y < -41; y += 3) {
        ctx.beginPath();
        ctx.moveTo(sg * 9.5, y);
        ctx.lineTo(sg * 13.5, y + 1.5);
        ctx.stroke();
      }
    }
  }

  function brow(ctx, sg) {
    ctx.beginPath();
    ctx.moveTo(sg * 8, -55.5);
    ctx.bezierCurveTo(sg * 5.5, -55, sg * 3, -53.5, sg * 1, -51.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function eye(ctx, sg) {
    ctx.beginPath();
    ctx.moveTo(sg * 6.7, -50.4);
    ctx.quadraticCurveTo(sg * 4, -52.3, sg * 1.6, -49.6);
    ctx.quadraticCurveTo(sg * 4, -48.4, sg * 6.7, -50.4);
    paint(ctx, WASHI, INK, 0.5);
    ellipse(ctx, sg * 3.9, -50.1, 0.95, 0.95);
    ctx.fillStyle = INK;
    ctx.fill();
  }

  function mustache(ctx, sg) {
    ctx.beginPath();
    ctx.moveTo(sg * 0.6, -44.4);
    ctx.bezierCurveTo(sg * 4, -46, sg * 8, -44.2, sg * 12, -40.2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sg * 0.6, -43.2);
    ctx.bezierCurveTo(sg * 3.5, -43, sg * 6.5, -42, sg * 9, -38.8);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function face(ctx) {
    const grad = ctx.createRadialGradient(0, -49, 1, 0, -48, 11);
    grad.addColorStop(0, '#e0663e');
    grad.addColorStop(1, '#a92f24');
    ctx.beginPath();
    ctx.moveTo(0, -59);
    ctx.bezierCurveTo(7, -59, 9, -52, 8, -47);
    ctx.bezierCurveTo(7, -41, 3, -38, 0, -38);
    ctx.bezierCurveTo(-3, -38, -7, -41, -8, -47);
    ctx.bezierCurveTo(-9, -52, -7, -59, 0, -59);
    ctx.closePath();
    paint(ctx, grad, INK, 0.9);
    brow(ctx, 1);
    brow(ctx, -1);
    eye(ctx, 1);
    eye(ctx, -1);
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(-1, -45);
    ctx.lineTo(1, -45);
    paint(ctx, null, INK, 0.55);
    mustache(ctx, 1);
    mustache(ctx, -1);
    ellipse(ctx, 0, -41.4, 2.4, 0.8);
    paint(ctx, '#5a1e1a', null, 0);
    path(ctx, [-3, -39, 3, -39, 0, -32]);
    paint(ctx, INK, null, 0);
    ellipse(ctx, 0, -56.2, 0.9, 0.9);
    paint(ctx, GOLD, null, 0);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.45;
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sg * 7.2, -47);
      ctx.quadraticCurveTo(sg * 6.4, -44.5, sg * 4.8, -43);
      ctx.stroke();
    }
  }

  function helmet(ctx) {
    const grad = ctx.createLinearGradient(0, -65, 0, -56);
    grad.addColorStop(0, '#ecd27a');
    grad.addColorStop(1, '#c4902f');
    ctx.beginPath();
    ctx.moveTo(-9, -56.5);
    ctx.bezierCurveTo(-9, -65, 9, -65, 9, -56.5);
    ctx.closePath();
    paint(ctx, grad, INK, 0.8);
    ctx.fillStyle = INK;
    ctx.fillRect(-10.2, -57, 20.4, 2.3);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-10.2, -56.2, 20.4, 0.6);
    ctx.beginPath();
    ctx.arc(0, -71, 10, 0.12 * Math.PI, 0.88 * Math.PI, false);
    ctx.arc(0, -72.4, 8, 0.88 * Math.PI, 0.12 * Math.PI, true);
    ctx.closePath();
    paint(ctx, GOLD, INK, 0.8);
    path(ctx, [-1.4, -62, 0, -70, 1.4, -62]);
    paint(ctx, GOLD, INK, 0.6);
    ellipse(ctx, 0, -67.6, 2.1, 2.1);
    paint(ctx, VERMILION, INK, 0.5);
  }

  function platform(ctx) {
    ctx.fillStyle = BEAM;
    ctx.fillRect(-52, -3.4, 104, 1.8);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-52, -3.4, 1.4, 1.8);
    ctx.fillRect(50.6, -3.4, 1.4, 1.8);
    ctx.fillStyle = '#171a26';
    ctx.fillRect(-38, -9, 76, 7.4);
    ctx.fillStyle = VERMILION;
    ctx.fillRect(-38, -9, 76, 2.4);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-38, -6.6, 76, 0.7);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-38, -9, 76, 7.4);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.4;
    for (let x = -34; x <= 34; x += 5.5) {
      path(ctx, [x, -5.6, x + 2.2, -4.3, x, -3, x - 2.2, -4.3]);
      ctx.stroke();
    }
  }

  function paintFloat(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(g.cx, g.by);
    ctx.scale(g.s, g.s);
    halo(ctx);
    ribbons(ctx);
    sword(ctx);
    hair(ctx);
    body(ctx);
    shikoro(ctx);
    face(ctx);
    helmet(ctx);
    platform(ctx);
    ctx.restore();
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const cy = g.by - g.s * 42;
    const r = g.s * 92;
    const grad = ctx.createRadialGradient(g.cx, cy, g.s * 8, g.cx, cy, r);
    grad.addColorStop(0, 'rgba(230, 190, 90, 0.7)');
    grad.addColorStop(0.5, 'rgba(200, 90, 50, 0.3)');
    grad.addColorStop(1, 'rgba(200, 90, 50, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintShade(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.by, 0, g.H);
    grad.addColorStop(0, 'rgba(15, 17, 25, 0.2)');
    grad.addColorStop(1, 'rgba(15, 17, 25, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.by, g.W, g.H - g.by);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.u * 14);
    const c = layer(w * 2, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(31);
    ctx.fillStyle = 'rgba(232, 223, 200, 0.07)';
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * w;
      const y = h * (0.35 + rand() * 0.4);
      for (const o of [0, w]) {
        ellipse(ctx, x + o, y, g.u * (10 + rand() * 12), g.u * (1.6 + rand() * 1.8));
        ctx.fill();
      }
    }
    return c;
  }

  // ---- lanterns and sparks ---------------------------------------------------

  function paintLantern(g) {
    const u = g.u;
    const w = Math.ceil(u * 16);
    const h = Math.ceil(u * 18);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const cy = u * 5.2;
    const glow = ctx.createRadialGradient(cx, cy, u * 1, cx, cy, u * 7.5);
    glow.addColorStop(0, 'rgba(230, 170, 80, 0.4)');
    glow.addColorStop(1, 'rgba(230, 170, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const body = ctx.createRadialGradient(cx, cy - u * 0.4, u * 0.3, cx, cy, u * 3.2);
    body.addColorStop(0, '#eb8452');
    body.addColorStop(1, '#b53a28');
    ellipse(ctx, cx, cy, u * 2.3, u * 3);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = 'rgba(18, 21, 31, 0.55)';
    ctx.lineWidth = Math.max(1, u * 0.18);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + i * u * 0.95, u * 2.3 * Math.sqrt(1 - ((i * 0.95) / 3) ** 2), u * 0.35, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.fillRect(cx - u * 1.1, cy - u * 3.2, u * 2.2, u * 0.8);
    ctx.fillRect(cx - u * 1.1, cy + u * 2.4, u * 2.2, u * 0.8);
    ctx.fillRect(cx - u * 0.12, cy - u * 4.4, Math.max(1, u * 0.24), u * 1.3);
    ctx.fillStyle = GOLD;
    ctx.fillRect(cx - u * 0.12, cy + u * 3.2, Math.max(1, u * 0.24), u * 1.4);
    return { canvas: c, ox: cx, oy: cy - u * 4.4 };
  }

  function makeLanterns(g, rand) {
    const L = { x: new Float32Array(MAX_LANTERNS), y: new Float32Array(MAX_LANTERNS), p: new Float32Array(MAX_LANTERNS), count: 0 };
    const x0 = g.W * POLES[0];
    const x1 = g.W * POLES[1];
    for (const st of STRINGS) {
      for (let i = 0; i < st.n && L.count < MAX_LANTERNS; i++) {
        const f = (i + 0.5) / st.n;
        L.x[L.count] = x0 + (x1 - x0) * f;
        L.y[L.count] = stringY(g, st, f);
        L.p[L.count] = rand() * TAU;
        L.count++;
      }
    }
    return L;
  }

  function makeSparks() {
    const S = {};
    for (const k of ['x', 'y', 'vx', 'vy', 'life', 'age', 'p']) S[k] = new Float32Array(MAX_SPARKS);
    return S;
  }

  function resetSpark(g, rand, i, scatter) {
    const S = state.sparks;
    S.x[i] = g.cx + (rand() - 0.5) * g.s * 80;
    S.y[i] = g.by - g.s * (10 + rand() * 60);
    S.vx[i] = (rand() - 0.5) * g.U * 0.5;
    S.vy[i] = -g.U * (1.2 + rand() * 1.4);
    S.life[i] = 5 + rand() * 5;
    S.age[i] = scatter ? rand() * S.life[i] : 0;
    S.p[i] = rand() * TAU;
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.glow = paintGlow(g);
    state.float = paintFloat(g);
    state.shade = paintShade(g);
    state.mist = paintMist(g);
    state.lantern = paintLantern(g);
    state.lanterns = makeLanterns(g, rand);
    state.sparks = makeSparks();
    for (let i = 0; i < MAX_SPARKS; i++) resetSpark(g, rand, i, true);
  }

  function drawFloat(ctx, g, t, sway) {
    const a = (Math.sin(t * 0.55) * 0.011 + Math.sin(t * 0.93 + 1) * 0.004) * sway;
    const bob = Math.sin(t * 1.1) * g.u * 0.3 * sway;
    ctx.setTransform(1, 0, 0, -0.4, 0, g.by * 1.4);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(state.float, Math.sin(t * 0.7) * g.u * 0.3, 0);
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(state.shade, 0, 0);
    ctx.translate(g.cx, g.by + bob);
    ctx.rotate(a);
    ctx.translate(-g.cx, -g.by);
    ctx.drawImage(state.float, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawLanterns(ctx, g, t, sway) {
    const L = state.lanterns;
    const sp = state.lantern;
    for (let i = 0; i < L.count; i++) {
      const a = Math.sin(t * 0.9 + L.p[i]) * 0.07 * sway + Math.sin(t * 0.37 + L.x[i] * 0.02) * 0.03 * sway;
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.setTransform(c, s, -s, c, L.x[i], L.y[i]);
      ctx.drawImage(sp.canvas, -sp.ox, -sp.oy);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawSparks(ctx, g, t, dt, amount) {
    const S = state.sparks;
    const count = Math.min(MAX_SPARKS, Math.round(MAX_SPARKS * 0.5 * amount));
    ctx.fillStyle = '#e6c462';
    for (let i = 0; i < count; i++) {
      S.age[i] += dt;
      if (S.age[i] > S.life[i]) resetSpark(g, state.rand, i, false);
      S.x[i] += (S.vx[i] + Math.sin(t * 0.8 + S.p[i]) * g.U * 0.25) * dt;
      S.y[i] += S.vy[i] * dt;
      const f = S.age[i] / S.life[i];
      ctx.globalAlpha = Math.sin(f * Math.PI) * 0.8;
      ctx.fillRect(Math.round(S.x[i]), Math.round(S.y[i]), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { glow, sway, sparks } = api.props;
    const breath = 0.8 + 0.2 * Math.sin(t * 0.8) + 0.05 * Math.sin(t * 1.9);
    ctx.drawImage(state.back, 0, 0);
    ctx.globalAlpha = Math.max(0, Math.min(1, breath * 0.9 * glow));
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    drawFloat(ctx, g, t, sway);
    const w = state.mist.width / 2;
    ctx.drawImage(state.mist, -((t * g.u * 0.6) % w), g.H - state.mist.height - g.u * 2);
    drawLanterns(ctx, g, t, sway);
    drawSparks(ctx, g, t, Math.min(dt, 0.1), sparks);
  }

  Kasuri.run({
    defaults: { glow: 1, sway: 1, sparks: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
