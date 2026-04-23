import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import {
  getDB,
  save,
  hashPassword,
  id,
  publicUser,
  enforceKing,
  COINS_PER_PLAY,
  maybeProcessTribute,
  assignTerritoriesToNoble,
  releaseTerritories,
  type Rank,
  type User,
} from "../lib/store";

const router: IRouter = Router();

const RANK_ORDER: Rank[] = ["campesino", "soldado", "noble", "magistrado", "rey"];
function rankAtLeast(u: User, r: Rank): boolean {
  return RANK_ORDER.indexOf(u.rank) >= RANK_ORDER.indexOf(r);
}

async function authUser(req: Request): Promise<User | null> {
  const token = req.header("x-session") || (req.cookies && req.cookies["reino_session"]);
  if (!token) return null;
  const db = await getDB();
  const sess = db.sessions.find((s) => s.token === token);
  if (!sess) return null;
  const user = db.users.find((u) => u.id === sess.userId);
  return user ?? null;
}

function requireAuth(handler: (req: Request, res: Response, user: User) => Promise<unknown> | unknown) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const u = await authUser(req);
      if (!u) return res.status(401).json({ error: "No autenticado" });
      if (u.banned) return res.status(403).json({ error: "BANEADO", reason: u.banReason ?? "Sin razón" });
      await handler(req, res, u);
    } catch (e) {
      next(e);
    }
  };
}

// ===== AUTH =====
router.post("/auth/register", async (req, res) => {
  const { username, password, homeId } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "Falta usuario o contraseña" });
  if (typeof username !== "string" || typeof password !== "string") return res.status(400).json({ error: "Datos inválidos" });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: "Nombre de 3 a 20 letras" });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: "Solo letras/números/_" });
  if (password.length < 4) return res.status(400).json({ error: "Contraseña muy corta" });
  if (username.toLowerCase() === "victios7") return res.status(403).json({ error: "Ese nombre pertenece al Rey" });

  const db = await getDB();
  if (db.users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "Ese nombre ya existe" });
  }
  if (!homeId || typeof homeId !== "string") return res.status(400).json({ error: "Debes elegir un lugar de origen en el mapa" });
  const home = db.locations.find((l) => l.id === homeId);
  if (!home) return res.status(400).json({ error: "Lugar de origen no encontrado" });
  const salt = crypto.randomBytes(16).toString("hex");
  const user: User = {
    id: id(),
    username,
    passwordHash: hashPassword(password, salt),
    salt,
    rank: "campesino",
    banned: false,
    coins: 5,
    homeId: home.id,
    createdAt: Date.now(),
  };
  db.users.push(user);
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions.push({ token, userId: user.id, createdAt: Date.now() });
  await save();
  res.json({ token, user: publicUser(user) });
});

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "Falta usuario o contraseña" });
  const db = await getDB();
  enforceKing(db);
  const user = db.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  if (hashPassword(String(password), user.salt) !== user.passwordHash) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  // Force victios7 to always be Rey, not banned
  if (user.username.toLowerCase() === "victios7") {
    user.rank = "rey";
    user.banned = false;
    user.banReason = undefined;
  }
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions.push({ token, userId: user.id, createdAt: Date.now() });
  await save();
  res.json({ token, user: publicUser(user), banned: user.banned, banReason: user.banReason });
});

router.post("/auth/logout", requireAuth(async (req, res) => {
  const token = req.header("x-session") || (req.cookies && req.cookies["reino_session"]);
  const db = await getDB();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  await save();
  res.json({ ok: true });
}));

router.get("/auth/me", async (req, res) => {
  const u = await authUser(req);
  if (!u) return res.status(401).json({ error: "No autenticado" });
  // Re-enforce king on every check
  if (u.username.toLowerCase() === "victios7") {
    u.rank = "rey";
    u.banned = false;
    u.banReason = undefined;
  }
  // Daily tribute settlement
  const db = await getDB();
  const tribute = maybeProcessTribute(db, u);
  await save();
  res.json({ user: publicUser(u), banned: u.banned, banReason: u.banReason, tribute });
});

// ===== USERS =====
router.get("/users", async (_req, res) => {
  const db = await getDB();
  res.json({ users: db.users.map(publicUser) });
});

