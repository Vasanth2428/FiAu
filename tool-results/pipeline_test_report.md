# FightAutopsy — Pipeline Test Report
**Model:** `ministral-8b-latest` via Mistral API  
**Test date:** 2026-09-10  
**Scenario:** Alex vs Jordan — cancelled dinner fight  
**Total tokens:** 6,646 | **Total time:** ~13s across 3 calls

---

## Scenario

Two people in a relationship. Alex had dinner plans with Jordan on Friday. Jordan cancelled at 5pm via text, citing exhaustion after a bad work day. Alex had already left work early to cook. Both felt wronged — Alex felt dismissed, Jordan felt punished for being honest.

---

## Call 1a — Extract (Alex / Person A)
**Tokens:** 1,126 | **Time:** 5,985ms

### Actual Output

| ID | Layer | Quote |
|---|---|---|
| a1 | FACT | `"We had plans to have dinner together on Friday."` |
| a2 | FACT | `"I had been looking forward to it all week."` |
| a3 | FACT | `"At 5pm Jordan texted saying they were too tired and cancelled."` |
| a4 | FACT | `"I had already left work early and was on my way home to cook."` |
| a5 | VALUE | `"I felt dismissed and like my time didn't matter."` |
| a6 | INTERPRETATION | `"I made it mean that Jordan doesn't take our plans seriously."` |
| a7 | INTERPRETATION | `"If it is not convenient for them they just cancel."` |
| a8 | INTERPRETATION | `"I always have to be the one who adapts."` |
| a9 | REQUEST | `"I want Jordan to tell me earlier if something comes up, not at the last minute."` |
| a10 | REQUEST | `"I want to feel like our time together actually matters to them."` |

### Inference

**Strengths:**
- All 10 quotes are verbatim substrings of the intake text — no paraphrasing.
- The model correctly split `a9` and `a10` into two separate requests rather than bundling them. This matters — they're asking for different things (process vs. validation).
- `a5` classified as **VALUE** not INTERPRETATION is a sharp call. "My time didn't matter" is a values statement (about what *should* be true), not just a reading of Jordan's behavior. The pipeline schema allows this and it's the right layer.
- `a8` ("I always have to be the one who adapts") was *not* flagged with an absolute rewrite in this run — a minor miss. The word "always" should have triggered an absolute flag with a rewrite like "I've adapted to three cancellations this month." The provenance check won't catch this; it's a prompt-compliance gap.

**Concern:**  
Extracted 10 claims (the spec max is 8). The system prompt says "NEVER return more than 8." The model exceeded the cap. The pipeline's zod schema doesn't enforce a max array length, so these all pass through. In practice having 10 vs 8 isn't harmful here — all quotes are real — but it's a prompt non-compliance worth noting.

---

## Call 1b — Extract (Jordan / Person B)
**Tokens:** 1,077 | **Time:** 4,040ms

### Actual Output

| ID | Layer | Quote |
|---|---|---|
| b1 | FACT | `"a brutal day at work — a presentation went badly and I was exhausted"` |
| b2 | FACT | `"By 5pm I genuinely had nothing left"` |
| b3 | FACT | `"I texted Alex to let them know I needed to cancel dinner"` |
| b4 | CAUSALITY | `"I thought they would understand because I have been really stressed lately"` |
| b5 | VALUE | `"I felt guilty for cancelling but also frustrated that I got such a cold response"` |
| b6 | INTERPRETATION | `"I made it mean that Alex needs me to perform even when I am running on empty"` |
| b7 | REQUEST | `"I want Alex to understand that sometimes I need to cancel without it turning into a big thing"` |
| b8 | REQUEST | `"I also want to feel like I can be honest about not being okay"` |

### Inference

**Strengths:**
- `b4` correctly classified as **CAUSALITY** — "I thought they would understand *because*…" is a causal claim, not just an interpretation. Accurate.
- `b5` as **VALUE** is correct for the same reason as `a5` — it's a normative statement about how the response *should* have been.
- `b7` and `b8` correctly split into two separate requests.

**Concern:**  
`b1` is a partial quote: `"a brutal day at work — a presentation went badly and I was exhausted"`. Jordan's actual text begins *"I had a brutal day at work..."*. The quote is missing the opening "I had". This means `b1` **will be dropped by the provenance check** in `pipeline.ts` (which requires the quote to be an exact substring). This is the pipeline's safety net working correctly — but it means the model got the verbatim requirement wrong on one claim. After provenance filtering, Jordan would have 7 claims, still above the 3-claim minimum.

---

## Call 2 — Align
**Tokens:** 2,133 | **Time:** 7,560ms

### Actual Output

| Type | Pair | Note |
|---|---|---|
| ⚡ CONTRADICT | a1 × b1 | A states there were plans for dinner on Friday, while B does not mention any prior plans. |
| ⚡ CONTRADICT | a2 × b1 | A expresses anticipation all week, while B describes a stressful day. |
| ⚡ CONTRADICT | a3 × b3 | A states Jordan texted at 5pm to cancel; B states they texted to cancel. |
| ⚡ CONTRADICT | a4 × b2 | A mentions leaving work early to cook; B describes being exhausted by 5pm. |
| ↔️ DISCONNECT | a5 × b5 | A feels dismissed; B feels guilty and frustrated. |
| ↔️ DISCONNECT | a6 × b6 | A interprets as Jordan not taking plans seriously; B as needing to perform consistently. |
| ↔️ DISCONNECT | a7 × b6 | A generalises about cancellations; B focuses on emotional burden. |
| ↔️ DISCONNECT | a8 × b6 | A emphasises adaptability as recurring issue; B highlights emotional honesty. |
| ↔️ DISCONNECT | a9 × b7 | A requests earlier notice; B requests understanding without overreaction. |
| ↔️ DISCONNECT | a10 × b8 | A seeks validation that time matters; B seeks permission to be vulnerable. |

