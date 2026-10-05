"use client";

import { ArrowCounterClockwise, Car, IdentificationCard, Phone, Prohibit, Receipt, SealCheck, Star, Wallet, XCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DOCUMENT_META, type DocumentDto, type DriverStatus } from "@raahi/shared";
import { adminApi, errorMessage, fileUrl, isAdminApiError, type DriverDecision } from "@/lib/admin-client";
import { DocumentGallery, type DocumentActions } from "@/components/admin/DocumentReview";
import { categoryLabel, daysUntil, DRIVER_STATUS_LABEL, DRIVER_STATUS_TONE, fmtDate, fmtDateTime, km, pkr, RIDE_STATUS_LABEL, RIDE_STATUS_TONE, SUB_STATUS_LABEL, SUB_STATUS_TONE, timeAgo } from "@/components/admin/format";
import { Lightbox, type LightboxImage } from "@/components/admin/Lightbox";
import { item, stagger } from "@/components/admin/motion";
import { useToast } from "@/components/admin/toast";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, KeyValue, PageHeader, ReasonDialog, Skeleton } from "@/components/admin/ui";

interface DecisionConfig {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "primary" | "teal" | "danger" | "amber" | "secondary";
  reasonRequired: boolean;
  placeholder: string;
}

const DECISIONS: Record<DriverDecision, DecisionConfig> = {
  approve: {
    title: "Approve this driver?",
    description: "They will be able to go online immediately. Approval requires an active subscription.",
    confirmLabel: "Approve driver",
    tone: "teal",
    reasonRequired: false,
    placeholder: "Optional note for the audit log",
  },
  reject: {
    title: "Reject this application",
    description: "The driver sees your reason in the app and can fix the problem and resubmit.",
    confirmLabel: "Reject",
    tone: "danger",
    reasonRequired: true,
    placeholder: "e.g. CNIC photo is blurry and the license has expired.",
  },
  suspend: {
    title: "Suspend this driver",
    description: "They are taken offline now, open offers are withdrawn and they cannot go online until reinstated.",
    confirmLabel: "Suspend",
    tone: "danger",
    reasonRequired: true,
    placeholder: "e.g. Multiple passenger complaints about unsafe driving.",
  },
  reinstate: {
    title: "Reinstate this driver?",
    description: "Their account returns to approved. They still need an active subscription to go online.",
    confirmLabel: "Reinstate",
    tone: "teal",
    reasonRequired: false,
    placeholder: "Optional note for the audit log",
  },
};

type DocAction = { doc: DocumentDto; kind: "verify" | "reject" };

