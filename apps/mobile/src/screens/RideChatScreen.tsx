import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, SendHorizontal, Zap } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sendMessageSchema, type ChatMessageDto, type RideDto } from "@raahi/shared";
import { Avatar, Button, Chip, EmptyState, IconButton, Skeleton } from "@/components/ui";
import { BackButton } from "@/components/shared/BackButton";
import { ChatBubble } from "@/components/shared/ChatBubble";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { RideStatusBadge } from "@/components/shared/RideStatusBadge";
import { QUICK_REPLIES, RIDE_STATUS_META, dayLabel, isActiveRide, timeOfDay } from "@/components/shared/meta";
import { qk } from "@/hooks/queryKeys";
import { useKeyboard } from "@/hooks/useKeyboard";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

interface Outgoing {
  tempId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
}

type Row = { kind: "server"; m: ChatMessageDto } | { kind: "outgoing"; o: Outgoing };

const GROUP_WINDOW_MS = 2 * 60_000;

/**
 * In-ride messaging between passenger and driver. Polls every 2 s while open,
 * sends optimistically, keeps the latest message in view and stays usable
 * with the keyboard up.
 */
export default function RideChatScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const keyboard = useKeyboard();
  const role: "customer" | "driver" = user?.role === "driver" ? "driver" : "customer";

  const [draft, setDraft] = useState("");
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [stuck, setStuck] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const ride = useQuery({
    queryKey: qk.ride(id),
    queryFn: ({ signal }) => api.rides.get(id, signal),
    enabled: id.length > 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const active = ride.data ? isActiveRide(ride.data.status) : true;

  const messages = useQuery({
    queryKey: qk.rideMessages(id),
    queryFn: ({ signal }) => api.rides.messages(id, signal),
    enabled: id.length > 0,
    refetchInterval: active ? 2_000 : false,
    refetchIntervalInBackground: false,
  });

  const rows = useMemo<Row[]>(() => {
    const server = messages.data?.items ?? [];
    const bodies = new Set(server.map((m) => `${m.senderId}:${m.body}`));
    const mine = outbox.filter((o) => !(o.status === "sending" && user && bodies.has(`${user.id}:${o.body}`)));
    return [...server.map((m): Row => ({ kind: "server", m })), ...mine.map((o): Row => ({ kind: "outgoing", o }))];
  }, [messages.data, outbox, user]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useLayoutEffect(() => {
    if (stuck) scrollToBottom(false);
  }, [rows.length, stuck, scrollToBottom]);

  useEffect(() => {
    if (keyboard.open) scrollToBottom();
  }, [keyboard.open, scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setStuck(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const send = useMutation({
    mutationFn: async (o: Outgoing) => {
      const parsed = sendMessageSchema.safeParse({ body: o.body });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Type a message first");
      return api.rides.send(id, parsed.data.body);
    },
    onMutate: (o) => {
      setOutbox((xs) => [...xs.filter((x) => x.tempId !== o.tempId), { ...o, status: "sending" }]);
      setStuck(true);
    },
    onSuccess: (m, o) => {
      haptic.light();
      queryClient.setQueryData<{ items: ChatMessageDto[] }>(qk.rideMessages(id), (d) => (d && !d.items.some((x) => x.id === m.id) ? { items: [...d.items, m] } : d ?? { items: [m] }));
      setOutbox((xs) => xs.filter((x) => x.tempId !== o.tempId));
    },
    onError: (_err, o) => {
      haptic.error();
      setOutbox((xs) => xs.map((x) => (x.tempId === o.tempId ? { ...x, status: "failed" } : x)));
    },
  });

  const submit = (text = draft) => {
    const body = text.trim();
    if (!body || !active) return;
    setDraft("");
    send.mutate({ tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, body, createdAt: new Date().toISOString(), status: "sending" });
  };

  const counterpart = ride.data ? (role === "customer" ? ride.data.driver : ride.data.customer) : null;
  const statusLine = ride.data ? (active ? RIDE_STATUS_META[ride.data.status].headline : "Chat closed") : "";

  if (ride.isError && !ride.data) {
    const notFound = ride.error instanceof ApiRequestError && (ride.error.status === 404 || ride.error.status === 403);
    return (
      <div className="h-full flex flex-col bg-ink-900 px-5" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <div className="flex items-center min-h-12">
          <BackButton fallback={role === "driver" ? "/d" : "/c"} />
        </div>
        <EmptyState icon={MessageCircle} title={notFound ? "Chat not available" : "Couldn't open chat"} body={notFound ? "This ride isn't yours or no longer exists." : errorMessage(ride.error)} action={<Button size="md" variant="secondary" onClick={() => (notFound ? navigate(role === "driver" ? "/d" : "/c") : ride.refetch())}>{notFound ? "Go home" : "Try again"}</Button>} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full flex flex-col bg-ink-900" style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}>
      <OfflineBanner />
      <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="px-4 pb-3 flex items-center gap-3 border-b border-white/6">
        <BackButton fallback={`/rides/${id}`} />
        {counterpart ? (
          <motion.button type="button" whileTap={{ scale: 0.97 }} transition={spring} onClick={() => navigate(`/rides/${id}`)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
            <Avatar name={counterpart.fullName} src={counterpart.avatarUrl} size={42} />
            <div className="flex-1 min-w-0">
              <p className="font-display text-[17px] font-semibold text-ink-50 truncate leading-tight">{counterpart.fullName}</p>
              <p className="text-[12.5px] text-ink-400 truncate">{statusLine}</p>
            </div>
          </motion.button>
        ) : (
          <div className="flex-1 flex items-center gap-3">
            <Skeleton className="size-[42px] rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        )}
        {ride.data && <RideStatusBadge status={ride.data.status} />}
      </motion.header>

      <div ref={listRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-3">
        {messages.isPending ? (
          <div className="flex flex-col gap-3 pt-6">
            <Skeleton className="h-11 w-2/3 rounded-3xl" />
            <Skeleton className="h-11 w-1/2 rounded-3xl self-end" />
            <Skeleton className="h-16 w-3/4 rounded-3xl" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyChat name={counterpart?.fullName.split(" ")[0] ?? (role === "customer" ? "your driver" : "your passenger")} ride={ride.data ?? null} />
        ) : (
          <div className="flex flex-col pt-2">
            <AnimatePresence initial={false}>
              {rows.map((row, i) => {
                const prev = rows[i - 1];
                if (row.kind === "server") {
                  const m = row.m;
                  const mine = m.senderId === user?.id;
                  const prevAt = prev ? (prev.kind === "server" ? prev.m.createdAt : prev.o.createdAt) : null;
                  const prevSender = prev ? (prev.kind === "server" ? prev.m.senderId : user?.id) : null;
                  const grouped = Boolean(prevAt && prevSender === m.senderId && new Date(m.createdAt).getTime() - new Date(prevAt).getTime() < GROUP_WINDOW_MS);
                  const newDay = !prevAt || dayLabel(prevAt) !== dayLabel(m.createdAt);
                  return (
                    <motion.div key={m.id} className="flex flex-col">
                      {newDay && <DayDivider label={dayLabel(m.createdAt)} />}
                      <ChatBubble side={mine ? "right" : "left"} grouped={grouped && !newDay} meta={timeOfDay(m.createdAt)}>
                        {m.body}
                      </ChatBubble>
                    </motion.div>
                  );
                }
                const o = row.o;
                const prevMine = prev ? (prev.kind === "outgoing" ? true : prev.m.senderId === user?.id) : false;
                return (
                  <ChatBubble key={o.tempId} side="right" grouped={prevMine} pending={o.status === "sending"} failed={o.status === "failed"} meta={o.status === "failed" ? <span className="inline-flex items-center gap-2">Not sent · <button type="button" className="underline font-semibold" onClick={() => send.mutate(o)}>Retry</button> · <button type="button" className="underline" onClick={() => setOutbox((xs) => xs.filter((x) => x.tempId !== o.tempId))}>Delete</button></span> : "Sending…"}>
                    {o.body}
                  </ChatBubble>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {!stuck && rows.length > 0 && (
          <motion.button key="jump" type="button" initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.9 }} transition={spring} onClick={() => {
            setStuck(true);
            scrollToBottom();
          }} className="absolute right-4 glass rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-ink-50 shadow-float z-10" style={{ bottom: `calc(${keyboard.open ? "8px" : "var(--safe-bottom)"} + 128px)` }}>
            Newest messages
          </motion.button>
        )}
      </AnimatePresence>

      <div className="border-t border-white/6 bg-ink-900/95 backdrop-blur" style={{ paddingBottom: keyboard.open ? 8 : "calc(var(--safe-bottom) + 8px)" }}>
        {active ? (
          <>
            <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-3 pb-1">
              {QUICK_REPLIES[role].map((q) => (
                <motion.div key={q} variants={item.right} className="shrink-0">
                  <Chip icon={Zap} onClick={() => submit(q)}>
                    {q}
                  </Chip>
                </motion.div>
              ))}
            </motion.div>
            <form
              className="flex items-end gap-2 px-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="flex-1 flex items-end rounded-[22px] bg-ink-800 border border-white/8 focus-within:border-brand-500/60 px-4 py-2 min-h-12 transition-colors">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder={`Message ${counterpart?.fullName.split(" ")[0] ?? ""}`.trim() + "…"}
                  className="w-full bg-transparent outline-none resize-none text-[15px] text-ink-50 placeholder:text-ink-500 max-h-32 leading-6 py-0.5"
                  style={{ height: Math.min(128, 24 * Math.max(1, draft.split("\n").length) + 4) }}
                  enterKeyHint="send"
                />
              </div>
              <IconButton icon={SendHorizontal} label="Send" variant="brand" size={48} type="submit" disabled={draft.trim().length === 0} className={cn("transition-opacity", draft.trim().length === 0 && "opacity-50")} />
            </form>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="px-4 pt-3 flex flex-col items-center gap-2 text-center">
            <p className="text-[13.5px] text-ink-400">This chat closed when the ride ended.</p>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/rides/${id}`)}>
              View ride details
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function EmptyChat({ name, ride }: { name: string; ride: RideDto | null }) {
  return (
    <motion.div variants={stagger(0.08, 0.1)} initial="hidden" animate="show" className="flex flex-col items-center text-center gap-3 pt-12 px-6">
      <motion.div variants={item.scale} className="size-16 rounded-3xl glass flex items-center justify-center text-brand-400 shadow-card">
        <MessageCircle className="size-7" />
      </motion.div>
      <motion.h2 variants={item.up} className="font-display text-[18px] font-semibold text-ink-50">
        Say hello to {name}
      </motion.h2>
      <motion.p variants={item.up} className="text-[14px] text-ink-400 leading-relaxed max-w-xs">
        {ride && isActiveRide(ride.status) ? "Share a landmark, a gate number or let them know you're running late. Quick replies are below." : "No messages were exchanged on this ride."}
      </motion.p>
    </motion.div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <span className="flex-1 h-px bg-white/6" />
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">{label}</span>
      <span className="flex-1 h-px bg-white/6" />
    </div>
  );
}
