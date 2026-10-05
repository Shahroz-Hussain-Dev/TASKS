import { AnimatePresence, motion } from "framer-motion";
import { ArrowsClockwise, Camera, CheckCircle, Clock, UserFocus, Warning, WarningCircle } from "@phosphor-icons/react";
import { DOCUMENT_META, type DocumentDto, type DocumentType, type DocumentVerificationStatus } from "@raahi/shared";
import { AuthImage, Badge, type IconComponent } from "@/components/ui";
import { DOC_STATUS_META } from "@/hooks/driver/onboarding";
import { spring, springBouncy } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

export type DocumentBusy = "uploading" | "verifying" | null;

const STATUS_ICON: Record<DocumentVerificationStatus, IconComponent> = {
  pending: Clock,
  verified: CheckCircle,
  flagged: Warning,
  rejected: WarningCircle,
};

/** Polaroids lean a little, alternating left/right down the grid. */
const TILT = ["-2deg", "1.6deg", "1.2deg", "-1.8deg"];

/**
 * One document slot in the KYC grid, drawn as a polaroid: white frame, the
 * photo (or a dashed capture target), and the AI verdict chip. Tappable for
 * details and retakes. While uploading or verifying a scan-line sweeps over
 * the photo.
 */
export function DocumentTile({ type, doc, busy, onCapture, onOpen, index = 0 }: { type: DocumentType; doc: DocumentDto | null; busy: DocumentBusy; onCapture: (source: "camera" | "prompt") => void; onOpen: () => void; index?: number }) {
  const meta = DOCUMENT_META[type];
  const cameraOnly = type === "selfie";
  const status = doc ? DOC_STATUS_META[doc.status] : null;
  const StatusIcon = doc ? STATUS_ICON[doc.status] : Camera;
  const EmptyIcon = cameraOnly ? UserFocus : Camera;
  const tilt = TILT[index % TILT.length];

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 24, scale: 0.94, rotate: 0 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: tilt }}
      transition={{ ...spring, delay: index * 0.05 }}
      whileTap={{ scale: 0.97, rotate: 0 }}
      disabled={busy !== null}
      onClick={() => {
        haptic.light();
        if (doc) onOpen();
        else onCapture(cameraOnly ? "camera" : "prompt");
      }}
      aria-label={doc ? `${meta.label}: ${status?.label ?? ""}. Tap for details` : `Add ${meta.label}`}
      className={cn("relative w-full text-left bg-white rounded-[18px] p-2 pb-2.5 shadow-pillow", doc?.status === "rejected" && "ring-2 ring-rose-300", doc?.status === "verified" && "ring-2 ring-mint-100")}
    >
      {/* Photo window */}
      <div className={cn("relative aspect-[4/3] w-full overflow-hidden rounded-[12px]", doc ? "bg-paper-100" : "border-2 border-dashed border-paper-300 bg-paper-100")}>
        {doc ? (
          <>
            <AuthImage src={doc.url} alt={meta.label} className="absolute inset-0 w-full h-full" fallback={<div className="absolute inset-0 bg-paper-200" />} />
            <span className="absolute top-2 right-2 size-7 rounded-full bg-white/90 shadow-pillow flex items-center justify-center text-ink-700">
              <ArrowsClockwise className="size-3.5" weight="bold" />
            </span>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
            <span className="size-11 rounded-[16px] bg-teal-100 text-teal-600 flex items-center justify-center">
              <EmptyIcon className="size-6" weight="duotone" />
            </span>
            <p className="text-[11px] font-bold text-ink-400 leading-snug">{cameraOnly ? "Camera only" : "Tap to add"}</p>
          </div>
        )}

        <AnimatePresence>
          {busy && (
            <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-paper-50/90 flex flex-col items-center justify-center gap-2 overflow-hidden">
              <motion.span aria-hidden className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-teal-400/50 to-transparent" initial={{ top: "-20%" }} animate={{ top: ["-20%", "110%"] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
              <motion.span className="size-9 rounded-full border-[3px] border-teal-200 border-t-teal-500" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
              <p className="text-[12px] font-extrabold text-ink-900">{busy === "uploading" ? "Uploading…" : "Checking with AI…"}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Caption */}
      <div className="mt-2 px-0.5 flex items-start justify-between gap-1.5 min-h-[34px]">
        <div className="min-w-0">
          <p className="font-display text-[13.5px] font-semibold text-ink-900 leading-tight truncate">{meta.label}</p>
          {doc?.aiVerdict?.summary && <p className="text-[10.5px] font-semibold text-ink-400 leading-snug line-clamp-1 mt-0.5">{doc.aiVerdict.summary}</p>}
        </div>
        {status && (
          <motion.span key={doc?.status} initial={{ scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={springBouncy} className="shrink-0">
            <Badge tone={status.tone}>
              <StatusIcon className="size-3" weight="fill" />
              {status.label}
            </Badge>
          </motion.span>
        )}
      </div>
    </motion.button>
  );
}