export default function DriverDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const queryClient = useQueryClient();

  const driver = useQuery({ queryKey: ["admin", "driver", id], queryFn: ({ signal }) => adminApi.drivers.get(id, signal) });
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: ({ signal }) => adminApi.settings.get(signal), staleTime: 300_000 });

  const [decision, setDecision] = useState<DriverDecision | null>(null);
  const [reason, setReason] = useState("");
  const [docAction, setDocAction] = useState<DocAction | null>(null);
  const [docNote, setDocNote] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [lightboxSet, setLightboxSet] = useState<"documents" | "receipts">("documents");
  const [busyDoc, setBusyDoc] = useState<{ id: string; action: "verify" | "reject" | "reverify" } | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "driver", id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "drivers"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
  };

  const decide = useMutation({
    mutationFn: (d: DriverDecision) => adminApi.drivers.decide(id, d, reason.trim() || undefined),
    onSuccess: (updated, d) => {
      const titles: Record<DriverDecision, string> = { approve: "Driver approved", reject: "Application rejected", suspend: "Driver suspended", reinstate: "Driver reinstated" };
      toast.success(titles[d], `Status is now ${DRIVER_STATUS_LABEL[updated.status].toLowerCase()}. The driver has been notified.`);
      setDecision(null);
      setReason("");
      refresh();
    },
    onError: (err) => toast.error("Decision not saved", errorMessage(err)),
  });

  const decideDoc = useMutation({
    mutationFn: ({ doc, kind }: DocAction) => adminApi.documents.decide(doc.id, kind === "verify" ? "verified" : "rejected", docNote.trim() || undefined),
    onMutate: ({ doc, kind }) => setBusyDoc({ id: doc.id, action: kind }),
    onSettled: () => setBusyDoc(null),
    onSuccess: (updated) => {
      toast.success(`${DOCUMENT_META[updated.type].label} ${updated.status}`, updated.status === "rejected" ? "The driver has been asked to upload it again." : "The driver has been notified.");
      setDocAction(null);
      setDocNote("");
      refresh();
    },
    onError: (err) => toast.error("Couldn't update the document", errorMessage(err)),
  });

  const reverify = useMutation({
    mutationFn: (doc: DocumentDto) => adminApi.documents.reverify(doc.id),
    onMutate: (doc) => setBusyDoc({ id: doc.id, action: "reverify" }),
    onSettled: () => setBusyDoc(null),
    onSuccess: (updated) => {
      const pct = updated.aiVerdict ? `${Math.round(updated.aiVerdict.confidence * 100)}% confidence` : "no verdict returned";
      toast.success("AI check complete", `${DOCUMENT_META[updated.type].label}: ${updated.status}, ${pct}.`);
      refresh();
    },
    onError: (err) => toast.error("AI check failed", isAdminApiError(err) && err.status === 429 ? "Too many re-checks in a minute. Try again shortly." : errorMessage(err)),
  });

  const d = driver.data;
  const documentImages = useMemo<LightboxImage[]>(
    () => (d?.documents ?? []).map((doc) => ({ src: fileUrl(doc.fileId), title: DOCUMENT_META[doc.type].label, caption: `${d?.user.fullName ?? ""} · uploaded ${fmtDateTime(doc.uploadedAt)}` })),
    [d],
  );
  const receiptImages = useMemo<LightboxImage[]>(
    () => (d?.subscription ? [{ src: fileUrl(d.subscription.receiptFileId), title: `Receipt · ${pkr(d.subscription.amountPkr)}`, caption: `${d.subscription.method}${d.subscription.transactionRef ? ` · ref ${d.subscription.transactionRef}` : ""}` }] : []),
    [d],
  );

  const docActions: DocumentActions = {
    onOpen: (doc) => {
      setLightboxSet("documents");
      setLightbox(Math.max(0, (d?.documents ?? []).findIndex((x) => x.id === doc.id)));
    },
    onVerify: (doc) => setDocAction({ doc, kind: "verify" }),
    onReject: (doc) => setDocAction({ doc, kind: "reject" }),
    onReverify: (doc) => reverify.mutate(doc),
    busyId: busyDoc?.id ?? null,
    busyAction: busyDoc?.action ?? null,
  };

  if (driver.isPending) return <DetailSkeleton />;
  if (driver.isError || !d) {
    return (
      <>
        <PageHeader title="Driver" back={{ href: "/admin/drivers", label: "All drivers" }} />
        <Card>
          <ErrorState error={driver.error} onRetry={() => driver.refetch()} />
        </Card>
      </>
    );
  }

  const status: DriverStatus = d.status;
  const verifiedDocs = d.documents.filter((x) => x.status === "verified").length;
  const requiredCount = Object.values(DOCUMENT_META).filter((m) => m.required).length;
  const subDays = daysUntil(d.subscription?.endsAt);

  const actions = (
    <>
      {status === "under_review" || status === "rejected" || status === "onboarding" ? (
        <Button variant="teal" icon={<SealCheck size={17} weight="fill" />} onClick={() => setDecision("approve")}>
          Approve
        </Button>
      ) : null}
      {status !== "rejected" && status !== "suspended" ? (
        <Button variant="danger" icon={<XCircle size={17} weight="fill" />} onClick={() => setDecision("reject")}>
          Reject
        </Button>
      ) : null}
      {status === "approved" ? (
        <Button variant="amber" icon={<Prohibit size={17} weight="bold" />} onClick={() => setDecision("suspend")}>
          Suspend
        </Button>
      ) : null}
      {status === "suspended" ? (
        <Button variant="teal" icon={<ArrowCounterClockwise size={17} weight="bold" />} onClick={() => setDecision("reinstate")}>
          Reinstate
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <PageHeader title={d.user.fullName} subtitle={`Driver since ${fmtDate(d.createdAt)} · ${d.totalRides} rides · ${pkr(d.totalEarningsPkr)} earned`} back={{ href: "/admin/drivers", label: "All drivers" }} actions={actions} />

      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left column: profile, vehicle, subscription */}
        <div className="space-y-6">
          <motion.div variants={item.left}>
            <Card>
              <div className="flex items-start gap-4">
                <button type="button" onClick={() => d.user.avatarUrl && window.open(d.user.avatarUrl, "_blank", "noopener")} className="shrink-0" aria-label="Open profile photo">
                  <Avatar name={d.user.fullName} src={d.user.avatarUrl} size={64} className="text-[20px]" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={DRIVER_STATUS_TONE[status]} dot={d.isOnline}>
                      {DRIVER_STATUS_LABEL[status]}
                    </Badge>
                    {d.isOnline ? <Badge tone="teal" dot>Online</Badge> : null}
                    {d.user.isBlocked ? <Badge tone="rose">Account blocked</Badge> : null}
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-800">
                    <Star size={15} weight="fill" className="text-sun-500" /> {d.user.ratingAvg.toFixed(1)} <span className="font-normal text-ink-500">({d.user.ratingCount} ratings)</span>
                  </p>
                  {d.user.phone ? (
                    <a href={`tel:${d.user.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-bold text-coral-600 hover:text-coral-700">
                      <Phone size={15} weight="duotone" /> {d.user.phone}
                    </a>
                  ) : null}
                </div>
              </div>
              {d.statusReason ? (
                <p className="mt-4 rounded-2xl bg-sun-100 px-3.5 py-2.5 text-[13px] text-ink-700">
                  <span className="font-bold text-sun-700">Status reason:</span> {d.statusReason}
                </p>
              ) : null}
              <div className="mt-5">
                <h3 className="mb-3 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-ink-500">
                  <IdentificationCard size={16} weight="duotone" className="text-coral-500" /> Identity
                </h3>
                <KeyValue
                  items={[
                    { label: "CNIC", value: d.cnic ?? "—" },
                    { label: "City", value: d.city ?? "—" },
                    { label: "License no.", value: d.licenseNumber ?? "—" },
                    { label: "License expiry", value: d.licenseExpiry ? fmtDate(d.licenseExpiry) : "—" },
                    { label: "Email", value: d.user.email ?? "—" },
                    { label: "Last seen", value: d.lastLocation ? timeAgo(d.lastLocation.updatedAt) : "Never online" },
                  ]}
                />
              </div>
              <div className="mt-5 grid grid-cols-5 gap-1.5">
                {(["details", "vehicle", "documents", "subscription", "submitted"] as const).map((step) => (
                  <div key={step} className="text-center">
                    <div className={`h-1.5 rounded-full ${d.onboarding[step] ? "bg-teal-500" : "bg-paper-200"}`} />
                    <p className="mt-1 text-[10.5px] font-semibold capitalize text-ink-500">{step}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item.left}>
            <Card title="Vehicle" action={<Car size={22} weight="duotone" className="text-coral-500" />}>
              {d.vehicle ? (
                <KeyValue
                  items={[
                    { label: "Category", value: categoryLabel(d.vehicle.category) },
                    { label: "Plate", value: <span className="inline-block rounded-lg bg-paper-100 px-2 py-0.5 font-display text-[17px] font-semibold tracking-wide text-ink-900 ring-1 ring-paper-300">{d.vehicle.plate}</span> },
                    { label: "Make & model", value: `${d.vehicle.make} ${d.vehicle.model}` },
                    { label: "Year · colour", value: `${d.vehicle.year} · ${d.vehicle.color}` },
                    { label: "Fuel economy", value: `${d.vehicle.kmPerLitre} km/L` },
                    { label: "Source", value: d.vehicle.isCustom ? "Custom entry" : "From catalogue" },
                  ]}
                />
              ) : (
                <p className="text-[14px] text-ink-500">No vehicle registered yet.</p>
              )}
            </Card>
          </motion.div>

          <motion.div variants={item.left}>
            <Card title="Subscription" subtitle={`${pkr(settings.data?.driverSubscriptionPkr ?? 1000)} every ${settings.data?.subscriptionDays ?? 30} days`} action={<Wallet size={22} weight="duotone" className="text-teal-600" />}>
              {d.subscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge tone={SUB_STATUS_TONE[d.subscription.status]}>{SUB_STATUS_LABEL[d.subscription.status]}</Badge>
                    {d.subscriptionActive && subDays !== null ? <span className={`text-[13px] font-bold ${subDays <= 5 ? "text-sun-700" : "text-ink-600"}`}>{subDays <= 0 ? "Expires today" : `${subDays} days left`}</span> : null}
                  </div>
                  <KeyValue
                    items={[
                      { label: "Amount", value: pkr(d.subscription.amountPkr) },
                      { label: "Method", value: d.subscription.method },
                      { label: "Transaction ref", value: d.subscription.transactionRef ?? "—" },
                      { label: "Period", value: d.subscription.startsAt ? `${fmtDate(d.subscription.startsAt)} → ${fmtDate(d.subscription.endsAt)}` : "Not started" },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLightboxSet("receipts");
                      setLightbox(0);
                    }}
                    className="group relative block h-32 w-full overflow-hidden rounded-2xl bg-paper-100 ring-1 ring-paper-200"
                    aria-label="Open receipt"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(d.subscription.receiptFileId)} alt="Payment receipt" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-bold text-ink-900 shadow-pillow">
                      <Receipt size={13} weight="duotone" className="text-coral-500" /> Receipt
                    </span>
                  </button>
                  {d.subscription.reviewerNote ? <p className="text-[13px] text-ink-600">{d.subscription.reviewerNote}</p> : null}
                  {d.subscription.status === "pending" ? (
                    <Link href="/admin/subscriptions" className="inline-flex text-[13px] font-bold text-coral-600 hover:text-coral-700">
                      Review receipt in Subscriptions →
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="text-[14px] text-ink-500">No payment uploaded yet. Approval is blocked until a subscription is active.</p>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Right columns: documents, rides, audit */}
        <div className="space-y-6 xl:col-span-2">
          <motion.div variants={item.up}>
            <Card
              title="Documents"
              subtitle={`${verifiedDocs} of ${requiredCount} required documents verified${settings.data ? ` · auto-verify above ${Math.round(settings.data.autoVerifyConfidence * 100)}% confidence` : ""}`}
              padded
            >
              <DocumentGallery documents={d.documents} actions={docActions} threshold={settings.data?.autoVerifyConfidence} />
            </Card>
          </motion.div>

          <motion.div variants={item.up}>
            <Card padded={false} title="Recent rides" subtitle="Last 10 trips">
              {d.rides.length === 0 ? (
                <EmptyState title="No rides yet" description="Completed and cancelled trips will be listed here." className="py-8" />
              ) : (
                <ul className="divide-y divide-paper-200">
                  {d.rides.map((r) => (
                    <li key={r.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-ink-900">
                          {r.pickup.name ?? r.pickup.address} <span className="text-ink-400">→</span> {r.dropoff.name ?? r.dropoff.address}
                        </p>
                        <p className="text-[12.5px] text-ink-500">
                          {fmtDateTime(r.createdAt)} · {km(r.distanceKm)} · {r.customer.fullName}
                        </p>
                      </div>
                      <Badge tone={RIDE_STATUS_TONE[r.status]}>{RIDE_STATUS_LABEL[r.status]}</Badge>
                      <span className="w-24 text-right font-display font-semibold tabular-nums text-ink-900">{pkr(r.farePkr)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </motion.div>

          <motion.div variants={item.up}>
            <Card padded={false} title="Activity" subtitle="Decisions, logins and changes involving this driver">
              {d.audit.length === 0 ? (
                <EmptyState title="No activity yet" className="py-8" />
              ) : (
                <ul className="divide-y divide-paper-200">
                  {d.audit.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-[13.5px]">
                      <span className="w-36 shrink-0 text-ink-500">{fmtDateTime(a.createdAt)}</span>
                      <Badge tone={a.action.includes("reject") || a.action.includes("suspend") ? "rose" : a.action.includes("approve") || a.action.includes("verified") ? "mint" : "neutral"}>{a.action}</Badge>
                      <span className="truncate text-ink-600">
                        {a.actorName ?? a.actorRole ?? "system"}
                        {a.meta && typeof a.meta.reason === "string" ? ` — ${a.meta.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </motion.div>
        </div>
      </motion.div>

      <Lightbox images={lightboxSet === "documents" ? documentImages : receiptImages} index={lightbox} onClose={() => setLightbox(null)} onIndexChange={setLightbox} />

      {decision ? (
        <ReasonDialog
          open
          onClose={() => {
            setDecision(null);
            setReason("");
          }}
          onConfirm={() => decide.mutate(decision)}
          title={DECISIONS[decision].title}
          description={DECISIONS[decision].description}
          confirmLabel={DECISIONS[decision].confirmLabel}
          tone={DECISIONS[decision].tone}
          reasonLabel="Reason shown to the driver"
          reasonPlaceholder={DECISIONS[decision].placeholder}
          reasonRequired={DECISIONS[decision].reasonRequired}
          reason={reason}
          onReasonChange={setReason}
          loading={decide.isPending}
        />
      ) : null}

      {docAction ? (
        <ReasonDialog
          open
          onClose={() => {
            setDocAction(null);
            setDocNote("");
          }}
          onConfirm={() => decideDoc.mutate(docAction)}
          title={docAction.kind === "verify" ? `Verify ${DOCUMENT_META[docAction.doc.type].label}?` : `Reject ${DOCUMENT_META[docAction.doc.type].label}`}
          description={docAction.kind === "verify" ? "Marks this document as checked by a human. If every required document is verified and the subscription is active, the driver is approved automatically." : "The driver is asked to upload a new photo. If they are currently approved they are taken off the road until it is fixed."}
          confirmLabel={docAction.kind === "verify" ? "Mark verified" : "Reject document"}
          tone={docAction.kind === "verify" ? "teal" : "danger"}
          reasonLabel="Note for the driver"
          reasonPlaceholder={docAction.kind === "verify" ? "Optional" : "e.g. The back side is cut off — include the whole card."}
          reason={docNote}
          onReasonChange={setDocNote}
          loading={decideDoc.isPending}
          maxLength={300}
        />
      ) : null}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
        <div className="space-y-6 xl:col-span-2">
          <Skeleton className="h-[520px] rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
