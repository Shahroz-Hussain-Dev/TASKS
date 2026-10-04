import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Bell, Car, CheckCheck, LifeBuoy, MessageCircle, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { NotificationDto, Paginated } from "@raahi/shared";
import { Button, EmptyState, Screen, Skeleton, TopBar, useToast } from "@/components/ui";
import { BackButton } from "@/components/shared/BackButton";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { dayLabel, notificationIcon, notificationTarget, type NotificationIcon } from "@/components/shared/meta";
import { qk } from "@/hooks/queryKeys";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage, timeAgo } from "@/lib/utils";

type Page = Paginated<NotificationDto> & { unread: number };
type Pages = { pages: Page[]; pageParams: number[] };

const ICONS: Record<NotificationIcon, { icon: LucideIcon; cls: string }> = {
  bid: { icon: Banknote, cls: "bg-amber-400/12 text-amber-300" },
  ride: { icon: Car, cls: "bg-brand-500/12 text-brand-400" },
  chat: { icon: MessageCircle, cls: "bg-sky-400/12 text-sky-400" },
  shield: { icon: ShieldCheck, cls: "bg-brand-500/12 text-brand-400" },
  receipt: { icon: Receipt, cls: "bg-violet-400/12 text-violet-400" },
  support: { icon: LifeBuoy, cls: "bg-violet-400/12 text-violet-400" },
  bell: { icon: Bell, cls: "bg-white/6 text-ink-200" },
};

function markReadInCache(data: Pages | undefined, ids: string[] | null): Pages | undefined {
  if (!data) return data;
  const now = new Date().toISOString();
  return {
    ...data,
    pages: data.pages.map((p) => {
      let unread = p.unread;
      const items = p.items.map((n) => {
        if (n.readAt || (ids && !ids.includes(n.id))) return n;
        unread = Math.max(0, unread - 1);
        return { ...n, readAt: now };
      });
      return { ...p, items, unread: ids ? unread : 0 };
    }),
  };
}

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useInfiniteQuery({
    queryKey: qk.notificationsList,
    queryFn: ({ pageParam }) => api.me.notifications(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const unread = query.data?.pages[0]?.unread ?? 0;

  const groups = useMemo(() => {
    const out: { label: string; items: NotificationDto[] }[] = [];
    for (const n of items) {
      const label = dayLabel(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [items]);

  const markRead = useMutation({
    mutationFn: (ids: string[] | null) => api.me.markRead(ids ?? undefined),
    onMutate: (ids) => {
      queryClient.setQueryData<Pages>(qk.notificationsList, (d) => markReadInCache(d, ids));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notificationsBadge });
    },
    onError: (err) => {
      toast({ title: "Couldn't update", body: errorMessage(err), tone: "error" });
      void queryClient.invalidateQueries({ queryKey: qk.notificationsList });
    },
  });

  const open = (n: NotificationDto) => {
    haptic.light();
    if (!n.readAt) markRead.mutate([n.id]);
    const target = user ? notificationTarget(n, user.role) : null;
    if (target) navigate(target);
  };

  return (
    <Screen>
      <OfflineBanner />
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col flex-1">
        <motion.div variants={item.down}>
          <TopBar
            left={<BackButton fallback={user?.role === "driver" ? "/d" : "/c"} />}
            title="Notifications"
            subtitle={unread > 0 ? `${unread} unread` : items.length ? "You're all caught up" : undefined}
            right={
              <AnimatePresence>
                {unread > 0 && (
                  <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={spring}>
                    <Button size="sm" variant="secondary" icon={CheckCheck} loading={markRead.isPending && markRead.variables === null} onClick={() => markRead.mutate(null)}>
                      Mark all read
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            }
          />
        </motion.div>

        {query.isPending && (
          <motion.div variants={item.up} className="flex flex-col gap-3 mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <Skeleton className="size-11 rounded-2xl shrink-0" />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {query.isError && !query.data && (
          <EmptyState icon={Bell} title="Couldn't load notifications" body={errorMessage(query.error)} action={<Button size="md" variant="secondary" onClick={() => query.refetch()}>Try again</Button>} />
        )}

        {query.data && items.length === 0 && <EmptyState icon={Bell} title="Nothing here yet" body="Offers, ride updates and messages from our team will show up here." />}

        {groups.length > 0 && (
          <motion.div variants={item.up} className="flex flex-col gap-5 mt-1">
            {groups.map((g) => (
              <section key={g.label}>
                <p className="sticky top-0 z-10 -mx-5 px-5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-500 bg-ink-900/85 backdrop-blur">{g.label}</p>
                <ul className="flex flex-col gap-2 mt-1">
                  <AnimatePresence initial={false}>
                    {g.items.map((n) => (
                      <NotificationRow key={n.id} n={n} onOpen={() => open(n)} />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
            {query.hasNextPage && (
              <Button variant="ghost" size="md" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                Show older
              </Button>
            )}
          </motion.div>
        )}
      </motion.div>
    </Screen>
  );
}

function NotificationRow({ n, onOpen }: { n: NotificationDto; onOpen: () => void }) {
  const { icon: Icon, cls } = ICONS[notificationIcon(n.type)];
  const unread = !n.readAt;
  return (
    <motion.li layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={spring}>
      <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={onOpen} className={cn("w-full flex items-start gap-3 rounded-3xl p-3.5 text-left border transition-colors", unread ? "bg-ink-800 border-white/10" : "bg-ink-800/50 border-white/5")}>
        <span className={cn("size-11 rounded-2xl flex items-center justify-center shrink-0", cls)}>
          <Icon className="size-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-start gap-2">
            <span className={cn("flex-1 text-[15px] leading-snug", unread ? "font-semibold text-ink-50" : "font-medium text-ink-200")}>{n.title}</span>
            <AnimatePresence>{unread && <motion.span key="dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring} className="mt-1.5 size-2 rounded-full bg-brand-400 shadow-glow shrink-0" />}</AnimatePresence>
          </span>
          <span className="block text-[13.5px] text-ink-400 leading-snug mt-0.5">{n.body}</span>
          <span className="block text-[11.5px] text-ink-500 mt-1.5">{timeAgo(n.createdAt)}</span>
        </span>
      </motion.button>
    </motion.li>
  );
}
