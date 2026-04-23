import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../auth";
import { api, type MapLocation, RANK_INFO } from "../api";
import { MapSVG } from "../components/MapSVG";

export function LoginPage() {
  const { login } = useAuth();
  const [, setLoc] = useLocation();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <form
        className="parchment p-8 w-full max-w-md"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null); setBusy(true);
          try { await login(u, p); setLoc("/"); }
          catch (ex: any) { setErr(ex.message); }
          finally { setBusy(false); }
        }}
      >
        <h1 className="text-3xl text-center mb-2" style={{ fontFamily: "MedievalSharp" }}>Cruzar las puertas</h1>
        <p className="text-center text-sm mb-6 opacity-80">Las puertas del Reino VS te aguardan</p>
        <label className="block text-sm font-bold mb-1">Nombre de heraldo</label>
        <input className="input-medieval w-full mb-3" value={u} onChange={(e) => setU(e.target.value)} placeholder="tu nombre" />
        <label className="block text-sm font-bold mb-1">Palabra secreta</label>
        <input className="input-medieval w-full mb-4" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••" />
        {err && <div className="mb-3 text-sm font-bold text-red-700 bg-red-100 border border-red-700 rounded p-2">{err}</div>}
        <button className="gold-btn w-full text-base py-2" disabled={busy}>{busy ? "..." : "Entrar al Reino"}</button>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [, setLoc] = useLocation();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [home, setHome] = useState<MapLocation | null>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    api<{ locations: MapLocation[] }>("/map").then(r => setLocations(r.locations)).catch(() => {});
  }, []);

  async function submit() {
    setErr(null);
    if (!home) { setErr("Elige un lugar de origen en el mapa"); return; }
    setBusy(true);
    try {
      await register(u, p, home.id);
      setLoc("/");
    } catch (ex: any) {
      setErr(ex.message);
      setStep(1);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-[85vh] p-4 flex flex-col items-center">
      {step === 1 && (
        <form
          className="parchment p-8 w-full max-w-md"
          onSubmit={(e) => { e.preventDefault(); if (u && p.length >= 4) setStep(2); else setErr("Nombre y contraseña obligatorios"); }}
        >
          <h1 className="text-3xl text-center mb-2" style={{ fontFamily: "MedievalSharp" }}>Jurar lealtad</h1>
          <p className="text-center text-sm mb-6 opacity-80">Las puertas del Reino VS te aguardan</p>
          <label className="block text-sm font-bold mb-1">Nombre de heraldo</label>
          <input className="input-medieval w-full mb-3" value={u} onChange={(e) => setU(e.target.value)} placeholder="tu nombre" />
          <label className="block text-sm font-bold mb-1">Palabra secreta</label>
          <input className="input-medieval w-full mb-4" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="•••• (mínimo 4)" />
          {err && <div className="mb-3 text-sm font-bold text-red-700 bg-red-100 border border-red-700 rounded p-2">{err}</div>}
          <button className="gold-btn w-full text-base py-2" type="submit">Continuar al mapa →</button>
        </form>
      )}

      {step === 2 && (
        <div className="w-full max-w-6xl">
          <div className="parchment p-4 mb-3 text-center">
            <h2 className="text-2xl" style={{ fontFamily: "MedievalSharp" }}>Elige tu hogar en el Reino</h2>
            <p className="text-sm opacity-80">Haz clic sobre un pueblo, ciudad o la capital para fijar tu origen.</p>
            {home && (
              <div className="mt-2 text-base">
                Hogar elegido: <strong>{home.name}</strong>
                {home.owner && <span className="ml-1 text-xs">(Señor: {RANK_INFO[home.owner.rank].emoji} {home.owner.username})</span>}
              </div>
            )}
          </div>
          <div className="parchment p-2">
            <MapSVG locations={locations} selectedId={home?.id ?? null} onSelect={setHome} picker height={520} />
          </div>
          {err && <div className="mt-3 text-sm font-bold text-red-700 bg-red-100 border border-red-700 rounded p-2">{err}</div>}
          <div className="mt-3 flex gap-2 justify-center">
            <button className="stone-btn" onClick={() => setStep(1)}>← Atrás</button>
            <button className="gold-btn px-6" disabled={!home || busy} onClick={submit}>
              {busy ? "Sellando juramento..." : "⚜ Jurar lealtad y entrar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BannedScreen({ reason }: { reason: string }) {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{
      background: "radial-gradient(circle, #4a0a0a, #1a0303)",
    }}>
      <div className="parchment p-10 max-w-xl text-center">
        <div className="text-6xl mb-4">⛓️</div>
        <h1 className="text-4xl mb-3 text-red-900">Has sido desterrado</h1>
        <p className="text-lg mb-6 italic">"{reason}"</p>
        <p className="opacity-70 text-sm mb-6">Las puertas del reino se han cerrado para ti. Si crees que esto es un error, busca el favor de un magistrado o del propio Rey.</p>
        <button className="stone-btn" onClick={logout}>Abandonar el reino</button>
      </div>
    </div>
  );
}
