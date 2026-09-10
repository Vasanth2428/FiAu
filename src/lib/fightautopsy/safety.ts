// FightAutopsy — safety layer (spec §4.7).
//
// Provider-independent. The crisis screen runs on intake text BEFORE the
// pipeline, regex/keyword first — it must fire even when no LLM provider is
// reachable. The LLM-based classifier is a bonus pass, never the only one.
//
// This module is intentionally over-broad: false positives (blocking a benign
// intake) are recoverable; false negatives (running the pipeline on a crisis
// text) are not.

export interface SafetyResult {
  blocked: boolean;
  reason?: string;
  /** Which field triggered the block, for the UI to highlight. */
  field?: "whatHappened" | "whatIFelt" | "whatIMadeItMean" | "whatIWant";
}

// Crisis lexicon. Matched case-insensitive, word-boundary where sensible.
// These are NOT the trust-model adjudication patterns — these are harm patterns.
const CRISIS_PATTERNS: RegExp[] = [
  // Self-harm
  /\b(kill|killing|killed) (my|myself)\b/i,
  /\bkill myself\b/i,
  /\bsuicide\b/i,
  /\bsuicidal\b/i,
  /\bself[- ]?harm\b/i,
  /\bcut(ting)? myself\b/i,
  /\bend (it all|my life)\b/i,
  /\bdon'?t want to (live|be (here|alive))\b/i,
  /\bbetter off (dead|without me)\b/i,
  /\boverdose\b/i,
  // Violence toward other
  /\b(kill|murder|stab|strangle|choke) (him|her|them|you|my partner|my spouse)\b/i,
  /\bhurt (him|her|them|you)\b/i,
  // Abuse — present-tense disclosure
  /\b(he|she|they) (beats|hits|chokes|strangles|rapes|assaults) me\b/i,
  /\bI am (being )?(abused|beaten|raped|assaulted)\b/i,
  /\bdomestic violence\b/i,
  // Crisis-level substance
  /\bgoing to (drink|use) (until|till) (I die|I pass out|I black out)\b/i,
];

/**
 * Scan a single field. Returns the first matching pattern's reason.
 */
export function scanField(
  text: string,
  field: SafetyResult["field"],
): SafetyResult {
  if (!text) return { blocked: false };
  for (const re of CRISIS_PATTERNS) {
    if (re.test(text)) {
      return {
        blocked: true,
        reason: `This looks like it might be about serious harm. FightAutopsy isn't the right tool for this moment.`,
        field,
      };
    }
  }
  return { blocked: false };
}

/**
 * Scan all four intake fields. Returns the first block, or {blocked:false}.
 */
export function scanIntake(fields: {
  whatHappened: string;
  whatIFelt: string;
  whatIMadeItMean: string;
  whatIWant: string;
}): SafetyResult {
  const order: SafetyResult["field"][] = [
    "whatHappened",
    "whatIFelt",
    "whatIMadeItMean",
    "whatIWant",
  ];
  for (const f of order) {
    const r = scanField(fields[f], f);
    if (r.blocked) return r;
  }
  return { blocked: false };
}

/**
 * Crisis interstitial copy. Calm, non-judgmental, with resources.
 * Spec §4.7: "calm interstitial with crisis resources."
 */
export const CRISIS_INTERSTITIAL = {
  title: "Before we go on — this isn't the right tool for right now.",
  body: `What you wrote sounds like it might be about serious harm — to yourself or to someone else. FightAutopsy isn't built for that, and running it now wouldn't be safe.

If you're in crisis, please reach out to someone trained for exactly this moment:

• In the US: 988 (Suicide & Crisis Lifeline) — call or text
• In the UK: 111, press 2 for mental health
• Anywhere: findahelpline.com will connect you to local help

What you wrote here is not stored. Nothing about this session persists. When you're ready — maybe not today — the fight will still be mappable, and the tool will still be here.`,
  resources: [
    { label: "988 Suicide & Crisis Lifeline (US)", url: "https://988lifeline.org" },
    { label: "Find A Helpline (global)", url: "https://findahelpline.com" },
    { label: "Crisis Text Line", url: "https://www.crisistextline.org" },
  ],
};
