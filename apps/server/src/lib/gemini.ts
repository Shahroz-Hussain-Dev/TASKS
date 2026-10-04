import { env } from "./env";
import { serviceUnavailable } from "./errors";

/**
 * Thin client for the Gemini Developer API (generativelanguage.googleapis.com).
 * We call REST directly to keep the serverless bundle small and dependency-free.
 */

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
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

export function geminiEnabled() {
  return Boolean(env().GEMINI_API_KEY);
}

export async function generate(messages: GeminiMessage[], opts: GenerateOptions = {}): Promise<string> {
  const e = env();
  if (!e.GEMINI_API_KEY) throw serviceUnavailable("AI service is not configured");
  const model = opts.model ?? e.GEMINI_MODEL;
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
      headers: { "Content-Type": "application/json", "x-goog-api-key": e.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[gemini] error", res.status, text.slice(0, 500));
      if (res.status === 429) throw serviceUnavailable("AI service is busy. Please try again in a moment.");
      throw serviceUnavailable("AI service error");
    }
    const data = (await res.json()) as {
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

/** Streaming variant for the support chat. Yields text deltas. */
export async function* generateStream(messages: GeminiMessage[], opts: GenerateOptions = {}): AsyncGenerator<string> {
  const e = env();
  if (!e.GEMINI_API_KEY) throw serviceUnavailable("AI service is not configured");
  const model = opts.model ?? e.GEMINI_MODEL;
  const body: Record<string, unknown> = {
    contents: messages,
    generationConfig: { temperature: opts.temperature ?? 0.6, maxOutputTokens: opts.maxOutputTokens ?? 800 },
  };
  if (opts.systemInstruction) body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  const res = await fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": e.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    console.error("[gemini] stream error", res.status, text.slice(0, 300));
    throw serviceUnavailable(res.status === 429 ? "AI service is busy. Please try again in a moment." : "AI service error");
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
