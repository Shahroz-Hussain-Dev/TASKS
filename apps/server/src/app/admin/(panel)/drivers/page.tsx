"use client";

import { CaretRight, Taxi } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DRIVER_STATUSES, type DriverStatus } from "@raahi/shared";
import { adminApi } from "@/lib/admin-client";
import { categoryLabel, DRIVER_STATUS_LABEL, DRIVER_STATUS_TONE, fmtDate, pkr, timeAgo } from "@/components/admin/format";
import { item, stagger } from "@/components/admin/motion";
import { Avatar, Badge, Card, Chips, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";

type Filter = "all" | DriverStatus;
const PAGE_SIZE = 20;

function useDebounced<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

function DriversTable() {
  const search = useSearchParams();
  const router = useRouter();
  const initial = search.get("status");
  const [filter, setFilter] = useState<Filter>(initial && (DRIVER_STATUSES as readonly string[]).includes(initial) ? (initial as DriverStatus) : "all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q.trim());

  useEffect(() => setPage(1), [filter, debouncedQ]);

  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: ({ signal }) => adminApi.stats(signal), refetchInterval: 30_000 });
  const params = { page, pageSize: PAGE_SIZE, q: debouncedQ || undefined, status: filter === "all" ? undefined : filter };
  const list = useQuery({
    queryKey: ["admin", "drivers", params],
    queryFn: ({ signal }) => adminApi.drivers.list(params, signal),
    placeholderData: (prev) => prev,
  });

  const changeFilter = (f: Filter) => {
    setFilter(f);
    router.replace(f === "all" ? "/admin/drivers" : `/admin/drivers?status=${f}`, { scroll: false });
  };

  const options = [
    { value: "all" as Filter, label: "All" },
    ...DRIVER_STATUSES.map((s) => ({ value: s as Filter, label: DRIVER_STATUS_LABEL[s], count: s === "under_review" ? stats.data?.driversPendingReview : undefined })),
  ];

  return (
    <>
      <PageHeader title="Drivers" subtitle="Review applications, inspect documents and manage who is on the road." />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-paper-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Chips<Filter> value={filter} onChange={changeFilter} options={options} layoutId="drivers-filter" />
          <SearchInput value={q} onChange={setQ} placeholder="Name, phone or CNIC" className="lg:w-72" />
        </div>

        {list.isPending ? (
          <TableSkeleton rows={8} cols={6} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<Taxi size={26} weight="duotone" />} title={debouncedQ ? "No drivers match" : "No drivers here"} description={debouncedQ ? "Try a different name, phone number or CNIC." : filter === "under_review" ? "Nobody is waiting for review." : "Drivers will appear here as they sign up."} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Driver</Th>
                  <Th>Status</Th>
                  <Th>Vehicle</Th>
                  <Th>Documents</Th>
                  <Th>Subscription</Th>
                  <Th>Rides</Th>
                  <Th>Joined</Th>
                  <Th />
                </tr>
              </thead>
              <motion.tbody key={`${filter}-${page}-${debouncedQ}`} variants={stagger(0.03, 0)} initial="hidden" animate="show" className={list.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {list.data.items.map((d) => {
                  const verified = d.documents.filter((x) => x.status === "verified").length;
                  const flagged = d.documents.filter((x) => x.status === "flagged" || x.status === "rejected").length;
                  return (
                    <motion.tr key={d.id} variants={item.fade} className="group cursor-pointer transition-colors hover:bg-paper-50" onClick={() => router.push(`/admin/drivers/${d.id}`)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={d.user.fullName} src={d.user.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-ink-900">{d.user.fullName}</p>
                            <p className="truncate text-[12.5px] text-ink-500">
                              {d.user.phone ?? "No phone"} {d.city ? `· ${d.city}` : ""}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={DRIVER_STATUS_TONE[d.status]} dot={d.isOnline}>
                            {DRIVER_STATUS_LABEL[d.status]}
                          </Badge>
                          {d.isOnline ? <Badge tone="teal" dot>Online now</Badge> : null}
                        </div>
                      </Td>
                      <Td>
                        {d.vehicle ? (
                          <>
                            <p className="text-ink-900">
                              {d.vehicle.make} {d.vehicle.model}
                            </p>
                            <p className="text-[12.5px] text-ink-500">
                              {categoryLabel(d.vehicle.category)} · {d.vehicle.plate}
                            </p>
                          </>
                        ) : (
                          <span className="text-ink-500">Not added</span>
                        )}
                      </Td>
                      <Td>
                        <span className="font-bold text-ink-900">{verified}</span>
                        <span className="text-ink-500">/{d.documents.length} verified</span>
                        {flagged > 0 ? <p className="text-[12.5px] font-semibold text-sun-700">{flagged} need attention</p> : null}
                      </Td>
                      <Td>
                        {d.subscriptionActive ? (
                          <Badge tone="mint">Active</Badge>
                        ) : d.subscription?.status === "pending" ? (
                          <Badge tone="sun">Receipt pending</Badge>
                        ) : (
                          <Badge tone="neutral">{d.subscription ? "Expired" : "None"}</Badge>
                        )}
                      </Td>
                      <Td>
                        <p className="text-ink-900">{d.totalRides}</p>
                        <p className="text-[12.5px] text-ink-500">{pkr(d.totalEarningsPkr, { compact: true })}</p>
                      </Td>
                      <Td>
                        <p className="text-ink-900">{fmtDate(d.createdAt)}</p>
                        <p className="text-[12.5px] text-ink-500">{timeAgo(d.createdAt)}</p>
                      </Td>
                      <Td className="w-10 text-right">
                        <Link href={`/admin/drivers/${d.id}`} className="text-ink-300 transition-colors group-hover:text-coral-600" aria-label={`Open ${d.user.fullName}`}>
                          <CaretRight size={18} weight="bold" />
                        </Link>
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
    </>
  );
}

export default function DriversPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} cols={6} />}>
      <DriversTable />
    </Suspense>
  );
}
