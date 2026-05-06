'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
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
  challenger: { id: string; username: string; mlbb_ign: string; avatar_url?: string } | null;
  opponent: { id: string; username: string; mlbb_ign: string; avatar_url?: string } | null;
}

function Avatar({ user, size = 40 }: { user: any; size?: number }) {
  const [err, setErr] = useState(false);
  if (!user) return <span style={{ fontSize: size * 0.4 }}>?</span>;
  if (user.avatar_url && !err) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        onError={() => setErr(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: size * 0.3 }}
      />
    );
  }
  const name = user.telegram_display_name || user.telegram_username || user.username || 'U';
  return <span style={{ fontSize: size * 0.38, fontWeight: 700 }}>{name.replace('@', '').charAt(0).toUpperCase()}</span>;
}

function AvatarBox({ user, size = 40, gradient = 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))' }: { user: any; size?: number; gradient?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: user?.avatar_url ? undefined : gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
    }}>
      <Avatar user={user} size={size} />
    </div>
  );
}

export default function MobileBattleHistoryPage() {
  const router = useRouter();
  const { user, token, isLoggedIn, loading } = useAuth();
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'won' | 'lost' | 'dispute'>('all');

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
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="font-display gradient-text" style={{ fontSize: 16 }}>Loading...</div>
    </div>
  );

  if (!user && !loading) return null;

  const activeStatuses = ['PENDING_JOIN', 'ACTIVE', 'ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'];

  // Filter
  const filtered = matches.filter(m => {
    if (filter === 'won') return m.status === 'COMPLETED' && m.winner_id === user!.id;
    if (filter === 'lost') return m.status === 'COMPLETED' && m.winner_id && m.winner_id !== user!.id;
    if (filter === 'active') return activeStatuses.includes(m.status);
    if (filter === 'dispute') return m.status === 'DISPUTED';
    return true;
  });

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg-primary)' }}>


      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, margin: '0 -16px 16px', padding: '0 16px', scrollbarWidth: 'none' }}>
        {[
          { key: 'all' as const, label: '🎯 All' },
          { key: 'active' as const, label: '🔥 Active' },
          { key: 'won' as const, label: '🏆 Won' },
          { key: 'lost' as const, label: '💀 Lost' },
          { key: 'dispute' as const, label: '⚠️ Disputed' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '8px 14px', borderRadius: 12, border: '1px solid', flexShrink: 0,
              borderColor: filter === f.key ? 'var(--accent-primary)' : 'var(--border-secondary)',
              background: filter === f.key ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)',
              color: filter === f.key ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Match List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {loadingData ? (
          [1, 2, 3].map(i => (
            <div key={i} style={{ height: 88, background: 'var(--glass-bg)', borderRadius: 14, border: '1px solid var(--glass-border)', animation: 'pulse 2s infinite' }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏜️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No matches found</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filter === 'all' ? "You haven't played any matches yet!" : `No ${filter} matches found`}</div>
          </div>
        ) : (
          filtered.map(m => {
            const isChallenger = m.challenger?.id === user!.id;
            const opponent = isChallenger ? m.opponent : m.challenger;
            const won = m.winner_id === user!.id;
            const lost = m.winner_id && m.winner_id !== user!.id;
            const isActive = activeStatuses.includes(m.status);
            const isDispute = m.status === 'DISPUTED';

            return (
              <div
                key={m.id}
                onClick={() => router.push(`/m/battle/${m.id}`)}
                style={{
                  background: won ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(255,255,255,0.02))' : lost ? 'linear-gradient(135deg, rgba(239,68,68,0.05), rgba(255,255,255,0.02))' : 'var(--glass-bg)',
                  border: won ? '1px solid rgba(34,197,94,0.3)' : lost ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--glass-border)',
                  borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <AvatarBox user={opponent} size={42} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--neon-yellow)', marginRight: 4, fontStyle: 'italic' }}>vs</span> {opponent?.username || 'Waiting...'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDate(m.created_at)}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div className="font-display" style={{
                    fontSize: 15, fontWeight: 800,
                    color: won ? 'var(--neon-green)' : lost ? 'var(--neon-red)' : 'var(--neon-yellow)'
                  }}>
                    {won ? '+' : lost ? '-' : ''}{formatCurrency(m.stake_amount)}
                  </div>
                  <StatusBadge status={m.status} size="sm" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
