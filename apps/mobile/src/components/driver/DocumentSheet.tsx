import { motion } from "framer-motion";
import { Camera, Image as ImageIcon, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { DOCUMENT_META, type DocumentDto, type DocumentType } from "@raahi/shared";
import { AuthImage, Badge, Button, Sheet } from "@/components/ui";
import { DOC_STATUS_META } from "@/hooks/driver/onboarding";
import { item, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { DocumentBusy } from "./DocumentTile";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  cnic: "CNIC",
  licenseNumber: "License no.",
  expiryDate: "Expiry",
  registrationNumber: "Registration",
  vehicleMakeModel: "Vehicle",
  dateOfBirth: "Date of birth",
};

/**
 * Full view of one uploaded document: the photo, the AI verdict with
 * confidence, what it read, any issues, and retake actions.
 */
export function DocumentSheet({ open, onClose, type, doc, busy, onRetake }: { open: boolean; onClose: () => void; type: DocumentType; doc: DocumentDto | null; busy: DocumentBusy; onRetake: (source: "camera" | "gallery") => void }) {
  const meta = DOCUMENT_META[type];
  const v = doc?.aiVerdict ?? null;
  const status = doc ? DOC_STATUS_META[doc.status] : null;
  const extracted = v ? (Object.entries(v.extracted) as [string, string | null | undefined][]).filter(([, val]) => Boolean(val)) : [];
  const confidence = v ? Math.round(v.confidence * 100) : 0;

  return (
    <Sheet open={open} onClose={onClose} title={meta.label}>
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex flex-col gap-4 pb-2">
        <motion.div variants={item.scale} className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-ink-700 border border-white/8">
          {doc && <AuthImage src={doc.url} alt={meta.label} className="absolute inset-0 w-full h-full" />}
          {status && (
            <div className="absolute top-3 left-3">
              <Badge tone={status.tone} className="shadow-card">
                {status.label}
              </Badge>
            </div>
          )}
        </motion.div>

        {status && (
          <motion.p variants={item.up} className="text-[14px] text-ink-300 leading-relaxed">
            {status.blurb}
          </motion.p>
        )}

        {v && (
          <motion.div variants={item.left} className="rounded-3xl bg-ink-900/60 border border-white/6 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-400" />
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-400">AI verification</p>
              <span className="ml-auto text-[12px] text-ink-500 tabular-nums">{confidence}% sure</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
              <motion.div className={cn("h-full rounded-full", confidence >= 80 ? "bg-brand-400" : confidence >= 50 ? "bg-amber-400" : "bg-rose-400")} initial={{ width: 0 }} animate={{ width: `${confidence}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <p className="text-[14px] text-ink-100 leading-relaxed">{v.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={v.matchesExpectedType ? "brand" : "rose"}>{v.matchesExpectedType ? "Correct document" : `Looks like: ${v.detectedType}`}</Badge>
              <Badge tone={v.legible ? "brand" : "amber"}>{v.legible ? "Legible" : "Hard to read"}</Badge>
              {v.nameMatchesProfile !== null && (
                <Badge tone={v.nameMatchesProfile ? "brand" : "amber"}>
                  <UserRoundCheck className="size-3" />
                  {v.nameMatchesProfile ? "Name matches" : "Name differs"}
                </Badge>
              )}
            </div>
            {extracted.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                {extracted.map(([k, val]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-500">{FIELD_LABELS[k] ?? k}</dt>
                    <dd className="text-ink-100 font-medium tabular-nums truncate">{val}</dd>
                  </div>
                ))}
              </dl>
            )}
            {v.issues.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {v.issues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2 text-[13px] text-amber-200/90">
                    <span className="mt-1.5 size-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="leading-snug">{issue}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {doc?.reviewerNote && (
          <motion.div variants={item.right} className="flex items-start gap-2.5 rounded-2xl bg-sky-400/8 border border-sky-400/15 px-3.5 py-3">
            <ShieldCheck className="size-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-sky-400">Reviewer note</p>
              <p className="text-[13.5px] text-ink-200 leading-snug mt-0.5">{doc.reviewerNote}</p>
            </div>
          </motion.div>
        )}

        <motion.div variants={item.up} className="flex flex-col gap-2 pt-1">
          <Button full variant={doc?.status === "verified" ? "secondary" : "primary"} icon={Camera} loading={busy !== null} onClick={() => onRetake("camera")}>
            {doc?.status === "verified" ? "Retake anyway" : "Retake photo"}
          </Button>
          {type !== "selfie" && (
            <Button full variant="ghost" icon={ImageIcon} disabled={busy !== null} onClick={() => onRetake("gallery")}>
              Choose from gallery
            </Button>
          )}
          <p className="text-center text-[12px] text-ink-500 leading-snug px-4">{meta.hint}</p>
        </motion.div>
      </motion.div>
    </Sheet>
  );
}
