'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, getWinRate, formatRelativeTime } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

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

export default function MobileMatchesPage() {
  const router = useRouter();
  const { isLoggedIn, token, user } = useAuth();
  const { showAlert, showConfirm } = useDialog();

  const [matches, setMatches] = useState<any[]>([]);
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stakeInput, setStakeInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const [timeLeft, setTimeLeft] = useState(0);

  const myLive = myMatches.find(m =>
    ['PENDING_JOIN', 'ACTIVE', 'ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'].includes(m.status)
  );

  useEffect(() => {
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [token]);

  useEffect(() => {
    const pending = myMatches.find(m => m.status === 'PENDING_JOIN' && m.challenger_id === user?.id);
    if (!pending) return;
    const update = () => {
      const exp = new Date(pending.created_at).getTime() + 5 * 60 * 1000;
      setTimeLeft(Math.max(0, Math.floor((exp - Date.now()) / 1000)));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [myMatches, user]);

  async function load() {
    try {
      const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
      const [mRes, myRes] = await Promise.all([
        fetch(`${API_URL}/api/matches`, { headers }).then(r => r.json()).catch(() => ({ success: false })),
        token
          ? fetch(`${API_URL}/api/matches/my-recent`, { headers }).then(r => r.json()).catch(() => ({ success: false }))
          : Promise.resolve({ success: false }),
      ]);
      if (mRes.success) setMatches(mRes.data);
      if (myRes.success) setMyMatches(myRes.data);
    } catch {}
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

  async function handleAccept(id: string) {
    if (!isLoggedIn) { window.location.href = '/login'; return; }
    try {
      const res = await fetch(`${API_URL}/api/matches/${id}/accept`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        load();
        router.push('/m/battle/' + id);
      } else showAlert(data.error);
    } catch { showAlert('Network error'); }
  }

  async function handleDelete(id: string) {
    showConfirm('Cancel this challenge? Your stake will be returned.', async () => {
      setDeleting(true);
      try {
        const res = await fetch(`${API_URL}/api/matches/${id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (d.success) load();
        else showAlert(d.error);
      } catch { showAlert('Failed to delete'); }
      finally { setDeleting(false); }
    });
  }

  const quickPresets = [1000, 2000, 5000, 10000];

  return (
    <div style={{ padding: '0 16px' }}>



      {/* Match Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 88, background: 'var(--glass-bg)', borderRadius: 14, border: '1px solid var(--glass-border)', animation: 'pulse 2s infinite' }} />
          ))
        ) : matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏜️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No matches yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Be the first to create a challenge!</div>
          </div>
        ) : (
          matches.map(match => {
            const c = match.challenger;
            const o = match.opponent;
            const isMyChallenge = match.challenger_id === user?.id;
            const isOpponent = match.opponent_id === user?.id;
            const canJoin = match.status === 'ACTIVE' && !match.opponent_id && match.challenger_id !== user?.id;
            const isCompleted = ['COMPLETED', 'VOIDED', 'CANCELLED', 'DISPUTED'].includes(match.status);

            return (
              <div
                key={match.id}
                style={{
                  background: 'var(--glass-bg)',
                  border: isMyChallenge || isOpponent
                    ? '1px solid rgba(124,58,237,0.35)'
                    : '1px solid var(--glass-border)',
                  borderRadius: 14, padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Challenger */}
                  <AvatarBox user={c} size={42} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c?.telegram_display_name || c?.username || '?'}
                      </span>
                      {isMyChallenge && (
                        <span style={{ fontSize: 9, background: 'rgba(124,58,237,0.2)', color: 'var(--accent-primary)', padding: '1px 6px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>YOU</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {c?.mlbb_ign || '—'} • {getWinRate(c?.wins || 0, c?.losses || 0)} WR
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                      {formatRelativeTime(match.created_at)}
                    </div>
                  </div>

                  {/* Right side */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b' }}>
                      {formatCurrency(match.stake_amount)}
                    </div>
                    {!isCompleted && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                        Win {formatCurrency(match.stake_amount * 2 * 0.95)}
                      </div>
                    )}
                    {isCompleted && match.status === 'COMPLETED' && match.winner_id && (
                      <div style={{ fontSize: 10, color: 'var(--neon-green)', fontWeight: 700, marginTop: 1 }}>
                        🏆 {match.winner_id === match.challenger_id ? c?.username : o?.username}
                      </div>
                    )}
                    {match.status === 'DISPUTED' && (
                      <div style={{ fontSize: 10, color: 'var(--neon-red)', fontWeight: 700, marginTop: 1 }}>⚠️ Disputed</div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      <StatusBadge status={match.status} />
                    </div>
                  </div>
                </div>

                {/* Join button */}
                {canJoin && (
                  <button
                    onClick={() => handleAccept(match.id)}
                    style={{
                      marginTop: 12, width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))',
                      color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      boxShadow: '0 4px 12px var(--accent-glow)',
                    }}
                  >
                    ⚔️ Join Battle
                  </button>
                )}

                {/* Opponent join room */}
                {isOpponent && !match.opponent_joined && match.status === 'ACTIVE' && match.opponent_invite_link && (
                  <a
                    href={match.opponent_invite_link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'block', marginTop: 12, textAlign: 'center',
                      padding: '11px', borderRadius: 10, textDecoration: 'none',
                      background: 'linear-gradient(135deg, #0088cc, #006ba6)',
                      color: 'white', fontWeight: 700, fontSize: 13,
                    }}
                  >
                    📱 Join Battle Room
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ===== CREATE BOTTOM SHEET ===== */}
      {showCreate && (
        <>
          <div
            onClick={() => setShowCreate(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-primary)',
            borderRadius: '24px 24px 0 0',
            padding: '24px 20px 48px',
            animation: 'slideUp 0.28s ease',
          }}>
            {/* Handle */}
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
                <button
                  key={p}
                  onClick={() => setStakeInput(String(p))}
                  style={{
                    padding: '10px 4px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: stakeInput === String(p) ? '1px solid var(--accent-primary)' : '1px solid var(--border-secondary)',
                    background: stakeInput === String(p) ? 'rgba(124,58,237,0.15)' : 'var(--bg-tertiary)',
                    color: stakeInput === String(p) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {(p / 1000).toFixed(0)}K
                </button>
              ))}
            </div>

            {/* Input */}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input-field"
              placeholder="Enter stake amount (MMK)"
              value={stakeInput ? Number(stakeInput).toLocaleString() : ''}
              onChange={e => setStakeInput(e.target.value.replace(/\D/g, ''))}
              style={{ marginBottom: 12 }}
            />

            {/* Preview */}
            {stakeInput && Number(stakeInput) > 0 && (
              <div style={{
                background: 'var(--bg-tertiary)', borderRadius: 12, padding: '12px 14px', marginBottom: 16,
              }}>
                {[
                  { label: 'Your Stake', value: formatCurrency(Number(stakeInput)), color: undefined },
                  { label: 'Total Pot', value: formatCurrency(Number(stakeInput) * 2), color: undefined },
                  { label: 'You Win', value: formatCurrency(Number(stakeInput) * 2 * 0.95), color: 'var(--neon-green)' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: row.color || 'var(--text-secondary)', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontWeight: 600 }}>{row.value}</span>
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
                  ? 'var(--bg-tertiary)'
                  : 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))',
                color: creating || !stakeInput || Number(stakeInput) < 1000 ? 'var(--text-muted)' : 'white',
                fontWeight: 700, fontSize: 15,
                boxShadow: creating || !stakeInput ? 'none' : '0 6px 24px var(--accent-glow)',
                transition: 'all 0.2s',
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
