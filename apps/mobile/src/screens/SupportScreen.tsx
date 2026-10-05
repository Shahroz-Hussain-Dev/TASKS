import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Headset, PaperPlaneRight, Phone, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supportMessageSchema, type SupportMessageDto, type SupportTicketDto } from "@raahi/shared";
import { Badge, Button, Chip, IconButton, Skeleton, useToast } from "@/components/ui";
import { Buddy } from "@/components/buddy";
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
import { float, item, spring, stagger } from "@/lib/motion";
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
 * Buddy is the agent avatar and reacts to the conversation state.
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
  const buddyState = pending?.status === "streaming" ? (pending.assistant.length === 0 ? "thinking" : "speaking") : pending?.status === "error" ? "sad" : "idle";
  const canSend = !busy && draft.trim().length > 0;

  return (
    <div className="relative h-full w-full flex flex-col bg-paper-50" style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}>
      <OfflineBanner />
      <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="relative px-4 pb-3 flex items-center gap-3">
        <BackButton fallback={role === "driver" ? "/d" : "/c"} />
        <div className="relative size-12 rounded-full bg-white shadow-pillow flex items-center justify-center shrink-0 overflow-hidden">
          <Buddy state={buddyState} size={44} />
          <span className={cn("absolute right-0.5 bottom-0.5 size-3 rounded-full border-2 border-white", ticket?.escalated ? "bg-lavender-500" : "bg-mint-500")} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[19px] font-semibold text-ink-900 leading-tight">Raahi Support</h1>
          <p className="text-[12.5px] text-ink-500 truncate font-bold">{ticket?.escalated ? "Human agent assigned · replies here" : "AI assistant · answers in seconds"}</p>
        </div>
        {supportPhone && <IconButton icon={Phone} label="Call support" variant="ghost" onClick={() => window.open(`tel:${supportPhone.replace(/\s+/g, "")}`, "_self")} />}
        {!ticket?.escalated && (
          <Button size="sm" variant="outline" icon={Headset} loading={escalate.isPending} disabled={busy} onClick={() => escalate.mutate()}>
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
                <motion.div key="esc" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="mt-3 flex items-center gap-2.5 rounded-[20px] bg-lavender-100 px-3.5 py-2.5 shadow-[0_3px_0_0_#d8d2ff]">
                  <ShieldCheck className="size-5 text-lavender-500 shrink-0" weight="duotone" />
                  <p className="text-[13px] text-ink-700 leading-snug font-semibold">Escalated to the Raahi team. We'll reply here, usually within a few hours.</p>
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
                  <ChatBubble side="right" grouped={messages[messages.length - 1]?.sender === "user"} pending={pending.status === "streaming" && pending.assistant.length === 0} failed={pending.status === "error"} meta={pending.status === "error" ? <span className="inline-flex items-center gap-2">Not sent · <button type="button" className="underline font-extrabold" onClick={retry}>Retry</button></span> : undefined}>
                    {pending.user}
                  </ChatBubble>
                  {pending.status !== "error" && (
                    <ChatBubble side="left" tone="white" label={<AssistantLabel />}>
                      {typed.shown.length === 0 ? (
                        <TypingDots />
                      ) : (
                        <span>
                          {typed.shown}
                          {!typed.done && <span className="inline-block w-[2px] h-[1em] align-[-2px] ml-0.5 bg-coral-500 animate-pulse" />}
                        </span>
                      )}
                    </ChatBubble>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {tickets.isError && !tickets.data && (
              <div className="mt-6 text-center text-[13.5px] text-ink-500 font-semibold">
                Couldn't load earlier messages. <button type="button" className="underline text-coral-600 font-extrabold" onClick={() => tickets.refetch()}>Retry</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggestions + composer */}
      <div className="relative bg-paper-50" style={{ paddingBottom: keyboard.open ? 8 : "calc(var(--safe-bottom) + 10px)" }}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-paper-50 to-transparent" />
        <AnimatePresence initial={false}>
          {showSuggestions && (
            <motion.div key="sugg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
              <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-2 pb-2">
                {suggestions.map((s) => (
                  <motion.div key={s} variants={item.pop} className="shrink-0">
                    <Chip tone="sun" icon={Sparkle} onClick={() => submit(s)}>
                      {s}
                    </Chip>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <form
          className="flex items-end gap-2 px-4 pt-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex-1 flex items-end rounded-[24px] bg-white border-2 border-transparent focus-within:border-coral-400 shadow-pillow px-4 py-2 min-h-12 transition-colors">
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
              className="w-full bg-transparent outline-none resize-none text-[15px] font-semibold text-ink-900 placeholder:text-ink-300 placeholder:font-medium max-h-32 leading-6 py-0.5"
              style={{ height: Math.min(128, 24 * Math.max(1, draft.split("\n").length) + 4) }}
              enterKeyHint="enter"
              disabled={busy}
            />
          </div>
          <IconButton icon={PaperPlaneRight} label="Send" variant="coral" weight="fill" size={48} type="submit" disabled={!canSend} className={cn("transition-opacity", !canSend && "opacity-50")} />
        </form>
      </div>
    </div>
  );
}

function AssistantLabel() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex size-4 rounded-full bg-coral-100 items-center justify-center">
        <span className="size-1.5 rounded-full bg-coral-500" />
      </span>
      Raahi assistant
    </span>
  );
}

function Intro({ name }: { name: string }) {
  const buddyFloat = float(6, 4);
  return (
    <motion.div variants={stagger(0.08, 0.1)} initial="hidden" animate="show" className="relative flex flex-col items-center text-center gap-3 pt-6 pb-6 px-4">
      <motion.div variants={item.pop} className="relative">
        <span aria-hidden className="blob absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-40 bg-coral-100" />
        <span aria-hidden className="blob absolute left-[60%] top-[55%] -translate-x-1/2 -translate-y-1/2 size-28 bg-sun-100" style={{ animationDelay: "-7s" }} />
        <motion.div {...buddyFloat} className="relative">
          <Buddy state="idle" size={150} />
        </motion.div>
      </motion.div>
      <motion.h2 variants={item.up} className="font-display text-[24px] font-semibold text-ink-900 leading-tight">
        Hi {name}, <span className="text-coral-500">how can we help?</span>
      </motion.h2>
      <motion.p variants={item.up} className="text-[14.5px] text-ink-500 leading-relaxed max-w-xs font-medium">
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
        tone={mine ? "coral" : m.sender === "admin" ? "lavender" : "white"}
        grouped={grouped && !newDay}
        label={mine ? undefined : m.sender === "admin" ? <span className="inline-flex items-center gap-1 text-lavender-600"><ShieldCheck className="size-3.5" weight="fill" /> Raahi team</span> : <AssistantLabel />}
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
      <span className="flex-1 h-px bg-paper-200" />
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-400">{label}</span>
      <span className="flex-1 h-px bg-paper-200" />
    </div>
  );
}
