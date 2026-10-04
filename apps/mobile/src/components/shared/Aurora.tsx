import { cn } from "@/lib/utils";

/**
 * Two to three slow-drifting colour blobs behind hero and empty states.
 * Purely decorative (aria-hidden); respects reduced motion via global.css.
 */
export function Aurora({ className, intensity = 1, variant = "full" }: { className?: string; intensity?: number; variant?: "full" | "top" | "soft" }) {
  const scale = variant === "soft" ? 0.6 : 1;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="aurora bg-brand-500" style={{ width: "62%", height: "48%", top: "-14%", left: "-12%", opacity: 0.38 * intensity * scale }} />
      <div className="aurora bg-violet-400" style={{ width: "54%", height: "46%", top: variant === "top" ? "-8%" : "28%", right: "-18%", animationDelay: "-7s", opacity: 0.22 * intensity * scale }} />
      {variant !== "top" && <div className="aurora bg-amber-400" style={{ width: "46%", height: "38%", bottom: "-12%", left: "18%", animationDelay: "-13s", opacity: 0.16 * intensity * scale }} />}
    </div>
  );
}
