'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  {
    href: '/',
    label: 'Arena',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    href: '/matches',
    label: 'Matches',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 9l6 6M15 9l-6 6"/>
      </svg>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Ranks',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
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
        const isActive = tab.href === '/'
          ? normalized === '/' || normalized === ''
          : normalized === tab.href || normalized.startsWith(tab.href + '/');
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
