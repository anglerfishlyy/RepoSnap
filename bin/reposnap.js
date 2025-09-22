#!/usr/bin/env node
import { program } from "commander";
import { snapRepo } from "../core/reposnap-core.js";

// Configure CLI options
program
  .option("-d, --depth <n>", "max depth", (v) => parseInt(v, 10), Infinity)
  .option("--extensions <exts>", "comma-separated list of extensions to include")
  .option("--exclude <names>", "comma-separated list of file/folder names to exclude")
  .option("--ignore-file <file>", "custom ignore file", ".structignore")
  .option("--format <fmt>", "output format: plain or markdown", "plain")
  .option("--size", "show file sizes")
  .option("--loc", "count lines of code per file")
  .option("--counts", "show summary counts (files, folders, total LOC)")
  .option("--sample <n>", "include a content sample (first N lines per file)", (v) => parseInt(v, 10), 0);
program.parse(process.argv);
const options = program.opts();

(async () => {
  try {
    const snapshot = await snapRepo(process.cwd(), options.depth, true, options);

    if (options.format === "markdown") {
      console.log("```");
      console.log(snapshot);
      console.log("```");
    } else {
      console.log(snapshot);
    }
  } catch (e) {
    console.error("RepoSnap error:", e.message || e);
    process.exit(1);
  }
})();
