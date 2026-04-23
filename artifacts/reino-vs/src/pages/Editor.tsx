import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { api } from "../api";
import { useAuth } from "../auth";
import { exportSb3, importSb3 } from "../lib/sb3";
import {
  parseProgram, runScript, type Sprite, type Backdrop, type ParsedScript, type RuntimeCtx,
} from "../lib/vs-runtime";

function normalizeSprite(s: any): Sprite {
  return {
    id: s.id ?? "s" + Math.random().toString(36).slice(2, 8),
    name: s.name ?? "Objeto",
    costumes: Array.isArray(s.costumes) && s.costumes.length
      ? s.costumes
      : [s.emoji ?? "🎭"],
    costumeIdx: typeof s.costumeIdx === "number" ? s.costumeIdx : 0,
    x: s.x ?? 0, y: s.y ?? 0, rot: s.rot ?? 0, size: s.size ?? 100,
    visible: s.visible !== false,
    isClone: s.isClone, parentId: s.parentId,
  };
}

const DEFAULT_BACKDROPS: Backdrop[] = [
  { name: "Pradera", gradient: "linear-gradient(180deg, #cfe6ff 0%, #c8e2a8 65%, #a3c46e 100%)", emoji: "🌳" },
  { name: "Castillo", gradient: "linear-gradient(180deg, #4a3266 0%, #6b4a1f 100%)", emoji: "🏰" },
  { name: "Mazmorra", gradient: "linear-gradient(180deg, #1a0f06 0%, #3a2010 100%)", emoji: "🗝" },
  { name: "Mar", gradient: "linear-gradient(180deg, #b6e0ff 0%, #2a6fa3 100%)", emoji: "🌊" },
];

const STARTER_CODE = `;al iniciar
funcion ir a x: 0 y: 0
funcion mostrar
funcion fijar score a 0
funcion decir unir Bienvenido al  Reino VS
funcion esperar 1 segundos
funcion repetir 4:
funcion mover 60 pasos
funcion girar 90 grados
funcion cambiar score por 1
funcion fin
funcion decir score
funcion enviar mensaje fin

;al recibir mensaje fin
funcion decir Glorioso!

;al presionar tecla espacio
funcion crear clon

;al comenzar como clon
funcion mostrar
funcion mover 30 pasos
funcion esperar 1 segundos
funcion borrar este clon
`;

interface CategoryDef {
  id: string; label: string; color: string; emblem: string;
  blocks: string[];
}

