// POST /api/session  { mode } → { code }
//
// Creates a room. Phase 1: just stores the doc. Phase 2 will trigger the
// pipeline when intake completes.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateRoomCode, roomStore } from "@/lib/fightautopsy/store";
import type { Mode } from "@/lib/fightautopsy/types";

const Body = z.object({
  mode: z.enum(["solo", "couple"]),
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
  const mode: Mode = parsed.data.mode;
  const code = generateRoomCode();
  await roomStore.put({
    code,
    mode,
    createdAt: Date.now(),
    intake: {
      A: { done: false, answers: null },
      B: { done: false, answers: null },
    },
  });
  return NextResponse.json({ code, mode });
}
