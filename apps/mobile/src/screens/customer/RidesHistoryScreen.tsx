import { useInfiniteQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowClockwise, ClockCounterClockwise } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { RideDto } from "@raahi/shared";
import { BreathingCta } from "@/components/customer/BreathingCta";
import { RideRow } from "@/components/customer/RideRow";
import { TAB_BAR_CLEARANCE } from "@/components/customer/TabBar";
import { AnimatedCar } from "@/components/Illustrations";
import { dayLabel } from "@/components/shared/meta";
import { Button, EmptyState, IconButton, Screen, Skeleton, Spinner, TopBar } from "@/components/ui";
import { ck } from "@/hooks/customer/keys";
import { useBannerOffset } from "@/hooks/customer/useBannerOffset";
import { api } from "@/lib/api";
import { item, spring, stagger } from "@/lib/motion";
import { cn, errorMessage } from "@/lib/utils";

const PAGE_SIZE = 20;

interface DayGroup {
  label: string;
  rides: RideDto[];
}

/**
 * Past rides, newest first, grouped by day on white pillow rows. Pages load
 * as the list reaches the bottom; each row opens the ride detail.
 */
export default function RidesHistoryScreen() {
  const navigate = useNavigate();
  const bannerOffset = useBannerOffset();
  const sentinel = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ck.ridesList,
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
      const last = out[out.length - 1];
      if (last && last.label === label) last.rides.push(r);
      else out.push({ label, rides: [r] });
    }
    return out;
  }, [rides]);

  const total = query.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !query.hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !query.isFetchingNextPage) void query.fetchNextPage();
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, query]);

  return (
    <Screen>
      {/* Soft blobs behind the header */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <span className="blob bg-coral-100 -top-16 -right-10 w-56 h-56 opacity-80" />
        <span className="blob bg-sun-100 top-10 -left-16 w-48 h-48 opacity-70" style={{ animationDelay: "-5s" }} />
      </div>
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="relative flex-1 flex flex-col" style={{ paddingTop: bannerOffset, paddingBottom: TAB_BAR_CLEARANCE }}>
        <motion.div variants={item.down}>
          <TopBar
            title="Your rides"
            subtitle={query.isSuccess ? (total === 0 ? "No trips yet" : `${total} ${total === 1 ? "trip" : "trips"}`) : undefined}
            right={<IconButton icon={ArrowClockwise} label="Refresh" variant="solid" size={44} weight="bold" className={cn("text-coral-600", query.isRefetching && "animate-spin")} onClick={() => void query.refetch()} />}
          />
        </motion.div>

        {query.isLoading ? (
          <motion.div variants={item.up} className="flex flex-col gap-3 mt-2">
            <Skeleton className="h-3.5 w-16 ml-1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="pillow p-3.5 flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
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
            <EmptyState icon={ClockCounterClockwise} tone="coral" title="Couldn't load your rides" body={errorMessage(query.error, "Check your connection and try again.")} action={<Button variant="secondary" size="md" onClick={() => void query.refetch()}>Try again</Button>} />
          </motion.div>
        ) : rides.length === 0 ? (
          <motion.div variants={item.scale} className="relative isolate flex-1 flex flex-col items-center justify-center text-center gap-4 px-6 pb-10">
            <div className="relative isolate flex items-center justify-center py-4">
              <span aria-hidden className="blob -z-10 bg-coral-100 w-60 h-44 -top-8 left-1/2 -translate-x-1/2" />
              <span aria-hidden className="blob -z-10 bg-teal-100 w-36 h-24 top-14 right-0 opacity-80" style={{ animationDelay: "-8s" }} />
              <AnimatedCar size={170} className="relative" />
            </div>
            <div className="relative">
              <h2 className="font-display text-[24px] font-semibold text-ink-900">No rides yet</h2>
              <p className="text-[14.5px] text-ink-500 leading-relaxed mt-1 max-w-[30ch] font-medium">Your trips will appear here with the route, fare and your rating of the driver.</p>
            </div>
            <BreathingCta>
              <Button size="lg" onClick={() => navigate("/c/plan")}>
                Book your first ride
              </Button>
            </BreathingCta>
          </motion.div>
        ) : (
          <motion.div variants={item.up} className="flex flex-col gap-5 mt-1">
            <AnimatePresence initial={false}>
              {groups.map((g) => (
                <motion.section key={g.label} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex flex-col gap-2.5">
                  <h2 className="px-1 font-display text-[15px] font-semibold text-ink-500!">{g.label}</h2>
                  <motion.ul variants={stagger(0.05, 0)} initial="hidden" animate="show" className="flex flex-col gap-2.5">
                    {g.rides.map((r) => (
                      <RideRow key={r.id} ride={r} onClick={() => navigate(`/rides/${r.id}`)} />
                    ))}
                  </motion.ul>
                </motion.section>
              ))}
            </AnimatePresence>

            <div ref={sentinel} className="flex items-center justify-center min-h-10">
              {query.isFetchingNextPage ? <Spinner /> : query.hasNextPage ? <Button variant="ghost" size="sm" onClick={() => void query.fetchNextPage()}>Load more</Button> : rides.length > 5 ? <p className="text-[12px] text-ink-400 font-semibold">That's every ride you've taken with Raahi.</p> : null}
            </div>
            {query.isError && <p className="text-center text-[12.5px] text-sun-600 -mt-3 font-bold">Couldn't refresh — showing what we have saved.</p>}
          </motion.div>
        )}
      </motion.div>
    </Screen>
  );
}
