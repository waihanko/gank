'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface MatchRecord {
  id: string;
  stake_amount: number;
  total_pot: number;
  status: string;
  winner_id: string | null;
  created_at: string;
  room?: { title: string } | null;
  challenger: { id: string; username: string; mlbb_ign: string } | null;
  opponent: { id: string; username: string; mlbb_ign: string } | null;
}

export default function BattleHistoryPage() {
  const router = useRouter();
  const { user, token, isLoggedIn, loading } = useAuth();
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'dispute' | 'won' | 'lost' | 'cancel'>('all');

  useEffect(() => {
    if (!loading && !isLoggedIn) { router.push('/login'); return; }
    if (!token || !user) return;

    fetch(`${API_URL}/api/matches/my-history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setMatches(data.data);
        }
        setLoadingData(false);
      })
      .catch(() => setLoadingData(false));
  }, [token, isLoggedIn, loading, user, router]);

  if (loading && !user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="font-display gradient-text" style={{ fontSize: 20 }}>Loading...</div>
    </div>
  );

  if (!user && !loading) return null;

  // Stats
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.winner_id === user.id).length;
  const losses = matches.filter(m => m.winner_id && m.winner_id !== user.id).length;
  const activeStatuses = ['PENDING_JOIN', 'ACTIVE', 'ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'];
  const activeCount = matches.filter(m => activeStatuses.includes(m.status)).length;
  const disputeCount = matches.filter(m => m.status === 'DISPUTED').length;
  const cancelCount = matches.filter(m => ['CANCELLED', 'VOIDED'].includes(m.status)).length;
  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0';
  const totalEarned = matches
    .filter(m => m.winner_id === user.id)
    .reduce((s, m) => s + Number(m.total_pot || m.stake_amount), 0);

  // Filter
  const filtered = matches.filter(m => {
    if (filter === 'won') return m.status === 'COMPLETED' && m.winner_id === user.id;
    if (filter === 'lost') return m.status === 'COMPLETED' && m.winner_id && m.winner_id !== user.id;
    if (filter === 'active') return activeStatuses.includes(m.status);
    if (filter === 'dispute') return m.status === 'DISPUTED';
    if (filter === 'cancel') return ['CANCELLED', 'VOIDED'].includes(m.status);
    return true;
  });

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>
            ⚔️ <span className="gradient-text">Battle History</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Your complete match record
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total</div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-primary)' }}>{totalMatches}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Wins</div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-green)' }}>{wins}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Losses</div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-red)' }}>{losses}</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Win Rate</div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-cyan)' }}>{winRate}%</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Earned</div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 800, color: 'var(--neon-green)' }}>{formatCurrency(totalEarned)}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {([
            { key: 'all' as const, label: '🎯 All', count: totalMatches },
            { key: 'active' as const, label: '🔥 Active', count: activeCount },
            { key: 'dispute' as const, label: '⚠️ Dispute', count: disputeCount },
            { key: 'won' as const, label: '🏆 Won', count: wins },
            { key: 'lost' as const, label: '💀 Lost', count: losses },
            { key: 'cancel' as const, label: '🚫 Cancel', count: cancelCount },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid',
                borderColor: filter === f.key ? 'var(--accent-primary)' : 'var(--border-secondary)',
                background: filter === f.key ? 'rgba(124,58,237,0.15)' : 'transparent',
                color: filter === f.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Match List */}
        {loadingData ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>⏳ Loading...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>No matches found</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {filter === 'all' ? 'Create or accept a challenge to get started!' : `No ${filter} matches`}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(m => {
              const isChallenger = m.challenger?.id === user.id;
              const opponent = isChallenger ? m.opponent : m.challenger;
              const won = m.winner_id === user.id;
              const lost = m.winner_id && m.winner_id !== user.id;
              const isCancel = ['CANCELLED', 'VOIDED'].includes(m.status);
              const isDispute = m.status === 'DISPUTED';
              const isActive = activeStatuses.includes(m.status);

              return (
                <div 
                  key={m.id} 
                  className="glass-card" 
                  onClick={() => router.push(`/battle-history/${m.id}`)}
                  style={{
                    padding: '18px 22px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderColor: won ? 'rgba(34,197,94,0.2)' : lost ? 'rgba(239,68,68,0.15)' : isActive ? 'rgba(124,58,237,0.2)' : isDispute ? 'rgba(234,179,8,0.3)' : undefined,
                    opacity: isCancel ? 0.6 : 1,
                    flexWrap: 'wrap',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = won ? 'rgba(34,197,94,0.2)' : lost ? 'rgba(239,68,68,0.15)' : isActive ? 'rgba(124,58,237,0.2)' : isDispute ? 'rgba(234,179,8,0.3)' : 'var(--glass-border)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: won ? 'rgba(34,197,94,0.15)' : lost ? 'rgba(239,68,68,0.15)' : isActive ? 'rgba(124,58,237,0.15)' : isDispute ? 'rgba(234,179,8,0.15)' : 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                      flexShrink: 0,
                    }}>
                      {won ? '🏆' : lost ? '💀' : isActive ? '🔥' : isDispute ? '⚠️' : isCancel ? '🚫' : '⚔️'}
                    </div>
                    {/* Info */}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                        vs {opponent?.username || 'Waiting...'}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>#{m.id.slice(0, 5)}...{m.id.slice(-3)}</span>
                        <span>{formatDate(m.created_at)}</span>
                        {m.room && <span>📍 {m.room.title}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="font-display" style={{
                      fontSize: 16, fontWeight: 800,
                      color: won ? 'var(--neon-green)' : lost ? 'var(--neon-red)' : 'var(--neon-yellow)',
                    }}>
                      {won ? '+' : lost ? '-' : ''}{formatCurrency(m.stake_amount)}
                    </div>
                    <StatusBadge status={m.status} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
