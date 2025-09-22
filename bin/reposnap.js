#!/usr/bin/env node
import { program } from "commander";
import { snapRepo, snapManifest, generateAISummary } from "../core/reposnap-core.js";

// Configure CLI options
program
  .option("-d, --depth <n>", "max depth", (v) => parseInt(v, 10), Infinity)
  .option("--extensions <exts>", "comma-separated list of extensions to include")
  .option("--exclude <names>", "comma-separated list of file/folder names to exclude")
  .option("--ignore-file <file>", "custom ignore file", ".structignore")
  .option("--format <fmt>", "output format: plain|markdown|json|ai", "plain")
  .option("--size", "include file sizes and directory total sizes")
  .option("--loc", "include LOC per file (may skip large files)")
  .option("--counts", "include number of files per directory")
  .option("--max-file-size <kb>", "skip LOC/sample for files larger than this (KB)", (v) => parseInt(v, 10), 200)
  .option("--sample <n>", "include first N lines of important files (README/package.json/Dockerfile)", (v) => parseInt(v, 10))
  .parse(process.argv);

const options = program.opts();

(async () => {
  try {
    const format = (options.format || "plain").toLowerCase();

    if (format === "json") {
      // produce JSON manifest
      const manifest = await snapManifest(process.cwd(), options.depth, true, options);
      console.log(JSON.stringify(manifest, null, 2));
    } else if (format === "ai") {
      // generate AI summary (from manifest)
      const manifest = await snapManifest(process.cwd(), options.depth, true, options);
      const summary = await generateAISummary(manifest, process.cwd(), options);
      console.log(summary);
    } else {
      // fallback to text tree
      const snapshot = await snapRepo(process.cwd(), options.depth, true, options);
      if (format === "markdown") {
        console.log("```");
        console.log(snapshot);
        console.log("```");
      } else {
        console.log(snapshot);
      }
    }
  } catch (e) {
    console.error("RepoSnap error:", e.message || e);
    process.exit(1);
  }
})();
