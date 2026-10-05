/** What Buddy is doing right now — drives the 3D animation and the SVG fallback. */
export type BuddyState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "sad";

export const BUDDY_STATES: readonly BuddyState[] = ["idle", "listening", "thinking", "speaking", "happy", "sad"];

/** Brand colours used by both renderers so the 2D and 3D Buddy match. */
export const BUDDY_COLORS = {
  body: "#fff1dc",
  bodyShade: "#f3d9b8",
  ink: "#2b2640",
  coral: "#ff6b4a",
  coralSoft: "#ff8a6c",
  teal: "#12a594",
  tealDark: "#0e8a7b",
  sun: "#ffc53d",
  lavender: "#8b7cf6",
  sky: "#3da9fc",
  shadow: "#5a3b1e",
} as const;