router.get("/users/:username", async (req, res) => {
  const db = await getDB();
  const u = db.users.find((x) => x.username.toLowerCase() === req.params.username.toLowerCase());
  if (!u) return res.status(404).json({ error: "No encontrado" });
  const projects = db.projects.filter((p) => p.ownerId === u.id && p.isPublic).map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    loves: p.loves.length,
    plays: p.plays,
  }));
  res.json({ user: publicUser(u), projects });
});

router.post("/users/:id/profile", requireAuth(async (req, res, me) => {
  const db = await getDB();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: "No encontrado" });
  if (target.id !== me.id && me.rank !== "rey") return res.status(403).json({ error: "No autorizado" });
  const { bio, avatar, title } = req.body ?? {};
  if (typeof bio === "string") target.bio = bio.slice(0, 400);
  if (typeof avatar === "string") target.avatar = avatar.slice(0, 200000);
  if (typeof title === "string" && me.rank === "rey") target.title = title.slice(0, 60);
  await save();
  res.json({ user: publicUser(target) });
}));

// ===== ADMIN: ranks, ban, global msg, coins =====
router.post("/admin/rank", requireAuth(async (req, res, me) => {
  if (me.rank !== "rey") return res.status(403).json({ error: "Solo el Rey puede otorgar rangos" });
  const { userId, rank } = req.body ?? {};
  const validRanks: Rank[] = ["campesino", "soldado", "noble", "magistrado", "rey"];
  if (!validRanks.includes(rank)) return res.status(400).json({ error: "Rango inválido" });
  const db = await getDB();
  const u = db.users.find((x) => x.id === userId);
  if (!u) return res.status(404).json({ error: "No encontrado" });
  const previous = u.rank;
  if (u.username.toLowerCase() === "victios7") {
    u.rank = "rey";
  } else {
    u.rank = rank;
  }
  // Auto-proclamation when someone is named Noble or higher (and was lower before)
  const ranking = ["campesino", "soldado", "noble", "magistrado", "rey"];
  const promoted = ranking.indexOf(u.rank) > ranking.indexOf(previous);
  if (promoted && (u.rank === "noble" || u.rank === "magistrado")) {
    const phrase = u.rank === "noble"
      ? `⚜ Por decreto del Rey ${me.username}, ${u.username} ha sido nombrado NOBLE del Reino. ¡Larga vida al nuevo señor!`
      : `⚖ Por decreto del Rey ${me.username}, ${u.username} ha sido elevado a MAGISTRADO. Que la justicia le acompañe.`;
    db.globals.unshift({ id: id(), fromId: me.id, text: phrase, createdAt: Date.now() });
    db.globals = db.globals.slice(0, 50);
    // Auto-assign territories on noble promotion
    if (u.rank === "noble") {
      const granted = assignTerritoriesToNoble(db, u.id);
      const villageNames = granted.villages.map((v) => v.name).join(", ");
      if (villageNames) {
        const territoryProclaim = `🏰 Al noble ${u.username} se le otorgan los pueblos de ${villageNames}${granted.city ? ` y la ciudad de ${granted.city.name}` : ""}.`;
        db.globals.unshift({ id: id(), fromId: me.id, text: territoryProclaim, createdAt: Date.now() });
        db.globals = db.globals.slice(0, 50);
      }
    }
  }
  // Demoted from noble/magistrado: release territories
  const wasNoble = previous === "noble" || previous === "magistrado";
  const isNoble = u.rank === "noble" || u.rank === "magistrado";
  if (wasNoble && !isNoble) {
    releaseTerritories(db, u.id);
  }
  if (promoted && u.rank === "rey" && u.username.toLowerCase() !== "victios7") {
    u.rank = "magistrado";
  }
  await save();
  res.json({ user: publicUser(u) });
}));

router.post("/admin/coins", requireAuth(async (req, res, me) => {
  if (me.rank !== "rey") return res.status(403).json({ error: "Solo el Rey reparte oro" });
  const { userId, delta } = req.body ?? {};
  const n = parseInt(String(delta), 10);
  if (isNaN(n)) return res.status(400).json({ error: "Cantidad inválida" });
  const db = await getDB();
  const u = db.users.find((x) => x.id === userId);
  if (!u) return res.status(404).json({ error: "No encontrado" });
  u.coins = Math.max(0, u.coins + n);
  await save();
  res.json({ user: publicUser(u) });
}));

