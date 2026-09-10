/**
 * Groq pipeline smoke test — runs directly via node, no Next.js needed.
 * Usage: node tests/groq-pipeline-test.mjs
 *
 * Reads GROQ_API_KEY + GROQ_MODEL from .env.local, then runs all 3 calls:
 *   Call 1a — Extract claims for person A
 *   Call 1b — Extract claims for person B
 *   Call 2  — Align both claim sets (contradictions, proxies)
 *   Call 3  — Handback (opening line, discussion order, reframe)
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local manually (no dotenv dep needed) ─────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  process.env[key] ??= val;
}

const API_KEY = process.env.MISTRAL_API_KEY;
const MODEL   = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

if (!API_KEY) {
  console.error("❌  MISTRAL_API_KEY not set in .env.local");
  process.exit(1);
}

console.log(`\n🔑  Using model: ${MODEL} (Mistral)`);
console.log("─".repeat(60));

// ── Realistic fight scenario ─────────────────────────────────────────────────
// Alex and Jordan — fight about a cancelled dinner plan.

const SCENARIO = {
  A: {
    name: "Alex",
    answers: {
      whatHappened:
        "We had plans to have dinner together on Friday. I had been looking forward to it all week. At 5pm Jordan texted saying they were too tired and cancelled. I had already left work early and was on my way home to cook.",
      whatIFelt:
        "I felt dismissed and like my time didn't matter. I was hurt and then angry when I realised I had rearranged my whole afternoon for nothing.",
      whatIMadeItMean:
        "I made it mean that Jordan doesn't take our plans seriously. If it is not convenient for them they just cancel. I always have to be the one who adapts.",
      whatIWant:
        "I want Jordan to tell me earlier if something comes up, not at the last minute. I want to feel like our time together actually matters to them.",
    },
  },
  B: {
    name: "Jordan",
    answers: {
      whatHappened:
        "I had a brutal day at work — a presentation went badly and I was exhausted. By 5pm I genuinely had nothing left. I texted Alex to let them know I needed to cancel dinner. I thought they would understand because I have been really stressed lately.",
      whatIFelt:
        "I felt guilty for cancelling but also frustrated that I got such a cold response. I was already feeling terrible about the day and then I felt punished for being honest.",
      whatIMadeItMean:
        "I made it mean that Alex needs me to perform even when I am running on empty. I can never just have a bad day without it becoming a problem.",
      whatIWant:
        "I want Alex to understand that sometimes I need to cancel without it turning into a big thing. I also want to feel like I can be honest about not being okay.",
    },
  },
};

// ── Groq call helper ─────────────────────────────────────────────────────────
async function callGroq(messages, json = true) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response");
  // Strip markdown fences (groq/compound ignores json_object format)
  let clean = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const brace = clean.indexOf("{");
  if (brace > 0) clean = clean.slice(brace); // strip any prose prefix
  const usage = data.usage;
  return { content: JSON.parse(clean), usage };
}


// ── Pretty-print helpers ─────────────────────────────────────────────────────
function section(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

function printClaims(claims, personName) {
  console.log(`\n  📋  ${personName}'s claims (${claims.length}):`);
  for (const c of claims) {
    const validAbs = (c.absolutes ?? []).filter(a => a?.word && a?.rewrite);
    const abs = validAbs.length
      ? `\n        ⚠️  Absolute: "${validAbs[0].word}" → ${validAbs[0].rewrite}`
      : "";
    console.log(`\n  [${c.id}] ${c.layer}`);
    console.log(`        "${c.quote}"${abs}`);
  }
}

// ── CALL 1A: Extract claims for Alex ─────────────────────────────────────────
section("CALL 1 — Extract: Alex (Person A)");

const ANALYST_NOT_JUDGE = `You are an analyst, not a judge. Your job is to map what each person said — never to decide who is right, who is wrong, who is at fault, or who started it. You never assign blame. You never use words like "right", "wrong", "mistaken", "lying", "at fault", "to blame", "actually", "in reality", "the truth is", or "should have". When two accounts differ, you describe the difference neutrally, never as a verdict.`;

const EXTRACT_SYSTEM = `${ANALYST_NOT_JUDGE}

You are a claim-extraction engine. Extract between 3 and 8 atomic claims from this person's account. Each claim must be ONE idea. Each claim must have a QUOTE that is an EXACT, VERBATIM SUBSTRING of the intake text. Classify each claim as FACT, CAUSALITY, VALUE, DEFINITION, INTERPRETATION, or REQUEST. Flag absolute terms (always, never, etc.) with a specific rewrite. Respond with ONLY a JSON object: { "claims": [ { "id": "a1", "person": "A", "layer": "FACT", "quote": "exact substring", "absolutes": [] } ] }`;

const intakeA = SCENARIO.A.answers;
const concatA = [intakeA.whatHappened, intakeA.whatIFelt, intakeA.whatIMadeItMean, intakeA.whatIWant].join("\n\n");

let t = Date.now();
const { content: extractA, usage: usageA } = await callGroq([
  { role: "system", content: EXTRACT_SYSTEM },
  { role: "user", content: `Extract claims for person A.\n\n[whatHappened]\n${intakeA.whatHappened}\n\n[whatIFelt]\n${intakeA.whatIFelt}\n\n[whatIMadeItMean]\n${intakeA.whatIMadeItMean}\n\n[whatIWant]\n${intakeA.whatIWant}\n\nConcatenated text:\n${concatA}\n\nReturn the JSON now.` },
]);
console.log(`  ⏱  ${Date.now() - t}ms | tokens: ${usageA.total_tokens}`);
printClaims(extractA.claims, "Alex");

// ── CALL 1B: Extract claims for Jordan ───────────────────────────────────────
section("CALL 1 — Extract: Jordan (Person B)");

const EXTRACT_SYSTEM_B = EXTRACT_SYSTEM.replace(/"person": "A"/, '"person": "B"').replace(/"id": "a1"/, '"id": "b1"');
const intakeB = SCENARIO.B.answers;
const concatB = [intakeB.whatHappened, intakeB.whatIFelt, intakeB.whatIMadeItMean, intakeB.whatIWant].join("\n\n");

t = Date.now();
const { content: extractB, usage: usageB } = await callGroq([
  { role: "system", content: EXTRACT_SYSTEM_B.replace('person: "A"', 'person: "B"') },
  { role: "user", content: `Extract claims for person B.\n\n[whatHappened]\n${intakeB.whatHappened}\n\n[whatIFelt]\n${intakeB.whatIFelt}\n\n[whatIMadeItMean]\n${intakeB.whatIMadeItMean}\n\n[whatIWant]\n${intakeB.whatIWant}\n\nConcatenated text:\n${concatB}\n\nReturn the JSON now.` },
]);
console.log(`  ⏱  ${Date.now() - t}ms | tokens: ${usageB.total_tokens}`);
printClaims(extractB.claims, "Jordan");

// ── CALL 2: Align ─────────────────────────────────────────────────────────────
section("CALL 2 — Align (contradictions, proxies)");

const allClaims = [...extractA.claims, ...extractB.claims];

const ALIGN_SYSTEM = `${ANALYST_NOT_JUDGE}

You are an alignment engine. Line up claims from two people about the same fight. For each meaningful pair, label: AGREE, CONTRADICT, or DISCONNECT. Notes must be neutral and descriptive — never adjudicate. Also detect PROXY conflicts (surface dispute standing in for a deeper one). If no proxy, return []. Respond with ONLY JSON: { "alignments": [ { "type": "CONTRADICT", "claims": ["a1","b1"], "note": "..." } ], "proxies": [ { "surface": "...", "root": { "person": "A", "layer": "VALUE", "text": "..." }, "evidence": ["a2","b3"] } ] }`;

t = Date.now();
const { content: aligned, usage: usageAlign } = await callGroq([
  { role: "system", content: ALIGN_SYSTEM },
  { role: "user", content: `Align these claims:\n\n${JSON.stringify(allClaims, null, 2)}\n\nReturn the JSON now.` },
]);
console.log(`  ⏱  ${Date.now() - t}ms | tokens: ${usageAlign.total_tokens}`);

console.log(`\n  🔗  Alignments (${aligned.alignments.length}):`);
for (const al of aligned.alignments) {
  const icon = al.type === "CONTRADICT" ? "⚡" : al.type === "AGREE" ? "✅" : "↔️ ";
  console.log(`\n  ${icon}  ${al.type} [${al.claims.join(" × ")}]`);
  console.log(`        ${al.note}`);
}

if (aligned.proxies.length > 0) {
  console.log(`\n  🎭  Proxy conflict detected:`);
  for (const p of aligned.proxies) {
    console.log(`\n  Surface: "${p.surface}"`);
    console.log(`  Root: Person ${p.root.person} — ${p.root.layer}`);
    console.log(`        "${p.root.text}"`);
    console.log(`  Evidence: [${p.evidence.join(", ")}]`);
  }
} else {
  console.log(`\n  ✓  No proxy conflict detected (fight is about what it appears to be about)`);
}

// ── CALL 3: Handback ─────────────────────────────────────────────────────────
section("CALL 3 — Handback (the conversation to have)");

const HANDBACK_SYSTEM = `${ANALYST_NOT_JUDGE}

You are a handback writer for TWO people. Produce three things:
1. OPENING: one sentence beginning "What I heard you say was, [VERBATIM QUOTE FROM CLAIMS] — is that right?" — must reference an actual claim quote, not a paraphrase.
2. ORDER: array of 2–8 claim IDs, facts-first / values-last.
3. REFRAME: one sentence framing the fight as a shared problem ("you and me versus the problem"). No blame, no therapy-speak.

Respond with ONLY JSON: { "opening": "...", "order": ["a1","b1",...], "reframe": "..." }`;

t = Date.now();
const { content: handback, usage: usageHandback } = await callGroq([
  { role: "system", content: HANDBACK_SYSTEM },
  { role: "user", content: `Claims:\n${JSON.stringify(allClaims, null, 2)}\n\nAlignments:\n${JSON.stringify(aligned.alignments, null, 2)}\n\nProxies:\n${JSON.stringify(aligned.proxies, null, 2)}\n\nReturn the JSON now.` },
]);
console.log(`  ⏱  ${Date.now() - t}ms | tokens: ${usageHandback.total_tokens}`);

console.log(`\n  💬  Opening:`);
console.log(`        "${handback.opening}"`);
console.log(`\n  📋  Discussion order: [${handback.order.join(" → ")}]`);
console.log(`\n  🎯  Reframe:`);
console.log(`        "${handback.reframe}"`);

// ── Summary ───────────────────────────────────────────────────────────────────
section("SUMMARY");
const totalTokens = usageA.total_tokens + usageB.total_tokens + usageAlign.total_tokens + usageHandback.total_tokens;
console.log(`  Claims extracted: A=${extractA.claims.length}, B=${extractB.claims.length}`);
console.log(`  Alignments found: ${aligned.alignments.length}`);
console.log(`  Proxy conflicts:  ${aligned.proxies.length}`);
console.log(`  Total tokens used: ${totalTokens}`);
console.log(`\n  ✅  All 3 pipeline calls completed successfully with Groq.\n`);
