import * as vscode from 'vscode';

export type TaskType = 'autocomplete' | 'quick_chat' | 'deep_chat' | 'code_gen' | 'code_review' | 'refactor' | 'explain' | 'fix_error';

export interface ModelSelection {
  provider: string;
  model: string;
}

const MODEL_PRIORITY: Record<TaskType, ModelSelection[]> = {
  autocomplete: [
    { provider: 'ollama', model: 'deepseek-coder-v2:16b' },
    { provider: 'ollama', model: 'qwen2.5-coder:14b' },
  ],
  quick_chat: [
    { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
    { provider: 'openai', model: 'gpt-4o-mini' },
    { provider: 'google', model: 'gemini-2.0-flash' },
    { provider: 'ollama', model: 'qwen2.5-coder:14b' },
  ],
  deep_chat: [
    { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'google', model: 'gemini-2.0-pro' },
  ],
  code_gen: [
    { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    { provider: 'openai', model: 'gpt-4o' },
  ],
  code_review: [
    { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    { provider: 'openai', model: 'gpt-4o' },
  ],
  refactor: [
    { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    { provider: 'openai', model: 'gpt-4o' },
  ],
  explain: [
    { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
    { provider: 'openai', model: 'gpt-4o-mini' },
  ],
  fix_error: [
    { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    { provider: 'openai', model: 'gpt-4o' },
  ],
};

export function classifyTask(userMessage: string, context?: { hasErrors?: boolean }): TaskType {
  if (context?.hasErrors && /fix|error|bug/i.test(userMessage)) { return 'fix_error'; }
  if (/create|write|generate|add|implement|build/i.test(userMessage)) { return 'code_gen'; }
  if (/review|bugs|issues|check|audit/i.test(userMessage)) { return 'code_review'; }
  if (/refactor|reorganize|simplify|clean|optimize|rewrite/i.test(userMessage)) { return 'refactor'; }
  if (/explain|how|what|why|understand|walkthrough/i.test(userMessage)) { return 'explain'; }
  return 'quick_chat';
}

export function selectModel(task: TaskType, availableProviders: string[]): ModelSelection | null {
  const priorities = MODEL_PRIORITY[task];
  for (const p of priorities) {
    if (availableProviders.includes(p.provider)) { return p; }
  }
  return null;
}

export function getTaskDescription(task: TaskType): string {
  const descriptions: Record<TaskType, string> = {
    autocomplete: 'Code completion',
    quick_chat: 'Quick question',
    deep_chat: 'Deep analysis',
    code_gen: 'Code generation',
    code_review: 'Code review',
    refactor: 'Refactoring',
    explain: 'Explanation',
    fix_error: 'Error fixing',
  };
  return descriptions[task];
}
