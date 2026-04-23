import { useEffect, useRef, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useAuth } from "../auth";
import { api, RANK_INFO, rankAtLeast } from "../api";

export function ProjectView() {
  const [, params] = useRoute<{ id: string }>("/proyecto/:id");
  const id = params?.id ?? "";
  const { user } = useAuth();
  const [, setLoc] = useLocation();
  const [data, setData] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [coinsToast, setCoinsToast] = useState<string | null>(null);
  const playedRef = useRef(false);

  async function load() {
    try { const r = await api(`/projects/${id}`); setData(r); } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, [id]);

  async function play() {
    if (playedRef.current) { setLoc(`/editor/${id}`); return; }
    playedRef.current = true;
    try {
      const r = await api<{ plays: number; coinsEarned: number }>(`/projects/${id}/play`, { method: "POST" });
      if (r.coinsEarned > 0 && data) {
        setCoinsToast(`+${r.coinsEarned} 🪙 para ${data.project.ownerUsername}`);
        setTimeout(() => setCoinsToast(null), 3000);
      }
    } catch { /* ignore */ }
    setLoc(`/editor/${id}`);
  }

  if (!data) return <div className="p-8 text-center">Buscando proyecto...</div>;
  const p = data.project;
  const ownerInfo = RANK_INFO[p.ownerRank as keyof typeof RANK_INFO];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {coinsToast && <div className="fixed top-20 right-4 gold-btn z-50">{coinsToast}</div>}

      <div className="parchment p-5 mb-4">
        <h1 className="text-3xl mb-1">{p.name}</h1>
        <div className="text-sm opacity-80 mb-3">
          por <Link href={`/u/${p.ownerUsername}`} className="font-bold underline" style={{ color: ownerInfo.color }}>
            {ownerInfo.emoji} {p.ownerUsername}
          </Link>
          <span className="ml-3">🎯 {p.plays ?? 0} jugadas · ❤ {p.loves.length}</span>
        </div>
        <div className="bg-amber-100 border-2 border-amber-900 rounded p-3 font-mono text-xs whitespace-pre-wrap max-h-80 overflow-y-auto">{p.code}</div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button className="gold-btn" onClick={play}>▶ Jugar / Editar</button>
          <button className="stone-btn" onClick={async () => {
            if (!user) { setLoc("/entrar"); return; }
            const r = await api(`/projects/${id}/love`, { method: "POST" }) as { loves: number };
            setData({ ...data, project: { ...p, loves: Array(r.loves).fill("x") } });
          }}>❤ {p.loves.length}</button>
          {(user?.id === p.ownerId || rankAtLeast(user, "magistrado")) && (
            <button className="danger-btn" onClick={async () => {
              if (!confirm("¿Borrar este proyecto?")) return;
              await api(`/projects/${id}`, { method: "DELETE" });
              setLoc("/");
            }}>Borrar</button>
          )}
        </div>
      </div>

      <div className="parchment-thin p-4">
        <h2 className="font-bold mb-2">💬 Comentarios</h2>
        {user && (
          <div className="flex gap-2 mb-3">
            <input className="input-medieval flex-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comparte tu opinión..." />
            <button className="gold-btn" onClick={async () => { await api(`/projects/${id}/comment`, { method: "POST", body: JSON.stringify({ text: comment }) }); setComment(""); load(); }}>Enviar</button>
          </div>
        )}
        {data.comments.length === 0 && <div className="opacity-70 text-sm">Aún no hay comentarios.</div>}
        {data.comments.map((c: any) => (
          <div key={c.id} className="border-b border-amber-700/20 py-2">
            <div className="text-sm"><Link href={`/u/${c.username}`} className="font-bold">{c.username}</Link>
              <span className="ranged-tag ml-2" style={{ background: RANK_INFO[c.rank as keyof typeof RANK_INFO].color + "33", color: RANK_INFO[c.rank as keyof typeof RANK_INFO].color }}>{RANK_INFO[c.rank as keyof typeof RANK_INFO].emoji}</span>
            </div>
            <div>{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectsListPage() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { api<{ projects: any[] }>("/projects").then((r) => setList(r.projects)); }, []);
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-4xl mb-4">⚒ Proyectos del Reino</h1>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {list.map((p) => (
          <Link key={p.id} href={`/proyecto/${p.id}`} className="parchment-thin overflow-hidden hover:scale-105 transition-transform">
            <div className="aspect-video bg-amber-100 flex items-center justify-center text-4xl">📜</div>
            <div className="p-3"><div className="font-bold truncate">{p.name}</div><div className="text-xs opacity-70">por {p.ownerUsername} · ❤ {p.loves} · 🎯 {p.plays ?? 0}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