const CATEGORIES: CategoryDef[] = [
  { id: "movimiento", label: "Movimiento", color: "#4a76d6", emblem: "⚜",
    blocks: [
      "funcion mover 10 pasos",
      "funcion girar 15 grados",
      "funcion girar -15 grados",
      "funcion ir a x: 0 y: 0",
      "funcion ir a posicion aleatoria",
      "funcion ir a puntero del raton",
      "funcion deslizar en 1 segundos a x: 0 y: 0",
      "funcion apuntar a 90 grados",
      "funcion apuntar hacia puntero del raton",
      "funcion cambiar x por 10",
      "funcion cambiar y por 10",
      "funcion fijar x a 0",
      "funcion fijar y a 0",
      "funcion rebotar si toca un borde",
      "funcion fijar estilo de rotacion a izquierda-derecha",
      "funcion fijar estilo de rotacion a no rotar",
      "funcion fijar estilo de rotacion a todo alrededor",
    ]},
  { id: "apariencia", label: "Apariencia", color: "#9359b3", emblem: "👁",
    blocks: [
      "funcion decir Hola!",
      "funcion decir Hola por 2 segundos",
      "funcion pensar Hmm...",
      "funcion pensar Hmm... por 2 segundos",
      "funcion mostrar",
      "funcion ocultar",
      "funcion cambiar tamaño a 100",
      "funcion cambiar tamaño por 10",
      "funcion cambiar disfraz a 1",
      "funcion siguiente disfraz",
      "funcion disfraz anterior",
      "funcion cambiar fondo a 1",
      "funcion siguiente fondo",
      "funcion fondo anterior",
      "funcion cambiar fondo a y esperar 1",
      "funcion cambiar efecto color por 25",
      "funcion fijar efecto color a 0",
      "funcion cambiar efecto fantasma por 25",
      "funcion fijar efecto fantasma a 0",
      "funcion quitar efectos graficos",
      "funcion ir a capa frontal",
      "funcion ir a capa trasera",
      "funcion ir 1 capas adelante",
      "funcion ir 1 capas atras",
    ]},
  { id: "sonido", label: "Sonido", color: "#cf5cb6", emblem: "🎵",
    blocks: [
      "funcion tocar sonido pop hasta que termine",
      "funcion iniciar sonido pop",
      "funcion detener todos los sonidos",
      "funcion cambiar efecto tono por 10",
      "funcion fijar efecto tono a 0",
      "funcion quitar efectos de sonido",
      "funcion cambiar volumen por -10",
      "funcion fijar volumen a 100",
      "volumen",
    ]},
  { id: "eventos", label: "Eventos", color: "#cba216", emblem: "⚑",
    blocks: [
      ";al iniciar",
      ";al hacer click en este objeto",
      ";al recibir mensaje inicio",
      ";al presionar tecla espacio",
      ";al cambiar fondo a fondo1",
      ";al comenzar como clon",
      ";cuando timer > 10",
      ";cuando volumen > 10",
      "funcion enviar a todos inicio",
      "funcion enviar a todos inicio y esperar",
    ]},
  { id: "control", label: "Control", color: "#dfa44a", emblem: "⏳",
    blocks: [
      "funcion esperar 1 segundos",
      "funcion repetir 10:",
      "funcion fin",
      "funcion por siempre:",
      "funcion si igual que score y 10:",
      "funcion sino:",
      "funcion repetir hasta igual que score y 10:",
      "funcion esperar hasta igual que score y 10",
      "funcion crear clon",
      "funcion crear clon de Caballero",
      "funcion clonar mi mismo",
      "funcion borrar este clon",
      "funcion detener todo",
      "funcion detener este programa",
      "funcion detener otros programas en este objeto",
    ]},
  { id: "sensores", label: "Sensores", color: "#41a6c5", emblem: "👂",
    blocks: [
      "funcion preguntar Cómo te llamas? y esperar",
      "respuesta",
      "timer",
      "funcion reiniciar timer",
      "posicion x",
      "posicion y",
      "direccion",
      "raton x",
      "raton y",
      "raton presionado",
      "tecla espacio presionada",
      "tocando puntero del raton",
      "tocando borde",
      "tocando color rojo",
      "distancia a puntero del raton",
      "distancia a Caballero",
      "nombre de usuario",
      "dias desde 2000",
      "año actual",
      "mes actual",
      "dia actual",
      "hora actual",
      "minuto actual",
      "segundo actual",
    ]},
  { id: "operadores", label: "Operadores", color: "#5fbb47", emblem: "✚",
    blocks: [
      "sumar 1 y 2",
      "restar 5 y 3",
      "multiplicar 4 y 6",
      "dividir 10 y 2",
      "modulo 10 entre 3",
      "numero aleatorio 1 a 10",
      "mayor que score y 10",
      "menor que score y 10",
      "igual que score y 10",
      "y mayor que score y 5 y menor que score y 10",
      "o igual que score y 1 y igual que score y 2",
      "no igual que score y 0",
      "unir Hola  Mundo",
      "letra 1 de Reino",
      "longitud de Reino",
      "contiene Reino R",
      "redondear 3.7",
      "raiz de 16",
      "abs de -5",
      "piso de 3.7",
      "techo de 3.2",
      "seno de 90",
      "coseno de 0",
      "tangente de 45",
      "asin de 1",
      "acos de 0",
      "atan de 1",
      "ln de 10",
      "log de 100",
      "e elevado a 1",
      "10 elevado a 2",
    ]},
  { id: "variables", label: "Variables", color: "#ee7c3a", emblem: "📜",
    blocks: [
      "funcion fijar score a 0",
      "funcion cambiar score por 1",
      "funcion mostrar variable score",
      "funcion ocultar variable score",
      "valor de variable score",
    ]},
  { id: "listas", label: "Listas", color: "#cc5b22", emblem: "📋",
    blocks: [
      "funcion añadir cosa a mi_lista",
      "funcion borrar 1 de mi_lista",
      "funcion borrar todo de mi_lista",
      "funcion insertar cosa en 1 de mi_lista",
      "funcion reemplazar 1 de mi_lista por cosa",
      "elemento 1 de mi_lista",
      "indice de cosa en mi_lista",
      "longitud de mi_lista",
      "mi_lista contiene cosa",
      "funcion mostrar lista mi_lista",
      "funcion ocultar lista mi_lista",
    ]},
  { id: "lapiz", label: "Lápiz", color: "#0f9d58", emblem: "🖌",
    blocks: [
      "funcion borrar dibujos",
      "funcion sellar",
      "funcion bajar lapiz",
      "funcion subir lapiz",
      "funcion fijar color de lapiz a #ff0000",
      "funcion cambiar tamaño de lapiz por 1",
      "funcion fijar tamaño de lapiz a 1",
    ]},
  { id: "extras", label: "Periféricos", color: "#7a3690", emblem: "🛡",
    blocks: [
      ";makey tecla espacio",
      ";microbit boton a",
      ";wedo inclinado adelante",
      ";gdx gesto agitar",
      "funcion hablar Hola del Reino",
      "funcion fijar idioma a es",
      "funcion fijar voz a alto",
    ]},
];

