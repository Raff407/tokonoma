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
  const { LIMITS, RENDER, SAFETY, WOVEN, MODES, REFERENCE } = R;

  const ID = /^[a-z0-9][a-z0-9-]{2,39}$/;
  const ASSET = /^assets\/[a-z0-9][a-z0-9._-]{0,60}\.(png|jpe?g|webp)$/;
  const MEDIA = /^media\.(mp4|jpe?g|png|webp)$/;
  const ALLOWED = (path) => path === 'scene.js' || path === 'README.md' || ASSET.test(path);
  const ALLOWED_MEDIA = (path) => path === 'README.md' || MEDIA.test(path);

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
    ['dynamic-lookup', /\b(?:window|globalThis|self|this|document|navigator)\s*\[|\bReflect\s*\.|\bnew\s+Proxy\b|\b(?:atob|btoa)\s*\(/, 'looks things up by computed name'],
    // (0).constructor.constructor is Function by another name.
    ['code-from-strings', /\.\s*constructor\b|\[\s*['"`]constructor['"`]\s*\]|__proto__|\bgetPrototypeOf\b/, 'reaches for constructors (a way to build code from strings)'],
    ['frames', /\biframe\b|\bframes\b|\bcontentWindow\b|\bopener\b|\bparent\s*\./, 'uses frames or other windows'],
    ['peer-network', /WebTransport|RTC[A-Z]\w*|\bwebkit[A-Z]\w*/, 'opens peer connections'],
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

  // Invisible and direction-flipping characters let a name read differently than it is.
  const SPOOFY = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;
  // Nobody can publish as the app itself or claim a review that never happened.
  const RESERVED = /tokonoma|official|verified|anthropic|\bapple\b|\bsupport\b|\badmin/i;

  function checkManifest(m, errors) {
    const bad = (why) => errors.push({ code: 'bad-manifest', message: why });
    if (!m || typeof m !== 'object') return bad('wallpaper.json is missing or not an object');
    const shown = [m.name, m.title, m.description, m.author && m.author.name, m.author && m.author.url];
    if (shown.some((v) => typeof v === 'string' && SPOOFY.test(v))) bad('names and descriptions can\'t contain invisible or direction-changing characters');
    if (m.author && typeof m.author.name === 'string' && RESERVED.test(m.author.name)) {
      errors.push({ code: 'impersonation', message: `"${m.author.name}" sounds like Tokonoma or a reviewer; publish under your own name` });
    }
    if (typeof m.name === 'string' && /tokonoma|official|verified/i.test(m.name)) {
      errors.push({ code: 'impersonation', message: 'wallpaper names can\'t claim to be official or verified' });
    }
    if (typeof m.id !== 'string' || !ID.test(m.id)) bad('id must be 3–40 lowercase letters, digits or dashes');
    if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 40) bad('name must be 1–40 characters');
    if (m.title !== undefined && (typeof m.title !== 'string' || m.title.length > 12)) bad('title must be at most 12 characters');
    // The version names files in the registry, so it is a plain whole number and nothing else.
    if (m.version !== undefined && !(Number.isInteger(m.version) && m.version >= 1 && m.version <= 1e6)) bad('version must be a whole number from 1 to 1000000');
    if (m.description !== undefined && (typeof m.description !== 'string' || m.description.length > 240)) bad('description must be at most 240 characters');
    if (m.kind !== undefined && m.kind !== 'media') bad('kind must be "media" or left out for a scene');
    if (m.kind !== 'media' && m.media !== undefined) bad('a scene can\'t carry a media file; share it as kind "media"');
    if (m.kind === 'media' && (typeof m.media !== 'string' || !MEDIA.test(m.media))) bad('media must be media.mp4, media.jpg, media.png or media.webp');
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

  function checkTheme(props, scene, errors, warnings, isMedia) {
    const mode = props.find((p) => p.key === 'mode');
    const offered = isMedia ? WOVEN : MODES;
    if (!mode || mode.type !== 'choice' || !mode.options.every((o) => offered.includes(o)) || !WOVEN.includes(mode.default)) {
      errors.push({
        code: 'off-theme-mode',
        message: isMedia
          ? 'shared media is always woven: the "mode" choice may only offer glyph, block or dot'
          : 'declare a "mode" choice whose default is glyph, block or dot',
      });
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
    // Checked on the source with and without comments: the comment stripper can be
    // fooled (a "//" inside a regex literal), so hiding code behind it doesn't help.
    for (const [codeName, pattern, why] of FORBIDDEN) {
      if (pattern.test(code)) errors.push({ code: codeName, message: `scene.js ${why}` });
      else if (pattern.test(file.text)) errors.push({ code: codeName, message: `scene.js mentions something that ${why} in a comment; reword it (comments are checked too)` });
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

  // ---- media --------------------------------------------------------------

  /** Duration and frame size from an MP4/MOV header (moov must come first). */
  function clipInfo(bytes) {
    const b = bytes;
    const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const tag = (i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    if (b.length < 12 || tag(4) !== 'ftyp') return null;
    const info = { width: 0, height: 0, seconds: null, sound: false };
    const walk = (start, end) => {
      let i = start;
      while (i + 8 <= end) {
        let size = u32(i);
        const type = tag(i + 4);
        let body = i + 8;
        if (size === 1) { size = u32(i + 8) * 2 ** 32 + u32(i + 12); body = i + 16; }
        if (size === 0) size = end - i;
        if (size < 8) return;
        const stop = Math.min(i + size, end);
        if (type === 'moov' || type === 'trak' || type === 'mdia') walk(body, stop);
        else if (type === 'mvhd' && body + 24 <= stop) {
          const v1 = b[body] === 1;
          const scale = u32(body + (v1 ? 20 : 12));
          const length = v1 ? u32(body + 24) * 2 ** 32 + u32(body + 28) : u32(body + 16);
          if (scale) info.seconds = length / scale;
        } else if (type === 'tkhd') {
          const at = body + (b[body] === 1 ? 88 : 76);
          if (at + 8 <= stop) {
            info.width = Math.max(info.width, u32(at) / 65536);
            info.height = Math.max(info.height, u32(at + 4) / 65536);
          }
        } else if (type === 'hdlr' && body + 12 <= stop && tag(body + 8) === 'soun') info.sound = true;
        i += size;
      }
    };
    walk(0, b.length);
    return info;
  }

  function checkMedia(m, files, errors) {
    const name = typeof m.media === 'string' ? m.media : '';
    const file = files[name];
    if (!MEDIA.test(name)) return null;
    if (!file || !file.bytes) {
      errors.push({ code: 'bad-media', message: `${name} is missing from the package` });
      return null;
    }
    if (file.size > LIMITS.mediaBytes) errors.push({ code: 'too-big', message: `${name} is over ${LIMITS.mediaBytes / 1024 / 1024} MB` });
    if (name.endsWith('.mp4')) {
      const clip = clipInfo(file.bytes);
      if (!clip || !clip.width || clip.seconds === null) {
        errors.push({ code: 'bad-media', message: `${name} is not a readable MP4 (its header has to come first)` });
        return null;
      }
      if (Math.max(clip.width, clip.height) > LIMITS.clipSide) errors.push({ code: 'too-big', message: `the clip is ${clip.width}×${clip.height}; keep it within ${LIMITS.clipSide}px` });
      if (clip.seconds > LIMITS.clipSeconds + 0.5) errors.push({ code: 'too-long', message: `the clip runs ${Math.round(clip.seconds)} s; keep it under ${LIMITS.clipSeconds} s` });
      if (clip.sound) errors.push({ code: 'sound', message: 'wallpapers are silent; share the clip without its audio track' });
      return { type: 'clip', width: clip.width, height: clip.height, seconds: Math.round(clip.seconds * 10) / 10, bytes: file.size };
    }
    const size = imageSize(file.bytes);
    if (!size) {
      errors.push({ code: 'bad-media', message: `${name} is not a real PNG, JPEG or WebP image` });
      return null;
    }
    if (Math.max(size.width, size.height) > LIMITS.stillSide) errors.push({ code: 'too-big', message: `the picture is ${size.width}×${size.height}; keep it within ${LIMITS.stillSide}px` });
    return { type: 'picture', width: size.width, height: size.height, seconds: null, bytes: file.size };
  }

  // ---- whole package ------------------------------------------------------

  function validatePackage(pkg, opts = {}) {
    const errors = [];
    const warnings = [];
    const files = (pkg && pkg.files) || {};
    const m = (pkg && pkg.manifest) || {};
    const isMedia = m.kind === 'media';
    const allowed = isMedia ? ALLOWED_MEDIA : ALLOWED;
    for (const path of Object.keys(files)) {
      if (!allowed(path)) errors.push({ code: 'unexpected-file', message: `${path} is not allowed in a ${isMedia ? 'media' : 'scene'} package` });
    }
    const readme = files['README.md'];
    if (readme && readme.size > LIMITS.readmeBytes) errors.push({ code: 'too-big', message: 'README.md is too long' });

    const props = checkManifest(pkg && pkg.manifest, errors);
    const scene = isMedia ? '' : checkScene(files['scene.js'], errors);
    checkTheme(props, scene, errors, warnings, isMedia);
    const { assets, total } = isMedia ? { assets: [], total: 0 } : checkAssets(files, errors);
    const media = isMedia ? checkMedia(m, files, errors) : null;

    const packageBytes = opts.packageBytes ?? Object.values(files).reduce((s, f) => s + (f.size || 0), 0);
    const limit = isMedia ? LIMITS.mediaPackageBytes : LIMITS.packageBytes;
    if (packageBytes > limit) errors.push({ code: 'too-big', message: `package is over ${Math.round(limit / 1024)} KB` });

    const cell = props.find((p) => p.key === 'cell');
    const size = cell ? cell.default : 9;
    const cols = Math.ceil(REFERENCE.width / size);
    const rows = Math.ceil(REFERENCE.height / size);
    const facts = {
      id: m.id,
      name: m.name,
      kind: isMedia ? 'media' : 'scene',
      author: m.author && m.author.name,
      authorURL: m.author && m.author.url,
      version: m.version || 1,
      packageBytes,
      sceneBytes: files['scene.js'] ? files['scene.js'].size : 0,
      assetBytes: total,
      files: Object.keys(files).length,
      assets,
      media,
      grid: `${cols} × ${rows} cells at ${REFERENCE.width} × ${REFERENCE.height}, redrawn to fit any display`,
      interactive: Boolean(m.interactive) && !isMedia,
      settings: props.length,
    };
    return { ok: errors.length === 0, errors, warnings, facts };
  }

  /** The app's nudity screen over sampled frames: { nsfw: worst score 0–1, frames }. */
  function judgeScreen(screen) {
    const errors = [];
    if (!screen || !(screen.frames >= SAFETY.minFrames) || typeof screen.nsfw !== 'number') {
      errors.push({ code: 'unscreened', message: 'the safety screen didn\'t run on this wallpaper' });
    } else if (screen.nsfw > SAFETY.maxNsfw) {
      errors.push({ code: 'nsfw', message: 'it looks like it may show nudity or sexual content, which the marketplace doesn\'t allow' });
    }
    return { ok: errors.length === 0, errors, warnings: [] };
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
    if (typeof metrics.nsfw === 'number' && metrics.nsfw > SAFETY.maxNsfw) {
      errors.push({ code: 'nsfw', message: 'the render looks like it may show nudity or sexual content, which the marketplace doesn\'t allow' });
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  const api = Object.freeze({ validatePackage, judgeRender, judgeScreen, imageSize, clipInfo, stripComments, isNeon });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TokonomaValidate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
