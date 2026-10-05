import { useInfiniteQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowsClockwise, ClockCounterClockwise } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { RideDto } from "@raahi/shared";
import { DriverRideRow } from "@/components/driver/DriverRideRow";
import { AnimatedCar } from "@/components/Illustrations";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { dayLabel } from "@/components/shared/meta";
import { Button, EmptyState, IconButton, Money, Screen, Skeleton, Spinner, TopBar } from "@/components/ui";
import { dk } from "@/hooks/driver/keys";
import { TAB_BAR_CLEARANCE } from "@/hooks/driver/layout";
import { api } from "@/lib/api";
import { item, spring, stagger } from "@/lib/motion";
import { cn, errorMessage } from "@/lib/utils";

const PAGE_SIZE = 20;

interface DayGroup {
  label: string;
  rides: RideDto[];
  earnedPkr: number;
}

/** Trip history for the driver, newest first, grouped by day with the day's earnings. */
export default function DriverRidesScreen() {
  const navigate = useNavigate();
  const sentinel = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: dk.ridesList,
    queryFn: ({ pageParam }) => api.rides.list(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    staleTime: 15_000,
  });

  const rides = useMemo<RideDto[]>(() => {
    const seen = new Set<string>();
    const out: RideDto[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const r of page.items) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
    }
    return out;
  }, [query.data]);

  const groups = useMemo<DayGroup[]>(() => {
    const out: DayGroup[] = [];
    for (const r of rides) {
      const label = dayLabel(r.createdAt);
      const earned = r.status === "completed" ? r.farePkr : 0;
      const last = out[out.length - 1];
      if (last && last.label === label) {
        last.rides.push(r);
        last.earnedPkr += earned;
      } else out.push({ label, rides: [r], earnedPkr: earned });
    }
    return out;
  }, [rides]);

  const total = query.data?.pages[0]?.total ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Screen>
      <OfflineBanner />
      <span aria-hidden className="blob bg-sun-100 w-64 h-64 -top-20 -right-16 opacity-70" />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="relative flex-1 flex flex-col" style={{ paddingBottom: TAB_BAR_CLEARANCE }}>
        <motion.div variants={item.down}>
          <TopBar title="Your trips" subtitle={query.isSuccess ? (total === 0 ? "No trips yet" : `${total} trip${total === 1 ? "" : "s"}`) : undefined} right={<IconButton icon={ArrowsClockwise} label="Refresh" variant="ghost" size={40} className={cn("text-teal-600", query.isRefetching && "animate-spin")} onClick={() => void query.refetch()} />} />
        </motion.div>

        {query.isLoading ? (
          <motion.div variants={item.up} className="flex flex-col gap-3 mt-2">
            <Skeleton className="h-3.5 w-16 ml-1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="pillow p-3.5 flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : query.isError && rides.length === 0 ? (
          <motion.div variants={item.up} className="flex-1 flex items-center justify-center">
            <EmptyState icon={ClockCounterClockwise} tone="teal" title="Couldn't load your trips" body={errorMessage(query.error, "Check your connection and try again.")} action={<Button variant="teal" size="md" onClick={() => void query.refetch()}>Try again</Button>} />
          </motion.div>
        ) : rides.length === 0 ? (
          <motion.div variants={item.scale} className="relative flex-1 flex flex-col items-center justify-center text-center gap-4 px-6 pb-10">
            <span aria-hidden className="blob bg-teal-100 w-56 h-56 opacity-90" style={{ top: "18%" }} />
            <AnimatedCar size={150} className="relative" />
            <div className="relative">
              <h2 className="font-display text-[22px] font-semibold text-ink-900">No trips yet</h2>
              <p className="text-[14px] font-semibold text-ink-500 leading-relaxed mt-1 max-w-[30ch]">Go online and your completed trips will appear here with what each one earned you.</p>
            </div>
            <Button size="lg" variant="teal" className="relative" onClick={() => navigate("/d/home")}>
              Go to requests
            </Button>
          </motion.div>
        ) : (
          <motion.div variants={item.up} className="flex flex-col gap-5 mt-1">
            <AnimatePresence initial={false}>
              {groups.map((g) => (
                <motion.section key={g.label} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between px-1">
                    <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-ink-400">{g.label}</h2>
                    {g.earnedPkr > 0 && <Money value={g.earnedPkr} className="text-[13px] text-teal-600!" />}
                  </div>
                  <motion.ul variants={stagger(0.05, 0)} initial="hidden" animate="show" className="flex flex-col gap-2.5">
                    {g.rides.map((r) => (
                      <DriverRideRow key={r.id} ride={r} onClick={() => navigate(`/rides/${r.id}`)} />
                    ))}
                  </motion.ul>
                </motion.section>
              ))}
            </AnimatePresence>

            <div ref={sentinel} className="flex items-center justify-center min-h-10">
              {isFetchingNextPage ? (
                <Spinner className="text-teal-500" />
              ) : hasNextPage ? (
                <Button variant="ghost" size="sm" onClick={() => void fetchNextPage()}>
                  Load more
                </Button>
              ) : rides.length > 5 ? (
                <p className="text-[12px] font-semibold text-ink-400">That's every trip you've driven with Raahi.</p>
              ) : null}
            </div>
            {query.isError && <p className="text-center text-[12.5px] font-bold text-sun-600 -mt-3">Couldn't refresh — showing what we have saved.</p>}
          </motion.div>
        )}
      </motion.div>
    </Screen>
  );
}
