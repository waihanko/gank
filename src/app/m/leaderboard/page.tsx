'use client';

import { useState, useEffect } from 'react';
import { getWinRate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function UserAvatar({ src, name, size }: { src?: string; name: string; size: number }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setErr(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: size * 0.28 }}
      />
    );
  }
  const initial = (name || 'U').replace('@', '').trim().charAt(0).toUpperCase();
  return <span style={{ fontSize: size * 0.4, fontWeight: 700 }}>{initial}</span>;
}

const medals = ['🥇', '🥈', '🥉'];
const medalGradients = [
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #94a3b8, #64748b)',
  'linear-gradient(135deg, #cd7f32, #b45309)',
];

export default function MobileLeaderboardPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/users/leaderboard`)
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const leaderboard = users.filter(u => !u.is_banned).sort((a, b) => b.wins - a.wins);
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div style={{ padding: '0 16px' }}>


      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: 68, background: 'var(--glass-bg)', borderRadius: 14, border: '1px solid var(--glass-border)', animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏜️</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>No players yet</div>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {top3.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
              {/* Reorder: 2nd, 1st, 3rd */}
              {[top3[1], top3[0], top3[2]].map((player, idx) => {
                if (!player) return <div key={idx} style={{ flex: 1 }} />;
                const rank = idx === 1 ? 0 : idx === 0 ? 1 : 2; // original rank index
                const isFirst = rank === 0;
                const avatarSize = isFirst ? 60 : 50;
                const heightBoost = isFirst ? 0 : 24;

                return (
                  <div
                    key={player.id}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'var(--glass-bg)',
                      border: `1px solid ${rank === 0 ? 'rgba(234,179,8,0.3)' : rank === 1 ? 'rgba(148,163,184,0.2)' : 'rgba(205,127,50,0.2)'}`,
                      borderRadius: 16,
                      padding: `${isFirst ? 20 : 16}px 8px ${isFirst ? 20 : 14}px`,
                      marginTop: heightBoost,
                    }}
                  >
                    <div style={{ fontSize: isFirst ? 28 : 20, marginBottom: 8 }}>{medals[rank]}</div>
                    <div style={{
                      width: avatarSize, height: avatarSize, borderRadius: avatarSize * 0.28,
                      background: medalGradients[rank],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', marginBottom: 8,
                      boxShadow: isFirst ? '0 0 20px rgba(245,158,11,0.4)' : 'none',
                    }}>
                      <UserAvatar src={player.avatar_url} name={player.telegram_display_name || player.username} size={avatarSize} />
                    </div>
                    <div style={{ fontSize: isFirst ? 13 : 11, fontWeight: 700, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {player.telegram_display_name || player.username}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {player.mlbb_ign}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div className="font-display" style={{ fontSize: isFirst ? 18 : 15, fontWeight: 800, color: 'var(--neon-green)' }}>{player.wins}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>W</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div className="font-display" style={{ fontSize: isFirst ? 18 : 15, fontWeight: 800, color: 'var(--neon-red)' }}>{player.losses}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>L</div>
                      </div>
                    </div>
                    <div style={{
                      marginTop: 6, padding: '3px 8px', borderRadius: 20,
                      background: 'rgba(6,182,212,0.12)', color: 'var(--neon-cyan)',
                      fontSize: 10, fontWeight: 700,
                    }}>
                      {getWinRate(player.wins, player.losses)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rank list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20 }}>
            {rest.map((player, i) => {
              const rank = i + 4;
              return (
                <div
                  key={player.id}
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {/* Rank */}
                  <div style={{
                    width: 30, textAlign: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: 'var(--text-muted)', flexShrink: 0,
                  }}>
                    #{rank}
                  </div>

                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    <UserAvatar src={player.avatar_url} name={player.telegram_display_name || player.username} size={38} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.telegram_display_name || player.username}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.mlbb_ign || '—'}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neon-green)' }}>{player.wins}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>W</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neon-red)' }}>{player.losses}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>L</div>
                    </div>
                    <div style={{
                      padding: '4px 8px', borderRadius: 20,
                      background: 'rgba(6,182,212,0.12)', color: 'var(--neon-cyan)',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {getWinRate(player.wins, player.losses)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
