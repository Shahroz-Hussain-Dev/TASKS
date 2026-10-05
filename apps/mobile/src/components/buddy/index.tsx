/**
 * Buddy — Raahi's 3D cartoon assistant. Placeholder exports so screens can
 * import them while the real implementation lands (see docs/DESIGN.md §3).
 */
export type BuddyState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "sad";

export function Buddy({ size = 160 }: { state?: BuddyState; size?: number; className?: string }) {
  return <div style={{ width: size, height: size }} className="rounded-full bg-coral-100" />;
}

export function BuddyBubble(props: { className?: string; hint?: string }) {
  void props;
  return null;
}

export function AssistantSheet(props: { open: boolean; onClose: () => void; initialPrompt?: string }) {
  void props;
  return null;
}
