import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, LocateFixed, MapPinOff, Star, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { DriverDto, DriverRequestFeedItem } from "@raahi/shared";
import { OnlineToggle } from "@/components/driver/OnlineToggle";
import { RequestCard } from "@/components/driver/RequestCard";
import { AnimatedCar, RadarSearch } from "@/components/Illustrations";
import { CarMarker, MapView, Marker, PinMarker, type MapHandle } from "@/components/Map";
import { Avatar, Button, IconButton, Money, useToast } from "@/components/ui";
import { dk } from "@/hooks/driver/keys";
import { MAP_PADDING, TAB_BAR_CLEARANCE } from "@/hooks/driver/layout";
import { presence, useDriverPresence, useGpsHold } from "@/hooks/driver/presence";
import { useConfig } from "@/hooks/driver/useConfig";
import { useDriver } from "@/hooks/driver/useDriver";
import { useDriverFeed } from "@/hooks/driver/useDriverFeed";
import { useNow } from "@/hooks/driver/useNow";
import { qk } from "@/hooks/queryKeys";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DEFAULT_CENTER } from "@/lib/config";
import { item, spring, stagger } from "@/lib/motion";
import { haptic, localNotify } from "@/lib/native";
import { errorMessage, pkr } from "@/lib/utils";

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first ? `${part}, ${first}` : part;
}

/**
 * Driver home: the map follows the car, the big pill toggles presence, and
 * incoming requests stack at the bottom while online. Accepting at the
 * passenger's price is one tap; a counter-offer opens the bid composer.
 */
