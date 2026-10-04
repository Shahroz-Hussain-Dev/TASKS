import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Headphones, LifeBuoy, Phone, SendHorizontal, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supportMessageSchema, type SupportMessageDto, type SupportTicketDto } from "@raahi/shared";
import { Badge, Button, Chip, IconButton, Skeleton, useToast } from "@/components/ui";
import { BackButton } from "@/components/shared/BackButton";
import { ChatBubble } from "@/components/shared/ChatBubble";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { TypingDots } from "@/components/shared/TypingDots";
import { SUPPORT_SUGGESTIONS, dayLabel, timeOfDay } from "@/components/shared/meta";
import { qk } from "@/hooks/queryKeys";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useTypewriter } from "@/hooks/useTypewriter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

interface Pending {
  user: string;
  assistant: string;
  status: "streaming" | "finishing" | "error";
  error?: string;
}

interface RouteState {
  prefill?: string;
  rideId?: string;
}

const ESCALATE_PROMPT = "I'd like to talk to a human agent, please.";

function pickTicket(items: SupportTicketDto[]): SupportTicketDto | null {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return sorted.find((t) => t.status !== "resolved") ?? sorted[0] ?? null;
}

/**
 * Help chat: Gemini answers stream in token-by-token; "Talk to a human"
 * escalates the ticket and admin replies appear as they arrive (polled).
 */
