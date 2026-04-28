'use client';

import { useEffect, useState, use } from 'react';
import { formatCurrency, formatDate, formatRelativeTime, getWinRate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { token, isLoggedIn, loading: authLoading } = useAuth();

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push('/login');
      return;
    }
    if (token) {
      fetchMatch();
    }
  }, [id, token, authLoading, isLoggedIn]);

  async function fetchMatch() {
    try {
      const res = await fetch(`${API_URL}/api/matches/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMatch(data.data);
      }
    } catch { }
    setLoading(false);
  }

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="font-display gradient-text" style={{ fontSize: 20 }}>Loading Match Details...</div>
    </div>
  );

  if (!match) return (
    <div className="page-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>❓</div>
      <h2 style={{ fontSize: 24, fontWeight: 800 }}>Match Not Found</h2>
      <button className="btn-secondary" style={{ marginTop: 24 }} onClick={() => router.push('/battle-history')}>
        Back to History
      </button>
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>
        <button
          className="btn-secondary btn-sm"
          style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => router.push('/battle-history')}
        >
          ← Back to History
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main Card */}
          <div className="glass-card animate-fade-in-up" style={{ padding: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
                  MATCH ID: {match.id.slice(0, 12)}...
                </div>
                <StatusBadge status={match.status} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Battle Date</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(match.created_at)}</div>
              </div>
            </div>

            {/* Players Section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 40 }}>
              {/* Challenger */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 900,
                    margin: '0 auto 12px',
                    boxShadow: '0 8px 24px var(--accent-glow)'
                  }}
                >
                  {match.challenger?.username?.charAt(0) || '?'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{match.challenger?.username || 'Unknown'}</div>
                <div style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 700 }}>{match.challenger?.mlbb_ign || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {getWinRate(match.challenger?.wins || 0, match.challenger?.losses || 0)} Win Rate
                </div>
              </div>

              {/* VS */}
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 900,
                  color: 'var(--neon-yellow)',
                  border: '2px solid var(--border-secondary)',
                  flexShrink: 0,
                  boxShadow: '0 0 20px rgba(0,0,0,0.3)'
                }}
              >
                VS
              </div>

              {/* Opponent */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: match.opponent ? 'linear-gradient(135deg, var(--accent-secondary), #0e7490)' : 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 900,
                    margin: '0 auto 12px',
                    border: match.opponent ? 'none' : '2px dashed var(--border-secondary)',
                    boxShadow: match.opponent ? '0 8px 24px var(--accent-cyan-glow)' : 'none'
                  }}
                >
                  {match.opponent?.username?.charAt(0) || '❓'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{match.opponent?.username || 'Waiting...'}</div>
                <div style={{ fontSize: 13, color: 'var(--accent-secondary)', fontWeight: 700 }}>{match.opponent?.mlbb_ign || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {match.opponent ? `${getWinRate(match.opponent.wins, match.opponent.losses)} Win Rate` : 'Open slot'}
                </div>
              </div>
            </div>

            {/* Financial Section */}
            <div
              style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 16,
                padding: '24px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid var(--border-secondary)',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 700 }}>Stake Amount</div>
                <div className="font-display" style={{ fontSize: 24, fontWeight: 900, color: 'var(--neon-yellow)' }}>
                  {formatCurrency(match.stake_amount)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 700 }}>Winner Receives</div>
                <div className="font-display" style={{ fontSize: 24, fontWeight: 900, color: 'var(--neon-green)' }}>
                  {formatCurrency((Number(match.total_pot) || (match.stake_amount * 2)) * 0.95)}
                </div>
              </div>
            </div>
          </div>

          {/* Outcome Section */}
          {match.status === 'COMPLETED' && (
            <div className="glass-card animate-fade-in-up" style={{ 
              padding: 40, 
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(22,163,74,0.05))',
              border: '1px solid rgba(34,197,94,0.2)'
            }}>
              <div style={{ fontSize: 54, marginBottom: 16 }}>🏆</div>
              <h2 className="font-display" style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Match Finalized</h2>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-green)' }}>
                {match.winner_id === match.challenger_id ? match.challenger?.username : match.opponent?.username} emerged victorious!
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 12 }}>
                The prize has been successfully credited to the winner's wallet.
              </div>
            </div>
          )}

          {/* Dispute Section */}
          {match.status === 'DISPUTED' && (
            <div className="glass-card" style={{ 
              padding: 32, 
              textAlign: 'center',
              background: 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.2)'
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--neon-red)' }}>Match Under Dispute</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                This match is currently being reviewed by our administrators due to a reported issue. 
                A resolution will be reached shortly.
              </p>
            </div>
          )}

          {/* Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Match Room</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{match.room?.title || 'Private Room'}</div>
            </div>
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Duration</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {match.started_at && match.completed_at ? (
                  `${Math.floor((new Date(match.completed_at).getTime() - new Date(match.started_at).getTime()) / 60000)}m ${Math.floor(((new Date(match.completed_at).getTime() - new Date(match.started_at).getTime()) % 60000) / 1000)}s`
                ) : 'N/A'}
              </div>
            </div>
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Created At</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{formatRelativeTime(match.created_at)}</div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
