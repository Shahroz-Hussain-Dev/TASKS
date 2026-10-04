"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Car } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RIDE_STATUSES, type RideDto, type RideStatus } from "@raahi/shared";
import { adminApi } from "@/lib/admin-client";
import { RideDrawer } from "@/components/admin/RideDrawer";
import { categoryLabel, fmtDateTime, km, minutes, pkr, RIDE_STATUS_LABEL, RIDE_STATUS_TONE, timeAgo } from "@/components/admin/format";
import { item, stagger } from "@/components/admin/motion";
import { Avatar, Badge, Card, Chips, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";

type Filter = "all" | "active" | RideStatus;
const PAGE_SIZE = 20;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  ...RIDE_STATUSES.map((s) => ({ value: s as Filter, label: RIDE_STATUS_LABEL[s] })),
];

export default function RidesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RideDto | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [filter, debouncedQ]);

  const params = { page, pageSize: PAGE_SIZE, q: debouncedQ || undefined, status: filter === "all" || filter === "active" ? undefined : filter };
  const list = useQuery({
    queryKey: ["admin", "rides", params],
    queryFn: ({ signal }) => adminApi.rides.list(params, signal),
    placeholderData: (prev) => prev,
    refetchInterval: filter === "active" ? 10_000 : false,
  });

  const rows = useMemo(() => {
    const items = list.data?.items ?? [];
    return filter === "active" ? items.filter((r) => r.status === "assigned" || r.status === "arrived" || r.status === "in_progress") : items;
  }, [list.data, filter]);

  return (
    <>
      <PageHeader title="Rides" subtitle="Every trip on the platform. Open a row to see the route, the people and the money." />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Chips<Filter> value={filter} onChange={setFilter} options={FILTERS} layoutId="rides-filter" />
          <SearchInput value={q} onChange={setQ} placeholder="Passenger, driver, address or id" className="lg:w-80" />
        </div>
        {list.isPending ? (
          <TableSkeleton rows={8} cols={6} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Car size={24} />} title={filter === "active" ? "No rides in progress" : "No rides found"} description={filter === "active" ? "Trips will appear here the moment a passenger accepts a bid." : debouncedQ ? "Try another name, address or id." : "Completed and cancelled trips are listed here."} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Route</Th>
                  <Th>Passenger</Th>
                  <Th>Driver</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Fare</Th>
                </tr>
              </thead>
              <motion.tbody key={`${filter}-${page}-${debouncedQ}`} variants={stagger(0.03, 0)} initial="hidden" animate="show" className={list.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {rows.map((r) => (
                  <motion.tr key={r.id} variants={item.fade} className="cursor-pointer hover:bg-white/3" onClick={() => setSelected(r)}>
                    <Td className="whitespace-nowrap">
                      <p className="text-ink-100">{fmtDateTime(r.createdAt)}</p>
                      <p className="text-[12px] text-ink-500">{timeAgo(r.createdAt)}</p>
                    </Td>
                    <Td className="max-w-[300px]">
                      <p className="truncate text-ink-100">{r.pickup.name ?? r.pickup.address}</p>
                      <p className="truncate text-[12.5px] text-ink-400">→ {r.dropoff.name ?? r.dropoff.address}</p>
                      <p className="text-[12px] text-ink-500">
                        {km(r.distanceKm)} · {minutes(r.durationMin)}
                      </p>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.customer.fullName} src={r.customer.avatarUrl} size={28} />
                        <span className="truncate text-ink-100">{r.customer.fullName}</span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.driver.fullName} src={r.driver.avatarUrl} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-ink-100">{r.driver.fullName}</p>
                          <p className="truncate text-[12px] text-ink-500">{r.driver.vehicle?.plate ?? "—"}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>{categoryLabel(r.category)}</Td>
                    <Td>
                      <Badge tone={RIDE_STATUS_TONE[r.status]} dot={r.status === "in_progress"}>
                        {RIDE_STATUS_LABEL[r.status]}
                      </Badge>
                    </Td>
                    <Td className="text-right font-display font-semibold text-ink-50">{pkr(r.farePkr)}</Td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </Table>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>

      <RideDrawer ride={selected} onClose={() => setSelected(null)} />
    </>
  );
}
