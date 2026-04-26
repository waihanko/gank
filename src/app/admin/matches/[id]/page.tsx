'use client';

import { useEffect, useState, use } from 'react';
import { formatCurrency, formatDate, formatRelativeTime, getWinRate, formatDuration } from '@/lib/utils';
import { useDialog } from '@/lib/dialog-context';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

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
      // Fetch all matches and find the one with the ID (since there is no direct single fetch yet)
      const res = await fetch(`${API_URL}/api/admin/matches`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        const found = data.data.find((m: any) => m.id === id);
        if (found) setMatch(found);
      }
    } catch { }
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
              {(match.status === 'OPEN' || match.status === 'WAITING' || match.status === 'ACCEPTED') && (
                <button className="btn-secondary" onClick={handleVoid}>Void Match</button>
              )}
              {match.status === 'DISPUTED' && (
                <button className="btn-primary">Resolve Dispute</button>
              )}
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
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    fontWeight: 900,
                    color: 'white',
                    boxShadow: '0 8px 24px var(--accent-glow)'
                  }}
                >
                  {match.challenger?.username?.charAt(0) || '❓'}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{match.challenger?.username || 'Unknown'}</div>
                  <div style={{ fontSize: 14, color: 'var(--accent-primary)', fontWeight: 700 }}>{match.challenger?.mlbb_ign || '—'}</div>
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
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{match.opponent.username}</div>
                      <div style={{ fontSize: 14, color: 'var(--accent-secondary)', fontWeight: 700 }}>{match.opponent.mlbb_ign || '—'}</div>
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
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: match.opponent ? 'linear-gradient(135deg, var(--accent-secondary), #0e7490)' : 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    fontWeight: 900,
                    color: 'white',
                    border: match.opponent ? 'none' : '2px dashed var(--border-secondary)',
                    boxShadow: match.opponent ? '0 8px 24px var(--accent-cyan-glow)' : 'none'
                  }}
                >
                  {match.opponent ? match.opponent.username.charAt(0) : '❓'}
                </div>
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
              {match.status === 'DISPUTED' && (
                <button 
                  className="btn-primary" 
                  style={{ width: '100%', display: 'block', textAlign: 'center', padding: '18px', fontSize: 16, fontWeight: 700 }}
                >
                  Resolve Dispute Manually
                </button>
              )}
              {!['COMPLETED', 'VOIDED', 'CANCELLED'].includes(match.status) && (
                <button 
                  className="btn-danger" 
                  style={{ width: '100%', display: 'block', textAlign: 'center', padding: '18px', fontSize: 16, fontWeight: 700 }} 
                  onClick={handleVoid}
                >
                  Void Match & Refund
                </button>
              )}
            </div>
          </div>


          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginTop: 32 }}>
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Telegram Battle Room</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-primary)' }}>{match.room?.title || 'Not Assigned'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>{match.room?.chat_id || 'N/A'}</div>
            </div>
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
          </div>
        </div>

        {/* Winner Section if Completed */}
        {match.status === 'COMPLETED' && (
          <div className="glass-card animate-fade-in" style={{ padding: 32, background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(22,163,74,0.1))', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Match Result</h2>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-green)' }}>
                {match.winner_id === match.challenger_id ? match.challenger?.username : match.opponent?.username} Won!
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
