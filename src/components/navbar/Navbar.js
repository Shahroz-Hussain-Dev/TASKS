import { useState } from "react";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { Button, Spinner, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router-dom";
import logo from "../../images/logo/logo.png";
import { useWeb3 } from "../../contexts/Web3Context";
import "bootstrap/dist/css/bootstrap.min.css";
import "./navbar.css";

function NavBar() {
  const {
    account,
    chainId,
    isConnecting,
    error,
    isConnected,
    isMetaMaskInstalled,
    connectWallet,
    disconnectWallet,
    getNetworkName,
    formatAddress,
  } = useWeb3();

  const [showTooltip, setShowTooltip] = useState(false);

  const handleWalletClick = () => {
    if (isConnected) {
      // Show disconnect option or copy address
      setShowTooltip(!showTooltip);
    } else {
      connectWallet();
    }
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      alert("Address copied to clipboard!");
    }
  };

  const renderWalletButton = () => {
    if (!isMetaMaskInstalled) {
      return (
        <Button
          variant="warning"
          className="btn-primary d-none d-lg-inline-block"
          onClick={() => window.open('https://metamask.io/download/', '_blank')}
        >
          Install MetaMask
        </Button>
      );
    }

    if (isConnecting) {
      return (
        <Button
          variant="primary"
          className="btn-primary d-none d-lg-inline-block"
          disabled
        >
          <Spinner
            as="span"
            animation="border"
            size="sm"
            role="status"
            aria-hidden="true"
            className="me-2"
          />
          Connecting...
        </Button>
      );
    }

    if (isConnected) {
      return (
        <OverlayTrigger
          placement="bottom"
          overlay={
            <Tooltip id="wallet-tooltip">
              <div className="text-start">
                <div className="mb-2">
                  <strong>Network:</strong>
                  <br />
                  {getNetworkName(chainId)}
                </div>
                <div className="mb-2">
                  <strong>Address:</strong>
                  <br />
                  {account}
                </div>
                <div className="d-flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline-light"
                    onClick={copyAddress}
                  >
                    Copy Address
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={disconnectWallet}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </Tooltip>
          }
        >
          <Button
            variant="success"
            className="btn-primary d-none d-lg-inline-block"
            onClick={handleWalletClick}
          >
            <span className="me-2">🟢</span>
            {formatAddress(account)}
          </Button>
        </OverlayTrigger>
      );
    }

    return (
      <Button
        variant="primary"
        className="btn-primary d-none d-lg-inline-block"
        onClick={connectWallet}
      >
        Connect Wallet
      </Button>
    );
  };

  return (
    <>
      <Navbar expand="lg" className="py-3">
        <Container>
          <Navbar.Brand as={Link} to="/" className="me-lg-5">
            <img className="logo" src={logo} alt="logo" />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="navbarScroll" />
          <Navbar.Collapse id="navbarScroll">
            <Nav className="me-auto my-2 my-lg-0" navbarScroll>
              <Nav.Link href="#action1">Marketplace</Nav.Link>
              <Nav.Link href="#action2" className="px-lg-3">
                About Us
              </Nav.Link>
              <Nav.Link href="#action3">Developers</Nav.Link>
              <Nav.Link as={Link} to="/notes">
                My Notes
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
          <div className="d-flex align-items-center order">
            <span className="line d-lg-inline-block d-none"></span>
            <i className="fa-regular fa-heart"></i>
            {renderWalletButton()}
          </div>
        </Container>
      </Navbar>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show m-3" role="alert">
          <strong>Error:</strong> {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => {}}
            aria-label="Close"
          ></button>
        </div>
      )}
    </>
  );
}

export default NavBar;