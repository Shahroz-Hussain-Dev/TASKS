"use client";

import { motion } from "framer-motion";
import { Clock, MessageSquare, Route, Star } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { decodePolyline, type LatLng, type RideDto } from "@raahi/shared";
import { AdminMap, type MapLineSpec, type MapMarkerSpec } from "./AdminMap";
import { categoryLabel, fmtDateTime, km, minutes, pkr, RIDE_STATUS_LABEL, RIDE_STATUS_TONE, shortId } from "./format";
import { item, stagger } from "./motion";
import { Avatar, Badge, Drawer, KeyValue } from "./ui";

export function RideDrawer({ ride, onClose }: { ride: RideDto | null; onClose: () => void }) {
  const route = useMemo<LatLng[]>(() => {
    if (!ride) return [];
    if (ride.routePolyline) {
      const pts = decodePolyline(ride.routePolyline);
      if (pts.length >= 2) return pts;
    }
    return [ride.pickup, ride.dropoff];
  }, [ride]);

  const markers = useMemo<MapMarkerSpec[]>(() => {
    if (!ride) return [];
    const m: MapMarkerSpec[] = [
      { id: "pickup", lat: ride.pickup.lat, lng: ride.pickup.lng, kind: "pickup", label: "Pickup" },
      { id: "dropoff", lat: ride.dropoff.lat, lng: ride.dropoff.lng, kind: "dropoff", label: "Drop-off" },
    ];
    if (ride.driverLocation && (ride.status === "assigned" || ride.status === "arrived" || ride.status === "in_progress")) {
      m.push({ id: "driver", lat: ride.driverLocation.lat, lng: ride.driverLocation.lng, kind: "driver-busy", heading: ride.driverLocation.heading, label: ride.driver.fullName.split(" ")[0] });
    }
    return m;
  }, [ride]);

  const lines = useMemo<MapLineSpec[]>(() => (route.length >= 2 ? [{ id: "route", points: route, color: "#34d399", width: 4 }] : []), [route]);
  const fitPoints = useMemo(() => [...route, ...markers.map((m) => ({ lat: m.lat, lng: m.lng }))], [route, markers]);

  return (
    <Drawer open={ride !== null} onClose={onClose} title={ride ? `Ride ${shortId(ride.id)}` : ""} subtitle={ride ? `${fmtDateTime(ride.createdAt)} · ${categoryLabel(ride.category)}` : undefined} width="max-w-2xl">
      {ride ? (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-5">
          <motion.div variants={item.scale}>
            <AdminMap className="h-[280px]" markers={markers} lines={lines} fit={fitPoints} fitKey={ride.id} />
          </motion.div>

          <motion.div variants={item.up} className="flex flex-wrap items-center justify-between gap-3">
            <Badge tone={RIDE_STATUS_TONE[ride.status]} dot={ride.status === "in_progress"} className="text-[13px]">
              {RIDE_STATUS_LABEL[ride.status]}
            </Badge>
            <p className="font-display text-[26px] font-semibold text-ink-50">{pkr(ride.farePkr)}</p>
          </motion.div>

          <motion.div variants={item.up} className="rounded-2xl border border-white/6 bg-ink-800 p-4">
            <ol className="relative space-y-4 pl-6">
              <span className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px bg-ink-600" />
              <li className="relative">
                <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-ink-800 bg-sky-400" />
                <p className="text-[12px] uppercase tracking-wide text-ink-500">Pickup</p>
                <p className="text-[14px] text-ink-100">{ride.pickup.address}</p>
              </li>
              <li className="relative">
                <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-ink-800 bg-rose-400" />
                <p className="text-[12px] uppercase tracking-wide text-ink-500">Drop-off</p>
                <p className="text-[14px] text-ink-100">{ride.dropoff.address}</p>
              </li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-ink-300">
              <span className="inline-flex items-center gap-1.5">
                <Route size={14} /> {km(ride.distanceKm)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} /> {minutes(ride.durationMin)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare size={14} /> Cash
              </span>
            </div>
          </motion.div>

          <motion.div variants={item.up} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PersonCard title="Passenger" name={ride.customer.fullName} avatar={ride.customer.avatarUrl} rating={ride.customer.ratingAvg} count={ride.customer.ratingCount} />
            <PersonCard title="Driver" name={ride.driver.fullName} avatar={ride.driver.avatarUrl} rating={ride.driver.ratingAvg} count={ride.driver.ratingCount} sub={ride.driver.vehicle ? `${ride.driver.vehicle.make} ${ride.driver.vehicle.model} · ${ride.driver.vehicle.plate}` : undefined} href={`/admin/drivers/${ride.driver.id}`} />
          </motion.div>

          <motion.div variants={item.up}>
            <KeyValue
              columns={2}
              items={[
                { label: "Requested", value: fmtDateTime(ride.createdAt) },
                { label: "Driver arrived", value: fmtDateTime(ride.arrivedAt) },
                { label: "Started", value: fmtDateTime(ride.startedAt) },
                { label: "Completed", value: fmtDateTime(ride.completedAt) },
                ...(ride.cancelledAt ? [{ label: `Cancelled by ${ride.cancelledBy ?? "unknown"}`, value: `${fmtDateTime(ride.cancelledAt)}${ride.cancelReason ? ` — ${ride.cancelReason}` : ""}` }] : []),
                { label: "Request id", value: <span className="font-mono text-[12.5px]">{ride.requestId}</span> },
              ]}
            />
          </motion.div>

          {ride.myRating || ride.theirRating ? (
            <motion.div variants={item.up} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ride.myRating ? <RatingCard title="Passenger rated the driver" stars={ride.myRating.stars} comment={ride.myRating.comment} /> : null}
              {ride.theirRating ? <RatingCard title="Driver rated the passenger" stars={ride.theirRating.stars} comment={ride.theirRating.comment} /> : null}
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </Drawer>
  );
}

function PersonCard({ title, name, avatar, rating, count, sub, href }: { title: string; name: string; avatar: string | null; rating: number; count: number; sub?: string; href?: string }) {
  const body = (
    <div className="flex items-center gap-3 rounded-2xl border border-white/6 bg-ink-800 p-4">
      <Avatar name={name} src={avatar} size={44} />
      <div className="min-w-0">
        <p className="text-[12px] uppercase tracking-wide text-ink-500">{title}</p>
        <p className="truncate text-[15px] font-semibold text-ink-50">{name}</p>
        <p className="inline-flex items-center gap-1 text-[12.5px] text-ink-400">
          <Star size={12} className="fill-amber-400 text-amber-400" /> {rating.toFixed(1)} ({count}){sub ? ` · ${sub}` : ""}
        </p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

function RatingCard({ title, stars, comment }: { title: string; stars: number; comment: string | null }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-ink-800 p-4">
      <p className="text-[12px] uppercase tracking-wide text-ink-500">{title}</p>
      <p className="mt-1 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={16} className={i < stars ? "fill-amber-400 text-amber-400" : "text-ink-600"} />
        ))}
      </p>
      {comment ? <p className="mt-2 text-[13.5px] text-ink-300">“{comment}”</p> : null}
    </div>
  );
}
