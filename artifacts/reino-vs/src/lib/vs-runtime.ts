// VS LANGUAGE RUNTIME — full interpreter following vs-guide.html

export interface Sprite {
  id: string;
  name: string;
  costumes: string[]; // emoji per costume
  costumeIdx: number;
  backdropEmojis?: string[];
  x: number; y: number; rot: number; size: number; visible: boolean;
  isClone?: boolean;
  parentId?: string;
  say?: string;
  sayUntil?: number;
}

export interface Backdrop { name: string; gradient: string; emoji?: string }

export interface ParsedScript { event: string; arg?: string; body: string[] }

export function parseProgram(code: string): ParsedScript[] {
  const lines = code.split(/\r?\n/);
  const scripts: ParsedScript[] = [];
  let cur: ParsedScript | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (cur) cur.body.push(""); continue; }
    if (line.startsWith(";")) {
      if (cur) scripts.push(cur);
      const ev = line.slice(1).trim();
      let event = ev, arg: string | undefined;
      const patterns: [RegExp, string][] = [
        [/^(al recibir mensaje)\s+(.+)$/, "al recibir mensaje"],
        [/^(al presionar tecla)\s+(.+)$/, "al presionar tecla"],
        [/^(al cambiar fondo a)\s+(.+)$/, "al cambiar fondo a"],
        [/^(makey tecla)\s+(.+)$/, "al presionar tecla"],
        [/^(microbit boton)\s+(.+)$/, "al presionar tecla"],
        [/^(cuando)\s+(.+)$/, "cuando"],
      ];
      for (const [re, ename] of patterns) {
        const m = ev.match(re);
        if (m) { event = ename; arg = m[2]!.trim(); break; }
      }
      cur = { event, arg, body: [] };
    } else {
      if (cur) cur.body.push(line);
    }
  }
  if (cur) scripts.push(cur);
  return scripts;
}

export interface RuntimeCtx {
  sprite: Sprite;
  vars: Map<string, number | string>;
  setSprites: (fn: (arr: Sprite[]) => Sprite[]) => void;
  getSprites: () => Sprite[];
  setBackdropIdx: (i: number) => void;
  getBackdropIdx: () => number;
  backdropsCount: number;
  log: (s: string) => void;
  emit: (msg: string) => void;
  changeBackdropEvent: (name: string) => void;
  abort: { stopped: boolean };
  scripts: ParsedScript[];
  newId: () => string;
  ask: (q: string) => Promise<string>;
  setAnswer: (a: string) => void;
  getAnswer: () => string;
  startTime: number;
}

