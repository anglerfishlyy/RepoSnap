#!/usr/bin/env node
import { program } from "commander";
import { snapRepo } from "../core/reposnap-core.js";
import path from "path";

program
  .option("-d, --depth <n>", "max depth", (v) => parseInt(v, 10), Infinity)
  .option("--extensions <exts>", "comma-separated list of extensions to include")
  .option("--exclude <names>", "comma-separated list of file/folder names to exclude")
  .option("--ignore-file <file>", "custom ignore file", ".structignore");

program.parse(process.argv);
const options = program.opts();

(async () => {
  try {
    // Pass the raw options object to snapRepo; snapRepo will normalize.
    const snapshot = await snapRepo(process.cwd(), options.depth, true, options);
    console.log(snapshot);
  } catch (e) {
    console.error("RepoSnap error:", e?.message ?? String(e));
    process.exit(1);
  }
})();
