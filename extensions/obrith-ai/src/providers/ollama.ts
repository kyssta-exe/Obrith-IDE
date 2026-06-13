import * as vscode from 'vscode';
import { AiProvider, ChatMessage, StreamChunk } from './types';

export class OllamaProvider implements AiProvider {
  readonly name = 'ollama';
  readonly supportsStreaming = true;

  private getConfig() {
    const config = vscode.workspace.getConfiguration('obrith.ai.providers.ollama');
    return {
      baseUrl: config.get<string>('baseUrl', 'http://localhost:11434'),
      model: config.get<string>('model', 'llama3.1'),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { baseUrl } = this.getConfig();
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async *chat(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const { baseUrl } = this.getConfig();

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || this.getConfig().model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: 'error', content: `Ollama API error (${response.status}): ${errorText}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', content: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.message?.content) {
              yield { type: 'token', content: parsed.message.content };
            }
            if (parsed.done) {
              yield {
                type: 'done',
                usage: parsed.prompt_eval_count || parsed.eval_count ? {
                  inputTokens: parsed.prompt_eval_count || 0,
                  outputTokens: parsed.eval_count || 0,
                } : undefined,
              };
              return;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      yield { type: 'done' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        yield { type: 'done' };
      } else {
        yield { type: 'error', content: `Ollama request failed: ${err.message}` };
      }
    }
  }
}
