import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { studentAuthFetch } from "@/lib/auth";

export interface EventCountdown {
  seconds: number | null;
  formatted: string;
  /** True once the student clicked "Start Challenge" (clock is running). */
  isRunning: boolean;
  /** Refetch the authoritative remaining time from the server. */
  refresh: () => void;
}

export function formatClock(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  // 2:30:00 event window — hours shown whenever the clock has hours left
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function extractSeconds(payload: unknown): { seconds: number; running: boolean } | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  const timeRemaining = data?.time_remaining as Record<string, unknown> | undefined;

  // The server always sends time_remaining.started_at: null until the student
  // clicks "Start Challenge". Only then does the clock actually tick.
  if (timeRemaining && typeof timeRemaining.remaining_seconds === "number") {
    return {
      seconds: timeRemaining.remaining_seconds,
      running: timeRemaining.started_at != null,
    };
  }
  // Legacy fallback: top-level time_left (always treat as running when finite)
  if (typeof root.time_left === "number" && Number.isFinite(root.time_left)) {
    return { seconds: root.time_left, running: true };
  }
  return null;
}

/**
 * Live countdown for the event-wide window (default 2:30:00). The
 * authoritative remaining seconds come from the server (`/dashboard/me/`),
 * computed from the participant's started_at + event duration. The clock
 * starts only when the student clicks "Start Challenge" — not at
 * registration — and it is shared by every challenge in the event.
 */
export function useEventCountdown(): EventCountdown {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(() => {
    let active = true;
    studentAuthFetch(`${API_BASE_URL}/dashboard/me/`)
      .then((res) => res.json())
      .then((payload: unknown) => {
        if (!active) return;
        const info = extractSeconds(payload);
        if (info !== null) {
          setSeconds(info.seconds);
          setRunning(info.running);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const cancel = refresh();
    return cancel;
  }, [refresh]);

  // Periodic + on-focus re-sync so every screen (dashboard, challenges list,
  // challenge workspace) always shows the SAME authoritative clock, and any
  // page picks up within seconds that the timer has started.
  useEffect(() => {
    const sync = setInterval(() => refresh(), 15000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(sync);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  // Only tick while the clock is actually running; when it hasn't started,
  // the display stays pinned at the full window (no idle countdown).
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds((prev) => (prev === null || prev <= 0 ? prev : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  return {
    seconds,
    formatted: seconds === null ? "--:--:--" : formatClock(seconds),
    isRunning: running,
    refresh,
  };
}
