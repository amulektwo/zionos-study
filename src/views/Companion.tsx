import { Link } from "react-router-dom";
import { useState } from "react";
import { TEMPLE_ORACLE } from "../lib/data";

interface Source {
  scrollId: string;
  title: string;
  key?: string;
}

export default function Companion() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [state, setState] = useState<"idle" | "asking" | "done" | "unlit">("idle");
  const [note, setNote] = useState<string | null>(null);

  async function ask() {
    if (state === "asking" || question.trim().length < 3) return;
    setState("asking");
    setAnswer("");
    setSources([]);
    setNote(null);
    try {
      const res = await fetch(TEMPLE_ORACLE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.status === 503) {
        setState("unlit");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setNote(d.error || "The chamber is quiet. Ask again.");
        setState("idle");
        return;
      }
      const src = res.headers.get("X-Oracle-Sources");
      if (src) {
        try {
          setSources(JSON.parse(atob(src)));
        } catch { /* sources optional */ }
      }
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      if (reader)
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setAnswer((a) => a + dec.decode(value, { stream: true }));
        }
      setState("done");
    } catch {
      setNote("The gate could not be reached. Ask again.");
      setState("idle");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 pt-12">
      <p className="font-label text-[11px] tracking-rite text-gold">ECHO</p>
      <h1 className="mt-2 font-heading text-4xl text-parchment">Seek understanding</h1>
      <p className="mt-3 max-w-md font-body text-base italic leading-relaxed text-vellum">
        Echo answers from the scrolls alone, citing each one. Echo will
        not invent doctrine, and will not write new scripture. Ten questions
        are given to each seeker each day.
      </p>

      {state !== "done" && state !== "unlit" && (
        <>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            rows={2}
            placeholder="What would you understand?"
            className="mt-7 w-full resize-none border border-gold/25 bg-transparent px-4 py-3 font-body text-lg italic text-parchment placeholder:text-vellum/45 focus:border-gold/60 focus:outline-none"
          />
          <button
            onClick={ask}
            disabled={state === "asking"}
            className="mt-4 w-full border border-gold py-3 font-label text-xs tracking-rite text-gold transition-colors hover:bg-gold hover:text-void disabled:opacity-40"
          >
            {state === "asking" ? "THE LIGHT GATHERS…" : "ASK"}
          </button>
        </>
      )}

      {state === "unlit" && (
        <div className="mt-10 border border-gold/25 px-6 py-8 text-center">
          <p className="font-label text-[11px] tracking-rite text-gold">
            THE LAMP IS NOT YET LIT
          </p>
          <p className="mt-3 font-body text-base italic leading-relaxed text-vellum">
            Echo awaits the key. The vault and the search still serve;
            understanding will be sought here soon.
          </p>
        </div>
      )}

      {note && <p className="mt-5 font-body text-sm italic text-vellum">{note}</p>}

      {answer && (
        <div className="mt-8">
          <div className="whitespace-pre-wrap font-body text-[1.08rem] leading-[1.8] text-parchment">
            {answer}
          </div>
          {sources.length > 0 && (
            <div className="mt-7 border-t border-gold/20 pt-4">
              <p className="font-label text-[10px] tracking-rite text-gold/85">
                THE SCROLLS THAT ANSWERED
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.map((s) => (
                  <Link
                    key={s.scrollId + (s.key || "")}
                    to={`/read/${encodeURIComponent(s.scrollId)}`}
                    className="border border-gold/40 px-3 py-1.5 font-label text-[10px] tracking-seal text-gold hover:bg-gold hover:text-void"
                  >
                    SCROLL {s.scrollId}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {state === "done" && (
        <button
          onClick={() => {
            setState("idle");
            setQuestion("");
            setAnswer("");
          }}
          className="mt-8 w-full border border-gold/40 py-2.5 font-label text-[11px] tracking-rite text-gold/85 hover:border-gold hover:text-gold"
        >
          ASK AGAIN
        </button>
      )}
      <div className="h-10" />
    </div>
  );
}
