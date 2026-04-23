export type Rank = "campesino" | "soldado" | "noble" | "magistrado" | "rey";

export interface PublicUser {
  id: string;
  username: string;
  rank: Rank;
  title?: string;
  bio?: string;
  avatar?: string;
  banned: boolean;
  banReason?: string;
  banBy?: string;
  coins: number;
  coinsEarnedToday?: number;
  lastTribute?: { day: string; paid: number; recipient: string; type: string };
  homeId?: string;
  createdAt: number;
}

export type LocationType = "pueblo" | "ciudad" | "capital";

export interface MapLocation {
  id: string;
  name: string;
  type: LocationType;
  x: number;
  y: number;
  ownerId?: string | null;
  description?: string;
  owner?: { id: string; username: string; rank: Rank } | null;
  population?: number;
}

export interface TributeReceipt { paid: number; recipient: string; type: string }

const TOKEN_KEY = "reino_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["x-session"] = token;
  const res = await fetch(`/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const msg = data?.error || `Error ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; data?: any };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export const RANK_INFO: Record<Rank, {
  label: string; color: string; emoji: string; desc: string;
  domainNoun: string; domainPrefix: string;
  coinsPerPlay: number;
}> = {
  campesino: {
    label: "Campesino", color: "#7a5a2c", emoji: "🌾",
    desc: "Habitante humilde del reino",
    domainNoun: "cultivos", domainPrefix: "Los cultivos de",
    coinsPerPlay: 1,
  },
  soldado: {
    label: "Soldado", color: "#4a4a52", emoji: "⚔",
    desc: "Defensor de las murallas",
    domainNoun: "batallas", domainPrefix: "Las batallas de",
    coinsPerPlay: 2,
  },
  noble: {
    label: "Noble", color: "#7a3690", emoji: "♛",
    desc: "Conde o Duque, dueño de pueblos y ciudades",
    domainNoun: "señorío", domainPrefix: "El señorío de",
    coinsPerPlay: 5,
  },
  magistrado: {
    label: "Magistrado", color: "#1f4e7a", emoji: "⚖",
    desc: "Juez del reino, puede desterrar",
    domainNoun: "tribunal", domainPrefix: "El tribunal de",
    coinsPerPlay: 8,
  },
  rey: {
    label: "Rey", color: "#c0902a", emoji: "👑",
    desc: "Soberano del Reino VS",
    domainNoun: "reino", domainPrefix: "El reino de",
    coinsPerPlay: 15,
  },
};

export function rankDomain(u: PublicUser): string {
  return `${RANK_INFO[u.rank].domainPrefix} ${u.username}`;
}

export const RANK_ORDER: Rank[] = ["campesino", "soldado", "noble", "magistrado", "rey"];
export function rankAtLeast(u: PublicUser | null | undefined, r: Rank): boolean {
  if (!u) return false;
  return RANK_ORDER.indexOf(u.rank) >= RANK_ORDER.indexOf(r);
}
