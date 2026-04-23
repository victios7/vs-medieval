import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, type PublicUser } from "./api";

interface AuthCtx {
  user: PublicUser | null;
  loading: boolean;
  banned: { reason: string } | null;
  tribute: { paid: number; recipient: string; type: string } | null;
  clearTribute: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, homeId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState<{ reason: string } | null>(null);
  const [tribute, setTribute] = useState<{ paid: number; recipient: string; type: string } | null>(null);

  async function refresh() {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const res = await api<{ user: PublicUser; banned?: boolean; banReason?: string; tribute?: { paid: number; recipient: string; type: string } | null }>("/auth/me");
      setUser(res.user);
      if (res.user.banned) setBanned({ reason: res.user.banReason || "Sin razón" });
      else setBanned(null);
      if (res.tribute && res.tribute.paid > 0) setTribute(res.tribute);
    } catch (e: any) {
      if (e.status === 401) { setToken(null); setUser(null); }
      if (e.status === 403 && e.data?.error === "BANEADO") {
        setBanned({ reason: e.data.reason || "Sin razón" });
      }
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function login(username: string, password: string) {
    const r = await api<{ token: string; user: PublicUser }>("/auth/login", {
      method: "POST", body: JSON.stringify({ username, password }),
    });
    setToken(r.token);
    setUser(r.user);
    if (r.user.banned) setBanned({ reason: r.user.banReason || "Sin razón" });
  }

  async function register(username: string, password: string, homeId: string) {
    const r = await api<{ token: string; user: PublicUser }>("/auth/register", {
      method: "POST", body: JSON.stringify({ username, password, homeId }),
    });
    setToken(r.token);
    setUser(r.user);
  }

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    setBanned(null);
  }

  return <Ctx.Provider value={{ user, loading, banned, tribute, clearTribute: () => setTribute(null), login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
