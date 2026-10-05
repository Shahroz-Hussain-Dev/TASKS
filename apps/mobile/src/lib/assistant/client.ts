/**
 * Client for POST /api/assistant/chat. Uses fetch directly because the typed
 * `request()` helper has no custom-header slot and this call needs the
 * optional `X-Assistant-Key` with the user's own Gemini key.
 */
import type { LatLng } from "@raahi/shared";
import { api, ApiRequestError, getTokens } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/config";
import { getAssistantSettings } from "./settings";

export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantAction {
  type: "navigate" | "request_created" | "request_updated" | "request_cancelled" | "driver_presence";
  to?: string;
  requestId?: string;
  rideId?: string;
  online?: boolean;
}

export interface AssistantReply {
  reply: string;
  actions: AssistantAction[];
  suggestions: string[];
  trace: { tool: string; ok: boolean }[];
}

export interface ChatOptions {
  location?: LatLng | null;
  /** Override the saved key (used by "Test key" in Settings). */
  apiKey?: string;
  signal?: AbortSignal;
}

const MAX_TURNS = 16;

async function post(body: unknown, apiKey: string, signal?: AbortSignal): Promise<Response> {
  const base = getApiBaseUrl();
  const url = new URL("/api/assistant/chat", base || window.location.origin);
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json", "X-App-Version": "1.0.0" };
  const t = getTokens();
  if (t?.accessToken) headers.Authorization = `Bearer ${t.accessToken}`;
  if (apiKey) headers["X-Assistant-Key"] = apiKey;
  try {
    return await fetch(url.toString(), { method: "POST", headers, body: JSON.stringify(body), signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiRequestError(0, "network", base ? "Can't reach Raahi servers. Check your internet, or the server address under Profile → Settings." : "Server address is not configured.");
  }
}

/** One assistant turn. Sends the last 16 messages plus the current position. */
export async function chat(messages: AssistantTurn[], opts: ChatOptions = {}): Promise<AssistantReply> {
  const turns = messages
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, 1000) }))
    .filter((m) => m.text.length > 0)
    .slice(-MAX_TURNS);
  if (turns.length === 0) throw new ApiRequestError(400, "empty", "Say or type something first.");
  const apiKey = (opts.apiKey ?? getAssistantSettings().apiKey).trim();
  const body = { messages: turns, location: opts.location ? { lat: opts.location.lat, lng: opts.location.lng } : null };

  let res = await post(body, apiKey, opts.signal);
  if (res.status === 401 && getTokens()?.refreshToken) {
    // Let the typed client refresh the session, then retry once with the new token.
    await api.me.get().catch(() => undefined);
    res = await post(body, apiKey, opts.signal);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    const friendly =
      res.status === 429
        ? "Buddy needs a short breather. Try again in a minute."
        : res.status === 503
          ? "The assistant is not set up on this server yet. Add your own Gemini key in Settings."
          : e?.message ?? `Buddy couldn't answer (${res.status}).`;
    throw new ApiRequestError(res.status, e?.code ?? "http_error", friendly, e?.details);
  }
  const d = (data ?? {}) as Partial<AssistantReply>;
  return {
    reply: typeof d.reply === "string" && d.reply.trim() ? d.reply.trim() : "Sorry, I did not catch that. Could you say it again?",
    actions: Array.isArray(d.actions) ? d.actions : [],
    suggestions: Array.isArray(d.suggestions) ? d.suggestions.filter((s): s is string => typeof s === "string").slice(0, 3) : [],
    trace: Array.isArray(d.trace) ? d.trace : [],
  };
}
