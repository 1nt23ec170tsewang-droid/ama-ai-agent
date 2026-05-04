/**
 * Central API base URL.
 * In production (Vercel) → reads VITE_API_URL env var set in Vercel dashboard.
 * In local dev         → falls back to http://localhost:5000
 */
export const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
