'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { formatCurrency, formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface TransactionRecord {
  id: string;
  type: string;
  amount: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

export default function HistoryPage() {
  const { user, token, isLoggedIn, loading } = useAuth();
  const [tab, setTab] = useState<'deposits' | 'withdrawals'>('deposits');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !isLoggedIn) { window.location.href = '/login'; return; }
    if (!token) return;

    fetch(`${API_URL}/api/wallet/transactions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.success) setTransactions(data.data);
        setLoadingData(false);
      })
      .catch(() => setLoadingData(false));
  }, [token, isLoggedIn, loading]);

  const deposits = transactions.filter(tx => tx.type === 'DEPOSIT' || tx.type === 'DEPOSIT_PENDING');
  const withdrawals = transactions.filter(tx => tx.type === 'WITHDRAWAL');
  const activeList = tab === 'deposits' ? deposits : withdrawals;

  // Stats
  const totalDeposited = deposits.filter(d => d.type === 'DEPOSIT').reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdrawn = withdrawals.reduce((s, t) => s + Number(t.amount), 0);

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="font-display gradient-text" style={{ fontSize: 20 }}>Loading...</div>
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            📜 <span className="gradient-text">Transaction History</span>
          </h1>
          <a href="/wallet" className="btn-secondary" style={{ textDecoration: 'none' }}>
            💰 Back to Wallet
          </a>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Deposited</div>
            <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--neon-green)' }}>{formatCurrency(totalDeposited)}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Withdrawn</div>
            <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--neon-red)' }}>{formatCurrency(totalWithdrawn)}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Net</div>
            <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: totalDeposited - totalWithdrawn >= 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
              {formatCurrency(totalDeposited - totalWithdrawn)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setTab('deposits')}
            style={{
              padding: '10px 24px', borderRadius: 10, border: '1px solid',
              borderColor: tab === 'deposits' ? 'var(--neon-green)' : 'var(--border-secondary)',
              background: tab === 'deposits' ? 'rgba(34,197,94,0.15)' : 'transparent',
              color: tab === 'deposits' ? 'var(--neon-green)' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            📥 Deposits ({deposits.length})
          </button>
          <button
            onClick={() => setTab('withdrawals')}
            style={{
              padding: '10px 24px', borderRadius: 10, border: '1px solid',
              borderColor: tab === 'withdrawals' ? 'var(--neon-red)' : 'var(--border-secondary)',
              background: tab === 'withdrawals' ? 'rgba(239,68,68,0.15)' : 'transparent',
              color: tab === 'withdrawals' ? 'var(--neon-red)' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            📤 Withdrawals ({withdrawals.length})
          </button>
        </div>

        {/* Content */}
        {loadingData ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>⏳ Loading...</div>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeList.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>{tab === 'deposits' ? '📥' : '📤'}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No {tab} yet</div>
                      <div style={{ fontSize: 12 }}>{tab === 'deposits' ? 'Make a deposit to see it here' : 'Make a withdrawal to see it here'}</div>
                    </td>
                  </tr>
                )}
                {activeList.map(tx => {
                  const isPending = tx.type === 'DEPOSIT_PENDING';
                  const isDeposit = tx.type === 'DEPOSIT';
                  const color = isPending ? 'var(--neon-yellow)' : isDeposit ? 'var(--neon-green)' : 'var(--neon-red)';
                  return (
                    <tr key={tx.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(tx.created_at)}</td>
                      <td>
                        <span className="font-display" style={{ fontWeight: 700, color, fontSize: 14 }}>
                          {isDeposit ? '+' : isPending ? '' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, maxWidth: 250 }}>{tx.description}</td>
                      <td>
                        {isPending ? (
                          <span style={{
                            background: 'rgba(234,179,8,0.15)',
                            color: 'var(--neon-yellow)',
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                          }}>⏳ PENDING</span>
                        ) : (
                          <span style={{
                            background: isDeposit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: isDeposit ? 'var(--neon-green)' : 'var(--neon-red)',
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                          }}>✅ COMPLETED</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
