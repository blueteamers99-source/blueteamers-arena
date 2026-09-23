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

// Legacy keys that older versions of the app used. They are no longer written,
// but may still exist in browsers from before the consolidation to a single
// key — removed during logout so stale tokens never survive.
const LEGACY_STUDENT_TOKEN_KEYS = ["blueteamers_participant_token", "blueteamers_access_token"];

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
  // Migration safety net: purge legacy token keys from both storage types.
  for (const key of LEGACY_STUDENT_TOKEN_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export const isStudentLoggedIn = (): boolean => {
  const user = getStudentUser();
  return !!user && (user.role === "STUDENT" || !user.role);
};

// ---------------------------------------------------------------------------
// authFetch factory
// ---------------------------------------------------------------------------

interface AuthFetchConfig {
  /** localStorage key for the access token */
  tokenKey: string;
  /** localStorage key for the refresh token */
  refreshKey: string;
  /** Backend endpoint to POST the refresh token to */
  refreshEndpoint: string;
  /** URL to redirect to when refresh fails */
  loginUrl: string;
  /** Function to clear stored auth state on failure */
  clearAuth: () => void;
}

/**
 * Factory that creates a drop-in fetch() replacement with:
 *  1. Automatic Authorization header attachment.
 *  2. Silent token refresh on 401 responses.
 *  3. Request queuing so only one refresh call is made at a time.
 *  4. Auth clear + redirect when refresh fails.
 *  5. Correct Content-Type handling for FormData uploads.
 */
function createAuthFetch(config: AuthFetchConfig) {
  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((entry) => {
      if (error) {
        entry.reject(error);
      } else if (token) {
        entry.resolve(token);
      } else {
        entry.reject(new Error("Token refresh failed."));
      }
    });
    failedQueue = [];
  };

  const refreshToken = async (): Promise<string> => {
    const storedRefresh = isBrowser ? localStorage.getItem(config.refreshKey) : null;

    if (!storedRefresh) {
      config.clearAuth();
      window.location.href = config.loginUrl;
      throw new Error("No refresh token — redirecting to login.");
    }

    const res = await fetch(`${API_BASE_URL}${config.refreshEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: storedRefresh }),
    });

    const body = await res.json();

    if (res.ok && body.success && body.data?.access) {
      const newToken: string = body.data.access;
      if (isBrowser) localStorage.setItem(config.tokenKey, newToken);
      return newToken;
    }

    config.clearAuth();
    window.location.href = config.loginUrl;
    throw new Error("Refresh token invalid — redirecting to login.");
  };

  return async function authFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const headers = new Headers(init?.headers);

    const token = isBrowser ? localStorage.getItem(config.tokenKey) : null;
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(input, { ...init, headers });

    if (response.status !== 401) {
      return response;
    }

    if (isRefreshing) {
      const newToken = await new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });

      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      if (!retryHeaders.has("Content-Type") && !(init?.body instanceof FormData)) {
        retryHeaders.set("Content-Type", "application/json");
      }
      return fetch(input, { ...init, headers: retryHeaders });
    }

    isRefreshing = true;

    try {
      const newToken = await refreshToken();
      processQueue(null, newToken);

      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      if (!retryHeaders.has("Content-Type") && !(init?.body instanceof FormData)) {
        retryHeaders.set("Content-Type", "application/json");
      }
      return fetch(input, { ...init, headers: retryHeaders });
    } catch (err) {
      processQueue(err);
      throw err;
    } finally {
      isRefreshing = false;
    }
  };
}

/** Drop-in replacement for fetch() for student pages. */
export const studentAuthFetch = createAuthFetch({
  tokenKey: STUDENT_ACCESS_KEY,
  refreshKey: STUDENT_REFRESH_KEY,
  refreshEndpoint: "/auth/token/refresh/",
  loginUrl: "/login",
  clearAuth: clearStudentAuth,
});
