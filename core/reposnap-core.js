import fs from "fs/promises";
import path from "path";
import ig from "ignore";
import fsExtra from "fs";

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

async function getFileStats(filePath, opts) {
  const stats = await fs.stat(filePath);
  const size = stats.size;

  let loc = 0;
  let sample = "";

  if (opts.loc || opts.sample > 0) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      if (opts.loc) {
        loc = content.split(/\r?\n/).length;
      }
      if (opts.sample > 0) {
        sample = content.split(/\r?\n/).slice(0, opts.sample).join("\n");
      }
    } catch {
      // ignore binary/unreadable files
    }
  }

  return { size, loc, sample };
}

export async function snapRepo(
  rootDir = process.cwd(),
  depth = Infinity,
  includeFiles = true,
  opts = {}
) {
  const normalized = {
    ...opts,
    excludeArray: opts.exclude
      ? opts.exclude.split(",").map((s) => s.trim())
      : [],
    extensionsArray: opts.extensions
      ? opts.extensions.split(",").map((s) => s.trim().toLowerCase())
      : [],
  };

  const ignoreFilesToTry = [];
  if (opts["ignore-file"] || opts.ignoreFile) {
    ignoreFilesToTry.push(opts["ignore-file"] || opts.ignoreFile);
  } else {
    ignoreFilesToTry.push(".structignore", ".gitignore");
  }
  const ign = await loadIgnore(rootDir, ignoreFilesToTry);

  const lines = [];
  let fileCount = 0, folderCount = 0, totalLOC = 0, totalSize = 0;

  async function walk(dir, prefix = "", depthLeft = depth) {
    if (depthLeft < 0) return;
    const entries = await readDirSorted(dir);
    const visible = [];

    for (const e of entries) {
      const name = e.name;
      if (defaultIgnore(name)) continue;
      if (normalized.excludeArray.includes(name)) continue;

      const rel = path.relative(rootDir, path.join(dir, name));
      const relPosix = rel.split(path.sep).join("/");
      if (ign.ignores(relPosix)) continue;

      if (normalized.extensionsArray.length > 0 && !e.isDirectory()) {
        const ext = path.extname(name).slice(1).toLowerCase();
        if (!normalized.extensionsArray.includes(ext)) continue;
      }
      visible.push(e);
    }

    for (let i = 0; i < visible.length; i++) {
      const e = visible[i];
      const name = e.name;
      const isLast = i === visible.length - 1;
      const branch = prefix + (isLast ? "└── " : "├── ");

      if (e.isDirectory()) {
        folderCount++;
        lines.push(branch + "📂 " + name);
        await walk(path.join(dir, name), prefix + (isLast ? "    " : "│   "), depthLeft - 1);
      } else {
        fileCount++;
        let line = branch + name;

        if (opts.size || opts.loc || opts.sample > 0) {
          const stats = await getFileStats(path.join(dir, name), opts);
          if (opts.size) line += ` (${stats.size} bytes)`;
          if (opts.loc) line += ` [${stats.loc} LOC]`;
          if (opts.sample > 0 && stats.sample) {
            line += `\n${prefix}    --- sample ---\n` +
              stats.sample
                .split("\n")
                .map((l) => prefix + "    " + l)
                .join("\n") +
              "\n" + prefix + "    --- end sample ---";
          }
          totalSize += stats.size;
          totalLOC += stats.loc;
        }

        lines.push(line);
      }
    }
  }

  await walk(rootDir);

  if (opts.counts) {
    lines.push("");
    lines.push(`📊 Summary: ${fileCount} files, ${folderCount} folders, ${totalLOC} total LOC, ${totalSize} bytes`);
  }

  return lines.join("\n");
}
