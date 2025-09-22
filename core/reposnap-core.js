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
const DEFAULT_IGNORE_EXT = /\.(dll|exe|bin|pak|msg|ico)$/i;

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

async function loadIgnore(root, filenames = []) {
  const igEngine = ig();
  for (const file of filenames) {
    if (!file) continue;
    try {
      const filePath = path.isAbsolute(file) ? file : path.join(root, file);
      const txt = await fs.readFile(filePath, "utf8");
      igEngine.add(txt);
    } catch {
      // silently ignore missing/unreadable
    }
  }
  return igEngine;
}

/* ---------------------------
   Existing text-tree builder
   (kept for backward compatibility)
   --------------------------- */
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

  const excludeArray = (opts.excludeArray || []).map((s) => s.trim());
  const extensionsArray = (opts.extensionsArray || []).map((s) => s.trim().toLowerCase());

  const visible = [];
  for (const e of entries) {
    const name = e.name;

    if (defaultIgnore(name)) continue;
    if (excludeArray.length > 0 && excludeArray.includes(name)) continue;

    if (ign) {
      const rel = path.relative(root, path.join(dir, name));
      const relPosix = rel.split(path.sep).join("/");
      if (ign.ignores(relPosix)) continue;
    }

    if (extensionsArray.length > 0 && !e.isDirectory()) {
      const ext = path.extname(name).slice(1).toLowerCase();
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

/* ---------------------------
   Small local helper: getFileStatsLocal
   returns { size, loc, sample, skipped }
   --------------------------- */
async function getFileStatsLocal(filePath, opts = {}) {
  const { maxFileSizeBytes = Infinity, countLoc = false, sampleLines = 0 } = opts;
  try {
    const s = await fs.stat(filePath);
    const size = s.size;
    const skipped = size > maxFileSizeBytes;
    let loc = null;
    let sample = null;
    if (!skipped && (countLoc || sampleLines > 0)) {
      try {
        const txt = await fs.readFile(filePath, "utf8");
        if (countLoc) loc = txt.split(/\r\n|\r|\n/).length;
        if (sampleLines > 0) sample = txt.split(/\r\n|\r|\n/).slice(0, sampleLines).join("\n");
      } catch {
        // unreadable (binary, encoding issues)
        loc = null;
        sample = null;
      }
    }
    return { size, loc, sample, skipped };
  } catch {
    return { size: 0, loc: null, sample: null, skipped: false };
  }
}

/* ---------------------------
   New: buildManifest (recursive)
   returns a hierarchical object suitable for JSON output
   --------------------------- */
async function buildManifest(
  dir,
  depth = Infinity,
  includeFiles = true,
  opts = {},
  ign = null,
  root = dir
) {
  // node structure:
  // directory: { name, path, type:'directory', filesCount, size, children: [...] }
  // file: { name, path, type:'file', size, loc, skipped, sample? }
  if (depth < 0) return null;

  const entries = await readDirSorted(dir);

  const excludeArray = (opts.excludeArray || []).map((s) => s.trim());
  const extensionsArray = (opts.extensionsArray || []).map((s) => s.trim().toLowerCase());

  const visible = [];
  for (const e of entries) {
    const name = e.name;
    if (defaultIgnore(name)) continue;
    if (excludeArray.length > 0 && excludeArray.includes(name)) continue;

    if (ign) {
      const rel = path.relative(root, path.join(dir, name));
      const relPosix = rel.split(path.sep).join("/");
      if (ign.ignores(relPosix)) continue;
    }

    if (extensionsArray.length > 0 && !e.isDirectory()) {
      const ext = path.extname(name).slice(1).toLowerCase();
      if (!extensionsArray.includes(ext)) continue;
    }

    visible.push(e);
  }

  const node = {
    name: path.basename(dir) || ".",
    path: (path.relative(root, dir).split(path.sep).join("/")) || ".",
    type: "directory",
    filesCount: 0,
    size: 0,
    children: []
  };

  for (const e of visible) {
    const name = e.name;
    const full = path.join(dir, name);
    const rel = path.relative(root, full).split(path.sep).join("/");

    if (e.isDirectory()) {
      const child = await buildManifest(full, depth - 1, includeFiles, opts, ign, root);
      if (child) {
        node.children.push(child);
        node.filesCount += child.filesCount || 0;
        node.size += child.size || 0;
      }
    } else if (includeFiles) {
      const stats = await getFileStatsLocal(full, {
        maxFileSizeBytes: opts.maxFileSizeBytes || Infinity,
        countLoc: !!opts.loc,
        sampleLines: opts.sample || 0
      });

      const fileNode = {
        name,
        path: rel,
        type: "file",
        size: stats.size,
        loc: stats.loc,
        skipped: stats.skipped
      };
      if (stats.sample) fileNode.sample = stats.sample;

      node.children.push(fileNode);
      node.filesCount += 1;
      node.size += stats.size || 0;
    }
  }

  return node;
}

/* ---------------------------
   New: high-level API: snapManifest
   normalizes options and returns the manifest object
   --------------------------- */
export async function snapManifest(rootDir = process.cwd(), depth = Infinity, includeFiles = true, opts = {}) {
  const normalized = {
    ...opts,
    excludeArray: opts.exclude
      ? opts.exclude.split(",").map((s) => s.trim())
      : [],
    extensionsArray: opts.extensions
      ? opts.extensions.split(",").map((s) => s.trim().toLowerCase())
      : [],
  };

  // normalize max-file-size (KB -> bytes)
  const maxKB = Number(normalized["max-file-size"] ?? normalized.maxFileSize ?? 200);
  normalized.maxFileSizeBytes = Number.isFinite(maxKB) ? maxKB * 1024 : Infinity;
  normalized.sample = normalized.sample ? Number(normalized.sample) : 0;

  // load ignore files
  const ignoreFilesToTry = [];
  if (opts["ignore-file"] || opts.ignoreFile) {
    ignoreFilesToTry.push(opts["ignore-file"] || opts.ignoreFile);
  } else {
    ignoreFilesToTry.push(".structignore", ".gitignore");
  }
  const ign = await loadIgnore(rootDir, ignoreFilesToTry);

  const manifest = await buildManifest(rootDir, depth, includeFiles, normalized, ign, rootDir);
  return manifest;
}

/* ---------------------------
   New: AI summary generator
   produce a compact, deterministic summary string from a manifest
   --------------------------- */
export async function generateAISummary(manifest, rootDir = process.cwd(), opts = {}) {
  // traverse manifest to gather stats: top-level folders, important files,
  // extension counts, big files list
  const importantFilesSet = new Set(["README", "README.md", "package.json", "Dockerfile", "pyproject.toml", "requirements.txt"]);
  const topFolders = [];
  const importantFiles = [];
  const extensionCounts = new Map();
  const bigFiles = [];

  function walk(n) {
    if (!n) return;
    if (n.type === "directory") {
      if (n.path === "." ) {
        for (const c of n.children || []) {
          if (c.type === "directory") topFolders.push(c.name);
          if (c.type === "file" && importantFilesSet.has(c.name)) importantFiles.push(c.name);
        }
      }
      for (const c of n.children || []) walk(c);
    } else if (n.type === "file") {
      // extension
      const ext = path.extname(n.name).slice(1).toLowerCase() || "none";
      extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);
      bigFiles.push({ path: n.path, size: n.size || 0 });
    }
  }
  walk(manifest);

  bigFiles.sort((a,b)=>b.size - a.size);
  const topBigFiles = bigFiles.slice(0,5);

  // detect package manager & build/test commands by reading package.json if present
  let packageManager = null;
  let buildCmd = null;
  let testCmd = null;
  try {
    // package.json at root?
    const pkgText = await fs.readFile(path.join(rootDir, "package.json"), "utf8").catch(()=>null);
    if (pkgText) {
      const pkg = JSON.parse(pkgText);
      if (pkg.scripts) {
        buildCmd = pkg.scripts.build ?? null;
        testCmd = pkg.scripts.test ?? null;
      }
      // detect lockfile presence
      const hasYarn = await fs.stat(path.join(rootDir, "yarn.lock")).then(()=>true).catch(()=>false);
      const hasPkgLock = await fs.stat(path.join(rootDir, "package-lock.json")).then(()=>true).catch(()=>false);
      if (hasYarn) packageManager = "yarn";
      else if (hasPkgLock) packageManager = "npm";
      else packageManager = "npm (unknown lockfile)";
    } else {
      // python checks
      const hasPoetry = await fs.stat(path.join(rootDir, "pyproject.toml")).then(()=>true).catch(()=>false);
      const hasReq = await fs.stat(path.join(rootDir, "requirements.txt")).then(()=>true).catch(()=>false);
      if (hasPoetry) packageManager = "poetry/pyproject";
      else if (hasReq) packageManager = "pip (requirements.txt)";
    }
  } catch {
    // ignore read errors
  }

  // most common extension heuristic
  const extPairs = [...extensionCounts.entries()];
  extPairs.sort((a,b)=>b[1]-a[1]);
  const topExt = extPairs.length ? extPairs[0][0] : "unknown";

  // Compose summary string
  const lines = [];
  lines.push(`# Repo Summary`);
  lines.push(`Root: ${path.basename(rootDir) || "."}`);
  lines.push("");
  lines.push(`**Top-level folders:** ${topFolders.length ? topFolders.join(", ") : "none detected"}`);
  lines.push(`**Important files present:** ${importantFiles.length ? importantFiles.join(", ") : "none detected"}`);
  lines.push(`**Likely package manager / project type:** ${packageManager || "unknown"}`);
  if (buildCmd) lines.push(`**build**: \`${buildCmd}\``);
  if (testCmd) lines.push(`**test**: \`${testCmd}\``);
  lines.push("");
  lines.push(`**Dominant file type:** ${topExt}`);
  lines.push("");
  if (topBigFiles.length) {
    lines.push(`**Top files by size:**`);
    for (const f of topBigFiles) {
      lines.push(`- ${f.path} — ${f.size} bytes`);
    }
  }
  lines.push("");
  lines.push(`**Suggested AI prompt starter:**`);
  lines.push(
    `\`Repo contains ${manifest.filesCount || "??"} files across ${topFolders.length} top folders. Key entry files: ${importantFiles.join(", ") || "none"}. Use this summary to ask specific tasks.\``
  );

  return lines.join("\n");
}

/* ---------------------------
   Existing snapRepo (text) - unchanged
   --------------------------- */
async function buildLines_old(
  dir,
  prefix = "",
  depth = Infinity,
  includeFiles = true,
  opts = {},
  ign = null,
  root = dir
) {
  // alias to existing buildLines, kept for compatibility
  return buildLines(dir, prefix, depth, includeFiles, opts, ign, root);
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

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  snapRepo().then(console.log).catch(console.error);
}
