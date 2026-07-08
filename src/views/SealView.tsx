import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { loadIndex, type IndexEntry } from "../lib/data";
import { deriveSeal, FOUNDING, type Seal } from "../lib/seal";

export default function SealView() {
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [seal, setSeal] = useState<Seal | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadIndex().then(setIndex);
    try {
      const saved = localStorage.getItem("zionos-seal");
      if (saved) setSeal(JSON.parse(saved));
    } catch { /* fresh seeker */ }
  }, []);

  function receive() {
    if (!name.trim() || !birthdate) return;
    const s = deriveSeal(name, birthdate, index, FOUNDING);
    setSeal(s);
    localStorage.setItem("zionos-seal", JSON.stringify(s));
  }

  async function share() {
    if (!seal) return;
    const text = `THE WHITE SEAL — ${seal.archetype}\n${seal.title}\nGifts: ${seal.gifts.join(" · ")}\nBegin: ${seal.scrolls.map((s) => "Scroll " + s.id).join(", ")}\n© AMULEK ONE — The Sphere of Light`;
    try {
      if (navigator.share) await navigator.share({ title: "The White Seal", text });
      else {
        await navigator.clipboard.writeText(text);
        alert("Your seal is copied, watermark and all.");
      }
    } catch { /* seeker closed the sheet */ }
  }

  return (
    <div className="mx-auto max-w-xl px-6 pt-12">
      <p className="font-label text-[11px] tracking-rite text-gold">THE WHITE SEAL</p>
      <h1 className="mt-2 font-heading text-4xl text-parchment">
        Where should you begin?
      </h1>
      <p className="mt-3 max-w-md font-body text-base italic leading-relaxed text-vellum">
        A name and a date are mapped to one of the twelve gates, and the gate
        gives you your first scrolls. The Seal points to scrolls; it does not
        read souls, and it does not tell futures.
      </p>

      {!seal && (
        <div className="mt-8 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full border-b border-gold/40 bg-transparent py-3 font-body text-xl italic text-parchment placeholder:text-vellum/50 focus:border-gold focus:outline-none"
          />
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="h-[52px] w-full border-b border-gold/40 bg-transparent py-3 font-body text-xl italic text-parchment focus:border-gold focus:outline-none [color-scheme:dark]"
          />
          <button
            onClick={receive}
            disabled={!name.trim() || !birthdate}
            className="w-full border border-gold py-3.5 font-label text-xs tracking-rite text-gold transition-colors hover:bg-gold hover:text-void disabled:opacity-40"
          >
            RECEIVE THE SEAL
          </button>
        </div>
      )}

      {seal && (
        <>
          <div
            ref={cardRef}
            className="relative mt-9 overflow-hidden border border-gold/50 bg-raise px-7 py-10 text-center"
          >
            <div className="void-light absolute inset-0 opacity-60" aria-hidden />
            <div className="relative">
              <p className="font-label text-[10px] tracking-rite text-gold">
                FOUNDING SEAL № {seal.number} / {FOUNDING.total}
              </p>
              <div className="mx-auto my-5 h-14 w-14 rounded-full border border-gold/70">
                <div className="mx-auto mt-[13px] h-7 w-7 rounded-full border border-gold/50">
                  <div className="mx-auto mt-[9px] h-2 w-2 rounded-full bg-gold" />
                </div>
              </div>
              <h2 className="font-heading text-3xl text-parchment">{seal.archetype}</h2>
              <p className="mt-2 font-body italic text-vellum">{seal.title}</p>
              <p className="mt-4 font-label text-[9px] tracking-seal text-gold/85">
                {seal.gifts.join(" · ").toUpperCase()}
              </p>
              <div className="mx-auto my-6 h-px w-32 bg-gold/40" />
              <p className="font-label text-[10px] tracking-seal text-vellum">
                YOUR FIRST SCROLLS
              </p>
              <div className="mt-3 space-y-2">
                {seal.scrolls.map((s) => (
                  <Link
                    key={s.id}
                    to={`/read/${encodeURIComponent(s.id)}`}
                    className="block font-body text-lg italic text-parchment underline decoration-gold/40 underline-offset-4 hover:decoration-gold"
                  >
                    Scroll {s.id} — {s.title.slice(0, 44)}
                  </Link>
                ))}
              </div>
              <p className="mt-8 font-body text-[10px] italic text-vellum/60">
                © AMULEK ONE — The Sphere of Light
              </p>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={share}
              className="flex-1 border border-gold py-3 font-label text-[11px] tracking-rite text-gold hover:bg-gold hover:text-void"
            >
              SHARE THE SEAL
            </button>
            <button
              onClick={() => {
                setSeal(null);
                localStorage.removeItem("zionos-seal");
              }}
              className="px-6 font-label text-[10px] tracking-seal text-vellum hover:text-parchment"
            >
              BEGIN AGAIN
            </button>
          </div>
        </>
      )}
      <div className="h-12" />
    </div>
  );
}