// expression evaluator
export function evalExpr(raw: string, ctx: RuntimeCtx): any {
  const text = raw.trim();
  if (!text) return "";
  const num = Number(text);
  if (!isNaN(num) && /^-?\d+(\.\d+)?$/.test(text)) return num;
  // var read forms
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(?:valor de variable|leer)\s+(.+)$/))) {
    return ctx.vars.get(m[1]!.trim()) ?? 0;
  }
  if ((m = text.match(/^respuesta$/))) return ctx.getAnswer();
  if ((m = text.match(/^timer$/))) return (Date.now() - ctx.startTime) / 1000;
  if ((m = text.match(/^volumen$/))) return 0;
  if ((m = text.match(/^posicion x$/))) return ctx.sprite.x;
  if ((m = text.match(/^posicion y$/))) return ctx.sprite.y;
  if ((m = text.match(/^direccion$/))) return ctx.sprite.rot;
  if ((m = text.match(/^tamaño$/))) return ctx.sprite.size;
  // prefix operators
  if ((m = text.match(/^sumar\s+(.+?)\s+y\s+(.+)$/))) return Number(evalExpr(m[1]!, ctx)) + Number(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^restar\s+(.+?)\s+y\s+(.+)$/))) return Number(evalExpr(m[1]!, ctx)) - Number(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^multiplicar\s+(.+?)\s+y\s+(.+)$/))) return Number(evalExpr(m[1]!, ctx)) * Number(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^dividir\s+(.+?)\s+y\s+(.+)$/))) return Number(evalExpr(m[1]!, ctx)) / Number(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^modulo\s+(.+?)\s+entre\s+(.+)$/))) return Number(evalExpr(m[1]!, ctx)) % Number(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^numero aleatorio\s+(.+?)\s+a\s+(.+)$/))) {
    const a = Number(evalExpr(m[1]!, ctx)), b = Number(evalExpr(m[2]!, ctx));
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }
  if ((m = text.match(/^mayor que\s+(.+?)\s+y\s+(.+)$/))) return Number(evalExpr(m[1]!, ctx)) > Number(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^menor que\s+(.+?)\s+y\s+(.+)$/))) return Number(evalExpr(m[1]!, ctx)) < Number(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^igual que\s+(.+?)\s+y\s+(.+)$/))) return String(evalExpr(m[1]!, ctx)) === String(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^y\s+(.+?)\s+y\s+(.+)$/))) return !!evalExpr(m[1]!, ctx) && !!evalExpr(m[2]!, ctx);
  if ((m = text.match(/^o\s+(.+?)\s+y\s+(.+)$/))) return !!evalExpr(m[1]!, ctx) || !!evalExpr(m[2]!, ctx);
  if ((m = text.match(/^no\s+(.+)$/))) return !evalExpr(m[1]!, ctx);
  if ((m = text.match(/^unir\s+(.+?)\s+(.+)$/))) return String(evalExpr(m[1]!, ctx)) + String(evalExpr(m[2]!, ctx));
  if ((m = text.match(/^letra\s+(.+?)\s+de\s+(.+)$/))) {
    const n = Number(evalExpr(m[1]!, ctx)), s = String(evalExpr(m[2]!, ctx));
    return s[n - 1] ?? "";
  }
  if ((m = text.match(/^longitud de\s+(.+)$/))) return String(evalExpr(m[1]!, ctx)).length;
  if ((m = text.match(/^contiene\s+(.+?)\s+(.+)$/))) return String(evalExpr(m[1]!, ctx)).includes(String(evalExpr(m[2]!, ctx)));
  if ((m = text.match(/^redondear\s+(.+)$/))) return Math.round(Number(evalExpr(m[1]!, ctx)));
  if ((m = text.match(/^(raiz|seno|coseno|tangente|asin|acos|atan|ln|log|abs|piso|techo)\s+de\s+(.+)$/))) {
    const fn = m[1]!, x = Number(evalExpr(m[2]!, ctx));
    const map: Record<string, (n: number) => number> = {
      raiz: Math.sqrt, seno: (n) => Math.sin(n * Math.PI / 180),
      coseno: (n) => Math.cos(n * Math.PI / 180), tangente: (n) => Math.tan(n * Math.PI / 180),
      asin: (n) => Math.asin(n) * 180 / Math.PI, acos: (n) => Math.acos(n) * 180 / Math.PI,
      atan: (n) => Math.atan(n) * 180 / Math.PI,
      ln: Math.log, log: Math.log10, abs: Math.abs, piso: Math.floor, techo: Math.ceil,
    };
    return map[fn]!(x);
  }
  if ((m = text.match(/^e elevado a\s+(.+)$/))) return Math.exp(Number(evalExpr(m[1]!, ctx)));
  if ((m = text.match(/^10 elevado a\s+(.+)$/))) return Math.pow(10, Number(evalExpr(m[1]!, ctx)));
  // identifier var read
  if (ctx.vars.has(text)) return ctx.vars.get(text)!;
  // bare string literal
  return text;
}

export async function runScript(script: ParsedScript, ctx: RuntimeCtx) {
  await execLines(script.body, ctx);
}

