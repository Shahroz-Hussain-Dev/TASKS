import { motion } from "framer-motion";
import { Camera, Image as ImageIcon, ShieldCheck, Sparkle, UserCheck } from "@phosphor-icons/react";
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
        <motion.div variants={item.scale} className="bg-white rounded-[22px] p-2.5 shadow-pillow sticker-tilt-r">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] bg-paper-100">
            {doc && <AuthImage src={doc.url} alt={meta.label} className="absolute inset-0 w-full h-full" />}
            {status && (
              <div className="absolute top-3 left-3">
                <Badge tone={status.tone} className="shadow-pillow">
                  {status.label}
                </Badge>
              </div>
            )}
          </div>
        </motion.div>

        {status && (
          <motion.p variants={item.up} className="text-[14px] font-semibold text-ink-600 leading-relaxed px-1">
            {status.blurb}
          </motion.p>
        )}

        {v && (
          <motion.div variants={item.left} className="pillow p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-xl bg-lavender-100 text-lavender-500 flex items-center justify-center">
                <Sparkle className="size-[18px]" weight="duotone" />
              </span>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-500">AI verification</p>
              <span className="ml-auto text-[12px] font-bold text-ink-400 tabular-nums">{confidence}% sure</span>
            </div>
            <div className="h-2 rounded-full bg-paper-200 overflow-hidden">
              <motion.div className={cn("h-full rounded-full", confidence >= 80 ? "bg-mint-500" : confidence >= 50 ? "bg-sun-500" : "bg-rose-500")} initial={{ width: 0 }} animate={{ width: `${confidence}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <p className="text-[14px] font-semibold text-ink-800 leading-relaxed">{v.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={v.matchesExpectedType ? "mint" : "rose"}>{v.matchesExpectedType ? "Correct document" : `Looks like: ${v.detectedType}`}</Badge>
              <Badge tone={v.legible ? "mint" : "sun"}>{v.legible ? "Legible" : "Hard to read"}</Badge>
              {v.nameMatchesProfile !== null && (
                <Badge tone={v.nameMatchesProfile ? "mint" : "sun"}>
                  <UserCheck className="size-3" weight="fill" />
                  {v.nameMatchesProfile ? "Name matches" : "Name differs"}
                </Badge>
              )}
            </div>
            {extracted.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                {extracted.map(([k, val]) => (
                  <div key={k} className="contents">
                    <dt className="font-bold text-ink-400">{FIELD_LABELS[k] ?? k}</dt>
                    <dd className="text-ink-900 font-bold tabular-nums truncate">{val}</dd>
                  </div>
                ))}
              </dl>
            )}
            {v.issues.length > 0 && (
              <ul className="flex flex-col gap-1.5 rounded-2xl bg-sun-100 px-3 py-2.5">
                {v.issues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2 text-[13px] font-semibold text-ink-700">
                    <span className="mt-1.5 size-1.5 rounded-full bg-sun-600 shrink-0" />
                    <span className="leading-snug">{issue}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {doc?.reviewerNote && (
          <motion.div variants={item.right} className="flex items-start gap-2.5 rounded-[22px] bg-sky-100 px-3.5 py-3">
            <ShieldCheck className="size-5 text-sky-600 shrink-0 mt-0.5" weight="duotone" />
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-sky-600">Reviewer note</p>
              <p className="text-[13.5px] font-semibold text-ink-700 leading-snug mt-0.5">{doc.reviewerNote}</p>
            </div>
          </motion.div>
        )}

        <motion.div variants={item.up} className="flex flex-col gap-2 pt-1">
          <Button full variant={doc?.status === "verified" ? "secondary" : "teal"} icon={Camera} loading={busy !== null} onClick={() => onRetake("camera")}>
            {doc?.status === "verified" ? "Retake anyway" : "Retake photo"}
          </Button>
          {type !== "selfie" && (
            <Button full variant="ghost" icon={ImageIcon} disabled={busy !== null} onClick={() => onRetake("gallery")}>
              Choose from gallery
            </Button>
          )}
          <p className="text-center text-[12px] font-semibold text-ink-400 leading-snug px-4">{meta.hint}</p>
        </motion.div>
      </motion.div>
    </Sheet>
  );
}
