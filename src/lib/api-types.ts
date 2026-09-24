// Typed contracts for the backend API responses (Django REST Framework).
// Field names mirror the serializer output. Optional fields exist where the
// backend may omit a value.

// PII-minimal leaderboard row (backend privacy contract): the API deliberately
// returns NO email, NO participant_id, and NO per-row college/event fields.
// The board is scoped to one event whose college/code live on the payload.
export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  completed: number;
  time_taken: string;
  is_current_user: boolean;
  is_finished?: boolean;
}

export interface LeaderboardPayload {
  event_code: string;
  college_name: string;
  event_status?: "Upcoming" | "Live" | "Completed" | string;
  is_final?: boolean;
  final_reason?: "all_finished" | "time_up" | null;
  time_remaining?: number;
  total_participants?: number;
  top3_podium?: LeaderboardEntry[];
  winners?: LeaderboardEntry[];
  rankings: LeaderboardEntry[];
  winner?: LeaderboardEntry | null;
  student_position?: LeaderboardEntry | null;
  nearby_rankings?: LeaderboardEntry[];
}

export interface StudentDashboardDetail {
  current_score: number;
  current_rank: number;
  completed_challenges: number;
  remaining_challenges: number;
  completion_percentage: number;
  total_challenges: number;
  current_event?: {
    total_challenges: number;
  };
  time_remaining?: {
    started_at?: string | null;
    end_time?: string | null;
    duration_minutes?: number;
    remaining_seconds?: number;
    is_expired?: boolean;
    formatted_remaining?: string;
  };
  leaderboard_position?: number;
  recent_activity?: string[];
  statistics?: Record<string, unknown>;
  student_profile?: Record<string, unknown>;
}

export interface StudentDashboard {
  success?: boolean;
  name?: string;
  email?: string;
  score: number;
  rank: number | null;
  completed: number;
  total: number;
  progress: number;
  time_left?: number;
  event?: string;
  college?: string;
  data: StudentDashboardDetail;
}

