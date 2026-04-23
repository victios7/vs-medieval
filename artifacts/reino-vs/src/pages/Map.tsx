import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, type MapLocation, type PublicUser, RANK_INFO } from "../api";
import { MapSVG } from "../components/MapSVG";
import { useAuth } from "../auth";

interface LocationDetail {
  location: MapLocation;
  owner: PublicUser | null;
  residents: PublicUser[];
  projects: { id: string; name: string; ownerId: string; thumbnail?: string; plays: number }[];
}

export function MapPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [nobles, setNobles] = useState<PublicUser[]>([]);

  async function loadMap() {
    const r = await api<{ locations: MapLocation[] }>("/map");
    setLocations(r.locations);
  }
  async function loadNobles() {
    const r = await api<{ users: PublicUser[] }>("/users");
    setNobles(r.users.filter(u => u.rank === "noble" || u.rank === "magistrado"));
  }

  useEffect(() => { loadMap(); loadNobles(); }, []);

  async function selectLoc(loc: MapLocation) {
    setSelectedId(loc.id);
    setDetail(null);
    const d = await api<LocationDetail>(`/locations/${loc.id}`);
    setDetail(d);
  }

  async function grantTo(nobleId: string | "") {
    if (!detail) return;
    try {
      await api(`/admin/territory`, { method: "POST", body: JSON.stringify({ locationId: detail.location.id, nobleId: nobleId || null }) });
      await loadMap();
      await selectLoc(detail.location);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-3xl mb-3" style={{ fontFamily: "MedievalSharp" }}>🗺 Mapa del Reino VS</h1>
      <p className="text-sm mb-3 opacity-80">
        21 pueblos, 5 ciudades y la capital <strong>Aurelia</strong>. Arrastra para moverte, rueda del ratón para acercar/alejar.
        Haz clic en un lugar para ver sus habitantes y proyectos.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 parchment p-2">
          <MapSVG
            locations={locations}
            selectedId={selectedId}
            onSelect={selectLoc}
            highlightOwnerId={highlight}
            height={620}
          />
          <div className="mt-2 flex flex-wrap gap-2 items-center text-xs">
            <span className="opacity-70">Resaltar territorios de un noble:</span>
            <select
              className="input-medieval"
              value={highlight ?? ""}
              onChange={(e) => setHighlight(e.target.value || null)}
            >
              <option value="">— Ninguno —</option>
              {nobles.map(n => (
                <option key={n.id} value={n.id}>{RANK_INFO[n.rank].emoji} {n.username}</option>
              ))}
            </select>
            {user && user.homeId && (
              <button className="stone-btn ml-auto" onClick={() => {
                const home = locations.find(l => l.id === user.homeId);
                if (home) selectLoc(home);
              }}>📍 Mi hogar</button>
            )}
          </div>
        </div>

        <aside className="parchment p-4">
          {!detail && <div className="opacity-70 italic">Elige un lugar en el mapa para ver detalles.</div>}
          {detail && (
            <>
              <h2 className="text-2xl mb-1" style={{ fontFamily: "MedievalSharp" }}>
                {detail.location.type === "capital" ? "👑 " : detail.location.type === "ciudad" ? "🏰 " : "🏘 "}
                {detail.location.name}
              </h2>
              <div className="text-xs opacity-70 mb-2 capitalize">{detail.location.type}</div>
              <p className="text-sm italic mb-3">"{detail.location.description}"</p>

              {detail.owner ? (
                <div className="mb-3 text-sm">
                  Señor: <Link href={`/u/${detail.owner.username}`} className="font-bold text-purple-900">
                    {RANK_INFO[detail.owner.rank].emoji} {detail.owner.username}
                  </Link>
                </div>
              ) : detail.location.type === "capital" ? (
                <div className="mb-3 text-sm">Sede del Rey 👑</div>
              ) : (
                <div className="mb-3 text-sm italic opacity-70">Tierra sin señor.</div>
              )}

              <div className="mb-3">
                <div className="font-bold text-sm mb-1">👥 Habitantes ({detail.residents.length})</div>
                <div className="flex flex-wrap gap-1">
                  {detail.residents.length === 0 && <span className="text-xs italic opacity-60">— Ninguno aún —</span>}
                  {detail.residents.map(r => (
                    <Link key={r.id} href={`/u/${r.username}`} className="text-xs px-2 py-1 rounded border" style={{ borderColor: RANK_INFO[r.rank].color, color: RANK_INFO[r.rank].color }}>
                      {RANK_INFO[r.rank].emoji} {r.username}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="font-bold text-sm mb-1">📜 Proyectos ({detail.projects.length})</div>
                <div className="space-y-1">
                  {detail.projects.length === 0 && <span className="text-xs italic opacity-60">— Sin proyectos públicos —</span>}
                  {detail.projects.map(p => (
                    <Link key={p.id} href={`/proyecto/${p.id}`} className="block text-xs hover:underline">
                      • {p.name} <span className="opacity-60">({p.plays} jugadas)</span>
                    </Link>
                  ))}
                </div>
              </div>

              {user?.rank === "rey" && detail.location.type !== "capital" && (
                <div className="border-t border-amber-700/40 pt-3 mt-3">
                  <div className="font-bold text-sm mb-1">⚖ Decreto Real</div>
                  <select
                    className="input-medieval w-full text-sm"
                    value={detail.owner?.id ?? ""}
                    onChange={(e) => grantTo(e.target.value)}
                  >
                    <option value="">— Sin señor —</option>
                    {nobles.map(n => (
                      <option key={n.id} value={n.id}>{RANK_INFO[n.rank].emoji} {n.username}</option>
                    ))}
                  </select>
                  <div className="text-xs opacity-70 mt-1">Otorga o retira esta tierra a un noble.</div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
