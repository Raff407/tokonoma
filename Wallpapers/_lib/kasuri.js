/*
 * kasuri — weaves a tiny painted scene back up as glyphs on the GPU.
 *
 * A wallpaper paints into a cols × rows canvas (one pixel per cell) with the
 * ordinary 2D API. Each frame that canvas goes up as a texture and a single
 * fragment shader turns every cell into a glyph, a block, a dot, or leaves it
 * as a raw pixel. Grids of 150k cells stay cheap because nothing per-cell
 * happens on the CPU.
 *
 * Native hosts drive it through window.tokonoma (apply / setPaused / setFps /
 * pointer). In a plain browser, query params stand in: ?mode=dot&cell=8
 */
(function (root) {
  'use strict';

  // Taken before any scene script runs (kasuri loads first, or is injected at
  // document start), so a scene that swaps these out can't fake its own checks.
  const native = Object.freeze({
    now: root.performance.now.bind(root.performance),
    getImageData: root.CanvasRenderingContext2D.prototype.getImageData,
    toDataURL: root.HTMLCanvasElement.prototype.toDataURL,
    drawImage: root.CanvasRenderingContext2D.prototype.drawImage,
    defineProperty: Object.defineProperty,
    freeze: Object.freeze,
  });

  const C = root.KasuriCore;
  const MODES = Object.freeze({ glyph: 0, block: 1, dot: 2, raw: 3 });
  const FONT = '"SF Mono", Menlo, ui-monospace, monospace';

  const BASE_DEFAULTS = Object.freeze({
    mode: 'glyph',
    cell: 10,
    ramp: 'ascii',
    gain: 1,
    dither: 0.6,
    boost: 0.35,
    tint: 0.55,
    invert: false,
    bg: '#0b0b0a',
    speed: 1,
  });

  // Props that change the grid or atlas, so the scene must be rebuilt.
  const LAYOUT_KEYS = ['cell', 'ramp', 'mode'];

  const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uAtlas;
uniform vec2 uRes;
uniform float uCell;
uniform float uGlyphs;
uniform int uMode;
uniform vec3 uBg;
uniform float uGain;
uniform float uDither;
uniform float uBoost;
uniform float uTint;
uniform bool uInvert;
// Ink coverage of each glyph, and how far to lift the wash where a glyph is thin.
uniform float uCov[96];
uniform float uLift;
out vec4 outColor;

const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = floor(fc / uCell);
  vec2 local = fract(fc / uCell);
  vec3 col = texelFetch(uScene, ivec2(cell), 0).rgb;
  if (uMode == 3) { outColor = vec4(col, 1.0); return; }

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  // A gentle lift so mid-tones still get glyphs worth reading.
  float l = pow(uInvert ? 1.0 - lum : lum, 0.72);
  ivec2 b = ivec2(mod(cell, 4.0));
  float threshold = BAYER[b.y * 4 + b.x] / 16.0 - 0.5;
  l = clamp(l * uGain + threshold * uDither / uGlyphs, 0.0, 1.0);

  float a;
  float wash = 0.3;
  if (uMode == 0) {
    float gi = floor(l * (uGlyphs - 1.0) + 0.5);
    a = texture(uAtlas, vec2((gi + local.x) / uGlyphs, local.y)).r;
    // Thin glyphs leave most of the cell as wash, so the picture goes dull.
    // Raise the wash until the cell is about as bright as a full ramp would make it.
    float cov = uCov[int(gi)];
    float want = l + (1.0 - l) * 0.3 * uTint;
    float need = (want - cov) / max((1.0 - cov) * uTint, 0.05);
    wash = mix(0.3, clamp(need, 0.3, 0.8), uLift);
  } else if (uMode == 1) {
    vec2 q = abs(local - 0.5);
    float edge = 0.5 - max(1.2 / uCell, 0.1);
    a = step(max(q.x, q.y), edge) * step(0.16, l);
  } else {
    float r = 0.52 * sqrt(l);
    a = 1.0 - smoothstep(r - 1.0 / uCell, r + 1.0 / uCell, length(local - 0.5));
  }

  float peak = max(max(col.r, col.g), col.b);
  vec3 vivid = col / max(peak, 0.08);
  vec3 ink = uInvert ? col : min(mix(col, vivid * mix(0.55, 1.0, l), uBoost), 1.0);
  if (uMode == 1) ink = col;
  // Each cell sits on a dim wash of its own colour, like dyed thread under the weave.
  vec3 ground = mix(uBg, uInvert ? mix(uBg, col, 0.35) : col * wash, uTint);
  outColor = vec4(mix(ground, ink, a), 1.0);
}`;

  function buildAtlas(chars, cellPx) {
    const glyphs = [...chars];
    const atlas = document.createElement('canvas');
    atlas.width = glyphs.length * cellPx;
    atlas.height = cellPx;
    const ctx = atlas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, atlas.width, atlas.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(cellPx * 0.95)}px ${FONT}`;
    glyphs.forEach((g, i) => {
      const w = ctx.measureText(g).width || cellPx;
      // Stretch narrow glyphs sideways so the grid reads as a weave, not as text.
      const sx = Math.min(1.6, (cellPx * 0.92) / w);
      ctx.save();
      ctx.translate(i * cellPx + cellPx / 2, cellPx / 2 + cellPx * 0.04);
      ctx.scale(sx, 1);
      ctx.fillText(g, 0, 0);
      ctx.restore();
    });
    const px = ctx.getImageData(0, 0, atlas.width, atlas.height).data;
    const coverage = glyphs.map((_, i) => {
      let sum = 0;
      for (let y = 0; y < cellPx; y++) {
        for (let x = i * cellPx; x < (i + 1) * cellPx; x++) sum += px[(y * atlas.width + x) * 4];
      }
      return sum / (255 * cellPx * cellPx);
    });
    return { canvas: atlas, count: glyphs.length, coverage };
  }

  function compile(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('kasuri shader: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function texture(gl) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function glRenderer(canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    if (!gl) return null;

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('kasuri link: ' + gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    for (const name of ['uScene', 'uAtlas', 'uRes', 'uCell', 'uGlyphs', 'uMode', 'uBg', 'uGain', 'uDither', 'uBoost', 'uTint', 'uInvert', 'uCov', 'uLift']) {
      u[name] = gl.getUniformLocation(program, name);
    }
    const sceneTex = texture(gl);
    const atlasTex = texture(gl);
    gl.uniform1i(u.uScene, 0);
    gl.uniform1i(u.uAtlas, 1);
    let glyphCount = 1;
    let lift = 0;

    return {
      kind: 'webgl2',
      setAtlas(chars, cellPx, rampLift) {
        const atlas = buildAtlas(chars, cellPx);
        glyphCount = atlas.count;
        lift = rampLift || 0;
        const cov = new Float32Array(96);
        cov.set(atlas.coverage.slice(0, 96));
        gl.uniform1fv(u.uCov, cov);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, atlasTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      },
      draw(scene, props, cellPx) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sceneTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
        const bg = C.parseColor(props.bg).map((c) => c / 255);
        gl.uniform2f(u.uRes, canvas.width, canvas.height);
        gl.uniform1f(u.uCell, cellPx);
        gl.uniform1f(u.uGlyphs, glyphCount);
        gl.uniform1i(u.uMode, MODES[props.mode] ?? 0);
        gl.uniform3f(u.uBg, bg[0], bg[1], bg[2]);
        gl.uniform1f(u.uGain, props.gain);
        gl.uniform1f(u.uDither, props.dither);
        gl.uniform1f(u.uBoost, props.boost);
        gl.uniform1f(u.uTint, props.tint);
        gl.uniform1i(u.uInvert, props.invert ? 1 : 0);
        gl.uniform1f(u.uLift, props.invert ? 0 : lift);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  // No WebGL2: show the scene as plain pixels rather than nothing.
  function flatRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    return {
      kind: 'canvas2d',
      setAtlas() {},
      draw(scene) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(scene, 0, 0, canvas.width, canvas.height);
      },
    };
  }

  function mountCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
    document.documentElement.style.cssText = 'margin:0;height:100%;overflow:hidden;background:#000';
    document.body.style.cssText = 'margin:0;height:100%;overflow:hidden';
    document.body.appendChild(canvas);
    return canvas;
  }

  function post(message) {
    const handler = root.webkit && root.webkit.messageHandlers && root.webkit.messageHandlers.tokonoma;
    if (handler) handler.postMessage(message);
  }

  /*
   * spec = {
   *   defaults: { ...scene props },        merged over BASE_DEFAULTS
   *   setup(ctx, api)                      on start and whenever the grid changes
   *   draw(ctx, t, dt, api)                every frame, paints cols × rows pixels
   *   onProps(props, api)                  optional, after a live prop change
   * }
   */
  function run(spec) {
    const defaults = Object.assign({}, BASE_DEFAULTS, spec.defaults);
    const injected = (root.__tokonoma && root.__tokonoma.properties) || {};
    let props = C.mergeProps(defaults, Object.assign({}, injected, C.propsFromQuery(root.location.search)));

    // Anything that throws inside a scene reaches the host instead of dying quietly.
    root.addEventListener('error', (e) => post({ type: 'error', message: String(e.message || e) }));
    root.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));

    const out = mountCanvas();
    // GPU resets (sleep, hot-plugging a display) can take the GL context away.
    // Ask for it back, and start clean once it returns.
    out.addEventListener('webglcontextlost', (e) => e.preventDefault());
    out.addEventListener('webglcontextrestored', () => root.location.reload());
    const scene = document.createElement('canvas');
    const ctx = scene.getContext('2d', { alpha: false });
    let renderer;
    try {
      renderer = glRenderer(out) || flatRenderer(out);
    } catch (err) {
      console.error(err);
      post({ type: 'error', message: String(err.message || err) });
      renderer = flatRenderer(out);
    }

    const seed = (spec.seed ?? Math.random() * 1e9) >>> 0;
    const api = {
      cols: 1,
      rows: 1,
      cell: props.cell,
      props,
      seed,
      rand: C.rng(seed),
      pointer: { x: -1, y: -1, active: false },
      core: C,
    };

    let time = 0;
    let last = null;
    let paused = false;
    let raf = 0;
    // The host can pause us and so can the page going hidden; play only when neither holds.
    const holds = { host: false, hidden: false };
    // A scene can ask for fewer frames than the host allows (slow ink needs no 30fps).
    const capped = (fps) => (spec.maxFps ? Math.min(fps || spec.maxFps, spec.maxFps) : fps);
    let gate = C.frameGate(capped((root.__tokonoma && root.__tokonoma.fps) || 0));

    // The host may cap the pixel ratio (1× on battery): same grid, a quarter of the pixels.
    let maxScale = (root.__tokonoma && root.__tokonoma.scale) || Infinity;

    function layout() {
      const dpr = Math.min(root.devicePixelRatio || 1, maxScale);
      const grid = C.gridSize(root.innerWidth, root.innerHeight, props.cell);
      const cellPx = grid.cell * dpr;
      out.width = Math.round(grid.cols * cellPx);
      out.height = Math.round(grid.rows * cellPx);
      out.style.width = grid.cols * grid.cell + 'px';
      out.style.height = grid.rows * grid.cell + 'px';
      scene.width = grid.cols;
      scene.height = grid.rows;
      api.cols = grid.cols;
      api.rows = grid.rows;
      api.cell = grid.cell;
      api.cellPx = cellPx;
      renderer.setAtlas(C.RAMPS[props.ramp] || C.RAMPS.ascii, Math.round(cellPx), C.RAMP_LIFT[props.ramp] || 0);
      ctx.imageSmoothingEnabled = true;
      if (spec.setup) spec.setup(ctx, api);
    }

    function render(dt) {
      const step = dt * props.speed;
      time += step;
      spec.draw(ctx, time, step, api);
      renderer.draw(scene, props, api.cellPx);
    }

    function frame(now) {
      if (paused) return;
      raf = root.requestAnimationFrame(frame);
      if (!gate(now)) return;
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 0.1);
      last = now;
      render(dt);
    }

    // Advance by hand, for thumbnails and for hosts that are not painting.
    function step(seconds = 1 / 30, frames = 1) {
      for (let i = 0; i < frames; i++) render(seconds);
    }

    function setHold(key, value) {
      holds[key] = value;
      const next = holds.host || holds.hidden;
      if (next === paused) return;
      paused = next;
      if (spec.onPause) spec.onPause(paused, api);
      root.cancelAnimationFrame(raf);
      if (!paused) {
        last = null;
        raf = root.requestAnimationFrame(frame);
      }
    }

    function apply(incoming) {
      const next = C.mergeProps(defaults, Object.assign({}, props, incoming));
      const relayout = LAYOUT_KEYS.some((k) => next[k] !== props[k]);
      props = next;
      api.props = next;
      if (relayout) layout();
      if (spec.onProps) spec.onProps(next, api);
      if (paused) render(0);
    }

    // A still of the scene a moment in, for library thumbnails. Steps by hand,
    // so it works even when the page is hidden and not animating.
    async function capture(width = 480, warmup = 1.5) {
      if (spec.ready) {
        await Promise.race([spec.ready(), new Promise((resolve) => setTimeout(resolve, 4000))]);
      }
      step(1 / 30, Math.round(warmup * 30));
      const still = document.createElement('canvas');
      still.width = width;
      still.height = Math.round((width * out.height) / out.width);
      native.drawImage.call(still.getContext('2d'), out, 0, 0, still.width, still.height);
      return native.toDataURL.call(still, 'image/jpeg', 0.86);
    }

    /*
     * Measures the scene for the marketplace checks: how much it moves, whether
     * it flashes, how much of the grid it fills, how few colours it leans on,
     * and how long a frame takes. Reads the small scene canvas, so it is cheap.
     */
    async function inspect() {
      if (spec.ready) {
        await Promise.race([spec.ready(), new Promise((resolve) => setTimeout(resolve, 4000))]);
      }
      const read = () => native.getImageData.call(ctx, 0, 0, scene.width, scene.height).data.slice();
      const lum = (d, i) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      const diff = (a, b) => {
        let sum = 0;
        for (let i = 0; i < a.length; i += 4) sum += Math.abs(lum(a, i) - lum(b, i));
        return sum / (a.length / 4);
      };
      step(1 / 30, 30);
      const first = read();
      let prev = first;
      let flash = 0;
      let spent = 0;
      for (let i = 0; i < 60; i++) {
        const t0 = native.now();
        render(1 / 30);
        spent += native.now() - t0;
        const now = read();
        flash = Math.max(flash, diff(prev, now));
        prev = now;
      }
      const cells = prev.length / 4;
      let lit = 0;
      const counts = new Map();
      for (let i = 0; i < prev.length; i += 4) {
        const l = props.invert ? 1 - lum(prev, i) : lum(prev, i);
        if (l > 0.08) lit++;
        const key = ((prev[i] >> 4) << 8) | ((prev[i + 1] >> 4) << 4) | (prev[i + 2] >> 4);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const top = [...counts.values()].sort((a, b) => b - a).slice(0, 32).reduce((s, n) => s + n, 0);
      return {
        motion: diff(first, prev),
        flash,
        coverage: lit / cells,
        paletteShare: top / cells,
        msPerFrame: spent / 60,
        mode: props.mode,
        cols: api.cols,
        rows: api.rows,
      };
    }

    // A click on the desktop, from the host (or the mouse in a browser), in cells.
    function click(nx, ny) {
      if (spec.onClick) spec.onClick(nx * api.cols, ny * api.rows, api);
    }

    function pointer(nx, ny, active) {
      api.pointer = { x: nx * api.cols, y: ny * api.rows, active: active !== false };
    }

    const host = native.freeze({
      apply,
      setPaused: (value) => setHold('host', Boolean(value)),
      setFps(fps) { gate = C.frameGate(capped(fps)); },
      setScale(value) {
        if (value === maxScale) return;
        maxScale = value;
        layout();
        if (paused) render(0);
      },
      pointer,
      click,
      step,
      capture,
      inspect,
      get props() { return props; },
      get renderer() { return renderer.kind; },
    });
    // The app's handle on the page: frozen and fixed in place, so a scene can't
    // replace inspect() or capture() with flattering answers. If something got
    // there first, refuse to run rather than share the name.
    try {
      native.defineProperty(root, 'tokonoma', { value: host, writable: false, configurable: false, enumerable: true });
    } catch (e) {
      throw new Error('kasuri: window.tokonoma was taken before the weave started');
    }

    if (!root.webkit || !root.webkit.messageHandlers || !root.webkit.messageHandlers.tokonoma) {
      root.addEventListener('pointermove', (e) => pointer(e.clientX / root.innerWidth, e.clientY / root.innerHeight, true));
      root.addEventListener('pointerleave', () => pointer(-1, -1, false));
      root.addEventListener('pointerdown', (e) => click(e.clientX / root.innerWidth, e.clientY / root.innerHeight));
    }

    let resizeTimer = 0;
    root.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(layout, 120);
    });
    document.addEventListener('visibilitychange', () => setHold('hidden', document.hidden));

    layout();
    raf = root.requestAnimationFrame(frame);
    post({ type: 'ready', renderer: renderer.kind, cols: api.cols, rows: api.rows });
  }

  // Paints a parsed sprite with its top-left at (x, y); flip mirrors it sideways.
  function drawSprite(ctx, sprite, x, y, flip = false) {
    const ox = Math.round(x);
    const oy = Math.round(y);
    for (const p of sprite.pixels) {
      ctx.fillStyle = p.color;
      ctx.fillRect(ox + (flip ? sprite.w - 1 - p.x : p.x), oy + p.y, 1, 1);
    }
  }

  root.Kasuri = Object.freeze({ run, buildAtlas, drawSprite, MODES, BASE_DEFAULTS });
})(globalThis);
