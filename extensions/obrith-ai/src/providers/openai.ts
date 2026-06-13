import * as vscode from 'vscode';
import { AiProvider, ChatMessage, StreamChunk } from './types';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  readonly supportsStreaming = true;

  private getConfig() {
    const config = vscode.workspace.getConfiguration('obrith.ai.providers.openai');
    return {
      apiKey: config.get<string>('apiKey', ''),
      baseUrl: config.get<string>('baseUrl', 'https://api.openai.com/v1'),
      model: config.get<string>('model', 'gpt-4o'),
    };
  }

  async isAvailable(): Promise<boolean> {
    const { apiKey } = this.getConfig();
    return !!apiKey;
  }

  async *chat(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const { apiKey, baseUrl } = this.getConfig();
    if (!apiKey) {
      yield { type: 'error', content: 'OpenAI API key not configured' };
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || this.getConfig().model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: 'error', content: `OpenAI API error (${response.status}): ${errorText}` };
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done' };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: 'token', content: delta };
            }
            if (parsed.usage) {
              yield {
                type: 'done',
                usage: {
                  inputTokens: parsed.usage.prompt_tokens,
                  outputTokens: parsed.usage.completion_tokens,
                },
              };
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
        yield { type: 'error', content: `OpenAI request failed: ${err.message}` };
      }
    }
  }
}
