'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
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

type TxFilter = 'all' | 'deposit' | 'withdraw';

export default function MobileTransactionsPage() {
  const router = useRouter();
  const { isLoggedIn, token, user, loading } = useAuth();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [wallet, setWallet]             = useState<any>(null);
  const [filter, setFilter]             = useState<TxFilter>('all');
  const [fetching, setFetching]         = useState(true);

  useEffect(() => {
    if (!loading && !isLoggedIn) { window.location.href = '/login'; return; }
    if (isLoggedIn && token) { fetchAll(); }
  }, [isLoggedIn, loading, token]);

  async function fetchAll() {
    setFetching(true);
    const headers = { Authorization: `Bearer ${token}` };
    const [txRes, walletRes] = await Promise.all([
      fetch(`${API_URL}/api/wallet/transactions`, { headers }).then(r => r.json()).catch(() => ({ success: false })),
      fetch(`${API_URL}/api/wallet`, { headers }).then(r => r.json()).catch(() => ({ success: false })),
    ]);
    if (txRes.success) setTransactions(txRes.data);
    if (walletRes.success) setWallet(walletRes.data);
    setFetching(false);
  }

  const filtered = transactions.filter(tx => {
    if (filter === 'deposit')  return ['DEPOSIT', 'DEPOSIT_PENDING', 'PAYOUT', 'REFUND', 'RELEASE'].includes(tx.type);
    if (filter === 'withdraw') return ['WITHDRAWAL', 'FREEZE', 'COMMISSION', 'ROOM_FEE'].includes(tx.type);
    return true;
  });

  const balance = wallet ? Number(wallet.balance || 0) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── Inner toolbar: back + title + wallet balance ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(10,10,15,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(124,58,237,0.18)',
        padding: '0 16px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Back button + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, cursor: 'pointer', color: 'var(--text-primary)',
            }}
          >
            ‹
          </button>
          <div>
            <div className="font-display" style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.3 }}>
              Transaction History
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Deposits &amp; withdrawals</div>
          </div>
        </div>

        {/* Wallet balance chip */}
        {balance !== null && (
          <div style={{
            padding: '5px 12px',
            background: 'rgba(234,179,8,0.1)',
            border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: 20,
            fontSize: 12, fontWeight: 700, color: '#f59e0b',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            💰 {balance.toLocaleString()}
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>MMK</span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '16px 16px 32px', flex: 1 }}>

        {/* Filter tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {([
            { key: 'all',      label: '📋 All' },
            { key: 'deposit',  label: '📥 In' },
            { key: 'withdraw', label: '📤 Out' },
          ] as { key: TxFilter; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 12,
                background: filter === f.key ? 'linear-gradient(135deg, var(--accent-primary), #6d28d9)' : 'var(--bg-tertiary)',
                color: filter === f.key ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Summary row */}
        {wallet && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total Deposited', value: wallet.total_deposited ?? '—', color: 'var(--neon-green)' },
              { label: 'Total Withdrawn', value: wallet.total_withdrawn ?? '—', color: 'var(--neon-red)' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                borderRadius: 14, padding: '12px 14px',
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: s.color }}>
                  {typeof s.value === 'number' ? formatCurrency(s.value) : s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transaction list */}
        {fetching ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 68, background: 'var(--glass-bg)', borderRadius: 14, border: '1px solid var(--glass-border)', animation: 'pulse 2s infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>No transactions found</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(tx => {
              const cfg = TX_ICONS[tx.type] ?? { icon: '💱', color: 'var(--text-secondary)', label: tx.type };
              const isDebit = ['WITHDRAWAL', 'FREEZE', 'COMMISSION', 'ROOM_FEE'].includes(tx.type);
              return (
                <div key={tx.id} style={{
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  borderRadius: 14, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: isDebit ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)',
                    border: `1px solid ${isDebit ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {cfg.icon}
                  </div>

                  {/* Label + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{cfg.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(tx.created_at)}</div>
                  </div>

                  {/* Amount */}
                  <div className="font-display" style={{
                    fontSize: 14, fontWeight: 800, flexShrink: 0,
                    color: isDebit ? 'var(--neon-red)' : cfg.color,
                  }}>
                    {isDebit ? '−' : '+'}{formatCurrency(Math.abs(Number(tx.amount)))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
