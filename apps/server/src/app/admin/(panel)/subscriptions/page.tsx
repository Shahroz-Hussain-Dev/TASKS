"use client";

import { Receipt, SealCheck, XCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@raahi/shared";
import { adminApi, errorMessage, fileUrl, type AdminSubscriptionItem } from "@/lib/admin-client";
import { fmtDate, fmtDateTime, pkr, SUB_STATUS_LABEL, SUB_STATUS_TONE } from "@/components/admin/format";
import { Lightbox, type LightboxImage } from "@/components/admin/Lightbox";
import { item, stagger } from "@/components/admin/motion";
import { useToast } from "@/components/admin/toast";
import { Badge, Button, Card, Chips, EmptyState, ErrorState, PageHeader, Pagination, ReasonDialog, SearchInput, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";

type Filter = "all" | SubscriptionStatus;
const PAGE_SIZE = 20;
type Decision = { sub: AdminSubscriptionItem; kind: "approve" | "reject" };

export default function SubscriptionsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [filter, debouncedQ]);

  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: ({ signal }) => adminApi.settings.get(signal), staleTime: 300_000 });
  const params = { page, pageSize: PAGE_SIZE, q: debouncedQ || undefined, status: filter === "all" ? undefined : filter };
  const list = useQuery({ queryKey: ["admin", "subscriptions", params], queryFn: ({ signal }) => adminApi.subscriptions.list(params, signal), placeholderData: (prev) => prev, refetchInterval: filter === "pending" ? 20_000 : false });

  const images = useMemo<LightboxImage[]>(
    () => (list.data?.items ?? []).filter((s) => s.receiptFileId).map((s) => ({ src: fileUrl(s.receiptFileId!), title: `${s.driver.fullName} · ${pkr(s.amountPkr)}`, caption: `${s.method}${s.transactionRef ? ` · ref ${s.transactionRef}` : ""} · uploaded ${fmtDateTime(s.createdAt)}` })),
    [list.data],
  );

  const decide = useMutation({
    mutationFn: ({ sub, kind }: Decision) => adminApi.subscriptions.decide(sub.id, kind, note.trim() || undefined),
    onSuccess: (updated, { sub, kind }) => {
      toast.success(kind === "approve" ? "Subscription activated" : "Receipt rejected", kind === "approve" ? `${sub.driver.fullName} is active until ${fmtDate(updated.endsAt)}.` : `${sub.driver.fullName} has been asked to upload a clearer receipt.`);
      setDecision(null);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (err) => toast.error("Decision not saved", errorMessage(err)),
  });

  const expected = settings.data?.driverSubscriptionPkr;

  return (
    <>
      <PageHeader title="Subscriptions" subtitle={`Driver payments of ${expected ? pkr(expected) : "the monthly fee"} · pending receipts are listed first.${settings.data?.autoApproveSubscriptionReceipts ? " Auto-approve is ON — new receipts activate instantly." : ""}`} />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-paper-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Chips<Filter> value={filter} onChange={setFilter} layoutId="subs-filter" options={[{ value: "pending", label: "Pending" }, ...SUBSCRIPTION_STATUSES.filter((s) => s !== "pending").map((s) => ({ value: s as Filter, label: SUB_STATUS_LABEL[s] })), { value: "all", label: "All" }]} />
          <SearchInput value={q} onChange={setQ} placeholder="Driver, phone or transaction ref" className="lg:w-80" />
        </div>
        {list.isPending ? (
          <TableSkeleton rows={6} cols={6} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<Receipt size={26} weight="duotone" />} title={filter === "pending" ? "No receipts waiting" : "No subscriptions found"} description={filter === "pending" ? "New payment uploads will appear here for review." : "Try another filter or search term."} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Receipt</Th>
                  <Th>Driver</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th>Period</Th>
                  <Th>Uploaded</Th>
                  <Th className="text-right">Decision</Th>
                </tr>
              </thead>
              <motion.tbody key={`${filter}-${page}-${debouncedQ}`} variants={stagger(0.03, 0)} initial="hidden" animate="show" className={list.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {list.data.items.map((s) => {
                  const mismatch = expected !== undefined && s.amountPkr !== expected;
                  return (
                    <motion.tr key={s.id} variants={item.fade} className="transition-colors hover:bg-paper-50">
                      <Td>
                        {s.receiptFileId ? (
                          <button type="button" onClick={() => setLightbox(images.findIndex((img) => img.src === fileUrl(s.receiptFileId!)))} className="group relative block h-16 w-20 overflow-hidden rounded-xl bg-paper-100 ring-1 ring-paper-200" aria-label="Open receipt">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fileUrl(s.receiptFileId)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          </button>
                        ) : (
                          <span className="inline-flex h-16 w-20 items-center justify-center rounded-xl bg-teal-50 px-1 text-center text-[11px] font-bold leading-tight text-teal-700">One-tap (test)</span>
                        )}
                      </Td>
                      <Td>
                        <Link href={`/admin/drivers/${s.driver.id}`} className="font-bold text-ink-900 hover:text-coral-600">
                          {s.driver.fullName}
                        </Link>
                        <p className="text-[12.5px] text-ink-500">{s.driver.phone ?? "No phone"}</p>
                      </Td>
                      <Td>
                        <p className={`font-display font-semibold tabular-nums ${mismatch ? "text-sun-700" : "text-ink-900"}`}>{pkr(s.amountPkr)}</p>
                        <p className="text-[12.5px] text-ink-500">
                          {s.method}
                          {s.transactionRef ? ` · ${s.transactionRef}` : ""}
                        </p>
                        {mismatch ? <p className="text-[12px] font-semibold text-sun-700">Expected {pkr(expected)}</p> : null}
                      </Td>
                      <Td>
                        <Badge tone={SUB_STATUS_TONE[s.status]}>{SUB_STATUS_LABEL[s.status]}</Badge>
                        {s.reviewerNote ? <p className="mt-1 max-w-[200px] truncate text-[12px] text-ink-500">{s.reviewerNote}</p> : null}
                      </Td>
                      <Td className="whitespace-nowrap text-ink-700">{s.startsAt ? `${fmtDate(s.startsAt)} → ${fmtDate(s.endsAt)}` : "—"}</Td>
                      <Td className="whitespace-nowrap text-ink-700">{fmtDateTime(s.createdAt)}</Td>
                      <Td className="text-right">
                        {s.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="teal" icon={<SealCheck size={15} weight="fill" />} onClick={() => setDecision({ sub: s, kind: "approve" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="danger" icon={<XCircle size={15} weight="fill" />} onClick={() => setDecision({ sub: s, kind: "reject" })}>
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[12.5px] text-ink-500">Decided</span>
                        )}
                      </Td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </Table>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>

      <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} onIndexChange={setLightbox} />

      {decision ? (
        <ReasonDialog
          open
          onClose={() => {
            setDecision(null);
            setNote("");
          }}
          onConfirm={() => decide.mutate(decision)}
          title={decision.kind === "approve" ? `Activate ${decision.sub.driver.fullName}'s subscription?` : `Reject ${decision.sub.driver.fullName}'s receipt`}
          description={decision.kind === "approve" ? `Confirms ${pkr(decision.sub.amountPkr)} via ${decision.sub.method}. The ${settings.data?.subscriptionDays ?? 30}-day period starts now (or extends an active one).` : "The driver is notified and asked to pay or upload a clearer screenshot."}
          confirmLabel={decision.kind === "approve" ? "Approve & activate" : "Reject receipt"}
          tone={decision.kind === "approve" ? "teal" : "danger"}
          reasonLabel="Note for the driver"
          reasonPlaceholder={decision.kind === "approve" ? "Optional" : "e.g. The amount on the receipt is PKR 500, not PKR 1,000."}
          reason={note}
          onReasonChange={setNote}
          loading={decide.isPending}
          maxLength={300}
        />
      ) : null}
    </>
  );
}