**4 Proxy conflicts detected:**
1. Surface: dinner cancellation/disregard → Root: A's VALUE `a5` ("time didn't matter")
2. Surface: dinner cancellation/emotional burden → Root: B's VALUE `b5` (guilt + cold response)
3. Surface: communication about plans → Root: A's REQUEST `a9` (earlier notice)
4. Surface: communication about plans → Root: B's REQUEST `b7` (understanding for cancellations)

### Inference

**Strengths:**
- `a3 × b3` CONTRADICT is genuinely interesting: both say a text was sent, but only Alex's account specifies the *time* (5pm). The model noticed this asymmetry.
- `a9 × b7` DISCONNECT is the core of the fight expressed precisely: "tell me earlier" vs "don't make it a big thing" — these are parallel but non-intersecting requests. The model got this right.
- `a10 × b8` DISCONNECT is the most insightful pairing: "I want to feel our time matters" vs "I want to feel I can be honest about not being okay" — these are both bids for safety, from opposite sides.

**Concern:**  
**4 proxies is too many.** The prompt explicitly says: *"If no proxy is evident, return an EMPTY proxies array... Inventing a proxy breaks the trust model."* The model found real-ish patterns but over-generated. Proxies 3 and 4 (communication surface) largely restate the same underlying tension as proxies 1 and 2 — they should have been collapsed into one or omitted. A stronger model (or a tighter prompt) would have returned 1–2 here. This is the clearest quality gap for `ministral-8b`.

The 4 CONTRADICTs are also suspect. `a1 × b1` is labelled CONTRADICT because "B does not mention prior plans" — but that's absence of evidence, not contradiction. A more precise model would label this DISCONNECT (they're talking past each other) not CONTRADICT (incompatible claims). Similarly `a2 × b1`. Genuine CONTRADICTs should be reserved for direct incompatibility, not topic mismatch.

---

## Call 3 — Handback
**Tokens:** 2,310 | **Time:** 1,702ms

### Actual Output

**Opening:**
> "What I heard you say was, *'We had plans to have dinner together on Friday.'* — is that right?"

**Discussion order:** `a1 → b1 → a3 → b3 → a4 → b2 → a5 → b5 → a9 → b7 → a6 → b6`

**Reframe:**
> "You both are navigating how to balance personal needs and shared commitments in a way that feels respectful and sustainable."

### Inference

**Opening:**
- ✅ Uses a verbatim claim quote — `a1` exact substring.
- ✅ Ends with "— is that right?" as required.
- ⚠️ The asterisks around the quote (`*'...'*`) are markdown italics — a cosmetic issue if the UI renders markdown, fine if not. The spec says no markdown in the handback output, though the JSON field is just a string.
- ⚠️ Opening with `a1` (the most neutral, factual statement) is a safe choice, but it's not the most therapeutically interesting opening. A stronger model might have opened with `a10 × b8` — the shared bid for safety — which would land with more impact.

**Discussion order:**
- ✅ Facts-first structure: `a1, b1` (what happened) → `a3, b3` (the cancellation event) → `a4, b2` (the circumstances) → `a5, b5` (the feelings) → `a9, b7` (the requests) → `a6, b6` (the interpretations).
- ✅ 12 claims in the order — more than the 2–8 spec asks for. The spec says "2 to 8 claim IDs." The model returned 12. The HandbackSchema uses `z.array(z.string())` with no max, so this passes zod but violates the spec constraint.

**Reframe:**
- ✅ Neutral, no blame, shared-problem framing.
- ⚠️ Generic. "Balance personal needs and shared commitments" is accurate but soft. The spec example shows a reframe that *names the surface and points at what's underneath*: `"the chips are the surface; what's underneath is..."`. This reframe doesn't do that — it stays at the surface level.

---

## Overall Verdict

### What `ministral-8b-latest` does well
- Verbatim quoting (9/10 quotes were exact — only `b1` failed)
- Layer classification is mostly accurate, with some genuinely sharp calls (`a5`, `b5` as VALUE)
- Neutral language throughout — no adjudicating, no "A is right"
- Follows the facts-first ordering principle in handback
- Fast: full pipeline in ~13s

### Where it falls short vs a larger model
| Issue | Severity | Impact |
|---|---|---|
| Exceeded 8-claim cap (returned 10 for A) | Low | No functional harm; extra claims enrich output |
| `b1` non-verbatim quote | Low | Caught and dropped by provenance check |
| Over-generated proxies (4 instead of 1–2) | Medium | Extra noise in the UI; reduces signal |
| CONTRADICT used for topic mismatch (not true contradiction) | Medium | Misrepresents the nature of the disagreement |
| Handback order exceeded 8 items | Low | No functional harm |
| Reframe is generic, not specific | Low | Weaker closing moment for users |

### Bottom line
**Good enough for local dev and early users.** The extraction and alignment are functionally correct — the pipeline safety nets (provenance check, adjudication scan) catch the one real error. The quality gaps are in nuance (proxy over-generation, reframe genericness), not correctness. For production at scale, a larger model (`mistral-medium-3` or `magistral-medium`) would tighten this considerably — but those require a paid key.
