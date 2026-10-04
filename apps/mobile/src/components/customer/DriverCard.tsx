import { motion } from "framer-motion";
import { MessageCircle, Phone, Star } from "lucide-react";
import type { DriverPublicDto } from "@raahi/shared";
import { Avatar } from "@/components/ui";
import { springBouncy } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

/**
 * The driver who accepted: identity, rating, vehicle and a big number plate so
 * the passenger can match the car at a glance. Chat always; call when a phone
 * number is available.
 */
export function DriverCard({ driver, unread = 0, phone, onChat, onCall, className }: { driver: DriverPublicDto; unread?: number; phone?: string | null; onChat: () => void; onCall?: () => void; className?: string }) {
  const v = driver.vehicle;
  const rating = driver.ratingCount > 0 ? driver.ratingAvg.toFixed(1) : null;
  return (
    <div className={cn("rounded-3xl bg-ink-800 border border-white/8 shadow-card p-4 flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <Avatar name={driver.fullName} src={driver.avatarUrl} size={56} ring />
        <div className="flex-1 min-w-0">
          <p className="font-display text-[17px] font-semibold text-ink-50 truncate leading-tight">{driver.fullName}</p>
          <p className="text-[12.5px] text-ink-300 mt-0.5 flex items-center gap-1">
            <Star className="size-3.5 text-amber-400 fill-amber-400" />
            {rating ? (
              <>
                <span className="font-semibold text-ink-100">{rating}</span>
                <span className="text-ink-500">({driver.ratingCount})</span>
              </>
            ) : (
              <span className="font-semibold text-ink-100">New driver</span>
            )}
            <span className="text-ink-600">·</span>
            <span>{driver.totalRides} trips</span>
          </p>
          {v && (
            <p className="text-[12.5px] text-ink-400 truncate mt-0.5">
              {v.color} {v.make} {v.model}
              {v.year ? ` · ${v.year}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phone && onCall && (
            <ActionButton label="Call driver" icon={Phone} onClick={onCall} />
          )}
          <ActionButton label="Message driver" icon={MessageCircle} onClick={onChat} badge={unread} primary />
        </div>
      </div>
      {v?.plate && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={springBouncy} className="self-start inline-flex items-center gap-2 rounded-xl bg-ink-50 text-ink-950 px-3.5 py-1.5 border-2 border-ink-300 shadow-card">
          <span className="text-[10px] font-black tracking-[0.2em] text-ink-500 uppercase">PK</span>
          <span className="font-display text-[20px] font-extrabold tracking-[0.12em] leading-none">{v.plate}</span>
        </motion.div>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, badge = 0, primary }: { icon: typeof Phone; label: string; onClick: () => void; badge?: number; primary?: boolean }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.88 }}
      transition={springBouncy}
      onClick={() => {
        haptic.light();
        onClick();
      }}
      className={cn("relative size-12 rounded-2xl flex items-center justify-center", primary ? "bg-brand-500 text-ink-950 shadow-glow" : "bg-white/6 text-ink-50 border border-white/8")}
    >
      <Icon className="size-[22px]" strokeWidth={2.2} />
      {badge > 0 && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={springBouncy} className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-ink-50 text-[11px] font-bold flex items-center justify-center border-2 border-ink-800">
          {badge > 9 ? "9+" : badge}
        </motion.span>
      )}
    </motion.button>
  );
}
