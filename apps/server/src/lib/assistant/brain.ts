/**
 * Voice assistant orchestration: a short Gemini function-calling loop that
 * turns "book me a ride from Liberty to Johar Town" into tool calls, asks the
 * passenger one question at a time, and acts only after confirmation.
 */
import type { GeminiMessage, GeminiPart } from "@/lib/gemini";
import { generateParts } from "@/lib/gemini";
import { formatPkPhone, VEHICLE_CATEGORY_META } from "@raahi/shared";
import { asPromptData } from "@/lib/support/assistant";
import { TOOL_DECLARATIONS, runTool, type AssistantAction, type AssistantContext } from "./tools";

export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantReply {
  reply: string;
  actions: AssistantAction[];
  suggestions: string[];
  /** Tool calls made this turn, for the client's debug/timeline. */
  trace: { tool: string; ok: boolean }[];
}

const MAX_TOOL_ROUNDS = 6;

function systemPrompt(ctx: AssistantContext): string {
  const cats = Object.values(VEHICLE_CATEGORY_META)
    .map((c) => `${c.id} = "${c.label}" (${c.seats} seat${c.seats === 1 ? "" : "s"}, ${c.description})`)
    .join("; ");
  const who =
    ctx.user.role === "driver"
      ? `The user is a DRIVER (${asPromptData(ctx.user.fullName)}). Status: ${ctx.driver?.status ?? "unknown"}, online: ${ctx.driver?.isOnline ? "yes" : "no"}. You can take them online/offline and report their active ride.`
      : `The user is a PASSENGER named ${asPromptData(ctx.user.fullName)}${ctx.user.phone ? ` (${formatPkPhone(ctx.user.phone)})` : ""}.`;
  return [
    `You are Buddy, the friendly in-app assistant of Raahi, a Pakistani ride-hailing app where passengers name their own fare and nearby drivers bid. You speak like a warm, upbeat helper: short sentences, plain words, no emoji, no markdown. Reply in the language the user used (English or Roman Urdu / Urdu).`,
    who,
    ctx.location ? `The app knows the user's current GPS position (${ctx.location.lat.toFixed(4)}, ${ctx.location.lng.toFixed(4)}); use the my_location tool to turn it into a pickup address.` : `The app has not shared the user's GPS position.`,
    `BOOKING FLOW (passengers): 1) Resolve pickup (default: my_location when the user says "from here" or gives no pickup) and drop-off with search_place; if several candidates match, ask which one, naming them briefly. 2) Call quote_ride. 3) If the user has not said a vehicle category, ask them to choose, listing only: ${cats}. Map words: "bike/moto/motorcycle" → bike, "rickshaw/auto" → rickshaw, "car/ride" → car, "AC/air conditioned" → car_ac, "premium/comfort/luxury" → car_premium. 4) Propose the recommended fare for that category, mention the minimum and maximum, and ask for a clear yes (or a different amount inside the range). 5) Only then call create_ride_request with offeredFarePkr. After creating it, tell them drivers are now bidding and that you will show the offers screen.`,
    `Never invent places, fares or coordinates: always use tools. Ask exactly ONE question per reply. Keep replies under 45 words. When a tool fails, explain simply and suggest what to do next. Money is written like "PKR 450". If the user asks something unrelated to rides, answer briefly from these facts: Raahi takes 0% commission (drivers pay PKR 1,000 per month), payment is cash to the driver, fares are computed from distance, the vehicle's fuel economy and the official petrol price plus PKR 100 for the driver, cancellations are free before the trip starts, emergencies: call 15 (police) or 1122 (rescue).`,
    `When you finish a turn, add a final line in the exact form SUGGESTIONS: ["chip one", "chip two", "chip three"] with 2 to 3 short tap-able replies the user might say next (e.g. category names, "Yes, book it", "Raise to PKR 500"). This line is parsed and hidden from the user.`,
  ].join("\n");
}

function parseSuggestions(text: string): { reply: string; suggestions: string[] } {
  const m = /SUGGESTIONS:\s*(\[[\s\S]*\])\s*$/i.exec(text);
  if (!m) return { reply: text.trim(), suggestions: [] };
  let suggestions: string[] = [];
  try {
    const arr = JSON.parse(m[1]!) as unknown;
    if (Array.isArray(arr)) suggestions = arr.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, 40)).slice(0, 3);
  } catch {
    suggestions = [];
  }
  return { reply: text.slice(0, m.index).trim(), suggestions };
}

export async function converse(history: AssistantTurn[], ctx: AssistantContext, apiKey?: string): Promise<AssistantReply> {
  const contents: GeminiMessage[] = history.slice(-16).map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.text.slice(0, 1000) }] }));
  const actions: AssistantAction[] = [];
  const trace: { tool: string; ok: boolean }[] = [];
  const system = systemPrompt(ctx);

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const parts = await generateParts(contents, { systemInstruction: system, tools: [...TOOL_DECLARATIONS], apiKey, temperature: 0.3, maxOutputTokens: 600 });
    const calls = parts.filter((p) => p.functionCall);
    const text = parts.map((p) => p.text ?? "").join("").trim();

    if (calls.length === 0 || round === MAX_TOOL_ROUNDS) {
      const { reply, suggestions } = parseSuggestions(text || "Sorry, I did not catch that. Could you say it again?");
      return { reply, actions, suggestions, trace };
    }

    // Echo the model turn, then feed every tool result back in one user turn.
    contents.push({
      role: "model",
      parts: parts
        .map((p) => (p.functionCall ? { functionCall: p.functionCall, ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {}) } : { text: p.text ?? "" }))
        .filter((p) => "functionCall" in p || p.text) as GeminiPart[],
    });
    const responses: GeminiPart[] = [];
    for (const call of calls) {
      const fc = call.functionCall!;
      const result = await runTool(fc.name, fc.args ?? {}, ctx);
      trace.push({ tool: fc.name, ok: result.ok });
      if (result.ok && result.action) actions.push(result.action);
      responses.push({ functionResponse: { name: fc.name, response: result.ok ? { result: result.data } : { error: result.error } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { reply: "Sorry, something went wrong. Please try again.", actions, suggestions: [], trace };
}
