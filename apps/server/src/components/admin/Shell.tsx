"use client";

import { Car, CreditCard, GearSix, Lifebuoy, List, MapTrifold, Pulse, Scroll, SignOut, SquaresFour, Taxi, UsersThree, X, type Icon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { UserDto } from "@raahi/shared";
import { adminApi, isAdminApiError } from "@/lib/admin-client";
import { Logo } from "@/components/landing/Logo";
import { cn } from "./format";
import { spring, springSoft } from "./motion";
import { useToast } from "./toast";
import { Avatar, IconButton } from "./ui";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  badge?: "pendingDrivers" | "openTickets";
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: SquaresFour },
  { href: "/admin/drivers", label: "Drivers", icon: Taxi, badge: "pendingDrivers" },
  { href: "/admin/customers", label: "Customers", icon: UsersThree },
  { href: "/admin/rides", label: "Rides", icon: Car },
  { href: "/admin/live", label: "Live map", icon: MapTrifold },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/support", label: "Support", icon: Lifebuoy, badge: "openTickets" },
  { href: "/admin/settings", label: "Settings", icon: GearSix },
  { href: "/admin/audit", label: "Audit", icon: Scroll },
];

const PAGE_TITLES: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.href, n.label]));

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Session guard: renders children only once GET /api/me confirms an admin cookie. */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => adminApi.auth.me(signal),
    retry: false,
    staleTime: 60_000,
  });

  const unauthorised = me.isError && isAdminApiError(me.error) && (me.error.status === 401 || me.error.status === 403);
  const wrongRole = me.isSuccess && me.data.user.role !== "admin";

  useEffect(() => {
    if (unauthorised || wrongRole) {
      const next = encodeURIComponent(pathname);
      router.replace(`/admin/login?next=${next}`);
    }
  }, [unauthorised, wrongRole, router, pathname]);

  if (me.isPending || unauthorised || wrongRole) {
    return <BootScreen message={unauthorised || wrongRole ? "Redirecting to sign in…" : "Checking your session…"} />;
  }

  if (me.isError) {
    return (
      <BootScreen
        message="We couldn't reach the Raahi server."
        action={
          <button type="button" onClick={() => me.refetch()} className="jelly jelly-cream mt-5 h-10 rounded-full px-5 text-sm font-bold">
            Try again
          </button>
        }
      />
    );
  }

  return <Frame user={me.data.user}>{children}</Frame>;
}

function BootScreen({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-paper-50 px-6 text-center">
      <span className="blob left-[8%] top-[14%] h-72 w-72 bg-coral-100" />
      <span className="blob right-[8%] bottom-[10%] h-64 w-64 bg-teal-100" style={{ animationDelay: "-7s" }} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springSoft} className="relative">
        <Logo size={56} />
      </motion.div>
      <p className="relative mt-5 text-[14px] font-semibold text-ink-600">{message}</p>
      {action}
    </div>
  );
}

function Frame({ user, children }: { user: UserDto; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: ({ signal }) => adminApi.stats(signal),
    refetchInterval: 30_000,
  });

  useEffect(() => setMobileOpen(false), [pathname]);

  const badges: Record<NonNullable<NavItem["badge"]>, number> = {
    pendingDrivers: stats.data?.driversPendingReview ?? 0,
    openTickets: stats.data?.openTickets ?? 0,
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await adminApi.auth.logout();
    } catch {
      // Cookie clearing is best-effort; the login page is the destination either way.
    }
    queryClient.clear();
    toast.info("Signed out", "See you next time.");
    router.replace("/admin/login");
  };

  const section = Object.keys(PAGE_TITLES)
    .filter((href) => isActive(pathname, href))
    .sort((a, b) => b.length - a.length)[0];

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        const count = n.badge ? badges[n.badge] : 0;
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} className={cn("relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-bold transition-colors", active ? "text-ink-900" : "text-ink-600 hover:bg-white/70 hover:text-ink-900")}>
            {active ? <motion.span layoutId="admin-nav-active" transition={spring} className="absolute inset-0 rounded-2xl bg-white shadow-pillow" /> : null}
            {active ? <motion.span layoutId="admin-nav-bar" transition={spring} className="absolute left-0 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full bg-teal-500" /> : null}
            <Icon size={22} weight={active ? "fill" : "duotone"} className={cn("relative shrink-0", active ? "text-teal-600" : "text-ink-500")} />
            <span className="relative flex-1">{n.label}</span>
            <AnimatePresence>
              {count > 0 ? (
                <motion.span
                  key="badge"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={spring}
                  className={cn("relative rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-white", n.badge === "pendingDrivers" ? "bg-coral-500 shadow-[0_2px_0_0_#f2552f]" : "bg-rose-500 shadow-[0_2px_0_0_#d93d68]")}
                >
                  {count > 99 ? "99+" : count}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/admin" className="flex items-center gap-3 px-5 py-5">
      <Logo size={38} />
      <span>
        <span className="block font-display text-[18px] font-semibold leading-none text-ink-900">Raahi</span>
        <span className="mt-1 block text-[11px] font-extrabold uppercase tracking-[0.18em] text-coral-600">Admin</span>
      </span>
    </Link>
  );

  const liveStrip = (
    <div className="pillow mx-3 mb-3 p-3 text-[12.5px]">
      <div className="flex items-center gap-2 text-ink-700">
        <Pulse size={16} weight="duotone" className="text-teal-600" />
        <span className="font-bold">Right now</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Stat label="Online" value={stats.data?.driversOnline} accent="text-teal-700" />
        <Stat label="Requests" value={stats.data?.openRequests} accent="text-ink-900" />
        <Stat label="Rides" value={stats.data?.activeRides} accent="text-ink-900" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper-50 text-ink-700 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-paper-200 bg-paper-100 lg:sticky lg:top-0 lg:flex lg:h-screen">
        {brand}
        {nav}
        {liveStrip}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div key="mobile-nav" className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={springSoft} className="relative flex h-full w-[268px] flex-col border-r border-paper-200 bg-paper-100 shadow-float">
              <div className="flex items-center justify-between pr-3">
                {brand}
                <IconButton label="Close menu" onClick={() => setMobileOpen(false)}>
                  <X size={20} weight="bold" />
                </IconButton>
              </div>
              {nav}
              {liveStrip}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 bg-white/90 px-4 shadow-bar backdrop-blur-xl sm:px-6">
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <List size={22} weight="bold" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[16px] font-semibold text-ink-900">{section ? PAGE_TITLES[section] : "Admin"}</p>
          </div>
          <Link href="/admin/live" className="hidden items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-[12.5px] font-bold text-teal-700 transition-colors hover:bg-teal-200 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
            </span>
            {stats.data ? `${stats.data.driversOnline} online · ${stats.data.activeRides} active` : "Live"}
          </Link>
          <div className="flex items-center gap-2 pl-2">
            <Avatar name={user.fullName} src={user.avatarUrl} size={34} />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[13.5px] font-bold leading-tight text-ink-900">{user.fullName}</p>
              <p className="truncate text-[11.5px] text-ink-500">{user.email ?? "Administrator"}</p>
            </div>
            <IconButton label="Sign out" onClick={logout} disabled={loggingOut}>
              <SignOut size={20} weight="duotone" />
            </IconButton>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | undefined; accent: string }) {
  return (
    <div className="rounded-xl bg-paper-100 py-1.5">
      <p className={cn("font-display text-[16px] font-semibold tabular-nums", accent)}>{value === undefined ? "–" : value}</p>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{label}</p>
    </div>
  );
}
