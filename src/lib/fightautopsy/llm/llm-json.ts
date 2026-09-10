// llmJSON() — spec §4.5.
//
// "All calls: llmJSON() wrapper with 3 retries, JSON-fence stripping, zod
// parse, provider fallback chain (Groq → Gemini → OpenRouter)."
//
// Behavior:
//   1. For each provider in the chain (env-driven, sandbox = [zai]):
//      a. Try up to 3 attempts.
//      b. Each attempt: callRaw → stripFences → zod.parse.
//      c. On parse failure, the next attempt gets a "prompt-repair" suffix
//         telling the model its last response was invalid JSON and to retry.
//   2. If a provider throws (network, auth, 429), fall through to the next.
//   3. If all providers exhausted, throw — the pipeline catches and routes
//      to fixture fallback.
//
// The fence-stripping is load-bearing: the Z.ai SDK smoke test confirmed it
// wraps JSON in ```json fences. Without stripping, every call would fail.

import { z } from "zod";
import { getProviderChain, type LLMMessage, type LLMProvider } from "./providers";

export interface LlmJSONOptions {
  messages: LLMMessage[];
  temperature: number;
  schema: z.ZodTypeAny;
  /** Max retries per provider before falling through. Default 3. */
  retriesPerProvider?: number;
}

export interface LlmJSONResult<T> {
  data: T;
  provider: string;
  attempts: number;
}

/**
 * Strip Markdown JSON fences from a model response. Handles:
 *   ```json\n{...}\n```
 *   ```\n{...}\n```
 *   {...}  (no fences — passthrough)
 * Also strips leading/trailing prose around a JSON object, conservatively:
 * if the string contains a { ... } block, extract it.
 */
export function stripFences(raw: string): string {
  let s = raw.trim();
  // Remove ```json or ``` prefix
  const fenceStart = s.match(/^```(?:json)?\s*\n?/i);
  if (fenceStart) {
    s = s.slice(fenceStart[0].length);
  }
  // Remove trailing ```
  s = s.replace(/\n?```\s*$/, "");
  // If there's still prose around a JSON object, try to extract the outermost
  // { ... } block. This handles "Here is the JSON: {...}".
  if (s && !s.startsWith("{") && !s.startsWith("[")) {
    const braceStart = s.indexOf("{");
    const bracketStart = s.indexOf("[");
    let start = -1;
    if (braceStart >= 0 && bracketStart >= 0) {
      start = Math.min(braceStart, bracketStart);
    } else if (braceStart >= 0) {
      start = braceStart;
    } else if (bracketStart >= 0) {
      start = bracketStart;
    }
    if (start >= 0) {
      // Find matching close by counting depth from start.
      const open = s[start];
      const close = open === "{" ? "}" : "]";
      let depth = 0;
      let end = -1;
      for (let i = start; i < s.length; i++) {
        if (s[i] === open) depth++;
        else if (s[i] === close) {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end > start) {
        s = s.slice(start, end + 1);
      }
    }
  }
  return s.trim();
}

/**
 * Try to parse + validate. Returns {ok, data} or {ok:false, error, raw}.
 */
function tryParse<T>(raw: string, schema: z.ZodType<T>):
  { ok: true; data: T } | { ok: false; error: string; raw: string } {
  const stripped = stripFences(raw);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (e) {
    return {
      ok: false,
      error: `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
      raw: stripped,
    };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: `zod parse failed: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
      raw: stripped,
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * The llmJSON wrapper. Iterates the provider chain; each provider gets up to
 * `retriesPerProvider` attempts. On parse failure, the retry includes a
 * prompt-repair suffix. On provider error (network/auth/429), falls through
 * to the next provider.
 */
export async function llmJSON<T>(
  opts: LlmJSONOptions,
  schema: z.ZodType<T>,
): Promise<LlmJSONResult<T>> {
  const providers = getProviderChain();
  if (providers.length === 0) {
    throw new Error("llmJSON: no providers available");
  }
  const retries = opts.retriesPerProvider ?? 3;
  let lastError: Error | null = null;
  let totalAttempts = 0;

  for (const provider of providers) {
    if (!provider.available) {
      // Skip unavailable providers but note them; the chain shape still
      // matches deploy.
      continue;
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
      totalAttempts++;
      try {
        const messages = [...opts.messages];
        // Prompt repair: on retry, append a system note about the prior failure.
        if (attempt > 1 && lastError) {
          messages.push({
            role: "user",
            content: `Your previous response was not valid JSON or did not match the required schema. Error: ${lastError.message}. Please respond with ONLY the JSON object, no prose, no code fences, matching the schema exactly.`,
          });
        }
        const raw = await provider.callRaw({
          messages,
          temperature: opts.temperature,
          json: true,
        });
        const result = tryParse(raw, schema);
        if (result.ok) {
          return {
            data: result.data,
            provider: provider.name,
            attempts: totalAttempts,
          };
        }
        lastError = new Error(result.error);
        // Log for debugging (server-side only)
        console.warn(
          `[llmJSON] ${provider.name} attempt ${attempt}/${retries} parse failed: ${result.error}`,
        );
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(
          `[llmJSON] ${provider.name} attempt ${attempt}/${retries} threw: ${lastError.message}`,
        );
        // Provider-level error (network, auth, 429) — break to next provider
        // rather than retrying the same dead provider.
        break;
      }
    }
  }

  throw lastError ?? new Error("llmJSON: all providers exhausted");
}

// Re-export for convenience
export type { LLMMessage, LLMProvider };
