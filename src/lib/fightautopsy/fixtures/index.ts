// Fixture loader with on-load zod validation + invariant checks.
//
// Spec §4.8: demo fallback returns fixture via `demo=1` or after 2 pipeline
// failures. Spec §4.9: assert on every fixture that (i) no adjudication
// language appears anywhere in output and (ii) every quote is a verbatim
// substring of intake.
//
// Per the user's locked decision: when a fixture is loaded as demo fallback,
// run it through zod parse on load. This guarantees the fallback path can
// never render a broken tree.
//
// We go one step further and also run the two invariants at load time. If a
// fixture ever violates them, we throw — better to crash the demo fallback
// than to ship a fixture that breaks the trust model. (In practice, this
// means the fixtures themselves are continuously asserted by the runtime.)

import { AnalysisSchema } from "../schemas";
import {
  claimsPerPerson,
  enforceProvenance,
  findAdjudication,
  intakeText,
} from "../invariants";
import type { Analysis, IntakeAnswers } from "../types";
import {
  adversarialAnalysis,
  adversarialIntakeA,
  adversarialIntakeB,
} from "./adversarial";
import { choresAnalysis, choresIntakeA, choresIntakeB } from "./chores";
import { chipsAnalysis, chipsIntakeA, chipsIntakeB } from "./chips";

export type FixtureName = "chips" | "chores" | "adversarial";

export interface Fixture {
  name: FixtureName;
  intake: { A: IntakeAnswers; B: IntakeAnswers };
  analysis: Analysis;
}

const RAW_FIXTURES: Record<FixtureName, Omit<Fixture, "name">> = {
  chips: {
    intake: { A: chipsIntakeA, B: chipsIntakeB },
    analysis: chipsAnalysis,
  },
  chores: {
    intake: { A: choresIntakeA, B: choresIntakeB },
    analysis: choresAnalysis,
  },
  adversarial: {
    intake: { A: adversarialIntakeA, B: adversarialIntakeB },
    analysis: adversarialAnalysis,
  },
};

/**
 * Validate a single fixture: zod parse + both invariants. Throws on any
 * violation. Returns the validated Analysis (which is identical to the input
 * for valid fixtures).
 */
function validateFixture(
  name: FixtureName,
  raw: Omit<Fixture, "name">,
): Analysis {
  // 1. zod parse — schema-level guarantee
  const parsed = AnalysisSchema.safeParse(raw.analysis);
  if (!parsed.success) {
    throw new Error(
      `[fixture:${name}] zod parse failed: ${JSON.stringify(parsed.error.issues, null, 2)}`,
    );
  }

  // 2. Invariant 1: every quote is a verbatim substring of intake
  const texts = {
    A: intakeText(raw.intake.A),
    B: intakeText(raw.intake.B),
  };
  const { kept, dropped } = enforceProvenance(raw.analysis.claims, texts);
  if (dropped > 0) {
    throw new Error(
      `[fixture:${name}] provenance invariant violated: ${dropped} claim(s) have quotes that are not verbatim substrings of intake.`,
    );
  }
  if (kept.length !== raw.analysis.claims.length) {
    throw new Error(
      `[fixture:${name}] provenance invariant: kept count mismatch.`,
    );
  }

  // 3. Invariant 2: no adjudication language anywhere
  const offenders = findAdjudication(raw.analysis);
  if (offenders.length > 0) {
    throw new Error(
      `[fixture:${name}] adjudication invariant violated in: ${offenders.join(", ")}`,
    );
  }

  // 4. Sanity: alignment claim IDs must reference real claims
  const ids = new Set(raw.analysis.claims.map((c) => c.id));
  for (const a of raw.analysis.alignments) {
    for (const cid of a.claims) {
      if (!ids.has(cid)) {
        throw new Error(
          `[fixture:${name}] alignment references unknown claim id: ${cid}`,
        );
      }
    }
  }
  for (const cid of raw.analysis.handback.order) {
    if (!ids.has(cid)) {
      throw new Error(
        `[fixture:${name}] handback.order references unknown claim id: ${cid}`,
      );
    }
  }
  for (const p of raw.analysis.proxies) {
    for (const cid of p.evidence) {
      if (!ids.has(cid)) {
        throw new Error(
          `[fixture:${name}] proxy.evidence references unknown claim id: ${cid}`,
        );
      }
    }
  }

  return parsed.data as Analysis;
}

// Validate eagerly at module load. If any fixture is broken, the server will
// fail to boot — which is the correct behavior: a broken fixture means the
// demo fallback is broken, and we want to know immediately, not at demo time.
const VALIDATED: Record<FixtureName, Fixture> = (() => {
  const out = {} as Record<FixtureName, Fixture>;
  (Object.keys(RAW_FIXTURES) as FixtureName[]).forEach((name) => {
    const raw = RAW_FIXTURES[name];
    const analysis = validateFixture(name, raw);
    out[name] = {
      name,
      intake: raw.intake,
      analysis,
    };
  });
  return out;
})();

export function getFixture(name: FixtureName): Fixture {
  return VALIDATED[name];
}

export function getDefaultFixture(): Fixture {
  // The chips fight is the primary demo (spec §6).
  return VALIDATED.chips;
}

export function listFixtures(): FixtureName[] {
  return Object.keys(VALIDATED) as FixtureName[];
}

// Re-export counts for debugging / demo display
export function fixtureStats(name: FixtureName) {
  const f = getFixture(name);
  return {
    claims: f.analysis.claims.length,
    perPerson: claimsPerPerson(f.analysis.claims),
    alignments: f.analysis.alignments.length,
    proxies: f.analysis.proxies.length,
  };
}
