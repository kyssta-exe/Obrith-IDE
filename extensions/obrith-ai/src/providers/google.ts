import * as vscode from 'vscode';
import { AiProvider, ChatMessage, StreamChunk } from './types';

export class GoogleProvider implements AiProvider {
  readonly name = 'google';
  readonly supportsStreaming = true;

  private getConfig() {
    const config = vscode.workspace.getConfiguration('obrith.ai.providers.google');
    return {
      apiKey: config.get<string>('apiKey', ''),
      model: config.get<string>('model', 'gemini-2.0-flash'),
    };
  }

  async isAvailable(): Promise<boolean> {
    const { apiKey } = this.getConfig();
    return !!apiKey;
  }

  async *chat(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    const { apiKey } = this.getConfig();
    if (!apiKey) {
      yield { type: 'error', content: 'Google AI API key not configured' };
      return;
    }

    const selectedModel = model || this.getConfig().model;

    // Convert messages to Google format
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    let systemInstruction = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += (systemInstruction ? '\n' : '') + msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    try {
      const body: any = {
        contents,
        generationConfig: {
          maxOutputTokens: 4096,
        },
      };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: 'error', content: `Google AI error (${response.status}): ${errorText}` };
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
            const candidate = parsed.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text;
            if (text) {
              yield { type: 'token', content: text };
            }
            if (candidate?.finishReason) {
              const usage = parsed.usageMetadata;
              yield {
                type: 'done',
                usage: usage ? {
                  inputTokens: usage.promptTokenCount || 0,
                  outputTokens: usage.candidatesTokenCount || 0,
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
        yield { type: 'error', content: `Google AI request failed: ${err.message}` };
      }
    }
  }
}