router.post("/admin/ban", requireAuth(async (req, res, me) => {
  if (!rankAtLeast(me, "magistrado")) return res.status(403).json({ error: "Necesitas ser magistrado o superior" });
  const { userId, reason, scope } = req.body ?? {};
  const db = await getDB();
  const u = db.users.find((x) => x.id === userId);
  if (!u) return res.status(404).json({ error: "No encontrado" });
  if (u.id === me.id) return res.status(400).json({ error: "No puedes desterrarte a ti mismo" });
  if (u.username.toLowerCase() === "victios7") return res.status(403).json({ error: "No puedes desterrar al Rey" });
  if (RANK_ORDER.indexOf(u.rank) >= RANK_ORDER.indexOf(me.rank)) {
    return res.status(403).json({ error: "No puedes desterrar a alguien de tu mismo rango o superior" });
  }
  u.banned = true;
  const phrases: Record<string, string> = {
    rey: `¡Has sido expulsado del Reino por orden del Rey ${me.username}! Razón: ${reason ?? "decreto real"}`,
    magistrado: `El Magistrado ${me.username} ha dictado tu destierro. Razón: ${reason ?? "violación del código"}`,
    noble: `El noble ${me.username} te ha expulsado de su ${scope ?? "ducado"}. Razón: ${reason ?? "deshonra al señorío"}`,
  };
  u.banReason = phrases[me.rank] ?? `Has sido expulsado por ${me.username}. Razón: ${reason ?? "sin especificar"}`;
  u.banBy = me.username;
  db.sessions = db.sessions.filter((s) => s.userId !== u.id);
  await save();
  res.json({ user: publicUser(u) });
}));

router.post("/admin/unban", requireAuth(async (req, res, me) => {
  if (!rankAtLeast(me, "magistrado")) return res.status(403).json({ error: "No autorizado" });
  const { userId } = req.body ?? {};
  const db = await getDB();
  const u = db.users.find((x) => x.id === userId);
  if (!u) return res.status(404).json({ error: "No encontrado" });
  u.banned = false;
  u.banReason = undefined;
  u.banBy = undefined;
  await save();
  res.json({ user: publicUser(u) });
}));

router.post("/admin/global", requireAuth(async (req, res, me) => {
  if (me.rank !== "rey") return res.status(403).json({ error: "Solo el Rey puede enviar proclamas" });
  const { text } = req.body ?? {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Texto requerido" });
  const db = await getDB();
  const msg = { id: id(), fromId: me.id, text: text.slice(0, 500), createdAt: Date.now() };
  db.globals.unshift(msg);
  db.globals = db.globals.slice(0, 50);
  await save();
  res.json({ message: msg });
}));

router.delete("/admin/global/:id", requireAuth(async (req, res, me) => {
  if (me.rank !== "rey") return res.status(403).json({ error: "Solo el Rey" });
  const db = await getDB();
  db.globals = db.globals.filter((g) => g.id !== req.params.id);
  await save();
  res.json({ ok: true });
}));

router.get("/global", async (_req, res) => {
  const db = await getDB();
  const enriched = db.globals.map((m) => {
    const u = db.users.find((x) => x.id === m.fromId);
    return { ...m, fromUsername: u?.username ?? "?" };
  });
  res.json({ messages: enriched });
});

// ===== PROJECTS =====
router.get("/projects", async (_req, res) => {
  const db = await getDB();
  const list = db.projects
    .filter((p) => p.isPublic)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 200)
    .map((p) => {
      const u = db.users.find((x) => x.id === p.ownerId);
      return {
        id: p.id,
        name: p.name,
        thumbnail: p.thumbnail,
        ownerUsername: u?.username ?? "?",
        ownerRank: u?.rank ?? "campesino",
        loves: p.loves.length,
        plays: p.plays,
        updatedAt: p.updatedAt,
      };
    });
  res.json({ projects: list });
});

router.get("/projects/:id", async (req, res) => {
  const db = await getDB();
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Proyecto no encontrado" });
  const owner = db.users.find((u) => u.id === p.ownerId);
  const comments = db.comments
    .filter((c) => c.projectId === p.id)
    .map((c) => {
      const u = db.users.find((x) => x.id === c.userId);
      return { ...c, username: u?.username ?? "?", rank: u?.rank ?? "campesino" };
    });
  res.json({ project: { ...p, ownerUsername: owner?.username ?? "?", ownerRank: owner?.rank ?? "campesino" }, comments });
});

