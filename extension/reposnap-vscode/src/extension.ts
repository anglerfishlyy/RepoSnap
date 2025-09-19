
import * as vscode from 'vscode';
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('reposnap-vscode.snapRepo', async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }
    const folder = folders[0].uri.fsPath;
    try {
      // Custom ignore function: matches VS Code Explorer style
      const ignoreFn = (name: string) => {
        const hiddenOrIgnored = [
          '.git',
          'node_modules',
          '.DS_Store',
          'Thumbs.db',
        ];
        const systemExt = /\.(dll|exe|bin|pak|msg|json|ico)$/i;
        return name.startsWith('.') || hiddenOrIgnored.includes(name) || systemExt.test(name);
      };
      const { snapRepo } = await import("../../../core/reposnap-core.js");
      const snapshot = await snapRepo(folder, Infinity, true, ignoreFn);
      const doc = await vscode.workspace.openTextDocument({
        content: snapshot,
        language: "plaintext",
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (e) {
      vscode.window.showErrorMessage('RepoSnap error: ' + (typeof e === 'object' && e !== null && 'message' in e ? (e.message as string) : String(e)));
    }
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
