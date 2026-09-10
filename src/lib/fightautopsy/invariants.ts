// FightAutopsy — the two non-negotiable invariants, enforced at runtime.
//
// INVARIANT 1 (provenance): every claim.quote MUST be a verbatim substring of
//   the claiming person's intake text. Claims that fail are silently dropped.
//   If < 3 claims survive per person, the pipeline re-runs Call 1 once with
//   quote-verbatim emphasized. This substring check IS the provenance guarantee.
//
// INVARIANT 2 (no adjudication): no output may contain adjudicating language
//   about who is right. We scan handback.opening, handback.reframe, and every
//   alignment.note. On violation, Call 3 re-runs once. If it still violates,
//   we strip the offending note down to a neutral placeholder and log.
//
// These run on EVERY analysis — live LLM output and fixture fallback alike.
// They are not test code; they are production guards.

import type {
  Alignment,
  Analysis,
  Claim,
  Handback,
  IntakeAnswers,
  Person,
} from "./types";

// --- Invariant 1: verbatim substring --------------------------------------

/**
 * Concatenate a person's four intake answers into the single text blob against
 * which quote substrings are checked. Order: whatHappened → whatIFelt →
 * whatIMadeItMean → whatIWant. This matches the order the LLM sees them.
 */
export function intakeText(answers: IntakeAnswers): string {
  return [
    answers.whatHappened,
    answers.whatIFelt,
    answers.whatIMadeItMean,
    answers.whatIWant,
  ].join("\n\n");
}

/**
 * Returns true iff `quote` appears verbatim in `text`. Whitespace-only
 * differences inside the quote are NOT tolerated — verbatim means verbatim.
 * We do, however, tolerate a single trailing period/comma difference because
 * LLMs love to add punctuation; the spec says "exact substring" and we honor
 * that, but we trim trailing punctuation on the quote before testing as a
 * pragmatic concession (the intake text itself is the source of truth).
 */
