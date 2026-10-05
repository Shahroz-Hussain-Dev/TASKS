"use client";

import { CaretDown, Scroll } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { adminApi, type AuditLogDto } from "@/lib/admin-client";
import { cn, fmtDateTime, shortId, type Tone } from "@/components/admin/format";
import { item, stagger } from "@/components/admin/motion";
import { Badge, Card, Chips, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";

const TARGETS = ["all", "driver", "user", "document", "subscription", "settings", "support_ticket", "ride", "session"] as const;
type Target = (typeof TARGETS)[number];
const TARGET_LABEL: Record<Target, string> = {
  all: "All",
  driver: "Drivers",
  user: "Users",
  document: "Documents",
  subscription: "Subscriptions",
  settings: "Settings",
  support_ticket: "Support",
  ride: "Rides",
  session: "Sessions",
};
const PAGE_SIZE = 30;

function actionTone(action: string): Tone {
  if (/approve|verified|unblock|reinstate|resolve|active/.test(action)) return "mint";
  if (/reject|block|suspend|delete|fail/.test(action)) return "rose";
  if (/settings|update|reverify/.test(action)) return "sun";
  if (/login|logout|auth/.test(action)) return "sky";
  if (/reply|support/.test(action)) return "lavender";
  return "neutral";
}

function describeMeta(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v === null || v === undefined || typeof v === "object") continue;
    parts.push(`${k}: ${String(v)}`);
    if (parts.length >= 3) break;
  }
  return parts.join(" · ");
}

export default function AuditPage() {
  const [target, setTarget] = useState<Target>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [target, debouncedQ]);

  const params = { page, pageSize: PAGE_SIZE, q: debouncedQ || undefined, status: target === "all" ? undefined : target };
  const list = useQuery({ queryKey: ["admin", "audit", params], queryFn: ({ signal }) => adminApi.audit.list(params, signal), placeholderData: (prev) => prev });

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin decision and sign-in, newest first. Entries are immutable." />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-paper-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Chips<Target> value={target} onChange={setTarget} layoutId="audit-filter" options={TARGETS.map((t) => ({ value: t, label: TARGET_LABEL[t] }))} />
          <SearchInput value={q} onChange={setQ} placeholder="Action, actor or target id" className="lg:w-72" />
        </div>
        {list.isPending ? (
          <TableSkeleton rows={10} cols={5} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<Scroll size={26} weight="duotone" />} title="Nothing logged yet" description={debouncedQ ? "No entries match this search." : "Admin actions will show up here as they happen."} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Details</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <motion.tbody key={`${target}-${page}-${debouncedQ}`} variants={stagger(0.02, 0)} initial="hidden" animate="show" className={list.isPlaceholderData ? "opacity-60" : ""}>
                {list.data.items.map((row) => (
                  <AuditRow key={row.id} row={row} expanded={expanded === row.id} onToggle={() => setExpanded(expanded === row.id ? null : row.id)} />
                ))}
              </motion.tbody>
            </Table>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

function AuditRow({ row, expanded, onToggle }: { row: AuditLogDto; expanded: boolean; onToggle: () => void }) {
  const hasMeta = row.meta && Object.keys(row.meta).length > 0;
  return (
    <>
      <motion.tr variants={item.fade} className={cn("cursor-pointer transition-colors hover:bg-paper-50", expanded && "bg-paper-50")} onClick={hasMeta ? onToggle : undefined}>
        <Td className="whitespace-nowrap text-ink-700">{fmtDateTime(row.createdAt)}</Td>
        <Td>
          <p className="text-ink-900">{row.actorName ?? (row.actorId ? shortId(row.actorId) : "System")}</p>
          <p className="text-[12px] text-ink-500">{row.actorRole ?? "—"}</p>
        </Td>
        <Td>
          <Badge tone={actionTone(row.action)}>{row.action}</Badge>
        </Td>
        <Td>
          <p className="text-ink-900">{row.targetType ?? "—"}</p>
          <p className="font-mono text-[11.5px] text-ink-500">{shortId(row.targetId)}</p>
        </Td>
        <Td className="max-w-[320px]">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] text-ink-700">{describeMeta(row.meta) || "—"}</span>
            {hasMeta ? <CaretDown size={14} weight="bold" className={cn("shrink-0 text-ink-500 transition-transform", expanded && "rotate-180")} /> : null}
          </div>
        </Td>
        <Td className="font-mono text-[12px] text-ink-500">{row.ip ?? "—"}</Td>
      </motion.tr>
      <AnimatePresence initial={false}>
        {expanded && hasMeta ? (
          <tr>
            <td colSpan={6} className="border-t border-paper-200 bg-paper-100 px-5">
              <motion.pre initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-x-auto py-3 font-mono text-[12px] leading-relaxed text-ink-700">
                {JSON.stringify(row.meta, null, 2)}
              </motion.pre>
            </td>
          </tr>
        ) : null}
      </AnimatePresence>
    </>
  );
}
