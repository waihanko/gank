'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, getWinRate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const STEPS = [
  { icon: '🎯', title: 'Post a Challenge', desc: 'Set your custom stake amount and wait for an opponent. Your funds are frozen instantly.' },
  { icon: '🤝', title: 'Get Matched', desc: 'An opponent accepts your challenge. Both players join a private Telegram battle room.' },
  { icon: '⚔️', title: 'Battle in MLBB', desc: 'Exchange IDs, sync up, and fight. The group is muted during the match — no interference.' },
  { icon: '📸', title: 'Submit Proof', desc: 'Click WON/LOST and upload your scoreboard screenshot for AI verification.' },
  { icon: '🤖', title: 'AI Verifies', desc: 'Google Vision OCR reads Victory status, Battle ID, and usernames from the screenshot.' },
  { icon: '💰', title: 'Instant Payout', desc: 'Winner receives 95% of total pot. Room is wiped and recycled. Zero friction.' },
];

const FEATURES = [
  { icon: '🔒', title: 'Escrow Protection', desc: 'Funds are frozen before battle and only released after AI verification.' },
  { icon: '🤖', title: 'AI Referee', desc: 'No human bias. Google Vision OCR verifies every match result objectively.' },
  { icon: '⚡', title: 'Instant Settlements', desc: 'Payouts happen within seconds of verification. No waiting.' },
  { icon: '🧹', title: 'Auto-Wipe Rooms', desc: 'Telegram rooms are automatically cleaned and recycled after each match.' },
  { icon: '🛡️', title: 'Anti-Fraud', desc: 'Duplicate screenshots, battle ID recycling, and lying are all detected and punished.' },
  { icon: '📊', title: 'Full Transparency', desc: 'Every match log, screenshot, and transaction is archived for dispute resolution.' },
];

interface Match {
  id: string;
  status: string;
  stake_amount: number;
  total_pot: number;
  created_at: string;
  challenger?: {
    id: string;
    username: string;
    mlbb_ign: string;
    wins: number;
    losses: number;
  };
}

interface Player {
  id: string;
  username: string;
  mlbb_ign: string;
  wins: number;
  losses: number;
}

interface Stats {
  totalMatches: number;
  totalUsers: number;
  totalPrizePool: number;
}

