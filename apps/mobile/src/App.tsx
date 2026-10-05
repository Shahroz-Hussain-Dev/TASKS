import { lazy, Suspense, useContext, useEffect, useRef, type ReactNode } from "react";
import { HashRouter, Outlet, Route, Routes, UNSAFE_LocationContext, useLocation, useNavigate, useNavigationType, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { useAuth } from "./lib/auth";
import { pageVariants } from "./lib/motion";
import { onBackButton } from "./lib/native";
import { LogoMark } from "./components/Brand";
import { Redirect } from "./components/shared/Redirect";
import { Spinner } from "./components/ui";

/* Screens are lazy so the first paint is instant. */
const WelcomeScreen = lazy(() => import("./screens/WelcomeScreen"));
const LoginScreen = lazy(() => import("./screens/auth/LoginScreen"));
const SignupCustomerScreen = lazy(() => import("./screens/auth/SignupCustomerScreen"));
const SignupDriverScreen = lazy(() => import("./screens/auth/SignupDriverScreen"));
const ProfileScreen = lazy(() => import("./screens/ProfileScreen"));
const NotificationsScreen = lazy(() => import("./screens/NotificationsScreen"));
const SupportScreen = lazy(() => import("./screens/SupportScreen"));
const ServerSettingsScreen = lazy(() => import("./screens/ServerSettingsScreen"));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen"));

const CustomerShell = lazy(() => import("./screens/customer/CustomerShell"));
const CustomerHome = lazy(() => import("./screens/customer/HomeScreen"));
const PlanRideScreen = lazy(() => import("./screens/customer/PlanRideScreen"));
const BiddingScreen = lazy(() => import("./screens/customer/BiddingScreen"));
const CustomerRideScreen = lazy(() => import("./screens/customer/RideScreen"));
const CustomerRidesScreen = lazy(() => import("./screens/customer/RidesHistoryScreen"));
const RideDetailScreen = lazy(() => import("./screens/RideDetailScreen"));
const RideChatScreen = lazy(() => import("./screens/RideChatScreen"));

const DriverShell = lazy(() => import("./screens/driver/DriverShell"));
const DriverOnboarding = lazy(() => import("./screens/driver/OnboardingWizard"));
const DriverHome = lazy(() => import("./screens/driver/DriverHomeScreen"));
const DriverRequestScreen = lazy(() => import("./screens/driver/RequestDetailScreen"));
const DriverRideScreen = lazy(() => import("./screens/driver/DriverRideScreen"));
const EarningsScreen = lazy(() => import("./screens/driver/EarningsScreen"));
const DriverRidesScreen = lazy(() => import("./screens/driver/DriverRidesScreen"));
const SubscriptionScreen = lazy(() => import("./screens/driver/SubscriptionScreen"));

function Splash() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-6 bg-paper-50">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
        <LogoMark size={88} animated />
      </motion.div>
      <Spinner />
    </div>
  );
}

/**
 * Pins the outgoing page to the location it was rendered for while it animates
 * out. Without this, nested <Routes>, useLocation() and search params inside the
 * exiting page follow the new URL, re-render the new screen inside the old
 * container and keep it alive (and on top of the real page) for good.
 */
function FreezeOnExit({ children }: { children: ReactNode }) {
  const live = useContext(UNSAFE_LocationContext);
  const present = useIsPresent();
  const frozen = useRef(live);
  if (present) frozen.current = live;
  return <UNSAFE_LocationContext.Provider value={frozen.current}>{children}</UNSAFE_LocationContext.Provider>;
}

