import { AiProvider } from './types';
import { OpenAiProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { OllamaProvider } from './ollama';

const providers: Map<string, AiProvider> = new Map();

export function registerProviders(): void {
  providers.set('openai', new OpenAiProvider());
  providers.set('anthropic', new AnthropicProvider());
  providers.set('google', new GoogleProvider());
  providers.set('ollama', new OllamaProvider());
}

export function getProvider(name: string): AiProvider | undefined {
  return providers.get(name);
}

export function getAllProviders(): AiProvider[] {
  return Array.from(providers.values());
}

export async function getAvailableProviders(): Promise<string[]> {
  const available: string[] = [];
  for (const [name, provider] of providers) {
    if (await provider.isAvailable()) {
      available.push(name);
    }
  }
  return available;
}

export function getDefaultProvider(): AiProvider {
  return providers.get('openai') || providers.values().next().value!;
}