const COSTUME_LIB = ["🛡","⚔","🏹","👑","🐉","🐎","⚜","🦅","🌟","🔥","💎","🗡","🏰","📜","🍞","🍷","🐺","🦌","🪓","⚙"];
const SPRITE_LIB = [
  { name: "Caballero", costumes: ["🛡","⚔"] },
  { name: "Dragón", costumes: ["🐉","🔥"] },
  { name: "Arquero", costumes: ["🏹"] },
  { name: "Rey", costumes: ["👑"] },
  { name: "Caballo", costumes: ["🐎"] },
  { name: "Cuervo", costumes: ["🦅"] },
];

export function EditorPage() {
  const { user } = useAuth();
  const [, params] = useRoute<{ id: string }>("/editor/:id");
  const projectId = params?.id ?? "nuevo";
  const [, setLoc] = useLocation();
  const [name, setName] = useState("Mi Proyecto");
  const [code, setCode] = useState(STARTER_CODE);
  const [isPublic, setIsPublic] = useState(false);
  const [sprites, setSprites] = useState<Sprite[]>([
    { id: "s1", name: "Caballero", costumes: ["🛡","⚔"], costumeIdx: 0, x: 0, y: 0, rot: 0, size: 100, visible: true },
  ]);
  const [backdrops, setBackdrops] = useState<Backdrop[]>(DEFAULT_BACKDROPS);
  const [backdropIdx, setBackdropIdx] = useState(0);
  const [activeSprite, setActiveSprite] = useState("s1");
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]!.id);
  const [editorTab, setEditorTab] = useState<"codigo" | "disfraces" | "fondos" | "sonidos">("codigo");
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [askPrompt, setAskPrompt] = useState<{ q: string; resolve: (v: string) => void } | null>(null);
  const [askInput, setAskInput] = useState("");
  const abortRef = useRef<{ stopped: boolean }>({ stopped: false });
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  const spritesRef = useRef(sprites);
  spritesRef.current = sprites;
  const backdropIdxRef = useRef(backdropIdx);
  backdropIdxRef.current = backdropIdx;
  const answerRef = useRef("");
  const varsRef = useRef(new Map<string, number | string>());

  const spritesPersist = sprites.filter((s) => !s.isClone);

  // load
  useEffect(() => {
    if (projectId === "nuevo") {
      const local = localStorage.getItem("reino_draft");
      if (local) {
        try {
          const d = JSON.parse(local);
          if (d.name) setName(d.name);
          if (d.code) setCode(d.code);
          if (Array.isArray(d.sprites) && d.sprites.length) setSprites(d.sprites.map(normalizeSprite));
          if (Array.isArray(d.backdrops) && d.backdrops.length) setBackdrops(d.backdrops);
        } catch { /* ignore */ }
      }
      return;
    }
    api<{ project: any }>(`/projects/${projectId}`).then((r) => {
      setName(r.project.name);
      setCode(r.project.code);
      setIsPublic(r.project.isPublic);
      setOwnerId(r.project.ownerId);
      if (Array.isArray(r.project.sprites) && r.project.sprites.length) setSprites(r.project.sprites.map(normalizeSprite));
      if (Array.isArray(r.project.backdrops) && r.project.backdrops.length) setBackdrops(r.project.backdrops);
    }).catch(() => {});
  }, [projectId]);

  // autosave
  useEffect(() => {
    const t = setTimeout(async () => {
      const draft = { name, code, sprites: spritesPersist, backdrops };
      localStorage.setItem("reino_draft", JSON.stringify(draft));
      if (projectId !== "nuevo" && user && (ownerId === user.id || user.rank === "rey")) {
        try {
          await api(`/projects/${projectId}`, {
            method: "PUT",
            body: JSON.stringify({ name, code, sprites: spritesPersist, backdrops, isPublic }),
          });
          setSavedAt(Date.now());
        } catch { /* ignore */ }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [name, code, sprites, backdrops, isPublic, projectId, user, ownerId]);

  const scripts = useMemo(() => parseProgram(code), [code]);

  function insertSnippet(snippet: string) {
    const ta = codeRef.current;
    if (!ta) { setCode(code + (code.endsWith("\n") ? "" : "\n") + snippet + "\n"); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    const before = code.slice(0, start), after = code.slice(end);
    const insert = (before.endsWith("\n") || before === "" ? "" : "\n") + snippet + "\n";
    const next = before + insert + after;
    setCode(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = before.length + insert.length; }, 0);
  }

  function buildCtx(sprite: Sprite, scriptsAll: ParsedScript[]): RuntimeCtx {
    const startTime = Date.now();
    const ctx: RuntimeCtx = {
      sprite,
      vars: varsRef.current,
      setSprites: (fn) => setSprites((arr) => fn(arr)),
      getSprites: () => spritesRef.current,
      setBackdropIdx: (i) => setBackdropIdx(i),
      getBackdropIdx: () => backdropIdxRef.current,
      backdropsCount: backdrops.length,
      log: (s) => setLogs((l) => [...l.slice(-200), s]),
      emit: (msg) => {
        scriptsAll.forEach((sc) => {
          if (sc.event === "al recibir mensaje" && sc.arg === msg) {
            spritesRef.current.forEach((sp) => {
              runScript(sc, { ...ctx, sprite: sp });
            });
          }
        });
      },
      changeBackdropEvent: (n) => {
        scriptsAll.forEach((sc) => {
          if (sc.event === "al cambiar fondo a" && sc.arg === n) {
            spritesRef.current.forEach((sp) => runScript(sc, { ...ctx, sprite: sp }));
          }
        });
      },
      abort: abortRef.current,
      scripts: scriptsAll,
      newId: () => "c" + Math.random().toString(36).slice(2, 9),
      ask: (q) => new Promise((resolve) => { setAskPrompt({ q, resolve }); setAskInput(""); }),
      setAnswer: (a) => { answerRef.current = a; },
      getAnswer: () => answerRef.current,
      startTime,
    };
    return ctx;
  }

  async function runEvent(matcher: (s: ParsedScript) => boolean) {
    if (running) abortRef.current.stopped = true;
    abortRef.current = { stopped: false };
    setRunning(true);
    varsRef.current = new Map();
    setSprites((arr) => arr.filter((s) => !s.isClone).map((s) => ({ ...s, say: undefined })));
    setLogs([]);
    const tasks: Promise<void>[] = [];
    const baseSprites = spritesRef.current.filter((s) => !s.isClone);
    scripts.forEach((sc) => {
      if (matcher(sc)) {
        baseSprites.forEach((sp) => {
          tasks.push(runScript(sc, buildCtx(sp, scripts)));
        });
      }
    });
    await Promise.all(tasks);
    setRunning(false);
  }

  function stopAll() { abortRef.current.stopped = true; setRunning(false); }

  // global key listener for "al presionar tecla"
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!running) return;
      const key = e.key === " " ? "espacio" :
        e.key === "ArrowUp" ? "flecha arriba" :
        e.key === "ArrowDown" ? "flecha abajo" :
        e.key === "ArrowLeft" ? "flecha izquierda" :
        e.key === "ArrowRight" ? "flecha derecha" : e.key.toLowerCase();
      scripts.forEach((sc) => {
        if (sc.event === "al presionar tecla" && (sc.arg === key || sc.arg === "any")) {
          spritesRef.current.forEach((sp) => runScript(sc, buildCtx(sp, scripts)));
        }
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scripts, running]);

  async function saveAsNew() {
    if (!user) { setLoc("/entrar"); return; }
    const r = await api<{ project: any }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, code, sprites: spritesPersist, backdrops, isPublic }),
    });
    setLoc(`/editor/${r.project.id}`);
  }

  async function exportProject() {
    const data = { format: "reino-vs/1", name, code, sprites: spritesPersist, backdrops, isPublic };
    const blob = await exportSb3(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name.replace(/\W+/g, "_")}.sb3`; a.click();
    URL.revokeObjectURL(url);
  }

  async function importProject(file: File) {
    const data = await importSb3(file);
    if (!data) { setLogs((l) => [...l, "✖ Archivo inválido"]); return; }
    if (data.name) setName(data.name);
    if (data.code) setCode(data.code);
    if (Array.isArray(data.sprites) && data.sprites.length) setSprites(data.sprites.map(normalizeSprite));
    if (Array.isArray(data.backdrops) && data.backdrops.length) setBackdrops(data.backdrops);
    setLogs((l) => [...l, "✓ Proyecto importado: " + (data.name ?? "?")]);
  }

  function clickSprite(spriteId: string) {
    if (!running) runEvent((s) => s.event === "al iniciar"); // fallback start
    const sp = spritesRef.current.find((s) => s.id === spriteId);
    if (!sp) return;
    scripts.forEach((sc) => {
      if (sc.event === "al hacer click en este objeto") {
        runScript(sc, buildCtx(sp, scripts));
      }
    });
  }

  const cat = CATEGORIES.find((c) => c.id === activeCat)!;
  const me = sprites.find((s) => s.id === activeSprite) ?? sprites[0]!;
  const bd = backdrops[backdropIdx] ?? backdrops[0]!;

  function updateSprite(fn: (s: Sprite) => Sprite) {
    setSprites((arr) => arr.map((s) => s.id === me.id ? fn(s) : s));
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 60px)", background: "linear-gradient(180deg,#3a2a14,#241808)" }}>
      {/* top banner */}
      <div className="medieval-banner px-3 py-2 flex items-center gap-2 text-sm">
        <span className="text-xl">⚒</span>
        <input className="input-medieval !py-1" style={{ maxWidth: 240 }}
          value={name} onChange={(e) => setName(e.target.value)} />
        <button className="gold-btn !py-1 !px-3" onClick={saveAsNew}>
          {projectId === "nuevo" ? "📜 Sellar pergamino" : "📜 Copia"}
        </button>
        {projectId !== "nuevo" && <span className="text-amber-200/80 text-xs">{savedAt ? `✓ ${new Date(savedAt).toLocaleTimeString("es")}` : "Auto-guardado..."}</span>}
        <label className="flex items-center gap-1 text-amber-100">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Público
        </label>
        <button className="stone-btn !py-1 !px-3" onClick={exportProject}>⬇ .sb3</button>
        <label className="stone-btn !py-1 !px-3 cursor-pointer">
          ⬆ .sb3
          <input type="file" accept=".sb3,.json,.reinovs.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importProject(f); }} />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button className="gold-btn !py-1 !px-3" onClick={() => runEvent((s) => s.event === "al iniciar")} disabled={running}>⚑ Iniciar</button>
          <button className="danger-btn !py-1 !px-3" onClick={stopAll}>⏹ Detener</button>
        </div>
      </div>

      <div className="flex-1 grid gap-2 p-2" style={{ gridTemplateColumns: "320px 1fr 380px", overflow: "hidden" }}>
        {/* LEFT: blocks palette */}
        <div className="parchment overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
          <div className="flex flex-wrap gap-1 p-2 border-b-2 border-amber-900">
            {CATEGORIES.map((c) => (
              <button key={c.id}
                onClick={() => setActiveCat(c.id)}
                className="px-2 py-1 text-xs font-bold rounded-md"
                style={{
                  background: activeCat === c.id ? c.color : "transparent",
                  color: activeCat === c.id ? "#fff" : c.color,
                  border: `2px solid ${c.color}`,
                  textShadow: activeCat === c.id ? "0 1px 1px #0008" : "none",
                }}
              >{c.emblem} {c.label}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: 0 }}>
            <div className="text-sm mb-2 font-bold flex items-center gap-2" style={{ color: cat.color }}>
              <span className="text-xl">{cat.emblem}</span> {cat.label}
            </div>
            {cat.blocks.map((b) => (
              <div key={b}
                className="medieval-block mb-2"
                style={{
                  background: `linear-gradient(180deg, ${cat.color} 0%, ${shade(cat.color, -25)} 100%)`,
                  borderColor: shade(cat.color, -50),
                }}
                onClick={() => insertSnippet(b)}
                title="Clic para insertar"
              >{b}</div>
            ))}
            <div className="text-xs opacity-70 mt-4 leading-relaxed">
              Lenguaje VS · Cada evento empieza con <code>;</code> y cada acción con <code>funcion</code>.
            </div>
          </div>
        </div>

        {/* CENTER: workspace tabs */}
        <div className="parchment overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
          <div className="flex border-b-2 border-amber-900">
            {(["codigo","disfraces","fondos","sonidos"] as const).map((t) => (
              <button key={t}
                onClick={() => setEditorTab(t)}
                className="px-4 py-2 font-bold text-sm capitalize"
                style={{
                  background: editorTab === t ? "linear-gradient(180deg,#fff8e1,#efdfb1)" : "transparent",
                  borderBottom: editorTab === t ? "3px solid #c0902a" : "none",
                  color: editorTab === t ? "#3a1e08" : "#7a5a2c",
                }}
              >{t === "codigo" ? "📝 Código" : t === "disfraces" ? "🎭 Disfraces" : t === "fondos" ? "🏞 Fondos" : "🎵 Sonidos"}</button>
            ))}
            <div className="ml-auto px-3 py-2 text-xs opacity-70 self-center">
              Objeto: <strong>{me.name}</strong>
            </div>
          </div>

          {editorTab === "codigo" && (
            <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
              <textarea
                ref={codeRef}
                className="flex-1 font-mono text-sm p-3 outline-none"
                style={{ background: "#fff8e1", border: "none", resize: "none", color: "#2a1808", minHeight: 0 }}
                value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false}
              />
              <div className="border-t-2 border-amber-900 p-2 flex gap-1 items-center text-xs flex-wrap" style={{ background: "#e6d496" }}>
                <strong>⚑ Eventos:</strong>
                {scripts.length === 0 && <span className="opacity-60">ninguno</span>}
                {scripts.map((s, i) => (
                  <span key={i} className="ranged-tag" style={{ background: "#7a3690", color: "#fff", borderColor: "#3e1850" }}>;{s.event}{s.arg ? ` ${s.arg}` : ""}</span>
                ))}
              </div>
            </div>
          )}

          {editorTab === "disfraces" && (
            <div className="flex-1 overflow-y-auto p-4" style={{ background: "#fff8e1", minHeight: 0 }}>
              <h3 className="font-bold mb-3">🎭 Disfraces de {me.name}</h3>
              <div className="grid grid-cols-6 gap-2 mb-4">
                {me.costumes.map((c, i) => (
                  <div key={i} className="parchment-thin p-3 text-center text-3xl relative cursor-pointer"
                    style={{ outline: me.costumeIdx === i ? "3px solid #c0902a" : "none" }}
                    onClick={() => updateSprite((s) => ({ ...s, costumeIdx: i }))}
                  >
                    {c}
                    <div className="text-[10px] mt-1 opacity-60">disfraz {i + 1}</div>
                    {me.costumes.length > 1 && (
                      <button className="absolute top-0 right-1 text-red-700 text-xs" onClick={(e) => {
                        e.stopPropagation();
                        updateSprite((s) => ({
                          ...s,
                          costumes: s.costumes.filter((_, j) => j !== i),
                          costumeIdx: Math.max(0, s.costumeIdx - (i <= s.costumeIdx ? 1 : 0)),
                        }));
                      }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <h4 className="font-bold mb-2 text-sm">Añadir disfraz desde la armería</h4>
              <div className="flex flex-wrap gap-2">
                {COSTUME_LIB.map((c) => (
                  <button key={c} className="parchment-thin p-2 text-2xl" onClick={() =>
                    updateSprite((s) => ({ ...s, costumes: [...s.costumes, c] }))
                  }>{c}</button>
                ))}
                <button className="stone-btn" onClick={() => {
                  const e = prompt("Disfraz personalizado (emoji o texto)", "⭐");
                  if (e) updateSprite((s) => ({ ...s, costumes: [...s.costumes, e] }));
                }}>+ Personalizado</button>
              </div>
            </div>
          )}

          {editorTab === "fondos" && (
            <div className="flex-1 overflow-y-auto p-4" style={{ background: "#fff8e1", minHeight: 0 }}>
              <h3 className="font-bold mb-3">🏞 Fondos del escenario</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {backdrops.map((b, i) => (
                  <div key={i} className="parchment-thin overflow-hidden cursor-pointer"
                    style={{ outline: backdropIdx === i ? "3px solid #c0902a" : "none" }}
                    onClick={() => setBackdropIdx(i)}
                  >
                    <div className="aspect-video flex items-center justify-center text-4xl" style={{ background: b.gradient }}>
                      {b.emoji ?? "🏞"}
                    </div>
                    <div className="p-2 text-xs text-center font-bold">{b.name}</div>
                    {backdrops.length > 1 && (
                      <button className="absolute text-red-700 text-xs" onClick={(e) => {
                        e.stopPropagation();
                        setBackdrops((arr) => arr.filter((_, j) => j !== i));
                        if (backdropIdx >= i) setBackdropIdx(Math.max(0, backdropIdx - 1));
                      }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button className="gold-btn" onClick={() => {
                const name = prompt("Nombre del fondo", "Bosque");
                if (!name) return;
                const grads = [
                  "linear-gradient(180deg,#1a4d2e,#345b3a)",
                  "linear-gradient(180deg,#7a1f1f,#2a0a0a)",
                  "linear-gradient(180deg,#fef3c7,#fbbf24)",
                  "linear-gradient(180deg,#1e3a8a,#000)",
                ];
                const g = grads[Math.floor(Math.random() * grads.length)]!;
                setBackdrops((arr) => [...arr, { name, gradient: g, emoji: "🏞" }]);
              }}>+ Nuevo fondo</button>
            </div>
          )}

          {editorTab === "sonidos" && (
            <div className="flex-1 overflow-y-auto p-4" style={{ background: "#fff8e1", minHeight: 0 }}>
              <h3 className="font-bold mb-3">🎵 Sonidos del Reino</h3>
              <p className="text-sm opacity-80 mb-3">Las llamadas a sonido se registran en la bitácora cuando el programa se ejecuta. Usa <code>funcion iniciar sonido pop</code> en el código.</p>
              <div className="flex flex-wrap gap-2">
                {["pop","cuerno","fanfarria","tambor","grito de batalla","caballos","forja"].map((s) => (
                  <div key={s} className="parchment-thin p-3 text-center">
                    <div className="text-2xl">🎵</div>
                    <div className="text-xs">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: stage + sprite list + logs */}
        <div className="parchment overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
          <div className="m-2 relative overflow-hidden border-2 border-amber-900 rounded-md scroll-shadow"
            style={{ aspectRatio: "4/3", background: bd.gradient }}>
            {sprites.map((s) => s.visible && (
              <div key={s.id} style={{
                position: "absolute",
                left: `calc(50% + ${s.x}px)`, top: `calc(50% - ${s.y}px)`,
                transform: `translate(-50%, -50%) rotate(${s.rot}deg) scale(${s.size / 100})`,
                fontSize: 44, lineHeight: 1, cursor: "pointer", userSelect: "none",
              }} onClick={() => clickSprite(s.id)}>
                <span style={{ display: "inline-block", transform: `rotate(${-s.rot}deg)` }}>
                  {(s.costumes && s.costumes[s.costumeIdx ?? 0]) || (s.costumes && s.costumes[0]) || (s as any).emoji || "🎭"}
                </span>
                {s.say && (
                  <div style={{
                    position: "absolute", bottom: "100%", left: "50%",
                    transform: "translateX(-50%) rotate(0deg)",
                    background: "#fff8e1", border: "2px solid #6b4a1f", borderRadius: 12,
                    padding: "4px 10px", fontSize: 12, whiteSpace: "nowrap",
                    boxShadow: "0 2px 4px rgba(0,0,0,.3)",
                  }}>{s.say}</div>
                )}
              </div>
            ))}
            <div className="absolute top-1 right-2 text-xs px-2 py-0.5 bg-amber-100/80 rounded">
              {bd.name}
            </div>
          </div>
          <div className="px-3 pb-2">
            <div className="text-sm font-bold mb-1">⚔ Objetos</div>
            <div className="flex gap-2 flex-wrap">
              {spritesPersist.map((s) => (
                <button key={s.id} className="parchment-thin px-3 py-2 text-2xl relative"
                  onClick={() => setActiveSprite(s.id)}
                  style={{ outline: activeSprite === s.id ? "3px solid #c0902a" : "none" }}
                  onDoubleClick={() => {
                    const nn = prompt("Nombre del objeto", s.name);
                    if (nn) setSprites((arr) => arr.map((x) => x.id === s.id ? { ...x, name: nn } : x));
                  }}
                  title={`${s.name} · doble clic para renombrar`}
                >
                  {(s.costumes && s.costumes[s.costumeIdx ?? 0]) || (s as any).emoji || "🎭"}
                  <div className="text-[10px] mt-0.5">{s.name}</div>
                </button>
              ))}
              <div className="relative inline-block">
                <button className="stone-btn !py-2 !px-3" onClick={() => {
                  const lib = SPRITE_LIB[Math.floor(Math.random() * SPRITE_LIB.length)]!;
                  const sp: Sprite = { id: "s" + Date.now(), name: lib.name, costumes: lib.costumes, costumeIdx: 0, x: 0, y: 0, rot: 0, size: 100, visible: true };
                  setSprites((arr) => [...arr, sp]); setActiveSprite(sp.id);
                }}>+</button>
              </div>
              {spritesPersist.length > 1 && (
                <button className="danger-btn !py-2 !px-2" onClick={() => {
                  const next = spritesPersist.find((s) => s.id !== activeSprite);
                  setSprites((arr) => arr.filter((s) => s.id !== activeSprite));
                  if (next) setActiveSprite(next.id);
                }}>✕</button>
              )}
            </div>
          </div>
          <div className="flex-1 px-3 pb-3 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
            <div className="text-sm font-bold mb-1">📜 Bitácora</div>
            <div className="flex-1 overflow-y-auto text-xs font-mono parchment-thin p-2">
              {logs.length === 0 && <div className="opacity-60">Pulsa el estandarte ⚑ para ejecutar tu hechizo.</div>}
              {logs.map((l, i) => <div key={i}>· {l}</div>)}
            </div>
          </div>
        </div>
      </div>

      {askPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center pb-8 z-50" onClick={() => {
          askPrompt.resolve(askInput); setAskPrompt(null);
        }}>
          <div className="parchment p-4 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold mb-2">{askPrompt.q}</div>
            <form onSubmit={(e) => { e.preventDefault(); askPrompt.resolve(askInput); setAskPrompt(null); }}>
              <input className="input-medieval w-full" autoFocus value={askInput} onChange={(e) => setAskInput(e.target.value)} />
              <button className="gold-btn mt-2" type="submit">Responder</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0xff) + amt;
  const B = (num & 0xff) + amt;
  const c = (n: number) => Math.max(0, Math.min(255, n));
  return "#" + ((1 << 24) + (c(R) << 16) + (c(G) << 8) + c(B)).toString(16).slice(1);
}
