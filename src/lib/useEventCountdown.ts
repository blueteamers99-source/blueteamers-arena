import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { studentAuthFetch } from "@/lib/auth";

export interface EventCountdown {
  seconds: number | null;
  formatted: string;
}

export function formatClock(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function extractSeconds(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (typeof root.time_left === "number") return root.time_left;
  const data = root.data as Record<string, unknown> | undefined;
  const timeRemaining = data?.time_remaining as Record<string, unknown> | undefined;
  if (timeRemaining && typeof timeRemaining.remaining_seconds === "number") {
    return timeRemaining.remaining_seconds;
  }
  return null;
}

/**
 * Live countdown for the overall event window. The authoritative remaining
 * seconds come from the server (`/dashboard/me/` -> time_left, computed from the
 * participant's started_at + event duration); the client then ticks down once a
 * second so the same timer is consistent across the dashboard and the
 * challenges list.
 */
export function useEventCountdown(): EventCountdown {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    studentAuthFetch(`${API_BASE_URL}/dashboard/me/`)
      .then((res) => res.json())
      .then((payload: unknown) => {
        if (!active) return;
        const secs = extractSeconds(payload);
        if (secs !== null) setSeconds(secs);
      })
      .catch(() => {});
    const interval = setInterval(() => {
      setSeconds((prev) => (prev === null || prev <= 0 ? prev : prev - 1));
    }, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return {
    seconds,
    formatted: seconds === null ? "--:--" : formatClock(seconds),
  };
}
