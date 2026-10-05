import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Car, ChatCircleDots, Clock, Flag, GasPump, Money, NavigationArrow, Path, Star, Timer, User, XCircle } from "@phosphor-icons/react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VEHICLE_CATEGORY_META, formatPkr, type RideDto } from "@raahi/shared";
import { Avatar, Badge, Button, Card, EmptyState, Money as MoneyText, Screen, Skeleton, Stars, type IconComponent } from "@/components/ui";
import RatingSheet from "@/components/ride/RatingSheet";
import { BackButton } from "@/components/shared/BackButton";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { RideStatusBadge } from "@/components/shared/RideStatusBadge";
import { StaticRouteMap } from "@/components/shared/StaticRouteMap";
import { RIDE_STATUS_META, estimateRideBreakdown, isActiveRide, liveRidePath, shortId, vehicleLine } from "@/components/shared/meta";
import { qk } from "@/hooks/queryKeys";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { item, stagger } from "@/lib/motion";
import { cn, errorMessage, formatDateTime, formatDuration, formatKm } from "@/lib/utils";

export default function RideDetailScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [rating, setRating] = useState(false);
  const role: "customer" | "driver" = user?.role === "driver" ? "driver" : "customer";

  const ride = useQuery({
    queryKey: qk.ride(id),
    queryFn: ({ signal }) => api.rides.get(id, signal),
    enabled: id.length > 0,
    refetchInterval: (q) => (q.state.data && isActiveRide(q.state.data.status) ? 5_000 : false),
    refetchIntervalInBackground: false,
  });
  const config = useQuery({ queryKey: qk.config, queryFn: api.config, staleTime: 10 * 60_000 });

  const breakdown = useMemo(() => (ride.data ? estimateRideBreakdown(ride.data, config.data) : null), [ride.data, config.data]);
  const home = role === "driver" ? "/d/rides" : "/c/rides";

  if (ride.isPending) return <DetailSkeleton home={home} />;

  if (ride.isError || !ride.data) {
    const notFound = ride.error instanceof ApiRequestError && (ride.error.status === 404 || ride.error.status === 403);
    return (
      <Screen>
        <OfflineBanner />
        <div className="flex items-center min-h-12">
          <BackButton fallback={home} />
        </div>
        <EmptyState
          icon={notFound ? Path : XCircle}
          title={notFound ? "Ride not found" : "Couldn't load this ride"}
          body={notFound ? "It may belong to another account or has been removed." : errorMessage(ride.error)}
          action={
            notFound ? (
              <Button size="md" variant="secondary" onClick={() => navigate(home)}>Back to rides</Button>
            ) : (
              <Button size="md" variant="secondary" onClick={() => ride.refetch()}>Try again</Button>
            )
          }
        />
      </Screen>
    );
  }

  const r = ride.data;
  const meta = RIDE_STATUS_META[r.status];
  const counterpart = role === "customer" ? { name: r.driver.fullName, avatarUrl: r.driver.avatarUrl, ratingAvg: r.driver.ratingAvg, ratingCount: r.driver.ratingCount, line: vehicleLine(r.driver.vehicle), label: "Your driver", extra: `${r.driver.totalRides} ride${r.driver.totalRides === 1 ? "" : "s"} · joined ${new Date(r.driver.joinedAt).getFullYear()}` } : { name: r.customer.fullName, avatarUrl: r.customer.avatarUrl, ratingAvg: r.customer.ratingAvg, ratingCount: r.customer.ratingCount, line: null, label: "Your passenger", extra: null };
  const active = isActiveRide(r.status);
  const canRate = r.status === "completed" && !r.myRating;
  const categoryMeta = VEHICLE_CATEGORY_META[r.category];
  const when = r.completedAt ?? r.cancelledAt ?? r.startedAt ?? r.createdAt;
  const cancelled = r.status === "cancelled_by_customer" || r.status === "cancelled_by_driver";

  const reportIssue = () => {
    const prefill = `I need help with my ride ${shortId(r.id)} on ${formatDateTime(r.createdAt)} (${r.pickup.name ?? r.pickup.address} → ${r.dropoff.name ?? r.dropoff.address}, ${formatPkr(r.farePkr)}). `;
    navigate("/support", { state: { prefill, rideId: r.id } });
  };

  const onRated = (updated: RideDto) => {
    queryClient.setQueryData(qk.ride(updated.id), updated);
  };

  return (
    <Screen padded={false}>
      <OfflineBanner />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="flex flex-col pb-8">
        <motion.div variants={item.fade} className="relative">
          <StaticRouteMap pickup={r.pickup} dropoff={r.dropoff} polyline={r.routePolyline} height={280} padding={56} />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
            <BackButton fallback={home} />
            <span className="bg-white rounded-full p-1.5 shadow-pillow">
              <RideStatusBadge status={r.status} />
            </span>
          </div>
        </motion.div>

        <div className="px-5 -mt-12 relative z-10 flex flex-col gap-4">
          {/* Headline sticker */}
          <motion.div variants={item.up} className="pillow p-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12.5px] text-ink-500 font-bold">{formatDateTime(when)}</p>
              <h1 className="font-display text-[24px] font-semibold text-ink-900 leading-tight">{meta.headline}</h1>
            </div>
            <div className={cn("text-right shrink-0 rounded-[18px] px-3 py-2 -rotate-2", r.status === "completed" ? "bg-sun-100" : cancelled ? "bg-paper-100" : "bg-coral-100")}>
              <MoneyText value={r.farePkr} className={cn("text-[24px] font-semibold", r.status === "completed" ? "text-sun-600" : cancelled ? "text-ink-500" : "text-coral-600")} />
              <p className="text-[10.5px] text-ink-500 uppercase tracking-wider font-extrabold">Cash</p>
            </div>
          </motion.div>

          {active && (
            <motion.div variants={item.scale}>
              <Button full icon={NavigationArrow} onClick={() => navigate(liveRidePath(role, r.id))} className="breathe">
                Open live ride
              </Button>
            </motion.div>
          )}

          {/* Route */}
          <motion.div variants={item.left}>
            <Card className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center pt-1.5">
                  <span className="size-3 rounded-full bg-teal-500 ring-4 ring-teal-100" />
                  <span className="flex-1 w-0.5 my-1.5 rounded-full border-l-2 border-dotted border-ink-200" />
                  <span className="size-3 rounded-full bg-coral-500 ring-4 ring-coral-100" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                  <PlaceLine label="Pickup" name={r.pickup.name} address={r.pickup.address} tone="teal" />
                  <PlaceLine label="Drop-off" name={r.dropoff.name} address={r.dropoff.address} tone="coral" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Stat icon={Path} text={formatKm(r.distanceKm)} />
                <Stat icon={Timer} text={formatDuration(r.durationMin)} />
                <Stat icon={Car} text={categoryMeta.label} />
                {r.startedAt && r.completedAt && <Stat icon={Clock} text={`Took ${formatDuration(Math.max(1, (new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 60_000))}`} />}
              </div>
            </Card>
          </motion.div>

          {/* Counterpart */}
          <motion.div variants={item.right}>
            <Card className="flex items-center gap-3">
              <span className="rounded-full ring-4 ring-paper-100">
                <Avatar name={counterpart.name} src={counterpart.avatarUrl} size={52} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-ink-500 font-bold">{counterpart.label}</p>
                <p className="font-display text-[17px] font-semibold text-ink-900 truncate">{counterpart.name}</p>
                <div className="flex items-center gap-1.5 text-[12.5px] text-ink-500 font-bold">
                  <Star className="size-3.5 text-sun-500" weight="fill" />
                  <span className="tabular-nums">{counterpart.ratingCount > 0 ? `${counterpart.ratingAvg.toFixed(1)} (${counterpart.ratingCount})` : "New"}</span>
                  {counterpart.extra && <span>· {counterpart.extra}</span>}
                </div>
                {counterpart.line && <p className="text-[13px] text-ink-700 mt-1 font-bold truncate">{counterpart.line}</p>}
              </div>
              {active && (
                <Button size="sm" variant="secondary" icon={ChatCircleDots} onClick={() => navigate(`/rides/${r.id}/chat`)} className="relative">
                  Chat
                  {r.unreadMessages > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-coral-500 text-white text-[11px] font-extrabold flex items-center justify-center">{r.unreadMessages}</span>}
                </Button>
              )}
            </Card>
          </motion.div>

          {/* Fare breakdown */}
          {breakdown && (
            <motion.div variants={item.up}>
              <Card>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="size-9 rounded-xl bg-sun-100 text-sun-600 flex items-center justify-center">
                    <Money className="size-5" weight="duotone" />
                  </span>
                  <h3 className="font-display text-[17px] font-semibold text-ink-900">What the fare covers</h3>
                </div>
                <dl className="flex flex-col gap-2.5 text-[14px]">
                  <Line icon={GasPump} label={`Fuel · ~${breakdown.litresNeeded.toFixed(1)} L at ${formatPkr(breakdown.petrolPricePkr)}/L`} value={formatPkr(breakdown.fuelCostPkr)} />
                  <Line icon={User} label="Driver's guaranteed share" value={formatPkr(breakdown.driverFlatPkr)} />
                  <Line icon={Clock} label={`Time · ${formatDuration(breakdown.durationMin)}`} value={formatPkr(breakdown.timeCostPkr)} />
                  <div className="h-px bg-paper-200 my-0.5" />
                  <Line label="Fair range for this trip" value={`${formatPkr(breakdown.minimumFarePkr)} – ${formatPkr(breakdown.maximumFarePkr)}`} muted />
                  <Line label={role === "customer" ? "You paid" : "You earned"} value={formatPkr(r.farePkr)} strong />
                </dl>
                <p className="mt-3 text-[12.5px] text-ink-500 leading-snug font-medium">100% of the fare goes to the driver. Raahi takes no commission; estimates use the petrol price on the day.</p>
              </Card>
            </motion.div>
          )}

          {/* Cancellation */}
          {cancelled && (
            <motion.div variants={item.up}>
              <div className="rounded-[24px] bg-rose-100 p-4 flex items-start gap-3 shadow-[0_4px_0_0_#ffcdd9]">
                <XCircle className="size-6 text-rose-500 shrink-0 mt-0.5" weight="duotone" />
                <div className="min-w-0">
                  <p className="font-extrabold text-ink-900">{meta.headline}</p>
                  <p className="text-[13.5px] text-ink-600 mt-0.5 font-medium">{r.cancelReason ?? "No reason given"}</p>
                  {r.cancelledAt && <p className="text-[12px] text-ink-500 mt-1 font-bold">{formatDateTime(r.cancelledAt)}</p>}
                </div>
              </div>
            </motion.div>
          )}

          {/* Ratings */}
          {r.status === "completed" && (
            <motion.div variants={item.up}>
              <Card className="flex flex-col gap-4">
                <RatingBlock title={role === "customer" ? "Your rating of the driver" : "Your rating of the passenger"} rating={r.myRating} empty="Not rated yet" action={canRate ? <Button size="sm" variant="amber" icon={Star} onClick={() => setRating(true)}>Rate</Button> : null} />
                <div className="h-px bg-paper-200" />
                <RatingBlock title={role === "customer" ? "Driver's rating of you" : "Passenger's rating of you"} rating={r.theirRating} empty="Waiting for their rating" />
              </Card>
            </motion.div>
          )}

          <motion.div variants={item.up} className="flex flex-col gap-2 pt-1">
            <Button variant="outline" icon={Flag} full onClick={reportIssue}>
              Report an issue
            </Button>
            <p className="text-center text-[11.5px] text-ink-400 tabular-nums font-bold">Ride reference {shortId(r.id)}</p>
          </motion.div>
        </div>
      </motion.div>

      <RatingSheet
        open={rating}
        ride={r}
        perspective={role}
        onClose={() => setRating(false)}
        onRated={onRated}
      />
    </Screen>
  );
}

