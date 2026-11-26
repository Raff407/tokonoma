/*
 * 黒穴 Kuroana — a black hole and its disk, ray-traced through curved space.
 *
 * Light near a Schwarzschild hole bends by u'' = 1.5·rs·u² − u (rs = 2, u = 1/r).
 * A ray's path depends only on its impact parameter b, so one table of paths,
 * one per b, serves every cell: a cell's ray lies in the plane through the
 * camera and its screen offset, and it meets the disk where that plane cuts
 * the equator, every half turn. The first crossing inside the disk is what
 * the cell sees; a ray that falls in is the shadow; one that escapes sees the
 * lensed sky. The disk is approaching on the left (brighter, bluer) and
 * receding on the right, and its far side is lifted over the top and folded
 * under the bottom.
 *
 * All of that is worked out once per grid. The turning disk is baked into a
 * ring of stills and drawn by cross-fading two of them, so a frame costs two
 * drawImage calls.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, hash2, smoothstep, clamp, lerp } = K;

  const CAMERA = 50; // camera distance, in units of M
  const DISK_IN = 6; // innermost stable orbit
  const DISK_OUT = 16;
  const STEP = 0.006; // radians of orbit per integration step
  const MAX_TURN = Math.PI * 5;
  const PATHS = 2400; // impact parameters in the table
  const STILLS = 64; // baked disk stills per turn
  const PERIOD = 72; // seconds per turn of the outer disk at speed 1
  const ROLL = -0.07; // the disk sits a little off level
  const TEX_R = 160;
  const TEX_A = 720;

  // Ember to washi, through shu and gold.
  const DISK_STOPS = [
    [0, [28, 9, 5]],
    [0.22, [104, 30, 14]],
    [0.45, [198, 70, 34]],
    [0.65, [228, 134, 54]],
    [0.82, [232, 188, 118]],
    [1, [246, 236, 214]],
  ];
  const STAR_COLOURS = [[232, 228, 214], [178, 186, 210], [226, 196, 150], [200, 206, 226]];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function diskColour(key, out) {
    for (let i = 1; i < DISK_STOPS.length; i++) {
      const [k1, c1] = DISK_STOPS[i];
      if (key <= k1 || i === DISK_STOPS.length - 1) {
        const [k0, c0] = DISK_STOPS[i - 1];
        const t = clamp((key - k0) / (k1 - k0), 0, 1);
        out[0] = lerp(c0[0], c1[0], t);
        out[1] = lerp(c0[1], c1[1], t);
        out[2] = lerp(c0[2], c1[2], t);
        return out;
      }
    }
    return out;
  }

  /* ---- light paths ------------------------------------------------------ */

  // u(φ) for each impact parameter, from the camera inward until the ray
  // escapes (u ≤ 0) or falls through the horizon (u ≥ 0.5).
  function tracePaths(bMax) {
    const u0 = 1 / CAMERA;
    const offsets = new Int32Array(PATHS);
    const lengths = new Int32Array(PATHS);
    const ends = new Float32Array(PATHS);
    const caught = new Uint8Array(PATHS);
    const chunks = [];
    let total = 0;
    const accel = (u) => 3 * u * u - u;

    for (let i = 0; i < PATHS; i++) {
      const b = (bMax * (i + 0.5)) / PATHS;
      let u = u0;
      let v = Math.sqrt(Math.max(0, 1 / (b * b) - u0 * u0 * (1 - 2 * u0)));
      const path = [u];
      let phi = 0;
      let end = MAX_TURN;
      let fell = 0;
      while (phi < MAX_TURN) {
        const h = STEP;
        const k1u = v;
        const k1v = accel(u);
        const k2u = v + 0.5 * h * k1v;
        const k2v = accel(u + 0.5 * h * k1u);
        const k3u = v + 0.5 * h * k2v;
        const k3v = accel(u + 0.5 * h * k2u);
        const k4u = v + h * k3v;
        const k4v = accel(u + h * k3u);
        const nu = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
        v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
        phi += h;
        if (nu <= 0) {
          end = phi - h + (h * u) / (u - nu);
          break;
        }
        if (nu >= 0.5) {
          end = phi;
          fell = 1;
          break;
        }
        u = nu;
        path.push(u);
      }
      offsets[i] = total;
      lengths[i] = path.length;
      ends[i] = end;
      caught[i] = fell;
      total += path.length;
      chunks.push(path);
    }

    const us = new Float32Array(total);
    chunks.forEach((path, i) => us.set(path, offsets[i]));
    return { us, offsets, lengths, ends, caught, bMax };
  }

  // u at angle φ along path i, or -1 past its end.
  function uAt(paths, i, phi) {
    const f = phi / STEP;
    const j = Math.floor(f);
    if (j + 1 >= paths.lengths[i]) return -1;
    const o = paths.offsets[i] + j;
    return lerp(paths.us[o], paths.us[o + 1], f - j);
  }

  /* ---- the sky ---------------------------------------------------------- */

  function skyCell(q, sky, out) {
    // Milky band on a tilted great circle.
    const lat = q[0] * sky.n[0] + q[1] * sky.n[1] + q[2] * sky.n[2];
    const along = Math.atan2(
      q[0] * sky.b2[0] + q[1] * sky.b2[1] + q[2] * sky.b2[2],
      q[0] * sky.b1[0] + q[1] * sky.b1[1] + q[2] * sky.b1[2],
    );
    const band = Math.exp(-lat * lat * 10);
    const cloud = smoothstep(0.3, 0.72, fbm(along * 3 + 9, lat * 9 + 4, 5, 31));
    const dust = smoothstep(0.5, 0.68, fbm(along * 7, lat * 22, 3, 47));
    const river = band * cloud * (1 - dust * 0.7) * 0.2;
    const haze = smoothstep(0.35, 0.8, fbm(along * 2 + 1, lat * 5 - 3, 4, 53)) * 0.05;
    let r = river * 150 + haze * 120;
    let g = river * 156 + haze * 118;
    let b = river * 190 + haze * 150;

    // Stars, hashed on a lon/lat grid about as fine as a cell.
    const lon = Math.atan2(q[1], q[0]);
    const la = Math.asin(clamp(q[2], -1, 1));
    const ix = Math.floor((lon + Math.PI) * sky.perRad);
    const iy = Math.floor((la + Math.PI / 2) * sky.perRad);
    const pick = hash2(ix, iy, sky.seed);
    let star = 0;
    if (pick < sky.density * (0.6 + band * 1.6)) {
      const h = hash2(iy, ix, sky.seed + 7);
      star = 0.28 + 0.72 * h * h * h;
      const c = STAR_COLOURS[Math.floor(hash2(ix, iy, sky.seed + 13) * STAR_COLOURS.length)];
      r = Math.max(r, c[0] * star);
      g = Math.max(g, c[1] * star);
      b = Math.max(b, c[2] * star);
    }
    out[0] = r;
    out[1] = g;
    out[2] = b;
    return star;
  }

  /* ---- per-cell trace ---------------------------------------------------- */

  function view(g, tilt) {
    const eps = (tilt * Math.PI) / 180;
    const aspect = Math.min(g.W / g.H, 1.8);
    return {
      eps,
      cx: g.W * 0.5,
      cy: g.H * 0.5,
      half: g.H * 0.5,
      // Outer disk edge at about 0.74 of the half-width.
      tanScale: DISK_OUT / CAMERA / (0.74 * aspect),
      cosR: Math.cos(ROLL),
      sinR: Math.sin(ROLL),
    };
  }

  // Fills the static sky layer and the disk records for the frame bake.
  function traceGrid(g, props, seed) {
    const cam = view(g, props.tilt);
    const ce = Math.cos(cam.eps);
    const se = Math.sin(cam.eps);
    const c = [0, -ce, se]; // toward the camera
    const corner = Math.hypot(g.W / 2, g.H / 2) / cam.half;
    const alphaMax = Math.atan(corner * cam.tanScale);
    const bMax = (CAMERA * Math.sin(alphaMax)) / Math.sqrt(1 - 2 / CAMERA) * 1.02;
    const paths = tracePaths(bMax);

    const tilted = [0.42, -0.35, 0.84];
    const nl = Math.hypot(...tilted);
    const n = tilted.map((v) => v / nl);
    const b1 = [n[1], -n[0], 0].map((v) => v / Math.hypot(n[0], n[1]));
    const b2 = [n[1] * b1[2] - n[2] * b1[1], n[2] * b1[0] - n[0] * b1[2], n[0] * b1[1] - n[1] * b1[0]];
    const cellAngle = (2 * cam.tanScale) / g.H;
    const sky = { n, b1, b2, seed, perRad: 1 / (cellAngle * 1.15), density: 0.03 * props.stars };

    const skyImg = new ImageData(g.W, g.H);
    const cells = [];
    const rgb = [0, 0, 0];
    const glints = [];
    const e2 = [0, 0, 0];
    const q = [0, 0, 0];

    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const px = (x + 0.5 - cam.cx) / cam.half;
        const py = -(y + 0.5 - cam.cy) / cam.half;
        const sx = px * cam.cosR - py * cam.sinR;
        const sy = px * cam.sinR + py * cam.cosR;
        const m = Math.hypot(sx, sy) || 1e-6;
        const alpha = Math.atan(m * cam.tanScale);
        const b = (CAMERA * Math.sin(alpha)) / Math.sqrt(1 - 2 / CAMERA);
        // Screen right is (1,0,0), screen up is (0, sinε, cosε).
        e2[0] = sx / m;
        e2[1] = (sy / m) * se;
        e2[2] = (sy / m) * ce;

        const fi = clamp((b / paths.bMax) * PATHS - 0.5, 0, PATHS - 1);
        const i0 = Math.floor(fi);
        const i1 = Math.min(i0 + 1, PATHS - 1);
        const wb = fi - i0;
        const near = wb < 0.5 ? i0 : i1;
        const end = paths.ends[near];

        // Crossings of the disk plane, every half turn.
        let phi = Math.atan2(-c[2], e2[2]);
        phi = ((phi % Math.PI) + Math.PI) % Math.PI;
        if (phi < 1e-5) phi += Math.PI;
        let hitR = 0;
        let hitPhi = 0;
        for (; phi < end; phi += Math.PI) {
          const ua = uAt(paths, i0, phi);
          const ub = uAt(paths, i1, phi);
          const u = ua > 0 && ub > 0 ? lerp(ua, ub, wb) : Math.max(ua, ub);
          if (u <= 0) break;
          const r = 1 / u;
          if (r >= DISK_IN && r <= DISK_OUT) {
            hitR = r;
            hitPhi = phi;
            break;
          }
        }

        const o = (y * g.W + x) * 4;
        if (hitR) {
          const cp = Math.cos(hitPhi);
          const sp = Math.sin(hitPhi);
          const az = Math.atan2(cp * c[1] + sp * e2[1], cp * c[0] + sp * e2[0]);
          cells.push(x, y, hitR, az, -b * ce * e2[0]);
          skyImg.data[o + 3] = 255;
          continue;
        }
        skyImg.data[o + 3] = 255;
        if (paths.caught[near]) continue; // the shadow stays black

        const cf = Math.cos(end);
        const sf = Math.sin(end);
        for (let k = 0; k < 3; k++) q[k] = cf * c[k] + sf * e2[k];
        const star = skyCell(q, sky, rgb);
        skyImg.data[o] = rgb[0];
        skyImg.data[o + 1] = rgb[1];
        skyImg.data[o + 2] = rgb[2];
        if (star > 0.85) glints.push(x, y, star);
      }
    }
    addGlints(skyImg, g, glints);
    return { skyImg, cells };
  }

  // The brightest stars get a small cross, as the eye sees them.
  function addGlints(img, g, glints) {
    const arms = [[1, 0, 0.55], [-1, 0, 0.55], [0, 1, 0.55], [0, -1, 0.55], [2, 0, 0.25], [-2, 0, 0.25], [0, 2, 0.25], [0, -2, 0.25]];
    for (let i = 0; i < glints.length; i += 3) {
      const x0 = glints[i];
      const y0 = glints[i + 1];
      const src = (y0 * g.W + x0) * 4;
      for (const [dx, dy, f] of arms) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
        const o = (y * g.W + x) * 4;
        for (let k = 0; k < 3; k++) img.data[o + k] = Math.max(img.data[o + k], img.data[src + k] * f);
      }
    }
  }

  /* ---- the disk ---------------------------------------------------------- */

  // Streaks and rings in (radius, angle), periodic in angle.
  function paintTexture(seed) {
    const tex = new Float32Array(TEX_R * TEX_A);
    const turnNoise = (t, a) => fbm(t * 34, a * 6, 4, seed) * 0.65 + fbm(t * 90, a * 14, 3, seed + 5) * 0.35;
    for (let ri = 0; ri < TEX_R; ri++) {
      const t = ri / (TEX_R - 1);
      const ring = 0.6 + 0.4 * fbm(t * 60, 0.5, 3, seed + 9);
      for (let ai = 0; ai < TEX_A; ai++) {
        const a = ai / TEX_A;
        const v = lerp(turnNoise(t, a), turnNoise(t, a - 1), a);
        tex[ri * TEX_A + ai] = (0.3 + 0.7 * smoothstep(0.28, 0.78, v)) * ring;
      }
    }
    return tex;
  }

  // Per disk cell: where it is, its colour and its brightness before texture.
  function shadeDisk(cells) {
    const count = cells.length / 5;
    const out = {
      count,
      x: new Int16Array(count),
      y: new Int16Array(count),
      tr: new Float32Array(count),
      az: new Float32Array(count),
      fast: new Float32Array(count),
      rgb: new Float32Array(count * 3),
      power: new Float32Array(count),
    };
    const col = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const x = cells[i * 5];
      const y = cells[i * 5 + 1];
      const r = cells[i * 5 + 2];
      const az = cells[i * 5 + 3];
      const lz = cells[i * 5 + 4];
      const omega = Math.pow(r, -1.5);
      const shift = Math.sqrt(1 - 3 / r) / (1 - omega * lz);
      const edge = smoothstep(DISK_IN, DISK_IN + 0.8, r) * (1 - smoothstep(DISK_OUT - 5, DISK_OUT, r));
      const emit = Math.pow(DISK_IN / r, 1.7) * edge;
      const key = clamp(Math.pow(shift, 1.5) * Math.pow(DISK_IN / r, 0.38) * 0.8, 0, 1);
      diskColour(key, col);
      out.x[i] = x;
      out.y[i] = y;
      out.tr[i] = ((r - DISK_IN) / (DISK_OUT - DISK_IN)) * (TEX_R - 1);
      out.az[i] = az / (2 * Math.PI);
      out.fast[i] = 1 - smoothstep(DISK_IN + 2, DISK_IN + 9, r);
      out.rgb.set(col, i * 3);
      out.power[i] = emit * Math.pow(shift, 2.6) * 9;
    }
    return out;
  }

  function texAt(tex, tr, a) {
    const ai = ((Math.floor(a * TEX_A) % TEX_A) + TEX_A) % TEX_A;
    const r0 = Math.floor(tr);
    const r1 = Math.min(r0 + 1, TEX_R - 1);
    return lerp(tex[r0 * TEX_A + ai], tex[r1 * TEX_A + ai], tr - r0);
  }

  // One still per 1/STILLS of a turn. The outer disk turns once per period,
  // the inner edge twice, so every frame loops.
  function bakeFrames(disk, tex) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < disk.count; i++) {
      x0 = Math.min(x0, disk.x[i]);
      y0 = Math.min(y0, disk.y[i]);
      x1 = Math.max(x1, disk.x[i]);
      y1 = Math.max(y1, disk.y[i]);
    }
    if (x1 < 0) return { stills: [], x: 0, y: 0 };
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const stills = [];
    for (let f = 0; f < STILLS; f++) {
      const phase = f / STILLS;
      const c = layer(w, h);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < disk.count; i++) {
        const slow = texAt(tex, disk.tr[i], disk.az[i] - phase);
        const quick = texAt(tex, disk.tr[i], disk.az[i] - phase * 2 + 0.37);
        const t = lerp(slow, quick, disk.fast[i]);
        const lit = 1 - Math.exp(-disk.power[i] * t);
        const o = ((disk.y[i] - y0) * w + (disk.x[i] - x0)) * 4;
        img.data[o] = disk.rgb[i * 3] * lit;
        img.data[o + 1] = disk.rgb[i * 3 + 1] * lit;
        img.data[o + 2] = disk.rgb[i * 3 + 2] * lit;
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      stills.push(c);
    }
    return { stills, x: x0, y: y0 };
  }

  /* ---- kasuri ------------------------------------------------------------ */

  function build(api) {
    const g = { W: api.cols, H: api.rows };
    const { skyImg, cells } = traceGrid(g, api.props, api.seed);
    const sky = layer(g.W, g.H);
    sky.getContext('2d').putImageData(skyImg, 0, 0);
    state.sky = sky;
    state.tilt = api.props.tilt;
    state.stars = api.props.stars;
    state.disk = bakeFrames(shadeDisk(cells), state.tex);
  }

  function setup(ctx, api) {
    if (!state.tex) state.tex = paintTexture(api.seed % 997);
    build(api);
  }

  function onProps(props, api) {
    if (props.tilt !== state.tilt || props.stars !== state.stars) build(api);
  }

  function draw(ctx, t) {
    ctx.drawImage(state.sky, 0, 0);
    const { stills, x, y } = state.disk;
    if (!stills.length) return;
    const f = (((t / PERIOD) % 1) + 1) % 1 * STILLS;
    const a = Math.floor(f) % STILLS;
    const b = (a + 1) % STILLS;
    ctx.drawImage(stills[a], x, y);
    ctx.globalAlpha = f - Math.floor(f);
    ctx.drawImage(stills[b], x, y);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { tilt: 7, stars: 1, ramp: 'dense', cell: 6, gain: 1.2, boost: 0.45, tint: 0.3, dither: 0.5 },
    maxFps: 20,
    setup,
    onProps,
    draw,
  });
})();
