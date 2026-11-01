/*
 * The .tokonoma package: one JSON document.
 *
 *   { "format": "tokonoma-package", "formatVersion": 1,
 *     "sha256": "<hex of the UTF-8 bytes of body>",
 *     "body": "<JSON string of { manifest, files }>" }
 *
 * Hashing the body string as-is means Node, the registry and the Swift app
 * all verify the exact same bytes with no canonical-JSON dance, and there is
 * no archive to extract, so no path tricks hidden in a zip.
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const V = require('./validate.js');

const FORMAT = 'tokonoma-package';
const FORMAT_VERSION = 1;
// Files that live in an author's folder for local preview but never ship.
const SKIP = new Set(['index.html', 'preview.png']);

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Reads an authoring folder into the in-memory shape the validator takes. */
function readFolder(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'wallpaper.json'), 'utf8'));
  const files = {};
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(dir, rel))) {
      const relPath = rel ? `${rel}/${name}` : name;
      const full = path.join(dir, relPath);
      if (name.startsWith('.') || (!rel && (SKIP.has(name) || name === 'wallpaper.json'))) continue;
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(relPath);
      else if (/\.(js|md)$/.test(name)) files[relPath] = { size: stat.size, text: fs.readFileSync(full, 'utf8') };
      else files[relPath] = { size: stat.size, bytes: new Uint8Array(fs.readFileSync(full)) };
    }
  };
  walk('');
  return { manifest, files };
}

/** In-memory package → .tokonoma text. Does not validate; `pack` does. */
function encode(pkg) {
  const files = {};
  for (const [p, f] of Object.entries(pkg.files)) {
    files[p] = typeof f.text === 'string'
      ? { encoding: 'utf8', data: f.text }
      : { encoding: 'base64', data: Buffer.from(f.bytes).toString('base64') };
  }
  const body = JSON.stringify({ manifest: pkg.manifest, files });
  return JSON.stringify({ format: FORMAT, formatVersion: FORMAT_VERSION, sha256: sha256(body), body });
}

/** .tokonoma text → in-memory package, after checking the envelope and hash. */
function unpack(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('This is not a Tokonoma package.');
  }
  if (!doc || doc.format !== FORMAT || typeof doc.body !== 'string') throw new Error('This is not a Tokonoma package.');
  if (doc.formatVersion !== FORMAT_VERSION) throw new Error(`Package format ${doc.formatVersion} is not supported.`);
  if (sha256(doc.body) !== doc.sha256) throw new Error('The package contents do not match its fingerprint; it may have been altered.');
  const body = JSON.parse(doc.body);
  const files = {};
  for (const [p, f] of Object.entries(body.files || {})) {
    if (f.encoding === 'utf8') files[p] = { size: Buffer.byteLength(f.data, 'utf8'), text: f.data };
    else if (f.encoding === 'base64') {
      const bytes = new Uint8Array(Buffer.from(f.data, 'base64'));
      files[p] = { size: bytes.length, bytes };
    } else throw new Error(`Unknown encoding for ${p}.`);
  }
  return { manifest: body.manifest, files, sha256: doc.sha256 };
}

/** Folder → validated package text. Throws with every problem listed. */
function pack(dir) {
  const pkg = readFolder(dir);
  const draft = encode(pkg);
  const report = V.validatePackage(pkg, { packageBytes: Buffer.byteLength(draft, 'utf8') });
  if (!report.ok) {
    throw new Error('Not packed:\n' + report.errors.map((e) => `- ${e.code}: ${e.message}`).join('\n'));
  }
  return { text: draft, report };
}

module.exports = { FORMAT, FORMAT_VERSION, sha256, readFolder, encode, unpack, pack };
