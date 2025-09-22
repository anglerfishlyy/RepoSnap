import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execFileP = promisify(execFile);

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "reposnap-vscode.snapRepo",
    async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open.");
        return;
      }

      const folder = folders[0].uri.fsPath;

      try {
        // Ask user which metadata to include (sizes/loc/counts/sample)
        const metaPick = await vscode.window.showQuickPick(
          [
            { label: "Include sizes", id: "size" },
            { label: "Include LOC", id: "loc" },
            { label: "Include counts (summary)", id: "counts" },
            { label: "Include samples for important files", id: "sample" },
          ],
          { canPickMany: true, placeHolder: "Select metadata to include (Esc to skip)" }
        );

        const picks = metaPick || [];
        let sampleLines: number | undefined = undefined;
        if (picks.some((p) => (p as any).id === "sample")) {
          const v = await vscode.window.showInputBox({
            prompt: "How many lines to sample from important files? (e.g. 5)",
            value: "5",
            validateInput: (val) => (/^\d+$/.test(val) ? null : "Enter a positive integer"),
          });
          sampleLines = v ? Number(v) : undefined;
        }

        // Output format pick (default Markdown)
        const fmt = await vscode.window.showQuickPick(
          [
            { label: "Markdown (tree)", id: "markdown" },
            { label: "Plain text (tree)", id: "plain" },
            { label: "JSON manifest", id: "json" },
            { label: "AI summary (compact)", id: "ai" },
          ],
          { placeHolder: "Choose output format (default: Markdown)" }
        );
        const format = (fmt && (fmt as any).id) || "markdown";

        // Candidate CLI paths (dev vs packaged)
        const candidatePaths = [
          path.join(context.extensionPath, "bin", "reposnap.js"),
          path.join(context.extensionPath, "..", "..", "bin", "reposnap.js"),
          path.join(context.extensionPath, "..", "bin", "reposnap.js"),
        ];

        let cliPath: string | undefined;
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            cliPath = p;
            break;
          }
        }

        if (!cliPath) {
          vscode.window.showErrorMessage(
            "RepoSnap CLI not found in expected locations. Make sure bin/reposnap.js is available."
          );
          return;
        }

        // Build args
        const args = [cliPath, "--depth", "3", "--format", format];
        if (picks.some((p) => (p as any).id === "size")) args.push("--size");
        if (picks.some((p) => (p as any).id === "loc")) args.push("--loc");
        if (picks.some((p) => (p as any).id === "counts")) args.push("--counts");
        if (picks.some((p) => (p as any).id === "sample") && sampleLines) {
          args.push("--sample", String(sampleLines));
        }

        const { stdout } = await execFileP("node", args, { cwd: folder });

        if (format === "json") {
          const doc = await vscode.workspace.openTextDocument({
            content: stdout,
            language: "json",
          });
          await vscode.window.showTextDocument(doc, { preview: false });
        } else {
          // markdown/plain/ai -> use markdown rendering
          const doc = await vscode.workspace.openTextDocument({
            content: stdout,
            language: "markdown",
          });
          await vscode.window.showTextDocument(doc, { preview: false });
        }
      } catch (e: any) {
        vscode.window.showErrorMessage("RepoSnap error: " + (e.message || String(e)));
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