router.post("/projects", requireAuth(async (req, res, me) => {
  const { name, code, sprites, backdrops, isPublic, kingdomId, thumbnail } = req.body ?? {};
  const db = await getDB();
  const p = {
    id: id(),
    ownerId: me.id,
    name: String(name ?? "Proyecto sin nombre").slice(0, 80),
    code: String(code ?? ""),
    sprites: sprites ?? [],
    backdrops: backdrops ?? [],
    thumbnail: typeof thumbnail === "string" ? thumbnail.slice(0, 200000) : undefined,
    isPublic: !!isPublic,
    kingdomId: kingdomId ?? null,
    countyId: null,
    plays: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    loves: [],
  };
  db.projects.push(p);
  await save();
  res.json({ project: p });
}));

router.put("/projects/:id", requireAuth(async (req, res, me) => {
  const db = await getDB();
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Proyecto no encontrado" });
  if (p.ownerId !== me.id && me.rank !== "rey") return res.status(403).json({ error: "No autorizado" });
  const { name, code, sprites, backdrops, isPublic, thumbnail, kingdomId } = req.body ?? {};
  if (typeof name === "string") p.name = name.slice(0, 80);
  if (typeof code === "string") p.code = code;
  if (sprites !== undefined) p.sprites = sprites;
  if (backdrops !== undefined) p.backdrops = backdrops;
  if (typeof isPublic === "boolean") p.isPublic = isPublic;
  if (typeof thumbnail === "string") p.thumbnail = thumbnail.slice(0, 200000);
  if (kingdomId !== undefined) p.kingdomId = kingdomId;
  p.updatedAt = Date.now();
  await save();
  res.json({ project: p });
}));

router.delete("/projects/:id", requireAuth(async (req, res, me) => {
  const db = await getDB();
  const idx = db.projects.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "No encontrado" });
  const p = db.projects[idx]!;
  if (p.ownerId !== me.id && !rankAtLeast(me, "magistrado")) return res.status(403).json({ error: "No autorizado" });
  db.projects.splice(idx, 1);
  await save();
  res.json({ ok: true });
}));

router.post("/projects/:id/love", requireAuth(async (req, res, me) => {
  const db = await getDB();
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "No encontrado" });
  if (p.loves.includes(me.id)) p.loves = p.loves.filter((x) => x !== me.id);
  else p.loves.push(me.id);
  await save();
  res.json({ loves: p.loves.length });
}));

// PLAY: track play and reward owner with coins based on owner's rank
router.post("/projects/:id/play", async (req, res) => {
  const db = await getDB();
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "No encontrado" });
  const me = await authUser(req);
  // Don't reward self-plays
  if (me && me.id === p.ownerId) {
    return res.json({ plays: p.plays, coinsEarned: 0 });
  }
  p.plays = (p.plays ?? 0) + 1;
  const owner = db.users.find((u) => u.id === p.ownerId);
  let coinsEarned = 0;
  if (owner) {
    coinsEarned = COINS_PER_PLAY[owner.rank] ?? 1;
    owner.coins = (owner.coins ?? 0) + coinsEarned;
    owner.coinsEarnedToday = (owner.coinsEarnedToday ?? 0) + coinsEarned;
  }
  await save();
  res.json({ plays: p.plays, coinsEarned });
});

router.post("/projects/:id/comment", requireAuth(async (req, res, me) => {
  const { text } = req.body ?? {};
  if (!text) return res.status(400).json({ error: "Texto vacío" });
  const db = await getDB();
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "No encontrado" });
  const c = { id: id(), projectId: p.id, userId: me.id, text: String(text).slice(0, 500), createdAt: Date.now() };
  db.comments.push(c);
  await save();
  res.json({ comment: { ...c, username: me.username, rank: me.rank } });
}));

// ===== KINGDOMS / CLANS =====
router.get("/kingdoms", async (_req, res) => {
  const db = await getDB();
  const list = db.kingdoms.map((k) => {
    const owner = db.users.find((u) => u.id === k.ownerId);
    return { ...k, ownerUsername: owner?.username ?? "?", memberCount: k.members.length };
  });
  res.json({ kingdoms: list });
});

