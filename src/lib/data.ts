// ---------------------------------------------------------------------------
// data.ts — the corpus window. Metadata + excerpts ship statically; every
// full body arrives through THE SHIELD (rate-limited, origin-locked).
// The canon is a window, never an editor.
// ---------------------------------------------------------------------------
export const SHIELD = "https://zionos-temple.vercel.app/api/city/";
export const TEMPLE_SEARCH = "https://zionos-temple.vercel.app/api/search";
export const TEMPLE_ORACLE = "https://zionos-temple.vercel.app/api/oracle";
const BASE = import.meta.env.BASE_URL;

export interface IndexEntry {
  id: string;
  title: string;
  gate: string;
  supreme?: boolean;
}
export interface ExcerptEntry {
  id: string;
  t: string;
  g: string;
  x: string;
}
export interface ScrollDoc {
  id: string;
  title: string;
  author: string;
  gate: string;
  sealed: boolean;
  supreme: boolean;
  body: string;
}

let indexCache: IndexEntry[] | null = null;
let excerptCache: ExcerptEntry[] | null = null;

export async function loadIndex(): Promise<IndexEntry[]> {
  if (!indexCache) {
    indexCache = await (await fetch(`${BASE}data/index.json`)).json();
  }
  return indexCache!;
}

export async function loadExcerpts(): Promise<ExcerptEntry[]> {
  if (!excerptCache) {
    excerptCache = await (await fetch(`${BASE}data/search-index.json`)).json();
  }
  return excerptCache!;
}

export function gateOrder(gate: string): number {
  const m = gate.match(/Gate (\S+)/);
  if (!m) return 99;
  return m[1] === "00" ? -1 : parseFloat(m[1]) || 0;
}

export async function loadGates(): Promise<{ gate: string; count: number }[]> {
  const idx = await loadIndex();
  const map = new Map<string, number>();
  for (const e of idx) map.set(e.gate, (map.get(e.gate) || 0) + 1);
  return [...map.entries()]
    .map(([gate, count]) => ({ gate, count }))
    .sort((a, b) => gateOrder(a.gate) - gateOrder(b.gate));
}

// --- bodies through the shield, with a bounded local cache (offline law:
//     the shell and your recent reading survive; the canon never sits whole
//     on any seeker's disk) ---
const LRU_KEY = "zionos-lru";
const LRU_MAX = 30;

function lruGet(id: string): ScrollDoc | null {
  try {
    const raw = localStorage.getItem(`zionos-scroll-${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function lruPut(doc: ScrollDoc) {
  try {
    const order: string[] = JSON.parse(localStorage.getItem(LRU_KEY) || "[]");
    const next = [doc.id, ...order.filter((x) => x !== doc.id)];
    for (const evict of next.slice(LRU_MAX)) {
      localStorage.removeItem(`zionos-scroll-${evict}`);
    }
    localStorage.setItem(LRU_KEY, JSON.stringify(next.slice(0, LRU_MAX)));
    localStorage.setItem(`zionos-scroll-${doc.id}`, JSON.stringify(doc));
  } catch {
    /* storage full: reading still works, cache silently skips */
  }
}

export async function fetchScroll(id: string): Promise<ScrollDoc> {
  const res = await fetch(SHIELD + encodeURIComponent(id)).catch(() => null);
  if (res && res.ok) {
    const doc = await res.json();
    lruPut(doc);
    return doc;
  }
  const cached = lruGet(id);
  if (cached) return cached;
  if (res && res.status === 429)
    throw new Error("The scrolls ask a moment of stillness. Try again shortly.");
  throw new Error("The gate could not be reached. The scroll waits in the vault.");
}

// --- bookmarks & highlights (local-first; sync awaits the keys) ---
export interface Bookmark {
  id: string;
  title: string;
  gate: string;
  at: number;
}
export function getBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem("zionos-bookmarks") || "[]");
  } catch {
    return [];
  }
}
export function toggleBookmark(e: { id: string; title: string; gate: string }): boolean {
  const all = getBookmarks();
  const has = all.some((b) => b.id === e.id);
  const next = has
    ? all.filter((b) => b.id !== e.id)
    : [{ ...e, at: Date.now() }, ...all];
  localStorage.setItem("zionos-bookmarks", JSON.stringify(next.slice(0, 500)));
  return !has;
}
