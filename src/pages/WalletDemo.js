import React from 'react';
import { Container, Row, Col, Card, Alert } from 'react-bootstrap';
import WalletStatus from '../components/walletstatus';
import { useWeb3 } from '../contexts/Web3Context';

function WalletDemo() {
  const { isConnected, account, chainId, getNetworkName } = useWeb3();

  return (
    <div className="wallet-demo-page" style={{ minHeight: '100vh', paddingTop: '2rem', paddingBottom: '2rem', background: '#f8f9fa' }}>
      <Container>
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="display-4 fw-bold mb-3">
            <i className="fas fa-wallet me-3" style={{ color: '#667eea' }}></i>
            MetaMask Wallet Integration
          </h1>
          <p className="lead text-muted">
            Connect your Ethereum wallet and manage your crypto assets
          </p>
        </div>

        <Row>
          {/* Left Column - Wallet Status */}
          <Col lg={6} className="mb-4">
            <WalletStatus />
          </Col>

          {/* Right Column - Information */}
          <Col lg={6} className="mb-4">
            {/* Features Card */}
            <Card className="shadow mb-4">
              <Card.Body>
                <h5 className="mb-3">
                  <i className="fas fa-check-circle text-success me-2"></i>
                  Features Implemented
                </h5>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Wallet Connection:</strong> Connect to MetaMask with one click
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Display Address:</strong> View your full wallet address
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Account Changes:</strong> Auto-detects when you switch accounts
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Network Changes:</strong> Updates when you switch networks
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Balance Display:</strong> Shows your ETH balance
                  </li>
                  <li className="mb-2">
                    <i className="fas fa-check text-success me-2"></i>
                    <strong>Copy Address:</strong> Easy copy to clipboard
                  </li>
                </ul>
              </Card.Body>
            </Card>

            {/* Connection Status Card */}
            {isConnected && (
              <Card className="shadow mb-4" style={{ borderLeft: '4px solid #28a745' }}>
                <Card.Body>
                  <h6 className="text-success mb-3">
                    <i className="fas fa-plug me-2"></i>
                    Connection Details
                  </h6>
                  <div className="mb-2">
                    <small className="text-muted">Account:</small>
                    <div className="font-monospace small text-break">
                      {account}
                    </div>
                  </div>
                  <div>
                    <small className="text-muted">Network:</small>
                    <div className="fw-bold">
                      {getNetworkName(chainId)} ({chainId})
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Instructions Card */}
            <Card className="shadow">
              <Card.Body>
                <h5 className="mb-3">
                  <i className="fas fa-info-circle text-primary me-2"></i>
                  How to Use
                </h5>
                <ol className="mb-0">
                  <li className="mb-2">
                    Make sure MetaMask is installed in your browser
                  </li>
                  <li className="mb-2">
                    Click "Connect Wallet" button in the navbar or the wallet status card
                  </li>
                  <li className="mb-2">
                    Approve the connection request in MetaMask
                  </li>
                  <li className="mb-2">
                    Your wallet address and balance will be displayed
                  </li>
                  <li className="mb-2">
                    Try switching accounts or networks in MetaMask to see automatic updates
                  </li>
                </ol>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Technical Information */}
        <Row className="mt-4">
          <Col>
            <Card className="shadow">
              <Card.Body>
                <h5 className="mb-3">
                  <i className="fas fa-code text-info me-2"></i>
                  Technical Details
                </h5>
                <Row>
                  <Col md={4} className="mb-3">
                    <h6 className="text-muted small">EVENT LISTENERS</h6>
                    <ul className="list-unstyled small">
                      <li>✓ accountsChanged</li>
                      <li>✓ chainChanged</li>
                      <li>✓ connect</li>
                      <li>✓ disconnect</li>
                    </ul>
                  </Col>
                  <Col md={4} className="mb-3">
                    <h6 className="text-muted small">RPC METHODS</h6>
                    <ul className="list-unstyled small">
                      <li>✓ eth_requestAccounts</li>
                      <li>✓ eth_accounts</li>
                      <li>✓ eth_chainId</li>
                      <li>✓ eth_getBalance</li>
                    </ul>
                  </Col>
                  <Col md={4} className="mb-3">
                    <h6 className="text-muted small">SUPPORTED NETWORKS</h6>
                    <ul className="list-unstyled small">
                      <li>✓ Ethereum Mainnet</li>
                      <li>✓ Goerli Testnet</li>
                      <li>✓ Sepolia Testnet</li>
                      <li>✓ Polygon, BSC, etc.</li>
                    </ul>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Alert for MetaMask */}
        <Alert variant="info" className="mt-4">
          <Alert.Heading>
            <i className="fas fa-lightbulb me-2"></i>
            Pro Tip
          </Alert.Heading>
          <p className="mb-0">
            This integration uses the Ethereum Provider API (window.ethereum) to communicate with MetaMask. 
            All transactions require user approval through MetaMask's interface for security.
          </p>
        </Alert>
      </Container>
    </div>
  );
}

export default WalletDemo;