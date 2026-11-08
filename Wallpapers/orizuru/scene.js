/*
 * 折鶴 Orizuru — strings of folded paper cranes along a sunlit temple corridor.
 *
 * The corridor and its light are baked. The nearest cranes are a small 3D fold
 * model, about a dozen flat facets each, so they turn on the thread and catch
 * the sun. Everything further off is a sprite from one atlas, or one whole
 * string sprite once it is only specks. A breeze runs along the row as a phase.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const PAPER = '#efe7d4';
  const COLOURS = ['#2f4a72', '#ab4228', '#4c6034', '#9c6e1a', '#6e3d58', '#35666a', '#864e28', '#a85a58', '#48566c', '#6a5a36'];
  const HERO_ORDER = [5, 3, 0, 1, 2, 4, 3];
  const SHADE_DARK = [52, 44, 54];

  // Where things sit: side is a fraction of the width from the vanishing point,
  // height a fraction of the height above it, and s = 1 / depth is the scale.
  const VX = 0.6;
  const VY = 0.4;
  const EAVE = -0.7;
  const WALL = 0.5;
  const CEIL = 0.62;
  const FLOOR = -0.72;
  const FOOT = -0.56;
  const END_Z = 14;
  const ROWS = [
    { side: -0.44, z0: 1, flip: 1 },
    { side: 0.31, z0: 1.6, flip: -1 },
    { side: -0.57, z0: 2.25, flip: 1 },
    { side: 0.41, z0: 2.85, flip: -1 },
  ];
  const ROW_STEP = 0.5;
  const NEAR_Z = 1.65;
  const FAR_Z = 5.6;
  const CRANES = 7;
  const UNIT = 15;
  const TILT_BIAS = 0.34;
  const POST_FIRST = 1.2;
  const POST_STEP = 2;
  const SLANT = 1.3;
  const FLOOR_SHADOW_Z = 2.7;

  const TIERS = [
    { s: 0.55, haze: 0.05, upTo: 2.9 },
    { s: 0.32, haze: 0.18, upTo: 4.2 },
    { s: 0.22, haze: 0.32, upTo: FAR_Z },
  ];
  const SPRITE_YAWS = [0.5, -0.55, 0.78];
  const SPRITE_TILTS = [-0.05, 0.62];
  const NEAR_YAWS = [0.3, 0.42, 0.55];
  const FAR_VARIANTS = 8;

  const state = {};

  // One crane, facing +x with y up: wings along z, neck and tail rising in a V.
  const VERTS = new Float32Array([
    0, -0.42, 0, 0.36, -0.02, 0, -0.36, -0.02, 0,
    0.34, 0.16, 0.12, -0.34, 0.16, 0.12, 0.34, 0.16, -0.12, -0.34, 0.16, -0.12,
    0, 0.2, 0.12, 0, 0.2, -0.12,
    -0.1, 0.54, 1, -0.1, 0.54, -1,
    0.1, -0.22, 0.07, 0.1, -0.22, -0.07, 0.34, 0.16, 0,
    0.86, 0.72, 0, 1.13, 0.45, 0, 0.71, 0.55, 0,
    -0.1, -0.22, 0.07, -0.1, -0.22, -0.07, -0.34, 0.16, 0,
    -0.96, 0.84, 0,
  ]);
  const VERT_COUNT = VERTS.length / 3;
  const WING_POS = [[3, 7, 9, 0], [7, 4, 9, 0]];
  const WING_NEG = [[5, 8, 10, 0], [8, 6, 10, 0]];
  const MIDDLE = [
    [17, 20, 19, 1], [18, 19, 20, -1],
    [11, 13, 14, 1], [12, 14, 13, -1], [14, 15, 16, 0],
    [3, 4, 6, 0], [3, 6, 5, 0],
    [0, 1, 3, 1], [0, 3, 4, 1], [0, 4, 2, 1],
    [0, 1, 5, -1], [0, 5, 6, -1], [0, 6, 2, -1],
  ];
  const LIGHT = [-0.5, 0.63, 0.59];
  const TONES = 5;
  const rx = new Float32Array(VERT_COUNT);
  const ry = new Float32Array(VERT_COUNT);

  function buildFaces(list) {
    const out = new Float32Array(list.length * 7);
    list.forEach((f, i) => {
      const [a, b, c, side] = f;
      const p = (v, k) => VERTS[v * 3 + k];
      const ux = p(b, 0) - p(a, 0), uy = p(b, 1) - p(a, 1), uz = p(b, 2) - p(a, 2);
      const vx = p(c, 0) - p(a, 0), vy = p(c, 1) - p(a, 1), vz = p(c, 2) - p(a, 2);
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      const flip = side !== 0 && nz * side < 0 ? -1 : 1;
      nx = (nx / len) * flip; ny = (ny / len) * flip; nz = (nz / len) * flip;
      out.set([a, b, c, side, nx, ny, nz], i * 7);
    });
    return out;
  }
  const FACES_POS = buildFaces(WING_POS);
  const FACES_NEG = buildFaces(WING_NEG);
  const FACES_MID = buildFaces(MIDDLE);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function px(g, side, s) { return g.vx + side * s * g.W; }
  function py(g, height, s) { return g.vy - height * s * g.H; }

  // A quad on a plane running to the vanishing point, between two depths.
  function depthQuad(ctx, g, a0, h0, a1, h1, s0, s1) {
    ctx.beginPath();
    ctx.moveTo(px(g, a0, s0), py(g, h0, s0));
    ctx.lineTo(px(g, a1, s0), py(g, h1, s0));
    ctx.lineTo(px(g, a1, s1), py(g, h1, s1));
    ctx.lineTo(px(g, a0, s1), py(g, h0, s1));
    ctx.fill();
  }

  /* ---------- the crane ---------- */

  function rampFor(hex, haze) {
    const base = K.parseColor(hex);
    const paper = K.parseColor(PAPER);
    const list = [];
    for (let i = 0; i < TONES; i++) {
      const f = i / (TONES - 1);
      const tone = f < 0.5 ? K.mixColor(SHADE_DARK, base, 0.42 + f * 1.16) : K.mixColor(base, paper, (f - 0.5) * 0.44);
      list.push(K.toHex(K.mixColor(tone, paper, haze)));
    }
    return list;
  }

  function fillFaces(ctx, faces, ramp, cy, sy, ct, st) {
    for (let i = 0; i < faces.length; i += 7) {
      const side = faces[i + 3];
      const n0 = faces[i + 4], n1 = faces[i + 5], n2 = faces[i + 6];
      const z1 = -n0 * sy + n2 * cy;
      let nx = n0 * cy + n2 * sy;
      let ny = n1 * ct - z1 * st;
      let nz = n1 * st + z1 * ct;
      if (side !== 0 && nz < 0) continue;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      const tone = Math.floor(((d + 0.3) / 1.3) * TONES);
      ctx.fillStyle = ramp[tone < 0 ? 0 : tone >= TONES ? TONES - 1 : tone];
      const a = faces[i], b = faces[i + 1], c = faces[i + 2];
      ctx.beginPath();
      ctx.moveTo(rx[a], ry[a]);
      ctx.lineTo(rx[b], ry[b]);
      ctx.lineTo(rx[c], ry[c]);
      ctx.fill();
    }
  }

  function paintCrane(ctx, x, y, u, yaw, tilt, ramp) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let v = 0; v < VERT_COUNT; v++) {
      const vx = VERTS[v * 3], vy = VERTS[v * 3 + 1], vz = VERTS[v * 3 + 2];
      const z1 = -vx * sy + vz * cy;
      rx[v] = x + u * (vx * cy + vz * sy);
      ry[v] = y - u * (vy * ct - z1 * st);
    }
    // +z wing is nearer the viewer whenever the yaw keeps it in front.
    const posNear = cy * ct > 0;
    fillFaces(ctx, posNear ? FACES_NEG : FACES_POS, ramp, cy, sy, ct, st);
    fillFaces(ctx, FACES_MID, ramp, cy, sy, ct, st);
    fillFaces(ctx, posNear ? FACES_POS : FACES_NEG, ramp, cy, sy, ct, st);
  }

  /* ---------- the corridor, baked ---------- */

  function paintGarden(ctx, g, rand) {
    const s = 3;
    const c = layer(g.W / s, g.H / s);
    const x = c.getContext('2d');
    x.fillStyle = '#f1ebd6';
    x.fillRect(0, 0, c.width, c.height);
    const bank = (base, range, seed, tone) => {
      x.fillStyle = tone;
      x.beginPath();
      x.moveTo(0, c.height);
      for (let i = 0; i <= c.width + 2; i += 2) {
        x.lineTo(i, c.height * (base - fbm(i * s * 0.07, seed, 4, seed) * range));
      }
      x.lineTo(c.width + 2, c.height);
      x.fill();
    };
    bank(0.5, 0.42, 3, '#dadcb6');
    bank(0.62, 0.34, 11, '#c3cb97');
    bank(0.74, 0.2, 17, '#b1bd84');
    x.fillStyle = '#d9d7b0';
    x.fillRect(0, c.height * 0.68, c.width, c.height * 0.32);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = rand() < 0.5 ? '#cccea3' : '#e3e0bf';
      x.fillRect(rand() * c.width, c.height * (0.68 + rand() * 0.3), 1 + rand() * 4, 1);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(c, 0, 0, g.W, g.H);
  }

  function paintCeiling(ctx, g) {
    const s0 = 1 / END_Z;
    ctx.fillStyle = '#a08a68';
    depthQuad(ctx, g, EAVE, CEIL, WALL, CEIL, 1.2, s0);
    ctx.fillStyle = '#7f6a4e';
    for (let z = 1; z < END_Z; z += 0.75) {
      const s = 1 / z;
      depthQuad(ctx, g, EAVE, CEIL, WALL, CEIL, s, 1 / (z + 0.14));
    }
    ctx.fillStyle = '#6a563e';
    for (const row of ROWS) depthQuad(ctx, g, row.side - 0.008, CEIL, row.side + 0.008, CEIL, 1.2, s0);
    depthQuad(ctx, g, EAVE, CEIL, EAVE, CEIL - 0.07, 1.2, s0);
    depthQuad(ctx, g, EAVE, CEIL, EAVE + 0.04, CEIL, 1.2, s0);
  }

  function paintFloor(ctx, g) {
    const s0 = 1 / END_Z;
    const tones = ['#b39c76', '#ab9470', '#b8a27c'];
    const boards = 15;
    for (let i = 0; i < boards; i++) {
      ctx.fillStyle = tones[(i * 2) % 3];
      const a = lerp(EAVE, WALL, i / boards);
      const b = lerp(EAVE, WALL, (i + 1) / boards);
      depthQuad(ctx, g, a, FLOOR, b, FLOOR, 1.5, s0);
      ctx.fillStyle = '#8f7a5a';
      depthQuad(ctx, g, b - 0.004, FLOOR, b + 0.004, FLOOR, 1.5, s0);
    }
    ctx.fillStyle = '#6f5a42';
    depthQuad(ctx, g, EAVE - 0.03, FLOOR, EAVE + 0.012, FLOOR, 1.5, s0);
  }

  function paintWall(ctx, g) {
    const s0 = 1 / END_Z;
    ctx.fillStyle = '#e6dcc4';
    depthQuad(ctx, g, WALL, CEIL, WALL, FLOOR, 1.2, s0);
    ctx.fillStyle = '#b9a584';
    depthQuad(ctx, g, WALL, CEIL, WALL, 0.42, 1.2, s0);
    ctx.fillStyle = '#8d7858';
    depthQuad(ctx, g, WALL, FLOOR, WALL, -0.5, 1.2, s0);
    ctx.fillStyle = '#b5a180';
    for (const h of [0.2, -0.02, -0.26]) depthQuad(ctx, g, WALL, h + 0.006, WALL, h - 0.006, 1.2, s0);
    for (let z = 1; z < END_Z; z += 0.3) {
      const major = Math.abs((z - 1) / 1.2 - Math.round((z - 1) / 1.2)) < 0.01;
      ctx.fillStyle = major ? '#6f5a42' : '#b5a180';
      const dz = major ? 0.09 : 0.03;
      depthQuad(ctx, g, WALL, major ? CEIL : 0.42, WALL, major ? FLOOR : -0.5, 1 / z, 1 / (z + dz));
    }
    ctx.fillStyle = '#6f5a42';
    depthQuad(ctx, g, WALL, 0.45, WALL, 0.4, 1.2, s0);
    depthQuad(ctx, g, WALL, -0.48, WALL, -0.53, 1.2, s0);
  }

  function paintFarEnd(ctx, g) {
    const s = 1 / END_Z;
    const x0 = px(g, EAVE, s), x1 = px(g, WALL, s);
    const y0 = py(g, CEIL, s), y1 = py(g, FLOOR, s);
    ctx.fillStyle = '#f7f1e0';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#b8a688';
    ctx.fillRect(lerp(x0, x1, 0.5) - 0.5, y0, 1, y1 - y0);
  }

  function paintPosts(ctx, g) {
    const s0 = 1 / END_Z;
    for (let z = POST_FIRST; z < END_Z; z += POST_STEP) {
      const s = 1 / z;
      const w = Math.max(1, g.U * 3 * s);
      ctx.fillStyle = '#6a563e';
      ctx.fillRect(px(g, EAVE, s) - w / 2, py(g, CEIL, s), w, py(g, FLOOR, s) - py(g, CEIL, s));
    }
    ctx.fillStyle = '#6a563e';
    depthQuad(ctx, g, EAVE, CEIL, EAVE, CEIL - 0.04, 1.2, s0);
  }

  function paintHall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGarden(ctx, g, rand);
    paintFloor(ctx, g);
    paintCeiling(ctx, g);
    paintWall(ctx, g);
    paintFarEnd(ctx, g);
    paintPosts(ctx, g);
    return c;
  }

  // Depth on the floor where a slanting line of sun crosses at this side.
  function slanted(z, side) { return z + (SLANT * (side - EAVE)) / (WALL - EAVE); }

  // Sun between the posts: slanted patches on the floor, soft from low resolution.
  function paintSun(g) {
    const scale = 2;
    const c = layer(g.W / scale, g.H / scale);
    const ctx = c.getContext('2d');
    ctx.scale(1 / scale, 1 / scale);
    ctx.fillStyle = '#efe5cb';
    for (let z = POST_FIRST + 0.15; z < END_Z - 2; z += POST_STEP) {
      const z1 = z + POST_STEP - 0.45;
      const n0 = 1 / z, n1 = 1 / z1, f0 = 1 / slanted(z, WALL), f1 = 1 / slanted(z1, WALL);
      ctx.beginPath();
      ctx.moveTo(px(g, EAVE, n0), py(g, FLOOR, n0));
      ctx.lineTo(px(g, WALL, f0), py(g, FLOOR, f0));
      ctx.lineTo(px(g, WALL, f1), py(g, FLOOR, f1));
      ctx.lineTo(px(g, EAVE, n1), py(g, FLOOR, n1));
      ctx.fill();
      depthQuad(ctx, g, WALL, FLOOR, WALL, 0.42, f0, f1);
    }
    return c;
  }

  // Pale air over the distance, so depth reads as light and not only as size.
  function paintHaze(g) {
    const scale = 4;
    const w = g.W / scale, h = g.H / scale;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const x = (VX * g.W) / scale, y = (VY * g.H) / scale;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, w * 0.26);
    glow.addColorStop(0, 'rgba(248,242,226,0.6)');
    glow.addColorStop(0.5, 'rgba(248,242,226,0.3)');
    glow.addColorStop(1, 'rgba(248,242,226,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    return c;
  }

  function paintWallShadow() {
    const c = layer(6, 44);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7d6c54';
    ctx.fillRect(2.6, 0, 0.8, 44);
    for (let i = 0; i < CRANES; i++) {
      ctx.beginPath();
      ctx.ellipse(3, 3 + (i + 0.5) * 5.6, 2.8, 1.5, 0, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  function paintFloorShadow() {
    const c = layer(44, 9);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6f5e48';
    ctx.fillRect(0, 4, 44, 1);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(5 + i * 11, 4.5, 4.2, 3.2, 0, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  /* ---------- strings ---------- */

  function buildAtlas(g, tier, colours) {
    const u = UNIT * g.U * tier.s;
    const cw = Math.ceil(u * 2.7) + 2;
    const ch = Math.ceil(u * 2.2) + 2;
    const across = colours.length;
    const down = SPRITE_YAWS.length * SPRITE_TILTS.length;
    const c = layer(cw * across, ch * down);
    const ctx = c.getContext('2d');
    colours.forEach((hex, ci) => {
      const ramp = rampFor(hex, tier.haze);
      SPRITE_YAWS.forEach((yaw, yi) => {
        SPRITE_TILTS.forEach((tilt, ti) => {
          const row = yi * SPRITE_TILTS.length + ti;
          paintCrane(ctx, cw * ci + cw / 2, ch * row + ch * 0.46, u, yaw, tilt, ramp);
        });
      });
    });
    return { canvas: c, cw, ch, s: tier.s, upTo: tier.upTo };
  }

  function buildFarColumns(g, rand) {
    const s = 1 / FAR_Z;
    const u = UNIT * g.U * s;
    const height = (CEIL - FOOT) * g.H * s;
    const w = Math.ceil(u * 2.4) + 2;
    const list = [];
    for (let v = 0; v < FAR_VARIANTS; v++) {
      const c = layer(w, height + 2);
      const ctx = c.getContext('2d');
      for (let i = 0; i < CRANES; i++) {
        const y = ((i + 0.5) / CRANES) * height;
        const ramp = rampFor(COLOURS[Math.floor(rand() * COLOURS.length)], 0.44);
        paintCrane(ctx, w / 2, y, u, SPRITE_YAWS[i % SPRITE_YAWS.length], 0.3, ramp);
      }
      list.push(c);
    }
    return list;
  }

  function makeCrane(g, st, i, rand) {
    const f = (i + 0.5) / CRANES;
    const y = lerp(st.yTop, st.yFoot, f);
    const hero = st.z === 1;
    const colour = hero ? HERO_ORDER[i % HERO_ORDER.length] : Math.floor(rand() * COLOURS.length);
    const facing = rand() < 0.72 ? st.flip : -st.flip;
    const yawIndex = Math.floor(rand() * SPRITE_YAWS.length);
    return {
      f,
      y,
      bend: Math.pow(f, 1.35),
      colour,
      facing,
      yawIndex,
      tiltIndex: y > g.vy ? 1 : 0,
      yaw: (NEAR_YAWS[yawIndex] * facing) + (facing > 0 ? 0 : Math.PI),
      tilt: Math.max(-0.5, Math.min(0.75, ((y - g.vy) / g.H) * 1.05)) + TILT_BIAS,
      phase: rand() * 6.283,
    };
  }

  function makeStrings(g, rand) {
    const list = [];
    for (const row of ROWS) {
      for (let z = row.z0; z < END_Z - 1; z += ROW_STEP) {
        const s = 1 / z;
        const st = { z, s, x: px(g, row.side, s), flip: row.flip, yTop: py(g, CEIL, s), yFoot: py(g, FOOT, s) };
        st.shadow = shadowOf(g, st, row.side);
        st.amp = g.U * 7 * s;
        st.cranes = [];
        if (z < FAR_Z) {
          for (let i = 0; i < CRANES; i++) st.cranes.push(makeCrane(g, st, i, rand));
          st.cranes = st.cranes.filter((c) => c.y > -UNIT * g.U * s && c.y < g.H + UNIT * g.U * s);
        } else {
          st.column = Math.floor(rand() * FAR_VARIANTS);
        }
        list.push(st);
      }
    }
    return list.sort((a, b) => b.z - a.z);
  }

  function shadowOf(g, st, side) {
    const ws = 1 / (st.z + (SLANT * (WALL - side)) / (WALL - EAVE));
    const y = py(g, FLOOR, st.s);
    const top = py(g, 0.42, ws);
    const foot = py(g, FLOOR, ws);
    return {
      y,
      h: g.U * 8 * st.s,
      dx: px(g, WALL, ws) - st.x,
      dy: foot - y,
      wx: px(g, WALL, ws),
      ww: g.U * 11 * ws,
      top,
      wh: foot - top,
    };
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.vx = g.W * VX;
    g.vy = g.H * VY;
    const rand = K.rng(api.seed);
    state.g = g;
    state.hall = paintHall(g, rand);
    state.sun = paintSun(g);
    state.haze = paintHaze(g);
    state.wallShadow = paintWallShadow();
    state.floorShadow = paintFloorShadow();
    state.atlases = TIERS.map((t) => buildAtlas(g, t, COLOURS));
    state.columns = buildFarColumns(g, rand);
    const strings = makeStrings(g, rand);
    state.strings = strings;
    state.shadowed = strings.filter((s) => s.z < 8);
    state.far = strings.filter((s) => s.z >= FAR_Z);
    state.mid = strings.filter((s) => s.z < FAR_Z && s.z >= NEAR_Z);
    state.near = strings.filter((s) => s.z < NEAR_Z);
    state.ramps = COLOURS.map((c) => rampFor(c, 0));
    for (const st of state.mid) st.atlas = state.atlases.find((a) => st.z < a.upTo);
  }

  /* ---------- the breeze ---------- */

  // The sway at the foot of one string. The phase steps with depth, so the
  // motion runs along the row, and a slow gust swells and fades as it goes.
  function swayOf(st, t, breeze) {
    const wave = Math.sin(t * 0.85 - st.z * 0.95);
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.21 - st.z * 0.42);
    return wave * (0.35 + 0.75 * pulse * pulse) * breeze;
  }

  function drawShadows(ctx, g, t, breeze) {
    for (const st of state.shadowed) {
      const sway = swayOf(st, t - 0.3, breeze) * st.amp;
      const sh = st.shadow;
      ctx.globalAlpha = 0.3;
      ctx.drawImage(state.wallShadow, sh.wx - sh.ww / 2 + sway * 0.6, sh.top, sh.ww, sh.wh);
      if (st.z > FLOOR_SHADOW_Z) continue;
      ctx.globalAlpha = 0.26;
      ctx.setTransform(sh.dx / 44, sh.dy / 44, 0, sh.h / 9, st.x + sway * 0.4, sh.y - sh.h / 2);
      ctx.drawImage(state.floorShadow, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalAlpha = 1;
  }

  function drawFar(ctx, g, t, breeze) {
    const ref = 1 / FAR_Z;
    for (const st of state.far) {
      const img = state.columns[st.column];
      const k = st.s / ref;
      const sway = swayOf(st, t, breeze) * st.amp * 0.6;
      ctx.drawImage(img, st.x + sway - (img.width * k) / 2, st.yTop, img.width * k, img.height * k);
    }
  }

  function drawThreads(ctx, g, list, t, breeze) {
    ctx.beginPath();
    for (const st of list) {
      const sway = swayOf(st, t, breeze) * st.amp;
      ctx.moveTo(st.x, st.yTop);
      ctx.lineTo(st.x + sway * 0.36, lerp(st.yTop, st.yFoot, 0.5));
      ctx.lineTo(st.x + sway, st.yFoot);
    }
    ctx.stroke();
  }

  function drawTassels(ctx, g, list, t, breeze) {
    ctx.fillStyle = '#ab4228';
    for (const st of list) {
      const x = st.x + swayOf(st, t, breeze) * st.amp;
      const w = Math.max(1, g.U * 1.3 * st.s);
      ctx.fillRect(x - w / 2, st.yFoot, w, g.U * 7 * st.s);
    }
  }

  function drawMid(ctx, g, t, breeze) {
    for (const st of state.mid) {
      const a = st.atlas;
      const sway = swayOf(st, t, breeze) * st.amp;
      const k = st.s / a.s;
      for (const c of st.cranes) {
        const dx = sway * c.bend + Math.sin(t * 1.7 - c.f * 5 - st.z) * st.amp * 0.08 * breeze;
        const twist = 1 - 0.14 * (1 + Math.sin(t * 0.55 + c.phase));
        const row = c.yawIndex * SPRITE_TILTS.length + c.tiltIndex;
        const dw = a.cw * k * c.facing * twist;
        ctx.drawImage(a.canvas, c.colour * a.cw, row * a.ch, a.cw, a.ch, st.x + dx - dw / 2, c.y - a.ch * k * 0.46, dw, a.ch * k);
      }
    }
  }

  function drawNear(ctx, g, t, breeze) {
    ctx.lineWidth = Math.max(0.8, g.U * 0.4);
    for (const st of state.near) {
      const sway = swayOf(st, t, breeze);
      const u = UNIT * g.U * st.s;
      ctx.strokeStyle = '#a49273';
      ctx.beginPath();
      ctx.moveTo(st.x, st.yTop);
      for (const c of st.cranes) ctx.lineTo(st.x + sway * st.amp * c.bend, c.y);
      ctx.lineTo(st.x + sway * st.amp, st.yFoot);
      ctx.stroke();
      for (const c of st.cranes) {
        const dx = sway * st.amp * c.bend + Math.sin(t * 1.7 - c.f * 5 - st.z) * st.amp * 0.08 * breeze;
        const turn = Math.sin(t * 0.55 + c.phase) * 0.14 + sway * 0.24;
        paintCrane(ctx, st.x + dx, c.y, u, c.yaw + turn, c.tilt, state.ramps[c.colour]);
      }
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const breeze = api.props.breeze;
    ctx.drawImage(state.hall, 0, 0);
    ctx.globalAlpha = 0.72 + 0.2 * Math.sin(t * 0.13);
    ctx.drawImage(state.sun, 0, 0, g.W, g.H);
    ctx.globalAlpha = 1;
    drawShadows(ctx, g, t, breeze);
    drawFar(ctx, g, t, breeze);
    ctx.strokeStyle = '#a49273';
    ctx.lineWidth = 1;
    drawThreads(ctx, g, state.mid, t, breeze);
    drawTassels(ctx, g, state.mid, t, breeze);
    drawMid(ctx, g, t, breeze);
    ctx.globalAlpha = 0.82 + 0.12 * Math.sin(t * 0.17 + 1);
    ctx.drawImage(state.haze, 0, 0, g.W, g.H);
    ctx.globalAlpha = 1;
    drawTassels(ctx, g, state.near, t, breeze);
    drawNear(ctx, g, t, breeze);
  }

  Kasuri.run({
    defaults: { breeze: 1, ramp: 'kana', cell: 7, invert: true, bg: PAPER, tint: 0.9, gain: 1.05, dither: 0.25, boost: 0.2 },
    maxFps: 24,
    setup,
    draw,
  });
})();
