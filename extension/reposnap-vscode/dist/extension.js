"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../core/reposnap-core.js
var reposnap_core_exports = {};
__export(reposnap_core_exports, {
  snapRepo: () => snapRepo
});
function defaultIgnore(name) {
  return DEFAULT_IGNORE.includes(name) || name.startsWith(".") || DEFAULT_IGNORE_EXT.test(name);
}
async function readDirSorted(p) {
  const entries = await import_promises.default.readdir(p, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}
async function buildLines(dir, prefix = "", depth = Infinity, includeFiles = true, ignoreFn = defaultIgnore) {
  if (depth < 0) return [];
  const entries = await readDirSorted(dir);
  const lines = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (ignoreFn(e.name)) continue;
    const isLast = i === entries.length - 1;
    const branch = prefix + (isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ");
    if (e.isDirectory()) {
      lines.push(branch + "\u{1F4C2} " + e.name);
      const childPrefix = prefix + (isLast ? "    " : "\u2502   ");
      const childLines = await buildLines(
        import_path.default.join(dir, e.name),
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
async function snapRepo(rootDir = process.cwd(), depth = Infinity, includeFiles = true, ignoreFn = defaultIgnore) {
  const lines = await buildLines(rootDir, "", depth, includeFiles, ignoreFn);
  return lines.join("\n");
}
var import_promises, import_path, import_meta, DEFAULT_IGNORE, DEFAULT_IGNORE_EXT;
var init_reposnap_core = __esm({
  "../../core/reposnap-core.js"() {
    import_promises = __toESM(require("fs/promises"), 1);
    import_path = __toESM(require("path"), 1);
    import_meta = {};
    DEFAULT_IGNORE = [
      ".git",
      "node_modules",
      ".DS_Store",
      "Thumbs.db"
    ];
    DEFAULT_IGNORE_EXT = /\.(dll|exe|bin|pak|msg|json|ico)$/i;
    if (import_meta.url === `file://${process.argv[1]}`) {
      snapRepo().then(console.log).catch(console.error);
    }
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
function activate(context) {
  const disposable = vscode.commands.registerCommand("reposnap-vscode.snapRepo", async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage("No workspace folder open.");
      return;
    }
    const folder = folders[0].uri.fsPath;
    try {
      const ignoreFn = (name) => {
        const hiddenOrIgnored = [
          ".git",
          "node_modules",
          ".DS_Store",
          "Thumbs.db"
        ];
        const systemExt = /\.(dll|exe|bin|pak|msg|json|ico)$/i;
        return name.startsWith(".") || hiddenOrIgnored.includes(name) || systemExt.test(name);
      };
      const { snapRepo: snapRepo2 } = await Promise.resolve().then(() => (init_reposnap_core(), reposnap_core_exports));
      const snapshot = await snapRepo2(folder, Infinity, true, ignoreFn);
      const doc = await vscode.workspace.openTextDocument({
        content: snapshot,
        language: "plaintext"
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (e) {
      vscode.window.showErrorMessage("RepoSnap error: " + (typeof e === "object" && e !== null && "message" in e ? e.message : String(e)));
    }
  });
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
