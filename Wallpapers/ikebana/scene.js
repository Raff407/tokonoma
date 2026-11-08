/*
 * 生花 Ikebana — one branch, one camellia and a few long leaves in a dark vase,
 * in a tokonoma alcove beside a hanging scroll of a misty mountain.
 *
 * The room and the flowers are baked once. Each step slides a few soft shadow
 * layers over the wall, copies the top of the picture into the lacquer as its
 * reflection, and moves one petal. The arrangement itself only breathes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const SQUASH = 0.72;
  const MIRROR = 0.7;
  const MOTES = 26;
  const INK = ['#e0d7bf', '#c8c2ae', '#a7a69a', '#838684', '#5e6366', '#40454b'];
  const PETAL_RED = ['#b83a26', '#c9452c', '#a8321f', '#d2553a'];
  const SPOTS = [[-15, 4], [10, 9], [-27, 12], [20, 5], [-7, 15], [-36, 6]];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function cubic(p, ox, oy, u, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const m = 1 - f;
      const at = (k) => m * m * m * p[0][k] + 3 * m * m * f * p[1][k] + 3 * m * f * f * p[2][k] + f * f * f * p[3][k];
      out.push([ox + u * at(0), oy + u * at(1)]);
    }
    return out;
  }

  function leaf(ctx, x, y, angle, len, wid, light, dark) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? light : dark;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.42, wid * side, len, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  // A long curved blade: two-toned either side of a pale midrib.
  function ribbon(ctx, pts, wid, light, dark, rib) {
    const n = pts.length - 1;
    const edge = (side) => {
      for (let i = 0; i <= n; i++) {
        const k = side > 0 ? i : n - i;
        const a = pts[Math.max(0, k - 1)];
        const b = pts[Math.min(n, k + 1)];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const w = wid * Math.sin(Math.PI * Math.pow(k / n, 0.62)) * side;
        ctx.lineTo(pts[k][0] - ((b[1] - a[1]) / len) * w, pts[k][1] + ((b[0] - a[0]) / len) * w);
      }
    };
    const half = (side, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      edge(side);
      for (let i = n; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.fill();
    };
    half(1, dark);
    half(-1, light);
    ctx.strokeStyle = rib;
    ctx.lineWidth = Math.max(0.6, wid * 0.14);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }

  function paintMottle(ctx, g) {
    const c = layer(g.W / 3, g.H / 3);
    const m = c.getContext('2d');
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const q = Math.round(fbm(x * 0.085, y * 0.12, 3, 31) * 5) / 5;
        m.fillStyle = q > 0.5 ? '#efe0b8' : '#3a2f22';
        m.globalAlpha = Math.abs(q - 0.5) * 0.5;
        m.fillRect(x, y, 1, 1);
      }
    }
    ctx.drawImage(c, 0, 0, g.W, g.H);
  }

  function paintPlaster(ctx, g, rand) {
    const wash = ctx.createLinearGradient(g.postL, 0, g.postR, 0);
    wash.addColorStop(0, '#dccba6');
    wash.addColorStop(0.55, '#c9b793');
    wash.addColorStop(1, '#a8987a');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, g.W, g.H);
    paintMottle(ctx, g);
    const count = Math.round(g.W * g.H * 0.05);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#d9c9a4' : '#5d5240';
      ctx.globalAlpha = 0.14 + rand() * 0.16;
      ctx.fillRect(rand() * g.W, rand() * g.H, Math.max(1, g.U * rand() * 1.6), 1);
    }
    ctx.globalAlpha = 1;
    const top = ctx.createLinearGradient(0, g.U * 5, 0, g.U * 17);
    top.addColorStop(0, 'rgba(50,38,28,0.42)');
    top.addColorStop(1, 'rgba(50,38,28,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, g.W, g.U * 17);
  }

  function ridge(u, base, left, right, peak, seed) {
    const d = Math.abs(u - peak);
    const crag = (fbm(u * 7, seed, 4, seed) - 0.5) * 0.24 * Math.min(1, d * 6);
    return base + (u < peak ? left : right) * Math.pow(d, 1.15) + crag;
  }

  // Ink value at one point of the painting, back to front, with mist between.
  function inkAt(u, v) {
    let ink = 0;
    const far = ridge(u, 0.36, 0.5, 0.7, 0.16, 3);
    if (v > far) ink = 2.3 * (1 - smoothstep(0.02, 0.2, v - far));
    const main = ridge(u, 0.08, 0.95, 1.5, 0.6, 7);
    if (v > main) {
      const shade = u > 0.6 + (fbm(v * 5, 2, 3, 5) - 0.5) * 0.4;
      const fold = fbm(u * 16, v * 2.5, 2, 9) > 0.58 ? 0.8 : 0;
      const face = shade ? 4.3 : 2.2 + fold;
      const body = face * (1 - smoothstep(0.08, 0.38, v - main));
      ink = Math.max(ink * (1 - smoothstep(0, 0.1, v - main)), body);
    }
    const near = 0.82 + Math.sin(u * 4.4 + 0.5) * 0.05 + (fbm(u * 9, 4, 2, 11) - 0.5) * 0.1;
    if (v > near) ink = Math.max(ink * 0.2, 5 * (1 - smoothstep(0.03, 0.17, v - near)));
    return Math.round(Math.min(5, ink));
  }

  function paintMountain(ctx, x0, y0, w, h) {
    const cols = Math.ceil(w);
    const rows = Math.ceil(h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = INK[inkAt(x / cols, y / rows)];
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }

  function paintScroll(ctx, g, rand) {
    const u = g.U;
    const w = u * 31;
    const x0 = g.scrollX - w / 2;
    const top = u * 9.5;
    const bottom = u * 62.5;
    ctx.strokeStyle = '#2d2219';
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.2, top);
    ctx.lineTo(g.scrollX, u * 6);
    ctx.lineTo(x0 + w * 0.8, top);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,22,16,0.42)';
    ctx.fillRect(x0 + u * 1.6, top + u, w, bottom - top + u);
    ctx.fillStyle = '#3f4a60';
    ctx.fillRect(x0, top, w, bottom - top);
    ctx.fillStyle = '#5e6a7c';
    for (let i = 0; i < w * (bottom - top) * 0.07; i++) ctx.fillRect(x0 + rand() * w, top + rand() * (bottom - top), 1, 1);
    const ix = x0 + u * 4;
    const iw = w - u * 8;
    const iy = top + u * 9;
    const ih = bottom - top - u * 18;
    ctx.fillStyle = '#b39a5c';
    ctx.fillRect(ix - u * 1.2, iy - u * 1.2, iw + u * 2.4, ih + u * 2.4);
    paintMountain(ctx, ix, iy, iw, ih);
    ctx.fillStyle = '#2b211a';
    ctx.fillRect(x0 - u * 0.4, top - u * 0.7, w + u * 0.8, u * 1.5);
    ctx.fillRect(x0 - u, bottom - u * 0.4, w + u * 2, u * 1.9);
    ctx.fillStyle = '#d8cdb0';
    ctx.fillRect(x0 - u * 2.2, bottom - u * 0.5, u * 1.5, u * 2.1);
    ctx.fillRect(x0 + w + u * 0.7, bottom - u * 0.5, u * 1.5, u * 2.1);
  }

  function paintWall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintPlaster(ctx, g, rand);
    paintScroll(ctx, g, rand);
    return c;
  }

  function paintWood(ctx, g, rand, x, y, w, h, light, dark) {
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = light;
    if (h > w) ctx.fillRect(x + w * 0.12, y, w * 0.38, h);
    else ctx.fillRect(x, y + h * 0.5, w, h * 0.3);
    ctx.fillStyle = '#2a1e15';
    ctx.globalAlpha = 0.5;
    const grain = Math.round(Math.max(w, h) / (g.U * 2));
    for (let i = 0; i < grain; i++) {
      if (h > w) ctx.fillRect(x + rand() * w, y + rand() * h, 1, g.U * (3 + rand() * 9));
      else ctx.fillRect(x + rand() * w, y + rand() * h, g.U * (3 + rand() * 9), 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintFrame(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const side = ctx.createLinearGradient(g.postR, 0, g.W, 0);
    side.addColorStop(0, '#8f8166');
    side.addColorStop(1, '#6e614c');
    ctx.fillStyle = side;
    ctx.fillRect(g.postR, 0, g.W - g.postR, g.H);
    ctx.fillStyle = '#e8dfc6';
    ctx.fillRect(0, 0, g.postL, g.H);
    ctx.fillStyle = '#463a2d';
    ctx.fillRect(0, 0, g.W, u * 1.5);
    paintWood(ctx, g, rand, g.postL - u * 0.5, u, u * 6.5, g.H, '#a98459', '#6f5338');
    paintWood(ctx, g, rand, g.postR - u * 1.5, u, u * 3.2, g.H, '#8d6d4a', '#5e4733');
    paintWood(ctx, g, rand, g.postL, u * 1.5, g.postR - g.postL, u * 4.5, '#957450', '#5f4933');
    return c;
  }

  function paintShojiGrid(g) {
    const c = layer(g.postL, g.fy);
    const ctx = c.getContext('2d');
    const bar = Math.max(1, g.U * 0.55);
    ctx.fillStyle = '#54432f';
    for (let i = 1; i <= 3; i++) ctx.fillRect((g.postL * i) / 4 - bar / 2, 0, bar, g.fy);
    for (let j = 1; j <= 6; j++) ctx.fillRect(0, (g.fy * j) / 7 - bar / 2, g.postL, bar);
    ctx.fillRect(0, g.fy - g.U * 3.4, g.postL, g.U * 3.4);
    return c;
  }

  function softened(src, factor) {
    const small = layer(src.width / factor, src.height / factor);
    const m = small.getContext('2d');
    m.imageSmoothingEnabled = true;
    m.drawImage(src, 0, 0, small.width, small.height);
    return small;
  }

  function spray(ctx, g, rand, x, y, drop, count) {
    const u = g.U;
    for (let i = 0; i < count; i++) {
      const a = drop + (i / (count - 1) - 0.5) * 1.9 + (rand() - 0.5) * 0.2;
      leaf(ctx, x, y, a, u * (6 + rand() * 5.5), u * (0.9 + rand() * 0.5), '#2c2416', '#2c2416');
    }
  }

  function paintBamboo(g, rand, w, h, places) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#2c2416';
    for (const [fx, fy, a] of places) {
      const x = fx * w;
      const y = fy * h;
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(a) * g.U * 13, y - Math.sin(a) * g.U * 13);
      ctx.stroke();
      spray(ctx, g, rand, x, y, a, 5 + Math.floor(rand() * 3));
    }
    return c;
  }

  function paintLightPatch(g) {
    const w = g.W * 0.46;
    const h = g.fy;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f3e4bd';
    ctx.beginPath();
    ctx.moveTo(w * 0.05, 0);
    ctx.lineTo(w * 0.62, 0);
    ctx.lineTo(w * 0.98, h);
    ctx.lineTo(w * 0.4, h);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    const bar = (x0, y0, x1, y1) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };
    for (let i = 1; i < 4; i++) bar(lerp(w * 0.05, w * 0.62, i / 4), 0, lerp(w * 0.4, w * 0.98, i / 4), h);
    for (let j = 1; j < 6; j++) bar(lerp(w * 0.05, w * 0.4, j / 6), (h * j) / 6, lerp(w * 0.62, w * 0.98, j / 6), (h * j) / 6);
    ctx.globalCompositeOperation = 'source-over';
    return softened(c, 2);
  }

  function drawFlowers(ctx) {
    ctx.drawImage(state.branch, 0, 0);
    ctx.drawImage(state.blades, 0, 0);
    ctx.drawImage(state.still, 0, 0);
  }

  function paintCast(g) {
    const c = layer(g.W / 3, g.H / 3);
    const ctx = c.getContext('2d');
    ctx.scale(c.width / g.W, c.height / g.H);
    drawFlowers(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#231a12';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function paintBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    ctx.fillStyle = '#17141c';
    ctx.beginPath();
    ctx.ellipse(g.vx, g.mouthY, u * 4.8, u * 1.5, 0, 0, 6.3);
    ctx.fill();
    const pts = [
      ...cubic([[0, 0], [-3, -13], [0, -25], [12, -32]], g.vx, g.mouthY, u, 18),
      ...cubic([[12, -32], [19, -36], [26, -38], [32, -37]], g.vx, g.mouthY, u, 12),
      ...cubic([[32, -37], [35, -36.5], [37.5, -34], [39, -30]], g.vx, g.mouthY, u, 8),
    ];
    paintTwigs(ctx, g, rand, pts);
    ctx.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const f = i / pts.length;
      const kink = Math.sin(i * 1.7) * u * 0.18;
      ctx.lineWidth = Math.max(1, u * lerp(2.2, 0.55, f));
      ctx.strokeStyle = '#3a2a1f';
      ctx.beginPath();
      ctx.moveTo(pts[i][0] + kink, pts[i][1]);
      ctx.lineTo(pts[i + 1][0] + kink, pts[i + 1][1]);
      ctx.stroke();
      if (f > 0.55) continue;
      ctx.lineWidth = Math.max(1, u * 0.4);
      ctx.strokeStyle = '#7d634c';
      ctx.beginPath();
      ctx.moveTo(pts[i][0] + kink - u * 0.5, pts[i][1] - u * 0.3);
      ctx.lineTo(pts[i + 1][0] + kink - u * 0.5, pts[i + 1][1] - u * 0.3);
      ctx.stroke();
    }
    return c;
  }

  // Short side shoots, each with a couple of small leaves or a closed bud.
  function paintTwigs(ctx, g, rand, pts) {
    const u = g.U;
    const shoots = [[0.22, -2.5, 7], [0.34, -0.2, 8], [0.47, -2.3, 7], [0.6, 0.5, 8], [0.74, -0.5, 5], [0.87, 1.3, 6], [0.99, 1.2, 2]];
    ctx.lineCap = 'round';
    shoots.forEach(([f, a, len], i) => {
      const p = pts[Math.floor(f * (pts.length - 1))];
      const x = p[0] + Math.cos(a) * len * u;
      const y = p[1] + Math.sin(a) * len * u;
      ctx.strokeStyle = '#33261c';
      ctx.lineWidth = Math.max(1, u * 0.45);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.quadraticCurveTo(p[0] + Math.cos(a - 0.4) * len * u * 0.6, p[1] + Math.sin(a - 0.4) * len * u * 0.6, x, y);
      ctx.stroke();
      const mid = [(p[0] + x) / 2, (p[1] + y) / 2];
      leaf(ctx, x, y, a + 0.25, u * (7.5 + rand() * 3), u * 2.4, '#8aa862', '#50703f');
      leaf(ctx, mid[0], mid[1], a - 1 + rand() * 0.4, u * (5.5 + rand() * 2.5), u * 2, '#7c9a56', '#476639');
      if (i % 3 === 1) paintBud(ctx, u, mid[0] + Math.cos(a + 1.3) * u * 2, mid[1] + Math.sin(a + 1.3) * u * 2);
    });
  }

  function paintBud(ctx, u, x, y) {
    ctx.fillStyle = '#3f5a36';
    ctx.beginPath();
    ctx.arc(x, y + u * 0.6, u * 1.7, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#c9452c';
    ctx.beginPath();
    ctx.ellipse(x, y - u * 0.5, u * 1.3, u * 1.7, 0, 0, 6.3);
    ctx.fill();
  }

  function paintBlades(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const at = (p) => cubic(p, g.vx, g.mouthY, u, 26);
    ribbon(ctx, at([[-1, 0], [-5, -13], [-8, -28], [-21, -35]]), u * 2.6, '#7f9c58', '#4b6a3c', '#b1c283');
    ribbon(ctx, at([[1, 0], [15, -4], [31, -5], [44, 7]]), u * 2.2, '#86a25e', '#50703f', '#b7c78a');
    ribbon(ctx, at([[0, 0], [8, -9], [18, -17], [31, -17]]), u * 1.8, '#6c8a4d', '#3f5c35', '#a2b67a');
    return c;
  }

  function vasePath(ctx, g) {
    const u = g.U;
    const x = g.vx;
    const y = g.mouthY;
    const b = g.baseY;
    ctx.beginPath();
    ctx.moveTo(x - u * 4.8, y);
    ctx.quadraticCurveTo(x - u * 3, y + u * 2, x - u * 3.4, y + u * 4);
    ctx.bezierCurveTo(x - u * 7, y + u * 6, x - u * 12, y + u * 8, x - u * 11.5, y + u * 13);
    ctx.bezierCurveTo(x - u * 11, b - u * 5, x - u * 7, b - u * 2, x - u * 6, b);
    ctx.quadraticCurveTo(x, b + u * 1.2, x + u * 6, b);
    ctx.bezierCurveTo(x + u * 7, b - u * 2, x + u * 11, b - u * 5, x + u * 11.5, y + u * 13);
    ctx.bezierCurveTo(x + u * 12, y + u * 8, x + u * 7, y + u * 6, x + u * 3.4, y + u * 4);
    ctx.quadraticCurveTo(x + u * 3, y + u * 2, x + u * 4.8, y);
    ctx.quadraticCurveTo(x, y + u * 1.5, x - u * 4.8, y);
    ctx.closePath();
  }

  function paintVase(ctx, g, rand) {
    const u = g.U;
    const body = ctx.createLinearGradient(g.vx - u * 12, 0, g.vx + u * 12, 0);
    body.addColorStop(0, '#4a3f3b');
    body.addColorStop(0.24, '#8a7d74');
    body.addColorStop(0.46, '#4c4240');
    body.addColorStop(1, '#2a2527');
    ctx.save();
    vasePath(ctx, g);
    ctx.clip();
    ctx.fillStyle = body;
    ctx.fillRect(g.vx - u * 13, g.mouthY - u, u * 26, g.baseY - g.mouthY + u * 3);
    ctx.fillStyle = '#6d7666';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(g.vx - u * 13, g.mouthY);
    for (let x = -13; x <= 13; x += 1) {
      const lick = 3 + 3.2 * Math.abs(Math.sin(x * 0.9 + 1)) + rand() * 1.2;
      ctx.lineTo(g.vx + x * u, g.mouthY + u * (5.5 + lick));
    }
    ctx.lineTo(g.vx + u * 13, g.mouthY);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#a6957a';
    ctx.fillRect(g.vx - u * 8, g.baseY - u * 1.1, u * 16, u * 2.4);
    ctx.restore();
    ctx.strokeStyle = '#9a8f84';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.ellipse(g.vx, g.mouthY, u * 4.8, u * 1.5, 0, 0, Math.PI);
    ctx.stroke();
  }

  function paintCamellia(ctx, g, rand, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.scale(1, 0.92);
    const rings = [[8, 0.6, 0.47, 0.38, 0], [6, 0.38, 0.38, 0.3, 0.55], [5, 0.2, 0.26, 0.2, 0.2]];
    rings.forEach(([n, dist, rx, ry, turn], ring) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + turn + (rand() - 0.5) * 0.2;
        const size = 0.9 + rand() * 0.24;
        const cx = Math.cos(a) * dist * r * (0.94 + rand() * 0.12);
        const cy = Math.sin(a) * dist * r * (0.94 + rand() * 0.12);
        ctx.fillStyle = '#8c2a1c';
        ctx.beginPath();
        ctx.ellipse(cx * 1.06, cy * 1.06, rx * r * 1.05 * size, ry * r * 1.05 * size, a, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = PETAL_RED[(i + ring) % PETAL_RED.length];
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * r * size, ry * r * size, a, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = '#e27a5b';
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * rx * r * 0.42, cy + Math.sin(a) * rx * r * 0.42, rx * r * 0.42 * size, ry * r * 0.5 * size, a, 0, 6.3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
    paintStamens(ctx, rand, r);
    ctx.restore();
  }

  function paintStamens(ctx, rand, r) {
    ctx.fillStyle = '#c28f33';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, 6.3);
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand()) * r * 0.22;
      ctx.fillStyle = rand() < 0.5 ? '#f0d98e' : '#e4b94f';
      ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, Math.max(1, r * 0.06), Math.max(1, r * 0.06));
    }
  }

  function paintStill(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintVase(ctx, g, rand);
    const fx = g.vx - u * 12;
    const fy = g.mouthY - u * 5;
    leaf(ctx, fx - u * 2, fy + u * 3, 2.7, u * 21, u * 6.5, '#7a9a58', '#476a3c');
    leaf(ctx, fx - u * 1, fy - u * 2, -2.6, u * 20, u * 6, '#88a662', '#4f7040');
    leaf(ctx, fx + u * 1, fy - u * 3, -1.75, u * 19, u * 5.6, '#70904f', '#3f5f36');
    leaf(ctx, fx + u * 2, fy + u * 5, 1.25, u * 18, u * 5.2, '#7a9a58', '#456638');
    paintCamellia(ctx, g, rand, fx, fy, u * 11);
    return c;
  }

  function paintReflection(g) {
    const h = g.H - g.fy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(0, g.baseY - g.fy + g.baseY * SQUASH);
    ctx.scale(1, -SQUASH);
    drawFlowers(ctx);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-out';
    const fade = ctx.createLinearGradient(0, g.baseY - g.fy, 0, h);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, g.W, Math.max(0, g.baseY - g.fy - g.U * 0.5));
    return c;
  }

  function paintFloorBase(g) {
    const h = g.H - g.fy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const lacquer = ctx.createLinearGradient(0, 0, 0, h);
    [[0, '#6e3b2e'], [1, '#46262a']].forEach(([at, colour]) => lacquer.addColorStop(at, colour));
    ctx.fillStyle = lacquer;
    ctx.fillRect(0, 0, g.W, h);
    return c;
  }

  function paintFloorTone(g, rand) {
    const h = g.H - g.fy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(96,30,22,0.3)';
    ctx.fillRect(0, 0, g.W, h);
    ctx.fillStyle = '#a45a42';
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.globalAlpha = 0.06 + rand() * 0.08;
      ctx.fillRect(rand() * g.W, rand() * h, g.U * (2 + rand() * 12), 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a1a16';
    ctx.fillRect(0, 0, g.W, Math.max(1, g.U * 0.7));
    ctx.fillStyle = 'rgba(16,10,12,0.6)';
    ctx.beginPath();
    ctx.ellipse(g.vx + g.U * 3, g.baseY - g.fy + g.U * 0.3, g.U * 11, g.U * 1.8, 0, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintSheen(g) {
    const w = g.W * 0.4;
    const h = g.H - g.fy;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const band = ctx.createLinearGradient(0, 0, w, 0);
    [0, 1, 0].forEach((a, i) => band.addColorStop(i / 2, `rgba(240,214,170,${a})`));
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, w, h);
    return c;
  }

  function paintPetal(g) {
    const s = Math.max(5, g.U * 8);
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    const m = s / 2;
    const petal = (scale, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(m, m + m * 0.86 * scale);
      ctx.bezierCurveTo(m - m * 1.1 * scale, m + m * 0.3 * scale, m - m * 0.9 * scale, m - m * 0.9 * scale, m, m - m * 0.74 * scale);
      ctx.bezierCurveTo(m + m * 0.9 * scale, m - m * 0.9 * scale, m + m * 1.1 * scale, m + m * 0.3 * scale, m, m + m * 0.86 * scale);
      ctx.fill();
    };
    petal(1, '#a8321f');
    petal(0.76, '#d0503a');
    return c;
  }

  function startFall(g, t, rand) {
    const p = state.petal;
    const spot = state.spots[state.next];
    state.next = (state.next + 1) % state.spots.length;
    Object.assign(p, {
      on: true,
      start: t,
      dur: 8 + rand() * 3,
      x0: g.vx - g.U * (12 + rand() * 7),
      y0: g.mouthY + g.U * rand() * 3,
      spot,
      spin: 1.1 + rand() * 0.8,
      phase: rand() * 6.28,
    });
  }

  function stepPetal(g, t, rate, dt) {
    const p = state.petal;
    if (!p.on && rate > 0 && t >= state.due) startFall(g, t, state.rand);
    for (const s of state.spots) {
      const goal = p.on && p.spot === s ? 0 : s.rest;
      s.alpha += Math.sign(goal - s.alpha) * Math.min(Math.abs(goal - s.alpha), dt * 0.4);
    }
    if (!p.on) return;
    if (t - p.start >= p.dur) {
      p.on = false;
      p.spot.rest = 1;
      p.spot.alpha = 1;
      state.due = t + 13 / Math.max(rate, 0.1);
    }
  }

  function placePetal(ctx, sprite, x, y, angle, sy, alpha) {
    const s = sprite.width / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1, sy);
    ctx.drawImage(sprite, -s, -s);
    ctx.restore();
  }

  function drawFalling(ctx, g, t) {
    const p = state.petal;
    if (!p.on) return;
    const f = (t - p.start) / p.dur;
    const e = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
    const x = lerp(p.x0, p.spot.x, e) + Math.sin(f * 7 + p.phase) * g.U * 3.4 * (1 - f * f);
    const y = lerp(p.y0, p.spot.y, e);
    const a = Math.sin(t * p.spin * 0.8 + p.phase) * 1.1;
    const sy = lerp(0.45 + 0.5 * Math.abs(Math.cos(t * p.spin + p.phase)), 0.5, f * f * f);
    const mirror = p.spot.y + (p.spot.y - y) * SQUASH;
    if (mirror < g.H + g.U * 3) placePetal(ctx, state.petalSprite, x, mirror, -a, sy, 0.42);
    placePetal(ctx, state.petalSprite, x, y, a, sy, 1);
  }

  function drawShadows(ctx, g, t, amount) {
    const u = g.U;
    ctx.globalAlpha = Math.min(1, 0.22 * Math.max(amount, 0.2));
    ctx.drawImage(state.light, g.W * 0.16 + Math.sin(t * 0.045) * u * 10, 0);
    ctx.globalAlpha = Math.min(1, 0.22 * amount);
    const k = 1.05;
    const drift = u * (15 + Math.sin(t * 0.06) * 5);
    ctx.drawImage(state.cast, g.vx * (1 - k) + drift, g.baseY * (1 - k) - u, g.W * k, g.H * k);
    ctx.globalAlpha = Math.min(1, 0.3 * amount);
    const ax = Math.sin(t * 0.21) * u * 2.2 + Math.sin(t * 0.53) * u * 0.8;
    const ay = Math.sin(t * 0.17 + 1) * u * 0.9;
    ctx.drawImage(state.bambooA, ax, ay);
    const bx = Math.sin(t * 0.29 + 2) * u * 3 + Math.sin(t * 0.61) * u * 0.7;
    ctx.drawImage(state.bambooB, bx, Math.sin(t * 0.23) * u);
    ctx.globalAlpha = 1;
  }

  function drawShoji(ctx, g, t, amount) {
    const m = state.shojiMargin;
    const sway = Math.sin(t * 0.25) * m * 0.6 + Math.sin(t * 0.57) * m * 0.25;
    ctx.globalAlpha = Math.min(1, 0.55 * amount);
    ctx.drawImage(state.bambooShoji, m + sway, 0, g.postL - g.U * 0.5, g.fy, 0, 0, g.postL - g.U * 0.5, g.fy);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.shojiGrid, 0, 0);
  }

  function drawFloor(ctx, g, t) {
    ctx.drawImage(state.floorBase, 0, g.fy);
    ctx.save();
    ctx.globalAlpha = MIRROR;
    ctx.translate(0, g.fy);
    ctx.scale(1, -SQUASH);
    ctx.drawImage(ctx.canvas, 0, 0, g.W, g.fy, 0, -g.fy, g.W, g.fy);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.drawImage(state.floorTone, 0, g.fy);
    ctx.globalAlpha = 0.86;
    ctx.drawImage(state.reflection, 0, g.fy);
    ctx.globalAlpha = 0.09 + 0.03 * Math.sin(t * 0.13);
    ctx.drawImage(state.sheen, g.W * 0.3 + Math.sin(t * 0.07) * g.W * 0.26, g.fy);
    ctx.globalAlpha = 1;
  }

  function swayed(ctx, g, sprite, angle) {
    ctx.save();
    ctx.translate(g.vx, g.mouthY);
    ctx.rotate(angle);
    ctx.translate(-g.vx, -g.mouthY);
    ctx.drawImage(sprite, 0, 0);
    ctx.restore();
  }

  function drawArrangement(ctx, g, t) {
    swayed(ctx, g, state.branch, Math.sin(t * 0.31) * 0.007 + Math.sin(t * 0.73) * 0.0035);
    swayed(ctx, g, state.blades, Math.sin(t * 0.43 + 1) * 0.009);
    ctx.drawImage(state.still, 0, 0);
  }

  function drawMotes(ctx, g, t) {
    const m = state.motes;
    ctx.fillStyle = '#f7ecca';
    for (let i = 0; i < MOTES; i++) {
      const life = (t * m.rate[i] + m.seed[i]) % 1;
      const x = g.postL + m.x[i] * (g.vx - g.postL) * 1.1 + Math.sin(t * 0.3 + m.seed[i] * 40) * g.U * 2;
      const y = g.fy * (0.95 - life * 0.85);
      ctx.globalAlpha = 0.5 * Math.sin(life * Math.PI);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function makeMotes(rand) {
    const m = { x: new Float32Array(MOTES), rate: new Float32Array(MOTES), seed: new Float32Array(MOTES) };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = rand();
      m.rate[i] = 0.012 + rand() * 0.02;
      m.seed[i] = rand();
    }
    return m;
  }

  function bakeShadows(g, rand) {
    const w = g.W;
    const h = g.fy;
    state.bambooA = paintBamboo(g, rand, w, h, [[0.875, 0.2, 2.1], [0.865, 0.56, 2.4]]);
    state.bambooB = paintBamboo(g, rand, w, h, [[0.17, 0.3, 0.9], [0.2, 0.12, 1.3], [0.52, 0.16, 1.5]]);
    state.shojiMargin = g.U * 6;
    const sw = g.postL + state.shojiMargin * 2;
    state.bambooShoji = paintBamboo(g, rand, sw, h, [[0.55, 0.15, 1.2], [0.3, 0.32, 1.8], [0.68, 0.46, 1.5], [0.4, 0.66, 1.3]]);
    state.light = paintLightPatch(g);
    state.cast = paintCast(g);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.fy = g.H * 0.67;
    g.baseY = g.H * 0.775;
    g.mouthY = g.baseY - g.U * 25;
    g.vx = g.W * 0.62;
    g.scrollX = g.W * 0.37;
    g.postL = g.W * 0.115;
    g.postR = g.W * 0.905;
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.wall = paintWall(g, rand);
    state.frame = paintFrame(g, rand);
    state.shojiGrid = paintShojiGrid(g);
    state.branch = paintBranch(g, rand);
    state.blades = paintBlades(g);
    state.still = paintStill(g, rand);
    bakeShadows(g, rand);
    state.reflection = paintReflection(g);
    state.floorBase = paintFloorBase(g);
    state.floorTone = paintFloorTone(g, rand);
    state.sheen = paintSheen(g);
    state.petalSprite = paintPetal(g);
    const spot = ([dx, dy], i) => ({ x: g.vx + dx * g.U, y: g.baseY + dy * g.U, angle: i * 1.3, rest: +(i < 3), alpha: +(i < 3) });
    state.spots = SPOTS.map(spot);
    state.next = 3;
    state.petal = { on: false, start: 0, dur: 9, x0: 0, y0: 0, spot: state.spots[0], spin: 1, phase: 0 };
    state.due = 2;
    state.motes = makeMotes(rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.wall, 0, 0);
    drawShadows(ctx, g, t, props.shadows);
    ctx.drawImage(state.frame, 0, 0);
    drawShoji(ctx, g, t, props.shadows);
    drawFloor(ctx, g, t);
    for (const s of state.spots) {
      if (s.alpha > 0.01) placePetal(ctx, state.petalSprite, s.x, s.y, s.angle, 0.62, s.alpha);
    }
    drawArrangement(ctx, g, t);
    stepPetal(g, t, props.petals, dt);
    drawFalling(ctx, g, t);
    drawMotes(ctx, g, t);
  }

  Kasuri.run({
    defaults: { shadows: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
