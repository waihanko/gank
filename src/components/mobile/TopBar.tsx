'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { formatRelativeTime } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const pageTitles: Record<string, { title: string; emoji: string }> = {
  '/':            { title: 'Arena',       emoji: '👻' },
  '/matches':     { title: 'Match Arena', emoji: '⚔️' },
  '/leaderboard': { title: 'Leaderboard', emoji: '🏆' },
  '/profile':     { title: 'Profile',     emoji: '👤' },
  '/wallet':      { title: 'Wallet',      emoji: '💰' },
};

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const NOTIF_ICONS: Record<string, string> = {
  MATCH_JOINED:    '⚔️',
  MATCH_COMPLETED: '🏆',
  MATCH_DISPUTED:  '⚠️',
  MATCH_CANCELLED: '🗑️',
  PAYOUT:          '💰',
  DEPOSIT:         '📥',
  WITHDRAWAL:      '📤',
  SYSTEM:          '📢',
};

export default function MobileTopBar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, isLoggedIn, token } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [showNotifs, setShowNotifs]       = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const normalized = pathname.replace(/^\/m(\/|$)/, '/').replace(/\/$/, '') || '/';


  const page = pageTitles[normalized] ?? { title: 'Good Game', emoji: '👻' };

  const wallet  = (user as any)?.wallet;
  const balance = isLoggedIn && wallet ? Number(wallet.balance || 0) : null;

  // Fetch notifications every 30s
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 30000);
    return () => clearInterval(iv);
  }, [isLoggedIn, token]);

  async function fetchNotifications() {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const d   = await res.json();
      if (d.success) { setNotifications(d.data); setUnreadCount(d.unreadCount); }
    } catch {}
  }

  async function markRead(id: string) {
    if (!token) return;
    await fetch(`${API_URL}/api/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    if (!token) return;
    await fetch(`${API_URL}/api/notifications/read-all`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  // Close panel when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShowNotifs(false);
      }
    }
    if (showNotifs) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs]);

  // Routes that provide their own toolbar — hide the global TopBar
  if (normalized === '/transactions') return null;

  return (
    <>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10, 10, 15, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(124,58,237,0.12)',
        padding: '0 16px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Left: Logo + page title */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>
            👻
          </div>
          <div>
            <div className="font-display" style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, lineHeight: 1 }}>
              <span className="gradient-text">GOOD</span>
              <span style={{ color: 'var(--text-primary)' }}> GAME</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.3, marginTop: 1 }}>
              {page.emoji} {page.title}
            </div>
          </div>
        </Link>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLoggedIn ? (
            <>
              {/* Wallet balance chip — clickable */}
              <Link href="/wallet" style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '5px 10px',
                  background: 'rgba(234,179,8,0.1)',
                  border: '1px solid rgba(234,179,8,0.25)',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}>
                  💰 {balance !== null ? balance.toLocaleString() : '—'}
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>MMK</span>
                </div>
              </Link>

              {/* Notification bell */}
              <button
                ref={btnRef}
                onClick={() => { setShowNotifs(v => !v); if (!showNotifs && unreadCount > 0) {} }}
                style={{
                  position: 'relative', width: 36, height: 36, borderRadius: 10,
                  background: showNotifs ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                  border: showNotifs ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    color: 'white', fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', border: '2px solid var(--bg-primary)',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <Link href="/login" style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))',
              color: 'white', fontSize: 12, fontWeight: 700, textDecoration: 'none',
            }}>
              Login
            </Link>
          )}
        </div>
      </div>

      {/* Notification panel — slides down from top bar */}
      {showNotifs && isLoggedIn && (
        <div ref={panelRef} style={{
          position: 'fixed',
          top: 56,
          left: 0, right: 0,
          zIndex: 49,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid rgba(124,58,237,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          maxHeight: 'calc(100dvh - 56px - 80px)',
          overflowY: 'auto',
          animation: 'slideDown 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px', borderBottom: '1px solid var(--border-secondary)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              🔔 Notifications
              {unreadCount > 0 && (
                <span style={{ marginLeft: 8, fontSize: 10, background: 'rgba(239,68,68,0.15)', color: 'var(--neon-red)', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notifications yet</div>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => { if (!n.is_read) markRead(n.id); }}
                style={{
                  display: 'flex', gap: 12, padding: '12px 16px',
                  borderBottom: '1px solid var(--border-secondary)',
                  background: n.is_read ? 'transparent' : 'rgba(124,58,237,0.05)',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: n.is_read ? 'var(--bg-tertiary)' : 'rgba(124,58,237,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {NOTIF_ICONS[n.type] ?? '📢'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: n.is_read ? 500 : 700,
                    color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)',
                    marginBottom: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{formatRelativeTime(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