function PlaceLine({ label, name, address, tone }: { label: string; name?: string; address: string; tone: "teal" | "coral" }) {
  return (
    <div className="min-w-0">
      <p className={cn("text-[11px] font-extrabold uppercase tracking-wider", tone === "teal" ? "text-teal-600" : "text-coral-600")}>{label}</p>
      <p className="text-[15px] font-extrabold text-ink-900 truncate">{name ?? address}</p>
      {name && <p className="text-[12.5px] text-ink-500 truncate font-medium">{address}</p>}
    </div>
  );
}

function Stat({ icon: Icon, text }: { icon: IconComponent; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-100 px-3 py-1.5 text-[12.5px] font-extrabold text-ink-700">
      <Icon className="size-4 text-coral-500" weight="duotone" />
      {text}
    </span>
  );
}

function Line({ icon: Icon, label, value, strong, muted }: { icon?: IconComponent; label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {Icon && <Icon className="size-[18px] text-ink-400 shrink-0" weight="duotone" />}
      <dt className={cn("flex-1 min-w-0 truncate", strong ? "text-ink-900 font-extrabold" : muted ? "text-ink-400 font-semibold" : "text-ink-600 font-semibold")}>{label}</dt>
      <dd className={cn("tabular-nums shrink-0", strong ? "font-display text-[17px] font-semibold text-sun-600" : muted ? "text-ink-500 font-bold" : "text-ink-800 font-bold")}>{value}</dd>
    </div>
  );
}

function RatingBlock({ title, rating, empty, action }: { title: string; rating: { stars: number; comment: string | null } | null; empty: string; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] text-ink-500 mb-1 font-bold">{title}</p>
        {rating ? (
          <>
            <Stars value={rating.stars} size={20} />
            {rating.comment && <p className="text-[14px] text-ink-700 mt-1.5 leading-snug font-medium">“{rating.comment}”</p>}
          </>
        ) : (
          <Badge tone="neutral">{empty}</Badge>
        )}
      </div>
      {action}
    </div>
  );
}

function DetailSkeleton({ home }: { home: string }) {
  return (
    <Screen padded={false}>
      <div className="relative">
        <Skeleton className="h-[280px] rounded-none" />
        <div className="absolute inset-x-0 top-0 px-5" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
          <BackButton fallback={home} />
        </div>
      </div>
      <div className="px-5 -mt-12 relative z-10 flex flex-col gap-4">
        <Skeleton className="h-20 rounded-[28px]" />
        <Skeleton className="h-36 rounded-[28px]" />
        <Skeleton className="h-20 rounded-[28px]" />
        <Skeleton className="h-44 rounded-[28px]" />
      </div>
    </Screen>
  );
}
