'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import { formatCurrency, formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const TX_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  DEPOSIT:         { icon: '📥', color: 'var(--neon-green)',  label: 'Deposit' },
  DEPOSIT_PENDING: { icon: '⏳', color: '#f59e0b',           label: 'Pending Deposit' },
  WITHDRAWAL:      { icon: '📤', color: 'var(--neon-red)',    label: 'Withdrawal' },
  FREEZE:          { icon: '🧊', color: 'var(--neon-blue)',   label: 'Frozen (Match)' },
  RELEASE:         { icon: '🔓', color: '#f59e0b',           label: 'Released' },
  PAYOUT:          { icon: '🏆', color: 'var(--neon-green)',  label: 'Payout Won' },
  COMMISSION:      { icon: '💎', color: 'var(--neon-purple)', label: 'Commission' },
  REFUND:          { icon: '↩️', color: 'var(--neon-cyan)',  label: 'Refund' },
  ROOM_FEE:        { icon: '🏠', color: 'var(--neon-red)',    label: 'Room Fee' },
};

export default function MobileWalletPage() {
  const { isLoggedIn, user, token, loading } = useAuth();
  const { showAlert } = useDialog();

  const [wallet, setWallet]               = useState<any>(null);
  const [transactions, setTransactions]   = useState<any[]>([]);
  const [tab, setTab]                     = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmt, setDepositAmt]       = useState('');
  const [withdrawAmt, setWithdrawAmt]     = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; txId: string; amount: number }>({ show: false, txId: '', amount: 0 });
  const [confirmCode, setConfirmCode]     = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError]   = useState('');

  useEffect(() => {
    if (!loading && !isLoggedIn) { window.location.href = '/login'; return; }
    if (isLoggedIn) { fetchWallet(); fetchTransactions(); }
  }, [isLoggedIn, loading]);

  async function fetchWallet() {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/wallet`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    if (d.success) setWallet(d.data);
  }

  async function fetchTransactions() {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/wallet/transactions`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    if (d.success) setTransactions(d.data);
  }

  async function handleDeposit() {
    if (!depositAmt || Number(depositAmt) <= 0) return showAlert('Enter a valid amount');
    setDepositLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/wallet/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(depositAmt) }),
      });
      const d = await res.json();
      if (d.success) { setDepositAmt(''); fetchTransactions(); }
      else showAlert(d.error);
    } catch { showAlert('Network error'); }
    setDepositLoading(false);
  }

  async function handleWithdraw() {
    if (!withdrawAmt || Number(withdrawAmt) <= 0) return showAlert('Enter a valid amount');
    try {
      const res = await fetch(`${API_URL}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(withdrawAmt) }),
      });
      const d = await res.json();
      if (d.success) { setWithdrawAmt(''); fetchWallet(); fetchTransactions(); }
      else showAlert(d.error);
    } catch { showAlert('Network error'); }
  }

  async function handleConfirmDeposit() {
    if (confirmCode.length !== 6) { setConfirmError('Enter the 6-digit code'); return; }
    setConfirmLoading(true); setConfirmError('');
    try {
      const res = await fetch(`${API_URL}/api/wallet/deposit/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transaction_id: confirmDialog.txId, confirmation_code: confirmCode }),
      });
      const d = await res.json();
      if (d.success) { setConfirmDialog({ show: false, txId: '', amount: 0 }); fetchWallet(); fetchTransactions(); }
      else setConfirmError(d.error);
    } catch { setConfirmError('Network error'); }
    setConfirmLoading(false);
  }

  if (!wallet) return (
    <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
      Loading wallet...
    </div>
  );

  const pendingTxs = transactions.filter(tx => tx.type === 'DEPOSIT_PENDING');
  const presets    = [1000, 3000, 5000, 10000, 20000];

  return (
    <div style={{ padding: '0 16px 24px' }}>

      {/* Balance hero card */}
      <div style={{
        margin: '16px 0 20px',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))',
        border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 20, padding: '24px 20px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.15), transparent)' }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Available Balance</div>
        <div className="font-display gradient-text" style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
          {formatCurrency(wallet.balance)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: '🧊 Frozen', value: wallet.frozen_amount, color: 'var(--neon-blue)' },
            { label: '🏆 Total Won', value: wallet.total_won, color: 'var(--neon-green)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{s.label}</div>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: s.color }}>
                {formatCurrency(s.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {(['deposit', 'withdraw'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13,
            background: tab === t
              ? (t === 'deposit' ? 'linear-gradient(135deg, #22c55e, #15803d)' : 'linear-gradient(135deg, #ef4444, #b91c1c)')
              : 'var(--bg-tertiary)',
            color: tab === t ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}>
            {t === 'deposit' ? '📥 Deposit' : '📤 Withdraw'}
          </button>
        ))}
      </div>

      {/* Deposit */}
      {tab === 'deposit' && (
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>Amount (MMK)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 }}>
            {presets.map(p => (
              <button key={p} onClick={() => setDepositAmt(String(p))} style={{
                padding: '8px 4px', borderRadius: 8, border: `1px solid ${depositAmt === String(p) ? 'var(--accent-primary)' : 'var(--border-secondary)'}`,
                background: depositAmt === String(p) ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)',
                color: depositAmt === String(p) ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>
                {p >= 1000 ? `${p / 1000}K` : p}
              </button>
            ))}
          </div>
          <input
            className="input-field" type="number" placeholder="Custom amount..."
            value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <button
            onClick={handleDeposit}
            disabled={depositLoading || !depositAmt}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: depositLoading || !depositAmt ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #22c55e, #15803d)',
              color: depositLoading || !depositAmt ? 'var(--text-muted)' : 'white',
              fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
            }}
          >
            {depositLoading ? '⏳ Processing...' : '📥 Deposit via One Cent Pay'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Confirm with the 6-digit code after payment
          </p>
        </div>
      )}

      {/* Withdraw */}
      {tab === 'withdraw' && (
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Amount (MMK)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Available: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{formatCurrency(wallet.balance)}</span></div>
          </div>
          <input
            className="input-field" type="number" placeholder="Withdraw amount..."
            value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <button
            onClick={handleWithdraw}
            disabled={!withdrawAmt || Number(withdrawAmt) > wallet.balance}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: !withdrawAmt || Number(withdrawAmt) > wallet.balance ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: !withdrawAmt || Number(withdrawAmt) > wallet.balance ? 'var(--text-muted)' : 'white',
              fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
            }}
          >
            📤 Withdraw to Bank
          </button>
        </div>
      )}

      {/* Pending orders */}
      {pendingTxs.length > 0 && (
        <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>⏳ Pending Orders ({pendingTxs.length})</div>
          {pendingTxs.map(tx => (
            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(tx.amount)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{formatDate(tx.created_at)}</div>
              </div>
              <button
                onClick={() => { setConfirmDialog({ show: true, txId: tx.id, amount: Number(tx.amount) }); setConfirmCode(''); setConfirmError(''); }}
                style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                  color: 'white', fontSize: 12, fontWeight: 700,
                }}
              >
                ✅ Confirm
              </button>
            </div>
          ))}
        </div>
      )}



      {/* Confirm deposit modal */}
      {confirmDialog.show && (
        <>
          <div onClick={() => setConfirmDialog({ show: false, txId: '', amount: 0 })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)',
            borderRadius: '24px 24px 0 0', padding: '24px 20px 48px',
            animation: 'slideUp 0.28s ease',
          }}>
            <div style={{ width: 36, height: 4, background: 'var(--border-secondary)', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>🔐</div>
              <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>
                <span className="gradient-text">Confirm Deposit</span>
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Enter last 6 digits of your transaction ID
              </p>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: '12px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>DEPOSIT AMOUNT</div>
              <div className="font-display gradient-text" style={{ fontSize: 24, fontWeight: 800 }}>{formatCurrency(confirmDialog.amount)}</div>
            </div>
            <input
              className="input-field" type="text" maxLength={6} placeholder="6-digit code"
              value={confirmCode}
              onChange={e => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: 10, fontFamily: 'monospace', marginBottom: 8 }}
              autoFocus
            />
            {confirmError && <div style={{ fontSize: 12, color: 'var(--neon-red)', textAlign: 'center', marginBottom: 8 }}>{confirmError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setConfirmDialog({ show: false, txId: '', amount: 0 })} style={{
                flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--border-secondary)',
                background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button
                onClick={handleConfirmDeposit}
                disabled={confirmCode.length !== 6 || confirmLoading}
                style={{
                  flex: 2, padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: confirmCode.length !== 6 || confirmLoading ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                  color: confirmCode.length !== 6 || confirmLoading ? 'var(--text-muted)' : 'white',
                  fontWeight: 700, fontSize: 14,
                }}
              >
                {confirmLoading ? '⏳ Verifying...' : '✅ Confirm Deposit'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
