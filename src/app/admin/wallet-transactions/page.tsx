'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const WALLET_TX_CONFIG: Record<string, { icon: string; color: string }> = {
  DEPOSIT: { icon: '📥', color: '#22c55e' },
  WITHDRAWAL: { icon: '📤', color: '#ef4444' },
  REFUND: { icon: '↩️', color: '#06b6d4' },
  DEPOSIT_PENDING: { icon: '⏳', color: '#eab308' },
};

export default function AdminWalletTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const types = ['All', 'DEPOSIT', 'WITHDRAWAL', 'REFUND'];

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    setLoading(true);
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/transactions`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        // Filter only wallet-related transactions
        const walletTxs = data.data.filter((tx: any) => 
          ['DEPOSIT', 'WITHDRAWAL', 'REFUND'].includes(tx.type)
        );
        setTransactions(walletTxs);
      }
    } catch (error) {
      console.error('Failed to fetch wallet transactions:', error);
    }
    setLoading(false);
  }

  const filtered = typeFilter === 'All'
    ? transactions
    : transactions.filter((t) => t.type === typeFilter);

  // Calculate totals
  const totalDeposits = transactions.filter((t) => t.type === 'DEPOSIT').reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdrawals = transactions.filter((t) => t.type === 'WITHDRAWAL').reduce((s, t) => s + Number(t.amount), 0);
  const totalRefunds = transactions.filter((t) => t.type === 'REFUND').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="page-container">
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          💳 <span className="gradient-text">Wallet Transactions</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Deposit, withdrawal, and refund transactions
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Deposits</div>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--neon-green)' }}>{formatCurrency(totalDeposits)}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Withdrawals</div>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--neon-red)' }}>{formatCurrency(totalWithdrawals)}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Refunds</div>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--neon-cyan)' }}>{formatCurrency(totalRefunds)}</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: typeFilter === t ? 'var(--accent-primary)' : 'var(--border-secondary)',
              background: typeFilter === t ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: typeFilter === t ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading wallet transactions...</div>
      ) : (
        <div className="glass-card" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Order Id</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => {
                const config = WALLET_TX_CONFIG[tx.type] || { icon: '📄', color: '#6b7280' };
                return (
                  <tr key={tx.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(tx.created_at)}</td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{tx.user?.username || tx.user_id}</td>
                    <td>
                      <span style={{ color: config.color, fontWeight: 600, fontSize: 12 }}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="font-display" style={{ fontWeight: 700, color: config.color, fontSize: 14 }}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 200 }}>{tx.description}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                      {tx.reference_id || '---'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
