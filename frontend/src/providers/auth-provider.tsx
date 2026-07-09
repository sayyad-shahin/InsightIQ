import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/types/api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth lives in httpOnly cookies — probe the session by asking who we are.
  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.users.me());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshUser();
      setIsLoading(false);
    })();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    await api.auth.login({ email, password }); // sets httpOnly cookies
    setUser(await api.users.me());
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout(); // clears cookies server-side
    } catch {
      /* ignore network errors on logout */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