async function execLines(lines: string[], ctx: RuntimeCtx) {
  for (let i = 0; i < lines.length; i++) {
    if (ctx.abort.stopped) return;
    const line = lines[i]!.trim();
    if (!line) continue;

    // repetir N: ... fin
    let mm = line.match(/^funcion\s+repetir\s+(.+?)\s*:?$/);
    if (mm) {
      const count = Math.max(0, Math.floor(Number(evalExpr(mm[1]!, ctx)) || 0));
      const block = collectBlock(lines, i);
      i = block.endIdx;
      for (let r = 0; r < count; r++) {
        if (ctx.abort.stopped) return;
        await execLines(block.body, ctx);
      }
      continue;
    }
    // por siempre
    if (/^funcion\s+por siempre\s*:?$/.test(line)) {
      const block = collectBlock(lines, i);
      i = block.endIdx;
      let safety = 0;
      while (!ctx.abort.stopped && safety++ < 10000) {
        await execLines(block.body, ctx);
        await new Promise((r) => setTimeout(r, 0));
      }
      continue;
    }
    // si COND: ... [sino: ...] fin
    mm = line.match(/^funcion\s+si\s+(.+?)\s*:?$/);
    if (mm) {
      const cond = !!evalExpr(mm[1]!, ctx);
      const block = collectBlockIfElse(lines, i);
      i = block.endIdx;
      if (cond) await execLines(block.thenBody, ctx);
      else if (block.elseBody) await execLines(block.elseBody, ctx);
      continue;
    }
    // repetir hasta COND
    mm = line.match(/^funcion\s+repetir hasta\s+(.+?)\s*:?$/);
    if (mm) {
      const block = collectBlock(lines, i);
      i = block.endIdx;
      let safety = 0;
      while (!ctx.abort.stopped && !evalExpr(mm[1]!, ctx) && safety++ < 10000) {
        await execLines(block.body, ctx);
        await new Promise((r) => setTimeout(r, 0));
      }
      continue;
    }
    if (/^funcion\s+fin$/.test(line)) continue;
    await execStmt(line, ctx);
  }
}

function collectBlock(lines: string[], startIdx: number): { body: string[]; endIdx: number } {
  const body: string[] = [];
  let depth = 1;
  let i = startIdx + 1;
  for (; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (/^funcion\s+(repetir|por siempre|si|repetir hasta)\b/.test(l)) depth++;
    if (/^funcion\s+fin$/.test(l)) { depth--; if (depth === 0) return { body, endIdx: i }; }
    body.push(lines[i]!);
  }
  return { body, endIdx: i - 1 };
}

function collectBlockIfElse(lines: string[], startIdx: number): { thenBody: string[]; elseBody?: string[]; endIdx: number } {
  const thenBody: string[] = [];
  const elseBody: string[] = [];
  let inElse = false;
  let depth = 1;
  let i = startIdx + 1;
  for (; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (/^funcion\s+(repetir|por siempre|si|repetir hasta)\b/.test(l)) depth++;
    if (/^funcion\s+fin$/.test(l)) { depth--; if (depth === 0) return { thenBody, elseBody: inElse ? elseBody : undefined, endIdx: i }; }
    if (depth === 1 && /^funcion\s+sino\s*:?$/.test(l)) { inElse = true; continue; }
    (inElse ? elseBody : thenBody).push(lines[i]!);
  }
  return { thenBody, elseBody: inElse ? elseBody : undefined, endIdx: i - 1 };
}

