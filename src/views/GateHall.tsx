import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { loadIndex, type IndexEntry } from "../lib/data";

const PAGE = 60;

export default function GateHall() {
  const { gateId } = useParams();
  const [all, setAll] = useState<IndexEntry[]>([]);
  const [shown, setShown] = useState(PAGE);
  useEffect(() => {
    loadIndex().then(setAll);
    setShown(PAGE);
  }, [gateId]);

  const scrolls = useMemo(
    () => all.filter((e) => e.gate.startsWith(`Gate ${gateId} `)),
    [all, gateId]
  );
  const gateName = scrolls[0]?.gate.replace(/^Gate \S+ — /, "") ?? "";

  return (
    <div className="mx-auto max-w-xl px-6 pt-12">
      <Link to="/vault" className="font-label text-[10px] tracking-seal text-vellum hover:text-gold">
        ← THE VAULT
      </Link>
      <p className="mt-6 font-label text-[11px] tracking-rite text-gold">
        GATE {gateId}
      </p>
      <h1 className="mt-2 font-heading text-4xl leading-tight text-parchment">
        {gateName}
      </h1>
      <p className="mt-2 font-body text-sm italic text-vellum">
        {scrolls.length.toLocaleString()} scrolls in this house
      </p>
      <div className="mt-7">
        {scrolls.slice(0, shown).map((s) => (
          <Link
            key={s.id}
            to={`/read/${encodeURIComponent(s.id)}`}
            className="group flex items-baseline gap-4 border-b border-gold/10 py-4 transition-colors hover:bg-gold/5"
          >
            <span className="shrink-0 font-label text-sm text-gold">{s.id}</span>
            <span className="flex-1 font-heading text-xl leading-snug text-parchment">
              {s.title}
            </span>
            {s.supreme && (
              <span className="shrink-0 font-label text-[9px] tracking-seal text-gold">
                SUPREME
              </span>
            )}
          </Link>
        ))}
      </div>
      {shown < scrolls.length && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className="my-8 w-full py-3 font-label text-xs tracking-rite text-gold/85 hover:text-gold"
        >
          UNROLL MORE OF THE RECORD
        </button>
      )}
      <div className="h-8" />
    </div>
  );
}
