import * as vscode from 'vscode';
import { ChatProvider } from './chat/chatProvider';
import { ObrithInlineProvider } from './autocomplete/inline';
import { registerProviders } from './providers';
import { registerSettings } from './settings/settings';

let chatProvider: ChatProvider | undefined;
let inlineProvider: ObrithInlineProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Register all AI providers
  registerProviders();

  // Register chat panel
  chatProvider = new ChatProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('obrith.chat', chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // Register inline completions
  inlineProvider = new ObrithInlineProvider();
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineProvider,
    ),
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('obrith.chat.focus', () => {
      vscode.commands.executeCommand('workbench.view.extension.obrith-ai');
      vscode.commands.executeCommand('obrith.chat.focus');
    }),
    vscode.commands.registerCommand('obrith.zigma.toggle', () => {
      const config = vscode.workspace.getConfiguration('obrith.ai');
      const current = config.get<boolean>('zigmaMode', true);
      config.update('zigmaMode', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Zigma Mode: ${!current ? 'ON' : 'OFF'}`);
    }),
    vscode.commands.registerCommand('obrith.inline.suggest', () => {
      vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }),
  );

  // Register settings
  registerSettings(context);

  console.log('Obrith AI extension activated');
}

export function deactivate() {
  chatProvider?.dispose();
  inlineProvider?.dispose();
}
