'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, getWinRate, formatRelativeTime } from '@/lib/utils';
import { useDialog } from '@/lib/dialog-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function MatchAvatar({ user, size, borderRadius = 14 }: { user: any, size: number, borderRadius?: number }) {
  const [error, setError] = useState(false);
  if (!user) return <span>?</span>;

  const avatar = user.avatar_url || user.mlbb_avatar_url;
  if (avatar && !error) {
    return (
      <img
        src={avatar}
        alt={user.username}
        onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius }}
      />
    );
  }

  const initial = (user.mlbb_ign || user.telegram_display_name || user.telegram_username || user.username || 'U').replace('@', '').trim().charAt(0).toUpperCase();
  return <span>{initial}</span>;
}

export default function MatchesPage() {
  const router = useRouter();
  const [stakeInput, setStakeInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { isLoggedIn, requireAuth, token, user } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const [matches, setMatches] = useState<any[]>([]);
  const [myRecentMatches, setMyRecentMatches] = useState<any[]>([]);
  const myLiveMatch = myRecentMatches.find((m) => ['PENDING_JOIN', 'ACTIVE', 'ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'].includes(m.status));
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Auto-delete confirmation dialog
  const [autoDeleteDialog, setAutoDeleteDialog] = useState<{
    show: boolean;
    targetMatchId: string;
    existingMatchId: string;
    existingStake: number;
  }>({ show: false, targetMatchId: '', existingMatchId: '', existingStake: 0 });

  useEffect(() => {
    fetchMatches();
    fetchMyLive();
    const interval = setInterval(() => {
      fetchMatches();
      fetchMyLive();
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const pendingMatch = myRecentMatches.find((m) => m.status === 'PENDING_JOIN' && m.challenger_id === user?.id);
    if (pendingMatch) {
      const updateTimer = () => {
        const createdTime = new Date(pendingMatch.created_at).getTime();
        const expireTime = createdTime + 5 * 60 * 1000;
        const remaining = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
        setTimeLeft(remaining);
      };
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }
  }, [myRecentMatches, user]);

  async function fetchMatches() {
    try {
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/matches`, { headers });
      const data = await res.json();
      if (data.success) {
        setMatches(data.data);
      }
    } catch {}
    setLoading(false);
  }

  async function fetchMyLive() {
    if (!token) { setMyRecentMatches([]); return; }
    try {
      const res = await fetch(`${API_URL}/api/matches/my-recent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMyRecentMatches(data.success ? data.data : []);
    } catch { setMyRecentMatches([]); }
  }

  function handleAuthAction(action: () => void) {
    if (!isLoggedIn) { window.location.href = '/login'; return; }
    action();
  }



  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn || !token) {
      window.location.href = '/login';
      return;
    }
    if (creating) return;
    
    const val = Number(stakeInput);
    if (!val || val < 1000) return showAlert('Minimum stake is 1000 MMK');

    if (myRecentMatches.some(m => m.status === 'DISPUTED')) {
      showAlert('⚠️ You have a disputed match that needs resolution. Please visit the match room and provide evidence or wait for admin review before creating new challenges.', { title: 'Dispute Pending' });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ stake_amount: val })
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setStakeInput('');
        fetchMatches();
        fetchMyLive();
        
        router.push('/battle/' + data.data.match.id);
      } else {
        showAlert(data.error);
      }
    } catch {
      showAlert('Failed to create challenge. Check limits or wallet bounds.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(matchId: string, skipConfirm = false) {
    const doDelete = async () => {
      if (!token) return;
      setDeleting(true);
      try {
        const res = await fetch(`${API_URL}/api/matches/${matchId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          fetchMatches();
          fetchMyLive();
          router.push('/battle/' + myLiveMatch.id);
        } else {
          showAlert(data.error);
        }
      } catch {
        showAlert('Failed to delete challenge');
      }
      setDeleting(false);
    };

    if (!skipConfirm) {
      showConfirm('Delete this challenge? Your stake will be returned to your wallet.', doDelete);
    } else {
      doDelete();
    }
  }

  async function handleAccept(id: string) {
    if (!isLoggedIn || !token) {
      window.location.href = '/login';
      return;
    }

    // Check if user has their own ACTIVE/PENDING_JOIN challenge — show auto-delete dialog
    if (myLiveMatch && myLiveMatch.challenger_id === user?.id && ['PENDING_JOIN', 'ACTIVE'].includes(myLiveMatch.status) && !myLiveMatch.opponent_id) {
      setAutoDeleteDialog({
        show: true,
        targetMatchId: id,
        existingMatchId: myLiveMatch.id,
        existingStake: Number(myLiveMatch.stake_amount),
      });
      return;
    }

    await doAccept(id);
  }

  async function doAccept(id: string) {
    try {
      const res = await fetch(`${API_URL}/api/matches/${id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchMatches();
        fetchMyLive();
        
        router.push('/battle/' + id);
      } else {
        showAlert(data.error);
      }
    } catch {
      showAlert('Network error');
    }
  }

  async function handleAutoDeleteAndJoin() {
    const { targetMatchId } = autoDeleteDialog;
    setAutoDeleteDialog({ show: false, targetMatchId: '', existingMatchId: '', existingStake: 0 });
    // The backend auto-deletes the old challenge in the accept endpoint,
    // so we just proceed with doAccept
    await doAccept(targetMatchId);
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800 }}>
              ⚔️ <span className="gradient-text">Match Arena</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
              Browse open challenges or create your own
            </p>
          </div>
          <button className="btn-battle btn-battle-pulse" onClick={() => handleAuthAction(() => {
            if (myRecentMatches.some(m => m.status === 'DISPUTED')) {
              showAlert('⚠️ You have a disputed match that needs resolution. Please visit the match room and provide evidence or wait for admin review before creating new challenges.', { title: 'Dispute Pending' });
              return;
            }
            setShowCreateModal(true);
          })}>
            🎯 Create Challenge
          </button>
        </div>

        {/* Recent Matches Banner */}
        {myRecentMatches.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Your Recent Matches
            </h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {myRecentMatches.map((match: any) => (
                <div key={match.id} className="glass-card animate-glow-pulse" style={{ padding: 24, flex: '1 1 350px', maxWidth: 400, border: match.status === 'PENDING_JOIN' ? '1px solid rgba(234,179,8,0.4)' : '1px solid rgba(34,197,94,0.4)' }}>
                  
                  {/* Status Helper */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                    {match.status === 'PENDING_JOIN' && '⏳ Pending Challenge — Waiting for you to join'}
                    {match.status === 'ACTIVE' && '🟢 Your Active Challenge'}
                    {match.status === 'WAITING' && '🤝 Challenge Accepted — Waiting for Telegram Join'}
                    {['ACCEPTED', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'].includes(match.status) && '⚔️ Battle In Progress!'}
                    {['COMPLETED', 'VOIDED', 'CANCELLED', 'DISPUTED'].includes(match.status) && `🏁 Match ${match.status}`}
                  </div>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{match.id.slice(0, 5)}...{match.id.slice(-3)}</span>
                <StatusBadge status={match.status} />
              </div>

              {/* Players */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                {/* Challenger */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      margin: '0 auto 8px',
                    }}
                  >
                    <MatchAvatar user={match.challenger} size={48} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{match.challenger?.mlbb_ign || match.challenger?.username || 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {getWinRate(match.challenger?.wins || 0, match.challenger?.losses || 0)} WR
                  </div>
                </div>

                {/* VS */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--neon-yellow)',
                    border: '2px solid var(--border-secondary)',
                    flexShrink: 0,
                  }}
                >
                  VS
                </div>

                {/* Opponent */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  {match.opponent ? (
                    <>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background: 'linear-gradient(135deg, var(--accent-secondary), #0e7490)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 700,
                          margin: '0 auto 8px',
                        }}
                      >
                        <MatchAvatar user={match.opponent} size={48} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{match.opponent?.mlbb_ign || match.opponent?.username}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {getWinRate(match.opponent.wins, match.opponent.losses)} WR
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background: 'var(--bg-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          margin: '0 auto 8px',
                          border: '2px dashed var(--border-secondary)',
                        }}
                      >
                        ❓
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Waiting...</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Open slot</div>
                    </>
                  )}
                </div>
              </div>

              {/* Stake */}
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Stake Amount
                </div>
                <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--neon-yellow)' }}>
                  {formatCurrency(match.stake_amount)}
                </div>
              </div>

              {/* Action Buttons / Results */}
              <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                {match.status === 'PENDING_JOIN' && (
                  <button className="btn-telegram" style={{ width: '100%' }} onClick={() => router.push('/battle/' + match.id)}>
                    📱 Join Battle Room
                  </button>
                )}
                {match.status === 'ACTIVE' && match.challenger_id === user?.id && !match.opponent_id && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-telegram" onClick={() => router.push('/battle/' + match.id)} style={{ flex: 1 }}>
                      📱 View Room
                    </button>
                    <button className="btn-danger" onClick={() => handleDelete(match.id)} disabled={deleting} style={{ flex: 1 }}>
                      {deleting ? '...' : '🗑️ Delete'}
                    </button>
                  </div>
                )}
                {match.status === 'PENDING_JOIN' && match.challenger_id === user?.id && !match.opponent_id && (
                  <button className="btn-danger" onClick={() => handleDelete(match.id)} disabled={deleting} style={{ width: '100%' }}>
                    {deleting ? '...' : `🗑️ Cancel (${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')})`}
                  </button>
                )}
                {['ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION', 'DISPUTED'].includes(match.status) && (
                  <button className="btn-telegram" style={{ width: '100%', background: match.status === 'DISPUTED' ? 'linear-gradient(135deg, #ef4444, #991b1b)' : undefined }} onClick={() => router.push('/battle/' + match.id)}>
                    {match.status === 'DISPUTED' ? '⚠️ View Dispute' : '📱 Open Battle Room'}
                  </button>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  {/* Duration on Left */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {match.status === 'COMPLETED' && match.started_at && match.completed_at ? (
                      `⏱️ ${Math.floor((new Date(match.completed_at).getTime() - new Date(match.started_at).getTime()) / 60000)}m ${Math.floor(((new Date(match.completed_at).getTime() - new Date(match.started_at).getTime()) % 60000) / 1000)}s`
                    ) : match.status === 'BATTLE' ? (
                      '⚔️ Battling...'
                    ) : null}
                  </div>

                  {/* Winner on Right */}
                  {match.status === 'COMPLETED' && match.winner_id && (
                    <span style={{ fontSize: 13, color: 'var(--neon-green)', fontWeight: 600 }}>
                      🏆 {match.winner_id === match.challenger_id ? (match.challenger?.mlbb_ign || match.challenger?.username) : (match.opponent?.mlbb_ign || match.opponent?.username)} Won
                    </span>
                  )}
                  {match.status === 'DISPUTED' && (
                    <span style={{ fontSize: 13, color: 'var(--neon-red)', fontWeight: 600 }}>
                      ⚠️ Under Review
                    </span>
                  )}
                </div>
              </div>

                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>🌍 Global Match Feed</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Recent challenges and live battles from all players</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
          {matches.map((match) => (
            <div key={match.id} className="glass-card" style={{ padding: 24 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{match.id.slice(0, 5)}...{match.id.slice(-3)}</span>
                <StatusBadge status={match.status} />
              </div>

              {/* Players */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                {/* Challenger */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      margin: '0 auto 8px',
                    }}
                  >
                    <MatchAvatar user={match.challenger} size={48} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{match.challenger?.mlbb_ign || match.challenger?.username || 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {getWinRate(match.challenger?.wins || 0, match.challenger?.losses || 0)} WR
                  </div>
                </div>

                {/* VS */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--neon-yellow)',
                    border: '2px solid var(--border-secondary)',
                    flexShrink: 0,
                  }}
                >
                  VS
                </div>

                {/* Opponent */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  {match.opponent ? (
                    <>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background: 'linear-gradient(135deg, var(--accent-secondary), #0e7490)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 700,
                          margin: '0 auto 8px',
                        }}
                      >
                        <MatchAvatar user={match.opponent} size={48} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{match.opponent?.mlbb_ign || match.opponent?.username}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {getWinRate(match.opponent.wins, match.opponent.losses)} WR
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background: 'var(--bg-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          margin: '0 auto 8px',
                          border: '2px dashed var(--border-secondary)',
                        }}
                      >
                        ❓
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Waiting...</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Open slot</div>
                    </>
                  )}
                </div>
              </div>

              {/* Stake */}
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Stake</div>
                  <div className="font-display gradient-text-gold" style={{ fontSize: 20, fontWeight: 700 }}>
                    {formatCurrency(match.stake_amount)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Winner Gets</div>
                  <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-green)' }}>
                    {formatCurrency(match.stake_amount * 2 * 0.95)}
                  </div>
                </div>
              </div>

              {/* Match Code if in battle */}
              {match.match_code && (
                <div style={{ textAlign: 'center', marginBottom: 16, padding: 8, background: 'rgba(234,179,8,0.08)', borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Match Code: </span>
                  <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--neon-yellow)', letterSpacing: 4 }}>{match.match_code}</span>
                </div>
              )}

              {/* Action / Time */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatRelativeTime(match.created_at)}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Challenger: "In Room" badge */}
                  {match.challenger_id === user?.id && match.challenger_joined && ['ACTIVE', 'ACCEPTED', 'WAITING'].includes(match.status) && (
                    <span style={{ fontSize: 12, color: 'var(--neon-green)', fontWeight: 600, padding: '4px 10px', background: 'rgba(34,197,94,0.1)', borderRadius: 8 }}>
                      ✅ In Room
                    </span>
                  )}

                  {/* Challenger: "Delete Challenge" — only when ACTIVE and no opponent */}
                  {match.challenger_id === user?.id && match.status === 'ACTIVE' && !match.opponent_id && (
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => handleDelete(match.id)}
                      disabled={deleting}
                      style={{ fontSize: 11 }}
                    >
                      🗑️ Delete
                    </button>
                  )}

                  {/* View Dispute for any user if disputed */}
                  {match.status === 'DISPUTED' && (
                    <button className="btn-danger btn-sm" onClick={() => router.push('/battle/' + match.id)} style={{ fontSize: 11 }}>
                      ⚠️ View Dispute
                    </button>
                  )}

                  {/* Other users: "Join Battle" = accept + generate link */}
                  {match.status === 'ACTIVE' && match.challenger_id !== user?.id && !match.opponent_id && (
                    <button className="btn-battle btn-battle-pulse" onClick={() => handleAccept(match.id)}>⚔️ Join Battle</button>
                  )}

                  {/* Opponent: Show "Join Battle Room" if accepted but not joined */}
                  {match.opponent_id === user?.id && !match.opponent_joined && match.status === 'ACTIVE' && match.opponent_invite_link && (
                    <a
                      href={match.opponent_invite_link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-telegram"
                      style={{ textDecoration: 'none' }}
                    >
                      📱 Join Battle Room
                    </a>
                  )}
                  {/* Opponent: "In Room" badge */}
                  {match.opponent_id === user?.id && match.opponent_joined && match.status === 'WAITING' && (
                    <span style={{ fontSize: 12, color: 'var(--neon-green)', fontWeight: 600, padding: '4px 10px', background: 'rgba(34,197,94,0.1)', borderRadius: 8 }}>
                      ✅ In Room
                    </span>
                  )}

                  {match.status === 'COMPLETED' && match.winner_id && (
                    <span style={{ fontSize: 13, color: 'var(--neon-green)', fontWeight: 600 }}>
                      🏆 {match.winner_id === match.challenger_id ? (match.challenger?.mlbb_ign || match.challenger?.username) : (match.opponent?.mlbb_ign || match.opponent?.username)} Won
                    </span>
                  )}
                  {match.status === 'DISPUTED' && (
                    <span style={{ fontSize: 13, color: 'var(--neon-red)', fontWeight: 600 }}>
                      ⚠️ Under Review
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {matches.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏜️</div>
            <p>No matches found for this filter.</p>
          </div>
        )}

      </div>

      {/* ======================== CREATE MODAL ======================== */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="glass-card animate-fade-in-up"
            style={{ maxWidth: 440, width: '100%', padding: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              🎯 <span className="gradient-text">Create Challenge</span>
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Set your stake amount. Funds will be frozen from your wallet.
            </p>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Stake Amount (MMK)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input-field"
              placeholder="e.g. 5000"
              value={stakeInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setStakeInput(val);
              }}
              style={{ marginBottom: 12 }}
            />

            {stakeInput && Number(stakeInput) > 0 && (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Your Stake</span>
                  <span>{formatCurrency(Number(stakeInput))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Total Pot</span>
                  <span>{formatCurrency(Number(stakeInput) * 2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Platform Fee (5%)</span>
                  <span>{formatCurrency(Number(stakeInput) * 2 * 0.05)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Winner Receives</span>
                  <span className="gradient-text-gold font-display" style={{ fontSize: 18, fontWeight: 700 }}>
                    {formatCurrency(Number(stakeInput) * 2 * 0.95)}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1 }} 
                onClick={(e) => handleCreate(e)}
                disabled={creating}
              >
                {creating ? '🚀 Posting...' : '🚀 Post Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Delete Conflict Dialog */}
      {autoDeleteDialog.show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="glass-card animate-fade-in-up" style={{ maxWidth: 440, width: '100%', padding: 32, border: '1px solid var(--neon-red)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>⚠️</div>
            <h3 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
              Conflict Detected
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, textAlign: 'center', lineHeight: 1.6 }}>
              You currently have an active challenge (Stake: {formatCurrency(autoDeleteDialog.existingStake)}). You cannot hold multiple active challenges at the same time.
              <br /><br />
              Joining this battle will <strong style={{ color: 'var(--neon-red)' }}>automatically delete</strong> your existing challenge and return the stake to your wallet. Proceed?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setAutoDeleteDialog({ show: false, targetMatchId: '', existingMatchId: '', existingStake: 0 })}>
                Cancel
              </button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleAutoDeleteAndJoin}>
                Delete & Join
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
