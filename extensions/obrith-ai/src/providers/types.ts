export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AiProvider {
  readonly name: string;
  readonly supportsStreaming: boolean;
  chat(messages: ChatMessage[], model: string, signal?: AbortSignal): AsyncGenerator<StreamChunk>;
  isAvailable(): Promise<boolean>;
}
