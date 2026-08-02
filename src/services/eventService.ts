import { API_BASE_URL } from "@/lib/config";
import { normalizeEventCode } from "@/lib/eventCodeNormalizer";

export interface EventData {
  id: string;
  college_name?: string;
  college?: string;
  workshop_name?: string;
  name?: string;
  description?: string;
  event_code: string;
  status: string;
  event_date?: string;
  duration_minutes?: number;
  passing_score?: number;
  total_challenges?: number;
  participants_count?: number;
}

export interface ValidateEventCodeResult {
  success: boolean;
  message: string;
  event?: EventData;
}

/**
 * Centralized Event Code API Service for Blueteamers Arena.
 * Single source of truth for validating event codes against the PostgreSQL backend.
 */
export async function validateEventCode(rawInput: string): Promise<ValidateEventCodeResult> {
  const normalizedCode = normalizeEventCode(rawInput);
  if (!normalizedCode) {
    return {
      success: false,
      message: "Please enter an event code.",
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/events/validate-code/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_code: normalizedCode }),
    });

    const data = await response.json();

    if (response.ok && data.success && (data.event || data.data)) {
      const eventObj: EventData = data.event || data.data;
      return {
        success: true,
        message: data.message || "Event code verified successfully.",
        event: eventObj,
      };
    } else {
      return {
        success: false,
        message: data.message || "Invalid Event Code",
      };
    }
  } catch (error) {
    console.error("[eventService] validateEventCode network/server error:", error);
    return {
      success: false,
      message: "Invalid Event Code",
    };
  }
}
