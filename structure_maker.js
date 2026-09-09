// FILE: structure_maker.js  (root)
// Scans the project root and writes project_structure.json
// Pure directory tree — no descriptions, no types, just files and folders.
// Overwrites on every server start.
'use strict';

const fs   = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
    'node_modules', '.git', '.cache', '.npm', '.npm-global',
    '.config', '.local', 'logs', 'tmp', 'temp', 'coverage', 'dist', 'build'
]);

const SKIP_EXTENSIONS = new Set([
    '.log', '.pak', '.hyb', '.dat', '.pb', '.so',
    '.bin', '.exe', '.snap', '.map', '.lock'
]);

const SKIP_FILES = new Set([
    '.DS_Store', 'Thumbs.db', '.npmrc', '.wget-hsts',
    'package-lock.json', 'yarn.lock'
]);

function skip(name, isDir) {
    if (name.startsWith('.')) return true;
    if (isDir)  return SKIP_DIRS.has(name);
    if (SKIP_FILES.has(name)) return true;
    return SKIP_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function scan(dir) {
    const result = {};
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return result; }

    // folders first, then files — both sorted A-Z
    const dirs  = entries.filter(e => e.isDirectory() && !skip(e.name, true))
                         .sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter(e => e.isFile() && !skip(e.name, false))
                         .sort((a, b) => a.name.localeCompare(b.name));

    for (const d of dirs)  result[d.name] = scan(path.join(dir, d.name));
    for (const f of files) result[f.name] = null;

    return result;
}

function generateStructure(projectRoot) {
    projectRoot = projectRoot || path.resolve(__dirname);
    const outPath = path.join(projectRoot, 'project_structure.json');

    console.log('[Structure] 📂 Scanning project...');
    const tree = scan(projectRoot);

    try {
        fs.writeFileSync(outPath, JSON.stringify(tree, null, 2), 'utf8');
        console.log('[Structure] ✅ project_structure.json updated');
    } catch (e) {
        console.error('[Structure] ❌ Failed to write:', e.message);
    }
}

module.exports = { generateStructure };
