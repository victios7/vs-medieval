import { useEffect, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { api, RANK_INFO, rankDomain, type PublicUser } from "../api";
import { useAuth } from "../auth";
import { RankBadge } from "../components/Shell";

export function ProfilePage() {
  const [, params] = useRoute<{ username: string }>("/u/:username");
  const username = params?.username ?? "";
  const { user: me } = useAuth();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [, setLoc] = useLocation();

  async function load() {
    try {
      const r = await api<{ user: PublicUser; projects: any[] }>(`/users/${username}`);
      setUser(r.user); setProjects(r.projects); setBio(r.user.bio ?? "");
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, [username]);

  if (!user) return <div className="p-8 text-center">Buscando heraldo...</div>;
  const isMe = me?.id === user.id;
  const info = RANK_INFO[user.rank];
  const totalPlays = projects.reduce((a, p) => a + (p.plays ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Rank-themed banner */}
      <div className="parchment p-6 mb-6" style={{
        background: `linear-gradient(135deg, ${info.color}22 0%, #fbf2d9 60%)`,
        borderColor: info.color,
      }}>
        <div className="flex gap-5 items-center">
          <div className="text-7xl" style={{ color: info.color, textShadow: "2px 2px 0 #00000022" }}>{info.emoji}</div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest opacity-70" style={{ color: info.color }}>{info.label}</div>
            <h1 className="text-4xl" style={{ color: info.color }}>{rankDomain(user)}</h1>
            <div className="mt-1"><RankBadge rank={user.rank} /></div>
            {user.title && <div className="italic mt-1 opacity-80">"{user.title}"</div>}
            {user.banned && (
              <div className="mt-2 bg-red-100 border-2 border-red-700 text-red-800 p-2 rounded text-sm font-bold">
                ⛓ DESTERRADO · {user.banReason}
              </div>
            )}
          </div>
          {isMe && <button className="stone-btn" onClick={() => setEditing(!editing)}>Editar</button>}
        </div>
      </div>

      {/* Treasury stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="parchment-thin p-4 text-center">
          <div className="text-3xl">🪙</div>
          <div className="text-2xl font-bold" style={{ color: "#c0902a" }}>{user.coins}</div>
          <div className="text-xs opacity-70">monedas de oro</div>
        </div>
        <div className="parchment-thin p-4 text-center">
          <div className="text-3xl">⚒</div>
          <div className="text-2xl font-bold">{projects.length}</div>
          <div className="text-xs opacity-70">obras forjadas</div>
        </div>
        <div className="parchment-thin p-4 text-center">
          <div className="text-3xl">🎯</div>
          <div className="text-2xl font-bold">{totalPlays}</div>
          <div className="text-xs opacity-70">veces jugado</div>
        </div>
      </div>

      <div className="parchment-thin p-4 mb-4 text-xs opacity-80 text-center">
        💰 Por cada vez que un visitante juega tus obras, ganas <strong>{info.coinsPerPlay}</strong> {info.coinsPerPlay === 1 ? "moneda" : "monedas"} de oro
        (tarifa de <strong>{info.label}</strong>).
      </div>

      <div className="parchment-thin p-5 mb-6">
        {editing ? (
          <>
            <textarea className="input-medieval w-full mb-2" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cuenta tu historia..." />
            <button className="gold-btn" onClick={async () => {
              await api(`/users/${user.id}/profile`, { method: "POST", body: JSON.stringify({ bio }) });
              setEditing(false); load();
            }}>Guardar</button>
          </>
        ) : (
          <p className="whitespace-pre-wrap">{user.bio || <span className="opacity-60">Sin biografía</span>}</p>
        )}
      </div>

      <h2 className="text-2xl mb-3">⚒ Obras públicas</h2>
      {projects.length === 0 && <div className="parchment-thin p-4 opacity-70">Aún no ha forjado ningún proyecto público.</div>}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Link key={p.id} href={`/proyecto/${p.id}`} className="parchment-thin p-3">
            <div className="font-bold">{p.name}</div>
            <div className="text-xs opacity-70">❤ {p.loves} · 🎯 {p.plays ?? 0}</div>
          </Link>
        ))}
      </div>

      {me && me.id !== user.id && (
        <div className="mt-6 flex gap-3">
          <button className="gold-btn" onClick={() => setLoc(`/chat/${user.id}`)}>📜 Enviar pergamino</button>
        </div>
      )}
    </div>
  );
}
