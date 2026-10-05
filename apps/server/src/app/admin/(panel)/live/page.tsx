"use client";

import { Broadcast, Car, Crosshair, HandPalm } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { decodePolyline, type LatLng, type RideDto, type RideRequestDto } from "@raahi/shared";
import { adminApi, type LiveDriver } from "@/lib/admin-client";
import { AdminMap, type MapLineSpec, type MapMarkerSpec } from "@/components/admin/AdminMap";
import { RideDrawer } from "@/components/admin/RideDrawer";
import { categoryLabel, cn, fmtTime, km, pkr, RIDE_STATUS_LABEL, RIDE_STATUS_TONE, timeAgo, timeUntil } from "@/components/admin/format";
import { spring } from "@/components/admin/motion";
import { Avatar, Badge, Button, Card, Chips, ErrorState, PageHeader, Skeleton } from "@/components/admin/ui";

type Tab = "drivers" | "requests" | "rides";
const POLL_MS = 5_000;

export default function LivePage() {
  const board = useQuery({ queryKey: ["admin", "live"], queryFn: ({ signal }) => adminApi.rides.live(signal), refetchInterval: POLL_MS, refetchIntervalInBackground: false });
  const [tab, setTab] = useState<Tab>("drivers");
  const [focus, setFocus] = useState<{ key: string; points: LatLng[] } | null>(null);
  const [openRide, setOpenRide] = useState<RideDto | null>(null);
  const [fitAllKey, setFitAllKey] = useState(0);

  const data = board.data;

  const markers = useMemo<MapMarkerSpec[]>(() => {
    if (!data) return [];
    const m: MapMarkerSpec[] = data.drivers.map((d) => ({
      id: `driver-${d.id}`,
      lat: d.lat,
      lng: d.lng,
      kind: d.rideId ? "driver-busy" : "driver",
      heading: d.heading,
      label: d.fullName.split(" ")[0],
      onClick: () => {
        setTab("drivers");
        setFocus({ key: `driver-${d.id}`, points: [{ lat: d.lat, lng: d.lng }] });
      },
    }));
    for (const r of data.requests) {
      m.push({ id: `request-${r.id}`, lat: r.pickup.lat, lng: r.pickup.lng, kind: "request", label: pkr(r.offeredFarePkr), onClick: () => focusRequest(r) });
    }
    for (const r of data.rides) {
      m.push({ id: `ride-pickup-${r.id}`, lat: r.pickup.lat, lng: r.pickup.lng, kind: "pickup" });
      m.push({ id: `ride-dropoff-${r.id}`, lat: r.dropoff.lat, lng: r.dropoff.lng, kind: "dropoff" });
    }
    return m;
  }, [data]);

  const lines = useMemo<MapLineSpec[]>(() => {
    if (!data) return [];
    return data.rides.map((r) => {
      const pts = r.routePolyline ? decodePolyline(r.routePolyline) : [];
      return { id: `ride-${r.id}`, points: pts.length >= 2 ? pts : [r.pickup, r.dropoff], color: "#ff6b4a", width: 3, dashed: r.status !== "in_progress" };
    });
  }, [data]);

  const allPoints = useMemo<LatLng[]>(() => {
    if (!data) return [];
    return [...data.drivers.map((d) => ({ lat: d.lat, lng: d.lng })), ...data.requests.map((r) => r.pickup), ...data.rides.flatMap((r) => [r.pickup, r.dropoff])];
  }, [data]);

  const fit = focus ? focus.points : allPoints;
  const fitKey = focus ? focus.key : `all-${fitAllKey}-${allPoints.length > 0 ? "some" : "none"}`;

  function focusRequest(r: RideRequestDto) {
    setTab("requests");
    setFocus({ key: `request-${r.id}`, points: [r.pickup, r.dropoff] });
  }
  function focusRide(r: RideDto) {
    setTab("rides");
    const pts = r.routePolyline ? decodePolyline(r.routePolyline) : [r.pickup, r.dropoff];
    setFocus({ key: `ride-${r.id}`, points: [...pts, ...(r.driverLocation ? [r.driverLocation] : [])] });
  }

  const counts = { drivers: data?.drivers.length ?? 0, requests: data?.requests.length ?? 0, rides: data?.rides.length ?? 0 };

  return (
    <>
      <PageHeader
        title="Live map"
        subtitle={data ? `Refreshes every ${POLL_MS / 1000} s · server time ${fmtTime(data.serverTime)}` : "Online drivers, open requests and rides in progress."}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<Crosshair size={15} weight="bold" />}
            onClick={() => {
              setFocus(null);
              setFitAllKey((k) => k + 1);
            }}
          >
            Fit everything
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="relative">
          <AdminMap className="h-[62vh] min-h-[460px]" markers={markers} lines={lines} fit={fit} fitKey={fitKey} />
          <div className="glass pointer-events-none absolute left-4 top-4 flex flex-wrap gap-3 rounded-full px-3.5 py-2 text-[12.5px] font-bold text-ink-800">
            <LegendDot color="#12a594" label={`${counts.drivers - (data?.drivers.filter((d) => d.rideId).length ?? 0)} free`} />
            <LegendDot color="#ffc53d" label={`${data?.drivers.filter((d) => d.rideId).length ?? 0} on a trip`} />
            <LegendDot color="#8b7cf6" label={`${counts.requests} requests`} />
            <LegendDot color="#ff6b4a" label={`${counts.rides} rides`} />
          </div>
          <AnimatePresence>
            {board.isFetching ? (
              <motion.span key="pulse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-teal-700 shadow-pillow">
                <Broadcast size={13} weight="fill" className="animate-pulse" /> Updating
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        <Card padded={false} className="flex max-h-[62vh] min-h-[460px] flex-col">
          <div className="border-b border-paper-200 p-3">
            <Chips<Tab>
              value={tab}
              onChange={(t) => {
                setTab(t);
                setFocus(null);
              }}
              layoutId="live-tab"
              options={[
                { value: "drivers", label: "Drivers", count: counts.drivers },
                { value: "requests", label: "Requests", count: counts.requests },
                { value: "rides", label: "Rides", count: counts.rides },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {board.isPending ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : board.isError ? (
              <ErrorState error={board.error} onRetry={() => board.refetch()} />
            ) : tab === "drivers" ? (
              <DriverList drivers={data?.drivers ?? []} focusKey={focus?.key ?? null} onFocus={(d) => setFocus({ key: `driver-${d.id}`, points: [{ lat: d.lat, lng: d.lng }] })} />
            ) : tab === "requests" ? (
              <RequestList requests={data?.requests ?? []} focusKey={focus?.key ?? null} onFocus={focusRequest} />
            ) : (
              <RideList rides={data?.rides ?? []} focusKey={focus?.key ?? null} onFocus={focusRide} onOpen={setOpenRide} />
            )}
          </div>
        </Card>
      </div>

      <RideDrawer ride={openRide} onClose={() => setOpenRide(null)} />
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: color }} /> {label}
    </span>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center text-[13.5px] text-ink-500">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-paper-100 text-coral-500">{icon}</span>
      {text}
    </div>
  );
}

const rowClass = (active: boolean) => cn("w-full px-4 py-3 text-left transition-colors hover:bg-paper-50", active && "bg-coral-100/60 hover:bg-coral-100/60");

function DriverList({ drivers, focusKey, onFocus }: { drivers: LiveDriver[]; focusKey: string | null; onFocus: (d: LiveDriver) => void }) {
  if (drivers.length === 0) return <Empty icon={<Car size={24} weight="duotone" />} text="No drivers are online right now." />;
  return (
    <ul className="divide-y divide-paper-200">
      <AnimatePresence initial={false}>
        {drivers.map((d) => (
          <motion.li key={d.id} layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={spring}>
            <button type="button" onClick={() => onFocus(d)} className={rowClass(focusKey === `driver-${d.id}`)}>
              <div className="flex items-center gap-3">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", d.rideId ? "bg-sun-500" : "bg-teal-500")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-ink-900">{d.fullName}</p>
                  <p className="truncate text-[12.5px] text-ink-500">
                    {categoryLabel(d.category)} {d.plate ? `· ${d.plate}` : ""} · seen {timeAgo(d.updatedAt)}
                  </p>
                </div>
                <Badge tone={d.rideId ? "sun" : "teal"}>{d.rideId ? "On a trip" : "Free"}</Badge>
              </div>
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function RequestList({ requests, focusKey, onFocus }: { requests: RideRequestDto[]; focusKey: string | null; onFocus: (r: RideRequestDto) => void }) {
  if (requests.length === 0) return <Empty icon={<HandPalm size={24} weight="duotone" />} text="No open requests. Passengers' offers appear here while drivers bid." />;
  return (
    <ul className="divide-y divide-paper-200">
      <AnimatePresence initial={false}>
        {requests.map((r) => {
          const pendingBids = r.bids.filter((b) => b.status === "pending");
          return (
            <motion.li key={r.id} layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={spring}>
              <button type="button" onClick={() => onFocus(r)} className={rowClass(focusKey === `request-${r.id}`)}>
                <div className="flex items-start gap-3">
                  <Avatar name={r.customer.fullName} src={r.customer.avatarUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-ink-900">{r.customer.fullName}</p>
                    <p className="truncate text-[12.5px] text-ink-700">{r.pickup.name ?? r.pickup.address}</p>
                    <p className="truncate text-[12.5px] text-ink-500">→ {r.dropoff.name ?? r.dropoff.address}</p>
                    <p className="mt-1 text-[12px] text-ink-500">
                      {categoryLabel(r.category)} · {km(r.distanceKm)} · {pendingBids.length} {pendingBids.length === 1 ? "bid" : "bids"} · expires {timeUntil(r.expiresAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-sun-100 px-2.5 py-0.5 font-display text-[15px] font-semibold tabular-nums text-ink-900">{pkr(r.offeredFarePkr)}</span>
                </div>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function RideList({ rides, focusKey, onFocus, onOpen }: { rides: RideDto[]; focusKey: string | null; onFocus: (r: RideDto) => void; onOpen: (r: RideDto) => void }) {
  if (rides.length === 0) return <Empty icon={<Car size={24} weight="duotone" />} text="No rides in progress." />;
  return (
    <ul className="divide-y divide-paper-200">
      <AnimatePresence initial={false}>
        {rides.map((r) => (
          <motion.li key={r.id} layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={spring}>
            <div className={rowClass(focusKey === `ride-${r.id}`)}>
              <button type="button" onClick={() => onFocus(r)} className="block w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={RIDE_STATUS_TONE[r.status]} dot={r.status === "in_progress"}>
                    {RIDE_STATUS_LABEL[r.status]}
                  </Badge>
                  <span className="font-display text-[15px] font-semibold tabular-nums text-ink-900">{pkr(r.farePkr)}</span>
                </div>
                <p className="mt-1.5 truncate text-[13px] text-ink-800">
                  {r.driver.fullName} <span className="text-ink-500">driving</span> {r.customer.fullName}
                </p>
                <p className="truncate text-[12.5px] text-ink-500">
                  {r.pickup.name ?? r.pickup.address} → {r.dropoff.name ?? r.dropoff.address}
                </p>
              </button>
              <button type="button" onClick={() => onOpen(r)} className="mt-1.5 text-[12.5px] font-bold text-coral-600 hover:text-coral-700">
                Open details
              </button>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
