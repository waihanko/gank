'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, getWinRate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Match {
  id: string;
  status: string;
  stake_amount: number;
  created_at: string;
  challenger?: { id: string; username: string; mlbb_ign: string; wins: number; losses: number; telegram_display_name?: string; avatar_url?: string };
  challenger_id?: string;
  opponent_id?: string;
}

function AvatarBox({ user, size = 40 }: { user: any; size?: number }) {
  const [err, setErr] = useState(false);
  const name = user?.telegram_display_name || user?.username || 'U';
  const initial = name.replace('@', '').charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: user?.avatar_url && !err ? undefined : 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', fontSize: size * 0.38, fontWeight: 700,
    }}>
      {user?.avatar_url && !err
        ? <img src={user.avatar_url} alt="" onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial}
    </div>
  );
}

export default function MobileLiveChallengesPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [token]);

  async function load() {
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const res = await fetch(`${API_URL}/api/matches?status=ACTIVE`, { headers });
      const d = await res.json();
      if (d.success) {
        setLiveMatches(
          d.data.filter((m: any) => m.status === 'ACTIVE' && !m.opponent_id)
        );
      }
    } catch {}
    setLoading(false);
  }

  const otherMatches = liveMatches.filter(m => m.challenger_id !== (user as any)?.id);

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg-primary)' }}>
      {/* ── Inner toolbar: back + title ── */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, zIndex: 40,
        background: 'rgba(10,10,15,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(124,58,237,0.18)',
        padding: '0 16px',
        height: 68,
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
      }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="font-display" style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>
              Live Challenges
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700,
              background: 'rgba(239,68,68,0.15)', color: 'var(--neon-red)',
              padding: '2px 7px', borderRadius: 10,
            }}>
              LIVE
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Join an open match</div>
        </div>
      </div>

      {/* Spacer for fixed toolbar */}
      <div style={{ height: 68, flexShrink: 0 }} />

      <div style={{ padding: '20px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 110, background: 'var(--glass-bg)', borderRadius: 16, border: '1px solid var(--glass-border)', animation: 'pulse 2s infinite' }} />
            ))}
          </div>
        ) : otherMatches.length === 0 ? (
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 16, padding: '40px 20px', textAlign: 'center',
            marginTop: 40
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏜️</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No open challenges</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Check back later or create your own challenge from the Arena.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {otherMatches.map(match => {
              const c = match.challenger;
              const displayName = c?.telegram_display_name || c?.username || '?';
              return (
                <div key={match.id} style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))',
                  border: '1px solid rgba(124,58,237,0.28)',
                  borderRadius: 16, padding: '16px',
                }}>
                  {/* Label */}
                  <div style={{
                    fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-green)', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
                    Open Challenge — Join Now
                  </div>

                  {/* Challenger info + stake */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <AvatarBox user={c} size={44} />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                          {displayName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {c?.mlbb_ign || '—'} • {getWinRate(c?.wins || 0, c?.losses || 0)} WR
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>
                        {formatCurrency(match.stake_amount)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--neon-green)', marginTop: 2 }}>
                        Win {formatCurrency(match.stake_amount * 2 * 0.95)}
                      </div>
                    </div>
                  </div>

                  {/* Join Battle */}
                  <Link href={`/m/battle/${match.id}`} style={{
                    display: 'block', textAlign: 'center',
                    padding: '12px', borderRadius: 12, textDecoration: 'none',
                    background: 'linear-gradient(135deg, var(--accent-primary), #6d28d9)',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    boxShadow: '0 4px 16px var(--accent-glow)',
                  }}>
                    ⚔️ Join Battle
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
