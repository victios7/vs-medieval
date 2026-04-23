import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "../auth";
import { api, type PublicUser } from "../api";

export function ChatList() {
  const [chats, setChats] = useState<{ user: PublicUser | null; last: any }[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    api<{ chats: any[] }>("/chat").then((r) => setChats(r.chats)).catch(() => {});
    api<{ users: PublicUser[] }>("/users").then((r) => setUsers(r.users)).catch(() => {});
  }, []);
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl mb-3">📜 Pergaminos</h1>
      <div className="parchment p-4 mb-5">
        <h2 className="font-bold mb-2">Conversaciones recientes</h2>
        {chats.length === 0 && <div className="opacity-70 text-sm">Aún no has intercambiado pergaminos.</div>}
        {chats.map((c, i) => c.user && (
          <Link key={i} href={`/chat/${c.user.id}`} className="block py-2 border-b border-amber-700/30">
            <div className="font-bold">{c.user.username}</div>
            <div className="text-xs opacity-70 truncate">{c.last?.text}</div>
          </Link>
        ))}
      </div>
      <div className="parchment p-4">
        <h2 className="font-bold mb-2">Iniciar nueva conversación</h2>
        <input className="input-medieval w-full mb-2" placeholder="Buscar súbdito..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="max-h-80 overflow-y-auto">
          {users.filter((u) => u.username.toLowerCase().includes(filter.toLowerCase())).slice(0, 20).map((u) => (
            <Link key={u.id} href={`/chat/${u.id}`} className="block py-1 hover:bg-amber-200 px-2 rounded">{u.username}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatRoom() {
  const [, params] = useRoute<{ id: string }>("/chat/:id");
  const otherId = params?.id ?? "";
  const { user: me } = useAuth();
  const [other, setOther] = useState<PublicUser | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      const r = await api<{ messages: any[] }>(`/chat/${otherId}`);
      setMsgs(r.messages);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { /* ignore */ }
  }
  useEffect(() => {
    api<{ users: PublicUser[] }>("/users").then((r) => setOther(r.users.find((u) => u.id === otherId) ?? null));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [otherId]);

  async function send() {
    if (!text.trim()) return;
    await api(`/chat/${otherId}`, { method: "POST", body: JSON.stringify({ text }) });
    setText(""); load();
  }

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
      <h2 className="text-2xl mb-2">📜 {other?.username ?? "..."}</h2>
      <div className="parchment-thin flex-1 p-3 overflow-y-auto mb-2">
        {msgs.map((m) => {
          const mine = m.fromId === me?.id;
          return (
            <div key={m.id} className={`flex mb-2 ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-lg ${mine ? "bg-amber-700 text-amber-50" : "bg-amber-200 text-amber-950"}`}>
                <div className="text-sm">{m.text}</div>
                <div className="text-[10px] opacity-70">{new Date(m.createdAt).toLocaleTimeString("es")}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2">
        <input className="input-medieval flex-1" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Escribe tu pergamino..." />
        <button className="gold-btn" onClick={send}>Enviar</button>
      </div>
    </div>
  );
}
