import Link from "next/link";
import { Wordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-ink-900 px-4 pb-10 pt-12 text-paper-100">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <Wordmark size={30} tone="light" />
          <p className="mt-2 text-[13.5px] text-paper-200/80">Fair-price ride hailing for Pakistan. Built in Lahore.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] font-bold text-paper-200/90">
          <Link href="/download" className="transition-colors hover:text-sun-300">
            Download
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-sun-300">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-sun-300">
            Terms
          </Link>
          <Link href="/admin" className="transition-colors hover:text-sun-300">
            Admin
          </Link>
          <a href="mailto:support@raahi.pk" className="transition-colors hover:text-sun-300">
            support@raahi.pk
          </a>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl border-t border-white/10 pt-6 text-[12.5px] text-paper-200/60">© {new Date().getFullYear()} Raahi Technologies. Map data © OpenStreetMap contributors.</p>
    </footer>
  );
}
