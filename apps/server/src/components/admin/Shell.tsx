"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CreditCard,
  Car,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Map as MapIcon,
  Menu,
  ScrollText,
  Settings,
  CarTaxiFront,
  Users,
  X,
} from "lucide-react";
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
  icon: typeof LayoutDashboard;
  badge?: "pendingDrivers" | "openTickets";
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/drivers", label: "Drivers", icon: CarTaxiFront, badge: "pendingDrivers" },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/rides", label: "Rides", icon: Car },
  { href: "/admin/live", label: "Live map", icon: MapIcon },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, badge: "openTickets" },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
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
          <button type="button" onClick={() => me.refetch()} className="mt-4 rounded-2xl bg-ink-700 px-4 py-2 text-sm font-semibold text-ink-50 hover:bg-ink-600">
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-900 px-6 text-center">
      <span className="aurora left-[10%] top-[20%] h-72 w-72 bg-brand-500/40" />
      <span className="aurora right-[10%] bottom-[10%] h-64 w-64 bg-violet-400/30" style={{ animationDelay: "-7s" }} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springSoft} className="relative">
        <Logo size={56} />
      </motion.div>
      <p className="relative mt-5 text-[14px] text-ink-300">{message}</p>
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
          <Link key={n.href} href={n.href} className={cn("relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition-colors", active ? "text-ink-50" : "text-ink-400 hover:bg-white/4 hover:text-ink-100")}>
            {active ? <motion.span layoutId="admin-nav-active" transition={spring} className="absolute inset-0 rounded-2xl bg-ink-700 shadow-card" /> : null}
            {active ? <motion.span layoutId="admin-nav-bar" transition={spring} className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand-400" /> : null}
            <Icon size={19} strokeWidth={2.1} className={cn("relative shrink-0", active ? "text-brand-400" : "")} />
            <span className="relative flex-1">{n.label}</span>
            <AnimatePresence>
              {count > 0 ? (
                <motion.span
                  key="badge"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={spring}
                  className={cn("relative rounded-full px-2 py-0.5 text-[11px] font-bold", n.badge === "pendingDrivers" ? "bg-amber-400 text-ink-950" : "bg-rose-500 text-white")}
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
      <Logo size={36} />
      <span>
        <span className="block font-display text-[17px] font-semibold leading-none text-ink-50">Raahi</span>
        <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Admin</span>
      </span>
    </Link>
  );

  const liveStrip = (
    <div className="mx-3 mb-3 rounded-2xl border border-white/6 bg-ink-900/60 p-3 text-[12.5px]">
      <div className="flex items-center gap-2 text-ink-300">
        <Activity size={14} className="text-brand-400" />
        <span className="font-semibold">Right now</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Stat label="Online" value={stats.data?.driversOnline} />
        <Stat label="Requests" value={stats.data?.openRequests} />
        <Stat label="Rides" value={stats.data?.activeRides} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-900 text-ink-100 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/6 bg-ink-950/60 lg:sticky lg:top-0 lg:flex lg:h-screen">
        {brand}
        {nav}
        {liveStrip}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div key="mobile-nav" className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={springSoft} className="relative flex h-full w-[264px] flex-col border-r border-white/8 bg-ink-950">
              <div className="flex items-center justify-between pr-3">
                {brand}
                <IconButton label="Close menu" onClick={() => setMobileOpen(false)}>
                  <X size={20} />
                </IconButton>
              </div>
              {nav}
              {liveStrip}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/6 bg-ink-900/80 px-4 backdrop-blur-xl sm:px-6">
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-semibold text-ink-50">{section ? PAGE_TITLES[section] : "Admin"}</p>
          </div>
          <Link href="/admin/live" className="hidden items-center gap-2 rounded-full border border-white/6 bg-ink-800 px-3 py-1.5 text-[12.5px] font-semibold text-ink-300 hover:text-ink-50 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
            </span>
            {stats.data ? `${stats.data.driversOnline} online · ${stats.data.activeRides} active` : "Live"}
          </Link>
          <div className="flex items-center gap-2 pl-2">
            <Avatar name={user.fullName} src={user.avatarUrl} size={34} />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[13.5px] font-semibold leading-tight text-ink-50">{user.fullName}</p>
              <p className="truncate text-[11.5px] text-ink-500">{user.email ?? "Administrator"}</p>
            </div>
            <IconButton label="Sign out" onClick={logout} disabled={loggingOut}>
              <LogOut size={18} />
            </IconButton>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl bg-ink-800 py-1.5">
      <p className="font-display text-[15px] font-semibold text-ink-50">{value === undefined ? "–" : value}</p>
      <p className="text-[10.5px] uppercase tracking-wide text-ink-500">{label}</p>
    </div>
  );
}
