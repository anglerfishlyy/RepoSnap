import fs from "fs/promises";
import path from "path";

const IGNORE_DIRS = [".git", "node_modules"];

async function readDirSorted(p) {
  const entries = await fs.readdir(p, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

function defaultIgnore(name) {
  // Ignore git, node_modules, hidden files/folders
  return IGNORE_DIRS.includes(name) || name.startsWith(".");
}

async function buildLines(
  dir,
  prefix = "",
  depth = Infinity,
  includeFiles = true,
  ignoreFn = defaultIgnore
) {
  if (depth < 0) return [];
  const entries = await readDirSorted(dir);
  const lines = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (ignoreFn(e.name)) continue; // use ignoreFn

    const isLast = i === entries.length - 1;
    const branch = prefix + (isLast ? "└── " : "├── ");

    if (e.isDirectory()) {
      lines.push(branch + "📂 " + e.name);
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      const childLines = await buildLines(
        path.join(dir, e.name),
        childPrefix,
        depth - 1,
        includeFiles,
        ignoreFn
      );
      lines.push(...childLines);
    } else if (includeFiles) {
      lines.push(branch + e.name);
    }
  }

  return lines;
}

export async function snapRepo(rootDir = process.cwd(), depth = Infinity, includeFiles = true, ignoreFn) {
  const lines = await buildLines(rootDir, "", depth, includeFiles, ignoreFn);
  return lines.join("\n");
}
