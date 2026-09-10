// FightAutopsy pipeline — spec §4.2 + §4.3 + §4.5 + §4.8.
//
// Three calls, sequential, temp 0.2 / 0.2 / 0.4:
//   Call 1: Extract (per person, parallelizable) → claims
//   Call 2: Align (both claim sets) → alignments + proxies
//   Call 3: Handback → opening + order + reframe
//
// Invariants enforced in code (spec §4.3):
//   - Any claim whose quote is not a verbatim substring of intake is dropped.
//   - If < 3 claims survive per person, re-run Call 1 once with quote-verbatim
//     emphasis.
//   - Adjudication scan on handback output → one re-run of Call 3.
//   - If still violates, forceNeutralize strips the offending text.
//
// Failure modes (spec §4.8):
//   - 2 pipeline failures → fixture fallback (the chips fixture, zod-parsed
//     on load).

import { z } from "zod";
import {
  enforceProvenance,
  claimsPerPerson,
  findAdjudication,
  forceNeutralize,
  intakeText,
} from "./invariants";
import { llmJSON } from "./llm/llm-json";
import {
  EXTRACT_TEMPERATURE,
  ALIGN_TEMPERATURE,
  HANDBACK_TEMPERATURE,
  extractSystemPrompt,
  extractSystemPromptVerbatimEmphasis,
  extractUserPrompt,
  alignSystemPrompt,
  alignUserPrompt,
  handbackSystemPrompt,
  handbackUserPrompt,
} from "./prompts";
import {
  AlignOutputSchema,
  AnalysisSchema,
  ClaimSchema,
  HandbackSchema,
} from "./schemas";
import { getDefaultFixture } from "./fixtures";
import type {
  Analysis,
  Claim,
  IntakeAnswers,
  Person,
} from "./types";

const MIN_CLAIMS_PER_PERSON = 3;

export interface PipelineInput {
  mode: "solo" | "couple";
  intakeA: IntakeAnswers;
  intakeB?: IntakeAnswers; // absent in solo mode
}

export interface PipelineResult {
  analysis: Analysis;
  fixtureUsed: boolean;
  providerUsed: string;
  /** How many times Call 1 was re-run for the quote-verbatim emphasis. */
  extractRetries: { A: number; B: number };
  /** Whether the adjudication scan triggered a Call 3 re-run. */
  handbackRerun: boolean;
  /** Whether forceNeutralize had to strip text after the re-run. */
  forceNeutralized: boolean;
}

/**
 * Run Call 1 (Extract) for a single person. Returns their claims, already
 * provenance-filtered. If < 3 survive, re-runs once with verbatim emphasis.
 */
async function extractForPerson(
  person: Person,
  answers: IntakeAnswers,
): Promise<{ claims: Claim[]; retries: number }> {
  const text = intakeText(answers);
  const texts = { A: text, B: text } as Record<Person, string>;

  // First attempt
  const systemPrompt = extractSystemPrompt();
  const userPrompt = extractUserPrompt({ person, answers });
  const result1 = await llmJSON(
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: EXTRACT_TEMPERATURE,
    },
    z.object({ claims: z.array(ClaimSchema) }),
  );

  // Enforce provenance — drop claims whose quotes aren't verbatim substrings.
  const { kept: kept1, dropped: dropped1 } = enforceProvenance(
    result1.data.claims,
    texts,
  );
  if (dropped1 > 0) {
    console.warn(
      `[pipeline] person ${person}: dropped ${dropped1} claim(s) for non-verbatim quotes`,
    );
  }

  // Fix person field on claims (LLM sometimes gets it wrong)
  const fixed1 = kept1.map((c) => ({ ...c, person }));

  const counts1 = claimsPerPerson(fixed1);
  const personCount1 = person === "A" ? counts1.A : counts1.B;

  if (personCount1 >= MIN_CLAIMS_PER_PERSON) {
    return { claims: fixed1, retries: 0 };
  }

  // Re-run with verbatim emphasis (spec §4.3)
  console.warn(
    `[pipeline] person ${person}: only ${personCount1} claims survived (< ${MIN_CLAIMS_PER_PERSON}); re-running with verbatim emphasis`,
  );
  const result2 = await llmJSON(
    {
      messages: [
        { role: "system", content: extractSystemPromptVerbatimEmphasis() },
        { role: "user", content: extractUserPrompt({ person, answers }) },
      ],
      temperature: EXTRACT_TEMPERATURE,
    },
    z.object({ claims: z.array(ClaimSchema) }),
  );

  const { kept: kept2, dropped: dropped2 } = enforceProvenance(
    result2.data.claims,
    texts,
  );
  if (dropped2 > 0) {
    console.warn(
      `[pipeline] person ${person} (retry): dropped ${dropped2} claim(s)`,
    );
  }
  const fixed2 = kept2.map((c) => ({ ...c, person }));

  // Use the retry result if it's better; otherwise keep the first.
  const counts2 = claimsPerPerson(fixed2);
  const personCount2 = person === "A" ? counts2.A : counts2.B;
  if (personCount2 >= personCount1) {
    return { claims: fixed2, retries: 1 };
  }
  return { claims: fixed1, retries: 1 };
}

/**
 * Run Call 2 (Align) on both claim sets.
 */
