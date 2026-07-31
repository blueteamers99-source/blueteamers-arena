import { useState, useCallback } from "react";
import { validateEventCode, type EventData, type ValidateEventCodeResult } from "@/services/eventService";
import { saveSelectedEvent } from "@/lib/mock-events";

export interface UseValidateEventCodeReturn {
  loading: boolean;
  error: string | null;
  success: boolean;
  eventData: EventData | null;
  validateCode: (rawInput: string) => Promise<ValidateEventCodeResult>;
  reset: () => void;
}

/**
 * Single Source of Truth React Hook for Event Code Validation.
 * Handles normalization, backend API request, localStorage persistence, and status state.
 */
export function useValidateEventCode(): UseValidateEventCodeReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [eventData, setEventData] = useState<EventData | null>(null);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(false);
    setEventData(null);
  }, []);

  const validateCode = useCallback(async (rawInput: string): Promise<ValidateEventCodeResult> => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setEventData(null);

    const result = await validateEventCode(rawInput);

    if (result.success && result.event) {
      setSuccess(true);
      setEventData(result.event);
      setError(null);

      // Task 7: Store event_id, event_code, college, title in localStorage
      if (typeof localStorage !== "undefined") {
        const codeToSave = result.event.event_code;
        saveSelectedEvent(codeToSave);
        localStorage.setItem("saved_event_code", codeToSave);
        localStorage.setItem(
          "selected_event_data",
          JSON.stringify({
            event_id: result.event.id,
            event_code: result.event.event_code,
            college: result.event.college_name || result.event.college || "College",
            title: result.event.workshop_name || result.event.name || "CTF Workshop",
            status: result.event.status,
            event_date: result.event.event_date,
          })
        );
      }
    } else {
      setSuccess(false);
      setError(result.message || "Invalid Event Code");
    }

    setLoading(false);
    return result;
  }, []);

  return {
    loading,
    error,
    success,
    eventData,
    validateCode,
    reset,
  };
}
