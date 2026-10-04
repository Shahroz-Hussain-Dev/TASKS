import Link from "next/link";
import { Wordmark } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-white/6 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <Wordmark size={28} />
          <p className="mt-2 text-[13px] text-ink-500">Fair-price ride hailing for Pakistan. Built in Lahore.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] font-semibold text-ink-400">
          <Link href="/download" className="hover:text-ink-50">
            Download
          </Link>
          <Link href="/privacy" className="hover:text-ink-50">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink-50">
            Terms
          </Link>
          <Link href="/admin" className="hover:text-ink-50">
            Admin
          </Link>
          <a href="mailto:support@raahi.pk" className="hover:text-ink-50">
            support@raahi.pk
          </a>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-[12px] text-ink-600">© {new Date().getFullYear()} Raahi Technologies. Map data © OpenStreetMap contributors.</p>
    </footer>
  );
}
