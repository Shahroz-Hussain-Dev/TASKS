import { cn } from "@/lib/utils";

/**
 * Two to three slowly morphing tint blobs (coral, sun, teal) behind heroes and
 * empty states. Purely decorative (aria-hidden); respects reduced motion via
 * global.css. `intensity` scales opacity; `variant="top"` keeps blobs in the
 * upper half; `variant="soft"` is a quieter version for inside cards.
 */
export function Aurora({ className, intensity = 1, variant = "full" }: { className?: string; intensity?: number; variant?: "full" | "top" | "soft" }) {
  const scale = variant === "soft" ? 0.55 : 1;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="blob bg-coral-100" style={{ width: "64%", height: "46%", top: "-12%", left: "-14%", opacity: 0.95 * intensity * scale }} />
      <div className="blob bg-sun-100" style={{ width: "52%", height: "40%", top: variant === "top" ? "-6%" : "26%", right: "-16%", animationDelay: "-6s", animationDuration: "17s", opacity: 0.9 * intensity * scale }} />
      {variant !== "top" && <div className="blob bg-teal-100" style={{ width: "48%", height: "36%", bottom: "-10%", left: "16%", animationDelay: "-11s", animationDuration: "20s", opacity: 0.85 * intensity * scale }} />}
    </div>
  );
}
