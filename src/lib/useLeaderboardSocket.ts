import { useEffect, useRef, useState, useCallback } from "react";
import { WS_BASE_URL } from "@/lib/config";
import { getStudentAccessToken } from "@/lib/auth";
import { extractLeaderboardPayload } from "@/lib/api-types";
import type { LeaderboardPayload } from "@/lib/api-types";

export type SocketStatus = "connecting" | "open" | "closed" | "error";

interface UseLeaderboardSocketOptions {
  /** Event code to subscribe to (from arena.selectedEventCode). */
  eventCode: string | null;
  /** Called with every leaderboard payload pushed by the server. */
  onLeaderboard: (payload: LeaderboardPayload) => void;
  /** True when the live socket is authenticated and receiving updates. */
  onStatusChange?: (status: SocketStatus) => void;
}

/**
 * Live leaderboard WebSocket client.
 *
 * Protocol (backend: LeaderboardConsumer):
 *  1. Connect to `ws(s)://<host>/ws/leaderboard/<event_code>/`.
 *  2. Send `{"token": "<student jwt>"}` as the FIRST message — the consumer
 *     rejects everything else until authenticated.
 *  3. Receive `{"type": "connected", ...}`, then
 *     `{"type": "leaderboard_update", "data": <bare leaderboard payload>}`
 *     on every broadcast.
 *
 * Resilience: exponential reconnect backoff (1s → 15s cap) while mounted, and
 * a ping keepalive so proxies do not idle-drop the connection. The caller is
 * expected to keep the REST polling fallback running — it is also the source
 * of student-aware fields (is_current_user) that the WS broadcast lacks.
 */
export function useLeaderboardSocket({
  eventCode,
  onLeaderboard,
  onStatusChange,
}: UseLeaderboardSocketOptions): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>("closed");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);
  const mountedRef = useRef(true);

  // Keep the latest callbacks in refs so a changing onLeaderboard identity
  // (e.g. an inline arrow function) never tears down the socket connection.
  const onLeaderboardRef = useRef(onLeaderboard);
  onLeaderboardRef.current = onLeaderboard;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const setAndReportStatus = useCallback((next: SocketStatus) => {
    if (!mountedRef.current) return;
    setStatus(next);
    onStatusChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!eventCode) {
      setAndReportStatus("closed");
      return;
    }

    const clearTimers = () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const handleMessage = (event: MessageEvent) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // Ignore non-JSON frames.
      }
      if (!data || typeof data !== "object") return;
      const record = data as Record<string, unknown>;

      if (record.type === "connected") {
        attemptsRef.current = 0; // Reset backoff after a successful handshake.
        setAndReportStatus("open");
        return;
      }
      if (record.type === "leaderboard_update" && record.data) {
        onLeaderboardRef.current(extractLeaderboardPayload(record.data));
        return;
      }
      // Fallback for servers that push the bare payload without the
      // "leaderboard_update" envelope (protocol variation safety net).
      if (
        record.type === undefined &&
        Array.isArray(record.rankings)
      ) {
        onLeaderboardRef.current(extractLeaderboardPayload(record));
      }
    };

    const connect = () => {
      if (!mountedRef.current) return;

      // Token must be current at connect time; a refreshed token is picked up
      // on the next reconnect after an eventual 4003 close.
      const token = getStudentAccessToken();
      if (!token) {
        setAndReportStatus("closed");
        return;
      }

      const socket = new WebSocket(
        `${WS_BASE_URL}/leaderboard/${encodeURIComponent(eventCode)}/`,
      );
      socketRef.current = socket;

      socket.onopen = () => {
        // First message MUST be the auth handshake — the consumer joins the
        // group only after receiving it.
        socket.send(JSON.stringify({ token }));
        setAndReportStatus("connecting");
      };

      socket.onmessage = handleMessage;

      socket.onerror = () => {
        setAndReportStatus("error");
      };

      socket.onclose = (event) => {
        clearTimers();
        if (socketRef.current === socket) socketRef.current = null;
        if (!mountedRef.current) return;
        setAndReportStatus("closed");
        // 4003 = authentication rejected. Retrying with the same token is
        // pointless immediately, but a token may have been refreshed by then,
        // so back off longer before trying again.
        const delay = Math.min(
          1000 * 2 ** Math.min(attemptsRef.current, 4),
          15000,
        );
        attemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      // Keepalive ping every 30s — keeps corporate proxies / Railway's router
      // from dropping the idle socket and matches the consumer's ping handler.
      pingTimerRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: "ping" }));
        }
      }, 30000);
    };

    connect();

    return () => {
      mountedRef.current = false;
      clearTimers();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState <= WebSocket.OPEN) {
        // 1000 = normal closure so the server discards the channel cleanly.
        socket.close(1000, "component unmounting");
      }
    };
  }, [eventCode, setAndReportStatus]);

  return status;
}
