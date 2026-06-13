import * as vscode from 'vscode';
import { AiProvider, ChatMessage, StreamChunk } from './types';

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly supportsStreaming = true;

  private getConfig() {
    const config = vscode.workspace.getConfiguration('obrith.ai.providers.anthropic');
    return {
      apiKey: config.get<string>('apiKey', ''),
      model: config.get<string>('model', 'claude-sonnet-4-20250514'),
    };
  }

  async isAvailable(): Promise<boolean> {
    const { apiKey } = this.getConfig();
    return !!apiKey;
  }

  async *chat(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const { apiKey } = this.getConfig();
    if (!apiKey) {
      yield { type: 'error', content: 'Anthropic API key not configured' };
      return;
    }

    // Anthropic API requires system to be a separate parameter
    let systemPrompt = '';
    const chatMessages: Array<{ role: string; content: string }> = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n' : '') + msg.content;
      } else {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }

    try {
      const body: any = {
        model: model || this.getConfig().model,
        messages: chatMessages,
        max_tokens: 4096,
        stream: true,
      };
      if (systemPrompt) {
        body.system = systemPrompt;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: 'error', content: `Anthropic API error (${response.status}): ${errorText}` };
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

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              yield { type: 'token', content: parsed.delta.text };
            } else if (parsed.type === 'message_delta' && parsed.usage) {
              yield {
                type: 'done',
                usage: {
                  inputTokens: 0,
                  outputTokens: parsed.usage.output_tokens,
                },
              };
              return;
            } else if (parsed.type === 'message_stop') {
              yield { type: 'done' };
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
        yield { type: 'error', content: `Anthropic request failed: ${err.message}` };
      }
    }
  }
}
