import fs from "fs/promises";
import path from "path";
import ig from "ignore";

// Default ignored files/folders
const DEFAULT_IGNORE = [
  ".git",
  "node_modules",
  ".DS_Store",
  "Thumbs.db",
];
const DEFAULT_IGNORE_EXT = /\.(dll|exe|bin|pak|msg|json|ico)$/i;

function defaultIgnore(name) {
  return (
    DEFAULT_IGNORE.includes(name) ||
    name.startsWith(".") ||
    DEFAULT_IGNORE_EXT.test(name)
  );
}

async function readDirSorted(p) {
  const entries = await fs.readdir(p, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

async function buildLines(
  dir,
  prefix = "",
  depth = Infinity,
  includeFiles = true,
  ignoreFn = defaultIgnore,
  ign = null,
  root = dir
) {
  if (depth < 0) return [];
  const entries = await readDirSorted(dir);
  const lines = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rel = path.relative(root, path.join(dir, e.name));

    // Step 3: Apply ignore check
    if (ignoreFn(e.name)) continue;
    if (ign && ign.ignores(rel)) continue;

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
        ignoreFn,
        ign,
        root
      );
      lines.push(...childLines);
    } else if (includeFiles) {
      lines.push(branch + e.name);
    }
  }

  return lines;
}

async function loadIgnore(root, filenames = [".structignore", ".gitignore"]) {
  const igEngine = ig();
  for (const file of filenames) {
    try {
      const txt = await fs.readFile(path.join(root, file), "utf8");
      igEngine.add(txt);
    } catch {
      // file not found, ignore
    }
  }
  return igEngine;
}

export async function snapRepo(
  rootDir = process.cwd(),
  depth = Infinity,
  includeFiles = true,
  ignoreFn = defaultIgnore
) {
  const ign = await loadIgnore(rootDir); // ✅ load ignore engine
  const lines = await buildLines(rootDir, "", depth, includeFiles, ignoreFn, ign, rootDir);
  return lines.join("\n");
}

// Allow running directly via Node for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  snapRepo().then(console.log).catch(console.error);
}
