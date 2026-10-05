/**
 * Buddy — Raahi's 3D cartoon assistant (docs/DESIGN.md §3–4).
 *   <Buddy state size />      the character (lazy WebGL canvas, SVG fallback)
 *   <BuddyBubble />           floating launcher that opens the Assistant sheet
 *   <AssistantSheet />        the voice/text conversation
 */
export type { BuddyState } from "./types";
export { Buddy } from "./Buddy";
export { BuddyBubble } from "./BuddyBubble";
export { AssistantSheet } from "./AssistantSheet";
