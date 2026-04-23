import { Link, useLocation } from "wouter";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../auth";
import { RANK_INFO, api, rankAtLeast } from "../api";

export function RankBadge({ rank, username }: { rank: import("../api").Rank; username?: string }) {
  const r = RANK_INFO[rank];
  return (
    <span className="ranged-tag" style={{ background: r.color + "22", color: r.color, borderColor: r.color }}>
      {r.emoji} {username ? `${username} · ${r.label}` : r.label}
    </span>
  );
}

export function GlobalBanner() {
  const [msgs, setMsgs] = useState<{ id: string; text: string; fromUsername: string; createdAt: number }[]>([]);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await api<{ messages: any[] }>("/global");
        if (alive) setMsgs(r.messages.slice(0, 1));
      } catch { /* ignore */ }
    }
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (msgs.length === 0) return null;
  const m = msgs[0]!;
  return (
    <div style={{
      background: "linear-gradient(90deg, #c0902a, #f4cd5b, #c0902a)",
      borderBottom: "3px solid #6b4a1f", color: "#2a1808", padding: "6px 14px",
      fontWeight: 700, textAlign: "center", fontSize: 14,
    }}>
      📜 Proclama del Rey {m.fromUsername}: {m.text}
    </div>
  );
}

function TributeToast() {
  const { tribute, clearTribute } = useAuth();
  useEffect(() => {
    if (!tribute) return;
    const t = setTimeout(clearTribute, 8000);
    return () => clearTimeout(t);
  }, [tribute]);
  if (!tribute) return null;
  return (
    <div onClick={clearTribute} className="fixed top-20 right-4 z-50 cursor-pointer parchment p-4 max-w-sm shadow-2xl"
      style={{ borderColor: "#c0902a", animation: "slideIn 0.4s ease" }}>
      <div className="font-bold text-lg" style={{ color: "#7a1f1f" }}>📜 Tributo del Día</div>
      <div className="text-sm mt-1">Has pagado <strong>🪙 {tribute.paid}</strong> de oro.</div>
      <div className="text-xs opacity-80 mt-1">{tribute.type}</div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [, setLoc] = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <GlobalBanner />
      <TributeToast />
      <header className="royal-bar px-4 py-2 flex items-center gap-4">
        <Link href="/" className="text-2xl font-extrabold tracking-wider" style={{ fontFamily: "MedievalSharp" }}>
          ⚔ Reino VS
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="hover:text-yellow-200">Plaza</Link>
          <Link href="/proyectos" className="hover:text-yellow-200">Proyectos</Link>
          <Link href="/mapa" className="hover:text-yellow-200">🗺 Mapa</Link>
          {user && <Link href="/editor/nuevo" className="hover:text-yellow-200">Forjar Proyecto</Link>}
          {user && <Link href="/chat" className="hover:text-yellow-200">Mensajes</Link>}
          {user && rankAtLeast(user, "noble") && <Link href="/corte" className="hover:text-yellow-200">⚜ Corte</Link>}
          {user && rankAtLeast(user, "noble") && <Link href="/panel" className="hover:text-yellow-200">Panel</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href={`/u/${user.username}`} className="flex items-center gap-2">
                <RankBadge rank={user.rank} username={user.username} />
              </Link>
              <button className="stone-btn" onClick={async () => { await logout(); setLoc("/"); }}>Salir</button>
            </>
          ) : (
            <>
              <Link href="/entrar" className="gold-btn">Entrar</Link>
              <Link href="/unirse" className="stone-btn">Unirse al Reino</Link>
            </>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="text-center text-xs py-3 opacity-70">Reino VS · Forjado con honor · {new Date().getFullYear()}</footer>
    </div>
  );
}
