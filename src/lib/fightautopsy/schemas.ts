// FightAutopsy — zod schemas (spec §4.3)
//
// Mirror of types.ts. Used to validate LLM output and to zod-parse fixtures
// on load. Every field that the LLM emits passes through one of these.

import { z } from "zod";

export const PersonSchema = z.enum(["A", "B"]);
export const ModeSchema = z.enum(["solo", "couple"]);

export const LayerSchema = z.enum([
  "FACT",
  "CAUSALITY",
  "VALUE",
  "DEFINITION",
  "INTERPRETATION",
  "REQUEST",
]);

export const AlignmentTypeSchema = z.enum(["AGREE", "CONTRADICT", "DISCONNECT"]);

export const AbsoluteSchema = z.object({
  word: z.string().min(1),
  rewrite: z.string().min(1),
});

export const ClaimSchema = z.object({
  id: z.string().min(1),
  person: PersonSchema,
  layer: LayerSchema,
  quote: z.string().min(1),
  absolutes: z.array(AbsoluteSchema).optional(),
});

export const AlignmentSchema = z.object({
  type: AlignmentTypeSchema,
  claims: z.tuple([z.string().min(1), z.string().min(1)]),
  note: z.string().min(1),
});

export const ProxySchema = z.object({
  surface: z.string().min(1),
  root: z.object({
    person: PersonSchema,
    layer: LayerSchema,
    text: z.string().min(1),
  }),
  evidence: z.array(z.string().min(1)),
});

export const HandbackSchema = z.object({
  opening: z.string().min(1),
  order: z.array(z.string().min(1)),
  reframe: z.string().min(1),
});

export const AnalysisSchema = z.object({
  claims: z.array(ClaimSchema),
  alignments: z.array(AlignmentSchema),
  proxies: z.array(ProxySchema),
  handback: HandbackSchema,
});

// Extract-call output is per-person: just the claims for that person.
export const ExtractOutputSchema = z.object({
  claims: z.array(ClaimSchema),
});

// Align-call output covers both persons.
export const AlignOutputSchema = z.object({
  alignments: z.array(AlignmentSchema),
  proxies: z.array(ProxySchema),
});

export const IntakeAnswersSchema = z.object({
  whatHappened: z.string().min(20).max(1500),
  whatIFelt: z.string().min(20).max(1500),
  whatIMadeItMean: z.string().min(20).max(1500),
  whatIWant: z.string().min(20).max(1500),
});