router.post("/kingdoms", requireAuth(async (req, res, me) => {
  const { name, description, type, parentId } = req.body ?? {};
  const t = String(type ?? "clan");
  const db = await getDB();
  if (t === "reino" && me.rank !== "rey") return res.status(403).json({ error: "Solo el Rey funda reinos" });
  if ((t === "condado" || t === "ducado") && !rankAtLeast(me, "noble")) {
    return res.status(403).json({ error: "Solo nobles fundan condados/ducados" });
  }
  const k = {
    id: id(),
    name: String(name ?? "Clan").slice(0, 60),
    description: String(description ?? "").slice(0, 400),
    type: (["reino", "condado", "ducado", "clan"].includes(t) ? t : "clan") as "reino" | "condado" | "ducado" | "clan",
    ownerId: me.id,
    parentId: parentId ?? null,
    members: [me.id],
    createdAt: Date.now(),
  };
  db.kingdoms.push(k);
  await save();
  res.json({ kingdom: k });
}));

router.post("/kingdoms/:id/join", requireAuth(async (req, res, me) => {
  const db = await getDB();
  const k = db.kingdoms.find((x) => x.id === req.params.id);
  if (!k) return res.status(404).json({ error: "No encontrado" });
  if (!k.members.includes(me.id)) k.members.push(me.id);
  await save();
  res.json({ kingdom: k });
}));

router.post("/kingdoms/:id/leave", requireAuth(async (req, res, me) => {
  const db = await getDB();
  const k = db.kingdoms.find((x) => x.id === req.params.id);
  if (!k) return res.status(404).json({ error: "No encontrado" });
  k.members = k.members.filter((m) => m !== me.id);
  await save();
  res.json({ kingdom: k });
}));

// ===== CHAT =====
router.get("/chat/:withId", requireAuth(async (req, res, me) => {
  const db = await getDB();
  const msgs = db.messages
    .filter(
      (m) =>
        (m.fromId === me.id && m.toId === req.params.withId) ||
        (m.toId === me.id && m.fromId === req.params.withId),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  res.json({ messages: msgs });
}));

router.get("/chat", requireAuth(async (_req, res, me) => {
  const db = await getDB();
  const partners = new Set<string>();
  db.messages.forEach((m) => {
    if (m.fromId === me.id) partners.add(m.toId);
    if (m.toId === me.id) partners.add(m.fromId);
  });
  const list = [...partners].map((pid) => {
    const u = db.users.find((x) => x.id === pid);
    const last = [...db.messages]
      .filter((m) => (m.fromId === pid && m.toId === me.id) || (m.toId === pid && m.fromId === me.id))
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return { user: u ? publicUser(u) : null, last };
  });
  res.json({ chats: list });
}));

router.post("/chat/:withId", requireAuth(async (req, res, me) => {
  const { text } = req.body ?? {};
  if (!text) return res.status(400).json({ error: "Texto vacío" });
  const db = await getDB();
  const target = db.users.find((u) => u.id === req.params.withId);
  if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
  const m = {
    id: id(),
    fromId: me.id,
    toId: target.id,
    text: String(text).slice(0, 800),
    createdAt: Date.now(),
    read: false,
  };
  db.messages.push(m);
  await save();
  res.json({ message: m });
}));

// ===== MAP / LOCATIONS =====
router.get("/map", async (_req, res) => {
  const db = await getDB();
  const locations = db.locations.map((l) => {
    const owner = l.ownerId ? db.users.find((u) => u.id === l.ownerId) : null;
    const population = db.users.filter((u) => u.homeId === l.id).length;
    return {
      ...l,
      owner: owner ? { id: owner.id, username: owner.username, rank: owner.rank } : null,
      population,
    };
  });
  res.json({ locations });
});

router.get("/locations/:id", async (req, res) => {
  const db = await getDB();
  const loc = db.locations.find((l) => l.id === req.params.id);
  if (!loc) return res.status(404).json({ error: "Lugar no encontrado" });
  const residents = db.users.filter((u) => u.homeId === loc.id).map(publicUser);
  const residentIds = new Set(residents.map((r) => r.id));
  const projects = db.projects
    .filter((p) => p.isPublic && residentIds.has(p.ownerId))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50);
  const owner = loc.ownerId ? db.users.find((u) => u.id === loc.ownerId) : null;
  res.json({
    location: loc,
    owner: owner ? publicUser(owner) : null,
    residents,
    projects,
  });
});

