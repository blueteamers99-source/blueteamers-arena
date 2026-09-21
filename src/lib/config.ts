export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? "https://blueteamers-arena-production.up.railway.app/api/v1"
    : "http://localhost:8000/api/v1");

export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ||
  (import.meta.env.PROD
    ? "wss://blueteamers-arena-production.up.railway.app/ws"
    : "ws://localhost:8000/ws");
