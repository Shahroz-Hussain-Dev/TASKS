import { AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { ActiveTripBanner } from "@/components/customer/ActiveTripBanner";
import { TAB_BAR_PATHS, TabBar } from "@/components/customer/TabBar";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import "@/hooks/customer/mapRuntime";

/**
 * Passenger tab shell: screens render through the outlet; the floating tab
 * bar and the global active-trip banner sit above them. The bar is only shown
 * on the two tab roots — sub-screens get the full canvas.
 */
export default function CustomerShell() {
  const { pathname } = useLocation();
  const showTabs = TAB_BAR_PATHS.has(pathname);
  return (
    <div className="relative h-full w-full bg-paper-50">
      <Outlet />
      {showTabs && <ActiveTripBanner />}
      <OfflineBanner />
      <AnimatePresence>{showTabs && <TabBar key="tabs" />}</AnimatePresence>
    </div>
  );
}
