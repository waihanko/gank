'use client';

import { useEffect, useState, use } from 'react';
import { formatCurrency, formatDate, formatRelativeTime, getWinRate, formatDuration } from '@/lib/utils';
import { useDialog } from '@/lib/dialog-context';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function PlayerAvatar({ user, size = 64, gradient }: { user: any; size?: number; gradient: string }) {
  const [err, setErr] = useState(false);
  const hasAvatar = user?.mlbb_avatar_url && !err;
  return (
    <div style={{
      width: size, height: size, borderRadius: 16, overflow: 'hidden',
      background: hasAvatar ? undefined : gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 900, color: 'white',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)', flexShrink: 0
    }}>
      {hasAvatar
        ? <img src={user.mlbb_avatar_url} alt="" onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (user?.mlbb_ign?.charAt(0) || user?.username?.charAt(0) || '?')}
    </div>
  );
}

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatch();
  }, [id]);

  async function fetchMatch() {
    const token = localStorage.getItem('gr_admin_token');
    try {
      const res = await fetch(`${API_URL}/api/admin/matches`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gr_admin_token');
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.success) {
        const found = data.data.find((m: any) => m.id === id);
        if (found) {
          setMatch(found);
        }
      }
    } catch {
      window.location.href = '/admin/error?message=This match record could not be retrieved from the central database.';
    }
    setLoading(false);
  }

  async function handleVoid() {
    showConfirm('Are you sure you want to void this match? Both players will be refunded.', async () => {
      const token = localStorage.getItem('gr_admin_token');
      try {
        const res = await fetch(`${API_URL}/api/admin/matches/${id}/void`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          showAlert('Match voided successfully.');
          fetchMatch();
        } else {
          showAlert(data.error || 'Failed to void match');
        }
      } catch {
        showAlert('Network error');
      }
    });
  }

  if (loading) return <div className="page-container">Loading...</div>;
  if (!match) return <div className="page-container">Match not found</div>;

  return (
    <div className="page-container">
      <button
        className="btn-secondary btn-sm"
        style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => router.push('/admin/matches')}
      >
        ← Back to Matches
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Match Header Section */}
        <div className="glass-card animate-fade-in" style={{ padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800 }}>Match #{match.id.slice(-8)}</h1>
                <StatusBadge status={match.status} />
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: 'monospace' }}>Full ID: {match.id}</div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
            </div>
          </div>

          {/* Exact Replica of Public Match Card Design - Expanded to Full Width */}
          <div className="glass-card animate-fade-in" style={{ padding: 40, width: '100%', marginBottom: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                MATCH INSTANCE: {match.id.slice(0, 12)}...{match.id.slice(-8)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Live Status</span>
                <StatusBadge status={match.status} />
              </div>
            </div>

            {/* Players Area - Wide Layout */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, marginBottom: 40, padding: '0 40px' }}>
              {/* Challenger */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 20 }}>
                <PlayerAvatar user={match.challenger} size={64} gradient="linear-gradient(135deg, var(--accent-primary), #6d28d9)" />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{match.challenger?.mlbb_ign || 'Unknown'}</div>
                  <div style={{ fontSize: 14, color: 'var(--accent-primary)', fontWeight: 700 }}>Server: {match.challenger?.mlbb_server_id || '—'} &middot; Zone: {match.challenger?.mlbb_zone_id || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {getWinRate(match.challenger?.wins || 0, match.challenger?.losses || 0)} Win Rate
                  </div>
                </div>
              </div>

              {/* VS Circle */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 900,
                  color: 'var(--neon-yellow)',
                  border: '2px solid var(--border-secondary)',
                  flexShrink: 0,
                  boxShadow: '0 0 20px rgba(0,0,0,0.4)'
                }}
              >
                VS
              </div>

              {/* Opponent */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'flex-end', textAlign: 'right' }}>
                <div>
                  {match.opponent ? (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{match.opponent.mlbb_ign}</div>
                      <div style={{ fontSize: 14, color: 'var(--accent-secondary)', fontWeight: 700 }}>Server: {match.opponent.mlbb_server_id || '—'} &middot; Zone: {match.opponent.mlbb_zone_id || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {getWinRate(match.opponent.wins, match.opponent.losses)} Win Rate
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>Waiting for Opponent</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Open slot available</div>
                    </>
                  )}
                </div>
                <PlayerAvatar user={match.opponent} size={64} gradient={match.opponent ? 'linear-gradient(135deg, var(--accent-secondary), #0e7490)' : 'var(--bg-tertiary)'} />
              </div>
            </div>

            {/* Stake Box - Full Width Decoration */}
            <div
              style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 16,
                padding: '24px 40px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 32,
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Subtle background decoration */}
              <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(45deg, var(--accent-primary) 25%, transparent 25%, transparent 50%, var(--accent-primary) 50%, var(--accent-primary) 75%, transparent 75%, transparent)', backgroundSize: '40px 40px' }}></div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>Current Stake</div>
                <div className="font-display gradient-text-gold" style={{ fontSize: 32, fontWeight: 900 }}>
                  {formatCurrency(match.stake_amount)}
                </div>
              </div>
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>Winner Gets</div>
                <div className="font-display" style={{ fontSize: 32, fontWeight: 900, color: 'var(--neon-green)' }}>
                  {formatCurrency((Number(match.total_pot) > 0 ? Number(match.total_pot) : (match.stake_amount * 2)) * 0.95)}
                </div>
              </div>
            </div>

            {/* Match Code Section */}
            {match.match_code && (
              <div style={{ textAlign: 'center', marginBottom: 32, padding: '16px', background: 'rgba(234,179,8,0.05)', borderRadius: 12, border: '1px solid rgba(234,179,8,0.1)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>Assigned Match Code: </span>
                <span className="font-display" style={{ fontSize: 24, fontWeight: 900, color: 'var(--neon-yellow)', letterSpacing: 8, marginLeft: 12 }}>
                  {match.match_code}
                </span>
              </div>
            )}


            {/* Admin Actions Strip */}
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            </div>
          </div>


          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginTop: 32 }}>
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>
                {match.status === 'COMPLETED' ? 'Total Match Duration' : 'Time Since Created'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {match.completed_at 
                  ? formatDuration(match.created_at, match.completed_at)
                  : formatRelativeTime(match.created_at).replace(' ago', '')
                }
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {match.completed_at ? 'Final battle time' : 'Elapsed time'}
              </div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Timestamps</div>
              <div style={{ fontSize: 13 }}>Created: {formatDate(match.created_at)}</div>
              {match.completed_at && <div style={{ fontSize: 13, color: 'var(--neon-green)' }}>Finished: {formatDate(match.completed_at)}</div>}
            </div>
            <div className="glass-card" style={{
              padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              border: '1px solid rgba(6,182,212,0.25)',
              background: 'linear-gradient(135deg, rgba(6,182,212,0.04), rgba(124,58,237,0.04))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, var(--neon-cyan), var(--accent-primary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, boxShadow: '0 4px 16px rgba(6,182,212,0.3)'
                }}>💬</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Battle Room</div>
              </div>
              <button
                onClick={() => router.push(`/admin/matches/${match.id}/room`)}
                style={{
                  padding: '10px 24px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, var(--neon-cyan), var(--accent-primary))',
                  color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 20px rgba(6,182,212,0.35)',
                  transition: 'all 0.3s'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Check Battle Room
              </button>
            </div>
          </div>
        </div>

        {/* Winner Section if Completed */}
        {match.status === 'COMPLETED' && (
          <div className="glass-card animate-fade-in" style={{ padding: 32, background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(22,163,74,0.1))', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Match Result</h2>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-green)' }}>
                {match.winner_id === match.challenger_id ? match.challenger?.mlbb_ign : match.opponent?.mlbb_ign} Won!
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                Payout Released: {formatCurrency(match.total_pot - match.commission)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
