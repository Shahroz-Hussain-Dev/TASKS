import { env } from "./env";
import { serviceUnavailable } from "./errors";

/**
 * Thin client for the Gemini Developer API (generativelanguage.googleapis.com).
 * We call REST directly to keep the serverless bundle small and dependency-free.
 */

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  /** Gemini 3 models require this to be echoed back with the functionCall it came with. */
  thoughtSignature?: string;
}

export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GenerateOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Force JSON output; optionally with a response schema. */
  json?: boolean;
  responseSchema?: Record<string, unknown>;
  timeoutMs?: number;
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Free-tier quotas are per model per day, so a busy day on one model must not
 * take the whole product down. Each call tries the requested model first and
 * then the fallback chain; models that returned a quota error are skipped for
 * a cooldown period on this instance.
 */
const DEFAULT_FALLBACKS = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];
const exhausted = new Map<string, number>();
const COOLDOWN_MS = 10 * 60_000;

export class GeminiQuotaError extends Error {
  constructor(public model: string) {
    super(`quota exhausted for ${model}`);
  }
}

function modelChain(preferred: string): string[] {
  const extra = (process.env.GEMINI_MODEL_FALLBACKS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const chain = [preferred, ...(extra.length ? extra : DEFAULT_FALLBACKS)];
  const now = Date.now();
  const live = chain.filter((m, i) => chain.indexOf(m) === i && (exhausted.get(m) ?? 0) < now);
  return live.length ? live : [preferred];
}

async function withModelFallback<T>(preferred: string, fn: (model: string) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (const model of modelChain(preferred)) {
    try {
      return await fn(model);
    } catch (err) {
      lastErr = err;
      if (err instanceof GeminiQuotaError) {
        exhausted.set(model, Date.now() + COOLDOWN_MS);
        console.warn(`[gemini] ${model} quota exhausted — trying next model`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof GeminiQuotaError ? serviceUnavailable("AI service is busy. Please try again in a moment.") : lastErr;
}

/**
 * A timed-out or unreachable upstream must surface as a 503 ApiError: callers
 * such as document verification park the upload for manual review on 5xx
 * ApiErrors, whereas a raw AbortError would bubble up as an unhandled 500.
 */
function timeoutOrNetwork(err: unknown, model: string): Error {
  const aborted = err instanceof Error && err.name === "AbortError";
  console.error(`[gemini] ${model} ${aborted ? "timed out" : "unreachable"}`, err instanceof Error ? err.message : err);
  return serviceUnavailable(aborted ? "AI service is taking too long. Please try again in a moment." : "AI service is unreachable right now.");
}

export function geminiEnabled() {
  return Boolean(env().GEMINI_API_KEY);
}

export async function generate(messages: GeminiMessage[], opts: GenerateOptions = {}): Promise<string> {
  const e = env();
  if (!e.GEMINI_API_KEY) throw serviceUnavailable("AI service is not configured");
  const key = e.GEMINI_API_KEY;
  return withModelFallback(opts.model ?? e.GEMINI_MODEL, (model) => generateOnce(model, key, messages, opts));
}

async function generateOnce(model: string, key: string, messages: GeminiMessage[], opts: GenerateOptions): Promise<string> {
  const body: Record<string, unknown> = {
    contents: messages,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };
  if (opts.systemInstruction) body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
  try {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    }).catch((err: unknown) => {
      throw timeoutOrNetwork(err, model);
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[gemini] error", res.status, text.slice(0, 500));
      if (res.status === 429) throw new GeminiQuotaError(model);
      throw serviceUnavailable("AI service error");
    }
    const data = (await res.json().catch((err: unknown) => {
      throw timeoutOrNetwork(err, model);
    })) as {
      candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (data.promptFeedback?.blockReason) throw serviceUnavailable("The AI declined to process this content");
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? "").join("").trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Low-level call that returns the raw candidate parts (text + function calls),
 * used by the voice assistant's tool loop. `apiKey` lets a user-supplied key
 * (Settings → AI assistant) replace the server key for that request.
 */
export async function generateParts(
  messages: GeminiMessage[],
  opts: GenerateOptions & { tools?: unknown[]; apiKey?: string } = {},
): Promise<GeminiPart[]> {
  const e = env();
  const key = opts.apiKey || e.GEMINI_API_KEY;
  if (!key) throw serviceUnavailable("AI service is not configured");
  return withModelFallback(opts.model ?? e.GEMINI_MODEL, (model) => generatePartsOnce(model, key, messages, opts));
}

async function generatePartsOnce(model: string, key: string, messages: GeminiMessage[], opts: GenerateOptions & { tools?: unknown[] }): Promise<GeminiPart[]> {
  const body: Record<string, unknown> = {
    contents: messages,
    generationConfig: { temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxOutputTokens ?? 1024 },
  };
  if (opts.systemInstruction) body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  if (opts.tools) body.tools = [{ functionDeclarations: opts.tools }];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    }).catch((err: unknown) => {
      throw timeoutOrNetwork(err, model);
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[gemini] error", res.status, text.slice(0, 300));
      if (res.status === 403 || (res.status === 400 && /api key/i.test(text))) throw serviceUnavailable("The AI key was rejected. Check the key in Settings.");
      if (res.status === 429) throw new GeminiQuotaError(model);
      throw serviceUnavailable("AI service error");
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: GeminiPart[] } }[]; promptFeedback?: { blockReason?: string } };
    if (data.promptFeedback?.blockReason) throw serviceUnavailable("The AI declined to process this request");
    return data.candidates?.[0]?.content?.parts ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/** Streaming variant for the support chat. Yields text deltas. */
export async function* generateStream(messages: GeminiMessage[], opts: GenerateOptions = {}): AsyncGenerator<string> {
  const e = env();
  if (!e.GEMINI_API_KEY) throw serviceUnavailable("AI service is not configured");
  const body: Record<string, unknown> = {
    contents: messages,
    generationConfig: { temperature: opts.temperature ?? 0.6, maxOutputTokens: opts.maxOutputTokens ?? 800 },
  };
  if (opts.systemInstruction) body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  let res: Response | null = null;
  for (const model of modelChain(opts.model ?? e.GEMINI_MODEL)) {
    const attempt = await fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": e.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    if (attempt.status === 429) {
      exhausted.set(model, Date.now() + COOLDOWN_MS);
      console.warn(`[gemini] ${model} quota exhausted (stream) — trying next model`);
      await attempt.text().catch(() => "");
      continue;
    }
    res = attempt;
    break;
  }
  if (!res) throw serviceUnavailable("AI service is busy. Please try again in a moment.");
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    console.error("[gemini] stream error", res.status, text.slice(0, 300));
    throw serviceUnavailable("AI service error");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (text) yield text;
      } catch {
        /* partial line; ignore */
      }
    }
  }
}

/** Parse JSON from a model response that might be wrapped in a code fence. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}
