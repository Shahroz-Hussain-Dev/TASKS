import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Banknote, Car, Clock, Flag, Fuel, MessageCircle, Navigation, Route, Star, Timer, UserRound, XCircle } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VEHICLE_CATEGORY_META, formatPkr, type RideDto } from "@raahi/shared";
import { Avatar, Badge, Button, Card, EmptyState, Money, Screen, Skeleton, Stars } from "@/components/ui";
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
          icon={notFound ? Route : XCircle}
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
            <span className="glass rounded-full p-1 shadow-card"><RideStatusBadge status={r.status} /></span>
          </div>
        </motion.div>

        <div className="px-5 -mt-10 relative flex flex-col gap-4">
          {/* Headline */}
          <motion.div variants={item.up} className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12.5px] text-ink-400">{formatDateTime(when)}</p>
              <h1 className="font-display text-[24px] font-semibold text-ink-50 leading-tight">{meta.headline}</h1>
            </div>
            <div className="text-right shrink-0">
              <Money value={r.farePkr} className={cn("text-[26px] font-semibold", r.status === "completed" ? "text-amber-300" : "text-ink-50")} />
              <p className="text-[11.5px] text-ink-500 uppercase tracking-wider font-bold">Cash</p>
            </div>
          </motion.div>

          {active && (
            <motion.div variants={item.scale}>
              <Button full icon={Navigation} onClick={() => navigate(liveRidePath(role, r.id))}>
                Open live ride
              </Button>
            </motion.div>
          )}

          {/* Route */}
          <motion.div variants={item.left}>
            <Card className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center pt-1.5">
                  <span className="size-2.5 rounded-full bg-brand-400 ring-4 ring-brand-500/20" />
                  <span className="flex-1 w-px my-1 bg-gradient-to-b from-brand-400/70 to-amber-400/70 border-l border-dashed border-white/20" />
                  <span className="size-2.5 rounded-full bg-amber-400 ring-4 ring-amber-400/20" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                  <PlaceLine label="Pickup" name={r.pickup.name} address={r.pickup.address} />
                  <PlaceLine label="Drop-off" name={r.dropoff.name} address={r.dropoff.address} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Stat icon={Route} text={formatKm(r.distanceKm)} />
                <Stat icon={Timer} text={formatDuration(r.durationMin)} />
                <Stat icon={Car} text={categoryMeta.label} />
                {r.startedAt && r.completedAt && <Stat icon={Clock} text={`Took ${formatDuration(Math.max(1, (new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 60_000))}`} />}
              </div>
            </Card>
          </motion.div>

          {/* Counterpart */}
          <motion.div variants={item.right}>
            <Card className="flex items-center gap-3">
              <Avatar name={counterpart.name} src={counterpart.avatarUrl} size={52} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-ink-400">{counterpart.label}</p>
                <p className="font-display text-[16.5px] font-semibold text-ink-50 truncate">{counterpart.name}</p>
                <div className="flex items-center gap-1.5 text-[12.5px] text-ink-400">
                  <Star className="size-3.5 text-amber-300 fill-amber-300" />
                  <span className="tabular-nums">{counterpart.ratingCount > 0 ? `${counterpart.ratingAvg.toFixed(1)} (${counterpart.ratingCount})` : "New"}</span>
                  {counterpart.extra && <span>· {counterpart.extra}</span>}
                </div>
                {counterpart.line && <p className="text-[13px] text-ink-200 mt-1 font-medium truncate">{counterpart.line}</p>}
              </div>
              {active && (
                <Button size="sm" variant="secondary" icon={MessageCircle} onClick={() => navigate(`/rides/${r.id}/chat`)} className="relative">
                  Chat
                  {r.unreadMessages > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-brand-500 text-ink-950 text-[11px] font-bold flex items-center justify-center">{r.unreadMessages}</span>}
                </Button>
              )}
            </Card>
          </motion.div>

          {/* Fare breakdown */}
          {breakdown && (
            <motion.div variants={item.up}>
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Banknote className="size-[18px] text-amber-300" />
                  <h3 className="font-display text-[16px] font-semibold text-ink-50">What the fare covers</h3>
                </div>
                <dl className="flex flex-col gap-2.5 text-[14px]">
                  <Line icon={Fuel} label={`Fuel · ~${breakdown.litresNeeded.toFixed(1)} L at ${formatPkr(breakdown.petrolPricePkr)}/L`} value={formatPkr(breakdown.fuelCostPkr)} />
                  <Line icon={UserRound} label="Driver's guaranteed share" value={formatPkr(breakdown.driverFlatPkr)} />
                  <Line icon={Clock} label={`Time · ${formatDuration(breakdown.durationMin)}`} value={formatPkr(breakdown.timeCostPkr)} />
                  <div className="h-px bg-white/6 my-0.5" />
                  <Line label="Fair range for this trip" value={`${formatPkr(breakdown.minimumFarePkr)} – ${formatPkr(breakdown.maximumFarePkr)}`} muted />
                  <Line label={role === "customer" ? "You paid" : "You earned"} value={formatPkr(r.farePkr)} strong />
                </dl>
                <p className="mt-3 text-[12.5px] text-ink-500 leading-snug">100% of the fare goes to the driver. Raahi takes no commission; estimates use the petrol price on the day.</p>
              </Card>
            </motion.div>
          )}

          {/* Cancellation */}
          {(r.status === "cancelled_by_customer" || r.status === "cancelled_by_driver") && (
            <motion.div variants={item.up}>
              <Card className="border border-rose-500/25 flex items-start gap-3">
                <XCircle className="size-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink-50">{meta.headline}</p>
                  <p className="text-[13.5px] text-ink-300 mt-0.5">{r.cancelReason ?? "No reason given"}</p>
                  {r.cancelledAt && <p className="text-[12px] text-ink-500 mt-1">{formatDateTime(r.cancelledAt)}</p>}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Ratings */}
          {r.status === "completed" && (
            <motion.div variants={item.up}>
              <Card className="flex flex-col gap-4">
                <RatingBlock title={role === "customer" ? "Your rating of the driver" : "Your rating of the passenger"} rating={r.myRating} empty="Not rated yet" action={canRate ? <Button size="sm" icon={Star} onClick={() => setRating(true)}>Rate</Button> : null} />
                <div className="h-px bg-white/6" />
                <RatingBlock title={role === "customer" ? "Driver's rating of you" : "Passenger's rating of you"} rating={r.theirRating} empty="Waiting for their rating" />
              </Card>
            </motion.div>
          )}

          <motion.div variants={item.up} className="flex flex-col gap-2 pt-1">
            <Button variant="outline" icon={Flag} full onClick={reportIssue}>
              Report an issue
            </Button>
            <p className="text-center text-[11.5px] text-ink-600 tabular-nums">Ride reference {shortId(r.id)}</p>
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

function PlaceLine({ label, name, address }: { label: string; name?: string; address: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-500">{label}</p>
      <p className="text-[15px] font-semibold text-ink-50 truncate">{name ?? address}</p>
      {name && <p className="text-[12.5px] text-ink-400 truncate">{address}</p>}
    </div>
  );
}

function Stat({ icon: Icon, text }: { icon: typeof Route; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[12.5px] font-semibold text-ink-200">
      <Icon className="size-3.5 text-ink-400" />
      {text}
    </span>
  );
}

function Line({ icon: Icon, label, value, strong, muted }: { icon?: typeof Fuel; label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {Icon && <Icon className="size-4 text-ink-500 shrink-0" />}
      <dt className={cn("flex-1 min-w-0 truncate", strong ? "text-ink-50 font-semibold" : muted ? "text-ink-500" : "text-ink-300")}>{label}</dt>
      <dd className={cn("tabular-nums shrink-0", strong ? "font-display text-[16px] font-semibold text-amber-300" : muted ? "text-ink-400" : "text-ink-100 font-medium")}>{value}</dd>
    </div>
  );
}

function RatingBlock({ title, rating, empty, action }: { title: string; rating: { stars: number; comment: string | null } | null; empty: string; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] text-ink-400 mb-1">{title}</p>
        {rating ? (
          <>
            <Stars value={rating.stars} size={20} />
            {rating.comment && <p className="text-[14px] text-ink-200 mt-1.5 leading-snug">“{rating.comment}”</p>}
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
      <div className="px-5 -mt-10 relative flex flex-col gap-4">
        <div className="flex justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-44 rounded-3xl" />
      </div>
    </Screen>
  );
}
