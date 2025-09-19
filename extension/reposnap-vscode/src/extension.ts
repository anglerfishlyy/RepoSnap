import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "reposnap-vscode.snapRepo",
    async () => {
      try {
        const { snapRepo } = await import("../../../core/reposnap-core.js");

        const folder =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

        const snapshot = await snapRepo(folder, Infinity, true, (name: string) => {
          // Ignore hidden files/folders
          return name.startsWith(".") || name === "node_modules" || name === ".git";
        });

        const doc = await vscode.workspace.openTextDocument({
          content: snapshot,
          language: "plaintext",
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (err: any) {
        vscode.window.showErrorMessage(`[RepoSnap] Error: ${err.message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