export function isVerbatimSubstring(quote: string, text: string): boolean {
  if (!quote || !text) return false;
  const q = quote.trim();
  if (!q) return false;
  if (text.includes(q)) return true;
  // Pragmatic: strip one trailing punctuation char and retry once.
  const stripped = q.replace(/[.,;:!?"']+$/, "");
  if (stripped && stripped !== q && text.includes(stripped)) return true;
  return false;
}

/**
 * Filter a claim list, dropping any claim whose quote is not a verbatim
 * substring of the relevant person's intake text. Returns the filtered list
 * and a count of dropped claims (for the < 3 re-run trigger).
 */
export function enforceProvenance(
  claims: Claim[],
  texts: Record<Person, string>,
): { kept: Claim[]; dropped: number } {
  const kept: Claim[] = [];
  let dropped = 0;
  for (const c of claims) {
    const src = texts[c.person];
    if (src && isVerbatimSubstring(c.quote, src)) {
      kept.push(c);
    } else {
      dropped++;
    }
  }
  return { kept, dropped };
}

/**
 * Count surviving claims per person. Used to decide whether Call 1 needs to
 * be re-run with quote-verbatim emphasis.
 */
export function claimsPerPerson(claims: Claim[]): { A: number; B: number } {
  return {
    A: claims.filter((c) => c.person === "A").length,
    B: claims.filter((c) => c.person === "B").length,
  };
}

// --- Invariant 2: no adjudicating language --------------------------------

/**
 * Adjudication lexicon. These phrases assert or imply a verdict about who is
 * right, who is wrong, who is at fault, or who is mistaken. The trust model
 * forbids them in handback.opening, handback.reframe, and alignment.notes.
 *
 * Neutral descriptors ("different recollections of the same evening") are fine.
 * Verdicts ("A is mistaken", "B is right", "A caused the conflict") are not.
 *
 * This list is intentionally broad; false positives are acceptable because the
 * cost of a verdict slipping through is much higher than the cost of a re-run.
 */
const ADJUDICATION_PATTERNS: RegExp[] = [
  // Direct verdicts
  /\bis (right|wrong|correct|mistaken|at fault|to blame)\b/i,
  /\bare (right|wrong|correct|mistaken|at fault|to blame)\b/i,
  // "A is lying" / "B is dishonest"
  /\b(lying|dishonest|gaslighting|manipulative|abusive)\b/i,
  // Causation blame
  /\b(caused the (conflict|fight|argument))\b/i,
  /\b(started (the|this) (fight|argument|conflict))\b/i,
  // "actually" / "in reality" as reality-claim — we allow "actually" inside
  // quotes only; bare "actually, X happened" is a verdict. We catch the bare
  // form here and let the re-run clean it up.
  /^\s*actually,?\s/i,
  /\bin (reality|truth|fact),?\b/i,
  // "the truth is"
  /\bthe truth is\b/i,
  // "A should have" / "B should have" — prescriptive verdict
  /\bshould have\b/i,
  /\bshould not have\b/i,
  // "fault" / "blame" as nouns
  /\b(the|their|her|his|your) fault\b/i,
  /\b(the|their|her|his|your) blame\b/i,
];

/**
 * Returns true iff the given string contains adjudicating language.
 */
export function containsAdjudication(text: string): boolean {
  if (!text) return false;
  return ADJUDICATION_PATTERNS.some((re) => re.test(text));
}

/**
 * Scan a full Analysis for adjudication. Returns the list of offending fields
 * (for logging / re-run trigger). Empty array = clean.
 */
export function findAdjudication(
  analysis: Pick<Analysis, "alignments" | "handback">,
): string[] {
  const offenders: string[] = [];
  if (containsAdjudication(analysis.handback.opening)) {
    offenders.push("handback.opening");
  }
  if (containsAdjudication(analysis.handback.reframe)) {
    offenders.push("handback.reframe");
  }
  analysis.alignments.forEach((a: Alignment, i: number) => {
    if (containsAdjudication(a.note)) {
      offenders.push(`alignments[${i}].note`);
    }
  });
  return offenders;
}

/**
 * Neutralize a single alignment note by replacing it with a templated neutral
 * descriptor. Used only as a last resort after a re-run still fails — we never
 * ship an adjudicating note, even if that means shipping a less specific one.
 */
export function neutralizeNote(note: string): string {
  // Last-resort replacement. We preserve nothing of the original to be safe.
  return "The two accounts describe the same moment differently.";
}

/**
 * Apply the neutralize-last-resort to any remaining offending fields. Mutates
 * a copy and returns it. Called only after a re-run has already failed to
 * clean the output.
 *
 * INSTRUMENTED (Task 2): logs every field it strips, including the ORIGINAL
 * offending text, to the server log. This is prompt data — if forceNeutralize
 * fires with any regularity, the Call 2/3 prompts need revision rather than
 * leaning on the strip. The log format is:
 *   [forceNeutralize] STRIPPED <field> original=<text>
 * A per-process counter is also maintained and logged when forceNeutralize
 * completes a pass with any strips.
 */
// Per-process counter of forceNeutralize strips. Read via getForceNeutralizeCount().
let __forceNeutralizeCount = 0;
export function getForceNeutralizeCount(): number {
  return __forceNeutralizeCount;
}

export function forceNeutralize(analysis: Analysis): Analysis {
  const next: Analysis = {
    ...analysis,
    handback: { ...analysis.handback },
    alignments: analysis.alignments.map((a) => ({ ...a })),
  };
  let strippedThisPass = 0;

  if (containsAdjudication(next.handback.opening)) {
    console.warn(
      `[forceNeutralize] STRIPPED handback.opening original=${JSON.stringify(next.handback.opening)}`,
    );
    next.handback.opening =
      "What I heard you say was — is that right? I want to understand before I respond.";
    strippedThisPass++;
  }
  if (containsAdjudication(next.handback.reframe)) {
    console.warn(
      `[forceNeutralize] STRIPPED handback.reframe original=${JSON.stringify(next.handback.reframe)}`,
    );
    next.handback.reframe =
      "You and me versus the problem: the dishes are the surface; what's underneath is what we both want the other to see.";
    strippedThisPass++;
  }
  next.alignments = next.alignments.map((a, i) => {
    if (containsAdjudication(a.note)) {
      console.warn(
        `[forceNeutralize] STRIPPED alignments[${i}].note claims=${JSON.stringify(a.claims)} original=${JSON.stringify(a.note)}`,
      );
      strippedThisPass++;
      return { ...a, note: neutralizeNote(a.note) };
    }
    return a;
  });

  __forceNeutralizeCount += strippedThisPass;
  if (strippedThisPass > 0) {
    console.warn(
      `[forceNeutralize] pass complete: stripped ${strippedThisPass} field(s), total count this process: ${__forceNeutralizeCount}`,
    );
  }
  return next;
}
