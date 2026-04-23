import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { api, RANK_INFO, type PublicUser } from "../api";
import { useAuth } from "../auth";

interface CourtMessage { id: string; fromId: string; text: string; createdAt: number; kind: "anuncio" | "mensaje" | "decreto" }

export function CourtPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CourtMessage[]>([]);
  const [courtiers, setCourtiers] = useState<PublicUser[]>([]);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"mensaje" | "anuncio" | "decreto">("mensaje");
  const [err, setErr] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await api<{ messages: CourtMessage[]; courtiers: PublicUser[] }>("/court/messages");
      setMessages(r.messages);
      setCourtiers(r.courtiers);
    } catch (e: any) { setErr(e.message); }
  }

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  useEffect(() => { scroll.current?.scrollTo({ top: 1e9 }); }, [messages.length]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    try {
      await api("/court/messages", { method: "POST", body: JSON.stringify({ text: t, kind }) });
      setText("");
      await load();
    } catch (e: any) { alert(e.message); }
  }

  if (!user) return <div className="p-8 text-center">Debes entrar al Reino.</div>;
  const isCourtMember = user.rank === "noble" || user.rank === "magistrado" || user.rank === "rey";
  if (!isCourtMember) {
    return (
      <div className="p-8 text-center">
        <div className="parchment p-8 max-w-lg mx-auto">
          <div className="text-5xl mb-3">⚜</div>
          <h1 className="text-2xl mb-2">La Corte del Reino</h1>
          <p className="opacity-80 italic">Solo nobles, magistrados y el propio Rey acceden a este recinto.</p>
        </div>
      </div>
    );
  }

  function nameOf(uid: string) {
    return courtiers.find(c => c.id === uid)?.username ?? "?";
  }
  function rankOf(uid: string) {
    return courtiers.find(c => c.id === uid)?.rank ?? "campesino";
  }

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
      <aside className="parchment p-4 lg:col-span-1">
        <h2 className="text-xl mb-2" style={{ fontFamily: "MedievalSharp" }}>⚜ Cortesanos</h2>
        <div className="space-y-1">
          {courtiers.sort((a, b) => {
            const order = ["rey", "magistrado", "noble"];
            return order.indexOf(a.rank) - order.indexOf(b.rank);
          }).map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-amber-700/20">
              <Link href={`/u/${c.username}`} className="hover:underline">
                {RANK_INFO[c.rank].emoji} <strong>{c.username}</strong>
              </Link>
              <Link href={`/chat/${c.id}`} className="text-xs stone-btn px-2 py-0.5">✉</Link>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs opacity-70 italic">
          Usa ✉ para enviar un mensaje privado a otro cortesano.
        </div>
      </aside>

      <div className="lg:col-span-3 parchment p-4 flex flex-col" style={{ minHeight: 600 }}>
        <h1 className="text-3xl mb-2" style={{ fontFamily: "MedievalSharp" }}>🏰 Salón de la Corte</h1>
        <p className="text-sm opacity-80 mb-3 italic">
          Aquí los nobles del Reino debaten, anuncian fiestas y reciben los decretos del Rey. {user.rank === "rey" && "Como Rey, puedes proclamar decretos que serán publicados también en la plaza."}
        </p>

        {err && <div className="text-sm text-red-700 bg-red-100 border border-red-700 rounded p-2 mb-3">{err}</div>}

        <div ref={scroll} className="flex-1 overflow-auto space-y-2 pr-1" style={{ maxHeight: 500 }}>
          {messages.length === 0 && <div className="opacity-60 italic text-center mt-10">— El salón aguarda en silencio —</div>}
          {messages.map(m => {
            const isMine = m.fromId === user.id;
            const bg = m.kind === "decreto" ? "linear-gradient(135deg,#f4cd5b,#c0902a)"
              : m.kind === "anuncio" ? "linear-gradient(135deg,#ddd2a8,#bda678)"
              : isMine ? "#fdf6e3" : "#fff8e0";
            return (
              <div key={m.id} className={`p-3 rounded border ${isMine ? "ml-8" : "mr-8"}`} style={{ background: bg, borderColor: "#6b4a1f" }}>
                <div className="text-xs opacity-80 mb-1">
                  {m.kind === "decreto" && "📜 DECRETO REAL · "}
                  {m.kind === "anuncio" && "📣 Anuncio · "}
                  {RANK_INFO[rankOf(m.fromId)].emoji} <strong>{nameOf(m.fromId)}</strong>
                  <span className="ml-2 opacity-60">{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2 items-end">
          <select className="input-medieval" value={kind} onChange={e => setKind(e.target.value as any)}>
            <option value="mensaje">Mensaje</option>
            {(user.rank === "rey" || user.rank === "magistrado") && <option value="anuncio">📣 Anuncio</option>}
            {user.rank === "rey" && <option value="decreto">📜 Decreto Real</option>}
          </select>
          <textarea
            className="input-medieval flex-1 resize-none"
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Hablad, noble cortesano..."
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button className="gold-btn" onClick={send}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
