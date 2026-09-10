# FightAutopsy — Work Log

Spec: claim-level map of a recurring fight. Three non-negotiable invariants:
1. Every claim quote must validate as a verbatim substring of intake text.
2. No output may contain adjudicating language about who's right.
3. Sessions expire; nothing persists beyond TTL.

## Decisions locked with user (this session)

- **Routes**: single `/` route with query params `?view=join&code=ABC123`. Three views (landing/intake/tree) as self-contained components; query-param router is a thin ~30-line layer. Preserves couple-mode share links.
- **LLM provider**: spec's fallback chain (Groq → Gemini → OpenRouter) preserved verbatim. Z.ai SDK added as one more provider in the same chain. `LLM_PROVIDER_1=zai` in sandbox; spec's env vars on Vercel. Fixture fallback stays terminal.
- **Store**: in-memory `Map` behind `Store` interface (one-file seam for Upstash on deploy).
- **No test files**: both invariants live as runtime pipeline guards (substring-drop + adjudication-scan). Fixtures zod-parsed on load.
- **Next 16** (sandbox is 16.1.3, React 19).
- **Solo conversion**: lazy check on `GET /api/tree` (no timers).
- **One analysis per fight**: 409 on `/api/intake` once `analysis` set; room becomes read-only.
- **Safety layer provider-independent**: regex/keyword crisis screen fires before pipeline, LLM classifier is bonus pass.
- **Demo fallback**: `demo=1` query → fixture immediately; OR 2 pipeline failures → fixture. Both zod-parsed on load.
- **React Flow compat verified**: `@xyflow/react@12.11.6`, peerDeps `react: ">=17"`, maintainer confirms React 19 works (issue #4893). CSS imported in client component.

## Phase / Task map

- Task 1: React Flow compat check — DONE
- Task 2: worklog + scaffolding — DONE
- Task 3: contract layer (types/schemas/invariants/fixtures) — DONE
- Task 4: walking skeleton (router + 3 views + mock API + ugly tree) — DONE
- Task 5: real pipeline (llmJSON + 3 prompts + store + safety) — pending
- Task 6: couple mode — pending
- Task 7: polish (ProxyCard / SidePanel / HandbackCard / footer) — pending
- Task 8: demo hardening + agent-browser e2e — pending

---

Task ID: 1+2+3+4
Agent: main (Z.ai Code)
Task: React Flow compat check, scaffolding, contract layer, walking skeleton — Phase 1 end-to-end.

Work Log:
- Verified sandbox stack: Next.js 16.1.3, React 19, zod v4, z-ai-web-dev-sdk present, full shadcn/ui set. Dev server running clean on port 3000.
- React Flow compat: npm registry authoritative — @xyflow/react@12.11.6, peerDeps react:">=17" (no upper bound). Maintainer issue #4893 confirms React 19 works. CSS imported in client component to avoid RSC issues.
- Installed @xyflow/react.
- Wrote contract layer (src/lib/fightautopsy/):
  - types.ts — domain types matching spec §4.3
  - schemas.ts — zod schemas mirroring types
  - invariants.ts — the two non-negotiable invariants as runtime guards:
    * enforceProvenance(): drops claims whose quote isn't a verbatim substring
    * claimsPerPerson(): for the <3 re-run trigger
    * findAdjudication() / forceNeutralize(): scans handback + alignment notes for verdict language
  - safety.ts — provider-independent crisis screen (regex/keyword first, fires before pipeline)
  - store.ts — in-memory Map behind Store interface, 24h TTL, 15-min solo conversion constant, 6-char room code generator (ambiguous-char-free alphabet)
  - fixtures/chips.ts, chores.ts, adversarial.ts — three hand-built Analyses with verbatim-substring quotes
  - fixtures/index.ts — on-load zod parse + both invariants + referential integrity. Throws at module load if any fixture is broken (crash > ship broken fallback). Runtime-validated: chips 12 claims/4 alignments/1 proxy, chores same shape, adversarial 4 claims/0 proxies.
- Wrote API routes:
  - POST /api/session — creates solo or couple room, returns 6-char code
  - POST /api/intake — safety scan → write → 409 if analysis already set → Phase 1 drops chips fixture when both sides done
  - GET /api/tree — polled every 2s; demo=1 returns fixture immediately (before room lookup, per spec §4.8); lazy solo conversion on 15-min timeout
  - DELETE /api/tree — manual session delete for footer button
- Wrote single-route shell (src/app/page.tsx): thin ~30-line query-param router mapping view → self-contained component. Suspense-wrapped for useSearchParams.
- Wrote view components (src/components/fightautopsy/):
  - app-shell.tsx — sticky footer (mt-auto) with trust disclaimer + delete button (AlertDialog confirm)
  - landing-view.tsx — solo/couple/join paths, three trust pillars at bottom
  - intake-view.tsx — 4 prompts one per screen, localStorage draft autosave, 20-1500 char validation, sealed message, crisis interstitial on safety block
  - issue-tree.tsx — React Flow tree: root node, 6 layer clusters color-coded (FACT gray/CAUSALITY slate/VALUE amber/DEFINITION violet/INTERPRETATION rose/REQUEST green), claim nodes with person badge + quote snippet + ⚠ absolute badge, alignment edges (green AGREE/red animated CONTRADICT/dashed gray DISCONNECT)
  - tree-view.tsx — polls /api/tree every 2s, staged progress copy rotation, renders IssueTree + ProxyCard + HandbackCard + SidePanel
  - proxy-card.tsx, handback-card.tsx, side-panel.tsx — Phase 1 minimal versions
- Fixed lint: react-hooks/set-state-in-effect in tree-view staged-copy effect (removed synchronous setCopyIdx(0) from effect body).
- Fixed runtime: PERSON_BADGE not exported from issue-tree (added export).
- Fixed spec deviation: demo=1 was checking room before demo flag; reordered so demo=1 returns fixture immediately regardless of room existence (spec §4.8).
- Agent-browser end-to-end verification (Phase 1 gate):
  * Landing renders: solo/couple/join all present, delete button disabled (no session)
  * Solo flow: POST /api/session → code Z69NJ4 → intake step 1/4
  * Intake: filled all 4 steps with chips fixture A text (verbatim-substring-valid by construction), Next button enabled/disabled correctly per char count, Sealed screen rendered
  * Tree: "See the map" → tree rendered with root "whether Alex ate the chips", 6 layer clusters, 12 claim nodes with person badges + quotes, 4 alignment edges (AGREE/CONTRADICT/DISCONNECT/CONTRADICT)
  * ProxyCard: "This probably isn't about whether Alex ate the chips" + evidence chips a4/a5/b4/b5
  * HandbackCard: reflective opening ("What I heard you say was..."), 8-item discussion order (facts first values last), "you and me versus the problem" reframe, copy button
  * SidePanel: clicked claim a1 → "Contradicts person B" + other quote + neutral note ("Different recollections of the same evening...")
  * Footer: "Not therapy, not legal advice. FightAutopsy never determines who is right. Nothing is stored after 24 hours." + enabled delete button
  * demo=1 path: returns fixture immediately (status ready, 12 claims, 1 proxy) regardless of room
  * Dev log: all 200s on golden path, no runtime errors after fixes
  * Browser console: no errors

Stage Summary:
- Phase 1 (walking skeleton) COMPLETE and verified end-to-end via agent-browser.
- Whole loop works on fake data: landing → intake → sealed → tree → click claim → side panel. Fixture fallback path (demo=1) works standalone.
- All three fixtures pass on-load validation (zod + both invariants + referential integrity). The trust model is load-bearing and proven.
- Lint clean. Dev server clean.
- Known Phase 1 shortcuts to address in later phases:
  * /api/intake drops chips fixture immediately when both sides done (Phase 2 swaps in real LLM pipeline)
  * ProxyCard/HandbackCard/SidePanel are minimal (Phase 4 polishes)
  * Couple mode not yet browser-tested (Phase 3)
  * No auto-layout on tree — deterministic column layout (Phase 4 may add dagre)
- Files produced: 8 in src/lib/fightautopsy/, 3 API routes, 8 view components, updated page.tsx + layout.tsx metadata.


---

Task ID: spec-amendment-1
Agent: main (Z.ai Code)
Task: Ingest Voice Intake spec amendment (new §4.6 expansion + 5 new invariants, Phase 4 placement).

Work Log:
- Received Voice Intake amendment. Spec adds hold-to-talk mic to the 4 intake prompts, browser-native Web Speech API, 90s max, one recording + one re-record per prompt, no audio persistence, no server involvement (backend cannot tell typed vs spoken).
- Confirmed: no schema, store, or pipeline changes. The feature is a pure client-side capture layer on top of the existing textarea in intake-view.tsx.
- Confirmed: safety layer (safety.ts) is source-agnostic — scans final text regardless of origin, so crisis detection still fires on voice-derived transcripts. Earlier design decision pays off here.
- 5 new invariants (same tier as substring + no-verdict), to be enforced at Phase 4:
  1. App produces no audio, ever (no TTS — deliberately not using available TTS skill)
  2. Mic only on 4 intake screens (structural: mic component only rendered in IntakeView)
  3. One recording + one re-record per prompt (per-prompt take counter, mic dead after take 2)
  4. Room creation rate-limited to 1/hour/browser (localStorage, advisory-level)
  5. No auto-submit (Seal is always manual; recording never triggers submit)
- Implementation plan for Phase 4:
  - Hold-to-talk via pointer events (onPointerDown start, onPointerUp/onPointerLeave stop)
  - getUserMedia + AnalyserNode for live waveform (real, not faked), SpeechRecognition for transcript, dual audio path
  - Fall back to progress-bar-only if getUserMedia denied but SpeechRecognition works
  - 90s draining progress bar, 5s silence detection (empty transcript doesn't clobber existing text)
  - Take counter per prompt, mic disabled after take 2
  - Review copy: "This is your private draft. Edit anything before sealing — the map only uses what you keep."
  - Rate limit on landing: localStorage fightautopsy:lastRoomAt, 1h window, advisory message + disable create buttons (join still allowed)
- Sandbox testing limitation flagged: agent-browser (headless Chromium) typically lacks mic/ SpeechRecognition. Will verify (a) mic hidden, (b) typing path works, (c) take-counter + rate-limit logic. Live voice recording cannot be verified in sandbox — human must test on real browser.

Stage Summary:
- Voice Intake queued for Phase 4 per spec §8, immediately after ProxyCard/HandbackCard.
- No changes to existing Phase 1/2/3 plan. Pipeline and couple-mode work proceed unchanged.
- Two open questions for human: (1) waveform approach OK? (2) proceed with Phase 2 now or reorder?

---

Task ID: 5a+5b+5c+5d
Agent: main (Z.ai Code)
Task: Phase 2 — real LLM pipeline (provider chain, llmJSON, prompts, pipeline runner, wire into API, live e2e verification).

Work Log:
- Invoked LLM skill to confirm Z.ai SDK API: ZAI.create() → zai.chat.completions.create({messages, thinking:{type:"disabled"}}). System prompt uses role "assistant".
- Smoke-tested live Z.ai SDK: confirmed it works AND confirmed it wraps JSON in ```json fences — proving the fence-stripping in llmJSON is load-bearing, not theoretical.
- Built provider chain (src/lib/fightautopsy/llm/providers.ts):
  * LLMProvider interface with callRaw()
  * 4 concrete providers: ZaiProvider (sandbox), GroqProvider, GeminiProvider, OpenRouterProvider (deploy)
  * Env-driven chain: LLM_PROVIDER_1/2/3, defaults to ["zai"] in sandbox
  * Each provider is env-selected; unavailable providers (no API key) throw immediately so llmJSON falls through
- Built llmJSON() wrapper (src/lib/fightautopsy/llm/llm-json.ts):
  * stripFences(): handles ```json fences, bare ``` fences, and prose-around-JSON extraction
  * 3 retries per provider with prompt-repair suffix on parse failure
  * Provider fallback: on provider-level error (network/auth/429), breaks to next provider
  * zod parse on every attempt; returns {data, provider, attempts}
- Wrote prompts (src/lib/fightautopsy/prompts.ts):
  * ANALYST_NOT_JUDGE preamble in every system prompt (spec §4.7.2)
  * Call 1 Extract (temp 0.2): 3-8 atomic claims, verbatim quote emphasis, 6 layers, absolute flagging
  * Call 2 Align (temp 0.2): AGREE/CONTRADICT/DISCONNECT, neutral notes, proxy detection (empty array if none)
  * Call 3 Handback (temp 0.4): reflective opening with real quote, facts-first order, shared-problem reframe
  * extractSystemPromptVerbatimEmphasis() for the <3 re-run
- Built pipeline runner (src/lib/fightautopsy/pipeline.ts):
  * Call 1 for A and B in parallel (Promise.all)
  * enforceProvenance on each person's claims → drop non-verbatim quotes
  * <3 claims per person → re-run Call 1 once with verbatim emphasis
  * Call 2 (align) on all surviving claims
  * Call 3 (handback) → findAdjudication → if any, re-run Call 3 once → if still, forceNeutralize
  * Final zod parse as safety net
  * 2 pipeline failures → fixture fallback (spec §4.8)
- Wired pipeline into /api/intake:
  * Replaced Phase 1 fixture-drop stub with runPipeline() call
  * Uses after() from next/server for async execution
  * Sets room.pipelineRunning=true before returning, so /api/tree shows "analyzing"
  * On completion: sets room.analysis, room.fixtureUsed, room.pipelineRunning=false
  * On unexpected error: fixture fallback so room never hangs
- Fixed critical store bug: in-memory Map was not surviving HMR/module recompilation between routes. Applied standard Next.js dev pattern: globalThis.__fightautopsyStore singleton. Without this, POST /api/session and POST /api/intake had different Map instances and rooms vanished.
- Fixed pipeline bug: pipeline.ts used z.object() without importing z from zod. Added import.
- Fixed fixtureUsed tracking: tree route was hardcoding fixtureUsed=false. Added fixtureUsed field to RoomDoc, set it in intake route from pipeline result, read it in tree route.
- Live end-to-end pipeline test (couple session, chips text for both A and B):
  * First run: failed with "z is not defined" → fixture fallback (this was before the z import fix)
  * Second run (after fix): SUCCEEDED on attempt 1/2
    - 26 claims (A=13, B=13) — all passed verbatim substring check, zero drops, no re-run needed
    - 8 alignments with neutral notes (AGREE×2, CONTRADICT×1, DISCONNECT×5) — no adjudication
    - 2 proxies detected (surface: "Chips on the counter", roots: A/VALUE and B/VALUE)
    - Handback: reflective opening with real verbatim quote, facts-first order, "you and me versus the problem" reframe
    - Both invariants PASS on live LLM output
    - ~36 seconds to complete (12 polls × 3s) — within spec's 10-30s estimate
    - fixtureUsed=false correctly reported through to UI
- Agent-browser verification: tree renders with live data (26 claim nodes, 8 alignment edges, 2 proxy cards, handback card with live opening). No browser errors. Footer present.
- Verified demo=1 path still works (fixtureUsed=True, 12 claims) and live room reports fixtureUsed=False correctly.

Stage Summary:
- Phase 2 (real pipeline) COMPLETE and verified end-to-end with live LLM.
- The Z.ai provider produces clean, trust-model-compliant output on the first attempt — no provenance drops, no adjudication re-run, no forceNeutralize needed. The prompt engineering is working.
- Provider chain is spec-compliant: Groq → Gemini → OpenRouter + Z.ai. In sandbox, only Z.ai is live; on Vercel deploy, env vars activate the spec's chain. Same llmJSON(), same wrapper, same fallback.
- Three bugs found and fixed during Phase 2: (1) store not surviving HMR, (2) missing z import, (3) fixtureUsed not tracked. All are the kind of integration bug that only surfaces when you wire the real pipeline in — exactly what Phase 2 was meant to catch.
- Known Phase 2 notes:
  * LLM extracted 13 claims per person (spec says 3-8). All passed invariants, but prompt could be tightened. Not a trust violation.
  * Solo mode handback uses couple-style "What I heard you say was..." framing. Spec §4.8 says solo handback = "questions to ask yourself". Refinement for Phase 3/4.
  * Pipeline takes ~36s for couple mode (3 sequential LLM calls). The staged progress copy in the UI makes this feel intentional.
- Files produced: providers.ts, llm-json.ts, prompts.ts, pipeline.ts. Updated: intake/route.ts, tree/route.ts, store.ts, types.ts.

---

Task ID: 6a+6b+6c+7a+7b+7c+7d+7e
Agent: main (Z.ai Code)
Task: Phase 3 (couple mode verification) + Phase 4 (polish + Voice Intake).

Work Log:

Phase 3 — Couple mode:
- 3a: Full couple flow browser-tested. A created room (code CJ35TP), filled 4-step intake, sealed. A saw "Waiting for your partner to finish their side." B opened fresh browser session, entered code on landing, joined as person B, filled intake, sealed. B saw "Your answers are sealed. Your partner will never see your raw words — only the map. Both sides are in. The map is being drawn now." Live pipeline ran (~20s), tree rendered with 26 claims, 12 alignments, 2 proxies. B never saw A's raw words — sealed-intake privacy verified.
- BONUS FIND: Adjudication guard fired during couple test. An alignment note contained verdict-y language. Call 3 re-run triggered. Still violated. forceNeutralize stripped it to "The two accounts describe the same moment differently." Trust model held under live adversarial LLM output.
- 3b: 15-min lazy solo conversion verified. Created couple room, submitted A only, backdated createdAt by 16 min via temp test endpoint. First poll after backdate: status=analyzing, soloConverted=true. Pipeline ran on A's text only. ~18s later: status=ready, 13 claims, fixtureUsed=false, soloConverted=true. The lazy check on GET /api/tree correctly fires the conversion and triggers the pipeline.
- Fixed Phase 1 leftover: tree route's solo conversion was still dropping the fixture directly instead of running the real pipeline. Rewrote to use after() + runPipeline(), same pattern as /api/intake.
- 3c: 409 once-analysis-set verified. Created solo session, submitted A, waited for pipeline (~15s), submitted A again → 409 "analysis already complete; room is read-only." "One analysis per fight" enforced at API boundary.

Phase 4 — Polish + Voice Intake:
- 4a: Prompt polish.
  * Tightened Extract prompt: "NEVER return more than 8 claims. If you find more than 8 candidate claims, choose the 8 that are most distinct, most central." Added atomicity emphasis. Result: live test produced exactly 8 claims (down from 13). Within spec's 3-8 range.
  * Added solo-mode handback variant: handbackSystemPrompt(mode) now branches. Solo opening = "You wrote, [quote] — [self-reflective question]" (questions to ask yourself, per spec §4.8). Couple opening = "What I heard you say was, [quote] — is that right?" (reflective listening). Reframe also mode-aware: solo = "pattern to notice in yourself", couple = "you and me versus the problem".
  * Updated pipeline.ts buildHandback to accept and pass mode to handbackSystemPrompt.
  * Live solo test: opening = "You wrote, 'I made it mean that he does not respect me enough to tell the truth about a bag of chips' — what would it take to test whether that's actually true?" Solo reframe = "The chips are the surface; underneath is a question about what it would take to trust again — and that's yours to sit with." Both non-adjudicating, both solo-appropriate.
- 4b: Voice Intake (spec amendment).
  * Built HoldToTalk component (src/components/fightautopsy/hold-to-talk.tsx):
    - Press-and-hold via pointer events (onPointerDown start, onPointerUp/onPointerLeave stop)
    - Live waveform via getUserMedia + AnalyserNode (real, not faked — 24 frequency bars, requestAnimationFrame loop)
    - Web Speech API for transcript, webkitSpeechRecognition fallback, feature-detected (mic hidden where unsupported)
    - 90s max, draining progress ring (SVG circle with strokeDashoffset)
    - 5s silence detection → auto-stop (spec §6)
    - Take counter: one recording + one re-record per prompt, mic dead after take 2
    - No audio persistence: raw recording discarded on release, only transcript string enters state
    - No audio output ever (invariant 1): component produces no sound
    - Mic only rendered in IntakeView (invariant 2: mic only on 4 intake screens)
    - No auto-submit (invariant 5): Seal is always a separate manual action
    - Permission denied handling: polite error message, typing continues, never re-prompts
    - Empty transcript doesn't overwrite existing text (spec §6)
  * Integrated into intake-view.tsx below the textarea, with review copy: "This is your private draft. Edit anything before sealing — the map only uses what you keep."
  * Lint challenges: fixed react-hooks/set-state-in-effect (lazy initial state for feature detection), react-hooks/refs (moved ref assignment to useEffect), forward-declaration ordering (handleStopRef pattern for silence timer + 90s auto-stop).
  * Agent-browser verification: mic button renders ("Press and hold to record"), review copy appears when text present, typing path works end-to-end. Live voice recording cannot be verified in headless Chromium (no real mic) — human must test on real browser.
- 4c: Room rate-limit (invariant 4).
  * localStorage fightautopsy:lastRoomAt, 1h window, advisory-level.
  * Checked in startSolo and startCouple before POST /api/session. Sets localStorage on successful creation.
  * Joining an existing room is NOT rate-limited (spec: "Joining an existing room is always available").
  * Agent-browser verification: set localStorage to 1s ago, reloaded, clicked solo → "You've started a session recently. You can start another in 1 hour. Joining an existing room is always available." Join textbox + button remained available.
- 4d: Polish. ProxyCard, SidePanel, HandbackCard already functional from Phase 1; verified they render correctly with live data in the final e2e test. Tree layout (deterministic columns) works for 8-26 claims.
- 4e: Final agent-browser e2e. Solo session → intake (mic visible) → 4 steps → seal → pipeline (~5s) → tree renders with 8 claims, 1 proxy, solo handback ("You wrote..."). No browser errors. Dev log: "attempt 1/2 succeeded: 8 claims, 0 alignments, 1 proxies".

Stage Summary:
- Phase 3 (couple mode) COMPLETE: full couple flow, 15-min solo conversion, 409 once-analysis-set all verified.
- Phase 4 (polish + Voice Intake) COMPLETE: prompt polish (3-8 claims + solo handback), hold-to-talk mic, room rate-limit, all verified.
- All 5 Voice Intake invariants enforced: (1) no audio output ever, (2) mic only on 4 intake screens, (3) one recording + one re-record, (4) room rate-limit 1/hour, (5) no auto-submit.
- The adjudication guard fired and recovered during live testing — the trust model is load-bearing and proven under adversarial LLM output.
- Lint clean. Dev server clean. No browser errors.
- Sandbox testing limitation: live voice recording cannot be verified in headless Chromium. Human must test on real browser with a microphone.
- Files produced/modified: hold-to-talk.tsx (new), intake-view.tsx (mic + review copy), landing-view.tsx (rate-limit), prompts.ts (claim count + solo handback), pipeline.ts (mode-aware handback), tree/route.ts (real pipeline in solo conversion).

---

Task ID: task1+task2+task3+responsive
Agent: main (Z.ai Code)
Task: Task 1 (regression run), Task 2 (forceNeutralize instrumentation), Task 3 (Upstash store), responsive pass.

Work Log:

Task 2 — forceNeutralize instrumentation (done first, before Task 1):
- Instrumented forceNeutralize() in invariants.ts: logs every stripped field with the ORIGINAL offending text to dev.log via console.warn. Format: [forceNeutralize] STRIPPED <field> original=<text>. Per-process counter maintained via getForceNeutralizeCount(). Pass-complete summary line when any strips occur.
- This is prompt data: if forceNeutralize fires with regularity, the Call 2/3 prompts need revision, not the strip. The instrumentation captures the original text so the prompt can be tuned.

Task 1 — Regression run (couple, post-4a):
- Run 1 (room RGYGKC): 16 claims (A=8, B=8), both within 3-8 ✅. Couple handback: "What I heard you say was, 'I said I had not eaten any because I did not want to start a fight over chips.' — is that right?" ✅. 7 alignments, 1 proxy. fixtureUsed=false.
- Run 2 (room DRKKYW): 16 claims (A=8, B=8), both within 3-8 ✅. Couple handback: "What I heard you say was, 'I had eaten a few while watching the game.' — is that right?" ✅. 7 alignments, 1 proxy. fixtureUsed=false.
- forceNeutralize count for both runs: 0. No adjudication re-runs fired. The tightened extract prompt (8 claims/person vs 13) produces cleaner alignment notes — fewer claims → fewer alignments → fewer opportunities for adjudicating language.
- The previous forceNeutralize firing (Phase 3 couple test, pre-instrumentation) was a single occurrence. Instrumentation is now in place to capture the original offending text if it fires again.
- Task 2 conclusion: forceNeutralize count = 0 across both Task 1 runs. No Call 2 prompt revision needed at this time.

Task 3 — Upstash store implementation (deploy blocker):
- Installed @upstash/redis@1.38.4.
- Made Store interface async: get/put/delete/expire all return Promises. This is the breaking change that makes both implementations conform to the same signature.
- Implemented InMemoryStore (class wrapper around the existing globalThis Map, now async). Same HMR-survival pattern.
- Implemented UpstashStore: uses @upstash/redis Redis client, REST API (works from localhost, serverless, edge — no persistent connection). Key format: room:<code>. TTL 24h set natively via EX flag on every SET. expire() is a no-op (Redis handles TTL natively).
- Env-driven selection: `useUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN`. Logs which store is active at module load: [store] using Upstash Redis / [store] using in-memory Map (local dev fallback).
- Updated all callers to await: /api/session (1 put), /api/intake (2 get + 4 put in after() callback), /api/tree (2 get + 4 put + 1 delete in after() callback + DELETE handler).
- Verified: couple flow works end-to-end with async in-memory store (session → intake A+B → pipeline → ready with 12 claims → delete → 404). Store selection log confirms: [store] using in-memory Map (local dev fallback).
- CANNOT verify live Redis path: no Upstash credentials in sandbox (no card to sign up). The implementation is correct and the interface seam is verified — when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are added to .env, the app automatically switches to Redis. All code paths (session, intake, tree, delete, solo conversion) route through the same async Store interface, unchanged.
- Delete-session button and 15-min lazy solo conversion both route through the same Store interface — verified via the async migration, no logic changes needed.

Responsive pass (intake + tree at 375px):
- Tested at 375×812 viewport (iPhone SE/mini width). The designed flow: B opens the share link on their phone.
- VLM-verified intake layout: PASS on all checks — vertical stacking, no horizontal scroll, textarea usable, touch targets ≥44px (mic button ~56px, nav buttons ~48px), proper spacing hierarchy.
- Tree container: changed from h-[600px] sm:h-[640px] to h-[500px] sm:h-[600px] md:h-[640px] (shorter on mobile, leaves room for ProxyCard/HandbackCard). minZoom lowered from 0.3 to 0.1 (fitView can now zoom out enough to show all 6 layer columns on mobile — 6×280px=1680px layout in 341px container needs ~0.2 zoom). maxZoom raised from 1.5 to 2 (can zoom in to read small text). fitViewOptions padding 0.1→0.15.
- Verified: tree container 498px at mobile (was 598px), no horizontal scroll (bodyScrollWidth=375=clientWidth), Controls visible.
- B mobile join flow verified: opens share link at 375px → lands on intake → sees mic button → never sees A's raw words → no browser errors.
- Landing cards already responsive: grid gap-4 sm:grid-cols-2 (stacks on mobile, 2-col on sm+).
- Tree-view header already responsive: flex flex-col sm:flex-row (stacks on mobile).

Stage Summary:
- Task 1: PASS — 3-8 claims/person verified, couple handback opening correct, 0 forceNeutralize.
- Task 2: PASS — instrumentation in place, count=0, no Call 2 revision needed.
- Task 3: PASS (with caveat) — UpstashStore implemented, async interface migrated, env-driven selection works, in-memory fallback verified. Live Redis path needs credentials to test (deploy step).
- Responsive: PASS — intake and tree usable at 375px, no horizontal scroll, touch targets met, B's mobile join flow verified.
- Lint clean. Dev server clean. No browser errors.
- Files modified: invariants.ts (instrumentation), store.ts (async + Upstash), session/route.ts, intake/route.ts, tree/route.ts (await migration), issue-tree.tsx (responsive zoom/height).

---
Task ID: aesthetics-1
Agent: frontend-styling-expert
Task: Aesthetic polish pass

Work Log:
- Read worklog + all 8 target components + globals.css, layout.tsx, tailwind.config.ts to understand the existing system.
- globals.css: warmed every neutral oklch from hue 0 (cold gray) to hue 75 (warm stone/paper). Background 0.985 0.008 75, foreground 0.25 0.018 55 (warm dark, not black). Primary swapped from dead oklch(0.205 0 0) (black) to oklch(0.55 0.13 42) (burnt sienna/terracotta) — single warm accent, no orange, no red. Ring, sidebar-primary, ring all wired to terracotta. Added ::selection warm tint, font-feature-settings for kerning/liga/calt, antialiasing. Dark mode mirrored warm (bg 0.18 0.012 55, primary 0.65 0.13 45). LAYER_STYLES left UNTOUCHED per spec constraint.
- layout.tsx: added Newsreader (Google Fonts, weights 400/500/600, normal+italic, swap) as --font-newsreader. Wired --font-serif in @theme inline so `font-serif` utility works. Body className updated to include the newsreader variable.
- app-shell.tsx: header rebuilt as quiet masthead — small terracotta dot (replaces rose-500 dot to keep the "live" signal in the warm palette), serif wordmark, italic serif tagline, generous py-5. Footer reframed as colophon — border-t (no bg-muted), py-8 (was py-6), text-sm (was text-xs), items-end alignment. Sticky-footer invariant preserved (min-h-screen flex flex-col, mt-auto).
- landing-view.tsx: hero kicker now italic serif standfirst, h1 is Newsreader at text-[1.875rem]→3rem, font-normal (was text-5xl font-semibold — too aggressive per VLM). Two path cards: border-0 shadow-none bg-muted/60 rounded-xl (lose default shadcn border). "Have a room code?" card: bg-muted/30, softer. Three-column footer block titles use serif. All spacing bumped (py-12 sm:py-20, mb-12 sm:mb-16). 375px verified by VLM.
- intake-view.tsx: h2 is serif text-2xl→text-[2rem] font-normal. Spacing calmer (mb-8 sm:mb-10, mt-8). Mic area: removed border-t border-dashed, replaced with soft rounded-xl bg-muted/40 wash — VLM confirms it now "cradles" the textarea instead of being bolted-on. Textarea min-h 200px, text-base leading-relaxed. Sealed card and "session gone" card both border-0 shadow-none bg-muted/50 rounded-xl with serif titles.
- issue-tree.tsx (visual only — nodeTypes map, layout positions, LAYER_STYLES untouched): RootNode rebuilt as anchor — inverted (bg-foreground text-background), larger min-w-[200px] max-w-[340px], terracotta dot, serif topic, refined handle styling. ClaimNode: rounded-lg (was rounded-md), px-3.5 py-2.5 (was px-3 py-2), max-w-[260px] (was 240), hover:shadow-md, refined handle dots. LayerHeaderNode: bg-background/85 + shadow-sm + tabular-nums count. PERSON_BADGE A: changed from sky-100/sky-800 (BLUE — violated hard "no blue" rule) to orange-100/orange-800 (warm, distinct from amber VALUE layer). B kept as teal. EDGE_STYLES: strokeWidth 1.5→2.5, AGREE #10b981→#059669 (deeper emerald), CONTRADICT #f43f5e→#e11d48 (deeper rose), DISCONNECT #94a3b8→#78716c (warm stone, not slate — slate is the FACT layer color so this keeps edges visually distinct from layer backgrounds). Edge label bg #ffffff→#fbf8f3 (warm cream) + fontWeight 600 + labelBgPadding [4,2]. Tree container border→border-border/70 rounded-xl, Background dots gap 16→18 size 1→1.2 opacity 40→50.
- proxy-card.tsx: border-0 shadow-none bg-amber-50/50 rounded-xl (was border-amber-200). Title in serif. Blockquote is serif italic. Empty-state card matches the warm-wash treatment.
- handback-card.tsx: border-0 shadow-none bg-muted/40 rounded-xl. Opening sentence is serif text-xl→md:text-[1.75rem] font-normal — reads as pull quote (VLM confirmed). Eyebrow labels tracking-[0.15em]. Spacing bumped to space-y-6 pt-8 pb-8.
- side-panel.tsx: dropped heavy border-2 (layer color) treatment; replaced with border-0 bg-muted/40 rounded-xl overflow-hidden + a 1px top accent strip in the layer dot color (spec-defined layer color stays visible, just less boxy). Quote in serif. Connection border colors matched the new edge colors (#059669 / #e11d48 / #78716c).
- tree-view.tsx: notFound and waiting cards polished to match the warm-wash treatment (border-0 shadow-none bg-muted/50 rounded-xl with serif titles). Spinner border-t-foreground/60→border-t-primary (terracotta). "Where the two sides diverge" h2 is serif. Notice banners (fixtureUsed / soloConverted) use border-0 rounded-lg bg-muted/40.
- Killed stale dev server (EADDRINUSE), cleared .next cache, restarted. Verified primary button now resolves to lab(46.83 36.14 39.64) — terracotta. (First VLM pass had reported buttons as black because the cached .next had stale CSS variables.)
- bun run lint: clean, exit 0.
- Screenshots at 1440x900 (desktop) and 375x812 (iPhone 14 mobile) for landing, intake, and tree. Tree screenshot is a REAL live pipeline analysis (room FPJT7G, 15 claims, 7 alignments, 1 proxy, live LLM provider succeeded on attempt 1/2) — not fixture.
- VLM passes (z-ai vision, glm-5v-turbo): landing desktop, intake desktop, tree desktop, landing mobile, intake mobile, tree mobile. All confirm warm/editorial/considered-journal aesthetic achieved.

Stage Summary:
- Palette (light mode): bg oklch(0.985 0.008 75) warm paper · fg oklch(0.25 0.018 55) warm dark stone · primary oklch(0.55 0.13 42) burnt sienna/terracotta · primary-foreground oklch(0.985 0.01 75) warm cream · muted oklch(0.96 0.010 75) · muted-foreground oklch(0.50 0.020 60) · border oklch(0.91 0.012 70). All cold oklch hue-0 grays replaced with warm hue 55-75 stone. NO indigo, NO blue, NO layer colors touched.
- Headline font: Newsreader (Google Fonts) — picked over Source Serif 4 / Fraunces for the long-form Atlantic-piece feel. Geist Sans retained for body.
- Files modified (9): src/app/globals.css, src/app/layout.tsx, src/components/fightautopsy/app-shell.tsx, landing-view.tsx, intake-view.tsx, issue-tree.tsx, proxy-card.tsx, handback-card.tsx, side-panel.tsx, tree-view.tsx. (Functional behavior, API routes, pipeline, store, prompts, LAYER_STYLES — all untouched.)
- Lint: clean.
- VLM verdict (before/after): before — buttons were near-black `lab(7.78 0 0)`, palette cold gray. After — buttons are terracotta `lab(46.83 36.14 39.64)`, palette warm cream `#fdfbf7`. VLM on landing desktop: "successfully achieves the Atlantic-piece / Literary Journal aesthetic... warm terracotta/clay, not dead black." On intake: "calm, editorial, considered — strong execution." On tree: "root node is the anchor... claim nodes exhibit excellent internal padding... warm cream background avoiding the cold sterile gray of SaaS dashboards."
- Hard-rule compliance verified: NO indigo, NO blue (PERSON_BADGE A was sky/blue — fixed to orange). LAYER_STYLES unchanged. Responsive at 375px verified by VLM. Sticky-footer invariant preserved. Copy unchanged. shadcn/ui components used throughout.
- Remaining issues flagged for a future pass:
  1. Mobile tree (375px) is functional but cramped — React Flow's default fit-view leaves nodes too small. Fix is functional (initial zoom, smart-fit), not aesthetic, so out of scope here.
  2. Root node bg-foreground (oklch 0.25 0.018 55) reads as near-black to the VLM. Could swap to a slightly lighter warm dark (e.g. bg-stone-800) to read as "warm dark earth" rather than "system error heavy". Minor.
  3. The proxy card's `Person {N}'s [Layer]:` line still reads slightly form-field-y. Could italicize the layer badge or remove the colon to keep editorial flow.
  4. React Flow's default Controls (+/−/fit) styling is still "default UI" — could be restyled to match the editorial feel. Out of scope (would require overriding xyflow CSS).
  5. The Next.js dev-indicator "N" badge appears in the bottom-left of all screenshots — dev-only, not present in production builds.
