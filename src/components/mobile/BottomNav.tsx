'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  {
    href: '/',
    label: 'Arena',
    icon: (active: boolean) => (
      <span style={{ fontSize: 20 }}>👻</span>
    ),
  },
  {
    href: '/m/battle-history',
    label: 'History',
    icon: (active: boolean) => (
      <span style={{ fontSize: 20 }}>🕒</span>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Ranks',
    icon: (active: boolean) => (
      <span style={{ fontSize: 20 }}>🏆</span>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <span style={{ fontSize: 20 }}>👤</span>
    ),
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Normalize pathname: handles both /m/matches (direct) and /matches (proxy rewrite)
  // /m → /, /m/ → /, /m/matches → /matches, /matches → /matches
  const normalized = pathname.replace(/^\/m(\/|$)/, '/').replace(/\/$/, '') || '/';

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: 'rgba(10, 10, 15, 0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(124, 58, 237, 0.15)',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {tabs.map((tab) => {
        const strippedHref = tab.href.replace(/^\/m(\/|$)/, '/').replace(/\/$/, '') || '/';
        const isActive = strippedHref === '/'
          ? normalized === '/' || normalized === ''
          : normalized === strippedHref || normalized.startsWith(strippedHref + '/');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 0 8px',
              gap: 4,
              color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
              textDecoration: 'none',
              transition: 'color 0.2s',
              position: 'relative',
            }}
          >
            {isActive && (
              <span style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 32,
                height: 2,
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                borderRadius: '0 0 4px 4px',
              }} />
            )}
            <span style={{
              transition: 'transform 0.2s, filter 0.2s',
              transform: isActive ? 'scale(1.1)' : 'scale(1)',
              filter: isActive ? 'drop-shadow(0 0 8px rgba(124,58,237,0.8))' : 'none',
            }}>
              {tab.icon(isActive)}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
            }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
