// POST /api/intake  { code, person, answers }
//
// Spec §4.4: safety check → write intake → if solo or both done: run pipeline
//   async → { ok }
// Spec: "One analysis per fight": once analysis is set, return 409.
//
// Phase 2: runs the real LLM pipeline (runPipeline) asynchronously when the
// trigger condition is met. The pipeline updates room.analysis when done;
// /api/tree polls and shows "analyzing" → "ready".

import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { roomStore } from "@/lib/fightautopsy/store";
import { IntakeAnswersSchema } from "@/lib/fightautopsy/schemas";
import { scanIntake } from "@/lib/fightautopsy/safety";
import { runPipeline } from "@/lib/fightautopsy/pipeline";
import { getDefaultFixture } from "@/lib/fightautopsy/fixtures";
import type { Person } from "@/lib/fightautopsy/types";

const Body = z.object({
  code: z.string().length(6),
  person: z.enum(["A", "B"]),
  answers: IntakeAnswersSchema,
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { code, person, answers } = parsed.data;

  const room = await roomStore.get(code);
  if (!room) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  // One analysis per fight — room is read-only once analysis exists.
  if (room.analysis) {
    return NextResponse.json(
      { error: "analysis already complete; room is read-only" },
      { status: 409 },
    );
  }

  // Safety check BEFORE writing intake. Provider-independent (spec §4.7).
  const safety = scanIntake(answers);
  if (safety.blocked) {
    return NextResponse.json(
      { error: "safety_block", safety },
      { status: 422 },
    );
  }

  // Write intake for this person.
  room.intake[person as Person] = { done: true, answers };
  await roomStore.put(room);

  // Trigger condition: solo (A done) or couple (both done).
  const bothDone =
    room.intake.A.done && (room.mode === "solo" ? true : room.intake.B.done);

  if (bothDone && !room.analysis && !room.pipelineRunning) {
    // Mark pipeline as running and persist immediately so /api/tree sees
    // "analyzing" on the next poll.
    room.pipelineRunning = true;
    await roomStore.put(room);

    const intakeA = room.intake.A.answers;
    const intakeB = room.mode === "couple" ? room.intake.B.answers : undefined;
    const mode = room.mode;

    // Run the pipeline after the response is sent. `after()` keeps the
    // function alive on Vercel; in the sandbox dev server it just runs.
    after(async () => {
      try {
        const result = await runPipeline({
          mode,
          intakeA: intakeA!,
          intakeB: intakeB ?? undefined,
        });
        const r = await roomStore.get(code);
        if (!r) return; // room was deleted
        r.analysis = result.analysis;
        r.pipelineRunning = false;
        r.fixtureUsed = result.fixtureUsed;
        await roomStore.put(r);
        console.log(
          `[intake] pipeline complete for room ${code}: fixture=${result.fixtureUsed}, provider=${result.providerUsed}`,
        );
      } catch (e) {
        // The pipeline catches its own errors and returns a fixture on 2
        // failures. This catch is for truly unexpected errors (store I/O,
        // etc.) — fall back to fixture so the room never hangs.
        console.error(
          `[intake] unexpected pipeline error for room ${code}:`,
          e,
        );
        const r = await roomStore.get(code);
        if (!r) return;
        r.analysis = getDefaultFixture().analysis;
        r.pipelineRunning = false;
        r.fixtureUsed = true;
        await roomStore.put(r);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
