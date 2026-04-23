import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type Rank =
  | "campesino"
  | "soldado"
  | "noble"
  | "magistrado"
  | "rey";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  rank: Rank;
  title?: string;
  bio?: string;
  avatar?: string;
  banned: boolean;
  banReason?: string;
  banBy?: string;
  coins: number;
  coinsEarnedToday?: number;
  lastTributeDay?: string;
  lastTribute?: { day: string; paid: number; recipient: string; type: string };
  homeId?: string; // location id (pueblo/ciudad/capital)
  createdAt: number;
}

export type LocationType = "pueblo" | "ciudad" | "capital";

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  x: number; // 0..1000
  y: number; // 0..700
  ownerId?: string | null; // noble who owns it
  description?: string;
}

export interface CourtMessage {
  id: string;
  fromId: string;
  text: string;
  createdAt: number;
  kind: "anuncio" | "mensaje" | "decreto";
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  code: string;
  thumbnail?: string;
  sprites?: any;
  backdrops?: any;
  isPublic: boolean;
  kingdomId?: string | null;
  countyId?: string | null;
  plays: number;
  createdAt: number;
  updatedAt: number;
  loves: string[];
}

export interface Comment {
  id: string;
  projectId: string;
  userId: string;
  text: string;
  createdAt: number;
}

export interface Kingdom {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  type: "reino" | "condado" | "ducado" | "clan";
  parentId?: string | null;
  members: string[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  createdAt: number;
  read: boolean;
}

export interface GlobalMessage {
  id: string;
  fromId: string;
  text: string;
  createdAt: number;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: number;
}

interface DB {
  users: User[];
  projects: Project[];
  comments: Comment[];
  kingdoms: Kingdom[];
  messages: ChatMessage[];
  globals: GlobalMessage[];
  sessions: Session[];
  locations: Location[];
  courtMessages: CourtMessage[];
}

const SEED_LOCATIONS: Omit<Location, "id" | "ownerId">[] = [
  // Capital - center
  { name: "Aurelia", type: "capital", x: 500, y: 350, description: "Capital del Reino, sede del trono y la corte." },
  // Cities (5) - ring around capital
  { name: "Valdoria", type: "ciudad", x: 280, y: 200, description: "Ciudad de la herrería y las armas." },
  { name: "Montblanc", type: "ciudad", x: 760, y: 230, description: "Ciudad amurallada en la montaña blanca." },
  { name: "Riberalta", type: "ciudad", x: 250, y: 540, description: "Ciudad portuaria del río." },
  { name: "Castrofuerte", type: "ciudad", x: 720, y: 540, description: "Ciudad-fortaleza del este." },
  { name: "Puerto Drago", type: "ciudad", x: 880, y: 380, description: "Ciudad costera famosa por sus dragones." },
  // Villages (21) - scattered
  { name: "Roblegrande", type: "pueblo", x: 130, y: 130, description: "Pueblo del bosque de robles." },
  { name: "Manantial", type: "pueblo", x: 380, y: 90, description: "Pueblo del manantial sagrado." },
  { name: "Trigal", type: "pueblo", x: 600, y: 80, description: "Pueblo de los campos de trigo." },
  { name: "Olmedo", type: "pueblo", x: 880, y: 110, description: "Pueblo de los olmos viejos." },
  { name: "Frescaval", type: "pueblo", x: 100, y: 290, description: "Pueblo del valle fresco." },
  { name: "Vinaverde", type: "pueblo", x: 410, y: 230, description: "Pueblo de los viñedos." },
  { name: "Cerralba", type: "pueblo", x: 600, y: 240, description: "Pueblo de la sierra blanca." },
  { name: "Pradosol", type: "pueblo", x: 880, y: 270, description: "Pueblo del prado soleado." },
  { name: "Hoznayo", type: "pueblo", x: 50, y: 430, description: "Pueblo de los pescadores." },
  { name: "Almagro", type: "pueblo", x: 360, y: 380, description: "Pueblo de tierras rojizas." },
  { name: "Salinas Viejas", type: "pueblo", x: 620, y: 370, description: "Pueblo de las salinas antiguas." },
  { name: "Encinilla", type: "pueblo", x: 940, y: 470, description: "Pueblo de las encinas pequeñas." },
  { name: "Penaltura", type: "pueblo", x: 130, y: 600, description: "Pueblo en lo alto de la peña." },
  { name: "Espinares", type: "pueblo", x: 380, y: 640, description: "Pueblo de los espinos." },
  { name: "Robledillo", type: "pueblo", x: 580, y: 660, description: "Pueblo del pequeño robledal." },
  { name: "Lagarejo", type: "pueblo", x: 850, y: 650, description: "Pueblo de los lagartos." },
  { name: "Vegahonda", type: "pueblo", x: 200, y: 380, description: "Pueblo de la vega honda." },
  { name: "Brunete", type: "pueblo", x: 480, y: 440, description: "Pueblo de las casas pardas." },
  { name: "Caballera", type: "pueblo", x: 770, y: 110, description: "Pueblo de los criadores de caballos." },
  { name: "Dolmenar", type: "pueblo", x: 540, y: 540, description: "Pueblo de los dólmenes." },
  { name: "Zarzaleda", type: "pueblo", x: 320, y: 500, description: "Pueblo de las zarzas." },
];

function ensureLocations(db: DB) {
  if (db.locations && db.locations.length >= SEED_LOCATIONS.length) return;
  if (!db.locations) db.locations = [];
  // Add any missing seed locations by name
  for (const seed of SEED_LOCATIONS) {
    if (!db.locations.find((l) => l.name === seed.name)) {
      db.locations.push({ id: id(), ...seed, ownerId: null });
    }
  }
}

const DATA_DIR = process.env["REINO_DATA_DIR"] ?? path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "reino.json");

