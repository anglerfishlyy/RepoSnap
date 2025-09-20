#!/usr/bin/env node
import { program } from "commander";
import { snapRepo } from "../core/reposnap-core.js";
import path from "path";

// Configure CLI options
program
  .option("-d, --depth <n>", "max depth", (v) => parseInt(v, 10), Infinity)
  .option("--extensions <exts>", "comma-separated list of extensions to include")
  .option("--exclude <names>", "comma-separated list of file/folder names to exclude")
  .option("--ignore-file <file>", "custom ignore file", ".structignore");

program.parse(process.argv);
const options = program.opts();

// Build custom ignore function
function makeIgnoreFn(excludes = [], extensions = []) {
  return function (name) {
    // Exclude list
    if (excludes.includes(name)) return true;
    // Extension filter (if set, only include those extensions)
    if (extensions.length > 0) {
      const ext = path.extname(name).slice(1); // remove dot
      if (ext && !extensions.includes(ext)) return true;
    }
    return false;
  };
}

const excludes = options.exclude ? options.exclude.split(",").map((s) => s.trim()) : [];
const extensions = options.extensions ? options.extensions.split(",").map((s) => s.trim()) : [];

const ignoreFn = makeIgnoreFn(excludes, extensions);

(async () => {
  try {
    const snapshot = await snapRepo(process.cwd(), options.depth, true, ignoreFn);
    console.log(snapshot);
  } catch (e) {
    console.error("RepoSnap error:", e.message || e);
    process.exit(1);
  }
})();
