import { motion } from "framer-motion";
import { ShieldWarning, SignOut } from "@phosphor-icons/react";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { LogoMark } from "@/components/Brand";
import { DriverTabBar } from "@/components/driver/DriverTabBar";
import { SubscriptionBanner } from "@/components/driver/SubscriptionBanner";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Redirect } from "@/components/shared/Redirect";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { presence, useDriverPresence } from "@/hooks/driver/presence";
import { useActiveRideRedirect } from "@/hooks/driver/useActiveRideRedirect";
import { useDriver } from "@/hooks/driver/useDriver";
import { useOnline } from "@/hooks/useOnline";
import { useAuth } from "@/lib/auth";
import { spring } from "@/lib/motion";
import { errorMessage } from "@/lib/utils";

/**
 * Driver tab shell. Refreshes the driver profile on mount, sends anyone who
 * is not yet approved to the onboarding wizard, keeps presence in sync with
 * the server and jumps to the live ride screen when an offer gets accepted.
 */
export default function DriverShell() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { driver, query } = useDriver();
  const { online } = useDriverPresence();
  const connected = useOnline();

  useEffect(() => {
    if (query.data) presence.hydrate(query.data.id, query.data.isOnline);
  }, [query.data]);

  useActiveRideRedirect(online);

  if (!driver) {
    if (query.isError) {
      return (
        <div className="relative h-full w-full flex flex-col items-center justify-center bg-paper-50 px-6 overflow-hidden">
          <span aria-hidden className="blob bg-coral-100 w-72 h-72 -top-20 -right-24 opacity-80" />
          <EmptyState
            icon={ShieldWarning}
            tone="teal"
            title="Couldn't load your driver profile"
            body={errorMessage(query.error, "Check your connection and try again.")}
            action={
              <div className="flex flex-col gap-2 items-center">
                <Button size="md" variant="teal" onClick={() => void query.refetch()} loading={query.isFetching}>
                  Try again
                </Button>
                <Button
                  size="md"
                  variant="ghost"
                  icon={SignOut}
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
    return (
      <div className="relative h-full w-full flex flex-col items-center justify-center gap-5 bg-paper-50 overflow-hidden">
        <span aria-hidden className="blob bg-teal-100 w-80 h-80 -top-24 -left-24 opacity-80" />
        <span aria-hidden className="blob bg-sun-100 w-64 h-64 -bottom-16 -right-16 opacity-80" style={{ animationDelay: "-6s" }} />
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="relative">
          <LogoMark size={72} animated />
        </motion.div>
        <Spinner className="text-teal-500" />
        <p className="relative text-[13.5px] font-semibold text-ink-500">Loading your driver profile…</p>
      </div>
    );
  }

  if (driver.status !== "approved") return <Redirect to="/d/onboarding" />;

  return (
    <div className="relative h-full w-full bg-paper-50">
      <Outlet />
      <OfflineBanner className="!top-[calc(var(--safe-top)_+_76px)]" />
      <SubscriptionBanner driver={driver} offset={connected ? 68 : 124} />
      <DriverTabBar />
    </div>
  );
}
