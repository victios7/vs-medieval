import { useEffect, useState } from "react";
import { api, RANK_INFO, type PublicUser, type Rank, rankAtLeast } from "../api";
import { useAuth } from "../auth";

export function AdminPanel() {
  const { user: me, refresh } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [globalText, setGlobalText] = useState("");
  const [globals, setGlobals] = useState<any[]>([]);
  const [tab, setTab] = useState<"usuarios" | "proclamas" | "tesoro">("usuarios");
  const [filter, setFilter] = useState("");

  async function load() {
    const r = await api<{ users: PublicUser[] }>("/users");
    setUsers(r.users.sort((a, b) => {
      const order = ["rey", "magistrado", "noble", "soldado", "campesino"];
      return order.indexOf(a.rank) - order.indexOf(b.rank);
    }));
    const g = await api<{ messages: any[] }>("/global");
    setGlobals(g.messages);
  }
  useEffect(() => { load(); }, []);

  if (!me) return <div className="p-8 text-center">Necesitas entrar.</div>;
  if (!rankAtLeast(me, "noble")) {
    return <div className="p-8 text-center parchment max-w-md mx-auto mt-12">Solo nobles, magistrados y el Rey pueden entrar al panel.</div>;
  }

  async function setRank(u: PublicUser, rank: Rank) {
    if (!confirm(`¿Otorgar el rango de ${RANK_INFO[rank].label} a ${u.username}?`)) return;
    try {
      await api("/admin/rank", { method: "POST", body: JSON.stringify({ userId: u.id, rank }) });
      await load();
      if (u.id === me!.id) await refresh();
    }
    catch (e: any) { alert(e.message); }
  }
  async function ban(u: PublicUser) {
    const reason = prompt(`Razón del destierro de ${u.username}:`, "violación del código del reino");
    if (reason === null) return;
    const scope = me!.rank === "noble" ? prompt("¿De qué territorio?", "ducado") : null;
    try { await api("/admin/ban", { method: "POST", body: JSON.stringify({ userId: u.id, reason, scope }) }); load(); }
    catch (e: any) { alert(e.message); }
  }
  async function unban(u: PublicUser) {
    if (!confirm(`¿Perdonar a ${u.username}?`)) return;
    try { await api("/admin/unban", { method: "POST", body: JSON.stringify({ userId: u.id }) }); load(); }
    catch (e: any) { alert(e.message); }
  }
  async function giveCoins(u: PublicUser) {
    const v = prompt(`Otorgar/quitar oro a ${u.username} (negativo para confiscar):`, "100");
    if (v === null) return;
    const n = parseInt(v, 10);
    if (isNaN(n)) return;
    try {
      await api("/admin/coins", { method: "POST", body: JSON.stringify({ userId: u.id, delta: n }) });
      load();
    } catch (e: any) { alert(e.message); }
  }
  async function sendGlobal() {
    if (!globalText.trim()) return;
    try {
      await api("/admin/global", { method: "POST", body: JSON.stringify({ text: globalText }) });
      setGlobalText(""); load();
    } catch (e: any) { alert(e.message); }
  }
  async function deleteGlobal(id: string) {
    try { await api(`/admin/global/${id}`, { method: "DELETE" }); load(); }
    catch (e: any) { alert(e.message); }
  }

  const filtered = users.filter((u) => u.username.toLowerCase().includes(filter.toLowerCase()));
  const ranks: Rank[] = ["campesino", "soldado", "noble", "magistrado", "rey"];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-4xl mb-4">⚜ Panel del Reino</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button className={tab === "usuarios" ? "gold-btn" : "stone-btn"} onClick={() => setTab("usuarios")}>Súbditos</button>
        {me.rank === "rey" && <button className={tab === "proclamas" ? "gold-btn" : "stone-btn"} onClick={() => setTab("proclamas")}>📜 Proclamas Reales</button>}
        {me.rank === "rey" && <button className={tab === "tesoro" ? "gold-btn" : "stone-btn"} onClick={() => setTab("tesoro")}>🪙 Tesoro</button>}
      </div>

      {tab === "usuarios" && (
        <div className="parchment p-4">
          <input className="input-medieval w-full mb-3" placeholder="Buscar súbdito..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b-2 border-amber-900">
              <th className="py-2">Heraldo</th><th>Rango</th><th>🪙</th><th>Estado</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              {filtered.map((u) => {
                const info = RANK_INFO[u.rank];
                const isKing = u.username.toLowerCase() === "victios7";
                return (
                  <tr key={u.id} className="border-b border-amber-700/30">
                    <td className="py-2 font-bold">{u.username}{isKing && " 👑"}</td>
                    <td><span style={{ color: info.color }}>{info.emoji} {info.label}</span></td>
                    <td className="font-mono">{u.coins}</td>
                    <td>{u.banned ? <span className="text-red-700 font-bold">Desterrado</span> : "Activo"}</td>
                    <td className="py-2">
                      <div className="flex gap-1 flex-wrap">
                        {me.rank === "rey" && !isKing && ranks.map((r) => (
                          <button key={r} className="ranged-tag" style={{ background: u.rank === r ? RANK_INFO[r].color : RANK_INFO[r].color + "33", color: u.rank === r ? "#fff" : RANK_INFO[r].color, cursor: "pointer", borderColor: RANK_INFO[r].color }}
                            onClick={() => setRank(u, r)}>{RANK_INFO[r].emoji}</button>
                        ))}
                        {me.rank === "rey" && (
                          <button className="gold-btn !py-1 !px-2 text-xs" onClick={() => giveCoins(u)}>🪙±</button>
                        )}
                        {!u.banned && rankAtLeast(me, "magistrado") && u.id !== me.id && !isKing && (
                          <button className="danger-btn !py-1 !px-2 text-xs" onClick={() => ban(u)}>⛓ Desterrar</button>
                        )}
                        {u.banned && rankAtLeast(me, "magistrado") && (
                          <button className="gold-btn !py-1 !px-2 text-xs" onClick={() => unban(u)}>Perdonar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "proclamas" && me.rank === "rey" && (
        <div className="parchment p-5 max-w-2xl">
          <h2 className="text-2xl mb-2">📜 Proclamas al Reino</h2>
          <p className="text-sm opacity-80 mb-3">Aparecerán en una banda dorada en cada pantalla.</p>
          <textarea className="input-medieval w-full mb-3" rows={3} value={globalText} onChange={(e) => setGlobalText(e.target.value)} />
          <button className="gold-btn" onClick={sendGlobal}>📜 Proclamar</button>
          <div className="mt-5">
            <h3 className="font-bold mb-2">Proclamas activas</h3>
            {globals.length === 0 && <div className="opacity-70 text-sm">Sin proclamas.</div>}
            {globals.map((g) => (
              <div key={g.id} className="parchment-thin p-3 mb-2 flex justify-between items-start gap-2">
                <div>
                  <div className="text-xs opacity-70">{g.fromUsername} · {new Date(g.createdAt).toLocaleString("es")}</div>
                  <div>{g.text}</div>
                </div>
                <button className="danger-btn !py-1 !px-2 text-xs" onClick={() => deleteGlobal(g.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "tesoro" && me.rank === "rey" && (
        <div className="parchment p-5 max-w-2xl">
          <h2 className="text-2xl mb-2">🪙 Tesoro Real</h2>
          <p className="text-sm opacity-80 mb-3">Tarifas de oro por jugada según rango del autor:</p>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {(["campesino","soldado","noble","magistrado","rey"] as const).map((r) => (
              <div key={r} className="parchment-thin p-3 text-center" style={{ borderColor: RANK_INFO[r].color }}>
                <div className="text-2xl">{RANK_INFO[r].emoji}</div>
                <div className="text-xs">{RANK_INFO[r].label}</div>
                <div className="font-bold text-lg">🪙 {RANK_INFO[r].coinsPerPlay}</div>
              </div>
            ))}
          </div>
          <p className="text-xs opacity-70">Para repartir oro a un súbdito específico, ve a la pestaña Súbditos y pulsa el botón <strong>🪙±</strong>.</p>
        </div>
      )}
    </div>
  );
}