export default function DriverHomeScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { driver } = useDriver();
  const pres = useDriverPresence();
  const { settings } = useConfig();
  const now = useNow(1000);
  useGpsHold("home");

  const mapRef = useRef<MapHandle>(null);
  const [follow, setFollow] = useState(true);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const seen = useRef<Set<string> | null>(null);

  const feed = useDriverFeed(pres.online);
  const earnings = useQuery({ queryKey: dk.earnings, queryFn: () => api.driver.earnings(), staleTime: 60_000 });
  const badge = useQuery({ queryKey: qk.notificationsBadge, queryFn: () => api.me.notifications(1), refetchInterval: 20_000, refetchIntervalInBackground: false });
  const unread = badge.data?.unread ?? 0;

  /* ------------------------------ camera ------------------------------ */
  const fixLat = pres.fix?.lat;
  const fixLng = pres.fix?.lng;
  useEffect(() => {
    if (!follow || fixLat === undefined || fixLng === undefined) return;
    const map = mapRef.current?.map;
    if (!map) return;
    map.easeTo({ center: [fixLng, fixLat], duration: 900, essential: true });
  }, [follow, fixLat, fixLng]);

  const recenter = () => {
    haptic.tick();
    setFollow(true);
    if (pres.fix) mapRef.current?.flyTo(pres.fix, 15.5);
  };

  /* ------------------------------- feed ------------------------------- */
  const items = useMemo<DriverRequestFeedItem[]>(() => {
    const list = (feed.data?.items ?? []).filter((it) => it.request.status === "open" && !dismissed.has(it.request.id));
    return [...list].sort((a, b) => new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime());
  }, [feed.data, dismissed]);

  useEffect(() => {
    const data = feed.data;
    if (!data) return;
    const live = new Set(data.items.map((i) => i.request.id));
    if (seen.current === null) {
      seen.current = live;
    } else {
      let fresh = 0;
      for (const id of live) if (!seen.current.has(id)) fresh += 1;
      seen.current = live;
      if (fresh > 0) {
        haptic.medium();
        if (document.hidden) void localNotify("New ride request", fresh === 1 ? "A passenger near you is looking for a ride." : `${fresh} passengers near you are looking for a ride.`);
      }
    }
    setDismissed((d) => {
      let changed = false;
      const next = new Set(d);
      for (const id of next) {
        if (!live.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : d;
    });
  }, [feed.data]);

  useEffect(() => {
    if (!pres.online) seen.current = null;
  }, [pres.online]);

  const pendingBids = useMemo(() => (feed.data?.items ?? []).filter((i) => i.myBid?.status === "pending").length, [feed.data]);

  /* ----------------------------- presence ----------------------------- */
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) {
        const ok = await presence.acquire("online");
        if (!ok) {
          presence.release("online");
          throw new Error("Allow location access so passengers can find you. You can enable it in your phone's settings.");
        }
      }
      try {
        const res = await api.driver.presence(next);
        return res.online;
      } catch (err) {
        if (next) presence.release("online");
        throw err;
      }
    },
    onSuccess: (online) => {
      presence.setOnline(online);
      if (online) presence.pingNow();
      haptic.success();
      queryClient.setQueryData<DriverDto>(dk.driver, (d) => (d ? { ...d, isOnline: online } : d));
      if (!online) queryClient.removeQueries({ queryKey: dk.feed });
      toast({ title: online ? "You're online" : "You're offline", body: online ? "Requests near you will appear below." : "Take a break. Come back whenever you're ready.", tone: online ? "success" : "neutral" });
    },
    onError: (err) => toast({ title: "Couldn't change your status", body: errorMessage(err), tone: "error" }),
  });

  /* ------------------------------- bids ------------------------------- */
  const patchFeedItem = (requestId: string, fn: (it: DriverRequestFeedItem) => DriverRequestFeedItem) => {
    queryClient.setQueryData<{ items: DriverRequestFeedItem[]; online: boolean; serverTime: string }>(dk.feed, (f) => (f ? { ...f, items: f.items.map((x) => (x.request.id === requestId ? fn(x) : x)) } : f));
  };

  const accept = useMutation({
    mutationFn: (it: DriverRequestFeedItem) => api.driver.placeBid(it.request.id, { amountPkr: it.request.offeredFarePkr, etaMin: Math.min(120, Math.max(1, Math.round(it.etaToPickupMin))) }),
    onSuccess: (bid, it) => {
      haptic.success();
      patchFeedItem(it.request.id, (x) => ({ ...x, myBid: bid }));
      toast({ title: `Offer sent · ${pkr(bid.amountPkr)}`, body: `Waiting for ${it.request.customer.fullName.split(" ")[0]} to confirm.`, tone: "success" });
      void queryClient.invalidateQueries({ queryKey: dk.feed });
    },
    onError: (err) => toast({ title: "Couldn't send your offer", body: errorMessage(err), tone: "error" }),
  });

  const withdraw = useMutation({
    mutationFn: (it: DriverRequestFeedItem) => {
      if (!it.myBid) throw new Error("No offer to withdraw");
      return api.driver.withdrawBid(it.myBid.id);
    },
    onSuccess: (_, it) => {
      haptic.light();
      patchFeedItem(it.request.id, (x) => ({ ...x, myBid: x.myBid ? { ...x.myBid, status: "withdrawn" } : null }));
      toast({ title: "Offer withdrawn", tone: "neutral" });
      void queryClient.invalidateQueries({ queryKey: dk.feed });
    },
    onError: (err) => toast({ title: "Couldn't withdraw", body: errorMessage(err), tone: "error" }),
  });

  const dismiss = (id: string) => {
    haptic.tick();
    setDismissed((d) => new Set(d).add(id));
  };

  const center = pres.fix ?? driver?.lastLocation ?? DEFAULT_CENTER;
  const statusLine = pres.online ? (items.length > 0 ? `Online · ${items.length} request${items.length === 1 ? "" : "s"} nearby` : pendingBids > 0 ? `Online · ${pendingBids} offer${pendingBids === 1 ? "" : "s"} waiting` : "Online · looking for requests") : "You're offline";

  return (
    <div className="relative h-full w-full bg-ink-900">
      <MapView ref={mapRef} center={center} zoom={15} padding={MAP_PADDING} onMoveStart={() => setFollow(false)}>
        {pres.fix && (
          <Marker position={pres.fix} zIndex={5}>
            <CarMarker heading={pres.fix.heading} category={driver?.vehicle?.category ?? "car"} pulse={pres.online} />
          </Marker>
        )}
        {pres.online &&
          items.map((it) => (
            <Marker key={it.request.id} position={it.request.pickup} anchor="bottom" zIndex={3}>
              <PinMarker kind="pickup" label={pkr(it.request.offeredFarePkr)} />
            </Marker>
          ))}
      </MapView>

      {/* Top bar */}
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="absolute inset-x-0 top-0 px-4 pointer-events-none" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <motion.div variants={item.down} className="pointer-events-auto glass rounded-[24px] shadow-float p-2 pl-2.5 flex items-center gap-3">
          <motion.button type="button" whileTap={{ scale: 0.94 }} transition={spring} onClick={() => navigate("/profile")} aria-label="Profile">
            <Avatar name={user?.fullName ?? "Driver"} src={user?.avatarUrl} size={42} ring={pres.online} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="font-display text-[15px] font-semibold text-ink-50 truncate">{greeting(user?.fullName ?? "")}</p>
            <p className="text-[12.5px] text-ink-400 truncate flex items-center gap-1.5">
              <span className={pres.online ? "size-1.5 rounded-full bg-brand-400" : "size-1.5 rounded-full bg-ink-500"} />
              {statusLine}
            </p>
          </div>
          <div className="relative">
            <IconButton icon={Bell} label="Notifications" variant="ghost" size={40} onClick={() => navigate("/notifications")} />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-ink-950 text-[10px] font-bold flex items-center justify-center tabular-nums">{unread > 9 ? "9+" : unread}</span>}
          </div>
        </motion.div>
      </motion.div>

      {/* Recenter */}
      <AnimatePresence>
        {!follow && pres.fix && (
          <motion.div key="recenter" initial={{ opacity: 0, scale: 0.7, x: 16 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.7, x: 16 }} transition={spring} className="absolute right-4 z-10" style={{ top: "calc(var(--safe-top) + 92px)" }}>
            <IconButton icon={LocateFixed} label="Recenter map" onClick={recenter} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pointer-events-none" style={{ paddingBottom: TAB_BAR_CLEARANCE }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {pres.permission === "denied" ? (
            <motion.div key="denied" variants={item.up} initial="hidden" animate="show" exit="exit" className="pointer-events-auto w-full glass rounded-[28px] shadow-float p-4 flex items-center gap-3">
              <span className="size-11 rounded-2xl bg-amber-400/12 text-amber-300 flex items-center justify-center shrink-0">
                <MapPinOff className="size-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-50">Location is off</p>
                <p className="text-[12.5px] text-ink-400 leading-snug">Passengers can't find you without it. Allow location to go online.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void presence.acquire("home")}>
                Allow
              </Button>
            </motion.div>
          ) : pres.online ? (
            items.length > 0 ? (
              <motion.div key="stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-auto w-full max-h-[52vh] overflow-y-auto no-scrollbar flex flex-col gap-3 pt-2 -mx-1 px-1">
                <AnimatePresence initial={false} mode="popLayout">
                  {items.map((it) => (
                    <RequestCard
                      key={it.request.id}
                      item={it}
                      now={now}
                      bidTtlSeconds={settings.bidTtlSeconds}
                      requestTtlSeconds={settings.requestTtlSeconds}
                      accepting={accept.isPending && accept.variables?.request.id === it.request.id}
                      withdrawing={withdraw.isPending && withdraw.variables?.request.id === it.request.id}
                      onAccept={() => accept.mutate(it)}
                      onOffer={() => navigate(`/d/request/${it.request.id}`)}
                      onWithdraw={() => withdraw.mutate(it)}
                      onDismiss={() => dismiss(it.request.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div key="searching" variants={item.up} initial="hidden" animate="show" exit="exit" className="pointer-events-auto w-full glass rounded-[28px] shadow-float p-4 flex items-center gap-4">
                <RadarSearch size={76} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[16px] font-semibold text-ink-50">{pendingBids > 0 ? `${pendingBids} offer${pendingBids === 1 ? "" : "s"} waiting` : "Looking for requests nearby…"}</p>
                  <p className="text-[12.5px] text-ink-400 leading-snug mt-0.5 flex items-start gap-1.5">
                    {feed.isError && <TriangleAlert className="size-3.5 text-amber-300 shrink-0 mt-0.5" />}
                    <span>{feed.isError ? "Can't reach Raahi right now — retrying." : "Stay near busy areas. You'll feel a buzz when a passenger posts a ride."}</span>
                  </p>
                </div>
              </motion.div>
            )
          ) : (
            <motion.div key="offline" variants={item.up} initial="hidden" animate="show" exit="exit" className="pointer-events-auto w-full glass rounded-[28px] shadow-float p-4 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[18px] font-semibold text-ink-50">You're offline</p>
                  <p className="text-[13px] text-ink-400 leading-snug mt-0.5">Go online to see ride requests near you. Every rupee of every fare is yours.</p>
                </div>
                <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="shrink-0">
                  <AnimatedCar size={110} />
                </motion.div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Today" value={earnings.data ? <Money value={earnings.data.todayPkr} className="text-[15px] font-bold text-brand-300" /> : "—"} />
                <Stat label="Rides today" value={earnings.data ? String(earnings.data.ridesToday) : "—"} />
                <Stat
                  label="Rating"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 text-amber-300 fill-amber-300" />
                      {user && user.ratingCount > 0 ? user.ratingAvg.toFixed(1) : "New"}
                    </span>
                  }
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.1 }} className="pointer-events-auto">
          <OnlineToggle online={pres.online} busy={toggle.isPending} nearby={items.length} onToggle={() => toggle.mutate(!pres.online)} />
        </motion.div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/4 border border-white/6 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-display font-semibold text-ink-50 tabular-nums">{value}</p>
    </div>
  );
}
