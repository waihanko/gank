'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getWinRate } from '@/lib/utils';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function UserAvatar({ src, name, telegramName, telegramDisplayName, size, borderRadius }: { src?: string, name: string, telegramName?: string, telegramDisplayName?: string, size: number, borderRadius: number }) {
  const [error, setError] = useState(false);

  if (src && !error) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius }}
      />
    );
  }

  const initial = (telegramDisplayName || telegramName || name || 'U').replace('@', '').trim().charAt(0).toUpperCase();
  return <span>{initial}</span>;
}

export default function LeaderboardPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/leaderboard`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
    setLoading(false);
  }

  const leaderboard = users
    .filter((u) => !u.is_banned)
    .sort((a, b) => b.wins - a.wins);

  const medals = ['🥇', '🥈', '🥉'];

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            Loading leaderboard...
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800 }}>
            🏆 <span className="gradient-text">Leaderboard</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            Top players ranked by total wins
          </p>
        </div>

        {/* Top 3 Podium */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 48, flexWrap: 'wrap' }}>
          {leaderboard.slice(0, 3).map((player, i) => {
            const order = i === 0 ? 2 : i === 1 ? 1 : 3;
            const size = i === 0 ? 80 : 64;
            return (
              <div
                key={player.id}
                className="glass-card"
                style={{
                  padding: 28,
                  textAlign: 'center',
                  width: i === 0 ? 240 : 200,
                  order,
                  marginTop: i === 0 ? 0 : 30,
                  borderColor: i === 0 ? 'rgba(234,179,8,0.3)' : i === 1 ? 'rgba(192,192,192,0.2)' : 'rgba(205,127,50,0.2)',
                }}
              >
                <div style={{ fontSize: i === 0 ? 48 : 36, marginBottom: 12 }}>{medals[i]}</div>
                <div
                  style={{
                    width: size,
                    height: size,
                    borderRadius: 20,
                    background: i === 0
                      ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                      : i === 1
                      ? 'linear-gradient(135deg, #94a3b8, #cbd5e1)'
                      : 'linear-gradient(135deg, #d97706, #b45309)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: size * 0.4,
                    fontWeight: 700,
                    margin: '0 auto 12px',
                    overflow: 'hidden'
                  }}
                >
                  <UserAvatar src={player.avatar_url} name={player.username} telegramName={player.telegram_username} telegramDisplayName={player.telegram_display_name} size={size} borderRadius={20} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{player.username}</div>
                <div style={{ fontSize: 13, color: 'var(--accent-secondary)', marginBottom: 4 }}>{player.mlbb_ign}</div>
                <div style={{ marginBottom: 16 }}></div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
                  <div>
                    <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--neon-green)' }}>{player.wins}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wins</div>
                  </div>
                  <div>
                    <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--neon-red)' }}>{player.losses}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Losses</div>
                  </div>
                  <div>
                    <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--neon-cyan)' }}>{getWinRate(player.wins, player.losses)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>WR</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Full Table */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>MLBB IGN</th>
                <th>Wins</th>
                <th>Losses</th>
                <th>Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, i) => (
                <tr key={player.id}>
                  <td>
                    <span style={{ fontSize: 16 }}>{i < 3 ? medals[i] : `#${i + 1}`}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                          overflow: 'hidden'
                        }}
                      >
                        <UserAvatar src={player.avatar_url} name={player.username} telegramName={player.telegram_username} telegramDisplayName={player.telegram_display_name} size={32} borderRadius={8} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{player.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>{player.mlbb_ign}</td>
                  <td style={{ color: 'var(--neon-green)', fontWeight: 700 }}>{player.wins}</td>
                  <td style={{ color: 'var(--neon-red)', fontWeight: 700 }}>{player.losses}</td>
                  <td>
                    <span
                      style={{
                        background: 'rgba(6,182,212,0.15)',
                        color: 'var(--neon-cyan)',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {getWinRate(player.wins, player.losses)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Footer />
    </>
  );
}
