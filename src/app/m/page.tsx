'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, getWinRate, formatRelativeTime } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Match {
  id: string;
  status: string;
  stake_amount: number;
  created_at: string;
  challenger?: { id: string; username: string; mlbb_ign: string; wins: number; losses: number; telegram_display_name?: string; avatar_url?: string };
  opponent?: { id: string; username: string; mlbb_ign: string; wins: number; losses: number; telegram_display_name?: string; avatar_url?: string };
  winner_id?: string;
  challenger_id?: string;
  opponent_id?: string;
}

interface Stats { totalMatches: number; totalUsers: number; totalPrizePool: number; }

function AvatarBox({ user, size = 40 }: { user: any; size?: number }) {
  const [err, setErr] = useState(false);
  const name = user?.telegram_display_name || user?.username || 'U';
  const initial = name.replace('@', '').charAt(0).toUpperCase();
  const avatar = user?.avatar_url || user?.mlbb_avatar_url;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: avatar && !err ? undefined : 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', fontSize: size * 0.38, fontWeight: 700,
    }}>
      {avatar && !err
        ? <img src={avatar} alt="" onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial}
    </div>
  );
}

const quickPresets = [1000, 2000, 5000, 10000];

export default function MobileHomePage() {
  const router = useRouter();
  const { isLoggedIn, user, token } = useAuth();
  const { showAlert, showConfirm } = useDialog();

  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<Stats>({ totalMatches: 0, totalUsers: 0, totalPrizePool: 0 });
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [stakeInput, setStakeInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);


  // The user's current active/pending match (if any)
  const myLive = myMatches.find(m =>
    ['PENDING_JOIN', 'ACTIVE', 'ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION', 'DISPUTED'].includes(m.status)
  );

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [token]);

  // Countdown for PENDING_JOIN (5 min expiry window)
  useEffect(() => {
    const pending = myMatches.find((m: any) => m.status === 'PENDING_JOIN' && m.challenger_id === (user as any)?.id);
    if (!pending) { setTimeLeft(0); return; }
    const update = () => {
      const exp = new Date(pending.created_at).getTime() + 5 * 60 * 1000;
      setTimeLeft(Math.max(0, Math.floor((exp - Date.now()) / 1000)));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [myMatches, user]);

  async function load() {
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    const [liveRes, statsRes, myRes] = await Promise.all([
      fetch(`${API_URL}/api/matches?status=ACTIVE`, { headers }).then(r => r.json()).catch(() => ({ success: false })),
      fetch(`${API_URL}/api/matches/stats`).then(r => r.json()).catch(() => ({ success: false })),
      token
        ? fetch(`${API_URL}/api/matches/my-recent`, { headers }).then(r => r.json()).catch(() => ({ success: false }))
        : Promise.resolve({ success: false }),
    ]);
    // Only show ACTIVE matches with no opponent yet (truly joinable), exclude own challenges
    if (liveRes.success) {
      const active = liveRes.data.filter((m: any) => m.status === 'ACTIVE' && !m.opponent_id);
      setLiveCount(active.length);
      setLiveMatches(active.slice(0, 6));
    }
    if (statsRes.success) setStats(statsRes.data);
    if (myRes.success) setMyMatches(myRes.data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!isLoggedIn) { window.location.href = '/login'; return; }
    const val = Number(stakeInput);
    if (!val || val < 1000) return showAlert('Minimum stake is 1,000 MMK');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stake_amount: val }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setStakeInput('');
        load();
        router.push('/m/battle/' + data.data.match.id);
      } else showAlert(data.error || 'Failed to create');
    } catch { showAlert('Network error'); }
    finally { setCreating(false); }
  }

  async function doDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/matches/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (d.success) load();
    } catch {}
    setDeleting(false);
  }

  async function handleAccept(id: string, amount: number) {
    if (!isLoggedIn) { window.location.href = '/login'; return; }
    const bal = user?.wallet?.balance || 0;
    if (bal < amount) {
      showAlert(`Insufficient balance! You need ${formatCurrency(amount)}`);
      return;
    }
    showConfirm(`Accept challenge for ${formatCurrency(amount)}?`, async () => {
      try {
        const res = await fetch(`${API_URL}/api/matches/${id}/accept`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          router.push(`/m/battle/${id}`);
        } else {
          showAlert(data.error || 'Failed to accept challenge');
        }
      } catch {
        showAlert('Network error');
      }
    });
  }

  return (
    <div style={{ padding: '0 16px 120px' }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '16px 0 20px' }}>
        {[
          { value: liveCount > 0 ? `${liveCount}` : '0', label: 'Lives' },
          { value: stats.totalUsers > 0 ? `${stats.totalUsers}` : '—', label: 'Players' },
          { value: stats.totalPrizePool > 0 ? `${(stats.totalPrizePool / 1000).toFixed(0)}K+` : '—', label: 'Total Prize' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 14, padding: '12px 8px', textAlign: 'center',
          }}>
            <div className="font-display gradient-text" style={{ fontSize: 18, fontWeight: 800 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Create Challenge button — same class as desktop ── */}
      <button
        className="btn-battle btn-battle-pulse"
        onClick={() => {
          if (!isLoggedIn) { window.location.href = '/login'; return; }
          if (myMatches.some(m => m.status === 'DISPUTED')) {
            showAlert('⚠️ You have a disputed match that needs resolution. Please visit the match room and provide evidence or wait for admin review before creating new challenges.', { title: 'Dispute Pending' });
            return;
          }
          setShowCreate(true);
        }}
        style={{ width: '100%', marginBottom: 20, fontSize: 14, padding: '14px 20px', borderRadius: 14 }}
      >
        🎯 Create Challenge
      </button>

      {/* ── Your Active Match — premium desktop-style card ── */}
      {isLoggedIn && myLive && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(6,182,212,0.07))',
          border: `1px solid ${myLive.status === 'PENDING_JOIN' ? 'rgba(234,179,8,0.4)' : 'rgba(34,197,94,0.35)'}`,
          borderRadius: 18, padding: '16px', marginBottom: 20,
          boxShadow: `0 4px 24px ${myLive.status === 'PENDING_JOIN' ? 'rgba(234,179,8,0.08)' : 'rgba(34,197,94,0.08)'}`,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow orb */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent)', pointerEvents: 'none' }} />

          {/* ── Header: match ID + status badge ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: myLive.status === 'PENDING_JOIN' ? '#f59e0b' : 'var(--neon-green)', animation: 'pulse-dot 2s infinite' }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {myLive.status === 'PENDING_JOIN' && '⏳ Pending Challenge'}
                {myLive.status === 'ACTIVE' && '🟢 Your Active Challenge'}
                {myLive.status === 'WAITING' && '🤝 Accepted — Waiting for Telegram'}
                {myLive.status === 'DISPUTED' && '⚠️ Match Disputed'}
                {['ACCEPTED', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'].includes(myLive.status) && '⚔️ Battle In Progress!'}
              </div>
            </div>
            <StatusBadge status={myLive.status} />
          </div>

          {/* ── VS Players layout ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {/* Challenger */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                <AvatarBox user={(myLive as any).challenger} size={44} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(myLive as any).challenger?.telegram_display_name || (myLive as any).challenger?.username || 'You'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {getWinRate((myLive as any).challenger?.wins || 0, (myLive as any).challenger?.losses || 0)} WR
              </div>
            </div>

            {/* VS badge */}
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg-tertiary)', border: '2px solid var(--border-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 900, color: '#f59e0b', letterSpacing: 0.5,
              fontStyle: 'italic',
            }}>
              VS
            </div>

            {/* Opponent or waiting slot */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              {(myLive as any).opponent ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <AvatarBox user={(myLive as any).opponent} size={44} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(myLive as any).opponent?.telegram_display_name || (myLive as any).opponent?.username}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {getWinRate((myLive as any).opponent?.wins || 0, (myLive as any).opponent?.losses || 0)} WR
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    width: 44, height: 44, borderRadius: 13, margin: '0 auto 6px',
                    background: 'var(--bg-tertiary)', border: '2px dashed rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>❓</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Waiting...</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Open slot</div>
                </>
              )}
            </div>
          </div>

          {/* ── Stake block ── */}
          <div style={{
            background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '10px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Stake Amount</div>
            <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: '#f59e0b' }}>
              {formatCurrency((myLive as any).stake_amount)}
            </div>
          </div>

          {/* ── PENDING_JOIN countdown notification ── */}
          {myLive.status === 'PENDING_JOIN' && timeLeft > 0 && (
            <div style={{
              marginBottom: 12, padding: '8px 12px', borderRadius: 10,
              background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)',
              fontSize: 11, color: '#f59e0b', lineHeight: 1.6,
            }}>
              ⏳ Waiting for an opponent. Your challenge expires in{' '}
              <strong style={{ fontFamily: 'monospace', color: 'var(--neon-red)' }}>
                ({Math.floor(timeLeft / 60)}m {(timeLeft % 60)}s)
              </strong>
              {' '}— auto-cancelled if no one joins.
            </div>
          )}

          {/* ── Action buttons — correct per status ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Join Battle Room — PENDING_JOIN challenger */}
            {myLive.status === 'PENDING_JOIN' && (myLive as any).challenger_invite_link && (
              <button
                onClick={() => router.push('/m/battle/' + (myLive as any).id)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #0088cc, #006ba6)',
                  color: 'white', fontWeight: 700, fontSize: 13,
                  boxShadow: '0 4px 14px rgba(0,136,204,0.3)',
                }}
              >
                📱 Join Battle Room
              </button>
            )}

            {/* Cancel — only ACTIVE + own challenge + no opponent yet */}
            {myLive.status === 'ACTIVE' && (myLive as any).challenger_id === (user as any)?.id && !(myLive as any).opponent_id && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => router.push('/m/battle/' + (myLive as any).id)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'var(--accent-primary)', color: 'white',
                    fontWeight: 700, fontSize: 13,
                  }}
                >
                  📱 View Room
                </button>
                <button
                  onClick={() => showConfirm(
                    'Cancel this challenge? Your stake will be returned.',
                    () => doDelete((myLive as any).id)
                  )}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.08)', color: 'var(--neon-red)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {deleting ? '...' : '🗑️ Delete'}
                </button>
              </div>
            )}

            {/* Open Battle Room — in-progress statuses */}
            {['ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION', 'DISPUTED'].includes(myLive.status) && (
              <button
                onClick={() => router.push('/m/battle/' + (myLive as any).id)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: myLive.status === 'DISPUTED' 
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.8), #b91c1c)'
                    : 'linear-gradient(135deg, #0088cc, #006ba6)',
                  color: 'white', fontWeight: 700, fontSize: 13,
                  boxShadow: myLive.status === 'DISPUTED'
                    ? '0 4px 14px rgba(239,68,68,0.3)'
                    : '0 4px 14px rgba(0,136,204,0.3)',
                }}
              >
                {myLive.status === 'DISPUTED' ? '⚠️ View Dispute' : '📱 Open Battle Room'}
              </button>
            )}

            {/* PENDING_JOIN cancel — challenger only + no opponent */}
            {myLive.status === 'PENDING_JOIN' && (myLive as any).challenger_id === (user as any)?.id && !(myLive as any).opponent_id && (
              <button
                onClick={() => showConfirm(
                  'Cancel this challenge? Your stake will be returned.',
                  () => doDelete((myLive as any).id)
                )}
                disabled={deleting}
                style={{
                  width: '100%', padding: '11px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)',
                  background: 'transparent', color: 'rgba(239,68,68,0.7)',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}
              >
                {deleting ? '...' : `🗑️ Cancel Challenge (${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Your Recent Matches ── */}
      {isLoggedIn && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>⚔️ Your Recent Matches</h2>
            <Link href="/m/battle-history" style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
              See all →
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2].map(i => (
                <div key={i} style={{ height: 64, background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', animation: 'pulse 2s infinite' }} />
              ))}
            </div>
          ) : myMatches.length === 0 ? (
            <div style={{
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              borderRadius: 14, padding: '20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No matches yet — create your first challenge!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myMatches.map(match => {
                const isChallenger = match.challenger_id === (user as any)?.id;
                const opponent = isChallenger ? match.opponent : match.challenger;
                const opponentName = opponent?.telegram_display_name || opponent?.username || '—';
                const isWin = match.winner_id === (user as any)?.id;
                const isLoss = match.winner_id && match.winner_id !== (user as any)?.id;
                const isDone = ['COMPLETED', 'VOIDED', 'CANCELLED', 'DISPUTED'].includes(match.status);

                return (
                  <Link key={match.id} href={`/m/battle/${match.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                      background: 'var(--glass-bg)',
                      border: `1px solid ${isDone ? (isWin ? 'rgba(34,197,94,0.2)' : isLoss ? 'rgba(239,68,68,0.15)' : 'var(--glass-border)') : 'rgba(124,58,237,0.25)'}`,
                      borderRadius: 12, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <AvatarBox user={opponent} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--neon-yellow)', marginRight: 4, fontStyle: 'italic' }}>vs</span> {opponentName}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                          {formatRelativeTime(match.created_at)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="font-display" style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>
                          {formatCurrency(match.stake_amount)}
                        </div>
                        <div style={{ marginTop: 2 }}>
                          {isDone ? (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                              background: isWin ? 'rgba(34,197,94,0.15)' : isLoss ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.15)',
                              color: isWin ? 'var(--neon-green)' : isLoss ? 'var(--neon-red)' : 'var(--text-muted)',
                            }}>
                              {isWin ? '🏆 WIN' : isLoss ? '💀 LOSS' : match.status}
                            </span>
                          ) : (
                            <StatusBadge status={match.status} />
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Live Challenges ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700 }}>
            🔥 Live Challenges
            <span style={{
              marginLeft: 8, fontSize: 9, fontWeight: 700,
              background: 'rgba(239,68,68,0.15)', color: 'var(--neon-red)',
              padding: '2px 7px', borderRadius: 10, verticalAlign: 'middle',
            }}>
              LIVE
            </span>
          </h2>
          <Link href="/m/live-challenges" style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            See all →
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 80, background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', animation: 'pulse 2s infinite' }} />
            ))}
          </div>
        ) : liveMatches.filter(m => m.challenger_id !== (user as any)?.id).length === 0 ? (
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 14, padding: '32px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏜️</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>No open challenges right now</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Create one and be the first!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liveMatches
              .filter(m => m.challenger_id !== (user as any)?.id) // hide own challenges
              .map(match => {
                const c = match.challenger;
                const displayName = c?.telegram_display_name || c?.username || '?';
                return (
                  <div key={match.id} style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))',
                    border: '1px solid rgba(124,58,237,0.28)',
                    borderRadius: 16, padding: '14px 16px',
                  }}>
                    {/* Label */}
                    <div style={{
                      fontSize: 10, color: 'var(--accent-primary)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-green)', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
                      Open Challenge — Join Now
                    </div>

                    {/* Challenger info + stake */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AvatarBox user={c} size={38} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                            {displayName}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                            {c?.mlbb_ign || '—'} • {getWinRate(c?.wins || 0, c?.losses || 0)} WR
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>
                          {formatCurrency(match.stake_amount)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--neon-green)', marginTop: 1 }}>
                          Win {formatCurrency(match.stake_amount * 2 * 0.95)}
                        </div>
                      </div>
                    </div>

                    {/* Join Battle — always shown */}
                    <button onClick={() => handleAccept(match.id, match.stake_amount)} style={{
                      display: 'block', width: '100%', textAlign: 'center', border: 'none',
                      padding: '10px', borderRadius: 10, textDecoration: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                      color: 'white', fontWeight: 700, fontSize: 13,
                      boxShadow: '0 4px 12px var(--accent-glow)',
                    }}>
                      ⚔️ Join Battle
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ===== CREATE BOTTOM SHEET ===== */}
      {showCreate && (
        <>
          <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)',
            borderRadius: '24px 24px 0 0', padding: '24px 20px calc(80px + env(safe-area-inset-bottom, 0px))',
            animation: 'slideUp 0.28s ease',
          }}>
            <div style={{ width: 36, height: 4, background: 'var(--border-secondary)', borderRadius: 2, margin: '0 auto 20px' }} />
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              🎯 <span className="gradient-text">Create Challenge</span>
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Stake amount will be frozen from your wallet.
            </p>

            {/* Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {quickPresets.map(p => (
                <button key={p} onClick={() => setStakeInput(String(p))} style={{
                  padding: '10px 4px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  border: stakeInput === String(p) ? '1px solid var(--accent-primary)' : '1px solid var(--border-secondary)',
                  background: stakeInput === String(p) ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)',
                  color: stakeInput === String(p) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                  {(p / 1000).toFixed(0)}K
                </button>
              ))}
            </div>

            <input
              type="text" inputMode="numeric" pattern="[0-9]*" className="input-field"
              placeholder="Enter stake amount (MMK)"
              value={stakeInput ? Number(stakeInput).toLocaleString() : ''}
              onChange={e => setStakeInput(e.target.value.replace(/\D/g, ''))}
              style={{ marginBottom: 12 }}
            />

            {stakeInput && Number(stakeInput) > 0 && (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                {[
                  { label: 'Your Stake', value: formatCurrency(Number(stakeInput)) },
                  { label: 'Total Pot', value: formatCurrency(Number(stakeInput) * 2) },
                  { label: 'You Win', value: formatCurrency(Number(stakeInput) * 2 * 0.95), color: 'var(--neon-green)' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: (row as any).color || 'var(--text-secondary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !stakeInput || Number(stakeInput) < 1000}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: creating || !stakeInput || Number(stakeInput) < 1000
                  ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                color: creating || !stakeInput || Number(stakeInput) < 1000 ? 'var(--text-muted)' : 'white',
                fontWeight: 700, fontSize: 15, transition: 'all 0.2s',
                boxShadow: creating || !stakeInput ? 'none' : '0 6px 24px var(--accent-glow)',
              }}
            >
              {creating ? '🚀 Posting...' : '🚀 Post Challenge'}
            </button>
          </div>
        </>
      )}


      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
