/** Raahi mark — Sunrise edition: coral→sun tile, white road, teal destination pin. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width={size} height={size} className={className} role="img" aria-label="Raahi">
      <defs>
        <linearGradient id="raahi-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6b4a" />
          <stop offset="0.55" stopColor="#ff8a6c" />
          <stop offset="1" stopColor="#ffc53d" />
        </linearGradient>
        <radialGradient id="raahi-glow" cx="0.25" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="url(#raahi-bg)" />
      <rect width="128" height="128" rx="32" fill="url(#raahi-glow)" />
      <path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" />
      <path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#ffc53d" strokeWidth="2.5" strokeDasharray="6 9" strokeLinecap="round" opacity="0.9" />
      <circle cx="90" cy="30" r="16" fill="#ffffff" />
      <circle cx="90" cy="30" r="12" fill="#12a594" />
      <circle cx="90" cy="30" r="5" fill="#ffffff" />
      <circle cx="30" cy="104" r="8" fill="#ffffff" />
      <circle cx="30" cy="104" r="4" fill="#1f1b2d" />
    </svg>
  );
}

export function Wordmark({ size = 32, className, tone = "dark" }: { size?: number; className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Logo size={size} />
      <span className={`font-display text-[20px] font-semibold tracking-tight ${tone === "light" ? "text-paper-50" : "text-ink-900"}`}>Raahi</span>
    </span>
  );
}
