// GET /api/tree  ?code[&demo=1]
//
// Spec §4.4: polled every 2s. Returns waiting | waiting_for_B | analyzing | ready.
// Spec §4.8: demo=1 → return fixture immediately; OR 2 pipeline failures →
//   fixture. Both paths route through zod-on-load (the fixture loader already
//   does this at module load time).
//
// Lazy solo conversion (spec §4.8): on GET, if couple room, B never joined,
// and 15 min have passed, convert to solo and trigger the real pipeline on A.

import { after, NextResponse, type NextRequest } from "next/server";
import { roomStore, TTL } from "@/lib/fightautopsy/store";
import { getDefaultFixture } from "@/lib/fightautopsy/fixtures";
import { runPipeline } from "@/lib/fightautopsy/pipeline";
import type { TreeResponse } from "@/lib/fightautopsy/types";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const demo = url.searchParams.get("demo") === "1";

  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  // demo=1 → return fixture immediately (spec §4.8). This check happens
  // BEFORE the room lookup: the demo path must work even if no room exists
  // (e.g. for standalone demo links).
  if (demo) {
    const resp: TreeResponse = {
      status: "ready",
      analysis: getDefaultFixture().analysis,
      fixtureUsed: true,
    };
    return NextResponse.json(resp);
  }

  const room = await roomStore.get(code);
  if (!room) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  // Lazy solo conversion (spec §4.8): if couple room, B never joined, and
  // 15 min have passed, convert to solo and trigger the real pipeline on A.
  // The pipeline runs via after() so this response returns immediately with
  // status=analyzing; subsequent polls see the analysis when it completes.
  if (
    room.mode === "couple" &&
    !room.intake.B.done &&
    !room.analysis &&
    !room.pipelineRunning &&
    Date.now() - room.createdAt > TTL.SOLO_CONVERSION_MS
  ) {
    room.mode = "solo";
    room.soloConverted = true;
    room.pipelineRunning = true;
    await roomStore.put(room);

    const intakeA = room.intake.A.answers;
    after(async () => {
      try {
        const result = await runPipeline({
          mode: "solo",
          intakeA: intakeA!,
          intakeB: undefined,
        });
        const r = await roomStore.get(code);
        if (!r) return;
        r.analysis = result.analysis;
        r.pipelineRunning = false;
        r.fixtureUsed = result.fixtureUsed;
        await roomStore.put(r);
        console.log(
          `[tree] solo-conversion pipeline complete for room ${code}: fixture=${result.fixtureUsed}`,
        );
      } catch (e) {
        console.error(
          `[tree] solo-conversion pipeline error for room ${code}:`,
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

  let status: TreeResponse["status"];
  if (room.analysis) {
    status = "ready";
  } else if (room.pipelineRunning) {
    status = "analyzing";
  } else if (room.mode === "couple" && room.intake.A.done && !room.intake.B.done) {
    status = "waiting_for_B";
  } else {
    status = "waiting";
  }

  const resp: TreeResponse = {
    status,
    analysis: room.analysis,
    soloConverted: room.soloConverted,
    fixtureUsed: room.fixtureUsed ?? false,
  };
  return NextResponse.json(resp);
}

// DELETE /api/tree?code=... — manual session delete (spec §4.7 hard TTL +
// "Delete this session now" button in footer).
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }
  await roomStore.delete(code);
  return NextResponse.json({ ok: true });
}
