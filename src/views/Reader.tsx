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
import {
  hostedVoiceStatus,
  newVoiceSession,
  fetchChunkAudio,
} from "../lib/hosted-voice";

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

  // ---- THE VOICE — two engines, one interface (GOAL 2) ----
  // DEVICE (LAMP A) = Web Speech, the forever-fallback: 3-sentence chunks
  // chained on `onend`, with a resume watchdog for Chrome's pause-freeze.
  // HOSTED = the gate's ElevenLabs stream, one chunk of sentences per
  // request, chain-played with the same sentence highlight. Device is the
  // default; hosted is opt-in until the Seer has sealed its price.
  type Engine = "device" | "hosted";
  const [engine, setEngine] = useState<Engine>("device");
  const [hostedLit, setHostedLit] = useState<boolean | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [spokenIdx, setSpokenIdx] = useState(-1);
  const [rate, setRate] = useState(1);
  const rateRef = useRef(1); // the live rate — hosted chunks + device fallback read this, never a stale closure
  const [voiceName, setVoiceName] = useState<string>("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesSettled, setVoicesSettled] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string>("");
  const chunkAt = useRef(0);        // live index: sentence (device) / chunk (hosted)
  const wantSpeak = useRef(false);  // survives async chunk chaining
  const watchdog = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const CHUNK = 3;
  // hosted engine
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string>("");
  const sessionRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const hostedChunksRef = useRef<{ from: number; to: number; text: string }[]>([]);
  const prefetchRef = useRef<{ ci: number; p: Promise<Blob> } | null>(null);

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

  // Ask the gate whether the hosted voice is lit — offered only if so.
  useEffect(() => {
    hostedVoiceStatus().then((s) => setHostedLit(Boolean(s?.lit)));
  }, []);

  function finishVoice() {
    wantSpeak.current = false;
    setSpeaking(false);
    setSpokenIdx(-1);
  }

  // ---- DEVICE (Web Speech) ----
  function speakChunk(from: number, sentsArr: string[], theRate: number, theVoice: string) {
    if (!wantSpeak.current || from >= sentsArr.length) {
      finishVoice();
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
  function speakDevice(from = 0) {
    if (!doc || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    wantSpeak.current = true;
    setSpeaking(true);
    clearInterval(watchdog.current);
    watchdog.current = setInterval(() => {
      // Chrome freezes long sessions in a paused state; nudge it awake.
      if (wantSpeak.current && speechSynthesis.paused) speechSynthesis.resume();
    }, 8000);
    speakChunk(from, sents, rateRef.current, voiceName);
  }
  function stopDevice() {
    clearInterval(watchdog.current);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  // ---- HOSTED (the gate's stream) ----
  // Group sentences into ~600-char chunks (well under the gate's 1,800 cap)
  // so short sentences don't each cost a request, while the highlight still
  // moves sentence by sentence.
  function buildHostedChunks(sentsArr: string[]) {
    const out: { from: number; to: number; text: string }[] = [];
    const BUDGET = 600, HARD = 1700;
    let i = 0;
    while (i < sentsArr.length) {
      let j = i, len = 0;
      do { len += sentsArr[j].length + 1; j++; }
      while (j < sentsArr.length && len + sentsArr[j].length <= BUDGET && len < HARD);
      out.push({ from: i, to: j, text: sentsArr.slice(i, j).join(" ") });
      i = j;
    }
    return out;
  }
  function getChunkBlob(ci: number): Promise<Blob> {
    if (prefetchRef.current && prefetchRef.current.ci === ci) return prefetchRef.current.p;
    return fetchChunkAudio(hostedChunksRef.current[ci].text, sessionRef.current, abortRef.current?.signal);
  }
  function prefetch(ci: number) {
    if (ci >= hostedChunksRef.current.length) { prefetchRef.current = null; return; }
    const p = getChunkBlob(ci);
    p.catch(() => {}); // an aborted/failed prefetch must not surface as an unhandled rejection
    prefetchRef.current = { ci, p };
  }
  async function playHostedFrom(ci: number) {
    const chunks = hostedChunksRef.current;
    if (!wantSpeak.current) return;
    if (ci >= chunks.length) { finishVoice(); return; }
    const chunk = chunks[ci];
    chunkAt.current = ci;
    setSpokenIdx(chunk.from);
    document.getElementById(`sent-${chunk.from}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    let blob: Blob;
    try {
      blob = await getChunkBlob(ci);
    } catch (e) {
      if (!wantSpeak.current) return; // a deliberate stop, not a fault
      setVoiceNote((e as Error).message || "The hosted voice faltered; the device voice takes over.");
      setEngine("device");           // never leave the scroll unspoken
      speakDevice(chunk.from);
      return;
    }
    if (!wantSpeak.current) return;
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audio.playbackRate = rateRef.current;
    audioRef.current = audio;
    // Highlight sync: the stream gives only duration, so apportion play time
    // across the chunk's sentences by character length.
    const slice = sents.slice(chunk.from, chunk.to);
    const total = slice.reduce((a, s) => a + s.length, 0) || 1;
    const cum: number[] = [];
    let acc = 0;
    for (const s of slice) { acc += s.length; cum.push(acc / total); }
    let localIdx = 0;
    audio.ontimeupdate = () => {
      if (!audio.duration || !isFinite(audio.duration)) return;
      const p = audio.currentTime / audio.duration;
      let k = localIdx;
      while (k < cum.length - 1 && p > cum[k]) k++;
      if (k !== localIdx) {
        localIdx = k;
        setSpokenIdx(chunk.from + k);
        document.getElementById(`sent-${chunk.from + k}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    audio.onplay = () => prefetch(ci + 1);
    audio.onended = () => { URL.revokeObjectURL(url); audioUrlRef.current = ""; playHostedFrom(ci + 1); };
    audio.onerror = () => { URL.revokeObjectURL(url); audioUrlRef.current = ""; playHostedFrom(ci + 1); };
    audio.play().catch(() => { /* LISTEN was the user gesture; autoplay is allowed */ });
  }
  function speakHosted(from = 0) {
    if (!doc) return;
    wantSpeak.current = true;
    setSpeaking(true);
    setVoiceNote("");
    sessionRef.current = newVoiceSession();
    abortRef.current = new AbortController();
    hostedChunksRef.current = buildHostedChunks(sents);
    prefetchRef.current = null;
    let ci = hostedChunksRef.current.findIndex((c) => from >= c.from && from < c.to);
    if (ci < 0) ci = 0;
    playHostedFrom(ci);
  }
  function stopHosted() {
    abortRef.current?.abort();
    prefetchRef.current = null;
    const a = audioRef.current;
    if (a) { a.onended = null; a.onerror = null; a.ontimeupdate = null; a.pause(); }
    audioRef.current = null;
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = ""; }
  }

  // ---- ONE INTERFACE ----
  function speak(from = 0) {
    if (engine === "hosted" && hostedLit) speakHosted(from);
    else speakDevice(from);
  }
  function stopSpeak() {
    wantSpeak.current = false;
    stopDevice();
    stopHosted();
    setSpeaking(false);
    setSpokenIdx(-1);
  }
  function changeRate(r: number) {
    setRate(r);
    rateRef.current = r; // every future chunk (hosted or device) reads this
    if (!wantSpeak.current) return;
    if (engine === "hosted") {
      // Patch the live chunk if one exists; chunks still fetching pick up
      // rateRef.current when their Audio is created. Never fall through to the
      // device engine — that would play Web Speech over the hosted stream.
      if (audioRef.current) audioRef.current.playbackRate = r;
      return;
    }
    // device: restart the live chunk at the new pace
    const at = chunkAt.current;
    wantSpeak.current = false;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    setTimeout(() => {
      wantSpeak.current = true;
      speakChunk(at, sents, r, voiceName);
    }, 60);
  }
  function selectEngine(e: Engine) {
    if (e === engine) return;
    if (e === "hosted" && !hostedLit) return;
    if (wantSpeak.current) stopSpeak();
    setVoiceNote("");
    setEngine(e);
  }

  useEffect(() => {
    setDoc(null);
    setErr(null);
    wantSpeak.current = false;
    clearInterval(watchdog.current);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    stopHosted();
    setSpeaking(false);
    setSpokenIdx(-1);
    setVoiceNote("");
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
      stopHosted();
    };
  }, [scrollId]);

  const sents = useMemo(() => (doc ? sentences(doc.body) : []), [doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "ArrowLeft" && neighbors.prev) nav(`/read/${encodeURIComponent(neighbors.prev.id)}`);
      if (e.key === "ArrowRight" && neighbors.next) nav(`/read/${encodeURIComponent(neighbors.next.id)}`);
      if (e.key === "Home") window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [neighbors, nav]);


  return (
    <div className={candle ? "candle min-h-dvh" : "min-h-dvh"}>
      <div className="mx-auto max-w-[42rem] px-6 pb-24 pt-8">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => nav(-1)}
            className={`py-3 pr-3 font-label text-[10px] tracking-seal ${candle ? "text-leather/70 hover:text-leather" : "text-vellum hover:text-gold"}`}
          >
            ← RETURN
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCandle((c) => !c)}
              aria-pressed={candle}
              className={`py-3 px-1 font-label text-[10px] tracking-seal ${candle ? "text-leather/70 hover:text-leather" : "text-vellum hover:text-gold"}`}
            >
              {candle ? "VOID" : "CANDLE"}
            </button>
            {doc && (
              <button
                onClick={() => setMarked(toggleBookmark(doc))}
                aria-pressed={marked}
                className={`py-3 pl-1 font-label text-[10px] tracking-seal ${marked ? "text-gold" : candle ? "text-leather/70 hover:text-leather" : "text-vellum hover:text-gold"}`}
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
            <div className={`mt-7 flex flex-col items-center gap-3 border-y py-3 ${candle ? "border-leather/20" : "border-gold/15"}`}>
              <div className="flex flex-wrap items-center justify-center gap-3">
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
                {engine === "device" && voices.length > 0 && (
                  <label className={`font-label text-[9px] tracking-seal ${candle ? "text-leather/70" : "text-vellum"}`}>
                    TIMBRE
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

              {/* VOICE — Device / Hosted. Hosted appears only when the gate's lamp is lit. */}
              <div className="flex items-center gap-2 font-label text-[9px] tracking-seal">
                <span className={candle ? "text-leather/60" : "text-vellum/80"}>VOICE</span>
                <button
                  onClick={() => selectEngine("device")}
                  aria-pressed={engine === "device"}
                  className={`border px-3 py-1 transition-colors ${
                    engine === "device"
                      ? candle ? "border-leather bg-leather text-parchment" : "border-gold bg-gold text-void"
                      : candle ? "border-leather/40 text-leather/70 hover:text-leather" : "border-gold/40 text-vellum hover:text-gold"
                  }`}
                >
                  DEVICE
                </button>
                <button
                  onClick={() => selectEngine("hosted")}
                  disabled={!hostedLit}
                  aria-pressed={engine === "hosted"}
                  className={`border px-3 py-1 transition-colors ${
                    engine === "hosted"
                      ? candle ? "border-leather bg-leather text-parchment" : "border-gold bg-gold text-void"
                      : hostedLit
                        ? candle ? "border-leather/40 text-leather/70 hover:text-leather" : "border-gold/40 text-vellum hover:text-gold"
                        : candle ? "border-leather/20 text-leather/40 cursor-not-allowed" : "border-gold/20 text-vellum/40 cursor-not-allowed"
                  }`}
                >
                  {hostedLit ? "HOSTED" : "HOSTED · SOON"}
                </button>
              </div>

              {voiceNote && (
                <span className={`text-center font-body text-xs italic ${candle ? "text-leather/70" : "text-vellum"}`}>
                  {voiceNote}
                </span>
              )}
              {!voiceNote && engine === "device" && voicesSettled && voices.length === 0 && (
                <span className={`text-center font-body text-xs italic ${candle ? "text-leather/70" : "text-vellum"}`}>
                  {hostedLit
                    ? "This device offers no voices — choose HOSTED for the gate's voice."
                    : "This device offers no voices; the hosted voice is coming."}
                </span>
              )}
              {!voiceNote && engine === "hosted" && (
                <span className={`text-center font-body text-xs italic ${candle ? "text-leather/70" : "text-vellum"}`}>
                  The gate gives the scroll its voice.
                </span>
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

            {/* THE SCROLL'S END (LAMP B) — act without scrolling back */}
            <div className={`mt-8 grid grid-cols-3 gap-2 border-y py-3 ${candle ? "border-leather/20" : "border-gold/15"}`}>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={`py-3.5 font-label text-[10px] tracking-seal ${candle ? "text-leather hover:bg-leather/10" : "text-gold hover:bg-gold/10"}`}
              >
                ASCEND ↑
              </button>
              <button
                onClick={() => nav(doc ? `/vault/${encodeURIComponent((doc.gate.match(/^Gate (\S+)/) || [])[1] || "")}` : "/vault")}
                className={`py-3.5 font-label text-[10px] tracking-seal ${candle ? "text-leather hover:bg-leather/10" : "text-gold hover:bg-gold/10"}`}
              >
                SEAL THE SCROLL
              </button>
              {neighbors.next ? (
                <button
                  onClick={() => nav(`/read/${encodeURIComponent(neighbors.next!.id)}`)}
                  className={`py-3.5 font-label text-[10px] tracking-seal ${candle ? "text-leather hover:bg-leather/10" : "text-gold hover:bg-gold/10"}`}
                >
                  NEXT SCROLL →
                </button>
              ) : <span />}
            </div>

            <div className="mt-6 flex justify-between gap-4">
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