async function execStmt(line: string, ctx: RuntimeCtx) {
  const m = line.match(/^funcion\s+(.+)$/);
  if (!m) { ctx.log("? " + line); return; }
  const cmd = m[1]!.trim();
  let mm: RegExpMatchArray | null;
  const me = ctx.sprite;
  const update = (fn: (s: Sprite) => Sprite) => {
    ctx.setSprites((arr) => arr.map((s) => s.id === me.id ? fn(s) : s));
  };

  // movement
  if ((mm = cmd.match(/^mover\s+(.+?)\s+pasos?$/))) {
    const n = Number(evalExpr(mm[1]!, ctx));
    update((s) => {
      const rad = (s.rot * Math.PI) / 180;
      return { ...s, x: s.x + Math.cos(rad) * n, y: s.y + Math.sin(rad) * n };
    });
  } else if ((mm = cmd.match(/^girar\s+(.+?)\s+grados?$/))) {
    const n = Number(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, rot: s.rot + n }));
  } else if ((mm = cmd.match(/^ir a x:\s*(.+?)\s+y:\s*(.+)$/))) {
    const x = Number(evalExpr(mm[1]!, ctx)), y = Number(evalExpr(mm[2]!, ctx));
    update((s) => ({ ...s, x, y }));
  } else if ((mm = cmd.match(/^apuntar a\s+(.+?)\s+grados?$/))) {
    const r = Number(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, rot: r }));
  } else if ((mm = cmd.match(/^cambiar x por\s+(.+)$/))) {
    const n = Number(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, x: s.x + n }));
  } else if ((mm = cmd.match(/^cambiar y por\s+(.+)$/))) {
    const n = Number(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, y: s.y + n }));
  } else if ((mm = cmd.match(/^fijar x a\s+(.+)$/))) {
    const n = Number(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, x: n }));
  } else if ((mm = cmd.match(/^fijar y a\s+(.+)$/))) {
    const n = Number(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, y: n }));
  }
  // looks
  else if ((mm = cmd.match(/^decir\s+(.+?)\s+por\s+(.+?)\s+segundos?$/))) {
    const text = String(evalExpr(mm[1]!, ctx));
    const sec = Number(evalExpr(mm[2]!, ctx));
    update((s) => ({ ...s, say: text, sayUntil: Date.now() + sec * 1000 }));
    ctx.log(`${me.name}: ${text}`);
    await new Promise((r) => setTimeout(r, sec * 1000));
    update((s) => ({ ...s, say: undefined }));
  } else if ((mm = cmd.match(/^decir\s+(.+)$/))) {
    const text = String(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, say: text, sayUntil: Date.now() + 5000 }));
    ctx.log(`${me.name}: ${text}`);
  } else if ((mm = cmd.match(/^pensar\s+(.+)$/))) {
    const text = String(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, say: "💭 " + text, sayUntil: Date.now() + 5000 }));
  } else if (cmd === "mostrar") {
    update((s) => ({ ...s, visible: true }));
  } else if (cmd === "ocultar") {
    update((s) => ({ ...s, visible: false }));
  } else if ((mm = cmd.match(/^cambiar tamaño a\s+(.+)$/))) {
    const n = Number(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, size: n }));
  } else if ((mm = cmd.match(/^cambiar tamaño por\s+(.+)$/))) {
    const n = Number(evalExpr(mm[1]!, ctx));
    update((s) => ({ ...s, size: s.size + n }));
  } else if ((mm = cmd.match(/^cambiar disfraz a\s+(.+)$/))) {
    const target = String(evalExpr(mm[1]!, ctx)).trim();
    const idx = parseInt(target, 10);
    update((s) => {
      let next = isNaN(idx) ? s.costumes.indexOf(target) : idx - 1;
      if (next < 0) next = 0;
      if (next >= s.costumes.length) next = s.costumes.length - 1;
      return { ...s, costumeIdx: next };
    });
  } else if (cmd === "siguiente disfraz") {
    update((s) => ({ ...s, costumeIdx: (s.costumeIdx + 1) % Math.max(1, s.costumes.length) }));
  } else if ((mm = cmd.match(/^cambiar fondo a\s+(.+)$/))) {
    const target = String(evalExpr(mm[1]!, ctx)).trim();
    const idx = parseInt(target, 10);
    const next = isNaN(idx) ? 0 : Math.max(0, Math.min(ctx.backdropsCount - 1, idx - 1));
    ctx.setBackdropIdx(next);
    ctx.changeBackdropEvent(target);
  } else if (cmd === "siguiente fondo") {
    const next = (ctx.getBackdropIdx() + 1) % Math.max(1, ctx.backdropsCount);
    ctx.setBackdropIdx(next);
    ctx.changeBackdropEvent(String(next + 1));
  }
  // sound (logged)
  else if ((mm = cmd.match(/^(tocar sonido|iniciar sonido)\s+(.+)$/))) {
    ctx.log(`🎵 ${mm[2]!.trim()}`);
    if (mm[1]!.includes("hasta")) await new Promise((r) => setTimeout(r, 300));
  } else if (cmd === "detener todos los sonidos") {
    ctx.log("🔇 sonidos detenidos");
  }
  // events / messages
  else if ((mm = cmd.match(/^enviar mensaje\s+(.+)$/))) {
    ctx.emit(String(evalExpr(mm[1]!, ctx)));
  } else if ((mm = cmd.match(/^enviar mensaje\s+(.+?)\s+y esperar$/))) {
    ctx.emit(String(evalExpr(mm[1]!, ctx)));
    await new Promise((r) => setTimeout(r, 100));
  }
  // control
  else if ((mm = cmd.match(/^esperar\s+(.+?)\s+segundos?$/))) {
    const sec = Number(evalExpr(mm[1]!, ctx));
    await new Promise((r) => setTimeout(r, sec * 1000));
  } else if ((mm = cmd.match(/^esperar hasta\s+(.+)$/))) {
    let safety = 0;
    while (!ctx.abort.stopped && !evalExpr(mm[1]!, ctx) && safety++ < 10000) {
      await new Promise((r) => setTimeout(r, 30));
    }
  } else if (cmd === "detener todo") {
    ctx.abort.stopped = true;
  }
  // clones
  else if (cmd === "crear clon" || cmd === "clonar mi mismo" || (mm = cmd.match(/^crear clon de\s+(.+)$/))) {
    const target = mm ? String(evalExpr(mm[1]!, ctx)).trim() : me.name;
    const orig = ctx.getSprites().find((s) => s.name === target) ?? me;
    const clone: Sprite = { ...orig, id: ctx.newId(), isClone: true, parentId: orig.id, costumes: [...orig.costumes] };
    ctx.setSprites((arr) => [...arr, clone]);
    // run "al comenzar como clon" scripts for this clone
    setTimeout(() => {
      const startScripts = ctx.scripts.filter((sc) => sc.event === "al comenzar como clon");
      startScripts.forEach((sc) => {
        runScript(sc, { ...ctx, sprite: clone });
      });
    }, 0);
  } else if (cmd === "borrar este clon" || cmd === "eliminar clon") {
    if (me.isClone) ctx.setSprites((arr) => arr.filter((s) => s.id !== me.id));
  }
  // sensing
  else if ((mm = cmd.match(/^preguntar\s+(.+?)\s+y esperar$/)) || (mm = cmd.match(/^preguntar\s+(.+)$/))) {
    const ans = await ctx.ask(String(evalExpr(mm[1]!, ctx)));
    ctx.setAnswer(ans);
  }
  // variables
  else if ((mm = cmd.match(/^fijar\s+(.+?)\s+a\s+(.+)$/))) {
    const name = mm[1]!.trim();
    const v = evalExpr(mm[2]!, ctx);
    ctx.vars.set(name, v as any);
  } else if ((mm = cmd.match(/^cambiar\s+(.+?)\s+por\s+(.+)$/))) {
    const name = mm[1]!.trim();
    const v = Number(evalExpr(mm[2]!, ctx));
    ctx.vars.set(name, Number(ctx.vars.get(name) ?? 0) + v);
  } else if ((mm = cmd.match(/^mostrar variable\s+(.+)$/))) {
    ctx.log(`${mm[1]!.trim()} = ${ctx.vars.get(mm[1]!.trim()) ?? 0}`);
  } else if ((mm = cmd.match(/^ocultar variable\s+(.+)$/))) {
    // no-op
  } else {
    ctx.log("? funcion " + cmd);
  }
}