export default function HomePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<Stats>({ totalMatches: 0, totalUsers: 0, totalPrizePool: 0 });

  useEffect(() => {
    // Fetch live challenges
    fetch(`${API_URL}/api/matches?status=PENDING_JOIN`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setMatches(d.data.slice(0, 6));
      })
      .catch(() => {});

    // Fetch leaderboard for top players
    fetch(`${API_URL}/api/matches/leaderboard`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setTopPlayers(d.data.slice(0, 3));
      })
      .catch(() => {});

    // Fetch stats
    fetch(`${API_URL}/api/matches/stats`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setStats(d.data);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <Navbar />

      {/* ======================== HERO ======================== */}
      <section
        style={{
          position: 'relative',
          padding: '120px 24px 100px',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Floating elements */}
        <div className="animate-float" style={{ position: 'absolute', top: '15%', left: '10%', fontSize: 60, opacity: 0.1 }}>⚔️</div>
        <div className="animate-float" style={{ position: 'absolute', top: '25%', right: '10%', fontSize: 50, opacity: 0.1, animationDelay: '2s' }}>🏆</div>
        <div className="animate-float" style={{ position: 'absolute', bottom: '20%', left: '15%', fontSize: 45, opacity: 0.1, animationDelay: '4s' }}>🎮</div>

        <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div
            className="animate-fade-in-up"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-primary)',
              borderRadius: 40,
              fontSize: 13,
              color: 'var(--accent-primary)',
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            <span style={{ animation: 'pulse-dot 2s infinite' }}>🟢</span> Live Platform — Real Stakes, Real Payouts
          </div>

          <h1
            className="font-display animate-fade-in-up"
            style={{
              fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: 24,
              animationDelay: '0.1s',
            }}
          >
            <span className="gradient-text">GOOD</span>{' '}
            <span style={{ color: 'var(--text-primary)' }}>GAME</span>
          </h1>

          <p
            className="animate-fade-in-up"
            style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxWidth: 600,
              margin: '0 auto 40px',
              animationDelay: '0.2s',
            }}
          >
            The ultimate automated escrow for MLBB. Set your stake, find an opponent,
            battle it out — our AI referee judges the result and pays instantly.
            <strong style={{ color: 'var(--accent-secondary)' }}> Zero friction. Maximum trust.</strong>
          </p>

          <div
            className="animate-fade-in-up"
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              flexWrap: 'wrap',
              animationDelay: '0.3s',
            }}
          >
            <Link href="/matches" className="btn-primary" style={{ fontSize: 16, padding: '16px 36px' }}>
              ⚔️ Browse Matches
            </Link>
            <Link href="#how-it-works" className="btn-secondary" style={{ fontSize: 16, padding: '16px 36px' }}>
              How It Works
            </Link>
          </div>

          {/* Stats strip */}
          <div
            className="animate-fade-in-up"
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 48,
              marginTop: 60,
              flexWrap: 'wrap',
              animationDelay: '0.4s',
            }}
          >
            {[
              { value: stats.totalMatches > 0 ? `${stats.totalMatches}+` : '—', label: 'Matches Completed' },
              { value: stats.totalUsers > 0 ? `${stats.totalUsers}` : '—', label: 'Active Players' },
              { value: stats.totalPrizePool > 0 ? formatCurrency(stats.totalPrizePool) : '—', label: 'Total Prize Pool' },
              { value: '5%', label: 'Platform Fee' },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div className="font-display gradient-text" style={{ fontSize: 28, fontWeight: 800 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================== OPEN MATCHES ======================== */}
      <section style={{ padding: '60px 24px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h2 className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
              🔥 <span className="gradient-text">Live Challenges</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Accept a challenge and battle now</p>
          </div>
          <Link href="/matches" className="btn-secondary btn-sm">View All →</Link>
        </div>

        {matches.length === 0 ? (
          <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏜️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No live challenges right now</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Be the first to create one!</div>
            <Link href="/matches" className="btn-primary">🚀 Create Challenge</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
            {matches.map((match) => (
              <div key={match.id} className="glass-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {match.challenger?.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{match.challenger?.username || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {match.challenger?.mlbb_ign || '—'} • {getWinRate(match.challenger?.wins || 0, match.challenger?.losses || 0)} WR
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={match.status} />
                </div>

                <div
                  style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: 12,
                    padding: 16,
                    textAlign: 'center',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    Stake Amount
                  </div>
                  <div className="font-display gradient-text-gold" style={{ fontSize: 28, fontWeight: 800 }}>
                    {formatCurrency(match.stake_amount)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Winner gets {formatCurrency(match.stake_amount * 2 * 0.95)}
                  </div>
                </div>

                <Link href="/matches" className="btn-primary" style={{ width: '100%', justifyContent: 'center', display: 'flex', textDecoration: 'none' }}>
                  ⚔️ Accept Challenge
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ======================== HOW IT WORKS ======================== */}
      <section id="how-it-works" style={{ padding: '80px 24px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 className="font-display" style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
            <span className="gradient-text">How It Works</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
            From challenge to payout in 6 simple steps. Fully automated, zero trust required.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="glass-card"
              style={{
                padding: 28,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  fontSize: 60,
                  fontWeight: 900,
                  opacity: 0.04,
                  fontFamily: 'Orbitron, sans-serif',
                }}
              >
                0{i + 1}
              </div>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{step.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{step.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ======================== FEATURES ======================== */}
      <section style={{ padding: '80px 24px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 className="font-display" style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
            <span className="gradient-text">Built Different</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            Every feature designed to eliminate fraud and maximize trust.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map((feature, i) => (
            <div key={i} className="glass-card" style={{ padding: 28 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{feature.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{feature.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ======================== TOP PLAYERS ======================== */}
      <section style={{ padding: '80px 24px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h2 className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
            🏆 <span className="gradient-text">Top Players</span>
          </h2>
          <Link href="/leaderboard" className="btn-secondary btn-sm">Full Leaderboard →</Link>
        </div>

        {topPlayers.length === 0 ? (
          <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No players yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Be the first to compete!</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {topPlayers.map((player, i) => (
              <div
                key={player.id}
                className="glass-card"
                style={{
                  padding: 28,
                  textAlign: 'center',
                  borderColor: i === 0 ? 'rgba(234,179,8,0.3)' : undefined,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </div>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${i === 0 ? '#f59e0b, #fbbf24' : 'var(--accent-primary), var(--accent-secondary)'})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 700,
                    margin: '0 auto 12px',
                  }}
                >
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{player.username}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{player.mlbb_ign}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
                  <div>
                    <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-green)' }}>{player.wins}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wins</div>
                  </div>
                  <div>
                    <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-red)' }}>{player.losses}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Losses</div>
                  </div>
                  <div>
                    <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--neon-cyan)' }}>{getWinRate(player.wins, player.losses)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Win Rate</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ======================== CTA ======================== */}
      <section
        style={{
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <div
          className="glass-card animate-glow-pulse"
          style={{
            maxWidth: 700,
            margin: '0 auto',
            padding: '60px 40px',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 20 }}>👻⚔️</div>
          <h2 className="font-display" style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
            Ready to <span className="gradient-text">Prove Yourself?</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
            Create a challenge with your custom stake and let Good Game handle the rest.
          </p>
          <Link href="/matches" className="btn-primary" style={{ fontSize: 16, padding: '16px 40px' }}>
            🚀 Create Challenge
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
