import * as vscode from 'vscode';
import { ChatMessage } from '../providers/types';
import { getProvider } from '../providers';

export class ObrithInlineProvider implements vscode.InlineCompletionItemProvider {
  private abortController?: AbortController;
  private debounceTimer?: ReturnType<typeof setTimeout>;

  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.InlineCompletionItem[] | vscode.InlineCompletionList> {
    const config = vscode.workspace.getConfiguration('obrith.ai.autocomplete');
    if (!config.get<boolean>('enabled', true)) {
      return [];
    }

    // Cancel previous request
    this.abortController?.abort();
    this.abortController = new AbortController();

    return new Promise((resolve) => {
      const debounceMs = config.get<number>('debounceMs', 200);

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        if (token.isCancellationRequested) {
          resolve([]);
          return;
        }

        try {
          const items = await this.getCompletion(document, position, this.abortController!.signal);
          resolve(items);
        } catch {
          resolve([]);
        }
      }, debounceMs);
    });
  }

  private async getCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    signal: AbortSignal,
  ): Promise<vscode.InlineCompletionItem[]> {
    const config = vscode.workspace.getConfiguration('obrith.ai');
    const defaultProvider = config.get<string>('defaultProvider', 'openai');

    const provider = getProvider(defaultProvider);
    if (!provider) { return []; }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) { return []; }

    // Get context: 30 lines before cursor
    const startLine = Math.max(0, position.line - 30);
    const prefix = document.getText(
      new vscode.Range(startLine, 0, position.line, position.character),
    );

    // Get suffix: 5 lines after cursor
    const endLine = Math.min(document.lineCount - 1, position.line + 5);
    const suffix = document.getText(
      new vscode.Range(position.line, position.character, endLine, document.lineAt(endLine).text.length),
    );

    const prompt: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a code completion engine. Complete the code at the cursor position. Output ONLY the completion text, no explanations, no markdown. The completion should be syntactically valid code that continues from where the cursor is.',
      },
      {
        role: 'user',
        content: `Complete this code:\n\n\`\`\`\n${prefix}<|fim_suffix|>${suffix}\n\`\`\`\n\nOutput only the code that goes at the cursor position (where <|fim_suffix|> is).`,
      },
    ];

    const providerConfig = vscode.workspace.getConfiguration(`obrith.ai.providers.${defaultProvider}`);
    const model = providerConfig.get<string>('model', '');

    let completion = '';

    try {
      for await (const chunk of provider.chat(prompt, model, signal)) {
        if (chunk.type === 'token' && chunk.content) {
          completion += chunk.content;
        }
        if (chunk.type === 'done' || chunk.type === 'error') {
          break;
        }
      }
    } catch {
      return [];
    }

    if (!completion) { return []; }

    // Clean up: remove markdown code fences if present
    let cleaned = completion.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    }

    // Remove any trailing explanation text (take only first code block logic)
    const lines = cleaned.split('\n');
    const codeLines: string[] = [];
    for (const line of lines) {
      // Stop at common explanation markers
      if (/^(Here|This|The|Note:|Explanation)/.test(line) && codeLines.length > 0) {
        break;
      }
      codeLines.push(line);
    }

    const insertText = codeLines.join('\n').trim();
    if (!insertText) { return []; }

    return [
      {
        insertText: new vscode.SnippetString(insertText),
        range: new vscode.Range(position, position),
      },
    ];
  }

  dispose(): void {
    this.abortController?.abort();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
