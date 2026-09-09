import { API_BASE_URL } from "@/lib/config";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "STUDENT";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  college?: string;
  department?: string;
  role: UserRole;
  is_email_verified?: boolean;
};

// Student Token Keys
const STUDENT_ACCESS_KEY = "student_access_token";
const STUDENT_REFRESH_KEY = "student_refresh_token";
const STUDENT_USER_KEY = "student_user";

// Admin Token Keys
const ADMIN_ACCESS_KEY = "admin_access_token";
const ADMIN_REFRESH_KEY = "admin_refresh_token";
const ADMIN_USER_KEY = "admin_user";

const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";

// Student Auth Helpers
export const setStudentAuth = (tokens: { access: string; refresh: string }, user: AuthUser) => {
  if (!isBrowser) return;
  localStorage.setItem(STUDENT_ACCESS_KEY, tokens.access);
  localStorage.setItem(STUDENT_REFRESH_KEY, tokens.refresh);
  localStorage.setItem(STUDENT_USER_KEY, JSON.stringify(user));
};

export const getStudentUser = (): AuthUser | null => {
  if (!isBrowser) return null;
  const raw = localStorage.getItem(STUDENT_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getStudentAccessToken = (): string | null => {
  if (!isBrowser) return null;
  return localStorage.getItem(STUDENT_ACCESS_KEY);
};

export const clearStudentAuth = () => {
  if (!isBrowser) return;
  localStorage.removeItem(STUDENT_ACCESS_KEY);
  localStorage.removeItem(STUDENT_REFRESH_KEY);
  localStorage.removeItem(STUDENT_USER_KEY);
};

export const isStudentLoggedIn = (): boolean => {
  const user = getStudentUser();
  return !!user && (user.role === "STUDENT" || !user.role);
};

// Admin Auth Helpers
export const setAdminAuth = (tokens: { access: string; refresh: string }, user: AuthUser) => {
  if (!isBrowser) return;
  localStorage.setItem(ADMIN_ACCESS_KEY, tokens.access);
  localStorage.setItem(ADMIN_REFRESH_KEY, tokens.refresh);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
};

export const getAdminUser = (): AuthUser | null => {
  if (!isBrowser) return null;
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getAdminAccessToken = (): string | null => {
  if (!isBrowser) return null;
  return localStorage.getItem(ADMIN_ACCESS_KEY);
};

export const clearAdminAuth = () => {
  if (!isBrowser) return;
  localStorage.removeItem(ADMIN_ACCESS_KEY);
  localStorage.removeItem(ADMIN_REFRESH_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
};

export const isAdminLoggedIn = (): boolean => {
  const user = getAdminUser();
  return !!user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
};

// ---------------------------------------------------------------------------
// Token refresh helpers (private)
// ---------------------------------------------------------------------------

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

let isStudentRefreshing = false;
let studentFailedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

/** Resolve or reject every request that was queued while a refresh was in-flight. */
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((entry) => {
    if (error) entry.reject(error);
    else entry.resolve(token!);
  });
  failedQueue = [];
};

const processStudentQueue = (error: unknown, token: string | null = null) => {
  studentFailedQueue.forEach((entry) => {
    if (error) entry.reject(error);
    else entry.resolve(token!);
  });
  studentFailedQueue = [];
};

/**
 * Attempt to silently refresh the admin access token using the stored
 * refresh token.  Returns the new access token on success.
 * On failure (expired/missing refresh token) clears auth and redirects
 * the browser to the admin login page — this call never returns.
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = isBrowser ? localStorage.getItem(ADMIN_REFRESH_KEY) : null;

  if (!refreshToken) {
    clearAdminAuth();
    window.location.href = "/admin/login";
    throw new Error("No refresh token — redirecting to login.");
  }

  const res = await fetch(`${API_BASE_URL}/admin/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  const body = await res.json();

  if (res.ok && body.success && body.data?.access) {
    const newToken: string = body.data.access;
    if (isBrowser) localStorage.setItem(ADMIN_ACCESS_KEY, newToken);
    return newToken;
  }

  // Refresh token itself is invalid / expired — force re-login
  clearAdminAuth();
  window.location.href = "/admin/login";
  throw new Error("Refresh token invalid — redirecting to login.");
}

// ---------------------------------------------------------------------------
// authFetch — drop-in replacement for fetch()
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for fetch() that:
 *  1. Automatically attaches the admin Authorization header.
 *  2. On a 401 response, silently refreshes the access token and retries.
 *  3. If multiple requests 401 simultaneously, only one refresh call is made
 *     and all queued requests are retried once the new token arrives.
 *  4. If the refresh itself fails (expired refresh token), clears auth state
 *     and redirects to the admin login page.
 *  5. For FormData uploads the Content-Type header is left to the browser so
 *     the multipart boundary is set correctly.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  const token = isBrowser ? localStorage.getItem(ADMIN_ACCESS_KEY) : null;
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Only set Content-Type for non-FormData bodies so the browser can
  // generate the correct multipart boundary for file uploads.
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });

  // ---- Not a 401 → return immediately as-is ----
  if (response.status !== 401) {
    return response;
  }

  // ---- 401 received → attempt token refresh ----

  // If a refresh is already in-flight, queue this request and wait
  if (isRefreshing) {
    const newToken = await new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });

    // Retry with the freshly obtained token
    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("Authorization", `Bearer ${newToken}`);
    if (!retryHeaders.has("Content-Type") && !(init?.body instanceof FormData)) {
      retryHeaders.set("Content-Type", "application/json");
    }
    return fetch(input, { ...init, headers: retryHeaders });
  }

  // We are the first request to hit 401 — own the refresh
  isRefreshing = true;

  try {
    const newToken = await refreshAccessToken();

    // Notify any requests that were queued while we were refreshing
    processQueue(null, newToken);

    // Retry the original request with the new token
    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("Authorization", `Bearer ${newToken}`);
    if (!retryHeaders.has("Content-Type") && !(init?.body instanceof FormData)) {
      retryHeaders.set("Content-Type", "application/json");
    }
    return fetch(input, { ...init, headers: retryHeaders });
  } catch (err) {
    // Refresh failed — reject every queued request so callers' .catch() fires
    processQueue(err);
    throw err;
  } finally {
    isRefreshing = false;
  }
}

// ---------------------------------------------------------------------------
// Student token refresh helpers (private)
// ---------------------------------------------------------------------------

/**
 * Attempt to silently refresh the student access token using the stored
 * refresh token. Returns the new access token on success.
 * On failure (expired/missing refresh token) clears auth and redirects
 * the browser to the login page.
 */
async function refreshStudentAccessToken(): Promise<string> {
  const refreshToken = isBrowser ? localStorage.getItem(STUDENT_REFRESH_KEY) : null;

  if (!refreshToken) {
    clearStudentAuth();
    window.location.href = "/login";
    throw new Error("No refresh token — redirecting to login.");
  }

  const res = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  const body = await res.json();

  if (res.ok && body.success && body.data?.access) {
    const newToken: string = body.data.access;
    if (isBrowser) localStorage.setItem(STUDENT_ACCESS_KEY, newToken);
    return newToken;
  }

  // Refresh token itself is invalid / expired — force re-login
  clearStudentAuth();
  window.location.href = "/login";
  throw new Error("Refresh token invalid — redirecting to login.");
}

// ---------------------------------------------------------------------------
// studentAuthFetch — drop-in replacement for fetch() for student pages
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for fetch() for student-facing pages that:
 *  1. Automatically attaches the student Authorization header.
 *  2. On a 401 response, silently refreshes the access token and retries.
 *  3. If multiple requests 401 simultaneously, only one refresh call is made
 *     and all queued requests are retried once the new token arrives.
 *  4. If the refresh itself fails (expired refresh token), clears auth state
 *     and redirects to the student login page.
 *  5. For FormData uploads the Content-Type header is left to the browser so
 *     the multipart boundary is set correctly.
 */
export async function studentAuthFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  const token = isBrowser ? localStorage.getItem(STUDENT_ACCESS_KEY) : null;
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });

  // ---- Not a 401 → return immediately as-is ----
  if (response.status !== 401) {
    return response;
  }

  // ---- 401 received → attempt token refresh ----

  // If a refresh is already in-flight, queue this request and wait
  if (isStudentRefreshing) {
    const newToken = await new Promise<string>((resolve, reject) => {
      studentFailedQueue.push({ resolve, reject });
    });

    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("Authorization", `Bearer ${newToken}`);
    if (!retryHeaders.has("Content-Type") && !(init?.body instanceof FormData)) {
      retryHeaders.set("Content-Type", "application/json");
    }
    return fetch(input, { ...init, headers: retryHeaders });
  }

  // We are the first request to hit 401 — own the refresh
  isStudentRefreshing = true;

  try {
    const newToken = await refreshStudentAccessToken();

    // Notify any requests that were queued while we were refreshing
    processStudentQueue(null, newToken);

    // Retry the original request with the new token
    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("Authorization", `Bearer ${newToken}`);
    if (!retryHeaders.has("Content-Type") && !(init?.body instanceof FormData)) {
      retryHeaders.set("Content-Type", "application/json");
    }
    return fetch(input, { ...init, headers: retryHeaders });
  } catch (err) {
    // Refresh failed — reject every queued request so callers' .catch() fires
    processStudentQueue(err);
    throw err;
  } finally {
    isStudentRefreshing = false;
  }
}
