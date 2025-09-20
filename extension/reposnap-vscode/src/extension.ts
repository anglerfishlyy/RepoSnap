import * as vscode from "vscode";
import { promisify } from "util";
import { execFile } from "child_process";
import * as path from "path";

const execFileP = promisify(execFile);

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("reposnap-vscode.snapRepo", async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage("No workspace folder open.");
      return;
    }

    const folder = folders[0].uri.fsPath;

    try {
      // Path to CLI script
      const cliPath = path.join(context.extensionPath, "bin", "reposnap.js");

      // Run CLI with options (hardcoded depth=3 for now)
      const { stdout } = await execFileP("node", [cliPath, "--depth", "3"], {
        cwd: folder,
      });

      const doc = await vscode.workspace.openTextDocument({
        content: stdout,
        language: "markdown", // markdown looks nicer than plaintext
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (e: any) {
      vscode.window.showErrorMessage(
        "RepoSnap error: " + (e?.message ?? String(e))
      );
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
