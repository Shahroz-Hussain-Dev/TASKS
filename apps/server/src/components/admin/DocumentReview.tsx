"use client";

import { motion } from "framer-motion";
import { AlertTriangle, BadgeCheck, Bot, CircleX, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import { DOCUMENT_META, DOCUMENT_TYPES, type DocumentAiVerdict, type DocumentDto, type DocumentType } from "@raahi/shared";
import { fileUrl } from "@/lib/admin-client";
import { cn, DOC_STATUS_LABEL, DOC_STATUS_TONE, fmtDateTime } from "./format";
import { item, spring, stagger } from "./motion";
import { Badge, Button } from "./ui";

export interface DocumentActions {
  onOpen: (doc: DocumentDto) => void;
  onVerify: (doc: DocumentDto) => void;
  onReject: (doc: DocumentDto) => void;
  onReverify: (doc: DocumentDto) => void;
  busyId: string | null;
  busyAction: "verify" | "reject" | "reverify" | null;
}

const EXTRACTED_LABELS: Record<keyof DocumentAiVerdict["extracted"], string> = {
  name: "Name",
  cnic: "CNIC",
  licenseNumber: "License no.",
  expiryDate: "Expiry",
  registrationNumber: "Registration",
  vehicleMakeModel: "Vehicle",
  dateOfBirth: "Date of birth",
};

function confidenceTone(c: number): string {
  if (c >= 0.8) return "bg-brand-400";
  if (c >= 0.5) return "bg-amber-400";
  return "bg-rose-400";
}

export function VerdictPanel({ verdict, threshold }: { verdict: DocumentAiVerdict | null; threshold?: number }) {
  if (!verdict) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/8 px-3.5 py-3 text-[13px] text-ink-400">
        <Bot size={16} /> No AI verdict yet. Run a verification to analyse this document.
      </div>
    );
  }
  const pct = Math.round(verdict.confidence * 100);
  const extracted = (Object.keys(EXTRACTED_LABELS) as (keyof DocumentAiVerdict["extracted"])[]).filter((k) => verdict.extracted[k]);
  return (
    <div className="space-y-3 rounded-2xl border border-white/6 bg-ink-900/60 p-3.5">
      <div className="flex items-center justify-between gap-3 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink-200">
          <Bot size={14} className="text-violet-400" /> Gemini verdict
        </span>
        <span className="text-ink-500">{fmtDateTime(verdict.verifiedAt)}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[12.5px]">
          <span className="text-ink-400">Confidence</span>
          <span className="font-display font-semibold text-ink-50">{pct}%</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-ink-700">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ ...spring, delay: 0.1 }} className={cn("h-full rounded-full", confidenceTone(verdict.confidence))} />
          {threshold !== undefined ? <span title={`Auto-verify threshold ${Math.round(threshold * 100)}%`} className="absolute top-0 h-full w-0.5 bg-ink-50/70" style={{ left: `${Math.round(threshold * 100)}%` }} /> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Check ok={verdict.matchesExpectedType} label={verdict.matchesExpectedType ? `Detected ${verdict.detectedType}` : `Looks like ${verdict.detectedType}`} />
        <Check ok={verdict.legible} label={verdict.legible ? "Legible" : "Hard to read"} />
        {verdict.nameMatchesProfile !== null ? <Check ok={verdict.nameMatchesProfile} label={verdict.nameMatchesProfile ? "Name matches profile" : "Name differs from profile"} /> : null}
      </div>

      {extracted.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          {extracted.map((k) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11.5px] uppercase tracking-wide text-ink-500">{EXTRACTED_LABELS[k]}</dt>
              <dd className="truncate text-ink-100">{verdict.extracted[k]}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {verdict.issues.length > 0 ? (
        <ul className="space-y-1">
          {verdict.issues.map((issue) => (
            <li key={issue} className="flex items-start gap-2 text-[13px] text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {issue}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[13px] leading-relaxed text-ink-300">{verdict.summary}</p>
      <p className="text-[11.5px] text-ink-600">{verdict.model}</p>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold", ok ? "bg-brand-500/15 text-brand-300" : "bg-rose-500/15 text-rose-400")}>
      {ok ? <BadgeCheck size={12} /> : <CircleX size={12} />} {label}
    </span>
  );
}

export function DocumentGallery({ documents, actions, threshold }: { documents: DocumentDto[]; actions: DocumentActions; threshold?: number }) {
  const byType = new Map(documents.map((d) => [d.type, d]));
  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {DOCUMENT_TYPES.map((type) => {
        const doc = byType.get(type);
        return doc ? <DocumentCard key={type} doc={doc} actions={actions} threshold={threshold} /> : <MissingDocument key={type} type={type} />;
      })}
    </motion.div>
  );
}

function MissingDocument({ type }: { type: DocumentType }) {
  return (
    <motion.div variants={item.up} className="flex min-h-[140px] flex-col justify-center rounded-3xl border border-dashed border-white/8 p-5 text-center">
      <p className="font-display text-[15px] font-semibold text-ink-300">{DOCUMENT_META[type].label}</p>
      <p className="mt-1 text-[13px] text-ink-500">Not uploaded yet{DOCUMENT_META[type].required ? " · required" : ""}</p>
    </motion.div>
  );
}

function DocumentCard({ doc, actions, threshold }: { doc: DocumentDto; actions: DocumentActions; threshold?: number }) {
  const busy = actions.busyId === doc.id;
  return (
    <motion.article variants={item.up} className="overflow-hidden rounded-3xl border border-white/6 bg-ink-800 shadow-card">
      <button type="button" onClick={() => actions.onOpen(doc)} className="group relative block aspect-[4/3] w-full overflow-hidden bg-ink-900" aria-label={`Open ${DOCUMENT_META[doc.type].label}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl(doc.fileId)} alt={DOCUMENT_META[doc.type].label} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <span className="text-left">
            <span className="block font-display text-[15px] font-semibold text-ink-50">{DOCUMENT_META[doc.type].label}</span>
            <span className="block text-[12px] text-ink-300">Uploaded {fmtDateTime(doc.uploadedAt)}</span>
          </span>
          <Badge tone={DOC_STATUS_TONE[doc.status]}>{DOC_STATUS_LABEL[doc.status]}</Badge>
        </span>
        <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl bg-ink-950/60 text-ink-100 opacity-0 transition-opacity group-hover:opacity-100">
          <Eye size={16} />
        </span>
      </button>

      <div className="space-y-3 p-4">
        <VerdictPanel verdict={doc.aiVerdict} threshold={threshold} />
        {doc.reviewerNote ? (
          <p className="flex items-start gap-2 rounded-2xl bg-ink-900/60 px-3.5 py-2.5 text-[13px] text-ink-300">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-400" />
            <span>
              <span className="font-semibold text-ink-100">Reviewer note:</span> {doc.reviewerNote}
            </span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon={<BadgeCheck size={14} />} disabled={doc.status === "verified" || busy} loading={busy && actions.busyAction === "verify"} onClick={() => actions.onVerify(doc)}>
            {doc.status === "verified" ? "Verified" : "Verify"}
          </Button>
          <Button size="sm" variant="danger" icon={<CircleX size={14} />} disabled={doc.status === "rejected" || busy} loading={busy && actions.busyAction === "reject"} onClick={() => actions.onReject(doc)}>
            Reject
          </Button>
          <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} disabled={busy} loading={busy && actions.busyAction === "reverify"} onClick={() => actions.onReverify(doc)} className="ml-auto">
            Re-run AI check
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
