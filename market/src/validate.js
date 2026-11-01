/*
 * validate — decides whether a shared wallpaper package is safe, light and
 * on theme. Pure JavaScript with no Node or browser APIs, so the very same
 * file runs in the MCP server, the registry, and inside the app through
 * JavaScriptCore. Never trust a check that only ran somewhere else.
 *
 * pkg = { manifest: {...}, files: { 'scene.js': { size, text }, 'assets/a.png': { size, bytes } } }
 */
(function (root) {
  'use strict';

  const R = typeof module === 'object' && module.exports ? require('./rules.js') : root.TokonomaRules;
  const { LIMITS, RENDER, WOVEN, MODES, REFERENCE } = R;

  const ID = /^[a-z0-9][a-z0-9-]{2,39}$/;
  const ASSET = /^assets\/[a-z0-9][a-z0-9._-]{0,60}\.(png|jpe?g|webp)$/;
  const ALLOWED = (path) => path === 'scene.js' || path === 'README.md' || ASSET.test(path);

  // Each pattern is checked against scene.js with comments removed.
  const FORBIDDEN = [
    ['network', /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection|RTCDataChannel/, 'talks to the network'],
    ['code-from-strings', /\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(|set(?:Timeout|Interval)\s*\(\s*['"`]/, 'builds code from strings'],
    ['modules', /\bimport\s*\(|^\s*import\s|\brequire\s*\(/m, 'loads other code'],
    ['workers', /\b(?:Shared)?Worker\s*\(|serviceWorker|WebAssembly/, 'starts workers or WebAssembly'],
    ['host-bridge', /\bwebkit\b|__tokonoma|\btokonoma\s*\.|\bpostMessage\b/, 'reaches for the host app'],
    ['dom', /document\.(?:write|body|head|documentElement|cookie|domain|querySelector|getElement)|\.(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\b(?:appendChild|insertBefore|replaceChild|prepend|append)\s*\(|createElement\s*\(\s*['"`](?!canvas['"`])/, 'edits the page instead of drawing'],
    ['storage', /\b(?:localStorage|sessionStorage|indexedDB|caches)\b/, 'stores data'],
    ['navigation', /\blocation\s*[.=[]|window\.open|\bhistory\s*\./, 'navigates away'],
    ['probing', /\bnavigator\b|\bscreen\s*\.|getUserMedia|mediaDevices/, 'probes the device'],
    ['sound', /AudioContext|new\s+Audio\b/, 'plays sound'],
    ['text', /\b(?:fillText|strokeText)\s*\(/, 'draws text (wallpapers carry no words, logos or ads)'],
    ['dynamic-lookup', /\b(?:window|globalThis|self|this)\s*\[|\bReflect\s*\.|\bnew\s+Proxy\b|\b(?:atob|btoa)\s*\(/, 'looks things up by computed name'],
  ];

  function stripComments(src) {
    // Good enough for scene code: drops /* */ and // comments outside strings.
    let out = '';
    let i = 0;
    let quote = null;
    while (i < src.length) {
      const c = src[i];
      const n = src[i + 1];
      if (quote) {
        out += c;
        if (c === '\\') { out += n || ''; i += 2; continue; }
        if (c === quote) quote = null;
        i++;
      } else if (c === '"' || c === "'" || c === '`') {
        quote = c; out += c; i++;
      } else if (c === '/' && n === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? src.length : end + 2;
      } else if (c === '/' && n === '/') {
        const end = src.indexOf('\n', i);
        i = end === -1 ? src.length : end;
      } else {
        out += c; i++;
      }
    }
    return out;
  }

  function strings(src) {
    const found = [];
    const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    let m;
    while ((m = re.exec(src))) found.push(m[2]);
    return found;
  }

  // ---- manifest -----------------------------------------------------------

  function wellFormed(p) {
    if (!p || typeof p.key !== 'string' || !p.key || typeof p.label !== 'string') return false;
    const d = p.default;
    switch (p.type) {
      case 'range':
        return [p.min, p.max, d].every((v) => typeof v === 'number' && Number.isFinite(v))
          && p.min <= p.max && d >= p.min && d <= p.max
          && (p.step === undefined || (typeof p.step === 'number' && p.step > 0));
      case 'choice':
        return Array.isArray(p.options) && p.options.length > 0 && p.options.includes(d);
      case 'toggle':
        return typeof d === 'boolean';
      case 'color':
        return typeof d === 'string' && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(d);
      default:
        return false;
    }
  }

  function checkManifest(m, errors) {
    const bad = (why) => errors.push({ code: 'bad-manifest', message: why });
    if (!m || typeof m !== 'object') return bad('wallpaper.json is missing or not an object');
    if (typeof m.id !== 'string' || !ID.test(m.id)) bad('id must be 3–40 lowercase letters, digits or dashes');
    if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 40) bad('name must be 1–40 characters');
    if (m.title !== undefined && (typeof m.title !== 'string' || m.title.length > 12)) bad('title must be at most 12 characters');
    if (m.description !== undefined && (typeof m.description !== 'string' || m.description.length > 240)) bad('description must be at most 240 characters');
    if (m.media !== undefined) bad('shared wallpapers are scenes, not media files');
    const author = m.author || {};
    if (typeof author.name !== 'string' || !author.name.trim() || author.name.length > 40) bad('author.name is required (1–40 characters)');
    if (author.url !== undefined && !/^https:\/\/[^\s]{3,200}$/.test(author.url)) bad('author.url must be an https:// link');
    const props = Array.isArray(m.properties) ? m.properties : [];
    if (m.properties !== undefined && !Array.isArray(m.properties)) bad('properties must be a list');
    const seen = new Set();
    for (const p of props) {
      if (!wellFormed(p)) bad(`property "${p && p.key}" is malformed`);
      else if (seen.has(p.key)) bad(`property "${p.key}" is declared twice`);
      else seen.add(p.key);
    }
    return props;
  }

  function checkTheme(props, scene, errors, warnings) {
    const mode = props.find((p) => p.key === 'mode');
    if (!mode || mode.type !== 'choice' || !mode.options.every((o) => MODES.includes(o)) || !WOVEN.includes(mode.default)) {
      errors.push({ code: 'off-theme-mode', message: 'declare a "mode" choice whose default is glyph, block or dot' });
    }
    const cell = props.find((p) => p.key === 'cell');
    if (!cell) warnings.push({ code: 'no-cell', message: 'add a "cell" range so people can choose the grain' });
    else if (cell.default < 4 || cell.default > 16) errors.push({ code: 'off-theme-grain', message: 'default cell size should be 4–16 so the weave reads as a weave' });

    const neon = new Set();
    for (const hex of scene.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || []) {
      if (isNeon(hex)) neon.add(hex.toLowerCase());
    }
    if (neon.size > LIMITS.maxNeon) {
      errors.push({ code: 'off-theme-palette', message: `too many neon colours (${[...neon].slice(0, 6).join(', ')}); use the muted ink palette` });
    }
  }

  function isNeon(hex) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    return s > 0.9 && l > 0.35 && l < 0.66;
  }

  // ---- scene --------------------------------------------------------------

  function checkScene(file, errors) {
    if (!file || typeof file.text !== 'string') {
      errors.push({ code: 'not-kasuri', message: 'scene.js is missing' });
      return '';
    }
    if (file.size > LIMITS.sceneBytes) errors.push({ code: 'too-big', message: `scene.js is over ${LIMITS.sceneBytes / 1024} KB` });
    const code = stripComments(file.text);
    if ((code.match(/\bKasuri\.run\s*\(/g) || []).length !== 1) {
      errors.push({ code: 'not-kasuri', message: 'scene.js must call Kasuri.run(...) exactly once' });
    }
    for (const [codeName, pattern, why] of FORBIDDEN) {
      if (pattern.test(code)) errors.push({ code: codeName, message: `scene.js ${why}` });
    }
    const longest = Math.max(0, ...file.text.split('\n').map((l) => l.length));
    const lits = strings(code);
    const longestString = Math.max(0, ...lits.map((s) => s.length));
    const escapes = (code.match(/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/gi) || []).length;
    if (longest > LIMITS.maxLine || longestString > LIMITS.maxString || escapes > 40) {
      errors.push({ code: 'unreadable', message: 'scene.js must be readable source: no minified lines, packed strings or escape soup' });
    }
    for (const s of lits) {
      if (/^(?:https?:)?\/\/|^data:|^blob:|^file:/i.test(s) || (/\.(png|jpe?g|webp|gif|svg|mp4|mov|webm)$/i.test(s) && !ASSET.test(s))) {
        errors.push({ code: 'outside-resources', message: `scene.js points outside its package: "${s.slice(0, 60)}"` });
        break;
      }
    }
    return code;
  }

  // ---- assets -------------------------------------------------------------

  function imageSize(bytes) {
    const b = bytes;
    const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const u16 = (i) => (b[i] << 8) | b[i + 1];
    if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return { width: u32(16), height: u32(20) };
    }
    if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null;
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { width: u16(i + 7), height: u16(i + 5) };
        }
        i += 2 + u16(i + 2);
      }
      return null;
    }
    const tag = (i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    if (b.length >= 30 && tag(0) === 'RIFF' && tag(8) === 'WEBP') {
      const kind = tag(12);
      if (kind === 'VP8X') return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
      if (kind === 'VP8 ') return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
      if (kind === 'VP8L') {
        const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    return null;
  }

  function checkAssets(files, errors) {
    const assets = [];
    let total = 0;
    for (const [path, file] of Object.entries(files)) {
      if (!ASSET.test(path)) continue;
      total += file.size || 0;
      const size = file.bytes ? imageSize(file.bytes) : null;
      if (!size) {
        errors.push({ code: 'bad-asset', message: `${path} is not a real PNG, JPEG or WebP image` });
        continue;
      }
      if (size.width > LIMITS.assetSide || size.height > LIMITS.assetSide) {
        errors.push({ code: 'asset-too-big', message: `${path} is ${size.width}×${size.height}; sprites and textures only (≤ ${LIMITS.assetSide}px), no photos` });
      }
      assets.push({ path, width: size.width, height: size.height, bytes: file.size });
    }
    if (assets.length > LIMITS.assetCount) errors.push({ code: 'asset-too-big', message: `at most ${LIMITS.assetCount} images` });
    if (total > LIMITS.assetBytes) errors.push({ code: 'asset-too-big', message: `images add up to more than ${LIMITS.assetBytes / 1024} KB` });
    return { assets, total };
  }

  // ---- whole package ------------------------------------------------------

  function validatePackage(pkg, opts = {}) {
    const errors = [];
    const warnings = [];
    const files = (pkg && pkg.files) || {};
    for (const path of Object.keys(files)) {
      if (!ALLOWED(path)) errors.push({ code: 'unexpected-file', message: `${path} is not allowed in a package` });
    }
    const readme = files['README.md'];
    if (readme && readme.size > LIMITS.readmeBytes) errors.push({ code: 'too-big', message: 'README.md is too long' });

    const props = checkManifest(pkg && pkg.manifest, errors);
    const scene = checkScene(files['scene.js'], errors);
    checkTheme(props, scene, errors, warnings);
    const { assets, total } = checkAssets(files, errors);

    const packageBytes = opts.packageBytes ?? Object.values(files).reduce((s, f) => s + (f.size || 0), 0);
    if (packageBytes > LIMITS.packageBytes) errors.push({ code: 'too-big', message: `package is over ${LIMITS.packageBytes / 1024} KB` });

    const m = (pkg && pkg.manifest) || {};
    const cell = props.find((p) => p.key === 'cell');
    const size = cell ? cell.default : 9;
    const cols = Math.ceil(REFERENCE.width / size);
    const rows = Math.ceil(REFERENCE.height / size);
    const facts = {
      id: m.id,
      name: m.name,
      author: m.author && m.author.name,
      authorURL: m.author && m.author.url,
      version: m.version || 1,
      packageBytes,
      sceneBytes: files['scene.js'] ? files['scene.js'].size : 0,
      assetBytes: total,
      files: Object.keys(files).length,
      assets,
      grid: `${cols} × ${rows} cells at ${REFERENCE.width} × ${REFERENCE.height}, redrawn to fit any display`,
      interactive: Boolean(m.interactive),
      settings: props.length,
    };
    return { ok: errors.length === 0, errors, warnings, facts };
  }

  /** Metrics from the app's --inspect run, judged against the house style. */
  function judgeRender(metrics) {
    const errors = [];
    const warnings = [];
    if (!(metrics.motion >= RENDER.minMotion)) errors.push({ code: 'still', message: 'nothing moves; live wallpapers should drift' });
    if (metrics.flash > RENDER.maxFlash) errors.push({ code: 'flashing', message: 'frames jump in brightness; keep motion slow and calm' });
    if (!(metrics.coverage >= RENDER.minCoverage)) errors.push({ code: 'empty', message: 'almost nothing is drawn' });
    if (metrics.msPerFrame > RENDER.maxMsPerFrame) errors.push({ code: 'heavy', message: `${metrics.msPerFrame.toFixed(1)} ms per frame; keep under ${RENDER.maxMsPerFrame} ms` });
    if (metrics.paletteShare < RENDER.minPaletteShare) errors.push({ code: 'off-theme-palette', message: 'too many colours; official scenes use a small ink palette' });
    if (!WOVEN.includes(metrics.mode)) errors.push({ code: 'off-theme-mode', message: 'renders as raw pixels by default' });
    return { ok: errors.length === 0, errors, warnings };
  }

  const api = Object.freeze({ validatePackage, judgeRender, imageSize, stripComments, isNeon });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TokonomaValidate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
