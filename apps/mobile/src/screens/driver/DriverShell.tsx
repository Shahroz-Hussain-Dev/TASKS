import { motion } from "framer-motion";
import { LogOut, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { LogoMark } from "@/components/Brand";
import { DriverTabBar } from "@/components/driver/DriverTabBar";
import { SubscriptionBanner } from "@/components/driver/SubscriptionBanner";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
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
        <div className="h-full w-full flex flex-col items-center justify-center bg-ink-900 px-6">
          <EmptyState
            icon={ShieldAlert}
            title="Couldn't load your driver profile"
            body={errorMessage(query.error, "Check your connection and try again.")}
            action={
              <div className="flex flex-col gap-2 items-center">
                <Button size="md" onClick={() => void query.refetch()} loading={query.isFetching}>
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
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-5 bg-ink-900">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
          <LogoMark size={72} animated />
        </motion.div>
        <Spinner />
        <p className="text-[13px] text-ink-400">Loading your driver profile…</p>
      </div>
    );
  }

  if (driver.status !== "approved") return <Navigate to="/d/onboarding" replace />;

  return (
    <div className="relative h-full w-full bg-ink-900">
      <Outlet />
      <OfflineBanner className="!top-[calc(var(--safe-top)_+_76px)]" />
      <SubscriptionBanner driver={driver} offset={connected ? 68 : 124} />
      <DriverTabBar />
    </div>
  );
}