router.get("/nobles/:id/territories", async (req, res) => {
  const db = await getDB();
  const noble = db.users.find((u) => u.id === req.params.id);
  if (!noble) return res.status(404).json({ error: "Noble no encontrado" });
  const territories = db.locations.filter((l) => l.ownerId === noble.id);
  const residentIds = new Set<string>();
  for (const loc of territories) {
    db.users.forEach((u) => { if (u.homeId === loc.id) residentIds.add(u.id); });
  }
  const projects = db.projects
    .filter((p) => p.isPublic && residentIds.has(p.ownerId))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 100);
  res.json({ noble: publicUser(noble), territories, projects });
});

router.post("/admin/territory", requireAuth(async (req, res, me) => {
  if (me.rank !== "rey") return res.status(403).json({ error: "Solo el Rey reparte tierras" });
  const { locationId, nobleId } = req.body ?? {};
  if (!locationId) return res.status(400).json({ error: "Falta locationId" });
  const db = await getDB();
  const loc = db.locations.find((l) => l.id === locationId);
  if (!loc) return res.status(404).json({ error: "Lugar no encontrado" });
  if (loc.type === "capital") return res.status(403).json({ error: "La capital pertenece al Rey" });
  if (nobleId === null || nobleId === undefined || nobleId === "") {
    // Revoke
    const previous = loc.ownerId;
    loc.ownerId = null;
    if (previous) {
      const oldOwner = db.users.find((u) => u.id === previous);
      if (oldOwner) {
        db.globals.unshift({ id: id(), fromId: me.id, text: `📜 El Rey ${me.username} retira ${loc.name} de las manos de ${oldOwner.username}.`, createdAt: Date.now() });
        db.globals = db.globals.slice(0, 50);
      }
    }
  } else {
    const noble = db.users.find((u) => u.id === nobleId);
    if (!noble) return res.status(404).json({ error: "Noble no encontrado" });
    if (noble.rank !== "noble" && noble.rank !== "magistrado") return res.status(400).json({ error: "Solo nobles o magistrados pueden tener territorios" });
    loc.ownerId = noble.id;
    db.globals.unshift({ id: id(), fromId: me.id, text: `🏰 El Rey ${me.username} otorga ${loc.name} al noble ${noble.username}.`, createdAt: Date.now() });
    db.globals = db.globals.slice(0, 50);
  }
  await save();
  res.json({ location: loc });
}));

// ===== COURT =====
function isCourtMember(u: User) {
  return u.rank === "noble" || u.rank === "magistrado" || u.rank === "rey";
}

router.get("/court/messages", requireAuth(async (_req, res, me) => {
  if (!isCourtMember(me)) return res.status(403).json({ error: "Solo nobles, magistrados y el Rey acceden a la Corte" });
  const db = await getDB();
  const messages = [...(db.courtMessages ?? [])].sort((a, b) => a.createdAt - b.createdAt).slice(-200);
  const courtiers = db.users.filter(isCourtMember).map(publicUser);
  res.json({ messages, courtiers });
}));

router.post("/court/messages", requireAuth(async (req, res, me) => {
  if (!isCourtMember(me)) return res.status(403).json({ error: "Solo nobles, magistrados y el Rey acceden a la Corte" });
  const { text, kind } = req.body ?? {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Texto vacío" });
  const k = (kind === "decreto" && me.rank === "rey") ? "decreto" : (kind === "anuncio" && (me.rank === "rey" || me.rank === "magistrado")) ? "anuncio" : "mensaje";
  const db = await getDB();
  if (!db.courtMessages) db.courtMessages = [];
  const msg = { id: id(), fromId: me.id, text: text.slice(0, 800), createdAt: Date.now(), kind: k as "mensaje" | "anuncio" | "decreto" };
  db.courtMessages.push(msg);
  if (db.courtMessages.length > 500) db.courtMessages = db.courtMessages.slice(-500);
  // Decrees become global proclamations too
  if (k === "decreto") {
    db.globals.unshift({ id: id(), fromId: me.id, text: `📜 Decreto Real: ${text.slice(0, 200)}`, createdAt: Date.now() });
    db.globals = db.globals.slice(0, 50);
  }
  await save();
  res.json({ message: msg });
}));

export default router;
