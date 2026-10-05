import { motion } from "framer-motion";
import { ChatCircleDots, Phone, Star } from "@phosphor-icons/react";
import type { DriverPublicDto } from "@raahi/shared";
import { Avatar, type IconComponent } from "@/components/ui";
import { springBouncy } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

/**
 * The driver who accepted: identity, rating, vehicle and a big number-plate
 * sticker so the passenger can match the car at a glance. Chat (coral) always;
 * call (teal) when a phone number is available.
 */
export function DriverCard({ driver, unread = 0, phone, onChat, onCall, className }: { driver: DriverPublicDto; unread?: number; phone?: string | null; onChat: () => void; onCall?: () => void; className?: string }) {
  const v = driver.vehicle;
  const rating = driver.ratingCount > 0 ? driver.ratingAvg.toFixed(1) : null;
  return (
    <div className={cn("pillow p-4 flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <Avatar name={driver.fullName} src={driver.avatarUrl} size={56} ring />
        <div className="flex-1 min-w-0">
          <p className="font-display text-[18px] font-semibold text-ink-900 truncate leading-tight">{driver.fullName}</p>
          <p className="text-[12.5px] text-ink-500 mt-0.5 flex items-center gap-1 font-semibold">
            <Star className="size-4 text-sun-500" weight="fill" />
            {rating ? (
              <>
                <span className="font-extrabold text-ink-800">{rating}</span>
                <span className="text-ink-400">({driver.ratingCount})</span>
              </>
            ) : (
              <span className="font-extrabold text-ink-800">New driver</span>
            )}
            <span className="text-ink-300">·</span>
            <span>{driver.totalRides} trips</span>
          </p>
          {v && (
            <p className="text-[12.5px] text-ink-500 truncate mt-0.5 font-medium">
              {v.color} {v.make} {v.model}
              {v.year ? ` · ${v.year}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phone && onCall && <ActionButton label="Call driver" icon={Phone} onClick={onCall} tone="teal" />}
          <ActionButton label="Message driver" icon={ChatCircleDots} onClick={onChat} badge={unread} tone="coral" />
        </div>
      </div>
      {v?.plate && (
        <motion.div initial={{ opacity: 0, scale: 0.8, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 1.2 }} transition={springBouncy} className="self-start inline-flex items-center gap-2.5 sticker rounded-2xl bg-sun-100 px-4 py-2 ml-1 mt-1">
          <span className="flex flex-col items-center leading-none">
            <span className="size-2 rounded-full bg-mint-500 mb-1" />
            <span className="text-[9px] font-black tracking-[0.18em] text-ink-500">PK</span>
          </span>
          <span className="font-display text-[24px] font-semibold tracking-[0.1em] leading-none text-ink-900">{v.plate}</span>
        </motion.div>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, badge = 0, tone }: { icon: IconComponent; label: string; onClick: () => void; badge?: number; tone: "teal" | "coral" }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.9 }}
      transition={springBouncy}
      onClick={() => {
        haptic.light();
        onClick();
      }}
      className={cn("relative size-12 rounded-full flex items-center justify-center jelly", tone === "teal" ? "jelly-teal" : "jelly-coral")}
    >
      <Icon className="size-[24px]" weight="duotone" />
      {badge > 0 && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={springBouncy} className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center justify-center border-2 border-white">
          {badge > 9 ? "9+" : badge}
        </motion.span>
      )}
    </motion.button>
  );
}
