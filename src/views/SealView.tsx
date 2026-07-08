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
    // THE WATERMARK (SEAL B) — the card leaves as pixels, the line baked in.
    const W = 1080, H = 1350;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#06060A"; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W/2, H*0.42, 40, W/2, H*0.42, 520);
    glow.addColorStop(0, "rgba(197,165,90,.30)");
    glow.addColorStop(0.5, "rgba(197,165,90,.10)");
    glow.addColorStop(1, "rgba(197,165,90,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#C5A55A"; g.lineWidth = 2;
    g.strokeRect(36, 36, W-72, H-72);
    const cx = W/2;
    g.textAlign = "center";
    g.fillStyle = "#C5A55A";
    g.font = "500 30px Cinzel, serif";
    g.fillText(`F O U N D I N G   S E A L   №  ${seal.number} / ${FOUNDING.total}`, cx, 150);
    // the concentric mark
    g.lineWidth = 3.5; g.beginPath(); g.arc(cx, 320, 92, 0, Math.PI*2); g.stroke();
    g.lineWidth = 1.8; g.globalAlpha = .55; g.beginPath(); g.arc(cx, 320, 52, 0, Math.PI*2); g.stroke();
    g.globalAlpha = .13; g.fillStyle = "#C5A55A"; g.beginPath(); g.arc(cx, 320, 38, 0, Math.PI*2); g.fill();
    g.globalAlpha = 1; g.beginPath(); g.arc(cx, 320, 15, 0, Math.PI*2); g.fill();
    g.fillStyle = "#F3EAD3";
    g.font = "600 76px 'Cormorant Garamond', serif";
    g.fillText(seal.archetype, cx, 540);
    g.fillStyle = "#A69274";
    g.font = "italic 38px 'EB Garamond', serif";
    g.fillText(seal.title, cx, 600);
    g.fillStyle = "#C5A55A";
    g.font = "500 26px Cinzel, serif";
    g.fillText(seal.gifts.join("   ·   ").toUpperCase(), cx, 668);
    g.strokeStyle = "rgba(197,165,90,.5)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx-140, 720); g.lineTo(cx+140, 720); g.stroke();
    g.fillStyle = "#A69274"; g.font = "500 24px Cinzel, serif";
    g.fillText("Y O U R   F I R S T   S C R O L L S", cx, 780);
    g.fillStyle = "#F3EAD3"; g.font = "italic 34px 'EB Garamond', serif";
    seal.scrolls.forEach((s2, i) => {
      const t = `Scroll ${s2.id} — ${s2.title.slice(0, 40)}`;
      g.fillText(t, cx, 840 + i*54);
    });
    g.fillStyle = "#A69274"; g.font = "italic 26px 'EB Garamond', serif";
    g.fillText("The Seal points to scrolls; it does not read souls.", cx, 1120);
    g.fillStyle = "#C5A55A"; g.font = "italic 28px 'EB Garamond', serif";
    g.fillText("© AMULEK ONE — The Sphere of Light", cx, 1240);
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
    const file = new File([blob], "white-seal.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "The White Seal" });
        return;
      }
    } catch { /* fall through to download */ }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "white-seal.png";
    a.click();
    URL.revokeObjectURL(a.href);
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
