import { AnimatePresence, motion } from "framer-motion";
import { Camera, CircleAlert, CircleCheck, Clock3, RefreshCw, ScanFace, TriangleAlert, type LucideIcon } from "lucide-react";
import { DOCUMENT_META, type DocumentDto, type DocumentType, type DocumentVerificationStatus } from "@raahi/shared";
import { AuthImage, Badge } from "@/components/ui";
import { DOC_STATUS_META } from "@/hooks/driver/onboarding";
import { spring, springBouncy } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

export type DocumentBusy = "uploading" | "verifying" | null;

const STATUS_ICON: Record<DocumentVerificationStatus, LucideIcon> = {
  pending: Clock3,
  verified: CircleCheck,
  flagged: TriangleAlert,
  rejected: CircleAlert,
};

/**
 * One document slot in the KYC grid. Empty: a dashed capture target. Filled:
 * the photo with the AI verdict chip, tappable for details and retakes. While
 * uploading or verifying a scan-line sweeps over the tile.
 */
export function DocumentTile({ type, doc, busy, onCapture, onOpen, index = 0 }: { type: DocumentType; doc: DocumentDto | null; busy: DocumentBusy; onCapture: (source: "camera" | "prompt") => void; onOpen: () => void; index?: number }) {
  const meta = DOCUMENT_META[type];
  const cameraOnly = type === "selfie";
  const status = doc ? DOC_STATUS_META[doc.status] : null;
  const StatusIcon = doc ? STATUS_ICON[doc.status] : Camera;
  const EmptyIcon = cameraOnly ? ScanFace : Camera;

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }}
      disabled={busy !== null}
      onClick={() => {
        haptic.light();
        if (doc) onOpen();
        else onCapture(cameraOnly ? "camera" : "prompt");
      }}
      aria-label={doc ? `${meta.label}: ${status?.label ?? ""}. Tap for details` : `Add ${meta.label}`}
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-3xl text-left",
        doc ? "bg-ink-800 border border-white/8 shadow-card" : "border-2 border-dashed border-white/12 bg-white/3 hover:bg-white/5",
        doc?.status === "rejected" && "border-rose-500/50",
        doc?.status === "verified" && "border-brand-500/40",
      )}
    >
      {doc ? (
        <>
          <AuthImage src={doc.url} alt={meta.label} className="absolute inset-0 w-full h-full" fallback={<div className="absolute inset-0 bg-ink-700" />} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-ink-950/30" />
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
            {status && (
              <motion.span key={doc.status} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
                <Badge tone={status.tone} className="shadow-card">
                  <StatusIcon className="size-3" strokeWidth={2.6} />
                  {status.label}
                </Badge>
              </motion.span>
            )}
            <span className="size-7 rounded-full glass flex items-center justify-center text-ink-100">
              <RefreshCw className="size-3.5" />
            </span>
          </div>
          <div className="absolute inset-x-3 bottom-2.5">
            <p className="text-[13px] font-semibold text-ink-50 leading-tight">{meta.label}</p>
            {doc.aiVerdict?.summary && <p className="text-[11px] text-ink-300 leading-snug line-clamp-1 mt-0.5">{doc.aiVerdict.summary}</p>}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
          <span className="size-11 rounded-2xl bg-brand-500/12 text-brand-400 flex items-center justify-center">
            <EmptyIcon className="size-5" />
          </span>
          <p className="text-[13px] font-semibold text-ink-100 leading-tight">{meta.label}</p>
          <p className="text-[11px] text-ink-500 leading-snug line-clamp-2">{cameraOnly ? "Camera only" : "Tap to add"}</p>
        </div>
      )}

      <AnimatePresence>
        {busy && (
          <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 overflow-hidden">
            <motion.span aria-hidden className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-brand-400/40 to-transparent" initial={{ top: "-20%" }} animate={{ top: ["-20%", "110%"] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
            <motion.span className="size-9 rounded-full border-2 border-brand-400/30 border-t-brand-400" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
            <p className="text-[12px] font-semibold text-ink-100">{busy === "uploading" ? "Uploading…" : "Checking with AI…"}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
