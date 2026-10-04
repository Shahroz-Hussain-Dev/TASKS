import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LogOut, ShieldAlert, UserRound } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { DriverDto, UserDto } from "@raahi/shared";
import { LogoMark } from "@/components/Brand";
import { DetailsStep } from "@/components/driver/onboarding/DetailsStep";
import { DocumentsStep } from "@/components/driver/onboarding/DocumentsStep";
import { ReviewStep } from "@/components/driver/onboarding/ReviewStep";
import { StatusView } from "@/components/driver/onboarding/StatusView";
import { SubscriptionStep } from "@/components/driver/onboarding/SubscriptionStep";
import { VehicleStep } from "@/components/driver/onboarding/VehicleStep";
import { ProgressRail } from "@/components/driver/ProgressRail";
import { Aurora } from "@/components/shared/Aurora";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Badge, Button, EmptyState, IconButton, Screen, Spinner, TopBar } from "@/components/ui";
import { STATUS_POLL_MS } from "@/hooks/driver/keys";
import { completedSteps, DRIVER_STATUS_META, prevStep, nextStep, stepIndex, WIZARD_STEPS, wizardEntry, type WizardStep } from "@/hooks/driver/onboarding";
import { useApplyDriver, useDriver } from "@/hooks/driver/useDriver";
import { useAuth } from "@/lib/auth";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { errorMessage } from "@/lib/utils";

const BASE = "/d/onboarding";

/**
 * Five-step driver onboarding with a status screen at the end. Each step
 * persists on its own; the wizard resumes at the first unfinished step and
 * serves as the status screen once the application is submitted.
 */
export default function OnboardingWizard() {
  const { user, driver: cached } = useAuth();
  const { driver, query } = useDriver({ refetchInterval: cached?.status === "under_review" ? STATUS_POLL_MS : false });

  if (!user) return null;

  if (!driver) {
    if (query.isError) return <LoadError message={errorMessage(query.error, "Check your connection and try again.")} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-5 bg-ink-900">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
          <LogoMark size={72} animated />
        </motion.div>
        <Spinner />
        <p className="text-[13px] text-ink-400">Setting up your driver profile…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route index element={<Navigate to={wizardEntry(driver)} replace />} />
      {WIZARD_STEPS.map((s) => (
        <Route key={s.id} path={s.id} element={<StepScreen step={s.id} driver={driver} user={user} />} />
      ))}
      <Route path="status" element={<StatusScreen driver={driver} refreshing={query.isFetching} onRefresh={() => void query.refetch()} />} />
      <Route path="*" element={<Navigate to={BASE} replace />} />
    </Routes>
  );
}

/* ------------------------------------------------------------------ */

function StepScreen({ step, driver, user }: { step: WizardStep; driver: DriverDto; user: UserDto }) {
  const navigate = useNavigate();
  const apply = useApplyDriver();
  const meta = WIZARD_STEPS[stepIndex(step)];
  const done = useMemo(() => completedSteps(driver), [driver]);
  const inStatusFlow = driver.status !== "onboarding";

  // Approved drivers have nothing left to do here.
  if (driver.status === "approved") return <Navigate to="/d/home" replace />;

  const go = (s: WizardStep) => navigate(`${BASE}/${s}`);
  const next = () => {
    const n = nextStep(step);
    navigate(n ? `${BASE}/${n}` : `${BASE}/status`);
  };
  const back = () => {
    const p = prevStep(step);
    if (p) go(p);
    else if (inStatusFlow) navigate(`${BASE}/status`);
  };
  const showBack = Boolean(prevStep(step)) || inStatusFlow;

  return (
    <Screen className="noise">
      <OfflineBanner />
      <Aurora variant="top" intensity={0.55} />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="relative flex-1 flex flex-col">
        <motion.div variants={item.down}>
          <TopBar
            left={showBack ? <IconButton icon={ArrowLeft} label="Back" variant="glass" onClick={back} /> : <LogoMark size={40} />}
            title={
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[20px] font-semibold text-ink-50 truncate">Driver setup</h1>
                {inStatusFlow && <Badge tone={DRIVER_STATUS_META[driver.status].tone}>{DRIVER_STATUS_META[driver.status].label}</Badge>}
              </div>
            }
            subtitle={`Step ${stepIndex(step) + 1} of ${WIZARD_STEPS.length}`}
            right={<IconButton icon={UserRound} label="Profile" variant="glass" onClick={() => navigate("/profile")} />}
          />
        </motion.div>

        <motion.div variants={item.fade} className="mt-2 mb-5">
          <ProgressRail steps={WIZARD_STEPS} current={step} completed={done} onSelect={(id) => go(id as WizardStep)} />
        </motion.div>

        <motion.div variants={item.left} className="mb-5">
          <h2 className="font-display text-[26px] font-bold text-ink-50 tracking-tight leading-tight">{meta?.title}</h2>
          <p className="mt-1 text-[14.5px] text-ink-400 leading-relaxed">{meta?.subtitle}</p>
        </motion.div>

        <motion.div variants={item.up} className="flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={spring}>
              {step === "details" && <DetailsStep driver={driver} onNext={next} />}
              {step === "vehicle" && <VehicleStep driver={driver} onNext={next} />}
              {step === "documents" && <DocumentsStep driver={driver} onNext={next} nextLabel={inStatusFlow ? "Continue to review" : "Continue"} />}
              {step === "subscription" && <SubscriptionStep driver={driver} onNext={next} />}
              {step === "review" && (
                <ReviewStep
                  driver={driver}
                  user={user}
                  onEdit={go}
                  onSubmitted={(d) => {
                    apply(d);
                    navigate(`${BASE}/status`, { replace: true });
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </Screen>
  );
}

function StatusScreen({ driver, refreshing, onRefresh }: { driver: DriverDto; refreshing: boolean; onRefresh: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Nothing submitted yet → back to the first unfinished step.
  if (driver.status === "onboarding") return <Navigate to={`${BASE}/${wizardEntry(driver)}`} replace />;

  return (
    <Screen className="noise">
      <OfflineBanner />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="relative flex-1 flex flex-col">
        <motion.div variants={item.down}>
          <TopBar
            left={<LogoMark size={40} />}
            title="Application status"
            subtitle={DRIVER_STATUS_META[driver.status].label}
            right={<IconButton icon={UserRound} label="Profile" variant="glass" onClick={() => navigate("/profile")} />}
          />
        </motion.div>
        <StatusView
          key={`${driver.status}-${pathname}`}
          driver={driver}
          refreshing={refreshing}
          onRefresh={() => {
            haptic.light();
            onRefresh();
          }}
          onFixDocuments={() => navigate(`${BASE}/documents`)}
          onGoOnline={() => {
            haptic.success();
            navigate("/d/home", { replace: true });
          }}
        />
      </motion.div>
    </Screen>
  );
}

function LoadError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  useEffect(() => {
    haptic.warning();
  }, []);
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-ink-900 px-6">
      <EmptyState
        icon={ShieldAlert}
        title="Couldn't load your profile"
        body={message}
        action={
          <div className="flex flex-col gap-2 items-center">
            <Button size="md" onClick={onRetry} loading={retrying}>
              Try again
            </Button>
            <Button
              size="md"
              variant="ghost"
              icon={LogOut}
              onClick={async () => {
                await logout();
                navigate("/welcome", { replace: true });
              }}
            >
              Log out
            </Button>
          </div>
        }
      />
    </div>
  );
}
