'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const TX_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  DEPOSIT: { icon: '📥', color: 'var(--neon-green)' },
  DEPOSIT_PENDING: { icon: '⏳', color: 'var(--neon-yellow)' },
  WITHDRAWAL: { icon: '📤', color: 'var(--neon-red)' },
  FREEZE: { icon: '🧊', color: 'var(--neon-blue)' },
  RELEASE: { icon: '🔓', color: 'var(--neon-yellow)' },
  PAYOUT: { icon: '🏆', color: 'var(--neon-green)' },
  COMMISSION: { icon: '💎', color: 'var(--neon-purple)' },
  REFUND: { icon: '↩️', color: 'var(--neon-cyan)' },
  ROOM_FEE: { icon: '🏠', color: 'var(--neon-red)' },
};

export default function WalletPage() {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositLoading, setDepositLoading] = useState(false);
  const { isLoggedIn, loading } = useAuth();
  const { showAlert } = useDialog();

  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Confirm Order dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    transactionId: string;
    amount: number;
  }>({ show: false, transactionId: '', amount: 0 });
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  useEffect(() => {
    if (!loading && !isLoggedIn) { window.location.href = '/login'; }
    if (isLoggedIn) {
      fetchWallet();
      fetchTransactions();
    }
  }, [isLoggedIn, loading]);

  async function fetchWallet() {
    const token = localStorage.getItem('gr_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/wallet`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setWallet(data.data);
    } catch (e) { console.error(e); }
  }

  async function fetchTransactions() {
    const token = localStorage.getItem('gr_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/wallet/transactions`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setTransactions(data.data);
    } catch (e) { console.error(e); }
  }

  // Step 1: Create a PENDING deposit — does NOT increase balance
  async function handleDeposit() {
    if (!depositAmount || Number(depositAmount) <= 0) return showAlert('Invalid amount');
    setDepositLoading(true);
    const token = localStorage.getItem('gr_token');
    try {
      const res = await fetch(`${API_URL}/api/wallet/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(depositAmount) })
      });
      const data = await res.json();
      if (data.success) {
        setDepositAmount('');
        fetchTransactions(); // Refresh to show the new PENDING record
      } else {
        showAlert(data.error);
      }
    } catch { showAlert('Network error'); }
    setDepositLoading(false);
  }

  // Step 2: Open the 6-digit confirmation dialog
  function openConfirmDialog(txId: string, amount: number) {
    setConfirmDialog({ show: true, transactionId: txId, amount });
    setConfirmCode('');
    setConfirmError('');
  }

  // Step 3: Submit the 6-digit code to confirm and credit the deposit
  async function handleConfirmDeposit() {
    if (confirmCode.length !== 6) {
      setConfirmError('Please enter a 6-digit code');
      return;
    }
    setConfirmLoading(true);
    setConfirmError('');
    const token = localStorage.getItem('gr_token');
    try {
      const res = await fetch(`${API_URL}/api/wallet/deposit/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          transaction_id: confirmDialog.transactionId,
          confirmation_code: confirmCode
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfirmDialog({ show: false, transactionId: '', amount: 0 });
        fetchWallet();
        fetchTransactions();
      } else {
        setConfirmError(data.error);
      }
    } catch {
      setConfirmError('Network error');
    }
    setConfirmLoading(false);
  }

  async function handleWithdraw() {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return showAlert('Invalid amount');
    const token = localStorage.getItem('gr_token');
    try {
      const res = await fetch(`${API_URL}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(withdrawAmount) })
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawAmount('');
        fetchWallet();
        fetchTransactions();
      } else showAlert(data.error);
    } catch { showAlert('Network error'); }
  }

  if (!wallet) return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading wallet...
      </div>
      <Footer />
    </>
  );

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800 }}>
            💰 <span className="gradient-text">My Wallet</span>
          </h1>
          <a href="/history" className="btn-secondary" style={{ textDecoration: 'none' }}>
            📜 History
          </a>
        </div>

        {/* Balance Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div className="stat-card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Available Balance
            </div>
            <div className="font-display gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>
              {formatCurrency(Number(wallet.balance || 0))}
            </div>
          </div>

          <div className="stat-card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              🧊 Frozen
            </div>
            <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--neon-blue)' }}>
              {formatCurrency(Number(wallet.frozen_amount || 0))}
            </div>
          </div>

          <div className="stat-card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              🏆 Total Won
            </div>
            <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: 'var(--neon-green)' }}>
              {formatCurrency(Number(wallet.total_won || 0))}
            </div>
          </div>
        </div>

        {/* Deposit / Withdraw */}
        <div className="glass-card" style={{ padding: 28, marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button
              onClick={() => setActiveTab('deposit')}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'deposit' ? 'linear-gradient(135deg, var(--neon-green), #15803d)' : 'var(--bg-tertiary)',
                color: activeTab === 'deposit' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📥 Deposit
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === 'withdraw' ? 'linear-gradient(135deg, var(--neon-red), #b91c1c)' : 'var(--bg-tertiary)',
                color: activeTab === 'withdraw' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📤 Withdraw
            </button>
          </div>

          {activeTab === 'deposit' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Deposit Amount (MMK)
              </label>
              <input
                className="input-field"
                type="number"
                placeholder="Enter amount..."
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {[1000, 3000, 5000, 10000, 20000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDepositAmount(amt.toString())}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border-secondary)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>
              <button
                className="btn-success"
                onClick={handleDeposit}
                disabled={depositLoading || !depositAmount}
                style={{ width: '100%', justifyContent: 'center', padding: 14, opacity: depositLoading ? 0.6 : 1 }}
              >
                {depositLoading ? 'u23f3 Processing...' : '📥 Deposit via One Cent Pay'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                Powered by One Cent Pay API. You will need to confirm with a 6-digit code.
              </p>
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Withdraw Amount (MMK)
              </label>
              <input
                className="input-field"
                type="number"
                placeholder="Enter amount..."
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                style={{ marginBottom: 4 }}
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Available: {formatCurrency(Number(wallet.balance || 0))}
              </p>
              <button className="btn-danger" onClick={handleWithdraw} style={{ width: '100%', justifyContent: 'center', padding: 14 }}>
                📤 Withdraw to Bank
              </button>
            </div>
          )}
        </div>

        {/* Pending Orders — only DEPOSIT_PENDING */}
        {(() => {
          const pendingTxs = transactions.filter(tx => tx.type === 'DEPOSIT_PENDING');
          return (
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-secondary)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>⏳ Pending Orders</h3>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTxs.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        No pending orders
                      </td>
                    </tr>
                  )}
                  {pendingTxs.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(tx.created_at)}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--neon-yellow)', fontWeight: 600, fontSize: 13 }}>
                          ⏳ PENDING
                        </span>
                      </td>
                      <td>
                        <span className="font-display" style={{ fontWeight: 700, color: 'var(--neon-yellow)' }}>
                          {formatCurrency(Number(tx.amount || 0))}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => openConfirmDialog(tx.id, Number(tx.amount))}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          ✅ Confirm Order
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* ======================== CONFIRM ORDER DIALOG ======================== */}
      {confirmDialog.show && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setConfirmDialog({ show: false, transactionId: '', amount: 0 })}
        >
          <div
            className="glass-card animate-fade-in-up"
            style={{ maxWidth: 420, width: '100%', padding: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
              <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                <span className="gradient-text">Confirm Deposit</span>
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Enter the last 6 digits of your transaction ID to confirm
              </p>
            </div>

            {/* Amount display */}
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              textAlign: 'center',
              border: '1px solid var(--border-secondary)'
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Deposit Amount
              </div>
              <div className="font-display gradient-text" style={{ fontSize: 28, fontWeight: 800 }}>
                {formatCurrency(Number(confirmDialog.amount || 0))}
              </div>
            </div>

            {/* 6-digit code input */}
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              6-Digit Confirmation Code
            </label>
            <input
              className="input-field"
              type="text"
              maxLength={6}
              placeholder="e.g. 123456"
              value={confirmCode}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                setConfirmCode(val);
              }}
              style={{
                marginBottom: 8,
                textAlign: 'center',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 12,
                fontFamily: 'monospace',
              }}
              autoFocus
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
              Last 6 digits of your One Cent Pay transaction ID
            </p>

            {confirmError && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--neon-red)',
                textAlign: 'center'
              }}>
                {confirmError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setConfirmDialog({ show: false, transactionId: '', amount: 0 })}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ flex: 1, opacity: confirmCode.length !== 6 || confirmLoading ? 0.6 : 1 }}
                disabled={confirmCode.length !== 6 || confirmLoading}
                onClick={handleConfirmDeposit}
              >
                {confirmLoading ? 'u23f3 Verifying...' : '✅ Confirm Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
