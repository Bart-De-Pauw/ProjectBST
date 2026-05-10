import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client";

export type Role = "Player" | "Captain" | "President";

export type Me = {
  playerId: number;
  username: string;
  fullName: string;
  gender: string;
  isActive: boolean;
  role: Role;
  email: string | null;
  emailOptIn: boolean;
};

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; me: Me };

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    const res = await apiFetch("/auth/me");
    if (res.status === 401) {
      setState({ status: "anonymous" });
      return;
    }
    if (!res.ok) {
      setState({ status: "anonymous" });
      return;
    }
    const me = (await res.json()) as Me;
    setState({ status: "authenticated", me });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      throw new Error("Login failed");
    }
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setState({ status: "anonymous" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () =>
      ({
        ...state,
        refresh,
        login,
        logout,
      }) as AuthContextValue,
    [state, refresh, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