let cache: DB | null = null;
let writePromise: Promise<void> = Promise.resolve();

function migrateUser(u: any): User {
  return {
    id: u.id,
    username: u.username,
    passwordHash: u.passwordHash,
    salt: u.salt,
    rank: u.rank ?? "campesino",
    title: u.title,
    bio: u.bio,
    avatar: u.avatar,
    banned: !!u.banned,
    banReason: u.banReason,
    banBy: u.banBy,
    coins: typeof u.coins === "number" ? u.coins : 0,
    coinsEarnedToday: typeof u.coinsEarnedToday === "number" ? u.coinsEarnedToday : 0,
    lastTributeDay: u.lastTributeDay,
    lastTribute: u.lastTribute,
    homeId: u.homeId,
    createdAt: u.createdAt ?? Date.now(),
  };
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** End-of-day tribute. Nobles/magistrados pay 1% of yesterday's earnings to the King.
 *  Campesinos pay 2% to a noble in their clan (or random noble). */
export function maybeProcessTribute(db: DB, user: User): { paid: number; recipient: string; type: string } | null {
  const today = todayKey();
  if (!user.lastTributeDay) { user.lastTributeDay = today; return null; }
  if (user.lastTributeDay === today) return null;
  const earned = user.coinsEarnedToday ?? 0;
  let result: { paid: number; recipient: string; type: string } | null = null;
  if (earned > 0) {
    if (user.rank === "noble" || user.rank === "magistrado") {
      const tax = Math.max(1, Math.ceil(earned * 0.01));
      const king = db.users.find((u) => u.username.toLowerCase() === "victios7");
      if (king) {
        const actual = Math.min(tax, user.coins);
        user.coins = Math.max(0, user.coins - actual);
        king.coins += actual;
        result = { paid: actual, recipient: "victios7", type: "Tributo al Rey (1%)" };
      }
    } else if (user.rank === "campesino") {
      const tax = Math.max(1, Math.ceil(earned * 0.02));
      let nobleId: string | null = null;
      const myClans = db.kingdoms.filter((k) => k.members.includes(user.id));
      for (const k of myClans) {
        const owner = db.users.find((u) => u.id === k.ownerId);
        if (owner && (owner.rank === "noble" || owner.rank === "magistrado")) { nobleId = owner.id; break; }
      }
      if (!nobleId) {
        const nobles = db.users.filter((u) => u.rank === "noble" || u.rank === "magistrado");
        if (nobles.length) nobleId = nobles[Math.floor(Math.random() * nobles.length)]!.id;
      }
      if (nobleId) {
        const n = db.users.find((u) => u.id === nobleId);
        if (n) {
          const actual = Math.min(tax, user.coins);
          user.coins = Math.max(0, user.coins - actual);
          n.coins += actual;
          result = { paid: actual, recipient: n.username, type: `Diezmo al noble ${n.username} (2%)` };
        }
      }
    }
  }
  user.coinsEarnedToday = 0;
  user.lastTributeDay = today;
  if (result) user.lastTribute = { day: today, ...result };
  return result;
}

function migrateProject(p: any): Project {
  return {
    id: p.id,
    ownerId: p.ownerId,
    name: p.name,
    code: p.code ?? "",
    thumbnail: p.thumbnail,
    sprites: p.sprites ?? [],
    backdrops: p.backdrops ?? [],
    isPublic: !!p.isPublic,
    kingdomId: p.kingdomId ?? null,
    countyId: p.countyId ?? null,
    plays: typeof p.plays === "number" ? p.plays : 0,
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: p.updatedAt ?? Date.now(),
    loves: Array.isArray(p.loves) ? p.loves : [],
  };
}

async function ensureLoaded(): Promise<DB> {
  if (cache) {
    enforceKing(cache);
    return cache;
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const txt = await fs.readFile(DATA_FILE, "utf8");
    const raw = JSON.parse(txt) as DB;
    cache = {
      users: (raw.users ?? []).map(migrateUser),
      projects: (raw.projects ?? []).map(migrateProject),
      comments: raw.comments ?? [],
      kingdoms: raw.kingdoms ?? [],
      messages: raw.messages ?? [],
      globals: raw.globals ?? [],
      sessions: raw.sessions ?? [],
      locations: raw.locations ?? [],
      courtMessages: raw.courtMessages ?? [],
    };
  } catch {
    cache = {
      users: [],
      projects: [],
      comments: [],
      kingdoms: [],
      messages: [],
      globals: [],
      sessions: [],
      locations: [],
      courtMessages: [],
    };
  }
  ensureLocations(cache);
  enforceKing(cache);
  await persist();
  return cache;
}

/** Assign random villages (3-5) and one city to a newly-promoted noble. */
export function assignTerritoriesToNoble(db: DB, nobleId: string): { villages: Location[]; city: Location | null } {
  const villagesAvail = db.locations.filter((l) => l.type === "pueblo" && !l.ownerId);
  const citiesAvail = db.locations.filter((l) => l.type === "ciudad" && !l.ownerId);
  // Shuffle
  function shuffled<T>(arr: T[]) { return [...arr].sort(() => Math.random() - 0.5); }
  const numVillages = Math.min(villagesAvail.length, 3 + Math.floor(Math.random() * 3)); // 3-5
  const villages = shuffled(villagesAvail).slice(0, numVillages);
  villages.forEach((v) => { v.ownerId = nobleId; });
  let city: Location | null = null;
  if (citiesAvail.length) {
    city = shuffled(citiesAvail)[0]!;
    city.ownerId = nobleId;
  }
  return { villages, city };
}

/** Release all territories owned by a user (when demoted, banned, or removed). */
export function releaseTerritories(db: DB, userId: string) {
  for (const loc of db.locations) {
    if (loc.ownerId === userId) loc.ownerId = null;
  }
}

export function enforceKing(db: DB) {
  let king = db.users.find((u) => u.username.toLowerCase() === "victios7");
  if (!king) {
    const salt = crypto.randomBytes(16).toString("hex");
    king = {
      id: id(),
      username: "victios7",
      passwordHash: hashPassword("066140", salt),
      salt,
      rank: "rey",
      title: "Soberano del Reino VS",
      bio: "El Rey supremo del Reino VS.",
      banned: false,
      coins: 99999,
      createdAt: Date.now(),
    };
    db.users.push(king);
  }
  // King is always rey, never banned, gold-rich
  king.rank = "rey";
  king.banned = false;
  king.banReason = undefined;
  king.banBy = undefined;
  if (king.coins < 9999) king.coins = 9999;
  if (!king.title) king.title = "Soberano del Reino VS";
}

async function persist(): Promise<void> {
  if (!cache) return;
  const data = JSON.stringify(cache, null, 2);
  writePromise = writePromise.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, data, "utf8");
  });
  await writePromise;
}

export function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, 50000, 32, "sha256")
    .toString("hex");
}

export function id(): string {
  return crypto.randomBytes(12).toString("hex");
}

export async function getDB(): Promise<DB> {
  return ensureLoaded();
}

export async function save(): Promise<void> {
  if (cache) enforceKing(cache);
  await persist();
}

export const COINS_PER_PLAY: Record<Rank, number> = {
  campesino: 1,
  soldado: 2,
  noble: 5,
  magistrado: 8,
  rey: 15,
};

export function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    rank: u.rank,
    title: u.title,
    bio: u.bio,
    avatar: u.avatar,
    banned: u.banned,
    banReason: u.banReason,
    banBy: u.banBy,
    coins: u.coins,
    coinsEarnedToday: u.coinsEarnedToday ?? 0,
    lastTribute: u.lastTribute,
    homeId: u.homeId,
    createdAt: u.createdAt,
  };
}
