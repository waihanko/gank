import Link from 'next/link';
import { PLATFORM_NAME } from '@/lib/constants';

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-secondary)',
        padding: '48px 24px',
        background: 'rgba(10, 10, 15, 0.6)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 40,
        }}
      >
        {/* Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>👻</span>
            <span className="font-display gradient-text" style={{ fontSize: 16, fontWeight: 800 }}>
              {PLATFORM_NAME.toUpperCase()}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
            Automated zero-friction escrow and matchmaking for Mobile Legends: Bang Bang.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 16 }}>
            Platform
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/matches" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>Browse Matches</Link>
            <Link href="/leaderboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>Leaderboard</Link>
            <Link href="/wallet" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>My Wallet</Link>
          </div>
        </div>

        {/* Support */}
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 16 }}>
            Support
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>How It Works</Link>
            <Link href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>FAQ</Link>
            <Link href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>Contact Us</Link>
          </div>
        </div>

        {/* Connect */}
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 16 }}>
            Connect
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>📱 Telegram Community</a>
            <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}>🎮 Discord</a>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          marginTop: 40,
          paddingTop: 24,
          borderTop: '1px solid var(--border-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          © 2026 {PLATFORM_NAME}. All rights reserved. Confidential & Proprietary.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Platform Commission: 5% • Currency: MMK
        </p>
      </div>
    </footer>
  );
}