async function alignAll(claims: Claim[]): Promise<{
  alignments: Analysis["alignments"];
  proxies: Analysis["proxies"];
}> {
  const result = await llmJSON(
    {
      messages: [
        { role: "system", content: alignSystemPrompt() },
        { role: "user", content: alignUserPrompt({ claims }) },
      ],
      temperature: ALIGN_TEMPERATURE,
    },
    AlignOutputSchema,
  );
  return {
    alignments: result.data.alignments,
    proxies: result.data.proxies,
  };
}

/**
 * Run Call 3 (Handback). If the output contains adjudicating language,
 * re-run once. If it still does, forceNeutralize strips the offending text.
 */
async function buildHandback(
  claims: Claim[],
  alignments: Analysis["alignments"],
  proxies: Analysis["proxies"],
  mode: "solo" | "couple",
): Promise<{ handback: Analysis["handback"]; rerun: boolean; forceNeutralized: boolean }> {
  const input = { claims, alignments, proxies };
  const result1 = await llmJSON(
    {
      messages: [
        { role: "system", content: handbackSystemPrompt(mode) },
        { role: "user", content: handbackUserPrompt(input) },
      ],
      temperature: HANDBACK_TEMPERATURE,
    },
    HandbackSchema,
  );

  const offenders1 = findAdjudication({
    alignments,
    handback: result1.data,
  });

  if (offenders1.length === 0) {
    return { handback: result1.data, rerun: false, forceNeutralized: false };
  }

  // Re-run Call 3 (spec §4.7.3: "Verdict audit on handback output → one re-run")
  console.warn(
    `[pipeline] handback contained adjudicating language in: ${offenders1.join(", ")}; re-running Call 3`,
  );
  const result2 = await llmJSON(
    {
      messages: [
        { role: "system", content: handbackSystemPrompt(mode) },
        {
          role: "user",
          content: `${handbackUserPrompt(input)}

IMPORTANT: Your previous response contained adjudicating language (verdict-y phrasing about who is right). You MUST NOT use any of: "right", "wrong", "mistaken", "at fault", "to blame", "actually", "in reality", "the truth is", "should have", "lying", "dishonest". Describe, do not adjudicate. Rewrite your response to be purely descriptive and reflective.`,
        },
      ],
      temperature: HANDBACK_TEMPERATURE,
    },
    HandbackSchema,
  );

  // Check the re-run. Note: we also re-scan the alignment notes here, since
  // the re-run doesn't touch them but we want a clean final assembly.
  const offenders2 = findAdjudication({
    alignments,
    handback: result2.data,
  });

  if (offenders2.length === 0) {
    return { handback: result2.data, rerun: true, forceNeutralized: false };
  }

  // Still has adjudication — forceNeutralize as last resort.
  console.warn(
    `[pipeline] handback still contains adjudicating language after re-run; forceNeutralizing: ${offenders2.join(", ")}`,
  );
  const partial: Analysis = {
    claims,
    alignments,
    proxies,
    handback: result2.data,
  };
  const neutralized = forceNeutralize(partial);
  return {
    handback: neutralized.handback,
    rerun: true,
    forceNeutralized: true,
  };
}

/**
 * Run the full pipeline. Tries up to 2 times; on 2 failures, returns the
 * fixture (spec §4.8: "after 2 pipeline failures → fixture").
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[pipeline] attempt ${attempt}/2 starting`);

      // Call 1: Extract for A (always). Extract for B too if couple mode.
      const extractA = extractForPerson("A", input.intakeA);
      const extractB =
        input.mode === "couple" && input.intakeB
          ? extractForPerson("B", input.intakeB)
          : Promise.resolve({ claims: [] as Claim[], retries: 0 });

      const [aResult, bResult] = await Promise.all([extractA, extractB]);
      const allClaims = [...aResult.claims, ...bResult.claims];

      if (allClaims.length === 0) {
        throw new Error("no claims extracted from either person");
      }

      // Call 2: Align
      const { alignments, proxies } = await alignAll(allClaims);

      // Call 3: Handback (mode-aware: solo = questions to ask yourself)
      const { handback, rerun, forceNeutralized } = await buildHandback(
        allClaims,
        alignments,
        proxies,
        input.mode,
      );

      const analysis: Analysis = {
        claims: allClaims,
        alignments,
        proxies,
        handback,
      };

      // Final zod parse as a safety net (spec invariant: fixtures are
      // zod-parsed on load; live output gets the same treatment).
      const parsed = AnalysisSchema.safeParse(analysis);
      if (!parsed.success) {
        throw new Error(
          `final analysis failed zod: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
        );
      }

      console.log(
        `[pipeline] attempt ${attempt}/2 succeeded: ${allClaims.length} claims, ${alignments.length} alignments, ${proxies.length} proxies`,
      );

      return {
        analysis: parsed.data as Analysis,
        fixtureUsed: false,
        providerUsed: "live",
        extractRetries: {
          A: aResult.retries,
          B: bResult.retries,
        },
        handbackRerun: rerun,
        forceNeutralized,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.error(
        `[pipeline] attempt ${attempt}/2 failed: ${lastError.message}`,
      );
    }
  }

  // 2 failures → fixture fallback (spec §4.8)
  console.warn(
    `[pipeline] 2 attempts failed; falling back to fixture. Last error: ${lastError?.message}`,
  );
  return {
    analysis: getDefaultFixture().analysis,
    fixtureUsed: true,
    providerUsed: "fixture",
    extractRetries: { A: 0, B: 0 },
    handbackRerun: false,
    forceNeutralized: false,
  };
}
