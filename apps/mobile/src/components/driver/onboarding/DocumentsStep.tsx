import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { DOCUMENT_META, DOCUMENT_TYPES, type DocumentType, type DriverDto } from "@raahi/shared";
import { DocumentSheet } from "@/components/driver/DocumentSheet";
import { DocumentTile, type DocumentBusy } from "@/components/driver/DocumentTile";
import { Button, useToast } from "@/components/ui";
import { docFor, documentProgress } from "@/hooks/driver/onboarding";
import { useApplyDriver } from "@/hooks/driver/useDriver";
import { api } from "@/lib/api";
import { item, spring, stagger } from "@/lib/motion";
import { haptic, pickImage } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

/** Step 3 — seven KYC photos, each verified by Gemini the moment it lands. */
export function DocumentsStep({ driver, onNext, nextLabel = "Continue" }: { driver: DriverDto; onNext: () => void; nextLabel?: string }) {
  const toast = useToast();
  const apply = useApplyDriver();
  const [busy, setBusy] = useState<Partial<Record<DocumentType, DocumentBusy>>>({});
  const [openType, setOpenType] = useState<DocumentType | null>(null);
  const progress = documentProgress(driver);

  const capture = async (type: DocumentType, source: "camera" | "gallery" | "prompt") => {
    try {
      const blob = await pickImage(type === "selfie" ? "camera" : source);
      if (!blob) return;
      setBusy((b) => ({ ...b, [type]: "uploading" }));
      const up = await api.files.upload(blob, "document", `${type}.jpg`);
      setBusy((b) => ({ ...b, [type]: "verifying" }));
      const next = await api.driver.attachDocument({ type, fileId: up.file.id });
      apply(next);
      const doc = docFor(next, type);
      if (doc?.status === "verified") {
        haptic.success();
        toast({ title: `${DOCUMENT_META[type].label} verified`, body: doc.aiVerdict?.summary, tone: "success" });
      } else if (doc?.status === "rejected") {
        haptic.error();
        toast({ title: `${DOCUMENT_META[type].label} rejected`, body: doc.aiVerdict?.issues[0] ?? doc.aiVerdict?.summary ?? "Please retake a clearer photo.", tone: "error" });
      } else {
        haptic.warning();
        toast({ title: "Uploaded — needs a quick review", body: doc?.aiVerdict?.summary ?? "Our team will check it shortly.", tone: "brand" });
      }
    } catch (err) {
      haptic.error();
      toast({ title: "Upload failed", body: errorMessage(err), tone: "error" });
    } finally {
      setBusy((b) => ({ ...b, [type]: null }));
    }
  };

  const pct = Math.round((progress.uploaded / progress.required) * 100);

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex flex-col gap-4 pb-4">
      {/* Progress */}
      <motion.div variants={item.left} className="rounded-3xl bg-ink-800 border border-white/6 p-4 shadow-card">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-[17px] font-semibold text-ink-50">
            {progress.uploaded} of {progress.required} added
          </p>
          <p className="text-[12.5px] text-ink-400 tabular-nums">
            {progress.verified} verified{progress.flagged.length > 0 && ` · ${progress.flagged.length} in review`}
            {progress.rejected.length > 0 && <span className="text-rose-400"> · {progress.rejected.length} rejected</span>}
          </p>
        </div>
        <div className="mt-2.5 h-2 rounded-full bg-white/6 overflow-hidden">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" initial={false} animate={{ width: `${pct}%` }} transition={spring} />
        </div>
        <p className="mt-2.5 flex items-start gap-2 text-[12.5px] text-ink-400 leading-snug">
          <Sparkles className="size-3.5 text-violet-400 shrink-0 mt-0.5" />
          Each photo is checked instantly by AI. Fill the frame, avoid glare, and keep all text readable.
        </p>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {DOCUMENT_TYPES.map((type, i) => (
          <DocumentTile key={type} type={type} doc={docFor(driver, type)} busy={busy[type] ?? null} index={i} onCapture={(s) => void capture(type, s)} onOpen={() => setOpenType(type)} />
        ))}
      </div>

      <AnimatePresence initial={false}>
        {progress.rejected.length > 0 && (
          <motion.div key="rej" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="flex items-start gap-2.5 rounded-2xl bg-rose-500/8 border border-rose-500/20 px-3.5 py-3">
            <TriangleAlert className="size-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[13px] text-ink-200 leading-snug">
              Retake {progress.rejected.map((t) => DOCUMENT_META[t].label).join(", ")} before you continue.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={item.up} className="pt-1">
        <Button full size="xl" disabled={!progress.ready} onClick={onNext} className={cn(!progress.ready && "opacity-90")}>
          {progress.ready ? nextLabel : `${progress.required - progress.uploaded} more to add`}
        </Button>
      </motion.div>

      {openType && (
        <DocumentSheet
          open={openType !== null}
          onClose={() => setOpenType(null)}
          type={openType}
          doc={docFor(driver, openType)}
          busy={busy[openType] ?? null}
          onRetake={(s) => {
            const t = openType;
            setOpenType(null);
            void capture(t, s);
          }}
        />
      )}
    </motion.div>
  );
}
