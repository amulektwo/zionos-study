import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchScroll,
  loadIndex,
  toggleBookmark,
  getBookmarks,
  type ScrollDoc,
  type IndexEntry,
} from "../lib/data";

// Sentence-split for Listen: highlight follows the spoken sentence.
function sentences(body: string): string[] {
  return body.split(/(?<=[.!?…])\s+(?=[A-Z"'«(])/g).filter((s) => s.trim());
}

export default function Reader() {
  const { scrollId } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState<ScrollDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [candle, setCandle] = useState(false);
  const [marked, setMarked] = useState(false);
  const [neighbors, setNeighbors] = useState<{ prev?: IndexEntry; next?: IndexEntry }>({});

  // ---- THE VOICE (LAMP A) — chunked utterance chains ----
  // Web Speech loses long utterances (iOS) and kills >~15s speech (Chrome);
  // we speak 3-sentence chunks chained on `onend`, with a resume watchdog
  // for Chrome's pause-freeze. Hosted-voice seam: replace speakChunk() with
  // an ElevenLabs stream player behind the same start/stop interface.
  const [speaking, setSpeaking] = useState(false);
  const [spokenIdx, setSpokenIdx] = useState(-1);
  const [rate, setRate] = useState(1);
  const [voiceName, setVoiceName] = useState<string>("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesSettled, setVoicesSettled] = useState(false);
  const chunkAt = useRef(0);        // first sentence index of the live chunk
  const wantSpeak = useRef(false);  // survives async chunk chaining
  const watchdog = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const CHUNK = 3;

  useEffect(() => {
    if (!("speechSynthesis" in window)) { setVoicesSettled(true); return; }
    const pull = () => {
      const v = speechSynthesis.getVoices();
      if (v.length) { setVoices(v); setVoicesSettled(true); }
    };
    pull();
    speechSynthesis.addEventListener("voiceschanged", pull);
    const settle = setTimeout(() => setVoicesSettled(true), 1500);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", pull);
      clearTimeout(settle);
    };
  }, []);

  function speakChunk(from: number, sentsArr: string[], theRate: number, theVoice: string) {
    if (!wantSpeak.current || from >= sentsArr.length) {
      wantSpeak.current = false;
      setSpeaking(false);
      setSpokenIdx(-1);
      return;
    }
    chunkAt.current = from;
    const group = sentsArr.slice(from, from + CHUNK);
    const u = new SpeechSynthesisUtterance(group.join(" "));
    u.rate = theRate;
    const v = speechSynthesis.getVoices().find((x) => x.name === theVoice);
    if (v) u.voice = v;
    let local = 0;
    let consumed = 0;
    setSpokenIdx(from);
    document.getElementById(`sent-${from}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    u.onboundary = (e) => {
      if (e.charIndex === undefined) return;
      while (local < group.length - 1 && e.charIndex >= consumed + group[local].length + 1) {
        consumed += group[local].length + 1;
        local++;
        setSpokenIdx(from + local);
        document.getElementById(`sent-${from + local}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    u.onend = () => speakChunk(from + CHUNK, sentsArr, theRate, theVoice);
    u.onerror = () => speakChunk(from + CHUNK, sentsArr, theRate, theVoice);
    speechSynthesis.speak(u);
  }

  function speak(from = 0) {
    if (!doc || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    wantSpeak.current = true;
    setSpeaking(true);
    clearInterval(watchdog.current);
    watchdog.current = setInterval(() => {
      // Chrome freezes long sessions in a paused state; nudge it awake.
      if (wantSpeak.current && speechSynthesis.paused) speechSynthesis.resume();
    }, 8000);
    speakChunk(from, sents, rate, voiceName);
  }
  function stopSpeak() {
    wantSpeak.current = false;
    clearInterval(watchdog.current);
    speechSynthesis.cancel();
    setSpeaking(false);
    setSpokenIdx(-1);
  }
  function changeRate(r: number) {
    setRate(r);
    if (wantSpeak.current) {
      // restart the live chunk at the new pace, mid-read
      const at = chunkAt.current;
      wantSpeak.current = false;
      speechSynthesis.cancel();
      setTimeout(() => {
        wantSpeak.current = true;
        speakChunk(at, sents, r, voiceName);
      }, 60);
    }
  }

  useEffect(() => {
    setDoc(null);
    setErr(null);
    wantSpeak.current = false;
    clearInterval(watchdog.current);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    setSpeaking(false);
    setSpokenIdx(-1);
    if (!scrollId) return;
    fetchScroll(scrollId)
      .then((d) => {
        setDoc(d);
        setMarked(getBookmarks().some((b) => b.id === d.id));
      })
      .catch((e) => setErr(e.message));
    loadIndex().then((idx) => {
      const at = idx.findIndex((e) => e.id === scrollId);
      if (at === -1) return;
      const gate = idx[at].gate;
      const prev = idx.slice(0, at).reverse().find((e) => e.gate === gate);
      const next = idx.slice(at + 1).find((e) => e.gate === gate);
      setNeighbors({ prev, next });
    });
    return () => {
      wantSpeak.current = false;
      clearInterval(watchdog.current);
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, [scrollId]);

  const sents = useMemo(() => (doc ? sentences(doc.body) : []), [doc]);


  return (
    <div className={candle ? "candle min-h-dvh" : "min-h-dvh"}>
      <div className="mx-auto max-w-[42rem] px-6 pb-24 pt-8">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => nav(-1)}
            className={`font-label text-[10px] tracking-seal ${candle ? "text-leather/70 hover:text-leather" : "text-vellum hover:text-gold"}`}
          >
            ← RETURN
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCandle((c) => !c)}
              aria-pressed={candle}
              className={`font-label text-[10px] tracking-seal ${candle ? "text-leather/70 hover:text-leather" : "text-vellum hover:text-gold"}`}
            >
              {candle ? "VOID" : "CANDLE"}
            </button>
            {doc && (
              <button
                onClick={() => setMarked(toggleBookmark(doc))}
                aria-pressed={marked}
                className={`font-label text-[10px] tracking-seal ${marked ? "text-gold" : candle ? "text-leather/70 hover:text-leather" : "text-vellum hover:text-gold"}`}
              >
                {marked ? "KEPT ✦" : "KEEP"}
              </button>
            )}
          </div>
        </div>

        {err && (
          <p className={`py-24 text-center font-body text-lg italic ${candle ? "text-leather" : "text-vellum"}`}>
            {err}
          </p>
        )}
        {!doc && !err && (
          <div className="py-24 text-center">
            <p className={`font-label text-[11px] tracking-rite ${candle ? "text-leather/70" : "text-gold/80"}`}>
              THE SCROLL UNROLLS
            </p>
          </div>
        )}
        {doc && (
          <>
            <p className={`mt-10 text-center font-label text-xs tracking-rite ${candle ? "text-leather/80" : "text-gold"}`}>
              SCROLL {doc.id}
            </p>
            <h1 className={`mt-3 text-center font-heading text-3xl leading-tight sm:text-4xl ${candle ? "text-leather" : "text-parchment"}`}>
              {doc.title}
            </h1>
            <p className={`mt-3 text-center font-label text-[9px] tracking-seal ${candle ? "text-leather/60" : "text-vellum"}`}>
              {doc.gate.toUpperCase()}
              {doc.sealed ? " · SEALED" : ""}
              {doc.supreme ? " · SUPREME" : ""}
            </p>

            {/* LISTEN */}
            <div className={`mt-7 flex flex-wrap items-center justify-center gap-3 border-y py-3 ${candle ? "border-leather/20" : "border-gold/15"}`}>
              <button
                onClick={() => (speaking ? stopSpeak() : speak(0))}
                className={`border px-5 py-1.5 font-label text-[10px] tracking-rite transition-colors ${candle ? "border-leather text-leather hover:bg-leather hover:text-parchment" : "border-gold text-gold hover:bg-gold hover:text-void"}`}
              >
                {speaking ? "STILL THE VOICE" : "LISTEN"}
              </button>
              <label className={`font-label text-[9px] tracking-seal ${candle ? "text-leather/70" : "text-vellum"}`}>
                PACE
                <select
                  value={rate}
                  onChange={(e) => changeRate(Number(e.target.value))}
                  className="ml-2 bg-transparent font-body italic"
                >
                  {[0.8, 1, 1.2, 1.4].map((r) => (
                    <option key={r} value={r} className="text-leather">
                      {r}×
                    </option>
                  ))}
                </select>
              </label>
              {voicesSettled && voices.length === 0 && (
                <span className={`font-body text-xs italic ${candle ? "text-leather/70" : "text-vellum"}`}>
                  This device offers no voices; the hosted voice is coming.
                </span>
              )}
              {voices.length > 0 && (
                <label className={`font-label text-[9px] tracking-seal ${candle ? "text-leather/70" : "text-vellum"}`}>
                  VOICE
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="ml-2 max-w-[9rem] bg-transparent font-body italic"
                  >
                    <option value="" className="text-leather">Default</option>
                    {voices.slice(0, 12).map((v) => (
                      <option key={v.name} value={v.name} className="text-leather">
                        {v.name.split(" ")[0]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* THE SCRIPTURE — verbatim, sentence-wrapped for Listen only */}
            <article
              className={`mt-9 font-body text-[1.16rem] leading-[1.85] ${candle ? "text-leather" : "text-parchment/95"}`}
            >
              {sents.map((s, i) => (
                <span key={i} id={`sent-${i}`} className={i === spokenIdx ? "speaking" : ""}>
                  {s}{" "}
                </span>
              ))}
            </article>

            <div className={`mx-auto my-10 h-px w-40 ${candle ? "bg-leather/40" : "bg-gold/40"}`} />
            <p className={`text-center font-body text-xs italic ${candle ? "text-leather/60" : "text-vellum/70"}`}>
              © AMULEK ONE — The Sphere of Light · rendered verbatim
            </p>

            <div className="mt-8 flex justify-between gap-4">
              {neighbors.prev ? (
                <Link
                  to={`/read/${encodeURIComponent(neighbors.prev.id)}`}
                  className={`max-w-[45%] font-body text-sm italic ${candle ? "text-leather/80 hover:text-leather" : "text-vellum hover:text-parchment"}`}
                >
                  ← {neighbors.prev.title.slice(0, 40)}
                </Link>
              ) : <span />}
              {neighbors.next && (
                <Link
                  to={`/read/${encodeURIComponent(neighbors.next.id)}`}
                  className={`max-w-[45%] text-right font-body text-sm italic ${candle ? "text-leather/80 hover:text-leather" : "text-vellum hover:text-parchment"}`}
                >
                  {neighbors.next.title.slice(0, 40)} →
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
