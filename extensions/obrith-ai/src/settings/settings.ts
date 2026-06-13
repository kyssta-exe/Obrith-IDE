import * as vscode from 'vscode';

export function registerSettings(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('obrith.settings.open', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'obrith.ai');
    }),
  );

  // Listen for configuration changes to notify the chat view
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('obrith.ai')) {
        // Configuration changed - the chat provider will pick up new values on next request
      }
    }),
  );
}
