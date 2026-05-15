import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "@workspace/db";
import { authApi, getApiToken, setApiToken, setUnauthorizedHandler } from "./lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(Boolean(getApiToken()));

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!getApiToken()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const result = await authApi.login(email, password);
        setApiToken(result.token);
        setUser(result.user);
      },
      logout: () => {
        setApiToken(null);
        setUser(null);
      }
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}

export function canManageSessions(user: AuthUser | null) {
  return user?.role === "admin" || user?.role === "coordinator";
}

export function canAdminister(user: AuthUser | null) {
  return user?.role === "admin";
}
