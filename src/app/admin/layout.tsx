'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV_ITEMS, PLATFORM_NAME } from '@/lib/constants';

const ICON_MAP: Record<string, string> = {
  LayoutDashboard: '📊',
  Swords: '⚔️',
  Users: '👥',
  MessageSquare: '💬',
  AlertTriangle: '⚠️',
  ArrowLeftRight: '💸',
  DollarSign: '💰',
  ShieldAccount: '🛡️',
  Wallet: '👜',
};

import { useEffect, useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setIsAdmin(true);
      return;
    }
    const token = localStorage.getItem('gr_admin_token');
    if (!token) {
      window.location.href = '/admin/login';
    } else {
      setIsAdmin(true);
    }
  }, [pathname]);

  if (!isAdmin) return null;

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          background: 'rgba(10, 10, 15, 0.95)',
          borderRight: '1px solid var(--border-secondary)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 40,
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <Link href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, paddingLeft: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            👻
          </div>
          <div>
            <div className="font-display gradient-text" style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>
              {PLATFORM_NAME.toUpperCase()}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.5 }}>Admin Panel</div>
          </div>
        </Link>

        {/* Nav Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: isActive ? 'rgba(124,58,237,0.15)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 18 }}>{ICON_MAP[item.icon] || '📄'}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 8px', borderTop: '1px solid var(--border-secondary)' }}>
          <Link href="/" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Back to Website
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: 260, padding: '32px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
