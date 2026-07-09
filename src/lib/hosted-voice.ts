// ---------------------------------------------------------------------------
// hosted-voice.ts — the gate's voice (GOAL 2). Fetches TTS audio one chunk
// of sentences at a time from the temple's /api/voice; the device voice
// (Web Speech) remains the fallback forever. Shield law extends to the
// voice: audio lives in memory only, chunk by chunk — no full-scroll audio
// is ever cached, in this repo or the seeker's storage.
// ---------------------------------------------------------------------------

export const TEMPLE_VOICE = "https://zionos-temple.vercel.app/api/voice";

export interface VoiceStatus {
  lit: boolean;
  sessionsPerDay: number;
  sessionCharCap: number;
  chunkCharCap: number;
}

let statusOnce: Promise<VoiceStatus | null> | null = null;
export function hostedVoiceStatus(): Promise<VoiceStatus | null> {
  if (!statusOnce) {
    statusOnce = fetch(TEMPLE_VOICE)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return statusOnce;
}

// One LISTEN press = one session = one of the day's five.
export function newVoiceSession(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export async function fetchChunkAudio(
  text: string,
  session: string,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await fetch(TEMPLE_VOICE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, session }),
    signal,
  });
  if (!res.ok) {
    let msg = "The hosted voice faltered.";
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* the plain message stands */
    }
    throw new Error(msg);
  }
  tallyUsage(text.length);
  return res.blob();
}

// ---- PRICE IT (GOAL 2 Pass 3) — the seeker-side ledger -------------------
// Characters synthesized, tallied per day in localStorage. The gate keeps
// its own ledger (voice_usage); this one lets a session's cost be read on
// the device. Bounded to 60 days.
const USAGE_KEY = "voice-usage-v1";

export interface VoiceUsageDay {
  day: string;
  chars: number;
  chunks: number;
}

export function readUsage(): VoiceUsageDay[] {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function tallyUsage(chars: number) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const all = readUsage();
    const cur = all.find((d) => d.day === day);
    if (cur) {
      cur.chars += chars;
      cur.chunks += 1;
    } else {
      all.push({ day, chars, chunks: 1 });
    }
    localStorage.setItem(USAGE_KEY, JSON.stringify(all.slice(-60)));
  } catch {
    /* a full or absent store never blocks the voice */
  }
}
