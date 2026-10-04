"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, CheckCircle2, LifeBuoy, Phone, Send, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { SupportMessageDto, SupportTicketDto } from "@raahi/shared";
import { adminApi, errorMessage } from "@/lib/admin-client";
import { cn, fmtDateTime, fmtTime, TICKET_STATUS_LABEL, TICKET_STATUS_TONE, timeAgo } from "@/components/admin/format";
import { spring, springSoft } from "@/components/admin/motion";
import { useToast } from "@/components/admin/toast";
import { Avatar, Badge, Button, Card, Chips, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Skeleton, Textarea, Toggle } from "@/components/admin/ui";

type Filter = "all" | "escalated" | "open" | "awaiting_user" | "resolved";
const PAGE_SIZE = 25;

function SupportInbox() {
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(search.get("ticket"));
  const [reply, setReply] = useState("");
  const [resolve, setResolve] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [filter, debouncedQ]);

  const params = { page, pageSize: PAGE_SIZE, q: debouncedQ || undefined, status: filter === "all" ? undefined : filter };
  const list = useQuery({ queryKey: ["admin", "support", params], queryFn: ({ signal }) => adminApi.support.list(params, signal), placeholderData: (prev) => prev, refetchInterval: 15_000 });

  // The selected ticket may be on a different page; look it up separately by id when needed.
  const fromList = list.data?.items.find((t) => t.id === selectedId);
  const single = useQuery({
    queryKey: ["admin", "support", "one", selectedId],
    queryFn: ({ signal }) => adminApi.support.list({ q: selectedId ?? undefined, page: 1, pageSize: 1 }, signal),
    enabled: !!selectedId && !fromList,
    select: (res) => res.items.find((t) => t.id === selectedId) ?? null,
  });
  const ticket: SupportTicketDto | null = fromList ?? single.data ?? null;

  useEffect(() => {
    setReply("");
    setResolve(false);
  }, [selectedId]);

  const select = (id: string | null) => {
    setSelectedId(id);
    router.replace(id ? `/admin/support?ticket=${id}` : "/admin/support", { scroll: false });
  };

  const send = useMutation({
    mutationFn: () => adminApi.support.reply(ticket!.id, reply.trim(), resolve),
    onSuccess: (updated) => {
      toast.success(updated.status === "resolved" ? "Ticket resolved" : "Reply sent", `${updated.user?.fullName ?? "The user"} has been notified.`);
      setReply("");
      setResolve(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (err) => toast.error("Reply not sent", errorMessage(err)),
  });

  const counts = useMemo(() => ({ escalated: list.data?.items.filter((t) => t.escalated && t.status === "open").length ?? 0 }), [list.data]);

  return (
    <>
      <PageHeader title="Support" subtitle="Conversations the Gemini assistant handed over, plus anything still open. Escalated tickets come first." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_1fr]">
        <Card padded={false} className="flex max-h-[78vh] min-h-[520px] flex-col">
          <div className="space-y-3 border-b border-white/5 p-3">
            <Chips<Filter>
              value={filter}
              onChange={setFilter}
              layoutId="support-filter"
              options={[
                { value: "all", label: "All" },
                { value: "escalated", label: "Escalated", count: filter === "all" ? counts.escalated || undefined : undefined },
                { value: "open", label: "Open" },
                { value: "awaiting_user", label: "Awaiting user" },
                { value: "resolved", label: "Resolved" },
              ]}
            />
            <SearchInput value={q} onChange={setQ} placeholder="Subject, name or phone" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.isPending ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[72px]" />
                ))}
              </div>
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : list.data.items.length === 0 ? (
              <EmptyState icon={<LifeBuoy size={22} />} title="Nothing here" description={filter === "all" ? "No support conversations yet." : "No tickets match this filter."} className="py-10" />
            ) : (
              <ul className="divide-y divide-white/5">
                {list.data.items.map((t) => {
                  const last = t.messages[t.messages.length - 1];
                  const active = t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => select(t.id)} className={cn("relative w-full px-4 py-3 text-left transition-colors hover:bg-white/3", active && "bg-brand-500/10")}>
                        {active ? <motion.span layoutId="support-active" transition={spring} className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-brand-400" /> : null}
                        <div className="flex items-center gap-3">
                          <Avatar name={t.user?.fullName} src={t.user?.avatarUrl} size={34} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[14px] font-semibold text-ink-50">{t.user?.fullName ?? "Unknown user"}</p>
                              <span className="shrink-0 text-[11.5px] text-ink-500">{timeAgo(t.updatedAt)}</span>
                            </div>
                            <p className="truncate text-[13px] text-ink-300">{t.subject}</p>
                            <p className="truncate text-[12.5px] text-ink-500">{last ? `${last.sender === "admin" ? "You: " : last.sender === "assistant" ? "Assistant: " : ""}${last.body}` : "No messages"}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-1.5 pl-[46px]">
                          {t.escalated && t.status !== "resolved" ? <Badge tone="rose" dot>Escalated</Badge> : null}
                          <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
                          {t.user?.role ? <Badge tone="neutral">{t.user.role}</Badge> : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {list.data ? <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} /> : null}
        </Card>

        <Card padded={false} className="flex max-h-[78vh] min-h-[520px] flex-col">
          {!selectedId ? (
            <EmptyState icon={<LifeBuoy size={24} />} title="Pick a conversation" description="Select a ticket on the left to read the thread and reply as Raahi support." className="my-auto" />
          ) : !ticket ? (
            single.isPending || list.isPending ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-16 w-3/4" />
                <Skeleton className="ml-auto h-16 w-2/3" />
                <Skeleton className="h-16 w-3/4" />
              </div>
            ) : (
              <EmptyState title="Ticket not found" description="It may have been removed or the id is wrong." className="my-auto" action={<Button variant="secondary" onClick={() => select(null)}>Back to inbox</Button>} />
            )
          ) : (
            <Thread ticket={ticket} reply={reply} onReply={setReply} resolve={resolve} onResolve={setResolve} onSend={() => send.mutate()} sending={send.isPending} />
          )}
        </Card>
      </div>
    </>
  );
}

function Thread({ ticket, reply, onReply, resolve, onResolve, onSend, sending }: { ticket: SupportTicketDto; reply: string; onReply: (v: string) => void; resolve: boolean; onResolve: (v: boolean) => void; onSend: () => void; sending: boolean }) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [ticket.messages.length, ticket.id]);

  const canSend = reply.trim().length > 0 && reply.length <= 2000 && !sending;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={ticket.user?.fullName} src={ticket.user?.avatarUrl} size={40} />
          <div className="min-w-0">
            <h2 className="truncate font-display text-[16px] font-semibold text-ink-50">{ticket.subject}</h2>
            <p className="text-[12.5px] text-ink-400">
              {ticket.user?.fullName ?? "Unknown user"}
              {ticket.user?.phone ? (
                <>
                  {" · "}
                  <a href={`tel:${ticket.user.phone}`} className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300">
                    <Phone size={11} /> {ticket.user.phone}
                  </a>
                </>
              ) : null}
              {" · opened "}
              {fmtDateTime(ticket.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ticket.escalated && ticket.status !== "resolved" ? <Badge tone="rose" dot>Escalated</Badge> : null}
          <Badge tone={TICKET_STATUS_TONE[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</Badge>
          {ticket.user?.role === "driver" ? (
            <Link href={`/admin/drivers?q=${encodeURIComponent(ticket.user.phone ?? ticket.user.fullName)}`} className="text-[12.5px] font-semibold text-brand-400 hover:text-brand-300">
              Driver profile
            </Link>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {ticket.messages.length === 0 ? <p className="py-10 text-center text-[13.5px] text-ink-500">No messages in this ticket yet.</p> : null}
        <AnimatePresence initial={false}>
          {ticket.messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
        </AnimatePresence>
        <div ref={bottom} />
      </div>

      <footer className="space-y-3 border-t border-white/6 p-4">
        <Textarea value={reply} onChange={(e) => onReply(e.target.value.slice(0, 2000))} placeholder={ticket.status === "resolved" ? "Reopen the conversation with a reply…" : "Write a reply as Raahi support…"} className="min-h-[88px]" onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSend) onSend();
        }} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-300">
            <span className="w-[200px]">
              <Toggle checked={resolve} onChange={onResolve} label="Mark as resolved" />
            </span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-ink-500">{reply.length}/2000 · Ctrl+Enter to send</span>
            <Button icon={resolve ? <CheckCircle2 size={16} /> : <Send size={16} />} onClick={onSend} disabled={!canSend} loading={sending}>
              {resolve ? "Send & resolve" : "Send reply"}
            </Button>
          </div>
        </div>
      </footer>
    </>
  );
}

function Bubble({ message }: { message: SupportMessageDto }) {
  const mine = message.sender === "admin";
  const bot = message.sender === "assistant";
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={springSoft} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine ? (
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", bot ? "bg-violet-400/15 text-violet-400" : "bg-ink-700 text-ink-300")}>{bot ? <Bot size={14} /> : <UserRound size={14} />}</span>
      ) : null}
      <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed", mine ? "rounded-br-md bg-brand-500 text-ink-950" : bot ? "glass rounded-bl-md text-ink-200" : "rounded-bl-md bg-ink-700 text-ink-100")}>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={cn("mt-1 text-[11px]", mine ? "text-ink-950/70" : "text-ink-500")}>
          {bot ? "Assistant · " : mine ? "Raahi support · " : ""}
          {fmtTime(message.createdAt)}
        </p>
      </div>
      {mine ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-brand-300">
          <ShieldCheck size={14} />
        </span>
      ) : null}
    </motion.div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh]" />}>
      <SupportInbox />
    </Suspense>
  );
}
