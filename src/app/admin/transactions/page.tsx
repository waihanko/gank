'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const TX_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  FREEZE: { icon: '', color: '#3b82f6' },
  RELEASE: { icon: '', color: '#eab308' },
  PAYOUT: { icon: '', color: '#22c55e' },
  COMMISSION: { icon: '', color: '#a855f7' },
  REFUND: { icon: '', color: '#06b6d4' },
  ROOM_FEE: { icon: '', color: '#ef4444' },
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const types = ['All', 'FREEZE', 'RELEASE', 'PAYOUT', 'COMMISSION', 'REFUND', 'ROOM_FEE'];

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
        // Filter out DEPOSIT and WITHDRAWAL transactions
        const filteredTxs = data.data.filter((tx: any) => 
          !['DEPOSIT', 'WITHDRAWAL'].includes(tx.type)
        );
        setTransactions(filteredTxs);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
    setLoading(false);
  }

  const filtered = typeFilter === 'All'
    ? transactions
    : transactions.filter((t) => t.type === typeFilter);

  // Calculate totals
  const totalPayouts = transactions.filter((t) => t.type === 'PAYOUT').reduce((s, t) => s + Number(t.amount), 0);
  const totalFrozen = transactions.filter((t) => t.type === 'FREEZE').reduce((s, t) => s + Number(t.amount), 0);
  const totalCommissions = transactions.filter((t) => t.type === 'COMMISSION').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="page-container">
      <div style={{ marginBottom: 32 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
          💸 <span className="gradient-text">Transactions</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          All financial transactions across the platform
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Payouts</div>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--neon-yellow)' }}>{formatCurrency(totalPayouts)}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Currently Frozen</div>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--neon-blue)' }}>{formatCurrency(totalFrozen)}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total Commissions</div>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--neon-purple)' }}>{formatCurrency(totalCommissions)}</div>
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
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading transactions...</div>
      ) : (
        <div className="glass-card" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Match</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => {
                const config = TX_TYPE_CONFIG[tx.type] || { icon: '📄', color: '#6b7280' };
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
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: tx.match_id ? 'var(--neon-yellow)' : 'var(--text-muted)' }}>
                      {tx.match_id || '---'}
                    </td>
                    <td style={{ fontSize: 13, maxWidth: 200 }}>{tx.description}</td>
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
