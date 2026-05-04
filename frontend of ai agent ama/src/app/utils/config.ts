/**
 * Central API base URL.
 * In production (Vercel) → reads VITE_API_URL env var set in Vercel dashboard.
 * In local dev         → falls back to https://ama-ai-agent-toxa.vercel.app
 */
export const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL || 'https://ama-ai-agent-toxa.vercel.app';
