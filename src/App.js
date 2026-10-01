import { BrowserRouter, Routes, Route } from "react-router-dom";
import AboutUs from "./pages/AboutUs";
import NavBar from "./components/navbar/Navbar";
import Developers from "./pages/Developers";
import Footer from "./pages/Footer";
import Join from "./pages/Join";
import Loading from "./pages/Header";
import Partners from "./pages/Partners";
import Properties from "./pages/Properties";
import Subscribe from "./pages/Subscribe";
import ScrollUpButton from "./components/functions/ScrollUpButton";
import Notes from "./pages/Notes";
import WalletDemo from "./pages/WalletDemo";
import { Web3Provider } from "./contexts/Web3Context";

// daily_jobs social demo
import Login from "./social/Login";
import ForgotPassword from "./social/ForgotPassword";
import Reels from "./social/Reels";
import Admin from "./social/Admin";
import ProtectedRoute from "./social/ProtectedRoute";
import "./social/social.css";

// Home component - contains all your landing page sections
function Home() {
  return (
    <>
      <Loading />
      <Partners />
      <Properties />
      <AboutUs />
      <Developers />
      <Join />
      <Subscribe />
    </>
  );
}

// Layout for the original property-rental site (with navbar + footer chrome).
function SiteLayout({ children }) {
  return (
    <>
      <NavBar />
      {children}
      <Footer />
      <ScrollUpButton />
    </>
  );
}

function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <Routes>
          {/* ---- daily_jobs social app (standalone, no property chrome) ---- */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/reels"
            element={
              <ProtectedRoute>
                <Reels />
              </ProtectedRoute>
            }
          />
          {/* long share-style reel URLs resolve to the feed */}
          <Route
            path="/reels/:channel/video/:id"
            element={
              <ProtectedRoute>
                <Reels />
              </ProtectedRoute>
            }
          />
          <Route path="/admin" element={<Admin />} />

          {/* ---- original property-rental site ---- */}
          <Route
            path="/"
            element={
              <SiteLayout>
                <Home />
              </SiteLayout>
            }
          />
          <Route
            path="/notes"
            element={
              <SiteLayout>
                <Notes />
              </SiteLayout>
            }
          />
          <Route
            path="/wallet"
            element={
              <SiteLayout>
                <WalletDemo />
              </SiteLayout>
            }
          />
        </Routes>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
