import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, csrfToken } from "../services/api";
export type AuthUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  must_change_password: boolean;
  roles: string[];
  effective_permissions: string[];
};
type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    async function restore() {
      try {
        if (!csrfToken()) return;
        const result = await apiRequest<{ access_token: string }>(
          "/auth/refresh",
          { method: "POST", headers: { "X-CSRF-TOKEN": csrfToken() } },
        );
        const current = await apiRequest<AuthUser>(
          "/auth/me",
          {},
          result.access_token,
        );
        if (alive) {
          setUser(current);
          setAccessToken(result.access_token);
        }
      } catch {
        if (alive) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!accessToken) return;
    const timer = window.setInterval(async () => {
      try {
        const result = await apiRequest<{ access_token: string }>(
          "/auth/refresh",
          { method: "POST", headers: { "X-CSRF-TOKEN": csrfToken() } },
        );
        const current = await apiRequest<AuthUser>(
          "/auth/me",
          {},
          result.access_token,
        );
        setAccessToken(result.access_token);
        setUser(current);
      } catch {
        setAccessToken(null);
        setUser(null);
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [accessToken]);
  async function login(username: string, password: string) {
    const result = await apiRequest<{ user: AuthUser; access_token: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) },
    );
    setUser(result.user);
    setAccessToken(result.access_token);
  }
  async function logout() {
    try {
      if (accessToken)
        await apiRequest("/auth/logout", { method: "POST" }, accessToken);
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        logout,
        hasPermission: (p) => user?.effective_permissions.includes(p) ?? false,
        hasRole: (r) => user?.roles.includes(r) ?? false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  return context;
}
