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
