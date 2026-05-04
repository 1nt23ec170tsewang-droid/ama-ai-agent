/**
 * Shared Claude API utility.
 * Routes all Claude calls through the backend (env var in prod, localhost in dev).
 */

const BACKEND = (import.meta as any).env?.VITE_API_URL || 'https://ama-ai-agent-toxa.vercel.app';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

/** Generic Claude call via the backend proxy */
export async function callClaude(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {}
): Promise<string> {
  const token = localStorage.getItem('authToken');

  const body: Record<string, unknown> = {
    messages,
    model: 'openai/gpt-4.1', // Routed via backend using OpenRouter
    maxTokens: options.maxTokens ?? 1024,
  };
  if (options.systemPrompt) body.systemPrompt = options.systemPrompt;

  const res = await fetch(`${BACKEND}/api/ama/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Claude API error: ${res.status}`);
  }

  const data = await res.json();
  return data.response as string;
}

/** Convenience: single user prompt → string response */
export async function askClaude(
  userPrompt: string,
  systemPrompt?: string
): Promise<string> {
  return callClaude([{ role: 'user', content: userPrompt }], { systemPrompt });
}
