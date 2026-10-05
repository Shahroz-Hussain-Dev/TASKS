"use client";

import { Prohibit, Star, UserCheck, UsersThree } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { UserDto } from "@raahi/shared";
import { adminApi, errorMessage, type AdminCustomerItem } from "@/lib/admin-client";
import { fmtDate, timeAgo } from "@/components/admin/format";
import { item, stagger } from "@/components/admin/motion";
import { useToast } from "@/components/admin/toast";
import { Avatar, Badge, Button, Card, Chips, EmptyState, ErrorState, PageHeader, Pagination, ReasonDialog, SearchInput, Table, TableSkeleton, Td, Th } from "@/components/admin/ui";

type Filter = "all" | "active" | "blocked";
const PAGE_SIZE = 20;

export default function CustomersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminCustomerItem | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [filter, debouncedQ]);

  const params = { page, pageSize: PAGE_SIZE, q: debouncedQ || undefined, status: filter === "all" ? undefined : filter };
  const list = useQuery({ queryKey: ["admin", "customers", params], queryFn: ({ signal }) => adminApi.customers.list(params, signal), placeholderData: (prev) => prev });

  const action = useMutation({
    mutationFn: ({ user, act }: { user: UserDto; act: "block" | "unblock" }) => adminApi.users.action(user.id, act, reason.trim() || undefined),
    onSuccess: (updated) => {
      toast.success(updated.isBlocked ? "Customer blocked" : "Customer unblocked", updated.isBlocked ? `${updated.fullName} has been signed out everywhere.` : `${updated.fullName} can sign in again.`);
      setTarget(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (err) => toast.error("Couldn't update this customer", errorMessage(err)),
  });

  return (
    <>
      <PageHeader title="Customers" subtitle="Passenger accounts, ride counts and ratings." />
      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-paper-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Chips<Filter> value={filter} onChange={setFilter} layoutId="customers-filter" options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "blocked", label: "Blocked" }]} />
          <SearchInput value={q} onChange={setQ} placeholder="Name, phone or email" className="lg:w-72" />
        </div>

        {list.isPending ? (
          <TableSkeleton rows={8} cols={5} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<UsersThree size={26} weight="duotone" />} title={debouncedQ ? "No customers match" : "No customers yet"} description={debouncedQ ? "Try another name, phone number or email." : "Passengers appear here as soon as they create an account."} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Contact</Th>
                  <Th>Rides</Th>
                  <Th>Rating</Th>
                  <Th>Joined</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <motion.tbody key={`${filter}-${page}-${debouncedQ}`} variants={stagger(0.03, 0)} initial="hidden" animate="show" className={list.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {list.data.items.map((c) => (
                  <motion.tr key={c.id} variants={item.fade} className="transition-colors hover:bg-paper-50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.fullName} src={c.avatarUrl} />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-ink-900">{c.fullName}</p>
                          <p className="truncate text-[12px] text-ink-500">{c.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="text-ink-900">{c.phone ?? "—"}</p>
                      <p className="truncate text-[12.5px] text-ink-500">{c.email ?? "No email"}</p>
                    </Td>
                    <Td>
                      <span className="font-bold text-ink-900">{c.rides}</span>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1 text-ink-900">
                        <Star size={14} weight="fill" className="text-sun-500" /> {c.ratingAvg.toFixed(1)}
                        <span className="text-[12.5px] text-ink-500">({c.ratingCount})</span>
                      </span>
                    </Td>
                    <Td>
                      <p className="text-ink-900">{fmtDate(c.createdAt)}</p>
                      <p className="text-[12.5px] text-ink-500">{timeAgo(c.createdAt)}</p>
                    </Td>
                    <Td>{c.isBlocked ? <Badge tone="rose">Blocked</Badge> : <Badge tone="mint">Active</Badge>}</Td>
                    <Td className="text-right">
                      {c.isBlocked ? (
                        <Button size="sm" variant="teal" icon={<UserCheck size={15} weight="fill" />} onClick={() => setTarget(c)}>
                          Unblock
                        </Button>
                      ) : (
                        <Button size="sm" variant="danger" icon={<Prohibit size={15} weight="bold" />} onClick={() => setTarget(c)}>
                          Block
                        </Button>
                      )}
                    </Td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </Table>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>

      <ReasonDialog
        open={target !== null}
        onClose={() => {
          setTarget(null);
          setReason("");
        }}
        onConfirm={() => target && action.mutate({ user: target, act: target.isBlocked ? "unblock" : "block" })}
        title={target?.isBlocked ? `Unblock ${target.fullName}?` : `Block ${target?.fullName ?? "this customer"}?`}
        description={target?.isBlocked ? "They will be able to sign in and request rides again." : "Blocking signs them out of every device and prevents new ride requests. Open rides are not affected."}
        confirmLabel={target?.isBlocked ? "Unblock" : "Block customer"}
        tone={target?.isBlocked ? "teal" : "danger"}
        reasonLabel="Note for the audit log"
        reasonPlaceholder={target?.isBlocked ? "Why are they being unblocked?" : "Repeated no-shows, abuse, fraud…"}
        reason={reason}
        onReasonChange={setReason}
        loading={action.isPending}
        maxLength={300}
      />
    </>
  );
}
