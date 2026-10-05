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

function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <NavBar />

        <Routes>
          {/* Home route - displays all sections together like before */}
          <Route path="/" element={<Home />} />
          
          {/* Notes route - notes management page */}
          <Route path="/notes" element={<Notes />} />
          
          {/* Wallet route - wallet integration demo page */}
          <Route path="/wallet" element={<WalletDemo />} />
        </Routes>

        <Footer />
        <ScrollUpButton />
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;