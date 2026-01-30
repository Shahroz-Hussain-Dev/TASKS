import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Row, Col } from 'react-bootstrap';
import { useWeb3 } from '../contexts/Web3Context';
import './WalletStatus.css';

function WalletStatus() {
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
  } = useWeb3();

  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Fetch wallet balance
  const fetchBalance = async () => {
    if (!account || !window.ethereum) return;

    setLoadingBalance(true);
    try {
      const balanceHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [account, 'latest'],
      });
      
      // Convert from Wei to ETH
      const balanceInEth = parseInt(balanceHex, 16) / Math.pow(10, 18);
      setBalance(balanceInEth.toFixed(4));
    } catch (err) {
      console.error('Error fetching balance:', err);
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchBalance();
    } else {
      setBalance(null);
    }
  }, [account, chainId]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (!isMetaMaskInstalled) {
    return (
      <Card className="wallet-status-card shadow">
        <Card.Body className="text-center">
          <div className="mb-3">
            <i className="fas fa-exclamation-triangle fa-3x text-warning"></i>
          </div>
          <h5>MetaMask Not Detected</h5>
          <p className="text-muted">
            Please install MetaMask to connect your wallet.
          </p>
          <Button
            variant="primary"
            onClick={() => window.open('https://metamask.io/download/', '_blank')}
          >
            Install MetaMask
          </Button>
        </Card.Body>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card className="wallet-status-card shadow">
        <Card.Body className="text-center">
          <div className="mb-3">
            <i className="fas fa-wallet fa-3x text-primary"></i>
          </div>
          <h5>Wallet Not Connected</h5>
          <p className="text-muted">
            Connect your MetaMask wallet to get started.
          </p>
          <Button
            variant="primary"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </Button>
          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="wallet-status-card shadow">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">
            <i className="fas fa-wallet me-2"></i>
            Wallet Connected
          </h5>
          <Badge bg="success">
            <i className="fas fa-circle me-1" style={{ fontSize: '8px' }}></i>
            Connected
          </Badge>
        </div>

        <Row className="g-3">
          {/* Network */}
          <Col xs={12}>
            <div className="info-box">
              <label className="text-muted small">Network</label>
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-bold">{getNetworkName(chainId)}</span>
                <Badge bg="info">{chainId}</Badge>
              </div>
            </div>
          </Col>

          {/* Address */}
          <Col xs={12}>
            <div className="info-box">
              <label className="text-muted small">Wallet Address</label>
              <div className="d-flex align-items-center justify-content-between">
                <code className="text-truncate flex-grow-1 me-2">
                  {account}
                </code>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => copyToClipboard(account)}
                >
                  <i className="fas fa-copy"></i>
                </Button>
              </div>
            </div>
          </Col>

          {/* Balance */}
          <Col xs={12}>
            <div className="info-box">
              <label className="text-muted small">Balance</label>
              <div className="d-flex align-items-center justify-content-between">
                {loadingBalance ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <span className="fw-bold fs-5">
                    {balance !== null ? `${balance} ETH` : 'N/A'}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={fetchBalance}
                  disabled={loadingBalance}
                >
                  <i className="fas fa-sync-alt"></i>
                </Button>
              </div>
            </div>
          </Col>

          {/* Actions */}
          <Col xs={12}>
            <div className="d-grid gap-2">
              <Button
                variant="outline-danger"
                onClick={disconnectWallet}
              >
                <i className="fas fa-sign-out-alt me-2"></i>
                Disconnect Wallet
              </Button>
            </div>
          </Col>
        </Row>

        {/* Additional Info */}
        <div className="mt-3 p-2 bg-light rounded">
          <small className="text-muted">
            <i className="fas fa-info-circle me-1"></i>
            Your wallet is securely connected. Switch accounts or networks in MetaMask to update automatically.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
}

export default WalletStatus;