import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { rateRideSchema, type RideDto } from "@raahi/shared";
import { Avatar, Button, Chip, Sheet, Stars, TextArea, useToast } from "@/components/ui";
import { RATING_TAGS, STAR_LABELS, vehicleLine } from "@/components/shared/meta";
import { qk } from "@/hooks/queryKeys";
import { api } from "@/lib/api";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

export interface RatingSheetProps {
  open: boolean;
  ride: RideDto | null;
  /** Who the viewer is rating. */
  perspective: "customer" | "driver";
  onClose: () => void;
  /** Called after a successful rating with the updated ride. */
  onRated?: (ride: RideDto) => void;
}

const MAX_TAGS = 5;

/**
 * Post-trip rating: sun stars, a few tag chips that flip between praise and
 * problems depending on the score, and an optional comment.
 */
export default function RatingSheet({ open, ride, perspective, onClose, onRated }: RatingSheetProps) {
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setStars(0);
    setTags([]);
    setComment("");
    setError(null);
  }, [open, ride?.id]);

  const counterpart = useMemo(() => {
    if (!ride) return null;
    if (perspective === "customer") return { name: ride.driver.fullName, avatarUrl: ride.driver.avatarUrl, sub: vehicleLine(ride.driver.vehicle), role: "your driver" };
    return { name: ride.customer.fullName, avatarUrl: ride.customer.avatarUrl, sub: null, role: "your passenger" };
  }, [ride, perspective]);

  const tagSet = stars === 0 ? [] : stars >= 4 ? RATING_TAGS[perspective].positive : RATING_TAGS[perspective].negative;
  const positive = stars >= 4;

  const rate = useMutation({
    mutationFn: async () => {
      if (!ride) throw new Error("No ride to rate");
      const parsed = rateRideSchema.safeParse({ stars, comment: comment.trim() || undefined, tags: tags.length ? tags : undefined });
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new Error(first?.path[0] === "stars" ? "Tap a star to rate" : first?.message ?? "Check your rating");
      }
      return api.rides.rate(ride.id, parsed.data);
    },
    onSuccess: (updated) => {
      haptic.success();
      queryClient.setQueryData(qk.ride(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: qk.rides });
      toast({ title: "Thanks for the feedback", body: `Your ${stars}-star rating helps keep Raahi safe.`, tone: "success" });
      onRated?.(updated);
      onClose();
    },
    onError: (err) => {
      haptic.error();
      setError(errorMessage(err));
    },
  });

  const toggleTag = (t: string) => {
    setTags((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : xs.length >= MAX_TAGS ? xs : [...xs, t]));
  };

  const pick = (n: number) => {
    setError(null);
    setStars(n);
    setTags([]);
  };

  return (
    <Sheet open={open} onClose={rate.isPending ? () => {} : onClose} title="Rate your trip" dismissible={!rate.isPending}>
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-5 pb-2">
        {counterpart && (
          <motion.div variants={item.down} className="pillow p-3.5 flex items-center gap-3">
            <div className="relative">
              <span className="blob absolute -inset-2 bg-sun-100" />
              <span className="relative block rounded-full ring-4 ring-white shadow-[0_14px_30px_-16px_rgb(63_42_20/0.35)]">
                <Avatar name={counterpart.name} src={counterpart.avatarUrl} size={54} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] text-ink-500 font-bold">How was {counterpart.role}?</p>
              <p className="font-display text-[18px] font-semibold text-ink-900 truncate">{counterpart.name}</p>
              {counterpart.sub && <p className="text-[12.5px] text-ink-500 truncate font-semibold">{counterpart.sub}</p>}
            </div>
          </motion.div>
        )}

        <motion.div variants={item.pop} className="relative flex flex-col items-center gap-2 py-2">
          <span className="blob absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[120%] bg-sun-100 -z-10" />
          <Stars value={stars} onChange={pick} size={46} />
          <div className="h-7 relative w-full text-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={stars} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={spring} className={cn("absolute inset-x-0 font-display text-[17px] font-semibold", stars === 0 ? "text-ink-400" : positive ? "text-teal-600" : "text-coral-600")}>
                {stars === 0 ? "Tap a star" : STAR_LABELS[stars]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        <AnimatePresence initial={false}>
          {tagSet.length > 0 && (
            <motion.div key={positive ? "pos" : "neg"} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
              <p className="text-[13px] font-extrabold text-ink-600 mb-2.5 pl-1">{positive ? "What went well?" : "What went wrong?"}</p>
              <div className="flex flex-wrap gap-2">
                {tagSet.map((t, i) => (
                  <motion.div key={t} initial={{ opacity: 0, scale: 0.6, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...spring, delay: i * 0.035 }}>
                    <Chip tone={positive ? "teal" : "coral"} active={tags.includes(t)} onClick={() => toggleTag(t)}>
                      {t}
                    </Chip>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={item.up}>
          <TextArea label="Anything else? (optional)" placeholder={perspective === "customer" ? "Tell us about the driver, the car or the route" : "Tell us about the pickup or the passenger"} value={comment} maxLength={300} onChange={(e) => setComment(e.target.value)} className="min-h-20" hint={comment.length > 250 ? `${300 - comment.length} characters left` : undefined} />
        </motion.div>

        <motion.div variants={item.up} className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {error && (
              <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] text-rose-500 text-center font-bold">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <Button full size="xl" loading={rate.isPending} disabled={!ride} onClick={() => rate.mutate()}>
            Submit rating
          </Button>
          <Button full variant="ghost" disabled={rate.isPending} onClick={onClose}>
            Maybe later
          </Button>
        </motion.div>
      </motion.div>
    </Sheet>
  );
}
