// FightAutopsy — domain types (spec §4.3)
//
// These types ARE the contract. The zod schemas in schemas.ts mirror them for
// runtime validation; the two must stay in lockstep.

export type Person = "A" | "B";

export type Mode = "solo" | "couple";

export const LAYERS = [
  "FACT",
  "CAUSALITY",
  "VALUE",
  "DEFINITION",
  "INTERPRETATION",
  "REQUEST",
] as const;
export type Layer = (typeof LAYERS)[number];

export const ALIGNMENT_TYPES = ["AGREE", "CONTRADICT", "DISCONNECT"] as const;
export type AlignmentType = (typeof ALIGNMENT_TYPES)[number];

export interface Absolute {
  word: string; // the absolute term used, e.g. "never", "always"
  rewrite: string; // a specific, non-absolute rewrite
}

export interface Claim {
  id: string;
  person: Person;
  layer: Layer;
  quote: string; // MUST be a verbatim substring of that person's intake text
  absolutes?: Absolute[];
}

export interface Alignment {
  type: AlignmentType;
  claims: [string, string]; // [claimId, claimId]
  note: string; // neutral, never adjudicating
}

export interface Proxy {
  surface: string;
  root: { person: Person; layer: Layer; text: string };
  evidence: string[]; // claimIds
}

export interface Handback {
  opening: string; // reflective-listening style, references an actual quote
  order: string[]; // claimIds, facts-first / values-last
  reframe: string; // shared-problem reframe
}

export interface Analysis {
  claims: Claim[];
  alignments: Alignment[];
  proxies: Proxy[];
  handback: Handback;
}

export const PLAIN_ENGLISH_LAYERS: Record<Layer, string> = {
  FACT: "What happened",
  CAUSALITY: "Why it happened",
  VALUE: "What matters to you",
  DEFINITION: "What that word means to you",
  INTERPRETATION: "What it meant to you",
  REQUEST: "What you're asking for",
};

export function getPersonName(person: Person, names?: { A?: string; B?: string }): string {
  if (person === "A") return names?.A?.trim() || "Partner A";
  return names?.B?.trim() || "Partner B";
}

export interface IntakeAnswers {
  name?: string;
  whatHappened: string;
  whatIFelt: string;
  whatIMadeItMean: string;
  whatIWant: string;
}

export interface IntakeSide {
  done: boolean;
  name?: string;
  answers: IntakeAnswers | null;
}

export interface RoomDoc {
  code: string; // 6-char room code
  mode: Mode;
  createdAt: number; // epoch ms
  intake: {
    A: IntakeSide;
    B: IntakeSide;
  };
  analysis?: Analysis; // absent until pipeline completes
  pipelineFailures?: number; // counts toward fixture fallback (spec §4.8)
  pipelineRunning?: boolean;
  soloConverted?: boolean; // set when a couple room auto-converted to solo
  fixtureUsed?: boolean; // true when analysis came from fixture fallback
}

export type TreeStatus =
  | "waiting" // solo: A not done yet (shouldn't normally happen — pipeline kicks off on A done in solo)
  | "waiting_for_B" // couple: A done, B not done
  | "analyzing" // pipeline running
  | "ready" // analysis present
  | "error"; // fixture fallback engaged after 2 failures (still returns ready + fixture)

export interface TreeResponse {
  status: TreeStatus;
  analysis?: Analysis;
  soloConverted?: boolean;
  fixtureUsed?: boolean; // true when demo fallback engaged
  names?: { A?: string; B?: string };
}
