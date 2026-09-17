// Typed contracts for the backend API responses (Django REST Framework).
// Field names mirror the serializer output. Optional fields exist where the
// backend may omit a value.

export interface LeaderboardEntry {
  rank: number;
  participant_id: string | number;
  name: string;
  email: string;
  college_name: string;
  event_code: string;
  score: number;
  completed: number;
  time_taken: string;
  is_current_user: boolean;
  // Not part of the current serializer contract; preserved only because the
  // leaderboard "Currently Active" stat reads it. Remove once the backend
  // exposes real activity/status data.
  is_active?: boolean;
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

export interface AdminRecentEvent {
  id?: string;
  workshop_name: string;
  college_name: string;
  status: string;
  event_date: string;
  enrolled_participants?: number;
  participants_count?: number;
}

export interface AdminDashboardSummary {
  total_events: number;
  live_events: number;
  completed_events: number;
  total_participants: number;
  total_challenges: number;
  total_questions: number;
  average_score: number;
  completion_rate: number;
}

export interface AdminDashboardData {
  success?: boolean;
  summary?: AdminDashboardSummary;
  recent_events?: AdminRecentEvent[];
  recent_activity?: string[];
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

export interface AdminQuestionItem {
  id?: string;
  question?: string;
  question_text?: string;
  prompt?: string;
  category?: string;
  difficulty?: string;
  default_points?: number;
  marks?: number;
  status?: string;
  options?: string[];
  options_json?: string[] | string;
  correct_option_index?: number;
  correct?: number;
  explanation?: string;
}

export interface QuestionImportItem {
  question: string;
  question_text?: string;
  category?: string;
  difficulty?: string;
  default_points?: number;
  marks?: number;
  options?: string[];
  correct?: number;
}

export interface AdminParticipantItem {
  id?: string | number;
  name?: string;
  email?: string;
  college_name?: string;
  event_code?: string;
  event?: {
    college_name?: string;
    event_code?: string;
  };
  score?: number;
  completed?: number;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
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