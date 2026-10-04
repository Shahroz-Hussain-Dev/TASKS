/** Raahi mark — the same artwork as /public/icon.svg, inlined so it never flashes. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width={size} height={size} className={className} role="img" aria-label="Raahi">
      <defs>
        <linearGradient id="raahi-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f2a24" />
          <stop offset="1" stopColor="#0b0f1a" />
        </linearGradient>
        <linearGradient id="raahi-road" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="0.6" stopColor="#10b981" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <radialGradient id="raahi-glow" cx="0.7" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="url(#raahi-bg)" />
      <rect width="128" height="128" rx="32" fill="url(#raahi-glow)" />
      <path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="url(#raahi-road)" strokeWidth="14" strokeLinecap="round" />
      <path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#0b0f1a" strokeWidth="2.5" strokeDasharray="6 9" strokeLinecap="round" opacity="0.9" />
      <circle cx="90" cy="30" r="15" fill="#34d399" />
      <circle cx="90" cy="30" r="6.5" fill="#0b0f1a" />
      <circle cx="30" cy="104" r="7" fill="#6ee7b7" />
    </svg>
  );
}

export function Wordmark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Logo size={size} />
      <span className="font-display text-[20px] font-semibold tracking-tight text-ink-50">Raahi</span>
    </span>
  );
}
