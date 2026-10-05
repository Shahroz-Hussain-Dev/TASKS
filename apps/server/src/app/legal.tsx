import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-paper-50 text-ink-700">
      <span className="blob left-[-10%] top-[-6%] h-[380px] w-[380px] bg-coral-100" />
      <span className="blob right-[-8%] top-[30%] h-[320px] w-[320px] bg-teal-100" style={{ animationDelay: "-7s" }} />
      <div className="relative mx-auto max-w-3xl px-6 py-14">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-coral-600 hover:text-coral-700">← Raahi</Link>
        <h1 className="mt-6 font-display text-[40px] font-semibold text-ink-900">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-ink-500">Last updated {updated}</p>
        <article className="pillow mt-10 space-y-6 p-8 leading-relaxed sm:p-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink-900 [&_h2]:mt-10 [&_h2:first-child]:mt-0 [&_p]:text-ink-700 [&_li]:text-ink-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:marker:text-coral-500 [&_strong]:text-ink-900">
          {children}
        </article>
      </div>
    </main>
  );
}
