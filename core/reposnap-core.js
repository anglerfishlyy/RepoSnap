// core/reposnap-core.js
import fs from "fs/promises";
import path from "path";
import ig from "ignore";

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

/**
 * Load ignore rules from a list of filenames (relative to root).
 * If filenames is empty or missing, nothing is loaded.
 */
async function loadIgnore(root, filenames = []) {
  const igEngine = ig();
  for (const file of filenames) {
    if (!file) continue;
    try {
      // support absolute or relative passed filename
      const filePath = path.isAbsolute(file) ? file : path.join(root, file);
      const txt = await fs.readFile(filePath, "utf8");
      igEngine.add(txt);
    } catch {
      // file not found / unreadable -> ignore silently
    }
  }
  return igEngine;
}

async function buildLines(
  dir,
  prefix = "",
  depth = Infinity,
  includeFiles = true,
  opts = {},
  ign = null,
  root = dir
) {
  if (depth < 0) return [];
  const entries = await readDirSorted(dir);
  const lines = [];

  // Normalized option arrays (already prepared in snapRepo normally,
  // but double-check here for safety)
  const excludeArray = (opts.excludeArray || []).map((s) => s.trim());
  const extensionsArray = (opts.extensionsArray || []).map((s) => s.trim().toLowerCase());

  // Pre-filter visible entries at this level so we can compute "isLast"
  const visible = [];
  for (const e of entries) {
    const name = e.name;

    // Default ignores (dotfiles, .git, node_modules, binary ext)
    if (defaultIgnore(name)) continue;

    // exclude by name
    if (excludeArray.length > 0 && excludeArray.includes(name)) continue;

    // ignore engine (.gitignore / .structignore)
    if (ign) {
      const rel = path.relative(root, path.join(dir, name));
      // ensure posix-style path for ignore matching
      const relPosix = rel.split(path.sep).join("/");
      if (ign.ignores(relPosix)) continue;
    }

    // extension filter: if extensionsArray is set, only allow files with those extensions
    if (extensionsArray.length > 0 && !e.isDirectory()) {
      const ext = path.extname(name).slice(1).toLowerCase(); // without dot
      if (!extensionsArray.includes(ext)) continue;
    }

    visible.push(e);
  }

  for (let i = 0; i < visible.length; i++) {
    const e = visible[i];
    const name = e.name;
    const rel = path.relative(root, path.join(dir, name));
    const relPosix = rel.split(path.sep).join("/");

    const isLast = i === visible.length - 1;
    const branch = prefix + (isLast ? "└── " : "├── ");

    if (e.isDirectory()) {
      lines.push(branch + "📂 " + name);
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      const childLines = await buildLines(
        path.join(dir, name),
        childPrefix,
        depth - 1,
        includeFiles,
        opts,
        ign,
        root
      );
      lines.push(...childLines);
    } else if (includeFiles) {
      lines.push(branch + name);
    }
  }

  return lines;
}

export async function snapRepo(
  rootDir = process.cwd(),
  depth = Infinity,
  includeFiles = true,
  opts = {}
) {
  // Normalize opts (ensure we have arrays ready)
  const normalized = {
    ...opts,
    excludeArray: opts.exclude
      ? opts.exclude.split(",").map((s) => s.trim())
      : [],
    extensionsArray: opts.extensions
      ? opts.extensions.split(",").map((s) => s.trim().toLowerCase())
      : [],
  };

  // load ignores: if user provided --ignore-file, prefer that (single file),
  // otherwise load .structignore then .gitignore
  const ignoreFilesToTry = [];
  if (opts["ignore-file"] || opts.ignoreFile) {
    // user-specified name (could be '.structignore' by default)
    ignoreFilesToTry.push(opts["ignore-file"] || opts.ignoreFile);
  } else {
    ignoreFilesToTry.push(".structignore", ".gitignore");
  }

  const ign = await loadIgnore(rootDir, ignoreFilesToTry);

  const lines = await buildLines(rootDir, "", depth, includeFiles, normalized, ign, rootDir);
  return lines.join("\n");
}

// Allow running core directly for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  snapRepo().then(console.log).catch(console.error);
}
