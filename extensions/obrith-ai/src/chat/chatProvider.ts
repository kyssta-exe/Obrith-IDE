import * as vscode from 'vscode';
import { getChatHtml } from './chatView';
import { ChatMessage } from '../providers/types';
import { getProvider, getAvailableProviders } from '../providers';
import { classifyTask, selectModel, getTaskDescription } from '../zigma/router';

export class ChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'obrith.chat';
  private view?: vscode.WebviewView;
  private history: ChatMessage[] = [];
  private abortController?: AbortController;
  private _streamBuffer = '';

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = getChatHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'init':
          await this.sendProvidersList();
          this.sendZigmaState();
          break;

        case 'chat':
          await this.handleChat(message.message, message.model);
          break;

        case 'selectModel':
          // Model selection handled in handleChat
          break;

        case 'toggleZigma':
          const config = vscode.workspace.getConfiguration('obrith.ai');
          await config.update('zigmaMode', message.enabled, vscode.ConfigurationTarget.Global);
          break;
      }
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
      this.abortController?.abort();
    });
  }

  private async sendProvidersList(): Promise<void> {
    if (!this.view) { return; }
    const available = await getAvailableProviders();
    this.view.webview.postMessage({ type: 'providers', providers: available });
  }

  private sendZigmaState(): void {
    if (!this.view) { return; }
    const config = vscode.workspace.getConfiguration('obrith.ai');
    const enabled = config.get<boolean>('zigmaMode', true);
    this.view.webview.postMessage({ type: 'zigmaState', enabled });
  }

  private async handleChat(userMessage: string, selectedModel?: string): Promise<void> {
    if (!this.view) { return; }

    // Abort any previous streaming request
    this.abortController?.abort();
    this.abortController = new AbortController();

    this.history.push({ role: 'user', content: userMessage });

    // Determine provider and model
    const config = vscode.workspace.getConfiguration('obrith.ai');
    const zigmaEnabled = config.get<boolean>('zigmaMode', true);

    let providerName: string;
    let modelName: string;

    if (selectedModel) {
      // User explicitly selected a model/provider
      providerName = selectedModel;
      const providerConfig = vscode.workspace.getConfiguration(`obrith.ai.providers.${selectedModel}`);
      modelName = providerConfig.get<string>('model', '');
    } else if (zigmaEnabled) {
      const task = classifyTask(userMessage);
      const available = await getAvailableProviders();
      const selection = selectModel(task, available);

      if (selection) {
        providerName = selection.provider;
        modelName = selection.model;
      } else {
        // Fallback to default
        providerName = config.get<string>('defaultProvider', 'openai');
        const providerConfig = vscode.workspace.getConfiguration(`obrith.ai.providers.${providerName}`);
        modelName = providerConfig.get<string>('model', '');
      }
    } else {
      providerName = config.get<string>('defaultProvider', 'openai');
      const providerConfig = vscode.workspace.getConfiguration(`obrith.ai.providers.${providerName}`);
      modelName = providerConfig.get<string>('model', '');
    }

    const provider = getProvider(providerName);
    if (!provider) {
      this.view.webview.postMessage({ type: 'error', content: `Provider "${providerName}" not found` });
      return;
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      this.view.webview.postMessage({
        type: 'error',
        content: `Provider "${providerName}" is not available. Check your API key in settings.`,
      });
      return;
    }

    // Stream response
    let taskType = '';
    if (zigmaEnabled && !selectedModel) {
      const task = classifyTask(userMessage);
      taskType = getTaskDescription(task);
    }

    try {
      for await (const chunk of provider.chat(this.history, modelName, this.abortController.signal)) {
        if (!this.view) { break; }

        switch (chunk.type) {
          case 'token':
            this.view.webview.postMessage({ type: 'token', content: chunk.content });
            if (chunk.content) {
              this._streamBuffer += chunk.content;
            }
            break;
          case 'done':
            this.view.webview.postMessage({ type: 'done', taskType });
            break;
          case 'error':
            this.view.webview.postMessage({ type: 'error', content: chunk.content });
            break;
        }

        if (chunk.type === 'done' || chunk.type === 'error') {
          break;
        }
      }

      // Add accumulated response to history
      if (this._streamBuffer) {
        this.history.push({ role: 'assistant', content: this._streamBuffer });
        this._streamBuffer = '';
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && this.view) {
        this.view.webview.postMessage({ type: 'error', content: `Stream error: ${err.message}` });
      }
    }
  }

  public dispose(): void {
    this.abortController?.abort();
  }
}
