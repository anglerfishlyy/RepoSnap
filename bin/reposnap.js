#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import clipboardy from 'clipboardy';
import { program } from 'commander';

// Folders we always ignore
const IGNORE_DIRS = ['.git', 'node_modules'];

program
  .option('-d, --depth <n>', 'max depth', parseInt)
  .option('--no-files', 'exclude files')
  .parse(process.argv);

const opts = program.opts();

async function readDirSorted(p) {
  const entries = await fs.readdir(p, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

function shouldIgnore(name) {
  return IGNORE_DIRS.includes(name);
}

async function buildLines(dir, prefix = '', depth = Infinity, includeFiles = true) {
  if (depth < 0) return [];
  const entries = await readDirSorted(dir);
  const lines = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (shouldIgnore(e.name)) continue;  // 🚀 skip ignored dirs

    const isLast = i === entries.length - 1;
    const branch = prefix + (isLast ? '└── ' : '├── ');

    if (e.isDirectory()) {
      lines.push(branch + '📂 ' + e.name);
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      const childLines = await buildLines(path.join(dir, e.name), childPrefix, depth - 1, includeFiles);
      lines.push(...childLines);
    } else if (includeFiles) {
      lines.push(branch + e.name);
    }
  }

  return lines;
}

const root = process.cwd();
const lines = await buildLines(root, '', (opts.depth === undefined ? Infinity : opts.depth), opts.files);
const ascii = lines.join('\n');
console.log(ascii);

try {
  await clipboardy.write(ascii);   // ✅ async API
  console.log('\n[RepoSnap] copied to clipboard ✔️');
} catch (err) {
  console.error('[RepoSnap] Failed to copy to clipboard:', err.message);
}
