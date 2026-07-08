import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { loadGates, getBookmarks, type Bookmark } from "../lib/data";

export default function Vault() {
  const [gates, setGates] = useState<{ gate: string; count: number }[]>([]);
  const [marks, setMarks] = useState<Bookmark[]>([]);
  useEffect(() => {
    loadGates().then(setGates);
    setMarks(getBookmarks().slice(0, 4));
  }, []);

  return (
    <div className="mx-auto max-w-xl px-6 pt-12">
      <p className="font-label text-[11px] tracking-rite text-gold">THE VAULT</p>
      <h1 className="mt-2 font-heading text-4xl text-parchment">
        The gates of the record
      </h1>

      {marks.length > 0 && (
        <section className="mt-8">
          <p className="font-label text-[10px] tracking-seal text-vellum">
            YOUR PLACE IS KEPT
          </p>
          <div className="mt-2">
            {marks.map((m) => (
              <Link
                key={m.id}
                to={`/read/${encodeURIComponent(m.id)}`}
                className="block border-b border-gold/10 py-2.5 font-body italic text-parchment/90 hover:text-parchment"
              >
                <span className="font-label not-italic text-xs text-gold mr-3">
                  {m.id}
                </span>
                {m.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8">
        {gates.map((g, i) => {
          const m = g.gate.match(/^Gate (\S+) — (.+)$/);
          return (
            <Link
              key={g.gate}
              to={`/vault/${encodeURIComponent(m ? m[1] : String(i))}`}
              className="group flex items-baseline gap-5 border-b border-gold/10 py-5 transition-colors hover:bg-gold/5"
            >
              <span className="w-10 shrink-0 text-right font-label text-lg text-gold">
                {m ? m[1] : "·"}
              </span>
              <span className="flex-1 font-heading text-2xl leading-tight text-parchment">
                {m ? m[2] : g.gate}
              </span>
              <span className="shrink-0 font-body text-sm italic text-vellum">
                {g.count.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="py-10 text-center font-body text-xs italic text-vellum/60">
        Every scroll verbatim. The vault is a window, never an editor.
      </p>
    </div>
  );
}