export default function SupportScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const routeState = (location.state ?? null) as RouteState | null;
  const keyboard = useKeyboard();

  const [draft, setDraft] = useState(routeState?.prefill ?? "");
  const [pending, setPending] = useState<Pending | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const tickets = useQuery({
    queryKey: qk.supportTickets,
    queryFn: () => api.support.tickets(),
    refetchInterval: (q) => (pickTicket(q.state.data?.items ?? [])?.escalated ? 10_000 : false),
    refetchIntervalInBackground: false,
  });
  const config = useQuery({ queryKey: qk.config, queryFn: api.config, staleTime: 10 * 60_000 });

  const ticket = useMemo(() => pickTicket(tickets.data?.items ?? []), [tickets.data]);
  const messages = ticket?.messages ?? [];
  const role = user?.role ?? "customer";
  const suggestions = SUPPORT_SUGGESTIONS[role];
  const typed = useTypewriter(pending?.assistant ?? "", pending?.status === "streaming");

  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useLayoutEffect(() => {
    scrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [typed.shown.length, pending?.status, keyboard.open, scrollToBottom]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const parsed = supportMessageSchema.safeParse({ body, ticketId: ticket?.id });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Type a message first");
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPending({ user: parsed.data.body, assistant: "", status: "streaming" });
      const res = await api.support.send(
        parsed.data,
        (delta) => setPending((p) => (p ? { ...p, assistant: p.assistant + delta } : p)),
        controller.signal,
      );
      setPending((p) => (p ? { ...p, status: "finishing" } : p));
      await queryClient.invalidateQueries({ queryKey: qk.supportTickets });
      return res.ticketId;
    },
    onSuccess: () => {
      setPending(null);
      haptic.light();
    },
    onError: (err) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      haptic.error();
      setPending((p) => (p ? { ...p, status: "error", error: errorMessage(err, "Support is unavailable right now") } : p));
    },
  });

  const escalate = useMutation({
    mutationFn: async () => {
      let ticketId = ticket?.id ?? null;
      if (!ticketId) {
        setPending({ user: ESCALATE_PROMPT, assistant: "", status: "streaming" });
        const res = await api.support.send({ body: ESCALATE_PROMPT }, (delta) => setPending((p) => (p ? { ...p, assistant: p.assistant + delta } : p)));
        ticketId = res.ticketId;
        setPending((p) => (p ? { ...p, status: "finishing" } : p));
        await queryClient.invalidateQueries({ queryKey: qk.supportTickets });
        setPending(null);
      }
      if (!ticketId) throw new Error("Couldn't open a ticket. Please try again.");
      return api.support.escalate(ticketId);
    },
    onSuccess: async () => {
      haptic.success();
      await queryClient.invalidateQueries({ queryKey: qk.supportTickets });
      toast({ title: "Our team has been notified", body: "A Raahi agent will reply here. Keep notifications on.", tone: "success" });
    },
    onError: (err) => {
      setPending(null);
      toast({ title: "Couldn't reach the team", body: errorMessage(err), tone: "error" });
    },
  });

  const busy = send.isPending || escalate.isPending;

  const submit = (text = draft) => {
    const body = text.trim();
    if (!body || busy) return;
    setDraft("");
    send.mutate(body);
  };

  const retry = () => {
    if (!pending) return;
    const body = pending.user;
    setPending(null);
    send.mutate(body);
  };

  const showSuggestions = !busy && !pending && (messages.length === 0 || messages[messages.length - 1]?.sender !== "user");
  const supportPhone = config.data?.settings.supportPhone;

  return (
    <div className="relative h-full w-full flex flex-col bg-ink-900" style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}>
      <OfflineBanner />
      <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="px-4 pb-3 flex items-center gap-3 border-b border-white/6">
        <BackButton fallback={role === "driver" ? "/d" : "/c"} />
        <div className="relative size-11 rounded-2xl bg-brand-500/12 text-brand-400 flex items-center justify-center shrink-0">
          <LifeBuoy className="size-5" />
          <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-brand-400 border-2 border-ink-900" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[18px] font-semibold text-ink-50 leading-tight">Raahi Support</h1>
          <p className="text-[12.5px] text-ink-400 truncate">{ticket?.escalated ? "Human agent assigned · replies here" : "AI assistant · answers in seconds"}</p>
        </div>
        {supportPhone && <IconButton icon={Phone} label="Call support" variant="ghost" onClick={() => window.open(`tel:${supportPhone.replace(/\s+/g, "")}`, "_self")} />}
        {!ticket?.escalated && (
          <Button size="sm" variant="secondary" icon={Headphones} loading={escalate.isPending} disabled={busy} onClick={() => escalate.mutate()}>
            Human
          </Button>
        )}
      </motion.header>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-4">
        {tickets.isPending ? (
          <div className="flex flex-col gap-3 pt-6">
            <Skeleton className="h-14 w-3/4 rounded-3xl" />
            <Skeleton className="h-10 w-1/2 rounded-3xl self-end" />
            <Skeleton className="h-20 w-4/5 rounded-3xl" />
          </div>
        ) : (
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
              {ticket?.escalated && (
                <motion.div key="esc" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="mt-3 flex items-center gap-2.5 rounded-2xl bg-violet-400/10 border border-violet-400/20 px-3.5 py-2.5">
                  <ShieldCheck className="size-4 text-violet-400 shrink-0" />
                  <p className="text-[13px] text-ink-200 leading-snug">Escalated to the Raahi team. We'll reply here, usually within a few hours.</p>
                  <Badge tone="violet" className="ml-auto shrink-0">
                    {ticket.status === "resolved" ? "Resolved" : "Open"}
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>

            {messages.length === 0 && !pending && <Intro name={user?.fullName.split(" ")[0] ?? "there"} />}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <MessageItem key={m.id} m={m} prev={messages[i - 1]} />
              ))}
              {pending && (
                <motion.div key="pending" className="flex flex-col" initial={false}>
                  <ChatBubble side="right" grouped={messages[messages.length - 1]?.sender === "user"} pending={pending.status === "streaming" && pending.assistant.length === 0} failed={pending.status === "error"} meta={pending.status === "error" ? <span className="inline-flex items-center gap-2">Not sent · <button type="button" className="underline font-semibold" onClick={retry}>Retry</button></span> : undefined}>
                    {pending.user}
                  </ChatBubble>
                  {pending.status !== "error" && (
                    <ChatBubble side="left" tone="glass" label={<span className="inline-flex items-center gap-1"><Bot className="size-3.5" /> Raahi assistant</span>}>
                      {typed.shown.length === 0 ? (
                        <TypingDots />
                      ) : (
                        <span>
                          {typed.shown}
                          {!typed.done && <span className="inline-block w-[2px] h-[1em] align-[-2px] ml-0.5 bg-brand-400 animate-pulse" />}
                        </span>
                      )}
                    </ChatBubble>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {tickets.isError && !tickets.data && (
              <div className="mt-6 text-center text-[13.5px] text-ink-400">
                Couldn't load earlier messages. <button type="button" className="underline text-ink-200" onClick={() => tickets.refetch()}>Retry</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggestions + composer */}
      <div className="border-t border-white/6 bg-ink-900/95 backdrop-blur" style={{ paddingBottom: keyboard.open ? 8 : "calc(var(--safe-bottom) + 8px)" }}>
        <AnimatePresence initial={false}>
          {showSuggestions && (
            <motion.div key="sugg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
              <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-3 pb-1">
                {suggestions.map((s) => (
                  <motion.div key={s} variants={item.right} className="shrink-0">
                    <Chip icon={Sparkles} onClick={() => submit(s)}>
                      {s}
                    </Chip>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={ticket?.escalated ? "Message the Raahi team…" : "Ask anything about Raahi…"}
              className="w-full bg-transparent outline-none resize-none text-[15px] text-ink-50 placeholder:text-ink-500 max-h-32 leading-6 py-0.5"
              style={{ height: Math.min(128, 24 * Math.max(1, draft.split("\n").length) + 4) }}
              enterKeyHint="enter"
              disabled={busy}
            />
          </div>
          <IconButton icon={SendHorizontal} label="Send" variant="brand" size={48} type="submit" disabled={busy || draft.trim().length === 0} className={cn("transition-opacity", (busy || draft.trim().length === 0) && "opacity-50")} />
        </form>
      </div>
    </div>
  );
}

function Intro({ name }: { name: string }) {
  return (
    <motion.div variants={stagger(0.08, 0.1)} initial="hidden" animate="show" className="flex flex-col items-center text-center gap-3 pt-10 pb-6 px-4">
      <motion.div variants={item.scale} className="relative size-20 rounded-[28px] glass flex items-center justify-center shadow-glow">
        <motion.span className="absolute inset-0 rounded-[28px] bg-brand-500/20" animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
        <Bot className="size-9 text-brand-400" />
      </motion.div>
      <motion.h2 variants={item.up} className="font-display text-[20px] font-semibold text-ink-50">
        Hi {name}, how can we help?
      </motion.h2>
      <motion.p variants={item.up} className="text-[14px] text-ink-400 leading-relaxed max-w-xs">
        Ask about fares, bidding, documents or a specific ride. Answers arrive in seconds, and you can hand over to a human at any time.
      </motion.p>
    </motion.div>
  );
}

function MessageItem({ m, prev }: { m: SupportMessageDto; prev: SupportMessageDto | undefined }) {
  const mine = m.sender === "user";
  const grouped = Boolean(prev && prev.sender === m.sender && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 2 * 60_000);
  const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
  return (
    <>
      {newDay && <DayDivider label={dayLabel(m.createdAt)} />}
      <ChatBubble
        side={mine ? "right" : "left"}
        tone={mine ? "brand" : m.sender === "admin" ? "violet" : "glass"}
        grouped={grouped && !newDay}
        label={mine ? undefined : m.sender === "admin" ? <span className="inline-flex items-center gap-1 text-violet-400"><ShieldCheck className="size-3.5" /> Raahi team</span> : <span className="inline-flex items-center gap-1"><Bot className="size-3.5" /> Raahi assistant</span>}
        meta={timeOfDay(m.createdAt)}
      >
        {m.body}
      </ChatBubble>
    </>
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
