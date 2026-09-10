// FightAutopsy — ephemeral store.
//
// The Store interface is the seam spec §8 calls out: "the store interface is
// the only seam." Two implementations:
//
//   1. InMemoryStore (default when no Upstash env vars): in-memory Map behind
//      globalThis for HMR survival. Fine for local dev; flaky across cold
//      starts on serverless.
//   2. UpstashStore (when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//      are present): Redis REST API, TTL 24h set natively on every key, no
//      cold-start data loss. This is the deploy target.
//
// Selection is env-driven at module load. The rest of the app (API routes,
// pipeline, delete button, solo conversion) calls the same async interface
// regardless of which implementation is active.

import { Redis } from "@upstash/redis";
import type { RoomDoc } from "./types";

// 24h TTL — spec §1 trust design, §4.7 hard TTL.
const TTL_MS = 24 * 60 * 60 * 1000;
const TTL_SECONDS = Math.floor(TTL_MS / 1000);

// 15-min solo conversion window — spec §4.8.
const SOLO_CONVERSION_MS = 15 * 60 * 1000;

// --- Store interface (async — both implementations conform) ---------------

export interface Store {
  get(code: string): Promise<RoomDoc | undefined>;
  put(doc: RoomDoc): Promise<void>;
  delete(code: string): Promise<void>;
  /** Lazily expire. In-memory: drops old rooms. Upstash: no-op (TTL is native). */
  expire(): Promise<void>;
}

// --- In-memory implementation (local dev fallback) -------------------------

// Use globalThis so the Map survives HMR module re-evaluation in dev mode.
const g = globalThis as unknown as {
  __fightautopsyStore?: Map<string, RoomDoc>;
};
const memStore: Map<string, RoomDoc> = g.__fightautopsyStore ?? new Map();
if (!g.__fightautopsyStore) {
  g.__fightautopsyStore = memStore;
}

class InMemoryStore implements Store {
  async get(code: string): Promise<RoomDoc | undefined> {
    await this.expire();
    return memStore.get(code);
  }
  async put(doc: RoomDoc): Promise<void> {
    memStore.set(doc.code, doc);
  }
  async delete(code: string): Promise<void> {
    memStore.delete(code);
  }
  async expire(): Promise<void> {
    const now = Date.now();
    for (const [code, doc] of memStore.entries()) {
      if (now - doc.createdAt > TTL_MS) {
        memStore.delete(code);
      }
    }
  }
}

// --- Upstash Redis implementation (deploy target) --------------------------

class UpstashStore implements Store {
  private redis: Redis;
  private keyPrefix = "room:";

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async get(code: string): Promise<RoomDoc | undefined> {
    const raw = await this.redis.get<string>(this.keyPrefix + code);
    if (!raw) return undefined;
    try {
      // Upstash returns the stored string; we JSON.parse it back to RoomDoc.
      // If we stored via set() with a JSON string, redis.get returns the string.
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return parsed as RoomDoc;
    } catch {
      console.warn(`[upstash] failed to parse room ${code}`);
      return undefined;
    }
  }

  async put(doc: RoomDoc): Promise<void> {
    // SET with EX (TTL in seconds). Every write refreshes the 24h TTL.
    await this.redis.set(this.keyPrefix + doc.code, JSON.stringify(doc), {
      ex: TTL_SECONDS,
    });
  }

  async delete(code: string): Promise<void> {
    await this.redis.del(this.keyPrefix + code);
  }

  async expire(): Promise<void> {
    // No-op: Redis handles TTL natively via the EX flag on SET.
  }
}

// --- Env-driven selection --------------------------------------------------

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

export const roomStore: Store = useUpstash
  ? new UpstashStore()
  : new InMemoryStore();

if (useUpstash) {
  console.log("[store] using Upstash Redis");
} else {
  console.log("[store] using in-memory Map (local dev fallback)");
}

export const TTL = { TTL_MS, SOLO_CONVERSION_MS };

// Generate a 6-char room code. Alphabet excludes ambiguous chars (0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateRoomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}