/** Animated route outlet — pages slide in/out based on navigation direction. */
function AnimatedOutlet() {
  const location = useLocation();
  const navType = useNavigationType();
  const dir = navType === "POP" ? -1 : 1;
  // Key on the first two path segments so nested tab switches don't re-mount the shell.
  const key = location.pathname;
  // Snapshot the matched element: the page that is animating out must keep
  // rendering the *old* route. A live <Outlet /> inside the exiting child would
  // re-read the router context and render the new page a second time, leaving
  // an invisible duplicate on top of the screen that swallows taps.
  const outlet = useOutlet();
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
      <motion.div key={key} custom={dir} variants={pageVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 bg-paper-50">
        <FreezeOnExit>
          <Suspense fallback={<Splash />}>{outlet}</Suspense>
        </FreezeOnExit>
      </motion.div>
    </AnimatePresence>
  );
}

function RequireRole({ role, children }: { role: "customer" | "driver"; children?: ReactNode }) {
  const { ready, user } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <Redirect to="/welcome" />;
  if (user.role !== role) return <Redirect to={user.role === "driver" ? "/d" : "/c"} />;
  return <>{children ?? <Outlet />}</>;
}

function RequireAuth() {
  const { ready, user } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <Redirect to="/welcome" />;
  return <Outlet />;
}

function RootRedirect() {
  const { ready, user } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <Redirect to="/welcome" />;
  return <Redirect to={user.role === "driver" ? "/d" : "/c"} />;
}

function GuestOnly() {
  const { ready, user } = useAuth();
  if (!ready) return <Splash />;
  if (user) return <Redirect to={user.role === "driver" ? "/d" : "/c"} />;
  return <Outlet />;
}

function BackButtonBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    return onBackButton(() => {
      const root = ["/", "/welcome", "/c", "/c/home", "/d", "/d/home"].includes(location.pathname);
      if (root) return false;
      navigate(-1);
      return true;
    });
  }, [navigate, location.pathname]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <BackButtonBridge />
      <div className="relative h-full w-full overflow-hidden bg-paper-50">
        <Routes>
          <Route element={<AnimatedOutlet />}>
            <Route path="/" element={<RootRedirect />} />
            <Route element={<GuestOnly />}>
              <Route path="/welcome" element={<WelcomeScreen />} />
              <Route path="/auth/login" element={<LoginScreen />} />
              <Route path="/auth/signup/customer" element={<SignupCustomerScreen />} />
              <Route path="/auth/signup/driver" element={<SignupDriverScreen />} />
            </Route>
            <Route path="/settings/server" element={<ServerSettingsScreen />} />

            <Route element={<RequireAuth />}>
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/notifications" element={<NotificationsScreen />} />
              <Route path="/support" element={<SupportScreen />} />
              <Route path="/rides/:id" element={<RideDetailScreen />} />
              <Route path="/rides/:id/chat" element={<RideChatScreen />} />
            </Route>

            <Route path="/c" element={<RequireRole role="customer"><CustomerShell /></RequireRole>}>
              <Route index element={<Redirect to="home" />} />
              <Route path="home" element={<CustomerHome />} />
              <Route path="rides" element={<CustomerRidesScreen />} />
            </Route>
            <Route element={<RequireRole role="customer" />}>
              <Route path="/c/plan" element={<PlanRideScreen />} />
              <Route path="/c/request/:id" element={<BiddingScreen />} />
              <Route path="/c/ride/:id" element={<CustomerRideScreen />} />
            </Route>

            <Route path="/d" element={<RequireRole role="driver"><DriverShell /></RequireRole>}>
              <Route index element={<Redirect to="home" />} />
              <Route path="home" element={<DriverHome />} />
              <Route path="earnings" element={<EarningsScreen />} />
              <Route path="rides" element={<DriverRidesScreen />} />
            </Route>
            <Route element={<RequireRole role="driver" />}>
              <Route path="/d/onboarding/*" element={<DriverOnboarding />} />
              <Route path="/d/request/:id" element={<DriverRequestScreen />} />
              <Route path="/d/ride/:id" element={<DriverRideScreen />} />
              <Route path="/d/subscription" element={<SubscriptionScreen />} />
            </Route>

            <Route path="*" element={<Redirect to="/" />} />
          </Route>
        </Routes>
      </div>
    </HashRouter>
  );
}
