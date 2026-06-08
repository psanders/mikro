/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clearToken,
  clearUserName,
  getToken,
  getUserName,
  setToken,
  setUserName
} from "../lib/auth";
import { onSessionExpired } from "../lib/session";

interface LoginResult {
  token: string;
  name: string;
}

interface AuthState {
  /** True until the stored token has been checked on launch. */
  loading: boolean;
  isAuthenticated: boolean;
  userName: string | null;
  /** Persist a successful login and enter the authenticated area. */
  completeLogin: (result: LoginResult) => Promise<void>;
  /** Clear the session and return to login. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setTokenState] = useState<string | null>(null);
  const [userName, setUserNameState] = useState<string | null>(null);

  // Restore the session on launch from the stored token (30-day JWT).
  useEffect(() => {
    let active = true;
    void (async () => {
      const [storedToken, storedName] = await Promise.all([getToken(), getUserName()]);
      if (!active) return;
      setTokenState(storedToken);
      setUserNameState(storedName);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function completeLogin(result: LoginResult): Promise<void> {
    await Promise.all([setToken(result.token), setUserName(result.name)]);
    setTokenState(result.token);
    setUserNameState(result.name);
  }

  async function logout(): Promise<void> {
    await Promise.all([clearToken(), clearUserName()]);
    setTokenState(null);
    setUserNameState(null);
  }

  // A 401 from any request means the session expired — log out cleanly.
  useEffect(() => {
    return onSessionExpired(() => {
      void logout();
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      isAuthenticated: token !== null,
      userName,
      completeLogin,
      logout
    }),
    [loading, token, userName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
