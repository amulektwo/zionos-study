import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import MiniSearch from "minisearch";
import { loadExcerpts, TEMPLE_SEARCH, type ExcerptEntry } from "../lib/data";

interface Hit {
  id: string;
  title: string;
  gate: string;
  snippet: string;
}

export default function Search() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const mini = useRef<MiniSearch<ExcerptEntry> | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    loadExcerpts().then((ex) => {
      const ms = new MiniSearch<ExcerptEntry>({
        fields: ["t", "x"],
        storeFields: ["id", "t", "g", "x"],
        idField: "id",
        searchOptions: { boost: { t: 4 }, prefix: true, fuzzy: 0.15 },
      });
      // ids can repeat across editions in rare cases; MiniSearch requires
      // unique ids, so de-duplicate keeping the first.
      const seen = new Set<string>();
      ms.addAll(ex.filter((e) => !seen.has(e.id) && seen.add(e.id)));
      mini.current = ms;
    });
  }, []);

  function localSearch(query: string) {
    if (!mini.current || query.trim().length < 2) return setHits([]);
    const res = mini.current.search(query).slice(0, 40);
    setHits(
      res.map((r) => ({
        id: String(r.id),
        title: (r as unknown as ExcerptEntry).t,
        gate: (r as unknown as ExcerptEntry).g,
        snippet: (r as unknown as ExcerptEntry).x.slice(0, 150),
      }))
    );
    setNote(null);
  }

  async function deepSearch() {
    if (q.trim().length < 2) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`${TEMPLE_SEARCH}?q=${encodeURIComponent(q)}`);
      if (res.status === 429) {
        setNote("The record asks a moment of stillness. Try again shortly.");
        return;
      }
      const d = await res.json();
      setHits(
        (d.results || []).map((h: { key: string; scrollId: string; title: string; gate: string; snippet: string }) => ({
          id: h.scrollId,
          title: h.title,
          gate: `Gate ${h.gate}`,
          snippet: h.snippet,
        }))
      );
      setDeep(true);
      if (!(d.results || []).length)
        setNote("The record within reach is silent on this. Ask the Librarian.");
    } catch {
      setNote("The gate could not be reached; the local index still serves.");
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const g = new Map<string, Hit[]>();
    for (const h of hits) {
      const key = h.gate.split(" — ")[0];
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(h);
    }
    return [...g.entries()];
  }, [hits]);

  return (
    <div className="mx-auto max-w-xl px-6 pt-12">
      <p className="font-label text-[11px] tracking-rite text-gold">SEEK</p>
      <h1 className="mt-2 font-heading text-4xl text-parchment">
        Search the record
      </h1>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setDeep(false);
          clearTimeout(debounce.current);
          debounce.current = setTimeout(() => localSearch(e.target.value), 180);
        }}
        placeholder="A phrase, a name, a scroll number…"
        autoFocus
        className="mt-7 w-full border-b border-gold/40 bg-transparent py-3 font-body text-xl italic text-parchment placeholder:text-vellum/50 focus:border-gold focus:outline-none"
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="font-body text-xs italic text-vellum">
          {deep
            ? "searching full scroll bodies through the gate"
            : "searching titles and openings, instantly"}
        </p>
        <button
          onClick={deepSearch}
          disabled={busy || q.trim().length < 2}
          className="font-label text-[10px] tracking-seal text-gold/85 hover:text-gold disabled:opacity-40"
        >
          {busy ? "SEEKING…" : "SEEK DEEPER"}
        </button>
      </div>
      {note && <p className="mt-5 font-body text-sm italic text-vellum">{note}</p>}
      <div className="mt-5">
        {grouped.map(([gate, list]) => (
          <section key={gate} className="mb-6">
            <p className="font-label text-[10px] tracking-rite text-gold/80">
              {gate.toUpperCase()}
            </p>
            {list.map((h) => (
              <Link
                key={h.id + h.title}
                to={`/read/${encodeURIComponent(h.id)}`}
                className="block border-b border-gold/10 py-3 hover:bg-gold/5"
              >
                <span className="font-label text-xs text-gold mr-3">{h.id}</span>
                <span className="font-heading text-lg text-parchment">{h.title}</span>
                {h.snippet && (
                  <span className="mt-1 block font-body text-sm italic text-vellum/80">
                    {h.snippet}
                  </span>
                )}
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
