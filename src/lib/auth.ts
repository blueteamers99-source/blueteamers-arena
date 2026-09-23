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

// ---------------------------------------------------------------------------
// Server-side session verification (anti response-tampering guard)
// ---------------------------------------------------------------------------

async function verifyTokenAgainstEndpoint(
  endpoint: string,
  allowRefresh: boolean,
  tokenOverride?: string,
): Promise<boolean> {
  if (!isBrowser) return false;
  const token = tokenOverride ?? localStorage.getItem(STUDENT_ACCESS_KEY);
  if (!token) return false;

  try {
    // allowRefresh=true routes through studentAuthFetch so an expired access
    // token is silently refreshed (and a dead refresh token redirects to
    // /login). Fresh-login flows pass false: the token was just minted and a
    // plain fetch avoids any redirect side effects during the login handler.
    const doFetch = allowRefresh && !tokenOverride ? studentAuthFetch : fetch;
    const res = await doFetch(`${API_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const body: unknown = await res.json().catch(() => null);
    // Backend contract: success_response() wraps every success as {success: true}.
    return (
      !!body &&
      typeof body === "object" &&
      (body as { success?: unknown }).success === true
    );
  } catch {
    return false;
  }
}

/**
 * Proves the stored student token is genuinely valid by calling a real
 * protected endpoint. The server verifies the JWT cryptographically, so a
 * tampered login response (e.g. Burp rewriting 400 -> 200) can never pass:
 * such responses carry no token the backend will accept.
 *
 * Routing rule: the two token types are NOT interchangeable.
 *  - "user" tokens come from /auth/login and /auth/signup and only
 *    authenticate on /auth/me/ (SimpleJWT).
 *  - "participant" tokens come from /participants/register-student and
 *    carry a participant_id claim, authenticating only on /progress/
 *    (ParticipantTokenAuthentication).
 */
export function verifyServerSession(
  kind: "user" | "participant",
  allowRefresh = false,
  tokenOverride?: string,
): Promise<boolean> {
  return verifyTokenAgainstEndpoint(
    kind === "user" ? "/auth/me/" : "/progress/",
    allowRefresh,
    tokenOverride,
  );
}

/**
 * Dashboard guard helper: /dashboard is reachable through both login flows
 * (user tokens via the AuthCard, participant tokens via the arena gate), so
 * accept either token type as long as the server accepts one of them.
 */
export async function verifyAnyStudentSession(allowRefresh = false): Promise<boolean> {
  const isParticipant = await verifyServerSession("participant", allowRefresh);
  if (isParticipant) return true;
  return verifyServerSession("user", allowRefresh);
}