export interface EventItem {
  id: string;
  college_name: string;
  workshop_name: string;
  description: string;
  event_code: string;
  event_date: string;
  duration_minutes: number;
  passing_score: number;
  total_challenges: number;
  accent_color?: string;
  status: string;
  banner_image?: string;
  banner_image_url?: string;
  registration_open_at?: string;
  registration_close_at?: string;
  participants_count: number;
  enrolled_participants?: number;
  csv_uploaded_count?: number;
  arena_joined_count?: number;
  pending_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovedStudent {
  id?: string;
  registered_name: string;
  registered_email: string;
  has_joined: boolean;
  status: string;
}

export interface ChallengeResource {
  name: string;
  type: string;
  size: string;
  evidenceId?: string;
}

export interface ChallengeEvidence {
  id: string;
  label: string;
  filename: string;
  image: string;
  content_text?: string | null;
  file_format?: string;
}

export interface ChallengeQuestion {
  id: string;
  prompt: string;
  kind: "text" | "mcq";
  options?: string[];
}

export interface ChallengeListItem {
  slug?: string;
  id?: string;
  name: string;
  number?: number;
  challenge_number?: number;
  description?: string;
  difficulty?: string;
  duration?: number;
  duration_minutes?: number;
  points?: number;
  skills?: string[];
  objectives?: string[];
  brief?: string;
  resources?: ChallengeResource[];
  evidence?: ChallengeEvidence[];
  questions?: ChallengeQuestion[];
}

export interface ChallengeDetailDTO {
  slug?: string;
  id?: string;
  name: string;
  number?: number;
  challenge_number?: number;
  description?: string;
  difficulty?: string;
  duration?: number;
  duration_minutes?: number;
  points?: number;
  skills?: string[];
  objectives?: string[];
  brief?: string;
  resources?: ChallengeResource[];
  evidence?: ChallengeEvidence[];
  questions?: ChallengeQuestion[];
}

export interface SubmissionPayload {
  message?: string;
  challenge_slug?: string;
  status?: string;
  score_earned?: number;
  max_possible_score?: number;
  is_passing?: boolean;
  total_participant_score?: number;
  completed_challenges?: number;
}

export interface SubmissionResult {
  success?: boolean;
  message?: string;
  challenge_slug?: string;
  status?: string;
  score_earned?: number;
  max_possible_score?: number;
  is_passing?: boolean;
  total_participant_score?: number;
  total_score?: number;
  completed_challenges?: number;
  data?: SubmissionPayload;
}

export interface CertificateResponse {
  unlocked?: boolean;
  certificate_id?: string;
  name?: string;
  email?: string;
  event?: string;
  college?: string;
  message?: string;
  passing_score?: number;
  score?: number;
  completed_challenges?: number;
  total_challenges?: number;
}

export interface CertificateVerifyResponse {
  verified?: boolean;
  message?: string;
  name?: string;
  college?: string;
  event?: string;
  score?: number;
  rank?: number;
  verification_id?: string;
  issued_date?: string;
  issuer?: string;
  qr_code_url?: string;
}

// --- small narrowing helpers for untyped res.json() payloads ---

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

// Handles the common envelope shapes: { data: { results } }, { results },
// { data: [...] }, or a bare array.
export function extractResults<T>(resData: unknown): T[] {
  if (!isRecord(resData)) return asArray<T>(resData);
  const data = resData.data;
  if (isRecord(data) && Array.isArray(data.results)) return data.results as T[];
  if (Array.isArray(resData.results)) return resData.results as T[];
  if (Array.isArray(data)) return data as T[];
  return [];
}

// Extracts the rankings/leaderboard payload: { data: { rankings } },
// { data: { leaderboard } }, { rankings }, { leaderboard }, { results } or a
// bare array.
export function extractRankings<T>(resData: unknown): T[] {
  if (!isRecord(resData)) return asArray<T>(resData);
  const data = resData.data;
  if (isRecord(data)) {
    if (Array.isArray(data.rankings)) return data.rankings as T[];
    if (Array.isArray(data.leaderboard)) return data.leaderboard as T[];
    if (Array.isArray(data.results)) return data.results as T[];
    if (Array.isArray(data)) return data as T[];
  }
  if (Array.isArray(resData.rankings)) return resData.rankings as T[];
  if (Array.isArray(resData.leaderboard)) return resData.leaderboard as T[];
  if (Array.isArray(resData.results)) return resData.results as T[];
  return [];
}

export function extractObject<T>(resData: unknown): T {
  if (!isRecord(resData)) return resData as T;
  return (resData.challenge ?? resData.data ?? resData) as T;
}

// Extracts the full leaderboard payload envelope (metadata + rankings):
// { data: { rankings, winner, is_final, ... } } or { rankings, is_final, ... }.
export function extractLeaderboardPayload(resData: unknown): LeaderboardPayload {
  if (!isRecord(resData)) return { event_code: "", college_name: "", rankings: [] };
  const data = isRecord(resData.data) ? resData.data : resData;
  const rankings = extractRankings<LeaderboardEntry>(resData);
  const asRecord = (v: unknown): v is Record<string, unknown> => isRecord(v);
  return {
    event_code: typeof data.event_code === "string" ? data.event_code : "",
    college_name: typeof data.college_name === "string" ? data.college_name : "",
    event_status: typeof data.event_status === "string" ? (data.event_status as LeaderboardPayload["event_status"]) : undefined,
    is_final: typeof data.is_final === "boolean" ? data.is_final : false,
    final_reason: asRecord(data) && (data.final_reason === "all_finished" || data.final_reason === "time_up")
      ? data.final_reason
      : null,
    time_remaining: typeof data.time_remaining === "number" ? data.time_remaining : undefined,
    total_participants: typeof data.total_participants === "number" ? data.total_participants : rankings.length,
    top3_podium: Array.isArray(data.top3_podium) ? (data.top3_podium as LeaderboardEntry[]) : [],
    winners: Array.isArray(data.winners) ? (data.winners as LeaderboardEntry[]) : [],
    rankings,
    winner: asRecord(data) && isRecord(data.winner) ? (data.winner as unknown as LeaderboardEntry) : null,
    student_position: asRecord(data) && isRecord(data.student_position) ? (data.student_position as unknown as LeaderboardEntry) : null,
    nearby_rankings: Array.isArray(data.nearby_rankings) ? (data.nearby_rankings as LeaderboardEntry[]) : [],
  };
}