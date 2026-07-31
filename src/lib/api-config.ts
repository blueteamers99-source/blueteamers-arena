/**
 * Blueteamers Arena Frontend API & WebSocket Configuration
 * Automatically supports environment variable overrides for production deployment (Railway, Vercel, Netlify).
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000/api/v1";

export const WS_BASE_URL =
  (import.meta.env.VITE_WS_BASE_URL as string) || "ws://localhost:8000/ws";
