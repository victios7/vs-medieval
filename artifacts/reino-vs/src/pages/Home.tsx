import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, RANK_INFO } from "../api";
import { useAuth } from "../auth";

interface ProjItem {
  id: string; name: string; thumbnail?: string; ownerUsername: string;
  ownerRank: import("../api").Rank; loves: number; updatedAt: number;
}

export function HomePage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjItem[]>([]);
  const [globals, setGlobals] = useState<{ id: string; text: string; fromUsername: string; createdAt: number }[]>([]);

  useEffect(() => {
    api<{ projects: ProjItem[] }>("/projects").then((r) => setProjects(r.projects)).catch(() => {});
    api<{ messages: any[] }>("/global").then((r) => setGlobals(r.messages.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <section className="parchment p-8 mb-8 text-center">
        <h1 className="text-5xl mb-3">Bienvenido al Reino VS</h1>
        <p className="text-lg opacity-80 mb-5">
          Forja tus propios proyectos, únete a clanes, y asciende en el escalafón del reino.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          {user ? (
            <Link href="/editor/nuevo" className="gold-btn text-lg">⚒ Forjar nuevo proyecto</Link>
          ) : (
            <>
              <Link href="/unirse" className="gold-btn text-lg">⚔ Jurar lealtad</Link>
              <Link href="/entrar" className="stone-btn text-lg">Entrar</Link>
            </>
          )}
        </div>
      </section>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {(["campesino", "soldado", "noble", "magistrado", "rey"] as const).map((r) => {
          const info = RANK_INFO[r];
          return (
            <div key={r} className="parchment-thin p-4">
              <div className="text-2xl mb-1" style={{ color: info.color }}>{info.emoji} {info.label}</div>
              <p className="text-sm opacity-80">{info.desc}</p>
            </div>
          );
        })}
      </div>

      {globals.length > 0 && (
        <section className="parchment p-5 mb-8">
          <h2 className="text-2xl mb-3">📜 Proclamas Reales</h2>
          <ul className="space-y-2">
            {globals.map((m) => (
              <li key={m.id} className="border-l-4 border-yellow-700 pl-3 py-1">
                <div className="text-sm opacity-70">{m.fromUsername} · {new Date(m.createdAt).toLocaleString("es")}</div>
                <div className="font-semibold">{m.text}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-3xl mb-4">⚒ Proyectos del Reino</h2>
        {projects.length === 0 && <div className="parchment-thin p-6 text-center opacity-70">Aún no hay proyectos. ¡Sé el primero en forjar uno!</div>}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/proyecto/${p.id}`} className="parchment-thin overflow-hidden hover:scale-105 transition-transform">
              <div className="aspect-video bg-amber-100 flex items-center justify-center text-4xl">
                {p.thumbnail ? <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover" /> : "📜"}
              </div>
              <div className="p-3">
                <div className="font-bold truncate">{p.name}</div>
                <div className="text-xs opacity-70">por {p.ownerUsername} · ❤ {p.loves}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
