/*
 * Studio helpers: start a new wallpaper from the template, and run the
 * installed app headless to render and measure one (the same WebKit engine
 * the desktop uses, so the numbers are the real ones).
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TEMPLATE = path.join(__dirname, '..', 'template');
const KASURI = path.join(__dirname, '..', '..', 'Wallpapers', '_lib');
const ID = /^[a-z0-9][a-z0-9-]{2,39}$/;

function studioRoot() {
  return process.env.TOKONOMA_STUDIO || path.join(os.homedir(), 'Tokonoma Studio');
}

function registryRoot() {
  return process.env.TOKONOMA_REGISTRY || path.join(os.homedir(), 'Library', 'Application Support', 'Tokonoma', 'Registry');
}

/** Creates <folder>/<id> from the template; refuses to overwrite anything. */
function newWallpaper({ id, name, author, title = '', description = '', folder }) {
  if (!ID.test(id || '')) throw new Error('id must be 3–40 lowercase letters, digits or dashes');
  if (!name || !author) throw new Error('name and author are required');
  const dir = path.join(folder || studioRoot(), id);
  if (fs.existsSync(dir)) throw new Error(`${dir} already exists`);
  fs.mkdirSync(path.join(dir, '.kasuri'), { recursive: true });
  const fill = (text) => text
    .replaceAll('{{id}}', id)
    .replaceAll('{{name}}', escapeJSON(name))
    .replaceAll('{{author}}', escapeJSON(author))
    .replaceAll('{{title}}', escapeJSON(title))
    .replaceAll('{{description}}', escapeJSON(description || `${name}, woven for Tokonoma.`));
  for (const file of fs.readdirSync(TEMPLATE).filter((f) => !f.startsWith('.'))) {
    fs.writeFileSync(path.join(dir, file), fill(fs.readFileSync(path.join(TEMPLATE, file), 'utf8')));
  }
  for (const lib of ['kasuri-core.js', 'kasuri.js', 'sky.js']) {
    fs.copyFileSync(path.join(KASURI, lib), path.join(dir, '.kasuri', lib));
  }
  return dir;
}

function escapeJSON(text) {
  return JSON.stringify(String(text)).slice(1, -1);
}

/** TOKONOMA_APP picks the binary outright ("none" turns render checks off). */
function findApp() {
  const chosen = process.env.TOKONOMA_APP;
  if (chosen) return chosen !== 'none' && fs.existsSync(chosen) ? chosen : null;
  const candidates = [
    '/Applications/Tokonoma.app/Contents/MacOS/Tokonoma',
    path.join(__dirname, '..', '..', 'build', 'Tokonoma.app', 'Contents', 'MacOS', 'Tokonoma'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**
 * Renders the folder in the app's hidden WebKit view.
 * Returns { metrics, image } (image is a JPEG path) or null when the app isn't installed.
 */
function inspect(folder) {
  const app = findApp();
  if (!app) return null;
  const image = path.join(os.tmpdir(), `tokonoma-preview-${process.pid}-${Date.now()}.jpg`);
  const run = spawnSync(app, ['--inspect', path.resolve(folder), '--out', image], { encoding: 'utf8', timeout: 45000 });
  if (run.error) throw new Error(`Couldn't run Tokonoma: ${run.error.message}`);
  const line = (run.stdout || '').trim().split('\n').pop() || '{}';
  const result = JSON.parse(line);
  if (result.error) throw new Error(result.error);
  return { metrics: result.metrics, image };
}

module.exports = { studioRoot, registryRoot, newWallpaper, findApp, inspect };
