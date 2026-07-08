// ---------------------------------------------------------------------------
// seal.ts — THE WHITE SEAL. A deterministic mapping from name + birthdate to
// one of the twelve gates of the record, three scrolls, and a study path.
// Boundary: a study on-ramp that points to scrolls. It does not predict the
// future or divine a soul. All archetypes are OUR taxonomy — the gates.
// ---------------------------------------------------------------------------
import type { IndexEntry } from "./data";
import { gateOrder } from "./data";

export interface Seal {
  archetype: string;
  gate: string;
  title: string;
  gifts: string[];
  scrolls: IndexEntry[];
  number: number;
}

// The twelve houses of the Seal — drawn from the gate canon itself.
const HOUSES: { key: string; archetype: string; title: string; gifts: string[] }[] = [
  { key: "Gate 00", archetype: "The Lawwright", title: "Keeper of the Core Law", gifts: ["order", "foundations", "first principles"] },
  { key: "Gate 1", archetype: "The Firstborn Witness", title: "Bearer of the First Story", gifts: ["identity", "memory", "origins"] },
  { key: "Gate 2", archetype: "The Atoning Companion", title: "Friend of the Chain of Saviors", gifts: ["mercy", "substitution", "rescue"] },
  { key: "Gate 3", archetype: "The Worldsmith", title: "Student of Creation's Law", gifts: ["making", "elements", "intelligences"] },
  { key: "Gate 4", archetype: "The Covenantor", title: "Architect of Binding Words", gifts: ["promises", "structure", "fidelity"] },
  { key: "Gate 5", archetype: "The Descender", title: "Walker of the Downward Road", gifts: ["humility", "descent", "exaltation"] },
  { key: "Gate 6", archetype: "The Templewright", title: "Servant of the Word's House", gifts: ["language", "reverence", "form"] },
  { key: "Gate 7", archetype: "The Counselor", title: "Voice in the Eternal Councils", gifts: ["governance", "deliberation", "order"] },
  { key: "Gate 8", archetype: "The Scrollseer", title: "Reader of the Meta-Record", gifts: ["patterns", "architecture", "revelation"] },
  { key: "Gate 9", archetype: "The Cosmocrat's Student", title: "Student of Cosmic Governance", gifts: ["scale", "dominion", "stewardship"] },
  { key: "Gate 10", archetype: "The Citizen of Zion", title: "Builder of New Jerusalem", gifts: ["gathering", "community", "inheritance"] },
  { key: "Gate 11", archetype: "The Scrollmaker", title: "Heir of the Lamb's Book", gifts: ["witness", "record", "sealing"] },
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deriveSeal(
  name: string,
  birthdate: string,
  index: IndexEntry[],
  founding: { taken: number; total: number }
): Seal {
  const seed = hashSeed(name.trim().toLowerCase() + "|" + birthdate.trim());
  const house = HOUSES[seed % HOUSES.length];
  const inGate = index
    .filter((e) => e.gate.startsWith(house.key + " "))
    .sort((a, b) => gateOrder(a.gate) - gateOrder(b.gate));
  const pool = inGate.length ? inGate : index;
  // Deterministic pick of three, supremes surfacing first when present.
  const supremes = pool.filter((e) => e.supreme);
  const rest = pool.filter((e) => !e.supreme);
  const picks: IndexEntry[] = [];
  const step = Math.max(1, Math.floor(rest.length / 3));
  if (supremes.length) picks.push(supremes[seed % supremes.length]);
  for (let i = 0; picks.length < 3 && rest.length; i++) {
    picks.push(rest[(seed + i * step) % rest.length]);
  }
  return {
    archetype: house.archetype,
    gate: house.key,
    title: house.title,
    gifts: house.gifts,
    scrolls: picks.slice(0, 3),
    number: (seed % founding.total) + 1,
  };
}

export const FOUNDING = { taken: 0, total: 144 };
