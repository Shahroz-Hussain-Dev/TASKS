import { useInfiniteQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { History, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { RideDto } from "@raahi/shared";
import { RideRow } from "@/components/customer/RideRow";
import { TAB_BAR_CLEARANCE } from "@/components/customer/TabBar";
import { AnimatedCar } from "@/components/Illustrations";
import { Aurora } from "@/components/shared/Aurora";
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
 * Past rides, newest first, grouped by day. Pages load as the list reaches
 * the bottom; each row opens the ride detail.
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
    <Screen className="noise">
      <Aurora variant="top" intensity={0.5} />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="relative flex-1 flex flex-col" style={{ paddingTop: bannerOffset, paddingBottom: TAB_BAR_CLEARANCE }}>
        <motion.div variants={item.down}>
          <TopBar title="Your rides" subtitle={query.isSuccess ? (total === 0 ? "No trips yet" : `${total} ${total === 1 ? "trip" : "trips"}`) : undefined} right={<IconButton icon={RefreshCw} label="Refresh" variant="ghost" size={40} className={cn(query.isRefetching && "animate-spin")} onClick={() => void query.refetch()} />} />
        </motion.div>

        {query.isLoading ? (
          <motion.div variants={item.up} className="flex flex-col gap-3 mt-2">
            <Skeleton className="h-3.5 w-16 ml-1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-3xl bg-ink-800 border border-white/6 p-3.5 flex items-center gap-3">
                <Skeleton className="size-11 rounded-2xl" />
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
            <EmptyState icon={History} title="Couldn't load your rides" body={errorMessage(query.error, "Check your connection and try again.")} action={<Button variant="secondary" size="md" onClick={() => void query.refetch()}>Try again</Button>} />
          </motion.div>
        ) : rides.length === 0 ? (
          <motion.div variants={item.scale} className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6 pb-10">
            <AnimatedCar size={150} />
            <div>
              <h2 className="font-display text-[20px] font-semibold text-ink-50">No rides yet</h2>
              <p className="text-[14px] text-ink-400 leading-relaxed mt-1 max-w-[30ch]">Your trips will appear here with the route, fare and your rating of the driver.</p>
            </div>
            <Button size="lg" onClick={() => navigate("/c/plan")}>
              Book your first ride
            </Button>
          </motion.div>
        ) : (
          <motion.div variants={item.up} className="flex flex-col gap-5 mt-1">
            <AnimatePresence initial={false}>
              {groups.map((g) => (
                <motion.section key={g.label} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex flex-col gap-2">
                  <h2 className="px-1 text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-500">{g.label}</h2>
                  <motion.ul variants={stagger(0.05, 0)} initial="hidden" animate="show" className="flex flex-col gap-2">
                    {g.rides.map((r) => (
                      <RideRow key={r.id} ride={r} onClick={() => navigate(`/rides/${r.id}`)} />
                    ))}
                  </motion.ul>
                </motion.section>
              ))}
            </AnimatePresence>

            <div ref={sentinel} className="flex items-center justify-center min-h-10">
              {query.isFetchingNextPage ? <Spinner /> : query.hasNextPage ? <Button variant="ghost" size="sm" onClick={() => void query.fetchNextPage()}>Load more</Button> : rides.length > 5 ? <p className="text-[12px] text-ink-500">That's every ride you've taken with Raahi.</p> : null}
            </div>
            {query.isError && (
              <p className="text-center text-[12.5px] text-amber-300 -mt-3">
                Couldn't refresh — showing what we have saved.
              </p>
            )}
          </motion.div>
        )}
      </motion.div>
    </Screen>
  );
}
