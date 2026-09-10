// LLM provider chain — spec §4.1 + §4.5.
//
// Per the locked decision with the user: the spec's fallback chain
// (Groq → Gemini → OpenRouter) is preserved verbatim. Z.ai SDK is added as
// one more provider inside the same chain. `LLM_PROVIDER_1=zai` in sandbox;
// `LLM_PROVIDER_1=groq, LLM_PROVIDER_2=gemini, LLM_PROVIDER_3=openrouter`
// via env vars on Vercel deploy. Fixture fallback stays terminal.
//
// Each provider implements one method: callRaw(), returning the raw text
// response. llmJSON() handles fence-stripping, zod parsing, retries, and
// provider fallback on top of this interface.

import ZAI from "z-ai-web-dev-sdk";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallParams {
  messages: LLMMessage[];
  temperature: number;
  /** Hint to the provider that JSON output is wanted. */
  json?: boolean;
}

export interface LLMProvider {
  name: string;
  available: boolean;
  callRaw(params: LLMCallParams): Promise<string>;
}

// --- Z.ai provider (sandbox default) ---------------------------------------

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

class ZaiProvider implements LLMProvider {
  name = "zai";
  available = true; // always available in this env
  async callRaw(params: LLMCallParams): Promise<string> {
    const zai = await getZai();
    // The Z.ai SDK uses role "assistant" for system prompts and a separate
    // thinking flag. We map our generic LLMMessage[] to its shape.
    const messages = params.messages.map((m) => ({
      role: m.role === "system" ? ("assistant" as const) : m.role,
      content: m.content,
    }));
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("zai: empty response");
    return content;
  }
}

// --- Groq provider (deploy) ------------------------------------------------

class GroqProvider implements LLMProvider {
  name = "groq";
  available = !!process.env.GROQ_API_KEY;
  async callRaw(params: LLMCallParams): Promise<string> {
    if (!process.env.GROQ_API_KEY) throw new Error("groq: no API key");
    const model = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature,
        ...(params.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`groq: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("groq: empty response");
    return content;
  }
}

// --- Gemini provider (deploy) ----------------------------------------------

class GeminiProvider implements LLMProvider {
  name = "gemini";
  available = !!process.env.GEMINI_API_KEY;
  async callRaw(params: LLMCallParams): Promise<string> {
    if (!process.env.GEMINI_API_KEY) throw new Error("gemini: no API key");
    const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
    // Gemini's generateContent endpoint expects contents[] with role
    // "user"/"model". We fold system into the first user message as a prefix
    // because Gemini handles systemInstruction separately; this is simpler.
    const sys = params.messages.find((m) => m.role === "system")?.content ?? "";
    const rest = params.messages.filter((m) => m.role !== "system");
    const contents = rest.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: (m === rest[0] && sys ? sys + "\n\n" : "") + m.content }],
    }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: params.temperature,
          ...(params.json
            ? { responseMimeType: "application/json" }
            : {}),
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`gemini: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!content) throw new Error("gemini: empty response");
    return content;
  }
}

// --- OpenRouter provider (deploy, :free models) ----------------------------

class OpenRouterProvider implements LLMProvider {
  name = "openrouter";
  available = !!process.env.OPENROUTER_API_KEY;
  async callRaw(params: LLMCallParams): Promise<string> {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("openrouter: no API key");
    const model =
      process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.1-8b-instruct:free";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature,
        ...(params.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`openrouter: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("openrouter: empty response");
    return content;
  }
}

// --- Provider registry + env-driven chain ----------------------------------

const PROVIDERS: Record<string, () => LLMProvider> = {
  zai: () => new ZaiProvider(),
  groq: () => new GroqProvider(),
  gemini: () => new GeminiProvider(),
  openrouter: () => new OpenRouterProvider(),
};

/**
 * Build the provider chain from env vars LLM_PROVIDER_1, _2, _3.
 * Defaults to ["zai"] when none set (sandbox default).
 * Unavailable providers (no API key) are still included in the chain so
 * that the chain shape matches deploy — they'll just throw immediately and
 * llmJSON will fall through to the next.
 */
export function getProviderChain(): LLMProvider[] {
  const names: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const n = process.env[`LLM_PROVIDER_${i}`];
    if (n && n.trim()) names.push(n.trim().toLowerCase());
  }
  if (names.length === 0) names.push("zai"); // sandbox default
  return names
    .map((n) => {
      const factory = PROVIDERS[n];
      if (!factory) {
        console.warn(`[llm] unknown provider "${n}" in LLM_PROVIDER chain, skipping`);
        return null;
      }
      return factory();
    })
    .filter((p): p is LLMProvider => p !== null);
}
