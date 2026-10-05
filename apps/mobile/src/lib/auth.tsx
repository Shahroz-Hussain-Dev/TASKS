/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Preferences } from "@capacitor/preferences";
import type { AuthResponse, AuthTokens, DriverDto, UserDto } from "@raahi/shared";
import { api, onTokensChange, setTokens, ApiRequestError } from "./api";
import { loadApiBaseUrl } from "./config";

const TOKENS_KEY = "raahi.tokens";
const USER_KEY = "raahi.user";
const DRIVER_KEY = "raahi.driver";
const ROLE_PREF_KEY = "raahi.preferredRole";

interface AuthState {
  ready: boolean;
  user: UserDto | null;
  driver: DriverDto | null;
  /** Which app the person last used — remembered for the welcome screen. */
  preferredRole: "customer" | "driver";
}

interface AuthContextValue extends AuthState {
  applyAuth: (res: AuthResponse) => Promise<void>;
  refreshMe: () => Promise<void>;
  setDriver: (d: DriverDto | null) => void;
  setUser: (u: UserDto) => void;
  logout: () => Promise<void>;
  setPreferredRole: (r: "customer" | "driver") => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}
async function writeJson(key: string, value: unknown) {
  if (value === null || value === undefined) await Preferences.remove({ key });
  else await Preferences.set({ key, value: JSON.stringify(value) });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false, user: null, driver: null, preferredRole: "customer" });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    onTokensChange((t) => {
      void writeJson(TOKENS_KEY, t);
      if (!t) {
        void writeJson(USER_KEY, null);
        void writeJson(DRIVER_KEY, null);
        if (mounted.current) setState((s) => ({ ...s, user: null, driver: null }));
      }
    });
    (async () => {
      await loadApiBaseUrl();
      const [tokens, user, driver, role] = await Promise.all([
        readJson<AuthTokens>(TOKENS_KEY),
        readJson<UserDto>(USER_KEY),
        readJson<DriverDto>(DRIVER_KEY),
        Preferences.get({ key: ROLE_PREF_KEY }).then((r) => r.value).catch(() => null),
      ]);
      if (tokens) setTokens(tokens, false);
      if (!mounted.current) return;
      setState({ ready: true, user: tokens ? user : null, driver: tokens ? driver : null, preferredRole: role === "driver" ? "driver" : "customer" });
      if (tokens) {
        // Refresh profile in the background; a 401 here means the session died.
        api.me
          .get()
          .then((me) => {
            if (!mounted.current) return;
            setState((s) => ({ ...s, user: me.user, driver: me.driver }));
            void writeJson(USER_KEY, me.user);
            void writeJson(DRIVER_KEY, me.driver);
          })
          .catch((err) => {
            if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) setTokens(null);
          });
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyAuth = useCallback(async (res: AuthResponse) => {
    setTokens(res.tokens);
    await writeJson(USER_KEY, res.user);
    await writeJson(DRIVER_KEY, res.driver ?? null);
    const role = res.user.role === "driver" ? "driver" : "customer";
    await Preferences.set({ key: ROLE_PREF_KEY, value: role });
    setState((s) => ({ ...s, user: res.user, driver: res.driver ?? null, preferredRole: role }));
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await api.me.get();
    setState((s) => ({ ...s, user: me.user, driver: me.driver }));
    await writeJson(USER_KEY, me.user);
    await writeJson(DRIVER_KEY, me.driver);
  }, []);

  const setDriver = useCallback((d: DriverDto | null) => {
    setState((s) => ({ ...s, driver: d }));
    void writeJson(DRIVER_KEY, d);
  }, []);

  const setUser = useCallback((u: UserDto) => {
    setState((s) => ({ ...s, user: u }));
    void writeJson(USER_KEY, u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* offline logout is fine */
    }
    setTokens(null);
    setState((s) => ({ ...s, user: null, driver: null }));
  }, []);

  const setPreferredRole = useCallback((r: "customer" | "driver") => {
    setState((s) => ({ ...s, preferredRole: r }));
    void Preferences.set({ key: ROLE_PREF_KEY, value: r });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, applyAuth, refreshMe, setDriver, setUser, logout, setPreferredRole }),
    [state, applyAuth, refreshMe, setDriver, setUser, logout, setPreferredRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
